/*
  maas-hesaplama-render.js — TKP.02.11.26-20:16.1446
  ==========================================================
  MAAŞ HESAPLAMA (ÖZET) sayfası — 27.09.2026 mimari bölünmesi. Bu sayfa
  artık kendi Brüt Sabit Maaş / Brüt Prim hesaplamasını yapmıyor; Net
  Maaş ve Net Prim'i MaasOrtakHesap.hesapla() üzerinden okur (Net Maaş
  sayfası ve Ödenebilir Komisyon'un Brüt/Net Prim bölümü de AYNI çağrıyı
  yapıyor, bu yüzden üç sayfadaki rakamlar hep tutarlı kalır). Avans/diğer
  kesinti hâlâ bu sayfada okunur — Avans Takibi sayfasından (kapalı kayıt
  varsa onu, yoksa açık taslağı) — sadece maaşa EKLENMİŞ aylar — gelir. "GEÇERLİ AYIN HESABI
  KAPANDI" hem Maaş kaydını hem — hâlâ açıksa — aynı ayın Avans Takibi'ni
  senkron kapatır. Tek kapat noktası burasıdır.
*/

var AY_ADLARI_MH = ["","Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
var mhGuncelHesap = null; // en son mhHesaplaVeCiz() çıktısı — Kayıt Et bunu kullanır

// AVANS KESİNTİSİ (02.11.2026, Abdullah onayı): eski "Avans Seçimi" penceresi
// KALDIRILDI. Hangi avansların bu ayın maaşından düşüleceği artık Avans
// Takibi'ndeki "➕ Maaşa ekle" ile belirlenir: eklenen avans satırları
// (avans girişinin üstündeki "maasa" işareti) bu maaşa girer; maaş kapanınca
// "Maaştan düşüldü" olur. Bu sayfa sadece AvansKayitData.maasKesintisi()'ni
// okur — Ana Sayfa özeti de AYNI fonksiyonu kullanır (tek kaynak).

function fmtTL_MH(n){
  return (n||0).toLocaleString("tr-TR", {minimumFractionDigits:2, maximumFractionDigits:2}) + " TL";
}

function tarihiGuncelle_MH(){
  try{
    var el = document.getElementById("gunTarihi");
    if(!el) return;
    var gunler = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
    var d = new Date();
    el.textContent = gunler[d.getDay()] + ", " + d.getDate() + " " + AY_ADLARI_MH[d.getMonth()+1] + " " + d.getFullYear();
  }catch(e){}
}

function mhAcikDonemEtiketiGuncelle(){
  var acik = MaasKayitData.acikDonem();
  var etiket = document.getElementById("mhDonemBtnMetin");
  if(etiket) etiket.textContent = AY_ADLARI_MH[acik.ay] + " " + acik.yil;
  document.getElementById("mhKartBaslikAy").textContent = AY_ADLARI_MH[acik.ay] + " " + acik.yil;
  document.getElementById("btnAyiKayitEt").textContent = "✓ GEÇERLİ AYIN HESABI KAPANDI";
  return acik;
}

// DÖNEM BARI — 0 = açık/canlı dönem (mhHesaplaVeCiz ile canlı hesaplanır),
// 1+ = MaasKayitData.tumKayitlar()[ofset-1] (kapanmış kayıt, salt okunur).
var mhGezinmeOfset = 0;

function mhDuzenlemeGorunurlugunuAyarla(gorunurMu){
  document.getElementById("btnAyiKayitEt").hidden = !gorunurMu;
  document.getElementById("btnMhKapaliKaydiSil").hidden = gorunurMu;
  document.getElementById("mhKapaliSerit").hidden = gorunurMu;
}

// CANLI (açık) dönem için avans toplamlarını HER ZAMAN Avans Takibi'nin
// açık taslağından okur (27.09.2026 senkron düzeltmesi) — eski kod önce
// AvansKayitData.kapaliKaydiBul'a bakıyordu; Avans Takibi kendi bağımsız
// zincirinde o ay için eski/kalıntı bir "kapalı" kayıt varsa (örn. bu ay
// Maaş Hesaplama'da hâlâ açıkken), burada yanlışlıkla "kapatıldı, 0,00 TL"
// gösteriliyor ve iki sayfa birbirini tutmuyordu. Açık dönem için TEK
// doğru kaynak her zaman canlı taslaktır.
function mhAvansCanliOku(ay, yil){
  // Tek hesap noktası: AvansKayitData.taslakDevirli (devir YOK — 02.11.2026'da kaldırıldı).
  var d = AvansKayitData.taslakDevirli(ay, yil);
  return {
    ozelToplam: d.ozelToplam, isKesilecek: d.isKesilecek, toplamKesinti: d.toplamKesinti
  };
}

function mhKapaliKaydiGoster(k){
  mhDuzenlemeGorunurlugunuAyarla(false);
  var etiket = document.getElementById("mhDonemBtnMetin");
  if(etiket) etiket.textContent = AY_ADLARI_MH[k.ay] + " " + k.yil;
  document.getElementById("mhKartBaslikAy").textContent = AY_ADLARI_MH[k.ay] + " " + k.yil;
  document.getElementById("mhOzetBrutSabitAlt").textContent = "Brüt: " + fmtTL_MH(k.brutSabitAylik);
  document.getElementById("mhOzetNetMaas").textContent = fmtTL_MH(k.netSabitMaas);
  document.getElementById("mhOzetBrutPrimAlt").textContent = "Brüt: " + fmtTL_MH(k.brutPrim);
  document.getElementById("mhOzetNetPrim").textContent = fmtTL_MH(k.netPrim);
  document.getElementById("mhKartNetToplam").textContent = fmtTL_MH(k.netToplam);
  document.getElementById("mhKartHesabaYatacak").textContent = fmtTL_MH(k.hesabaYatacak);
  // Kapanmış dönem: rakam artık bu kayıtta SAKLI (o an kapatılırken
  // hesaplanmış toplamKesinti) — Avans Takibi'nin bugünkü/güncel taslağına
  // hiç bakılmaz, çünkü o taslak zaten kapatılırken sıfırlandı/silindi.
  document.getElementById("mhOzetAvansToplam").textContent = fmtTL_MH(k.toplamKesinti);
  document.getElementById("mhOzetAvansDurum").textContent = "✓ Kapatıldı.";
  // Kapanmış dönemde yeşil "eklendi" görünümü açık dönemden kalmasın.
  var avSatir = document.getElementById("mhAvansSatiri");
  if(avSatir) avSatir.classList.remove("mh-ozet-satir--yesil");
  var avRozet = document.getElementById("mhAvansRozet");
  if(avRozet) avRozet.hidden = true;
  document.getElementById("btnMhKapaliKaydiSil").setAttribute("data-anahtar", k.anahtar);
}

function mhGorunumCiz(){
  var kayitlar = MaasKayitData.tumKayitlar();
  if(mhGezinmeOfset > kayitlar.length) mhGezinmeOfset = kayitlar.length;
  if(mhGezinmeOfset < 0) mhGezinmeOfset = 0;

  var btnOnceki = document.getElementById("mhDonemOncekiBtn");
  var btnSonraki = document.getElementById("mhDonemSonrakiBtn");
  if(btnOnceki) btnOnceki.hidden = (mhGezinmeOfset >= kayitlar.length);
  if(btnSonraki) btnSonraki.hidden = (mhGezinmeOfset === 0);

  if(mhGezinmeOfset === 0){
    mhDuzenlemeGorunurlugunuAyarla(true);
    mhHesaplaVeCiz();
  } else {
    mhKapaliKaydiGoster(kayitlar[mhGezinmeOfset - 1]);
  }
}

function mhHesaplaVeCiz(){
  var acik = mhAcikDonemEtiketiGuncelle();
  var acikAnahtar = acik.yil + "-" + ("0"+acik.ay).slice(-2);
  var h = MaasOrtakHesap.hesapla(acik.ay, acik.yil);
  var sonuc = h.sonuc;

  document.getElementById("mhOzetBrutSabitAlt").textContent = "Brüt: " + fmtTL_MH(h.brutSabit);
  document.getElementById("mhOzetNetMaas").textContent = fmtTL_MH(sonuc.netSabitMaas);
  document.getElementById("mhOzetBrutPrimAlt").textContent = "Brüt: " + fmtTL_MH(h.brutPrim);
  document.getElementById("mhOzetNetPrim").textContent = fmtTL_MH(sonuc.netPrim);
  document.getElementById("mhKartNetToplam").textContent = fmtTL_MH(sonuc.netToplam);

  // Açık dönem her zaman CANLI taslaktan okunur — bkz. mhAvansCanliOku
  // yorumu. Bu ayın maaşından düşülecek TOPLAM = Avans Takibi'nde bu maaş
  // dönemine "Maaşa ekle" ile eklenmiş avans satırlarının kalanı.
  var av = mhAvansCanliOku(acik.ay, acik.yil);
  var kesinti = AvansKayitData.maasKesintisi(acik.ay, acik.yil);
  var toplamKesintiYeni = kesinti.toplam;

  mhAvansSatiriGuncelle(kesinti, av);

  var hesabaYatacak = sonuc.netToplam - toplamKesintiYeni;
  document.getElementById("mhKartHesabaYatacak").textContent = fmtTL_MH(hesabaYatacak);

  mhGuncelHesap = {
    acik: acik, acikAnahtar: acikAnahtar, brutSabit: h.brutSabit, birinciToplam: h.birinciToplam, brutPrim: h.brutPrim,
    sonuc: sonuc, avans: av, kesinti: kesinti,
    toplamKesintiYeni: toplamKesintiYeni, hesabaYatacak: hesabaYatacak
  };
}

// "🧾 AVANS / KESİNTİ" satırını günceller (02.11.2026, Abdullah onayı — mockup üzerinden):
// Avans Takibi'nden maaşa EKLENEN aylar varsa YEŞİL kart + "N ay" rozeti +
// "Ekim, Eylül avansı eklendi"; yoksa "Maaşa avans eklenmedi.". Henüz
// eklenmemiş (Açık) avans varsa alt satır bunu hatırlatır.
function mhAvansSatiriGuncelle(kesinti, av){
  var satir = document.getElementById("mhAvansSatiri");
  var rozet = document.getElementById("mhAvansRozet");
  var alt = document.getElementById("mhOzetAvansDurum");
  var deger = document.getElementById("mhOzetAvansToplam");
  if(!satir || !alt || !deger) return;

  // Maaşa eklenen avansların AYLARI (yeniden eskiye): "Ekim, Eylül avansı eklendi".
  var parcalar = kesinti.aylar.map(function(a){ return AY_ADLARI_MH[a.ay]; });
  var adet = parcalar.length;

  satir.classList.toggle("mh-ozet-satir--yesil", adet > 0);
  if(rozet){ rozet.hidden = adet === 0; rozet.textContent = adet + " ay"; }
  deger.textContent = kesinti.toplam > 0 ? "- " + fmtTL_MH(kesinti.toplam) : fmtTL_MH(0);

  var metin;
  if(adet > 0){
    metin = parcalar.join(", ") + " avansı eklendi";
  } else {
    metin = "Maaşa avans eklenmedi.";
  }
  if(kesinti.bekleyenSayisi > 0){
    metin += "\n⏳ " + kesinti.bekleyenSayisi + " açık avans (" + fmtTL_MH(kesinti.bekleyenToplam) + ") — Avans Takibi'nden ekle";
  }
  alt.textContent = metin;
}

document.addEventListener("DOMContentLoaded", function(){
  tarihiGuncelle_MH();
  var btnMenuEl = document.getElementById("btnMenu");
  if(btnMenuEl) btnMenuEl.onclick = function(){ window.location.href = "menu.html"; };
  mhGorunumCiz();

  document.getElementById("mhDonemOncekiBtn").onclick = function(){ mhGezinmeOfset++; mhGorunumCiz(); };
  document.getElementById("mhDonemSonrakiBtn").onclick = function(){ mhGezinmeOfset--; mhGorunumCiz(); };
  (function(){
    var bar = document.getElementById("mhDonemBar");
    var baslangicX = null, baslangicY = null;
    bar.addEventListener("touchstart", function(ev){
      var t = ev.touches[0];
      baslangicX = t.clientX; baslangicY = t.clientY;
    }, {passive:true});
    bar.addEventListener("touchend", function(ev){
      if(baslangicX == null) return;
      var t = ev.changedTouches[0];
      var dx = t.clientX - baslangicX, dy = t.clientY - baslangicY;
      baslangicX = null; baslangicY = null;
      if(Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)*1.5) return;
      if(dx > 0){ mhGezinmeOfset++; } else { mhGezinmeOfset--; }
      mhGorunumCiz();
    }, {passive:true});
  })();


  document.getElementById("btnMhKapaliKaydiSil").onclick = function(){
    var anahtar = this.getAttribute("data-anahtar");
    if(!anahtar) return;
    if(!confirm("Bu kaydı silmek istediğine emin misin? Bu, sonraki dönemin referans noktasını da etkileyebilir.")) return;
    MaasKayitData.kaydiSil(anahtar, function(basarili, err){
      if(!basarili){ alert("Silinemedi: " + (err && err.message)); return; }
      mhGezinmeOfset = 0;
      mhGorunumCiz();
    });
  };

  // BAŞKA DÖNEMDE UNUTULMUŞ TASLAK KORUMASI (01.10.2026): "Ayı Kayıt Et",
  // Avans Takibi'ni kapatırken SADECE kapatılan ayın taslağını okur
  // (AvansKayitData.taslakOku(h.acik.ay, h.acik.yil)). Ama Avans Takibi
  // sayfasında ‹ › ile GEÇMİŞ bir aya gidip orada da giriş yapmak mümkün —
  // kullanıcı farkında olmadan verisini "açık/resmi" sayılan aydan FARKLI
  // bir ayın taslağına yazmış olabilir. Böyle bir durumda burası o ayı BOŞ
  // sanıp SIFIR tutarla kapatıyordu, gerçek veri ise başka bir ayda açık
  // taslak olarak öylece kalıyordu (veri KAYBOLMUYOR ama kullanıcıya
  // "silinmiş" gibi görünüyor ve yanlış rakamla kapanmış oluyordu — bkz.
  // Abdullah'ın 01.10.2026 bildirimi). Şimdi kapatmadan ÖNCE diğer
  // aylarda dolu bir taslak var mı kontrol ediyoruz; varsa işlemi
  // DURDURUP açıkça uyarıyoruz, sessizce yanlış veriyle kapatmıyoruz.
  //
  // GÜNCELLEME (02.11.2026, Abdullah'ın isteğiyle Avans Toplam sayfası): başka
  // aydaki taslağın AVANS satırları artık Avans Toplam'da görünür/hesaplı
  // (AvansKayitData.satirlar: açık, eklendi, maaştan düşüldü) — veri gözden
  // kaybolmaz ve açık (eklenmemiş) avans varsa aşağıdaki uyarı zaten çıkar.
  // Bu yüzden SADECE avans satırı HİÇ üretmeyen (örn. sadece harcama girilmiş)
  // dolu taslaklar kapatmayı durdurur; aksi hâlde eski ayın taslağı (örn. maaşa
  // eklenip düşülmüş Eylül) kapatmayı sonsuza kadar kilitlerdi.
  function mhBaskaDonemdeDoluTaslakVarMi(buAy, buYil){
    try{
      var buAnahtar = buYil + "-" + ("0"+buAy).slice(-2);
      var satirAylari = {};
      AvansKayitData.satirlar().forEach(function(r){ satirAylari[r.anahtar] = true; });
      return AvansKayitData.tumTaslaklar().filter(function(t){
        if(t.anahtar === buAnahtar) return false;
        if(satirAylari[t.anahtar]) return false; // avans satırları hesapta görünüyor
        return (t.ozelAvansGirisleri||[]).length>0 || (t.isAvansiGirisleri||[]).length>0 || (t.isAvansiHarcamalar||[]).length>0;
      });
    }catch(e){ return []; }
  }

  document.getElementById("btnAyiKayitEt").onclick = function(){
    if(mhGezinmeOfset !== 0) return; // sadece açık/canlı dönem kapatılabilir
    if(!mhGuncelHesap) return;
    var h = mhGuncelHesap;

    var baskaTaslaklar = mhBaskaDonemdeDoluTaslakVarMi(h.acik.ay, h.acik.yil);
    if(baskaTaslaklar.length){
      alert(
        "⚠️ DURDURULDU — " + AY_ADLARI_MH[h.acik.ay] + " " + h.acik.yil + " dönemini kapatamıyorum.\n\n"
        + "Şu dönem(ler)de hâlâ dolu, kapatılmamış bir Avans Takibi taslağı var:\n"
        + baskaTaslaklar.map(function(t){ return "• " + AY_ADLARI_MH[t.ay] + " " + t.yil; }).join("\n")
        + "\n\nBunu şimdi kapatırsam, o taslaktaki gerçek verin görünmeden, bu ay SIFIR avans ile yanlış kapanır. "
        + "Önce Avans Takibi sayfasından o döneme gidip verini kontrol et, gerekirse Ayarlar > Bakım bölümündeki "
        + "\"Avans Dönemi Taşı\" aracıyla doğru döneme taşı, sonra buraya dönüp tekrar dene."
      );
      return;
    }

    var avansUyari = "\n\nNot: Avans Takibi bu dönem için de otomatik kapatılacak.";
    if(h.kesinti && h.kesinti.bekleyenSayisi > 0){
      avansUyari += "\n\n⚠️ " + h.kesinti.bekleyenSayisi + " AÇIK avans (" + fmtTL_MH(h.kesinti.bekleyenToplam) + ") maaşa EKLENMEDİ; bu ayın maaşından düşülmeyecek.";
    }
    if(!confirm(AY_ADLARI_MH[h.acik.ay] + " " + h.acik.yil + " dönemini kapatmak istediğine emin misin?\n\nHesaba Yatacak: " + fmtTL_MH(h.hesabaYatacak) + avansUyari)) return;
    if(!confirm("Kesin olarak kapatılsın mı? Bu işlem geri alınamaz.\n\nKayıt edildikten sonra sistem otomatik bir sonraki aya geçer.")) return;

    document.getElementById("btnAyiKayitEt").disabled = true;

    function maasiKaydet(){
      var kayitObj = {
        ay: h.acik.ay, yil: h.acik.yil,
        brutSabitAylik: h.brutSabit,
        brutPrim: h.brutPrim,
        komisyonReferansToplam: h.birinciToplam,
        toplamKesinti: h.toplamKesintiYeni,
        netSabitMaas: h.sonuc.netSabitMaas,
        netPrim: h.sonuc.netPrim,
        netToplam: h.sonuc.netToplam,
        hesabaYatacak: h.hesabaYatacak,
        kayitZamani: Date.now()
      };
      MaasKayitData.kaydet(kayitObj, function(basarili, err){
        document.getElementById("btnAyiKayitEt").disabled = false;
        if(!basarili){ alert("Kaydedilemedi: " + (err && err.message)); return; }
        // Kalibrasyonu otomatik ilerlet: artık bu ayın sonu itibariyle
        // kümülatif matrah biliniyor — bir dahaki sefere elle girmesin.
        var yeniBaz = {matrah: h.sonuc.kumulatifMatrahSimdi, ay: h.acik.ay, yil: h.acik.yil};
        try{ AyarlarSync.matrahBazKaydet(yeniBaz); }catch(e){}
        localStorage.setItem("weicon_matrah_baz", JSON.stringify(yeniBaz));
        mhGezinmeOfset = 0;
        // MaasKayitData.degistiginde dinleyicisi mhGorunumCiz'i tetikleyecek.
      });
    }

    // Avans Takibi'ni HER ZAMAN, o an ekranda görünen canlı taslaktan
    // TAZE bir kapalı kayıt olarak (yeniden) yazıyoruz — önceki kod bunu
    // sadece "kapalı kaydı yoksa" yapıyordu; eğer o ay için eski/kalıntı
    // bir kapalı kayıt varsa hiç dokunmuyordu ve stale veri kalabiliyordu.
    // Bu şekilde her kapatma kendi kendini onarır (self-healing).
    var taslak = AvansKayitData.taslakOku(h.acik.ay, h.acik.yil);
    var avansKayitObj = {
      ay: h.acik.ay, yil: h.acik.yil,
      ozelAvansGirisleri: taslak.ozelAvansGirisleri||[],
      isAvansiGirisleri: taslak.isAvansiGirisleri||[],
      isAvansiHarcamalar: taslak.isAvansiHarcamalar||[],
      ozelAvansToplam: h.avans.ozelToplam,
      isAvansiBelgesizKalan: h.avans.isKesilecek,
      toplamKesinti: h.avans.toplamKesinti,
      kayitZamani: Date.now()
    };
    AvansKayitData.kaydet(avansKayitObj, function(basariliAv, errAv){
      if(!basariliAv){ document.getElementById("btnAyiKayitEt").disabled=false; alert("Avans Takibi kapatılamadı: " + (errAv && errAv.message)); return; }
      // Maaşa eklenmiş avans satırları (maasa işareti) kayıtla birlikte
      // taşınır; maaş dönemi kapanınca kendiliğinden "Maaştan düşüldü" olur.
      maasiKaydet();
    });
  };

  try{ KomisyonDonemData.degistiginde(function(){ mhGorunumCiz(); }); }catch(e){}
  try{ MaasKayitData.degistiginde(function(){ mhGorunumCiz(); }); }catch(e){}
  try{ AvansKayitData.degistiginde(function(){ mhGorunumCiz(); }); }catch(e){}
});
