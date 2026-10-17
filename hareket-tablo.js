/*
  hareket-tablo.js — WG.181026.2315.834
  =================
  Programdaki TÜM ürün listesi tabloları (Sepet'in Hesaplanacak/Hesaplandı
  grupları, Gönder ekranının hareket tablosu, Formu Görüntüle önizlemesi)
  aynı belge-tablosu tasarımını (belge-style.css -> .belge-urun-tablo)
  kullanır. Bu dosya o tabloyu üretmek için tek, paylaşılan fonksiyonu
  sağlar — böylece tasarım her yerde birebir aynı kalır.
*/

var HareketTablo = (function(){

  function htmlEsc(s){
    return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }
  function fmt(n){
    return (n||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  // Rakamın altına küçük birim satırı ekler (€ / TL) — sayı ile birim aynı
  // hücrede iki satıra ayrılır, sütun bu sayede daralabilir (07.09.2026).
  // KURAL (23.09.2026): 1000 ve üzeri sayılarda otomatik biraz küçük yazılır.
  function paraHtml(sayiStr, birim){
    var buyukMu = String(sayiStr).indexOf(".") > -1;
    return "<span class='belge-para-sayi" + (buyukMu ? " belge-para-sayi--buyuk" : "") + "'>" + sayiStr + "</span><span class='belge-para-birim'>" + birim + "</span>";
  }

  // urunler: [{ad, berta, abas, listeFiyat, dipFiyat, iskonto, adet}]
  // hesapla(u): CartData.hesapla ile aynı imzada fonksiyon — {iskontoluFiyat, toplamEuro, mudurPrim}
  // zeminSinifi: "hareket-satir--sari" | "hareket-satir--yesil" | ""
  // basit: true ise WhatsApp'a özel sade satır (SIRA/ÜRÜN/ADET/NET/TOPLAM) üretir —
  // müşteriye internal bilgi olan LİSTE/İSK/PRİM sütunları hiç gönderilmez.
  // NET TL SATIRI (01.10.2026, Abdullah'ın isteğiyle) — NET hücresinin
  // altında, günün kuruyla hesaplanmış TL karşılığı, küçük gri yazı.
  // SADECE EKRAN İÇİN: "Sadece Tablo" kopyalanıp ofise/mail'e giderken bu
  // satır gizlenir (bkz. send-render.js tabloSadeceKopyala, ".net-tl-gizle"
  // sınıfı) — kopyalanan/gönderilen tabloda yalnızca EURO kalır.
  function netTlHtml(netEuro, kur){
    if(!kur) return "";
    return "<div class='belge-net-tl'>≈ " + Math.round(netEuro*kur).toLocaleString("tr-TR") + " TL</div>";
  }

  // BAKİYE NOTU (07.10.2026, Abdullah'ın isteğiyle) — ürün satırının altına
  // DEĞİL, TÜM tablonun altına, tek ve tek seferlik bir not: siparişte
  // bakiyede bırakılan herhangi bir ürün varsa gösterilir. Hangi ürün/kaç
  // adet olduğu burada YAZILMAZ — o bilgi zaten "Düzenle" ekranında/kayıtta
  // duruyor, bu sadece "dikkat, bu siparişte bekleyen var" uyarısıdır.
  function bakiyeNotuGerekliMi(urunler){
    return (urunler||[]).some(function(u){ return (u.bakiyeAdet||0) > 0; });
  }
  function bakiyeNotuHtml(urunler){
    return bakiyeNotuGerekliMi(urunler) ? "<div class='belge-siparis-bakiye-not'>📦 Bu siparişte bekleyen ürün var</div>" : "";
  }

  function satirlarHtml(urunler, hesapla, zeminSinifi, basit, primGizli, kur){
    return (urunler||[]).map(function(u, i){
      var h = hesapla(u);
      var toplamVarMi = h && h.toplamEuro != null;
      // NUMUNE/BEDELSİZ GÖSTERİMİ (28.09.2026, Abdullah'ın isteğiyle): bedelsiz
      // (numune) işaretli ürünlerde TOPLAM sütunu "0,00 EURO" yerine "NUMUNE"
      // yazar. İskonto %100 girilmişse İSK sütununda "%100" yerine sadece "-".
      var iskYuz100 = (u.iskonto||0) === 100;
      var toplamHucreIcerik = !toplamVarMi ? "-" : ((u.ozelEtiket === "bedelsiz") ? "NUMUNE" : paraHtml(fmt(h.toplamEuro),"EURO"));
      var netTl = toplamVarMi ? netTlHtml(h.iskontoluFiyat, kur) : "";
      // DÜZELTME (15.10.2026, Abdullah onayı): harf (B/A) ile kod arasındaki
      // boşluk kaldırıldı — "B11550400 - A1000912233" gibi bitişik.
      var urunHucre = "<td class='belge-td-urun'><div class='belge-td-urun-kod'><span class='kod-blok kod-blok--b'><span class='kod-harf'>B</span>" + htmlEsc(u.berta||"-") + "</span> - <span class='kod-blok kod-blok--a'><span class='kod-harf'>A</span>" + htmlEsc(u.abas||"-") + "</span>" + "</div><div class='belge-td-urun-ad'>" + htmlEsc(u.ad) + "</div></td>";
      if(basit){
        return "<tr class='" + (zeminSinifi||"") + "'>"
          + urunHucre
          + "<td>" + (u.adet!=null ? u.adet : "-") + "</td>"
          + "<td>" + (toplamVarMi ? "<span class='rozet-net'>"+paraHtml(fmt(h.iskontoluFiyat),"EURO")+"</span>"+netTl : "-") + "</td>"
          + "<td class='belge-td-toplam'>" + toplamHucreIcerik + "</td>"
          + "</tr>";
      }
      var primHucre;
      if(!toplamVarMi){ primHucre = "-"; }
      // DEĞİŞİKLİK (14.10.2026, Abdullah'ın isteğiyle): dar PRİM sütununda
      // "Bedelsiz" iki satıra bölünüyordu ("Bedelsi"/"z") — kısa koda
      // ("BDLSİZ") çevrildi; bu da tek başına sığmadığı için nowrap +
      // küçük font (.belge-td-prim-bedelsiz) ile sarmalandı.
      else if(u.ozelEtiket === "bedelsiz"){ primHucre = "<span class='belge-td-prim-bedelsiz'>🎁 BDLSİZ</span>"; }
      else if(u.iskonto>60){ primHucre = "Ö.F"; }
      else { primHucre = "<span class='belge-td-prim-tek'>" + paraHtml(Math.round(h.mudurPrimTL).toLocaleString("tr-TR"),"TL") + "</span>"; }
      return "<tr class='" + (zeminSinifi||"") + "'>"
        + "<td class='belge-td-sira'>" + (i+1) + "</td>"
        + urunHucre
        + "<td>" + (u.adet!=null ? u.adet : "-") + "</td>"
        + "<td>" + (u.listeFiyat!=null ? paraHtml(fmt(u.listeFiyat),"EURO") : "-") + "</td>"
        + "<td>" + (iskYuz100 ? "-" : (u.iskonto!=null ? "<span class='belge-isk-metin'>"+paraHtml(u.iskonto,"%")+"</span>" : "-")) + "</td>"
        + "<td>" + (toplamVarMi ? "<span class='rozet-net'>"+paraHtml(fmt(h.iskontoluFiyat),"EURO")+"</span>"+netTl : "-") + "</td>"
        + "<td class='belge-td-toplam'>" + toplamHucreIcerik + "</td>"
        + (primGizli ? "" : "<td class='belge-td-prim'>" + primHucre + "</td>")
        + "</tr>";
    }).join("");
  }

  // Tek bir grup (örn. sadece HESAPLANDI) için etiket + tablo + (istenirse) genel toplam.
  // opts.kanal === "whatsapp" ise sade tablo (SIRA/ÜRÜN BİLGİSİ/ADET/NET/TOPLAM) üretir.
  // opts.primGizli === true ise PRİM sütunu HİÇ gösterilmez — bu, mail/WhatsApp
  // ÖNİZLEMESİ için ZORUNLU: Müdür Primi kesinlikle müşteriye/karşı tarafa
  // gidecek görsele/önizlemeye karışmaz, sadece Abdullah'ın kendi ekranlarında
  // (Sepet, İşlem Geçmişi) görünür.
  function grupHtml(opts){
    var basit = opts.kanal === "whatsapp";
    var primGizli = !!opts.primGizli;
    // Madde 5 (22.09.2026): HESAPLANACAK grubunun soluk/kirli sarısı
    // (eskiden #fff9e6 şerit / #faeeda satır) yerine daha canlı, doygun
    // bir sarı — hem başlık şeridi hem satır zemini aynı ton.
    // ÖZEL RENK (27.09.2026, standart cari kart tasarımıyla renk uyumu):
    // opts.etiketBgOzel/etiketRenkOzel verilirse sarı/yeşil zemin mantığı
    // ezilir — SADECE send-render.js'in Gönder ekranı önizlemesi kullanır,
    // cart-render.js'in HESAPLANACAK/HESAPLANDI şeridi ETKİLENMEZ.
    // TURUNCU ZEMİN (01.10.2026, Abdullah'ın isteğiyle) — Hesaplanacak grubu
    // etiket şeridi eski soluk sarıdan canlı turuncuya çevrildi.
    var etiketRenk = opts.etiketRenkOzel || "#ffffff";
    var etiketBg = opts.etiketBgOzel || (opts.zeminSinifi === "hareket-satir--sari" ? "#ff8a3d" : "#3bb273");
    // TÜRE ÖZEL ROZET RENGİ (12.10.2026, Abdullah onayı — Belge Önizleme'deki
    // "bir tabloda bir işlem için sadece bir renk" kuralı Sepet/Gönder'e de
    // taşınıyor): opts.tip verilirse rozete "tip-<tip>" sınıfı eklenir,
    // gerçek renk cart-tablo-style-v2.css (SADECE .cart-sayfa altında) ile
    // geliyor — opts.tip verilmezse eski davranış (sabit renk) AYNEN kalır.
    var etiketRozetHtml = opts.etiketRozet ? ("<span class='hareket-grup-etiket-rozet" + (opts.etiketRozetSinifi ? " hareket-grup-etiket-rozet--" + opts.etiketRozetSinifi : (opts.etiketRozet==="WEICON" ? " hareket-grup-etiket-rozet--weicon" : "")) + (opts.tip ? " tip-" + opts.tip : "") + "'>" + opts.etiketRozet + "</span>") : "";
    // ETİKET ORTADA + ROZET KENARDA (02.10.2026, Abdullah'ın isteğiyle): eskiden
    // etiketOrtali:true verildiğinde rozet VARSA ikisi birlikte tek blok olarak
    // ortalanıyordu. Artık rozet de verilmişse (SADECE bu durumda — cart-render.js'in
    // HESAPLANDI grubu) etiket metni satırın TAM ortasında, rozet sağ kenarda sabit
    // duruyor (bkz. belge-style.css .hareket-grup-etiket--ortali-kenar). Rozetsiz
    // etiketOrtali kullanımları (Gönder ekranı önizlemesi vb.) HİÇ DEĞİŞMEDİ.
    var ortaliVeRozetli = !!(opts.etiketOrtali && opts.etiketRozet);
    var etiketSinifi = "hareket-grup-etiket" + (ortaliVeRozetli ? " hareket-grup-etiket--ortali-kenar" : (opts.etiketOrtali ? " hareket-grup-etiket--ortali" : ""));
    var etiketMetinHtml = "<span" + (ortaliVeRozetli ? " class='hareket-grup-etiket-metin'" : "") + ">" + opts.etiket + "</span>";
    // KOD/TARİH ŞERİDİ (15.10.2026, Abdullah onayı) — opts.kodMetni verilirse
    // (şimdilik SADECE cart-render.js'in HESAPLANDI grubu), Belge Önizleme'de
    // zaten kullanılan AYNI şerit (.belge-belge-baslik-serit--mavi) grubun en
    // üstüne eklenir. Yazı rengi opts.tip'e göre (cart-tablo-style-v2.css'te
    // SADECE .cart-sayfa altında tanımlı, belge-onizleme-style-v2.css'teki
    // palet ile birebir). Sepet'te henüz gerçek bir belge kaydı/SP kodu
    // olmadığından (kaydet() ancak Gönder'de çağrılıyor) metin "(taslak)"
    // ibaresiyle geliyor — cart-render.js bunu kendisi üretip geçiyor.
    var kodSeridiHtml = opts.kodMetni ? ("<div class='belge-belge-baslik-serit belge-belge-baslik-serit--mavi" + (opts.tip ? " tip-" + opts.tip : "") + "'><span class='belge-belge-baslik-serit-metin'>" + htmlEsc(opts.kodMetni) + "</span></div>") : "";
    var html = kodSeridiHtml + (opts.etiket ? ("<div class='" + etiketSinifi + "' style='background:" + etiketBg + ";color:" + etiketRenk + ";'>" + etiketMetinHtml + etiketRozetHtml + "</div>") : "");
    var basHucreler = basit
      ? "<th style='width:46%;'>ÜRÜN BİLGİSİ</th><th style='width:12%;'>ADET</th><th style='width:19%;'>NET</th><th style='width:23%;'>TOPLAM</th>"
      : (primGizli
          ? "<th style='width:3.6%;'>SR</th><th style='width:32.4%;'>ÜRÜN BİLGİSİ</th><th style='width:10%;'>ADET</th><th style='width:10%;'>LİSTE</th><th style='width:10%;'>İSK</th><th style='width:16%;'>NET</th><th style='width:18%;'>TOPLAM</th>"
          : "<th style='width:3.6%;'>SR</th><th style='width:29.2%;'>ÜRÜN BİLGİSİ</th><th style='width:10%;'>ADET</th><th style='width:10%;'>LİSTE</th><th style='width:10%;'>İSK</th><th style='width:13%;'>NET</th><th style='width:13%;'>TOPLAM</th><th style='width:11.2%;'>PRİM</th>");
    html += "<div class='data-table-container'><table class='belge-urun-tablo'>"
      + "<thead><tr>" + basHucreler + "</tr></thead>"
      + "<tbody>" + satirlarHtml(opts.urunler, opts.hesapla, opts.zeminSinifi, basit, primGizli, opts.kur) + "</tbody></table></div>"
      + bakiyeNotuHtml(opts.urunler);
    if(opts.genelToplam != null){
      // Manuel kur girilmişse (opts.kurManuelMi) etiket "Hesaplanan Kur" yerine
      // kısa "✏️ Manuel Kur" olur — böylece bu işlemde günlük kur DEĞİL, elle
      // girilmiş özel bir kur kullanıldığı tek bakışta anlaşılır (13.09.2026).
      // opts.kurTiklanabilir sadece Sepet'te true geçilir; oraya dokununca
      // manuel kur girme popup'ı açılır (bkz. cart-render.js).
      // DÜZENLEME (27.09.2026, Abdullah'ın isteğiyle): kur bilgisi artık ayrı
      // bir şerit değil — GENEL TOPLAM ile AYNI satırda, solda, beyaz yazı
      // (mavi zeminin üzerinde). Altına (primGizli değilse) bir TOPLAM PRİM
      // satırı ekleniyor.
      var primSatiriVarMi = !primGizli;
      var kurIcSinifi = "belge-gt-kur-ic" + (opts.kurManuelMi ? " belge-gt-kur-ic--manuel" : "") + (opts.kurTiklanabilir ? " belge-gt-kur-ic--tiklanabilir" : "");
      // KISALTMA (12.10.2026, Abdullah'ın isteğiyle): "Bu işlemde X kuru
      // kullanıldı" tek satırda çok uzun oluyor, kutudan taşıyordu — artık
      // İKİ SATIR: üstte kısa etiket, altta kalın rakam + EURO birimi
      // (bkz. belge-style.css .belge-gt-kur-etiket / .belge-gt-kur-deger).
      var kurEtiketMetni = "<span class='belge-gt-kur-etiket'>" + (opts.kurManuelMi ? "✏️ Bu işlem kuru" : "Bu işlem kuru") + "</span><br><span class='belge-gt-kur-deger'>" + fmt(opts.kur) + " EURO</span>";
      html += "<div class='belge-gt-kutu" + (primSatiriVarMi ? " belge-gt-kutu--altduz" : "") + "'>"
        + "<div class='belge-gt-satir'>"
        + (opts.kur ? "<span class='" + kurIcSinifi + "'>" + kurEtiketMetni + "</span>" : "")
        + "<span class='belge-gt-etiket-deger-grup'>"
        + "<span class='belge-gt-etiket'>GENEL TOPLAM</span>"
        + "<span class='belge-gt-deger'>" + fmt(opts.genelToplam) + " EURO" + (opts.kur ? "<span class='belge-gt-deger-alt'>≈ " + Math.round(opts.genelToplam*opts.kur).toLocaleString("tr-TR") + " TL</span>" : "") + "</span>"
        + "</span>"
        + "</div>"
        + "</div>";

      if(primSatiriVarMi){
        var primToplamTL = 0;
        (opts.urunler||[]).forEach(function(u){
          var h = opts.hesapla ? opts.hesapla(u) : null;
          var toplamVarMi = h && h.toplamEuro != null;
          if(toplamVarMi && u.ozelEtiket !== "bedelsiz" && !(u.iskonto>60)){
            primToplamTL += h.mudurPrimTL || 0;
          }
        });
        html += "<div class='belge-prim-toplam-serit'>"
          + "<span class='belge-pt-etiket'>PRİM</span>"
          + "<span class='belge-pt-deger'>" + Math.round(primToplamTL).toLocaleString("tr-TR") + " TL</span>"
          + "</div>";
      }
    }
    return html;
  }

  function kosulKutusuHtml(ikon, etiket, deger){
    return "<div class='belge-kosul-alan'>"
      + "<div class='belge-kosul-ikon'>" + ikon + "</div>"
      + "<div><div class='belge-kosul-etiket'>" + etiket + "</div><div class='belge-kosul-deger'>" + htmlEsc(deger||"-") + "</div></div>"
      + "</div>";
  }

  // DÜZELTME (07.10.2026, Abdullah'ın isteğiyle): isim önündeki 👤 ikonu
  // kaldırıldı — ikon artık sadece üstteki "👤 YETKİLİ" etiketinde var,
  // isim etiketle aynı sol kenardan değil, ~3mm daha içeriden başlıyor
  // (bkz. cari-kart-style.css .ck-kart / belge-style.css .belge-yetkili-satir).
  function yetkiliSatiriHtml(isim, tel, eposta){
    if(!isim && !tel && !eposta) return "";
    var parcalar = [];
    if(tel) parcalar.push("📞 " + tel);
    if(eposta) parcalar.push("✉️ " + eposta);
    return "<div class='belge-yetkili-satir'><b>" + htmlEsc(isim||"-") + "</b>"
      + (parcalar.length ? " — <span class='belge-yetkili-detay'>" + htmlEsc(parcalar.join(" · ")) + "</span>" : "")
      + "</div>";
  }

  // TEK CARİ KUTUSU (14.10.2026, Abdullah'ın isteğiyle — "cari ve ürün
  // tablosu tek yerden yönetilebilse" — ürün tablosundan sonra artık CARİ
  // BİLGİ kutusu da buraya, tek paylaşılan yere taşındı): VADE/FATURA/KARGO
  // özeti + FATURA/TESLİMAT adresi + YETKİLİ bloklarının "7. Belge" ile
  // onaylanan renkli-kutu tasarımı (customer-cari-kart.html / cari-kart-
  // style.css ile BİREBİR AYNı .ck-* sınıflar) — eskiden sadece Gönder
  // ekranında (send-render.js) vardı, Belge Önizleme (belge-render.js) hâlâ
  // eski/farklı ".belge-adres-blok" tasarımını kendi başına üretiyordu.
  // yetkiliListesi bir DİZİ: Gönder tek seçili yetkiliyi [tekYetkili] olarak
  // yollar, Belge Önizleme ise kaydın gösterilecek TÜM yetkililerini —
  // her sayfanın kendi işleyişi (hangi yetkili(ler) gösterilir) burada
  // DEĞİŞMEDİ, sadece görsel üretim kodu artık tek yerde.
  // koduGizle (18.10.2026, Abdullah onayı — "Sipariş Formu" v2 mockup):
  // true verilirse müşteri cari kodu ("M-0017" gibi) MusteriSeridi.html'e
  // iletilmez — SADECE send-render.js'in Mail/WhatsApp'a giden GÖRSELİNİN
  // ürettiği çağrı bunu true geçer. Cari kodu program İÇİNDEKİ hiçbir
  // ekranda (Cari Kart, Sepet, Gönder'in canlı önizlemesi, Belge Önizleme)
  // ETKİLENMEZ — hepsi bu parametreyi hiç geçmediği için eskisi gibi
  // gösterilmeye devam eder.
  function cariKutulariHtml(musteri, vade, faturaTuru, kargo, faturaAdr, teslimatAdr, yetkiliListesi, koduGizle){
    // Cari'deki tek "ŞEHİR" alanı SADECE fatura adresine eklenir — teslimat
    // çoğu zaman bambaşka bir ilçe/ildedir, ona hiç eklenmez (29.09.2026).
    var sehirEk = musteri.sehir ? ", " + htmlEsc(musteri.sehir) : "";
    // TEK MÜŞTERİ İSMİ TASARIMI (15.10.2026, Abdullah'ın bildirdiği hata):
    // burada eskiden kendi başına çıplak "• İsim" satırı (.ck-isim-satir)
    // üretiliyordu — Cari Bilgi/Sepet'te kullanılan kutulu (kod+isim+ilçe/il)
    // tasarımdan FARKLIYDI, sayfalarda iki ayrı müşteri-ismi görünümüne yol
    // açıyordu. musteri-serit.js'in kendi TEK KURAL'ına (müşteri adı her
    // yerde MusteriSeridi.html() ile basılır) uyularak artık o da kullanılıyor
    // — bu fonksiyonu çağıran her sayfa (Gönder, Mail, Belge Önizleme) artık
    // musteri-serit.js/css'i de yüklüyor olmalı.
    var isimHtml = (typeof MusteriSeridi !== "undefined")
      ? MusteriSeridi.html(musteri, {koduGizle: koduGizle})
      : "<div class='ck-isim-satir'><b class='ck-isim-nokta'>•</b> " + htmlEsc(musteri.ad) + "</div>";
    var html = isimHtml
      + "<div class='ozet-satir-3 ozet-satir-3--birlesik'>"
      +   "<div class='ozet-alan'><span class='ozet-ikon'>📅</span><div class='ozet-metin'><div class='ozet-baslik'>VADE</div><div class='ozet-deger'>" + htmlEsc(vade||"-") + "</div></div></div>"
      +   "<div class='ozet-alan'><span class='ozet-ikon'>🧾</span><div class='ozet-metin'><div class='ozet-baslik'>FATURA</div><div class='ozet-deger'>" + htmlEsc(faturaTuru||"-") + "</div></div></div>"
      +   "<div class='ozet-alan'><span class='ozet-ikon'>🚚</span><div class='ozet-metin'><div class='ozet-baslik'>KARGO</div><div class='ozet-deger'>" + htmlEsc(kargo||"-") + "</div></div></div>"
      + "</div>";
    // TEK ÇERÇEVE (18.10.2026, Abdullah onayı — "Sipariş Formu" v3 mockup):
    // Fatura Adresi / Teslimat Adresi / Yetkili artık ayrı ayrı kutucuklar
    // DEĞİL — eski iç tasarım (etiket + ince ayraç çizgisi) AYNEN korunarak
    // üçünü birlikte saran TEK bir dış çerçeve (.belge-adres-yetkili-cerceve).
    var adresYetkiliIcHtml = "<div class='ck-blok-etiket ck-blok-etiket--fatura'><span>📄 FATURA ADRESİ</span></div>"
      + "<div class='ck-blok'><div class='ck-kart-liste'><div class='ck-kart'>"
      +   (faturaAdr ? htmlEsc(faturaAdr) + sehirEk : "<span class='belge-adres-bos'>Girilmemiş</span>")
      + "</div></div></div>";
    if(teslimatAdr){
      adresYetkiliIcHtml += "<div class='ck-blok-etiket ck-blok-etiket--teslimat'><span>🚚 TESLİMAT ADRESİ</span></div>"
        + "<div class='ck-blok'><div class='ck-kart-liste'><div class='ck-kart'>" + htmlEsc(teslimatAdr) + "</div></div></div>";
    }
    var yetkiliIcHtml = (yetkiliListesi||[]).map(function(k){ return yetkiliSatiriHtml(k.isim, k.telefon, k.eposta); }).join("");
    if(yetkiliIcHtml){
      adresYetkiliIcHtml += "<div class='ck-blok-etiket ck-blok-etiket--yetkili'><span>👤 YETKİLİ</span></div>"
        + "<div class='ck-blok'><div class='ck-kart-liste'><div class='ck-kart'>" + yetkiliIcHtml + "</div></div></div>";
    }
    html += "<div class='belge-adres-yetkili-cerceve'>" + adresYetkiliIcHtml + "</div>";
    return html;
  }

  return {
    satirlarHtml: satirlarHtml,
    grupHtml: grupHtml,
    kosulKutusuHtml: kosulKutusuHtml,
    yetkiliSatiriHtml: yetkiliSatiriHtml,
    cariKutulariHtml: cariKutulariHtml,
    bakiyeNotuHtml: bakiyeNotuHtml,
    fmt: fmt,
    htmlEsc: htmlEsc
  };

})();
