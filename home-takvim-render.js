/*
  home-takvim-render.js — TKP.11.11.26-18:32.1577
  =================================================
  ANA SAYFA TAKVİMİ.

  - Aylık takvim. Pzt başlangıç, Cmt/Paz kırmızı yazı.
  - Zemin: BUGÜN DAHİL kalan iş günleri AÇIK MAVİ, geçen iş günleri AÇIK KIRMIZI,
    hafta sonları AÇIK YEŞİL. (İş günü = Pzt–Cum; resmi tatil hesabı yok.)
  - Günün sayısının ÜSTÜNDE: MAVİ rozet = temas + işlem sayısı (Ziyaret Takvimi
    sayfasındaki mavi sayıyla aynı kaynak), KIRMIZI rozet = ajanda sayfası.
  - Güne dokununca günün ÜSTÜNDE yarı genişlikte "Temas / Ajanda" penceresi açılır.
    AJANDA (06.11.2026) → açılır pencere: üstte aynı not defteri, altta o günün el yazısı ajanda fotoğrafları
    (kamera/dosya tuşları resmin üstünde, yana kaydırınca gün gün, köşeden küçült/büyüt). Kod: ajanda-foto.js.
    TEMAS (21:42 onayı) → tek pencere: üstte Ziyaret/Telefon/Mail/WhatsApp logoları (yeni kaydın türü),
    çizgili kâğıtta günün temas satırları + işlemler, altta YENİ KAYIT (firma ara, not, hatırlatma, Kaydet).
  - "Bugün" şeridi (06.11.2026, Seçenek A): ay butonunun altında bugünün işlem/sipariş/temas sayıları
    (eski ana sayfa "Günün özeti" paneli kaldırıldı).
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

  // Temas'a dokununca açılan 4 türlü liste (bugün tasarlanan rota) + not defteri.
  var TURLER = ["ziyaret","telefon","mail","whatsapp"];
  var TUR_T = {
    ziyaret:  {ad:"Ziyaret",  bg:"#e0730f", svg:'<path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/>'},
    telefon:  {ad:"Telefon",  bg:"#1257c7", svg:'<path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2z"/>'},
    mail:     {ad:"Mail",     bg:"#7a4fd0", svg:'<path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/>'},
    whatsapp: {ad:"WhatsApp", bg:"#25b858", svg:'<path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 13.9c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7a11 11 0 0 1-4.7-4.1c-.4-.5-1.2-1.6-1.2-3s.8-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.4.6-.3.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.2 1.4 2.5 1.5.3.1.5.1.6-.1l.9-1.1c.2-.2.4-.2.6-.1l2 1c.3.1.5.2.5.3.1.2.1.8-.1 1.4z"/>'}
  };

  var yil, ay;               // görüntülenen ay (0-11)
  var seciliAnahtar = null;  // "YYYY-MM-DD"
  var kapsayici = null, grid = null, panelEl = null;
  var sonHtml = null;
  var temasYenile = null;    // Temas penceresi açıkken veri değişince listeyi tazeler

  function pad(n){ return String(n).padStart(2,"0"); }
  function anahtar(y, m, d){ return y + "-" + pad(m+1) + "-" + pad(d); }
  function gosterimTarih(a){ var p = a.split("-"); return parseInt(p[2],10) + " " + AY_ADLARI[parseInt(p[1],10)-1] + " " + p[0]; }
  function gunAdi(a){ var p = a.split("-"); return GUN_ADLARI[new Date(+p[0], +p[1]-1, +p[2]).getDay()]; }
  function ikonHtml(t, harita){ harita = harita || TUR; return "<span class='ht-ik' style='background:" + harita[t].bg + "'><svg viewBox='0 0 24 24' aria-hidden='true'>" + harita[t].svg + "</svg></span>"; }
  // KOD - İsim (09.11.2026): müşteri adının önüne kod — tek kaynak CustomerData.kodAdHtml.
  function kodAd(id, ad){ return (typeof CustomerData !== "undefined" && CustomerData.kodAdHtml) ? CustomerData.kodAdHtml(id, ad) : esc(ad); }
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }

  // Müşteriye bağlı temas kayıtları — {tarih: {tur: [kayıt,...]}}
  function musteriTemaslari(){
    var s = {};
    try{
      if(typeof CustomerData === "undefined") return s;
      CustomerData.tumZiyaretTemaslar().forEach(function(z){
        if(z.odemeNotu) return;   // ödeme notu: "Ödeme alındı" satırında gösterilir (11.11.2026)
        var d = new Date(z.ts);
        var a = anahtar(d.getFullYear(), d.getMonth(), d.getDate());
        var t = TUR_T[z.tur] ? z.tur : "ziyaret";
        ((s[a] = s[a] || {})[t] = s[a][t] || []).push(z);
      });
    }catch(e){}
    return s;
  }
  function defterSayilari(){
    try{ return (typeof GunNotlariData !== "undefined") ? GunNotlariData.gunSayilari() : {}; }catch(e){ return {}; }
  }
  // Bir günün tür bazında temas sayısı (müşteri temas kaydı + defterin dolu satırları).
  function gunTurSayilari(a){
    var m = musteriTemaslari()[a] || {};
    var defter = defterSayilari()[a] || {};
    var sonuc = {}, toplam = 0;
    TURLER.forEach(function(t){
      var n = (m[t] ? m[t].length : 0) + (defter[t] || 0);
      sonuc[t] = n; toplam += n;
    });
    return {tur: sonuc, toplam: toplam};
  }
  // Alınan ödemeler (faturası ödendi yapılanlar) — gün anahtarına göre; gün sayısına ve gün penceresine eklenir.
  function odemeGunleri(){
    try{ return (typeof VadeTakip !== "undefined" && VadeTakip.odemeGunleri) ? VadeTakip.odemeGunleri() : {}; }catch(e){ return {}; }
  }
  function islemSayisi(a){
    var n = 0;
    try{ n = (typeof IsTakipData !== "undefined" && IsTakipData.gunlukIslemSayilari) ? (IsTakipData.gunlukIslemSayilari()[a] || 0) : 0; }catch(e){ n = 0; }
    return n + (odemeGunleri()[a] || []).length;
  }
  // Gün başına rozet/“Temas” sayısı: temas (müşteri + defter) + işlem — Ziyaret Takvimi'ndeki mavi sayı gibi.
  function temasSayilari(){
    var s = {};
    try{
      var m = musteriTemaslari(), d = defterSayilari();
      Object.keys(m).forEach(function(a){ TURLER.forEach(function(t){ s[a] = (s[a]||0) + (m[a][t] ? m[a][t].length : 0); }); });
      Object.keys(d).forEach(function(a){ TURLER.forEach(function(t){ s[a] = (s[a]||0) + (d[a][t] || 0); }); });
      if(typeof IsTakipData !== "undefined" && IsTakipData.gunlukIslemSayilari){
        var is = IsTakipData.gunlukIslemSayilari();
        Object.keys(is).forEach(function(a){ s[a] = (s[a] || 0) + is[a]; });
      }
      var od = odemeGunleri();
      Object.keys(od).forEach(function(a){ s[a] = (s[a] || 0) + od[a].length; });
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
      // Onaylı yerleşim: tarih ve satış özetlerinin altında; günlük özet takvimden hemen önce, ayrı şeritte.
      "<div class='ht-takvim-kutu' id='htTakvimKutu'>"
      +   "<span id='htAyBaslik' class='ht-sr-only' aria-hidden='true'></span>"
      +   "<div class='ht-gun-basliklari'><span>Pzt</span><span>Sal</span><span>Çar</span><span>Per</span><span>Cum</span><span class='ht-tatil-baslik'>Cmt</span><span class='ht-tatil-baslik'>Paz</span></div>"
      +   "<div class='ht-grid' id='htGrid'></div>"
      + "</div>";
    grid = document.getElementById("htGrid");
    swipeKur(document.getElementById("htTakvimKutu"));
    // 08.11.2026 (Abdullah onayı): "Bugün" etiketine dokununca bugünün Not + Ajanda penceresi açılır.
    document.getElementById("htOzetBugun").onclick = function(){
      var b = new Date();
      panelKapat();
      ajandaAc(anahtar(b.getFullYear(), b.getMonth(), b.getDate()));
    };
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
      if(ev.target.closest && ev.target.closest(".ht-zemin")) return; // defteri/ay seçimini kapatan dokunuş paneli kapatmasın
      if(ev.target.closest && ev.target.closest(".ht-gun:not(.ht-gun--bos)")) return;
      if(grid && grid.contains(ev.target)) return;
      panelKapat();
    });
    takvimiCiz();
  }

  // "Bugün" şeridi (06.11.2026, Abdullah — Seçenek A): eski "Günün özeti" panelinin yerine.
  // İşlem/sipariş = IsTakipData.gununIslemOzeti(); temas = müşteri temas kaydı + defterin dolu satırları.
  function ozetCiz(){
    try{
      var b = new Date();
      var a = anahtar(b.getFullYear(), b.getMonth(), b.getDate());
      var islem = 0, siparis = 0;
      try{
        if(typeof IsTakipData !== "undefined" && IsTakipData.gununIslemOzeti){
          var o = IsTakipData.gununIslemOzeti();
          islem = o.toplam || 0; siparis = (o.dokum && o.dokum.siparis) || 0;
        }
      }catch(e){}
      var set = function(id, v){ var el = document.getElementById(id); if(el) el.textContent = v; };
      set("htOzetIslem", islem); set("htOzetSiparis", siparis); set("htOzetTemas", gunTurSayilari(a).toplam);
    }catch(e){}
  }

  function takvimiCiz(){
    try{
      ozetCiz();
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
        // Ayrı veri kaynakları: mavi = günlük işlem/ödeme, turuncu = müşteri teması/ziyaret.
        var islemAdet = islemSayisi(a);
        var temasAdet = gunTurSayilari(a).toplam;
        html += "<div class='" + sinif + "' data-a='" + a + "'>"
          + "<span class='ht-bildirim' aria-hidden='true'>"
          +   (islemAdet > 0 ? "<span class='ht-rozet ht-rozet--islem'>" + islemAdet + "</span>" : "")
          +   (temasAdet > 0 ? "<span class='ht-rozet ht-rozet--temas'>" + temasAdet + "</span>" : "")
          + "</span>"
          + "<span class='ht-gun-no'>" + g + "</span>"
          + "</div>";
      }
      // Aynı içerik ise hücreleri YENİDEN YAZMA: veri dinleyicileri sık tetiklenince
      // dokunma sırasında hücre sökülüp tıklama kaybolmasın (popup açılmama hatası).
      if(html !== sonHtml){ grid.innerHTML = html; sonHtml = html; }
      if(panelEl && seciliAnahtar) panelCiz(); // sayılar değiştiyse panel tazelensin
      if(temasYenile) temasYenile();
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

  // Panel: seçili günün ÜSTÜNDE, kapsayıcının yarı genişliğinde.
  //  - ilk görünüm: Temas | Ajanda. Ajanda → Ziyaret Takvimi sayfasında ajanda paneli (mevcut rota);
  //    Temas → aynı pencerede Ziyaret / Telefon / Mail / WhatsApp listesi, satıra dokununca NOT DEFTERİ.
  function panelCiz(){
    if(!seciliAnahtar) return;
    if(!panelEl){
      panelEl = document.createElement("div");
      panelEl.className = "ht-panel";
      kapsayici.appendChild(panelEl);
    }
    var p = seciliAnahtar.split("-");
    var baslik = parseInt(p[2],10) + " " + AY_ADLARI[parseInt(p[1],10)-1] + " " + gunAdi(seciliAnahtar);
    {
      var sayi = {temas: temasSayilari()[seciliAnahtar] || 0, ajanda: ajandaSayilari()[seciliAnahtar] || 0};
      panelEl.innerHTML =
        "<div class='ht-panel-ust'><b>" + baslik + "</b></div>"
        + SECENEKLER.map(function(t){
            return "<div class='ht-satir' data-tur='" + t + "'>" + ikonHtml(t) + "<span class='ht-ad'>" + TUR[t].ad + "</span><span class='ht-say'>" + sayi[t] + "</span></div>";
          }).join("");
      panelEl.querySelectorAll(".ht-satir").forEach(function(el){
        el.onclick = function(ev){
          ev.stopPropagation();
          if(this.getAttribute("data-tur") === "temas") temasAc(seciliAnahtar);
          else ajandaAc(seciliAnahtar);
        };
      });
    }
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

  // ---------- AY DEĞİŞTİR (kaydırma) ----------
  // 09.11.2026 (Abdullah onayı): takvim sağa/sola kaydırılınca ay değişir (sola kaydır = sonraki ay).
  function ayKaydir(d){
    var t = new Date(yil, ay + d, 1);
    yil = t.getFullYear(); ay = t.getMonth();
    panelKapat(); takvimiCiz();
  }
  function swipeKur(el){
    if(!el) return;
    var x0 = 0, y0 = 0, aktif = false;
    el.addEventListener("touchstart", function(e){
      if(e.touches.length !== 1){ aktif = false; return; }
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; aktif = true;
    }, {passive:true});
    el.addEventListener("touchend", function(e){
      if(!aktif) return; aktif = false;
      var c = e.changedTouches[0], dx = c.clientX - x0, dy = c.clientY - y0;
      if(Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.5) ayKaydir(dx < 0 ? 1 : -1);
    }, {passive:true});
  }

  // ---------- TEMAS PENCERESİ (21:42 onayı — mockup: Not defteri + Ziyaret Takvimi temas paneli) ----------
  // Üst: tür logoları (aynı zamanda yeni kaydın türü). Çizgili kâğıtta günün temas satırları
  // (+ eski serbest defter satırları), "İŞLEMLER" ve altta "YENİ KAYIT": firma ara, not, hatırlatma, Kaydet.
  // Kayıt müşterinin temas geçmişine CustomerData.ziyaretEkle ile yazılır (Ziyaret Takvimi ile aynı kaynak).
  function tutarYaz(v){ return (Math.round((v || 0) * 100) / 100).toLocaleString("tr-TR", {minimumFractionDigits:2, maximumFractionDigits:2}) + " €"; }
  function hhmm(ts){ var d = new Date(ts); return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function miniIk(t){ return "<span class='ht-mk' style='background:" + TUR_T[t].bg + "'><svg viewBox='0 0 24 24' aria-hidden='true'>" + TUR_T[t].svg + "</svg></span>"; }
  function yarinAnahtar(a){ var p = a.split("-"); var d = new Date(+p[0], +p[1]-1, +p[2]+1); return anahtar(d.getFullYear(), d.getMonth(), d.getDate()); }

  function gunKaydir(a, d){
    var p = a.split("-"); var t = new Date(+p[0], +p[1]-1, +p[2]+d);
    return anahtar(t.getFullYear(), t.getMonth(), t.getDate());
  }
  var AJ_BOYUT_ANAHTAR = "ht_aj_boyut";
  function ajBoyutOku(){ try{ var v = JSON.parse(localStorage.getItem(AJ_BOYUT_ANAHTAR) || "null"); return (v && v.w && v.h) ? v : null; }catch(e){ return null; } }
  function ajBoyutYaz(w, h){ try{ localStorage.setItem(AJ_BOYUT_ANAHTAR, JSON.stringify({w: Math.round(w), h: Math.round(h)})); }catch(e){} }

  // mod: "temas" (Temas penceresi) | "ajanda" (06.11.2026 — üstte aynı not defteri, altta o günün el yazısı ajanda
  // fotoğrafları; yana kaydırınca gün gün ileri/geri; köşeden küçült/büyüt).
  function temasAc(a){ pencereAc(a, "temas"); }
  function ajandaAc(a){ pencereAc(a, "ajanda"); }
  function pencereAc(a, mod){
    if(document.querySelector(".ht-defter")) return;
    var aj = (mod === "ajanda");
    var secTur = "ziyaret", firma = null, hatirlatma = false;
    var zemin = document.createElement("div");
    zemin.className = "ht-zemin";
    var noktalar = ""; for(var i=0; i<18; i++) noktalar += "<i></i>";
    var kagitHtml = "<div class='ht-d-kagit' id='htKagit'></div>";
    var yeniHtml =
        "<div class='ht-yeni'>"
      +   "<div class='ht-ayrac' id='htAyrac'>YENİ KAYIT</div>"
      +   "<div id='htFirmaAlan'></div>"
      +   "<div id='htOner'></div>"
      +   "<textarea class='ht-d-metin' id='htNot' rows='1' placeholder='Not yaz…' spellcheck='false'></textarea>"
      +   "<div class='ht-alt'><label class='ht-hat' id='htHat'><s id='htHatKutu'></s><span id='htHatYazi'>🔔 Hatırlatma ekle</span><input type='date' id='htHatTarih' hidden></label>"
      +   "<button type='button' class='ht-kay' id='htKaydet' disabled>✓ Kaydet</button></div>"
      + "</div>";
    var baslikHtml = aj
      ? "<div class='ht-d-baslik'>" + ikonHtml("ajanda") + "<div class='ht-d-bm'><b id='htDBaslik'></b><small id='htDSayi'></small></div>"
        + "<button type='button' class='ht-nav' id='htOnceki' aria-label='Önceki gün'>‹</button><button type='button' class='ht-nav' id='htSonraki' aria-label='Sonraki gün'>›</button></div>"
      : "<div class='ht-d-baslik'>" + ikonHtml("temas") + "<div><b>Temas</b><small id='htDSayi'></small></div></div>";
    zemin.innerHTML =
      "<div class='ht-defter" + (aj ? " ht-defter--aj" : "") + "' id='htDefter'>"
      + "<div class='ht-noktalar'>" + noktalar + "</div>"
      + baslikHtml
      + "<div class='ht-turler' id='htTurler'></div>"
      + (aj ? "<div class='ht-aj-defter' id='htAjDefter'>" + kagitHtml + yeniHtml + "</div>"
            + "<div class='ht-aj-foto'><div class='ht-aj-foto-ic' id='htAjFotoIc'></div>"
            + "<div class='ht-aj-ub'><button type='button' class='ht-ub' id='htKamera' aria-label='Fotoğraf çek'><svg viewBox='0 0 24 24'><path d='M9 3 7.2 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3H9zm3 14a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9zm0-2a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'/></svg></button>"
            + "<button type='button' class='ht-ub' id='htDosya' aria-label='Dosyadan yükle'><svg viewBox='0 0 24 24'><path d='M20 6h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z'/></svg></button></div></div>"
            + "<div class='ht-d-alt' id='htDAlt' hidden></div><span class='ht-grip' id='htGrip'></span>"
          : kagitHtml + yeniHtml + "<div class='ht-d-alt' id='htDAlt'>kapatmak için dışına dokun</div>")
      + "</div>";
    document.body.appendChild(zemin);
    var defterEl = zemin.querySelector("#htDefter");
    if(aj){
      var kb = ajBoyutOku();
      if(kb){ defterEl.style.width = Math.min(kb.w, window.innerWidth - 12) + "px"; defterEl.style.height = Math.min(kb.h, window.innerHeight - 12) + "px"; }
    }
    function el(id){ return zemin.querySelector("#" + id); }
    var altEl = el("htDAlt");
    function ipucu(m, hata){ altEl.textContent = m; altEl.hidden = false; altEl.classList.toggle("ht-d-alt--hata", !!hata); }

    var satirlar = [];   // listedeki düzenlenebilir satırlar (Düzelt / Sil düğmeleri bunlara indeksle bağlanır)
    var duz = null;      // düzeltilen satır (formu doldurur): {kind:'temas'|'defter', ...}
    function listeCiz(){
      var sayilar = gunTurSayilari(a), isl = islemSayisi(a);
      if(aj){
        var sp = a.split("-"), sayfa = (typeof AjandaData !== "undefined") ? AjandaData.gununKayitlari(a).length : 0;
        el("htDBaslik").textContent = parseInt(sp[2],10) + " " + AY_ADLARI[parseInt(sp[1],10)-1] + " " + gunAdi(a);
        el("htDSayi").textContent = sayilar.toplam + " temas" + (isl > 0 ? " · " + isl + " işlem" : "") + " · " + (sayfa > 0 ? sayfa + " sayfa" : "sayfa yok");
      } else {
        el("htDSayi").textContent = gosterimTarih(a) + " · " + sayilar.toplam + " temas" + (isl > 0 ? " · " + isl + " işlem" : "");
      }
      el("htTurler").innerHTML = TURLER.map(function(t){
        return "<div class='ht-tur" + (t === secTur ? " ht-tur--sec" : "") + "' data-tur='" + t + "'>" + ikonHtml(t, TUR_T) + "<span>" + TUR_T[t].ad + "</span><em>" + sayilar.tur[t] + "</em></div>";
      }).join("");
      el("htTurler").querySelectorAll(".ht-tur").forEach(function(c){
        c.onclick = function(){ secTur = this.getAttribute("data-tur"); listeCiz(); firmaCiz(); };
      });
      var h = "";
      var kayitlar = [];
      var mt = musteriTemaslari()[a] || {};
      TURLER.forEach(function(t){ (mt[t] || []).forEach(function(k){ kayitlar.push({t:t, k:k}); }); });
      kayitlar.sort(function(x, y){ return x.k.ts - y.k.ts; });
      satirlar = [];
      var dugme = function(i){
        return "<span class='ht-dg'><button type='button' class='ht-duz' data-ri='" + i + "'>✎ Düzelt</button>"
          + "<button type='button' class='ht-sil' data-ri='" + i + "'>🗑 Sil</button></span>";
      };
      kayitlar.forEach(function(r){
        satirlar.push({kind: "temas", t: r.t, k: r.k});
        h += "<div class='ht-d-kayit'>" + miniIk(r.t) + "<i>" + hhmm(r.k.ts) + "</i><span class='ht-d-ad'>" + kodAd(r.k.musteriId, r.k.musteri) + "</span>" + (r.k.not ? "<em>— " + esc(r.k.not) + "</em>" : "") + dugme(satirlar.length - 1) + "</div>";
      });
      // Eski serbest defter satırları (müşteriye bağlı olmayan) aynı çizgili kâğıtta, okunur.
      TURLER.forEach(function(t){
        var m = (typeof GunNotlariData !== "undefined") ? GunNotlariData.metin(a, t) : "";
        String(m || "").split("\n").forEach(function(sat, idx){
          if(sat.trim()){
            satirlar.push({kind: "defter", t: t, idx: idx, metin: sat.trim()});
            h += "<div class='ht-d-kayit'>" + miniIk(t) + "<span class='ht-d-ad'>" + esc(sat.trim()) + "</span>" + dugme(satirlar.length - 1) + "</div>";
          }
        });
      });
      if(!h) h = "<div class='ht-d-kayit ht-d-bos'>Bu günde temas kaydı yok</div>";
      var islemler = (typeof IsTakipData !== "undefined" && IsTakipData.gunIslemleri) ? IsTakipData.gunIslemleri(a) : [];
      if(islemler.length){
        h += "<div class='ht-ayrac'>İŞLEMLER</div>";
        islemler.forEach(function(k){
          h += "<div class='ht-d-kayit ht-d-islem'><i>" + hhmm(k.ts) + "</i><span class='ht-d-ad'><b>" + kodAd(k.musteriId, k.musteri || "-") + "</b> · " + esc(k.tipAd) + (k.kod ? " " + esc(k.kod) : "") + "</span></div>";
        });
      }
      var odemeler = odemeGunleri()[a] || [];
      if(odemeler.length){
        h += "<div class='ht-ayrac'>ÖDEMELER</div>";
        odemeler.forEach(function(k){
          h += "<div class='ht-d-kayit ht-d-islem'><i>" + hhmm(k.ts) + "</i><span class='ht-d-ad'><b>" + kodAd(k.musteriId, k.musteri || "-") + "</b> · 💰 Ödeme alındı"
            + (k.kod ? " " + esc(String(k.kod).split(/\s+/)[0]) : "") + " · " + tutarYaz(k.tutar) + (k.not ? " <em>— " + esc(k.not) + "</em>" : "") + "</span></div>";
        });
      }
      el("htKagit").innerHTML = h;
    }

    function kaydetDurum(){ el("htKaydet").disabled = !(firma || (duz && duz.kind === "defter")); }
    function firmaCiz(){
      var alan = el("htFirmaAlan");
      if(duz && duz.kind === "defter"){
        alan.innerHTML = "";   // eski serbest defter satırı: firma yok, sadece metin düzeltilir
      } else if(firma){
        alan.innerHTML = "<div class='ht-firma'>" + miniIk(secTur) + "<b>" + kodAd(firma.id, firma.ad) + "</b>" + (firma.sehir ? "<small>· " + esc(firma.sehir) + "</small>" : "") + (duz ? "" : "<u id='htFirmaSil'>✕</u>") + "</div>";
        if(!duz) el("htFirmaSil").onclick = function(){ firma = null; firmaCiz(); };
      } else {
        alan.innerHTML = "<div class='ht-yaz ht-yaz--ara'><input type='text' id='htFirmaAra' placeholder='Firma ara' autocomplete='off' spellcheck='false'><span aria-hidden='true'>🔍</span></div>";
        el("htFirmaAra").addEventListener("input", onerCiz);
      }
      el("htOner").innerHTML = "";
      kaydetDurum();
    }
    function onerCiz(){
      var q = el("htFirmaAra").value, k = el("htOner");
      if(!q.trim()){ k.innerHTML = ""; return; }
      var sonuc = (typeof CustomerData !== "undefined" ? CustomerData.ara(q) : []).slice(0, 6);
      k.innerHTML = sonuc.length ? "<div class='ht-oner'>" + sonuc.map(function(m, i){
        return "<div data-i='" + i + "'>" + kodAd(m.id, m.ad) + (m.sehir ? " <small>· " + esc(m.sehir) + "</small>" : "") + "</div>";
      }).join("") + "</div>" : "";
      k.querySelectorAll(".ht-oner div").forEach(function(d){
        d.onclick = function(){
          var m = sonuc[parseInt(this.getAttribute("data-i"), 10)];
          firma = {ad: m.ad, id: m.id || null, sehir: m.sehir || ""};
          firmaCiz();
        };
      });
    }

    var notEl = el("htNot");
    function boyutla(){ notEl.style.height = "auto"; notEl.style.height = Math.max(38, notEl.scrollHeight) + "px"; }
    notEl.addEventListener("input", boyutla);

    function hatGuncelle(){
      el("htHatKutu").classList.toggle("ht-hat-acik", hatirlatma);
      el("htHatTarih").hidden = !hatirlatma;
      el("htHatYazi").textContent = hatirlatma ? "🔔" : "🔔 Hatırlatma ekle";
    }
    el("htHat").addEventListener("click", function(ev){
      if(ev.target === el("htHatTarih")) return;
      ev.preventDefault();
      hatirlatma = !hatirlatma;
      if(hatirlatma && !el("htHatTarih").value) el("htHatTarih").value = yarinAnahtar(a);
      hatGuncelle();
    });

    // ——— DÜZELT / SİL (10.11.2026, Abdullah isteği): listedeki bir kaydın yanındaki düğmeler ———
    function duzBitir(){
      duz = null; firma = null; notEl.value = ""; boyutla(); hatirlatma = false; hatGuncelle();
      el("htAyrac").textContent = "YENİ KAYIT"; el("htKaydet").textContent = "✓ Kaydet";
      firmaCiz(); listeCiz();
    }
    function duzBasla(r){
      duz = r; secTur = r.t;
      if(r.kind === "temas"){
        firma = {ad: r.k.musteri, id: r.k.musteriId || null, sehir: r.k.sehir || ""};
        notEl.value = r.k.not || "";
        hatirlatma = !!r.k.hatirlatmaTarihi;
        el("htHatTarih").value = r.k.hatirlatmaTarihi || "";
      } else {
        firma = null; notEl.value = r.metin; hatirlatma = false;
      }
      boyutla(); hatGuncelle();
      el("htAyrac").innerHTML = "KAYDI DÜZELT <u id='htDuzIptal'>✕</u>";
      el("htDuzIptal").onclick = duzBitir;
      el("htKaydet").textContent = "✓ Güncelle";
      listeCiz(); firmaCiz();
      notEl.focus();
    }
    function defterSatirlariniYaz(r, yeniSatir, cb){
      var sat = String(GunNotlariData.metin(a, r.t) || "").split("\n");
      if(yeniSatir === null) sat.splice(r.idx, 1); else sat[r.idx] = yeniSatir;
      GunNotlariData.kaydet(a, r.t, sat.join("\n"), cb);
    }
    el("htKagit").onclick = function(ev){
      var b = ev.target.closest && ev.target.closest(".ht-duz, .ht-sil");
      if(!b) return;
      var r = satirlar[parseInt(b.getAttribute("data-ri"), 10)];
      if(!r) return;
      if(b.classList.contains("ht-duz")){ duzBasla(r); return; }
      // Sil: iki dokunuş (ilkinde "Silinsin mi?", 4 sn içinde tekrar dokunulursa silinir)
      if(!b._onay){
        b._onay = true; b.textContent = "Silinsin mi?"; b.classList.add("ht-sil--onay");
        setTimeout(function(){ if(b.isConnected){ b._onay = false; b.textContent = "🗑 Sil"; b.classList.remove("ht-sil--onay"); } }, 4000);
        return;
      }
      b.disabled = true;
      var bitti = function(basarili, err){
        if(!document.body.contains(zemin)) return;
        if(basarili){ if(duz && ((r.kind === "temas" && duz.k && duz.k.ts === r.k.ts) || duz === r)) duzBitir(); else listeCiz(); ipucu("Silindi ✓ · kapatmak için dışına dokun"); }
        else { b.disabled = false; ipucu("Silinemedi: " + (err && err.message ? err.message : "bilinmeyen hata"), true); }
      };
      if(r.kind === "temas") CustomerData.ziyaretSil(r.k.musteri, r.k.ts, bitti, r.k.musteriId || undefined);
      else defterSatirlariniYaz(r, null, bitti);
    };

    el("htKaydet").onclick = function(){
      if(duz){
        var d = duz, dbtn = this;
        dbtn.disabled = true; dbtn.textContent = "Kaydediliyor…";
        var sonuc = function(basarili, err){
          if(!document.body.contains(zemin)) return;
          dbtn.textContent = "✓ Güncelle";
          if(basarili){ duzBitir(); ipucu("Güncellendi ✓ · kapatmak için dışına dokun"); }
          else { kaydetDurum(); ipucu("Kaydedilemedi: " + (err && err.message ? err.message : "bilinmeyen hata"), true); }
        };
        var yeni = notEl.value.trim();
        if(d.kind === "temas"){
          var hat2 = hatirlatma ? (el("htHatTarih").value || null) : null;
          CustomerData.ziyaretGuncelle(d.k.musteri, d.k.ts, {not: yeni, hatirlatmaTarihi: hat2, odemeIsaret: !!hat2}, sonuc, d.k.musteriId || undefined);
        } else {
          defterSatirlariniYaz(d, yeni === "" ? null : yeni.replace(/\s*\n\s*/g, " "), sonuc);
        }
        return;
      }
      if(!firma || typeof CustomerData === "undefined") return;
      var btn = this;
      btn.disabled = true; btn.textContent = "Kaydediliyor…";
      var hat = hatirlatma ? (el("htHatTarih").value || null) : null;
      CustomerData.ziyaretEkle(firma.ad, notEl.value.trim(), secTur, hat, function(basarili, err){
        if(!document.body.contains(zemin)) return;
        btn.textContent = "✓ Kaydet";
        if(basarili){
          firma = null; notEl.value = ""; boyutla(); hatirlatma = false; hatGuncelle();
          firmaCiz(); listeCiz();
          ipucu("Kaydedildi ✓ · kapatmak için dışına dokun");
          var k = aj ? el("htAjDefter") : el("htKagit"); k.scrollTop = k.scrollHeight;
        } else {
          kaydetDurum();
          ipucu("Kaydedilemedi: " + (err && err.message ? err.message : "bilinmeyen hata"), true);
        }
      }, firma.id);
    };

    // ——— AJANDA: o günün el yazısı sayfa fotoğrafları (saat sırasıyla alt alta) ———
    var sonFotoAnahtar = null, sonSurukleme = 0;
    function fotoCiz(){
      if(!aj) return;
      var ks = (typeof AjandaData !== "undefined") ? AjandaData.gununKayitlari(a) : [];
      var anahtarStr = a + "|" + ks.map(function(k){ return k.id; }).join(",");
      if(anahtarStr === sonFotoAnahtar) return; // aynı içerik: görselleri yeniden yükleme
      sonFotoAnahtar = anahtarStr;
      var ic = el("htAjFotoIc"), h = "";
      ks.forEach(function(k, i){
        h += "<div class='ht-ft'><img src='" + esc(k.url) + "' alt='Ajanda sayfası'><span class='ht-ft-z'>" + hhmm(k.zaman) + (ks.length > 1 ? " · " + (i+1) + "/" + ks.length : "") + "</span>"
          + "<span class='ht-ft-sil' data-id='" + esc(k.id) + "' data-yol='" + esc(k.yol || "") + "' role='button' aria-label='Sil'>🗑️</span></div>";
      });
      if(!ks.length) h = "<div class='ht-ft-bos'><span aria-hidden='true'>📓</span>Bu güne sayfa yüklenmemiş</div>";
      ic.innerHTML = h;
      ic.scrollTop = 0;
      ic.querySelectorAll(".ht-ft-sil").forEach(function(b){
        b.onclick = function(ev){
          ev.stopPropagation();
          if(!confirm("Bu sayfa fotoğrafı silinsin mi? Bu işlem geri alınamaz.")) return;
          AjandaData.fotografSil(a, this.getAttribute("data-id"), this.getAttribute("data-yol") || null, function(ok, err){
            if(!ok) ipucu("Silinemedi: " + (err && err.message ? err.message : "bilinmeyen hata"), true);
          });
        };
      });
    }
    function tazele(){ if(document.body.contains(zemin)){ listeCiz(); fotoCiz(); } }
    function gunDegistir(d){
      if(duz) duzBitir();
      a = gunKaydir(a, d);
      sonFotoAnahtar = null;
      listeCiz(); fotoCiz();
      var ic = el("htAjDefter"); if(ic) ic.scrollTop = 0;
      defterEl.classList.remove("ht-kay-sag", "ht-kay-sol"); void defterEl.offsetWidth;
      defterEl.classList.add(d > 0 ? "ht-kay-sag" : "ht-kay-sol");
    }
    if(aj){
      el("htOnceki").onclick = function(){ gunDegistir(-1); };
      el("htSonraki").onclick = function(){ gunDegistir(1); };
      el("htKamera").onclick = function(){ AjandaFoto.sec("kamera", a, function(ok){ if(ok) ipucu("Sayfa yüklendi ✓"); }); };
      el("htDosya").onclick = function(){ AjandaFoto.sec("dosya", a, function(ok){ if(ok) ipucu("Sayfa yüklendi ✓"); }); };
      // Yana kaydırma: sola = sonraki gün, sağa = önceki gün (yazı alanları ve öneri listesi hariç).
      var tx = 0, ty = 0, tIzin = false;
      defterEl.addEventListener("touchstart", function(ev){
        var t = ev.touches[0]; tx = t.clientX; ty = t.clientY;
        tIzin = ev.touches.length === 1 && !(ev.target.closest && ev.target.closest("input, textarea, .ht-oner, .ht-grip"));
      }, {passive: true});
      defterEl.addEventListener("touchend", function(ev){
        if(!tIzin) return; tIzin = false;
        var t = ev.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty;
        if(Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6){ sonSurukleme = Date.now(); gunDegistir(dx < 0 ? 1 : -1); }
      }, {passive: true});
      // Köşeden küçült / büyüt (pencere ortada durduğu için her yöne iki katı büyür).
      var grip = el("htGrip"), gb = null;
      grip.addEventListener("pointerdown", function(ev){
        ev.preventDefault(); ev.stopPropagation();
        var r = defterEl.getBoundingClientRect();
        gb = {x: ev.clientX, y: ev.clientY, w: r.width, h: r.height};
        try{ grip.setPointerCapture(ev.pointerId); }catch(e){}
      });
      grip.addEventListener("pointermove", function(ev){
        if(!gb) return;
        var w = Math.max(300, Math.min(window.innerWidth - 12, gb.w + (ev.clientX - gb.x) * 2));
        var h = Math.max(380, Math.min(window.innerHeight - 12, gb.h + (ev.clientY - gb.y) * 2));
        defterEl.style.width = w + "px"; defterEl.style.height = h + "px";
      });
      function gripBitir(){
        if(!gb) return; gb = null; sonSurukleme = Date.now();
        var r = defterEl.getBoundingClientRect(); ajBoyutYaz(r.width, r.height);
      }
      grip.addEventListener("pointerup", gripBitir);
      grip.addEventListener("pointercancel", gripBitir);
    }

    temasYenile = tazele;
    zemin.addEventListener("click", function(ev){
      if(ev.target === zemin && Date.now() - sonSurukleme > 400){ zemin.remove(); temasYenile = null; }
    });
    listeCiz(); firmaCiz(); hatGuncelle(); boyutla(); fotoCiz();
  }

  // ---------- BAŞLAT ----------
  function erisimUygula(){
    if(!kapsayici) return;
    if(window.ISTAKIP_IZINLER === undefined) return; // izinler henüz çözülmedi
    var blok = document.getElementById("anaTakvimBlok");
    var izinli = (typeof window.izinVarMi === "function") ? window.izinVarMi("ziyaret") : true;
    if(blok) blok.hidden = !izinli;
    // 09.11.2026 (Abdullah onayı): özet şeridi takvimle aynı izne bağlı.
    var ozet = document.getElementById("htOzet");
    if(ozet) ozet.hidden = !izinli;
    // Tarih paneli DOM'da döviz panelinin hemen altında sabit kalır.
    // Takvim görünürlüğü değişse de tarih paneli yer değiştirmez.
  }

  document.addEventListener("DOMContentLoaded", function(){
    kurulum();
    erisimUygula();
    if(typeof CustomerData !== "undefined" && CustomerData.listeDegistiginde) CustomerData.listeDegistiginde(function(){ takvimiCiz(); });
    if(typeof AjandaData !== "undefined") AjandaData.degistiginde(function(){ takvimiCiz(); });
    if(typeof GunNotlariData !== "undefined") GunNotlariData.degistiginde(function(){ takvimiCiz(); });
    if(typeof IsTakipData !== "undefined" && IsTakipData.bildirimDegistiginde) IsTakipData.bildirimDegistiginde(function(){ takvimiCiz(); });
    window.addEventListener("istakipAuthHazir", erisimUygula);
  });
})();
