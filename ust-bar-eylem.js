/*
  ust-bar-eylem.js — TKP.03.11.26-14:45.1454
  ==========================================
  Üst barın (.ub-bar) SONUNDAKİ sayfa eylem tuşları: Kaydet (mor) ve Gönder
  (turkuaz) — Menü/Geri/Beklet/Kapat ile aynı ölçüde (Abdullah onayı,
  03.11.2026, mockup v2). Hangi sayfada hangi tuşun çıkacağı AŞAĞIDAKİ
  TEK tablodan (EYLEM_TABLOSU) okunur — sayfaya tuş eklemek/çıkarmak için
  sadece burası değişir.

  NASIL ÇALIŞIR: Üst bar tuşu işi KENDİ yapmaz; sayfanın zaten var olan
  gerçek düğmesini (hedef) tetikler (hedef.click()). Böylece Kaydet/Gönder
  mantığı (yetki kontrolü, doğrulama, kayıt) hâlâ TEK yerde — sayfanın kendi
  koduda — kalır, burada çoğaltılmaz. Hedef düğme pasifse (disabled) veya
  sayfada yoksa üst bar tuşu da GRİ/pasif görünür (Beklet/Kapat'ın pasif
  rengiyle aynı). gizleHedef:true olan sayfada asıl düğme aynı işi yapan
  tek tuş kalsın diye gizlenir (sadece Sepet'in Gönder ikonu).

  Sıralama: tabloda "kaydet" önce, "gonder" sonra yazılır; Gönder satırın
  en sağ ucunda, Kaydet onun solunda durur.

  YETKİ: Bu dosya hiçbir sayfa/kullanıcı yetkisini DEĞİŞTİRMEZ. Hedef düğme
  sayfanın kendi izin kontrolüyle yoksa (örn. sepetGonder izni yok) üst
  bardaki tuş da hiç görünmez (eylem grubu gizli kalır).

  İZOLE dosya: tamamı try/catch içinde, hata sayfanın geri kalanını bozmaz.
*/
(function(){
  function id(adi){ return function(){ return document.getElementById(adi); }; }

  var EYLEM_TABLOSU = {
    "cart.html": [
      { tur:"gonder", gizleHedef:true, gerekli:true,
        hedef:function(){ return document.getElementById("btnMusteriGonder") || document.getElementById("btnSepetGonderMusterisiz"); } }
    ],
    "customer-add.html":    [ { tur:"kaydet", hedef:id("btnYeniMusteriKaydet") } ],
    "ziyaret.html":         [ { tur:"kaydet", hedef:id("btnZiyKaydet") } ],
    "km.html":              [ { tur:"kaydet", hedef:id("btnKmKaydet") } ],
    "km-kayitlar.html":     [ { tur:"kaydet", hedef:id("btnKmTabloKaydet") } ],
    "yillik-km-odeme.html": [ { tur:"kaydet", hedef:id("btnKoKaydet") } ]
  };

  var AYAR = {
    kaydet: { etiket:"Kaydet", ikon:"<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M5 3h11l4 4v14H5z'/><path d='M8 3v6h8V3'/><rect x='8' y='14' width='8' height='7'/></svg>" },
    gonder: { etiket:"Gönder", ikon:"<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M22 2 11 13'/><path d='M22 2 15 22l-4-9-9-4z'/></svg>" }
  };

  function dosyaAdi(){
    var p = window.location.pathname.split("/").pop();
    return p || "index.html";
  }

  function kur(){
    var liste = EYLEM_TABLOSU[dosyaAdi()];
    if(!liste || !liste.length) return;
    var bar = document.querySelector(".ub-bar");
    if(!bar || bar.querySelector(".ub-eylem")) return;

    var kutu = document.createElement("div");
    kutu.className = "ub-eylem";
    kutu.hidden = true;
    var butonlar = liste.map(function(e){
      var a = AYAR[e.tur];
      var b = document.createElement("button");
      b.type = "button";
      b.className = "ub-btn ub-btn--" + e.tur;
      b.setAttribute("aria-label", a.etiket);
      b.title = a.etiket;
      b.innerHTML = a.ikon;
      b.disabled = true;
      b.onclick = function(){
        try{ var h = e.hedef(); if(h && !h.disabled) h.click(); }catch(x){}
      };
      kutu.appendChild(b);
      return b;
    });
    bar.appendChild(kutu);

    function esitle(){
      try{
        var herhangiGorunur = false;
        liste.forEach(function(e, i){
          var h = e.hedef();
          var var_ = !!h;
          if(var_ && e.gizleHedef) h.style.setProperty("display", "none", "important");
          butonlar[i].disabled = !(var_ && !h.disabled);
          butonlar[i].hidden = (e.gerekli && !var_);
          if(!butonlar[i].hidden) herhangiGorunur = true;
        });
        kutu.hidden = !herhangiGorunur;
      }catch(x){}
    }
    esitle();
    setInterval(esitle, 400);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", kur);
  } else {
    kur();
  }
})();
