/*
  maas-kayit-data.js
  ====================
  "Maaş + Prim Hesaplama" ekranındaki kapatılmış (kayıt edilmiş) ay
  kayıtlarını Firebase'de tutar. Her kayıt, o dönemde kullanılan
  brütPrim'i VE o an Ödenebilir Komisyon toplamının ne olduğunu
  (komisyonReferansToplam) saklar — bir SONRAKİ dönemin brüt primi,
  güncel komisyon toplamından bu referans çıkarılarak otomatik bulunur.
*/

var MaasKayitData = (function(){

  var kayitlar = {}; // anahtar: "YYYY-AA" -> kayıt
  var dinleyiciler = [];
  var kayitlarYuklendi = false;

  function baslat(){
    try{
      if(!firebase.apps.length){ firebase.initializeApp(ISTAKIP_FIREBASE_CONFIG); }
      firebase.database().ref("maasKayitlari").on("value", function(snap){
        kayitlar = snap.val() || {};
        kayitlarYuklendi = true;
        dinleyiciler.forEach(function(fn){
          try{ fn(); }catch(e){ console.error("Maaş kayıt dinleyici hatası:", e); }
        });
      }, function(err){
        console.error("Maaş kayıtları okunamadı:", err);
      });
    }catch(e){ console.error("MaasKayitData başlatılamadı:", e); }
  }

  function degistiginde(fn){
    if(typeof fn === "function" && dinleyiciler.indexOf(fn)===-1) dinleyiciler.push(fn);
  }

  function kayitlarYuklendiMi(){ return kayitlarYuklendi; }

  // Kayıtları YENİDEN ESKİYE sıralı döndürür (anahtar "YYYY-AA" formatında
  // olduğu için string sort = kronolojik sort).
  function tumKayitlar(){
    return Object.keys(kayitlar)
      .sort()
      .reverse()
      .map(function(k){ var o = Object.assign({anahtar:k}, kayitlar[k]); return o; });
  }

  // Henüz kayıt edilmemiş, şu an üzerinde çalışılan "açık dönem"i bulur:
  // en son kayıtlı ayın bir sonrası. Hiç kayıt yoksa BİR ÖNCEKİ ayı açık
  // dönem sayar — çünkü bir ay, o ay bittikten SONRA kapatılır (bugün 1
  // Eylülse, kapatılacak olan Ağustos'tur, henüz başlamamış Eylül değil).
  function acikDonem(){
    var liste = tumKayitlar();
    var simdi = new Date();
    if(!liste.length){
      var ay = simdi.getMonth(); // getMonth() 0-index olduğu için zaten "bir önceki ay" (1-index karşılığı)
      var yil = simdi.getFullYear();
      if(ay < 1){ ay = 12; yil -= 1; }
      return {ay: ay, yil: yil};
    }
    var son = liste[0];
    var ay2 = (son.ay||simdi.getMonth()+1) + 1, yil2 = son.yil||simdi.getFullYear();
    if(ay2 > 12){ ay2 = 1; yil2 += 1; }
    return {ay: ay2, yil: yil2};
  }

  // Bir sonraki dönemin brüt primini bulmak için referans noktası: en son
  // kayıtta o an geçerli olan Ödenebilir Komisyon TOPLAMI. Hiç kayıt yoksa 0
  // (yani ilk dönemde brüt prim = güncel komisyon toplamının tamamı).
  function sonReferansKomisyonToplami(){
    var liste = tumKayitlar();
    return liste.length ? (liste[0].komisyonReferansToplam || 0) : 0;
  }

  function kaydet(kayitObj, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      if(!kayitObj || !kayitObj.ay || !kayitObj.yil) throw new Error("Ay/yıl eksik.");
      var anahtar = kayitObj.yil + "-" + ("0"+kayitObj.ay).slice(-2);
      firebase.database().ref("maasKayitlari/" + anahtar).set(kayitObj)
        .then(function(){ cb(true); }).catch(function(err){ cb(false, err); });
    }catch(e){ cb(false, e); }
  }

  function kaydiSil(anahtar, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      firebase.database().ref("maasKayitlari/" + anahtar).remove()
        .then(function(){ cb(true); }).catch(function(err){ cb(false, err); });
    }catch(e){ cb(false, e); }
  }

  baslat();

  return {
    degistiginde: degistiginde,
    kayitlarYuklendiMi: kayitlarYuklendiMi,
    tumKayitlar: tumKayitlar,
    acikDonem: acikDonem,
    sonReferansKomisyonToplami: sonReferansKomisyonToplami,
    kaydet: kaydet,
    kaydiSil: kaydiSil
  };

})();
