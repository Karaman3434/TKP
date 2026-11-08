// takip-gerekenler-render.js — TKP.08.11.26-09:20.1499
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
function cariSatirHTML(kod, isim, sehir){
  return "<span class='cari-kod'>" + htmlEsc(kod||"—") + "</span>"
    + "<span class='cari-ayrac'> - </span>"
    + "<span class='cari-isim'>" + htmlEsc(isim||"") + "</span>"
    + (sehir ? "<span class='cari-ayrac'> - </span><span class='cari-sehir'>" + htmlEsc(sehir) + "</span>" : "");
}

// Aynı mantık customer-render.js'deki sonAktiviteZamani ile birebir aynı
// tutulmalı: son ziyaret VEYA son işlemden hangisi daha yeniyse.
var musteriSonIslemHaritasi = null;
function sonIslemHaritasiniHazirla(){
  var harita = {};
  try{
    if(typeof ReportsData !== "undefined"){
      ReportsData.sonIslemler().forEach(function(k){
        if(!k.musteriId) return;
        if(!harita[k.musteriId] || k.ts > harita[k.musteriId]) harita[k.musteriId] = k.ts;
      });
    }
  }catch(e){}
  musteriSonIslemHaritasi = harita;
}
function sonAktiviteZamani(m){
  var sonIslem = (musteriSonIslemHaritasi && m.id) ? musteriSonIslemHaritasi[m.id] : null;
  var aday = [m.sonZiyaret||0, sonIslem||0];
  return Math.max.apply(null, aday);
}

function listeyiCiz(){
  try{
    sonIslemHaritasiniHazirla();
    var sehirFiltre = (document.getElementById("tgSehirFiltre").value||"").toLocaleLowerCase("tr-TR");
    var sirala = document.getElementById("tgSirala").value;

    var tumu = CustomerData.ara("");
    var esikMs = 30*86400000;
    var liste = tumu.filter(function(m){
      var zaman = sonAktiviteZamani(m);
      return zaman === 0 || (Date.now()-zaman) > esikMs;
    });
    if(sehirFiltre) liste = liste.filter(function(m){ return (m.sehir||"").toLocaleLowerCase("tr-TR").indexOf(sehirFiltre) >= 0; });

    liste = liste.slice().sort(function(a,b){
      var fark = sonAktiviteZamani(a) - sonAktiviteZamani(b);
      return sirala === "yeniden-eskiye" ? -fark : fark;
    });

    var kapsayici = document.getElementById("tgListesi");
    var bos = document.getElementById("tgBosMesaj");
    if(liste.length === 0){
      kapsayici.innerHTML = "";
      bos.hidden = false;
      return;
    }
    bos.hidden = true;

    kapsayici.innerHTML = "<div class='tg-liste-kutu'>" + liste.map(function(m, i){
      var zaman = sonAktiviteZamani(m);
      var gunEtiket = zaman === 0 ? "Hiç ziyaret/işlem yok" : (Math.floor((Date.now()-zaman)/86400000) + " gün önce");
      return "<div class='tg-satir' data-i='" + i + "'>"
        + "<span class='tg-cari-metin'>" + cariSatirHTML(m.id, m.ad, m.sehir) + "</span>"
        + "<div class='tg-gun-etiket'>" + gunEtiket + "</div>"
        + "</div>";
    }).join("") + "</div>";

    kapsayici.querySelectorAll(".tg-satir").forEach(function(satir, i){
      satir.onclick = function(){
        CustomerData.sec(liste[i]);
        CustomerData.sonGoruntulendi(liste[i].ad);
        window.location.href = "home.html?musteriKart=" + encodeURIComponent(liste[i].id || "");
      };
    });
  }catch(e){ hataGoster("Liste çizilemedi: " + e.message); }
}

window.addEventListener("error", function(ev){
  hataGoster("HATA: " + ev.message + " (" + (ev.filename||"").split("/").pop() + ":" + ev.lineno + ")");
});

document.addEventListener("DOMContentLoaded", function(){
  tarihiGuncelle();
  var btnMenuEl = document.getElementById("btnMenu");
  if(btnMenuEl) btnMenuEl.onclick = function(){ window.location.href = "menu.html"; };
  document.getElementById("tgSehirFiltre").addEventListener("input", listeyiCiz);
  document.getElementById("tgSirala").addEventListener("change", listeyiCiz);
  CustomerData.listeDegistiginde(listeyiCiz);
  listeyiCiz();
});
