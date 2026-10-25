/*
  hesapla-popup.js — WG.261026.0049.1035
  =======================================
  Birleşik Sayfa (cart.html) için Hızlı Hesapla'nın POPUP hâli — 02.10.2026,
  Abdullah'ın isteğiyle: "ürünün üzerine tıkladığımda popup gibi hesaplama
  sayfası açılır... birebir herşeyiyle hesapla sayfası olacak". Hesaplama
  mantığı (CartData.hesapla), alanlar, turuncu/toplam kutuları, kur seçimi,
  geçmiş alım ipucu ve bedelsiz/özel fiyat akışı calc-render.js'ten BİREBİR
  taşındı — tek fark: sayfa değiştirmek yerine #hpOverlay'i açıp kapatıyor,
  "Listeye Ekle" sonrası cart-render.js'teki sayfayiCiz()'i çağırıp aynı
  sayfada kalıyor (navigasyon YOK).

  04.10.2026 (Abdullah'ın isteğiyle, İKİNCİ büyük değişiklik) — artık BU
  DOSYA tek/ortak hesaplama bileşeni: calc.html (bağımsız, müşterisiz Hızlı
  Hesapla, "hesapla" izni) da AYNI #hpOverlay popup'ını ve BU dosyayı
  kullanıyor — calc-render.js'teki eski ayrı hesaplama kopyası tamamen
  kaldırıldı. İki sayfa hâlâ AYRI dosya/izin (calc.html="hesapla",
  cart.html="sepet") — sadece hesaplama ARACI ortak, sayfa/izin sınırı
  değişmedi. calc.html'de müşteri bağlamı HİÇBİR ZAMAN yok (o sayfa her
  zaman CustomerData seçimini temizleyerek açılıyor) — bu yüzden
  gecmisAlimIpucunuGuncelle() calc.html'de her zaman gizli kalır.

  "onEklendi" kancası (04.10.2026): "Listeye Ekle" tamamlandıktan sonra
  sayfaya özel bir davranış gerekebilir — cart.html bunu KULLANMIYOR
  (sayfayiCiz() zaten popup'ı kapatıp aynı sayfada tabloyu tazeliyor);
  calc.html kendi küçük betiğinde HesaplaPopup.onEklendi(fn) ile "sepete
  gidip devam etmek ister misin?" sorusunu bağlıyor.

  NOT: hataGoster / tarihiGuncelle / htmlEsc burada tanımlanmaz — hem
  cart-render.js hem de calc-render.js kendi sayfalarında bunları global
  olarak sağlıyor. sayfayiCiz() sadece cart-render.js'te tanımlı (typeof
  kontrolüyle çağrılıyor, calc.html'de no-op).
*/

var HesaplaPopup = (function(){

  // DÜZELTME (12.10.2026) — geçmiş alım ipucu artık sipariş dışında teklif/
  // proforma/numune de gösterebildiği için, hangi tür olduğunu kısaca
  // belirtmek için (TIP_ETIKET_BELGE ile aynı sözcükler, kısaltılmış).
  var TIP_ETIKET_KISA = {numune:"Numune", teklif:"Teklif", proforma:"Proforma", siparis:"Sipariş"};

  var seciliUrunBilgi = null;   // {ad, berta, abas, fiyat(=listeFiyat)}
  var duzenlenenIdx = null;     // null = yeni ürün, dolu = sepetteki idx düzenleniyor
  var kurOverride = null;       // sadece bu hesaplama için geçici kur
  var gecmisAlimKayitlari = null;
  var bekleyenListeyeEkleIskonto100 = false;
  var onEklendiCallback = null; // calc.html gibi sayfaların "Listeye Ekle" sonrası kanca bağlaması için

  function onEklendi(fn){
    onEklendiCallback = (typeof fn === "function") ? fn : null;
  }

  function dipFiyatiOner(){
    var liste = parseFloat(document.getElementById("hpListeFiyat").value)||0;
    document.getElementById("hpDipFiyat").value = CartData.dipFiyatOner(liste);
  }

  function kurDegeriniGoster(){
    var kur = (kurOverride!=null) ? kurOverride : (typeof aktifKuruOku==="function" ? aktifKuruOku() : CartData.kurOku());
    document.getElementById("hpKurDeger").textContent = CartData.fmt(kur) + (kurOverride!=null ? " ✏️" : "");
  }

  function gecmisAlimIpucunuGuncelle(bilgi){
    var kutu = document.getElementById("hpGecmisAlimIpucu");
    gecmisAlimKayitlari = null;
    try{
      if(typeof CustomerData === "undefined" || typeof ReportsData === "undefined"){ kutu.hidden = true; return; }
      var musteri = CustomerData.seciliyiOku();
      if(!musteri){ kutu.hidden = true; return; }
      var kayitlar = ReportsData.musteriUrunGecmisiKodaGore(musteri.ad, musteri.id, bilgi.berta, bilgi.abas);
      if(!kayitlar.length){ kutu.hidden = true; return; }
      gecmisAlimKayitlari = kayitlar;
      var son = kayitlar[0];
      // DÜZELTME (12.10.2026) — artık sipariş dışında teklif/proforma/numune
      // kayıtları da gelebildiği için, ipucunda hangi tür olduğu da
      // gösteriliyor (sipariş değilse "kesinleşmiş satış" ile karıştırılmasın).
      var sonTipEtiket = TIP_ETIKET_KISA[son.tip] || "";
      kutu.innerHTML = "🕓 Bu müşteriye en son: <b>" + (son.tarih||"-") + (sonTipEtiket ? " (" + sonTipEtiket + ")" : "") + " · %" + CartData.fmt(son.iskonto) + " isk. · " + CartData.fmt(son.netFiyat) + " EUR net · " + CartData.fmt(son.adet) + " adet</b>"
        + (kayitlar.length > 1 ? " — diğer kayıtlar için dokun" : "");
      kutu.hidden = false;
      otomatikKucultSatira(kutu);
    }catch(e){ kutu.hidden = true; }
  }

  // OTOMATİK KÜÇÜLTME (12.10.2026, Abdullah onayı — mockup üzerinden):
  // geçmiş alım ipucu metni %20 büyütüldü ama TEK SATIRDA kalması
  // gerekiyor (taşmasın/2. satıra düşmesin) — metin kutuya sığmazsa
  // yazı kademeli küçülüyor (aynı teknik send-render.js'te kullanılıyor).
  function otomatikKucultSatira(el){
    try{
      var boyut = 13.2;
      el.style.fontSize = boyut + "px";
      while(el.scrollWidth > el.clientWidth + 1 && boyut > 9){
        boyut -= 0.2;
        el.style.fontSize = boyut + "px";
      }
    }catch(e){}
  }

  function hesaplaVeGoster(){
    try{
      var listeFiyat = parseFloat(document.getElementById("hpListeFiyat").value)||0;
      var urun = {
        listeFiyat: listeFiyat,
        dipFiyat: parseFloat(document.getElementById("hpDipFiyat").value)||0,
        iskonto: parseFloat(document.getElementById("hpIskonto").value)||0,
        adet: parseFloat(document.getElementById("hpAdet").value)||1
      };
      var kur = (kurOverride!=null) ? kurOverride : (typeof aktifKuruOku==="function" ? aktifKuruOku() : CartData.kurOku());
      var kdv = CartData.kdvOku();
      var h = CartData.hesapla(urun, kur, kdv);

      document.getElementById("hpIskontoluFiyat").innerHTML = CartData.fmt(h.iskontoluFiyat) + "<span class='hc-turuncu-birim'>EURO</span>";
      document.getElementById("hpTlBirimFiyat").innerHTML = CartData.fmt(h.tlBirimFiyat) + "<span class='hc-turuncu-birim'> TL</span>";
      document.getElementById("hpToplamEuro").textContent = CartData.fmt(h.toplamEuro) + " EURO";
      document.getElementById("hpFaturaToplam").textContent = CartData.fmt(h.faturaToplam) + " TL";
      var kur2 = kur||0;
      var primTL = h.mudurPrim*kur2;
      var primKutu = document.getElementById("hpPrimTL");
      if(h.mudurPrim===0 && urun.iskonto>60){
        primKutu.innerHTML = "ÖZEL FİYAT";
      } else if(h.mudurPrim<0){
        primKutu.innerHTML = "Yok";
      } else {
        // 04.10.2026 (Abdullah'ın isteğiyle): Prim TL tutarının BAŞINDA
        // satış üzerinden kaç yüzde prim hakedildiğini de gösteriyoruz
        // (Prim TL ÷ Fatura Toplam × 100).
        var primYuzde = h.faturaToplam > 0 ? (primTL / h.faturaToplam * 100) : 0;
        primKutu.innerHTML = "<span class='hc-prim-yuzde'>% " + CartData.fmt(primYuzde) + "</span>" + CartData.fmt(primTL) + " TL";
      }

      // 04.10.2026 (Abdullah'ın isteğiyle): bu popup'ta ayrı bir "hesapla"
      // butonu yok — hesaplama her girişte otomatik/canlı çalışıyor. Bu
      // yüzden Listeye Ekle butonu geçerli bir sonuç olup olmamasına göre
      // turuncu ("bekliyor") / yeşil ("hazır") arasında geçiş yapıyor.
      // ETİKET SADELEŞTİRME (26.10.2026, Abdullah onayı — SEÇ butonunun
      // kaldırılmasıyla birlikte): "LİSTEYE EKLE" → "SEPETE EKLE" — bu
      // popup cart.html'de de calc.html'de de AYNI sepete (CartData) ekliyor,
      // metin bunu daha açık yansıtıyor. Renk/boyut/geçiş mantığı AYNEN kaldı.
      var listeyeEkleBtn = document.getElementById("hpBtnListeyeEkle");
      var sonucHazirMi = listeFiyat > 0 && urun.adet > 0;
      if(sonucHazirMi){
        listeyeEkleBtn.className = "hc-listeye-ekle-buton hc-listeye-ekle-buton--hazir";
        listeyeEkleBtn.textContent = "✓ SEPETE EKLE";
      } else {
        listeyeEkleBtn.className = "hc-listeye-ekle-buton hc-listeye-ekle-buton--bekliyor";
        listeyeEkleBtn.textContent = "➕ SEPETE EKLE";
      }
      kurDegeriniGoster();
    }catch(e){ hataGoster("Hesaplama yapılamadı: " + e.message); }
  }

  // urun: {ad, berta, abas, fiyat}  (yeni) veya sepetteki tam ürün nesnesi (düzenleme)
  // duzenleIdx: null = yeni ürün olarak eklenecek, dolu = bu idx güncellenecek
  function ac(urun, duzenleIdx){
    try{
      duzenlenenIdx = (duzenleIdx===undefined) ? null : duzenleIdx;
      kurOverride = null;
      seciliUrunBilgi = {ad:urun.ad, berta:urun.berta, abas:urun.abas};

      document.getElementById("hpUrunAd").textContent = urun.ad;
      var kodParcalari = [];
      if(urun.berta) kodParcalari.push("Berta: " + urun.berta);
      if(urun.abas) kodParcalari.push("Abas: " + urun.abas);
      document.getElementById("hpUrunKod").textContent = kodParcalari.join(" · ");

      var listeFiyat = (duzenlenenIdx !== null) ? (urun.listeFiyat||0) : (urun.fiyat||0);
      document.getElementById("hpListeFiyat").value = listeFiyat;
      if(duzenlenenIdx !== null && urun.dipFiyat){
        document.getElementById("hpDipFiyat").value = urun.dipFiyat;
      } else {
        dipFiyatiOner();
      }
      document.getElementById("hpIskonto").value = (duzenlenenIdx !== null) ? (urun.iskonto||0) : 0;
      document.getElementById("hpAdet").value = (duzenlenenIdx !== null) ? (urun.adet||1) : 1;

      gecmisAlimIpucunuGuncelle(seciliUrunBilgi);
      hesaplaVeGoster();
      document.getElementById("hpOverlay").hidden = false;
    }catch(e){ hataGoster("Hesaplama penceresi açılamadı: " + e.message); }
  }

  function kapat(){
    document.getElementById("hpOverlay").hidden = true;
  }

  function gecmisAlimTumunuGoster(){
    if(!gecmisAlimKayitlari || !gecmisAlimKayitlari.length) return;
    var html = gecmisAlimKayitlari.map(function(k){
      var tipEtiket = TIP_ETIKET_KISA[k.tip] || "";
      return "<div class='gecmis-alim-satir'>" + (k.tarih||"-") + (tipEtiket ? " (" + tipEtiket + ")" : "") + " · " + CartData.fmt(k.adet) + " adet · %" + CartData.fmt(k.iskonto) + " isk. · " + CartData.fmt(k.netFiyat) + " EUR net</div>";
    }).join("");
    document.getElementById("hpGecmisAlimListesi").innerHTML = html;
    document.getElementById("hpGecmisAlimOverlay").hidden = false;
  }

  function listeyeEkleTiklandi(){
    try{
      var iskonto = parseFloat(document.getElementById("hpIskonto").value)||0;
      if(iskonto === 100){
        bekleyenListeyeEkleIskonto100 = true;
        document.getElementById("hpBedelsizOzelFiyatOverlay").hidden = false;
        return;
      }
      listeyeEkleyiTamamla(null);
    }catch(e){ hataGoster("Listeye eklenemedi: " + e.message); }
  }

  function listeyeEkleyiTamamla(ozelEtiket){
    try{
      var ad = seciliUrunBilgi ? seciliUrunBilgi.ad : null;
      if(!ad) return;
      var listeFiyat = parseFloat(document.getElementById("hpListeFiyat").value)||0;
      var dipFiyat = parseFloat(document.getElementById("hpDipFiyat").value)||0;
      var iskonto = parseFloat(document.getElementById("hpIskonto").value)||0;
      var adet = parseFloat(document.getElementById("hpAdet").value)||1;

      if(kurOverride!=null) localStorage.setItem("weiconv2_sepet_kur_override", kurOverride);

      if(duzenlenenIdx !== null){
        CartData.hesaplandiIsaretle(duzenlenenIdx, listeFiyat, dipFiyat, iskonto, adet, ozelEtiket);
      } else {
        var yeniUrun = {
          idx: "manuel_" + Date.now(),
          ad: ad,
          berta: seciliUrunBilgi.berta || "",
          abas: seciliUrunBilgi.abas || "",
          listeFiyat: listeFiyat,
          dipFiyat: dipFiyat,
          iskonto: iskonto,
          adet: adet,
          hesaplandi: true
        };
        if(ozelEtiket) yeniUrun.ozelEtiket = ozelEtiket;
        CartData.ekle(yeniUrun);
      }
      kapat();
      if(typeof sayfayiCiz === "function") sayfayiCiz();
      if(typeof onEklendiCallback === "function") onEklendiCallback();
    }catch(e){ hataGoster("Listeye eklenemedi: " + e.message); }
  }

  document.addEventListener("DOMContentLoaded", function(){
    document.getElementById("hpBtnKapat").onclick = kapat;
    document.getElementById("hpBtnListeyeEkle").onclick = listeyeEkleTiklandi;
    ["hpListeFiyat","hpDipFiyat","hpIskonto","hpAdet"].forEach(function(id){
      document.getElementById(id).addEventListener("input", function(){
        if(id==="hpListeFiyat") dipFiyatiOner();
        hesaplaVeGoster();
      });
    });

    document.getElementById("hpGecmisAlimIpucu").onclick = gecmisAlimTumunuGoster;
    document.getElementById("hpGecmisAlimKapatBtn").onclick = function(){ document.getElementById("hpGecmisAlimOverlay").hidden = true; };

    document.getElementById("hpBtnOzelFiyatSec").onclick = function(){
      document.getElementById("hpBedelsizOzelFiyatOverlay").hidden = true;
      if(bekleyenListeyeEkleIskonto100){ bekleyenListeyeEkleIskonto100 = false; listeyeEkleyiTamamla("ozelfiyat"); }
    };
    document.getElementById("hpBtnBedelsizSec").onclick = function(){
      document.getElementById("hpBedelsizOzelFiyatOverlay").hidden = true;
      if(bekleyenListeyeEkleIskonto100){ bekleyenListeyeEkleIskonto100 = false; listeyeEkleyiTamamla("bedelsiz"); }
    };

    // Bu hesaplamaya özel döviz kuru (kalıcı değil — "Listeye Ekle"ye kadar).
    document.getElementById("hpKurRozetBtn").onclick = function(){
      var gunlukKur = CartData.kurOku();
      document.getElementById("hpKurGunlukDeger").textContent = CartData.fmt(gunlukKur);
      var manuelAlan = document.getElementById("hpKurManuelAlan");
      manuelAlan.hidden = true;
      document.getElementById("hpKurManuelInput").value = (kurOverride!=null) ? kurOverride : "";
      document.getElementById("hpBtnKurGunluk").className = "kur-secenek-btn" + (kurOverride==null ? " kur-secenek-btn--secili" : "");
      document.getElementById("hpBtnKurManuelAc").className = "kur-secenek-btn" + (kurOverride!=null ? " kur-secenek-btn--secili" : "");
      document.getElementById("hpKurSecimOverlay").hidden = false;
    };
    document.getElementById("hpBtnKurGunluk").onclick = function(){
      kurOverride = null;
      document.getElementById("hpKurSecimOverlay").hidden = true;
      hesaplaVeGoster();
    };
    document.getElementById("hpBtnKurManuelAc").onclick = function(){
      document.getElementById("hpKurManuelAlan").hidden = false;
      document.getElementById("hpKurManuelInput").focus();
    };
    document.getElementById("hpBtnKurManuelKaydet").onclick = function(){
      var deger = parseFloat(document.getElementById("hpKurManuelInput").value);
      if(!deger || deger <= 0){ hataGoster("Geçerli bir kur girin."); return; }
      kurOverride = deger;
      document.getElementById("hpKurSecimOverlay").hidden = true;
      hesaplaVeGoster();
    };
    document.getElementById("hpBtnKurSecimVazgec").onclick = function(){
      document.getElementById("hpKurSecimOverlay").hidden = true;
    };
  });

  return { ac: ac, kapat: kapat, onEklendi: onEklendi };

})();
