/*
  menu-render.js — VERSİYON: WG.271026.2238.1145
  ==============
  Menü artık sadece liste + 1 doğrudan aksiyon (Çıkış Yap). Ayarlar/
  Şablonlar/Veri kendi sayfalarında. "🔐 Uygulama PIN Değiştir" artık
  buradan DEĞİL, "Cihazlar ve Kullanıcılar" sayfasından yönetiliyor
  (25.10.2026, Abdullah'ın isteğiyle — bkz. cihaz-kullanici-render.js'teki
  ckUygulamaPinDegistirTiklandi).
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

window.addEventListener("error", function(ev){
  hataGoster("HATA: " + ev.message + " (" + (ev.filename||"").split("/").pop() + ":" + ev.lineno + ")");
});

document.addEventListener("DOMContentLoaded", function(){
  tarihiGuncelle();
  document.getElementById("btnCikis").onclick = function(){
    if(!confirm("Çıkış yapmak istediğinize emin misiniz?")) return;
    firebase.auth().signOut().then(function(){
      window.location.href = "login.html";
    });
  };

  window.addEventListener("istakipAuthHazir", function(ev){
    var el = document.getElementById("kullaniciBilgi");
    if(el && ev.detail && ev.detail.user) el.textContent = ev.detail.user.email;
  });
});
