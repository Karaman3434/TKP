/*
  belge-render.js — WG.141026.1940.806
  ===============
  14.10.2026: "Yazdır" artık window.print() yerine gerçek bir PDF üretiyor
  (bkz. teklif-pdf.js) — bu dosyanın KENDİ görünümüne/işlevlerine dokunulmadı,
  sadece msYazdir butonunun davranışı değişti.
  "weiconv2_goruntulenen_belge" localStorage anahtarından {tip, ts} okur,
  ReportsData.sonIslemler() içinden o kaydı bulur, eski uygulamanın
  faturaOnizlemeHtmlOlustur() düzenini BİREBİR üreten HTML'i çizer.
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

var TIP_ETIKET_BELGE = {numune:"NUMUNE", teklif:"FİYAT TEKLİFİ", proforma:"PROFORMA FATURA", siparis:"SİPARİŞ"};
var KOD_ONEK_BELGE = {numune:"NM", teklif:"FT", proforma:"PF", siparis:"SP"};
// HATA DÜZELTME (WG.090926.196): SP/FT/PF/NM standardından önce oluşan
// eski belgelerin kodu hâlâ eski önekle (SİP./F.TEK./P.FAT./NUM.)
// başlıyor — bu yüzden renk haritası her iki öneki de tanır.
var ONEK_RENK_BELGE = {
  "SP": {yazi:"#003a70", bg:"#eaf2fc"},
  "FT": {yazi:"#0e6b58", bg:"#eafaf3"},
  "PF": {yazi:"#5b3a86", bg:"#f1ecf9"},
  "NM": {yazi:"#b7601f", bg:"#fff4e5"},
  "SİP": {yazi:"#003a70", bg:"#eaf2fc"},
  "F.TEK": {yazi:"#0e6b58", bg:"#eafaf3"},
  "P.FAT": {yazi:"#5b3a86", bg:"#f1ecf9"},
  "NUM": {yazi:"#b7601f", bg:"#fff4e5"}
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
function gecmisCipSatiriHtml(kayit){
  if(!kayit.oncekiKod) return "";
  var oncekiOnek = kodOnekiAyiklaBelge(kayit.oncekiKod) || "?";
  var oncekiRenk = ONEK_RENK_BELGE[oncekiOnek] || {yazi:"#556170", bg:"#f1f3f6"};
  var simdikiOnek = KOD_ONEK_BELGE[kayit.tip] || "?";
  var simdikiRenk = ONEK_RENK_BELGE[simdikiOnek] || {yazi:"#003a70", bg:"#eaf2fc"};
  return "<div class='belge-gecmis-cip-satir'>"
    + "<button class='belge-gecmis-cip' id='btnGecmisCip' style='background:" + oncekiRenk.bg + ";'>"
      + "<span class='belge-gecmis-cip-kod' style='color:" + oncekiRenk.yazi + ";'>" + htmlEsc(oncekiOnek) + "</span>"
      + "<span class='belge-gecmis-cip-tarih'>" + htmlEsc(kayit.oncekiTarih || "") + "</span>"
    + "</button>"
    + "<span class='belge-gecmis-ok'>▶</span>"
    + "<div class='belge-gecmis-cip belge-gecmis-cip--simdi' style='background:" + simdikiRenk.yazi + ";'>"
      + "<span class='belge-gecmis-cip-kod' style='color:#fff;'>" + htmlEsc(simdikiOnek) + "</span>"
      + "<span class='belge-gecmis-cip-tarih' style='color:#c9dcf0;'>şu an</span>"
    + "</div>"
    + "</div>";
}
var DURUM_ETIKET = {
  iptal: {ikon:"🚫", ad:"İPTAL EDİLDİ", renk:"#c0392b", bg:"#fdeceb"},
  iade: {ikon:"↩️", ad:"İADE EDİLDİ", renk:"#6a1b9a", bg:"#f3e5f5"},
  kacan: {ikon:"❌", ad:"KAÇAN SİPARİŞ", renk:"#c0392b", bg:"#fff4e5"},
  beklemede: {ikon:"⏳", ad:"BEKLEMEDE", renk:"#633806", bg:"#faeeda"}
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

// TEK SATIR ÜRETİCİ (08.10.2026, Abdullah'ın isteğiyle) — ana ürün tablosu
// VE bakiye ürün tablosu artık BİREBİR aynı satır yapısını kullanıyor; tek
// fark hangi adedin (gönderilen adet mi, bakiyede kalan adet mi) verildiği.
// Bu fonksiyon o ortak satırı üretir, çağıran taraf hangi adedi vereceğine
// karar verir — iki tablo arasında sütun/yazı/boyut farkı OLUŞMASI imkansız
// hale gelir (aynı kod, iki kez farklı adetle çağrılıyor).
function belgeSatirHtmlVeDeger(item, i, adet, kaydinKuru, zeminSinifi){
  var toplamEuro = (item.iskBirim||0) * (adet||0);
  var mk = (item.iskBirim||0)-(item.dipFiyat||0);
  var ozelFiyatMi = (item.iskonto||0) > 60;
  var satirPrim = ozelFiyatMi ? 0 : mk*(adet||0)*0.22;
  var satirPrimTl = Math.round(satirPrim * kaydinKuru);
  var primHucre = item.ozelEtiket === "bedelsiz" ? "🎁 Bedelsiz" : (ozelFiyatMi ? "Ö.F" : (satirPrim<0 ? "Yok" : ("<span class='belge-td-prim-tek'>"+paraHtml(satirPrimTl.toLocaleString("tr-TR"),"TL")+"</span>")));
  // NUMUNE/BEDELSİZ GÖSTERİMİ (28.09.2026, Abdullah'ın isteğiyle): bedelsiz
  // (numune) işaretli ürünlerde TOPLAM sütunu "0,00 EURO" yerine "NUMUNE"
  // yazar. İskonto %100 girilmişse İSK sütununda "%100" yerine sadece "-".
  var iskYuz100 = (item.iskonto||0) === 100;
  var toplamHucreIcerik = (item.ozelEtiket === "bedelsiz") ? "NUMUNE" : paraHtml(fmt(toplamEuro),"EURO");
  // NET TL SATIRI (01.10.2026, Abdullah'ın isteğiyle) — Belge Önizleme/
  // Kayıtlar ekranında da NET EURO'nun altında, günün/kaydın kuruyla
  // hesaplanmış TL karşılığı gösterilsin istendi. SADECE EKRAN İÇİN:
  // bu sayfa (belge-onizleme.html) hiçbir zaman mail/WhatsApp'a giden
  // görseli üretmiyor (o ayrı fonksiyon — send-render.js'teki
  // belgeGorselHtmlOlustur), o yüzden burada ek bir gizleme gerekmiyor.
  var netBirimFiyat = item.iskBirim!==undefined ? item.iskBirim : (item.listeFiyat||0);
  var netTl = kaydinKuru ? "<div class='belge-net-tl'>≈ " + Math.round(netBirimFiyat*kaydinKuru).toLocaleString("tr-TR") + " TL</div>" : "";
  var html = "<tr" + (zeminSinifi ? " class='" + zeminSinifi + "'" : "") + ">"
    + "<td class='belge-td-sira'>" + (i+1) + "</td>"
    + "<td class='belge-td-urun'><div class='belge-td-urun-kod'><span class='kod-blok kod-blok--b'><span class='kod-harf'>B</span> " + htmlEsc(item.berta||"-") + "</span> - <span class='kod-blok kod-blok--a'><span class='kod-harf'>A</span> " + htmlEsc(item.abas||"-") + "</span>" + "</div><div class='belge-td-urun-ad'>" + htmlEsc(item.ad) + "</div></td>"
    + "<td>" + (adet||0) + "</td>"
    + "<td>" + paraHtml(fmt(item.listeFiyat||0),"EURO") + "</td>"
    + "<td>" + (iskYuz100 ? "-" : "<span class='belge-isk-metin'>" + paraHtml((item.iskonto||0), "%") + "</span>") + "</td>"
    + "<td><span class='rozet-net'>" + paraHtml(fmt(netBirimFiyat),"EURO") + "</span>" + netTl + "</td>"
    + "<td class='belge-td-toplam'>" + toplamHucreIcerik + "</td>"
    + "<td class='belge-td-prim'>" + primHucre + "</td>"
    + "</tr>";
  return { html: html, toplamEuro: toplamEuro, prim: satirPrim, primTl: satirPrimTl };
}

function belgeyiCiz(kayit, musteri){
  try{
    var urunler = kayit.urunler || [];
    var kaydinKuru = kayit.kur || (parseFloat(localStorage.getItem("weicon_kur"))||0);
    var netEuro = 0, toplamPrim = 0, toplamPrimTl = 0;
    var satirlarHtml = urunler.map(function(item, i){
      var r = belgeSatirHtmlVeDeger(item, i, item.adet, kaydinKuru, "");
      netEuro += r.toplamEuro;
      if(r.prim > 0){ toplamPrim += r.prim; toplamPrimTl += r.primTl; }
      return r.html;
    }).join("");

    // BAKİYE ÜRÜN BLOĞU (08.10.2026, Abdullah'ın isteğiyle) — bakiyede kalan
    // adedi olan ürünler, ana tabloyla BİREBİR aynı sütun/tasarımda, ayrı
    // bir tabloda, ayrı bir toplamla gösterilir. Aynı belgeSatirHtmlVeDeger
    // satır üreticisi kullanılıyor, sadece "adet" yerine "bakiyeAdet" veriliyor.
    var bakiyeUrunler = urunler.filter(function(u){ return (u.bakiyeAdet||0) > 0; });
    var bakiyeToplamEuro = 0;
    var bakiyeSatirlarHtml = bakiyeUrunler.map(function(item, i){
      var r = belgeSatirHtmlVeDeger(item, i, item.bakiyeAdet, kaydinKuru, "hareket-satir--sari");
      bakiyeToplamEuro += r.toplamEuro;
      return r.html;
    }).join("");

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
    var yetkiliBilgiHtml = yetkililer.map(function(k){ return yetkiliSatiriHtml(k.isim, k.telefon, k.eposta); }).join("");

    var musteriBlokHtml = "<div class='belge-musteri-baslik belge-musteri-baslik--logolu tip-" + (kayit.tip||"siparis") + "'><span>" + (TIP_ETIKET_BELGE[kayit.tip]||"SİPARİŞ") + "</span><span class='belge-logo-mini'>WEICON</span></div>"
      + "<div class='belge-musteri-govde'>"
      // DÜZELTME (07.10.2026, Abdullah'ın isteğiyle, mockup üzerinden
      // onaylandı): firma ismi başına kalın • işareti + etiketler satır
      // başında sabit kalırken değerler (firma ismi, açık adres) ~3mm
      // daha içeriden başlıyor (bkz. belge-style.css .belge-musteri-ad /
      // .belge-adres-govde).
      + "<div class='belge-musteri-ad'><b class='ck-isim-nokta'>•</b> " + htmlEsc(kayit.musteri) + "</div>"
      + ((vade||faturaTuru||kargo) ? "<div class='belge-kosul-grid'>" + kosulKutusuHtml("📅","VADE",vade) + kosulKutusuHtml("📄","FATURA",faturaTuru) + kosulKutusuHtml("🚚","KARGO",kargo) + "</div>" : "")
      + (faturaAdr ? "<div class='belge-adres-blok'><b class='belge-adres-etiket-fatura'>🧾 FATURA ADRESİ</b><span class='belge-adres-govde'>" + htmlEsc(faturaAdr) + (sehir?", "+htmlEsc(sehir):"") + "</span></div>" : "")
      + (teslimatAdr ? "<div class='belge-adres-blok-teslimat'><b class='belge-adres-etiket-teslimat'>🚚 TESLİMAT ADRESİ</b><span class='belge-adres-govde'>" + htmlEsc(teslimatAdr) + "</span></div>" : "")
      + (yetkiliBilgiHtml ? "<div class='belge-yetkili-blok'><b class='belge-adres-etiket-yetkili'>👤 YETKİLİ BİLGİSİ</b>" + yetkiliBilgiHtml + "</div>" : "")
      + "</div>";

    // DÜZELTME (14.10.2026, Abdullah onayı — "7. Belge" tam yeniden
    // tasarım): kod artık tablonun hemen üstündeki GRİ, çerçeveli, bağımsız
    // ".belge-belge-baslik-serit--mavi" şeridinde, tür adıyla birlikte
    // (bkz. aşağıda html değişkeni). "Bu işlem kuru" artık GENEL TOPLAM
    // kutusunun İÇİNDE, Sepet/Gönder ile AYNI .belge-gt-kutu/.belge-gt-satir
    // yapısıyla (aşağıda).
    var belgeBaslikMetni = (kayit.kod || "") + (kayit.revizeZamani ? " · 🔄 REVİZE" : "");
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
    // "7. BELGE" TASARIMI (14.10.2026, Abdullah onayı — v5 mockup, program
    // genelinde TEK standart): tür/kod artık kendi renkli ".belge-ust-bilgi-
    // kutu"su DEĞİL, Gönder giden görselinde zaten kullanılan GRİ, çerçeveli,
    // bağımsız ".belge-belge-baslik-serit--mavi" şeridi (bkz. belge-style.css).
    // Ürün tablosu kartı artık bu şeride YAPIŞIK değil ("belge-kart--ustduz"
    // kaldırıldı — tablo kartı kendi tam yuvarlak köşesini alıyor). GENEL
    // TOPLAM ve PRİM artık "belge-gt-kutu--altduz" İLE değil, iki AYRI,
    // bağımsız, tam yuvarlak köşeli kutu olarak çiziliyor.
    var html = gecmisCipSatiriHtml(kayit)
      + "<div class='belge-kart tip-" + (kayit.tip||"siparis") + (sorunluMu?" belge-kutu--sorunlu":"") + "'>"
      + durumRozetHtml
      + musteriBlokHtml
      + "</div>"
      + (belgeBaslikMetni ? "<div class='belge-belge-baslik-serit belge-belge-baslik-serit--mavi'><span class='belge-belge-baslik-serit-metin'>" + (TIP_ETIKET_BELGE[kayit.tip]||"SİPARİŞ") + " · " + htmlEsc(belgeBaslikMetni) + "</span></div>" : "")
      + "<div class='belge-kart'>"
      + "<div class='data-table-container'><table class='belge-urun-tablo'>"
      + "<thead><tr><th style='width:3.6%;'>SR</th><th style='width:29.2%;'>ÜRÜN BİLGİSİ</th><th style='width:10%;'>ADET</th><th style='width:10%;'>LİSTE</th><th style='width:10%;'>İSK</th><th style='width:13%;'>NET</th><th style='width:13%;'>TOPLAM</th><th style='width:11.2%;'>PRİM</th></tr></thead>"
      + "<tbody>" + satirlarHtml + "</tbody>"
      + "</table></div>"
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
    var gecmisCipBtn = document.getElementById("btnGecmisCip");
    if(gecmisCipBtn){
      gecmisCipBtn.onclick = function(){
        var oncekiOnek = kodOnekiAyiklaBelge(kayit.oncekiKod) || "?";
        alert("Bu belge önceden " + (oncekiOnek) + " · " + (kayit.oncekiKod) + " kodu ile, " + (kayit.oncekiTarih||"bilinmeyen bir tarihte") + " oluşturulmuştu. İlerletilince aynı iş takip numarası korunarak güncel türe dönüştürüldü.");
      };
    }
  }catch(e){ hataGoster("Belge çizilemedi: " + e.message); }
}

var TIP_ETIKET_UZUN = {numune:"Numune", teklif:"Fiyat Teklifi", proforma:"Proforma Fatura", siparis:"Sipariş"};
var TIP_IKON_BELGE = {numune:"🧪", teklif:"📝", proforma:"🧾", siparis:"📦"};
// RENK GÜNCELLEMESİ (12.10.2026, Abdullah onayı — kurumsal/yumuşatılmış
// "Seçenek B" paleti, swatch fotoğraflarından örneklenip yumuşatıldı).
var TIP_RENK_BELGE = {numune:"#c0453a", teklif:"#249147", proforma:"#dcb13c", siparis:"#38469a"};
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
function bakiyeAlaniHtml(u, i){
  var varMi = u.bakiyeAdet > 0;
  return "<div class='duzenle-bakiye-link' id='duzenleBakiyeLink-" + i + "' data-bakiye-i='" + i + "'" + (varMi ? " hidden" : "") + ">📦 Bakiye Ekle</div>"
    + "<div class='duzenle-bakiye-alan' id='duzenleBakiyeAlan-" + i + "'" + (varMi ? "" : " hidden") + ">"
    + "<div class='duzenle-bakiye-alan-baslik'><span>📦 Bakiyede Kalan Adet</span><button type='button' class='duzenle-bakiye-kapat' data-bakiye-i='" + i + "'>✕</button></div>"
    + "<input type='number' step='1' min='0' class='duzenle-bakiye-adet' id='duzenleBakiyeAdet-" + i + "' placeholder='0' value='" + (varMi ? u.bakiyeAdet : "") + "'>"
    + "<input type='text' class='duzenle-bakiye-not' id='duzenleBakiyeNot-" + i + "' placeholder='Not (opsiyonel) — örn. ne zaman tamamlanacak' value='" + htmlEsc(u.bakiyeNot||"") + "'>"
    + "</div>";
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
      + "<div class='duzenle-alan'><label class='duzenle-etiket'>Adet</label><input type='number' step='1' data-alan='adet' data-i='" + i + "' value='" + (u.adet||1) + "'></div>"
      + "<div class='duzenle-alan'><label class='duzenle-etiket'>Dip Fiyat</label><input type='number' step='0.01' data-alan='dipFiyat' data-i='" + i + "' value='" + (u.dipFiyat||0) + "'></div>"
      + "</div>"
      + bakiyeAlaniHtml(u, i)
      + "</div>";
  }).join("");

  kapsayici.querySelectorAll(".duzenle-bakiye-link").forEach(function(link){
    link.onclick = function(){
      var i = this.getAttribute("data-bakiye-i");
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
      var adet = parseFloat(document.querySelector("[data-alan='adet'][data-i='"+i+"']").value)||1;
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
  document.getElementById("msVazgec").onclick = function(){ document.getElementById("islemlerOverlay").hidden = true; };
  document.getElementById("islemlerOverlay").addEventListener("click", function(ev){
    if(ev.target === this) this.hidden = true;
  });

  // PDF ÜRETİMİ (14.10.2026, Abdullah'ın isteğiyle, mockup üzerinden
  // onaylandı): eski window.print() (ekranı olduğu gibi yazdırma) yerine
  // artık gerçek, biçimlendirilmiş bir "Fiyat Teklif Formu" PDF'i üretiliyor
  // — bkz. teklif-pdf.js. Bu, İÇ/program kopyası olduğu için müşteri kodu
  // ve prim GÖRÜNÜR bırakılıyor (musteriKoduGizli/primGizli verilmedi).
  document.getElementById("msYazdir").onclick = function(){
    document.getElementById("islemlerOverlay").hidden = true;
    if(!sonCizilenKayit){ hataGoster("Önce bir belge açılmalı."); return; }
    var btn = this;
    btn.disabled = true;
    TeklifPdf.indir(sonCizilenKayit, sonCizilenMusteri, {})
      .catch(function(e){ hataGoster("PDF oluşturulamadı: " + e.message); })
      .finally(function(){ btn.disabled = false; });
  };
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
  document.getElementById("msKacti").onclick = function(){
    document.getElementById("islemlerOverlay").hidden = true;
    if(!sonCizilenKayit) return;
    var sebep = prompt("Kaçırma sebebi (örn. Fiyat, Termin, Rakip):", "") || "";
    var rakip = prompt("Rakip firma (opsiyonel):", "") || "";
    ReportsData.kaydiKacanIsaretle(sonCizilenKayit.tip, sonCizilenKayit.ts, sebep, rakip, function(basarili, err){
      if(basarili){ alert("✓ İşaretlendi."); denemeCiz(); }
      else hataGoster("İşaretlenemedi: " + (err && err.message ? err.message : "bilinmeyen hata"));
    });
  };

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
    document.getElementById("msKacti").hidden = !((kayit.tip==="teklif"||kayit.tip==="proforma") && kayit.durum !== "kacan");
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

  // ---- İlerlet — hangi aşamaya dönüştürüleceği artık BURADA sorulur
  // (Gönder aşamasında tekrar sorulmaz). Numune → Proforma/Teklif;
  // Teklif → Proforma/Sipariş; Proforma → sadece Sipariş. "Tekrarla"
  // (aynı türde bağımsız yeni kayıt) da aynı popup'ta bir seçenek olarak
  // sunulur — İlerlet her zaman görünür, tip son aşamada (Sipariş) olsa
  // bile en azından Tekrarla seçeneği için açılabilir (07.09.2026).
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
      }).join("") + "<button type='button' class='duzenle-menu-secenek' data-tip='tekrarla'>🔁 Tekrarla (aynı türde yeni kayıt)</button>";
      liste.querySelectorAll("[data-tip]").forEach(function(btn){
        btn.onclick = function(){
          ilerletSeciliTip = this.getAttribute("data-tip");
          liste.querySelectorAll("[data-tip]").forEach(function(b){ b.classList.remove("duzenle-menu-secenek--secili"); });
          this.classList.add("duzenle-menu-secenek--secili");
          document.getElementById("btnIlerletDevam").textContent = ilerletSeciliTip==="tekrarla" ? "Tekrarla — Sepete Yükle" : ((TIP_ETIKET_ILERLET[ilerletSeciliTip]||ilerletSeciliTip) + " seçeneğine devam et");
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
      if(ilerletSeciliTip === "tekrarla") ReportsData.tekrarBaslat(sonCizilenKayit);
      else ReportsData.revizeBaslat(sonCizilenKayit, ilerletSeciliTip);
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
    if(!confirm("Beklemede durumu kaldırılsın mı? Kayıt tekrar normal şekilde toplamlara dahil olacak.")) return;
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
