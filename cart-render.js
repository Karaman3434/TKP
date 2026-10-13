/*
  cart-render.js — WG.131026.1455.798
  ==============
  Sepeti HESAPLANACAK (sarı) / HESAPLANDI (yeşil) belge-tablosu gruplarıyla
  çizer; HESAPLANDI grubunun etiketinde artık EURO KUR rozeti de var.
  Bir ürüne dokununca calc.html'e gidilir (hesapla/düzenle). Kaydet/Gönder
  artık GERÇEKTEN kaydeder (kur tazelik kontrolü + anomali uyarısı + varsa
  aşama seçimi dahil) — ikinci bir onay ekranına gerek yok; başarılı kayıt
  sonrası: "Kaydet" -> Ana Sayfa, "Formu Görüntüle" -> send.html (mail/WhatsApp paneli).
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

// Çalışan erişimi — ince ayar izinleri (02.10.2026). auth.js kısıtlı
// olmayan (Abdullah'ın kendi) oturumlarda izinVarMi hiç tanımlamaz/her
// zaman true döner — bkz. auth.js SEPET_ALT_IZIN_ANAHTARLARI.
function crIzinVarMi(anahtar){
  try{ return (typeof izinVarMi !== "function") || izinVarMi(anahtar); }
  catch(e){ return true; }
}

var TIP_ETIKET_ROZET = {numune:"NUMUNE", teklif:"FİYAT TEKLİFİ", proforma:"PROFORMA FATURA", siparis:"SİPARİŞ"};
var secilenTip = "siparis";
var seciliAdresler = {};
var revizeSecimBekleniyor = null;

// Hızlı Hesapla'da manuel kur girilip "Listeye Ekle" ile buraya
// eklendiyse, o kur bu işlem boyunca (Sepet + Gönder) geçerli olmaya
// devam eder — günlük kur değişse bile bu sepet/sipariş etkilenmez.
// Sepet boşalınca (CustomerData.secimiKaldir vb.) bu da temizlenir.
function aktifKuruOku(){
  var override = parseFloat(localStorage.getItem("weiconv2_sepet_kur_override"));
  return (!isNaN(override) && override > 0) ? override : CartData.kurOku();
}
function aktifKurManuelMi(){
  var override = parseFloat(localStorage.getItem("weiconv2_sepet_kur_override"));
  return !isNaN(override) && override > 0;
}

// "Hesaplanan Kur" / "✏️ Manuel Kur" rozetine dokununca açılan popup —
// calc.html'deki Döviz Kuru Seçimi popup'ıyla aynı mantık (Günlük Kuru
// Kullan / Manuel Gir), burada Sepet'e özel kopyası (13.09.2026).
function kurManuelOverlayAc(){
  var gunlukKur = CartData.kurOku();
  document.getElementById("sepetKurGunlukDeger").textContent = CartData.fmt(gunlukKur);
  var manuelAlan = document.getElementById("sepetKurManuelAlan");
  manuelAlan.hidden = true;
  var mevcutOverride = aktifKurManuelMi() ? parseFloat(localStorage.getItem("weiconv2_sepet_kur_override")) : "";
  document.getElementById("sepetKurManuelInput").value = mevcutOverride;
  document.getElementById("btnSepetKurGunluk").className = "kur-secenek-btn" + (!aktifKurManuelMi() ? " kur-secenek-btn--secili" : "");
  document.getElementById("btnSepetKurManuelAc").className = "kur-secenek-btn" + (aktifKurManuelMi() ? " kur-secenek-btn--secili" : "");
  document.getElementById("kurManuelOverlay").hidden = false;
}
function kurManuelOverlayBaglantilariKur(){
  document.getElementById("btnSepetKurGunluk").onclick = function(){
    localStorage.removeItem("weiconv2_sepet_kur_override");
    document.getElementById("kurManuelOverlay").hidden = true;
    sayfayiCiz();
  };
  document.getElementById("btnSepetKurManuelAc").onclick = function(){
    document.getElementById("sepetKurManuelAlan").hidden = false;
    document.getElementById("sepetKurManuelInput").focus();
  };
  // Madde 6 (22.09.2026): TCMB'nin günlük döviz kuru sayfasını yeni
  // sekmede aç — popup kapanmaz, rep TCMB'de bakıp sonra Manuel Gir'e
  // dönebilir.
  document.getElementById("btnSepetKurTcmb").onclick = function(){
    window.open("https://www.tcmb.gov.tr/kurlar/kurlar_tr.html", "_blank");
  };
  document.getElementById("btnSepetKurManuelKaydet").onclick = function(){
    var deger = parseFloat(document.getElementById("sepetKurManuelInput").value);
    if(isNaN(deger) || deger <= 0){ hataGoster("Geçerli bir kur girin."); return; }
    localStorage.setItem("weiconv2_sepet_kur_override", deger);
    document.getElementById("kurManuelOverlay").hidden = true;
    sayfayiCiz();
  };
  document.getElementById("btnKurManuelVazgec").onclick = function(){
    document.getElementById("kurManuelOverlay").hidden = true;
  };
}

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
  }
  if(musteri.teslimatAdresleri && musteri.teslimatAdresleri.length){
    var ti = (secim.teslimat!=null && musteri.teslimatAdresleri[secim.teslimat]) ? secim.teslimat : 0;
    seciliAdresler.teslimatAdresi = musteri.teslimatAdresleri[ti];
  }
  // KÖK NEDEN DÜZELTMESİ (14.09.2026): fatura/teslimat adresi seçimi kayda
  // işleniyordu ama YETKİLİ seçimi hiç işlenmiyordu — bu yüzden Belge
  // Önizleme (kayıt kaydedildikten sonra) her zaman cari karttaki TÜM
  // yetkilileri gösteriyordu, Formu Görüntüle ise doğru tek kişiyi
  // gösteriyordu (o an localStorage'dan taze okuyordu). Artık seçili
  // yetkili de kayda işleniyor — bkz. send-data.js, belge-render.js.
  if(musteri.iletisimler && musteri.iletisimler.length){
    var yi = (secim.yetkili!=null && musteri.iletisimler[secim.yetkili]) ? secim.yetkili : 0;
    seciliAdresler.yetkili = musteri.iletisimler[yi];
  }
}

// BİRLEŞİK SAYFA (02.10.2026, Abdullah'ın isteğiyle): artık calc.html'e
// YÖNLENDİRMİYOR — "birebir aynı" hesaplama arayüzünü #hpOverlay popup'ı
// olarak bu sayfanın içinde açıyor (bkz. hesapla-popup.js). Satır hem
// HESAPLANACAK (sarı) hem HESAPLANDI (yeşil) grubunda aynı şekilde çalışır.
function urunuHesaplamayaGonder(idx){
  var urun = CartData.liste().find(function(u){ return u.idx === idx; });
  if(!urun) return;
  if(typeof HesaplaPopup !== "undefined") HesaplaPopup.ac(urun, urun.idx);
}

// Cari Bilgi bilgisi artık standart .musteri-serit — işlem türü rozeti
// artık burada DEĞİL, HESAPLANDI grubunun etiket satırının sonunda
// gösteriliyor (27.09.2026, Abdullah'ın isteğiyle — bkz. sayfayiCiz()).
// "🕓 Geçmiş" butonu (12.10.2026, Abdullah onayı) — SADECE bu sayfada açık.
function cariBilgiOzetiHtml(musteri){
  return MusteriSeridi.html(musteri, {gecmisButonu: true});
}

// MÜŞTERİ İŞLEM GEÇMİŞİ POPUP'I (12.10.2026, Abdullah onayı) — müşteri
// şeridindeki "🕓 Geçmiş" butonu. Hesaplama sırasında sayfadan hiç
// ayrılmadan, bu müşteriye bugüne kadar teklif/proforma/numune/sipariş
// olarak girilmiş TÜM ürünlerin fiyat/iskonto geçmişini gösterir — AYNI
// veri kaynağı (ReportsData.musteriUrunGecmisi), customer-detail.html'deki
// "📦 Ürün Geçmişi" ekranıyla birebir aynı mantık/kod deseni (bkz.
// detail-render.js urunGecmisiniAc()). KÖK NEDEN (bu özelliğin eklenme
// sebebi): bu müşteriye daha önce FİYAT TEKLİFİ verilmiş ama SİPARİŞE
// dönüşmemişse, Hızlı Hesapla'daki otomatik "geçmiş alım ipucu" eskiden
// görünmüyordu (SADECE sipariş kayıtlarına bakıyordu) — bu artık
// reports-data.js'te düzeltildi, bu popup da aynı düzeltilmiş veriyi
// kullanıyor.
var TIP_ETIKET_MUSTERI_GECMIS = {numune:"Numune", teklif:"Teklif", proforma:"Proforma", siparis:"Sipariş"};
function musteriGecmisiniAc(){
  try{
    if(typeof ReportsData === "undefined" || typeof ReportsData.musteriUrunGecmisi !== "function"){
      hataGoster("İşlem geçmişi şu an yüklenemedi.");
      return;
    }
    var musteri = CustomerData.seciliyiOku();
    if(!musteri) return;
    // DEĞİŞİKLİK (12.10.2026, Abdullah onayı): ara "ürüne tıkla, sonra aç"
    // liste ekranı kaldırıldı — artık TEK tablo; gruplar zaten
    // ReportsData.musteriUrunGecmisi() tarafından her ürün için en yeniden
    // en eskiye sıralı geliyor (kayitlar[0] = o ürünün EN YENİ kaydı), o
    // yüzden her gruptan sadece kayitlar[0] alınıyor — aynı üründen birden
    // fazla kayıt varsa SADECE en yeni/en yakın tarihli olan gösterilir.
    var gruplar = ReportsData.musteriUrunGecmisi(musteri.ad, musteri.id);
    var baslikEl = document.getElementById("musteriGecmisBaslik");
    var govdeEl = document.getElementById("musteriGecmisTabloGovde");
    baslikEl.textContent = "🕓 İşlem Geçmişi";

    if(gruplar.length === 0){
      govdeEl.innerHTML = "<tr><td colspan='6' style='text-align:center;color:#44494f;padding:16px 0;'>Bu müşteriye henüz sipariş/teklif olarak girilmiş bir ürün yok.</td></tr>";
    } else {
      govdeEl.innerHTML = gruplar.map(function(g){
        var k = g.kayitlar[0]; // en yeni kayıt
        var tipEtiket = TIP_ETIKET_MUSTERI_GECMIS[k.tip] || "";
        var d = new Date(k.ts);
        var tarihFormatli = String(d.getDate()).padStart(2,"0") + "." + String(d.getMonth()+1).padStart(2,"0") + "." + d.getFullYear();
        return "<tr>"
          + "<td style='text-align:left;font-weight:700;'>" + htmlEsc(g.ad) + "</td>"
          + "<td>" + tarihFormatli + (tipEtiket ? " <span style='color:#8e44ad;font-weight:700;'>(" + tipEtiket + ")</span>" : "") + "</td>"
          + "<td>" + (k.adet||0) + "</td>"
          + "<td>" + CartData.fmt(k.listeFiyat) + " EURO</td>"
          + "<td><span class='belge-para-sayi' style='color:#c0392b;'>" + CartData.fmt(k.iskonto) + "</span><span class='belge-para-birim' style='color:#c0392b;'>%</span></td>"
          + "<td><span class='rozet-net'>" + CartData.fmt(k.netFiyat) + " EURO</span></td>"
          + "</tr>";
      }).join("");
    }
    document.getElementById("musteriGecmisOverlay").hidden = false;
  }catch(e){ hataGoster("İşlem geçmişi açılamadı: " + e.message); }
}

function sayfayiCiz(){
  try{
    var liste = CartData.liste();
    var bosMesaj = document.getElementById("sepetBosMesaj");
    var altButonSatiri = document.getElementById("sepetAltButonSatiri");
    var devamUyari = document.getElementById("devamUyari");
    var grupSariAlani = document.getElementById("grupSariAlani");
    var grupYesilAlani = document.getElementById("grupYesilAlani");
    var musteri = CustomerData.seciliyiOku();

    if(liste.length === 0){
      document.getElementById("cariBilgiAlani").innerHTML = "";
      grupSariAlani.innerHTML = "";
      grupYesilAlani.innerHTML = "";
      bosMesaj.hidden = false;
      bosMesaj.textContent = "Sepetiniz boş. Yukarıdaki arama kutusundan ürün bulup SEÇ'e dokunun.";
      altButonSatiri.hidden = true;
      document.getElementById("btnSepetIptal").hidden = true;
      devamUyari.hidden = true;
      return;
    }
    bosMesaj.hidden = true;
    altButonSatiri.hidden = false;
    document.getElementById("btnSepetIptal").hidden = false;

    // MÜŞTERİSİZ SEPET (13.10.2026, Abdullah onayı): müşteri seçilmeden de
    // ürün eklenip hesaplanabilir — Cari Bilgi şeridi/adresler SADECE
    // müşteri seçiliyse gösterilir. "Kaydet" yine müşteri ister (kayıt bir
    // müşteriye bağlanmalı, bkz. kaydetGercekIslem), ama "Görüntüle ve
    // Gönder" müşterisiz hızlı gönderim akışına (musterisizOnizlemeAc)
    // zaten düşüyor — bkz. kaydetTiklandi(). Eskiden bu ekranın TAMAMI
    // müşteri seçilmeden hiç gösterilmiyordu, bu yüzden sepete eklenen
    // ürünler bile görünmüyordu.
    if(musteri){
      document.getElementById("cariBilgiAlani").innerHTML = cariBilgiOzetiHtml(musteri);
      var btnMusteriGecmisEl2 = document.getElementById("btnMusteriGecmis");
      if(btnMusteriGecmisEl2) btnMusteriGecmisEl2.onclick = musteriGecmisiniAc;
      adresleriBelirle(musteri);
    } else {
      document.getElementById("cariBilgiAlani").innerHTML = "<p class='bos-mesaj' style='padding:6px 0;'>👤 Müşteri seçilmedi — hızlı gönderim modu. Kaydetmek için önce müşteri seçmelisin.</p>";
      seciliAdresler = {};
    }

    var kur = aktifKuruOku();
    var kdv = CartData.kdvOku();
    var hesapla = function(u){ return CartData.hesapla(u, kur, kdv); };

    var bekleyenler = liste.filter(function(u){ return !u.hesaplandi; });
    var hesaplananlar = liste.filter(function(u){ return u.hesaplandi; });

    grupSariAlani.innerHTML = bekleyenler.length === 0 ? "" : HareketTablo.grupHtml({
      etiket: "🟡 HESAPLANACAK",
      etiketOrtali: true,
      urunler: bekleyenler,
      hesapla: function(){ return null; },
      zeminSinifi: "hareket-satir--sari"
    });

    var hesaplandiGosterVarMi = crIzinVarMi("sepetHesaplandiGoster");

    var hesaplananToplam = 0;
    hesaplananlar.forEach(function(u){ hesaplananToplam += hesapla(u).toplamEuro; });
    grupYesilAlani.innerHTML = (hesaplananlar.length === 0 || !hesaplandiGosterVarMi) ? "" : HareketTablo.grupHtml({
      etiket: "🟢 HESAPLANDI",
      etiketOrtali: true,
      etiketRozet: TIP_ETIKET_ROZET[secilenTip],
      etiketRozetSinifi: "islem-tipi",
      tip: secilenTip,
      urunler: hesaplananlar,
      hesapla: hesapla,
      zeminSinifi: "hareket-satir--yesil",
      genelToplam: hesaplananToplam,
      kur: kur,
      kurManuelMi: aktifKurManuelMi(),
      kurTiklanabilir: true
    });

    var kurRozeti = document.querySelector(".belge-gt-kur-ic--tiklanabilir");
    if(kurRozeti) kurRozeti.onclick = kurManuelOverlayAc;

    function siraHucresineSilTiklamasiEkle(tr, urun){
      var siraHucre = tr.querySelector("td.belge-td-sira");
      if(!siraHucre) return;
      var orijinalSira = siraHucre.textContent;
      function numaraHalineGetir(){
        siraHucre.innerHTML = "<span class='sepet-sira-numara'>" + orijinalSira + "</span>";
        siraHucre.querySelector(".sepet-sira-numara").onclick = function(e){
          e.stopPropagation();
          silButonuHalineGetir();
        };
      }
      function silButonuHalineGetir(){
        siraHucre.innerHTML = "<button class='sepet-sira-sil-btn' title='Sil'>🗑️</button>";
        siraHucre.querySelector("button").onclick = function(e){
          e.stopPropagation();
          if(!confirm(urun.ad + " sepetten kaldırılsın mı?")){ numaraHalineGetir(); return; }
          CartData.sil(urun.idx);
          sayfayiCiz();
        };
      }
      numaraHalineGetir();
    }
    grupSariAlani.querySelectorAll("tbody tr").forEach(function(tr, i){
      tr.style.cursor = "pointer";
      var urun = bekleyenler[i];
      tr.onclick = function(){ urunuHesaplamayaGonder(urun.idx); };
      siraHucresineSilTiklamasiEkle(tr, urun);
    });
    grupYesilAlani.querySelectorAll("tbody tr").forEach(function(tr, i){
      tr.style.cursor = "pointer";
      var urun = hesaplananlar[i];
      tr.onclick = function(){ urunuHesaplamayaGonder(urun.idx); };
      siraHucresineSilTiklamasiEkle(tr, urun);
    });

    var gonderVarMi = crIzinVarMi("sepetGonder");
    altButonSatiri.hidden = !gonderVarMi;
    var tamamMi = CartData.tamamHesaplandiMi();
    // "Kaydet" bir kaydı müşteriye bağladığı için müşteri şart (bkz.
    // kaydetGercekIslem) — "Görüntüle ve Gönder" müşterisiz de çalışır
    // (musterisizOnizlemeAc), o yüzden sadece hesaplanmış olmasını ister.
    document.getElementById("btnSepetKaydet").disabled = !tamamMi || !musteri;
    document.getElementById("btnSepetGonder").disabled = !tamamMi;
    devamUyari.hidden = tamamMi || !gonderVarMi;
  }catch(e){ hataGoster("Sepet çizilemedi: " + e.message); }
}

// ---------- Kaydetme mantığı (eskiden send-render.js'deydi) ----------

function anomaliUyarilariniTopla(sepet, kur, kdv){
  var uyarilar = [];
  sepet.forEach(function(u){
    if(u.iskonto && u.iskonto > 50){
      uyarilar.push("⚠️ " + u.ad + " için iskonto %" + u.iskonto + " — çok yüksek görünüyor.");
    }
    var h = CartData.hesapla(u, kur, kdv);
    if(u.dipFiyat && h.iskontoluFiyat < u.dipFiyat){
      uyarilar.push("🔴 " + u.ad + " dip maliyetin (" + CartData.fmt(u.dipFiyat) + " EURO) altında satılıyor (net: " + CartData.fmt(h.iskontoluFiyat) + " EURO) — zararına satış olabilir.");
    }
  });
  return uyarilar;
}

function kurTazeligeGetir(devamFn){
  // Savunmacı kontrol: AyarlarSync herhangi bir sebeple (eksik dosya, eski
  // sürüm, yükleme sırası hatası) beklenen fonksiyonları sağlamıyorsa,
  // Kaydet/Gönder akışı SESSİZCE bir JS hatasıyla kırılmasın — mevcut
  // kur geçerliyse onunla devam et, değilse kullanıcıdan elle iste.
  if(typeof AyarlarSync === "undefined" || typeof AyarlarSync.kurBayatMi !== "function"){
    if(CartData.kurOku() > 0){ devamFn(); return; }
    hataGoster("EUR/TL kuru bulunamadı. Ayarlar sayfasından kur girin.");
    return;
  }
  if(!AyarlarSync.kurBayatMi()){ devamFn(); return; }
  if(typeof AyarlarSync.otomatikKurGetir !== "function"){
    kurElleSorVeDevamEt(devamFn);
    return;
  }
  AyarlarSync.otomatikKurGetir(true, function(basarili){
    if(basarili && CartData.kurOku() > 0){ sayfayiCiz(); devamFn(); return; }
    kurElleSorVeDevamEt(devamFn);
  });
}

function kurElleSorVeDevamEt(devamFn){
  var girilen = prompt("⚠️ Güncel kur otomatik çekilemedi (internet bağlantısını kontrol et).\n\nBu satışın merkez ofisle tutarlı olması için bugünün EUR→TL kurunu elle gir:", CartData.kurOku()||"");
  var sayisalDeger = parseFloat((girilen||"").replace(",","."));
  if(!girilen || isNaN(sayisalDeger) || sayisalDeger<=0){
    hataGoster("Geçerli bir kur girilmeden kayıt/gönderim yapılamaz.");
    return;
  }
  try{
    AyarlarSync.kurKaydet(sayisalDeger, "elle", function(basarili){
      // Kaydı/gönderimi bu yüzden durdurmuyoruz (yerel değer zaten geçerli) —
      // sadece merkez senkronu başarısızsa kullanıcıyı bilgilendiriyoruz
      // (09.10.2026, kod incelemesi sonrası eklendi).
      if(!basarili){
        hataGoster("⚠️ Kur bu cihazda kaydedildi ama merkez sunucuya yazılamadı (bağlantı sorunu olabilir) — diğer cihazlar henüz bu kuru görmeyebilir.");
      }
    });
  }catch(e){
    hataGoster("Kur kaydedilemedi: " + e.message);
    return;
  }
  sayfayiCiz();
  devamFn();
}

function ilerletKaynagiOku(){
  try{
    var v = localStorage.getItem("weiconv2_ilerlet_kaynak");
    return v ? JSON.parse(v) : null;
  }catch(e){ return null; }
}

function ilerletKaynagiVarsaSekmeAyarla(){
  var kaynak = ilerletKaynagiOku();
  if(!kaynak || !kaynak.sonrakiAsamaSecenekleri || kaynak.sonrakiAsamaSecenekleri.length===0) return;
  var secenekler = kaynak.sonrakiAsamaSecenekleri;
  var oncedenSecilen = null;
  try{ oncedenSecilen = localStorage.getItem("weiconv2_onceden_secilen_tip"); }catch(e){}
  var uyari = document.createElement("div");
  uyari.className = "ilerlet-bilgi-kutu";
  if(secenekler.length === 1 || (oncedenSecilen && secenekler.indexOf(oncedenSecilen) !== -1)){
    secilenTip = (oncedenSecilen && secenekler.indexOf(oncedenSecilen) !== -1) ? oncedenSecilen : secenekler[0];
    uyari.textContent = "▶️ İlerletiliyor — kayıt tamamlanınca önceki aşamanın belgesi otomatik silinecek.";
  } else {
    revizeSecimBekleniyor = secenekler;
    uyari.textContent = "🔄 Revize ediliyor — Kaydet/Gönder'e basınca hangi aşamaya (" + secenekler.map(function(s){return TIP_ETIKET_ROZET[s];}).join(" / ") + ") dönüşeceğini seçeceksin.";
  }
  document.getElementById("ilerletBilgiAlani").appendChild(uyari);
}

function asamaSecimPopupunuAc(devamFn){
  var overlay = document.getElementById("asamaSecimOverlay");
  var kapsayici = document.getElementById("asamaSecimButonlari");
  kapsayici.innerHTML = revizeSecimBekleniyor.map(function(s){
    return "<button class='tip-btn tip-btn--" + s + "' data-secim='" + s + "'>" + TIP_ETIKET_ROZET[s] + "</button>";
  }).join("");
  kapsayici.querySelectorAll("[data-secim]").forEach(function(btn){
    btn.onclick = function(){
      secilenTip = this.getAttribute("data-secim");
      revizeSecimBekleniyor = null;
      overlay.hidden = true;
      sayfayiCiz();
      devamFn();
    };
  });
  document.getElementById("btnAsamaSecimVazgec").onclick = function(){ overlay.hidden = true; };
  overlay.hidden = false;
}

function oncedenSecilenTipVarsaUygula(){
  try{
    var tip = localStorage.getItem("weiconv2_onceden_secilen_tip");
    if(tip) secilenTip = tip;
  }catch(e){}
}

// KAYDET → ANA SAYFA (WG.210926.1647.588): "✓ Kaydet" işlemi bitirir, Gönder
// ekranına gitmez. Sepet ve seçili müşteri, "Ana Sayfa'ya Git" ve "İşlemi İptal
// Et" akışlarıyla AYNI şekilde temizlenir. Form görüntüleme/gönderme için
// "📋 Formu Görüntüle" butonu (niyet = "gonder") eskisi gibi send.html'e gider.
function kaydetSonrasiAnaSayfayaGit(){
  try{ localStorage.setItem("weiconv2_sepet", "[]"); }catch(e){}
  try{ CustomerData.secimiKaldir(); }catch(e){}
  ["weiconv2_sepet_kur_override","weiconv2_onceden_secilen_tip","weiconv2_hesapla_duzenle_idx",
   "weiconv2_ilerlet_kaynak","weiconv2_islem_yap_akisi","weiconv2_secili_iletisim",
   "weiconv2_son_kaydedilen_belge","weiconv2_gonderim_kanali","weicon_secili_musteri",
   "weiconv2_musteri_donus_sayfa","weiconv2_musteri_arama_durumu"].forEach(function(k){
    try{ localStorage.removeItem(k); }catch(e){}
  });
  window.location.href = "home.html";
}

function kaydetGercekIslem(niyet){
  try{
    var musteri = CustomerData.seciliyiOku();
    var sepet = CartData.liste();
    if(!musteri || sepet.length === 0) return;

    var kur = aktifKuruOku();
    var kdv = CartData.kdvOku();

    var uyarilar = anomaliUyarilariniTopla(sepet, kur, kdv);
    if(uyarilar.length > 0){
      if(!confirm("⚠️ Anomali Uyarısı\n\n" + uyarilar.join("\n\n") + "\n\nYine de kaydetmek istiyor musunuz?")) return;
    }

    document.getElementById("btnSepetKaydet").disabled = true;
    document.getElementById("btnSepetGonder").disabled = true;
    document.getElementById("btnSepetKaydet").textContent = "Kaydediliyor...";

    var kaynak = ilerletKaynagiOku();
    var devralinanKod = (kaynak && kaynak.kod) ? kaynak.kod : null;
    var devralinanTarih = (kaynak && kaynak.tarih) ? kaynak.tarih : null;
    var devralinanRota = (kaynak && kaynak.rota) ? kaynak.rota : null;
    SendData.kaydet(secilenTip, musteri, sepet, kur, kdv, seciliAdresler, devralinanKod, devralinanTarih, devralinanRota, function(basarili, sonuc, revizeMi){
      if(basarili){
        if(kaynak){
          SendData.kaynakSil(kaynak.tip, kaynak.ts, function(){});
          localStorage.removeItem("weiconv2_ilerlet_kaynak");
        }
        // send.html'e taşınacak bağlam — sepeti/müşteriyi BURADA boşaltmıyoruz,
        // "Geri — Sepete Dön ve Düzelt" hâlâ çalışabilsin diye (aynı gün+
        // müşteri+ürün seti eşleşmesiyle SendData.kaydet zaten revize eder).
        if(niyet === "kaydet"){ kaydetSonrasiAnaSayfayaGit(); return; }
        localStorage.setItem("weiconv2_son_kaydedilen_belge", JSON.stringify({
          musteri: musteri, sepet: sepet, tip: secilenTip, kur: kur, kdv: kdv,
          kayit: sonuc, revizeMi: !!revizeMi, niyet: niyet
        }));
        window.location.href = "send.html";
      } else {
        document.getElementById("btnSepetKaydet").disabled = false;
        document.getElementById("btnSepetGonder").disabled = false;
        document.getElementById("btnSepetKaydet").textContent = "✓ Kaydet";
        hataGoster("Kaydetme başarısız: " + (sonuc && sonuc.message ? sonuc.message : "bilinmeyen hata"));
      }
    }, aktifKurManuelMi());
  }catch(e){ hataGoster("Kaydet işlemi başarısız: " + e.message); }
}

function kaydetTiklandi(niyet){
  if(!CartData.tamamHesaplandiMi()) return;
  if(niyet === "gonder" && !CustomerData.seciliyiOku()){
    musterisizOnizlemeAc();
    return;
  }
  var devam = function(){ kurTazeligeGetir(function(){ kaydetGercekIslem(niyet); }); };
  if(revizeSecimBekleniyor){ asamaSecimPopupunuAc(devam); return; }
  devam();
}

// ---- Müşterisiz hızlı gönder — kayıt oluşturmadan sadece paylaşım ----
// DÜZELTME (29.09.2026, Abdullah'ın bildirdiği hata): sepetteki ürün
// nesnesinde "iskBirim"/"toplamEuro" diye bir alan HİÇ tutulmuyor — bunlar
// sadece CartData.hesapla()'nın anlık ÇIKTISI, kayıtlı üründe yok. Bu yüzden
// birim fiyat ve toplam metinde hep 0,00 çıkıyordu. Artık her satır için
// CartData.hesapla() GERÇEKTEN çağrılıyor, ürün kodu (Berta/Abas) da satıra
// ekleniyor — telefonda tanışıp sadece WhatsApp'tan fiyat isteyen müşteriye
// tek dokunuşla doğru, eksiksiz bir metin gönderilebilsin diye.
function musterisizOzetMetniOlustur(){
  var sepet = CartData.liste();
  var kur = aktifKuruOku();
  var kdv = CartData.kdvOku();
  var satirlar = sepet.map(function(u, i){
    var h = CartData.hesapla(u, kur, kdv);
    var kodParcalari = [];
    if(u.berta) kodParcalari.push("B" + u.berta);
    if(u.abas) kodParcalari.push("A" + u.abas);
    var kod = kodParcalari.length ? " (" + kodParcalari.join(" / ") + ")" : "";
    var netFiyatSatiri = (u.ozelEtiket === "bedelsiz")
      ? "   " + (u.adet||0) + " adet — NUMUNE (bedelsiz)"
      : "   " + (u.adet||0) + " adet x " + CartData.fmt(h.iskontoluFiyat) + " EURO = " + CartData.fmt(h.toplamEuro) + " EURO";
    return (i+1) + ". " + u.ad + kod + "\n" + netFiyatSatiri;
  });
  var toplamlar = CartData.genelToplam(kur, kdv);
  var metin = "WEICON Fiyat Bilgisi\n\n" + satirlar.join("\n\n") + "\n\nToplam: " + CartData.fmt(toplamlar.toplamEuro) + " EURO";
  if(kur) metin += " (≈ " + Math.round(toplamlar.toplamEuro*kur).toLocaleString("tr-TR") + " TL)";
  return metin;
}
// Gerçek Gönder ekranıyla (send.html) AYNI görünümde: üstte WhatsApp/Mail,
// altında düzenlenebilir mesaj metni + ürün tablosu (HareketTablo ile,
// diğer TÜM belge/gönder ekranlarıyla birebir aynı tasarım). Müşteri
// kaydı YOK, kayıt yok, İşlem Geçmişi'ne düşmez.
// GÖNDERİM BİÇİMİ (13.10.2026, Abdullah onayı — mockup üzerinden): "metin"
// (varsayılan, eski davranış) veya "tablo" (ÜRÜN TABLOSU'nu gerçek PNG
// görsele çevirip paylaşır — bkz. musterisizTabloGonder). Popup her
// açıldığında "metin"e sıfırlanır.
var musterisizBicim = "metin";
function bicimTiklariniBagla(){
  var btnMetin = document.getElementById("btnBicimMetin");
  var btnTablo = document.getElementById("btnBicimTablo");
  if(!btnMetin || !btnTablo) return;
  btnMetin.onclick = function(){
    musterisizBicim = "metin";
    btnMetin.classList.add("sekme-btn--secili");
    btnTablo.classList.remove("sekme-btn--secili");
  };
  btnTablo.onclick = function(){
    musterisizBicim = "tablo";
    btnTablo.classList.add("sekme-btn--secili");
    btnMetin.classList.remove("sekme-btn--secili");
  };
}
// TABLO GÖRSELİ MESAJI (13.10.2026, Abdullah onayı — mockup üzerinden):
// Tablo Görseli gönderilirken tablonun ALTINA eklenen sabit, kısa mesaj —
// WhatsApp'a ayrıca metin gitmiyor, görselin kendi içine gömülüyor. Toplam
// ürün ADEDİ (sepetteki tüm satırların adetleri toplamı) 1 ise tekil, 1'den
// fazlaysa çoğul ifade kullanılır.
// DÜZELTME (13.10.2026, Abdullah'ın bildirdiği hata): bir önceki sürümde
// bu, Abdullah'ın örnek verdiği "ürün/ürünler" ibaresi AYNEN sabit metne
// geçirilmişti — oysa istenen, tablodaki ürün SAYISINA göre sistemin kendi
// seçtiği tekil/çoğul metindi. Düzeltildi: tablodaki satır (ürün çeşidi)
// sayısı 1 ise tekil, birden fazlaysa çoğul.
function musterisizTabloMesajiOlustur(){
  var urunSayisi = CartData.liste().length;
  return urunSayisi <= 1
    ? "İstediğiniz ürün için fiyat bilgisi ektedir."
    : "İstediğiniz ürünler için fiyat bilgisi ektedir.";
}
// TABLO TARİHİ (13.10.2026, Abdullah'ın isteğiyle) — gönderilen tablo
// görseline günün tarihi ekleniyor, GG.AA.YYYY formatında.
function musterisizTabloTarihiOlustur(){
  var d = new Date();
  function iki(n){ return (n<10?"0":"")+n; }
  return iki(d.getDate()) + "." + iki(d.getMonth()+1) + "." + d.getFullYear();
}
function musterisizOnizlemeAc(){
  try{
    var kur = aktifKuruOku();
    var kdv = CartData.kdvOku();
    var hesapla = function(u){ return CartData.hesapla(u, kur, kdv); };
    var toplamlar = CartData.genelToplam(kur, kdv);
    document.getElementById("musterisizOnizlemeMetin").value = musterisizOzetMetniOlustur();
    // DÜZELTME (13.10.2026, Abdullah onayı — mockup üzerinden): mesaj artık
    // tablonun ÜSTÜNDE (altında değil). HareketTablo.grupHtml'e kur/kurManuelMi
    // BİLEREK geçilmiyor — bu, "Bu işlem kuru" kutusunu, satır altı ≈TL
    // satırlarını ve GENEL TOPLAM'ın ≈TL alt satırını otomatik olarak
    // kaldırır (bkz. hareket-tablo.js — bu alanlar sadece opts.kur varsa
    // render edilir); gönderilen görselde SADECE EURO tutarları kalır. Bu
    // SADECE bu önizleme/gönderim alanını etkiler — Sepet ekranındaki
    // HESAPLANACAK/HESAPLANDI gruplarının kendi kur/TL gösterimi (sayfayiCiz)
    // DEĞİŞMEDİ.
    document.getElementById("musterisizOnizlemeTablo").innerHTML =
      "<div class='musterisiz-tablo-ust'>"
      + "<span class='musterisiz-tablo-mesaj'>" + musterisizTabloMesajiOlustur() + "</span>"
      + "<span class='musterisiz-tablo-tarih'>" + musterisizTabloTarihiOlustur() + "</span>"
      + "</div>"
      + HareketTablo.grupHtml({
        urunler: CartData.liste(),
        hesapla: hesapla,
        kanal: "whatsapp",
        primGizli: true,
        genelToplam: toplamlar.toplamEuro
      });
    musterisizBicim = "metin";
    var btnMetinEl = document.getElementById("btnBicimMetin");
    var btnTabloEl = document.getElementById("btnBicimTablo");
    if(btnMetinEl && btnTabloEl){
      btnMetinEl.classList.add("sekme-btn--secili");
      btnTabloEl.classList.remove("sekme-btn--secili");
    }
    document.getElementById("musterisizGonderOverlay").hidden = false;
  }catch(e){ hataGoster("Önizleme açılamadı: " + e.message); }
}
// Mesaj metni textarea'da elle düzenlenebildiği için WhatsApp/Mail butonları
// metni YENİDEN ÜRETMEZ — o anda kutuda ne yazıyorsa AYNEN onu gönderir.
// SEPETİ SIFIRLA (13.10.2026, Abdullah'ın isteğiyle): Müşterisiz Gönder'de
// WhatsApp/Mail'e basıldıktan sonra sepet artık elle temizlenmeyi beklemiyor
// — otomatik boşalıyor, sayfa cart.html'e TAZE (boş sepetle) dönüyor. Kısa
// bir gecikmeyle çağrılıyor ki WhatsApp/Mail uygulamasına geçiş/paylaşım
// penceresi önce tetiklensin.
function musterisizSepetiSifirlaVeYenile(){
  setTimeout(function(){
    try{
      localStorage.setItem("weiconv2_sepet", "[]");
      localStorage.removeItem("weiconv2_sepet_kur_override");
    }catch(e){}
    window.location.href = "cart.html";
  }, 400);
}
function musterisizWhatsappGonder(){
  if(musterisizBicim === "tablo"){ musterisizTabloGonder("whatsapp"); return; }
  var metin = document.getElementById("musterisizOnizlemeMetin").value;
  window.open("https://wa.me/?text=" + encodeURIComponent(metin), "_blank");
  musterisizSepetiSifirlaVeYenile();
}
function musterisizMailGonder(){
  if(musterisizBicim === "tablo"){ musterisizTabloGonder("mail"); return; }
  var metin = document.getElementById("musterisizOnizlemeMetin").value;
  var konu = encodeURIComponent("WEICON Fiyat Bilgisi");
  window.location.href = "mailto:?subject=" + konu + "&body=" + encodeURIComponent(metin);
  musterisizSepetiSifirlaVeYenile();
}
// TABLO GÖRSELİ OLARAK GÖNDER (13.10.2026, Abdullah onayı): ÜRÜN TABLOSU
// (#musterisizOnizlemeTablo), Gönder ekranındaki (send-render.js
// belgeGorseliniOlustur) AYNI yöntemle — html2canvas — gerçek bir PNG'ye
// çevrilir, ardından navigator.share ile (destekleniyorsa) dosya EKİ olarak
// paylaşım menüsüne açılır; MESAJ kutusundaki metin paylaşımın "text"i olur.
// navigator.share desteklenmiyorsa görsel indirilir ve kullanıcı WhatsApp/
// Mail'e elle ekler (aynı yedek yöntem send-render.js'de de kullanılıyor).
function musterisizTabloGonder(kanal){
  try{
    if(typeof html2canvas === "undefined"){
      hataGoster("Görsel oluşturulamadı — sayfayı yenileyip tekrar dene.");
      return;
    }
    var alan = document.getElementById("musterisizOnizlemeTablo");
    html2canvas(alan, {backgroundColor:"#ffffff", scale:2}).then(function(canvas){
      canvas.toBlob(function(blob){
        if(!blob){ hataGoster("Görsel oluşturulamadı."); return; }
        var dosya = new File([blob], "WEICON_Fiyat_Bilgisi.png", {type:"image/png"});
        // DÜZELTME (13.10.2026, Abdullah'ın isteğiyle): "Tablo Görseli"
        // seçiliyken SADECE görsel gitmeli — MESAJ kutusundaki metin ayrıca
        // caption/body olarak eklenmiyor (eskiden navigator.share'in "text"
        // alanına ve mailto body'sine de konuyordu, bu da görselin ALTINA
        // aynı bilgiyi tekrar eden ikinci bir metin mesajı/satırı olarak
        // gidiyordu — ekran görüntüsüyle doğrulandı).
        if(navigator.canShare && navigator.canShare({files:[dosya]})){
          navigator.share({files:[dosya]}).then(function(){
            musterisizSepetiSifirlaVeYenile();
          }).catch(function(err){
            if(err && err.name!=="AbortError") hataGoster("Paylaşım penceresi kapatıldı.");
          });
        } else {
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a");
          a.href = url; a.download = "WEICON_Fiyat_Bilgisi.png";
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          URL.revokeObjectURL(url);
          alert("Bu cihazda direkt paylaşım desteklenmiyor — tablo görseli indirildi. Şimdi " + (kanal==="whatsapp"?"WhatsApp":"Mail") + " açılacak, resmi elle ekleyebilirsin.");
          if(kanal === "whatsapp"){
            window.open("https://wa.me/", "_blank");
          } else {
            window.location.href = "mailto:?subject=" + encodeURIComponent("WEICON Fiyat Bilgisi");
          }
          musterisizSepetiSifirlaVeYenile();
        }
      }, "image/png");
    }).catch(function(){ hataGoster("Görsel oluşturulamadı."); });
  }catch(e){ hataGoster("Tablo gönderimi başarısız: " + e.message); }
}

window.addEventListener("error", function(ev){
  hataGoster("HATA: " + ev.message + " (" + (ev.filename||"").split("/").pop() + ":" + ev.lineno + ")");
});

document.addEventListener("DOMContentLoaded", function(){
  tarihiGuncelle();
  oncedenSecilenTipVarsaUygula();
  ilerletKaynagiVarsaSekmeAyarla();
  kurManuelOverlayBaglantilariKur();
  var btnMenuEl = document.getElementById("btnMenu");
  if(btnMenuEl) btnMenuEl.onclick = function(){ window.location.href = "menu.html"; };
  document.getElementById("btnSepetKaydet").onclick = function(){ kaydetTiklandi("kaydet"); };
  document.getElementById("btnSepetGonder").onclick = function(){ kaydetTiklandi("gonder"); };
  document.getElementById("btnMusterisizWhatsapp").onclick = musterisizWhatsappGonder;
  document.getElementById("btnMusterisizMail").onclick = musterisizMailGonder;
  document.getElementById("btnMusterisizVazgec").onclick = function(){ document.getElementById("musterisizGonderOverlay").hidden = true; };
  bicimTiklariniBagla();
  document.getElementById("btnMusteriGecmisKapat").onclick = function(){ document.getElementById("musteriGecmisOverlay").hidden = true; };

  // İşlemi İptal Onay Popup — SADECE "🗑️ İşlemi İptal Et" butonu kullanıyor
  // (02.10.2026: "Geri" tuşu artık bunu tetiklemiyor, bkz. yukarısı).
  function herSeyiSifirlaVeGit(hedefUrl){
    localStorage.setItem("weiconv2_sepet", "[]");
    localStorage.removeItem("weiconv2_sepet_kur_override");
    CustomerData.secimiKaldir();
    try{
      localStorage.removeItem("weiconv2_onceden_secilen_tip");
      localStorage.removeItem("weiconv2_hesapla_duzenle_idx");
      localStorage.removeItem("weiconv2_ilerlet_kaynak");
      localStorage.removeItem("weiconv2_islem_yap_akisi");
    }catch(e){}
    window.location.href = hedefUrl;
  }
  var iptalOnayHedefUrl = null;
  function iptalOnayGoster(hedefUrl){
    iptalOnayHedefUrl = hedefUrl;
    document.getElementById("iptalOnayOverlay").hidden = false;
  }
  document.getElementById("btnIptalOnayEvet").onclick = function(){
    var hedef = iptalOnayHedefUrl || "home.html";
    document.getElementById("iptalOnayOverlay").hidden = true;
    herSeyiSifirlaVeGit(hedef);
  };
  document.getElementById("btnIptalOnayVazgec").onclick = function(){
    document.getElementById("iptalOnayOverlay").hidden = true;
    iptalOnayHedefUrl = null;
  };
  // GERİ DÖN DÜZELTMESİ (02.10.2026, Abdullah'ın isteğiyle): "Geri" tuşu artık
  // sepeti/müşteriyi SİLİP "İşlemi İptal Ediyorsunuz" uyarısı göstermiyor —
  // gerçekten NEREDEN gelindiyse oraya (history.back()) dönüyor, hiçbir veri
  // kaybı olmadan ("Ana Sayfa" tuşuyla aynı mantık: href="home.html" sadece
  // JS çalışmazsa diye yedek). Sepeti silen TEK yer artık aşağıdaki
  // "🗑️ İşlemi İptal Et" butonu — kendi onay penceresiyle DEĞİŞMEDİ.
  // DÖNÜŞ ROTASI (06.10.2026, Abdullah'ın isteğiyle — "kesin kural"):
  // küçük pencereden (Müşteri Bul) bu akışa girildiyse, Geri/İptal Et
  // artık tarayıcı geçmişine (history.back()) güvenmek yerine doğrudan
  // customer.html'e dönüyor — "en fazla müşteri arama motoru sayfasına
  // döner" kuralı. Bayrak yoksa (eski giriş noktaları) davranış DEĞİŞMEDİ.
  var cartDonusRotasi = null;
  try{ cartDonusRotasi = localStorage.getItem("weiconv2_musteri_donus_sayfa"); }catch(e){}
  var geriLink = document.querySelector(".nav-btn--geri");
  if(geriLink){
    geriLink.addEventListener("click", function(ev){
      if(cartDonusRotasi === "customer.html"){
        ev.preventDefault();
        window.location.href = "customer.html";
        return;
      }
      if(window.history.length > 1){
        ev.preventDefault();
        window.history.back();
      }
    });
  }
  document.getElementById("btnSepetIptal").onclick = function(){
    iptalOnayGoster(cartDonusRotasi === "customer.html" ? "customer.html" : "home.html");
  };

  CustomerData.listeDegistiginde(sayfayiCiz);
  window.addEventListener("weiconAuthHazir", sayfayiCiz);
  // Sepet, bu cihazda boşken Firebase yedeğinden geri yüklenirse (bkz.
  // cart-data.js fbYukle) ekranı yeniden çiz (09.10.2026).
  document.addEventListener("weiconSepetGeriYuklendi", sayfayiCiz);
  sayfayiCiz();
});
