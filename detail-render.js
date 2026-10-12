/*
  detail-render.js — WG.091026.0955.752
  ================
  Seçili müşterinin bilgilerini, sipariş geçmişini (ReportsData.sonIslemler
  üzerinden filtrelenmiş) ve ziyaret geçmişini gösterir.
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

var TIP_ETIKET = {numune:"Numune", teklif:"Teklif", proforma:"Proforma", siparis:"Sipariş"};

function fmtG(n){
  return (n||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2});
}
var seciliMusteriAdi = null;
var seciliMusteriId = null;

function ustBilgiyiCiz(musteri){
  MusteriSeridi.uygula("detayMusteriSeridi", musteri);

  var ziyaretSayisi = (musteri.ziyaretGecmisi||[]).length;
  document.getElementById("badgeZiyaret").textContent = ziyaretSayisi;
  document.getElementById("temasAlt").textContent = ziyaretSayisi>0 ? (ziyaretSayisi + " kayıtlı temas") : "Henüz temas kaydı yok";
}

function ayniMusteriKaydiMi(kayitMusteriAdi, kayitMusteriId, seciliAd, seciliId){
  // Sadece isim birebir eşleşmesi YETERSİZ — müşteri ismi sonradan
  // düzenlenmiş (kısaltılmış/uzatılmış) olabilir, o zaman eski kayıtlar
  // görünmez olur. Önce Müşteri Kodu (ID) ile, o yoksa isimle, o da tam
  // eşleşmezse "biri diğerinin içinde geçiyor mu" kontrolüyle eşleştir.
  if(seciliId && kayitMusteriId) return kayitMusteriId === seciliId;
  var a = (kayitMusteriAdi||"").toLocaleLowerCase("tr-TR").trim();
  var b = (seciliAd||"").toLocaleLowerCase("tr-TR").trim();
  if(!a || !b) return false;
  if(a === b) return true;
  return a.indexOf(b) === 0 || b.indexOf(a) === 0;
}

// Tam liste artık ayrı bir sayfada (bkz. gecmis.html / gecmis-render.js —
// rota, filtre çipleri, en yeniden en eskiye sıralı renkli kartlar).
// Burada sadece "İşlem Geçmişi" kutucuğundaki sayaç/alt metin güncellenir.
function siparisGecmisiniCiz(){
  try{
    var seciliMusteri = CustomerData.musteriBul(seciliMusteriAdi);
    var seciliId = seciliMusteri ? seciliMusteri.id : null;
    var tumu = ReportsData.sonIslemler();
    var bunaAit = tumu.filter(function(k){ return ayniMusteriKaydiMi(k.musteri, k.musteriId, seciliMusteriAdi, seciliId); });

    document.getElementById("badgeGecmis").textContent = bunaAit.length;
    document.getElementById("gecmisAlt").textContent = bunaAit.length>0 ? (bunaAit.length + " kayıtlı işlem") : "Henüz kayıt yok";
  }catch(e){ hataGoster("Sipariş geçmişi sayacı güncellenemedi: " + e.message); }
}



function tilelariBagla(){
  document.getElementById("tileTemas").onclick = function(){
    window.location.href = "customer-temas.html";
  };

  document.getElementById("tileGecmis").onclick = function(){
    window.location.href = "gecmis.html";
  };
  document.getElementById("tileGorevler").onclick = function(){
    var bolum = document.getElementById("bolumGorevler");
    bolum.hidden = !bolum.hidden;
    if(!bolum.hidden) bolum.scrollIntoView({behavior:"smooth", block:"start"});
  };
  // "İşlem Yap" kutucuğu — artık doğrudan ürün aramaya gitmiyor, önce
  // Cari Kart'a gidip vade/fatura/kargo/adres/yetkili bilgilerini gözden
  // geçirme fırsatı veriyor. Cari Kart'ta "İşleme Devam Et" tuşu (sadece bu
  // akıştan gelindiyse görünür) tıklanınca belge türü seçimi açılır.
  document.getElementById("tileUrunBul").onclick = function(){
    CustomerData.sec(CustomerData.musteriBul(seciliMusteriAdi) || {ad:seciliMusteriAdi});
    localStorage.setItem("weiconv2_islem_yap_akisi", "1");
    window.location.href = "customer-cari-kart.html";
  };

  document.getElementById("tileUrunGecmisi").onclick = urunGecmisiniAc;
  document.getElementById("btnUrunGecmisiKapat").onclick = function(){ document.getElementById("urunGecmisiOverlay").hidden = true; };
  document.getElementById("btnUrunGecmisiGeri").onclick = function(){
    document.getElementById("urunGecmisiDetay").hidden = true;
    document.getElementById("urunGecmisiListesi").hidden = false;
    document.getElementById("urunGecmisiBaslik").textContent = "📦 Ürün Geçmişi";
  };

  document.getElementById("tileFaturaTakip").onclick = function(){
    document.getElementById("faturaTakipOverlay").hidden = false;
    faturaTakipCiz();
  };
  document.getElementById("btnFaturaTakipKapat").onclick = function(){ document.getElementById("faturaTakipOverlay").hidden = true; };
  if(typeof VadeTakipUI !== "undefined"){
    VadeTakipUI.baglaRozetler(document.getElementById("ftListe"), faturaTakipCiz);
  }
}

// FATURA · VADE · ÖDEME TAKİBİ — bu müşterinin tüm siparişleri, en yeni
// üstte, ortak 2 satırlı satır görünümüyle (vade-takip-ui.js). Kutucuktaki
// rozet/alt metni de burada güncellenir.
function faturaTakipOzetiGuncelle(){
  try{
    if(typeof VadeTakip === "undefined") return;
    var musteri = CustomerData.musteriBul(seciliMusteriAdi);
    if(!musteri) return;
    var ogeler = VadeTakip.musteriIcin(musteri.id, musteri.ad);
    var acikTakipte = ogeler.filter(function(o){ return o.durum !== "vadesiz" && !o.odendi; });
    var gecti = acikTakipte.filter(function(o){ return o.durum === "gecti"; });
    var altEl = document.getElementById("faturaTakipAlt");
    var badgeEl = document.getElementById("badgeFaturaTakip");
    if(gecti.length > 0){
      altEl.textContent = "⚠ " + gecti.length + " fatura vadesi geçti";
      badgeEl.hidden = false; badgeEl.textContent = gecti.length;
    } else if(acikTakipte.length > 0){
      altEl.textContent = acikTakipte.length + " fatura takipte";
      badgeEl.hidden = false; badgeEl.textContent = acikTakipte.length;
    } else {
      altEl.textContent = ogeler.length > 0 ? (ogeler.length + " kayıtlı sipariş") : "Henüz sipariş yok";
      badgeEl.hidden = true;
    }
  }catch(e){ hataGoster("Fatura Takip özeti güncellenemedi: " + e.message); }
}

function ftVadeRozetiniGuncelle(musteri){
  var rozet = document.getElementById("ftVadeRozet");
  var gun = (musteri && typeof VadeTakip !== "undefined") ? VadeTakip.vadeGunSayisi(musteri) : null;
  if(gun === null){ rozet.hidden = true; return; }
  document.getElementById("ftVadeDeger").textContent = gun + " gün";
  rozet.hidden = false;
}

function faturaTakipCiz(){
  try{
    if(typeof VadeTakip === "undefined" || typeof VadeTakipUI === "undefined") return;
    var musteri = CustomerData.musteriBul(seciliMusteriAdi);
    var kok = document.getElementById("ftListe");
    var bosEl = document.getElementById("ftBos");
    var bakiyeEl = document.getElementById("ftBakiye");
    ftVadeRozetiniGuncelle(musteri);
    if(!musteri){ kok.innerHTML = ""; bosEl.hidden = false; bakiyeEl.hidden = true; return; }

    var ogeler = VadeTakip.musteriIcin(musteri.id, musteri.ad);
    if(!ogeler.length){
      kok.innerHTML = "";
      bosEl.hidden = false;
      bakiyeEl.hidden = true;
      faturaTakipOzetiGuncelle();
      return;
    }
    bosEl.hidden = true;

    var gecmisBakiye = VadeTakip.musteriGecmisBakiye(musteri.id, musteri.ad);
    if(gecmisBakiye > 0){
      bakiyeEl.hidden = false;
      bakiyeEl.querySelector(".vt-b-deger").textContent = gecmisBakiye.toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}) + " EURO";
    } else {
      bakiyeEl.hidden = true;
    }

    kok.innerHTML = ogeler.map(function(o){ return VadeTakipUI.satirHTML(o, {gosterMusteri:false}); }).join("");
    faturaTakipOzetiGuncelle();
  }catch(e){ hataGoster("Fatura Takip listesi çizilemedi: " + e.message); }
}

function urunGecmisiniAc(){
  try{
    if(typeof ReportsData === "undefined" || typeof ReportsData.musteriUrunGecmisi !== "function"){
      hataGoster("Ürün geçmişi şu an yüklenemedi.");
      return;
    }
    var musteri = CustomerData.musteriBul(seciliMusteriAdi);
    var gruplar = ReportsData.musteriUrunGecmisi(seciliMusteriAdi, musteri ? musteri.id : null);
    var listesiEl = document.getElementById("urunGecmisiListesi");
    var detayEl = document.getElementById("urunGecmisiDetay");
    var baslikEl = document.getElementById("urunGecmisiBaslik");

    detayEl.hidden = true;
    listesiEl.hidden = false;
    baslikEl.textContent = "📦 Ürün Geçmişi";
    document.getElementById("badgeUrunGecmisi").textContent = gruplar.length;

    if(gruplar.length === 0){
      listesiEl.innerHTML = "<p style='text-align:center;color:#44494f;padding:16px 0;'>Bu müşteriye henüz sipariş/teklif olarak girilmiş bir ürün yok.</p>";
    } else {
      listesiEl.innerHTML = gruplar.map(function(g, i){
        return "<div class='satir-tiklanabilir' data-urun-i='" + i + "' style='background:#f4f7fb;border-radius:8px;padding:10px 12px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;'>"
          + "<span style='font-size:12px;font-weight:800;color:#111;'>" + htmlEsc(g.ad) + "</span>"
          + "<span style='font-size:10px;color:#8e44ad;font-weight:800;'>" + g.kayitlar.length + " kez ›</span>"
          + "</div>";
      }).join("");
      listesiEl.querySelectorAll("[data-urun-i]").forEach(function(el){
        el.onclick = function(){
          var g = gruplar[parseInt(this.getAttribute("data-urun-i"),10)];
          baslikEl.textContent = "📦 " + g.ad;
          document.getElementById("urunGecmisiTabloGovde").innerHTML = g.kayitlar.map(function(k){
            var tipEtiket = TIP_ETIKET[k.tip] || "";
            return "<tr>"
              + "<td>" + htmlEsc((k.tarih||"").split(" ").slice(0,2).join(" ")) + (tipEtiket ? " <span style='color:#8e44ad;font-weight:700;'>(" + tipEtiket + ")</span>" : "") + "</td>"
              + "<td>" + (k.adet||0) + "</td>"
              + "<td>" + fmtG(k.listeFiyat) + " EURO</td>"
              + "<td><span class='rozet-isk'>%" + k.iskonto + "</span></td>"
              + "<td><span class='rozet-net'>" + fmtG(k.netFiyat) + " EURO</span></td>"
              + "</tr>";
          }).join("");
          listesiEl.hidden = true;
          detayEl.hidden = false;
        };
      });
    }
    document.getElementById("urunGecmisiOverlay").hidden = false;
  }catch(e){ hataGoster("Ürün geçmişi açılamadı: " + e.message); }
}

function musteriGorevleriniCiz(){
  try{
    var tumu = ReportsData.gorevleriGetir();
    var bunaAit = tumu.filter(function(g){
      return (g.musteriAd||"").toLocaleLowerCase("tr-TR").indexOf((seciliMusteriAdi||"").toLocaleLowerCase("tr-TR")) >= 0;
    });
    document.getElementById("badgeGorevler").textContent = bunaAit.length;
    document.getElementById("gorevlerAlt").textContent = bunaAit.length>0 ? (bunaAit.length + " görev") : "Görev yok";

    var kapsayici = document.getElementById("detayGorevListesi");
    var bos = document.getElementById("detayGorevBos");
    if(bunaAit.length === 0){
      kapsayici.innerHTML = "";
      bos.hidden = false;
      return;
    }
    bos.hidden = true;
    kapsayici.innerHTML = bunaAit.map(function(g){
      return "<div class='gorev-karti" + (g.tamamlandi?" tamamlandi":"") + "'>"
        + "<div class='gorev-bilgi'>"
        + "<div class='gorev-aciklama'>" + htmlEsc(g.aciklama) + "</div>"
        + "<div class='gorev-zaman'>" + htmlEsc(g.tarih||"") + " " + htmlEsc(g.saat||"") + "</div>"
        + "</div>"
        + "</div>";
    }).join("");
  }catch(e){ hataGoster("Görevler çizilemedi: " + e.message); }
}

window.addEventListener("error", function(ev){
  hataGoster("HATA: " + ev.message + " (" + (ev.filename||"").split("/").pop() + ":" + ev.lineno + ")");
});

document.addEventListener("DOMContentLoaded", function(){
  tarihiGuncelle();
  tilelariBagla();
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
  ustBilgiyiCiz(secili);

  CustomerData.listeDegistiginde(function(){
    var tazeMusteri = CustomerData.musteriBul(seciliMusteriAdi);
    if(tazeMusteri){
      ustBilgiyiCiz(tazeMusteri);
      faturaTakipOzetiGuncelle();
    }
  });
  ReportsData.arsivDegistiginde(siparisGecmisiniCiz);
  ReportsData.gorevDegistiginde(musteriGorevleriniCiz);
  siparisGecmisiniCiz();
  musteriGorevleriniCiz();
  ReportsData.arsivDegistiginde(faturaTakipOzetiGuncelle);
  faturaTakipOzetiGuncelle();
  // HATA DÜZELTME (09.10.2026, Abdullah'ın isteğiyle) — "Ürün Geçmişi"
  // paneli SADECE tıklanma anındaki arşiv verisiyle bir kerelik çiziliyordu.
  // Sayfa "?ac=urun" ile otomatik açıldığında (ya da kullanıcı panele erken
  // dokunduğunda) Firebase'den arşiv verisi henüz gelmemiş olabiliyor —
  // panel "henüz satılmış ürün yok" yazıp kalıyordu, veri birazdan gelse
  // bile kendini hiç yenilemiyordu (diğer panellerin hepsinde bu dinleyici
  // zaten vardı, sadece burada unutulmuştu). Panel açıkken ve kullanıcı bir
  // ürünün detayına girmemişken (liste görünümündeyken) arşiv güncellenince
  // otomatik tazeleniyor.
  ReportsData.arsivDegistiginde(function(){
    try{
      var overlay = document.getElementById("urunGecmisiOverlay");
      var detayEl = document.getElementById("urunGecmisiDetay");
      if(overlay && !overlay.hidden && detayEl && detayEl.hidden) urunGecmisiniAc();
    }catch(e){}
  });
  // Firebase müşteri listesi sayfa tam yüklenmeden önce gelmiş olabilir —
  // dinleyici bu ilk anlık görüntüyü kaçırmış olabilir. Zaten yüklenmişse
  // hemen taze veriyle güncelle.
  var tazeMusteriIlk = CustomerData.musteriBul(seciliMusteriAdi);
  if(tazeMusteriIlk) ustBilgiyiCiz(tazeMusteriIlk);

  // OTOMATİK AÇILIŞ (05.10.2026, Abdullah'ın isteğiyle) — Müşteri Bul'daki
  // hızlı pencereden "Fatura Takip"/"Görevlerim"/"Ürün Geçmişi" seçilince
  // buraya "?ac=fatura" / "?ac=gorev" / "?ac=urun" ile geliniyor; sayfa
  // kendi tuşuna tıklanmış gibi davranıp ilgili pencereyi/satırı HEMEN
  // açıyor. Panel/liste verisi yukarıdaki satırlarla zaten hazırlandığı
  // için burada sadece tuşun click'ini tetiklemek yeterli.
  try{
    var acParam = new URLSearchParams(window.location.search).get("ac");
    if(acParam === "fatura"){ document.getElementById("tileFaturaTakip").click(); }
    else if(acParam === "gorev"){ document.getElementById("tileGorevler").click(); }
    else if(acParam === "urun"){ document.getElementById("tileUrunGecmisi").click(); }
  }catch(e){ hataGoster("Otomatik açılış başarısız: " + e.message); }
});
