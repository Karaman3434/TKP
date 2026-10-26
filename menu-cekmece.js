// menu-cekmece.js — WG.261026.1830.1066
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
  { anahtarlar: ["sepet"], ikon: "🔍", renk: "#5dade2", etiket: "Ürün", altMenu: "urun" },
  { anahtarlar: ["musteriBul"], ikon: "👥", renk: "#5dade2", etiket: "Müşteri", altMenu: "musteri" },
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
      {ikon:"📋", etiket:"Müşteri Listesi", href:"customer.html"},
      {ikon:"➕", etiket:"Yeni Müşteri", href:"customer-add.html", sinif:"as-drawer-altmenu-oge--yesil"}
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
