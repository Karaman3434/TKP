/*
  bekleyen-islemler.js — WG.221026.1245.949
  ==========================================
  15.10.2026 (Abdullah onayı — mockup üzerinden onaylandı; "istisnasız tüm
  sayfalar" talebiyle genişletildi): "Beklet / Bekleyen İşlemler" — bir
  işin ortasındayken o işi kenara bırakıp başka bir işe geçebilme, sonra
  kaldığın yerden devam edebilme özelliği. Masaüstündeki "görev çubuğuna
  atma" mantığının karşılığı.

  MİMARİ: Bu dosya, her sayfada (foto-doldur.js ile AYNI paylaşılan-modül
  deseniyle) kendi kendine ".app-nav" içine (Geri/Ana Sayfa dikişinin tam
  üstüne) yuvarlak bir düğme + sayı rozeti enjekte eder. Düğmeye dokununca
  TEK bir sheet içinde HEM "⏸ Bu sayfayı beklet" eylemi HEM bekleyen
  işlemler listesi birlikte görünür — bu sayede her sayfaya ayrı ayrı
  "Beklet" butonu YERLEŞTİRMEYE gerek kalmadan (sayfa düzenleri çok
  farklı olduğu için riskli olurdu), SADECE bu iki dosyayı (css+js)
  yükleyen HER sayfa otomatik olarak tam "Beklet" yeteneği kazanır.

  ÖZEL DURUM — Belge Önizleme (belge-onizleme.html): o sayfanın KENDİ,
  belge türüne göre renklenen (SP/FT/PF/NM) özel bir "⏸ Beklet" düğmesi
  zaten var (alt buton satırında, mockup'ta onaylandığı gibi) — bu yüzden
  o sayfa "window.BEKLEYEN_ISLEM_GENERIK_KAPALI = true" ile BU dosyanın
  genel "Bu sayfayı beklet" seçeneğini gizler (aynı işin iki farklı
  yerden, karışık şekilde yapılmasın diye) — liste/rozet/devam etme yine
  AYNI paylaşılan mekanizmadan çalışır, sadece EKLEME YOLU o sayfada
  kendine özel.

  SAYFAYA ÖZEL AYAR (opsiyonel) — bir sayfa, "Bu sayfayı beklet" ile
  eklenecek kaydın başlığını/rengini/hangi localStorage anahtarının
  saklanıp geri yükleneceğini özelleştirmek isterse, bekleyen-islemler.js
  YÜKLENMEDEN ÖNCE şunu tanımlar:
    window.BEKLEYEN_ISLEM_AYAR = {
      baslik: function(){ return "..."; },  // fonksiyon ya da düz metin
      kisaKod: "MÜ", renkBg: "#e6f7f5", renkYazi: "#0c6e63",
      resumeKey: "weicon_secili_musteri"     // o sayfanın "hangi kaydı
                                              // gösteriyorum" anahtarı
    };
  Hiçbir ayar verilmezse akıllı varsayılan kullanılır: başlık = sayfa
  başlığı (document.title, "WEICON ASİST — " öneki temizlenmiş), nötr
  gri çip, resumeKey YOK (devam edince sadece o sayfaya gidilir).

  VERİ MODELİ: localStorage["weiconv2_bekleyen_islemler"] — EN FAZLA 2
  kayıt (3. işlem = aktif olarak üzerinde çalıştığın, bekletilenler
  bunun DIŞINDAki en fazla 2 tanesi — Abdullah'ın isteğiyle). Her kayıt:
  { id, baslik, altKod, kisaKod, renkBg, renkYazi, url, resumeKey,
    resumeDeger, zaman }. Aynı url+resumeKey+resumeDeger'e sahip bir
    kayıt zaten varsa TEKRAR eklenmez (yinelenen bekletme engellenir).

  KULLANIM (belge-onizleme.html gibi kendi özel düğmesi olan bir sayfada):
    BekleyenIslemler.ekle({ baslik:"...", altKod:"...", kisaKod:"SP",
      renkBg:"...", renkYazi:"...", url:"belge-onizleme.html",
      resumeKey:"weiconv2_goruntulenen_belge" });
  — dönen {basarili, mesaj} değerine göre sayfa kendi geri bildirimini
  gösterir.
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
    var yeniResumeDeger = gorev.resumeKey ? localStorage.getItem(gorev.resumeKey) : null;
    var zatenVarMi = liste.some(function(k){
      return k.url === gorev.url && (k.resumeKey||"") === (gorev.resumeKey||"") && (k.resumeDeger||"") === (yeniResumeDeger||"");
    });
    if(zatenVarMi){
      return { basarili:false, mesaj:"Bu zaten bekleyen işlemler listende." };
    }
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
      resumeDeger: yeniResumeDeger,
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

  // Sayfa adını temizler: "WEICON ASİST — Cari Kart" -> "Cari Kart".
  function temizSayfaAdi(){
    var t = document.title || "";
    return t.replace(/^WEICON ASİST\s*[—-]\s*/, "") || t || "Bu sayfa";
  }

  function dosyaAdi(){
    var yol = window.location.pathname.split("/");
    return yol[yol.length - 1] || "home.html";
  }

  // "Bu sayfayı beklet" — sayfaya özel ayar varsa onu kullanır, yoksa
  // akıllı varsayılanla (sayfa başlığı, nötr gri çip, resumeKey yok)
  // bekletir. Beklettikten sonra, "başka bir işe geçebilesin" diye Ana
  // Sayfa'ya yönlendirir (Belge Önizleme'nin kendi özel düğmesiyle AYNI
  // mantık — bekletmek = buradan ayrılmak demek).
  function buSayfayiBeklet(){
    var ayar = window.BEKLEYEN_ISLEM_AYAR || {};
    var baslik = typeof ayar.baslik === "function" ? ayar.baslik() : (ayar.baslik || temizSayfaAdi());
    var sonuc = ekle({
      baslik: baslik,
      altKod: ayar.altKod || "",
      kisaKod: ayar.kisaKod || "•",
      renkBg: ayar.renkBg || "#eef2f8",
      renkYazi: ayar.renkYazi || "#334155",
      url: ayar.url || dosyaAdi(),
      resumeKey: ayar.resumeKey || ""
    });
    if(!sonuc.basarili){
      biMesajGoster(sonuc.mesaj);
      return;
    }
    window.location.href = "home.html";
  }

  function biMesajGoster(mesaj){
    var kutu = document.createElement("div");
    kutu.textContent = "⚠️ " + mesaj;
    kutu.style.cssText = "position:fixed;top:8px;left:8px;right:8px;background:#c0392b;color:#fff;padding:10px;border-radius:8px;font-size:13px;z-index:99999;";
    document.body.appendChild(kutu);
    setTimeout(function(){ kutu.remove(); }, 4000);
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
    var sayi = document.getElementById("biNavSayi");
    if(sayi){
      if(liste.length > 0){ sayi.hidden = false; sayi.textContent = liste.length; }
      else { sayi.hidden = true; }
    }
    sheetIcerikDoldur();
  }

  function elOlustur(){
    if(elemanlarHazirMi) return;
    var nav = document.querySelector(".app-nav");
    if(!nav){ return; }
    var dugmeSarmal = document.createElement("div");
    dugmeSarmal.innerHTML = "<button type='button' class='bi-nav-btn' id='biNavBtn' title='Beklet / Bekleyen İşlemler'>📥<span class='bi-nav-sayi' id='biNavSayi' hidden>0</span></button>";
    nav.appendChild(dugmeSarmal.firstChild);

    var genericKapali = window.BEKLEYEN_ISLEM_GENERIK_KAPALI === true;
    var sheetSarmal = document.createElement("div");
    sheetSarmal.innerHTML =
      "<div class='bi-overlay' id='biSheetOverlay' hidden>" +
        "<div class='bi-sheet'>" +
          "<div class='bi-sheet-baslik' id='biSheetBaslik'>Bekleyen İşlemler (0/" + MAKS + ")</div>" +
          "<div class='bi-sheet-alt'>Bir işi bekletip başka bir işe geçebilirsin — en fazla " + MAKS + " işlem aynı anda bekletilebilir. Birine dokunarak kaldığın yerden devam et.</div>" +
          (genericKapali ? "" : "<button type='button' class='bi-sheet-secenek' id='biSayfayiBekletBtn'><span style='font-size:18px;'>⏸</span>Bu sayfayı beklet</button>") +
          "<div id='biSheetGovde'></div>" +
          "<button class='bi-sheet-secenek bi-sheet-secenek--vazgec' type='button' id='biSheetKapat'>Kapat</button>" +
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
    if(!genericKapali){
      document.getElementById("biSayfayiBekletBtn").onclick = buSayfayiBeklet;
    }
    elemanlarHazirMi = true;
    guncelle();
  }

  // EKLENDİ (22.10.2026, Abdullah'ın isteğiyle): "Beklet" düğmesi önce
  // SADECE cart.html'de kısıtlanabiliyordu; şimdi Abdullah'ın isteğiyle
  // HER sayfa alanında AYRI AYRI kısıtlanabilsin diye genelleştirildi.
  // Aşağıdaki harita, auth.js'teki SAYFA_IZIN_ANAHTARI'nın AYNISI (hangi
  // dosya hangi "alan"a ait) — ama kısıtlı kullanıcı o sayfaya zaten
  // giremiyorsa bu harita hiç devreye girmez, sadece "sayfaya girebilen
  // ama Beklet'i görmemeli" durumunu ayırt etmek için var. cart.html/
  // belge-onizleme.html İSTİSNA: onlar zaten var olan "sepetBekletGoster"
  // anahtarını (bkz. cihaz-kullanici-render.js İZIN_TANIMLARI, "🛒 Sayfası
  // İçin İnce Ayar" grubu) kullanmaya devam ediyor — yeni bir anahtara
  // TAŞINMADI, aksi hâlde önceden kaydedilmiş kısıtlamalar sessizce
  // geçersiz kalırdı. Haritada OLMAYAN bir sayfa (ör. ileride eklenecek
  // yeni bir sayfa) için Beklet her zaman AÇIK kalır (güvenli varsayılan).
  var BI_SAYFA_BEKLET_ANAHTARI = {
    "calc.html": "bekletHesapla",
    "cart.html": "sepetBekletGoster",
    "belge-onizleme.html": "sepetBekletGoster",
    "send.html": "bekletGonder",
    "customer.html": "bekletMusteri",
    "customer-hub.html": "bekletMusteri",
    "customer-detail.html": "bekletMusteri",
    "customer-cari-kart.html": "bekletMusteri",
    "customer-temas.html": "bekletMusteri",
    "customer-add.html": "bekletMusteri",
    "gecmis.html": "bekletGecmis",
    "raporlar.html": "bekletRaporlar",
    "reports.html": "bekletRaporlar",
    "kacan-satislar.html": "bekletRaporlar",
    "satis-listesi.html": "bekletSatisListesi",
    "hareketler.html": "bekletHareketler",
    "son-islemler.html": "bekletHareketler",
    "ziyaret.html": "bekletZiyaret",
    "takip-gerekenler.html": "bekletTakipGerekenler",
    "gorevler.html": "bekletGorevler",
    "vade-takip.html": "bekletVadeTakip",
    "km.html": "bekletKm",
    "km-kayitlar.html": "bekletKm",
    "maas-hesaplama.html": "bekletMaasHesaplama",
    "maas-menu.html": "bekletMaasHesaplama",
    "ay-detay.html": "bekletMaasHesaplama",
    "net-maas-hesaplama.html": "bekletNetMaas",
    "avans-takibi.html": "bekletAvans",
    "odenebilir-komisyon.html": "bekletKomisyon",
    "bildirimler.html": "bekletBildirimler",
    "home.html": "bekletAnaSayfa"
  };
  // Düğme DOMContentLoaded'de (auth henüz çözülmeden) zaten oluşturulduğu
  // için, izin burada "weiconAuthHazir" olayında ayrıca uygulanır (aynı
  // urun-arama.js'teki uaIzinleriUygula deseni).
  function biIzinleriUygula(){
    try{
      var btn = document.getElementById("biNavBtn");
      if(!btn) return;
      var anahtar = BI_SAYFA_BEKLET_ANAHTARI[dosyaAdi()];
      var izinVar = !anahtar || (typeof izinVarMi !== "function") || izinVarMi(anahtar);
      btn.style.display = izinVar ? "" : "none";
    }catch(e){}
  }

  function baslat(){
    if(document.readyState === "loading"){
      document.addEventListener("DOMContentLoaded", function(){ elOlustur(); biIzinleriUygula(); });
    } else {
      elOlustur();
      biIzinleriUygula();
    }
    window.addEventListener("weiconAuthHazir", biIzinleriUygula);
  }
  baslat();

  return { ekle: ekle, sil: sil, devamEt: devamEt, listele: oku, guncelle: guncelle };
})();
