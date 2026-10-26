/*
  cart-data.js — WG.261026.0745.1055
  ============
  TEK görevi: sepet verisini (product-data.js ile PAYLAŞILAN localStorage
  anahtarı üzerinden) okumak/güncellemek ve fiyat hesaplama formüllerini
  uygulamak. Formüller eski app-part3.js -> hesapla() fonksiyonundan BİREBİR
  taşındı, iş mantığı değişmedi.

  FIREBASE YEDEĞİ (09.10.2026, kod incelemesi sonrası): sepet eskiden SADECE
  localStorage'da tutuluyordu — cihaz değişince veya tarayıcı verisi
  silinince taslak sepet tamamen kaybolabiliyordu. localStorage HÂLÂ ana/anlık
  kaynak (hızlı, çevrimdışı çalışır); AMA her kaydet()'te ayrıca kullanıcının
  kendi oturumuna bağlı "sepetTaslak/{uid}" yoluna da yazılıyor (bkz.
  database.rules.json — bu yol SADECE o kullanıcının kendi uid'siyle
  okunabilir/yazılabilir). Sayfa açıldığında, localStorage boşsa (yeni cihaz
  veya veri silinmiş) weiconAuthHazir (auth.js) olayından sonra bu yedek bir
  kez kontrol edilir; bulunursa sepete geri yüklenir ve "weiconSepetGeriYuklendi"
  olayı tetiklenir (cart-render.js bunu dinleyip ekranı yeniden çizer).
*/

var CartData = (function(){

  var SEPET_KEY = "weiconv2_sepet";
  var KDV_KEY = "weicon_kdv_orani"; // eski uygulamayla PAYLAŞILAN anahtar
  var KUR_KEY = "weicon_kur"; // eski uygulamayla PAYLAŞILAN anahtar

  var sepet = [];
  try{
    var kayitli = localStorage.getItem(SEPET_KEY);
    if(kayitli) sepet = JSON.parse(kayitli);
  }catch(e){ sepet = []; }

  var fbUid = null;

  function fbYoluAl(){ return fbUid ? ("sepetTaslak/" + fbUid) : null; }

  // Yedekten GERİ YÜKLEME — SADECE bu cihazda sepet zaten boşsa (yeni cihaz /
  // temizlenmiş veri) devreye girer; dolu bir sepetin üzerine ASLA yazmaz.
  function fbYukle(){
    if(!fbUid || typeof firebase === "undefined") return;
    try{
      firebase.database().ref(fbYoluAl()).once("value").then(function(snap){
        var uzak = snap.val();
        if(uzak && Array.isArray(uzak.sepet) && sepet.length === 0 && uzak.sepet.length > 0){
          sepet = uzak.sepet;
          try{ localStorage.setItem(SEPET_KEY, JSON.stringify(sepet)); }catch(e){}
          try{ document.dispatchEvent(new CustomEvent("weiconSepetGeriYuklendi")); }catch(e){}
        }
      }).catch(function(err){ console.error("Sepet yedeği okunamadı:", err); });
    }catch(e){ console.error("Sepet yedeği okunamadı:", e); }
  }

  // DÜZELTME (26.10.2026): artık yazma Promise'ini GERİ DÖNDÜRÜYOR — aşağıdaki
  // sifirla(callback) bu Promise'i bekleyip Firebase yedeği GERÇEKTEN
  // boşaldıktan SONRA navigasyona izin verebilsin diye (bkz. aşağıdaki not).
  // Normal kaydet() akışını DEĞİŞTİRMEDİ, o hâlâ "fire and forget".
  function fbKaydet(){
    if(!fbUid || typeof firebase === "undefined") return null;
    try{
      return firebase.database().ref(fbYoluAl()).set({sepet: sepet, zaman: Date.now()})
        .catch(function(err){ console.error("Sepet yedeği Firebase'e yazılamadı:", err); });
    }catch(e){ console.error("Sepet yedeği Firebase'e yazılamadı:", e); return null; }
  }

  try{
    window.addEventListener("weiconAuthHazir", function(ev){
      try{ fbUid = ev.detail.user.uid; }catch(e){ fbUid = null; }
      fbYukle();
    });
  }catch(e){}

  function kaydet(){
    try{ localStorage.setItem(SEPET_KEY, JSON.stringify(sepet)); }catch(e){}
    fbKaydet();
  }

  // HATA DÜZELTMESİ (26.10.2026, Abdullah'ın bildirdiği kritik hata —
  // "İptal ediyorum ama sepet silinmiyor, yeniden hazır hale gelmiyor"):
  // İKİ AYRI SORUN BİRLİKTE BULUNDU:
  // 1) "İşlemi İptal Et" bu modülün HİÇ bilmediği şekilde doğrudan
  //    localStorage["weiconv2_sepet"]'i "[]" yazıyordu (bkz. cart-render.js
  //    herSeyiSifirlaVeGit) — ama yukarıdaki "sepet" DEĞİŞKENİ (bu modülün
  //    asıl kaynağı, CartData.liste()/sayfayiCiz() hep BUNU okur) hiç
  //    güncellenmiyordu.
  // 2) DAHA DERİN SORUN — YARIŞ DURUMU: hatta #1 CartData.sifirla() ile
  //    düzeltilse bile, Firebase'e yazma (fbKaydet) ASENKRON — "İşlemi
  //    İptal Et" hemen arkasından window.location.href ile BAŞKA SAYFAYA
  //    (home.html) gidiyor, sayfa değişince Firebase yazması YARIDA
  //    KESİLEBİLİYOR. Yeni sayfa açılınca "weiconAuthHazir" yine ateşleniyor,
  //    fbYukle() çalışıyor, Firebase'de HÂLÂ ESKİ (boşaltılmamış) yedeği
  //    görüyor, "sepet bu cihazda boş" kuralına uyduğu için GERİ YÜKLÜYOR —
  //    yani iptal, az sonra Firebase'in kendi yedeğiyle SESSİZCE GERİ
  //    ALINIYORDU. Artık sifirla(callback): Firebase yazması bitene KADAR
  //    (ya da 1.2sn içinde bitmezse — çevrimdışı/yavaş bağlantı güvenlik
  //    ağı) callback'i (navigasyonu) ERTELİYOR, böylece yedek GERÇEKTEN
  //    boşalmadan sayfa değişmiyor.
  function sifirla(callback){
    sepet = [];
    try{ localStorage.setItem(SEPET_KEY, JSON.stringify(sepet)); }catch(e){}
    var soz = fbKaydet();
    var tamamlandiMi = false;
    function bitir(){
      if(tamamlandiMi) return;
      tamamlandiMi = true;
      if(typeof callback === "function") callback();
    }
    if(soz && typeof soz.then === "function"){
      soz.then(bitir).catch(bitir);
      setTimeout(bitir, 1200);
    } else {
      bitir();
    }
  }

  function liste(){ return sepet; }

  function sil(idx){
    var i = sepet.findIndex(function(u){ return u.idx === idx; });
    if(i>=0){ sepet.splice(i,1); kaydet(); }
  }

  // Birleşik Sayfa (02.10.2026) — Ürün Bul'un SEÇ'i ve Hızlı Hesapla
  // popup'ının "Listeye Ekle"si artık AYNI sayfada, aynı anda açık; ikisi
  // de sepete yeni bir satır eklerken product-data.js'in KENDİ ayrı
  // bellek kopyası yerine DOĞRUDAN bu modülün sepet dizisine yazmalı —
  // yoksa CartData.liste() (sayfayiCiz'in okuduğu) taze veriyi göremez.
  function ekle(urun){
    sepet.push(urun);
    kaydet();
  }

  function alaniGuncelle(idx, alan, deger){
    var u = sepet.find(function(u){ return u.idx === idx; });
    if(u){
      u[alan] = deger;
      // Eski uygulamanın HESAPLANACAK (sarı) / HESAPLANDI (yeşil) ayrımıyla
      // aynı: dip fiyat veya iskonto girildiği an ürün "hesaplandı" sayılır.
      if((alan==="dipFiyat" || alan==="iskonto") && deger>0) u.hesaplandi = true;
      kaydet();
    }
  }

  // Hesapla popup'ından "Listeye Ekle" ile kesin olarak hesaplandı sayılır
  // (değerler 0 olsa bile — kullanıcı gözden geçirip onayladı demektir).
  function hesaplandiIsaretle(idx, listeFiyat, dipFiyat, iskonto, adet, ozelEtiket){
    var u = sepet.find(function(u){ return u.idx === idx; });
    if(!u) return;
    u.listeFiyat = listeFiyat;
    u.dipFiyat = dipFiyat;
    u.iskonto = iskonto;
    u.adet = adet;
    u.hesaplandi = true;
    if(ozelEtiket) u.ozelEtiket = ozelEtiket; else delete u.ozelEtiket;
    kaydet();
  }

  function tamamHesaplandiMi(){
    return sepet.length>0 && sepet.every(function(u){ return u.hesaplandi; });
  }

  function kurOku(){
    var v = parseFloat(localStorage.getItem(KUR_KEY));
    return isNaN(v) ? 0 : v;
  }
  function kurKaydet(v){
    if(typeof AyarlarSync !== "undefined") AyarlarSync.kurKaydet(v);
    else localStorage.setItem(KUR_KEY, v);
  }
  function kdvOku(){
    var v = parseFloat(localStorage.getItem(KDV_KEY));
    return isNaN(v) ? 20 : v;
  }

  // ---- Formüller: eski hesapla() ile birebir aynı ----
  // Eski uygulamadan taşınan iş kuralı: DİP (Maliyet), Liste Fiyatının
  // %36,35'i olarak otomatik hesaplanır — kullanıcı elle değiştirmediği
  // sürece bu değer kullanılır (bkz. calc-render.js dipFiyatOnerisiUygula).
  var DIP_FIYAT_ORANI = 0.3635;

  function dipFiyatOner(listeFiyat){
    return Math.round((parseFloat(listeFiyat)||0) * DIP_FIYAT_ORANI * 100) / 100;
  }

  function hesapla(urun, kur, kdv){
    var listeFiyat = parseFloat(urun.listeFiyat)||0;
    var dipFiyat = parseFloat(urun.dipFiyat)||0;
    var iskonto = parseFloat(urun.iskonto)||0;
    var adet = parseFloat(urun.adet)||1;

    var iskontoluFiyat = listeFiyat - (listeFiyat*iskonto/100);
    var tlBirimFiyat = iskontoluFiyat * kur;
    var maliyetKar = iskontoluFiyat - dipFiyat;
    var toplamMaliyetKar = maliyetKar * adet;
    // İş kuralı: %60'ın üzerinde (yani %60,01 ve üstü) iskontoda prim
    // KESİNLİKLE ödenmez — bu iskonto seviyesinde özel/istisnai fiyata
    // girildiği için müdür primi otomatik sıfırlanır.
    var mudurPrim = iskonto > 60 ? 0 : toplamMaliyetKar * 0.22;
    var mudurPrimTL = mudurPrim * kur;
    var toplamEuro = adet * iskontoluFiyat;
    var faturaToplam = adet * tlBirimFiyat * (1 + kdv/100);

    return {
      iskontoluFiyat: iskontoluFiyat,
      tlBirimFiyat: tlBirimFiyat,
      maliyetKar: maliyetKar,
      toplamMaliyetKar: toplamMaliyetKar,
      mudurPrim: mudurPrim,
      mudurPrimTL: mudurPrimTL,
      toplamEuro: toplamEuro,
      faturaToplam: faturaToplam
    };
  }

  function genelToplam(kur, kdv){
    var toplamEuro = 0, toplamPrim = 0;
    sepet.forEach(function(u){
      var h = hesapla(u, kur, kdv);
      toplamEuro += h.toplamEuro;
      if(h.mudurPrim > 0) toplamPrim += h.mudurPrim;
    });
    return {toplamEuro:toplamEuro, toplamPrim:toplamPrim};
  }

  function fmt(n){
    return (n||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2});
  }

  return {
    liste: liste,
    sifirla: sifirla,
    sil: sil,
    ekle: ekle,
    alaniGuncelle: alaniGuncelle,
    hesaplandiIsaretle: hesaplandiIsaretle,
    tamamHesaplandiMi: tamamHesaplandiMi,
    kurOku: kurOku,
    kurKaydet: kurKaydet,
    kdvOku: kdvOku,
    hesapla: hesapla,
    dipFiyatOner: dipFiyatOner,
    genelToplam: genelToplam,
    fmt: fmt
  };

})();
