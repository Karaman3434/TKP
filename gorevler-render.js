/*
  gorevler-render.js
  ===================
  reports-render.js'in Görevler bölümünden çıkarıldı — artık kendi ayrı
  sayfası var (eski uygulamadaki "GÖREVLERİM" kutucuğuyla aynı rota).
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

function htmlEsc(s){
  return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function cariSatirHTML(kod, isim, sehir){
  return "<span class='cari-kod'>" + htmlEsc(kod||"—") + "</span>"
    + "<span class='cari-ayrac'> - </span>"
    + "<span class='cari-isim'>" + htmlEsc(isim||"") + "</span>"
    + (sehir ? "<span class='cari-ayrac'> - </span><span class='cari-sehir'>" + htmlEsc(sehir) + "</span>" : "");
}

function gorevleriCiz(){
  try{
    var q = (document.getElementById("gorevAra").value||"").trim().toLocaleLowerCase("tr-TR");
    var liste = ReportsData.gorevleriGetir();
    if(q){
      liste = liste.filter(function(g){
        return (g.musteriAd||"").toLocaleLowerCase("tr-TR").indexOf(q)>=0
            || (g.aciklama||"").toLocaleLowerCase("tr-TR").indexOf(q)>=0;
      });
    }
    var kapsayici = document.getElementById("gorevListesiKapsayici");
    var bos = document.getElementById("gorevBosMesaj");

    if(liste.length === 0){
      kapsayici.innerHTML = "";
      bos.hidden = false;
      return;
    }
    bos.hidden = true;

    kapsayici.innerHTML = liste.map(function(g){
      var m = null;
      if(typeof CustomerData !== "undefined"){
        m = (g.musteriId && CustomerData.musteriIdIleBul) ? CustomerData.musteriIdIleBul(g.musteriId) : null;
        if(!m) m = CustomerData.musteriBul(g.musteriAd);
      }
      return "<div class='gorev-karti" + (g.tamamlandi?" tamamlandi":"") + "'>"
        + "<input type='checkbox' class='gorev-checkbox' data-id='" + g.id + "' " + (g.tamamlandi?"checked":"") + ">"
        + "<div class='gorev-bilgi'>"
        + "<div class='gorev-musteri'>" + cariSatirHTML(m?m.id:null, g.musteriAd, m?m.sehir:"") + "</div>"
        + "<div class='gorev-aciklama'>" + htmlEsc(g.aciklama) + "</div>"
        + "<div class='gorev-zaman'>" + htmlEsc(g.tarih||"") + " " + htmlEsc(g.saat||"") + "</div>"
        + "</div>"
        + "</div>";
    }).join("");

    kapsayici.querySelectorAll(".gorev-checkbox").forEach(function(cb){
      cb.onchange = function(){
        ReportsData.gorevTamamlandiToggle(this.getAttribute("data-id"));
      };
    });
  }catch(e){ hataGoster("Görevler çizilemedi: " + e.message); }
}

function gorevEkleTiklandi(){
  try{
    var musteri = document.getElementById("gorevMusteri").value.trim();
    var aciklama = document.getElementById("gorevAciklama").value.trim();
    var tarih = document.getElementById("gorevTarih").value;
    var saat = document.getElementById("gorevSaat").value;
    if(!musteri || !aciklama){
      hataGoster("Müşteri/konu ve açıklama girin.");
      return;
    }
    ReportsData.gorevEkle(musteri, aciklama, tarih, saat);
    document.getElementById("gorevMusteri").value = "";
    document.getElementById("gorevAciklama").value = "";
  }catch(e){ hataGoster("Görev eklenemedi: " + e.message); }
}

window.addEventListener("error", function(ev){
  hataGoster("HATA: " + ev.message + " (" + (ev.filename||"").split("/").pop() + ":" + ev.lineno + ")");
});

document.addEventListener("DOMContentLoaded", function(){
  tarihiGuncelle();
  var btnMenuEl = document.getElementById("btnMenu");
  if(btnMenuEl) btnMenuEl.onclick = function(){ window.location.href = "menu.html"; };
  document.getElementById("btnGorevEkle").onclick = gorevEkleTiklandi;

  var bugun = new Date();
  document.getElementById("gorevTarih").value = bugun.toISOString().slice(0,10);

  document.getElementById("gorevAra").addEventListener("input", gorevleriCiz);
  // 21.11.2026 inceleme düzeltmesi: ReportsData'da bu fonksiyon yok — varsa bağla, yoksa hata verme
  if(typeof ReportsData.gorevDegistiginde === "function") ReportsData.gorevDegistiginde(gorevleriCiz);
  gorevleriCiz();
});
