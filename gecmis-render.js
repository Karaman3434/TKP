/*
  gecmis-render.js — WG.271026.1828.1094
  ================
  Müşteriye özel İşlem Geçmişi sayfası. ReportsData.sonIslemler() zaten
  en yeniden en eskiye sıralı geliyor (bkz. reports-data.js); burada
  sadece seçili müşteriye ait kayıtlar filtrelenir, sonra aktif tip
  filtresi uygulanır. Renk/kod mantığı reports-render.js'deki
  kodRozetVeRenkGetir ile birebir aynı tutulur (KOD_RENK).
  14.10.2026 (Abdullah'ın isteğiyle): satır tasarımı Müşteri Listesi/Son
  İşlemler'deki tek-satırlık tablo diline çevrildi (Firma/Konum sütunları
  yok — tek müşteriye özel sayfa); gün gruplama aynen korundu.
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

var seciliMusteriAdi = null;
var aktifTip = "";
// TARİH FİLTRESİ (21.10.2026, Abdullah onayı) — paylaşılan TarihFiltre
// bileşeni, DOMContentLoaded içinde kurulup buraya atanır.
var tarihFiltreKontrol = null;

function ayniMusteriKaydiMi(kayitMusteriAdi, kayitMusteriId, seciliAd, seciliId){
  if(seciliId && kayitMusteriId) return kayitMusteriId === seciliId;
  var a = (kayitMusteriAdi||"").toLocaleLowerCase("tr-TR").trim();
  var b = (seciliAd||"").toLocaleLowerCase("tr-TR").trim();
  if(!a || !b) return false;
  if(a === b) return true;
  return a.indexOf(b) === 0 || b.indexOf(a) === 0;
}

// v3 — tarih gruplu tasarım (05.09.2026). Bu sabitler reports-render.js,
// son-islemler-render.js, satis-listesi-render.js ve
// kacan-satislar-render.js'de birebir aynı tutulmalı.
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
// kaldırıldı, GERÇEK TEK SATIRLIK TABLO (CSS Grid). Bu sayfa TEK bir
// müşteriye ait (isim üstte zaten gösteriliyor) — Firma/Konum sütunları
// burada GEREKSİZ (her satırda aynı değer tekrar eder), bu yüzden sadece
// Rozet | Belge | Tutar/Durum | Ok sütunları var. Rakip bilgisi (kaçan
// kayıtlarda) satırın altında küçük bir not olarak kalmaya devam ediyor.
function tlKartHTML(k){
  var kacanMi = k.durum === "kacan";
  var revizeMi = !!k.revizeZamani;
  var meta = TIP_META[k.tip] || TIP_META.siparis;
  var rozetMeta = kacanMi ? KACAN_META : (revizeMi ? RVZ_META : meta);
  var kod = k.kod || meta.rozet;
  var beklemedeMi = k.durum === "beklemede";
  var tutarHucre = beklemedeMi
    ? "<span class='sr-durum-ek sr-durum-ek--beklemede'>⏳ Stok Bekliyor</span>"
    : (bakiyeKayitVarMi(k) ? "<span class='sr-durum-ek sr-durum-ek--bakiye'>📦 Bekleyen</span>" : fmt(k._tutar) + " €");
  return "<div class='sr-satir sr-satir--tekmusteri" + (beklemedeMi ? " sr-satir--beklemede" : "") + "' data-i='" + k._i + "' style='border-left-color:" + rozetMeta.serit + ";'>"
    + "<span class='sr-rozet-h' style='background:" + rozetMeta.rozetBg + ";color:" + rozetMeta.rozetRenk + ";'>" + rozetMeta.rozet + "</span>"
    + "<div class='sr-belge-h'>" + kanalHarfHTML(k.kanal) + kodHTML(kod, k.tip) + (kacanMi && k.kacanRakip ? "<span class='sr-rakip'> · Rakip: " + htmlEsc(k.kacanRakip) + "</span>" : "") + "</div>"
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
var BEKLEMEDE_DAHIL_ANAHTAR = "weiconv2_beklemede_dahil_et";
function tlListeHTML(gruplar){
  var beklemedeDahil = localStorage.getItem(BEKLEMEDE_DAHIL_ANAHTAR) === "1";
  return gruplar.map(function(g){
    // HATA DÜZELTME (WG.070926.2120.192): beklemede kayıtlar rozetle
    // gösterilmeye devam eder; "Beklemede dahil et" anahtarı kapalıysa
    // (varsayılan) gün toplamına dahil edilmez.
    var toplamGun = g.kayitlar.reduce(function(s,k){ return s + ((k.durum==="beklemede" && !beklemedeDahil) ? 0 : k._tutar); }, 0);
    var kartlar = g.kayitlar.map(function(k){ return tlKartHTML(k); }).join("");
    return "<div class='sr-grup-baslik'><span>" + gunBasligi(g.ts) + "</span><span>" + fmt(toplamGun) + " €</span></div>"
      + "<div class='sr-liste-kutu'>" + kartlar + "</div>";
  }).join("");
}

function listeyiCiz(){
  try{
    var seciliMusteri = CustomerData.musteriBul(seciliMusteriAdi);
    var seciliId = seciliMusteri ? seciliMusteri.id : null;
    var tumu = ReportsData.sonIslemler();
    var bunaAit = tumu.filter(function(k){ return ayniMusteriKaydiMi(k.musteri, k.musteriId, seciliMusteriAdi, seciliId); });

    document.getElementById("gecmisMusteriSayac").textContent = bunaAit.length + " kayıtlı işlem";

    var farkliIsimliKayit = bunaAit.find(function(k){
      return (k.musteri||"").trim() !== (seciliMusteriAdi||"").trim();
    });
    var uyusmazlikKutu = document.getElementById("isimUyusmazlikKutu");
    if(farkliIsimliKayit){
      uyusmazlikKutu.hidden = false;
      document.getElementById("isimUyusmazlikMetin").textContent =
        "⚠️ Bazı eski kayıtlarda farklı bir isim var: \"" + farkliIsimliKayit.musteri + "\". "
        + "Bu kayıtlar gösteriliyor ama isimleri güncel Cari Bilgi (\"" + seciliMusteriAdi + "\") ile eşleşmiyor.";
      document.getElementById("btnIsimUyusmazlikDuzelt").onclick = isimleriEsitleTiklandi;
    } else {
      uyusmazlikKutu.hidden = true;
    }

    var filtreli = aktifTip === "beklemede" ? bunaAit.filter(function(k){ return k.durum === "beklemede"; })
      : (aktifTip ? bunaAit.filter(function(k){ return k.tip === aktifTip; }) : bunaAit);
    if(tarihFiltreKontrol) filtreli = filtreli.filter(function(k){ return tarihFiltreKontrol.icindeMi(k.ts); });

    var kapsayici = document.getElementById("gecmisListesi");
    var bos = document.getElementById("gecmisBos");
    if(filtreli.length === 0){
      kapsayici.innerHTML = "";
      bos.hidden = false;
      return;
    }
    bos.hidden = true;

    filtreli.forEach(function(k){
      k._tutar = (k.urunler||[]).reduce(function(s,u){ return s+(u.toplamEuro||0); }, 0);
    });
    var gruplar = tlGrupla(filtreli);
    kapsayici.innerHTML = tlListeHTML(gruplar);

    kapsayici.querySelectorAll(".sr-satir").forEach(function(el){
      el.onclick = function(){
        var k = filtreli[parseInt(this.getAttribute("data-i"), 10)];
        localStorage.setItem("weiconv2_goruntulenen_belge", JSON.stringify({tip:k.tip, ts:k.ts}));
        window.location.href = "belge-onizleme.html";
      };
    });
  }catch(e){ hataGoster("İşlem geçmişi çizilemedi: " + e.message); }
}

function isimleriEsitleTiklandi(){
  try{
    var tumu = ReportsData.sonIslemler();
    var seciliMusteri = CustomerData.musteriBul(seciliMusteriAdi);
    var seciliId = seciliMusteri ? seciliMusteri.id : null;
    var bunaAit = tumu.filter(function(k){ return ayniMusteriKaydiMi(k.musteri, k.musteriId, seciliMusteriAdi, seciliId); });
    var farkliIsimler = [];
    bunaAit.forEach(function(k){
      var isim = (k.musteri||"").trim();
      if(isim && isim !== (seciliMusteriAdi||"").trim() && farkliIsimler.indexOf(isim)===-1) farkliIsimler.push(isim);
    });
    if(!farkliIsimler.length) return;
    if(!confirm("Şu eski isim varyant(lar)ı bulundu:\n\n" + farkliIsimler.join("\n") + "\n\nBunlara ait TÜM kayıtlar (sipariş/teklif/görev), güncel isim \"" + seciliMusteriAdi + "\" ile eşitlenecek. Devam edilsin mi?")) return;
    var kalanSayi = farkliIsimler.length;
    for(var i=0;i<farkliIsimler.length;i++){
      ReportsData.kayitlariBirlestir(farkliIsimler[i], null, seciliMusteriAdi, seciliId, function(basarili, err){
        kalanSayi--;
        if(!basarili) hataGoster("İsim eşitleme hatası: " + (err && err.message ? err.message : "bilinmeyen hata"));
        if(kalanSayi<=0) listeyiCiz();
      });
    }
  }catch(e){ hataGoster("İsimler eşitlenemedi: " + e.message); }
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
  document.getElementById("gecmisMusteriAd").textContent = secili.ad;

  // DÖNÜŞ ROTASI (06.10.2026, Abdullah'ın isteğiyle — "kesin kural"):
  // Geri eskiden KOŞULSUZ customer-detail.html'e gidiyordu. Küçük
  // pencereden (Müşteri Bul) "İşlem Geçmişi" seçilerek buraya
  // gelindiyse, artık customer.html'e dönüyor. Bayrak yoksa (customer-
  // detail.html'in kendi kutucuğundan gelindiyse) davranış DEĞİŞMEDİ.
  try{
    if(localStorage.getItem("weiconv2_musteri_donus_sayfa") === "customer.html"){
      var gecmisGeriEl = document.querySelector(".nav-btn--geri");
      if(gecmisGeriEl) gecmisGeriEl.setAttribute("href", "customer.html");
    }
  }catch(e){}

  document.getElementById("gecmisFiltreSatiri").querySelectorAll(".gecmis-filtre-cip").forEach(function(btn){
    btn.onclick = function(){
      document.querySelectorAll(".gecmis-filtre-cip").forEach(function(b){ b.classList.remove("gecmis-filtre-cip--aktif"); });
      this.classList.add("gecmis-filtre-cip--aktif");
      aktifTip = this.getAttribute("data-tip");
      listeyiCiz();
    };
  });
  tarihFiltreKontrol = TarihFiltre.ekle("tarihFiltreYeri", { varsayilan: "tumu", degisti: listeyiCiz });

  var beklemedeToggle = document.getElementById("gecmisBeklemedeToggle");
  beklemedeToggle.checked = localStorage.getItem(BEKLEMEDE_DAHIL_ANAHTAR) === "1";
  beklemedeToggle.onchange = function(){
    localStorage.setItem(BEKLEMEDE_DAHIL_ANAHTAR, this.checked ? "1" : "0");
    listeyiCiz();
  };

  listeyiCiz();
  ReportsData.arsivDegistiginde(listeyiCiz);
});
