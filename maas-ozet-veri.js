/*
  maas-ozet-veri.js — TKP.02.11.26-15:02.1408
  ===================================================
  DOM'a HİÇ dokunmayan, sadece "açık dönem"in HESABA YATACAK tutarını
  hesaplayan paylaşılan modül. Ana Sayfa'daki (Kişisel) özet kutucuk bunu
  kullanır.

  27.09.2026 revize: Brüt Prim/Net Maaş/Net Prim hesabı artık DOĞRUDAN
  maas-ortak-hesap.js'teki MaasOrtakHesap.hesapla() üzerinden gelir — Net
  Maaş sayfası, Ödenebilir Komisyon'un Brüt/Net Prim bölümü ve Maaş
  Hesaplama özeti de AYNI çağrıyı yapıyor, bu yüzden bu kutucuktaki rakam
  da onlarla her zaman tutarlı kalır (ayrı bir hesaplama kopyası tutmuyor).

  Bağımlılıklar (bu dosyadan ÖNCE yüklenmiş olmalı): KomisyonDonemData,
  AvansKayitData, MaasKayitData, MaasHesaplamaData, MaasOrtakHesap.
*/

var MaasOzetVeri = (function(){

  function avansToplamiOku(ay, yil){
    var kapali = null;
    try{ kapali = AvansKayitData.kapaliKaydiBul(ay, yil); }catch(e){}
    var veri;
    if(kapali){
      veri = kapali;
    } else {
      try{ veri = AvansKayitData.taslakOku(ay, yil); }catch(e){ veri = {ozelAvansGirisleri:[], isAvansiGirisleri:[], isAvansiHarcamalar:[]}; }
    }
    var ozelToplam = (veri.ozelAvansGirisleri||[]).reduce(function(s,x){ return s+(x.tutar||0); }, 0);
    var isToplam = (veri.isAvansiGirisleri||[]).reduce(function(s,x){ return s+(x.tutar||0); }, 0);
    var belgelenenToplam = (veri.isAvansiHarcamalar||[]).reduce(function(s,x){ return s+(x.tutar||0); }, 0);
    var isKesilecek = Math.max(0, isToplam - belgelenenToplam);
    return ozelToplam + isKesilecek;
  }

  // Şu an açık (henüz kapatılmamış) dönem için canlı hesap — Maaş
  // Hesaplama sayfasındaki "HESABA YATACAK MAAŞ" kutusuyla birebir aynı sonuç.
  function acikDonemHesapla(){
    var acik = MaasKayitData.acikDonem();
    var h = MaasOrtakHesap.hesapla(acik.ay, acik.yil);
    // Ana Sayfa kutucuğu Maaş Hesaplama ile AYNI avans kesintisini gösterir
    // (02.11.2026: "Maaşa Ekle" ile eklenen avanslar dahil — tek kaynak:
    // AvansKayitData.maasKesintisi). Eski hesap yalnızca yedek.
    var avansToplam;
    try{ avansToplam = AvansKayitData.maasKesintisi(acik.ay, acik.yil).toplam; }
    catch(e){ avansToplam = avansToplamiOku(acik.ay, acik.yil); }
    var hesabaYatacak = h.sonuc.netToplam - avansToplam;
    return {ay: acik.ay, yil: acik.yil, hesabaYatacak: hesabaYatacak};
  }

  return {
    acikDonemHesapla: acikDonemHesapla
  };

})();
