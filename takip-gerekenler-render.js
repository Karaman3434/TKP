// takip-gerekenler-render.js — TKP.10.11.26-18:04.1558
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

// 10.11.2026: son aktivite hesabı ve 30 gün kuralı artık TEK KAYNAKTA (takip-ozet-data.js
// → TakipOzet); Ana Sayfa "Ziyaret ve Ödeme Takip" butonu da aynı kuralı kullanır.
var musteriSonIslemHaritasi = null;
function sonIslemHaritasiniHazirla(){
  musteriSonIslemHaritasi = TakipOzet.sonIslemHaritasi();
}
function sonAktiviteZamani(m){
  return TakipOzet.sonAktiviteZamani(m, musteriSonIslemHaritasi);
}

function listeyiCiz(){
  try{
    sonIslemHaritasiniHazirla();
    var sehirFiltre = (document.getElementById("tgSehirFiltre").value||"").toLocaleLowerCase("tr-TR");
    var sirala = document.getElementById("tgSirala").value;

    var liste = TakipOzet.ziyaretBekleyenler();
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
  // 10.11.2026: işlem arşivi sonradan gelirse liste (ve Ana Sayfa sayısıyla tutarlılık) tazelensin
  if(typeof ReportsData !== "undefined" && ReportsData.arsivDegistiginde) ReportsData.arsivDegistiginde(listeyiCiz);
  listeyiCiz();
});
