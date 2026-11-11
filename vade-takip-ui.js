/*
  vade-takip-ui.js — TKP.11.11.26-15:39.1570
  ======================================
  Fatura Vade Takip satırının HTML'i (Ana Sayfa'dan açılan liste VE Müşteri
  Kartı aynı satır görünümünü kullanır) + rozete dokununca ödendi/geri al.
  Satır İKİ satırdan oluşur: üstte müşteri+rozet, altta belge kodu+tutar.
  Ekstra bir "ödendi işaretle" butonu/satırı YOKTUR — rozetin kendisi
  dokunulabilir alandır.
*/
var VadeTakipUI = (function(){

  var AYLAR = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  function tarihKisa(ts){
    var d = new Date(ts);
    return d.getDate() + " " + AYLAR[d.getMonth()] + " " + d.getFullYear();
  }
  function fmt(n){ return (n||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function esc(s){
    return String(s==null?"":s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }

  var ROZET_META = {
    gecti:      {serit:"#c0392b", bg:"#fbe4e1", renk:"#c0392b"},
    bugun:      {serit:"#b7601f", bg:"#fdeee0", renk:"#b7601f"},
    yaklasiyor: {serit:"#c9a227", bg:"#fdf7dd", renk:"#8a7209"},
    "var":      {serit:"#0f7a3d", bg:"#eef8f2", renk:"#0f7a3d"},
    odendi:     {serit:"#0f7a3d", bg:"#eef8f2", renk:"#0f7a3d"},
    vadesiz:    {serit:"#9aa5b1", bg:"#eef1f5", renk:"#55606c"}
  };

  // DURUM BÖLÜMÜ BAŞLIKLARI — TEK KAYNAK (11.11.2026): genel Fatura Vade Takip listesi (vade-takip-render.js)
  // VE müşterinin Fatura ve Ödeme Takip sayfası (odeme-vade-ui.js musteriSayfasiHTML) aynı başlıkları kullanır.
  var GRUP_BASLIK = {
    gecti:      {yazi: "🔴 VADESİ GEÇTİ", renk: "#c0392b", not: "en uzun gecikme üstte"},
    bugun:      {yazi: "🟠 BUGÜN VADESİ DOLUYOR", renk: "#b7601f", not: ""},
    yaklasiyor: {yazi: "🟡 YAKLAŞIYOR (5 gün içinde)", renk: "#8a7209", not: ""},
    "var":      {yazi: "🟢 VADESİ VAR", renk: "#0f7a3d", not: ""},
    odendi:     {yazi: "✅ ÖDENDİ", renk: "#0f7a3d", not: ""}
  };

  function rozetYazisi(o){
    // Tıklanabilir bilgi kuralı (23.09.2026): sonunda ↗ — dokununca
    // ödendi/geri al olduğu anlaşılsın diye.
    if(o.odendi) return "✓ ÖDENDİ ↗";
    if(o.durum === "gecti") return o.farkGun + " GÜN GECİKTİ ↗";
    if(o.durum === "bugun") return "BUGÜN VADESİ ↗";
    if(o.durum === "yaklasiyor" || o.durum === "var") return (-o.farkGun) + " GÜN KALDI ↗";
    return o.gecenGun + " GÜN ÖNCE KESİLDİ ↗"; // vadesiz
  }

  // opts.gosterMusteri: true ise üst satırda müşteri adı da yazılır
  // (Vade Takip listesi); false ise sadece rozet (Müşteri Kartı — zaten o
  // müşterinin sayfasındayız, adını tekrar yazmaya gerek yok).
  function satirHTML(o, opts){
    opts = opts || {};
    var meta = ROZET_META[o.odendi ? "odendi" : o.durum] || ROZET_META.vadesiz;
    var ustSol = opts.gosterMusteri
      ? "<span class='vt-ad'>" + (o.musteriId ? "<b>" + esc(o.musteriId) + "</b> - " : "") + esc(o.musteri) + "</span>"
      : "<span class='vt-ad vt-ad--bos'></span>";
    return "<div class='vt-satir'>"
      + "<div class='vt-serit' style='background:" + meta.serit + ";'></div>"
      + "<div class='vt-govde'>"
      + "<div class='vt-ust'>" + ustSol
      + "<span class='vt-rozet" + (o.odendi ? " vt-rozet--odendi" : "") + "' data-ts='" + o.ts + "' data-odendi='" + (o.odendi?"1":"0") + "' style='background:" + meta.bg + ";color:" + meta.renk + ";'>" + rozetYazisi(o) + "</span>"
      + "</div>"
      + "<div class='vt-alt'><span class='vt-kod'>" + esc(o.kod) + " · " + tarihKisa(o.kesimTs) + "</span><span class='vt-tutar'>" + (typeof VadeTakip !== "undefined" ? VadeTakip.tutarHTML(o.tutar) : fmt(o.tutar) + " EURO") + "</span></div>"
      + "</div></div>";
  }

  function grupBasligiHTML(baslik, adet, renk){
    return "<div class='vt-grup-baslik' style='color:" + renk + ";'>" + baslik + " — " + adet + " fatura</div>";
  }

  // Bir kök element içindeki tüm .vt-rozet'lere TEK SEFER tıklama
  // dinleyicisi bağlar (event delegation). Dokununca iyimser (optimistic)
  // olarak rozeti değiştirir, arka planda kaydeder; başarısız olursa geri
  // alır ve hata gösterir. Başarılı olunca yenidenCizFn() çağrılır (liste
  // gruplarının değişmesi gerekebilir — örn. ödenen bir kayıt "gecti"
  // grubundan kalkar).
  function baglaRozetler(kokEl, yenidenCizFn){
    kokEl.addEventListener("click", function(ev){
      var rozet = ev.target.closest(".vt-rozet");
      if(!rozet || !kokEl.contains(rozet)) return;
      var ts = parseInt(rozet.getAttribute("data-ts"), 10);
      var suankiOdendi = rozet.getAttribute("data-odendi") === "1";
      var yeni = !suankiOdendi;
      rozet.style.opacity = "0.5";
      VadeTakip.odendiToggle(ts, yeni, function(basarili, err){
        if(!basarili){
          rozet.style.opacity = "1";
          if(typeof hataGoster === "function") hataGoster("Ödeme durumu güncellenemedi: " + (err && err.message ? err.message : "bilinmeyen hata"));
          return;
        }
        if(typeof yenidenCizFn === "function") yenidenCizFn();
      });
    });
  }

  return { satirHTML: satirHTML, grupBasligiHTML: grupBasligiHTML, baglaRozetler: baglaRozetler, ROZET_META: ROZET_META, GRUP_BASLIK: GRUP_BASLIK };

})();
