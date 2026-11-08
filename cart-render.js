/*
  cart-render.js — TKP.08.11.26-12:34.1504
  GÜNCELLEME (04.11.2026, Abdullah onayı): İşlem Geçmişi penceresi satırları —
  tarih tek satır + altında (Tip), sayılar altında küçük EURO/% (cart-style.css).
  (önceki: TKP.02.11.26-10:22.1368)
  ==============
  02.11.2026: "primSatirIci" bayrağı kaldırıldı (PRİM artık tüm sayfalarda
  ortak GENEL TOPLAM kutusunun içinde — hareket-tablo.js genelToplamHtml);
  Sepet'in görünümü DEĞİŞMEDİ.
  GÜNCELLEME (01.11.2026, Abdullah onayı — mockup üzerinden): HESAPLANDI
  grubunun HareketTablo.grupHtml() çağrısına "primSatirIci:true" eklendi —
  PRİM artık GENEL TOPLAM kutusunun içinde, "Bu işlem kuru" ile aynı satırda
  (bkz. hareket-tablo.js).
  27.10.2026 PERFORMANS KAZANIMI: html2canvas artık sayfa açılışında değil,
  "Tablo Görseli Gönder" gerçekten tıklandığında ilk kez indiriliyor (bkz.
  html2canvasYukle()). Davranış/çıktı değişmedi.
  Sepeti HESAPLANACAK (sarı) / HESAPLANDI (yeşil) belge-tablosu gruplarıyla
  çizer; HESAPLANDI grubunun etiketinde artık EURO KUR rozeti de var.
  Bir ürüne dokununca calc.html'e gidilir (hesapla/düzenle). Kaydet/Gönder
  artık GERÇEKTEN kaydeder (kur tazelik kontrolü + anomali uyarısı + varsa
  aşama seçimi dahil) — ikinci bir onay ekranına gerek yok; başarılı kayıt
  sonrası: "Kaydet" -> Ana Sayfa, "📨 Önizleme İletişim" -> send.html?ac=iletisim
  (doğrudan Mail/WhatsApp kanal seçimi açık gelir, bkz. aşağıdaki not).
  26.10.2026 — KRİTİK HATA DÜZELTMESİ: sepeti sıfırlayan 3 yer de (İşlemi
  İptal Et, Kaydet sonrası Ana Sayfa, Müşterisiz Gönder sonrası) artık
  CartData.sifirla() kullanıyor — doğrudan localStorage yazmak CartData'nın
  bellek içi dizisini boş bırakıyordu, bu da "iptal ediyorum ama sepet hâlâ
  dolu görünüyor" hatasına yol açıyordu (bkz. cart-data.js).
*/

// KAYDET BİLDİRİMİ (03.11.2026, Abdullah onayı): üst bardaki Kaydet tuşuyla
// işlem kaydedilince, Ana Sayfa'ya geçmeden önce kısa bir onay gösterilir.
function kayitBildirimiGoster(mesaj){
  var kutu = document.createElement("div");
  kutu.textContent = "✓ " + mesaj;
  kutu.style.cssText = "position:fixed;top:8px;left:8px;right:8px;background:#0e6b34;color:#fff;padding:12px;border-radius:10px;font-size:14px;font-weight:800;text-align:center;z-index:99999;box-shadow:0 4px 14px rgba(0,0,0,.25);";
  document.body.appendChild(kutu);
  setTimeout(function(){ kutu.remove(); }, 2500);
}

// İPTAL BİLDİRİMİ (03.11.2026, Abdullah'ın isteğiyle): Sepet sayfasında Kapat (✕)
// = işlemi iptal et + sepeti boşalt; onay penceresi yok, sadece kısa bilgi.
function iptalBildirimiGoster(){
  var kutu = document.createElement("div");
  kutu.textContent = "İşlem iptal ediliyor…";
  kutu.style.cssText = "position:fixed;top:8px;left:8px;right:8px;background:#b54708;color:#fff;padding:12px;border-radius:10px;font-size:14px;font-weight:800;text-align:center;z-index:99999;box-shadow:0 4px 14px rgba(0,0,0,.3);";
  document.body.appendChild(kutu);
  setTimeout(function(){ kutu.remove(); }, 2500);
}

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

// KISALTMA — KESİN KURAL (19.10.2026, Abdullah onayı — "%20 büyüt" turu):
// TIP_ETIKET_BELGE (belge-render.js) ile BİREBİR aynı kısaltmalar.
var TIP_ETIKET_ROZET = TipEtiket.kisa; // 08.11.2026: tek kaynak (tip-etiketleri.js)
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
    // 04.11.2026: uygulama içi kur kartı (kur-panel.js); yoksa eski davranış.
    if(typeof KurPanel !== "undefined") KurPanel.ac();
    else window.open("https://www.tcmb.gov.tr/kurlar/kurlar_tr.html", "_blank");
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
// gonderDisabledMi (01.11.2026): sepet henüz tamamlanmadıysa (hesaplanmamış
// ürün varsa) veya "sepetGonder" izni yoksa true geçilir — izin yoksa buton
// hiç basılmaz (gonderButonu olarak izne göre render edilir), izin VARSA
// ama sepet tamam değilse buton görünür ama pasif/tıklanamaz kalır.
function cariBilgiOzetiHtml(musteri, gonderDisabledMi){
  var izinVar = crIzinVarMi("sepetGonder");
  return MusteriSeridi.html(musteri, {gecmisAsili: true, gonderButonu: izinVar, gonderDisabled: !!gonderDisabledMi});
}

// MÜŞTERİSİZ GÖNDER ŞERİDİ (01.11.2026, Abdullah onayı — mockup üzerinden):
// müşteri seçili değilken cariBilgiAlani'nda gösterilen ince şerit —
// SADECE Gönder ikonunun (musterisizOnizlemeAc akışı) her zaman erişilebilir
// olmasını sağlar, kayıt/müşteri bilgisi YOK. tamamMi false ise buton pasif.
function musterisizGonderSeridiHtml(tamamMi){
  var ikon = (typeof IkonSvg !== "undefined") ? IkonSvg.svg("gonder") : "";
  return "<div class='sepet-musterisiz-gonder-serit'>"
    + "<span class='smg-metin'>👤 Müşteri seçilmedi</span>"
    + "<button type='button' class='ms-gonder-btn' id='btnSepetGonderMusterisiz' title='Gönder' aria-label='Gönder'" + (tamamMi ? "" : " disabled") + ">" + ikon + "</button>"
    + "</div>";
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
var TIP_ETIKET_MUSTERI_GECMIS = TipEtiket.kisa;
// Müşteri şeridine dokununca geçmiş alımlar açılır (05.11.2026, Abdullah onayı);
// şeridin içindeki Gönder ikonu bundan ETKİLENMEZ.
function musteriSeridiGecmisBagla(){
  var serit = document.querySelector("#cariBilgiAlani .musteri-serit");
  if(!serit) return;
  serit.onclick = function(ev){
    if(ev.target && ev.target.closest && ev.target.closest(".ms-gonder-btn")) return;
    musteriGecmisiniAc();
  };
}

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
        function sayiBirim(sayi, birim, stil){
          return "<span class='belge-para-sayi'" + (stil ? " style='" + stil + "'" : "") + ">" + sayi + "</span><span class='belge-para-birim'" + (stil ? " style='" + stil + "'" : "") + ">" + birim + "</span>";
        }
        return "<tr>"
          + "<td class='mg-urun'>" + htmlEsc(g.ad) + "</td>"
          + "<td class='mg-tarih'><b>" + tarihFormatli + "</b>" + (tipEtiket ? "<span class='mg-tip'>(" + tipEtiket + ")</span>" : "") + "</td>"
          + "<td>" + (k.adet||0) + "</td>"
          + "<td>" + sayiBirim(CartData.fmt(k.listeFiyat), "EURO") + "</td>"
          + "<td>" + sayiBirim(CartData.fmt(k.iskonto), "%", "color:#c0392b;") + "</td>"
          + "<td><span class='rozet-net'>" + sayiBirim(CartData.fmt(k.netFiyat), "EURO") + "</span></td>"
          + "</tr>";
      }).join("");
    }
    document.getElementById("musteriGecmisOverlay").hidden = false;
  }catch(e){ hataGoster("İşlem geçmişi açılamadı: " + e.message); }
}

// SAĞA/SOLA ÇEKİNCE İŞLEM İPTAL (26.10.2026, Abdullah onayı — mockup
// üzerinden). Kod/tarih şeridini (.belge-belge-baslik-serit--mavi) çekince
// kırmızı "🗑️ İşlemi İptal Et" belirir — dokununca gerçek buton mantığı
// TEK yerde kalsın diye, aşağıda (DOMContentLoaded içinde) zaten tanımlı
// #btnSepetIptal'e .click() ile devrediliyor — o buton artık hiç
// GÖSTERİLMİYOR (her zaman [hidden]), sadece bu şeritten tetiklenen
// programatik bir hedef olarak duruyor. Kendi onay penceresi (iptalOnayGoster/
// #iptalOnayOverlay) DEĞİŞMEDİ — çekme + dokunma + "Evet, Sil ve Çık" onayı,
// 3 kasıtlı adım (bütün sepeti/müşteriyi silip ana sayfaya dönen, geri
// alınamaz bir işlem olduğu için satır bazlı "çekince SİL"den daha temkinli
// tutuldu — o işlemde onay sorulmuyordu, burada soruluyor).
function kodSeridiIptalEtkilesimBagla(container){
  if(!container) return;
  var serit = container.querySelector(".belge-belge-baslik-serit--mavi");
  if(!serit || serit.querySelector(".islem-serit-iptal-btn")) return;
  serit.classList.add("islem-serit-iptal-sarmalayici");
  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "islem-serit-iptal-btn";
  btn.textContent = "🗑️ İşlemi İptal Et — Sepeti Boşalt";
  btn.setAttribute("aria-label", "İşlemi iptal et, sepeti boşalt");
  btn.onclick = function(e){
    e.stopPropagation();
    var proxy = document.getElementById("btnSepetIptal");
    if(proxy) proxy.click();
  };
  serit.appendChild(btn);

  var basX = null, basY = null, kaydirildiMi = false;
  serit.addEventListener("touchstart", function(e){
    if(e.touches.length !== 1) return;
    basX = e.touches[0].clientX;
    basY = e.touches[0].clientY;
  }, {passive:true});
  serit.addEventListener("touchend", function(e){
    if(basX === null) return;
    var t = (e.changedTouches && e.changedTouches[0]) || null;
    var dx = t ? (t.clientX - basX) : 0;
    var dy = t ? (t.clientY - basY) : 0;
    basX = null; basY = null;
    if(Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy) * 1.5){
      kaydirildiMi = true;
      serit.classList.toggle("islem-serit-iptal-acik");
    }
  }, {passive:true});
  serit.addEventListener("click", function(){
    if(kaydirildiMi){ kaydirildiMi = false; return; }
    if(serit.classList.contains("islem-serit-iptal-acik")){
      serit.classList.remove("islem-serit-iptal-acik");
    }
  });
}

function sayfayiCiz(){
  try{
    var liste = CartData.liste();
    var bosMesaj = document.getElementById("sepetBosMesaj");
    var devamUyari = document.getElementById("devamUyari");
    var grupSariAlani = document.getElementById("grupSariAlani");
    var grupYesilAlani = document.getElementById("grupYesilAlani");
    var musteri = CustomerData.seciliyiOku();
    // YUKARI TAŞINDI (01.11.2026): Gönder butonu artık cariBilgiAlani
    // içinde render edildiği için (musteri-serit ya da müşterisiz şerit),
    // etkin/pasif durumunun HTML üretilirken hazır olması gerekiyor.
    var gonderVarMi = crIzinVarMi("sepetGonder");
    var tamamMi = CartData.tamamHesaplandiMi();

    if(liste.length === 0){
      // MÜŞTERİ ŞERİDİ BOŞ SEPETTE DE (03.11.2026, Abdullah'ın isteğiyle):
      // müşteri daha önce seçildiyse sepet sayfası açılır açılmaz arama
      // kutusunun altında görünür — ürün eklenmesi beklenmez.
      if(musteri){
        document.getElementById("cariBilgiAlani").innerHTML = cariBilgiOzetiHtml(musteri, true);
        musteriSeridiGecmisBagla();
      } else {
        document.getElementById("cariBilgiAlani").innerHTML = "";
      }
      grupSariAlani.innerHTML = "";
      grupYesilAlani.innerHTML = "";
      bosMesaj.hidden = false;
      bosMesaj.textContent = "Sepetiniz boş. Yukarıdaki arama kutusundan ürün bulup HESAPLA'ya dokunun.";
      document.getElementById("btnSepetIptal").hidden = true;
      devamUyari.hidden = true;
      return;
    }
    bosMesaj.hidden = true;
    // KALDIRILDI (26.10.2026, Abdullah onayı — mockup üzerinden): bu buton
    // artık HİÇ gösterilmiyor ("En altta ki paneli kaldır") — [hidden]
    // olarak kalıyor, SADECE yukarıdaki kodSeridiIptalEtkilesimBagla'nın
    // programatik .click() hedefi olarak DOM'da duruyor (onclick mantığı
    // aşağıda, DOMContentLoaded içinde, DEĞİŞMEDİ).

    // MÜŞTERİSİZ SEPET (13.10.2026, Abdullah onayı): müşteri seçilmeden de
    // ürün eklenip hesaplanabilir — Cari Bilgi şeridi/adresler SADECE
    // müşteri seçiliyse gösterilir. GÖNDER (01.11.2026'dan itibaren TEK
    // buton — eski "Kaydet" kalktı) müşteri seçiliyse kaydedip gönderiyor,
    // müşteri seçili değilse müşterisiz hızlı gönderim akışına
    // (musterisizOnizlemeAc) düşüyor — bkz. kaydetTiklandi(). Her iki
    // durumda da Gönder erişilebilir olmalı, bu yüzden müşterisiz modda da
    // artık ince bir "Gönder" şeridi gösteriliyor (eskiden bu alan tamamen
    // boştu).
    if(musteri){
      document.getElementById("cariBilgiAlani").innerHTML = cariBilgiOzetiHtml(musteri, !tamamMi);
      musteriSeridiGecmisBagla();
      // EKLENDİ (27.10.2026, Abdullah onayı — "Yeni Rota" turu): isme
      // dokununca Cari Kart (fatura/teslimat/yetkili seçimi + not ekleme
      // için) AYRI bir sayfa olarak açılır — musteri-serit.js'e (11 sayfada
      // paylaşılan bileşen) DOKUNULMADI, tıklama SADECE burada eklendi.
      // Görsel ipucu/ikon YOK (Abdullah'ın isteğiyle) — bkz. cart-style.css
      // #cariBilgiAlani .ms-ad (sadece imleç).
      // KALDIRILDI (03.11.2026, Abdullah onayı): müşteri adına dokununca Cari
      // Kart açılması artık Sepet'te YOK — yetkili/teslimat seçimi Gönder
      // (send.html) ekranındaki müşteri adına dokunarak yapılır.
      adresleriBelirle(musteri);
    } else {
      // DEĞİŞİKLİK (01.11.2026, Abdullah onayı): müşterisiz modda artık
      // boş bırakılmıyor — Gönder'in HER ZAMAN erişilebilir olması gerektiği
      // için ince bir şerit geldi (sadece izin varsa gösterilir, eski
      // "sepetGonder" izin kuralıyla aynı).
      document.getElementById("cariBilgiAlani").innerHTML = gonderVarMi ? musterisizGonderSeridiHtml(tamamMi) : "";
      seciliAdresler = {};
    }
    var gonderBtnEl = document.getElementById("btnMusteriGonder") || document.getElementById("btnSepetGonderMusterisiz");
    if(gonderBtnEl) gonderBtnEl.onclick = function(){ kaydetTiklandi("gonder"); };

    var kur = aktifKuruOku();
    var kdv = CartData.kdvOku();
    var hesapla = function(u){ return CartData.hesapla(u, kur, kdv); };

    var bekleyenler = liste.filter(function(u){ return !u.hesaplandi; });
    var hesaplananlar = liste.filter(function(u){ return u.hesaplandi; });

    // KOD/TARİH ŞERİDİ (15.10.2026, Abdullah onayı) — Belge Önizleme'deki
    // "TÜR · KOD TARİH" şeridi artık Sepet'in HER İKİ grubunda da var.
    // Gerçek SP/FT/PF/NM kodu ancak Gönder'de kaydet() çağrılınca
    // (send-data.js) üretiliyor — burada henüz yok, bu yüzden "(taslak)"
    // ibaresiyle BUGÜNÜN tarih/saatini gösteriyoruz.
    var simdiKod = new Date();
    var kodTarihMetni = String(simdiKod.getDate()).padStart(2,"0") + "." + String(simdiKod.getMonth()+1).padStart(2,"0") + "." + simdiKod.getFullYear()
      + " " + String(simdiKod.getHours()).padStart(2,"0") + ":" + String(simdiKod.getMinutes()).padStart(2,"0");

    // TASARIM EŞİTLİĞİ (15.10.2026, Abdullah'ın bildirdiği hata): HESAPLANACAK
    // grubu HESAPLANDI ile aynı tasarıma (kod/tarih şeridi + tür rozeti)
    // sahip değildi — artık kendi (turuncu) rengiyle AYNI yapı burada da var.
    // GÜNCELLEME (19.10.2026, Abdullah onayı — "7 fotoğraf" turu): "(taslak)"
    // ibaresi ve tekrarlı tür rozeti (etiketRozet — kod/tarih şeridinde zaten
    // "FİYAT TEKLİFİ" yazıyordu, altındaki renkli şeritte bir daha vardı)
    // kaldırıldı.
    // BİRLEŞTİRME (26.10.2026, Abdullah onayı — mockup üzerinden): yukarıdaki
    // notun aksine, renkli HESAPLANACAK/HESAPLANDI şeridi (.hareket-grup-
    // etiket) artık BURADA YOK — "etiket" opt'u hiç geçilmiyor, grupHtml()
    // o div'i üretmiyor. İşlem durumu artık kod/tarih şeridinin KENDİSİNİN
    // işlem türüne özel renk alt zeminiyle gösteriliyor (bkz.
    // cart-tablo-style-v2.css .tip-* background kuralları, SADECE
    // .cart-sayfa altında — Belge Önizleme/Gönder'in kendi kullanımı
    // ETKİLENMEDİ, onlar hâlâ etiket geçiyor).
    grupSariAlani.innerHTML = bekleyenler.length === 0 ? "" : HareketTablo.grupHtml({
      tip: secilenTip,
      seritEtiket: TIP_ETIKET_ROZET[secilenTip] || "",
      seritTarih: kodTarihMetni,
      seritKod: "(taslak)",
      urunler: bekleyenler,
      hesapla: function(){ return null; },
      zeminSinifi: "hareket-satir--sari"
    });

    // KALDIRILDI (26.10.2026, Abdullah onayı — SEÇ butonu sadeleştirme):
    // burada "sepetHesaplandiGoster" iznine göre bu YEŞİL grubun tamamen
    // gizlenmesi vardı. SEÇ kalktığı için her ürün artık hesaplanmış olarak
    // giriyor (bekleyenler HER ZAMAN boş) — bu grup, sepetin GÖSTERİLEBİLECEĞİ
    // TEK yer. İzin kapalıyken eski davranış aynen kalsaydı, o izni kapalı
    // olan bir çalışan ürün ekleyebilecek ama sepetini HİÇ GÖREMEYECEKTİ
    // (boşmuş gibi görünürdü) — bu yüzden izin kontrolü kaldırıldı. İzin
    // tanımı (cihaz-kullanici-render.js/calisan-erisim-render.js ayarlar
    // ekranı) geriye dönük uyumluluk için duruyor, ama artık hiçbir etkisi
    // yok — sepet erişimi zaten "sepet" ana izniyle kontrol ediliyor.
    var hesaplananToplam = 0;
    hesaplananlar.forEach(function(u){ hesaplananToplam += hesapla(u).toplamEuro; });
    grupYesilAlani.innerHTML = hesaplananlar.length === 0 ? "" : HareketTablo.grupHtml({
      tip: secilenTip,
      seritEtiket: TIP_ETIKET_ROZET[secilenTip] || "",
      seritTarih: kodTarihMetni,
      seritKod: "(taslak)",
      urunler: hesaplananlar,
      hesapla: hesapla,
      zeminSinifi: "hareket-satir--yesil",
      genelToplam: hesaplananToplam,
      kur: kur,
      kurManuelMi: aktifKurManuelMi(),
      kurTiklanabilir: true
      // (02.11.2026: eski "primSatirIci:true" bayrağı KALDIRILDI — PRİM artık
      // tüm sayfalarda ortak GENEL TOPLAM kutusunun içinde, bkz.
      // hareket-tablo.js genelToplamHtml.)
    });

    var kurRozeti = document.querySelector(".belge-gt-kur-ic--tiklanabilir");
    if(kurRozeti) kurRozeti.onclick = kurManuelOverlayAc;

    // SAĞA/SOLA ÇEKİNCE İŞLEM İPTAL (26.10.2026, Abdullah onayı — mockup
    // üzerinden): alttaki ayrı "🗑️ İşlemi İptal Et" butonu KALDIRILDI —
    // yerine kod/tarih şeridini (F. TEKLİFİ/SİPARİŞ/... tarih (taslak))
    // sağa veya sola çekince AYNI işlevi açan bir mekanizma geldi (satır
    // bazlı "çekince SİL" ile BİREBİR aynı dokunma mantığı, bkz. aşağıdaki
    // satirEtkilesimleriniBagla). "Boşlukları daralt" isteğiyle de uyumlu:
    // ekranda ayrıca yer kaplayan bir kırmızı buton kalmadı.
    kodSeridiIptalEtkilesimBagla(grupSariAlani);
    kodSeridiIptalEtkilesimBagla(grupYesilAlani);

    // DEĞİŞİKLİK (26.10.2026, Abdullah onayı — mockup üzerinden): eski
    // "SR hücresine dokun → küçük 🗑️ ikonuna dönüş → bir daha dokun → onay
    // penceresi" mekanizması KALDIRILDI (hedef çok küçüktü, keşfedilmesi
    // zordu — "silinmiyor, hata var" şikayetinin asıl sebebi muhtemelen
    // buydu). Yerine satırı sağa/sola ÇEKME (swipe) geldi: PRİM hücresi
    // (satırda zaten var olan son sütun — YER KAPLAMAZ, yeni sütun
    // eklenmedi) çekilince kırmızı "🗑️ SİL" haline dönüyor, dokununca
    // İKİNCİ bir onay sorulmadan direkt siliniyor (çekme hareketinin
    // kendisi zaten yeterince kasıtlı bir eylem). Satıra normal (çekmeden)
    // dokunmak YİNE düzenleme popup'ını açıyor — DEĞİŞMEDİ.
    function satirEtkilesimleriniBagla(tr, urun){
      var primHucre = tr.querySelector("td.belge-td-prim");
      var kaydirmaAktif = !!primHucre;
      if(primHucre){
        var orijinalIcerik = primHucre.innerHTML;
        primHucre.classList.add("sepet-prim-sil-hucre");
        primHucre.innerHTML = "<span class='sepet-prim-sil-hucre-ic'>" + orijinalIcerik + "</span>"
          + "<button type='button' class='sepet-sil-swipe-btn' title='Sil' aria-label='" + htmlEsc(urun.ad) + " sepetten sil'>🗑️ SİL</button>";
        primHucre.querySelector(".sepet-sil-swipe-btn").onclick = function(e){
          e.stopPropagation();
          CartData.sil(urun.idx);
          sayfayiCiz();
        };
      }

      var basX = null, basY = null, kaydirildiMi = false;
      tr.addEventListener("touchstart", function(e){
        if(!kaydirmaAktif || e.touches.length !== 1) return;
        basX = e.touches[0].clientX;
        basY = e.touches[0].clientY;
      }, {passive:true});
      tr.addEventListener("touchend", function(e){
        if(!kaydirmaAktif || basX === null) return;
        var t = (e.changedTouches && e.changedTouches[0]) || null;
        var dx = t ? (t.clientX - basX) : 0;
        var dy = t ? (t.clientY - basY) : 0;
        basX = null; basY = null;
        // Yatay hareket 35px'i geçtiyse VE düşeyden belirgin şekilde daha
        // baskınsa (normal dikey kaydırmayı yanlışlıkla yakalamasın diye)
        // — yön (sağ/sol) önemsiz, Abdullah'ın isteği ikisi de çalışsın.
        if(Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy) * 1.5){
          kaydirildiMi = true;
          digerSepetSatirlariniKapat(tr);
          tr.classList.toggle("sepet-satir--sil-acik");
        }
      }, {passive:true});

      tr.onclick = function(){
        if(kaydirildiMi){ kaydirildiMi = false; return; }
        if(tr.classList.contains("sepet-satir--sil-acik")){
          tr.classList.remove("sepet-satir--sil-acik");
          return;
        }
        urunuHesaplamayaGonder(urun.idx);
      };
    }
    function digerSepetSatirlariniKapat(haricTr){
      document.querySelectorAll(".sepet-satir--sil-acik").forEach(function(acikTr){
        if(acikTr !== haricTr) acikTr.classList.remove("sepet-satir--sil-acik");
      });
    }
    grupSariAlani.querySelectorAll("tbody tr").forEach(function(tr, i){
      tr.style.cursor = "pointer";
      satirEtkilesimleriniBagla(tr, bekleyenler[i]);
    });
    grupYesilAlani.querySelectorAll("tbody tr").forEach(function(tr, i){
      tr.style.cursor = "pointer";
      satirEtkilesimleriniBagla(tr, hesaplananlar[i]);
    });

    // gonderVarMi/tamamMi artık fonksiyon başında hesaplanıyor (Gönder
    // butonunun HTML'i panelle BİRLİKTE üretiliyor — bkz. yukarısı).
    devamUyari.hidden = tamamMi || !gonderVarMi;
  }catch(e){ hataGoster("Sepet çizilemedi: " + e.message); }
}

// ---------- Kaydetme mantığı (eskiden send-render.js'deydi) ----------

// KALDIRILDI (15.10.2026, Abdullah'ın isteğiyle): "⚠️ Anomali Uyarısı"
// popup'ı (iskonto %50 üstü / dip maliyet altı satış uyarısı) tamamen
// kaldırıldı — artık hiçbir koşulda gösterilmiyor, kaydet akışı
// kesintisiz devam ediyor. Eskiden burada anomaliUyarilariniTopla()
// fonksiyonu vardı, kaydetGercekIslem() içinde confirm() ile çağrılıyordu.

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
  // BAYAT BAYRAK TEMİZLİĞİ (03.11.2026): sepet boşsa "revize/ilerlet" kaynağı
  // artık geçersizdir (reports-data.js bayrağı sepetle BİRLİKTE yazar) —
  // bırakılırsa ilgisiz bir sonraki kayıtta eski belgeyi silebilir.
  try{
    if(CartData.liste().length === 0) localStorage.removeItem("weiconv2_ilerlet_kaynak");
  }catch(e){}
  var kaynak = ilerletKaynagiOku();
  if(!kaynak || !kaynak.sonrakiAsamaSecenekleri || kaynak.sonrakiAsamaSecenekleri.length===0) return;
  var secenekler = kaynak.sonrakiAsamaSecenekleri;
  var oncedenSecilen = null;
  try{ oncedenSecilen = localStorage.getItem("weiconv2_onceden_secilen_tip"); }catch(e){}
  var uyari = document.createElement("div");
  uyari.className = "ilerlet-bilgi-kutu";
  if(secenekler.length === 1 || (oncedenSecilen && secenekler.indexOf(oncedenSecilen) !== -1)){
    secilenTip = (oncedenSecilen && secenekler.indexOf(oncedenSecilen) !== -1) ? oncedenSecilen : secenekler[0];
    uyari.textContent = kaynak.bekleyenMod
      ? "⏳ Bekleyen ürün ilerletiliyor — kayıt tamamlanınca gelen adetler bekleyenden düşülür. Adetleri ve fiyatları buradan düzenleyebilirsin."
      : "▶️ İlerletiliyor — kayıt tamamlanınca önceki aşamanın belgesi otomatik silinecek.";
  } else {
    // "Revize ediliyor" bildirimi KALDIRILDI (03.11.2026, Abdullah'ın isteğiyle);
    // aşama seçimi Kaydet/Gönder'de popup ile sorulmaya devam eder.
    revizeSecimBekleniyor = secenekler;
    return;
  }
  if(kaynak.bekleyenMod && kaynak.eskiFiyatlar && kaynak.eskiFiyatlar.length){
    // Önceki (bekleyen kayıttaki) fiyatlar — fiyat değiştiyse karşılaştırmak için.
    var fiy = document.createElement("div");
    fiy.style.cssText = "margin-top:6px;font-size:12px;font-weight:600;line-height:1.5;";
    fiy.innerHTML = kaynak.eskiFiyatlar.map(function(f){
      return "• " + htmlEsc(f.ad) + " — önceki: liste " + CartData.fmt(f.liste) + " · isk. %" + CartData.fmt(f.iskonto) + " · dip " + CartData.fmt(f.dip) + " EURO";
    }).join("<br>");
    uyari.appendChild(fiy);
  } else if(kaynak.bakiyeKaynak){
    uyari.textContent = "⏳ Bekleyen ürün için hazırlanan belge ilerletiliyor — sipariş olunca gelen adetler bekleyenden düşülür.";
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

// MÜŞTERİ SIZINTISI DÜZELTMESİ — KRİTİK, KALICI KURAL (27.10.2026, Abdullah'ın
// bildirdiği hata): "weicon_secili_musteri" (CustomerData'nın seçili müşterisi)
// UYGULAMA GENELİNDE kalıcı bir localStorage anahtarı — müşteri listesi,
// Cari Kart, Temas, Bildirimler, Takip Gerekenler, Ana Sayfa'daki mini-arama
// hızlı penceresi gibi bu sayfayla HİÇ ilgisi olmayan onlarca yer, sırf "şu an
// hangi müşteriye bakılıyor" demek için CustomerData.sec() çağırıyor. Bu
// yüzden Abdullah bir müşteriyi arayıp bilgisine baktıktan sonra Ana Sayfa'ya
// dönüp SADECE "Ürün Bul" ile bağımsız bir ürün hesabı yapmak istediğinde,
// o eski müşteri hâlâ "seçili" kaldığı için burada sessizce beliriyordu.
//
// Çözüm: cart.html'e SADECE gerçek bir işlem başlatma akışıyla (▶️ İşleme
// Devam Et — cari-kart-render.js, İlerlet/Tekrarla — reports-data.js)
// gelindiğinde "weiconv2_sepet_musteri_baglantisi" bayrağı "1" yazılıyor.
// Bu bayrak YOKSA (ör. Ana Sayfa > 🔍 Ürün Bul linkiyle veya doğrudan URL ile
// gelindiyse), önceden kalmış olabilecek seçili müşteri burada TAMAMEN
// temizlenir — sayfa sıfırdan, müşterisiz hızlı hesaplama modunda açılır.
// Bayrak BİLEREK burada silinmiyor (tek seferlik tüketilmiyor) — aksi halde
// gerçek bir işlem ortasında sayfa yenilenirse (F5, sekme arka plana atılıp
// geri gelme) müşteri yanlışlıkla kaybolurdu. Bayrak yalnızca oturum gerçekten
// bittiğinde (Kaydet sonrası, İşlemi İptal Et, Gönder tamamlanınca) diğer
// oturum anahtarlarıyla (weiconv2_onceden_secilen_tip, weicon_secili_musteri
// vb.) BİRLİKTE temizlenir — bkz. kaydetSonrasiAnaSayfayaGit,
// herSeyiSifirlaVeGit (bu dosyada) ve send-render.js anaSayfayaDonVeTemizle.
function sepetMusteriBaglantisiniDogrula(){
  try{
    var baglantiliMi = localStorage.getItem("weiconv2_sepet_musteri_baglantisi") === "1";
    if(!baglantiliMi){
      CustomerData.secimiKaldir();
    }
  }catch(e){}
}

function oncedenSecilenTipVarsaUygula(){
  try{
    var tip = localStorage.getItem("weiconv2_onceden_secilen_tip");
    if(tip) secilenTip = tip;
  }catch(e){}
}

// Sepet/müşteri oturum anahtarlarının TAMAMI — kaydetSonrasiAnaSayfayaGit
// VE yarimKalanIslemKontrolEt (10 dakika oto-sıfırlama) tarafından
// PAYLAŞILAN tek liste (01.11.2026) — biri değişirse diğeri de otomatik
// güncellensin diye tek yerde tutuluyor.
function sepetOturumAnahtarlariniTemizle(){
  try{ CustomerData.secimiKaldir(); }catch(e){}
  ["weiconv2_sepet_kur_override","weiconv2_onceden_secilen_tip","weiconv2_hesapla_duzenle_idx",
   "weiconv2_ilerlet_kaynak","weiconv2_islem_yap_akisi","weiconv2_secili_iletisim",
   "weiconv2_son_kaydedilen_belge","weiconv2_gonderim_kanali","weicon_secili_musteri",
   "weiconv2_musteri_donus_sayfa","weiconv2_musteri_arama_durumu",
   "weiconv2_sepet_musteri_baglantisi","weiconv2_sepetten_cari_acildi",
   "weiconv2_gonderden_cari_acildi","weiconv2_gonder_kanal_acik","weiconv2_gonderden_secim_uygula"].forEach(function(k){
    try{ localStorage.removeItem(k); }catch(e){}
  });
}

// KAYDET → ANA SAYFA (WG.210926.1647.588): "✓ Kaydet" işlemi bitirir, Gönder
// ekranına gitmez. Sepet ve seçili müşteri, "Ana Sayfa'ya Git" ve "İşlemi İptal
// Et" akışlarıyla AYNI şekilde temizlenir. Form görüntüleme/gönderme için
// "📋 Formu Görüntüle" butonu (niyet = "gonder") eskisi gibi send.html'e gider.
// NOT (03.11.2026): "Kaydet" 01.11.2026'da kalkmıştı; üst bardaki yeni
// Kaydet tuşu (ust-bar-eylem.js -> kaydetTiklandi("kaydet")) bu fonksiyonu
// yeniden kullanıyor.
function kaydetSonrasiAnaSayfayaGit(){
  // KRİTİK HATA DÜZELTMESİ (26.10.2026) — bkz. herSeyiSifirlaVeGit'teki aynı
  // yorum: CartData.sifirla(callback) kullanılıyor — hem bellek içi "sepet"
  // dizisini boşaltıyor HEM DE navigasyonu Firebase yedeği gerçekten
  // boşalana (ya da en fazla 1.2sn sonra) kadar erteliyor; yoksa home.html'in
  // kendi fbYukle()'si eski yedeği geri yükleyip burayı da etkileyebilirdi.
  sepetOturumAnahtarlariniTemizle();
  CartData.sifirla(function(){
    window.location.href = "home.html";
  });
}

// YARIM KALAN İŞLEM — 10 DAKİKA OTO-SIFIRLAMA (01.11.2026, Abdullah'ın
// kesin kuralı): eski yöntem (yarim-kalan-uyari.js — Menü/Ana Sayfa
// tıklamasını yakalayıp confirm() ile soran) bugünkü üst-bar
// birleştirmesiyle kırılmıştı ve zaten kırılgandı (her yeni çıkış yolu
// ayrıca yakalanmalıydı). Bunun yerine: sepete ilk ürün eklendiği andan
// itibaren 10 dakika geçmişse — NASIL çıkılırsa çıkılsın, hatta kullanıcı
// sayfada aktif kalsa bile ("ne olursa olsun boşalt") — sepet + müşteri +
// ilgili tüm oturum anahtarları sessizce sıfırlanır, hiçbir onay sorulmaz.
// DOMContentLoaded'da, periyodik olarak (20sn) ve sekme geri gelince
// (visibilitychange/pageshow/focus) çağrılır — bkz. aşağıdaki event
// bağlamaları.
function yarimKalanIslemKontrolEt(){
  try{
    if(!CartData.suresiDoldumu()) return;
    sepetOturumAnahtarlariniTemizle();
    revizeSecimBekleniyor = null;
    var bilgiAlani = document.getElementById("ilerletBilgiAlani");
    if(bilgiAlani) bilgiAlani.innerHTML = "";
    CartData.sifirla(function(){ sayfayiCiz(); });
  }catch(e){}
}

// Panelde (müşteri seçiliyse musteri-serit, değilse müşterisiz şerit)
// o an DOM'da hangi Gönder ikonu varsa onu döndürür — sayfayiCiz() her
// çağrıldığında innerHTML yeniden üretildiği için id sabit kalsa da
// elementin kendisi değişir, bu yüzden her kullanımda yeniden sorgulanır.
function gonderButonunuBul(){
  return document.getElementById("btnMusteriGonder") || document.getElementById("btnSepetGonderMusterisiz");
}

function kaydetGercekIslem(niyet){
  try{
    var musteri = CustomerData.seciliyiOku();
    var sepet = CartData.liste();
    if(!musteri || sepet.length === 0) return;

    var kur = aktifKuruOku();
    var kdv = CartData.kdvOku();

    var gonderBtn = gonderButonunuBul();
    if(gonderBtn) gonderBtn.disabled = true;

    var kaynak = ilerletKaynagiOku();
    // BEKLEYEN İLERLET (08.11.2026): bekleyen kayıt (stok bekliyor / bakiye) korunduğu için yeni
    // belge onun kodunu DEVRALMAZ (aynı kod iki kayıtta olmasın) — taze günlük numara alır,
    // bekleyene bağ kayıttan sonra yazılır (oncekiKod/rota, aşağıda).
    var devralinanKod = (kaynak && kaynak.kod && !kaynak.bekleyenMod) ? kaynak.kod : null;
    var devralinanTarih = (kaynak && kaynak.tarih) ? kaynak.tarih : null;
    var devralinanRota = (kaynak && kaynak.rota) ? kaynak.rota : null;
    SendData.kaydet(secilenTip, musteri, sepet, kur, kdv, seciliAdresler, devralinanKod, devralinanTarih, devralinanRota, function(basarili, sonuc, revizeMi){
      if(basarili){
        var bekleyenAkisi = !!(kaynak && (kaynak.bekleyenMod || kaynak.bakiyeKaynak));
        if(bekleyenAkisi){
          // BEKLEYEN İLERLET (08.11.2026): bekleyen kaydı (stok bekliyor / bakiye)
          // silinmez — sipariş ise gelen adetler bekleyenden düşülür; teklif/proforma
          // ise bekleyene "teklif verildi" izi yazılır. Zincirde araya giren eski
          // teklif/proforma varsa (bakiyeKaynak) o normal şekilde silinir.
          var yeniKayitBilgi = Object.assign({}, sonuc, {tip: secilenTip});
          if(kaynak.bekleyenMod){
            try{ ReportsData.kaydiAlanGuncelle(secilenTip, sonuc.ts, {oncekiKod: kaynak.kod||null, oncekiTarih: kaynak.tarih||null, rota: kaynak.rota||null}, function(){}); }catch(e){}
          }
          var asilBekleyen = kaynak.bakiyeKaynak || {tip:kaynak.tip, ts:kaynak.ts, mod:kaynak.bekleyenMod};
          if(kaynak.bakiyeKaynak && kaynak.ts !== asilBekleyen.ts){
            SendData.kaynakSil(kaynak.tip, kaynak.ts, function(){});
          }
          if(secilenTip === "siparis"){
            ReportsData.bekleyenGeldi(asilBekleyen, yeniKayitBilgi, function(ok, e){ if(!ok) console.warn("Bekleyen düşülemedi:", e); });
          } else {
            ReportsData.bekleyenBagla(asilBekleyen, yeniKayitBilgi, function(ok, e){ if(!ok) console.warn("Bekleyen bağlanamadı:", e); });
          }
          localStorage.removeItem("weiconv2_ilerlet_kaynak");
        } else if(kaynak){
          // KORUMA (05.11.2026): "Stok Bekliyor" siparişten tekrar SİPARİŞ'e
          // ilerletilirken SendData.kaydet'in "aynı gün + aynı müşteri + aynı
          // ürün seti = revize" kuralı kaynak kaydın KENDİSİNİ güncelleyebilir.
          // O durumda kaynak silinirse yeni kayıt da kaybolurdu — silme; sadece
          // "Stok Bekliyor" işaretini kaldır (artık stok geldi).
          var kaynakKendisiMi = !!(sonuc && sonuc.ts === kaynak.ts && secilenTip === kaynak.tip);
          if(kaynakKendisiMi){
            try{ ReportsData.kaydiAlanGuncelle(kaynak.tip, kaynak.ts, {durum:null, beklemedeNot:null}, function(){}); }catch(e){}
          } else {
            SendData.kaynakSil(kaynak.tip, kaynak.ts, function(){});
          }
          localStorage.removeItem("weiconv2_ilerlet_kaynak");
        }
        // KAYDET (03.11.2026, Abdullah onayı — "bu sayfada mutlaka işlemi
        // kaydet tuşu olsun"): üst bardaki Kaydet, işlemi kaydeder ve Gönder
        // ekranına GİTMEZ — işlem tamamlanmış sayılır, sepet/müşteri
        // temizlenip Ana Sayfa'ya dönülür (eski "Kaydet" davranışı, bkz.
        // kaydetSonrasiAnaSayfayaGit). Gönder tuşunun akışı değişmedi.
        if(niyet === "kaydet"){
          kayitBildirimiGoster(revizeMi ? "Kayıt güncellendi" : "İşlem kaydedildi");
          setTimeout(kaydetSonrasiAnaSayfayaGit, 700);
          return;
        }
        // send.html'e taşınacak bağlam — sepeti/müşteriyi BURADA boşaltmıyoruz,
        // "Geri — Sepete Dön ve Düzelt" hâlâ çalışabilsin diye (aynı gün+
        // müşteri+ürün seti eşleşmesiyle SendData.kaydet zaten revize eder).
        localStorage.setItem("weiconv2_son_kaydedilen_belge", JSON.stringify({
          musteri: musteri, sepet: sepet, tip: secilenTip, kur: kur, kdv: kdv,
          kayit: sonuc, revizeMi: !!revizeMi, niyet: niyet
        }));
        // Gönder'e basınca müşteri seçiliyse HER HALÜKARDA kayıt edilir (bu
        // fonksiyon zaten sadece müşteri seçiliyken çağrılır — bkz.
        // kaydetTiklandi), sonra iletişim kanalı seçimine geçiliyor.
        window.location.href = "send.html?ac=iletisim";
      } else {
        var btn = gonderButonunuBul();
        if(btn) btn.disabled = false;
        hataGoster("Kaydetme başarısız: " + (sonuc && sonuc.message ? sonuc.message : "bilinmeyen hata"));
      }
    }, aktifKurManuelMi(), (kaynak && (kaynak.bekleyenMod || kaynak.bakiyeKaynak)) ? {yeniKayitZorla:true} : undefined);
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
// SADELEŞTİRME (27.10.2026, Abdullah'ın isteğiyle — mockup üzerinden
// onaylandı, "Varyant B"): "GÖNDERİM BİÇİMİ" (Metin/Tablo Görseli) seçimi
// ve "MESAJ (düzenlenebilir)" metin kutusu TAMAMEN kaldırıldı — Abdullah
// WhatsApp/Mail'de tablolarını HER ZAMAN resim (Tablo Görseli) olarak
// gönderdiğini, "Metin" seçeneğini hiç kullanmadığını belirtti. Üstteki
// "Fiyat bilgisi hazır — göndermek ister misin?" başlığı ve "Müşteri kaydı
// yok..." uyarı metni de aynı onayla kaldırıldı. Artık WhatsApp/Mail
// butonlarına basınca DOĞRUDAN tablo görseli gönderiliyor (bkz.
// musterisizTabloGonder) — eski "metin" yolu (musterisizOzetMetniOlustur,
// musterisizBicim, bicimTiklariniBagla) hiçbir DOM elemanı tarafından
// tetiklenemediği için tamamen kaldırıldı, dosyada ölü kod bırakılmadı.
// Gerçek Gönder ekranıyla (send.html) PAYLAŞIM MEKANİZMASI aynı kalıyor —
// sadece bu küçük, kayıtsız/CRM'siz önizleme artık doğrudan görsele gidiyor.
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
    document.getElementById("musterisizGonderOverlay").hidden = false;
  }catch(e){ hataGoster("Önizleme açılamadı: " + e.message); }
}
// SEPETİ SIFIRLA (13.10.2026, Abdullah'ın isteğiyle; DÜZELTME 13.10.2026
// gece — Abdullah'ın bildirdiği Mail hatası): Müşterisiz Gönder'de WhatsApp/
// Mail'e basıldıktan sonra sepet elle temizlenmeyi beklemiyor, otomatik
// boşalıyor. ESKİDEN burada 400ms sonra window.location.href = "cart.html"
// çalışıyordu — bu, Mail butonunun hemen öncesinde set ettiği
// window.location.href = "mailto:..." ile AYNI pencerede İKİNCİ bir
// navigasyon yarışına giriyordu ve birçok mobil tarayıcıda mailto'nun
// uygulamaya geçiş/handoff'unu tamamlanmadan KESİYORDU (WhatsApp'ı etkilemez
// çünkü o window.open ile ayrı bir sekme/bağlam açar). Çözüm: sayfayı hiç
// yeniden YÜKLEMEDEN, mevcut sayfayı kendi çizim fonksiyonuyla (sayfayiCiz)
// yerinde sıfırla — hiçbir window.location değişikliği yok, dolayısıyla
// yarış durumu da yok. Gecikmeye de artık gerek kalmadı.
function musterisizSepetiSifirla(){
  // KRİTİK HATA DÜZELTMESİ (26.10.2026) — bkz. herSeyiSifirlaVeGit'teki
  // aynı yorum: burada navigasyon da YOK (bilerek — yukarıdaki yorum),
  // sayfayiCiz() HEMEN arkadan çağrılıyor — CartData'nın bellek içi dizisi
  // gerçekten boşalmazsa sepet EKRANDA DA sıfırlanmış görünmezdi.
  try{
    CartData.sifirla();
    localStorage.removeItem("weiconv2_sepet_kur_override");
  }catch(e){}
  var overlay = document.getElementById("musterisizGonderOverlay");
  if(overlay) overlay.hidden = true;
  sayfayiCiz();
}
// SADELEŞTİRME (27.10.2026) — bkz. yukarıdaki "Müşterisiz hızlı gönder"
// bölüm başlığı yorumu: WhatsApp/Mail artık HER ZAMAN doğrudan tablo
// görseli gönderiyor, eski "metin" dalı kaldırıldı.
function musterisizWhatsappGonder(){
  musterisizTabloGonder("whatsapp");
}
function musterisizMailGonder(){
  musterisizTabloGonder("mail");
}
// PERFORMANS KAZANIMI (27.10.2026): html2canvas (büyük, nadiren kullanılan
// bir kütüphane) artık bu sayfada EN BAŞTA yüklenmiyor — sadece "Tablo
// Görseli Gönder" GERÇEKTEN tıklandığında ilk kez indiriliyor. Aynı
// yükleme AYNI oturumda tekrar istenirse (ikinci gönderim) kütüphane
// zaten mevcut olduğundan hiçbir ağ isteği tekrarlanmaz.
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
// TABLO GÖRSELİ OLARAK GÖNDER (13.10.2026, Abdullah onayı): ÜRÜN TABLOSU
// (#musterisizOnizlemeTablo), Gönder ekranındaki (send-render.js
// belgeGorseliniOlustur) AYNI yöntemle — html2canvas — gerçek bir PNG'ye
// çevrilir, ardından navigator.share ile (destekleniyorsa) dosya EKİ olarak
// paylaşım menüsüne açılır. navigator.share desteklenmiyorsa görsel indirilir
// ve kullanıcı WhatsApp/Mail'e elle ekler (aynı yedek yöntem send-render.js'de
// de kullanılıyor).
function musterisizTabloGonder(kanal){
  try{
    html2canvasYukle(function(){
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
              musterisizSepetiSifirla();
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
            musterisizSepetiSifirla();
          }
        }, "image/png");
      }).catch(function(){ hataGoster("Görsel oluşturulamadı."); });
    });
  }catch(e){ hataGoster("Tablo gönderimi başarısız: " + e.message); }
}

window.addEventListener("error", function(ev){
  hataGoster("HATA: " + ev.message + " (" + (ev.filename||"").split("/").pop() + ":" + ev.lineno + ")");
});

document.addEventListener("DOMContentLoaded", function(){
  sepetMusteriBaglantisiniDogrula();
  tarihiGuncelle();
  oncedenSecilenTipVarsaUygula();
  ilerletKaynagiVarsaSekmeAyarla();
  kurManuelOverlayBaglantilariKur();
  // NOT (01.11.2026): eski "btnMenu" id'si bugünkü üst-bar birleştirmesiyle
  // kaldırıldı (artık "btnAsMenuAc", menu-cekmece.js tarafından yönetiliyor)
  // — bu yüzden o bağlama burada artık YOK. "Kaydet"/"Gönder" statik
  // bağlaması da kaldırıldı — Gönder artık panelde dinamik üretiliyor,
  // bağlaması sayfayiCiz() içinde yapılıyor (bkz. gonderBtnEl).
  document.getElementById("btnMusterisizWhatsapp").onclick = musterisizWhatsappGonder;
  document.getElementById("btnMusterisizMail").onclick = musterisizMailGonder;
  document.getElementById("btnMusterisizVazgec").onclick = function(){ document.getElementById("musterisizGonderOverlay").hidden = true; };
  document.getElementById("btnMusteriGecmisKapat").onclick = function(){ document.getElementById("musteriGecmisOverlay").hidden = true; };

  // İşlemi İptal Onay Popup — SADECE "🗑️ İşlemi İptal Et" butonu kullanıyor
  // (02.10.2026: "Geri" tuşu artık bunu tetiklemiyor, bkz. yukarısı).
  // KRİTİK HATA DÜZELTMESİ (26.10.2026, Abdullah'ın bildirdiği hata —
  // "iptal ediyorum ama silmiyor, yeniden hazır hale getirmiyor"):
  // burada DOĞRUDAN localStorage["weiconv2_sepet"]'e "[]" yazılıyordu —
  // ama CartData modülünün KENDİ bellek içi "sepet" dizisi (sayfayiCiz'in
  // GERÇEKTEN okuduğu kaynak) hiç haberdar edilmiyordu. Arkadan gelen
  // herhangi bir kaydet() çağrısı (sil/ekle/alaniGuncelle) ya da Firebase
  // yedeği (fbYukle) o eski dolu diziyi geri yazıp iptali boşa çıkarabiliyordu
  // — ekranda ürün hâlâ duruyor gibi görünmesinin asıl sebebi buydu. Artık
  // CartData.sifirla() çağrılıyor (bkz. cart-data.js) — hem bellek hem
  // localStorage hem Firebase yedeği TEK seferde, tutarlı şekilde boşalıyor.
  // CustomerData.secimiKaldir() de artık kendi try/catch'i içinde — orada
  // beklenmedik bir hata çıksa bile sepet sıfırlama ve yönlendirme ASLA
  // yarıda kalmasın diye.
  function herSeyiSifirlaVeGit(hedefUrl, enAzBeklemeMs){
    var baslamaZamani = Date.now();
    localStorage.removeItem("weiconv2_sepet_kur_override");
    try{ CustomerData.secimiKaldir(); }catch(e){}
    try{
      localStorage.removeItem("weiconv2_onceden_secilen_tip");
      localStorage.removeItem("weiconv2_hesapla_duzenle_idx");
      localStorage.removeItem("weiconv2_ilerlet_kaynak");
      localStorage.removeItem("weiconv2_islem_yap_akisi");
      localStorage.removeItem("weiconv2_sepet_musteri_baglantisi");
      localStorage.removeItem("weiconv2_sepetten_cari_acildi");
    }catch(e){}
    // YARIŞ DURUMU DÜZELTMESİ (26.10.2026, bkz. cart-data.js sifirla() yorumu):
    // navigasyon artık Firebase yedeği GERÇEKTEN boşaldıktan (ya da en fazla
    // 1.2sn sonra) SONRA tetikleniyor — yoksa yeni sayfadaki fbYukle() eski
    // yedeği geri yükleyip iptali sessizce boşa çıkarabiliyordu.
    CartData.sifirla(function(){
      // enAzBeklemeMs: "İşlem iptal ediliyor…" bildirimi okunabilsin diye
      // (Kapat tuşu, 03.11.2026) — temizlik hemen yapılır, sadece geçiş gecikir.
      var kalan = (enAzBeklemeMs || 0) - (Date.now() - baslamaZamani);
      if(kalan > 0) setTimeout(function(){ window.location.href = hedefUrl; }, kalan);
      else window.location.href = hedefUrl;
    });
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
  var geriLink = document.querySelector(".ub-btn--geri, .nav-btn--geri");
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
  // KAPAT (✕) = İŞLEMİ İPTAL ET + SEPETİ BOŞALT (03.11.2026, Abdullah'ın
  // isteğiyle — "kapat tuşu her zaman işlem iptal ve sepet boşalt demek
  // olacak"). Onay penceresi yok; kısa bildirim gösterilip hemen sıfırlanır.
  var btnUstKapatEl = document.getElementById("btnUstKapat");
  if(btnUstKapatEl){
    btnUstKapatEl.disabled = false;
    var kapatIsleniyor = false;
    btnUstKapatEl.onclick = function(){
      if(kapatIsleniyor) return;
      kapatIsleniyor = true;
      iptalBildirimiGoster();
      herSeyiSifirlaVeGit(cartDonusRotasi === "customer.html" ? "customer.html" : "home.html", 900);
    };
  }
  document.getElementById("btnSepetIptal").onclick = function(){
    iptalOnayGoster(cartDonusRotasi === "customer.html" ? "customer.html" : "home.html");
  };

  CustomerData.listeDegistiginde(sayfayiCiz);
  window.addEventListener("istakipAuthHazir", sayfayiCiz);
  // Sepet, bu cihazda boşken Firebase yedeğinden geri yüklenirse (bkz.
  // cart-data.js fbYukle) ekranı yeniden çiz (09.10.2026).
  document.addEventListener("istakipSepetGeriYuklendi", sayfayiCiz);
  yarimKalanIslemKontrolEt();
  sayfayiCiz();
  // PERİYODİK + SEKME GERİ GELİNCE KONTROL (01.11.2026) — auth.js'teki PIN
  // zaman aşımı kontrolüyle AYNI desen: sadece sayfa açılışında kontrol
  // etmek yetmez, kullanıcı sayfada 10 dakikadan uzun kalırsa VEYA sekmeyi
  // arka plana atıp geri dönerse de yakalanmalı.
  setInterval(yarimKalanIslemKontrolEt, 20000);
  document.addEventListener("visibilitychange", function(){ if(!document.hidden) yarimKalanIslemKontrolEt(); });
  window.addEventListener("pageshow", yarimKalanIslemKontrolEt);
  window.addEventListener("focus", yarimKalanIslemKontrolEt);
});
