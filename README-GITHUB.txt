İŞ TAKİP — Mail NOT ve gerçek mail görseli güncellemesi
23.11.2026

Bu pakette sadece aşağıdaki dosyalar yer alır. GitHub TKP-main içindeki aynı dosyaların yedeklerini aldıktan sonra bunları aynı konumlarda değiştirin:
- send.html
- send-render.js
- send-style.css
- ust-bar-eylem.js
- belge-render.js
- belge-onizleme.html

İşlev:
- Gönder (Mail Önizleme) sayfasında üst BİM tuşu işlem özel NOT panelini açar.
- Not SendData.alanlariGuncelle üzerinden arsiv kaydının mailNot alanına saklanır.
- Mail önizlemesi ve mail eki oluşturulurken kullanılan belgeGorselHtmlOlustur(..., "mail", ...) fonksiyonuna not dahil edilir; gerçek PNG görseli html2canvas ile alınırken not da görselin parçası olur.
- Not boşsa sarı NOT paneli üretmez.
- Belge Önizleme geçmiş kaydında mailNot gösterilir.
- Not metni HTML kaçışından geçirilerek görüntülenir.

Kontrol:
- send-render.js, belge-render.js ve ust-bar-eylem.js Node sözdizim kontrolünden geçti.
- HTML panel işaretleri kontrol edildi.
- Firebase canlı yazma, gerçek mail/PNG gönderim ve cihaz testi yapılmadı. GitHub yayınından sonra test edilmelidir.
- Firebase yapılandırması veya canlı veri bu hazırlık sırasında değiştirilmedi.
