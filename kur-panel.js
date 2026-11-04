/*
  kur-panel.js — VERSİYON: TKP.04.11.26-18:36.1472
  ================================================
  04.11.2026 (Abdullah onayı — mockup "küçük yüzen kart", Seçenek A):
  EUR kuruna dokununca TCMB'nin "Bugün" döviz kurları sayfası, sağ kenarda
  küçük yüzen bir kartta (iframe) açılır. Alttan kayan pencere DEĞİL.
  - Tek yerden: KurPanel.ac() / KurPanel.kapat().
  - Otomatik bağlanır: .as-kur-panel (Ana Sayfa EUR kur kutusu) ve
    data-kur-panel özniteliği olan her öğe (olay delegasyonu).
  - TCMB siteyi başka bir sayfanın içinde göstermeyi engelliyorsa kart boş
    görünür → kartın başlığındaki ↗ ile tarayıcıda açılır (alt notta yazar).
  - Dışarı dokunma, ✕ veya Esc ile kapanır.
*/
var KurPanel = (function(){
  var TCMB_URL = "https://www.tcmb.gov.tr/wps/wcm/connect/tr/tcmb+tr/main+page+site+area/bugun";
  var IFRAME_GENISLIK = 440; // sayfa bu genişlikte çizilip karta sığacak şekilde küçültülür
  var kok = null;

  function cssEkle(){
    if(document.getElementById("kurPanelCss")) return;
    var st = document.createElement("style");
    st.id = "kurPanelCss";
    st.textContent =
      ".kp-perde{position:fixed;inset:0;z-index:6000;background:rgba(10,20,35,.32);}" +
      ".kp-kart{position:fixed;z-index:6001;right:6px;top:calc(var(--ust-sabit-yukseklik,60px) + 8px);" +
        "width:min(66vw,360px);height:min(62vh,470px);background:#fff;border-radius:12px;overflow:hidden;" +
        "box-shadow:-6px 6px 22px rgba(0,0,0,.38);display:flex;flex-direction:column;}" +
      ".kp-ust{background:#0d3d8c;color:#fff;display:flex;align-items:center;gap:6px;padding:7px 7px 7px 12px;flex-shrink:0;}" +
      ".kp-baslik{flex:1;min-width:0;font-size:11px;font-weight:800;line-height:1.15;}" +
      ".kp-baslik small{display:block;font-size:8.5px;font-weight:500;opacity:.85;}" +
      ".kp-btn{background:rgba(255,255,255,.2);border:none;border-radius:7px;color:#fff;min-width:30px;height:28px;font-size:13px;font-weight:800;padding:0 7px;cursor:pointer;}" +
      ".kp-icerik{position:relative;flex:1;overflow:hidden;background:#f4f6fa;}" +
      ".kp-yukleniyor{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#8a8f98;font-size:12px;font-weight:700;}" +
      ".kp-iframe{position:absolute;top:0;left:0;border:0;background:#fff;transform-origin:0 0;}" +
      ".kp-alt{background:#eef2f8;color:#556170;font-size:8.5px;font-weight:600;padding:4px 8px;border-top:1px solid #dde3ec;flex-shrink:0;}";
    document.head.appendChild(st);
  }

  function olcekle(){
    if(!kok) return;
    var icerik = kok.querySelector(".kp-icerik");
    var fr = kok.querySelector(".kp-iframe");
    if(!icerik || !fr) return;
    var w = icerik.clientWidth, h = icerik.clientHeight;
    var olcek = Math.min(1, w / IFRAME_GENISLIK);
    fr.style.width = IFRAME_GENISLIK + "px";
    fr.style.height = Math.ceil(h / olcek) + "px";
    fr.style.transform = "scale(" + olcek + ")";
  }

  function kapat(){
    if(kok){ kok.remove(); kok = null; }
    document.removeEventListener("keydown", tusDinle);
    window.removeEventListener("resize", olcekle);
  }
  function tusDinle(ev){ if(ev.key === "Escape") kapat(); }

  function ac(){
    try{
      if(kok) return;
      cssEkle();
      kok = document.createElement("div");
      kok.innerHTML =
        "<div class='kp-perde'></div>" +
        "<div class='kp-kart' role='dialog' aria-label='TCMB günlük döviz kurları'>" +
          "<div class='kp-ust'>" +
            "<div class='kp-baslik'>TCMB Günlük Döviz Kurları<small>tcmb.gov.tr</small></div>" +
            "<button type='button' class='kp-btn kp-btn-disari' aria-label='Tarayıcıda aç'>↗</button>" +
            "<button type='button' class='kp-btn kp-btn-kapat' aria-label='Kapat'>✕</button>" +
          "</div>" +
          "<div class='kp-icerik'>" +
            "<div class='kp-yukleniyor'>Yükleniyor…</div>" +
            "<iframe class='kp-iframe' title='TCMB günlük kurlar' referrerpolicy='no-referrer'></iframe>" +
          "</div>" +
          "<div class='kp-alt'>Boş görünürse ↗ tuşuyla tarayıcıda aç.</div>" +
        "</div>";
      document.body.appendChild(kok);
      kok.querySelector(".kp-perde").onclick = kapat;
      kok.querySelector(".kp-btn-kapat").onclick = kapat;
      kok.querySelector(".kp-btn-disari").onclick = function(){ window.open(TCMB_URL, "_blank"); };
      var fr = kok.querySelector(".kp-iframe");
      fr.addEventListener("load", function(){
        var y = kok && kok.querySelector(".kp-yukleniyor");
        if(y) y.style.display = "none";
      });
      olcekle();
      fr.src = TCMB_URL;
      document.addEventListener("keydown", tusDinle);
      window.addEventListener("resize", olcekle);
    }catch(e){ console.error("Kur paneli açılamadı:", e); }
  }

  cssEkle();
  var _st = document.getElementById("kurPanelCss");
  if(_st) _st.textContent += ".as-kur-panel{cursor:pointer;}";

  document.addEventListener("click", function(ev){
    var hedef = ev.target && ev.target.closest ? ev.target.closest(".as-kur-panel,[data-kur-panel]") : null;
    if(hedef){ ev.preventDefault(); ac(); }
  });

  return {ac: ac, kapat: kapat};
})();
