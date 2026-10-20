/*
  pin-render.js — WG.201026.1615.863
  =============
  4 haneli tuş takımı + gizli input ile PIN toplar, pinDogrula() ile
  kontrol eder, doğruysa aktivite zamanını güncelleyip home.html'e döner.

  GÜVENLİK DÜZELTMESİ (v2 üstü): Kullanıcı hâlâ değiştirilmemiş varsayılan
  "1234" PIN'i ile giriş yaptıysa, uygulamaya geçmeden ÖNCE kendi 4 haneli
  PIN'ini belirlemesi zorunlu tutulur. Böylece varsayılan PIN sonsuza kadar
  geçerli kalmaz. Akış dört aşamalıdır:
    "giris"    -> mevcut PIN doğrulanır
    "yeniPin1" -> (sadece varsayılan PIN kullanılıyorsa) yeni PIN girilir
    "yeniPin2" -> yeni PIN tekrar girilir (doğrulama)
    tamam       -> hash kaydedilir, home.html'e geçilir
*/

var girilenPin = "";
var pinAsama = "giris";
var yeniPinIlkGiris = "";

function noktalariGuncelle(){
  var noktalar = document.querySelectorAll(".pin-nokta");
  noktalar.forEach(function(n, i){
    n.classList.toggle("dolu", i < girilenPin.length);
  });
}

function rakamEkle(r){
  if(girilenPin.length >= 4) return;
  girilenPin += r;
  noktalariGuncelle();
  if(girilenPin.length === 4){
    if(pinAsama === "giris") pinKontrolEt();
    else if(pinAsama === "yeniPin1") yeniPinIlkAdimiIsle();
    else if(pinAsama === "yeniPin2") yeniPinTekrarIsle();
  }
}

function rakamSil(){
  girilenPin = girilenPin.slice(0, -1);
  noktalariGuncelle();
  document.getElementById("pinHata").hidden = true;
}

function pinEkraniniSifirla(){
  girilenPin = "";
  noktalariGuncelle();
}

// Kaldığı yerden devam (22.09.2026): auth.js, kilitlenme anındaki sayfayı
// weicon_pin_donus_sayfa'ya kaydeder. PIN doğru girilince oraya dönülür;
// kayıt yoksa (örn. login sonrası ilk PIN kurulumu) Ana Sayfa'ya gidilir.
// pin.html/login.html gibi döngüye sokacak sayfalar asla hedef olamaz.
//
// 30 DAKİKA EŞİĞİ (20.10.2026, Abdullah'ın isteğiyle): "kaldığı yerden
// devam" artık sadece 30 dakikadan KISA bir ayrılıkta geçerli. auth.js
// aynı anda weicon_pin_donus_uzun_sure'u da kaydediyor ("1" = 30 dakikadan
// uzun süre dokunulmamış) — "1" ise PIN doğru girilse bile o yarım kalmış
// ekrana değil doğrudan Ana Sayfa'ya gidilir.
function pinBasariliYonlendir(){
  var hedef = "home.html";
  try{
    var kayitli = localStorage.getItem("weicon_pin_donus_sayfa");
    var uzunSureGecmis = localStorage.getItem("weicon_pin_donus_uzun_sure") === "1";
    if(kayitli && !uzunSureGecmis && kayitli.indexOf("pin.html") === -1 && kayitli.indexOf("login.html") === -1){
      hedef = kayitli;
    }
    localStorage.removeItem("weicon_pin_donus_sayfa");
    localStorage.removeItem("weicon_pin_donus_uzun_sure");
  }catch(e){}
  window.location.href = hedef;
}

function pinKontrolEt(){
  pinDogrula(girilenPin).then(function(dogruMu){
    if(dogruMu){
      if(pinVarsayilanKullaniliyorMu()){
        // Varsayılan "1234" ile girildi -> zorunlu yeni PIN belirleme adımına geç.
        pinAsama = "yeniPin1";
        pinEkraniniSifirla();
        document.getElementById("pinBaslik").textContent = "🆕 Yeni PIN Belirle";
        var bilgi = document.getElementById("pinBilgi");
        bilgi.textContent = "Güvenliğiniz için varsayılan PIN yerine kendi 4 haneli PIN'inizi belirleyin.";
        bilgi.hidden = false;
      } else {
        try{ localStorage.setItem("weicon_son_aktivite", Date.now().toString()); }catch(e){}
        pinBasariliYonlendir();
      }
    } else {
      document.getElementById("pinHata").hidden = false;
      pinEkraniniSifirla();
    }
  });
}

function yeniPinIlkAdimiIsle(){
  yeniPinIlkGiris = girilenPin;
  pinAsama = "yeniPin2";
  pinEkraniniSifirla();
  document.getElementById("pinBaslik").textContent = "🆕 Yeni PIN'i Onayla";
  document.getElementById("pinBilgi").textContent = "Az önce girdiğiniz PIN'i onaylamak için tekrar girin.";
}

function yeniPinTekrarIsle(){
  if(girilenPin !== yeniPinIlkGiris){
    document.getElementById("pinHata").textContent = "PIN'ler eşleşmiyor, baştan deneyin.";
    document.getElementById("pinHata").hidden = false;
    pinAsama = "yeniPin1";
    yeniPinIlkGiris = "";
    pinEkraniniSifirla();
    document.getElementById("pinBaslik").textContent = "🆕 Yeni PIN Belirle";
    return;
  }
  pinHashHesapla(girilenPin).then(function(yeniHash){
    pinYeniHashKaydet(yeniHash);
    try{ localStorage.setItem("weicon_son_aktivite", Date.now().toString()); }catch(e){}
    pinBasariliYonlendir();
  });
}

function tusTakiminiOlustur(){
  var tuslar = ["1","2","3","4","5","6","7","8","9","","0","⌫"];
  var grid = document.getElementById("pinTusGrid");
  grid.innerHTML = tuslar.map(function(t){
    if(t === "") return "<button class='pin-tus pin-tus--bos'></button>";
    if(t === "⌫") return "<button class='pin-tus pin-tus--sil' data-sil='1'>⌫</button>";
    return "<button class='pin-tus' data-rakam='" + t + "'>" + t + "</button>";
  }).join("");

  grid.querySelectorAll("[data-rakam]").forEach(function(btn){
    btn.onclick = function(){ rakamEkle(this.getAttribute("data-rakam")); };
  });
  grid.querySelector("[data-sil]").onclick = rakamSil;
}

document.addEventListener("DOMContentLoaded", function(){
  tusTakiminiOlustur();

  document.getElementById("btnTamGiris").onclick = function(){
    if(!confirm("E-posta ve şifre ile giriş yapmak istediğinize emin misiniz?")) return;
    firebase.auth().signOut().then(function(){
      window.location.href = "login.html";
    });
  };

  // Fiziksel/mobil klavye desteği için gizli input da dinleniyor
  var gizliInput = document.getElementById("pinGizliInput");
  document.querySelector(".giris-kutu").addEventListener("click", function(){ gizliInput.focus(); });
  gizliInput.addEventListener("input", function(){
    var v = gizliInput.value.replace(/[^0-9]/g, "").slice(0,4);
    gizliInput.value = "";
    for(var i=0;i<v.length;i++) rakamEkle(v[i]);
  });
});
