/*
  cihaz-kullanici-render.js — VERSİYON: WG.271026.2238.1124
  ============================================================
  "Cihazlar ve Kullanıcılar" sayfasının TEK render dosyası — eski
  cihazlar-render.js (cihaz listesi/engelleme) ve calisan-erisim-render.js
  (şifreli kullanıcı hesapları) buraya BİRLEŞTİRİLDİ, TEK S22+PIN kilidinin
  arkasında (Abdullah'ın isteği: "2 farklı denetleme sayfası olmasın").

  Akış:
    1) Herkes "Bu Cihaz" kartından kendi cihazını adlandırabilir (PIN
       gerekmez).
    2) Cihaz adı tam olarak "Samsung S22" değilse -> sadece bilgi notu,
       yönetim alanı (ne cihazlar ne kullanıcılar) hiç gösterilmez.
    3) "Samsung S22" ise -> TEK PIN istenir (eskiden cihazlar.html ve
       calisan-erisim.html AYRI AYRI soruyordu — artık ikisi için de aynı
       weicon_cihaz_pin_hash / Firebase "cihazPin" kullanılıyor, TEK giriş).
    4) PIN doğrulanınca: 📱 CİHAZLAR (liste + kullanıcı adı + geçmiş +
       engelle/kaldır) VE 👥 KULLANICILAR (hesap oluştur + izin yönetimi)
       aynı ekranda, art arda gösterilir.
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
  }catch(e){}
}

function htmlEsc(s){
  return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function zamanGoster(ms){
  if(!ms) return "hiç görülmedi";
  var farkDk = Math.round((Date.now() - ms) / 60000);
  if(farkDk < 1) return "az önce";
  if(farkDk < 60) return farkDk + " dk önce";
  if(farkDk < 1440) return Math.floor(farkDk/60) + " sa önce";
  return Math.floor(farkDk/1440) + " gün önce";
}

var AY_KISA_CK = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
function tarihSaatGoster(ms){
  if(!ms) return "—";
  var d = new Date(ms);
  return ("0"+d.getDate()).slice(-2) + " " + AY_KISA_CK[d.getMonth()] + " " + ("0"+d.getHours()).slice(-2) + ":" + ("0"+d.getMinutes()).slice(-2);
}

/* ========================================================================
   "Bu Cihaz" kartı — cihazlar.html'den BİREBİR taşındı, değişmedi.
   ======================================================================== */
function cihazAdiniGercektenKaydet(ad){
  CihazData.adiKaydet(ad, function(basarili){
    if(basarili){
      var ok = document.getElementById("czAdKaydedildi");
      ok.hidden = false;
      setTimeout(function(){ ok.hidden = true; }, 2500);
    }
    ckErisimKontrolEt();
  });
}

// AYNI İSİMLİ KOPYA KARAR EKRANI (10.10.2026) — bkz. cihaz-data.js
// aktifAyniIsimdeBaskaCihazBulAsync üstündeki açıklama.
function czAyniIsimOverlayAc(ad, bulunan){
  var overlay = document.getElementById("czAyniIsimOverlay");
  var aciklama = document.getElementById("czAyniIsimAciklama");
  if(!overlay || !aciklama) { cihazAdiniGercektenKaydet(ad); return; } // overlay yoksa eski davranışa düş

  aciklama.textContent = "\"" + ad + "\" adında, hâlâ aktif (engellenmemiş) başka bir cihaz kaydı var (son görülme: "
    + zamanGoster(bulunan.sonGorulme) + "). Bu büyük ihtimalle BU telefonun önceki kaydı — cihaz verisi bir "
    + "şekilde temizlendiği için program bu telefonu yeni bir cihaz sanıp yeniden kaydetti.";
  overlay.hidden = false;

  document.getElementById("btnCzAyniIsimDegistir").onclick = function(){
    overlay.hidden = true;
    CihazData.cihaziSil(bulunan.id, function(basarili, hata){
      if(!basarili){ hataGoster(hata || "Eski kayıt silinemedi, yeniden dene."); return; }
      cihazAdiniGercektenKaydet(ad);
    });
  };
  document.getElementById("btnCzAyniIsimFarkli").onclick = function(){
    overlay.hidden = true;
    cihazAdiniGercektenKaydet(ad);
  };
  document.getElementById("btnCzAyniIsimVazgec").onclick = function(){
    overlay.hidden = true;
  };
}

function buCihazKartiniHazirla(){
  var input = document.getElementById("czBuCihazAdi");
  var yerel = localStorage.getItem("weicon_cihaz_adi");
  if(yerel) input.value = yerel;

  document.getElementById("btnCzAdKaydet").onclick = function(){
    var ad = input.value.trim();
    if(!ad) return;
    var btn = this;
    btn.disabled = true;
    CihazData.aktifAyniIsimdeBaskaCihazBulAsync(ad, function(bulunan){
      btn.disabled = false;
      if(bulunan){
        czAyniIsimOverlayAc(ad, bulunan);
      } else {
        cihazAdiniGercektenKaydet(ad);
      }
    });
  };
}

/* ========================================================================
   ERİŞİM KONTROLÜ — sadece "Samsung S22" ikisini de (cihazlar+kullanıcılar)
   görebilir. TEK PIN, TEK giriş (eskiden iki ayrı sayfa iki ayrı PIN akışı
   soruyordu — aynı anahtarları paylaştıkları için aslında aynı PIN'di,
   ama kullanıcı iki kere giriyordu; artık tek seferde).
   ======================================================================== */
function ckErisimKontrolEt(){
  var s22Mi = CihazData.korumaliMi(CihazData.benimAdim());
  document.getElementById("ckSadeceS22Notu").hidden = s22Mi;
  document.getElementById("ckPinAlani").hidden = true;
  document.getElementById("ckYonetimAlani").hidden = true;

  if(!s22Mi) return;

  if(sessionStorage.getItem("weicon_cihaz_pin_ok") === "1"){
    ckYonetimAlaniniGoster();
  } else {
    document.getElementById("ckPinAlani").hidden = false;
    ckPinAkisiBaslat();
  }
}

/* ---------- PIN akışı (cihazlar-render.js'ten BİREBİR, "ck" önekiyle) --- */
var ckGirilenPin = "";
var ckPinAsama = "kontrolEdiliyor";
var ckYeniPinIlkGiris = "";

function ckPinHashGetir(){ return localStorage.getItem("weicon_cihaz_pin_hash"); }

function ckNoktalariGuncelle(){
  var noktalar = document.querySelectorAll("#ckPinNoktalar .pin-nokta");
  noktalar.forEach(function(n, i){ n.classList.toggle("dolu", i < ckGirilenPin.length); });
}
function ckPinEkraniniSifirla(){ ckGirilenPin = ""; ckNoktalariGuncelle(); }

function ckRakamEkle(r){
  if(ckGirilenPin.length >= 4) return;
  ckGirilenPin += r;
  ckNoktalariGuncelle();
  if(ckGirilenPin.length === 4){
    if(ckPinAsama === "giris") ckPinKontrolEt();
    else if(ckPinAsama === "yeniPin1") ckYeniPinIlkAdimiIsle();
    else if(ckPinAsama === "yeniPin2") ckYeniPinTekrarIsle();
  }
}
function ckRakamSil(){
  ckGirilenPin = ckGirilenPin.slice(0, -1);
  ckNoktalariGuncelle();
  document.getElementById("ckPinHata").hidden = true;
}

function ckYeniPinAkisiniBaslat(){
  ckPinAsama = "yeniPin1";
  ckPinEkraniniSifirla();
  document.getElementById("ckPinBaslik").textContent = "🆕 Yönetim PIN'i Belirle";
  var bilgi = document.getElementById("ckPinBilgi");
  bilgi.textContent = "Bu cihazdan cihaz ve kullanıcı yönetimi yapabilmek için 4 haneli AYRI bir PIN belirle (uygulama kilidinden farklı).";
  bilgi.hidden = false;
}

function ckPinKontrolEt(){
  var mevcutHash = ckPinHashGetir();
  pinHashHesapla(ckGirilenPin).then(function(girilenHash){
    if(girilenHash === mevcutHash){
      sessionStorage.setItem("weicon_cihaz_pin_ok", "1");
      ckYonetimAlaniniGoster();
    } else {
      document.getElementById("ckPinHata").hidden = false;
      ckPinEkraniniSifirla();
    }
  });
}

function ckYeniPinIlkAdimiIsle(){
  ckYeniPinIlkGiris = ckGirilenPin;
  ckPinAsama = "yeniPin2";
  ckPinEkraniniSifirla();
  document.getElementById("ckPinBaslik").textContent = "🆕 PIN'i Onayla";
  document.getElementById("ckPinBilgi").textContent = "Az önce girdiğin PIN'i onaylamak için tekrar gir.";
}

function ckYeniPinTekrarIsle(){
  if(ckGirilenPin !== ckYeniPinIlkGiris){
    document.getElementById("ckPinHata").textContent = "PIN'ler eşleşmiyor, baştan deneyin.";
    document.getElementById("ckPinHata").hidden = false;
    ckYeniPinIlkGiris = "";
    ckYeniPinAkisiniBaslat();
    return;
  }
  pinHashHesapla(ckGirilenPin).then(function(yeniHash){
    localStorage.setItem("weicon_cihaz_pin_hash", yeniHash);
    try{ firebase.database().ref("cihazPin").set({hash:yeniHash, zaman:Date.now()}); }catch(e){}
    sessionStorage.setItem("weicon_cihaz_pin_ok", "1");
    ckYonetimAlaniniGoster();
  });
}

function ckTusTakiminiOlustur(){
  var tuslar = ["1","2","3","4","5","6","7","8","9","","0","⌫"];
  var grid = document.getElementById("ckPinTusGrid");
  grid.innerHTML = tuslar.map(function(t){
    if(t === "") return "<button class='pin-tus pin-tus--bos'></button>";
    if(t === "⌫") return "<button class='pin-tus pin-tus--sil' data-sil='1'>⌫</button>";
    return "<button class='pin-tus' data-rakam='" + t + "'>" + t + "</button>";
  }).join("");
  grid.querySelectorAll("[data-rakam]").forEach(function(btn){
    btn.onclick = function(){ ckRakamEkle(this.getAttribute("data-rakam")); };
  });
  grid.querySelector("[data-sil]").onclick = ckRakamSil;

  var gizliInput = document.getElementById("ckPinGizliInput");
  gizliInput.addEventListener("input", function(){
    var v = gizliInput.value.replace(/[^0-9]/g, "").slice(0,4);
    gizliInput.value = "";
    for(var i=0;i<v.length;i++) ckRakamEkle(v[i]);
  });
}

function ckPinAkisiBaslat(){
  document.getElementById("ckPinBaslik").textContent = "🔒 Cihazlar ve Kullanıcılar — Yönetim PIN'i";
  document.getElementById("ckPinBilgi").hidden = true;
  ckPinEkraniniSifirla();

  if(ckPinHashGetir()){
    ckPinAsama = "giris";
    return;
  }
  try{
    firebase.database().ref("cihazPin/hash").once("value").then(function(snap){
      if(snap.val()){
        localStorage.setItem("weicon_cihaz_pin_hash", snap.val());
        ckPinAsama = "giris";
      } else {
        ckYeniPinAkisiniBaslat();
      }
    }).catch(function(){ ckYeniPinAkisiniBaslat(); });
  }catch(e){ ckYeniPinAkisiniBaslat(); }
}

/* ========================================================================
   PIN DOĞRULANDIKTAN SONRA — iki bölümü de BİR KERE başlatır.
   ======================================================================== */
var ckYonetimBaslatildiMi = false;

function ckYonetimAlaniniGoster(){
  document.getElementById("ckPinAlani").hidden = true;
  document.getElementById("ckYonetimAlani").hidden = false;

  if(ckYonetimBaslatildiMi) return;
  ckYonetimBaslatildiMi = true;

  CihazData.tumCihazlariDinle(cihazListesiniCiz);

  // EKLENDİ (25.10.2026, "manuel cihaz gruplama" özelliği, Abdullah'ın
  // isteğiyle) — manuel gruplar da cihazlar gibi canlı dinleniyor; hangisi
  // önce/sonra tetiklenirse tetiklensin liste her zaman güncel veriyle
  // yeniden çizilsin diye ckSonCihazListesi üzerinden yeniden çiziliyor.
  CihazData.manuelGruplariDinle(function(gruplar){
    ckSonManuelGruplar = gruplar;
    cihazListesiniCiz(ckSonCihazListesi);
  });

  firebase.database().ref("kisitliKullanicilar").on("value", function(snap){
    ckSonKullanicilarVeri = snap.val() || {};
    ceListeyiCiz(ckSonKullanicilarVeri);
  }, function(e){
    hataGoster("Çalışan listesi okunamadı: " + e.message);
  });

  document.getElementById("btnCeOlustur").onclick = function(){
    var btn = this;
    var hataEl = document.getElementById("ceOlusturHata");
    hataEl.hidden = true;
    var kullaniciAdi = document.getElementById("ceKullaniciAdi").value;
    var sifre = document.getElementById("ceSifre").value;
    btn.disabled = true;
    btn.textContent = "⏳ Oluşturuluyor...";
    ceKullaniciOlustur(kullaniciAdi, sifre, function(basarili, hata, olusanKullaniciAdi){
      btn.disabled = false;
      btn.textContent = "✓ Kullanıcı Oluştur";
      if(!basarili){
        hataEl.textContent = "❌ " + hata;
        hataEl.hidden = false;
        return;
      }
      // EKLENDİ (22.10.2026, Abdullah'ın isteğiyle) — Kullanıcı
      // oluşturulduğu ANDA "Giriş Linki"ni de burada göster; aynı link
      // zaten aşağıdaki kullanıcı kartında da kalıcı olarak kalacak.
      var yeniLinkBlok = document.getElementById("ceYeniLinkBlok");
      var yeniLinkKutu = document.getElementById("ceYeniLinkKutu");
      if(yeniLinkBlok && yeniLinkKutu){
        yeniLinkKutu.value = ceGirisLinkiOlustur(olusanKullaniciAdi);
        yeniLinkBlok.hidden = false;
        ceLinkKopyalaBtnBagla(
          document.getElementById("ceYeniLinkKopyalaBtn"),
          yeniLinkKutu,
          document.getElementById("ceYeniLinkKopyalandi")
        );
      }
      document.getElementById("ceKullaniciAdi").value = "";
      document.getElementById("ceSifre").value = "";
    });
  };
}

/* ========================================================================
   📱 CİHAZLAR — cihazlar-render.js'ten taşındı; YENİ: her kartta artık
   kendi kendini tanımladığı "kullanıcı adı" ve değişim geçmişi de var.
   ======================================================================== */
// 06.10.2026 (Abdullah'ın isteğiyle) — Engellenen cihazlar artık ANA
// listede gösterilmiyor; ayrı, kapalı başlayan "Engellenen cihazlar"
// alanına taşınıyor. Bu, o alanın kullanıcı tarafından açık/kapalı
// bırakıldığı durumu render'lar arasında hatırlamak için.
var czEngellenenlerAcikMi = false;

// EKLENDİ (25.10.2026, "cihaz onayı/gruplama/sınırı" özelliği, Abdullah'ın
// isteğiyle) — iki ayrı Firebase dinleyicisinin (cihazlar + kisitliKullanicilar)
// en son verisini birbirine açık tutar: cihaz sayısı/sınır uyarısı kullanıcı
// kartlarında gösterileceği için, hangi dinleyici önce/sonra tetiklenirse
// tetiklensin ikisi de güncel veriyle yeniden çizilsin diye.
var ckSonCihazListesi = [];
var ckSonKullanicilarVeri = {};

// EKLENDİ (25.10.2026, "manuel cihaz gruplama" özelliği, Abdullah'ın
// isteğiyle — "aynı linki/daveti kullanan ama FARKLI hesapla giriş yapan"
// cihazlar otomatik gruplamanın (sonGirisHesabi) yakalayamadığı durum).
var ckSonManuelGruplar = {};     // Firebase'teki cihazManuelGruplari, olduğu gibi
var czSecimModuAcikMi = false;   // "Seç" butonuna basılınca true olur
var czSeciliCihazlar = {};       // seçim modunda işaretlenen cihaz id'leri (Set gibi kullanılır)

function czKullaniciSatiriHtml(c){
  var kullaniciSatiri = c.kullaniciAdi
    ? "<div class='cz-kart-kullanici' id='czAd-" + htmlEsc(c.id) + "'>👤 " + htmlEsc(c.kullaniciAdi) + "</div>"
    : "<div class='cz-kart-kullanici cz-kart-kullanici--bos' id='czAd-" + htmlEsc(c.id) + "'>— kullanıcı adı tanımlanmadı —</div>";
  return "<div class='cz-kart-kullanici-satir'>" + kullaniciSatiri
    + "<button type='button' class='cz-mini-ikon-btn cz-ad-duzenle-ac-btn' data-id='" + htmlEsc(c.id) + "' title='İsmi düzenle'>✏️</button>"
    + "</div>"
    + "<div class='cz-ad-duzenle-alan' id='czAdDuzenle-" + htmlEsc(c.id) + "' hidden>"
    + "<input type='text' class='cz-ad-duzenle-input' id='czAdInput-" + htmlEsc(c.id) + "' value='" + htmlEsc(c.kullaniciAdi||"") + "' placeholder='Kullanıcı adı'>"
    + "<button type='button' class='cz-ad-duzenle-kaydet-btn' data-id='" + htmlEsc(c.id) + "'>✓ Kaydet</button>"
    + "</div>";
}

function czPinSatiriHtml(c){
  var pinVarMi = !!c.pinHash;
  return "<div class='cz-pin-satir'>"
    + "<span>🔑 PIN" + (pinVarMi ? ": <span class='cz-pin-deger'>••••</span>" : " <span class='cz-pin-tanimsiz'>tanımlanmadı</span>") + "</span>"
    + "<button type='button' class='cz-pin-belirle-btn' data-id='" + htmlEsc(c.id) + "'>" + (pinVarMi ? "Değiştir" : "Belirle") + "</button>"
    + "</div>"
    + "<div class='cz-pin-duzenle-alan' id='czPinDuzenle-" + htmlEsc(c.id) + "' hidden>"
    + "<input type='tel' inputmode='numeric' maxlength='4' class='cz-pin-duzenle-input' id='czPinInput-" + htmlEsc(c.id) + "' placeholder='4 haneli PIN'>"
    + "<button type='button' class='cz-pin-duzenle-kaydet-btn' data-id='" + htmlEsc(c.id) + "'>✓ Kaydet</button>"
    + "</div>";
}

function czGecmisHtml(c){
  var gecmisDizi = c.kullaniciAdiGecmisi ? Object.keys(c.kullaniciAdiGecmisi).map(function(k){ return c.kullaniciAdiGecmisi[k]; }) : [];
  gecmisDizi.sort(function(a,b){ return (b.zaman||0) - (a.zaman||0); });
  if(!gecmisDizi.length) return "";
  return "<button type='button' class='cz-gecmis-ac-btn' data-id='" + htmlEsc(c.id) + "'>Kullanıcı adı geçmişi (" + gecmisDizi.length + ") ▾</button>"
    + "<div class='cz-gecmis-liste' id='czGecmis-" + htmlEsc(c.id) + "' hidden>"
    + gecmisDizi.map(function(g){
        return "<div class='cz-gecmis-satir'><b>" + htmlEsc(g.adi) + "</b><span>" + tarihSaatGoster(g.zaman) + "</span></div>";
      }).join("")
    + "</div>";
}

// manuelGrupId: SADECE manuel grup popup'ında dolu gelir -> "➖ Gruptan
// Çıkar" düğmesi eklenir. secimModu: SADECE ana listede, "Seç" modu
// açıkken dolu gelir -> kart başına işaretleme kutucuğu eklenir. İkisi de
// ESKİ çağrılarla (czAktifKartHtml(c, benimId)) TAM geriye dönük uyumlu —
// ikisi de boş geçilirse çıktı birebir eskisiyle aynı kalır.
function czAktifKartHtml(c, benimId, manuelGrupId, secimModu){
  var buCihazMi = c.id === benimId;
  var rozet = buCihazMi ? "<span class='cz-kart-rozet cz-kart-rozet--bu'>Bu cihaz</span>" : "";
  var cikarBtn = manuelGrupId
    ? "<button type='button' class='cz-gruptan-cikar-btn' data-id='" + htmlEsc(c.id) + "' data-grup-id='" + htmlEsc(manuelGrupId) + "'>➖ Gruptan Çıkar</button>"
    : "";
  var checkbox = secimModu
    ? "<input type='checkbox' class='cz-kart-checkbox' data-id='" + htmlEsc(c.id) + "'" + (czSeciliCihazlar[c.id] ? " checked" : "") + ">"
    : "";
  var ustSinif = secimModu ? "cz-kart-ust cz-kart-ust--secim" : "cz-kart-ust";

  var alt = buCihazMi
    ? ""
    : "<div class='cz-kart-alt'><button class='cz-engelle-btn' data-id='" + htmlEsc(c.id) + "' data-ad='" + htmlEsc(c.ad||"") + "'>🚫 Engelle</button></div>";

  return "<div class='cz-kart'>"
    + "<div class='" + ustSinif + "'>" + checkbox + "<span class='cz-kart-ad'>" + htmlEsc(c.ad || "Adsız Cihaz") + "</span>" + rozet + cikarBtn + "</div>"
    + czKullaniciSatiriHtml(c)
    + czPinSatiriHtml(c)
    + "<div class='cz-kart-son-gorulme'>Son görülme: " + zamanGoster(c.sonGorulme) + "</div>"
    + czGecmisHtml(c)
    + alt
    + "</div>";
}

function czEngellenmisKartHtml(c){
  var kullaniciSatiri = c.kullaniciAdi
    ? "<div class='cz-kart-kullanici'>👤 " + htmlEsc(c.kullaniciAdi) + "</div>"
    : "<div class='cz-kart-kullanici cz-kart-kullanici--bos'>— kullanıcı adı tanımlanmadı —</div>";
  return "<div class='cz-kart'>"
    + "<div class='cz-kart-ust'><span class='cz-kart-ad'>" + htmlEsc(c.ad || "Adsız Cihaz") + "</span> <span class='cz-kart-rozet cz-kart-rozet--engelli'>Engelli</span></div>"
    + kullaniciSatiri
    + "<div class='cz-kart-son-gorulme'>Son görülme: " + zamanGoster(c.sonGorulme) + "</div>"
    // 10.10.2026 (Abdullah'ın isteğiyle): "Engeli Kaldır"ın yanına gerçek,
    // kalıcı bir "Sil" eklendi — eskiden engellenen bir kayıt asla
    // silinemiyordu, bu da listenin sürekli büyümesine neden oluyordu.
    + "<div class='cz-kart-alt cz-kart-alt--iki'>"
    + "<button class='cz-kaldir-btn' data-id='" + htmlEsc(c.id) + "'>✓ Engeli Kaldır</button>"
    + "<button class='cz-sil-btn' data-id='" + htmlEsc(c.id) + "' data-ad='" + htmlEsc(c.ad||"Adsız Cihaz") + "'>🗑 Kalıcı Sil</button>"
    + "</div>"
    + "</div>";
}

/* ========================================================================
   ⏳ ONAY BEKLEYEN CİHAZLAR (25.10.2026, "izin vermeden bağlanamasın"
   isteği, Abdullah'ın isteğiyle) — onayDurumu "bekliyor" olan cihazlar.
   Normal "📱 Cihazlar" listesinin tamamen DIŞINDA, ayrı bir bölümde.
   ======================================================================== */
function czBekleyenKartHtml(c){
  return "<div class='cz-kart cz-kart--bekliyor' data-id='" + htmlEsc(c.id) + "'>"
    + "<div class='cz-kart-ust'><span class='cz-kart-ad'>" + htmlEsc(c.ad || "Adsız Cihaz") + "</span>"
    + "<span class='cz-kart-rozet cz-kart-rozet--bekliyor'>Onay bekliyor</span></div>"
    + "<div class='cz-bekleyen-hesap'>🔑 Giriş denemesi: <b>" + htmlEsc(c.sonGirisHesabi || "?") + "</b> hesabıyla</div>"
    + "<div class='cz-kart-son-gorulme'>İlk görülme: " + zamanGoster(c.ilkGorulme) + "</div>"
    + "<div class='cz-onay-satir'><input type='text' class='cz-ad-duzenle-input cz-onay-ad-input' data-id='" + htmlEsc(c.id) + "' placeholder='Bu cihaza bir isim ver (örn. Yasin - Telefon)'></div>"
    + "<div class='cz-kart-alt cz-kart-alt--iki'>"
    + "<button class='cz-onayla-btn' data-id='" + htmlEsc(c.id) + "'>✓ Onayla</button>"
    + "<button class='cz-reddet-btn' data-id='" + htmlEsc(c.id) + "' data-ad='" + htmlEsc(c.ad||"Adsız Cihaz") + "'>🚫 Reddet</button>"
    + "</div></div>";
}

function czBekleyenListesiniCiz(bekleyenler){
  var bolum = document.getElementById("czBekleyenBolum");
  var kapsayici = document.getElementById("czBekleyenListe");
  if(!bolum || !kapsayici) return;
  if(!bekleyenler.length){ bolum.hidden = true; kapsayici.innerHTML = ""; return; }
  bolum.hidden = false;
  kapsayici.innerHTML = bekleyenler.map(czBekleyenKartHtml).join("");

  kapsayici.querySelectorAll(".cz-onayla-btn").forEach(function(btn){
    btn.onclick = function(){
      var id = btn.getAttribute("data-id");
      var girdi = kapsayici.querySelector(".cz-onay-ad-input[data-id='" + id + "']");
      var yeniAd = girdi ? girdi.value.trim() : "";
      btn.disabled = true; btn.textContent = "⏳ Onaylanıyor...";
      CihazData.onaylaCihazi(id, yeniAd, function(basarili, hata){
        if(!basarili){
          btn.disabled = false; btn.textContent = "✓ Onayla";
          hataGoster(hata || "Cihaz onaylanamadı.");
        }
        // başarılıysa Firebase dinleyicisi listeyi zaten yeniden çizecek
      });
    };
  });
  kapsayici.querySelectorAll(".cz-reddet-btn").forEach(function(btn){
    btn.onclick = function(){
      var id = btn.getAttribute("data-id");
      var ad = btn.getAttribute("data-ad");
      if(!confirm("\"" + ad + "\" cihazının giriş denemesi reddedilsin mi? Bu cihaz \"Engellenen cihazlar\" listesine taşınacak.")) return;
      CihazData.engelle(id, ad, function(basarili, hata){
        if(!basarili) hataGoster(hata || "Cihaz reddedilemedi.");
      });
    };
  });
}

/* ========================================================================
   YENİDEN TASARLANDI (25.10.2026, Abdullah'ın isteğiyle — liste çok yer
   kaplıyordu) — aynı hesapla (sonGirisHesabi) giriş yapmış 2+ cihaz artık
   TEK satırlık bir butonda gruplanıyor; tıklanınca .cz-kart'lar (AYNEN,
   czAktifKartHtml ile üretilmiş) bir popup/sheet'te gösteriliyor.
   ======================================================================== */
function czGrupSatiriHtml(hesapAdi, cihazlar){
  return "<button type='button' class='cz-grup-satir' data-hesap='" + htmlEsc(hesapAdi) + "'>"
    + "<span class='cz-grup-ikon'>👤</span>"
    + "<span class='cz-grup-etiket'>" + htmlEsc(hesapAdi) + "</span>"
    + "<span class='cz-grup-sayi'>" + cihazlar.length + " cihaz</span>"
    + "<span class='cz-grup-ok'>›</span>"
    + "</button>";
}

// EKLENDİ (25.10.2026, "manuel cihaz gruplama") — otomatik (👤, mavi)
// gruplardan ayırt edilsin diye 🏷️ ikonu ve .cz-grup-satir--manuel
// (sarı ton) ile çiziliyor; işlev olarak czGrupSatiriHtml ile aynı.
function czManuelGrupSatiriHtml(grupId, isim, cihazlar){
  return "<button type='button' class='cz-grup-satir cz-grup-satir--manuel' data-grup-id='" + htmlEsc(grupId) + "'>"
    + "<span class='cz-grup-ikon'>🏷️</span>"
    + "<span class='cz-grup-etiket'>" + htmlEsc(isim) + "</span>"
    + "<span class='cz-grup-sayi'>" + cihazlar.length + " cihaz</span>"
    + "<span class='cz-grup-ok'>›</span>"
    + "</button>";
}

// Hem ana listedeki tekli kartlara, hem grup popup'ı içindeki kartlara
// AYNI düğme bağlama mantığı uygulanır — tekrar yazmamak için ortak.
function czKartButonlariniBagla(kapsayici){
  kapsayici.querySelectorAll(".cz-gecmis-ac-btn").forEach(function(btn){
    btn.onclick = function(){
      var id = this.getAttribute("data-id");
      var liste2 = document.getElementById("czGecmis-" + id);
      if(!liste2) return;
      liste2.hidden = !liste2.hidden;
      this.textContent = this.textContent.replace(/[▾▴]/, liste2.hidden ? "▾" : "▴");
    };
  });

  kapsayici.querySelectorAll(".cz-engelle-btn").forEach(function(btn){
    btn.onclick = function(){
      var id = this.getAttribute("data-id");
      var ad = this.getAttribute("data-ad");
      if(!confirm("\"" + ad + "\" cihazı engellensin mi? O cihazda oturum kapatılacak ve liste dışına alınacak.")) return;
      CihazData.engelle(id, ad, function(basarili, hata){
        if(!basarili) hataGoster(hata || "Cihaz engellenemedi.");
      });
    };
  });

  // ✏️ İsim düzenle (admin, panelden)
  kapsayici.querySelectorAll(".cz-ad-duzenle-ac-btn").forEach(function(btn){
    btn.onclick = function(){
      var id = this.getAttribute("data-id");
      var alan = document.getElementById("czAdDuzenle-" + id);
      if(!alan) return;
      alan.hidden = !alan.hidden;
      if(!alan.hidden){
        var girdi = document.getElementById("czAdInput-" + id);
        if(girdi){ girdi.focus(); girdi.select(); }
      }
    };
  });
  kapsayici.querySelectorAll(".cz-ad-duzenle-kaydet-btn").forEach(function(btn){
    btn.onclick = function(){
      var id = this.getAttribute("data-id");
      var girdi = document.getElementById("czAdInput-" + id);
      if(!girdi) return;
      var yeniAd = girdi.value.trim();
      if(!yeniAd){ hataGoster("İsim boş olamaz."); return; }
      btn.disabled = true; btn.textContent = "⏳ Kaydediliyor...";
      CihazData.adiniDegistir(id, yeniAd, function(basarili, hata){
        btn.disabled = false; btn.textContent = "✓ Kaydet";
        if(!basarili) hataGoster(hata || "İsim kaydedilemedi.");
        // başarılıysa Firebase dinleyicisi listeyi zaten yeniden çizecek
      });
    };
  });

  // 🔑 PIN belirle/değiştir (admin, panelden)
  kapsayici.querySelectorAll(".cz-pin-belirle-btn").forEach(function(btn){
    btn.onclick = function(){
      var id = this.getAttribute("data-id");
      var alan = document.getElementById("czPinDuzenle-" + id);
      if(!alan) return;
      alan.hidden = !alan.hidden;
      if(!alan.hidden){
        var girdi = document.getElementById("czPinInput-" + id);
        if(girdi){ girdi.value = ""; girdi.focus(); }
      }
    };
  });
  kapsayici.querySelectorAll(".cz-pin-duzenle-kaydet-btn").forEach(function(btn){
    btn.onclick = function(){
      var id = this.getAttribute("data-id");
      var girdi = document.getElementById("czPinInput-" + id);
      if(!girdi) return;
      var pin = girdi.value.trim();
      if(!/^\d{4}$/.test(pin)){ hataGoster("PIN 4 haneli rakam olmalı."); return; }
      btn.disabled = true; btn.textContent = "⏳ Kaydediliyor...";
      pinHashHesapla(pin).then(function(hash){
        CihazData.pinKaydet(id, hash, function(basarili, hata){
          btn.disabled = false; btn.textContent = "✓ Kaydet";
          if(!basarili) hataGoster(hata || "PIN kaydedilemedi.");
        });
      }).catch(function(e){
        btn.disabled = false; btn.textContent = "✓ Kaydet";
        hataGoster("PIN hesaplanamadı: " + e.message);
      });
    };
  });
}

// EKLENDİ/GENİŞLETİLDİ (25.10.2026, "manuel cihaz gruplama") — artık hem
// otomatik (👤, aynı hesap) hem manuel (🏷️, Abdullah'ın elle oluşturduğu)
// gruplar AYNI popup'ı paylaşıyor. manuelGrupId SADECE manuel gruplarda
// dolu gelir -> "Yeniden Adlandır"/"Grubu Dağıt" yönetim satırı ve her
// karttaki "Gruptan Çıkar" düğmesi SADECE bu durumda görünür.
function czGrupPopupAc(ikon, baslik, cihazlar, manuelGrupId){
  var overlay = document.getElementById("czGrupOverlay");
  if(!overlay) return;
  document.getElementById("czGrupBaslik").textContent = ikon + " " + baslik;
  document.getElementById("czGrupSayi").textContent = "— " + cihazlar.length + " cihaz";
  var altYazi = document.getElementById("czGrupAltYazi");
  if(altYazi) altYazi.textContent = manuelGrupId ? "Elle oluşturduğun grup" : "Bu hesapla giriş yapmış, onaylı cihazlar";
  var benimId = CihazData.benimIdim();
  var liste = document.getElementById("czGrupPopupListe");
  liste.innerHTML = cihazlar.map(function(c){ return czAktifKartHtml(c, benimId, manuelGrupId); }).join("");
  czKartButonlariniBagla(liste);

  liste.querySelectorAll(".cz-gruptan-cikar-btn").forEach(function(btn){
    btn.onclick = function(){
      var cihazId = this.getAttribute("data-id");
      var grupId = this.getAttribute("data-grup-id");
      this.disabled = true; this.textContent = "⏳ Çıkarılıyor...";
      CihazData.manuelGruptanCikar(grupId, cihazId, function(basarili, hata){
        if(!basarili){
          hataGoster(hata || "Cihaz gruptan çıkarılamadı.");
          return;
        }
        // Firebase dinleyicisi ana listeyi zaten yeniden çizecek — popup'ı
        // kapatıyoruz ki eski (artık yanlış) üye sayısıyla açık kalmasın.
        overlay.hidden = true;
      });
    };
  });

  var yonetimAlani = document.getElementById("czGrupYonetimAlani");
  if(yonetimAlani){
    if(manuelGrupId){
      yonetimAlani.hidden = false;
      yonetimAlani.innerHTML = "<div class='cz-grup-yonetim-satir'>"
        + "<button type='button' class='cz-grup-yeniden-adlandir-btn' id='czGrupYenidenAdlandirBtn'>✏️ Yeniden Adlandır</button>"
        + "<button type='button' class='cz-grup-dagit-btn' id='czGrupDagitBtn'>🗑 Grubu Dağıt</button>"
        + "</div>";
      document.getElementById("czGrupYenidenAdlandirBtn").onclick = function(){
        var yeniIsim = prompt("Yeni grup adı:", baslik);
        if(yeniIsim === null) return;
        yeniIsim = yeniIsim.trim();
        if(!yeniIsim){ hataGoster("Grup adı boş olamaz."); return; }
        CihazData.manuelGrubuYenidenAdlandir(manuelGrupId, yeniIsim, function(basarili, hata){
          if(!basarili) hataGoster(hata || "Grup adı değiştirilemedi.");
          else overlay.hidden = true;
        });
      };
      document.getElementById("czGrupDagitBtn").onclick = function(){
        if(!confirm("\"" + baslik + "\" grubu dağıtılsın mı? Cihazlar SİLİNMEZ, sadece gruplama kaldırılır.")) return;
        CihazData.manuelGrubuDagit(manuelGrupId, function(basarili, hata){
          if(!basarili) hataGoster(hata || "Grup dağıtılamadı.");
          else overlay.hidden = true;
        });
      };
    } else {
      yonetimAlani.hidden = true;
      yonetimAlani.innerHTML = "";
    }
  }

  overlay.hidden = false;
}

function cihazListesiniCiz(liste){
  try{
    ckSonCihazListesi = liste; // YENİ — kullanıcı kartlarındaki cihaz sayısı/sınırı için
    var kapsayici = document.getElementById("czListe");
    var bos = document.getElementById("czBos");
    if(!liste.length){
      kapsayici.innerHTML = "";
      bos.hidden = false;
      czBekleyenListesiniCiz([]);
      ceListeyiCiz(ckSonKullanicilarVeri);
      return;
    }
    bos.hidden = true;

    var benimId = CihazData.benimIdim();

    // YENİ — onay bekleyenler ayrı bir bölümde, bu listenin tamamen
    // dışında gösteriliyor.
    var bekleyenler = liste.filter(function(c){ return !c.engelli && c.onayDurumu === "bekliyor"; });
    czBekleyenListesiniCiz(bekleyenler);

    var aktifler = liste.filter(function(c){ return !c.engelli && c.onayDurumu !== "bekliyor"; });
    var engellenenler = liste.filter(function(c){ return c.engelli; });

    // EKLENDİ (25.10.2026, "manuel cihaz gruplama") — önce hangi cihazın
    // hangi MANUEL gruba ait olduğunu bul. Manuel gruba alınmış bir cihaz
    // artık otomatik (aynı hesap) gruplamaya KARIŞMAZ — manuel grup her
    // zaman önceliklidir, çünkü Abdullah'ın kendi elleriyle verdiği karar.
    var manuelGrupIdByCihaz = {};
    Object.keys(ckSonManuelGruplar).forEach(function(grupId){
      var g = ckSonManuelGruplar[grupId];
      if(!g || !g.cihazlar) return;
      Object.keys(g.cihazlar).forEach(function(cihazId){ manuelGrupIdByCihaz[cihazId] = grupId; });
    });

    // YENİ — aynı hesapla (sonGirisHesabi) giriş yapmış, 2+ cihazı olan
    // hesapları grupla; tek cihazı olanlar eskisi gibi tek tek kalır.
    // (Manuel gruba alınmış cihazlar bu sayıma dahil edilmez.)
    var hesapSayaci = {};
    aktifler.forEach(function(c){
      if(manuelGrupIdByCihaz[c.id]) return;
      if(c.sonGirisHesabi) hesapSayaci[c.sonGirisHesabi] = (hesapSayaci[c.sonGirisHesabi]||0) + 1;
    });
    var tekler = [];
    var gruplar = {};
    var manuelGruplarGosterim = {};
    aktifler.forEach(function(c){
      var manuelGrupId = manuelGrupIdByCihaz[c.id];
      if(manuelGrupId){
        (manuelGruplarGosterim[manuelGrupId] = manuelGruplarGosterim[manuelGrupId] || []).push(c);
      } else if(c.sonGirisHesabi && hesapSayaci[c.sonGirisHesabi] >= 2){
        (gruplar[c.sonGirisHesabi] = gruplar[c.sonGirisHesabi] || []).push(c);
      } else {
        tekler.push(c);
      }
    });
    // Firebase'de hâlâ kayıtlı ama artık 2'den az aktif cihazı kalmış bir
    // manuel grup (ör. biri engellendi) "grup" olarak gösterilmez — kalan
    // tek cihaz normal tekli kart olarak listeye döner.
    Object.keys(manuelGruplarGosterim).forEach(function(grupId){
      if(manuelGruplarGosterim[grupId].length < 2){
        tekler = tekler.concat(manuelGruplarGosterim[grupId]);
        delete manuelGruplarGosterim[grupId];
      }
    });

    var html = tekler.map(function(c){ return czAktifKartHtml(c, benimId, null, czSecimModuAcikMi); }).join("");
    html += Object.keys(gruplar).sort().map(function(hesapAdi){
      return czGrupSatiriHtml(hesapAdi, gruplar[hesapAdi]);
    }).join("");
    // YENİ — manuel gruplar (🏷️), otomatik gruplardan sonra listelenir.
    html += Object.keys(manuelGruplarGosterim).map(function(grupId){
      var g = ckSonManuelGruplar[grupId] || {};
      return czManuelGrupSatiriHtml(grupId, g.isim || "İsimsiz Grup", manuelGruplarGosterim[grupId]);
    }).join("");

    if(engellenenler.length){
      html += "<button type='button' class='cz-engellenenler-toggle' id='czEngellenenlerToggle'>🚫 Engellenen cihazlar (" + engellenenler.length + ") " + (czEngellenenlerAcikMi ? "▴" : "▾") + "</button>"
        + "<div class='cz-engellenenler-alan' id='czEngellenenlerAlan'" + (czEngellenenlerAcikMi ? "" : " hidden") + ">"
        + engellenenler.map(czEngellenmisKartHtml).join("")
        + "</div>";
    }

    kapsayici.innerHTML = html;
    czKartButonlariniBagla(kapsayici);

    // YENİ — grup satırına tıklanınca popup aç (otomatik ve manuel ayrı
    // seçicilerle bağlanıyor, çünkü manuel satır da .cz-grup-satir taşıyor)
    kapsayici.querySelectorAll(".cz-grup-satir:not(.cz-grup-satir--manuel)").forEach(function(btn){
      btn.onclick = function(){
        var hesapAdi = btn.getAttribute("data-hesap");
        czGrupPopupAc("👤", hesapAdi, gruplar[hesapAdi] || [], null);
      };
    });
    kapsayici.querySelectorAll(".cz-grup-satir--manuel").forEach(function(btn){
      btn.onclick = function(){
        var grupId = btn.getAttribute("data-grup-id");
        var g = ckSonManuelGruplar[grupId] || {};
        czGrupPopupAc("🏷️", g.isim || "İsimsiz Grup", manuelGruplarGosterim[grupId] || [], grupId);
      };
    });

    // EKLENDİ (25.10.2026, "manuel cihaz gruplama") — seçim modu açıkken
    // her tekli kartın başındaki kutucuk işaretlenince seçili cihaz
    // kümesini ve seçim çubuğundaki sayıyı/düğmeyi güncelle.
    if(czSecimModuAcikMi){
      kapsayici.querySelectorAll(".cz-kart-checkbox").forEach(function(kutu){
        kutu.onchange = function(){
          var id = this.getAttribute("data-id");
          if(this.checked) czSeciliCihazlar[id] = true;
          else delete czSeciliCihazlar[id];
          czSecimCubuguGuncelle();
        };
      });
    }
    czSecimCubuguGuncelle();

    var toggleBtn = document.getElementById("czEngellenenlerToggle");
    if(toggleBtn){
      toggleBtn.onclick = function(){
        czEngellenenlerAcikMi = !czEngellenenlerAcikMi;
        var alan = document.getElementById("czEngellenenlerAlan");
        if(alan) alan.hidden = !czEngellenenlerAcikMi;
        this.textContent = this.textContent.replace(/[▾▴]/, czEngellenenlerAcikMi ? "▴" : "▾");
      };
    }

    kapsayici.querySelectorAll(".cz-kaldir-btn").forEach(function(btn){
      btn.onclick = function(){
        var id = this.getAttribute("data-id");
        CihazData.engeliKaldir(id, function(basarili, hata){
          if(!basarili) hataGoster(hata || "Engel kaldırılamadı.");
        });
      };
    });
    kapsayici.querySelectorAll(".cz-sil-btn").forEach(function(btn){
      btn.onclick = function(){
        var id = this.getAttribute("data-id");
        var ad = this.getAttribute("data-ad");
        if(!confirm("\"" + ad + "\" cihaz kaydı KALICI olarak silinsin mi? Bu işlem geri alınamaz.")) return;
        btn.disabled = true;
        CihazData.cihaziSil(id, function(basarili, hata){
          if(!basarili){ btn.disabled = false; hataGoster(hata || "Cihaz silinemedi."); }
          // başarılıysa Firebase dinleyicisi listeyi zaten yeniden çizecek
        });
      };
    });

    // YENİ — cihaz verisi değiştiyse kullanıcı kartlarındaki cihaz sayısı/
    // sınır uyarısı da güncel kalsın diye kullanıcı listesi de yeniden çizilir.
    ceListeyiCiz(ckSonKullanicilarVeri);
  }catch(e){ hataGoster("Cihaz listesi çizilemedi: " + e.message); }
}

/* ========================================================================
   EKLENDİ (25.10.2026, "manuel cihaz gruplama" özelliği, Abdullah'ın
   isteğiyle) — "Seç" butonu, seçim çubuğu ve grup adı verme sheet'i.
   Mockup'ta onaylanan akış: Seç -> cihazları işaretle -> Grup Oluştur ->
   isim ver -> Kaydet. "Seç" butonu aynı zamanda "✕ Vazgeç" olarak da
   çalışır (seçim modundan çıkar, işaretlenenleri temizler).
   ======================================================================== */
function czSecimCubuguGuncelle(){
  var cubuk = document.getElementById("czSecimCubugu");
  var sayiEl = document.getElementById("czSecimSayi");
  var gruplaBtn = document.getElementById("czSecimGruplaBtn");
  if(!cubuk || !sayiEl || !gruplaBtn) return;
  cubuk.hidden = !czSecimModuAcikMi;
  var seciliSayi = Object.keys(czSeciliCihazlar).length;
  sayiEl.textContent = seciliSayi + " cihaz seçildi";
  gruplaBtn.disabled = seciliSayi < 2;
}

function czSecModuTiklandi(){
  czSecimModuAcikMi = !czSecimModuAcikMi;
  czSeciliCihazlar = {};
  var btn = document.getElementById("czSecModuBtn");
  if(btn){
    btn.textContent = czSecimModuAcikMi ? "✕ Vazgeç" : "☑️ Seç";
    btn.classList.toggle("cz-sec-modu-btn--aktif", czSecimModuAcikMi);
  }
  cihazListesiniCiz(ckSonCihazListesi);
}

function czManuelGrupAdSheetAc(){
  var seciliSayi = Object.keys(czSeciliCihazlar).length;
  if(seciliSayi < 2){ hataGoster("Grup oluşturmak için en az 2 cihaz seç."); return; }
  var overlay = document.getElementById("czManuelGrupAdOverlay");
  var altYazi = document.getElementById("czManuelGrupAdAltYazi");
  var girdi = document.getElementById("czManuelGrupAdInput");
  if(!overlay || !girdi) return;
  if(altYazi) altYazi.textContent = "Bu " + seciliSayi + " cihaz, verdiğin isimle birlikte tek satırda görünecek.";
  girdi.value = "";
  overlay.hidden = false;
  girdi.focus();
}

function czManuelGrupAdKaydetTiklandi(){
  var girdi = document.getElementById("czManuelGrupAdInput");
  var isim = girdi ? girdi.value.trim() : "";
  if(!isim){ hataGoster("Grup adı boş olamaz."); return; }
  var btn = document.getElementById("czManuelGrupAdKaydetBtn");
  var cihazIdleri = Object.keys(czSeciliCihazlar);
  if(btn){ btn.disabled = true; btn.textContent = "⏳ Oluşturuluyor..."; }
  CihazData.manuelGrupOlustur(isim, cihazIdleri, function(basarili, hata){
    if(btn){ btn.disabled = false; btn.textContent = "✓ Grubu Oluştur"; }
    if(!basarili){ hataGoster(hata || "Grup oluşturulamadı."); return; }
    document.getElementById("czManuelGrupAdOverlay").hidden = true;
    czSecModuTiklandi(); // seçim modundan çık, işaretlenenleri temizle, listeyi yenile
  });
}

/* ========================================================================
   👥 KULLANICILAR (şifreli giriş hesapları) — calisan-erisim-render.js'ten
   BİREBİR taşındı. Şifre değiştirme arayüzü BİLEREK yok — "kullanıcı kendi
   şifresini değiştiremez" net kuralı bu şekilde korunuyor.
   ======================================================================== */
var IZIN_TANIMLARI = [
  { grup: "Satış İşlemleri", sayfalar: [
    { anahtar: "hesapla", etiket: "🧮 Hızlı Hesapla (bağımsız, müşterisiz)" },
    { anahtar: "sepet", etiket: "🛒 Ürün Bul / Hesapla / Sepet (birleşik sayfa)" },
    { anahtar: "gonder", etiket: "📤 Gönder" }
  ]},
  { grup: "🛒 Sayfası İçin İnce Ayar", varsayilanAcik: true, sayfalar: [
    { anahtar: "sepetAramaGoster", etiket: "🔍 Arama kutusu ve ürün listesini görebilsin" },
    { anahtar: "sepetWebAc", etiket: "🌐 Ürüne dokununca WEICON sayfasını açabilsin" },
    { anahtar: "sepetHesaplaAc", etiket: "🧮 \"H\" — Hızlı Hesapla penceresini açabilsin" },
    { anahtar: "sepetSec", etiket: "➕ \"SEÇ\" — ürünü Hesaplanacak'a ekleyebilsin" },
    { anahtar: "sepetAiAc", etiket: "🤖 Ürüne uzun basınca AI Ürün Asistanı panelini açabilsin" },
    { anahtar: "sepetHesaplandiGoster", etiket: "🟢 Hesaplandı listesini görebilsin" },
    { anahtar: "sepetGonder", etiket: "✓ Kaydet / 📋 Formu Görüntüle yapabilsin" },
    // EKLENDİ (22.10.2026, Abdullah'ın isteğiyle) — "Hit Ürünler", "Yeni
    // Ürün Ekle" ve bu sayfadaki "Beklet" düğmesi ayrı ayrı kısıtlanabilsin.
    { anahtar: "sepetHitGoster", etiket: "🔥 \"HİT\" — Hit Ürünler listesini açabilsin" },
    { anahtar: "sepetYeniUrunGoster", etiket: "➕ \"YENİ\" — Yeni Ürün Ekle'yi açabilsin" },
    { anahtar: "sepetBekletGoster", etiket: "📥 Bu sayfada \"Beklet\" düğmesini görebilsin" }
  ]},
  { grup: "Müşteri", sayfalar: [
    { anahtar: "musteriBul", etiket: "🔍 Müşteri Bul" },
    { anahtar: "islemGecmisi", etiket: "🕐 İşlem Geçmişi" }
  ]},
  { grup: "Raporlar ve Takip", sayfalar: [
    { anahtar: "raporlar", etiket: "📊 Raporlar" },
    { anahtar: "satisListesi", etiket: "📋 Satış Listesi" },
    { anahtar: "hareketler", etiket: "🔁 Hareketler" },
    { anahtar: "ziyaret", etiket: "📍 Ziyaret" },
    { anahtar: "takipGerekenler", etiket: "📌 Takip Gerekenler" },
    { anahtar: "gorevler", etiket: "✅ Görevler" },
    { anahtar: "vadeTakip", etiket: "📅 Vade Takip" }
  ]},
  { grup: "Maaş ve Finans", sayfalar: [
    { anahtar: "maasHesaplama", etiket: "💰 Maaş Hesaplama" },
    { anahtar: "netMaasHesaplama", etiket: "💵 Net Maaş Hesaplama" },
    { anahtar: "avansTakibi", etiket: "💳 Avans Takibi" },
    { anahtar: "odenebilirKomisyon", etiket: "🧾 Ödenebilir Komisyon" }
  ]},
  { grup: "Diğer", sayfalar: [
    { anahtar: "anaSayfa", etiket: "🏠 Ana Sayfa" },
    { anahtar: "kmTakip", etiket: "🚗 KM Takip" },
    { anahtar: "bildirimler", etiket: "🔔 Bildirimler" },
    // EKLENDİ (23.10.2026, Abdullah'ın isteğiyle) — "Marka Karşılaştırma".
    { anahtar: "markaKarsilastirma", etiket: "🔄 Marka Karşılaştırma" }
  ]},
  // EKLENDİ (22.10.2026, Abdullah'ın isteğiyle) — "Beklet" düğmesi önce
  // SADECE Ürün Bul/Sepet sayfasında (sepetBekletGoster, yukarıdaki grupta)
  // kısıtlanabiliyordu; şimdi HER sayfa alanında ayrı ayrı kısıtlanabilsin
  // diye genişletildi (bkz. bekleyen-islemler.js BI_SAYFA_BEKLET_ANAHTARI —
  // iki dosya senkron olmalı). Ürün Bul/Sepet zaten kendi anahtarını
  // kullanıyor, burada TEKRAR edilmedi.
  { grup: "📥 Beklet (Bekleyen İşlemler)", varsayilanAcik: true, sayfalar: [
    { anahtar: "bekletHesapla", etiket: "🧮 Hızlı Hesapla sayfasında" },
    { anahtar: "bekletGonder", etiket: "📤 Gönder sayfasında" },
    { anahtar: "bekletMusteri", etiket: "🔍 Müşteri sayfalarında" },
    { anahtar: "bekletGecmis", etiket: "🕐 İşlem Geçmişi sayfasında" },
    { anahtar: "bekletRaporlar", etiket: "📊 Raporlar sayfalarında" },
    { anahtar: "bekletSatisListesi", etiket: "📋 Satış Listesi sayfasında" },
    { anahtar: "bekletHareketler", etiket: "🔁 Hareketler sayfasında" },
    { anahtar: "bekletZiyaret", etiket: "📍 Ziyaret sayfasında" },
    { anahtar: "bekletTakipGerekenler", etiket: "📌 Takip Gerekenler sayfasında" },
    { anahtar: "bekletGorevler", etiket: "✅ Görevler sayfasında" },
    { anahtar: "bekletVadeTakip", etiket: "📅 Vade Takip sayfasında" },
    { anahtar: "bekletMaasHesaplama", etiket: "💰 Maaş Hesaplama sayfasında" },
    { anahtar: "bekletNetMaas", etiket: "💵 Net Maaş Hesaplama sayfasında" },
    { anahtar: "bekletAvans", etiket: "💳 Avans Takibi sayfasında" },
    { anahtar: "bekletKomisyon", etiket: "🧾 Ödenebilir Komisyon sayfasında" },
    { anahtar: "bekletAnaSayfa", etiket: "🏠 Ana Sayfa'da" },
    { anahtar: "bekletKm", etiket: "🚗 KM Takip sayfasında" },
    { anahtar: "bekletBildirimler", etiket: "🔔 Bildirimler sayfasında" },
    // EKLENDİ (23.10.2026, Abdullah'ın isteğiyle) — "Marka Karşılaştırma".
    { anahtar: "bekletMarkaKarsilastirma", etiket: "🔄 Marka Karşılaştırma sayfasında" }
  ]}
];

function ceIkinciFirebaseApp(){
  var ikinciAdi = "calisanOlusturucu";
  var mevcutListe = firebase.apps.filter(function(a){ return a.name === ikinciAdi; });
  return mevcutListe.length ? mevcutListe[0] : firebase.initializeApp(ISTAKIP_FIREBASE_CONFIG, ikinciAdi);
}

function ceVarsayilanIzinler(){
  return { hesapla: true };
}

function ceKullaniciOlustur(kullaniciAdiGirilen, sifre, cb){
  var kullaniciAdi = String(kullaniciAdiGirilen||"").trim().toLowerCase().replace(/\s+/g,"");
  if(!kullaniciAdi || !sifre){ cb(false, "Kullanıcı adı ve şifre girin."); return; }
  if(sifre.length < 6){ cb(false, "Şifre en az 6 karakter olmalı."); return; }
  var email = kullaniciAdi + ISTAKIP_CALISAN_EMAIL_DOMAINI;
  var ikincilApp;
  try{ ikincilApp = ceIkinciFirebaseApp(); }
  catch(e){ cb(false, "İkincil oturum başlatılamadı: " + e.message); return; }

  ikincilApp.auth().createUserWithEmailAndPassword(email, sifre).then(function(sonuc){
    var uid = sonuc.user.uid;
    return ikincilApp.auth().signOut().then(function(){
      return firebase.database().ref("kisitliKullanicilar/" + uid).set({
        kullaniciAdi: kullaniciAdi,
        aktif: true,
        izinler: ceVarsayilanIzinler(),
        olusturulma: Date.now()
      });
    });
  }).then(function(){
    // EKLENDİ (22.10.2026, Abdullah'ın isteğiyle) — "Giriş Linki" özelliği
    // için, hesap gerçekten hangi kullanıcı adıyla oluşturulduysa (boşluk/
    // büyük harf temizlenmiş hali) onu çağırana geri bildiriyoruz; böylece
    // link, formdaki ham girdiden değil, Firebase'e yazılan GERÇEK adından
    // üretilir.
    cb(true, null, kullaniciAdi);
  }).catch(function(e){
    var mesaj = (e && e.code === "auth/email-already-in-use")
      ? "Bu kullanıcı adı zaten kullanılıyor."
      : (e && e.message ? e.message : "bilinmeyen hata");
    cb(false, mesaj);
  });
}

function ceGrupHtml(uid, izinler, aktifMi){
  return IZIN_TANIMLARI.map(function(grup, grupIdx){
    var satirlar = grup.sayfalar.map(function(sayfa){
      var isaretli = grup.varsayilanAcik ? (izinler[sayfa.anahtar] !== false) : (izinler[sayfa.anahtar] === true);
      return '<label class="ce-grup-satir">' +
        '<span>' + sayfa.etiket + '</span>' +
        '<input type="checkbox" data-anahtar="' + sayfa.anahtar + '" ' + (isaretli ? "checked" : "") + (aktifMi ? "" : " disabled") + '>' +
        '</label>';
    }).join("");
    return '<details class="ce-grup"' + (grupIdx === 0 ? " open" : "") + '>' +
      '<summary>' + grup.grup + '</summary>' +
      '<div class="ce-grup-liste">' + satirlar + '</div>' +
      '</details>';
  }).join("");
}

function ceAcikSayfaSayisi(izinler){
  var sayac = 0;
  IZIN_TANIMLARI.forEach(function(grup){
    if(grup.varsayilanAcik) return;
    grup.sayfalar.forEach(function(sayfa){ if(izinler[sayfa.anahtar] === true) sayac++; });
  });
  return sayac;
}

// EKLENDİ (25.10.2026, "cihaz sınırı" özelliği, Abdullah'ın isteğiyle) —
// bu hesapla (kullaniciAdi = auth.js'teki sonGirisHesabi) giriş yapmış,
// hâlâ onaylı VE engellenmemiş cihaz sayısı. ckSonCihazListesi,
// cihazListesiniCiz tarafından her cihaz güncellemesinde tazeleniyor.
function ceCihazSayisi(kullaniciAdi){
  if(!kullaniciAdi) return 0;
  return ckSonCihazListesi.filter(function(c){
    return !c.engelli && c.onayDurumu !== "bekliyor" && c.sonGirisHesabi === kullaniciAdi;
  }).length;
}

// EKLENDİ (22.10.2026, Abdullah'ın isteğiyle) — Her kullanıcı için, giriş
// sayfasında o kullanıcının adını otomatik dolduran bir link üretir.
// Şifre linkte YOKTUR — çalışan şifreyi yine kendisi elle yazar (yeni bir
// Cloud Function / sunucu tarafı GEREKTİRMEZ, Abdullah'ın bu seçeneği
// tercih etmesiyle netleşti). Link her zaman GERÇEK kullanıcı adından
// üretilir, böylece kullanıcı adı ne olursa olsun link de otomatik
// doğru olur — ayrıca bir "link oluştur" adımına gerek kalmaz.
function ceGirisLinkiOlustur(kullaniciAdi){
  var klasorYolu = window.location.pathname.replace(/[^/]*$/, "");
  return window.location.origin + klasorYolu + "login.html?kullanici=" + encodeURIComponent(kullaniciAdi || "");
}

// Bir "Giriş Linki" kutusunun 📋 Kopyala düğmesini bağlar — hem kullanıcı
// kartlarında hem de "➕ Yeni Kullanıcı" formunun altındaki tek seferlik
// onay kutusunda AYNI fonksiyon kullanılıyor.
function ceLinkKopyalaBtnBagla(kopyalaBtn, linkInput, kopyalandiEl){
  if(!kopyalaBtn || !linkInput || !kopyalandiEl) return;
  kopyalaBtn.onclick = function(){
    var kopyalaBasarili = function(){
      kopyalandiEl.hidden = false;
      setTimeout(function(){ kopyalandiEl.hidden = true; }, 2000);
    };
    var yedekYontem = function(){
      try{
        linkInput.select();
        document.execCommand("copy");
        kopyalaBasarili();
      }catch(e){ hataGoster("Link kopyalanamadı: " + e.message); }
    };
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(linkInput.value).then(kopyalaBasarili).catch(yedekYontem);
    } else {
      yedekYontem();
    }
  };
}

// YENİDEN TASARLANDI (25.10.2026, Abdullah'ın isteğiyle — kart çok yer
// kaplıyordu). Kart artık tek satır: ad + özet + "İzinler, Cihaz Sınırı ve
// Link" butonu. Giriş linki, izin grupları (.ce-grup) ve YENİ "Cihaz
// sınırı" alanı ortak #ceIzinOverlay popup'ına taşındı (bkz. ceIzinPopupAc).
function ceKullaniciKartHtml(uid, veri){
  var izinler = veri.izinler || {};
  var aktifMi = veri.aktif !== false;
  var ozetParcalari = [aktifMi ? (ceAcikSayfaSayisi(izinler) + " sayfa açık") : "devre dışı"];

  var cihazSayisi = ceCihazSayisi(veri.kullaniciAdi);
  if(cihazSayisi > 0){
    var sinir = veri.cihazSiniri;
    var cihazMetni = cihazSayisi + " cihaz";
    if(sinir && cihazSayisi >= sinir) cihazMetni += ' <span class="ce-ozet-uyari">(sınır ' + sinir + " ⚠️)</span>";
    ozetParcalari.push(cihazMetni);
  }

  return '<section class="ce-kart ce-kart--kompakt" data-uid="' + uid + '" data-kullanici-adi="' + htmlEsc(veri.kullaniciAdi||"") + '">' +
    '<div class="ce-kullanici-ust">' +
      '<div class="ce-kullanici-ad' + (aktifMi ? "" : " ce-kullanici-ad--devredisi") + '">👤 ' + (veri.kullaniciAdi||"?") + '</div>' +
      (aktifMi ? '<button class="ce-devre-disi-btn" data-aksiyon="devredisi" title="Devre dışı bırak">🗑</button>' : "") +
    '</div>' +
    '<div class="ce-kullanici-ozet">' + ozetParcalari.join(" · ") + '</div>' +
    (aktifMi ? "" : '<div class="ce-devredisi-rozet">⛔ Bu hesap devre dışı — hiçbir sayfaya girilemez</div>') +
    // EKLENDİ (22.10.2026, "Kalıcı Olarak Sil" özelliği, Abdullah'ın isteğiyle)
    // — bu hesabın cihazı daha önce KALICI OLARAK SİLİNMİŞ başka bir hesaba
    // ait çıktıysa (auth.js -> cihazEngelUyarisiYaz), Abdullah'ı uyar.
    (veri.cihazEngellendiUyarisi ? '<div class="ce-cihaz-uyari-rozet">⚠️ UYARI: Bu hesaba giriş yapan bir cihaz, daha önce kalıcı olarak sildiğin bir hesaba ait. O cihazdan giriş otomatik engellendi.</div>' : "") +
    (aktifMi
      ? '<button type="button" class="ce-izin-ac-btn" data-aksiyon="izinAc">⚙️ İzinler, Cihaz Sınırı ve Link ›</button>'
      : '<button class="ce-yeniden-etkinlestir-btn" data-aksiyon="etkinlestir">↺ Yeniden Etkinleştir</button>' +
        // EKLENDİ (22.10.2026, "Kalıcı Olarak Sil" özelliği, Abdullah'ın
        // isteğiyle) — SADECE devre dışı hesaplarda görünür (önce devre
        // dışı bırakılmış olması gerekiyor), aynı onaylanmış mockup.
        '<button class="ce-kalici-sil-btn" data-aksiyon="kalicisil">🗑 Kalıcı Olarak Sil</button>'
    ) +
    '</section>';
}

// YENİ — tek paylaşılan izin/cihaz sınırı popup'ını bir kullanıcı için
// doldurup açar. Checkbox'lar artık ".ce-kart" içinde DEĞİL, bu popup'ta
// yaşıyor — bu yüzden ceListeyiCiz'in liste yeniden çizimleri (ör. cihaz
// sayısı değiştiğinde) popup açıkken bile canlı işaretlemeleri BOZMAZ
// (eskiden .ce-kart içindeki kutucuklar için gereken "düzenlemede" koruma
// mekanizması, checkbox'lar karttan tamamen ayrıldığı için artık gerekmiyor).
function ceIzinPopupAc(uid, veri){
  var overlay = document.getElementById("ceIzinOverlay");
  if(!overlay) return;
  var izinler = veri.izinler || {};
  var aktifMi = veri.aktif !== false;

  document.getElementById("ceIzinBaslik").textContent = "👤 " + (veri.kullaniciAdi||"?");
  document.getElementById("ceIzinLinkKutu").value = ceGirisLinkiOlustur(veri.kullaniciAdi);
  document.getElementById("ceIzinGruplar").innerHTML = ceGrupHtml(uid, izinler, aktifMi);

  var sinirInput = document.getElementById("ceIzinSinirInput");
  sinirInput.value = (veri.cihazSiniri != null) ? veri.cihazSiniri : "";

  var cihazSayisi = ceCihazSayisi(veri.kullaniciAdi);
  var uyariEl = document.getElementById("ceIzinSinirUyari");
  if(veri.cihazSiniri && cihazSayisi >= veri.cihazSiniri){
    uyariEl.hidden = false;
    uyariEl.textContent = "⚠️ Sınır doldu — " + cihazSayisi + " onaylı cihaz var, sınır " + veri.cihazSiniri + ". Yeni cihazlar yine de \"Onay Bekleyen\" listesine düşer, istersen onaylayabilirsin.";
  } else {
    uyariEl.hidden = true;
  }

  ceLinkKopyalaBtnBagla(
    document.getElementById("ceIzinLinkKopyalaBtn"),
    document.getElementById("ceIzinLinkKutu"),
    document.getElementById("ceIzinLinkKopyalandi")
  );

  var kaydetBtn = document.getElementById("ceIzinKaydetBtn");
  kaydetBtn.disabled = false;
  kaydetBtn.textContent = "✓ Kaydet";
  kaydetBtn.onclick = function(){
    var yeniIzinler = {};
    document.querySelectorAll('#ceIzinGruplar input[type="checkbox"][data-anahtar]').forEach(function(kutu){
      yeniIzinler[kutu.getAttribute("data-anahtar")] = kutu.checked;
    });
    var sinirHam = sinirInput.value.trim();
    var sinirYeni = sinirHam === "" ? null : Math.max(1, parseInt(sinirHam, 10) || 1);

    kaydetBtn.disabled = true;
    kaydetBtn.textContent = "⏳ Kaydediliyor...";
    Promise.all([
      firebase.database().ref("kisitliKullanicilar/" + uid + "/izinler").set(yeniIzinler),
      firebase.database().ref("kisitliKullanicilar/" + uid + "/cihazSiniri").set(sinirYeni)
    ]).then(function(){
      kaydetBtn.disabled = false;
      kaydetBtn.textContent = "✓ Kaydet";
      overlay.hidden = true;
    }).catch(function(e){
      kaydetBtn.disabled = false;
      kaydetBtn.textContent = "✓ Kaydet";
      hataGoster("İzinler kaydedilemedi: " + e.message);
      alert("İşlem başarısız: " + e.message);
    });
  };

  overlay.hidden = false;
}

// NOT (25.10.2026, kompakt kart/popup yeniden tasarımı sırasında kaldırıldı)
// — 22.10.2026'da eklenmiş "ceDuzenlemedeOlanKartlar" korumasının (HİT/YENİ
// hatasının kök nedeni düzeltmesi) tek amacı, bir kartın İZİN KUTUCUKLARI
// henüz "Kaydet" ile onaylanmadan bu yeniden çizim tarafından sessizce
// ezilmesini önlemekti. İzin kutucukları artık ".ce-kart" içinde DEĞİL,
// ayrı/paylaşılan #ceIzinOverlay popup'ında yaşıyor (bkz. ceIzinPopupAc) —
// bu yeniden çizim artık o popup'a hiç dokunmuyor, dolayısıyla korumanın
// önlediği senaryo mimari olarak imkânsız hale geldi; mekanizma bu yüzden
// kaldırıldı, basit bir innerHTML yeniden kurulumuna dönüldü.
function ceListeyiCiz(tumKullanicilar){
  var kapsayici = document.getElementById("ceKullaniciListesi");
  var bosMesaj = document.getElementById("ceBosMesaj");
  // EKLENDİ (22.10.2026, "Kalıcı Olarak Sil" özelliği) — "silindi:true"
  // işaretli (kalıcı olarak silinmiş) kayıtlar ASLA listede gösterilmez.
  // Kayıt Firebase'den TAMAMEN KALDIRILMIYOR (bkz. kisitliSayfaKontrolu'daki
  // !snap.exists() -> tam erişim tuzağı) — sadece burada, görüntüde gizleniyor.
  var uidler = Object.keys(tumKullanicilar||{}).filter(function(uid){
    return !(tumKullanicilar[uid] || {}).silindi;
  });
  if(!uidler.length){
    kapsayici.innerHTML = "";
    bosMesaj.hidden = false;
    return;
  }
  bosMesaj.hidden = true;

  kapsayici.innerHTML = uidler.map(function(uid){
    return ceKullaniciKartHtml(uid, tumKullanicilar[uid] || {});
  }).join("");

  kapsayici.querySelectorAll(".ce-kart").forEach(function(kart){
    var uid = kart.getAttribute("data-uid");

    var izinAcBtn = kart.querySelector('[data-aksiyon="izinAc"]');
    if(izinAcBtn){
      izinAcBtn.onclick = function(){ ceIzinPopupAc(uid, tumKullanicilar[uid] || {}); };
    }

    var devreDisiBtn = kart.querySelector('[data-aksiyon="devredisi"]');
    if(devreDisiBtn){
      devreDisiBtn.onclick = function(){
        if(!confirm("Bu hesabı devre dışı bırakmak istediğine emin misin? Hesap hiçbir sayfaya girilemeyecek hale gelir.")) return;
        firebase.database().ref("kisitliKullanicilar/" + uid + "/aktif").set(false).catch(function(e){
          hataGoster("Hesap devre dışı bırakılamadı: " + e.message);
          alert("İşlem başarısız: " + e.message);
        });
      };
    }

    var etkinlestirBtn = kart.querySelector('[data-aksiyon="etkinlestir"]');
    if(etkinlestirBtn){
      etkinlestirBtn.onclick = function(){
        firebase.database().ref("kisitliKullanicilar/" + uid + "/aktif").set(true).catch(function(e){
          hataGoster("Hesap yeniden etkinleştirilemedi: " + e.message);
          alert("İşlem başarısız: " + e.message);
        });
      };
    }

    // EKLENDİ (22.10.2026, "Kalıcı Olarak Sil" özelliği, Abdullah'ın isteğiyle)
    // — İKİ ADIM: (1) bu hesabı kullanmış TÜM cihazları "cihazlar/{id}/engelli"
    // ile işaretle (auth.js'teki MEVCUT cihaz-engelleme mekanizmasının AYNISI
    // — aynı kişi başka isimle yeni hesap açsa bile o telefon bir daha asla
    // giremez), (2) hesabı GERÇEKTEN silmek yerine "silindi:true" ile
    // KAPATILMIŞ (tombstone) olarak işaretle — bkz. yukarıdaki not: düğümü
    // TAMAMEN kaldırmak kisitliSayfaKontrolu'nde "kayıt yok -> tam erişim"
    // tuzağına düşürür. Listeden gizlenmesi ceListeyiCiz'deki filtre ile
    // sağlanıyor.
    var kaliciSilBtn = kart.querySelector('[data-aksiyon="kalicisil"]');
    if(kaliciSilBtn){
      kaliciSilBtn.onclick = function(){
        var kullaniciAdiGosterim = kart.getAttribute("data-kullanici-adi") || "?";
        if(!confirm("\"" + kullaniciAdiGosterim + "\" hesabını KALICI OLARAK silmek istediğine emin misin?\n\n- Bu hesap listeden tamamen kaybolacak.\n- Bu hesabı daha önce kullanmış TÜM telefonlar bir daha asla sisteme giremeyecek (aynı kişiye başka isimle yeni hesap açsan bile).\n- Bu işlem GERİ ALINAMAZ.")) return;
        kaliciSilBtn.disabled = true;
        kaliciSilBtn.textContent = "⏳ Siliniyor...";
        firebase.database().ref("cihazlar").once("value").then(function(snap){
          var tumCihazlar = snap.val() || {};
          var guncellemeler = [];
          Object.keys(tumCihazlar).forEach(function(cihazId){
            if(tumCihazlar[cihazId] && tumCihazlar[cihazId].sonKullaniciUid === uid){
              guncellemeler.push(firebase.database().ref("cihazlar/" + cihazId + "/engelli").set(true));
            }
          });
          return Promise.all(guncellemeler);
        }).then(function(){
          return firebase.database().ref("kisitliKullanicilar/" + uid).set({
            kullaniciAdi: kullaniciAdiGosterim,
            aktif: false,
            silindi: true,
            silinmeTarihi: Date.now(),
            izinler: {}
          });
        }).catch(function(e){
          kaliciSilBtn.disabled = false;
          kaliciSilBtn.textContent = "🗑 Kalıcı Olarak Sil";
          hataGoster("Hesap kalıcı olarak silinemedi: " + e.message);
          alert("İşlem başarısız: " + e.message);
        });
      };
    }

  });
}

// EKLENDİ (25.10.2026, Abdullah'ın isteğiyle) — "🔐 Uygulama PIN Değiştir"
// artık Menü'den DEĞİL, buradan (Cihazlar ve Kullanıcılar — zaten S22+PIN
// ile kilitli admin alanı) yönetiliyor. BU, bu sayfanın KENDİ erişim
// PIN'inden (ckPinAlani / weicon_cihaz_pin_hash / Firebase "cihazPin")
// TAMAMEN AYRI bir şey — uygulama genelindeki 5 dk hareketsizlik kilidinin
// PIN'i (pin.html / weicon_pin_hash / Firebase "pin"). Akış menu-render.js'
// teki eski pinDegistirTiklandi ile BİREBİR aynı (pin-utils.js zaten bu
// sayfada da yüklü) — sadece konumu değişti, davranışı değişmedi.
function ckUygulamaPinDegistirTiklandi(){
  var mevcut = prompt("Mevcut uygulama kilidi PIN'ini girin (ilk kez ayarlıyorsan varsayılan: 1234):");
  if(mevcut === null) return;
  pinDogrula(mevcut.trim()).then(function(dogruMu){
    if(!dogruMu){ alert("Mevcut PIN hatalı."); return; }
    var yeni = prompt("Yeni 4 haneli PIN girin:");
    if(yeni === null) return;
    yeni = yeni.trim();
    if(!/^[0-9]{4}$/.test(yeni)){ alert("PIN 4 haneli rakamlardan oluşmalı."); return; }
    var tekrar = prompt("Yeni PIN'i tekrar girin:");
    if(tekrar === null) return;
    if(tekrar.trim() !== yeni){ alert("PIN'ler eşleşmiyor."); return; }
    pinHashHesapla(yeni).then(function(yeniHash){
      pinYeniHashKaydet(yeniHash);
      alert("✓ Uygulama kilidi PIN'i güncellendi.");
    });
  });
}

window.addEventListener("error", function(ev){
  hataGoster("HATA: " + ev.message + " (" + (ev.filename||"").split("/").pop() + ":" + ev.lineno + ")");
});

document.addEventListener("DOMContentLoaded", function(){
  tarihiGuncelle();
  var btnMenuEl = document.getElementById("btnMenu");
  if(btnMenuEl) btnMenuEl.onclick = function(){ window.location.href = "menu.html"; };
  buCihazKartiniHazirla();
  ckTusTakiminiOlustur();
  ckErisimKontrolEt();
  CihazData.kaydiGuncelle();

  // YENİ (25.10.2026, kompakt liste/popup yeniden tasarımı) — paylaşılan
  // iki popup'ın "Kapat" düğmeleri, sayfa başına bir kere bağlanır.
  var czGrupKapatBtn = document.getElementById("czGrupKapatBtn");
  if(czGrupKapatBtn) czGrupKapatBtn.onclick = function(){ document.getElementById("czGrupOverlay").hidden = true; };
  var ceIzinKapatBtn = document.getElementById("ceIzinKapatBtn");
  if(ceIzinKapatBtn) ceIzinKapatBtn.onclick = function(){ document.getElementById("ceIzinOverlay").hidden = true; };

  // EKLENDİ (25.10.2026, Abdullah'ın isteğiyle) — Menü'den taşınan
  // "Uygulama PIN'ini Değiştir" butonu.
  var btnCkUygulamaPinDegistir = document.getElementById("btnCkUygulamaPinDegistir");
  if(btnCkUygulamaPinDegistir) btnCkUygulamaPinDegistir.onclick = ckUygulamaPinDegistirTiklandi;

  // EKLENDİ (25.10.2026, "manuel cihaz gruplama" özelliği, Abdullah'ın
  // isteğiyle) — "Seç" / seçim çubuğu / grup adı verme sheet'i.
  var czSecModuBtn = document.getElementById("czSecModuBtn");
  if(czSecModuBtn) czSecModuBtn.onclick = czSecModuTiklandi;
  var czSecimGruplaBtn = document.getElementById("czSecimGruplaBtn");
  if(czSecimGruplaBtn) czSecimGruplaBtn.onclick = czManuelGrupAdSheetAc;
  var czManuelGrupAdKaydetBtn = document.getElementById("czManuelGrupAdKaydetBtn");
  if(czManuelGrupAdKaydetBtn) czManuelGrupAdKaydetBtn.onclick = czManuelGrupAdKaydetTiklandi;
  var czManuelGrupAdVazgecBtn = document.getElementById("czManuelGrupAdVazgecBtn");
  if(czManuelGrupAdVazgecBtn) czManuelGrupAdVazgecBtn.onclick = function(){
    document.getElementById("czManuelGrupAdOverlay").hidden = true;
  };
});
