/*
  product-render.js
  =================
  TEK görevi: arama kutusunu dinlemek, ProductData.ara()'dan sonuç almak ve
  ekrana kart olarak basmak. Hesaplama/Firebase mantığı içermez.
*/

function hataGoster(mesaj){
  console.error(mesaj);
  if(typeof HataLog !== "undefined") HataLog.kaydet(mesaj);
  var kutu = document.createElement("div");
  kutu.textContent = "⚠️ " + mesaj;
  kutu.style.cssText = "position:fixed;top:8px;left:8px;right:8px;background:#c0392b;color:#fff;padding:10px;border-radius:8px;font-size:13px;z-index:99999;";
  document.body.appendChild(kutu);
  setTimeout(function(){ kutu.remove(); }, 8000);
}

function tarihiGuncelle(){
  try{
    var el = document.getElementById("gunTarihi");
    if(!el) return;
    var gunler = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
    var aylar = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
    var d = new Date();
    el.textContent = gunler[d.getDay()] + ", " + d.getDate() + " " + aylar[d.getMonth()] + " " + d.getFullYear();
  }catch(e){ hataGoster("Tarih güncellenemedi: " + e.message); }
}

function htmlEsc(s){
  return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// AI ile Açıkla butonunun data-* özniteliklerine özel (01.10.2026) — bu
// değerler çift tırnakla sarıldığı için burada sadece " karakterini
// kaçırmak yeterli (htmlEsc'i genel olarak değiştirip başka hiçbir yeri
// etkilemek istemedim).
function aiAttrEsc(s){
  return htmlEsc(s).replace(/"/g, "&quot;");
}

function sonuclariCiz(){
  try{
    var q = document.getElementById("searchInput").value;
    var liste = document.getElementById("sonucListesi");
    var bos = document.getElementById("bosMesaj");
    var yukleniyor = document.getElementById("yukleniyorMesaj");

    if(ProductData.katalogUzunluk() === 0){
      liste.innerHTML = "";
      bos.hidden = true;
      yukleniyor.hidden = false;
      return;
    }
    yukleniyor.hidden = true;

    var sonuclar = ProductData.ara(q);
    // Arama kutusu boşken sonuç listesini şişirmemek için sınırla
    if(q.trim().length === 0) sonuclar = sonuclar.slice(0, 30);

    if(sonuclar.length === 0){
      liste.innerHTML = "";
      bos.hidden = false;
      return;
    }
    bos.hidden = true;

    var html = "";
    for(var i=0;i<sonuclar.length;i++){
      var idx = sonuclar[i].idx;
      var bilgi = ProductData.urunBilgisi(sonuclar[i].item);
      html += "<tr>"
        + "<td class='product-cell product-cell--tikla' data-arama='" + htmlEsc(bilgi.abas || bilgi.berta || bilgi.ad) + "'>"
        + "<div class='tablo-kod'><span class='kod-blok kod-blok--b'><span class='kod-harf'>B</span> " + htmlEsc(bilgi.berta||"-") + "</span> <span class='kod-blok kod-blok--a'><span class='kod-harf'>A</span> " + htmlEsc(bilgi.abas||"-") + "</span>" + "</div>"
        + "<div class='urun-adi'>" + htmlEsc(bilgi.ad) + "</div>"
        + "</td>"
        + "<td class='urun-islem-hucre'><div class='urun-islem-grup'>"
        + "<span class='urun-fiyat-yazi'>" + bilgi.fiyat.toFixed(2) + " €</span>"
        + "<button class='btn-link-ac' title='WEICON sayfasını aç' aria-label='WEICON sayfasını aç'"
        + " data-arama=\"" + aiAttrEsc(bilgi.abas || bilgi.berta || bilgi.ad) + "\">🔗</button>"
        + "<button class='btn-add' data-idx='" + idx + "'>SEÇ</button>"
        + "</div></td>"
        + "</tr>";
    }
    liste.innerHTML = html;

    // DÜZELTME (01.10.2026, Abdullah'ın isteğiyle): ürün hücresine dokununca
    // da WEICON sayfası açılıyordu, bu da 🔗 butonuyla ÇAKIŞIYORDU (aynı anda
    // iki yoldan aynı sayfa açılıyordu). Artık SADECE 🔗 butonu (.btn-link-ac,
    // aşağıda) açıyor — ürün ismine dokunmak artık hiçbir şey açmıyor.

    // Buton olayları — HTML string'e onclick gömmek yerine burada bağlanıyor
    var butonlar = liste.querySelectorAll(".btn-add");
    butonlar.forEach(function(btn){
      btn.onclick = function(e){
        e.stopPropagation();
        var idx = parseInt(this.getAttribute("data-idx"), 10);
        var eklendiMi = ProductData.sepeteEkleCikar(idx);
        sepetSatiriniGuncelle();
        sonuclariCiz(); // buton durumunu tazele
        if(eklendiMi){
          document.getElementById("searchInput").value = "";
          document.getElementById("searchInput").focus();
          sonuclariCiz();
        }
      };
    });

    // WEICON sayfasını aç butonu (01.10.2026 yeniden tasarım) — artık
    // İŞLEM hücresinde ayrı bir ikon, ürün hücresindeki eski tıklama
    // davranışıyla aynı adrese gidiyor.
    liste.querySelectorAll(".btn-link-ac").forEach(function(btn){
      btn.onclick = function(e){
        e.stopPropagation();
        var kod = this.getAttribute("data-arama");
        window.open("https://www.weicon.com.tr/search?search=" + encodeURIComponent(kod), "_blank");
      };
    });
  }catch(e){ hataGoster("Sonuçlar çizilemedi: " + e.message); }
}

function sepetSatiriniGuncelle(){
  try{
    var sayi = ProductData.sepetSayisi();
    document.getElementById("sepetSayisi").textContent = sayi;
    var btn = document.getElementById("btnSepeteDevam");
    btn.hidden = sayi === 0;
    // Madde 4 düzeltme (22.09.2026): "Boşalt" artık sepet dolu/boş
    // durumuna göre değil, müşteri seçili olup olmamasına göre görünür —
    // Cari Bilgi kutusuyla aynı mantık, birlikte gelip birlikte gidiyorlar.
    var musteriSecili = cariBilgiSatiriniGuncelle();
    document.getElementById("btnSepetiBosalt").hidden = !musteriSecili;
  }catch(e){ hataGoster("Sepet satırı güncellenemedi: " + e.message); }
}

// Madde 4 (22.09.2026): hangi müşteriye işlem yapıldığını takip etmek için
// müşteri adı, sepet satırının hemen üstünde. TEK koşul: bir müşteri
// seçili olması — sepet boş olsa da kutu (ve Boşalt butonu) görünür
// kalır. Geriye, o an bir müşteri seçili olup olmadığını döner.
function cariBilgiSatiriniGuncelle(){
  var kutu = document.getElementById("urunBulCariBilgi");
  if(typeof CustomerData === "undefined"){ kutu.hidden = true; return false; }
  var musteri = CustomerData.seciliyiOku();
  if(!musteri){ kutu.hidden = true; return false; }
  MusteriSeridi.uygula("urunBulCariBilgi", musteri);
  kutu.hidden = false;
  return true;
}

window.addEventListener("error", function(ev){
  hataGoster("HATA: " + ev.message + " (" + (ev.filename||"").split("/").pop() + ":" + ev.lineno + ")");
});

var TIP_ETIKET_URUN = {siparis:"SP", teklif:"FT", proforma:"PF", numune:"NM"};
// RENK GÜNCELLEMESİ (12.10.2026, Abdullah onayı — kurumsal/yumuşatılmış "Seçenek B").
var TIP_RENK_URUN = {siparis:"#38469a", teklif:"#249147", proforma:"#dcb13c", numune:"#c0453a"};
// Sarı (proforma) zemininde beyaz yazı okunmuyor (kontrast ~2:1) — sadece bu rozette metin rengi geçiliyor.
var TIP_METIN_RENK_URUN = {proforma:"#2b2300"};

function urunSatisGecmisiGetir(berta, abas){
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

function urunSatisGecmisiniAc(berta, abas, ad){
  try{
    var gecmis = urunSatisGecmisiGetir(berta, abas);
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
    document.getElementById("anaTabloAlani").hidden = true;
    document.getElementById("urunGecmisBolumu").hidden = false;
    document.getElementById("urunGecmisBolumu").scrollIntoView({behavior:"smooth", block:"start"});
  }catch(e){ hataGoster("Ürün satış geçmişi açılamadı: " + e.message); }
}

function hitUrunleriHesapla(){
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

function ozelListeyiAc(baslik, liste){
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
  document.getElementById("anaTabloAlani").hidden = true;
  document.getElementById("urunGecmisBolumu").hidden = true;
  document.getElementById("ozelListeBolumu").hidden = false;

  govde.querySelectorAll("tr[data-i]").forEach(function(tr){
    tr.onclick = function(){
      var i = parseInt(this.getAttribute("data-i"), 10);
      var u = liste[i];
      urunSatisGecmisiniAc(u.berta, u.abas, u.ad);
    };
  });
}

document.addEventListener("DOMContentLoaded", function(){
  tarihiGuncelle();
  document.getElementById("searchInput").addEventListener("input", sonuclariCiz);
  // Sepet sızıntısı düzeltmesi (22.09.2026): Ürün Bul'dan Geri, Ana Sayfa
  // veya Menü ile ayrılınca sepet SESSİZCE (sormadan) sıfırlanır — eskiden
  // bu üç çıkış yolu da sepeti temizlemiyordu, bir sonraki müşteride eski
  // ürünler sepette "hayalet" olarak kalıyordu.
  function sepetiSessizceTemizle(){
    try{ localStorage.setItem("weiconv2_sepet", "[]"); }catch(e){}
    try{ localStorage.removeItem("weiconv2_sepet_kur_override"); }catch(e){}
  }
  var geriLinkEl = document.querySelector(".nav-btn--geri");
  if(geriLinkEl) geriLinkEl.addEventListener("click", sepetiSessizceTemizle);
  var anaLinkEl = document.querySelector(".nav-btn--ana");
  if(anaLinkEl) anaLinkEl.addEventListener("click", sepetiSessizceTemizle);
  var btnMenuEl = document.getElementById("btnMenu");
  if(btnMenuEl) btnMenuEl.onclick = function(){ sepetiSessizceTemizle(); window.location.href = "menu.html"; };
  document.getElementById("btnSepeteDevam").onclick = function(){ window.location.href = "cart.html"; };
  document.getElementById("btnSepetiBosalt").onclick = function(){
    if(!confirm("Sepetteki tüm ürünler kaldırılacak. Emin misiniz?")) return;
    ProductData.sepetiBosalt();
    sepetSatiriniGuncelle();
    sonuclariCiz();
  };
  if(typeof CustomerData !== "undefined"){
    CustomerData.listeDegistiginde(function(){ sepetSatiriniGuncelle(); });
  }

  document.getElementById("btnHitUrunler").onclick = function(){
    ozelListeyiAc("🔥 Hit Ürünler (en çok satılan)", hitUrunleriHesapla());
  };
  document.getElementById("btnOzelListeKapat").onclick = function(){
    document.getElementById("ozelListeBolumu").hidden = true;
    document.getElementById("anaTabloAlani").hidden = false;
  };
  document.getElementById("btnUrunGecmisKapat").onclick = function(){
    document.getElementById("urunGecmisBolumu").hidden = true;
    document.getElementById("anaTabloAlani").hidden = false;
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

  ProductData.katalogDegistiginde(sonuclariCiz);
  sepetSatiriniGuncelle();
  sonuclariCiz();
});
