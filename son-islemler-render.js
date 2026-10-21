/*
  son-islemler-render.js — WG.211026.2235.917
  =======================
  reports-render.js'deki islemleriCiz/islemlerExcelAktar buradan taşındı.
  13.10.2026: kartlı/2 satırlı yapı kaldırıldı — GERÇEK TEK SATIRLIK TABLO
  (CSS Grid). 14.10.2026 (Abdullah'ın isteğiyle, v4 — onaylandı): tarih
  sütunu satırdan TAMAMEN kaldırıldı, yerine diğer listelerdeki
  (Satışlarım/Kaçan Satışlar/Ay Detayı) gibi günlük gruplama geri geldi —
  her tarih kümesi için kutusuz bir "sr-grup-baslik" (tarih + günlük
  toplam) satırı. Tarihin boşalttığı genişlik Firma'ya geçti. Rota zinciri
  satırda gösterilmiyor ama kaybolmadı — Belge Geçmişi
  (belge-onizleme.html) detayında aynen duruyor.
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
// MOCKUP (14.10.2026, Abdullah'ın isteğiyle): tarih sütunu satırdan kalktı,
// yerine diğer listelerdeki (Satışlarım/Kaçan Satışlar/Ay Detayı) gibi her
// tarih kümesi için üstte renkli bir "Tarih" başlık satırı geldi — sadece
// MOCKUP, henüz üretime alınmadı.
function gunAnahtari(ts){
  var d = new Date(ts);
  return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
}
function gunBasligi(ts){
  var d = new Date(ts);
  var gg = String(d.getDate()).padStart(2,"0");
  var aa = String(d.getMonth()+1).padStart(2,"0");
  return gg + "." + aa + "." + d.getFullYear() + " • " + GUNLER_UZUN[d.getDay()];
}
// Belge kodunun BAŞ HARFLERİ (SP/FT/PF/NM) işlem türünün kendi renginde;
// numara kısmı normal renkte kalır (WG.210926.1709.589'dan değişmedi).
var HARF_RENK = {siparis:"#003a70", teklif:"#28a745", proforma:"#e8690a", numune:"#c2185b"};
function kodHTML(kod, tip){
  kod = String(kod == null ? "" : kod);
  var i = kod.indexOf(".");
  var harf = i > 0 ? kod.slice(0, i) : kod;
  var kalan = i > 0 ? kod.slice(i) : "";
  return "<span style='color:" + (HARF_RENK[tip] || HARF_RENK.siparis) + ";'>" + htmlEsc(harf) + "</span>" + htmlEsc(kalan);
}
// ROTA ZİNCİRİ (kayıt .rota alanı): tablo SATIRINDA artık gösterilmiyor —
// referans tasarımın "Belge" sütunu tek bir kod gösteriyor (örn. SP0003).
// Zincirin TAMAMI hâlâ kayboLMADI: satıra dokunulduğunda açılan Belge
// Geçmişi (belge-onizleme.html) ekranında aynen gösterilmeye devam ediyor.
function islemRozetMeta(k){
  var kacanMi = k.durum === "kacan";
  var revizeMi = !!k.revizeZamani;
  var meta = TIP_META[k.tip] || TIP_META.siparis;
  return kacanMi ? KACAN_META : (revizeMi ? RVZ_META : meta);
}
// BAKİYE (07.10.2026) — kayıt satislarListele/tumKacanlar'dan geldiyse
// hazır "bakiyeVarMi" bayrağını, sonIslemler()'den ham geldiyse urunler
// dizisini kontrol eder (bkz. reports-data.js).
function bakiyeKayitVarMi(k){
  return !!k.bakiyeVarMi || (k.urunler||[]).some(function(u){ return (u.bakiyeAdet||0)>0; });
}
function islemTutarDurumHTML(k){
  if(k.durum === "beklemede") return "<span class='sr-durum-ek sr-durum-ek--beklemede'>⏳ Beklemede</span>";
  if(bakiyeKayitVarMi(k)) return "<span class='sr-durum-ek sr-durum-ek--bakiye'>📦 Bekleyen</span>";
  // Referans talimatı: "İşlem tutarı bulunmayan satırlara tutar uydurma."
  return k._tutar > 0 ? fmt(k._tutar) + " €" : "<span class='sr-tutar-yok'>—</span>";
}
function islemSatiriHTML(k){
  var rozetMeta = islemRozetMeta(k);
  var beklemedeMi = k.durum === "beklemede";
  return "<div class='sr-satir" + (beklemedeMi ? " sr-satir--beklemede" : "") + "' data-i='" + k._i + "' style='border-left-color:" + rozetMeta.serit + ";'>"
    + "<div class='sr-firma-h'>" + htmlEsc(k.musteri||"") + "</div>"
    + "<div class='sr-konum-h'>" + htmlEsc(k.sehir||"") + "</div>"
    + "<span class='sr-rozet-h' style='background:" + rozetMeta.rozetBg + ";color:" + rozetMeta.rozetRenk + ";'>" + rozetMeta.rozet + "</span>"
    + "<div class='sr-belge-h'>" + kanalHarfHTML(k.kanal) + kodHTML(k.kod, k.tip) + "</div>"
    + "<div class='sr-tutar-h'>" + islemTutarDurumHTML(k) + "</div>"
    + "<div class='sr-ok-h'>&#8250;</div>"
    + "</div>";
}
// Diğer listelerle (Satışlarım/Kaçan Satışlar/Ay Detayı) BİREBİR AYNI gruplama
// kalıbı: aynı güne ait kayıtlar bir "sr-grup-baslik" (tarih + günlük toplam)
// altında kutusuz şekilde toplanır.
function tlGrupla(liste){
  var gruplar = [], harita = {};
  liste.forEach(function(k){
    var anahtar = gunAnahtari(k.ts);
    if(!harita[anahtar]){ harita[anahtar] = {ts:k.ts, kayitlar:[]}; gruplar.push(harita[anahtar]); }
    harita[anahtar].kayitlar.push(k);
  });
  return gruplar;
}
function tlListeHTML(gruplar){
  return gruplar.map(function(g){
    var toplamGun = g.kayitlar.reduce(function(s,k){ return s + (k._tutar||0); }, 0);
    var satirlar = g.kayitlar.map(islemSatiriHTML).join("");
    return "<div class='sr-grup-baslik'><span>" + gunBasligi(g.ts) + "</span><span>" + fmt(toplamGun) + " €</span></div>"
      + "<div class='sr-liste-kutu'>" + satirlar + "</div>";
  }).join("");
}

// TARİH FİLTRESİ (21.10.2026, Abdullah onayı) — paylaşılan TarihFiltre
// bileşeni, DOMContentLoaded içinde kurulup buraya atanır.
var tarihFiltreKontrol = null;

function islemleriCiz(){
  try{
    var q = (document.getElementById("islemAra").value||"").trim().toLocaleLowerCase("tr-TR");
    var tipFiltre = document.getElementById("islemTipFiltre").value;

    var liste = ReportsData.sonIslemler();
    if(tipFiltre === "beklemede") liste = liste.filter(function(k){ return k.durum === "beklemede"; });
    else if(tipFiltre) liste = liste.filter(function(k){ return k.tip === tipFiltre; });
    if(q) liste = liste.filter(function(k){ return (k.musteri||"").toLocaleLowerCase("tr-TR").indexOf(q) >= 0; });
    if(tarihFiltreKontrol) liste = liste.filter(function(k){ return tarihFiltreKontrol.icindeMi(k.ts); });
    liste = liste.slice(0, 100);

    var kapsayici = document.getElementById("islemlerListesi");
    var bos = document.getElementById("islemlerBosMesaj");

    if(liste.length === 0){
      kapsayici.innerHTML = "";
      bos.hidden = false;
      return;
    }
    bos.hidden = true;

    liste.forEach(function(k, i){
      k._i = i;
      k._tutar = (k.urunler||[]).reduce(function(s,u){ return s+(u.toplamEuro||0); }, 0);
    });
    var gruplar = tlGrupla(liste);
    kapsayici.innerHTML = tlListeHTML(gruplar);

    kapsayici.querySelectorAll(".sr-satir").forEach(function(el){
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
    if(tipFiltre === "beklemede") liste = liste.filter(function(k){ return k.durum === "beklemede"; });
    else if(tipFiltre) liste = liste.filter(function(k){ return k.tip === tipFiltre; });
    if(q) liste = liste.filter(function(k){ return (k.musteri||"").toLocaleLowerCase("tr-TR").indexOf(q) >= 0; });
    if(tarihFiltreKontrol) liste = liste.filter(function(k){ return tarihFiltreKontrol.icindeMi(k.ts); });

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
  tarihFiltreKontrol = TarihFiltre.ekle("tarihFiltreYeri", { varsayilan: "tumu", degisti: islemleriCiz });
  document.getElementById("islemAra").addEventListener("input", islemleriCiz);
  document.getElementById("islemTipFiltre").addEventListener("change", islemleriCiz);
  ReportsData.arsivDegistiginde(islemleriCiz);
  islemleriCiz();
});
