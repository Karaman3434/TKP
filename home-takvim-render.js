/*
  home-takvim-render.js — TKP.05.11.26-21:16.1489
  =================================================
  ANA SAYFA TAKVİMİ.

  - Aylık takvim. Pzt başlangıç, Cmt/Paz kırmızı yazı.
  - Zemin: BUGÜN DAHİL kalan iş günleri AÇIK MAVİ, geçen iş günleri AÇIK KIRMIZI,
    hafta sonları AÇIK YEŞİL. (İş günü = Pzt–Cum; resmi tatil hesabı yok.)
  - Günün sayısının ÜSTÜNDE: MAVİ rozet = temas + işlem sayısı (Ziyaret Takvimi
    sayfasındaki mavi sayıyla aynı kaynak), KIRMIZI rozet = ajanda sayfası.
  - Güne dokununca günün ÜSTÜNDE yarı genişlikte "Temas / Ajanda" penceresi açılır
    (21:12 isteği — Ziyaret Takvimi sayfasındaki "hangisi?" seçiminin aynısı).
    Satıra dokununca MEVCUT rota sürer: ziyaret.html?tarih=GÜN&gorunum=temas|ajanda
    (o sayfada ilgili panel doğrudan açılır).
  - Erişim: "ziyaret" izni yoksa (Çalışan Erişimi) bölüm hiç gösterilmez.
*/
(function(){
  var AY_ADLARI = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
  var GUN_ADLARI = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
  // Pencerenin iki satırı: Temas ve Ajanda (Ziyaret Takvimi sayfasındaki seçimle aynı).
  var SECENEKLER = ["temas","ajanda"];
  var TUR = {
    temas:  {ad:"Temas",  bg:"#2f6fd6", svg:'<path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/>'},
    ajanda: {ad:"Ajanda", bg:"#d6392f", svg:'<path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>'}
  };

  var yil, ay;               // görüntülenen ay (0-11)
  var seciliAnahtar = null;  // "YYYY-MM-DD"
  var kapsayici = null, grid = null, panelEl = null;
  var sonHtml = null;

  function pad(n){ return String(n).padStart(2,"0"); }
  function anahtar(y, m, d){ return y + "-" + pad(m+1) + "-" + pad(d); }
  function gosterimTarih(a){ var p = a.split("-"); return parseInt(p[2],10) + " " + AY_ADLARI[parseInt(p[1],10)-1] + " " + p[0]; }
  function gunAdi(a){ var p = a.split("-"); return GUN_ADLARI[new Date(+p[0], +p[1]-1, +p[2]).getDay()]; }
  function ikonHtml(t){ return "<span class='ht-ik' style='background:" + TUR[t].bg + "'><svg viewBox='0 0 24 24' aria-hidden='true'>" + TUR[t].svg + "</svg></span>"; }
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }

  // Gün başına temas sayısı: müşteri temas kayıtları + işlemler (Ziyaret Takvimi ile aynı kural).
  function temasSayilari(){
    var s = {};
    try{
      if(typeof CustomerData !== "undefined"){
        CustomerData.tumZiyaretTemaslar().forEach(function(z){
          var d = new Date(z.ts);
          var a = anahtar(d.getFullYear(), d.getMonth(), d.getDate());
          s[a] = (s[a] || 0) + 1;
        });
      }
      if(typeof IsTakipData !== "undefined" && IsTakipData.gunlukIslemSayilari){
        var is = IsTakipData.gunlukIslemSayilari();
        Object.keys(is).forEach(function(a){ s[a] = (s[a] || 0) + is[a]; });
      }
    }catch(e){}
    return s;
  }
  function ajandaSayilari(){
    try{ return (typeof AjandaData !== "undefined") ? AjandaData.gunSayilari() : {}; }catch(e){ return {}; }
  }

  function kurulum(){
    kapsayici = document.getElementById("anaTakvimAlan");
    if(!kapsayici) return;
    var bugun = new Date();
    yil = bugun.getFullYear(); ay = bugun.getMonth();
    kapsayici.innerHTML =
      "<button type='button' class='ht-ay-btn' id='htAySec'><span aria-hidden='true'>🗓️</span><span id='htAyBaslik'></span></button>"
      + "<div class='ht-takvim-kutu'>"
      +   "<div class='ht-gun-basliklari'><span>Pzt</span><span>Sal</span><span>Çar</span><span>Per</span><span>Cum</span><span class='ht-tatil-baslik'>Cmt</span><span class='ht-tatil-baslik'>Paz</span></div>"
      +   "<div class='ht-grid' id='htGrid'></div>"
      + "</div>";
    grid = document.getElementById("htGrid");
    document.getElementById("htAySec").onclick = aySecAc;
    // Günlere dokunma: hücreler yeniden çizilse de çalışsın diye TEK dinleyici (olay devri) — kapsayıcı grid'de.
    grid.addEventListener("click", function(ev){
      try{
        var h = ev.target && ev.target.closest ? ev.target.closest(".ht-gun:not(.ht-gun--bos)") : null;
        if(h && grid.contains(h)) gunSecildi(h.getAttribute("data-a"));
      }catch(e){ if(typeof hataGoster === "function") hataGoster("Gün açılamadı: " + e.message); }
    });
    document.addEventListener("click", function(ev){
      if(!panelEl) return;
      if(panelEl.contains(ev.target)) return;
      if(ev.target.closest && ev.target.closest(".ht-gun:not(.ht-gun--bos)")) return;
      if(grid && grid.contains(ev.target)) return;
      panelKapat();
    });
    takvimiCiz();
  }

  function takvimiCiz(){
    try{
      document.getElementById("htAyBaslik").textContent = AY_ADLARI[ay] + " " + yil;
      var temas = temasSayilari();
      var ajanda = ajandaSayilari();
      var ilk = new Date(yil, ay, 1);
      var bosluk = (ilk.getDay() + 6) % 7;
      var gunSayisi = new Date(yil, ay+1, 0).getDate();
      var bugun = new Date();
      var bugunA = anahtar(bugun.getFullYear(), bugun.getMonth(), bugun.getDate());
      var bugunDeger = new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate()).getTime();
      var html = "";
      for(var b=0; b<bosluk; b++) html += "<div class='ht-gun ht-gun--bos'></div>";
      for(var g=1; g<=gunSayisi; g++){
        var a = anahtar(yil, ay, g);
        var hg = new Date(yil, ay, g).getDay();
        var tatil = (hg === 0 || hg === 6);
        var sinif = "ht-gun";
        if(tatil) sinif += " ht-gun--tatil";
        else sinif += (new Date(yil, ay, g).getTime() >= bugunDeger) ? " ht-gun--kalan" : " ht-gun--gecmis";
        if(a === bugunA) sinif += " ht-gun--bugun";
        if(a === seciliAnahtar) sinif += " ht-gun--secili";
        var bildirim = temas[a] || 0; // temas + işlem
        var aj = ajanda[a] || 0;
        // Bildirim sayısı günün sayısının ÜSTÜNDE (kendi satırında); kırmızı = ajanda sayfası.
        html += "<div class='" + sinif + "' data-a='" + a + "'>"
          + "<span class='ht-bildirim'>"
          +   (bildirim > 0 ? "<span class='ht-rozet ht-rozet--temas'>" + bildirim + "</span>" : "")
          +   (aj > 0 ? "<span class='ht-rozet ht-rozet--ajanda'>" + aj + "</span>" : "")
          + "</span>"
          + "<span class='ht-gun-no'>" + g + "</span>"
          + "</div>";
      }
      // Aynı içerik ise hücreleri YENİDEN YAZMA: veri dinleyicileri sık tetiklenince
      // dokunma sırasında hücre sökülüp tıklama kaybolmasın (popup açılmama hatası).
      if(html !== sonHtml){ grid.innerHTML = html; sonHtml = html; }
      if(panelEl && seciliAnahtar) panelCiz(); // sayılar değiştiyse panel tazelensin
    }catch(e){ if(typeof hataGoster === "function") hataGoster("Takvim çizilemedi: " + e.message); }
  }

  function gunSecildi(a){
    if(seciliAnahtar === a && panelEl){ panelKapat(); return; }
    seciliAnahtar = a;
    takvimiCiz();
    panelCiz();
  }

  function panelKapat(){
    if(panelEl){ panelEl.remove(); panelEl = null; }
    if(seciliAnahtar){
      seciliAnahtar = null;
      var el = grid && grid.querySelector(".ht-gun--secili");
      if(el) el.classList.remove("ht-gun--secili");
      sonHtml = null; // DOM'u elle değiştirdik; sonraki çizim mutlaka yazılsın
    }
  }

  // Panel: seçili günün ÜSTÜNDE, kapsayıcının yarı genişliğinde. Satıra dokununca
  // mevcut rota sürer (Ziyaret Takvimi sayfasında ilgili panel doğrudan açılır).
  function panelCiz(){
    if(!seciliAnahtar) return;
    var sayi = {temas: temasSayilari()[seciliAnahtar] || 0, ajanda: ajandaSayilari()[seciliAnahtar] || 0};
    if(!panelEl){
      panelEl = document.createElement("div");
      panelEl.className = "ht-panel";
      kapsayici.appendChild(panelEl);
    }
    var p = seciliAnahtar.split("-");
    panelEl.innerHTML =
      "<div class='ht-panel-ust'><b>" + parseInt(p[2],10) + " " + AY_ADLARI[parseInt(p[1],10)-1] + " " + gunAdi(seciliAnahtar) + "</b></div>"
      + SECENEKLER.map(function(t){
          return "<div class='ht-satir' data-tur='" + t + "'>" + ikonHtml(t) + "<span class='ht-ad'>" + TUR[t].ad + "</span><span class='ht-say'>" + sayi[t] + "</span></div>";
        }).join("");
    panelEl.querySelectorAll(".ht-satir").forEach(function(el){
      el.onclick = function(ev){
        ev.stopPropagation();
        window.location.href = "ziyaret.html?tarih=" + encodeURIComponent(seciliAnahtar) + "&gorunum=" + this.getAttribute("data-tur");
      };
    });
    var hucre = grid.querySelector(".ht-gun--secili");
    if(!hucre) return;
    var kr = kapsayici.getBoundingClientRect(), cr = hucre.getBoundingClientRect();
    var w = Math.round(kr.width * 0.5);
    panelEl.style.width = w + "px";
    var sol = cr.left + cr.width/2 - kr.left - w/2;
    sol = Math.max(0, Math.min(sol, kr.width - w));
    panelEl.style.left = sol + "px";
    panelEl.style.setProperty("--ok", (cr.left + cr.width/2 - kr.left - sol) + "px");
    panelEl.style.top = (cr.top - kr.top - panelEl.offsetHeight - 10) + "px";
    try{
      var pr = panelEl.getBoundingClientRect();
      var ustBar = document.querySelector(".app-ust-sabit");
      var ustSinir = ustBar ? ustBar.getBoundingClientRect().bottom : 0;
      if(pr.top < ustSinir + 4) window.scrollBy(0, pr.top - ustSinir - 8);
    }catch(e){}
  }

  // ---------- AY SEÇ ----------
  function aySecAc(){
    var z = document.createElement("div");
    z.className = "ht-zemin";
    var bugun = new Date(), h = "";
    for(var i=-12; i<=12; i++){
      var d = new Date(bugun.getFullYear(), bugun.getMonth()+i, 1);
      var sec = (d.getFullYear()===yil && d.getMonth()===ay);
      h += "<div class='ht-ay-secenek" + (sec ? " ht-ay-secenek--secili" : "") + "' data-y='" + d.getFullYear() + "' data-a='" + d.getMonth() + "'>" + AY_ADLARI[d.getMonth()].slice(0,3) + " " + d.getFullYear() + "</div>";
    }
    z.innerHTML = "<div class='ht-ay-kutu'><div class='ht-ay-baslik'>Ay seç</div><div class='ht-ay-satir'>" + h + "</div></div>";
    document.body.appendChild(z);
    z.addEventListener("click", function(ev){ if(ev.target === z) z.remove(); });
    z.querySelectorAll(".ht-ay-secenek").forEach(function(el){
      el.onclick = function(){
        yil = parseInt(this.getAttribute("data-y"),10); ay = parseInt(this.getAttribute("data-a"),10);
        panelKapat(); takvimiCiz(); z.remove();
      };
    });
    var s = z.querySelector(".ht-ay-secenek--secili");
    if(s && s.scrollIntoView) s.scrollIntoView({inline:"center", block:"nearest"});
  }

  // ---------- BAŞLAT ----------
  function erisimUygula(){
    if(!kapsayici) return;
    if(window.ISTAKIP_IZINLER === undefined) return; // izinler henüz çözülmedi
    var blok = document.getElementById("anaTakvimBlok");
    var izinli = (typeof window.izinVarMi === "function") ? window.izinVarMi("ziyaret") : true;
    if(blok) blok.hidden = !izinli;
  }

  document.addEventListener("DOMContentLoaded", function(){
    kurulum();
    erisimUygula();
    if(typeof CustomerData !== "undefined" && CustomerData.listeDegistiginde) CustomerData.listeDegistiginde(function(){ takvimiCiz(); });
    if(typeof AjandaData !== "undefined") AjandaData.degistiginde(function(){ takvimiCiz(); });
    if(typeof IsTakipData !== "undefined" && IsTakipData.bildirimDegistiginde) IsTakipData.bildirimDegistiginde(function(){ takvimiCiz(); });
    window.addEventListener("istakipAuthHazir", erisimUygula);
  });
})();
