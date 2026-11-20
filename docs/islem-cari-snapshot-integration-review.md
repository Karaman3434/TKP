# İşlem Bazlı Cari Snapshot — Entegrasyon Ön İncelemesi

Bu belge yalnızca test dalındaki inceleme çıktısıdır. Canlı kod/Firebase verisine yazma veya değişiklik yapmaz.

## Kaynak alanları (GitHub test dalındaki mevcut uygulama kodundan)
- Cari kod: müşteri nesnesi `id`.
- Cari adı: `ad`.
- İlçe: `sehir` alanı (uygulamada ilçe metni olarak kullanılıyor).
- İl: `il` alanı; bazı eski kayıtlarda eksik olabileceği için mevcut konum yardımcıları ID ile master listeden yedek arıyor.
- Vade: `vade`.
- Fatura tipi: `fatura`.
- Kargo: `kargo`.
- Fatura adresi: `faturaAdresleri[index]`; seçim yoksa legacy fallback `acikAdres` ilk adres olarak kullanılıyor.
- Teslimat adresi: `teslimatAdresleri[index]` (seçim opsiyonel).
- Yetkili: `iletisimler[index]`; çoklu seçim indeksleri ve adları `weiconv2_secili_iletisim` anahtarında tutuluyor.
- Not: işlem snapshot'ı için henüz kesin kaynak/ekran belirlenmedi; entegrasyonda açık seçim/kullanıcı girdisi gerekecek.

## Kayıt yolları ve korunması gereken davranışlar
- Sepet kaydı: `cart-render.js -> SendData.kaydet(..., seciliAdresler,...)`.
- `SendData.kaydet` arşiv yolunda transaction ile mevcut kayıtları revize edebiliyor; revize durumunda snapshot'ın önceki değerini koruma veya kullanıcı yeni seçimi açıkça yaptıysa güncelleme politikası belirlenmeli.
- Gönder ekranında kayıt güncelleme: `SendData.islemiGuncelle` ürün/kur/KDV/adres bilgilerini güncelliyor; snapshot alanını ezmeden korumalı.
- Bekleyen/ilerlet akışı, kaynak kayıt silme/bağlama ve rota zincirleri snapshot'ı yeni kayda kopyalamalı.
- Legacy kayıtlarda snapshot yoksa, mevcut ekranların çalışması devam etmeli; geriye dönük otomatik dönüşüm yok.

## Entegrasyon öncesi açık risk / kararlar
1. Vade, fatura tipi, kargo ve fatura adresi yeni işlemde master kayıttan başlangıç değeri olarak okunacak; kullanıcı işlem bazında değiştirebilecek mi, yoksa sadece seçme mi yapacak? (Kullanıcı gereksinimi: işlem başına bağımsız kayıt.)
2. Revize: eski snapshot, yeni işlem seçimi açıkça yapılmadıkça korunmalı.
3. Müşteri kartı güncellenmesi veya listelerin canlı şehir gösterimi, snapshot ekranlarında snapshot'ın yerine geçmemeli.
4. Snapshot mail/rapor/son işlemler render'larında tek kaynak olacak şekilde yayılmadan önce izole fixture testleri gerekir.
5. Test dalında uygulama akışına bağlantı, Firebase emülasyonu veya cihaz testi henüz yapılmadı.

## Güvenli sıra
Alan eşleme ve UI seçim modeli -> snapshot oluşturma/validation -> arşiv kayıt transaction'ına minimal entegrasyon -> revize ve ilerlet/ bekleyen akışlarına koruma -> render/ mail/rapor okuyucularına snapshot önceliği -> eski kayıt fixture testleri -> cihaz testi -> ayrı kullanıcı onayıyla canlıya taşıma.
