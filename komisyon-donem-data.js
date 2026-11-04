/*
  komisyon-donem-data.js — VERSİYON: TKP.04.11.26-16:22.1471
  ==========================================================
  27.09.2026 yeniden tasarım: Ödenebilir Komisyon artık serbest tarihli
  kayıt listesi (eski KomisyonData / odenebilir-komisyon-data.js) yerine,
  SADECE açık maaş dönemi için "1. Fotoğraf" ve "2. Fotoğraf" adında iki
  sabit slot tutar. Abdullah ay başında 1. Fotoğraf'ı, ay içinde/sonunda
  (istediği kadar kez) 2. Fotoğraf'ı günceller — Brüt Prim, ikisi
  arasındaki farktan (aynı ay için, ay karışıklığı OLMADAN) otomatik
  hesaplanır. Ay kapanınca (Maaş Hesaplama'dan) yeni açık döneme
  geçildiğinde bu iki slot otomatik sıfırlanır — eski fotoğraflar
  saklanmaz (02.11.2026'dan itibaren kapanan dönem komisyonArsiv'e arşivlenir), sadece o anki iki fotoğrafın kendisi (JPEG, sıkıştırılmış)
  ve OCR'dan çıkan 12 sayı Firebase'de tutulur.

  04.11.2026 (Abdullah onayı — mockup): FOTOĞRAF/OCR KALDIRILDI. "birinci" =
  AY BAŞI, "ikinci" = AY SONU; her ikisi de {tarih, tutar, aylar:{1:tutar},
  kayitZamani} — "aylar" alanı eski şekille aynı kaldığı için maas-ortak-hesap.js
  (ikinci toplamı − birinci toplamı) HİÇ DEĞİŞMEDEN çalışır. Dönem kapanırken
  eski dönemin AY SONU, yeni dönemin AY BAŞI olarak otomatik devredilir.
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
    var eski = veri;
    // 02.11.2026 (Abdullah: "geçmiş ayın kağıdını göremiyorum"): sıfırlamadan
    // ÖNCE kapanan dönemin 1./2. Fotoğraf + ekstra primi arşive yazılır
    // (komisyonArsiv/{YYYY-AA}); Ödenebilir Komisyon'da ‹ ile geçmiş aya
    // gidince görülür. Arşiv yazılamazsa (kural/ağ) sıfırlama YİNE DE yapılır —
    // yeni ay hiçbir zaman eski ayın verisiyle takılı kalmaz.
    arsivle(eski, function(){
      // 04.11.2026: kapanan dönemin AY SONU → yeni dönemin AY BAŞI (devir).
      var yeni = {donemAnahtari: beklenen, birinci: null, ikinci: null};
      try{
        if(eski && eski.ikinci && eski.ikinci.tarih){
          var devirTutar = kayitTutar(eski.ikinci);
          yeni.birinci = {tarih: eski.ikinci.tarih, tutar: devirTutar, aylar: {1: devirTutar}, devir: true, kayitZamani: Date.now()};
        }
      }catch(e){ console.error("Komisyon devri hazırlanamadı:", e); }
      firebase.database().ref("odenebilirKomisyonDonem").set(yeni)
        .then(function(){ cb(true); }).catch(function(err){ console.error("Komisyon dönemi sıfırlanamadı:", err); cb(false, err); });
    });
  }

  // Bir kaydın (ay başı / ay sonu) tutarı: yeni kayıtlarda "tutar", eski
  // (fotoğraf dönemi) kayıtlarda 12 ayın toplamı.
  function kayitTutar(kayit){
    if(!kayit) return 0;
    if(kayit.tutar !== undefined && kayit.tutar !== null) return parseFloat(kayit.tutar) || 0;
    var t = 0;
    for(var ay=1; ay<=12; ay++) t += parseFloat(kayit.aylar && kayit.aylar[ay]) || 0;
    return t;
  }

  // Kapanan dönemin içeriğini arşive yazar (içerik yoksa yazmaz).
  function arsivle(eski, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      if(!eski || !eski.donemAnahtari || !(eski.birinci || eski.ikinci || eski.ekstraPrimler)){ cb(false); return; }
      var kopya = JSON.parse(JSON.stringify(eski));
      kopya.arsivZamani = Date.now();
      firebase.database().ref("komisyonArsiv/" + eski.donemAnahtari).set(kopya)
        .then(function(){ cb(true); })
        .catch(function(err){ console.error("Komisyon arşivi yazılamadı:", err); cb(false, err); });
    }catch(e){ console.error("Komisyon arşivi hatası:", e); cb(false, e); }
  }

  // Geçmiş bir dönemin arşivini okur (sadece o dönem görüntülenirken —
  // fotoğraflar büyük olduğundan canlı dinleyiciye dahil edilmez).
  function arsivOku(donemAnahtari, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      firebase.database().ref("komisyonArsiv/" + donemAnahtari).once("value")
        .then(function(snap){ cb(snap.val() || null); })
        .catch(function(err){ console.error("Komisyon arşivi okunamadı:", err); cb(null, err); });
    }catch(e){ cb(null, e); }
  }

  // slot: "birinci" (ay başı) | "ikinci" (ay sonu). kayit: {tarih, tutar, aylar:{1:tutar}, kayitZamani}
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

  /* ---------- EKSTRA PRİM (02.11.2026, Abdullah onayı — mockup üzerinden) ----------
     Fotoğraf farkından bağımsız, ELLE girilen ekstra prim satırları
     (açıklama + tutar). Brüt Prim'e eklenir (bkz. maas-ortak-hesap.js).
     1./2. Fotoğraf ile AYNI düğümde (odenebilirKomisyonDonem/ekstraPrimler)
     durur; ay kapanıp dönem sıfırlanınca (acikDonemleSenkronizeEt, düğümü
     baştan yazar) onlarla birlikte otomatik sıfırlanır. */
  function ekstraListe(){
    var o = (veri && veri.ekstraPrimler) || {};
    return Object.keys(o).map(function(id){
      return {id: id, aciklama: o[id].aciklama || "", tutar: parseFloat(o[id].tutar) || 0, zaman: o[id].zaman || 0};
    }).sort(function(a,b){ return a.zaman - b.zaman; });
  }
  function ekstraToplam(){
    return ekstraListe().reduce(function(t, x){ return t + x.tutar; }, 0);
  }
  function ekstraEkle(donemAnahtari, aciklama, tutar, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      var t = parseFloat(tutar);
      if(!(t > 0)) throw new Error("Tutar 0'dan büyük olmalı.");
      var ref = firebase.database().ref("odenebilirKomisyonDonem");
      var id = ref.child("ekstraPrimler").push().key;
      var patch = {donemAnahtari: donemAnahtari};
      patch["ekstraPrimler/" + id] = {aciklama: String(aciklama||"").trim(), tutar: t, zaman: Date.now()};
      ref.update(patch).then(function(){ cb(true); }).catch(function(err){ cb(false, err); });
    }catch(e){ cb(false, e); }
  }
  function ekstraSil(id, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      firebase.database().ref("odenebilirKomisyonDonem/ekstraPrimler/" + id).remove()
        .then(function(){ cb(true); }).catch(function(err){ cb(false, err); });
    }catch(e){ cb(false, e); }
  }

  baslat();

  return {
    kayitTutar: kayitTutar,
    ekstraListe: ekstraListe,
    ekstraToplam: ekstraToplam,
    ekstraEkle: ekstraEkle,
    ekstraSil: ekstraSil,
    degistiginde: degistiginde,
    yuklendiMi: yuklendiMi,
    gecerliDonem: gecerliDonem,
    donemAnahtariUret: donemAnahtariUret,
    acikDonemleSenkronizeEt: acikDonemleSenkronizeEt,
    arsivOku: arsivOku,
    slotKaydet: slotKaydet,
    slotSil: slotSil
  };

})();
