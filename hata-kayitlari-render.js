/*
  hata-kayitlari-render.js
  =========================
  hata-log.js'in Firebase'e yazdığı kayıtları okuyup gruplu (gün gün)
  listeler. Bu sayfanın kendisinde hata oluşursa, o hatayı hataGoster ile
  göstermek yerine sadece console.error'a yazıyoruz — aksi halde bir
  hata gösterme sayfası kendi kendini sonsuz döngüye sokabilir.
*/

function hataGosterSessiz(mesaj){
  console.error(mesaj);
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

var tumKayitlar = [];

function listeyiCiz(){
  try{
    var gunSiniri = parseInt(document.getElementById("hkGunFiltre").value, 10);
    var simdi = Date.now();
    var filtrelenmis = tumKayitlar.filter(function(k){
      return (simdi - k.zaman) <= gunSiniri * 24 * 60 * 60 * 1000;
    });

    document.getElementById("hkSayac").textContent = filtrelenmis.length;
    var kapsayici = document.getElementById("hkListesi");
    var bos = document.getElementById("hkBos");

    if(filtrelenmis.length === 0){
      kapsayici.innerHTML = "";
      bos.hidden = false;
      return;
    }
    bos.hidden = true;

    var gunGruplari = {};
    filtrelenmis.forEach(function(k){
      var gunAnahtari = new Date(k.zaman).toLocaleDateString("tr-TR", {timeZone:"Europe/Istanbul"});
      if(!gunGruplari[gunAnahtari]) gunGruplari[gunAnahtari] = [];
      gunGruplari[gunAnahtari].push(k);
    });

    var gunler = Object.keys(gunGruplari).sort(function(a,b){
      return gunGruplari[b][0].zaman - gunGruplari[a][0].zaman;
    });

    kapsayici.innerHTML = gunler.map(function(gun){
      var kayitlarBuGun = gunGruplari[gun];
      return "<div class='hk-gun-baslik'>" + htmlEsc(gun) + " (" + kayitlarBuGun.length + ")</div>"
        + kayitlarBuGun.map(function(k){
          var saat = new Date(k.zaman).toLocaleTimeString("tr-TR", {timeZone:"Europe/Istanbul", hour:"2-digit", minute:"2-digit"});
          return "<div class='hk-kart'>"
            + "<button class='hk-kart-sil-btn' data-anahtar='" + k.anahtar + "'>🗑</button>"
            + "<div class='hk-kart-ust'><span class='hk-kart-sayfa'>" + htmlEsc(k.sayfa||"?") + "</span><span class='hk-kart-saat'>" + saat + "</span></div>"
            + "<div class='hk-kart-mesaj'>" + htmlEsc(k.mesaj) + "</div>"
            + (k.ek ? "<div class='hk-kart-ek'>" + htmlEsc(k.ek) + "</div>" : "")
            + "</div>";
        }).join("");
    }).join("");

    kapsayici.querySelectorAll(".hk-kart-sil-btn").forEach(function(btn){
      btn.onclick = function(){
        var anahtar = this.getAttribute("data-anahtar");
        firebase.database().ref("hatalar/" + anahtar).remove();
      };
    });
  }catch(e){ hataGosterSessiz("Liste çizilemedi: " + e.message); }
}

document.addEventListener("DOMContentLoaded", function(){
  tarihiGuncelle();
  var btnMenuEl = document.getElementById("btnMenu");
  if(btnMenuEl) btnMenuEl.onclick = function(){ window.location.href = "menu.html"; };
  document.getElementById("hkGunFiltre").onchange = listeyiCiz;
  document.getElementById("btnHkHepsiniSil").onclick = function(){
    if(tumKayitlar.length === 0) return;
    if(!confirm("TÜM hata kayıtları kalıcı olarak silinsin mi? Bu geri alınamaz.")) return;
    firebase.database().ref("hatalar").remove();
  };

  try{
    if(!firebase.apps.length){ firebase.initializeApp(ISTAKIP_FIREBASE_CONFIG); }
    firebase.database().ref("hatalar").limitToLast(200).on("value", function(snap){
      var veri = snap.val();
      tumKayitlar = veri ? Object.keys(veri).map(function(anahtar){
        var k = veri[anahtar];
        return {anahtar:anahtar, mesaj:k.mesaj, sayfa:k.sayfa, zaman:k.zaman||0, ek:k.ek};
      }) : [];
      listeyiCiz();
    }, function(err){
      hataGosterSessiz("Hata kayıtları okunamadı: " + err.message);
    });
  }catch(e){
    hataGosterSessiz("Firebase başlatılamadı: " + e.message);
  }
});
