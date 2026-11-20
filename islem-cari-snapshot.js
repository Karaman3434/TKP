/*
 * İşlem bazlı Cari Bilgi Snapshot yardımcıları.
 * Test dalı: işlem kayıtlarında müşteri bilgilerini bağımsız kopyaya dönüştürür.
 * send-data.js üzerinden yeni işlem kaydına bağlanır; canlı veri bu test dalında değiştirilmez.
 */
var IslemCariSnapshot = (function(){
  "use strict";
  var ZORUNLU = ["musteriKodu","musteriAdi","vade","fatura","kargo","faturaAdresi"];
  function temiz(v){ if(v && typeof v==="object" && v.adres!=null) v=v.adres; return v == null ? "" : String(v).trim(); }
  function kopyala(v){ return v == null ? null : JSON.parse(JSON.stringify(v)); }
  function olustur(alanlar){
    alanlar = alanlar || {};
    var snapshot = {schemaVersion:1,capturedAt:Number(alanlar.capturedAt)||Date.now(),musteriKodu:temiz(alanlar.musteriKodu),musteriAdi:temiz(alanlar.musteriAdi),ilce:temiz(alanlar.ilce),sehir:temiz(alanlar.sehir),vade:temiz(alanlar.vade),fatura:temiz(alanlar.fatura),kargo:temiz(alanlar.kargo),faturaAdresi:temiz(alanlar.faturaAdresi),teslimatAdresi:temiz(alanlar.teslimatAdresi),yetkililer:Array.isArray(alanlar.yetkililer)?kopyala(alanlar.yetkililer):[],not:temiz(alanlar.not)};
    var eksik=ZORUNLU.filter(function(k){return !snapshot[k];});return {snapshot:snapshot,eksik:eksik,gecerli:eksik.length===0};
  }
  // Master alanları ve açık seçimleri eşler; send-data.js yeni işlem snapshot'ı için kullanır.
  function musteridenOlustur(m,secilen,ek){
    if(!m)return olustur({});secilen=secilen||{};ek=ek||{};
    return olustur({musteriKodu:m.id,musteriAdi:m.ad,ilce:m.sehir,sehir:m.il,vade:m.vade,fatura:m.fatura,kargo:m.kargo,faturaAdresi:secilen.faturaAdresi||m.acikAdres||"",teslimatAdresi:ek.teslimatSecildi?(secilen.teslimatAdresi||""):"",yetkililer:ek.yetkililerSecildi&&Array.isArray(secilen.yetkililer)?secilen.yetkililer:[],not:ek.notSecildi?ek.not:""});
  }
  function kayittanOku(kayit){return kayit&&kayit.transactionCustomerInfo?kopyala(kayit.transactionCustomerInfo):null;}
  return {olustur:olustur,musteridenOlustur:musteridenOlustur,kayittanOku:kayittanOku,zorunluAlanlar:ZORUNLU.slice()};
})();
