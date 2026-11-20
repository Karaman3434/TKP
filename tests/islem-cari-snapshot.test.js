/*
 * Snapshot yardımcı fonksiyonları için bağımsız regresyon kontrolü.
 * Çalıştırma: node tests/islem-cari-snapshot.test.js
 * Uygulama/Firebase kayıtlarına erişmez ve yazmaz.
 */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const source = fs.readFileSync(require('path').join(__dirname, '..', 'islem-cari-snapshot.js'), 'utf8');
const context = { Date, JSON, Array, String, Number };
vm.runInNewContext(source, context);
const api = context.IslemCariSnapshot;
const valid = {
  musteriKodu: 'M-0001', musteriAdi: 'Test Firma', ilce: 'Sincan', sehir: 'Ankara',
  vade: '60 gün', fatura: 'TL Fatura', kargo: 'Ücretsiz', faturaAdresi: 'Adres 1',
  teslimatAdresi: 'Adres 2', yetkililer: [{isim:'Test', telefon:'000'}], not:'Not'
};
const result = api.olustur(valid);
assert.strictEqual(result.gecerli, true, 'zorunlu alanlarla geçerli snapshot oluşmalı');
assert.deepStrictEqual(Array.from(result.eksik), [], 'eksik alan listesi boş olmalı');
assert.strictEqual(result.snapshot.schemaVersion, 1);
assert.strictEqual(result.snapshot.yetkililer[0].isim, 'Test');
// Kopya bağımsızlığı: kaynağı değiştirince snapshot etkilenmemeli.
valid.yetkililer[0].isim = 'Değişti';
assert.strictEqual(result.snapshot.yetkililer[0].isim, 'Test');
const incomplete = api.olustur({musteriKodu:'M-1'});
assert.strictEqual(incomplete.gecerli, false, 'eksik zorunlu alanlar geçersiz olmalı');
assert.ok(Array.from(incomplete.eksik).includes('faturaAdresi'));
const legacy = {ts:123, musteri:'Eski kayıt'};
assert.strictEqual(api.kayittanOku(legacy), null, 'legacy kayıtta snapshot yoksa null');
const saved = {transactionCustomerInfo: result.snapshot};
const read = api.kayittanOku(saved);
read.musteriAdi = 'Okuma kopyası değişti';
assert.strictEqual(saved.transactionCustomerInfo.musteriAdi, 'Test Firma', 'okuma kopyası kayıt nesnesini mutasyona uğratmamalı');
console.log('PASS: snapshot yardımcı kontrolleri');
