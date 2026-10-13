// Tek merkezi sürüm bilgisi — home.html içindeki #versiyonEtiketi ile
// senkron tutulmalıdır. Format: WG.(GGAAYY).(SSDD).(sıra no)
var APP_VERSION = "WG.131026.0920.788";

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
    ["ayNavHedef", "ayHedefSheetOverlay"],
    ["ayNavBakim", "ayBakimListeSheetOverlay"]
  ].forEach(function(pair){
    var btn = document.getElementById(pair[0]);
    if(btn) btn.onclick = function(){ ayarSheetAc(pair[1]); };
  });

  // Bakım Araçları listesindeki satırlar -> liste sheet'i kapanır, aracın
  // kendi sheet'i açılır.
  [
    ["ayNavBakimKod", "ayBakimKodSheetOverlay"],
    ["ayNavBakimYazim", "ayBakimYazimSheetOverlay"],
    ["ayNavBakimAvans", "ayBakimAvansSheetOverlay"]
  ].forEach(function(pair){
    var btn = document.getElementById(pair[0]);
    if(btn) btn.onclick = function(){
      ayarSheetKapat("ayBakimListeSheetOverlay");
      ayarSheetAc(pair[1]);
    };
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
  document.getElementById("btnKodlariStandartlastir").onclick = function(){
    var onay = confirm(
      "⚠️ Bu işlem TÜM müşteri kodlarını M-0001, M-0002... şeklinde yeniden numaralandırır ve geçmiş Numune/Teklif/Proforma/Sipariş kayıtlarındaki müşteri bağlantılarını buna göre günceller.\n\n" +
      "Bu işlem GERİ ALINAMAZ. Devam etmek istiyor musun?"
    );
    if(!onay) return;
    if(typeof CustomerData === "undefined"){ hataGoster("Müşteri veri modülü yüklenemedi."); return; }
    var btn = this;
    var sonucEl = document.getElementById("kodStandartSonuc");
    btn.disabled = true;
    btn.textContent = "⏳ Müşteri kodları güncelleniyor...";
    sonucEl.textContent = "";
    CustomerData.idleriStandartlastir(function(basarili, eslesmeVeyaHata){
      if(!basarili){
        btn.disabled = false;
        btn.textContent = "🔧 Müşteri Kodlarını Standartlaştır (M-XXXX)";
        sonucEl.textContent = "❌ Müşteri kodları güncellenemedi: " + (eslesmeVeyaHata && eslesmeVeyaHata.message ? eslesmeVeyaHata.message : eslesmeVeyaHata);
        hataGoster("Müşteri kodu standardizasyonu başarısız: " + (eslesmeVeyaHata && eslesmeVeyaHata.message ? eslesmeVeyaHata.message : eslesmeVeyaHata));
        return;
      }
      var eslesmeSayisi = Object.keys(eslesmeVeyaHata||{}).length;
      btn.textContent = "⏳ Geçmiş kayıtlar güncelleniyor (" + eslesmeSayisi + " kod değişti)...";
      CustomerData.arsivMusteriIdGuncelle(eslesmeVeyaHata, function(basarili2, hata2){
        btn.disabled = false;
        btn.textContent = "🔧 Müşteri Kodlarını Standartlaştır (M-XXXX)";
        if(!basarili2){
          sonucEl.textContent = "⚠️ Müşteri kodları güncellendi ama bazı geçmiş kayıtlar güncellenemedi: " + (hata2 && hata2.message ? hata2.message : hata2);
          hataGoster("Arşiv güncellemesi kısmen başarısız: " + (hata2 && hata2.message ? hata2.message : hata2));
          return;
        }
        sonucEl.textContent = "✓ Tamamlandı — " + eslesmeSayisi + " müşteri kodu M-XXXX formatına çevrildi, geçmiş kayıtlar güncellendi.";
      });
    });
  };
  document.getElementById("btnYaziminiDuzelt").onclick = function(){
    var onay = confirm(
      "⚠️ Bu işlem TÜM müşteri kayıtlarındaki ticari isim, açık adres, fatura/teslimat adresi ve yetkili ismini yeni yazım standardına (ilk harf büyük, devamı küçük — yetkili soyadı hariç) çevirir.\n\n" +
      "Bu işlem GERİ ALINAMAZ. Devam etmek istiyor musun?"
    );
    if(!onay) return;
    if(typeof CustomerData === "undefined"){ hataGoster("Müşteri veri modülü yüklenemedi."); return; }
    var btn = this;
    var sonucEl = document.getElementById("yazimDuzeltSonuc");
    btn.disabled = true;
    btn.textContent = "⏳ Kayıtlar güncelleniyor...";
    sonucEl.textContent = "";
    CustomerData.yaziminiDuzelt(function(basarili, sayacVeyaHata){
      btn.disabled = false;
      btn.textContent = "🔤 İsim/Adres Yazımını Düzelt (İlk Harf Büyük)";
      if(!basarili){
        sonucEl.textContent = "❌ Yazım düzeltilemedi: " + (sayacVeyaHata && sayacVeyaHata.message ? sayacVeyaHata.message : sayacVeyaHata);
        hataGoster("Yazım düzeltme başarısız: " + (sayacVeyaHata && sayacVeyaHata.message ? sayacVeyaHata.message : sayacVeyaHata));
        return;
      }
      sonucEl.textContent = "✓ Tamamlandı — " + sayacVeyaHata + " alan güncellendi.";
    });
  };
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

  // AVANS DÖNEMİ TAŞI (28.09.2026) — bkz. avans-takibi.html/js. Yanlış aya
  // kaydedilmiş bir taslak/kapalı avans kaydını, seçilen hedef aya AÇIK
  // taslak olarak taşır ve kaynaktan siler (hem taslak hem kapalı kaydı).
  function bakimAvansDoluMu(t){
    if(!t) return false;
    return (t.ozelAvansGirisleri||[]).length>0 || (t.isAvansiGirisleri||[]).length>0 || (t.isAvansiHarcamalar||[]).length>0;
  }
  function bakimAvansSeciciDoldur(){
    var sel = document.getElementById("bakimAvansKaynakSecici");
    if(!sel || typeof AvansKayitData === "undefined") return;
    var girdiler = {}; // anahtar -> {ay,yil,taslakVarMi,kapaliVarMi}
    AvansKayitData.tumTaslaklar().forEach(function(t){
      if(!bakimAvansDoluMu(t)) return;
      girdiler[t.anahtar] = girdiler[t.anahtar] || {ay:t.ay, yil:t.yil};
      girdiler[t.anahtar].taslakVarMi = true;
    });
    AvansKayitData.tumKayitlar().forEach(function(k){
      girdiler[k.anahtar] = girdiler[k.anahtar] || {ay:k.ay, yil:k.yil};
      girdiler[k.anahtar].kapaliVarMi = true;
    });
    var anahtarlar = Object.keys(girdiler).sort().reverse();
    var seciliDeger = sel.value;
    sel.innerHTML = "<option value=''>Kaynak dönem seç…</option>" + anahtarlar.map(function(a){
      var g = girdiler[a];
      var etiket = AY_ADLARI_AYARLAR[g.ay] + " " + g.yil + " ("
        + [g.taslakVarMi ? "taslak" : null, g.kapaliVarMi ? "kapalı kayıt" : null].filter(Boolean).join(" + ") + ")";
      return "<option value='" + a + "'>" + etiket + "</option>";
    }).join("");
    sel.value = seciliDeger;
  }
  try{
    if(typeof AvansKayitData !== "undefined") AvansKayitData.degistiginde(bakimAvansSeciciDoldur);
    bakimAvansSeciciDoldur();
  }catch(e){}
  try{
    if(typeof MaasKayitData !== "undefined"){
      MaasKayitData.degistiginde(function(){
        if(!MaasKayitData.kayitlarYuklendiMi()) return;
        var hedefAyEl = document.getElementById("bakimAvansHedefAy");
        var hedefYilEl = document.getElementById("bakimAvansHedefYil");
        if(hedefAyEl && !hedefAyEl.value && hedefYilEl && !hedefYilEl.value){
          var acik = MaasKayitData.acikDonem();
          hedefAyEl.value = acik.ay;
          hedefYilEl.value = acik.yil;
        }
      });
    }
  }catch(e){}

  document.getElementById("btnBakimAvansTasi").onclick = function(){
    var sonucEl = document.getElementById("bakimAvansSonuc");
    var kaynakAnahtar = document.getElementById("bakimAvansKaynakSecici").value;
    var hedefAy = parseInt(document.getElementById("bakimAvansHedefAy").value, 10);
    var hedefYil = parseInt(document.getElementById("bakimAvansHedefYil").value, 10);
    if(!kaynakAnahtar){ alert("Önce bir kaynak dönem seç."); return; }
    if(!hedefAy || hedefAy<1 || hedefAy>12 || !hedefYil){ alert("Geçerli bir hedef Ay (1-12) ve Yıl gir."); return; }
    if(typeof AvansKayitData === "undefined"){ hataGoster("Avans veri modülü yüklenemedi."); return; }

    var p = kaynakAnahtar.split("-");
    var kaynakYil = parseInt(p[0], 10), kaynakAy = parseInt(p[1], 10);
    var kapali = AvansKayitData.kapaliKaydiBul(kaynakAy, kaynakYil);
    var taslak = AvansKayitData.taslakOku(kaynakAy, kaynakYil);
    // Kapalı kayıt varsa onun satırları esas alınır (resmi son kayıt);
    // yoksa açık taslağın satırları taşınır.
    var kaynakVeri = kapali || taslak;
    var tasinacak = {
      ozelAvansGirisleri: kaynakVeri.ozelAvansGirisleri || [],
      isAvansiGirisleri: kaynakVeri.isAvansiGirisleri || [],
      isAvansiHarcamalar: kaynakVeri.isAvansiHarcamalar || []
    };

    if(!confirm(
      AY_ADLARI_AYARLAR[kaynakAy] + " " + kaynakYil + " döneminin avans kaydını "
      + AY_ADLARI_AYARLAR[hedefAy] + " " + hedefYil + " döneminin AÇIK taslağına taşımak istediğine emin misin?\n\n"
      + "Kaynaktaki taslak/kapalı kayıt SİLİNECEK, hedefteki mevcut taslak (varsa) bu satırlarla DEĞİŞTİRİLECEK.\n\nBu işlem geri alınamaz."
    )) return;

    var btn = this;
    btn.disabled = true; btn.textContent = "⏳ Taşınıyor...";
    sonucEl.textContent = "";

    AvansKayitData.taslakGuncelle(hedefAy, hedefYil, tasinacak, function(basarili, err){
      if(!basarili){
        btn.disabled = false; btn.textContent = "📦 Seçili Kaydı Hedef Döneme Taşı";
        sonucEl.textContent = "❌ Hedefe yazılamadı: " + (err && err.message ? err.message : err);
        hataGoster("Avans taşıma başarısız (hedef yazma): " + (err && err.message ? err.message : err));
        return;
      }
      function kaynagiTemizle(cb){
        // Kaynak taslağı boşalt (silinmiş sayılsın diye).
        AvansKayitData.taslakGuncelle(kaynakAy, kaynakYil, {ozelAvansGirisleri:[], isAvansiGirisleri:[], isAvansiHarcamalar:[]}, function(basarili2){
          if(!kapali){ cb(basarili2); return; }
          AvansKayitData.kaydiSil(kaynakAnahtar, function(basarili3){ cb(basarili2 && basarili3); });
        });
      }
      kaynagiTemizle(function(basariliTemizlik){
        btn.disabled = false; btn.textContent = "📦 Seçili Kaydı Hedef Döneme Taşı";
        if(!basariliTemizlik){
          sonucEl.textContent = "⚠️ Hedefe yazıldı ama kaynak tam temizlenemedi — Avans Takibi'nde kaynak dönemi kontrol et.";
          return;
        }
        sonucEl.textContent = "✓ Taşındı — " + AY_ADLARI_AYARLAR[kaynakAy] + " " + kaynakYil + " → " + AY_ADLARI_AYARLAR[hedefAy] + " " + hedefYil + ". Maaş Hesaplama ve Avans Takibi'nde kontrol edebilirsin.";
        document.getElementById("bakimAvansKaynakSecici").value = "";
      });
    });
  };
});
