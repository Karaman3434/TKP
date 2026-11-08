/*
  km-kayitlar-render.js
  ======================
  Eskiden km-render.js içindeydi, km.html'de aynı sayfada aşağı açılıyordu
  (24.09.2026'da ayrı sayfaya taşındı — bkz. km-kayitlar.html). Üstte
  YILLIK/AYLIK TOPLAM panoları (İş/Özel), altında ay seçici + gerçek/
  düzenlenebilir tablo + Kaydet + Excel'e Aktar.
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

var GUNLER = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
var AYLAR = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

function tarihiGuncelle(){
  var el = document.getElementById("gunTarihi");
  var d = new Date();
  if(el) el.textContent = GUNLER[d.getDay()] + ", " + d.getDate() + " " + AYLAR[d.getMonth()] + " " + d.getFullYear();
}

// "YYYY-MM-DD" anahtarını "GG.AA.YYYY" gösterim metnine çevirir — Tarih
// hücresi elle düzenlenince gerçekten değişmiş mi diye karşılaştırmak için.
function tarihMetniAyikla(anahtar){
  var p = (anahtar||"").split("-");
  if(p.length !== 3) return "";
  return p[2] + "." + p[1] + "." + p[0];
}

// ÖZEL GÜN (08.11.2026): hafta sonu (Cumartesi/Pazar — tarihten otomatik),
// raporlu, resmi tatil, dinî bayram, yıllık izin, izin günleri → satır SARI.
// Kelime eşleşmesi Türkçe harflerden bağımsızdır (İzin / IZIN / izin hepsi).
var OZEL_GUN_ANAHTAR_KELIMELER = ["HAFTA SONU","HAFTASONU","TATIL","RAPOR","IZIN","BAYRAM","YILLIK"];
function ozelGunMetniSadelestir(m){
  return (m||"").toLocaleUpperCase("tr-TR")
    .replace(/İ/g,"I").replace(/Ş/g,"S").replace(/Ğ/g,"G")
    .replace(/Ü/g,"U").replace(/Ö/g,"O").replace(/Ç/g,"C");
}
function ozelGunMuHesapla(k){
  var p = (k.anahtar||"").split("-");
  if(p.length === 3){
    var gun = new Date(parseInt(p[0],10), parseInt(p[1],10)-1, parseInt(p[2],10)).getDay();
    if(gun === 0 || gun === 6) return true; // Pazar / Cumartesi
  }
  var satirMetni = ozelGunMetniSadelestir((k.guzergah||"") + " " + (k.ziyaretYerleri||""));
  return OZEL_GUN_ANAHTAR_KELIMELER.some(function(kelime){ return satirMetni.indexOf(kelime) !== -1; });
}

var seciliYilAy = null; // null = bu ay (varsayılan); "YYYY-MM" = geçmiş/seçilmiş ay

function aySeciciyiDoldur(){
  var secici = document.getElementById("kmAySecici");
  var aylar = KmData.kayitliAylar();
  var simdi = new Date();
  var buAyAnahtari = simdi.getFullYear()+"-"+("0"+(simdi.getMonth()+1)).slice(-2);
  secici.innerHTML = aylar.map(function(ya){
    var etiket = KmData.ayAdiUret(ya) + (ya===buAyAnahtari ? " (bu ay)" : "");
    return "<option value='" + ya + "'>" + etiket + "</option>";
  }).join("");
  secici.value = seciliYilAy || buAyAnahtari;
}

// YILLIK TOPLAM (24.09.2026) — seçili ayın YILINDAKİ tüm kayıtların
// İş/Özel toplamı. Ay değişince yıl da değişebileceği için her çizimde
// yeniden hesaplanır.
function yillikToplamiCiz(yil){
  var kayitlar = KmData.yilinKayitlari(String(yil));
  var toplamIs = 0, toplamOzel = 0;
  kayitlar.forEach(function(k){
    if(k.isKm!=null) toplamIs += k.isKm;
    if(k.ozelKm!=null) toplamOzel += k.ozelKm;
  });
  document.getElementById("kmYilEtiket").textContent = yil;
  document.getElementById("kmYilToplamIs").textContent = toplamIs + " km";
  document.getElementById("kmYilToplamOzel").textContent = toplamOzel + " km";
}

function tabloyuCiz(){
  try{
    var simdi0 = new Date();
    var buAyAnahtari0 = simdi0.getFullYear()+"-"+("0"+(simdi0.getMonth()+1)).slice(-2);
    var goruntulenenAy = seciliYilAy || buAyAnahtari0;
    var yil = goruntulenenAy.split("-")[0];
    yillikToplamiCiz(yil);
    document.getElementById("kmAyEtiket").textContent = KmData.ayAdiUret(goruntulenenAy);

    var kayitlar = KmData.ayinKayitlari(goruntulenenAy);
    document.getElementById("kmTabloBaslik").textContent = (goruntulenenAy===buAyAnahtari0 ? "Bu Ayın Kayıtları" : KmData.ayAdiUret(goruntulenenAy) + " Kayıtları");
    var govde = document.getElementById("kmTabloGovde");
    var bugunAnahtar = KmData.bugunAnahtari();

    if(kayitlar.length === 0){
      govde.innerHTML = "<tr><td colspan='8' style='text-align:center;color:#44494f;padding:16px 0;'>Bu ayda hiç kayıt yok.</td></tr>";
      document.getElementById("kmAyToplamIs").textContent = "0 km";
      document.getElementById("kmAyToplamOzel").textContent = "0 km";
      document.getElementById("kmToplamlarIs").textContent = "İş KM: 0";
      document.getElementById("kmToplamlarOzel").textContent = "Özel KM: 0";
      bilgiSeridiniGuncelle(goruntulenenAy);
      return;
    }

    var toplamIs = 0, toplamOzel = 0;
    govde.innerHTML = kayitlar.map(function(k){
      var parca = k.anahtar.split("-");
      var d = new Date(parseInt(parca[0],10), parseInt(parca[1],10)-1, parseInt(parca[2],10));
      var tarihGosterim = ("0"+d.getDate()).slice(-2) + "." + ("0"+(d.getMonth()+1)).slice(-2) + "." + d.getFullYear();
      var gunAdiGosterim = GUNLER[d.getDay()].toLocaleUpperCase("tr-TR");
      if(k.isKm!=null) toplamIs += k.isKm;
      if(k.ozelKm!=null) toplamOzel += k.ozelKm;
      var bugunMu = k.anahtar === bugunAnahtar;
      var satirSinifi = bugunMu ? " class='km-satir--bugun'" : "";
      // Hafta sonu / tatil / rapor / izin / bayram gibi özel kullanım
      // günlerinde satırın tamamı SARI zemin olur (bugün olsa bile).
      if(ozelGunMuHesapla(k)) satirSinifi = " class='km-satir--ozelgun'";
      var baslangicSinifi = bugunMu ? " km-td-baslangic-bugun" : "";
      // Saat: "09:00-18:00" gibi aralık girilmişse iki satır (üstte
      // başlangıç, altta bitiş); tek saat varsa tek satır.
      var saatGosterim = (k.saat||"-").split("-").map(function(s){ return s.trim(); }).join("\n");
      return "<tr" + satirSinifi + " data-anahtar='" + k.anahtar + "'>"
        + "<td class='km-td-tarih'><div class='km-tarih-gun' contenteditable='true' data-alan='tarih'>" + tarihGosterim + "</div><div class='km-tarih-adi'>" + gunAdiGosterim + "</div></td>"
        + "<td class='km-td-saat' contenteditable='true' data-alan='saat'>" + saatGosterim + "</td>"
        + "<td class='km-td-metin' contenteditable='true' data-alan='guzergah'>" + (k.guzergah||"-") + "</td>"
        + "<td class='km-td-metin' contenteditable='true' data-alan='ziyaret'>" + (k.ziyaretYerleri||"-") + "</td>"
        + "<td contenteditable='true' data-alan='baslangic' class='km-td-baslangic" + baslangicSinifi + "'>" + (k.km!=null?k.km:"-") + "</td>"
        + "<td contenteditable='true' data-alan='bitis'>" + (k.bitisKm!=null?k.bitisKm:"-") + "</td>"
        + "<td class='km-td-is' contenteditable='true' data-alan='isKm'>" + (k.isKm!=null?k.isKm:"-") + "</td>"
        + "<td class='km-td-ozel' contenteditable='true' data-alan='ozelKm'>" + (k.ozelKm!=null?k.ozelKm:"-") + "</td>"
        + "</tr>";
    }).join("");

    document.getElementById("kmAyToplamIs").textContent = toplamIs + " km";
    document.getElementById("kmAyToplamOzel").textContent = toplamOzel + " km";
    document.getElementById("kmToplamlarIs").textContent = "İş KM: " + toplamIs;
    document.getElementById("kmToplamlarOzel").textContent = "Özel KM: " + toplamOzel;
    bilgiSeridiniGuncelle(goruntulenenAy);

    govde.querySelectorAll("[contenteditable]").forEach(function(td){
      td.addEventListener("blur", function(){
        var tr = this.closest("tr");
        var anahtar = tr.getAttribute("data-anahtar");
        var alan = this.getAttribute("data-alan");
        var deger = this.textContent.trim();
        // Tarih hücresi diğerlerinden farklı: bir "alan" değil, kaydın
        // kendi anahtarı (Firebase'de kayıt tarihe göre saklanıyor) — bu
        // yüzden değer güncellemesi değil, kaydı yeni tarihe TAŞIMA işlemi.
        if(alan === "tarih"){
          if(deger === tarihMetniAyikla(anahtar)) return; // değişmemiş
          KmData.tarihiDegistir(anahtar, deger, function(basarili, err){
            if(!basarili){
              hataGoster("Tarih değiştirilemedi: " + (err && err.message ? err.message : err));
              tabloyuCiz(); // eski tarihe geri döndür
              return;
            }
            tabloyuCiz(); // satır yeni tarihiyle/sırasıyla yeniden çizilir
          });
          return;
        }
        // Saat hücresi iki satır (başlangıç/bitiş) olarak gösteriliyor —
        // kaydederken tekrar tek satır "09:00-18:00" formatına çeviriyoruz.
        if(alan === "saat"){
          deger = deger.split("\n").map(function(s){ return s.trim(); }).filter(Boolean).join("-");
        }
        if(deger === "-") deger = "";
        KmData.hucreGuncelle(anahtar, alan, deger, function(basarili, err){
          if(!basarili) hataGoster("Güncellenemedi: " + (err && err.message ? err.message : "bilinmeyen hata"));
        });
      });
    });
  }catch(e){ hataGoster("Tablo çizilemedi: " + e.message); }
}

var kmAyarlarOnbellek = {};

// Bilgi şeridi (25.09.2026) — programdaki AD SOYAD/DÖNEM/PLAKA şeridi,
// excelAktar()'ın aynı bilgiyi yazdığı üst satırla BİREBİR kaynak
// (kmAyarlarOnbellek + o an görüntülenen ay) kullanır.
function bilgiSeridiniGuncelle(goruntulenenAy){
  var ay = kmAyarlarOnbellek || {};
  document.getElementById("kmBilgiAdSoyad").textContent = ay.adSoyad || "-";
  document.getElementById("kmBilgiDonem").textContent = KmData.ayAdiUret(goruntulenenAy);
  document.getElementById("kmBilgiPlaka").textContent = ay.plaka || "-";
}

// excelAktar() (25.09.2026, TAM YENİDEN YAZILDI) — Abdullah'ın kendi elle
// biçimlendirdiği örnek dosyayla (06 HNC 135_Eylül 2026.xlsx) BİREBİR:
// A sütunu boş kenar payı, B'de başlayan AD SOYAD/DÖNEM/PLAKA bilgi
// kutusu (orta-kalın #505050 çerçeve + #EAF2FC zemin + 14pt kalın lacivert
// yazı), bej başlık satırı, ince #333 hücre ızgarası, özel gün satırlarında
// sarı zemin, ve en altta kırmızı kalın "TOPLAMLAR" satırı. TEK KAYNAK
// KURALI: bu renk/kenar değerleri km-style.css'teki .km-bilgi-serit /
// .km-veri-tablo / .km-toplamlar-serit ile AYNI tutulmalı — biri
// değişince diğeri de burada güncellenmeli.
function excelAktar(){
  try{
    if(typeof XLSX === "undefined"){
      hataGoster("Excel kütüphanesi yüklenemedi, internet bağlantınızı kontrol edin.");
      return;
    }
    var goruntulenenAy2 = seciliYilAy || (function(){ var d=new Date(); return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2); })();
    var kayitlar = KmData.ayinKayitlari(goruntulenenAy2); // eski tarih üstte, yeni altta
    if(kayitlar.length === 0){
      alert("Bu ayda hiç kayıt yok, aktarılacak veri bulunamadı.");
      return;
    }
    var kayaliAyarlar = kmAyarlarOnbellek || {};
    var adSoyad = kayaliAyarlar.adSoyad || "";
    var plaka = kayaliAyarlar.plaka || "";
    var donemEtiket = KmData.ayAdiUret(goruntulenenAy2);

    var basliklar = ["Tarih","Saat","Seyir Güzergahı","Ziyaret Edilen Yerler","Başlangıç KM","Bitiş KM","İş KM","Özel KM"];
    var toplamIsXl = 0, toplamOzelXl = 0;
    var veriSatirlari = kayitlar.map(function(k){
      var parca = k.anahtar.split("-");
      var d = new Date(parseInt(parca[0]), parseInt(parca[1])-1, parseInt(parca[2]));
      // İstenen format: "26.08.2026" (rakam) alt satırda "ÇARŞAMBA" (harf) —
      // hücre içinde iki satır (wrapText ile aşağıda etkinleştiriliyor).
      var tarihStr = ("0"+d.getDate()).slice(-2)+"."+("0"+(d.getMonth()+1)).slice(-2)+"."+d.getFullYear()+"\n"+GUNLER[d.getDay()].toLocaleUpperCase("tr-TR");
      // Saat: "09:00-18:00" gibi eski/aralıklı girişlerde başlangıç üstte,
      // bitiş altta iki satır olsun. Tek saat girilmişse tek satır kalır.
      var saatStr = k.saat || "";
      if(saatStr.indexOf("-") >= 0){
        var saatParca = saatStr.split("-");
        saatStr = saatParca[0].trim() + "\n" + saatParca[1].trim();
      }
      // İş KM / Özel KM — depolanmış değere güvenmek yerine HER ZAMAN
      // Excel'e aktarırken (Bitiş KM - Başlangıç KM) taze hesaplanır ve
      // günün kategorisine (İş/Özel) göre ilgili sütuna yazılır. Böylece
      // tablo satırı sonradan elle düzenlenmiş olsa bile Excel çıktısı
      // her zaman tutarlı kalır.
      var isKmDeger = "", ozelKmDeger = "";
      if(k.km!=null && k.bitisKm!=null){
        var fark = k.bitisKm - k.km;
        if(k.kmKategori === "ozel") ozelKmDeger = fark;
        else isKmDeger = fark; // varsayılan/"is" kategorisi
      }
      if(typeof isKmDeger === "number") toplamIsXl += isKmDeger;
      if(typeof ozelKmDeger === "number") toplamOzelXl += ozelKmDeger;
      return [tarihStr, saatStr, k.guzergah||"", k.ziyaretYerleri||"", k.km!=null?k.km:"", k.bitisKm!=null?k.bitisKm:"", isKmDeger, ozelKmDeger];
    });

    var n = veriSatirlari.length;
    // Satır haritası (0-indeksli): 0=boş kenar, 1=BİLGİ satırı, 2=boş ara,
    // 3=BAŞLIK satırı, 4..(4+n-1)=veri satırları, sonra 1 boş satır, sonra
    // TOPLAMLAR satırı — örnek dosyadaki 22 veri satırlı düzenle birebir.
    var R_BILGI = 1, R_BASLIK = 3, R_VERI0 = 4, R_TOPLAM = R_VERI0 + n + 1;

    var aoa = [];
    aoa[0] = [];
    aoa[R_BILGI] = ["", "AD SOYAD", adSoyad, "", "DÖNEM", donemEtiket, "PLAKA", plaka, ""];
    aoa[2] = [];
    aoa[R_BASLIK] = [""].concat(basliklar);
    for(var i=0; i<n; i++){ aoa[R_VERI0+i] = [""].concat(veriSatirlari[i]); }
    aoa[R_TOPLAM] = [];
    aoa[R_TOPLAM][5] = "TOPLAMLAR";
    aoa[R_TOPLAM][7] = toplamIsXl;
    aoa[R_TOPLAM][8] = toplamOzelXl;

    var ws = XLSX.utils.aoa_to_sheet(aoa);
    // A boş kenar payı, B..I veri sütunları (örnek dosyayla birebir genişlik).
    ws["!cols"] = [{wch:1.7},{wch:20.8},{wch:10.9},{wch:15.7},{wch:12.8},{wch:12.6},{wch:11.7},{wch:10.6},{wch:11.4}];
    var satirYukseklikleri = [];
    satirYukseklikleri[R_BILGI] = {hpt:27};
    satirYukseklikleri[R_BASLIK] = {hpt:27};
    for(var ry=0; ry<n; ry++){ satirYukseklikleri[R_VERI0+ry] = {hpt:32}; }
    satirYukseklikleri[R_TOPLAM] = {hpt:19.5};
    ws["!rows"] = satirYukseklikleri;

    ws["!merges"] = [
      {s:{r:R_BILGI,c:7}, e:{r:R_BILGI,c:8}},   // PLAKA değeri (H:I)
      {s:{r:R_TOPLAM,c:5}, e:{r:R_TOPLAM,c:6}}   // "TOPLAMLAR" etiketi (F:G)
    ];

    // Programdaki tabloyla (km-style.css) BİREBİR aynı tonlar.
    var KENAR_ORTA = { style:"medium", color:{rgb:"505050"} };
    var KENAR_INCE = { style:"thin", color:{rgb:"333333"} };
    var SUTUN_ILK = 1, SUTUN_SON = 8; // B..I

    function hucreAyarla(r, c, style){
      var adr = XLSX.utils.encode_cell({r:r, c:c});
      if(!ws[adr]) ws[adr] = {t:"s", v:""};
      ws[adr].s = style;
    }

    // BİLGİ satırı — tüm hücreler medium top/bottom, medium sadece dış
    // kenarlarda (sol B, sağ I), aradaki hücreler ince ayraç. Hizalama,
    // örnek dosyadaki elle ayarlanmış düzenle birebir (etiket/değer
    // sütununa göre değişiyor, tek kalıba uymuyor).
    var BILGI_HIZA = {1:"right", 2:"left", 3:"center", 4:"right", 5:"center", 6:"center", 7:"left", 8:"center"};
    for(var ic=SUTUN_ILK; ic<=SUTUN_SON; ic++){
      hucreAyarla(R_BILGI, ic, {
        fill: {patternType:"solid", fgColor:{rgb:"EAF2FC"}, bgColor:{rgb:"EAF2FC"}},
        font: {bold:true, sz:14, color:{rgb:"003A70"}},
        alignment: {horizontal:BILGI_HIZA[ic], vertical:"center"},
        border: {
          top:KENAR_ORTA, bottom:KENAR_ORTA,
          left:(ic===SUTUN_ILK?KENAR_ORTA:KENAR_INCE),
          right:(ic===SUTUN_SON?KENAR_ORTA:KENAR_INCE)
        }
      });
    }

    // BAŞLIK satırı — bej zemin, ince ızgara, sadece dış sol/sağ kenar medium.
    for(var hc=0; hc<basliklar.length; hc++){
      var col = SUTUN_ILK + hc;
      hucreAyarla(R_BASLIK, col, {
        fill: {patternType:"solid", fgColor:{rgb:"FAEEDA"}, bgColor:{rgb:"FAEEDA"}},
        font: {bold:true, color:{rgb:"003A70"}},
        alignment: {horizontal:"center", vertical:"center"},
        border: {
          top:KENAR_INCE, bottom:KENAR_INCE,
          left:(col===SUTUN_ILK?KENAR_ORTA:KENAR_INCE),
          right:(col===SUTUN_SON?KENAR_ORTA:KENAR_INCE)
        }
      });
    }

    // VERİ satırları — ince ızgara, sol/sağ dış kenar medium; özel gün
    // (hafta sonu/tatil/rapor/izin/bayram) satırları sarı zeminle vurgulu.
    for(var vr=0; vr<n; vr++){
      var ozelGunMuXl = ozelGunMuHesapla(kayitlar[vr]);
      for(var vc=0; vc<basliklar.length; vc++){
        var col2 = SUTUN_ILK + vc;
        var stil = {
          alignment: {horizontal:"center", vertical:"center", wrapText: (vc===0||vc===1)},
          border: {
            top:KENAR_INCE, bottom:KENAR_INCE,
            left:(col2===SUTUN_ILK?KENAR_ORTA:KENAR_INCE),
            right:(col2===SUTUN_SON?KENAR_ORTA:KENAR_INCE)
          }
        };
        if(ozelGunMuXl){
          stil.fill = {patternType:"solid", fgColor:{rgb:"FFFF00"}, bgColor:{rgb:"FFFF00"}};
        }
        hucreAyarla(R_VERI0+vr, col2, stil);
      }
    }

    // TOPLAMLAR satırı — "TOPLAMLAR" etiketi (F:G, sağa yaslı) + İş KM/
    // Özel KM toplamları (H, I), kalın kırmızı 14pt, alt kenar medium.
    hucreAyarla(R_TOPLAM, 5, { font:{bold:true, sz:14, color:{rgb:"FF0000"}}, alignment:{horizontal:"right"}, border:{bottom:KENAR_ORTA} });
    hucreAyarla(R_TOPLAM, 6, { font:{bold:true, sz:14, color:{rgb:"FF0000"}}, border:{bottom:KENAR_ORTA} });
    hucreAyarla(R_TOPLAM, 7, { font:{bold:true, sz:14, color:{rgb:"FF0000"}}, alignment:{horizontal:"center"}, border:{bottom:KENAR_ORTA} });
    hucreAyarla(R_TOPLAM, 8, { font:{bold:true, sz:14, color:{rgb:"FF0000"}}, alignment:{horizontal:"center"}, border:{bottom:KENAR_ORTA, right:KENAR_ORTA} });

    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "KM Takip");
    var dosyaAdi = ((plaka||"KM").replace(/\s/g,"_"))+"_"+donemEtiket.replace(/\s/g,"_")+".xlsx";
    XLSX.writeFile(wb, dosyaAdi);
  }catch(e){ hataGoster("Excel oluşturulamadı: " + e.message); }
}

window.addEventListener("error", function(ev){
  hataGoster("HATA: " + ev.message + " (" + (ev.filename||"").split("/").pop() + ":" + ev.lineno + ")");
});

document.addEventListener("DOMContentLoaded", function(){
  tarihiGuncelle();
  var btnMenuEl = document.getElementById("btnMenu");
  if(btnMenuEl) btnMenuEl.onclick = function(){ window.location.href = "menu.html"; };
  document.getElementById("btnExcel").onclick = excelAktar;
  document.getElementById("btnKmTabloKaydet").onclick = function(){
    // Tablodaki hücreler zaten yazarken (blur olunca) otomatik kaydediyor —
    // bu tuş, o an düzenlemede olan (henüz blur olmamış) bir hücre varsa
    // onu zorla kaydettirip kullanıcıya açık bir onay gösteriyor.
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
  document.getElementById("kmAySecici").onchange = function(){
    seciliYilAy = this.value;
    tabloyuCiz();
  };

  KmData.ayarlarOku(function(ayarlar){
    kmAyarlarOnbellek = ayarlar || {};
    // Ayarlar Firebase'den ASENKRON geldiği için ilk çizimde AD SOYAD/
    // PLAKA boş görünebilir — geldiği an şeridi yeniden doldur.
    var simdiB = new Date();
    var buAyAnahtariB = simdiB.getFullYear()+"-"+("0"+(simdiB.getMonth()+1)).slice(-2);
    bilgiSeridiniGuncelle(seciliYilAy || buAyAnahtariB);
  });

  aySeciciyiDoldur();
  tabloyuCiz();
  KmData.degistiginde(function(){
    aySeciciyiDoldur();
    tabloyuCiz();
  });
});
