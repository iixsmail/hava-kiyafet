// Kişisel sıcaklık kalibrasyonu.
//
// Aynı 14°C'de biri üşür, biri terler. Uygulama herkese aynı eşiği
// uyguladığı sürece önerisi "ortalama bir insan" için doğru, kullanıcı için
// tesadüfen doğru olur. Burada kullanıcının geri bildiriminden bir kayma
// öğreniyoruz ve kıyafet eşiklerini ona göre ötelüyoruz.
//
// TEK KURAL: kayma yalnızca ÖNERİYİ etkiler, GÖSTERİLEN sıcaklığı asla.
// Ekranda 23° yazıyorsa hava gerçekten 23°'dir; kişiselleştirdiğimiz şey
// "23°'de ne giyilir" sorusunun cevabı. Gösterilen dereceyi kaydırmak
// kullanıcıya hava durumu hakkında yalan söylemek olurdu.
//
// Saf modül: React ve depolama bağımlılığı yok, doğrudan test edilebiliyor.

/** Bir geri bildirimin kaymayı kaç derece oynattığı. */
export const ADIM = 0.8;

/**
 * Kaymanın üst sınırı (±°C).
 *
 * 5° bilinçli: bunun ötesi artık "üşüyen biri" değil, yanlış öğrenilmiş bir
 * model demek. Sınırsız bırakmak, üst üste birkaç kötü günü kalıcı bir
 * sapmaya çevirirdi.
 */
export const SINIR = 5;

/** Geri bildirim etiketinden yön. Negatif = daha kalın giydir. */
export const YONLER = { usudum: -1, tamOldu: 0, terledim: 1 };

/** Kişiselleştirmenin "oturmuş" sayılması için gereken geri bildirim sayısı. */
export const OLGUNLUK = 3;

/** Henüz hiç geri bildirim verilmemiş durum. */
export const BOS_DURUM = { ham: 0, sayac: 0, sonGun: null, sonYon: 0 };

const sinirla = (v) => Math.max(-SINIR, Math.min(SINIR, v));

/**
 * Kullanılabilir kayma değeri.
 *
 * İçeride SINIRSIZ birikimi (`ham`) tutuyoruz, dışarıya sınırlandırılmışını
 * veriyoruz. Sınırlanmış değeri saklasaydık, sınıra dayanmış bir kullanıcının
 * aynı gün içindeki düzeltmesini geri alamazdık.
 */
export function kaymaDegeri(durum) {
  return sinirla(durum?.ham ?? 0);
}

/** Öneri motoruna verilecek sıcaklık. Gösterime DEĞİL, karara girer. */
export function etkiliSicaklik(hissedilen, durum) {
  if (typeof hissedilen !== "number" || !Number.isFinite(hissedilen)) return hissedilen;
  return hissedilen + kaymaDegeri(durum);
}

/**
 * Geri bildirimi işleyip yeni durumu döndürür.
 *
 * Günde EN FAZLA bir net oynama var. Aynı gün ikinci kez dokunulursa o günün
 * etkisi geri alınıp yenisi uygulanıyor — yani "düzeltme", "üst üste ekleme"
 * değil. Böylece hem arka arkaya dokunup kaymayı uca savurmak mümkün olmuyor
 * hem de yanlış dokunan kullanıcı kendini düzeltebiliyor.
 *
 * @param durum önceki durum
 * @param etiket "usudum" | "tamOldu" | "terledim"
 * @param gun "YYYY-MM-DD" — yerel takvim günü
 */
export function geriBildirimUygula(durum, etiket, gun) {
  const onceki = durum ?? BOS_DURUM;
  const yon = YONLER[etiket];
  // Tanımadığımız bir etiketle durumu bozmaktansa hiç dokunmuyoruz.
  if (yon === undefined || !gun) return onceki;

  const ayniGun = onceki.sonGun === gun;
  const taban = ayniGun ? onceki.ham - onceki.sonYon * ADIM : onceki.ham;

  return {
    ham: taban + yon * ADIM,
    // Aynı gün içindeki düzeltme yeni bir kanıt değil, aynı kanıtın revizesi.
    sayac: ayniGun ? onceki.sayac : onceki.sayac + 1,
    sonGun: gun,
    sonYon: yon,
  };
}

/** Arayüzün "ne kadar öğrendik" diye sorabilmesi için özet. */
export function ozet(durum) {
  const d = durum ?? BOS_DURUM;
  const kayma = kaymaDegeri(d);
  return {
    kayma,
    sayac: d.sayac,
    olgun: d.sayac >= OLGUNLUK,
    // Yuvarlanmış kayma 0 ise kullanıcıya "üşüyorsun" demenin anlamı yok.
    yon: Math.round(kayma) === 0 ? "notr" : kayma < 0 ? "usuyan" : "terleyen",
  };
}

/**
 * Kullanıcıya gösterilecek tek satırlık açıklama.
 *
 * Sayı yerine cümle: "-2.4°" kimseye bir şey anlatmaz, "senin için 2° daha
 * serin sayıyoruz" anlatır.
 */
export function aciklama(durum) {
  const { kayma, olgun, yon } = ozet(durum);
  if (!olgun || yon === "notr") {
    return "Birkaç geri bildirim daha, öneriyi sana göre ayarlayalım.";
  }
  const derece = Math.abs(Math.round(kayma));
  return yon === "usuyan"
    ? `Senin için havayı ${derece}° daha serin sayıyoruz.`
    : `Senin için havayı ${derece}° daha ılık sayıyoruz.`;
}

/** Yerel takvim günü — kaymanın günlük sınırı buna göre işliyor. */
export function bugununGunu(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
