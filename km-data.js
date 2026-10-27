/*
  km-data.js
  ==========
  Eski uygulamanın GERÇEK mantığı: her gün TEK bir kilometre okuması girilir
  ("fotoğraflanan KM"). Bu değer aynı anda hem O GÜNÜN başlangıcı, hem de
  BİR ÖNCEKİ GÜNÜN bitişidir. Yani iki ayrı "başlangıç/bitiş" alanı YOKTUR —
  art arda gelen günlerin tek okumaları arasındaki fark, önceki günün kat
  ettiği mesafedir.

  gununKmGir() çağrıldığında:
    1) Bugünün kaydına bu KM değeri + saat/güzergah/kategori yazılır.
    2) DÜNÜN kaydı varsa, dünün "bitisKm"si bu değere eşitlenir ve dünün
       mesafesi (bitisKm - km) hesaplanıp dünün kategorisine yazılır.
  Ziyaret Edilen Yerler, gün içinde ayrıca (KM girmeden) eklenip güncellenebilir.
*/

var KmData = (function(){

  var kayitlar = {};
  var dinleyiciler = [];
  var hatirlatmaNotu = "";
  var hatirlatmaDinleyicileri = [];
  var odemeler = {};
  var odemeDinleyicileri = [];
  var carpanlar = {};
  var carpanDinleyicileri = [];
  var hakkilar = {};
  var hakkiDinleyicileri = [];

  function baslat(){
    try{
      if(!firebase.apps.length){ firebase.initializeApp(ISTAKIP_FIREBASE_CONFIG); }
      var db = firebase.database();
      db.ref("kmTakip").on("value", function(snap){
        kayitlar = snap.val() || {};
        dinleyiciler.forEach(function(fn){ fn(); });
      }, function(err){
        console.error("KM okuma hatası:", err);
      });
      // YILLIK KM ÖDEME (03.10.2026, Abdullah'ın isteğiyle) — her ayki
      // ÖZEL km karşılığı şirketten alınan geri ödemenin takibi. Günlük
      // km kayıtlarından (kmTakip) TAMAMEN AYRI bir node: "Toplam Özel KM"
      // sütunu kmTakip'ten CANLI hesaplanır, burada sadece elle girilen
      // Ödeme Tarihi/Platformu/Tutarı saklanır — bkz. yillik-km-odeme.html.
      db.ref("kmOdemeleri").on("value", function(snap){
        odemeler = snap.val() || {};
        odemeDinleyicileri.forEach(function(fn){ fn(); });
      }, function(err){
        console.error("KM ödeme okuma hatası:", err);
      });
      // Yıl bazlı KM ÇARPANI (03.10.2026) — "Toplam Özel KM × Çarpan =
      // Tutar" hesabında kullanılan, Abdullah'ın elle girdiği TL/km değeri.
      // Yıl değişince çarpan da değişebileceği için yıla göre saklanır.
      db.ref("kmCarpanlari").on("value", function(snap){
        carpanlar = snap.val() || {};
        carpanDinleyicileri.forEach(function(fn){ fn(); });
      }, function(err){
        console.error("KM çarpanı okuma hatası:", err);
      });
      // Yıl bazlı ŞİRKET KM HAKKI (03.10.2026, "firmam yılda 3.000 km hak
      // tanıyor, üstü benden ödeme olarak kesiliyor" isteğiyle) — Abdullah'ın
      // elle girdiği, o yıl için ücretsiz (hak kapsamı) özel km miktarı.
      // "Ücretlendirilecek KM" = Toplam Özel KM − bu hak (negatifse 0).
      db.ref("kmSirketHakki").on("value", function(snap){
        hakkilar = snap.val() || {};
        hakkiDinleyicileri.forEach(function(fn){ fn(); });
      }, function(err){
        console.error("KM şirket hakkı okuma hatası:", err);
      });
      // HATIRLATMA NOTU (24.09.2026) — Araç KM sayfasında, "Bu Ayın
      // Kayıtları" butonunun üstünde duran, Abdullah'ın elle yazdığı tek
      // serbest metin notu (örn. "16-23 Eylül arası km bilgilerini
      // merkeze gönderdim"). Tarihe göre değil, TEK bir alanda tutulur —
      // her kaydettiğinde üzerine yazılır.
      db.ref("kmHatirlatmaNotu").on("value", function(snap){
        hatirlatmaNotu = snap.val() || "";
        hatirlatmaDinleyicileri.forEach(function(fn){ fn(); });
      }, function(err){
        console.error("KM hatırlatma notu okuma hatası:", err);
      });
    }catch(e){
      console.error("Firebase başlatma hatası:", e);
    }
  }

  function degistiginde(fn){ dinleyiciler.push(fn); }

  function hatirlatmaNotunuOku(){ return hatirlatmaNotu; }
  function hatirlatmaNotuDegistiginde(fn){ hatirlatmaDinleyicileri.push(fn); }
  function hatirlatmaNotunuKaydet(metin, geriBildir){
    try{
      firebase.database().ref("kmHatirlatmaNotu").set((metin||"").trim()).then(function(){
        geriBildir(true);
      }).catch(function(err){ geriBildir(false, err); });
    }catch(e){ geriBildir(false, e); }
  }


  function tarihAnahtari(d){
    return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2);
  }

  function bugunAnahtari(){ return tarihAnahtari(new Date()); }

  function dunAnahtari(){
    var d = new Date();
    d.setDate(d.getDate()-1);
    return tarihAnahtari(d);
  }

  function kaydiOku(anahtar){ return kayitlar[anahtar] || null; }

  // Bugünden ÖNCEKİ en son GERÇEK kilometre kaydını bulur — tam olarak
  // "dün" (1 gün önce) değil, aradaki boş günler (araç hiç çıkmamış hafta
  // sonu/tatil/izin günleri) kaç tane olursa olsun, kronolojik olarak en
  // son girilmiş kaydı esas alır. `haricAnahtar` verilirse o gün hariç
  // tutulur (bugünün kendisini "önceki kayıt" saymamak için).
  function sonKayitliGunAnahtari(haricAnahtar){
    var enSon = null;
    Object.keys(kayitlar).forEach(function(k){
      if(k === haricAnahtar) return;
      if(!kayitlar[k] || kayitlar[k].km===undefined || kayitlar[k].km===null || kayitlar[k].km==="") return;
      if(!enSon || k > enSon) enSon = k;
    });
    return enSon;
  }

  function farkHesapla(bitis, baslangic){
    if(bitis===undefined||bitis===null||bitis===""||baslangic===undefined||baslangic===null||baslangic==="") return null;
    var b = parseFloat(bitis), a = parseFloat(baslangic);
    if(isNaN(b)||isNaN(a)) return null;
    var f = b-a;
    return f<0 ? 0 : f;
  }

  // Bir önceki tarihte yapılan kilometre: [en son kayıtlı günün KM'si] →
  // [BUGÜN GİRİLEN — henüz kaydedilmemiş olsa bile] KM'si = mesafe.
  // "Bugünün başlangıç KM'si = önceki tarihin bitiş KM'si" mantığıyla,
  // bugün yazdığın değerden en son kayıtlı tarihin KM'sini çıkararak, O
  // ÖNCEKİ TARİHTE yapılan mesafeyi CANLI (kaydetmeden önce) gösterir.
  function oncekiTarihinMesafesi(bugunkuGirilenDeger){
    var bugun = bugunAnahtari();
    var oncekiKayitliGun = sonKayitliGunAnahtari(bugun);
    if(!oncekiKayitliGun) return null;
    var oncekiKayit = kayitlar[oncekiKayitliGun];
    var oncekiKm = oncekiKayit.km;
    var mesafe = farkHesapla(bugunkuGirilenDeger, oncekiKm);
    return {tarihAnahtari: oncekiKayitliGun, oncekiKm: oncekiKm, bugunkuDeger: bugunkuGirilenDeger, mesafe: mesafe};
  }

  function gununKmGir(bugunkuKm, kategori, saat, guzergah, geriBildir){
    try{
      var db = firebase.database();
      var bugun = bugunAnahtari();

      var bugunKaydi = Object.assign({}, kayitlar[bugun]||{}, {
        km: bugunkuKm,
        kmKategori: kategori,
        saat: saat || "",
        guzergah: guzergah || ""
      });

      var guncellemeler = {};
      guncellemeler["kmTakip/" + bugun] = bugunKaydi;

      // "Dün" (tam 1 gün önce) yerine, kronolojik olarak en son kilometre
      // girilmiş günü buluyoruz — araç günlerdir çıkmamış olsa bile
      // (hafta sonu, tatil, izin) doğru önceki kayda bağlanır.
      var oncekiKayitliGun = sonKayitliGunAnahtari(bugun);
      var oncekiKayit = oncekiKayitliGun ? kayitlar[oncekiKayitliGun] : null;
      if(oncekiKayit && oncekiKayit.km!==undefined && oncekiKayit.km!==null && oncekiKayit.km!==""){
        var fark = farkHesapla(bugunkuKm, oncekiKayit.km);
        var oncekiKategori = oncekiKayit.kmKategori || "is";
        var yeniOncekiKayit = Object.assign({}, oncekiKayit, {
          bitisKm: bugunkuKm,
          isKm: oncekiKategori==="is" ? fark : null,
          ozelKm: oncekiKategori==="ozel" ? fark : null
        });
        guncellemeler["kmTakip/" + oncekiKayitliGun] = yeniOncekiKayit;
      }

      db.ref().update(guncellemeler).then(function(){
        geriBildir(true);
      }).catch(function(err){
        console.error("KM kaydetme hatası:", err);
        geriBildir(false, err);
      });
    }catch(e){ geriBildir(false, e); }
  }

  function ziyaretYerleriniKaydet(anahtar, ziyaretYerleri, geriBildir){
    try{
      var mevcut = kayitlar[anahtar];
      if(!mevcut){ geriBildir(false, "Önce günün kilometresini girin."); return; }
      var db = firebase.database();
      db.ref("kmTakip/" + anahtar + "/ziyaretYerleri").set(ziyaretYerleri || "").then(function(){
        geriBildir(true);
      }).catch(function(err){ geriBildir(false, err); });
    }catch(e){ geriBildir(false, e); }
  }

  // Tablodaki bir hücreye dokunup manuel düzeltme yapmak için genel alan
  // güncelleyici (Tarih, Saat, Başl., Bitiş, Güzergah, Ziyaret, İş, Özel).
  // BİLİNÇLİ OLARAK hiçbir otomatik yeniden hesaplama YAPMAZ — kullanıcı
  // hangi hücreyi ne yazarsa o kalır, başka hiçbir hücreyi tetiklemez.
  // (Otomatik İş/Özel hesaplaması SADECE "Günü Kaydet" ile günlük giriş
  // yapılırken olur — bkz. gununKmGir.)
  var ALAN_HARITA = {
    saat: "saat", baslangic: "km", bitis: "bitisKm",
    guzergah: "guzergah", ziyaret: "ziyaretYerleri", isKm: "isKm", ozelKm: "ozelKm"
  };
  function hucreGuncelle(anahtar, alanAdi, deger, geriBildir){
    try{
      var firebaseAlan = ALAN_HARITA[alanAdi];
      if(!firebaseAlan){ geriBildir(false, "Bilinmeyen alan"); return; }
      var sayisalMi = (firebaseAlan==="km" || firebaseAlan==="bitisKm" || firebaseAlan==="isKm" || firebaseAlan==="ozelKm");
      var yaziliDeger = sayisalMi ? (parseFloat(deger)||0) : (deger||"");
      firebase.database().ref("kmTakip/" + anahtar + "/" + firebaseAlan).set(yaziliDeger).then(function(){
        geriBildir(true);
      }).catch(function(err){ geriBildir(false, err); });
    }catch(e){ geriBildir(false, e); }
  }

  // Tablodaki Tarih hücresini elle değiştirmek için: kayıt Firebase'de
  // tarihe göre (YYYY-MM-DD) anahtarlanıyor, yani "tarihi değiştirmek"
  // aslında kaydı eski anahtardan yeni anahtara TAŞIMAK demek. Hedef
  // tarihte zaten bir kayıt varsa üzerine yazılmaz, hata döner.
  function tarihiDegistir(eskiAnahtar, yeniTarihGosterim, geriBildir){
    try{
      var parca = (yeniTarihGosterim||"").trim().split(".");
      if(parca.length !== 3){ geriBildir(false, "Tarih GG.AA.YYYY formatında olmalı (örn. 10.09.2026)."); return; }
      var gun = parseInt(parca[0],10), ay = parseInt(parca[1],10), yil = parseInt(parca[2],10);
      if(!gun || !ay || !yil || yil < 2000 || yil > 2100){ geriBildir(false, "Geçersiz tarih."); return; }
      var d = new Date(yil, ay-1, gun);
      if(d.getFullYear()!==yil || d.getMonth()!==ay-1 || d.getDate()!==gun){ geriBildir(false, "Geçersiz tarih."); return; }
      var yeniAnahtar = tarihAnahtari(d);
      if(yeniAnahtar === eskiAnahtar){ geriBildir(true); return; }
      if(kayitlar[yeniAnahtar]){ geriBildir(false, "Bu tarihte (" + yeniTarihGosterim + ") zaten başka bir kayıt var."); return; }
      var mevcutVeri = kayitlar[eskiAnahtar];
      if(!mevcutVeri){ geriBildir(false, "Taşınacak kayıt bulunamadı."); return; }
      var db = firebase.database();
      db.ref("kmTakip/" + yeniAnahtar).set(mevcutVeri).then(function(){
        return db.ref("kmTakip/" + eskiAnahtar).remove();
      }).then(function(){
        geriBildir(true);
      }).catch(function(err){ geriBildir(false, err); });
    }catch(e){ geriBildir(false, e); }
  }

  function buAyinKayitlari(){
    var now = new Date();
    var yilAy = now.getFullYear()+"-"+("0"+(now.getMonth()+1)).slice(-2);
    return Object.keys(kayitlar)
      .filter(function(k){ return k.indexOf(yilAy)===0; })
      .sort()
      .reverse()
      .map(function(k){ return Object.assign({anahtar:k}, kayitlar[k]); });
  }

  // Belirli bir "YYYY-MM" ayının kayıtlarını döndürür — Ağustos ayının
  // takvim değişse bile ARŞİVDEN kaybolmaması, istendiğinde geriye dönüp
  // görüntülenebilmesi/Excel'e aktarılabilmesi için.
  function ayinKayitlari(yilAy){
    return Object.keys(kayitlar)
      .filter(function(k){ return k.indexOf(yilAy)===0; })
      .sort()
      .reverse()
      .map(function(k){ return Object.assign({anahtar:k}, kayitlar[k]); });
  }

  // Belirli bir yılın (ör. "2026") TÜM aylarındaki kayıtlarını döndürür —
  // KM Kayıtları sayfasındaki "YILLIK TOPLAM" panosu için (24.09.2026).
  function yilinKayitlari(yil){
    return Object.keys(kayitlar)
      .filter(function(k){ return k.indexOf(yil+"-")===0; })
      .map(function(k){ return Object.assign({anahtar:k}, kayitlar[k]); });
  }

  // Kayıt bulunan TÜM ayları ("YYYY-MM") en yeniden en eskiye sıralı
  // döndürür — ay seçici menüsünü doldurmak için. Bu ayda hiç kayıt
  // olmasa bile mevcut ay listeye eklenir (seçenek olarak görünsün diye).
  function kayitliAylar(){
    var aySeti = {};
    Object.keys(kayitlar).forEach(function(k){ aySeti[k.slice(0,7)] = true; });
    var simdi = new Date();
    aySeti[simdi.getFullYear()+"-"+("0"+(simdi.getMonth()+1)).slice(-2)] = true;
    return Object.keys(aySeti).sort().reverse();
  }

  function ayAdiUret(yilAy){
    var AYLAR2 = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
    var parca = yilAy.split("-");
    return AYLAR2[parseInt(parca[1],10)-1] + " " + parca[0];
  }

  function ayarlarOku(geriBildir){
    try{
      var db = firebase.database();
      db.ref("kmTakipAyarlari").once("value").then(function(snap){
        geriBildir(snap.val() || {adSoyad:"", plaka:""});
      }).catch(function(){ geriBildir({adSoyad:"", plaka:""}); });
    }catch(e){ geriBildir({adSoyad:"", plaka:""}); }
  }

  function ayarlarKaydet(adSoyad, plaka){
    try{
      var db = firebase.database();
      db.ref("kmTakipAyarlari").set({adSoyad:adSoyad, plaka:plaka});
    }catch(e){ console.error("KM ayarları kaydedilemedi:", e); }
  }

  // Eski uygulamanın kmAyBasiKontrolEt() ile AYNI mantık: sistemde HİÇ KM
  // kaydı yoksa (ilk kullanım), günlük hesaplamanın çalışabilmesi için bir
  // başlangıç değeri gerekir — sessizce atlamak yerine kullanıcıdan iste.
  function baslangicGerekliMi(){
    var herhangiKayitVarMi = Object.keys(kayitlar).some(function(k){
      return kayitlar[k] && kayitlar[k].km!==undefined && kayitlar[k].km!==null && kayitlar[k].km!=="";
    });
    return !herhangiKayitVarMi;
  }

  function baslangicKaydet(deger, geriBildir){
    try{
      var dun = dunAnahtari();
      var yeniKayit = Object.assign({}, kayitlar[dun]||{}, {km: deger, saat: (kayitlar[dun]&&kayitlar[dun].saat)||"23:59", sentetikBaslangic: true});
      firebase.database().ref("kmTakip/" + dun).set(yeniKayit).then(function(){
        geriBildir(true);
      }).catch(function(err){ geriBildir(false, err); });
    }catch(e){ geriBildir(false, e); }
  }

  // ---------- YILLIK KM ÖDEME (03.10.2026) ----------
  function odemeDegistiginde(fn){ odemeDinleyicileri.push(fn); }

  function odemeOku(yilAy){ return odemeler[yilAy] || {}; }

  var ODEME_ALAN_HARITA = { odemeTarihi: "odemeTarihi", odemePlatformu: "odemePlatformu", odeme: "odeme", durum: "durum", ozelKm: "ozelKm", tutar: "tutar" };
  // 03.10.2026 güncellemesi: "ozelKm" ve "tutar" OTOMATİK hesaplanan
  // değerlerin elle DÜZELTİLEBİLMESİ/SİLİNEBİLMESİ için eklendi. Bu ikisi
  // (ve "odeme") sayısaldır — hücre BOŞ bırakılırsa alan Firebase'den
  // tamamen SİLİNİR (null), böylece yillik-km-odeme-render.js otomatik
  // hesaba geri döner. 0 girilmesi ile BOŞ bırakılması farklı şeylerdir:
  // 0 = "gerçekten sıfır", boş = "otomatik hesaba güven".
  var ODEME_SAYISAL_ALANLAR = { odeme: true, ozelKm: true, tutar: true };
  function odemeGuncelle(yilAy, alanAdi, deger, geriBildir){
    try{
      var firebaseAlan = ODEME_ALAN_HARITA[alanAdi];
      if(!firebaseAlan){ geriBildir(false, "Bilinmeyen alan"); return; }
      var yaziliDeger;
      if(ODEME_SAYISAL_ALANLAR[firebaseAlan]){
        if(deger==="" || deger===null || deger===undefined){
          yaziliDeger = null; // alanı tamamen sil — otomatik hesaba dön
        }else{
          var sayi = parseFloat(deger);
          if(isNaN(sayi)){ geriBildir(false, "Geçersiz sayı"); return; }
          yaziliDeger = sayi;
        }
      }else{
        yaziliDeger = deger || "";
      }
      firebase.database().ref("kmOdemeleri/" + yilAy + "/" + firebaseAlan).set(yaziliDeger).then(function(){
        geriBildir(true);
      }).catch(function(err){ geriBildir(false, err); });
    }catch(e){ geriBildir(false, e); }
  }

  // Belirli bir "YYYY-MM" ayının TOPLAM ÖZEL KM'si — kmTakip kayıtlarından
  // canlı hesaplanır (Yıllık KM Ödeme sayfasındaki "Toplam Özel KM" sütunu).
  function ayinOzelKmToplami(yilAy){
    var toplam = 0;
    ayinKayitlari(yilAy).forEach(function(k){ if(k.ozelKm!=null) toplam += k.ozelKm; });
    return toplam;
  }

  function carpanDegistiginde(fn){ carpanDinleyicileri.push(fn); }

  function carpanOku(yil){
    var deger = carpanlar[String(yil)];
    return (deger!=null && deger!=="") ? deger : "";
  }

  function carpanKaydet(yil, deger, geriBildir){
    try{
      var cb = typeof geriBildir === "function" ? geriBildir : function(){};
      var yaziliDeger = parseFloat(deger);
      if(isNaN(yaziliDeger)){ cb(false, "Geçersiz sayı"); return; }
      firebase.database().ref("kmCarpanlari/" + yil).set(yaziliDeger).then(function(){
        cb(true);
      }).catch(function(err){ cb(false, err); });
    }catch(e){ if(typeof geriBildir==="function") geriBildir(false, e); }
  }

  // ---------- ŞİRKET KM HAKKI (03.10.2026) ----------
  // KM Çarpanı ile AYNI desen: yıl bazlı saklanır, SADECE tuşla kaydedilir.
  function hakkiDegistiginde(fn){ hakkiDinleyicileri.push(fn); }

  function hakkiOku(yil){
    var deger = hakkilar[String(yil)];
    return (deger!=null && deger!=="") ? deger : "";
  }

  function hakkiKaydet(yil, deger, geriBildir){
    try{
      var cb = typeof geriBildir === "function" ? geriBildir : function(){};
      var yaziliDeger = parseFloat(deger);
      if(isNaN(yaziliDeger)){ cb(false, "Geçersiz sayı"); return; }
      firebase.database().ref("kmSirketHakki/" + yil).set(yaziliDeger).then(function(){
        cb(true);
      }).catch(function(err){ cb(false, err); });
    }catch(e){ if(typeof geriBildir==="function") geriBildir(false, e); }
  }

  return {
    baslat: baslat,
    degistiginde: degistiginde,
    tarihAnahtari: tarihAnahtari,
    bugunAnahtari: bugunAnahtari,
    dunAnahtari: dunAnahtari,
    sonKayitliGunAnahtari: sonKayitliGunAnahtari,
    kaydiOku: kaydiOku,
    farkHesapla: farkHesapla,
    oncekiTarihinMesafesi: oncekiTarihinMesafesi,
    gununKmGir: gununKmGir,
    ziyaretYerleriniKaydet: ziyaretYerleriniKaydet,
    hucreGuncelle: hucreGuncelle,
    tarihiDegistir: tarihiDegistir,
    buAyinKayitlari: buAyinKayitlari,
    ayinKayitlari: ayinKayitlari,
    yilinKayitlari: yilinKayitlari,
    kayitliAylar: kayitliAylar,
    ayAdiUret: ayAdiUret,
    ayarlarOku: ayarlarOku,
    ayarlarKaydet: ayarlarKaydet,
    baslangicGerekliMi: baslangicGerekliMi,
    baslangicKaydet: baslangicKaydet,
    hatirlatmaNotunuOku: hatirlatmaNotunuOku,
    hatirlatmaNotuDegistiginde: hatirlatmaNotuDegistiginde,
    hatirlatmaNotunuKaydet: hatirlatmaNotunuKaydet,
    odemeDegistiginde: odemeDegistiginde,
    odemeOku: odemeOku,
    odemeGuncelle: odemeGuncelle,
    ayinOzelKmToplami: ayinOzelKmToplami,
    carpanDegistiginde: carpanDegistiginde,
    carpanOku: carpanOku,
    carpanKaydet: carpanKaydet,
    hakkiDegistiginde: hakkiDegistiginde,
    hakkiOku: hakkiOku,
    hakkiKaydet: hakkiKaydet
  };

})();

KmData.baslat();
