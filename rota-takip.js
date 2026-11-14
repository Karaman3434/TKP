/*
  rota-takip.js — İŞ TAKİP / ROTA PANELİ
  Rota paneli yalnızca mevcut sayfayı ve o sayfaya gelinen gezinme yolunu gösterir.
  Önceki duraklar tıklanabilir; son durak aktif sayfadır.
*/
var RotaTakip = (function(){
  var ANAHTAR = "weiconv2_rota_yigin";

  function yiginiOku(){
    try {
      var veri = JSON.parse(sessionStorage.getItem(ANAHTAR) || "[]");
      return Array.isArray(veri) ? veri.filter(function(x){ return x && x.href && x.etiket; }) : [];
    } catch(e) { return []; }
  }
  function yiginiYaz(yigin){
    try { sessionStorage.setItem(ANAHTAR, JSON.stringify(yigin)); } catch(e) {}
  }
  function kaydet(href, etiket, sifirlaMi){
    var yigin = sifirlaMi ? [] : yiginiOku();
    var mevcutIdx = -1;
    for(var i=0;i<yigin.length;i++){
      if(yigin[i].href === href){ mevcutIdx = i; break; }
    }
    if(mevcutIdx !== -1) yigin = yigin.slice(0, mevcutIdx + 1);
    else yigin.push({href: href, etiket: etiket});
    yiginiYaz(yigin);
    return yigin;
  }
  function sifirla(){ yiginiYaz([]); }

  function gorunenEtiket(etiket){
    return String(etiket || "").replace(/^\S+\s+/, function(ilk){
      return /[A-Za-zÇĞİIÖŞÜçğıiöşü]/.test(ilk) ? ilk : "";
    }).trim();
  }
  function stilEkle(){
    if(document.getElementById("rotaPanelStili")) return;
    var css = document.createElement("style");
    css.id = "rotaPanelStili";
    css.textContent = [
      ".ub-sayfa-etiket.rota-panel{order:5;flex:0 0 100%;width:100%;height:auto;min-width:0;margin:0;padding:1mm;display:flex;align-items:center;justify-content:flex-start;gap:1mm;box-sizing:border-box;background:#e0730f;border:0;border-radius:0;overflow-x:auto;overflow-y:hidden;white-space:nowrap;-webkit-overflow-scrolling:touch;scrollbar-width:none;}",
      ".ub-sayfa-etiket.rota-panel::-webkit-scrollbar{display:none;}",
      ".rota-panel-durak{display:inline-flex;align-items:center;flex:0 0 auto;min-width:0;color:#fff;text-decoration:none;font-size:12px;font-weight:700;line-height:1.2;padding:0;margin:0;white-space:nowrap;background:transparent;border:0;}",
      ".rota-panel-durak--aktif{font-size:15px;font-weight:900;}",
      ".rota-panel-ayrac{display:inline-block;flex:0 0 1px;width:1px;height:13px;background:rgba(255,255,255,.85);margin:0 1mm;}",
      ".rota-panel-durak:focus-visible{outline:2px solid #fff;outline-offset:2px;border-radius:2px;}"
    ].join("");
    document.head.appendChild(css);
  }
  function ciz(konteynerId){
    var el = document.getElementById(konteynerId);
    if(!el) return;
    var yigin = yiginiOku();
    if(!yigin.length){ el.textContent = ""; return; }
    stilEkle();
    el.classList.add("rota-panel");
    el.setAttribute("aria-label", "Bulunduğunuz sayfa ve gezinme rotası");
    el.replaceChildren();

    yigin.forEach(function(durak, index){
      if(index > 0){
        var ayirac = document.createElement("span");
        ayirac.className = "rota-panel-ayrac";
        ayirac.setAttribute("aria-hidden", "true");
        el.appendChild(ayirac);
      }
      var metin = gorunenEtiket(durak.etiket);
      if(index === yigin.length - 1){
        var aktif = document.createElement("span");
        aktif.className = "rota-panel-durak rota-panel-durak--aktif";
        aktif.textContent = metin;
        aktif.setAttribute("aria-current", "page");
        el.appendChild(aktif);
      } else {
        var baglanti = document.createElement("a");
        baglanti.className = "rota-panel-durak";
        baglanti.href = durak.href;
        baglanti.textContent = metin;
        el.appendChild(baglanti);
      }
    });
    // En son durak görünür kalsın; uzun rotalarda panel yatay kaydırılabilir.
    el.scrollLeft = el.scrollWidth;
  }
  return {kaydet:kaydet, ciz:ciz, sifirla:sifirla};
})();
