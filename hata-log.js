/*
  hata-log.js
  ===========
  Merkezi hata kaydı — programın HERHANGİ bir sayfasında bir hata
  gösterildiğinde (hataGoster çağrıldığında), bu hata sessizce Firebase'e
  de yazılır (hatalar/ yolu altında). Amaç: kur API'sinin haftalarca
  sessizce bozulması, dip fiyat hatası gibi "fark edilene kadar hiçbir
  yerde görünmeyen" sorunları erken yakalayabilmek — Menü → Hata
  Kayıtları'ndan geriye dönüp son 30 günde neyin bozulduğunu görebilmek.

  Bu dosya kendi başına bir sayfa akışını ASLA bozmaz — Firebase'e yazma
  başarısız olsa bile (offline, izin sorunu vb.) sessizce yutulur, hiçbir
  şekilde kullanıcıya ek bir hata göstermez veya sayfayı durdurmaz.
*/

var HataLog = (function(){

  var MAX_KAYIT = 300; // bundan fazlası birikirse en eskiler otomatik silinir
  var kirpmaKontrolEdildi = false;

  function sayfaAdi(){
    try{
      return (window.location.pathname.split("/").pop() || "bilinmeyen").replace(".html","");
    }catch(e){ return "bilinmeyen"; }
  }

  function kaydet(mesaj, ekBilgi){
    try{
      if(typeof firebase === "undefined") return;
      if(!firebase.apps.length){ firebase.initializeApp(ISTAKIP_FIREBASE_CONFIG); }
      var db = firebase.database();
      var simdi = new Date();
      var kayit = {
        mesaj: String(mesaj||"").slice(0, 500),
        sayfa: sayfaAdi(),
        zaman: simdi.getTime(),
        tarih: simdi.toLocaleString("tr-TR", {timeZone:"Europe/Istanbul"}),
        ek: ekBilgi ? String(ekBilgi).slice(0, 300) : null
      };
      db.ref("hatalar").push(kayit);

      // Sadece nadiren (yaklaşık her 20 hatada bir) eski kayıtları kırp —
      // her hata kaydında tüm listeyi okuyup kırpmak gereksiz trafik olur.
      if(!kirpmaKontrolEdildi && Math.random() < 0.05){
        kirpmaKontrolEdildi = true;
        db.ref("hatalar").limitToLast(MAX_KAYIT + 50).once("value").then(function(snap){
          var veri = snap.val();
          if(!veri) return;
          var anahtarlar = Object.keys(veri);
          if(anahtarlar.length <= MAX_KAYIT) return;
          anahtarlar.sort(function(a,b){ return (veri[a].zaman||0) - (veri[b].zaman||0); });
          var silinecekler = anahtarlar.slice(0, anahtarlar.length - MAX_KAYIT);
          var guncelleme = {};
          silinecekler.forEach(function(k){ guncelleme[k] = null; });
          db.ref("hatalar").update(guncelleme);
        }).catch(function(){});
      }
    }catch(e){
      // Hata kaydı bile başarısız olsa sayfa akışını ASLA bozma — sadece konsola yaz.
      console.error("Hata kaydedilemedi:", e);
    }
  }

  return { kaydet: kaydet };
})();
