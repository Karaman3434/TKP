/*
  ai-urun-asistani.js
  ====================
  AI ÜRÜN ASİSTANI (01.10.2026, Abdullah'ın isteğiyle) — Ürün Bul
  sayfasındaki "🤖 AI ile Açıkla" butonunun TÜM mantığı burada: modal
  açma/kapama, önbellek (cache), Firebase Cloud Function'a istek atma,
  yükleniyor/hata durumları.

  BİLEREK product-render.js'DEN AYRI bir dosya — modüler kalsın, ürün
  listesi render mantığına hiç dokunmadan bu özellik tek başına
  güncellenebilsin/kaldırılabilsin diye.

  MİMARİ (Abdullah'ın dokümanındaki gibi):
    Frontend (bu dosya) → Firebase Cloud Function (aiUrunAcikla) →
    OpenAI API → AI cevabı → Frontend.

  ÖNEMLİ — API ANAHTARI BU DOSYADA YOK VE OLMAYACAK. OpenAI API anahtarı
  sadece Cloud Function tarafında, Firebase'in "secret" (ortam değişkeni)
  mekanizmasında tutulur. Bu dosya sadece kendi Cloud Function
  adresimize (aşağıdaki AI_FONKSIYON_URL) istek atar.

  Cloud Function henüz deploy edilmediyse bu özellik "Ürün açıklaması şu
  anda oluşturulamadı" hatası gösterir (çökme olmaz) — deploy adımları
  ayrıca iletildi.
*/

// Cloud Function'ın adresi — firebase-config.js'teki projectId (weicon-asist)
// ve Realtime Database ile aynı bölge (europe-west1) kullanılarak
// hazırlanmıştır. Fonksiyon deploy edildikten sonra bu adres otomatik
// doğru çalışır, başka bir değişiklik gerekmez.
var AI_FONKSIYON_URL = "https://TEST_FUNCTION_ENDPOINT_NOT_CONFIGURED.invalid";

// Önbellek — aynı ürün için AI açıklaması bir kez oluşturulduktan sonra
// tekrar sorulmaz (dokümandaki 14. madde: gereksiz API çağrısı yapma).
// Tek bir localStorage anahtarı altında, ürün koduna göre bir harita
// olarak tutuluyor.
var AI_CACHE_ANAHTARI = "weicon_ai_urun_cache";

function aiCacheOku(urunAnahtari){
  try{
    var harita = JSON.parse(localStorage.getItem(AI_CACHE_ANAHTARI) || "{}");
    return harita[urunAnahtari] || null;
  }catch(e){ return null; }
}
function aiCacheYaz(urunAnahtari, veri){
  try{
    var harita = JSON.parse(localStorage.getItem(AI_CACHE_ANAHTARI) || "{}");
    harita[urunAnahtari] = veri;
    localStorage.setItem(AI_CACHE_ANAHTARI, JSON.stringify(harita));
  }catch(e){}
}
function aiUrunAnahtariUret(ad, berta, abas){
  var kod = (berta||"") + "|" + (abas||"");
  return kod !== "|" ? kod : ("ad:" + (ad||""));
}

var aiIstekDevamEdiyor = false;
var aiSonAcilanUrun = null; // { ad, berta, abas, fiyat } — "Yenile" için

function aiHtmlEsc(s){
  return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function aiModalAc(ad){
  var overlay = document.getElementById("aiModalOverlay");
  var baslik = document.getElementById("aiModalBaslik");
  if(!overlay || !baslik) return;
  baslik.textContent = ad || "Ürün";
  overlay.hidden = false;
}
function aiModalKapat(){
  var overlay = document.getElementById("aiModalOverlay");
  if(overlay) overlay.hidden = true;
}

function aiYukleniyorGoster(){
  var icerik = document.getElementById("aiModalIcerik");
  if(!icerik) return;
  icerik.innerHTML = "<div class='ai-modal-yukleniyor'>🤖 AI ürünü analiz ediyor…</div>";
}

function aiHataGoster(){
  var icerik = document.getElementById("aiModalIcerik");
  if(!icerik) return;
  icerik.innerHTML = "<div class='ai-modal-hata'>Ürün açıklaması şu anda oluşturulamadı. Lütfen tekrar deneyin.</div>"
    + "<div class='ai-modal-alt-satir'>"
    + "<button class='ai-modal-yenile-btn' id='aiModalYenileBtn'>🔄 Tekrar Dene</button>"
    + "<button class='ai-modal-kapat-btn' id='aiModalKapatBtn'>Kapat</button>"
    + "</div>";
  aiAltButonlariBagla(true);
}

function aiSonucGoster(veri){
  var icerik = document.getElementById("aiModalIcerik");
  if(!icerik) return;
  var html = "<div class='ai-modal-govde'>";
  if(veri.urunNedir) html += "<h4>Ürün Nedir?</h4><p>" + aiHtmlEsc(veri.urunNedir) + "</p>";
  if(veri.ozellikler && veri.ozellikler.length){
    html += "<h4>Temel Özellikler</h4><ul>" + veri.ozellikler.map(function(o){ return "<li>" + aiHtmlEsc(o) + "</li>"; }).join("") + "</ul>";
  }
  if(veri.kullanimAlanlari) html += "<h4>Kullanım Alanları</h4><p>" + aiHtmlEsc(veri.kullanimAlanlari) + "</p>";
  if(veri.teknikOzellikler && veri.teknikOzellikler.length){
    html += "<h4>Teknik Özellikler</h4><ul>" + veri.teknikOzellikler.map(function(o){ return "<li>" + aiHtmlEsc(o) + "</li>"; }).join("") + "</ul>";
  }
  if(veri.avantajlar) html += "<h4>Avantajları</h4><p>" + aiHtmlEsc(veri.avantajlar) + "</p>";
  if(veri.dikkat) html += "<h4>Dikkat Edilmesi Gerekenler</h4><p>" + aiHtmlEsc(veri.dikkat) + "</p>";
  if(veri.satista) html += "<h4>Satışta Nasıl Anlatılır?</h4><p>" + aiHtmlEsc(veri.satista) + "</p>";
  if(veri.veriEksikUyarisi) html += "<p class='ai-modal-not'>⚠️ " + aiHtmlEsc(veri.veriEksikUyarisi) + "</p>";
  html += "</div>"
    + "<div class='ai-modal-alt-satir'>"
    + "<button class='ai-modal-yenile-btn' id='aiModalYenileBtn'>🔄 AI Açıklamasını Yenile</button>"
    + "<button class='ai-modal-kapat-btn' id='aiModalKapatBtn'>Kapat</button>"
    + "</div>";
  icerik.innerHTML = html;
  aiAltButonlariBagla(false);
}

function aiAltButonlariBagla(hataDurumuMu){
  var yenileBtn = document.getElementById("aiModalYenileBtn");
  var kapatBtn = document.getElementById("aiModalKapatBtn");
  if(yenileBtn) yenileBtn.onclick = function(){
    if(!aiSonAcilanUrun) return;
    AiUrunAsistani.ac(aiSonAcilanUrun.ad, aiSonAcilanUrun.berta, aiSonAcilanUrun.abas, aiSonAcilanUrun.fiyat, true);
  };
  if(kapatBtn) kapatBtn.onclick = aiModalKapat;
}

async function aiAcikla(ad, berta, abas, fiyat, zorlaYenile){
  try{
    if(aiIstekDevamEdiyor) return; // dokümandaki 13. madde: çift istek engeli
    aiSonAcilanUrun = {ad:ad, berta:berta, abas:abas, fiyat:fiyat};
    var anahtar = aiUrunAnahtariUret(ad, berta, abas);

    aiModalAc(ad);

    if(!zorlaYenile){
      var onbellek = aiCacheOku(anahtar);
      if(onbellek){ aiSonucGoster(onbellek); return; }
    }

    aiIstekDevamEdiyor = true;
    aiYukleniyorGoster();

    var idToken = null;
    try{
      var kullanici = firebase.auth().currentUser;
      if(kullanici) idToken = await kullanici.getIdToken();
    }catch(e){}

    // Zaman sınırı (01.10.2026 düzeltmesi): fonksiyon henüz deploy
    // edilmediyse veya ağ yanıt vermezse istek SÜRESİZ askıda kalmasın —
    // en fazla 10 saniye beklenir, sonra anlaşılır hata gösterilir.
    var kontrolcu = new AbortController();
    var zamanAsimi = setTimeout(function(){ kontrolcu.abort(); }, 10000);
    var yanit;
    try{
      yanit = await fetch(AI_FONKSIYON_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": idToken ? ("Bearer " + idToken) : ""
        },
        body: JSON.stringify({ urun: { ad: ad, berta: berta, abas: abas, fiyat: fiyat } }),
        signal: kontrolcu.signal
      });
    }finally{
      clearTimeout(zamanAsimi);
    }

    if(!yanit.ok) throw new Error("HTTP " + yanit.status);
    var veri = await yanit.json();
    if(veri.error) throw new Error(veri.error);

    aiCacheYaz(anahtar, veri);
    aiSonucGoster(veri);
  }catch(e){
    console.error("AI ürün açıklama hatası:", e);
    if(typeof HataLog !== "undefined") HataLog.kaydet("AI ürün açıklama hatası: " + e.message);
    aiHataGoster();
  }finally{
    aiIstekDevamEdiyor = false;
  }
}

var AiUrunAsistani = {
  ac: aiAcikla
};

document.addEventListener("DOMContentLoaded", function(){
  var overlay = document.getElementById("aiModalOverlay");
  var kapatX = document.getElementById("aiModalKapatX");
  if(kapatX) kapatX.onclick = aiModalKapat;
  if(overlay){
    overlay.addEventListener("click", function(ev){
      if(ev.target === overlay) aiModalKapat();
    });
  }
});
