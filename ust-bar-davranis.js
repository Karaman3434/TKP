/*
  ust-bar-davranis.js — TKP.11.11.26-15:39.1570 (YENİDEN YAZILDI, 11.11.2026)
  ===========================================================================
  GERİ (‹) ve KAPAT (✕) için TEK, ORTAK davranış — TÜM sayfalarda aynı (Abdullah'ın
  11.11.2026 isteği + 3 onay: Kapat boşken Ana Sayfa / sistem Geri = ‹ / Geri geldiğin yol).

  KURALLAR
  • GERİ (‹) = BİR ADIM geri.
      1) Açık bir katman (popup, pencere, açılır liste, menü…) varsa EN ÜSTTEKİNİ kapatır.
      2) Katman yoksa, geldiğin yolda bir ÖNCEKİ sayfaya döner (yol = bu dosyanın tuttuğu
         sayfa yığını, sessionStorage "weiconv2_nav_yigin"). Yığında önceki sayfa yoksa
         Ana Sayfa. Geri düğmesinin kendi href'i AYNI dosyayı gösteriyorsa (ör.
         home.html?menu=raporlar) o href kullanılır — "menü sekmesine dön" bilgisini korur.
  • KAPAT (✕) = açık TÜM katmanları tek dokunuşta kapatır (sayfada kalır). Açık katman
      yoksa ANA SAYFA'ya gider. Sepet'in "işlemi iptal et" kuralı (data-ozel-kapat)
      katmanlar kapandıktan SONRA çalışır.
  • TELEFONUN GERİ TUŞU / kenardan kaydırma = ‹ ile AYNI (ilk dokunuştan sonra kurulan
      bir geçmiş nöbetçisi + popstate ile). Ana Sayfa'da açık katman yoksa uygulamadan
      normal çıkar.

  KATMAN KAYDI: her pencere/popup kendi kapatıcısını Nav.kapaticiEkle(fn) ile bildirir;
  fn "en üstteki açık katmanı kapat, kapattıysa true" döner. EN SON eklenen EN ÖNCE denenir
  (üstte olan). Hiçbir özel kapatıcısı olmayan standart zemin pencereleri
  ([id$=Overlay]) için en altta GENEL bir kapatıcı vardır.
  Nav.ayrilirken(fn): sayfadan Geri/Kapat ile ÇIKARKEN çalışacak temizlik.

  İZOLE: try/catch içinde; hata sayfanın geri kalanını bozmaz. Yetki/erişim kontrollerine
  dokunmaz (sadece gezinme).
*/
(function(){
  var ANAHTAR = "weiconv2_nav_yigin";
  var kapaticilar = [];
  var ayrilirkenler = [];

  function dosya(h){ return ((h || "").split("#")[0].split("?")[0].split("/").pop()) || "index.html"; }
  function yiginOku(){ try{ return JSON.parse(sessionStorage.getItem(ANAHTAR) || "[]"); }catch(e){ return []; } }
  function yiginYaz(y){ try{ sessionStorage.setItem(ANAHTAR, JSON.stringify(y)); }catch(e){} }

  // Bu sayfayı yığına işle: aynı dosya zaten yığındaysa o noktadan kes (geri gelinmiş demektir),
  // Ana Sayfa yığını sıfırlar.
  function sayfayiKaydet(){
    try{
      var f = dosya(window.location.pathname);
      var h = (f === "home.html") ? "home.html" : (f + (window.location.search || ""));
      var y = (f === "home.html") ? [] : yiginOku();
      for(var i = 0; i < y.length; i++){ if(dosya(y[i]) === f){ y = y.slice(0, i); break; } }
      if(f !== "home.html" && y.length === 0) y.push("home.html");   // yığın boşsa taban: Ana Sayfa
      y.push(h);
      yiginYaz(y);
    }catch(e){}
  }

  function geriHedefi(statikHref){
    var y = yiginOku();
    var onceki = y.length >= 2 ? y[y.length - 2] : null;
    if(!onceki) return "home.html";
    if(statikHref && dosya(statikHref) === dosya(onceki)) return statikHref;
    return onceki;
  }

  function kapaticiEkle(fn){ if(typeof fn === "function") kapaticilar.push(fn); }
  function ayrilirkenEkle(fn){ if(typeof fn === "function") ayrilirkenler.push(fn); }

  // En üstteki açık katmanı kapatır; kapattıysa true.
  function ustKapat(){
    for(var i = kapaticilar.length - 1; i >= 0; i--){
      try{ if(kapaticilar[i]() === true) return true; }catch(e){}
    }
    return false;
  }
  function hepsiniKapat(){
    var n = 0;
    while(n < 25 && ustKapat()) n++;
    return n > 0;
  }
  function ayrilirkenCalistir(){
    ayrilirkenler.forEach(function(fn){ try{ fn(); }catch(e){} });
  }
  function git(href){ ayrilirkenCalistir(); window.location.href = href; }

  function geri(statikHref){
    if(ustKapat()) return;
    git(geriHedefi(statikHref));
  }
  function kapat(){
    if(hepsiniKapat()) return;
    git("home.html");
  }

  // ---- GENEL KATMAN KAPATICISI (en düşük öncelik) ----
  // Standart zemin pencereleri: <div id="...Overlay" hidden>. Kapatmak = gizlemek
  // ("dışarı dokun / vazgeç" ile aynı; kaydetme/silme/iptal YAPMAZ).
  function genelKapatici(){
    var adaylar = document.querySelectorAll('[id$="Overlay"]');
    var secilen = null, secilenZ = -1;
    for(var i = 0; i < adaylar.length; i++){
      var o = adaylar[i];
      if(o.id === "asDrawerOverlay" || o.hidden) continue;
      if(o.hasAttribute("data-nav-sayfa")) continue;   // sayfanın KENDİSİ olan katman (11.11.2026): gizlenmez; ✕ → Ana Sayfa, ‹ → geldiğin sayfa
      var cs = window.getComputedStyle(o);
      if(cs.display === "none" || cs.visibility === "hidden") continue;
      var z = parseInt(cs.zIndex, 10); if(isNaN(z)) z = 0;
      if(z >= secilenZ){ secilen = o; secilenZ = z; }   // eşitse DOM'da sonra gelen üsttedir
    }
    if(!secilen) return false;
    secilen.hidden = true;
    return true;
  }
  kapaticilar.push(genelKapatici);

  // ---- ÜST BAR TUŞLARI (yakalama aşaması: sayfaların kendi eski Geri/Kapat dinleyicilerinden ÖNCE) ----
  function tusBagla(){
    document.addEventListener("click", function(ev){
      try{
        var t = ev.target && ev.target.closest ? ev.target : null;
        if(!t) return;
        var g = t.closest(".ub-bar .ub-btn--geri");
        if(g){
          if(g.disabled) return;
          ev.preventDefault(); ev.stopImmediatePropagation();
          geri(g.getAttribute("href") || g.getAttribute("data-geri-href"));
          return;
        }
        var k = t.closest(".ub-bar .ub-btn--kapat");
        if(k){
          if(k.disabled) return;
          // Sayfa kendi Kapat işini tanımlıyorsa (cart: işlemi iptal et) önce katmanlar kapanır,
          // katman yoksa sayfanın kendi davranışı çalışır.
          if(k.getAttribute("data-ozel-kapat") === "1"){
            if(hepsiniKapat()){ ev.preventDefault(); ev.stopImmediatePropagation(); }
            return;
          }
          ev.preventDefault(); ev.stopImmediatePropagation();
          kapat();
        }
      }catch(e){}
    }, true);
    // Kapat düğmeleri HTML'de "disabled" geliyor — genel davranış bağlıysa açılır.
    document.querySelectorAll(".ub-bar .ub-btn--kapat").forEach(function(b){
      if(b.getAttribute("data-ozel-kapat") === "1") return;
      b.disabled = false;
    });
  }

  // ---- TELEFONUN GERİ TUŞU / KAYDIRMA ----
  // Chrome, kullanıcı etkileşimi olmadan eklenen geçmiş girdilerini atlar; bu yüzden nöbetçi
  // ilk dokunuştan sonra eklenir. Geri basılınca nöbetçi tüketilir → popstate → ‹ ile aynı iş.
  var nobetciVar = false;
  function nobetciKoy(){
    try{
      if(nobetciVar) return;
      if(!(window.history.state && window.history.state.navNobetci)){
        window.history.pushState({navNobetci: 1}, "");
      }
      nobetciVar = true;
    }catch(e){}
  }
  function sistemGeriBagla(){
    var bir = function(){
      nobetciKoy();
      ["pointerdown","touchstart","click","keydown"].forEach(function(o){ document.removeEventListener(o, bir, true); });
    };
    ["pointerdown","touchstart","click","keydown"].forEach(function(o){ document.addEventListener(o, bir, true); });
    window.addEventListener("popstate", function(){
      try{
        if(!nobetciVar) return;
        nobetciVar = false;
        if(ustKapat()){ nobetciKoy(); return; }
        var f = dosya(window.location.pathname);
        var y = yiginOku();
        if(f === "home.html" || y.length < 2){
          if(f === "home.html"){ window.history.back(); return; }   // Ana Sayfa: normal çıkış
          git("home.html"); return;
        }
        git(geriHedefi(null));
      }catch(e){}
    });
    window.addEventListener("pageshow", function(ev){
      if(ev.persisted) nobetciVar = !!(window.history.state && window.history.state.navNobetci);
    });
  }

  window.Nav = {
    kapaticiEkle: kapaticiEkle,
    ayrilirken: ayrilirkenEkle,
    ustKapat: ustKapat,
    hepsiniKapat: hepsiniKapat,
    geri: geri,
    kapat: kapat,
    git: git,
    geriHedefi: geriHedefi
  };

  sayfayiKaydet();
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", function(){ tusBagla(); sistemGeriBagla(); });
  } else { tusBagla(); sistemGeriBagla(); }
})();
