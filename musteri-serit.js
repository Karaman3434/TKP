/*
  musteri-serit.js — TKP.01.11.26-17:06.1326
  ========================================
  TEK KURAL (22.09.2026): Müşteri adının göründüğü hiçbir sayfa kendi
  HTML'ini elle yazmaz — hepsi MusteriSeridi.html(musteri) çağırır. Yeni
  bir sayfaya müşteri adı eklenecekse de buradan çağrılır, YENİ bir stil
  icat edilmez.
*/
var MusteriSeridi = (function(){

  function esc(s){
    return String(s==null?"":s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }

  // musteri: {id, ad, sehir} — id ve sehir opsiyonel.
  // opts.gecmisButonu (12.10.2026, Abdullah onayı): true verilirse şeridin
  // sonuna "🕓 GEÇMİŞ" butonu eklenir (id='btnMusteriGecmis') — SADECE bunu
  // isteyen sayfalar (şimdilik cart.html) bunu açıkça true geçer, diğer
  // tüm sayfalar (parametre verilmezse) HİÇBİR ŞEKİLDE etkilenmez.
  //
  // DEĞİŞİKLİK (12.10.2026, Abdullah onayı — mockup üzerinden, ikinci
  // revizyon): isim ile ilçe/il bilgisi artık AYRI birer flex eleman değil
  // — isim bitince hemen " - " ayracı, sonra ilçe/il, hepsi TEK bir satır
  // (ms-ad) içinde; uzun olursa SATIRIN TAMAMI (isim+ayraç+şehir) birlikte
  // ellipsis ile kesiliyor. "🕓" butonu artık yanında "GEÇMİŞ" yazısı da
  // taşıyor (eskiden sadece ikondu).
  // koduGizle (18.10.2026, Abdullah onayı): true verilirse müşteri cari
  // kodu ("M-0017" gibi) HİÇ basılmaz. Cari kodu sadece programın kendi
  // içindeki ekranlara ait, iç bilgi — Mail/WhatsApp'a giden görsel bunu
  // true geçer (bkz. hareket-tablo.js cariKutulariHtml / send-render.js
  // belgeGorselHtmlOlustur). Parametre verilmezse (programın geri kalanı)
  // davranış hiç değişmez, kod her zamanki gibi gösterilir.
  // opts.gonderButonu (01.11.2026, Abdullah onayı — mockup üzerinden):
  // true verilirse şeridin en sonuna turuncu daire "📨 GÖNDER" ikon butonu
  // eklenir (id='btnMusteriGonder') — SADECE bunu isteyen sayfalar
  // (şimdilik cart.html) bunu açıkça true geçer, diğer tüm sayfalar
  // (parametre verilmezse) HİÇBİR ŞEKİLDE etkilenmez (gecmisButonu ile
  // AYNI opt-in deseni). opts.gonderDisabled true ise buton görünür ama
  // tıklanamaz (sepet henüz tamamlanmadıysa).
  function html(musteri, opts){
    if(!musteri) return "";
    var kod = (musteri.id && !(opts && opts.koduGizle)) ? "<b class='ms-kod'>" + esc(musteri.id) + "</b> " : "";
    // KONUM = "İlçe / İL" (03.11.2026) — tek kaynak CustomerData.konumMetni;
    // customer-data.js yüklü olmayan sayfada yedek: ilçe + il kendi nesnesinden.
    var konum = (typeof CustomerData !== "undefined" && CustomerData.konumMetni)
      ? CustomerData.konumMetni(musteri)
      : [musteri.sehir, musteri.il].filter(Boolean).join(" / ");
    var sehir = konum ? "<span class='ms-ayrac'>-</span><span class='ms-sehir'>" + esc(konum) + "</span>" : "";
    var gecmisBtn = (opts && opts.gecmisButonu) ? "<button type='button' class='ms-gecmis-btn' id='btnMusteriGecmis' title='İşlem Geçmişi' aria-label='İşlem Geçmişi'>🕓<span class='ms-gecmis-etiket'>GEÇMİŞ</span></button>" : "";
    // opts.gecmisAsili (05.11.2026, Abdullah onayı — "2 numaralı tasarım"): şeridin
    // ALT KENARINA asılı küçük "🕓 geçmiş alımlar ▾" etiketi — ek satır/tuş yok,
    // tıklamayı şeridin kendisi alır (bkz. cart-render.js gecmisBagla). Sadece
    // bunu açıkça isteyen sayfa (cart.html) true geçer.
    var gecmisAsili = (opts && opts.gecmisAsili) ? "<span class='ms-gecmis-asili' aria-hidden='true'>🕓 geçmiş alımlar ▾</span>" : "";
    var gonderIkon = (typeof IkonSvg !== "undefined") ? IkonSvg.svg("gonder") : "";
    var gonderBtn = (opts && opts.gonderButonu) ? "<button type='button' class='ms-gonder-btn' id='btnMusteriGonder' title='Gönder' aria-label='Gönder'" + (opts.gonderDisabled ? " disabled" : "") + ">" + gonderIkon + "</button>" : "";
    return "<div class='musteri-serit" + (gecmisAsili ? " musteri-serit--asili" : "") + "'>"
      + "<span class='ms-ad'>" + kod + esc(musteri.ad) + sehir + "</span>"
      + gecmisBtn
      + gonderBtn
      + gecmisAsili
      + "</div>";
  }

  // Belirtilen id'li konteynerin içine şeridi basar.
  function uygula(konteynerId, musteri, opts){
    var el = document.getElementById(konteynerId);
    if(!el) return;
    el.innerHTML = html(musteri, opts);
  }

  return { html: html, uygula: uygula };

})();
