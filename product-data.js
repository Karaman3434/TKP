/*
  product-data.js
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
  var sepet = [];
  var katalogDinleyicileri = [];
  var katalogDinleyiciBagli = false;

  try{
    var kayitliSepet = localStorage.getItem(SEPET_KEY);
    if(kayitliSepet) sepet = JSON.parse(kayitliSepet);
  }catch(e){ sepet = []; }

  function sepetiKaydet(){
    try{ localStorage.setItem(SEPET_KEY, JSON.stringify(sepet)); }catch(e){}
  }

  function baslat(){
    try{
      if(!firebase.apps.length){ firebase.initializeApp(WEICON_FIREBASE_CONFIG); }
      var db = firebase.database();

      try{
        var local = localStorage.getItem(STORAGE_KEY);
        if(local){
          katalog = JSON.parse(local);
          katalogDinleyicileri.forEach(function(fn){ fn(); });
        }
      }catch(e){}

      urunlerYoluHazirla(db);
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
      tanilaKaydet("Ürün kataloğu: urunler/ düğümü boş/yok geldi — kökten taşıma deneniyor.");
      // "urunler/" boş — kökteki eskileri bir kereye mahsus taşı.
      db.ref("/").once("value").then(function(kokSnap){
        var tumData = kokSnap.val();
        var tasinacak = {};
        if(tumData && typeof tumData === "object" && !Array.isArray(tumData)){
          Object.keys(tumData).forEach(function(k){
            if(!isNaN(parseInt(k,10)) && tumData[k] && typeof tumData[k]==="object" && tumData[k].urun){
              tasinacak[k] = tumData[k];
            }
          });
        }
        if(Object.keys(tasinacak).length > 0){
          db.ref("urunler").set(tasinacak).then(function(){
            urunlerDinlemeyeBasla(db);
          }).catch(function(err){
            tanilaKaydet("Ürün kataloğu: urunler/ yoluna taşınamadı (yazma izni sorunu olabilir), geçici olarak kökten okunuyor.", err && err.message);
            urunlerKoktenOku(db); // yedek yol — taşıma başarısız olursa eski yöntem
          });
        } else {
          tanilaKaydet("Ürün kataloğu: kökte de taşınacak ürün bulunamadı — katalog gerçekten boş görünüyor.");
          urunlerDinlemeyeBasla(db); // hiç ürün yok, boş urunler/ dinlenir
        }
      }).catch(function(err){ tanilaKaydet("Ürün kataloğu: kök okuma hatası (izin sorunu olabilir).", err && err.message); });
    }).catch(function(err){ tanilaKaydet("Ürün kataloğu: urunler/ kontrol hatası (izin/bağlantı sorunu olabilir).", err && err.message); });
  }

  var ilkYuklemeLoglandi = false;
  function katalogGuncelle(tumData){
    var urunler = [];
    // AŞAMA 3 (11.10.2026) — AI Ürün Asistanı projesi: her ürüne, Firebase'
    // deki GERÇEK anahtarını ("_anahtar") ekliyoruz. Bu, urun-medya-
    // eslestir ekranının bir ürüne görsel/TDS bağlarken TAHMİNİ bir yol
    // değil, doğrudan o ürünün kendi Firebase düğümünü hedeflemesini sağlar
    // (bkz. urunMedyaGuncelle). Firebase, ardışık sayısal anahtarlı
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
    katalog = urunler;
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(urunler)); }catch(e){}
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

  function urunlerDinlemeyeBasla(db){
    db.ref("urunler").on("value", function(snap){
      katalogGuncelle(snap.val());
    }, function(err){
      tanilaKaydet("Ürün kataloğu: canlı dinleme hatası (izin sorunu olabilir).", err && err.message);
    });
  }

  // Sadece taşıma işlemi başarısız olursa devreye giren, eski davranışı
  // koruyan yedek yol (kalıcı çözüm değildir).
  function urunlerKoktenOku(db){
    db.ref("/").on("value", function(snap){
      katalogGuncelle(snap.val());
    }, function(err){
      tanilaKaydet("Ürün kataloğu: kök dinleme hatası.", err && err.message);
    });
  }

  function katalogDegistiginde(fn){
    katalogDinleyicileri.push(fn);
  }

  function ara(sorgu){
    // Arama: Firebase katalogundaki ürün adı + BERTA + ABAS alanları.
    // Kodsuz yardımcı kayıtları genel ürün sonuçlarından çıkar; ancak
    // boş/eksik alanlar diğer ürünlerin aranmasını engellemez.
    function norm(deger){
      return (deger===null || deger===undefined ? "" : String(deger))
        .toLocaleLowerCase("tr-TR")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ").trim();
    }
    function kod(deger){
      var v = norm(deger);
      return (!v || v === "nan" || v === "-") ? "" : v;
    }

    var q = norm(sorgu);
    if(!q) return [];
    var kelimeler = q.split(/\s+/).filter(Boolean);
    var sonuc = [];

    for(var i=0;i<katalog.length;i++){
      var item = katalog[i] || {};
      var b = kod(item.berta !== undefined ? item.berta :
                  item.BERTA !== undefined ? item.BERTA : item.bertaKodu);
      var a = kod(item.abas !== undefined ? item.abas :
                  item.ABAS !== undefined ? item.ABAS : item.abasKodu);
      var ad = norm(item.urun || item.URUN || item.ad || item.AD ||
                    item.name || item.NAME || item.urunAdi || item.productName);

      // İki kodu da olmayan özel kayıtlar normal ürün aramasını kirletmesin.
      if(!b && !a) continue;

      // Ayrı alanları tek arama metnine dönüştür. Çok kelimeli sorgularda
      // tüm kelimeler bulunmalı; böylece "VA 100" ürün adında eşleşir.
      var metin = norm([ad,b,a].filter(Boolean).join(" "));
      var eslesir = kelimeler.every(function(k){ return metin.indexOf(k) !== -1; });
      if(eslesir) sonuc.push({item:item, idx:i});
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
    // yüklenmedi" olarak gösteriyor. _anahtar, urunMedyaGuncelle'nin
    // doğru Firebase düğümünü bulması için gerekli.
    return {
      berta:bt, abas:at, ad:nt, fiyat:cp,
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

  function yeniUrunEkle(bilgi, geriBildir){
    try{
      var ad = (bilgi.ad||"").trim().slice(0,200);
      var berta = (bilgi.berta||"").trim().slice(0,60);
      var abas = (bilgi.abas||"").trim().slice(0,60);
      var fiyat = parseFloat(bilgi.fiyat);
      if(!ad){ geriBildir(false, "Ürün adı zorunlu."); return; }
      if(isNaN(fiyat) || fiyat<=0){ geriBildir(false, "Geçerli bir fiyat girin."); return; }

      var db = firebase.database();
      db.ref("urunler").transaction(function(tumData){
        tumData = tumData || {};
        var veri = (typeof tumData === "object" && !Array.isArray(tumData)) ? tumData : {};
        var mukerrer = false;
        var maxIndex = -1;
        Object.keys(veri).forEach(function(k){
          var n = parseInt(k, 10);
          if(!isNaN(n) && String(n)===k && n>maxIndex) maxIndex = n;
          var it = veri[k];
          if(it && typeof it === "object"){
            var b=(it.berta||it.BERTA||"").toString().trim();
            var a=(it.abas||it.ABAS||"").toString().trim();
            if(berta && abas && b===berta && a===abas) mukerrer = true;
          }
        });
        if(mukerrer) return;
        veri[String(maxIndex + 1)] = {urun:ad, berta:berta, abas:abas, fiyat:fiyat};
        return veri;
      }).then(function(result){
        if(!result.committed){ geriBildir(false, "Ürün ekleme işlemi iptal edildi."); return; }
        if(berta && abas){
          var yeni = result.snapshot.val() || {};
          var bulundu = Object.keys(yeni).some(function(k){
            var it=yeni[k];
            return it && (it.berta||it.BERTA||"").toString().trim()===berta && (it.abas||it.ABAS||"").toString().trim()===abas;
          });
          if(!bulundu){ geriBildir(false, "Ürün kaydı doğrulanamadı."); return; }
        }
        geriBildir(true);
      }).catch(function(err){ geriBildir(false, err); });
    }catch(e){ geriBildir(false, e); }
  }

  // AŞAMA 3 (11.10.2026) — AI Ürün Asistanı projesi: tek bir ürünün
  // görsel/TDS alanlarını, ürünün GERÇEK Firebase anahtarını ("_anahtar",
  // bkz. katalogGuncelle/urunBilgisi) hedefleyerek günceller. urun-yukle-
  // render.js'teki toplu ".set()" ile KARIŞTIRILMASIN: burada SADECE tek
  // bir düğüme ".update()" yapılır — kataloğun geri kalanı asla etkilenmez,
  // yarım kalan/başarısız bir çağrı o ürünün urun/berta/abas/fiyat
  // alanlarına DOKUNMAZ (update() sadece gönderilen alanları birleştirir).
  // "veri" içinde null gönderilen bir alan RTDB'de SİLİNİR (ör. bir
  // görseli kaldırırken {gorselUrl:null, gorselYol:null} gönderilir).
  function urunMedyaGuncelle(anahtar, veri, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      if(anahtar===undefined || anahtar===null || anahtar===""){
        cb(false, "Ürün anahtarı eksik — önce listeden gerçek bir ürün kaydı seçilmeli.");
        return;
      }
      var IZINLI_ALANLAR = ["gorselUrl","gorselYol","tdsUrl","tdsYol","tdsMetinOzet","tdsRevizyon","medyaDurum"];
      var guncelleme = {};
      var varMi = false;
      IZINLI_ALANLAR.forEach(function(k){
        if(veri && veri.hasOwnProperty(k)){ guncelleme[k] = veri[k]; varMi = true; }
      });
      if(!varMi){ cb(false, "Güncellenecek bir alan belirtilmedi."); return; }
      var kullanici = (typeof firebase!=="undefined" && firebase.auth && firebase.auth().currentUser) ? firebase.auth().currentUser.uid : null;
      guncelleme.medyaGuncelleme = {ts: Date.now(), uid: kullanici};
      firebase.database().ref("urunler/" + anahtar).update(guncelleme)
        .then(function(){ cb(true); })
        .catch(function(err){ cb(false, err && err.message ? err.message : String(err)); });
    }catch(e){ cb(false, e && e.message ? e.message : String(e)); }
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
    yeniUrunEkle: yeniUrunEkle,
    urunMedyaGuncelle: urunMedyaGuncelle
  };

})();

ProductData.baslat();
