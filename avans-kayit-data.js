/*
  avans-kayit-data.js
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
    }catch(e){ console.error("AvansKayitData başlatılamadı:", e); }
  }

  function taslakYuklendiMi(){ return taslakYuklendi; }
  function kayitlarYuklendiMi(){ return kayitlarYuklendi; }

  function bildir(){
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

  /* ---------- "Bekleyen Avans" (02.10.2026, Abdullah'ın isteğiyle) ----------
     Kapalı bir avans kaydı artık kapandığı anda otomatik olarak AYNI ayın
     maaşından düşülmek ZORUNDA değil — masraf formu gecikmesi yüzünden
     bazen bir sonraki (veya iki sonraki) ayın maaşına dahil edilmesi
     gerekebiliyor. "maasaDahilEdildigiDonem" alanı hangi maaş döneminin
     bu avansı kestiğini tutar; bu alan yoksa kayıt hâlâ "bekliyor"
     demektir. Avans Takibi'nin kendi kayıt/taslak/kapatma akışı HİÇ
     değişmedi — sadece bu tek yeni alan eklendi. */

  // Henüz hiçbir maaş dönemine dahil edilmemiş (bekleyen) kapalı avans
  // kayıtları — tutarı sıfır olanlar (hiç avans girilmemiş boş kapanışlar)
  // listeye hiç girmez.
  function bekleyenKayitlar(){
    return tumKayitlar().filter(function(k){
      return (k.toplamKesinti||0) > 0 && !k.maasaDahilEdildigiDonem;
    });
  }

  // Verilen avans kayıt anahtarlarını (bir ya da daha fazla), belirtilen
  // maaş döneminin kesintisine dahil edildi olarak tek seferde işaretler.
  function dahilEdildiginiIsaretle(anahtarlar, hedefMaasAnahtari, geriBildir){
    var cb = typeof geriBildir === "function" ? geriBildir : function(){};
    if(!anahtarlar || !anahtarlar.length){ cb(true); return; }
    try{
      var guncellemeler = {};
      anahtarlar.forEach(function(a){
        guncellemeler["avansKayitlari/" + a + "/maasaDahilEdildigiDonem"] = hedefMaasAnahtari;
      });
      firebase.database().ref().update(guncellemeler)
        .then(function(){ cb(true); }).catch(function(err){ cb(false, err); });
    }catch(e){ cb(false, e); }
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
    bekleyenKayitlar: bekleyenKayitlar,
    dahilEdildiginiIsaretle: dahilEdildiginiIsaretle
  };

})();
