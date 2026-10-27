/*
  odenebilir-komisyon-data.js
  ============================
  Merkez ofisin programındaki (engomoweb) "Ödenebilir Komisyon" tablosunun
  haftalık/istediğin sıklıkta çekilen anlık görüntülerini (12 aylık rakam +
  tarih) Firebase'e kaydeder. Amaç: iki farklı tarih arasındaki farkı
  görüp, hangi ayın satışından o hafta ödeme geldiğini anlayabilmek.
  Kaynak fotoğraf/ekran görüntüsü ASLA saklanmaz — sadece OCR'dan geçip
  kullanıcının gözden geçirip onayladığı 12 sayı ve tarih kaydedilir.
*/

var KomisyonData = (function(){

  var kayitlar = {}; // anahtar: "YYYY-MM-DD" -> {tarih, aylar:{1:..,2:..,...,12:..}, kayitZamani}
  var dinleyiciler = [];

  function baslat(){
    try{
      if(!firebase.apps.length){ firebase.initializeApp(ISTAKIP_FIREBASE_CONFIG); }
      firebase.database().ref("odenebilirKomisyon").on("value", function(snap){
        kayitlar = snap.val() || {};
        dinleyiciler.forEach(function(fn){
          try{ fn(); }catch(e){ console.error("Komisyon dinleyici hatası:", e); }
        });
      }, function(err){
        console.error("Ödenebilir komisyon okunamadı:", err);
      });
    }catch(e){ console.error("KomisyonData başlatılamadı:", e); }
  }

  function degistiginde(fn){
    if(typeof fn === "function" && dinleyiciler.indexOf(fn)===-1) dinleyiciler.push(fn);
  }

  // Kayıtları tarihe göre YENİDEN ESKİYE sıralı döndürür.
  function tumKayitlar(){
    return Object.keys(kayitlar)
      .sort()
      .reverse()
      .map(function(k){ return Object.assign({anahtar:k}, kayitlar[k]); });
  }

  function kaydiOku(anahtar){ return kayitlar[anahtar] || null; }

  // aylar: {1:40655.00, 2:30961.04, ..., 12:0} — 12 anahtarın hepsi
  // (sayı olmayan/boş bırakılanlar 0 kabul edilir) zorunlu.
  function kaydet(tarihAnahtari, aylar, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      if(!tarihAnahtari) throw new Error("Tarih eksik.");
      var temizAylar = {};
      for(var ay=1; ay<=12; ay++){
        var v = parseFloat(aylar[ay]);
        temizAylar[ay] = isNaN(v) ? 0 : v;
      }
      var db = firebase.database();
      db.ref("odenebilirKomisyon/" + tarihAnahtari).set({
        tarih: tarihAnahtari,
        aylar: temizAylar,
        kayitZamani: Date.now()
      }).then(function(){ cb(true); }).catch(function(err){ cb(false, err); });
    }catch(e){ cb(false, e); }
  }

  function kaydiSil(tarihAnahtari, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      firebase.database().ref("odenebilirKomisyon/" + tarihAnahtari).remove()
        .then(function(){ cb(true); }).catch(function(err){ cb(false, err); });
    }catch(e){ cb(false, e); }
  }

  baslat();

  return {
    degistiginde: degistiginde,
    tumKayitlar: tumKayitlar,
    kaydiOku: kaydiOku,
    kaydet: kaydet,
    kaydiSil: kaydiSil
  };
})();
