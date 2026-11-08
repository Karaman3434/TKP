/*
  customer-temas-render.js — TKP.08.11.26-09:20.1499
  customer-temas-render.js
  ========================
  Seçili müşterinin Temas Geçmişi — "➕ Temas Gir" (tür seç: Ziyaret/
  Telefon/Mail/WhatsApp Msj → not yaz → kaydet) ve kronolojik liste.
  Önceden customer-detail.html içinde açılır bir bölümdü, artık ayrı
  sayfa (WG.100926.196).
*/

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
  }catch(e){ hataGoster("Tarih güncellenemedi: " + e.message); }
}

function htmlEsc(s){
  return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

var TUR_META = {
  ziyaret:  {etiket:"ZİYARET",  ikon:"📍"},
  telefon:  {etiket:"TELEFON",  ikon:"📞"},
  mail:     {etiket:"MAIL",     ikon:"✉️"},
  whatsapp: {etiket:"WHATSAPP", ikon:"💬"}
};

var seciliMusteriAdi = null;
var seciliMusteriId = null;
var secilenTemasTuru = null;

var silinecekTs = null;

function ziyaretGecmisiniCiz(musteri){
  try{
    var liste = (musteri.ziyaretGecmisi || []).slice().sort(function(a,b){ return (b.ts||0)-(a.ts||0); });
    var kapsayici = document.getElementById("detayZiyaretListesi");
    var bos = document.getElementById("detayZiyaretBos");

    if(liste.length === 0){
      kapsayici.innerHTML = "";
      bos.hidden = false;
      return;
    }
    bos.hidden = true;
    kapsayici.innerHTML = liste.map(function(z){
      var d = new Date(z.ts);
      var tarihStr = ("0"+d.getDate()).slice(-2)+"."+("0"+(d.getMonth()+1)).slice(-2)+"."+d.getFullYear();
      var tur = TUR_META[z.tur] || TUR_META.ziyaret;
      return "<div class='gecmis-karti'>"
        + "<div class='gecmis-karti-ust'>"
        + "<span class='temas-rozet temas-rozet--" + (z.tur||"ziyaret") + "'>" + tur.ikon + " " + tur.etiket + "</span>"
        + "<span class='gecmis-karti-sag'>"
        + "<span class='gecmis-tarih'>" + tarihStr + "</span>"
        + "<button type='button' class='gecmis-sil-btn' data-ts='" + z.ts + "' aria-label='Temas kaydını sil'>🗑️</button>"
        + "</span>"
        + "</div>"
        + (z.not ? "<div class='gecmis-not'>" + htmlEsc(z.not) + "</div>" : "")
        + "</div>";
    }).join("");

    kapsayici.querySelectorAll(".gecmis-sil-btn").forEach(function(btn){
      btn.onclick = function(){
        silinecekTs = parseInt(this.getAttribute("data-ts"), 10);
        var kayit = liste.find(function(z){ return z.ts === silinecekTs; });
        var tur = kayit ? (TUR_META[kayit.tur] || TUR_META.ziyaret) : TUR_META.ziyaret;
        document.getElementById("temasSilOnayMetin").textContent = tur.ikon + " " + tur.etiket + " kaydı kalıcı olarak silinecek.";
        document.getElementById("temasSilOnayOverlay").hidden = false;
      };
    });
  }catch(e){ hataGoster("Temas geçmişi çizilemedi: " + e.message); }
}

document.addEventListener("DOMContentLoaded", function(){
  tarihiGuncelle();
  var btnMenuEl = document.getElementById("btnMenu");
  if(btnMenuEl) btnMenuEl.onclick = function(){ window.location.href = "menu.html"; };
  var secili = CustomerData.seciliyiOku();
  if(!secili){
    hataGoster("Müşteri seçilmemiş, listeye dönülüyor.");
    setTimeout(function(){ window.location.href = "customer.html"; }, 1500);
    return;
  }
  seciliMusteriAdi = secili.ad;
  seciliMusteriId = secili.id || null;
  document.getElementById("temasMusteriAd").textContent = secili.ad;
  ziyaretGecmisiniCiz(secili);

  // DÖNÜŞ ROTASI (06.10.2026, Abdullah'ın isteğiyle — "kesin kural"):
  // Geri/Kapat eskiden KOŞULSUZ customer-detail.html'e gidiyordu. Küçük
  // pencereden (Müşteri Bul) "Temas" seçilerek buraya gelindiyse, artık
  // customer.html'e dönüyor. Bayrak yoksa (customer-detail.html'in kendi
  // "Temas" kutucuğundan gelindiyse) davranış DEĞİŞMEDİ.
  try{
    if(localStorage.getItem("weiconv2_musteri_donus_sayfa") === "customer.html"){
      var temasGeriEl = document.querySelector(".ub-btn--geri, .nav-btn--geri");
      var temasKapatEl = document.getElementById("temasKapatBtn");
      if(temasGeriEl){ temasGeriEl.setAttribute("href", "customer.html"); temasGeriEl.removeAttribute("data-popover-geri"); }
      if(temasKapatEl){ temasKapatEl.setAttribute("href", "customer.html"); temasKapatEl.removeAttribute("data-popover-geri"); }
    }
  }catch(e){}

  // "➕ Temas Gir": tür seç → not yaz → kaydet.
  document.getElementById("btnTemasGir").onclick = function(){
    document.getElementById("temasTurOverlay").hidden = false;
  };
  document.getElementById("btnTemasTurVazgec").onclick = function(){
    document.getElementById("temasTurOverlay").hidden = true;
  };
  document.querySelectorAll(".temas-tur-btn[data-tur]").forEach(function(btn){
    btn.onclick = function(){
      secilenTemasTuru = this.getAttribute("data-tur");
      var tur = TUR_META[secilenTemasTuru] || TUR_META.ziyaret;
      document.getElementById("temasTurOverlay").hidden = true;
      document.getElementById("temasNotBaslik").textContent = tur.ikon + " " + tur.etiket + " Notu";
      document.getElementById("temasNotInput").value = "";
      document.getElementById("temasNotOverlay").hidden = false;
      document.getElementById("temasNotInput").focus();
    };
  });
  document.getElementById("btnTemasNotVazgec").onclick = function(){
    document.getElementById("temasNotOverlay").hidden = true;
  };
  document.getElementById("btnTemasSilVazgec").onclick = function(){
    document.getElementById("temasSilOnayOverlay").hidden = true;
    silinecekTs = null;
  };
  document.getElementById("btnTemasSilOnayla").onclick = function(){
    if(silinecekTs === null) return;
    var btn = this;
    btn.disabled = true;
    CustomerData.ziyaretSil(seciliMusteriAdi, silinecekTs, function(basarili, err){
      btn.disabled = false;
      if(!basarili){
        hataGoster("Silinemedi: " + (err && err.message ? err.message : err));
        return;
      }
      document.getElementById("temasSilOnayOverlay").hidden = true;
      silinecekTs = null;
    }, seciliMusteriId);
  };
  document.getElementById("btnTemasKaydet").onclick = function(){
    var not = document.getElementById("temasNotInput").value.trim();
    var btn = this;
    btn.disabled = true;
    CustomerData.ziyaretEkle(seciliMusteriAdi, not, secilenTemasTuru, null, function(basarili, err){
      btn.disabled = false;
      if(!basarili){
        hataGoster("Temas kaydedilemedi: " + (err && err.message ? err.message : err));
        return;
      }
      document.getElementById("temasNotOverlay").hidden = true;
    }, seciliMusteriId);
  };

  // Firebase'den taze veri gelince listeyi tazele (kalıcı ID'yle bul).
  CustomerData.listeDegistiginde(function(){
    var tazeMusteri = seciliMusteriId ? CustomerData.musteriIdIleBul(seciliMusteriId) : CustomerData.musteriBul(seciliMusteriAdi);
    if(!tazeMusteri) return;
    ziyaretGecmisiniCiz(tazeMusteri);
  });
});
