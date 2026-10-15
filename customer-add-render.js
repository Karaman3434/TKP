/*
  customer-add-render.js — WG.151026.1015.825
  =======================
  Sadece yeni müşteri ekleme formunun mantığı. customer-render.js'ten
  ayrı — o dosya artık sadece LİSTE ile ilgileniyor.
*/

function hataGoster(mesaj){
  console.error(mesaj);
  if(typeof HataLog !== "undefined") HataLog.kaydet(mesaj);
  var kutu = document.createElement("div");
  kutu.textContent = "⚠️ " + mesaj;
  kutu.style.cssText = "position:fixed;top:8px;left:8px;right:8px;background:#c0392b;color:#fff;padding:10px;border-radius:8px;font-size:13px;z-index:99999;";
  document.body.appendChild(kutu);
  setTimeout(function(){ kutu.remove(); }, 8000);
}

function tarihiGuncelle(){
  try{
    var el = document.getElementById("gunTarihi");
    if(!el) return;
    var gunler = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
    var aylar = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
    var d = new Date();
    el.textContent = gunler[d.getDay()] + ", " + d.getDate() + " " + aylar[d.getMonth()] + " " + d.getFullYear();
  }catch(e){ hataGoster("Tarih güncellenemedi: " + e.message); }
}

// Sadece alan boşsa doldurur — kullanıcının elle yazdığı bir şeyin
// üzerine yazmaz (foto-doldur.js tarafından çağrılır).
function doldurBosIse(id, deger){
  if(!deger) return;
  var el = document.getElementById(id);
  if(el && !el.value.trim()) el.value = deger;
}

window.addEventListener("error", function(ev){
  hataGoster("HATA: " + ev.message + " (" + (ev.filename||"").split("/").pop() + ":" + ev.lineno + ")");
});

document.addEventListener("DOMContentLoaded", function(){
  tarihiGuncelle();
  var btnMenuEl = document.getElementById("btnMenu");
  if(btnMenuEl) btnMenuEl.onclick = function(){ window.location.href = "menu.html"; };

  // YENİ (15.10.2026, Abdullah'ın isteğiyle): "📷 Fotoğraf/Ekran
  // Görüntüsünden Doldur" — kartvizit/tabela fotoğrafı veya ekran
  // görüntüsünden AI ile okunan bilgileri forma otomatik dağıtır.
  // Zaten bir şey yazılmış alanların üzerine YAZILMAZ (kullanıcı elle
  // girdiyse korunur) — sadece boş alanlar doldurulur.
  document.getElementById("btnYeniMusteriFotoDoldur").onclick = function(){
    FotoDoldur.ac(function(veri){
      doldurBosIse("yeniMusteriAdi", veri.firmaAdi);
      doldurBosIse("yeniMusteriSehir", veri.sehir);
      doldurBosIse("yeniMusteriAcikAdres", veri.acikAdres);
      doldurBosIse("yeniMusteriTelefon", veri.telefon);
      doldurBosIse("yeniMusteriEposta", veri.eposta);
      doldurBosIse("yeniMusteriTeslimatAdresi", veri.teslimatAdresi);
    });
  };

  document.getElementById("btnYeniMusteriKaydet").onclick = function(){
    var bilgi = {
      ad: document.getElementById("yeniMusteriAdi").value,
      sehir: document.getElementById("yeniMusteriSehir").value,
      acikAdres: document.getElementById("yeniMusteriAcikAdres").value,
      vade: document.getElementById("yeniMusteriVade").value,
      fatura: document.getElementById("yeniMusteriFatura").value,
      telefon: document.getElementById("yeniMusteriTelefon").value,
      eposta: document.getElementById("yeniMusteriEposta").value,
      kargo: document.getElementById("yeniMusteriKargo").value,
      teslimatAdresi: document.getElementById("yeniMusteriTeslimatAdresi").value
    };

    var benzerler = CustomerData.benzerMusterileriBul(bilgi.ad);
    if(benzerler.length > 0){
      var isimler = benzerler.map(function(m){ return m.ad + (m.sehir?" ("+m.sehir+")":""); }).join("\n");
      var devamEt = confirm("Benzer isimli müşteri(ler) zaten kayıtlı:\n\n" + isimler + "\n\nYine de yeni bir müşteri olarak eklemek istiyor musunuz?");
      if(!devamEt) return;
    }

    var btn = document.getElementById("btnYeniMusteriKaydet");
    btn.disabled = true;
    btn.textContent = "Kaydediliyor...";
    CustomerData.yeniMusteriKaydet(bilgi, function(basarili, sonuc){
      btn.disabled = false;
      btn.textContent = "YENİ MÜŞTERİ BİLGİLERİNİ KAYDET";
      if(basarili){
        alert("✓ " + sonuc.ad + " kaydedildi.");
        window.location.href = "customer.html";
      } else {
        hataGoster(typeof sonuc === "string" ? sonuc : "Kaydedilemedi: " + (sonuc && sonuc.message ? sonuc.message : "bilinmeyen hata"));
      }
    });
  };
});
