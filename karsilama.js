/*
  karsilama.js — TKP.08.11.26-18:20.1512
  =====================================
  PIN (pin.html) ve Giriş (login.html) ekranlarında, logonun hemen altında:
    - CİHAZ ADI (ör. "Samsung S22") logonun içinde, alt satırda küçük (08.11.2026, seçenek C),
    - logonun altında saate göre motive edici, ortalanmış bir karşılama sözü.
  (08.11.2026, Abdullah'ın isteği.) Sözlerde kimseye isimle hitap edilmez —
  her kullanıcıya söylenebilecek genel cümleler.

  SAAT DİLİMLERİ: sabah 05:00–11:59 · öğle 12:00–13:59 ·
                  öğleden sonra 14:00–17:59 · akşam 18:00–04:59.

  TEKRAR KURALI: Her dilimin havuzunda tam 60 söz var. Söz, RASTGELE değil,
  takvim gününün sıra numarasına göre seçilir:
      sıra = (gün numarası + cihaza özgü kaydırma) mod havuz boyu
  Böylece ardışık 60 günün her birinde FARKLI bir söz çıkar — aynı söz en
  erken 60 gün sonra tekrar görülür. Aynı gün aynı dilimde kaç kez girilirse
  girilsin aynı söz görünür. Her cihazın kaydırması farklı olduğundan
  telefon/iPad aynı gün aynı sözü görmez. Havuza söz eklenirse (60'tan fazla)
  tekrar aralığı kendiliğinden uzar — sadece aşağıdaki listelere ekleme yap.

  CİHAZ ADI: önce bu cihazda kayıtlı ad (weicon_cihaz_adi) hemen gösterilir;
  oturum açıksa (PIN ekranı) yöneticinin panelden verdiği güncel ad
  (cihazlar/<id>/ad) okunup değişmişse ekranda güncellenir. Ad yoksa sadece
  söz görünür.

  GÜNÜN İLK GİRİŞİ: auth.js, günün ilk girişinde şifre ister ve çıkış
  yaptırıp login.html'e yollarken weicon_gun_ilk_giris_nedeni bayrağını
  bırakır — bu dosya o bayrak varsa Giriş ekranında "Günün ilk girişi"
  başlığını ve kısa açıklamayı gösterir.
*/
var Karsilama = (function(){
  var SOZLER = {
    sabah: [
      "Günaydın! Bugün kapılar sana açılsın, satışlar bol olsun.",
      "Günaydın, yeni bir gün yeni fırsatlar demek.",
      "Günaydın! Enerjin yüksek, hedefin net — başlayalım.",
      "Güne güzel başla; ilk görüşme en iyi siparişi getirebilir.",
      "Günaydın! Bugün de müşterilerin seni görmekten memnun olacak.",
      "Yeni bir sabah, yeni bir sayfa. Günaydın!",
      "Günaydın! Küçük adımlar büyük satışlara dönüşür.",
      "Sabahın bereketi seninle olsun. Bugün iyi şeyler olacak.",
      "Günaydın! Gülümsemen bugünün ilk sözü olsun.",
      "Bugün yapacağın tek bir iyi görüşme bile günü kurtarır. Günaydın!",
      "Günaydın! Hedeflerin seni bekliyor, sen de onlara hazırsın.",
      "Güne kararlı başla, akşama memnun bitir. Günaydın!",
      "Günaydın! Her ziyaret yeni bir ilişkinin başlangıcıdır.",
      "Kahveni al, planını gözden geçir; bugün senin günün. Günaydın!",
      "Günaydın! Bugün sabırla çalışanın günü.",
      "Sabahın ilk ışığı gibi parlak bir gün diliyorum. Günaydın!",
      "Günaydın! Bugün müşterilerine çözüm olacaksın.",
      "Yeni gün, yeni umut, yeni siparişler. Günaydın!",
      "Günaydın! Planlı başlayan gün, başarıyla biter.",
      "Bugün yola çıkarken şunu hatırla: her hayır, bir evete yaklaştırır. Günaydın!",
      "Günaydın! Kendine güven, ürününe güven, yolun açık olsun.",
      "Güne bir hedefle başla: bugün en az bir yeni kapı çal. Günaydın!",
      "Günaydın! Bugün de fark yaratan sen olacaksın.",
      "Sabah erken başlayanın işi kolay biter. Günaydın!",
      "Günaydın! Bugünün şansı, hazırlıklı olanlardan yana.",
      "Yeni bir güne uyandın; bu başlı başına bir fırsat. Günaydın!",
      "Günaydın! İyi dinle, iyi çöz, iyi sat.",
      "Güne pozitif başla; müşteri bunu hisseder. Günaydın!",
      "Günaydın! Bugün attığın her adım hedefe bir adım daha yaklaştırır.",
      "Bu sabah dünden bir adım ileride başlıyorsun. Günaydın!",
      "Günaydın! Bugün kapıdan girdiğin her yer bir fırsat.",
      "Günün erken saatleri en verimli saatlerdir. Günaydın, bol kazançlar!",
      "Günaydın! Başarı, her sabah yeniden başlamaktır.",
      "Bugün de harika işlere imza atacaksın. Günaydın!",
      "Günaydın! Müşterinin ihtiyacını anlayan satışı kazanır.",
      "Güne şükürle ve umutla başla. Günaydın!",
      "Günaydın! Bugün bol ziyaret, bol sipariş, bol kazanç.",
      "Sabah serinliği gibi ferah bir gün olsun. Günaydın!",
      "Günaydın! İstikrar, başarının sırrıdır; bugün de devam.",
      "Yeni bir gün, yeni bir şans. Hadi başlayalım. Günaydın!",
      "Günaydın! Bugünün ilk teklifi belki de en büyüğü olacak.",
      "Güne enerjik başla, yolun açık, işlerin rast gitsin. Günaydın!",
      "Günaydın! Emeklerinin karşılığını bugün de alacaksın.",
      "Bugün kendine bir söz ver: pes etmeyeceksin. Günaydın!",
      "Günaydın! Güzel başlangıçlar güzel sonuçlar getirir.",
      "Sabah sabah moralini yüksek tut; bugün iyi geçecek. Günaydın!",
      "Günaydın! Çalışkanlığın bugün de seni öne çıkaracak.",
      "Bugün de müşterilerinin güvenini kazanacaksın. Günaydın!",
      "Günaydın! Her yeni gün, hedefini büyütmek için bir davet.",
      "Güne hızlı başla, ama acele etme; kalite önce gelir. Günaydın!",
      "Günaydın! Sahada geçecek verimli bir gün seni bekliyor.",
      "Bugün de bir adım önde ol. Günaydın!",
      "Günaydın! Sabırlı ol, istikrarlı ol; sonuç gelecek.",
      "Yeni güne güzel bir niyetle başla. Günaydın!",
      "Günaydın! Bugün attığın tohumlar yarının siparişleri olacak.",
      "Bugün de ürününün arkasında dur, müşterin sana güvensin. Günaydın!",
      "Günaydın! İyi bir başlangıç, işin yarısıdır.",
      "Sabahın tadını çıkar, ardından işe koyul. Günaydın!",
      "Günaydın! Bugün tüm yollar başarıya çıksın.",
      "Güne umutla başla; bugün iyi haberler gelebilir. Günaydın!"
    ],
    ogle: [
      "Merhaba! Gün ortasında ivmeni koru, güzel siparişler seni bekliyor.",
      "Merhaba, kısa bir mola ver; sonra yeni müşterilere devam.",
      "Merhaba! Günün yarısı geride kaldı, en iyi kısmı henüz gelmedi.",
      "Merhaba! Öğle arasında dinlenmeyi unutma; verimin buna bağlı.",
      "Merhaba, gün tam ortasında. Hedefine ne kadar yaklaştın bir bak!",
      "Merhaba! Sabah attığın adımların meyvesini öğleden sonra toplayabilirsin.",
      "Merhaba! Biraz nefes al, enerjini topla, yola devam.",
      "Merhaba! Öğle vakti, yeni fırsatlar için taze bir başlangıç.",
      "Merhaba, harika gidiyorsun. Aynı tempoyla devam!",
      "Merhaba! Bir kahve, bir mola, ardından yeni bir görüşme.",
      "Merhaba! Gün ortası, hedefleri kontrol etmenin tam zamanı.",
      "Merhaba! Sabahın yorgunluğunu at, öğleden sonraya hazırlan.",
      "Merhaba! Bugüne kadarki emeğin için teşekkürler, devam edelim.",
      "Merhaba, öğle sıcağında bile sakin kal; iyi satış sakin kafayla olur.",
      "Merhaba! Günün ikinci yarısı yeni siparişlere gebe.",
      "Merhaba! Bir mola ver, bir plan yap, bir adım daha at.",
      "Merhaba! Hâlâ zamanın var; bugün çok şey başarabilirsin.",
      "Merhaba! Öğle yemeğini ihmal etme, güçlü kal.",
      "Merhaba, her görüşme bir öğrenme fırsatıdır. Sürdür!",
      "Merhaba! Yarı yoldasın; kalan yol seni daha da güçlendirecek.",
      "Merhaba! Müşterilerin seni bekliyor, hadi devam.",
      "Merhaba! Küçük bir mola, büyük bir motivasyon demektir.",
      "Merhaba! Sabahki ilk görüşmelerin güzel geçtiyse, öğleden sonra daha da güzel geçecek.",
      "Merhaba! Gün ortasında dik dur, sonuna kadar kararlı kal.",
      "Merhaba! Bugünkü performansın seni gururlandırsın.",
      "Merhaba, öğle vakti; kendine bir ikram yapmanın tam zamanı.",
      "Merhaba! Şimdi biraz soluklan, sonra yeni hedeflere.",
      "Merhaba! Bir görüşme daha, bir sipariş daha olabilir.",
      "Merhaba! Gün uzun, fırsatlar çok. Devam!",
      "Merhaba! Dinlenen zihin, daha iyi satış yapar.",
      "Merhaba! Hedefine bir adım daha yaklaşmak için hazır mısın?",
      "Merhaba! Öğle arasında planını gözden geçir, rotanı netleştir.",
      "Merhaba, sabırla çalışmak bugün de kazandıracak.",
      "Merhaba! Her mola, günün ikinci yarısına yatırımdır.",
      "Merhaba! Gün ortasında moralini yüksek tut.",
      "Merhaba! Güzel bir öğle, güzel bir öğleden sonranın habercisi.",
      "Merhaba! Bugün şimdiye kadar iyi iş çıkardın, devam et.",
      "Merhaba! Müşterilerine gösterdiğin ilgi her zaman karşılığını bulur.",
      "Merhaba! Soluklan ve yola devam; bu gün senin günün.",
      "Merhaba! Gün ortasında bile pes etmeyenler kazanır.",
      "Merhaba! Kısa bir ara, uzun bir verim.",
      "Merhaba, biraz dinlen; öğleden sonra yeni siparişler bekliyor.",
      "Merhaba! Planlarına sadık kal, sonuçlar gelecektir.",
      "Merhaba! Bugünkü çabanı herkes fark edecek.",
      "Merhaba! Şimdi hem bedenini hem zihnini dinlendirme vakti.",
      "Merhaba! Ritmini kaybetme, güzel işler çıkarıyorsun.",
      "Merhaba! Öğleden sonranın ilk görüşmesi en iyisi olabilir.",
      "Merhaba! Gün yarılandı, motivasyon yeniden doldurulsun.",
      "Merhaba! Her yeni müşteri, yeni bir hikâyedir. Devam!",
      "Merhaba! Dengeni koru: biraz mola, biraz hız.",
      "Merhaba, bugünün yarısını başarıyla geçtin. Gerisi de gelecek.",
      "Merhaba! Güzel bir yemek, güzel bir mola, güzel bir devam.",
      "Merhaba! Hedefin net, yolun açık; sadece devam et.",
      "Merhaba! Kendine güven, bugün çok iyi gidiyorsun.",
      "Merhaba! Gün ortasında bile ışığını kaybetme.",
      "Merhaba! Mola bittiğinde yeni fırsatlar kapıda olacak.",
      "Merhaba! Her adım, bir sonraki siparişe daha yakın.",
      "Merhaba! Bugün atacağın her adım yarına yatırım.",
      "Merhaba! Öğle vakti iyi bir nefes al; sonrası daha kolay.",
      "Merhaba! Gün ortasında kendine bir teşekkür et; hak ettin."
    ],
    ogleden_sonra: [
      "Nasılsın? Umarım günün bol ve başarılı satışlarla geçiyordur.",
      "İyi çalışmalar! Günü güçlü bir kapanışla bitirelim.",
      "Nasılsın? Günün nasıl gidiyor, hedeflere yaklaştın mı?",
      "İyi çalışmalar! Gün bitmeden bir sipariş daha mümkün.",
      "Nasılsın? Umarım gün istediğin gibi ilerliyordur.",
      "İyi çalışmalar! Şu ana kadar yaptıkların için tebrikler.",
      "Nasılsın? Günün son ziyaretleri çoğu zaman en verimli olanlardır.",
      "İyi çalışmalar! Yorulduysan bir nefes al, sonra devam.",
      "Nasılsın? Umarım bugün müşterilerinle güzel görüşmeler yaptın.",
      "İyi çalışmalar! Günün son kısmı, bugünün şansını yakalama zamanı.",
      "Nasılsın? Bugün çok şey başardın, biraz daha gayret.",
      "İyi çalışmalar! Her ziyaret, bir sonraki siparişin kapısıdır.",
      "Nasılsın? Gün bitmeden hedefi tamamlamak için hâlâ vaktin var.",
      "İyi çalışmalar! Sabırla çalıştıkça işler yoluna giriyor.",
      "Nasılsın? Umarım günün bereketli geçmiştir.",
      "İyi çalışmalar! Güçlü bir finale hazır mısın?",
      "Nasılsın? Bugünün emeği yarının kazancı olacak.",
      "İyi çalışmalar! Son görüşmeni de en iyi şekilde yap.",
      "Nasılsın? Gün boyunca gösterdiğin çabaya saygı duyuyorum.",
      "İyi çalışmalar! Şimdiye kadarki çalışman seni gururlandırsın.",
      "Nasılsın? Umarım siparişler yağıyordur.",
      "İyi çalışmalar! Hedefe son düzlükte hızlanma vakti.",
      "Nasılsın? Gün bitmeden bir iyilik, bir görüşme, bir sipariş.",
      "İyi çalışmalar! Yorulsan da pes etme, sonuç yakın.",
      "Nasılsın? Umarım müşterilerin seni mutlu etmiştir.",
      "İyi çalışmalar! Bugünün defterini güzel kapatalım.",
      "Nasılsın? Bugün attığın her adım seni ileri taşıdı.",
      "İyi çalışmalar! Son saatleri verimli geçir.",
      "Nasılsın? Gün boyunca kazandığın deneyim yarın işine yarayacak.",
      "İyi çalışmalar! Her müşteri bir emanettir, hepsini iyi ağırla.",
      "Nasılsın? Umarım günün kazançlı ve huzurlu geçiyordur.",
      "İyi çalışmalar! Şimdi son bir gayret, sonra rahat bir akşam.",
      "Nasılsın? Gün bitmeden küçük bir zafer daha mümkün.",
      "İyi çalışmalar! Emeğin karşılığını mutlaka alacaksın.",
      "Nasılsın? Bugünün kaydını güzel tut; yarın bakınca gurur duyacaksın.",
      "İyi çalışmalar! Sakin kal, odaklan, kapat.",
      "Nasılsın? Günün ikinci yarısı bazen daha bereketli olur.",
      "İyi çalışmalar! Çalışmanın tadını çıkar.",
      "Nasılsın? Umarım bugün de hedeflerine yaklaştın.",
      "İyi çalışmalar! Her gün biraz daha iyiye gidiyorsun.",
      "Nasılsın? Bugünkü en güzel görüşmen belki henüz yapılmadı.",
      "İyi çalışmalar! Kararlılığın sonunda kazandıracak.",
      "Nasılsın? Günün yorgunluğu, başarının tatlı habercisi.",
      "İyi çalışmalar! Bugüne kadar attığın adımlar yeterince güçlü.",
      "Nasılsın? Umarım gün boyunca müşterilerinin yüzü güldü.",
      "İyi çalışmalar! Son sprint başlasın.",
      "Nasılsın? Verdiğin emek bir gün kat kat geri dönecek.",
      "İyi çalışmalar! Günü eksiksiz tamamlamak için az kaldı.",
      "Nasılsın? Sahadaki gayretin işini büyütüyor.",
      "İyi çalışmalar! Her ziyaret, bir tohumdur; sulamaya devam.",
      "Nasılsın? Günün geri kalanı da en az şimdiye kadarki kadar güzel geçsin.",
      "İyi çalışmalar! Bugün de elinden gelenin en iyisini yapıyorsun.",
      "Nasılsın? Birkaç görüşme daha, güzel bir günün sonu.",
      "İyi çalışmalar! Çabaların boşa gitmiyor.",
      "Nasılsın? Gün yavaşlarken sen hızlan, hedef yakın.",
      "İyi çalışmalar! Bugünkü gayretin yarının referansı olacak.",
      "Nasılsın? Güzel bir gün geçiriyorsundur umarım; devam et.",
      "İyi çalışmalar! Her şey yolunda gidiyor, böyle sürdür.",
      "Nasılsın? Bugünün sonunda kendinle gurur duyacaksın.",
      "İyi çalışmalar! Başarı, son dakikaya kadar çalışanlarındır."
    ],
    aksam: [
      "İyi akşamlar! Bugünkü emeğin için teşekkürler, yarın daha da iyisi.",
      "İyi akşamlar, bugünün satışları cebinde — dinlenmeyi hak ettin.",
      "İyi akşamlar! Bugün de elinden gelenin en iyisini yaptın.",
      "İyi akşamlar! Yorgunluğun, başarının güzel bir işareti.",
      "İyi akşamlar! Gün bitti, şimdi kendine zaman ayırma vakti.",
      "İyi akşamlar! Bugünün emeği yarının kazancı.",
      "İyi akşamlar, bugün yaptıkların için kendinle gurur duy.",
      "İyi akşamlar! Biraz dinlen, yarın yeni fırsatlar seni bekliyor.",
      "İyi akşamlar! Güzel bir gün geçirdiysen ne mutlu sana.",
      "İyi akşamlar! Bugünün defterini kapat, huzurla dinlen.",
      "İyi akşamlar! Tüm çabaların için teşekkürler.",
      "İyi akşamlar, günün yorgunluğunu at; yarın taze başlayacaksın.",
      "İyi akşamlar! Bugün her ne yaşadıysan, yarın yeni bir sayfa.",
      "İyi akşamlar! Emeğin boşa gitmedi, gitmeyecek.",
      "İyi akşamlar! Şimdi sevdiklerine ve kendine vakit ayır.",
      "İyi akşamlar! Bugün attığın adımlar yarının temelini oluşturdu.",
      "İyi akşamlar! Güzel bir uyku, güzel bir sabahın başlangıcıdır.",
      "İyi akşamlar! Bugünün sonunda yorgun ama mutlu olmak, güzel bir şeydir.",
      "İyi akşamlar! Bugünkü gayretin için kendini tebrik et.",
      "İyi akşamlar, gün bitti; şimdi huzurun tadını çıkar.",
      "İyi akşamlar! Yarın için planını bir kez gözden geçir, sonra rahatla.",
      "İyi akşamlar! Bugünün yorgunluğu, yarının enerjisi olacak.",
      "İyi akşamlar! Her gün biraz daha ilerliyorsun.",
      "İyi akşamlar! Bu akşam kendine güzel bir mola ver.",
      "İyi akşamlar! Bugünkü çalışman seni hedefe yaklaştırdı.",
      "İyi akşamlar! Evine, ailene ve huzura dönme vakti.",
      "İyi akşamlar! Çalışkanlığın her zaman fark ediliyor.",
      "İyi akşamlar, bugünün tüm emeği için sana teşekkür ederim.",
      "İyi akşamlar! Yarın yeni bir gün, yeni bir şans.",
      "İyi akşamlar! Bugün yaptığın her görüşme bir yatırımdı.",
      "İyi akşamlar! Biraz dinlen, sonra yarın daha güçlü dön.",
      "İyi akşamlar! Gün bitti ama başarılar bitmiyor.",
      "İyi akşamlar! Bugünkü azmin takdire değer.",
      "İyi akşamlar! Akşamın sakinliği sana iyi gelsin.",
      "İyi akşamlar! Kendine iyi bak; yarın yine sahadasın.",
      "İyi akşamlar! Bugünün başarıları yarının motivasyonu olsun.",
      "İyi akşamlar! Güzel bir gün geçirdiysen şükret, geçirmediysen yarın daha iyi olacak.",
      "İyi akşamlar! Bugün kapıları çaldın, yarın kapılar sana açılacak.",
      "İyi akşamlar! Dinlenmeyi hak ettin.",
      "İyi akşamlar! Bu akşam bir şey yapma, sadece dinlen.",
      "İyi akşamlar! Her yorgun akşamın ardında güzel bir sabah var.",
      "İyi akşamlar! Bugün sana düşeni fazlasıyla yaptın.",
      "İyi akşamlar! Çabaların bir gün meyvesini verecek.",
      "İyi akşamlar! Bugünkü performansın hepimizi gururlandırdı.",
      "İyi akşamlar! Telefonu bırak, derin bir nefes al.",
      "İyi akşamlar! Bu akşam sakin bir çay ya da kahve iyi gider.",
      "İyi akşamlar! Bugünü geride bırakıp yarına hazırlan.",
      "İyi akşamlar! Her gün biraz daha tecrübe, biraz daha başarı.",
      "İyi akşamlar! Güzel düşünceler, güzel bir uyku.",
      "İyi akşamlar! Bugünün küçük zaferlerini unutma.",
      "İyi akşamlar! Şimdi kendini şımartma zamanı.",
      "İyi akşamlar! Sahadaki emeğinin karşılığı geliyor.",
      "İyi akşamlar! Yarın için enerjini topla.",
      "İyi akşamlar! Bu akşam huzur seninle olsun.",
      "İyi akşamlar! Bugünkü azmin yarını aydınlatacak.",
      "İyi akşamlar! Gün boyu verdiğin emeğe saygı duyuyorum.",
      "İyi akşamlar! Kendine güzel bir akşam yemeği hak ettin.",
      "İyi akşamlar! Yarın hedeflerine bir adım daha yaklaşacaksın.",
      "İyi akşamlar! Bugün iyi bir gündü; yarın daha da iyisi olacak.",
      "İyi akşamlar! Gün boyu çalışan, akşam huzurla dinlenir."
    ]
  };

  function bandBul(d){
    var s = d.getHours();
    if(s >= 5 && s < 12) return "sabah";
    if(s >= 12 && s < 14) return "ogle";
    if(s >= 14 && s < 18) return "ogleden_sonra";
    return "aksam";
  }

  function gunNo(d){
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  }

  function hash(str){
    var h = 0;
    for(var i = 0; i < str.length; i++){ h = ((h << 5) - h + str.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }

  function cihazId(){
    try{ return localStorage.getItem("weicon_cihaz_id") || ""; }catch(e){ return ""; }
  }

  function sozSec(d){
    d = d || new Date();
    var band = bandBul(d);
    var havuz = SOZLER[band];
    var idx = (gunNo(d) + hash(cihazId() + "|" + band)) % havuz.length;
    return havuz[idx];
  }

  function bugunAnahtari(){
    var d = new Date();
    return d.getFullYear() + "-" + ("0"+(d.getMonth()+1)).slice(-2) + "-" + ("0"+d.getDate()).slice(-2);
  }

  function cihazAdiYerel(){
    try{ return String(localStorage.getItem("weicon_cihaz_adi") || "").trim(); }catch(e){ return ""; }
  }

  function esc(s){
    return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  // Cihaz adını logonun içindeki alt satıra yazar; ad yoksa satır gizlenir ve logo eski boyuna döner.
  function adYaz(v){
    var el = document.getElementById("karsilamaAd");
    if(!el) return;
    v = String(v || "").trim();
    el.textContent = v;
    el.hidden = !v;
    var logo = el.parentNode;
    if(logo && logo.classList) logo.classList.toggle("logo--ad", !!v);
  }

  function ciz(){
    try{
      var logo = document.querySelector(".giris-kutu .logo");
      if(!logo || document.getElementById("karsilamaBlok")) return;
      var blok = document.createElement("div");
      blok.className = "hosg";
      blok.id = "karsilamaBlok";
      // 08.11.2026 (Abdullah onayı — seçenek C): cihaz adı artık logonun İÇİNDE, "İŞ TAKİP" yazısının altında
      // küçük (13px); altındaki blokta sadece ortalanmış karşılama sözü kalır.
      var altAd = document.createElement("span");
      altAd.className = "logo-alt";
      altAd.id = "karsilamaAd";
      logo.appendChild(altAd);
      adYaz(cihazAdiYerel());
      blok.innerHTML = "<div class='hosg-soz'>" + esc(sozSec()) + "</div>";
      logo.parentNode.insertBefore(blok, logo.nextSibling);

      // Oturum açıksa yöneticinin panelden verdiği güncel adı oku.
      try{
        var id = cihazId();
        if(id && typeof firebase !== "undefined" && firebase.auth && firebase.auth().currentUser){
          firebase.database().ref("cihazlar/" + id + "/ad").once("value").then(function(snap){
            var v = String(snap.val() || "").trim();
            if(!v) return;
            adYaz(v);
          }).catch(function(){});
        } else if(id && typeof firebase !== "undefined" && firebase.auth){
          // Oturum durumu birazdan çözülebilir (PIN ekranı açılışı) — bir kez dinle.
          var kapat = firebase.auth().onAuthStateChanged(function(u){
            try{ kapat(); }catch(e){}
            if(!u) return;
            firebase.database().ref("cihazlar/" + id + "/ad").once("value").then(function(snap){
              var v = String(snap.val() || "").trim();
              if(!v) return;
              adYaz(v);
            }).catch(function(){});
          });
        }
      }catch(e){}

      // Günün ilk girişi: Giriş ekranında başlık + kısa açıklama.
      try{
        if(window.location.pathname.indexOf("login.html") >= 0 && localStorage.getItem("weicon_gun_ilk_giris_nedeni") === "1" && localStorage.getItem("weicon_son_sifre_gunu") !== bugunAnahtari()){
          var h1 = document.querySelector(".giris-kutu h1");
          if(h1){
            h1.textContent = "Günün ilk girişi";
            var not = document.createElement("p");
            not.className = "hosg-not";
            not.textContent = "Güvenliğin için günün ilk girişi şifre ile yapılır.";
            h1.parentNode.insertBefore(not, h1.nextSibling);
          }
        }
      }catch(e){}
    }catch(e){}
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", ciz);
  else ciz();

  return { sozSec: sozSec, bandBul: bandBul, SOZLER: SOZLER };
})();
