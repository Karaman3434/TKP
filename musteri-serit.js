/*
  musteri-serit.js — WG.181026.2315.834
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
  function html(musteri, opts){
    if(!musteri) return "";
    var kod = (musteri.id && !(opts && opts.koduGizle)) ? "<b class='ms-kod'>" + esc(musteri.id) + "</b> " : "";
    var sehir = musteri.sehir ? "<span class='ms-ayrac'>-</span><span class='ms-sehir'>" + esc(musteri.sehir) + "</span>" : "";
    var gecmisBtn = (opts && opts.gecmisButonu) ? "<button type='button' class='ms-gecmis-btn' id='btnMusteriGecmis' title='İşlem Geçmişi' aria-label='İşlem Geçmişi'>🕓<span class='ms-gecmis-etiket'>GEÇMİŞ</span></button>" : "";
    return "<div class='musteri-serit'>"
      + "<span class='ms-ad'>" + kod + esc(musteri.ad) + sehir + "</span>"
      + gecmisBtn
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
