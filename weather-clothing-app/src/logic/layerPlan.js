// Saatlik katman değişim çizelgesi ve seyahat bavul listesi.
//
// İkisi de saf fonksiyon: hava verisi + gardırop girer, öneri çıkar. Ağ
// bağlantısı, sunucu veya yapay zeka gerektirmiyor.

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);

// Katman ekleme/çıkarma önerisini tetikleyen en küçük fark.
//
// 5°C bilinçli bir eşik: altındaki farklar giyim kararını değiştirmiyor ve
// her gün "katman çıkar" demek uyarıyı anlamsızlaştırır. Bu tür bir özellik
// ancak seyrek ve isabetli olduğunda değerli.
const ESIK = 5;

const saatEtiketi = (iso) => iso?.slice(11, 16) ?? "";

/**
 * Karar sıcaklığı: HİSSEDİLEN.
 *
 * Katman planı "ceketi çıkar / yanına al" diyor — bu bir giyim kararı ve
 * giyimi hissedilen belirliyor. 23°, 18 km/s rüzgarda 20° gibi hissedilir.
 * Saatlik seri hissedileni taşımıyorsa (eski önbellek) çıplak sıcaklığa
 * düşüyoruz.
 *
 * GÖSTERİLEN dereceler ölçüm olarak kalıyor: kullanıcı karta baktığında
 * tahminde gördüğü sayıyı görmeli.
 */
const hs = (s) => (typeof s?.hissedilen === "number" ? s.hissedilen : s?.temp);

/**
 * Gün içindeki sıcaklık seyrinden katman değişim çizelgesi çıkarır.
 *
 * @param saatler getHourlyForecast çıktısı
 * @returns {{fark, enDusuk, enYuksek, adimlar, kapsam}|null}
 *          Fark eşiğin altındaysa null — gösterecek bir şey yok demek.
 */
export function katmanPlani(saatler) {
  const gecerli = (saatler ?? []).filter(
    (s) => typeof s.temp === "number" && Number.isFinite(s.temp)
  );
  // En az birkaç saat veri olmadan "gün içi seyir" demek anlamsız.
  if (gecerli.length < 4) return null;

  // Pencereyi GÜNÜN KALANIYLA sınırlıyoruz.
  //
  // Sabit saat sayısı almak (eskiden 18) gece yarısını aşıyordu ve sabah
  // açan kullanıcıda ertesi gecenin 02:00'si "en düşük" seçilip plan
  // "yanına bir katman al" diyordu — oysa o gün asıl olay öğleden sonra
  // 32°'ye ısınmasıydı. Kart "GÜN İÇİ DEĞİŞİM" vaat ediyor; penceresi de
  // gün olmalı.
  //
  // Akşam açan kullanıcı için planlanacak bir "gün içi" kalmıyor. Kartı
  // tamamen kaldırmak yerine öne bakan 12 saate düşüyoruz: o saatte doğru
  // tavsiye zaten "gece soğuyor, katmanı yanına al".
  const ilkGun = gecerli[0].time.slice(0, 10);
  const bugunKalan = gecerli.filter((s) => s.time.slice(0, 10) === ilkGun);
  const gunIci = bugunKalan.length >= 4;
  const pencere = gunIci ? bugunKalan : gecerli.slice(0, 12);

  let enDusuk = pencere[0];
  let enYuksek = pencere[0];
  for (const s of pencere) {
    if (hs(s) < hs(enDusuk)) enDusuk = s;
    if (hs(s) > hs(enYuksek)) enYuksek = s;
  }

  const fark = hs(enYuksek) - hs(enDusuk);
  if (fark < ESIK) return null;

  const adimlar = [];
  const bas = pencere[0];

  adimlar.push({
    iso: bas.time,
    saat: saatEtiketi(bas.time),
    derece: Math.round(bas.temp),
    eylem: "baslangic",
    metin: `Şu an ${Math.round(bas.temp)}° — buna göre çık.`,
  });

  // Zirveyi ŞU ANDAN SONRA arıyoruz.
  //
  // Eskiden karar `indexOf(enDusuk) < indexOf(enYuksek)` ile veriliyordu.
  // Tipik bir yaz gününde (09:00'da 23°, 16:00'da 32°, 23:00'te 22°) günün
  // en düşüğü AKŞAM olduğu için bu koşul false çıkıyor ve plan ısınmayı hiç
  // görmeden "yanına katman al" diyordu. Oysa kullanıcının o sabah ihtiyacı
  // olan bilgi tam tersi: "öğleden sonra 32°, üstünü çıkarabilirsin."
  const sonrasi = pencere.slice(1);
  let zirve = bas;
  for (const s of sonrasi) if (hs(s) > hs(zirve)) zirve = s;

  if (zirve !== bas && hs(zirve) - hs(bas) >= ESIK) {
    adimlar.push({
      iso: zirve.time,
      saat: saatEtiketi(zirve.time),
      derece: Math.round(zirve.temp),
      eylem: "cikar",
      metin: `${saatEtiketi(zirve.time)} civarı ${Math.round(zirve.temp)}°'ye çıkıyor — üst katmanı çıkarabilirsin.`,
    });
    // Sonra tekrar düşüyorsa geri giymeyi hatırlat: sabah montu çıkarıp
    // akşam üşümek bu özelliğin çözmesi gereken asıl senaryo.
    const zirveSonrasi = pencere.slice(pencere.indexOf(zirve) + 1);
    const dusus = zirveSonrasi.find((s) => hs(zirve) - hs(s) >= ESIK);
    if (dusus) {
      adimlar.push({
        iso: dusus.time,
        saat: saatEtiketi(dusus.time),
        derece: Math.round(dusus.temp),
        eylem: "ekle",
        metin: `${saatEtiketi(dusus.time)} sonrası ${Math.round(dusus.temp)}°'ye düşüyor — katmanı yanında taşı.`,
      });
    }
  } else {
    // Isınma yoksa tek yön var: soğuma. İlk anlamlı düşüşü bildiriyoruz.
    const dusus = sonrasi.find((s) => hs(bas) - hs(s) >= ESIK);
    if (dusus) {
      adimlar.push({
        iso: dusus.time,
        saat: saatEtiketi(dusus.time),
        derece: Math.round(dusus.temp),
        eylem: "ekle",
        metin: `${saatEtiketi(dusus.time)} civarı ${Math.round(dusus.temp)}°'ye düşüyor — yanına bir katman al.`,
      });
    }
  }

  // Salınım eşiği aşıyor ama başlangıca göre ne ısınma ne soğuma anlamlı
  // değilse (kullanıcı zaten günün ortasında açmış) ortada planlanacak bir
  // şey yok. Tek satırlık "şu an X°" kartı, başlığında "katman planla"
  // yazarken hiçbir eylem önermemek olurdu.
  if (adimlar.length === 1) return null;

  // Yağış başlangıcı da bir "katman" kararı.
  const yagisBaslangic = pencere.find(
    (s) => RAIN_CODES.has(s.code) || SNOW_CODES.has(s.code) || (s.rainChance ?? 0) >= 60
  );
  if (yagisBaslangic && yagisBaslangic !== pencere[0]) {
    adimlar.push({
      iso: yagisBaslangic.time,
      saat: saatEtiketi(yagisBaslangic.time),
      derece: Math.round(yagisBaslangic.temp),
      eylem: "yagis",
      metin: `${saatEtiketi(yagisBaslangic.time)} civarı yağış bekleniyor — şemsiye veya su geçirmez katman.`,
    });
  }

  // Saat ETİKETİNE göre değil, tam tarihe göre sıralıyoruz. Etikete göre
  // sıralamak gece yarısını aşan pencerede "02:00"ı "21:00"ın önüne
  // atıyor ve zaman çizelgesini ters çeviriyordu.
  adimlar.sort((a, b) => a.iso.localeCompare(b.iso));

  return {
    fark: Math.round(fark),
    enDusuk: { saat: saatEtiketi(enDusuk.time), derece: Math.round(enDusuk.temp) },
    enYuksek: { saat: saatEtiketi(enYuksek.time), derece: Math.round(enYuksek.temp) },
    // Kartın başlığı buna göre değişiyor: "gün içi" ile "gece" aynı şey değil.
    kapsam: gunIci ? "gunIci" : "gece",
    adimlar,
  };
}

// --- Bavul asistanı --------------------------------------------------------

const KATMAN_ADI = {
  ust: "üst",
  alt: "alt",
  dis: "dış giyim",
  ayakkabi: "ayakkabı",
  aksesuar: "aksesuar",
};

/**
 * Seçilen gün aralığının tahminine göre bavul listesi üretir.
 *
 * Mantık: aralıktaki EN DÜŞÜK ve EN YÜKSEK sıcaklığa göre gereken katman
 * çeşitlerini belirliyor, sonra gardıroptan o aralığı karşılayan parçaları
 * eşleştiriyor. Gün sayısına göre adet öneriyor.
 *
 * @param gunler getDailyForecast çıktısının bir dilimi
 * @param parcalar gardırop
 */
export function bavulListesi(gunler, parcalar = []) {
  const gecerli = (gunler ?? []).filter(
    (g) => typeof g.min === "number" && typeof g.max === "number"
  );
  if (gecerli.length === 0) return null;

  const enDusuk = Math.min(...gecerli.map((g) => g.min));
  const enYuksek = Math.max(...gecerli.map((g) => g.max));
  const gunSayisi = gecerli.length;
  const yagisliGun = gecerli.filter((g) => (g.rainChance ?? 0) >= 40).length;

  // Adet önerisi: üst her gün, alt iki güne bir, dış giyim tek.
  // Bavulu şişirmemek için kasıtlı olarak muhafazakâr.
  const adetler = {
    ust: Math.min(gunSayisi, 7),
    alt: Math.min(Math.ceil(gunSayisi / 2), 4),
    ayakkabi: gunSayisi > 3 ? 2 : 1,
    dis: enDusuk <= 16 || yagisliGun > 0 ? 1 : 0,
    aksesuar: enDusuk <= 8 ? 1 : 0,
  };

  const etiketli = parcalar.filter((p) => p.etiketlendi && p.katman);

  const kalemler = [];
  for (const [katman, adet] of Object.entries(adetler)) {
    if (adet <= 0) continue;

    // Aralığı karşılayan parçalar: bir parça, seyahatteki sıcaklık
    // aralığının bir kısmıyla kesişiyorsa aday.
    const uygun = etiketli
      .filter((p) => p.katman === katman)
      .filter((p) => {
        if (typeof p.minC !== "number" || typeof p.maxC !== "number") return true;
        return p.maxC >= enDusuk && p.minC <= enYuksek;
      })
      .slice(0, adet);

    kalemler.push({
      katman,
      katmanAdi: KATMAN_ADI[katman] ?? katman,
      adet,
      eslesenler: uygun,
      eksik: Math.max(0, adet - uygun.length),
    });
  }

  // Hava koşuluna bağlı ekstralar — gardıroptan bağımsız hatırlatmalar.
  const ekstralar = [];
  if (yagisliGun > 0) {
    ekstralar.push(`${yagisliGun} gün yağış bekleniyor — şemsiye veya yağmurluk`);
  }
  if (enYuksek >= 26) ekstralar.push("Güneş kremi ve gözlük");
  if (enDusuk <= 5) ekstralar.push("Atkı, bere, eldiven");
  if (enYuksek - enDusuk >= 12) {
    ekstralar.push(`Gün içi fark ${Math.round(enYuksek - enDusuk)}° — katmanlı giyin`);
  }

  return {
    gunSayisi,
    enDusuk: Math.round(enDusuk),
    enYuksek: Math.round(enYuksek),
    yagisliGun,
    kalemler,
    ekstralar,
    // Gardıropta hiç eşleşme yoksa kullanıcıya bunu söylemek gerekiyor;
    // boş bir liste "özellik bozuk" hissi verir.
    gardiropBos: etiketli.length === 0,
  };
}
