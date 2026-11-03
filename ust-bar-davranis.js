/*
  ust-bar-davranis.js — TKP.01.11.26-18:36.1334
  ===============================================
  Birleşik üst bar (.ub-bar) genel JS davranışı — şu an sadece Kapat (✕).

  TEK GÖREVİ: "#btnUstKapat" tuşuna basılınca, sayfa içi bir geçmiş varsa
  (bu sekmede önceki bir sayfadan gelindiyse) BİR ÖNCEKİ İŞLEME dön, yoksa
  Ana Sayfa'ya git (01.11.2026, Abdullah onayı — "x tusu tıklayınca ana
  sayfaya dönsün veya sayfa içinde ise 1.onceki işleme dönsün").

  "1 önceki işlem" = bu sayfaya UYGULAMA İÇİNDEN gelinmiş olması
  (document.referrer aynı siteden VE window.history.length > 1) — sadece
  "window.history.length > 1" yetersiz: sekme ilk kez bu sayfada açıldığında
  bile tarayıcı/WebView'in kendi iç geçmişi (örn. about:blank girişi) bunu
  >1 gösterebiliyor, bu da Kapat'ın "geri"sini sayfanın DIŞINA (boş/yanlış
  bir yere) götürebilir. "document.referrer" ise SADECE gerçek bir link
  tıklaması veya "location.href=..." ile buraya gelindiyse dolu olur — bu
  projede TÜM sayfa içi yönlendirmeler zaten bu ikisinden biri, bu yüzden
  güvenilir bir sinyal. Belge Önizleme'nin KENDİ Kapat düğmesi (bkz.
  belge-render.js, btnBelgeKapat) sade "history.length > 1" kullanıyordu —
  o sayfaya burada dokunulmadı, ama bu yeni genel kural daha sağlam.

  Menü (çekmece açma) zaten kendi mantığıyla, Geri zaten doğrudan
  href="home.html" ile çalıştığı için bu dosyaya dahil değiller — sadece
  Kapat, çünkü HER sayfada aynı "disabled" placeholder olarak kalmıştı.

  Home.html'de Kapat bilerek "disabled" bırakıldı (bu dosya dokunmuyor) —
  Ana Sayfa'dan "kapatılacak" ya da "bir öncekine dönülecek" bir iş yok.
  Belge Önizleme'nin KENDİ Kapat düğmesi (id="btnBelgeKapat", farklı id)
  zaten ayrı çalıştığı için bu dosya onu da ETKİLEMİYOR (seçici farklı id).

  İZOLE dosya (ust-sabit-olcum.js ile aynı prensip): try/catch içinde,
  hata olursa sayfanın geri kalanını asla bozmaz.
*/
(function(){
  function kapatTiklandi(){
    try{
      var ref = document.referrer || "";
      var ayniSiteden = ref.indexOf(window.location.origin) === 0;
      if(ayniSiteden && window.history.length > 1){
        window.history.back();
      } else {
        window.location.href = "home.html";
      }
    }catch(e){
      try{ window.location.href = "home.html"; }catch(e2){}
    }
  }
  function baglan(){
    try{
      var btn = document.getElementById("btnUstKapat");
      if(!btn) return;
      // Sayfa kendi Kapat davranışını tanımlıyorsa (örn. cart.html: işlemi
      // iptal + sepeti boşalt, 03.11.2026) genel davranış bağlanmaz.
      if(btn.getAttribute("data-ozel-kapat") === "1") return;
      btn.disabled = false;
      btn.onclick = kapatTiklandi;
    }catch(e){}
  }
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", baglan);
  } else {
    baglan();
  }
})();
