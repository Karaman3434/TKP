/*
  ust-bar-eylem.js — TKP.09.11.26-18:48.1530
  ==========================================
  Üst barın (.ub-bar) SONUNDAKİ sayfa eylem tuşları: Kaydet (mor) ve Gönder
  (turkuaz) — Menü/Geri/Beklet/Kapat ile aynı ölçüde (Abdullah onayı,
  03.11.2026, mockup v2). Hangi sayfada hangi tuşun çıkacağı AŞAĞIDAKİ
  TEK tablodan (EYLEM_TABLOSU) okunur — sayfaya tuş eklemek/çıkarmak için
  sadece burası değişir.

  EYLEM İKİ ŞEKİLDE TANIMLANIR: (a) hedef — sayfadaki var olan düğmeyi tetikler,
  (b) tikla + aktifMi — sayfanın global bir fonksiyonunu çağırır (hedef düğmesi
  olmayan eylem, örn. Sepet'in Kaydet'i).
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
      // KAYDET (03.11.2026, Abdullah onayı): işlemi kaydeder, Gönder'e gitmez
      // (cart-render.js kaydetTiklandi("kaydet")). Müşteri seçili ve ürünler
      // hesaplanmış değilse pasif/gri; sayfada HER ZAMAN görünür.
      { tur:"kaydet",
        aktifMi:function(){ var b = document.getElementById("btnMusteriGonder"); return !!b && !b.disabled; },
        tikla:function(){ if(typeof kaydetTiklandi === "function") kaydetTiklandi("kaydet"); } },
      { tur:"gonder", gizleHedef:true, gerekli:true,
        hedef:function(){ return document.getElementById("btnMusteriGonder") || document.getElementById("btnSepetGonderMusterisiz"); } }
    ],
    // GÖNDER EKRANI (03.11.2026, Abdullah onayı): alttaki Kapat/Gönder tuşları
    // kalktı — üst bar Gönder'i açık Mail/WhatsApp önizlemesinin Gönder'ini
    // tetikler (send-render.js ustGonderTiklandi); önizleme yoksa İletişim'i açar.
    "send.html": [
      { tur:"gonder",
        aktifMi:function(){ return typeof ustGonderTiklandi === "function"; },
        tikla:function(){ ustGonderTiklandi(); } }
    ],
    // BELGE ÖNİZLEME (08.11.2026, Abdullah onayı): düzenleme pencerelerinin (Ürünler/
    // Adet/Fiyat, Yetkili, Adres, Not, Stok Bekliyor) alttaki Kapat/Kaydet tuşları
    // kalktı — Kaydet burada: o an AÇIK olan pencerenin Kaydet'ini tetikler;
    // hiçbir pencere açık değilse tuş hiç görünmez. Kapat = üst bardaki ✕
    // (açık pencere varsa önce onu kapatır — bkz. belge-render.js).
    "belge-onizleme.html": [
      { tur:"kaydet", gerekli:true,
        hedef:function(){
          var ids = ["duzenleOverlay","yetkiliSecOverlay","adresDuzenleOverlay","notDuzenleOverlay","beklemedeNotOverlay"];
          var btnIds = {duzenleOverlay:"btnDuzenleKaydet", yetkiliSecOverlay:"btnYetkiliSecKaydet", adresDuzenleOverlay:"btnAdresDuzenleKaydet", notDuzenleOverlay:"btnNotDuzenleKaydet", beklemedeNotOverlay:"btnBeklemedeNotKaydet"};
          for(var i=0;i<ids.length;i++){
            var o = document.getElementById(ids[i]);
            if(o && !o.hidden) return document.getElementById(btnIds[ids[i]]);
          }
          return null;
        } }
    ],
    // CARİ KART (09.11.2026, Abdullah isteği): Ekle/Düzenle formunun (Cari Bilgileri
    // Düzenle, Yeni Yetkili Kişi vb.) alttaki Kapat/Kaydet tuşları kalktı —
    // Kaydet burada: form AÇIKSA formun gizli Kaydet düğmesini tetikler, kapalıyken
    // tuş hiç görünmez. Kapat = üstteki ✕ (cari-kart-render.js açık formu kapatır).
    "customer-cari-kart.html": [
      { tur:"kaydet", gerekli:true,
        hedef:function(){
          var o = document.getElementById("formOverlay");
          return (o && !o.hidden) ? document.getElementById("formKaydetBtn") : null;
        } }
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
        try{
          if(e.tikla){ if(e.aktifMi()) e.tikla(); return; }
          var h = e.hedef(); if(h && !h.disabled) h.click();
        }catch(x){}
      };
      kutu.appendChild(b);
      return b;
    });
    bar.appendChild(kutu);

    function esitle(){
      try{
        var herhangiGorunur = false;
        liste.forEach(function(e, i){
          if(e.tikla){   // hedef düğmesi olmayan, kendi koşuluyla çalışan eylem
            butonlar[i].disabled = !e.aktifMi();
            herhangiGorunur = true;
            return;
          }
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
