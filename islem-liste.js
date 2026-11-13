/*
  islem-liste.js — TKP.13.11.26-08:45.1588
  ==========================================================================
  ORTAK İŞLEM LİSTESİ (02.11.2026, Abdullah onayı — "tek tablo, tuş = hazır
  filtre" turu; mockup: Son İşlemler satır tasarımı + arama kutusu yanında
  filtre ikonu + açılır pencere, Tarih düğmesi yanda kalır).

  Son İşlemler, Bugün/Bu Ay Satışları, Ay Detay ve Kaçan Satışlar ekranları
  ARTIK kendi satır/gün bandı/süzme/toplama kodunu taşımaz — hepsi burada,
  TEK yerde. Satır tasarımı, gün bandı, filtre çubuğu, açılır pencere ve
  özet bir kez değişir, her sayfada görünür. "Hangi kayıtlar?" sorusunu da
  ReportsData.islemSorgula() cevaplar (reports-data.js) — burada süzme yok.

  KULLANIM (sayfanın kendi render.js dosyası, ~10 satır):
    IslemListesi.baslat({
      yerId: "islemListesiYeri",       // boş <div> — filtre çubuğu + liste burada kurulur
      taban: {tip:"siparis"},          // VERİ TAVANI (aşağıya bakın)
      hazir: ["bugun","bu_ay"],        // pencerede görünecek hazır tuşlar (id veya {id, etiket})
      baslangicHazir: "bu_ay",         // açılışta hangi hazır tuş uygulansın
      ...
    });

  VERİ TAVANI (taban) — GÜVENLİK KURALI: her sayfa kendi izin anahtarına
  (auth.js SAYFA_IZIN_ANAHTARI) bağlıdır; örn. Satış Listesi yalnızca
  SİPARİŞ gösterir. `taban` içindeki tip/durum/tarihBas/tarihBit değerleri
  her sorguya ZORLA uygulanır ve arayüzde o bölümler gizlenir — kullanıcı
  filtreleri yalnızca bu tavanın İÇİNDE daraltabilir, asla genişletemez.
  Böylece kısıtlı bir kullanıcı, izni olmayan bir veriyi hazır tuş/filtreyle
  göremez. Bu dosya auth.js'e DOKUNMAZ; sayfa erişimi aynen eskisi gibi
  auth.js tarafından denetlenir.

  seçenekler (opts):
    taban            : {tip, durum, tarihBas, tarihBit, ayAd, yil}
    tarihKilitli     : true ise Tarih düğmesi yok (Ay Detay: ay sabit)
    hazir            : ["son","bugun","bu_ay","bu_yil","kacan","bekleyen"] alt kümesi
    baslangicHazir   : yukarıdakilerden biri (varsayılan: hazir[0])
    limit            : en çok kaç kayıt (Son İşlemler: 100)
    siralama         : true ise pencerede "Yeni → Eski / Eski → Yeni" seçeneği
    beklemedeToggle  : true ise "Stok Bekleyenleri dahil et" anahtarı (Ay Detay);
                       kapalıyken stok bekleyen kayıtlar listede görünmez
    beklemedeAnahtar : bu anahtarın localStorage adı
    primFiltresi     : true ise pencerede "PRİM · Primli satışlar" anahtarı görünür (Satış Listesi)
    baslangicPrimli  : true ise liste açılışta sadece primli siparişlerle başlar (ana sayfa "<Ay> primi" dokunuşu)
    bosMesaj         : hiç kayıt yokken yazı
    musteriId / musteriAd : bir müşterinin kayıtlarıyla başlat (İşlem Geçmişi için)
*/
var IslemListesi = (function(){

  // ---- Satır görünümü (Son İşlemler tasarımı — standart) ----------------
  var TIP_META = {
    siparis:  {rozet:TipEtiket.kisa.siparis,    rozetBg:"#a8c5e1", rozetRenk:"#0c447c", serit:"#185fa5"},
    teklif:   {rozet:TipEtiket.kisa.teklif,    rozetBg:"#aadebb", rozetRenk:"#0c5b4b", serit:"#28a745"},
    proforma: {rozet:TipEtiket.kisa.proforma,    rozetBg:"#f8bf92", rozetRenk:"#7e3a06", serit:"#e8690a"},
    numune:   {rozet:TipEtiket.kisa.numune,    rozetBg:"#eba7c0", rozetRenk:"#790e3d", serit:"#c2185b"}
  };
  var RVZ_META = {rozet:"RVZ", rozetBg:"#e6c3a2", rozetRenk:"#714309", serit:"#b7601f"};
  var KACAN_META = {rozet:"KAÇTI", rozetBg:"#fdecea", rozetRenk:"#a32d2d", serit:"#c0392b"};
  var KANAL_HARF = {mail:"M", whatsapp:"W"};
  var KANAL_RENK = {mail:"#185fa5", whatsapp:"#128C7E"};
  var GUNLER = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
  var TIP_ETIKET = TipEtiket.kisa; // 08.11.2026: tek kaynak (tip-etiketleri.js)
  var TARIH_ETIKET = {bugun:"Bugün", bu_hafta:"Bu Hafta", bu_ay:"Bu Ay", bu_yil:"Bu Yıl", ozel:"Özel Aralık"};

  // ---- Hazır tuşlar = hazır filtre ayarları ------------------------------
  var HAZIR = {
    son:      {etiket:"Son İşlemler", tip:"", durum:"",         tarih:"tumu"},
    bugun:    {etiket:"Bugün",        tip:"", durum:"",         tarih:"bugun"},
    bu_ay:    {etiket:"Bu Ay",        tip:"", durum:"",         tarih:"bu_ay"},
    bu_yil:   {etiket:"Bu Yıl",       tip:"", durum:"",         tarih:"bu_yil"},
    kacan:    {etiket:"Kaçanlar",     tip:"", durum:"kacan",    tarih:"tumu"},
    bekleyen: {etiket:"Bekleyenler",  tip:"", durum:"bekleyen", tarih:"tumu"}
  };

  function htmlEsc(s){
    return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }
  function fmt(n){
    return (n||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  function hata(mesaj){
    console.error(mesaj);
    if(typeof HataLog !== "undefined") HataLog.kaydet(mesaj);
    var kutu = document.createElement("div");
    kutu.textContent = "⚠️ " + mesaj;
    kutu.style.cssText = "position:fixed;top:8px;left:8px;right:8px;background:#c0392b;color:#fff;padding:10px;border-radius:8px;font-size:13px;z-index:99999;";
    document.body.appendChild(kutu);
    setTimeout(function(){ kutu.remove(); }, 8000);
  }

  function gunAnahtari(ts){
    var d = new Date(ts);
    return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
  }
  function gunBasligi(ts){
    var d = new Date(ts);
    return String(d.getDate()).padStart(2,"0") + "." + String(d.getMonth()+1).padStart(2,"0") + "." + d.getFullYear() + " • " + GUNLER[d.getDay()];
  }
  function rozetMeta(k){
    if(k.durum === "kacan") return KACAN_META;
    if(k.revizeZamani) return RVZ_META;
    return TIP_META[k.tip] || TIP_META.siparis;
  }
  function kanalHarfHTML(kanal){
    if(!kanal || !KANAL_HARF[kanal]) return "";
    return "<span class='sr-kanal-harf' style='color:" + KANAL_RENK[kanal] + ";'>" + KANAL_HARF[kanal] + "</span>";
  }
  function tutarHucreHTML(k){
    if(k._beklemede) return "<span class='sr-durum-ek sr-durum-ek--beklemede'>⏳ " + TipEtiket.kisa.stok + "</span>";
    // BAKİYELİ SİPARİŞ (08.11.2026, Abdullah): sevk edilen/faturalanan kısım SATIŞTIR —
    // tutar normal görünür; "bu siparişte bekleyen de var" bilgisi tutarın önünde
    // küçük "📦 B.BAK" ibaresiyle verilir (eskiden tutarın yerine geçiyordu, satış
    // yokmuş gibi görünüyordu).
    var bakiyeIbaresi = k._bakiye ? "<span class='sr-durum-ek sr-durum-ek--bakiye' title='Bu siparişte bekleyen bakiye var'>📦 " + TipEtiket.kisa.bakiye + "</span>" : "";
    // "İşlem tutarı bulunmayan satırlara tutar uydurma." (referans talimatı)
    if(k._tutar > 0) return bakiyeIbaresi + fmt(k._tutar) + " €";
    return bakiyeIbaresi || "<span class='sr-tutar-yok'>—</span>";
  }
  // Satır primi: ana sayfa ve aylık prim özetiyle aynı hesaplama kuralı.
  function primSatiriHTML(k){
    if(!k || k.tip !== "siparis" || k._beklemede) return "";
    var prim = (k.urunler||[]).reduce(function(toplam,u){
      if((u.iskonto||0) > 60) return toplam;
      var satirPrimi = ((u.iskBirim||0)-(u.dipFiyat||0))*(u.adet||1)*0.22;
      return toplam + (satirPrimi > 0 ? satirPrimi : 0);
    },0);
    if(!(prim > 0)) return "";
    return "<div class='sr-prim-satir'><span class='sr-prim-etiket'>PRİM</span><span class='sr-prim-tutar'>" + fmt(prim) + " €</span></div>";
  }
  // ---- SATIR TASARIMI v3 (03.11.2026, Abdullah onayı — mockup "iki satır,
  // rota toplama bitişik"): 1. satır "MÜŞTERİ - İlçe / İL" (tek satır, alt
  // satıra inmez), 2. satır sağa yaslı İŞLEM ROTASI + tutar: her aşama
  // "gg.aa KOD" olarak, en son (şimdiki) aşama en sağda ve vurgulu, hemen
  // ardından toplam tutar. Revize edilmiş kayıtta şimdiki aşamanın kutusuna
  // turuncu R / R2 / R3 etiketi eklenir (RVZ rozeti artık YOK — hangi
  // aşamanın revizesi olduğu kutudan okunur). Rota, kaydın "rota" alanından
  // (İlerlet ile taşınan aşamalar, bkz. send-data.js / reports-data.js)
  // okunur; rota yoksa sadece şimdiki aşama görünür.
  var AY_NO = {Oca:1,"Şub":2,Mar:3,Nis:4,"May":5,Haz:6,Tem:7,"Ağu":8,Eyl:9,Eki:10,Kas:11,Ara:12};
  function ikiHane(n){ return String(n).padStart(2,"0"); }
  // "15 Tem 2026 14:30" (tarihStr çıktısı) ya da ts (sayı) -> "15.07"
  function tarihGunAy(t){
    if(typeof t === "number" && t > 0){ var d = new Date(t); return ikiHane(d.getDate()) + "." + ikiHane(d.getMonth()+1); }
    var p = String(t||"").trim().split(/\s+/);
    if(p.length >= 2 && AY_NO[p[1]]) return ikiHane(parseInt(p[0],10)) + "." + ikiHane(AY_NO[p[1]]);
    return "";
  }
  function asamaKutusuHTML(tip, durumMeta, revizeSayisi){
    var m = durumMeta || TIP_META[tip] || TIP_META.siparis;
    var kutuStil = "background:" + m.rozetBg + ";color:" + m.rozetRenk + ";";
    if(revizeSayisi > 0){
      return "<span class='sr-kd sr-kd--rvz' style='" + kutuStil + "'><i>" + m.rozet + "</i><i class='sr-kd-r'>R" + (revizeSayisi > 1 ? revizeSayisi : "") + "</i></span>";
    }
    return "<span class='sr-kd' style='" + kutuStil + "'>" + m.rozet + "</span>";
  }
  function rotaHTML(k){
    var parcalar = [];
    (k.rota || []).forEach(function(r){
      if(!r || !TIP_META[r.tip]) return;
      parcalar.push("<span class='sr-as'><small>" + tarihGunAy(r.tarih) + "</small>" + asamaKutusuHTML(r.tip, null, 0) + "</span>");
    });
    var kacanMi = k.durum === "kacan";
    var revizeSayisi = (!kacanMi && k.revizeZamani) ? Math.max(1, (k.revizeGecmisi || []).length) : 0;
    parcalar.push("<span class='sr-as sr-as--son'><small>" + tarihGunAy(k.ts) + "</small>" + asamaKutusuHTML(k.tip, kacanMi ? KACAN_META : null, revizeSayisi) + "</span>");
    return parcalar.join("<span class='sr-ay'>&#8250;</span>");
  }
  // TL KARŞILIĞI (04.11.2026, Abdullah onayı — "Euro toplamın üst satırına
  // kırmızı TL"): 1. satırın sağında, Euro toplamın hemen üstünde. Kur =
  // kaydın KENDİ kuru (k._kur; revize edilmişse revize anındaki kur, kuru
  // olmayan eski kayıtta güncel kur — bkz. ReportsData.islemSorgula).
  // Euro yerine etiket çıkan (stok bekliyor) ve tutarı olmayan satırlarda TL
  // yazılmaz. Bakiyeli siparişte sevk edilen kısmın TL'si yazılır (08.11.2026).
  // Küsuratsız, ₺ ile.
  // GÜNCELLEME (11.11.2026, Abdullah onayı): kırmızı TL artık satırın sağ üstünde DEĞİL, 2. satırda
  // Euro toplamın hemen yanında, parantez içinde ve KDV DAHİL: "(17.771 ₺)". KDV oranı belgenin
  // kendi kaydından (k.kdv, yüzde) alınır; kaydında yoksa %20. Kur kuralları aynı (k._tl).
  function kdvOrani(k){
    var v = parseFloat(k.kdv);
    return isNaN(v) ? 20 : v;
  }
  function tlHucreHTML(k){
    if(k._beklemede || !(k._tutar > 0) || !(k._tl > 0)) return "";
    var kdvDahil = k._tl * (1 + kdvOrani(k) / 100);
    return "<span class='sr-tl-kdv'>(" + Math.round(kdvDahil).toLocaleString("tr-TR") + " ₺ <small class='sr-tl-kdv-et'>KDV'Lİ</small>)</span>";
  }
  function satirHTML(k, i, primSatiriGoster){
    var m = rozetMeta(k);
    return "<div class='sr-satir" + (k._beklemede ? " sr-satir--beklemede" : "") + "' data-i='" + i + "' style='border-left-color:" + m.serit + ";'>"
      + "<div class='sr-ust'>"
      +   "<div class='sr-firma-blok'><div class='sr-firma-h'>" + (typeof CustomerData !== "undefined" && CustomerData.kodAdHtml ? CustomerData.kodAdHtml(k.musteriId, k.musteri) : htmlEsc(k.musteri||"")) + "</div>" + (primSatiriGoster ? primSatiriHTML(k) : "") + "</div>"
      +   "<div class='sr-konum-h'>" + htmlEsc(k.sehir||"") + "</div>"
      + "</div>"
      + "<div class='sr-alt'>"
      +   "<div class='sr-rota'>" + rotaHTML(k) + "</div>"
      +   "<div class='sr-tm'>" + kanalHarfHTML(k.kanal) + "<div class='sr-tutar-h'>" + tutarHucreHTML(k) + "</div>" + tlHucreHTML(k) + "</div>"
      + "</div>"
      + "<div class='sr-ok-h'>&#8250;</div>"
      + "</div>";
  }
  function gruplaHTML(kayitlar, toplamaBeklemedeDahil, primSatiriGoster){
    var gruplar = [], harita = {};
    kayitlar.forEach(function(k, i){
      var a = gunAnahtari(k.ts);
      if(!harita[a]){ harita[a] = {ts:k.ts, satirlar:[], toplam:0}; gruplar.push(harita[a]); }
      harita[a].satirlar.push(satirHTML(k, i, primSatiriGoster));
      if(!k._beklemede || toplamaBeklemedeDahil) harita[a].toplam += k._tutar;
    });
    return gruplar.map(function(g){
      return "<div class='sr-grup-baslik'><span>" + gunBasligi(g.ts) + "</span><span>" + fmt(g.toplam) + " €</span></div>"
        + "<div class='sr-liste-kutu'>" + g.satirlar.join("") + "</div>";
    }).join("");
  }

  var FILTRE_IKONU = "<svg width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M3 5h18l-7 8.5V20l-4-2v-4.5z'/></svg>";

  function baslat(opts){
    opts = opts || {};
    var kok = document.getElementById(opts.yerId || "islemListesiYeri");
    if(!kok) return null;
    var taban = opts.taban || {};
    var hazirListe = (opts.hazir || []).map(function(h){
      var id = typeof h === "string" ? h : h.id;
      var tanim = HAZIR[id];
      if(!tanim) return null;
      return {id:id, etiket:(h && h.etiket) || tanim.etiket, tip:tanim.tip, durum:tanim.durum, tarih:tanim.tarih};
    }).filter(Boolean);

    var durum = {
      tip: taban.tip || "", durum: taban.durum || "",
      musteriId: opts.musteriId || "", musteriAd: opts.musteriAd || "",
      kanal: "", siralama: "yeni", beklemedeDahil: false,
      primli: !!opts.baslangicPrimli    // 13.11.2026: sadece primli siparişler (bkz. ReportsData.kayitPrimliMi)
    };
    if(opts.beklemedeToggle && opts.beklemedeAnahtar){
      try{ durum.beklemedeDahil = localStorage.getItem(opts.beklemedeAnahtar) === "1"; }catch(e){}
    }

    // ---- Çubuk + pencere + liste iskeleti --------------------------------
    kok.innerHTML =
      "<div class='islem-filtre-satiri il-filtre-satiri' id='ilFiltreSatiri'>"
      + "<input type='text' id='islemAra' placeholder='Müşteri ara' autocomplete='off'>"
      + (opts.tarihKilitli ? "" : "<div id='tarihFiltreYeri' hidden></div>")   // 11.11.2026: ayrı Tarih düğmesi YOK — tarih seçimi Filtre penceresinde
      + "<button type='button' class='il-f-btn' id='ilFiltreBtn' aria-label='Filtreler' aria-expanded='false'>" + FILTRE_IKONU + "<b class='il-f-rozet' id='ilFiltreRozet' hidden></b></button>"
      + "</div>"
      + "<div class='il-dim' id='ilDim' hidden></div>"
      + "<div class='il-panel' id='ilPanel' hidden></div>"
      + "<div class='si-liste-kutu'><div id='islemlerListesi'></div><p class='bos-mesaj' id='islemlerBosMesaj' hidden></p></div>";

    var aramaEl = document.getElementById("islemAra");
    var rozetEl = document.getElementById("ilFiltreRozet");
    var btnEl = document.getElementById("ilFiltreBtn");
    var panelEl = document.getElementById("ilPanel");
    var dimEl = document.getElementById("ilDim");
    var listeEl = document.getElementById("islemlerListesi");
    var bosEl = document.getElementById("islemlerBosMesaj");
    var tarihKontrol = null;
    var sonSonuc = null;
    var panelAcik = false;

    function tarihSecimi(){ return tarihKontrol ? tarihKontrol.secim() : "tumu"; }

    function sorguHazirla(){
      var t = tarihKontrol ? tarihKontrol.aralik() : null;
      return {
        tip: taban.tip || durum.tip || "",
        durum: taban.durum || durum.durum || "",
        tarihBas: taban.tarihBas != null ? taban.tarihBas : (t ? t.bas : null),
        tarihBit: taban.tarihBit != null ? taban.tarihBit : (t ? t.bit : null),
        ayAd: taban.ayAd || "", yil: taban.yil || "",
        arama: aramaEl.value || "",
        musteriId: durum.musteriId, musteriAd: durum.musteriAd,
        kanal: durum.kanal, siralama: durum.siralama, limit: opts.limit || 0,
        primli: !!durum.primli,
        beklemedeHaric: !!opts.beklemedeToggle && !durum.beklemedeDahil,
        beklemedeToplamaDahil: !!opts.beklemedeToggle && durum.beklemedeDahil
      };
    }

    var ozelBas = "", ozelBit = "";   // Filtre penceresindeki özel aralık girişleri (yeniden çizimde korunur)
    function tarihStr(str){
      var p = (str || "").split("-"); if(p.length !== 3) return null;
      var d = new Date(parseInt(p[0],10), parseInt(p[1],10)-1, parseInt(p[2],10));
      return isNaN(d.getTime()) ? null : d;
    }
    function aktifFiltreSayisi(){
      var n = 0;
      if(tarihKontrol && taban.tarihBas == null && tarihSecimi() !== "tumu") n++;
      if(!taban.tip && durum.tip) n++;
      if(!taban.durum && durum.durum) n++;
      if(durum.musteriId || durum.musteriAd) n++;
      if(durum.kanal) n++;
      if(durum.primli) n++;
      if(durum.siralama !== "yeni") n++;
      return n;
    }
    function filtreVarMi(){
      return aktifFiltreSayisi() > 0 || tarihSecimi() !== "tumu" || !!aramaEl.value.trim();
    }

    function ciz(){
      try{
        var s = sorguHazirla();
        sonSonuc = ReportsData.islemSorgula(s);
        var kayitlar = sonSonuc.kayitlar;
        var n = aktifFiltreSayisi();
        rozetEl.hidden = n === 0; rozetEl.textContent = n;
        btnEl.classList.toggle("il-f-btn--aktif", n > 0);
        if(!kayitlar.length){
          listeEl.innerHTML = "";
          bosEl.textContent = filtreVarMi() ? "Bu filtreyle eşleşen kayıt yok." : (opts.bosMesaj || "Henüz kayıt yok.");
          bosEl.hidden = false;
        } else {
          bosEl.hidden = true;
          listeEl.innerHTML = gruplaHTML(kayitlar, s.beklemedeToplamaDahil, !!opts.primSatiriGoster);
          listeEl.querySelectorAll(".sr-satir").forEach(function(el){
            el.onclick = function(){
              var k = kayitlar[parseInt(this.getAttribute("data-i"), 10)];
              try{ localStorage.setItem("weiconv2_goruntulenen_belge", JSON.stringify({tip:k.tip, ts:k.ts})); }catch(e){}
              window.location.href = "belge-onizleme.html";
            };
          });
        }
        if(panelAcik) panelCiz();
      }catch(e){ hata("İşlemler çizilemedi: " + e.message); }
    }

    // ---- Açılır pencere --------------------------------------------------
    function ozetMetni(){
      var parcalar = [];
      var etkinTip = taban.tip || durum.tip;
      var etkinDurum = taban.durum || durum.durum;
      if(etkinTip) parcalar.push(TIP_ETIKET[etkinTip]);
      if(etkinDurum === "kacan") parcalar.push("Kaçanlar");
      if(etkinDurum === "bekleyen") parcalar.push(TipEtiket.kisa.stok + " ve " + TipEtiket.kisa.bakiye);
      if(taban.tarihBas == null && !taban.ayAd && tarihSecimi() !== "tumu") parcalar.push(TARIH_ETIKET[tarihSecimi()] || "Özel Aralık");
      if(durum.primli) parcalar.push("Primli satışlar");
      if(durum.kanal) parcalar.push(durum.kanal === "yok" ? "Kanal yok" : (durum.kanal === "mail" ? "Mail" : "WhatsApp"));
      return parcalar.length ? parcalar.join(" · ") : "Tüm işlemler";
    }
    function panelCiz(){
      var o = sonSonuc ? sonSonuc.ozet : {eslesen:0, gosterilen:0, toplamEuro:0, toplamTl:0};
      var etkinTip = taban.tip || durum.tip;
      var alt = o.eslesen + " kayıt" + (o.gosterilen < o.eslesen ? " · en yeni " + o.gosterilen + " gösteriliyor" : "");
      // Toplam SADECE tür "Sipariş" iken gösterilir — numune/teklif/proforma
      // tutarlarını sipariş toplamına katmak yanıltıcı olurdu.
      var toplam = etkinTip === "siparis"
        ? "<div class='il-oz-s'>" + fmt(o.toplamEuro) + " €<small>≈ " + Math.round(o.toplamTl).toLocaleString("tr-TR") + " TL</small></div>" : "";
      var h = "<div class='il-oz'><div class='il-oz-t'>" + htmlEsc(ozetMetni()) + "<small>" + alt + "</small></div>" + toplam
        + (filtreVarMi() ? "<button type='button' class='il-temizle' data-act='temizle'>✕ Temizle</button>" : "") + "</div>";

      if(hazirListe.length){
        var tarihS = tarihSecimi();
        var eslesen = null;
        hazirListe.forEach(function(p){
          if(eslesen) return;
          var tipTamam = taban.tip ? true : (p.tip||"") === durum.tip;
          var durumTamam = taban.durum ? true : (p.durum||"") === durum.durum;
          var tarihTamam = opts.tarihKilitli ? true : (p.tarih||"tumu") === tarihS;
          if(tipTamam && durumTamam && tarihTamam) eslesen = p.id;
        });
        h += "<h5>HAZIR TUŞLAR</h5><div class='il-r'>" + hazirListe.map(function(p){
          return "<button type='button' class='il-c" + (p.id === eslesen ? " il-c--on" : "") + "' data-act='hazir' data-id='" + p.id + "'>" + htmlEsc(p.etiket) + "</button>";
        }).join("") + "</div>";
      }
      if(tarihKontrol && taban.tarihBas == null){
        var ts = tarihSecimi();
        h += "<h5>TARİH</h5><div class='il-r'>" + [["bugun","Bugün"],["bu_hafta","Bu Hafta"],["bu_ay","Bu Ay"],["bu_yil","Bu Yıl"],["tumu","Tümü"]].map(function(t){
          return "<button type='button' class='il-c" + (ts === t[0] ? " il-c--on" : "") + "' data-act='tarih' data-v='" + t[0] + "'>" + t[1] + "</button>";
        }).join("") + "</div>"
          + "<div class='il-tarih-ozel'><input type='date' class='tarih-filtre-input' data-ozel='bas' value='" + ozelBas + "' aria-label='Başlangıç tarihi'>"
          + "<span>–</span><input type='date' class='tarih-filtre-input' data-ozel='bit' value='" + ozelBit + "' aria-label='Bitiş tarihi'></div>";
      }
      if(!taban.tip){
        h += "<h5>TÜR</h5><div class='il-r'><button type='button' class='il-c" + (!durum.tip ? " il-c--on" : "") + "' data-act='tip' data-v=''>Tümü</button>"
          + ["numune","teklif","proforma","siparis"].map(function(t){
              return "<button type='button' class='il-c il-c--" + t + (durum.tip === t ? " il-c--on il-c--tip-on" : "") + "' data-act='tip' data-v='" + t + "'>" + TIP_ETIKET[t] + "</button>";
            }).join("")
          // KÇS (11.11.2026, Abdullah onayı): "Kaçan Satışlar" sekmesi kaldırıldı; kaçan işaretli kayıtlar
          // artık TÜR satırında kısa kodla (KÇS) süzülür. Tür seçimiyle birleşir (ör. SİP + KÇS).
          + (taban.durum ? "" : "<button type='button' class='il-c il-c--kacan" + (durum.durum === "kacan" ? " il-c--on il-c--tip-on" : "") + "' data-act='kacan'>" + TipEtiket.kisa.kacan + "</button>")
          + "</div>";
      }
      if(opts.primFiltresi){
        h += "<h5>PRİM</h5><div class='il-r'><button type='button' class='il-c" + (durum.primli ? " il-c--on" : "") + "' data-act='primli'>Primli satışlar</button></div>";
      }
      if(durum.musteriId || durum.musteriAd){
        h += "<h5>MÜŞTERİ</h5><div class='il-r'><span class='il-pill'>👤 " + (typeof CustomerData !== "undefined" && CustomerData.kodAdHtml && durum.musteriAd ? CustomerData.kodAdHtml(durum.musteriId, durum.musteriAd) : htmlEsc(durum.musteriAd || "Seçili müşteri")) + "<button type='button' data-act='musteri-kaldir' aria-label='Müşteri filtresini kaldır'>✕</button></span></div>";
      }
      if(opts.siralama){
        h += "<h5>SIRALAMA</h5><div class='il-r'>"
          + "<button type='button' class='il-c" + (durum.siralama === "yeni" ? " il-c--on" : "") + "' data-act='sira' data-v='yeni'>Yeni → Eski</button>"
          + "<button type='button' class='il-c" + (durum.siralama === "eski" ? " il-c--on" : "") + "' data-act='sira' data-v='eski'>Eski → Yeni</button></div>";
      }
      if(opts.beklemedeToggle){
        h += "<label class='il-secenek'><input type='checkbox' data-act='bekleme'" + (durum.beklemedeDahil ? " checked" : "") + "><span>⏳ "+TipEtiket.kisa.stok+" siparişleri dahil et</span></label>";
      }
      h += "<button type='button' class='il-goster' data-act='kapat'>" + o.eslesen + " kaydı göster</button>";
      panelEl.innerHTML = h;
    }
    function panelAc(){
      var satir = document.getElementById("ilFiltreSatiri").getBoundingClientRect();
      var ust = Math.round(satir.bottom + 6);
      panelEl.style.top = ust + "px";
      panelEl.style.maxHeight = "calc(100vh - " + (ust + 12) + "px)";
      dimEl.style.top = Math.round(satir.bottom) + "px";
      panelAcik = true;
      panelCiz();
      panelEl.hidden = false; dimEl.hidden = false;
      btnEl.setAttribute("aria-expanded", "true");
      document.documentElement.style.overflow = "hidden";
    }
    function panelKapat(){
      panelAcik = false;
      panelEl.hidden = true; dimEl.hidden = true;
      btnEl.setAttribute("aria-expanded", "false");
      document.documentElement.style.overflow = "";
    }

    function hazirUygula(id){
      var p = HAZIR[id];
      if(!p) return;
      if(!taban.tip) durum.tip = p.tip || "";
      if(!taban.durum) durum.durum = p.durum || "";
      if(tarihKontrol && taban.tarihBas == null) tarihKontrol.sec(p.tarih || "tumu");
    }
    function temizle(){
      durum.tip = taban.tip || ""; durum.durum = taban.durum || "";
      durum.musteriId = ""; durum.musteriAd = ""; durum.kanal = ""; durum.siralama = "yeni"; durum.primli = false;
      aramaEl.value = "";
      if(tarihKontrol && taban.tarihBas == null) tarihKontrol.sec("tumu");
      ozelBas = ""; ozelBit = "";
    }

    panelEl.addEventListener("click", function(ev){
      var el = ev.target.closest("[data-act]");
      if(!el) return;
      var act = el.getAttribute("data-act");
      if(act === "kapat"){ panelKapat(); return; }
      if(act === "hazir") hazirUygula(el.getAttribute("data-id"));
      else if(act === "tip") durum.tip = el.getAttribute("data-v") || "";
      else if(act === "tarih"){ if(tarihKontrol){ tarihKontrol.sec(el.getAttribute("data-v") || "tumu"); ozelBas = ""; ozelBit = ""; } }
      else if(act === "kacan") durum.durum = (durum.durum === "kacan") ? "" : "kacan";
      else if(act === "primli") durum.primli = !durum.primli;
      else if(act === "sira") durum.siralama = el.getAttribute("data-v") || "yeni";
      else if(act === "musteri-kaldir"){ durum.musteriId = ""; durum.musteriAd = ""; }
      else if(act === "temizle") temizle();
      else if(act === "bekleme") return; // checkbox: change olayı işler
      ciz();
    });
    panelEl.addEventListener("change", function(ev){
      var el = ev.target;
      // Özel aralık: iki tarih de seçilince kendiliğinden uygulanır (Uygula düğmesi yok)
      if(el && el.getAttribute && el.getAttribute("data-ozel")){
        if(el.getAttribute("data-ozel") === "bas") ozelBas = el.value; else ozelBit = el.value;
        var b = tarihStr(ozelBas), t = tarihStr(ozelBit);
        if(b && t && tarihKontrol){
          if(b.getTime() > t.getTime()){ if(typeof hata === "function") hata("Başlangıç tarihi, bitiş tarihinden sonra olamaz."); return; }
          tarihKontrol.sec("ozel", b, t);
          ciz();
        }
        return;
      }
      if(el && el.getAttribute && el.getAttribute("data-act") === "bekleme"){
        durum.beklemedeDahil = !!el.checked;
        if(opts.beklemedeAnahtar){ try{ localStorage.setItem(opts.beklemedeAnahtar, durum.beklemedeDahil ? "1" : "0"); }catch(e){} }
        ciz();
      }
    });
    btnEl.addEventListener("click", function(ev){ ev.stopPropagation(); if(panelAcik) panelKapat(); else panelAc(); });
    dimEl.addEventListener("click", panelKapat);
    document.addEventListener("keydown", function(ev){ if(ev.key === "Escape" && panelAcik) panelKapat(); });
    aramaEl.addEventListener("input", ciz);

    // ---- Tarih düğmesi (paylaşılan TarihFiltre) + başlangıç --------------
    if(!opts.tarihKilitli){
      tarihKontrol = TarihFiltre.ekle("tarihFiltreYeri", { varsayilan: "tumu", degisti: ciz });
    }
    var ilk = opts.baslangicHazir || (hazirListe[0] && hazirListe[0].id);
    if(ilk) hazirUygula(ilk);

    if(opts.hataYakala !== false){
      window.addEventListener("error", function(ev){
        hata("HATA: " + ev.message + " (" + (ev.filename||"").split("/").pop() + ":" + ev.lineno + ")");
      });
    }
    ReportsData.arsivDegistiginde(ciz);
    ciz();
    return { yenile: ciz, durum: durum, hazirUygula: function(id){ hazirUygula(id); ciz(); } };
  }

  return { baslat: baslat, HAZIR: HAZIR };
})();
