// Geri bildirim e-postasının hazırlanması.
//
// Ayrı ve saf bir modül: metin üretimi test edilebilir olsun, ekran yalnızca
// açma işini yapsın.
//
// NEDEN VAR: kullanıcı "uygulama bozuk" yazıp gönderdiğinde elde hiçbir şey
// olmuyor — hangi sürüm, hangi Android, hangi şehir? Tanı bilgisini gövdeye
// biz koyuyoruz ki kullanıcı yazmak zorunda kalmasın.

import { GERI_BILDIRIM_EPOSTA, UYGULAMA_SURUMU, UYGULAMA_SURUM_KODU } from "../config.js";

export const KONU = "Hava & Kıyafet — geri bildirim";

/**
 * E-posta gövdesi.
 *
 * Kullanıcının yazacağı yer EN ÜSTTE: altta olsaydı, tanı bloğunu silmek ya
 * da aşağı kaydırmak zorunda kalırdı ve çoğu kişi vazgeçerdi.
 */
export function govdeMetni({ android, apiSeviyesi, sehir } = {}) {
  const satirlar = [
    "Buraya yazabilirsin:",
    "",
    "",
    "",
    "— — — — —",
    "Aşağıdaki bilgiler sorunu bulmama yardım ediyor, silmesen sevinirim.",
    `Sürüm: ${UYGULAMA_SURUMU} (${UYGULAMA_SURUM_KODU})`,
  ];
  if (android) satirlar.push(`Android: ${android}${apiSeviyesi ? ` (API ${apiSeviyesi})` : ""}`);
  if (sehir) satirlar.push(`Şehir: ${sehir}`);
  return satirlar.join("\n");
}

/** mailto bağlantısı. Konu ve gövde URL kodlaması gerektiriyor. */
export function mailtoBaglantisi(bilgi) {
  const konu = encodeURIComponent(KONU);
  const govde = encodeURIComponent(govdeMetni(bilgi));
  return `mailto:${GERI_BILDIRIM_EPOSTA}?subject=${konu}&body=${govde}`;
}
