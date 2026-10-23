/*
  marka-karsilastirma-render.js
  ==============================
  "Marka Karşılaştırma" sayfasının TEK görevi: sabit JSON dosyasını
  (marka-karsilastirma-23102026.json) yükleyip arama kutusuna yazılan
  rakip marka/model/ürün kodunu, tablodaki TÜM marka hücreleriyle
  karşılaştırmak ve eşleşen WEICON ürününü göstermek.

  VERİ KAYNAĞI: tek seferlik statik JSON (23.10.2026, Abdullah'ın elindeki
  Excel karşılaştırma tablosundan aktarıldı — bkz. Abdullah'ın isteğiyle
  "şimdilik tek seferlik aktarım yeterli" kararı). Firebase KULLANILMIYOR —
  bu veri sık değişmeyecek, product-data.js'teki "yedek katalog JSON"
  deseniyle AYNI şekilde sadece fetch() ile okunuyor.

  VERİ YAPISI (bkz. parse betiği): { markalar: [...13 marka adı...],
  veri: [ { weicon: "Plastik-Stahl A", karsilikYok: false,
            markalar: { "Loctite": "Hysol 3472*", ... } }, ... ] }
  "karsilikYok:true" olan satırlar, Excel'deki "NICHT VERFÜGBAR" bölümünden
  gelir — bu satırlarda "weicon" alanı GERÇEK bir WEICON ürün adı DEĞİL,
  rakip ürünün genel özelliğinin açıklamasıdır (bkz. mkSonucKartiHtml).
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

function htmlEsc(s){
  return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
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

var MK_VERI_DOSYASI = "marka-karsilastirma-23102026.json";
var mkVeri = { markalar: [], veri: [] };
var mkYuklendi = false;
var mkYuklemeHatasi = false;

// DİKKAT: Burada BİLEREK normal toLowerCase() kullanılıyor, projenin diğer
// yerlerindeki toLocaleLowerCase("tr-TR") DEĞİL. Bu tablonun verisi
// tamamen rakip marka/model kodlarından (Almanca/İngilizce) oluşuyor;
// tr-TR kuralı büyük "I"yı noktasız "ı"ya çevirdiği için (örn. "OMNIPLUS"
// -> "omnıplus"), veride geçen küçük harfli "i" (örn. "omniPLUS") ile
// eşleşmeyi KAÇIRIYORDU. Test sırasında bulunup düzeltildi (23.10.2026).
function mkNormallestir(s){
  return String(s==null?"":s).trim().toLowerCase();
}

function mkVeriYukle(){
  fetch(MK_VERI_DOSYASI, { cache: "no-cache" })
    .then(function(r){ if(!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function(data){
      mkVeri = (data && Array.isArray(data.veri)) ? data : { markalar: [], veri: [] };
      mkYuklendi = true;
      mkSonuclariCiz();
    })
    .catch(function(e){
      mkYuklemeHatasi = true;
      hataGoster("Karşılaştırma verisi yüklenemedi: " + e.message);
      mkSonuclariCiz();
    });
}

// Sorguyu bir satırın TÜM marka hücreleriyle karşılaştırır — hangi
// marka(lar) eşleşti, bir listede döner (bir satırda birden fazla marka
// aynı sorguyla eşleşebilir, nadir ama mümkün).
function mkSatirEslesmeleri(satir, qNormal){
  var eslesmeler = [];
  Object.keys(satir.markalar).forEach(function(marka){
    if(mkNormallestir(satir.markalar[marka]).indexOf(qNormal) >= 0){
      eslesmeler.push({ marka: marka, metin: satir.markalar[marka] });
    }
  });
  return eslesmeler;
}

function mkAra(sorgu){
  var q = mkNormallestir(sorgu);
  if(!q) return [];
  var sonuclar = [];
  mkVeri.veri.forEach(function(satir){
    var eslesmeler = mkSatirEslesmeleri(satir, q);
    if(eslesmeler.length) sonuclar.push({ satir: satir, eslesmeler: eslesmeler });
  });
  return sonuclar;
}

function mkSonucKartiHtml(sonuc){
  var satir = sonuc.satir;
  var eslesmeYazisi = sonuc.eslesmeler.map(function(e){
    return "✓ Eşleşme: " + htmlEsc(e.marka) + " → \"" + htmlEsc(e.metin) + "\"";
  }).join("<br>");

  if(satir.karsilikYok){
    return '<div class="mk-karsilikyok-karti">'
      + '<div class="mk-karsilikyok-uyari">⚠️ Doğrudan WEICON karşılığı yok</div>'
      + '<div class="mk-karsilikyok-aciklama">' + eslesmeYazisi.replace(/✓ Eşleşme: /g, "Eşleşme: ") + ' (' + htmlEsc(satir.weicon) + ')</div>'
      + '</div>';
  }

  var digerMarkalar = Object.keys(satir.markalar).map(function(marka){
    return '<div class="mk-marka-satir"><span class="mk-marka-adi">' + htmlEsc(marka) + '</span><span class="mk-marka-kod">' + htmlEsc(satir.markalar[marka]) + '</span></div>';
  }).join("");

  return '<div class="mk-sonuc-karti">'
    + '<div class="mk-weicon-etiket">WEICON KARŞILIĞI</div>'
    + '<div class="mk-weicon-adi">' + htmlEsc(satir.weicon) + '</div>'
    + '<div class="mk-eslesen-satir">' + eslesmeYazisi + '</div>'
    + '<div class="mk-marka-listesi">' + digerMarkalar + '</div>'
    + '</div>';
}

function mkSonuclariCiz(){
  try{
    var kutu = document.getElementById("searchInput");
    var liste = document.getElementById("mkSonucListesi");
    var bosDurum = document.getElementById("mkBosDurum");
    var bosSonuc = document.getElementById("mkBosSonuc");
    var sayacEl = document.getElementById("mkSonucSayisi");
    if(!kutu || !liste) return;

    var q = kutu.value;

    if(mkYuklemeHatasi){
      liste.innerHTML = "";
      bosDurum.hidden = true;
      bosSonuc.hidden = true;
      return;
    }

    if(!mkYuklendi){
      liste.innerHTML = "";
      bosDurum.hidden = true;
      bosSonuc.hidden = true;
      return;
    }

    if(q.trim().length === 0){
      liste.innerHTML = "";
      sayacEl.hidden = true;
      bosSonuc.hidden = true;
      bosDurum.hidden = false;
      return;
    }
    bosDurum.hidden = true;

    var sonuclar = mkAra(q);
    if(sonuclar.length === 0){
      liste.innerHTML = "";
      sayacEl.hidden = true;
      bosSonuc.hidden = false;
      return;
    }
    bosSonuc.hidden = true;
    sayacEl.hidden = false;
    sayacEl.textContent = sonuclar.length + " sonuç bulundu";
    liste.innerHTML = sonuclar.map(mkSonucKartiHtml).join("");
  }catch(e){ hataGoster("Karşılaştırma sonuçları çizilemedi: " + e.message); }
}

document.addEventListener("DOMContentLoaded", function(){
  try{
    tarihiGuncelle();
    mkVeriYukle();
    document.getElementById("searchInput").addEventListener("input", mkSonuclariCiz);
  }catch(e){ hataGoster("Sayfa başlatılamadı: " + e.message); }
});
