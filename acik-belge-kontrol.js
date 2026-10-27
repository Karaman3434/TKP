/*
  acik-belge-kontrol.js — WG.271026.2024.1107 (YENİ DOSYA, 27.10.2026)
  ============================================================
  ROTA DEĞİŞİKLİĞİ (Abdullah onayı): "İşlem Yap" → tip seç akışı artık
  Cari Kart'a UĞRAMADAN direkt cart.html'e (Ürün Bul/Sepet) gidiyor. Bu
  akış üç BAĞIMSIZ yerde aynı şekilde kodlanmıştı:
    - menu-cekmece.js   (Ana Sayfa > açılır menü > mini arama)
    - customer-render.js (Müşteriler listesi sayfası)
    - belge-render.js   (Belge içi hızlı pencere)
  "SİPARİŞ" seçilince o müşteride kapanmamış bir teklif/proforma/numune
  var mı kontrolü (eskiden SADECE cari-kart-render.js'te, "İşleme Devam
  Et"e basılınca çalışıyordu) artık tipin seçildiği AN'da, cari karta hiç
  gidilmeden burada çalışıyor — TEK yerden, üç giriş noktası için.

  cari-kart-render.js'teki ORİJİNAL kontrol (tipSeciminiDogrula) BİLEREK
  SİLİNMEDİ — customer-detail.html'in eski "Ürün Bul" kutucuğu hâlâ Cari
  Kart'ın kendi tam tip ızgarasını kullanıyor, o akış bu değişiklikten
  HİÇ etkilenmiyor.

  Uyarı ekranı + belge önizleme HTML/CSS'i customer-cari-kart.html'deki
  (Feature 11, 27.10.2026) tasarımla BİREBİR aynı — kopya değil, burada
  JS ile üretiliyor, böylece 40+ sayfanın HER birine statik HTML/CSS
  eklemek gerekmiyor. Gereken CSS (detail-style.css/cari-kart-style.css/
  belge-style.css) ve hareket-tablo.js, menu-cekmece.js'teki product-data.js
  /customer-data.js ile AYNI "lazy-load" deseniyle SADECE gerçekten açık
  bir belge bulunduğunda yükleniyor — sipariş dışı işlemlerde veya açık
  belgesi olmayan müşterilerde hiç indirilmiyor.

  DIŞA AÇILAN TEK FONKSİYON: AcikBelgeKontrol.tipSeciminiBaslat(musteri, tip)
  — musteri: {ad, ...}; tip: "numune"/"teklif"/"proforma"/"siparis".
  Açık belge yoksa (veya tip siparis değilse) direkt cart.html'e gider;
  varsa uyarıyı gösterir, "Bu belgeyi kullan" / "Hayır, bambaşka bir
  sipariş oluşturuyorum" sonucuna göre devam eder.
*/
var AcikBelgeKontrol = (function(){

  var kaynaklarHazir = false;
  var kaynaklarYukleniyor = false;
  var bekleyenler = [];

  function cssEkle(href, testSelector){
    if(testSelector && document.querySelector(testSelector)) return;
    var dosyaAdi = href.split("?")[0];
    if(document.querySelector("link[href^='" + dosyaAdi + "']")) return;
    var l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    document.head.appendChild(l);
  }

  function kaynaklariYukle(hazirOlunca){
    if(kaynaklarHazir){ hazirOlunca(); return; }
    bekleyenler.push(hazirOlunca);
    if(kaynaklarYukleniyor) return;
    kaynaklarYukleniyor = true;
    cssEkle("detail-style.css?v=WG.091026.1010.753", ".tip-secim-overlay");
    cssEkle("cari-kart-style.css?v=WG.271026.1613.1085", ".ck-sil-uyari-notu");
    cssEkle("belge-style.css?v=WG.211026.2235.928", ".belge-urun-tablo");
    if(typeof HareketTablo !== "undefined"){
      kaynaklarHazir = true;
      kaynaklarYukleniyor = false;
      bekleyenler.forEach(function(fn){ fn(); });
      bekleyenler = [];
      return;
    }
    var s = document.createElement("script");
    s.src = "hareket-tablo.js?v=WG.211026.1500.903";
    s.onload = function(){
      kaynaklarHazir = true;
      kaynaklarYukleniyor = false;
      bekleyenler.forEach(function(fn){ fn(); });
      bekleyenler = [];
    };
    s.onerror = function(){
      kaynaklarYukleniyor = false;
      bekleyenler = [];
      if(typeof hataGoster === "function") hataGoster("Belge önizleme bileşeni yüklenemedi.");
    };
    document.body.appendChild(s);
  }

  function fmt(n){ return (n||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}); }
  var TIP_ETIKET_B_ABK = {numune:"Numune", teklif:"Fiyat Teklifi", proforma:"Proforma Fatura", siparis:"Sipariş"};

  // cari-kart-render.js'teki belgeSatirDegerHesaplaCK/belgeHesaplaAdaptoruCK
  // ile BİREBİR aynı mantık — kodun kendisi (küçük hesap fonksiyonları)
  // kasıtlı olarak buraya da kopyalandı, bu dosyalar arası bağımlılık
  // riskini önleme kuralıyla AYNI (bkz. cari-kart-render.js üstündeki not).
  function belgeSatirDegerHesaplaABK(item, adet, kaydinKuru){
    var netBirimFiyat = item.iskBirim!==undefined ? item.iskBirim : (item.listeFiyat||0);
    var toplamEuro = netBirimFiyat * (adet||0);
    var mk = netBirimFiyat - (item.dipFiyat||0);
    var ozelFiyatMi = (item.iskonto||0) > 60;
    var satirPrim = ozelFiyatMi ? 0 : mk*(adet||0)*0.22;
    var satirPrimTl = Math.round(satirPrim * kaydinKuru);
    return { toplamEuro: toplamEuro, iskontoluFiyat: netBirimFiyat, prim: satirPrim, primTl: satirPrimTl, mudurPrimTL: satirPrimTl };
  }
  function belgeHesaplaAdaptoruABK(adetAlani, kaydinKuru){
    return function(item){ return belgeSatirDegerHesaplaABK(item, item[adetAlani], kaydinKuru); };
  }

  function overlayOlustur(){
    var mevcut = document.getElementById("abkOverlay");
    if(mevcut) return mevcut;
    var overlay = document.createElement("div");
    overlay.className = "tip-secim-overlay";
    overlay.id = "abkOverlay";
    overlay.hidden = true;
    overlay.innerHTML =
      "<div class='tip-secim-kutu'>"
      + "<div class='tip-secim-baslik' style='color:#7a5c00;'>⚠ Bu müşteride açık bir belge var</div>"
      + "<p class='ck-not-aciklama' id='abkMetin' style='margin:0 0 10px;'></p>"
      + "<div class='ck-sil-uyari-notu ck-belge-tiklanabilir' id='abkKayit' style='background:#fff;border-color:#e8c368;color:#333;font-weight:700;margin-bottom:12px;'>"
      + "<span class='ck-belge-metin' id='abkKayitMetin'></span>"
      + "<span class='ck-belge-ok' id='abkKayitOk'>▾</span>"
      + "</div>"
      + "<div id='abkOnizlemeAlani' hidden style='margin:-4px 0 14px;'></div>"
      + "<button class='cari-islemedevam-buton' id='abkKullanBtn' type='button' style='width:100%;margin-bottom:8px;'>📄 Bu belgeyi kullan</button>"
      + "<button class='tip-secim-vazgec-btn' id='abkYeniBtn' type='button'>Hayır, bambaşka bir sipariş oluşturuyorum</button>"
      + "</div>";
    document.body.appendChild(overlay);
    return overlay;
  }

  // customer-cari-kart.html'deki acikBelgeOnizlemeAcKapat ile BİREBİR aynı
  // davranış: satıra dokununca gerçek ürün tablosu aynı pencere içinde açılır.
  function onizlemeAcKapat(kayit){
    var alan = document.getElementById("abkOnizlemeAlani");
    var okEl = document.getElementById("abkKayitOk");
    if(!alan) return;
    if(!alan.hidden){
      alan.hidden = true;
      if(okEl) okEl.classList.remove("ck-belge-ok--acik");
      return;
    }
    if(!alan.innerHTML){
      if(typeof HareketTablo === "undefined" || !kayit){
        if(typeof hataGoster === "function") hataGoster("Belge tablosu yüklenemedi.");
        return;
      }
      var kaydinKuru = kayit.kur || (parseFloat(localStorage.getItem("weicon_kur"))||0);
      var hesapla = belgeHesaplaAdaptoruABK("adet", kaydinKuru);
      var tutar = 0;
      (kayit.urunler||[]).forEach(function(u){ tutar += belgeSatirDegerHesaplaABK(u, u.adet, kaydinKuru).toplamEuro; });
      var etiket = TIP_ETIKET_B_ABK[kayit.tip];
      alan.innerHTML = HareketTablo.grupHtml({
        urunler: kayit.urunler || [],
        hesapla: hesapla,
        seritEtiket: etiket || kayit.tip,
        seritTarih: kayit.tarih || "",
        genelToplam: tutar,
        kur: kaydinKuru,
        primGizli: false
      });
    }
    alan.hidden = false;
    if(okEl) okEl.classList.add("ck-belge-ok--acik");
  }

  function uyariGoster(musteri, acikBelge, devamEt){
    overlayOlustur();
    var etiket = TIP_ETIKET_B_ABK[acikBelge.tip];
    document.getElementById("abkMetin").textContent =
      musteri.ad + " için, henüz siparişe dönüşmemiş bir " + (etiket||acikBelge.tip) + " bulundu:";
    document.getElementById("abkKayitMetin").textContent =
      (acikBelge.kod||"") + " · " + (acikBelge.tarih||"") + " · " + fmt(acikBelge.tutar) + " EURO";
    var onizlemeAlani = document.getElementById("abkOnizlemeAlani");
    onizlemeAlani.hidden = true;
    onizlemeAlani.innerHTML = "";
    document.getElementById("abkKayitOk").classList.remove("ck-belge-ok--acik");
    var tamKayit = null;
    if(typeof ReportsData !== "undefined"){
      var tumu = ReportsData.sonIslemler();
      tamKayit = tumu.find(function(x){ return x.tip===acikBelge.tip && x.ts===acikBelge.ts; });
    }
    document.getElementById("abkKayit").onclick = function(){ onizlemeAcKapat(tamKayit); };
    document.getElementById("abkKullanBtn").onclick = function(){
      document.getElementById("abkOverlay").hidden = true;
      if(!tamKayit){
        if(typeof hataGoster === "function") hataGoster("Kayıt bulunamadı.");
        return;
      }
      // Bildirimler sayfasındaki "İlerlet" ile BİREBİR aynı mekanizma: eski
      // belgeyi Sepet'e yükler ve zaten kendi içinde cart.html'e yönlendirir.
      ReportsData.revizeBaslat(tamKayit, "siparis");
    };
    document.getElementById("abkYeniBtn").onclick = function(){
      document.getElementById("abkOverlay").hidden = true;
      devamEt();
    };
    document.getElementById("abkOverlay").hidden = false;
  }

  function sepeteDevamEt(tip){
    localStorage.setItem("weiconv2_onceden_secilen_tip", tip);
    // MÜŞTERİ SIZINTISI DÜZELTMESİ (27.10.2026) ile AYNI bayrak — bkz.
    // cart-render.js sepetMusteriBaglantisiniDogrula.
    localStorage.setItem("weiconv2_sepet_musteri_baglantisi", "1");
    window.location.href = "cart.html";
  }

  // musteri: {ad, id, sehir, ...} — en az "ad" dolu olmalı.
  function tipSeciminiBaslat(musteri, tip){
    if(tip !== "siparis" || typeof ReportsData === "undefined" || !musteri || !musteri.ad){
      sepeteDevamEt(tip);
      return;
    }
    var acikBelge = ReportsData.musterininAcikBelgesi(musteri.ad);
    if(!acikBelge){
      sepeteDevamEt(tip);
      return;
    }
    kaynaklariYukle(function(){
      uyariGoster(musteri, acikBelge, function(){ sepeteDevamEt(tip); });
    });
  }

  return { tipSeciminiBaslat: tipSeciminiBaslat };

})();
