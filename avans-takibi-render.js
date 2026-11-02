/*
  avans-takibi-render.js — TKP.02.11.26-19:04.1430
  ========================
  26.10.2026 (Abdullah onayı, mockup üzerinden: "Okey kesinlikle bu
  tasarımı istiyorum kodlayalım") — sayfaya girince ÖNCE "{yıl} — Avans
  Tablosu" iniş ekranı görünür (bkz. avYilVerisiHesapla/avYilTabloCiz/
  avYilExcelAktar, altta): (02.11.2026'dan itibaren SATIR BAZLI: her satır
  bir avans çekimi — Tarih/Avans/Faturalandırılan/Kalan, bkz. avYilTabloCiz),
  üstte 3 özet kutusu (tüm yılın toplamı) gösterir. KAPALI aylar için de
  Çekilen/Faturalandırılan avToplamlariHesapla() ile HESAPLANABİLİYOR —
  kapalı kayıtta ozelAvansGirisleri/isAvansiGirisleri/isAvansiHarcamalar
  ham dizileri zaten saklı duruyor (maas-hesaplama-render.js "Kapat ve
  Kayıt Et" adımında bunları SİLMİYOR, sadece ayrıca toplamKesinti vb.
  de ekliyor) — yeni bir veri alanı eklemeye gerek kalmadı. Bir aya
  dokununca ESKİ/mevcut ayrıntı ekranı (AVANS EKLE/HARCAMALAR formları
  ya da kapalı dönem özeti — hiçbiri değişmedi) açılır (bkz.
  avDonemeGec). Eski "GEÇMİŞ AVANSLAR" tablosu
  (avGecmisAvanlarCiz) kaldırıldı — yeni yıllık tablo onun yerini daha
  zengin bilgiyle aldı.
  ========================
  02.11.2026 (Abdullah onayı: "Tmm kodlayalım onaylıyorum") — TEK SAYFA:
  üstte kutular + satır tablosu, ALTINDA (ince çizgiyle ayrılmış) ayın giriş
  bölümü (ay çubuğu, özet, AVANS EKLE, HARCAMALAR) — ayrı görünüm ve
  "‹ Aylara Dön" yok. Tabloda bir satıra dokununca alt bölüm o satırın ayına
  geçer ve oraya kaydırılır. 3. kutu "KALAN AVANS" = TOPLAM − FATURALANAN.
  "Maaş hesabına ekle" ile eklenen satırlar KALICI KİLİTLİ ("↩ Geri al" yok).
  Maaş "GEÇERLİ AYIN HESABI KAPANDI" ile kapanınca tablo SIFIRDAN başlar:
  sadece yeni açık dönemin satırları görünür (AvansKayitData.satirlarAcikDonem),
  eski veriler Firebase'de durur. DEVİR (fazla faturalandırmanın sonraki aya
  taşınması) tamamen kaldırıldı.
  ========================
  Özel Avans / İş Avansı / İş Avansı Harcamaları listelerini yönetir.
  Dönem artık ‹ › okları (veya kaydırarak) tek tek ay adımıyla değişir
  (27.09.2026) — kapatılmamış herhangi bir aya (geçmiş dahil) gidip orada
  da giriş yapılabilir. Her ekleme/silme ANINDA AvansKayitData.taslakGuncelle()
  ile seçili dönemin taslağına yazılır.

  02.10.2026 (Abdullah'ın isteğiyle) — bu sayfa artık kendi başına yeni
  bir dönem AÇAMAZ. "+ Yeni Ay" düğmesi kaldırıldı; "›" oku, Maaş
  Hesaplama'nın resmi açık dönemine (MaasKayitData.acikDonem()) gelince
  otomatik gizlenir — daha ileri gidilemez. Tek kontrol noktası Maaş
  Hesaplama'daki "GEÇERLİ AYIN HESABI KAPANDI" düğmesidir: o basılınca
  MaasKayitData'nın açık dönemi ilerler ve bu sayfa, EĞER o an canlı/açık
  dönemi izliyorsa (avCanliMi), otomatik olarak yeni açık döneme geçer
  (bkz. avCanliMi, avDonemBariCiz, MaasKayitData.degistiginde altındaki
  dinleyici). Geçmiş bir ayı inceliyorsan (avCanliMi=false), bir dönem
  kapanması seni oradan koparmaz.

  02.10.2026 (Abdullah'ın isteğiyle, ikinci ek — 26.10.2026'da yıllık
  tabloyla DEĞİŞTİRİLDİ, bkz. dosya başı) — kapanmış TÜM avans
  dönemlerini tutar ve "bekliyor / hangi aya dahil edildi" durumuyla
  tek tabloda gösteren eski "GEÇMİŞ AVANSLAR" bölümü artık yok.
*/

var AY_ADLARI_AV = ["","Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

var avOzelListe = [];
var avIsListe = [];
var avHarcamaListe = [];
var avSeciliAy = null;
var avSeciliYil = null;
// CANLI TAKİP (02.10.2026) — true: şu an görüntülenen ay, Maaş
// Hesaplama'nın resmi açık/canlı dönemiyle aynı (yani bu sayfa, bir ay
// kapandığında otomatik olarak yeni açık döneme geçmeli). false: geçmiş,
// kapanmış bir ay geriye gidilerek inceleniyor — bu durumda bir dönem
// kapanması bu sayfadaki görünümü DEĞİŞTİRMEMELİ.
var avCanliMi = true;

function fmtTL_AV(n){
  return (n||0).toLocaleString("tr-TR", {minimumFractionDigits:2, maximumFractionDigits:2}) + " TL";
}
function htmlEsc_AV(s){
  return (s==null?"":String(s)).replace(/[&<>"']/g, function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
  });
}
function fmtTarihKisa_AV(iso){
  if(!iso) return "-";
  var p = iso.split("-");
  if(p.length!==3) return iso;
  return p[2] + "." + p[1] + "." + p[0].slice(2);
}
// Türkçe tutar biçimi: binlik ayraç "." , ondalık ayraç ",". "20.000" -> 20000.
function tutarParse_AV(s){
  s = (s||"").toString().trim();
  if(!s) return 0;
  s = s.replace(/\./g, "").replace(",", ".");
  var v = parseFloat(s);
  return isNaN(v) ? 0 : v;
}

function tarihiGuncelle_AV(){
  try{
    var el = document.getElementById("gunTarihi");
    if(!el) return;
    var gunler = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
    var d = new Date();
    el.textContent = gunler[d.getDay()] + ", " + d.getDate() + " " + AY_ADLARI_AV[d.getMonth()+1] + " " + d.getFullYear();
  }catch(e){}
}

function avToplamHesapla(liste){
  return liste.reduce(function(s,x){ return s + (x.tutar||0); }, 0);
}

function avToplamlariHesapla(veri){
  var ozelToplam = avToplamHesapla(veri.ozelAvansGirisleri||[]);
  var isToplam = avToplamHesapla(veri.isAvansiGirisleri||[]);
  var belgelenenToplam = avToplamHesapla(veri.isAvansiHarcamalar||[]);
  var isKesilecek = Math.max(0, isToplam - belgelenenToplam);
  var toplamKesinti = ozelToplam + isKesilecek;
  return {ozelToplam:ozelToplam, isToplam:isToplam, belgelenenToplam:belgelenenToplam, isKesilecek:isKesilecek, toplamKesinti:toplamKesinti};
}

function avTabloCiz(govdeId, bosId, liste, kolonEtiket){
  var govde = document.getElementById(govdeId);
  govde.innerHTML = liste.map(function(h, idx){
    return "<tr><td>" + fmtTarihKisa_AV(h.tarih) + "</td>"
      + "<td>" + (kolonEtiket==="etiket" ? "<span class='mh-harcama-etiket-rozet'>"+htmlEsc_AV(h.cesit||h.aciklama)+"</span>" : htmlEsc_AV(h.aciklama||h.cesit)) + "</td>"
      + "<td>" + fmtTL_AV(h.tutar) + "</td>"
      + "<td><button type='button' class='mh-harcama-sil-btn' data-idx='" + idx + "'>🗑</button></td></tr>";
  }).join("");
  document.getElementById(bosId).hidden = liste.length > 0;
  return govde;
}

// BİRLEŞİK AVANS LİSTESİ (24.09.2026) — İş ve Özel avans artık TEK
// listede, tarihe göre sıralı, her satırın başında İŞ/ÖZEL etiketiyle
// gösteriliyor. Veri modeli değişmedi (avIsListe/avOzelListe hâlâ AYRI
// diziler — Maaş Hesaplama'nın toplam hesapları buna göre kurulu),
// sadece EKRANDA birleştirilip çiziliyor. Silme, satırın hangi tip/
// index'ten geldiğini data-tip/data-idx ile takip eder.
function avListeCiz(){
  var birlesik = avIsListe.map(function(x, i){ return Object.assign({tip:"is", idx:i}, x); })
    .concat(avOzelListe.map(function(x, i){ return Object.assign({tip:"ozel", idx:i}, x); }));
  birlesik.sort(function(a, b){ return (b.tarih||"").localeCompare(a.tarih||""); });
  var govde = document.getElementById("avListeGovde");
  govde.innerHTML = birlesik.map(function(h){
    var etiket = h.tip==="is"
      ? "<span class='av-satir-etiket av-satir-etiket--is'>İŞ</span>"
      : "<span class='av-satir-etiket av-satir-etiket--ozel'>ÖZEL</span>";
    return "<tr><td>" + etiket + "</td><td>" + fmtTarihKisa_AV(h.tarih) + "</td>"
      + "<td>" + htmlEsc_AV(h.aciklama) + "</td><td>" + fmtTL_AV(h.tutar) + "</td>"
      + "<td>" + (h.maasa
        ? "<span title='Maaş hesabına eklendi — kalıcı kilitli, silinemez'>🔒</span>"
        : "<button type='button' class='mh-harcama-sil-btn' data-tip='" + h.tip + "' data-idx='" + h.idx + "'>🗑</button>") + "</td></tr>";
  }).join("");
  document.getElementById("avListeBos").hidden = birlesik.length > 0;
  govde.querySelectorAll(".mh-harcama-sil-btn").forEach(function(btn){
    btn.onclick = function(){
      var tip = this.getAttribute("data-tip");
      var idx = parseInt(this.getAttribute("data-idx"), 10);
      if(tip === "is") avIsListe.splice(idx, 1); else avOzelListe.splice(idx, 1);
      avTaslagiKaydet(); avCiz(); avKaydedildiGoster();
    };
  });
}

// KAYDEDİLDİ ROZETİ (24.09.2026) — her ekleme/silmeden sonra 2 saniye
// görünüp kendiliğinden kaybolur; Abdullah'ın "kaydettiğimi bilmiyorum,
// geri çıkmaya korkuyorum" geri bildirimine karşılık.
var avKaydedildiZamanlayici = null;
function avKaydedildiGoster(){
  var el = document.getElementById("avKaydedildiRozeti");
  if(!el) return;
  el.hidden = false;
  if(avKaydedildiZamanlayici) clearTimeout(avKaydedildiZamanlayici);
  avKaydedildiZamanlayici = setTimeout(function(){ el.hidden = true; }, 2000);
}

function avTaslagiKaydet(){
  AvansKayitData.taslakGuncelle(avSeciliAy, avSeciliYil, {
    ozelAvansGirisleri: avOzelListe,
    isAvansiGirisleri: avIsListe,
    isAvansiHarcamalar: avHarcamaListe
  }, function(basarili, err){
    if(!basarili) console.error("Taslak kaydedilemedi:", err);
  });
}

// AY ADIMLAMA (27.09.2026, Abdullah'ın isteğiyle yeniden tasarım) — dönem
// artık uzun bir listeden değil, ‹ › okları (veya kaydırarak) tek tek ay
// adımıyla değişiyor. KAPATILMIŞ aylar artık ATLANMAZ — salt okunur olarak
// gösterilir (bkz. avDonemeGec/avKapaliGoster); ayrı bir "Kayıt Geçmişi"
// listesine bu yüzden gerek kalmadı, aynı ‹ › ile geriye gidilerek görülür.
function avSonrakiAy(ay, yil){ ay++; if(ay>12){ ay=1; yil++; } return {ay:ay, yil:yil}; }
function avOncekiAy(ay, yil){ ay--; if(ay<1){ ay=12; yil--; } return {ay:ay, yil:yil}; }

// Dönem barını çizer: ay/yıl etiketi + "›" oku görünürlüğü. 02.10.2026
// (Abdullah'ın isteğiyle) — "+ Yeni Ay" düğmesi kaldırıldı; bu sayfa artık
// kendi başına yeni bir dönem AÇAMAZ. "›" oku, Maaş Hesaplama'nın resmi
// açık dönemine (MaasKayitData.acikDonem()) ULAŞILINCA gizlenir — daha
// ileri gidip henüz resmi olarak açılmamış bir ayın taslağını doldurmak
// artık mümkün değil. Yeni dönem sadece Maaş Hesaplama'dan kapatılarak
// açılır (bkz. dosya başı not + MaasKayitData.degistiginde dinleyicisi).
function avDonemBariCiz(){
  var etiket = document.getElementById("avDonemBtnMetin");
  if(etiket && avSeciliAy && avSeciliYil) etiket.textContent = AY_ADLARI_AV[avSeciliAy] + " " + avSeciliYil;
  var acik = MaasKayitData.acikDonem();
  var acikDonemdeMiyiz = (avSeciliAy === acik.ay && avSeciliYil === acik.yil);
  var btnSonraki = document.getElementById("avDonemSonrakiBtn");
  if(btnSonraki) btnSonraki.hidden = acikDonemdeMiyiz;
}

// DÜZENLEME/SALT-OKUNUR GÖRÜNÜRLÜK (27.09.2026) — kapalı bir döneme
// gelindiğinde giriş bölümleri (AVANS EKLE / HARCAMALAR) ve alt not
// gizlenir, yerine kapalı-dönem şeridi (silme düğmesiyle) gösterilir.
function avDuzenlemeGorunurlugunuAyarla(gorunurMu){
  document.getElementById("avEkleSection").hidden = !gorunurMu;
  document.getElementById("avHarcamaSection").hidden = !gorunurMu;
  document.getElementById("avKapaliSerit").hidden = gorunurMu;
  document.getElementById("btnAvKapaliKaydiSil").hidden = gorunurMu;
}

function avKapaliGoster(k){
  avDuzenlemeGorunurlugunuAyarla(false);
  // Maaş hesabına eklenmiş avansı olan (ya da eski sistemde maaşa dahil edilmiş)
  // kapalı kaydın silinmesi (ay yeniden açılması) o avansları maaştan düşürürdü: silme düğmesi gizlenir.
  var kilitli = !!k.maasaDahilEdildigiDonem || (k.isAvansiGirisleri||[]).concat(k.ozelAvansGirisleri||[]).some(function(e){ return e && e.maasa; });
  document.getElementById("btnAvKapaliKaydiSil").hidden = kilitli;
  document.getElementById("avKapaliSeritBaslik").textContent = "🔒 Bu dönem kapatılmış (salt okunur) —";
  document.getElementById("avKapaliSeritAlt").textContent = kilitli ? "maaşa eklenmiş avans var, silinemez" : "silmek için dokun";
  document.getElementById("avToplamOzel").textContent = fmtTL_AV(k.ozelAvansToplam||0);
  var dvK = AvansKayitData.donemOzeti(k.anahtar);
  var kalanK = dvK ? dvK.kalan : (k.toplamKesinti||0);
  var isHam = (k.isAvansiGirisleri || k.isAvansiHarcamalar) ? avToplamlariHesapla(k).isKesilecek : (k.isAvansiBelgesizKalan||0);
  document.getElementById("avToplamIs").textContent = fmtTL_AV(isHam);
  document.getElementById("avToplamGenel").textContent = fmtTL_AV(Math.max(0, kalanK));
  document.getElementById("btnAvKapaliKaydiSil").setAttribute("data-anahtar", k.anahtar);
}

function avDonemeGec(ay, yil){
  avSeciliAy = ay; avSeciliYil = yil;
  var acik = MaasKayitData.acikDonem();
  avCanliMi = (ay === acik.ay && yil === acik.yil);
  avDonemBariCiz();
  var kapali = AvansKayitData.kapaliKaydiBul(ay, yil);
  var taslakKapali = AvansKayitData.taslakOku(ay, yil);
  if(kapali){
    avKapaliGoster(kapali);
  } else {
    avDuzenlemeGorunurlugunuAyarla(true);
    var taslak = taslakKapali;
    avOzelListe = taslak.ozelAvansGirisleri || [];
    avIsListe = taslak.isAvansiGirisleri || [];
    avHarcamaListe = taslak.isAvansiHarcamalar || [];
    avCiz();
  }
  avBaskaDonemdeTaslakGoster();
}

// GÜVENLİK BANDI (27.09.2026) — dönem senkron düzeltmesinden sonra
// eklendi: hangi ay "resmi açık dönem" sayılırsa sayılsın, kullanıcının
// daha önce (eski/şaşan mantıkla) başka bir ay'a girdiği ve HÂLÂ Firebase'de
// duran ama şu an ekranda görünmeyen bir taslak varsa, bunu asla sessizce
// kaybettirmeyip açıkça bildiriyoruz.
function avTaslakDoluMu(t){
  if(!t) return false;
  return (t.ozelAvansGirisleri||[]).length>0 || (t.isAvansiGirisleri||[]).length>0 || (t.isAvansiHarcamalar||[]).length>0;
}
function avBaskaDonemdeTaslakGoster(){
  var banner = document.getElementById("avBaskaTaslakBanner");
  var alt = document.getElementById("avBaskaTaslakBannerAlt");
  if(!banner || !alt) return;
  if(!AvansKayitData.taslakYuklendiMi() || !avSeciliAy || !avSeciliYil){ banner.hidden = true; return; }
  var buraya = avSeciliYil + "-" + ("0"+avSeciliAy).slice(-2);
  var bulunanlar = AvansKayitData.tumTaslaklar().filter(function(t){
    return t.anahtar !== buraya && avTaslakDoluMu(t);
  });
  if(!bulunanlar.length){ banner.hidden = true; return; }
  banner.hidden = false;
  alt.textContent = bulunanlar.map(function(t){ return AY_ADLARI_AV[t.ay] + " " + t.yil; }).join(", ") + " — dokun ve gör";
  banner.onclick = function(){ avDonemeGec(bulunanlar[0].ay, bulunanlar[0].yil); };
}

function avCiz(){
  avListeCiz();
  var govdeHarcama = avTabloCiz("avHarcamaTabloGovde", "avHarcamaBos", avHarcamaListe, "etiket");
  govdeHarcama.querySelectorAll(".mh-harcama-sil-btn").forEach(function(btn){
    btn.onclick = function(){ avHarcamaListe.splice(parseInt(this.getAttribute("data-idx"),10),1); avTaslagiKaydet(); avCiz(); avKaydedildiGoster(); };
  });

  var t = avToplamlariHesapla({ozelAvansGirisleri:avOzelListe, isAvansiGirisleri:avIsListe, isAvansiHarcamalar:avHarcamaListe});
  document.getElementById("avBelgelenenToplam").textContent = fmtTL_AV(t.belgelenenToplam);
  document.getElementById("avIsKesilecek2").textContent = fmtTL_AV(t.isKesilecek);
  document.getElementById("avIsToplam2").textContent = fmtTL_AV(t.isToplam);
  document.getElementById("avOzelToplam2").textContent = fmtTL_AV(t.ozelToplam);
  document.getElementById("avToplamOzel").textContent = fmtTL_AV(t.ozelToplam);
  document.getElementById("avToplamIs").textContent = fmtTL_AV(t.isKesilecek);
  document.getElementById("avToplamGenel").textContent = fmtTL_AV(t.toplamKesinti);
}

// ============================================================
// SATIR BAZLI AVANS TABLOSU (02.11.2026, Abdullah onayı — mockup üzerinden;
// sistem baştan kuruldu). Sayfaya girince ÖNCE bu görünür. Her satır bir
// AVANS ÇEKİMİdir (Tarih · Avans · Faturalandırılan · Kalan); veri ayrıntı
// ekranındaki AVANS EKLE / HARCAMALAR girişlerinden okunur (tek kaynak:
// AvansKayitData.satirlar). Satır durumları için bkz. avans-kayit-data.js.
// ============================================================

// Tabloda gösterilecek satırlar: SADECE açık maaş dönemi (ve sonrası). Maaş
// kapanınca eski dönemlerin satırları burada görünmez, hesaba girmez
// (Firebase'de durur) — tablo yeni dönemle sıfırdan başlar.
function avYilVerisiHesapla(){
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

function avYilTabloCiz(){
  var govde = document.getElementById("avYilTabloGovde");
  if(!govde) return;
  var kutu = document.getElementById("avYilTabloKutu");
  var bos = document.getElementById("avYilBos");

  var veri = avYilVerisiHesapla();
  document.getElementById("avYilBaslik").textContent = AY_ADLARI_AV[veri.ay] + " " + veri.yil + " — Avans Tablosu";

  var bosMu = !veri.satirlar.length;
  kutu.hidden = bosMu;
  bos.hidden = !bosMu;

  govde.innerHTML = veri.satirlar.map(function(r, i){
    return avSatirHtml(r) + (i < veri.satirlar.length - 1 ? "<tr class='av-bosluk'><td colspan='4'></td></tr>" : "");
  }).join("");

  // KUTULAR: TOPLAM AVANS ve FATURALANAN görünen satırların toplamı;
  // KALAN AVANS = TOPLAM − FATURALANAN. Kutudaki düğme henüz eklenmemiş
  // (açık) satırları maaş hesabına ekler.
  var toplam = 0, fatura = 0, acikSayi = 0, eklenmisSayi = 0;
  veri.satirlar.forEach(function(r){
    toplam += r.tutar; fatura += r.faturalanan;
    if(r.durum === "acik") acikSayi++;
    if(r.durum === "eklendi" || r.durum === "dusuldu") eklenmisSayi++;
  });
  document.getElementById("avYilCekilen").textContent = fmtTL_AV(toplam);
  document.getElementById("avYilFatura").textContent = fmtTL_AV(fatura);
  document.getElementById("avYilKalan").textContent = fmtTL_AV(Math.max(0, toplam - fatura));

  var btn = document.getElementById("btnAvMaasaEkle");
  if(btn){
    btn.disabled = !acikSayi;
    btn.textContent = (!acikSayi && eklenmisSayi) ? "✓ Eklendi" : "Maaş hesabına ekle";
  }

  // Satıra dokununca alt bölüm o satırın ayına geçer ve oraya kaydırılır.
  govde.querySelectorAll("tr[data-id]").forEach(function(tr){
    tr.onclick = function(){
      avDonemeGec(parseInt(this.getAttribute("data-ay"), 10), parseInt(this.getAttribute("data-yil"), 10));
      var hedef = document.getElementById("avAyrintiGorunumu");
      if(hedef && hedef.scrollIntoView) hedef.scrollIntoView({behavior: "smooth", block: "start"});
    };
  });
}

function avToastGoster(metin){
  var el = document.getElementById("avToast");
  if(!el) return;
  el.textContent = metin; el.hidden = false;
  setTimeout(function(){ el.hidden = true; }, 2200);
}

// "MAAŞ HESABINA EKLE": tüm AÇIK avanslar için önce onay penceresi (satır listesi +
// toplam) açılır; onaylanınca hepsi açık maaş dönemine eklenir.
function avOnayPenceresiAc(){
  var veri = avYilVerisiHesapla();
  var acik = MaasKayitData.acikDonem();
  var secilenler = veri.satirlar.filter(function(r){ return r.durum === "acik"; });
  if(!secilenler.length) return;
  var toplam = 0;
  var html = secilenler.map(function(r){
    toplam += r.kalan;
    return "<div><span>" + htmlEsc_AV(fmtTarihKisa_AV(r.tarih) + (r.tip === "ozel" ? " · Özel" : "")) + "</span><span>" + fmtTL_AV(r.kalan) + "</span></div>";
  }).join("") + "<div><span>Maaştan düşülecek</span><span>" + fmtTL_AV(toplam) + "</span></div>";
  document.getElementById("avOnayAlt").textContent = AY_ADLARI_AV[acik.ay] + " " + acik.yil + " maaş hesabına eklenecek";
  document.getElementById("avOnayListe").innerHTML = html;
  document.getElementById("avOnayOverlay").hidden = false;
}
function avOnayPenceresiKapat(){
  document.getElementById("avOnayOverlay").hidden = true;
}
function avOnayla(){
  var veri = avYilVerisiHesapla();
  var btn = document.getElementById("btnAvOnayla");
  btn.disabled = true;
  AvansKayitData.maasaEkle(null, veri.acikAnahtar, function(ok, err, sayi){
    btn.disabled = false;
    if(!ok){ alert("Eklenemedi: " + (err && err.message)); return; }
    avOnayPenceresiKapat();
    avYilTabloCiz();
    avToastGoster("✓ " + (sayi || 0) + " avans maaş hesabına eklendi");
  });
}
// EXCEL'E AKTAR (26.10.2026) — yillik-km-odeme-render.js'teki
// excelAktar() ile AYNI biçimlendirme kuralları (başlık FAEEDA/003A70,
// kenarlıklar, TOPLAM satırı kırmızı/kalın).
function avYilExcelAktar(){
  try{
    if(typeof XLSX === "undefined"){
      hataGoster("Excel kütüphanesi yüklenemedi, internet bağlantınızı kontrol edin.");
      return;
    }
    var veri = avYilVerisiHesapla();
    if(!veri.satirlar.length){ hataGoster("Aktarılacak avans kaydı yok."); return; }

    var basliklar = ["Tarih","Açıklama","Avans","Faturalandırılan","Kalan","Durum"];
    // Tabloda görünen satırlar (açık dönem); eskiden yeniye.
    var siraliSatirlar = veri.satirlar.slice().reverse();
    function durumMetni(r){
      if(r.durum === "acik") return "Açık";
      if(r.durum === "eklendi") return "Hesaba eklendi — " + avHedefMetni(r.hedef).ay + " maaşı";
      if(r.durum === "dusuldu") return "Maaştan düşüldü — " + avHedefMetni(r.hedef).ay + " maaşı";
      return "Faturası tam";
    }
    var veriSatirlari = siraliSatirlar.map(function(r){
      return [fmtTarihKisa_AV(r.tarih), r.aciklama + (r.tip === "ozel" ? " (özel)" : ""), r.tutar, r.faturalanan, r.kalan, durumMetni(r)];
    });
    var toplamCekilen = 0, toplamFatura = 0, toplamKalan = 0;
    siraliSatirlar.forEach(function(r){
      toplamCekilen += r.tutar; toplamFatura += r.faturalanan; toplamKalan += r.kalan;
    });

    var aoa = [basliklar].concat(veriSatirlari);
    aoa.push(["TOPLAM", "", toplamCekilen, toplamFatura, toplamKalan, ""]);

    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{wch:10},{wch:26},{wch:14},{wch:16},{wch:12},{wch:36}];

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
    XLSX.utils.book_append_sheet(wb, ws, "Avans " + AY_ADLARI_AV[veri.ay] + " " + veri.yil);
    XLSX.writeFile(wb, "Avans_Tablosu_" + veri.yil + "_" + ("0"+veri.ay).slice(-2) + ".xlsx");
  }catch(e){ hataGoster("Excel oluşturulamadı: " + e.message); }
}

document.addEventListener("DOMContentLoaded", function(){
  tarihiGuncelle_AV();
  var btnMenuEl = document.getElementById("btnMenu");
  if(btnMenuEl) btnMenuEl.onclick = function(){ window.location.href = "menu.html"; };
  // KRİTİK HATA DÜZELTMESİ (24.09.2026): Firebase'den ilk veri paketi
  // gelene kadar ekleme/silme butonlarını KİLİTLE — aksi halde kullanıcı
  // veri daha gelmeden bir şey eklerse, boş listeyi Firebase'e YAZIP
  // gerçek (henüz görünmeyen) kayıtları SİLEBİLİRDİ. Veri gelince
  // avYuklemeKilidiniAc() kilidi kaldırır.
  var avButonlar = ["btnAvEkle","btnHarcamaEkle"];
  function avYuklemeKilidiniKapat(){
    avButonlar.forEach(function(id){ document.getElementById(id).disabled = true; });
  }
  function avYuklemeKilidiniAc(){
    avButonlar.forEach(function(id){ document.getElementById(id).disabled = false; });
  }
  avYuklemeKilidiniKapat();

  // İKİNCİ KRİTİK HATA DÜZELTMESİ (24.09.2026): İLK dönem geçişini artık
  // burada SENKRON yapmıyoruz — kayitlar (kapalı aylar) gelmeden acikDonem()
  // yanlış ay hesaplayabiliyordu (bkz. avans-kayit-data.js). Hem kayıtlar
  // hem taslak gelene kadar bekleriz; gelince aşağıdaki degistiginde
  // dinleyicisi ilk (ve sadece ilk) geçişi yapar.
  // DEĞİŞTİ (02.11.2026, tek sayfa): veri gelince tablo çizilir ve alt bölüm
  // açık döneme geçer; bir satıra dokununca alt bölüm o satırın ayına geçer.
  var avIlkGecisYapildiMi = false;
  function avIlkGecisiDeneVeYap(){
    if(avIlkGecisYapildiMi) return;
    // TEK KAYNAK (27.09.2026): açık dönem artık MaasKayitData'dan okunur —
    // Maaş Hesaplama hangi ayı açık görüyorsa Avans Takibi de aynısını görür.
    if(!MaasKayitData.kayitlarYuklendiMi() || !AvansKayitData.taslakYuklendiMi()) return;
    avIlkGecisYapildiMi = true;
    avYuklemeKilidiniAc();
    avYilTabloCiz();
    // TEK SAYFA: alt bölüm açılışta açık dönemi gösterir.
    var acikD = MaasKayitData.acikDonem();
    avDonemeGec(acikD.ay, acikD.yil);
  }
  avIlkGecisiDeneVeYap();

  document.getElementById("btnAvExcel").onclick = avYilExcelAktar;
  document.getElementById("btnAvMaasaEkle").onclick = avOnayPenceresiAc;
  document.getElementById("btnAvOnayla").onclick = avOnayla;
  document.getElementById("btnAvOnayVazgec").onclick = avOnayPenceresiKapat;
  document.getElementById("avOnayDim").onclick = avOnayPenceresiKapat;

  // DÖNEM BARI (27.09.2026 tasarım, 02.10.2026 revize) — ‹ › okları +
  // kaydırma (swipe). KAPATILMIŞ aylar atlanmadan tek tek gösterilir (salt
  // okunur). "›" artık Maaş Hesaplama'nın resmi açık dönemini GEÇEMEZ —
  // avDonemBariCiz o noktada "›"yı zaten gizliyor, ama avSonrakiAyaGec de
  // ek bir güvenlik olarak aynı sınırı uygular.
  document.getElementById("avDonemOncekiBtn").onclick = function(){
    var g = avOncekiAy(avSeciliAy, avSeciliYil);
    avDonemeGec(g.ay, g.yil);
  };
  function avSonrakiAyaGec(){
    var acik = MaasKayitData.acikDonem();
    if(avSeciliAy === acik.ay && avSeciliYil === acik.yil) return; // zaten açık dönemde, daha ileri gidilemez
    var g = avSonrakiAy(avSeciliAy, avSeciliYil);
    avDonemeGec(g.ay, g.yil);
  }
  document.getElementById("avDonemSonrakiBtn").onclick = avSonrakiAyaGec;

  (function(){
    var bar = document.getElementById("avDonemBar");
    var baslangicX = null, baslangicY = null;
    bar.addEventListener("touchstart", function(ev){
      var t = ev.touches[0];
      baslangicX = t.clientX; baslangicY = t.clientY;
    }, {passive:true});
    bar.addEventListener("touchend", function(ev){
      if(baslangicX == null) return;
      var t = ev.changedTouches[0];
      var dx = t.clientX - baslangicX, dy = t.clientY - baslangicY;
      baslangicX = null; baslangicY = null;
      if(Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)*1.5) return; // yatay kaydırma değilse yoksay
      if(dx > 0){ document.getElementById("avDonemOncekiBtn").onclick(); }
      else { avSonrakiAyaGec(); }
    }, {passive:true});
  })();

  // TİP DÜĞMESİ (24.09.2026) — ayrı bir "İş/Özel" satırı yerine, giriş
  // satırının başındaki tek düğmeye dokununca küçük bir seçim popup'ı
  // açılıyor (Abdullah'ın isteği: "Ekle tuşu gibi tek bir tuş").
  var avSeciliTip = "is";
  var avTipBtn = document.getElementById("avTipBtn");
  var avTipPopup = document.getElementById("avTipPopup");
  avTipBtn.onclick = function(){ avTipPopup.hidden = !avTipPopup.hidden; };
  avTipPopup.querySelectorAll(".av-tip-secenek").forEach(function(btn){
    btn.onclick = function(){
      avSeciliTip = this.getAttribute("data-tip");
      avTipBtn.setAttribute("data-tip", avSeciliTip);
      avTipBtn.innerHTML = (avSeciliTip==="is" ? "İŞ" : "ÖZEL") + "<span class='av-tip-ok'>▾</span>";
      avTipPopup.hidden = true;
    };
  });

  // MANUEL KAYDET (24.09.2026) — sistem zaten her satırda otomatik
  // kaydediyor, ama Abdullah'a ek güven vermesi için elle basılabilen bir
  // düğme de eklendi; bastığında aynı taslağı tekrar yazar ve büyük/net
  // bir "✓ Kaydedildi" onayı gösterir.
  // HARCAMALAR bölümünün altına da aynı "Bilgileri Kaydet" düğmesi
  // eklendi (27.09.2026, Abdullah'ın isteğiyle) — ikisi de aynı taslağı
  // kaydeder, hangisine basılırsa basılsın davranış birebir aynı.
  function avManuelKaydetTiklandi(){
    var btn = this;
    var eskiMetin = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Kaydediliyor...";
    avTaslagiKaydet();
    setTimeout(function(){
      btn.disabled = false;
      btn.textContent = eskiMetin;
      avKaydedildiGoster();
    }, 400);
  }
  document.getElementById("btnAvManuelKaydet").onclick = avManuelKaydetTiklandi;
  document.getElementById("btnAvManuelKaydet2").onclick = avManuelKaydetTiklandi;

  document.getElementById("btnAvEkle").onclick = function(){
    var tarih = document.getElementById("avTarih").value;
    var aciklama = document.getElementById("avAciklama").value.trim();
    var tutar = tutarParse_AV(document.getElementById("avTutar").value);
    if(!tarih || !aciklama || tutar<=0){ alert("Tarih, açıklama ve tutar (0'dan büyük) gerekli."); return; }
    if(avSeciliTip === "is"){ avIsListe.push({tarih:tarih, aciklama:aciklama, tutar:tutar}); }
    else { avOzelListe.push({tarih:tarih, aciklama:aciklama, tutar:tutar}); }
    document.getElementById("avTarih").value = "";
    document.getElementById("avAciklama").value = "";
    document.getElementById("avTutar").value = "";
    avTaslagiKaydet(); avCiz(); avKaydedildiGoster();
  };

  document.getElementById("btnHarcamaEkle").onclick = function(){
    var tarih = document.getElementById("avHarcamaTarih").value;
    var cesit = document.getElementById("avHarcamaCesit").value.trim();
    var tutar = tutarParse_AV(document.getElementById("avHarcamaTutar").value);
    if(!tarih || !cesit || tutar<=0){ alert("Tarih, çeşit ve tutar (0'dan büyük) gerekli."); return; }
    avHarcamaListe.push({tarih:tarih, cesit:cesit, tutar:tutar});
    document.getElementById("avHarcamaTarih").value = "";
    document.getElementById("avHarcamaCesit").value = "";
    document.getElementById("avHarcamaTutar").value = "";
    avTaslagiKaydet(); avCiz(); avKaydedildiGoster();
  };

  // KAPALI KAYDI SİL (27.09.2026) — sadece kapalı bir dönem görüntülenirken
  // görünür; sildiğinde ay tekrar açık (düzenlenebilir/taslak) hale gelir.
  document.getElementById("btnAvKapaliKaydiSil").onclick = function(){
    var anahtar = this.getAttribute("data-anahtar");
    if(!anahtar) return;
    if(!confirm("Bu kaydı silmek istediğine emin misin? Bu ay tekrar açık (düzenlenebilir) hale gelecek.")) return;
    AvansKayitData.kaydiSil(anahtar, function(basarili, err){
      if(!basarili){ alert("Silinemedi: " + (err && err.message)); return; }
      avDonemeGec(avSeciliAy, avSeciliYil);
    });
  };

  AvansKayitData.degistiginde(function(){
    avDonemBariCiz();
    avIlkGecisiDeneVeYap();
    avYilTabloCiz();
    // KRİTİK HATA DÜZELTMESİ (24.09.2026): Firebase'den her yeni veri
    // paketi geldiğinde (özellikle SAYFA AÇILDIKTAN SONRA gelen İLK
    // paket), seçili dönemi TAZE veriyle yeniden değerlendir (açık mı
    // kapalı mı olduğu da değişmiş olabilir) — eskiden bu satır yoktu,
    // ekran ilk boş çizdiği haliyle kalıyor, kayıtlar Firebase'de
    // dururken sayfada "silinmiş" gibi görünüyordu.
    if(avSeciliAy && avSeciliYil) avDonemeGec(avSeciliAy, avSeciliYil);
    if(AvansKayitData.taslakYuklendiMi()) avYuklemeKilidiniAc();
  });

  // MaasKayitData artık açık/kapalı dönem belirlemede TEK KAYNAK — o
  // yüklenince (veya bir dönem Maaş Hesaplama'dan kapatılınca) burada da
  // ilk geçiş denenir. 02.10.2026 (Abdullah'ın isteğiyle): eğer o an canlı/
  // açık dönemi izliyorsak (avCanliMi), bir dönem kapanması bu sayfayı
  // OTOMATİK olarak yeni açık döneme geçirir — elle "›"ye basmaya gerek
  // kalmaz. Geçmiş bir ayı inceliyorsak (avCanliMi=false), sadece dönem
  // barının ok görünürlüğü tazelenir, görünümden koparılmayız.
  try{
    MaasKayitData.degistiginde(function(){
      avIlkGecisiDeneVeYap();
      avYilTabloCiz();
      if(avSeciliAy && avSeciliYil){
        if(avCanliMi){
          var acik = MaasKayitData.acikDonem();
          if(avSeciliAy !== acik.ay || avSeciliYil !== acik.yil){ avDonemeGec(acik.ay, acik.yil); return; }
        }
        avDonemBariCiz();
      }
    });
  }catch(e){}
});
