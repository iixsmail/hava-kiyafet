// Tanıtımın görülüp görülmediği.
//
// Neden ayrı bir modül: bu bilgiye App.js'in DIŞINDAN da erişmek gerekiyor.
// WeatherContext, tanıtım bitmeden konum izni İSTEMEMEK için buna bakıyor —
// temiz kurulumda kullanıcı, uygulama daha kendini tanıtmadan bir sistem
// izin penceresiyle karşılaşıyordu. Ne istendiğini bilmeden verilen karar
// çoğunlukla "reddet" oluyor ve kullanıcı sonsuza kadar şehri elle aramak
// zorunda kalıyor.
//
// App.js sağlayıcıları render ettiği için useWeather() çağıramıyor; bu
// yüzden React context yerine kalibrasyondakiyle aynı küçük abonelik
// desenini kullanıyoruz.

import AsyncStorage from "@react-native-async-storage/async-storage";

export const ANAHTAR = "tanitimGorunduMu.v1";

let gorundu = null; // null = henüz diskten okunmadı
const dinleyiciler = new Set();

function duyur() {
  for (const f of dinleyiciler) {
    try {
      f();
    } catch (e) {
      console.log("Tanıtım dinleyicisi hata verdi:", e?.message);
    }
  }
}

export async function yukle() {
  try {
    const v = await AsyncStorage.getItem(ANAHTAR);
    gorundu = v === "1";
  } catch (e) {
    // Okuma başarısız olursa tanıtımı GÖSTERMİYORUZ: her açılışta tanıtım
    // göstermek, hiç göstermemekten çok daha rahatsız edici.
    gorundu = true;
  }
  duyur();
  return gorundu;
}

export async function bitir() {
  gorundu = true;
  duyur();
  try {
    await AsyncStorage.setItem(ANAHTAR, "1");
  } catch (e) {
    console.log("Tanıtım durumu yazılamadı:", e?.message);
  }
}

/** null = bilinmiyor, true = tanıtım tamamlandı, false = gösterilecek. */
export function oku() {
  return gorundu;
}

export function abone(f) {
  dinleyiciler.add(f);
  return () => dinleyiciler.delete(f);
}
