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
console.log('PASS: snapshot helper ve eşleme kontrolleri');
