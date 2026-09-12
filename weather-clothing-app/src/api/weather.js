// Open-Meteo: ücretsiz, API anahtarı gerektirmez, Türkiye dahil global kapsama sahiptir.
// Belgeler: https://open-meteo.com/en/docs

const WEATHER_BASE_URL = "https://api.open-meteo.com/v1/forecast";
const GEOCODE_BASE_URL = "https://geocoding-api.open-meteo.com/v1/search";

// WMO hava kodu -> Türkçe açıklama + ikon eşlemesi
export const WMO_CODES = {
  0: { text: "Açık", icon: "☀️" },
  1: { text: "Genelde açık", icon: "🌤️" },
  2: { text: "Parçalı bulutlu", icon: "⛅" },
  3: { text: "Kapalı", icon: "☁️" },
  45: { text: "Sisli", icon: "🌫️" },
  48: { text: "Kırağı sisi", icon: "🌫️" },
  51: { text: "Hafif çisenti", icon: "🌦️" },
  53: { text: "Çisenti", icon: "🌦️" },
  55: { text: "Yoğun çisenti", icon: "🌧️" },
  56: { text: "Donan çisenti", icon: "🌧️" },
  57: { text: "Yoğun donan çisenti", icon: "🌧️" },
  61: { text: "Hafif yağmur", icon: "🌦️" },
  63: { text: "Yağmurlu", icon: "🌧️" },
  65: { text: "Kuvvetli yağmur", icon: "🌧️" },
  66: { text: "Donan yağmur", icon: "🌧️" },
  67: { text: "Kuvvetli donan yağmur", icon: "🌧️" },
  71: { text: "Hafif kar yağışı", icon: "🌨️" },
  73: { text: "Kar yağışı", icon: "🌨️" },
  75: { text: "Yoğun kar yağışı", icon: "❄️" },
  77: { text: "Kar taneleri", icon: "❄️" },
  80: { text: "Hafif sağanak", icon: "🌦️" },
  81: { text: "Sağanak yağış", icon: "🌧️" },
  82: { text: "Şiddetli sağanak", icon: "⛈️" },
  85: { text: "Hafif kar sağanağı", icon: "🌨️" },
  86: { text: "Kuvvetli kar sağanağı", icon: "❄️" },
  95: { text: "Gök gürültülü fırtına", icon: "⛈️" },
  96: { text: "Dolu ile fırtına", icon: "⛈️" },
  99: { text: "Kuvvetli dolu ile fırtına", icon: "⛈️" },
};

// Gece için ayrı ikonlar: saat 23:00'te güneş göstermek yanlış görünüyor.
// Sadece açık/az bulutlu kodlarda anlamlı (yağmur/kar ikonu gece de aynı).
const GECE_IKONLARI = { 0: "🌙", 1: "🌙", 2: "☁️" };

export function describeWeatherCode(code, isDay = 1) {
  const temel = WMO_CODES[code] || { text: "Bilinmiyor", icon: "❓" };
  if (isDay === 0 && GECE_IKONLARI[code]) {
    return { ...temel, icon: GECE_IKONLARI[code] };
  }
  return temel;
}

/**
 * Ağ isteğini Türkçeleştirilmiş hatalarla sarar.
 *
 * `fetch` bağlantı koptuğunda TypeError fırlatıyor ve mesajı İNGİLİZCE:
 * "Network request failed". Bu metin doğrudan kullanıcının ekranına
 * düşüyordu — cihazda görüldü. Türkçe bir uygulamada ham İngilizce hata
 * hem kırık hem de güvensiz görünüyor; üstelik kullanıcıya ne yapacağını
 * söylemiyor.
 */
async function agdanAl(url, hataMetni) {
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new Error("İnternet bağlantısı yok gibi görünüyor. Bağlantını kontrol edip tekrar dene.");
  }
  if (!res.ok) throw new Error(hataMetni);
  try {
    return await res.json();
  } catch (e) {
    throw new Error("Sunucudan beklenmeyen bir yanıt geldi. Birazdan tekrar dener misin?");
  }
}

// Şehir adına göre koordinat bulma (kullanıcı konum izni vermezse fallback)
export async function geocodeCity(cityName) {
  const url = `${GEOCODE_BASE_URL}?name=${encodeURIComponent(
    cityName
  )}&count=5&language=tr&format=json`;
  const data = await agdanAl(url, "Şehir aranırken bir sorun oldu. Birazdan tekrar dene.");
  if (!data.results || data.results.length === 0) {
    throw new Error("Şehir bulunamadı.");
  }
  return data.results.map((r) => ({
    name: r.name,
    admin1: r.admin1,
    country: r.country,
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

// Belirli bir koordinat için günlük + saatlik hava durumu
export async function fetchWeather(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    timezone: "auto",
    current: [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      // Çiy noktası, "ne kadar bunaltıcı" sorusunun bağıl nemden çok daha
      // iyi cevabı: %70 nem 5°C'de kuru hissettirir, 28°C'de boğucu.
      // Bağıl nem sıcaklığa göre değişir, çiy noktası mutlak bir ölçü.
      "dew_point_2m",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
      "wind_gusts_10m",
      "wind_direction_10m",
      "uv_index",
      // Basınç kartı için MUTLAKA `pressure_msl` (deniz seviyesine
      // indirgenmiş) kullanılıyor, `surface_pressure` DEĞİL. Yüzey basıncı
      // rakımla düşüyor: Ankara'da (~900 m) 918 hPa okunuyor ve "1013
      // altı = alçak basınç" yorumu her rakımlı şehirde sürekli yanlış
      // uyarı verirdi. MSL, konumdan bağımsız karşılaştırılabilir.
      "pressure_msl",
      // Arayüz temasını gece/gündüze göre değiştirmek için gerekli (1 = gündüz)
      "is_day",
    ].join(","),
    // Görüş mesafesi yalnızca saatlik seride veriliyor; "şu anki" değeri
    // içinde bulunulan saatten okuyoruz.
    // Saatlik seri, gelecek saatler için verilen TÜM kararların girdisi:
    // katman planı, yağış uyarısı, ani soğuma uyarısı ve sabah özeti.
    //
    // Önceden yalnızca çıplak sıcaklık ve yağış İHTİMALİ isteniyordu.
    // İkisi de kıyafet kararı için yetersiz:
    //   - "18°" rüzgarda 13° gibi hissedilir; kararı hissedilen belirler.
    //   - "%60 ihtimal" 0.2 mm çiseleme de olabilir 6 mm sağanak da; şemsiye
    //     kararını MİKTAR belirler, ihtimal değil.
    hourly: [
      "temperature_2m",
      "apparent_temperature",
      "precipitation_probability",
      "precipitation",
      "wind_speed_10m",
      "relative_humidity_2m",
      "weather_code",
      "visibility",
    ].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "wind_speed_10m_max",
      "uv_index_max",
      // Saatlik şeritte her saatin gece mi gündüz mü olduğunu bilmek için
      "sunrise",
      "sunset",
    ].join(","),
    // 15 dakikalık seri — YALNIZCA yağışın ne zaman başlayacağı için.
    //
    // Saatlik seride "20:00" kovası, yağışın 20:00 ile 21:00 arasında bir
    // yerde başlayacağı anlamına geliyor. Kullanıcıya "20:00 gibi başlıyor"
    // deyip 20:50'de yağdırmak, uyarıyı güvenilmez yapıyor. 15 dakikalık
    // seri zamanlamayı dört kat hassaslaştırıyor.
    //
    // 12 saatle sınırlıyoruz (48 adım): tüm tahmin aralığı için istemek
    // yanıtı 14 KB'den 31 KB'ye çıkarıyor, 12 saat ise yalnızca +1.4 KB.
    // Uyarılar zaten 12 saatlik pencereye bakıyor.
    minutely_15: ["precipitation", "weather_code"].join(","),
    forecast_minutely_15: "48",
    // Dün de isteniyor — "dünden 6° soğuk" karşılaştırması için.
    //
    // İnsanlar mutlak dereceye değil DÜNE kalibre oluyor: "23°" tek başına
    // bir şey söylemiyor, "dünden 6° soğuk" ceket kararını doğrudan
    // değiştiriyor. Maliyeti +1.3 KB.
    //
    // DİKKAT: bu, saatlik ve günlük dizilerin BAŞINA dünü ekliyor.
    // getDailyForecast bunu ayıklamak zorunda; ayıklamazsa 10 günlük tahmin
    // "Bugün" diye dünü gösterir.
    past_days: "1",
    forecast_days: "10",
  });

  return agdanAl(
    `${WEATHER_BASE_URL}?${params.toString()}`,
    "Hava durumu şu an alınamadı. Birazdan tekrar dene."
  );
}

// --- Arayüz için yardımcılar ---------------------------------------------
// API zaten saatlik ve 10 günlük veriyi çekiyordu ama arayüzde kullanılmıyordu.

const GUN_KISALTMA = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

// "2026-08-09T18:00" -> "18:00"
function saatEtiketi(isoString) {
  return isoString?.slice(11, 16) || "";
}

// "2026-08-09" -> "Paz". Date'i elle kuruyoruz ki saat dilimi kaymasın.
function gunEtiketi(isoDate, index) {
  if (index === 0) return "Bugün";
  const [y, m, d] = isoDate.split("-").map(Number);
  return GUN_KISALTMA[new Date(y, m - 1, d).getDay()];
}

// Verilen saatin gündüz mü olduğunu o günün doğuş/batış saatinden bulur.
// Tüm zamanlar aynı yerel formatta ("2026-08-09T22:00") olduğu için
// düz metin karşılaştırması güvenli.
function gunduzMu(isoTime, data) {
  const daily = data?.daily;
  if (!daily?.sunrise?.length) return 1;

  const gun = isoTime.slice(0, 10);
  const i = daily.time.findIndex((t) => t === gun);
  if (i < 0) return 1;

  const dogus = daily.sunrise[i];
  const batis = daily.sunset[i];
  if (!dogus || !batis) return 1;

  return isoTime >= dogus && isoTime < batis ? 1 : 0;
}

// Şu andan itibaren gelecek N saatin listesi
export function getHourlyForecast(data, count = 24) {
  const hourly = data?.hourly;
  if (!hourly?.time?.length) return [];

  // Open-Meteo'nun `current.time` değeri dakika içerir ("...T14:30"), saatlik
  // seri ise tam saatlerde ilerler ("...T14:00"). İkisini doğrudan
  // karşılaştırınca içinde bulunduğumuz saat ATLANIYOR: "Şimdi" sütunu bir
  // sonraki saati gösteriyor ve üstteki büyük dereceyle çelişiyordu.
  // Aynı kayma getCurrentRainChance'i de yanlış saate bakmaya zorluyordu.
  const now = data.current?.time || "";
  const suAnkiSaat = now.length >= 13 ? `${now.slice(0, 13)}:00` : now;
  let start = hourly.time.findIndex((t) => t >= suAnkiSaat);
  if (start < 0) start = 0;

  return hourly.time.slice(start, start + count).map((time, i) => {
    const idx = start + i;
    return {
      time,
      label: i === 0 ? "Şimdi" : saatEtiketi(time),
      temp: hourly.temperature_2m?.[idx],
      // Hissedilen yoksa çıplak sıcaklığa düşüyoruz: bazı modeller bu alanı
      // her saat için vermiyor ve null bir değer kararları bozardı.
      hissedilen: hourly.apparent_temperature?.[idx] ?? hourly.temperature_2m?.[idx],
      code: hourly.weather_code?.[idx],
      rainChance: hourly.precipitation_probability?.[idx],
      yagisMm: hourly.precipitation?.[idx],
      ruzgar: hourly.wind_speed_10m?.[idx],
      nem: hourly.relative_humidity_2m?.[idx],
      gorus: hourly.visibility?.[idx],
      isDay: gunduzMu(time, data),
    };
  });
}

// 10 günlük özet listesi
export function getDailyForecast(data) {
  const daily = data?.daily;
  if (!daily?.time?.length) return [];

  // Günlük max/min bir TAHMİN, `current.temperature_2m` ise ÖLÇÜM — ikisi
  // çelişebiliyor. "Şu an 26°" yazarken "Bugün 21°/24°" görünüyordu ve
  // kullanıcıya tahmin bozukmuş gibi geliyordu. Bugünün aralığını ölçülen
  // sıcaklığı kapsayacak kadar genişletiyoruz; diğer günlere dokunmuyoruz.
  const suAnki = data?.current?.temperature_2m;

  // GEÇMİŞ GÜNLERİ ATLA.
  //
  // `past_days=1` istediğimiz için dizinin başında dün duruyor. Ayıklamazsak
  // "Bugün" etiketi düne yapışır ve tüm 10 günlük tahmin bir gün kayar.
  const bugun = (data?.current?.time || "").slice(0, 10);
  let bas = bugun ? daily.time.findIndex((t) => t >= bugun) : 0;
  if (bas < 0) bas = 0;

  return daily.time.slice(bas).map((date, i) => {
    const idx = bas + i;
    let max = daily.temperature_2m_max?.[idx];
    let min = daily.temperature_2m_min?.[idx];
    if (i === 0 && typeof suAnki === "number") {
      if (typeof max === "number") max = Math.max(max, suAnki);
      if (typeof min === "number") min = Math.min(min, suAnki);
    }
    return {
      date,
      label: gunEtiketi(date, i),
      code: daily.weather_code?.[idx],
      max,
      min,
      rainChance: daily.precipitation_probability_max?.[idx],
    };
  });
}

/**
 * 15 dakikalık yağış serisi — şu andan itibaren.
 *
 * Yalnızca yağışın BAŞLANGIÇ ANINI hassaslaştırmak için var. Miktar
 * eşikleri saatlik seride kalıyor: burada gelen değer 15 dakikalık toplam,
 * saatlikse saatlik toplam; ikisini karıştırmak eşikleri bozardı.
 */
export function get15Dakikalik(data, count = 48) {
  const m = data?.minutely_15;
  if (!m?.time?.length) return [];

  const now = data.current?.time || "";
  // Şu anki çeyreği de dahil ediyoruz: yağış bu çeyrek içinde başlamış
  // olabilir ve kullanıcı henüz dışarı çıkmamış olabilir.
  let start = m.time.findIndex((t) => t >= now.slice(0, 16));
  if (start < 0) start = 0;

  return m.time.slice(start, start + count).map((time, i) => ({
    time,
    yagisMm: m.precipitation?.[start + i],
    code: m.weather_code?.[start + i],
  }));
}

/**
 * Dün aynı saate göre fark.
 *
 * "23°" tek başına bir şey söylemiyor; "dünden 6° soğuk" ceket kararını
 * doğrudan değiştiriyor. Karşılaştırmayı AYNI SAATLE yapıyoruz — günün
 * en yükseğiyle kıyaslamak sabah 8'de anlamsız olurdu.
 *
 * @returns null | { fark, dun, bugun }  (fark = bugün - dün)
 */
export function getDunFarki(data) {
  const h = data?.hourly;
  const simdi = data?.current?.time;
  const suAnki = data?.current?.temperature_2m;
  if (!h?.time?.length || !simdi || typeof suAnki !== "number") return null;

  // Dünün aynı saati. Tarihi elle kuruyoruz ki saat dilimi kaymasın.
  const [y, ay, gun] = simdi.slice(0, 10).split("-").map(Number);
  const d = new Date(y, ay - 1, gun);
  d.setDate(d.getDate() - 1);
  const p = (n) => String(n).padStart(2, "0");
  const dunSaat = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${simdi.slice(11, 13)}:00`;

  const i = h.time.indexOf(dunSaat);
  if (i < 0) return null;
  const dun = h.temperature_2m?.[i];
  if (typeof dun !== "number") return null;

  return { fark: suAnki - dun, dun, bugun: suAnki };
}

// Şu anki saat için yağış olasılığı (current bloğunda gelmiyor)
export function getCurrentRainChance(data) {
  return getHourlyForecast(data, 1)[0]?.rainChance ?? null;
}

// Şu anki görüş mesafesi (metre). Open-Meteo bunu yalnızca saatlik seride
// veriyor, current bloğunda yok.
export function getCurrentVisibility(data) {
  return getHourlyForecast(data, 1)[0]?.gorus ?? null;
}

// Bugünün gün doğumu / batımı — "2026-08-25T06:20" -> "06:20"
export function getSunTimes(data) {
  const daily = data?.daily;
  if (!daily?.time?.length) return null;
  const dogus = daily.sunrise?.[0];
  const batis = daily.sunset?.[0];
  if (!dogus || !batis) return null;
  return { dogus: dogus.slice(11, 16), batis: batis.slice(11, 16), dogusIso: dogus, batisIso: batis };
}

// Derece cinsinden rüzgar yönünü 8 yönlü pusula adına çevirir.
const YONLER = ["K", "KD", "D", "GD", "G", "GB", "B", "KB"];
export function ruzgarYonu(derece) {
  if (typeof derece !== "number" || !Number.isFinite(derece)) return null;
  return YONLER[Math.round((derece % 360) / 45) % 8];
}

// Meteorolojik yön oku.
//
// DİKKAT: `wind_direction_10m` rüzgarın GELDİĞİ yönü verir (meteoroloji
// standardı) — 0° kuzeyden esen rüzgar demektir. Ok ise rüzgarın GİTTİĞİ
// yönü göstermeli, yani 180° çevrilmiş hâlini. Bu çevirmeyi atlamak,
// oku tam ters yöne bakan klasik bir hatadır.
const OKLAR = ["↓", "↙", "←", "↖", "↑", "↗", "→", "↘"];
export function ruzgarOku(derece) {
  if (typeof derece !== "number" || !Number.isFinite(derece)) return null;
  return OKLAR[Math.round((derece % 360) / 45) % 8];
}
