/*
  odeme-vade-ui.js — TKP.11.11.26-18:32.1577
  ===========================================
  ÖDEME · VADE müşteri alanı (10.11.2026, Abdullah onayı — mockup). TEK YERDE:
  Vade Takip sayfasında bir müşteriye dokununca açılan alan VE Cari Bilgi
  sayfasında VADE paneline dokununca açılan pencerenin içeriği AYNI koddan
  çizilir — not, sıralama ve görüşme geçmişi iki yerde birebir aynıdır.

  İçerik (yukarıdan aşağıya):
    1) Özet: açık fatura sayısı · gecikmiş sayısı · toplam
    2) Faturalar: ödeme tarihine göre (en çok geciken üstte, ödenenler en altta)
       Rozete dokununca ödendi/geri al (VadeTakipUI.baglaRozetler)

  Bağımlılıklar: VadeTakip, VadeTakipUI, CustomerData, TarihSecici.
*/
var OdemeVadeUI = (function(){

  var AYLAR = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  var GUN_ADLARI = ["Paz","Pzt","Sal","Çar","Per","Cum","Cmt"];
  var TUR = {ziyaret:"📍 Ziyaret", telefon:"📞 Telefon", mail:"📧 Mail", whatsapp:"💬 WhatsApp"};

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

  // ------------------------------------------------------------------
  // FATURA AÇIKLAMASI (10.11.2026, Abdullah isteği): kullanıcı bir faturaya dokunup SADECE açıklama yazar.
  // Açıklama bir TEMAS kaydıdır (CustomerData.ziyaretEkle, tur "telefon", faturaTs = sipariş ts'i) —
  // bu yüzden Ana Sayfa günlük temas raporunda / takvimde, Müşteri Kartı temas alanında ve takvimde günün
  // temas listesinde OTOMATİK görünür (ayrı veri alanı yok). Metnin başına "[belge kodu] " eklenir ki her
  // temas listesinde hangi faturayla ilgili olduğu okunsun. Kaydet = üst bar Kaydet, Kapat = üst bar ✕.
  // ------------------------------------------------------------------
  var fn = null;   // açık açıklama formu: {ts, kod, mod:"yeni"|"duzelt", kayitTs, metin, musteriId, musteriAd, yerel, odak}

  function fnHarita(){
    var h = {};
    try{
      ((typeof CustomerData !== "undefined" && CustomerData.tumZiyaretTemaslar) ? CustomerData.tumZiyaretTemaslar() : []).forEach(function(z){
        if(z.faturaTs) (h[z.faturaTs] = h[z.faturaTs] || []).push(z);
      });
      Object.keys(h).forEach(function(k){ h[k].sort(function(a,b){ return (b.ts||0) - (a.ts||0); }); });
    }catch(e){}
    return h;
  }
  function notOnEki(kod){ return kod ? "[" + kod + "] " : ""; }
  function notMetni(z){ var ek = notOnEki(z.faturaKod), n = z.not || ""; return (ek && n.indexOf(ek) === 0) ? n.slice(ek.length) : n; }

  // Bir faturanın açıklamaları (en yeni üstte), TEK kural, her listede aynı:
  //  (a) bu faturaya doğrudan yazılanlar (faturaTs === fatura ts'i) +
  //  (b) faturaya bağlanmamış müşteri geneli ödeme notları ("Açıklama + Tarih seç" satırı, eski notlar dahil):
  //      müşterinin EN ÇOK GECİKEN açık faturasının altında gösterilir (gecikmiş fatura yoksa hiçbirinin altında değil).
  // Kısa süreli bellek: bir listenin satırları aynı veriyi tekrar tekrar hesaplamasın (80 ms).
  var bellek = {t: 0, h: null, m: {}};
  function bellekTaze(){
    var n = Date.now();
    if(!bellek.h || n - bellek.t > 80) bellek = {t: n, h: fnHarita(), m: {}};
    return bellek;
  }
  function musteriNotBilgisi(o){
    var b = bellekTaze(), k = anahtar(o.musteriId, o.musteri);
    if(!b.m[k]){
      var ank = null;
      VadeTakip.musteriIcin(o.musteriId, o.musteri).forEach(function(x){
        if(!x.odendi && x.durum === "gecti" && (!ank || x.farkGun > ank.farkGun)) ank = x;
      });
      b.m[k] = {ankajTs: ank ? ank.ts : null,
        plan: VadeTakip.musteriTemaslari(o.musteriId, o.musteri).filter(function(z){ return z.odeme && !z.faturaTs && z.not; })};
    }
    return b.m[k];
  }
  function faturaNotlari(o){
    var b = bellekTaze(), l = (b.h[o.ts] || []).slice();
    try{ var mb = musteriNotBilgisi(o); if(mb.ankajTs === o.ts) l = l.concat(mb.plan); }catch(e){}
    return l.sort(function(a, c){ return (c.ts || 0) - (a.ts || 0); });
  }

  // kilit=true (müşteri sayfasındaki ÖDENMİŞ fatura): rozet ödendi/geri-al yapmaz, satıra dokunup açıklama yazılmaz,
  // açıklama düzeltilemez; yalnızca mevcut açıklama kaydı silinebilir (🗑 Sil). 11.11.2026, Abdullah isteği.
  function faturaSatiri(o, kilit){
    kilit = !!o.odendi;   // ödenmiş fatura HER yerde kilitli (11.11.2026): yalnız Sil (ödeme kaydını siler, fatura tekrar açılır)
    var nl = faturaNotlari(o), son = nl[0] || null;
    var formAcik = !!(fn && fn.ts === o.ts), duzeltiyor = formAcik && fn.mod === "duzelt", odemePop = formAcik && fn.mod === "odeme";
    var meta = VadeTakipUI.ROZET_META[o.odendi ? "odendi" : o.durum] || VadeTakipUI.ROZET_META.vadesiz;
    return "<div class='vt-satir" + (son ? " vt-satir--notlu" : "") + (o.odendi ? "" : " fn-tikla") + (kilit ? " vt-satir--kilit" : "") + (odemePop ? " vt-satir--odemepop" : "") + "' data-fts='" + o.ts + "' data-fkod='" + esc(o.kod) + "'>"
      + "<div class='vt-serit' style='background:" + meta.serit + ";'></div>"
      + "<div class='vt-govde'>"
      +   "<div class='vt-ust'><span class='ov-od'>📅 Ödeme " + tarihUzun(o.vadeTs) + "</span>"
      +     (son ? "<span class='fn-ikon' title='Açıklama girilmiş'>💬</span>" : "")
      +     "<span class='vt-rozet" + (o.odendi ? " vt-rozet--odendi" : "") + "' data-ts='" + o.ts + "' data-odendi='" + (o.odendi ? "1" : "0") + "'" + (kilit ? " data-kilit='1'" : "") + " style='background:" + meta.bg + ";color:" + meta.renk + ";'>" + (kilit ? "✓ ÖDENDİ" : rozetYazisi(o)) + "</span></div>"
      +   "<div class='vt-alt'><span class='vt-kod'>" + esc(o.kod) + " · " + tarihUzun(o.kesimTs) + "</span><span class='vt-tutar'>" + VadeTakip.tutarHTML(o.tutar) + "</span></div>"
      +   (((son && !duzeltiyor) || kilit)
            ? "<div class='fn-not'><span class='fn-not-y'>" + (son ? "“" + esc(notMetni(son)) + "” <small>· " + tarihKisa(new Date(son.ts)) + (son.hatirlatmaTarihi ? " · 🔔 " + tarihKisa(anahtarTs(son.hatirlatmaTarihi)) : "") + (nl.length > 1 ? " · +" + (nl.length - 1) + " önceki" : "") + "</small>" : "") + "</span>"
              + "<span class='fn-dugmeler'>" + ((kilit || !son) ? "" : "<button type='button' class='fn-duzelt' data-kts='" + son.ts + "'>✎ Düzelt</button>")
              + "<button type='button' class='fn-sil' data-kts='" + (son ? son.ts : 0) + "' aria-label='Sil'>🗑 Sil</button></span></div>"
            : "")
      +   (odemePop
            ? "<div class='fn-form fn-pop'><span class='fn-pop-ok'></span><input type='text' class='fn-input' placeholder='Ödeme notu (nakit, havale, mail order…)' autocomplete='off' value='" + esc(fn.metin) + "'>"
              + "<button type='button' id='ovFnKaydet' class='fn-kaydet-gizli' hidden aria-label='Kaydet'></button></div>"
            : (formAcik
            ? "<div class='fn-form'><input type='text' class='fn-input' placeholder='Bu fatura için açıklama' autocomplete='off' value='" + esc(fn.metin) + "'>"
              + "<button type='button' class='fn-tarih" + (fn.tarih ? " fn-tarih--secili" : "") + "'>" + (fn.tarih ? "🔔 " + planEtiketi(fn.tarih) : "🔔 Tarih seç") + "</button>"
              + "<button type='button' id='ovFnKaydet' class='fn-kaydet-gizli' hidden aria-label='Kaydet'></button></div>"
            : ""))
      + "</div></div>";
  }

  // ÖDEME NOTU penceresi (11.11.2026): rozete dokununca açılan küçük pencere — rozetin hemen altında, dışına dokunmak vazgeçmektir.
  function odemePopYerlestir(kok){
    var pop = kok.querySelector(".fn-pop"), dim = document.getElementById("ovFnDim");
    if(!(fn && fn.mod === "odeme" && pop)){ if(dim) dim.remove(); return; }
    var satir = pop.closest(".vt-satir"), roz = satir && satir.querySelector(".vt-rozet");
    if(roz){
      var sr = satir.getBoundingClientRect(), rr = roz.getBoundingClientRect();
      pop.style.top = (rr.bottom - sr.top + 10) + "px";
      pop.style.setProperty("--ok", Math.max(14, rr.left + rr.width / 2 - sr.left - 8 - 7) + "px");
    }
    if(!dim){
      dim = document.createElement("div"); dim.id = "ovFnDim"; dim.className = "ov-dim ov-dim--hafif";
      dim.addEventListener("click", function(){ fnKapat(); });
      document.body.appendChild(dim);
    }
  }
  function fnSenkron(kok){
    try{
      odemePopYerlestir(kok);
      var b = document.getElementById("ovFnKaydet");
      if(b) b.disabled = !(fn && fn.metin.trim());
      if(fn && fn.odak){
        fn.odak = false;
        var inp = kok.querySelector(".fn-input");
        if(inp){ inp.focus(); try{ inp.setSelectionRange(inp.value.length, inp.value.length); }catch(e){} }
      }
    }catch(e){}
  }
  function fnKapat(){
    if(!fn) return false;
    var yerel = fn.yerel; fn = null;
    var d = document.getElementById("ovFnDim"); if(d) d.remove();
    if(typeof yerel === "function") yerel();
    return true;
  }
  // Pencere/katman kapanırken: formu hiç çizmeden temizle (üst bar Kaydet pasifleşir).
  function fnIptal(){
    fn = null;
    var d = document.getElementById("ovFnDim"); if(d) d.remove();
    Array.prototype.forEach.call(document.querySelectorAll(".fn-form"), function(el){ el.remove(); });
  }
  // Üst bar Kaydet'in tetikleyeceği gizli düğme (form görünürse), yoksa null.
  function fnKaydetHedef(){
    var b = document.getElementById("ovFnKaydet");
    var f = b && b.closest(".fn-form");
    return (f && f.offsetParent) ? b : null;
  }
  function fnKaydet(btn){
    if(!fn || !fn.metin.trim() || btn.disabled) return;
    var f = fn, metin = notOnEki(f.kod) + f.metin.trim();
    btn.disabled = true;
    function bitti(basarili, err){
      btn.disabled = false;
      if(!basarili){
        var m = "Açıklama kaydedilemedi: " + (err && err.message ? err.message : "bilinmeyen hata");
        if(typeof hataGoster === "function") hataGoster(m); else alert(m);
        return;
      }
      if(fn === f) fn = null;
      if(typeof f.tamam === "function") f.tamam();
    }
    // ÖDEME NOTU (11.11.2026, Abdullah isteği): not fatura numarasıyla kaydedilir, ardından fatura ÖDENDİ olur (kilitlenir).
    if(f.mod === "odeme"){
      CustomerData.ziyaretEkle(f.musteriAd, metin, "telefon", null, function(ok, err){
        if(!ok){ bitti(false, err); return; }
        VadeTakip.odendiToggle(f.ts, true, function(ok2, err2){ bitti(!!ok2, err2); });
      }, f.musteriId || undefined, {faturaTs: f.ts, faturaKod: f.kod, odemeNotu: true});
      return;
    }
    // Hatırlatma tarihi seçildiyse kayıt "ödeme planı" sayılır (odeme:true → Vade Takip'te ÖDEME PLANLANDI grubu).
    if(f.mod === "duzelt") CustomerData.ziyaretGuncelle(f.musteriAd, f.kayitTs, {not: metin, hatirlatmaTarihi: f.tarih || null, odemeIsaret: !!f.tarih}, bitti, f.musteriId || undefined);
    else CustomerData.ziyaretEkle(f.musteriAd, metin, "telefon", f.tarih || null, bitti, f.musteriId || undefined, {faturaTs: f.ts, faturaKod: f.kod, odeme: !!f.tarih});
  }
  // Açıklamayı komple sil (iki dokunuş: ilkinde düğme "Silinsin mi?" olur, 4 sn içinde tekrar dokunulursa silinir).
  // Kilitli (ödenmiş) satırda Sil = ödeme notunu siler VE faturayı tekrar AÇIK yapar.
  function fnSil(btn, c){
    var satir = btn.closest(".vt-satir"), kilitli = !!(satir && satir.classList.contains("vt-satir--kilit"));
    if(!btn._onay){
      btn._onay = true; btn.textContent = kilitli ? "Ödeme silinsin mi?" : "Silinsin mi?"; btn.classList.add("fn-sil--onay");
      setTimeout(function(){ if(btn.isConnected){ btn._onay = false; btn.textContent = "🗑 Sil"; btn.classList.remove("fn-sil--onay"); } }, 4000);
      return;
    }
    btn.disabled = true;
    var kts = parseInt(btn.getAttribute("data-kts"), 10) || 0, fts = satir ? parseInt(satir.getAttribute("data-fts"), 10) : 0;
    function sonra(basarili, err){
      if(basarili && kilitli && fts){
        VadeTakip.odendiToggle(fts, false, function(b2, e2){ bitis(b2, e2); });
        return;
      }
      bitis(basarili, err);
    }
    if(!kts){ sonra(true); return; }
    CustomerData.ziyaretSil(c.musteriAd, kts, sonra, c.musteriId || undefined);
    return;
    function bitis(basarili, err){
      if(!basarili){
        btn.disabled = false;
        var m = "Açıklama silinemedi: " + (err && err.message ? err.message : "bilinmeyen hata");
        if(typeof hataGoster === "function") hataGoster(m); else alert(m);
        return;
      }
      if(typeof c.tamam === "function") c.tamam();
    }
  }
  // kok: fatura satırlarını içeren element (bir kez bağlanır; her çizimde bağlam güncellenir).
  // yerelCiz: sadece bu listeyi yeniden çizer (form aç/kapa); tamamCiz: kayıttan sonra (dış değişikliği de bildirir).
  function faturaNotBagla(kok, musteriId, musteriAd, yerelCiz, tamamCiz){
    kok._fnCtx = {musteriId: musteriId, musteriAd: musteriAd, yerel: yerelCiz, tamam: tamamCiz || yerelCiz};
    if(kok._fnBagli){ fnSenkron(kok); return; }
    kok._fnBagli = true;
    function ac(satir, mod, kayitTs){
      var c = kok._fnCtx, ts = parseInt(satir.getAttribute("data-fts"), 10), metin = "", tarih = "";
      var kod = String(satir.getAttribute("data-fkod") || "").split(/\s+/)[0];
      if(mod === "duzelt"){
        var z = ((typeof CustomerData !== "undefined" && CustomerData.tumZiyaretTemaslar) ? CustomerData.tumZiyaretTemaslar() : []).filter(function(k){ return k.ts === kayitTs; })[0];
        metin = z ? notMetni(z) : "";
        tarih = (z && z.hatirlatmaTarihi) || "";
        kod = z ? (z.faturaKod || "") : kod;   // müşteri geneli (faturaya bağlanmamış) notta ön ek yok
      }
      fn = {ts: ts, kod: kod, mod: mod, kayitTs: kayitTs, metin: metin, tarih: tarih,
            musteriId: c.musteriId, musteriAd: c.musteriAd, yerel: c.yerel, tamam: c.tamam, odak: true};
      if(typeof c.yerel === "function") c.yerel();
    }
    kok.addEventListener("click", function(ev){
      var t = ev.target;
      var kay = t.closest && t.closest("#ovFnKaydet");
      if(kay){ fnKaydet(kay); return; }
      var tb = t.closest(".fn-tarih");
      if(tb){
        ev.stopPropagation();
        if(typeof TarihSecici !== "undefined" && fn) TarihSecici.ac({ankaj: tb, secili: fn.tarih || null, secildi: function(a){
          fn.tarih = a; tb.textContent = "🔔 " + planEtiketi(a); tb.classList.add("fn-tarih--secili");
        }});
        return;
      }
      // Açık faturanın rozeti: ödeme notu penceresi (kilitli/ödenmiş rozet hiçbir şey yapmaz)
      var roz = t.closest(".vt-rozet");
      if(roz && !t.closest(".fn-form")){
        ev.stopPropagation();
        if(roz.getAttribute("data-odendi") === "1") return;
        var rs = roz.closest(".vt-satir");
        if(fn && fn.mod === "odeme" && fn.ts === parseInt(rs.getAttribute("data-fts"), 10)){ fnKapat(); return; }
        ac(rs, "odeme", null);
        return;
      }
      var sil = t.closest(".fn-sil");
      if(sil){ fnSil(sil, kok._fnCtx); return; }
      var duz = t.closest(".fn-duzelt");
      if(duz){ ac(duz.closest(".vt-satir"), "duzelt", parseInt(duz.getAttribute("data-kts"), 10)); return; }
      if(t.closest(".fn-form") || t.closest(".vt-rozet") || t.closest(".fn-not")) return;
      var satir = t.closest(".vt-satir.fn-tikla");
      if(!satir) return;
      if(fn && fn.mod === "yeni" && fn.ts === parseInt(satir.getAttribute("data-fts"), 10)){ fnKapat(); return; }
      ac(satir, "yeni", null);
    });
    kok.addEventListener("input", function(ev){
      if(fn && ev.target.classList && ev.target.classList.contains("fn-input")){ fn.metin = ev.target.value; fnSenkron(kok); }
    });
    kok.addEventListener("keydown", function(ev){
      if(ev.key === "Enter" && ev.target.classList && ev.target.classList.contains("fn-input")){
        var b = document.getElementById("ovFnKaydet"); if(b && !b.disabled) b.click();
      }
    });
    fnSenkron(kok);
  }
  // Üst bar Geri (‹) / Kapat (✕): açık açıklama formu varsa ÖNCE onu kapatır, sayfa/pencere
  // kapanmaz (11.11.2026: eski yakalama dinleyicisi yerine ortak Nav katman kapatıcısı).
  document.addEventListener("DOMContentLoaded", function(){
    if(window.Nav) Nav.kapaticiEkle(function(){
      try{
        if(fn && fnKaydetHedef()){ fnKapat(); return true; }
        if(pop){ popupKapat(); return true; }
      }catch(e){}
      return false;
    });
  });

  // Fatura sırası: açıklar önce — en çok geciken üstte → en uzak vade altta; ödenenler en altta (en yeni üstte)
  function faturaSirala(ogeler){
    var vadeli = ogeler.filter(function(o){ return o.durum !== "vadesiz"; });
    var acik = vadeli.filter(function(o){ return !o.odendi; }).sort(function(a,b){ return b.farkGun - a.farkGun; });
    var odenen = vadeli.filter(function(o){ return o.odendi; }).sort(function(a,b){ return b.ts - a.ts; });
    return acik.concat(odenen);
  }

  function icerikHTML(musteriId, musteriAd, odenenGizle){
    // Genel Fatura Vade Takip listesi: ÖDENEN fatura listeden kalkar (11.11.2026, Abdullah isteği) — yalnız açıklar.
    var ogeler = VadeTakip.musteriIcin(musteriId, musteriAd);
    var sirali = faturaSirala(ogeler);
    if(odenenGizle) sirali = sirali.filter(function(o){ return !o.odendi; });
    var acik = sirali.filter(function(o){ return !o.odendi; });
    var gecikmis = acik.filter(function(o){ return o.durum === "gecti"; }).length;
    var toplam = acik.reduce(function(s,o){ return s + o.tutar; }, 0);
    var h = "<div class='ov-ozet'><span>" + acik.length + " açık fatura" + (gecikmis ? " · <b>" + gecikmis + " gecikmiş</b>" : "") + "</span><em>" + VadeTakip.tutarSatirHTML(toplam) + "</em></div>";
    h += "<div class='ov-fb'>Faturalar · ödeme tarihine göre</div>";
    h += sirali.length ? "<div class='vt-grup ov-faturalar'>" + sirali.map(function(o){ return faturaSatiri(o); }).join("") + "</div>"
      : "<div class='ov-bos'>Bu müşteride vade günü tanımlı fatura yok.</div>";
    return h;
  }

  // kok: içeriğin çizileceği element. yenidenCiz: veri değişince çağrılır (ödendi, kayıt vb.)
  function ciz(kok, musteriId, musteriAd, yenidenCiz, odenenGizle){
    kok._ovGizle = !!odenenGizle;
    kok.innerHTML = icerikHTML(musteriId, musteriAd, kok._ovGizle);
    kok._ovYc = yenidenCiz;
    if(!kok._ovRozetBagli){ kok._ovRozetBagli = true; VadeTakipUI.baglaRozetler(kok, function(){ if(typeof kok._ovYc === "function") kok._ovYc(); }); }
    faturaNotBagla(kok, musteriId, musteriAd, function(){ ciz(kok, musteriId, musteriAd, kok._ovYc, kok._ovGizle); }, function(){ if(typeof kok._ovYc === "function") kok._ovYc(); });
  }

  // Son İşlemler / İşlem Geçmişi satırı için: "Son ödeme: 12 Kas 2026 · 2 gün kaldı" etiketi (oge = VadeTakip.odemeBilgisiFn()(kayit))
  function odemeEtiketiHTML(o){
    if(!o) return "";
    var h;
    if(o.odendi) h = "<span class='ov-etiket ov-etiket--odendi'>✓ Ödendi</span>";
    else {
      var sinif = o.durum === "gecti" ? "k" : (o.durum === "var" ? "y" : "t");
      var yazi = o.durum === "gecti" ? (o.farkGun + " gün gecikti") : (o.durum === "bugun" ? "bugün" : ((-o.farkGun) + " gün kaldı"));
      h = "<span class='ov-etiket ov-etiket--" + sinif + "'>📅 Son ödeme: " + tarihUzun(o.vadeTs) + " · " + yazi + "</span>";
    }
    // Faturanın açıklaması her listede aynı (faturaNotlari): işlem satırında da görünür.
    try{ var son = faturaNotlari(o)[0]; if(son) h += "<span class='ov-etiket ov-etiket--not'>💬 “" + esc(notMetni(son)) + "”</span>"; }catch(e){}
    return h;
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
    fn = null;
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

  // FATURA LİSTESİ (10.11.2026, Abdullah onayı): Müşteri Detay → "Fatura ve Ödeme Takip" penceresi de
  // aynı satırları kullanır: ödeme günü + "N GÜN KALDI / N GÜN GECİKTİ" rozeti + belge kodu · kesim tarihi + tutar.
  function faturaListesiHTML(ogeler, kilit){
    var sirali = faturaSirala(ogeler);
    return sirali.length ? "<div class='vt-grup ov-faturalar'>" + sirali.map(function(o){ return faturaSatiri(o, kilit); }).join("") + "</div>" : "";
  }

  // MÜŞTERİ FATURA VE ÖDEME TAKİP SAYFASI (11.11.2026, Abdullah onayı — mockup): genel Fatura Vade Takip listesiyle
  // AYNI düzen — KDV notu şeridi, "N açık fatura · M gecikmiş + toplam" özeti, durum bölümleri (renkli başlık +
  // fatura sayısı) ve her bölümde aynı fatura satırları. Vade günü tanımsız müşteride "" döner (çağıran eski listeye düşer).
  function musteriSayfasiHTML(ogeler, vadeGun){
    var vadeli = ogeler.filter(function(o){ return o.durum !== "vadesiz"; });
    if(!vadeli.length) return "";
    var acik = vadeli.filter(function(o){ return !o.odendi; });
    var gecikmis = acik.filter(function(o){ return o.durum === "gecti"; }).length;
    var toplam = acik.reduce(function(s,o){ return s + o.tutar; }, 0);
    var B = VadeTakipUI.GRUP_BASLIK;
    var h = "<div class='vt-kdv-not' style='margin:2px 4px 8px;padding:6px 10px;font-size:12.5px;font-weight:700;color:#4a5a6e;text-align:center;background:#eef3f9;border-radius:10px;'>"
      + (vadeGun != null ? "Vade " + vadeGun + " gün · " : "") + esc(VadeTakip.kdvNotu()) + "</div>";
    h += "<div class='ov-ozet' style='margin:0 4px 6px;'><span>" + acik.length + " açık fatura" + (gecikmis ? " · <b>" + gecikmis + " gecikmiş</b>" : "") + "</span><em>" + VadeTakip.tutarSatirHTML(toplam) + "</em></div>";
    ["gecti","bugun","yaklasiyor","var","odendi"].forEach(function(id){
      var liste = id === "odendi" ? vadeli.filter(function(o){ return o.odendi; }) : acik.filter(function(o){ return o.durum === id; });
      if(!liste.length) return;
      var b = B[id];
      h += "<div class='vt-grup-baslik vt-grup-baslik--m' style='color:" + b.renk + ";'><span>" + b.yazi + (b.not ? " <small>· " + b.not + "</small>" : "") + "</span><span class='vt-say'>" + liste.length + " fatura</span></div>";
      h += faturaListesiHTML(liste, id === "odendi").replace("vt-grup ov-faturalar", "vt-grup vt-grup--m ov-faturalar");
    });
    return h;
  }

  return {musteriSayfasiHTML: musteriSayfasiHTML, faturaNotBagla: faturaNotBagla, fnKapat: fnKapat, fnIptal: fnIptal, fnKaydetHedef: fnKaydetHedef, faturaListesiHTML: faturaListesiHTML, popupAc: popupAc, popupKapat: popupKapat, popupCiz: popupCiz, popupAcikMi: function(){ return !!pop; }, kalanMetni: kalanMetni,
    icerikHTML: icerikHTML, ciz: ciz, odemeEtiketiHTML: odemeEtiketiHTML, planEtiketi: planEtiketi, tarihKisa: tarihKisa, anahtarTs: anahtarTs, tarihUzun: tarihUzun};
})();
