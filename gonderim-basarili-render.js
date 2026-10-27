document.addEventListener("DOMContentLoaded", function(){
  var bilgi = {};
  try{ bilgi = JSON.parse(localStorage.getItem("weiconv2_gonderim_kanali")||"{}"); }catch(e){}

  var kanalEtiket = bilgi.kanal === "whatsapp" ? "WhatsApp mesajı gönderiliyor"
    : bilgi.kanal === "panoya" ? "📷 Panoya kopyalandı"
    : "Mail gönderiliyor";
  document.getElementById("gbKanalRozeti").textContent = kanalEtiket;

  var altMetin = bilgi.kanal === "panoya"
    ? "Görsel panoya kopyalandı — mail veya sohbete yapıştırabilirsin."
    : (bilgi.musteriAd
      ? (bilgi.musteriAd + " için sipariş/teklif formu paylaşım uygulamasına gönderildi.")
      : "Form paylaşım uygulamasına gönderildi.");
  altMetin += " 5 sn içinde Ana Sayfa'ya yönlendiriliyorsun.";
  document.getElementById("gbAltMetin").textContent = altMetin;

  function anaSayfayaDonVeTemizle(){
    try{ localStorage.setItem("weiconv2_sepet", "[]"); }catch(e){}
    try{ localStorage.removeItem("weiconv2_sepet_kur_override"); }catch(e){}
    try{ localStorage.removeItem("weicon_secili_musteri"); }catch(e){}
    try{ localStorage.removeItem("weiconv2_secili_iletisim"); }catch(e){}
    try{ localStorage.removeItem("weiconv2_onceden_secilen_tip"); }catch(e){}
    try{ localStorage.removeItem("weiconv2_son_kaydedilen_belge"); }catch(e){}
    try{ localStorage.removeItem("weiconv2_gonderim_kanali"); }catch(e){}
    // DÖNÜŞ ROTASI (06.10.2026): işlem başarıyla tamamlandı, Ana Sayfa'ya
    // gidiliyor — Müşteri Bul'a kalıntı bir "dönüş rotası" bayrağı
    // bırakmayalım.
    try{ localStorage.removeItem("weiconv2_musteri_donus_sayfa"); }catch(e){}
    try{ localStorage.removeItem("weiconv2_musteri_arama_durumu"); }catch(e){}
    window.location.href = "home.html";
  }

  document.getElementById("btnGbAnaSayfa").onclick = anaSayfayaDonVeTemizle;

  // Ekran 5 saniye görünüp kendiliğinden Ana Sayfa'ya döner (26.09.2026,
  // Abdullah'ın isteğiyle — butona basmaya gerek kalmadan; 30.09.2026'da
  // 6 sn'den 5 sn'ye kısaltıldı ve arka plan fotoğrafı kaldırılıp beyaz
  // zemin + gerçek İş Takip logosu ortalanarak büyütüldü).
  //
  // KÖK NEDEN DÜZELTMESİ (27.09.2026): Mail/WhatsApp paylaşımı seçilince
  // telefon başka bir uygulamaya (Outlook/Gmail/WhatsApp) geçiyor, bu
  // sekme ARKA PLANA düşüyor — tarayıcılar arka plandaki sekmelerde
  // setTimeout'u durdurur/geciktirir, bu yüzden 3 sn dolsa bile kullanıcı
  // geri dönmeden yönlendirme hiç tetiklenmiyordu. Artık gerçek geçen
  // süre BAŞLANGIÇ zamanına göre hesaplanıyor; sekme tekrar görünür
  // olduğunda (visibilitychange) süre dolmuşsa hemen, dolmamışsa kalan
  // süre kadar bekleyip yönlendiriyor.
  var baslangicZamani = Date.now();
  var GECIKME_MS = 5000;
  var yonlendirildiMi = false;

  function zamanindaYonlendir(){
    if(yonlendirildiMi || document.hidden) return;
    var kalanSure = GECIKME_MS - (Date.now() - baslangicZamani);
    if(kalanSure <= 0){
      yonlendirildiMi = true;
      anaSayfayaDonVeTemizle();
    } else {
      setTimeout(zamanindaYonlendir, kalanSure);
    }
  }
  zamanindaYonlendir();
  document.addEventListener("visibilitychange", function(){
    if(!document.hidden) zamanindaYonlendir();
  });
});
