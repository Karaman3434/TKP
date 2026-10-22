/*
  cihaz-kullanici-render.js — VERSİYON: WG.221026.1145.941
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

  firebase.database().ref("kisitliKullanicilar").on("value", function(snap){
    ceListeyiCiz(snap.val() || {});
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

function czAktifKartHtml(c, benimId){
  var buCihazMi = c.id === benimId;
  var rozet = buCihazMi ? "<span class='cz-kart-rozet cz-kart-rozet--bu'>Bu cihaz</span>" : "";
  var alt = buCihazMi
    ? ""
    : "<div class='cz-kart-alt'><button class='cz-engelle-btn' data-id='" + htmlEsc(c.id) + "' data-ad='" + htmlEsc(c.ad||"") + "'>🚫 Engelle</button></div>";

  return "<div class='cz-kart'>"
    + "<div class='cz-kart-ust'><span class='cz-kart-ad'>" + htmlEsc(c.ad || "Adsız Cihaz") + "</span>" + rozet + "</div>"
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

function cihazListesiniCiz(liste){
  try{
    var kapsayici = document.getElementById("czListe");
    var bos = document.getElementById("czBos");
    if(!liste.length){ kapsayici.innerHTML = ""; bos.hidden = false; return; }
    bos.hidden = true;

    var benimId = CihazData.benimIdim();
    var aktifler = liste.filter(function(c){ return !c.engelli; });
    var engellenenler = liste.filter(function(c){ return c.engelli; });

    var html = aktifler.map(function(c){ return czAktifKartHtml(c, benimId); }).join("");

    if(engellenenler.length){
      html += "<button type='button' class='cz-engellenenler-toggle' id='czEngellenenlerToggle'>🚫 Engellenen cihazlar (" + engellenenler.length + ") " + (czEngellenenlerAcikMi ? "▴" : "▾") + "</button>"
        + "<div class='cz-engellenenler-alan' id='czEngellenenlerAlan'" + (czEngellenenlerAcikMi ? "" : " hidden") + ">"
        + engellenenler.map(czEngellenmisKartHtml).join("")
        + "</div>";
    }

    kapsayici.innerHTML = html;

    kapsayici.querySelectorAll(".cz-gecmis-ac-btn").forEach(function(btn){
      btn.onclick = function(){
        var id = this.getAttribute("data-id");
        var liste2 = document.getElementById("czGecmis-" + id);
        if(!liste2) return;
        liste2.hidden = !liste2.hidden;
        this.textContent = this.textContent.replace(/[▾▴]/, liste2.hidden ? "▾" : "▴");
      };
    });

    var toggleBtn = document.getElementById("czEngellenenlerToggle");
    if(toggleBtn){
      toggleBtn.onclick = function(){
        czEngellenenlerAcikMi = !czEngellenenlerAcikMi;
        var alan = document.getElementById("czEngellenenlerAlan");
        if(alan) alan.hidden = !czEngellenenlerAcikMi;
        this.textContent = this.textContent.replace(/[▾▴]/, czEngellenenlerAcikMi ? "▴" : "▾");
      };
    }

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
  }catch(e){ hataGoster("Cihaz listesi çizilemedi: " + e.message); }
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
    { anahtar: "bildirimler", etiket: "🔔 Bildirimler" }
  ]}
];

function ceIkinciFirebaseApp(){
  var ikinciAdi = "calisanOlusturucu";
  var mevcutListe = firebase.apps.filter(function(a){ return a.name === ikinciAdi; });
  return mevcutListe.length ? mevcutListe[0] : firebase.initializeApp(WEICON_FIREBASE_CONFIG, ikinciAdi);
}

function ceVarsayilanIzinler(){
  return { hesapla: true };
}

function ceKullaniciOlustur(kullaniciAdiGirilen, sifre, cb){
  var kullaniciAdi = String(kullaniciAdiGirilen||"").trim().toLowerCase().replace(/\s+/g,"");
  if(!kullaniciAdi || !sifre){ cb(false, "Kullanıcı adı ve şifre girin."); return; }
  if(sifre.length < 6){ cb(false, "Şifre en az 6 karakter olmalı."); return; }
  var email = kullaniciAdi + WEICON_CALISAN_EMAIL_DOMAINI;
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

function ceKullaniciKartHtml(uid, veri){
  var izinler = veri.izinler || {};
  var aktifMi = veri.aktif !== false;
  var ozet = aktifMi ? (ceAcikSayfaSayisi(izinler) + " sayfa açık") : "devre dışı";
  var girisLinki = ceGirisLinkiOlustur(veri.kullaniciAdi);
  return '<section class="ce-kart" data-uid="' + uid + '">' +
    '<div class="ce-kullanici-ust">' +
      '<div class="ce-kullanici-ad' + (aktifMi ? "" : " ce-kullanici-ad--devredisi") + '">👤 ' + (veri.kullaniciAdi||"?") + '</div>' +
      (aktifMi ? '<button class="ce-devre-disi-btn" data-aksiyon="devredisi" title="Devre dışı bırak">🗑</button>' : "") +
    '</div>' +
    '<div class="ce-kullanici-ozet">' + ozet + '</div>' +
    (aktifMi ? "" : '<div class="ce-devredisi-rozet">⛔ Bu hesap devre dışı — hiçbir sayfaya girilemez</div>') +
    '<div class="ce-link-blok">' +
      '<div class="ce-link-etiket">🔗 Giriş Linki <span class="ce-link-ipucu">(kullanıcı adını otomatik doldurur, şifreyi kendisi yazar)</span></div>' +
      '<div class="ce-link-satir">' +
        '<input type="text" class="ce-link-kutu" readonly value="' + htmlEsc(girisLinki) + '">' +
        '<button type="button" class="ce-link-kopyala-btn">📋 Kopyala</button>' +
      '</div>' +
      '<div class="ce-link-kopyalandi" hidden>✓ Kopyalandı</div>' +
    '</div>' +
    ceGrupHtml(uid, izinler, aktifMi) +
    (aktifMi
      ? '<button class="ce-kaydet-btn" data-aksiyon="kaydet">✓ Kaydet</button>'
      : '<button class="ce-yeniden-etkinlestir-btn" data-aksiyon="etkinlestir">↺ Yeniden Etkinleştir</button>'
    ) +
    '</section>';
}

function ceListeyiCiz(tumKullanicilar){
  var kapsayici = document.getElementById("ceKullaniciListesi");
  var bosMesaj = document.getElementById("ceBosMesaj");
  var uidler = Object.keys(tumKullanicilar||{});
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

    // 🔗 Giriş Linki — 📋 Kopyala
    ceLinkKopyalaBtnBagla(
      kart.querySelector(".ce-link-kopyala-btn"),
      kart.querySelector(".ce-link-kutu"),
      kart.querySelector(".ce-link-kopyalandi")
    );

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

    var kaydetBtn = kart.querySelector('[data-aksiyon="kaydet"]');
    if(kaydetBtn){
      kaydetBtn.onclick = function(){
        var yeniIzinler = {};
        kart.querySelectorAll('input[type="checkbox"][data-anahtar]').forEach(function(kutu){
          yeniIzinler[kutu.getAttribute("data-anahtar")] = kutu.checked;
        });
        kaydetBtn.disabled = true;
        kaydetBtn.textContent = "⏳ Kaydediliyor...";
        firebase.database().ref("kisitliKullanicilar/" + uid + "/izinler").set(yeniIzinler).then(function(){
          kaydetBtn.disabled = false;
          kaydetBtn.textContent = "✓ Kaydet";
        }).catch(function(e){
          kaydetBtn.disabled = false;
          kaydetBtn.textContent = "✓ Kaydet";
          hataGoster("İzinler kaydedilemedi: " + e.message);
          alert("İzinler kaydedilemedi: " + e.message);
        });
      };
    }
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
});
