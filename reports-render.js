/*
  reports-render.js — TKP.11.11.26-11:18.1564
  =================
  Sadece Aylık Sipariş & Prim Özeti (son 12 ay) tablosunu çizer. Bir aya
  dokununca artık aynı sayfada açılmıyor — ay-detay.html'e yönlendirir
  (bkz. ay-detay-render.js). "Bu Ay/Geçen Ay Toplam" kartları ve Son
  İşlemler listesi de artık bu sayfada yok (son-islemler.html'de).
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

function fmt(n){
  return (n||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2});
}

function ayinaGit(ayVerisi){
  try{
    localStorage.setItem("weiconv2_goruntulenen_ay", JSON.stringify(ayVerisi));
    window.location.href = "ay-detay.html";
  }catch(e){ hataGoster("Ay detayına gidilemedi: " + e.message); }
}

function istatistikleriCiz(){
  try{
    var ozet = ReportsData.aylikPrimOzeti12();
    var genelToplam=0, genelToplamTl=0, genelPrim=0, genelPrimTl=0;
    document.getElementById("istAylikListe").innerHTML = ozet.aylar.map(function(a, i){
      genelToplam += a.toplam; genelToplamTl += a.toplamTl; genelPrim += a.prim; genelPrimTl += a.primTl;
      var mevcutAySinifi = i===0 ? " aylik-ozet-satir--mevcut-ay" : "";
      return "<tr class='" + mevcutAySinifi.trim() + "'>"
        + "<td class='aylik-ozet-ay-hucre'>" + a.ayAd + " " + a.yil + "</td>"
        + "<td>" + fmt(a.toplam) + " EURO</td>"
        + "<td class='aylik-ozet-satirtl-hucre'>" + fmt(a.toplamTl) + " ₺</td>"
        + "<td class='aylik-ozet-prim-hucre'>" + fmt(a.prim) + " EURO</td>"
        + "<td class='aylik-ozet-primtl-hucre'>" + fmt(a.primTl) + " ₺</td>"
        + "</tr>";
    }).join("");
    document.getElementById("istAylikGenelToplam").textContent = fmt(genelToplam) + " EURO";
    document.getElementById("istAylikGenelPrim").textContent = fmt(genelPrim) + " EURO";
    document.getElementById("istAylikGenelPrimTl").textContent = fmt(genelPrimTl) + " ₺";
    var kurNotuEl = document.getElementById("istAylikKurNotu");
    if(ozet.kur){
      kurNotuEl.className = "aylik-ozet-kur-notu";
      kurNotuEl.textContent = "Her kayıt kendi işlem gününün kuruyla hesaplanır; kuru eksik olan eski kayıtlarda yedek olarak bugünün kuru (1 EURO = " + fmt(ozet.kur) + " ₺) kullanılır.";
    } else {
      kurNotuEl.className = "aylik-ozet-kur-notu aylik-ozet-kur-notu--hata";
      kurNotuEl.textContent = "⚠️ Güncel kur bulunamadı, TL Prim hesaplanamadı";
    }

    document.getElementById("istAylikListe").querySelectorAll("tr").forEach(function(tr, i){
      tr.onclick = function(){ ayinaGit(ozet.aylar[i]); };
    });
  }catch(e){ hataGoster("İstatistikler çizilemedi: " + e.message); }
}

window.addEventListener("error", function(ev){
  hataGoster("HATA: " + ev.message + " (" + (ev.filename||"").split("/").pop() + ":" + ev.lineno + ")");
});

document.addEventListener("DOMContentLoaded", function(){
  tarihiGuncelle();
  var btnMenuEl = document.getElementById("btnMenu");
  if(btnMenuEl) btnMenuEl.onclick = function(){ window.location.href = "menu.html"; };
  (function(){
    var btn = document.getElementById("btnGeriAkilli");
    // (05.11.2026, Abdullah onayı): Geri = menüdeki Raporlar sekmesi
    // (home.html?menu=raporlar) — eski raporlar.html artık kullanılmıyor.
    // 11.11.2026: Geri ortak Nav'da; Raporlar alt menüsüne dönüş bilgisi data-geri-href ile korunur.
    if(btn) btn.setAttribute("data-geri-href", "home.html?menu=raporlar");
  })();

  ReportsData.arsivDegistiginde(function(){ istatistikleriCiz(); });
  istatistikleriCiz();
});
