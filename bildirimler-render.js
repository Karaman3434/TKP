/*
  bildirimler-render.js
  ======================
  Eski uygulamanın bildirimListesiAc() ile BİREBİR aynı 3 bölüm:
  ▶️ Açık Süreçler, 📆 Ziyaret Hatırlatmaları, 📌 Görevler.
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

var TIP_ETIKET_B = {teklif:"FİYAT TEKLİFİ", proforma:"PROFORMA", numune:"NUMUNE"};
var SEVIYE_ETIKET = {ilk:"⏳ 15+ gün", ikinci:"⚠️ 30+ gün", kritik:"🔴 33+ gün — İNCELE"};
var SEVIYE_RENK = {ilk:"#f2994a", ikinci:"#e0524a", kritik:"#c0392b"};
var TIP_KOD_RENK = {siparis:"#003a70", teklif:"#1a7431", proforma:"#5c1680", numune:"#7a4008"};
var KANAL_HARF = {mail:"M", whatsapp:"W"};
var KANAL_RENK = {mail:"#185fa5", whatsapp:"#128C7E"};
function kanalHarfHTML(kanal){
  if(!kanal || !KANAL_HARF[kanal]) return "";
  return "<span style='color:" + KANAL_RENK[kanal] + ";'>" + KANAL_HARF[kanal] + "</span>";
}
function fmt(n){
  return (n||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2});
}
function cariSatirHTML(kod, isim, sehir){
  return "<span class='cari-kod'>" + htmlEsc(kod||"—") + "</span>"
    + "<span class='cari-ayrac'> - </span>"
    + "<span class='cari-isim'>" + htmlEsc(isim||"") + "</span>"
    + (sehir ? "<span class='cari-ayrac'> - </span><span class='cari-sehir'>" + htmlEsc(sehir) + "</span>" : "");
}
var TIP_ETIKET_B = {numune:"Numune", teklif:"Teklif", proforma:"Proforma", siparis:"Sipariş"};

function ilerletTiklandi(b){
  try{
    var tumu = ReportsData.sonIslemler();
    var k = tumu.find(function(x){ return x.tip===b.tip && x.ts===b.ts; });
    if(!k){ hataGoster("Kayıt bulunamadı."); return; }
    var secenekler = ReportsData.SONRAKI_ASAMALAR[k.tip];
    if(!secenekler) return;
    var etiketler = secenekler.map(function(s){ return TIP_ETIKET_B[s]; }).join(" veya ");
    if(!confirm(k.musteri + " için " + (k.urunler||[]).length + " ürün düzenlenmek üzere Sepet'e yüklenecek" + (secenekler.length>1 ? " (Gönder'de " + etiketler + " seçebileceksin)." : (" ve " + etiketler + " olarak ilerletilecek.")) + " Devam edilsin mi?")) return;
    ReportsData.revizeBaslat(k);
  }catch(e){ hataGoster("İlerletilemedi: " + e.message); }
}

function acikSureciSil(tip, ts){
  if(!confirm("Bu kayıt silinsin mi? Bu işlem geri alınamaz.")) return;
  ReportsData.kaydiSil(tip, ts, function(basarili, err){
    if(basarili){
      alert("✓ Kayıt silindi.");
      bildirimleriCiz();
    } else {
      hataGoster("Silinemedi: " + (err && err.message ? err.message : "bilinmeyen hata"));
    }
  });
}

function bildirimleriCiz(){
  try{
    var acikListe = ReportsData.acikSurecleriHesapla();
    var beklemedeListe = ReportsData.beklemedeSiparisleriHesapla().filter(function(b){ return b.gun>=3; });
    var ziyaretListe = CustomerData.ziyaretHatirlatmalari().filter(function(z){ return !z.hicZiyaretYok && z.gun>=15; });
    var gorevListe = ReportsData.gorevleriGetir().filter(function(g){ return !g.tamamlandi; });

    var html = "";

    if(beklemedeListe.length > 0){
      html += "<div class='bildirim-bolum-baslik'>⏳ Stok Bekleyen Siparişler</div>";
      beklemedeListe.forEach(function(b){
        html += "<div class='beklemede-hatirlat-karti' data-ts='" + b.ts + "'>"
          + "<div class='acik-surec-ust'>"
          + "<div class='acik-surec-musteri'>" + cariSatirHTML(b.musteriId, b.musteri, b.sehir) + "</div>"
          + "<div class='acik-surec-seviye' style='color:#854f0b;'>" + b.gun + " gündür</div>"
          + "</div>"
          + "<div class='acik-surec-detay'>"
          + "<span style='font-weight:800;color:#003a70;'>" + kanalHarfHTML(b.kanal) + htmlEsc(b.kod||"Sipariş") + "</span>"
          + " · <b>" + fmt(b.tutar) + " EURO</b> stok bekliyor</div>"
          + (b.beklemedeNot ? "<div class='beklemede-hatirlat-not'>" + htmlEsc(b.beklemedeNot) + "</div>" : "")
          + "</div>";
      });
    }

    if(acikListe.length > 0){
      html += "<div class='bildirim-bolum-baslik'>▶️ Açık Süreçler</div>";
      acikListe.forEach(function(b){
        var veri = htmlEsc(JSON.stringify({tip:b.tip, ts:b.ts, musteri:b.musteri, kod:(b.kod||TIP_ETIKET_B[b.tip]), tutar:b.tutar, gun:b.gun, kritik:b.seviye==="kritik"}));
        html += "<div class='acik-surec-satir' style='border-left:4px solid " + SEVIYE_RENK[b.seviye] + ";' data-veri='" + veri + "'>"
          + "<span class='as-kod'>" + htmlEsc(b.musteriId||"") + "</span>"
          + "<span class='as-firma'>" + htmlEsc(b.musteri) + "</span>"
          + "<span class='as-sep'>·</span>"
          + "<span class='as-islem-no tiklanabilir-bilgi' data-belge-tip='" + b.tip + "' data-belge-ts='" + b.ts + "'>" + htmlEsc(b.kod||TIP_ETIKET_B[b.tip]) + " ↗</span>"
          + "<span class='as-gun'>" + b.gun + " gün önce</span>"
          + "<span class='as-ok'>›</span>"
          + "</div>";
      });
    }

    if(ziyaretListe.length > 0){
      html += "<div class='bildirim-bolum-baslik'>📆 Ziyaret Hatırlatmaları</div>";
      ziyaretListe.forEach(function(z){
        html += "<div class='ziyaret-hatirlat-karti' data-musteri='" + htmlEsc(z.musteri) + "'>"
          + "<div class='ziyaret-hatirlat-musteri'>" + cariSatirHTML(z.musteriId, z.musteri, z.sehir) + "</div>"
          + "<div class='ziyaret-hatirlat-sag'><span class='ziyaret-hatirlat-gun'>" + z.gun + " gündür yok</span>"
          + "<span class='ziyaret-hatirlat-ok'><svg width='8' height='12' viewBox='0 0 20 32' fill='none'><path d='M4 4 L16 16 L4 28' stroke='#e24b4a' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/></svg></span></div>"
          + "</div>";
      });
    }

    if(gorevListe.length > 0){
      html += "<div class='bildirim-bolum-baslik'>📌 Görevler</div>";
      gorevListe.forEach(function(g){
        var m = CustomerData.musteriBul(g.musteriAd);
        html += "<div class='gorev-bildirim-karti'>"
          + "<div class='gorev-bildirim-musteri'>" + cariSatirHTML(m?m.id:null, g.musteriAd, m?m.sehir:"") + "</div>"
          + "<div class='gorev-bildirim-aciklama'>" + htmlEsc(g.aciklama) + "</div>"
          + "<div class='gorev-bildirim-buton-satir'>"
          + "<button class='gorev-tamamla-btn' data-gorev-id='" + htmlEsc(g.id) + "'>✓ Tamamlandı</button>"
          + "<button class='gorev-musteriye-git-btn' data-musteri='" + htmlEsc(g.musteriAd) + "' data-musteri-id='" + htmlEsc(g.musteriId||"") + "'>🔍 Müşteriye Git</button>"
          + "</div>"
          + "</div>";
      });
    }

    var icerik = document.getElementById("bildirimIcerik");
    var bos = document.getElementById("bildirimBosMesaj");
    if(!html){
      icerik.innerHTML = "";
      bos.hidden = false;
      return;
    }
    bos.hidden = true;
    icerik.innerHTML = html;

    icerik.querySelectorAll(".beklemede-hatirlat-karti").forEach(function(kart){
      kart.onclick = function(){
        localStorage.setItem("weiconv2_goruntulenen_belge", JSON.stringify({tip:"siparis", ts: parseFloat(this.getAttribute("data-ts"))}));
        window.location.href = "belge-onizleme.html";
      };
    });
    // Açık Süreçler satırı (23.09.2026): işlem no'ya (mavi/altı çizgili/↗)
    // dokununca doğrudan o belgenin gerçek tablosu açılır; satırın geri
    // kalanına dokununca tutar + İlerlet/Sil'in olduğu detay penceresi
    // açılır — işlem no orada da aynı şekilde tıklanabilir.
    function belgeyiAc(tip, ts){
      localStorage.setItem("weiconv2_goruntulenen_belge", JSON.stringify({tip:tip, ts:parseFloat(ts)}));
      window.location.href = "belge-onizleme.html";
    }
    icerik.querySelectorAll(".as-islem-no").forEach(function(el){
      el.onclick = function(ev){
        ev.stopPropagation();
        belgeyiAc(this.getAttribute("data-belge-tip"), this.getAttribute("data-belge-ts"));
      };
    });
    icerik.querySelectorAll(".acik-surec-satir").forEach(function(satir){
      satir.onclick = function(){
        var veri = JSON.parse(this.getAttribute("data-veri"));
        document.getElementById("sdBaslik").textContent = veri.musteri;
        var kodLink = document.getElementById("sdKodLink");
        kodLink.textContent = (veri.kod||"") + " ↗";
        document.getElementById("sdTutar").textContent = fmt(veri.tutar) + " EURO";
        document.getElementById("sdSure").textContent = veri.gun + " gün önce";
        document.getElementById("sdIlerlet").onclick = function(){ ilerletTiklandi({tip:veri.tip, ts:veri.ts}); };
        var sdSil = document.getElementById("sdSil");
        sdSil.hidden = !veri.kritik;
        sdSil.onclick = function(){ acikSureciSil(veri.tip, veri.ts); };
        kodLink.onclick = function(){ belgeyiAc(veri.tip, veri.ts); };
        document.getElementById("surecDetayOverlay").hidden = false;
      };
    });
    document.getElementById("sdKapat").onclick = function(){ document.getElementById("surecDetayOverlay").hidden = true; };
    icerik.querySelectorAll(".ziyaret-hatirlat-karti").forEach(function(kart){
      kart.onclick = function(){
        var musteri = CustomerData.musteriBul(this.getAttribute("data-musteri"));
        if(musteri) CustomerData.sec(musteri);
        window.location.href = "customer-detail.html";
      };
    });
    icerik.querySelectorAll(".gorev-tamamla-btn").forEach(function(btn){
      btn.onclick = function(){
        ReportsData.gorevTamamlandiToggle(this.getAttribute("data-gorev-id"));
        setTimeout(bildirimleriCiz, 300);
      };
    });
    icerik.querySelectorAll(".gorev-musteriye-git-btn").forEach(function(btn){
      btn.onclick = function(){
        var id = this.getAttribute("data-musteri-id");
        var musteri = (id && CustomerData.musteriIdIleBul) ? CustomerData.musteriIdIleBul(id) : null;
        if(!musteri) musteri = CustomerData.musteriBul(this.getAttribute("data-musteri"));
        if(musteri) CustomerData.sec(musteri);
        window.location.href = "customer-detail.html";
      };
    });
  }catch(e){ hataGoster("Bildirimler çizilemedi: " + e.message); }
}

window.addEventListener("error", function(ev){
  hataGoster("HATA: " + ev.message + " (" + (ev.filename||"").split("/").pop() + ":" + ev.lineno + ")");
});

document.addEventListener("DOMContentLoaded", function(){
  tarihiGuncelle();
  var btnMenuEl = document.getElementById("btnMenu");
  if(btnMenuEl) btnMenuEl.onclick = function(){ window.location.href = "menu.html"; };
  ReportsData.arsivDegistiginde(bildirimleriCiz);
  ReportsData.gorevDegistiginde(bildirimleriCiz);
  CustomerData.listeDegistiginde(bildirimleriCiz);
  bildirimleriCiz();
});
