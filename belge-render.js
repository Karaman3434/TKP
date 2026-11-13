/*
  belge-render.js — TKP.11.11.26-17:44.1575
  ===============
  GÜNCELLENDİ (02.11.2026, 10:22, Abdullah onayı — mockup üzerinden):
  GENEL TOPLAM kutusu artık burada elle yazılmıyor, ortak
  HareketTablo.genelToplamHtml() çağrılıyor; PRİM ayrı yeşil şerit yerine
  bu kutunun İÇİNDE.
  GÜNCELLENDİ (02.11.2026, Abdullah onayı — mockup onaylandı: "Ok
  kodlayalım onaylıyorum"): işlem/kod panelinin sağındaki pasif "Gönder"
  ikonu KALDIRILDI (hiçbir işlevi yoktu, disabled duruyordu) — panelde
  artık sadece Ayrıntı ("i") ikonu var.
  18.10.2026: "Ayrıntı" sheet'inden "Yazdır" ve "Kaçtı olarak işaretle"
  kaldırıldı (Abdullah'ın isteğiyle); İlerlet popup'ından "Tekrarla"
  kaldırıldı ve seçenekler kronolojik sıraya alındı; cari bilginin üstüne
  dönüşüm geçmişini gösteren bir süreç şeridi eklendi (surecBandiHtml).
  "weiconv2_goruntulenen_belge" localStorage anahtarından {tip, ts} okur,
  ReportsData.sonIslemler() içinden o kaydı bulur, eski uygulamanın
  faturaOnizlemeHtmlOlustur() düzenini BİREBİR üreten HTML'i çizer.

  EKLENDİ (27.10.2026, Abdullah onayı — mockup üzerinden onaylandı):
  üstteki müşteri şeridine (.musteri-serit, HareketTablo.cariKutulariHtml
  → MusteriSeridi.html ile basılır) dokununca, sayfadan hiç ayrılmadan,
  customer.html'deki hızlı pencere (cm-altmenu) ile BİREBİR aynı görünüm/
  davranışta bir pop-up açılır — bkz. aşağıdaki "BELGE HIZLI PENCERE"
  bölümü. musteri-serit.js/css ve customer-render.js'e DOKUNULMADI; bu
  pop-up'ın HTML'i/CSS'i (scoped, bkz. belge-onizleme-style-v2.css
  ".belge-hizli-pencere") ve tüm mantığı SADECE bu dosyada, yerel olarak
  (bhp* önekiyle) tutuluyor. Rozet sayıları customer-render.js'teki
  cmRozetSayilariniHesapla ile AYNI hesap, ama VadeTakip bu sayfada YÜKLÜ
  DEĞİL — bu yüzden "Fatura Takip" rozeti şimdilik hep boş/0 görünür
  (istenirse ileride vade-takip-data.js bu sayfaya da eklenebilir).
  "DÖNÜŞ ROTASI" bilerek ayarlanmıyor (weiconv2_musteri_donus_sayfa
  YAZILMIYOR) — buradan açılan Cari/Temas/Fatura/Geçmiş/Görev/Bekleyen
  aksiyonları normal tarayıcı geçmişiyle (yeni Kapat/Geri tuşlarının
  hepsi zaten "önceki sayfaya dön" mantığında) buraya geri dönüyor.
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

function htmlEsc(s){
  return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function fmt(n){
  return (n||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2});
}

// KISALTMA — KESİN KURAL (19.10.2026, Abdullah onayı — "%20 büyüt" turu):
// "FİYAT TEKLİFİ"->"F. TEKLİFİ", "PROFORMA FATURA"->"PROFORMA" — en uzun
// etiket kısalınca kutuya %20 daha büyük harfle de kırpılmadan sığıyor.
var TIP_ETIKET_BELGE = TipEtiket.kisa; // 08.11.2026: tek kaynak (tip-etiketleri.js)
var KOD_ONEK_BELGE = TipEtiket.kisa; // 08.11.2026: tek kaynak (tip-etiketleri.js) — eskiden SP/FT/PF/NM
// HATA DÜZELTME (WG.090926.196): SP/FT/PF/NM standardından önce oluşan
// eski belgelerin kodu hâlâ eski önekle (SİP./F.TEK./P.FAT./NUM.)
// başlıyor — bu yüzden renk haritası her iki öneki de tanır.
var ONEK_RENK_BELGE = {
  "SP": {yazi:"#003a70", bg:"#eaf2fc"},
  "FT": {yazi:"#0e6b58", bg:"#eafaf3"},
  "PF": {yazi:"#8a4306", bg:"#ffe4cc"},
  "NM": {yazi:"#8e0e45", bg:"#fce4ec"},
  "SİP": {yazi:"#003a70", bg:"#eaf2fc"},
  "F.TEK": {yazi:"#0e6b58", bg:"#eafaf3"},
  "P.FAT": {yazi:"#8a4306", bg:"#ffe4cc"},
  "NUM": {yazi:"#8e0e45", bg:"#fce4ec"}
};
// RENK GÜNCELLEMESİ (12.10.2026): kod formatı değişti (v3 — artık önek
// hemen ardından 3 haneli günlük sıra, "FT001   12.10.2026   15:45" gibi;
// eskiden "F.TEK.010126.1300" gibi nokta ayraçlıydı). Nokta sayarak önek
// ayıklamak yerine, önek HER ZAMAN baştaki harflerden oluştuğu için onu
// regex ile alıyoruz — hem eski hem yeni formatla çalışır.
function kodOnekiAyiklaBelge(kod){
  if(!kod) return null;
  var m = kod.match(/^[A-ZÇĞİÖŞÜ.]+?(?=[0-9])/);
  if(m && m[0]){
    return m[0].replace(/\.+$/, ""); // sondaki olası tek noktayı at ("F.TEK." gibi eski önekler)
  }
  return kod;
}
// gecmisCipSatiriHtml KALDIRILDI (18.10.2026) — eski inline "önceki→şimdi"
// çipi (alt satırda ham alert() açan btnGecmisCip ile) artık hiç
// çağrılmıyor; yerini surecBandiHtml (aşağıda, belgeyiCiz'den önce)
// aldı. Bu, "işleyiş takibi hatası" olarak teşhis edilen, gömülü/
// görünmez kalan eski mekanizmanın ta kendisiydi.
var DURUM_ETIKET = {
  iptal: {ikon:"🚫", ad:"İPTAL EDİLDİ", renk:"#c0392b", bg:"#fdeceb"},
  iade: {ikon:"↩️", ad:"İADE EDİLDİ", renk:"#6a1b9a", bg:"#f3e5f5"},
  kacan: {ikon:"❌", ad:"KAÇAN SİPARİŞ", renk:"#c0392b", bg:"#fff4e5"},
  beklemede: {ikon:"⏳", ad:TipEtiket.kisa.stok, renk:"#5b3c1e", bg:"#e9d9c3"}
};

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

function kosulKutusuHtml(ikon, etiket, deger){
  return "<div class='belge-kosul-alan'>"
    + "<div class='belge-kosul-ikon'>" + ikon + "</div>"
    + "<div><div class='belge-kosul-etiket'>" + etiket + "</div><div class='belge-kosul-deger'>" + htmlEsc(deger||"-") + "</div></div>"
    + "</div>";
}

// DÜZELTME (07.10.2026, Abdullah'ın isteğiyle): isim önündeki 👤 ikonu
// kaldırıldı — ikon artık sadece üstteki "👤 YETKİLİ BİLGİSİ" etiketinde
// var, isim etiketle aynı sol kenardan değil ~3mm daha içeriden başlıyor
// (bkz. belge-style.css .belge-yetkili-satir).
function yetkiliSatiriHtml(isim, tel, eposta){
  if(!isim && !tel && !eposta) return "";
  var parcalar = [];
  if(tel) parcalar.push("📞 " + tel);
  if(eposta) parcalar.push("✉️ " + eposta);
  return "<div class='belge-yetkili-satir'><b>" + htmlEsc(isim||"-") + "</b>"
    + (parcalar.length ? " — <span class='belge-yetkili-detay'>" + htmlEsc(parcalar.join(" · ")) + "</span>" : "")
    + "</div>";
}

// Rakamın altına küçük birim satırı ekler (€ / TL) — sayı ile birim aynı
// hücrede iki satıra ayrılır, sütun bu sayede daralabilir (07.09.2026).
// KURAL (23.09.2026): 1000 ve üzeri sayılarda (Türkçe biçimde binler
// ayracı "." olduğu için sayının içinde "." varsa) otomatik olarak biraz
// küçük yazılır — büyük tutarlar sütun çizgisine yapışmasın/taşmasın diye.
function paraHtml(sayiStr, birim){
  var buyukMu = String(sayiStr).indexOf(".") > -1;
  return "<span class='belge-para-sayi" + (buyukMu ? " belge-para-sayi--buyuk" : "") + "'>" + sayiStr + "</span><span class='belge-para-birim'>" + birim + "</span>";
}

// TEK ÜRÜN TABLOSU (19.10.2026, Abdullah onayı — "cari kart ve ürün bilgi
// tablosu tek tasarım, tek yerden kontrol" isteği): satır HTML'i artık
// BURADA elle üretilmiyor — HareketTablo.urunTablosuHtml()/satirlarHtml()
// (hareket-tablo.js, Sepet/Gönder ile paylaşılan TEK kaynak) çağrılıyor.
// Bu, 15.10.2026'da Sepet/Gönder'de "B"/"A" ile ürün kodu arasındaki
// boşluğun kaldırılmasının bu sayfaya hiç yansımamış olması gibi gerçek,
// canlı bir hatayı da düzeltiyor. Bu fonksiyon artık SADECE DEĞERLERİ
// hesaplıyor (HTML üretmiyor) — hem alttaki GENEL TOPLAM/PRİM toplamları
// (satır bazında DEĞİŞMEDİ, aynı formül) hem de HareketTablo'ya verilen
// "hesapla" callback'i için TEK kaynak. adet parametresi ana tabloda
// item.adet, bakiye tablosunda item.bakiyeAdet olarak geçilir.
function belgeSatirDegerHesapla(item, adet, kaydinKuru){
  var netBirimFiyat = item.iskBirim!==undefined ? item.iskBirim : (item.listeFiyat||0);
  var toplamEuro = netBirimFiyat * (adet||0);
  var mk = netBirimFiyat - (item.dipFiyat||0);
  var ozelFiyatMi = (item.iskonto||0) > 60;
  var satirPrim = ozelFiyatMi ? 0 : mk*(adet||0)*0.22;
  var satirPrimTl = Math.round(satirPrim * kaydinKuru);
  return { toplamEuro: toplamEuro, iskontoluFiyat: netBirimFiyat, prim: satirPrim, primTl: satirPrimTl, mudurPrimTL: satirPrimTl };
}
// HareketTablo.satirlarHtml/urunTablosuHtml'in beklediği "hesapla(u)"
// imzasında bir adaptör — CartData.hesapla ile AYNI dönüş şeklini taşır
// ({toplamEuro, iskontoluFiyat, mudurPrimTL}), ama CartData.hesapla gibi
// listeFiyat+iskonto%'den YENİDEN hesaplamaz: bu sayfa KAYDEDİLMİŞ/tarihi
// belgeleri gösterir, o yüzden kayıtta zaten duran iskBirim/dipFiyat'tan
// okur (fiyat listesi sonradan değişse bile geçmiş belge olduğu gibi kalır
// — belgeSatirDegerHesapla'nın kendisi, DEĞİŞMEDİ).
function belgeHesaplaAdaptoru(adetAlani, kaydinKuru){
  return function(item){ return belgeSatirDegerHesapla(item, item[adetAlani], kaydinKuru); };
}

// SÜREÇ ŞERİDİ KALDIRILDI (19.10.2026, Abdullah onayı — "iki yerde
// tasarlanmış" turu): surecBandiHtml() cari bilginin üstünde, alttaki
// #belgeGecmisiKutu (belgeGecmisiniCiz) ile AYNI geçmişi ikinci kez
// gösteriyordu. İkisinden daha eksiksiz olan (rota alanı olmayan eski
// kayıtlarda da belgeZinciriBul ile yedekten bulan, önceki adıma
// tıklayıp geçebilen, kendini "📜 Belge Geçmişi" başlığıyla açıklayan)
// #belgeGecmisiKutu bırakıldı, bu üstteki şerit kaldırıldı.

function belgeyiCiz(kayit, musteri){
  try{
    var urunler = kayit.urunler || [];
    var kaydinKuru = kayit.kur || (parseFloat(localStorage.getItem("weicon_kur"))||0);
    // GENEL TOPLAM/PRİM toplamları — formül DEĞİŞMEDİ (belgeSatirDegerHesapla
    // eski belgeSatirHtmlVeDeger ile birebir aynı matematiği kullanıyor),
    // sadece satır HTML'i artık ayrı (aşağıda, paylaşılan fonksiyonla).
    var netEuro = 0, toplamPrim = 0, toplamPrimTl = 0;
    urunler.forEach(function(item){
      var r = belgeSatirDegerHesapla(item, item.adet, kaydinKuru);
      netEuro += r.toplamEuro;
      if(r.prim > 0){ toplamPrim += r.prim; toplamPrimTl += r.primTl; }
    });
    // TEK ÜRÜN TABLOSU: satır HTML'i artık HareketTablo.urunTablosuHtml ile
    // üretiliyor (Sepet/Gönder ile BİREBİR aynı kaynak) — basit:false,
    // primGizli:false (bu sayfa her zaman tam/iç görünüm, PRİM ve kodu
    // gösterir), zeminSinifi:"" (ana tablo renksiz zemin).
    var satirlarHtml = HareketTablo.urunTablosuHtml(urunler, belgeHesaplaAdaptoru("adet", kaydinKuru), "", false, false, kaydinKuru);

    // BAKİYE ÜRÜN BLOĞU (08.10.2026, Abdullah'ın isteğiyle) — bakiyede kalan
    // adedi olan ürünler, ana tabloyla BİREBİR aynı sütun/tasarımda, ayrı
    // bir tabloda, ayrı bir toplamla gösterilir. Satır HTML'i artık
    // HareketTablo.satirlarHtml ile üretiliyor (SADECE tbody — bu blok
    // kendi thead'ini göstermiyor, ana tablonun başlığını görsel olarak
    // paylaşıyor, DEĞİŞMEDİ); "adet" yerine "bakiyeAdet" okunması aynı
    // adaptörle sağlanıyor.
    var bakiyeUrunler = urunler.filter(function(u){ return (u.bakiyeAdet||0) > 0; });
    var bakiyeToplamEuro = 0;
    bakiyeUrunler.forEach(function(item){ bakiyeToplamEuro += belgeSatirDegerHesapla(item, item.bakiyeAdet, kaydinKuru).toplamEuro; });
    // satirlarHtml ADET sütununda item.adet'i GÖSTERİR — bakiye tablosunda
    // gösterilecek/hesaplanacak adet item.bakiyeAdet olduğu için, satır
    // üreticisine geçmeden önce "adet" alanı bakiyeAdet ile EZİLMİŞ sığ bir
    // kopya veriliyor (orijinal kayit.urunler nesneleri DOKUNULMADAN kalır).
    var bakiyeUrunlerAdetli = bakiyeUrunler.map(function(item){
      var kopya = {}; for(var k in item){ if(item.hasOwnProperty(k)) kopya[k] = item[k]; }
      kopya.adet = item.bakiyeAdet;
      return kopya;
    });
    var bakiyeSatirlarHtml = HareketTablo.satirlarHtml(bakiyeUrunlerAdetli, belgeHesaplaAdaptoru("adet", kaydinKuru), "hareket-satir--sari", false, false, kaydinKuru);

    var durum = kayit.durum;
    var sorunluMu = durum==="iptal" || durum==="iade" || durum==="kacan";
    var beklemedeMi = durum==="beklemede";
    var durumRozetHtml = (durum && DURUM_ETIKET[durum])
      ? (beklemedeMi
          ? "<button type='button' id='beklemedeRozetBtn' class='belge-durum-rozet belge-durum-rozet--tiklanabilir' style='background:" + DURUM_ETIKET[durum].bg + ";color:" + DURUM_ETIKET[durum].renk + ";'>" + DURUM_ETIKET[durum].ikon + " BU KAYIT " + DURUM_ETIKET[durum].ad + "<div class='belge-durum-rozet-not'>" + (kayit.beklemedeNot ? htmlEsc(kayit.beklemedeNot) : "Not eklemek için dokun") + "</div></button>"
          : "<div class='belge-durum-rozet' style='background:" + DURUM_ETIKET[durum].bg + ";color:" + DURUM_ETIKET[durum].renk + ";'>" + DURUM_ETIKET[durum].ikon + " BU KAYIT " + DURUM_ETIKET[durum].ad + (durum==="kacan" && kayit.kacanRakip ? " — → "+htmlEsc(kayit.kacanRakip) : "") + "</div>")
      : "";

    var vade = (function(v){
      var s = String(v||"").trim();
      if(s === "") return "";
      var n = parseInt(s, 10);
      return (!isNaN(n) && n >= 0 && String(n) === s) ? (n + " gün") : s;
    })(musteri && musteri.vade);
    var faturaTuru = (musteri && musteri.fatura) || "";
    var kargo = (musteri && musteri.kargo) || "";
    var faturaAdr = kayit.faturaAdresi ? (kayit.faturaAdresi.adres || "") : "";
    var teslimatAdr = kayit.teslimatAdresi ? (kayit.teslimatAdresi.adres || "") : "";
    var tumYetkililer = (musteri && musteri.iletisimler) || [];
    var yetkililer = kayit.gorunecekYetkililer
      ? tumYetkililer.filter(function(k){ return kayit.gorunecekYetkililer.indexOf(k.isim) !== -1; })
      : tumYetkililer;
    // Cari'deki tek "ŞEHİR" alanı SADECE fatura adresine eklenir — teslimat
    // çoğu zaman bambaşka bir ilçe/ildedir, ona hiç eklenmez (29.09.2026).
    var sehir = (musteri && musteri.sehir) || "";
    // TEK CARİ KUTUSU (14.10.2026, Abdullah'ın isteğiyle — "cari ve ürün
    // tablosu tek yerden yönetilebilse"): bu kutu eskiden burada kendi
    // ayrı/eski ".belge-adres-blok" kodunu üretiyordu — artık Gönder ve
    // Cari Kart ile BİREBİR AYNI, tek paylaşılan fonksiyon
    // (HareketTablo.cariKutulariHtml) çağrılıyor. HANGİ yetkili(ler)in
    // gösterileceği mantığı (kayit.gorunecekYetkililer filtresi, yukarıda)
    // DEĞİŞMEDİ — bu sayfanın kendi işleyişi; sadece görsel üretim ortak.
    // KOD/TARİH ŞERİDİ KALDIRILDI (18.10.2026, Abdullah onayı — "tek kutu"
    // tasarımı): cari kart ile ürün tablosu arasındaki ayrı ".belge-belge-
    // baslik-serit--mavi" şeridi artık YOK — içeriği (tarih + kısaltılmış
    // işlem kodu) üstteki başlık kutusuna (.belge-musteri-baslik) taşındı,
    // ikinci (küçük) bir alt satır olarak (.bmb-alt). Kısaltma gerçek
    // KOD_ONEK_BELGE ile birebir (FT/SP/PF/NM), sıra no kod içinden
    // (ilk 3 haneli rakam grubu) ayıklanıyor — örn. "FT001   18.10.2026
    // 05:22" -> "FT.001".
    var baslikOneki = KOD_ONEK_BELGE[kayit.tip] || kodOnekiAyiklaBelge(kayit.kod) || "";
    var siraEslesme = (kayit.kod || "").match(/(\d{3})/);
    var baslikKisaKod = (baslikOneki && siraEslesme) ? (baslikOneki + "." + siraEslesme[1]) : (kayit.kod || "");
    // TEK TASARIM — KESİN KURAL (19.10.2026, Abdullah onayı — "amina koyayım"
    // turu): tarih ve kısa kod artık AYRI span (bmb-alt/bmb-kod) — Gönder/
    // Mail (.belge-form-baslik-tarih/kod) ve Sepet ile BİREBİR aynı yapı.
    var bmbAltMetin = htmlEsc(kayit.tarih || "") + (kayit.revizeZamani ? " · 🔄 REVİZE" : "");
    var bmbKodMetin = baslikKisaKod ? htmlEsc(baslikKisaKod) : "";
    // WEICON ROZETİ KALDIRILDI (19.10.2026, Abdullah onayı): Gönder/Mail
    // başlığından zaten "7 fotoğraf" turunda kaldırılmıştı — bu sayfa
    // (Belge Önizleme) tek kalan yerdi, artık o da kaldırıldı. Boşalan
    // alan bmb-sol'a kaldı (tarih/kod artık daha rahat yer buluyor).
    // SIRA DEĞİŞİKLİĞİ (28.10.2026, Abdullah onayı — mockup üzerinden
    // onaylandı): işlem/kod paneli (aşağıda) artık müşteri cari bilgisinin
    // ÜSTÜNDE DEĞİL — Gönder/Mail'in (send-render.js, 26.10.2026 onaylı)
    // BİREBİR aynı sırası: cari kutusu üstte, işlem/kod paneli ürün
    // tablosunun hemen üstünde, kendi ayrı kartında. "musteriBlokHtml"
    // artık SADECE cari kutusunu taşıyor; işlem/kod paneli ayrı bir
    // değişkende (siparisPaneliHtml, aşağıda html birleştirmesinde kullanılır).
    // EKLENDİ (01.11.2026, Abdullah onayı — mockup-panel.html Varyant A,
    // mockup.html birleşik üst bar turu): panelin sağına Ayrıntı ("i") +
    // Gönder (paylaş, şimdilik pasif — işlevi henüz tanımlanmadı) ikon
    // grubu eklendi; eski alt buton satırındaki "AYRINTI" tuşu kaldırıldı,
    // id="btnIslemlerAc" buraya taşındı (bağlama artık denemeCiz() içinde,
    // yukarıda — bu element her çizimde burada yeniden oluşuyor).
    // KALDIRILDI (02.11.2026, Abdullah onayı): buradaki pasif Gönder ikonu
    // (class='ub-gonder-ikon') silindi — işlevi hiç tanımlanmamıştı.
    var ikonGrupHtml = "<span class='ikon-grup'>"
      + "<button type='button' class='ub-ayrinti-ikon' id='btnIslemlerAc' title='Ayrıntı' aria-label='Ayrıntı'>"
      // AYRINTI HAPI (08.11.2026, Abdullah onayı): eski "i" yerine liste ikonu + AYRINTI yazısı + ">" (renk/köşe: belge-onizleme-style-v2.css sonundaki İŞLEM PANELİ bloğu).
      + "<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' aria-hidden='true'><circle cx='5' cy='6' r='1.2' fill='currentColor'/><circle cx='5' cy='12' r='1.2' fill='currentColor'/><circle cx='5' cy='18' r='1.2' fill='currentColor'/><path d='M10 6h10M10 12h10M10 18h7'/></svg>"
      + "<span>AYRINTI</span>"
      + "<svg class='ay-ok' width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M9 5l7 7-7 7'/></svg>"
      + "</button>"
      + "</span>";
    // WEICON kurumsal belge üstlüğü: yalnızca görünüm düzeni, kayıt alanları değişmez.
    var tarihKaydi = String(kayit.tarih || "").trim();
    var tarihMatch = tarihKaydi.match(/^(\d{1,2})[.\s\/-]+([A-Za-zÇĞİÖŞÜçğıöşü]+|\d{1,2})[.\s\/-]+(\d{4})(?:[ T]+(\d{1,2}:\d{2}))?/);
    var ayAdlari = { "1":"Ocak","2":"Şubat","3":"Mart","4":"Nisan","5":"Mayıs","6":"Haziran","7":"Temmuz","8":"Ağustos","9":"Eylül","10":"Ekim","11":"Kasım","12":"Aralık",
      "oca":"Ocak","şub":"Şubat","mar":"Mart","nis":"Nisan","may":"Mayıs","haz":"Haziran","tem":"Temmuz","ağu":"Ağustos","eyl":"Eylül","eki":"Ekim","kas":"Kasım","ara":"Aralık" };
    var tarihGosterim = tarihKaydi, saatGosterim = "";
    if(tarihMatch){
      var ayAnahtar = String(tarihMatch[2]).toLocaleLowerCase("tr-TR").replace(/\.$/,"");
      tarihGosterim = parseInt(tarihMatch[1],10) + " " + (ayAdlari[ayAnahtar] || tarihMatch[2]) + " " + tarihMatch[3];
      saatGosterim = tarihMatch[4] || "";
    }else{
      var saatEslesme = tarihKaydi.match(/(?:^|\s)(\d{1,2}:\d{2})$/);
      if(saatEslesme){ saatGosterim = saatEslesme[1]; tarihGosterim = tarihKaydi.slice(0, saatEslesme.index).trim(); }
    }
    var belgeBaslikMetni = (TipEtiket && TipEtiket.buyukAl) ? TipEtiket.buyukAl(kayit.tip) : (TIP_ETIKET_BELGE[kayit.tip] || "BELGE");
    var siparisPaneliHtml = "<section class='weicon-belge-ustluk'>"
      + "<div class='weicon-belge-marka-satir'>"
      + "<svg class='weicon-logo-filtre-tanim' width='0' height='0' aria-hidden='true' focusable='false'><filter id='weiconLogoColorSwap' color-interpolation-filters='sRGB'><feColorMatrix type='matrix' values='-1 0 0 0 1 0 -1 0 0 1.4 0 0 -1 0 1.8 0 0 0 1 0'/></filter></svg>"
      + "<span class='weicon-logo-kutu'><img class='weicon-belge-logo' src='weicon-logo-temiz.png' alt='WEICON'><sup>®</sup></span>"
      + "<span class='weicon-belge-dikey-ayrac' aria-hidden='true'></span>"
      + "<h1 class='weicon-belge-tur'>" + htmlEsc(belgeBaslikMetni) + "</h1>"
      + ikonGrupHtml
      + "</div>"
      + "<div class='weicon-belge-tarih-serit'>"
      + "<span class='weicon-tarih-ikon' aria-hidden='true'><svg viewBox='0 0 24 24'><rect x='3' y='5' width='18' height='16' rx='2'/><path d='M16 3v4M8 3v4M3 10h18M8 15l2.5 2.5L16 12'/></svg></span>"
      + "<strong>Tarih: " + htmlEsc(tarihGosterim || "-") + "</strong>"
      + (saatGosterim ? "<span class='weicon-saat-ikon' aria-hidden='true'><svg viewBox='0 0 24 24'><circle cx='12' cy='12' r='9'/><path d='M12 7v5l3 2'/></svg></span><strong class='weicon-saat-deger'>" + htmlEsc(saatGosterim) + "</strong>" : "")
      + (kayit.revizeZamani ? "<span class='weicon-revize-rozet'>REVİZE</span>" : "")
      + "</div>"
      + "</section>";
    // ÖDEME GÜNÜ (10.11.2026, Abdullah onayı): tek satırlık panel, VADE/FATURA/KARGO'nun
    // altında. SADECE bu sayfada (program içi bilgi) — Gönder/Mail/WhatsApp'a girmez
    // (HareketTablo.cariKutulariHtml'e 11. parametre olarak yalnız burası geçirir).
    // Hesap tüm listelerle AYNI tek kaynaktan: VadeTakip.odemeBilgisiFn (sipariş + sayısal vade).
    var odemeGunuPaneliHtml = "";
    try{
      if(typeof VadeTakip !== "undefined" && typeof OdemeVadeUI !== "undefined"){
        var odemeOge = VadeTakip.odemeBilgisiFn()(kayit);
        if(odemeOge){
          var kalan = OdemeVadeUI.kalanMetni(odemeOge);
          // Geciken (ödenmemiş, günü geçmiş) fatura sayısı — müşterinin TÜM faturaları, tek kaynak: VadeTakip.gecikmisSayisi.
          // "vadeTakip" izni yoksa gösterilmez (eski Cari VADE rozetiyle aynı kural).
          var gecikmisAdet = (typeof window.izinVarMi !== "function" || window.izinVarMi("vadeTakip"))
            ? VadeTakip.gecikmisSayisi((musteri && musteri.id) || kayit.musteriId || null, kayit.musteri) : 0;
          odemeGunuPaneliHtml = "<div class='ozet-satir-3 ozet-satir-3--birlesik bo-odeme-gunu'><div class='ozet-alan'>"
            + "<span class='ozet-ikon'>" + (typeof IkonSvg !== "undefined" ? IkonSvg.svg("vade") : "📅") + "</span>"
            + "<div class='ozet-metin'><div class='ozet-baslik'>ÖDEME GÜNÜ</div><div class='ozet-deger'>" + OdemeVadeUI.tarihUzun(odemeOge.vadeTs) + "</div></div>"
            + "<span class='bo-og-kalan bo-og-kalan--" + kalan.sinif + "'>" + kalan.yazi + "</span>"
            + (gecikmisAdet ? "<span class='ov-rozet bo-og-rozet' title='Geciken fatura'>" + gecikmisAdet + "</span>" : "")
            + "</div></div>";
        }
      }
    }catch(e){ odemeGunuPaneliHtml = ""; }
    var musteriBlokHtml = "<div class='weicon-cari-baslik'><span class='weicon-cari-baslik-ikon' aria-hidden='true'><svg viewBox='0 0 24 24'><path d='M3 21V8l9-5 9 5v13M7 21v-7h10v7M8 9h2M14 9h2M8 12h2M14 12h2'/></svg></span><strong>MÜŞTERİ BİLGİLERİ</strong></div><div class='belge-musteri-govde'>";
      // Geçmiş gösterimi artık SADECE #belgeGecmisiKutu'da (alttaki
      // "📜 Belge Geçmişi" kutusu) — buradaki süreç şeridi kaldırıldı,
      // aynı bilgiyi ikinci kez basıyordu (19.10.2026, Abdullah onayı).
      // ŞİRKET TELEFONU/E-POSTASI (19.10.2026, Abdullah onayı — "7 fotoğraf"
      // turu): cariKutulariHtml artık musteri.telefon/eposta varsa Fatura
      // Adresi'nin altında gösteriyor — bu sayfa kendi sentetik {ad, sehir}
      // objesini geçtiği için bu iki alan da elle eklendi.
      // NOT ALANI (19.10.2026, Abdullah onayı — "cari kart çerçeve" turu):
      // aynı sentetik obje mantığıyla, Cari Kart'taki not da notlar/not
      // alanlarıyla buraya elle taşındı — artık Belge Önizleme'de de görünür.
      // TESLİMAT ADRESİ BOŞSA GİZLE (28.10.2026, Abdullah onayı — "her
      // yerde" turu, mockup üzerinden onaylandı): son parametre (true)
      // teslimat adresi girilmemişse bu bloğu HİÇ göstermez — cari kodu
      // (koduGizle=false) ESKİSİ GİBİ görünmeye devam eder, SADECE bu
      // değişti.
      // HATA DÜZELTME (28.10.2026, Abdullah bildirdi — "müşteri kodlarını
      // neden göremiyorum"): bu sentetik {ad, sehir, ...} nesnesinde "id"
      // alanı hiç yoktu — MusteriSeridi.html() müşteri kodunu SADECE
      // musteri.id doluysa basıyor (musteri-serit.js), koduGizle=false
      // olmasına rağmen kod bu yüzden hiç görünmüyordu. Artık gerçek
      // müşteri kaydındaki id (musteri.id) buraya da geçiriliyor.
      + HareketTablo.cariKutulariHtml({id: (musteri&&musteri.id)||"", ad: kayit.musteri, sehir: sehir, telefon: (musteri&&musteri.telefon)||"", eposta: (musteri&&musteri.eposta)||"", notlar: (musteri&&musteri.notlar)||[], not: (musteri&&musteri.not)||""}, vade, faturaTuru, kargo, faturaAdr, teslimatAdr, yetkililer, false, true, false, odemeGunuPaneliHtml)
      + "</div>";

    // BAKİYE ÜRÜN BLOĞU — sadece bakiyede kalan ürün varsa gösterilir. Ana
    // tabloyla AYNI sütun genişlikleri colgroup ile sabitleniyor (kendi thead'i
    // YOK — görsel olarak ana tablonun başlığını "paylaşıyor" gibi duruyor).
    var bakiyeBlokHtml = bakiyeUrunler.length ? (
      "<div class='belge-bakiye-disblok'>"
      + "<div class='belge-bakiye-kucuk-etiket'>📦 BAKİYE ÜRÜN</div>"
      + "<div class='belge-bakiye-blok'>"
      + "<div class='data-table-container'><table class='belge-urun-tablo'>"
      + "<colgroup><col style='width:3.6%;'><col style='width:29.2%;'><col style='width:10%;'><col style='width:10%;'><col style='width:10%;'><col style='width:13%;'><col style='width:13%;'><col style='width:11.2%;'></colgroup>"
      + "<tbody>" + bakiyeSatirlarHtml + "</tbody>"
      + "</table></div>"
      + "<div class='belge-bakiye-toplam-serit'>"
      + "<span class='belge-bakiye-toplam-etiket'>📦 BAKİYE ÜRÜN TOPLAMI</span>"
      + "<span class='belge-bakiye-toplam-deger'>" + fmt(bakiyeToplamEuro) + " EURO</span>"
      + "</div>"
      + "</div>"
      + "</div>"
    ) : "";

    // BEKLEYEN BİLGİ ŞERİDİ (08.11.2026, Abdullah onayı): termin tarihi, "teklif/
    // proforma verildi" izi ve geldi / çıkarıldı geçmişi — sadece bilgi varsa çıkar.
    var bekleyenBilgiHtml = (function(){
      function tarihGoster(t){
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t||"");
        return m ? (m[3]+"."+m[2]+"."+m[1]) : (t||"");
      }
      function terminGectiMi(t){
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t||"");
        if(!m) return false;
        var g = new Date(); g.setHours(0,0,0,0);
        return new Date(+m[1], +m[2]-1, +m[3]).getTime() < g.getTime();
      }
      var satirlar = [];
      if(kayit.durum === "beklemede" && kayit.terminTarihi){
        satirlar.push("<div class='bb-satir" + (terminGectiMi(kayit.terminTarihi) ? " bb-satir--uyari" : "") + "'>📅 Beklenen termin: <b>" + htmlEsc(tarihGoster(kayit.terminTarihi)) + "</b>" + (terminGectiMi(kayit.terminTarihi) ? " — tarihi geçti, ürün gelmiş olabilir" : "") + "</div>");
      }
      (kayit.urunler||[]).forEach(function(u){
        if((u.bakiyeAdet||0) > 0 && u.bakiyeTermin){
          satirlar.push("<div class='bb-satir" + (terminGectiMi(u.bakiyeTermin) ? " bb-satir--uyari" : "") + "'>📅 " + htmlEsc(u.ad||"") + " — bakiye termini: <b>" + htmlEsc(tarihGoster(u.bakiyeTermin)) + "</b>" + (terminGectiMi(u.bakiyeTermin) ? " — tarihi geçti" : "") + "</div>");
        }
      });
      if(kayit.bekleyenIlerleme){
        var bi = kayit.bekleyenIlerleme;
        satirlar.push("<div class='bb-satir'>📄 " + htmlEsc(TIP_ETIKET_BELGE[bi.tip] || bi.tip || "Belge") + " verildi" + (bi.kod ? " — " + htmlEsc(bi.kod) : "") + (bi.tarih ? " · " + htmlEsc(bi.tarih) : "") + "</div>");
      }
      var gecmis = kayit.bekleyenGecmisi ? (Array.isArray(kayit.bekleyenGecmisi) ? kayit.bekleyenGecmisi : Object.values(kayit.bekleyenGecmisi)) : [];
      gecmis.forEach(function(g){
        if(g.olay === "geldi") satirlar.push("<div class='bb-satir bb-satir--tamam'>✓ " + (g.adet||0) + " adet " + htmlEsc(g.ad||"") + " geldi → " + htmlEsc(g.yeniKod||"sipariş") + " · " + htmlEsc(g.tarih||"") + "</div>");
        else if(g.olay === "cikarildi") satirlar.push("<div class='bb-satir'>⏏️ " + (g.adet||0) + " adet " + htmlEsc(g.ad||"") + " bekleyenden çıkarıldı · " + htmlEsc(g.tarih||"") + "</div>");
        else if(g.olay === "kacan") satirlar.push("<div class='bb-satir'>❌ Bekleyenden çıkarıldı — kaçan satış · " + htmlEsc(g.tarih||"") + "</div>");
        else if(g.olay === "isaret-kaldirildi") satirlar.push("<div class='bb-satir'>✅ Stok bekliyor işareti kaldırıldı · " + htmlEsc(g.tarih||"") + "</div>");
      });
      return satirlar.length ? "<div class='belge-bekleyen-bilgi'>" + satirlar.join("") + "</div>" : "";
    })();

    // DÜZELTME (12.10.2026, Abdullah onayı): "tip-" + kayit.tip sınıfı
    // eklendi — belge-onizleme-style-v2.css bu sınıfla işlem türünün
    // rengini (sadece üst şeritteki tür adına ve isim noktasına) uyguluyor.
    // "7. BELGE" TASARIMI (14.10.2026) + KOD/TARİH ŞERİDİ KALDIRILDI
    // (18.10.2026, Abdullah onayı): tür/kod/tarih artık ayrı bir şeritte
    // DEĞİL, üstteki musteriBlokHtml'in başlığında (bkz. yukarıda bmb-alt).
    // Ürün tablosu kartı artık cari karttan hemen sonra geliyor, kendi
    // tam yuvarlak köşesi VE çerçevesi var ("belge-kart--urun-cerceveli" —
    // Gönder'in giden görseliyle BİREBİR aynı çerçeve dili, 18.10.2026).
    // GENEL TOPLAM ve PRİM iki AYRI, bağımsız, tam yuvarlak köşeli kutu.
    var html = siparisPaneliHtml
      + "<div class='belge-kart belge-kart--cari-ust weicon-cari-kart tip-" + (kayit.tip||"siparis") + (sorunluMu?" belge-kutu--sorunlu":"") + "'>"
      + durumRozetHtml
      + musteriBlokHtml
      + "</div>"
      // "belge-kart--siparis-paneli" sınıfı (28.10.2026, Abdullah onayı —
      // "daralt" turu) SADECE bu kartı, diğer tüm .belge-kart çiftlerine
      // (paylaşılan margin-bottom:1mm kuralına) dokunmadan, scoped olarak
      // hedefleyebilmek için eklendi — bkz. belge-onizleme-style-v2.css.
      + "<div class='belge-kart belge-kart--urun-cerceveli'>"
      + satirlarHtml
      + bakiyeBlokHtml
      + bekleyenBilgiHtml
      + "</div>"
      // GENEL TOPLAM + PRİM (02.11.2026, Abdullah onayı — mockup üzerinden):
      // artık TEK ortak fonksiyon (HareketTablo.genelToplamHtml, hareket-
      // tablo.js) — Sepet/Cari Kart ile aynı kutu; PRİM ayrı yeşil şerit
      // değil, kutunun içinde. Prim tutarı/"Prim yok" mantığı DEĞİŞMEDİ.
      + "<div class='weicon-toplam-sarmal'><span class='weicon-toplam-ikon' aria-hidden='true'><svg viewBox='0 0 48 48'><ellipse cx='15' cy='12' rx='9' ry='4'/><path d='M6 12v7c0 2.2 4 4 9 4s9-1.8 9-4v-7M6 19v7c0 2.2 4 4 9 4 2 0 4-.4 5.8-1.1'/><ellipse cx='34' cy='25' rx='9' ry='4'/><path d='M25 25v7c0 2.2 4 4 9 4s9-1.8 9-4v-7M25 32v7c0 2.2 4 4 9 4s9-1.8 9-4v-7'/></svg></span>"
      + HareketTablo.genelToplamHtml({
          genelToplam: netEuro,
          kur: kayit.kur,
          kurManuelMi: !!kayit.kurManuel,
          primTl: toplamPrim<0 ? null : toplamPrimTl,
          primMetni: toplamPrim<0 ? "Prim yok" : ""
        })
      + "</div>";

    document.getElementById("belgeIcerik").innerHTML = html;
    var beklemedeRozetBtn = document.getElementById("beklemedeRozetBtn");
    if(beklemedeRozetBtn){
      beklemedeRozetBtn.onclick = function(){ beklemedeNotAc(kayit); };
    }
    // MÜŞTERİ HIZLI PENCERESİ (27.10.2026) — şerit her çizimde yeniden
    // oluştuğu için dinleyici de her seferinde yeniden bağlanıyor.
    var seritEl = document.querySelector("#belgeIcerik .musteri-serit");
    if(seritEl && musteri){
      seritEl.style.cursor = "pointer";
      seritEl.onclick = function(ev){
        // ms-gecmis-btn gibi şeridin kendi iç butonlarına basıldıysa
        // (bu sayfada şu an yok ama ileride eklenirse) pop-up'ı tetikleme.
        if(ev.target.closest(".ms-gecmis-btn")) return;
        try{ CustomerData.sec(musteri); CustomerData.sonGoruntulendi(musteri.ad); }catch(e){}
        bhpAc(musteri, seritEl);
      };
      // DÜZENLE HAPI (09.11.2026, Abdullah isteği): müşteri isminin yanında
      // (şeridin sağında) — dokununca Cari Kart açılır ve "Cari Bilgileri
      // Düzenle" formu hemen açık gelir (bayrak: weiconv2_cari_duzenle_ac,
      // cari-kart-render.js okuyup siler). Hızlı pencere (isme dokunma)
      // AYNEN duruyor; hap ona dokundurmaz. Tasarım: Cari Bilgi'deki hap.
      var duzenleHapi = document.createElement("button");
      duzenleHapi.type = "button";
      duzenleHapi.className = "bo-duzenle-hap";
      duzenleHapi.setAttribute("aria-label", "Cari bilgileri düzenle");
      duzenleHapi.innerHTML = "<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z'/><path d='M14 7l3 3'/></svg><span>DÜZENLE</span><svg class='ay-ok' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M9 5l7 7-7 7'/></svg>";
      duzenleHapi.onclick = function(ev){
        ev.stopPropagation();
        try{ CustomerData.sec(musteri); CustomerData.sonGoruntulendi(musteri.ad); }catch(e){}
        try{ localStorage.setItem("weiconv2_cari_duzenle_ac", "1"); }catch(e){}
        window.location.href = "customer-cari-kart.html";
      };
      seritEl.classList.add("musteri-serit--duzenle-hapli");
      seritEl.appendChild(duzenleHapi);
    }
  }catch(e){ hataGoster("Belge çizilemedi: " + e.message); }
}

// ============================================================
// BELGE HIZLI PENCERE (27.10.2026, Abdullah onayı — mockup üzerinden
// onaylandı) — customer.html'deki hızlı pencere (cm-altmenu) ile BİREBİR
// aynı görünüm, tamamen yerel/bağımsız bir kopya (musteri-serit.js/css ve
// customer-render.js'e DOKUNULMADI). CSS'i belge-onizleme-style-v2.css'te
// ".belge-onizleme-sayfa .belge-hizli-pencere*" altında, scoped.
// ============================================================
var bhpAcikMusteri = null;

function bhpAyniMusteriKaydiMi(kayitMusteriAdi, kayitMusteriId, seciliAd, seciliId){
  if(seciliId && kayitMusteriId) return kayitMusteriId === seciliId;
  var a = (kayitMusteriAdi||"").toLocaleLowerCase("tr-TR").trim();
  var b = (seciliAd||"").toLocaleLowerCase("tr-TR").trim();
  if(!a || !b) return false;
  if(a === b) return true;
  return a.indexOf(b) === 0 || b.indexOf(a) === 0;
}

// customer-render.js'teki cmRozetSayilariniHesapla ile AYNI hesap —
// VadeTakip bu sayfada yüklü değil, bu yüzden "fatura" her zaman 0 kalır.
function bhpRozetSayilariniHesapla(m){
  var sonuc = {temas:0, gecmis:0, fatura:0, urun:0, bekleyen:0};
  try{ sonuc.temas = (m.ziyaretGecmisi||[]).length; }catch(e){}
  try{
    if(typeof ReportsData !== "undefined"){
      var tumu = ReportsData.sonIslemler();
      sonuc.gecmis = tumu.filter(function(k){ return bhpAyniMusteriKaydiMi(k.musteri, k.musteriId, m.ad, m.id); }).length;
    }
  }catch(e){}
  try{
    if(typeof VadeTakip !== "undefined"){
      var ogeler = VadeTakip.musteriIcin(m.id, m.ad);
      // 10.11.2026: rozet = VADESİ GEÇEN (ödenmemiş) fatura sayısı
      if(typeof window.izinVarMi !== "function" || window.izinVarMi("vadeTakip")){
        sonuc.fatura = ogeler.filter(function(o){ return o.durum === "gecti" && !o.odendi; }).length;
      }
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
        return bhpAyniMusteriKaydiMi(s.musteri, s.musteriId, m.ad, m.id);
      }).length;
      // + bu müşterinin "Stok Bekliyor" siparişleri (05.11.2026) — sayfa ikisini birlikte gösteriyor.
      if(ReportsData.stokBekleyenSiparisler){
        sonuc.bekleyen += ReportsData.stokBekleyenSiparisler().filter(function(s){
          return bhpAyniMusteriKaydiMi(s.musteri, s.musteriId, m.ad, m.id);
        }).length;
      }
    }
  }catch(e){}
  return sonuc;
}

function bhpRozetHTML(sayi){
  return sayi > 0 ? "<span class='cm-altmenu-rozet'>" + sayi + "</span>" : "";
}

// Panel ve tip-seçim yan penceresi tek sefer oluşturulur (belgeyiCiz her
// yeniden çizimde #belgeIcerik'i SIFIRLIYOR, bu yüzden bunlar #belgeIcerik
// DIŞINDA, document.body'ye ekleniyor — yeniden çizimden etkilenmesinler).
// acik-belge-kontrol.js diğer lazy-load modüllerle AYNI desenle, SADECE
// gerçekten gerektiğinde (SİPARİŞ seçilip açık belge varken) yükleniyor —
// bkz. acik-belge-kontrol.js üstündeki not.

// "İŞLEM YAP" YENİ ROTA (08.11.2026, Abdullah onayı): İşlem Yap'a dokununca eski yan tip
// paneli yerine cari kart POPUP'ı açılır (fatura/teslimat/yetkili seçimi + İŞLEM SEÇ) —
// bkz. islem-popup.js. Modül gerektiğinde yüklenir; yüklenemezse eski yan panel açılır.
function bhpIslemPopupAc(musteri, devam, yedek){
  var kart = document.getElementById("bhpPencere");
  if(typeof IslemPopup !== "undefined"){ IslemPopup.ac(musteri, devam, {kart: kart}); return; }
  var s = document.createElement("script");
  s.src = "islem-popup.js?v=TKP.13.11.26-00:15.1587";
  s.onload = function(){ IslemPopup.ac(musteri, devam, {kart: kart}); };
  s.onerror = function(){ if(typeof yedek === "function") yedek(); };
  document.body.appendChild(s);
}

var bhpAbkModulYukleniyor = false;
var bhpAbkModulBekleyenler = [];
function bhpAcikBelgeKontrolIleDevamEt(musteri, tip){
  if(typeof AcikBelgeKontrol !== "undefined"){ AcikBelgeKontrol.tipSeciminiBaslat(musteri, tip); return; }
  bhpAbkModulBekleyenler.push(function(){ AcikBelgeKontrol.tipSeciminiBaslat(musteri, tip); });
  if(bhpAbkModulYukleniyor) return;
  bhpAbkModulYukleniyor = true;
  var s = document.createElement("script");
  s.src = "acik-belge-kontrol.js?v=TKP.05.11.26-12:12.1483";
  s.onload = function(){
    bhpAbkModulYukleniyor = false;
    bhpAbkModulBekleyenler.forEach(function(fn){ fn(); });
    bhpAbkModulBekleyenler = [];
  };
  s.onerror = function(){
    bhpAbkModulYukleniyor = false;
    bhpAbkModulBekleyenler = [];
    if(typeof hataGoster === "function") hataGoster("İşlem modülü yüklenemedi.");
  };
  document.body.appendChild(s);
}

function bhpPencereOlustur(){
  if(document.getElementById("bhpPencere")) return;
  var panel = document.createElement("div");
  panel.className = "belge-hizli-pencere";
  panel.id = "bhpPencere";
  panel.hidden = true;
  panel.innerHTML = "<div class='cm-altmenu-musteri-baslik' id='bhpBaslik'></div><div id='bhpListe'></div>";
  document.body.appendChild(panel);

  var tipMenu = document.createElement("div");
  tipMenu.className = "belge-hizli-pencere-tipmenu";
  tipMenu.id = "bhpTipMenu";
  tipMenu.hidden = true;
  tipMenu.innerHTML = "<div class='cm-tipmenu-baslik'>Ne için ürün arıyorsun?</div>"
    + "<button type='button' class='cm-tipmenu-oge cm-tipmenu-oge--numune' data-tip='numune'><span class='cm-tipmenu-oge-ikon'>🧪</span><span data-tip-tam='numune'>"+TipEtiket.buyukAl('numune')+"</span></button>"
    + "<button type='button' class='cm-tipmenu-oge cm-tipmenu-oge--teklif' data-tip='teklif'><span class='cm-tipmenu-oge-ikon'>💬</span><span data-tip-tam='teklif'>"+TipEtiket.buyukAl('teklif')+"</span></button>"
    + "<button type='button' class='cm-tipmenu-oge cm-tipmenu-oge--proforma' data-tip='proforma'><span class='cm-tipmenu-oge-ikon'>🧾</span><span data-tip-tam='proforma'>"+TipEtiket.buyukAl('proforma')+"</span></button>"
    + "<button type='button' class='cm-tipmenu-oge cm-tipmenu-oge--siparis' data-tip='siparis'><span class='cm-tipmenu-oge-ikon'>📦</span><span data-tip-tam='siparis'>"+TipEtiket.buyukAl('siparis')+"</span></button>";
  document.body.appendChild(tipMenu);

  // ROTA DEĞİŞİKLİĞİ (27.10.2026, Abdullah onayı): tip seçilince artık
  // Cari Kart'a UĞRAMADAN direkt cart.html'e gidiliyor — bkz.
  // acik-belge-kontrol.js (açık belge kontrolü dahil, TEK paylaşılan
  // modülden; aynı değişiklik menu-cekmece.js ve customer-render.js'teki
  // eşdeğer tip menülerine de uygulandı).
  tipMenu.querySelectorAll(".cm-tipmenu-oge").forEach(function(btn){
    btn.onclick = function(){
      if(!bhpAcikMusteri) return;
      var tip = this.getAttribute("data-tip");
      bhpAcikBelgeKontrolIleDevamEt(bhpAcikMusteri, tip);
    };
  });

  document.addEventListener("click", function(ev){
    if(ev.target.closest("#bhpPencere") || ev.target.closest("#bhpTipMenu") || ev.target.closest(".musteri-serit")) return;
    bhpKapat();
  });
  window.addEventListener("resize", function(){
    var p = document.getElementById("bhpPencere");
    if(p && !p.hidden && bhpSonAnkorEl) bhpKonumla(bhpSonAnkorEl, p);
    var tm = document.getElementById("bhpTipMenu");
    if(tm && !tm.hidden) bhpTipMenuKonumla();
  });
}

// KONUMLANDIRMA DEĞİŞİKLİĞİ (01.11.2026, Abdullah onayı — mockup üzerinden,
// ekran görüntüsüyle bildirilen hata): eskiden tetikleyici elemanın
// (müşteri şeridi) SOL kenarına hizalıydı ve ekranın altına taşarsa YUKARI
// ÇEVRİLİYORDU — 8 satırlı bu menüde bu, kısa ekranlarda pencerenin
// müşteri şeridinin ÜSTÜNE binmesine yol açıyordu (kök neden: panel
// yüksekliği + şeridin altındaki boşluk ekrana sığmayınca eski kod
// pencereyi yukarı itiyordu). Artık:
// 1) Yatayda her zaman EKRANA ortalanıyor (tetikleyicinin konumundan
//    bağımsız) — menu-cekmece.js mcMiniSonucKonumla'daki taşma-kenar
//    formülünden FARKLI, kasıtlı yeni davranış, SADECE bu pencere için.
// 2) Dikeyde ASLA yukarı çevrilmiyor — her zaman müşteri şeridinin hemen
//    altından başlıyor; ekrana sığmazsa pencerenin kendisi kısalıp
//    kaydırılabilir oluyor (bkz. CSS: max-height burada JS'ten verilir,
//    overflow-y:auto .belge-hizli-pencere kuralında, belge-onizleme-
//    style-v2.css).
//
// İKİNCİ DÜZELTME (01.11.2026, Abdullah'ın canlı siteden bildirdiği hata —
// ekran görüntüsü: pencere hâlâ müşteri şeridinin üstüne biniyor VE kendi
// başlığındaki müşteri ismi okunmuyordu): KÖK NEDEN farklıydı — yukarıdaki
// yatay/dikey mantığı DOĞRU çalışıyordu, ama tetikleyici eleman (müşteri
// şeridi) pencere AÇIKKEN başka bir nedenle (örn. CustomerData/ReportsData
// canlı veri dinleyicisi `denemeCiz`'i tekrar çağırıp #belgeIcerik'i
// yeniden çizdiğinde) DOM'dan kopup yerini TAZE bir şeride bırakabiliyor.
// Pencere açıkken mobilde SIK görülen bir "resize" olayı (adres çubuğu/
// araç çubuğu ayarlanması gibi) geldiğinde, aşağıdaki `window resize`
// dinleyicisi `bhpKonumla`'yı bu KOPUK (artık ekranda yeri olmayan)
// eleman ile tekrar çağırıyordu — kopuk bir elemanın ölçümü (rect) HER
// ZAMAN sıfır döner, bu da pencereyi "ust=8" sınırına, yani ekranın en
// üstüne zıplatıyordu. Bu hem müşteri şeridinin üstüne binmesine (şerit
// kendi gerçek konumunda kalırken pencere en üste atlıyor) HEM DE
// pencerenin KENDİ başlığının (.cm-altmenu-musteri-baslik — kod+ad+şehir)
// üstteki sabit menü şeridinin (.app-ust-sabit, z-index:1000) ALTINDA
// kalıp görünmez olmasına yol açıyordu (bu pencere z-index:500'dü — bkz.
// belge-onizleme-style-v2.css, orada da düzeltildi). Artık:
// 3) Her konumlandırmada ankor eleman GEÇERLİ Mİ (hâlâ belgede/DOM'da bağlı
//    mı, ölçümü sıfır değil mi) kontrol ediliyor; kopuksa GÜNCEL müşteri
//    şeridi DOM'dan yeniden aranıp onunla devam ediliyor; o da yoksa
//    (örn. belge artık ekranda değilse) pencere konumsuz bırakılmıyor,
//    doğrudan KAPATILIYOR.
// 4) Üst sınır artık sabit "8px" değil — üstteki sabit menü şeridi
//    (.app-ust-sabit) varsa onun ALT kenarı + 6px: pencere hiçbir zaman o
//    şeridin altında/arkasında kalmıyor.
var bhpSonAnkorEl = null;

function bhpAnkorGecerliMi(el){
  if(!el || !el.isConnected) return false;
  var r = el.getBoundingClientRect();
  return !(r.top === 0 && r.bottom === 0 && r.left === 0 && r.right === 0);
}

function bhpKonumla(ankorEl, panel){
  if(!bhpAnkorGecerliMi(ankorEl)){
    var guncelSerit = document.querySelector("#belgeIcerik .musteri-serit");
    if(bhpAnkorGecerliMi(guncelSerit)){
      ankorEl = guncelSerit;
      bhpSonAnkorEl = guncelSerit;
    } else {
      bhpKapat();
      return;
    }
  }
  var rect = ankorEl.getBoundingClientRect();
  var panelGenislik = panel.offsetWidth;
  var sol = (window.innerWidth - panelGenislik) / 2;
  if(sol < 8) sol = 8;
  if(sol + panelGenislik > window.innerWidth - 8){ sol = window.innerWidth - panelGenislik - 8; }
  var minUst = 8;
  var ustSabit = document.querySelector(".app-ust-sabit");
  if(ustSabit){
    var usRect = ustSabit.getBoundingClientRect();
    if(usRect.bottom + 6 > minUst) minUst = usRect.bottom + 6;
  }
  var ust = rect.bottom + 6;
  if(ust < minUst) ust = minUst;
  var kalanYukseklik = window.innerHeight - ust - 8;
  panel.style.maxHeight = Math.max(kalanYukseklik, 120) + "px";
  panel.style.left = sol + "px";
  panel.style.top = ust + "px";
}

function bhpTipMenuKonumla(){
  try{
    var ilk = document.getElementById("bhpPencere");
    var ikinci = document.getElementById("bhpTipMenu");
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

function bhpAksiyonuUygula(aksiyon){
  if(!bhpAcikMusteri) return;
  switch(aksiyon){
    case "cari": window.location.href = "customer-cari-kart.html"; break;
    case "temas": window.location.href = "customer-temas.html"; break;
    case "islemyap":
      var bhpIslemMusteri = bhpAcikMusteri;
      bhpIslemPopupAc(bhpIslemMusteri, function(tip){
        bhpAcikBelgeKontrolIleDevamEt(bhpIslemMusteri, tip);
      }, function(){
        document.getElementById("bhpTipMenu").hidden = false;
        bhpTipMenuKonumla();
      });
      break;
    case "fatura": window.location.href = "customer-detail.html?ac=fatura"; break;
    case "gecmis": window.location.href = "gecmis.html"; break;
    case "urun": window.location.href = "customer-detail.html?ac=urun"; break;
    case "bekleyen":
      try{ localStorage.setItem("weiconv2_bakiye_musteri_filtre", JSON.stringify({id:bhpAcikMusteri.id||null, ad:bhpAcikMusteri.ad||""})); }catch(e){}
      window.location.href = "bakiye-urunler.html";
      break;
  }
}

function bhpKapat(){
  var p = document.getElementById("bhpPencere");
  if(p) p.hidden = true;
  var tm = document.getElementById("bhpTipMenu");
  if(tm) tm.hidden = true;
  bhpAcikMusteri = null;
}

function bhpAc(musteri, ankorEl){
  try{
    bhpPencereOlustur();
    bhpAcikMusteri = musteri;
    bhpSonAnkorEl = ankorEl;
    var panel = document.getElementById("bhpPencere");
    document.getElementById("bhpTipMenu").hidden = true;
    var rozetler = bhpRozetSayilariniHesapla(musteri);

    document.getElementById("bhpBaslik").innerHTML =
      "<span><span class='ms-kod'>" + htmlEsc(musteri.id||"—") + "</span></span>"
      + "<span class='ms-ad'>" + htmlEsc(musteri.ad||"") + "</span>"
      + ((typeof CustomerData !== "undefined" && CustomerData.konumMetni ? CustomerData.konumMetni(musteri) : (musteri.sehir||"")) ? "<span class='ms-sehir'>" + htmlEsc(typeof CustomerData !== "undefined" && CustomerData.konumMetni ? CustomerData.konumMetni(musteri) : musteri.sehir) + "</span>" : "");

    var ogeler = [
      {ikon:"🏢", etiket:"Cari", aksiyon:"cari"},
      {ikon:"📍", etiket:"Temas", aksiyon:"temas", rozet:rozetler.temas},
      {ikon:"🔍", etiket:"İşlem Yap", aksiyon:"islemyap"},
      {ikon:"📄", etiket:"Fatura ve Ödeme Takip", aksiyon:"fatura", rozet:rozetler.fatura},
      {ikon:"🕐", etiket:"İşlem Geçmişi", aksiyon:"gecmis", rozet:rozetler.gecmis},
      {ikon:"📦", etiket:"Ürün Geçmişi", aksiyon:"urun", rozet:rozetler.urun},
      {ikon:"📦", etiket:"Bekleyen Ürünler", aksiyon:"bekleyen", rozet:rozetler.bekleyen}
    ];
    document.getElementById("bhpListe").innerHTML = ogeler.map(function(o){
      return "<button type='button' class='cm-altmenu-oge' data-aksiyon='" + o.aksiyon + "'>"
        + "<span class='cm-altmenu-oge-sol'><span class='cm-altmenu-oge-ikon' aria-hidden='true'>" + o.ikon + "</span><span>" + o.etiket + "</span></span>"
        + bhpRozetHTML(o.rozet||0)
        + "</button>";
    }).join("");
    document.getElementById("bhpListe").querySelectorAll(".cm-altmenu-oge").forEach(function(btn){
      btn.onclick = function(){ bhpAksiyonuUygula(this.getAttribute("data-aksiyon")); };
    });

    panel.hidden = false;
    bhpKonumla(ankorEl, panel);
  }catch(e){ hataGoster("Hızlı pencere açılamadı: " + e.message); }
}

var TIP_ETIKET_UZUN = TipEtiket.kisa; // 08.11.2026: artık kısa (tek kaynak). Belge Geçmişi satırında yanındaki rozet aynı kısaltmayı gösterdiği için ayrı etiket yazısı basılmıyor.
var TIP_IKON_BELGE = {numune:"🧪", teklif:"📝", proforma:"🧾", siparis:"📦"};
// RENK GÜNCELLEMESİ (12.10.2026, Abdullah onayı — kurumsal/yumuşatılmış
// "Seçenek B" paleti, swatch fotoğraflarından örneklenip yumuşatıldı).
var TIP_RENK_BELGE = {numune:"#c2185b", teklif:"#249147", proforma:"#e8690a", siparis:"#38469a"};
// Sarı (proforma) açık zeminde/zeminin soluk tonunda METİN olarak
// kullanıldığında okunmuyor (kontrast ~2:1) — bu yüzden metin rengi için
// ayrı, koyu bir karşılık tanımlı; zemin/nokta/çerçeve hâlâ TIP_RENK_BELGE.
var TIP_METIN_RENK_BELGE = {proforma:"#5c4600"};

function belgeZinciriBul(kayit){
  var hepsi = [];
  ["numune","teklif","proforma","siparis"].forEach(function(t){
    ReportsData.sonIslemler().filter(function(k){ return k.tip===t; }).forEach(function(k){
      hepsi.push({
        tip: t, ts: k.ts, musteri: k.musteri, tarih: k.tarih, kod: k.kod,
        durum: k.durum, revizeZamani: k.revizeZamani,
        adet: (k.urunler||[]).length,
        bertaKodlari: (k.urunler||[]).map(function(u){ return u.berta; }).filter(Boolean)
      });
    });
  });
  var mevcut = hepsi.find(function(h){ return h.tip===kayit.tip && h.ts===kayit.ts; });
  if(!mevcut) return [];

  function bagliMi(a,b){
    if(a.musteri !== b.musteri) return false;
    return a.bertaKodlari.some(function(kod){ return b.bertaKodlari.indexOf(kod)>=0; });
  }

  var zincir = [mevcut];
  var kullanildi = {}; kullanildi[mevcut.tip+"_"+mevcut.ts] = true;

  var referans = mevcut;
  while(true){
    var enYakinOncesi = null;
    hepsi.forEach(function(aday){
      var anahtar = aday.tip+"_"+aday.ts;
      if(kullanildi[anahtar]) return;
      if(aday.ts >= referans.ts) return;
      if(!bagliMi(referans, aday)) return;
      if(!enYakinOncesi || aday.ts > enYakinOncesi.ts) enYakinOncesi = aday;
    });
    if(!enYakinOncesi) break;
    zincir.unshift(enYakinOncesi);
    kullanildi[enYakinOncesi.tip+"_"+enYakinOncesi.ts] = true;
    referans = enYakinOncesi;
  }

  referans = mevcut;
  while(true){
    var enYakinSonrasi = null;
    hepsi.forEach(function(aday){
      var anahtar = aday.tip+"_"+aday.ts;
      if(kullanildi[anahtar]) return;
      if(aday.ts <= referans.ts) return;
      if(!bagliMi(referans, aday)) return;
      if(!enYakinSonrasi || aday.ts < enYakinSonrasi.ts) enYakinSonrasi = aday;
    });
    if(!enYakinSonrasi) break;
    zincir.push(enYakinSonrasi);
    kullanildi[enYakinSonrasi.tip+"_"+enYakinSonrasi.ts] = true;
    referans = enYakinSonrasi;
  }

  return zincir;
}

// Tarihin sadece "15 Tem" kısmını alır (tarihStr() çıktısı "15 Tem 2026
// 14:30" formatında — saat/yıl bu kompakt satırda gösterilmiyor).
function kisaTarihBelge(tarih){
  var parcalar = String(tarih||"").trim().split(/\s+/);
  return parcalar.length >= 2 ? (parcalar[0] + " " + parcalar[1]) : (tarih||"");
}

// ROTA ZİNCİRİ (13.10.2026, Abdullah'ın isteğiyle) — kaydın kendi "rota"
// alanı varsa (İlerlet ile buraya gelmişse) zincir DOĞRUDAN oradan, güvenilir
// şekilde kurulur: her aşamanın kodu/tarihi, o aşamanın kaydı silinmiş olsa
// bile burada saklı kalır. "rota" yoksa (eski kayıtlar / zincirsiz tekil
// kayıtlar) eski berta-eşleşmeli arama (belgeZinciriBul) yedek olarak kalır.
function belgeZinciriBulRota(kayit){
  var oncekiler = (kayit.rota || []).map(function(r){
    return {tip:r.tip, kod:r.kod||"", tarih:r.tarih||"", ts:null};
  });
  return oncekiler.concat([{tip:kayit.tip, kod:kayit.kod||"", tarih:kayit.tarih||"", ts:kayit.ts}]);
}

function belgeGecmisiniCiz(kayit){
  var kapsayici = document.getElementById("belgeGecmisiKutu");
  var zincir = (kayit.rota && kayit.rota.length) ? belgeZinciriBulRota(kayit) : belgeZinciriBul(kayit);
  if(zincir.length <= 1){
    kapsayici.hidden = true;
    return;
  }
  kapsayici.hidden = false;
  var html = "<div class='belge-gecmis-baslik'>📜 Belge Geçmişi</div>"
    + "<div class='belge-gecmis-alt'>" + (typeof CustomerData !== "undefined" && CustomerData.kodAdHtml ? CustomerData.kodAdHtml(kayit.musteriId, kayit.musteri) : htmlEsc(kayit.musteri)) + " — bu iş için " + zincir.length + " belge bulundu</div>";
  zincir.forEach(function(adim, i){
    var renk = TIP_RENK_BELGE[adim.tip] || "#3569b8";
    var onek = KOD_ONEK_BELGE[adim.tip] || "?";
    var rozetRenk = ONEK_RENK_BELGE[onek] || {yazi:renk, bg:renk+"18"};
    var aktifMi = (i === zincir.length-1);
    var tiklanabilirMi = !aktifMi && adim.ts;
    html += "<div class='belge-gecmis-adim2" + (aktifMi?"":" belge-gecmis-adim2--baglantili") + "'>"
      + "<div class='belge-gecmis-nokta2' style='background:" + renk + ";'></div>"
      + "<div class='belge-gecmis-satir2" + (tiklanabilirMi?" belge-gecmis-satir2--tiklanabilir":"") + "' style='background:" + renk + "14;'"
      + (tiklanabilirMi ? (" data-tip='" + adim.tip + "' data-ts='" + adim.ts + "'") : "") + ">"
      + "<span class='belge-gecmis-tarih2' style='color:" + renk + ";'>" + htmlEsc(kisaTarihBelge(adim.tarih)) + "</span>"
      + "<span class='belge-gecmis-rozet2' style='background:" + rozetRenk.bg + ";color:" + rozetRenk.yazi + ";'>" + onek + "</span>"
      + "<span class='belge-gecmis-baslik2' style='color:" + rozetRenk.yazi + ";'>" + "" + "</span>"
      + (aktifMi
          ? "<span class='belge-gecmis-suan2'>ŞU AN</span>"
          : "<span class='belge-gecmis-kod2' style='color:" + rozetRenk.yazi + ";'>" + htmlEsc(adim.kod||"") + "</span>")
      + "</div>"
      + "</div>";
  });
  kapsayici.innerHTML = html;

  kapsayici.querySelectorAll(".belge-gecmis-satir2--tiklanabilir").forEach(function(el){
    el.onclick = function(){
      var t = this.getAttribute("data-tip");
      var ts = parseFloat(this.getAttribute("data-ts"));
      localStorage.setItem("weiconv2_goruntulenen_belge", JSON.stringify({tip:t, ts:ts}));
      window.location.reload();
    };
  });
}

window.addEventListener("error", function(ev){
  hataGoster("HATA: " + ev.message + " (" + (ev.filename||"").split("/").pop() + ":" + ev.lineno + ")");
});

// Akıllı Geri: bu sayfaya BAŞKA bir sayfadan (Raporlar, Müşteri Kartı vb.)
// gerçek bir tıklamayla gelindiyse, tarayıcı geçmişinde bir adım geri gider
// (kaç adım ileri gidildiyse o kadar geri gelir). Sayfa doğrudan bir
// bağlantıdan/yer imi ile açıldıysa (geçmiş yoksa) Raporlar'a düşer.
// 11.11.2026: Geri artık ortak Nav'da (ust-bar-davranis.js) — açık pencereyi kapatır, yoksa
// geldiğin yoldaki bir önceki sayfaya döner. Bu fonksiyon geriye dönük uyum için boş bırakıldı.
function akilliGeriBagla(yedekSayfa){}
function belgeOncekiSayfayaDon(){
  if(window.Nav) Nav.git(Nav.geriHedefi(null)); else window.location.href = "home.html";
}

var duzenlenenKayit = null;
var duzenlemeSilinenIndeksler = [];

var duzenlemeUrunDegisiklikleri = {}; // { i: {ad, berta, abas} } — "🔄 Ürünü Değiştir" ile seçilenler

// BAKİYE (07.10.2026, Abdullah'ın isteğiyle) — Sepet'teki girişin YERİNE,
// merkez "stokta yok / şu kadar gönderebiliriz" dedikten SONRA, siparişi
// İşlem Geçmişi'nden açıp Düzenle'ye girince burada girilir. "Adet" alanı
// HER ZAMAN gönderilen/faturalanan miktar olarak kalır, bakiye ayrı metadata.
//
// AKILLI TEK BUTON (21.10.2026 güncellemesi, Abdullah'ın isteğiyle): "elde
// hiç yok" (adet=0, tamamen bekliyor) ile "kısmen var" (adet>0, kalanı
// bakiyede) ayrımı YENİ bir alan eklenmeden, salt mevcut "Adet" kutusunun
// değerinden türetilir. Buton metni HER ZAMAN aynı ("📦 Bakiye/Bekleyen
// Ekle") — sadece tıklanınca açılan PANELİN başlığı/rengi Adet'e göre
// değişir (0 ise kırmızı "🚫 Tamamı Bekliyor", >0 ise amber "📦 Bakiyede
// Kalan Adet"). bakiyeModuGuncelle(i) bu modu her zaman güncel tutar —
// panel ilk açılırken VE kullanıcı Adet kutusunu sonradan değiştirirse.
function bakiyeAlaniHtml(u, i){
  var varMi = u.bakiyeAdet > 0;
  var tamamenYokMu = !((u.adet||0) > 0);
  var alanSinif = tamamenYokMu ? " duzenle-bakiye-alan--yok" : "";
  var baslikMetni = tamamenYokMu ? "🚫 Tamamı Bekliyor — elde hiç yok" : "📦 Bakiyede Kalan Adet";
  return "<div class='duzenle-bakiye-link' id='duzenleBakiyeLink-" + i + "' data-bakiye-i='" + i + "'" + (varMi ? " hidden" : "") + ">📦 Bakiye/Bekleyen Ekle</div>"
    + "<div class='duzenle-bakiye-alan" + alanSinif + "' id='duzenleBakiyeAlan-" + i + "'" + (varMi ? "" : " hidden") + ">"
    + "<div class='duzenle-bakiye-alan-baslik'><span id='duzenleBakiyeBaslik-" + i + "'>" + baslikMetni + "</span><button type='button' class='duzenle-bakiye-kapat' data-bakiye-i='" + i + "'>✕</button></div>"
    + "<input type='number' step='1' min='0' class='duzenle-bakiye-adet' id='duzenleBakiyeAdet-" + i + "' placeholder='0' value='" + (varMi ? u.bakiyeAdet : "") + "'>"
    + "<input type='text' class='duzenle-bakiye-not' id='duzenleBakiyeNot-" + i + "' placeholder='Not (opsiyonel) — örn. ne zaman tamamlanacak' value='" + htmlEsc(u.bakiyeNot||"") + "'>"
    // 08.11.2026: beklenen termin tarihi (opsiyonel) + "Tamamı yok" tek dokunuş
    + "<label class='duzenle-etiket' for='duzenleBakiyeTermin-" + i + "' style='margin-top:8px;display:block'>Beklenen termin (opsiyonel)</label>"
    + "<input type='date' class='duzenle-bakiye-not' id='duzenleBakiyeTermin-" + i + "' value='" + htmlEsc(u.bakiyeTermin||"") + "'>"
    + "<button type='button' class='duzenle-bakiye-tamami' data-bakiye-i='" + i + "'>🚫 Tamamı yok — hiç sevk edilmedi</button>"
    + "</div>";
}

// Panel modunu (renk + başlık) kayıttaki "Adet" kutusunun ANLIK değerine
// göre günceller — panel ilk açılırken ve Adet sonradan değiştirilince
// çağrılır, bkz. duzenlemeAc().
function bakiyeModuGuncelle(i){
  var adetEl = document.querySelector("[data-alan='adet'][data-i='" + i + "']");
  var adet = adetEl ? (parseFloat(adetEl.value) || 0) : 0;
  var tamamenYokMu = !(adet > 0);
  var alanEl = document.getElementById("duzenleBakiyeAlan-" + i);
  var baslikEl = document.getElementById("duzenleBakiyeBaslik-" + i);
  if(!alanEl || !baslikEl) return;
  alanEl.classList.toggle("duzenle-bakiye-alan--yok", tamamenYokMu);
  baslikEl.textContent = tamamenYokMu ? "🚫 Tamamı Bekliyor — elde hiç yok" : "📦 Bakiyede Kalan Adet";
}

function duzenlemeAc(k){
  duzenlenenKayit = k;
  duzenlemeSilinenIndeksler = [];
  duzenlemeUrunDegisiklikleri = {};
  var kapsayici = document.getElementById("duzenleUrunListesi");
  kapsayici.innerHTML = (k.urunler||[]).map(function(u, i){
    return "<div class='duzenle-urun-satir' id='duzenleSatir-" + i + "'>"
      + "<div class='duzenle-urun-baslik-satir'>"
      + "<div class='duzenle-urun-ad' id='duzenleUrunAd-" + i + "'>" + htmlEsc(u.ad) + "</div>"
      + "<button class='duzenle-urun-sil-btn' data-urun-sil-i='" + i + "'>🗑️</button>"
      + "</div>"
      + "<button type='button' class='duzenle-urun-degistir-link' data-degistir-i='" + i + "'>🔄 Ürünü Değiştir</button>"
      + "<div class='duzenle-urun-arama' id='duzenleUrunArama-" + i + "' hidden>"
      + "<input type='text' class='duzenle-urun-arama-input' data-arama-i='" + i + "' placeholder='Ürün ara'>"
      + "<div class='duzenle-urun-arama-sonuc' id='duzenleUrunAramaSonuc-" + i + "'></div>"
      + "</div>"
      + "<div class='duzenle-alan-grid'>"
      + "<div class='duzenle-alan'><label class='duzenle-etiket'>Liste Fiyat</label><input type='number' step='0.01' data-alan='listeFiyat' data-i='" + i + "' value='" + (u.listeFiyat||0) + "'></div>"
      + "<div class='duzenle-alan'><label class='duzenle-etiket'>İskonto %</label><input type='number' step='0.1' data-alan='iskonto' data-i='" + i + "' value='" + (u.iskonto||0) + "'></div>"
      + "<div class='duzenle-alan'><label class='duzenle-etiket'>Net Fiyat (otomatik)</label><input type='text' class='duzenle-net-oto' readonly tabindex='-1' data-alan='netFiyat' data-i='" + i + "' value=''></div>"
      + "<div class='duzenle-alan'><label class='duzenle-etiket'>Adet</label><input type='number' step='1' min='0' data-alan='adet' data-i='" + i + "' value='" + (u.adet != null ? u.adet : 1) + "'></div>"
      + "<div class='duzenle-alan'><label class='duzenle-etiket'>Dip Fiyat</label><input type='number' step='0.01' data-alan='dipFiyat' data-i='" + i + "' value='" + (u.dipFiyat||0) + "'></div>"
      + "</div>"
      + bakiyeAlaniHtml(u, i)
      + "</div>";
  }).join("");

  // NET FİYAT (otomatik) — 09.11.2026, Abdullah isteği ("iskontoyu
  // değiştirince yeni fiyat otomatik hesaplansın"): Liste Fiyat veya
  // İskonto % değişince Net Fiyat = Liste × (1 − İsk/100) anında yazılır.
  // SALT-OKUNUR gösterge; kaydederken kullanılan formül (iskBirim) ile
  // AYNI. Dip Fiyat (maliyet/prim tabanı) bu hesaptan ETKİLENMEZ.
  function netFiyatGuncelle(i){
    var l = parseFloat((document.querySelector("[data-alan='listeFiyat'][data-i='"+i+"']")||{}).value)||0;
    var k = parseFloat((document.querySelector("[data-alan='iskonto'][data-i='"+i+"']")||{}).value)||0;
    var n = document.querySelector("[data-alan='netFiyat'][data-i='"+i+"']");
    if(n) n.value = (l - l*k/100).toFixed(2).replace(".", ",");
  }
  (k.urunler||[]).forEach(function(u, i){ netFiyatGuncelle(i); });
  kapsayici.oninput = function(ev){
    var a = ev.target && ev.target.getAttribute && ev.target.getAttribute("data-alan");
    if(a === "listeFiyat" || a === "iskonto") netFiyatGuncelle(ev.target.getAttribute("data-i"));
  };
  kapsayici.querySelectorAll(".duzenle-bakiye-link").forEach(function(link){
    link.onclick = function(){
      var i = this.getAttribute("data-bakiye-i");
      bakiyeModuGuncelle(i); // panel açılırken Adet'in O ANKİ değerine göre mod (yok/kısmi) belirlenir
      document.getElementById("duzenleBakiyeLink-" + i).hidden = true;
      document.getElementById("duzenleBakiyeAlan-" + i).hidden = false;
      document.getElementById("duzenleBakiyeAdet-" + i).focus();
    };
  });
  // "Tamamı yok" (08.11.2026): sevk edilen adet bekleyene geçer — Adet 0, Bakiye = toplam
  // sipariş edilen. Böylece "yok" ürün yanlışlıkla satış/prim sayılmaz.
  kapsayici.querySelectorAll(".duzenle-bakiye-tamami").forEach(function(btn){
    btn.onclick = function(){
      var i = this.getAttribute("data-bakiye-i");
      var adetEl = document.querySelector("[data-alan='adet'][data-i='" + i + "']");
      var bakEl = document.getElementById("duzenleBakiyeAdet-" + i);
      var toplam = (parseFloat(adetEl.value)||0) + (parseFloat(bakEl.value)||0);
      adetEl.value = 0;
      bakEl.value = toplam;
      bakiyeModuGuncelle(i);
    };
  });
  kapsayici.querySelectorAll(".duzenle-bakiye-kapat").forEach(function(btn){
    btn.onclick = function(){
      var i = this.getAttribute("data-bakiye-i");
      document.getElementById("duzenleBakiyeAdet-" + i).value = "";
      document.getElementById("duzenleBakiyeNot-" + i).value = "";
      document.getElementById("duzenleBakiyeTermin-" + i).value = "";
      document.getElementById("duzenleBakiyeAlan-" + i).hidden = true;
      document.getElementById("duzenleBakiyeLink-" + i).hidden = false;
    };
  });
  // Kullanıcı panel AÇIKKEN Adet kutusunu değiştirirse (örn. 0'dan 50'ye
  // çıkarırsa), panel modu (renk/başlık) canlı güncellensin.
  kapsayici.querySelectorAll("[data-alan='adet']").forEach(function(input){
    input.addEventListener("input", function(){
      bakiyeModuGuncelle(this.getAttribute("data-i"));
    });
  });

  kapsayici.querySelectorAll(".duzenle-urun-sil-btn").forEach(function(btn){
    btn.onclick = function(){
      var i = parseInt(this.getAttribute("data-urun-sil-i"), 10);
      if((duzenlenenKayit.urunler||[]).length - duzenlemeSilinenIndeksler.length <= 1){
        alert("Bir kayıtta en az 1 ürün kalmalı. Tüm ürünleri silmek istiyorsan, kaydı tamamen 'Kaydı Sil' butonuyla kaldır.");
        return;
      }
      duzenlemeSilinenIndeksler.push(i);
      var satir = document.getElementById("duzenleSatir-" + i);
      if(satir) satir.remove();
    };
  });

  // "🔄 Ürünü Değiştir" (WG.090926.196): yanlış girilmiş bir ürünü,
  // kayıt tarihi (ts) değişmeden başka bir ürünle değiştirmek için.
  kapsayici.querySelectorAll(".duzenle-urun-degistir-link").forEach(function(link){
    link.onclick = function(){
      var i = this.getAttribute("data-degistir-i");
      var arama = document.getElementById("duzenleUrunArama-" + i);
      arama.hidden = !arama.hidden;
      if(!arama.hidden) arama.querySelector(".duzenle-urun-arama-input").focus();
    };
  });
  kapsayici.querySelectorAll(".duzenle-urun-arama-input").forEach(function(input){
    input.addEventListener("input", function(){
      var i = this.getAttribute("data-arama-i");
      var sonucKutusu = document.getElementById("duzenleUrunAramaSonuc-" + i);
      var q = this.value.trim();
      if(q.length < 2 || typeof ProductData === "undefined"){ sonucKutusu.innerHTML = ""; return; }
      var sonuclar = ProductData.ara(q).slice(0, 8);
      var aramaCache = {};
      sonucKutusu.innerHTML = sonuclar.map(function(s, sIdx){
        var b = ProductData.urunBilgisi(s.item);
        aramaCache[sIdx] = b;
        return "<div class='duzenle-urun-arama-satir' data-sidx='" + sIdx + "'>"
          + "<div class='duzenle-urun-arama-ad'>" + htmlEsc(b.ad) + "</div>"
          + "<div class='duzenle-urun-arama-kod'>" + htmlEsc(b.berta) + " - " + htmlEsc(b.abas) + " · Liste: " + fmt(b.fiyat) + " EURO</div>"
          + "</div>";
      }).join("") || "<div class='duzenle-urun-arama-bos'>Sonuç yok.</div>";
      sonucKutusu.querySelectorAll(".duzenle-urun-arama-satir").forEach(function(satir){
        satir.onclick = function(){
          var b = aramaCache[this.getAttribute("data-sidx")];
          if(!b) return;
          duzenlemeUrunDegisiklikleri[i] = {ad:b.ad, berta:b.berta, abas:b.abas};
          document.getElementById("duzenleUrunAd-" + i).textContent = b.ad;
          document.querySelector("[data-alan='listeFiyat'][data-i='"+i+"']").value = b.fiyat;
          netFiyatGuncelle(i);
          document.getElementById("duzenleUrunArama-" + i).hidden = true;
        };
      });
    });
  });

  document.getElementById("duzenleOverlay").hidden = false;
}

function duzenlemeKaydet(){
  try{
    if(!duzenlenenKayit) return;
    var yeniUrunler = [];
    (duzenlenenKayit.urunler||[]).forEach(function(u, i){
      if(duzenlemeSilinenIndeksler.indexOf(i) >= 0) return; // silinmiş ürün, atla
      var listeFiyat = parseFloat(document.querySelector("[data-alan='listeFiyat'][data-i='"+i+"']").value)||0;
      var iskonto = parseFloat(document.querySelector("[data-alan='iskonto'][data-i='"+i+"']").value)||0;
      // DÜZELTME (21.10.2026): "||1" ile Adet=0 YANLIŞLIKLA 1'e dönüşüyordu
      // (JS'te 0 "falsy") — bu da "elde hiç yok" (Adet=0) durumunun hiç
      // kaydedilememesine yol açıyordu. Artık SADECE kutu gerçekten boş/
      // sayı değilse (NaN) 1'e düşer; kasıtlı 0 olduğu gibi kaydedilir.
      var adetGirisi = parseFloat(document.querySelector("[data-alan='adet'][data-i='"+i+"']").value);
      var adet = isNaN(adetGirisi) ? 1 : adetGirisi;
      var dipFiyat = parseFloat(document.querySelector("[data-alan='dipFiyat'][data-i='"+i+"']").value)||0;
      var iskontoluFiyat = listeFiyat - (listeFiyat*iskonto/100);
      var degisen = duzenlemeUrunDegisiklikleri[i];
      // BAKİYE — kutu açıksa gir, kapalıysa (hiç açılmadıysa veya kapatılmışsa) 0/boş.
      var bakiyeAlanEl = document.getElementById("duzenleBakiyeAlan-" + i);
      var bakiyeAcikMi = bakiyeAlanEl ? !bakiyeAlanEl.hidden : false;
      var bakiyeAdet = bakiyeAcikMi ? (parseFloat(document.getElementById("duzenleBakiyeAdet-" + i).value)||0) : 0;
      var bakiyeNot = bakiyeAcikMi ? document.getElementById("duzenleBakiyeNot-" + i).value.trim() : "";
      var bakiyeTermin = (bakiyeAcikMi && bakiyeAdet > 0) ? (document.getElementById("duzenleBakiyeTermin-" + i).value || "") : "";
      yeniUrunler.push({
        ad: degisen ? degisen.ad : u.ad,
        berta: degisen ? degisen.berta : u.berta,
        abas: degisen ? degisen.abas : u.abas,
        listeFiyat: listeFiyat, iskonto: iskonto, adet: adet, dipFiyat: dipFiyat,
        iskBirim: iskontoluFiyat,
        toplamEuro: iskontoluFiyat * adet,
        bakiyeAdet: bakiyeAdet, bakiyeNot: bakiyeNot, bakiyeTermin: bakiyeTermin
      });
    });
    var btn = document.getElementById("btnDuzenleKaydet");
    btn.disabled = true;
    btn.textContent = "Kaydediliyor...";
    ReportsData.kaydiGuncelle(duzenlenenKayit.tip, duzenlenenKayit.ts, yeniUrunler, function(basarili, err){
      btn.disabled = false;
      btn.textContent = "Kaydet";
      if(basarili){
        document.getElementById("duzenleOverlay").hidden = true;
        duzenlenenKayit = null;
        alert("✓ Güncellendi.");
      } else {
        hataGoster("Güncellenemedi: " + (err && err.message ? err.message : "bilinmeyen hata"));
      }
    });
  }catch(e){ hataGoster("Düzenleme kaydedilemedi: " + e.message); }
}

document.addEventListener("DOMContentLoaded", function(){
  akilliGeriBagla("reports.html");
  tarihiGuncelle();
  var btnMenuEl = document.getElementById("btnMenu");
  if(btnMenuEl) btnMenuEl.onclick = function(){ window.location.href = "menu.html"; };
  // Kapat (✕) artık ortak Nav'da: açık pencereleri kapatır, yoksa Ana Sayfa (11.11.2026).
  // TAŞINDI (01.11.2026, Abdullah onayı — mockup-panel.html Varyant A):
  // "btnIslemlerAc" artık STATİK HTML'de değil, İşlem Hareket Paneli
  // satırının İÇİNDE (siparisPaneliHtml, bkz. belgeyiCiz() ve denemeCiz()
  // aşağıda) — o satır Firebase verisi gelince DİNAMİK olarak çiziliyor.
  // Bu yüzden onclick bağlama işlemi de artık BURADA değil, denemeCiz()
  // içinde belgeyiCiz()'den HEMEN SONRA yapılıyor (element o an DOM'da var
  // oluyor); burada bırakılsaydı element henüz yokken getElementById null
  // dönüp hata fırlatır, aşağıdaki TÜM diğer bağlamalar (Beklet, msVazgec,
  // msSil, vb.) hiç çalışmazdı.
  // EKLENDİ (15.10.2026, Abdullah onayı — mockup üzerinden onaylandı):
  // "Beklet" — bu belgeyi BekleyenIslemler kuyruğuna ekler (en fazla 2),
  // mevcut "weiconv2_goruntulenen_belge" anahtarının O ANKİ değerini
  // aynen saklar; devam edilince aynı anahtar geri yazılıp bu sayfaya
  // dönülür — sayfanın kendi yükleme mantığına HİÇ dokunulmadı.
  var btnBelgeBekletEl = document.getElementById("btnBelgeBeklet");
  if(btnBelgeBekletEl) btnBelgeBekletEl.onclick = function(){
    if(!sonCizilenKayit){ hataGoster("Önce bir belge açılmalı."); return; }
    if(typeof BekleyenIslemler === "undefined"){ hataGoster("Beklet özelliği yüklenemedi."); return; }
    var onek = KOD_ONEK_BELGE[sonCizilenKayit.tip] || "?";
    var renk = ONEK_RENK_BELGE[onek] || {yazi:"#334155", bg:"#eef2f8"};
    var sonuc = BekleyenIslemler.ekle({
      // KOD - İsim (09.11.2026): bekleyen listesinde de müşteri kodu isimden önce.
      baslik: (function(){
        var ad = sonCizilenKayit.musteri || "-";
        var kod = (typeof CustomerData !== "undefined" && CustomerData.kodBul) ? CustomerData.kodBul(sonCizilenKayit.musteriId, sonCizilenKayit.musteri) : "";
        return kod ? (kod + " - " + ad) : ad;
      })(),
      altKod: sonCizilenKayit.kod || "",
      kisaKod: onek,
      renkBg: renk.bg,
      renkYazi: renk.yazi,
      url: "belge-onizleme.html",
      resumeKey: "weiconv2_goruntulenen_belge"
    });
    if(!sonuc.basarili){ hataGoster(sonuc.mesaj); return; }
    belgeOncekiSayfayaDon();
  };
  // AÇILIR LİSTE (05.11.2026, Abdullah onayı): "Kapat" tuşu kalktı — dışarı
  // dokununca kapanır. Konum: "i" tuşunun hemen altı, sağa yaslı.
  function acilirKonumla(menuId){
    var p = document.getElementById(menuId);
    var t = document.getElementById("btnIslemlerAc");
    if(!p) return;
    var vw = window.innerWidth;
    var r = t ? t.getBoundingClientRect() : { top:10, bottom:54, left:vw - 56, right:vw - 8, width:48 };
    var w = p.offsetWidth || 190;
    var sol = Math.max(6, Math.min(r.right + 2 - w, vw - w - 6));
    p.style.top = (r.bottom + 8) + "px";
    p.style.left = sol + "px";
    p.style.setProperty("--ok-sol", Math.max(10, Math.min(w - 22, r.left + r.width / 2 - sol - 6)) + "px");
  }
  function acilirKapat(zeminId){
    document.getElementById(zeminId).hidden = true;
    var t = document.getElementById("btnIslemlerAc");
    if(t) t.classList.remove("ub-ayrinti-secili");
  }
  function ayrintiAcilirAc(){
    // İlerlet satırı SADECE bu kayıt ilerletilebiliyorsa görünür (boş seçenek
    // listesi/"sonrası yok" uyarısı olmasın).
    var sec = ReportsData.ilerletSecenekleri(sonCizilenKayit);
    document.getElementById("msIlerlet").hidden = !sec.length;
    // BEKLEYEN (08.11.2026): stok bekleyen / bakiyeli sipariş — "İlerlet" yerine
    // "Bekleyeni İlerlet" + "Bekleyenden Çıkar" satırı.
    var bekleyenMod = ReportsData.bekleyenModu(sonCizilenKayit);
    document.getElementById("msIlerlet").lastChild.nodeValue = bekleyenMod ? "Bekleyeni İlerlet" : "İlerlet";
    document.getElementById("msCikar").hidden = !bekleyenMod;
    document.getElementById("islemlerOverlay").hidden = false;
    acilirKonumla("ayrintiAcilir");
    var t = document.getElementById("btnIslemlerAc");
    if(t) t.classList.add("ub-ayrinti-secili");
  }
  document.getElementById("islemlerOverlay").addEventListener("click", function(ev){
    if(ev.target === this) acilirKapat("islemlerOverlay");
  });
  document.getElementById("ilerletSecOverlay").addEventListener("click", function(ev){
    if(ev.target === this) acilirKapat("ilerletSecOverlay");
  });

  // "Yazdır" düğmesi KALDIRILDI (18.10.2026, Abdullah'ın isteğiyle) —
  // Ayrıntı sheet'inden çıkarıldı. TeklifPdf/teklif-pdf.js modülüne
  // dokunulmadı (başka bir yerde kullanılıyor olabilir).
  document.getElementById("msSil").onclick = function(){
    acilirKapat("islemlerOverlay");
    if(!ref) return;
    var belgeAdi = (sonCizilenKayit ? ((TIP_ETIKET_BELGE[sonCizilenKayit.tip]||"belge") + (sonCizilenKayit.kod ? " · " + sonCizilenKayit.kod : "")) : "bu belge");
    if(!confirm("Sadece bu belge silinecek:\n\n" + belgeAdi + "\n\nMüşteri kartına, adreslere veya yetkili bilgilerine dokunulmayacak — sadece bu tek kayıt kalıcı olarak silinecek. Bu geri alınamaz.")) return;
    var btn = document.getElementById("msSil");
    btn.disabled = true;
    btn.textContent = "Siliniyor...";
    ReportsData.kaydiSil(ref.tip, ref.ts, function(basarili, err){
      if(basarili){
        alert("✓ Sadece bu belge silindi. Müşteri kartı ve diğer bilgiler etkilenmedi.");
        // HATA DÜZELTMESİ (01.10.2026, Abdullah'ın bildirdiği hata): silme
        // sonrası sabit olarak "reports.html" (Aylık Satış/Prim) açılıyordu
        // — oysa kullanıcı buraya Müşteri Kartı > İşlemler > İşlem Geçmişi
        // (gecmis.html) üzerinden gelmiş olabilir ve geri oraya dönmesini
        // bekliyor. "Kapat" butonuyla aynı akıllı-geri mantığı kullanılıyor:
        // tarayıcı geçmişinde önceki sayfa varsa (her zaman vardır, buraya
        // bir yerden tıklanarak gelinmiştir) oraya dönülür — gecmis.html'den
        // gelindiyse gecmis.html'e, başka bir listeden gelindiyse oraya.
        belgeOncekiSayfayaDon();
      } else {
        btn.disabled = false;
        btn.textContent = "🗑️ Kaydı sil";
        hataGoster("Silinemedi: " + (err && err.message ? err.message : "bilinmeyen hata"));
      }
    });
  };
  // "Kaçtı olarak işaretle" düğmesi KALDIRILDI (18.10.2026, Abdullah'ın
  // isteğiyle) — "kaçtı" artık ayrı bir durum olarak tutulmuyor, böyle bir
  // kayıt doğrudan "Kaydı sil" ile silinecek. ReportsData.kaydiKacanIsaretle
  // ve DURUM_ETIKET.kacan'a (eski kayıtları doğru göstermeye devam etmesi
  // için) dokunulmadı.

  var ref = null;
  try{ ref = JSON.parse(localStorage.getItem("weiconv2_goruntulenen_belge")||"null"); }catch(e){}
  if(!ref){
    hataGoster("Görüntülenecek belge bulunamadı.");
    return;
  }

  var sonCizilenKayit = null;
  var sonCizilenMusteri = null;

  function denemeCiz(){
    var liste = ReportsData.sonIslemler();
    var kayit = liste.find(function(k){ return k.tip===ref.tip && k.ts===ref.ts; });
    if(!kayit) return false;
    sonCizilenKayit = kayit;
    var musteri = CustomerData.musteriBul(kayit.musteri);
    sonCizilenMusteri = musteri;
    belgeyiCiz(kayit, musteri);
    belgeGecmisiniCiz(kayit);

    // EKLENDİ (01.11.2026, Abdullah onayı — mockup-panel.html Varyant A):
    // "Ayrıntı" ikonu artık İşlem Hareket Paneli satırının içinde —
    // belgeyiCiz() her çağrıldığında (yeniden çizimde de) yeniden
    // oluşuyor, bu yüzden bağlama da HER denemeCiz() çağrısında burada
    // tazeleniyor (.onclick = idempotent, üst üste binmez).
    var btnIslemlerAcEl = document.getElementById("btnIslemlerAc");
    if(btnIslemlerAcEl) btnIslemlerAcEl.onclick = ayrintiAcilirAc;

    // ÖDEME GÜNÜ paneline dokununca (10.11.2026, Abdullah onayı): müşterinin ödeme görüşmeleri +
    // not/hatırlatma + faturaları, panelin hemen altında (Cari Bilgi VADE penceresiyle AYNI bileşen).
    // "vadeTakip" izni yoksa panel sadece bilgi olarak kalır (kısıtlama gevşetilmedi).
    var odemePanelEl = document.querySelector(".bo-odeme-gunu");
    if(odemePanelEl && typeof OdemeVadeUI !== "undefined" && (typeof window.izinVarMi !== "function" || window.izinVarMi("vadeTakip"))){
      odemePanelEl.classList.add("bo-odeme-gunu--tikla");
      odemePanelEl.onclick = function(){
        OdemeVadeUI.popupAc({serit: odemePanelEl, ankaj: odemePanelEl.querySelector(".ozet-ikon"),
          musteriId: (musteri && musteri.id) || kayit.musteriId || null, musteriAd: kayit.musteri,
          degisti: function(){ denemeCiz(); }});
      };
    }

    // "Stok Bekliyor olarak işaretle" (TÜM sipariş bekliyor) — kayıt zaten bekleyen
    // (durum dolu) ya da ürün bazında bakiyeli ise gösterilmez: aynı siparişte iki
    // ayrı "bekleyen ekle" yolu çıkıp birbiriyle çakışmasın (08.11.2026).
    document.getElementById("btnMenuBeklemede").hidden = !!kayit.durum || (kayit.urunler||[]).some(function(u){ return (u.bakiyeAdet||0) > 0; });
    return true;
  }

  document.getElementById("msDuzenle").onclick = function(){
    if(!sonCizilenKayit) return;
    acilirKapat("islemlerOverlay");
    document.getElementById("duzenleMenuOverlay").hidden = false;
  };

  document.getElementById("btnMenuUrunler").onclick = function(){
    document.getElementById("duzenleMenuOverlay").hidden = true;
    duzenlemeAc(sonCizilenKayit);
  };
  document.getElementById("btnDuzenleKaydet").onclick = duzenlemeKaydet;

  // ---- Yetkili Kişi seçimi (bu belgede kim görünsün) ----
  document.getElementById("btnMenuYetkili").onclick = function(){
    document.getElementById("duzenleMenuOverlay").hidden = true;
    var liste = document.getElementById("yetkiliSecListesi");
    var yetkililer = (sonCizilenMusteri && sonCizilenMusteri.iletisimler) || [];
    var seciliIsimler = sonCizilenKayit.gorunecekYetkililer || null; // null = hepsi
    if(!yetkililer.length){
      liste.innerHTML = "<p class='bos-mesaj'>Bu müşteride kayıtlı yetkili yok. Önce Cari Kart'tan ekleyebilirsin.</p>";
    } else {
      liste.innerHTML = yetkililer.map(function(k, i){
        var isaretli = !seciliIsimler || seciliIsimler.indexOf(k.isim) !== -1;
        return "<label class='yetkili-sec-satir'><input type='checkbox' data-isim='" + (k.isim||"").replace(/'/g,"&#39;") + "'" + (isaretli?" checked":"") + "> " + (k.isim||"(isimsiz)") + (k.gorev?" — "+k.gorev:"") + "</label>";
      }).join("");
    }
    document.getElementById("yetkiliSecOverlay").hidden = false;
  };
  document.getElementById("btnYetkiliSecKaydet").onclick = function(){
    if(!sonCizilenKayit) return;
    var kutular = document.querySelectorAll("#yetkiliSecListesi input[type=checkbox]");
    var toplam = kutular.length;
    var secililer = [];
    kutular.forEach(function(k){ if(k.checked) secililer.push(k.getAttribute("data-isim")); });
    // Hepsi işaretliyse (ya da hiç yetkili yoksa) null kaydet — "hepsini göster" varsayılanına dön.
    var kaydedilecek = (secililer.length === toplam) ? null : secililer;
    var btn = document.getElementById("btnYetkiliSecKaydet");
    btn.disabled = true; btn.textContent = "Kaydediliyor...";
    ReportsData.kaydiAlanGuncelle(sonCizilenKayit.tip, sonCizilenKayit.ts, {gorunecekYetkililer: kaydedilecek}, function(basarili, err){
      btn.disabled = false; btn.textContent = "Kaydet";
      if(!basarili){ hataGoster("Kaydedilemedi: " + (err && err.message)); return; }
      document.getElementById("yetkiliSecOverlay").hidden = true;
    });
  };

  // ---- Fatura / Teslimat Adresi düzenleme ----
  var duzenlenenAdresTuru = null; // "faturaAdresi" | "teslimatAdresi"
  function adresDuzenleAc(tur, baslik){
    duzenlenenAdresTuru = tur;
    document.getElementById("adresDuzenleBaslik").textContent = baslik;
    document.getElementById("adresDuzenleMetni").value = (sonCizilenKayit[tur] && sonCizilenKayit[tur].adres) || "";
    document.getElementById("adresDuzenleOverlay").hidden = false;
  }
  document.getElementById("btnMenuFaturaAdres").onclick = function(){
    document.getElementById("duzenleMenuOverlay").hidden = true;
    adresDuzenleAc("faturaAdresi", "Fatura Adresini Düzenle");
  };
  document.getElementById("btnMenuTeslimatAdres").onclick = function(){
    document.getElementById("duzenleMenuOverlay").hidden = true;
    adresDuzenleAc("teslimatAdresi", "Teslimat Adresini Düzenle");
  };
  document.getElementById("btnAdresDuzenleKaydet").onclick = function(){
    if(!sonCizilenKayit || !duzenlenenAdresTuru) return;
    var metin = document.getElementById("adresDuzenleMetni").value.trim();
    var btn = document.getElementById("btnAdresDuzenleKaydet");
    btn.disabled = true; btn.textContent = "Kaydediliyor...";
    var alanlar = {};
    alanlar[duzenlenenAdresTuru] = metin ? {etiket: (duzenlenenAdresTuru==="faturaAdresi"?"Fatura Adresi":"Teslimat Adresi"), adres: metin} : null;
    ReportsData.kaydiAlanGuncelle(sonCizilenKayit.tip, sonCizilenKayit.ts, alanlar, function(basarili, err){
      btn.disabled = false; btn.textContent = "Kaydet";
      if(!basarili){ hataGoster("Kaydedilemedi: " + (err && err.message)); return; }
      document.getElementById("adresDuzenleOverlay").hidden = true;
      duzenlenenAdresTuru = null;
    });
  };

  // ---- Belgeye özel not ----
  document.getElementById("btnMenuNot").onclick = function(){
    document.getElementById("duzenleMenuOverlay").hidden = true;
    document.getElementById("notDuzenleMetni").value = sonCizilenKayit.not || "";
    document.getElementById("notDuzenleOverlay").hidden = false;
  };
  document.getElementById("btnNotDuzenleKaydet").onclick = function(){
    if(!sonCizilenKayit) return;
    var metin = document.getElementById("notDuzenleMetni").value.trim();
    var btn = document.getElementById("btnNotDuzenleKaydet");
    btn.disabled = true; btn.textContent = "Kaydediliyor...";
    ReportsData.kaydiAlanGuncelle(sonCizilenKayit.tip, sonCizilenKayit.ts, {not: metin || null}, function(basarili, err){
      btn.disabled = false; btn.textContent = "Kaydet";
      if(!basarili){ hataGoster("Kaydedilemedi: " + (err && err.message)); return; }
      document.getElementById("notDuzenleOverlay").hidden = true;
    });
  };

  // ---- İlerlet — hangi aşamaya dönüştürüleceği BURADA sorulur (Gönder
  // aşamasında tekrar sorulmaz). Numune → Teklif/Proforma; Teklif →
  // Proforma/Sipariş; Proforma → sadece Sipariş — SONRAKI_ASAMALAR'daki
  // sıraya göre, kronolojik (Numune→Teklif→Proforma→Sipariş) listelenir.
  // "Tekrarla" seçeneği KALDIRILDI (18.10.2026, Abdullah'ın isteğiyle) —
  // popup artık SADECE gerçek sonraki-aşama seçeneklerini gösteriyor.
  var TIP_ETIKET_ILERLET = TipEtiket.kisa;
  var TIP_IKON_ILERLET = {numune:"🧪", teklif:"📄", proforma:"🧾", siparis:"📦"};
  // (05.11.2026, Abdullah onayı — mockup üzerinden) İlerlet artık "Devam Et"/
  // "Kapat" tuşlu pencere DEĞİL: "i" tuşunun altında küçük açılır liste; bir
  // aşamaya dokunmak doğrudan o aşamaya ilerletir. Seçenekler tek yerden:
  // ReportsData.ilerletSecenekleri(kayit) — "Stok Bekliyor" siparişte Fiyat
  // Teklifi / Proforma / Sipariş (fiyatlar geç gelen stok yüzünden değişmiş
  // olabilir), Numune hiçbir zaman yok.
  document.getElementById("msIlerlet").onclick = function(){
    acilirKapat("islemlerOverlay");
    try{
      if(!sonCizilenKayit) return;
      var secenekler = ReportsData.ilerletSecenekleri(sonCizilenKayit);
      if(!secenekler.length) return;
      var liste = document.getElementById("ilerletSecenekListesi");
      liste.innerHTML = secenekler.map(function(tip){
        return "<button type='button' class='acilir-menu-oge acilir-menu-oge--" + tip + "' data-tip='" + tip + "'>"
          + "<span class='acilir-menu-ikon'>" + (TIP_IKON_ILERLET[tip]||"▶") + "</span>" + (TIP_ETIKET_ILERLET[tip]||tip) + "</button>";
      }).join("");
      liste.querySelectorAll("[data-tip]").forEach(function(btn){
        btn.onclick = function(){
          var tip = this.getAttribute("data-tip");
          try{
            acilirKapat("ilerletSecOverlay");
            if(!sonCizilenKayit) return;
            ReportsData.revizeBaslat(sonCizilenKayit, tip);
          }catch(e){ hataGoster("İlerletilemedi: " + e.message); }
        };
      });
      document.getElementById("ilerletSecOverlay").hidden = false;
      acilirKonumla("ilerletAcilir");
      var t = document.getElementById("btnIslemlerAc");
      if(t) t.classList.add("ub-ayrinti-secili");
    }catch(e){ hataGoster("İlerlet seçenekleri açılamadı: " + e.message); }
  };

  // ---- BEKLEYENDEN ÇIKAR (08.11.2026, Abdullah onayı) — "i" menüsünden; küçük
  // açılır liste, bir satıra dokunmak doğrudan uygular (ayrı onay penceresi yok).
  //   Stok Bekliyor : "Kaçan satış olarak kapat" / "İşareti kaldır (normal sipariş)"
  //   Bakiye        : "Bakiyeyi kapat" (sevk edilen kısım satış olarak kalır)
  document.getElementById("msCikar").onclick = function(){
    acilirKapat("islemlerOverlay");
    try{
      if(!sonCizilenKayit) return;
      var mod = ReportsData.bekleyenModu(sonCizilenKayit);
      if(!mod) return;
      var secenekler = mod === "stok"
        ? [{k:"kacan", ikon:"❌", ad:"Kaçan satış olarak kapat"}, {k:"normal", ikon:"✅", ad:"İşareti kaldır (normal sipariş)"}]
        : [{k:"bakiye", ikon:"📦", ad:"Bakiyeyi kapat (vazgeçildi)"}];
      var liste = document.getElementById("cikarSecenekListesi");
      liste.innerHTML = secenekler.map(function(o){
        return "<button type='button' class='acilir-menu-oge acilir-menu-oge--notr' data-secim='" + o.k + "'><span class='acilir-menu-ikon'>" + o.ikon + "</span>" + o.ad + "</button>";
      }).join("");
      liste.querySelectorAll("[data-secim]").forEach(function(btn){
        btn.onclick = function(){
          var secim = this.getAttribute("data-secim");
          acilirKapat("cikarSecOverlay");
          if(!sonCizilenKayit) return;
          ReportsData.bekleyendenCikar(sonCizilenKayit, secim, function(ok, err){
            if(!ok){ hataGoster("Bekleyenden çıkarılamadı: " + (err && err.message ? err.message : err)); return; }
            denemeCiz();
          });
        };
      });
      document.getElementById("cikarSecOverlay").hidden = false;
      acilirKonumla("cikarAcilir");
      var t = document.getElementById("btnIslemlerAc");
      if(t) t.classList.add("ub-ayrinti-secili");
    }catch(e){ hataGoster("Liste açılamadı: " + e.message); }
  };

  // ---- Beklemede (sipariş verildi ama stokta yok, tedarik/termin
  // bekleniyor) — İşlemler menüsünden yeni işaretlenebilir, ya da
  // kayıt üzerindeki BEKLEMEDE rozetine dokunarak notu düzenlenebilir/
  // silinebilir. Beklemedeyken bu kayıt hiçbir aylık/günlük toplama
  // (satış, prim) dahil edilmez — bkz. ReportsData.ayToplami,
  // HomeData.buAyinVerisi/bugununVerisi (07.09.2026).
  var beklemedeDuzenlenenKayit = null;
  function beklemedeNotAc(kayit){
    beklemedeDuzenlenenKayit = kayit;
    document.getElementById("beklemedeNotMetni").value = kayit.beklemedeNot || "";
    document.getElementById("beklemedeTermin").value = kayit.terminTarihi || "";
    document.getElementById("beklemedeNotOverlay").hidden = false;
  }
  window.beklemedeNotAc = beklemedeNotAc;
  // TAŞINDI (08.10.2026, Abdullah'ın isteğiyle): "Beklemede olarak işaretle"
  // artık İşlemler sayfasında DEĞİL, "Bilgi Düzenle" menüsünde.
  document.getElementById("btnMenuBeklemede").onclick = function(){
    document.getElementById("duzenleMenuOverlay").hidden = true;
    if(!sonCizilenKayit) return;
    beklemedeNotAc(sonCizilenKayit);
  };
  document.getElementById("btnBeklemedeNotKaydet").onclick = function(){
    if(!beklemedeDuzenlenenKayit) return;
    var metin = document.getElementById("beklemedeNotMetni").value.trim();
    var btn = document.getElementById("btnBeklemedeNotKaydet");
    btn.disabled = true; btn.textContent = "Kaydediliyor...";
    ReportsData.kaydiAlanGuncelle(beklemedeDuzenlenenKayit.tip, beklemedeDuzenlenenKayit.ts, {durum:"beklemede", beklemedeNot: metin, terminTarihi: document.getElementById("beklemedeTermin").value || null}, function(basarili, err){
      btn.disabled = false; btn.textContent = "Kaydet";
      if(!basarili){ hataGoster("Kaydedilemedi: " + (err && err.message)); return; }
      document.getElementById("beklemedeNotOverlay").hidden = true;
      denemeCiz();
    });
  };
  // ---- AÇIK PENCEREYİ KAPAT (08.11.2026, Abdullah onayı): alttaki Kapat/Vazgeç
  // tuşları kalktı. Kapatma = üst bardaki ✕ (açık pencere/liste varsa önce onu
  // kapatır) veya pencerenin dışına dokunmak. Kaydet = üst bardaki mor Kaydet
  // (ust-bar-eylem.js, açık pencerenin Kaydet'ini tetikler).
  var DUZENLE_PENCERELERI = ["duzenleMenuOverlay","yetkiliSecOverlay","adresDuzenleOverlay","notDuzenleOverlay","beklemedeNotOverlay","duzenleOverlay"];
  var ACILIR_ZEMINLER = ["islemlerOverlay","ilerletSecOverlay","cikarSecOverlay"];
  window.belgeAcikPenceresiniKapat = function(){
    var kapandi = false;
    DUZENLE_PENCERELERI.forEach(function(id){
      var o = document.getElementById(id);
      if(o && !o.hidden){ o.hidden = true; kapandi = true; }
    });
    ACILIR_ZEMINLER.forEach(function(id){
      var o = document.getElementById(id);
      if(o && !o.hidden){ acilirKapat(id); kapandi = true; }
    });
    if(kapandi){ duzenlenenKayit = null; duzenlenenAdresTuru = null; beklemedeDuzenlenenKayit = null; }
    return kapandi;
  };
  DUZENLE_PENCERELERI.forEach(function(id){
    var o = document.getElementById(id);
    if(o) o.addEventListener("click", function(ev){ if(ev.target === this){ window.belgeAcikPenceresiniKapat(); } });
  });
  document.getElementById("cikarSecOverlay").addEventListener("click", function(ev){
    if(ev.target === this) acilirKapat("cikarSecOverlay");
  });
  if(window.Nav) Nav.kapaticiEkle(function(){ return window.belgeAcikPenceresiniKapat(); });

  ReportsData.arsivDegistiginde(denemeCiz);
  CustomerData.listeDegistiginde(denemeCiz);
  denemeCiz();
});
