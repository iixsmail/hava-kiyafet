// Kalibrasyon durumunun saklanması ve paylaşılması.
//
// Bilerek Context KULLANMIYORUZ. App.js'te zaten beş sağlayıcı var ve bu
// veriye React dışından da erişilmesi gerekiyor: sabah bildirimini üreten
// `notifications/index.js` bir bileşen değil, hook çağıramaz. Modül düzeyinde
// bir depo + `useSyncExternalStore` ikisini birden çözüyor.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { BOS_DURUM, geriBildirimUygula, bugununGunu } from "../logic/kalibrasyon";

const ANAHTAR = "sicaklikKalibrasyonu.v1";

let durum = BOS_DURUM;
let yuklendi = false;
let yukleniyor = null;
const dinleyiciler = new Set();

function yayinla() {
  for (const f of dinleyiciler) f();
}

/**
 * Diskten okur. Açılışta çağrılıyor, ayrıca her yazmadan önce bekleniyor.
 *
 * Devam eden okumayı paylaşıyoruz: eşzamanlı iki çağrı iki ayrı okuma
 * başlatıp birbirinin sonucunun üstüne yazabilirdi.
 */
export function yukle() {
  if (yuklendi) return Promise.resolve(durum);
  if (!yukleniyor) yukleniyor = gercektenYukle();
  return yukleniyor;
}

async function gercektenYukle() {
  try {
    const ham = await AsyncStorage.getItem(ANAHTAR);
    if (ham) {
      const c = JSON.parse(ham);
      // Alanları tek tek doğruluyoruz: bozuk/eski bir kayıt yüzünden
      // kaymanın NaN olması, öneriyi sessizce çöpe çevirirdi.
      if (typeof c?.ham === "number" && Number.isFinite(c.ham)) {
        durum = {
          ham: c.ham,
          sayac: Number.isFinite(c.sayac) ? c.sayac : 0,
          sonGun: typeof c.sonGun === "string" ? c.sonGun : null,
          sonYon: Number.isFinite(c.sonYon) ? c.sonYon : 0,
        };
      }
    }
  } catch (e) {
    console.log("Kalibrasyon okunamadı:", e?.message);
  }
  yuklendi = true;
  yayinla();
  return durum;
}

/**
 * Geri bildirimi işler ve kalıcılaştırır.
 *
 * Belleği ÖNCE güncelliyoruz: arayüz dokunuşa anında cevap versin. Diske
 * yazma başarısız olsa bile oturum içinde öğrenilmiş kayma korunuyor.
 */
export async function geriBildir(etiket) {
  // Diskteki değerin okunmasını BEKLİYORUZ. Soğuk açılışta hemen dokunan bir
  // kullanıcı, henüz okunmamış boş durumun üzerine yazıp o güne kadar
  // öğrenilmiş kaymayı silebilirdi.
  await yukle();

  const yeni = geriBildirimUygula(durum, etiket, bugununGunu());
  if (yeni === durum) return durum;
  durum = yeni;
  yayinla();
  try {
    await AsyncStorage.setItem(ANAHTAR, JSON.stringify(durum));
  } catch (e) {
    console.log("Kalibrasyon yazılamadı:", e?.message);
  }
  return durum;
}

/** Ayarlardan "sıfırla" için. */
export async function sifirla() {
  // Aynı gerekçe: devam eden okuma bitmeden sıfırlarsak, okuma bittiğinde
  // sildiğimiz değer belleğe geri gelirdi.
  await yukle();
  durum = BOS_DURUM;
  yayinla();
  try {
    await AsyncStorage.removeItem(ANAHTAR);
  } catch (e) {
    console.log("Kalibrasyon silinemedi:", e?.message);
  }
}

/** React dışından okumak için (bildirim metni üretimi). */
export function oku() {
  return durum;
}

// --- useSyncExternalStore köprüsü -----------------------------------------

export function abone(f) {
  dinleyiciler.add(f);
  return () => dinleyiciler.delete(f);
}

export function anlik() {
  return durum;
}
