/*
  send-render.js — WG.051026.1500.731
  ==============
  ARTIK SADECE gönderme paneli — kaydetme işi cart.html'e taşındı. Sayfa
  açılışında "weiconv2_son_kaydedilen_belge" localStorage anahtarını okur
  (cart.html'in az önce yazdığı kayıt bağlamı); bu yoksa cart.html'e geri
  yönlendirir. "Formu Görüntüle" ile tam önizleme + "Geri" ile Sepet'e
  dönüp düzeltme imkânı sunar (aynı gün+müşteri+ürün seti eşleştiğinde
  SendData.kaydet zaten revize eder, yeni kayıt açmaz).
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
var FORM_BASLIK = {numune:"NUMUNE FORMU", teklif:"FİYAT TEKLİFİ FORMU", proforma:"PROFORMA FORMU", siparis:"SİPARİŞ FORMU"};
// TÜRE ÖZEL RENK (12.10.2026, Abdullah onayı): "tip-<tip>" sınıfı eklendi —
// gerçek renk belge-style.css'teki .belge-form-baslik.tip-* kurallarından
// geliyor, bu şerit artık belgenin tek renkli göstergesi.
function formBaslikHtml(tip){
  return "<div class='belge-form-baslik tip-" + (tip||"siparis") + "'>" + (FORM_BASLIK[tip]||"SİPARİŞ FORMU") + "</div>";
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
// WhatsApp önizlemesi/gönderilen görseli artık BİREBİR AYNI tasarımı
// kullanıyor — dolgu renkli kutular yok, sadece kalın mavi etiket + ince
// alt çizgi ayraçlar (bkz. cari-kart-style.css). Mailde/gönderimde tek bir
// seçili yetkili gösterilir; program içindeki seçim tiki (yeşil ✓) SADECE
// Cari Kart'ın kendi "İşlem Yap" akışında (birden fazla kayıt arasından
// seçim yaparken) görünür — bu yüzden burada artık DÜZ satır, tik yok.
// Fatura/Teslimat/Yetkili seçim mantığı (adresleriBelirle/seciliAdresler,
// weiconv2_secili_iletisim) DEĞİŞMEDİ — sadece görünüm burada üretiliyor.
function cariKutulariHtml(musteri, vade, faturaTuru, kargo, faturaAdr, teslimatAdr, seciliYetkili){
  // Cari'deki tek "ŞEHİR" alanı SADECE fatura adresine eklenir — teslimat
  // çoğu zaman bambaşka bir ilçe/ildedir, ona hiç eklenmez (29.09.2026,
  // Abdullah'ın bildirdiği hata: teslimat adresine fatura şehri sızıyordu).
  var sehirEk = musteri.sehir ? ", " + htmlEsc(musteri.sehir) : "";
  // DÜZELTME (07.10.2026, Abdullah'ın isteğiyle, mockup üzerinden onaylandı):
  // 1) Firma/ticari müşteri isminin başına kalın • işareti eklendi.
  // 2) Etiketler (VADE/FATURA/KARGO/FATURA ADRESİ/YETKİLİ ikonu+başlığı)
  //    satır başında sabit kalıyor — altlarındaki DEĞERLER (firma ismi,
  //    açık adres, yetkili ismi) artık ~3mm (10px) daha içeriden başlıyor
  //    (bkz. cari-kart-style.css .ck-isim-satir/.ck-kart padding-left).
  // 3) Yetkili isminin önündeki 👤 ikonu kaldırıldı (bkz. hareket-tablo.js
  //    yetkiliSatiriHtml) — sadece "👤 YETKİLİ" etiketinde kalıyor.
  var html = "<div class='ck-isim-satir'><b class='ck-isim-nokta'>•</b> " + htmlEsc(musteri.ad) + "</div>"
    + "<div class='ozet-satir-3 ozet-satir-3--birlesik'>"
    +   "<div class='ozet-alan'><span class='ozet-ikon'>📅</span><div class='ozet-metin'><div class='ozet-baslik'>VADE</div><div class='ozet-deger'>" + htmlEsc(vade||"-") + "</div></div></div>"
    +   "<div class='ozet-alan'><span class='ozet-ikon'>🧾</span><div class='ozet-metin'><div class='ozet-baslik'>FATURA</div><div class='ozet-deger'>" + htmlEsc(faturaTuru||"-") + "</div></div></div>"
    +   "<div class='ozet-alan'><span class='ozet-ikon'>🚚</span><div class='ozet-metin'><div class='ozet-baslik'>KARGO</div><div class='ozet-deger'>" + htmlEsc(kargo||"-") + "</div></div></div>"
    + "</div>"
    + "<div class='ck-blok-etiket ck-blok-etiket--fatura'><span>📄 FATURA ADRESİ</span></div>"
    + "<div class='ck-blok'><div class='ck-kart-liste'><div class='ck-kart'>"
    +   (faturaAdr ? htmlEsc(faturaAdr) + sehirEk : "<span class='belge-adres-bos'>Girilmemiş</span>")
    + "</div></div></div>";
  if(teslimatAdr){
    html += "<div class='ck-blok-etiket ck-blok-etiket--teslimat'><span>🚚 TESLİMAT ADRESİ</span></div>"
      + "<div class='ck-blok'><div class='ck-kart-liste'><div class='ck-kart'>" + htmlEsc(teslimatAdr) + "</div></div></div>";
  }
  if(seciliYetkili){
    html += "<div class='ck-blok-etiket ck-blok-etiket--yetkili'><span>👤 YETKİLİ</span></div>"
      + "<div class='ck-blok'><div class='ck-kart-liste'><div class='ck-kart'>"
      +   HareketTablo.yetkiliSatiriHtml(seciliYetkili.isim, seciliYetkili.telefon, seciliYetkili.eposta)
      + "</div></div></div>";
  }
  return html;
}

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

function tamOnizlemeHtmlOlustur(musteri, sepet, tip, kur, kdv, kanal){
  var basit = kanal === "whatsapp";
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
  if(basit){
    musteriBlokHtml =
      "<div class='belge-musteri-ad belge-musteri-ad--sade'>" + htmlEsc(musteri.ad) + "</div>"
      + (musteri.sehir ? "<div class='belge-musteri-sehir'>" + htmlEsc(musteri.sehir) + "</div>" : "");
    html = "<div class='belge-kart'>" + formBaslikHtml(tip)
      + "<div class='belge-musteri-govde'>"
      + musteriBlokHtml
      + "</div></div><div class='belge-kart-ayrac'></div><div class='belge-kart'>";
  } else {
    // BİRLEŞİK CARİ KUTUSU (27.09.2026): artık Cari Bilgi sayfasıyla aynı
    // renkli-kutu tasarımı — bkz. cariKutulariHtml().
    musteriBlokHtml = cariKutulariHtml(musteri, vade, faturaTuru, kargo, faturaAdr, teslimatAdr, seciliYetkili);
    html = "<div class='belge-kart'>" + formBaslikHtml(tip) + "</div>"
      + "<div class='belge-kart-ayrac'></div>"
      + musteriBlokHtml
      + "<div class='belge-kart-ayrac'></div>"
      + "<div class='belge-kart'>";
  }

  html += HareketTablo.grupHtml({
    etiket: (TIP_ETIKET_BELGE_G[tip]||"SİPARİŞ") + " · " + tarihSaatStr(),
    etiketBgOzel: "#eaf2fc",
    etiketRenkOzel: "#0c447c",
    etiketOrtali: true,
    urunler: sepet,
    hesapla: function(u){ return CartData.hesapla(u, kur, kdv); },
    genelToplam: tToplamEuro,
    kanal: kanal,
    primGizli: true,
    kur: kur
  });
  html += "</div>";
  return html;
}

// Mail/WhatsApp metin kutusu artık sabit yükseklikte değil — içeriği
// kadar büyüyüp küçülüyor (27.09.2026, Abdullah'ın isteğiyle).
function metinKutusuBoyutlandir(el){
  if(!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

function gonderKutusunuGoster(musteri, sepet, tip, kur, kdv){
  try{
    gonderBaglam = {musteri:musteri, sepet:sepet, tip:tip, kur:kur, kdv:kdv};
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


var TIP_ETIKET_BELGE_G = {numune:"NUMUNE", teklif:"FİYAT TEKLİFİ", proforma:"PROFORMA FATURA", siparis:"SİPARİŞ"};

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
  var satirlarHtml = "";
  var netEuro = 0;
  sepet.forEach(function(u, i){
    var h = CartData.hesapla(u, kur, kdv);
    netEuro += h.toplamEuro;
    var urunHucre = "<td class='belge-td-urun'><div class='belge-td-urun-kod'><span class='kod-blok kod-blok--b'><span class='kod-harf'>B</span> " + htmlEsc(u.berta||"-") + "</span> - <span class='kod-blok kod-blok--a'><span class='kod-harf'>A</span> " + htmlEsc(u.abas||"-") + "</span>" + "</div><div class='belge-td-urun-ad'>" + htmlEsc(u.ad) + "</div></td>";
    // NUMUNE/BEDELSİZ GÖSTERİMİ (28.09.2026, Abdullah'ın isteğiyle): bedelsiz
    // (numune) işaretli bir ürün gönderiliyorsa TOPLAM sütununda "0,00 EURO"
    // yerine "NUMUNE" yazılır. İskonto %100 girilmişse (bedelsiz ya da özel
    // fiyat fark etmez) İSK sütununda "%100" yerine sadece "-" gösterilir.
    var iskYuz100 = (u.iskonto||0) === 100;
    var toplamHucreIcerik = (u.ozelEtiket === "bedelsiz")
      ? "<div class='belge-td-sayi'>NUMUNE</div>"
      : sayiDivHtml(fmtG2(h.toplamEuro), "EURO");
    var iskHucreIcerik = iskYuz100 ? "<div class='belge-td-sayi'>-</div>" : ("<span class='belge-isk-metin'>" + sayiDivHtml((u.iskonto||0), "%") + "</span>");
    if(basit){
      satirlarHtml += "<tr>"
        + urunHucre
        + "<td>" + (u.adet||0) + "</td>"
        + "<td class='belge-td-fiyat belge-td-fiyat--net'>" + sayiDivHtml(fmtG2(h.iskontoluFiyat), "EURO") + "</td>"
        + "<td class='belge-td-fiyat belge-td-fiyat--toplam'>" + toplamHucreIcerik + "</td>"
        + "</tr>";
    } else {
      satirlarHtml += "<tr>"
        + "<td class='belge-td-sira'>" + (i+1) + "</td>"
        + urunHucre
        + "<td>" + (u.adet||0) + "</td>"
        + "<td class='belge-td-fiyat'>" + sayiDivHtml(fmtG2(u.listeFiyat||0), "EURO") + "</td>"
        + "<td class='belge-td-fiyat belge-td-fiyat--isk'>" + iskHucreIcerik + "</td>"
        + "<td class='belge-td-fiyat belge-td-fiyat--net'>" + sayiDivHtml(fmtG2(h.iskontoluFiyat), "EURO") + "</td>"
        + "<td class='belge-td-fiyat belge-td-fiyat--toplam'>" + toplamHucreIcerik + "</td>"
        + "</tr>";
    }
  });

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

  // Giden görselde dahili belge kodu (F.TEK.../SİP...) GÖSTERİLMEZ — sadece
  // belge türü + tarih. (Sistem içi görünümde — belge-onizleme.html — kod
  // hâlâ gösterilir, o ayrı bir fonksiyon/dosyadır.)
  var tabloBasligi = (TIP_ETIKET_BELGE_G[tip]||"SİPARİŞ") + " · " + tarihStr;

  // Cari Bilgi bloğu — WhatsApp'ta SADECE müşteri adı ve şehir gösterilir
  // (vade, fatura, kargo, adresler, yetkili bilgisi YOK). Mail'de hâlâ TAM
  // gösterilir. Ürün tablosunun sütun sayısı ("basit" modda LİSTE/İSK
  // olmadan) ayrı bir tercih, aynı "basit" bayrağını paylaşıyor.
  var cariBaslikHtml, cariGovdeHtml;
  if(basit){
    cariBaslikHtml = "<div class='belge-kart' style='margin:0;'>" + formBaslikHtml(tip)
      + "<div class='belge-musteri-govde'>"
      + "<div class='belge-musteri-ad belge-musteri-ad--sade'>" + htmlEsc(musteri.ad) + "</div>"
      + (musteri.sehir ? "<div class='belge-musteri-sehir'>" + htmlEsc(musteri.sehir) + "</div>" : "")
      + "</div></div>";
    cariGovdeHtml = "";
  } else {
    // BİRLEŞİK CARİ KUTUSU (27.09.2026): giden görsel de artık Cari Bilgi
    // sayfasıyla aynı renkli-kutu tasarımını kullanıyor — bkz. cariKutulariHtml().
    cariBaslikHtml = "<div class='belge-kart' style='margin:0;'>" + formBaslikHtml(tip) + "</div>";
    cariGovdeHtml = "<div class='belge-kart-ayrac'></div>" + cariKutulariHtml(musteri, vade, faturaTuru, kargo, faturaAdr, teslimatAdr, seciliYetkili);
  }

  return cariBaslikHtml
    + cariGovdeHtml
    + "<div class='belge-kart-ayrac'></div>"
    + "<div class='belge-kart' style='margin:0;'>"
    + "<div class='belge-belge-baslik-serit belge-belge-baslik-serit--mavi'>" + tabloBasligi + "</div>"
    + "<div class='data-table-container'><table class='belge-urun-tablo belge-urun-tablo--giden'>"
    + "<thead><tr>" + (basit
        ? "<th style='width:38%;'>ÜRÜN BİLGİSİ</th><th style='width:14%;'>AD</th><th style='width:24%;'>NET</th><th style='width:24%;'>TOPLAM</th>"
        // DÜZELTME (04.10.2026, Abdullah'ın isteğiyle): gönderilen mailin
        // görsel tablosunda TOPLAM sütunu aşırı genişti. TOPLAM 22% → 14%'e
        // DARALTILDI (büyütülmedi), fark ÜRÜN BİLGİSİ'ne eklendi (28% → 36%).
        // Diğer sütunlar (#, AD, LİST, İSK, NET) DEĞİŞMEDİ.
        : "<th style='width:4%;'>#</th><th style='width:36%;'>ÜRÜN BİLGİSİ</th><th style='width:7%;'>AD</th><th style='width:11%;'>LİST</th><th style='width:10%;'>İSK</th><th style='width:18%;'>NET</th><th style='width:14%;'>TOPLAM</th>") + "</tr></thead>"
    + "<tbody>" + satirlarHtml + "</tbody>"
    + "</table></div>"
    + (typeof HareketTablo !== "undefined" ? HareketTablo.bakiyeNotuHtml(sepet) : "")
    + "<div class='belge-genel-toplam-serit'>"
    + "<span class='belge-gt-etiket-deger-grup'>"
    + "<span class='belge-gt-etiket'>GENEL TOPLAM</span>"
    + "<span class='belge-gt-deger'>" + fmtG2(netEuro) + " EURO</span>"
    + "</span></div>"
    + "</div>";
}

function belgeGorseliniOlustur(kanal, callback){
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

// YENİ (04.10.2026) — konu metni artık tek yerden hesaplanıyor: hem
// (artık hiçbir yerden açılmayan, dokunulmadan bırakılan) mailOnizlemeAc
// hem de "Yeni mail"in doğrudan-gönder akışı (bkz. DOMContentLoaded içindeki
// mailSecenekYeniMail.onclick) bunu kullanıyor.
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
    document.getElementById("mailOnizlemeTablo").innerHTML = tamOnizlemeHtmlOlustur(g.musteri, g.sepet, g.tip, g.kur, g.kdv, null);
    document.getElementById("mailOnizlemeOverlay").hidden = false;
    kosulSatirlariniSigdir(document.getElementById("mailOnizlemeTablo"));
  }catch(e){ hataGoster("Mail önizleme açılamadı: " + e.message); }
}

function whatsappOnizlemeAc(){
  try{
    var g = gonderBaglam;
    document.getElementById("whatsappOnizlemeAlici").value = document.getElementById("gonderTelefon").value.trim() || "(telefon girilmemiş)";
    document.getElementById("whatsappOnizlemeMetin").value = mesajMetniOlustur(g.musteri, g.sepet, g.tip, "whatsapp");
    document.getElementById("whatsappOnizlemeTablo").innerHTML = tamOnizlemeHtmlOlustur(g.musteri, g.sepet, g.tip, g.kur, g.kdv, "whatsapp");
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
function mailUygulamasiniAcmayiDene(){
  try{
    var ua = navigator.userAgent || "";
    if(!/Android/i.test(ua)) return;
    window.location.href = "intent://#Intent;package=com.microsoft.office.outlook;category=android.intent.category.LAUNCHER;action=android.intent.action.MAIN;end";
  }catch(e){}
}
function zinciriCevaplaKopyala(){
  try{
    if(typeof html2canvas === "undefined"){ alert("Görsel oluşturulamadı."); return; }
    var g = gonderBaglam;
    var metin = document.getElementById("gonderMetin").value;
    var kayitliKod = (sonKaydedilenBelge&&sonKaydedilenBelge.kayit) ? sonKaydedilenBelge.kayit.kod : "";
    var kayitliTarih = (sonKaydedilenBelge&&sonKaydedilenBelge.kayit) ? sonKaydedilenBelge.kayit.tarih : "";
    var alan = document.getElementById("belgeGorselAlani");
    // DÜZELTME (12.10.2026, Abdullah'ın isteğiyle): KONU satırı artık
    // kopyalanan görsele HİÇ eklenmiyor — Konu'yu kendisi elle girecek.
    // Sadece mesaj metni + cari bilgi + ürün tablosu kopyalanıyor.
    alan.innerHTML = "<div style='font-size:13px;color:#2d3540;line-height:1.5;margin-bottom:14px;white-space:pre-wrap;'>" + htmlEsc(metin) + "</div>"
      + belgeGorselHtmlOlustur(g.musteri, g.sepet, g.tip, g.kur, g.kdv, kayitliKod, "mail", kayitliTarih);
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
          // yazacak. Sadece görsel (tablo + mesaj) kopyalanıyor.
          var panoOgesi = new ClipboardItem({"image/png": blob});
          navigator.clipboard.write([panoOgesi]).then(function(){
            gonderimKanaliniKaydet("mail_zincir");
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
}

function gonderimKanaliniKaydet(kanal){
  try{
    if(!sonKaydedilenBelge || !sonKaydedilenBelge.kayit || !gonderBaglam) return;
    ReportsData.kaydiAlanGuncelle(gonderBaglam.tip, sonKaydedilenBelge.kayit.ts, {kanal: kanal}, function(basarili, err){
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
        var paylasimMetni = metin;

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
    if(kayitliBaglam.revizeMi){
      document.getElementById("gonderBaslikYazi").textContent = "🔄 Aynı ürünlerle mevcut kayıt bulundu — REVİZE olarak güncellendi.";
    }
    gonderKutusunuGoster(musteri, kayitliBaglam.sepet, kayitliBaglam.tip, kayitliBaglam.kur, kayitliBaglam.kdv);
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
    document.getElementById("tamOnizlemeAlani").innerHTML = tamOnizlemeHtmlOlustur(g.musteri, g.sepet, g.tip, g.kur, g.kdv);
    kosulSatirlariniSigdir(document.getElementById("tamOnizlemeAlani"));
  }
  tamOnizlemeyiCiz();

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
    try{ localStorage.removeItem("weiconv2_sepet_kur_override"); }catch(e){}
    try{ localStorage.removeItem("weicon_secili_musteri"); }catch(e){}
    try{ localStorage.removeItem("weiconv2_secili_iletisim"); }catch(e){}
    try{ localStorage.removeItem("weiconv2_onceden_secilen_tip"); }catch(e){}
    try{ localStorage.removeItem("weiconv2_son_kaydedilen_belge"); }catch(e){}
    window.location.href = "home.html";
  }

  // İLETİŞİM SHEET (02.10.2026, Abdullah'ın isteğiyle) — Mail/WhatsApp/Tablo
  // artık formun üstünde sabit değil, "📨 İletişim" tuşuna dokununca alttan
  // açılan bu sheet içinde duruyor. Butonların kendi davranışı (altta)
  // DEĞİŞMEDİ, sadece bu sheet açılıp kapanıyor.
  // DÜZELTME (04.10.2026, Abdullah'ın isteğiyle): İletişim popup'ı açıkken
  // arkadaki sayfa kaymasın — uygulamanın geri kalanında zaten kullanılan
  // "as-drawer-kilit" tekniğiyle (bkz. home-anasayfa-style.css/home-render.js).
  document.getElementById("btnIletisimAc").onclick = function(){
    document.getElementById("iletisimSheetOverlay").hidden = false;
    document.body.classList.add("as-drawer-kilit");
  };
  document.getElementById("btnIletisimKapat").onclick = function(){
    document.getElementById("iletisimSheetOverlay").hidden = true;
    document.getElementById("mailSecenekPopover").hidden = true;
    document.body.classList.remove("as-drawer-kilit");
  };
  document.getElementById("iletisimSheetOverlay").addEventListener("click", function(ev){
    if(ev.target === this){
      this.hidden = true;
      document.getElementById("mailSecenekPopover").hidden = true;
      document.body.classList.remove("as-drawer-kilit");
    }
  });
  // Mail/WhatsApp/Tablo'dan biri seçilince kendi önizlemesi açılmadan önce
  // İletişim sheet'i kapanır — iki alttan-açılan sayfa üst üste durmasın diye.
  function iletisimSheetiniKapat(){
    document.getElementById("iletisimSheetOverlay").hidden = true;
    document.body.classList.remove("as-drawer-kilit");
  }

  // MAİL SEÇENEK AÇILIR KUTUSU (01.10.2026, Abdullah'ın isteğiyle) — Mail
  // tuşu artık direkt önizleme açmıyor, önce "Yeni Mail / Zinciri Cevapla"
  // seçim kutusunu açıyor.
  // DÜZELTME (04.10.2026): kutu artık "position:fixed" (bkz. send-style.css)
  // — konumu burada, butona göre, her açılışta yeniden hesaplanıyor, böylece
  // hiçbir ebeveynin kaydırma alanı tarafından kesilmiyor.
  document.getElementById("btnUstMail").onclick = function(ev){
    ev.stopPropagation();
    var pop = document.getElementById("mailSecenekPopover");
    var aciliyorMu = pop.hidden;
    pop.hidden = !pop.hidden;
    if(aciliyorMu){
      var r = this.getBoundingClientRect();
      pop.style.top = (r.bottom + 4) + "px";
      pop.style.left = r.left + "px";
    }
  };
  // DÜZELTME (04.10.2026, Abdullah'ın isteğiyle): "Yeni mail" artık ayrı
  // "Mail Önizleme" ekranını/"✓ Gönder (yeni mail aç)" butonunu HİÇ
  // göstermeden, doğrudan mail uygulamasını açar (mailOnizlemeGonderBtn'in
  // daha önce yaptığıyla AYNI: konu hesaplanır, güvenlik ağı olarak panoya
  // kopyalanır, gonderTiklandi("mail", konu) çağrılır). Eski ara ekran
  // (mailOnizlemeOverlay) koddan silinmedi — artık hiçbir yerden açılmıyor.
  document.getElementById("mailSecenekYeniMail").onclick = function(ev){
    ev.stopPropagation();
    document.getElementById("mailSecenekPopover").hidden = true;
    iletisimSheetiniKapat();
    var konu = mailKonuOlustur();
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(konu).then(function(){
        bilgiGoster("Konu panoya kopyalandı — Konu kutusu yanlış/boş gelirse yapıştır");
      }).catch(function(){});
    }
    gonderTiklandi("mail", konu);
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

  document.getElementById("tabloSadeceKopyalaBtn").onclick = function(){ tabloSadeceKopyala(this); };
  document.getElementById("tabloSadeceAnaSayfaBtn").onclick = anaSayfayaDonVeTemizle;
  document.getElementById("tabloSadeceKapatBtn").onclick = function(){ document.getElementById("tabloSadeceOverlay").hidden = true; };
  document.getElementById("tabloSadeceOverlay").addEventListener("click", function(ev){
    if(ev.target === this) this.hidden = true;
  });
});
