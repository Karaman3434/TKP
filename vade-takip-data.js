/*
  vade-takip-data.js — TKP.11.11.26-15:17.1569
  ========================================
  FATURA · VADE · ÖDEME TAKİBİ — merkezi hesaplama modülü.

  MANTIK:
  - Sadece SİPARİŞ kayıtları takip edilir (numune/teklif/proforma henüz
    satış değil). "Kaçan" olarak işaretlenmiş siparişler de takip dışıdır.
  - Vade tarihi = kaydın kesim tarihi (k.ts) + müşteri kartındaki VADE
    (gün sayısı). Müşterinin VADE alanı gün sayısı olarak okunamıyorsa
    (boş/anlamsız metin; "30" ve "30 gün" okunur), o müşterinin siparişleri "vade tanımsız" sayılır — Ana Sayfa
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

  // Müşterinin VADE alanını gün sayısına çevirir. "30" ve "30 gün" gibi
  // yazılar okunur (10.11.2026: eski kartlardaki "30 gün" yazısı müşteriyi
  // yanlışlıkla vadesiz bırakıyordu). Okunamazsa (boş, "PAUNT" gibi anlamsız
  // test verisi) null döner — o
  // müşteri takip dışı kalır ta ki Müşteri Kartı'ndan sayısal bir vade
  // günü girilene kadar.
  function vadeGunSayisi(musteri){
    if(!musteri) return null;
    var ham = String(musteri.vade == null ? "" : musteri.vade).trim();
    // "30", "30 gün", "30 Gün", "30 gun", "30 günlük", "30 gün vade" kabul;
    // "PAUNT", "45 gün çek", "30+15" gibi belirsiz metinler takip dışı kalır.
    var e = /^(\d{1,3})\s*(?:g[üu]n(?:l[üu]k)?)?\s*(?:vade)?$/i.exec(ham);
    if(!e) return null;
    return parseInt(e[1], 10);
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
      ts: k.ts, kod: k.kod, musteri: k.musteri,
      // 10.11.2026: eski kayıtlarda musteriId yoksa müşteri kartındaki KOD kullanılır (listelerde kod görünsün)
      musteriId: k.musteriId || (musteri && musteri.id) || null,
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
      // 11.11.2026: eski kayıtlarda musteriId YOKTU → eskiden hiç listelenmiyor, borç bakiyesine de girmiyordu.
      // Artık İşlem Geçmişi ile AYNI tek kural (CustomerData.kayitMusteriyeAitMi): kod varsa kod, yoksa isim.
      if(!CustomerData.kayitMusteriyeAitMi(k.musteri, k.musteriId, (musteri && musteri.ad) || musteriAd, (musteri && musteri.id) || musteriId)) return;
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

  // Güncel ödeme planı (10.11.2026, Abdullah isteği): müşterinin tarihli "odeme" kayıtları arasından, EN SON girilen/düzeltilen
  // (guncelTs yoksa ts) olanın hatırlatma tarihi — girişin yapıldığı gün DEĞİL, açıklamaya yazılan ödeme tarihi gösterilir.
  // Açıklaması dolu kayıt, açıklamasız (yalnız tarihli) eski kayda tercih edilir.
  function planSec(l){
    var a = l.filter(function(z){ return z.odeme && z.hatirlatmaTarihi; });
    var n = a.filter(function(z){ return z.not; });
    var h = n.length ? n : a;
    return h.slice().sort(function(x, y){ return (y.guncelTs || y.ts || 0) - (x.guncelTs || x.ts || 0); })[0] || null;
  }
  function odemePlani(musteriId, musteriAd){
    var son = planSec(musteriTemaslari(musteriId, musteriAd));
    return son ? {tarih: son.hatirlatmaTarihi, not: String(son.not || "").replace(/^\[[^\]]*\]\s*/, ""), ts: son.ts} : null;
  }

  function planKaydet(musteriId, musteriAd, not, tarih, geriBildir){
    CustomerData.ziyaretEkle(musteriAd, not || "", "telefon", tarih || null, geriBildir, musteriId || undefined, {odeme: true});
  }

  // ---- KDV DAHİL TUTAR + TL KARŞILIĞI (10.11.2026, Abdullah isteği) ----
  // Alacak, merkezin kestiği fatura (liste fiyatı üzerinden iskontolu tutar + KDV) üzerinden
  // takip edildiği için vade/fatura ekranlarındaki tüm tutarlar KDV DAHİL gösterilir.
  // Kayıtlardaki tutar (toplamEuro) KDV HARİÇ'tir; burada KDV eklenir. TL karşılığı =
  // KDV dahil EURO × günün kuru. KDV oranı ve kur sepetle AYNI ayarlardan okunur
  // (weicon_kdv_orani — yoksa %20; weicon_kur — yoksa TL satırı gösterilmez).
  function kdvOrani(){
    var v = NaN;
    try{ v = parseFloat(localStorage.getItem("weicon_kdv_orani")); }catch(e){}
    return isNaN(v) ? 20 : v;
  }
  function kurDegeri(){
    var v = NaN;
    try{ v = parseFloat(localStorage.getItem("weicon_kur")); }catch(e){}
    return (isNaN(v) || v <= 0) ? 0 : v;
  }
  function kdvli(euroHaric){ return (euroHaric||0) * (1 + kdvOrani()/100); }
  function tutarFmt(n){ return (n||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}); }
  // Tek ortak tutar gösterimi: üstte "KDV dahil  X EURO", altında "Y TL". (Stiller satır içi —
  // hangi sayfada çizilirse çizilsin aynı görünür.)
  function tutarHTML(euroHaric){
    var v = kdvli(euroHaric), kur = kurDegeri();
    return "<span style='display:inline-flex;flex-direction:column;align-items:flex-end;line-height:1.25;'>"
      + "<span><small style='font-size:10px;font-weight:700;color:#7a8797;margin-right:5px;'>KDV dahil</small>" + tutarFmt(v) + " EURO</span>"
      + (kur ? "<span style='font-size:11.5px;font-weight:700;color:#5b6b7f;'>" + tutarFmt(v * kur) + " TL</span>" : "")
      + "</span>";
  }
  function kdvNotu(){
    var kur = kurDegeri();
    return "Tüm tutarlar %" + tutarFmt(kdvOrani()).replace(/,00$/, "") + " KDV dahil" + (kur ? " · TL karşılığı günün kuruyla (" + tutarFmt(kur) + ")" : "");
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
      var son = planSec(t);
      g.plan = son ? {tarih: son.hatirlatmaTarihi, not: String(son.not || "").replace(/^\[[^\]]*\]\s*/, ""), ts: son.ts} : null;
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
    kdvli: kdvli,
    kdvOrani: kdvOrani,
    kurDegeri: kurDegeri,
    tutarHTML: tutarHTML,
    kdvNotu: kdvNotu,
    odemeBilgisiFn: odemeBilgisiFn,
    tarihAnahtari: tarihAnahtari,
    planFarkGun: planFarkGun
  };

})();
