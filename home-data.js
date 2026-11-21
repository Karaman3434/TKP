/* home-data.js — TKP.11.11.26-14:20.1566 */
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
        // Aynı "arsiv" ağacı artık tek Firebase value dinleyicisiyle
        // hem ana sayfa satış kartlarını hem takvim/bildirim verisini besler.
        ["numune","teklif","proforma","siparis"].forEach(function(t){
          var liste = data && data[t];
          arsivHamData[t] = liste ? (Array.isArray(liste) ? liste.filter(Boolean) : Object.values(liste)) : [];
        });
        hazir = true;
        dinleyiciler.forEach(function(fn){ try{ fn(); }catch(e){ console.error("Arşiv dinleyicisi hatası:", e); } });
        bildirimDinleyicileri.forEach(function(fn){ try{ fn(); }catch(e){ console.error("Bildirim dinleyicisi hatası:", e); } });
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

  // Aylık ve günlük satış/prim kartları için arşiv siparişlerini tek taramada hesaplar.
  // Aynı arşiv ve ürün satırlarının ayrı ayrı taranması önlenir.
  function satisOzetleriniHesapla(){
    var now = new Date(), buAyAd = AYLAR[now.getMonth()], buYil = now.getFullYear().toString();
    var isGunu = buGununIsGunuTarihi(), gunNo = isGunu ? isGunu.getDate().toString() : "";
    var gunAyAd = isGunu ? AYLAR[isGunu.getMonth()] : "", gunYil = isGunu ? isGunu.getFullYear().toString() : "";
    var ay = {ayAd:buAyAd, yil:buYil, toplamEuro:0, toplamEuroTl:0, toplamPrim:0};
    var bugun = {toplamEuro:0, toplamEuroTl:0, toplamPrim:0, aktifMi:!!isGunu};
    var siparisler = arsivData.siparis || [];
    for(var i=0;i<siparisler.length;i++){
      var k = siparisler[i];
      if(!k.tarih || k.durum === "beklemede") continue;
      var parca = k.tarih.split(" "), kayitGun = parca[0]||"", kayitAy = parca[1]||"", kayitYil = parca[2]||"";
      var ayEslesir = kayitAy===buAyAd && kayitYil===buYil;
      var gunEslesir = bugun.aktifMi && kayitGun===gunNo && kayitAy===gunAyAd && kayitYil===gunYil;
      if(!ayEslesir && !gunEslesir) continue;
      var kur = k.kur || guncelKurYedek();
      if(!k.urunler) continue;
      for(var j=0;j<k.urunler.length;j++){
        var u = k.urunler[j], euro = u.toplamEuro||0, euroTl = euro*kur;
        var mk = (u.iskBirim||0)-(u.dipFiyat||0);
        var satirPrimi = ((u.iskonto||0)>60) ? 0 : mk*(u.adet||1)*0.22;
        var primTl = satirPrimi>0 ? satirPrimi*kur : 0;
        if(ayEslesir){ ay.toplamEuro+=euro; ay.toplamEuroTl+=euroTl; ay.toplamPrim+=primTl; }
        if(gunEslesir){ bugun.toplamEuro+=euro; bugun.toplamEuroTl+=euroTl; bugun.toplamPrim+=primTl; }
      }
    }
    return {ay:ay, bugun:bugun};
  }
  function buAyinVerisi(){ return satisOzetleriniHesapla().ay; }
  function bugununVerisi(){ return satisOzetleriniHesapla().bugun; }

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

  // (05.11.2026) Takvim rozeti için: {"YYYY-AA-GG": işlemSayısı} — numune/teklif/
  // proforma/sipariş kayıtlarının günlük toplamı (gununIslemOzeti ile aynı kaynak).
  function gunlukIslemSayilari(){
    var sonuc = {};
    ["numune","teklif","proforma","siparis"].forEach(function(tip){
      (arsivHamData[tip] || []).forEach(function(k){
        // Ziyaret Takvimi sayfası (ReportsData.sonIslemler) gün sayımını k.ts'ten yapar —
        // aynı sayı çıksın diye önce ts, yoksa "5 Kas 2026" metni kullanılır.
        var a = null;
        if(k.ts){
          var dt = new Date(k.ts);
          a = dt.getFullYear() + "-" + String(dt.getMonth()+1).padStart(2,"0") + "-" + String(dt.getDate()).padStart(2,"0");
        } else if(k.tarih){
          var p = k.tarih.split(" ");
          var ayNo = AYLAR.indexOf(p[1]);
          var gun = parseInt(p[0], 10), yil = parseInt(p[2], 10);
          if(ayNo < 0 || !gun || !yil) return;
          a = yil + "-" + String(ayNo+1).padStart(2,"0") + "-" + String(gun).padStart(2,"0");
        }
        if(!a) return;
        sonuc[a] = (sonuc[a] || 0) + 1;
      });
    });
    return sonuc;
  }

  // (05.11.2026) Temas penceresindeki "İŞLEMLER" satırları: seçili günün numune/teklif/proforma/sipariş kayıtları.
  function gunIslemleri(anahtar){
    var TIP_AD = TipEtiket.kisa; // 08.11.2026: tek kaynak (tip-etiketleri.js)
    var sonuc = [];
    ["numune","teklif","proforma","siparis"].forEach(function(tip){
      (arsivHamData[tip] || []).forEach(function(k){
        var a = null;
        if(k.ts){
          var dt = new Date(k.ts);
          a = dt.getFullYear() + "-" + String(dt.getMonth()+1).padStart(2,"0") + "-" + String(dt.getDate()).padStart(2,"0");
        }
        if(a === anahtar) sonuc.push({tip:tip, tipAd:TIP_AD[tip], ts:k.ts, musteri:k.musteri, kod:k.kod});
      });
    });
    sonuc.sort(function(x, y){ return y.ts - x.ts; });
    return sonuc;
  }

  function guncelKurYedek(){
    var v = parseFloat(localStorage.getItem("weicon_kur"));
    return isNaN(v) ? 0 : v;
  }

  function fmt(n){
    return (n||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2});
  }

  var arsivHamData = {numune:[], teklif:[], proforma:[], siparis:[]};
  var bildirimDinleyicileri = [];

  // "arsiv" verisi baslat() içindeki ortak dinleyiciden gelir; ikinci
  // Firebase aboneliği açılmaz. Fonksiyon API'si geriye uyumluluk için korunur.
  function bildirimVerisiDinlemeyeBasla(){
    bildirimDinlemeBasladi = true;
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
    return {acikSurecSayisi:acikSurecSayisi, gecikmisGorevSayisi:0, toplam:acikSurecSayisi};
  }

  function bildirimDegistiginde(fn){
    if(typeof fn !== "function") return;
    if(bildirimDinleyicileri.indexOf(fn) === -1) bildirimDinleyicileri.push(fn);
  }

  return {
    baslat: baslat,
    veriDegistiginde: veriDegistiginde,
    satisOzetleriniHesapla: satisOzetleriniHesapla,
    buAyinVerisi: buAyinVerisi,
    bugununVerisi: bugununVerisi,
    gununIslemOzeti: gununIslemOzeti,
    gunlukIslemSayilari: gunlukIslemSayilari,
    gunIslemleri: gunIslemleri,
    fmt: fmt,
    hazirMi: function(){ return hazir; },
    bildirimVerisiDinlemeyeBasla: bildirimVerisiDinlemeyeBasla,
    bildirimOzetiHesapla: bildirimOzetiHesapla,
    bildirimDegistiginde: bildirimDegistiginde
  };

})();

IsTakipData.baslat();
