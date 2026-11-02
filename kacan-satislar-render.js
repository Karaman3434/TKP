/* kacan-satislar-render.js — TKP.02.11.26-13:55.1400
   KAÇAN SATIŞLAR artık ORTAK İŞLEM LİSTESİ'ni (islem-liste.js) kullanıyor
   (02.11.2026, Abdullah onayı). VERİ TAVANI: yalnızca "kaçan" işaretli
   kayıtlar (tüm türler) — bu sayfanın izin anahtarı "raporlar" (auth.js).
   Eski "Yeni → Eski ⇅" düğmesi artık filtre penceresindeki SIRALAMA
   seçeneği. */
document.addEventListener("DOMContentLoaded", function(){
  IslemListesi.baslat({
    taban: {durum: "kacan"},
    hazir: [{id:"son", etiket:"Tümü"}, "bugun", "bu_ay", "bu_yil"],
    baslangicHazir: "son",
    siralama: true,
    bosMesaj: "Hiç kaçan işaretli kayıt yok."
  });
});
