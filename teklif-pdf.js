/*
  teklif-pdf.js — WG.211026.1700.895
  ===================================
  14.10.2026 (Abdullah'ın isteğiyle, mockup üzerinden onaylandı): müşteriye
  giden TEKLİF/SİPARİŞ/PROFORMA/NUMUNE kayıtları için gerçek, biçimlendirilmiş
  bir PDF üretir (jsPDF + jspdf-autotable). Bu dosya SADECE PDF üretimiyle
  ilgilenir — Belge Önizleme ekranının (belge-render.js) kendi canlı/
  düzenlenebilir görünümüne HİÇ dokunmaz, ondan tamamen ayrı ve ek bir
  katmandır.

  VERİ KAYNAĞI: belge-render.js'teki belgeyiCiz(kayit, musteri) ile AYNI
  kayit/musteri nesneleri — hesaplama mantığı (prim formülü, net fiyat,
  vade biçimi) kasıtlı olarak ORADAKİYLE BİREBİR AYNI tutuldu, iki yerde
  farklı sayı çıkmasın diye.

  GİZLEME KURALLARI (secenekler parametresi): mevcut primGizli deseniyle
  (send-render.js) aynı mantık — bu dosya iki moddan BİRİNİN parçası:
    - İç/program kopyası (Yazdır): müşteri kodu GÖRÜNÜR, prim GÖRÜNÜR.
    - Dışa gönderilen kopya (Gönder — mail/WhatsApp, henüz bu dosyada
      WIRE EDİLMEDİ, sadece altyapı hazır): musteriKoduGizli:true,
      primGizli:true ile çağrılmalı.

  EKSİK ALANLAR (bilerek uydurulmadı, boş/yok bırakıldı):
    - V.D. No: müşteri kartında bu alan henüz yok → "—" yazılır.
    - Termin Tarihi: uygulamada "termin süresi" diye takip edilen bir alan
      yok → bu satır belgede HİÇ gösterilmiyor (yanlış veri göstermektense).
*/

(function(global){

  var RENK = {
    metin: [28, 31, 36],
    gri: [90, 100, 114],
    griZemin: [232, 236, 241],
    satirAyrac: [238, 240, 243],
    kirmizi: [217, 45, 32],
    mavi: [8, 102, 198],
    yesil: [7, 131, 79]
  };

  var TEKLIF_BASLIK = {
    numune: "NUMUNE FORMU",
    teklif: "FİYAT TEKLİFİ FORMU",
    proforma: "PROFORMA FATURA FORMU",
    siparis: "SİPARİŞ FORMU"
  };

  function fmt(n){
    return (n||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2});
  }

  function tarihFormatlaUzun(ts){
    var d = new Date(ts);
    var gg = String(d.getDate()).padStart(2,"0");
    var aa = String(d.getMonth()+1).padStart(2,"0");
    return gg + "." + aa + "." + d.getFullYear();
  }

  // belge-render.js'teki belgeyiCiz() içindeki "vade" IIFE ile BİREBİR AYNI.
  function vadeFormatla(v){
    var s = String(v||"").trim();
    if(s === "") return "";
    var n = parseInt(s, 10);
    return (!isNaN(n) && n >= 0 && String(n) === s) ? (n + " gün") : s;
  }

  // belgeSatirHtmlVeDeger()'deki prim formülüyle BİREBİR AYNI — iki yerde
  // farklı prim çıkmasın diye buraya KOPYALANMADI, aynı mantık tekrar
  // yazıldı (dosyalar birbirinden bağımsız yüklendiği için import edilemiyor).
  function satirHesapla(item, kaydinKuru){
    var adet = item.adet || 0;
    var netBirim = item.iskBirim !== undefined ? item.iskBirim : (item.listeFiyat || 0);
    var toplamEuro = (item.iskBirim||0) * adet;
    var mk = (item.iskBirim||0) - (item.dipFiyat||0);
    var ozelFiyatMi = (item.iskonto||0) > 60;
    var satirPrim = ozelFiyatMi ? 0 : mk * adet * 0.22;
    var satirPrimTl = Math.round(satirPrim * (kaydinKuru||0));
    var bedelsizMi = item.ozelEtiket === "bedelsiz";
    // DEĞİŞİKLİK (14.10.2026, Abdullah'ın isteğiyle): "Bedelsiz" -> kısa kod
    // "BDLSİZ" (bkz. hareket-tablo.js / belge-render.js, aynı kısaltma).
    var primMetni = bedelsizMi ? "BDLSİZ" : (ozelFiyatMi ? "Ö.F" : (satirPrim < 0 ? "Yok" : (fmt(satirPrimTl) + " TL")));
    var iskYuz100 = (item.iskonto||0) === 100;
    return {
      adet: adet,
      listeFiyat: item.listeFiyat || 0,
      iskontoMetni: iskYuz100 ? "-" : ("%" + (item.iskonto||0)),
      net: netBirim,
      toplamEuro: toplamEuro,
      toplamMetni: bedelsizMi ? "NUMUNE" : (fmt(toplamEuro) + " €"),
      primMetni: primMetni
    };
  }

  function resimYukle(src){
    return new Promise(function(resolve, reject){
      var img = new Image();
      img.onload = function(){ resolve(img); };
      img.onerror = function(){ resolve(null); }; // logo yüklenemezse PDF yine de üretilsin
      img.src = src;
    });
  }

  // Tüm veriyi önceden düz bir nesneye toplar — jsPDF'ten tamamen bağımsız,
  // bu yüzden test edilmesi kolay (sahte kayit/musteri ile çağrılıp çıktısı
  // doğrulanabilir).
  function teklifVerisiHazirla(kayit, musteri, secenekler){
    secenekler = secenekler || {};
    var kaydinKuru = kayit.kur || (parseFloat(localStorage.getItem("weicon_kur"))||0);
    var urunler = kayit.urunler || [];

    var tumYetkililer = (musteri && musteri.iletisimler) || [];
    var yetkililer = kayit.gorunecekYetkililer
      ? tumYetkililer.filter(function(k){ return kayit.gorunecekYetkililer.indexOf(k.isim) !== -1; })
      : tumYetkililer;
    var yetkili = yetkililer[0] || null;

    var faturaAdr = kayit.faturaAdresi ? (kayit.faturaAdresi.adres || "") : "";
    var sehir = (musteri && musteri.sehir) || "";

    var satirlar = urunler.map(function(item){
      var h = satirHesapla(item, kaydinKuru);
      return {
        berta: item.berta || "-",
        abas: item.abas || "-",
        urunAdi: item.ad || "",
        adet: h.adet,
        listeFiyat: fmt(h.listeFiyat),
        iskontoMetni: h.iskontoMetni,
        net: fmt(h.net),
        toplamEuro: h.toplamEuro,
        toplamMetni: h.toplamMetni,
        primMetni: h.primMetni
      };
    });

    var genelToplam = satirlar.reduce(function(s, r){ return s + r.toplamEuro; }, 0);

    return {
      baslik: TEKLIF_BASLIK[kayit.tip] || TEKLIF_BASLIK.siparis,
      musteriAdi: kayit.musteri || "",
      musteriAdres: faturaAdr,
      musteriSehir: sehir,
      yetkili: yetkili,
      vdNo: null, // müşteri kartında bu alan henüz yok — bilerek boş
      musteriKodu: secenekler.musteriKoduGizli ? null : ((musteri && musteri.id) || null),
      teklifNo: kayit.kod || "",
      tarih: tarihFormatlaUzun(kayit.ts),
      satirlar: satirlar,
      primGizli: !!secenekler.primGizli,
      genelToplamMetni: fmt(genelToplam) + " €",
      vade: vadeFormatla(musteri && musteri.vade),
      faturaTuru: (musteri && musteri.fatura) || "",
      kargo: (musteri && musteri.kargo) || ""
    };
  }

  // ---- PDF ÇİZİMİ ---------------------------------------------------
  async function teklifPdfOlustur(kayit, musteri, secenekler){
    if(typeof jspdf === "undefined" || !jspdf.jsPDF){
      throw new Error("PDF kütüphanesi yüklenemedi (jsPDF). İnternet bağlantınızı kontrol edin.");
    }
    var veri = teklifVerisiHazirla(kayit, musteri, secenekler);
    var doc = new jspdf.jsPDF({ unit: "mm", format: "a4" });

    var SOL = 16, SAG = 16, GENISLIK = 210 - SOL - SAG;
    var y = 16;

    // Başlık + logo
    doc.setFont("times", "bold");
    doc.setFontSize(17);
    doc.setTextColor.apply(doc, RENK.metin);
    doc.text(veri.baslik, SOL, y + 4);

    var logo = await resimYukle("is-takip-logo.png");
    if(logo){
      var logoY_h = 11.5, logoW = logoY_h * (logo.width / logo.height);
      doc.addImage(logo, "PNG", 210 - SAG - logoW, y - 4, logoW, logoY_h);
    }

    y += 10;
    doc.setDrawColor.apply(doc, RENK.metin);
    doc.setLineWidth(0.35);
    doc.line(SOL, y, 210 - SAG, y);
    y += 7;

    // Müşteri adres bloğu
    doc.setFont("times", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor.apply(doc, RENK.metin);
    doc.text(veri.musteriAdi, SOL, y);
    y += 4.6;
    if(veri.musteriAdres){
      doc.setFont("times", "normal");
      var adresTam = veri.musteriAdres + (veri.musteriSehir ? ", " + veri.musteriSehir : "");
      var adresSatirlari = doc.splitTextToSize(adresTam, GENISLIK * 0.65);
      adresSatirlari.forEach(function(satir){
        doc.text(satir, SOL, y);
        y += 4.2;
      });
    }

    // Yetkili Kişi (varsa) — kartvizit mantığı: isim + altında küçük/gri iletişim
    if(veri.yetkili && (veri.yetkili.isim || veri.yetkili.telefon || veri.yetkili.eposta)){
      y += 1;
      doc.setFont("times", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor.apply(doc, RENK.metin);
      doc.text("Yetkili Kişi: " + (veri.yetkili.isim || "-"), SOL, y);
      var iletisimParca = [veri.yetkili.telefon, veri.yetkili.eposta].filter(Boolean).join(" · ");
      if(iletisimParca){
        y += 4.2;
        doc.setFont("times", "normal");
        doc.setFontSize(8.25);
        doc.setTextColor.apply(doc, RENK.gri);
        doc.text(iletisimParca, SOL, y);
      }
      y += 5;
    } else {
      y += 1;
    }

    // V.D. No / Müşteri Kodu
    doc.setFont("times", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor.apply(doc, RENK.metin);
    doc.text("V.D. No", SOL, y);
    doc.text(": " + (veri.vdNo || "—"), SOL + 28, y);
    if(veri.musteriKodu){
      y += 4.5;
      doc.text("Müşteri Kodu", SOL, y);
      doc.text(": " + veri.musteriKodu, SOL + 28, y);
    }
    y += 9;

    // Tarih · Teklif No (sağa yaslı)
    doc.setFontSize(9.5);
    doc.setTextColor.apply(doc, RENK.gri);
    var ustBilgi = veri.tarih + "  ·  Teklif No: " + veri.teklifNo;
    doc.text(ustBilgi, 210 - SAG, y, { align: "right" });
    y += 5;

    // Ürün tablosu
    var basliklar = ["Ürün No", "Ürün-Adı", "Adet", "Liste Fiyatı", "İskonto", "Net", "Toplam"];
    if(!veri.primGizli) basliklar.push("Prim");
    var govde = veri.satirlar.map(function(r){
      var satir = ["", r.urunAdi, String(r.adet), r.listeFiyat, r.iskontoMetni, r.net, r.toplamMetni];
      if(!veri.primGizli) satir.push(r.primMetni);
      return satir;
    });

    var sonSutunIndex = veri.primGizli ? 6 : 7;

    doc.autoTable({
      startY: y,
      margin: { left: SOL, right: SAG },
      head: [basliklar],
      body: govde,
      theme: "plain",
      styles: { font: "times", fontSize: 8, textColor: RENK.metin, cellPadding: { top: 2.6, bottom: 2.2, left: 1, right: 1 } },
      headStyles: { fillColor: RENK.griZemin, textColor: RENK.metin, fontStyle: "bold", halign: "right" },
      columnStyles: {
        0: { halign: "left", cellWidth: 26 },
        1: { halign: "left", cellWidth: "auto" },
        2: { halign: "right", cellWidth: 12 },
        3: { halign: "right", cellWidth: 20 },
        4: { halign: "right", cellWidth: 16 },
        5: { halign: "right", cellWidth: 18 },
        6: { halign: "right", cellWidth: 20 },
        7: { halign: "right", cellWidth: 18 }
      },
      didParseCell: function(data){
        if(data.section !== "body") return;
        if(data.column.index === 4) data.cell.styles.textColor = RENK.kirmizi; // İskonto
        if(data.column.index === 5) data.cell.styles.textColor = RENK.yesil;   // Net
        if(data.column.index === 0) data.cell.text = [];                       // B/A kodu elle çizilecek
      },
      didDrawCell: function(data){
        if(data.section === "body" && data.column.index === 0){
          var r = veri.satirlar[data.row.index];
          var cx = data.cell.x + data.cell.padding("left");
          doc.setFont("times", "normal");
          doc.setFontSize(8);
          doc.setTextColor.apply(doc, RENK.kirmizi);
          doc.text("B " + r.berta, cx, data.cell.y + 3.4);
          doc.setTextColor.apply(doc, RENK.mavi);
          doc.text("A " + r.abas, cx, data.cell.y + 7.1);
        }
        // Satırlar arası ince ayraç (son satır hariç) — kutu/çerçeve değil,
        // sadece tbody tr {border-bottom} karşılığı.
        if(data.section === "body" && data.column.index === sonSutunIndex && data.row.index < govde.length - 1){
          doc.setDrawColor.apply(doc, RENK.satirAyrac);
          doc.setLineWidth(0.15);
          doc.line(SOL, data.cell.y + data.cell.height, 210 - SAG, data.cell.y + data.cell.height);
        }
      }
    });

    y = doc.lastAutoTable.finalY + 6;

    // GENEL TOPLAM — başlık satırıyla aynı gri zemin, tüm satır genişliği
    doc.setFillColor.apply(doc, RENK.griZemin);
    doc.roundedRect(SOL, y - 5, GENISLIK, 9, 1.5, 1.5, "F");
    doc.setFont("times", "bold");
    doc.setFontSize(9.75);
    doc.setTextColor.apply(doc, RENK.metin);
    doc.text("GENEL TOPLAM", SOL + 4, y + 0.8);
    doc.setFontSize(11.25);
    doc.text(veri.genelToplamMetni, 210 - SAG - 4, y + 0.8, { align: "right" });
    y += 14;

    // Alt bilgi (Vade / Fatura Türü / Teslimat) — boş olanlar atlanır
    doc.setFont("times", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor.apply(doc, RENK.metin);
    [["Vade", veri.vade], ["Fatura Türü", veri.faturaTuru], ["Teslimat", veri.kargo]]
      .filter(function(satir){ return satir[1]; })
      .forEach(function(satir){
        doc.text(satir[0], SOL, y);
        doc.text(": " + satir[1], SOL + 32, y);
        y += 5.5;
      });

    return doc;
  }

  async function teklifPdfIndir(kayit, musteri, secenekler){
    var doc = await teklifPdfOlustur(kayit, musteri, secenekler);
    var dosyaAdi = (kayit.kod || "Teklif") + ".pdf";
    doc.save(dosyaAdi);
  }

  global.TeklifPdf = {
    veriHazirla: teklifVerisiHazirla,
    olustur: teklifPdfOlustur,
    indir: teklifPdfIndir
  };

})(window);
