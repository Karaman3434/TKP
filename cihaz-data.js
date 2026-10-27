/*
  cihaz-data.js
  ==============
  Cihaz kimliği ve "Cihazlarım" engelleme mekanizmasının veri katmanı.
  DOM'a dokunmaz. Firebase'de "cihazlar/{cihazId}" altında saklanır:
    { ad: "iPhone 13", sonGorulme: <ms>, engelli: true/false }

  Cihaz kimliği (cihazId) cihaza ÖZGÜDÜR — tarayıcının localStorage'ında
  saklanır, cihazlar arasında senkronize OLMAZ (bilerek — her cihaz kendini
  tanımlamalı). İlk kullanımda "Adsız Cihaz" olarak kaydolur; Abdullah
  "Cihazlarım" ekranından her cihaza kendi üzerindeyken bir ad verir.

  GÜVENLİK NOTU: "Samsung S22" adı (KORUMALI_AD), Cihazlar ve Kullanıcılar
  yönetim panelinin SADECE o adı taşıyan cihazdan açılabilmesi için hâlâ
  kullanılıyor (bkz. cihaz-kullanici-render.js → ckErisimKontrolEt). AMA
  06.10.2026'dan itibaren (Abdullah'ın isteğiyle) bu ad artık "engellenemez"
  anlamına GELMİYOR — istisnasız her cihaz (bu ad dahil, başka bir cihazdan)
  engellenebilir; tek istisna, üzerinde bulunduğun cihazı kendi kendine
  engelleyememen (aşağıdaki id === benimIdim() kontrolü).
*/

var CihazData = (function(){

  var KORUMALI_AD = "samsung s22"; // küçük harfe çevrilip karşılaştırılır

  function baslat(){
    try{ if(!firebase.apps.length){ firebase.initializeApp(ISTAKIP_FIREBASE_CONFIG); } }catch(e){}
  }

  function benimIdim(){
    try{
      var id = localStorage.getItem("weicon_cihaz_id");
      if(!id){
        id = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2,8);
        localStorage.setItem("weicon_cihaz_id", id);
      }
      return id;
    }catch(e){ return "bilinmeyen"; }
  }

  function benimAdim(){
    try{ return localStorage.getItem("weicon_cihaz_adi") || "Adsız Cihaz"; }catch(e){ return "Adsız Cihaz"; }
  }

  function korumaliMi(ad){
    return String(ad||"").trim().toLowerCase() === KORUMALI_AD;
  }

  // Bu cihazı Firebase'e kaydeder / "son görülme"sini tazeler. Ad alanını
  // SADECE cihazın kendi yerel adı varsa gönderir (update — üzerine
  // yazmaz), böylece başka bir cihazdan yapılan yeniden adlandırma
  // kaybolmaz.
  function kaydiGuncelle(){
    try{
      baslat();
      var id = benimIdim();
      var veri = { sonGorulme: Date.now() };
      try{
        var yerelAd = localStorage.getItem("weicon_cihaz_adi");
        if(yerelAd) veri.ad = yerelAd;
      }catch(e){}
      firebase.database().ref("cihazlar/" + id).update(veri).catch(function(){});
    }catch(e){}
  }

  // Bu cihazı bir isimle etiketler — hem yerelde hem Firebase'de.
  function adiKaydet(ad, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      ad = String(ad||"").trim();
      if(!ad){ cb(false); return; }
      localStorage.setItem("weicon_cihaz_adi", ad);
      baslat();
      firebase.database().ref("cihazlar/" + benimIdim()).update({ad: ad, sonGorulme: Date.now()})
        .then(function(){ cb(true); }).catch(function(){ cb(true); }); // yerel kayıt zaten oldu
    }catch(e){ cb(false); }
  }

  /* ---------- KULLANICI ADI (03.10.2026, Abdullah'ın isteğiyle) ----------
     Cihazın kendi adından (ad — Abdullah'ın S22'den verdiği "iPhone 13" gibi
     bir etiket) AYRI bir alan: bu cihazı o an KULLANAN kişinin kendi
     tanımladığı isim (örn. "ANKARA BOLGE 19"). İlk kullanımda zorunlu
     girilir (bkz. home.html/home-render.js), sonradan drawer'daki "Hesabım"
     kartından istenildiği zaman değiştirilebilir. Hiçbir şifre/giriş
     hesabıyla İLGİSİ YOKTUR — sadece kendini tanıtan bir etikettir.
     Her değişiklik "cihazlar/{id}/kullaniciAdiGecmisi" altına da (silinmeden,
     tarih damgasıyla) eklenir — Abdullah S22'den "Cihazlar ve Kullanıcılar"
     sayfasında hangi cihazın/kişinin adını ne zaman değiştirdiğini görebilsin
     diye. */
  function benimKullaniciAdim(){
    try{ return localStorage.getItem("weicon_kullanici_adi") || ""; }catch(e){ return ""; }
  }

  function kullaniciAdiKaydet(adi, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      adi = String(adi||"").trim();
      if(!adi){ cb(false); return; }
      localStorage.setItem("weicon_kullanici_adi", adi);
      // Yerel kayıt bu satırda tamamlandı — ekranı Firebase'in sunucudan
      // onay dönmesini bekleterek kilitleme (zayıf/kesik mobil bağlantıda
      // bu onay uzun süre gelmeyebilir, hatta hiç gelmeyebilir). Kullanıcıyı
      // hemen serbest bırak, Firebase senkronunu arka planda sürdür.
      cb(true);
      try{
        baslat();
        var id = benimIdim();
        var db = firebase.database();
        db.ref("cihazlar/" + id).update({ kullaniciAdi: adi, sonGorulme: Date.now() })
          .then(function(){ return db.ref("cihazlar/" + id + "/kullaniciAdiGecmisi").push({adi: adi, zaman: Date.now()}); })
          .catch(function(){});
      }catch(e){}
    }catch(e){ cb(false); }
  }

  /* ---------- ADMİN DÜZENLEMESİ (06.10.2026, Abdullah'ın isteğiyle) ----------
     kullaniciAdiKaydet() SADECE cihazın kendisi (benimIdim()) için çalışır.
     Aşağıdaki ikisi ise "Cihazlar ve Kullanıcılar" panelinden, Abdullah'ın
     BAŞKA bir cihazın adını/PIN'ini kendi S22'sinden değiştirebilmesi için —
     id parametresiyle, cihazın üzerinde olmaya gerek kalmadan çalışır. */
  function adiniDegistir(id, yeniAd, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      yeniAd = String(yeniAd||"").trim();
      if(!id || !yeniAd){ cb(false, "İsim boş olamaz."); return; }
      baslat();
      var db = firebase.database();
      db.ref("cihazlar/" + id).update({ kullaniciAdi: yeniAd })
        .then(function(){ return db.ref("cihazlar/" + id + "/kullaniciAdiGecmisi").push({adi: yeniAd, zaman: Date.now()}); })
        .then(function(){ cb(true); })
        .catch(function(err){ cb(false, err.message); });
    }catch(e){ cb(false, e.message); }
  }

  // pinHashDegeri: pin-utils.js'teki pinHashHesapla(pin) ile üretilmiş
  // SHA-256 hash'i — düz metin PIN hiçbir yerde saklanmaz/gönderilmez.
  function pinKaydet(id, pinHashDegeri, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      if(!id || !pinHashDegeri){ cb(false, "PIN kaydedilemedi."); return; }
      baslat();
      firebase.database().ref("cihazlar/" + id).update({ pinHash: pinHashDegeri, pinZaman: Date.now() })
        .then(function(){ cb(true); }).catch(function(err){ cb(false, err.message); });
    }catch(e){ cb(false, e.message); }
  }

  /* ---------- AYNI İSİMLİ KOPYA TESPİTİ (10.10.2026, Abdullah'ın isteğiyle)
     ----------
     KÖK NEDEN: cihazId tarayıcının localStorage'ına bağlı — bu silinirse
     (veri temizleme, PWA'yı silip yeniden ekleme, depolama temizliği vb.)
     program o telefonu "yeni bir cihaz" sanıp sıfırdan kaydediyor. Kullanıcı
     ona eski ismini (örn. "Samsung S22") tekrar verince AYNI isimde ama
     FARKLI id'li bir ikinci kayıt oluşuyor — eskisi yetim kalıyor.
     "Engelle" bunu sadece listeden gizliyor, listeyi büyütmeye devam ediyor.

     ÇÖZÜM: "Bu Cihaz" adı kaydedilmeden ÖNCE, aynı isimde BAŞKA (ve hâlâ
     aktif/engellenmemiş) bir kayıt var mı diye tek seferlik kontrol edilir
     (bkz. cihaz-kullanici-render.js). Varsa kullanıcıya (Abdullah'a) açıkça
     sorulur: eskisinin yerine mi geçiliyor (yetim kayıt silinir, liste
     büyümez) yoksa gerçekten farklı bir cihaz mı (ikisi de kalır). Otomatik
     silme YAPILMAZ — karar her zaman insana bırakılır. */
  function aktifAyniIsimdeBaskaCihazBulAsync(ad, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      var aranan = String(ad||"").trim().toLowerCase();
      if(!aranan){ cb(null); return; }
      baslat();
      var kendiId = benimIdim();
      firebase.database().ref("cihazlar").once("value").then(function(snap){
        var veri = snap.val() || {};
        var bulunan = null;
        Object.keys(veri).forEach(function(id){
          if(bulunan || id === kendiId) return;
          var c = veri[id];
          if(!c || c.engelli) return; // engellenmiş olanlar zaten "ölü" sayılır, çakışma değildir
          if(String(c.ad||"").trim().toLowerCase() === aranan){
            bulunan = Object.assign({id:id}, c);
          }
        });
        cb(bulunan);
      }).catch(function(){ cb(null); }); // okunamazsa engelleme — kayıt normal akışla devam etsin
    }catch(e){ cb(null); }
  }

  // Bir cihaz kaydını Firebase'den KALICI OLARAK siler (engelle'nin aksine
  // geri alınamaz) — hem "eskisinin yerine geç" akışında yetim kaydı
  // temizlemek için, hem de "Engellenen cihazlar" listesinden elle silmek
  // için kullanılıyor. Üzerinde bulunduğun cihazı kendi kendine silemezsin.
  function cihaziSil(id, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      if(!id){ cb(false, "Cihaz kimliği eksik."); return; }
      if(id === benimIdim()){ cb(false, "Şu an üzerinde olduğun cihazı silemezsin."); return; }
      baslat();
      firebase.database().ref("cihazlar/" + id).remove()
        .then(function(){ cb(true); }).catch(function(err){ cb(false, err.message); });
    }catch(e){ cb(false, e.message); }
  }

  function tumCihazlariDinle(fn){
    try{
      baslat();
      firebase.database().ref("cihazlar").on("value", function(snap){
        var veri = snap.val() || {};
        var liste = Object.keys(veri).map(function(id){
          return Object.assign({id:id}, veri[id]);
        }).sort(function(a,b){ return (b.sonGorulme||0) - (a.sonGorulme||0); });
        fn(liste);
      });
    }catch(e){}
  }

  function engelle(id, ad, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    if(id === benimIdim()){ cb(false, "Şu an üzerinde olduğun cihazı engelleyemezsin."); return; }
    try{
      baslat();
      firebase.database().ref("cihazlar/" + id).update({engelli: true})
        .then(function(){ cb(true); }).catch(function(err){ cb(false, err.message); });
    }catch(e){ cb(false, e.message); }
  }

  function engeliKaldir(id, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      baslat();
      firebase.database().ref("cihazlar/" + id).update({engelli: false})
        .then(function(){ cb(true); }).catch(function(err){ cb(false, err.message); });
    }catch(e){ cb(false, e.message); }
  }

  /* ---------- CİHAZ ONAYI (25.10.2026, "izin vermeden bağlanamasın"
     isteği, Abdullah'ın isteğiyle) ----------
     Onay kontrolünün KENDİSİ (okuma + "bekliyor" yazma) BİLEREK auth.js
     içinde, buradan BAĞIMSIZ duruyor — tıpkı yukarıdaki cihaz-engelleme
     gibi, auth.js TÜM sayfalarda yüklenip cihaz-data.js'in her sayfada
     yüklü olmasına güvenemiyor (bkz. auth.js'teki "KASITLI OLARAK
     cihaz-data.js'e bağımlı değil" notu). Bu fonksiyon SADECE "Cihazlar ve
     Kullanıcılar" panelindeki "✓ Onayla" düğmesi için — admin panelinin
     kendisi zaten cihaz-data.js'i yüklüyor. */
  function onaylaCihazi(id, yeniAd, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      if(!id){ cb(false, "Cihaz kimliği eksik."); return; }
      baslat();
      var guncelleme = { onayDurumu: "onayli" };
      yeniAd = String(yeniAd||"").trim();
      if(yeniAd) guncelleme.ad = yeniAd;
      firebase.database().ref("cihazlar/" + id).update(guncelleme)
        .then(function(){ cb(true); }).catch(function(err){ cb(false, err.message); });
    }catch(e){ cb(false, e.message); }
  }

  // TEK SEFERLİK kontrol — auth.js her sayfa açılışında bunu çağırır.
  // Bu cihaz engellenmişse geriBildir(true) döner.
  function benEngelliMiyim(geriBildir){
    try{
      baslat();
      firebase.database().ref("cihazlar/" + benimIdim() + "/engelli").once("value")
        .then(function(snap){ geriBildir(snap.val() === true); })
        .catch(function(){ geriBildir(false); }); // okunamazsa erişimi ENGELLEME — çevrimdışı kilitlenmeyi önle
    }catch(e){ geriBildir(false); }
  }

  /* ---------- MANUEL CİHAZ GRUPLARI (25.10.2026, Abdullah'ın isteğiyle)
     ----------
     Otomatik gruplama (sonGirisHesabi) SADECE aynı HESAPLA giriş yapan
     cihazları birleştirir. Abdullah aynı daveti/linki birden fazla kişiye
     gönderip her biri KENDİ ayrı hesabıyla giriş yaptığında (örn. 3 ayrı
     "Yasin" hesabı, aynı link üzerinden) otomatik gruplama bunları
     birleştiremez — bu yüzden Abdullah'ın kendi seçtiği cihazları, kendi
     verdiği bir isimle ELLE gruplayabilmesi gerekiyor. Firebase'de
     "cihazManuelGruplari/{grupId}" altında saklanır:
       { isim: "Yasin (Tüm Telefonları)", cihazlar: {cihazId1:true,...},
         olusturma: <ms> }
     2'den az cihazı kalan bir grup artık "grup" sayılmaz ve otomatik
     olarak tamamen silinir (bkz. manuelGruptanCikar). */
  function manuelGruplariDinle(fn){
    try{
      baslat();
      firebase.database().ref("cihazManuelGruplari").on("value", function(snap){
        fn(snap.val() || {});
      });
    }catch(e){}
  }

  function manuelGrupOlustur(isim, cihazIdleri, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      isim = String(isim||"").trim();
      if(!isim){ cb(false, "Grup adı boş olamaz."); return; }
      if(!cihazIdleri || cihazIdleri.length < 2){ cb(false, "En az 2 cihaz seçmelisin."); return; }
      baslat();
      var cihazlarObj = {};
      cihazIdleri.forEach(function(id){ cihazlarObj[id] = true; });
      firebase.database().ref("cihazManuelGruplari").push({
        isim: isim, cihazlar: cihazlarObj, olusturma: Date.now()
      }).then(function(){ cb(true); }).catch(function(err){ cb(false, err.message); });
    }catch(e){ cb(false, e.message); }
  }

  function manuelGrubuYenidenAdlandir(grupId, yeniIsim, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      yeniIsim = String(yeniIsim||"").trim();
      if(!grupId || !yeniIsim){ cb(false, "Grup adı boş olamaz."); return; }
      baslat();
      firebase.database().ref("cihazManuelGruplari/" + grupId + "/isim").set(yeniIsim)
        .then(function(){ cb(true); }).catch(function(err){ cb(false, err.message); });
    }catch(e){ cb(false, e.message); }
  }

  // Bir cihazı manuel gruptan çıkarır. Kalan cihaz sayısı 2'nin altına
  // düşerse (0 veya 1) grup artık "grup" sayılmaz, tamamen silinir — tek
  // kalan cihaz normal tekli karta geri döner.
  function manuelGruptanCikar(grupId, cihazId, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      if(!grupId || !cihazId){ cb(false, "Cihaz gruptan çıkarılamadı."); return; }
      baslat();
      var db = firebase.database();
      db.ref("cihazManuelGruplari/" + grupId + "/cihazlar/" + cihazId).remove().then(function(){
        return db.ref("cihazManuelGruplari/" + grupId + "/cihazlar").once("value");
      }).then(function(snap){
        var kalanlar = snap.val() || {};
        if(Object.keys(kalanlar).length < 2){
          return db.ref("cihazManuelGruplari/" + grupId).remove();
        }
      }).then(function(){ cb(true); }).catch(function(err){ cb(false, err.message); });
    }catch(e){ cb(false, e.message); }
  }

  function manuelGrubuDagit(grupId, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    try{
      if(!grupId){ cb(false, "Grup kimliği eksik."); return; }
      baslat();
      firebase.database().ref("cihazManuelGruplari/" + grupId).remove()
        .then(function(){ cb(true); }).catch(function(err){ cb(false, err.message); });
    }catch(e){ cb(false, e.message); }
  }

  return {
    benimIdim: benimIdim,
    benimAdim: benimAdim,
    korumaliMi: korumaliMi,
    kaydiGuncelle: kaydiGuncelle,
    adiKaydet: adiKaydet,
    benimKullaniciAdim: benimKullaniciAdim,
    kullaniciAdiKaydet: kullaniciAdiKaydet,
    adiniDegistir: adiniDegistir,
    pinKaydet: pinKaydet,
    tumCihazlariDinle: tumCihazlariDinle,
    engelle: engelle,
    engeliKaldir: engeliKaldir,
    onaylaCihazi: onaylaCihazi,
    benEngelliMiyim: benEngelliMiyim,
    aktifAyniIsimdeBaskaCihazBulAsync: aktifAyniIsimdeBaskaCihazBulAsync,
    cihaziSil: cihaziSil,
    manuelGruplariDinle: manuelGruplariDinle,
    manuelGrupOlustur: manuelGrupOlustur,
    manuelGrubuYenidenAdlandir: manuelGrubuYenidenAdlandir,
    manuelGruptanCikar: manuelGruptanCikar,
    manuelGrubuDagit: manuelGrubuDagit
  };

})();
