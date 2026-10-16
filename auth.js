/*
  auth.js — WG.161026.1130.829
  =======
  TÜM sayfalar tarafından paylaşılan tek görevi: Firebase oturumunun açık
  olup olmadığını kontrol etmek. Oturum yoksa login.html'e yönlendirir.
  Oturum varsa sayfa içeriğini gösterir (body başta gizli tutulur — kısa
  bir an için "giriş yapılmamış" hâlinin görünmesini engellemek için).

  Her sayfanın <head> içine şu satır eklenmeli (diğer script'lerden ÖNCE):
    <script>document.documentElement.style.visibility='hidden';</script>
  ve body sonuna:
    <script src="auth.js"></script>
*/

(function(){

  if(!firebase.apps.length){ firebase.initializeApp(WEICON_FIREBASE_CONFIG); }

  // Oturumun kalıcı (LOCAL) modda saklanmasını AÇIKÇA istiyoruz — bu zaten
  // SDK'nın varsayılanı ama bazı Android tarayıcı/sürüm kombinasyonlarında
  // açıkça belirtmek daha güvenilir çalışıyor (30.09.2026, Samsung S22'de
  // sık sık tam girişe düşme şikayeti üzerine eklendi).
  try{ firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL); }catch(e){}

  // PIN KİLİDİ (WG.270926.güncelleme): 5 dakika kullanılmazsa PIN istenir.
  // "Kullanılmama" = ekrana son dokunuş/kaydırma/tuş vuruşundan beri geçen
  // süre (aşağıdaki etkileşim dinleyicileri zaman damgasını taze tutar).
  var PIN_KILIT_ESIK_MS = 5*60*1000;
  var TAM_GIRIS_ESIK_MS = 2*60*60*1000; // 2 saat hareketsizlik -> tam e-posta/şifre girişi

  // ---- CİHAZ ENGELLEME (bkz. cihaz-data.js / cihazlar.html) ----
  // Bu bölüm KASITLI OLARAK cihaz-data.js'e bağımlı değil — auth.js zaten
  // TÜM sayfalarda yükleniyor, 28 ayrı HTML dosyasına yeni bir <script>
  // eklemek yerine gereken minimum mantık burada kendi başına duruyor.
  function cihazIdOku(){
    try{
      var id = localStorage.getItem("weicon_cihaz_id");
      if(!id){
        id = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2,8);
        localStorage.setItem("weicon_cihaz_id", id);
      }
      return id;
    }catch(e){ return "bilinmeyen"; }
  }
  function cihazKaydiGuncelle(){
    try{
      var veri = { sonGorulme: Date.now() };
      var yerelAd = localStorage.getItem("weicon_cihaz_adi");
      if(yerelAd) veri.ad = yerelAd;
      firebase.database().ref("cihazlar/" + cihazIdOku()).update(veri).catch(function(){});
    }catch(e){}
  }
  // Çevrimdışıyken veya okuma başarısız olduğunda erişimi ENGELLEME —
  // sadece Firebase açıkça "engelli:true" derse kilitle.
  function cihazEngelliMi(geriBildir){
    try{
      firebase.database().ref("cihazlar/" + cihazIdOku() + "/engelli").once("value")
        .then(function(snap){ geriBildir(snap.val() === true); })
        .catch(function(){ geriBildir(false); });
    }catch(e){ geriBildir(false); }
  }

  var yol = window.location.pathname;
  var buSayfaLogin = yol.indexOf("login.html") >= 0;
  var buSayfaPin = yol.indexOf("pin.html") >= 0;
  var buSayfaCihazEngelli = yol.indexOf("cihaz-engelli.html") >= 0;

  // ---- ÇALIŞAN ERİŞİMİ / SINIRLI HESAP KONTROLÜ (01.10.2026) ----
  // Abdullah'ın Ayarlar > Çalışan Erişimi'nden oluşturduğu sınırlı hesaplar
  // "kisitliKullanicilar/{uid}" altında bir izin haritasıyla saklanır.
  // Bu harita YOKSA kullanıcı kısıtlı değildir (Abdullah'ın kendi hesabı).
  // YENİ BİR SAYFA İZNİ EKLEMEK İSTERSEN: bu haritaya dosya adını ekle VE
  // calisan-erisim-render.js'teki İZIN_TANIMLARI listesine aynı anahtarla
  // bir satır ekle — iki dosya senkron olmalı.
  var SAYFA_IZIN_ANAHTARI = {
    "calc.html": "hesapla",
    "product.html": "urunBul",
    "cart.html": "sepet",
    "belge-onizleme.html": "sepet",
    "gonderim-basarili.html": "sepet",
    "send.html": "gonder",
    "customer.html": "musteriBul",
    "customer-hub.html": "musteriBul",
    "customer-detail.html": "musteriBul",
    "customer-cari-kart.html": "musteriBul",
    "customer-temas.html": "musteriBul",
    "customer-add.html": "musteriBul",
    "gecmis.html": "islemGecmisi",
    "raporlar.html": "raporlar",
    "reports.html": "raporlar",
    "kacan-satislar.html": "raporlar",
    "satis-listesi.html": "satisListesi",
    "hareketler.html": "hareketler",
    "son-islemler.html": "hareketler",
    "ziyaret.html": "ziyaret",
    "takip-gerekenler.html": "takipGerekenler",
    "gorevler.html": "gorevler",
    "vade-takip.html": "vadeTakip",
    "km.html": "kmTakip",
    "km-kayitlar.html": "kmTakip",
    "maas-hesaplama.html": "maasHesaplama",
    "maas-menu.html": "maasHesaplama",
    "ay-detay.html": "maasHesaplama",
    "net-maas-hesaplama.html": "netMaasHesaplama",
    "avans-takibi.html": "avansTakibi",
    "odenebilir-komisyon.html": "odenebilirKomisyon",
    "bildirimler.html": "bildirimler",
    "home.html": "anaSayfa"
  };
  // Hiçbir izin eşleşmediğinde yönlendirilecek ilk uygun sayfayı bulmak için
  // taranan sıra (anahtar -> o izne ait varsayılan sayfa).
  var SAYFA_IZIN_SIRASI = ["hesapla","urunBul","sepet","gonder","musteriBul","islemGecmisi",
    "raporlar","satisListesi","hareketler","ziyaret","takipGerekenler","gorevler","vadeTakip",
    "maasHesaplama","netMaasHesaplama","avansTakibi","odenebilirKomisyon","anaSayfa","kmTakip","bildirimler"];
  var SAYFA_IZIN_DOSYA = {
    hesapla:"calc.html", urunBul:"product.html", sepet:"cart.html", gonder:"send.html",
    musteriBul:"customer.html", islemGecmisi:"gecmis.html", raporlar:"raporlar.html",
    satisListesi:"satis-listesi.html", hareketler:"hareketler.html", ziyaret:"ziyaret.html",
    takipGerekenler:"takip-gerekenler.html", gorevler:"gorevler.html", vadeTakip:"vade-takip.html",
    maasHesaplama:"maas-hesaplama.html", netMaasHesaplama:"net-maas-hesaplama.html",
    avansTakibi:"avans-takibi.html", odenebilirKomisyon:"odenebilir-komisyon.html",
    anaSayfa:"home.html", kmTakip:"km.html", bildirimler:"bildirimler.html"
  };
  // Bu sayfalar kısıtlı hesaplar için de HER ZAMAN erişilebilir — giriş/kilit
  // akışının kendisi oldukları için izin kontrolünden muaf tutulurlar.
  var KISITLI_MUSTESNA_SAYFALAR = ["login.html","pin.html","cihaz-engelli.html","erisim-reddedildi.html"];

  // İNCE AYAR (BUTON BAZLI) İZİNLER (02.10.2026, Birleşik Sayfa) — sayfa
  // seviyesinin altında, tek bir sayfa içindeki belirli düğmeleri açıp
  // kapatmak için. window.WEICON_IZINLER = null demek "kısıtlı değil, her
  // şey açık" (Abdullah'ın kendi hesabı); dolu bir obje demek kısıtlı bir
  // çalışan demek — o objede YOKSA veya true İSE açık sayılır, SADECE
  // açıkça false İSE gizlenir/pasifleşir (geriye dönük uyumluluk: eski
  // çalışan kayıtlarında bu yeni anahtarlar hiç yok, hepsi "açık" kalmalı).
  // YENİ BİR İNCE AYAR İZNİ EKLEMEK İSTERSEN: calisan-erisim-render.js'teki
  // İZIN_TANIMLARI'na aynı anahtarla bir satır eklemen yeterli — burada
  // ayrıca bir şey tanımlamana gerek yok.
  window.WEICON_IZINLER = undefined; // henüz çözülmedi
  window.izinVarMi = function(anahtar){
    var iz = window.WEICON_IZINLER;
    return !iz || iz[anahtar] !== false;
  };

  function kisitliSayfaKontrolu(user, cb){
    var dosyaAdi = yol.split("/").pop() || "home.html";
    if(KISITLI_MUSTESNA_SAYFALAR.indexOf(dosyaAdi) >= 0){ cb(true); return; }
    try{
      firebase.database().ref("kisitliKullanicilar/" + user.uid).once("value").then(function(snap){
        if(!snap.exists()){ window.WEICON_IZINLER = null; cb(true); return; } // harita yok -> kısıtlı değil
        var veri = snap.val() || {};
        if(veri.aktif === false){
          document.documentElement.style.visibility = "hidden";
          firebase.auth().signOut();
          cb(false);
          return;
        }
        var izinler = veri.izinler || {};
        var gerekliAnahtar = SAYFA_IZIN_ANAHTARI[dosyaAdi];
        if(gerekliAnahtar && izinler[gerekliAnahtar] === true){ window.WEICON_IZINLER = izinler; cb(true); return; }
        // İzinsiz — izinli ilk sayfaya sessizce yönlendir, hiçbiri yoksa çıkış yap.
        var hedefAnahtar = null;
        for(var i=0; i<SAYFA_IZIN_SIRASI.length; i++){
          if(izinler[SAYFA_IZIN_SIRASI[i]] === true){ hedefAnahtar = SAYFA_IZIN_SIRASI[i]; break; }
        }
        document.documentElement.style.visibility = "hidden";
        if(!hedefAnahtar){
          firebase.auth().signOut();
          cb(false);
          return;
        }
        window.location.replace(SAYFA_IZIN_DOSYA[hedefAnahtar]);
        cb(false);
      }).catch(function(){ window.WEICON_IZINLER = null; cb(true); }); // okunamazsa (çevrimdışı vb.) engelleme
    }catch(e){ window.WEICON_IZINLER = null; cb(true); }
  }

  function aktiviteZamaniniGuncelle(){
    try{ localStorage.setItem("weicon_son_aktivite", Date.now().toString()); }catch(e){}
  }

  function gecenSureDurumu(){
    try{
      var son = parseInt(localStorage.getItem("weicon_son_aktivite")||"0", 10);
      // Kayıt yoksa (tarayıcı verisi silinmiş / yeni cihaz / bozuk kayıt)
      // eskiden "kilit yok" sayılıyordu — bu, bazı cihazlarda PIN'in hiç
      // sorulmamasının nedenlerinden biriydi. Artık KİLİTLİ sayılır.
      if(!son) return 1;
      var fark = Date.now() - son;
      if(fark < 0) return 1;                 // saat geri alınmışsa da kilitli say
      if(fark > TAM_GIRIS_ESIK_MS) return 2;
      if(fark > PIN_KILIT_ESIK_MS) return 1;
      return 0;
    }catch(e){ return 0; }
  }

  // SAYFA YÜKLENMEDEN GERİ DÖNÜŞ KONTROLÜ: Uygulama arka plana atılıp (başka
  // uygulamaya geçme, ekran kilidi) geri gelindiğinde tarayıcı bazen sayfayı
  // YENİDEN YÜKLEMEZ (telefonun belleğine ve tarayıcıya göre değişir — S22,
  // iPhone ve iPad'de farklı davranır). Eskiden PIN kontrolü SADECE sayfa
  // yüklenirken yapıldığı için, sayfa yenilenmeyen cihazda PIN hiç sorulmuyordu.
  // Şimdi sayfa tekrar görünür olduğunda da aynı kontrol yapılır.
  var kilitleniyor = false;
  function geriDonusKilitKontrolu(){
    if(kilitleniyor || buSayfaLogin || buSayfaPin || buSayfaCihazEngelli) return;
    try{ if(!firebase.auth().currentUser) return; }catch(e){ return; }
    var durum = gecenSureDurumu();
    if(durum === 0) return;
    kilitleniyor = true;
    document.documentElement.style.visibility = "hidden"; // içerik bir an bile görünmesin
    if(durum === 2){ firebase.auth().signOut(); }
    else {
      // Kaldığı yerden devam (22.09.2026): PIN sonrası her zaman Ana
      // Sayfa'ya atılmak yerine, kilitlenme anındaki sayfaya dönülsün diye
      // tam adresi (yol + arama parametreleri) kaydediyoruz. pin-render.js
      // başarılı girişte bunu okuyup oraya yönlendirir.
      try{ localStorage.setItem("weicon_pin_donus_sayfa", window.location.pathname + window.location.search); }catch(e){}
      window.location.replace("pin.html");
    }
  }
  document.addEventListener("visibilitychange", function(){
    if(!document.hidden) geriDonusKilitKontrolu();
  });
  window.addEventListener("pageshow", function(ev){
    if(ev.persisted) geriDonusKilitKontrolu();   // geri/ileri önbelleğinden dönüş
  });
  window.addEventListener("focus", geriDonusKilitKontrolu);

  // PERİYODİK GÜVENLİK AĞI (30.09.2026): iOS'ta (iPhone/iPad, Safari standalone
  // PWA) uygulama arka plandan öne alındığında "visibilitychange"/"focus"
  // olayları Samsung/Android'deki kadar güvenilir tetiklenmiyor — bu yüzden
  // kilit kontrolü hiç çalışmadan oturum sonsuza kadar açık kalabiliyordu
  // (Samsung'da her seferinde soruyor, iPhone/iPad'de hiç sormuyordu; hedefimiz
  // ikisinde de AYNI kurala uymasıydı). Bu 20 saniyelik zamanlayıcı, olay
  // tetiklenmese bile süreyi düzenli kontrol eder. AKTİF KULLANIMI KESMEZ:
  // gecenSureDurumu() dokunma/kaydırma/yazma oldukça tazelenen zaman damgasına
  // bakıyor, yani ekrana dokunmaya devam ettiğin sürece (durum===0) bu
  // zamanlayıcı hiçbir şey yapmaz, işlemin ortasında seni asla PIN/şifre
  // ekranına atmaz — sadece GERÇEKTEN 5/120 dakika dokunulmamışsa devreye girer.
  setInterval(geriDonusKilitKontrolu, 20000);

  // GERÇEK KULLANIM TAKİBİ: Zaman damgası eskiden sadece sayfa açılırken
  // yenileniyordu. Artık ekrana dokunma/kaydırma/tuş vuruşu da (en fazla 2 sn'de
  // bir yazılarak) yeniler. PIN ekranında yenilenmez — aksi hâlde PIN ekranına
  // dokunmak kilidi kırardı.
  //
  // DÜZELTME (05.10.2026, Abdullah'ın iPad 9/iOS'ta bildirdiği hata — video
  // ile doğrulandı): iOS, arka plana alınan bir sekme/PWA'da JS
  // zamanlayıcılarını (setInterval dahil) durduruyor — yani yukarıdaki
  // 20 saniyelik "geriDonusKilitKontrolu" güvenlik ağı da, "visibilitychange"/
  // "focus" olayları da (bkz. yukarıdaki not) tam güvenmemiz gereken anda
  // (uygulama arka plandan öne geldiğinde) çalışmayabiliyor. Eskiden bu
  // durumda kullanıcının ekrana attığı İLK dokunuş sadece zaman damgasını
  // ("son aktivite") olduğu gibi şimdiye güncelliyordu — kilit kontrolünü
  // HİÇ çalıştırmadan — böylece gerçekte PIN/şifre istenmesi gereken bir
  // dönüş, sanki hiç boşluk yokmuş gibi sessizce "temizleniyor" ve program
  // şifre/PIN sormadan doğrudan açık kalıyordu. Şimdi her etkileşimde ÖNCE
  // kilit kontrolü (geriDonusKilitKontrolu) çalıştırılıyor — kilitliyse
  // PIN/login'e yönlendirir ve zaman damgası GÜNCELLENMEZ; kilitli değilse
  // (normal kullanım) hiçbir şey değişmez, zaman damgası her zamanki gibi
  // tazelenir. Böylece setInterval/visibilitychange çalışmasa bile, ilk
  // dokunuş kendisi güvenlik kontrolünü garantiliyor.
  if(!buSayfaPin){
    var sonEtkilesimYazimi = 0;
    var etkilesimKaydet = function(){
      var t = Date.now();
      if(t - sonEtkilesimYazimi < 2000) return;
      if(kilitleniyor) return;
      sonEtkilesimYazimi = t;
      geriDonusKilitKontrolu();
      if(kilitleniyor) return; // kilit tetiklendi (PIN/login'e yönlendiriliyor) — aktiviteyi güncelleme
      aktiviteZamaniniGuncelle();
    };
    ["touchstart","pointerdown","mousedown","keydown","scroll","input"].forEach(function(ad){
      window.addEventListener(ad, etkilesimKaydet, {passive:true, capture:true});
    });
  }

  // ÇEVRİMDIŞI FARKINDALIK BANNER'I — Firebase Realtime Database yazma
  // işlemlerini bağlantı kesikken de otomatik kuyruğa alıp bağlantı gelince
  // gönderir (SDK'nın kendi varsayılan davranışı), ama kullanıcı bunun
  // farkında olmalı — aksi hâlde "kaydettim ama gitti mi gitmedi mi" belirsizliği
  // yaşanır. Bu yüzden basit bir banner ile durumu her sayfada gösteriyoruz.
  function cevrimdisiBannerOlustur(){
    if(document.getElementById("cevrimdisiBanner")) return;
    var b = document.createElement("div");
    b.id = "cevrimdisiBanner";
    b.textContent = "📴 Çevrimdışısın — kayıtların bağlantı gelince otomatik gönderilecek.";
    b.style.cssText = "display:none;position:fixed;top:0;left:0;right:0;background:#f2994a;color:#fff;text-align:center;padding:8px 12px;font-size:12px;font-weight:800;z-index:99998;";
    document.body.insertBefore(b, document.body.firstChild);
  }

  function cevrimdisiDurumGuncelle(){
    cevrimdisiBannerOlustur();
    var b = document.getElementById("cevrimdisiBanner");
    if(b) b.style.display = navigator.onLine ? "none" : "block";
  }

  window.addEventListener("online", cevrimdisiDurumGuncelle);
  window.addEventListener("offline", cevrimdisiDurumGuncelle);
  document.addEventListener("DOMContentLoaded", cevrimdisiDurumGuncelle);

  // GÜNLÜK ARAÇ KM HATIRLATMA / KISITLAMA (16.10.2026)
  // Mevcut km.html ve KmData kayıt yapısını kullanır; yeni giriş sayfası
  // oluşturmaz ve KM hesaplama/kayıt fonksiyonlarına müdahale etmez.
  var KM_GUNLUK_HATIRLATMA_SNOOZE = "weicon_km_hatirlatma_erteleme";
  var KM_GUNLUK_HATIRLATMA_GOSTERILDI = "weicon_km_hatirlatma_gosterildi";
  var KM_GUNLUK_KONTROL_TIMER = null;
  function kmYerelTarihAnahtari(d){
    d = d || new Date();
    return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2);
  }
  function kmSaatDakika(d){ return d.getHours()*60+d.getMinutes(); }
  function kmSaatKur(d, saat, dakika){ var x=new Date(d.getTime()); x.setHours(saat,dakika,0,0); return x; }
  function kmGunlukKontrolu(user, tamam){
    if(!user || buSayfaLogin || buSayfaPin || buSayfaCihazEngelli || window.location.pathname.split("/").pop()==="erisim-reddedildi.html"){
      tamam(); return;
    }
    // KM giriş formu bizzat erişilebilir kalır; mevcut modüle yönlendirilir.
    var dosya = window.location.pathname.split("/").pop() || "home.html";
    var kmSayfasi = dosya === "km.html";
    var simdi = new Date();
    var dakika = kmSaatDakika(simdi);
    var baslangic = 6*60, bitis = 13*60;
    try{ if(KM_GUNLUK_KONTROL_TIMER) clearTimeout(KM_GUNLUK_KONTROL_TIMER); }catch(e){}

    function timerKur(hedef){
      var ms = Math.max(1000, hedef.getTime()-Date.now());
      KM_GUNLUK_KONTROL_TIMER = setTimeout(function(){ kmGunlukKontrolu(firebase.auth().currentUser, function(){}); }, ms);
    }
    function hatirlatmaGoster(){
      if(kmSayfasi || !document.body || document.getElementById("weiconKmGunlukOverlay")) return;
      var overlay=document.createElement("div");
      overlay.id="weiconKmGunlukOverlay";
      overlay.style.cssText="position:fixed;inset:0;z-index:100000;background:rgba(9,28,54,.70);display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box;font-family:Arial,sans-serif;";
      var kutu=document.createElement("div");
      kutu.style.cssText="width:100%;max-width:390px;background:#fff;border-radius:16px;padding:22px 18px 18px;box-sizing:border-box;box-shadow:0 18px 55px rgba(0,0,0,.28);text-align:center;color:#17365f;";
      var ikon=document.createElement("div"); ikon.textContent="🚗"; ikon.style.cssText="font-size:38px;margin-bottom:8px;";
      var baslik=document.createElement("div"); baslik.textContent="Günlük Araç KM Girişi"; baslik.style.cssText="font-size:21px;font-weight:800;margin:0 0 12px;";
      var metin=document.createElement("p"); metin.textContent="Bugünün ("+("0"+simdi.getDate()).slice(-2)+"."+("0"+(simdi.getMonth()+1)).slice(-2)+"."+simdi.getFullYear()+") tarihli araç KM girişi henüz yapılmamış."; metin.style.cssText="font-size:15px;line-height:1.5;margin:0 0 18px;color:#34445b;";
      var git=document.createElement("button"); git.type="button"; git.textContent="🚘  KM Giriş Sayfasına Git"; git.style.cssText="display:block;width:100%;border:0;border-radius:10px;padding:14px 10px;background:linear-gradient(135deg,#1684f8,#0758cf);color:#fff;font-size:15px;font-weight:800;margin-bottom:10px;";
      git.onclick=function(){ window.location.href="km.html?kmHatirlatma=1"; };
      var ertele=document.createElement("button"); ertele.type="button"; ertele.textContent="◷  1 Saat Ertele"; ertele.style.cssText="display:block;width:100%;border:1px solid #e05b5b;border-radius:10px;padding:13px 10px;background:#fff;color:#c62828;font-size:15px;font-weight:800;";
      ertele.onclick=function(){
        try{ localStorage.setItem(KM_GUNLUK_HATIRLATMA_SNOOZE,String(Date.now()+60*60*1000)); localStorage.setItem(KM_GUNLUK_HATIRLATMA_GOSTERILDI,kmYerelTarihAnahtari()); }catch(e){}
        overlay.remove();
        var hedef=new Date(Date.now()+60*60*1000), kilit=kmSaatKur(new Date(),13,0);
        if(kilit.getTime()<hedef.getTime()) hedef=kilit;
        timerKur(hedef);
      };
      kutu.appendChild(ikon); kutu.appendChild(baslik); kutu.appendChild(metin); kutu.appendChild(git); kutu.appendChild(ertele); overlay.appendChild(kutu); document.body.appendChild(overlay);
    }
    function kaydiKontrolEt(){
      // Okuma hatasında kullanıcıyı yanlışlıkla kilitleme; yalnızca kayıt
      // açıkça bulunamadığında hatırlatma/kısıtlama uygula.
      firebase.database().ref("kmTakip/"+kmYerelTarihAnahtari(simdi)).once("value").then(function(snap){
        var kayit=snap.val();
        var kmVar=!!(kayit && kayit.km!==undefined && kayit.km!==null && String(kayit.km).trim()!=="");
        if(kmVar){
          try{ localStorage.removeItem(KM_GUNLUK_HATIRLATMA_SNOOZE); localStorage.removeItem(KM_GUNLUK_HATIRLATMA_GOSTERILDI); }catch(e){}
          tamam(); return;
        }
        var simdiKontrol=new Date(), dk=kmSaatDakika(simdiKontrol);
        if(dk>=bitis){
          if(!kmSayfasi){ document.documentElement.style.visibility="hidden"; window.location.replace("km.html?kmZorunlu=1"); return; }
          tamam(); return;
        }
        if(dk<baslangic){
          tamam(); timerKur(kmSaatKur(simdiKontrol,6,0)); return;
        }
        if(kmSayfasi){ tamam(); timerKur(kmSaatKur(simdiKontrol,13,0)); return; }
        var ertelenme=0;
        try{ ertelenme=parseInt(localStorage.getItem(KM_GUNLUK_HATIRLATMA_SNOOZE)||"0",10)||0; }catch(e){}
        if(ertelenme>Date.now()){
          tamam(); var sonraki=new Date(ertelenme), kilitSaati=kmSaatKur(simdiKontrol,13,0);
          if(kilitSaati.getTime()<sonraki.getTime()) sonraki=kilitSaati;
          timerKur(sonraki); return;
        }
        tamam(); hatirlatmaGoster();
        timerKur(kmSaatKur(simdiKontrol,13,0));
      }).catch(function(err){ console.warn("Günlük KM kontrolü okunamadı; program normal açılıyor.",err); tamam(); });
    }
    // 06:00 öncesinde kayda bakmak gerekmez; 06:00 başlangıcında kontrol başlar.
    if(dakika<baslangic){ tamam(); timerKur(kmSaatKur(simdi,6,0)); return; }
    kaydiKontrolEt();
  }

  function normalAkisiIsle(user){
    if(user){
      // Giriş sayfasındaysak (yeni tamamlanmış bir giriş demektir), bayat
      // "son aktivite" zaman damgası yüzünden yanlışlıkla anında çıkışa
      // zorlamayı önlemek için aktiviteyi HEMEN tazeleyip durum kontrolünü
      // hiç uygulamadan doğrudan Ana Sayfa'ya geç.
      if(buSayfaLogin){
        aktiviteZamaniniGuncelle();
        window.location.href = "home.html";
        return;
      }
      var durum = gecenSureDurumu();
      if(durum === 2){
        firebase.auth().signOut();
        return; // signOut tekrar tetikleyecek (user=null dalı çalışacak)
      }
      if(durum === 1 && !buSayfaPin){
        try{ localStorage.setItem("weicon_pin_donus_sayfa", window.location.pathname + window.location.search); }catch(e){}
        window.location.href = "pin.html";
        return;
      }
      if(!buSayfaCihazEngelli){
        cihazEngelliMi(function(engelli){
          if(engelli){
            firebase.auth().signOut().then(function(){
              window.location.href = "cihaz-engelli.html";
            });
            return;
          }
          kisitliSayfaKontrolu(user, function(izinVar){
            if(!izinVar) return; // yönlendirme/çıkış zaten tetiklendi
            kmGunlukKontrolu(user, function(){
              document.documentElement.style.visibility = "visible";
              if(!buSayfaPin) aktiviteZamaniniGuncelle();
              cihazKaydiGuncelle();
              window.dispatchEvent(new CustomEvent("weiconAuthHazir", {detail:{user:user}}));
            });
          });
        });
        return;
      }
      kisitliSayfaKontrolu(user, function(izinVar){
        if(!izinVar) return;
        kmGunlukKontrolu(user, function(){
          document.documentElement.style.visibility = "visible";
          if(!buSayfaPin) aktiviteZamaniniGuncelle();
          window.dispatchEvent(new CustomEvent("weiconAuthHazir", {detail:{user:user}}));
        });
      });
    } else {
      if(buSayfaCihazEngelli){
        document.documentElement.style.visibility = "visible";
      } else if(!buSayfaLogin){
        window.location.href = "login.html";
      } else {
        document.documentElement.style.visibility = "visible";
      }
    }
  }

  firebase.auth().onAuthStateChanged(function(user){
    normalAkisiIsle(user);
  });

})();
