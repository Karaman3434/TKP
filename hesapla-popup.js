/*
  hesapla-popup.js — TKP.08.11.26-12:34.1504
  =======================================
  GÜNCELLENDİ (02.11.2026, Abdullah onayı — mockup onaylandı: "Ok tmm
  kodlayalım"): cart.html'de alttaki "Kapat" ve "SEPETE EKLE" butonları
  kalktı; SEPETE EKLE ürün adı satırına, sepetteki ürün sayısını gösteren
  kırmızı sayaçla (#hpSepetSayac) taşındı. Bu dosya calc.html ile ORTAK
  olduğu için hepsi opt-in/korumalı: (1) #hpBtnKapat yoksa (cart.html)
  bağlanmaz — calc.html'de eskisi gibi çalışır; (2) buton etiketi
  .hp-btn-etiket span'ı varsa SADECE onu yazar (sayaç silinmesin), yoksa
  eskisi gibi tüm metni; (3) #hpSepetSayac yoksa sayaç hiç çalışmaz;
  (4) popup dışına dokununca kapanma SADECE #hpOverlay'de
  data-disari-dokun-kapat varsa (cart.html) açık.
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
  var TIP_ETIKET_KISA = TipEtiket.kisa; // 08.11.2026: tek kaynak (tip-etiketleri.js)

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
    // 08.11.2026: cart.html'de kur satırı sayfanın en üstüne taşındı — ipucu
    // yazısı pencere açıkken "değiştirmek için", kapalıyken "günün kurları için".
    var ipucu = document.getElementById("hpKurIpucu");
    if(ipucu) ipucu.textContent = hpPencereAcikMi() ? "— değiştirmek için dokun" : "— günün kurları için dokun";
  }

  // 08.11.2026 (Abdullah onayı): kutu içi yazılar %25 büyüdü, kutu boyu SABİT.
  // Çok büyük tutarlar (örn. 1.081.513,44 TL) taşmasın diye: yazı kutuya
  // sığmıyorsa 0.5px adımlarla küçültülür (taban 12px); sığıyorsa CSS'teki
  // büyük boyut aynen kalır. Pencere görünür değilken ölçülemez → atlanır.
  function degerleriSigdir(){
    try{
      if(!hpPencereAcikMi()) return;
      ["hpIskontoluFiyat","hpTlBirimFiyat","hpToplamEuro","hpFaturaToplam","hpPrimTL","hpPrimYuzde"].forEach(function(id){
        var el = document.getElementById(id);
        if(!el) return;
        var birimler = el.querySelectorAll(".hc-turuncu-birim");
        el.style.fontSize = "";
        for(var i=0;i<birimler.length;i++) birimler[i].style.fontSize = "";
        var boyut = parseFloat(getComputedStyle(el).fontSize) || 20;
        var birimBoyut = birimler.length ? parseFloat(getComputedStyle(birimler[0]).fontSize) : 0;
        var oran = birimBoyut && boyut ? (birimBoyut / boyut) : 0;
        var guvenlik = 40;
        while(el.scrollWidth > el.clientWidth + 0.5 && boyut > 12 && guvenlik-- > 0){
          boyut -= 0.5;
          el.style.fontSize = boyut + "px";
          if(oran) for(var j=0;j<birimler.length;j++) birimler[j].style.fontSize = (boyut*oran) + "px";
        }
      });
    }catch(e){}
  }

  function hpPencereAcikMi(){
    var ov = document.getElementById("hpOverlay");
    return !!(ov && !ov.hidden);
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
      // 08.11.2026 (Abdullah onayı): cart.html'de prim paneli ORAN / TUTAR diye
      // iki ayrı, ortalı kutu (#hpPrimYuzde + #hpPrimTL). calc.html'de bu
      // iki sayfada da var.
      var primYuzdeEl = document.getElementById("hpPrimYuzde");
      var primPanel = document.getElementById("hpPrimKutu");
      if(primPanel) primPanel.classList.remove("hp-prim--tek");
      if(h.mudurPrim===0 && urun.iskonto>60){
        primKutu.innerHTML = "ÖZEL FİYAT";
        if(primPanel) primPanel.classList.add("hp-prim--tek");
      } else if(h.mudurPrim<0){
        primKutu.innerHTML = "Yok";
        if(primPanel) primPanel.classList.add("hp-prim--tek");
      } else {
        // 04.10.2026: prim TL'nin yanında satış üzerinden prim yüzdesi
        // (Prim TL ÷ Fatura Toplam × 100). 08.11.2026: cart.html ve calc.html'de
        // ORAN / TUTAR ayrı, ortalı iki kutu (#hpPrimYuzde + #hpPrimTL).
        var primYuzde = h.faturaToplam > 0 ? (primTL / h.faturaToplam * 100) : 0;
        if(primYuzdeEl) primYuzdeEl.textContent = "% " + CartData.fmt(primYuzde);
        primKutu.textContent = CartData.fmt(primTL) + " TL";
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
        butonEtiketiYaz(listeyeEkleBtn, "✓ SEPETE EKLE");
      } else {
        listeyeEkleBtn.className = "hc-listeye-ekle-buton hc-listeye-ekle-buton--bekliyor";
        butonEtiketiYaz(listeyeEkleBtn, "➕ SEPETE EKLE");
      }
      kurDegeriniGoster();
      degerleriSigdir();
    }catch(e){ hataGoster("Hesaplama yapılamadı: " + e.message); }
  }

  // Buton etiketini yazar. cart.html'deki butonda etiket ayrı bir
  // .hp-btn-etiket span'ında (yanında sayaç span'ı var — textContent ile
  // tüm butonu yazmak sayacı SİLERDİ); calc.html'deki butonda span yok,
  // eskisi gibi düz metin.
  function butonEtiketiYaz(btn, metin){
    var etiket = btn.querySelector(".hp-btn-etiket");
    // data-sabit: cart.html'in sepet düğmesinde yazı hep "SEPETE EKLE" kalır
    // (renk bekliyor/hazır sınıfıyla değişir) — 08.11.2026.
    if(etiket && etiket.hasAttribute("data-sabit")) return;
    if(etiket) etiket.textContent = metin;
    else btn.textContent = metin;
  }

  // Sepetteki ürün SATIRI sayısını sayaca yazar (0 iken gizli). Sayaç
  // elemanı yoksa (calc.html) hiçbir şey yapmaz.
  function sepetSayaciniGuncelle(){
    try{
      var sayac = document.getElementById("hpSepetSayac");
      if(!sayac) return;
      var n = (typeof CartData !== "undefined" && CartData.liste) ? CartData.liste().length : 0;
      sayac.textContent = n;
      sayac.hidden = !(n > 0);
    }catch(e){}
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
      document.getElementById("hpUrunKod").textContent = kodParcalari.join("   │   ");

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
      sepetSayaciniGuncelle();
      document.getElementById("hpOverlay").hidden = false;
      try{ kurDegeriniGoster(); }catch(e){}
      degerleriSigdir();
    }catch(e){ hataGoster("Hesaplama penceresi açılamadı: " + e.message); }
  }

  function kapat(){
    document.getElementById("hpOverlay").hidden = true;
    try{ kurDegeriniGoster(); }catch(e){}
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
      var yeniEklemeMiydi = (duzenlenenIdx === null);
      sepetSayaciniGuncelle();
      kapat();
      if(typeof sayfayiCiz === "function") sayfayiCiz();
      // EKLENDİ (26.10.2026): kancaya artık bunun YENİ bir ekleme mi yoksa
      // sepetteki mevcut bir satırın DÜZENLENMESİ mi olduğu da geçiliyor —
      // calc.html'in mevcut kancası (argümansız tanımlı) bundan etkilenmez,
      // cart.html'in arama kutusunu sadece gerçek "yeni ekleme"de sıfırlayan
      // kancası bunu kullanıyor (bkz. urun-arama.js).
      if(typeof onEklendiCallback === "function") onEklendiCallback(yeniEklemeMiydi);
    }catch(e){ hataGoster("Listeye eklenemedi: " + e.message); }
  }

  document.addEventListener("DOMContentLoaded", function(){
    // cart.html'de alttaki Kapat butonu yok (02.11.2026) — var olduğunda bağla.
    var kapatBtn = document.getElementById("hpBtnKapat");
    if(kapatBtn) kapatBtn.onclick = kapat;
    document.getElementById("hpBtnListeyeEkle").onclick = listeyeEkleTiklandi;
    // 08.11.2026: kur satırı artık sayfada hep görünür — açılışta ve kur
    // Firebase'den/ayarlardan güncellenince değeri yaz.
    try{ kurDegeriniGoster(); }catch(e){}
    window.addEventListener("istakipAuthHazir", function(){ try{ kurDegeriniGoster(); }catch(e){} });
    window.addEventListener("storage", function(ev){ if(ev.key === "weicon_kur"){ try{ kurDegeriniGoster(); }catch(e){} } });

    // Popup DIŞINA (koyu alana) dokununca kapan — SADECE
    // data-disari-dokun-kapat olan overlay'de (cart.html). Basma ve bırakma
    // ikisi de overlay'in kendisinde olmalı: kutunun içinde başlayıp (ör.
    // sayı alanında yazı seçerken) dışarıda biten sürükleme yanlışlıkla
    // kapatmasın.
    var hpOverlayEl = document.getElementById("hpOverlay");
    if(hpOverlayEl && hpOverlayEl.hasAttribute("data-disari-dokun-kapat")){
      var basmaOverlaydeydi = false;
      hpOverlayEl.addEventListener("pointerdown", function(ev){ basmaOverlaydeydi = (ev.target === hpOverlayEl); });
      hpOverlayEl.addEventListener("click", function(ev){
        if(ev.target === hpOverlayEl && basmaOverlaydeydi) kapat();
        basmaOverlaydeydi = false;
      });
    }
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
    document.getElementById("hpKurRozetBtn").onkeydown = function(ev){
      if(ev && (ev.key === "Enter" || ev.key === " ")){ ev.preventDefault(); this.click(); }
    };
    document.getElementById("hpKurRozetBtn").onclick = function(){
      // 08.11.2026: cart.html'de satır sayfanın en üstünde. Pencere KAPALIYKEN
      // (bu işleme özel kur anlamsız) günün kurları kartını açar.
      if(this.classList.contains("kur-ust-satir") && !hpPencereAcikMi()){
        if(typeof KurPanel !== "undefined") KurPanel.ac();
        return;
      }
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
