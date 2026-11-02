/* satis-listesi-render.js — TKP.02.11.26-13:55.1399
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
  var baslik = document.getElementById("rotaBaslik");
  if(baslik) baslik.textContent = kapsam === "ay" ? "Bu Ayın Satışları" : "Bugünün Satışları";
  IslemListesi.baslat({
    taban: {tip: "siparis"},
    hazir: [{id:"son", etiket:"Tümü"}, "bugun", "bu_ay", "bu_yil", "bekleyen"],
    baslangicHazir: kapsam === "ay" ? "bu_ay" : "bugun",
    bosMesaj: "Bu kapsamda satış kaydı yok."
  });
});
