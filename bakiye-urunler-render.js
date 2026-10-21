/*
  bakiye-urunler-render.js — WG.211026.1500.901
  ================================================
  "Bakiyedeki / Bekleyen Ürünler" ekranı — stokta tam olmayıp müşteride
  bekleyen/bakiyede bırakılan ürün SATIRLARINI (ReportsData.
  bakiyedekiUrunler(), reports-data.js) tek bir listede gösterir.

  AYRIM (21.10.2026, Abdullah'ın isteğiyle): "tamamen yok" (elde hiç yok,
  adet=0) ile "kısmi bakiye" (bir kısmı teslim edildi, adet>0) ayrı ayrı
  gösterilir — YENİ bir veri alanı eklenMEDEN, salt mevcut u.adet / u.
  bakiyeAdet karşılaştırmasından türetilir (s.adet reports-data.js'den
  geliyor). Kart tasarımı KESİN 2 SATIR kuralına uyar (müşteri bilgisi
  + durum notu hiçbir koşulda sarmaz, uzunsa "..." ile kırpılır) — bunun
  için bu ekrana ÖZEL, paylaşılmayan .bu-kart* sınıfları kullanılır
  (diğer liste ekranlarının ortak .tl-kart/.tl-govde yapısına DOKUNULMAZ).
  Bir satıra dokunulunca o siparişin TAM tablosu açılır (satış listesindeki
  "Belgeyi Aç" ile birebir aynı localStorage devri + yönlendirme).
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
  }catch(e){}
}

function htmlEsc(s){
  return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

var HARF_RENK = {siparis:"#003a70", teklif:"#28a745", proforma:"#8e44ad", numune:"#b7601f"};
var OK_SVG = "<svg width='8' height='12' viewBox='0 0 20 32' fill='none'><path d='M4 4 L16 16 L4 28' stroke='#e24b4a' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/></svg>";

function cariSatirHTML(kod, isim, sehir){
  return "<span class='cari-kod'>" + htmlEsc(kod||"—") + "</span>"
    + "<span class='cari-ayrac'> - </span>"
    + "<span class='cari-isim'>" + htmlEsc(isim||"") + "</span>"
    + (sehir ? "<span class='cari-ayrac'> - </span><span class='cari-sehir'>" + htmlEsc(sehir) + "</span>" : "");
}
function kodHTML(kod, tip){
  kod = String(kod == null ? "" : kod);
  var i = kod.indexOf(".");
  var harf = i > 0 ? kod.slice(0, i) : kod;
  var kalan = i > 0 ? kod.slice(i) : "";
  return "<span style='color:" + (HARF_RENK[tip] || HARF_RENK.siparis) + ";'>" + htmlEsc(harf) + "</span>" + htmlEsc(kalan);
}

// "Tamamen yok" (s.adet<=0 — elde hiç kalmamış, sipariş tamamen bekliyor)
// ile "kısmi bakiye" (s.adet>0 — bir kısmı zaten teslim/fatura edilmiş,
// kalanı bakiyede) ayrımı SADECE bu satırda, ikon/renk/metin olarak
// yapılır — veri modeline yeni alan eklenmez (21.10.2026, Abdullah'ın
// isteğiyle). Her iki satır da KESİN 2 SATIR için nowrap+ellipsis.
function bakiyeKartHTML(s){
  var tamamenYokMu = !((s.adet||0) > 0);
  var renk = tamamenYokMu ? "#c0392b" : "#b7601f";
  var durumMetni = tamamenYokMu ? "🚫 Tamamı bekliyor" : ("📦 " + (s.bakiyeAdet||0) + " adet bakiyede");
  var satir2 = durumMetni + " — " + htmlEsc(s.urunAd) + (s.bakiyeNot ? " · " + htmlEsc(s.bakiyeNot) : "");
  return "<div class='bu-kart' data-i='" + s._i + "'>"
    + "<div class='bu-kart-serit' style='background:#faeeda;border-right:1.5px solid #b7601f;'></div>"
    + "<div class='bu-kart-govde'>"
    + "<div class='bu-kart-satir1'>"
    + "<span class='bu-kart-musteri'>" + cariSatirHTML(s.musteriId, s.musteri, s.sehir) + "</span>"
    + "<span class='bu-kart-sag'>" + kodHTML(s.kod, s.tip) + (s.tarih ? " · " + htmlEsc(s.tarih) : "") + "</span>"
    + "<button class='bu-kart-ok' aria-label='Siparişin tam tablosunu aç'>" + OK_SVG + "</button>"
    + "</div>"
    + "<div class='bu-kart-satir2' style='color:" + renk + ";'>" + satir2 + "</div>"
    + "</div>"
    + "</div>";
}

// Müşteri kartından "Bekleyen Ürünler" ile gelindiyse SADECE o müşterinin
// kayıtları gösterilir (07.10.2026, Abdullah'ın isteğiyle). Filtre bir kerelik
// kullanılır — okunduktan sonra temizlenir ki Raporlar'daki genel giriş
// (hiç filtresiz) her zaman tüm listeyi göstersin.
function musteriFiltresiniAlVeTemizle(){
  try{
    var ham = localStorage.getItem("weiconv2_bakiye_musteri_filtre");
    if(!ham) return null;
    localStorage.removeItem("weiconv2_bakiye_musteri_filtre");
    return JSON.parse(ham);
  }catch(e){ return null; }
}
function ayniMusteriMi(kayitAd, kayitId, seciliAd, seciliId){
  if(seciliId && kayitId) return kayitId === seciliId;
  var a = (kayitAd||"").toLocaleLowerCase("tr-TR").trim();
  var b = (seciliAd||"").toLocaleLowerCase("tr-TR").trim();
  return !!a && !!b && a === b;
}

function listeyiCiz(){
  try{
    var tumSatirlar = ReportsData.bakiyedekiUrunler();
    var kapsayici = document.getElementById("buListe");
    var bos = document.getElementById("buBos");
    var baslik = document.getElementById("buBaslik");

    var musteriFiltre = musteriFiltresiniAlVeTemizle();
    var satirlar = musteriFiltre
      ? tumSatirlar.filter(function(s){ return ayniMusteriMi(s.musteri, s.musteriId, musteriFiltre.ad, musteriFiltre.id); })
      : tumSatirlar;

    if(!satirlar.length){
      kapsayici.innerHTML = "";
      baslik.hidden = true;
      bos.hidden = false;
      bos.textContent = musteriFiltre
        ? (musteriFiltre.ad + " için bakiyede bekleyen ürün yok.")
        : "Bakiyede bekleyen ürün yok.";
      return;
    }
    bos.hidden = true;
    baslik.hidden = false;
    baslik.textContent = musteriFiltre
      ? ("📦 " + musteriFiltre.ad.toLocaleUpperCase("tr-TR") + " — BEKLEYEN ÜRÜNLER — " + satirlar.length + " kayıt")
      : "📦 BAKİYEDE BEKLEYEN ÜRÜNLER — " + satirlar.length + " kayıt";

    satirlar.forEach(function(s, i){ s._i = i; });
    kapsayici.innerHTML = "<div class='tl-liste-kutu'>" + satirlar.map(bakiyeKartHTML).join("<div class='bu-kart-ayrac'></div>") + "</div>";

    kapsayici.querySelectorAll(".bu-kart[data-i]").forEach(function(el){
      el.onclick = function(){
        var s = satirlar[parseInt(this.getAttribute("data-i"), 10)];
        localStorage.setItem("weiconv2_goruntulenen_belge", JSON.stringify({tip:s.tip, ts:s.ts}));
        window.location.href = "belge-onizleme.html";
      };
    });
  }catch(e){ hataGoster("Liste çizilemedi: " + e.message); }
}

document.addEventListener("DOMContentLoaded", function(){
  tarihiGuncelle();
  var btnMenuEl = document.getElementById("btnMenu");
  if(btnMenuEl) btnMenuEl.onclick = function(){ window.location.href = "menu.html"; };
  ReportsData.arsivDegistiginde(listeyiCiz);
});
