/* Snapshot helper için izole regresyon testleri. Firebase/app kayıtlarına yazmaz. */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(require('path').join(__dirname,'..','islem-cari-snapshot.js'),'utf8');
const context={Date,JSON,Array,String,Number};vm.runInNewContext(source,context);const api=context.IslemCariSnapshot;
const input={musteriKodu:'M-0001',musteriAdi:'Test Firma',ilce:'Sincan',sehir:'Ankara',vade:'60 gün',fatura:'TL Fatura',kargo:'Ücretsiz',faturaAdresi:'Adres 1',teslimatAdresi:'Adres 2',yetkililer:[{isim:'Test',telefon:'000'}],not:'Not'};
const result=api.olustur(input);assert.strictEqual(result.gecerli,true);assert.deepStrictEqual(Array.from(result.eksik),[]);assert.strictEqual(result.snapshot.schemaVersion,1);
input.yetkililer[0].isim='Değişti';assert.strictEqual(result.snapshot.yetkililer[0].isim,'Test','derin kopya kaynak değişiminden etkilenmemeli');
const incomplete=api.olustur({musteriKodu:'M-1'});assert.strictEqual(incomplete.gecerli,false);assert.ok(Array.from(incomplete.eksik).includes('faturaAdresi'));
const legacy={ts:123,musteri:'Eski kayıt'};assert.strictEqual(api.kayittanOku(legacy),null);
const saved={transactionCustomerInfo:result.snapshot},read=api.kayittanOku(saved);read.musteriAdi='Mutasyon';assert.strictEqual(saved.transactionCustomerInfo.musteriAdi,'Test Firma');
const master={id:'M-2',ad:'Firma 2',sehir:'Temelli',il:'Ankara',vade:'30',fatura:'TL',kargo:'Ücretli',acikAdres:'Master adres'};
const mapped=api.musteridenOlustur(master,{faturaAdresi:'İşlem adresi',teslimatAdresi:'Teslim adresi',yetkililer:[{isim:'Yetkili'}]},{teslimatSecildi:true,yetkililerSecildi:true,notSecildi:true,not:'İşlem notu'});
assert.strictEqual(mapped.gecerli,true);assert.strictEqual(mapped.snapshot.faturaAdresi,'İşlem adresi');assert.strictEqual(mapped.snapshot.teslimatAdresi,'Teslim adresi');assert.strictEqual(mapped.snapshot.not,'İşlem notu');
const noOptional=api.musteridenOlustur(master,{},{});assert.strictEqual(noOptional.snapshot.teslimatAdresi,'');assert.deepStrictEqual(Array.from(noOptional.snapshot.yetkililer),[]);assert.strictEqual(noOptional.snapshot.not,'');

// Tarih sabitleme ve biçim normalizasyonu: kayıt tarihi girdiden gelirse aynen korunur.
const dated=api.olustur({musteriKodu:'D-1',musteriAdi:'Tarih Firma',ilce:'İlçe',sehir:'Şehir',vade:'30',fatura:'Fatura',kargo:'Kargo',faturaAdresi:'Adres',capturedAt:1700000000000});
assert.strictEqual(dated.snapshot.capturedAt,1700000000000);
// Adres nesnesi kullanılıyorsa adres alanı normal biçimde snapshot'a alınır.
const addressObject=api.olustur({musteriKodu:'A-1',musteriAdi:'Adres Firma',ilce:'İlçe',sehir:'Şehir',vade:'30',fatura:'Fatura',kargo:'Kargo',faturaAdresi:{adres:'  Nesne adres  '}});
assert.strictEqual(addressObject.snapshot.faturaAdresi,'Nesne adres');
// Master Cari'deki genel adres, seçim adresi yoksa güvenli fallback olarak kullanılabilir.
assert.strictEqual(noOptional.snapshot.faturaAdresi,'Master adres');
// Seçilmemiş teslimat adresi ve yetkililer master verisinden kendiliğinden alınmamalı.
const masterWithContacts=Object.assign({},master,{yetkililer:[{isim:'Master Yetkili'}],teslimatAdresi:'Master teslim'});
const noneSelected=api.musteridenOlustur(masterWithContacts,{}, {yetkililerSecildi:false,teslimatSecildi:false});
assert.strictEqual(noneSelected.snapshot.teslimatAdresi,'');
assert.deepStrictEqual(Array.from(noneSelected.snapshot.yetkililer),[]);
// Boş ama açıkça seçilmiş yetkili listesi de boş snapshot olarak korunmalı.
const emptySelection=api.musteridenOlustur(masterWithContacts,{yetkililer:[]},{yetkililerSecildi:true});
assert.deepStrictEqual(Array.from(emptySelection.snapshot.yetkililer),[]);
console.log('PASS: snapshot helper ve genişletilmiş regresyon kontrolleri');
