/*
  bakiye-urunler-render.js — TKP.08.11.26-12:34.1504
  GÜNCELLEME (05.11.2026, Abdullah onayı): Ekran artık "Stok Bekleyen ve Bakiye
  Bekleyen" — çipler (Tümü / ⏳ Stok Bekleyen / 📦 Bakiye Bekleyen), sipariş
  seviyesinde "Stok Bekliyor" kayıtları (ReportsData.stokBekleyenSiparisler)
  + ürün satırı bakiyeleri. Eski "STOKTA HİÇ YOK" bölümü kaldırıldı (adet<=0
  satırlar Bakiye Bekleyen içinde, kart "Tamamı bekliyor" der).
  --- eski sürüm başlığı ---
  WG.261026.0845.1059
  ================================================
  GÜNCELLEME (26.10.2026, Abdullah onayı — mockup üzerinden: "Evet, bu
  tasarımı onaylıyorum, kodlayın" + "önce tamamen bekleyenler" sırası
  onaylandı): Liste artık TEK birleşik blok değil, İKİ AYRI başlıklı bölüm
  olarak çiziliyor — "🚫 Stokta Hiç Yok — Sipariş Bekliyor" (adet<=0) ÖNCE,
  "📦 Bakiyede Kalan (Kısmen Teslim Edildi)" (adet>0) SONRA. Veri kaynağı
  ve kart tasarımı (bakiyeKartHTML) DEĞİŞMEDİ — sadece gruplama ve başlık
  katmanı eklendi (bkz. bolumHTML()). Mevcut .bekleyen-blok/.bekleyen-baslik/
  .tl-liste-kutu sınıfları (satis-listesi-render.js'teki "BEKLEYEN ÜRÜNLER"
  bölümüyle AYNI, reports-style.css) birebir yeniden kullanıldı — yeni CSS
  eklenmedi.
  "Bakiyedeki / Bekleyen Ürünler" ekranı — stokta tam olmayıp müşteride
  bekleyen/bakiyede bırakılan ürün SATIRLARINI (ReportsData.
  bakiyedekiUrunler(), reports-data.js) tek bir listede gösterir.

  AYRIM (21.10.2026, Abdullah'ın isteğiyle): "tamamen yok" (elde hiç yok,
  adet=0) ile "kısmi bakiye" (bir kısmı teslim edildi, adet>0) ayrı ayrı
  gösterilir — YENİ bir veri alanı eklenMEDEN, salt mevcut u.adet / u.
  bakiyeAdet karşılaştırmasından türetilir (s.adet reports-data.js'den
  geliyor). Kart tasarımı KESİN 2 SATIR kuralına uyar (müşteri bilgisi
  + durum notu hiçbir koşulda sarmaz, uzunsa "..." ile kırpılır) — bunun
  için bu ekrana ÖZEL, paylaşılmayan .bu-kart* sınıfları kullanılır
  (diğer liste ekranlarının ortak .tl-kart/.tl-govde yapısına DOKUNULMAZ).
  Bir satıra dokunulunca o siparişin TAM tablosu açılır (satış listesindeki
  "Belgeyi Aç" ile birebir aynı localStorage devri + yönlendirme).
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

var HARF_RENK = {siparis:"#003a70", teklif:"#28a745", proforma:"#e8690a", numune:"#c2185b"};
var OK_SVG = "<svg width='8' height='12' viewBox='0 0 20 32' fill='none'><path d='M4 4 L16 16 L4 28' stroke='#e24b4a' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/></svg>";

function cariSatirHTML(kod, isim, sehir){
  return "<span class='cari-kod'>" + htmlEsc(kod||"—") + "</span>"
    + "<span class='cari-ayrac'> - </span>"
    + "<span class='cari-isim'>" + htmlEsc(isim||"") + "</span>"
    + (sehir ? "<span class='cari-ayrac'> - </span><span class='cari-sehir'>" + htmlEsc(sehir) + "</span>" : "");
}
function kodHTML(kod, tip){
  kod = String(kod == null ? "" : kod);
  var i = kod.indexOf(".");
  var harf = i > 0 ? kod.slice(0, i) : kod;
  var kalan = i > 0 ? kod.slice(i) : "";
  return "<span style='color:" + (HARF_RENK[tip] || HARF_RENK.siparis) + ";'>" + htmlEsc(harf) + "</span>" + htmlEsc(kalan);
}

// BEKLEYEN EK SATIRI (08.11.2026, Abdullah onayı): termin tarihi ("tarihi geçti"
// uyarısıyla) ve "teklif/proforma verildi" izi — ikisi de yoksa ek satır çıkmaz.
var BU_TIP_AD = TipEtiket.kisa; // 08.11.2026: tek kaynak (tip-etiketleri.js)
function ekSatirHTML(termin, ilerleme){
  var parcalar = [], uyari = false;
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(termin||"");
  if(m){
    var g = new Date(); g.setHours(0,0,0,0);
    var fark = Math.floor((g.getTime() - new Date(+m[1], +m[2]-1, +m[3]).getTime()) / 86400000);
    var t = m[3] + "." + m[2] + "." + m[1];
    if(fark > 0){ parcalar.push("📅 Termin " + t + " — " + fark + " gün geçti, gelmiş olabilir"); uyari = true; }
    else if(fark === 0){ parcalar.push("📅 Termin bugün (" + t + ")"); uyari = true; }
    else parcalar.push("📅 Termin " + t + " — " + (-fark) + " gün var");
  }
  if(ilerleme) parcalar.push("📄 " + (BU_TIP_AD[ilerleme.tip] || "Belge") + " verildi" + (ilerleme.kod ? " (" + ilerleme.kod + ")" : ""));
  if(!parcalar.length) return "";
  return "<div class='bu-kart-satir2' style='color:" + (uyari ? "#c0392b" : "#6b5a43") + ";font-weight:" + (uyari ? "800" : "600") + ";'>" + htmlEsc(parcalar.join(" · ")) + "</div>";
}

// "Tamamen yok" (s.adet<=0 — elde hiç kalmamış, sipariş tamamen bekliyor)
// ile "kısmi bakiye" (s.adet>0 — bir kısmı zaten teslim/fatura edilmiş,
// kalanı bakiyede) ayrımı SADECE bu satırda, ikon/renk/metin olarak
// yapılır — veri modeline yeni alan eklenmez (21.10.2026, Abdullah'ın
// isteğiyle). Her iki satır da KESİN 2 SATIR için nowrap+ellipsis.
function bakiyeKartHTML(s){
  var tamamenYokMu = !((s.adet||0) > 0);
  var renk = tamamenYokMu ? "#c0392b" : "#b7601f";
  var durumMetni = tamamenYokMu ? "🚫 Tamamı bekliyor" : ("📦 " + (s.bakiyeAdet||0) + " adet bakiyede");
  var satir2 = durumMetni + " — " + htmlEsc(s.urunAd) + (s.bakiyeNot ? " · " + htmlEsc(s.bakiyeNot) : "");
  return "<div class='bu-kart' data-i='" + s._i + "'>"
    + "<div class='bu-kart-serit' style='background:#faeeda;border-right:1.5px solid #b7601f;'></div>"
    + "<div class='bu-kart-govde'>"
    + "<div class='bu-kart-satir1'>"
    + "<span class='bu-kart-musteri'>" + cariSatirHTML(s.musteriId, s.musteri, s.sehir) + "</span>"
    + "<span class='bu-kart-sag'>" + kodHTML(s.kod, s.tip) + (s.tarih ? " · " + htmlEsc(s.tarih) : "") + "</span>"
    + "<button class='bu-kart-ok' aria-label='Siparişin tam tablosunu aç'>" + OK_SVG + "</button>"
    + "</div>"
    + "<div class='bu-kart-satir2' style='color:" + renk + ";'>" + satir2 + "</div>"
    + ekSatirHTML(s.termin, s.bekleyenIlerleme)
    + "</div>"
    + "</div>";
}

// Müşteri kartından "Bekleyen Ürünler" ile gelindiyse SADECE o müşterinin
// kayıtları gösterilir (07.10.2026, Abdullah'ın isteğiyle). Filtre bir kerelik
// kullanılır — okunduktan sonra temizlenir ki Raporlar'daki genel giriş
// (hiç filtresiz) her zaman tüm listeyi göstersin.
function musteriFiltresiniAlVeTemizle(){
  try{
    var ham = localStorage.getItem("weiconv2_bakiye_musteri_filtre");
    if(!ham) return null;
    localStorage.removeItem("weiconv2_bakiye_musteri_filtre");
    return JSON.parse(ham);
  }catch(e){ return null; }
}
function ayniMusteriMi(kayitAd, kayitId, seciliAd, seciliId){
  if(seciliId && kayitId) return kayitId === seciliId;
  var a = (kayitAd||"").toLocaleLowerCase("tr-TR").trim();
  var b = (seciliAd||"").toLocaleLowerCase("tr-TR").trim();
  return !!a && !!b && a === b;
}

// TARİH FİLTRESİ (21.10.2026, Abdullah onayı) — paylaşılan TarihFiltre
// bileşeni, DOMContentLoaded içinde kurulup buraya atanır.
var tarihFiltreKontrol = null;

// Bir bölümün başlık şeridini (mevcut .bekleyen-baslik — satis-listesi-
// render.js'teki "BEKLEYEN ÜRÜNLER" bölümüyle AYNI sınıf) + ya kart
// listesini ya da "bu bölüm boş" mesajını üretir. Hem "⏳ Stok Bekleyen"
// hem "📦 Bakiye Bekleyen" bölümü bu TEK fonksiyonu kullanır.
function bolumHTML(baslikMetin, liste, bosMetin, kartFn){
  var ic = liste.length
    ? "<div class='tl-liste-kutu'>" + liste.map(kartFn || bakiyeKartHTML).join("<div class='bu-kart-ayrac'></div>") + "</div>"
    : "<p class='bos-mesaj' style='margin:10px 12px;'>" + htmlEsc(bosMetin) + "</p>";
  return "<div class='bekleyen-blok'>"
    + "<div class='bekleyen-baslik'>" + htmlEsc(baslikMetin) + " — " + liste.length + " kayıt</div>"
    + ic
    + "</div>";
}

// STOK BEKLEYEN kartı (05.11.2026, Abdullah onayı: "Stok bekleyen ve bakiye
// bekleyen olarak etiketleri güncelleyelim / Bu tasarımı benimsiyorum"):
// sipariş SEVİYESİNDE "Stok Bekliyor" işaretli kayıt. Bakiye kartıyla AYNI
// iskelet (.bu-kart*) — 2. satır: "⏳ N gündür stok bekliyor — {not}".
function stokKartHTML(s){
  var gunMetni = s.gun > 0 ? (s.gun + " gündür stok bekliyor") : "Bugün stok beklemeye alındı";
  var satir2 = "⏳ " + gunMetni + (s.beklemedeNot ? " — " + htmlEsc(s.beklemedeNot) : "");
  return "<div class='bu-kart' data-i='" + s._i + "'>"
    + "<div class='bu-kart-serit' style='background:#f3e6d3;border-right:1.5px solid #a9743b;'></div>"
    + "<div class='bu-kart-govde'>"
    + "<div class='bu-kart-satir1'>"
    + "<span class='bu-kart-musteri'>" + cariSatirHTML(s.musteriId, s.musteri, s.sehir) + "</span>"
    + "<span class='bu-kart-sag'>" + kodHTML(s.kod, s.tip) + (s.tarih ? " · " + htmlEsc(s.tarih) : "") + "</span>"
    + "<button class='bu-kart-ok' aria-label='Siparişin tam tablosunu aç'>" + OK_SVG + "</button>"
    + "</div>"
    + "<div class='bu-kart-satir2' style='color:#a9743b;'>" + satir2 + "</div>"
    + ekSatirHTML(s.termin, s.bekleyenIlerleme)
    + "</div>"
    + "</div>";
}

// Aktif filtre çipi: "" (Tümü) | "stok" | "bakiye"
var aktifTurFiltre = "";

function listeyiCiz(){
  try{
    var govde = document.getElementById("buGovde");

    var musteriFiltre = musteriFiltresiniAlVeTemizle();
    // Müşteri filtresi bir kerelik okunur; sonraki yeniden çizimlerde (tarih/çip
    // değişimi) korunması için ilk okunanı saklarız.
    if(musteriFiltre){
      musteriFiltreSaklanan = musteriFiltre;
      // Müşteri popover'ından gelindi (08.11.2026): Geri/Kapat Raporlar menüsüne
      // değil, geldiği yere (popover'a) dönsün.
      try{
        var bGeri = document.querySelector(".ub-btn--geri");
        if(bGeri){ bGeri.setAttribute("href", "home.html"); bGeri.setAttribute("data-popover-geri", ""); }
        var bKapat = document.getElementById("btnUstKapat");
        if(bKapat) bKapat.removeAttribute("data-kapat-hedef");
      }catch(e){}
    }
    musteriFiltre = musteriFiltreSaklanan;

    function suz(liste){
      if(musteriFiltre) liste = liste.filter(function(s){ return ayniMusteriMi(s.musteri, s.musteriId, musteriFiltre.ad, musteriFiltre.id); });
      if(tarihFiltreKontrol) liste = liste.filter(function(s){ return tarihFiltreKontrol.icindeMi(s.ts); });
      return liste;
    }
    var stokListe   = suz(ReportsData.stokBekleyenSiparisler());
    var bakiyeListe = suz(ReportsData.bakiyedekiUrunler());

    // Çip sayaçları
    var cipler = document.querySelectorAll("#buFiltreSatiri .gecmis-filtre-cip");
    cipler.forEach(function(c){
      var f = c.getAttribute("data-f");
      c.classList.toggle("gecmis-filtre-cip--aktif", f === aktifTurFiltre);
    });

    var gosterStok   = aktifTurFiltre === "" || aktifTurFiltre === "stok";
    var gosterBakiye = aktifTurFiltre === "" || aktifTurFiltre === "bakiye";
    var gorunen = (gosterStok ? stokListe : []).concat(gosterBakiye ? bakiyeListe : []);

    if(!gorunen.length){
      var ne = aktifTurFiltre === "stok" ? TipEtiket.kisa.stok + " sipariş" : aktifTurFiltre === "bakiye" ? TipEtiket.kisa.bakiye + " ürün" : TipEtiket.kisa.stok + " veya " + TipEtiket.kisa.bakiye + " kayıt";
      govde.innerHTML = "<p class='bos-mesaj' style='margin:10px 12px;'>" + (musteriFiltre
        ? (htmlEsc(musteriFiltre.ad) + " için " + ne + " yok.")
        : (ne.charAt(0).toLocaleUpperCase("tr-TR") + ne.slice(1) + " yok.")) + "</p>";
      return;
    }

    var sayac = 0;
    if(gosterStok)   stokListe.forEach(function(s){ s._i = sayac++; });
    if(gosterBakiye) bakiyeListe.forEach(function(s){ s._i = sayac++; });
    var musteriEk = musteriFiltre ? (musteriFiltre.ad.toLocaleUpperCase("tr-TR") + " — ") : "";

    // Boş bölüm, "Tümü" görünümünde de gösterilir (hangi tür boş, belli olsun);
    // tek tür seçiliyken sadece o bölüm çizilir.
    govde.innerHTML =
      (gosterStok   ? bolumHTML("⏳ " + musteriEk + TipEtiket.kisa.stok, stokListe, TipEtiket.kisa.stok + " sipariş yok.", stokKartHTML) : "") +
      (gosterBakiye ? bolumHTML("📦 " + musteriEk + TipEtiket.kisa.bakiye, bakiyeListe, TipEtiket.kisa.bakiye + " ürün yok.", bakiyeKartHTML) : "");

    govde.querySelectorAll(".bu-kart[data-i]").forEach(function(el){
      el.onclick = function(){
        var i = parseInt(this.getAttribute("data-i"), 10);
        var s = gorunen[i];
        if(!s) return;
        localStorage.setItem("weiconv2_goruntulenen_belge", JSON.stringify({tip:s.tip, ts:s.ts}));
        window.location.href = "belge-onizleme.html";
      };
    });
  }catch(e){ hataGoster("Liste çizilemedi: " + e.message); }
}
var musteriFiltreSaklanan = null;

document.addEventListener("DOMContentLoaded", function(){
  tarihiGuncelle();
  var btnMenuEl = document.getElementById("btnMenu");
  if(btnMenuEl) btnMenuEl.onclick = function(){ window.location.href = "menu.html"; };
  document.querySelectorAll("#buFiltreSatiri .gecmis-filtre-cip").forEach(function(c){
    c.onclick = function(){ aktifTurFiltre = this.getAttribute("data-f") || ""; listeyiCiz(); };
  });
  tarihFiltreKontrol = TarihFiltre.ekle("tarihFiltreYeri", { varsayilan: "tumu", degisti: listeyiCiz });
  ReportsData.arsivDegistiginde(listeyiCiz);
  listeyiCiz(); // ilk çizim (arşiv dinleyicisi geç kalırsa boş kalmasın)
});
