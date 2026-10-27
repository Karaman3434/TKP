/*
  komisyon-donem-data.js — VERSİYON: WG.271026.2238.1126
  ==========================================================
  27.09.2026 yeniden tasarım: Ödenebilir Komisyon artık serbest tarihli
  kayıt listesi (eski KomisyonData / odenebilir-komisyon-data.js) yerine,
  SADECE açık maaş dönemi için "1. Fotoğraf" ve "2. Fotoğraf" adında iki
  sabit slot tutar. Abdullah ay başında 1. Fotoğraf'ı, ay içinde/sonunda
  (istediği kadar kez) 2. Fotoğraf'ı günceller — Brüt Prim, ikisi
  arasındaki farktan (aynı ay için, ay karışıklığı OLMADAN) otomatik
  hesaplanır. Ay kapanınca (Maaş Hesaplama'dan) yeni açık döneme
  geçildiğinde bu iki slot otomatik sıfırlanır — eski fotoğraflar
  saklanmaz, sadece o anki iki fotoğrafın kendisi (JPEG, sıkıştırılmış)
  ve OCR'dan çıkan 12 sayı Firebase'de tutulur.
*/

var KomisyonDonemData = (function(){

  var veri = null; // {donemAnahtari, birinci, ikinci}
  var dinleyiciler = [];
  var yuklendi = false;

  function baslat(){
    try{
      if(!firebase.apps.length){ firebase.initializeApp(ISTAKIP_FIREBASE_CONFIG); }
      firebase.database().ref("odenebilirKomisyonDonem").on("value", function(snap){
        veri = snap.val() || null;
        yuklendi = true;
        dinleyiciler.forEach(function(fn){
          try{ fn(); }catch(e){ console.error("Komisyon dönem dinleyici hatası:", e); }
        });
      }, function(err){
        console.error("Ödenebilir komisyon dönemi okunamadı:", err);
      });
    }catch(e){ console.error("KomisyonDonemData başlatılamadı:", e); }
  }

  function degistiginde(fn){
    if(typeof fn === "function" && dinleyiciler.indexOf(fn)===-1) dinleyiciler.push(fn);
  }

  function yuklendiMi(){ return yuklendi; }
  function gecerliDonem(){ return veri; }
  function donemAnahtariUret(ay, yil){ return yil + "-" + ("0"+ay).slice(-2); }

  // Açık maaş dönemi (ay/yıl) ile şu an saklanan donemAnahtari farklıysa —
  // yani bir önceki ay kapatılıp yenisi açıldıysa — 1./2. Fotoğraf'ı
  // otomatik sıfırlar (yeni dönem boş kutularla başlar).
  function acikDonemleSenkronizeEt(acikAy, acikYil, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    if(!yuklendi){ cb(false); return; }
    var beklenen = donemAnahtariUret(acikAy, acikYil);
    if(veri && veri.donemAnahtari === beklenen){ cb(false); return; }
    firebase.database().ref("odenebilirKomisyonDonem").set({donemAnahtari: beklenen, birinci: null, ikinci: null})
      .then(function(){ cb(true); }).catch(function(err){ console.error("Komisyon dönemi sıfırlanamadı:", err); cb(false, err); });
  }

  // slot: "birinci" | "ikinci". kayit: {tarih, aylar, resim(dataURL|null), kayitZamani}
  function slotKaydet(donemAnahtari, slot, kayit, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      var patch = {donemAnahtari: donemAnahtari};
      patch[slot] = kayit;
      firebase.database().ref("odenebilirKomisyonDonem").update(patch)
        .then(function(){ cb(true); }).catch(function(err){ cb(false, err); });
    }catch(e){ cb(false, e); }
  }

  function slotSil(slot, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      firebase.database().ref("odenebilirKomisyonDonem/" + slot).remove()
        .then(function(){ cb(true); }).catch(function(err){ cb(false, err); });
    }catch(e){ cb(false, e); }
  }

  baslat();

  return {
    degistiginde: degistiginde,
    yuklendiMi: yuklendiMi,
    gecerliDonem: gecerliDonem,
    donemAnahtariUret: donemAnahtariUret,
    acikDonemleSenkronizeEt: acikDonemleSenkronizeEt,
    slotKaydet: slotKaydet,
    slotSil: slotSil
  };

})();
