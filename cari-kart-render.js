/*
  cari-kart-render.js — WG.121026.2340.785
  ====================
  Cari Kart v6 — ana sayfa TAMAMEN salt-görüntüleme (isim/şehir,
  Vade/Fatura/Kargo, Fatura Adresi/Yetkili Kişi/Teslimat Adresi/Not
  blokları — hiçbirinde buton yok). Tek eylem: "✏️ Bilgiyi Düzenle" →
  4 bölümlü AKORDİYON ekranı (CARİ BİLGİLERİ / YETKİLİ KİŞİ / TESLİMAT
  ADRESİ / NOT). Bir başlığa dokununca açılır/kapanır; açıkken içerik +
  Ekle/Düzenle/Sil butonları görünür.

  CARİ BİLGİLERİ özel bir bölüm: şehir/vade/fatura/kargo (tekil alanlar)
  + fatura adresi listesini bir arada gösterir.
    Ekle    → yeni fatura adresi ekleme formu
    Düzenle → "Temel Bilgileri Düzenle" mi yoksa hangi fatura adresi mi
              seçimi (birden fazla seçenek varsa picker açılır)
    Sil     → hangi fatura adresinin silineceğini sorar

  Müşteri ADI burada düzenlenemez (bkz. customer-cari-kart.html başındaki
  not — sipariş/rapor/görev/km kayıtları müşteri adını anahtar olarak
  kullanıyor).
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

// Açık Teklif Uyarısı (22.09.2026) için küçük yardımcılar.
function fmt(n){ return (n||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}); }
var TIP_ETIKET_B = {numune:"Numune", teklif:"Fiyat Teklifi", proforma:"Proforma Fatura", siparis:"Sipariş"};

var seciliMusteriAdi = null;
var musteriVerisi = null;

var TIP_META = {
  fatura:   {baslik:"Fatura Adresi",   tekil:"fatura adresi",   ikon:"🧾"},
  teslimat: {baslik:"Teslimat Adresi", tekil:"teslimat adresi", ikon:"🚚"},
  yetkili:  {baslik:"Yetkili Kişi",    tekil:"yetkili kişi",    ikon:"👤"},
  not:      {baslik:"Not",             tekil:"not",             ikon:"📝"}
};

// DARALTILMIŞ PANEL + ADET ROZETİ (12.10.2026, Abdullah onayı — mockup
// üzerinden): Fatura/Teslimat/Yetkili bloklarında en fazla KAYIT_LIMIT
// kadar kayıt eklenebilir; varsayılan olarak sadece ilk VARSAYILAN_GORUNUR
// kadarı görünür, fazlası etiketin yanındaki "N kayıt" rozetine
// dokununca açılır (bkz. anaSayfayiRenderEt / rozetTiklariniBagla).
var KAYIT_LIMIT = { fatura: 3, teslimat: 3, yetkili: 3 };
var VARSAYILAN_GORUNUR = 2;
var genisletilmis = { fatura: false, teslimat: false, yetkili: false };

var aktifTip = null, aktifEylem = null, aktifIndex = null;
var silTip = null, silIndex = null;

function escapeText(s){ var d = document.createElement("div"); d.textContent = s||""; return d.innerHTML; }

function kayitlariGetir(musteri, tip){
  if(tip === "fatura") return musteri.faturaAdresleri || [];
  if(tip === "teslimat") return musteri.teslimatAdresleri || [];
  if(tip === "yetkili") return musteri.iletisimler || [];
  // not: yeni "notlar" dizisi varsa onu kullan; yoksa eski tekil "not"
  // alanını tek elemanlı liste gibi göster (veri kaybı olmasın diye).
  if(musteri.notlar && musteri.notlar.length) return musteri.notlar;
  if(musteri.not && musteri.not.trim()) return [{baslik:"", metin: musteri.not.trim()}];
  return [];
}

function kayitBaslik(tip, kayit){
  if(tip === "yetkili") return kayit.isim || "(isimsiz)";
  if(tip === "not") return kayit.baslik || "Not";
  return kayit.etiket || TIP_META[tip].baslik;
}
function kayitAltMetin(tip, kayit){
  if(tip === "yetkili") return [kayit.gorev, kayit.telefon, kayit.eposta].filter(Boolean).join(" · ");
  if(tip === "not") return kayit.metin || "";
  var adres = kayit.adres || "";
  // DÜZELTME (29.09.2026, Abdullah'ın bildirdiği hata): Temel Bilgiler'deki
  // tek "ŞEHİR" (ilçe/il) alanı, cari bilginin GENEL/fatura konumu olarak
  // giriliyor — ama bu satır ESKİDEN fatura VE teslimat adreslerinin
  // İKİSİNE de körü körüne ekleniyordu. Teslimat adresi çoğu zaman BAMBAŞKA
  // bir ilçe/ildedir (örn. fatura İstanbul'da, teslimat Erzurum'da) — bu
  // yüzden şehir artık SADECE fatura adresine ekleniyor, teslimat adresi
  // ne yazıldıysa AYNEN öyle gösteriliyor.
  var sehir = (tip === "fatura" && musteriVerisi) ? (musteriVerisi.sehir || "") : "";
  return sehir && adres ? (adres + ", " + sehir) : adres;
}

// İŞLEM İÇİN SEÇİM (WG.090926.196): birden fazla fatura adresi/teslimat
// adresi/yetkili kişi varsa, hangisinin bu işlemde (sipariş/teklif/vb.)
// kullanılacağını burada işaretleyebilirsin. Tek kayıt varsa seçim
// göstermeye gerek yok, o zaten kullanılacak. "İşleme Devam Et"e
// basınca seçim localStorage'a yazılır; cart.html ve send.html bunu
// okuyup varsayılan ilk kayıt yerine SENİN işaretlediğini kullanır.
var secimler = {fatura:0, teslimat:0, yetkili:0};

// DEĞİŞİKLİK (12.10.2026, Abdullah onayı): seçim tiki artık akıştan
// bağımsız HER ZAMAN görünür/tıklanabilir (eskiden SADECE "İşlem Yap"
// akışında görünüyordu, bkz. akistanGeldiMi). akistanGeldiMi hâlâ
// bölüm-eylem popup'ının (Ekle/Sil/Güncelle) gizlenmesi ve alt "İşleme
// Devam Et" butonu için kullanılıyor, DEĞİŞMEDİ.
var akistanGeldiMi = localStorage.getItem("weiconv2_islem_yap_akisi") === "1";

function anaSayfayiRenderEt(){
  var m = musteriVerisi;
  ["fatura","teslimat","yetkili","not"].forEach(function(tip){
    var liste = kayitlariGetir(m, tip);
    var kapsayici = document.getElementById(tip + "Listesi");
    var rozetEl = document.getElementById(tip + "Rozet");
    if(liste.length === 0){
      kapsayici.innerHTML = "<div class='ck-kart-bos'>Henüz " + TIP_META[tip].tekil + " eklenmemiş.</div>";
      if(rozetEl) rozetEl.hidden = true;
      return;
    }

    // "Not" bloğu TASARIM DIŞI bırakıldı — eski .ck-kart görünümü,
    // rozet/daraltma yok, mail/WhatsApp gönderimiyle (send-render.js)
    // aynı şekilde DEĞİŞMEDİ.
    if(tip === "not"){
      kapsayici.innerHTML = liste.map(function(k){
        return "<div class='ck-kart'><div class='ck-kart-ust'>" + escapeText(kayitBaslik(tip,k)) + "</div><div class='ck-kart-alt'>" + escapeText(kayitAltMetin(tip,k)) + "</div></div>";
      }).join("");
      return;
    }

    if(secimler[tip] >= liste.length) secimler[tip] = 0;
    var acikMi = !!genisletilmis[tip];
    var tiklanabilirMi = liste.length > 1;

    if(rozetEl){
      if(liste.length > VARSAYILAN_GORUNUR){
        rozetEl.hidden = false;
        rozetEl.classList.toggle("ck-kayit-rozet--acik", acikMi);
        rozetEl.innerHTML = "<span>" + liste.length + " kayıt</span><span class='ck-kayit-rozet-ok'>▾</span>";
      } else {
        rozetEl.hidden = true;
        rozetEl.classList.remove("ck-kayit-rozet--acik");
      }
    }

    kapsayici.innerHTML = liste.map(function(k, i){
      var seciliMi = secimler[tip] === i;
      var gizliMi = !acikMi && i >= VARSAYILAN_GORUNUR;
      var classes = "ck-satir" + (tiklanabilirMi ? " ck-satir--secilebilir" : "") + (seciliMi ? " ck-satir--secili" : "") + (gizliMi ? " ck-satir--gizli" : "");
      var dataAttr = tiklanabilirMi ? " data-tip='" + tip + "' data-i='" + i + "'" : "";
      return "<div class='" + classes + "'" + dataAttr + ">"
        + "<div class='ck-satir-tik" + (seciliMi ? " ck-satir-tik--secili" : "") + "'>" + (seciliMi ? "✓" : "") + "</div>"
        + "<div class='ck-satir-metin'><span class='ck-satir-etiket'>" + escapeText(kayitBaslik(tip,k)) + "</span><span class='ck-satir-detay'>" + escapeText(kayitAltMetin(tip,k)) + "</span></div>"
        + "</div>";
    }).join("");

    // Şirket telefonu/e-postası — listenin ALTINA, tek seferlik.
    if(tip === "fatura"){
      var ek = faturaIletisimSatiri();
      if(ek) kapsayici.innerHTML += ek;
    }
  });

  secimTiklariniBagla();
  rozetTiklariniBagla();
}

function secimTiklariniBagla(){
  document.querySelectorAll(".ck-satir--secilebilir").forEach(function(el){
    el.onclick = function(ev){
      ev.stopPropagation();
      var tip = this.getAttribute("data-tip");
      var i = parseInt(this.getAttribute("data-i"), 10);
      secimler[tip] = i;
      anaSayfayiRenderEt();
    };
  });
}

function rozetTiklariniBagla(){
  document.querySelectorAll(".ck-kayit-rozet").forEach(function(el){
    el.onclick = function(ev){
      ev.stopPropagation();
      var tip = el.id.replace("Rozet", "").toLowerCase();
      // id "faturaRozet" -> "fatura" vb. — sadece bilinen 3 tip için anlamlı.
      if(genisletilmis[tip] === undefined) return;
      genisletilmis[tip] = !genisletilmis[tip];
      anaSayfayiRenderEt();
    };
  });
}

// ŞİRKET TELEFONU/E-POSTASI (01.10.2026, Abdullah'ın isteğiyle) — yeni
// müşteri eklenirken girilen telefon/eposta (yetkili kişiden AYRI, şirket
// seviyesinde) artık Fatura Adresi kutusunun altında gösteriliyor. İkisi
// de boşsa hiçbir şey eklenmez, kutu eskisi gibi kalır.
function faturaIletisimSatiri(){
  var m = musteriVerisi;
  if(!m) return "";
  var satirlar = [];
  if(m.telefon && m.telefon.trim()) satirlar.push("<div class='ck-kart-iletisim-satir'><span class='ck-kart-iletisim-ikon'>📞</span>" + escapeText(m.telefon.trim()) + "</div>");
  if(m.eposta && m.eposta.trim()) satirlar.push("<div class='ck-kart-iletisim-satir'><span class='ck-kart-iletisim-ikon'>✉️</span>" + escapeText(m.eposta.trim()) + "</div>");
  if(satirlar.length === 0) return "";
  return "<div class='ck-kart-iletisim'>" + satirlar.join("") + "</div>";
}

function alanlariDoldur(musteri){
  musteriVerisi = musteri;
  genisletilmis = {fatura:false, teslimat:false, yetkili:false};
  MusteriSeridi.uygula("cariKartMusteriSeridi", musteri);

  document.getElementById("ozetVadeDeger").textContent = vadeGosterimMetni(musteri);
  document.getElementById("ozetFaturaDeger").textContent = musteri.fatura || "—";
  document.getElementById("ozetKargoDeger").textContent = musteri.kargo || "—";

  anaSayfayiRenderEt();
}

// VADE alanı artık sayı (gün) olarak girilir (21.09.2026). Eski
// müşterilerde hâlâ serbest metin olabilir ("45 gün" gibi) — sayı
// değilse OLDUĞU GİBİ gösterilir, rep Müşteri Kartı'ndan sayıya
// çevirene kadar Vade Takip'e girmez (bkz. vade-takip-data.js).
function vadeGosterimMetni(musteri){
  var gun = (typeof VadeTakip !== "undefined") ? VadeTakip.vadeGunSayisi(musteri) : null;
  if(gun !== null) return gun + " gün";
  return musteri.vade || "—";
}

var toastZamanlayici;
function toastGoster(msg){
  var t = document.getElementById("ckToast");
  t.textContent = msg;
  t.classList.add("gorunur");
  clearTimeout(toastZamanlayici);
  toastZamanlayici = setTimeout(function(){ t.classList.remove("gorunur"); }, 1800);
}

function ac(id){ document.getElementById(id).hidden = false; }
function kapat(id){ document.getElementById(id).hidden = true; }

// ---- Genel amaçlı picker (birden fazla kayıt arasından seçim) ----
function pickerGoster(baslikMetni, altMetni, ogeler){
  document.getElementById("pickerBaslik").textContent = baslikMetni;
  document.getElementById("pickerAlt").textContent = altMetni;
  document.getElementById("pickerListesi").innerHTML = ogeler.map(function(o, i){
    return "<button class='picker-item' data-idx='" + i + "'><div class='ust'>" + escapeText(o.baslik) + "</div>" + (o.alt ? "<div class='alt'>" + escapeText(o.alt) + "</div>" : "") + "</button>";
  }).join("");
  document.getElementById("pickerListesi").querySelectorAll(".picker-item").forEach(function(btn, i){
    btn.onclick = function(){ kapat("pickerOverlay"); ogeler[i].onSecim(); };
  });
  ac("pickerOverlay");
}

// ---- "Ekle/Düzenle/Sil" butonlarının eylem başlatıcısı ----
function eylemBaslat(bolumId, eylem){
  if(bolumId === "cari"){
    if(eylem === "ekle"){
      var mevcutFatura = kayitlariGetir(musteriVerisi, "fatura");
      if(mevcutFatura.length >= KAYIT_LIMIT.fatura){ toastGoster("En fazla " + KAYIT_LIMIT.fatura + " fatura adresi eklenebilir."); return; }
      formAc("fatura", "ekle"); return;
    }

    var faturaListesi = kayitlariGetir(musteriVerisi, "fatura");

    if(eylem === "duzenle"){
      // Artık ara bir "Ne düzenlemek istiyorsun?" seçim ekranı YOK —
      // doğrudan tüm cari bilgileri (müşteri adı dahil) tek formda açılır.
      formAc("cari-tam", "duzenle");
      return;
    }

    if(eylem === "sil"){
      if(faturaListesi.length === 0){ toastGoster("Henüz kayıtlı fatura adresi yok."); return; }
      if(faturaListesi.length === 1){ silSor("fatura", 0); return; }
      var silOgeler = faturaListesi.map(function(k, i){
        return {baslik: kayitBaslik("fatura",k), alt: kayitAltMetin("fatura",k), onSecim:function(){ silSor("fatura", i); }};
      });
      pickerGoster("🗑️ Hangi fatura adresini silmek istiyorsun?", "Fatura Adresi — bir kayıt seç", silOgeler);
      return;
    }
    return;
  }

  // yetkili / teslimat / not — ortak akış
  aktifTip = bolumId;
  aktifEylem = eylem;
  if(eylem === "ekle"){
    if(KAYIT_LIMIT[bolumId] !== undefined){
      var mevcut = kayitlariGetir(musteriVerisi, bolumId);
      if(mevcut.length >= KAYIT_LIMIT[bolumId]){ toastGoster("En fazla " + KAYIT_LIMIT[bolumId] + " " + TIP_META[bolumId].tekil + " eklenebilir."); return; }
    }
    formAc(bolumId, "ekle"); return;
  }

  var liste = kayitlariGetir(musteriVerisi, bolumId);
  if(liste.length === 0){ toastGoster("Henüz kayıtlı " + TIP_META[bolumId].tekil + " yok."); return; }
  // DÜZELTME (05.10.2026, Abdullah'ın bildirdiği hata): eskiden Düzenle
  // her zaman doğrudan İLK kayda gidiyordu (ara seçim yoktu) — birden
  // fazla kayıt olduğunda (örn. 3-4 yetkili kişi) istenen kaydı
  // düzenlemek imkânsızdı, hep ilk kayıt açılıyordu. Artık Sil'de zaten
  // var olan "hangisini istiyorsun?" seçim ekranı Düzenle'de de kullanılıyor.
  if(eylem === "duzenle"){
    if(liste.length === 1){ formAc(bolumId, "duzenle", 0); return; }
    var duzenleOgeler = liste.map(function(k, i){
      return {baslik: kayitBaslik(bolumId,k), alt: kayitAltMetin(bolumId,k), onSecim:function(){ formAc(bolumId, "duzenle", i); }};
    });
    pickerGoster("✏️ Hangisini düzenlemek istiyorsun?", TIP_META[bolumId].baslik + " — bir kayıt seç", duzenleOgeler);
    return;
  }

  if(liste.length === 1){ silSor(bolumId, 0); return; }
  var ogeler2 = liste.map(function(k, i){
    return {baslik: kayitBaslik(bolumId,k), alt: kayitAltMetin(bolumId,k), onSecim:function(){ silSor(bolumId, i); }};
  });
  pickerGoster("🗑️ Hangisini silmek istiyorsun?", TIP_META[bolumId].baslik + " — bir kayıt seç", ogeler2);
}

function silSor(tip, i){
  silTip = tip; silIndex = i;
  var kayit = kayitlariGetir(musteriVerisi, tip)[i];
  document.getElementById("silOnayMetin").textContent = "\"" + kayitBaslik(tip, kayit) + "\" kalıcı olarak silinecek.";
  ac("silOnayOverlay");
}

function silOnayla(){
  var btn = document.getElementById("silOnaylaBtn");
  btn.disabled = true;
  function tamamla(basarili, err){
    btn.disabled = false;
    if(!basarili){ hataGoster("Silinemedi: " + (err && err.message ? err.message : "bilinmeyen hata")); return; }
    kapat("silOnayOverlay");
    toastGoster("Silindi.");
  }
  if(silTip === "fatura" || silTip === "teslimat"){
    CustomerData.musteriAdresSil(seciliMusteriAdi, silTip, silIndex, tamamla, musteriVerisi.id);
  } else if(silTip === "yetkili"){
    CustomerData.yetkiliSil(seciliMusteriAdi, silIndex, tamamla, musteriVerisi.id);
  } else if(silTip === "not"){
    if(musteriVerisi.notlar && musteriVerisi.notlar.length){
      CustomerData.notSil(seciliMusteriAdi, silIndex, tamamla, musteriVerisi.id);
    } else {
      CustomerData.musteriNotSil(seciliMusteriAdi, tamamla, musteriVerisi.id);
    }
  }
}

// ---- Ekle / Düzenle formu ----
// VADE artık sayısal (gün) giriş. Eski müşterilerde serbest metin olabilir
// ("45 gün" gibi) — number input bunu göstermez, o yüzden placeholder'a
// taşıyoruz ki rep eski değeri görüp doğru sayıyı girebilsin.
function vadeSayisalDeger(v){
  var n = parseInt(String(v||"").trim(), 10);
  return (!isNaN(n) && n >= 0 && String(n) === String(v||"").trim()) ? String(n) : "";
}
function vadePlaceholder(v){
  var eski = String(v||"").trim();
  var sayisalMi = eski === vadeSayisalDeger(v) && eski !== "";
  var metin = (eski && !sayisalMi) ? ("örn. 45 (önceki: " + eski + ")") : "örn. 45";
  return escapeText(metin).replace(/'/g, "&#39;");
}
function formAlanlariHtml(tip){
  if(tip === "cari-tam"){
    var m = musteriVerisi;
    var ilkFatura = (kayitlariGetir(m,"fatura")[0]) || {};
    return "<div class='form-etiket'>MÜŞTERİ (TİCARİ) İSMİ</div><input class='form-input' id='fAd' placeholder='Müşteri ismi' value=\"" + escapeText(m.ad||"") + "\">"
      + "<p class='ck-not-aciklama' style='margin:-6px 0 10px'>Bu ismi değiştirirsen, geçmiş sipariş/teklif/görev kayıtları da otomatik olarak yeni isme taşınır.</p>"
      + "<div class='form-etiket'>ŞEHİR</div><input class='form-input' id='fSehir' placeholder='Şehir' value=\"" + escapeText(m.sehir||"") + "\">"
      + "<div class='form-satir-2'>"
      + "<div><div class='form-etiket'>VADE (gün)</div><input class='form-input' type='number' min='0' step='1' inputmode='numeric' id='fVade' placeholder='" + vadePlaceholder(m.vade) + "' value=\"" + escapeText(vadeSayisalDeger(m.vade)) + "\"></div>"
      + "<div><div class='form-etiket'>FATURA</div><input class='form-input' id='fFatura' placeholder='örn. EURO fatura' value=\"" + escapeText(m.fatura||"") + "\"></div>"
      + "</div>"
      + "<div class='form-etiket'>KARGO</div><input class='form-input' id='fKargo' placeholder='örn. Ücretsiz' value=\"" + escapeText(m.kargo||"") + "\">"
      + "<div class='form-etiket'>FATURA ADRESİ</div><textarea class='form-textarea' id='fDetay' rows='3' placeholder='Açık adres'>" + escapeText(ilkFatura.adres||"") + "</textarea>";
  }
  if(tip === "temel"){
    var m2 = musteriVerisi;
    return "<div class='form-etiket'>ŞEHİR</div><input class='form-input' id='fSehir' placeholder='Şehir' value=\"" + escapeText(m2.sehir||"") + "\">"
      + "<div class='form-etiket'>VADE (gün)</div><input class='form-input' type='number' min='0' step='1' inputmode='numeric' id='fVade' placeholder='" + vadePlaceholder(m2.vade) + "' value=\"" + escapeText(vadeSayisalDeger(m2.vade)) + "\">"
      + "<div class='form-etiket'>FATURA</div><input class='form-input' id='fFatura' placeholder='örn. EURO fatura' value=\"" + escapeText(m2.fatura||"") + "\">"
      + "<div class='form-etiket'>KARGO</div><input class='form-input' id='fKargo' placeholder='örn. Ücretsiz' value=\"" + escapeText(m2.kargo||"") + "\">";
  }
  if(tip === "fatura" || tip === "teslimat"){
    return "<div class='form-etiket'>ETİKET (ör. Fabrika 2 Fatura Adresi)</div><input class='form-input' id='fBaslik' placeholder='Etiket'>"
      + "<div class='form-etiket'>AÇIK ADRES</div><textarea class='form-textarea' id='fDetay' rows='3' placeholder='Açık adres'></textarea>";
  }
  if(tip === "yetkili"){
    return "<div class='form-satir-2'>"
      + "<div><div class='form-etiket'>İSİM SOYİSİM</div><input class='form-input' id='fIsim' placeholder='İsim Soyisim'></div>"
      + "<div><div class='form-etiket'>GÖREV</div><input class='form-input' id='fGorev' placeholder='Görev'></div>"
      + "</div><div class='form-satir-2' style='margin-top:10px'>"
      + "<div><div class='form-etiket'>TELEFON</div><input class='form-input' id='fTel' placeholder='Telefon' type='tel'></div>"
      + "<div><div class='form-etiket'>E-POSTA</div><input class='form-input' id='fEposta' placeholder='E-posta' type='email'></div>"
      + "</div>";
  }
  // not — sadece metin, ayrı başlık alanı yok
  return "<div class='form-etiket'>NOT METNİ</div><textarea class='form-textarea' id='fDetay' rows='3' placeholder='Not metni'></textarea>";
}

function formAc(tip, eylem, index){
  aktifTip = tip; aktifEylem = eylem; aktifIndex = (index===undefined?null:index);
  kapat("pickerOverlay");
  var baslikMetni = (tip === "temel" || tip === "cari-tam") ? "Cari Bilgileri" : TIP_META[tip].baslik;
  document.getElementById("formBaslik").textContent = (tip === "temel" ? "⚙️ Temel Bilgileri Düzenle" : (tip === "cari-tam" ? "✏️ Cari Bilgileri Düzenle" : (eylem==="ekle" ? "➕ Yeni " + baslikMetni + " Ekle" : "✏️ " + baslikMetni + " Düzenle")));
  document.getElementById("formIcerik").innerHTML = formAlanlariHtml(tip);

  if(eylem === "duzenle" && tip !== "temel" && tip !== "cari-tam"){
    var kayit = kayitlariGetir(musteriVerisi, tip)[index];
    if(tip === "yetkili"){
      document.getElementById("fIsim").value = kayit.isim || "";
      document.getElementById("fGorev").value = kayit.gorev || "";
      document.getElementById("fTel").value = kayit.telefon || "";
      document.getElementById("fEposta").value = kayit.eposta || "";
    } else if(tip === "not"){
      document.getElementById("fDetay").value = kayit.metin || "";
    } else {
      document.getElementById("fBaslik").value = kayit.etiket || "";
      document.getElementById("fDetay").value = kayit.adres || "";
    }
  }
  ac("formOverlay");
}

function formKaydet(){
  var tip = aktifTip;
  var btn = document.getElementById("formKaydetBtn");

  function tamamla(basarili, err){
    btn.disabled = false;
    btn.textContent = "✓ Kaydet";
    if(!basarili){ hataGoster("Kaydedilemedi: " + (err && err.message ? err.message : "bilinmeyen hata")); return; }
    kapat("formOverlay");
    toastGoster(tip === "temel" || tip === "cari-tam" ? "Güncellendi." : (aktifEylem==="ekle" ? "Eklendi." : "Güncellendi."));
  }

  if(tip === "cari-tam"){
    var yeniAd = document.getElementById("fAd").value.trim();
    if(!yeniAd){ toastGoster("Müşteri ismi boş olamaz."); return; }
    var eskiAd = musteriVerisi.ad;
    var adres = document.getElementById("fDetay").value.trim();
    var guncelBilgi2 = {
      ad: yeniAd,
      sehir: document.getElementById("fSehir").value.trim(),
      vade: document.getElementById("fVade").value.trim(),
      fatura: document.getElementById("fFatura").value.trim(),
      kargo: document.getElementById("fKargo").value.trim()
    };
    btn.disabled = true; btn.textContent = "Kaydediliyor...";

    function temelVeAdresiKaydet(){
      CustomerData.musteriGuncelle(seciliMusteriAdi, guncelBilgi2, function(basarili3, err3){
        if(!basarili3){ tamamla(false, err3); return; }
        seciliMusteriAdi = yeniAd; // artık kayıtları bu isimle arayacağız
        var ilkFaturaVarMi = kayitlariGetir(musteriVerisi, "fatura").length > 0;
        if(ilkFaturaVarMi){
          CustomerData.musteriAdresGuncelle(yeniAd, "fatura", 0, "Fatura Adresi", adres, tamamla, musteriVerisi.id);
        } else if(adres){
          CustomerData.musteriAdresEkle(yeniAd, "fatura", "Fatura Adresi", adres, tamamla, musteriVerisi.id);
        } else {
          tamamla(true);
        }
      }, musteriVerisi.id);
    }

    if(yeniAd !== eskiAd && typeof ReportsData !== "undefined"){
      // İsim değişti — önce geçmiş sipariş/teklif/proforma/numune ve görev
      // kayıtlarını yeni isme taşı (ReportsData.kayitlariBirlestir zaten
      // musteriId eşleşmesini de destekliyor), SONRA cari kaydın kendisini
      // güncelle. Bu sıra, taşıma sırasında eski kaydın "kaybolmuş" gibi
      // görünmesini engeller.
      ReportsData.kayitlariBirlestir(eskiAd, musteriVerisi.id||null, yeniAd, musteriVerisi.id||null, function(tasindiMi, tasimaErr){
        if(!tasindiMi){ tamamla(false, tasimaErr); return; }
        temelVeAdresiKaydet();
      });
    } else {
      temelVeAdresiKaydet();
    }
    return;
  }

  if(tip === "temel"){
    var guncelBilgi = {
      sehir: document.getElementById("fSehir").value.trim(),
      vade: document.getElementById("fVade").value.trim(),
      fatura: document.getElementById("fFatura").value.trim(),
      kargo: document.getElementById("fKargo").value.trim()
    };
    btn.disabled = true; btn.textContent = "Kaydediliyor...";
    CustomerData.musteriGuncelle(seciliMusteriAdi, guncelBilgi, tamamla, musteriVerisi.id);
    return;
  }

  if(tip === "yetkili"){
    var isim = document.getElementById("fIsim").value.trim();
    if(!isim){ toastGoster("İsim boş olamaz."); return; }
    var kisi = {
      isim: isim,
      gorev: document.getElementById("fGorev").value.trim(),
      telefon: document.getElementById("fTel").value.trim(),
      eposta: document.getElementById("fEposta").value.trim()
    };
    btn.disabled = true; btn.textContent = "Kaydediliyor...";
    if(aktifEylem === "ekle") CustomerData.yetkiliEkle(seciliMusteriAdi, kisi, tamamla, musteriVerisi.id);
    else CustomerData.yetkiliGuncelle(seciliMusteriAdi, aktifIndex, kisi, tamamla, musteriVerisi.id);
    return;
  }

  if(tip === "not"){
    var metin = document.getElementById("fDetay").value.trim();
    if(!metin){ toastGoster("Not metni boş olamaz."); return; }
    var notObj = {baslik: "", metin: metin};
    btn.disabled = true; btn.textContent = "Kaydediliyor...";
    if(aktifEylem === "ekle") CustomerData.notEkle(seciliMusteriAdi, notObj, tamamla, musteriVerisi.id);
    else CustomerData.notGuncelle(seciliMusteriAdi, aktifIndex, notObj, tamamla, musteriVerisi.id);
    return;
  }

  // fatura / teslimat
  var baslik = document.getElementById("fBaslik").value.trim();
  var detay = document.getElementById("fDetay").value.trim();
  if(!baslik){ toastGoster("Etiket boş olamaz."); return; }
  btn.disabled = true; btn.textContent = "Kaydediliyor...";
  if(aktifEylem === "ekle") CustomerData.musteriAdresEkle(seciliMusteriAdi, tip, baslik, detay, tamamla, musteriVerisi.id);
  else CustomerData.musteriAdresGuncelle(seciliMusteriAdi, tip, aktifIndex, baslik, detay, tamamla, musteriVerisi.id);
}

window.addEventListener("error", function(ev){
  hataGoster("HATA: " + ev.message + " (" + (ev.filename||"").split("/").pop() + ":" + ev.lineno + ")");
});

function tarihiGuncelle(){
  try{
    var el = document.getElementById("gunTarihi");
    if(!el) return;
    var gunler = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
    var aylar = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
    var d = new Date();
    el.textContent = gunler[d.getDay()] + ", " + d.getDate() + " " + aylar[d.getMonth()] + " " + d.getFullYear();
  }catch(e){}
}

document.addEventListener("DOMContentLoaded", function(){
  tarihiGuncelle();
  var btnMenuEl = document.getElementById("btnMenu");
  if(btnMenuEl) btnMenuEl.onclick = function(){ window.location.href = "menu.html"; };
  var secili = CustomerData.seciliyiOku();
  if(!secili){
    hataGoster("Müşteri seçilmemiş, listeye dönülüyor.");
    setTimeout(function(){ window.location.href = "customer.html"; }, 1500);
    return;
  }
  seciliMusteriAdi = secili.ad;
  alanlariDoldur(secili);

  // YENİ TASARIM (WG.100926.196): başlık satırındaki "Bilgiyi Güncelle" /
  // 🗑️ kaldırıldı — artık bölümün İÇERİĞİNE dokununca bir popup açılıyor
  // (Bilgiyi Güncelle / Ekle / Sil / Kapat). "cari" (Temel Bilgiler)
  // eklenip silinemeyeceği için o bölümde sadece Güncelle+Kapat görünür.
  var acikBolumEylem = null;
  document.querySelectorAll(".ck-tiklanabilir-alan[data-bolum]").forEach(function(alan){
    alan.onclick = function(){
      // İşlem Yap akışında (seçim modu) bu ekranda bilgi düzenlenmez,
      // sadece işlem için fatura/teslimat/yetkili seçimi yapılır.
      if(akistanGeldiMi) return;
      acikBolumEylem = this.getAttribute("data-bolum");
      var eklenipSilinebilir = acikBolumEylem !== "cari";
      document.getElementById("bolumEylemBaslik").textContent = (TIP_META[acikBolumEylem] ? TIP_META[acikBolumEylem].ikon + " " + TIP_META[acikBolumEylem].baslik : "Temel Bilgiler");
      document.getElementById("btnBolumEkle").hidden = !eklenipSilinebilir;
      document.getElementById("btnBolumSil").hidden = !eklenipSilinebilir;
      document.getElementById("bolumEylemOverlay").hidden = false;
    };
  });
  document.getElementById("btnBolumGuncelle").onclick = function(){
    document.getElementById("bolumEylemOverlay").hidden = true;
    if(acikBolumEylem === "cari"){ eylemBaslat("cari","duzenle"); return; }
    var liste = kayitlariGetir(musteriVerisi, acikBolumEylem);
    eylemBaslat(acikBolumEylem, liste.length === 0 ? "ekle" : "duzenle");
  };
  document.getElementById("btnBolumEkle").onclick = function(){
    document.getElementById("bolumEylemOverlay").hidden = true;
    eylemBaslat(acikBolumEylem, "ekle");
  };
  document.getElementById("btnBolumSil").onclick = function(){
    document.getElementById("bolumEylemOverlay").hidden = true;
    eylemBaslat(acikBolumEylem, "sil");
  };
  document.getElementById("btnBolumEylemKapat").onclick = function(){
    document.getElementById("bolumEylemOverlay").hidden = true;
  };

  // Form Kaydet + Sil Onayla
  document.getElementById("formKaydetBtn").onclick = formKaydet;
  document.getElementById("silOnaylaBtn").onclick = silOnayla;

  // Tüm overlay'lerin kapatma tuşları (dışarı tıklama + "Vazgeç" tuşları)
  document.querySelectorAll("[data-kapat]").forEach(function(el){
    el.onclick = function(){ kapat(this.getAttribute("data-kapat")); };
  });
  document.querySelectorAll(".overlay").forEach(function(ov){
    ov.addEventListener("click", function(ev){
      if(ev.target === ov) kapat(ov.id);
    });
  });

  // --- Alt buton (22.09.2026): artık SADECE "İşlem Yap" akışından (yeni
  // Numune/Teklif/Sipariş başlatmak için) geldiyse görünür ve
  // "▶️ İşleme Devam Et" olarak ürün seçimine götürür. Normal görüntülemede
  // (müşteri hub'ından "CARİ"ye girildiğinde) bu buton hiç yok — sadece
  // Kapat var, o da hub'a döner (customer-hub.html, HTML'de zaten ayarlı). ---
  var islemeDevamBtn = document.getElementById("btnIslemeDevam");
  if(akistanGeldiMi){
    islemeDevamBtn.hidden = false;
    islemeDevamBtn.textContent = "▶️ İşleme Devam Et";
    islemeDevamBtn.onclick = function(){ document.getElementById("tipSecimOverlay").hidden = false; };
    document.getElementById("btnTipSecimVazgec").onclick = function(){ document.getElementById("tipSecimOverlay").hidden = true; };
    document.getElementById("tipSecimOverlay").querySelectorAll(".tip-btn").forEach(function(btn2){
      btn2.onclick = function(){
        var secilenTip = this.getAttribute("data-tip");
        // Açık Teklif Uyarısı (22.09.2026): sadece "SİPARİŞ" seçilince ve
        // sadece bu müşteride henüz siparişe dönüşmemiş bir teklif/
        // proforma/numune varsa devreye girer.
        if(secilenTip === "siparis" && typeof ReportsData !== "undefined" && musteriVerisi){
          var acikBelge = ReportsData.musterininAcikBelgesi(musteriVerisi.ad);
          if(acikBelge){
            document.getElementById("tipSecimOverlay").hidden = true;
            acikBelgeUyariGoster(acikBelge);
            return;
          }
        }
        siparisAkisinaDevamEt(secilenTip);
      };
    });
    document.getElementById("btnAcikBelgeYeniSiparis").onclick = function(){
      document.getElementById("acikBelgeUyariOverlay").hidden = true;
      siparisAkisinaDevamEt("siparis");
    };

    function siparisAkisinaDevamEt(secilenTip){
      localStorage.setItem("weiconv2_onceden_secilen_tip", secilenTip);
      localStorage.setItem("weiconv2_secili_iletisim", JSON.stringify(secimler));
      localStorage.removeItem("weiconv2_islem_yap_akisi");
      // Birleşik Sayfa (02.10.2026): Ürün Bul artık cart.html'in içinde.
      window.location.href = "cart.html";
    }

    function acikBelgeUyariGoster(acikBelge){
      var etiket = TIP_ETIKET_B ? TIP_ETIKET_B[acikBelge.tip] : acikBelge.tip;
      document.getElementById("acikBelgeUyariMetin").textContent =
        musteriVerisi.ad + " için, henüz siparişe dönüşmemiş bir " + (etiket||acikBelge.tip) + " bulundu:";
      document.getElementById("acikBelgeUyariKayit").textContent =
        (acikBelge.kod||"") + " · " + (acikBelge.tarih||"") + " · " + fmt(acikBelge.tutar) + " EURO";
      document.getElementById("btnAcikBelgeKullan").onclick = function(){
        document.getElementById("acikBelgeUyariOverlay").hidden = true;
        ilerletFonksiyonuCagir(acikBelge);
      };
      document.getElementById("acikBelgeUyariOverlay").hidden = false;
    }

    // Bildirimler sayfasındaki "İlerlet" ile BİREBİR aynı mekanizma: eski
    // belgeyi Sepet'e yükler, kaydedilince eski belge otomatik kapanır.
    function ilerletFonksiyonuCagir(acikBelge){
      var tumu = ReportsData.sonIslemler();
      var k = tumu.find(function(x){ return x.tip===acikBelge.tip && x.ts===acikBelge.ts; });
      if(!k){ hataGoster("Kayıt bulunamadı."); return; }
      ReportsData.revizeBaslat(k, "siparis");
    }
  }

  var cariKapatBtnEl = document.getElementById("cariKapatBtn");
  if(cariKapatBtnEl){
    cariKapatBtnEl.addEventListener("click", function(){
      localStorage.removeItem("weiconv2_islem_yap_akisi");
    });
    // "İşlem Yap" akışından gelindiyse Kapat eskisi gibi müşteri listesine
    // döner (hub'a değil) — o akışta hub'ın bir anlamı yok.
    // DÜZELTME (06.10.2026, Abdullah'ın bildirdiği hata): akistanGeldiMi
    // bayrağı, belge türü seçilir seçilmez (cart.html'e geçerken, bkz.
    // siparisAkisinaDevamEt) siliniyor — bu sayfaya GERİ dönüldüğünde
    // (taze yüklenince) bayrak artık yok diye Kapat yanlışlıkla eski
    // hub'a dönüyordu. Küçük pencereden girildiyse kalıcı olarak set
    // edilen "dönüş rotası" bayrağı (customer-render.js
    // cmDonusRotasiniKaydet) da burada ayrıca kontrol ediliyor.
    var donusRotasi = null;
    try{ donusRotasi = localStorage.getItem("weiconv2_musteri_donus_sayfa"); }catch(e){}
    if(akistanGeldiMi || donusRotasi === "customer.html") cariKapatBtnEl.setAttribute("href", "customer.html");
  }

  // Firebase'den taze veri gelince ana sayfayı ve (açıksa) akordiyonu tazele.
  // HATA DÜZELTME (WG.080926.196): isim değişikliğinden hemen sonra bu
  // dinleyici eski isimle arama yapıp müşteriyi "bulamıyor" ve ekran
  // güncellenmeden kalıyordu (kayıt kendisi her zaman doğruydu). Artık
  // kalıcı ID ile aranıyor — isim ne olursa olsun doğru kayıt bulunur.
  CustomerData.listeDegistiginde(function(){
    var taze = (musteriVerisi && musteriVerisi.id)
      ? CustomerData.musteriIdIleBul(musteriVerisi.id)
      : CustomerData.musteriBul(seciliMusteriAdi);
    if(!taze) return;
    musteriVerisi = taze;
    seciliMusteriAdi = taze.ad;
    MusteriSeridi.uygula("cariKartMusteriSeridi", taze);
    document.getElementById("ozetVadeDeger").textContent = vadeGosterimMetni(taze);
    document.getElementById("ozetFaturaDeger").textContent = taze.fatura || "—";
    document.getElementById("ozetKargoDeger").textContent = taze.kargo || "—";
    anaSayfayiRenderEt();
  });
});
