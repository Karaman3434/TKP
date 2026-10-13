/*
  customer-render.js — WG.131026.1540.801
  ==================
  Eski uygulamanın musteriListesiniRenderEt() mantığıyla BİREBİR aynı:
  - Arama yokken: sadece en son eklenen 12 müşteri (dizinin başı, çünkü yeni
    kayıtlar unshift ile başa ekleniyor), + "Tüm Müşterileri Göster" butonu.
  - Arama aktifken: TÜM eşleşenler, en son görüntülenene göre sıralı.
  - Her satır: isim + (varsa) ziyaret rozeti üstte; müşteri kodu + şehir altta.
    Zebra desenli (bir alt, bir üst renk).
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
// Ok işareti — Son İşlemler/Belge Geçmişi'nde kullanılan AYNI nötr gri
// ok (13.10.2026, Abdullah onayı — mockup'ta gösterilen gri hali). Eskiden
// kırmızıydı (#e24b4a); kırmızı bu uygulamada zaten "kimlik/uyarı" rengi
// (müşteri kodu, Kaçan Satışlar) olduğu için navigasyon okunda tekrarlanmıyor.
var MUSTERI_OK_SVG = "<svg width='9' height='15' viewBox='0 0 9 15' fill='none'><path d='M1 1L7.5 7.5L1 14' stroke='#aab2bd' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></svg>";

function cariSatirHTML(kod, isim, sehir){
  return "<span class='cari-kod'>" + htmlEsc(kod||"—") + "</span>"
    + "<span class='cari-ayrac'> - </span>"
    + "<span class='cari-isim'>" + htmlEsc(isim||"") + "</span>"
    + (sehir ? "<span class='cari-ayrac'> - </span><span class='cari-sehir'>" + htmlEsc(sehir) + "</span>" : "");
}

var tumMusterilerModuAktif = false;

// Bir müşterinin "son aktivite" zamanı = en son ziyaret VEYA en son işlem
// tarihinden hangisi daha yeniyse. Arama/Tüm Müşteriler sıralamasında
// en son aktif olan müşteriler öne çıksın diye kullanılır.
var musteriSonIslemHaritasi = null; // musteriId -> son işlem ts (sıralama için)
var musteriSonIslemDetayHaritasi = null; // musteriId -> {tip, durum, ts}
var musteriSonBelgeTemasHaritasi = null; // musteriId -> {harf, ts} (mail/whatsapp gönderimi)
// HATA DÜZELTME (WG.080926.196): bazı eski/aktarılmış sipariş-teklif
// kayıtlarında musteriId hiç yok (sadece isim var) — bu kayıtlar id
// bazlı haritalarda hiç görünmüyor, müşteri listesinde yakın zamanlı
// işlemi olan müşteriler için bile yanlışlıkla "İşlem yok"/"Temas yok"
// gösteriliyordu. Bu üç harita, musteriId'si OLMAYAN kayıtlar için
// isim bazlı YEDEK arama sağlar.
var musteriSonIslemHaritasiAd = null;
var musteriSonIslemDetayHaritasiAd = null;
var musteriSonBelgeTemasHaritasiAd = null;
function sonIslemHaritasiniHazirla(){
  var ts = {}, detay = {}, belgeTemas = {};
  var tsAd = {}, detayAd = {}, belgeTemasAd = {};
  try{
    if(typeof ReportsData !== "undefined"){
      ReportsData.sonIslemler().forEach(function(k){
        var adAnahtar = (k.musteri||"").toLocaleLowerCase("tr-TR");
        var hedefTs = k.musteriId ? ts : (adAnahtar ? tsAd : null);
        var hedefDetay = k.musteriId ? detay : (adAnahtar ? detayAd : null);
        var hedefBelgeTemas = k.musteriId ? belgeTemas : (adAnahtar ? belgeTemasAd : null);
        var anahtar = k.musteriId || adAnahtar;
        if(!hedefTs) return;
        if(!hedefTs[anahtar] || k.ts > hedefTs[anahtar]) hedefTs[anahtar] = k.ts;
        if(!hedefDetay[anahtar] || k.ts > hedefDetay[anahtar].ts){
          hedefDetay[anahtar] = {tip:k.tip, durum:k.durum, ts:k.ts};
        }
        if(k.kanal === "mail" || k.kanal === "whatsapp"){
          var harf = k.kanal === "mail" ? "M" : "W";
          if(!hedefBelgeTemas[anahtar] || k.ts > hedefBelgeTemas[anahtar].ts){
            hedefBelgeTemas[anahtar] = {harf:harf, ts:k.ts};
          }
        }
      });
    }
  }catch(e){}
  musteriSonIslemHaritasi = ts;
  musteriSonIslemDetayHaritasi = detay;
  musteriSonBelgeTemasHaritasi = belgeTemas;
  musteriSonIslemHaritasiAd = tsAd;
  musteriSonIslemDetayHaritasiAd = detayAd;
  musteriSonBelgeTemasHaritasiAd = belgeTemasAd;
}
function sonAktiviteZamani(m){
  var adAnahtar = (m.ad||"").toLocaleLowerCase("tr-TR");
  var sonIslem = (musteriSonIslemHaritasi && m.id) ? musteriSonIslemHaritasi[m.id] : null;
  if(sonIslem == null && musteriSonIslemHaritasiAd) sonIslem = musteriSonIslemHaritasiAd[adAnahtar];
  var aday = [m.sonZiyaret||0, sonIslem||0];
  return Math.max.apply(null, aday);
}

var GUNLER_KISA = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
function tarihFormatlaKisa(ts){
  var d = new Date(ts);
  var gg = String(d.getDate()).padStart(2,"0");
  var aa = String(d.getMonth()+1).padStart(2,"0");
  return gg + "." + aa + "." + d.getFullYear() + " " + GUNLER_KISA[d.getDay()];
}
// MÜŞTERİ KARTI (13.10.2026, Abdullah onayı): Temas/İşlem satırında "tam
// tarih" isteniyor ama gün adı OLMADAN (mockup'ta onaylanan haliyle) —
// tarihFormatlaKisa'daki gün adını eklemiyor, sadece gg.aa.yyyy.
function tarihFormatlaTam(ts){
  var d = new Date(ts);
  var gg = String(d.getDate()).padStart(2,"0");
  var aa = String(d.getMonth()+1).padStart(2,"0");
  return gg + "." + aa + "." + d.getFullYear();
}

// En son TEMAS: ziyaret (Z), temas/telefon (T), mail gönderimi (M) veya
// WhatsApp gönderimi (W) — hangisi en yeni tarihliyse o gösterilir.
function sonTemasBilgisi(m){
  var adaylar = [];
  (m.ziyaretGecmisi||[]).forEach(function(z){
    if(z.tur === "ziyaret") adaylar.push({harf:"Z", ts:z.ts||0});
    else if(z.tur === "temas") adaylar.push({harf:"T", ts:z.ts||0});
  });
  var adAnahtar = (m.ad||"").toLocaleLowerCase("tr-TR");
  var belgeTemas = (musteriSonBelgeTemasHaritasi && m.id) ? musteriSonBelgeTemasHaritasi[m.id] : null;
  if(!belgeTemas && musteriSonBelgeTemasHaritasiAd) belgeTemas = musteriSonBelgeTemasHaritasiAd[adAnahtar];
  if(belgeTemas) adaylar.push(belgeTemas);
  if(!adaylar.length) return null;
  adaylar.sort(function(a,b){ return (b.ts||0)-(a.ts||0); });
  return adaylar[0];
}

// En son İŞLEM: numune, teklif, proforma, sipariş — beklemede olan sipariş
// için ayrıca belirtilir. Temas gibi tarihi de taşır. tip/durum, renk ve
// tam etiket için aşağıdaki temasIslemRozetleriHTML'de kullanılıyor.
function sonIslemBilgisi(m){
  var adAnahtar = (m.ad||"").toLocaleLowerCase("tr-TR");
  var kayit = (musteriSonIslemDetayHaritasi && m.id) ? musteriSonIslemDetayHaritasi[m.id] : null;
  if(!kayit && musteriSonIslemDetayHaritasiAd) kayit = musteriSonIslemDetayHaritasiAd[adAnahtar];
  if(!kayit || !MUSTERI_TIP_ETIKET[kayit.tip]) return null;
  return {tip:kayit.tip, durum:kayit.durum, ts:kayit.ts};
}

// MÜŞTERİ KARTI YENİDEN TASARIM (13.10.2026, Abdullah onayı — mockup
// üzerinden birkaç revizyon sonrası): renkler ve tam etiketler
// belge-render.js'teki TIP_RENK_BELGE / TIP_ETIKET_UZUN paletiyle AYNI
// (uygulama genelinde hareket tipi = aynı renk kuralı).
var MUSTERI_TIP_RENK = {numune:"#c0453a", teklif:"#249147", proforma:"#dcb13c", siparis:"#38469a"};
var MUSTERI_TIP_ETIKET = {numune:"Numune", teklif:"Fiyat Teklifi", proforma:"Proforma Fatura", siparis:"Sipariş"};
var TEMAS_TAM_ETIKET = {Z:"Ziyaret", T:"Telefon", M:"Mail", W:"WhatsApp"};

function temasIslemRozetleriHTML(m){
  var temas = sonTemasBilgisi(m);
  var islem = sonIslemBilgisi(m);
  var temasHTML = temas
    ? "<span class='musteri-detay-oge musteri-detay-oge--sol'><span class='musteri-detay-etiket'>Temas:</span> " + htmlEsc(TEMAS_TAM_ETIKET[temas.harf] || temas.harf) + " · " + tarihFormatlaTam(temas.ts) + "</span>"
    : "<span class='musteri-detay-oge musteri-detay-oge--sol musteri-detay-oge--yok'>Temas yok</span>";
  var islemHTML;
  if(islem){
    var renk = MUSTERI_TIP_RENK[islem.tip] || "#5f6b7a";
    var etiket = MUSTERI_TIP_ETIKET[islem.tip] + (islem.durum === "beklemede" ? " (Beklemede)" : "");
    islemHTML = "<span class='musteri-detay-oge musteri-detay-oge--sag' style='color:" + renk + ";'><span class='musteri-detay-etiket' style='color:" + renk + ";opacity:.65;'>İşlem:</span> " + htmlEsc(etiket) + " · " + tarihFormatlaTam(islem.ts) + "</span>";
  } else {
    islemHTML = "<span class='musteri-detay-oge musteri-detay-oge--sag musteri-detay-oge--yok'>İşlem yok</span>";
  }
  return "<div class='musteri-detay-satir'>" + temasHTML + islemHTML + "</div>";
}


function listeyiCiz(){
  try{
    sonIslemHaritasiniHazirla();
    var q = document.getElementById("musteriAra").value;
    var kapsayici = document.getElementById("musteriListesi");
    var bos = document.getElementById("musteriBosMesaj");
    var yukleniyor = document.getElementById("musteriYukleniyor");
    var bilgiNotuEl = document.getElementById("listeBilgiNotu");
    var tumBtn = document.getElementById("btnTumMusteriler");
    var sehirFiltre = document.getElementById("musteriSehirFiltre").value;
    var tarihSirala = "eskiden-yeniye";

    if(CustomerData.uzunluk() === 0){
      kapsayici.innerHTML = "";
      bos.hidden = true;
      yukleniyor.hidden = false;
      tumBtn.hidden = true;
      bilgiNotuEl.hidden = true;
      return;
    }
    yukleniyor.hidden = true;

    var sonuclar = CustomerData.ara(q);
    var aramaAktif = q.trim().length > 0;
    bilgiNotuEl.hidden = true;
    bilgiNotuEl.className = "liste-bilgi-notu";

    if(sehirFiltre) sonuclar = sonuclar.filter(function(m){ return (m.sehir||"").toLocaleLowerCase("tr-TR").indexOf(sehirFiltre.toLocaleLowerCase("tr-TR")) >= 0; });

    var siralamaModuAktif = aramaAktif || tumMusterilerModuAktif || !!sehirFiltre;

    if(siralamaModuAktif){
      sonuclar = sonuclar.slice().sort(function(a,b){
        var fark = sonAktiviteZamani(a) - sonAktiviteZamani(b);
        return tarihSirala === "yeniden-eskiye" ? -fark : fark;
      });
      tumBtn.hidden = true;
      if(tumMusterilerModuAktif && !aramaAktif && !sehirFiltre){
        bilgiNotuEl.hidden = false;
        bilgiNotuEl.className = "liste-bilgi-notu liste-bilgi-notu--yesil";
        bilgiNotuEl.textContent = "👥 Tüm müşteriler (toplam " + sonuclar.length + ").";
      }
    } else {
      var toplamSayi = sonuclar.length;
      sonuclar = sonuclar.slice(0, 12);
      if(toplamSayi > 12){
        tumBtn.hidden = false;
      } else {
        tumBtn.hidden = true;
      }
    }

    if(sonuclar.length === 0){
      kapsayici.innerHTML = "";
      bos.hidden = false;
      return;
    }
    bos.hidden = true;

    kapsayici.innerHTML = "<div class='musteri-liste-kutu'>" + sonuclar.map(function(m, i){
      return "<div class='musteri-karti' data-i='" + i + "'>"
        + "<div class='musteri-karti-satir'>"
        + "<div class='musteri-icerik'>"
        + "<div class='musteri-ust-satir'><span class='musteri-cari-metin'>" + cariSatirHTML(m.id, m.ad, m.sehir) + "</span></div>"
        + temasIslemRozetleriHTML(m)
        + "</div>"
        + "<div class='musteri-ok-alan'>" + MUSTERI_OK_SVG + "</div>"
        + "</div>"
        + "</div>";
    }).join("") + "</div>";

    kapsayici.querySelectorAll(".musteri-karti").forEach(function(kart, i){
      kart.onclick = function(){
        CustomerData.sec(sonuclar[i]);
        CustomerData.sonGoruntulendi(sonuclar[i].ad);
        // HATA DÜZELTME (WG.100926.196): önceki bir "İşlem Yap" akışından
        // kalmış bayrak temizlenmeden buraya gelinirse, Cari Kart yanlışlıkla
        // seçim moduna (İşleme Devam Et) açılıyordu. Doğrudan listeden gelen
        // her ziyaret düz görüntüleme modunda başlamalı.
        localStorage.removeItem("weiconv2_islem_yap_akisi");
        // ROTA DEĞİŞİKLİĞİ (05.10.2026, Abdullah'ın isteğiyle): Müşteri
        // listesinden bir isme dokununca artık Hub/İşlemler sayfalarına
        // GİTMİYOR — tam burada, arama satırının altında küçük bir pencere
        // açılıyor (bkz. hizliPencereyiAc). Hub/İşlemler sayfaları SİLİNMEDİ
        // (Bildirimler ve Takip Gerekenler hâlâ customer-detail.html'e
        // doğrudan gidiyor, bkz. bildirimler-render.js/takip-gerekenler-render.js)
        // — bu pencere sadece Müşteri Bul akışı için bir kısayol.
        hizliPencereyiAc(sonuclar[i]);
      };
    });
  }catch(e){ hataGoster("Liste çizilemedi: " + e.message); }
}

// ============================================================
// MÜŞTERİ HIZLI PENCERESİ (05.10.2026)
// ============================================================
// customer-detail.html'deki ayniMusteriKaydiMi ile BİREBİR AYNI — işlem
// geçmişi sayacı için kayıt/müşteri eşleşmesi (ID varsa ID, yoksa isim).
function cmAyniMusteriKaydiMi(kayitMusteriAdi, kayitMusteriId, seciliAd, seciliId){
  if(seciliId && kayitMusteriId) return kayitMusteriId === seciliId;
  var a = (kayitMusteriAdi||"").toLocaleLowerCase("tr-TR").trim();
  var b = (seciliAd||"").toLocaleLowerCase("tr-TR").trim();
  if(!a || !b) return false;
  if(a === b) return true;
  return a.indexOf(b) === 0 || b.indexOf(a) === 0;
}

// Rozet sayıları — detail-render.js'teki ustBilgiyiCiz/siparisGecmisiniCiz/
// musteriGorevleriniCiz/faturaTakipOzetiGuncelle/urunGecmisiniAc'taki AYNI
// hesaplamalar, sadece TEK (tıklanan) müşteri için, pencere açılırken.
function cmRozetSayilariniHesapla(m){
  var sonuc = {temas:0, gecmis:0, gorev:0, fatura:0, urun:0, bekleyen:0};
  try{ sonuc.temas = (m.ziyaretGecmisi||[]).length; }catch(e){}
  try{
    if(typeof ReportsData !== "undefined"){
      var tumu = ReportsData.sonIslemler();
      sonuc.gecmis = tumu.filter(function(k){ return cmAyniMusteriKaydiMi(k.musteri, k.musteriId, m.ad, m.id); }).length;
    }
  }catch(e){}
  try{
    if(typeof ReportsData !== "undefined" && ReportsData.gorevleriGetir){
      var adAnahtar = (m.ad||"").toLocaleLowerCase("tr-TR");
      sonuc.gorev = ReportsData.gorevleriGetir().filter(function(g){
        return (g.musteriAd||"").toLocaleLowerCase("tr-TR").indexOf(adAnahtar) >= 0;
      }).length;
    }
  }catch(e){}
  try{
    if(typeof VadeTakip !== "undefined"){
      var ogeler = VadeTakip.musteriIcin(m.id, m.ad);
      var acikTakipte = ogeler.filter(function(o){ return o.durum !== "vadesiz" && !o.odendi; });
      sonuc.fatura = acikTakipte.length;
    }
  }catch(e){}
  try{
    if(typeof ReportsData !== "undefined" && ReportsData.musteriUrunGecmisi){
      sonuc.urun = ReportsData.musteriUrunGecmisi(m.ad, m.id).length;
    }
  }catch(e){}
  // BAKİYE (07.10.2026) — bu müşteriye ait, bakiyede bekleyen ürün satırı sayısı.
  try{
    if(typeof ReportsData !== "undefined" && ReportsData.bakiyedekiUrunler){
      sonuc.bekleyen = ReportsData.bakiyedekiUrunler().filter(function(s){
        return cmAyniMusteriKaydiMi(s.musteri, s.musteriId, m.ad, m.id);
      }).length;
    }
  }catch(e){}
  return sonuc;
}

function cmRozetHTML(sayi){
  return sayi > 0 ? "<span class='cm-altmenu-rozet'>" + sayi + "</span>" : "";
}

var cmAcikMusteri = null;

function hizliPencereyiAc(musteri){
  try{
    cmAcikMusteri = musteri;
    var panel = document.getElementById("cmAltMenu");
    var rozetler = cmRozetSayilariniHesapla(musteri);

    document.getElementById("cmAltMenuBaslik").innerHTML =
      "<span><span class='ms-kod'>" + htmlEsc(musteri.id||"—") + "</span></span>"
      + "<span class='ms-ad'>" + htmlEsc(musteri.ad||"") + "</span>"
      + (musteri.sehir ? "<span class='ms-sehir'>" + htmlEsc(musteri.sehir) + "</span>" : "");

    var ogeler = [
      {ikon:"🏢", etiket:"Cari", aksiyon:"cari"},
      {ikon:"📍", etiket:"Temas", aksiyon:"temas", rozet:rozetler.temas},
      {ikon:"🔍", etiket:"İşlem Yap", aksiyon:"islemyap"},
      {ikon:"📄", etiket:"Fatura Takip", aksiyon:"fatura", rozet:rozetler.fatura},
      {ikon:"🕐", etiket:"İşlem Geçmişi", aksiyon:"gecmis", rozet:rozetler.gecmis},
      {ikon:"📋", etiket:"Görevlerim", aksiyon:"gorev", rozet:rozetler.gorev},
      {ikon:"📦", etiket:"Ürün Geçmişi", aksiyon:"urun", rozet:rozetler.urun},
      {ikon:"📦", etiket:"Bekleyen Ürünler", aksiyon:"bekleyen", rozet:rozetler.bekleyen}
    ];
    document.getElementById("cmAltMenuListe").innerHTML = ogeler.map(function(o){
      return "<button type='button' class='cm-altmenu-oge' data-aksiyon='" + o.aksiyon + "'>"
        + "<span class='cm-altmenu-oge-sol'><span class='cm-altmenu-oge-ikon' aria-hidden='true'>" + o.ikon + "</span><span>" + o.etiket + "</span></span>"
        + cmRozetHTML(o.rozet||0)
        + "</button>";
    }).join("");

    document.getElementById("cmAltMenuListe").querySelectorAll(".cm-altmenu-oge").forEach(function(btn){
      btn.onclick = function(){ cmAksiyonuUygula(this.getAttribute("data-aksiyon")); };
    });

    panel.hidden = false;
  }catch(e){ hataGoster("Hızlı pencere açılamadı: " + e.message); }
}

function hizliPencereyiKapat(){
  var panel = document.getElementById("cmAltMenu");
  if(panel) panel.hidden = true;
  cmAcikMusteri = null;
}

// DÖNÜŞ ROTASI (06.10.2026, Abdullah'ın isteğiyle — "kesin kural": program
// hangi rotadan gidiyorsa o rotadan mutlaka dönmeli). Küçük pencereden
// HERHANGİ bir aksiyona girilirken burada kaydedilen bayrak, akışın
// İÇİNDEKİ her Kapat/Geri noktasında (cari-kart, cart.html, customer-
// temas.html, gecmis.html) kontrol ediliyor — varsa en fazla buraya
// (customer.html) dönülüyor, arama kutusu + şehir filtresi de geri
// yükleniyor ki aranan müşteri listede yeniden görünsün. Bayrak yoksa
// (Bildirimler/Takip Gerekenler gibi eski girişler) hiçbir şey değişmiyor.
function cmDonusRotasiniKaydet(){
  try{
    localStorage.setItem("weiconv2_musteri_donus_sayfa", "customer.html");
    var araEl = document.getElementById("musteriAra");
    var sehirEl = document.getElementById("musteriSehirFiltre");
    localStorage.setItem("weiconv2_musteri_arama_durumu", JSON.stringify({
      ara: araEl ? araEl.value : "",
      sehir: sehirEl ? sehirEl.value : ""
    }));
  }catch(e){}
}

// Her aksiyon customer-hub-render.js/detail-render.js'teki İLGİLİ tuşun
// yaptığı AYNI şeyi yapıyor — sadece aradaki Hub/İşlemler sayfası atlanıyor.
// Fatura Takip/Görevlerim/Ürün Geçmişi için customer-detail.html'e "?ac=..."
// ile gidiliyor — o sayfa AYNEN kalıyor, sadece açılışta ilgili paneli
// otomatik açması için küçük bir ek (bkz. detail-render.js).
function cmAksiyonuUygula(aksiyon){
  if(!cmAcikMusteri) return;
  cmDonusRotasiniKaydet();
  switch(aksiyon){
    case "cari":
      window.location.href = "customer-cari-kart.html";
      break;
    case "temas":
      window.location.href = "customer-temas.html";
      break;
    case "islemyap":
      localStorage.setItem("weiconv2_islem_yap_akisi", "1");
      window.location.href = "customer-cari-kart.html";
      break;
    case "fatura":
      window.location.href = "customer-detail.html?ac=fatura";
      break;
    case "gecmis":
      window.location.href = "gecmis.html";
      break;
    case "gorev":
      window.location.href = "customer-detail.html?ac=gorev";
      break;
    case "urun":
      window.location.href = "customer-detail.html?ac=urun";
      break;
    case "bekleyen":
      try{ localStorage.setItem("weiconv2_bakiye_musteri_filtre", JSON.stringify({id:cmAcikMusteri.id||null, ad:cmAcikMusteri.ad||""})); }catch(e){}
      window.location.href = "bakiye-urunler.html";
      break;
  }
}

window.addEventListener("error", function(ev){
  hataGoster("HATA: " + ev.message + " (" + (ev.filename||"").split("/").pop() + ":" + ev.lineno + ")");
});

document.addEventListener("DOMContentLoaded", function(){
  tarihiGuncelle();

  // DÖNÜŞ ROTASI — yukarıdaki cmDonusRotasiniKaydet() ile bırakılan
  // bayrağın TÜKETİLDİĞİ nokta: akışın içinden (cari-kart/cart/temas/
  // gecmis) Kapat/Geri ile buraya dönülmüşse arama kutusu + şehir
  // filtresi eski haline getirilir. Bayrak burada silinir — sonraki
  // normal ziyaretleri etkilemez.
  try{
    if(localStorage.getItem("weiconv2_musteri_donus_sayfa") === "customer.html"){
      var donusDurumu = {};
      try{ donusDurumu = JSON.parse(localStorage.getItem("weiconv2_musteri_arama_durumu") || "{}"); }catch(e2){}
      if(donusDurumu.ara) document.getElementById("musteriAra").value = donusDurumu.ara;
      if(donusDurumu.sehir) document.getElementById("musteriSehirFiltre").value = donusDurumu.sehir;
      localStorage.removeItem("weiconv2_musteri_donus_sayfa");
      localStorage.removeItem("weiconv2_musteri_arama_durumu");
    }
  }catch(e){}

  document.getElementById("musteriAra").addEventListener("input", function(){
    hizliPencereyiKapat(); // Abdullah'ın isteğiyle: yeni arama yazılınca pencere otomatik kapanır.
    listeyiCiz();
  });
  document.getElementById("musteriSehirFiltre").addEventListener("input", listeyiCiz);
  // Pencere dışına (liste alanına veya herhangi bir yere) dokununca kapat —
  // panelin/satırların kendi dokunuşları bubbling ile buraya gelmeden önce
  // yakalanmasın diye closest() ile içeride mi dışarıda mı kontrol ediliyor.
  document.addEventListener("click", function(ev){
    var panel = document.getElementById("cmAltMenu");
    if(!panel || panel.hidden) return;
    if(ev.target.closest("#cmAltMenu") || ev.target.closest(".musteri-karti")) return;
    hizliPencereyiKapat();
  });
  document.getElementById("btnTumMusteriler").onclick = function(){
    tumMusterilerModuAktif = true;
    listeyiCiz();
  };
  var btnMenuEl = document.getElementById("btnMenu");
  if(btnMenuEl) btnMenuEl.onclick = function(){ window.location.href = "menu.html"; };
  CustomerData.listeDegistiginde(listeyiCiz);
  // HATA DÜZELTME (WG.080926.196): Temas/İşlem rozetleri ReportsData'ya
  // bağlı ama liste sadece CustomerData değiştiğinde yeniden çiziliyordu.
  // Sayfa ilk açıldığında ReportsData henüz yüklenmemiş olabiliyordu —
  // veri sonradan gelince liste hiç tazelenmiyor, rozetler kalıcı olarak
  // "yok" görünüyordu. Artık ReportsData değiştiğinde de yeniden çiziliyor.
  if(typeof ReportsData !== "undefined") ReportsData.arsivDegistiginde(listeyiCiz);
  listeyiCiz();
});
