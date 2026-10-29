/*
  sw.js — WG.291026.1025.1226
  =========================================
  KALICI, HİÇBİR ŞEY ÖNBELLEKLEMEYEN SERVICE WORKER (29.10.2026, Abdullah
  bildirdi — "Yükle" (gerçek uygulama kurulumu) Chrome'da "Bu uygulama
  yüklenemez" diyerek devre dışı çıkıyordu, sadece "Kısayol oluştur"
  kalıyordu).

  ÖNCEKİ SÜRÜM (22.10.2026) kendini kaydeder kaydetmez ANINDA kendini
  siliyordu (self.registration.unregister()) — eski v1 uygulamadan kalma,
  bazı cihazlarda hâlâ bayat dosya sunan service worker'ları temizlemek
  içindi. Ama bunun yan etkisi: proje artık HİÇBİR ZAMAN kalıcı, aktif bir
  service worker'a sahip olmuyordu — Chrome'un bazı cihaz/sürümlerde
  "Yükle" (WebAPK) seçeneği için aradığı şart da tam olarak bu.

  BU SÜRÜM kayıtlı KALIR ama hiçbir isteği önbelleğe almaz — her istek
  olduğu gibi ağa gider (pass-through). "fetch" dinleyicisi SADECE
  "service worker var ve istekleri yönetiyor" şartını karşılamak için
  burada; davranışı normal bir ağ isteğinden farksızdır, yani eski
  "cihazlar arası bayat içerik" hatası bir daha YAŞANAMAZ. Eski
  cihazlardan kalma TÜM eski önbellekleri (varsa) bir kerelik temizler.
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
  // Hiçbir şey önbelleklenmiyor — her istek doğrudan ağa gidiyor.
  event.respondWith(fetch(event.request));
});
