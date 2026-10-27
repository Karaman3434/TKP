/*
  customer-render.js — WG.271026.1211.1072
  GÜNCELLEME (27.10.2026, Abdullah onayı — ana sayfa mini arama özelliği):
  "?musteriAc=<id-veya-ad>" parametresiyle buraya gelinirse, ilgili müşteri
  bulunup GERÇEK hızlı pencere (hizliPencereyiAc) otomatik açılır — bkz.
  DOMContentLoaded sonundaki yeni blok. menu-cekmece.js'teki ana sayfa mini
  arama panelinden bir müşteriye dokununca buraya bu parametreyle gelinir.
  ==================
  Liste davranışı (arama/Tüm Müşteriler/şehir filtresi/sıralama) AYNI kaldı.
  13.10.2026 (Abdullah'ın paylaştığı referans görsel + gerçek ChatGPT kodu +
  yazılı talimat metnine göre, derinlemesine yeniden tasarım): kartlı 2
  satırlı yapı kaldırıldı — artık GERÇEK TEK SATIRLIK TABLO (CSS Grid): Kod |
  Firma | Konum | Tür rozeti | Son işlem tarihi | Ok. Temas bilgisi satırdan
  kalktı (referans tasarımda yer yok, satır başına tek işlem bilgisi sığıyor)
  — kaybolmadı, müşteri hızlı penceresindeki "Temas" butonundan erişilebilir.
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
// TABLO TASARIMI (13.10.2026, Abdullah'ın paylaştığı referans görsel/kod/
// talimat metnine göre): ok artık KIRMIZI (referansın açık talebi — eski
// "nötr gri ok" kararının yerine geçti).
var MUSTERI_OK_HTML = "&#8250;";

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

// TABLO TASARIMI (13.10.2026): tarih artık dd.mm.yy biçiminde (referansın
// kesin isteği — "Tarih formatı kesinlikle dd.mm.yy olmalı"), 2 haneli yıl.
function tarihFormatlaKisaYil(ts){
  var d = new Date(ts);
  var gg = String(d.getDate()).padStart(2,"0");
  var aa = String(d.getMonth()+1).padStart(2,"0");
  var yy = String(d.getFullYear()).slice(-2);
  return gg + "." + aa + "." + yy;
}

// En son İŞLEM: numune, teklif, proforma, sipariş — satırda tek sütun
// olarak (tür rozeti + tarih) gösteriliyor. "Temas" bilgisi TABLO
// SATIRINDAN kaldırıldı (referans tasarımda yer yok — satır başına tek
// işlem türü+tarihi sığıyor); Temas bilgisi KAYBOLMADI, müşteriye
// dokunulduğunda açılan hızlı pencerede "Temas" butonu/rozeti üzerinden
// hâlâ erişilebilir (bkz. hizliPencereyiAc).
function sonIslemBilgisi(m){
  var adAnahtar = (m.ad||"").toLocaleLowerCase("tr-TR");
  var kayit = (musteriSonIslemDetayHaritasi && m.id) ? musteriSonIslemDetayHaritasi[m.id] : null;
  if(!kayit && musteriSonIslemDetayHaritasiAd) kayit = musteriSonIslemDetayHaritasiAd[adAnahtar];
  if(!kayit || !MUSTERI_TIP_ROZET[kayit.tip]) return null;
  return {tip:kayit.tip, durum:kayit.durum, ts:kayit.ts};
}

// TABLO TASARIMI (13.10.2026) — rozet renkleri referans paletiyle (sp mavi,
// ft yeşil, pf mor, nm turuncu) ve uygulamanın kendi tutarlı renk kuralıyla.
var MUSTERI_TIP_ROZET = {
  numune:   {kisa:"NM", bg:"#FFF0D9", fg:"#b7601f"},
  teklif:   {kisa:"FT", bg:"#DDF5E9", fg:"#0e6b34"},
  proforma: {kisa:"PF", bg:"#f3e8fb", fg:"#6a1b9a"},
  siparis:  {kisa:"SP", bg:"#DCEEFF", fg:"#0c447c"}
};

// Satırın solundaki renkli şerit + tür rozeti — işlem türüne göre ANLAMLI
// renk (rastgele/4'lü döngü değil; ChatGPT'nin referans kodunda şerit
// süsleme amaçlıydı ama uygulamada zaten tür=renk kuralı olduğu için bu
// daha bilgilendirici ve tutarlı).
function musteriRozetHTML(islem){
  if(!islem) return "<span class='musteri-rozet-h musteri-rozet-h--yok'>—</span>";
  var r = MUSTERI_TIP_ROZET[islem.tip];
  return "<span class='musteri-rozet-h' style='background:" + r.bg + ";color:" + r.fg + ";'>" + r.kisa + "</span>";
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
      var islem = sonIslemBilgisi(m);
      var serit = islem ? (MUSTERI_TIP_ROZET[islem.tip].fg) : "#c3cad4";
      return "<div class='musteri-karti' data-i='" + i + "' style='border-left-color:" + serit + ";'>"
        + "<div class='musteri-kod-h'>" + htmlEsc(m.id||"—") + "</div>"
        + "<div class='musteri-firma-h'>" + htmlEsc(m.ad||"") + "</div>"
        + "<div class='musteri-konum-h'>" + htmlEsc(m.sehir||"") + "</div>"
        + musteriRozetHTML(islem)
        + "<div class='musteri-tarih-h'>" + (islem ? tarihFormatlaKisaYil(islem.ts) : "—") + "</div>"
        + "<div class='musteri-ok-h'>" + MUSTERI_OK_HTML + "</div>"
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
  cmTipMenuKapat();
  cmAcikMusteri = null;
}

// ============================================================
// İŞLEM YAP — TİP SEÇİM YAN PENCERESİ (15.10.2026, Abdullah onayı)
// ============================================================
// "İşlem Yap"a basınca artık doğrudan Cari Kart'a GİTMİYOR — hızlı
// pencerenin (cm-altmenu) YANINDA bu küçük panel açılıyor, tip burada
// seçiliyor. Cari Kart adımı KALKMADI (Abdullah'ın onayladığı 1. seçenek):
// tip seçilince yine customer-cari-kart.html'e gidiliyor, sadece artık
// tip ORADA değil BURADA seçiliyor — bkz. cari-kart-render.js
// (weiconv2_tip_oncesecim_hizli bayrağı, "açık belge" uyarısı dahil o
// sayfadaki mevcut mantığı aynen kullanıyor, sadece tam ekran ızgarayı
// tekrar GÖSTERMİYOR).
function cmTipMenuKonumlandir(){
  try{
    var ilk = document.getElementById("cmAltMenu");
    var ikinci = document.getElementById("cmTipMenu");
    var sarmalayici = ilk.closest(".cm-altmenu-sarmalayici");
    if(!ilk || !ikinci || !sarmalayici) return;
    var ilkRect = ilk.getBoundingClientRect();
    var sarmalayiciRect = sarmalayici.getBoundingClientRect();
    var ikinciGenislik = ikinci.offsetWidth;
    // Önce ilk panelin hemen sağına, 8px boşlukla yerleştirmeyi dene.
    var sol = (ilkRect.right - sarmalayiciRect.left) + 8;
    // Sığmıyorsa (telefon genişliği), ekranın sağ kenarına yasla.
    if(sarmalayiciRect.left + sol + ikinciGenislik > window.innerWidth - 8){
      sol = (window.innerWidth - 8) - sarmalayiciRect.left - ikinciGenislik;
    }
    ikinci.style.left = sol + "px";
  }catch(e){}
}

function cmTipMenuAc(){
  var panel = document.getElementById("cmTipMenu");
  if(!panel) return;
  panel.hidden = false;
  cmTipMenuKonumlandir();
}

function cmTipMenuKapat(){
  var panel = document.getElementById("cmTipMenu");
  if(panel) panel.hidden = true;
}

// DÖNÜŞ ROTASI (06.10.2026, Abdullah'ın isteğiyle — "kesin kural": program
// hangi rotadan gidiyorsa o rotadan mutlaka dönmeli). Küçük pencereden
// HERHANGİ bir aksiyona girilirken burada kaydedilen bayrak, akışın
// İÇİNDEKİ her Kapat/Geri noktasında (cari-kart, cart.html, customer-
// temas.html, gecmis.html) kontrol ediliyor — varsa en fazla buraya
// (customer.html) dönülüyor, arama kutusu + şehir filtresi de geri
// yükleniyor ki aranan müşteri listede yeniden görünsün. Bayrak yoksa
// (Bildirimler/Takip Gerekenler gibi eski girişler) hiçbir şey değişmiyor.
function cmDonusRotasiniKaydet(aksiyon){
  try{
    localStorage.setItem("weiconv2_musteri_donus_sayfa", "customer.html");
    // İSTİSNA (26.10.2026, Abdullah'ın isteğiyle): "İşlem Yap" ile ilerlenip
    // geri dönüldüğünde arama kutusu artık eski müşteri adıyla GERİ
    // YÜKLENMİYOR — sıfırlanmış/boş karşılıyor, yeni arama için hemen hazır.
    // Diğer aksiyonlarda (Cari Kart/Temas/Fatura/Geçmiş/Görev/Ürün/Bekleyen)
    // 06.10.2026'da onaylanan "dönüş rotası" kuralı (arama geri yüklenir)
    // AYNEN duruyor — SADECE "islemyap" burada istisna.
    if(aksiyon === "islemyap"){
      localStorage.removeItem("weiconv2_musteri_arama_durumu");
      return;
    }
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
  cmDonusRotasiniKaydet(aksiyon);
  switch(aksiyon){
    case "cari":
      window.location.href = "customer-cari-kart.html";
      break;
    case "temas":
      window.location.href = "customer-temas.html";
      break;
    case "islemyap":
      // ROTA DEĞİŞİKLİĞİ (15.10.2026, Abdullah onayı): artık doğrudan Cari
      // Kart'a gitmiyor — hızlı pencerenin yanında tip seçim penceresi
      // açılıyor (bkz. cmTipMenuAc). Tip seçilince asıl yönlendirme
      // #cmTipMenu .cm-tipmenu-oge tıklama kolu içinde yapılıyor.
      cmTipMenuAc();
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
    if(ev.target.closest("#cmAltMenu") || ev.target.closest("#cmTipMenu") || ev.target.closest(".musteri-karti")) return;
    hizliPencereyiKapat();
  });
  // TİP SEÇİM YAN PENCERESİ (15.10.2026) — "İşlem Yap"tan açılan panelde
  // bir tipe dokununca Cari Kart'a (adres/yetkili incelemesi için) geçiliyor,
  // tip zaten burada seçildiği için cari-kart-render.js tam ekran ızgarayı
  // tekrar göstermeden akışa devam ediyor (bkz. o dosyadaki
  // weiconv2_tip_oncesecim_hizli kullanımı).
  document.querySelectorAll("#cmTipMenu .cm-tipmenu-oge").forEach(function(btn){
    btn.onclick = function(){
      if(!cmAcikMusteri) return;
      var tip = this.getAttribute("data-tip");
      // DÜZELTME: bu, "İşlem Yap" akışının asıl (gerçek) yönlendirme anı —
      // yukarıdaki cmAksiyonuUygula("islemyap") henüz sadece tip seçim
      // panelini açıyordu, gerçek navigasyon BURADA oluyor. "islemyap"
      // geçilmezse bu ikinci çağrı arama kutusunu yine kaydedip az önceki
      // sıfırlamayı ezerdi.
      cmDonusRotasiniKaydet("islemyap");
      localStorage.setItem("weiconv2_onceden_secilen_tip", tip);
      localStorage.setItem("weiconv2_tip_oncesecim_hizli", "1");
      localStorage.setItem("weiconv2_islem_yap_akisi", "1");
      window.location.href = "customer-cari-kart.html";
    };
  });
  window.addEventListener("resize", function(){
    var panel = document.getElementById("cmTipMenu");
    if(panel && !panel.hidden) cmTipMenuKonumlandir();
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

  // EKLENDİ (27.10.2026, Abdullah onayı — ana sayfa mini arama özelliği):
  // "?musteriAc=<id-veya-ad>" ile gelinirse, müşteri bulunur bulunmaz
  // GERÇEK hızlı pencere otomatik açılır — listeyiCiz'deki satır tıklama
  // işleyicisiyle (CustomerData.sec + sonGoruntulendi + temizlik +
  // hizliPencereyiAc) BİREBİR AYNI adımlar, sadece tetikleyici farklı.
  // CustomerData.listeDegistiginde deseniyle AYNI mantık: liste ilk anda
  // henüz gelmemiş olabilir, geldiğinde tekrar denenir.
  try{
    var cmAcParam = new URLSearchParams(window.location.search).get("musteriAc");
    if(cmAcParam){
      var cmAcYapildi = false;
      var cmAcDene = function(){
        if(cmAcYapildi || CustomerData.uzunluk() === 0) return;
        var m = CustomerData.musteriIdIleBul(cmAcParam) || CustomerData.musteriBul(cmAcParam);
        if(!m) return;
        cmAcYapildi = true;
        CustomerData.sec(m);
        CustomerData.sonGoruntulendi(m.ad);
        localStorage.removeItem("weiconv2_islem_yap_akisi");
        hizliPencereyiAc(m);
      };
      CustomerData.listeDegistiginde(cmAcDene);
      cmAcDene();
    }
  }catch(e){}

  listeyiCiz();
});
