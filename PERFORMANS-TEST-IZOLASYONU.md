# Performans test izolasyonu — hazırlık

## Güvenlik durumu
- Bu dal `test/performans-olcum-2026-11-17` dalından türetilmiştir.
- Canlı Firebase yapılandırması bu dalın `firebase-config.js` dosyasından kaldırılmıştır.
- `istakip-performans-test` için yalnızca placeholder değerler vardır. Gerçek proje oluşturulmadan ve yapılandırma tamamlanmadan uygulama çalıştırılmamalıdır.
- Placeholder API key / App ID / messaging ID geçerli değildir; bu dal bilerek çalıştırılabilir test ortamı olarak sunulmamaktadır.
- Bu dal dağıtılmadı ve canlı projeye merge edilmedi.

## Firebase test projesi kurulmadan önce zorunlu kontrol listesi
1. Google Firebase Console'da ayrı `istakip-performans-test` projesi oluştur.
2. Realtime Database'i ayrı proje içinde oluştur; canlı `weicon-asist` DB URL'sini kullanma.
3. Test Authentication sağlayıcılarını ve test kullanıcılarını ayrı projede yapılandır.
4. Test verisini gerçek müşteri/işlem verisi içermeyen sentetik kayıtlarla oluştur.
5. Test DB güvenlik kurallarını doğrula; açık erişim (public read/write) kullanma.
6. Bu dalda config değerlerini test projesinin gerçek config'i ile değiştir.
7. Config denetimi: projectId tam olarak `istakip-performans-test`; authDomain, databaseURL, appId ve storageBucket aynı test projesine ait olmalı.
8. Repo/HTML/workflow/Service Worker kapsamını incele; Pages dağıtımı veya live URL üzerinden çalışma yapılmasın.
9. Başlatma öncesi statik inceleme ve test proje doğrulaması; ardından yalnızca izole test ortamında kontrollü ölçüm.

## Ölçüm planı (davranış değişikliği yapmadan)
- Firebase auth persistence çağrısı / auth state callback zamanları.
- Auth akışındaki salt-okuma kontrolleri: cihaz engel durumu, kısıtlı kullanıcı kaydı, cihaz onay kaydı. (Yazma aşamaları test data üzerinde ayrı işaretlenecek.)
- Her Firebase listener'ın ilk callback zamanlaması: `arsiv`, `musteriler` ve ilgili rapor listener'ları.
- Callback sonrası normalize etme, hesaplama ve listener dispatch süreleri.
- Ölçüm raporu kişisel kayıt içeriği içermeyecek; yalnızca aşama adları, süreler, hata türü ve sentetik veri hacmi bilgileri.
- Ölçüm modülü yalnızca test dalında etkin olacak ve uygulama işlevlerini/DOM'u değiştirmeyecek.

## Durdurma kriterleri
- Test projesi kimliği veya credential belirsizse dur.
- Herhangi bir canlı Firebase URL / projectId saptanırsa çalıştırmayı durdur.
- Canlıya deployment, merge, veri yazımı veya UI değişikliği yapılmaz.
