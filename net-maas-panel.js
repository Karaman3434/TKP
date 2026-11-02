/*
  net-maas-panel.js — VERSİYON: TKP.02.11.26-21:05.1449
  =====================================================
  NET MAAŞ AÇILIR PANELİ (02.11.2026, Abdullah onayı — mockup üzerinden).
  Eski ayrı "Brüt Maaş → Net Maaş" sayfasının (net-maas-hesaplama.html)
  tüm işlevi artık Maaş Hesaplama'daki "💵 NET MAAŞ" satırının altında
  sayfa içinde açılır: Brüt Sabit Maaş (✏️ Güncelle), kesinti oranı, net
  maaş ve Vergi Matrahı Kalibrasyonu (🎯 Kalibre Et).

  Hesaplama kuralları DEĞİŞMEDİ: tek kaynak MaasOrtakHesap.hesapla()
  (bkz. maas-ortak-hesap.js). Bu dosya sadece gösterir/girdi alır.

  Kullanım (maas-hesaplama-render.js içinden):
    NetMaasPanel.ciz(null)      → açık/canlı dönem (düzenlenebilir)
    NetMaasPanel.ciz(kayit)     → kapanmış dönem kaydı (salt okunur)

  ERİŞİM İZNİ: Satır SADECE "netMaasHesaplama" izni olan hesaplarda açılır
  (eskiden ayrı sayfa bu izne bağlıydı; kısıtlı çalışan için gevşetilmedi).
*/
var NetMaasPanel = (function(){

  var AY = ["","Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

  function fmtTL(n){
    return (n||0).toLocaleString("tr-TR", {minimumFractionDigits:2, maximumFractionDigits:2}) + " TL";
  }
  function tutarParse(s){
    s = (s||"").toString().trim();
    if(!s) return 0;
    s = s.replace(/\./g, "").replace(",", ".");
    var v = parseFloat(s);
    return isNaN(v) ? 0 : v;
  }
  function fmtOran(brut, net){
    if(!brut) return "%0,00 kesinti";
    var oran = (brut-net)/brut*100;
    return "%" + oran.toLocaleString("tr-TR", {minimumFractionDigits:2, maximumFractionDigits:2}) + " kesinti";
  }
  function el(id){ return document.getElementById(id); }

  function izinVarMi(){
    try{ return typeof window.izinVarMi !== "function" || window.izinVarMi("netMaasHesaplama"); }
    catch(e){ return false; }
  }

  function duzenlemeGorunurlugu(gorunurMu){
    var b1 = el("btnNmBrutSabitGuncelle"), b2 = el("btnNmMatrahKalibreEt");
    if(b1) b1.hidden = !gorunurMu;
    if(b2) b2.hidden = !gorunurMu;
  }

  function ciz(kapaliKayit){
    if(!el("mhNetPanel")) return;
    if(kapaliKayit){
      duzenlemeGorunurlugu(false);
      el("nmBrutSabitDeger").textContent = fmtTL(kapaliKayit.brutSabitAylik);
      el("nmMaasKesintiOran").textContent = fmtOran(kapaliKayit.brutSabitAylik, kapaliKayit.netSabitMaas);
      el("nmNetMaasDeger").textContent = fmtTL(kapaliKayit.netSabitMaas);
      el("nmMatrahDurum").textContent = "Kapanmış dönem — kalibrasyon bu görünümde değiştirilemez.";
      return;
    }
    duzenlemeGorunurlugu(true);
    var acik = MaasKayitData.acikDonem();
    var h = MaasOrtakHesap.hesapla(acik.ay, acik.yil);
    el("nmBrutSabitDeger").textContent = fmtTL(h.brutSabit);
    el("nmMaasKesintiOran").textContent = fmtOran(h.sonuc.brutSabitAylik, h.sonuc.netSabitMaas);
    el("nmNetMaasDeger").textContent = fmtTL(h.sonuc.netSabitMaas);

    var onceki = MaasOrtakHesap.oncekiAyHesapla(acik.ay, acik.yil);
    var metin = h.matrahOverride!=null
      ? "✓ Kalibre edildi (" + AY[onceki.ay] + " " + onceki.yil + " sonu itibariyle: " + fmtTL(h.matrahOverride) + ")"
      : (acik.ay === 1
        ? "Yeni vergi yılı — birikmiş matrah Ocak'ta sıfırdan başlar, kalibrasyon gerekmez."
        : "Kalibrasyon yok — Ocak'tan tahmini hesaplanıyor. Bordrondaki \"Önceki Ay Matrah\" rakamını girerek doğruluğu artırabilirsin.");
    if(h.sonuc && h.sonuc.parametreTanimliMi === false){
      metin += " ⚠️ " + acik.yil + " vergi dilimleri / asgari ücret henüz tanımlı değil — " + h.sonuc.parametreYili + " değerleri kullanılıyor.";
    }
    el("nmMatrahDurum").textContent = metin;
  }

  function yenidenCiz(){
    try{ if(typeof mhGorunumCiz === "function") mhGorunumCiz(); }catch(e){}
  }

  function satirDurumunuGuncelle(){
    var satir = el("mhNetMaasSatiri"), ok = el("mhNetMaasOk");
    if(!satir) return;
    var izinli = izinVarMi();
    satir.classList.toggle("mh-ozet-satir--kilitli", !izinli);
    if(ok) ok.hidden = !izinli;
    if(!izinli){
      satir.setAttribute("aria-expanded", "false");
      var panel = el("mhNetPanel"); if(panel) panel.hidden = true;
    }
  }

  function ac(acikMi){
    var satir = el("mhNetMaasSatiri"), panel = el("mhNetPanel");
    if(!satir || !panel) return;
    if(acikMi && !izinVarMi()) return;
    satir.setAttribute("aria-expanded", acikMi ? "true" : "false");
    panel.hidden = !acikMi;
  }

  function baglan(){
    var satir = el("mhNetMaasSatiri");
    if(!satir) return;
    function degistir(){ ac(satir.getAttribute("aria-expanded") !== "true"); }
    satir.addEventListener("click", degistir);
    satir.addEventListener("keydown", function(ev){
      if(ev.key === "Enter" || ev.key === " "){ ev.preventDefault(); degistir(); }
    });
    window.addEventListener("istakipAuthHazir", satirDurumunuGuncelle);
    satirDurumunuGuncelle();

    el("btnNmBrutSabitGuncelle").onclick = function(){
      if(!izinVarMi()) return;
      var mevcut = parseFloat(localStorage.getItem("weicon_brut_sabit_maas")) || 0;
      var girilen = prompt("Yeni brüt sabit maaşı gir:", mevcut ? mevcut.toString().replace(".", ",") : "");
      if(girilen == null) return;
      var v = tutarParse(girilen);
      if(v <= 0){ alert("Geçerli bir tutar gir."); return; }
      try{ AyarlarSync.brutSabitMaasKaydet(v); }catch(e){}
      localStorage.setItem("weicon_brut_sabit_maas", v);
      yenidenCiz();
    };

    el("btnNmMatrahKalibreEt").onclick = function(){
      if(!izinVarMi()) return;
      var acik = MaasKayitData.acikDonem();
      if(acik.ay === 1){ alert("Ocak'ta yeni vergi yılı başlar: birikmiş matrah sıfırdan başlar, kalibrasyon gerekmez."); return; }
      var onceki = MaasOrtakHesap.oncekiAyHesapla(acik.ay, acik.yil);
      var mevcut = MaasOrtakHesap.matrahBazOku();
      var girilen = prompt(
        "Gerçek bordrondaki \"" + AY[onceki.ay] + " " + onceki.yil + "\" dönemine ait \"Önceki Ay Matrah\" + o ayın kendi vergi matrahı toplamını (bordroda \"Yıl İçi Toplam\" olarak da geçebilir) gir — yani " + AY[onceki.ay] + " " + onceki.yil + " SONU itibariyle kümülatif vergi matrahı:",
        mevcut && mevcut.matrah ? mevcut.matrah.toString().replace(".", ",") : ""
      );
      if(girilen == null) return;
      var v = tutarParse(girilen);
      if(v <= 0){ alert("Geçerli bir tutar gir."); return; }
      var baz = {matrah: v, ay: onceki.ay, yil: onceki.yil};
      try{ AyarlarSync.matrahBazKaydet(baz); }catch(e){}
      localStorage.setItem("weicon_matrah_baz", JSON.stringify(baz));
      yenidenCiz();
    };
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", baglan);
  else baglan();

  return { ciz: ciz };
})();
