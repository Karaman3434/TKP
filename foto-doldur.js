/*
  foto-doldur.js — WG.151026.1015.825
  =====================================
  "📷 Fotoğraf/Ekran Görüntüsünden Doldur" — TEK KAYNAK paylaşılan modül
  (15.10.2026, Abdullah'ın isteğiyle, eski tek-dosyalık v1 uygulamadaki
  "Karttan/Tabeladan Doldur" özelliğinin v2 mimarisinde yeniden kurulmuş
  hâli). Kartvizit/tabela/fatura başlığı fotoğrafını veya WhatsApp/mail'den
  gelen bir ekran görüntüsünü — kamerayla çekerek ya da dosya/galeriden
  seçerek — weicon-ai-config.js'teki WEICON_AI_WORKER_URL adresindeki
  Firebase Cloud Function'a gönderir, AI'nin okuduğu alanları JSON olarak
  geri alır ve çağıran sayfaya iletir.

  KULLANIM (her sayfa kendi alan eşlemesini kendisi yapar, bu dosya hiçbir
  sayfaya özel alan adı bilmez):
    FotoDoldur.ac(function(veri){
      // veri = {firmaAdi, sehir, acikAdres, teslimatAdresi, telefon,
      //         eposta, yetkiliIsim, yetkiliGorev, vergiDairesi, vergiNo}
      // (AI bir alanı okuyamadıysa o alan boş string veya tanımsız olur)
      document.getElementById("...").value = veri.firmaAdi || "";
    });

  Seçim penceresi ve iki gizli dosya girişi (kamera / dosya-galeri) ilk
  çağrıda kendi kendine oluşturulur (document.body'ye eklenir) — hiçbir
  sayfanın kendi HTML'ine bu overlay'i elle eklemesi gerekmez. Görsel
  tasarım, uygulamanın zaten kullandığı .overlay/.sheet/.sheet-secenek
  sınıflarını (cari-kart-style.css) aynen kullanır — yeni bir popup
  biçimi İCAT EDİLMEDİ, iPad'de de zaten test edilmiş aynı bileşen.
*/
var FotoDoldur = (function(){

  var overlayHazirMi = false;
  var aktifDolduFn = null;
  var aktifBaslik = "";

  function elOlustur(){
    if(overlayHazirMi) return;
    var sarmal = document.createElement("div");
    sarmal.innerHTML =
      "<div class='overlay' id='fdSecOverlay' hidden>" +
        "<div class='sheet'>" +
          "<div class='sheet-baslik' id='fdSecBaslik'>Nasıl doldurmak istersiniz?</div>" +
          "<div class='sheet-alt'>Kartvizit, tabela, fatura başlığı veya WhatsApp/mail'den gelen ekran görüntüsü — sistem bilgileri okuyup ilgili alanlara otomatik dağıtır, kaydetmeden önce kontrol edersiniz.</div>" +
          "<button class='sheet-secenek' type='button' id='fdBtnKamera'><span class='ikon'>📷</span>Kamera ile Çek</button>" +
          "<button class='sheet-secenek' type='button' id='fdBtnDosya'><span class='ikon'>📁</span>Dosya / Galeriden Yükle</button>" +
          "<button class='sheet-secenek sheet-secenek--vazgec' type='button' id='fdBtnVazgec'>Vazgeç</button>" +
        "</div>" +
      "</div>" +
      "<input type='file' accept='image/*' capture='environment' id='fdInputKamera' style='display:none;'>" +
      "<input type='file' accept='image/*' id='fdInputDosya' style='display:none;'>";
    while(sarmal.firstChild) document.body.appendChild(sarmal.firstChild);

    document.getElementById("fdBtnKamera").onclick = function(){ document.getElementById("fdInputKamera").click(); };
    document.getElementById("fdBtnDosya").onclick = function(){ document.getElementById("fdInputDosya").click(); };
    document.getElementById("fdBtnVazgec").onclick = kapatOverlay;
    document.getElementById("fdInputKamera").onchange = function(){ dosyaSecildi(this); };
    document.getElementById("fdInputDosya").onchange = function(){ dosyaSecildi(this); };
    overlayHazirMi = true;
  }

  function kapatOverlay(){
    document.getElementById("fdSecOverlay").hidden = true;
  }

  function dosyaSecildi(inputEl){
    var dosya = inputEl.files && inputEl.files[0];
    inputEl.value = "";
    if(!dosya) return;

    document.getElementById("fdBtnKamera").hidden = true;
    document.getElementById("fdBtnDosya").hidden = true;
    document.getElementById("fdSecBaslik").textContent = "⏳ Fotoğraf okunuyor...";
    document.querySelector("#fdSecOverlay .sheet-alt").textContent = "Bu birkaç saniye sürebilir, lütfen bekleyin.";

    var reader = new FileReader();
    reader.onload = function(){
      var dataUrl = reader.result; // "data:image/jpeg;base64,xxxx"
      var virgul = dataUrl.indexOf(",");
      var mimeType = dataUrl.substring(5, dataUrl.indexOf(";"));
      var base64 = dataUrl.substring(virgul + 1);
      sunucuyaGonder(base64, mimeType);
    };
    reader.onerror = function(){
      tamamlaHata("Fotoğraf okunamadı, tekrar deneyin.");
    };
    reader.readAsDataURL(dosya);
  }

  function sunucuyaGonder(base64, mimeType){
    if(typeof WEICON_AI_WORKER_URL === "undefined" || !WEICON_AI_WORKER_URL){
      tamamlaHata("Bu özellik henüz bağlanmadı (sunucu adresi ayarlanmamış). Bilgileri elle girebilirsiniz.");
      return;
    }
    if(typeof firebase === "undefined" || !firebase.auth || !firebase.auth().currentUser){
      tamamlaHata("Oturum bulunamadı, sayfayı yenileyip tekrar deneyin.");
      return;
    }
    firebase.auth().currentUser.getIdToken().then(function(idToken){
      return fetch(WEICON_AI_WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + idToken },
        body: JSON.stringify({ resim: base64, mimeType: mimeType })
      });
    })
    .then(function(res){
      return res.json().catch(function(){ return {}; }).then(function(govde){
        if(!res.ok) throw new Error((govde && govde.hata) || ("Sunucu hatası (" + res.status + ")"));
        return govde;
      });
    })
    .then(function(veri){
      kapatOverlay();
      if(aktifDolduFn) aktifDolduFn(veri || {});
    })
    .catch(function(err){
      tamamlaHata("Okunamadı: " + err.message + " — bilgileri elle girebilirsiniz.");
    });
  }

  function tamamlaHata(mesaj){
    document.getElementById("fdSecBaslik").textContent = "⚠️ Okunamadı";
    document.querySelector("#fdSecOverlay .sheet-alt").textContent = mesaj;
    document.getElementById("fdBtnVazgec").textContent = "Kapat";
    document.getElementById("fdBtnKamera").hidden = true;
    document.getElementById("fdBtnDosya").hidden = true;
  }

  // dolduFn(veri) — veri alanları: firmaAdi, sehir, acikAdres,
  // teslimatAdresi, telefon, eposta, yetkiliIsim, yetkiliGorev,
  // vergiDairesi, vergiNo (AI okuyamadıysa boş/tanımsız gelir)
  function ac(dolduFn){
    elOlustur();
    aktifDolduFn = dolduFn;
    document.getElementById("fdSecBaslik").textContent = "Nasıl doldurmak istersiniz?";
    document.querySelector("#fdSecOverlay .sheet-alt").textContent = "Kartvizit, tabela, fatura başlığı veya WhatsApp/mail'den gelen ekran görüntüsü — sistem bilgileri okuyup ilgili alanlara otomatik dağıtır, kaydetmeden önce kontrol edersiniz.";
    document.getElementById("fdBtnVazgec").textContent = "Vazgeç";
    document.getElementById("fdBtnKamera").hidden = false;
    document.getElementById("fdBtnDosya").hidden = false;
    document.getElementById("fdSecOverlay").hidden = false;
  }

  return { ac: ac };
})();
