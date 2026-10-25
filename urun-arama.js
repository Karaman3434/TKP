/*
  urun-arama.js — WG.261026.0049.1038
  ===================================
  04.10.2026 (Abdullah'ın isteğiyle) — Ürün Satış Geçmişi / Hit Ürünler
  listesi açıkken sepetin "boş" mesajı ve Kaydet/Görüntüle ve Gönder
  butonları artık gizleniyor (bkz. uaAltAlanlariGizle); bu bölümler
  kapanınca sayfayiCiz() ile doğru duruma geri dönülüyor.
  Birleşik Sayfa (cart.html): Ürün Bul'un arama/Hit Ürünler/Yeni Ürün Ekle
  mantığı — product-render.js'ten taşındı, 02.10.2026 (Abdullah'ın isteği):
  Ürün Bul, Hızlı Hesapla ve Sepet artık TEK sayfa.

  DAVRANIŞ FARKLARI (eski product.html'e göre):
    - Arama kutusu BOŞKEN sonuç listesi hiç gösterilmez (eskiden 30 ürünlük
      "göz at" listesi vardı) — kutuya yazdıkça altı büyüyüp eşleşenleri
      listeler (Abdullah'ın onayladığı tasarım, 02.10.2026).
    - Ürün hücresine dokununca artık DOĞRUDAN WEICON sayfası açılır (eskiden
      bu 🔗 ayrı bir butondu — o buton artık "HESAPLA" butonu).

  SADELEŞTİRME (26.10.2026, Abdullah onayı — "hesapla ve hesaplanacak
  sayfalarını kaldıralım" isteği): "SEÇ" butonu (ürünü hesaplamadan doğrudan
  HESAPLANACAK'a ekleyen kısayol) TAMAMEN KALDIRILDI — artık her ürün
  sepete girmeden önce MUTLAKA Hesapla popup'ından geçiyor. Tek kalan buton
  (eski "H") artık "HESAPLA" yazıyor ve aynı işi yapıyor: Hesapla popup'ını
  açar (bkz. hesapla-popup.js) — oradaki "✓ SEPETE EKLE" ile ürün sepete
  eklenir. SEÇ kalktığı için boşalan yatay alan HESAPLA butonuna verildi
  (bkz. product-style.css .btn-hesapla-ac) — satırın toplam genişliği
  DEĞİŞMEDİ.

  NOT: hataGoster / tarihiGuncelle / htmlEsc burada YENİDEN TANIMLANMAZ —
  cart-render.js bu sayfada daha önce yüklendiği için zaten global olarak
  var (üç dosyada da birebir aynı boilerplate).

  ÇALIŞAN İZİNLERİ (02.10.2026): auth.js, kısıtlı bir çalışan için
  window.izinVarMi(anahtar) fonksiyonunu sağlar (kısıtlı değilse / henüz
  yüklenmediyse her zaman true döner — bkz. auth.js). Burada şu anahtarlar
  kullanılır: sepetAramaGoster, sepetWebAc, sepetHesaplaAc. ("sepetSec" artık
  burada KULLANILMIYOR — SEÇ butonu kaldırıldığı için; izin tanımı
  cihaz-kullanici-render.js/calisan-erisim-render.js ayarlar ekranında
  geriye dönük uyumluluk için duruyor, ama artık hiçbir etkisi yok.)
*/

function uaIzinVarMi(anahtar){
  try{ return (typeof izinVarMi !== "function") || izinVarMi(anahtar); }
  catch(e){ return true; }
}

// EKLENDİ (22.10.2026, Abdullah'ın isteğiyle): HİT ve YENİ düğmeleri ayrı
// ayrı kısıtlanabilsin diye izin durumu burada tutulur — uaAramaSatiriDurumunuGuncelle
// odak/yazma durumuna göre görünürlüğü her güncellediğinde bu bayrakları da
// hesaba katar, yoksa izin kapalı olsa bile odaklanınca düğme geri gelirdi.
var UA_HIT_IZIN_VAR = true;
var UA_YENI_IZIN_VAR = true;

function uaIzinleriUygula(){
  try{
    var aramaBolumu = document.getElementById("uaAramaBolumu");
    if(aramaBolumu) aramaBolumu.hidden = !uaIzinVarMi("sepetAramaGoster");
    UA_HIT_IZIN_VAR = uaIzinVarMi("sepetHitGoster");
    UA_YENI_IZIN_VAR = uaIzinVarMi("sepetYeniUrunGoster");
    uaAramaSatiriDurumunuGuncelle(document.activeElement === document.getElementById("searchInput"));
  }catch(e){ hataGoster("Arama izinleri uygulanamadı: " + e.message); }
}

// YENİ ARAMA SATIRI (02.10.2026, Abdullah'ın isteğiyle): kutu boşken HİT/
// YENİ tuşları kutunun sağında görünür; kutuya dokununca (odaklanınca) veya
// bir şey yazılınca ikisi de gizlenip kutu tam satırı dolduruyor. Kutu
// tekrar boşalır ve odak kaybedilirse (blur) tuşlar geri gelir.
function uaAramaSatiriDurumunuGuncelle(odaklandiMi){
  try{
    var input = document.getElementById("searchInput");
    var gizle = odaklandiMi || input.value.trim().length > 0;
    document.getElementById("btnHitUrunler").hidden = gizle || !UA_HIT_IZIN_VAR;
    document.getElementById("btnYeniUrunAc").hidden = gizle || !UA_YENI_IZIN_VAR;
  }catch(e){}
}

function uaSonuclariCiz(){
  try{
    var q = document.getElementById("searchInput").value;
    var liste = document.getElementById("sonucListesi");
    var alan = document.getElementById("uaAramaSonucAlani");
    var bos = document.getElementById("bosMesaj");
    uaAramaSatiriDurumunuGuncelle(document.activeElement === document.getElementById("searchInput"));

    if(q.trim().length === 0){
      liste.innerHTML = "";
      alan.hidden = true;
      bos.hidden = true;
      return;
    }

    var sonuclar = ProductData.ara(q).slice(0, 30);
    if(sonuclar.length === 0){
      liste.innerHTML = "";
      alan.hidden = true;
      bos.hidden = false;
      return;
    }
    bos.hidden = true;
    alan.hidden = false;

    var webAcVarMi = uaIzinVarMi("sepetWebAc");
    var hesaplaVarMi = uaIzinVarMi("sepetHesaplaAc");
    // AŞAMA 2 (11.10.2026) — AI Ürün Asistanı: ai-urun-panel.js yüklü
    // değilse (örn. başka bir sayfa) veya izin kapalıysa hem uzun basma
    // hem erişilebilir 🤖 düğmesi tamamen devre dışı kalır, satırın
    // mevcut davranışı (kısa dokunma → WEICON sayfası) DEĞİŞMEDEN çalışır.
    var aiVarMi = uaIzinVarMi("sepetAiAc") && (typeof AiUrunPanel !== "undefined");

    var html = "";
    for(var i=0;i<sonuclar.length;i++){
      var idx = sonuclar[i].idx;
      var bilgi = ProductData.urunBilgisi(sonuclar[i].item);
      var aramaKodu = bilgi.abas || bilgi.berta || bilgi.ad;
      html += "<tr>"
        + "<td class='product-cell" + (webAcVarMi ? " product-cell--tikla" : "") + "' data-idx='" + idx + "' title='" + (webAcVarMi ? "dokununca WEICON sayfası açılır" : "") + "'>"
        + "<div class='tablo-kod'><span class='kod-blok kod-blok--b'><span class='kod-harf'>B</span> " + htmlEsc(bilgi.berta||"-") + "</span> <span class='kod-blok kod-blok--a'><span class='kod-harf'>A</span> " + htmlEsc(bilgi.abas||"-") + "</span>" + "</div>"
        + "<div class='urun-adi'>" + htmlEsc(bilgi.ad) + "</div>"
        + "</td>"
        + "<td class='urun-islem-hucre'><div class='urun-islem-grup'>"
        + "<span class='urun-fiyat-yazi'>" + bilgi.fiyat.toFixed(2) + " €</span>"
        + (hesaplaVarMi ? "<button class='btn-hesapla-ac' data-idx='" + idx + "' title='Hesapla ve Sepete Ekle' aria-label='Hesapla ve Sepete Ekle'>HESAPLA</button>" : "")
        + (aiVarMi ? "<button class='btn-ai-ac' data-idx='" + idx + "' title='AI Ürün Asistanı' aria-label='AI Ürün Asistanını aç'>🤖</button>" : "")
        + "</div></td>"
        + "</tr>";
    }
    liste.innerHTML = html;

    // Ürün hücresine dokununca WEICON sayfasını aç (eskiden ayrı 🔗
    // butonuydu — 02.10.2026, Abdullah'ın isteğiyle davranış satıra taşındı).
    if(webAcVarMi){
      liste.querySelectorAll(".product-cell--tikla").forEach(function(td){
        td.onclick = function(){
          var realIdx = parseInt(this.getAttribute("data-idx"), 10);
          var bilgi = ProductData.urunBilgisi(sonuclar.find(function(s){return s.idx===realIdx;}).item);
          var aramaKodu = bilgi.abas || bilgi.berta || bilgi.ad;
          window.open("https://www.weicon.com.tr/search?search=" + encodeURIComponent(aramaKodu), "_blank");
        };
      });
    }

    if(hesaplaVarMi){
      liste.querySelectorAll(".btn-hesapla-ac").forEach(function(btn){
        btn.onclick = function(e){
          e.stopPropagation();
          var realIdx = parseInt(this.getAttribute("data-idx"), 10);
          var bilgi = ProductData.urunBilgisi(sonuclar.find(function(s){return s.idx===realIdx;}).item);
          HesaplaPopup.ac({ad:bilgi.ad, berta:bilgi.berta, abas:bilgi.abas, fiyat:bilgi.fiyat}, null);
        };
      });
    }

    // KALDIRILDI (26.10.2026, Abdullah onayı — SEÇ butonu sadeleştirme):
    // burada SEÇ ("btn-add") butonunun hesaplamadan direkt CartData.ekle(...)
    // yapan tıklama işleyicisi vardı — buton kaldırıldığı için bu blok da
    // tamamen silindi. Artık TEK giriş yolu: HESAPLA → Hesapla popup →
    // "✓ SEPETE EKLE" (bkz. hesapla-popup.js listeyeEkleTiklandi).

    // AŞAMA 2 (11.10.2026) — AI Ürün Asistanı: erişilebilir 🤖 düğmesi
    // (klavye/ekran okuyucu için, uzun basmaya alternatif) + ürün
    // hücresine uzun basma dinleyicileri. Her çizimde (her tuş vuruşunda)
    // satırlar yeniden oluşturulduğu için eski <td>/<button> elemanları
    // (ve üzerlerindeki eski dinleyicileri) DOM'dan tamamen düşer — bu
    // yüzden burada yeniden bağlamak güvenlidir (diğer bloklarla aynı
    // desen, sızıntı/çakışma riski yok).
    if(aiVarMi){
      liste.querySelectorAll(".btn-ai-ac").forEach(function(btn){
        btn.onclick = function(e){
          e.stopPropagation();
          var realIdx = parseInt(this.getAttribute("data-idx"), 10);
          var bilgi = ProductData.urunBilgisi(sonuclar.find(function(s){return s.idx===realIdx;}).item);
          AiUrunPanel.ac(this.closest("tr"), bilgi);
        };
      });
      liste.querySelectorAll(".product-cell").forEach(function(td){
        var realIdx = parseInt(td.getAttribute("data-idx"), 10);
        var bilgi = ProductData.urunBilgisi(sonuclar.find(function(s){return s.idx===realIdx;}).item);
        AiUrunPanel.uzunBasmaBagla(td, td.closest("tr"), bilgi);
      });
    }
  }catch(e){ hataGoster("Arama sonuçları çizilemedi: " + e.message); }
}

var TIP_ETIKET_URUN = {siparis:"SP", teklif:"FT", proforma:"PF", numune:"NM"};
// RENK GÜNCELLEMESİ (12.10.2026, Abdullah onayı — kurumsal/yumuşatılmış "Seçenek B").
var TIP_RENK_URUN = {siparis:"#38469a", teklif:"#249147", proforma:"#dcb13c", numune:"#c0453a"};
// Sarı (proforma) zemininde beyaz yazı okunmuyor (kontrast ~2:1) — sadece bu rozette metin rengi geçiliyor.
var TIP_METIN_RENK_URUN = {proforma:"#2b2300"};

function uaUrunSatisGecmisiGetir(berta, abas){
  var tipler = ["siparis","teklif","proforma","numune"];
  var sonuc = [];
  tipler.forEach(function(tip){
    ReportsData.sonIslemler().filter(function(k){ return k.tip===tip; }).forEach(function(kayit){
      (kayit.urunler||[]).forEach(function(u){
        if(u.berta===berta && u.abas===abas){
          sonuc.push({
            musteri: kayit.musteri||"-", tarih: kayit.tarih||"", ts: kayit.ts||0, tip: tip,
            adet: u.adet||0, iskBirim: u.iskBirim||0, iskonto: u.iskonto||0
          });
        }
      });
    });
  });
  sonuc.sort(function(a,b){ return (b.ts||0)-(a.ts||0); });
  return sonuc;
}

function uaUrunSatisGecmisiniAc(berta, abas, ad){
  try{
    var gecmis = uaUrunSatisGecmisiGetir(berta, abas);
    var musteriSeti = {}; var toplamAdet = 0;
    gecmis.forEach(function(g){ musteriSeti[g.musteri]=true; toplamAdet += g.adet; });

    document.getElementById("urunGecmisKod").textContent = "Berta: " + (berta||"-") + " · Abas: " + (abas||"-");
    document.getElementById("urunGecmisAd").textContent = ad;
    document.getElementById("urunGecmisMusteriSayisi").textContent = Object.keys(musteriSeti).length;
    document.getElementById("urunGecmisToplamAdet").textContent = toplamAdet + " adet";

    var kapsayici = document.getElementById("urunGecmisListesi");
    if(gecmis.length === 0){
      kapsayici.innerHTML = "<p class='bos-mesaj'>Bu ürün henüz hiçbir müşteriye satılmamış/teklif edilmemiş.</p>";
    } else {
      kapsayici.innerHTML = gecmis.map(function(g){
        return "<div class='urun-gecmis-satir'>"
          + "<div class='urun-gecmis-satir-ust'>"
          + "<span class='urun-gecmis-tip-rozet' style='background:" + (TIP_RENK_URUN[g.tip]||"#2d3540") + ";color:" + (TIP_METIN_RENK_URUN[g.tip]||"#ffffff") + ";'>" + (TIP_ETIKET_URUN[g.tip]||"") + "</span>"
          + "<span class='urun-gecmis-musteri'>" + htmlEsc(g.musteri) + "</span>"
          + "<span class='urun-gecmis-tarih'>" + htmlEsc(g.tarih) + "</span>"
          + "</div>"
          + "<div class='urun-gecmis-detay'>" + g.adet + " adet · " + g.iskBirim.toFixed(2) + " EURO/birim · %" + g.iskonto + " iskonto</div>"
          + "</div>";
      }).join("");
    }

    document.getElementById("ozelListeBolumu").hidden = true;
    document.getElementById("urunGecmisBolumu").hidden = false;
    document.getElementById("urunGecmisBolumu").scrollIntoView({behavior:"smooth", block:"start"});
    uaAltAlanlariGizle();
  }catch(e){ hataGoster("Ürün satış geçmişi açılamadı: " + e.message); }
}

// YENİ (04.10.2026, Abdullah'ın isteğiyle): Ürün Satış Geçmişi veya Hit
// Ürünler listesi açıkken sepetin "Sepetiniz boş" mesajı ve Kaydet/
// Görüntüle ve Gönder butonları EKRANDA GÖRÜNMESİN — bu bölümler kapanınca
// sayfayiCiz() çağrılıp doğru (sepet durumuna göre) hale geri dönülür.
function uaAltAlanlariGizle(){
  try{
    document.getElementById("sepetBosMesaj").hidden = true;
    document.getElementById("sepetAltButonSatiri").hidden = true;
    document.getElementById("btnSepetIptal").hidden = true;
  }catch(e){}
}

function uaHitUrunleriHesapla(){
  var haritalar = {};
  ["siparis"].forEach(function(tip){
    ReportsData.sonIslemler().filter(function(k){ return k.tip===tip; }).forEach(function(kayit){
      (kayit.urunler||[]).forEach(function(u){
        var anahtar = (u.berta||"")+"|"+(u.abas||"");
        if(!haritalar[anahtar]) haritalar[anahtar] = {ad:u.ad, berta:u.berta, abas:u.abas, adet:0, fiyat:u.listeFiyat||0};
        haritalar[anahtar].adet += u.adet||0;
      });
    });
  });
  return Object.values(haritalar).sort(function(a,b){ return b.adet-a.adet; });
}

function uaOzelListeyiAc(baslik, liste){
  document.getElementById("ozelListeBaslik").textContent = baslik;
  var govde = document.getElementById("ozelListeGovde");
  if(liste.length === 0){
    govde.innerHTML = "<tr><td colspan='3' style='text-align:center;color:#8a97a6;padding:16px;'>Henüz sipariş kaydı yok.</td></tr>";
  } else {
    govde.innerHTML = liste.slice(0,30).map(function(u,i){
      return "<tr data-i='" + i + "'>"
        + "<td class='hit-urun-sira-ad'>" + (i+1) + ". " + htmlEsc(u.ad) + "<div class='hit-urun-kod'><span class='kod-blok kod-blok--b'><span class='kod-harf'>B</span> " + htmlEsc(u.berta||"-") + "</span> <span class='kod-blok kod-blok--a'><span class='kod-harf'>A</span> " + htmlEsc(u.abas||"-") + "</span>" + "</div></td>"
        + "<td class='hit-urun-adet'>" + u.adet + "</td>"
        + "<td>📊</td>"
        + "</tr>";
    }).join("");
  }
  document.getElementById("urunGecmisBolumu").hidden = true;
  document.getElementById("ozelListeBolumu").hidden = false;
  uaAltAlanlariGizle();

  govde.querySelectorAll("tr[data-i]").forEach(function(tr){
    tr.onclick = function(){
      var i = parseInt(this.getAttribute("data-i"), 10);
      var u = liste[i];
      uaUrunSatisGecmisiniAc(u.berta, u.abas, u.ad);
    };
  });
}

document.addEventListener("DOMContentLoaded", function(){
  document.getElementById("searchInput").addEventListener("input", uaSonuclariCiz);
  document.getElementById("searchInput").addEventListener("focus", function(){ uaAramaSatiriDurumunuGuncelle(true); });
  document.getElementById("searchInput").addEventListener("blur", function(){ uaAramaSatiriDurumunuGuncelle(false); });

  document.getElementById("btnHitUrunler").onclick = function(){
    uaOzelListeyiAc("🔥 Hit Ürünler (en çok satılan)", uaHitUrunleriHesapla());
  };
  document.getElementById("btnOzelListeKapat").onclick = function(){
    document.getElementById("ozelListeBolumu").hidden = true;
    if(typeof sayfayiCiz === "function") sayfayiCiz();
  };
  document.getElementById("btnUrunGecmisKapat").onclick = function(){
    document.getElementById("urunGecmisBolumu").hidden = true;
    if(typeof sayfayiCiz === "function") sayfayiCiz();
  };

  document.getElementById("btnYeniUrunAc").onclick = function(){
    document.getElementById("yeniUrunBerta").value = "";
    document.getElementById("yeniUrunAbas").value = "";
    document.getElementById("yeniUrunAdi").value = "";
    document.getElementById("yeniUrunFiyat").value = "";
    document.getElementById("yeniUrunHata").hidden = true;
    document.getElementById("yeniUrunOverlay").hidden = false;
    document.getElementById("yeniUrunOverlay").scrollIntoView({behavior:"smooth", block:"start"});
  };
  document.getElementById("btnYeniUrunVazgec").onclick = function(){
    document.getElementById("yeniUrunOverlay").hidden = true;
  };
  document.getElementById("btnYeniUrunKaydet").onclick = function(){
    var bilgi = {
      berta: document.getElementById("yeniUrunBerta").value,
      abas: document.getElementById("yeniUrunAbas").value,
      ad: document.getElementById("yeniUrunAdi").value,
      fiyat: document.getElementById("yeniUrunFiyat").value
    };
    var hataEl = document.getElementById("yeniUrunHata");
    hataEl.hidden = true;
    var btn = document.getElementById("btnYeniUrunKaydet");
    btn.disabled = true;
    btn.textContent = "Kaydediliyor...";
    ProductData.yeniUrunEkle(bilgi, function(basarili, sonuc){
      btn.disabled = false;
      btn.textContent = "✓ Kaydet";
      if(basarili){
        alert("✓ \"" + bilgi.ad + "\" listeye eklendi.");
        document.getElementById("yeniUrunOverlay").hidden = true;
      } else {
        hataEl.textContent = "⚠️ " + (typeof sonuc === "string" ? sonuc : (sonuc && sonuc.message ? sonuc.message : "Eklenemedi."));
        hataEl.hidden = false;
      }
    });
  };

  window.addEventListener("weiconAuthHazir", uaIzinleriUygula);
  uaIzinleriUygula();
  ProductData.katalogDegistiginde(uaSonuclariCiz);
  uaSonuclariCiz();

  // EKLENDİ (26.10.2026, Abdullah'ın isteğiyle): Hesapla popup'tan "✓ SEPETE
  // EKLE" ile sepete eklenince, arama kutusu + sonuç listesi burada HEMEN
  // sıfırlanır — eskiden arama metni/sonuç listesi ekrandan gitmiyordu,
  // kullanıcı her seferinde elle silmek zorunda kalıyordu. HesaplaPopup'ın
  // zaten var olan genel kancasını kullanıyoruz (bkz. hesapla-popup.js
  // onEklendi — calc.html da kendi kancasını AYRI AYRI bağlıyor, burada
  // birbirlerini ETKİLEMİYOR). Kutuyu boşaltıp odağı geri vermek, yeni
  // ürünü aramaya hemen devam edebilsin diye.
  if(typeof HesaplaPopup !== "undefined"){
    HesaplaPopup.onEklendi(function(yeniEklemeMiydi){
      // SADECE arama sonucundan YENİ bir ürün eklendiğinde sıfırlanır —
      // sepetteki mevcut bir satır düzenlenip güncellendiğinde (popup oraya
      // tıklanarak açıldıysa) arama kutusuna dokunulmaz, çünkü o akışta
      // zaten arama kutusuyla bir ilgisi yoktu.
      if(!yeniEklemeMiydi) return;
      var input = document.getElementById("searchInput");
      if(!input) return;
      input.value = "";
      uaSonuclariCiz();
      input.focus();
    });
  }
});
