// Hava durumu veri katmanı testleri.
//
// Buradaki her test, GERÇEKTEN yaşanmış bir hatanın tekrar etmesini
// engellemek için var. Test adının yanındaki açıklama, o hatanın ne olduğunu
// söylüyor — böylece biri testi "gereksiz" diye silmeye kalkarsa neyi
// kaybedeceğini görüyor.

import { bolum, test, esit, yakin, ozet } from "./kosucu.mjs";

const { getDailyForecast, getHourlyForecast, getCurrentRainChance, getSunTimes, ruzgarYonu, ruzgarOku, getDunFarki, get15Dakikalik } =
  await import("../src/api/weather.js");
const { getClothingAdvice, sicaklikSifati } = await import("../src/logic/clothingAdvice.js");
const { getWeatherTheme, VARSAYILAN_TEMA } = await import("../src/theme/weatherTheme.js");
const { sehirKimligi, AZAMI } = await import("../src/storage/cities.js");

// --- Yardımcı: gerçekçi sahte API yanıtı -----------------------------------
function sahteVeri({ simdi = "2026-08-25T14:30", saatler = 6, temel = 20 } = {}) {
  const gun = simdi.slice(0, 10);
  const time = [];
  const temperature_2m = [];
  const weather_code = [];
  const precipitation_probability = [];
  const visibility = [];

  for (let s = 0; s < 24; s++) {
    time.push(`${gun}T${String(s).padStart(2, "0")}:00`);
    temperature_2m.push(temel + Math.sin((s / 24) * Math.PI * 2) * 5);
    weather_code.push(0);
    precipitation_probability.push(0);
    visibility.push(24000);
  }

  return {
    current: {
      time: simdi,
      temperature_2m: temel,
      apparent_temperature: temel,
      weather_code: 0,
      wind_speed_10m: 10,
      wind_gusts_10m: 18,
      wind_direction_10m: 90,
      relative_humidity_2m: 50,
      dew_point_2m: 9,
      pressure_msl: 1013,
      uv_index: 4,
      precipitation: 0,
      is_day: 1,
    },
    hourly: { time, temperature_2m, weather_code, precipitation_probability, visibility },
    daily: {
      time: [gun],
      weather_code: [0],
      temperature_2m_max: [temel + 4],
      temperature_2m_min: [temel - 6],
      precipitation_probability_max: [0],
      sunrise: [`${gun}T06:20`],
      sunset: [`${gun}T19:50`],
    },
  };
}

// ---------------------------------------------------------------------------
bolum("Saatlik tahmin — saat kayması");

{
  // HATA: current.time dakika içeriyor ("14:30"), saatlik seri tam saatte.
  // `t >= now` içinde bulunulan saati atlıyordu; "Şimdi" bir SONRAKİ saati
  // gösteriyor ve üstteki büyük dereceyle çelişiyordu.
  const d = sahteVeri({ simdi: "2026-08-25T14:30" });
  const s = getHourlyForecast(d, 3);
  esit('"Şimdi" içinde bulunulan saat', s[0].time, "2026-08-25T14:00");
  esit("sonraki sütun bir sonraki saat", s[1].time, "2026-08-25T15:00");
  esit('ilk sütunun etiketi "Şimdi"', s[0].label, "Şimdi");
}

{
  // Tam saat başında da doğru davranmalı.
  const d = sahteVeri({ simdi: "2026-08-25T09:00" });
  esit("tam saatte kayma yok", getHourlyForecast(d, 1)[0].time, "2026-08-25T09:00");
}

{
  const d = sahteVeri({ simdi: "2026-08-25T14:30" });
  esit("yağış olasılığı da doğru saatten", getCurrentRainChance(d), 0);
}

// ---------------------------------------------------------------------------
bolum("Günlük tahmin — ölçüm/tahmin çelişkisi");

{
  // HATA: günlük max bir TAHMİN, current ise ÖLÇÜM. "Şu an 26°" yazarken
  // "Bugün 21°/24°" görünüyordu ve kullanıcı tahmini bozuk sanıyordu.
  const d = sahteVeri({ temel: 30 });
  d.daily.temperature_2m_max = [24];
  d.daily.temperature_2m_min = [18];
  const bugun = getDailyForecast(d)[0];
  test("bugünün aralığı ölçümü kapsıyor", bugun.max >= 30, `max ${bugun.max}`);
}

{
  const d = sahteVeri({ temel: 10 });
  d.daily.temperature_2m_min = [15];
  const bugun = getDailyForecast(d)[0];
  test("aralık aşağı yönde de genişliyor", bugun.min <= 10, `min ${bugun.min}`);
}

{
  // Delikli veri tüm şeridi bozmamalı.
  const d = sahteVeri();
  d.daily.time = ["2026-08-25", "2026-08-26"];
  d.daily.weather_code = [0, 2];
  d.daily.temperature_2m_max = [24, null];
  d.daily.temperature_2m_min = [18, undefined];
  d.daily.precipitation_probability_max = [0, 10];
  const g = getDailyForecast(d);
  esit("eksik günle çökmüyor", g.length, 2);
  test("eksik değer NaN üretmiyor", !Number.isNaN(g[1].max) || g[1].max === null);
}

// ---------------------------------------------------------------------------
bolum("Rüzgar — sürekli / ani hamle ayrımı");

const ruzgarSenaryo = (wind, gusts) =>
  getClothingAdvice(
    {
      temperature_2m: 22,
      apparent_temperature: 22,
      weather_code: 0,
      wind_speed_10m: wind,
      wind_gusts_10m: gusts,
      precipitation: 0,
      uv_index: 3,
      relative_humidity_2m: 50,
      is_day: 1,
    },
    { isPremium: true }
  ).tips.map((t) => t.title);

{
  // HATA: karar `gusts ?? wind` ile veriliyordu. Ani rüzgar sıradan bir günde
  // 40 km/s'i aşıyor, sonuçta neredeyse her gün "Kuvvetli rüzgar" yazıyordu.
  const sakin = ruzgarSenaryo(8, 42);
  test("sakin günde rüzgarlık uyarısı YOK", !sakin.some((t) => t.includes("üzgarlık")), sakin.join(", ") || "uyarı yok");
}
test("gerçekten rüzgarlıysa uyarı var", ruzgarSenaryo(38, 55).some((t) => t === "Rüzgarlık"));
test("hamleli günde ayrı uyarı", ruzgarSenaryo(10, 48).some((t) => t === "Ani rüzgar"));
test("orta rüzgarda ince rüzgarlık", ruzgarSenaryo(22, 30).some((t) => t === "İnce rüzgarlık"));

// ---------------------------------------------------------------------------
bolum("Rüzgar yönü ve oku");

esit("0° = kuzeyden", ruzgarYonu(0), "K");
esit("90° = doğudan", ruzgarYonu(90), "D");
esit("270° = batıdan", ruzgarYonu(270), "B");
// Meteorolojik yön rüzgarın GELDİĞİ yönü verir; ok GİTTİĞİ yönü göstermeli.
// 180° çevirmeyi atlamak, oku tam ters yöne baktıran klasik bir hata.
esit("kuzeyden esen rüzgarın oku güneye bakar", ruzgarOku(0), "↓");
esit("doğudan esen rüzgarın oku batıya bakar", ruzgarOku(90), "←");
esit("geçersiz derece null", ruzgarOku(undefined), null);

// ---------------------------------------------------------------------------
bolum("Kıyafet önerisi — metin/ikon çelişkisi");

const oneri = (kod, gunduz, temp = 22) =>
  getClothingAdvice(
    { temperature_2m: temp, weather_code: kod, is_day: gunduz },
    { isPremium: false }
  ).headline;

// HATA: kod 2 ve 3 de "code <= 3" dalına düşüp "Güneşli ve açık bir gün"
// diyordu — ekranda ☁️ varken metin "güneşli" yazıyordu.
test("kapalı havada güneşli demiyor", !oneri(3, 1).toLowerCase().includes("güneşli"), oneri(3, 1));
test("parçalı bulutluda güneşli demiyor", !oneri(2, 1).toLowerCase().includes("güneşli"), oneri(2, 1));
test("açık havada güneşli diyor", oneri(0, 1).toLowerCase().includes("güneşli"), oneri(0, 1));
// HATA: gece "Güneşli bir gün seni bekliyor" yazıyordu.
test("gece 'gün' demiyor", !oneri(0, 0).includes("bir gün"), oneri(0, 0));
test("gece 'gece' diyor", oneri(0, 0).includes("gece"), oneri(0, 0));

// ---------------------------------------------------------------------------
bolum("Gün doğumu / batımı");

{
  const g = getSunTimes(sahteVeri());
  esit("doğuş saati", g.dogus, "06:20");
  esit("batış saati", g.batis, "19:50");
  esit("veri yoksa null", getSunTimes({}), null);
}

// ---------------------------------------------------------------------------
bolum("Tema kontrastı — WCAG AA (>=4.5:1)");

{
  const kanal = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const lum = (h) => {
    const x = h.replace("#", "");
    return (
      0.2126 * kanal(parseInt(x.slice(0, 2), 16)) +
      0.7152 * kanal(parseInt(x.slice(2, 4), 16)) +
      0.0722 * kanal(parseInt(x.slice(4, 6), 16))
    );
  };
  const oran = (h) => 1.05 / (lum(h) + 0.05);

  // Her hava kodu x gece/gündüz kombinasyonu
  const temalar = [
    ...[0, 1, 2, 3, 45, 51, 61, 71, 95].flatMap((k) => [getWeatherTheme(k, 1), getWeatherTheme(k, 0)]),
    VARSAYILAN_TEMA,
  ];

  let enDusuk = Infinity;
  let kotu = 0;
  let sayilan = 0;
  for (const t of temalar) {
    for (const renk of t.gradient) {
      sayilan++;
      const o = oran(renk);
      if (o < enDusuk) enDusuk = o;
      if (o < 4.5) kotu++;
    }
  }
  esit("kontrast ihlali sayısı", kotu, 0);
  test("en düşük oran 4.5:1 üstünde", enDusuk >= 4.5, `en düşük ${enDusuk.toFixed(2)}:1 · ${sayilan} renk denendi`);
}

// ---------------------------------------------------------------------------
bolum("Bozuk / eksik veriye dayanıklılık");

esit("boş veriyle günlük", getDailyForecast(null).length, 0);
esit("boş veriyle saatlik", getHourlyForecast(undefined).length, 0);
esit("boş veriyle yağış", getCurrentRainChance({}), null);

{
  const a = getClothingAdvice({ temperature_2m: 15, weather_code: 3, is_day: 1 }, {});
  test("eksik alanlarla öneri üretiliyor", a.tips.length > 0);
  test("çıktıya NaN sızmıyor", !JSON.stringify(a).includes("NaN"));
  test("başlık boş değil", a.headline.length > 0);
}

{
  const d = sahteVeri();
  d.hourly.temperature_2m[14] = null;
  const s = getHourlyForecast(d, 2);
  esit("eksik saatlik sıcaklıkla çökmüyor", s.length, 2);
}

// ---------------------------------------------------------------------------
bolum("Kayıtlı şehirler — kimlik");

{
  // RİSK: kimlik isim bazlı olsaydı "İstanbul" ile "İstanbul, Türkiye" ayrı
  // kayıtlar olur ve liste aynı şehirle dolardı.
  const a = { ad: "İstanbul", enlem: 41.0138, boylam: 28.9497 };
  const b = { ad: "İstanbul, Türkiye", enlem: 41.0138, boylam: 28.9497 };
  esit("aynı koordinat aynı kimlik", sehirKimligi(a), sehirKimligi(b));

  const c = { ad: "Ankara", enlem: 39.9334, boylam: 32.8597 };
  test("farklı şehir farklı kimlik", sehirKimligi(a) !== sehirKimligi(c));

  // Yakın ama farklı noktalar ayrılabilmeli (3 ondalık ~110 m çözünürlük).
  const d = { ad: "Yakın", enlem: 41.0200, boylam: 28.9497 };
  test("yakın nokta ayrı kimlik", sehirKimligi(a) !== sehirKimligi(d));

  esit("koordinatsız kayıt kimliksiz", sehirKimligi({ ad: "Yok" }), null);
  esit("null güvenli", sehirKimligi(null), null);
  test("üst sınır makul", AZAMI >= 5 && AZAMI <= 20, `AZAMI=${AZAMI}`);
}

// ---------------------------------------------------------------------------
bolum("Geçmiş günler (past_days=1)");

// past_days=1 istediğimiz için API dizilerin BAŞINA dünü koyuyor. Aşağıdaki
// sahte veri bunu birebir taklit ediyor.
function gecmisliVeri({ simdi = "2026-08-28T10:30", dunSaatlik = 26, bugunSaatlik = 23 } = {}) {
  const time = [];
  const temperature_2m = [];
  const apparent_temperature = [];
  for (const [gun, temel] of [["2026-08-27", dunSaatlik], ["2026-08-28", bugunSaatlik]]) {
    for (let h = 0; h < 24; h++) {
      time.push(`${gun}T${String(h).padStart(2, "0")}:00`);
      temperature_2m.push(temel);
      apparent_temperature.push(temel - 1);
    }
  }
  return {
    current: { time: simdi, temperature_2m: bugunSaatlik, weather_code: 0, is_day: 1 },
    hourly: { time, temperature_2m, apparent_temperature, weather_code: time.map(() => 0) },
    daily: {
      time: ["2026-08-27", "2026-08-28", "2026-08-29", "2026-08-30"],
      weather_code: [3, 0, 0, 61],
      temperature_2m_max: [30, 27, 28, 24],
      temperature_2m_min: [18, 16, 17, 15],
      precipitation_probability_max: [0, 0, 10, 70],
      sunrise: ["2026-08-27T06:00", "2026-08-28T06:01", "2026-08-29T06:02", "2026-08-30T06:03"],
      sunset: ["2026-08-27T19:30", "2026-08-28T19:29", "2026-08-29T19:27", "2026-08-30T19:25"],
    },
  };
}

{
  // RİSK: past_days eklenince günlük dizinin başında DÜN duruyor.
  // Ayıklanmazsa "Bugün" etiketi düne yapışır ve tüm 10 günlük tahmin bir
  // gün kayar — kullanıcı dünün havasını bugünün tahmini sanır.
  const g = getDailyForecast(gecmisliVeri());
  esit("ilk gün bugün", g[0].date, "2026-08-28");
  esit("ilk günün etiketi Bugün", g[0].label, "Bugün");
  esit("dün listede yok", g.some((x) => x.date === "2026-08-27"), false);
  esit("gün sayısı doğru", g.length, 3);
  esit("ikinci gün yarın", g[1].date, "2026-08-29");
}

{
  const h = getHourlyForecast(gecmisliVeri(), 5);
  esit("ilk saat bugün", h[0].time.slice(0, 10), "2026-08-28");
  esit("ilk saat şu anki saat", h[0].time.slice(11), "10:00");
}

// ---------------------------------------------------------------------------
bolum("Düne göre fark");

{
  const f = getDunFarki(gecmisliVeri({ dunSaatlik: 29, bugunSaatlik: 23 }));
  esit("fark hesaplanıyor", f.fark, -6);
  esit("dünün değeri", f.dun, 29);
  esit("bugünün değeri", f.bugun, 23);
}

esit("ısınma pozitif çıkıyor", getDunFarki(gecmisliVeri({ dunSaatlik: 20, bugunSaatlik: 25 })).fark, 5);
esit("dün verisi yoksa null", getDunFarki({ current: { time: "2026-08-28T10:00", temperature_2m: 20 }, hourly: { time: ["2026-08-28T10:00"], temperature_2m: [20] } }), null);
esit("veri yoksa null", getDunFarki(null), null);
esit("current yoksa null", getDunFarki({ hourly: { time: [], temperature_2m: [] } }), null);

{
  // Ay başında dün önceki AYA düşüyor — tarih aritmetiği bunu bilmeli.
  const v = gecmisliVeri();
  v.current.time = "2026-09-01T10:30";
  v.hourly.time = v.hourly.time.map((t, i) =>
    i < 24 ? `2026-08-31T${String(i).padStart(2, "0")}:00` : `2026-09-01T${String(i - 24).padStart(2, "0")}:00`
  );
  test("ay sınırında da dün bulunuyor", getDunFarki(v) !== null);
}

// ---------------------------------------------------------------------------
bolum("15 dakikalık seri");

{
  const v = gecmisliVeri();
  v.minutely_15 = {
    time: ["2026-08-28T10:15", "2026-08-28T10:30", "2026-08-28T10:45", "2026-08-28T11:00"],
    precipitation: [0, 0.4, 1.1, 0.2],
    weather_code: [0, 61, 63, 61],
  };
  const c = get15Dakikalik(v, 10);
  esit("şu andan itibaren başlıyor", c[0].time, "2026-08-28T10:30");
  esit("yağış taşınıyor", c[1].yagisMm, 1.1);
}

esit("15dk verisi yoksa boş dizi", get15Dakikalik(gecmisliVeri(), 5).length, 0);
esit("null veride boş dizi", get15Dakikalik(null).length, 0);

// ---------------------------------------------------------------------------
bolum("Sıcaklık sıfatı");

// ASIL HATA — cihaz testinde yakalandı: kova İKİLİYDİ (20 ve üstü "ılık",
// altı "serin"). Kuveyt'te 38° için "ılık bir gece", −20°'de "serin bir
// gün" yazıyordu. "ılık" Türkçede hafif sıcak demek; 47°'ye çıkan bir
// günde kullanmak uygulamanın havayı hiç anlamadığını gösteriyor.
esit("kavurucu", sicaklikSifati(45), "kavurucu");
esit("bunaltıcı", sicaklikSifati(35), "bunaltıcı");
esit("sıcak", sicaklikSifati(29), "sıcak");
esit("ılık", sicaklikSifati(22), "ılık");
esit("serin", sicaklikSifati(15), "serin");
esit("soğuk", sicaklikSifati(8), "soğuk");
esit("buz gibi", sicaklikSifati(-10), "buz gibi");

test(
  "35° ve üstünde asla 'ılık' denmiyor",
  ![35, 38, 42, 47, 55].some((t) => sicaklikSifati(t) === "ılık")
);
test(
  "0° altında asla 'serin' denmiyor",
  ![-1, -10, -30].some((t) => sicaklikSifati(t) === "serin")
);
test(
  "sıfatlar sıcaklıkla birlikte tek yönde değişiyor",
  (() => {
    const sira = ["buz gibi", "soğuk", "serin", "ılık", "sıcak", "bunaltıcı", "kavurucu"];
    let onceki = -1;
    for (let t = -30; t <= 55; t++) {
      const i = sira.indexOf(sicaklikSifati(t));
      if (i < onceki) return false;
      onceki = i;
    }
    return true;
  })()
);

{
  const bas = (t, code, gun) =>
    getClothingAdvice(
      {
        temperature_2m: t,
        apparent_temperature: t,
        weather_code: code,
        wind_speed_10m: 5,
        precipitation: 0,
        relative_humidity_2m: 50,
        is_day: gun,
      },
      { isPremium: true }
    ).headline;

  // Bağlaç: gökyüzü ile sıcaklık ZITSA "ama", aynı yöndeyse "ve".
  esit("açık + soğuk zıt", bas(10, 0, 1), "Açık ama soğuk bir gün.");
  esit("kapalı + soğuk aynı yön", bas(10, 3, 1), "Kapalı ve soğuk bir gün.");
  esit("kapalı + ılık zıt", bas(22, 3, 1), "Kapalı ama ılık bir gün.");
  esit("açık + sıcak aynı yön", bas(30, 0, 1), "Açık ve sıcak bir gün.");
  esit("açık + bunaltıcı zıt", bas(38, 0, 1), "Açık ama bunaltıcı bir gün.");

  // Keyifli bant için özel cümle korunuyor.
  esit("güneşli ılık gün", bas(23, 0, 1), "Güneşli ve açık bir gün seni bekliyor.");
  test("gece asla 'gün' demiyor", !bas(22, 0, 0).includes(" gün"));
  test("gündüz asla 'gece' demiyor", !bas(22, 0, 1).includes("gece"));

  test(
    "hiçbir başlıkta çift boşluk ya da eksik sıfat yok",
    [-20, -5, 5, 15, 22, 30, 40, 50].every((t) =>
      [0, 1, 2, 3].every((c) =>
        [0, 1].every((g) => {
          const h = bas(t, c, g);
          return h && !h.includes("  ") && !h.includes("undefined") && h.endsWith(".");
        })
      )
    )
  );
}

process.exit(ozet());
