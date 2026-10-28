/*
  belge-render.js — WG.281026.2232.1210
  ===============
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
var TIP_ETIKET_BELGE = {numune:"NUMUNE", teklif:"F. TEKLİFİ", proforma:"PROFORMA", siparis:"SİPARİŞ"};
var KOD_ONEK_BELGE = {numune:"NM", teklif:"FT", proforma:"PF", siparis:"SP"};
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
  beklemede: {ikon:"⏳", ad:"STOK BEKLİYOR", renk:"#5b3c1e", bg:"#e9d9c3"}
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
    var siparisPaneliHtml = "<div class='belge-musteri-baslik tip-" + (kayit.tip||"siparis") + "'>"
      + "<div class='bmb-sol'><span class='bmb-tip'>" + (TIP_ETIKET_BELGE[kayit.tip]||"SİPARİŞ") + "</span>"
      + (bmbAltMetin ? "<span class='bmb-alt'>" + bmbAltMetin + "</span>" : "")
      + (bmbKodMetin ? "<span class='bmb-kod'>" + bmbKodMetin + "</span>" : "")
      + "</div></div>";
    var musteriBlokHtml = "<div class='belge-musteri-govde'>"
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
      + HareketTablo.cariKutulariHtml({ad: kayit.musteri, sehir: sehir, telefon: (musteri&&musteri.telefon)||"", eposta: (musteri&&musteri.eposta)||"", notlar: (musteri&&musteri.notlar)||[], not: (musteri&&musteri.not)||""}, vade, faturaTuru, kargo, faturaAdr, teslimatAdr, yetkililer, false, true)
      + "</div>";

    var kurIcHtml = kayit.kur
      ? "<span class='belge-gt-kur-ic" + (kayit.kurManuel ? " belge-gt-kur-ic--manuel" : "") + "'><span class='belge-gt-kur-etiket'>" + (kayit.kurManuel ? "✏️ " : "") + "Bu işlem kuru</span><br><span class='belge-gt-kur-deger'>" + fmt(kayit.kur) + " EURO</span></span>"
      : "";

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
    var html = "<div class='belge-kart belge-kart--cari-ust tip-" + (kayit.tip||"siparis") + (sorunluMu?" belge-kutu--sorunlu":"") + "'>"
      + durumRozetHtml
      + musteriBlokHtml
      + "</div>"
      + "<div class='belge-kart tip-" + (kayit.tip||"siparis") + "'>"
      + siparisPaneliHtml
      + "</div>"
      + "<div class='belge-kart belge-kart--urun-cerceveli'>"
      + satirlarHtml
      + bakiyeBlokHtml
      + "</div>"
      + "<div class='belge-gt-kutu'><div class='belge-gt-satir'>"
      + kurIcHtml
      + "<span class='belge-gt-etiket-deger-grup'><span class='belge-gt-etiket'>GENEL TOPLAM</span><span class='belge-gt-deger'>" + fmt(netEuro) + " EURO<span class='belge-gt-deger-alt'>≈ " + Math.round(netEuro*(kayit.kur||0)).toLocaleString("tr-TR") + " TL</span></span></span>"
      + "</div></div>"
      + "<div class='belge-prim-serit'>"
      + "<span class='belge-prim-etiket'>PRİM</span><span class='belge-prim-deger'>" + (toplamPrim<0?"Prim yok":Math.round(toplamPrimTl).toLocaleString("tr-TR")+" TL") + "</span>"
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
  var sonuc = {temas:0, gecmis:0, gorev:0, fatura:0, urun:0, bekleyen:0};
  try{ sonuc.temas = (m.ziyaretGecmisi||[]).length; }catch(e){}
  try{
    if(typeof ReportsData !== "undefined"){
      var tumu = ReportsData.sonIslemler();
      sonuc.gecmis = tumu.filter(function(k){ return bhpAyniMusteriKaydiMi(k.musteri, k.musteriId, m.ad, m.id); }).length;
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
        return bhpAyniMusteriKaydiMi(s.musteri, s.musteriId, m.ad, m.id);
      }).length;
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
var bhpAbkModulYukleniyor = false;
var bhpAbkModulBekleyenler = [];
function bhpAcikBelgeKontrolIleDevamEt(musteri, tip){
  if(typeof AcikBelgeKontrol !== "undefined"){ AcikBelgeKontrol.tipSeciminiBaslat(musteri, tip); return; }
  bhpAbkModulBekleyenler.push(function(){ AcikBelgeKontrol.tipSeciminiBaslat(musteri, tip); });
  if(bhpAbkModulYukleniyor) return;
  bhpAbkModulYukleniyor = true;
  var s = document.createElement("script");
  s.src = "acik-belge-kontrol.js?v=WG.271026.2024.1107";
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
    + "<button type='button' class='cm-tipmenu-oge cm-tipmenu-oge--numune' data-tip='numune'><span class='cm-tipmenu-oge-ikon'>🧪</span><span>Numune</span></button>"
    + "<button type='button' class='cm-tipmenu-oge cm-tipmenu-oge--teklif' data-tip='teklif'><span class='cm-tipmenu-oge-ikon'>💬</span><span>Fiyat Teklifi</span></button>"
    + "<button type='button' class='cm-tipmenu-oge cm-tipmenu-oge--proforma' data-tip='proforma'><span class='cm-tipmenu-oge-ikon'>🧾</span><span>Proforma Fatura</span></button>"
    + "<button type='button' class='cm-tipmenu-oge cm-tipmenu-oge--siparis' data-tip='siparis'><span class='cm-tipmenu-oge-ikon'>📦</span><span>Sipariş</span></button>";
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

// menu-cekmece.js mcMiniSonucKonumla ile AYNI ekran-kenarı taşma formülü.
var bhpSonAnkorEl = null;
function bhpKonumla(ankorEl, panel){
  var rect = ankorEl.getBoundingClientRect();
  var panelGenislik = panel.offsetWidth;
  var sol = rect.left;
  if(sol + panelGenislik > window.innerWidth - 8){ sol = window.innerWidth - panelGenislik - 8; }
  if(sol < 8) sol = 8;
  var ust = rect.bottom + 6;
  var panelYukseklik = panel.offsetHeight;
  if(ust + panelYukseklik > window.innerHeight - 8){ ust = window.innerHeight - panelYukseklik - 8; }
  if(ust < 8) ust = 8;
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
      document.getElementById("bhpTipMenu").hidden = false;
      bhpTipMenuKonumla();
      break;
    case "fatura": window.location.href = "customer-detail.html?ac=fatura"; break;
    case "gecmis": window.location.href = "gecmis.html"; break;
    case "gorev": window.location.href = "customer-detail.html?ac=gorev"; break;
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

var TIP_ETIKET_UZUN = {numune:"Numune", teklif:"Fiyat Teklifi", proforma:"Proforma Fatura", siparis:"Sipariş"};
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
    + "<div class='belge-gecmis-alt'>" + htmlEsc(kayit.musteri) + " — bu iş için " + zincir.length + " belge bulundu</div>";
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
      + "<span class='belge-gecmis-baslik2' style='color:" + rozetRenk.yazi + ";'>" + (TIP_ETIKET_UZUN[adim.tip]||"") + "</span>"
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
function akilliGeriBagla(yedekSayfa){
  var btn = document.getElementById("btnGeriAkilli");
  if(!btn) return;
  btn.onclick = function(){
    if(window.history.length > 1) window.history.back();
    else window.location.href = yedekSayfa;
  };
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
      + "<input type='text' class='duzenle-urun-arama-input' data-arama-i='" + i + "' placeholder='Ürün adı veya kod ara...'>"
      + "<div class='duzenle-urun-arama-sonuc' id='duzenleUrunAramaSonuc-" + i + "'></div>"
      + "</div>"
      + "<div class='duzenle-alan-grid'>"
      + "<div class='duzenle-alan'><label class='duzenle-etiket'>Liste Fiyat</label><input type='number' step='0.01' data-alan='listeFiyat' data-i='" + i + "' value='" + (u.listeFiyat||0) + "'></div>"
      + "<div class='duzenle-alan'><label class='duzenle-etiket'>İskonto %</label><input type='number' step='0.1' data-alan='iskonto' data-i='" + i + "' value='" + (u.iskonto||0) + "'></div>"
      + "<div class='duzenle-alan'><label class='duzenle-etiket'>Adet</label><input type='number' step='1' min='0' data-alan='adet' data-i='" + i + "' value='" + (u.adet != null ? u.adet : 1) + "'></div>"
      + "<div class='duzenle-alan'><label class='duzenle-etiket'>Dip Fiyat</label><input type='number' step='0.01' data-alan='dipFiyat' data-i='" + i + "' value='" + (u.dipFiyat||0) + "'></div>"
      + "</div>"
      + bakiyeAlaniHtml(u, i)
      + "</div>";
  }).join("");

  kapsayici.querySelectorAll(".duzenle-bakiye-link").forEach(function(link){
    link.onclick = function(){
      var i = this.getAttribute("data-bakiye-i");
      bakiyeModuGuncelle(i); // panel açılırken Adet'in O ANKİ değerine göre mod (yok/kısmi) belirlenir
      document.getElementById("duzenleBakiyeLink-" + i).hidden = true;
      document.getElementById("duzenleBakiyeAlan-" + i).hidden = false;
      document.getElementById("duzenleBakiyeAdet-" + i).focus();
    };
  });
  kapsayici.querySelectorAll(".duzenle-bakiye-kapat").forEach(function(btn){
    btn.onclick = function(){
      var i = this.getAttribute("data-bakiye-i");
      document.getElementById("duzenleBakiyeAdet-" + i).value = "";
      document.getElementById("duzenleBakiyeNot-" + i).value = "";
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
      yeniUrunler.push({
        ad: degisen ? degisen.ad : u.ad,
        berta: degisen ? degisen.berta : u.berta,
        abas: degisen ? degisen.abas : u.abas,
        listeFiyat: listeFiyat, iskonto: iskonto, adet: adet, dipFiyat: dipFiyat,
        iskBirim: iskontoluFiyat,
        toplamEuro: iskontoluFiyat * adet,
        bakiyeAdet: bakiyeAdet, bakiyeNot: bakiyeNot
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
  document.getElementById("btnBelgeKapat").onclick = function(){
    if(window.history.length > 1) window.history.back();
    else window.location.href = "reports.html";
  };
  document.getElementById("btnIslemlerAc").onclick = function(){ document.getElementById("islemlerOverlay").hidden = false; };
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
      baslik: sonCizilenKayit.musteri || "-",
      altKod: sonCizilenKayit.kod || "",
      kisaKod: onek,
      renkBg: renk.bg,
      renkYazi: renk.yazi,
      url: "belge-onizleme.html",
      resumeKey: "weiconv2_goruntulenen_belge"
    });
    if(!sonuc.basarili){ hataGoster(sonuc.mesaj); return; }
    if(window.history.length > 1) window.history.back();
    else window.location.href = "reports.html";
  };
  document.getElementById("msVazgec").onclick = function(){ document.getElementById("islemlerOverlay").hidden = true; };
  document.getElementById("islemlerOverlay").addEventListener("click", function(ev){
    if(ev.target === this) this.hidden = true;
  });

  // "Yazdır" düğmesi KALDIRILDI (18.10.2026, Abdullah'ın isteğiyle) —
  // Ayrıntı sheet'inden çıkarıldı. TeklifPdf/teklif-pdf.js modülüne
  // dokunulmadı (başka bir yerde kullanılıyor olabilir).
  document.getElementById("msSil").onclick = function(){
    document.getElementById("islemlerOverlay").hidden = true;
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
        if(window.history.length > 1) window.history.back();
        else window.location.href = "reports.html";
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

    document.getElementById("msIlerlet").hidden = false;
    document.getElementById("btnMenuBeklemede").hidden = !!kayit.durum;
    return true;
  }

  document.getElementById("msDuzenle").onclick = function(){
    if(!sonCizilenKayit) return;
    document.getElementById("islemlerOverlay").hidden = true;
    document.getElementById("duzenleMenuOverlay").hidden = false;
  };
  document.getElementById("btnDuzenleMenuKapat").onclick = function(){ document.getElementById("duzenleMenuOverlay").hidden = true; };
  document.getElementById("btnMenuUrunler").onclick = function(){
    document.getElementById("duzenleMenuOverlay").hidden = true;
    duzenlemeAc(sonCizilenKayit);
  };
  document.getElementById("btnDuzenleVazgec").onclick = function(){ document.getElementById("duzenleOverlay").hidden = true; duzenlenenKayit = null; };
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
  document.getElementById("btnYetkiliSecVazgec").onclick = function(){ document.getElementById("yetkiliSecOverlay").hidden = true; };
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
  document.getElementById("btnAdresDuzenleVazgec").onclick = function(){ document.getElementById("adresDuzenleOverlay").hidden = true; duzenlenenAdresTuru = null; };
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
  document.getElementById("btnNotDuzenleVazgec").onclick = function(){ document.getElementById("notDuzenleOverlay").hidden = true; };
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
  var TIP_ETIKET_ILERLET = {numune:"Numune", teklif:"Fiyat Teklifi", proforma:"Proforma Fatura", siparis:"Sipariş"};
  var ilerletSeciliTip = null;
  document.getElementById("msIlerlet").onclick = function(){
    document.getElementById("islemlerOverlay").hidden = true;
    try{
      if(!sonCizilenKayit) return;
      var secenekler = ReportsData.SONRAKI_ASAMALAR[sonCizilenKayit.tip] || [];
      ilerletSeciliTip = null;
      document.getElementById("ilerletDevamSatiri").hidden = true;
      var liste = document.getElementById("ilerletSecenekListesi");
      liste.innerHTML = secenekler.map(function(tip){
        return "<button type='button' class='duzenle-menu-secenek' data-tip='" + tip + "'>" + (TIP_ETIKET_ILERLET[tip]||tip) + "</button>";
      }).join("");
      liste.querySelectorAll("[data-tip]").forEach(function(btn){
        btn.onclick = function(){
          ilerletSeciliTip = this.getAttribute("data-tip");
          liste.querySelectorAll("[data-tip]").forEach(function(b){ b.classList.remove("duzenle-menu-secenek--secili"); });
          this.classList.add("duzenle-menu-secenek--secili");
          document.getElementById("btnIlerletDevam").textContent = (TIP_ETIKET_ILERLET[ilerletSeciliTip]||ilerletSeciliTip) + " seçeneğine devam et";
          document.getElementById("ilerletDevamSatiri").hidden = false;
        };
      });
      document.getElementById("ilerletSecOverlay").hidden = false;
    }catch(e){ hataGoster("İlerlet popup'ı açılamadı: " + e.message); }
  };
  document.getElementById("btnIlerletVazgec").onclick = function(){ document.getElementById("ilerletSecOverlay").hidden = true; };
  document.getElementById("btnIlerletDevam").onclick = function(){
    try{
      if(!sonCizilenKayit || !ilerletSeciliTip) return;
      document.getElementById("ilerletSecOverlay").hidden = true;
      ReportsData.revizeBaslat(sonCizilenKayit, ilerletSeciliTip);
    }catch(e){ hataGoster("İlerletilemedi: " + e.message); }
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
  document.getElementById("btnBeklemedeNotVazgec").onclick = function(){ document.getElementById("beklemedeNotOverlay").hidden = true; };
  document.getElementById("btnBeklemedeNotKaydet").onclick = function(){
    if(!beklemedeDuzenlenenKayit) return;
    var metin = document.getElementById("beklemedeNotMetni").value.trim();
    var btn = document.getElementById("btnBeklemedeNotKaydet");
    btn.disabled = true; btn.textContent = "Kaydediliyor...";
    ReportsData.kaydiAlanGuncelle(beklemedeDuzenlenenKayit.tip, beklemedeDuzenlenenKayit.ts, {durum:"beklemede", beklemedeNot: metin}, function(basarili, err){
      btn.disabled = false; btn.textContent = "Kaydet";
      if(!basarili){ hataGoster("Kaydedilemedi: " + (err && err.message)); return; }
      document.getElementById("beklemedeNotOverlay").hidden = true;
      denemeCiz();
    });
  };
  document.getElementById("btnBeklemedeNotSil").onclick = function(){
    if(!beklemedeDuzenlenenKayit) return;
    if(!confirm("Stok bekleme durumu kaldırılsın mı? Kayıt tekrar normal şekilde toplamlara dahil olacak.")) return;
    var btn = document.getElementById("btnBeklemedeNotSil");
    btn.disabled = true;
    ReportsData.kaydiAlanGuncelle(beklemedeDuzenlenenKayit.tip, beklemedeDuzenlenenKayit.ts, {durum:null, beklemedeNot:null}, function(basarili, err){
      btn.disabled = false;
      if(!basarili){ hataGoster("Kaldırılamadı: " + (err && err.message)); return; }
      document.getElementById("beklemedeNotOverlay").hidden = true;
      denemeCiz();
    });
  };

  ReportsData.arsivDegistiginde(denemeCiz);
  CustomerData.listeDegistiginde(denemeCiz);
  denemeCiz();
});
