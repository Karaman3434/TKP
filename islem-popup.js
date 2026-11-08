/*
  islem-popup.js — TKP.08.11.26-23:35.1519 (YENİ DOSYA, 08.11.2026)
  ============================================================
  "İŞLEM YAP" YENİ ROTASI (Abdullah'ın yazdığı ve onayladığı rota):
    1) Müşteri ara, bul, seç          2) Müşteri işlem kartı (hızlı pencere) açılır
    3) İşlem Yap seçilir              4) Cari kart POPUP olarak açılır
    5) İşlemde kullanılacak seçenek VARSA: fatura adresi (tekli), teslimat
       adresi (tekli), yetkili kişi (tekli VEYA çoklu) burada seçilir
    6) Popup'taki İŞLEM SEÇ butonu → küçük açılır liste (Numune / Fiyat Teklifi /
       Proforma Fatura / Sipariş)
    7) Tip seçilince normal rota (açık belge kontrolü → cart.html) devam eder.

  - Kapat / Devam Et butonu YOK: popup'ın dışına dokunmak kapatır, tip seçmek
    rotayı kendiliğinden ilerletir. Alttan açılan pencere YOK (ortada popup,
    tip listesi İŞLEM SEÇ butonuna bağlı küçük açılır liste).
  - Bir alanda gerçek seçim yoksa (tek adres / tek yetkili) o alan hiç sorulmaz,
    otomatik ilk kayıt kullanılır — popup'ta sadece müşteri başlığı + İŞLEM SEÇ kalır.
  - Seçimler weiconv2_secili_iletisim'e {fatura, teslimat, yetkili, yetkililer}
    olarak yazılır (yetkili = ilk seçilen indeks, yetkililer = tüm seçilenler) —
    Sepet / Gönder / Belge Önizleme bunu zaten okuyor (bkz. cart-render.js
    adresleriBelirle). Gönder'deki "Değiştir" aynen duruyor.
  - TEK KAYNAK: customer-render.js, menu-cekmece.js ve belge-render.js'teki üç
    "İşlem Yap" girişi de bu modülü çağırır; tip seçildikten sonra ne olacağı
    (açık belge kontrolü, dönüş rotası bayrakları) her girişin kendi devam
    fonksiyonunda kalır.

  KONUM (08.11.2026, Abdullah onayı — "Tasarım 3"): çağıran taraf açık olan işlem kartının
  (hızlı pencere) konumunu verir; kart kaybolur, popup AYNI yerde ve KART GENİŞLİĞİNDE
  açılır. İŞLEM SEÇ listesi popup'ın üstüne biner: yarısı popup'ın üstünde, yarısı dışında,
  üst kenarı popup ile aynı hizada (ekrana sığmazsa sağ kenara yaslanır). Popup kapanınca
  (dışına dokunma / tip seçme) kart geri gelir.

  DIŞA AÇILAN: IslemPopup.ac(musteri, tipSecilince(tip), {kart: <işlem kartı elemanı>})
*/
var IslemPopup = (function(){

  var TIPLER = [
    {tip:"numune",   ikon:"🧪", renk:"#b7601f", zemin:"#faeeda"},
    {tip:"teklif",   ikon:"💬", renk:"#0e6b34", zemin:"#eafaf0"},
    {tip:"proforma", ikon:"🧾", renk:"#8e44ad", zemin:"#f6f0fd"},
    {tip:"siparis",  ikon:"📦", renk:"#3569b8", zemin:"#f0f7ff"}
  ];

  var kok = null;

  function esc(s){
    return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
    });
  }

  function stilEkle(){
    if(document.getElementById("ipStil")) return;
    var st = document.createElement("style");
    st.id = "ipStil";
    st.textContent =
      ".ip-arka{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(10,25,50,.5);z-index:9500}"
    + ".ip-pop{position:fixed;left:14px;width:250px;max-width:calc(100vw - 28px);top:84px;margin:0;max-height:calc(100vh - 110px);display:flex;flex-direction:column;background:#fff;border:2px solid #073B70;border-radius:14px;box-shadow:0 8px 26px rgba(0,0,0,.35);z-index:9501;font-family:inherit}"
    + ".ip-baslik{flex:none;background:#e8eef7;border-radius:12px 12px 0 0;padding:8px 12px;border-bottom:1.5px solid #c9d6e8}"
    + ".ip-kod{color:#c0392b;font-weight:800;font-size:13px}"
    + ".ip-ad{color:#0a2f5c;font-weight:800;font-size:15px;line-height:1.25}"
    + ".ip-sehir{color:#556170;font-weight:600;font-size:12px}"
    + ".ip-icerik{flex:1 1 auto;min-height:0;overflow-y:auto;padding:2px 6px 0;-webkit-overflow-scrolling:touch}"
    + ".ip-etiket{display:flex;align-items:center;gap:8px;margin:8px 0 3px;color:#16a085;font-weight:800;font-size:12px;letter-spacing:.3px}"
    + ".ip-etiket small{font-weight:700;font-size:11.5px;color:#667085;letter-spacing:0}"
    + ".ip-satir{display:flex;align-items:center;gap:7px;padding:5px 6px;border-radius:8px;cursor:pointer;-webkit-tap-highlight-color:transparent}"
    + ".ip-satir--on{background:#e6f0fb}"
    + ".ip-isaret{flex:none;width:20px;height:20px;box-sizing:border-box;border:2px solid #9aa6b5;border-radius:50%;display:flex;align-items:center;justify-content:center}"
    + ".ip-isaret--kare{border-radius:6px}"
    + ".ip-satir--on .ip-isaret{border-color:#073B70}"
    + ".ip-satir--on .ip-isaret--daire::after{content:'';width:11px;height:11px;border-radius:50%;background:#073B70}"
    + ".ip-satir--on .ip-isaret--kare{background:#073B70}"
    + ".ip-satir--on .ip-isaret--kare::after{content:'';width:5px;height:10px;border:solid #fff;border-width:0 3px 3px 0;transform:rotate(45deg) translate(-1px,-1px)}"
    + ".ip-metin{min-width:0}"
    + ".ip-ana{font-size:13px;font-weight:600;color:#1a2a3a;line-height:1.25;word-break:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}"
    + ".ip-alt{font-size:11.5px;color:#667085;word-break:break-word}"
    + ".ip-not{padding:10px 4px 4px;font-size:13px;color:#556170}"
    + ".ip-alt-alan{flex:none;padding:8px 6px 8px;position:relative}"
    + ".ip-islem{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:44px;border:0;border-radius:10px;background:#073B70;color:#fff;font-family:inherit;font-weight:800;font-size:15px;line-height:1;letter-spacing:.6px;cursor:pointer}"
    + ".ip-islem svg{width:18px;height:18px}"
    + ".ip-tipler{position:fixed;z-index:9502;background:#fff;border:1.5px solid #073B70;border-radius:12px;padding:8px;box-shadow:0 6px 18px rgba(0,30,70,.32);box-sizing:border-box}"
    + ".ip-tipler[hidden]{display:none}"
    + ".ip-tipler-baslik{font-size:11.5px;font-weight:800;color:#556170;margin:2px 4px 6px}"
    + ".ip-tip{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;border:2px solid;border-radius:10px;padding:7px 10px;margin:0 0 6px;font-family:inherit;font-weight:800;font-size:13px;line-height:1.2;cursor:pointer;text-align:left}"
    + ".ip-tip:last-child{margin-bottom:0}"
    + ".ip-tip:active{opacity:.8}"
    + ".ip-ok{position:absolute;width:14px;height:14px;background:#fff;transform:rotate(45deg)}";
    document.head.appendChild(st);
  }

  var IKON = {
    fatura: "<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='#16a085' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M6 2h12v20l-3-2-3 2-3-2-3 2z'/><path d='M9 8h6M9 12h6'/></svg>",
    teslimat: "<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='#16a085' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M1 6h13v10H1zM14 9h5l3 3v4h-8'/><circle cx='6' cy='18' r='2'/><circle cx='17' cy='18' r='2'/></svg>",
    yetkili: "<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='#16a085' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='8' r='4'/><path d='M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7'/></svg>"
  };

  // Hızlı pencereden gelen kayıt eksikse (yalnızca {ad,sehir,id}) tam müşteriyi bul.
  function tamMusteri(m){
    if(!m) return {};
    if(m.faturaAdresleri || m.teslimatAdresleri || m.iletisimler) return m;
    try{
      if(typeof CustomerData !== "undefined" && CustomerData.ara){
        var l = CustomerData.ara("");
        for(var i=0;i<l.length;i++){ if((m.id && l[i].id === m.id) || (!m.id && l[i].ad === m.ad)) return l[i]; }
      }
    }catch(e){}
    return m;
  }

  var kartGeri = null;   // popup kapanınca işlem kartını geri getiren fonksiyon
  function kapat(){
    if(kok && kok.parentNode) kok.parentNode.removeChild(kok);
    kok = null;
    if(kartGeri){ var f = kartGeri; kartGeri = null; try{ f(); }catch(e){} }
  }

  function ac(musteriGelen, tipSecilince, secenek){
    kapat();
    stilEkle();
    var m = tamMusteri(musteriGelen);
    var fat = m.faturaAdresleri || [];
    var tes = m.teslimatAdresleri || [];
    var yet = m.iletisimler || [];
    var secim = { fatura: 0, teslimat: 0, yetkili: [0] };

    var bolumler = [];
    if(fat.length > 1) bolumler.push({alan:"fatura", etiket:"FATURA ADRESİ", ikon:IKON.fatura, kare:false, liste:fat,
      ana:function(k){ return k.adres || k.etiket || "(adres yok)"; }, alt:function(k){ return k.adres ? (k.etiket || "") : ""; }});
    if(tes.length > 1) bolumler.push({alan:"teslimat", etiket:"TESLİMAT ADRESİ", ikon:IKON.teslimat, kare:false, liste:tes,
      ana:function(k){ return k.adres || k.etiket || "(adres yok)"; }, alt:function(k){ return k.adres ? (k.etiket || "") : ""; }});
    if(yet.length > 1) bolumler.push({alan:"yetkili", etiket:"YETKİLİ KİŞİ", ipucu:"çoklu", ikon:IKON.yetkili, kare:true, liste:yet,
      ana:function(k){ return k.isim || "(isimsiz)"; }, alt:function(k){ return k.gorev || ""; }});

    var el = document.createElement("div");
    el.id = "ipKok";
    var icerikHtml = bolumler.map(function(b){
      return "<div class='ip-etiket'>" + b.ikon + esc(b.etiket) + (b.ipucu ? " <small>(" + esc(b.ipucu) + ")</small>" : "") + "</div>"
        + b.liste.map(function(k, i){
          var alt = b.alt(k);
          return "<div class='ip-satir' data-alan='" + b.alan + "' data-i='" + i + "'>"
            + "<span class='ip-isaret " + (b.kare ? "ip-isaret--kare" : "ip-isaret--daire") + "'></span>"
            + "<span class='ip-metin'><div class='ip-ana'>" + esc(b.ana(k)) + "</div>"
            + (alt ? "<div class='ip-alt'>" + esc(alt) + "</div>" : "") + "</span></div>";
        }).join("");
    }).join("");
    if(!bolumler.length) icerikHtml = "<div class='ip-not'>Seçilecek ek bilgi yok — tek adres ve tek yetkili otomatik kullanılır.</div>";

    el.innerHTML =
        "<div class='ip-arka'></div>"
      + "<div class='ip-pop' role='dialog' aria-label='İşlem'>"
      +   "<div class='ip-baslik'>"
      +     "<div class='ip-kod'>" + esc(m.id || "") + "</div>"
      +     "<div class='ip-ad'>" + esc(m.ad || "") + "</div>"
      +     (m.sehir ? "<div class='ip-sehir'>" + esc(m.sehir) + "</div>" : "")
      +   "</div>"
      +   "<div class='ip-icerik'>" + icerikHtml + "</div>"
      +   "<div class='ip-alt-alan'>"
      +     "<button type='button' class='ip-islem' id='ipIslemSec'>İŞLEM SEÇ "
      +       "<svg viewBox='0 0 24 24' fill='none' stroke='#fff' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'><path d='M5 9l7 7 7-7'/></svg></button>"
      +   "</div>"
      + "</div>"
      + "<div class='ip-tipler' id='ipTipler' hidden>"
      +   "<div class='ip-tipler-baslik'>Ne için ürün arıyorsun?</div>"
      +   TIPLER.map(function(t){
            var ad = (typeof TipEtiket !== "undefined") ? TipEtiket.buyukAl(t.tip) : t.tip.toUpperCase();
            return "<button type='button' class='ip-tip' data-tip='" + t.tip + "' style='color:" + t.renk + ";background:" + t.zemin + ";border-color:" + t.renk + "'><span>" + t.ikon + "</span><span>" + esc(ad) + "</span></button>";
          }).join("")
      +   "<div class='ip-ok' id='ipOk'></div>"
      + "</div>";
    document.body.appendChild(el);
    kok = el;

    // İşlem kartının yerine yerleş: kart gizlenir, popup aynı sol/üst konumda ve aynı genişlikte açılır.
    var kart = secenek && secenek.kart;
    if(kart){
      try{
        var kr = kart.getBoundingClientRect();
        if(kr.width > 0){
          var pw = Math.max(190, Math.round(kr.width));
          var pl = Math.max(6, Math.min(Math.round(kr.left), window.innerWidth - 6 - pw));
          var pt = Math.max(8, Math.round(kr.top));
          var pe = el.querySelector(".ip-pop");
          pe.style.left = pl + "px"; pe.style.width = pw + "px"; pe.style.maxWidth = "none";
          pe.style.top = pt + "px"; pe.style.maxHeight = "calc(100vh - " + (pt + 12) + "px)";
          var onceki = kart.style.visibility;
          kart.style.visibility = "hidden";
          kartGeri = function(){ kart.style.visibility = onceki; };
        }
      }catch(e){}
    }

    // Altındaki sayfanın "dışına dokununca kapat" dinleyicileri tetiklenmesin.
    ["click","touchstart","mousedown"].forEach(function(ev){
      el.addEventListener(ev, function(e){ e.stopPropagation(); });
    });

    function secimiBoya(){
      el.querySelectorAll(".ip-satir").forEach(function(s){
        var alan = s.getAttribute("data-alan"), i = parseInt(s.getAttribute("data-i"), 10);
        var acik = alan === "yetkili" ? secim.yetkili.indexOf(i) >= 0 : secim[alan] === i;
        s.classList.toggle("ip-satir--on", acik);
      });
    }
    secimiBoya();

    var tipler = el.querySelector("#ipTipler");
    function tiplerKapat(){ tipler.hidden = true; }
    function tiplerAc(){
      // Liste popup'ın ÜSTÜNE biner: yarısı popup'ın üstünde, yarısı dışında; üst kenarı popup ile aynı hizada.
      var pop = el.querySelector(".ip-pop").getBoundingClientRect();
      var TW = 186;
      tipler.hidden = false;
      tipler.style.width = TW + "px";
      var left = Math.round(pop.left + pop.width - TW / 2);
      if(left + TW > window.innerWidth - 6) left = window.innerWidth - 6 - TW;
      if(left < 6) left = 6;
      tipler.style.left = left + "px";
      tipler.style.top = Math.max(8, Math.round(pop.top)) + "px";
      var ok = el.querySelector("#ipOk");
      if(ok) ok.style.display = "none";
    }

    el.querySelector(".ip-arka").addEventListener("click", kapat);
    el.querySelector("#ipIslemSec").addEventListener("click", function(){
      if(tipler.hidden) tiplerAc(); else tiplerKapat();
    });
    // Açılır liste açıkken popup'ın başka yerine dokunmak önce listeyi kapatır.
    el.querySelector(".ip-pop").addEventListener("click", function(e){
      if(!tipler.hidden && !e.target.closest("#ipIslemSec")) tiplerKapat();
    });
    el.querySelectorAll(".ip-satir").forEach(function(s){
      s.addEventListener("click", function(){
        var alan = this.getAttribute("data-alan"), i = parseInt(this.getAttribute("data-i"), 10);
        if(alan === "yetkili"){
          var k = secim.yetkili.indexOf(i);
          if(k >= 0){ if(secim.yetkili.length > 1) secim.yetkili.splice(k, 1); }   // en az 1 kişi kalır
          else { secim.yetkili.push(i); secim.yetkili.sort(function(a,b){ return a-b; }); }
        } else { secim[alan] = i; }
        secimiBoya();
      });
    });
    el.querySelectorAll(".ip-tip").forEach(function(b){
      b.addEventListener("click", function(){
        var tip = this.getAttribute("data-tip");
        try{
          localStorage.setItem("weiconv2_secili_iletisim", JSON.stringify({
            fatura: secim.fatura, teslimat: secim.teslimat,
            yetkili: secim.yetkili[0], yetkililer: secim.yetkili.slice()
          }));
        }catch(e){}
        kapat();
        if(typeof tipSecilince === "function") tipSecilince(tip);
      });
    });
  }

  return { ac: ac, kapat: kapat };
})();
