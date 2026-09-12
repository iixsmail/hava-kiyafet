// Hava durumuna ve gece/gündüz bilgisine göre ekranın renk paletini belirler.
// Amaç: uygulama açıldığında "bugün hava nasıl" hissini renkten de vermek.

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const STORM_CODES = new Set([95, 96, 99]);
const FOG_CODES = new Set([45, 48]);

// Tüm temalarda kartlar yarı saydam beyaz olduğu için ortak kalıyor.
const ORTAK = {
  textPrimary: "#FFFFFF",
  textSecondary: "rgba(255,255,255,0.72)",
  textMuted: "rgba(255,255,255,0.52)",
  cardBg: "rgba(255,255,255,0.13)",
  cardBorder: "rgba(255,255,255,0.18)",
  inputBg: "rgba(255,255,255,0.16)",
  accent: "#FFC65C", // premium/vurgu rengi — tüm temalarda sabit
};

// Kahraman ikonun ARKASINDAKİ yumuşak ışık halesi.
//
// Gradyan tek başına düz bir zemin bırakıyordu; hale, ikonu zeminden
// ayırıp havaya derinlik veriyor. Yalnızca ikonun arkasında duruyor,
// metinlerin altına GİRMİYOR — kontrast denetimi bozulmasın.
const HALE = {
  acik: "#FFD37A",
  "acik-gece": "#7C93E8",
  parcali: "#BFD8F2",
  "bulutlu-gece": "#7E90AB",
  kapali: "#C3CEDC",
  yagmur: "#9CC6EA",
  "yagmur-gece": "#6F92BC",
  kar: "#DCEBFA",
  "kar-gece": "#9CBCE0",
  sis: "#CBD3DB",
  firtina: "#A98BE8",
  varsayilan: "#8FB3E8",
};

export function haleRengi(mood) {
  return HALE[mood] ?? HALE.varsayilan;
}

export function getWeatherTheme(code, isDay = 1) {
  const gece = isDay === 0;

  if (STORM_CODES.has(code)) {
    return { ...ORTAK, gradient: ["#12131A", "#262A3D", "#3B3F5C"], mood: "firtina" };
  }
  if (SNOW_CODES.has(code)) {
    return gece
      ? { ...ORTAK, gradient: ["#141F33", "#2C4560", "#4A6E8F"], mood: "kar-gece" }
      : { ...ORTAK, gradient: ["#4F7895", "#3A5F80", "#22405A"], mood: "kar" };
  }
  if (RAIN_CODES.has(code)) {
    return gece
      ? { ...ORTAK, gradient: ["#0E1622", "#1F2E42", "#33475F"], mood: "yagmur-gece" }
      : { ...ORTAK, gradient: ["#243447", "#3B506B", "#5B7594"], mood: "yagmur" };
  }
  if (FOG_CODES.has(code)) {
    return { ...ORTAK, gradient: ["#5A6672", "#414B57", "#2A323C"], mood: "sis" };
  }

  // Gündüz paletleri aşağı doğru KOYULAŞIR. İlk halinde tam tersiydi
  // (üst koyu, alt açık mavi) ve ekranın alt yarısında beyaz metnin
  // kontrastı 1.8:1'e kadar düşüyordu — güneş ikonu ve saatlik/10 günlük
  // kartlar zeminde eriyip "sönük" görünüyordu. Gece paletlerine
  // dokunulmadı; onlar zaten 9:1 üstünde ve Play'e yüklenen ekran
  // görüntüleri gece temasından alındı.

  // Açık / bulutlu
  if (gece) {
    return code <= 1
      ? { ...ORTAK, gradient: ["#080D1F", "#182A5C", "#2E4680"], mood: "acik-gece" }
      : { ...ORTAK, gradient: ["#0B1220", "#1E293B", "#38465C"], mood: "bulutlu-gece" };
  }
  if (code <= 1) {
    return { ...ORTAK, gradient: ["#2976C7", "#1A5AAE", "#0C3B78"], mood: "acik" };
  }
  if (code <= 2) {
    return { ...ORTAK, gradient: ["#3876AB", "#265F92", "#143F66"], mood: "parcali" };
  }
  return { ...ORTAK, gradient: ["#54657A", "#3D4B5C", "#28323F"], mood: "kapali" };
}

// Veri gelmeden önce (yüklenirken) kullanılan nötr tema
export const VARSAYILAN_TEMA = {
  ...ORTAK,
  gradient: ["#16233B", "#27395A", "#3C5480"],
  mood: "varsayilan",
};
