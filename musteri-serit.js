/*
  musteri-serit.js — WG.220926.2300.603
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
  // sonuna "🕓 Geçmiş" butonu eklenir (id='btnMusteriGecmis') — SADECE bunu
  // isteyen sayfalar (şimdilik cart.html) bunu açıkça true geçer, diğer
  // tüm sayfalar (parametre verilmezse) HİÇBİR ŞEKİLDE etkilenmez.
  function html(musteri, opts){
    if(!musteri) return "";
    var kod = musteri.id ? "<b class='ms-kod'>" + esc(musteri.id) + "</b> " : "";
    var sehir = musteri.sehir ? "<span class='ms-sehir'>" + esc(musteri.sehir) + "</span>" : "";
    // DÜZELTME (12.10.2026, test sırasında fark edildi): "🕓 Geçmiş" yazılı
    // buton, uzun müşteri ismi + şehir ile aynı satırda yarıştığında ismi
    // erken kesiyordu (ellipsis). Sadece ikon (🕓) kullanarak yer kazanıldı
    // — isim artık normal şekilde görünüyor (bkz. .ms-gecmis-btn CSS'inde
    // title ile "İşlem Geçmişi" ipucu da eklendi).
    var gecmisBtn = (opts && opts.gecmisButonu) ? "<button type='button' class='ms-gecmis-btn' id='btnMusteriGecmis' title='İşlem Geçmişi' aria-label='İşlem Geçmişi'>🕓</button>" : "";
    return "<div class='musteri-serit'>"
      + "<span class='ms-ad'>" + kod + esc(musteri.ad) + "</span>"
      + sehir
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
