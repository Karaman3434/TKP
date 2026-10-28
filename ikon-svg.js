/*
  ikon-svg.js — WG.281026.2121.1192
  ==================================
  PAYLAŞILAN TEK-RENK İKON SİSTEMİ (28.10.2026, Abdullah onayı — mockup
  üzerinden onaylandı): Programda emoji ikonlar (📄🚚👤🧾📅📝📞✉️ vb.) yerine
  artık bu dosyadaki düz, tek-renk, stroke tabanlı SVG ikonlar kullanılıyor.
  SEBEP: gerçek (renkli) emoji'lerin rengi CSS ile değiştirilemiyor — tek
  renk + tutarlı boy isteniyorsa SVG tek yol.

  KULLANIM: IkonSvg.svg("dosya") ham bir <svg>...</svg> döndürür (renk
  YOK — "stroke: currentColor" kullanıyor, dış elemente color: ... vererek
  boyansın). Boyut da dış elemente width/height ile verilir — bu dosya
  boyut/renk DAYATMAZ, sadece şekli sağlar. Her çağıran kendi sarmalayıcı
  class'ını (örn. cari-kart-style.css .ikon-ck) kullanır.

  TEK KURAL: yeni bir ikon gerektiğinde buraya eklenir, başka hiçbir
  dosyada kendi SVG path'i TANIMLANMAZ — ikon burada değişirse kullanan
  her yer otomatik günceller.
*/
var IkonSvg = (function(){

  var PATH = {
    // VADE (takvim)
    vade: "<rect x='3' y='5' width='18' height='16' rx='2'/><line x1='3' y1='10' x2='21' y2='10'/><line x1='8' y1='2.5' x2='8' y2='6.5'/><line x1='16' y1='2.5' x2='16' y2='6.5'/>",
    // FATURA özet (fiş/makbuz)
    fatura: "<path d='M5 3h14v17l-2.5-1.5L14 20l-2.5-1.5L9 20l-2.5-1.5L5 20z'/><line x1='8' y1='8' x2='16' y2='8'/><line x1='8' y1='12' x2='16' y2='12'/>",
    // KARGO / TESLİMAT (kamyon)
    kargo: "<rect x='1' y='7' width='13' height='10'/><path d='M14 10h4l4 3.5V17h-8z'/><circle cx='6' cy='19' r='1.8'/><circle cx='17.5' cy='19' r='1.8'/>",
    // FATURA ADRESİ (belge)
    dosya: "<path d='M6 2h9l5 5v15H6z'/><path d='M15 2v5h5'/><line x1='9' y1='13' x2='15' y2='13'/><line x1='9' y1='17' x2='15' y2='17'/>",
    // YETKİLİ / kullanıcı / avatar (kişi)
    kisi: "<circle cx='12' cy='8' r='4'/><path d='M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7'/>",
    // NOT (not defteri)
    not: "<path d='M4 4h13l3 3v13H4z'/><line x1='8' y1='9' x2='15' y2='9'/><line x1='8' y1='13' x2='15' y2='13'/><line x1='8' y1='17' x2='12' y2='17'/>",
    // Telefon
    telefon: "<path d='M6 3h3l2 5-2.5 1.5a12 12 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2C10.5 20 4 13.5 4 5a2 2 0 0 1 2-2z'/>",
    // Mail
    mail: "<rect x='2.5' y='5' width='19' height='14' rx='1.5'/><path d='M3 6.5 12 13l9-6.5'/>"
  };

  function svg(ad){
    var p = PATH[ad];
    if(!p) return "";
    return "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' style='width:100%;height:100%;display:block;'>" + p + "</svg>";
  }

  return { svg: svg, PATH: PATH };

})();
