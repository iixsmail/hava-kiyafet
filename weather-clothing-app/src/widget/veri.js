// Önbellekteki hava verisini widget'ın çizeceği alanlara çevirir.
//
// Saf tutulmasının sebebi: widget cihazda test etmesi zor bir yüzey. Ana ekran
// widget'ı ayrı bir JS bağlamında, arka planda çalışıyor; hatası logcat'te bile
// zor görünüyor. Dönüşümü burada test edip, çizim tarafını olabildiğince aptal
// bırakıyoruz.

import { describeWeatherCode } from "../api/weather.js";
import { getClothingAdvice } from "../logic/clothingAdvice.js";
import { kaymaDegeri } from "../logic/kalibrasyon.js";

/**
 * Widget'ın tek satırlık kıyafet önerisi.
 *
 * En fazla iki madde: üçüncüsü dar widget'ta kırpılıyor ve yarım kelime
 * göstermek hiç göstermemekten kötü.
 */
function kisaOneri(oneri) {
  const basliklar = (oneri?.tips ?? [])
    .map((t) => t?.title)
    .filter((t) => typeof t === "string" && t.length > 0);
  if (basliklar.length === 0) return oneri?.headline ?? "";
  return basliklar.slice(0, 2).join(" · ");
}

/**
 * @param onbellek WeatherContext'in yazdığı { data, ad, ts }
 * @param kalibrasyon kalibrasyon durumu (kişisel sıcaklık kayması)
 * @returns null | { derece, durum, ikon, konum, oneri, eskimis }
 */
export function widgetVerisi(onbellek, kalibrasyon = null) {
  const current = onbellek?.data?.current;
  if (!current || typeof current.temperature_2m !== "number") return null;

  const { text, icon } = describeWeatherCode(current.weather_code, current.is_day);

  const oneri = getClothingAdvice(current, {
    isPremium: false,
    // Widget da kişisel kaymayı uyguluyor. Uygulama içinde "hırka" derken
    // ana ekranda "tişört" yazması iki ayrı uygulama gibi görünürdü.
    kayma: kaymaDegeri(kalibrasyon),
  });

  return {
    derece: Math.round(current.temperature_2m),
    durum: text,
    ikon: icon,
    konum: onbellek.ad || "Konumun",
    // ÖNERİ BAŞLIĞINI DEĞİL, KIYAFET MADDELERİNİ gösteriyoruz.
    //
    // `headline` hava durumunu anlatıyor ("Güneşli ve açık bir gün seni
    // bekliyor") — widget'ta zaten derece ve durum yazıyor, tekrar oluyor ve
    // "ne giyeyim" sorusunu hiç cevaplamıyor. Üstelik sıcaklıktan bağımsız
    // olduğu için kişisel kaymayı da yansıtmıyordu.
    //
    // Maddelerin başlıkları ("Hırka", "Şemsiye", "Hafif kıyafet") kısa,
    // eyleme dönük ve widget'ın dar alanına sığıyor.
    oneri: kisaOneri(oneri),
    // Veri bayatsa arayüz bunu belirtebilsin.
    eskimis: eskiMi(onbellek.ts),
  };
}

/**
 * Veriyi "bayat" sayma eşiği.
 *
 * 3 saat bilinçli: hava bu sürede belirgin değişiyor ve widget sessizce eski
 * dereceyi göstermeye devam ederse kullanıcı yanlış giyinip uygulamayı suçlar.
 */
export const BAYATLAMA_MS = 3 * 60 * 60 * 1000;

export function eskiMi(ts, simdi = Date.now()) {
  if (typeof ts !== "number" || !Number.isFinite(ts)) return true;
  return simdi - ts > BAYATLAMA_MS;
}
