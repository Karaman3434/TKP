/*
  home-takvim-render.js — TKP.05.11.26-17:38.1487
  =================================================
  ANA SAYFA TAKVİMİ (05.11.2026, Abdullah onayı — mockup onaylandı).

  - Ürün görselinin yerine aylık takvim. Pzt başlangıç, Cmt/Paz kırmızı yazı.
  - İş günü rengi: BUGÜN DAHİL kalan iş günleri YEŞİL, geçen iş günleri AÇIK
    KIRMIZI (hafta sonu renksiz). Geçmiş aylarda tüm iş günleri açık kırmızı,
    gelecek aylarda hepsi yeşil. (İş günü = Pzt–Cum; "İş günü kaldı" kutusuyla
    aynı kural — resmi tatil hesabı yok.)
  - Günde MAVİ rozet = o günün toplam temas sayısı (müşteriye bağlı temas
    kayıtları + not defterindeki dolu satırlar), KIRMIZI rozet = ajanda sayfası.
  - Güne dokununca günün ÜSTÜNDE yarı genişlikte panel açılır: Ziyaret /
    Telefon / Mail / WhatsApp + sayılar. Satıra dokununca NOT DEFTERİ açılır
    (serbest metin, yazdıkça kaydedilir, dışına dokununca kapanır).
  - Erişim: "ziyaret" izni yoksa (Çalışan Erişimi) bölüm hiç gösterilmez.
*/
(function(){
  var AY_ADLARI = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
  var GUN_ADLARI = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
  var TURLER = ["ziyaret","telefon","mail","whatsapp"];
  var TUR = {
    ziyaret:  {ad:"Ziyaret",  bg:"#e0730f", svg:'<path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/>'},
    telefon:  {ad:"Telefon",  bg:"#1257c7", svg:'<path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2z"/>'},
    mail:     {ad:"Mail",     bg:"#7a4fd0", svg:'<path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/>'},
    whatsapp: {ad:"WhatsApp", bg:"#25b858", svg:'<path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 13.9c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7a11 11 0 0 1-4.7-4.1c-.4-.5-1.2-1.6-1.2-3s.8-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.4.6-.3.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.2 1.4 2.5 1.5.3.1.5.1.6-.1l.9-1.1c.2-.2.4-.2.6-.1l2 1c.3.1.5.2.5.3.1.2.1.8-.1 1.4z"/>'}
  };

  var yil, ay;               // görüntülenen ay (0-11)
  var seciliAnahtar = null;  // "YYYY-MM-DD"
  var kapsayici = null, grid = null, panelEl = null;
  var defterAcik = null;     // {tarih, tur} — not defteri açıkken

  function pad(n){ return String(n).padStart(2,"0"); }
  function anahtar(y, m, d){ return y + "-" + pad(m+1) + "-" + pad(d); }
  function gosterimTarih(a){ var p = a.split("-"); return parseInt(p[2],10) + " " + AY_ADLARI[parseInt(p[1],10)-1] + " " + p[0]; }
  function gunAdi(a){ var p = a.split("-"); return GUN_ADLARI[new Date(+p[0], +p[1]-1, +p[2]).getDay()]; }
  function ikonHtml(t){ return "<span class='ht-ik' style='background:" + TUR[t].bg + "'><svg viewBox='0 0 24 24' aria-hidden='true'>" + TUR[t].svg + "</svg></span>"; }
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }

  // Müşteriye bağlı temas kayıtları — {tarih: {tur: [kayıt,...]}}
  function musteriTemaslari(){
    var s = {};
    try{
      if(typeof CustomerData === "undefined") return s;
      CustomerData.tumZiyaretTemaslar().forEach(function(z){
        var d = new Date(z.ts);
        var a = anahtar(d.getFullYear(), d.getMonth(), d.getDate());
        var t = TUR[z.tur] ? z.tur : "ziyaret";
        ((s[a] = s[a] || {})[t] = s[a][t] || []).push(z);
      });
    }catch(e){}
    return s;
  }
  function gunTurSayilari(a){
    var m = musteriTemaslari()[a] || {};
    var defter = (typeof GunNotlariData !== "undefined") ? (GunNotlariData.gunSayilari()[a] || {}) : {};
    var sonuc = {}, toplam = 0;
    TURLER.forEach(function(t){
      var n = (m[t] ? m[t].length : 0) + (defter[t] || 0);
      sonuc[t] = n; toplam += n;
    });
    return {tur: sonuc, toplam: toplam};
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
    document.addEventListener("click", function(ev){
      if(!panelEl) return;
      if(panelEl.contains(ev.target)) return;
      if(ev.target.closest && ev.target.closest(".ht-gun:not(.ht-gun--bos)")) return;
      panelKapat();
    });
    takvimiCiz();
  }

  function takvimiCiz(){
    try{
      document.getElementById("htAyBaslik").textContent = AY_ADLARI[ay] + " " + yil;
      var temas = musteriTemaslari();
      var defter = (typeof GunNotlariData !== "undefined") ? GunNotlariData.gunSayilari() : {};
      var ajanda = (typeof AjandaData !== "undefined") ? AjandaData.gunSayilari() : {};
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
        var tm = 0, mt = temas[a] || {}, dn = defter[a] || {};
        TURLER.forEach(function(t){ tm += (mt[t] ? mt[t].length : 0) + (dn[t] || 0); });
        var aj = ajanda[a] || 0;
        html += "<div class='" + sinif + "' data-a='" + a + "'>" + g
          + (tm > 0 ? "<span class='ht-rozet ht-rozet--temas'>" + tm + "</span>" : "")
          + (aj > 0 ? "<span class='ht-rozet ht-rozet--ajanda'>" + aj + "</span>" : "")
          + "</div>";
      }
      grid.innerHTML = html;
      grid.querySelectorAll(".ht-gun:not(.ht-gun--bos)").forEach(function(el){
        el.onclick = function(){ gunSecildi(this.getAttribute("data-a")); };
      });
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
    }
  }

  // Panel: seçili günün ÜSTÜNDE, kapsayıcının yarı genişliğinde.
  function panelCiz(){
    if(!seciliAnahtar) return;
    var s = gunTurSayilari(seciliAnahtar);
    if(!panelEl){
      panelEl = document.createElement("div");
      panelEl.className = "ht-panel";
      kapsayici.appendChild(panelEl);
    }
    panelEl.innerHTML =
      "<div class='ht-panel-ust'><b>" + parseInt(seciliAnahtar.split("-")[2],10) + " " + AY_ADLARI[parseInt(seciliAnahtar.split("-")[1],10)-1] + " " + gunAdi(seciliAnahtar) + "</b><span>" + s.toplam + " temas</span></div>"
      + TURLER.map(function(t){
          return "<div class='ht-satir' data-tur='" + t + "'>" + ikonHtml(t) + "<span class='ht-ad'>" + TUR[t].ad + "</span><span class='ht-say'>" + s.tur[t] + "</span></div>";
        }).join("");
    panelEl.querySelectorAll(".ht-satir").forEach(function(el){
      el.onclick = function(ev){ ev.stopPropagation(); defterAc(seciliAnahtar, this.getAttribute("data-tur")); };
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

  // ---------- NOT DEFTERİ ----------
  function defterAc(a, tur){
    var zemin = document.createElement("div");
    zemin.className = "ht-zemin";
    var kayitlar = ((musteriTemaslari()[a] || {})[tur] || []).slice().sort(function(x, y){ return x.ts - y.ts; });
    var kayitHtml = kayitlar.map(function(k){
      var d = new Date(k.ts);
      return "<div class='ht-d-kayit'><i>" + pad(d.getHours()) + ":" + pad(d.getMinutes()) + "</i>" + esc(k.musteri) + (k.not ? " <em>— " + esc(k.not) + "</em>" : "") + "</div>";
    }).join("");
    zemin.innerHTML =
      "<div class='ht-defter'>"
      + "<div class='ht-d-baslik'>" + ikonHtml(tur) + "<div><b>" + TUR[tur].ad + "</b><small id='htDSayi'></small></div></div>"
      + "<div class='ht-d-kagit'>" + kayitHtml + "<textarea class='ht-d-metin' id='htDMetin' placeholder='Not yaz…' spellcheck='false'></textarea></div>"
      + "<div class='ht-d-alt' id='htDAlt'>Yazdıkça kendiliğinden kaydedilir · kapatmak için dışına dokun</div>"
      + "</div>";
    document.body.appendChild(zemin);
    var ta = zemin.querySelector("#htDMetin");
    var sayiEl = zemin.querySelector("#htDSayi");
    var altEl = zemin.querySelector("#htDAlt");
    ta.value = (typeof GunNotlariData !== "undefined") ? GunNotlariData.metin(a, tur) : "";
    defterAcik = {tarih: a, tur: tur};

    function sayiYaz(){
      var n = kayitlar.length + (typeof GunNotlariData !== "undefined" ? GunNotlariData.doluSatirSayisi(ta.value) : 0);
      sayiEl.textContent = gosterimTarih(a) + " · " + n + " not";
    }
    function boyutla(){ ta.style.height = "auto"; ta.style.height = Math.max(228, ta.scrollHeight) + "px"; }
    var zamanlayici = null, kirli = false;
    function kaydet(){
      if(!kirli) return;
      kirli = false;
      if(typeof GunNotlariData === "undefined") return;
      GunNotlariData.kaydet(a, tur, ta.value, function(ok){
        if(!document.body.contains(altEl)) return;
        altEl.classList.toggle("ht-d-alt--hata", !ok);
        altEl.textContent = ok ? "Kaydedildi ✓ · kapatmak için dışına dokun" : "Bu cihazda saklandı, buluta kaydedilemedi (bağlantı/izin)";
      });
    }
    ta.addEventListener("input", function(){
      kirli = true; sayiYaz(); boyutla();
      altEl.classList.remove("ht-d-alt--hata"); altEl.textContent = "Yazılıyor…";
      clearTimeout(zamanlayici); zamanlayici = setTimeout(kaydet, 600);
    });
    function kapat(){
      clearTimeout(zamanlayici); kaydet();
      zemin.remove(); defterAcik = null;
    }
    zemin.addEventListener("click", function(ev){ if(ev.target === zemin) kapat(); });
    sayiYaz(); boyutla();
    setTimeout(function(){ try{ ta.focus(); }catch(e){} }, 50);
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
    if(typeof GunNotlariData !== "undefined") GunNotlariData.degistiginde(function(){ takvimiCiz(); });
    window.addEventListener("istakipAuthHazir", erisimUygula);
  });
})();
