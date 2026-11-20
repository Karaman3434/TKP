/*
 * İşlem bazlı Cari Bilgi Snapshot yardımcıları.
 * Bu modül henüz kayıt akışlarına bağlanmamıştır. Test dalında geliştirme
 * aşamasındadır; canlı veriye veya eski arşiv kayıtlarına müdahale etmez.
 *
 * Tasarım: işlem kaydı için müşteri bilgisinin bağımsız, JSON uyumlu kopyasını
 * üretmek. Kaynak master kayıt daha sonra değişse bile snapshot değişmez.
 */
var IslemCariSnapshot = (function(){
  "use strict";
  var ZORUNLU = ["musteriKodu","musteriAdi","ilce","sehir","vade","fatura","kargo","faturaAdresi"];
  function temiz(v){ return v == null ? "" : String(v).trim(); }
  function kopyala(v){
    if(v == null) return null;
    return JSON.parse(JSON.stringify(v));
  }
  // Alan eşlemesi uygulama entegrasyonunda açıkça verilmelidir; master kayıt
  // alan isimlerini varsayarak/otomatik tahmin ederek veri yazılmaz.
  function olustur(alanlar){
    alanlar = alanlar || {};
    var snapshot = {
      schemaVersion: 1,
      capturedAt: Number(alanlar.capturedAt) || Date.now(),
      musteriKodu: temiz(alanlar.musteriKodu),
      musteriAdi: temiz(alanlar.musteriAdi),
      ilce: temiz(alanlar.ilce),
      sehir: temiz(alanlar.sehir),
      vade: temiz(alanlar.vade),
      fatura: temiz(alanlar.fatura),
      kargo: temiz(alanlar.kargo),
      faturaAdresi: temiz(alanlar.faturaAdresi),
      teslimatAdresi: temiz(alanlar.teslimatAdresi),
      yetkililer: Array.isArray(alanlar.yetkililer) ? kopyala(alanlar.yetkililer) : [],
      not: temiz(alanlar.not)
    };
    var eksik = ZORUNLU.filter(function(k){ return !snapshot[k]; });
    return {snapshot:snapshot, eksik:eksik, gecerli:eksik.length===0};
  }
  // Snapshot varsa aynen kullan; yoksa legacy kaydı değiştirmeden null döndür.
  function kayittanOku(kayit){
    return kayit && kayit.transactionCustomerInfo ? kopyala(kayit.transactionCustomerInfo) : null;
  }
  return {olustur:olustur, kayittanOku:kayittanOku, zorunluAlanlar:ZORUNLU.slice()};
})();
