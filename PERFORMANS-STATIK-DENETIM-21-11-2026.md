# Statik Firebase Izolasyon Denetimi (21.11.2026)

## Kapsam
Yalnizca test/firebase-isolation-prep-20261121 dalindaki dosyalar incelendi. Uygulama calistirilmedi; Firebase'e baglanilmadi; veri yazilmadi.

## Bulgular
- firebase-config.js test projectId ve placeholder API key kullanmakta.
- Birden fazla dosyada firebase.initializeApp fallback yapisi var. Bu fallback, config dosyasinin yukleme sirasi/eksikligi durumunda test config ile Firebase'i baslatabilir; test credential yokken uygulama calistirilmayacak.
- auth.js, cihaz-data.js, km-data.js ve ayarlar-sync.js Firebase tarafinda okuma/yazma yapan akislari barindiriyor. Auth akisi cihaz kaydi update; KM modulu birden fazla node listener; ayarlar-sync kur kaynaklarina dis HTTP istekleri de baslatabiliyor.
- sw.js navigasyon isteklerini fetch ile aktarir ve activate sirasinda cache temizleme yapar. Test Pages URL/scope kontrol edilmeden deployment veya uygulama calistirmasi yapilmamali.
- firebase.json sadece database.rules.json referansi iceriyor; bu dalda Firebase deploy komutu calistirilmadi.
- GitHub Actions health-check.yml halen public production Pages adresine (karaman3434.github.io/TKP) istek atiyor. Bu workflow, test dalinda push/schedule/manual tetiklenirse production Pages'i salt HTTP kontroluyle ziyaret eder; deploy yapmaz ancak test izolasyonu icin test dalinda tetikleme kapsam/branch ayarlari incelenmelidir.

## Durum / Risk
Bu statik inceleme, test branch'inin Firebase projesi gercekten izole oldugunu veya test config ile uygulamanin guvenli calistigini kanitlamaz. Test projesi yok ve uygulama calistirilmadi. Canli sistemlere baglanma/yazma riski, config ve URL denetimleriyle azaltildi; yine de calistirma oncesi kapsamli URL/HTML script sirasi ve rules audit gereklidir.

## Sonraki adimlar
1. Workflow trigger'larini test branch'inde production Pages kontrolunu tetiklemeyecek sekilde denetle; gerekli degisiklikleri izole dalda yap.
2. Tum HTML dosyalarinda Firebase SDK, firebase-config.js ve Firebase kullanan modullerin script sirasi / config include kontrolu.
3. Tum sabit Firebase / Cloud Function / Pages URL'lerinin kapsamli taramasi.
4. Test Firebase projesi olusturulup kimlik, database, rules ve endpointler dogrulanmadan runtime test yapma.
5. Test ortaminda sentetik data kullan, canli musteri verisi kullanma.


## HTML script-order incelemesi — ek bulgular

- Daldaki HTML dosyasi envanteri 58 sayfa/yonlendirme dosyasi.
- Ana uygulama sayfalarindan home.html, pin.html, login.html, reports.html, cart.html, send.html, menu.html, customer.html, km.html dahil incelenenlerde firebase-config.js, auth.js'den once yukleniyor.
- Ajanda, ayarlar, customer-add, customer-detail, customer-hub, customer-temas, hata-kayitlari, kacan-satislar, raporlar, satis-listesi, urun-yukle, veri ve ziyaret sayfalarinda da script referanslarinin statik sirasi config oncesinde auth olacak sekilde incelendi; ziyaret.html'de config/auth indeksleri 6/7.
- cihazlar.html, calisan-erisim.html ve product.html eski sayfa/bridge dosyalari; Firebase SDK veya auth scripti yuklemiyor, eski URL'leri ilgili yeni sayfalara yonlendiriyor.
- Bu kontrol browser/runtime testi degildir. Kalan sayfalar, inline script davranislari, URL'ler, script order ve yonlendirme zincirleri kapsamli otomatik tarama ile ek kontrol gerektirir.


## Firebase dinleyici envanteri — 21.11.2026 devam incelemesi

- `home-data.js` içinde `IsTakipData.baslat()` ile `arsiv` yolu için bir `.on("value")` dinleyicisi açılıyor.
- Aynı `home-data.js` içinde `bildirimVerisiDinlemeyeBasla()` fonksiyonu ayrıca `arsiv` için ikinci `.on("value")` dinleyicisi açıyor. `home-render.js` bu fonksiyonu çağırıyor (statik kod incelemesi).
- `reports-data.js` modülü de `arsiv` için ayrı bir `.on("value")` dinleyicisi açıyor ve modül başlatma çağrısı dosya sonunda mevcut.
- Böylece ana sayfa modüllerinde arşiv kaynağı için mükerrer dinleme yapısı, kod düzeyinde doğrulandı. Üç dinleyicinin aynı oturum/sayfada etkinliği ve veri transferine etkisi runtime test gerektirir.
- `customer-data.js` `musteriler` için sürekli `.on("value")` dinler. Dinleyici callback'inde `kodsuzMusterilereKodAta()` çağrısı bulunur; bu, müşteri listesinde ID'siz kayıt bulunursa transaction tabanlı yazma girişimi başlatabilir. Runtime test yapılmadı.
- `km-data.js` başlangıçta `kmTakip`, `kmOdemeleri`, `kmCarpanlari`, `kmSirketHakki` ve `kmHatirlatmaNotu` için beş sürekli dinleyici açıyor. Bu sayfa/modül bazında veri kapsamı ve ihtiyaç kontrolü ayrıca yapılmalı.
- `ayarlar-sync.js` `ayarlar` için sürekli dinleyici açmanın yanı sıra kur güncelleme zincirini başlatır; sayfa yükleme koşulları ve HTTP isteklerinin kapsamı ayrıca incelenmeli.

### Öncelikli performans adayı (henüz değişiklik yapılmadı)
Ana sayfada arşiv verisinin tek bir dinleyici üzerinden paylaşılması/dağıtılması değerlendirilebilir. Ancak bildirim özeti, satış/prim hesapları ve ReportsData bağımlılıkları karşılaştırılmadan, davranış eşdeğerliği ve izolasyon testleri olmadan kod değişikliği yapılmayacaktır.
## Workflow tetikleme kapsamı incelemesi — devam

- `.github/workflows/health-check.yml` içindeki `push` tetikleyicisi yalnızca `main` branch'ini kapsıyor; test branch push'larında workflow otomatik çalışmıyor.
- `schedule` tetikleyicisi varsayılan branch üzerinde çalışır; test branch'i özel olarak schedule kapsamına alınmış görünmüyor.
- `workflow_dispatch` (manuel tetikleme) branch seçimine izin verebildiğinden, bu workflow test branch'inde elle çalıştırılırsa `https://karaman3434.github.io/TKP/` production Pages URL'sini salt HTTP kontrolleriyle ziyaret eder. Bu işlem deploy veya Firebase yazımı değildir, fakat test izolasyonu açısından test branch'inde manuel çalıştırılmamalıdır.
- Workflow kodu test branch'inde statik olarak okundu; herhangi bir değişiklik yapılmadı. Canlı siteye HTTP istekleri bu denetim sırasında tarafımızca gönderilmedi.

### Kapsam sınırlaması
- Bu bulgu yalnızca workflow dosyasının statik incelemesine dayanır; GitHub Actions geçmişi/gerçek tetiklenme davranışı doğrulanmadı.


## KM, ayarlar, auth ve service worker statik incelemesi — devam

### KM modülü (km-data.js)
- `baslat()` içinde beş sürekli `.on("value")` listener açılıyor: `kmTakip`, `kmOdemeleri`, `kmCarpanlari`, `kmSirketHakki`, `kmHatirlatmaNotu`.
- Ayrıca `kmTakipAyarlari` için `.once("value")` kullanımı mevcut.
- KM sayfasında bu verilerin tümünün ilk açılışta gerekli olup olmadığı, başka sayfalarda modülün yüklenip yüklenmediği ve transfer hacmi runtime/page matrix olmadan kanıtlanamaz. Listener sayısı tek başına sorun hükmü değildir.

### Ayarlar senkronu (ayarlar-sync.js)
- `ayarlar` node'u için sürekli listener, yerel kur/KDV/hedef/maaş-parametreleri alanlarını localStorage'a yazıyor ve dinleyicileri çağırıyor.
- Kur güncellemesi kur 2 saatten eski/eksik olduğunda devreye giriyor; kaynak zinciri TCMB → Frankfurter → yedek olarak belgelenmiş.
- Her kaynak isteği için 5 saniye AbortController timeout uygulanmış. AbortController olmayan ortamlarda timeout davranışı ayrıca sınırlı olabilir (kodda controller yoksa timeout signal gönderilmiyor).
- Bu dış kur çağrılarının sayfa açılışına etkisi, hangi sayfalarda modülün yüklendiği ve cache durumu ölçülmedi.

### Auth akışı (auth.js)
- Statik kodda cihaz engel, cihaz onay, kısıtlı kullanıcı ve KM günlük kontrol yollarında birden fazla `.once("value")` okuması görülüyor.
- Örnekler: cihaz engel kontrolü, cihaz kaydı/onay kontrolü, `kisitliKullanicilar/<uid>`, günlük KM kontrolü.
- Bu kontroller güvenlik/erişim kararlarını etkilediği için azaltma/birleştirme önerisi henüz yapılmıyor. Sıralama ve toplam gecikme ölçümü test ortamı gerektirir.

### Service worker (sw.js)
- Install sırasında `skipWaiting()`; activate sırasında mevcut cache adlarını silme ve `clients.claim()`; yalnızca navigation isteklerini `fetch(event.request)` ile ağdan geçiriyor.
- Statik kaynaklar/Firebase istekleri için SW fetch müdahalesi yok. Cache silme davranışının diğer cache kullanımını etkileyip etkilemediği, mevcut cache adlarının envanteriyle ayrıca kontrol edilmelidir; runtime test yapılmadı.

### Ana sayfa script yükleme envanteri — ek
- home.html; Firebase compat SDK, firebase-config.js, auth.js, ayarlar-sync.js, cihaz-data.js, home-data.js, customer-data.js, reports-data.js, vade-takip-data.js, takip-ozet-data.js, komisyon-donem-data.js, ajanda-data.js ve gun-notlari-data.js dahil birden fazla modülü aynı sayfada yüklemektedir.
- Bu liste statik HTML sırasıdır; modüllerin tümünün aynı anda Firebase bağlantısı/okuma başlatıp başlatmadığı veya dinleyicilerin etkili olup olmadığı runtime olmadan kesinleştirilemez.

### Öncelik ve karar
- KM sayfasındaki 5 sürekli listener ve ana sayfadaki arşiv dinleyicileri, sayfa/modül ihtiyaç matrisi ile birlikte değerlendirilmek üzere performans inceleme adaylarıdır.
- Auth/cihaz erişim kontrolleri güvenlik kritik olduğundan, performans adına değiştirilmesi ancak ayrı test Firebase, davranış eşdeğerliği testleri ve açık kullanıcı onayıyla ele alınabilir.
- Bu turda yalnızca rapor güncellendi; uygulama kaynak kodları, tasarım, canlı sistem ve Firebase üzerinde değişiklik yapılmadı; runtime test/deploy gerçekleştirilmedi.


## Endpoint ve yapılandırma taraması — 21.11.2026 devam

- İncelenen `firebase-config.js` dosyasında gerçek anahtarlar yerine TEST placeholder değerleri bulunuyor; `projectId` `istakip-performans-test` olarak tanımlı. Ancak test projesinin gerçekten oluşturulduğu/doğrulandığı kanıtlanmadı.
- `ai-config.js` içinde `ISTAKIP_AI_WORKER_URL` `.invalid` placeholder endpoint olarak ayarlı. Bu test dalındaki kart/fotoğraf analiz özelliği endpoint doğrulanmadan çalışabilir kabul edilmemelidir.
- `ai-urun-asistani.js` içinde `AI_FONKSIYON_URL` de `.invalid` placeholder. Ürün AI açıklama isteği gerçek test Cloud Function endpointi doğrulanana kadar işlevsel değildir.
- `ai-urun-asistani.js` kodunda ürün açıklama cache'i `localStorage` ile ürün kodu anahtarı üzerinden kullanılıyor; cache hit olduğunda HTTP çağrısı atlanıyor. Cache davranışının hız etkisi/validasyonu runtime test gerektirir.
- `pin.html` ve `login.html` statik incelemesinde Firebase compat SDK, config ve auth yükleme sırası gözlemlendi. Bu sayfalar test config ile çalıştırılmadan izolasyon doğrulanmış sayılmaz.
- GitHub kod arama dizini bu sorgularda sonuç vermedi; bu nedenle tüm repository genelinde URL/endpoint taramasının tamamlandığı iddia edilmemektedir. Bu bölüm, yalnızca bu turda doğrudan fetch edilip incelenen dosyalara dayanır.

### Güvenlik ve test engeli
Test Firebase projesi, Auth/Realtime Database/Rules ve test Cloud Function endpointleri doğrulanmadan uygulama çalıştırma, Firebase yazma testi veya performans ölçümü yapılmamalıdır. Bu turda kaynak kod, canlı branch, canlı Firebase, tasarım ve deployment üzerinde değişiklik yapılmadı.

### Bir sonraki statik inceleme
Sayfa-modül matrisi, URL referansları ve veri okuma/yazma kapsamını dosya bazında genişlet; bulguları yalnızca denetim raporuna kaydet. Kod optimizasyonu için ayrı test ortamı ve davranış eşdeğerliği kanıtı gereklidir.


## Sayfa-modül yükleme matrisi (kısmi, statik) — 21.11.2026

Bu turda home.html, reports.html, customer.html, km.html ve cart.html sayfalarının script kaynak listeleri test dalında doğrudan incelendi. Bu matris yalnızca HTML'de bulunan script src sırasını yansıtır; scriptlerin çalışıp çalışmadığı, Firebase çağrıları veya runtime eşzamanlılığı ölçülmedi.

- **home.html:** Firebase SDK (app/database/auth compat), firebase-config, auth, üst-bar ölçüm, ayarlar-sync, cihaz-data, cihaz-isim-zorunlu, home-data, customer-data, reports-data, vade-takip-data, takip-ozet-data, hata-log, rota-takip, komisyon-dönem-data, ajanda-data, gün-notları-data, üst-bar davranış, menu-çekmece, ajanda-foto, home-takvim-render, home-takip-buton, home-render, kur-panel, bekleyen-islemler, performans-ölçüm. Ana sayfa script zinciri geniş; modüllerin gereksiz yüklenip yüklenmediği ayrıca fonksiyon/izin kullanımına göre doğrulanmalıdır.
- **reports.html:** Firebase SDK/config/auth; cihaz/üst-bar/ayarlar; customer-data; reports-data; vade-takip-data; reports-safety-fix; hata-log; reports-render; bekleyen-islemler; menu-cekmece. Ayrıca XLSX (cdnjs) dış kütüphanesi yükleniyor. XLSX'in ilk açılışta mı yoksa export için mi gerekli olduğu runtime/işlev incelemesi ile doğrulanmalı; yükleme gecikmesi veya dinamik yükleme önerisi henüz uygulanmıyor.
- **customer.html:** Firebase SDK/config/auth; cihaz ve üst-bar; customer-data; reports-data; vade-takip-data; hata-log; rota-takip; customer-render; bekleyen-islemler; menu-cekmece. Müşteri sayfası rapor ve vade veri modüllerini de yüklediğinden bunların müşteri ekranında gerçekten gerekli olup olmadığı sonraki statik fonksiyon referansı incelemesinde belirlenmeli.
- **km.html:** Firebase SDK/config/auth; auth; cihaz/üst-bar; km-data; hata-log; km-render; bekleyen-islemler; menu-çekmece. Diğer bazı sayfalardaki customer/reports/vade modüllerinden farklı, daha dar bir data zinciri gözlemlendi.
- **cart.html:** Firebase SDK/config/auth; config/auth; cihaz/üst-bar; ayarlar-sync; ikon-svg; hareket-tablo; cart-data; product-data; customer-data; müşteri-şerit; reports-data; vade-takip-data; reports-safety-fix; send-data; hata-log; rota-takip; kur-panel; cart-render; urun-arama; hesapla-popup; bekleyen-islemler; menu-çekmece. İşlem ekranı modül zinciri geniş ve modüller arası bağımlılık analizi gerektiriyor; kaldırma veya değiştirme önerisi ancak kullanım referansları ve testle değerlendirilebilir.

### Ön değerlendirme (henüz optimizasyon kararı değil)
1. Ana sayfa, müşteri ve işlem ekranlarında reports-data/vade-takip-data gibi ortak veri modüllerinin yüklenmesi, kullanım ve izin kontrolleriyle karşılaştırılarak incelenmeli.
2. XLSX kütüphanesinin reports sayfasında başlangıçta yüklenmesi, export işleviyle ilişkilendirilmeli; gecikmeli yükleme ancak mevcut davranış ve desteklenen tarayıcılar test edilirse aday olabilir.
3. Ortak script yükleme sırası güvenlik ve sayfa davranışları için kritik; herhangi bir script sırası değişikliği yapılmadı.
4. Matris kısmi kapsamlıdır; 58 HTML dosyasının tamamı incelenmiş değildir.
5. Bu turda yalnızca denetim raporu güncellendi. Uygulama kodu, canlı dal, canlı Firebase, tasarım ve dağıtım değişmedi.
