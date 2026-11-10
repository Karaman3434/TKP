/*
  home-takip-buton.js — TKP.10.11.26-18:04.1558
  ===========================================
  ANA SAYFA "Ziyaret ve Ödeme Takip" butonu (10.11.2026, Abdullah isteği).
  - Butona basınca küçük bir pencere (popover) açılır: Vadesi geçen ödemeler →
    vade-takip.html, Ziyaret bekleyenler → takip-gerekenler.html. Satırların
    sağında kendi sayıları; butondaki rozet toplam sayı.
  - Sayılar tek kaynaktan: TakipOzet (takip-ozet-data.js).
  - Yetki: ödeme satırı "vadeTakip", ziyaret satırı "takipGerekenler" izni ister
    (Çalışan Erişimi AYNEN korunur); ikisi de yoksa buton hiç görünmez.
  - Pencere butonun altında açılır; altta yer yoksa üstünde açılır.
*/
(function(){
  var blok, btn, rozet, pop;

  function izin(anahtar){
    return (typeof window.izinVarMi !== "function") ? true : !!window.izinVarMi(anahtar);
  }
  function kapat(){
    if(!pop) return;
    pop.hidden = true;
    pop.classList.remove("as-tak-pop--yukari");
    btn.setAttribute("aria-expanded", "false");
  }
  function ac(){
    pop.hidden = false;
    pop.classList.remove("as-tak-pop--yukari");
    var r = btn.getBoundingClientRect();
    if(r.bottom + pop.offsetHeight + 8 > window.innerHeight && r.top > pop.offsetHeight + 8) pop.classList.add("as-tak-pop--yukari");
    btn.setAttribute("aria-expanded", "true");
  }

  function satir(ikon, baslik, alt, say, renk, href){
    return "<button type='button' class='as-tak-satir' data-href='" + href + "'>"
      + "<span class='as-tak-ikon' aria-hidden='true'>" + ikon + "</span>"
      + "<span class='as-tak-metin'><b>" + baslik + "</b><small>" + alt + "</small></span>"
      + "<span class='as-tak-say as-tak-say--" + renk + (say === 0 ? " as-tak-say--sifir" : "") + "'>" + say + "</span>"
      + "</button>";
  }

  function guncelle(){
    if(!blok) return;
    if(window.ISTAKIP_IZINLER === undefined) return; // izinler henüz çözülmedi
    var odemeIzin = izin("vadeTakip"), ziyaretIzin = izin("takipGerekenler");
    blok.hidden = !(odemeIzin || ziyaretIzin);
    if(blok.hidden){ kapat(); return; }
    var toplam = 0, html = "";
    if(odemeIzin){
      var o = TakipOzet.odemeOzeti();
      toplam += o.musteriSayisi;
      html += satir("💳", "Vadesi geçen ödemeler",
        o.musteriSayisi ? (o.musteriSayisi + " müşteri · en uzun " + o.enUzunGun + " gün") : "Vadesi geçen ödeme yok",
        o.musteriSayisi, "kirmizi", "vade-takip.html");
    }
    if(ziyaretIzin){
      var z = TakipOzet.ziyaretBekleyenler().length;
      toplam += z;
      html += satir("🚶", "Ziyaret bekleyenler",
        TakipOzet.ZIYARET_ESIK_GUN + " gündür uğranmayan müşteriler", z, "mavi", "takip-gerekenler.html");
    }
    pop.innerHTML = html;
    rozet.textContent = toplam;
    rozet.hidden = toplam === 0;
  }

  document.addEventListener("DOMContentLoaded", function(){
    blok = document.getElementById("asTakipBlok");
    btn = document.getElementById("asTakipBtn");
    rozet = document.getElementById("asTakipToplam");
    pop = document.getElementById("asTakipPop");
    if(!blok || !btn || !pop || typeof TakipOzet === "undefined") return;
    btn.addEventListener("click", function(ev){ ev.stopPropagation(); pop.hidden ? ac() : kapat(); });
    pop.addEventListener("click", function(ev){
      ev.stopPropagation();
      var s = ev.target.closest(".as-tak-satir");
      if(s) window.location.href = s.getAttribute("data-href");
    });
    document.addEventListener("click", kapat);
    guncelle();
    window.addEventListener("istakipAuthHazir", guncelle);
    if(typeof CustomerData !== "undefined" && CustomerData.listeDegistiginde) CustomerData.listeDegistiginde(guncelle);
    if(typeof ReportsData !== "undefined" && ReportsData.arsivDegistiginde) ReportsData.arsivDegistiginde(guncelle);
  });
})();
