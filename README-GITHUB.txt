İŞ TAKİP — Mail İşlem Notu Geliştirmesi
Tarih: 23.11.2026

Bu paket yalnızca Mail Önizleme sayfasına işlem özel notu eklemek ve notu ilgili işlem kaydında kalıcı saklamak için gereken dosyaları içerir.

GitHub TKP-main içinde aynı konumdaki dosyaların yerine yüklenmesi gerekenler:
- send.html
- send-render.js
- send-style.css
- ust-bar-eylem.js
- belge-render.js
- belge-onizleme.html

Önce mevcut dosyaların yedeğini alın. Dosyaları aynı klasör konumlarında değiştirip commit edin.

Özellik:
- Gönder sayfasında BİM tuşu işlem-notu panelini açar.
- Not, mevcut SendData.alanlariGuncelle transaction işlevi kullanılarak arsiv/<belge türü> kaydının mailNot alanına yazılır.
- Mail önizlemesinde ve mail için oluşturulan işlem görselinde sarı NOT paneli gösterilir.
- Not boşsa NOT paneli oluşturulmaz.
- Belge Önizleme sayfasında kayıtlı mailNot gösterilir.
- WhatsApp metni/tabloları, sepet hesaplamaları, müşteri kayıtları ve Firebase yapılandırması değiştirilmemiştir.

NOT: Canlıya yükleme yapılmadı. Firebase üzerinde gerçek yazma testi, mobil cihaz testi ve gönderim doğrulaması kullanıcı GitHub yayınından sonra yapılmalıdır.
