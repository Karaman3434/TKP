/*
  reports-data.js — WG.271026.2206.1114
  ===============
  TEK görevi: arşiv kayıtlarını ("arsiv/numune|teklif|proforma|siparis") ve
  görevleri ("gorevler") Firebase'den okumak/yazmak. Eski uygulamayla AYNI
  yollar — ayrı veri girmeye gerek yok.

  27.10.2026 PERFORMANS KAZANIMI: sonIslemler() artık önbellekli — bkz.
  fonksiyonun ve "arsiv" dinleyicisinin yanındaki yorumlar. Dışa açık
  davranış değişmedi.

  29.09.2026 GÜVENLİ YAZMA GÜNCELLEMESİ: Bu dosyadaki "önce once('value') ile
  oku, JS'te değiştir, sonra set() ile TÜM listeyi geri yaz" deseni, iki cihaz
  (veya iki sekme) aynı anda yazarsa birinin yazdığını diğerinin sessizce
  ezmesine (data-loss race condition) açıktı. Artık TÜMÜ Firebase'in
  db.ref(yol).transaction(guncelleyiciFn, sonucFn) API'sini kullanıyor:
  Firebase sunucudan gelen EN TAZE veriyle guncelleyiciFn'i (gerekirse tekrar
  tekrar) çalıştırıp yazmayı GARANTİ EDER — böyle bir çakışma artık mümkün
  değil. Dışa açık fonksiyon imzaları (parametreler, geriBildir(basarili, err)
  çağrı şekli, "Kayıt bulunamadı" hata mesajı) HİÇ DEĞİŞMEDİ — sadece içeride
  daha güvenli yazılıyor.
*/

var ReportsData = (function(){

  var arsiv = {numune:[], teklif:[], proforma:[], siparis:[]};
  var gorevler = [];
  var arsivDinleyicileri = [];
  var gorevDinleyicileri = [];
  // PERFORMANS KAZANIMI (27.10.2026): sonIslemler() ESKİDEN her çağrıda
  // arşivin TÜMÜNÜ (numune+teklif+proforma+siparis) yeniden düzleştirip
  // yeniden sıralıyordu — bu fonksiyon kod genelinde çok sık (bir sayfada
  // onlarca kez) çağrıldığından, veri hacmi büyüdükçe bu YİNELENEN iş
  // sayfa açılışını/geçişlerini gözle görülür şekilde yavaşlatıyordu. Artık
  // sonuç önbelleğe alınıyor; önbellek SADECE "arsiv" Firebase'den
  // gerçekten değiştiğinde (aşağıdaki on("value",...) tetiklendiğinde)
  // geçersiz kılınıyor. Dışa açık davranış (parametre, dönen dizinin
  // içeriği/sırası) HİÇ DEĞİŞMEDİ.
  var sonIslemlerOnbellek = null;

  function baslat(){
    try{
      if(!firebase.apps.length){ firebase.initializeApp(WEICON_FIREBASE_CONFIG); }
      var db = firebase.database();

      db.ref("arsiv").on("value", function(snap){
        var data = snap.val();
        if(data){
          arsiv = data;
          ["numune","teklif","proforma","siparis"].forEach(function(t){
            if(!arsiv[t]) arsiv[t] = [];
            else if(!Array.isArray(arsiv[t])) arsiv[t] = Object.values(arsiv[t]);
          });
        }
        sonIslemlerOnbellek = null;
        arsivDinleyicileri.forEach(function(fn){ fn(); });
      });

      db.ref("gorevler").on("value", function(snap){
        var data = snap.val();
        gorevler = data ? (Array.isArray(data) ? data.filter(Boolean) : Object.values(data)) : [];
        gorevDinleyicileri.forEach(function(fn){ fn(); });
      });
    }catch(e){
      console.error("Firebase başlatma hatası:", e);
    }
  }

  function arsivDegistiginde(fn){ arsivDinleyicileri.push(fn); }
  function gorevDegistiginde(fn){ gorevDinleyicileri.push(fn); }

  function sonIslemler(limit){
    if(!sonIslemlerOnbellek){
      var hepsi = [];
      ["numune","teklif","proforma","siparis"].forEach(function(tip){
        arsiv[tip].forEach(function(k){
          hepsi.push(Object.assign({tip:tip}, k));
        });
      });
      hepsi.sort(function(a,b){ return (b.ts||0)-(a.ts||0); });
      sonIslemlerOnbellek = hepsi;
    }
    return limit ? sonIslemlerOnbellek.slice(0, limit) : sonIslemlerOnbellek;
  }

  function gorevleriGetir(){
    return gorevler.slice().sort(function(a,b){
      if(a.tamamlandi !== b.tamamlandi) return a.tamamlandi ? 1 : -1;
      return (a.olusturmaZamani||0) - (b.olusturmaZamani||0);
    });
  }

  function gorevEkle(musteriAd, aciklama, tarih, saat){
    var eslesenMusteri = (typeof CustomerData !== "undefined") ? CustomerData.musteriBul(musteriAd) : null;
    var yeni = {
      id: "gorev_" + Date.now() + "_" + Math.floor(Math.random()*10000),
      musteriAd: musteriAd, musteriId: eslesenMusteri ? eslesenMusteri.id : null, aciklama: aciklama,
      tarih: tarih, saat: saat,
      tamamlandi: false, tamamlanmaZamani: null,
      olusturmaZamani: Date.now()
    };
    guvenliGorevYaz(function(tazeGorevler){ tazeGorevler.push(yeni); });
  }

  function gorevTamamlandiToggle(id){
    guvenliGorevYaz(function(tazeGorevler){
      var g = tazeGorevler.find(function(x){ return x.id===id; });
      if(!g) return;
      g.tamamlandi = !g.tamamlandi;
      g.tamamlanmaZamani = g.tamamlandi ? Date.now() : null;
    });
  }

  // Görevler için de GÜVENLİ YAZMA DESENİ: transaction() Firebase'den EN
  // TAZE veriyi garanti eder ve değişikliği onun üzerine uygular — iki cihaz
  // aynı anda yazsa bile biri diğerini ezmez (29.09.2026).
  function guvenliGorevYaz(mutateFn){
    try{
      var db = firebase.database();
      db.ref("gorevler").transaction(function(mevcut){
        var tazeGorevler = mevcut ? (Array.isArray(mevcut) ? mevcut.filter(Boolean) : Object.values(mevcut)) : [];
        mutateFn(tazeGorevler);
        return tazeGorevler;
      }, function(err){
        if(err) console.error("Görev kaydetme hatası:", err);
      });
    }catch(e){ console.error("Görev kaydetme hatası:", e); }
  }

  function tumSiparisler(){
    return arsiv.siparis || [];
  }

  // Bir müşterinin bugüne kadar aldığı/teklif aldığı tüm ürünleri, ürün
  // adına göre gruplayıp her ürünün tarih tarih fiyat/iskonto geçmişini
  // döndürür. Müşteri Kartı'ndaki "📦 Ürün Geçmişi" ekranı bunu kullanır.
  //
  // DÜZELTME (12.10.2026, Abdullah'ın fark etmesiyle): eskiden SADECE
  // tumSiparisler() (yani kesinleşmiş SİPARİŞ kayıtları) taranıyordu — bir
  // müşteriye daha önce FİYAT TEKLİFİ/PROFORMA/NUMUNE verilmiş ama henüz
  // siparişe dönüşmemişse, geçmişte hiç görünmüyordu (ve Hızlı Hesapla'daki
  // "geçmiş alım ipucu" da bu yüzden sessizce çıkmıyordu). Artık sonIslemler()
  // ile DÖRT türün (numune/teklif/proforma/siparis) tamamı taranıyor; her
  // kayıt kendi "tip" bilgisini de taşıyor.
  function musteriUrunGecmisi(musteriAd, musteriId){
    var gruplar = {}; // ürün adı -> [{tarih, tip, listeFiyat, iskonto, netFiyat, adet, ts}]
    sonIslemler().forEach(function(k){
      // Sadece isim birebir eşleşmesi YETERSİZ — müşteri ismi sonradan
      // düzenlenmiş (kısaltılmış/uzatılmış) olabilir. Önce Müşteri Kodu
      // (ID) ile, o da yoksa "biri diğerinin içinde geçiyor mu" kontrolüyle.
      var ayniMusteriMi;
      if(musteriId && k.musteriId){
        ayniMusteriMi = k.musteriId === musteriId;
      } else {
        var a = (k.musteri||"").toLocaleLowerCase("tr-TR").trim();
        var b = (musteriAd||"").toLocaleLowerCase("tr-TR").trim();
        ayniMusteriMi = !!a && !!b && (a===b || a.indexOf(b)===0 || b.indexOf(a)===0);
      }
      if(!ayniMusteriMi) return;
      (k.urunler||[]).forEach(function(u){
        var ad = u.ad || "İsimsiz Ürün";
        if(!gruplar[ad]) gruplar[ad] = [];
        gruplar[ad].push({
          tarih: k.tarih, ts: k.ts, tip: k.tip,
          listeFiyat: u.listeFiyat||0, iskonto: u.iskonto||0,
          netFiyat: u.iskBirim!=null?u.iskBirim:(u.listeFiyat||0),
          adet: u.adet||0
        });
      });
    });
    var sonuc = Object.keys(gruplar).map(function(ad){
      var kayitlar = gruplar[ad].sort(function(a,b){ return (b.ts||0)-(a.ts||0); });
      return {ad: ad, kayitlar: kayitlar, sonAlisTs: kayitlar[0].ts};
    });
    sonuc.sort(function(a,b){ return (b.sonAlisTs||0)-(a.sonAlisTs||0); });
    return sonuc;
  }

  // Kod bazlı geçmiş alım araması (15.09.2026) — Hızlı Hesapla'daki "geçmiş
  // alım ipucu" için. musteriUrunGecmisi() ürün ADINA göre gruplandığı için
  // ürün ismi kataloğa göre biraz farklı yazılmışsa (boşluk, küçük bir
  // değişiklik) eşleşme sessizce KAÇIYORDU — kök neden buydu. Bu fonksiyon
  // yerine ürünün KENDİ KODUNU (berta+abas, kayıt anında zaten satır
  // üzerinde saklanıyor) kullanıyor, isim farkından etkilenmiyor.
  function musteriUrunGecmisiKodaGore(musteriAd, musteriId, berta, abas){
    var bertaN = (berta||"").toString().trim().toLocaleLowerCase("tr-TR");
    var abasN = (abas||"").toString().trim().toLocaleLowerCase("tr-TR");
    if(!bertaN && !abasN) return [];
    var kayitlar = [];
    // DÜZELTME (12.10.2026) — bkz. musteriUrunGecmisi() başındaki not: artık
    // sonIslemler() ile dört tür de (numune/teklif/proforma/siparis) taranıyor.
    sonIslemler().forEach(function(k){
      var ayniMusteriMi;
      if(musteriId && k.musteriId){
        ayniMusteriMi = k.musteriId === musteriId;
      } else {
        var a = (k.musteri||"").toLocaleLowerCase("tr-TR").trim();
        var b = (musteriAd||"").toLocaleLowerCase("tr-TR").trim();
        ayniMusteriMi = !!a && !!b && (a===b || a.indexOf(b)===0 || b.indexOf(a)===0);
      }
      if(!ayniMusteriMi) return;
      (k.urunler||[]).forEach(function(u){
        var uBerta = (u.berta||"").toString().trim().toLocaleLowerCase("tr-TR");
        var uAbas = (u.abas||"").toString().trim().toLocaleLowerCase("tr-TR");
        if(uBerta !== bertaN || uAbas !== abasN) return;
        kayitlar.push({
          tarih: k.tarih, ts: k.ts, tip: k.tip,
          listeFiyat: u.listeFiyat||0, iskonto: u.iskonto||0,
          netFiyat: u.iskBirim!=null?u.iskBirim:(u.listeFiyat||0),
          adet: u.adet||0
        });
      });
    });
    kayitlar.sort(function(a,b){ return (b.ts||0)-(a.ts||0); });
    return kayitlar;
  }

  function kaydiKacanIsaretle(tip, ts, sebep, rakip, geriBildir){
    try{
      var db = firebase.database();
      var hataMesaji = null;
      db.ref("arsiv/" + tip).transaction(function(mevcut){
        var liste = mevcut ? (Array.isArray(mevcut) ? mevcut.filter(Boolean) : Object.values(mevcut)) : [];
        var idx = liste.findIndex(function(k){ return k.ts === ts; });
        if(idx === -1){ hataMesaji = "Kayıt bulunamadı"; return; }
        liste[idx].durum = "kacan";
        liste[idx].kacanSebep = sebep || "";
        liste[idx].kacanRakip = rakip || "";
        return liste;
      }, function(err, committed){
        if(err){ geriBildir(false, err); return; }
        if(!committed){ geriBildir(false, hataMesaji || "Kayıt bulunamadı"); return; }
        geriBildir(true);
      });
    }catch(e){ geriBildir(false, e); }
  }

  function kacanOzetBuAy(){
    var aylar = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
    var now = new Date();
    var buAyAd = aylar[now.getMonth()];
    var buYil = now.getFullYear().toString();
    var kacanlar = [];
    var teklifSayisi = 0;
    ["siparis","teklif","proforma","numune"].forEach(function(tip){
      (arsiv[tip]||[]).forEach(function(k){
        if(!k.tarih) return;
        var parca = k.tarih.split(" ");
        if((parca[1]||"")!==buAyAd || (parca[2]||"")!==buYil) return;
        if(tip==="teklif") teklifSayisi++;
        if(k.durum==="kacan"){
          var tutar = (k.urunler||[]).reduce(function(s,u){ return s+(u.toplamEuro||0); }, 0);
          kacanlar.push({tip:tip, kayit:k, tutar:tutar});
        }
      });
    });
    var toplamTutar = kacanlar.reduce(function(s,k){ return s+k.tutar; }, 0);
    return {kacanlar:kacanlar, toplamTutar:toplamTutar, teklifSayisi:teklifSayisi, ayAd:buAyAd, yil:buYil};
  }

  function ayToplami(ayOfset){
    var now = new Date();
    var hedefAy = new Date(now.getFullYear(), now.getMonth()-ayOfset, 1);
    var aylar = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
    var ayAd = aylar[hedefAy.getMonth()];
    var yil = hedefAy.getFullYear().toString();
    var toplam = 0, toplamTl = 0, prim = 0, primTl = 0, sayi = 0;
    tumSiparisler().forEach(function(k){
      if(!k.tarih) return;
      if(k.durum === "beklemede") return; // Beklemede sipariş hiçbir toplama dahil edilmez
      var parca = k.tarih.split(" ");
      if((parca[1]||"")!==ayAd || (parca[2]||"")!==yil) return;
      sayi++;
      var kKuru = k.kur || guncelKurYedek();
      (k.urunler||[]).forEach(function(u){
        toplam += u.toplamEuro||0;
        toplamTl += (u.toplamEuro||0) * kKuru; // satış tutarı işlemin YAPILDIĞI günün kuruyla TL'ye çevrilir
        var mk = (u.iskBirim||0)-(u.dipFiyat||0);
        var satirPrimi = ((u.iskonto||0) > 60) ? 0 : mk*(u.adet||1)*0.22;
        if(satirPrimi>0){
          prim += satirPrimi; // eski uygulamayla aynı: negatif primli satırlar toplama katılmaz
          primTl += satirPrimi * kKuru; // müdür primi işlemin YAPILDIĞI günün kuruyla TL'ye çevrilir
        }
      });
    });
    return {ayAd:ayAd, yil:yil, toplam:toplam, toplamTl:toplamTl, prim:prim, primTl:primTl, sayi:sayi};
  }

  function guncelKurYedek(){
    var v = parseFloat(localStorage.getItem("weicon_kur"));
    return isNaN(v) ? 0 : v;
  }

  // Eski uygulamanın "Aylık Sipariş & Prim Özeti" tablosuyla BİREBİR aynı:
  // son 12 ay, AY|SATIŞ|PRİM|TL PRİM sütunları. TL PRİM artık her işlemin
  // KENDİ kaydettiği kurla hesaplanıyor (bkz. ayToplami) — tüm ayı tek bir
  // güncel kurla çarpmak yerine, merkez ofisin o günkü faturasıyla tutarlı.
  function aylikPrimOzeti12(){
    var sonuc = [];
    for(var i=0;i<12;i++){ sonuc.push(ayToplami(i)); }
    return {aylar: sonuc, kur: guncelKurYedek()};
  }

  function son6Ay(){
    var sonuc = [];
    for(var i=0;i<6;i++){ sonuc.push(ayToplami(i)); }
    return sonuc;
  }

  // Eski uygulamanın bildirimleriHesapla() ile AYNI mantık: her müşterinin
  // en son teklif/proforma/numune kaydı, eğer ondan SONRA bir sipariş
  // gelmemişse "açık süreç" sayılır. 15+ gün ⏳, 30+ gün ⚠️, 33+ gün 🔴.
  // YENİ ÖZELLİK (eski uygulamada yoktu, senin isteğinle eklendi): son 3
  // yılın (bu yıl dahil) toplam satış ve prim özeti.
  function yillikOzet(){
    var simdi = new Date();
    var buYil = simdi.getFullYear();
    var sonuc = [];
    for(var y=0; y<3; y++){
      var hedefYil = (buYil - y).toString();
      var toplam = 0, prim = 0, primTl = 0, sayi = 0;
      tumSiparisler().forEach(function(k){
        if(!k.tarih) return;
        var parca = k.tarih.split(" ");
        if((parca[2]||"") !== hedefYil) return;
        sayi++;
        var kKuru = k.kur || guncelKurYedek();
        (k.urunler||[]).forEach(function(u){
          toplam += u.toplamEuro||0;
          var mk = (u.iskBirim||0)-(u.dipFiyat||0);
          var sp = ((u.iskonto||0) > 60) ? 0 : mk*(u.adet||1)*0.22;
          if(sp>0){ prim += sp; primTl += sp*kKuru; }
        });
      });
      sonuc.push({yil:hedefYil, toplam:toplam, prim:prim, primTl:primTl, sayi:sayi});
    }
    return sonuc;
  }

  // YENİ ÖZELLİK (WG.070926.194): stokta olmadığı için "beklemede"
  // işaretlenmiş siparişler — Bildirimler ekranında hatırlatma göstermek
  // için kaç gündür beklediğini hesaplar. Sipariş oluşturulma tarihinden
  // (k.ts) itibaren sayılır — beklemede işaretlenme anı ayrıca tutulmuyor.
  function beklemedeSiparisleriHesapla(){
    var bugun = Date.now();
    return tumSiparisler().filter(function(k){ return k.durum === "beklemede"; }).map(function(k){
      var tutar = (k.urunler||[]).reduce(function(s,u){ return s+(u.toplamEuro||0); }, 0);
      return {
        musteri:k.musteri, musteriId:k.musteriId||null, sehir:k.sehir||"",
        kod:k.kod, kanal:k.kanal||null, ts:k.ts, tarih:k.tarih,
        gun: Math.floor((bugun-(k.ts||0))/86400000),
        tutar: tutar, beklemedeNot: k.beklemedeNot||""
      };
    }).sort(function(a,b){ return b.gun-a.gun; });
  }

  // BAKİYEDEKİ ÜRÜNLER (07.10.2026, Abdullah'ın isteğiyle) — stokta tam
  // olmayıp müşteride bakiyede bırakılan ürün SATIRLARINI, tüm kayıtlar
  // (tip fark etmeksizin) içinden TEK TEK düz bir listeye çıkarır — bir
  // siparişte birden fazla bakiyeli ürün varsa, her biri AYRI bir satır
  // olur. Her satır kendi siparişini (tip+ts) taşır — "Bakiyedeki
  // Ürünler" ekranında bir satıra dokununca o siparişin TAM tablosu
  // açılabilsin diye (bkz. bakiye-urunler-render.js).
  // adet (21.10.2026, Abdullah'ın isteğiyle, SALT EKLENTİ): u.adet'in
  // kopyası — tüketici ekran bununla "tamamen yok" (adet<=0) ile "kısmi
  // bakiye" (adet>0) ayrımını kendi başına türetebilsin diye. Mevcut
  // alanların hiçbiri değişmedi, sadece bu alan eklendi.
  function bakiyedekiUrunler(){
    var satirlar = [];
    sonIslemler().forEach(function(k){
      (k.urunler||[]).forEach(function(u){
        if(!(u.bakiyeAdet>0)) return;
        satirlar.push({
          tip:k.tip, ts:k.ts, kod:k.kod, tarih:k.tarih||"",
          musteri:k.musteri, musteriId:k.musteriId||null, sehir:k.sehir||"",
          urunAd:u.ad||"İsimsiz Ürün", bakiyeAdet:u.bakiyeAdet, bakiyeNot:u.bakiyeNot||"",
          adet:u.adet||0
        });
      });
    });
    satirlar.sort(function(a,b){ return (b.ts||0)-(a.ts||0); });
    return satirlar;
  }

  // Bu müşteride, henüz siparişe (veya sonraki aşamaya) dönüşmemiş en son
  // teklif/proforma/numune kaydını döndürür (yoksa null). Ürün eşleştirmesi
  // YAPMAZ — sadece "bu müşteride açık bir şey var mı" sorusuna cevap verir
  // (22.09.2026, "Açık Teklif Uyarısı" özelliği).
  function musterininAcikBelgesi(musteriAdi){
    var anahtar = (musteriAdi||"").toLocaleLowerCase("tr-TR").trim();
    if(!anahtar) return null;
    var tumu = sonIslemler();
    var bekleyenTipler = ["teklif","proforma","numune"];
    var adaylar = tumu.filter(function(k){
      return bekleyenTipler.indexOf(k.tip)>=0 && (k.musteri||"").toLocaleLowerCase("tr-TR").trim()===anahtar;
    });
    if(!adaylar.length) return null;
    adaylar.sort(function(a,b){ return (b.ts||0)-(a.ts||0); });
    var enYeni = adaylar[0];
    var sonrasindaSiparisVar = tumu.some(function(s){
      return s.tip==="siparis" && (s.musteri||"").toLocaleLowerCase("tr-TR").trim()===anahtar && (s.ts||0) > (enYeni.ts||0);
    });
    if(sonrasindaSiparisVar) return null;
    var tutar = (enYeni.urunler||[]).reduce(function(s,u){ return s+(u.toplamEuro||0); }, 0);
    return {tip:enYeni.tip, ts:enYeni.ts, kod:enYeni.kod, tarih:enYeni.tarih||"", tutar:tutar};
  }

  function acikSurecleriHesapla(){
    var tumu = sonIslemler();
    var siparisler = tumu.filter(function(k){ return k.tip==="siparis"; });
    var bekleyenTipler = ["teklif","proforma","numune"];
    var musteriMap = {};

    tumu.filter(function(k){ return bekleyenTipler.indexOf(k.tip)>=0; }).forEach(function(k){
      var anahtar = (k.musteri||"").toLocaleLowerCase("tr-TR");
      if(!musteriMap[anahtar] || (k.ts||0) > musteriMap[anahtar].ts){
        musteriMap[anahtar] = k;
      }
    });

    var bugun = Date.now();
    var sonuc = [];
    Object.keys(musteriMap).forEach(function(anahtar){
      var k = musteriMap[anahtar];
      var sonrasindaSiparisVar = siparisler.some(function(s){
        return (s.musteri||"").toLocaleLowerCase("tr-TR")===anahtar && (s.ts||0) > (k.ts||0);
      });
      if(sonrasindaSiparisVar) return;
      var gun = Math.floor((bugun-(k.ts||0))/86400000);
      if(gun < 15) return;
      var seviye = gun>=33 ? "kritik" : (gun>=30 ? "ikinci" : "ilk");
      var tutar = (k.urunler||[]).reduce(function(s,u){ return s+(u.toplamEuro||0); }, 0);
      sonuc.push({musteri:k.musteri, musteriId:k.musteriId||null, sehir:k.sehir||"", tip:k.tip, kod:k.kod, kanal:k.kanal||null, ts:k.ts, tarih:k.tarih, gun:gun, seviye:seviye, urunSayisi:(k.urunler||[]).length, tutar:tutar});
    });
    sonuc.sort(function(a,b){ return b.gun-a.gun; });
    return sonuc;
  }

  function enCokSatisYapilanMusteriler(limit){
    var haritalar = {};
    tumSiparisler().forEach(function(k){
      var ad = k.musteri || "Bilinmeyen";
      if(!haritalar[ad]) haritalar[ad] = 0;
      (k.urunler||[]).forEach(function(u){ haritalar[ad] += u.toplamEuro||0; });
    });
    return Object.keys(haritalar)
      .map(function(ad){ return {ad:ad, toplam:haritalar[ad]}; })
      .sort(function(a,b){ return b.toplam-a.toplam; })
      .slice(0, limit||5);
  }

  function kaydiSil(tip, ts, geriBildir){
    try{
      var db = firebase.database();
      db.ref("arsiv/" + tip).transaction(function(mevcut){
        var liste = mevcut ? (Array.isArray(mevcut) ? mevcut.filter(Boolean) : Object.values(mevcut)) : [];
        return liste.filter(function(k){ return k.ts !== ts; });
      }, function(err){
        if(err){ geriBildir(false, err); return; }
        geriBildir(true);
      });
    }catch(e){ geriBildir(false, e); }
  }

  // Müşteri Birleştirme'nin devamı: CustomerData.musterileriBirlestir()
  // müşteri kaydını taşıdıktan sonra çağrılır — arşivdeki (sipariş/teklif/
  // proforma/numune) kayıtları ve görevleri "diger"den "ana"ya taşır.
  // Her koleksiyon kendi taze-oku-sonra-yaz adımıyla, sırayla işlenir.
  function kayitlariBirlestir(digerAd, digerId, anaAd, anaId, geriBildir){
    var db = firebase.database();
    var tipler = ["siparis","teklif","proforma","numune"];
    var i = 0;

    function sonrakiTipeGec(){
      if(i >= tipler.length){ gorevleriTasi(); return; }
      var tip = tipler[i]; i++;
      db.ref("arsiv/" + tip).transaction(function(mevcut){
        var liste = mevcut ? (Array.isArray(mevcut) ? mevcut.filter(Boolean) : Object.values(mevcut)) : [];
        var degistiMi = false;
        liste.forEach(function(k){
          var buNaAitMi = (digerId && k.musteriId) ? (k.musteriId===digerId) : (k.musteri===digerAd);
          if(buNaAitMi){ k.musteri = anaAd; k.musteriId = anaId; degistiMi = true; }
        });
        if(!degistiMi) return; // değişiklik yok — yazma iptal
        return liste;
      }, function(err){
        if(err){ geriBildir(false, err); return; }
        sonrakiTipeGec();
      });
    }

    function gorevleriTasi(){
      db.ref("gorevler").transaction(function(mevcut){
        var liste = mevcut ? (Array.isArray(mevcut) ? mevcut.filter(Boolean) : Object.values(mevcut)) : [];
        var degistiMi = false;
        liste.forEach(function(g){ if(g.musteriAd===digerAd){ g.musteriAd=anaAd; degistiMi=true; } });
        if(!degistiMi) return; // değişiklik yok — yazma iptal
        return liste;
      }, function(err){
        if(err){ geriBildir(false, err); return; }
        geriBildir(true);
      });
    }

    sonrakiTipeGec();
  }

  function kaydiGuncelle(tip, ts, yeniUrunler, geriBildir){
    try{
      var db = firebase.database();
      var hataMesaji = null;
      db.ref("arsiv/" + tip).transaction(function(mevcut){
        var liste = mevcut ? (Array.isArray(mevcut) ? mevcut.filter(Boolean) : Object.values(mevcut)) : [];
        var idx = liste.findIndex(function(k){ return k.ts === ts; });
        if(idx === -1){ hataMesaji = "Kayıt bulunamadı"; return; }
        liste[idx].urunler = yeniUrunler;
        liste[idx].revizeZamani = Date.now();
        return liste;
      }, function(err, committed){
        if(err){ geriBildir(false, err); return; }
        if(!committed){ geriBildir(false, hataMesaji || "Kayıt bulunamadı"); return; }
        geriBildir(true);
      });
    }catch(e){ geriBildir(false, e); }
  }

  // Ürün dışında, bu KAYDA özel herhangi bir alanı (fatura/teslimat adresi,
  // görünecek yetkili, dahili not, vb.) günceller — "Düzenle" menüsündeki
  // ürün-dışı seçenekler bunu kullanır. alanlar = {alanAdi: yeniDeger, ...}.
  function kaydiAlanGuncelle(tip, ts, alanlar, geriBildir){
    try{
      var db = firebase.database();
      var hataMesaji = null;
      db.ref("arsiv/" + tip).transaction(function(mevcut){
        var liste = mevcut ? (Array.isArray(mevcut) ? mevcut.filter(Boolean) : Object.values(mevcut)) : [];
        var idx = liste.findIndex(function(k){ return k.ts === ts; });
        if(idx === -1){ hataMesaji = "Kayıt bulunamadı"; return; }
        for(var alan in alanlar){
          if(alanlar.hasOwnProperty(alan)) liste[idx][alan] = alanlar[alan];
        }
        return liste;
      }, function(err, committed){
        if(err){ geriBildir(false, err); return; }
        if(!committed){ geriBildir(false, hataMesaji || "Kayıt bulunamadı"); return; }
        geriBildir(true);
      });
    }catch(e){ geriBildir(false, e); }
  }

  // Revize/İlerletme mekanizması: Numune → Teklif veya Proforma;
  // Teklif → Proforma veya Sipariş; Proforma → sadece Sipariş (tek seçenek,
  // soru sorulmadan otomatik ilerler). Sipariş'ten sonrası yok (nihai aşama).
  // SIRALAMA (18.10.2026, Abdullah'ın isteğiyle): İlerlet popup'ındaki
  // seçenekler artık KRONOLOJİK sırayla listeleniyor (Numune → Teklif →
  // Proforma → Sipariş) — numune'nin seçenekleri "proforma, teklif"
  // yerine "teklif, proforma" oldu.
  var SONRAKI_ASAMALAR = {
    numune: ["teklif","proforma"],
    teklif: ["proforma","siparis"],
    proforma: ["siparis"]
  };

  // Bir kaydı (numune/teklif/proforma) düzenlenebilir Sepet'e yükler.
  // secenekler.length===1 ise otomatik o aşamaya, >1 ise send.html'de
  // Gönder anında Proforma/Sipariş (veya Proforma/Teklif) seçim popup'ı
  // çıkar. Kayıt başarıyla kaydedilince eski kayıt otomatik silinir.
  // hedefTip: opsiyonel — çağıran taraf (İşlemler > İlerlet popup'ı) zaten
  // hangi aşamaya geçileceğini sorup seçtirdiyse doğrudan o tip verilir,
  // Gönder aşamasında tekrar sorulmaz (07.09.2026).
  function revizeBaslat(kayit, hedefTip){
    var secenekler = SONRAKI_ASAMALAR[kayit.tip];
    if(!secenekler){ return false; }
    // Eski kayıtta Dip Fiyat 0/boş kalmışsa (geçmiş bir hata nedeniyle),
    // sessizce 0 olarak taşımak yerine — %36,35 kuralıyla öner AMA
    // "hesaplandı" sayma; kullanıcı Sepet'te bu ürüne dokunup Hesapla
    // ekranında gözden geçirip onaylamadan Kaydet/Gönder'e giremesin.
    var DIP_ORANI = 0.3635;
    var sepet = (kayit.urunler||[]).map(function(u, i){
      var dipEksikMi = !u.dipFiyat;
      var dipFiyat = dipEksikMi ? Math.round((u.listeFiyat||0)*DIP_ORANI*100)/100 : u.dipFiyat;
      return {
        idx:i, ad: u.ad || "İsimsiz Ürün", berta: u.berta||"", abas: u.abas||"",
        listeFiyat: u.listeFiyat||0, dipFiyat: dipFiyat, iskonto: u.iskonto||0, adet: u.adet||0,
        hesaplandi: !dipEksikMi
      };
    });
    localStorage.setItem("weiconv2_sepet", JSON.stringify(sepet));
    localStorage.setItem("weicon_secili_musteri", JSON.stringify({ad:kayit.musteri, sehir:kayit.sehir||"", id:kayit.musteriId||null}));
    // ROTA ZİNCİRİ (13.10.2026, Abdullah'ın isteğiyle): İlerletme sırasında
    // SADECE bir önceki aşama (oncekiKod/oncekiTarih) değil, kaydın o ana
    // kadarki TÜM rotası (numune->teklif->proforma->...) taşınır. kayit.rota
    // zaten varsa (bu kayıt daha önce başka bir aşamadan ilerletilmişse) o
    // listenin SONUNA şimdiki aşama eklenir — eski aşama kaydı silindiğinde
    // (bkz. kaynakSil) tüm geçmiş tarihleri kaybolmasın diye.
    var rotaSonrakineTasinacak = (kayit.rota || []).concat([{tip:kayit.tip, kod:kayit.kod||null, tarih:kayit.tarih||null}]);
    localStorage.setItem("weiconv2_ilerlet_kaynak", JSON.stringify({tip:kayit.tip, ts:kayit.ts, kod:kayit.kod||null, tarih:kayit.tarih||null, rota:rotaSonrakineTasinacak, sonrakiAsamaSecenekleri:secenekler}));
    if(hedefTip && secenekler.indexOf(hedefTip) !== -1){
      localStorage.setItem("weiconv2_onceden_secilen_tip", hedefTip);
    } else if(secenekler.length === 1){
      localStorage.setItem("weiconv2_onceden_secilen_tip", secenekler[0]);
    } else {
      localStorage.removeItem("weiconv2_onceden_secilen_tip");
    }
    // MÜŞTERİ SIZINTISI DÜZELTMESİ (27.10.2026) — bkz. cart-render.js
    // sepetMusteriBaglantisiniDogrula: bu bayrak olmadan cart.html, burada
    // yazılan müşteriyi yine gösterir (kritik işlem akışı için gerekli),
    // ama ayrıca ileride ayrı/ilgisiz bir Ürün Bul girişinde sızmayı
    // önlemek için bayrak her zaman birlikte set edilir.
    localStorage.setItem("weiconv2_sepet_musteri_baglantisi", "1");
    window.location.href = "cart.html";
    return true;
  }

  // "Tekrarla" — revizeBaslat'tan FARKLI: aşamayı İLERLETMEZ, aynı türde
  // (sipariş→sipariş) bağımsız YENİ bir kayıt açar. weiconv2_ilerlet_kaynak
  // BİLEREK ayarlanmaz — bu yüzden Sepet'e kaydedince eski kayıt SİLİNMEZ,
  // ikisi de arşivde ayrı ayrı durur. (Not: aynı gün + aynı müşteri + birebir
  // aynı ürün seti ile tekrar kaydedilirse, SendData.kaydet'in kendi
  // "aynı gün eşleşmesi revize eder" kuralı devreye girip yeni kayıt yerine
  // mevcut kaydı günceller — bu, aynı kaydı yanlışlıkla çift kez kaydetmeyi
  // önlemek için app genelinde zaten var olan bir kural.)
  function tekrarBaslat(kayit){
    var DIP_ORANI = 0.3635;
    var sepet = (kayit.urunler||[]).map(function(u, i){
      var dipEksikMi = !u.dipFiyat;
      var dipFiyat = dipEksikMi ? Math.round((u.listeFiyat||0)*DIP_ORANI*100)/100 : u.dipFiyat;
      return {
        idx:i, ad: u.ad || "İsimsiz Ürün", berta: u.berta||"", abas: u.abas||"",
        listeFiyat: u.listeFiyat||0, dipFiyat: dipFiyat, iskonto: u.iskonto||0, adet: u.adet||0,
        hesaplandi: !dipEksikMi
      };
    });
    localStorage.setItem("weiconv2_sepet", JSON.stringify(sepet));
    localStorage.setItem("weicon_secili_musteri", JSON.stringify({ad:kayit.musteri, sehir:kayit.sehir||"", id:kayit.musteriId||null}));
    localStorage.removeItem("weiconv2_ilerlet_kaynak");
    localStorage.setItem("weiconv2_onceden_secilen_tip", kayit.tip);
    // MÜŞTERİ SIZINTISI DÜZELTMESİ (27.10.2026) — bkz. revizeBaslat'taki
    // aynı yorum / cart-render.js sepetMusteriBaglantisiniDogrula.
    localStorage.setItem("weiconv2_sepet_musteri_baglantisi", "1");
    window.location.href = "cart.html";
    return true;
  }

  // "Bugünün Satışları" / "Bu Ayın Satışları" ekranları için — sadece
  // SİPARİŞ (gerçekleşmiş satış) kayıtlarını, seçilen kapsama göre
  // filtreleyip en yeniden en eskiye sıralar.
  // "tumu" (21.10.2026, Abdullah'ın isteğiyle — Tarih Filtresi): sınır
  // YOK, tüm zamanlar döner. satis-listesi-render.js artık HER ZAMAN
  // "tumu" ile çekip asıl daraltmayı kendi TarihFiltre bileşeniyle
  // (varsayılanı ?kapsam=bugun/ay'dan gelir) istemci tarafında yapıyor —
  // "bugun"/"ay" değerleri geriye dönük uyumluluk için hâlâ destekleniyor.
  function satislarListele(kapsam){
    var simdi = new Date();
    var gunBasiTs = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate()).getTime();
    var ayBasiTs = new Date(simdi.getFullYear(), simdi.getMonth(), 1).getTime();
    var esikTs = kapsam === "bugun" ? gunBasiTs : (kapsam === "tumu" ? 0 : ayBasiTs);
    return tumSiparisler()
      .filter(function(k){ return (k.ts||0) >= esikTs; })
      .map(function(k){
        var toplam = (k.urunler||[]).reduce(function(s,u){
          var satirToplam = u.toplamEuro !== undefined ? u.toplamEuro : ((u.iskBirim||0)*(u.adet||0));
          return s + satirToplam;
        }, 0);
        var bakiyeVarMi = (k.urunler||[]).some(function(u){ return (u.bakiyeAdet||0)>0; });
        return {tip:"siparis", ts:k.ts, kod:k.kod, tarih:k.tarih||"", musteri:k.musteri, musteriId:k.musteriId||null, sehir:k.sehir||"", toplam:toplam, kanal:k.kanal||null, durum:k.durum, revizeZamani:k.revizeZamani, bakiyeVarMi:bakiyeVarMi};
      })
      .sort(function(a,b){ return (b.ts||0)-(a.ts||0); });
  }

  // "Kaçan Satışlar" ekranı için — ay sınırı OLMADAN, tüm zamanlardaki
  // kaçan-işaretli kayıtları en yeniden en eskiye sıralar.
  function tumKacanlar(siralama){
    var kacanlar = [];
    ["siparis","teklif","proforma","numune"].forEach(function(tip){
      (arsiv[tip]||[]).forEach(function(k){
        if(k.durum !== "kacan") return;
        var tutar = (k.urunler||[]).reduce(function(s,u){
          var satirToplam = u.toplamEuro !== undefined ? u.toplamEuro : ((u.iskBirim||0)*(u.adet||0));
          return s + satirToplam;
        }, 0);
        var bakiyeVarMi = (k.urunler||[]).some(function(u){ return (u.bakiyeAdet||0)>0; });
        kacanlar.push({tip:tip, ts:k.ts, kod:k.kod, musteri:k.musteri, musteriId:k.musteriId||null, sehir:k.sehir||"", tarih:k.tarih, tutar:tutar, bakiyeVarMi:bakiyeVarMi});
      });
    });
    kacanlar.sort(function(a,b){ return siralama==="eski" ? (a.ts||0)-(b.ts||0) : (b.ts||0)-(a.ts||0); });
    return kacanlar;
  }

  return {
    baslat: baslat,
    arsivDegistiginde: arsivDegistiginde,
    gorevDegistiginde: gorevDegistiginde,
    sonIslemler: sonIslemler,
    musterininAcikBelgesi: musterininAcikBelgesi,
    tumSiparisler: tumSiparisler,
    gorevleriGetir: gorevleriGetir,
    gorevEkle: gorevEkle,
    gorevTamamlandiToggle: gorevTamamlandiToggle,
    ayToplami: ayToplami,
    son6Ay: son6Ay,
    acikSurecleriHesapla: acikSurecleriHesapla,
    beklemedeSiparisleriHesapla: beklemedeSiparisleriHesapla,
    bakiyedekiUrunler: bakiyedekiUrunler,
    yillikOzet: yillikOzet,
    aylikPrimOzeti12: aylikPrimOzeti12,
    enCokSatisYapilanMusteriler: enCokSatisYapilanMusteriler,
    kaydiKacanIsaretle: kaydiKacanIsaretle,
    kacanOzetBuAy: kacanOzetBuAy,
    satislarListele: satislarListele,
    tumKacanlar: tumKacanlar,
    kaydiSil: kaydiSil,
    kayitlariBirlestir: kayitlariBirlestir,
    musteriUrunGecmisi: musteriUrunGecmisi,
    musteriUrunGecmisiKodaGore: musteriUrunGecmisiKodaGore,
    kaydiGuncelle: kaydiGuncelle,
    kaydiAlanGuncelle: kaydiAlanGuncelle,
    SONRAKI_ASAMALAR: SONRAKI_ASAMALAR,
    revizeBaslat: revizeBaslat,
    tekrarBaslat: tekrarBaslat
  };

})();

ReportsData.baslat();
