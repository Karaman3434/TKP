/*
  avans-ortak.js — TKP.02.11.26-19:21.1433
  ========================
  02.11.2026 — Avans Takibi (avans-takibi-render.js) ve Avans Toplam
  (avans-toplam-render.js) sayfalarının ORTAK küçük yardımcıları: ay adları,
  TL/tarih biçimleri, HTML kaçışı. Tek kaynak — iki sayfada kopya yok.
  Veri: avans-kayit-data.js (AvansKayitData). Bu dosya veri OKUMAZ/YAZMAZ.
*/
var AY_ADLARI_AV = ["","Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

function fmtTL_AV(n){
  return (n||0).toLocaleString("tr-TR", {minimumFractionDigits:2, maximumFractionDigits:2}) + " TL";
}
function htmlEsc_AV(s){
  return (s==null?"":String(s)).replace(/[&<>"']/g, function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
  });
}
function fmtTarihKisa_AV(iso){
  if(!iso) return "-";
  var p = iso.split("-");
  if(p.length!==3) return iso;
  return p[2] + "." + p[1] + "." + p[0].slice(2);
}
