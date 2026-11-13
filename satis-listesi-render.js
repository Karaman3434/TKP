/* satis-listesi-render.js — TKP.13.11.26-08:45.1588
   BUGÜNÜN / BU AYIN SATIŞLARI artık ORTAK İŞLEM LİSTESİ'ni (islem-liste.js)
   kullanıyor (02.11.2026, Abdullah onayı). Eski ?kapsam=bugun|ay adresi
   aynen çalışır: sadece hangi hazır tuşun (Bugün / Bu Ay) açılışta seçili
   olacağını belirler.
   VERİ TAVANI: yalnızca SİPARİŞ — bu sayfanın izin anahtarı "satisListesi"
   (auth.js); kullanıcı filtreyle sipariş dışına (teklif/numune) çıkamaz.
   "Stok bekleyen" siparişler artık eskisi gibi ayrı blokta değil, satır
   içinde bej "Stok Bekliyor" olarak görünür; toplamlara dahil DEĞİLDİR
   (kalıcı kural, değişmedi). */
document.addEventListener("DOMContentLoaded", function(){
  var params = new URLSearchParams(window.location.search);
  var kapsam = params.get("kapsam") === "ay" ? "ay" : "bugun";
  // 13.11.2026 (Abdullah): ana sayfada "<Ay> primi" toplamına dokunulunca ?kapsam=ay&prim=1 —
  // liste İÇİNDE BULUNULAN AYIN sadece primli siparişleriyle açılır (ay otomatik: "Bu Ay" hazır tuşu).
  var primli = kapsam === "ay" && params.get("prim") === "1";
  var baslik = document.getElementById("rotaBaslik");
  if(baslik) baslik.textContent = primli ? "Bu Ayın Primli Satışları" : (kapsam === "ay" ? "Bu Ayın Satışları" : "Bugünün Satışları");
  IslemListesi.baslat({
    taban: {tip: "siparis"},
    hazir: [{id:"son", etiket:"Tümü"}, "bugun", "bu_ay", "bu_yil", "bekleyen"],
    baslangicHazir: kapsam === "ay" ? "bu_ay" : "bugun",
    primFiltresi: true,
    primSatiriGoster: true,
    baslangicPrimli: primli,
    bosMesaj: primli ? "Bu ay primli satış yok." : "Bu kapsamda satış kaydı yok."
  });
});
