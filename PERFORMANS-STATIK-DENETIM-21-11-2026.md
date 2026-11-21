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
