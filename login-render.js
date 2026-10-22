/*
  login-render.js
  ===============
  Giriş formunun onclick mantığı. Firebase'in kendi auth.js'i (paylaşılan
  dosya) zaten oturum durumunu izliyor ve başarılı girişte otomatik olarak
  home.html'e yönlendiriyor — bu dosya sadece formu Firebase'e bağlıyor.
*/

document.addEventListener("DOMContentLoaded", function(){
  var btn = document.getElementById("girisBtn");
  var hataEl = document.getElementById("girisHata");

  // EKLENDİ (22.10.2026, Abdullah'ın isteğiyle) — "Giriş Linki" özelliği:
  // ...login.html?kullanici=<ad> ile açılan link, kullanıcı adını otomatik
  // doldurur; şifreyi çalışan kendisi yazar (şifre linkte YOKTUR).
  try{
    var url = new URL(window.location.href);
    var onDoldurDeger = url.searchParams.get("kullanici");
    if(onDoldurDeger){
      document.getElementById("girisEmail").value = onDoldurDeger;
      document.getElementById("girisSifre").focus();
    }
  }catch(e){}

  window.addEventListener("error", function(ev){
    console.error("Sayfa hatası:", ev);
    hataEl.textContent = "Sayfa hatası: " + ev.message;
    hataEl.hidden = false;
    btn.disabled = false;
    btn.textContent = "Giriş Yap";
  });
  window.addEventListener("unhandledrejection", function(ev){
    console.error("Yakalanmamış promise hatası:", ev);
    hataEl.textContent = "Hata: " + (ev.reason && ev.reason.message ? ev.reason.message : ev.reason);
    hataEl.hidden = false;
    btn.disabled = false;
    btn.textContent = "Giriş Yap";
  });

  // Çalışan hesapları e-posta yerine Abdullah'ın belirlediği kullanıcı
  // adıyla girer (01.10.2026) — "@" içermeyen bir değer, Firebase Auth'un
  // e-posta/şifre sağlayıcısı için arka planda sahte bir e-postaya çevrilir.
  // Bu dönüşüm calisan-erisim-render.js'teki hesap oluşturma ile AYNI
  // sabiti (WEICON_CALISAN_EMAIL_DOMAINI) kullanmalı.
  function girisDegeriEpostaYap(deger){
    deger = String(deger).trim();
    if(deger.indexOf("@") >= 0) return deger;
    return deger.toLowerCase().replace(/\s+/g,"") + WEICON_CALISAN_EMAIL_DOMAINI;
  }

  function girisYap(){
    var girilenDeger = document.getElementById("girisEmail").value.trim();
    var sifre = document.getElementById("girisSifre").value;
    hataEl.hidden = true;
    if(!girilenDeger || !sifre){
      hataEl.textContent = "E-posta/kullanıcı adı ve şifre girin.";
      hataEl.hidden = false;
      return;
    }
    var email = girisDegeriEpostaYap(girilenDeger);
    btn.disabled = true;
    btn.textContent = "Giriş yapılıyor...";
    try{
      firebase.auth().signInWithEmailAndPassword(email, sifre).then(function(){
        // Başarılı giriş — auth.js'teki "3 saat hareketsizlik" kontrolü eski/
        // bayat bir "weicon_son_aktivite" değeri yüzünden bu YENİ girişi bile
        // "hareketsiz" sanıp anında tekrar çıkış yaptırabiliyordu. Bunu önlemek
        // için aktivite zamanını, auth.js'in kontrolü çalışmadan HEMEN ÖNCE
        // burada tazeliyoruz.
        try{ localStorage.setItem("weicon_son_aktivite", Date.now().toString()); }catch(e){}
        // Başarılı — auth.js'teki onAuthStateChanged otomatik yönlendirecek.
      }).catch(function(e){
        console.error("Firebase giriş hatası:", e);
        hataEl.textContent = "Giriş başarısız: " + (e && e.code ? e.code : (e && e.message ? e.message : "bilinmeyen hata"));
        hataEl.hidden = false;
        btn.disabled = false;
        btn.textContent = "Giriş Yap";
      });
    }catch(e){
      console.error("Giriş işlemi başlatılamadı:", e);
      hataEl.textContent = "Giriş başlatılamadı: " + (e && e.message ? e.message : e);
      hataEl.hidden = false;
      btn.disabled = false;
      btn.textContent = "Giriş Yap";
    }
  }

  btn.onclick = girisYap;
  document.getElementById("girisSifre").addEventListener("keydown", function(e){
    if(e.key === "Enter") girisYap();
  });
});
