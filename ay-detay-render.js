/*
  ay-detay-render.js — WG.271026.1828.1087
  ===================
  Aylık Özet tablosunda bir aya dokununca açılan, o ayın sipariş
  kayıtlarını gün gün listeleyen AYRI sayfa. Hangi ay gösterilecek,
  localStorage'daki "weiconv2_goruntulenen_ay" anahtarından okunur
  (reports-render.js buraya yönlendirmeden önce yazar).
  14.10.2026 (Abdullah'ın isteğiyle): satır tasarımı Müşteri Listesi/Son
  İşlemler'deki tek-satırlık tablo diline çevrildi — gün gruplama aynen
  korundu.
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

function fmt(n){
  return (n||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2});
}

// v3 — tarih gruplu tasarım. Bu sabitler gecmis-render.js,
// son-islemler-render.js, satis-listesi-render.js, kacan-satislar-render.js
// ile birebir aynı tutulmalı.
var TIP_META = {
  siparis:  {rozet:"SP",    rozetBg:"#e6f1fb", rozetRenk:"#0c447c", serit:"#185fa5", kodRenk:"#003a70"},
  teklif:   {rozet:"FT",    rozetBg:"#e1f5ee", rozetRenk:"#0e6b58", serit:"#28a745", kodRenk:"#1a7431"},
  proforma: {rozet:"PF",    rozetBg:"#ffe4cc", rozetRenk:"#b45309", serit:"#e8690a", kodRenk:"#8a4306"},
  numune:   {rozet:"NM",    rozetBg:"#fce4ec", rozetRenk:"#ad1457", serit:"#c2185b", kodRenk:"#8e0e45"}
};
var RVZ_META = {rozet:"RVZ", rozetBg:"#faeeda", rozetRenk:"#854f0b", serit:"#b7601f"};
var KACAN_META = {rozet:"KAÇTI", rozetBg:"#fdecea", rozetRenk:"#a32d2d", serit:"#c0392b"};
var KANAL_HARF = {mail:"M", whatsapp:"W"};
var KANAL_RENK = {mail:"#185fa5", whatsapp:"#128C7E"};
var GUNLER_UZUN = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
var AYLAR_UZUN = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
function kanalHarfHTML(kanal){
  if(!kanal || !KANAL_HARF[kanal]) return "";
  return "<span class='sr-kanal-harf' style='color:" + KANAL_RENK[kanal] + ";'>" + KANAL_HARF[kanal] + "</span>";
}
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
var HARF_RENK = {siparis:"#003a70", teklif:"#28a745", proforma:"#e8690a", numune:"#c2185b"};
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
// Rozet | Belge | Tutar | Ok. Gün gruplama (başlık + günlük toplam) AYNEN
// KORUNDU — sadece satır görünümü değişti.
function tlKartHTML(k){
  var kacanMi = k.durum === "kacan";
  var revizeMi = !!k.revizeZamani;
  var meta = TIP_META[k.tip] || TIP_META.siparis;
  var rozetMeta = kacanMi ? KACAN_META : (revizeMi ? RVZ_META : meta);
  var kod = k.kod || meta.rozet;
  var tutarHucre = k.durum==="beklemede"
    ? "<span class='sr-durum-ek sr-durum-ek--beklemede'>⏳ Stok Bekliyor</span>"
    : (bakiyeKayitVarMi(k) ? "<span class='sr-durum-ek sr-durum-ek--bakiye'>📦 Bekleyen</span>" : fmt(k._tutar) + " €");
  return "<div class='sr-satir' data-i='" + k._i + "' style='border-left-color:" + rozetMeta.serit + ";'>"
    + "<div class='sr-firma-h'>" + htmlEsc(k.musteri||"") + "</div>"
    + "<div class='sr-konum-h'>" + htmlEsc(k.sehir||"") + "</div>"
    + "<span class='sr-rozet-h' style='background:" + rozetMeta.rozetBg + ";color:" + rozetMeta.rozetRenk + ";'>" + rozetMeta.rozet + "</span>"
    + "<div class='sr-belge-h'>" + kanalHarfHTML(k.kanal) + kodHTML(kod, k.tip) + "</div>"
    + "<div class='sr-tutar-h'>" + tutarHucre + "</div>"
    + "<div class='sr-ok-h'>&#8250;</div>"
    + "</div>";
}
// BAKİYE (07.10.2026) — kayıt satislarListele/tumKacanlar'dan geldiyse
// hazır "bakiyeVarMi" bayrağını, sonIslemler()'den ham geldiyse urunler
// dizisini kontrol eder (bkz. reports-data.js).
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
function tlListeHTML(gruplar){
  return gruplar.map(function(g){
    var toplamGun = g.kayitlar.reduce(function(s,k){ return s + k._tutar; }, 0);
    var kartlar = g.kayitlar.map(function(k){ return tlKartHTML(k); }).join("");
    return "<div class='sr-grup-baslik'><span>" + gunBasligi(g.ts) + "</span><span>" + fmt(toplamGun) + " €</span></div>"
      + "<div class='sr-liste-kutu'>" + kartlar + "</div>";
  }).join("");
}

var BEKLEMEDE_DAHIL_ANAHTAR = "weiconv2_beklemede_dahil_et";
var ayVerisi = null;

function ayVerisiniOku(){
  try{
    return JSON.parse(localStorage.getItem("weiconv2_goruntulenen_ay") || "null");
  }catch(e){ return null; }
}

function ayDetayiniCiz(){
  try{
    if(!ayVerisi) return;
    var beklemedeDahil = localStorage.getItem(BEKLEMEDE_DAHIL_ANAHTAR) === "1";
    // Sadece SİPARİŞ'ler sayılır ve listelenir — Numune/Fiyat Teklifi/
    // Proforma bu ekranda gösterilmez (hepsi zaten "Son İşlemler"de
    // ayrıca görünüyor). "AY TOPLAMI" gerçek satış hacmini yansıtsın diye.
    // "beklemede" siparişler gerçek satış değildir, varsayılan olarak
    // hiçbir toplama dahil edilmez (permanent kural). "Beklemede dahil
    // et" anahtarı açıksa, sadece bu ekranda geçici olarak gösterilir.
    var kayitlarBuAy = ReportsData.sonIslemler().filter(function(k){
      if(!k.tarih) return false;
      if(k.tip !== "siparis") return false;
      if(k.durum === "beklemede" && !beklemedeDahil) return false;
      var parca = k.tarih.split(" ");
      return (parca[1]||"")===ayVerisi.ayAd && (parca[2]||"")===ayVerisi.yil;
    });

    document.getElementById("ayDetayBaslik").textContent = "📅 " + ayVerisi.ayAd + " " + ayVerisi.yil + " Kayıtları";
    document.getElementById("rotaAyEtiketi").textContent = ayVerisi.ayAd + " " + ayVerisi.yil;

    if(kayitlarBuAy.length === 0){
      document.getElementById("ayDetayToplamEtiket").textContent = "🧮 SİPARİŞ TOPLAMI (0 kayıt)";
      document.getElementById("ayDetayToplamDeger").textContent = "0,00 EURO";
      document.getElementById("ayDetayListesi").innerHTML = "<p class='bos-mesaj'>Bu ayda sipariş kaydı yok.</p>";
      return;
    }

    var ayToplamEuro = kayitlarBuAy.reduce(function(s,k){
      return s + (k.urunler||[]).reduce(function(ss,u){ return ss+(u.toplamEuro||0); }, 0);
    }, 0);
    var ayToplamTl = kayitlarBuAy.reduce(function(s,k){
      var kKuru = k.kur || (parseFloat(localStorage.getItem("weicon_kur"))||0);
      return s + (k.urunler||[]).reduce(function(ss,u){ return ss+((u.toplamEuro||0)*kKuru); }, 0);
    }, 0);

    document.getElementById("ayDetayToplamEtiket").textContent = "🧮 SİPARİŞ TOPLAMI (" + kayitlarBuAy.length + " kayıt)";
    document.getElementById("ayDetayToplamDeger").textContent = fmt(ayToplamEuro) + " EURO · ≈ " + fmt(ayToplamTl) + " TL";

    kayitlarBuAy.forEach(function(k){
      k._tutar = (k.urunler||[]).reduce(function(s,u){ return s+(u.toplamEuro||0); }, 0);
    });
    var gruplar = tlGrupla(kayitlarBuAy);
    document.getElementById("ayDetayListesi").innerHTML = tlListeHTML(gruplar);

    document.getElementById("ayDetayListesi").querySelectorAll(".sr-satir").forEach(function(el){
      el.onclick = function(){
        var k = kayitlarBuAy[parseInt(this.getAttribute("data-i"), 10)];
        localStorage.setItem("weiconv2_goruntulenen_belge", JSON.stringify({tip:k.tip, ts:k.ts}));
        window.location.href = "belge-onizleme.html";
      };
    });
  }catch(e){ hataGoster("Ay detayı çizilemedi: " + e.message); }
}

window.addEventListener("error", function(ev){
  hataGoster("HATA: " + ev.message + " (" + (ev.filename||"").split("/").pop() + ":" + ev.lineno + ")");
});

document.addEventListener("DOMContentLoaded", function(){
  tarihiGuncelle();
  var btnMenuEl = document.getElementById("btnMenu");
  if(btnMenuEl) btnMenuEl.onclick = function(){ window.location.href = "menu.html"; };
  (function(){
    var btn = document.getElementById("btnGeriAkilli");
    if(btn) btn.onclick = function(){
      if(window.history.length > 1) window.history.back();
      else window.location.href = "reports.html";
    };
  })();

  ayVerisi = ayVerisiniOku();
  if(!ayVerisi){
    hataGoster("Gösterilecek ay bulunamadı, İstatistikler sayfasına dönülüyor.");
    window.location.href = "reports.html";
    return;
  }

  var toggle = document.getElementById("ayDetayBeklemedeToggle");
  toggle.checked = localStorage.getItem(BEKLEMEDE_DAHIL_ANAHTAR) === "1";
  toggle.onchange = function(){
    localStorage.setItem(BEKLEMEDE_DAHIL_ANAHTAR, this.checked ? "1" : "0");
    ayDetayiniCiz();
  };

  ReportsData.arsivDegistiginde(function(){ ayDetayiniCiz(); });
  ayDetayiniCiz();
});
