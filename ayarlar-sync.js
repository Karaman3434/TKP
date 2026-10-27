/*
  ayarlar-sync.js — WG.271026.2206.1115
  ===============
  27.10.2026 PERFORMANS KAZANIMI: otomatik kur çekme zincirindeki her
  denemeye (TCMB/Frankfurter/yedek) 5 saniyelik zaman aşımı eklendi — bkz.
  tekKaynaktanDene(). Kaynak sırası/önceliği ve sonuçtaki değer HİÇ
  DEĞİŞMEDİ.
  Kur ve KDV oranı SADECE localStorage'da tutulmuyor — Firebase'in
  "ayarlar/" yoluna da yazılıyor ki bir cihazda (örn. Samsung S22) girilen
  kur, diğer cihazlarda (iPhone 13, iPad) de otomatik görünsün.

  OTOMATİK KUR ÇEKME: Ücretsiz Frankfurter.app servisinden (API anahtarı
  gerektirmez, CORS'a açık) EUR→TRY kuru sayfa her açıldığında ve 2 saatte
  bir otomatik çekilir — ama SADECE mevcut kur 2 saatten eskiyse (elle
  girilmiş taze bir kuru asla ezmez).

  ZORUNLU TAZELİK: Bir satış Kaydet/Gönder edilmeden önce send-render.js
  kurBayatMi()'yi kontrol eder; kur bayatsa önce otomatik çekmeyi dener,
  o da başarısız olursa kullanıcıyı zorunlu elle girişe yönlendirir —
  böylece merkez ofisin kestiği faturayla CRM kaydı arasında kur
  tutarsızlığı oluşmaz.

  Diğer tüm dosyalar (cart-data.js, reports-data.js, calc-render.js,
  veri-render.js) hâlâ aynı localStorage anahtarlarını ("weicon_kur",
  "weicon_kdv_orani") okuyor — bu dosya sadece o anahtarları hem Firebase
  hem dış kur servisiyle canlı senkron tutar.
*/

var AyarlarSync = (function(){

  var dinleyiciler = [];
  var IKI_SAAT_MS = 2 * 60 * 60 * 1000;

  function baslat(){
    try{
      if(!firebase.apps.length){ firebase.initializeApp(WEICON_FIREBASE_CONFIG); }
      firebase.database().ref("ayarlar").on("value", function(snap){
        var v = snap.val() || {};
        if(v.kur!=null) localStorage.setItem("weicon_kur", v.kur);
        if(v.kdv!=null) localStorage.setItem("weicon_kdv_orani", v.kdv);
        if(v.hedef!=null) localStorage.setItem("weicon_hedef", v.hedef);
        if(v.kurZaman!=null) localStorage.setItem("weicon_kur_zaman", v.kurZaman);
        if(v.kurKaynak!=null) localStorage.setItem("weicon_kur_kaynak", v.kurKaynak);
        if(v.brutSabitMaas!=null) localStorage.setItem("weicon_brut_sabit_maas", v.brutSabitMaas);
        if(v.matrahBaz!=null) localStorage.setItem("weicon_matrah_baz", JSON.stringify(v.matrahBaz));
        dinleyiciler.forEach(function(fn){
          try{ fn(); }catch(e){ console.error("Ayar senkron dinleyicisi hatası:", e); }
        });
      }, function(err){
        console.error("Ayarlar Firebase okuma hatası:", err);
      });
      otomatikKurGuncellemeyiBaslat();
    }catch(e){ console.error("Ayarlar senkronu başlatılamadı:", e); }
  }

  // Kur en son ne zaman girildi/güncellendi — 2 saatten eskiyse VEYA hiç
  // geçerli bir kur yoksa "bayat" sayılır.
  function kurBayatMi(){
    var kur = parseFloat(localStorage.getItem("weicon_kur"));
    if(!isFinite(kur) || kur<=0) return true;
    var zaman = parseFloat(localStorage.getItem("weicon_kur_zaman"));
    if(isNaN(zaman) || zaman<=0) return true;
    return (Date.now() - zaman) > IKI_SAAT_MS;
  }

  // Ücretsiz, API anahtarı gerektirmeyen EUR→TRY kur servislerinden çeker.
  // SIRALAMA (en isabetliden en garantiliye):
  //  1) TCMB (Türkiye Cumhuriyet Merkez Bankası) — merkez ofisin muhtemelen
  //     esas aldığı GERÇEK resmi Türk kuru. Tarayıcıdan (CORS) erişilebilir
  //     mi kesin garanti yok — başarısız olursa (ağ/CORS engeli) otomatik
  //     olarak aşağıdaki kaynaklara düşülür.
  //  2) Frankfurter.dev (ECB/Avrupa Merkez Bankası kaynaklı) — CORS'a açık,
  //     güvenilir ama TCMB'den küçük farklarla ayrılabilir.
  //  3) open.er-api.com — son çare yedek kaynak.
  // Sadece kur bayatsa (2 saatten eski) devreye girer — elle girilmiş taze
  // bir kuru asla ezmez.
  // PERFORMANS KAZANIMI (27.10.2026): fetch() öncesi HİÇBİR zaman aşımı
  // yoktu — ağ/CORS engeli "hemen" başarısız olmayıp yavaş/askıda kalan bir
  // istek şeklinde ortaya çıkarsa, zincirdeki sıradaki kaynağa (Frankfurter/
  // yedek) geçiş gereğinden fazla gecikebiliyordu. KAYNAK SIRASI/ÖNCELİĞİ
  // (TCMB → Frankfurter → yedek) AYNEN KORUNDU — sadece her denemeye 5
  // saniyelik bir üst sınır eklendi, böylece takılan bir istek zinciri
  // tıkamadan hızlıca bir sonraki kaynağa düşülür.
  var KUR_ISTEK_ZAMAN_ASIMI_MS = 5000;
  function tekKaynaktanDene(url, ayikla, basariCb, hataCb){
    var controller = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var zamanAsimi = controller ? setTimeout(function(){ controller.abort(); }, KUR_ISTEK_ZAMAN_ASIMI_MS) : null;
    fetch(url, controller ? {signal: controller.signal} : undefined)
      .then(function(r){ if(!r.ok) throw new Error("HTTP " + r.status); return ayikla.xml ? r.text() : r.json(); })
      .then(function(veri){
        if(zamanAsimi) clearTimeout(zamanAsimi);
        var kur = ayikla.xml ? ayikla.xml(veri) : ayikla(veri);
        if(!kur || isNaN(kur) || kur<=0) throw new Error("Kur verisi geçersiz");
        basariCb(kur);
      })
      .catch(function(err){
        if(zamanAsimi) clearTimeout(zamanAsimi);
        hataCb(err);
      });
  }

  function tcmbXmldenKurAyikla(xmlMetin){
    var dp = new DOMParser();
    var dom = dp.parseFromString(xmlMetin, "text/xml");
    if(dom.querySelector("parsererror")) return null;
    var currencyNode = Array.prototype.find.call(dom.getElementsByTagName("Currency"), function(n){
      return n.getAttribute("Kod") === "EUR" || n.getAttribute("CurrencyCode") === "EUR";
    });
    if(!currencyNode) return null;
    var satisNode = currencyNode.getElementsByTagName("ForexSelling")[0];
    return satisNode ? parseFloat(satisNode.textContent.replace(",",".")) : null;
  }

  // DÜZELTME (05.10.2026, Abdullah'ın isteğiyle): otomatik çekilen kur
  // (TCMB sitesine tarayıcıdan CORS kısıtı yüzünden çoğunlukla erişilemiyor,
  // bu yüzden pratikte genelde Frankfurter/yedek kaynağa düşülüyor), TCMB'nin
  // kendi Döviz Satış kurundan gözlemle ~10 kuruş düşük geliyordu. Otomatik
  // çekme mantığı AYNEN kalıyor — SADECE sonuca bu sabit düzeltme ekleniyor,
  // ki gösterilen/kullanılan kur TCMB günlük kuruyla eşleşsin. Manuel girilen
  // kur (ayarlar-render.js / cart-render.js'teki kurKaydet çağrıları) buna
  // dahil DEĞİL — sadece otomatik çekilen kur düzeltiliyor.
  var OTOMATIK_KUR_DUZELTME = 0.10;

  function otomatikKurGetir(zorlaMi, geriBildir){
    if(!zorlaMi && !kurBayatMi()){ if(geriBildir) geriBildir(true); return; }
    tekKaynaktanDene(
      "https://www.tcmb.gov.tr/kurlar/today.xml",
      {xml: tcmbXmldenKurAyikla},
      function(kur){ kur = kur + OTOMATIK_KUR_DUZELTME; kurKaydet(kur,"tcmb"); if(geriBildir) geriBildir(true, kur, "tcmb"); },
      function(errTcmb){
        console.error("TCMB'den kur çekilemedi (CORS/ağ olabilir), Frankfurter deneniyor:", errTcmb);
        tekKaynaktanDene(
          "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=TRY",
          function(v){ return v && v.rates && v.rates.TRY; },
          function(kur){ kur = kur + OTOMATIK_KUR_DUZELTME; kurKaydet(kur,"frankfurter"); if(geriBildir) geriBildir(true, kur, "frankfurter"); },
          function(err1){
            console.error("Frankfurter'dan da kur çekilemedi, yedek kaynak deneniyor:", err1);
            tekKaynaktanDene(
              "https://open.er-api.com/v6/latest/EUR",
              function(v){ return v && v.rates && v.rates.TRY; },
              function(kur){ kur = kur + OTOMATIK_KUR_DUZELTME; kurKaydet(kur,"yedek"); if(geriBildir) geriBildir(true, kur, "yedek"); },
              function(err2){
                console.error("Yedek kaynaktan da kur çekilemedi:", err2);
                if(geriBildir) geriBildir(false, null, err2);
              }
            );
          }
        );
      }
    );
  }

  function otomatikKurGuncellemeyiBaslat(){
    otomatikKurGetir(false);
    setInterval(function(){ otomatikKurGetir(false); }, IKI_SAAT_MS);
  }

  function degistiginde(fn){
    if(typeof fn === "function" && dinleyiciler.indexOf(fn)===-1) dinleyiciler.push(fn);
  }

  // DÜZELTME (09.10.2026, kod incelemesi sonrası): önceden Firebase
  // yazması "fırlat ve unut" şeklindeydi — localStorage HER ZAMAN güncellenir,
  // Firebase'e yazma başarısız olsa bile kimse haberdar olmazdı; bu durumda
  // bu cihazda görünen kur ile merkezdeki (ve diğer cihazlardaki) kur
  // sessizce birbirinden ayrışabiliyordu. Artık localStorage ANINDA
  // güncellenir (ekran/akış kesilmesin diye optimistik), AMA Firebase
  // yazmasının sonucu da ayrıca beklenir — başarısız olursa isteğe bağlı
  // geriBildir(false, hata) ile çağırana bildirilir, o da kullanıcıyı
  // uyarabilir (bkz. cart-render.js kurElleSorVeDevamEt, ayarlar-render.js
  // ayarlariKaydet).
  function kurKaydet(v, kaynak, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : null;
    var zaman = Date.now();
    localStorage.setItem("weicon_kur", v);
    localStorage.setItem("weicon_kur_zaman", zaman);
    if(kaynak) localStorage.setItem("weicon_kur_kaynak", kaynak);
    try{
      firebase.database().ref("ayarlar").update({kur:v, kurZaman:zaman, kurKaynak:kaynak||null})
        .then(function(){ if(cb) cb(true); })
        .catch(function(err){
          console.error("Kur Firebase'e yazılamadı (cihazda kaydedildi ama merkezde değil):", err);
          if(cb) cb(false, err);
        });
    }catch(e){
      console.error("Kur Firebase'e yazılamadı:", e);
      if(cb) cb(false, e);
    }
  }

  function kdvKaydet(v){
    localStorage.setItem("weicon_kdv_orani", v);
    try{ firebase.database().ref("ayarlar/kdv").set(v); }catch(e){}
  }

  function hedefKaydet(v){
    localStorage.setItem("weicon_hedef", v);
    try{ firebase.database().ref("ayarlar/hedef").set(v); }catch(e){}
  }

  function brutSabitMaasKaydet(v){
    localStorage.setItem("weicon_brut_sabit_maas", v);
    try{ firebase.database().ref("ayarlar/brutSabitMaas").set(v); }catch(e){}
  }

  function matrahBazKaydet(obj){
    localStorage.setItem("weicon_matrah_baz", JSON.stringify(obj));
    try{ firebase.database().ref("ayarlar/matrahBaz").set(obj); }catch(e){}
  }

  return {
    baslat: baslat,
    degistiginde: degistiginde,
    kurKaydet: kurKaydet,
    kdvKaydet: kdvKaydet,
    hedefKaydet: hedefKaydet,
    brutSabitMaasKaydet: brutSabitMaasKaydet,
    matrahBazKaydet: matrahBazKaydet,
    kurBayatMi: kurBayatMi,
    otomatikKurGetir: otomatikKurGetir
  };

})();

AyarlarSync.baslat();
