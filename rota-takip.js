/*
  rota-takip.js — İŞ TAKİP / ROTA PANELİ
  Yalnızca mevcut sayfayı ve o sayfaya gelinen gezinme yolunu gösterir.
  Önceki duraklar bağlantıdır; son durak mevcut sayfadır.
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
    if(!yigin.length && href !== "home.html"){
      yigin.push({href:"home.html", etiket:"Ana Sayfa"});
    }
    var mevcutIdx = -1;
    for(var i=0;i<yigin.length;i++){
      if(yigin[i].href === href){ mevcutIdx = i; break; }
    }
    if(mevcutIdx !== -1) yigin = yigin.slice(0, mevcutIdx + 1);
    else yigin.push({href:href, etiket:etiket});
    yiginiYaz(yigin);
    return yigin;
  }
  function sifirla(){ yiginiYaz([]); }

  function gorunenEtiket(etiket){
    var s = String(etiket || "").trim();
    var parca = s.match(/^(\S+)\s+(.+)$/);
    if(parca && !/[A-Za-zÇĞİIÖŞÜçğıiöşü]/.test(parca[1])) return parca[2].trim();
    return s;
  }
  function stilEkle(){
    if(document.getElementById("rotaPanelStiliV2")) return;
    var css = document.createElement("style");
    css.id = "rotaPanelStiliV2";
    css.textContent = [
      /* Eski .ub-sayfa-etiket ve iç span stillerini yüksek özgüllükle sıfırla. */
      ".ub-bar .ub-sayfa-etiket.rota-panel{order:5!important;flex:0 0 100%!important;width:100%!important;min-width:0!important;height:auto!important;min-height:30px!important;margin:0!important;padding:1mm!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:1mm!important;box-sizing:border-box!important;background:#e0730f!important;border:0!important;border-radius:0!important;overflow-x:auto!important;overflow-y:hidden!important;white-space:nowrap!important;-webkit-overflow-scrolling:touch!important;scrollbar-width:none!important;text-align:left!important;}",
      ".ub-bar .ub-sayfa-etiket.rota-panel::-webkit-scrollbar{display:none!important;}",
      ".ub-bar .ub-sayfa-etiket.rota-panel > .rota-panel-baslangic{display:inline-flex!important;flex:0 0 auto!important;align-items:center!important;height:auto!important;line-height:1!important;padding:0!important;margin:0 1mm 0 0!important;background:transparent!important;border:0!important;border-radius:0!important;color:#fff!important;font-size:9px!important;font-weight:900!important;letter-spacing:1px!important;}",
      ".ub-bar .ub-sayfa-etiket.rota-panel > .rota-panel-ayrac{display:inline-block!important;flex:0 0 1px!important;width:1px!important;height:13px!important;min-height:13px!important;line-height:1!important;padding:0!important;margin:0 1mm!important;background:rgba(255,255,255,.9)!important;border:0!important;}",
      ".ub-bar .ub-sayfa-etiket.rota-panel > .rota-panel-durak{display:inline-flex!important;flex:0 0 auto!important;align-items:center!important;justify-content:flex-start!important;width:auto!important;max-width:none!important;min-width:0!important;height:auto!important;min-height:0!important;line-height:1.2!important;padding:0!important;margin:0!important;background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;color:#fff!important;text-decoration:none!important;font-size:12px!important;font-weight:700!important;white-space:nowrap!important;}",
      ".ub-bar .ub-sayfa-etiket.rota-panel > .rota-panel-durak--aktif{font-size:15px!important;font-weight:900!important;}",
      ".ub-bar .ub-sayfa-etiket.rota-panel > .rota-panel-durak:focus-visible{outline:2px solid #fff!important;outline-offset:2px!important;border-radius:2px!important;}"
    ].join("");
    document.head.appendChild(css);
  }
  function ciz(konteynerId){
    var el = document.getElementById(konteynerId);
    if(!el) return;
    var yigin = yiginiOku();
    if(!yigin.length) return;
    stilEkle();
    el.classList.add("rota-panel");
    el.setAttribute("aria-label","Bulunduğunuz sayfa ve gezinme rotası");
    el.replaceChildren();

    var baslangic = document.createElement("span");
    baslangic.className = "rota-panel-baslangic";
    baslangic.textContent = "•••";
    baslangic.setAttribute("aria-hidden","true");
    el.appendChild(baslangic);

    yigin.forEach(function(durak,index){
      if(index > 0){
        var ayirac = document.createElement("span");
        ayirac.className = "rota-panel-ayrac";
        ayirac.setAttribute("aria-hidden","true");
        el.appendChild(ayirac);
      }
      var metin = gorunenEtiket(durak.etiket);
      var uzaklik = yigin.length - 1 - index;
      var boyut = 15 * Math.pow(0.8,uzaklik);
      var oge;
      if(index === yigin.length - 1){
        oge = document.createElement("span");
        oge.className = "rota-panel-durak rota-panel-durak--aktif";
        oge.setAttribute("aria-current","page");
      } else {
        oge = document.createElement("a");
        oge.className = "rota-panel-durak";
        oge.href = durak.href;
      }
      oge.textContent = metin;
      oge.style.setProperty("font-size",boyut.toFixed(1)+"px","important");
      el.appendChild(oge);
    });
    el.scrollLeft = el.scrollWidth;
  }
  return {kaydet:kaydet,ciz:ciz,sifirla:sifirla};
})();
