// Haptik geri bildirim — korumalı sarmalayıcı.
//
// expo-haptics native kod içerir. Doğrudan import edersek Expo Go'da veya
// modülü içermeyen bir build'de TÜM UYGULAMA açılmaz (aynı tuzağa AdBanner
// ve PremiumContext'te de düşmüştük). Korumalı require + her çağrının
// sessizce yutulması, dokunsal geri bildirimin hiçbir koşulda uygulamayı
// düşürememesini garantiliyor.
//
// Haptik bir SÜS: yoksa uygulama aynı şekilde çalışmalı.

let H = null;
try {
  H = require("expo-haptics");
} catch (e) {
  H = null;
}

import { Platform } from "react-native";

// iOS'ta haptik motoru zengin, Android'de üreticiye göre değişiyor ve bazı
// cihazlarda "seçim" titreşimi hiç hissedilmiyor. Android'de yalnızca
// anlamlı olaylarda (başarı/hata/uzun basma) titretiyoruz; her dokunuşta
// titretmek Android'de rahatsız edici oluyor.
const zenginPlatform = Platform.OS === "ios";

function guvenli(fn) {
  try {
    fn?.();
  } catch (e) {
    /* haptik yoksa sessizce geç */
  }
}

/** Hafif dokunuş — buton ve kart seçimleri. */
export function dokunus() {
  if (!H) return;
  if (!zenginPlatform) return; // Android'de her dokunuşta titretmiyoruz
  guvenli(() => H.impactAsync(H.ImpactFeedbackStyle.Light));
}

/** Orta şiddet — bir şey açılıyor/kapanıyor (modal, sayfa). */
export function gecis() {
  if (!H) return;
  guvenli(() => H.impactAsync(H.ImpactFeedbackStyle.Medium));
}

/** Başarı — kaydedildi, eklendi, kombin geldi. */
export function basari() {
  if (!H) return;
  guvenli(() => H.notificationAsync(H.NotificationFeedbackType.Success));
}

/** Hata — istek başarısız, izin reddedildi, kredi bitti. */
export function hata() {
  if (!H) return;
  guvenli(() => H.notificationAsync(H.NotificationFeedbackType.Error));
}

/** Uyarı — geri alınabilir ama dikkat isteyen işlem (silme onayı). */
export function uyari() {
  if (!H) return;
  guvenli(() => H.notificationAsync(H.NotificationFeedbackType.Warning));
}

/** Sert vuruş — silme gibi yıkıcı işlemin tamamlanması. */
export function agir() {
  if (!H) return;
  guvenli(() => H.impactAsync(H.ImpactFeedbackStyle.Heavy));
}

export const haptikVarMi = () => H !== null;
