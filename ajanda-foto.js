/*
  ajanda-foto.js — TKP.06.11.26-10:17.1495
  =========================================
  AJANDA FOTOĞRAFI: seçme (kamera / dosya) → çözme (HEIC dahil) → kenarlardan kırpma → sıkıştırma → kaydetme.
  TEK KAYNAK (06.11.2026, Abdullah): hem Ana Sayfa takvimindeki "Ajanda" penceresi (home-takvim-render.js)
  hem Ziyaret Takvimi sayfası (ziyaret-render.js: resimSikistir / kirpVeSikistir bu modüle devreder) kullanır.

  Kaydetme: AjandaData.fotografEkle(tarih, dataUrl) — "ajanda/{tarih}/{pushId}: {url, zaman}" (saat = zaman).

  Kullanım:
    AjandaFoto.sec("kamera" | "dosya", "YYYY-MM-DD", function(kaydedildi){ ... });
    AjandaFoto.resimSikistir(file, function(dataUrl, imgEl, hata){ ... });   // yalnızca ÇÖZER
    AjandaFoto.kirpVeSikistir(imgEl, {sol,ust,sag,alt});                       // yüzde (0-100) kırpar + küçültür
*/
var AjandaFoto = (function(){
  var MIN_YUZDE = 10;

  // ——— Çözme (HEIC/HEIF → JPEG) ———
  function heicHazirla(geriBildir){
    if(typeof heic2any !== "undefined"){ geriBildir(true); return; }
    try{
      var s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.4/heic2any.min.js";
      s.onload = function(){ geriBildir(typeof heic2any !== "undefined"); };
      s.onerror = function(){ geriBildir(false); };
      document.head.appendChild(s);
    }catch(e){ geriBildir(false); }
  }

  function resimSikistir(file, geriBildir){
    function sessizKaydet(asama, detay){
      if(typeof HataLog !== "undefined") HataLog.kaydet("Ajanda fotoğrafı işlenemedi (" + asama + ")", detay);
    }
    function muhtemelenHeic(){
      var ad = ((file && file.name) || "").toLowerCase();
      var tur = ((file && file.type) || "").toLowerCase();
      return ad.indexOf(".heic") !== -1 || ad.indexOf(".heif") !== -1 || tur.indexOf("heic") !== -1 || tur.indexOf("heif") !== -1;
    }
    function coz(islenecekDosya){
      try{
        var reader = new FileReader();
        reader.onload = function(e){
          var img = new Image();
          img.onload = function(){ geriBildir(e.target.result, img, null); };
          img.onerror = function(){
            sessizKaydet("img.onerror", "dosya: " + ((file && file.name) || "?") + ", tür: " + ((file && file.type) || "?"));
            geriBildir(null, null, muhtemelenHeic() ? "format" : "genel");
          };
          img.src = e.target.result;
        };
        reader.onerror = function(){ sessizKaydet("FileReader", reader.error && reader.error.message); geriBildir(null, null, "genel"); };
        reader.readAsDataURL(islenecekDosya);
      }catch(e){
        sessizKaydet("try/catch dış", e && e.message);
        geriBildir(null, null, muhtemelenHeic() ? "format" : "genel");
      }
    }
    if(muhtemelenHeic()){
      heicHazirla(function(var_){
        if(!var_){ sessizKaydet("heic2any-yuklenmedi", "kütüphane yüklenemedi"); geriBildir(null, null, "format"); return; }
        try{
          heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 }).then(function(sonuc){
            coz(Array.isArray(sonuc) ? sonuc[0] : sonuc);
          }).catch(function(e){ sessizKaydet("heic2any", e && e.message); geriBildir(null, null, "format"); });
        }catch(e){ sessizKaydet("heic2any try/catch", e && e.message); geriBildir(null, null, "format"); }
      });
      return;
    }
    coz(file);
  }

  // Kırpma kutusuna (yüzde) göre img'in SADECE o bölgesini alır, maks. 1100px genişliğe küçültüp %65 JPEG yapar.
  function kirpVeSikistir(img, kutu){
    var sol = kutu.sol / 100, ust = kutu.ust / 100, sag = kutu.sag / 100, alt = kutu.alt / 100;
    var kx = Math.round(img.naturalWidth * sol), ky = Math.round(img.naturalHeight * ust);
    var kg = Math.max(1, Math.round(img.naturalWidth * (sag - sol)));
    var ky2 = Math.max(1, Math.round(img.naturalHeight * (alt - ust)));
    var olcek = Math.min(1, 1100 / kg);
    var canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(kg * olcek));
    canvas.height = Math.max(1, Math.round(ky2 * olcek));
    canvas.getContext("2d").drawImage(img, kx, ky, kg, ky2, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.65);
  }

  // ——— Arayüz: tam ekran kırpma ———
  var stilEklendi = false;
  function stilEkle(){
    if(stilEklendi) return; stilEklendi = true;
    var st = document.createElement("style");
    st.textContent =
      ".af-zemin{position:fixed;inset:0;z-index:3200;background:#0b0f16;display:flex;flex-direction:column;font-family:inherit}"
    + ".af-ust{height:58px;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:0 14px;color:#fff;font-weight:800;font-size:15px}"
    + ".af-x{width:40px;height:40px;border:0;border-radius:12px;background:#2b3340;color:#fff;font-size:18px;cursor:pointer}"
    + ".af-alan{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:6px 18px;touch-action:none}"
    + ".af-sar{position:relative;line-height:0;display:inline-block;touch-action:none;user-select:none;-webkit-user-select:none}"
    + ".af-sar img{display:block;max-width:calc(100vw - 36px);max-height:calc(100vh - 58px - 110px);width:auto;height:auto;-webkit-user-drag:none}"
    + ".af-dis{position:absolute;background:rgba(0,0,0,.62);pointer-events:none}"
    + ".af-kutu{position:absolute;border:2px solid #fff;box-sizing:border-box;pointer-events:none}"
    + ".af-tut{position:absolute;width:44px;height:44px;pointer-events:auto;touch-action:none}"
    + ".af-tut:after{content:'';position:absolute;width:20px;height:20px;border:4px solid #fff;box-sizing:border-box}"
    + ".af-tut[data-k=sol-ust]{left:-22px;top:-22px}.af-tut[data-k=sol-ust]:after{right:2px;bottom:2px;border-right:0;border-bottom:0}"
    + ".af-tut[data-k=sag-ust]{right:-22px;top:-22px}.af-tut[data-k=sag-ust]:after{left:2px;bottom:2px;border-left:0;border-bottom:0}"
    + ".af-tut[data-k=sol-alt]{left:-22px;bottom:-22px}.af-tut[data-k=sol-alt]:after{right:2px;top:2px;border-right:0;border-top:0}"
    + ".af-tut[data-k=sag-alt]{right:-22px;bottom:-22px}.af-tut[data-k=sag-alt]:after{left:2px;top:2px;border-left:0;border-top:0}"
    + ".af-ip{text-align:center;color:#c8d2e0;font-size:12px;font-weight:700;padding:4px 14px;flex-shrink:0;min-height:20px}"
    + ".af-ip--hata{color:#ff8a80}"
    + ".af-alt{height:86px;flex-shrink:0;display:flex;align-items:center;gap:12px;padding:0 18px 6px}"
    + ".af-sifirla{width:52px;height:52px;border:0;border-radius:14px;background:#2b3340;color:#fff;font-size:22px;cursor:pointer}"
    + ".af-yukle{flex:1;height:52px;border:0;border-radius:14px;background:#16a085;color:#fff;font-weight:800;font-size:16px;cursor:pointer;font-family:inherit}"
    + ".af-yukle:disabled{background:#4a5a56;cursor:default}";
    document.head.appendChild(st);
  }

  function kirpEkraniAc(dataUrl, img, tarih, bitti){
    stilEkle();
    var kutu = {sol: 3, ust: 3, sag: 97, alt: 97};
    var aktif = null;
    var z = document.createElement("div");
    z.className = "af-zemin";
    z.innerHTML =
      "<div class='af-ust'><button type='button' class='af-x' aria-label='Vazgeç'>✕</button><span>Kenarlardan kırp</span><span style='width:40px'></span></div>"
    + "<div class='af-alan'><div class='af-sar'><img alt=''>"
    +   "<div class='af-dis' data-d='u'></div><div class='af-dis' data-d='a'></div><div class='af-dis' data-d='s'></div><div class='af-dis' data-d='g'></div>"
    +   "<div class='af-kutu'><i class='af-tut' data-k='sol-ust'></i><i class='af-tut' data-k='sag-ust'></i><i class='af-tut' data-k='sol-alt'></i><i class='af-tut' data-k='sag-alt'></i></div>"
    + "</div></div>"
    + "<div class='af-ip'>köşeleri sürükle</div>"
    + "<div class='af-alt'><button type='button' class='af-sifirla' aria-label='Sıfırla'>↺</button><button type='button' class='af-yukle'>✓ Yükle</button></div>";
    document.body.appendChild(z);
    var sar = z.querySelector(".af-sar"), kEl = z.querySelector(".af-kutu"), ip = z.querySelector(".af-ip"), yuk = z.querySelector(".af-yukle");
    z.querySelector("img").src = dataUrl;

    function ciz(){
      kEl.style.left = kutu.sol + "%"; kEl.style.top = kutu.ust + "%";
      kEl.style.width = (kutu.sag - kutu.sol) + "%"; kEl.style.height = (kutu.alt - kutu.ust) + "%";
      function d(k, css){ z.querySelector("[data-d=" + k + "]").style.cssText = css; }
      d("u", "top:0;left:0;width:100%;height:" + kutu.ust + "%");
      d("a", "top:" + kutu.alt + "%;left:0;width:100%;height:" + (100 - kutu.alt) + "%");
      d("s", "top:" + kutu.ust + "%;left:0;width:" + kutu.sol + "%;height:" + (kutu.alt - kutu.ust) + "%");
      d("g", "top:" + kutu.ust + "%;left:" + kutu.sag + "%;width:" + (100 - kutu.sag) + "%;height:" + (kutu.alt - kutu.ust) + "%");
    }
    function kapat(sonuc){
      document.removeEventListener("pointermove", surukle);
      document.removeEventListener("pointerup", birak);
      document.removeEventListener("pointercancel", birak);
      z.remove();
      if(typeof bitti === "function") bitti(sonuc);
    }
    function surukle(ev){
      if(!aktif) return;
      var r = sar.getBoundingClientRect();
      if(!r.width || !r.height) return;
      var x = Math.min(100, Math.max(0, (ev.clientX - r.left) / r.width * 100));
      var y = Math.min(100, Math.max(0, (ev.clientY - r.top) / r.height * 100));
      if(aktif === "sol-ust"){ kutu.sol = Math.min(x, kutu.sag - MIN_YUZDE); kutu.ust = Math.min(y, kutu.alt - MIN_YUZDE); }
      else if(aktif === "sag-ust"){ kutu.sag = Math.max(x, kutu.sol + MIN_YUZDE); kutu.ust = Math.min(y, kutu.alt - MIN_YUZDE); }
      else if(aktif === "sol-alt"){ kutu.sol = Math.min(x, kutu.sag - MIN_YUZDE); kutu.alt = Math.max(y, kutu.ust + MIN_YUZDE); }
      else if(aktif === "sag-alt"){ kutu.sag = Math.max(x, kutu.sol + MIN_YUZDE); kutu.alt = Math.max(y, kutu.ust + MIN_YUZDE); }
      kutu.sol = Math.max(0, kutu.sol); kutu.ust = Math.max(0, kutu.ust); kutu.sag = Math.min(100, kutu.sag); kutu.alt = Math.min(100, kutu.alt);
      ciz();
    }
    function birak(){ aktif = null; }
    z.querySelectorAll(".af-tut").forEach(function(t){
      t.addEventListener("pointerdown", function(ev){
        ev.preventDefault(); aktif = this.getAttribute("data-k");
        try{ this.setPointerCapture(ev.pointerId); }catch(e){}
      });
    });
    document.addEventListener("pointermove", surukle);
    document.addEventListener("pointerup", birak);
    document.addEventListener("pointercancel", birak);
    z.querySelector(".af-x").onclick = function(){ kapat(false); };
    z.querySelector(".af-sifirla").onclick = function(){ kutu = {sol: 3, ust: 3, sag: 97, alt: 97}; ciz(); };
    yuk.onclick = function(){
      yuk.disabled = true; yuk.textContent = "⏳ Yükleniyor";
      var url;
      try{ url = kirpVeSikistir(img, kutu); }
      catch(e){
        yuk.disabled = false; yuk.textContent = "✓ Yükle";
        if(typeof HataLog !== "undefined") HataLog.kaydet("Ajanda fotoğrafı kırpılamadı", e && e.message);
        ip.textContent = "Fotoğraf kırpılamadı, tekrar dene"; ip.className = "af-ip af-ip--hata"; return;
      }
      AjandaData.fotografEkle(tarih, url, function(ok, err){
        if(!ok){
          yuk.disabled = false; yuk.textContent = "✓ Yükle";
          ip.textContent = "Kaydedilemedi: " + (err && err.message ? err.message : "bilinmeyen hata"); ip.className = "af-ip af-ip--hata";
          return;
        }
        kapat(true);
      });
    };
    ciz();
  }

  function hataToast(metin){
    if(typeof hataGoster === "function") hataGoster(metin); else alert(metin);
  }

  // kaynak: "kamera" (capture=environment) | "dosya" (galeri / herhangi bir dosya)
  function sec(kaynak, tarih, bitti){
    document.querySelectorAll(".af-giris").forEach(function(e){ e.remove(); }); // önceki iptal edilmiş seçiciler
    var inp = document.createElement("input");
    inp.className = "af-giris";
    inp.type = "file"; inp.accept = "image/*"; inp.hidden = true;
    if(kaynak === "kamera") inp.setAttribute("capture", "environment");
    inp.addEventListener("change", function(){
      var f = inp.files && inp.files[0];
      inp.remove();
      if(!f) return;
      resimSikistir(f, function(dataUrl, img, hata){
        if(!dataUrl){
          hataToast(hata === "format"
            ? "Bu fotoğraf (muhtemelen HEIC) işlenemedi. Galeri ayarından \"En Uyumlu\" (JPEG) formatını seçip tekrar dene."
            : "Fotoğraf işlenemedi, tekrar dener misin?");
          return;
        }
        kirpEkraniAc(dataUrl, img, tarih, bitti);
      });
    });
    document.body.appendChild(inp);
    inp.click();
  }

  return { sec: sec, resimSikistir: resimSikistir, kirpVeSikistir: kirpVeSikistir };
})();
