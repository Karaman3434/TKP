/* reports-safety-fix.js — TKP.11.11.26-14:20.1566 */
/* WE-CON-CRM — reports safety layer
   HATA-004: Replaces stale read -> set writes with Realtime Database transactions.
   Loaded AFTER reports-data.js so existing UI/data contracts remain unchanged.
*/
(function(){
  if(typeof ReportsData === 'undefined' || typeof firebase === 'undefined') return;

  function normalizeList(value){
    return value ? (Array.isArray(value) ? value.filter(Boolean) : Object.values(value)) : [];
  }

  function transactionList(path, mutate, done){
    try{
      var ref = firebase.database().ref(path);
      return ref.transaction(function(currentData){
        var list = normalizeList(currentData);
        var result = mutate(list);
        if(result === false) return;
        return list;
      }).then(function(result){
        if(!result.committed){
          if(done) done(false, 'İşlem uygulanamadı veya kayıt bulunamadı.');
          return false;
        }
        if(done) done(true);
        return true;
      }).catch(function(err){
        console.error('WE-CON-CRM transaction hatası:', path, err);
        if(done) done(false, err);
        return false;
      });
    }catch(e){
      console.error('WE-CON-CRM transaction başlatma hatası:', path, e);
      if(done) done(false, e);
      return Promise.resolve(false);
    }
  }

  ReportsData.kaydiKacanIsaretle = function(tip, ts, sebep, rakip, geriBildir){
    return transactionList('arsiv/' + tip, function(list){
      var idx = list.findIndex(function(k){ return k.ts === ts; });
      if(idx === -1) return false;
      list[idx].durum = 'kacan';
      list[idx].kacanSebep = sebep || '';
      list[idx].kacanRakip = rakip || '';
      return true;
    }, geriBildir);
  };

  ReportsData.kaydiSil = function(tip, ts, geriBildir){
    return transactionList('arsiv/' + tip, function(list){
      var yeni = list.filter(function(k){ return k.ts !== ts; });
      if(yeni.length === list.length) return false;
      list.splice(0, list.length);
      Array.prototype.push.apply(list, yeni);
      return true;
    }, geriBildir);
  };

  ReportsData.kaydiGuncelle = function(tip, ts, yeniUrunler, geriBildir){
    return transactionList('arsiv/' + tip, function(list){
      var idx = list.findIndex(function(k){ return k.ts === ts; });
      if(idx === -1) return false;
      list[idx].urunler = yeniUrunler;
      list[idx].revizeZamani = Date.now();
      return true;
    }, geriBildir);
  };

  ReportsData.kayitlariBirlestir = function(digerAd, digerId, anaAd, anaId, geriBildir){
    var tipler = ['siparis','teklif','proforma','numune'];
    var i = 0;

    function sonraki(){
      if(i >= tipler.length){
        // (11.11.2026: Görevlerim özelliği kaldırıldı — görev kayıtları artık taşınmaz.)
        if(geriBildir) geriBildir(true);
        return Promise.resolve(true);
      }
      var tip = tipler[i++];
      return transactionList('arsiv/' + tip, function(list){
        var degisti = false;
        list.forEach(function(k){
          var eslesme = (digerId && k.musteriId) ? k.musteriId === digerId : k.musteri === digerAd;
          if(eslesme){
            k.musteri = anaAd;
            k.musteriId = anaId;
            degisti = true;
          }
        });
        return degisti ? true : false;
      }).then(sonraki);
    }

    return sonraki();
  };
})();
