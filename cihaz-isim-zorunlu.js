/*
  cihaz-isim-zorunlu.js — TKP.01.11.26-22:45.1346
  =================================================
  EKLENDİ (01.11.2026, Abdullah'ın isteğiyle — "link kullanıcısı cihazına
  isim vermeden sisteme giremesin" talebi).

  KÖK NEDEN: "kullanıcı adı zorunlu" ekranı (home-render.js'teki
  kaBaslatVeKontrolEt/kaKullaniciAdiPenceresiniAc) eskiden SADECE
  home.html'de vardı. Ama "Ürün Bul/Sepet" gibi tek bir izni olan, kısıtlı
  bir link kullanıcısı (örn. "yasin1") home.html'e HİÇ uğramıyor — bu
  yüzden o ekranı hiç görmüyor, cihazı Abdullah'ın panelinde "Adsız Cihaz"
  olarak kalıyor ve kimin hangi cihaz olduğunu ayırt etmek zorlaşıyor.

  ÇÖZÜM: aynı zorunlu-isim mantığı artık TÜM sayfalarda, auth.js'in zaten
  attığı "istakipAuthHazir" olayını dinleyerek çalışıyor (bu olay TAM
  OLARAK auth.js'in oturum/cihaz-onayı/izin kontrollerinin HEPSİNİN
  geçtiği, sayfa içeriğinin görünür yapıldığı an ateşleniyor — bkz.
  auth.js: normalAkisiIsle). auth.js'in kendisine HİÇ dokunulmadı — sadece
  zaten var olan bu olaya dışarıdan bir dinleyici eklendi.

  Görsel tasarım BİREBİR home.html'deki "kullanıcı adı penceresi" (.ka-*
  sınıfları, artık home-style.css'te — TÜM sayfalarda yüklü) ile aynı,
  sadece markup burada DOM'a JS ile ekleniyor (her 45 sayfaya aynı HTML
  bloğunu elle eklemek yerine) — id'ler home.html'deki kendi
  "kaOverlay/kaInput/..." ile ÇAKIŞMASIN diye "ci" önekiyle farklı
  (zaten home.html'deki ZORUNLU tetikleyici bu dosya lehine kaldırıldı,
  bkz. home-render.js — ama olası bir çakışmaya karşı yine de ayrı id).

  EKLENDİ (aynı turda): isim kaydedilince SADECE "kullanıcı adı"
  (cihazlar/{id}/kullaniciAdi) değil, cihazın kendi "ad" alanı (panelde
  kalın başlıkta görünen, eskiden "Adsız Cihaz" yazan) da AYNI isimle
  dolduruluyor — Abdullah'ın isteği: "cihaz ismi de otomatik görüntülenir".
  Bu SADECE bu zorunlu ilk-kayıt anında olur (cihazın o ana kadar hiç
  kullaniciAdi'ı yoktu, dolayısıyla "ad" alanının da muhtemelen hâlâ boş/
  varsayılan olduğu an) — sonradan Abdullah panelden cihaza FARKLI bir ad
  verirse (✏️ ile), bu dosya bir daha ASLA araya girmez (olay sadece
  kullaniciAdi boşken bir kere tetiklenir).
*/

(function(){

  function ciHataGoster(mesaj){
    try{
      console.error(mesaj);
      var kutu = document.createElement("div");
      kutu.textContent = "⚠️ " + mesaj;
      kutu.style.cssText = "position:fixed;top:8px;left:8px;right:8px;background:#c0392b;color:#fff;padding:10px;border-radius:8px;font-size:13px;z-index:99999;";
      document.body.appendChild(kutu);
      setTimeout(function(){ kutu.remove(); }, 8000);
    }catch(e){}
  }

  function ciOverlayOlustur(){
    var overlay = document.createElement("div");
    overlay.className = "ka-overlay";
    overlay.id = "ciZorunluOverlay";
    overlay.innerHTML =
      "<div class='ka-ikon' aria-hidden='true'>📱</div>" +
      "<div class='ka-baslik'>Cihazına İsim Ver</div>" +
      "<div class='ka-alt'>Devam etmeden önce bu cihaza bir isim vermen gerekiyor. Bu isim, yönetici panelinde cihazının yanında görünecek.</div>" +
      "<input type='text' class='ka-input' id='ciZorunluInput' placeholder='örn. iPhone 13' autocomplete='off'>" +
      "<p class='ka-hata' id='ciZorunluHata' hidden>Lütfen bir isim gir.</p>" +
      "<div class='ka-ornek'>Örnek: iPhone 13, Tablet, Samsung S22</div>" +
      "<button type='button' class='ka-kaydet-btn' id='btnCiZorunluKaydet'>✓ Kaydet ve Devam Et</button>";
    document.body.appendChild(overlay);
    return overlay;
  }

  function ciKaydiTamamla(overlay){
    try{ document.body.style.overflow = ""; }catch(e){}
    try{ overlay.remove(); }catch(e){}
  }

  function ciKaydetTiklandi(overlay){
    var btn = document.getElementById("btnCiZorunluKaydet");
    var input = document.getElementById("ciZorunluInput");
    var hata = document.getElementById("ciZorunluHata");
    try{
      var adi = input.value.trim();
      if(!adi){ hata.hidden = false; return; }
      hata.hidden = true;
      btn.disabled = true;
      btn.textContent = "Kaydediliyor...";
      CihazData.kullaniciAdiKaydet(adi, function(){
        // ÖNEMLİ (çevrimdışı güvenlik): kullaniciAdiKaydet() yerel kayıt
        // tamamlanır tamamlanmaz (Firebase'in sunucu onayını BEKLEMEDEN)
        // geri döner — bkz. cihaz-data.js'teki kendi notu, "kullanıcıyı
        // hemen serbest bırak". Kullanıcıyı burada hemen devam ettiriyoruz.
        // Cihazın kendi "ad" alanını (panel başlığı) AYNI isimle doldurmak
        // ayrı, arka planda yapılan bir iş — onun Firebase onayını
        // BEKLEMEK çevrimdışıyken kullanıcıyı sonsuza dek "Kaydediliyor..."
        // ekranında kilitler, bu yüzden overlay'i kapatmak ona bağlı DEĞİL.
        try{ CihazData.adiKaydet(adi, function(){}); }catch(e){}
        ciKaydiTamamla(overlay);
      });
    }catch(e){
      if(btn){ btn.disabled = false; btn.textContent = "✓ Kaydet ve Devam Et"; }
      ciHataGoster("İsim kaydedilemedi: " + e.message);
    }
  }

  function ciKontrolEtVeGerekirseAc(){
    try{
      if(typeof CihazData === "undefined") return;
      if(CihazData.benimKullaniciAdim()) return; // zaten tanımlı, hiçbir şey yapma
      if(document.getElementById("ciZorunluOverlay")) return; // zaten açık

      var overlay = ciOverlayOlustur();
      document.body.style.overflow = "hidden";

      var input = document.getElementById("ciZorunluInput");
      document.getElementById("btnCiZorunluKaydet").onclick = function(){ ciKaydetTiklandi(overlay); };
      input.addEventListener("keydown", function(ev){
        if(ev.key === "Enter") ciKaydetTiklandi(overlay);
      });
      setTimeout(function(){ input.focus(); }, 50);
    }catch(e){ ciHataGoster("Cihaz ismi kontrolü başarısız: " + e.message); }
  }

  window.addEventListener("istakipAuthHazir", ciKontrolEtVeGerekirseAc);

})();
