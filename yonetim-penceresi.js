/*
  yonetim-penceresi.js — TKP.04.11.26-23:22.1477
  ==============================================
  04.11.2026 (Abdullah onayı — mockup 1/2/3): Ayarlar > "Cihazlar ve Kullanıcılar"
  artık doğrudan sayfaya gitmez; ortada bir pencere açar:
    👤 Kullanıcı        -> bu cihazın bilgisi (cihaz adı, hesap, onay durumu) — salt okunur
    🛡️ Yönetici paneli  -> SADECE cihaz adı "Samsung S22" ise aktif; dokununca
                           cihaz-kullanici.html açılır, orada S22 PIN'i sorulur.
  S22 dışı cihazlarda "Yönetici paneli" gri ve kapalıdır.
*/
(function(){
  function el(id){ return document.getElementById(id); }
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }

  function s22Mi(){
    try{ return typeof CihazData !== "undefined" && CihazData.korumaliMi(CihazData.benimAdim()); }catch(e){ return false; }
  }
  function kapat(){ var o = el("ypOverlay"); if(o) o.hidden = true; }

  function anaGorunum(){
    var d = el("ypDialog"); if(!d) return;
    var yonetici = s22Mi();
    d.innerHTML =
      '<h4>Cihazlar ve Kullanıcılar</h4><p>Ne yapmak istiyorsun?</p>' +
      '<button type="button" class="yp-secenek" id="ypKullanici"><span class="yp-ikon">👤</span><span class="yp-metin"><b>Kullanıcı</b><small>Bu cihazın bilgisi</small></span></button>' +
      '<button type="button" class="yp-secenek ' + (yonetici ? "yp-secenek--aktif" : "yp-secenek--pasif") + '" id="ypYonetici"' + (yonetici ? "" : " disabled") + '>' +
        '<span class="yp-ikon">🛡️</span><span class="yp-metin"><b>Yönetici paneli</b><small>' + (yonetici ? "Samsung S22 · PIN ile açılır" : "Sadece Samsung S22\'de aktif") + '</small></span>' +
        (yonetici ? '<span class="yp-rozet">🔒 PIN</span>' : "") + '</button>' +
      '<button type="button" class="yp-kapat" id="ypKapat">Kapat</button>';
    el("ypKapat").onclick = kapat;
    el("ypKullanici").onclick = kullaniciGorunum;
    if(yonetici) el("ypYonetici").onclick = function(){ window.location.href = "cihaz-kullanici.html"; };
  }

  function kullaniciGorunum(){
    var d = el("ypDialog"); if(!d) return;
    var ad = "—"; try{ ad = CihazData.benimAdim(); }catch(e){}
    d.innerHTML =
      '<h4>👤 Kullanıcı</h4><p>Bu cihazın bilgisi</p>' +
      '<div class="yp-bilgi"><em>Cihaz adı</em><b>' + esc(ad) + '</b></div>' +
      '<div class="yp-bilgi"><em>Kullanıcı adı</em><b id="ypHesap">…</b></div>' +
      '<div class="yp-bilgi"><em>Durum</em><b id="ypDurum">…</b></div>' +
      '<button type="button" class="yp-kapat" id="ypGeri">‹ Geri</button>';
    el("ypGeri").onclick = anaGorunum;
    try{
      var u = firebase.auth().currentUser;
      var db = firebase.database();
      if(u){
        db.ref("kisitliKullanicilar/" + u.uid + "/kullaniciAdi").once("value").then(function(sn){
          el("ypHesap").textContent = sn.val() || "Yönetici hesabı";
        }).catch(function(){ el("ypHesap").textContent = "—"; });
      } else { el("ypHesap").textContent = "—"; }
      db.ref("cihazlar/" + CihazData.benimIdim()).once("value").then(function(sn){
        var c = sn.val() || {};
        var b = el("ypDurum");
        if(c.engelli){ b.textContent = "Engelli"; b.style.color = "#c0392b"; }
        else if(c.onayDurumu === "bekliyor"){ b.textContent = "Onay bekliyor"; b.style.color = "#8a5a00"; }
        else { b.textContent = "Onaylı"; b.style.color = "#0e6b34"; }
      }).catch(function(){ el("ypDurum").textContent = "—"; });
    }catch(e){ el("ypHesap").textContent = "—"; el("ypDurum").textContent = "—"; }
  }

  document.addEventListener("DOMContentLoaded", function(){
    var btn = el("ayNavCihazKullanici");
    if(!btn) return;
    btn.onclick = function(){ anaGorunum(); el("ypOverlay").hidden = false; };
    var ov = el("ypOverlay");
    ov.addEventListener("click", function(ev){ if(ev.target === ov) kapat(); });
  });
})();
