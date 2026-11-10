/*
  vade-takip-data.js — TKP.10.11.26-09:30.1537
  ========================================
  FATURA · VADE · ÖDEME TAKİBİ — merkezi hesaplama modülü.

  MANTIK:
  - Sadece SİPARİŞ kayıtları takip edilir (numune/teklif/proforma henüz
    satış değil). "Kaçan" olarak işaretlenmiş siparişler de takip dışıdır.
  - Vade tarihi = kaydın kesim tarihi (k.ts) + müşteri kartındaki VADE
    (gün sayısı). Müşterinin VADE alanı sayı değilse (boş/eski serbest
    metin), o müşterinin siparişleri "vade tanımsız" sayılır — Ana Sayfa
    kutusuna ve Vade Takip listesine GİRMEZ, ama Müşteri Kartı'nda "kesileli
    X gün oldu" olarak nötr renkte görünmeye devam eder.
  - Bugünün tarihi ile vade tarihi GÜN bazında (saat gözetilmeden)
    karşılaştırılır. Fark > 0 → geciken gün sayısı; 0 → bugün vadesi;
    negatif ve -5..0 arası → yaklaşıyor; daha küçük → vadesi henüz var.
  - "Ödendi" işareti, kaydın kendi üzerinde (arsiv/siparis) k.odendi alanı
    olarak tutulur — ReportsData.kaydiAlanGuncelle ile aynı güvenli yazma
    yoluyla güncellenir, ayrı bir depo YOK.
*/
var VadeTakip = (function(){

  function gunBasi(ts){
    var d = new Date(ts);
    d.setHours(0,0,0,0);
    return d.getTime();
  }

  // Müşterinin VADE alanını gün sayısına çevirir. Sayı değilse (boş, eski
  // serbest metin, "PAUNT" gibi anlamsız test verisi) null döner — o
  // müşteri takip dışı kalır ta ki Müşteri Kartı'ndan sayısal bir vade
  // günü girilene kadar.
  function vadeGunSayisi(musteri){
    if(!musteri) return null;
    var n = parseInt(String(musteri.vade == null ? "" : musteri.vade).trim(), 10);
    if(isNaN(n) || n < 0 || String(n) !== String(musteri.vade).trim()) return null;
    return n;
  }

  function musteriHaritasiKur(){
    var hepsi = CustomerData.ara("");
    var byId = {}, byAd = {};
    hepsi.forEach(function(m){
      if(m.id) byId[m.id] = m;
      var ad = (m.ad||"").toLocaleLowerCase("tr-TR").trim();
      if(ad && !byAd[ad]) byAd[ad] = m;
    });
    return {
      bul: function(musteriId, musteriAd){
        if(musteriId && byId[musteriId]) return byId[musteriId];
        var ad = (musteriAd||"").toLocaleLowerCase("tr-TR").trim();
        return ad ? (byAd[ad] || null) : null;
      }
    };
  }

  function kayitTutari(k){
    return (k.urunler||[]).reduce(function(s,u){ return s + (u.toplamEuro||0); }, 0);
  }

  // Tek bir sipariş kaydını, müşterisiyle birlikte, hesaplanmış vade
  // bilgileriyle döndürür. musteri null/vadesizse durum "vadesiz" olur.
  function ogeOlustur(k, musteri){
    var vadeGun = vadeGunSayisi(musteri);
    var kesimBasi = gunBasi(k.ts);
    var odendi = !!k.odendi;
    var oge = {
      ts: k.ts, kod: k.kod, musteri: k.musteri, musteriId: k.musteriId || null,
      sehir: k.sehir || "", tutar: kayitTutari(k), kesimTs: kesimBasi,
      vadeGun: vadeGun, odendi: odendi
    };
    if(vadeGun === null){
      oge.durum = "vadesiz";
      oge.gecenGun = Math.round((gunBasi(Date.now()) - kesimBasi) / 86400000);
      return oge;
    }
    var vadeTs = kesimBasi + vadeGun * 86400000;
    var farkGun = Math.round((gunBasi(Date.now()) - vadeTs) / 86400000);
    oge.vadeTs = vadeTs;
    oge.farkGun = farkGun;
    if(odendi) oge.durum = "odendi";
    else if(farkGun > 0) oge.durum = "gecti";
    else if(farkGun === 0) oge.durum = "bugun";
    else if(farkGun >= -5) oge.durum = "yaklasiyor";
    else oge.durum = "var";
    return oge;
  }

  // Vade tanımlı TÜM siparişler (ödenmiş dahil) — dahili kullanım.
  function tumOgeler(){
    var harita = musteriHaritasiKur();
    var sonuc = [];
    (ReportsData.tumSiparisler()||[]).forEach(function(k){
      if(k.durum === "kacan") return;
      var musteri = harita.bul(k.musteriId, k.musteri);
      var oge = ogeOlustur(k, musteri);
      if(oge.durum === "vadesiz") return; // Ana Sayfa/liste için takip dışı
      sonuc.push(oge);
    });
    return sonuc;
  }

  // Ana Sayfa kutusu için özet: ödenmemiş takipteki fatura sayısı, vadesi
  // geçenlerin sayısı ve toplam tutarı.
  function ozet(){
    var acik = tumOgeler().filter(function(o){ return !o.odendi; });
    var gecti = acik.filter(function(o){ return o.durum === "gecti"; });
    return {
      takipSayisi: acik.length,
      gectiSayisi: gecti.length,
      gectiTutar: gecti.reduce(function(s,o){ return s + o.tutar; }, 0)
    };
  }

  var DURUM_SIRA = {gecti:0, bugun:1, yaklasiyor:2, var:3};

  // Vade Takip ekranı için: sadece ödenmemişler, durum gruplarına ayrılmış
  // ve her grup içinde en acil (en çok geciken / en yakın) en üstte.
  function grupluListe(){
    var acik = tumOgeler().filter(function(o){ return !o.odendi; });
    acik.sort(function(a,b){
      var d = DURUM_SIRA[a.durum] - DURUM_SIRA[b.durum];
      if(d !== 0) return d;
      if(a.durum === "gecti") return b.farkGun - a.farkGun;   // en çok geciken üstte
      return a.farkGun - b.farkGun;                             // en yakın vade üstte
    });
    var gruplar = [];
    var siraDizi = ["gecti","bugun","yaklasiyor","var"];
    siraDizi.forEach(function(durum){
      var kayitlar = acik.filter(function(o){ return o.durum === durum; });
      if(kayitlar.length) gruplar.push({durum: durum, kayitlar: kayitlar});
    });
    return gruplar;
  }

  // Müşteri Kartı için: BU müşterinin tüm siparişleri (vade tanımlı olsun
  // olmasın, ödenmiş dahil), en yeni üstte.
  function musteriIcin(musteriId, musteriAd){
    var harita = musteriHaritasiKur();
    var musteri = harita.bul(musteriId, musteriAd);
    var sonuc = [];
    (ReportsData.tumSiparisler()||[]).forEach(function(k){
      if(k.durum === "kacan") return;
      var ayniMi = musteriId ? (k.musteriId === musteriId)
        : (k.musteri||"").toLocaleLowerCase("tr-TR").trim() === (musteriAd||"").toLocaleLowerCase("tr-TR").trim();
      if(!ayniMi) return;
      sonuc.push(ogeOlustur(k, musteri));
    });
    sonuc.sort(function(a,b){ return b.ts - a.ts; });
    return sonuc;
  }

  // Vadesi geçmiş (ödenmemiş) toplam bakiye — Müşteri Kartı üst uyarı kutusu.
  function musteriGecmisBakiye(musteriId, musteriAd){
    return musteriIcin(musteriId, musteriAd)
      .filter(function(o){ return o.durum === "gecti" && !o.odendi; })
      .reduce(function(s,o){ return s + o.tutar; }, 0);
  }


  // ------------------------------------------------------------------
  // MÜŞTERİ BAZLI TAKİP + ÖDEME PLANI (10.11.2026, Abdullah onayı — mockup)
  // Ödeme planı = müşterinin temas geçmişindeki (ziyaretGecmisi) "odeme:true"
  // işaretli kayıt: açıklama (not) + hatırlatma tarihi (söz verilen gün).
  // Ayrı bir veri alanı YOK — temas kaydı olduğu için Müşteri Kartı temas
  // geçmişinde, Ana Sayfa takviminde ve bugünün hatırlatmalarında da görünür.
  // ------------------------------------------------------------------
  function trKucuk(s){ return String(s||"").toLocaleLowerCase("tr-TR").trim(); }
  function musteriAnahtari(id, ad){ return id ? "id:" + id : "ad:" + trKucuk(ad); }
  function tarihAnahtari(d){
    return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  }
  function anahtardanTs(a){ var p = String(a||"").split("-"); return new Date(+p[0], +p[1]-1, +p[2]).getTime(); }
  // plan tarihi bugüne göre kaç gün (+ geçmiş / 0 bugün / - gelecek)
  function planFarkGun(anahtar){
    return Math.round((gunBasi(Date.now()) - anahtardanTs(anahtar)) / 86400000);
  }

  // Bir müşterinin TÜM temas kayıtları, en yeni üstte.
  function musteriTemaslari(musteriId, musteriAd){
    var liste = (typeof CustomerData !== "undefined" && CustomerData.tumZiyaretTemaslar) ? CustomerData.tumZiyaretTemaslar() : [];
    var ad = trKucuk(musteriAd);
    return liste.filter(function(z){
      return musteriId ? z.musteriId === musteriId : trKucuk(z.musteri) === ad;
    }).sort(function(a,b){ return (b.ts||0) - (a.ts||0); });
  }

  // Güncel ödeme planı: en son "odeme" temasının tarihi varsa o; yoksa null.
  function odemePlani(musteriId, musteriAd){
    var l = musteriTemaslari(musteriId, musteriAd).filter(function(z){ return z.odeme; });
    if(!l.length || !l[0].hatirlatmaTarihi) return null;
    return {tarih: l[0].hatirlatmaTarihi, not: l[0].not || "", ts: l[0].ts};
  }

  function planKaydet(musteriId, musteriAd, not, tarih, geriBildir){
    CustomerData.ziyaretEkle(musteriAd, not || "", "telefon", tarih || null, geriBildir, musteriId || undefined, {odeme: true});
  }

  function gecikmisSayisi(musteriId, musteriAd){
    return musteriIcin(musteriId, musteriAd).filter(function(o){ return o.durum === "gecti" && !o.odendi; }).length;
  }

  function durumdanFark(f){
    if(f > 0) return "gecti";
    if(f === 0) return "bugun";
    if(f >= -5) return "yaklasiyor";
    return "var";
  }

  // Vade Takip ekranı: MÜŞTERİ bazlı gruplar.
  //  1) "plan"  : ödeme planı (tarih verilmiş) olanlar — plan tarihi en yakın/en geçmiş üstte
  //  2) gecti / bugun / yaklasiyor / var : kalan müşteriler; her grupta en acil üstte
  // Müşterinin durumu, en çok geciken (en yakın vadeli) faturasına göre belirlenir.
  function musteriGruplari(){
    var acik = tumOgeler().filter(function(o){ return !o.odendi; });
    var map = {}, sira = [];
    acik.forEach(function(o){
      var k = musteriAnahtari(o.musteriId, o.musteri);
      if(!map[k]){ map[k] = {anahtar:k, musteriId:o.musteriId, musteri:o.musteri, kayitlar:[], toplam:0, maxFark:-Infinity}; sira.push(k); }
      var g = map[k];
      g.kayitlar.push(o); g.toplam += o.tutar;
      if(o.farkGun > g.maxFark) g.maxFark = o.farkGun;
    });
    var temasHaritasi = {};
    ((typeof CustomerData !== "undefined" && CustomerData.tumZiyaretTemaslar) ? CustomerData.tumZiyaretTemaslar() : []).forEach(function(z){
      var k1 = musteriAnahtari(z.musteriId, z.musteri), k2 = "ad:" + trKucuk(z.musteri);
      [k1,k2].forEach(function(k){ (temasHaritasi[k] = temasHaritasi[k] || []).push(z); });
    });
    var gruplar = {plan:[], gecti:[], bugun:[], yaklasiyor:[], "var":[]};
    sira.forEach(function(k){
      var g = map[k];
      g.kayitlar.sort(function(a,b){ return b.farkGun - a.farkGun; }); // en çok geciken / en yakın vade üstte
      g.durum = durumdanFark(g.maxFark);
      var t = (temasHaritasi[k] || temasHaritasi["ad:" + trKucuk(g.musteri)] || []).slice().sort(function(a,b){ return (b.ts||0) - (a.ts||0); });
      g.sonTemasTs = t.length ? t[0].ts : null;
      var son = t.filter(function(z){ return z.odeme; })[0];
      g.plan = (son && son.hatirlatmaTarihi) ? {tarih: son.hatirlatmaTarihi, not: son.not || "", ts: son.ts} : null;
      if(g.plan){ g.planFark = planFarkGun(g.plan.tarih); gruplar.plan.push(g); }
      else gruplar[g.durum].push(g);
    });
    gruplar.plan.sort(function(a,b){ return b.planFark - a.planFark; }); // en çok geçmiş (planı geçen) üstte, sonra bugün, sonra gelecek
    ["gecti","bugun","yaklasiyor","var"].forEach(function(d){
      gruplar[d].sort(function(a,b){ return b.maxFark - a.maxFark; });
    });
    var sonuc = [];
    ["plan","gecti","bugun","yaklasiyor","var"].forEach(function(id){
      if(gruplar[id].length) sonuc.push({id:id, musteriler:gruplar[id]});
    });
    return sonuc;
  }

  // İşlem Geçmişi gibi satır listeleri için: bir sipariş kaydının ödeme bilgisi
  // (vadesizse null). Müşteri haritası bir kez kurulur, dönen fonksiyon her kayıtta kullanılır.
  function odemeBilgisiFn(){
    var harita = musteriHaritasiKur();
    return function(k){
      if(!k || (k.tip && k.tip !== "siparis") || k.durum === "kacan") return null;
      var oge = ogeOlustur(k, harita.bul(k.musteriId, k.musteri));
      return oge.durum === "vadesiz" ? null : oge;
    };
  }

  function odendiToggle(ts, yeniDurum, geriBildir){
    ReportsData.kaydiAlanGuncelle("siparis", ts, {
      odendi: !!yeniDurum,
      odendiTs: yeniDurum ? Date.now() : null
    }, geriBildir);
  }

  return {
    vadeGunSayisi: vadeGunSayisi,
    ozet: ozet,
    grupluListe: grupluListe,
    musteriIcin: musteriIcin,
    musteriGecmisBakiye: musteriGecmisBakiye,
    odendiToggle: odendiToggle,
    musteriGruplari: musteriGruplari,
    musteriTemaslari: musteriTemaslari,
    odemePlani: odemePlani,
    planKaydet: planKaydet,
    gecikmisSayisi: gecikmisSayisi,
    odemeBilgisiFn: odemeBilgisiFn,
    tarihAnahtari: tarihAnahtari,
    planFarkGun: planFarkGun
  };

})();
