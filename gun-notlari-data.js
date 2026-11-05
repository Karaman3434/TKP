/*
  gun-notlari-data.js — TKP.05.11.26-21:30.1490
  =============================================
  ANA SAYFA TAKVİMİ — GÜNLÜK TEMAS DEFTERİ (05.11.2026, Abdullah onayı —
  "not defteri gibi giriş").

  Takvimde bir güne dokununca Ziyaret / Telefon / Mail / WhatsApp satırları
  çıkar; bir satıra dokununca açılan not defterine SERBEST METİN yazılır.
  Her (gün, tür) için TEK bir not metni tutulur; metindeki DOLU satır sayısı
  o günün o türdeki "not" sayısıdır (takvim rozeti ve Günün özeti buna bakar).
  Müşteriye bağlı eski temas kayıtları (CustomerData.ziyaretGecmisi) AYRI kalır
  ve bu modüle DOKUNULMAZ — görünüm tarafında (home-takvim-render.js) ikisi
  birlikte sayılır/gösterilir.

  SAKLAMA: localStorage (anında) + Firebase  ajanda/_temasNotlari/<YYYY-MM-DD>/<tur>
  Neden "ajanda" altı: database.rules.json'da yeni bir kök yol açılmasını
  gerektirmez (ajanda zaten okunur/yazılır; yazma sadece kısıtsız hesaplara
  açık). AjandaData bu "_temasNotlari" anahtarını tarih saymaz (filtrelendi).
*/
var GunNotlariData = (function(){

  var YOL = "ajanda/_temasNotlari";
  var ANAHTAR = "weiconv2_gun_notlari";
  var TURLER = ["ziyaret", "telefon", "mail", "whatsapp"];

  var veri = yerelOku();           // { "YYYY-MM-DD": { tur: "metin" } }
  var dinleyiciler = [];

  function yerelOku(){
    try{ var v = JSON.parse(localStorage.getItem(ANAHTAR) || "{}"); return (v && typeof v === "object") ? v : {}; }
    catch(e){ return {}; }
  }
  function yerelYaz(){
    try{ localStorage.setItem(ANAHTAR, JSON.stringify(veri)); }catch(e){}
  }
  function bildir(){
    dinleyiciler.forEach(function(fn){ try{ fn(); }catch(e){ console.error("GunNotlari dinleyici hatası:", e); } });
  }

  function baslat(){
    try{
      if(typeof firebase === "undefined") return;
      if(!firebase.apps.length && typeof ISTAKIP_FIREBASE_CONFIG !== "undefined"){ firebase.initializeApp(ISTAKIP_FIREBASE_CONFIG); }
      if(!firebase.apps.length) return;
      firebase.database().ref(YOL).on("value", function(snap){
        var v = snap.val();
        veri = (v && typeof v === "object") ? v : {};
        yerelYaz();
        bildir();
      }, function(err){
        console.error("Gün notları okunamadı:", err);
      });
    }catch(e){ console.error("GunNotlariData başlatılamadı:", e); }
  }

  function degistiginde(fn){
    if(typeof fn === "function" && dinleyiciler.indexOf(fn) === -1) dinleyiciler.push(fn);
  }

  function metin(tarih, tur){
    var g = veri[tarih];
    return (g && typeof g[tur] === "string") ? g[tur] : "";
  }

  function doluSatirSayisi(m){
    return String(m || "").split("\n").filter(function(s){ return s.trim() !== ""; }).length;
  }

  function satirSayisi(tarih, tur){ return doluSatirSayisi(metin(tarih, tur)); }

  // { "YYYY-MM-DD": { ziyaret:n, telefon:n, mail:n, whatsapp:n } } — sadece n>0 olanlar.
  function gunSayilari(){
    var sonuc = {};
    Object.keys(veri).forEach(function(tarih){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return;
      TURLER.forEach(function(t){
        var n = satirSayisi(tarih, t);
        if(n > 0){ (sonuc[tarih] = sonuc[tarih] || {})[t] = n; }
      });
    });
    return sonuc;
  }

  function gunToplam(tarih){
    var top = 0;
    TURLER.forEach(function(t){ top += satirSayisi(tarih, t); });
    return top;
  }

  // Metni kaydeder (boşsa düğümü siler). geriBildir(basarili, hata)
  function kaydet(tarih, tur, yeniMetin, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    if(TURLER.indexOf(tur) === -1 || !/^\d{4}-\d{2}-\d{2}$/.test(tarih)){ cb(false, new Error("Geçersiz gün/tür")); return; }
    var bos = String(yeniMetin || "").trim() === "";
    // Yerelde hemen güncelle (çevrimdışı/yavaş ağda da kaybolmasın).
    veri[tarih] = veri[tarih] || {};
    if(bos){ delete veri[tarih][tur]; if(!Object.keys(veri[tarih]).length) delete veri[tarih]; }
    else { veri[tarih][tur] = String(yeniMetin); }
    yerelYaz();
    bildir();
    try{
      if(typeof firebase === "undefined" || !firebase.apps.length){ cb(false, new Error("Firebase yok")); return; }
      var ref = firebase.database().ref(YOL + "/" + tarih + "/" + tur);
      var p = bos ? ref.remove() : ref.set(String(yeniMetin));
      p.then(function(){ cb(true); }).catch(function(err){ cb(false, err); });
    }catch(e){ cb(false, e); }
  }

  baslat();

  return {
    TURLER: TURLER,
    degistiginde: degistiginde,
    metin: metin,
    satirSayisi: satirSayisi,
    doluSatirSayisi: doluSatirSayisi,
    gunSayilari: gunSayilari,
    gunToplam: gunToplam,
    kaydet: kaydet
  };

})();
