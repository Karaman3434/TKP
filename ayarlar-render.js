// Tek merkezi sürüm bilgisi — home.html içindeki #versiyonEtiketi ile
// senkron tutulmalıdır. Format (01.11.2026'dan itibaren): TKP.GG.AA.YY-SS:DD.(sıra no)
var APP_VERSION = "TKP.01.11.26-18:55.1337";

var AY_ADLARI_AYARLAR = ["","Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

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

function ayarlariDoldur(){
  try{
    var kur = parseFloat(localStorage.getItem("weicon_kur"));
    var kdv = parseFloat(localStorage.getItem("weicon_kdv_orani"));
    var hedef = parseFloat(localStorage.getItem("weicon_hedef"));
    document.getElementById("kurInput").value = isNaN(kur) ? "" : kur;
    document.getElementById("kdvInput").value = isNaN(kdv) ? 20 : kdv;
    var hedefEl = document.getElementById("hedefInput");
    if(hedefEl) hedefEl.value = isNaN(hedef) ? "" : hedef;
    sonGuncellemeYazisiniGoster();
    ayOzetleriGuncelle();
  }catch(e){ hataGoster("Ayarlar okunamadı: " + e.message); }
}

// "Her ayar kendi kutusu" nav-listesindeki satırlarda (02.10.2026) mevcut
// değerin kısa özetini gösterir — kullanıcı sheet'i açmadan değeri görsün.
function ayOzetleriGuncelle(){
  try{
    var kur = parseFloat(document.getElementById("kurInput").value);
    var kdv = parseFloat(document.getElementById("kdvInput").value);
    var hedefEl = document.getElementById("hedefInput");
    var hedef = hedefEl ? parseFloat(hedefEl.value) : NaN;

    var kurOzetEl = document.getElementById("ayKurOzet");
    if(kurOzetEl) kurOzetEl.textContent = isNaN(kur) || !kur
      ? "Henüz girilmedi"
      : kur.toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:4}) + " ₺";

    var kdvOzetEl = document.getElementById("ayKdvOzet");
    if(kdvOzetEl) kdvOzetEl.textContent = isNaN(kdv) ? "%20" : ("%" + kdv);

    var hedefOzetEl = document.getElementById("ayHedefOzet");
    if(hedefOzetEl) hedefOzetEl.textContent = (isNaN(hedef) || !hedef)
      ? "Girilmedi"
      : hedef.toLocaleString("tr-TR",{minimumFractionDigits:2}) + " EUR";
  }catch(e){}
}

// "Her ayar kendi kutusu" açılır pencereleri (02.10.2026) — genel aç/kapat
// yardımcıları, bkz. ayarlar.html'deki .overlay/.sheet yapısı.
function ayarSheetAc(id){ var el = document.getElementById(id); if(el) el.hidden = false; }
function ayarSheetKapat(id){ var el = document.getElementById(id); if(el) el.hidden = true; }

function sonGuncellemeYazisiniGoster(){
  var el = document.getElementById("kurSonGuncelleme");
  if(!el) return;
  var zaman = parseFloat(localStorage.getItem("weicon_kur_zaman"));
  if(isNaN(zaman) || zaman<=0){
    el.textContent = "Son otomatik güncelleme: hiç yapılmadı";
    return;
  }
  var farkDk = Math.round((Date.now() - zaman) / 60000);
  var metin;
  if(farkDk < 1) metin = "az önce";
  else if(farkDk < 60) metin = farkDk + " dakika önce";
  else metin = Math.floor(farkDk/60) + " saat " + (farkDk%60) + " dakika önce";
  el.textContent = "Son güncelleme: " + metin;
}

function ayarlariKaydet(){
  try{
    var kur = parseFloat(document.getElementById("kurInput").value) || 0;
    var kdv = parseFloat(document.getElementById("kdvInput").value) || 20;
    var hedefEl = document.getElementById("hedefInput");
    var hedef = hedefEl ? (parseFloat(hedefEl.value) || 0) : 0;
    if(typeof AyarlarSync !== "undefined"){
      // 09.10.2026, kod incelemesi sonrası: kur yazması artık Firebase
      // sonucunu bekleyip başarısızsa ayrıca uyarıyor (localStorage'a yazma
      // zaten anında/optimistik, akışı kesmiyoruz).
      AyarlarSync.kurKaydet(kur, "elle", function(basarili){
        if(!basarili) hataGoster("⚠️ Kur bu cihazda kaydedildi ama merkez sunucuya yazılamadı — diğer cihazlar henüz görmeyebilir.");
      });
      AyarlarSync.kdvKaydet(kdv);
      if(typeof AyarlarSync.hedefKaydet === "function") AyarlarSync.hedefKaydet(hedef);
    } else {
      localStorage.setItem("weicon_kur", kur);
      localStorage.setItem("weicon_kur_zaman", Date.now());
      localStorage.setItem("weicon_kdv_orani", kdv);
      localStorage.setItem("weicon_hedef", hedef);
    }
    ayOzetleriGuncelle();
    alert("✓ Ayarlar kaydedildi.");
  }catch(e){ hataGoster("Ayarlar kaydedilemedi: " + e.message); }
}

window.addEventListener("error", function(ev){
  hataGoster("HATA: " + ev.message + " (" + (ev.filename||"").split("/").pop() + ":" + ev.lineno + ")");
});

document.addEventListener("DOMContentLoaded", function(){
  tarihiGuncelle();
  ayarlariDoldur();
  var btnMenuEl = document.getElementById("btnMenu");
  if(btnMenuEl) btnMenuEl.onclick = function(){ window.location.href = "menu.html"; };

  // "Her ayar kendi kutusu" nav-liste satırları -> ilgili sheet'i açar.
  [
    ["ayNavKur", "ayKurSheetOverlay"],
    ["ayNavKdv", "ayKdvSheetOverlay"],
    ["ayNavHedef", "ayHedefSheetOverlay"]
  ].forEach(function(pair){
    var btn = document.getElementById(pair[0]);
    if(btn) btn.onclick = function(){ ayarSheetAc(pair[1]); };
  });

  // data-sheet-kapat taşıyan her "Kapat" butonu kendi overlay'ini kapatır.
  document.querySelectorAll("[data-sheet-kapat]").forEach(function(btn){
    btn.onclick = function(){ ayarSheetKapat(this.getAttribute("data-sheet-kapat")); };
  });

  // Kur/KDV/Hedef sheet'lerindeki "✓ Kaydet" butonları -> hepsi aynı
  // ayarlariKaydet()'i çağırır (eskisi gibi üçü birlikte kaydedilir),
  // sonra sadece kendi sheet'ini kapatır.
  document.querySelectorAll(".ay-sheet-kaydet-btn").forEach(function(btn){
    btn.onclick = function(){
      ayarlariKaydet();
      var overlay = btn.closest(".overlay");
      if(overlay) overlay.hidden = true;
    };
  });
  document.getElementById("btnKurSimdiDene").onclick = function(){
    var btn = this;
    btn.disabled = true;
    btn.textContent = "⏳ Deneniyor...";
    if(typeof AyarlarSync === "undefined"){
      btn.disabled = false; btn.textContent = "🔄 Şimdi Dene (Otomatik Çek)";
      hataGoster("Kur senkron modülü yüklenemedi.");
      return;
    }
    AyarlarSync.otomatikKurGetir(true, function(basarili, kur, kaynak){
      btn.disabled = false;
      if(basarili){
        var kaynakAdi = kaynak==="tcmb" ? "TCMB" : (kaynak==="yedek" ? "yedek kaynak" : "Frankfurter");
        btn.textContent = "✓ Başarılı — " + kur.toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:4}) + " (" + kaynakAdi + ")";
        ayarlariDoldur();
      } else {
        btn.textContent = "✕ Başarısız — internet bağlantısını kontrol et";
      }
      setTimeout(function(){ btn.textContent = "🔄 Şimdi Dene (Otomatik Çek)"; }, 3000);
    });
  };
  if(typeof AyarlarSync !== "undefined") AyarlarSync.degistiginde(ayarlariDoldur);
  var surumEl = document.getElementById("surumBilgisi");
  if(surumEl) surumEl.textContent = "Sürüm " + APP_VERSION;
});
