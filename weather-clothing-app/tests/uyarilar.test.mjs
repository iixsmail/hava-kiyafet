// Bildirim uyarısı testleri.
//
// Bu metinler kullanıcının uygulamayı AÇMADAN gördüğü tek şey. Yanlış bir
// uyarı (26°'de "hava soğuyor, katman ekle") tüm uygulamanın güvenilirliğini
// götürüyor — kullanıcı bir daha bildirimlere inanmıyor.

import { bolum, test, esit, ozet } from "./kosucu.mjs";

const U = await import("../src/logic/uyarilar.js");
const {
  DUSUS_ESIGI,
  VARIS_TAVANI,
  YAGIS_KESIN_MM,
  eylemCumlesi,
  sogumaUyarisi,
  yagmurUyarisi,
} = U;

// Saat üretici: hissedilen verilmezse sıcaklığa eşit sayılıyor.
const s = (saat, temp, ek = {}) => ({
  time: `2026-08-28T${String(saat).padStart(2, "0")}:00`,
  temp,
  hissedilen: ek.hissedilen ?? temp,
  code: ek.code ?? 0,
  rainChance: ek.rainChance ?? 0,
  yagisMm: ek.yagisMm ?? 0,
});

// ---------------------------------------------------------------------------
bolum("Soğuma uyarısı — varış sıcaklığı");

{
  // ASIL HATA: kullanıcının saatine gelen bildirim buydu. 32°'den 26°'ye
  // düşüş 6° fark olduğu için "hava soğuyor, üstüne bir katman ekle"
  // gönderiliyordu. 26° sıcak; kimse katman eklemez.
  const seri = [s(19, 32), s(20, 30), s(21, 26), s(22, 26)];
  esit("sıcaktan sıcağa düşüşte uyarı yok", sogumaUyarisi(seri), null);
}

{
  const seri = [s(17, 22), s(18, 20), s(19, 15), s(20, 13)];
  const u = sogumaUyarisi(seri);
  test("serin varışta uyarı var", u !== null);
  esit("varış saati doğru", u.saat, "19:00");
  esit("varış sıcaklığı doğru", u.hissedilen, 15);
  esit("düşüş miktarı doğru", u.dusus, 7);
}

esit(
  "tam tavanda uyarı veriliyor",
  sogumaUyarisi([s(10, 26), s(11, 24), s(12, VARIS_TAVANI), s(13, 18)])?.hissedilen,
  VARIS_TAVANI
);
esit(
  "tavanın bir derece üstünde uyarı yok",
  sogumaUyarisi([s(10, 26), s(11, 24), s(12, VARIS_TAVANI + 1), s(13, 19)]),
  null
);

// ---------------------------------------------------------------------------
bolum("Soğuma uyarısı — hissedilen ve eşik");

{
  // Çıplak sıcaklık 19'da kalıyor ama rüzgarda 12 gibi hissediliyor.
  // Karar hissedilene göre verilmeli.
  const seri = [s(15, 22, { hissedilen: 21 }), s(16, 21, { hissedilen: 19 }), s(17, 19, { hissedilen: 12 })];
  const u = sogumaUyarisi(seri);
  test("hissedilen üzerinden uyarı çıkıyor", u !== null);
  esit("gövdede hissedilen yazıyor", u.hissedilen, 12);
}

{
  // Çıplak sıcaklık çok düşüyor ama hissedilen düşmüyorsa uyarı anlamsız.
  const seri = [s(15, 25, { hissedilen: 17 }), s(16, 22, { hissedilen: 17 }), s(17, 18, { hissedilen: 16 })];
  esit("hissedilen düşmüyorsa uyarı yok", sogumaUyarisi(seri), null);
}

esit(
  "eşiğin altındaki düşüşte uyarı yok",
  sogumaUyarisi([s(10, 16), s(11, 15), s(12, 16 - (DUSUS_ESIGI - 1)), s(13, 12)]),
  null
);

{
  // İlk iki saat atlanıyor: "bir saat sonra" uyarısı için çok geç.
  const seri = [s(10, 20), s(11, 12), s(12, 20)];
  esit("hemen sonraki saatte uyarı yok", sogumaUyarisi(seri), null);
}

// ---------------------------------------------------------------------------
bolum("Soğuma uyarısı — kişisel kayma");

{
  // Kayma hem başlangıca hem varışa uygulandığı için DÜŞÜŞ MİKTARINI
  // değiştirmiyor; değiştirdiği şey varışın "üşütecek kadar serin mi"
  // eşiğini geçip geçmediği. Burada düşüş her iki durumda da 6°.
  const seri = [s(15, 26), s(16, 24), s(17, 20)];
  esit("kaymasız uyarı yok (varış 20° > tavan)", sogumaUyarisi(seri), null);
  const u = sogumaUyarisi(seri, { kayma: -4 });
  test("üşüyen kullanıcıya uyarı gidiyor", u !== null);
  esit("kayma varışa uygulanıyor", u.hissedilen, 16);
  esit("düşüş miktarı kaymadan etkilenmiyor", u.dusus, 6);
}

// ---------------------------------------------------------------------------
bolum("Eylem cümlesi");

esit("dondurucuda mont+atkı", eylemCumlesi(-3).includes("atkı"), true);
esit("soğukta mont", eylemCumlesi(5), "montsuz çıkma");
esit("serinde hırka", eylemCumlesi(12), "yanına bir hırka al");
esit("ılıkta ince ceket", eylemCumlesi(17), "ince bir ceket yeterli olur");
test("hiçbir cümlede kalıp ifade yok", ![-3, 5, 12, 17].some((t) => eylemCumlesi(t).includes("katman ekle")));

// RİSK — gerçek veriyle yakalandı: fonksiyon önce yalnızca soğuma uyarısı
// için yazılmıştı ve 14 üstündeki HER sıcaklığa "ince bir ceket yeterli
// olur" diyordu. Sabah gün özeti 31°'ye kadar çıkınca Rize'de 26° için
// ceket öneriliyordu — kullanıcının en baştan şikâyet ettiği hatanın aynısı.
esit("sıcakta tişört", eylemCumlesi(22), "tişört rahat eder");
esit("çok sıcakta hafif kıyafet", eylemCumlesi(27), "hafif ve nefes alan bir şey giy");
esit("aşırı sıcakta su", eylemCumlesi(33), "en hafifini giy, yanına su al");
test(
  "20° üstünde hiçbir cümlede ceket/mont/hırka geçmiyor",
  ![20, 24, 26, 30, 35, 40].some((t) =>
    /ceket|mont|hırka|atkı/.test(eylemCumlesi(t))
  )
);
test(
  "16° altında hiçbir cümlede tişört geçmiyor",
  ![-10, 0, 8, 12, 14].some((t) => eylemCumlesi(t).includes("tişört"))
);

{
  const u = sogumaUyarisi([s(15, 22), s(16, 20), s(17, 11)]);
  test("gövde saati içeriyor", u.govde.includes("17:00"));
  test("gövde dereceyi içeriyor", u.govde.includes("11°"));
  test("gövde eylemi içeriyor", u.govde.includes("hırka"));
}

// ---------------------------------------------------------------------------
bolum("Yağış uyarısı — miktar temelli");

{
  // İKİNCİ HATA: yalnızca ihtimale bakılıyordu. %70 ihtimalle 0.1 mm
  // çiseleme için "şemsiyeni al" demek, kullanıcıyı boşuna şemsiye
  // taşıtıyor ve uyarıya güvenmeyi bıraktırıyor.
  const seri = [s(19, 20), s(20, 19, { rainChance: 70, yagisMm: 0.1, code: 51 })];
  esit("yüksek ihtimalli çisentide uyarı yok", yagmurUyarisi(seri), null);
}

{
  const seri = [s(19, 20), s(20, 19, { rainChance: 70, yagisMm: 2.4, code: 63 })];
  const u = yagmurUyarisi(seri);
  test("gerçek yağmurda uyarı var", u !== null);
  // Ham milimetre KALDIRILDI: "2.4 mm bekleniyor" kullanıcıların çoğuna
  // bir şey söylemiyordu. Bildirim bir bakışta anlaşılmalı; sayı uygulama
  // içindeki yağış şeridinde, bağlamıyla birlikte duruyor.
  test("şiddet gündelik dille anlatılıyor", u.govde.includes("ıslatır"));
  test("ham milimetre yazılmıyor", !u.govde.includes("mm"));
  test("şemsiye öneriliyor", u.govde.includes("şemsiye"));
}

{
  // Az yağışta AYRI cümle kalıbı: "başlıyor, hafif —" kekeliyordu.
  const seri = [s(19, 20), s(20, 19, { rainChance: 70, yagisMm: 0.6, code: 61 })];
  const u = yagmurUyarisi(seri);
  test("az yağışta 'hafif yağmur' deniyor", u.govde.includes("hafif yağmur"));
  test("az yağışta mm yazılmıyor", !u.govde.includes("mm"));
  test("cümle kekelemiyor", !u.govde.includes("başlıyor, hafif"));
}

{
  const seri = [s(19, 1), s(20, 0, { rainChance: 70, yagisMm: 0.6, code: 71 })];
  esit("az karda 'hafif kar' deniyor", yagmurUyarisi(seri).govde.includes("hafif kar"), true);
}

{
  // Miktar kesin eşiğin üstündeyse ihtimale bakmıyoruz.
  const seri = [s(19, 20), s(20, 19, { rainChance: 20, yagisMm: YAGIS_KESIN_MM, code: 63 })];
  test("yüksek miktarda düşük ihtimal de uyarıyor", yagmurUyarisi(seri) !== null);
}

{
  const seri = [s(19, 1), s(20, 0, { rainChance: 80, yagisMm: 3, code: 73 })];
  const u = yagmurUyarisi(seri);
  test("kar ayrı başlıkla", u.baslik.includes("Kar"));
  test("karda kaymaz ayakkabı", u.govde.includes("kaymaz"));
}

{
  const seri = [s(19, 20), s(20, 19, { rainChance: 90, yagisMm: 9, code: 82 })];
  const u = yagmurUyarisi(seri);
  test("sağanak ayrı başlıkla", u.baslik.includes("Sağanak"));
  test("sağanakta şemsiye yetmez deniyor", u.govde.includes("rüzgarda"));
}

esit("yağışsız seride uyarı yok", yagmurUyarisi([s(10, 20), s(11, 21), s(12, 22)]), null);
esit("boş seride uyarı yok", yagmurUyarisi([]), null);
esit("şu anki saatte uyarı yok", yagmurUyarisi([s(10, 20, { rainChance: 90, yagisMm: 5, code: 63 })]), null);

// ---------------------------------------------------------------------------
bolum("Yağış başlangıcı — 15 dakikalık keskinleştirme");

const c = (saat, dk, mm) => ({
  time: `2026-08-28T${String(saat).padStart(2, "0")}:${String(dk).padStart(2, "0")}`,
  yagisMm: mm,
});

{
  // Saatlik kova "20:00" yağışın 20:00–21:00 arasında BİR YERDE başlayacağı
  // demek. 20:00'de başlıyor demek, 20:45'te yağdığında uyarıyı
  // güvenilmez yapıyor.
  const saatler = [s(19, 20), s(20, 19, { rainChance: 80, yagisMm: 2.0, code: 63 })];
  const ceyrekler = [c(19, 45, 0), c(20, 0, 0), c(20, 15, 0), c(20, 30, 1.2), c(20, 45, 0.8)];
  const u = yagmurUyarisi(saatler, ceyrekler);
  esit("başlangıç çeyreğe çekiliyor", u.saat, "20:30");
  test("gövdede keskin saat var", u.govde.includes("20:30"));
}

{
  // Çeyrek serisi yoksa saatlik kovaya düşmeli, çökmemeli.
  const saatler = [s(19, 20), s(20, 19, { rainChance: 80, yagisMm: 2.0, code: 63 })];
  esit("çeyrek yoksa saatlik kova", yagmurUyarisi(saatler).saat, "20:00");
  esit("boş çeyrek dizisi de sorun değil", yagmurUyarisi(saatler, []).saat, "20:00");
}

{
  // O saatte hiç çeyrek verisi yoksa (kapsama boşluğu) saatlik kova.
  const saatler = [s(19, 20), s(20, 19, { rainChance: 80, yagisMm: 2.0, code: 63 })];
  const ceyrekler = [c(21, 0, 3), c(21, 15, 2)];
  esit("başka saatin çeyreği kullanılmıyor", yagmurUyarisi(saatler, ceyrekler).saat, "20:00");
}

// ---------------------------------------------------------------------------
bolum("Dayanıklılık");

esit("boş seride soğuma yok", sogumaUyarisi([]), null);
esit("tek saatte soğuma yok", sogumaUyarisi([s(10, 20)]), null);
esit("null seride soğuma yok", sogumaUyarisi(null), null);
esit("null seride yağış yok", yagmurUyarisi(null), null);

{
  // Hissedilen eksikse çıplak sıcaklığa düşmeli, çökmemeli.
  const seri = [
    { time: "2026-08-28T15:00", temp: 22, code: 0 },
    { time: "2026-08-28T16:00", temp: 20, code: 0 },
    { time: "2026-08-28T17:00", temp: 12, code: 0 },
  ];
  test("hissedilen yoksa sıcaklık kullanılıyor", sogumaUyarisi(seri)?.hissedilen === 12);
}

// ---------------------------------------------------------------------------
bolum("Yağış şiddeti — gündelik dil");

const { yagisSiddeti } = U;

esit("hafif yağmur", yagisSiddeti(0.5), "hafif olacak");
esit("ıslatan yağmur", yagisSiddeti(2), "ıslatır");
esit("kuvvetli yağmur", yagisSiddeti(5), "iyice ıslatır");
esit("sağanak", yagisSiddeti(12), "bardaktan boşanırcasına yağacak");

// Kar AYRI: "kar başlıyor, ıslatır" yanlış okunuyordu ve karda kullanıcının
// sorusu ıslanmak değil, yolun tutup tutmayacağı.
esit("hafif kar", yagisSiddeti(0.5, true), "hafif olacak");
esit("tutan kar", yagisSiddeti(2, true), "tutmaya başlayabilir");
esit("yoğun kar", yagisSiddeti(10, true), "yoğun olacak");
test(
  "karda hiçbir ifade ıslanmaktan söz etmiyor",
  ![0.5, 2, 5, 10, 20].some((mm) => yagisSiddeti(mm, true).includes("ıslat"))
);
test(
  "her ifade cümleye tam oturuyor",
  [0.5, 2, 5, 12, 20].every((mm) => {
    const c = `20:00 gibi başlıyor, ${yagisSiddeti(mm)} — şemsiyeni al.`;
    return !/,\s+—/.test(c);
  })
);

// ---------------------------------------------------------------------------
bolum("Başlık ile gövde çelişmiyor");

// GERÇEK VERİDE YAKALANDI: başlık yalnızca WMO koduna bakıyordu. Kod 80
// ("hafif sağanak") için "Sağanak geliyor ⛈️" atılıp gövdede "hafif olacak"
// yazıyordu — bildirim kendi kendisiyle çelişiyordu. Fazladan alarm vermek,
// uyarıya duyulan güveni eksik uyarı kadar götürüyor.
{
  const u = yagmurUyarisi([s(19, 20), s(20, 19, { rainChance: 80, yagisMm: 0.8, code: 80 })]);
  esit("hafif sağanak kodunda sakin başlık", u.baslik, "Yağmur geliyor 🌧️");
  test("gövde de hafif diyor", u.govde.includes("hafif yağmur"));
}

{
  const u = yagmurUyarisi([s(19, 20), s(20, 19, { rainChance: 80, yagisMm: 2, code: 80 })]);
  esit("miktar artınca sağanak başlığı", u.baslik, "Sağanak geliyor ⛈️");
}

{
  // Fırtınada miktara bakılmıyor; ama "hafif fırtına" da denmiyor.
  const u = yagmurUyarisi([s(19, 20), s(20, 19, { rainChance: 80, yagisMm: 0.8, code: 95 })]);
  esit("fırtına başlığı", u.baslik, "Fırtına geliyor ⛈️");
  test("hafif fırtına denmiyor", !u.govde.includes("hafif fırtına"));
  test("gök gürültüsü anılıyor", u.govde.includes("gök gürültülü"));
}

test(
  "hiçbir uyarıda başlık 'sağanak' derken gövde 'hafif' demiyor",
  [
    [0.5, 61], [0.8, 80], [1.4, 80], [2, 80], [5, 81], [12, 82],
    [0.5, 95], [3, 96], [0.6, 71], [4, 73],
  ].every(([mm, kod]) => {
    const u = yagmurUyarisi([s(19, 20), s(20, 19, { rainChance: 80, yagisMm: mm, code: kod })]);
    if (!u) return true;
    const alarmli = u.baslik.includes("Sağanak");
    return !(alarmli && u.govde.includes("hafif"));
  })
);

// ---------------------------------------------------------------------------
bolum("Gün gün uyarı planlama");

const GZ = await import("../src/logic/gunOzeti.js");

{
  // Gelecek günler 00:00'dan başlıyor ve gece yarısı günün en soğuk anı.
  // Tepeden dilimlemezsek 26°'den 14°'ye düşen bir günde bile uyarı çıkmıyor.
  const gun = [];
  for (let h = 0; h < 24; h++) {
    const t = h < 6 ? 14 : h < 15 ? 14 + (h - 6) * 1.5 : 26 - (h - 15) * 1.4;
    gun.push(s(h, Math.round(t)));
  }
  esit("tepeden dilimlenmemişse uyarı yok", sogumaUyarisi(gun), null);
  const dilim = GZ.tepedenDilimle(gun);
  const u = sogumaUyarisi(dilim);
  test("tepeden dilimlenince uyarı çıkıyor", u !== null);
  test("dilim tepede başlıyor", dilim[0].temp >= 25);
}

esit("boş günde dilim boş", GZ.tepedenDilimle([]).length, 0);
esit("null günde dilim boş", GZ.tepedenDilimle(null).length, 0);

ozet();
