/*
  tip-etiketleri.js — TKP.08.11.26-13:14.1505
  ============================================
  BELGE / DURUM TÜRÜ KISALTMALARI — TEK KAYNAK (08.11.2026, Abdullah onayı):
  "Programdaki kısaltmalar: Sipariş SİP, Fiyat teklifi F.TEK, Proforma fatura
  P.FAT, Numune NUM, Bekleyen Bakiye B.BAK, Bekleyen Stok B.STK — tablo, liste,
  her yerde, istisnasız."

  Bir kısaltmayı değiştirmek için SADECE aşağıdaki KISA tablosunu değiştir —
  bütün sayfalar kendiliğinden güncellenir. Eskiden her dosyada ayrı ayrı
  TIP_ETIKET haritaları vardı; hepsi artık TipEtiket.kisa'yı kullanır.

  - TipEtiket.kisa[tip]  : ekranda görünen kısa etiket (düğme, panel, tablo,
                           liste satırı, filtre çipi).
  - TipEtiket.uzun[tip]  : tam ad. SADECE cümle içinde geçtiği yerlerde
                           ("… bir Fiyat Teklifi bulundu") ve müşteriye giden
                           çıktılarda (mail/WhatsApp metni, PDF) kullanılır —
                           müşteri "F.TEK"i anlamayabilir.
  - tip anahtarları: siparis, teklif, proforma, numune, bakiye (Bekleyen
                     Bakiye), stok (Bekleyen Stok).
  - HTML'de sabit metin: öğeye data-tip-kisa="siparis" yaz; sayfa açılınca
    metni buradan doldurulur (TipEtiket.uygula(kok) ile sonradan eklenenler de).
  - 08.11.2026 (Abdullah): "Ne için ürün arıyorsun?" tür seçicilerinde KISA
    kod yok, BÜYÜK HARF tam ad var (SİPARİŞ, FİYAT TEKLİFİ…): data-tip-tam="teklif"
    veya TipEtiket.buyukAl(tip). "Kısa kodlar sadece listelerde."
  - İSKONTO (08.11.2026): bu dosyada değil, Hesapla penceresi etiketlerinde.
*/
var TipEtiket = (function(){
  var KISA = {
    siparis:  "SİP",
    teklif:   "F.TEK",
    proforma: "P.FAT",
    numune:   "NUM",
    bakiye:   "B.BAK",
    stok:     "B.STK"
  };
  var UZUN = {
    siparis:  "Sipariş",
    teklif:   "Fiyat Teklifi",
    proforma: "Proforma Fatura",
    numune:   "Numune",
    bakiye:   "Bekleyen Bakiye",
    stok:     "Bekleyen Stok"
  };

  function kisaAl(tip){ return KISA[tip] || ""; }
  function uzunAl(tip){ return UZUN[tip] || ""; }
  // Tam ad, BÜYÜK HARF (Türkçe İ/I kurallı): "FİYAT TEKLİFİ", "SİPARİŞ".
  function buyukAl(tip){ return (UZUN[tip] || "").toLocaleUpperCase("tr-TR"); }

  // [data-tip-kisa] öğelerinin metnini kısaltmayla, [data-tip-tam] öğelerinin
  // metnini BÜYÜK HARF tam adla doldurur (kok verilmezse tüm sayfa).
  function uygula(kok){
    try{
      var liste = (kok || document).querySelectorAll("[data-tip-kisa]");
      for(var i=0;i<liste.length;i++){
        var k = KISA[liste[i].getAttribute("data-tip-kisa")];
        if(k) liste[i].textContent = k;
      }
      var tam = (kok || document).querySelectorAll("[data-tip-tam]");
      for(var j=0;j<tam.length;j++){
        var t = buyukAl(tam[j].getAttribute("data-tip-tam"));
        if(t) tam[j].textContent = t;
      }
    }catch(e){}
  }
  try{
    if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", function(){ uygula(); });
    else uygula();
  }catch(e){}

  return { kisa: KISA, uzun: UZUN, kisaAl: kisaAl, uzunAl: uzunAl, buyukAl: buyukAl, uygula: uygula };
})();
