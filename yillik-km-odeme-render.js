/*
  yillik-km-odeme-render.js — TKP.15.11.26-09:56.1647
  ==========================
  Araç KM alt menüsündeki "Yıllık KM Ödeme" (03.10.2026, Abdullah'ın
  isteğiyle; 03.10.2026 içinde birkaç kez güncellendi):
    - Toplam Özel KM: VARSAYILAN olarak km-data.js'teki kmTakip
      kayıtlarından CANLI hesaplanır — ama Abdullah isterse hücreye
      dokunup ELLE düzeltebilir/silebilir (silerse otomatik hesaba döner).
    - Şirket KM Hakkı (YENİ, 03.10.2026): "firmam yılda 3.000 km hak
      tanıyor, üstü benden ödeme olarak kesiliyor" isteğiyle — elle girilen,
      yıl bazlı ücretsiz km hakkı ("kmSirketHakki/{YIL}"). KM Çarpanı gibi
      SADECE "✓ Kaydet" tuşuna basınca kaydedilir.
    - Ücretlendirilecek KM (YENİ): Toplam Özel KM − Şirket KM Hakkı
      (negatifse 0) — otomatik, salt okunur.
    - KM Çarpanı: elle girilen TL/km değeri, yıl bazlı ("kmCarpanlari/{YIL}").
      SADECE "✓ Kaydet" tuşuna basınca kaydedilir (btnKoCarpanKaydet).
    - Tutar (03.10.2026 güncellemesi — koYilHesapla): artık "o ayki özel
      km × çarpan" DEĞİL — yıl başından BİRİKİMLİ hesaplanır. Şirket KM
      Hakkı aylar ilerledikçe tüketilir (Ocak'tan başlayarak); hak dolana
      kadar o ayın Tutarı 0'dır, hak bir ay içinde dolarsa sadece HAKKI AŞAN
      km o ayda ücretlendirilir, sonraki aylarda ise km'nin TAMAMI
      ücretlendirilir. Böylece aylık Tutar'ların toplamı HER ZAMAN
      "Ücretlendirilecek KM × Çarpan"a eşittir. Abdullah isterse hücreye
      dokunup ELLE düzeltebilir/silebilir (silerse otomatik hesaba döner).
    - Ödeme Tarihi / Platform / Ödeme / Durum: serbest metin, elle girilir
      ve blur'da otomatik kaydedilir ("kmOdemeleri/{YYYY-MM}"). Durum
      BAŞTA otomatik Ödendi/Bekliyor rozetiydi, Abdullah'ın isteğiyle
      serbest metin hücresine çevrildi — artık hiçbir otomatik mantık yok.
    - TÜM TL tutarları (Tutar, Ödeme, üst panolar) "1.234,56 TL" biçiminde
      gösterilir (koParaFormat). Elle yazarken "TL", nokta/virgül serbest —
      blur'da koSayiParse ile sayıya çevrilip öyle kaydedilir.
  Üstte TAM GENİŞLİK bir KM özet kartı (Toplam Özel KM / Şirket KM Hakkı /
  Ücretlendirilecek KM) ve altında 3'lü pano (Toplam Tutar / Toplam Ödenen /
  Kalan Ödeme).
  Yıl seçici YOK (bilerek) — sayfa her zaman BU YILI gösterir.
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

var GUNLER_KO = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
var AYLAR_KO = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

function tarihiGuncelle(){
  var el = document.getElementById("gunTarihi");
  var d = new Date();
  if(el) el.textContent = GUNLER_KO[d.getDay()] + ", " + d.getDate() + " " + AYLAR_KO[d.getMonth()] + " " + d.getFullYear();
}

function koPad2(n){ return ("0"+n).slice(-2); }
function koBuYil(){ return String(new Date().getFullYear()); }

// TL tutarı gösterimi (03.10.2026 isteği): "1.234,56 TL" — binlik nokta,
// ondalık virgül, her zaman 2 hane. Uygulamanın geri kalanındaki TL
// formatlarıyla (reports-render.js, maas-hesaplama-render.js vb.) AYNI
// toLocaleString("tr-TR") deseni.
function koParaFormat(n){
  return (n||0).toLocaleString("tr-TR", {minimumFractionDigits:2, maximumFractionDigits:2}) + " TL";
}

// KM sayısı gösterimi — ondalıksız, binlik ayraçlı (örn. 1.540).
function koKmFormat(n){
  return Math.round(n||0).toLocaleString("tr-TR");
}

// Elle yazılmış bir hücreyi ("1.234,56 TL", "1234.56", "1234,5" vb.) sayıya
// çevirir. Ayrıştıramazsa NaN döner.
function koSayiParse(metin){
  if(metin==null) return NaN;
  var t = String(metin).trim();
  if(t==="" || t==="-" || t==="—") return NaN;
  t = t.replace(/TL/gi, "").replace(/₺/g, "").trim();
  t = t.replace(/\./g, "");   // binlik noktalarını at
  t = t.replace(/,/g, ".");   // ondalık virgülü noktaya çevir
  return parseFloat(t);
}

// Hangi hücreler sayısal (Ödeme, Toplam Özel KM, Tutar) — bunlar
// koSayiParse'tan geçer ve boş bırakılınca Firebase'den SİLİNİR (bkz.
// km-data.js odemeGuncelle → ODEME_SAYISAL_ALANLAR).
var KO_SAYISAL_ALANLAR = { odeme: true, ozelKm: true, tutar: true };

function koCarpaniGuncelle(){
  var yil = koBuYil();
  document.getElementById("koCarpanEtiket").textContent = "📐 " + yil + " KM Çarpanı";
  var input = document.getElementById("koCarpanInput");
  // Kullanıcı o an yazıyorsa (odakta) üzerine yazıp imleci sıçratma.
  if(document.activeElement !== input){
    var mevcut = KmData.carpanOku(yil);
    input.value = (mevcut !== "") ? mevcut : "";
  }
}

// Şirket KM Hakkı — KM Çarpanı ile AYNI desen.
function koHakkiGuncelle(){
  var yil = koBuYil();
  document.getElementById("koHakEtiket").textContent = "🎯 " + yil + " Şirket KM Hakkı";
  var input = document.getElementById("koHakInput");
  if(document.activeElement !== input){
    var mevcut = KmData.hakkiOku(yil);
    input.value = (mevcut !== "") ? mevcut : "";
  }
}

// Yılın TÜM aylarını, Şirket KM Hakkı'nı Ocak'tan başlayarak BİRİKİMLİ
// tüketerek hesaplar — "hangi ayda ne kadarı ücretlendirilecek" bu sırayla
// belirlenir. Her ay için elle girilmiş bir özelKm/tutar düzeltmesi varsa
// o öncelenir (ozelKm düzeltmesi hak tüketimini de etkiler; tutar
// düzeltmesi sadece o ayın görünen değerini değiştirir, hak tüketimi yine
// o ayın ÖZEL KM'sine göre işler). Döndürülen yıllık toplamlar, hak nerede
// tükenirse tükensin HER ZAMAN "toplamOzelYil − hakki" ile tutarlıdır.
function koYilHesapla(yil, carpan, hakki){
  var hakKalan = hakki;
  var aylar = [];
  var toplamOzelYil = 0, toplamOdemeYil = 0, toplamTutarYil = 0, ucretlendirilecekYil = 0;

  AYLAR_KO.forEach(function(ayAdi, i){
    var yilAy = yil + "-" + koPad2(i+1);
    var odemeKaydi = KmData.odemeOku(yilAy);
    var ozelKmHesap = KmData.ayinOzelKmToplami(yilAy);
    var ozelKm = (odemeKaydi.ozelKm!=null && odemeKaydi.ozelKm!=="") ? odemeKaydi.ozelKm : ozelKmHesap;

    var ucretlendirilecekBuAy;
    if(hakKalan >= ozelKm){
      ucretlendirilecekBuAy = 0;
      hakKalan -= ozelKm;
    }else if(hakKalan > 0){
      ucretlendirilecekBuAy = ozelKm - hakKalan;
      hakKalan = 0;
    }else{
      ucretlendirilecekBuAy = ozelKm;
    }

    var tutarHesap = ucretlendirilecekBuAy * carpan;
    var tutar = (odemeKaydi.tutar!=null && odemeKaydi.tutar!=="") ? odemeKaydi.tutar : tutarHesap;
    var odeme = (odemeKaydi.odeme!=null && odemeKaydi.odeme!=="") ? odemeKaydi.odeme : "";

    toplamOzelYil += ozelKm;
    ucretlendirilecekYil += ucretlendirilecekBuAy;
    toplamTutarYil += tutar;
    if(typeof odeme === "number") toplamOdemeYil += odeme;

    aylar.push({ yilAy: yilAy, ayAdi: ayAdi, odemeKaydi: odemeKaydi, ozelKm: ozelKm, tutar: tutar, odeme: odeme });
  });

  return {
    aylar: aylar,
    toplamOzelYil: toplamOzelYil,
    ucretlendirilecekYil: ucretlendirilecekYil,
    toplamOdemeYil: toplamOdemeYil,
    toplamTutarYil: toplamTutarYil
  };
}

function tabloyuCiz(){
  try{
    var yil = koBuYil();
    document.getElementById("koTabloBaslik").textContent = yil + " — Aylık Ödeme Tablosu";
    var carpan = parseFloat(KmData.carpanOku(yil)) || 0;
    var hakki = parseFloat(KmData.hakkiOku(yil)) || 0;
    var sonuc = koYilHesapla(yil, carpan, hakki);

    var govde = document.getElementById("koTabloGovde");

    govde.innerHTML = sonuc.aylar.map(function(s, sira){
      /* 15.11.2026: Tutar ile Ödeme Tarihi arasına 2mm'lik boş ayraç sütunu — tüm satırlar TEK hücrede
         birleşik (rowspan), açık gri zemin. Yalnız görünüm; veri/hesap/Excel etkilenmez. */
      var bosluk = (sira === 0) ? "<td class='ko-bosluk' rowspan='" + sonuc.aylar.length + "' aria-hidden='true'></td>" : "";
      return "<tr data-yilay='" + s.yilAy + "'>"
        + "<td class='ko-ay-hucre'><span class='ko-ay-ad'>" + s.ayAdi + "</span><span class='ko-ay-yil'>" + yil + "</span></td>"
        + "<td class='km-td-ozel' contenteditable='true' data-alan='ozelKm'>" + koKmFormat(s.ozelKm) + "</td>"
        + "<td class='km-td-tutar' contenteditable='true' data-alan='tutar'>" + koParaFormat(s.tutar) + "</td>"
        + bosluk
        + "<td contenteditable='true' data-alan='odemeTarihi'>" + (s.odemeKaydi.odemeTarihi || "-") + "</td>"
        + "<td class='km-td-metin' contenteditable='true' data-alan='odemePlatformu'>" + (s.odemeKaydi.odemePlatformu || "-") + "</td>"
        + "<td contenteditable='true' data-alan='odeme'>" + (s.odeme!==""?koParaFormat(s.odeme):"-") + "</td>"
        + "<td class='km-td-metin' contenteditable='true' data-alan='durum'>" + (s.odemeKaydi.durum || "-") + "</td>"
        + "</tr>";
    }).join("");

    document.getElementById("koYilToplamOzelKm").textContent = koKmFormat(sonuc.toplamOzelYil) + " km";
    document.getElementById("koYilUcretlendirilecekKm").textContent = koKmFormat(sonuc.ucretlendirilecekYil) + " km";
    document.getElementById("koYilToplamTutar").textContent = koParaFormat(sonuc.toplamTutarYil);
    document.getElementById("koYilToplamOdeme").textContent = koParaFormat(sonuc.toplamOdemeYil);
    document.getElementById("koYilKalanOdeme").textContent = koParaFormat(sonuc.toplamTutarYil - sonuc.toplamOdemeYil);

    govde.querySelectorAll("[contenteditable]").forEach(function(td){
      td.addEventListener("blur", function(){
        var tr = this.closest("tr");
        var yilAy = tr.getAttribute("data-yilay");
        var alan = this.getAttribute("data-alan");
        var ham = this.textContent.trim();
        var deger;

        if(KO_SAYISAL_ALANLAR[alan]){
          if(ham === "" || ham === "-" || ham === "—"){
            deger = ""; // boş bırakıldı → km-data.js alanı silip otomatik hesaba döner
          }else{
            var sayi = koSayiParse(ham);
            if(isNaN(sayi)){
              hataGoster("Geçersiz sayı: \"" + ham + "\" — eski değere dönülüyor.");
              tabloyuCiz(); // ekranı eski (geçerli) haline geri çiz
              return;
            }
            deger = sayi;
          }
        }else{
          deger = (ham === "-") ? "" : ham;
        }

        // km-kayitlar-render.js'teki hucreGuncelle kullanımıyla AYNI desen:
        // ekranı burada elle güncellemiyoruz — "kmOdemeleri" üzerindeki
        // canlı dinleyici (KmData.odemeDegistiginde, aşağıda bağlı) zaten
        // her değişiklikte tabloyuCiz()'i tetikleyip toplamları ve TL
        // formatlarını tazeliyor. Firebase JS SDK kendi yazdığımız değeri
        // sunucu onayı beklemeden hemen yerel olarak yansıttığı için bu
        // gecikmesiz olur.
        KmData.odemeGuncelle(yilAy, alan, deger, function(basarili, err){
          if(!basarili) hataGoster("Kaydedilemedi: " + (err && err.message ? err.message : "bilinmeyen hata"));
        });
      });
    });
  }catch(e){ hataGoster("Tablo çizilemedi: " + e.message); }
}

function excelAktar(){
  try{
    if(typeof XLSX === "undefined"){
      hataGoster("Excel kütüphanesi yüklenemedi, internet bağlantınızı kontrol edin.");
      return;
    }
    var yil = koBuYil();
    var carpan = parseFloat(KmData.carpanOku(yil)) || 0;
    var hakki = parseFloat(KmData.hakkiOku(yil)) || 0;
    var sonuc = koYilHesapla(yil, carpan, hakki);
    var basliklar = ["Ay","Toplam Özel KM","Tutar","Ödeme Tarihi","Platform","Ödeme","Durum"];
    var veriSatirlari = sonuc.aylar.map(function(s){
      var odemeTutari = (typeof s.odeme === "number") ? s.odeme : 0;
      return [s.ayAdi, s.ozelKm, s.tutar, s.odemeKaydi.odemeTarihi||"", s.odemeKaydi.odemePlatformu||"", odemeTutari||"", s.odemeKaydi.durum||""];
    });

    var aoa = [basliklar].concat(veriSatirlari);
    aoa.push(["TOPLAM", sonuc.toplamOzelYil, sonuc.toplamTutarYil, "", "", sonuc.toplamOdemeYil, ""]);

    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{wch:12},{wch:14},{wch:12},{wch:14},{wch:18},{wch:12},{wch:14}];

    var KENAR_INCE = { style:"thin", color:{rgb:"333333"} };
    var KENAR_ORTA = { style:"medium", color:{rgb:"505050"} };
    function hucreAyarla(r, c, style){
      var adr = XLSX.utils.encode_cell({r:r, c:c});
      if(!ws[adr]) ws[adr] = {t:"s", v:""};
      ws[adr].s = style;
    }
    for(var hc=0; hc<basliklar.length; hc++){
      hucreAyarla(0, hc, {
        fill: {patternType:"solid", fgColor:{rgb:"FAEEDA"}, bgColor:{rgb:"FAEEDA"}},
        font: {bold:true, color:{rgb:"003A70"}},
        alignment: {horizontal:"center", vertical:"center"},
        border: {top:KENAR_ORTA, bottom:KENAR_ORTA, left:KENAR_INCE, right:KENAR_INCE}
      });
    }
    var toplamSatir = aoa.length - 1;
    for(var tc=0; tc<basliklar.length; tc++){
      hucreAyarla(toplamSatir, tc, {
        font: {bold:true, sz:12, color:{rgb:"FF0000"}},
        alignment: {horizontal:"center"},
        border: {top:KENAR_ORTA, bottom:KENAR_ORTA}
      });
    }

    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "KM Ödeme " + yil);
    XLSX.writeFile(wb, "Yillik_KM_Odeme_" + yil + ".xlsx");
  }catch(e){ hataGoster("Excel oluşturulamadı: " + e.message); }
}

window.addEventListener("error", function(ev){
  hataGoster("HATA: " + ev.message + " (" + (ev.filename||"").split("/").pop() + ":" + ev.lineno + ")");
});

document.addEventListener("DOMContentLoaded", function(){
  tarihiGuncelle();
  document.getElementById("btnKoExcel").onclick = excelAktar;
  document.getElementById("btnKoKaydet").onclick = function(){
    var btn = this;
    if(document.activeElement && document.activeElement.hasAttribute && document.activeElement.hasAttribute("contenteditable")){
      document.activeElement.blur();
    }
    setTimeout(function(){
      var eskiMetin = btn.textContent;
      btn.textContent = "✓ Kaydedildi";
      btn.disabled = true;
      setTimeout(function(){ btn.textContent = eskiMetin; btn.disabled = false; }, 1500);
    }, 150);
  };

  // 03.10.2026 güncellemesi: çarpan artık blur'da DEĞİL, SADECE "✓ Kaydet"
  // tuşuna basınca kaydediliyor — Abdullah değiştirip tuşa basmadıkça
  // yazılı/kayıtlı değer olduğu gibi kalır.
  document.getElementById("btnKoCarpanKaydet").addEventListener("click", function(){
    var btn = this;
    var yil = koBuYil();
    var input = document.getElementById("koCarpanInput");
    var deger = input.value.trim();
    if(deger === ""){ koCarpaniGuncelle(); return; } // boş bırakılırsa dokunma
    KmData.carpanKaydet(yil, deger, function(basarili, err){
      if(!basarili){
        hataGoster("KM çarpanı kaydedilemedi: " + (err && err.message ? err.message : "geçersiz değer"));
        return;
      }
      var eskiMetin = btn.textContent;
      btn.textContent = "✓ Kaydedildi";
      btn.disabled = true;
      setTimeout(function(){ btn.textContent = eskiMetin; btn.disabled = false; }, 1500);
    });
  });

  // Şirket KM Hakkı — KM Çarpanı ile AYNI desen: SADECE tuşla kaydedilir.
  document.getElementById("btnKoHakKaydet").addEventListener("click", function(){
    var btn = this;
    var yil = koBuYil();
    var input = document.getElementById("koHakInput");
    var deger = input.value.trim();
    if(deger === ""){ koHakkiGuncelle(); return; } // boş bırakılırsa dokunma
    KmData.hakkiKaydet(yil, deger, function(basarili, err){
      if(!basarili){
        hataGoster("Şirket KM hakkı kaydedilemedi: " + (err && err.message ? err.message : "geçersiz değer"));
        return;
      }
      var eskiMetin = btn.textContent;
      btn.textContent = "✓ Kaydedildi";
      btn.disabled = true;
      setTimeout(function(){ btn.textContent = eskiMetin; btn.disabled = false; }, 1500);
    });
  });

  koCarpaniGuncelle();
  koHakkiGuncelle();
  tabloyuCiz();
  KmData.degistiginde(tabloyuCiz);
  KmData.odemeDegistiginde(tabloyuCiz);
  KmData.carpanDegistiginde(function(){
    koCarpaniGuncelle();
    tabloyuCiz();
  });
  KmData.hakkiDegistiginde(function(){
    koHakkiGuncelle();
    tabloyuCiz();
  });
});
