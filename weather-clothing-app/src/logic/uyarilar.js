// Bildirim uyarılarının kararı ve metni.
//
// Ayrı bir saf modül olmasının sebebi: bu metinler kullanıcının uygulamayı
// açmadan gördüğü TEK şey. Yanlış ya da yapay bir cümle, uygulamanın
// tamamının güvenilirliğini götürüyor. Burada karar da metin de test
// edilebilir durumda.
//
// İki kural her yerde geçerli:
//   1. Karar HİSSEDİLEN sıcaklığa göre verilir, çıplak sıcaklığa göre değil.
//      18°, 18 km/s rüzgarda 15° gibi hissedilir ve giyim kararını
//      hissedilen belirler.
//   2. Kullanıcının kişisel kayması uygulanır. Uygulama içinde "hırka al"
//      derken bildirimde "ceket yeterli" demek iki ayrı uygulama gibi
//      görünürdü.

/** Uyarının anlamlı olması için gereken en küçük düşüş (hissedilen, °C). */
export const DUSUS_ESIGI = 5;

/**
 * Uyarının verileceği en yüksek "varış" sıcaklığı.
 *
 * ASIL DÜZELTME BURASI. Önceden yalnızca farka bakılıyordu: 32°'den 26°'ye
 * düşüş 6° fark olduğu için "hava soğuyor, üstüne bir katman ekle" uyarısı
 * gidiyordu. 26° sıcak bir hava; kimse katman eklemez. Uyarı ancak varılan
 * sıcaklık gerçekten giyim değiştirtiyorsa anlamlı.
 */
export const VARIS_TAVANI = 18;

/** Şemsiye kararını MİKTAR veriyor; ihtimal tek başına yetmiyor. */
export const YAGIS_MM_ESIGI = 0.4;
export const YAGIS_IHTIMAL_ESIGI = 55;
/** Bu miktarın üstünde "sağanak" başlığı kullanılıyor. */
export const YAGIS_SAGANAK_MM = 4;
/** Bu miktarın üstünde ihtimale bakmadan uyarıyoruz — ıslanmak kesin. */
export const YAGIS_KESIN_MM = 1.5;

const KAR_KODLARI = new Set([71, 73, 75, 77, 85, 86]);
const SAGANAK_KODLARI = new Set([80, 81, 82]);
/** Gök gürültülü fırtına: miktar ne olursa olsun ciddiye alınır. */
const FIRTINA_KODLARI = new Set([95, 96, 99]);

const saatEtiketi = (iso) => iso?.slice(11, 16) ?? "";
const yuvarla = (n) => Math.round(n);

/**
 * Varılan hissedilen sıcaklığa göre ne yapılacağını söyler.
 *
 * Eşikler `getClothingAdvice` ile AYNI: uygulama içinde "hırka" diyen
 * öneriyle bildirimin çelişmemesi için. Cümleler bilerek konuşma dilinde —
 * "üstüne bir katman ekle" gibi kalıp bir ifade robot gibi okunuyordu.
 */
export function eylemCumlesi(hissedilen) {
  if (hissedilen <= 0) return "kalın montunu, atkını ve eldivenini hazırla";
  if (hissedilen <= 8) return "montsuz çıkma";
  if (hissedilen <= 14) return "yanına bir hırka al";
  if (hissedilen <= 18) return "ince bir ceket yeterli olur";
  // SICAK KOVALAR SONRADAN EKLENDİ.
  //
  // Bu fonksiyon önce yalnızca soğuma uyarısı için yazılmıştı; orada varış
  // sıcaklığı VARIS_TAVANI (18°) ile sınırlı olduğu için 18 üstü hiç
  // görülmüyordu. Sabah gün özetinde ise sıcaklık 31°'ye kadar çıkıyor ve
  // "26°'de ince bir ceket yeterli olur" çıktısı veriyordu — kullanıcının
  // en baştan şikâyet ettiği hatanın (26°'de katman önerme) aynısı.
  if (hissedilen <= 24) return "tişört rahat eder";
  if (hissedilen <= 29) return "hafif ve nefes alan bir şey giy";
  return "en hafifini giy, yanına su al";
}

/**
 * Ani soğuma uyarısı.
 *
 * @param saatler getHourlyForecast çıktısı (hissedilen alanıyla)
 * @param kayma   kişisel sıcaklık kayması (°C)
 * @returns null | { iso, saat, hissedilen, dusus, baslik, govde }
 */
export function sogumaUyarisi(saatler, { kayma = 0 } = {}) {
  const gecerli = (saatler ?? []).filter(
    (s) => typeof (s.hissedilen ?? s.temp) === "number"
  );
  if (gecerli.length < 3) return null;

  const hs = (s) => (s.hissedilen ?? s.temp) + (Number.isFinite(kayma) ? kayma : 0);

  const bas = hs(gecerli[0]);
  // İlk saati atlıyoruz: "bir saat sonra" uyarısı için zaten çok geç.
  const dusus = gecerli.find(
    (s, i) => i > 1 && bas - hs(s) >= DUSUS_ESIGI && hs(s) <= VARIS_TAVANI
  );
  if (!dusus) return null;

  const varis = hs(dusus);
  const fark = bas - varis;

  return {
    iso: dusus.time,
    saat: saatEtiketi(dusus.time),
    hissedilen: yuvarla(varis),
    dusus: yuvarla(fark),
    baslik: varis <= 8 ? "Akşam iyice soğuyor 🧥" : "Hava serinliyor 🌡️",
    govde: `${saatEtiketi(dusus.time)} gibi ${yuvarla(varis)}° hissedilecek — ${eylemCumlesi(varis)}.`,
  };
}

/**
 * Yağış miktarını gündelik dile çevirir.
 *
 * Bildirimde "3.2 mm bekleniyor" yazıyordu. Milimetre meteorolojik olarak
 * doğru ama kullanıcıların çoğu 3.2 mm'nin çok mu az mı olduğunu bilmiyor;
 * bildirim bir bakışta anlaşılmak zorunda. Sayıyı uygulama içindeki yağış
 * şeridinde göstermeye devam ediyoruz, orada bağlamı var.
 */
export function yagisSiddeti(mm, kar = false) {
  // Kar ve yağmur AYRI: "kar başlıyor, ıslatır" yanlış okunuyor ve karda
  // kullanıcının sorduğu soru ıslanmak değil, yolun tutup tutmayacağı.
  if (kar) {
    if (mm >= 8) return "yoğun olacak";
    if (mm >= 4) return "epey tutar";
    if (mm >= 1.5) return "tutmaya başlayabilir";
    return "hafif olacak";
  }
  // Cümlenin içine yerleşecek şekilde TAM ifadeler: "başlıyor, bardaktan
  // boşanırcasına —" diye yarım bırakmak kekeliyordu.
  if (mm >= 8) return "bardaktan boşanırcasına yağacak";
  if (mm >= 4) return "iyice ıslatır";
  if (mm >= 1.5) return "ıslatır";
  return "hafif olacak";
}

/** Yağışın cinsine göre başlık, adı ve eylem. */
function yagisTuru(kod, mm) {
  if (KAR_KODLARI.has(kod)) {
    return {
      baslik: "Kar başlıyor ❄️",
      ad: "kar",
      hafifIfade: "hafif kar",
      eylem: "kaymaz ayakkabı giy",
    };
  }

  // Fırtınada miktara bakmıyoruz: gök gürültüsü tek başına planı değiştirir.
  if (FIRTINA_KODLARI.has(kod)) {
    return {
      baslik: "Fırtına geliyor ⛈️",
      ad: "fırtına",
      // "hafif fırtına" çelişik okunuyor; fırtınanın hafifi olmaz.
      hafifIfade: "gök gürültülü yağış",
      eylem: "su geçirmez bir şey giy, şemsiye rüzgarda işe yaramaz",
    };
  }

  // BAŞLIK MİKTARA DA BAKIYOR.
  //
  // Önceden yalnızca koda bakılıyordu ve WMO 80 ("hafif sağanak") için
  // "Sağanak geliyor ⛈️" başlığı atılıp gövdede "hafif olacak" yazıyordu —
  // bildirim kendi kendisiyle çelişiyordu. Gerçek veride yakalandı.
  // Fazladan alarm vermek, uyarıya duyulan güveni tıpkı eksik uyarı gibi
  // götürüyor.
  if (mm >= YAGIS_SAGANAK_MM || (SAGANAK_KODLARI.has(kod) && mm >= 1.5)) {
    return {
      baslik: "Sağanak geliyor ⛈️",
      ad: "sağanak",
      hafifIfade: "sağanak",
      eylem: "su geçirmez bir şey giy, şemsiye rüzgarda işe yaramaz",
    };
  }

  return {
    baslik: "Yağmur geliyor 🌧️",
    ad: "yağmur",
    hafifIfade: "hafif yağmur",
    eylem: "şemsiyeni al",
  };
}

/**
 * Yağış uyarısı.
 *
 * Önceden yalnızca İHTİMALE bakıyordu: "%60 yağış ihtimali, şemsiyeni al".
 * %60 ihtimalle 0.1 mm çiseleme de olabilir; kullanıcı şemsiyeyi boşuna
 * taşıyıp uyarıya güvenmeyi bırakıyor. Artık miktar birincil ölçü.
 */
export function yagmurUyarisi(saatler, dakikalik = []) {
  const gecerli = saatler ?? [];

  const hedef = gecerli.find((s, i) => {
    if (i === 0) return false;
    const mm = s.yagisMm ?? 0;
    const ihtimal = s.rainChance ?? 0;
    if (mm >= YAGIS_KESIN_MM) return true;
    return mm >= YAGIS_MM_ESIGI && ihtimal >= YAGIS_IHTIMAL_ESIGI;
  });
  if (!hedef) return null;

  const mm = hedef.yagisMm ?? 0;
  const karMi = KAR_KODLARI.has(hedef.code);
  const { baslik, hafifIfade, eylem } = yagisTuru(hedef.code, mm);

  // Başlangıç ANINI 15 dakikalık seriden keskinleştiriyoruz.
  //
  // Saatlik kova "20:00" yağışın 20:00–21:00 arasında bir yerde başlayacağı
  // demek. Kullanıcıya "20:00'de başlıyor" deyip 20:45'te yağdırmak uyarıyı
  // güvenilmez yapıyor. Seri yoksa saatlik kovaya düşüyoruz.
  const kovaBasi = hedef.time.slice(0, 13);
  const ilkCeyrek = (dakikalik ?? []).find(
    (d) => d.time?.slice(0, 13) === kovaBasi && (d.yagisMm ?? 0) > 0
  );
  const baslangicIso = ilkCeyrek?.time ?? hedef.time;
  // Az ve çok yağış için AYRI cümle kalıpları.
  //
  // Miktarı tek bir yuvaya sıkıştırmak "başlıyor, hafif — şemsiyeni al" gibi
  // kekeleyen bir cümle üretiyordu. Miktar biliniyorsa söylüyoruz: 1 mm ile
  // 8 mm arasındaki fark, şemsiye mi yağmurluk mu alacağını belirliyor.
  const govde =
    mm >= 1
      ? `${saatEtiketi(baslangicIso)} gibi başlıyor, ${yagisSiddeti(mm, karMi)} — ${eylem}.`
      : `${saatEtiketi(baslangicIso)} gibi ${hafifIfade} başlıyor — ${eylem}.`;

  return { iso: baslangicIso, saat: saatEtiketi(baslangicIso), mm, baslik, govde };
}
