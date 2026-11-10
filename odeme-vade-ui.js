/*
  odeme-vade-ui.js — TKP.10.11.26-10:27.1539
  ===========================================
  ÖDEME · VADE müşteri alanı (10.11.2026, Abdullah onayı — mockup). TEK YERDE:
  Vade Takip sayfasında bir müşteriye dokununca açılan alan VE Cari Bilgi
  sayfasında VADE paneline dokununca açılan pencerenin içeriği AYNI koddan
  çizilir — not, sıralama ve görüşme geçmişi iki yerde birebir aynıdır.

  İçerik (yukarıdan aşağıya):
    1) Özet: açık fatura sayısı · gecikmiş sayısı · toplam
    2) TEK SATIR: Açıklama + "🔔 Tarih seç" (küçük takvim) + ✓ Kaydet
       → müşterinin temas geçmişine "ödeme planı" (odeme:true) olarak yazılır
         (bkz. VadeTakip.planKaydet) — Müşteri Kartı temas geçmişinde ve Ana
         Sayfa takviminde de görünür; ayrı veri alanı yoktur.
    3) Önceki görüşmeler (en yeni üstte)
    4) Faturalar: ödeme tarihine göre (en çok geciken üstte, ödenenler en altta)
       Rozete dokununca ödendi/geri al (VadeTakipUI.baglaRozetler)

  Bağımlılıklar: VadeTakip, VadeTakipUI, CustomerData, TarihSecici.
*/
var OdemeVadeUI = (function(){

  var AYLAR = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  var GUN_ADLARI = ["Paz","Pzt","Sal","Çar","Per","Cum","Cmt"];
  var TUR = {ziyaret:"📍 Ziyaret", telefon:"📞 Telefon", mail:"📧 Mail", whatsapp:"💬 WhatsApp"};
  var taslak = {};   // müşteri anahtarı -> {not, tarih} (yeniden çizimde yazılan metin kaybolmasın)

  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function fmt(n){ return (n||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function anahtarTs(a){ var p = String(a).split("-"); return new Date(+p[0], +p[1]-1, +p[2]); }
  function tarihKisa(d){ return d.getDate() + " " + AYLAR[d.getMonth()]; }
  function tarihUzun(ts){ var d = new Date(ts); return d.getDate() + " " + AYLAR[d.getMonth()] + " " + d.getFullYear(); }
  function planEtiketi(anahtar){ var d = anahtarTs(anahtar); return GUN_ADLARI[d.getDay()] + " " + tarihKisa(d); }
  function saat(ts){ var d = new Date(ts); return tarihKisa(d) + " " + String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0"); }
  function anahtar(id, ad){ return id ? "id:" + id : "ad:" + String(ad||"").toLocaleLowerCase("tr-TR").trim(); }

  function rozetYazisi(o){
    if(o.odendi) return "✓ ÖDENDİ ↗";
    if(o.durum === "gecti") return o.farkGun + " GÜN GECİKTİ ↗";
    if(o.durum === "bugun") return "BUGÜN VADESİ ↗";
    return (-o.farkGun) + " GÜN KALDI ↗";
  }

  function faturaSatiri(o){
    var meta = VadeTakipUI.ROZET_META[o.odendi ? "odendi" : o.durum] || VadeTakipUI.ROZET_META.vadesiz;
    return "<div class='vt-satir'>"
      + "<div class='vt-serit' style='background:" + meta.serit + ";'></div>"
      + "<div class='vt-govde'>"
      +   "<div class='vt-ust'><span class='ov-od'>📅 Ödeme " + tarihUzun(o.vadeTs) + "</span>"
      +     "<span class='vt-rozet" + (o.odendi ? " vt-rozet--odendi" : "") + "' data-ts='" + o.ts + "' data-odendi='" + (o.odendi ? "1" : "0") + "' style='background:" + meta.bg + ";color:" + meta.renk + ";'>" + rozetYazisi(o) + "</span></div>"
      +   "<div class='vt-alt'><span class='vt-kod'>" + esc(o.kod) + " · " + tarihUzun(o.kesimTs) + "</span><span class='vt-tutar'>" + fmt(o.tutar) + " EURO</span></div>"
      + "</div></div>";
  }

  // Fatura sırası: açıklar önce — en çok geciken üstte → en uzak vade altta; ödenenler en altta (en yeni üstte)
  function faturaSirala(ogeler){
    var vadeli = ogeler.filter(function(o){ return o.durum !== "vadesiz"; });
    var acik = vadeli.filter(function(o){ return !o.odendi; }).sort(function(a,b){ return b.farkGun - a.farkGun; });
    var odenen = vadeli.filter(function(o){ return o.odendi; }).sort(function(a,b){ return b.ts - a.ts; });
    return acik.concat(odenen);
  }

  function icerikHTML(musteriId, musteriAd){
    var k = anahtar(musteriId, musteriAd);
    var t = taslak[k] || {not:"", tarih:""};
    var ogeler = VadeTakip.musteriIcin(musteriId, musteriAd);
    var sirali = faturaSirala(ogeler);
    var acik = sirali.filter(function(o){ return !o.odendi; });
    var gecikmis = acik.filter(function(o){ return o.durum === "gecti"; }).length;
    var toplam = acik.reduce(function(s,o){ return s + o.tutar; }, 0);
    var h = "<div class='ov-ozet'><span>" + acik.length + " açık fatura" + (gecikmis ? " · <b>" + gecikmis + " gecikmiş</b>" : "") + "</span><em>" + fmt(toplam) + " EURO</em></div>";
    h += "<div class='ov-form'>"
      + "<input type='text' class='ov-not' placeholder='Açıklama (müşteri ne dedi?)' autocomplete='off' value='" + esc(t.not) + "'>"
      + "<button type='button' class='ov-tarih" + (t.tarih ? " ov-tarih--secili" : "") + "'>" + (t.tarih ? "🔔 " + planEtiketi(t.tarih) : "🔔 Tarih seç") + "</button>"
      + "<button type='button' class='ov-ok' aria-label='Kaydet'" + ((t.not || t.tarih) ? "" : " hidden") + ">✓</button>"
      + "</div>";
    var temaslar = VadeTakip.musteriTemaslari(musteriId, musteriAd);
    if(temaslar.length){
      h += "<div class='ov-gec'><div class='ov-b'>Önceki görüşmeler · en yeni üstte</div>";
      temaslar.forEach(function(z){
        h += "<div class='ov-s'>" + (z.not ? "“" + esc(z.not) + "”" : "<i>(açıklama yok)</i>")
          + "<small>" + (TUR[z.tur] || TUR.ziyaret) + " · " + saat(z.ts) + (z.hatirlatmaTarihi ? " · 🔔 " + tarihKisa(anahtarTs(z.hatirlatmaTarihi)) : "") + "</small></div>";
      });
      h += "</div>";
    }
    h += "<div class='ov-fb'>Faturalar · ödeme tarihine göre</div>";
    h += sirali.length ? "<div class='vt-grup ov-faturalar'>" + sirali.map(faturaSatiri).join("") + "</div>"
      : "<div class='ov-bos'>Bu müşteride vade günü tanımlı fatura yok.</div>";
    return h;
  }

  // kok: içeriğin çizileceği element. yenidenCiz: veri değişince çağrılır (ödendi, kayıt vb.)
  function ciz(kok, musteriId, musteriAd, yenidenCiz){
    kok.innerHTML = icerikHTML(musteriId, musteriAd);
    var k = anahtar(musteriId, musteriAd);
    var notEl = kok.querySelector(".ov-not"), tarihBtn = kok.querySelector(".ov-tarih"), okBtn = kok.querySelector(".ov-ok");
    function okGuncelle(){
      var t = taslak[k] || {};
      okBtn.hidden = !(t.not || t.tarih);
    }
    notEl.addEventListener("input", function(){
      var t = taslak[k] = taslak[k] || {not:"", tarih:""};
      t.not = notEl.value.trim() ? notEl.value : "";
      okGuncelle();
    });
    tarihBtn.addEventListener("click", function(ev){
      ev.stopPropagation();
      var t = taslak[k] = taslak[k] || {not:"", tarih:""};
      TarihSecici.ac({ankaj: tarihBtn, secili: t.tarih || null, secildi: function(a){
        t.tarih = a;
        tarihBtn.textContent = "🔔 " + planEtiketi(a);
        tarihBtn.classList.add("ov-tarih--secili");
        okGuncelle();
      }});
    });
    okBtn.addEventListener("click", function(){
      var t = taslak[k] || {};
      okBtn.disabled = true;
      VadeTakip.planKaydet(musteriId, musteriAd, (t.not || "").trim(), t.tarih || null, function(basarili, err){
        okBtn.disabled = false;
        if(!basarili){
          var m = "Ödeme notu kaydedilemedi: " + (err && err.message ? err.message : "bilinmeyen hata");
          if(typeof hataGoster === "function") hataGoster(m); else alert(m);
          return;
        }
        delete taslak[k];
        if(typeof yenidenCiz === "function") yenidenCiz();
      });
    });
    VadeTakipUI.baglaRozetler(kok, yenidenCiz);
  }

  // Son İşlemler / İşlem Geçmişi satırı için: "Son ödeme: 12 Kas 2026 · 2 gün kaldı" etiketi (oge = VadeTakip.odemeBilgisiFn()(kayit))
  function odemeEtiketiHTML(o){
    if(!o) return "";
    if(o.odendi) return "<span class='ov-etiket ov-etiket--odendi'>✓ Ödendi</span>";
    var sinif = o.durum === "gecti" ? "k" : (o.durum === "var" ? "y" : "t");
    var yazi = o.durum === "gecti" ? (o.farkGun + " gün gecikti") : (o.durum === "bugun" ? "bugün" : ((-o.farkGun) + " gün kaldı"));
    return "<span class='ov-etiket ov-etiket--" + sinif + "'>📅 Son ödeme: " + tarihUzun(o.vadeTs) + " · " + yazi + "</span>";
  }

  // KALAN/GEÇEN GÜN YAZISI (10.11.2026, Abdullah onayı): Belge Önizleme "ÖDEME GÜNÜ" panelinin satır sonu.
  function kalanMetni(o){
    if(!o) return {yazi:"", sinif:""};
    if(o.odendi) return {yazi:"✓ Ödendi", sinif:"o"};
    if(o.durum === "gecti") return {yazi: o.farkGun + " gün geçti", sinif:"k"};
    if(o.durum === "bugun") return {yazi:"bugün", sinif:"t"};
    return {yazi: (-o.farkGun) + " gün kaldı", sinif: o.durum === "yaklasiyor" ? "t" : "y"};
  }

  // TEK POPUP (10.11.2026): Cari Bilgi VADE paneli ve Belge Önizleme ÖDEME GÜNÜ paneli aynı pencereyi açar.
  // Şeridin (serit) HEMEN altında, sol/sağ 8px, dışına dokunmak kapatır; ok, ankaj elementinin ortasını gösterir.
  var pop = null;
  function popupKapat(){
    if(!pop) return false;
    if(typeof TarihSecici !== "undefined") TarihSecici.kapat();
    pop.dim.remove(); pop.el.remove(); pop = null;
    return true;
  }
  function popupCiz(){
    if(!pop) return;
    var o = pop.o;
    ciz(pop.icerik, o.musteriId || null, o.musteriAd, function(){ popupCiz(); if(typeof o.degisti === "function") o.degisti(); });
  }
  function popupAc(o){
    if(pop){ popupKapat(); return; }
    var dim = document.createElement("div"); dim.className = "ov-dim";
    var el = document.createElement("div"); el.className = "ov-pop";
    var icerik = document.createElement("div"); el.appendChild(icerik);
    var sr = o.serit.getBoundingClientRect(), ar = (o.ankaj || o.serit).getBoundingClientRect();
    el.style.left = "8px"; el.style.right = "8px";
    el.style.top = (sr.bottom + window.pageYOffset + 12) + "px";
    el.style.setProperty("--ov-ok", Math.max(14, ar.left + ar.width / 2 - 8 - 6) + "px");
    document.body.appendChild(dim); document.body.appendChild(el);
    dim.onclick = popupKapat;
    pop = {dim: dim, el: el, icerik: icerik, o: o};
    popupCiz();
  }

  return {popupAc: popupAc, popupKapat: popupKapat, popupCiz: popupCiz, popupAcikMi: function(){ return !!pop; }, kalanMetni: kalanMetni,
    icerikHTML: icerikHTML, ciz: ciz, odemeEtiketiHTML: odemeEtiketiHTML, planEtiketi: planEtiketi, tarihKisa: tarihKisa, anahtarTs: anahtarTs, tarihUzun: tarihUzun};
})();
