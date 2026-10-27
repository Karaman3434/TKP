/*
  ust-sabit-olcum.js
  ====================
  TEK görevi: sabit (sticky) üst şeridin (.app-ust-sabit — logo/tarih +
  Geri/Ana Sayfa/Menü) o an ekranda kapladığı GERÇEK yüksekliği ölçüp bir CSS
  değişkenine (--ust-sabit-yukseklik) yazmak. Popup'lar (.overlay, vb.) bu
  değişkeni kullanarak üst şeridin TAM ALTINDAN açılır — sabit bir piksel
  tahmini değil, o anki gerçek render'dan alınan değer.

  Bilerek İZOLE ve KIRILGAN OLMAYAN bir dosya: her şey try/catch içinde,
  hata olursa CSS zaten güvenli bir varsayılana (100px) düşer — bu dosya asla
  sayfanın geri kalanını bozamaz.
*/
(function(){
  function olc(){
    try{
      var el = document.querySelector(".app-ust-sabit");
      if(!el) return;
      var h = el.getBoundingClientRect().height;
      if(h > 0) document.documentElement.style.setProperty("--ust-sabit-yukseklik", h + "px");
    }catch(e){}
  }

  // Döviz Kuru — artık global üst header'ın sağında, tek kaynaktan
  // (localStorage "weicon_kur", Ayarlar'daki otomatik senkron mantığı ile
  // aynı) besleniyor. Ana Sayfa ve Hızlı Hesapla'daki eski ayrı satırlar
  // kaldırıldı (05.09.2026).
  function headerKuruGuncelle(){
    try{
      var el = document.getElementById("headerKurDeger");
      if(!el) return;
      var kur = parseFloat(localStorage.getItem("weicon_kur"));
      el.textContent = isNaN(kur) ? "-" : kur.toLocaleString("tr-TR", {minimumFractionDigits:2, maximumFractionDigits:4});
    }catch(e){}
  }
  function dovizKuruHeaderaEkle(){
    try{
      var header = document.querySelector(".app-header");
      if(!header || header.querySelector(".header-kur-blok")) { headerKuruGuncelle(); return; }
      var logo = header.querySelector(".logo");
      var tarih = header.querySelector(".tarih");
      if(!logo || !tarih) return;

      // Sol kanat: tarih. Logo bu kanadın DIŞINA, iki kanadın arasına
      // konur — böylece iki taraf da flex:1 olduğundan logo satırın tam
      // ortasında sabit kalır (05.09.2026).
      var solKanat = document.createElement("div");
      solKanat.className = "header-tarih-kanat";
      header.insertBefore(solKanat, tarih);
      solKanat.appendChild(tarih);
      header.appendChild(logo);

      // Değer ve yenileme ikonu artık TEK, geniş bir dokunma alanında —
      // kur sayısına basmak da yenilemeyi tetikler, eski küçük ayrı
      // buton kaldırıldı (06.09.2026).
      var varAyarlarSync = typeof AyarlarSync !== "undefined";
      var kurBlok = document.createElement(varAyarlarSync ? "button" : "div");
      kurBlok.className = "header-kur-blok";
      kurBlok.id = "headerKurYenileBtn";
      if(varAyarlarSync){ kurBlok.type = "button"; kurBlok.setAttribute("aria-label", "Döviz kurunu yenile"); }
      kurBlok.innerHTML = "<span class='header-kur-deger-grup'><span class='header-kur-deger' id='headerKurDeger'>-</span><span class='header-kur-ikon' id='headerKurIkon'>" + (varAyarlarSync ? "🔄" : "") + "</span></span>";
      if(varAyarlarSync){
        kurBlok.onclick = function(){
          var ikon = document.getElementById("headerKurIkon");
          kurBlok.disabled = true;
          if(ikon) ikon.textContent = "⏳";
          AyarlarSync.otomatikKurGetir(true, function(basarili){
            headerKuruGuncelle();
            kurBlok.disabled = false;
            if(ikon) ikon.textContent = basarili ? "✓" : "✕";
            setTimeout(function(){ if(ikon) ikon.textContent = "🔄"; }, 1500);
          });
        };
      }
      header.appendChild(kurBlok);
      headerKuruGuncelle();
    }catch(e){}
  }

  function hazirlik(){ olc(); dovizKuruHeaderaEkle(); }

  try{
    document.addEventListener("DOMContentLoaded", hazirlik);
    window.addEventListener("resize", olc);
    window.addEventListener("load", hazirlik);
    window.addEventListener("istakipAuthHazir", hazirlik);
    window.addEventListener("storage", function(ev){ if(ev.key === "weicon_kur") headerKuruGuncelle(); });
  }catch(e){}
})();
