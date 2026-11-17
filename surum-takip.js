/* İŞ TAKİP — merkezi sürüm/kodlama geçmişi arayüzü.
   Sadece çekmecedeki mevcut sürüm etiketini etkinleştirir; iş verilerine,
   Firebase'e ve diğer uygulama işlevlerine dokunmaz. */
(function(){
  "use strict";
  var KAYIT_URL = "surum-kaydi.json?v=TKP.17.11.26-13:31.1658";
  var CSS_URL = "surum-takip.css?v=TKP.17.11.26-13:31.1658";
  var YEDEK_SURUM = "TKP.17.11.26-13:31.1658";
  var veri = null;
  var overlay = null;

  function metin(el, value){ el.textContent = value == null ? "" : String(value); }
  function eleman(tag, cls, value){
    var el = document.createElement(tag);
    if(cls) el.className = cls;
    if(value != null) metin(el, value);
    return el;
  }
  function linkEkle(parent, url, label){
    if(!url) return;
    var a = eleman("a", "ist-surum-link", label || "GitHub kaydını aç");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    parent.appendChild(a);
  }
  function tarihYazi(kayit){
    return kayit && (kayit.dateTime || kayit.timestamp) || "Tarih kaydı yok";
  }
  function kartEkle(parent, kayit, guncel){
    var kart = eleman("article", guncel ? "ist-surum-kart ist-surum-kart--guncel" : "ist-surum-kart");
    var ust = eleman("div", "ist-surum-kart-ust");
    ust.appendChild(eleman("strong", "ist-surum-id", kayit.id || "Sürüm numarası yok"));
    if(guncel) ust.appendChild(eleman("span", "ist-surum-durum", kayit.deploymentStatus || "Kayıtlı"));
    kart.appendChild(ust);
    kart.appendChild(eleman("div", "ist-surum-tarih", tarihYazi(kayit)));
    kart.appendChild(eleman("h3", "ist-surum-baslik", kayit.title || "Başlıksız güncelleme"));
    if(kayit.summary) kart.appendChild(eleman("p", "ist-surum-aciklama", kayit.summary));
    if(Array.isArray(kayit.changedFiles) && kayit.changedFiles.length){
      kart.appendChild(eleman("div", "ist-surum-alt-baslik", "Değişen dosyalar"));
      kart.appendChild(eleman("p", "ist-surum-dosyalar", kayit.changedFiles.join(" · ")));
    }
    var bag = eleman("div", "ist-surum-baglantilar");
    if(kayit.pullRequestUrl) linkEkle(bag, kayit.pullRequestUrl, kayit.pullRequest || "Pull Request");
    if(kayit.commitUrl) linkEkle(bag, kayit.commitUrl, "Commit kaydı");
    if(bag.childNodes.length) kart.appendChild(bag);
    parent.appendChild(kart);
  }
  function kapat(){
    if(!overlay) return;
    overlay.hidden = true;
    document.body.classList.remove("ist-surum-modal-acik");
  }
  function modalOlustur(){
    if(overlay) return overlay;
    overlay = eleman("div", "ist-surum-overlay");
    overlay.id = "istSurumOverlay";
    overlay.hidden = true;
    overlay.setAttribute("role","presentation");
    var panel = eleman("section", "ist-surum-panel");
    panel.setAttribute("role","dialog");
    panel.setAttribute("aria-modal","true");
    panel.setAttribute("aria-labelledby","istSurumBaslik");
    var ust = eleman("header", "ist-surum-panel-ust");
    var baslik = eleman("div", "ist-surum-panel-baslik");
    baslik.appendChild(eleman("h2", "", "Sürüm ve Kodlama Geçmişi"));
    baslik.lastChild.id = "istSurumBaslik";
    baslik.appendChild(eleman("p", "", "İŞ TAKİP • Güncelleme kayıtları"));
    ust.appendChild(baslik);
    var close = eleman("button", "ist-surum-kapat", "✕");
    close.type = "button";
    close.setAttribute("aria-label","Pencereyi kapat");
    close.addEventListener("click", kapat);
    ust.appendChild(close);
    panel.appendChild(ust);
    var govde = eleman("div", "ist-surum-panel-govde");
    govde.id = "istSurumGovde";
    panel.appendChild(govde);
    overlay.appendChild(panel);
    overlay.addEventListener("click", function(ev){ if(ev.target === overlay) kapat(); });
    document.addEventListener("keydown", function(ev){ if(ev.key === "Escape" && overlay && !overlay.hidden) kapat(); });
    document.body.appendChild(overlay);
    return overlay;
  }
  function ac(){
    var ov = modalOlustur();
    var govde = document.getElementById("istSurumGovde");
    govde.textContent = "";
    if(!veri){
      govde.appendChild(eleman("p","ist-surum-yuklenemedi","Sürüm geçmişi şu anda yüklenemedi. İnternet bağlantısını kontrol edip tekrar deneyin."));
    }else{
      if(veri.current) kartEkle(govde, veri.current, true);
      govde.appendChild(eleman("h3","ist-surum-liste-baslik","Önceki güncellemeler"));
      if(Array.isArray(veri.history) && veri.history.length){
        veri.history.forEach(function(k){ kartEkle(govde,k,false); });
      }else{
        govde.appendChild(eleman("p","ist-surum-yuklenemedi","Henüz önceki sürüm kaydı bulunmuyor."));
      }
      govde.appendChild(eleman("p","ist-surum-not","Her güncellemenin sohbet teslim mesajında aynı sürüm kimliği ve Türkiye saati bulunur. GitHub bağlantıları ilgili kod değişikliğini açar."));
    }
    ov.hidden = false;
    document.body.classList.add("ist-surum-modal-acik");
    var btn = ov.querySelector(".ist-surum-kapat");
    if(btn) btn.focus();
  }
  function etiketiBagla(){
    var etiket = document.getElementById("versiyonEtiketi");
    if(!etiket) return;
    etiket.classList.add("as-drawer-versiyon--tiklanabilir");
    etiket.setAttribute("role","button");
    etiket.setAttribute("tabindex","0");
    etiket.setAttribute("aria-label","Sürüm ve kodlama geçmişini aç");
    etiket.title = "Sürüm geçmişini aç";
    etiket.addEventListener("click",ac);
    etiket.addEventListener("keydown",function(ev){
      if(ev.key === "Enter" || ev.key === " "){ ev.preventDefault(); ac(); }
    });
    metin(etiket, "İŞ TAKİP • " + (veri && veri.current && veri.current.id || YEDEK_SURUM) + "  ›");
  }
  function cssYukle(){
    if(document.querySelector('link[data-ist-surum-css="1"]')) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = CSS_URL;
    link.setAttribute("data-ist-surum-css","1");
    document.head.appendChild(link);
  }
  function baslat(){
    cssYukle();
    etiketiBagla();
    fetch(KAYIT_URL,{cache:"no-store"})
      .then(function(r){ if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); })
      .then(function(json){
        if(!json || !json.current || !json.current.id) throw new Error("Sürüm kaydı biçimi geçersiz");
        veri = json;
        var etiket = document.getElementById("versiyonEtiketi");
        if(etiket) metin(etiket, "İŞ TAKİP • " + json.current.id + "  ›");
        if(window.APP_VERSION !== undefined) window.APP_VERSION = json.current.id;
      })
      .catch(function(err){
        console.warn("Sürüm geçmişi yüklenemedi:",err);
      });
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded",baslat);
  else baslat();
})();
