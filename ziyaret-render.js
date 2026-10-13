/*
  ziyaret-render.js — VERSİYON: WG.131026.1230.794
  ====================================================
  Aylık takvim görünümü: Pazartesi başlangıç, Cmt/Paz kırmızı. Her günde
  İKİ renkli rozet aynı anda: solda mavi (temas/işlem sayısı), sağda
  kırmızı (ajanda sayfası sayısı). Güne dokununca önce "Temas mı, Ajanda
  mı?" seçimi çıkar; seçilen türün paneli TEK BAŞINA açılır (ikisi
  birlikte gösterilmez) — "‹ Türü değiştir" ile aynı gün için diğerine
  geçilir.

  AJANDA BİRLEŞTİRME (09.10.2026, Abdullah'ın isteğiyle): ayrı bir
  "Ajanda" sayfası/menü satırı vardı, kaldırıldı — kağıt ajandasının
  günlük not sayfalarının fotoğrafları artık doğrudan bu takvime
  bağlı. "📷 Ekle" kamerayı doğrudan açar; sayfalar yatay kaydırılabilir
  "film şeridi" halinde gösterilir (ortadaki kart "aktif"), kaydırdıkça
  üstteki yüzen tarih etiketi günceli takip eder — gün sınırını fark
  ettirmeden geçer, ajanda yaprağı çevirir gibi. Veri modeli/Firebase
  Storage gerekçesi için bkz. ajanda-data.js.
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

var AY_ADLARI = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
var GUN_ADLARI = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];

function tarihiGuncelle(){
  try{
    var el = document.getElementById("gunTarihi");
    if(!el) return;
    var d = new Date();
    el.textContent = GUN_ADLARI[d.getDay()] + ", " + d.getDate() + " " + AY_ADLARI[d.getMonth()] + " " + d.getFullYear();
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

function gunAnahtari(yil, ay, gun){
  return yil + "-" + String(ay+1).padStart(2,"0") + "-" + String(gun).padStart(2,"0");
}
function gosterimTarihUret(tarihAnahtari){
  var p = tarihAnahtari.split("-");
  return p[2] + " " + AY_ADLARI[parseInt(p[1],10)-1] + " " + p[0];
}

var goruntulenenYil, goruntulenenAy; // ay: 0-11
var seciliGunAnahtari = null;
var seciliGorunum = null; // null | "temas" | "ajanda"
var seciliFirma = null;
var seciliTur = "ziyaret";
var TUR_META = {
  ziyaret:  {etiket:"Ziyaret",  ikon:"📍", renk:"#0e6b34"},
  telefon:  {etiket:"Telefon",  ikon:"📞", renk:"#003a70"},
  mail:     {etiket:"Mail",     ikon:"✉️", renk:"#a8590c"},
  whatsapp: {etiket:"WhatsApp", ikon:"💬", renk:"#0e6b58"}
};

// Ay Seç pop-up (25.09.2026) — bugünden 12 ay geri / 12 ay ileriye kadar
// tek satırda yan yana, yatay kaydırılabilir ay seçenekleri. Açılışta
// otomatik olarak o an görüntülenen aya kaydırılır.
function aySecPopupDoldur(){
  try{
    var kapsayici = document.getElementById("ziyAySecSatir");
    var bugun = new Date();
    var html = "";
    for(var i=-12; i<=12; i++){
      var d = new Date(bugun.getFullYear(), bugun.getMonth()+i, 1);
      var y = d.getFullYear(), a = d.getMonth();
      var seciliMi = (y===goruntulenenYil && a===goruntulenenAy);
      html += "<div class='ziy-ay-secenek" + (seciliMi?" ziy-ay-secenek--secili":"") + "' data-yil='" + y + "' data-ay='" + a + "'>" + AY_ADLARI[a].slice(0,3) + " " + y + "</div>";
    }
    kapsayici.innerHTML = html;
    kapsayici.querySelectorAll(".ziy-ay-secenek").forEach(function(el){
      el.onclick = function(){
        goruntulenenYil = parseInt(this.getAttribute("data-yil"), 10);
        goruntulenenAy = parseInt(this.getAttribute("data-ay"), 10);
        seciliGunAnahtari = null;
        document.getElementById("ziyGunPanel").hidden = true;
        takvimiCiz();
        document.getElementById("ziyAySecOverlay").hidden = true;
      };
    });
    var seciliEl = kapsayici.querySelector(".ziy-ay-secenek--secili");
    if(seciliEl) seciliEl.scrollIntoView({inline:"center", block:"nearest"});
  }catch(e){ hataGoster("Ay listesi açılamadı: " + e.message); }
}

// Temas/işlem + ajanda sayfa sayılarını gün başına hesaplar.
function gunSayilariniHesapla(){
  var temas = {};
  CustomerData.tumZiyaretTemaslar().forEach(function(k){
    var d = new Date(k.ts);
    var a = gunAnahtari(d.getFullYear(), d.getMonth(), d.getDate());
    temas[a] = (temas[a]||0) + 1;
  });
  if(typeof ReportsData !== "undefined"){
    ReportsData.sonIslemler().forEach(function(k){
      var d = new Date(k.ts);
      var a = gunAnahtari(d.getFullYear(), d.getMonth(), d.getDate());
      temas[a] = (temas[a]||0) + 1;
    });
  }
  var ajanda = (typeof AjandaData !== "undefined") ? AjandaData.gunSayilari() : {};
  return {temas: temas, ajanda: ajanda};
}

function takvimiCiz(){
  try{
    document.getElementById("ziyAyBaslik").textContent = AY_ADLARI[goruntulenenAy] + " " + goruntulenenYil;

    var sayilar = gunSayilariniHesapla();

    var ilkGun = new Date(goruntulenenYil, goruntulenenAy, 1);
    // JS: Pazar=0..Cumartesi=6 → Pazartesi başlangıçlı indekse çevir
    var bosluk = (ilkGun.getDay() + 6) % 7;
    var gunSayisi = new Date(goruntulenenYil, goruntulenenAy+1, 0).getDate();
    var bugun = new Date();
    var bugunAnahtar = gunAnahtari(bugun.getFullYear(), bugun.getMonth(), bugun.getDate());

    var html = "";
    for(var b=0; b<bosluk; b++) html += "<div class='ziy-gun-hucre ziy-gun-hucre--bos'></div>";
    for(var g=1; g<=gunSayisi; g++){
      var anahtar = gunAnahtari(goruntulenenYil, goruntulenenAy, g);
      var haftaGunu = new Date(goruntulenenYil, goruntulenenAy, g).getDay();
      var tatilMi = haftaGunu===0 || haftaGunu===6;
      var sayiTemas = sayilar.temas[anahtar] || 0;
      var sayiAjanda = sayilar.ajanda[anahtar] || 0;
      var siniflar = "ziy-gun-hucre";
      if(tatilMi) siniflar += " ziy-gun-hucre--tatil";
      if(anahtar===bugunAnahtar) siniflar += " ziy-gun-hucre--bugun";
      if(anahtar===seciliGunAnahtari) siniflar += " ziy-gun-hucre--secili";
      html += "<div class='" + siniflar + "' data-anahtar='" + anahtar + "'>"
        + g
        + (sayiTemas>0 ? "<span class='ziy-gun-rozet-cift ziy-gun-rozet-cift--temas'>" + sayiTemas + "</span>" : "")
        + (sayiAjanda>0 ? "<span class='ziy-gun-rozet-cift ziy-gun-rozet-cift--ajanda'>" + sayiAjanda + "</span>" : "")
        + "</div>";
    }
    document.getElementById("ziyTakvimGrid").innerHTML = html;

    document.querySelectorAll(".ziy-gun-hucre:not(.ziy-gun-hucre--bos)").forEach(function(hucre){
      hucre.onclick = function(){ gunSecildi(this.getAttribute("data-anahtar")); };
    });
  }catch(e){ hataGoster("Takvim çizilemedi: " + e.message); }
}

// Bir güne dokununca — önce tür seçim ekranı açılır.
function gunSecildi(anahtar){
  seciliGunAnahtari = anahtar;
  seciliGorunum = null;
  takvimiCiz();
  panelBasligiGuncelle();

  var sayilar = gunSayilariniHesapla();
  document.getElementById("ziyGorunumSecimTemasSayi").textContent = (sayilar.temas[anahtar]||0) + " kayıt";
  document.getElementById("ziyGorunumSecimAjandaSayi").textContent = (sayilar.ajanda[anahtar]||0) + " sayfa";

  document.getElementById("ziyGorunumSecim").hidden = false;
  document.getElementById("ziyTemasPanel").hidden = true;
  document.getElementById("ziyAjandaPanel").hidden = true;
  document.getElementById("ziyGunPanel").hidden = false;
  document.getElementById("ziyGunPanel").scrollIntoView({behavior:"smooth", block:"start"});
}

function panelBasligiGuncelle(){
  var el = document.getElementById("ziyGunPanelBaslik");
  if(!seciliGunAnahtari){ el.textContent = ""; return; }
  var gosterim = gosterimTarihUret(seciliGunAnahtari);
  if(seciliGorunum === "temas") el.textContent = gosterim + " — 📍 Temas";
  else if(seciliGorunum === "ajanda") el.textContent = gosterim + " — 📓 Ajanda";
  else el.textContent = gosterim + " — hangisi?";
}

function gorunumSec(tur){
  seciliGorunum = tur;
  panelBasligiGuncelle();
  document.getElementById("ziyGorunumSecim").hidden = true;
  if(tur === "temas"){
    document.getElementById("ziyTemasPanel").hidden = false;
    document.getElementById("ziyAjandaPanel").hidden = true;
    temasPaneliniDoldur(seciliGunAnahtari);
  } else {
    document.getElementById("ziyAjandaPanel").hidden = false;
    document.getElementById("ziyTemasPanel").hidden = true;
    ajOnizleKapat(); // önceki görünümden kalmış, kaydedilmemiş bir önizleme varsa temizle
    ajandaFilmSeridiniCiz(seciliGunAnahtari);
  }
}

function gorunumDegistir(){
  seciliGorunum = null;
  panelBasligiGuncelle();
  document.getElementById("ziyTemasPanel").hidden = true;
  document.getElementById("ziyAjandaPanel").hidden = true;
  ajOnizleKapat(); // kaydedilmemiş önizleme varsa at — "Türü değiştir" ile sessizce kaybolmasın istenmez ama kaydetmeden çıkıyor demektir
  var sayilar = gunSayilariniHesapla();
  document.getElementById("ziyGorunumSecimTemasSayi").textContent = (sayilar.temas[seciliGunAnahtari]||0) + " kayıt";
  document.getElementById("ziyGorunumSecimAjandaSayi").textContent = (sayilar.ajanda[seciliGunAnahtari]||0) + " sayfa";
  document.getElementById("ziyGorunumSecim").hidden = false;
}

function panelKapat(){
  document.getElementById("ziyGunPanel").hidden = true;
  seciliGunAnahtari = null;
  seciliGorunum = null;
  ajOnizleKapat(); // kaydedilmemiş önizleme varsa at
  takvimiCiz();
}

// ——— TEMAS PANELİ ———
function temasPaneliniDoldur(anahtar){
  try{
    var tumKayitlar = CustomerData.tumZiyaretTemaslar();
    var buGununKayitlari = tumKayitlar.filter(function(k){
      var d = new Date(k.ts);
      return gunAnahtari(d.getFullYear(), d.getMonth(), d.getDate()) === anahtar;
    });

    var kapsayici = document.getElementById("ziyGunKayitListesi");
    var bos = document.getElementById("ziyGunKayitBos");
    if(buGununKayitlari.length === 0){
      kapsayici.innerHTML = "";
      bos.hidden = false;
    } else {
      bos.hidden = true;
      kapsayici.innerHTML = buGununKayitlari.map(function(k){
        var tur = TUR_META[k.tur] || TUR_META.ziyaret;
        return "<div class='ziy-kayit-karti'>"
          + "<div class='ziy-kayit-musteri'>" + cariSatirHTML(k.musteriId, k.musteri, k.sehir) + "</div>"
          + "<div class='ziy-kayit-tur' style='color:" + tur.renk + "'>" + tur.ikon + " " + tur.etiket + (k.not ? " — " + htmlEsc(k.not) : "") + "</div>"
          + "</div>";
      }).join("");
    }

    seciliFirma = null;
    seciliTur = "ziyaret";
    document.getElementById("ziySeciliFirma").hidden = true;
    document.getElementById("ziyFirmaAra").value = "";
    document.getElementById("ziyFirmaSonuclari").innerHTML = "";
    document.getElementById("ziyNot").value = "";
    document.getElementById("ziyHatirlatmaCheck").checked = false;
    document.getElementById("ziyHatirlatmaTarih").hidden = true;
    document.getElementById("ziyHatirlatmaTarih").value = anahtar;
    turSecimGuncelle();

    gununIslemleriniCiz(anahtar);
  }catch(e){ hataGoster("Temas paneli açılamadı: " + e.message); }
}

var ISLEM_TUR_ETIKET = {numune:"Numune", teklif:"Teklif", proforma:"Proforma", siparis:"Sipariş"};

// Bugünkü işlemler tablosu (15.09.2026) — seçili gündeki sipariş/teklif/
// proforma/numune kayıtlarını tarih/işlem no/tür olarak listeler. Temas/
// ziyaret kayıtlarından tamamen ayrı bir veri kaynağı (ReportsData).
function gununIslemleriniCiz(anahtar){
  var baslik = document.getElementById("ziyIslemBaslik");
  var kutu = document.getElementById("ziyIslemTablosu");
  if(typeof ReportsData === "undefined"){ baslik.hidden = true; kutu.innerHTML = ""; return; }
  var hepsi = ReportsData.sonIslemler();
  var buGununIslemleri = hepsi.filter(function(k){
    var d = new Date(k.ts);
    return gunAnahtari(d.getFullYear(), d.getMonth(), d.getDate()) === anahtar;
  });
  if(buGununIslemleri.length === 0){ baslik.hidden = true; kutu.innerHTML = ""; return; }
  baslik.hidden = false;
  kutu.innerHTML = "<table class='ziy-islem-tablo'><tr><th>Tarih</th><th>Müşteri</th><th>İşlem No</th><th>Tür</th></tr>"
    + buGununIslemleri.map(function(k){
        return "<tr><td>" + (k.tarih||"-") + "</td><td>" + htmlEsc(k.musteri||"-") + "</td><td>" + (k.kod||"-") + "</td><td>" + (ISLEM_TUR_ETIKET[k.tip]||k.tip) + "</td></tr>";
      }).join("")
    + "</table>";
}

function turSecimGuncelle(){
  ["ziyaret","telefon","mail","whatsapp"].forEach(function(t){
    var btn = document.getElementById("btnTur" + t.charAt(0).toUpperCase() + t.slice(1));
    if(btn) btn.classList.toggle("ziy-tur-btn--secili", seciliTur===t);
  });
  // "Temas" tuşu artık seçili türün ikonunu gösterir — 4'lü tuş grubu
  // pop-up'a taşındığı için tek görünür geri bildirim burası (25.09.2026).
  var acBtn = document.getElementById("btnZiyTemasAc");
  if(acBtn){
    var m = TUR_META[seciliTur] || TUR_META.ziyaret;
    acBtn.textContent = m.ikon + " Temas";
  }
}

function firmaAramaCiz(){
  var q = document.getElementById("ziyFirmaAra").value;
  var kapsayici = document.getElementById("ziyFirmaSonuclari");
  if(!q || q.trim().length===0){ kapsayici.innerHTML = ""; return; }
  var sonuclar = CustomerData.ara(q).slice(0, 8);
  kapsayici.innerHTML = sonuclar.map(function(m){
    return "<div class='ziy-firma-satir' data-ad='" + htmlEsc(m.ad) + "' data-sehir='" + htmlEsc(m.sehir||"") + "'>" + cariSatirHTML(m.id, m.ad, m.sehir) + "</div>";
  }).join("");
  kapsayici.querySelectorAll(".ziy-firma-satir").forEach(function(satir){
    satir.onclick = function(){
      seciliFirma = {ad: this.getAttribute("data-ad"), sehir: this.getAttribute("data-sehir")};
      document.getElementById("ziySeciliFirma").hidden = false;
      document.getElementById("ziySeciliFirma").textContent = "✓ " + seciliFirma.ad;
      kapsayici.innerHTML = "";
      document.getElementById("ziyFirmaAra").value = "";
    };
  });
}

// ——— AJANDA FİLM ŞERİDİ ———
// Seçilen fotoğrafı ÇÖZER (HEIC/HEIF ise önce JPEG'e çevirir) ve TAM
// ÇÖZÜNÜRLÜKTE bir <img> olarak geriBildir'e verir — küçültme/sıkıştırma
// ARTIK burada değil, kullanıcı kırpma kutusunu ayarlayıp "✓ Kaydet"e
// basınca kirpVeSikistir() içinde yapılıyor (12.10.2026, Abdullah'ın
// isteğiyle: önce kenarları kırpabilsin, sonra kırpılmış alan
// küçültülüp sıkıştırılsın).
//
// DÜZELTME (12.10.2026) — galeri erişimi açılınca (bkz. 11.10.2026
// düzeltmesi) iPhone'ların varsayılan kaydettiği HEIC/HEIF formatındaki
// fotoğraflar <img> ile çözülemiyor ve "Fotoğraf işlenemedi" hatası
// veriyordu. Artık: dosya HEIC/HEIF ise önce heic2any kütüphanesiyle
// (ziyaret.html'de CDN'den yükleniyor) JPEG'e çevriliyor — kullanıcı
// hiçbir şey fark etmeden fotoğraf akışa devam ediyor. Kütüphane bir
// nedenle yüklenemediyse veya dönüştürme başarısız olursa "format"
// uyarısı gösteriliyor. Her hata ayrıntısı sessizce HataLog'a yazılıyor.
function resimSikistir(file, geriBildir){
  function sessizKaydet(asama, detay){
    if(typeof HataLog !== "undefined"){
      HataLog.kaydet("Ajanda fotoğrafı işlenemedi (" + asama + ")", detay);
    }
  }
  function muhtemelenHeic(){
    var ad = ((file && file.name) || "").toLowerCase();
    var tur = ((file && file.type) || "").toLowerCase();
    return ad.indexOf(".heic") !== -1 || ad.indexOf(".heif") !== -1
      || tur.indexOf("heic") !== -1 || tur.indexOf("heif") !== -1;
  }

  // Sadece ÇÖZME — hem doğrudan seçilen dosya hem de heic2any'den çıkan
  // JPEG blob'u için aynı yol kullanılır. Küçültme/sıkıştırma YOK.
  function coz(islenecekDosya){
    try{
      var reader = new FileReader();
      reader.onload = function(e){
        var img = new Image();
        img.onload = function(){
          geriBildir(e.target.result, img, null);
        };
        img.onerror = function(){
          sessizKaydet("img.onerror", "dosya: " + ((file && file.name) || "?") + ", tür: " + ((file && file.type) || "?"));
          geriBildir(null, null, muhtemelenHeic() ? "format" : "genel");
        };
        img.src = e.target.result;
      };
      reader.onerror = function(){
        sessizKaydet("FileReader", reader.error && reader.error.message);
        geriBildir(null, null, "genel");
      };
      reader.readAsDataURL(islenecekDosya);
    }catch(e){
      sessizKaydet("try/catch dış", e && e.message);
      geriBildir(null, null, muhtemelenHeic() ? "format" : "genel");
    }
  }

  if(muhtemelenHeic()){
    if(typeof heic2any === "undefined"){
      sessizKaydet("heic2any-yuklenmedi", "kütüphane tanımsız — CDN'den yüklenememiş olabilir (çevrimdışı mı?)");
      geriBildir(null, null, "format");
      return;
    }
    try{
      heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 }).then(function(sonuc){
        var jpegBlob = Array.isArray(sonuc) ? sonuc[0] : sonuc;
        coz(jpegBlob);
      }).catch(function(e){
        sessizKaydet("heic2any", e && e.message);
        geriBildir(null, null, "format");
      });
    }catch(e){
      sessizKaydet("heic2any try/catch", e && e.message);
      geriBildir(null, null, "format");
    }
    return;
  }

  coz(file);
}

// Kırpma kutusuna (yüzde cinsinden sol/ust/sag/alt kenarlar, 0-100) göre
// img'in SADECE o bölgesini alıp maks. 1100px genişliğe küçültüp %65
// kaliteli JPEG data URL'i olarak döndürür. Senkron çalışır, hata
// fırlatabilir (çağıran taraf try/catch ile sarmalı).
function kirpVeSikistir(img, kirpKutusu){
  var sol = kirpKutusu.sol / 100, ust = kirpKutusu.ust / 100;
  var sag = kirpKutusu.sag / 100, alt = kirpKutusu.alt / 100;
  var kaynakX = Math.round(img.naturalWidth * sol);
  var kaynakY = Math.round(img.naturalHeight * ust);
  var kaynakGenislik = Math.max(1, Math.round(img.naturalWidth * (sag - sol)));
  var kaynakYukseklik = Math.max(1, Math.round(img.naturalHeight * (alt - ust)));
  var maxGenislik = 1100;
  var olcek = Math.min(1, maxGenislik / kaynakGenislik);
  var canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(kaynakGenislik * olcek));
  canvas.height = Math.max(1, Math.round(kaynakYukseklik * olcek));
  var ctx = canvas.getContext("2d");
  ctx.drawImage(img, kaynakX, kaynakY, kaynakGenislik, kaynakYukseklik, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.65);
}

// Film şeridini TÜM sayfalardan (kronolojik) kurar, hedef tarihe en
// yakın karta kaydırıp "aktif" yapar.
function ajandaFilmSeridiniCiz(hedefTarih){
  try{
    var tumKayitlar = (typeof AjandaData !== "undefined") ? AjandaData.tumKayitlarKronolojik() : [];
    var seridEl = document.getElementById("ajFilmSeridi");
    var bosEl = document.getElementById("ajFilmBos");

    if(tumKayitlar.length === 0){
      seridEl.innerHTML = "";
      bosEl.hidden = false;
      document.getElementById("ajYuzenTarih").textContent = gosterimTarihUret(hedefTarih);
      return;
    }
    bosEl.hidden = true;

    seridEl.innerHTML = tumKayitlar.map(function(k){
      var saat = new Date(k.zaman).toLocaleTimeString("tr-TR", {hour:"2-digit", minute:"2-digit"});
      return "<div class='aj-film-kart' data-id='" + k.id + "' data-tarih='" + k.tarih + "' data-yol='" + htmlEsc(k.yol) + "'>"
        + "<button type='button' class='aj-film-sil' data-id='" + k.id + "' data-tarih='" + k.tarih + "' data-yol='" + htmlEsc(k.yol) + "'>🗑</button>"
        + "<div class='aj-film-resim' style='background-image:url(" + "\"" + k.url + "\"" + ")'></div>"
        + "<div class='aj-film-saat'>" + gosterimTarihUret(k.tarih) + " — " + saat + "</div>"
        + "</div>";
    }).join("");

    seridEl.querySelectorAll(".aj-film-sil").forEach(function(btn){
      btn.onclick = function(ev){
        ev.stopPropagation();
        ajandaSayfasiSil(this.getAttribute("data-tarih"), this.getAttribute("data-id"), this.getAttribute("data-yol"));
      };
    });

    // Hedef tarihe eşit ya da ondan sonraki ilk kart (yoksa son kart).
    var hedefIndex = tumKayitlar.length - 1;
    for(var i=0; i<tumKayitlar.length; i++){
      if(tumKayitlar[i].tarih >= hedefTarih){ hedefIndex = i; break; }
    }
    ajFilmKaydirVeAktifEt(hedefIndex, false);
  }catch(e){ hataGoster("Ajanda film şeridi çizilemedi: " + e.message); }
}

function ajFilmKaydirVeAktifEt(index, animasyonlu){
  var serit = document.getElementById("ajFilmSeridi");
  var kartlar = serit.querySelectorAll(".aj-film-kart");
  if(!kartlar.length || !kartlar[index]) return;
  var kart = kartlar[index];
  var hedefScroll = kart.offsetLeft - (serit.clientWidth - kart.offsetWidth) / 2;
  serit.scrollTo({left: Math.max(0, hedefScroll), behavior: animasyonlu ? "smooth" : "auto"});
  kartlar.forEach(function(k){ k.classList.remove("aj-film-kart--aktif"); });
  kart.classList.add("aj-film-kart--aktif");
  document.getElementById("ajYuzenTarih").textContent = gosterimTarihUret(kart.getAttribute("data-tarih"));
}

// Kaydırma bittikçe ortadaki kartı bulup "aktif" yapar, üstteki yüzen
// tarih etiketini günceller — gün sınırını fark ettirmeden geçer.
var ajFilmKaydirmaCercevesi = null;
function ajFilmKaydirmaDegisti(){
  if(ajFilmKaydirmaCercevesi) cancelAnimationFrame(ajFilmKaydirmaCercevesi);
  ajFilmKaydirmaCercevesi = requestAnimationFrame(function(){
    var serit = document.getElementById("ajFilmSeridi");
    var kartlar = serit.querySelectorAll(".aj-film-kart");
    if(!kartlar.length) return;
    var seritOrta = serit.scrollLeft + serit.clientWidth / 2;
    var enYakinKart = null, enYakinFark = Infinity;
    kartlar.forEach(function(kart){
      var kartOrta = kart.offsetLeft + kart.offsetWidth / 2;
      var fark = Math.abs(kartOrta - seritOrta);
      if(fark < enYakinFark){ enYakinFark = fark; enYakinKart = kart; }
    });
    if(!enYakinKart) return;
    kartlar.forEach(function(k){ k.classList.remove("aj-film-kart--aktif"); });
    enYakinKart.classList.add("aj-film-kart--aktif");
    document.getElementById("ajYuzenTarih").textContent = gosterimTarihUret(enYakinKart.getAttribute("data-tarih"));
  });
}

// KAYNAK SEÇİMİ (13.10.2026, Abdullah'ın isteğiyle): "Ekle" artık dosya
// seçiciyi DOĞRUDAN açmıyor — önce "Fotoğraf nereden eklensin?" (Kamera/
// Galeri) popup'ı açılıyor. Kamera seçilirse capture="environment" olan
// #ajFotoSeciciKamera, Galeri seçilirse eski (capture'sız) #ajFotoSecici
// tıklanıyor — ikisi de AYNI change dinleyicisine/akışa (ajandaFotoSecildi,
// kırpma ekranı) bağlı, davranış hiç değişmedi.
function ajandaEkleTiklandi(){
  document.getElementById("ajKaynakOverlay").hidden = false;
}

// ÖNİZLE+KIRP+KAYDET (12.10.2026, Abdullah'ın isteğiyle) — seçilen
// fotoğraf artık otomatik yüklenmiyor: önce #ajOnizleKart'ta tam
// çözünürlükte önizleniyor, kenarları 4 köşe tutamacıyla kırpılabiliyor,
// AjandaData.fotografEkle() yalnızca kullanıcı "✓ Kaydet"e basınca (ve o
// anda kırpma kutusu uygulanıp küçültülüp sıkıştırıldıktan sonra)
// çağrılıyor. "✕ Vazgeç" seçimi hiç yüklemeden iptal eder.
var ajOnizlemedekiVeri = null; // {img, hedefTarih} — kaydedilmeyi bekleyen, henüz kırpılmamış seçim
var ajKirpKutu = null;         // {sol, ust, sag, alt} — yüzde (0-100) cinsinden kırpma kenarları
var ajKirpAktifTutamac = null; // sürüklenmekte olan köşe ("sol-ust" vb.) ya da null
var AJ_KIRP_MIN_YUZDE = 10;    // kırpma kutusunun en küçük genişlik/yükseklik yüzdesi

function ajandaFotoSecildi(file){
  if(!file || !seciliGunAnahtari) return;
  // Hedef: film şeridindeki o an ortadaki (aktif) kartın tarihi, yoksa
  // takvimden seçilen gün.
  var aktifKart = document.querySelector(".aj-film-kart--aktif");
  var hedefTarih = aktifKart ? aktifKart.getAttribute("data-tarih") : seciliGunAnahtari;

  var btn = document.getElementById("btnAjandaEkle");
  btn.disabled = true;
  btn.innerHTML = "<span>⏳</span>İşleniyor";
  resimSikistir(file, function(dataUrl, imgEl, hataAyrinti){
    btn.disabled = false;
    btn.innerHTML = "<span>📷</span>Ekle";
    if(!dataUrl){
      ajOnizleHataGoster(hataAyrinti);
      return;
    }
    ajOnizlemedekiVeri = { img: imgEl, hedefTarih: hedefTarih };
    ajOnizleGoster(dataUrl);
  });
}

// Başarılı önizleme: resim + kırpma kutusu + Kaydet/Vazgeç.
function ajOnizleGoster(dataUrl){
  document.getElementById("ajOnizleKart").hidden = false;
  document.getElementById("ajOnizleKirpAlan").hidden = false;
  document.getElementById("ajOnizleImg").src = dataUrl;
  document.getElementById("ajOnizleHata").hidden = true;
  document.getElementById("btnAjOnizleKaydet").hidden = false;
  document.getElementById("btnAjOnizleSifirla").hidden = false;
  document.getElementById("btnAjOnizleVazgec").style.flex = "1";
  document.getElementById("btnAjandaEkle").disabled = true;
  ajKirpSifirla();
}

// İşlenemeyen dosya: somut hata mesajı, sadece Vazgeç (Kaydet gizli).
function ajOnizleHataGoster(hataAyrinti){
  ajOnizlemedekiVeri = null;
  document.getElementById("ajOnizleKart").hidden = false;
  document.getElementById("ajOnizleKirpAlan").hidden = true;
  document.getElementById("btnAjOnizleSifirla").hidden = true;
  var hataEl = document.getElementById("ajOnizleHata");
  hataEl.hidden = false;
  hataEl.textContent = (hataAyrinti === "format")
    ? "⚠️ Bu fotoğraf (muhtemelen HEIC) otomatik dönüştürme sonrasında da işlenemedi. Galeri ayarlarından \"En Uyumlu\" (JPEG) formatını seçip tekrar dener misin?"
    : "⚠️ Fotoğraf işlenemedi, tekrar dener misin?";
  document.getElementById("btnAjOnizleKaydet").hidden = true;
  document.getElementById("btnAjOnizleVazgec").style.flex = "1";
  document.getElementById("btnAjandaEkle").disabled = true;
}

// Önizleme kartını tamamen kapatır (Vazgeç, Kaydet-sonrası veya görünüm
// değişimi sırasında kaydedilmemiş bir seçim varsa onu da atar).
function ajOnizleKapat(){
  ajOnizlemedekiVeri = null;
  ajKirpAktifTutamac = null;
  var kart = document.getElementById("ajOnizleKart");
  if(!kart) return;
  kart.hidden = true;
  document.getElementById("ajOnizleKirpAlan").hidden = true;
  document.getElementById("ajOnizleImg").src = "";
  document.getElementById("btnAjOnizleSifirla").hidden = true;
  document.getElementById("btnAjandaEkle").disabled = false;
}

function ajOnizleVazgecTiklandi(){
  ajOnizleKapat();
}

// ——— KIRPMA KUTUSU ———
function ajKirpSifirla(){
  // Küçük bir iç pay (%3) bırakılıyor ki tutamaçlar baştan görünür/
  // sürüklenebilir olsun; görsel olarak "tam kare" ile aynı etki.
  ajKirpKutu = { sol: 3, ust: 3, sag: 97, alt: 97 };
  ajKirpCiz();
}

function ajKirpCiz(){
  var kutu = document.getElementById("ajOnizleKirpKutu");
  var k = ajKirpKutu;
  if(!kutu || !k) return;
  kutu.style.left = k.sol + "%";
  kutu.style.top = k.ust + "%";
  kutu.style.width = (k.sag - k.sol) + "%";
  kutu.style.height = (k.alt - k.ust) + "%";

  document.getElementById("ajKirpDisiUst").style.cssText = "top:0;left:0;width:100%;height:" + k.ust + "%;";
  document.getElementById("ajKirpDisiAlt").style.cssText = "top:" + k.alt + "%;left:0;width:100%;height:" + (100 - k.alt) + "%;";
  document.getElementById("ajKirpDisiSol").style.cssText = "top:" + k.ust + "%;left:0;width:" + k.sol + "%;height:" + (k.alt - k.ust) + "%;";
  document.getElementById("ajKirpDisiSag").style.cssText = "top:" + k.ust + "%;left:" + k.sag + "%;width:" + (100 - k.sag) + "%;height:" + (k.alt - k.ust) + "%;";
}

function ajKirpTutamacBasladi(ev){
  ev.preventDefault();
  ajKirpAktifTutamac = this.getAttribute("data-kose");
  try{ this.setPointerCapture(ev.pointerId); }catch(e){}
}

function ajKirpSurukleniyor(ev){
  if(!ajKirpAktifTutamac) return;
  var alan = document.getElementById("ajOnizleKirpAlan");
  if(!alan) return;
  var dikdortgen = alan.getBoundingClientRect();
  if(!dikdortgen.width || !dikdortgen.height) return;
  var xYuzde = Math.min(100, Math.max(0, ((ev.clientX - dikdortgen.left) / dikdortgen.width) * 100));
  var yYuzde = Math.min(100, Math.max(0, ((ev.clientY - dikdortgen.top) / dikdortgen.height) * 100));
  var k = ajKirpKutu;
  if(!k) return;
  if(ajKirpAktifTutamac === "sol-ust"){
    k.sol = Math.min(xYuzde, k.sag - AJ_KIRP_MIN_YUZDE);
    k.ust = Math.min(yYuzde, k.alt - AJ_KIRP_MIN_YUZDE);
  } else if(ajKirpAktifTutamac === "sag-ust"){
    k.sag = Math.max(xYuzde, k.sol + AJ_KIRP_MIN_YUZDE);
    k.ust = Math.min(yYuzde, k.alt - AJ_KIRP_MIN_YUZDE);
  } else if(ajKirpAktifTutamac === "sol-alt"){
    k.sol = Math.min(xYuzde, k.sag - AJ_KIRP_MIN_YUZDE);
    k.alt = Math.max(yYuzde, k.ust + AJ_KIRP_MIN_YUZDE);
  } else if(ajKirpAktifTutamac === "sag-alt"){
    k.sag = Math.max(xYuzde, k.sol + AJ_KIRP_MIN_YUZDE);
    k.alt = Math.max(yYuzde, k.ust + AJ_KIRP_MIN_YUZDE);
  }
  k.sol = Math.max(0, k.sol);
  k.ust = Math.max(0, k.ust);
  k.sag = Math.min(100, k.sag);
  k.alt = Math.min(100, k.alt);
  ajKirpCiz();
}

function ajKirpBirakildi(){
  ajKirpAktifTutamac = null;
}

function ajOnizleKaydetTiklandi(){
  if(!ajOnizlemedekiVeri || !ajOnizlemedekiVeri.img) return;
  var veri = ajOnizlemedekiVeri;
  var kaydetBtn = document.getElementById("btnAjOnizleKaydet");
  kaydetBtn.disabled = true;
  kaydetBtn.textContent = "⏳ Kaydediliyor";

  var dataUrl;
  try{
    dataUrl = kirpVeSikistir(veri.img, ajKirpKutu);
  }catch(e){
    kaydetBtn.disabled = false;
    kaydetBtn.textContent = "✓ Kaydet";
    if(typeof HataLog !== "undefined") HataLog.kaydet("Ajanda fotoğrafı kırpılamadı", e && e.message);
    hataGoster("Fotoğraf kırpılırken bir sorun oluştu, tekrar dener misin?");
    return;
  }

  AjandaData.fotografEkle(veri.hedefTarih, dataUrl, function(basarili, err){
    kaydetBtn.disabled = false;
    kaydetBtn.textContent = "✓ Kaydet";
    if(!basarili){
      hataGoster("Fotoğraf kaydedilemedi: " + (err && err.message ? err.message : "bilinmeyen hata"));
      return;
    }
    ajOnizleKapat();
    ajandaFilmSeridiniCiz(veri.hedefTarih);
    takvimiCiz();
  });
}

function ajandaSayfasiSil(tarih, id, yol){
  if(!confirm("Bu sayfa fotoğrafı silinsin mi? Bu işlem geri alınamaz.")) return;
  AjandaData.fotografSil(tarih, id, yol, function(basarili, err){
    if(!basarili){
      hataGoster("Silinemedi: " + (err && err.message ? err.message : "bilinmeyen hata"));
      return;
    }
    ajandaFilmSeridiniCiz(seciliGunAnahtari);
    takvimiCiz();
  });
}

function hatirlatmalariKontrolEt(){
  try{
    var liste = CustomerData.hatirlatmalarBugun();
    if(liste.length === 0) return;
    document.getElementById("ziyHatirlatmaListesi").innerHTML = liste.map(function(z){
      var turEtiket = z.tur==="temas" ? "☎ Temas" : "📍 Ziyaret";
      return "<div class='ziy-kayit-karti'>"
        + "<div class='ziy-kayit-musteri'>" + htmlEsc(z.musteri) + "</div>"
        + "<div class='ziy-kayit-tur'>" + turEtiket + (z.not ? " — " + htmlEsc(z.not) : "") + "</div>"
        + "</div>";
    }).join("");
    document.getElementById("ziyHatirlatmaOverlay").hidden = false;
  }catch(e){ hataGoster("Hatırlatmalar kontrol edilemedi: " + e.message); }
}

window.addEventListener("error", function(ev){
  hataGoster("HATA: " + ev.message + " (" + (ev.filename||"").split("/").pop() + ":" + ev.lineno + ")");
});

document.addEventListener("DOMContentLoaded", function(){
  tarihiGuncelle();
  var simdi = new Date();
  goruntulenenYil = simdi.getFullYear();
  goruntulenenAy = simdi.getMonth();

  var btnMenuEl = document.getElementById("btnMenu");

  if(btnMenuEl) btnMenuEl.onclick = function(){ window.location.href = "menu.html"; };
  // Ay seç pop-up (25.09.2026) — ◀ Eylül 2026 ▶ ok gezinmesinin yerini aldı.
  document.getElementById("btnAySecAc").onclick = function(){
    aySecPopupDoldur();
    document.getElementById("ziyAySecOverlay").hidden = false;
  };
  document.getElementById("btnZiyAySecKapat").onclick = function(){
    document.getElementById("ziyAySecOverlay").hidden = true;
  };
  document.getElementById("ziyGunFiltre").onchange = function(){
    var deger = this.value; // "YYYY-MM-DD"
    if(!deger) return;
    var parca = deger.split("-");
    goruntulenenYil = parseInt(parca[0], 10);
    goruntulenenAy = parseInt(parca[1], 10) - 1;
    takvimiCiz();
    gunSecildi(deger);
  };
  document.getElementById("btnZiyGunKapat").onclick = panelKapat;

  // Tür seçim kartları + geri linkleri.
  document.getElementById("ziyGorunumSecimTemas").onclick = function(){ gorunumSec("temas"); };
  document.getElementById("ziyGorunumSecimAjanda").onclick = function(){ gorunumSec("ajanda"); };
  document.getElementById("btnZiyTemasGeri").onclick = gorunumDegistir;
  document.getElementById("btnZiyAjandaGeri").onclick = gorunumDegistir;

  // Ajanda — Ekle + film şeridi kaydırma dinleyicisi.
  document.getElementById("btnAjandaEkle").onclick = ajandaEkleTiklandi;
  document.getElementById("ajFotoSecici").addEventListener("change", function(){
    var file = this.files && this.files[0];
    ajandaFotoSecildi(file);
    this.value = "";
  });
  document.getElementById("ajFotoSeciciKamera").addEventListener("change", function(){
    var file = this.files && this.files[0];
    ajandaFotoSecildi(file);
    this.value = "";
  });
  document.getElementById("btnAjKaynakKamera").onclick = function(){
    document.getElementById("ajKaynakOverlay").hidden = true;
    document.getElementById("ajFotoSeciciKamera").click();
  };
  document.getElementById("btnAjKaynakGaleri").onclick = function(){
    document.getElementById("ajKaynakOverlay").hidden = true;
    document.getElementById("ajFotoSecici").click();
  };
  document.getElementById("btnAjKaynakVazgec").onclick = function(){
    document.getElementById("ajKaynakOverlay").hidden = true;
  };
  document.getElementById("ajFilmSeridi").addEventListener("scroll", ajFilmKaydirmaDegisti, {passive:true});

  // Ajanda — Önizle+Kırp+Kaydet kartı (12.10.2026).
  document.getElementById("btnAjOnizleVazgec").onclick = ajOnizleVazgecTiklandi;
  document.getElementById("btnAjOnizleKaydet").onclick = ajOnizleKaydetTiklandi;
  document.getElementById("btnAjOnizleSifirla").onclick = ajKirpSifirla;
  document.querySelectorAll(".aj-onizle-tutamac").forEach(function(t){
    t.addEventListener("pointerdown", ajKirpTutamacBasladi);
  });
  // document seviyesinde dinleniyor ki parmak/imleç kırpma alanının
  // dışına taşsa bile (hızlı sürükleme) takip kesilmesin.
  document.addEventListener("pointermove", ajKirpSurukleniyor);
  document.addEventListener("pointerup", ajKirpBirakildi);
  document.addEventListener("pointercancel", ajKirpBirakildi);

  document.getElementById("ziyFirmaAra").addEventListener("input", firmaAramaCiz);

  // Temas pop-up (25.09.2026) — "Temas" tuşu açar, tür seçilince ya da
  // "Kapat" ile kapanır.
  document.getElementById("btnZiyTemasAc").onclick = function(){
    document.getElementById("ziyTemasOverlay").hidden = false;
  };
  document.getElementById("btnZiyTemasKapat").onclick = function(){
    document.getElementById("ziyTemasOverlay").hidden = true;
  };
  document.querySelectorAll(".ziy-tur-btn[data-tur]").forEach(function(btn){
    btn.onclick = function(){
      seciliTur = this.getAttribute("data-tur");
      turSecimGuncelle();
      document.getElementById("ziyTemasOverlay").hidden = true;
    };
  });
  document.getElementById("ziyHatirlatmaCheck").addEventListener("change", function(){
    document.getElementById("ziyHatirlatmaTarih").hidden = !this.checked;
  });

  document.getElementById("btnZiyKaydet").onclick = function(){
    if(!seciliFirma){ hataGoster("Önce bir firma seç."); return; }
    var not = document.getElementById("ziyNot").value;
    var hatirlatma = document.getElementById("ziyHatirlatmaCheck").checked
      ? document.getElementById("ziyHatirlatmaTarih").value
      : null;
    var btn = document.getElementById("btnZiyKaydet");
    btn.disabled = true;
    btn.textContent = "Kaydediliyor...";
    CustomerData.ziyaretEkle(seciliFirma.ad, not, seciliTur, hatirlatma, function(basarili, err){
      btn.disabled = false;
      btn.textContent = "✓ Kaydet";
      if(basarili){
        panelKapat();
      } else {
        hataGoster("Kaydedilemedi: " + (err && err.message ? err.message : "bilinmeyen hata"));
      }
    });
  };

  document.getElementById("btnZiyHatirlatmaKapat").onclick = function(){
    document.getElementById("ziyHatirlatmaOverlay").hidden = true;
  };

  CustomerData.listeDegistiginde(function(){ if(seciliGunAnahtari===null) takvimiCiz(); });
  if(typeof ReportsData !== "undefined"){
    ReportsData.arsivDegistiginde(function(){
      takvimiCiz();
      if(seciliGunAnahtari && seciliGorunum==="temas") gununIslemleriniCiz(seciliGunAnahtari);
    });
  }
  if(typeof AjandaData !== "undefined"){
    AjandaData.degistiginde(function(){
      takvimiCiz();
      if(seciliGunAnahtari && seciliGorunum==="ajanda") ajandaFilmSeridiniCiz(seciliGunAnahtari);
    });
  }

  var urlParams = new URLSearchParams(window.location.search);
  var urlTarih = urlParams.get("tarih"); // "YYYY-MM-DD" — bkz. Ana Sayfa "Günün Özeti" kutusu
  if(urlTarih && /^\d{4}-\d{2}-\d{2}$/.test(urlTarih)){
    var parcaUrl = urlTarih.split("-");
    goruntulenenYil = parseInt(parcaUrl[0], 10);
    goruntulenenAy = parseInt(parcaUrl[1], 10) - 1;
    document.getElementById("ziyGunFiltre").value = urlTarih;
    takvimiCiz();
    gunSecildi(urlTarih);
  } else {
    takvimiCiz();
  }
  hatirlatmalariKontrolEt();
});
