/*
  ajanda-data.js — VERSİYON: WG.271026.2238.1140
  =================================================
  09.10.2026, Abdullah'ın isteğiyle: günlük kağıt ajandasının (not
  defteri) sayfa fotoğraflarını tarihe göre saklayıp hızlıca geri
  bulabilmek için. Gün başına birden fazla sayfa/fotoğraf olabilir.

  MİMARİ DEĞİŞİKLİĞİ (12.10.2026) — eskiden gerçek JPEG dosyası Firebase
  STORAGE'a yükleniyor, Realtime Database'de sadece hafif bir kayıt
  ({yol, url, zaman}) tutuluyordu. Bu projede Storage'a yazan TEK özellik
  Ajanda'ydı (Komisyon dahil başka hiçbir yer Storage kullanmıyor) ve
  hesapta/kurallarda art arda iki farklı Storage sorunu çıktı (önce
  "quota exceeded", sonra "PERMISSION_DENIED") — ikisi de bu kod
  tarafında düzeltilemeyen, Firebase Console tarafında durması gereken
  sorunlar. Abdullah'ın isteğiyle Storage'a bağımlılık TAMAMEN kaldırıldı:
  artık sıkıştırılmış JPEG doğrudan "data:image/jpeg;base64,..." olarak
  Realtime Database kaydının İÇİNE yazılıyor (tıpkı projedeki diğer
  küçük-görsel alanları gibi) — RTDB zaten her yerde çalışıyor, Storage
  izin/kota sorunundan tamamen bağımsız.

  BİLİNEN DEZAVANTAJ (dürüstçe not düşüyorum) — RTDB'nin "value"
  dinleyicisi "ajanda" ağacının TAMAMINI her değişiklikte yeniden indirir;
  yüzlerce sayfa birikince bu eskisinden daha fazla veri/yavaşlık
  demektir. Storage'daki izin sorunu Firebase Console'da çözülürse,
  ileride tekrar Storage'a (yalnızca RTDB'de hafif kayıt tutarak) dönmek
  daha sağlıklı olur — ama o Console tarafı olmadan kod bunu tek başına
  çözemiyordu, bu yüzden şimdilik kesin çalışan yol seçildi.

  GERİYE DÖNÜK UYUM — eski kayıtlarda hâlâ Storage'ın https indirme
  URL'si olabilir ("yol" alanıyla); render tarafı (ziyaret-render.js)
  "url" alanını olduğu gibi background-image kaynağı olarak kullandığı
  için data: URL ile https: URL arasında fark gözetmeden ikisi de aynı
  şekilde görüntülenir. Silme (fotografSil) eski kayıtlar için Storage
  dosyasını da silmeyi dener (yol varsa); yeni kayıtlarda yol hiç
  olmadığından bu adım atlanır.

  Fotoğraf, buraya verilmeden ÖNCE ziyaret-render.js'teki resimSikistir()
  ve kırpma arayüzü ile küçültülüp/kırpılıp %65 kaliteli JPEG'e çevrilmiş
  olmalı.
*/

var AjandaData = (function(){

  var veri = {}; // { "YYYY-MM-DD": { pushId: {yol, url, zaman} } }
  var dinleyiciler = [];
  var yuklendi = false;

  function baslat(){
    try{
      if(!firebase.apps.length){ firebase.initializeApp(ISTAKIP_FIREBASE_CONFIG); }
      firebase.database().ref("ajanda").on("value", function(snap){
        veri = snap.val() || {};
        yuklendi = true;
        dinleyiciler.forEach(function(fn){
          try{ fn(); }catch(e){ console.error("Ajanda dinleyici hatası:", e); }
        });
      }, function(err){
        console.error("Ajanda okunamadı:", err);
      });
    }catch(e){ console.error("AjandaData başlatılamadı:", e); }
  }

  function degistiginde(fn){
    if(typeof fn === "function" && dinleyiciler.indexOf(fn)===-1) dinleyiciler.push(fn);
  }

  function yuklendiMi(){ return yuklendi; }

  // Takvim gün rozetleri için: {"YYYY-MM-DD": sayi}
  function gunSayilari(){
    var sonuc = {};
    Object.keys(veri).forEach(function(tarih){
      sonuc[tarih] = Object.keys(veri[tarih] || {}).length;
    });
    return sonuc;
  }

  // Bir günün kayıtları, saat sırasına göre.
  function gununKayitlari(tarih){
    var gun = veri[tarih] || {};
    return Object.keys(gun).map(function(id){
      var kayit = gun[id];
      return {id: id, tarih: tarih, yol: kayit.yol, url: kayit.url, zaman: kayit.zaman};
    }).sort(function(a, b){ return a.zaman - b.zaman; });
  }

  // TÜM fotoğrafları kronolojik sırayla tek dizi halinde döndürür — tam
  // ekran görüntüleyici gün sınırını fark ettirmeden bunun üstünde
  // kaydırarak (swipe) gezinir.
  function tumKayitlarKronolojik(){
    var liste = [];
    Object.keys(veri).sort().forEach(function(tarih){
      gununKayitlari(tarih).forEach(function(k){ liste.push(k); });
    });
    return liste;
  }

  // dataUrl: "data:image/jpeg;base64,..." — önceden sıkıştırılmış olmalı.
  // 12.10.2026 — Storage bağımlılığı kaldırıldı (bkz. dosya başı not):
  // sıkıştırılmış JPEG artık doğrudan RTDB kaydının "url" alanına
  // "data:image/jpeg;base64,..." olarak yazılıyor, ayrı bir Storage
  // yüklemesi/izni gerekmiyor.
  function fotografEkle(tarih, dataUrl, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      var zaman = Date.now();
      firebase.database().ref("ajanda/" + tarih).push({url: dataUrl, zaman: zaman})
        .then(function(){ cb(true); })
        .catch(function(err){ cb(false, err); });
    }catch(e){ cb(false, e); }
  }

  function fotografSil(tarih, id, yol, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      firebase.database().ref("ajanda/" + tarih + "/" + id).remove()
        .then(function(){
          if(yol) return firebase.storage().ref(yol).delete().catch(function(){});
        })
        .then(function(){ cb(true); })
        .catch(function(err){ cb(false, err); });
    }catch(e){ cb(false, e); }
  }

  baslat();

  return {
    degistiginde: degistiginde,
    yuklendiMi: yuklendiMi,
    gunSayilari: gunSayilari,
    gununKayitlari: gununKayitlari,
    tumKayitlarKronolojik: tumKayitlarKronolojik,
    fotografEkle: fotografEkle,
    fotografSil: fotografSil
  };

})();
