/*
  kur-panel.js — VERSİYON: TKP.11.11.26-00:01.1559
  ================================================
  04.11.2026 (Abdullah onayı — mockup, Seçenek B): EUR kuruna dokununca sağ
  kenarda küçük yüzen kartta GÜNÜN DÖVİZ KURLARI (programın kendi tablosu) açılır.
  Alttan kayan pencere DEĞİL. (TCMB sitesini iframe'e gömmek TCMB tarafından
  engelleniyor — "bağlanmayı reddetti" — o yüzden sayfa değil veri gösterilir.)
  - Tek yerden: KurPanel.ac() / KurPanel.kapat().
  - Ana Sayfa: #dovizSabitPanel içine SABİT (hep açık) EUR+USD paneli çizilir
    (KurPanel.sabitPanelKur, 09.11.2026). Eski .as-kur-panel kutusu kalktı.
  - Otomatik bağlanır: data-kur-panel özniteliği olan her öğe (olay delegasyonu); Sepet'teki
    "TCMB Günlük Kur" tuşu da KurPanel.ac() çağırır.
  - VERİ KAYNAĞI (sırayla): 1) TCMB today.xml (alış/satış, bülten tarihi)
    2) Frankfurter (ECB, tek kur — alış "—", satış sütununda gösterilir ve
    kartın altına kaynak yazılır) 3) önbellek (son başarılı okuma).
  - ↗ tuşu TCMB'nin tam listesini tarayıcıda açar.
  - Dışarı dokunma, ✕ veya Esc ile kapanır.
*/
var KurPanel = (function(){
  var TCMB_SAYFA = "https://www.tcmb.gov.tr/wps/wcm/connect/tr/tcmb+tr/main+page+site+area/bugun";
  var TCMB_XML = "https://www.tcmb.gov.tr/kurlar/today.xml";
  var YEDEK_EK = 0.05;
  var FRANKFURTER = "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=TRY,USD,GBP,CHF,JPY,SAR";
  var ONBELLEK_ANAHTAR = "weicon_kur_panel_onbellek";
  var ZAMAN_ASIMI_MS = 5000;
  var TAZE_MS = 5 * 60 * 1000;

  // Gösterilecek dövizler (sıra bu sıra). unit: TCMB birimi (JPY 100).
  var DOVIZLER = [
    {kod:"EUR", bayrak:"🇪🇺", unit:1},
    {kod:"USD", bayrak:"🇺🇸", unit:1},
    {kod:"GBP", bayrak:"🇬🇧", unit:1},
    {kod:"CHF", bayrak:"🇨🇭", unit:1},
    {kod:"JPY", bayrak:"🇯🇵", unit:100},
    {kod:"SAR", bayrak:"🇸🇦", unit:1}
  ];

  var kok = null;
  var sonVeri = null;      // {kaynak, bulten, alis:{}, satis:{}, zaman}
  var yuklemeNo = 0;

  function cssEkle(){
    if(document.getElementById("kurPanelCss")) return;
    var st = document.createElement("style");
    st.id = "kurPanelCss";
    st.textContent =
      ".as-kur-panel{cursor:pointer;}" +
      /* SABİT DÖVİZ PANELİ (09.11.2026, Abdullah onayı — mockup B): Ana Sayfa'da eski tek satırlık EUR kur kutusunun yerinde, hep açık. */
      /* Mobil ana sayfa döviz şeridi — yalnızca #dovizSabitPanel alanını etkiler. */
      ".dv-sabit{width:100%;box-sizing:border-box;}" +
      ".dv-kart{display:grid;grid-template-columns:minmax(104px,1.08fr) minmax(0,1fr) minmax(0,1fr);align-items:stretch;width:100%;background:#eaf3ff;border:2px solid #1764c0;border-bottom:4px solid #0d3d8c;border-radius:14px;overflow:hidden;box-sizing:border-box;box-shadow:0 2px 5px rgba(12,55,105,.12);}" +
      ".dv-mobil-baslik{display:flex;align-items:center;justify-content:center;gap:5px;padding:8px 7px;background:#0d3d8c;color:#fff;font-size:13.2px;font-weight:900;line-height:1.15;}" +
      ".dv-mobil-baslik span{display:block;}" +
      ".dv-mobil-baslik .dv-btn{background:rgba(255,255,255,.18);border:0;border-radius:6px;color:#fff;min-width:21px;height:23px;font-size:12px;font-weight:800;padding:0 4px;cursor:pointer;flex:0 0 auto;}" +
      ".dv-kurlar{display:contents;}" +
      ".dv-kutu{display:flex;align-items:center;justify-content:center;gap:7px;padding:9px 5px;color:#123b70;min-width:0;background:#f4f9ff;border-bottom:2px solid #8db9e8;}" +
      ".dv-kutu+.dv-kutu{border-left:2px solid #7da9df;}" +
      ".dv-kod{display:inline-flex;align-items:center;gap:4px;font-size:12.6px;font-weight:900;white-space:nowrap;color:#0d3d8c;}" +
      ".dv-bayrak{font-size:19px;line-height:1;display:inline-flex;align-items:center;justify-content:center;filter:saturate(1.2);}" +
      ".dv-kur{font-size:19.2px;font-weight:900;letter-spacing:-.35px;white-space:nowrap;color:#092d62;font-variant-numeric:tabular-nums;}" +
      ".dv-durum{grid-column:1 / -1;padding:10px 6px;text-align:center;font-size:11px;font-weight:700;color:#64748b;background:#f5f9ff;}" +
      ".dv-durum--hata{color:#c0392b;}" +
      "@media (max-width:380px){.dv-kart{grid-template-columns:minmax(94px,1.02fr) minmax(0,1fr) minmax(0,1fr);}.dv-mobil-baslik{font-size:12px;padding:7px 4px;}.dv-kutu{gap:4px;padding:7px 3px;}.dv-kod{font-size:11.4px;}.dv-bayrak{font-size:15.6px;}.dv-kur{font-size:16.8px;letter-spacing:-.5px;}}" +
      ".kp-perde{position:fixed;inset:0;z-index:6000;background:rgba(10,20,35,.32);}" +
      ".kp-kart{position:fixed;z-index:6001;left:1mm;right:1mm;top:calc(var(--ust-sabit-yukseklik,60px) + 8px);" +
        "width:auto;background:#fff;border-radius:12px;overflow:hidden;" +
        "box-shadow:-6px 6px 22px rgba(0,0,0,.38);display:flex;flex-direction:column;max-height:calc(100vh - 80px);}" +
      ".kp-ust{background:var(--renk-mavi,#1257c7);color:#fff;display:flex;align-items:center;gap:6px;padding:7px 7px 7px 12px;flex-shrink:0;}" +
      ".kp-baslik{flex:1;min-width:0;font-size:11px;font-weight:800;line-height:1.15;}" +
      ".kp-baslik small{display:block;font-size:8.5px;font-weight:500;opacity:.85;}" +
      ".kp-btn{background:rgba(255,255,255,.2);border:none;border-radius:7px;color:#fff;min-width:30px;height:28px;font-size:13px;font-weight:800;padding:0 7px;cursor:pointer;}" +
      ".kp-icerik{padding:8px 8px 6px;overflow:auto;background:#fff;}" +
      ".kp-bulten{font-size:9.5px;font-weight:700;color:#556170;margin-bottom:5px;text-align:center;}" +
      ".kp-durum{padding:22px 8px;text-align:center;color:#8a8f98;font-size:12px;font-weight:700;}" +
      ".kp-durum--hata{color:#c0392b;}" +
      ".kp-tablo{width:100%;border-collapse:collapse;font-size:16px;}" +
      ".kp-tablo th{background:#e7f0fc;color:#174b91;font-size:12px;font-weight:900;padding:8px;text-align:right;border-bottom:2px solid #9bbce5;}" +
      ".kp-tablo th:first-child,.kp-tablo td:first-child{text-align:left;}" +
      ".kp-tablo td{padding:13px 8px;border-bottom:2px solid #dce8f7;text-align:right;font-weight:700;color:#003a70;white-space:nowrap;}" +
      ".kp-tablo tr.kp-eur td{background:#fff1d2;font-weight:900;border-bottom:2px solid #e2b64b;}.kp-bayrak{display:inline-block;font-size:20px;line-height:1;vertical-align:middle;margin-right:3px;}" +
      ".kp-alt{background:#eef2f8;color:#556170;font-size:8.5px;font-weight:600;padding:4px 8px;border-top:1px solid #dde3ec;flex-shrink:0;}";
    document.head.appendChild(st);
  }

  function sayiYaz(n){
    if(n == null || isNaN(n)) return "—";
    var kucuk = Math.abs(n) < 1;
    return n.toLocaleString("tr-TR", {minimumFractionDigits: kucuk ? 5 : 4, maximumFractionDigits: kucuk ? 5 : 4});
  }

  function zamanAsimliFetch(url, metinMi){
    var controller = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var t = controller ? setTimeout(function(){ controller.abort(); }, ZAMAN_ASIMI_MS) : null;
    return fetch(url, controller ? {signal: controller.signal} : undefined)
      .then(function(r){ if(!r.ok) throw new Error("HTTP " + r.status); return metinMi ? r.text() : r.json(); })
      .then(function(v){ if(t) clearTimeout(t); return v; }, function(e){ if(t) clearTimeout(t); throw e; });
  }

  // TCMB today.xml → {kaynak, bulten, alis, satis}
  function tcmbAyikla(xmlMetin){
    var dom = new DOMParser().parseFromString(xmlMetin, "text/xml");
    if(dom.querySelector("parsererror")) throw new Error("XML okunamadı");
    var kokEl = dom.getElementsByTagName("Tarih_Date")[0];
    var tarih = kokEl ? (kokEl.getAttribute("Tarih") || "") : "";
    var bultenNo = kokEl ? (kokEl.getAttribute("Bulten_No") || "") : "";
    var alis = {}, satis = {};
    Array.prototype.forEach.call(dom.getElementsByTagName("Currency"), function(n){
      var kod = n.getAttribute("Kod") || n.getAttribute("CurrencyCode");
      // 10.11.2026 (Abdullah): baz = TCMB sayfasındaki EFEKTİF SATIŞ (BanknoteSelling); yoksa Döviz Satış'a düşer.
      var a = n.getElementsByTagName("ForexBuying")[0], s = n.getElementsByTagName("BanknoteSelling")[0] || n.getElementsByTagName("ForexSelling")[0];
      if(!kod) return;
      alis[kod] = a ? parseFloat(a.textContent.replace(",", ".")) : NaN;
      satis[kod] = s ? parseFloat(s.textContent.replace(",", ".")) : NaN;
    });
    if(!(satis.EUR > 0)) throw new Error("Kur verisi geçersiz");
    return {kaynak:"tcmb", bulten: tarih + (bultenNo ? " · Bülten " + bultenNo : ""), alis: alis, satis: satis, zaman: Date.now()};
  }

  // Frankfurter (base=EUR) → TRY cinsinden tek kur (alış yok)
  function frankfurterAyikla(v){
    var r = v && v.rates;
    if(!r || !(r.TRY > 0)) throw new Error("Kur verisi geçersiz");
    var satis = {EUR: r.TRY}, alis = {};
    ["USD","GBP","CHF","JPY","SAR"].forEach(function(k){
      if(r[k] > 0){
        var birim = k === "JPY" ? 100 : 1;
        satis[k] = r.TRY / r[k] * birim;
      }
    });
    // 10.11.2026 (Abdullah): yedek kaynakta efektif satış yok → EUR ve USD'ye +0,05 eklenir (en fazla 0,05; TCMB efektif satışına yaklaşmak için).
    ["EUR","USD"].forEach(function(k){ if(satis[k] > 0) satis[k] = satis[k] + YEDEK_EK; });
    var tarih = v.date ? v.date.split("-").reverse().join(".") : "";
    return {kaynak:"yedek", bulten: tarih, alis: alis, satis: satis, zaman: Date.now()};
  }

  function onbellekOku(){
    try{ var v = JSON.parse(localStorage.getItem(ONBELLEK_ANAHTAR) || "null"); return v && v.satis ? v : null; }catch(e){ return null; }
  }
  function onbellekYaz(v){
    try{ localStorage.setItem(ONBELLEK_ANAHTAR, JSON.stringify(v)); }catch(e){}
  }

  // Veriyi getirir: cb(veri|null, onbellektenMi)
  function veriGetir(cb){
    if(sonVeri && (Date.now() - sonVeri.zaman) < TAZE_MS){ cb(sonVeri, false); return; }
    zamanAsimliFetch(TCMB_XML, true).then(tcmbAyikla).then(function(v){
      sonVeri = v; onbellekYaz(v); cb(v, false);
    }).catch(function(errTcmb){
      console.error("Kur paneli: TCMB'den okunamadı (CORS/ağ olabilir), yedek deneniyor:", errTcmb);
      zamanAsimliFetch(FRANKFURTER, false).then(frankfurterAyikla).then(function(v){
        sonVeri = v; onbellekYaz(v); cb(v, false);
      }).catch(function(errYedek){
        console.error("Kur paneli: yedek kaynak da okunamadı:", errYedek);
        var o = onbellekOku();
        cb(o, !!o);
      });
    });
  }

  function tabloHtml(v, onbellektenMi){
    var html = "<div class='kp-bulten'>" + (v.bulten || "") + (onbellektenMi ? " · son kayıtlı" : "") + "</div>";
    // 09.11.2026 (Abdullah onayı — mockup): yalnız EUR ve USD, yalnız SATIŞ sütunu (Alış sütunu kalktı).
    html += "<table class='kp-tablo'><thead><tr><th>Döviz</th><th>Satış</th></tr></thead><tbody>";
    DOVIZLER.forEach(function(d){
      if(d.kod !== "EUR" && d.kod !== "USD") return;
      if(!(v.satis[d.kod] > 0)) return;
      html += "<tr" + (d.kod === "EUR" ? " class='kp-eur'" : "") + "><td><span class='kp-bayrak'>" + d.bayrak + "</span> <strong>" + d.kod + "</strong>" + (d.unit > 1 ? " (" + d.unit + ")" : "") + "</td>
        + "<td>" + sayiYaz(v.satis[d.kod]) + "</td></tr>";
    });
    html += "</tbody></table>";
    return html;
  }

  var SURUM = "1473";
  function altNotYaz(v, onbellektenMi){
    var alt = kok && kok.querySelector(".kp-alt");
    if(!alt) return;
    setTimeout(function(){ if(alt) alt.textContent += " · s" + SURUM; }, 0);
    if(!v) alt.textContent = "↗ ile TCMB'nin kur sayfası tarayıcıda açılır.";
    else if(onbellektenMi) alt.textContent = "Kaynak: son kayıtlı veri (bağlantı kurulamadı) · ↗ ile TCMB sayfası";
    else if(v.kaynak === "tcmb") alt.textContent = "Kaynak: TCMB · ↗ ile tüm liste tarayıcıda açılır";
    else alt.textContent = "Kaynak: yedek (TCMB'ye ulaşılamadı) · ↗ ile TCMB sayfası";
  }

  function kapat(){
    yuklemeNo++;
    if(kok){ kok.remove(); kok = null; }
    document.removeEventListener("keydown", tusDinle);
  }
  function tusDinle(ev){ if(ev.key === "Escape") kapat(); }

  function ac(){
    try{
      if(kok) return;
      cssEkle();
      kok = document.createElement("div");
      kok.innerHTML =
        "<div class='kp-perde'></div>" +
        "<div class='kp-kart' role='dialog' aria-label='Günün döviz kurları'>" +
          "<div class='kp-ust'>" +
            "<div class='kp-baslik'>Günün Döviz Kurları<small>TCMB</small></div>" +
            "<button type='button' class='kp-btn kp-btn-disari' aria-label='TCMB sayfasını tarayıcıda aç'>↗</button>" +
            "<button type='button' class='kp-btn kp-btn-kapat' aria-label='Kapat'>✕</button>" +
          "</div>" +
          "<div class='kp-icerik'><div class='kp-durum'>Kurlar yükleniyor…</div></div>" +
          "<div class='kp-alt'></div>" +
        "</div>";
      document.body.appendChild(kok);
      kok.querySelector(".kp-perde").onclick = kapat;
      kok.querySelector(".kp-btn-kapat").onclick = kapat;
      kok.querySelector(".kp-btn-disari").onclick = function(){ window.open(TCMB_SAYFA, "_blank"); };
      altNotYaz(null, false);
      document.addEventListener("keydown", tusDinle);

      var no = ++yuklemeNo;
      veriGetir(function(v, onbellektenMi){
        if(no !== yuklemeNo || !kok) return; // panel kapandı / yeniden açıldı
        var icerik = kok.querySelector(".kp-icerik");
        if(!v){
          icerik.innerHTML = "<div class='kp-durum kp-durum--hata'>Kurlar şu an alınamadı.<br>İnternet bağlantını kontrol et ya da ↗ ile TCMB sayfasını aç.</div>";
          altNotYaz(null, false);
          return;
        }
        icerik.innerHTML = tabloHtml(v, onbellektenMi);
        altNotYaz(v, onbellektenMi);
      });
    }catch(e){ console.error("Kur paneli açılamadı:", e); }
  }

  // ---------- SABİT PANEL (Ana Sayfa) ----------
  // 09.11.2026 (Abdullah onayı — mockup B): pencere yerine sayfaya yerleşik, hep açık panel.
  // Yalnız EUR + USD (satış). Kaynak TCMB ise "TCMB", yedekse "yedek kaynak" yazar — yanıltıcı
  // etiket yok. Veri 5 dk önbellekli (veriGetir); sayfa öne gelince / 5 dk'da bir tazelenir.
  function sabitPanelKur(){
    var alan = document.getElementById("dovizSabitPanel");
    if(!alan) return;
    cssEkle();
    alan.innerHTML =
      "<div class='dv-kart' role='group' aria-label='Günün döviz kurları'>" +
        "<div class='dv-mobil-baslik'><span class='dv-logo' aria-hidden='true'>💱</span><span>Günün Döviz<br>Kurları</span>" +
          "<button type='button' class='dv-btn' aria-label='TCMB sayfasını tarayıcıda aç'>↗</button>" +
        "</div>" +
        "<div class='dv-kurlar'><div class='dv-durum'>Kurlar yükleniyor…</div></div>" +
      "</div>";
    alan.querySelector(".dv-btn").onclick = function(){ window.open(TCMB_SAYFA, "_blank"); };

    function ciz(v, onbellektenMi){
      var iki = alan.querySelector(".dv-kurlar");
      if(!iki) return;
      if(!v){
        iki.innerHTML = "<div class='dv-durum dv-durum--hata'>Kurlar şu an alınamadı. İnternet bağlantını kontrol et.</div>";
        return;
      }
      var html = "";
      DOVIZLER.forEach(function(d){
        if(d.kod !== "EUR" && d.kod !== "USD") return;
        if(!(v.satis[d.kod] > 0)) return;
        html += "<div class='dv-kutu'><span class='dv-kod'><span class='dv-bayrak'>" + d.bayrak + "</span>" + d.kod + "</span><span class='dv-kur'>" + sayiYaz(v.satis[d.kod]) + "</span></div>";
      });
      iki.innerHTML = html || "<div class='dv-durum dv-durum--hata'>Kur verisi bulunamadı.</div>";
    }
    function yukle(){ veriGetir(ciz); }
    yukle();
    setInterval(yukle, TAZE_MS);
    document.addEventListener("visibilitychange", function(){ if(!document.hidden) yukle(); });
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", sabitPanelKur);
  else sabitPanelKur();

  cssEkle();
  document.addEventListener("click", function(ev){
    var hedef = ev.target && ev.target.closest ? ev.target.closest(".as-kur-panel,[data-kur-panel]") : null;
    if(hedef){ ev.preventDefault(); ac(); }
  });

  return {ac: ac, kapat: kapat, sabitPanelKur: sabitPanelKur};
})();
