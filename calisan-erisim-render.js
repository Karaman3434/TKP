/*
  calisan-erisim-render.js
  =========================
  "Çalışan Erişimi" sayfasının mantığı:
    1) Kullanıcı adı + şifre ile sınırlı erişimli bir hesap oluşturma
       (Abdullah'ın kendi oturumunu bozmadan, İKİNCİL bir Firebase app
       örneği üzerinden — tamamen ücretsiz, Cloud Function GEREKMEZ).
    2) Oluşturulan her hesabın "izinler" haritasını (hangi sayfalar açık)
       grup grup gösterip düzenleme.

  YENİ BİR SAYFA İZNİ EKLEMEK İSTERSEN: aşağıdaki İZIN_TANIMLARI listesine
  bir satır ekle VE auth.js'teki SAYFA_IZIN_ANAHTARI haritasına o sayfanın
  dosya adını aynı anahtarla ekle. İki dosya da senkron olmalı.

  GÜVENLİK NOTU: Bir hesabı "Devre Dışı Bırak" dediğinde kayıt SİLİNMEZ,
  sadece aktif:false işaretlenir. Kaydı tamamen silmek, auth.js'in
  "kisitliKullanicilar'da yok = kısıtlı değil" mantığı yüzünden o hesabı
  YANLIŞLIKLA sınırsız hale getirir — bu yüzden bu seçenek bilerek yok.
*/

// ISTAKIP_CALISAN_EMAIL_DOMAINI artık firebase-config.js'de tek ortak
// sabit olarak tanımlı (login-render.js ile paylaşılıyor).

var IZIN_TANIMLARI = [
  { grup: "Satış İşlemleri", sayfalar: [
    { anahtar: "hesapla", etiket: "🧮 Hızlı Hesapla (bağımsız, müşterisiz)" },
    { anahtar: "sepet", etiket: "🛒 Ürün Bul / Hesapla / Sepet (birleşik sayfa)" },
    { anahtar: "gonder", etiket: "📤 Gönder" }
  ]},
  // BİRLEŞİK SAYFA İNCE AYARI (02.10.2026) — bunlar "sepet" izni AÇIKKEN
  // o sayfa içindeki belirli düğmeleri tek tek kapatmak için. "sepet"
  // izni KAPALIYSA bu alt izinlerin hiçbir önemi yok, çalışan sayfaya
  // zaten giremiyor. Eski çalışan kayıtlarında bu anahtarlar hiç yoktur —
  // o yüzden auth.js'te "yoksa açık say" kuralı var (geriye dönük kırmaz).
  { grup: "🛒 Sayfası İçin İnce Ayar", varsayilanAcik: true, sayfalar: [
    { anahtar: "sepetAramaGoster", etiket: "🔍 Arama kutusu ve ürün listesini görebilsin" },
    { anahtar: "sepetWebAc", etiket: "🌐 Ürüne dokununca WEICON sayfasını açabilsin" },
    { anahtar: "sepetHesaplaAc", etiket: "🧮 \"H\" — Hızlı Hesapla penceresini açabilsin" },
    { anahtar: "sepetSec", etiket: "➕ \"SEÇ\" — ürünü Hesaplanacak'a ekleyebilsin" },
    { anahtar: "sepetHesaplandiGoster", etiket: "🟢 Hesaplandı listesini görebilsin" },
    { anahtar: "sepetGonder", etiket: "✓ Kaydet / 📋 Formu Görüntüle yapabilsin" }
  ]},
  { grup: "Müşteri", sayfalar: [
    { anahtar: "musteriBul", etiket: "🔍 Müşteri Bul" },
    { anahtar: "islemGecmisi", etiket: "🕐 İşlem Geçmişi" }
  ]},
  { grup: "Raporlar ve Takip", sayfalar: [
    { anahtar: "raporlar", etiket: "📊 Raporlar" },
    { anahtar: "satisListesi", etiket: "📋 Satış Listesi" },
    { anahtar: "hareketler", etiket: "🔁 Hareketler" },
    { anahtar: "ziyaret", etiket: "📍 Ziyaret" },
    { anahtar: "takipGerekenler", etiket: "📌 Takip Gerekenler" },
    { anahtar: "gorevler", etiket: "✅ Görevler" },
    { anahtar: "vadeTakip", etiket: "📅 Vade Takip" }
  ]},
  { grup: "Maaş ve Finans", sayfalar: [
    { anahtar: "maasHesaplama", etiket: "💰 Maaş Hesaplama" },
    { anahtar: "netMaasHesaplama", etiket: "💵 Net Maaş Hesaplama" },
    { anahtar: "avansTakibi", etiket: "💳 Avans Takibi" },
    { anahtar: "odenebilirKomisyon", etiket: "🧾 Ödenebilir Komisyon" }
  ]},
  { grup: "Diğer", sayfalar: [
    { anahtar: "anaSayfa", etiket: "🏠 Ana Sayfa" },
    { anahtar: "kmTakip", etiket: "🚗 KM Takip" },
    { anahtar: "bildirimler", etiket: "🔔 Bildirimler" }
  ]}
];

function ceHataGoster(mesaj){
  console.error(mesaj);
  if(typeof HataLog !== "undefined") HataLog.kaydet(mesaj);
}

function ceIkinciFirebaseApp(){
  var ikinciAdi = "calisanOlusturucu";
  var mevcutListe = firebase.apps.filter(function(a){ return a.name === ikinciAdi; });
  return mevcutListe.length ? mevcutListe[0] : firebase.initializeApp(ISTAKIP_FIREBASE_CONFIG, ikinciAdi);
}

function ceVarsayilanIzinler(){
  return { hesapla: true };
}

function ceKullaniciOlustur(kullaniciAdiGirilen, sifre, cb){
  var kullaniciAdi = String(kullaniciAdiGirilen||"").trim().toLowerCase().replace(/\s+/g,"");
  if(!kullaniciAdi || !sifre){ cb(false, "Kullanıcı adı ve şifre girin."); return; }
  if(sifre.length < 6){ cb(false, "Şifre en az 6 karakter olmalı."); return; }
  var email = kullaniciAdi + ISTAKIP_CALISAN_EMAIL_DOMAINI;
  var ikincilApp;
  try{ ikincilApp = ceIkinciFirebaseApp(); }
  catch(e){ cb(false, "İkincil oturum başlatılamadı: " + e.message); return; }

  ikincilApp.auth().createUserWithEmailAndPassword(email, sifre).then(function(sonuc){
    var uid = sonuc.user.uid;
    return ikincilApp.auth().signOut().then(function(){
      return firebase.database().ref("kisitliKullanicilar/" + uid).set({
        kullaniciAdi: kullaniciAdi,
        aktif: true,
        izinler: ceVarsayilanIzinler(),
        olusturulma: Date.now()
      });
    });
  }).then(function(){
    cb(true);
  }).catch(function(e){
    var mesaj = (e && e.code === "auth/email-already-in-use")
      ? "Bu kullanıcı adı zaten kullanılıyor."
      : (e && e.message ? e.message : "bilinmeyen hata");
    cb(false, mesaj);
  });
}

function ceGrupHtml(uid, izinler, aktifMi){
  return IZIN_TANIMLARI.map(function(grup, grupIdx){
    var satirlar = grup.sayfalar.map(function(sayfa){
      // "İnce Ayar" grubu — anahtar izinler'de hiç yoksa (eski kayıtlar,
      // veya "sepet" henüz hiç kaydedilmemiş) varsayılan AÇIK gösterilir;
      // sadece admin bilerek işareti kaldırıp kaydederse false olur.
      var isaretli = grup.varsayilanAcik ? (izinler[sayfa.anahtar] !== false) : (izinler[sayfa.anahtar] === true);
      return '<label class="ce-grup-satir">' +
        '<span>' + sayfa.etiket + '</span>' +
        '<input type="checkbox" data-anahtar="' + sayfa.anahtar + '" ' + (isaretli ? "checked" : "") + (aktifMi ? "" : " disabled") + '>' +
        '</label>';
    }).join("");
    return '<details class="ce-grup"' + (grupIdx === 0 ? " open" : "") + '>' +
      '<summary>' + grup.grup + '</summary>' +
      '<div class="ce-grup-liste">' + satirlar + '</div>' +
      '</details>';
  }).join("");
}

function ceAcikSayfaSayisi(izinler){
  var sayac = 0;
  IZIN_TANIMLARI.forEach(function(grup){
    if(grup.varsayilanAcik) return; // ince ayar — "sayfa" sayılmaz
    grup.sayfalar.forEach(function(sayfa){ if(izinler[sayfa.anahtar] === true) sayac++; });
  });
  return sayac;
}

function ceKullaniciKartHtml(uid, veri){
  var izinler = veri.izinler || {};
  var aktifMi = veri.aktif !== false;
  var ozet = aktifMi ? (ceAcikSayfaSayisi(izinler) + " sayfa açık") : "devre dışı";
  return '<section class="ce-kart" data-uid="' + uid + '">' +
    '<div class="ce-kullanici-ust">' +
      '<div class="ce-kullanici-ad' + (aktifMi ? "" : " ce-kullanici-ad--devredisi") + '">👤 ' + (veri.kullaniciAdi||"?") + '</div>' +
      (aktifMi ? '<button class="ce-devre-disi-btn" data-aksiyon="devredisi" title="Devre dışı bırak">🗑</button>' : "") +
    '</div>' +
    '<div class="ce-kullanici-ozet">' + ozet + '</div>' +
    (aktifMi ? "" : '<div class="ce-devredisi-rozet">⛔ Bu hesap devre dışı — hiçbir sayfaya girilemez</div>') +
    ceGrupHtml(uid, izinler, aktifMi) +
    (aktifMi
      ? '<button class="ce-kaydet-btn" data-aksiyon="kaydet">✓ Kaydet</button>'
      : '<button class="ce-yeniden-etkinlestir-btn" data-aksiyon="etkinlestir">↺ Yeniden Etkinleştir</button>'
    ) +
    '</section>';
}

function ceListeyiCiz(tumKullanicilar){
  var kapsayici = document.getElementById("ceKullaniciListesi");
  var bosMesaj = document.getElementById("ceBosMesaj");
  var uidler = Object.keys(tumKullanicilar||{});
  if(!uidler.length){
    kapsayici.innerHTML = "";
    bosMesaj.hidden = false;
    return;
  }
  bosMesaj.hidden = true;
  kapsayici.innerHTML = uidler.map(function(uid){
    return ceKullaniciKartHtml(uid, tumKullanicilar[uid] || {});
  }).join("");

  kapsayici.querySelectorAll(".ce-kart").forEach(function(kart){
    var uid = kart.getAttribute("data-uid");

    var devreDisiBtn = kart.querySelector('[data-aksiyon="devredisi"]');
    if(devreDisiBtn){
      devreDisiBtn.onclick = function(){
        if(!confirm("Bu hesabı devre dışı bırakmak istediğine emin misin? Hesap hiçbir sayfaya girilemeyecek hale gelir.")) return;
        firebase.database().ref("kisitliKullanicilar/" + uid + "/aktif").set(false).catch(function(e){
          ceHataGoster("Hesap devre dışı bırakılamadı: " + e.message);
          alert("İşlem başarısız: " + e.message);
        });
      };
    }

    var etkinlestirBtn = kart.querySelector('[data-aksiyon="etkinlestir"]');
    if(etkinlestirBtn){
      etkinlestirBtn.onclick = function(){
        firebase.database().ref("kisitliKullanicilar/" + uid + "/aktif").set(true).catch(function(e){
          ceHataGoster("Hesap yeniden etkinleştirilemedi: " + e.message);
          alert("İşlem başarısız: " + e.message);
        });
      };
    }

    var kaydetBtn = kart.querySelector('[data-aksiyon="kaydet"]');
    if(kaydetBtn){
      kaydetBtn.onclick = function(){
        var yeniIzinler = {};
        kart.querySelectorAll('input[type="checkbox"][data-anahtar]').forEach(function(kutu){
          yeniIzinler[kutu.getAttribute("data-anahtar")] = kutu.checked;
        });
        kaydetBtn.disabled = true;
        kaydetBtn.textContent = "⏳ Kaydediliyor...";
        firebase.database().ref("kisitliKullanicilar/" + uid + "/izinler").set(yeniIzinler).then(function(){
          kaydetBtn.disabled = false;
          kaydetBtn.textContent = "✓ Kaydet";
        }).catch(function(e){
          kaydetBtn.disabled = false;
          kaydetBtn.textContent = "✓ Kaydet";
          ceHataGoster("İzinler kaydedilemedi: " + e.message);
          alert("İzinler kaydedilemedi: " + e.message);
        });
      };
    }
  });
}

window.addEventListener("error", function(ev){
  ceHataGoster("HATA: " + ev.message + " (" + (ev.filename||"").split("/").pop() + ":" + ev.lineno + ")");
});

/* ---------- S22 + PIN kilidi (02.10.2026, Abdullah'ın isteğiyle) ----------
   Cihazlarım'daki (cihazlar-render.js) akışın BİREBİR AYNISI — kasıtlı
   olarak AYNI localStorage/Firebase anahtarları kullanılır
   (weicon_cihaz_pin_hash, weicon_cihaz_pin_ok, cihazPin düğümü), böylece
   bir oturumda Cihazlarım'da PIN zaten girilmişse burada tekrar sorulmaz. */
function ceErisimKontrolEt(){
  var s22Mi = CihazData.korumaliMi(CihazData.benimAdim());
  document.getElementById("ceSadeceS22Notu").hidden = s22Mi;
  document.getElementById("cePinAlani").hidden = true;
  document.getElementById("ceYonetimAlani").hidden = true;

  if(!s22Mi) return;

  if(sessionStorage.getItem("weicon_cihaz_pin_ok") === "1"){
    ceYonetimAlaniniGoster();
  } else {
    document.getElementById("cePinAlani").hidden = false;
    cePinAkisiBaslat();
  }
}

var ceGirilenPin = "";
var cePinAsama = "kontrolEdiliyor"; // kontrolEdiliyor -> giris | yeniPin1 -> yeniPin2 -> tamam
var ceYeniPinIlkGiris = "";

function cePinHashGetir(){ return localStorage.getItem("weicon_cihaz_pin_hash"); }

function ceNoktalariGuncelle(){
  var noktalar = document.querySelectorAll("#cePinNoktalar .pin-nokta");
  noktalar.forEach(function(n, i){ n.classList.toggle("dolu", i < ceGirilenPin.length); });
}
function cePinEkraniniSifirla(){ ceGirilenPin = ""; ceNoktalariGuncelle(); }

function ceRakamEkle(r){
  if(ceGirilenPin.length >= 4) return;
  ceGirilenPin += r;
  ceNoktalariGuncelle();
  if(ceGirilenPin.length === 4){
    if(cePinAsama === "giris") cePinKontrolEt();
    else if(cePinAsama === "yeniPin1") ceYeniPinIlkAdimiIsle();
    else if(cePinAsama === "yeniPin2") ceYeniPinTekrarIsle();
  }
}
function ceRakamSil(){
  ceGirilenPin = ceGirilenPin.slice(0, -1);
  ceNoktalariGuncelle();
  document.getElementById("cePinHata").hidden = true;
}

function ceYeniPinAkisiniBaslat(){
  cePinAsama = "yeniPin1";
  cePinEkraniniSifirla();
  document.getElementById("cePinBaslik").textContent = "🆕 Yönetim PIN'i Belirle";
  var bilgi = document.getElementById("cePinBilgi");
  bilgi.textContent = "Bu cihazdan çalışan hesaplarını yönetebilmek için 4 haneli AYRI bir PIN belirle (uygulama kilidinden farklı).";
  bilgi.hidden = false;
}

function cePinKontrolEt(){
  var mevcutHash = cePinHashGetir();
  pinHashHesapla(ceGirilenPin).then(function(girilenHash){
    if(girilenHash === mevcutHash){
      sessionStorage.setItem("weicon_cihaz_pin_ok", "1");
      ceYonetimAlaniniGoster();
    } else {
      document.getElementById("cePinHata").hidden = false;
      cePinEkraniniSifirla();
    }
  });
}

function ceYeniPinIlkAdimiIsle(){
  ceYeniPinIlkGiris = ceGirilenPin;
  cePinAsama = "yeniPin2";
  cePinEkraniniSifirla();
  document.getElementById("cePinBaslik").textContent = "🆕 PIN'i Onayla";
  document.getElementById("cePinBilgi").textContent = "Az önce girdiğin PIN'i onaylamak için tekrar gir.";
}

function ceYeniPinTekrarIsle(){
  if(ceGirilenPin !== ceYeniPinIlkGiris){
    document.getElementById("cePinHata").textContent = "PIN'ler eşleşmiyor, baştan deneyin.";
    document.getElementById("cePinHata").hidden = false;
    ceYeniPinIlkGiris = "";
    ceYeniPinAkisiniBaslat();
    return;
  }
  pinHashHesapla(ceGirilenPin).then(function(yeniHash){
    localStorage.setItem("weicon_cihaz_pin_hash", yeniHash);
    try{ firebase.database().ref("cihazPin").set({hash:yeniHash, zaman:Date.now()}); }catch(e){}
    sessionStorage.setItem("weicon_cihaz_pin_ok", "1");
    ceYonetimAlaniniGoster();
  });
}

function ceTusTakiminiOlustur(){
  var tuslar = ["1","2","3","4","5","6","7","8","9","","0","⌫"];
  var grid = document.getElementById("cePinTusGrid");
  grid.innerHTML = tuslar.map(function(t){
    if(t === "") return "<button class='pin-tus pin-tus--bos'></button>";
    if(t === "⌫") return "<button class='pin-tus pin-tus--sil' data-sil='1'>⌫</button>";
    return "<button class='pin-tus' data-rakam='" + t + "'>" + t + "</button>";
  }).join("");
  grid.querySelectorAll("[data-rakam]").forEach(function(btn){
    btn.onclick = function(){ ceRakamEkle(this.getAttribute("data-rakam")); };
  });
  grid.querySelector("[data-sil]").onclick = ceRakamSil;

  var gizliInput = document.getElementById("cePinGizliInput");
  gizliInput.addEventListener("input", function(){
    var v = gizliInput.value.replace(/[^0-9]/g, "").slice(0,4);
    gizliInput.value = "";
    for(var i=0;i<v.length;i++) ceRakamEkle(v[i]);
  });
}

function cePinAkisiBaslat(){
  document.getElementById("cePinBaslik").textContent = "🔒 Çalışan Erişimi — Yönetim PIN'i";
  document.getElementById("cePinBilgi").hidden = true;
  cePinEkraniniSifirla();

  if(cePinHashGetir()){
    cePinAsama = "giris";
    return;
  }
  // Yerelde yok — Firebase'de bu S22'nin daha önce belirlediği bir PIN
  // var mı diye bak (localStorage temizlenmiş olabilir). Yoksa yeni belirle.
  try{
    firebase.database().ref("cihazPin/hash").once("value").then(function(snap){
      if(snap.val()){
        localStorage.setItem("weicon_cihaz_pin_hash", snap.val());
        cePinAsama = "giris";
      } else {
        ceYeniPinAkisiniBaslat();
      }
    }).catch(function(){ ceYeniPinAkisiniBaslat(); });
  }catch(e){ ceYeniPinAkisiniBaslat(); }
}

/* ---------- PIN doğrulandıktan sonra: asıl Çalışan Erişimi içeriği ---------- */
function ceYonetimAlaniniGoster(){
  document.getElementById("cePinAlani").hidden = true;
  document.getElementById("ceYonetimAlani").hidden = false;

  if(ceYonetimBaslatildiMi) return;
  ceYonetimBaslatildiMi = true;

  firebase.database().ref("kisitliKullanicilar").on("value", function(snap){
    ceListeyiCiz(snap.val() || {});
  }, function(e){
    ceHataGoster("Çalışan listesi okunamadı: " + e.message);
  });

  document.getElementById("btnCeOlustur").onclick = function(){
    var btn = this;
    var hataEl = document.getElementById("ceOlusturHata");
    hataEl.hidden = true;
    var kullaniciAdi = document.getElementById("ceKullaniciAdi").value;
    var sifre = document.getElementById("ceSifre").value;
    btn.disabled = true;
    btn.textContent = "⏳ Oluşturuluyor...";
    ceKullaniciOlustur(kullaniciAdi, sifre, function(basarili, hata){
      btn.disabled = false;
      btn.textContent = "✓ Kullanıcı Oluştur";
      if(!basarili){
        hataEl.textContent = "❌ " + hata;
        hataEl.hidden = false;
        return;
      }
      document.getElementById("ceKullaniciAdi").value = "";
      document.getElementById("ceSifre").value = "";
    });
  };
}
var ceYonetimBaslatildiMi = false;

document.addEventListener("DOMContentLoaded", function(){
  var tarihEl = document.getElementById("gunTarihi");
  if(tarihEl){
    var gunler = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
    var aylar = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
    var d = new Date();
    tarihEl.textContent = gunler[d.getDay()] + ", " + d.getDate() + " " + aylar[d.getMonth()] + " " + d.getFullYear();
  }
  var surumEl = document.getElementById("surumBilgisi");
  if(surumEl) surumEl.textContent = "Sürüm WG.271026.2238.1133";

  ceTusTakiminiOlustur();
  ceErisimKontrolEt();
  CihazData.kaydiGuncelle();
});
