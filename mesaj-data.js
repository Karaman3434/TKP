/*
  mesaj-data.js
  =============
  Mesaj Ayarları — TAMAMEN MANUEL sistem (WG.271026.2238.1139).

  Kural: Mesaj Ayarları ekranında yazılan mail ve WhatsApp metinleri,
  otomatik "Merhaba," satırı veya otomatik "NOT:" ekleme OLMADAN, YAZILDIĞI
  GİBİ Gönder ekranında görünür ve gönderilir. Boş bırakmak da serbesttir.
  HAREKET/BELGE yer tutucuları hâlâ destekleniyor (aşağıda), ama artık her
  hareketin KENDİ metni olduğu için genelde gerek kalmıyor.

  GÜNCELLEME (07.10.2026, Abdullah'ın isteğiyle): metin artık TEK/ORTAK
  değil — NUMUNE / FİYAT TEKLİFİ / PROFORMA FATURA / SİPARİŞ'in HER BİRİNİN
  kendi mail metni VE kendi WhatsApp metni var, Mesaj Ayarları'nda üstteki
  hareket seçiciyle ayrı ayrı düzenlenip kaydediliyor. Birini değiştirmek
  diğerlerini ETKİLEMİYOR.
  Saklama şekli: {tip: {mail: "...", whatsapp: "..."}} (önceki düz
  {mail:"...", whatsapp:"..."} şeklinden farklı — eski kayıt varsa aşağıdaki
  eskiVeriyiTasi() onu 4 harekete de aynen kopyalayıp bir daha dokunmuyor,
  hiçbir eski metin kaybolmuyor).

  Saklama: localStorage + Firebase (mesajSablonlari/metinler/<tip>/<kanal> —
  mevcut Firebase kuralı zaten bu yolu kapsıyor, kural değişikliği gerekmez).
  Eski sistemin {FIRMA}/{BELGE_ESKI} yer tutuculu kayıtları KULLANILMAZ
  (temiz başlangıç); yeni kayıt yolu eski kayıtlara dokunmaz.
*/
var MesajData = (function(){

  var ANAHTAR = "weiconv2_mesaj_metinleri";
  var YOL = "mesajSablonlari/metinler";
  var KANALLAR = ["mail", "whatsapp"];
  var TIPLER = ["numune", "teklif", "proforma", "siparis"];

  // Hiç kayıt yapılmamışken başlangıç metni — sadece bir başlangıç noktası,
  // Mesaj Ayarları'nda istenildiği gibi değiştirilip kaydedilir. Tüm
  // hareketler için AYNI başlangıç metniyle başlar, sonra birbirinden
  // bağımsız şekilde değiştirilebilir.
  var VARSAYILAN = {
    mail: "Merhaba,\nBilgilerini paylaştığım Firma için HAREKET göndermenizi rica ederim. BELGE formu ektedir.",
    whatsapp: "Merhaba,\nİstediğiniz ürün için fiyat bilgisi ektedir."
  };

  function yerelOkuHam(){
    try{ var v = JSON.parse(localStorage.getItem(ANAHTAR)||"{}"); return (v && typeof v==="object") ? v : {}; }
    catch(e){ return {}; }
  }
  function yerelYaz(v){
    try{ localStorage.setItem(ANAHTAR, JSON.stringify(v)); }catch(e){}
  }

  // GÖÇ (07.10.2026): eski saklama şekli {mail:"...", whatsapp:"..."} düz
  // yapıdaydı (tüm hareketler ortaktı). Bu şekilde kayıt bulunursa, HER
  // hareketin başlangıç metni olarak bir kez kopyalanır (hiçbir yazılmış
  // metin kaybolmaz), sonra eski düz alanlar silinir. Tek seferlik — yeni
  // yapıya geçtikten sonra bir daha çalışmaz (TIPLER'den biri zaten varsa
  // dokunmaz).
  function eskiVeriyiTasiGerekirse(y){
    var zatenYeniYapida = TIPLER.some(function(t){ return y[t] && typeof y[t] === "object"; });
    if(zatenYeniYapida) return y;
    var eskiMail = Object.prototype.hasOwnProperty.call(y, "mail") ? y.mail : null;
    var eskiWhatsapp = Object.prototype.hasOwnProperty.call(y, "whatsapp") ? y.whatsapp : null;
    if(eskiMail == null && eskiWhatsapp == null) return y;
    TIPLER.forEach(function(t){
      y[t] = {};
      if(eskiMail != null) y[t].mail = String(eskiMail);
      if(eskiWhatsapp != null) y[t].whatsapp = String(eskiWhatsapp);
    });
    delete y.mail;
    delete y.whatsapp;
    yerelYaz(y);
    return y;
  }

  function yerelOku(){
    return eskiVeriyiTasiGerekirse(yerelOkuHam());
  }

  function fbHazirla(){
    if(typeof firebase === "undefined") return null;
    if(!firebase.apps.length && typeof ISTAKIP_FIREBASE_CONFIG !== "undefined"){ firebase.initializeApp(ISTAKIP_FIREBASE_CONFIG); }
    return firebase.apps.length ? firebase.database() : null;
  }

  // HAREKET = belirtme hâli ("...HAREKET göndermenizi rica ederim" -> "...Siparişi göndermenizi rica ederim")
  // BELGE   = yalın hâl     ("BELGE formu ektedir" -> "Sipariş formu ektedir")
  var HAREKET_ADLARI = {siparis:"Siparişi", teklif:"Fiyat teklifini", proforma:"Proforma faturayı", numune:"Numuneyi"};
  var BELGE_ADLARI = {siparis:"Sipariş", teklif:"Fiyat teklifi", proforma:"Proforma fatura", numune:"Numune"};

  // Metindeki (büyük harf, birebir) HAREKET/BELGE kelimelerini işlem adıyla değiştirir.
  function uygula(metin, tip){
    var hareket = HAREKET_ADLARI[tip];
    var belge = BELGE_ADLARI[tip];
    var sonuc = String(metin);
    if(hareket) sonuc = sonuc.split("HAREKET").join(hareket);
    if(belge) sonuc = sonuc.split("BELGE").join(belge);
    return sonuc;
  }

  // Kaydedilmiş metin varsa (boş bile olsa) onu, hiç kayıt yoksa başlangıç
  // metnini döndürür. tip verilmezse (eski çağrı biçimiyle uyumluluk için)
  // "siparis" varsayılır.
  function oku(kanal, tip){
    var t = tip || "siparis";
    var y = yerelOku();
    var tipVerisi = y[t] || {};
    return Object.prototype.hasOwnProperty.call(tipVerisi, kanal) ? String(tipVerisi[kanal]) : VARSAYILAN[kanal];
  }

  // Metni OLDUĞU GİBİ (kırpmadan, değiştirmeden) kaydeder. sonuc(fbBasarili, hata)
  function kaydet(kanal, tip, metin, sonuc){
    var t = tip || "siparis";
    var y = yerelOku();
    if(!y[t] || typeof y[t] !== "object") y[t] = {};
    y[t][kanal] = String(metin);
    yerelYaz(y);
    try{
      var db = fbHazirla();
      if(!db){ if(sonuc) sonuc(false, new Error("Firebase yok")); return; }
      db.ref(YOL + "/" + t + "/" + kanal).set({t: String(metin), z: Date.now()}).then(
        function(){ if(sonuc) sonuc(true); },
        function(e){ if(sonuc) sonuc(false, e); }
      );
    }catch(e){ if(sonuc) sonuc(false, e); }
  }

  // Firebase'deki güncel metinleri yerele çeker (başka cihazda yapılan değişiklik gelsin diye).
  function tazele(bitince){
    var bitti = false;
    function son(){ if(bitti) return; bitti = true; if(bitince) bitince(); }
    try{
      var db = fbHazirla();
      if(!db){ son(); return; }
      var gorev = false;
      var kapat = firebase.auth().onAuthStateChanged(function(u){
        if(!u || gorev) return;
        gorev = true;
        try{ if(typeof kapat === "function") kapat(); }catch(e){}
        db.ref(YOL).once("value").then(function(snap){
          var v = snap.val() || {};
          var y = yerelOku();
          TIPLER.forEach(function(t){
            var tipVerisi = v[t];
            if(!tipVerisi || typeof tipVerisi !== "object") return;
            if(!y[t] || typeof y[t] !== "object") y[t] = {};
            KANALLAR.forEach(function(k){
              if(tipVerisi[k] && typeof tipVerisi[k] === "object"){ y[t][k] = (tipVerisi[k].t == null) ? "" : String(tipVerisi[k].t); }
            });
          });
          yerelYaz(y);
          son();
        }, function(){ son(); });
      });
      setTimeout(son, 6000);
    }catch(e){ son(); }
  }

  return { oku: oku, uygula: uygula, kaydet: kaydet, tazele: tazele, VARSAYILAN: VARSAYILAN, TIPLER: TIPLER };
})();
