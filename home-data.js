/*
  home-data.js
  ============
  Bu dosyanın TEK görevi: Firebase'e bağlanmak, arşiv verisini çekmek, ve
  "bu ay / bugün satış-prim toplamı" hesaplamalarını yapmak. DOM'a hiçbir
  şekilde dokunmaz — sadece veri üretir. Ekrana yazma işi home-render.js'te.

  Hesaplama mantığı, eski app-part4.js dosyasındaki buAyinSiparisVerisi() ve
  buGuneAitSiparisVerisi() fonksiyonlarından birebir taşındı — iş mantığı
  DEĞİŞMEDİ, sadece dosya/sorumluluk ayrımı yapıldı.
*/

var IsTakipData = (function(){

  var AYLAR = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  var arsivData = {siparis:[], proforma:[], teklif:[], numune:[]};
  var hazir = false;
  var dinleyiciler = [];
  var bildirimDinlemeBasladi = false;

  function baslat(){
    try{
      if(!firebase.apps.length){ firebase.initializeApp(ISTAKIP_FIREBASE_CONFIG); }
      var db = firebase.database();
      db.ref("arsiv").on("value", function(snap){
        var data = snap.val();
        if(data){
          arsivData = data;
          if(!arsivData.siparis) arsivData.siparis = [];
        }else{
          arsivData = {siparis:[], proforma:[], teklif:[], numune:[]};
        }
        hazir = true;
        dinleyiciler.forEach(function(fn){ fn(); });
      }, function(err){
        console.error("Firebase okuma hatası:", err);
      });
    }catch(e){
      console.error("Firebase başlatma hatası:", e);
    }
  }

  function veriDegistiginde(fn){
    if(typeof fn !== "function") return;
    if(dinleyiciler.indexOf(fn) === -1) dinleyiciler.push(fn);
  }

  function buGununIsGunuTarihi(){
    var simdi = new Date();
    var saat = simdi.getHours();
    if(saat >= 6 && saat < 9) return null;
    var gun = new Date(simdi);
    if(saat < 6) gun.setDate(gun.getDate()-1);
    gun.setHours(0,0,0,0);
    return gun;
  }

  function buAyinVerisi(){
    var now = new Date();
    var buAyAd = AYLAR[now.getMonth()];
    var buYil = now.getFullYear().toString();
    var siparisler = arsivData.siparis || [];
    var toplamEuro = 0, toplamEuroTl = 0, toplamPrim = 0;
    for(var i=0;i<siparisler.length;i++){
      var k = siparisler[i];
      if(!k.tarih) continue;
      if(k.durum === "beklemede") continue; // Beklemede sipariş hiçbir toplama dahil edilmez
      var parca = k.tarih.split(" ");
      var ayAd = parca[1]||"", yil = parca[2]||"";
      if(ayAd!==buAyAd || yil!==buYil) continue;
      var kKuru0 = k.kur || guncelKurYedek();
      if(k.urunler) for(var j=0;j<k.urunler.length;j++){
        var u = k.urunler[j];
        toplamEuro += u.toplamEuro||0;
        toplamEuroTl += (u.toplamEuro||0) * kKuru0; // satış tutarı işlemin YAPILDIĞI günün kuruyla TL'ye çevrilir
        var mk = (u.iskBirim||0)-(u.dipFiyat||0);
        var satirPrimi = ((u.iskonto||0) > 60) ? 0 : mk*(u.adet||1)*0.22;
        // Müdür primi işlemin YAPILDIĞI günün kuruyla TL'ye çevrilir —
        // kayıtta kur yoksa (çok eski kayıt) o anki güncel kur yedek olarak kullanılır.
        var kKuru = k.kur || guncelKurYedek();
        if(satirPrimi>0) toplamPrim += satirPrimi*kKuru;
      }
    }
    return {ayAd:buAyAd, yil:buYil, toplamEuro:toplamEuro, toplamEuroTl:toplamEuroTl, toplamPrim:toplamPrim};
  }

  function bugununVerisi(){
    var isGunu = buGununIsGunuTarihi();
    if(!isGunu) return {toplamEuro:0, toplamPrim:0, aktifMi:false};
    var gunNo = isGunu.getDate().toString();
    var ayAd = AYLAR[isGunu.getMonth()];
    var yil = isGunu.getFullYear().toString();
    var siparisler = arsivData.siparis || [];
    var toplamEuro = 0, toplamEuroTl = 0, toplamPrim = 0;
    for(var i=0;i<siparisler.length;i++){
      var k = siparisler[i];
      if(!k.tarih) continue;
      if(k.durum === "beklemede") continue; // Beklemede sipariş hiçbir toplama dahil edilmez
      var parca = k.tarih.split(" ");
      if((parca[0]||"")!==gunNo || (parca[1]||"")!==ayAd || (parca[2]||"")!==yil) continue;
      var kKuru0 = k.kur || guncelKurYedek();
      if(k.urunler) for(var j=0;j<k.urunler.length;j++){
        var u = k.urunler[j];
        toplamEuro += u.toplamEuro||0;
        toplamEuroTl += (u.toplamEuro||0) * kKuru0;
        var mk = (u.iskBirim||0)-(u.dipFiyat||0);
        var satirPrimi = ((u.iskonto||0) > 60) ? 0 : mk*(u.adet||1)*0.22;
        var kKuru = k.kur || guncelKurYedek();
        if(satirPrimi>0) toplamPrim += satirPrimi*kKuru;
      }
    }
    return {toplamEuro:toplamEuro, toplamEuroTl:toplamEuroTl, toplamPrim:toplamPrim, aktifMi:true};
  }

  function gununIslemOzeti(){
    var isGunu = buGununIsGunuTarihi();
    var dokum = {numune:0, teklif:0, proforma:0, siparis:0};
    if(!isGunu) return {toplam:0, dokum:dokum};
    var gunNo = isGunu.getDate().toString();
    var ayAd = AYLAR[isGunu.getMonth()];
    var yil = isGunu.getFullYear().toString();
    ["numune","teklif","proforma","siparis"].forEach(function(tip){
      (arsivHamData[tip] || []).forEach(function(k){
        if(!k.tarih) return;
        var parca = k.tarih.split(" ");
        if((parca[0]||"")===gunNo && (parca[1]||"")===ayAd && (parca[2]||"")===yil) dokum[tip]++;
      });
    });
    var toplam = dokum.numune+dokum.teklif+dokum.proforma+dokum.siparis;
    return {toplam:toplam, dokum:dokum};
  }

  function guncelKurYedek(){
    var v = parseFloat(localStorage.getItem("weicon_kur"));
    return isNaN(v) ? 0 : v;
  }

  function fmt(n){
    return (n||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2});
  }

  var arsivHamData = {numune:[], teklif:[], proforma:[], siparis:[]};
  var gorevHamData = [];
  var bildirimDinleyicileri = [];

  function bildirimVerisiDinlemeyeBasla(){
    if(bildirimDinlemeBasladi) return;
    bildirimDinlemeBasladi = true;
    try{
      var db = firebase.database();
      db.ref("arsiv").on("value", function(snap){
        var data = snap.val() || {};
        // KÖK NEDEN DÜZELTMESİ (15.09.2026): bu liste "siparis"i dışarıda
        // bırakıyordu — arsivHamData.siparis hiç dolmuyor, bu yüzden
        // gununIslemOzeti() (Ana Sayfa'daki "Günün Özeti" kutusu) bugün
        // girilen SİPARİŞLERİ asla saymıyordu ("0 İşlem" görünüyordu),
        // oysa aynı gün BUGÜN SATIŞ tutarı (ayrı bir veri kaynağından
        // okunuyor) doğru gösteriliyordu — ikisi arasındaki tutarsızlık
        // buradan geliyordu. bildirimOzetiHesapla()'nın "açık süreç"
        // sayımı kasıtlı olarak sadece numune/teklif/proforma'ya bakıyor
        // (kendi ayrı döngüsünde), ona dokunulmadı.
        ["numune","teklif","proforma","siparis"].forEach(function(t){
          var liste = data[t];
          arsivHamData[t] = liste ? (Array.isArray(liste) ? liste.filter(Boolean) : Object.values(liste)) : [];
        });
        bildirimDinleyicileri.forEach(function(fn){ fn(); });
      });
      db.ref("gorevler").on("value", function(snap){
        var data = snap.val();
        gorevHamData = data ? (Array.isArray(data) ? data.filter(Boolean) : Object.values(data)) : [];
        bildirimDinleyicileri.forEach(function(fn){ fn(); });
      });
    }catch(e){
      bildirimDinlemeBasladi = false;
      console.error("Bildirim verisi dinlenemedi:", e);
    }
  }

  function bildirimOzetiHesapla(){
    var bugun = Date.now();
    var acikSurecSayisi = 0;
    ["numune","teklif","proforma"].forEach(function(t){
      arsivHamData[t].forEach(function(k){
        if(!k.ts) return;
        var gunFarki = Math.floor((bugun - (k.revizeZamani||k.ts)) / 86400000);
        if(gunFarki >= 15) acikSurecSayisi++;
      });
    });
    var gecikmisGorevSayisi = 0;
    var bugunTarihStr = new Date().toISOString().slice(0,10);
    gorevHamData.forEach(function(g){
      if(g.tamamlandi) return;
      if(g.tarih && g.tarih < bugunTarihStr) gecikmisGorevSayisi++;
    });
    return {acikSurecSayisi:acikSurecSayisi, gecikmisGorevSayisi:gecikmisGorevSayisi, toplam:acikSurecSayisi+gecikmisGorevSayisi};
  }

  function bildirimDegistiginde(fn){
    if(typeof fn !== "function") return;
    if(bildirimDinleyicileri.indexOf(fn) === -1) bildirimDinleyicileri.push(fn);
  }

  return {
    baslat: baslat,
    veriDegistiginde: veriDegistiginde,
    buAyinVerisi: buAyinVerisi,
    bugununVerisi: bugununVerisi,
    gununIslemOzeti: gununIslemOzeti,
    fmt: fmt,
    hazirMi: function(){ return hazir; },
    bildirimVerisiDinlemeyeBasla: bildirimVerisiDinlemeyeBasla,
    bildirimOzetiHesapla: bildirimOzetiHesapla,
    bildirimDegistiginde: bildirimDegistiginde
  };

})();

IsTakipData.baslat();
