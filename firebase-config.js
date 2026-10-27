/*
  firebase-config.js
  ===================
  TEK gerçek Firebase config kaynağı. Önceden bu 7 satırlık config bloğu
  14 ayrı dosyada (auth.js, customer-data.js, reports-data.js, home-data.js,
  km-data.js, cihaz-data.js, ayarlar-sync.js, send-data.js, hata-log.js,
  hata-kayitlari-render.js, maas-kayit-data.js, avans-kayit-data.js,
  odenebilir-komisyon-data.js, product-data.js) birebir kopyalanmıştı —
  product-data.js'deki kopya bir harf farkıyla (apiKey'de "o" yerine "O")
  YANLIŞ yazılmıştı; auth.js zaten Firebase'i daha önce başlattığı için
  şimdiye dek fark edilmemişti (13.09.2026 audit).

  Bu dosya, Firebase SDK <script> etiketlerinden HEMEN SONRA ve onu
  kullanan her dosyadan (auth.js dahil) ÖNCE yüklenmelidir. Kendisi
  initializeApp'i burada, tek yerde çağırır; diğer dosyalardaki
  "if(!firebase.apps.length){ firebase.initializeApp(ISTAKIP_FIREBASE_CONFIG); }"
  satırları artık sadece bu dosya bir şekilde eksik yüklenirse diye
  bırakılmış bir güvenlik ağıdır.
*/
var ISTAKIP_FIREBASE_CONFIG = {
  apiKey: "AIzaSyC08Oe1LE7TdQl8gG2H9raZQek211Dxd60",
  authDomain: "weicon-asist.firebaseapp.com",
  databaseURL: "https://weicon-asist-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "weicon-asist",
  storageBucket: "weicon-asist.firebasestorage.app",
  messagingSenderId: "673730415323",
  appId: "1:673730415323:web:29c817e05a281261a61afe"
};

if(typeof firebase !== "undefined" && !firebase.apps.length){
  firebase.initializeApp(ISTAKIP_FIREBASE_CONFIG);
}

// Çalışan Erişimi (01.10.2026) — kullanıcı adı girişlerini Firebase Auth'un
// e-posta/şifre sağlayıcısı için arka planda sahte bir e-postaya çevirmekte
// kullanılan TEK ortak sabit. login-render.js VE calisan-erisim-render.js
// bunu AYNI değerle kullanmalı — biri değişirse diğeri de değişmeli.
var ISTAKIP_CALISAN_EMAIL_DOMAINI = "@weicon-calisan.local";
