/*
  product-data.js — TKP.04.11.26-12:30.1463
  ===============
  TEK görevi: ürün kataloğunu Firebase'den çekmek ve sepet (basket)
  durumunu yönetmek. DOM'a dokunmaz.

  Ürünler "urunler/" yolunda tutulur (06.09.2026'dan itibaren — eskiden
  kök "/" yolu kullanılıyordu, bkz. urunlerYoluHazirla() içindeki not).
  Önbellek anahtarı: "wemosa_v8_catalog" (eski uygulamayla aynı, değişmedi).
*/

var ProductData = (function(){

  var STORAGE_KEY = "wemosa_v8_catalog";
  var SEPET_KEY = "weiconv2_sepet";

  var katalog = [];
  var firebaseKatalog = [];
  var yedekKatalog = [];
  // EKSTRA ÜRÜN LİSTESİ (04.11.2026, Abdullah onayı — "ana listeye hiçbir
  // şekilde dokunmadan ekstra bir liste"): Firebase'de AYRI "ekstraUrunler/"
  // yolunda tutulur. Ana "urunler/" yoluna bu listeden YAZILMAZ; sadece
  // okuma tarafında (bellekte) ana katalogun SONUNA eklenir, böylece arama
  // ikisini birden tarar.
  var ekstraKatalog = [];
  var sepet = [];
  var katalogDinleyicileri = [];
  var katalogDinleyiciBagli = false;
  var dbRef = null;

  try{
    var kayitliSepet = localStorage.getItem(SEPET_KEY);
    if(kayitliSepet) sepet = JSON.parse(kayitliSepet);
  }catch(e){ sepet = []; }

  function sepetiKaydet(){
    try{ localStorage.setItem(SEPET_KEY, JSON.stringify(sepet)); }catch(e){}
  }

  function baslat(){
    try{
      if(!firebase.apps.length){ firebase.initializeApp(ISTAKIP_FIREBASE_CONFIG); }
      var db = firebase.database();
      dbRef = db;

      try{
        var local = localStorage.getItem(STORAGE_KEY);
        if(local){
          katalog = JSON.parse(local);
          katalogDinleyicileri.forEach(function(fn){ fn(); });
        }
      }catch(e){}

      urunlerYoluHazirla(db);
      ekstraDinlemeyeBasla(db);

      // YEDEK KATALOG: Firebase'de aranan ürün bulunmuyorsa, depodaki
      // fiyat listesi JSON'u da katalog kaynağı olarak kullanılır.
      // Firebase kayıtları önceliklidir; JSON yalnızca eksik ürünleri tamamlar.
      fetch("urunler-21092026.json", {cache:"no-cache"})
        .then(function(r){ if(!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function(data){
          yedekKatalog = Array.isArray(data) ? data : [];
          katalogKur();
          katalogDinleyicileri.forEach(function(fn){ fn(); });
        })
        .catch(function(err){ tanilaKaydet("Yedek ürün kataloğu yüklenemedi.", err && err.message); });
    }catch(e){
      console.error("Firebase başlatma hatası:", e);
    }
  }

  // ============================================================
  // GÜVENLİK/PERFORMANS DÜZELTMESİ (06.09.2026) — Son Sürüm İnceleme
  // Raporu madde 2'ye karşılık: ürünler artık kökte ("/") değil, ayrı
  // "urunler/" yolunda tutulur. Eskiden db.ref("/").on("value") sadece
  // ürün aramak için TÜM veritabanını (müşteriler, arşiv, maaş kayıtları
  // dahil) indiriyordu — Firebase kullanım grafiğindeki anormal yüksek
  // indirme miktarının sebebi de buydu.
  //
  // Geçiş CANLI VERİYE DOKUNMADAN, otomatik ve tek seferlik yapılır:
  // "urunler/" zaten doluysa doğrudan oradan okunur. Boşsa, kökteki
  // eski ürün kayıtları (sayısal anahtarlı, "urun" alanı olan objeler)
  // "urunler/" altına KOPYALANIR — kökteki eski kayıtlar GÜVENLİK İÇİN
  // SİLİNMEZ (bir sorun çıkarsa geri dönülebilsin diye). Kopyalama bir
  // kez yapıldıktan sonra tüm cihazlar artık sadece "urunler/"yi okur.
  // ============================================================

  // TANILAMA (15.10.2026, Abdullah'ın ürün aramada hiçbir ürünün
  // çıkmaması şikayeti üzerine eklendi) — bu dosyadaki Firebase okuma
  // hataları eskiden SADECE console.error'a gidiyordu, yani telefonda/
  // iPad'de görünmüyordu. Artık HataLog üzerinden "Hata Kayıtları"
  // sayfasına da yazılıyor ki "izin sorunu mu, veri gerçekten boş mu,
  // bağlantı mı kesik" ayrımı uygulamanın içinden görülebilsin.
  function tanilaKaydet(mesaj, ek){
    try{ console.error(mesaj, ek||""); }catch(e){}
    try{ if(typeof HataLog !== "undefined") HataLog.kaydet(mesaj, ek ? String(ek) : null); }catch(e){}
  }

  function urunlerYoluHazirla(db){
    db.ref("urunler").once("value").then(function(snap){
      if(snap.exists() && snap.val()){
        urunlerDinlemeyeBasla(db);
        return;
      }
      // HATA DÜZELTME (19.10.2026, Abdullah'ın bildirdiği hata — Hata
      // Kayıtları'nda günde onlarca kez AYNI iki satır): buradaki eski
      // "kökten taşıma" denemesi KALDIRILDI. O göç zaten 06.09.2026'da
      // tek seferlik yapılmıştı (bkz. yukarıdaki not) ve db.ref("/") kökü
      // TAM O GÜN, GÜVENLİK İÇİN BİLEREK kapatılmıştı — yani kök okuma
      // denemesi buradan HER SAYFA AÇILIŞINDA garanti "permission_denied"
      // ile patlıyordu (gerçek bir arıza değildi, beklenen davranıştı).
      // Daha kötüsü: kök okuma başarısız olunca urunlerDinlemeyeBasla hiç
      // çağrılmıyordu — yani CANLI Firebase dinleyicisi hiç kurulmuyordu,
      // sayfa sadece yerel önbellek + yedek JSON ile ayakta duruyordu.
      // Artık "urunler/" ilk okumada boş gelse bile canlı dinleyici
      // DOĞRUDAN kuruluyor; veri az sonra gelirse (bağlantı/senkron
      // gecikmesi) dinleyici kendiliğinden tetiklenip kataloğu günceller.
      tanilaKaydet("Ürün kataloğu: urunler/ ilk okumada boş geldi, canlı dinleyici yine de kuruluyor.");
      urunlerDinlemeyeBasla(db);
    }).catch(function(err){ tanilaKaydet("Ürün kataloğu: urunler/ kontrol hatası (izin/bağlantı sorunu olabilir).", err && err.message); });
  }

  function katalogBirlestir(asli, yedek){
    var sonuc = [];
    var anahtarlar = {};
    function kimlik(x){
      var b = String(x && (x.berta || x.BERTA) || "").trim().toLocaleLowerCase("tr-TR");
      var a = String(x && (x.abas || x.ABAS) || "").trim().toLocaleLowerCase("tr-TR");
      var n = String(x && (x.urun || x.URUN || x.name || x.NAME) || "").trim().toLocaleLowerCase("tr-TR");
      if(b && b !== "-" && b !== "nan") return "b:" + b;
      if(a && a !== "-" && a !== "nan") return "a:" + a;
      return n ? "n:" + n : "";
    }
    (asli || []).forEach(function(x){
      if(!x || !(x.urun || x.URUN || x.name || x.NAME)) return;
      var k = kimlik(x);
      if(k) anahtarlar[k] = true;
      sonuc.push(x);
    });
    (yedek || []).forEach(function(x){
      if(!x || !(x.urun || x.URUN || x.name || x.NAME)) return;
      var k = kimlik(x);
      if(k && anahtarlar[k]) return;
      if(k) anahtarlar[k] = true;
      sonuc.push(x);
    });
    sonuc.forEach(function(x, i){ if(x._anahtar === undefined) x._anahtar = String(i); });
    return sonuc;
  }

  var ilkYuklemeLoglandi = false;
  function katalogGuncelle(tumData){
    var urunler = [];
    // AŞAMA 3 (11.10.2026) — her ürüne, Firebase'deki GERÇEK anahtarını
    // ("_anahtar") ekliyoruz. Firebase, ardışık sayısal anahtarlı
    // ("0","1","2"...) objeleri otomatik olarak DİZİYE çevirdiği için
    // (urunler/ burada genelde böyledir) dizi dalında da indeks = gerçek
    // anahtar olur.
    if(Array.isArray(tumData)){
      tumData.forEach(function(x, i){
        if(x && x.urun){ x._anahtar = String(i); urunler.push(x); }
      });
    } else if(tumData && typeof tumData === "object"){
      Object.keys(tumData).forEach(function(k){
        if(tumData[k] && tumData[k].urun){ tumData[k]._anahtar = k; urunler.push(tumData[k]); }
      });
    }
    firebaseKatalog = urunler;
    katalogKur();
    // TANILAMA (15.10.2026) — katalog ilk kez dolduğunda (veya her
    // seferinde boş geldiğinde) kaç ürün yüklendiğini bir kez Hata
    // Kayıtları'na yazıyoruz; sürekli güncellemede (ürün ekleme/silme)
    // tekrar tekrar yazıp log'u şişirmemek için SADECE ilk yüklemede.
    if(!ilkYuklemeLoglandi){
      ilkYuklemeLoglandi = true;
      tanilaKaydet("Ürün kataloğu yüklendi: " + urunler.length + " ürün.");
    }
    katalogDinleyicileri.forEach(function(fn){ fn(); });
  }

  // KALDIRILDI (25.10.2026, Abdullah'ın "Hata Kayıtları"nda günde onlarca
  // kez tekrar eden 'permission_denied' şikayeti üzerine) — burada
  // "canliKatalogOnarimiDene" adında, 18.10.2026'daki TEK SEFERLİK bir
  // olay için yazılmış bir "otomatik tamir" fonksiyonu vardı. O olay çoktan
  // geçmişte kaldı; fonksiyon hâlâ her sayfa açılışında (canlı katalog
  // ilk anda < 100 ürün gösterdiğinde — ki bu genelde sadece bağlantının
  // daha yeni kurulduğu anlık bir durumdur) tetikleniyor, kullandığı
  // Firebase yoluna ("urunler_onarim_18102026") hiç izin tanımlanmadığı
  // için her defasında "permission_denied" ile başarısız oluyor ve bu
  // yüzden Hata Kayıtları'nı dolduruyordu — SADECE log gürültüsü değil,
  // asıl tehlikeli yanı şuydu: izin verilseydi, katalog.forEach(...) ile
  // oluşturduğu "onarilmis" nesnesini dbRef.ref("urunler").set(...) ile
  // DOĞRUDAN ÜZERİNE YAZIYORDU — yani eğer bu tetiklendiği anda
  // firebaseKatalog gerçekten eksik/yarım yüklenmişse (sadece bir
  // zamanlama rastlantısıyla, kataloğun GERÇEKTEN bozuk olmasından değil),
  // canlı kataloğun büyük kısmını 21.09.2026 tarihli eski yedek JSON ile
  // SESSİZCE EZEBİLİRDİ. Bu riski almamak için izin vermek yerine
  // fonksiyonun kendisi tamamen kaldırıldı.

  function urunlerDinlemeyeBasla(db){
    db.ref("urunler").on("value", function(snap){
      katalogGuncelle(snap.val());
    }, function(err){
      tanilaKaydet("Ürün kataloğu: canlı dinleme hatası (izin sorunu olabilir).", err && err.message);
    });
  }
  // urunlerKoktenOku KALDIRILDI (19.10.2026) — sadece yukarıdaki, artık
  // silinen "kökten taşıma" denemesi başarısız olursa çağrılıyordu; db.ref("/")
  // zaten 06.09.2026'dan beri güvenlik için kapalı, hiçbir zaman çalışamazdı.

  // KATALOĞU KUR: ana liste (Firebase + yedek JSON) + EKSTRA liste (sona).
  // Yerel önbelleğe (localStorage) SADECE ana kısım yazılır — silinmiş bir
  // ekstra ürün çevrimdışıyken eski önbellekten geri gelmesin.
  function katalogKur(){
    var ana = katalogBirlestir(firebaseKatalog, yedekKatalog);
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(ana)); }catch(e){}
    katalog = ana.concat(ekstraKatalog);
  }

  // EKSTRA LİSTEYİ CANLI DİNLE (yalnızca OKUMA). Her ürün: {urun, berta,
  // abas, fiyat}. Arama/sepet tarafında ana ürünlerle aynı biçimde görünür;
  // "_ekstra" bayrağı arayüzde EKSTRA etiketi çıkarmak için, "_anahtar"
  // ("ek:" önekli) ana listenin anahtarlarıyla karışmasın diye.
  function ekstraDinlemeyeBasla(db){
    db.ref("ekstraUrunler").on("value", function(snap){
      var v = snap.val();
      var liste = [];
      if(v && typeof v === "object"){
        Object.keys(v).forEach(function(k){
          var x = v[k];
          if(!x || typeof x !== "object" || !x.urun) return;
          liste.push({
            urun: String(x.urun), berta: String(x.berta||""), abas: String(x.abas||""),
            fiyat: parseFloat(x.fiyat)||0,
            _anahtar: "ek:" + k, _ekstra: true, _ekstraAnahtar: k
          });
        });
      }
      ekstraKatalog = liste;
      katalogKur();
      katalogDinleyicileri.forEach(function(fn){ fn(); });
    }, function(err){
      tanilaKaydet("Ekstra ürün listesi: canlı dinleme hatası (izin sorunu olabilir).", err && err.message);
    });
  }

  function katalogDegistiginde(fn){
    katalogDinleyicileri.push(fn);
  }

  function ara(sorgu){
    var q = (sorgu||"").trim().toLocaleLowerCase("tr-TR");
    var kelimeler = q.split(/\s+/).filter(function(k){ return k.length>0; });
    var sonuc = [];
    for(var i=0;i<katalog.length;i++){
      var item = katalog[i];
      // Ürün aramasında yalnızca gerçek BERTA veya ABAS kodu bulunan
      // katalog ürünleri yer alır. Kodsuz yardımcı/özel kayıtlar (ör.
      // "Garanti Mührü Mavi") genel ürün aramasını kirletmemelidir.
      // "-", boşluk ve Excel'den gelen "nan" değerleri geçerli kod sayılmaz.
      function temizKod(deger){
        var kod = (deger===null || deger===undefined ? "" : String(deger)).trim();
        if(!kod || kod.toLocaleLowerCase("tr-TR")==="nan" || kod==="-") return "";
        return kod.toLocaleLowerCase("tr-TR");
      }
      var b = temizKod(item.berta!==undefined ? item.berta : item.BERTA);
      var a = temizKod(item.abas!==undefined ? item.abas : item.ABAS);
      var n = (item.name||item.NAME||item.urun||item.URUN||"").toString().trim().toLocaleLowerCase("tr-TR");
      var araMetin = b+" "+a+" "+n;
      if(kelimeler.length===0){ sonuc.push({item:item, idx:i}); continue; }
      var eslesme = true;
      for(var k=0;k<kelimeler.length;k++){
        if(araMetin.indexOf(kelimeler[k])<0){ eslesme=false; break; }
      }
      if(eslesme) sonuc.push({item:item, idx:i});
    }
    return sonuc;
  }

  function urunBilgisi(item){
    var bt = item.berta||item.BERTA||"";
    var at = item.abas||item.ABAS||"";
    var nt = item.name||item.NAME||item.urun||item.URUN||"";
    if(bt.toString().toLowerCase()==="nan") bt="";
    if(at.toString().toLowerCase()==="nan") at="";
    var pt = (item.fiyat!==undefined) ? item.fiyat :
             (item.price!==undefined) ? item.price :
             (item.PRICE!==undefined) ? item.PRICE :
             (item.euro!==undefined) ? item.euro :
             (item.Euro!==undefined) ? item.Euro : 0;
    var cp = 0;
    if(pt!==null && pt!==undefined && pt!==""){
      var pf = parseFloat(String(pt).replace(",","."));
      if(!isNaN(pf)) cp = pf;
    }
    // AŞAMA 3 — görsel/TDS alanları İSTEĞE BAĞLI: eski ürün kayıtlarında
    // hiç yok (tanımsız kalır), ai-urun-panel.js bunu zaten "henüz
    // yüklenmedi" olarak gösteriyor.
    return {
      berta:bt, abas:at, ad:nt, fiyat:cp,
      ekstra: !!item._ekstra, ekstraAnahtar: item._ekstraAnahtar,
      gorselUrl: item.gorselUrl || undefined,
      tdsUrl: item.tdsUrl || undefined,
      tdsMetinOzet: item.tdsMetinOzet || undefined,
      tdsRevizyon: item.tdsRevizyon || undefined,
      medyaDurum: item.medyaDurum || undefined,
      _anahtar: item._anahtar
    };
  }

  function sepetteMi(idx){
    for(var i=0;i<sepet.length;i++){ if(sepet[i].idx===idx) return true; }
    return false;
  }

  function sepeteEkleCikar(idx){
    var mevcutIdx = -1;
    for(var i=0;i<sepet.length;i++){ if(sepet[i].idx===idx){ mevcutIdx=i; break; } }
    if(mevcutIdx !== -1){
      sepet.splice(mevcutIdx, 1);
      sepetiKaydet();
      return false;
    }
    var bilgi = urunBilgisi(katalog[idx]);
    sepet.push({idx:idx, ad:bilgi.ad, berta:bilgi.berta, abas:bilgi.abas, listeFiyat:bilgi.fiyat, dipFiyat:0, iskonto:0, adet:1, hesaplandi:false});
    sepetiKaydet();
    return true;
  }

  function sepetSayisi(){ return sepet.length; }

  // Sepeti boşalt/sıfırla (22.09.2026) — SADECE ürünleri temizler; seçili
  // müşteriye ve sayfaya dokunmaz, "İşlemi İptal Et"ten farklı olarak
  // hiçbir yere yönlendirmez. Kur override'ı da (varsa) temizler ki bir
  // sonraki ürün seçiminde eski bir manuel kur kalıntısı olmasın.
  function sepetiBosalt(){
    sepet = [];
    sepetiKaydet();
    try{ localStorage.removeItem("weiconv2_sepet_kur_override"); }catch(e){}
  }

  // ============================================================
  // EKSTRA ÜRÜN LİSTESİ — EKLE / DÜZENLE / SİL (04.11.2026, Abdullah onayı)
  // ------------------------------------------------------------
  // ESKİ "yeniUrunEkle" ANA "urunler/" düğümüne transaction ile yazıyordu
  // (18.10.2026'da tüm kataloğu tek kayda düşüren hata buradan çıkmıştı).
  // O yol TAMAMEN KALDIRILDI. Aşağıdaki üç işlev SADECE "ekstraUrunler/"
  // altına yazar ve hepsi tek bir ürüne (tek çocuk düğüme) dokunur:
  //   ekle     -> .push()   : yeni bir çocuk anahtarı üretir, var olan hiçbir
  //                           kaydı okumaz/ezmez (okuma-değiştir-yaz YOK)
  //   düzelt   -> .update() : yalnızca o ürünün alanlarını günceller
  //   sil      -> .remove() : yalnızca o ürünü siler
  // Düzelt/sil, anahtarın gerçekten ekstra listede olduğunu doğrular; böylece
  // boş/yanlış bir yol ana listeye ya da başka bir düğüme asla ulaşamaz.
  // ============================================================
  function ekstraBilgiDogrula(bilgi){
    var ad = (bilgi && bilgi.ad || "").trim().slice(0,200);
    var berta = (bilgi && bilgi.berta || "").trim().slice(0,60);
    var abas = (bilgi && bilgi.abas || "").trim().slice(0,60);
    var fiyat = parseFloat(String(bilgi && bilgi.fiyat).replace(",","."));
    if(!ad) return {hata:"Ürün adı zorunlu."};
    if(isNaN(fiyat) || fiyat <= 0) return {hata:"Geçerli bir fiyat girin."};
    return {ad:ad, berta:berta, abas:abas, fiyat:fiyat};
  }
  function kodAyniMi(x, berta, abas){
    var b = String(x.berta||x.BERTA||"").trim().toLocaleLowerCase("tr-TR");
    var a = String(x.abas||x.ABAS||"").trim().toLocaleLowerCase("tr-TR");
    return !!berta && !!abas && b === berta.toLocaleLowerCase("tr-TR") && a === abas.toLocaleLowerCase("tr-TR");
  }
  function ekstraAnahtarGecerliMi(anahtar){
    if(typeof anahtar !== "string" || !/^[-_A-Za-z0-9]+$/.test(anahtar)) return false;
    for(var i=0;i<ekstraKatalog.length;i++){ if(ekstraKatalog[i]._ekstraAnahtar === anahtar) return true; }
    return false;
  }

  function ekstraUrunEkle(bilgi, geriBildir){
    try{
      var d = ekstraBilgiDogrula(bilgi);
      if(d.hata){ geriBildir(false, d.hata); return; }
      // Aynı Berta+Abas kodlu ürün ana listede ya da ekstra listede varsa ikinci kez ekleme.
      for(var i=0;i<katalog.length;i++){
        if(kodAyniMi(katalog[i], d.berta, d.abas)){
          geriBildir(false, katalog[i]._ekstra ? "Bu kodlu ürün ekstra listede zaten var." : "Bu kodlu ürün ana listede zaten var — aramadan bulabilirsin.");
          return;
        }
      }
      firebase.database().ref("ekstraUrunler").push({
        urun: d.ad, berta: d.berta, abas: d.abas, fiyat: d.fiyat, eklenme: Date.now()
      }).then(function(){ geriBildir(true, d); }).catch(function(err){ geriBildir(false, err); });
    }catch(e){ geriBildir(false, e); }
  }

  function ekstraUrunGuncelle(anahtar, bilgi, geriBildir){
    try{
      if(!ekstraAnahtarGecerliMi(anahtar)){ geriBildir(false, "Ürün ekstra listede bulunamadı."); return; }
      var d = ekstraBilgiDogrula(bilgi);
      if(d.hata){ geriBildir(false, d.hata); return; }
      for(var i=0;i<katalog.length;i++){
        if(katalog[i]._ekstraAnahtar !== anahtar && kodAyniMi(katalog[i], d.berta, d.abas)){
          geriBildir(false, "Bu kodlu başka bir ürün zaten var.");
          return;
        }
      }
      firebase.database().ref("ekstraUrunler/" + anahtar).update({
        urun: d.ad, berta: d.berta, abas: d.abas, fiyat: d.fiyat, guncelleme: Date.now()
      }).then(function(){ geriBildir(true, d); }).catch(function(err){ geriBildir(false, err); });
    }catch(e){ geriBildir(false, e); }
  }

  function ekstraUrunSil(anahtar, geriBildir){
    try{
      if(!ekstraAnahtarGecerliMi(anahtar)){ geriBildir(false, "Ürün ekstra listede bulunamadı."); return; }
      firebase.database().ref("ekstraUrunler/" + anahtar).remove()
        .then(function(){ geriBildir(true); }).catch(function(err){ geriBildir(false, err); });
    }catch(e){ geriBildir(false, e); }
  }

  // Tek bir ekstra ürünün güncel bilgisi (düzenleme formunu doldurmak için).
  function ekstraUrunBul(anahtar){
    for(var i=0;i<ekstraKatalog.length;i++){
      if(ekstraKatalog[i]._ekstraAnahtar === anahtar){
        var x = ekstraKatalog[i];
        return {anahtar:anahtar, ad:x.urun, berta:x.berta, abas:x.abas, fiyat:x.fiyat};
      }
    }
    return null;
  }

  return {
    baslat: baslat,
    katalogDegistiginde: katalogDegistiginde,
    ara: ara,
    urunBilgisi: urunBilgisi,
    sepetteMi: sepetteMi,
    sepeteEkleCikar: sepeteEkleCikar,
    sepetSayisi: sepetSayisi,
    sepetiBosalt: sepetiBosalt,
    katalogUzunluk: function(){ return katalog.length; },
    // Eski adla çağıran kod (product-render.js) ANA listeye değil EKSTRA listeye yazar.
    yeniUrunEkle: ekstraUrunEkle,
    ekstraUrunEkle: ekstraUrunEkle,
    ekstraUrunGuncelle: ekstraUrunGuncelle,
    ekstraUrunSil: ekstraUrunSil,
    ekstraUrunBul: ekstraUrunBul
  };

})();

ProductData.baslat();
