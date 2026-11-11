/*
  son-islemler-render.js — TKP.11.11.26-14:20.1566
  =======================
  SON İŞLEMLER artık ORTAK İŞLEM LİSTESİ'ni (islem-liste.js) kullanıyor
  (02.11.2026, Abdullah onayı — "tek tablo, tuş = hazır filtre" turu).
  Eskiden burada kendi satır/gün bandı/süzme/Excel kodu vardı; hepsi
  islem-liste.js + ReportsData.islemSorgula() içinde TEK yerde.
  VERİ TAVANI: yok (tüm işlem türleri) — bu sayfanın izin anahtarı
  "hareketler" (auth.js), sayfa erişimi aynen auth.js tarafından denetlenir.
  Listede en yeni 100 kayıt gösterilir (eski davranış). İsteğe bağlı
  "?musteriId=...&musteri=..." ile bir müşterinin kayıtlarıyla açılabilir.
  "islemlerExcelAktar" hiçbir yerden çağrılmıyordu (ölü kod) — kaldırıldı.
*/
document.addEventListener("DOMContentLoaded", function(){
  var p = new URLSearchParams(window.location.search);
  IslemListesi.baslat({
    taban: {},
    hazir: ["son","bugun","bu_ay","bu_yil","bekleyen"],   // "Kaçanlar" hazır tuşu → TÜR satırındaki KÇS (11.11.2026)
    baslangicHazir: "son",
    limit: 100,
    musteriId: p.get("musteriId") || "",
    musteriAd: p.get("musteri") || "",
    bosMesaj: "Henüz kayıt yok."
  });
});
