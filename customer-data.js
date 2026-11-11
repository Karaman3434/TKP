/*
  customer-data.js — TKP.11.11.26-14:20.1566
  ================
  Müşteri listesini Firebase'in "musteriler" yolundan okur/yazar.

  GÜVENLİ YAZMA DESENİ — ÇOK ÖNEMLİ:
  Eski uygulama, geçmişte TAM olarak bu hataya düşmüştü: cihazın belleğindeki
  (muhtemelen bayat) tüm müşteri dizisini doğrudan Firebase'in üzerine
  yazıyordu. Sayfa yeni açılmışken ya da başka bir cihaz/sekme bir değişiklik
  yaptıysa, bu bayat veri sunucudaki GÜNCEL veriyi SESSİZCE silebiliyordu.
  Bunu tekrarlamamak için: her yazma işleminden HEMEN ÖNCE sunucudan TAZE
  veri okunur, değişiklik SADECE o taze veri üzerine uygulanır, sonra öyle
  yazılır. Yerel önbellek (liste) SADECE okuma/görüntüleme için kullanılır,
  YAZMA için asla doğrudan kullanılmaz.
*/

var CustomerData = (function(){

  var SECILI_MUSTERI_KEY = "weicon_secili_musteri";

  var liste = [];
  var dinleyiciler = [];

  function baslat(){
    try{
      if(!firebase.apps.length){ firebase.initializeApp(ISTAKIP_FIREBASE_CONFIG); }
      var db = firebase.database();
      db.ref("musteriler").on("value", function(snap){
        var data = snap.val();
        liste = data ? (Array.isArray(data) ? data.filter(Boolean) : Object.values(data)) : [];
        // CANLI MÜŞTERİ BİLGİSİ (02.11.2026, Abdullah onayı): müşteri kartında
        // şehir/ilçe değişince, işlem kayıtlarının eski kopyası yerine GÜNCEL
        // değer tüm listelerde görünsün diye ReportsData bilgilendirilir
        // (sadece şehir gerçekten değiştiyse listeleri yeniden çizdirir).
        try{ if(typeof ReportsData !== "undefined" && ReportsData.musteriBilgisiDegisti) ReportsData.musteriBilgisiDegisti(); }catch(e){}
        dinleyiciler.forEach(function(fn){ fn(); });
        try{ kodsuzMusterilereKodAta(); }catch(e){}
      }, function(err){
        console.error("Müşteri okuma hatası:", err);
      });
    }catch(e){
      console.error("Firebase başlatma hatası:", e);
    }
  }

  // KODSUZ MÜŞTERİLERE KOD ATA (10.11.2026, Abdullah isteği — "bazı müşterilerde kod var,
  // bazılarında yok"): müşteri kodu (id) HİÇ olmayan eski kayıtlara, mevcut en büyük
  // M-XXXX'in devamından sıralı kod verilir. SADECE kodu boş olanlara dokunur; mevcut
  // kodlar (formatı ne olursa olsun) ASLA değiştirilmez. Güvenli yazma (transaction)
  // ile yapılır — iki cihaz aynı anda denerse ikincisi güncel veriyi görüp bir şey yapmaz.
  // Sayfa açılışı başına en fazla 1 deneme.
  var kodAtamaDenendi = false;
  function kodsuzMusterilereKodAta(){
    if(kodAtamaDenendi) return;
    if(!liste.some(function(m){ return m && !m.id; })) return;
    kodAtamaDenendi = true;
    guvenliYaz(function(tazeListe){
      var eksikler = tazeListe.filter(function(m){ return m && !m.id; });
      if(!eksikler.length) throw new Error("Kod atanacak müşteri kalmadı.");
      eksikler.forEach(function(m){ m.id = musteriIdUret(tazeListe, ""); });
      return tazeListe;
    }, function(ok, sonuc){
      if(ok) console.info("Kodsuz müşterilere kod atandı.");
    });
  }

  function listeDegistiginde(fn){ dinleyiciler.push(fn); }

  function ara(sorgu){
    var q = (sorgu||"").trim().toLocaleLowerCase("tr-TR");
    if(!q) return liste;
    return liste.filter(function(m){
      var ad = (m.ad||"").toLocaleLowerCase("tr-TR");
      var sehir = (m.sehir||"").toLocaleLowerCase("tr-TR");
      return ad.indexOf(q)>=0 || sehir.indexOf(q)>=0;
    });
  }

  function sec(musteri){
    try{ localStorage.setItem(SECILI_MUSTERI_KEY, JSON.stringify(musteri)); }catch(e){}
    // 10 DK OTO-SİL SAYACI (03.11.2026): sepet boşken yeni müşteri seçmek
    // YENİ bir işlemin başlangıcıdır — süre baştan başlar (bkz. cart-data.js
    // suresiDoldumu). Sepet doluysa mevcut işlemin damgası korunur.
    try{
      var sp = JSON.parse(localStorage.getItem("weiconv2_sepet") || "[]");
      if(!sp || sp.length === 0) localStorage.setItem("weiconv2_sepet_baslangic_zamani", String(Date.now()));
    }catch(e){}
  }

  function secimiKaldir(){
    try{ localStorage.removeItem(SECILI_MUSTERI_KEY); }catch(e){}
    // İŞLEM İÇİN SEÇİM (WG.090926.196): müşteri seçimi kalkınca, o
    // müşteri için işaretlenmiş fatura/teslimat/yetkili seçimi de bir
    // sonraki (farklı) müşteriye sızmasın diye temizlenir.
    try{ localStorage.removeItem("weiconv2_secili_iletisim"); }catch(e){}
  }

  function seciliyiOku(){
    try{
      var v = localStorage.getItem(SECILI_MUSTERI_KEY);
      return v ? JSON.parse(v) : null;
    }catch(e){ return null; }
  }

  function musteriBul(ad){
    return liste.find(function(m){ return (m.ad||"").toLocaleLowerCase("tr-TR")===(ad||"").toLocaleLowerCase("tr-TR"); }) || null;
  }
  // Kalıcı ID ile arama — isim değişse/yazım farklı olsa bile doğru
  // müşteriyi bulur. musteriId kayıtlı olan her yerde isim aramasından
  // ÖNCELİKLİ kullanılmalı (06.09.2026, ID standardizasyonu).
  // CANLI ŞEHİR/İLÇE (02.11.2026, Abdullah onayı): işlem kayıtları (sipariş,
  // teklif...) oluşturuldukları andaki şehir metnini KOPYA olarak saklar;
  // müşteri kartında şehir düzeltilince o kopya eski kalıyordu. Artık
  // listeler/ekranlar şehri BURADAN, müşterinin GÜNCEL kaydından alır:
  // önce kalıcı ID ile, yoksa isimle bulur. Müşteri bulunamazsa (veya liste
  // henüz yüklenmediyse) yedek değeri (kayıttaki kopya) döner.
  function sehirBul(musteriId, musteriAd, yedek){
    var m = musteriId ? liste.find(function(x){ return x.id === musteriId; }) : null;
    if(!m && musteriAd) m = musteriBul(musteriAd);
    return m ? konumMetni(m) : (yedek === undefined ? null : yedek);
  }

  // KONUM METNİ = "İlçe / İL" (03.11.2026, Abdullah'ın isteğiyle): müşteri
  // adının yanında/altında görünen konum, cari kartta girilen ŞEHİR (İLÇE)
  // ile seçilen İL'in birleşimi: "Etimesgut / ANKARA". TEK KAYNAK — müşteri
  // şeridi (musteri-serit.js), müşteri listeleri ve işlem listeleri (canlı
  // şehir, bkz. sehirBul/reports-data.js) hep bunu kullanır. İl nesnede
  // yoksa (eski/kısa kayıt) müşteri ID'siyle güncel listeden alınır; ilçe
  // metni zaten ili içeriyorsa tekrarlanmaz; sadece biri varsa o gösterilir.
  function konumMetni(m){
    if(!m) return "";
    var sehir = String(m.sehir || "").trim();
    var il = String(m.il || "").trim();
    if(!il && m.id){
      var g = liste.find(function(x){ return x.id === m.id; });
      if(g && g.il) il = String(g.il).trim();
    }
    if(!il) return sehir;
    if(!sehir) return il;
    if(sehir.toLocaleLowerCase("tr-TR").indexOf(il.toLocaleLowerCase("tr-TR")) !== -1) return sehir;
    return sehir + " / " + il;
  }
  function musteriIdIleBul(id){
    if(!id) return null;
    return liste.find(function(m){ return m.id === id; }) || null;
  }

  // ---- GÜVENLİ YAZMA ÇEKİRDEĞİ (Firebase transaction) ----
  // Önceki "oku→yaz→doğrula" yöntemi, İKİ CİHAZ NEREDEYSE AYNI ANDA yazarsa
  // (ikisi de aynı "taze" veriyi okuyup, ikisi de kendi değişikliğini
  // uygulayıp SIRAYLA yazarsa) ikincinin birinciyi SESSİZCE ezmesine açıktı
  // — çünkü doğrulama adımı sadece "benim yazdığım veri sunucuda mı"
  // diye bakıyordu, "benimle aynı anda başka biri de yazdı mı" diye değil.
  // Firebase'in gerçek transaction() API'si bunu ATOMIK olarak çözer: eğer
  // veritabanı transaction fonksiyonunu çalıştırdığımız andan yazma anına
  // kadar başka biri değiştirdiyse, fonksiyon GÜNCEL veriyle OTOMATİK
  // TEKRAR çalıştırılır — hiçbir değişiklik sessizce kaybolmaz.
  function guvenliYaz(mutateFn, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    if(typeof mutateFn !== "function"){ cb(false, new Error("Geçersiz müşteri güncelleme işlemi.")); return; }
    try{
      var db = firebase.database();
      var ref = db.ref("musteriler");
      var mutateHatasi = null;
      ref.transaction(function(currentData){
        var tazeListe = currentData ? (Array.isArray(currentData) ? currentData.filter(Boolean) : Object.values(currentData)) : [];
        try{
          var sonuc = mutateFn(tazeListe);
          return (sonuc !== undefined) ? sonuc : tazeListe;
        }catch(e){
          mutateHatasi = e;
          return; // undefined dönmek transaction'ı İPTAL eder — yarım/hatalı veri asla yazılmaz.
        }
      }).then(function(result){
        if(mutateHatasi){
          console.error("Müşteri güncelleme hatası:", mutateHatasi);
          cb(false, mutateHatasi);
          return;
        }
        if(!result || !result.committed){
          cb(false, new Error("Kayıt güncellenemedi — başka bir cihazdaki değişiklikle çakıştı, lütfen tekrar dene."));
          return;
        }
        var data = result.snapshot.val();
        var kaydedilenListe = data ? (Array.isArray(data) ? data.filter(Boolean) : Object.values(data)) : [];
        cb(true, kaydedilenListe);
      }).catch(function(err){
        console.error("Müşteri yazma hatası:", err);
        cb(false, err);
      });
    }catch(e){ cb(false, e); }
  }

  // musteriId verilmişse ÖNCE sabit koduyla (örn. M00008) arar — bu asla
  // değişmez. Sadece id yokken (eski çağrılar / id'siz eski kayıtlar) isme
  // göre arar. Bu sayede müşteri adı o an sayfada güncel değilse (yeniden
  // adlandırma, senkron gecikmesi vb.) kayıt "bulunamadı" diye kaybolmaz.
  // GÜVENLİK KONTROLÜ (WG.080926.196): eğer aynı kod (id) birden fazla
  // müşteride kayıtlıysa, ilk bulunanı sessizce güncellemek YANLIŞ
  // müşteriyi değiştirebilir — bunun yerine açık bir hata fırlatılır.
  function musteriIndexBul(tazeListe, musteriAd, musteriId){
    if(musteriId){
      var eslesenler = [];
      tazeListe.forEach(function(m, i){ if(m.id === musteriId) eslesenler.push(i); });
      if(eslesenler.length > 1){
        throw new Error("'" + musteriId + "' kodu " + eslesenler.length + " farklı müşteride kayıtlı — hangisinin güncelleneceği belirsiz. Lütfen müşteri kodlarını kontrol edin.");
      }
      if(eslesenler.length === 1) return eslesenler[0];
    }
    return tazeListe.findIndex(function(m){ return (m.ad||"").toLocaleLowerCase("tr-TR")===(musteriAd||"").toLocaleLowerCase("tr-TR"); });
  }

  function gunFarkiHesapla(ts){
    return Math.floor((Date.now() - ts) / 86400000);
  }

  function ziyaretHatirlatmalari(){
    var sonuc = [];
    liste.forEach(function(m){
      var gecmis = m.ziyaretGecmisi || [];
      var enSonTs = gecmis.length ? Math.max.apply(null, gecmis.map(function(z){ return z.ts||0; })) : null;
      var gun = enSonTs ? gunFarkiHesapla(enSonTs) : null;
      sonuc.push({musteri:m.ad, musteriId:m.id||null, sehir:m.sehir||"", gun:gun, hicZiyaretYok: gecmis.length===0});
    });
    sonuc.sort(function(a,b){
      if(a.hicZiyaretYok !== b.hicZiyaretYok) return a.hicZiyaretYok ? -1 : 1;
      return (b.gun||0)-(a.gun||0);
    });
    return sonuc;
  }

  function ziyaretEkle(musteriAd, not, tur, hatirlatmaTarihi, geriBildir, musteriId, ekAlan){
    // Geriye uyumluluk: eski çağrılar ziyaretEkle(ad, not, geriBildir) şeklindeydi.
    if(typeof tur === "function"){ geriBildir = tur; tur = "ziyaret"; hatirlatmaTarihi = null; }
    guvenliYaz(function(tazeListe){
      var idx = musteriIndexBul(tazeListe, musteriAd, musteriId);
      if(idx===-1) throw new Error("Müşteri bulunamadı");
      if(!tazeListe[idx].ziyaretGecmisi) tazeListe[idx].ziyaretGecmisi = [];
      var kayit = {ts:Date.now(), not: not || "", tur: tur || "ziyaret"};
      if(hatirlatmaTarihi) kayit.hatirlatmaTarihi = hatirlatmaTarihi;
      // 10.11.2026 (Abdullah onayı — Vade Takip): ekAlan.odeme === true → bu temas bir ÖDEME PLANI notudur (Vade Takip / Cari Bilgi ÖDEME VADE penceresi).
      if(ekAlan && ekAlan.odeme) kayit.odeme = true;
      // 10.11.2026 (Abdullah isteği — Fatura ve Ödeme Takip): bu temas BELİRLİ BİR FATURAYA yazılmış açıklamadır (faturaTs = sipariş kaydının ts'i, faturaKod = belge kodu).
      if(ekAlan && ekAlan.faturaTs){ kayit.faturaTs = ekAlan.faturaTs; if(ekAlan.faturaKod) kayit.faturaKod = ekAlan.faturaKod; }
      tazeListe[idx].ziyaretGecmisi.push(kayit);
      tazeListe[idx].ziyaretGecmisi.sort(function(a,b){ return (b.ts||0)-(a.ts||0); });
      tazeListe[idx].sonZiyaret = tazeListe[idx].ziyaretGecmisi[0].ts;
      tazeListe[idx].sonZiyaretNot = tazeListe[idx].ziyaretGecmisi[0].not;
    }, geriBildir);
  }

  // Bir temas kaydını (Ziyaret/Telefon/Mail/WhatsApp Msj) kalıcı siler.
  // ts (kayıt anındaki Date.now() değeri) ile eşleştirir — dizi indeksi
  // yerine bunu kullanmak, transaction sunucudan taze veriyle tekrar
  // çalışsa bile yanlış kaydı silme riskini ortadan kaldırır. Silinince
  // aynı Firebase verisini okuyan Takvim (ziyaret.html) ve Cari Kart'taki
  // Temas sayacı da OTOMATİK güncellenir — ayrı bir "her yerden sil"
  // adımına gerek yok (30.09.2026, Abdullah'ın isteğiyle eklendi).
  function ziyaretSil(musteriAd, ts, geriBildir, musteriId){
    guvenliYaz(function(tazeListe){
      var idx = musteriIndexBul(tazeListe, musteriAd, musteriId);
      if(idx===-1) throw new Error("Müşteri bulunamadı");
      var gecmis = tazeListe[idx].ziyaretGecmisi || [];
      var yeniGecmis = gecmis.filter(function(z){ return z.ts !== ts; });
      if(yeniGecmis.length === gecmis.length) throw new Error("Temas kaydı bulunamadı");
      tazeListe[idx].ziyaretGecmisi = yeniGecmis;
      tazeListe[idx].sonZiyaret = yeniGecmis.length ? yeniGecmis[0].ts : null;
      tazeListe[idx].sonZiyaretNot = yeniGecmis.length ? yeniGecmis[0].not : null;
    }, geriBildir);
  }

  // Bir temas kaydının açıklamasını (not) düzeltir — ts ile eşleşir (ziyaretSil ile aynı güvenli desen).
  // Takvim, Cari Kart temas listesi ve Ana Sayfa aynı veriyi okuduğu için hepsi otomatik güncellenir.
  // (10.11.2026, Abdullah isteği — fatura açıklamasını "Düzelt")
  function ziyaretNotGuncelle(musteriAd, ts, yeniNot, geriBildir, musteriId){
    guvenliYaz(function(tazeListe){
      var idx = musteriIndexBul(tazeListe, musteriAd, musteriId);
      if(idx===-1) throw new Error("Müşteri bulunamadı");
      var gecmis = tazeListe[idx].ziyaretGecmisi || [];
      var kayit = gecmis.filter(function(z){ return z.ts === ts; })[0];
      if(!kayit) throw new Error("Temas kaydı bulunamadı");
      kayit.not = yeniNot || "";
      if(gecmis[0] && gecmis[0].ts === ts) tazeListe[idx].sonZiyaretNot = kayit.not;
    }, geriBildir);
  }

  // Bir temas kaydının açıklamasını (+ hatırlatma tarihini) günceller (10.11.2026, Abdullah isteği — faturadaki açıklamayı Düzelt).
  // alanlar: {not, hatirlatmaTarihi (boş = tarihsiz), odemeIsaret}. Faturaya bağlı kayıtta "odeme" işareti tarihe göre
  // açılıp kapanır (tarihli = ödeme planı); müşteri geneli eski plan notunda işaret korunur.
  function ziyaretGuncelle(musteriAd, ts, alanlar, geriBildir, musteriId){
    guvenliYaz(function(tazeListe){
      var idx = musteriIndexBul(tazeListe, musteriAd, musteriId);
      if(idx===-1) throw new Error("Müşteri bulunamadı");
      var gecmis = tazeListe[idx].ziyaretGecmisi || [];
      var kayit = gecmis.filter(function(z){ return z.ts === ts; })[0];
      if(!kayit) throw new Error("Temas kaydı bulunamadı");
      kayit.not = alanlar.not || "";
      kayit.guncelTs = Date.now();   // en son düzeltilen kayıt = güncel ödeme planı (vade-takip-data.js planSec)
      if(alanlar.hatirlatmaTarihi) kayit.hatirlatmaTarihi = alanlar.hatirlatmaTarihi; else delete kayit.hatirlatmaTarihi;
      if(kayit.faturaTs){ if(alanlar.odemeIsaret) kayit.odeme = true; else delete kayit.odeme; }
      if(gecmis[0] && gecmis[0].ts === ts) tazeListe[idx].sonZiyaretNot = kayit.not;
    }, geriBildir);
  }

  // Takvim görünümü için: tüm müşterilerin tüm ziyaret/temas kayıtlarını,
  // hangi müşteriye ait olduğu bilgisiyle birlikte tek listede döner.
  function tumZiyaretTemaslar(){
    var sonuc = [];
    liste.forEach(function(m){
      (m.ziyaretGecmisi||[]).forEach(function(z, i){
        sonuc.push({
          musteri: m.ad, musteriId: m.id||null, sehir: m.sehir||"", ts: z.ts, not: z.not||"",
          tur: z.tur||"ziyaret", hatirlatmaTarihi: z.hatirlatmaTarihi||null, odeme: !!z.odeme, faturaTs: z.faturaTs||null, faturaKod: z.faturaKod||"", guncelTs: z.guncelTs||null, kayitIndex: i
        });
      });
    });
    return sonuc;
  }

  // Bugün sabahı hatırlatılması gereken kayıtlar (hatirlatmaTarihi bugüne eşit).
  function hatirlatmalarBugun(){
    var bugun = new Date();
    var bugunStr = bugun.getFullYear() + "-" + String(bugun.getMonth()+1).padStart(2,"0") + "-" + String(bugun.getDate()).padStart(2,"0");
    return tumZiyaretTemaslar().filter(function(z){ return z.hatirlatmaTarihi === bugunStr; });
  }

  // Türkiye il plaka kodları — şehir adından 2 haneli kodu bulmak için.
  // Müşteri kodu formatı: M{ilKodu:2}{sıra:3} — örn. Ankara'da 1. müşteri
  // "M06001", Samsun'da 3. müşteri "M55003". Şehir tanınmazsa "M00xxx" kullanılır.
  // ============================================================
  // KALICI KURAL — DEĞİŞTİRİLEMEZ (05.09.2026, Abdullah'ın talimatı)
  // ============================================================
  // Müşteri kodu formatı İSTİSNASIZ şu şekilde üretilir ve hep böyle
  // kalmalıdır — bu dosyayı başka bir oturumda/araçla güncelleyen biri
  // dahi bu kuralı BOZMAMALIDIR:
  //
  //   M + <il plaka kodu, 2 hane> + <o ile özel sıra no, 4 hane>
  //
  // Örnek: Samsun'da (plaka 55) kayıtlı 84. müşteri  →  M550084
  //
  // - "M" her zaman büyük harf, aralarında BOŞLUK veya TİRE OLMAZ.
  // - İl plaka kodu, müşterinin fatura adresindeki İL ile IL_KODLARI
  //   tablosundan otomatik eşleştirilir (aşağıda, TC'nin resmi 81 il
  //   plaka kodu listesi — 01 Adana'dan 81 Düzce'ye kadar tam liste).
  //   Yeni il eklenmesi gerekmez, liste zaten tam; sadece yazım
  //   varyasyonu (İstanbul/istanbul gibi) eklenebilir.
  // - Sıra numarası HER İL KODU İÇİN AYRI ayrı 0001'den başlar, en
  //   fazla 9999'a kadar gider (4 hane, başına sıfır eklenerek).
  // - Bu kural yalnızca YENİ üretilen kodlar içindir. Sistemde bu
  //   formata uymayan eski/elle girilmiş kodlar (örn. "M-0005") varsa,
  //   bunlar OTOMATİK değiştirilmez — mevcut işlem geçmişiyle bağı
  //   kopmasın diye bu tür bir toplu düzeltme kullanıcıya sorulmadan
  //   ASLA yapılmaz.
  var IL_KODLARI = {
    "adana":"01","adıyaman":"02","afyonkarahisar":"03","afyon":"03","ağrı":"04","amasya":"05",
    "ankara":"06","antalya":"07","artvin":"08","aydın":"09","balıkesir":"10","bilecik":"11",
    "bingöl":"12","bitlis":"13","bolu":"14","burdur":"15","bursa":"16","çanakkale":"17",
    "çankırı":"18","çorum":"19","denizli":"20","diyarbakır":"21","edirne":"22","elazığ":"23",
    "erzincan":"24","erzurum":"25","eskişehir":"26","gaziantep":"27","giresun":"28","gümüşhane":"29",
    "hakkari":"30","hatay":"31","ısparta":"32","isparta":"32","mersin":"33","içel":"33",
    "istanbul":"34","i̇stanbul":"34","izmir":"35","i̇zmir":"35","kars":"36","kastamonu":"37",
    "kayseri":"38","kırklareli":"39","kırşehir":"40","kocaeli":"41","konya":"42","kütahya":"43",
    "malatya":"44","manisa":"45","kahramanmaraş":"46","maraş":"46","mardin":"47","muğla":"48",
    "muş":"49","nevşehir":"50","niğde":"51","ordu":"52","rize":"53","sakarya":"54",
    "samsun":"55","siirt":"56","sinop":"57","sivas":"58","tekirdağ":"59","tokat":"60",
    "trabzon":"61","tunceli":"62","şanlıurfa":"63","urfa":"63","uşak":"64","van":"65",
    "yozgat":"66","zonguldak":"67","aksaray":"68","bayburt":"69","karaman":"70","kırıkkale":"71",
    "batman":"72","şırnak":"73","bartın":"74","ardahan":"75","ığdır":"76","yalova":"77",
    "karabük":"78","kilis":"79","osmaniye":"80","düzce":"81"
  };

  // İL LİSTESİ — Müşteri formlarındaki "İL" seçim kutusu için (01.11.2026,
  // Abdullah onayı — mockup üzerinden). IL_KODLARI'ndan FARKLI: o tablo
  // plaka kodu eşleştirmesi için yazım varyasyonlarını da içeriyor
  // ("afyon"/"afyonkarahisar", "i̇zmir"/"izmir" gibi) — seçim kutusunda
  // bunlar YİNELENEN seçenek olarak görünür, bu yüzden burada TC'nin
  // resmi 81 ilinin TEK, düzgün yazılmış (baş harfi büyük) hali AYRI bir
  // sabit liste olarak tutuluyor. Plaka kodu eşleştirmesi (ilKoduBul)
  // DEĞİŞMEDİ, bu liste SADECE görüntüleme/seçim için.
  var IL_LISTESI = [
    "Adana","Adıyaman","Afyonkarahisar","Ağrı","Amasya","Ankara","Antalya","Artvin",
    "Aydın","Balıkesir","Bilecik","Bingöl","Bitlis","Bolu","Burdur","Bursa",
    "Çanakkale","Çankırı","Çorum","Denizli","Diyarbakır","Edirne","Elazığ","Erzincan",
    "Erzurum","Eskişehir","Gaziantep","Giresun","Gümüşhane","Hakkari","Hatay","Isparta",
    "Mersin","İstanbul","İzmir","Kars","Kastamonu","Kayseri","Kırklareli","Kırşehir",
    "Kocaeli","Konya","Kütahya","Malatya","Manisa","Kahramanmaraş","Mardin","Muğla",
    "Muş","Nevşehir","Niğde","Ordu","Rize","Sakarya","Samsun","Siirt",
    "Sinop","Sivas","Tekirdağ","Tokat","Trabzon","Tunceli","Şanlıurfa","Uşak",
    "Van","Yozgat","Zonguldak","Aksaray","Bayburt","Karaman","Kırıkkale","Batman",
    "Şırnak","Bartın","Ardahan","Iğdır","Yalova","Karabük","Kilis","Osmaniye","Düzce"
  ];
  function ilListesiGetir(){ return IL_LISTESI.slice(); }

  var IL_KODLARI_ANAHTARI = "weicon_il_kodlari";
  function ilKodlariYukle(){
    try{
      var kayitli = JSON.parse(localStorage.getItem(IL_KODLARI_ANAHTARI));
      if(kayitli && typeof kayitli === "object") return kayitli;
    }catch(e){}
    return Object.assign({}, IL_KODLARI); // ilk kullanım: varsayılan 81 il ile başlat
  }
  function ilKodlariKaydet(tablo){
    localStorage.setItem(IL_KODLARI_ANAHTARI, JSON.stringify(tablo));
  }
  // Menü › Şehir Plaka Kodları ekranı için: alfabetik, görüntülenebilir liste.
  function ilKodlariListele(){
    var tablo = ilKodlariYukle();
    var liste = Object.keys(tablo).map(function(anahtar){
      return {anahtar: anahtar, ad: anahtar.charAt(0).toLocaleUpperCase("tr-TR") + anahtar.slice(1), kod: tablo[anahtar]};
    });
    liste.sort(function(a,b){ return a.ad.localeCompare(b.ad, "tr-TR"); });
    return liste;
  }
  function ilKoduEkleGuncelle(ilAdi, kod){
    var anahtar = (ilAdi||"").trim().toLocaleLowerCase("tr-TR");
    if(!anahtar) return false;
    var temizKod = String(kod||"").replace(/\D/g,"").padStart(2,"0").slice(-2);
    var tablo = ilKodlariYukle();
    tablo[anahtar] = temizKod;
    ilKodlariKaydet(tablo);
    return true;
  }
  function ilKoduSil(anahtar){
    var tablo = ilKodlariYukle();
    delete tablo[anahtar];
    ilKodlariKaydet(tablo);
  }

  function ilKoduBul(sehirMetni){
    if(!sehirMetni) return "00";
    var temiz = sehirMetni.trim().toLocaleLowerCase("tr-TR").split("-")[0].split("/")[0].trim();
    var tablo = ilKodlariYukle();
    return tablo[temiz] || "00";
  }

  function musteriIdUret(tazeListe, sehir){
    // STANDART (WG.100926.196): artık il koduna bakılmıyor — tüm yeni
    // müşteriler tek, global "M-XXXX" (4 haneli, sıralı) formatında kod
    // alıyor. `sehir` parametresi geriye dönük uyumluluk için duruyor.
    var maxNo = 0;
    var yeniDesen = /^M-(\d{4})$/;
    tazeListe.forEach(function(m){
      var eslesme = m.id && m.id.match(yeniDesen);
      if(eslesme){
        var no = parseInt(eslesme[1], 10);
        if(no > maxNo) maxNo = no;
      }
    });
    return "M-" + String(maxNo+1).padStart(4, "0");
  }

  // MÜŞTERİ KODU ÖNİZLEME / SEÇİM (09.11.2026, Abdullah isteği — "yeni
  // müşteri tıklayınca sistem önce kodu kendisi ardışık oluştursun"):
  // Yeni Müşteri formu açılır açılmaz bir sonraki kod (M-0043 gibi)
  // gösterilir. Kayıt anında aynı kod KULLANILIR; yalnızca bu arada başka
  // bir cihaz aynı kodu aldıysa (nadir) bir sonrakine geçilir — böylece
  // asla çift kod oluşmaz. Kod kayıttan sonra HİÇ değişmez (isim değişse de).
  function sonrakiKodOnizle(){
    return musteriIdUret(liste, "");
  }
  function kodSec(istenen, tazeListe){
    var k = String(istenen||"").trim();
    if(/^M-\d{4}$/.test(k)){
      var dolu = tazeListe.some(function(m){ return m && m.id === k; });
      if(!dolu) return k;
    }
    return musteriIdUret(tazeListe, "");
  }

  // KOD + İSİM gösterimi için TEK ortak yardımcı (09.11.2026): kod verilmemişse
  // isimden müşteri bulunup kodu alınır. Biçim "KOD - İsim"; kod kırmızı/kalın.
  function kodBul(musteriId, ad){
    if(musteriId) return String(musteriId);
    if(!ad) return "";
    var m = musteriBul(ad);
    return (m && m.id) ? String(m.id) : "";
  }
  function kodAdHtml(musteriId, ad){
    function e(t){ return String(t==null?"":t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
    var kod = kodBul(musteriId, ad);
    return (kod ? "<b class='mk-kod' style='color:#c0392b;font-weight:700;'>" + e(kod) + "</b> - " : "") + e(ad||"");
  }

  // ---- YAZIM DÜZENİ (WG.240926.611): ticari isim / yetkili ismi otomatik
  // büyük-küçük harf standardı.
  // KALDIRILDI (29.09.2026, Abdullah'ın bildirdiği hata): adresDurumuYap
  // artık FATURA/TESLİMAT ADRESİ ve AÇIK ADRES alanlarına UYGULANMIYOR —
  // "Aşkale - Erzurum" gibi özel isimleri otomatik küçük harfe çeviriyor,
  // kullanıcının bilerek yazdığı büyük/küçük harfi eziyordu. Adres alanları
  // artık TAM OLARAK yazıldığı gibi (sadece baştaki/sondaki boşluk
  // kırpılarak) kaydediliyor. Ticari isim (unvanDurumuYap) ve yetkili ismi
  // (yetkiliIsimDurumuYap) kuralları DEĞİŞMEDİ, sadece adres etkilenmedi.
  var ADRES_OZEL_ISIM_EKLERI = ["cad.","cad","caddesi","sok.","sok","sokak","sokağı",
    "bulvarı","bulvar","blv.","mah.","mah","mahallesi","apt.","apt","apartmanı",
    "sitesi","sit.","köyü","mevkii"];

  function ilkHarfBuyukYap(kelime){
    if(!kelime) return kelime;
    return kelime.charAt(0).toLocaleUpperCase("tr-TR") + kelime.slice(1).toLocaleLowerCase("tr-TR");
  }

  // ARTIK ÇAĞRILMIYOR (30.10.2026, Abdullah onayı — "ismime dokunulmasın"
  // turu): ticari isim artık hiçbir yerde bu kuralla EZİLMİYOR (bkz.
  // yeniMusteriKaydet/musteriGuncelle'deki aynı tarihli
  // notlar). Fonksiyon silinmedi (zararsız, başka hiçbir yerden
  // çağrılmıyor) — sadece artık kullanılmıyor.
  // Sadece ilk kelimenin ilk harfi büyük, devamı küçük (ticari isim kuralı).
  function unvanDurumuYap(metin){
    var t = (metin||"").trim();
    if(!t) return t;
    var boslukla = t.split(/\s+/);
    return boslukla.map(function(k, i){ return i===0 ? ilkHarfBuyukYap(k) : k.toLocaleLowerCase("tr-TR"); }).join(" ");
  }

  // unvanDurumuYap ile aynı + adres son eklerinden önceki (en fazla 2)
  // kelimeyi "özel isim" sayıp büyük harfle bırakan istisna.
  function adresDurumuYap(metin){
    var t = (metin||"").trim();
    if(!t) return t;
    var kelimeler = t.split(/\s+/);
    var sonuc = kelimeler.map(function(k, i){ return i===0 ? ilkHarfBuyukYap(k) : k.toLocaleLowerCase("tr-TR"); });
    sonuc.forEach(function(k, i){
      var temiz = k.toLocaleLowerCase("tr-TR").replace(/[.,]/g, "");
      if(ADRES_OZEL_ISIM_EKLERI.indexOf(temiz) === -1) return;
      // Ek kelimesinin kendisi de büyük harfle başlar (Cad., Bulvarı gibi).
      sonuc[i] = ilkHarfBuyukYap(sonuc[i]);
      // Ekten hemen önceki 1-2 kelimeyi büyült; rakam içeren kelimede dur
      // (sokak/no numaraları özel isim sayılmaz).
      for(var geri=1; geri<=2; geri++){
        var idx = i - geri;
        if(idx < 0) break;
        if(/\d/.test(sonuc[idx])) break;
        if(ADRES_OZEL_ISIM_EKLERI.indexOf(sonuc[idx].toLocaleLowerCase("tr-TR").replace(/[.,]/g,"")) > -1) break;
        sonuc[idx] = ilkHarfBuyukYap(sonuc[idx]);
      }
    });
    return sonuc.join(" ");
  }

  // Yetkili ismi kuralı: ad kısmı(word'ler) ilk harf büyük devamı küçük,
  // SON kelime (soyad) tamamen büyük.
  function yetkiliIsimDurumuYap(metin){
    var t = (metin||"").trim();
    if(!t) return t;
    var kelimeler = t.split(/\s+/).filter(function(k){ return k; });
    if(kelimeler.length === 0) return t;
    if(kelimeler.length === 1) return ilkHarfBuyukYap(kelimeler[0]);
    var soyad = kelimeler[kelimeler.length-1];
    var adKismi = kelimeler.slice(0, -1).map(ilkHarfBuyukYap);
    return adKismi.join(" ") + " " + soyad.toLocaleUpperCase("tr-TR");
  }

  // kisi objesindeki isim alanına yetkiliIsimDurumuYap uygulayıp kopyasını
  // döner (orijinal objeye dokunmadan).
  function kisiIsimDuzelt(kisi){
    if(!kisi || !kisi.isim) return kisi;
    var kopya = {};
    for(var f in kisi){ if(kisi.hasOwnProperty(f)) kopya[f] = kisi[f]; }
    kopya.isim = yetkiliIsimDurumuYap(kisi.isim);
    return kopya;
  }

  // KÖK NEDEN DÜZELTMESİ (13.09.2026): "Müşteriyi Sil" onay metni kullanıcıya
  // "tüm sipariş/teklif geçmişi de silinir" diyordu ama musteriSil() SADECE
  // müşteri kaydını (dolayısıyla ona gömülü Temas geçmişini) siliyordu.
  // Numune/Teklif/Proforma/Sipariş arşivi ve o müşteriye ait görevler ayrı
  // Firebase yollarında (arsiv/*, gorevler) yaşadığı için hiç dokunulmuyordu
  // — silinen müşterinin işlemleri "hayalet kayıt" olarak Son İşlemler,
  // İşlem Geçmişi, Raporlar/İstatistikler ve Bildirimler'de sonsuza kadar
  // görünmeye (ve satış/prim toplamlarını kirletmeye) devam ediyordu. Bu
  // yüzden üç ekran arasında "senkron değil" izlenimi oluşuyordu: aslında
  // veri kaynağı zaten dinamikti (Firebase .on("value") + arsivDegistiginde
  // dinleyicileri), sorun silme işleminin YARIM kalmasıydı.
  // Bu fonksiyon musteriSil() ile AYNI anda/hemen sonrasında çağrılmalı;
  // dört arşiv koleksiyonunu ve gorevler'i taze-oku-transaction ile temizler.
  // Eşleştirme: musteriId varsa KESİN id eşleşmesi; yoksa (eski/ID'siz
  // kayıtlar) TAM isim eşleşmesi — silme geri alınamaz olduğu için burada
  // başka fonksiyonlardaki (musteriUrunGecmisi vb.) BULANIK alt-dize
  // eşleşmesi bilerek kullanılmadı, yanlış müşterinin kaydını silme riski var.
  function arsivVeGorevleriTemizle(musteriAd, musteriId, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    var db = firebase.database();
    var adNormal = (musteriAd||"").toLocaleLowerCase("tr-TR").trim();

    function ayniMusteriMi(k){
      if(!k) return false;
      if(musteriId && k.musteriId) return k.musteriId === musteriId;
      return (k.musteriAd !== undefined ? (k.musteriAd||"") : (k.musteri||""))
        .toLocaleLowerCase("tr-TR").trim() === adNormal;
    }

    var yollar = ["arsiv/numune","arsiv/teklif","arsiv/proforma","arsiv/siparis"];   // 11.11.2026: Görevlerim kaldırıldı — "gorevler" yolu artık koddan silinmiyor
    var kalan = yollar.length;
    var ilkHata = null;
    var toplamSilinen = 0;

    yollar.forEach(function(yol){
      var mutateHatasi = null;
      var silinenBuYolda = 0;
      db.ref(yol).transaction(function(currentData){
        var liste = currentData ? (Array.isArray(currentData) ? currentData.filter(Boolean) : Object.values(currentData)) : [];
        try{
          var kalanlar = liste.filter(function(k){ return !ayniMusteriMi(k); });
          silinenBuYolda = liste.length - kalanlar.length;
          return kalanlar;
        }catch(e){ mutateHatasi = e; return; }
      }).then(function(result){
        if(mutateHatasi || !result){ ilkHata = ilkHata || mutateHatasi || new Error(yol + " temizlenemedi."); }
        else { toplamSilinen += silinenBuYolda; }
        kalan--;
        if(kalan === 0) cb(!ilkHata, ilkHata, toplamSilinen);
      }).catch(function(err){
        ilkHata = ilkHata || err;
        kalan--;
        if(kalan === 0) cb(!ilkHata, ilkHata, toplamSilinen);
      });
    });
  }

  function benzerMusterileriBul(ad){
    var q = (ad||"").trim().toLocaleLowerCase("tr-TR");
    if(!q) return [];
    return liste.filter(function(m){
      var mevcut = (m.ad||"").trim().toLocaleLowerCase("tr-TR");
      if(!mevcut) return false;
      return mevcut === q || mevcut.indexOf(q) >= 0 || q.indexOf(mevcut) >= 0;
    });
  }

  function yeniMusteriKaydet(bilgi, geriBildir){
    if(!bilgi.ad || !bilgi.ad.trim()){ geriBildir(false, "Müşteri adı girin."); return; }
    var yeniKayit = null;
    guvenliYaz(function(tazeListe){
      yeniKayit = {
        id: kodSec(bilgi.kod, tazeListe),
        // DÜZELTME (30.10.2026, Abdullah onayı — "ismime dokunulmasın" turu):
        // ticari isim artık unvanDurumuYap() ile EZİLMİYOR — Abdullah bazı
        // kelimelerin baş harfini kasıtlı büyük yazıyor (ör. "Nuh'un Ankara
        // Makarna"), bu kural ilk kelime dışındaki HER kelimeyi küçük harfe
        // çeviriyordu ("Ankara" → "ankara"). Artık tam olarak yazıldığı gibi
        // (sadece baştaki/sondaki boşluk kırpılarak) kaydediliyor — adres
        // alanlarına 29.09.2026'da uygulanan AYNI kural, isme de genişletildi.
        ad: (bilgi.ad||"").trim(),
        sehir: (bilgi.sehir||"").trim(),
        // İL (01.11.2026, Abdullah onayı): ayrı, seçim kutusundan gelen il
        // bilgisi — ŞEHİR (ilçe) alanından BAĞIMSIZ, otomatik türetilmiyor.
        il: (bilgi.il||"").trim(),
        acikAdres: (bilgi.acikAdres||"").trim(),
        vade: (bilgi.vade||"").trim(),
        fatura: (bilgi.fatura||"").trim(),
        telefon: (bilgi.telefon||"").trim(),
        eposta: (bilgi.eposta||"").trim(),
        kargo: (bilgi.kargo||"").trim(),
        ziyaretGecmisi: [],
        // Kural: ekstra/ayrı bir fatura adresi girilmediği sürece, müşteri
        // eklenirken girilen İLK adres (Açık Adres) otomatik olarak Fatura
        // Adresi sayılır — "Fatura Adresi: Girilmemiş" görünüp de aslında
        // bir adres girilmiş olması durumunu önler.
        faturaAdresleri: (bilgi.acikAdres && bilgi.acikAdres.trim())
          ? [{etiket:"Fatura Adresi", adres: bilgi.acikAdres.trim()}]
          : [],
        teslimatAdresleri: (bilgi.teslimatAdresi && bilgi.teslimatAdresi.trim())
          ? [{etiket:"Teslimat Adresi", adres: bilgi.teslimatAdresi.trim()}]
          : [],
        // EKLENDİ (20.10.2026, Abdullah onayı — "Yeni Müşteri'de Yetkili Kişi"
        // turu): artık Yeni Müşteri formunda da (kaydetmeden önce) bir yetkili
        // kişi girilebiliyor — girildiyse ilk iletişim kaydı olarak eklenir;
        // isim formatı Cari Kart'taki Yetkili Ekle ile AYNI kurala uyar
        // (yetkiliIsimDurumuYap). Girilmediyse eskisi gibi boş dizi kalır,
        // kullanıcı sonradan Cari Kart'tan ekleyebilir.
        iletisimler: (bilgi.yIsim && bilgi.yIsim.trim())
          ? [{
              isim: yetkiliIsimDurumuYap(bilgi.yIsim.trim()),
              gorev: (bilgi.yGorev||"").trim(),
              telefon: (bilgi.yTelefon||"").trim(),
              eposta: (bilgi.yEposta||"").trim()
            }]
          : []
      };
      tazeListe.unshift(yeniKayit);
    }, function(basarili, err){
      geriBildir(basarili, basarili ? yeniKayit : err);
    });
  }

  function musteriGuncelle(musteriAd, guncelBilgi, geriBildir, musteriId){
    guvenliYaz(function(tazeListe){
      var idx = musteriIndexBul(tazeListe, musteriAd, musteriId);
      if(idx===-1) throw new Error("Müşteri bulunamadı");
      // Ticari isim değişikliği burada YAPILMAZ — sipariş/rapor/görev
      // kayıtlarının da eşzamanlı taşınması gerekir (bkz.
      // ReportsData.kayitlariBirlestir); cari-kart-render.js bu ikisini
      // birlikte, doğru sırayla çağırır.
      // DÜZELTME (30.10.2026, Abdullah onayı): bkz. yeniMusteriKaydet'teki
      // aynı tarihli not — unvanDurumuYap() artık burada da UYGULANMIYOR,
      // isim (örn. cari isim düzenle formundan) tam yazıldığı gibi kaydedilir.
      if(guncelBilgi.ad !== undefined) tazeListe[idx].ad = (guncelBilgi.ad||"").trim();
      if(guncelBilgi.vade !== undefined) tazeListe[idx].vade = guncelBilgi.vade;
      if(guncelBilgi.fatura !== undefined) tazeListe[idx].fatura = guncelBilgi.fatura;
      if(guncelBilgi.kargo !== undefined) tazeListe[idx].kargo = guncelBilgi.kargo;
      if(guncelBilgi.sehir !== undefined) tazeListe[idx].sehir = guncelBilgi.sehir;
      // İL (01.11.2026, Abdullah onayı): bkz. yeniMusteriKaydet'teki aynı
      // tarihli not.
      if(guncelBilgi.il !== undefined) tazeListe[idx].il = (guncelBilgi.il||"").trim();
      // ŞİRKET TELEFONU/E-POSTASI (19.10.2026, Abdullah onayı — "7 fotoğraf"
      // turu): artık "Fatura Adresi Düzenle" formundan da güncellenebiliyor
      // (bkz. cari-kart-render.js formKaydet, tip==="fatura").
      if(guncelBilgi.telefon !== undefined) tazeListe[idx].telefon = guncelBilgi.telefon;
      if(guncelBilgi.eposta !== undefined) tazeListe[idx].eposta = guncelBilgi.eposta;
    }, geriBildir);
  }

  function musteriAdresEkle(musteriAd, tip, etiket, adres, geriBildir, musteriId){
    guvenliYaz(function(tazeListe){
      var idx = musteriIndexBul(tazeListe, musteriAd, musteriId);
      if(idx===-1) throw new Error("Müşteri bulunamadı");
      var alan = tip==="fatura" ? "faturaAdresleri" : "teslimatAdresleri";
      if(!tazeListe[idx][alan]) tazeListe[idx][alan] = [];
      tazeListe[idx][alan].push({etiket: etiket || (tip==="fatura"?"Fatura Adresi":"Teslimat Adresi"), adres: (adres||"").trim()});
    }, geriBildir);
  }

  function musteriAdresSil(musteriAd, tip, adresIdx, geriBildir, musteriId){
    guvenliYaz(function(tazeListe){
      var idx = musteriIndexBul(tazeListe, musteriAd, musteriId);
      if(idx===-1) throw new Error("Müşteri bulunamadı");
      var alan = tip==="fatura" ? "faturaAdresleri" : "teslimatAdresleri";
      if(!tazeListe[idx][alan]) tazeListe[idx][alan] = [];
      tazeListe[idx][alan].splice(adresIdx, 1);
    }, geriBildir);
  }

  function musteriAdresGuncelle(musteriAd, tip, adresIdx, etiket, adres, geriBildir, musteriId){
    guvenliYaz(function(tazeListe){
      var idx = musteriIndexBul(tazeListe, musteriAd, musteriId);
      if(idx===-1) throw new Error("Müşteri bulunamadı");
      var alan = tip==="fatura" ? "faturaAdresleri" : "teslimatAdresleri";
      if(!tazeListe[idx][alan] || !tazeListe[idx][alan][adresIdx]) throw new Error("Adres bulunamadı");
      tazeListe[idx][alan][adresIdx] = {etiket: etiket, adres: (adres||"").trim()};
    }, geriBildir);
  }

  function yetkiliEkle(musteriAd, kisi, geriBildir, musteriId){
    guvenliYaz(function(tazeListe){
      var idx = musteriIndexBul(tazeListe, musteriAd, musteriId);
      if(idx===-1) throw new Error("Müşteri bulunamadı");
      if(!tazeListe[idx].iletisimler) tazeListe[idx].iletisimler = [];
      tazeListe[idx].iletisimler.push(kisiIsimDuzelt(kisi));
    }, geriBildir);
  }

  function yetkiliSil(musteriAd, kisiIdx, geriBildir, musteriId){
    guvenliYaz(function(tazeListe){
      var idx = musteriIndexBul(tazeListe, musteriAd, musteriId);
      if(idx===-1) throw new Error("Müşteri bulunamadı");
      if(!tazeListe[idx].iletisimler) tazeListe[idx].iletisimler = [];
      tazeListe[idx].iletisimler.splice(kisiIdx, 1);
    }, geriBildir);
  }

  function yetkiliGuncelle(musteriAd, kisiIdx, kisi, geriBildir, musteriId){
    guvenliYaz(function(tazeListe){
      var idx = musteriIndexBul(tazeListe, musteriAd, musteriId);
      if(idx===-1) throw new Error("Müşteri bulunamadı");
      if(!tazeListe[idx].iletisimler || !tazeListe[idx].iletisimler[kisiIdx]) throw new Error("Kişi bulunamadı");
      tazeListe[idx].iletisimler[kisiIdx] = kisiIsimDuzelt(kisi);
    }, geriBildir);
  }

  // --- Sadeleştirilmiş "tek kayıt" modeli (yeni Cari Kart tasarımı) ---
  // Her müşterinin TEK fatura adresi, TEK teslimat adresi, TEK yetkilisi
  // ve opsiyonel TEK notu olur (liste değil). Var olan diziyi her zaman
  // tek elemanlı [obje] ile değiştirir; böylece eski çoklu-kayıt verisi
  // varsa bile ilk kayıt korunur, üzerine yazınca dizi sadeleşir.
  function musteriTekAdresKaydet(musteriAd, tip, adres, geriBildir, musteriId){
    guvenliYaz(function(tazeListe){
      var idx = musteriIndexBul(tazeListe, musteriAd, musteriId);
      if(idx===-1) throw new Error("Müşteri bulunamadı");
      var alan = tip==="fatura" ? "faturaAdresleri" : "teslimatAdresleri";
      tazeListe[idx][alan] = [{etiket: tip==="fatura"?"Fatura Adresi":"Teslimat Adresi", adres: (adres||"").trim()}];
    }, geriBildir);
  }

  function musteriTekAdresSil(musteriAd, tip, geriBildir, musteriId){
    guvenliYaz(function(tazeListe){
      var idx = musteriIndexBul(tazeListe, musteriAd, musteriId);
      if(idx===-1) throw new Error("Müşteri bulunamadı");
      var alan = tip==="fatura" ? "faturaAdresleri" : "teslimatAdresleri";
      tazeListe[idx][alan] = [];
    }, geriBildir);
  }

  function musteriTekYetkiliKaydet(musteriAd, kisi, geriBildir, musteriId){
    guvenliYaz(function(tazeListe){
      var idx = musteriIndexBul(tazeListe, musteriAd, musteriId);
      if(idx===-1) throw new Error("Müşteri bulunamadı");
      tazeListe[idx].iletisimler = [kisiIsimDuzelt(kisi)];
    }, geriBildir);
  }

  function musteriTekYetkiliSil(musteriAd, geriBildir, musteriId){
    guvenliYaz(function(tazeListe){
      var idx = musteriIndexBul(tazeListe, musteriAd, musteriId);
      if(idx===-1) throw new Error("Müşteri bulunamadı");
      tazeListe[idx].iletisimler = [];
    }, geriBildir);
  }

  function musteriNotKaydet(musteriAd, not, geriBildir, musteriId){
    guvenliYaz(function(tazeListe){
      var idx = musteriIndexBul(tazeListe, musteriAd, musteriId);
      if(idx===-1) throw new Error("Müşteri bulunamadı");
      tazeListe[idx].not = not||"";
    }, geriBildir);
  }

  function musteriNotSil(musteriAd, geriBildir, musteriId){
    guvenliYaz(function(tazeListe){
      var idx = musteriIndexBul(tazeListe, musteriAd, musteriId);
      if(idx===-1) throw new Error("Müşteri bulunamadı");
      tazeListe[idx].not = "";
    }, geriBildir);
  }

  // --- Çoklu NOT desteği (Cari Kart v4) ---
  // Her müşterinin birden fazla notu olabilir: notlar: [{baslik, metin}].
  // Geriye dönük uyumluluk için tazeListe[idx].not alanı HER ZAMAN
  // notlar dizisindeki tüm metinlerin birleşimiyle senkron tutulur —
  // send-render.js gibi eski tüketiciler hâlâ musteri.not okuyabilir.
  function notlarSenkronizeEt(kayit){
    var notlar = kayit.notlar || [];
    kayit.not = notlar.map(function(n){ return n.metin; }).filter(Boolean).join("\n");
  }

  function notEkle(musteriAd, not, geriBildir, musteriId){
    guvenliYaz(function(tazeListe){
      var idx = musteriIndexBul(tazeListe, musteriAd, musteriId);
      if(idx===-1) throw new Error("Müşteri bulunamadı");
      if(!tazeListe[idx].notlar) tazeListe[idx].notlar = [];
      tazeListe[idx].notlar.push(not);
      notlarSenkronizeEt(tazeListe[idx]);
    }, geriBildir);
  }

  function notSil(musteriAd, notIdx, geriBildir, musteriId){
    guvenliYaz(function(tazeListe){
      var idx = musteriIndexBul(tazeListe, musteriAd, musteriId);
      if(idx===-1) throw new Error("Müşteri bulunamadı");
      if(!tazeListe[idx].notlar) tazeListe[idx].notlar = [];
      tazeListe[idx].notlar.splice(notIdx, 1);
      notlarSenkronizeEt(tazeListe[idx]);
    }, geriBildir);
  }

  function notGuncelle(musteriAd, notIdx, not, geriBildir, musteriId){
    guvenliYaz(function(tazeListe){
      var idx = musteriIndexBul(tazeListe, musteriAd, musteriId);
      if(idx===-1) throw new Error("Müşteri bulunamadı");
      if(!tazeListe[idx].notlar || !tazeListe[idx].notlar[notIdx]) throw new Error("Not bulunamadı");
      tazeListe[idx].notlar[notIdx] = not;
      notlarSenkronizeEt(tazeListe[idx]);
    }, geriBildir);
  }

  function musteriSil(musteriAd, geriBildir, musteriId){
    guvenliYaz(function(tazeListe){
      var idx = musteriIndexBul(tazeListe, musteriAd, musteriId);
      if(idx===-1) throw new Error("Müşteri bulunamadı");
      tazeListe.splice(idx, 1);
    }, geriBildir);
  }

  // Eski uygulamanın musteriBirlestirOnayla() ile AYNI mantık: "diger"
  // müşterinin iletişim/ziyaret bilgileri "ana"ya taşınır, "diger" silinir.
  // Arşiv (sipariş/teklif/proforma/numune) ve görev taşıma AYRICA
  // ReportsData.kayitlariBirlestir() ile yapılır (bkz. reports-data.js) —
  // her koleksiyon kendi güvenli-yaz mekanizmasıyla, taze veri üzerinden.
  function musterileriBirlestir(anaAd, digerAd, geriBildir){
    var sonucBilgi = null;
    guvenliYaz(function(tazeListe){
      var anaIdx = musteriIndexBul(tazeListe, anaAd);
      var digerIdx = musteriIndexBul(tazeListe, digerAd);
      if(anaIdx===-1 || digerIdx===-1) throw new Error("Müşterilerden biri bulunamadı");
      var ana = tazeListe[anaIdx];
      var diger = tazeListe[digerIdx];
      if(!ana.id) ana.id = musteriIdUret(tazeListe, ana.sehir);

      var mevcutIsimler = (ana.iletisimler||[]).map(function(k){ return (k.isim||"").toLocaleLowerCase("tr-TR"); });
      (diger.iletisimler||[]).forEach(function(k){
        if(mevcutIsimler.indexOf((k.isim||"").toLocaleLowerCase("tr-TR"))===-1){
          if(!ana.iletisimler) ana.iletisimler = [];
          ana.iletisimler.push(k);
        }
      });

      if(diger.ziyaretGecmisi && diger.ziyaretGecmisi.length){
        if(!ana.ziyaretGecmisi) ana.ziyaretGecmisi = [];
        ana.ziyaretGecmisi = ana.ziyaretGecmisi.concat(diger.ziyaretGecmisi);
        ana.ziyaretGecmisi.sort(function(a,b){ return (b.ts||0)-(a.ts||0); });
        ana.sonZiyaret = ana.ziyaretGecmisi[0].ts;
        ana.sonZiyaretNot = ana.ziyaretGecmisi[0].not;
      }

      sonucBilgi = {anaAd: ana.ad, anaId: ana.id, digerAd: diger.ad, digerId: diger.id||null};
      // digerIdx, anaIdx'ten büyükse önce onu silmek indexleri bozmaz;
      // güvenli olmak için isimle tekrar bulup öyle çıkarıyoruz.
      var silinecekIdx = musteriIndexBul(tazeListe, digerAd);
      tazeListe.splice(silinecekIdx, 1);
    }, function(basarili, err){
      geriBildir(basarili, basarili ? sonucBilgi : err);
    });
  }

  // Bir müşteri kartı açıldığında çağrılır — eski uygulamayla aynı: arama
  // sonuçlarını "en son görüntülenen üstte" sıralayabilmek için.
  function sonGoruntulendi(musteriAd, musteriId){
    guvenliYaz(function(tazeListe){
      var idx = musteriIndexBul(tazeListe, musteriAd, musteriId);
      if(idx===-1) return;
      tazeListe[idx].sonGoruntuleme = Date.now();
    }, function(){});
  }

  return {
    baslat: baslat,
    listeDegistiginde: listeDegistiginde,
    ara: ara,
    sec: sec,
    secimiKaldir: secimiKaldir,
    seciliyiOku: seciliyiOku,
    uzunluk: function(){ return liste.length; },
    ilKodlariListele: ilKodlariListele,
    ilListesiGetir: ilListesiGetir,
    ilKoduEkleGuncelle: ilKoduEkleGuncelle,
    ilKoduSil: ilKoduSil,
    musteriIdIleBul: musteriIdIleBul,
    sehirBul: sehirBul,
    konumMetni: konumMetni,
    ziyaretHatirlatmalari: ziyaretHatirlatmalari,
    ziyaretEkle: ziyaretEkle,
    ziyaretSil: ziyaretSil,
    ziyaretNotGuncelle: ziyaretNotGuncelle,
    ziyaretGuncelle: ziyaretGuncelle,
    tumZiyaretTemaslar: tumZiyaretTemaslar,
    hatirlatmalarBugun: hatirlatmalarBugun,
    gunFarkiHesapla: gunFarkiHesapla,
    yeniMusteriKaydet: yeniMusteriKaydet,
    sonrakiKodOnizle: sonrakiKodOnizle,
    kodBul: kodBul,
    kodAdHtml: kodAdHtml,
    benzerMusterileriBul: benzerMusterileriBul,
    musteriGuncelle: musteriGuncelle,
    musteriBul: musteriBul,
    musteriAdresEkle: musteriAdresEkle,
    musteriAdresSil: musteriAdresSil,
    musteriAdresGuncelle: musteriAdresGuncelle,
    yetkiliEkle: yetkiliEkle,
    yetkiliSil: yetkiliSil,
    yetkiliGuncelle: yetkiliGuncelle,
    musteriTekAdresKaydet: musteriTekAdresKaydet,
    musteriTekAdresSil: musteriTekAdresSil,
    musteriTekYetkiliKaydet: musteriTekYetkiliKaydet,
    musteriTekYetkiliSil: musteriTekYetkiliSil,
    musteriNotKaydet: musteriNotKaydet,
    musteriNotSil: musteriNotSil,
    notEkle: notEkle,
    notSil: notSil,
    notGuncelle: notGuncelle,
    musteriSil: musteriSil,
    arsivVeGorevleriTemizle: arsivVeGorevleriTemizle,
    musterileriBirlestir: musterileriBirlestir,
    sonGoruntulendi: sonGoruntulendi
  };

})();

CustomerData.baslat();
