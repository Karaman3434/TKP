/*
  tarih-filtre.js — WG.211026.2100.906
  =====================================
  TEK, PAYLAŞILAN tarih filtresi bileşeni (21.10.2026, Abdullah onayı —
  mockup üzerinden onaylandı). Son İşlemler, Müşteri Geçmişi, Satışlarım,
  Kaçan Satışlar ve Bakiyedeki Ürünler ekranlarının HEPSİNDE birebir aynı
  "📅 Tarih" buton + açılır panel kullanılır — tasarım/renk/davranış TEK
  yerden (burada) yönetilir.

  KULLANIM (her sayfanın kendi render.js dosyasında):
    var tarihFiltreKontrol = TarihFiltre.ekle("tarihFiltreYeri", {
      varsayilan: "tumu",              // "tumu"|"bugun"|"bu_hafta"|"bu_ay"|"bu_yil"
      degisti: function(){ ... }       // filtre değişince çağrılır — sayfa kendi listesini yeniden çizer
    });
    ...
    liste = liste.filter(function(k){ return tarihFiltreKontrol.icindeMi(k.ts); });

  "tarihFiltreYeri" id'li BOŞ bir <div> (veya <span>), sayfanın mevcut
  filtre satırının İÇİNE konur — bu modül onun içini doldurur. Panel
  taşma/kırpılma riskine karşı (ör. gecmis.html'deki yatay kaydırmalı çip
  satırı) page DOM'una değil, HER ZAMAN document.body'ye eklenir ve
  position:fixed ile butonun o anki ekran konumuna göre açılır — hangi
  sayfada/satırda kullanıldığına bakılmaksızın kırpılmadan görünür.

  "ts" karşılaştırması HER ZAMAN yerel gün sınırlarıyla yapılır (gün başı
  00:00:00.000 — gün sonu 23:59:59.999), saat dilimi kaymasını önlemek
  için tarih girişleri "YYYY-MM-DD" string'inden elle çözülür (new
  Date(string) ile UTC'ye kaydırılmaz).
*/
var TarihFiltre = (function(){

  var sayac = 0;
  var CIP_ETIKET = { bugun:"Bugün", bu_hafta:"Bu Hafta", bu_ay:"Bu Ay", bu_yil:"Bu Yıl", tumu:"Tümü" };

  function tarihStrCoz(str){
    if(!str) return null;
    var p = str.split("-");
    if(p.length !== 3) return null;
    var d = new Date(parseInt(p[0],10), parseInt(p[1],10)-1, parseInt(p[2],10));
    return isNaN(d.getTime()) ? null : d;
  }
  function gunBasi(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
  function gunSonu(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime(); }

  function ekle(mountId, opts){
    opts = opts || {};
    var mount = document.getElementById(mountId);
    if(!mount) return { icindeMi: function(){ return true; } }; // bileşen eklenemedi — filtre uygulanmamış gibi davran

    sayac++;
    var btnId = "tarihFiltreBtn" + sayac;

    var state = { secim: opts.varsayilan || "tumu", ozelBas: null, ozelBit: null };
    var aktifAralik = null;

    mount.innerHTML = "<button type='button' class='tarih-filtre-btn' id='" + btnId + "'>📅 Tarih</button>";
    var btn = document.getElementById(btnId);

    var panel = document.createElement("div");
    panel.className = "tarih-filtre-panel";
    panel.hidden = true;
    panel.innerHTML =
      "<div class='tarih-filtre-panel-baslik'>Hızlı Seçim</div>"
      + "<div class='tarih-filtre-cip-satiri'>"
      + ["bugun","bu_hafta","bu_ay","bu_yil","tumu"].map(function(k){
          return "<button type='button' class='tarih-filtre-cip' data-secim='" + k + "'>" + CIP_ETIKET[k] + "</button>";
        }).join("")
      + "</div>"
      + "<div class='tarih-filtre-panel-baslik' style='margin-bottom:6px;'>Özel Aralık</div>"
      + "<div class='tarih-filtre-ozel-satir'>"
      + "<input type='date' class='tarih-filtre-input' data-ozel='bas'>"
      + "<span class='tarih-filtre-ayrac'>–</span>"
      + "<input type='date' class='tarih-filtre-input' data-ozel='bit'>"
      + "</div>"
      + "<button type='button' class='tarih-filtre-uygula-btn'>Uygula</button>";
    document.body.appendChild(panel);

    function araligiHesapla(){
      var simdi = new Date();
      if(state.secim === "bugun") return { bas: gunBasi(simdi), bit: gunSonu(simdi) };
      if(state.secim === "bu_hafta"){
        var gun = simdi.getDay(); // 0=Pazar
        var fark = (gun === 0 ? 6 : gun - 1); // Pazartesi'ye kadar geri git
        var pazartesi = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate() - fark);
        return { bas: gunBasi(pazartesi), bit: gunSonu(simdi) };
      }
      if(state.secim === "bu_ay") return { bas: new Date(simdi.getFullYear(), simdi.getMonth(), 1).getTime(), bit: gunSonu(simdi) };
      if(state.secim === "bu_yil") return { bas: new Date(simdi.getFullYear(), 0, 1).getTime(), bit: gunSonu(simdi) };
      if(state.secim === "ozel" && state.ozelBas && state.ozelBit) return { bas: gunBasi(state.ozelBas), bit: gunSonu(state.ozelBit) };
      return null; // "tumu" — sınır yok
    }

    function butonuGuncelle(){
      aktifAralik = araligiHesapla();
      if(!aktifAralik){
        btn.className = "tarih-filtre-btn";
        btn.innerHTML = "📅 Tarih";
      } else {
        btn.className = "tarih-filtre-btn tarih-filtre-btn--aktif";
        var etiket = state.secim === "ozel" ? "Özel Aralık" : CIP_ETIKET[state.secim];
        btn.innerHTML = "📅 " + etiket + " <span class='tarih-filtre-btn-x' data-temizle='1'>✕</span>";
      }
      panel.querySelectorAll(".tarih-filtre-cip").forEach(function(c){
        c.classList.toggle("tarih-filtre-cip--aktif", c.getAttribute("data-secim") === state.secim);
      });
    }
    butonuGuncelle();

    function panelAc(){
      var r = btn.getBoundingClientRect();
      panel.style.top = (r.bottom + 6) + "px";
      panel.style.right = (window.innerWidth - r.right) + "px";
      panel.hidden = false;
    }
    function panelKapat(){ panel.hidden = true; }

    btn.addEventListener("click", function(ev){
      if(ev.target && ev.target.getAttribute && ev.target.getAttribute("data-temizle")){
        ev.stopPropagation();
        state.secim = "tumu"; state.ozelBas = null; state.ozelBit = null;
        butonuGuncelle();
        panelKapat();
        if(opts.degisti) opts.degisti();
        return;
      }
      if(panel.hidden) panelAc(); else panelKapat();
    });

    panel.querySelectorAll(".tarih-filtre-cip").forEach(function(c){
      c.addEventListener("click", function(){
        state.secim = c.getAttribute("data-secim");
        state.ozelBas = null; state.ozelBit = null;
        butonuGuncelle();
        panelKapat();
        if(opts.degisti) opts.degisti();
      });
    });

    panel.querySelector(".tarih-filtre-uygula-btn").addEventListener("click", function(){
      var bas = tarihStrCoz(panel.querySelector("[data-ozel='bas']").value);
      var bit = tarihStrCoz(panel.querySelector("[data-ozel='bit']").value);
      if(!bas || !bit){ alert("Lütfen başlangıç ve bitiş tarihini seçin."); return; }
      if(bas.getTime() > bit.getTime()){ alert("Başlangıç tarihi, bitiş tarihinden sonra olamaz."); return; }
      state.secim = "ozel"; state.ozelBas = bas; state.ozelBit = bit;
      butonuGuncelle();
      panelKapat();
      if(opts.degisti) opts.degisti();
    });

    // Panel dışına dokununca kapat (panel document.body'ye eklendiği için
    // "sarmal" yok — buton VEYA panelin kendisi dışındaki her tıklama kapatır).
    document.addEventListener("click", function(ev){
      if(panel.hidden) return;
      if(btn.contains(ev.target) || panel.contains(ev.target)) return;
      panelKapat();
    });
    // Sayfa kaydırılırken açık panel, butonun o anki konumunu takip etmediği
    // için (fixed + tek seferlik hesap) kapatılır — karmaşık yeniden
    // konumlandırma yerine en basit/güvenli davranış.
    window.addEventListener("scroll", function(){ if(!panel.hidden) panelKapat(); }, true);

    return {
      icindeMi: function(ts){
        if(!aktifAralik) return true;
        return (ts||0) >= aktifAralik.bas && (ts||0) <= aktifAralik.bit;
      }
    };
  }

  return { ekle: ekle };
})();
