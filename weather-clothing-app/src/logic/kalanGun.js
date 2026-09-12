// Günün KALAN saatlerinin sıcaklık aralığı.
//
// NEDEN GEREKLİ: kart "Y:24° D:19°" derken bu takvim gününün tamamına ait
// en yüksek ve en düşük değer. Saat 15:00'te ikisi de çoktan geçmiş
// olabiliyor. Sinop'ta ölçtüm: kart 19–24.1° gösterirken günün kalanı
// yalnızca 19.9–22.7°ydi. Kullanıcı 24°'yi bekliyor (gelmeyecek) ve
// 19°'lik bir akşam serinliğine göre yanına bir şey alıyor (o da gelmeyecek).
//
// Günlük Y/D değerlerini KALDIRMIYORUZ: bütün hava uygulamaları takvim günü
// için verir ve kullanıcı başka uygulamayla karşılaştırdığında tutmazsa
// bizimkini bozuk sanar. Bunun yerine gerçekten farklıysa kalanı ek olarak
// söylüyoruz.

/**
 * Ek satırı göstermeye değer kılan en küçük fark (°C).
 *
 * 2°: altındaki farklar giyim kararını değiştirmiyor ve her saat ikinci bir
 * aralık göstermek kartı kalabalıklaştırır.
 */
export const FARK_ESIGI = 2;

/**
 * @param saatler getHourlyForecast çıktısı (şu andan itibaren)
 * @param gunluk  { max, min } — o günün takvim değerleri
 * @returns null | { max, min, saatSayisi }
 *   null: gösterecek anlamlı bir fark yok (ya da veri yetersiz).
 */
export function kalanGun(saatler, gunluk) {
  if (!Array.isArray(saatler) || saatler.length === 0) return null;

  const bugun = saatler[0].time?.slice(0, 10);
  if (!bugun) return null;

  const dilim = saatler.filter(
    (s) => s.time?.slice(0, 10) === bugun && typeof s.temp === "number"
  );

  // Gün bitmek üzereyse (2 saatten az kaldıysa) ek aralık göstermiyoruz:
  // "kalan gün 21–21°" bilgi değil gürültü.
  if (dilim.length < 3) return null;

  const sicakliklar = dilim.map((s) => s.temp);
  const max = Math.round(Math.max(...sicakliklar));
  const min = Math.round(Math.min(...sicakliklar));

  // Günlük değerler verilmediyse karşılaştıramayız; sessizce çıkıyoruz.
  if (typeof gunluk?.max !== "number" || typeof gunluk?.min !== "number") return null;

  const gMax = Math.round(gunluk.max);
  const gMin = Math.round(gunluk.min);

  // Yalnızca kalan gün BELİRGİN ŞEKİLDE daha darsa söylüyoruz. Aralık
  // aynıysa ikinci bir satır tekrar olur.
  const daralma = gMax - max >= FARK_ESIGI || min - gMin >= FARK_ESIGI;
  if (!daralma) return null;

  return { max, min, saatSayisi: dilim.length };
}

/**
 * Kart üzerinde gösterilecek metin.
 *
 * "Bundan sonra" bilerek seçildi: "kalan gün" takvimsel, "bundan sonra"
 * kullanıcının sorduğu soruya ("şimdi çıkarsam ne olacak") daha yakın.
 */
export function kalanGunMetni(kalan) {
  if (!kalan) return null;
  return kalan.max === kalan.min
    ? `Bundan sonra ${kalan.max}° civarı`
    : `Bundan sonra ${kalan.min}–${kalan.max}°`;
}
