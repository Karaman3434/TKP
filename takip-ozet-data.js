/*
  takip-ozet-data.js — TKP.10.11.26-18:04.1558
  ========================================
  "ZİYARET VE ÖDEME TAKİP" ortak hesapları — TEK KAYNAK.
  - Ziyaret bekleyenler: son aktivitesi (ziyaret VEYA işlemden hangisi
    yeniyse) 30 günden eski olan ya da hiç aktivitesi olmayan müşteriler.
    Takip Gerekenler sayfası da bu fonksiyonları kullanır (aynı kural).
  - Ödeme: vadesi geçmiş ödenmemiş faturası olan müşteri sayısı + en uzun gecikme
    (VadeTakip.musteriGruplari() ile aynı müşteri bazlı gruplama).
  Gerekli: CustomerData (zorunlu), ReportsData ve VadeTakip (yoksa o kısım 0 döner).
*/
var TakipOzet = (function(){
  var ZIYARET_ESIK_GUN = 30;

  function sonIslemHaritasi(){
    var harita = {};
    try{
      if(typeof ReportsData !== "undefined"){
        ReportsData.sonIslemler().forEach(function(k){
          if(!k.musteriId) return;
          if(!harita[k.musteriId] || k.ts > harita[k.musteriId]) harita[k.musteriId] = k.ts;
        });
      }
    }catch(e){}
    return harita;
  }

  // haritam verilirse tekrar hesaplanmaz (liste döngülerinde).
  function sonAktiviteZamani(m, harita){
    var h = harita || sonIslemHaritasi();
    var sonIslem = m.id ? h[m.id] : null;
    return Math.max(m.sonZiyaret||0, sonIslem||0);
  }

  function ziyaretBekleyenler(){
    var harita = sonIslemHaritasi();
    var esikMs = ZIYARET_ESIK_GUN*86400000;
    return CustomerData.ara("").filter(function(m){
      var z = sonAktiviteZamani(m, harita);
      return z === 0 || (Date.now()-z) > esikMs;
    });
  }

  function odemeOzeti(){
    var sonuc = {musteriSayisi:0, enUzunGun:0};
    try{
      if(typeof VadeTakip === "undefined" || typeof ReportsData === "undefined") return sonuc;
      VadeTakip.musteriGruplari().forEach(function(grup){
        grup.musteriler.forEach(function(g){
          if(g.maxFark > 0){
            sonuc.musteriSayisi++;
            if(g.maxFark > sonuc.enUzunGun) sonuc.enUzunGun = g.maxFark;
          }
        });
      });
    }catch(e){}
    return sonuc;
  }

  return {
    ZIYARET_ESIK_GUN: ZIYARET_ESIK_GUN,
    sonIslemHaritasi: sonIslemHaritasi,
    sonAktiviteZamani: sonAktiviteZamani,
    ziyaretBekleyenler: ziyaretBekleyenler,
    odemeOzeti: odemeOzeti
  };
})();
