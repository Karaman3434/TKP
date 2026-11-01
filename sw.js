/*
  sw.js — TKP.02.11.26-01:59.1354
  =========================================
  HİÇBİR ŞEY ÖNBELLEKLEMEYEN, SADECE SAYFA GEÇİŞLERİNİ AĞA ASLINDA OLDUĞU
  GİBİ ileten kalıcı service worker.

  DÜZELTME (02.11.2026): önceki sürümün (29.10.2026) açıklaması YANLIŞTI.
  "Chrome'un 'Yükle' (WebAPK) seçeneği kalıcı bir service worker arıyor"
  denmişti — oysa Chrome, menüden "Yükle" için service worker/fetch
  dinleyicisi şartını MOBİLDE 108. sürümden beri aramıyor (bkz.
  developer.chrome.com/blog/update-install-criteria). Yani "Bu uygulama
  yüklenemez" uyarısının nedeni bu dosya değildi ve bu dosya onu çözmez.
  Kurulum şartları manifest.json'da; kurulumun gerçek nedenini telefonda
  görmek için pwa-tani.html sayfası var.

  Bu dosya YİNE DE duruyor çünkü (1) .github/workflows/health-check.yml
  her push'ta sw.js'in erişilebilir olmasını ve bir "fetch" dinleyicisi
  içermesini bekliyor, (2) auth.js her sayfada bunu kaydediyor — kaldırmak
  gereksiz risk. Davranışı: istekler olduğu gibi ağa gider, hiçbir şey
  önbelleğe ALINMAZ — eski "cihazlar arası bayat içerik" hatası bir daha
  yaşanamaz. Sadece sayfa geçişleri (navigate) buradan geçer; görsel, CSS,
  JS, Firebase gibi diğer tüm istekleri tarayıcı kendisi yönetir (eski
  sürümde hepsi buradan geçiyordu; gereksizdi). Eski cihazlardan kalma TÜM
  eski önbellekler (varsa) bir kerelik temizlenir.
*/
self.addEventListener("install", function(event){
  self.skipWaiting();
});
self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys()
      .then(function(names){ return Promise.all(names.map(function(n){ return caches.delete(n); })); })
      .then(function(){ return self.clients.claim(); })
  );
});
self.addEventListener("fetch", function(event){
  // Sadece sayfa geçişleri; diğer istekler tarayıcının kendi akışında kalır.
  if(event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request));
});
