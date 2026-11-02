/*
  avans-kayit-data.js — TKP.02.11.26-19:45.1441
  =====================
  "Avans Takibi" sayfasının verisini tutar — Maaş Hesaplama sayfasından
  AYRI, kendi açık dönem/kapatma döngüsüne sahiptir.

  İKİ KATMAN:
   - TASLAK (avansTaslak/{ay}-{yil}): açık (henüz kapatılmamış) dönemin
     satırları. Her ekleme/silmede ANINDA Firebase'e yazılır — "el ile
     manuel giriş" dedikleri şey, kaydet demeden kalıcı olsun diye.
     Maaş Hesaplama sayfası, dönem henüz kapatılmamışsa bu taslağı okuyup
     "(henüz kapatılmadı)" notuyla gösterir.
   - KAPALI KAYIT (avansKayitlari/{ay}-{yil}): "Kapat ve Kayıt Et" dendiğinde
     taslak buraya resmi olarak kopyalanır, taslak silinir.

  Maaş Hesaplama'nın "Kapat ve Kayıt Et" butonu, aynı ay için Avans Takibi
  hâlâ açıksa onu da otomatik kapatır (ikisi hep senkron kalsın diye) —
  bkz. maas-hesaplama-render.js.

  02.11.2026 (Abdullah onayı, sistem baştan kuruldu): Avans Takibi tablosu
  artık SATIR BAZLI — her satır bir avans çekimi; "maaş hesabına eklendi" işareti
  avans girişinin üstündeki "maasa" alanıdır. Ayrıntı için aşağıdaki
  "SATIR BAZLI AVANS TAKİBİ" bloğuna bak.
*/

var AvansKayitData = (function(){

  var kayitlar = {};   // avansKayitlari — kapalı kayıtlar
  var taslaklar = {};  // avansTaslak — açık dönem taslağı (normalde tek kayıt)
  var dinleyiciler = [];
  // KRİTİK HATA DÜZELTMESİ (24.09.2026): sayfa ilk açıldığında
  // avans-takibi-render.js taslağı SENKRON okuyordu (taslakOku), ama
  // Firebase'in ilk veri paketi ASENKRON geliyor — bu yüzden sayfa
  // TAM DA veri henüz gelmeden "boş" çiziyordu (kullanıcıya "her şeyim
  // silinmiş" gibi görünüyordu). Firebase verisi geldiğinde de ekran
  // kendini YENİDEN ÇİZMİYORDU. Bu bayrak, render tarafının "ilk gerçek
  // veri geldi mi" diye sorup ona göre beklemesini/yeniden çizmesini
  // sağlıyor — bkz. avans-takibi-render.js.
  var taslakYuklendi = false;
  // İKİNCİ KRİTİK HATA DÜZELTMESİ (24.09.2026): acikDonem() "kapalı
  // kayıt var mı" diye 'kayitlar'a bakıyor — ama SAYFA AÇILIR AÇILMAZ
  // avans-takibi-render.js acikDonem()'i SENKRON çağırıyordu, yani
  // 'kayitlar' henüz Firebase'den gelmeden {} (boş) haldeyken. Sonuç:
  // Ağustos kapatılmış olsa bile sistem bunu henüz bilmediği için
  // "kapalı kayıt yok" sanıp YANLIŞLIKLA Ağustos'u (asıl kapalı ayı)
  // açık dönem sayıyor, kullanıcı Eylül'e girdiği onca veriyi göremez
  // hale geliyordu (veri kaybolmuyor, sadece EKRAN yanlış aya bakıyor).
  // Bu bayrak, render tarafının "kapalı kayıtlar geldi mi" diye sorup
  // İLK doğru dönem hesaplamasını (ve taslağa geçişi) veri gelene kadar
  // ERTELEMESİNİ sağlıyor.
  var kayitlarYuklendi = false;
  var maasKapali = {}; // maasKayitlari — kapanmış maaş dönemleri (anahtar: YYYY-MM)

  function baslat(){
    try{
      if(!firebase.apps.length){ firebase.initializeApp(ISTAKIP_FIREBASE_CONFIG); }
      var db = firebase.database();
      db.ref("avansKayitlari").on("value", function(snap){
        kayitlar = snap.val() || {};
        kayitlarYuklendi = true;
        bildir();
      }, function(err){ console.error("Avans kayıtları okunamadı:", err); });
      db.ref("avansTaslak").on("value", function(snap){
        taslaklar = snap.val() || {};
        taslakYuklendi = true;
        bildir();
      }, function(err){ console.error("Avans taslağı okunamadı:", err); });
      // Kapanmış maaş dönemleri: "Hesaba eklendi" satırı, o maaş dönemi
      // kapanınca kendiliğinden "Maaştan düşüldü" olur (bkz. satirlar()).
      db.ref("maasKayitlari").on("value", function(snap){
        maasKapali = snap.val() || {};
        bildir();
      }, function(err){ console.error("Maaş kayıtları okunamadı (avans):", err); });
    }catch(e){ console.error("AvansKayitData başlatılamadı:", e); }
  }

  function taslakYuklendiMi(){ return taslakYuklendi; }
  function kayitlarYuklendiMi(){ return kayitlarYuklendi; }

  function bildir(){
    zincirOnbellek = null; // kayıtlar/taslak değişti — satır hesabı yeniden yapılır
    dinleyiciler.forEach(function(fn){
      try{ fn(); }catch(e){ console.error("Avans kayıt dinleyici hatası:", e); }
    });
  }

  function degistiginde(fn){
    if(typeof fn === "function" && dinleyiciler.indexOf(fn)===-1) dinleyiciler.push(fn);
  }

  function tumKayitlar(){
    return Object.keys(kayitlar)
      .sort()
      .reverse()
      .map(function(k){ return Object.assign({anahtar:k}, kayitlar[k]); });
  }

  // Maaş Hesaplama ile AYNI mantık: hiç kayıt yoksa bir önceki ay açık
  // dönem sayılır (bir ay ancak bittikten sonra kapatılır).
  function acikDonem(){
    var liste = tumKayitlar();
    var simdi = new Date();
    if(!liste.length){
      var ay = simdi.getMonth();
      var yil = simdi.getFullYear();
      if(ay < 1){ ay = 12; yil -= 1; }
      return {ay: ay, yil: yil};
    }
    var son = liste[0];
    var ay2 = (son.ay||simdi.getMonth()+1) + 1, yil2 = son.yil||simdi.getFullYear();
    if(ay2 > 12){ ay2 = 1; yil2 += 1; }
    return {ay: ay2, yil: yil2};
  }

  function anahtarOlustur(ay, yil){ return yil + "-" + ("0"+ay).slice(-2); }

  // TÜM taslakları (kapalı olsun olmasın, hangi ay/yıl için olursa olsun)
  // döner — 27.09.2026: "başka bir dönemde unutulmuş taslak var mı?"
  // güvenlik bandını beslemek için eklendi (bkz. avans-takibi-render.js).
  function tumTaslaklar(){
    return Object.keys(taslaklar).map(function(k){ return Object.assign({anahtar:k}, taslaklar[k]); });
  }

  // Verilen (veya belirtilmemişse açık dönemin) taslağını okur — hiç
  // girilmemişse boş bir taslak döner.
  function taslakOku(ay, yil){
    var hedefAy = ay, hedefYil = yil;
    if(!hedefAy || !hedefYil){ var acik = acikDonem(); hedefAy = acik.ay; hedefYil = acik.yil; }
    var anahtar = anahtarOlustur(hedefAy, hedefYil);
    var t = taslaklar[anahtar];
    return t || {ay: hedefAy, yil: hedefYil, ozelAvansGirisleri: [], isAvansiGirisleri: [], isAvansiHarcamalar: []};
  }

  // Kapatılmış bir kayıt var mı diye bakar (verilen ay/yıl için).
  function kapaliKaydiBul(ay, yil){
    var anahtar = anahtarOlustur(ay, yil);
    return kayitlar[anahtar] ? Object.assign({anahtar:anahtar}, kayitlar[anahtar]) : null;
  }

  // Her ekleme/silmede çağrılır — DÜZENLENEN dönemin taslağını ANINDA
  // Firebase'e yazar (ay/yıl artık kullanıcı tarafından seçilebilir, açık
  // dönemle aynı olmak zorunda değil).
  function taslakGuncelle(ay, yil, veriObj, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      var anahtar = anahtarOlustur(ay, yil);
      var yazilacak = Object.assign({ay: ay, yil: yil}, veriObj);
      firebase.database().ref("avansTaslak/" + anahtar).set(yazilacak)
        .then(function(){ cb(true); }).catch(function(err){ cb(false, err); });
    }catch(e){ cb(false, e); }
  }

  // Taslağı resmi kayda çevirir (kapatır) ve taslağı temizler.
  function kaydet(kayitObj, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      if(!kayitObj || !kayitObj.ay || !kayitObj.yil) throw new Error("Ay/yıl eksik.");
      var anahtar = anahtarOlustur(kayitObj.ay, kayitObj.yil);
      var db = firebase.database();
      db.ref("avansKayitlari/" + anahtar).set(kayitObj)
        .then(function(){ return db.ref("avansTaslak/" + anahtar).remove(); })
        .then(function(){ cb(true); }).catch(function(err){ cb(false, err); });
    }catch(e){ cb(false, e); }
  }

  function kaydiSil(anahtar, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      firebase.database().ref("avansKayitlari/" + anahtar).remove()
        .then(function(){ cb(true); }).catch(function(err){ cb(false, err); });
    }catch(e){ cb(false, e); }
  }

  /* ====================================================================
     SATIR BAZLI AVANS TAKİBİ (02.11.2026, Abdullah onayı — sistem baştan
     kuruldu, mockup üzerinden)

     Tablonun her satırı TEK BİR AVANS ÇEKİMİdir (iş ya da özel). Veri
     artık sadece "Avans Takibi > ayrıntı" ekranından (AVANS EKLE +
     HARCAMALAR) girilir; tablo bu girişleri OKUR. Saklanan yapı değişmedi:
     avansTaslak/{YYYY-MM} (açık dönem) ve avansKayitlari/{YYYY-MM} (kapanmış
     dönem) içindeki ozelAvansGirisleri / isAvansiGirisleri / isAvansiHarcamalar.
     Tek yeni alan: bir avans girişinin üstünde  maasa = {donem, f, kalan, zaman}
     → "maaş hesabına eklendi" işareti (f/kalan eklendiği andaki faturalandırılan
     ve kalan tutarı SABİTLER).

     Faturalandırılan tutar: bir ayın harcama belgeleri o ayın İŞ avanslarına
     eskiden yeniye doldurulur (ilk avans dolunca sonrakine geçer). Özel avans
     faturalandırılmaz, kalanı tam tutardır. Bir ayda avanstan FAZLA belge
     çıkarsa artan kısım hesap dışıdır — sonraki aya DEVRETMEZ (devir özelliği
     02.11.2026'da Abdullah'ın isteğiyle kaldırıldı).

     SIFIRLAMA: "GEÇERLİ AYIN HESABI KAPANDI" ile maaş dönemi kapanınca tablo
     sıfırdan başlar — açık (ve sonraki) dönemin satırları + avansı hâlâ
     KAPATILMAMIŞ (taslak) eski ayların maaşa düşülmemiş satırları gösterilir
     (satirlarAcikDonem). Avansı kapatılmış eski dönemlerin satırları Firebase'de
     durur, silinmez, ama hiçbir yeni hesaba girmez / ekranda görünmez.

     SATIR DURUMLARI (r.durum):
       "acik"     kalan > 0, maaşa eklenmemiş (kırmızı çerçeve)
       "tam"      kalan 0 (faturası tam kapanmış) — eklenecek bir şey yok
       "eklendi"  maaş hesabına eklendi — KALICI KİLİTLİ (geri alınamaz,
                  silinemez/değiştirilemez); o maaş dönemi henüz kapanmadı
       "dusuldu"  eklendiği maaş dönemi kapandı: "Maaştan düşüldü", kalıcı.
                  (Eski sistemden: maasaDahilEdildigiDonem'i olan kayıtlar)
     ESKİ kilit / kapatma / dusulmeNotu / maasaEklenenDonem alanları YOK
     SAYILIR (Abdullah: "kilitleri şimdi kaldır, yeni yapılandırma") —
     Firebase'deki hiçbir veri silinmez.
     ==================================================================== */
  function topla(liste){ return (liste||[]).reduce(function(s,x){ return s+((x && x.tutar)||0); }, 0); }
  function anahtarCoz(a){ var p = String(a).split("-"); return {yil: parseInt(p[0],10)||0, ay: parseInt(p[1],10)||0}; }

  // Tüm dönemler (kapanmış kayıtlar + açık taslaklar), eskiden yeniye.
  function aylariTopla(){
    var m = {};
    Object.keys(taslaklar).forEach(function(k){ m[k] = {anahtar:k, kaynak:"taslak", veri: taslaklar[k] || {}}; });
    Object.keys(kayitlar).forEach(function(k){ m[k] = {anahtar:k, kaynak:"kayit", veri: kayitlar[k] || {}}; });
    return Object.keys(m).sort().map(function(k){ return m[k]; });
  }

  // TEK DÖNEMİN HESABI: satırlar + özet. (Devir yok: avanstan fazla belge sonraki aya taşınmaz.)
  function donemHesapla(m){
    var v = m.veri || {};
    var c = anahtarCoz(m.anahtar);
    var ozel = v.ozelAvansGirisleri || [], is = v.isAvansiGirisleri || [];
    var harcama = topla(v.isAvansiHarcamalar);
    var isToplam = topla(is), ozelToplam = topla(ozel);
    // Eski sistemde maaşa dahil edilmiş kayıt: tamamı "maaştan düşüldü".
    var eski = (m.kaynak === "kayit") && !!v.maasaDahilEdildigiDonem;
    var havuz = harcama;
    if(!eski){
      is.forEach(function(e){ if(e && e.maasa) havuz -= (e.maasa.f || 0); });
      if(havuz < 0) havuz = 0;
    }
    // İş avansları tarihe göre (eskiden yeniye), eşitse giriş sırasıyla doldurulur.
    var sira = is.map(function(e, i){ return {e:e, i:i}; }).sort(function(a, b){
      var d = String((a.e && a.e.tarih) || "").localeCompare(String((b.e && b.e.tarih) || ""));
      return d !== 0 ? d : (a.i - b.i);
    });
    var fHaritasi = {};
    sira.forEach(function(x){
      var tutar = (x.e && x.e.tutar) || 0;
      if(!eski && x.e && x.e.maasa){ fHaritasi[x.i] = {f: x.e.maasa.f || 0, kalan: x.e.maasa.kalan || 0}; return; }
      var f = Math.min(tutar, havuz);
      havuz -= f;
      fHaritasi[x.i] = {f: f, kalan: tutar - f};
    });
    // AVANSTAN FAZLA BELGE (02.11.2026, Abdullah onayı: "fazlayı diğer ayların
    // kalanından düş"): artan harcama o ayın EN YENİ (dondurulmamış) iş avansı
    // satırına eklenir — Faturalandırılan gerçek belge toplamını gösterir, Kalan
    // NEGATİF olur; toplamlar (Toplam − Faturalanan) böylece diğer ayların
    // kalanından otomatik düşer. Sonraki aya devir/taşıma YOK.
    if(!eski && havuz > 0.005){
      for(var si = sira.length - 1; si >= 0; si--){
        var xi = sira[si];
        if(xi.e && xi.e.maasa) continue;
        fHaritasi[xi.i].f += havuz;
        fHaritasi[xi.i].kalan -= havuz;
        havuz = 0;
        break;
      }
    }
    var satirlar = [];
    function ekle(tip, e, i, f, kalan){
      var durum = "acik", hedef = "";
      if(eski){ durum = "dusuldu"; hedef = v.maasaDahilEdildigiDonem; }
      else if(e && e.maasa){ hedef = e.maasa.donem || ""; durum = maasKapali[hedef] ? "dusuldu" : "eklendi"; }
      else if(Math.abs(kalan) <= 0.005){ durum = "tam"; }
      satirlar.push({
        id: m.anahtar + "|" + tip + "|" + i,
        anahtar: m.anahtar, kaynak: m.kaynak, ay: c.ay, yil: c.yil,
        tip: tip, idx: i,
        tarih: (e && e.tarih) || "", aciklama: (e && e.aciklama) || "",
        tutar: (e && e.tutar) || 0,
        faturalanan: f, kalan: kalan,
        durum: durum, hedef: hedef
      });
    }
    is.forEach(function(e, i){ var h = fHaritasi[i] || {f:0, kalan:(e && e.tutar)||0}; ekle("is", e, i, h.f, h.kalan); });
    ozel.forEach(function(e, i){
      var t = (e && e.tutar) || 0;
      ekle("ozel", e, i, 0, (!eski && e && e.maasa) ? (e.maasa.kalan || 0) : t);
    });
    var kalanToplam = 0, isKesilecek = 0;
    // Dönem özeti (kapanış kaydı / Maaş Hesaplama için) negatif satırı SAYMAZ (0'a sabitlenir);
    // fazla belge mahsubu sadece Avans Toplam'daki satır/toplamlarda ve maaşa eklemede görünür.
    satirlar.forEach(function(r){ var k = Math.max(0, r.kalan); kalanToplam += k; if(r.tip === "is") isKesilecek += k; });
    return {
      anahtar: m.anahtar, ay: c.ay, yil: c.yil, kaynak: m.kaynak, yerlesik: eski,
      satirlar: satirlar,
      ozelToplam: ozelToplam, isToplam: isToplam, harcamaToplam: harcama,
      isKalanHam: Math.max(0, isToplam - harcama), isKesilecek: isKesilecek, kalan: kalanToplam
    };
  }

  var zincirOnbellek = null;
  function zincirHesapla(){
    if(zincirOnbellek) return zincirOnbellek;
    var harita = {}, liste = [];
    aylariTopla().forEach(function(m){
      var r = donemHesapla(m);
      harita[m.anahtar] = r; liste.push(r);
    });
    zincirOnbellek = {harita: harita, liste: liste};
    return zincirOnbellek;
  }

  // Tablo satırları: TÜM avans çekimleri, yeniden eskiye (tarih, sonra giriş sırası).
  function satirlar(){
    var hepsi = [];
    zincirHesapla().liste.forEach(function(d){ hepsi = hepsi.concat(d.satirlar); });
    hepsi.sort(function(a, b){
      var d = String(b.tarih).localeCompare(String(a.tarih));
      if(d !== 0) return d;
      d = b.anahtar.localeCompare(a.anahtar);
      if(d !== 0) return d;
      return b.idx - a.idx;
    });
    return hepsi;
  }

  // Bir dönemin özeti (kalan toplamı) — yoksa null.
  function donemOzeti(anahtar){
    var h = zincirHesapla().harita[anahtar];
    return h ? {kalan: h.kalan} : null;
  }

  // Bir dönemin TASLAĞI için canlı hesap (ayrıntı ekranı yazarken liste verir).
  function taslakDevirli(ay, yil, ozelListe, isListe, harcamaListe){
    var t = taslakOku(ay, yil);
    var veri = {
      ozelAvansGirisleri: ozelListe || t.ozelAvansGirisleri || [],
      isAvansiGirisleri: isListe || t.isAvansiGirisleri || [],
      isAvansiHarcamalar: harcamaListe || t.isAvansiHarcamalar || []
    };
    var h = donemHesapla({anahtar: anahtarOlustur(ay, yil), kaynak: "taslak", veri: veri});
    return {
      ozelToplam: h.ozelToplam, isToplam: h.isToplam, belgelenenToplam: h.harcamaToplam,
      isKalanHam: h.isKalanHam, isKesilecek: h.isKesilecek, toplamKesinti: h.kalan
    };
  }

  // GÖRÜNEN / HESABA GİREN SATIRLAR (Avans Toplam, maaşa ekle, maaş kesintisi):
  //  • açık maaş dönemi ve sonrası, VEYA
  //  • avansı henüz KAPATILMAMIŞ (hâlâ taslak olan) eski aylar — maaşı kapanmış
  //    olsa bile (örn. Eylül'de maaşa eklenmemiş avans kalmışsa o satır görünür
  //    ve açık maaş dönemine eklenebilir), ama eklenip maaşı da kapanınca
  //    ("dusuldu") kaybolur. Avansı kapatılmış (kayıt) eski aylar sıfırlanır:
  //    Firebase'de durur, ekranda/hesapta yoktur.
  function satirlarAcikDonem(ay, yil){
    var esik = anahtarOlustur(ay, yil);
    return satirlar().filter(function(r){
      if(r.anahtar >= esik) return true;
      return r.kaynak === "taslak" && r.durum !== "dusuldu";
    });
  }

  // "MAAŞ HESAPLAMASINA EKLE": açık satırlar (idler=null → hepsi) hedef maaş
  // dönemine eklenir; her satırın o anki faturalandırılan/kalan tutarı sabitlenir.
  function maasaEkle(idler, hedefAnahtar, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      var h = anahtarCoz(hedefAnahtar);
      var secilen = satirlarAcikDonem(h.ay, h.yil).filter(function(r){
        return r.durum === "acik" && (!idler || idler.indexOf(r.id) !== -1);
      });
      if(!secilen.length){ cb(true, null, 0); return; }
      var zaman = Date.now(), g = {};
      secilen.forEach(function(r){
        g[satirYolu(r) + "/maasa"] = {donem: hedefAnahtar, f: r.faturalanan, kalan: r.kalan, zaman: zaman};
      });
      firebase.database().ref().update(g)
        .then(function(){ cb(true, null, secilen.length); }).catch(function(err){ cb(false, err); });
    }catch(e){ cb(false, e); }
  }

  function satirYolu(r){
    return (r.kaynak === "kayit" ? "avansKayitlari/" : "avansTaslak/") + r.anahtar + "/"
      + (r.tip === "is" ? "isAvansiGirisleri" : "ozelAvansGirisleri") + "/" + r.idx;
  }

  // Bir maaş dönemine yansıyacak TOPLAM avans kesintisi — Maaş Hesaplama ve
  // Ana Sayfa özeti AYNI fonksiyonu kullanır (tek kaynak).
  //  eklenenler : bu maaş dönemine eklenmiş avans satırları
  //  aylar      : bu satırların avans aylarının listesi (yeniden eskiye)
  //  bekleyen*  : hiçbir maaşa eklenmemiş (açık) avanslar — bilgi amaçlı (sadece açık dönem ve sonrası)
  function maasKesintisi(ay, yil){
    var anahtar = anahtarOlustur(ay, yil);
    var tum = satirlarAcikDonem(ay, yil);
    var ek = tum.filter(function(r){
      return r.hedef === anahtar && (r.durum === "eklendi" || r.durum === "dusuldu") && Math.abs(r.kalan) > 0.005;
    });
    var toplam = 0, gorulen = {}, aylar = [];
    ek.forEach(function(r){
      toplam += r.kalan;
      if(!gorulen[r.anahtar]){ gorulen[r.anahtar] = true; aylar.push({ay: r.ay, yil: r.yil, anahtar: r.anahtar}); }
    });
    aylar.sort(function(a, b){ return b.anahtar.localeCompare(a.anahtar); });
    if(toplam < 0) toplam = 0; // fazla belge mahsubu kesintiyi en fazla 0'a indirir
    var acik = tum.filter(function(r){ return r.durum === "acik"; });
    var bekleyenToplam = Math.max(0, acik.reduce(function(s, r){ return s + r.kalan; }, 0));
    return {
      anahtar: anahtar, toplam: toplam, adet: ek.length, eklenenler: ek, aylar: aylar,
      bekleyenSayisi: acik.length, bekleyenToplam: bekleyenToplam
    };
  }

  baslat();

  return {
    degistiginde: degistiginde,
    tumKayitlar: tumKayitlar,
    tumTaslaklar: tumTaslaklar,
    acikDonem: acikDonem,
    taslakOku: taslakOku,
    taslakYuklendiMi: taslakYuklendiMi,
    kayitlarYuklendiMi: kayitlarYuklendiMi,
    taslakGuncelle: taslakGuncelle,
    kapaliKaydiBul: kapaliKaydiBul,
    kaydet: kaydet,
    kaydiSil: kaydiSil,
    satirlar: satirlar,
    satirlarAcikDonem: satirlarAcikDonem,
    maasaEkle: maasaEkle,
    maasKesintisi: maasKesintisi,
    donemOzeti: donemOzeti,
    taslakDevirli: taslakDevirli
  };

})();
