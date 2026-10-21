/* kacan-satislar-render.js — WG.211026.2100.912 */
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

function htmlEsc(s){
  return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function fmt(n){
  return (n||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2});
}

var siralamaYonu = "yeni"; // yeni | eski
// TARİH FİLTRESİ (21.10.2026, Abdullah onayı) — paylaşılan TarihFiltre
// bileşeni, DOMContentLoaded içinde kurulup buraya atanır.
var tarihFiltreKontrol = null;

// v3 — tarih gruplu tasarım (05.09.2026). Bu sabitler gecmis-render.js,
// son-islemler-render.js, satis-listesi-render.js ve reports-render.js'de
// birebir aynı tutulmalı. Bu listedeki her kayıt zaten "kaçan" olduğu için
// serit/rozet her zaman KACAN_META (kırmızı) — tip sadece kod rengini belirler.
var TIP_ETIKET_KS = {numune:"Numune", teklif:"Teklif", proforma:"Proforma", siparis:"Sipariş"};
var TIP_META = {
  siparis:  {rozet:"SP",    kodRenk:"#003a70"},
  teklif:   {rozet:"FT",    kodRenk:"#1a7431"},
  proforma: {rozet:"PF",    kodRenk:"#5c1680"},
  numune:   {rozet:"NM",    kodRenk:"#7a4008"}
};
var KACAN_META = {rozet:"KAÇTI", rozetBg:"#fdecea", rozetRenk:"#a32d2d", serit:"#c0392b"};
var GUNLER_UZUN = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
var AYLAR_UZUN = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
function gunAnahtari(ts){
  var d = new Date(ts);
  return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
}
function gunBasligi(ts){
  var d = new Date(ts);
  return d.getDate() + " " + AYLAR_UZUN[d.getMonth()] + " " + d.getFullYear() + " • " + GUNLER_UZUN[d.getDay()];
}
// Belge kodunun BAŞ HARFLERİ (SP/FT/PF/NM) işlem türünün kendi renginde
// (WG.210926.1709.589); numara kısmı normal renkte kalır. Renkler uygulamadaki
// işlem tipi renkleriyle aynı (SİPARİŞ navy, TEKLİF yeşil, PROFORMA mor, NUMUNE turuncu).
var HARF_RENK = {siparis:"#003a70", teklif:"#28a745", proforma:"#8e44ad", numune:"#b7601f"};
function kodHTML(kod, tip){
  kod = String(kod == null ? "" : kod);
  var i = kod.indexOf(".");
  var harf = i > 0 ? kod.slice(0, i) : kod;
  var kalan = i > 0 ? kod.slice(i) : "";
  return "<span style='color:" + (HARF_RENK[tip] || HARF_RENK.siparis) + ";'>" + htmlEsc(harf) + "</span>" + htmlEsc(kalan);
}
// TABLO TASARIMI (14.10.2026, Abdullah'ın isteğiyle — Müşteri Listesi/Son
// İşlemler'deki tasarım TÜM listelere uygulanıyor): eski 2 satırlı tl-kart
// kaldırıldı, GERÇEK TEK SATIRLIK TABLO (CSS Grid) — Kod | Firma | Konum |
// Rozet | Belge | Tutar | Ok. Bu listedeki her kayıt zaten "kaçan" olduğu
// için rozet/şerit her zaman KACAN_META (kırmızı) — tip sadece kodun baş
// harfinin rengini belirler.
function tlKartHTML(k){
  var meta = TIP_META[k.tip] || TIP_META.siparis;
  var kod = k.kod || meta.rozet;
  return "<div class='sr-satir' data-i='" + k._i + "' style='border-left-color:" + KACAN_META.serit + ";'>"
    + "<div class='sr-firma-h'>" + htmlEsc(k.musteri||"") + "</div>"
    + "<div class='sr-konum-h'>" + htmlEsc(k.sehir||"") + "</div>"
    + "<span class='sr-rozet-h' style='background:" + KACAN_META.rozetBg + ";color:" + KACAN_META.rozetRenk + ";'>" + KACAN_META.rozet + "</span>"
    + "<div class='sr-belge-h'>" + kodHTML(kod, k.tip) + "</div>"
    + "<div class='sr-tutar-h'>" + (bakiyeKayitVarMi(k) ? "<span class='sr-durum-ek sr-durum-ek--bakiye'>📦 Bekleyen</span>" : fmt(k.tutar) + " €") + "</div>"
    + "<div class='sr-ok-h'>&#8250;</div>"
    + "</div>";
}
// BAKİYE (07.10.2026) — kayıt tumKacanlar()'dan geldiyse hazır
// "bakiyeVarMi" bayrağını kontrol eder (bkz. reports-data.js).
function bakiyeKayitVarMi(k){
  return !!k.bakiyeVarMi || (k.urunler||[]).some(function(u){ return (u.bakiyeAdet||0)>0; });
}
function tlGrupla(liste){
  var gruplar = [], harita = {};
  liste.forEach(function(k, i){
    k._i = i;
    var anahtar = gunAnahtari(k.ts);
    if(!harita[anahtar]){ harita[anahtar] = {ts:k.ts, kayitlar:[]}; gruplar.push(harita[anahtar]); }
    harita[anahtar].kayitlar.push(k);
  });
  return gruplar;
}

function listeyiCiz(){
  try{
    var liste = ReportsData.tumKacanlar(siralamaYonu);
    if(tarihFiltreKontrol) liste = liste.filter(function(k){ return tarihFiltreKontrol.icindeMi(k.ts); });
    var kapsayici = document.getElementById("ksListe");
    var bos = document.getElementById("ksBos");
    if(!liste.length){ kapsayici.innerHTML = ""; bos.hidden = false; return; }
    bos.hidden = true;

    var gruplar = tlGrupla(liste);
    kapsayici.innerHTML = gruplar.map(function(g){
      var toplamGun = g.kayitlar.reduce(function(s,k){ return s + (k.tutar||0); }, 0);
      var kartlar = g.kayitlar.map(tlKartHTML).join("");
      return "<div class='sr-grup-baslik'><span>" + gunBasligi(g.ts) + "</span><span>" + fmt(toplamGun) + " €</span></div>"
        + "<div class='sr-liste-kutu'>" + kartlar + "</div>";
    }).join("");

    kapsayici.querySelectorAll(".sr-satir").forEach(function(el){
      el.onclick = function(){
        var k = liste[parseInt(this.getAttribute("data-i"), 10)];
        localStorage.setItem("weiconv2_goruntulenen_belge", JSON.stringify({tip:k.tip, ts:k.ts}));
        window.location.href = "belge-onizleme.html";
      };
    });
  }catch(e){ hataGoster("Liste çizilemedi: " + e.message); }
}

document.addEventListener("DOMContentLoaded", function(){
  tarihiGuncelle();
  var btnMenuEl = document.getElementById("btnMenu");
  if(btnMenuEl) btnMenuEl.onclick = function(){ window.location.href = "menu.html"; };
  document.getElementById("btnSiralama").onclick = function(){
    siralamaYonu = siralamaYonu === "yeni" ? "eski" : "yeni";
    this.textContent = siralamaYonu === "yeni" ? "Yeni → Eski ⇅" : "Eski → Yeni ⇅";
    listeyiCiz();
  };
  tarihFiltreKontrol = TarihFiltre.ekle("tarihFiltreYeri", { varsayilan: "tumu", degisti: listeyiCiz });

  ReportsData.arsivDegistiginde(listeyiCiz);
});
