/*
  send-data.js — WG.131026.1500.799
  ============
  TEK görevi: sepeti + seçili müşteriyi + belge türünü alıp Firebase
  arşivine ESKİ UYGULAMAYLA UYUMLU bir kayıt yazmak. Uyumluluk önemli:
  Ana Sayfa'daki "Bu Ay Satışım" hesaplaması bu kayıtları okuyor
  (bkz. home-data.js -> buAyinVerisi).

  NOT: Eski uygulamadaki "aynı gün + aynı ürün seti ise revize say" ve
  "revizeGecmisi" mantığı bu ilk sürümde YOK — her kayıt yeni bir satır
  olarak eklenir. Bu basitleştirme bilinçli: önce akışın uçtan uca sağlam
  çalıştığından emin olunuyor, revize birleştirme sonraki pakette eklenir.
*/

var SendData = (function(){

  function baslat(){
    try{
      if(!firebase.apps.length){ firebase.initializeApp(WEICON_FIREBASE_CONFIG); }
    }catch(e){ console.error("Firebase başlatma hatası:", e); }
  }

  function tarihStr(){
    var aylar = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
    var d = new Date();
    return d.getDate() + " " + aylar[d.getMonth()] + " " + d.getFullYear() + " " + 
      String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0");
  }

  // Belge kodu formatı (v3, 12.10.2026 — Abdullah'ın isteğiyle):
  // {ÖNEK}{SSS}   {GG.AA.YYYY}   {SS:DD} — örn. "FT001   12.10.2026   15:45"
  // (günün İLK belgesi — numune/teklif/proforma/sipariş FARK ETMEKSİZİN
  // GÜNLÜK ORTAK sayaç — ikincisi 002, ...; her gün 001'den başlar, bkz.
  // gunlukSiraNoAl()). Önekler: Numune→NM, Fiyat Teklifi→FT,
  // Proforma Fatura→PF, Sipariş→SP — her zaman 2 harf. Bu önek, belgenin
  // O ANKİ türünü gösterir; bir belge Numune'den Teklif'e, Teklif'ten
  // Sipariş'e İLERLEDİKÇE sıra/tarih/saat kısmı SABİT kalır (bkz.
  // reports-data.js revizeBaslat/ilerletmeyiTamamla), sadece önek
  // güncellenir — böylece aynı iş fırsatı hep aynı "numara" ile takip
  // edilebilir. Kod STORED haliyle zaten görüntülenmeye hazır (gerçek
  // boşluklarla) — ekranlarda ayrıca biçimlendirme gerekmez.
  var KOD_ONEK = {numune:"NM", teklif:"FT", proforma:"PF", siparis:"SP"};

  // Günlük, TÜRDEN BAĞIMSIZ ortak sayaç — "gunlukKodSayaci/{YYYYAAGG}"
  // düğümünde Firebase transaction ile atomik artırılır (iki cihaz aynı
  // anda kod üretirse çakışma olmaz, Firebase otomatik tekrar dener).
  // İnternet gerektirir — bkz. kaydet() içindeki çağrı noktası.
  // DÜZELTME (13.10.2026, Abdullah'ın "Belge numarası alınamadı" hatası
  // bildirmesiyle): Firebase transaction'ı mobilde ağ geçişi (WiFi<->5G,
  // ekran kilidinden uyanma vb.) sırasında İLK denemede geçici olarak
  // başarısız olabiliyor — internet asıl bağlıyken bile. Artık ilk
  // deneme başarısız olursa 700ms sonra OTOMATİK 1 kez daha deneniyor;
  // yine olmazsa, gerçek Firebase hata metni (sadece console değil)
  // kullanıcıya gösterilen mesaja da eklenir — "internet bağlantınızı
  // kontrol edin" her zaman aynı genel cümle yerine asıl sebep görülebilsin.
  function gunlukSiraNoAl(cb, denemeSayisi){
    denemeSayisi = denemeSayisi || 0;
    try{
      var d = new Date();
      var gunAnahtari = d.getFullYear() + String(d.getMonth()+1).padStart(2,"0") + String(d.getDate()).padStart(2,"0");
      var db = firebase.database();
      db.ref("gunlukKodSayaci/" + gunAnahtari).transaction(function(mevcut){
        return (mevcut||0) + 1;
      }).then(function(sonuc){
        if(!sonuc || !sonuc.committed){
          if(denemeSayisi < 1){ setTimeout(function(){ gunlukSiraNoAl(cb, denemeSayisi+1); }, 700); return; }
          cb(null, "sunucuyla senkronizasyon tamamlanamadı");
          return;
        }
        cb(sonuc.snapshot.val());
      }).catch(function(err){
        console.error("Günlük sıra no alınamadı:", err);
        if(denemeSayisi < 1){ setTimeout(function(){ gunlukSiraNoAl(cb, denemeSayisi+1); }, 700); return; }
        cb(null, (err && err.message) ? err.message : null);
      });
    }catch(e){
      console.error("Günlük sıra no hatası:", e);
      cb(null, e && e.message);
    }
  }

  // sira verilirse (günün o anki ortak sıra numarası) yeni bir kod gövdesi
  // (sıra + tarih + saat) üretir — "001   12.10.2026   15:45" gibi.
  function kodGovdesiOlustur(sira){
    var d = new Date();
    var tarihKismi = String(d.getDate()).padStart(2,"0") + "." + String(d.getMonth()+1).padStart(2,"0") + "." + d.getFullYear();
    var saatKismi = String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0");
    return String(sira).padStart(3,"0") + "   " + tarihKismi + "   " + saatKismi;
  }

  // Önek + gövde birleştirir. varGovde HER ZAMAN önceden hazır olmalı —
  // ya bir önceki aşamadan devralınmış (bkz. kodTarihSaatKismiAyikla), ya
  // da kaydet() içinde gunlukSiraNoAl()'dan gelen sırayla kodGovdesiOlustur()
  // ile az önce üretilmiş.
  function kodUret(tip, varGovde){
    var onek = KOD_ONEK[tip] || "KY";
    return onek + (varGovde || "");
  }

  // Bir kod string'inden önek dışındaki gövdeyi ayıklar — önek HER ZAMAN
  // 2 harf (NM/FT/PF/SP) olduğu için basitçe ilk 2 karakteri atar. Eski
  // (v2, nokta tabanlı) kodlarla da uyumlu — önek yine ilk 2 karakterde.
  function kodTarihSaatKismiAyikla(kod){
    if(!kod) return null;
    return kod.slice(2);
  }

  function urunSetiImzaOlustur(urunler){
    // KÖK NEDEN DÜZELTMESİ (14.09.2026): imza sadece ürün koduna (berta+abas)
    // bakıyordu — adet ve iskontoyu YOK SAYIYORDU. Bu yüzden aynı müşteriye
    // aynı gün, aynı ürünle ama FARKLI adet/fiyatla girilen GERÇEKTEN AYRI
    // bir sipariş, "aynı sipariş" sanılıp bir önceki kaydın üzerine REVİZE
    // olarak yazılıyor, önceki sipariş görünmez oluyordu. Artık adet ve
    // iskonto da imzaya dahil — sadece ürün, adet VE iskonto birebir aynıysa
    // (gerçekten yanlışlıkla tekrar kaydetme durumu) revize sayılır.
    return (urunler||[]).map(function(u){ return (u.berta||"")+"|"+(u.abas||"")+"|"+(parseFloat(u.adet)||0)+"|"+(parseFloat(u.iskonto)||0); }).sort().join(",");
  }

  function fiyatGecmisiKontrolEt(musteri, sepet, geriBildir){
    try{
      var db = firebase.database();
      db.ref("arsiv").once("value").then(function(snap){
        var arsiv = snap.val() || {};
        var uyarilar = [];
        ["teklif","proforma","siparis"].forEach(function(tip){
          var liste = arsiv[tip];
          if(!liste) return;
          liste = Array.isArray(liste) ? liste : Object.values(liste);
          liste.forEach(function(kayit){
            if((kayit.musteri||"").trim().toLocaleLowerCase("tr-TR") !== (musteri.ad||"").trim().toLocaleLowerCase("tr-TR")) return;
            (kayit.urunler||[]).forEach(function(u){
              sepet.forEach(function(su){
                if(!su.berta && !su.abas) return;
                if(u.berta !== su.berta || u.abas !== su.abas) return;
                var eskiFiyat = u.iskBirim || 0;
                var yeniFiyat = parseFloat(su.listeFiyat)||0;
                var yeniIskontolu = yeniFiyat - (yeniFiyat*(parseFloat(su.iskonto)||0)/100);
                if(yeniIskontolu < eskiFiyat){
                  uyarilar.push({urun:su.ad, eskiFiyat:eskiFiyat, yeniFiyat:yeniIskontolu, eskiTarih:kayit.tarih});
                }
              });
            });
          });
        });
        geriBildir(uyarilar);
      }).catch(function(){ geriBildir([]); });
    }catch(e){ geriBildir([]); }
  }

  function ayniGunMu(ts1, ts2){
    var d1 = new Date(ts1), d2 = new Date(ts2);
    return d1.getFullYear()===d2.getFullYear() && d1.getMonth()===d2.getMonth() && d1.getDate()===d2.getDate();
  }

  function kaydet(tip, musteri, sepetUrunleri, kur, kdv, adresler, devralinanKod, devralinanTarih, devralinanRota, geriBildir, kurManuelMi){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      if(!musteri || !musteri.ad) throw new Error("Müşteri bilgisi eksik.");
      if(!tip || ["numune","teklif","proforma","siparis"].indexOf(tip)===-1) throw new Error("Geçersiz belge türü.");
      if(!sepetUrunleri || !sepetUrunleri.length) throw new Error("Sepette kayıt edilecek ürün yok.");

      kur = kur || 0; // Firebase undefined kabul etmez — güvenli varsayılan.
      // Firebase, obje içinde HERHANGİ bir "undefined" değer varsa TÜM
      // yazmayı reddeder (ör. eski/zincirlenmiş revize kayıtlarında ürün
      // adı bir şekilde boş kalmışsa). Bu yüzden her alanı güvenli bir
      // varsayılana düşürüyoruz — asla undefined Firebase'e gitmesin.
      var urunlerKaydi = sepetUrunleri.map(function(u){
        var h = CartData.hesapla(u, kur, kdv);
        return {
          ad: u.ad || "İsimsiz Ürün",
          berta: u.berta || "",
          abas: u.abas || "",
          listeFiyat: parseFloat(u.listeFiyat)||0,
          dipFiyat: parseFloat(u.dipFiyat)||0,
          iskonto: parseFloat(u.iskonto)||0,
          adet: parseFloat(u.adet)||0,
          iskBirim: h.iskontoluFiyat || 0,
          toplamEuro: h.toplamEuro || 0,
          ozelEtiket: u.ozelEtiket || null,
          // BAKİYE (07.10.2026) — stokta olmayıp müşteride bakiyede kalan
          // adet + opsiyonel not. "adet" alanı yukarıda zaten gönderilen/
          // faturalanan miktar olarak kaydediliyor, bu sadece ek metadata.
          bakiyeAdet: parseFloat(u.bakiyeAdet)||0,
          bakiyeNot: u.bakiyeNot || ""
        };
      });
      var yeniImza = urunSetiImzaOlustur(urunlerKaydi);
      var simdi = Date.now();
      // Bir önceki aşamadan (Numune→Teklif→Sipariş) devralınan kod varsa,
      // sıra/tarih/saat gövdesi korunur — sadece önek yeni türe göre değişir.
      // Yoksa (taze belge) günlük ORTAK sırayı Firebase'den almamız gerekiyor
      // — bu adım asenkron (internet gerektirir), bu yüzden asıl kayıt
      // işlemi (devamEt) bu adım tamamlanana kadar bekliyor.
      var devralinanGovde = devralinanKod ? kodTarihSaatKismiAyikla(devralinanKod) : null;

      function devamEt(govde){
        // GÜVENLİ YAZMA (transaction): iki cihaz neredeyse aynı anda kayıt
        // yaparsa, Firebase güncel veriyle fonksiyonu otomatik tekrar
        // çalıştırır — sessizce birbirini ezme riski yok.
        var db = firebase.database();
        var ref = db.ref("arsiv/" + tip);
        var otomatikRevizeMi = false;
        var kaydedilenKayit = null;
        var mutateHatasi = null;

        ref.transaction(function(currentData){
          try{
            var liste = currentData ? (Array.isArray(currentData) ? currentData.filter(Boolean) : Object.values(currentData)) : [];

            // AYNI GÜN + AYNI MÜŞTERİ + BİREBİR AYNI ÜRÜN SETİ (Berta/Abas) varsa,
            // yeni kayıt açmak yerine mevcut kaydı REVİZE olarak güncelle.
            var eslesenIdx = -1;
            for(var i=0;i<liste.length;i++){
              var aday = liste[i];
              if(!aday || !aday.ts) continue;
              var ayniMusteriMi = musteri.id && aday.musteriId ? (aday.musteriId===musteri.id) : (aday.musteri===musteri.ad);
              if(!ayniMusteriMi) continue;
              if(!ayniGunMu(aday.ts, simdi)) continue;
              if(urunSetiImzaOlustur(aday.urunler) !== yeniImza) continue;
              eslesenIdx = i;
              break;
            }

            if(eslesenIdx >= 0){
              var eskiKayit = liste[eslesenIdx];
              var eskiToplam = (eskiKayit.urunler||[]).reduce(function(s,u){ return s+(u.toplamEuro||0); }, 0);
              if(!eskiKayit.revizeGecmisi) eskiKayit.revizeGecmisi = [];
              eskiKayit.revizeGecmisi.push({ts: eskiKayit.revizeZamani||eskiKayit.ts, toplamEuro:eskiToplam, urunSayisi:(eskiKayit.urunler||[]).length});
              eskiKayit.urunler = urunlerKaydi;
              eskiKayit.revizeZamani = simdi;
              eskiKayit.kur = kur; // her revize, o anki kuru kalıcı olarak günceller
              eskiKayit.kurManuel = !!kurManuelMi;
              eskiKayit.kdv = kdv || 0;
              if(adresler && adresler.faturaAdresi) eskiKayit.faturaAdresi = adresler.faturaAdresi;
              if(adresler && adresler.teslimatAdresi) eskiKayit.teslimatAdresi = adresler.teslimatAdresi;
              if(adresler && adresler.yetkili && adresler.yetkili.isim) eskiKayit.gorunecekYetkililer = [adresler.yetkili.isim];
              if(!eskiKayit.musteriId && musteri.id) eskiKayit.musteriId = musteri.id;
              otomatikRevizeMi = true;
              kaydedilenKayit = eskiKayit;
            } else {
              kaydedilenKayit = {
                tarih: tarihStr(), ts: simdi, kod: kodUret(tip, govde),
                musteri: musteri.ad, musteriId: musteri.id || null, sehir: musteri.sehir || "",
                mod: tip, urunler: urunlerKaydi, kur: kur, kurManuel: !!kurManuelMi, kdv: kdv || 0,
                faturaAdresi: (adresler && adresler.faturaAdresi) || null,
                teslimatAdresi: (adresler && adresler.teslimatAdresi) || null,
                gorunecekYetkililer: (adresler && adresler.yetkili && adresler.yetkili.isim) ? [adresler.yetkili.isim] : null
              };
              if(devralinanKod){
                kaydedilenKayit.oncekiKod = devralinanKod;
                if(devralinanTarih) kaydedilenKayit.oncekiTarih = devralinanTarih;
                // ROTA ZİNCİRİ (13.10.2026) — tüm önceki aşamaların kodu/
                // tarihi, aşama kaydı silinse bile kaybolmasın diye burada
                // kalıcı olarak taşınır (bkz. ReportsData.revizeBaslat).
                if(devralinanRota && devralinanRota.length) kaydedilenKayit.rota = devralinanRota;
              }
              liste.unshift(kaydedilenKayit);
              otomatikRevizeMi = false;
            }

            liste.sort(function(a,b){ return (b.ts||0)-(a.ts||0); });
            return liste;
          }catch(e){
            mutateHatasi = e;
            return; // undefined = transaction'ı iptal et, yarım veri yazılmaz.
          }
        }).then(function(result){
          if(mutateHatasi){ cb(false, mutateHatasi); return; }
          if(!result || !result.committed){
            cb(false, new Error("Kayıt işlenemedi — başka bir cihazdaki değişiklikle çakıştı, lütfen tekrar dene."));
            return;
          }
          cb(true, kaydedilenKayit, otomatikRevizeMi);
        }).catch(function(err){
          console.error("Arşive kaydetme hatası:", err);
          cb(false, err);
        });
      }

      if(devralinanGovde){
        devamEt(devralinanGovde);
      } else {
        // Taze belge — günlük ortak sıra numarasını al, SONRA kaydet.
        gunlukSiraNoAl(function(sira, hataDetay){
          if(sira == null){
            cb(false, new Error("Belge numarası alınamadı (" + (hataDetay || "bilinmeyen sebep") + ") — internet bağlantınızı kontrol edip tekrar deneyin."));
            return;
          }
          devamEt(kodGovdesiOlustur(sira));
        });
      }
    }catch(e){
      console.error("Kaydet hatası:", e);
      cb(false, e);
    }
  }

  function kaynakSil(tip, ts, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      var db = firebase.database();
      var mutateHatasi = null;
      db.ref("arsiv/" + tip).transaction(function(currentData){
        try{
          var liste = currentData ? (Array.isArray(currentData) ? currentData.filter(Boolean) : Object.values(currentData)) : [];
          return liste.filter(function(k){ return k.ts !== ts; });
        }catch(e){ mutateHatasi = e; return; }
      }).then(function(result){
        if(mutateHatasi){ cb(false, mutateHatasi); return; }
        if(!result || !result.committed){ cb(false, new Error("Silme işlemi çakıştı, lütfen tekrar dene.")); return; }
        cb(true);
      }).catch(function(err){
        cb(false, err);
      });
    }catch(e){ cb(false, e); }
  }

  return { baslat: baslat, kaydet: kaydet, kaynakSil: kaynakSil, fiyatGecmisiKontrolEt: fiyatGecmisiKontrolEt };

})();

SendData.baslat();
