/*
  ust-bar-davranis.js — TKP.15.11.26-7-TUS-STANDART-01 (YENİDEN YAZILDI, 11.11.2026)
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


/* ROTA — ORTAK UYGULAMA STANDARDI (14.11.2026)
   Bu ortak üst-bar dosyasını kullanan tüm ekranlarda, ayrıca sayfa bazlı
   rota kodu eklenmemiş olsa bile ROTA şeridini otomatik hazırlar.
   Sayfa bazlı rota-takip.js bulunan ekranların mevcut özel rotası korunur.
   Yalnızca gezinme görünümüdür; veri ve işlem akışına müdahale etmez. */
(function(){
  try{
    var rotaScriptVar = Array.prototype.some.call(document.scripts,function(s){
      return /(?:^|\/)rota-takip\.js(?:\?|$)/i.test(s.getAttribute("src") || "");
    });
    if(rotaScriptVar) return;

    var ANAHTAR = "weiconv2_rota_yigin";
    function oku(){
      try{
        var a = JSON.parse(sessionStorage.getItem(ANAHTAR) || "[]");
        return Array.isArray(a) ? a.filter(function(x){return x && x.href && x.etiket;}) : [];
      }catch(e){return [];}
    }
    function yaz(a){try{sessionStorage.setItem(ANAHTAR,JSON.stringify(a));}catch(e){}}
    function metinEtiketi(s){
      s=String(s||"").trim();
      var m=s.match(/^\S+\s+(.+)$/);
      if(m && !/[A-Za-zÇĞİIÖŞÜçğıiöşü]/.test(s.split(/\s+/)[0])) s=m[1].trim();
      if(s==="Müşteri Bul") s="Müşteri Ara";
      return s;
    }
    function ciz(el,yigin){
      if(!el || !yigin.length) return;
      el.classList.add("rota-panel");
      el.setAttribute("aria-label","Bulunduğunuz sayfa ve gezinme rotası");
      el.replaceChildren();
      var bas=document.createElement("span");
      bas.className="rota-panel-baslangic"; bas.textContent="•••"; bas.setAttribute("aria-hidden","true"); el.appendChild(bas);
      yigin.forEach(function(d,i){
        if(i){
          var sep=document.createElement("span"); sep.className="rota-panel-ayrac"; sep.setAttribute("aria-hidden","true"); el.appendChild(sep);
        }
        var label=metinEtiketi(d.etiket), uzak=yigin.length-1-i, fs=15*Math.pow(.8,uzak);
        var a=document.createElement(i===yigin.length-1?"span":"a");
        a.className="rota-panel-durak"+(i===yigin.length-1?" rota-panel-durak--aktif":"");
        if(i===yigin.length-1) a.setAttribute("aria-current","page"); else a.href=d.href;
        a.textContent=label; a.style.setProperty("font-size",fs.toFixed(1)+"px","important"); el.appendChild(a);
      });
      el.scrollLeft=el.scrollWidth;
    }
    function stil(){
      if(document.getElementById("rotaOrtakStil")) return;
      var s=document.createElement("style"); s.id="rotaOrtakStil";
      s.textContent=[
        ".ub-bar .ub-sayfa-etiket.rota-panel{order:5!important;flex:0 0 100%!important;width:100%!important;min-width:0!important;height:auto!important;min-height:30px!important;margin:0!important;padding:1mm!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:1mm!important;box-sizing:border-box!important;background:#e0730f!important;border:0!important;border-radius:0!important;overflow-x:auto!important;overflow-y:hidden!important;white-space:nowrap!important;-webkit-overflow-scrolling:touch!important;scrollbar-width:none!important;text-align:left!important;}",
        ".ub-bar .ub-sayfa-etiket.rota-panel::-webkit-scrollbar{display:none!important;}",
        ".ub-bar .ub-sayfa-etiket.rota-panel>.rota-panel-baslangic{display:inline-flex!important;flex:0 0 auto!important;align-items:center!important;line-height:1!important;padding:0!important;margin:0 1mm 0 0!important;background:transparent!important;border:0!important;color:#fff!important;font-size:9px!important;font-weight:900!important;letter-spacing:1px!important;}",
        ".ub-bar .ub-sayfa-etiket.rota-panel>.rota-panel-ayrac{display:inline-block!important;flex:0 0 1px!important;width:1px!important;height:13px!important;min-height:13px!important;margin:0 1mm!important;background:rgba(255,255,255,.9)!important;border:0!important;}",
        ".ub-bar .ub-sayfa-etiket.rota-panel>.rota-panel-durak{display:inline-flex!important;flex:0 0 auto!important;align-items:center!important;width:auto!important;max-width:none!important;min-width:0!important;height:auto!important;min-height:0!important;line-height:1.2!important;padding:0!important;margin:0!important;background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;color:#fff!important;text-decoration:none!important;font-size:12px!important;font-weight:700!important;white-space:nowrap!important;}",
        ".ub-bar .ub-sayfa-etiket.rota-panel>.rota-panel-durak--aktif{font-size:15px!important;font-weight:900!important;}",
        ".ub-bar .ub-sayfa-etiket.rota-panel>.rota-panel-durak:focus-visible{outline:2px solid #fff!important;outline-offset:2px!important;}"
      ].join("");
      document.head.appendChild(s);
    }
    function baslat(){
      var bar=document.querySelector(".ub-bar"); if(!bar) return;
      stil();
      var panel=bar.querySelector(".ub-sayfa-etiket");
      if(!panel){
        panel=document.createElement("div"); panel.className="ub-sayfa-etiket";
        var grup=bar.querySelector(".ub-grup");
        if(grup && grup.parentNode===bar) grup.insertAdjacentElement("afterend",panel); else bar.appendChild(panel);
      }
      var dosya=(location.pathname.split("/").pop()||"index.html");
      var ana=dosya==="home.html" || dosya==="index.html";
      var y=ana?[]:oku();
      if(!ana){
        var idx=-1;
        for(var i=0;i<y.length;i++){if(y[i].href.split("?")[0]===dosya){idx=i;break;}}
        if(idx>=0) y=y.slice(0,idx);
        if(!y.length) y.push({href:"home.html",etiket:"Ana Sayfa"});
      }
      var mevcut=panel.textContent.trim();
      var baslik=metinEtiketi(mevcut) || document.title.replace(/^İş Takip\s*[—-]\s*/i,"").trim() || dosya.replace(".html","");
      y.push({href:dosya,etiket:ana?"Ana Sayfa":baslik});
      yaz(y); ciz(panel,y);
    }
    if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",baslat,{once:true});
    else baslat();
  }catch(e){}
})();


/* İŞLEM ÇUBUĞU — ONAYLI ORTAK YERLEŞİM (15.11.2026)
   Mevcut buton DOM düğümleri taşınır; click listener'ları, ID'ler ve
   sayfa işlevleri korunur. Eylem butonları sonradan oluştuğunda da yakalanır. */
(function(){
  try{
    function sira(btn){
      if(btn.classList.contains("ub-btn--geri")) return 1;
      if(btn.classList.contains("ub-btn--bekle")) return 2;
      if(btn.classList.contains("ub-btn--kapat")) return 3;
      if(btn.classList.contains("ub-btn--menu")) return 4;
      if(btn.classList.contains("ub-btn--bilgi")) return 5;
      if(btn.classList.contains("ub-btn--kaydet")) return 6;
      if(btn.classList.contains("ub-btn--gonder")) return 7;
      return 99;
    }
    function etiket(btn){
      if(btn.classList.contains("ub-btn--geri")) return "Geri";
      if(btn.classList.contains("ub-btn--bekle")) return "Beklet";
      if(btn.classList.contains("ub-btn--kapat")) return "Kapat";
      if(btn.classList.contains("ub-btn--menu")) return "Menü";
      if(btn.classList.contains("ub-btn--bilgi")) return "BİM";
      if(btn.classList.contains("ub-btn--kaydet")) return "Kaydet";
      if(btn.classList.contains("ub-btn--gonder")) return "Gönder";
      return "";
    }
    function sarmala(btn){
      if(!btn || btn.parentElement.classList.contains("ub-tus-kutu")) return;
      var host=btn.parentElement;
      var kutu=document.createElement("div");
      kutu.className="ub-tus-kutu"+(btn.classList.contains("ub-btn--menu")?" ub-tus-kutu--menu":"");
      host.insertBefore(kutu,btn);
      kutu.appendChild(btn);
      var yazi=document.createElement("span");
      yazi.className="ub-btn-etiket";
      yazi.setAttribute("aria-hidden","true");
      yazi.textContent=etiket(btn);
      kutu.appendChild(yazi);
    }
    function duzenle(bar){
      var grup=bar.querySelector(".ub-grup");
      if(!grup) return;
      var eylem=bar.querySelector(".ub-eylem");
      if(eylem && eylem.parentElement!==grup) grup.appendChild(eylem);
      Array.prototype.slice.call(grup.querySelectorAll(":scope > .ub-btn")).forEach(sarmala);
      if(eylem){
        // Eylem kapsayıcısı korunur: send-render.js bu kapsayıcı içindeki
        // Kaydet/BİM düğümlerini kullanır. display:contents sayesinde üç
        // eylem düğmesi yine aynı flex satırında yer alır.
        Array.prototype.slice.call(eylem.querySelectorAll(":scope > .ub-btn")).forEach(sarmala);
        eylem.hidden=false;
        eylem.style.setProperty("display","contents","important");
        Array.prototype.slice.call(eylem.querySelectorAll(".ub-btn")).forEach(function(b){b.hidden=false;});
      }
      var kutular=Array.prototype.slice.call(grup.querySelectorAll(":scope > .ub-tus-kutu"));
      var sirali=kutular.slice().sort(function(a,b){return sira(a.querySelector(".ub-btn"))-sira(b.querySelector(".ub-btn"));});
      var siraDegisti=sirali.some(function(k,i){return kutular[i]!==k;});
      if(siraDegisti){
        sirali.forEach(function(k){grup.insertBefore(k,eylem||null);});
      }
      if(eylem && (eylem.parentElement!==grup || grup.lastElementChild!==eylem)) grup.appendChild(eylem);
    }
    function baslat(){
      var bar=document.querySelector(".ub-bar");
      if(!bar) return;
      var link=document.createElement("link");
      link.rel="stylesheet";
      link.href="ust-islem-cubugu.css?v=TKP.15.11.26-7-TUS-STANDART-01";
      document.head.appendChild(link);
      if((window.location.pathname.split("/").pop() || "index.html") !== "home.html"){
        var eylemScript=document.createElement("script");
        eylemScript.src="ust-bar-eylem.js?v=TKP.15.11.26-7-TUS-STANDART-01";
        document.body.appendChild(eylemScript);
      }
      duzenle(bar);
      var gozlem=new MutationObserver(function(){duzenle(bar);});
      gozlem.observe(bar,{childList:true,subtree:true});
    }
    if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",baslat,{once:true});
    else baslat();
  }catch(e){}
})();
