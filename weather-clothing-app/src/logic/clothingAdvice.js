// Hava durumu verisine bakıp kullanıcıya Türkçe, somut kıyafet/eşya önerileri üretir.
// current: Open-Meteo "current" nesnesi
// isPremium: premium kullanıcıya ekstra/daha detaylı öneriler eklenir
//
// Öneriler artık düz metin değil, yapısal nesne olarak dönüyor:
//   { icon, title, text }
// Böylece arayüz ikonu büyük gösterip başlığı vurgulayabiliyor.

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const STORM_CODES = new Set([95, 96, 99]);
const FOG_CODES = new Set([45, 48]);

/**
 * Sıcaklığın gündelik Türkçedeki karşılığı.
 *
 * ÖNCEDEN İKİ KOVA VARDI: 20 ve üstü "ılık", altı "serin". Kuveyt'te 38°
 * için "ılık bir gece", −20°'de "serin bir gün" yazıyordu. Cihaz testinde
 * yakalandı. "ılık" Türkçede hafif sıcak demek; 47°'ye çıkan bir günde
 * kullanmak, uygulamanın havayı hiç anlamadığını gösteriyor.
 */
export function sicaklikSifati(temp) {
  if (temp >= 40) return "kavurucu";
  if (temp >= 33) return "bunaltıcı";
  if (temp >= 27) return "sıcak";
  if (temp >= 20) return "ılık";
  if (temp >= 12) return "serin";
  if (temp >= 4) return "soğuk";
  return "buz gibi";
}

/** Sıfat "hoş" tarafta mı? Bağlacı (ve / ama) bu belirliyor. */
function sicakligiOlumlu(temp) {
  return temp >= 20 && temp < 33;
}

/**
 * Gökyüzü + sıcaklık başlığı.
 *
 * Bağlaç bilinçli: gökyüzü ile sıcaklık ZITSA "ama" ("Açık ama serin"),
 * aynı yöndeyse "ve" ("Kapalı ve soğuk"). Türkçede bu ayrım cümleyi
 * doğal kılan şey.
 */
function gokyuzuCumlesi(code, temp, gunduz) {
  const sifat = sicaklikSifati(temp);
  const zaman = gunduz === 0 ? "gece" : "gün";
  const acik = code <= 1;
  const kapali = code === 3;

  // Gökyüzü "hoş" mu? Açık hoş, kapalı değil, parçalı bulutlu nötr.
  const gokOlumlu = acik ? true : kapali ? false : null;
  const sicakOlumlu = sicakligiOlumlu(temp);
  const baglac = gokOlumlu === null || gokOlumlu === sicakOlumlu ? "ve" : "ama";

  // Havanın tam da keyifli olduğu dar bant: uygulamanın sesi burada
  // biraz sıcak olsun.
  if (acik && gunduz === 1 && temp >= 20 && temp < 27) {
    return "Güneşli ve açık bir gün seni bekliyor.";
  }

  if (code === 2) return `Parçalı bulutlu, ${sifat} bir ${zaman}.`;
  const gok = acik ? "Açık" : "Kapalı";
  return `${gok} ${baglac} ${sifat} bir ${zaman}.`;
}

/**
 * @param kayma Kişisel sıcaklık kayması (°C). Kullanıcının geri
 *   bildiriminden öğreniliyor; yalnızca KIYAFET eşiklerini ötelüyor,
 *   gösterilen sıcaklığa dokunmuyor. Ayrıntı: src/logic/kalibrasyon.js
 */
export function getClothingAdvice(current, { isPremium = false, kayma = 0 } = {}) {
  const {
    temperature_2m: temp,
    apparent_temperature: feelsLike,
    weather_code: code,
    wind_speed_10m: wind,
    wind_gusts_10m: gusts,
    precipitation: precip,
    uv_index: uv,
    relative_humidity_2m: humidity,
    is_day: gunduz = 1,
  } = current;

  const tips = [];
  let headline = "";

  const ekle = (icon, title, text) => tips.push({ icon, title, text });

  // --- Yağış durumu ---
  if (RAIN_CODES.has(code) || precip > 0.2) {
    if (code === 61 || code === 51 || code === 80) {
      headline = "Hafif yağmur geçişi var, şemsiyeni almayı unutma.";
      ekle("☂️", "Şemsiye", "Katlanabilir bir şemsiye çantana atabilirsin.");
    } else if (code === 65 || code === 82 || code === 81) {
      headline = "Kuvvetli yağmur bekleniyor, sırılsıklam olmadan çıkmanın yolunu ara.";
      ekle("🧥", "Yağmurluk", "Su geçirmez mont ya da yağmurluk giy.");
      ekle("☂️", "Sağlam şemsiye", "Rüzgara dayanıklı bir şemsiye tercih et.");
      ekle("👟", "Su geçirmez ayakkabı", "Ayakkabın ıslanabilir, ona göre seç.");
    } else {
      headline = "Yağmurlu bir gün seni bekliyor, şemsiyeni yanına al.";
      ekle("☂️", "Şemsiye", "Şemsiyeni ya da yağmurluğunu yanına al.");
    }
  } else if (SNOW_CODES.has(code)) {
    headline = "Kar yağışı var, kalın ve su geçirmez giyin.";
    ekle("🧣", "Bere ve eldiven", "Kalın atkı, bere ve eldiven al.");
    ekle("🥾", "Kaymaz bot", "Su geçirmez, kaymaz tabanlı bot giy.");

  } else if (STORM_CODES.has(code)) {
    headline = "Gök gürültülü fırtına bekleniyor, mümkünse dışarı çıkmayı ertele.";
    ekle("⛈️", "Planını ertele", "Zorunlu değilse dışarı çıkmayı ertele.");
    ekle("🧥", "Su geçirmez mont", "Şemsiye rüzgarda işe yaramayabilir.");
  } else if (FOG_CODES.has(code)) {
    headline = "Sisli bir gün, görüş mesafesi düşük olabilir.";
    ekle("🚗", "Dikkatli sür", "Trafikteysen far kullan, mesafeni koru.");
  } else if (code <= 3) {
    // Metin ekrandaki ikonla ÇELİŞMEMELİ. İki ayrım birden gerekiyor:
    // gece hilal ikonu varken "gün" dememek, kapalı havada ☁️ ikonu
    // varken "güneşli" dememek (kod 3 de bu dala düşüyor).
    headline = gokyuzuCumlesi(code, temp, gunduz);
  }

  // --- Sıcaklık bazlı öneriler (feels-like üzerinden) ---
  //
  // Kişisel kayma BURADA uygulanıyor — tek noktada. Kullanıcı "üşüdüm"
  // dedikçe kayma negatifleşiyor ve aynı hava için bir üst kalınlık
  // sınıfına geçiyoruz.
  const effectiveTemp = (feelsLike ?? temp) + (Number.isFinite(kayma) ? kayma : 0);
  if (effectiveTemp <= 0) {
    ekle("🧥", "Kalın mont", "Bere, eldiven ve atkı da şart.");
  } else if (effectiveTemp <= 8) {
    ekle("🧥", "Kaban", "Kalın mont ya da kaban şart.");
  } else if (effectiveTemp <= 14) {
    ekle("🧶", "Hırka", "Hırka ya da ince mont yeterli olur.");
  } else if (effectiveTemp <= 20) {
    ekle("👕", "Uzun kollu", "Uzun kollu tişört ya da ince ceket tam olur.");
  } else if (effectiveTemp <= 27) {
    ekle("👕", "Hafif kıyafet", "Nefes alan, hafif kumaşlar tercih et.");
  } else {
    ekle("🩳", "Şort ve bol su", "Açık renkli, hafif giyin; bol su iç.");
  }

  // --- Rüzgar ---
  // Karar SÜREKLİ rüzgara göre verilir. Önceden `gusts ?? wind` kullanılıyordu
  // ama ani rüzgar sıradan bir günde bile 40 km/s'i aşıyor; sonuçta neredeyse
  // her gün "Kuvvetli rüzgar var" yazıyor ve öneri güvenilirliğini yitiriyordu.
  // Ani rüzgar artık yalnızca sürekli rüzgarın belirgin üstündeyse (>= 1.6x ve
  // 45 km/s) ayrı bir uyarı olarak ekleniyor.
  const effectiveWind = wind ?? gusts ?? 0;
  if (effectiveWind >= 35) {
    ekle("💨", "Rüzgarlık", "Kuvvetli rüzgar var, rüzgar geçirmez giy.");
  } else if (effectiveWind >= 20) {
    ekle("💨", "İnce rüzgarlık", "Rüzgarlı, ince bir rüzgarlık işine yarar.");
  }
  if (gusts != null && gusts >= 45 && gusts >= effectiveWind * 1.6) {
    ekle("🌬️", "Ani rüzgar", `Ani rüzgarlar ${Math.round(gusts)} km/s'i bulabilir, şemsiyene dikkat et.`);
  }

  // --- UV ---
  if (uv !== undefined && uv >= 6) {
    ekle("🕶️", "Güneş koruması", "UV yüksek; güneş kremi ve şapka al.");
  }

  if (!headline) {
    const zaman = gunduz === 0 ? "Şu an" : "Bugün";
    headline = `${zaman} ${Math.round(temp)}°C civarında, ${describeGeneral(code)}.`;
  }

  // --- Bir bakışta "bugünün kombini" (emoji şeridi) ---
  // Amaç: kullanıcı metni okumadan, sadece ikonlara bakarak ne alması
  // gerektiğini anlasın.
  const outfit = [];
  if (effectiveTemp <= 0) outfit.push("🧥", "🧣", "🧤");
  else if (effectiveTemp <= 8) outfit.push("🧥", "🧣");
  else if (effectiveTemp <= 14) outfit.push("🧶");
  else if (effectiveTemp <= 20) outfit.push("👕", "🧥");
  else if (effectiveTemp <= 27) outfit.push("👕");
  else outfit.push("👕", "🩳");

  const yagmurluMu = RAIN_CODES.has(code) || precip > 0.2;
  if (SNOW_CODES.has(code)) outfit.push("🥾");
  else if (yagmurluMu) outfit.push("👟", "☂️");
  if (uv !== undefined && uv >= 6) outfit.push("🕶️");
  if (effectiveWind >= 20 && !outfit.includes("🧥")) outfit.push("🧥");

  // Ücretsiz kullanıcıya en fazla 3 öneri, premium'a tüm liste + nem/detay yorumu
  const limitedTips = isPremium ? [...tips] : tips.slice(0, 3);

  if (isPremium && humidity !== undefined) {
    if (humidity >= 70) {
      limitedTips.push({
        icon: "💧",
        title: "Nem yüksek",
        text: "Terleme hissedebilirsin — nefes alan kumaş tercih et.",
      });
    } else if (humidity <= 25) {
      limitedTips.push({
        icon: "🏜️",
        title: "Hava kuru",
        text: "Cildin ve dudakların kuruyabilir, nemlendirici bulundur.",
      });
    }
  }

  // Tek satırlık özet: "Hafif kıyafet · Güneş koruması · Rüzgarlık"
  const ozet = limitedTips
    .slice(0, 3)
    .map((t) => t.title)
    .join("  ·  ");

  return {
    headline,
    ozet,
    outfit: outfit.slice(0, 5),
    tips: limitedTips,
    lockedExtraCount: isPremium ? 0 : Math.max(0, tips.length - 3),
  };
}

function describeGeneral(code) {
  if (code <= 1) return "açık bir hava var";
  if (code <= 3) return "bulutlu bir hava var";
  return "değişken bir hava var";
}
