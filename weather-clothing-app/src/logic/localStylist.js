// Cihazda çalışan kombin motoru.
//
// Neden var: kombin seçimi aslında deterministik bir eşleştirme işi —
// "hissedilen sıcaklığı kapsayan parçalardan her katmandan birini seç".
// Bunu sunucuya sormak zorunda değiliz.
//
// Sonuçları:
//   - Gardırop özelliği İNTERNETSİZ çalışıyor
//   - Yapay zeka servisi kapalıyken, kotası dolduğunda veya çöktüğünde
//     kullanıcı yine öneri alıyor (bozuk ekran yerine çalışan ekran)
//   - Fotoğraflar cihazdan hiç çıkmıyor
//
// Yapay zeka bunu değiştirmiyor, ÜSTÜNE koyuyor: renk uyumu, kumaş-hava
// ilişkisi ve doğal dilde gerekçe gibi kural yazmanın zor olduğu kısımları
// o ekliyor.

const KATMAN_SIRA = ["dis", "ust", "alt", "ayakkabi", "aksesuar"];

/**
 * Etkinlik modları.
 *
 * Her mod, gardıroptaki `resmiyet` alanına göre parça tercih ediyor. Ücretsiz
 * planda yalnızca "gunluk" açık; diğerleri Premium.
 *
 * `tercih` sırası önemli: ilk sıradaki resmiyet tam puan alıyor, sonrakiler
 * azalan puan. Böylece "İş" modunda resmi bir gömlek varsa o seçiliyor, yoksa
 * yarı resmi olan devreye giriyor — kullanıcı boş ekranla kalmıyor.
 */
export const ETKINLIKLER = {
  gunluk: { ad: "Günlük", ikon: "🙂", tercih: ["gunluk", "spor", "yari-resmi", "resmi"], premium: false },
  is: { ad: "İş / Resmi", ikon: "💼", tercih: ["resmi", "yari-resmi", "gunluk", "spor"], premium: true },
  spor: { ad: "Spor", ikon: "🏃", tercih: ["spor", "gunluk", "yari-resmi", "resmi"], premium: true },
  aksam: { ad: "Akşam yemeği", ikon: "🍽️", tercih: ["yari-resmi", "resmi", "gunluk", "spor"], premium: true },
};

/** Etkinliğe uygunluk puanı — 0.30 ile 0 arası, sıcaklığı ezmeyecek ağırlıkta. */
function etkinlikPuani(parca, etkinlik) {
  const mod = ETKINLIKLER[etkinlik];
  if (!mod) return 0;
  const i = mod.tercih.indexOf(parca.resmiyet);
  if (i < 0) return 0;
  // 0. sıra 0.30, sonrakiler 0.10 azalarak
  return Math.max(0, 0.3 - i * 0.1);
}

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const STORM_CODES = new Set([95, 96, 99]);

/**
 * Bir parçanın o sıcaklığa ne kadar uygun olduğunu puanlar.
 *
 * Aralığın İÇİNDE olmak yetmiyor; ortasına yakın olmak daha iyi. 5–28
 * aralığındaki kot pantolon 26°C'de de giyilebilir ama 16°C'de daha
 * "doğru" seçim. Bu olmadan motor hep listedeki ilk uygun parçayı seçip
 * her gün aynı kombini öneriyordu.
 */
function sicaklikPuani(parca, hissedilen) {
  const min = typeof parca.minC === "number" ? parca.minC : null;
  const max = typeof parca.maxC === "number" ? parca.maxC : null;
  if (min == null || max == null) return 0.35; // etiketsiz parça: zayıf ama eleme

  if (hissedilen < min) {
    // Çok soğuk: her derece uzaklık ciddi ceza
    return Math.max(0, 1 - (min - hissedilen) / 8) * 0.6;
  }
  if (hissedilen > max) {
    return Math.max(0, 1 - (hissedilen - max) / 8) * 0.6;
  }

  const orta = (min + max) / 2;
  const yariAralik = Math.max(1, (max - min) / 2);
  // Ortada 1.0, kenarda 0.6
  return 1 - (Math.abs(hissedilen - orta) / yariAralik) * 0.4;
}

/**
 * Yağmur/kar varsa su geçirmez parçaya belirgin avantaj.
 *
 * Kuru günde ise su geçirmez parça KÜÇÜK bir ceza alıyor. Sebebi: yağmurluk
 * ve muşamba daha az nefes alıyor, kuru havada aynı sıcaklığa uygun normal
 * bir ceket varken onu tercih etmek doğru. Ceza kasıtlı olarak küçük (0.08)
 * — yalnızca eşitliği bozuyor, sıcaklık uygunluğunu asla ezmiyor.
 *
 * Bu olmadan, aynı aralıkta iki ceket varken seçim dizinin sırasına kalıyordu
 * ve kuru günde de hep yağmurluk çıkıyordu.
 */
function yagisPuani(parca, yagisli) {
  if (!yagisli) return parca.suGecirmez ? -0.08 : 0;
  return parca.suGecirmez ? 0.45 : -0.2;
}

/** Aynı parçayı üst üste önermemek için hafif çeşitlilik cezası. */
function tekrarCezasi(parca, sonKullanilanIdler) {
  const i = sonKullanilanIdler.indexOf(parca.id);
  if (i < 0) return 0;
  // En son kullanılan en çok cezayı alıyor
  return -0.25 + i * 0.05;
}

function katmanaGore(parcalar) {
  const g = {};
  for (const p of parcalar) {
    if (!p.katman) continue;
    (g[p.katman] ||= []).push(p);
  }
  return g;
}

/**
 * Dış katman gerekli mi?
 *
 * Sadece "soğuk mu" diye bakmak yetmiyor: 12°C'de yağmur varken de mont
 * gerekiyor, 12°C'de güneşliyken gerekmiyor olabilir.
 */
function disKatmanGerekli(hissedilen, yagisli, ruzgar) {
  if (hissedilen <= 16) return true;
  if (yagisli) return true;
  if (ruzgar >= 30 && hissedilen <= 20) return true;
  return false;
}

/**
 * Gardıroptan bir kombin seçer.
 *
 * @returns {{secilenler: Array, baslik: string, ozet: string, eksik: string|null, kaynak: "cihaz"}}
 */
export function yerelKombinSec(parcalar, hava, { sonKullanilanIdler = [], etkinlik = "gunluk" } = {}) {
  const etiketli = (parcalar ?? []).filter((p) => p.etiketlendi !== false && p.katman);
  if (etiketli.length === 0) {
    return null;
  }

  const hissedilen =
    typeof hava?.hissedilen === "number" ? hava.hissedilen : hava?.sicaklik ?? 20;
  const kod = hava?.kod ?? 0;
  const ruzgar = hava?.ruzgar ?? 0;
  const yagisIhtimali = hava?.yagisIhtimali ?? 0;
  const yagisli =
    RAIN_CODES.has(kod) || SNOW_CODES.has(kod) || STORM_CODES.has(kod) || yagisIhtimali >= 50;

  const gruplar = katmanaGore(etiketli);
  const secilenler = [];
  const eksikler = [];

  const disGerek = disKatmanGerekli(hissedilen, yagisli, ruzgar);

  for (const katman of KATMAN_SIRA) {
    // Dış katman gerekmiyorsa hiç seçme — 30 derecede mont önermek
    // motorun güvenilirliğini tek hamlede bitirir.
    if (katman === "dis" && !disGerek) continue;
    // Aksesuar yalnızca soğukta veya güçlü güneşte anlamlı
    if (katman === "aksesuar" && hissedilen > 12 && (hava?.uv ?? 0) < 7) continue;

    const aday = gruplar[katman];
    if (!aday?.length) {
      if (katman !== "aksesuar") eksikler.push(katman);
      continue;
    }

    const puanli = aday
      .map((p) => ({
        parca: p,
        puan:
          sicaklikPuani(p, hissedilen) +
          yagisPuani(p, yagisli) +
          etkinlikPuani(p, etkinlik) +
          tekrarCezasi(p, sonKullanilanIdler),
      }))
      .sort((a, b) => b.puan - a.puan);

    const kazanan = puanli[0];
    // Puanı çok düşükse hiç önerme: uygunsuz parçayı zorlamak yerine
    // eksik olduğunu söylemek daha dürüst.
    if (kazanan.puan < 0.25) {
      if (katman !== "aksesuar") eksikler.push(katman);
      continue;
    }

    secilenler.push({
      id: kazanan.parca.id,
      katman,
      neden: gerekce(kazanan.parca, hissedilen, yagisli),
    });
  }

  if (secilenler.length === 0) return null;

  return {
    secilenler,
    baslik: baslikUret(hissedilen, yagisli, kod),
    ozet: ozetUret(secilenler.length, hissedilen, yagisli),
    eksik: eksikMetni(eksikler, yagisli),
    etkinlik,
    kaynak: "cihaz",
  };
}

function gerekce(parca, hissedilen, yagisli) {
  if (yagisli && parca.suGecirmez) return "Yağışa dayanıklı, bugün işini görür.";
  if (typeof parca.minC === "number" && typeof parca.maxC === "number") {
    if (hissedilen < parca.minC) return `Biraz ince kalabilir ama en uygunu bu.`;
    if (hissedilen > parca.maxC) return `Biraz kalın ama elindeki en uygun parça.`;
    return `${Math.round(parca.minC)}–${Math.round(parca.maxC)}° aralığına uygun.`;
  }
  return "Bugünün havasına uygun.";
}

function baslikUret(hissedilen, yagisli, kod) {
  if (STORM_CODES.has(kod)) return "Fırtınalı bir gün, sağlam giyin.";
  if (SNOW_CODES.has(kod)) return "Kar var, kalın ve sıcak tutan parçalar şart.";
  if (yagisli) return "Yağış var, su geçirmez tarafı seç.";
  if (hissedilen <= 5) return "Soğuk bir gün, üst üste giyin.";
  if (hissedilen <= 14) return "Serin bir gün, üstüne bir şey al.";
  if (hissedilen <= 24) return "Ilıman bir gün, rahat bir kombin yeter.";
  return "Sıcak bir gün, hafif ve nefes alan kumaşlar.";
}

function ozetUret(adet, hissedilen, yagisli) {
  const parcalar = `Gardırobundan ${adet} parça seçtim`;
  const sicaklik = `${Math.round(hissedilen)}° hissedilen sıcaklığa göre`;
  const yagis = yagisli ? ", yağışı da hesaba kattım" : "";
  return `${parcalar}, ${sicaklik}${yagis}.`;
}

const KATMAN_ADI = {
  ust: "üst",
  alt: "alt",
  dis: "dış giyim",
  ayakkabi: "ayakkabı",
};

function eksikMetni(eksikler, yagisli) {
  if (eksikler.length === 0) {
    return yagisli ? null : null;
  }
  const adlar = eksikler.map((k) => KATMAN_ADI[k] ?? k).join(", ");
  return `Bugün için uygun ${adlar} bulamadım — gardırobuna eklersen öneri daha isabetli olur.`;
}

/**
 * Etiketsiz bir fotoğraf için makul başlangıç değerleri.
 *
 * Yapay zeka yokken kullanıcı onay modalında bunları düzeltiyor. Boş form
 * yerine doldurulmuş form sunmak, elle etiketlemeyi katlanılabilir kılıyor:
 * çoğu zaman tek dokunuş (katman) yeterli oluyor.
 */
export function tahminiEtiket() {
  return {
    kiyafetMi: true,
    ad: "Yeni parça",
    tur: "",
    katman: "ust",
    kumas: "pamuk",
    minC: 12,
    maxC: 26,
    renk: "",
    desen: "düz",
    suGecirmez: false,
    resmiyet: "gunluk",
  };
}
