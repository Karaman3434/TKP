/*
  odenebilir-komisyon-render.js — VERSİYON: TKP.04.11.26-16:22.1471
  ================================================================
  04.11.2026 (Abdullah onayı — mockup üzerinden) YENİDEN TASARIM:
  1) FOTOĞRAF YÜKLEME / OCR KALDIRILDI (Tesseract, sıkıştırma, 1./2. Fotoğraf).
  2) AY BAŞI + AY SONU: her biri tarih + tutar. Ay Başı, bir önceki ayın
     Ay Sonu'ndan otomatik devreder (komisyon-donem-data.js) ve kilitli gelir;
     ilk ay (devir yok) elle yazılır. Ay Sonu elle yazılır.
  3) KAYDET TUŞU YOK: kutudan çıkınca (blur) ve sayfadan çıkarken /
     arka plana giderken otomatik kaydedilir.
  4) ÖDENEBİLİR KOMİSYON = Ay Sonu tutarı − Ay Başı tutarı (tarihi yeni olan −
     eski olan). Brüt Prim hesabı maas-ortak-hesap.js'te DEĞİŞMEDEN kalır:
     "birinci" = Ay Başı, "ikinci" = Ay Sonu (aylar:{1:tutar}) — Maaş Hesaplama
     ve Net Maaş sayfaları aynı sonucu otomatik alır.
  5) Ekstra Kayıp Prim (elle) korunur; Brüt Prim'e eklenir.
  6) Ay kapanınca (Maaş Hesaplama'dan) bu sayfa o ayı kilitler (‹ ile salt
     okunur görülür), yeni aya geçer; yeni Ay Başı = kapanan Ay Sonu.
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

var AY_ADLARI = ["","Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

function el(id){ return document.getElementById(id); }

function fmtTL(n){
  return (n||0).toLocaleString("tr-TR", {minimumFractionDigits:2, maximumFractionDigits:2});
}
function fmtTL_BN(n){ return fmtTL(n) + " TL"; }
function fmtIsaretli(n){ return (n>=0 ? "+" : "−") + fmtTL(Math.abs(n)) + " TL"; }
function fmtOranSadece_BN(brut, net){
  if(!brut) return "%0,00 kesinti";
  var oran = (brut-net)/brut*100;
  return "%" + oran.toLocaleString("tr-TR", {minimumFractionDigits:2, maximumFractionDigits:2}) + " kesinti";
}
function htmlEsc_BN(t){
  return String(t == null ? "" : t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

// "2.500,00" / "2500,5" / "2500.50" / "2500" / "-1.200,00 TL" → sayı (geçersizse NaN).
function tutarParse(metin){
  var t = String(metin||"").trim().replace(/\s/g,"").replace(/TL$/i,"");
  if(!t) return NaN;
  var eksi = false;
  if(t.charAt(0) === "-" || t.charAt(0) === "−"){ eksi = true; t = t.slice(1); }
  if(t.indexOf(",") !== -1) t = t.replace(/\./g,"").replace(",",".");
  else if(/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g,"");
  if(!/^\d+(\.\d+)?$/.test(t)) return NaN;
  var n = parseFloat(t);
  return eksi ? -n : n;
}
var ekstraTutarParse_BN = tutarParse;

// "gg.aa.yyyy" → "yyyy-aa-gg" (geçersizse null)
function tarihParse(metin){
  var m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(String(metin||"").trim());
  if(!m) return null;
  var g = parseInt(m[1],10), a = parseInt(m[2],10), y = parseInt(m[3],10);
  if(a<1 || a>12 || g<1 || y<2000 || y>2100) return null;
  var d = new Date(y, a-1, g);
  if(d.getFullYear() !== y || d.getMonth() !== a-1 || d.getDate() !== g) return null;
  return y + "-" + ("0"+a).slice(-2) + "-" + ("0"+g).slice(-2);
}
function tarihGoster(iso){
  if(!iso) return "";
  var p = String(iso).split("-");
  if(p.length !== 3) return "";
  return p[2] + "." + p[1] + "." + p[0];
}

/* ---------------------------------------------------------------------
   DURUM
   --------------------------------------------------------------------- */
var okGezinmeOfset = 0;      // 0 = açık (canlı) dönem; 1+ = kapalı dönem (salt okunur)
var okSenkronBitti = false;  // açık dönem Firebase ile eşitlenmeden kayıt yapılmaz
var okArsivVeri = null;
var okArsivAnahtar = null;

function okAcikDonem(){
  try{ return MaasKayitData.acikDonem(); }catch(e){ return null; }
}
function okGecerliDonem(){
  try{
    var acik = okAcikDonem();
    var d = KomisyonDonemData.gecerliDonem();
    if(!acik || !d) return null;
    return d.donemAnahtari === KomisyonDonemData.donemAnahtariUret(acik.ay, acik.yil) ? d : null;
  }catch(e){ return null; }
}

/* ---------------------------------------------------------------------
   GİRİŞ KUTULARI
   --------------------------------------------------------------------- */
var GIRISLER = {
  birinci: {tarih: "okBasiTarih", tutar: "okBasiTutar"},
  ikinci:  {tarih: "okSonuTarih", tutar: "okSonuTutar"}
};

function girisYaz(inp, deger){
  if(document.activeElement === inp) return; // kullanıcı yazarken ezme
  inp.value = deger;
}

function girisleriDoldur(basi, sonu, kilitliBasi, kilitliSonu){
  var kutular = [
    {slot:"birinci", kayit:basi, kilit:kilitliBasi},
    {slot:"ikinci",  kayit:sonu, kilit:kilitliSonu}
  ];
  kutular.forEach(function(k){
    var t = el(GIRISLER[k.slot].tarih), u = el(GIRISLER[k.slot].tutar);
    t.readOnly = !!k.kilit; u.readOnly = !!k.kilit;
    t.parentNode.classList.toggle("ok-tutar-kutu--kilit", !!k.kilit);
    // Kullanıcının yazdığı ama henüz kaydedilmemiş / hatalı değeri EZME.
    var hatali = t.classList.contains("ok-giris--hata") || u.classList.contains("ok-giris--hata");
    var kirli = t.dataset.kirli === "1" || u.dataset.kirli === "1";
    if(hatali) return;
    if(k.kayit){
      girisYaz(t, k.kayit.tarih ? tarihGoster(k.kayit.tarih) : "");
      girisYaz(u, fmtTL_BN(KomisyonDonemData.kayitTutar(k.kayit)));
      if(document.activeElement !== t && document.activeElement !== u){ t.dataset.kirli = "0"; u.dataset.kirli = "0"; }
    } else if(!kirli || k.kilit){
      girisYaz(t, ""); girisYaz(u, "");
    }
  });
}

function tarihMaskele(inp){
  var r = inp.value.replace(/\D/g,"").slice(0,8);
  var s = r;
  if(r.length > 4) s = r.slice(0,2) + "." + r.slice(2,4) + "." + r.slice(4);
  else if(r.length > 2) s = r.slice(0,2) + "." + r.slice(2);
  inp.value = s;
}

// Ay Başı / Ay Sonu → otomatik kaydet (blur, sayfadan çıkış). Eksik/geçersizse
// kaydetmez; tarih+tutar ikisi de geçerliyse ve değiştiyse yazar.
function slotKaydetDene(slot){
  try{
    if(okGezinmeOfset !== 0 || !okSenkronBitti) return;
    var d = okGecerliDonem();
    if(!d) return;
    var tI = el(GIRISLER[slot].tarih), uI = el(GIRISLER[slot].tutar);
    if(tI.readOnly) return;
    var mevcut = d[slot] || null;
    var tarih = tarihParse(tI.value);
    var tutar = tutarParse(uI.value);
    var bos = !tI.value.trim() && !uI.value.trim();
    var notEl = el(slot === "ikinci" ? "okSonuNot" : "okBasiNot");
    tI.classList.toggle("ok-giris--hata", !!tI.value.trim() && !tarih);
    uI.classList.toggle("ok-giris--hata", !!uI.value.trim() && isNaN(tutar));

    if(bos){
      if(mevcut){
        KomisyonDonemData.slotSil(slot, function(ok, err){ if(!ok) hataGoster("Silinemedi: " + (err && err.message)); });
      }
      return;
    }
    if(!tarih || isNaN(tutar)) return; // henüz tamamlanmadı

    // Ay Sonu tarihi Ay Başı tarihinden önce olamaz (fark yönü bozulur).
    if(slot === "ikinci" && d.birinci && d.birinci.tarih && tarih < d.birinci.tarih){
      notEl.hidden = false; notEl.className = "ok-tutar-kutu-not ok-tutar-kutu-not--hata";
      notEl.textContent = "Tarih, ay başı tarihinden (" + tarihGoster(d.birinci.tarih) + ") önce olamaz.";
      tI.classList.add("ok-giris--hata");
      return;
    }
    if(slot === "birinci" && d.ikinci && d.ikinci.tarih && tarih > d.ikinci.tarih){
      var sNot = el("okBasiNot");
      sNot.hidden = false; sNot.className = "ok-tutar-kutu-not ok-tutar-kutu-not--hata";
      sNot.textContent = "Tarih, ay sonu tarihinden (" + tarihGoster(d.ikinci.tarih) + ") sonra olamaz.";
      tI.classList.add("ok-giris--hata");
      return;
    }
    notEl.hidden = true;

    if(mevcut && mevcut.tarih === tarih && Math.abs(KomisyonDonemData.kayitTutar(mevcut) - tutar) < 0.005) return; // değişmedi
    var kayit = {tarih: tarih, tutar: tutar, aylar: {1: tutar}, kayitZamani: Date.now()};
    KomisyonDonemData.slotKaydet(d.donemAnahtari, slot, kayit, function(ok, err){
      if(!ok) hataGoster("Kaydedilemedi: " + (err && err.message ? err.message : "bilinmeyen hata"));
    });
  }catch(e){ hataGoster("Kaydetme başarısız: " + e.message); }
}
function tumunuKaydetDene(){ slotKaydetDene("birinci"); slotKaydetDene("ikinci"); }

function girisOlaylariniBagla(){
  ["birinci","ikinci"].forEach(function(slot){
    var tI = el(GIRISLER[slot].tarih), uI = el(GIRISLER[slot].tutar);
    tI.addEventListener("input", function(){ tarihMaskele(tI); tI.classList.remove("ok-giris--hata"); tI.dataset.kirli = "1"; });
    uI.addEventListener("input", function(){ uI.classList.remove("ok-giris--hata"); uI.dataset.kirli = "1"; });
    uI.addEventListener("focus", function(){
      if(uI.readOnly) return;
      uI.value = uI.value.replace(/\s*TL$/i, "");
      try{ uI.select(); }catch(e){}
    });
    uI.addEventListener("blur", function(){
      var n = tutarParse(uI.value);
      if(!isNaN(n)) uI.value = fmtTL_BN(n);
      slotKaydetDene(slot);
      okGorunumDoldur();
    });
    tI.addEventListener("blur", function(){
      var iso = tarihParse(tI.value);
      if(iso) tI.value = tarihGoster(iso);
      slotKaydetDene(slot);
      okGorunumDoldur();
    });
    [tI, uI].forEach(function(inp){
      inp.addEventListener("keydown", function(ev){ if(ev.key === "Enter"){ ev.preventDefault(); inp.blur(); } });
    });
  });
  // Sayfadan çıkış / uygulama arka plana → bekleyen yazıyı kaydet
  window.addEventListener("pagehide", tumunuKaydetDene);
  document.addEventListener("visibilitychange", function(){ if(document.visibilityState === "hidden") tumunuKaydetDene(); });
}

/* ---------------------------------------------------------------------
   EKSTRA KAYIP PRİM
   --------------------------------------------------------------------- */
function ekstraEkleTiklandi(){
  try{
    var acik = MaasKayitData.acikDonem();
    var aciklamaEl = el("bnEkstraAciklama");
    var tutarEl = el("bnEkstraTutar");
    var tutar = tutarParse(tutarEl.value);
    if(!(tutar > 0)){ alert("Geçerli bir tutar yaz (örn. 2.500,00)."); tutarEl.focus(); return; }
    var btn = el("btnBnEkstraEkle");
    btn.disabled = true;
    KomisyonDonemData.ekstraEkle(KomisyonDonemData.donemAnahtariUret(acik.ay, acik.yil), aciklamaEl.value, tutar, function(ok, err){
      btn.disabled = false;
      if(!ok){ hataGoster("Ekstra kayıp prim eklenemedi: " + (err && err.message)); return; }
      aciklamaEl.value = ""; tutarEl.value = "";
    });
  }catch(e){ hataGoster("Ekstra kayıp prim eklenemedi: " + e.message); }
}

function ekstraSatirlariniCiz(liste, silinebilir){
  var tablo = el("bnFarkTablo");
  var govde = el("bnFarkTabloGovde");
  if(!liste.length){ tablo.hidden = true; govde.innerHTML = ""; return; }
  var html = "";
  liste.forEach(function(x){
    html += "<tr><td class='ok-ekstra-ac-td'><span class='ok-ekstra-rozet'>EKSTRA</span>" + htmlEsc_BN(x.aciklama || "Kayıp prim") + "</td>"
      + "<td class='ok-ekstra-tutar-td'>+" + fmtTL_BN(x.tutar)
      + (silinebilir ? "<button type='button' class='ok-ekstra-sil' data-id='" + htmlEsc_BN(x.id) + "' aria-label='Sil'>🗑</button>" : "")
      + "</td></tr>";
  });
  govde.innerHTML = html;
  tablo.hidden = false;
  govde.querySelectorAll(".ok-ekstra-sil").forEach(function(btn){
    btn.onclick = function(){
      var id = this.getAttribute("data-id");
      if(!confirm("Bu ekstra kayıp prim satırı silinsin mi?")) return;
      KomisyonDonemData.ekstraSil(id, function(ok, err){
        if(!ok) hataGoster("Ekstra kayıp prim silinemedi: " + (err && err.message));
      });
    };
  });
}

/* ---------------------------------------------------------------------
   ÖDENEBİLİR KOMİSYON KUTUSU + BRÜT → NET PRİM
   --------------------------------------------------------------------- */
function farkKutusunuYaz(basi, sonu, bosMetin){
  var degerEl = el("okFarkDeger"), altEl = el("okFarkAlt"), kutu = el("okFarkKutu");
  if(basi && sonu){
    var fark = KomisyonDonemData.kayitTutar(sonu) - KomisyonDonemData.kayitTutar(basi);
    degerEl.textContent = fmtIsaretli(fark);
    altEl.textContent = tarihGoster(sonu.tarih) + " tutarı − " + tarihGoster(basi.tarih) + " tutarı"
      + (fark < 0 ? " · Brüt prime 0 olarak yansır" : "");
    kutu.classList.toggle("ok-fark-kutu--eksi", fark < 0);
  } else {
    degerEl.textContent = "—";
    altEl.textContent = bosMetin;
    kutu.classList.remove("ok-fark-kutu--eksi");
  }
}

function brutNetYaz(komisyon, ekstra, brut, net){
  // komisyon/ekstra/brut/net: sayı ya da null (— gösterilir)
  el("bnKomisyonDeger").textContent = komisyon == null ? "—" : fmtIsaretli(komisyon);
  var eSatir = el("bnEkstraSatir");
  eSatir.hidden = !(ekstra > 0);
  el("bnEkstraDeger").textContent = ekstra > 0 ? "+" + fmtTL_BN(ekstra) : "—";
  el("bnToplamFarkDeger").textContent = brut == null ? "—" : fmtIsaretli(brut);
  el("bnPrimKesintiOran").textContent = (brut == null || net == null) ? "—" : fmtOranSadece_BN(brut, net);
  el("bnNetPrimDeger").textContent = net == null ? "—" : fmtTL_BN(net);
}

/* ---------------------------------------------------------------------
   AÇIK (CANLI) DÖNEM
   --------------------------------------------------------------------- */
function acikDonemiCiz(){
  try{
    var acik = okAcikDonem();
    if(!acik || typeof MaasOrtakHesap === "undefined") return;
    var d = okGecerliDonem();
    var basi = d && d.birinci || null;
    var sonu = d && d.ikinci || null;

    // Ay Başı kilidi: sadece önceki aydan DEVREDEN kayıt kilitli.
    var devir = !!(basi && basi.devir);
    girisleriDoldur(basi, sonu, devir, false);
    el("okBasiKilit").hidden = !devir;
    var basiNot = el("okBasiNot");
    if(devir){
      var oncekiAy = acik.ay === 1 ? 12 : acik.ay - 1;
      basiNot.hidden = false; basiNot.className = "ok-tutar-kutu-not";
      basiNot.textContent = AY_ADLARI[oncekiAy] + " ayı kapanışından otomatik geldi";
    } else if(!basiNot.classList.contains("ok-tutar-kutu-not--hata")){
      basiNot.hidden = true;
    }
    if(!devir && basiNot.classList.contains("ok-tutar-kutu-not--hata") && basi && sonu && basi.tarih <= sonu.tarih) basiNot.hidden = true;
    var sonuNot = el("okSonuNot");
    if(sonuNot.classList.contains("ok-tutar-kutu-not--hata") && sonu && basi && sonu.tarih >= basi.tarih) sonuNot.hidden = true;

    el("bnEkstraForm").hidden = false;
    var ekstraListe = KomisyonDonemData.ekstraListe();
    ekstraSatirlariniCiz(ekstraListe, true);

    farkKutusunuYaz(basi, sonu, basi ? "Ay sonu tutarını yazınca hesaplanır" : "Ay başı ve ay sonu tutarını yazınca hesaplanır");

    var h = MaasOrtakHesap.hesapla(acik.ay, acik.yil);
    if(!h.komisyonTamMi && !ekstraListe.length){
      brutNetYaz(null, 0, null, null);
    } else {
      brutNetYaz(h.komisyonTamMi ? h.fotoBrutPrim : null, h.ekstraPrim, h.brutPrim, h.sonuc.netPrim);
    }
  }catch(e){ hataGoster("Ödenebilir komisyon gösterilemedi: " + e.message); }
}

/* ---------------------------------------------------------------------
   KAPALI DÖNEM (salt okunur)
   --------------------------------------------------------------------- */
function kapaliDonemiCiz(k){
  var anahtar = k.yil + "-" + ("0"+k.ay).slice(-2);
  okArsivAnahtar = anahtar;
  okArsivVeri = null;
  el("bnEkstraForm").hidden = true;
  el("okBasiKilit").hidden = false;
  el("okBasiNot").hidden = true;
  var sNot = el("okSonuNot");
  sNot.hidden = false; sNot.className = "ok-tutar-kutu-not";
  sNot.textContent = "🔒 Kapalı dönem (salt okunur)";
  girisleriDoldur(null, null, true, true);
  ekstraSatirlariniCiz([], false);
  farkKutusunuYaz(null, null, "Bu dönemin ay başı/ay sonu kaydı arşivde yok");
  brutNetYaz(null, 0, k.brutPrim || 0, k.netPrim || 0);

  KomisyonDonemData.arsivOku(anahtar, function(a){
    if(okArsivAnahtar !== anahtar || okGezinmeOfset === 0) return;
    okArsivVeri = a;
    if(!a) return;
    var basi = a.birinci || null, sonu = a.ikinci || null;
    girisleriDoldur(basi, sonu, true, true);
    farkKutusunuYaz(basi, sonu, "Bu dönemin ay başı/ay sonu kaydı arşivde yok");
    var ekstra = a.ekstraPrimler ? Object.keys(a.ekstraPrimler).map(function(id){
      var x = a.ekstraPrimler[id];
      return {id: id, aciklama: x.aciklama || "", tutar: parseFloat(x.tutar) || 0, zaman: x.zaman || 0};
    }).sort(function(p,q){ return p.zaman - q.zaman; }) : [];
    ekstraSatirlariniCiz(ekstra, false);
    var ekstraTop = ekstra.reduce(function(t, x){ return t + x.tutar; }, 0);
    var komisyon = (basi && sonu) ? Math.max(0, KomisyonDonemData.kayitTutar(sonu) - KomisyonDonemData.kayitTutar(basi)) : null;
    brutNetYaz(komisyon, ekstraTop, k.brutPrim || 0, k.netPrim || 0);
  });
}

/* ---------------------------------------------------------------------
   DÖNEM GEZİNME + ÜST ETİKET
   --------------------------------------------------------------------- */
function ustEtiketYaz(ay, yil, kilitli){
  el("okUstEtiketMetin").textContent = "Ödenebilir Komisyon · " + AY_ADLARI[ay] + " " + yil + (kilitli ? " 🔒" : "");
}

function okGorunumDoldur(){
  if(okGezinmeOfset === 0) acikDonemiCiz();
}

function okGorunumCiz(){
  if(typeof MaasKayitData === "undefined") return;
  var kayitlar = MaasKayitData.tumKayitlar();
  if(okGezinmeOfset > kayitlar.length) okGezinmeOfset = kayitlar.length;
  if(okGezinmeOfset < 0) okGezinmeOfset = 0;

  el("okDonemOncekiBtn").hidden = (okGezinmeOfset >= kayitlar.length);
  el("okDonemSonrakiBtn").hidden = (okGezinmeOfset === 0);

  if(okGezinmeOfset === 0){
    okArsivAnahtar = null; okArsivVeri = null;
    try{ var a0 = MaasKayitData.acikDonem(); ustEtiketYaz(a0.ay, a0.yil, false); }catch(e){}
    ["okBasiNot","okSonuNot"].forEach(function(id){ el(id).hidden = true; el(id).className = "ok-tutar-kutu-not"; });
    el("okBasiKilit").hidden = true;
    donemKontrolVeCiz();
  } else {
    var k = kayitlar[okGezinmeOfset - 1];
    ustEtiketYaz(k.ay, k.yil, true);
    kapaliDonemiCiz(k);
  }
}

// Bir önceki ay kapatıldıysa (Maaş Hesaplama'dan) dönemi yeni aya geçirir
// (Ay Sonu → yeni Ay Başı devri komisyon-donem-data.js'te yapılır).
function donemKontrolVeCiz(){
  try{
    if(typeof MaasKayitData === "undefined" || typeof KomisyonDonemData === "undefined") return;
    var acik = MaasKayitData.acikDonem();
    KomisyonDonemData.acikDonemleSenkronizeEt(acik.ay, acik.yil, function(){
      okSenkronBitti = true;
      if(okGezinmeOfset === 0) acikDonemiCiz();
    });
  }catch(e){ hataGoster("Dönem kontrolü başarısız: " + e.message); }
}

window.addEventListener("error", function(ev){
  hataGoster("HATA: " + ev.message + " (" + (ev.filename||"").split("/").pop() + ":" + ev.lineno + ")");
});

document.addEventListener("DOMContentLoaded", function(){
  var btnMenuEl = el("btnMenu");
  if(btnMenuEl) btnMenuEl.onclick = function(){ window.location.href = "menu.html"; };
  el("btnBnEkstraEkle").onclick = ekstraEkleTiklandi;
  girisOlaylariniBagla();

  el("okDonemOncekiBtn").onclick = function(){ okGezinmeOfset++; okGorunumCiz(); };
  el("okDonemSonrakiBtn").onclick = function(){ okGezinmeOfset--; okGorunumCiz(); };
  (function(){
    var bar = el("okUstEtiket");
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
      if(Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)*1.5) return;
      if(dx > 0){ okGezinmeOfset++; } else { okGezinmeOfset--; }
      okGorunumCiz();
    }, {passive:true});
  })();

  try{ KomisyonDonemData.degistiginde(function(){ if(okGezinmeOfset===0) acikDonemiCiz(); }); }catch(e){}
  try{ MaasKayitData.degistiginde(function(){ okGorunumCiz(); }); }catch(e){}
  okGorunumCiz();
});
