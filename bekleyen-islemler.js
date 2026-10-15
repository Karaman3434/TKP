/*
  bekleyen-islemler.js — WG.151026.1335.827
  ==========================================
  15.10.2026 (Abdullah onayı — mockup üzerinden onaylandı): "Beklet / Bekleyen
  İşlemler" — bir işlemin ortasındayken (örn. bir belgeyi görüntülerken) o işi
  kenara bırakıp başka bir işe geçebilme, sonra kaldığın yerden devam edebilme
  özelliği. Masaüstündeki "görev çubuğuna atma" mantığının karşılığı.

  MİMARİ: Bu dosya, her sayfada (foto-doldur.js ile AYNI paylaşılan-modül
  deseniyle) kendi kendine ".app-nav" içine (Geri/Ana Sayfa dikişinin tam
  üstüne) yuvarlak bir düğme + sayı rozeti enjekte eder. Düğmeye dokununca
  mevcut ".overlay"/".sheet" kalıbıyla bekleyen işlemler listesi açılır.

  VERİ MODELİ: localStorage["weiconv2_bekleyen_islemler"] — EN FAZLA 2
  kayıttan oluşan bir dizi (3. işlem = aktif olarak üzerinde çalıştığın,
  bekletilenler bunun DIŞINDAki en fazla 2 tanesi — Abdullah'ın isteğiyle).
  Her kayıt: {
    id: benzersiz string,
    baslik: örn. müşteri adı,
    altBaslik: örn. "SP.150926.1140 · 6 dk önce bekletildi" ÜRETİLİRKEN
               ayrı tutulur — burada sadece kodu saklıyoruz (altKod),
               "X dk önce" her açılışta zamana göre YENİDEN hesaplanır.
    altKod: örn. "SP.150926.1140",
    kisaKod: örn. "SP" (çip içinde görünen kısa harf),
    renkBg / renkYazi: çipin rengi (programdaki SP/FT/PF/NM renk sistemiyle
               BİREBİR aynı — bkz. belge-render.js ONEK_RENK_BELGE),
    url: devam edince gidilecek sayfa (örn. "belge-onizleme.html"),
    resumeKey: o sayfanın "hangi kaydı gösteriyorum" bilgisini tuttuğu
               localStorage anahtarı (örn. "weiconv2_goruntulenen_belge") —
               bekletirken bu anahtarın O ANKİ değeri saklanır, devam
               edince AYNEN geri yazılıp öyle gidilir. Sayfanın kendi
               yükleme mantığı (ne değişti, ne eklendi YOK) zaten bu
               anahtarı okuyup kaydı kendi çiziyor.
    resumeDeger: yukarıdaki anahtarın bekletme anındaki değeri,
    zaman: Date.now() (epoch ms)
  }

  KULLANIM (yeni bir sayfaya "Beklet" eklerken):
    BekleyenIslemler.ekle({
      baslik: "Akın Metal San. Tic. Ltd. Şti.",
      altKod: "SP.150926.1140",
      kisaKod: "SP", renkBg: "#eaf2fc", renkYazi: "#003a70",
      url: "belge-onizleme.html",
      resumeKey: "weiconv2_goruntulenen_belge"
    });
  — dönen {basarili, mesaj} değerine göre sayfa kendi butonunu/geri
  bildirimini gösterir (bkz. belge-render.js'teki btnBelgeBeklet).
*/
var BekleyenIslemler = (function(){
  var ANAHTAR = "weiconv2_bekleyen_islemler";
  var MAKS = 2;
  var elemanlarHazirMi = false;

  function oku(){
    try{
      var v = JSON.parse(localStorage.getItem(ANAHTAR) || "[]");
      return Array.isArray(v) ? v.slice(0, MAKS) : [];
    }catch(e){ return []; }
  }
  function yaz(liste){
    try{ localStorage.setItem(ANAHTAR, JSON.stringify(liste.slice(0, MAKS))); }catch(e){}
  }

  function ekle(gorev){
    var liste = oku();
    if(liste.length >= MAKS){
      return { basarili:false, mesaj:"En fazla " + MAKS + " işlem aynı anda bekletilebilir — devam etmek için önce birini tamamla ya da listeden kapat." };
    }
    var kayit = {
      id: "bi_" + Date.now() + "_" + Math.random().toString(36).slice(2,7),
      baslik: gorev.baslik || "",
      altKod: gorev.altKod || "",
      kisaKod: gorev.kisaKod || "",
      renkBg: gorev.renkBg || "#eef2f8",
      renkYazi: gorev.renkYazi || "#334155",
      url: gorev.url || "",
      resumeKey: gorev.resumeKey || "",
      resumeDeger: gorev.resumeKey ? localStorage.getItem(gorev.resumeKey) : null,
      zaman: Date.now()
    };
    liste.push(kayit);
    yaz(liste);
    guncelle();
    return { basarili:true, mesaj:"Bekletildi — " + MAKS + " işlemden " + liste.length + " tanesi dolu." };
  }

  function sil(id){
    var liste = oku().filter(function(k){ return k.id !== id; });
    yaz(liste);
    guncelle();
  }

  function devamEt(id){
    var liste = oku();
    var kayit = liste.find(function(k){ return k.id === id; });
    if(!kayit) return;
    sil(id);
    try{
      if(kayit.resumeKey){
        if(kayit.resumeDeger === null || kayit.resumeDeger === undefined){
          localStorage.removeItem(kayit.resumeKey);
        } else {
          localStorage.setItem(kayit.resumeKey, kayit.resumeDeger);
        }
      }
    }catch(e){}
    window.location.href = kayit.url || "home.html";
  }

  function dakikaOnceMetni(zamanMs){
    var fark = Math.max(0, Date.now() - zamanMs);
    var dk = Math.round(fark / 60000);
    if(dk < 1) return "az önce";
    if(dk < 60) return dk + " dk önce";
    var saat = Math.round(dk / 60);
    if(saat < 24) return saat + " sa önce";
    var gun = Math.round(saat / 24);
    return gun + " gün önce";
  }

  function htmlEscBi(s){
    return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  function satirHtml(kayit){
    return "<div class='bi-sheet-satir' data-id='" + kayit.id + "'>"
      + "<div class='bi-sheet-tip-cip' style='background:" + kayit.renkBg + ";color:" + kayit.renkYazi + ";'>" + htmlEscBi(kayit.kisaKod) + "</div>"
      + "<div class='bi-sheet-govde'>"
        + "<div class='bi-sheet-musteri'>" + htmlEscBi(kayit.baslik || "-") + "</div>"
        + "<div class='bi-sheet-detay'>" + htmlEscBi(kayit.altKod) + (kayit.altKod ? " · " : "") + dakikaOnceMetni(kayit.zaman) + " bekletildi</div>"
      + "</div>"
      + "<button type='button' class='bi-sheet-sil' data-sil-id='" + kayit.id + "'>✕</button>"
      + "</div>";
  }

  function sheetIcerikDoldur(){
    var liste = oku();
    var govde = document.getElementById("biSheetGovde");
    var baslik = document.getElementById("biSheetBaslik");
    if(!govde || !baslik) return;
    baslik.textContent = "Bekleyen İşlemler (" + liste.length + "/" + MAKS + ")";
    if(!liste.length){
      govde.innerHTML = "<div class='bi-sheet-bos'>Şu an bekleyen bir işlemin yok.</div>";
      return;
    }
    govde.innerHTML = liste.map(satirHtml).join("");
    govde.querySelectorAll("[data-id]").forEach(function(satirEl){
      satirEl.addEventListener("click", function(ev){
        if(ev.target.closest("[data-sil-id]")) return;
        devamEt(satirEl.getAttribute("data-id"));
      });
    });
    govde.querySelectorAll("[data-sil-id]").forEach(function(btn){
      btn.addEventListener("click", function(ev){
        ev.stopPropagation();
        sil(btn.getAttribute("data-sil-id"));
        sheetIcerikDoldur();
      });
    });
  }

  function guncelle(){
    if(!elemanlarHazirMi) return;
    var liste = oku();
    var dugme = document.getElementById("biNavBtn");
    var sayi = document.getElementById("biNavSayi");
    if(!dugme || !sayi) return;
    if(liste.length > 0){
      dugme.hidden = false;
      sayi.textContent = liste.length;
    } else {
      dugme.hidden = true;
      var ovl = document.getElementById("biSheetOverlay");
      if(ovl) ovl.hidden = true;
    }
    sheetIcerikDoldur();
  }

  function elOlustur(){
    if(elemanlarHazirMi) return;
    var nav = document.querySelector(".app-nav");
    if(!nav){ elemanlarHazirMi = false; return; }
    var dugmeSarmal = document.createElement("div");
    dugmeSarmal.innerHTML = "<button type='button' class='bi-nav-btn' id='biNavBtn' title='Bekleyen İşlemler' hidden>📥<span class='bi-nav-sayi' id='biNavSayi'>0</span></button>";
    nav.appendChild(dugmeSarmal.firstChild);

    var sheetSarmal = document.createElement("div");
    sheetSarmal.innerHTML =
      "<div class='overlay' id='biSheetOverlay' hidden>" +
        "<div class='sheet'>" +
          "<div class='sheet-baslik' id='biSheetBaslik'>Bekleyen İşlemler (0/" + MAKS + ")</div>" +
          "<div class='sheet-alt'>Bir işlemi bekletip başka bir işe geçebilirsin — en fazla " + MAKS + " işlem aynı anda bekletilebilir. Birine dokunarak kaldığın yerden devam et.</div>" +
          "<div id='biSheetGovde'></div>" +
          "<button class='sheet-secenek sheet-secenek--vazgec' type='button' id='biSheetKapat'>Kapat</button>" +
        "</div>" +
      "</div>";
    document.body.appendChild(sheetSarmal.firstChild);

    document.getElementById("biNavBtn").onclick = function(){
      sheetIcerikDoldur();
      document.getElementById("biSheetOverlay").hidden = false;
    };
    document.getElementById("biSheetKapat").onclick = function(){
      document.getElementById("biSheetOverlay").hidden = true;
    };
    elemanlarHazirMi = true;
    guncelle();
  }

  function baslat(){
    if(document.readyState === "loading"){
      document.addEventListener("DOMContentLoaded", elOlustur);
    } else {
      elOlustur();
    }
  }
  baslat();

  return { ekle: ekle, sil: sil, devamEt: devamEt, listele: oku, guncelle: guncelle };
})();
