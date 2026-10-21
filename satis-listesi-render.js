/* satis-listesi-render.js — WG.211026.2235.919
   TARİH FİLTRESİ (21.10.2026, Abdullah onayı): liste artık HER ZAMAN
   ReportsData.satislarListele("tumu") ile (sınırsız) çekilir — eski
   ?kapsam=bugun/ay URL parametresi SADECE paylaşılan TarihFiltre
   bileşeninin BAŞLANGIÇ ön-ayarını belirler (sayfa ilk açıldığında hangi
   çip aktif görünsün), asıl daraltmayı istemci tarafında TarihFiltre
   yapar — kullanıcı istediğinde "Tümü"ye veya başka bir aralığa
   genişletebilir/daraltabilir. */
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

// v3 — tarih gruplu tasarım (05.09.2026). Bu sabitler gecmis-render.js,
// son-islemler-render.js, reports-render.js ve
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
// TABLO TASARIMI (14.10.2026, Abdullah'ın isteğiyle — Müşteri Listesi/Son
// İşlemler'deki tasarım TÜM listelere uygulanıyor): eski 2 satırlı tl-kart
// kaldırıldı, GERÇEK TEK SATIRLIK TABLO (CSS Grid) — Firma | Konum | Rozet
// | Belge | Tutar | Ok (Son İşlemler'deki ile AYNI sütun düzeni — müşteri
// kodu burada YOK, 7 sütun tek satıra sığmıyordu/firma adını aşırı
// daraltıyordu; firma+konum zaten müşteriyi tanımlıyor, kod detay ekranında
// hâlâ görünüyor). Kutu/çerçeve YOK, gün gruplama başlığı sadece renkli
// etiket. Firma/Konum hiç kesilmez, uzun metin alt satıra sarar.
function kodHTML(kod, tip){
  kod = String(kod == null ? "" : kod);
  var i = kod.indexOf(".");
  var harf = i > 0 ? kod.slice(0, i) : kod;
  var kalan = i > 0 ? kod.slice(i) : "";
  return "<span style='color:" + (HARF_RENK[tip] || HARF_RENK.siparis) + ";'>" + htmlEsc(harf) + "</span>" + htmlEsc(kalan);
}
var HARF_RENK = {siparis:"#003a70", teklif:"#28a745", proforma:"#e8690a", numune:"#c2185b"};
function srSatirHTML(k, serit, rozetMeta, kod, tutarHucre, dataAd, dataDeger){
  return "<div class='sr-satir' data-" + dataAd + "='" + dataDeger + "' style='border-left-color:" + serit + ";'>"
    + "<div class='sr-firma-h'>" + htmlEsc(k.musteri||"") + "</div>"
    + "<div class='sr-konum-h'>" + htmlEsc(k.sehir||"") + "</div>"
    + "<span class='sr-rozet-h' style='background:" + rozetMeta.rozetBg + ";color:" + rozetMeta.rozetRenk + ";'>" + rozetMeta.rozet + "</span>"
    + "<div class='sr-belge-h'>" + kanalHarfHTML(k.kanal) + kodHTML(kod, k.tip) + "</div>"
    + "<div class='sr-tutar-h'>" + tutarHucre + "</div>"
    + "<div class='sr-ok-h'>&#8250;</div>"
    + "</div>";
}
function tlKartHTML(k){
  var kacanMi = k.durum === "kacan";
  var revizeMi = !!k.revizeZamani;
  var meta = TIP_META[k.tip] || TIP_META.siparis;
  var rozetMeta = kacanMi ? KACAN_META : (revizeMi ? RVZ_META : meta);
  var kod = k.kod || meta.rozet;
  var tutarHucre = bakiyeKayitVarMi(k) ? "<span class='sr-durum-ek sr-durum-ek--bakiye'>📦 Bekleyen</span>" : fmt(k._tutar) + " €";
  return srSatirHTML(k, rozetMeta.serit, rozetMeta, kod, tutarHucre, "i", k._i);
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
    var kartlar = g.kayitlar.map(tlKartHTML).join("");
    return "<div class='sr-grup-baslik'><span>" + gunBasligi(g.ts) + "</span><span>" + fmt(toplamGun) + " €</span></div>"
      + "<div class='sr-liste-kutu'>" + kartlar + "</div>";
  }).join("");
}

function bekleyenKartHTML(k){
  var meta = TIP_META[k.tip] || TIP_META.siparis;
  var kod = k.kod || meta.rozet;
  var durumHucre = "<span class='sr-durum-ek sr-durum-ek--beklemede'>⏳ " + htmlEsc(k.beklemedeNot || "Bekliyor") + "</span>";
  return srSatirHTML(k, "#a9743b", {rozetBg:"#e9d9c3", rozetRenk:"#5b3c1e", rozet:meta.rozet}, kod, durumHucre, "bekleyen-i", k._bi);
}
function bekleyenListeHTML(bekleyenler){
  if(!bekleyenler.length) return "";
  return "<div class='bekleyen-blok'>"
    + "<div class='sr-grup-baslik sr-grup-baslik--turuncu'>⏳ BEKLEYEN ÜRÜNLER — toplamlara dahil değil</div>"
    + "<div class='sr-liste-kutu'>" + bekleyenler.map(bekleyenKartHTML).join("") + "</div>"
    + "</div>";
}

// TARİH FİLTRESİ (21.10.2026, Abdullah onayı) — paylaşılan TarihFiltre
// bileşeni, DOMContentLoaded içinde kurulup buraya atanır.
var tarihFiltreKontrol = null;

function listeyiCiz(){
  try{
    var tumListe = ReportsData.satislarListele("tumu");
    var kapsayici = document.getElementById("slListe");
    var bos = document.getElementById("slBos");
    if(tarihFiltreKontrol) tumListe = tumListe.filter(function(k){ return tarihFiltreKontrol.icindeMi(k.ts); });
    if(!tumListe.length){ kapsayici.innerHTML = ""; bos.hidden = false; return; }
    bos.hidden = true;

    tumListe.forEach(function(k){ k._tutar = k.toplam || 0; if(!k.tip) k.tip = "siparis"; });
    // Beklemede (stokta yok/tedarik bekleniyor) siparişler AYRI bir bölümde
    // gösterilir ve gün/ay toplamlarının HİÇBİRİNE dahil edilmez (07.09.2026).
    var liste = tumListe.filter(function(k){ return k.durum !== "beklemede"; });
    var bekleyenler = tumListe.filter(function(k){ return k.durum === "beklemede"; });
    bekleyenler.forEach(function(k, i){ k._bi = i; });

    var gruplar = tlGrupla(liste);
    kapsayici.innerHTML = bekleyenListeHTML(bekleyenler) + (liste.length ? tlListeHTML(gruplar) : (bekleyenler.length ? "" : "<p class='bos-mesaj'>Bu kapsamda satış kaydı yok.</p>"));

    kapsayici.querySelectorAll(".sr-satir[data-i]").forEach(function(el){
      el.onclick = function(){
        var k = liste[parseInt(this.getAttribute("data-i"), 10)];
        localStorage.setItem("weiconv2_goruntulenen_belge", JSON.stringify({tip:k.tip, ts:k.ts}));
        window.location.href = "belge-onizleme.html";
      };
    });
    kapsayici.querySelectorAll(".sr-satir[data-bekleyen-i]").forEach(function(el){
      el.onclick = function(){
        var k = bekleyenler[parseInt(this.getAttribute("data-bekleyen-i"), 10)];
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
  var params = new URLSearchParams(window.location.search);
  var kapsam = params.get("kapsam") === "ay" ? "ay" : "bugun";
  document.getElementById("rotaBaslik").textContent = kapsam === "ay" ? "Bu Ayın Satışları" : "Bugünün Satışları";

  tarihFiltreKontrol = TarihFiltre.ekle("tarihFiltreYeri", {
    varsayilan: kapsam === "ay" ? "bu_ay" : "bugun",
    degisti: listeyiCiz
  });

  ReportsData.arsivDegistiginde(listeyiCiz);
});
