/*
  send-render.js — TKP.08.11.26-14:14.1507
  GÜNCELLEME (04.11.2026, Abdullah onayı): İletişim artık Gönder tuşunun altında açılan
  tek sıra liste (iletisimPaneliKonumla/iletisimAcilirAc/Kapat, altKutuKonumla).
  27.10.2026 PERFORMANS KAZANIMI: html2canvas artık sayfa açılışında değil,
  görsel oluşturma/kopyalama özelliklerinden biri GERÇEKTEN kullanıldığında
  ilk kez indiriliyor (bkz. html2canvasYukle()). Davranış/çıktı değişmedi.
  ==============
  GÜNCELLEME (26.10.2026, Abdullah onayı — mockup üzerinden: "Okey tamam
  süper onaylıyorum kodlayalım"): hem WhatsApp hem Mail'e giden görselde
  (ve Gönder ekranının canlı önizlemesinde) tür/tarih paneli (SİPARİŞ/
  F.TEKLİFİ/... + tarih) artık EN ÜSTTE değil — müşteri bilgisi bloğunun
  HEMEN ALTINA, ürün tablosunun HEMEN ÜSTÜNE taşındı. Aralarındaki boşluk
  DEĞİŞMEDİ (.belge-kart{margin-bottom:1mm} / .belge-kart-ayrac — zaten
  1mm'di). Bkz. tamOnizlemeHtmlOlustur() ve belgeGorselHtmlOlustur().
  ==============
  ARTIK SADECE gönderme paneli — kaydetme işi cart.html'e taşındı. Sayfa
  açılışında "weiconv2_son_kaydedilen_belge" localStorage anahtarını okur
  (cart.html'in az önce yazdığı kayıt bağlamı); bu yoksa cart.html'e geri
  yönlendirir. "Formu Görüntüle" ile tam önizleme + "Geri" ile Sepet'e
  dönüp düzeltme imkânı sunar (aynı gün+müşteri+ürün seti eşleştiğinde
  SendData.kaydet zaten revize eder, yeni kayıt açmaz).
  26.10.2026 (Abdullah onayı): "?ac=iletisim" ile açılınca İletişim sheet'i
  (Mail/WhatsApp/Tablo/PDF) otomatik açılır — cart.html'deki tek tuş
  "📨 Önizleme İletişim" artık buraya böyle geliyor. Mail seçimi de
  WhatsApp'la simetrik hale getirildi: ikisi de önce kendi önizlemesini
  gösterir, altındaki "✓ Gönder" ile devam eder.
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

// BİLGİ BALONU (07.10.2026, Abdullah'ın isteğiyle) — "Konu panoya
// kopyalandı" güvenlik ağı eskiden sessizce çalışıyordu, kullanıcı bunun
// farkında olmuyordu. Mail Gönder'e her basıldığında kısa süreliğine
// gösterilir (hataGoster ile AYNI konum/stil, sadece renk mavi/bilgi).
function bilgiGoster(mesaj){
  var kutu = document.createElement("div");
  kutu.textContent = "✓ " + mesaj;
  kutu.style.cssText = "position:fixed;top:8px;left:8px;right:8px;background:#0c5fb0;color:#fff;padding:10px;border-radius:8px;font-size:13px;z-index:99999;text-align:center;";
  document.body.appendChild(kutu);
  setTimeout(function(){ kutu.remove(); }, 3000);
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

var seciliAdresler = {};
var gonderBaglam = null;
var sonKaydedilenBelge = null;

function adresleriBelirle(musteri){
  seciliAdresler = {};
  // İŞLEM İÇİN SEÇİM (WG.090926.196): Cari Kart'ta işaretlenen fatura/
  // teslimat adresi indeksi varsa onu kullan; yoksa (kart üzerinden
  // gelinmediyse) ilk kayda düş — eski davranış.
  var secim = {};
  try{ secim = JSON.parse(localStorage.getItem("weiconv2_secili_iletisim")||"{}"); }catch(e){}
  if(musteri.faturaAdresleri && musteri.faturaAdresleri.length){
    var fi = (secim.fatura!=null && musteri.faturaAdresleri[secim.fatura]) ? secim.fatura : 0;
    seciliAdresler.faturaAdresi = musteri.faturaAdresleri[fi];
  } else if(musteri.acikAdres && musteri.acikAdres.trim()){
    // Geriye dönük kural: ayrı bir fatura adresi hiç girilmemişse, müşteri
    // eklenirken girilen Açık Adres fatura adresi olarak kullanılır — eski
    // müşteri kayıtları için de "Girilmemiş" görünmesin diye.
    seciliAdresler.faturaAdresi = {etiket:"Fatura Adresi", adres: musteri.acikAdres.trim()};
  }
  if(musteri.teslimatAdresleri && musteri.teslimatAdresleri.length){
    var ti = (secim.teslimat!=null && musteri.teslimatAdresleri[secim.teslimat]) ? secim.teslimat : 0;
    seciliAdresler.teslimatAdresi = musteri.teslimatAdresleri[ti];
  }
}

// Mesaj metni TAMAMEN MANUEL (WG.210926.1531.584): Mesaj Ayarları'nda
// yazılan metin olduğu gibi döner — otomatik "Merhaba,", müşteri notu ekleme
// yok. TEK İSTİSNA (WG.210926.1603.585): metindeki HAREKET kelimesi işleme
// göre SİPARİŞ/FİYAT TEKLİFİ/PROFORMA FATURA/NUMUNE olur (bkz. mesaj-data.js).
// Mesaj metni TAMAMEN MANUEL: Mesaj Ayarları'nda yazılan metin olduğu gibi
// döner — otomatik "Merhaba," ekleme yok. HAREKET/BELGE yer tutucuları,
// gönderilen belge türüne göre değişir (bkz. mesaj-data.js — NUMUNE de
// 28.09.2026'dan itibaren aynı ortak "mail" şablonunu kullanıyor).
function mesajMetniOlustur(musteri, sepet, tip, kanal){
  return MesajData.uygula(MesajData.oku(kanal === "whatsapp" ? "whatsapp" : "mail", tip), tip);
}

// Gönder ekranı yeniden düzeni (WG.210926.1512.583): 1) Cari Bilgi üst şeridi
// artık SİPARİŞ/WEICON etiketi yerine ortalanmış "<TÜR> FORMU" başlığı;
// 2) VADE/FATURA/KARGO üç kutu yerine tek satır (etiket değerin başında).
// Yeni sınıflar SADECE bu dosyada kullanılır — belge-render.js (Belge
// Önizleme) eski .belge-kosul-grid / .belge-musteri-baslik yapısını korur.
// TEK TASARIM — KESİN KURAL (19.10.2026, Abdullah onayı): "FORMU" eki
// kaldırıldı — Belge Önizleme'nin TIP_ETIKET_BELGE'si ile BİREBİR aynı
// kelimeler (tek kelime haznesi, iki yerde farklı yazı YOK).
// KISALTMA — KESİN KURAL (19.10.2026, Abdullah onayı — "%20 büyüt" turu):
// TIP_ETIKET_BELGE (belge-render.js) ile BİREBİR aynı kısaltmalar.
var FORM_BASLIK = TipEtiket.kisa; // 08.11.2026: tek kaynak (tip-etiketleri.js)
// TÜRE ÖZEL RENK (12.10.2026, Abdullah onayı): "tip-<tip>" sınıfı eklendi —
// gerçek renk belge-style.css'teki .belge-form-baslik.tip-* kurallarından
// geliyor, bu şerit artık belgenin tek renkli göstergesi.
// TEK TASARIM (18.10.2026, Abdullah onayı): bu kutu artık Belge Önizleme'nin
// ".belge-musteri-baslik" kutusuyla BİREBİR aynı — metin solda, WEICON
// rozeti sağda (bkz. belge-style.css .belge-form-baslik).
// GÜNCELLEME (19.10.2026, Abdullah onayı — "7 fotoğraf" turu): WEICON rozeti
// kaldırıldı — altta ayrı bir kutuda tekrar gösterilen "FİYAT TEKLİFİ ·
// tarih" şeridi de kaldırıldı (çift gösterimdi), o bilgi artık WEICON'un
// olduğu yere, bu başlığın YANINA taşındı (sagMetin — Gönder'in canlı
// önizlemesinde gerçek işlem kodu, giden görselde sadece tarih; bkz.
// çağıran fonksiyonlar).
function formBaslikHtml(tip, tarihMetni, kodMetni){
  return "<div class='belge-form-baslik tip-" + (tip||"siparis") + "'><span class='belge-form-baslik-etiket'>" + (FORM_BASLIK[tip]||TipEtiket.kisa.siparis) + "</span>"
    + (tarihMetni ? "<span class='belge-form-baslik-tarih'>" + htmlEsc(tarihMetni) + "</span>" : "")
    + (kodMetni ? "<span class='belge-form-baslik-kod'>" + htmlEsc(kodMetni) + "</span>" : "")
    + "</div>";
}
// VADE artık Müşteri Kartı'nda SAYI (gün) olarak tutuluyor (21.09.2026);
// burada okunaklı gösterim için "45" -> "45 gün" biçimine çevrilir. Eski
// serbest metin kayıtlarda (henüz sayıya çevrilmemiş müşteriler) olduğu
// gibi gösterilir.
function vadeGosterimMetni(v){
  var s = String(v||"").trim();
  if(s === "") return "";
  var n = parseInt(s, 10);
  return (!isNaN(n) && n >= 0 && String(n) === s) ? (n + " gün") : s;
}

function kosulSatiriHtml(vade, faturaTuru, kargo){
  return "<div class='belge-kosul-satir'>"
    + "<span class='kl'>VADE :</span> " + htmlEsc(vade||"-")
    + " <span class='ks'>-</span> <span class='kl'>FATURA :</span> " + htmlEsc(faturaTuru||"-")
    + " <span class='ks'>-</span> <span class='kl'>KARGO :</span> " + htmlEsc(kargo||"-")
    + "</div>";
}
// Tek satıra sığmazsa yazı satır atlamaz, küçülür (en fazla 7px'e kadar).
function kosulSatirlariniSigdir(kok){
  try{
    var satirlar = (kok||document).querySelectorAll(".belge-kosul-satir");
    for(var i=0;i<satirlar.length;i++){
      var el = satirlar[i]; el.style.fontSize = "";
      var boyut = 11;
      while(el.scrollWidth > el.clientWidth + 1 && boyut > 7){ boyut -= 0.5; el.style.fontSize = boyut + "px"; }
    }
  }catch(e){}
}

// STANDART CARİ KART (27.09.2026, Abdullah'ın isteğiyle — minimal/kurumsal
// tasarım): Cari Bilgi sayfası, Sepet'in "Formu Görüntüle"si ve Mail/
// TEK CARİ KUTUSU (14.10.2026, Abdullah'ın isteğiyle): bu fonksiyon artık
// burada değil — Belge Önizleme (belge-render.js) de AYNI tasarımı
// kullansın diye hareket-tablo.js'e taşındı (bkz. HareketTablo.cariKutulariHtml).
// Mailde/gönderimde tek bir seçili yetkili gösterilir; program içindeki
// seçim tiki (yeşil ✓) SADECE Cari Kart'ın kendi "İşlem Yap" akışında
// görünür. Fatura/Teslimat/Yetkili seçim mantığı (adresleriBelirle/
// seciliAdresler, weiconv2_secili_iletisim) DEĞİŞMEDİ.

// Belge tipi + tarih/saat metni (27.09.2026) — hem Gönder ekranının canlı
// önizlemesi (tamOnizlemeHtmlOlustur) hem de gönderilen gerçek görsel
// (belgeGorselHtmlOlustur) AYNI biçimi kullanır. orijinalTarih verilirse
// (Geçmişten tekrar paylaşım) o kullanılır — verilmezse "şu an" hesaplanır.
function tarihSaatStr(orijinalTarih){
  if(orijinalTarih) return orijinalTarih;
  var simdi = new Date();
  var aylarKisa = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  return simdi.getDate() + " " + aylarKisa[simdi.getMonth()] + " " + simdi.getFullYear() + " " + ("0"+simdi.getHours()).slice(-2) + ":" + ("0"+simdi.getMinutes()).slice(-2);
}

function tamOnizlemeHtmlOlustur(musteri, sepet, tip, kur, kdv, kanal, kod){
  var basit = kanal === "whatsapp";
  var tarihStrOnizleme = tarihSaatStr();
  var vade = vadeGosterimMetni(musteri.vade);
  var faturaTuru = musteri.fatura || "";
  var kargo = musteri.kargo || "";
  var faturaAdr = seciliAdresler.faturaAdresi ? (seciliAdresler.faturaAdresi.adres||"") : "";
  var teslimatAdr = seciliAdresler.teslimatAdresi ? (seciliAdresler.teslimatAdresi.adres||"") : "";
  // İŞLEM İÇİN SEÇİM (WG.090926.196): tabloda/mailde artık TÜM yetkililer
  // değil, Cari Kart'ta işaretlenen TEK yetkili gösterilir.
  var yetkililer = musteri.iletisimler || [];
  var yetkiliSecim = {};
  try{ yetkiliSecim = JSON.parse(localStorage.getItem("weiconv2_secili_iletisim")||"{}"); }catch(e){}
  var yki = (yetkiliSecim.yetkili!=null && yetkililer[yetkiliSecim.yetkili]) ? yetkiliSecim.yetkili : 0;
  var seciliYetkili = yetkililer[yki];
  var yetkiliBilgiHtml = seciliYetkili ? HareketTablo.yetkiliSatiriHtml(seciliYetkili.isim, seciliYetkili.telefon, seciliYetkili.eposta) : "";
  var tToplamEuro = 0;
  (sepet||[]).forEach(function(u){ var h = CartData.hesapla(u, kur, kdv); if(h && h.toplamEuro!=null) tToplamEuro += h.toplamEuro; });

  var musteriBlokHtml;
  var html;
  // SIRA DEĞİŞİKLİĞİ (26.10.2026, Abdullah onayı — mockup onaylı): tür/tarih
  // paneli (formBaslikHtml) artık müşteri bilgisinin ÜSTÜNDE değil, ALTINDA
  // — ürün tablosunun hemen üstüne taşındı.
  if(basit){
    musteriBlokHtml =
      "<div class='belge-musteri-ad belge-musteri-ad--sade'>" + htmlEsc(musteri.ad) + "</div>"
      + (musteri.sehir ? "<div class='belge-musteri-sehir'>" + htmlEsc(musteri.sehir) + "</div>" : "");
    html = "<div class='belge-kart'>"
      + "<div class='belge-musteri-govde'>"
      + musteriBlokHtml
      + "</div>"
      + formBaslikHtml(tip, tarihStrOnizleme, kod)
      + "</div><div class='belge-kart-ayrac'></div>"
      + "<div class='belge-kart'>";
  } else {
    // BİRLEŞİK CARİ KUTUSU (27.09.2026): artık Cari Bilgi sayfasıyla aynı
    // renkli-kutu tasarımı — bkz. cariKutulariHtml().
    // TESLİMAT ADRESİ BOŞSA GİZLE (28.10.2026, Abdullah onayı — "her yerde"
    // turu, mockup üzerinden onaylandı): son parametre (true) teslimat
    // adresi girilmemişse bu canlı önizlemede de bloğu hiç göstermez; cari
    // kodu (koduGizle=false) eskisi gibi görünmeye devam eder.
    musteriBlokHtml = HareketTablo.cariKutulariHtml(musteri, vade, faturaTuru, kargo, faturaAdr, teslimatAdr, seciliYetkili ? [seciliYetkili] : [], false, true);
    html = musteriBlokHtml
      + "<div class='belge-kart-ayrac'></div>"
      + "<div class='belge-kart'>" + formBaslikHtml(tip, tarihStrOnizleme, kod) + "</div>"
      + "<div class='belge-kart-ayrac'></div>"
      + "<div class='belge-kart belge-kart--urun-cerceveli'>";
  }

  // TEK RENK KURALI (12.10.2026, Abdullah onayı): üründe TÜR · TARİH SAAT
  // etiketi artık tabloya yapışık olarak TEKRAR gösterilmiyor — üstteki
  // FORM_BASLIK'ta zaten bir kere var (GÜNCELLEME 19.10.2026: gerçek işlem
  // kodu artık ayrı bir kutuda değil, bu başlığın YANINDA — bkz.
  // formBaslikHtml). Bu yüzden grupHtml'e artık etiket geçilmiyor.
  var grupSonucHtml = HareketTablo.grupHtml({
    urunler: sepet,
    hesapla: function(u){ return CartData.hesapla(u, kur, kdv); },
    genelToplam: tToplamEuro,
    kanal: kanal,
    primGizli: true,
    kur: kur
  });
  // "7. BELGE" TASARIMI (14.10.2026, Abdullah onayı): GENEL TOPLAM artık
  // tablo kartına yapışık değil, bağımsız/kendi köşeleri yuvarlak bir kutu
  // (bkz. belge-style.css .belge-gt-kutu). grupHtml() tablo+GENEL TOPLAM'ı
  // TEK bir string olarak döndürüyor (Sepet'te de kullanılan paylaşılan
  // fonksiyon, DEĞİŞTİRİLMEDİ) — burada ".belge-gt-kutu" başlangıcından
  // ikiye bölünüyor: tablo kısmı ÜSTTEKİ ".belge-kart" İÇİNDE kapanıyor,
  // GENEL TOPLAM kartın DIŞINDA bağımsız kalıyor (box-in-box olmasın diye).
  var gtIndex = grupSonucHtml.indexOf("<div class='belge-gt-kutu");
  var tabloKismiHtml = gtIndex === -1 ? grupSonucHtml : grupSonucHtml.slice(0, gtIndex);
  var gtKismiHtml = gtIndex === -1 ? "" : grupSonucHtml.slice(gtIndex);
  html += tabloKismiHtml + "</div>" + gtKismiHtml;
  return html;
}

// Mail/WhatsApp metin kutusu artık sabit yükseklikte değil — içeriği
// kadar büyüyüp küçülüyor (27.09.2026, Abdullah'ın isteğiyle).
function metinKutusuBoyutlandir(el){
  if(!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

function gonderKutusunuGoster(musteri, sepet, tip, kur, kdv, kod){
  try{
    gonderBaglam = {musteri:musteri, sepet:sepet, tip:tip, kur:kur, kdv:kdv, kod:kod};
    var metinKutusu = document.getElementById("gonderMetin");
    metinKutusu.value = mesajMetniOlustur(musteri, sepet, tip, null);
    metinKutusuBoyutlandir(metinKutusu);
    // Başka cihazda (S22/iPhone/iPad) Mesaj Ayarları'nda yapılan son kayıt
    // varsa getir — ama bu ekranda elle yazmaya başlanmışsa metne dokunma.
    var elleDegisti = false;
    metinKutusu.addEventListener("input", function(){ elleDegisti = true; metinKutusuBoyutlandir(this); });
    MesajData.tazele(function(){
      if(!elleDegisti){ metinKutusu.value = mesajMetniOlustur(musteri, sepet, tip, null); metinKutusuBoyutlandir(metinKutusu); }
    });

    // İŞLEM İÇİN SEÇİM (WG.090926.196): Yetkili kişi artık burada
    // seçilmiyor — Cari Kart ekranında işaretlenen kişi kullanılır.
    // Kart üzerinden gelinmediyse (seçim kaydı yoksa) ilk kayda düşülür.
    var kisiler = musteri.iletisimler || [];
    var secim = {};
    try{ secim = JSON.parse(localStorage.getItem("weiconv2_secili_iletisim")||"{}"); }catch(e){}
    var ki = (secim.yetkili!=null && kisiler[secim.yetkili]) ? secim.yetkili : 0;
    kisiAlanlariniDoldur(kisiler[ki] || {});
  }catch(e){ hataGoster("Gönderim alanı hazırlanamadı: " + e.message); }
}

function kisiAlanlariniDoldur(kisi){
  document.getElementById("gonderTelefon").value = (kisi && kisi.telefon) || "";
  document.getElementById("gonderEposta").value = (kisi && kisi.eposta) || "";
}


var TIP_ETIKET_BELGE_G = TipEtiket.kisa;

function fmtG2(n){
  return (n||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2});
}
// KURAL (23.09.2026): 1000 ve üzeri sayılarda (Türkçe binler ayracı "."
// olduğu için sayının içinde "." varsa) otomatik olarak biraz küçük
// yazılır — büyük tutarlar sütun çizgisine yapışmasın/taşmasın diye.
function sayiDivHtml(sayiStr, birim){
  var buyukMu = String(sayiStr).indexOf(".") > -1;
  return "<div class='belge-td-sayi" + (buyukMu ? " belge-td-sayi--buyuk" : "") + "'>" + sayiStr + "</div><div class='belge-td-birim'>" + birim + "</div>";
}

function belgeGorselHtmlOlustur(musteri, sepet, tip, kur, kdv, kod, kanal, orijinalTarih){
  var basit = kanal === "whatsapp"; // WhatsApp'a giden görsel: ürün tablosunda LİSTE/İSK/SIRA yok (Cari Bilgi her iki kanalda da TAM gösterilir)
  // TEK TABLO (14.10.2026, Abdullah'ın isteğiyle — "tüm tabloları aynı tablo
  // yap"): bu satırlar eskiden burada AYRI/kopya bir döngüyle elle
  // üretiliyordu (farklı sütun genişlikleri, "AD" yerine "ADET" gibi küçük
  // farklarla) — artık Sepet/Gönder/Belge Önizleme ile BİREBİR AYNI, tek
  // paylaşılan fonksiyon (HareketTablo.satirlarHtml) çağrılıyor. primGizli
  // her zaman true (giden görselde PRİM sütunu hiç yok); kur BİLEREK null
  // geçiliyor ki NET altında "≈ TL" satırı eklenmesin (gönderilen görselde
  // sadece EURO tutarları kalır — önceki davranış korunuyor).
  var hesaplaFn = function(u){ return CartData.hesapla(u, kur, kdv); };
  // TEK TABLO (19.10.2026, Abdullah onayı — "cari kart ve ürün bilgi
  // tablosu tek tasarım, tek yerden kontrol" isteği): thead+tbody üretimi
  // artık elle değil, hareket-tablo.js'teki paylaşılan HareketTablo.
  // urunTablosuHtml() üzerinden — "belge-urun-tablo--giden" (table-layout:
  // fixed) sınıfı ekSinif parametresiyle korunuyor, sütun başlık/genişlik
  // çıktısı değişmedi.
  var urunTablosuHtmlStr = HareketTablo.urunTablosuHtml(sepet, hesaplaFn, "", basit, true, null, "belge-urun-tablo--giden");
  var netEuro = sepet.reduce(function(s, u){ var h = hesaplaFn(u); return s + (h.toplamEuro||0); }, 0);

  // Yeni kaydedilen bir belge gönderiliyorsa "şu an" doğrudur (kayıt az
  // önce oluşturuldu). Ama Geçmişten "Gönder" ile tekrar paylaşılıyorsa,
  // orijinalTarih (kaydın kendi tarihi) gönderilir — görsel her seferinde
  // "şu an" göstermez, kaydın GERÇEK tarih/saatini gösterir.
  var tarihStr = tarihSaatStr(orijinalTarih);

  var vade = vadeGosterimMetni(musteri.vade);
  var faturaTuru = musteri.fatura || "";
  var kargo = musteri.kargo || "";
  var faturaAdr = seciliAdresler.faturaAdresi ? (seciliAdresler.faturaAdresi.adres||"") : "";
  var teslimatAdr = seciliAdresler.teslimatAdresi ? (seciliAdresler.teslimatAdresi.adres||"") : "";
  // İŞLEM İÇİN SEÇİM (WG.090926.196): tabloda/mailde artık TÜM yetkililer
  // değil, Cari Kart'ta işaretlenen TEK yetkili gösterilir.
  var yetkililer = musteri.iletisimler || [];
  var yetkiliSecim = {};
  try{ yetkiliSecim = JSON.parse(localStorage.getItem("weiconv2_secili_iletisim")||"{}"); }catch(e){}
  var yki = (yetkiliSecim.yetkili!=null && yetkililer[yetkiliSecim.yetkili]) ? yetkiliSecim.yetkili : 0;
  var seciliYetkili = yetkililer[yki];
  var yetkiliBilgiHtml = seciliYetkili ? HareketTablo.yetkiliSatiriHtml(seciliYetkili.isim, seciliYetkili.telefon, seciliYetkili.eposta) : "";

  // Giden görselde dahili işlem kısa kodu (FT001... gibi) GÖSTERİLMEZ —
  // sadece tarih. HATA DÜZELTME (20.10.2026, Abdullah'ın bildirdiği hata —
  // WhatsApp ekran görüntüsüyle doğrulandı): 19.10.2026'daki "başlığın
  // yanına taşı" güncellemesinde formBaslikHtml çağrılarına yanlışlıkla
  // `kod` DEĞİŞKENİ geçiriliyordu, bu yüzden bu kural burada BOZULMUŞTU —
  // kısa kod müşteriye/merkeze giden gerçek görselde (belgeGorselHtmlOlustur,
  // html2canvas ile yakalanan asıl paylaşılan resim) görünüyordu. Aşağıdaki
  // iki formBaslikHtml çağrısına artık BİLEREK null geçiliyor — kısa kod
  // SADECE programın kendi içinde (Belge Önizleme, Gönder'in canlı
  // önizlemesi/Mail-WhatsApp önizleme sheet'leri — hepsi ayrı fonksiyonlar)
  // gösterilir, gerçekten gönderilen/kopyalanan görselde asla basılmaz.

  // Cari Bilgi bloğu — WhatsApp'ta SADECE müşteri adı ve şehir gösterilir
  // (vade, fatura, kargo, adresler, yetkili bilgisi YOK). Mail'de hâlâ TAM
  // gösterilir. Ürün tablosunun sütun sayısı ("basit" modda LİSTE/İSK
  // olmadan) ayrı bir tercih, aynı "basit" bayrağını paylaşıyor.
  // SIRA DEĞİŞİKLİĞİ (26.10.2026, Abdullah onayı — mockup onaylı): tür/tarih
  // paneli (formBaslikHtml) artık müşteri bilgisinin ÜSTÜNDE değil, ALTINDA
  // — ürün tablosunun hemen üstüne taşındı. Değişken adları (cariBaslikHtml/
  // cariGovdeHtml) ve en alttaki birleştirme sırası (return cariBaslikHtml +
  // cariGovdeHtml + ...) BİLEREK aynı bırakıldı, sadece İÇERİKLERİ değişti.
  var cariBaslikHtml, cariGovdeHtml;
  if(basit){
    cariBaslikHtml = "<div class='belge-kart'>"
      + "<div class='belge-musteri-govde'>"
      + "<div class='belge-musteri-ad belge-musteri-ad--sade'>" + htmlEsc(musteri.ad) + "</div>"
      + (musteri.sehir ? "<div class='belge-musteri-sehir'>" + htmlEsc(musteri.sehir) + "</div>" : "")
      + "</div>"
      + formBaslikHtml(tip, tarihStr, null)
      + "</div>";
    cariGovdeHtml = "";
  } else {
    // BİRLEŞİK CARİ KUTUSU (27.09.2026): giden görsel de artık Cari Bilgi
    // sayfasıyla aynı renkli-kutu tasarımını kullanıyor — bkz. cariKutulariHtml().
    // CARİ KODU GİZLİ (18.10.2026, Abdullah onayı): Mail/WhatsApp'a giden bu
    // GERÇEK görselde müşteri cari kodu ("M-0017") HİÇ basılmaz — son
    // parametre (true) SADECE burada verilir, programın başka hiçbir yerinde
    // (Cari Kart, Sepet, Gönder'in canlı önizlemesi, Belge Önizleme) yok.
    // TESLİMAT ADRESİ BOŞSA GİZLE (28.10.2026, Abdullah onayı — mockup
    // üzerinden): 9. parametre (true) de SADECE burada verilir — teslimat
    // adresi girilmemişse bu gerçek Mail/WhatsApp görselinde TESLİMAT
    // ADRESİ bloğu hiç görünmez. Diğer hiçbir çağrı (Cari Kart, Sepet,
    // Gönder'in canlı önizlemesi, Belge Önizleme) bunu geçmediği için
    // hepsi eskisi gibi boşsa "Girilmemiş" göstermeye devam eder.
    cariBaslikHtml = HareketTablo.cariKutulariHtml(musteri, vade, faturaTuru, kargo, faturaAdr, teslimatAdr, seciliYetkili ? [seciliYetkili] : [], true, true);
    cariGovdeHtml = "<div class='belge-kart-ayrac'></div>" + "<div class='belge-kart'>" + formBaslikHtml(tip, tarihStr, null) + "</div>";
  }

  // "7. BELGE" TASARIMI (14.10.2026, Abdullah onayı — v5 mockup, program
  // genelinde TEK standart): şerit + tablo + GENEL TOPLAM artık TEK bir
  // ".belge-kart" içinde YAPIŞIK DEĞİL — belge-render.js'teki belgeyiCiz()
  // ile BİREBİR aynı yapı: baslik-serit bağımsız, tablo kendi kartında,
  // GENEL TOPLAM bağımsız (margin'ler artık inline değil, paylaşılan
  // belge-style.css'ten geliyor).
  return cariBaslikHtml
    + cariGovdeHtml
    + "<div class='belge-kart-ayrac'></div>"
    + "<div class='belge-kart belge-kart--urun-cerceveli'>"
    + urunTablosuHtmlStr
    + (typeof HareketTablo !== "undefined" ? HareketTablo.bakiyeNotuHtml(sepet) : "")
    + "</div>"
    + "<div class='belge-genel-toplam-serit'>"
    + "<span class='belge-gt-etiket-deger-grup'>"
    + "<span class='belge-gt-etiket'>GENEL TOPLAM</span>"
    + "<span class='belge-gt-deger'>" + fmtG2(netEuro) + " EURO</span>"
    + "</span></div>";
}

// PERFORMANS KAZANIMI (27.10.2026): html2canvas (büyük, nadiren kullanılan
// bir kütüphane) artık bu sayfada EN BAŞTA yüklenmiyor — sadece görsel
// oluşturma/kopyalama özelliklerinden biri GERÇEKTEN tıklandığında ilk kez
// indiriliyor. Aynı yükleme AYNI oturumda tekrar istenirse kütüphane zaten
// mevcut olduğundan hiçbir ağ isteği tekrarlanmaz.
var h2cYukleniyor = false, h2cBekleyenler = [];
function html2canvasYukle(hazirOlunca){
  if(typeof html2canvas !== "undefined"){ hazirOlunca(); return; }
  h2cBekleyenler.push(hazirOlunca);
  if(h2cYukleniyor) return;
  h2cYukleniyor = true;
  var s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
  s.onload = function(){ h2cBekleyenler.forEach(function(fn){ fn(); }); h2cBekleyenler = []; };
  s.onerror = function(){ h2cBekleyenler.forEach(function(fn){ fn(); }); h2cBekleyenler = []; };
  document.head.appendChild(s);
}
function belgeGorseliniOlustur(kanal, callback){
  try{
    html2canvasYukle(function(){
      try{
        if(typeof html2canvas === "undefined"){ callback(null); return; }
        var g = gonderBaglam;
        var alan = document.getElementById("belgeGorselAlani");
        var kayitliKod = (sonKaydedilenBelge&&sonKaydedilenBelge.kayit) ? sonKaydedilenBelge.kayit.kod : "";
        var kayitliTarih = (sonKaydedilenBelge&&sonKaydedilenBelge.kayit) ? sonKaydedilenBelge.kayit.tarih : "";
        alan.innerHTML = belgeGorselHtmlOlustur(g.musteri, g.sepet, g.tip, g.kur, g.kdv, kayitliKod, kanal, kayitliTarih);
        kosulSatirlariniSigdir(alan);
        setTimeout(function(){
          html2canvas(alan, {backgroundColor:"#ffffff", scale:2}).then(function(canvas){
            callback(canvas);
          }).catch(function(){ callback(null); });
        }, 60);
      }catch(e){ callback(null); }
    });
  }catch(e){ callback(null); }
}

// "Tabloyu Resim Olarak Kopyala" — devam eden bir mail/WhatsApp sohbetine
// yapıştırılabilsin diye görseli doğrudan SİSTEM PANOSUNA kopyalar (yeni bir
// paylaşım/gönderim açmaz, sadece kopyalar).
function tabloyuPanoyaKopyala(kanal, btnEl){
  var eskiMetin = btnEl.textContent;
  btnEl.textContent = "⏳ Hazırlanıyor...";
  btnEl.disabled = true;
  function eskiHaleDon(){ btnEl.textContent = eskiMetin; btnEl.disabled = false; }
  belgeGorseliniOlustur(kanal, function(canvas){
    if(!canvas){ eskiHaleDon(); alert("Görsel oluşturulamadı."); return; }
    if(!navigator.clipboard || typeof window.ClipboardItem === "undefined"){
      eskiHaleDon();
      alert("Bu tarayıcı doğrudan panoya kopyalamayı desteklemiyor. Bunun yerine aşağıdaki Gönder butonuyla paylaşabilirsin.");
      return;
    }
    canvas.toBlob(function(blob){
      if(!blob){ eskiHaleDon(); alert("Görsel oluşturulamadı."); return; }
      navigator.clipboard.write([new ClipboardItem({"image/png": blob})]).then(function(){
        btnEl.textContent = "✓ Kopyalandı! Mail/Sohbete yapıştırabilirsin";
        // 02.11.2026: görsel panoya kopyalanıp mail/WhatsApp sohbetine elle
        // yapıştırılıyor — bu da bir gönderim, kanal (W/M) kayda yazılmalı.
        gonderimKanaliniKaydet(kanal);
        // KÖK NEDEN DÜZELTMESİ (16.09.2026): buton "Kopyala VE Kaydet" diyordu
        // ama sadece kopyalıyordu — sepet/müşteri seçimi hiç temizlenmiyordu,
        // bu yüzden az sonra Ana Sayfa/Menü'ye basınca "Yarım Kalan İşlem"
        // uyarısı çıkıyordu. Artık kopyalama bittiğinde işlem de bitmiş
        // sayılıyor — aynı "gönderiliyor" ekranına geçiliyor.
        setTimeout(function(){ basariEkraninaGit("panoya"); }, 900);
      }).catch(function(err){
        eskiHaleDon();
        alert("Kopyalanamadı: " + (err && err.message ? err.message : "izin verilmedi"));
      });
    }, "image/png");
  });
}

// YENİ (04.10.2026) — konu metni tek yerden hesaplanıyor: hem mailOnizlemeAc
// (26.10.2026'dan beri "Yeni mail"in TEK akışı, bkz. aşağısı) hem de
// mailOnizlemeGonderBtn.onclick bunu kullanıyor.
function mailKonuOlustur(){
  var g = gonderBaglam;
  var TIP_ETIKET5 = {numune:"NUMUNE", teklif:"FİYAT TEKLİFİ", proforma:"PROFORMA FATURA", siparis:"SİPARİŞ"};
  var sehirEk = (g.musteri.sehir && g.musteri.sehir.trim()) ? (" - " + g.musteri.sehir.trim()) : "";
  return "*** " + TIP_ETIKET5[g.tip] + " *** " + g.musteri.ad + sehirEk;
}

function mailOnizlemeAc(){
  try{
    var g = gonderBaglam;
    var konu = mailKonuOlustur();
    document.getElementById("mailOnizlemeKonu").value = konu;
    document.getElementById("mailOnizlemeMetin").textContent = document.getElementById("gonderMetin").value;
    document.getElementById("mailOnizlemeTablo").innerHTML = tamOnizlemeHtmlOlustur(g.musteri, g.sepet, g.tip, g.kur, g.kdv, null, g.kod);
    document.getElementById("mailOnizlemeOverlay").hidden = false;
    kosulSatirlariniSigdir(document.getElementById("mailOnizlemeTablo"));
  }catch(e){ hataGoster("Mail önizleme açılamadı: " + e.message); }
}

function whatsappOnizlemeAc(){
  try{
    var g = gonderBaglam;
    document.getElementById("whatsappOnizlemeAlici").value = document.getElementById("gonderTelefon").value.trim() || "(telefon girilmemiş)";
    document.getElementById("whatsappOnizlemeMetin").value = mesajMetniOlustur(g.musteri, g.sepet, g.tip, "whatsapp");
    document.getElementById("whatsappOnizlemeTablo").innerHTML = tamOnizlemeHtmlOlustur(g.musteri, g.sepet, g.tip, g.kur, g.kdv, "whatsapp", g.kod);
    document.getElementById("whatsappOnizlemeOverlay").hidden = false;
    kosulSatirlariniSigdir(document.getElementById("whatsappOnizlemeTablo"));
  }catch(e){ hataGoster("WhatsApp önizleme açılamadı: " + e.message); }
}

// "Sadece Tablo" önizlemesi (14.09.2026) — cari bilgi/mesaj metni OLMADAN,
// SADECE ürün tablosu (adet/liste/isk/net/toplam) + genel toplam. Devam eden
// bir mail zincirine yapıştırmak için — gönderim değil, salt kopyalama.
function tabloSadeceOnizlemeAc(){
  try{
    var g = gonderBaglam;
    var hesapla = function(u){ return CartData.hesapla(u, g.kur, g.kdv); };
    var toplam = 0;
    (g.sepet||[]).forEach(function(u){ var h = hesapla(u); if(h && h.toplamEuro!=null) toplam += h.toplamEuro; });
    document.getElementById("tabloSadeceAlan").innerHTML = HareketTablo.grupHtml({
      urunler: g.sepet, hesapla: hesapla, genelToplam: toplam, kur: g.kur
    });
    document.getElementById("tabloSadeceOverlay").hidden = false;
  }catch(e){ hataGoster("Tablo önizleme açılamadı: " + e.message); }
}
function tabloSadeceKopyala(btnEl){
  var eskiMetin = btnEl.textContent;
  btnEl.textContent = "⏳ Hazırlanıyor...";
  btnEl.disabled = true;
  var alan = document.getElementById("tabloSadeceAlan");
  function eskiHaleDon(){ btnEl.textContent = eskiMetin; btnEl.disabled = false; alan.classList.remove("net-tl-gizle"); }
  html2canvasYukle(function(){
    if(typeof html2canvas === "undefined"){ eskiHaleDon(); alert("Görsel oluşturulamadı."); return; }
    // NET TL SATIRI (01.10.2026, Abdullah'ın isteğiyle): ekranda görünen TL
    // karşılığı, ofise/mail'e giden bu kopyada OLMAMALI — sadece EURO kalır.
    // Kopyalama bitince (başarılı ya da başarısız fark etmez) ekrana geri
    // getiriliyor.
    alan.classList.add("net-tl-gizle");
    html2canvas(alan, {backgroundColor:"#ffffff", scale:2}).then(function(canvas){
      canvas.toBlob(function(blob){
        if(!blob || !navigator.clipboard || typeof window.ClipboardItem === "undefined"){
          eskiHaleDon(); alert("Bu tarayıcı doğrudan panoya kopyalamayı desteklemiyor.");
          return;
        }
        navigator.clipboard.write([new ClipboardItem({"image/png": blob})]).then(function(){
          btnEl.textContent = "✓ Kopyalandı! Mail/Sohbete yapıştırabilirsin";
          alan.classList.remove("net-tl-gizle");
          setTimeout(eskiHaleDon, 2200);
        }).catch(function(err){
          eskiHaleDon();
          alert("Kopyalanamadı: " + (err && err.message ? err.message : "izin verilmedi"));
        });
      }, "image/png");
    }).catch(function(){ eskiHaleDon(); alert("Görsel oluşturulamadı."); });
  });
}

// Kısa süreli yeşil başarı bildirimi (01.10.2026) — hataGoster ile aynı
// mantık, sadece başarı rengiyle; Zinciri Cevapla tek dokunuşluk kopyalama
// sonrası ekran değişmeden önce kısa bir onay göstermek için.
function basariBildirimGoster(mesaj){
  var kutu = document.createElement("div");
  kutu.textContent = "✓ " + mesaj;
  kutu.style.cssText = "position:fixed;top:8px;left:8px;right:8px;background:#1e8e5a;color:#fff;padding:10px;border-radius:8px;font-size:13px;font-weight:700;text-align:center;z-index:99999;";
  document.body.appendChild(kutu);
  setTimeout(function(){ kutu.remove(); }, 1700);
}

// ZİNCİRİ CEVAPLA (01.10.2026, Abdullah'ın isteğiyle) — "Mail" tuşunun
// açtığı seçim kutusundaki ikinci seçenek. Hiçbir önizleme ekranı AÇMAZ,
// hiçbir mail/paylaşım penceresi TETİKLEMEZ (bir web sayfası telefonun
// mail uygulamasını gelen kutusuna/zincire açacak şekilde başlatamıyor —
// platform kısıtı). DÜZELTME (01.10.2026, 3. tur): "text/html" + ayrı
// resim gömme denemesi Abdullah'ın gerçek cihazında (Outlook/Android)
// TEST EDİLDİ ve işe yaramadı — Outlook panodaki metni/HTML'i yok sayıp
// direkt resmi aldı, yani metin+tablo yine TEK görsel olarak geldi. Bu,
// "zengin biçim yapıştırma" ihtimalinin bu uygulamada gerçekleşmediğini
// KANITLADI; aynı yöntemi başka varyasyonlarla denemek artık kanıta değil
// varsayıma dayanır. Bu yüzden EN GÜVENİLİR/ÇALIŞTIĞI DOĞRULANMIŞ yönteme
// dönüldü: KONU (kalın üst satır) + mesaj metni + cari bilgi + ürün
// tablosunun TAMAMI TEK bir görsel olarak panoya kopyalanır. KONU metni
// AYRICA düz metin olarak da panoya ekleniyor — resim kabul etmeyen, sade
// düz metin alan bir kutuya (ör. Konu kutusu) yapıştırılırsa oraya otomatik
// düz metin gelir; bu kısım platform kısıtına takılmıyor çünkü iki farklı
// alan türü arasında seçimi uygulamanın kendisi yapıyor, biz zorlamıyoruz.
//
// YENİ DENEME (01.10.2026, 4. tur, Abdullah'ın "mutlaka bir çözüm bul"
// isteğiyle): Android'de bir web sayfasının bir uygulamayı YENİ BİR TASLAK
// AÇMADAN, sadece o uygulamanın kendi ana ekranını açacak şekilde
// başlatmasını sağlayan "intent://" bağlantı türü var — mailto: ile KARIŞTIRILMAMALI,
// mailto: her zaman yeni taslak açar, intent:// ise uygulamayı paket adıyla
// doğrudan (compose değil, normal açılışıyla) başlatır. Bu, Abdullah'ın en
// başta istediği "mail uygulamasını aç, yeni mail sayfası değil" isteğiyle
// birebir örtüşüyor. SADECE Android'de çalışır (iOS/Apple buna izin
// vermiyor — platform kısıtı burada da geçerli) ve hedef uygulamanın
// (Outlook) cihazda kurulu olmasına bağlıdır. Daha önce denenmemiş, test
// edilmesi gerekiyor — kopyalama bitince kısa bir gecikmeyle deneniyor;
// başarısız olursa (iOS'ta, Outlook kurulu değilse veya tarayıcı
// desteklemiyorsa) sessizce hiçbir şey olmaz, kullanıcı sayfada kalır ve
// panodaki içerik zaten kopyalanmış durumda — zarar vermez.
// iOS/iPadOS TESPİTİ (30.10.2026, Abdullah'ın iPad 9'da bildirdiği hata —
// ekran görüntüsüyle doğrulandı, "Konu: Merhaba," hâlâ çıkıyordu): 28.10.2026
// tarihli düzeltme SADECE /iPhone|iPad|iPod/ için navigator.userAgent'a
// bakıyordu — ama iPadOS 13'ten beri Safari'nin VARSAYILAN User-Agent'ı
// "iPad" YAZMIYOR, bir Mac masaüstü gibi görünüyor (Apple'ın kendi, bilinen
// davranışı — "isteğe bağlı masaüstü sitesi" kapalıyken bile). Bu yüzden
// iPhone'da düzelen "Konu: Merhaba," hatası iPad'de HİÇ düzelmemiş —
// koşul hiç true olmuyordu. Artık UA kontrolüne EK olarak, Apple'ın kendi
// önerdiği gerçek-iPad tespiti de var: navigator.platform "MacIntel" VE
// dokunmatik ekran (maxTouchPoints>1) — gerçek Mac'lerde (fare/trackpad)
// maxTouchPoints 0'dır, iPad'de >1'dir.
function iosCihazMi(){
  try{
    var ua = navigator.userAgent || "";
    if(/iPhone|iPad|iPod/i.test(ua)) return true;
    return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  }catch(e){ return false; }
}
function mailUygulamasiniAcmayiDene(){
  try{
    var ua = navigator.userAgent || "";
    if(!/Android/i.test(ua)) return;
    window.location.href = "intent://#Intent;package=com.microsoft.office.outlook;category=android.intent.category.LAUNCHER;action=android.intent.action.MAIN;end";
  }catch(e){}
}
function zinciriCevaplaKopyala(){
  try{
    html2canvasYukle(function(){
      try{
        if(typeof html2canvas === "undefined"){ alert("Görsel oluşturulamadı."); return; }
        var g = gonderBaglam;
        var kayitliKod = (sonKaydedilenBelge&&sonKaydedilenBelge.kayit) ? sonKaydedilenBelge.kayit.kod : "";
        var kayitliTarih = (sonKaydedilenBelge&&sonKaydedilenBelge.kayit) ? sonKaydedilenBelge.kayit.tarih : "";
        var alan = document.getElementById("belgeGorselAlani");
        // DÜZELTME (12.10.2026, Abdullah'ın isteğiyle): KONU satırı artık
        // kopyalanan görsele HİÇ eklenmiyor — Konu'yu kendisi elle girecek.
        // DÜZELTME (08.11.2026, Abdullah'ın isteğiyle): mesaj METNİ de görsele
        // artık HİÇ eklenmiyor — Outlook panodaki metni yok sayıp sadece resmi
        // aldığı için metin zincire resmin içinde (okunaksız/istenmeyen) geliyordu.
        // Kopyalanan görselde SADECE müşteri cari kartı + işlem (ürün) tablosu var;
        // zincir mailin metnini kendisi yazıyor.
        alan.innerHTML = belgeGorselHtmlOlustur(g.musteri, g.sepet, g.tip, g.kur, g.kdv, kayitliKod, "mail", kayitliTarih);
        kosulSatirlariniSigdir(alan);
        setTimeout(function(){
          html2canvas(alan, {backgroundColor:"#ffffff", scale:2}).then(function(canvas){
            canvas.toBlob(function(blob){
              if(!blob || !navigator.clipboard || typeof window.ClipboardItem === "undefined"){
                alert("Bu tarayıcı doğrudan panoya kopyalamayı desteklemiyor.");
                return;
              }
              // DÜZELTME (01.10.2026, Abdullah'ın isteğiyle): artık KONU metni
              // panoya ayrıca düz metin olarak eklenmiyor — konuyu kendisi elle
              // yazacak. Sadece görsel (cari kart + işlem tablosu) kopyalanıyor.
              var panoOgesi = new ClipboardItem({"image/png": blob});
              navigator.clipboard.write([panoOgesi]).then(function(){
                gonderimKanaliniKaydet("mail");
                basariBildirimGoster("Kopyalandı! Mail uygulamasına geçip zincire yapıştırabilirsin.");
                setTimeout(function(){ mailUygulamasiniAcmayiDene(); }, 350);
                setTimeout(function(){ basariEkraninaGit("panoya"); }, 1800);
              }).catch(function(err){
                alert("Kopyalanamadı: " + (err && err.message ? err.message : "izin verilmedi"));
              });
            }, "image/png");
          }).catch(function(){ alert("Görsel oluşturulamadı."); });
        }, 60);
      }catch(e){ hataGoster("Zincir kopyalama hatası: " + e.message); }
    });
  }catch(e){ hataGoster("Zincir kopyalama hatası: " + e.message); }
}

function gonderimKanaliniKaydet(kanal){
  try{
    if(!sonKaydedilenBelge || !sonKaydedilenBelge.kayit || !gonderBaglam) return;
    // 02.11.2026 DÜZELTME: eskiden ReportsData.kaydiAlanGuncelle çağrılıyordu
    // ama ReportsData bu sayfada yüklü DEĞİL — hata sessizce yutuluyor, kanal
    // (W/M harfi) kayda hiç yazılmıyordu. Bkz. send-data.js kanalKaydet().
    SendData.kanalKaydet(gonderBaglam.tip, sonKaydedilenBelge.kayit.ts, kanal, function(basarili, err){
      if(!basarili) console.error("Gönderim kanalı kaydedilemedi:", err);
    });
  }catch(e){ console.error("Gönderim kanalı kaydedilemedi:", e); }
}

function gonderTiklandi(kanal, ozelKonu){
  try{
    gonderimKanaliniKaydet(kanal);
    // Gönderim tetiklenince artık HİÇBİR ŞEY silinmiyor — mail/WhatsApp
    // uygulaması açılırken veya sonrasında kullanıcı geri gelip
    // düzeltme yapmak isteyebilir. Sepet/müşteri sadece "✓ Gönderimi
    // Bitir"e basılınca veya Ana Sayfa/Menü'ye gidilince temizlenir
    // (bkz. İletişim - Gönder popup'ındaki "Kaydet çık" ve yarim-kalan-uyari.js).
    var metin = document.getElementById("gonderMetin").value;
    var g = gonderBaglam;
    var TIP_ETIKET4 = {numune:"NUMUNE", teklif:"FİYAT TEKLİFİ", proforma:"PROFORMA FATURA", siparis:"SİPARİŞ"};

    var dosyaAdi = TIP_ETIKET4[g.tip].replace(/\s/g,"_") + "_" + g.musteri.ad.replace(/[^a-zA-Z0-9]+/g,"_") + ".png";
    var konuMetni = ozelKonu || ("*** " + TIP_ETIKET4[g.tip] + " *** " + g.musteri.ad);

    belgeGorseliniOlustur(kanal, function(canvas){
      if(!canvas){
        metinTabanliGonder(kanal, konuMetni);
        return;
      }
      canvas.toBlob(function(blob){
        if(!blob){ metinTabanliGonder(kanal, konuMetni); return; }
        var dosya = new File([blob], dosyaAdi, {type:"image/png"});
        // Madde 1 (22.09.2026): mail'e konu (title) zaten ayrı alanla
        // gidiyor — gövdeye (text) bir daha eklenmiyordu ama burada ikinci
        // kez ekleniyordu, mail gövdesinde konu satırı tekrar çıkıyordu.
        // Artık gövde SADECE metin, kanal ne olursa olsun.
        // DUZELTME (28.09.2026, Abdullah'in bildirdigi hata): burada mail
        // metnine de U+2028 uygulaniyordu - bu SADECE metinTabanliGonder()
        // icindeki mailto: linki icin (iOS Mail'in mailto govdesinde \n'i
        // fazladan paragraf bosluğu yapmasi) gerekliydi. navigator.share
        // (asil kullanilan yol, resim EKI ile giden) icin U+2028 bircok
        // Android mail uygulamasinda (Gmail/Outlook) HIC satir atlamiyor -
        // Merhaba, ile devami bitisik gorunuyordu. navigator.share'e giden
        // metin artik normal \n ile, oldugu gibi gidiyor.
        //
        // DÜZELTME (05.10.2026, Abdullah'ın iPad 9'da bildirdiği hata —
        // ekran görüntüsüyle doğrulandı): iOS'ta bazı mail uygulamaları
        // navigator.share()'deki "title"ı yok sayıp Konu alanını "text"in
        // İLK SATIRIYLA dolduruyor (bilinen bir iOS Web Share API kısıtı —
        // Apple henüz düzeltmedi) — bu yüzden Konu kutusunda hesaplanan
        // konuMetni yerine mesajın ilk satırı ("Merhaba,") görünüyordu. O
        // zaman çözüm olarak SADECE mail kanalında, gövdenin (text) İLK
        // SATIRI olarak konuMetni de eklenmişti.
        // GERİ ALINDI (06.10.2026, Abdullah'ın bildirdiği hata — Outlook
        // ekran görüntüsüyle doğrulandı): KONU metni zaten ayrıca panoya
        // düz metin olarak kopyalanıyor (bkz. yukarıdaki
        // navigator.clipboard.writeText(konu) çağrıları) — gövdeye bir de
        // burada eklenince mail gövdesinde KONU metni İKİ KEZ görünüyordu.
        // Gövde artık kanal farketmeksizin SADECE mesaj metni.
        //
        // DÜZELTME (20.10.2026, Abdullah'ın iPhone'da bildirdiği hata, Mail
        // ekran görüntüsüyle doğrulandı): "Merhaba," satırı ile devamı
        // arasında olması gerekenden çok daha büyük bir boşluk çıkıyordu.
        // Sebep yukarıdaki 28.09.2026 notuyla aynı kökten: iOS Mail,
        // paylaşım sayfasından gelen metindeki her normal satır sonunu ayrı
        // bir PARAGRAF gibi işleyip aralarına ekstra boşluk ekliyor (mailto
        // gövdesindeki aynı sorunun navigator.share sürümü). 28.09.2026'da
        // bu, mail kanalı dahil TÜM paylaşımlar için özel bir satır-ayırıcı
        // karaktere çevrilmeye çalışılmış ama o zaman Android'deki
        // Gmail/Outlook satırı hiç atlamaz hale gelmiş, o yüzden geri
        // alınmıştı. Artık sadece iOS cihazlarda (iPhone/iPad), ve sadece
        // mail kanalında, aynı özel karakter kullanılıyor; Android'de (S22)
        // ve WhatsApp'ta hiçbir şey değişmedi, davranışları eskisi gibi.
        var paylasimMetni = metin;
        if(kanal === "mail" && iosCihazMi()){
          var satirAyiriciOzelKarakter = String.fromCharCode(8232);
          // DÜZELTME (28.10.2026, Abdullah onayı — "Konu: Merhaba," hatası,
          // mockup üzerinden onaylandı — Seçenek A): yukarıdaki 05.10.2026
          // notunda açıklanan iOS kısıtı yüzünden bazı Mail uygulamaları
          // Konu kutusunu "title" yerine gövdenin (text) İLK SATIRIYLA
          // dolduruyordu — mesaj şablonları "Merhaba," ile başladığından
          // Konu'da "Merhaba," görünüyordu. Gövdenin elimizdeki TEK
          // kaldıraç olması nedeniyle (Web Share API'de Konu/gövde ayrı
          // taşınmıyor), gövdenin ilk satırı artık SADECE mail+iOS'ta tek
          // bir "." oluyor: "title"ı doğru okuyan uygulamalarda Konu zaten
          // doğru gelir, gövde üstünde fazladan bir "." satırı görünür;
          // "title"ı yok sayan uygulamalarda ise Konu'da "Merhaba," yerine
          // "." görünür. WhatsApp ve Android hiç etkilenmez.
          paylasimMetni = "." + satirAyiriciOzelKarakter + metin.split("\n").join(satirAyiriciOzelKarakter);
        }

        if(navigator.canShare && navigator.canShare({files:[dosya]})){
          navigator.share({files:[dosya], title:konuMetni, text:paylasimMetni}).then(function(){
            basariEkraninaGit(kanal);
          }).catch(function(err){
            if(err && err.name!=="AbortError") hataGoster("Paylaşım penceresi kapatıldı.");
          });
        } else {
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a");
          a.href = url; a.download = dosyaAdi;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          URL.revokeObjectURL(url);
          alert("Bu cihazda direkt paylaşım desteklenmiyor — belge görseli indirildi. Şimdi " + (kanal==="whatsapp"?"WhatsApp":"Mail") + " açılacak, resmi elle ekleyebilirsin.");
          metinTabanliGonder(kanal);
        }
      }, "image/png");
    });
  }catch(e){ hataGoster("Gönderim başlatılamadı: " + e.message); }
}

function basariEkraninaGit(kanal){
  try{
    localStorage.setItem("weiconv2_gonderim_kanali", JSON.stringify({
      kanal: kanal,
      musteriAd: (gonderBaglam && gonderBaglam.musteri && gonderBaglam.musteri.ad) || ""
    }));
  }catch(e){}
  window.location.href = "gonderim-basarili.html";
}

// KURAL (25.09.2026, Abdullah'in istegiyle ESKI DUZENE DONULDU): Mail
// artik mailto: DEGIL, tekrar navigator.share (dosya paylasimi)
// kullaniyor — gonderTiklandi("mail", konu) WhatsApp ile birebir ayni
// yolu izliyor. Sebep: mailto hicbir istemcide gercek dosya EKI
// desteklemiyordu (sadece panoya kopyala + elle yapistir), Abdullah
// bunu istemedi. navigator.share ile belge gorseli GERCEK EK olarak
// gidiyor, konu (title) ve mesaj (text) otomatik doluyor — tek elle
// yapilan sey KIME adresini Mail uygulamasinda yazmak (Web Share
// API'de zaten hicbir zaman bir "kime" alani yoktu, bu JS'ten
// doldurulamaz — platform kisiti, oncesinde de hep elle giriliyordu).
var VARSAYILAN_OFIS_EPOSTA = "ofis@weicon.com.tr";

function metinTabanliGonder(kanal, ozelKonu){
  var metin = document.getElementById("gonderMetin").value;
  if(kanal === "whatsapp"){
    var telefon = document.getElementById("gonderTelefon").value.replace(/[^0-9]/g,"");
    var url = telefon ? ("https://wa.me/"+telefon+"?text="+encodeURIComponent(metin)) : ("https://api.whatsapp.com/send?text="+encodeURIComponent(metin));
    window.open(url, "_blank");
  } else {
    var eposta = document.getElementById("gonderEposta").value.trim();
    var konu = ozelKonu || "WEICON";
    // Madde 7 (22.09.2026): iOS/iPadOS Mail, mailto: gövdesindeki her \n'i
    // ayrı bir paragraf gibi işleyip aralarına fazladan boşluk ekliyor.
    // Unicode Line Separator (U+2028) bunu önlüyor — aynı görünür satır
    // sonu, paragraf boşluğu olmadan.
    var govde = metin.replace(/\n/g, "\u2028");
    var url2 = "mailto:"+encodeURIComponent(eposta)+"?subject="+encodeURIComponent(konu)+"&body="+encodeURIComponent(govde);
    window.open(url2, "_blank");
  }
  // Gönderim tetiklendikten sonra artık aynı önizleme/paylaşım ekranları
  // tekrar tekrar açık kalmıyor — sade bir "gönderiliyor" ekranına geçiliyor
  // (14.09.2026, Abdullah'ın onayladığı tasarım).
  basariEkraninaGit(kanal);
}

window.addEventListener("error", function(ev){
  hataGoster("HATA: " + ev.message + " (" + (ev.filename||"").split("/").pop() + ":" + ev.lineno + ")");
});

document.addEventListener("DOMContentLoaded", function(){
  tarihiGuncelle();
  // Menü butonu artık yarim-kalan-uyari.js tarafından yönetiliyor (sepette
  // ürün + seçili müşteri varsa uyarıp sonra temizleyip gidiyor).

  // cart.html'in az önce yazdığı kayıt bağlamını oku — yoksa (örn. sayfaya
  // doğrudan URL ile girildiyse) Sepet'e geri gönder.
  var kayitliBaglam = null;
  try{ kayitliBaglam = JSON.parse(localStorage.getItem("weiconv2_son_kaydedilen_belge")||"null"); }catch(e){}
  if(!kayitliBaglam || !kayitliBaglam.musteri || !kayitliBaglam.sepet){
    window.location.href = "cart.html";
    return;
  }
  sonKaydedilenBelge = {kayit: kayitliBaglam.kayit, musteri: kayitliBaglam.musteri};

  // GÜNCEL MÜŞTERİ VERİSİ (WG.090926.196): sipariş kaydedildikten SONRA
  // Cari Kart'a eklenen/değiştirilen yetkili kişi, fatura/teslimat adresi
  // vb. bilgiler burada eski (kayıt anındaki) görünmesin diye, müşteri
  // kaydı ID'siyle Firebase'den bir kez tazelenir. Tek seferlik — sonradan
  // kullanıcının MESAJ kutusuna yazdıklarını ezmez.
  var musteriTazelendiMi = false;
  function musteriyleDevamEt(musteri){
    sonKaydedilenBelge.musteri = musteri;
    adresleriBelirle(musteri);
    // "Kaydedildi" başlığı (#gonderBaslikYazi) 19.10.2026'da Abdullah onayıyla
    // kaldırıldı — eleman artık DOM'da yok, bu yüzden var/null kontrolüyle
    // güvenli hale getirildi (revize uyarısı artık sadece konsola/HataLog'a
    // değil, hiçbir yere yazılmıyor; görsel uyarı istenirse ayrı ele alınır).
    if(kayitliBaglam.revizeMi){
      var baslikEl = document.getElementById("gonderBaslikYazi");
      if(baslikEl) baslikEl.textContent = "🔄 Aynı ürünlerle mevcut kayıt bulundu — REVİZE olarak güncellendi.";
    }
    gonderKutusunuGoster(musteri, kayitliBaglam.sepet, kayitliBaglam.tip, kayitliBaglam.kur, kayitliBaglam.kdv, kayitliBaglam.kayit && kayitliBaglam.kayit.kod);
    // DÜZELTME (07.10.2026, Abdullah'ın bildirdiği hata — bu ekranda birkaç
    // defadır tekrarlanmış): "Kaydedildi" özetindeki VADE/FATURA/KARGO
    // kutuları eskiden SADECE sayfa ilk açılırken, Firebase'den taze müşteri
    // verisi gelmeden ÖNCE bir kez çiziliyordu ve bir daha YENİDEN
    // ÇİZİLMİYORDU — bu yüzden müşteri kartında bu bilgiler dolu olsa bile
    // ekranda "-" takılı kalabiliyordu (mail/WhatsApp görseli gönderim
    // anında yeniden hesaplandığı için orada doğru çıkıyordu). Artık taze
    // veri her geldiğinde bu özet de yeniden çiziliyor.
    tamOnizlemeyiCiz();
  }
  if(kayitliBaglam.musteri.id && typeof CustomerData !== "undefined"){
    CustomerData.listeDegistiginde(function(){
      if(musteriTazelendiMi) return;
      var taze = CustomerData.musteriIdIleBul(kayitliBaglam.musteri.id);
      if(!taze) return;
      musteriTazelendiMi = true;
      kayitliBaglam.musteri = taze;
      musteriyleDevamEt(taze);
    });
  }
  // Taze veri gelene kadar (veya hiç gelmezse) eldeki bilgiyle göster —
  // taze veri gelince yukarıdaki dinleyici tekrar çizer.
  musteriyleDevamEt(kayitliBaglam.musteri);

  // Form artık HER ZAMAN açık — ayrı bir "Formu Görüntüle/Gizle" adımı,
  // MAIL GÖNDER/WHATSAPP GÖNDER kutucukları ve "Ana Sayfa'ya Dön" butonu
  // kaldırıldı (14.09.2026, Abdullah'ın onayladığı sade tasarım). Tüm
  // gönderme/çıkış eylemleri artık tek yerde: "📧💬 İletişim - Gönder" popup'ı.
  // DÜZELTME (07.10.2026): artık tek seferlik bir IIFE değil, adlandırılmış
  // bir fonksiyon — musteriyleDevamEt() taze müşteri verisi geldiğinde bunu
  // tekrar çağırıyor (yukarıdaki yorum).
  function tamOnizlemeyiCiz(){
    var g = gonderBaglam;
    document.getElementById("tamOnizlemeAlani").innerHTML = tamOnizlemeHtmlOlustur(g.musteri, g.sepet, g.tip, g.kur, g.kdv, null, g.kod);
    kosulSatirlariniSigdir(document.getElementById("tamOnizlemeAlani"));
    secimDegistirmeyiKur();
  }

  // YETKİLİ / TESLİMAT "DEĞİŞTİR" (03.11.2026, Abdullah onayı — mockup
  // "Seçenek 1"): 27.10.2026'da Cari Kart ara adımı akıştan kalktığı için
  // Gönder'e gelen işlemde yetkili ve teslimat adresi hep İLK kayıt oluyordu,
  // değiştirmenin yolu yoktu. Artık canlı önizlemedeki YETKİLİ ve TESLİMAT
  // ADRESİ başlıklarında (birden fazla kayıt varsa) "Değiştir" tuşu çıkıyor;
  // dokununca liste AYNI yerde açılır (alttan pencere yok), seçim:
  //  1) weiconv2_secili_iletisim'e yazılır (mail/WhatsApp görseli, tablo,
  //     PDF hep bunu okur — tek kaynak),
  //  2) kayıtlı belgeye işlenir (Belge Önizleme/geçmiş aynı seçimi gösterir),
  //  3) önizleme ve WhatsApp telefon/e-posta alanları yenilenir.
  // Müşterinin tek yetkilisi/teslimat adresi varsa tuş hiç görünmez.
  function secimDegistirmeyiKur(){
    try{
      var g = gonderBaglam;
      if(!g || !g.musteri) return;
      var alan = document.getElementById("tamOnizlemeAlani");
      var KEY = "weiconv2_secili_iletisim";
      var secim = {};
      try{ secim = JSON.parse(localStorage.getItem(KEY)||"{}"); }catch(e){}

      var bolumler = [
        { sinif:"ck-blok-etiket--yetkili", alanAdi:"yetkili", liste:g.musteri.iletisimler || [],
          satir:function(k){ return {ad:(k.isim||"(isimsiz)"), alt:(k.telefon||k.eposta||"")}; } },
        { sinif:"ck-blok-etiket--teslimat", alanAdi:"teslimat", liste:g.musteri.teslimatAdresleri || [],
          satir:function(k){ return {ad:(k.etiket||"Teslimat Adresi"), alt:(k.adres||"")}; } }
      ];

      bolumler.forEach(function(b){
        if(b.liste.length < 2) return;
        var etiket = alan.querySelector("." + b.sinif);
        if(!etiket) return;
        var blok = etiket.nextElementSibling;           // .ck-blok (mevcut seçili değer)
        var secili = (secim[b.alanAdi] != null && b.liste[secim[b.alanAdi]]) ? secim[b.alanAdi] : 0;

        var tus = document.createElement("button");
        tus.type = "button";
        tus.className = "gs-degistir-tus";
        tus.textContent = "Değiştir ▾";
        tus.setAttribute("aria-expanded", "false");
        etiket.appendChild(tus);

        var kutu = document.createElement("div");
        kutu.className = "gs-secim-liste";
        kutu.hidden = true;
        kutu.innerHTML = b.liste.map(function(k, i){
          var s = b.satir(k);
          return "<button type='button' class='gs-secim-satir" + (i === secili ? " gs-secim-satir--secili" : "") + "' data-i='" + i + "'>"
            + "<span class='gs-secim-radyo'></span>"
            + "<span class='gs-secim-ad'>" + htmlEsc(s.ad) + "</span>"
            + (s.alt ? "<span class='gs-secim-alt'>" + htmlEsc(s.alt) + "</span>" : "")
            + "</button>";
        }).join("");
        if(blok && blok.parentNode) blok.parentNode.insertBefore(kutu, blok.nextSibling);

        tus.onclick = function(){
          var acik = kutu.hidden;
          kutu.hidden = !acik;
          tus.textContent = acik ? "Değiştir ▴" : "Değiştir ▾";
          tus.setAttribute("aria-expanded", acik ? "true" : "false");
        };
        kutu.querySelectorAll(".gs-secim-satir").forEach(function(btn){
          btn.onclick = function(){
            var i = parseInt(this.getAttribute("data-i"), 10);
            secimUygula(b.alanAdi, i);
          };
        });
      });
    }catch(e){ console.error("Seçim alanı kurulamadı:", e); }
  }

  function secimUygula(alanAdi, i){
    try{
      var g = gonderBaglam;
      var KEY = "weiconv2_secili_iletisim";
      var secim = {};
      try{ secim = JSON.parse(localStorage.getItem(KEY)||"{}"); }catch(e){}
      secim[alanAdi] = i;
      localStorage.setItem(KEY, JSON.stringify(secim));
      adresleriBelirle(g.musteri);

      var kayitAlanlari = null;
      if(alanAdi === "yetkili"){
        var kisi = (g.musteri.iletisimler || [])[i] || {};
        kisiAlanlariniDoldur(kisi);
        kayitAlanlari = { gorunecekYetkililer: kisi.isim ? [kisi.isim] : null };
      } else if(alanAdi === "teslimat"){
        kayitAlanlari = { teslimatAdresi: (g.musteri.teslimatAdresleri || [])[i] || null };      } else if(alanAdi === "fatura"){
        kayitAlanlari = { faturaAdresi: (g.musteri.faturaAdresleri || [])[i] || null };
      }
      if(kayitAlanlari && sonKaydedilenBelge && sonKaydedilenBelge.kayit && sonKaydedilenBelge.kayit.ts){
        SendData.alanlariGuncelle(g.tip, sonKaydedilenBelge.kayit.ts, kayitAlanlari, function(basarili, err){
          if(!basarili) console.error("Seçim kayda işlenemedi:", err);
        });
      }
      tamOnizlemeyiCiz();
    }catch(e){ hataGoster("Seçim uygulanamadı: " + e.message); }
  }
  tamOnizlemeyiCiz();

  // CARİ KARTTAN DÖNÜŞ (03.11.2026, Abdullah onayı): Gönder ekranında müşteri
  // adına dokununca Cari Kart açılır (aşağıdaki tıklama bağlaması); orada
  // "Bu Seçimlerle Devam Et" denince buraya dönülür. Seçilen yetkili/teslimat/
  // fatura indeksleri (weiconv2_secili_iletisim) önizlemeye ve kayıtlı belgeye
  // işlenir, daha önce açık olan Mail/WhatsApp önizlemesi yeniden açılır.
  try{
    if(localStorage.getItem("weiconv2_gonderden_secim_uygula") === "1"){
      localStorage.removeItem("weiconv2_gonderden_secim_uygula");
      var dSecim = JSON.parse(localStorage.getItem("weiconv2_secili_iletisim")||"{}");
      ["fatura","yetkili","teslimat"].forEach(function(a){
        if(dSecim[a] != null) secimUygula(a, dSecim[a]);
      });
    }
    var acikKanal = localStorage.getItem("weiconv2_gonder_kanal_acik");
    localStorage.removeItem("weiconv2_gonder_kanal_acik");
    localStorage.removeItem("weiconv2_gonderden_cari_acildi");
    if(acikKanal === "mail") mailOnizlemeAc();
    else if(acikKanal === "whatsapp") whatsappOnizlemeAc();
  }catch(e){ console.error("Cari Kart dönüşü işlenemedi:", e); }

  // MÜŞTERİ ADINA DOKUN → CARİ KART (03.11.2026): canlı önizlemede, Mail ve
  // WhatsApp önizlemesinde müşteri adı/şeridine dokununca Cari Kart seçim
  // modunda açılır; yetkili kişi + teslimat adresi (ve fatura adresi) orada
  // seçilir. Görsel ipucu yok (Sepet'teki eski davranışla aynı).
  document.addEventListener("click", function(ev){
    try{
      var hedef = ev.target.closest && ev.target.closest("#tamOnizlemeAlani .ms-ad, #mailOnizlemeTablo .ms-ad, #whatsappOnizlemeTablo .belge-musteri-ad");
      if(!hedef) return;
      var mailAcik = !document.getElementById("mailOnizlemeOverlay").hidden;
      var waAcik = !document.getElementById("whatsappOnizlemeOverlay").hidden;
      var m = gonderBaglam && gonderBaglam.musteri;
      if(m && !localStorage.getItem("weicon_secili_musteri")){
        localStorage.setItem("weicon_secili_musteri", JSON.stringify({ad:m.ad, sehir:m.sehir||"", id:m.id||null}));
      }
      localStorage.setItem("weiconv2_gonderden_cari_acildi", "1");
      localStorage.setItem("weiconv2_gonder_kanal_acik", mailAcik ? "mail" : (waAcik ? "whatsapp" : ""));
      window.location.href = "customer-cari-kart.html";
    }catch(e){ console.error("Cari Kart açılamadı:", e); }
  });

  // ÜST BAR "GÖNDER" (03.11.2026): alttaki Gönder tuşları kalktı; üst barın
  // Gönder'i (bkz. ust-bar-eylem.js) açık önizlemenin Gönder'ini tetikler.
  // Önizleme yoksa İletişim seçimini açar. Başka bir pencere açıksa işlemez.
  window.ustGonderTiklandi = function(){
    function acik(id){ var e = document.getElementById(id); return !!e && !e.hidden; }
    if(acik("mailOnizlemeOverlay")){ document.getElementById("mailOnizlemeGonderBtn").click(); return; }
    if(acik("whatsappOnizlemeOverlay")){ document.getElementById("whatsappOnizlemeGonderBtn").click(); return; }
    // İletişim açılır listesi açıkken Gönder'e tekrar basınca kapanır (04.11.2026).
    if(acik("iletisimSheetOverlay")){ iletisimAcilirKapat(); return; }
    if(acik("tabloSadeceOverlay") || acik("pdfSecenekPopover")) return;
    document.getElementById("btnIletisimAc").click();
  };

  document.getElementById("mailOnizlemeVazgecBtn").onclick = function(){ document.getElementById("mailOnizlemeOverlay").hidden = true; };
  // KONU alanı bazı mail uygulamalarında (Outlook Android vb.) resim ekiyle
  // birlikte otomatik dolmuyor — platform kısıtı, koddan düzeltilemiyor.
  // Bu buton en azından tek dokunuşla metni panoya alıp elle yapıştırmayı
  // kolaylaştırıyor (27.09.2026, Abdullah'ın isteğiyle).
  document.getElementById("mailKonuKopyalaBtn").onclick = function(){
    var girdi = document.getElementById("mailOnizlemeKonu");
    var btn = this;
    var eskiMetin = btn.textContent;
    function eskiHaleDon(){ btn.textContent = eskiMetin; }
    function basarili(){ btn.textContent = "✓ Kopyalandı"; setTimeout(eskiHaleDon, 1500); }
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(girdi.value).then(basarili).catch(function(){
        alert("Kopyalanamadı — metni elle seçip kopyalayabilirsin.");
      });
    } else {
      try{
        girdi.select(); girdi.setSelectionRange(0, 99999);
        document.execCommand("copy");
        basarili();
      }catch(e){ alert("Kopyalanamadı — metni elle seçip kopyalayabilirsin."); }
    }
  };
  document.getElementById("mailOnizlemeGonderBtn").onclick = function(){
    var konu = document.getElementById("mailOnizlemeKonu").value.trim() || "WEICON";
    // GÜVENLİK AĞI (28.09.2026, Abdullah'ın bildirdiği hata): bazı mail
    // uygulamaları (Outlook Android vb. — bkz. mailKonuKopyalaBtn'in
    // yorumu) paylaşımdaki KONU'yu görmezden gelip konu kutusuna mesaj
    // metnini koyabiliyor — bu platform kısıtı koddan tam düzeltilemiyor.
    // Bu yüzden Gönder'e basılır basılmaz doğru KONU sessizce panoya da
    // kopyalanır — mail uygulaması konuyu yanlış/boş getirirse tek yapman
    // gereken konu kutusuna yapıştırmak.
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(konu).then(function(){
        bilgiGoster("Konu panoya kopyalandı — Konu kutusu yanlış/boş gelirse yapıştır");
      }).catch(function(){});
    }
    document.getElementById("mailOnizlemeOverlay").hidden = true;
    gonderTiklandi("mail", konu);
  };
  document.getElementById("mailOnizlemeOverlay").addEventListener("click", function(ev){
    if(ev.target === this) this.hidden = true;
  });
  document.getElementById("whatsappOnizlemeVazgecBtn").onclick = function(){ document.getElementById("whatsappOnizlemeOverlay").hidden = true; };
  document.getElementById("whatsappTabloKopyalaBtn").onclick = function(){ tabloyuPanoyaKopyala("whatsapp", this); };
  document.getElementById("whatsappOnizlemeGonderBtn").onclick = function(){
    var mk = document.getElementById("gonderMetin");
    mk.value = document.getElementById("whatsappOnizlemeMetin").value;
    metinKutusuBoyutlandir(mk);
    document.getElementById("whatsappOnizlemeOverlay").hidden = true;
    gonderTiklandi("whatsapp");
  };
  document.getElementById("whatsappOnizlemeOverlay").addEventListener("click", function(ev){
    if(ev.target === this) this.hidden = true;
  });
  document.getElementById("btnGeriDuzelt").onclick = function(){
    window.location.href = "cart.html";
  };

  function anaSayfayaDonVeTemizle(){
    try{ localStorage.setItem("weiconv2_sepet", "[]"); }catch(e){}
    try{ localStorage.setItem("weiconv2_sepet_temizlendi_zamani", String(Date.now())); }catch(e){}
    try{ localStorage.removeItem("weiconv2_sepet_kur_override"); }catch(e){}
    try{ localStorage.removeItem("weicon_secili_musteri"); }catch(e){}
    try{ localStorage.removeItem("weiconv2_secili_iletisim"); }catch(e){}
    try{ localStorage.removeItem("weiconv2_onceden_secilen_tip"); }catch(e){}
    try{ localStorage.removeItem("weiconv2_son_kaydedilen_belge"); }catch(e){}
    try{ localStorage.removeItem("weiconv2_sepet_musteri_baglantisi"); }catch(e){}
    window.location.href = "home.html";
  }

  // İLETİŞİM SHEET (02.10.2026, Abdullah'ın isteğiyle) — Mail/WhatsApp/Tablo
  // artık formun üstünde sabit değil, "📨 İletişim" tuşuna dokununca alttan
  // açılan bu sheet içinde duruyor. Butonların kendi davranışı (altta)
  // DEĞİŞMEDİ, sadece bu sheet açılıp kapanıyor.
  // DÜZELTME (04.10.2026, Abdullah'ın isteğiyle): İletişim popup'ı açıkken
  // arkadaki sayfa kaymasın — uygulamanın geri kalanında zaten kullanılan
  // "as-drawer-kilit" tekniğiyle (bkz. home-anasayfa-style.css/home-render.js).
  // AÇILIR LİSTE (04.11.2026, Abdullah onayı — mockup üzerinden): İletişim
  // artık üst bardaki Gönder tuşunun hemen altında açılan tek sıra liste.
  // Konum her açılışta Gönder tuşunun gerçek yerinden hesaplanır (iPad/S22/
  // iPhone'da farklı) — sağ kenarı tuşla hizalı, küçük ok tuşa bakar.
  function gonderUstTusu(){
    var bt = document.querySelectorAll(".ub-eylem button");
    return bt.length ? bt[bt.length - 1] : null;
  }
  function iletisimPaneliKonumla(){
    var p = document.getElementById("iletisimAcilir");
    if(!p) return;
    var g = gonderUstTusu();
    var vw = window.innerWidth;
    var r = g ? g.getBoundingClientRect() : { top:10, bottom:54, left:vw - 56, right:vw - 8, width:48 };
    var w = p.offsetWidth;
    var sol = Math.max(6, Math.min(r.right + 6 - w, vw - w - 6));
    p.style.top = (r.bottom + 6) + "px";
    p.style.left = sol + "px";
    p.style.setProperty("--ok-sol", Math.max(10, Math.min(w - 22, r.left + r.width / 2 - sol - 6)) + "px");
  }
  function iletisimAcilirAc(){
    document.getElementById("iletisimSheetOverlay").hidden = false;
    document.body.classList.add("as-drawer-kilit");
    iletisimPaneliKonumla();
    var g = gonderUstTusu();
    if(g) g.classList.add("ub-eylem-secili");
  }
  function iletisimAcilirKapat(){
    document.getElementById("iletisimSheetOverlay").hidden = true;
    document.getElementById("mailSecenekPopover").hidden = true;
    document.getElementById("pdfSecenekPopover").hidden = true;
    document.body.classList.remove("as-drawer-kilit");
    var g = gonderUstTusu();
    if(g) g.classList.remove("ub-eylem-secili");
  }
  document.getElementById("btnIletisimAc").onclick = iletisimAcilirAc;
  document.getElementById("iletisimSheetOverlay").addEventListener("click", function(ev){
    if(ev.target === this) iletisimAcilirKapat();
  });
  window.addEventListener("resize", function(){
    var ov = document.getElementById("iletisimSheetOverlay");
    if(ov && !ov.hidden) iletisimPaneliKonumla();
  });
  // Mail/WhatsApp/Tablo'dan biri seçilince kendi önizlemesi açılmadan önce
  // İletişim sheet'i kapanır — iki alttan-açılan sayfa üst üste durmasın diye.
  function iletisimSheetiniKapat(){
    document.getElementById("iletisimSheetOverlay").hidden = true;
    document.body.classList.remove("as-drawer-kilit");
    var g = gonderUstTusu();
    if(g) g.classList.remove("ub-eylem-secili");
  }

  // MAİL SEÇENEK AÇILIR KUTUSU (01.10.2026, Abdullah'ın isteğiyle) — Mail
  // tuşu artık direkt önizleme açmıyor, önce "Yeni Mail / Zinciri Cevapla"
  // seçim kutusunu açıyor.
  // DÜZELTME (04.10.2026): kutu artık "position:fixed" (bkz. send-style.css)
  // — konumu burada, butona göre, her açılışta yeniden hesaplanıyor, böylece
  // hiçbir ebeveynin kaydırma alanı tarafından kesilmiyor.
  // Alt kutular (Mail: Yeni mail/Zinciri cevapla, PDF: Müşteriye giden/Kendi
  // kopyam) açılır listenin ALTINA değil butonun SOLUNA açılır (04.11.2026) —
  // aşağı açılsa altındaki WhatsApp/Tablo tuşlarını kapatırdı. Dar ekranda
  // (S22) sığması için genişlik gerekirse 190px'ten küçülür.
  function altKutuKonumla(pop, btn){
    var r = btn.getBoundingClientRect();
    var w = Math.max(140, Math.min(190, r.left - 12));
    pop.style.width = w + "px";
    pop.style.top = r.top + "px";
    pop.style.left = Math.max(6, r.left - 6 - w) + "px";
  }
  document.getElementById("btnUstMail").onclick = function(ev){
    ev.stopPropagation();
    var pop = document.getElementById("mailSecenekPopover");
    var aciliyorMu = pop.hidden;
    pop.hidden = !pop.hidden;
    if(aciliyorMu){
      altKutuKonumla(pop, this);
    }
  };
  // GERİ ALINDI (26.10.2026, Abdullah onayı — "seçim yapıldıktan sonra
  // otomatik önizleme açılsın" kesin kuralı): "Yeni mail" artık WhatsApp'la
  // SİMETRİK — doğrudan mail uygulamasını açmak yerine önce "Mail Önizleme"
  // ekranını (mailOnizlemeAc, bkz. yukarısı) açar, kullanıcı altındaki
  // "✓ Gönder (yeni mail aç)" butonuna basınca devam eder (bkz.
  // mailOnizlemeGonderBtn.onclick, o da gonderTiklandi("mail", konu)
  // çağırıyor — konu panoya kopyalama güvenlik ağı ORADA zaten var, burada
  // tekrarlamaya gerek yok). 04.10.2026'daki "doğrudan aç" kısayolu bu
  // kuralla çakıştığı için kaldırıldı — btnUstWhatsapp.onclick ile BİREBİR
  // aynı desen.
  document.getElementById("mailSecenekYeniMail").onclick = function(ev){
    ev.stopPropagation();
    document.getElementById("mailSecenekPopover").hidden = true;
    iletisimSheetiniKapat();
    mailOnizlemeAc();
  };
  document.getElementById("mailSecenekZincir").onclick = function(ev){
    ev.stopPropagation();
    document.getElementById("mailSecenekPopover").hidden = true;
    iletisimSheetiniKapat();
    zinciriCevaplaKopyala();
  };
  document.addEventListener("click", function(ev){
    var pop = document.getElementById("mailSecenekPopover");
    var btn = document.getElementById("btnUstMail");
    if(pop && !pop.hidden && !pop.contains(ev.target) && ev.target !== btn && !btn.contains(ev.target)){
      pop.hidden = true;
    }
  });
  document.getElementById("btnUstWhatsapp").onclick = function(){ iletisimSheetiniKapat(); whatsappOnizlemeAc(); };
  document.getElementById("btnUstTablo").onclick = function(){ iletisimSheetiniKapat(); tabloSadeceOnizlemeAc(); };

  // PDF DÜĞMESİ (19.10.2026, Abdullah onayı — mockup_h) — Mail düğmesiyle
  // BİREBİR AYNI açılır-kutu deseni (position:fixed, butona göre hesaplanan
  // konum, dışarı tıklayınca kapanma) — sadece hedef kutu ve 2 seçeneğin
  // davranışı farklı: PDF indirme, TeklifPdf.indir() ile (daha önce
  // belge-onizleme.html'in "Yazdır"ı için yapılmış, onaylanmış, ama
  // 18.10.2026'da o buton kaldırılınca bağlantısız kalmış modül —
  // artık burada yeniden kullanılıyor). "Müşteriye giden" seçeneği
  // musteriKoduGizli+primGizli:true (dışa giden belgelerle AYNI gizleme
  // kuralı), "Kendi kopyam" hiçbir şeyi gizlemez (iç/program kopyası).
  document.getElementById("btnUstPdf").onclick = function(ev){
    ev.stopPropagation();
    var pop = document.getElementById("pdfSecenekPopover");
    var aciliyorMu = pop.hidden;
    pop.hidden = !pop.hidden;
    if(aciliyorMu){
      altKutuKonumla(pop, this);
    }
  };
  function pdfIndirBaslat(secenekler){
    if(!sonKaydedilenBelge || !sonKaydedilenBelge.kayit){
      alert("PDF oluşturulamadı: kayıt bulunamadı.");
      return;
    }
    var pop = document.getElementById("pdfSecenekPopover");
    var tumBtn = pop.querySelectorAll(".mail-secenek-popover-oge");
    tumBtn.forEach(function(b){ b.disabled = true; });
    if(typeof TeklifPdf === "undefined" || typeof TeklifPdf.indir !== "function"){
      tumBtn.forEach(function(b){ b.disabled = false; });
      alert("PDF oluşturulamadı: PDF modülü yüklenemedi.");
      return;
    }
    TeklifPdf.indir(sonKaydedilenBelge.kayit, sonKaydedilenBelge.musteri, secenekler).then(function(){
      tumBtn.forEach(function(b){ b.disabled = false; });
      pop.hidden = true;
      iletisimSheetiniKapat();
      bilgiGoster("PDF indirildi");
    }).catch(function(err){
      tumBtn.forEach(function(b){ b.disabled = false; });
      alert("PDF oluşturulamadı: " + (err && err.message ? err.message : "bilinmeyen hata"));
    });
  }
  document.getElementById("pdfSecenekMusteri").onclick = function(ev){
    ev.stopPropagation();
    pdfIndirBaslat({musteriKoduGizli: true, primGizli: true});
  };
  document.getElementById("pdfSecenekKendi").onclick = function(ev){
    ev.stopPropagation();
    pdfIndirBaslat({});
  };
  document.addEventListener("click", function(ev){
    var pop = document.getElementById("pdfSecenekPopover");
    var btn = document.getElementById("btnUstPdf");
    if(pop && !pop.hidden && !pop.contains(ev.target) && ev.target !== btn && !btn.contains(ev.target)){
      pop.hidden = true;
    }
  });

  document.getElementById("tabloSadeceKopyalaBtn").onclick = function(){ tabloSadeceKopyala(this); };
  document.getElementById("tabloSadeceAnaSayfaBtn").onclick = anaSayfayaDonVeTemizle;
  document.getElementById("tabloSadeceKapatBtn").onclick = function(){ document.getElementById("tabloSadeceOverlay").hidden = true; };
  document.getElementById("tabloSadeceOverlay").addEventListener("click", function(ev){
    if(ev.target === this) this.hidden = true;
  });

  // "?ac=iletisim" (26.10.2026, Abdullah onayı) — cart.html'deki tek tuş
  // "📨 Önizleme İletişim" artık buraya "send.html?ac=iletisim" ile geliyor;
  // urun-arama.js'teki "?ac=hit/yeniurun" ile AYNI kalıp — sayfa açılır
  // açılmaz İletişim sheet'i (Mail/WhatsApp/Tablo/PDF) otomatik açılır,
  // genel önizlemeyi görüp ayrıca "İletişim" tuşuna basmaya gerek kalmaz.
  try{
    var srAcParam = new URLSearchParams(window.location.search).get("ac");
    if(srAcParam === "iletisim"){
      var btnIletisim = document.getElementById("btnIletisimAc");
      if(btnIletisim && !btnIletisim.hidden) btnIletisim.click();
    }
  }catch(e){}
});
