/*
  rota-takip.js
  =============
  Tıklanabilir "rota şeridi" — Abdullah'ın isteğiyle (15.09.2026) eski statik
  gri ".rota-etiketi" yazısının yerine geçiyor. Ziyaret edilen sayfalar
  sessionStorage'da bir yığın olarak tutulur; her durak kendi sayfasına
  giden bir bağlantı olur, en sondaki (şu an bulunulan sayfa) tıklanamaz.

  Kullanım (her sayfanın kendi <script> bloğunda, DOMContentLoaded içinde):
    RotaTakip.kaydet("cart.html", "Sepet");
    RotaTakip.ciz("rotaSeridi");

  Ana Sayfa'ya dönüldüğünde (sifirlaMi=true) yığın temizlenir — "Ana
  Sayfa'ya gitmek zaten benim rotamı sıfırlamak istediğim an" (Abdullah).
  Aynı sayfaya tekrar gelinirse (örn. geri gidip farklı bir yoldan aynı
  sayfaya varılırsa) yığın o noktada kesilir, sonsuza kadar büyümez.
*/
var RotaTakip = (function(){
  var ANAHTAR = "weiconv2_rota_yigin";

  function yiginiOku(){
    try{ return JSON.parse(sessionStorage.getItem(ANAHTAR)||"[]"); }catch(e){ return []; }
  }
  function yiginiYaz(yigin){
    try{ sessionStorage.setItem(ANAHTAR, JSON.stringify(yigin)); }catch(e){}
  }

  function kaydet(href, etiket, sifirlaMi){
    var yigin = sifirlaMi ? [] : yiginiOku();
    var mevcutIdx = -1;
    for(var i=0;i<yigin.length;i++){ if(yigin[i].href === href){ mevcutIdx = i; break; } }
    if(mevcutIdx !== -1){
      yigin = yigin.slice(0, mevcutIdx+1);
    } else {
      yigin.push({href: href, etiket: etiket});
    }
    yiginiYaz(yigin);
    return yigin;
  }

  function sifirla(){ yiginiYaz([]); }

  function ciz(konteynerId){
    var yigin = yiginiOku();
    var el = document.getElementById(konteynerId);
    if(!el || yigin.length === 0) return;
    var mevcut = yigin[yigin.length-1];
    // GUNCELLENDI (01.11.2026, Abdullah onayi — birlesik ust bar mockup'i):
    // eskiden burada "<isim> › <ebeveyn rotasi>" breadcrumb zinciri yazılırdı
    // (ayrı turuncu .sayfa-rota-serit şeridi içinde, bolca yer vardı). Artık
    // bu etiket üst bardaki dar .ub-sayfa-etiket kutusuna taşındı — sadece
    // o anki sayfa adı gösteriliyor, zincir metni (rota) artık YAZILMIYOR.
    // Başındaki emoji de (tüm üst bar etiketleriyle tutarlı olsun diye)
    // ekrana basılırken ayıklanıyor — yığında (sessionStorage) tam etiket
    // hâlâ saklanıyor, sadece görünen metin sadeleşti.
    var temizEtiket = mevcut.etiket.replace(/^\S+\s+/, function(ilkKelime){
      return /[A-Za-zÇĞİIÖŞÜçğıiöşü]/.test(ilkKelime) ? ilkKelime : "";
    });
    el.innerHTML = "<span>" + temizEtiket + "</span>";
  }

  return { kaydet: kaydet, ciz: ciz, sifirla: sifirla };
})();
