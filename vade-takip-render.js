/* vade-takip-render.js — TKP.11.11.26-15:55.1572 */
function hataGoster(mesaj){
  console.error(mesaj);
  if(typeof HataLog !== "undefined") HataLog.kaydet(mesaj);
  var kutu = document.createElement("div");
  kutu.textContent = "⚠️ " + mesaj;
  kutu.style.cssText = "position:fixed;top:8px;left:8px;right:8px;background:#c0392b;color:#fff;padding:10px;border-radius:8px;font-size:13px;z-index:99999;";
  document.body.appendChild(kutu);
  setTimeout(function(){ kutu.remove(); }, 8000);
}

function tarihiGuncelle(){
  try{
    var el = document.getElementById("gunTarihi");
    if(!el) return;
    var gunler = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
    var aylar = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
    var d = new Date();
    el.textContent = gunler[d.getDay()] + ", " + d.getDate() + " " + aylar[d.getMonth()] + " " + d.getFullYear();
  }catch(e){}
}

// MÜŞTERİ-BAZLI LİSTE (10.11.2026, Abdullah onayı — mockup): her müşteri tek satır;
// dokununca altında ortak "Ödeme · Vade" alanı (odeme-vade-ui.js) açılır.
var GRUP_BASLIK = {
  plan:       {yazi: "📞 ÖDEME PLANLANDI", renk: "#1257c7", not: ""},
  gecti:      VadeTakipUI.GRUP_BASLIK.gecti,        // 11.11.2026: başlıklar tek kaynakta (vade-takip-ui.js)
  bugun:      VadeTakipUI.GRUP_BASLIK.bugun,
  yaklasiyor: VadeTakipUI.GRUP_BASLIK.yaklasiyor,
  "var":      VadeTakipUI.GRUP_BASLIK["var"]
};
var SERIT = {plan:"#1257c7", gecti:"#c0392b", bugun:"#b7601f", yaklasiyor:"#c9a227", "var":"#0f7a3d"};
var acikMusteri = null;   // aynı anda tek müşteri açık
var aramaMetni = "";

function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function fmtTutar(n){ return (n||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function trKucuk(s){ return String(s||"").toLocaleLowerCase("tr-TR"); }

function planRozeti(m){
  if(m.planFark === 0) return {yazi:"🔔 BUGÜN ↗", bg:"#e6efff", renk:"#1257c7"};
  if(m.planFark > 0)   return {yazi:"PLAN GEÇTİ · " + m.planFark + " GÜN ↗", bg:"#fbe4e1", renk:"#c0392b"};
  var d = OdemeVadeUI.anahtarTs(m.plan.tarih);
  var gunler = ["PAZ","PZT","SAL","ÇAR","PER","CUM","CMT"];
  var gunAd = ["PAZAR","PAZARTESİ","SALI","ÇARŞAMBA","PERŞEMBE","CUMA","CUMARTESİ"][d.getDay()];
  return {yazi: d.getDate() + " " + OdemeVadeUI.tarihKisa(d).split(" ")[1].toLocaleUpperCase("tr-TR") + " " + gunAd + " ↗", bg:"#e6efff", renk:"#1257c7"};
}
function durumRozeti(m){
  var meta = VadeTakipUI.ROZET_META[m.durum] || VadeTakipUI.ROZET_META.vadesiz;
  var yazi = m.durum === "gecti" ? (m.maxFark + " GÜN GECİKTİ") : (m.durum === "bugun" ? "BUGÜN" : (-m.maxFark) + " GÜN KALDI");
  return {yazi: yazi, bg: meta.bg, renk: meta.renk};
}

function musteriSatiri(m, grupId){
  var rz = grupId === "plan" ? planRozeti(m) : durumRozeti(m);
  var tem = m.sonTemasTs ? " · son temas " + OdemeVadeUI.tarihKisa(new Date(m.sonTemasTs)) : "";
  var acik = acikMusteri === m.anahtar;
  var h = "<div class='vt-satir vt-musteri" + (acik ? " vt-musteri--acik" : "") + "' data-m='" + esc(m.anahtar) + "'>"
    + "<div class='vt-serit' style='background:" + SERIT[grupId] + ";'></div>"
    + "<div class='vt-govde'>"
    +   "<div class='vt-ust'><span class='vt-ad'>" + (m.musteriId ? "<b>" + esc(m.musteriId) + "</b> - " : "") + esc(m.musteri) + "</span>"
    +     "<span class='vt-rozet vt-rozet--m' style='background:" + rz.bg + ";color:" + rz.renk + ";'>" + rz.yazi + "</span></div>"
    +   "<div class='vt-alt'><span class='vt-kod'>" + m.kayitlar.length + " fatura" + tem + "</span><span class='vt-tutar'>" + VadeTakip.tutarHTML(m.toplam) + "</span></div>";
  if(grupId === "plan" && m.plan && m.plan.not) h += "<div class='vt-plan-not'>" + (m.plan.kod ? "<b>" + esc(m.plan.kod) + "</b> · " : "") + "“" + esc(m.plan.not) + "”</div>";
  h += "</div></div>";
  if(acik) h += "<div class='vt-acilan' data-alan='" + esc(m.anahtar) + "'></div>";
  return h;
}

function listeyiCiz(){
  try{
    var kok = document.getElementById("vtListe");
    var gruplar = VadeTakip.musteriGruplari();
    var q = trKucuk(aramaMetni).trim();
    if(q){
      gruplar = gruplar.map(function(g){
        return {id: g.id, musteriler: g.musteriler.filter(function(m){
          if(trKucuk(m.musteriId).indexOf(q) > -1 || trKucuk(m.musteri).indexOf(q) > -1) return true;
          return m.kayitlar.some(function(o){ return trKucuk(o.kod).indexOf(q) > -1; });
        })};
      }).filter(function(g){ return g.musteriler.length; });
    }
    var bos = document.getElementById("vtBos");
    if(!gruplar.length){
      kok.innerHTML = "";
      bos.textContent = q ? "Aramayla eşleşen müşteri yok." : "✓ Takipte bekleyen fatura yok.";
      bos.hidden = false;
      return;
    }
    bos.hidden = true;

    var html = "<div class='vt-kdv-not' style='margin:2px 4px 8px;padding:6px 10px;font-size:12.5px;font-weight:700;color:#4a5a6e;text-align:center;background:#eef3f9;border-radius:10px;'>" + esc(VadeTakip.kdvNotu()) + "</div>";
    gruplar.forEach(function(g){
      var b = GRUP_BASLIK[g.id];
      html += "<div class='vt-grup-baslik vt-grup-baslik--m' style='color:" + b.renk + ";'><span>" + b.yazi + (b.not ? " <small>· " + b.not + "</small>" : "") + "</span><span class='vt-say'>" + g.musteriler.length + " müşteri</span></div>";
      html += "<div class='vt-grup vt-grup--m'>";
      g.musteriler.forEach(function(m){ html += musteriSatiri(m, g.id); });
      html += "</div>";
    });
    kok.innerHTML = html;

    if(acikMusteri){
      var alan = kok.querySelector(".vt-acilan");
      if(!alan){ acikMusteri = null; return; }
      var bulunan = null;
      gruplar.forEach(function(g){ g.musteriler.forEach(function(m){ if(m.anahtar === acikMusteri) bulunan = m; }); });
      OdemeVadeUI.ciz(alan, bulunan.musteriId, bulunan.musteri, listeyiCiz);
    }
  }catch(e){ hataGoster("Vade Takip listesi çizilemedi: " + e.message); }
}

document.addEventListener("DOMContentLoaded", function(){
  tarihiGuncelle();
  var btnMenuEl = document.getElementById("btnMenu");
  if(btnMenuEl) btnMenuEl.onclick = function(){ window.location.href = "menu.html"; };
  var kokEl = document.getElementById("vtListe");
  kokEl.addEventListener("click", function(ev){
    var satir = ev.target.closest(".vt-musteri");
    if(!satir || !kokEl.contains(satir)) return;
    var a = satir.getAttribute("data-m");
    acikMusteri = (acikMusteri === a) ? null : a;
    listeyiCiz();
    if(acikMusteri){ var el = kokEl.querySelector(".vt-musteri--acik"); if(el && el.scrollIntoView) el.scrollIntoView({block:"nearest", behavior:"smooth"}); }
  });
  var araEl = document.getElementById("vtAra");
  if(araEl) araEl.addEventListener("input", function(){ aramaMetni = araEl.value; listeyiCiz(); });
  ReportsData.arsivDegistiginde(listeyiCiz);
  CustomerData.listeDegistiginde(listeyiCiz);
  listeyiCiz();
});
