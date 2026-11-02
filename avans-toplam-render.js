/*
  avans-toplam-render.js — TKP.02.11.26-19:45.1442
  ========================
  AVANS TOPLAM (02.11.2026, Abdullah onayı — mockup üzerinden). Avans Takibi
  sayfasının üstündeki kutular + satır tablosu buraya taşındı:
   • "Tarih tarih": her avans çekimi bir satır (Tarih · Avans · Faturalandırılan
     · Kalan) — durum çerçeveleri: açık, hesaba eklendi (kalıcı kilitli),
     maaştan düşüldü.
   • "Ay ay": her ay tek satır (aylık toplamlar) + genel TOPLAM satırı.
  Kutular: TOPLAM AVANS, FATURALANAN, KALAN AVANS (= TOPLAM − FATURALANAN);
  kutudaki "Maaş hesabına ekle" henüz eklenmemiş avansları açık maaş dönemine
  ekler (AvansKayitData.maasaEkle) ve satırları KALICI KİLİTLER.
  Sadece açık dönem + avansı henüz kapatılmamış aylar gösterilir —
  AvansKayitData.satirlarAcikDonem; maaşa düşülüp maaş kapanan / avansı
  kapatılan eski aylar sıfırlanır.
  Bir satıra/aya dokununca avans-takibi.html?ay=&yil= o ayı açar.
  Veri tek kaynaktan gelir: avans-kayit-data.js. Ortak yardımcılar:
  avans-ortak.js. Bu sayfa avans verisi YAZMAZ, sadece maasaEkle çağırır.
*/

// Tabloda gösterilecek satırlar: SADECE açık maaş dönemi (ve sonrası). Maaş
// kapanınca eski dönemlerin satırları burada görünmez, hesaba girmez
// (Firebase'de durur) — tablo yeni dönemle sıfırdan başlar.
function atVeriHesapla(){
  var acik = MaasKayitData.acikDonem();
  var acikAnahtar = acik.yil + "-" + ("0"+acik.ay).slice(-2);
  var satirlar = AvansKayitData.satirlarAcikDonem(acik.ay, acik.yil);
  return {ay: acik.ay, yil: acik.yil, acikAnahtar: acikAnahtar, satirlar: satirlar};
}

// "2026-10" -> {kisa:"Eki", uzun:"Ekim 2026", ay:"Ekim"}
function avHedefMetni(hedef){
  var p = String(hedef||"").split("-");
  var a = parseInt(p[1], 10);
  if(!AY_ADLARI_AV[a]) return {kisa:"?", uzun:"?", ay:"?"};
  return {kisa: AY_ADLARI_AV[a].slice(0,3), uzun: AY_ADLARI_AV[a] + " " + p[0], ay: AY_ADLARI_AV[a]};
}

function fmtSayi_AV(n){
  return (n||0).toLocaleString("tr-TR", {minimumFractionDigits:2, maximumFractionDigits:2});
}

function avSatirSinifi(r){
  if(r.durum === "acik") return "av-r--aktif";
  if(r.durum === "eklendi") return "av-r--yesil";
  if(r.durum === "dusuldu") return "av-r--biti";
  return "av-r--notr";
}

function avAltSatirHtml(r){
  if(r.durum === "eklendi"){
    return {cls: "av-alt av-r av-r--yesil",
      html: "<span>✓ Hesaba eklendi · " + avHedefMetni(r.hedef).ay + " maaşı</span>"};
  }
  if(r.durum === "dusuldu"){
    return {cls: "av-alt av-r av-r--biti", html: "<span>✓ Maaştan düşüldü · " + avHedefMetni(r.hedef).ay + " maaşı</span>"};
  }
  return null;
}

// Bir satırın tüm <tr>'leri (ana + durum). ilk/son sınıfları çerçeve içindir.
function avSatirHtml(r){
  var sinif = avSatirSinifi(r);
  var alt = [];
  var durumSatiri = avAltSatirHtml(r);
  if(durumSatiri) alt.push(durumSatiri);
  var veri = " data-ay='" + r.ay + "' data-yil='" + r.yil + "' data-id='" + htmlEsc_AV(r.id) + "'";
  var ana = "<tr class='av-r " + sinif + (alt.length ? " ilk" : " ilk son") + "'" + veri + ">"
    + "<td class='av-td-tarih'>" + fmtTarihKisa_AV(r.tarih) + (r.tip === "ozel" ? "<span class='av-ozel-etiket'>ÖZEL</span>" : "") + "</td>"
    + "<td>" + fmtSayi_AV(r.tutar) + "</td>"
    + "<td>" + (r.tip === "ozel" ? "—" : fmtSayi_AV(r.faturalanan)) + "</td>"
    + "<td><b>" + fmtSayi_AV(r.kalan) + "</b></td>"
    + "</tr>";
  return ana + alt.map(function(a, i){
    return "<tr class='" + a.cls + (i === alt.length - 1 ? " son" : "") + "'" + veri + "><td colspan='4'><div class='av-alt-ic'>" + a.html + "</div></td></tr>";
  }).join("");
}

// Görünüm: "tarih" (satır satır) veya "ay" (ay ay). Son seçim hatırlanır (sadece kolaylık).
var atGorunum = "tarih";
try{ if(localStorage.getItem("atGorunum") === "ay") atGorunum = "ay"; }catch(e){}

function atAyOzetleri(satirlar){
  // anahtar -> {ay, yil, anahtar, avans, fatura, kalan}; en yeni ay üstte.
  var harita = {}, sira = [];
  satirlar.forEach(function(r){
    var o = harita[r.anahtar];
    if(!o){ o = harita[r.anahtar] = {ay:r.ay, yil:r.yil, anahtar:r.anahtar, avans:0, fatura:0, kalan:0}; sira.push(o); }
    o.avans += r.tutar; o.fatura += r.faturalanan; o.kalan += r.kalan;
  });
  sira.sort(function(a, b){ return a.anahtar < b.anahtar ? 1 : (a.anahtar > b.anahtar ? -1 : 0); });
  return sira;
}

function atGit(ay, yil){
  window.location.href = "avans-takibi.html?ay=" + ay + "&yil=" + yil;
}

function atCiz(){
  var veri = atVeriHesapla();
  var tarihKutu = document.getElementById("atTarihTabloKutu");
  var ayKutu = document.getElementById("atAyTabloKutu");
  var bos = document.getElementById("atBos");
  var ipucu = document.getElementById("atIpucu");
  var bosMu = !veri.satirlar.length;

  document.getElementById("btnAtTarih").classList.toggle("on", atGorunum === "tarih");
  document.getElementById("btnAtAy").classList.toggle("on", atGorunum === "ay");
  tarihKutu.hidden = bosMu || atGorunum !== "tarih";
  ayKutu.hidden = bosMu || atGorunum !== "ay";
  bos.hidden = !bosMu;
  ipucu.textContent = atGorunum === "tarih"
    ? "↕ Bir satıra dokununca o ayın avans girişi (Avans Takibi) açılır."
    : "↕ Bir aya dokununca o ayın avans girişi (Avans Takibi) açılır. Sadece avansı kapatılmamış aylar.";

  // KUTULAR: TOPLAM AVANS ve FATURALANAN görünen satırların toplamı;
  // KALAN AVANS = TOPLAM − FATURALANAN.
  var toplam = 0, fatura = 0, acikSayi = 0, eklenmisSayi = 0;
  veri.satirlar.forEach(function(r){
    toplam += r.tutar; fatura += r.faturalanan;
    if(r.durum === "acik") acikSayi++;
    if(r.durum === "eklendi" || r.durum === "dusuldu") eklenmisSayi++;
  });
  document.getElementById("atToplam").textContent = fmtTL_AV(toplam);
  document.getElementById("atFatura").textContent = fmtTL_AV(fatura);
  document.getElementById("atKalan").textContent = fmtTL_AV(Math.max(0, toplam - fatura));
  var btn = document.getElementById("btnAvMaasaEkle");
  btn.disabled = !acikSayi;
  btn.textContent = (!acikSayi && eklenmisSayi) ? "✓ Eklendi" : "Maaş hesabına ekle";

  // TARİH TARİH
  var govde = document.getElementById("atTarihGovde");
  govde.innerHTML = veri.satirlar.map(function(r, i){
    return avSatirHtml(r) + (i < veri.satirlar.length - 1 ? "<tr class='av-bosluk'><td colspan='4'></td></tr>" : "");
  }).join("");
  govde.querySelectorAll("tr[data-id]").forEach(function(tr){
    tr.onclick = function(){ atGit(parseInt(this.getAttribute("data-ay"), 10), parseInt(this.getAttribute("data-yil"), 10)); };
  });

  // AY AY
  var aylar = atAyOzetleri(veri.satirlar);
  var ayGovde = document.getElementById("atAyGovde");
  ayGovde.innerHTML = aylar.map(function(o){
    return "<tr data-ay='" + o.ay + "' data-yil='" + o.yil + "'><td>" + AY_ADLARI_AV[o.ay] + " " + o.yil + "</td><td>" + fmtSayi_AV(o.avans)
      + "</td><td>" + fmtSayi_AV(o.fatura) + "</td><td><b>" + fmtSayi_AV(o.kalan) + "</b></td></tr>";
  }).join("") + "<tr class='at-toplam'><td>TOPLAM</td><td>" + fmtSayi_AV(toplam) + "</td><td>" + fmtSayi_AV(fatura) + "</td><td>" + fmtSayi_AV(Math.max(0, toplam - fatura)) + "</td></tr>";
  ayGovde.querySelectorAll("tr[data-ay]").forEach(function(tr){
    tr.onclick = function(){ atGit(parseInt(this.getAttribute("data-ay"), 10), parseInt(this.getAttribute("data-yil"), 10)); };
  });
}

function atGorunumSec(g){
  atGorunum = g;
  try{ localStorage.setItem("atGorunum", g); }catch(e){}
  atCiz();
}

function avToastGoster(metin){
  var el = document.getElementById("avToast");
  if(!el) return;
  el.textContent = metin; el.hidden = false;
  setTimeout(function(){ el.hidden = true; }, 2200);
}

// "MAAŞ HESABINA EKLE": tüm AÇIK avanslar için önce onay penceresi (satır listesi +
// toplam) açılır; onaylanınca hepsi açık maaş dönemine eklenir ve kilitlenir.
function avOnayPenceresiAc(){
  var veri = atVeriHesapla();
  var acik = MaasKayitData.acikDonem();
  var secilenler = veri.satirlar.filter(function(r){ return r.durum === "acik"; });
  if(!secilenler.length) return;
  var toplam = 0;
  var html = secilenler.map(function(r){
    toplam += r.kalan;
    return "<div><span>" + htmlEsc_AV(fmtTarihKisa_AV(r.tarih) + (r.tip === "ozel" ? " · Özel" : "")) + "</span><span>" + fmtTL_AV(r.kalan) + "</span></div>";
  }).join("") + "<div><span>Maaştan düşülecek</span><span>" + fmtTL_AV(Math.max(0, toplam)) + "</span></div>";
  document.getElementById("avOnayAlt").textContent = AY_ADLARI_AV[acik.ay] + " " + acik.yil + " maaş hesabına eklenecek";
  document.getElementById("avOnayListe").innerHTML = html;
  document.getElementById("avOnayOverlay").hidden = false;
}
function avOnayPenceresiKapat(){
  document.getElementById("avOnayOverlay").hidden = true;
}
function avOnayla(){
  var veri = atVeriHesapla();
  var btn = document.getElementById("btnAvOnayla");
  btn.disabled = true;
  AvansKayitData.maasaEkle(null, veri.acikAnahtar, function(ok, err, sayi){
    btn.disabled = false;
    if(!ok){ alert("Eklenemedi: " + (err && err.message)); return; }
    avOnayPenceresiKapat();
    atCiz();
    avToastGoster("✓ " + (sayi || 0) + " avans maaş hesabına eklendi");
  });
}

// EXCEL'E AKTAR — yillik-km-odeme-render.js'teki excelAktar() ile AYNI
// biçimlendirme kuralları (başlık FAEEDA/003A70, kenarlıklar, TOPLAM satırı
// kırmızı/kalın). Ekrandaki görünümü (tarih tarih / ay ay) aktarır.
function atExcelAktar(){
  try{
    if(typeof XLSX === "undefined"){
      alert("Excel kütüphanesi yüklenemedi, internet bağlantınızı kontrol edin.");
      return;
    }
    var veri = atVeriHesapla();
    if(!veri.satirlar.length){ alert("Aktarılacak avans kaydı yok."); return; }
    var basliklar, veriSatirlari, toplamCekilen = 0, toplamFatura = 0, toplamKalan = 0, sutunlar, sayfaAdi;
    function durumMetni(r){
      if(r.durum === "acik") return "Açık";
      if(r.durum === "eklendi") return "Hesaba eklendi — " + avHedefMetni(r.hedef).ay + " maaşı";
      if(r.durum === "dusuldu") return "Maaştan düşüldü — " + avHedefMetni(r.hedef).ay + " maaşı";
      return "Faturası tam";
    }
    veri.satirlar.forEach(function(r){ toplamCekilen += r.tutar; toplamFatura += r.faturalanan; toplamKalan += r.kalan; });
    if(atGorunum === "ay"){
      basliklar = ["Ay","Avans","Faturalandırılan","Kalan"];
      veriSatirlari = atAyOzetleri(veri.satirlar).reverse().map(function(o){
        return [AY_ADLARI_AV[o.ay] + " " + o.yil, o.avans, o.fatura, o.kalan];
      });
      sutunlar = [{wch:16},{wch:14},{wch:16},{wch:12}];
      sayfaAdi = "Avans Ay Ay";
    } else {
      basliklar = ["Tarih","Açıklama","Avans","Faturalandırılan","Kalan","Durum"];
      veriSatirlari = veri.satirlar.slice().reverse().map(function(r){
        return [fmtTarihKisa_AV(r.tarih), r.aciklama + (r.tip === "ozel" ? " (özel)" : ""), r.tutar, r.faturalanan, r.kalan, durumMetni(r)];
      });
      sutunlar = [{wch:10},{wch:26},{wch:14},{wch:16},{wch:12},{wch:36}];
      sayfaAdi = "Avans Tarih Tarih";
    }
    var aoa = [basliklar].concat(veriSatirlari);
    aoa.push(atGorunum === "ay" ? ["TOPLAM", toplamCekilen, toplamFatura, toplamKalan] : ["TOPLAM", "", toplamCekilen, toplamFatura, toplamKalan, ""]);

    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = sutunlar;
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
    XLSX.utils.book_append_sheet(wb, ws, sayfaAdi);
    XLSX.writeFile(wb, "Avans_Toplam_" + (atGorunum === "ay" ? "AyAy" : "TarihTarih") + ".xlsx");
  }catch(e){ alert("Excel oluşturulamadı: " + e.message); }
}

document.addEventListener("DOMContentLoaded", function(){
  document.getElementById("btnAtTarih").onclick = function(){ atGorunumSec("tarih"); };
  document.getElementById("btnAtAy").onclick = function(){ atGorunumSec("ay"); };
  document.getElementById("btnAtExcel").onclick = atExcelAktar;
  document.getElementById("btnAvMaasaEkle").onclick = avOnayPenceresiAc;
  document.getElementById("btnAvOnayla").onclick = avOnayla;
  document.getElementById("btnAvOnayVazgec").onclick = avOnayPenceresiKapat;
  document.getElementById("avOnayDim").onclick = avOnayPenceresiKapat;

  // Veri (maaş dönemleri + avans kayıtları + taslak) gelene kadar boş çizmeyiz:
  // yanlış "kayıt yok" göstermesin, düğme erken basılmasın.
  var hazir = false;
  function dene(){
    if(!MaasKayitData.kayitlarYuklendiMi() || !AvansKayitData.taslakYuklendiMi() || !AvansKayitData.kayitlarYuklendiMi()) return;
    hazir = true;
    atCiz();
  }
  document.getElementById("btnAvMaasaEkle").disabled = true;
  AvansKayitData.degistiginde(function(){ if(hazir) atCiz(); else dene(); });
  try{ MaasKayitData.degistiginde(function(){ if(hazir) atCiz(); else dene(); }); }catch(e){}
  dene();
});
