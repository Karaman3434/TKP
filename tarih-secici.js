/*
  tarih-secici.js — TKP.10.11.26-09:30.1537
  ==========================================
  KÜÇÜK TAKVİM AÇILIR PENCERESİ (10.11.2026, Abdullah onayı — Vade Takip mockup).
  Dokunulan düğmenin HEMEN ALTINDA açılan küçük, oklu pencere (alttan kayan
  sayfa DEĞİL). ‹ › okları ya da sağa/sola kaydırma ile ay değişir; bugünden
  önceki günler soluktur ve seçilemez. Güne dokununca seçilir ve pencere
  kapanır; dışına dokunmak da kapatır.

  KULLANIM:
    TarihSecici.ac({ ankaj: dugmeEl, secili: "2026-11-13", secildi: function(anahtar){ ... } });
  anahtar = "YYYY-MM-DD" (yerel tarih).
*/
var TarihSecici = (function(){
  var AYLAR = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
  var GUNLER = ["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"];
  var acik = null;

  function p2(n){ return String(n).padStart(2,"0"); }
  function anahtar(y, a, g){ return y + "-" + p2(a+1) + "-" + p2(g); }

  function kapat(){
    if(!acik) return;
    try{ acik.zemin.remove(); acik.pop.remove(); }catch(e){}
    acik = null;
  }

  function ac(o){
    o = o || {};
    kapat();
    var bugun = new Date();
    var bugunAnahtar = anahtar(bugun.getFullYear(), bugun.getMonth(), bugun.getDate());
    var secili = o.secili || null;
    var ref = secili ? new Date(+secili.split("-")[0], +secili.split("-")[1]-1, 1) : new Date(bugun.getFullYear(), bugun.getMonth(), 1);
    var yil = ref.getFullYear(), ay = ref.getMonth();

    var zemin = document.createElement("div");
    zemin.className = "ts-zemin";
    var pop = document.createElement("div");
    pop.className = "ts-pop";
    document.body.appendChild(zemin);
    document.body.appendChild(pop);
    acik = {zemin: zemin, pop: pop};

    function konumla(){
      var r = o.ankaj ? o.ankaj.getBoundingClientRect() : {left: 20, right: 300, bottom: 100};
      var genislik = Math.min(300, window.innerWidth - 16);
      pop.style.width = genislik + "px";
      var sol = r.right - genislik;
      sol = Math.max(8, Math.min(sol, window.innerWidth - genislik - 8));
      pop.style.left = sol + "px";
      pop.style.top = (r.bottom + 10) + "px";
      var ok = r.left + (r.right - r.left) / 2 - sol - 6;
      pop.style.setProperty("--ts-ok", Math.max(14, Math.min(ok, genislik - 26)) + "px");
    }

    function ciz(){
      var ilk = new Date(yil, ay, 1);
      var bosluk = (ilk.getDay() + 6) % 7;          // Pazartesi başlangıç
      var gunSayisi = new Date(yil, ay + 1, 0).getDate();
      var h = "<div class='ts-ust'><i data-d='-1' aria-label='Önceki ay'>‹</i><span>" + AYLAR[ay] + " " + yil + "</span><i data-d='1' aria-label='Sonraki ay'>›</i></div>";
      h += "<div class='ts-hafta'>" + GUNLER.map(function(g, i){ return "<span" + (i >= 5 ? " class='ts-tatil'" : "") + ">" + g + "</span>"; }).join("") + "</div>";
      h += "<div class='ts-grid'>";
      for(var i = 0; i < bosluk; i++) h += "<span class='ts-bos'></span>";
      for(var g = 1; g <= gunSayisi; g++){
        var a = anahtar(yil, ay, g), hg = (bosluk + g - 1) % 7;
        var sinif = "ts-gun";
        if(a < bugunAnahtar) sinif += " ts-gecmis";
        else if(hg >= 5) sinif += " ts-tatil";
        if(a === bugunAnahtar) sinif += " ts-bugun";
        if(a === secili) sinif += " ts-secili";
        h += "<span class='" + sinif + "' data-a='" + a + "'>" + g + "</span>";
      }
      h += "</div>";
      pop.innerHTML = h;
      konumla();
    }

    pop.addEventListener("click", function(ev){
      var ok = ev.target.closest("i[data-d]");
      if(ok){
        var t = new Date(yil, ay + parseInt(ok.getAttribute("data-d"), 10), 1);
        yil = t.getFullYear(); ay = t.getMonth(); ciz(); return;
      }
      var gun = ev.target.closest(".ts-gun");
      if(!gun || gun.classList.contains("ts-gecmis")) return;
      var a = gun.getAttribute("data-a");
      kapat();
      if(typeof o.secildi === "function") o.secildi(a);
    });
    // Sağa/sola kaydırma → ay değişir
    var x0 = null, y0 = null;
    pop.addEventListener("touchstart", function(e){ if(e.touches.length === 1){ x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; } }, {passive:true});
    pop.addEventListener("touchend", function(e){
      if(x0 === null) return;
      var c = e.changedTouches[0], dx = c.clientX - x0, dy = c.clientY - y0; x0 = null;
      if(Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.5){
        var t = new Date(yil, ay + (dx < 0 ? 1 : -1), 1); yil = t.getFullYear(); ay = t.getMonth(); ciz();
      }
    }, {passive:true});
    zemin.addEventListener("click", kapat);
    ciz();
  }

  return {ac: ac, kapat: kapat, anahtar: anahtar};
})();
