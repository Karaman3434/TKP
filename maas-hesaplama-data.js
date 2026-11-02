/*
  maas-hesaplama-data.js
  =======================
  NET MAAŞ + NET PRİM tahmini hesaplayıcı — 2026 Türkiye bordro kurallarına
  göre KÜMÜLATİF vergi matrahı yöntemiyle çalışır (her ayın vergisi, o aya
  kadar yılbaşından beri BİRİKEN toplam matraha göre belirlenir — sadece o
  ayın kendi ücretine göre değil). Bu yüzden "Ağustos"u hesaplamak için
  Ocak'tan Ağustos'a kadar TÜM ayların brüt primini bilmek gerekir.

  Kaynaklar (Eylül 2026 itibarıyla resmi/güncel bilgiye dayanır):
   - Ücretliler için 2026 gelir vergisi dilimleri: 190.000 / 400.000 /
     1.500.000 / 5.300.000 TL sınırlarıyla %15 / %20 / %27 / %35 / %40.
   - 2026 brüt asgari ücret: 33.030 TL.
   - Asgari ücrete isabet eden GELİR VERGİSİ istisnası: aylık SABİT
     5.615,10 TL (dilim ne olursa olsun, hesaplanan vergiyi aşamaz —
     Abdullah'ın gerçek bordro pusulasındaki rakam esas alındı, genel GİB
     kaynaklarındaki 4.211,33 TL değil).
   - Asgari ücrete isabet eden DAMGA VERGİSİ istisnası: aylık SABİT 250,70 TL.
   - SGK işçi payı %14, İşsizlik işçi payı %1, Damga vergisi oranı %0,759.

  YIL GEÇİŞİ (02.11.2026): Ocak'ta birikmiş matrah sıfırdan başlar; dilimler ve
  asgari ücret YIL_PARAMETRELERI tablosundan yıla göre alınır (yeni yıl açıklanınca
  tabloya eklenir).

  ÖNEMLİ — bu bir TAHMİN aracıdır: resmi bordro yazılımları (özellikle bir
  dilim geçiş ayında) küçük farklı sonuçlar üretebilir. Kesin rakam için her
  zaman gerçek bordroyla karşılaştırılmalı; bu değerler mali müşavir görüşü
  yerine geçmez.
*/

var MaasHesaplamaData = (function(){

  var SGK_ORANI = 0.14;
  var ISSIZLIK_ORANI = 0.01;
  var DAMGA_ORANI = 0.00759;
  // YIL BAZLI PARAMETRELER (02.11.2026 — yıl geçişi düzenlemesi): gelir vergisi
  // dilimleri ve brüt asgari ücret HER YIL değişir. Yeni yılın değerleri
  // açıklanınca (genelde Aralık) aşağıdaki tabloya o yılı EKLE — başka bir
  // yeri değiştirmen gerekmez. Tabloda olmayan bir yıl hesaplanırsa en son
  // tanımlı yılın değerleri kullanılır ve sonuçta parametreTanimliMi=false
  // döner (Net Maaş sayfası bunu uyarı olarak gösterir).
  var YIL_PARAMETRELERI = {
    2026: {
      asgariUcretBrut: 33030.00, // 2026 brüt asgari ücret
      // Ücretliler için 2026 kümülatif yıllık matrah dilimleri.
      dilimler: [
        {ust: 190000,        oran: 0.15},
        {ust: 400000,        oran: 0.20},
        {ust: 1500000,       oran: 0.27},
        {ust: 5300000,       oran: 0.35},
        {ust: Infinity,      oran: 0.40}
      ]
    }
  };
  function parametreAl(yil){
    if(yil != null && YIL_PARAMETRELERI[yil]) return {p: YIL_PARAMETRELERI[yil], tanimliMi: true, yil: yil};
    var yillar = Object.keys(YIL_PARAMETRELERI).map(Number).sort();
    var son = yillar[yillar.length - 1];
    return {p: YIL_PARAMETRELERI[son], tanimliMi: yil == null, yil: son};
  }

  // Verilen kümülatif matrah üzerinden TOPLAM kademeli vergiyi (yılbaşından
  // bu matraha kadar biriken vergi) hesaplar.
  function kademeliVergi(matrah, yil){
    if(!matrah || matrah <= 0) return 0;
    var DILIMLER = parametreAl(yil).p.dilimler;
    var vergi = 0, altSinir = 0;
    for(var i=0; i<DILIMLER.length; i++){
      var ustSinir = DILIMLER[i].ust;
      var buDilimMatrah = Math.min(matrah, ustSinir) - altSinir;
      if(buDilimMatrah > 0) vergi += buDilimMatrah * DILIMLER[i].oran;
      if(matrah <= ustSinir) break;
      altSinir = ustSinir;
    }
    return vergi;
  }

  // DİNAMİK asgari ücret istisnası: eskiden 5.615,10 TL SABİT kodluydu (sadece
  // Ağustos 2026 için doğruydu). Artık, asgari ücretin KENDİ kümülatif matrahı
  // da (Ocak'tan itibaren, ayNo'ya göre) TIPKI çalışanın kendi matrahı gibi
  // yıl içinde dilim değiştirebiliyor — bu yüzden istisna, o AYA karşılık gelen
  // asgari-ücret-kümülatif ARALIĞI üzerinden kademeli hesaplanır. Böylece
  // Ocak-Haziran (%15 dilimi), Temmuz (dilim GEÇİŞ ayı, kademeli), Ağustos-
  // Aralık (%20 dilimi) — hepsi otomatik, doğru ve hiç elle müdahale
  // gerektirmeden hesaplanır; gelecek yıllarda asgari ücret değişse bile
  // (ASGARI_UCRET_BRUT_2026 güncellenince) aynı mantık geçerli kalır.
  function asgariUcretIstisnasiHesapla(ayNo, yil){
    var ASGARI_UCRET_BRUT = parametreAl(yil).p.asgariUcretBrut;
    var auAylikMatrah = ASGARI_UCRET_BRUT * (1 - SGK_ORANI - ISSIZLIK_ORANI);
    var auKumOnce = (ayNo - 1) * auAylikMatrah;
    var auKumSonra = ayNo * auAylikMatrah;
    var gelirVergisiIstisnasi = Math.max(0, kademeliVergi(auKumSonra, yil) - kademeliVergi(auKumOnce, yil));
    // Damga vergisi ORANLA (kademeli değil, sabit yüzde) hesaplandığı için
    // istisnası da doğrudan asgari ücretin kendi damga vergisidir.
    var damgaVergisiIstisnasi = ASGARI_UCRET_BRUT * DAMGA_ORANI;
    return {gelir: gelirVergisiIstisnasi, damga: damgaVergisiIstisnasi};
  }

  function sgkIssizlikSonrasi(brut){
    return brut * (1 - SGK_ORANI - ISSIZLIK_ORANI);
  }

  // ayNo: 1-12 (hesaplanacak ay). brutSabitAylik: her ay aynı varsayılan
  // brüt sabit maaş. brutPrimDizisi: {1:.., 2:.., ..., 12:..} o yılın OCAK'tan
  // itibaren her ayının brüt primi (Ödenebilir Komisyon'dan).
  // "Kalibrasyon": Ocak'tan itibaren tahmini toplamak yerine, gerçek
  // bordrodan alınan kümülatif matrahı doğrudan kullanmak için opsiyonel
  // override — verilirse bu ayın "ÖNCE" (bir önceki ay sonuna kadarki)
  // kümülatif matrahı olarak kullanılır.
  //
  // BÖLÜŞTÜRME SIRASI (gerçek bordro pusulasıyla karşılaştırıp doğrulandı):
  // PRİM önce eklenir ve İSTİSNADAN HİÇ FAYDALANMAZ (kümülatif matrahın en
  // üstüne oturur, o ayın en yüksek dilimini alır); SABİT MAAŞ en son eklenir
  // ve asgari ücret istisnasını (hem gelir hem damga vergisinde) O alır. Bu
  // sıralama ters çevrilirse (sabit önce/prim sonra) toplam rakam aynı çıkar
  // ama Net Maaş/Net Prim ayrımı gerçek bordrodan sapar.
  // yil (opsiyonel, 5. parametre): hangi yılın dilim/asgari ücret tablosu
  // kullanılacak (bkz. YIL_PARAMETRELERI). ayNo=1 (Ocak) ise birikmiş matrah
  // SIFIRDAN başlar (override verilmemeli).
  function ayHesapla(ayNo, brutSabitAylik, brutPrimDizisi, kumulatifMatrahOnceOverride, yil){
    var prm = parametreAl(yil);
    brutSabitAylik = parseFloat(brutSabitAylik) || 0;
    brutPrimDizisi = brutPrimDizisi || {};

    // --- "ÖNCE" (bu ay hariç, yılbaşından bir önceki aya kadarki) kümülatif
    //     BRÜT toplamı — sadece override yokken tahmini yöntem için gerekir.
    var kumBrutToplamOnce = 0;
    for(var a=1; a<ayNo; a++){
      kumBrutToplamOnce += brutSabitAylik + (parseFloat(brutPrimDizisi[a]) || 0);
    }

    var buAyPrim = parseFloat(brutPrimDizisi[ayNo]) || 0;
    var buAyBrutToplam = brutSabitAylik + buAyPrim;

    // "ÖNCE" kümülatif MATRAH (SGK/işsizlik sonrası): kalibrasyon varsa
    // ondan, yoksa Ocak'tan tahmini toplamdan.
    var kumMatrahOnce = kumulatifMatrahOnceOverride!=null ? kumulatifMatrahOnceOverride : sgkIssizlikSonrasi(kumBrutToplamOnce);
    // Ara nokta: PRİM eklendikten, SABİT MAAŞ henüz eklenmeden önceki matrah.
    var kumMatrahPrimSonrasi = kumMatrahOnce + sgkIssizlikSonrasi(buAyPrim);
    // "ŞİMDİ": SABİT MAAŞ de eklenince ulaşılan bu ayın toplam kümülatif matrahı.
    var kumMatrahSimdi = kumMatrahPrimSonrasi + sgkIssizlikSonrasi(brutSabitAylik);

    var vOnce = kademeliVergi(kumMatrahOnce, yil);
    var vPrimSonrasi = kademeliVergi(kumMatrahPrimSonrasi, yil);
    var vSimdi = kademeliVergi(kumMatrahSimdi, yil);

    // ---- PRİM'in gelir vergisi — İSTİSNASIZ (marjinal, en üst dilim) ----
    var gvPrim = Math.max(0, vPrimSonrasi - vOnce);
    var dvPrim = buAyPrim * DAMGA_ORANI;
    var netPrim = buAyPrim - (buAyPrim*SGK_ORANI) - (buAyPrim*ISSIZLIK_ORANI) - gvPrim - dvPrim;

    // ---- SABİT MAAŞ'ın gelir vergisi — asgari ücret istisnası BURADA ----
    // İstisna artık DİNAMİK: bu ayın (ayNo) asgari ücret kümülatif dilimine
    // göre otomatik hesaplanır (bkz. asgariUcretIstisnasiHesapla yukarıda).
    var auIstisna = asgariUcretIstisnasiHesapla(ayNo, yil);
    var gvSabitIstisnasiz = Math.max(0, vSimdi - vPrimSonrasi);
    var gvSabitIstisna = Math.min(auIstisna.gelir, gvSabitIstisnasiz);
    var gvSabit = Math.max(0, gvSabitIstisnasiz - gvSabitIstisna);
    var dvSabitIstisnasiz = brutSabitAylik * DAMGA_ORANI;
    var dvSabit = Math.max(0, dvSabitIstisnasiz - auIstisna.damga);
    var netSabitMaas = brutSabitAylik - (brutSabitAylik*SGK_ORANI) - (brutSabitAylik*ISSIZLIK_ORANI) - gvSabit - dvSabit;

    var netToplam = netSabitMaas + netPrim;

    return {
      brutSabitAylik: brutSabitAylik,
      brutPrim: buAyPrim,
      brutToplam: buAyBrutToplam,
      netSabitMaas: netSabitMaas,
      netPrim: netPrim,
      netToplam: netToplam,
      // Bu ay dahil, SGK/işsizlik SONRASI kümülatif vergi matrahı — bir
      // sonraki ayın kalibrasyon referansı olarak kullanılır (bkz.
      // maas-hesaplama-render.js: kapatınca kalibrasyon otomatik ilerler).
      kumulatifMatrahSimdi: kumMatrahSimdi,
      // Hangi yılın parametre tablosu kullanıldı; istenen yıl tabloda yoksa
      // parametreTanimliMi=false (o zaman en son tanımlı yılın değerleri kullanıldı).
      parametreYili: prm.yil,
      parametreTanimliMi: prm.tanimliMi
    };
  }

  return {
    ayHesapla: ayHesapla,
    kademeliVergi: kademeliVergi,
    asgariUcretIstisnasiHesapla: asgariUcretIstisnasiHesapla,
    parametreAl: parametreAl
  };

})();
