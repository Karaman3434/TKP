// menu-cekmece.js — WG.271026.2037.1108
// GÜNCELLEME (27.10.2026, Abdullah onayı — mockup7b üzerinden, 2 tur geri
// bildirim sonrası: "Okey tamamdır çok güzel olmuş onaylıyorum"): Müşteri
// mini arama sonucuna dokununca ARTIK customer.html'e hiç GİTMİYOR — bunun
// yerine AYNI yüzen panelin (.as-drawer-mini-sonuc-panel) içeriği, müşteri
// isminin hemen altında, customer.html'deki hızlı pencereyle BİREBİR aynı
// görünümde (Cari/Temas/İşlem Yap/Fatura Takip/İşlem Geçmişi/Görevlerim/
// Ürün Geçmişi/Bekleyen Ürünler) YERİNDE değişiyor — bkz. aşağıdaki
// "MÜŞTERİ HIZLI PENCERESİ" bölümü (mc* önekli, belge-render.js'teki bhp*
// bölümünün AYNI mantıkla buraya taşınmış hali — musteri-serit.js/css ve
// customer-render.js'e YİNE dokunulmadı). Panel bu moddayken standart/dar
// genişlikte (.as-drawer-mini-sonuc-panel--aksiyon, 230-280px) ve dikeyde
// kısıtlama/kaydırma OLMADAN (tüm 8 öge görünür) gösteriliyor — asıl
// arama-sonuç listesi geniş/kaydırmalı haliyle DEĞİŞMEDİ. "‹ Sonuçlara
// dön" gibi bir buton BİLEREK YOK — arama kutusuna yeniden yazmak zaten
// otomatik olarak sonuç listesine döndürüyor (calistir() her input
// olayında panели yeniden çiziyor). Rozet sayıları ReportsData o sayfada
// yüklüyse hesaplanıyor (çoğu sayfada, ör. home.html'de yüklü değil —
// graceful degrade, Belge Önizleme'deki Fatura Takip ile AYNI emsal).
// "Dönüş rotası" (weiconv2_musteri_donus_sayfa) BİLEREK ayarlanmıyor —
// drawer HER sayfadan açılabildiği için, aksiyonlardan dönüş normal
// tarayıcı geçmişiyle (zaten önceki sayfa neresiyse oraya) oluyor.
// Ayrıca DRAWER_ALT_MENULERI.musteri'deki iki satırın etiketi Abdullah'ın
// istediği metinle değiştirildi (href'ler AYNI): "Müşteri Listesi" →
// "Tüm Müşterileri Gör", "Yeni Müşteri" → "Yeni Müşteri Ekle".
// ---- ÖNCEKİ GÜNCELLEME NOTLARI (artık geçerli değil, tarihsel referans
// için bırakıldı aşağıda) ----
// GÜNCELLEME (27.10.2026, Abdullah onayı — ekran görüntüsü üzerinden):
// Müşteri mini arama sonucuna dokununca artık DOĞRUDAN customer-cari-
// kart.html'e GİTMİYOR — bunun yerine customer.html'e "?musteriAc=<id>"
// ile gidilip, oradaki GERÇEK "hızlı pencere" (hizliPencereyiAc, Cari/
// Temas/İşlem Yap/Fatura Takip/İşlem Geçmişi/Görevlerim/Ürün Geçmişi/
// Bekleyen Ürünler seçenekleriyle) otomatik açılıyor — kullanıcı oradan
// istediği işlemi seçiyor (bkz. customer-render.js'teki yeni "musteriAc"
// bloğu). Bu, hızlı pencereyi BURADA (42 sayfada paylaşılan dosyada)
// ReportsData/VadeTakip gibi ağır modüllerle yeniden inşa etmek yerine,
// GERÇEK ve TEK yerdeki kodu aynen çağırtan "?ac=" deseninin (bkz.
// urun-arama.js ?ac=hit/yeniurun/hesapla) bir devamı.
// GÜNCELLEME (27.10.2026, Abdullah onayı — mockup5 üzerinden, 5 tur geri
// bildirim sonrası: "Ok tmm kodlayalım") — "Ürün" ve "Müşteri" satırlarına,
// etiketin hemen yanında DOĞRUDAN yazılabilen bir mini arama kutusu
// eklendi (bkz. "MİNİ ARAMA" bölümü aşağıda). Yazılan sorguya göre ayrı,
// yüzen bir sonuç penceresinde (altMenuAc'ın "yana açılan panel"iyle AYNI
// konumlandırma dili, ama bu sefer kutunun altında) gerçek Ürün Bul /
// Müşteri Listesi satırları gösterilir; bir sonuca dokununca normal
// akıştaki SAME hedefe gidilir — "Ürün Bul sayfasına gidip orada ara"
// ara adımı atlanır. ProductData/CustomerData bu dosyanın yüklendiği
// HER sayfada mevcut DEĞİL (ikisi de sadece bir alt küme sayfada
// yükleniyor) — bu yüzden ilk kullanımda (ilk odaklanma/yazma) GEREKEN
// modül dinamik <script> ile BİR KEZ eklenir (zaten o sayfada yüklüyse
// hiç dokunulmaz). İki varsayım, kullanıcıya KODLAMA TESLİMİNDE açıkça
// not edilecek: "M-1234 formatı" talebi bu özelliğin KENDİ tasarımıyla
// karşılanıyor, diğer sayfalara YAYILMADI. (Müşteri sonucuna dokununca
// NE olacağı 27.10.2026'da yukarıdaki güncellemeyle netleşti: hızlı
// pencere açılıyor, doğrudan Cari Kart'a gidilmiyor.)
// GÜNCELLEME (26.10.2026, Abdullah onayı) — "Bakiyedeki Ürünler" etiketi,
// bu ekranın "tamamen bekleyen" + "kısmi bakiyede" ürünleri BİRLİKTE
// gösterdiğini daha net yansıtsın diye "Bakiye ve Bekleyen Ürünler" olarak
// değiştirildi (davranış/liste AYNI — sadece etiket).
// GÜNCELLEME (26.10.2026, Abdullah onayı — mockup üzerinden: "Ok süper
// kodlayalım onaylıyorum") — "Araç KM" satırının altına, en son girilen
// günün tarihi + km'si küçük bir durum satırı olarak eklendi (bkz.
// mcAracKmDurumunuGetir / mcOgeHtml altındaki "aracKmDurum" dalı). Bu
// durum SADECE "kmTakip" Firebase düğümünden TEK SEFERLİK (.once) okunur
// — km-data.js'in TAMAMI (ödeme/çarpan/hak/not için 4 ayrı SÜREKLİ
// dinleyici daha) bilerek buraya dahil edilmedi, çünkü bu dosya ~42
// sayfanın HEPSİNDE yükleniyor ve o kadar sayfada 5 kalıcı dinleyici
// başlatmak gereksiz yük olurdu. firebase SDK + app init zaten her
// sayfada auth.js ile (menu-cekmece.js'ten ÖNCE) hazır oluyor.
// ============================================================================
// MENÜ ÇEKMECESİ — TÜM SAYFALARDA PAYLAŞILAN TEK KAYNAK (23.10.2026,
// Abdullah'ın isteğiyle — mockup onaylandı: "Okey tamam kodlayalım").
// ----------------------------------------------------------------------------
// Bu dosyadan ÖNCE sadece home.html'e özel (home-render.js içinde) olan
// çekmece aç/kapat + "yana açılan alt menü" mantığı artık BURADA, tek
// yerde — hem home.html hem diğer ~43 sayfa AYNI kodu kullanıyor.
//
// NEDEN BU DOSYA VAR (23.10.2026'daki HİT/YENİ CSS hatasının dersi):
// Aynı mantığın birden fazla dosyada kopyalanması ileride birbirinden
// sapar ve fark edilmesi zor hatalara yol açar. Çekmece HER sayfada
// AYNI davransın diye bu kod TEK yerde tutuluyor; yarın bir satır/izin
// eklemek/değiştirmek gerekirse SADECE bu dosya değişir.
//
// İZİN FİLTRELEME MANTIĞI:
// MC_OGELER tablosundaki her satır, o çekmece satırının hangi izin
// anahtar(lar)ına bağlı olduğunu tanımlar. Kullanıcının (auth.js'teki
// window.izinVarMi ile) o anahtarlardan EN AZ BİRİNE sahip olması
// yeterli — örn. "Raporlar" kategorisi, altındaki 6 alt sayfadan
// herhangi birine izni varsa açık görünür (kilitli değil). Bu, admin/
// kısıtlanmamış hesaplarda (window.WEICON_IZINLER null/undefined)
// izinVarMi() zaten her zaman true döndüğü için HİÇBİR DAVRANIŞ
// DEĞİŞİKLİĞİ yaratmaz — sadece kısıtlı çalışanlarda devreye girer.
//
// ÖNEMLİ — ZAMANLAMA: izinler (window.WEICON_IZINLER) sayfa yüklenir
// yüklenmez değil, Firebase'den auth.js çözdükten SONRA hazır olur —
// auth.js bunu "weiconAuthHazir" custom event'iyle bildirir (tüm
// sayfalarda zaten kullanılan, kanıtlanmış bir desen). Çekmece İÇERİĞİ
// (kilitli/açık satırlar) bu event geldiğinde oluşturulur; açma/kapama
// gibi tıklama bağlamaları ise sayfa yüklenir yüklenmez (DOMContentLoaded)
// yapılabilir çünkü onlar izinden bağımsızdır.
// ============================================================================

// ---------- ÇEKMECE SATIRLARI TABLOSU ----------
// anahtarlar: bu satırın AÇIK sayılması için izinVarMi() ile kontrol
//   edilecek anahtarlar — herhangi biri geçerse satır açık (kilitli değil).
// href: doğrudan bağlantı (altMenu YOKSA).
// altMenu: DRAWER_ALT_MENULERI'ndeki anahtar (tıklayınca yana panel açılır).
var MC_OGELER = [
  // DEĞİŞİKLİK (26.10.2026, Abdullah onayı — mockup üzerinden): "Ürün Bul"
  // artık diğer satırların çoğu gibi doğrudan linke gitmiyor — "Müşteri"
  // satırındaki AYNI mekanizmayla (altMenu) küçük bir alt menü açıyor
  // (bkz. DRAWER_ALT_MENULERI.urun). Etiket de "Ürün" olarak kısaltıldı —
  // açılan alt menünün başlığı zaten "Ürün Bul" diyor, iki seviyede aynı
  // metni tekrar etmemek için.
  // EKLENDİ (27.10.2026): miniArama — bu satırın yanına inline arama kutusu
  // basar (bkz. mcOgeHtml). "urun" satırında AYRICA miniAramaIzin ile ince
  // taneli bir izin kontrolü var — Ürün Bul sayfasının KENDİSİNDE arama
  // kutusu "sepetAramaGoster" iznine bağlı (bkz. urun-arama.js uaIzinleriUygula);
  // bu izin kapalıyken drawer kısayolu sayfadan DAHA FAZLA yetki vermemeli,
  // o yüzden aynı anahtar burada da kontrol ediliyor (yoksa satır eski
  // haline / sadece altMenu'ye düşer). Müşteri'de böyle ince bir alt izin
  // yok (customer.html'de arama herkese "musteriBul" ile açık).
  { anahtarlar: ["sepet"], ikon: "🔍", renk: "#5dade2", etiket: "Ürün", altMenu: "urun", miniArama: "urun", miniAramaIzin: "sepetAramaGoster" },
  { anahtarlar: ["musteriBul"], ikon: "👥", renk: "#5dade2", etiket: "Müşteri", altMenu: "musteri", miniArama: "musteri" },
  { anahtarlar: ["islemGecmisi"], ikon: "🕐", etiket: "Son İşlemler", href: "son-islemler.html" },
  { anahtarlar: ["markaKarsilastirma"], ikon: "🔄", renk: "#5dade2", etiket: "Marka Karşılaştırma", href: "marka-karsilastirma.html" },
  { anahtarlar: ["kmTakip"], ikon: "🚗", renk: "#ec7063", etiket: "Araç KM", altMenu: "arackm", aracKmDurum: true },
  { anahtarlar: ["raporlar", "satisListesi", "hareketler", "ziyaret", "takipGerekenler", "gorevler"], ikon: "📊", renk: "#f5b041", etiket: "Raporlar", altMenu: "raporlar" },
  { anahtarlar: ["vadeTakip"], ikon: "📄", etiket: "Fatura · Vade · Ödeme Takip", href: "vade-takip.html" },
  { anahtarlar: ["maasHesaplama", "netMaasHesaplama", "avansTakibi", "odenebilirKomisyon"], ikon: "🔒", renk: "#f5c451", etiket: "Kişisel", href: "kisisel.html" }
];
var MC_ANASAYFA_ANAHTAR = "anaSayfa";

// Menü içi "yana açılan" alt menü paneli tanımları — eskiden sadece
// home-render.js'de vardı (home.html'e özeldi), şimdi buraya taşındı ki
// her sayfa aynı panele aynı şekilde erişsin.
var DRAWER_ALT_MENULERI = {
  raporlar: {
    baslik: "Raporlar",
    ogeler: [
      {ikon:"📊", etiket:"İstatistikler", href:"reports.html"},
      {ikon:"📋", etiket:"Son İşlemler", href:"son-islemler.html"},
      {ikon:"📌", etiket:"Görevlerim", href:"gorevler.html"},
      {ikon:"📆", etiket:"Ziyaret Takvimi", href:"ziyaret.html"},
      {ikon:"❌", etiket:"Kaçan Satışlar", href:"kacan-satislar.html"},
      {ikon:"📦", etiket:"Bakiye ve Bekleyen Ürünler", href:"bakiye-urunler.html"}
    ]
  },
  musteri: {
    baslik: "Müşteri",
    ogeler: [
      {ikon:"📋", etiket:"Tüm Müşterileri Gör", href:"customer.html"},
      {ikon:"➕", etiket:"Yeni Müşteri Ekle", href:"customer-add.html", sinif:"as-drawer-altmenu-oge--yesil"}
    ]
  },
  // EKLENDİ (26.10.2026, Abdullah onayı — mockup üzerinden): "Ürün Bul"
  // satırının artık açtığı alt menü. "Hit Ürünler"/"Yeni Ürün Ekle" cart.
  // html'e "?ac=hit" / "?ac=yeniurun" ile gidiyor — customer-render.js'in
  // "?ac=fatura/gorev/urun" deseniyle AYNI mantık: cart.html kendi
  // DOMContentLoaded'ında bu parametreyi okuyup ilgili paneli otomatik
  // açıyor (bkz. urun-arama.js).
  urun: {
    baslik: "Ürün",
    ogeler: [
      {ikon:"🔍", etiket:"Ürün Bul", href:"cart.html"},
      {ikon:"🔥", etiket:"Hit Ürünler", href:"cart.html?ac=hit"},
      {ikon:"➕", etiket:"Yeni Ürün Ekle", href:"cart.html?ac=yeniurun", sinif:"as-drawer-altmenu-oge--yesil"}
    ]
  },
  arackm: {
    baslik: "Araç KM",
    ogeler: [
      {ikon:"🚗", etiket:"Günlük KM", href:"km.html"},
      {ikon:"📋", etiket:"Aylık KM / Excel", href:"km-kayitlar.html"},
      {ikon:"💳", etiket:"Yıllık KM Ödeme", href:"yillik-km-odeme.html"}
    ]
  }
};

// ---------- ARAÇ KM DURUM ETİKETİ (26.10.2026) ----------
// km-data.js'teki sonKayitliGunAnahtari() ile AYNI mantık (en son km
// girilmiş günü bulur — "dün" değil, kronolojik olarak en son kayıtlı
// gün), burada bağımsız/küçük bir kopyası — km-data.js'in TAMAMINI
// yüklemeden. mcAracKmDurumMetni null ise (hiç kayıt yoksa) satır eski
// haliyle (tek satır) görünür.
var AY_ADLARI_KISA_MC = ["", "Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
var mcAracKmDurumMetni = null;

function mcAracKmDurumunuGetir(){
  try{
    firebase.database().ref("kmTakip").once("value").then(function(snap){
      var kayitlar = snap.val() || {};
      var enSonAnahtar = null;
      Object.keys(kayitlar).forEach(function(k){
        var kayit = kayitlar[k];
        if(!kayit || kayit.km===undefined || kayit.km===null || kayit.km==="") return;
        if(!enSonAnahtar || k > enSonAnahtar) enSonAnahtar = k;
      });
      if(enSonAnahtar){
        var parcalar = enSonAnahtar.split("-");
        var gun = parseInt(parcalar[2], 10);
        var ay = parseInt(parcalar[1], 10);
        var kmMetni = Number(kayitlar[enSonAnahtar].km).toLocaleString("tr-TR");
        mcAracKmDurumMetni = gun + " " + AY_ADLARI_KISA_MC[ay] + " · KM Girildi (" + kmMetni + ")";
      } else {
        mcAracKmDurumMetni = null;
      }
      mcDrawerListesiOlustur();
    }).catch(function(err){ console.error("Araç KM durumu okunamadı:", err); });
  }catch(e){}
}

// ============================================================================
// MİNİ ARAMA (27.10.2026, Abdullah onayı — mockup5 üzerinden: "Ok tmm
// kodlayalım") — "Ürün"/"Müşteri" etiketlerinin yanındaki inline arama
// kutuları. TEK bir paylaşılan yüzen sonuç paneli (altMenuAc'ın "yana
// açılan panel"iyle AYNI konumlandırma/kapanma dili) hangi kutu aktifse
// onun altına konumlanır ve içeriği o kutunun türüne (ürün/müşteri) göre
// yeniden çizilir.
//
// VERİ YÜKLEME: ProductData/CustomerData bu dosyanın yüklendiği 42
// sayfanın SADECE bir kısmında zaten var. İlk kullanımda (ilk odaklanma)
// eksikse dinamik <script> ile BİR KEZ eklenir (zaten varsa dokunulmaz) —
// km-data.js için Araç KM durumu eklenirken benimsenen "sıfır maliyet, ta
// kullanılana kadar" ilkesiyle AYNI. NOT: aşağıdaki iki ?v= numarası bu
// dosyaya ELLE kopyalanmıştır — product-data.js/customer-data.js ileride
// güncellenirse buradaki numaralar da elle güncellenmeli (aksi halde
// işlevi BOZMAZ, sadece tarayıcı önbellek numarası eskir).
// ============================================================================
var mcMiniAramaPanel = null;
var mcMiniAramaAktifInput = null;
var mcUrunModulYukleniyor = false;
var mcUrunModulBekleyenler = [];
var mcMusteriModulYukleniyor = false;
var mcMusteriModulBekleyenler = [];
var mcUrunDinleyiciBagliMi = false;
var mcMusteriDinleyiciBagliMi = false;

// Katalog/müşteri listesi Firebase'den ASENKRON gelir — modül script'i
// yüklenir yüklenmez (onload) veri henüz gelmemiş olabilir (ProductData.
// ara("...") o an 0 sonuç döner). urun-arama.js'teki gerçek sayfanın
// ProductData.katalogDegistiginde(uaSonuclariCiz) deseniyle AYNI şekilde,
// veri geldiğinde panel kendiliğinden yeniden çizilsin diye BİR KEZ
// dinleyici bağlanır (modül zaten DOM'da varsa da, yeni yüklendiyse de).
function mcUrunDinleyiciyiBagla(){
  if(mcUrunDinleyiciBagliMi) return;
  mcUrunDinleyiciBagliMi = true;
  ProductData.katalogDegistiginde(function(){ mcMiniAramaYenidenCiz("urun"); });
}
function mcMusteriDinleyiciyiBagla(){
  if(mcMusteriDinleyiciBagliMi) return;
  mcMusteriDinleyiciBagliMi = true;
  CustomerData.listeDegistiginde(function(){ mcMiniAramaYenidenCiz("musteri"); });
}
// Şu an EKRANDA AÇIK olan panel, hâlâ aynı tür + aynı (boş olmayan) kutu
// aktifken veri değiştiğinde yeniden çizilir — kapalıyken veya başka bir
// kutuya geçilmişken sessizce atlanır.
function mcMiniAramaYenidenCiz(tur){
  if(!mcMiniAramaAktifInput || !mcMiniAramaPanel || mcMiniAramaPanel.hidden) return;
  if(mcMiniAramaAktifInput.getAttribute("data-mini-arama") !== tur) return;
  if(mcMiniAramaAktifInput.value.trim().length === 0) return;
  // Hızlı pencere (aksiyon) açıkken arka planda veri değişse bile üzerine
  // YAZILMAZ — kullanıcı o an bir müşterinin işlem menüsüne bakıyor olabilir.
  if(tur === "musteri" && mcMusteriAksiyonGosteriliyorMu) return;
  if(tur === "urun"){ mcUrunSonuclariniCiz(mcMiniAramaAktifInput.value, mcMiniAramaPanel); }
  else { mcMusteriSonuclariniCiz(mcMiniAramaAktifInput.value, mcMiniAramaPanel); }
  mcMiniSonucKonumla(mcMiniAramaAktifInput);
}

function mcHtmlEsc(s){
  return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function mcUrunModulunuYukle(hazirOlunca){
  if(typeof ProductData !== "undefined"){ mcUrunDinleyiciyiBagla(); hazirOlunca(); return; }
  mcUrunModulBekleyenler.push(hazirOlunca);
  if(mcUrunModulYukleniyor) return;
  mcUrunModulYukleniyor = true;
  var s = document.createElement("script");
  s.src = "product-data.js?v=WG.251026.2030.1030";
  s.onload = function(){
    mcUrunDinleyiciyiBagla();
    mcUrunModulBekleyenler.forEach(function(fn){ fn(); });
    mcUrunModulBekleyenler = [];
  };
  s.onerror = function(){
    mcUrunModulYukleniyor = false;
    mcUrunModulBekleyenler = [];
    if(typeof hataGoster === "function") hataGoster("Ürün arama modülü yüklenemedi.");
  };
  document.body.appendChild(s);
}

function mcMusteriModulunuYukle(hazirOlunca){
  if(typeof CustomerData !== "undefined"){ mcMusteriDinleyiciyiBagla(); hazirOlunca(); return; }
  mcMusteriModulBekleyenler.push(hazirOlunca);
  if(mcMusteriModulYukleniyor) return;
  mcMusteriModulYukleniyor = true;
  var s = document.createElement("script");
  s.src = "customer-data.js?v=WG.201026.0610.857";
  s.onload = function(){
    mcMusteriDinleyiciyiBagla();
    mcMusteriModulBekleyenler.forEach(function(fn){ fn(); });
    mcMusteriModulBekleyenler = [];
  };
  s.onerror = function(){
    mcMusteriModulYukleniyor = false;
    mcMusteriModulBekleyenler = [];
    if(typeof hataGoster === "function") hataGoster("Müşteri arama modülü yüklenemedi.");
  };
  document.body.appendChild(s);
}

function mcMiniSonucPaneliOlustur(){
  if(mcMiniAramaPanel) return mcMiniAramaPanel;
  var panel = document.createElement("div");
  panel.className = "as-drawer-mini-sonuc-panel";
  panel.id = "asDrawerMiniSonucPanel";
  panel.hidden = true;
  var ustKap = document.getElementById("asDrawerOverlay") || document.body;
  ustKap.appendChild(panel);
  mcMiniAramaPanel = panel;
  return panel;
}

function mcMiniSonucKapat(){
  if(mcMiniAramaPanel){
    mcMiniAramaPanel.hidden = true;
    mcMiniAramaPanel.classList.remove("as-drawer-mini-sonuc-panel--aksiyon");
  }
  mcMiniAramaAktifInput = null;
  mcMusteriAksiyonGosteriliyorMu = false;
  mcMusteriAcikKisi = null;
  var tipMenu = document.getElementById("mcMusteriTipMenu");
  if(tipMenu) tipMenu.hidden = true;
}

// altMenuAc'daki kenar-taşma kontrolüyle AYNI formül (hem yatay hem dikey).
function mcMiniSonucKonumla(input){
  var panel = mcMiniAramaPanel;
  var rect = input.getBoundingClientRect();
  var panelGenislik = panel.offsetWidth;
  var sol = rect.left;
  if(sol + panelGenislik > window.innerWidth - 8){ sol = window.innerWidth - panelGenislik - 8; }
  if(sol < 8) sol = 8;
  var ust = rect.bottom + 4;
  var panelYukseklik = panel.offsetHeight;
  if(ust + panelYukseklik > window.innerHeight - 8){ ust = window.innerHeight - panelYukseklik - 8; }
  if(ust < 8) ust = 8;
  panel.style.left = sol + "px";
  panel.style.top = ust + "px";
}

// ---- Ürün sonuçları: urun-arama.js uaSonuclariCiz ile AYNI satır/izin
// mantığı (sepetWebAc/sepetHesaplaAc), sadece 30 değil 8 sonuçla sınırlı
// (küçük yüzen pencere) ve HESAPLA butonu yerine kısaltılmış "HESAP". ----
function mcUrunSonuclariniCiz(q, panel){
  var webAcVarMi = window.izinVarMi("sepetWebAc");
  var hesaplaVarMi = window.izinVarMi("sepetHesaplaAc");
  var sonuclar = ProductData.ara(q).slice(0, 8);
  if(sonuclar.length === 0){
    panel.innerHTML = "<p class='as-drawer-mini-bos'>Sonuç bulunamadı.</p>";
    return;
  }
  var html = "<div class='data-table-container'><table class='data-table'><tbody>";
  for(var i=0;i<sonuclar.length;i++){
    var idx = sonuclar[i].idx;
    var bilgi = ProductData.urunBilgisi(sonuclar[i].item);
    html += "<tr>"
      + "<td class='product-cell" + (webAcVarMi ? " product-cell--tikla" : "") + "' data-idx='" + idx + "' title='" + (webAcVarMi ? "dokununca WEICON sayfası açılır" : "") + "'>"
      + "<div class='tablo-kod'><span class='kod-blok kod-blok--b'><span class='kod-harf'>B</span> " + mcHtmlEsc(bilgi.berta||"-") + "</span> <span class='kod-blok kod-blok--a'><span class='kod-harf'>A</span> " + mcHtmlEsc(bilgi.abas||"-") + "</span></div>"
      + "<div class='urun-adi'>" + mcHtmlEsc(bilgi.ad) + "</div>"
      + "</td>"
      + "<td class='urun-islem-hucre'><div class='urun-islem-grup'>"
      + "<span class='urun-fiyat-yazi'>" + bilgi.fiyat.toFixed(2) + " €</span>"
      + (hesaplaVarMi ? "<button class='btn-hesapla-ac' data-idx='" + idx + "' title='Hesapla ve Sepete Ekle' aria-label='Hesapla ve Sepete Ekle'>HESAP</button>" : "")
      + "</div></td>"
      + "</tr>";
  }
  html += "</tbody></table></div>";
  panel.innerHTML = html;

  if(webAcVarMi){
    panel.querySelectorAll(".product-cell--tikla").forEach(function(td){
      td.onclick = function(){
        var realIdx = parseInt(this.getAttribute("data-idx"), 10);
        var s = sonuclar.find(function(sn){ return sn.idx===realIdx; });
        if(!s) return;
        var bilgi = ProductData.urunBilgisi(s.item);
        var aramaKodu = bilgi.abas || bilgi.berta || bilgi.ad;
        window.open("https://www.weicon.com.tr/search?search=" + encodeURIComponent(aramaKodu), "_blank");
      };
    });
  }
  if(hesaplaVarMi){
    panel.querySelectorAll(".btn-hesapla-ac").forEach(function(btn){
      btn.onclick = function(e){
        e.stopPropagation();
        var realIdx = parseInt(this.getAttribute("data-idx"), 10);
        var s = sonuclar.find(function(sn){ return sn.idx===realIdx; });
        if(!s) return;
        var bilgi = ProductData.urunBilgisi(s.item);
        var kod = bilgi.abas || bilgi.berta || "";
        // cart.html kendi DOMContentLoaded'ında "?ac=hesapla&kod=..."
        // parametresini okuyup Hesapla popup'ını otomatik açar (bkz.
        // urun-arama.js — "?ac=hit"/"?ac=yeniurun" İLE AYNI desen).
        window.location.href = "cart.html?ac=hesapla&kod=" + encodeURIComponent(kod);
      };
    });
  }
}

// ---- Müşteri sonuçları: customer-render.js listeyiCiz ile AYNI satır
// markup'ı (.musteri-karti grid). Rozet/tarih sütunu SADECE o sayfada
// ReportsData zaten yüklüyse hesaplanır (home.html gibi bazı sayfalarda
// yok) — yoksa customer-render.js'teki "işlem yok" durumuyla (—) AYNI
// şekilde nötr gösterilir; bu özellik için reports-data.js'i TÜM 42
// sayfaya ekstra yüklemek kapsam dışı tutuldu. ----
var MC_MUSTERI_TIP_ROZET = {
  numune:   {kisa:"NM", bg:"#FFF0D9", fg:"#b7601f"},
  teklif:   {kisa:"FT", bg:"#DDF5E9", fg:"#0e6b34"},
  proforma: {kisa:"PF", bg:"#f3e8fb", fg:"#6a1b9a"},
  siparis:  {kisa:"SP", bg:"#DCEEFF", fg:"#0c447c"}
};
function mcMusteriSonIslemBilgisi(m){
  try{
    if(typeof ReportsData === "undefined") return null;
    var en = null;
    ReportsData.sonIslemler().forEach(function(k){
      if(!MC_MUSTERI_TIP_ROZET[k.tip]) return;
      var eslesir = (m.id && k.musteriId) ? (k.musteriId === m.id) : ((k.musteri||"").toLocaleLowerCase("tr-TR") === (m.ad||"").toLocaleLowerCase("tr-TR"));
      if(!eslesir) return;
      if(!en || k.ts > en.ts) en = {tip:k.tip, ts:k.ts};
    });
    return en;
  }catch(e){ return null; }
}
function mcMusteriTarihKisaYil(ts){
  var d = new Date(ts);
  var gg = String(d.getDate()).padStart(2,"0");
  var aa = String(d.getMonth()+1).padStart(2,"0");
  var yy = String(d.getFullYear()).slice(-2);
  return gg + "." + aa + "." + yy;
}
function mcMusteriSonuclariniCiz(q, panel){
  // Hızlı pencere (aksiyon) modundan sonuç listesine dönülüyor olabilir —
  // panel o moddayken dar/kısıtlamasız boyuttaydı, listeye dönerken geniş/
  // kaydırmalı varsayılana geri alınır (bkz. "--aksiyon" sınıfı aşağıda).
  panel.classList.remove("as-drawer-mini-sonuc-panel--aksiyon");
  mcMusteriAksiyonGosteriliyorMu = false;
  var sonuclar = CustomerData.ara(q).slice(0, 8);
  if(sonuclar.length === 0){
    panel.innerHTML = "<p class='as-drawer-mini-bos'>Sonuç bulunamadı.</p>";
    return;
  }
  var html = "<div class='musteri-liste-kutu'>";
  for(var i=0;i<sonuclar.length;i++){
    var m = sonuclar[i];
    var islem = mcMusteriSonIslemBilgisi(m);
    var serit = islem ? MC_MUSTERI_TIP_ROZET[islem.tip].fg : "#c3cad4";
    var rozetHtml = islem
      ? "<span class='musteri-rozet-h' style='background:" + MC_MUSTERI_TIP_ROZET[islem.tip].bg + ";color:" + MC_MUSTERI_TIP_ROZET[islem.tip].fg + ";'>" + MC_MUSTERI_TIP_ROZET[islem.tip].kisa + "</span>"
      : "<span class='musteri-rozet-h musteri-rozet-h--yok'>—</span>";
    html += "<div class='musteri-karti' data-i='" + i + "' style='border-left-color:" + serit + ";'>"
      + "<div class='musteri-kod-h'>" + mcHtmlEsc(m.id||"—") + "</div>"
      + "<div class='musteri-firma-h'>" + mcHtmlEsc(m.ad||"") + "</div>"
      + "<div class='musteri-konum-h'>" + mcHtmlEsc(m.sehir||"") + "</div>"
      + rozetHtml
      + "<div class='musteri-tarih-h'>" + (islem ? mcMusteriTarihKisaYil(islem.ts) : "—") + "</div>"
      + "<div class='musteri-ok-h'>&#8250;</div>"
      + "</div>";
  }
  html += "</div>";
  panel.innerHTML = html;

  panel.querySelectorAll(".musteri-karti").forEach(function(kart, i){
    kart.onclick = function(ev){
      // DEĞİŞİKLİK (27.10.2026, Abdullah onayı — mockup7b, 2. tur geri
      // bildirim sonrası): artık customer.html'e HİÇ gidilmiyor — aynı
      // panelin içeriği, müşteri isminin altında, hızlı pencereye dönüşüyor
      // (bkz. aşağıdaki "MÜŞTERİ HIZLI PENCERESİ" bölümü).
      // ev.stopPropagation() ŞART: bu tıklama panelin İÇİNDEKİ innerHTML'i
      // hemen değiştiriyor (kartın kendisi DOM'dan kopuyor) — durdurulmazsa
      // aynı click, document'teki "panel dışına tıklanınca kapat"
      // dinleyicisine kadar kabarcıklanır ve ev.target artık KOPMUŞ bir
      // düğüm olduğu için .contains() false döner, panel YANLIŞLIKLA
      // "dışarı tıklandı" sanılıp anında kapanırdı (test sırasında
      // yakalanan gerçek bir hata — bkz. test raporu).
      ev.stopPropagation();
      try{ CustomerData.sec(sonuclar[i]); CustomerData.sonGoruntulendi(sonuclar[i].ad); }catch(e){}
      mcMusteriHizliPencereGoster(sonuclar[i], panel);
    };
  });
}

// ============================================================
// MÜŞTERİ HIZLI PENCERESİ (27.10.2026, Abdullah onayı — mockup7b üzerinden
// onaylandı) — mini arama sonucuna dokununca customer.html'deki hızlı
// pencere (cm-altmenu) ile BİREBİR aynı görünüm/davranışta, ama sayfadan
// hiç ayrılmadan, AYNI yüzen panelin (.as-drawer-mini-sonuc-panel) içinde
// gösterilir. belge-render.js'teki "BELGE HIZLI PENCERE" (bhp*) bölümüyle
// AYNI mantık, buraya (mc* önekiyle) taşındı — musteri-serit.js/css ve
// customer-render.js'e YİNE dokunulmadı; iki kopya birbirinden bağımsız
// (bilerek — her sayfa kendi bağlamında kendi küçük kopyasını tutuyor,
// bu projede zaten kurulu olan desen). Rozet sayıları ReportsData o
// sayfada yüklüyse hesaplanır (home.html gibi birçok sayfada yüklü değil
// — o zaman rozetsiz/nötr görünür, Belge Önizleme'deki Fatura Takip ile
// AYNI graceful-degrade emsali).
// ============================================================
var mcMusteriAksiyonGosteriliyorMu = false;
var mcMusteriAcikKisi = null;

function mcMusteriAyniKaydiMi(kayitMusteriAdi, kayitMusteriId, seciliAd, seciliId){
  if(seciliId && kayitMusteriId) return kayitMusteriId === seciliId;
  var a = (kayitMusteriAdi||"").toLocaleLowerCase("tr-TR").trim();
  var b = (seciliAd||"").toLocaleLowerCase("tr-TR").trim();
  if(!a || !b) return false;
  if(a === b) return true;
  return a.indexOf(b) === 0 || b.indexOf(a) === 0;
}

// customer-render.js'teki cmRozetSayilariniHesapla ile AYNI hesap —
// VadeTakip bu dosyanın yüklendiği hiçbir sayfada yok, "fatura" hep 0.
function mcMusteriRozetSayilariniHesapla(m){
  var sonuc = {temas:0, gecmis:0, gorev:0, fatura:0, urun:0, bekleyen:0};
  try{ sonuc.temas = (m.ziyaretGecmisi||[]).length; }catch(e){}
  try{
    if(typeof ReportsData !== "undefined"){
      var tumu = ReportsData.sonIslemler();
      sonuc.gecmis = tumu.filter(function(k){ return mcMusteriAyniKaydiMi(k.musteri, k.musteriId, m.ad, m.id); }).length;
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
      sonuc.fatura = ogeler.filter(function(o){ return o.durum !== "vadesiz" && !o.odendi; }).length;
    }
  }catch(e){}
  try{
    if(typeof ReportsData !== "undefined" && ReportsData.musteriUrunGecmisi){
      sonuc.urun = ReportsData.musteriUrunGecmisi(m.ad, m.id).length;
    }
  }catch(e){}
  try{
    if(typeof ReportsData !== "undefined" && ReportsData.bakiyedekiUrunler){
      sonuc.bekleyen = ReportsData.bakiyedekiUrunler().filter(function(s){
        return mcMusteriAyniKaydiMi(s.musteri, s.musteriId, m.ad, m.id);
      }).length;
    }
  }catch(e){}
  return sonuc;
}

function mcMusteriRozetHTML(sayi){
  return sayi > 0 ? "<span class='cm-altmenu-rozet'>" + sayi + "</span>" : "";
}

function mcMusteriTipMenuOlustur(){
  if(document.getElementById("mcMusteriTipMenu")) return document.getElementById("mcMusteriTipMenu");
  var tipMenu = document.createElement("div");
  tipMenu.className = "as-drawer-mini-tipmenu";
  tipMenu.id = "mcMusteriTipMenu";
  tipMenu.hidden = true;
  tipMenu.innerHTML = "<div class='cm-tipmenu-baslik'>Ne için ürün arıyorsun?</div>"
    + "<button type='button' class='cm-tipmenu-oge cm-tipmenu-oge--numune' data-tip='numune'><span class='cm-tipmenu-oge-ikon'>🧪</span><span>Numune</span></button>"
    + "<button type='button' class='cm-tipmenu-oge cm-tipmenu-oge--teklif' data-tip='teklif'><span class='cm-tipmenu-oge-ikon'>💬</span><span>Fiyat Teklifi</span></button>"
    + "<button type='button' class='cm-tipmenu-oge cm-tipmenu-oge--proforma' data-tip='proforma'><span class='cm-tipmenu-oge-ikon'>🧾</span><span>Proforma Fatura</span></button>"
    + "<button type='button' class='cm-tipmenu-oge cm-tipmenu-oge--siparis' data-tip='siparis'><span class='cm-tipmenu-oge-ikon'>📦</span><span>Sipariş</span></button>";
  var ustKap = document.getElementById("asDrawerOverlay") || document.body;
  ustKap.appendChild(tipMenu);

  // ROTA DEĞİŞİKLİĞİ (27.10.2026, Abdullah onayı): tip seçilince artık
  // Cari Kart'a UĞRAMADAN direkt cart.html'e gidiliyor — bkz.
  // acik-belge-kontrol.js (açık belge kontrolü dahil, TEK paylaşılan
  // modülden; aynı değişiklik customer-render.js ve belge-render.js'teki
  // eşdeğer tip menülerine de uygulandı).
  tipMenu.querySelectorAll(".cm-tipmenu-oge").forEach(function(btn){
    btn.onclick = function(){
      if(!mcMusteriAcikKisi) return;
      var tip = this.getAttribute("data-tip");
      mcAcikBelgeKontrolIleDevamEt(mcMusteriAcikKisi, tip);
    };
  });
  return tipMenu;
}

// acik-belge-kontrol.js diğer lazy-load modüllerle (product-data.js/
// customer-data.js) AYNI desenle, SADECE gerçekten gerektiğinde yükleniyor.
var mcAbkModulYukleniyor = false;
var mcAbkModulBekleyenler = [];
function mcAcikBelgeKontrolIleDevamEt(musteri, tip){
  if(typeof AcikBelgeKontrol !== "undefined"){ AcikBelgeKontrol.tipSeciminiBaslat(musteri, tip); return; }
  mcAbkModulBekleyenler.push(function(){ AcikBelgeKontrol.tipSeciminiBaslat(musteri, tip); });
  if(mcAbkModulYukleniyor) return;
  mcAbkModulYukleniyor = true;
  var s = document.createElement("script");
  s.src = "acik-belge-kontrol.js?v=WG.271026.2024.1107";
  s.onload = function(){
    mcAbkModulYukleniyor = false;
    mcAbkModulBekleyenler.forEach(function(fn){ fn(); });
    mcAbkModulBekleyenler = [];
  };
  s.onerror = function(){
    mcAbkModulYukleniyor = false;
    mcAbkModulBekleyenler = [];
    if(typeof hataGoster === "function") hataGoster("İşlem modülü yüklenemedi.");
  };
  document.body.appendChild(s);
}

function mcMusteriTipMenuKonumla(){
  try{
    var ilk = mcMiniAramaPanel;
    var ikinci = document.getElementById("mcMusteriTipMenu");
    if(!ilk || !ikinci) return;
    var ilkRect = ilk.getBoundingClientRect();
    var ikinciGenislik = ikinci.offsetWidth;
    var sol = ilkRect.right + 8;
    if(sol + ikinciGenislik > window.innerWidth - 8){ sol = window.innerWidth - 8 - ikinciGenislik; }
    if(sol < 8) sol = 8;
    ikinci.style.left = sol + "px";
    ikinci.style.top = ilkRect.top + "px";
  }catch(e){}
}

function mcMusteriAksiyonuUygula(aksiyon){
  if(!mcMusteriAcikKisi) return;
  switch(aksiyon){
    case "cari": window.location.href = "customer-cari-kart.html"; break;
    case "temas": window.location.href = "customer-temas.html"; break;
    case "islemyap":
      var tipMenu = mcMusteriTipMenuOlustur();
      tipMenu.hidden = false;
      mcMusteriTipMenuKonumla();
      break;
    case "fatura": window.location.href = "customer-detail.html?ac=fatura"; break;
    case "gecmis": window.location.href = "gecmis.html"; break;
    case "gorev": window.location.href = "customer-detail.html?ac=gorev"; break;
    case "urun": window.location.href = "customer-detail.html?ac=urun"; break;
    case "bekleyen":
      try{ localStorage.setItem("weiconv2_bakiye_musteri_filtre", JSON.stringify({id:mcMusteriAcikKisi.id||null, ad:mcMusteriAcikKisi.ad||""})); }catch(e){}
      window.location.href = "bakiye-urunler.html";
      break;
  }
}

function mcMusteriHizliPencereGoster(musteri, panel){
  try{
    mcMusteriAcikKisi = musteri;
    mcMusteriAksiyonGosteriliyorMu = true;
    var tipMenu = document.getElementById("mcMusteriTipMenu");
    if(tipMenu) tipMenu.hidden = true;
    // Standart/dar hızlı pencere boyutu — arama sonuç listesinin geniş/
    // kaydırmalı kutusundan FARKLI (bkz. menu-cekmece-style.css).
    panel.classList.add("as-drawer-mini-sonuc-panel--aksiyon");

    var rozetler = mcMusteriRozetSayilariniHesapla(musteri);
    var baslikHtml = "<div class='cm-altmenu-musteri-baslik'>"
      + "<span><span class='ms-kod'>" + mcHtmlEsc(musteri.id||"—") + "</span></span>"
      + "<span class='ms-ad'>" + mcHtmlEsc(musteri.ad||"") + "</span>"
      + (musteri.sehir ? "<span class='ms-sehir'>" + mcHtmlEsc(musteri.sehir) + "</span>" : "")
      + "</div>";

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
    var listeHtml = ogeler.map(function(o){
      return "<button type='button' class='cm-altmenu-oge' data-aksiyon='" + o.aksiyon + "'>"
        + "<span class='cm-altmenu-oge-sol'><span class='cm-altmenu-oge-ikon' aria-hidden='true'>" + o.ikon + "</span><span>" + o.etiket + "</span></span>"
        + mcMusteriRozetHTML(o.rozet||0)
        + "</button>";
    }).join("");

    panel.innerHTML = baslikHtml + "<div id='mcMusteriHizliListe'>" + listeHtml + "</div>";
    panel.querySelectorAll("#mcMusteriHizliListe .cm-altmenu-oge").forEach(function(btn){
      btn.onclick = function(){ mcMusteriAksiyonuUygula(this.getAttribute("data-aksiyon")); };
    });

    if(mcMiniAramaAktifInput) mcMiniSonucKonumla(mcMiniAramaAktifInput);
  }catch(e){ if(typeof hataGoster === "function") hataGoster("Hızlı pencere açılamadı: " + e.message); }
}

function mcMiniAramaBagla(inp){
  var tur = inp.getAttribute("data-mini-arama");

  function modulHazirOlunca(cb){
    if(tur === "urun") mcUrunModulunuYukle(cb);
    else mcMusteriModulunuYukle(cb);
  }

  function calistir(){
    var q = inp.value;
    if(q.trim().length === 0){
      if(mcMiniAramaAktifInput === inp) mcMiniSonucKapat();
      return;
    }
    modulHazirOlunca(function(){
      // Modül yüklenene kadar kullanıcı kutuyu boşaltmış/başka kutuya
      // geçmiş olabilir — geç gelen sonucu yanlış kutu için göstermeyelim.
      if(document.activeElement !== inp || inp.value.trim().length === 0) return;
      var panel = mcMiniSonucPaneliOlustur();
      mcMiniAramaAktifInput = inp;
      panel.hidden = false;
      if(tur === "urun"){ mcUrunSonuclariniCiz(inp.value, panel); }
      else { mcMusteriSonuclariniCiz(inp.value, panel); }
      mcMiniSonucKonumla(inp);
    });
  }

  inp.addEventListener("input", calistir);
  inp.addEventListener("focus", function(){
    if(inp.value.trim().length > 0) calistir();
  });
}

var mcAltMenuAcikTetikleyici = null;

function altMenuKapat(){
  var panel = document.getElementById("asDrawerAltMenu");
  if(!panel) return;
  panel.hidden = true;
  if(mcAltMenuAcikTetikleyici) mcAltMenuAcikTetikleyici.classList.remove("as-drawer-oge--acik");
  mcAltMenuAcikTetikleyici = null;
}

function altMenuAc(anahtar, tetikleyiciEl){
  try{
    var tanim = DRAWER_ALT_MENULERI[anahtar];
    if(!tanim) return;
    if(mcAltMenuAcikTetikleyici === tetikleyiciEl){ altMenuKapat(); return; }
    altMenuKapat();

    var panel = document.getElementById("asDrawerAltMenu");
    document.getElementById("asDrawerAltMenuBaslik").textContent = tanim.baslik;
    document.getElementById("asDrawerAltMenuListe").innerHTML = tanim.ogeler.map(function(o){
      return "<a class='as-drawer-altmenu-oge" + (o.sinif ? " " + o.sinif : "") + "' href='" + o.href + "'>"
        + "<span class='as-drawer-altmenu-oge-ikon' aria-hidden='true'>" + o.ikon + "</span>"
        + "<span>" + o.etiket + "</span></a>";
    }).join("");

    panel.hidden = false;
    var rect = tetikleyiciEl.getBoundingClientRect();
    var panelGenislik = panel.offsetWidth;
    var sol = rect.right + 6;
    if(sol + panelGenislik > window.innerWidth - 8){ sol = window.innerWidth - panelGenislik - 8; }
    if(sol < 8) sol = 8;
    var ust = rect.top;
    var panelYukseklik = panel.offsetHeight;
    if(ust + panelYukseklik > window.innerHeight - 8){ ust = window.innerHeight - panelYukseklik - 8; }
    if(ust < 8) ust = 8;
    panel.style.left = sol + "px";
    panel.style.top = ust + "px";

    tetikleyiciEl.classList.add("as-drawer-oge--acik");
    mcAltMenuAcikTetikleyici = tetikleyiciEl;
  }catch(e){ if(typeof hataGoster === "function") hataGoster("Alt menü açılamadı: " + e.message); }
}

function asDrawerAc(){
  try{
    var overlay = document.getElementById("asDrawerOverlay");
    var drawer = document.getElementById("asDrawer");
    if(!overlay || !drawer) return;
    overlay.hidden = false;
    document.body.classList.add("as-drawer-kilit");
    requestAnimationFrame(function(){ drawer.classList.add("as-drawer--acik"); });
  }catch(e){ if(typeof hataGoster === "function") hataGoster("Menü açılamadı: " + e.message); }
}
function asDrawerKapat(){
  try{
    var overlay = document.getElementById("asDrawerOverlay");
    var drawer = document.getElementById("asDrawer");
    if(!overlay || !drawer) return;
    altMenuKapat();
    mcMiniSonucKapat();
    drawer.classList.remove("as-drawer--acik");
    document.body.classList.remove("as-drawer-kilit");
    setTimeout(function(){ overlay.hidden = true; }, 250);
  }catch(e){}
}

// ---------- İZİN FİLTRELİ İÇERİK OLUŞTURMA ----------
// MC_OGELER tablosundaki satırlardan en az bir anahtarı açık olanlar
// normal (tıklanabilir) satır, hiçbiri açık olmayanlar SOLUK + 🔒 kilitli
// satır olarak oluşturulur. Kilitli satırlarda href/data-alt-menu YOK
// (gerçek sayfa koruması zaten auth.js'te var — burası sadece "gösterme/
// yönlendirme" katmanı), tabindex=-1 + aria-disabled + (düğmelerde)
// disabled ile ek güvenlik (HİT/YENİ hatasının dersi: tek bir görsel
// işarete güvenmek yerine birden fazla savunma katmanı).
function mcIzinliMi(anahtarlar){
  for(var i=0; i<anahtarlar.length; i++){
    if(window.izinVarMi(anahtarlar[i])) return true;
  }
  return false;
}

function mcOgeHtml(o){
  var acik = mcIzinliMi(o.anahtarlar);
  var ikonStil = o.renk ? " style='color:" + o.renk + ";'" : "";
  var ikHtml = "<span class='as-drawer-ikon'" + ikonStil + " aria-hidden='true'>" + o.ikon + "</span>";

  // MİNİ ARAMA SATIRI — sadece temel izin (acik) VE (varsa) ince taneli
  // miniAramaIzin açıkken. Değilse aşağıdaki normal akışa (locked/normal
  // satır) devam eder — yani bu özelliğin KENDİSİ hiçbir zaman ek bir
  // "kilitli" görünüm icat etmez, sadece var olan davranışa geri döner.
  if(o.miniArama && acik && (!o.miniAramaIzin || window.izinVarMi(o.miniAramaIzin))){
    return "<div class='as-drawer-oge as-drawer-oge--miniarama'>"
      + ikHtml
      + "<button type='button' class='as-drawer-mini-etiket' data-alt-menu='" + o.altMenu + "'>" + o.etiket + "</button>"
      + "<input type='search' class='as-drawer-mini-arama-input-sabit' data-mini-arama='" + o.miniArama + "' placeholder='Ara...' autocomplete='off'>"
      + "</div>";
  }

  var etHtml;
  if(o.aracKmDurum && acik && mcAracKmDurumMetni){
    etHtml = "<span class='as-drawer-etiket-blok'><span class='as-drawer-etiket'>" + o.etiket + "</span><span class='as-drawer-km-durum'>" + mcAracKmDurumMetni + "</span></span>";
  } else {
    etHtml = "<span class='as-drawer-etiket'>" + o.etiket + "</span>";
  }
  var okHtml = "<span class='as-drawer-ok' aria-hidden='true'>" + (acik ? "›" : "🔒") + "</span>";
  if(!acik){
    if(o.altMenu){
      return "<button type='button' class='as-drawer-oge as-drawer-oge--buton as-drawer-oge--kilitli' tabindex='-1' aria-disabled='true' disabled>" + ikHtml + etHtml + okHtml + "</button>";
    }
    return "<a class='as-drawer-oge as-drawer-oge--kilitli' href='#' tabindex='-1' aria-disabled='true' onclick='return false;'>" + ikHtml + etHtml + okHtml + "</a>";
  }
  if(o.altMenu){
    return "<button type='button' class='as-drawer-oge as-drawer-oge--buton' data-alt-menu='" + o.altMenu + "'>" + ikHtml + etHtml + okHtml + "</button>";
  }
  return "<a class='as-drawer-oge' href='" + o.href + "'>" + ikHtml + etHtml + okHtml + "</a>";
}

function mcDrawerListesiOlustur(){
  try{
    var liste = document.getElementById("asDrawerListe");
    if(liste){
      liste.innerHTML = MC_OGELER.map(mcOgeHtml).join("");
      // Yeni oluşturulan data-alt-menu düğmelerini bağla — asDrawerBagla
      // sayfa yüklenirken SADECE o anda DOM'da var olan düğmeleri
      // bağlamıştı; izinler çözüldükten SONRA burada yeniden
      // oluşturulan satırlar için bağlama burada tekrarlanır.
      liste.querySelectorAll("[data-alt-menu]").forEach(function(btn){
        btn.onclick = function(ev){
          ev.preventDefault();
          ev.stopPropagation();
          altMenuAc(this.getAttribute("data-alt-menu"), this);
        };
      });
      // EKLENDİ (27.10.2026): mini arama kutuları da izinler çözüldükten
      // sonra burada yeniden oluşturuluyor — data-alt-menu düğmeleriyle AYNI
      // sebep (bu satırlar sayfa ilk yüklenirken DOM'da yok, sonradan basılıyor).
      liste.querySelectorAll("[data-mini-arama]").forEach(mcMiniAramaBagla);
    }
    var anaSayfaEl = document.getElementById("asDrawerAnaSayfa");
    if(anaSayfaEl){
      var anaAcik = window.izinVarMi(MC_ANASAYFA_ANAHTAR);
      var ok = anaSayfaEl.querySelector(".as-drawer-ok");
      if(anaAcik){
        anaSayfaEl.classList.remove("as-drawer-oge--kilitli");
        anaSayfaEl.removeAttribute("tabindex");
        anaSayfaEl.removeAttribute("aria-disabled");
        anaSayfaEl.setAttribute("href", "home.html");
        if(ok) ok.textContent = "›";
      } else {
        anaSayfaEl.classList.add("as-drawer-oge--kilitli");
        anaSayfaEl.setAttribute("tabindex", "-1");
        anaSayfaEl.setAttribute("aria-disabled", "true");
        anaSayfaEl.removeAttribute("href");
        if(ok) ok.textContent = "🔒";
      }
    }
  }catch(e){ if(typeof hataGoster === "function") hataGoster("Menü izinleri uygulanamadı: " + e.message); }
}

function asDrawerBagla(){
  try{
    var btnAc = document.getElementById("btnAsMenuAc");
    if(btnAc) btnAc.onclick = asDrawerAc;
    var btnKapat = document.getElementById("btnAsMenuKapat");
    if(btnKapat) btnKapat.onclick = asDrawerKapat;
    var overlay = document.getElementById("asDrawerOverlay");
    if(overlay){
      overlay.addEventListener("click", function(ev){
        if(ev.target === overlay) asDrawerKapat();
      });
    }
    document.querySelectorAll("[data-alt-menu]").forEach(function(btn){
      btn.onclick = function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        altMenuAc(this.getAttribute("data-alt-menu"), this);
      };
    });
    document.addEventListener("click", function(ev){
      var panel = document.getElementById("asDrawerAltMenu");
      if(!panel || panel.hidden) return;
      if(panel.contains(ev.target) || ev.target.closest("[data-alt-menu]")) return;
      altMenuKapat();
    });
    // EKLENDİ (27.10.2026): mini arama sonuç penceresi de dışarı
    // tıklanınca kapanır — yukarıdaki alt menü ile AYNI desen. Müşteri
    // hızlı penceresinin yanındaki tip seçim paneline (#mcMusteriTipMenu)
    // tıklamak da "dışarı" sayılmaz (27.10.2026, aksiyon menüsü eklendi).
    document.addEventListener("click", function(ev){
      if(!mcMiniAramaPanel || mcMiniAramaPanel.hidden) return;
      if(mcMiniAramaPanel.contains(ev.target) || ev.target.closest("[data-mini-arama]") || ev.target.closest("#mcMusteriTipMenu")) return;
      mcMiniSonucKapat();
    });
    var btnCikis = document.getElementById("btnAsCikis");
    if(btnCikis){
      btnCikis.onclick = function(){
        if(!confirm("Çıkış yapmak istediğinize emin misiniz?")) return;
        firebase.auth().signOut().then(function(){
          window.location.href = "login.html";
        });
      };
    }
  }catch(e){ if(typeof hataGoster === "function") hataGoster("Menü bağlanamadı: " + e.message); }
}

document.addEventListener("DOMContentLoaded", function(){
  asDrawerBagla();
});
window.addEventListener("weiconAuthHazir", function(ev){
  mcDrawerListesiOlustur();
  mcAracKmDurumunuGetir();
  try{
    var el = document.getElementById("asDrawerEposta");
    if(el && ev.detail && ev.detail.user) el.textContent = ev.detail.user.email;
  }catch(e){}
});
