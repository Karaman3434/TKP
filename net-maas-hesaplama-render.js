/*
  net-maas-hesaplama-render.js — VERSİYON: TKP.02.11.26-20:12.1445
  ==============================================================
  BRÜT MAAŞ → NET MAAŞ sayfası. Ay kapatma YOK — tek kapat butonu Maaş
  Hesaplama (özet) sayfasında. Net Maaş, MaasOrtakHesap.hesapla() üzerinden
  aynı ayın Brüt Prim'ini de hesaba katarak bulunur (hesaplama kuralları
  değişmedi, bkz. maas-hesaplama-data.js).
*/

var AY_ADLARI_NM = ["","Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

function hataGoster(mesaj){
  console.error(mesaj);
  if(typeof HataLog !== "undefined") HataLog.kaydet(mesaj);
  var kutu = document.createElement("div");
  kutu.textContent = "⚠️ " + mesaj;
  kutu.style.cssText = "position:fixed;top:8px;left:8px;right:8px;background:#c0392b;color:#fff;padding:10px;border-radius:8px;font-size:13px;z-index:99999;";
  document.body.appendChild(kutu);
  setTimeout(function(){ kutu.remove(); }, 8000);
}

function fmtTL_NM(n){
  return (n||0).toLocaleString("tr-TR", {minimumFractionDigits:2, maximumFractionDigits:2}) + " TL";
}
function tutarParse_NM(s){
  s = (s||"").toString().trim();
  if(!s) return 0;
  s = s.replace(/\./g, "").replace(",", ".");
  var v = parseFloat(s);
  return isNaN(v) ? 0 : v;
}
function fmtOranSadece_NM(brut, net){
  if(!brut) return "%0,00 kesinti";
  var oran = (brut-net)/brut*100;
  return "%" + oran.toLocaleString("tr-TR", {minimumFractionDigits:2, maximumFractionDigits:2}) + " kesinti";
}
function tarihiGuncelle_NM(){
  try{
    var el = document.getElementById("gunTarihi");
    if(!el) return;
    var gunler = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
    var d = new Date();
    el.textContent = gunler[d.getDay()] + ", " + d.getDate() + " " + AY_ADLARI_NM[d.getMonth()+1] + " " + d.getFullYear();
  }catch(e){}
}

// DÖNEM BARI — 0 = açık/canlı dönem (MaasOrtakHesap ile canlı hesaplanır,
// düzenlenebilir), 1+ = MaasKayitData.tumKayitlar()[ofset-1] (kapanmış
// kayıt, salt okunur).
var nmGezinmeOfset = 0;

function nmDuzenlemeGorunurlugunuAyarla(gorunurMu){
  document.getElementById("btnNmBrutSabitGuncelle").hidden = !gorunurMu;
  document.getElementById("btnNmMatrahKalibreEt").hidden = !gorunurMu;
  document.getElementById("nmKapaliSerit").hidden = gorunurMu;
}

function nmKapaliKaydiGoster(k){
  nmDuzenlemeGorunurlugunuAyarla(false);
  var etiket = document.getElementById("nmDonemBtnMetin");
  if(etiket) etiket.textContent = AY_ADLARI_NM[k.ay] + " " + k.yil;
  document.getElementById("nmToplamAyEtiket").textContent = AY_ADLARI_NM[k.ay] + " " + k.yil;
  document.getElementById("nmBrutSabitDeger").textContent = fmtTL_NM(k.brutSabitAylik);
  document.getElementById("nmMaasKesintiOran").textContent = fmtOranSadece_NM(k.brutSabitAylik, k.netSabitMaas);
  document.getElementById("nmNetMaasDeger").textContent = fmtTL_NM(k.netSabitMaas);
  document.getElementById("nmMatrahDurum").textContent = "Kapanmış kayıt — kalibrasyon bu görünümde değiştirilemez.";
  document.getElementById("nmToplamDeger").textContent = fmtTL_NM(k.netSabitMaas);
}

function nmGorunumCiz(){
  var kayitlar = MaasKayitData.tumKayitlar();
  if(nmGezinmeOfset > kayitlar.length) nmGezinmeOfset = kayitlar.length;
  if(nmGezinmeOfset < 0) nmGezinmeOfset = 0;

  var btnOnceki = document.getElementById("nmDonemOncekiBtn");
  var btnSonraki = document.getElementById("nmDonemSonrakiBtn");
  if(btnOnceki) btnOnceki.hidden = (nmGezinmeOfset >= kayitlar.length);
  if(btnSonraki) btnSonraki.hidden = (nmGezinmeOfset === 0);

  if(nmGezinmeOfset === 0){
    nmDuzenlemeGorunurlugunuAyarla(true);
    nmHesaplaVeCiz();
  } else {
    nmKapaliKaydiGoster(kayitlar[nmGezinmeOfset - 1]);
  }
}

function nmHesaplaVeCiz(){
  var acik = MaasKayitData.acikDonem();
  var etiket = document.getElementById("nmDonemBtnMetin");
  if(etiket) etiket.textContent = AY_ADLARI_NM[acik.ay] + " " + acik.yil;
  document.getElementById("nmToplamAyEtiket").textContent = AY_ADLARI_NM[acik.ay] + " " + acik.yil;

  var h = MaasOrtakHesap.hesapla(acik.ay, acik.yil);
  document.getElementById("nmBrutSabitDeger").textContent = fmtTL_NM(h.brutSabit);
  document.getElementById("nmMaasKesintiOran").textContent = fmtOranSadece_NM(h.sonuc.brutSabitAylik, h.sonuc.netSabitMaas);
  document.getElementById("nmNetMaasDeger").textContent = fmtTL_NM(h.sonuc.netSabitMaas);
  document.getElementById("nmToplamDeger").textContent = fmtTL_NM(h.sonuc.netSabitMaas);

  var oncekiAy = MaasOrtakHesap.oncekiAyHesapla(acik.ay, acik.yil);
  var matrahMetni = h.matrahOverride!=null
    ? "✓ Kalibre edildi (" + AY_ADLARI_NM[oncekiAy.ay] + " " + oncekiAy.yil + " sonu itibariyle: " + fmtTL_NM(h.matrahOverride) + ")"
    : (acik.ay === 1
      ? "Yeni vergi yılı — birikmiş matrah Ocak'ta sıfırdan başlar, kalibrasyon gerekmez."
      : "Kalibrasyon yok — Ocak'tan tahmini hesaplanıyor. Bordrondaki \"Önceki Ay Matrah\" rakamını girerek doğruluğu artırabilirsin.");
  if(h.sonuc && h.sonuc.parametreTanimliMi === false){
    matrahMetni += " ⚠️ " + acik.yil + " vergi dilimleri / asgari ücret henüz tanımlı değil — " + h.sonuc.parametreYili + " değerleri kullanılıyor.";
  }
  document.getElementById("nmMatrahDurum").textContent = matrahMetni;
}

window.addEventListener("error", function(ev){
  hataGoster("HATA: " + ev.message + " (" + (ev.filename||"").split("/").pop() + ":" + ev.lineno + ")");
});

document.addEventListener("DOMContentLoaded", function(){
  tarihiGuncelle_NM();
  var btnMenuEl = document.getElementById("btnMenu");
  if(btnMenuEl) btnMenuEl.onclick = function(){ window.location.href = "menu.html"; };
  nmGorunumCiz();

  document.getElementById("nmDonemOncekiBtn").onclick = function(){ nmGezinmeOfset++; nmGorunumCiz(); };
  document.getElementById("nmDonemSonrakiBtn").onclick = function(){ nmGezinmeOfset--; nmGorunumCiz(); };
  (function(){
    var bar = document.getElementById("nmDonemBar");
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
      if(dx > 0){ nmGezinmeOfset++; } else { nmGezinmeOfset--; }
      nmGorunumCiz();
    }, {passive:true});
  })();

  document.getElementById("btnNmBrutSabitGuncelle").onclick = function(){
    var mevcut = parseFloat(localStorage.getItem("weicon_brut_sabit_maas")) || 0;
    var girilen = prompt("Yeni brüt sabit maaşı gir:", mevcut ? mevcut.toString().replace(".", ",") : "");
    if(girilen == null) return;
    var v = tutarParse_NM(girilen);
    if(v <= 0){ alert("Geçerli bir tutar gir."); return; }
    try{ AyarlarSync.brutSabitMaasKaydet(v); }catch(e){}
    localStorage.setItem("weicon_brut_sabit_maas", v);
    nmGorunumCiz();
  };

  document.getElementById("btnNmMatrahKalibreEt").onclick = function(){
    var acik = MaasKayitData.acikDonem();
    if(acik.ay === 1){ alert("Ocak'ta yeni vergi yılı başlar: birikmiş matrah sıfırdan başlar, kalibrasyon gerekmez."); return; }
    var onceki = MaasOrtakHesap.oncekiAyHesapla(acik.ay, acik.yil);
    var mevcut = MaasOrtakHesap.matrahBazOku();
    var girilen = prompt(
      "Gerçek bordrondaki \"" + AY_ADLARI_NM[onceki.ay] + " " + onceki.yil + "\" dönemine ait \"Önceki Ay Matrah\" + o ayın kendi vergi matrahı toplamını (bordroda \"Yıl İçi Toplam\" olarak da geçebilir) gir — yani " + AY_ADLARI_NM[onceki.ay] + " " + onceki.yil + " SONU itibariyle kümülatif vergi matrahı:",
      mevcut && mevcut.matrah ? mevcut.matrah.toString().replace(".", ",") : ""
    );
    if(girilen == null) return;
    var v = tutarParse_NM(girilen);
    if(v <= 0){ alert("Geçerli bir tutar gir."); return; }
    var baz = {matrah: v, ay: onceki.ay, yil: onceki.yil};
    try{ AyarlarSync.matrahBazKaydet(baz); }catch(e){}
    localStorage.setItem("weicon_matrah_baz", JSON.stringify(baz));
    nmGorunumCiz();
  };

  try{ KomisyonDonemData.degistiginde(function(){ nmGorunumCiz(); }); }catch(e){}
  try{ MaasKayitData.degistiginde(function(){ nmGorunumCiz(); }); }catch(e){}
});
