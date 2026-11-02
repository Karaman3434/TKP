/*
  maas-ortak-hesap.js — VERSİYON: TKP.02.11.26-16:36.1414
  ======================================================
  27.09.2026 mimari bölünmesi: Maaş Hesaplama tek sayfaydı, artık üç
  bağımsız sayfaya bölündü (Brüt Maaş→Net Maaş / Ödenebilir Komisyon'daki
  Brüt Prim→Net Prim / Maaş Hesaplama özet). Hesaplama KURALLARI hiç
  değişmedi (maas-hesaplama-data.js'e dokunulmadı) — ama o dosyadaki
  ayHesapla() fonksiyonu PRİM ve SABİT MAAŞ'ı TEK bir paylaşılan kümülatif
  vergi matrahı üzerinden hesaplıyor (PRİM istisnasız önce eklenir, SABİT
  MAAŞ istisnalı sonra eklenir). Bu yüzden Net Maaş'ı doğru hesaplamak için
  o ayın Brüt Prim'ini de bilmek gerekiyor — iki sayfa birbirinden habersiz
  ayrı ayrı hesaplarsa rakamlar TUTARSIZ çıkar.

  Bu modül, o paylaşılan girdi hazırlama + hesaplama mantığını TEK yerde
  toplar. Hem net-maas-hesaplama-render.js (Net Maaş sayfası) hem
  odenebilir-komisyon-render.js (Brüt/Net Prim bölümü) hem de
  maas-hesaplama-render.js (özet sayfası) AYNI MaasOrtakHesap.hesapla()
  çağrısını kullanır — sonuç nesnesi aynıdır, her sayfa sadece kendi
  ilgilendiği alanı (netSabitMaas veya netPrim) ekrana yazar.

  27.09.2026 (revize) — Brüt Prim artık eski "güncel komisyon toplamı −
  referans nokta" zincirinden DEĞİL, doğrudan KomisyonDonemData'daki
  "1. Fotoğraf" ve "2. Fotoğraf" toplamları arasındaki farktan hesaplanır.
  İkisi de AYNI açık dönem için tutulduğundan ay karışıklığı yapısal
  olarak imkansız — eski "referans/güncel ay uyumsuzluğu" riski ortadan
  kalktı.
*/

var MaasOrtakHesap = (function(){

  function aylarToplamiHesapla(aylar){
    var toplam = 0;
    for(var ay=1; ay<=12; ay++) toplam += parseFloat(aylar && aylar[ay]) || 0;
    return toplam;
  }

  function brutPrimDizisiOlustur(acikAy, acikYil, acikBrutPrim){
    var dizi = {};
    try{
      MaasKayitData.tumKayitlar().forEach(function(k){
        if(k.yil === acikYil) dizi[k.ay] = k.brutPrim || 0;
      });
    }catch(e){}
    dizi[acikAy] = acikBrutPrim;
    return dizi;
  }

  function matrahBazOku(){
    try{ return JSON.parse(localStorage.getItem("weicon_matrah_baz")||"null"); }catch(e){ return null; }
  }
  function oncekiAyHesapla(ay, yil){
    var oncekiAy = ay - 1, oncekiYil = yil;
    if(oncekiAy < 1){ oncekiAy = 12; oncekiYil -= 1; }
    return {ay:oncekiAy, yil:oncekiYil};
  }
  function matrahOnceOverride(acikAy, acikYil){
    var baz = matrahBazOku();
    if(!baz) return null;
    var onceki = oncekiAyHesapla(acikAy, acikYil);
    if(baz.ay === onceki.ay && baz.yil === onceki.yil) return baz.matrah;
    return null;
  }

  function brutSabitOku(){
    return parseFloat(localStorage.getItem("weicon_brut_sabit_maas")) || 0;
  }

  // 1. Fotoğraf ve 2. Fotoğraf'ın (KomisyonDonemData) toplamlarını okur.
  // İkisi de yüklenmemişse tamMi=false döner (Brüt Prim henüz hesaplanamaz).
  function komisyonDonemToplamlariOku(){
    try{
      var d = KomisyonDonemData.gecerliDonem();
      if(!d || !d.birinci || !d.ikinci) return {birinciToplam:0, ikinciToplam:0, tamMi:false};
      return {
        birinciToplam: aylarToplamiHesapla(d.birinci.aylar),
        ikinciToplam: aylarToplamiHesapla(d.ikinci.aylar),
        tamMi: true
      };
    }catch(e){ return {birinciToplam:0, ikinciToplam:0, tamMi:false}; }
  }

  // Açık/canlı dönem için TAM hesaplama — Net Maaş sayfası, Ödenebilir
  // Komisyon'un Brüt/Net Prim bölümü ve Maaş Hesaplama özeti hepsi bunu
  // çağırır, hepsi AYNI sonuç nesnesinden kendi ilgili alanını okur.
  function hesapla(acikAy, acikYil){
    var brutSabit = brutSabitOku();
    var k = komisyonDonemToplamlariOku();
    var brutPrimHam = k.ikinciToplam - k.birinciToplam;
    // Ekstra prim (02.11.2026): elle girilen satırlar fotoğraf farkına EKLENİR;
    // fotoğraflar eksik olsa bile ekstra prim hesaba girer.
    var ekstraPrim = 0;
    try{ ekstraPrim = KomisyonDonemData.ekstraToplam(); }catch(e){ ekstraPrim = 0; }
    var fotoBrutPrim = k.tamMi ? Math.max(0, brutPrimHam) : 0;
    var brutPrim = fotoBrutPrim + ekstraPrim;
    var primDizisi = brutPrimDizisiOlustur(acikAy, acikYil, brutPrim);
    var matrahOverride = matrahOnceOverride(acikAy, acikYil);
    var sonuc = MaasHesaplamaData.ayHesapla(acikAy, brutSabit, primDizisi, matrahOverride);
    return {
      ay: acikAy, yil: acikYil,
      brutSabit: brutSabit,
      birinciToplam: k.birinciToplam,
      ikinciToplam: k.ikinciToplam,
      komisyonTamMi: k.tamMi,
      brutPrimHam: brutPrimHam,
      fotoBrutPrim: fotoBrutPrim,
      ekstraPrim: ekstraPrim,
      brutPrim: brutPrim,
      matrahOverride: matrahOverride,
      sonuc: sonuc
    };
  }

  return {
    hesapla: hesapla,
    oncekiAyHesapla: oncekiAyHesapla,
    matrahBazOku: matrahBazOku
  };

})();
