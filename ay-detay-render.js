/* ay-detay-render.js — TKP.11.11.26-11:18.1564
   AY DETAY artık ORTAK İŞLEM LİSTESİ'ni (islem-liste.js) kullanıyor
   (02.11.2026, Abdullah onayı). Gösterilen ay, İstatistikler'den
   "weiconv2_goruntulenen_ay" ile gelir (eskisi gibi).
   VERİ TAVANI: yalnızca SİPARİŞ + SADECE o ay (tarih düğmesi yok, kilitli) —
   bu sayfanın izin anahtarı "maasHesaplama" (auth.js); filtreyle başka
   aya/türe çıkılamaz. Ay eşlemesi İstatistikler'deki aylık toplamla (ayToplami)
   birebir aynı yöntemle yapılır (kaydın "tarih" metni).
   "Stok Bekleyen siparişleri dahil et" anahtarı (kalıcı kural: varsayılan
   hiçbir toplama girmez) filtre penceresinde; ay toplamı da orada ("SİPARİŞ
   TOPLAMI" şeridi pencerenin özet satırına taşındı). */
document.addEventListener("DOMContentLoaded", function(){
  // Geri (‹): ortak Nav yönetiyor (11.11.2026).
  var ayVerisi = null;
  try{ ayVerisi = JSON.parse(localStorage.getItem("weiconv2_goruntulenen_ay") || "null"); }catch(e){}
  if(!ayVerisi){
    alert("Gösterilecek ay bulunamadı, İstatistikler sayfasına dönülüyor.");
    window.location.href = "reports.html";
    return;
  }
  var baslik = document.getElementById("ayDetayBaslik");
  if(baslik) baslik.textContent = "📅 " + ayVerisi.ayAd + " " + ayVerisi.yil + " Kayıtları";
  IslemListesi.baslat({
    taban: {tip: "siparis", ayAd: ayVerisi.ayAd, yil: ayVerisi.yil},
    tarihKilitli: true,
    hazir: [],
    beklemedeToggle: true,
    beklemedeAnahtar: "weiconv2_beklemede_dahil_et",
    bosMesaj: "Bu ayda sipariş kaydı yok."
  });
});
