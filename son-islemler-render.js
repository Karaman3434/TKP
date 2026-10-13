/*
  son-islemler-render.js — WG.131026.1455.798
  =======================
  reports-render.js'deki islemleriCiz/islemlerExcelAktar buradan taşındı.
  13.10.2026 (Abdullah onayı, mockup üzerinden): satır tasarımı yeniden
  yapıldı — tutar kaldırıldı, 2 satırlı yapı (isim üstte, rota/kod altta
  sağda), zincirli (İlerlet ile numune/teklif/proforma'dan gelmiş) kayıtlarda
  tam rota (bkz. kayit.rota — ReportsData.revizeBaslat/SendData.kaydet),
  zincirsiz kayıtlarda sadece kod gösteriliyor.
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

var TIP_ETIKET = {numune:"Numune", teklif:"Teklif", proforma:"Proforma", siparis:"Sipariş"};
// v3 — tarih gruplu tasarım (05.09.2026). Bu sabitler gecmis-render.js,
// reports-render.js, satis-listesi-render.js ve
// kacan-satislar-render.js'de birebir aynı tutulmalı.
var TIP_META = {
  siparis:  {rozet:"SP",    rozetBg:"#e6f1fb", rozetRenk:"#0c447c", serit:"#185fa5", kodRenk:"#003a70"},
  teklif:   {rozet:"FT",    rozetBg:"#e1f5ee", rozetRenk:"#0e6b58", serit:"#28a745", kodRenk:"#1a7431"},
  proforma: {rozet:"PF",    rozetBg:"#f3e8fb", rozetRenk:"#6a1b9a", serit:"#8e44ad", kodRenk:"#5c1680"},
  numune:   {rozet:"NM",    rozetBg:"#faeeda", rozetRenk:"#854f0b", serit:"#b7601f", kodRenk:"#7a4008"}
};
var RVZ_META = {rozet:"RVZ", rozetBg:"#faeeda", rozetRenk:"#854f0b", serit:"#b7601f"};
var KACAN_META = {rozet:"KAÇTI", rozetBg:"#fdecea", rozetRenk:"#a32d2d", serit:"#c0392b"};
var KANAL_HARF = {mail:"M", whatsapp:"W"};
var KANAL_RENK = {mail:"#185fa5", whatsapp:"#128C7E"};
var GUNLER_UZUN = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
var AYLAR_UZUN = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
var OK_SVG = "<svg width='8' height='12' viewBox='0 0 20 32' fill='none'><path d='M4 4 L16 16 L4 28' stroke='#e24b4a' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/></svg>";
function kanalHarfHTML(kanal){
  if(!kanal || !KANAL_HARF[kanal]) return "";
  return "<span class='tl-kanal-harf' style='color:" + KANAL_RENK[kanal] + ";'>" + KANAL_HARF[kanal] + "</span>";
}
function gunAnahtari(ts){
  var d = new Date(ts);
  return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
}
function gunBasligi(ts){
  var d = new Date(ts);
  return d.getDate() + " " + AYLAR_UZUN[d.getMonth()] + " " + d.getFullYear() + " • " + GUNLER_UZUN[d.getDay()];
}
// DÜZELTME (13.10.2026, Abdullah'ın isteğiyle): müşteri kodu (M-0071 gibi)
// satırdan kaldırıldı — artık sadece cari isim ve ilçe/il (sehir alanı zaten
// "İlçe - İl" biçiminde tek metin) gösteriliyor.
function cariSatirHTML(isim, sehir){
  return "<span class='cari-isim'>" + htmlEsc(isim||"") + "</span>"
    + (sehir ? "<span class='cari-ayrac'> - </span><span class='cari-sehir'>" + htmlEsc(sehir) + "</span>" : "");
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
function tlRotaRozetHTML(tip){
  var meta = TIP_META[tip] || TIP_META.siparis;
  return "<span class='tl-rota-rozet' style='background:" + meta.rozetBg + ";color:" + meta.rozetRenk + ";'>" + meta.rozet + "</span>";
}

// ROTA ZİNCİRİ (13.10.2026, Abdullah'ın isteğiyle): kaydın "rota" alanı
// varsa (numune/teklif/proforma üzerinden İlerlet edilerek buraya
// gelmişse), alt satırda tutar yerine tüm rotası (NM›FT›SP gibi,
// en sonda şimdiki kodu) gösterilir — yoksa (zincirsiz/tekil kayıt)
// sadece kendi rozeti+kodu yeterlidir.
function tlAltSatirHTML(k){
  if(k.rota && k.rota.length){
    var parcalar = k.rota.map(function(r){ return tlRotaRozetHTML(r.tip) + "<span class='tl-rota-ok-ikon'>›</span>"; }).join("");
    var meta = TIP_META[k.tip] || TIP_META.siparis;
    parcalar += tlRotaRozetHTML(k.tip) + "<span class='tl-rota-kod' style='color:" + meta.rozetRenk + ";'>" + htmlEsc(k.kod||"") + "</span>";
    return "<span class='tl-rota'>" + parcalar + "</span>";
  }
  var kacanMi = k.durum === "kacan";
  var revizeMi = !!k.revizeZamani;
  var meta = TIP_META[k.tip] || TIP_META.siparis;
  var rozetMeta = kacanMi ? KACAN_META : (revizeMi ? RVZ_META : meta);
  var kod = k.kod || meta.rozet;
  return "<span class='tl-kod-tek'>"
    + "<span class='tl-rozet' style='background:" + rozetMeta.rozetBg + ";color:" + rozetMeta.rozetRenk + ";'>" + rozetMeta.rozet + "</span>"
    + "<span class='tl-kod'>" + kanalHarfHTML(k.kanal) + kodHTML(kod, k.tip) + "</span>"
    + "</span>";
}

function tlKartHTML(k){
  var kacanMi = k.durum === "kacan";
  var revizeMi = !!k.revizeZamani;
  var meta = TIP_META[k.tip] || TIP_META.siparis;
  var rozetMeta = kacanMi ? KACAN_META : (revizeMi ? RVZ_META : meta);
  return "<div class='tl-kart' data-i='" + k._i + "'>"
    + "<div class='tl-serit' style='background:" + rozetMeta.serit + ";'></div>"
    + "<div class='tl-govde'>"
    + "<div class='tl-satir'>"
    + "<div class='tl-govde-ic'>"
    + "<div class='tl-ust'><span class='tl-ust-metin'>" + cariSatirHTML(k.musteri, k.sehir) + "</span></div>"
    + "<div class='tl-alt-satir'>" + tlAltSatirHTML(k) + "</div>"
    + "</div>"
    + "<div class='tl-ok-kutu'><button class='tl-ok' aria-label='Belgeyi aç'>" + OK_SVG + "</button></div>"
    + "</div>"
    + (k.durum==="beklemede" ? "<div class='tl-durum-ek tl-durum-ek--beklemede'>⏳ Beklemede" + (k.beklemedeNot ? ": " + htmlEsc(k.beklemedeNot) : "") + "</div>" : "")
    + (bakiyeKayitVarMi(k) ? "<div class='tl-durum-ek tl-durum-ek--bakiye'>📦 Bekleyen ürün var</div>" : "")
    + "</div>"
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
function tlListeHTML(gruplar, gosterIsim){
  return gruplar.map(function(g){
    // HATA DÜZELTME (WG.070926.2120.193): beklemede kayıtlar rozetle
    // gösterilmeye devam eder ama gün toplamına dahil edilmez.
    var toplamGun = g.kayitlar.reduce(function(s,k){ return s + (k.durum==="beklemede" ? 0 : k._tutar); }, 0);
    var kartlar = g.kayitlar.map(function(k){ return tlKartHTML(k, gosterIsim); }).join("<div class='tl-arasi'></div>");
    return "<div class='tl-grup-baslik'><span>" + gunBasligi(g.ts) + "</span><span>" + g.kayitlar.length + " işlem&nbsp;&nbsp;|&nbsp;&nbsp;" + fmt(toplamGun) + " EURO</span></div>"
      + "<div class='tl-liste-kutu'>" + kartlar + "</div>";
  }).join("");
}

function islemleriCiz(){
  try{
    var q = (document.getElementById("islemAra").value||"").trim().toLocaleLowerCase("tr-TR");
    var tipFiltre = document.getElementById("islemTipFiltre").value;

    var liste = ReportsData.sonIslemler();
    if(tipFiltre) liste = liste.filter(function(k){ return k.tip === tipFiltre; });
    if(q) liste = liste.filter(function(k){ return (k.musteri||"").toLocaleLowerCase("tr-TR").indexOf(q) >= 0; });
    liste = liste.slice(0, 100);

    var kapsayici = document.getElementById("islemlerListesi");
    var bos = document.getElementById("islemlerBosMesaj");

    if(liste.length === 0){
      kapsayici.innerHTML = "";
      bos.hidden = false;
      return;
    }
    bos.hidden = true;

    liste.forEach(function(k){
      k._tutar = (k.urunler||[]).reduce(function(s,u){ return s+(u.toplamEuro||0); }, 0);
    });
    var gruplar = tlGrupla(liste);
    kapsayici.innerHTML = tlListeHTML(gruplar, true);

    kapsayici.querySelectorAll(".tl-kart").forEach(function(el){
      el.onclick = function(){
        var i = parseInt(this.getAttribute("data-i"), 10);
        var k = liste[i];
        localStorage.setItem("weiconv2_goruntulenen_belge", JSON.stringify({tip:k.tip, ts:k.ts}));
        window.location.href = "belge-onizleme.html";
      };
    });
  }catch(e){ hataGoster("İşlemler çizilemedi: " + e.message); }
}

function islemlerExcelAktar(){
  try{
    if(typeof XLSX === "undefined"){
      hataGoster("Excel kütüphanesi yüklenemedi, internet bağlantınızı kontrol edin.");
      return;
    }
    var q = (document.getElementById("islemAra").value||"").trim().toLocaleLowerCase("tr-TR");
    var tipFiltre = document.getElementById("islemTipFiltre").value;
    var liste = ReportsData.sonIslemler();
    if(tipFiltre) liste = liste.filter(function(k){ return k.tip === tipFiltre; });
    if(q) liste = liste.filter(function(k){ return (k.musteri||"").toLocaleLowerCase("tr-TR").indexOf(q) >= 0; });

    if(liste.length === 0){
      alert("Aktarılacak kayıt bulunamadı.");
      return;
    }

    var basliklar = ["Tarih","Müşteri","Şehir","Tür","Ürün Sayısı","Toplam (EUR)","Durum"];
    var veriSatirlari = liste.map(function(k){
      var toplam = (k.urunler||[]).reduce(function(s,u){ return s+(u.toplamEuro||0); }, 0);
      var durum = k.durum === "kacan" ? "Kaçtı" : "";
      return [k.tarih||"", k.musteri||"", k.sehir||"", TIP_ETIKET[k.tip]||k.tip, (k.urunler||[]).length, toplam, durum];
    });

    var aoa = [basliklar].concat(veriSatirlari);
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{wch:18},{wch:22},{wch:16},{wch:10},{wch:10},{wch:12},{wch:10}];

    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Son İşlemler");
    var now = new Date();
    var dosyaAdi = "Son_Islemler_" + now.getFullYear() + String(now.getMonth()+1).padStart(2,"0") + String(now.getDate()).padStart(2,"0") + ".xlsx";
    XLSX.writeFile(wb, dosyaAdi);
  }catch(e){ hataGoster("Excel oluşturulamadı: " + e.message); }
}

window.addEventListener("error", function(ev){
  hataGoster("HATA: " + ev.message + " (" + (ev.filename||"").split("/").pop() + ":" + ev.lineno + ")");
});

document.addEventListener("DOMContentLoaded", function(){
  tarihiGuncelle();
  var btnMenuEl = document.getElementById("btnMenu");
  if(btnMenuEl) btnMenuEl.onclick = function(){ window.location.href = "menu.html"; };
  document.getElementById("islemAra").addEventListener("input", islemleriCiz);
  document.getElementById("islemTipFiltre").addEventListener("change", islemleriCiz);
  ReportsData.arsivDegistiginde(islemleriCiz);
  islemleriCiz();
});
