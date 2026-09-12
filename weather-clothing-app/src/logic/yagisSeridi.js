// Yağışın ne zaman başlayıp ne zaman keseceği.
//
// Kullanıcının yağmurlu bir günde sorduğu soru "%60 ihtimal" değil: "şimdi
// çıksam ıslanır mıyım, bekleyeyim mi?". 15 dakikalık seri bunu ilk kez
// cevaplayabilir hale getirdi — saatlik kovalarla "16:00 civarı" demekten
// öteye gidilemiyordu.

/** Şeridin kapsadığı çeyrek sayısı: 24 × 15dk = 6 saat. */
export const CEYREK_SAYISI = 24;

/**
 * Şeridi göstermeye değer kılan en küçük toplam yağış (mm).
 *
 * Altındaki değerlerde 24 boş çubuk çizmek ekranda gürültüden başka bir şey
 * değil; kart hiç görünmüyor.
 */
export const GOSTERME_ESIGI = 0.2;

/**
 * Yağışın "kesildi" sayılması için gereken kuru çeyrek sayısı.
 *
 * 2 çeyrek = 30 dakika. Tek bir kuru çeyreği "kesildi" saymak, aralıklı
 * sağanakta kullanıcıyı yanlış zamanda dışarı çıkarırdı.
 */
export const KURU_ARA = 2;

const saatEtiketi = (iso) => iso?.slice(11, 16) ?? "";

/**
 * @param ceyrekler get15Dakikalik çıktısı
 * @returns null | { barlar, enBuyuk, toplam, basla, bitir, suAnYagiyor, ozet }
 */
export function yagisSeridi(ceyrekler) {
  const dilim = (ceyrekler ?? []).slice(0, CEYREK_SAYISI);
  if (dilim.length < 4) return null;

  const mm = dilim.map((c) => (typeof c.yagisMm === "number" ? c.yagisMm : 0));
  const toplam = mm.reduce((a, b) => a + b, 0);
  if (toplam < GOSTERME_ESIGI) return null;

  const enBuyuk = Math.max(...mm);
  const ilk = mm.findIndex((v) => v > 0);
  const suAnYagiyor = mm[0] > 0;

  // Bitiş: başlangıçtan sonra ART ARDA en az KURU_ARA çeyrek kuru kalan ilk an.
  let bitisIndex = -1;
  for (let i = ilk; i < mm.length; i++) {
    if (mm[i] > 0) continue;
    let kuru = 0;
    while (i + kuru < mm.length && mm[i + kuru] === 0) kuru++;
    if (kuru >= KURU_ARA) {
      bitisIndex = i;
      break;
    }
    i += kuru - 1;
  }

  const basla = saatEtiketi(dilim[ilk].time);
  const bitir = bitisIndex >= 0 ? saatEtiketi(dilim[bitisIndex].time) : null;

  // İlk kesintiden SONRA tekrar yağıyor mu?
  //
  // Cümle yalnızca ilk atağı anlatınca çubuklarla çelişiyordu: "11:15 gibi
  // kesiliyor" yazarken grafikte 13:00'te daha yoğun yağış duruyordu.
  // Kullanıcı "bitti" sanıp ıslanıyor.
  const sonYagisIndex = mm.reduce((son, v, i) => (v > 0 ? i : son), -1);
  const tekrarVar = bitisIndex >= 0 && sonYagisIndex > bitisIndex;
  const sonYagis = sonYagisIndex >= 0 ? saatEtiketi(dilim[sonYagisIndex].time) : null;

  // Cümleyi kullanıcının sorduğu soruya göre kuruyoruz.
  let ozet;
  if (tekrarVar) {
    ozet = suAnYagiyor
      ? `Aralıklı yağış — ${sonYagis} civarına kadar sürüyor.`
      : `Aralıklı yağış — ${basla} ile ${sonYagis} arası.`;
  } else if (suAnYagiyor) {
    ozet = bitir
      ? `Şu an yağıyor, ${bitir} gibi kesiliyor.`
      : "Önümüzdeki saatlerde yağış sürüyor.";
  } else {
    ozet = bitir
      ? `${basla} gibi başlıyor, ${bitir} gibi kesiliyor.`
      : `${basla} gibi başlıyor ve sürüyor.`;
  }

  return {
    // Çubuk yüksekliği 0–1 arası oran; bileşen bunu piksele çeviriyor.
    barlar: dilim.map((c, i) => ({
      iso: c.time,
      saat: saatEtiketi(c.time),
      mm: mm[i],
      oran: enBuyuk > 0 ? mm[i] / enBuyuk : 0,
      // Saat başlarını etiketliyoruz; her çeyreğe etiket koymak okunmuyor.
      saatBasi: c.time?.slice(14, 16) === "00",
    })),
    enBuyuk,
    toplam,
    basla,
    bitir,
    sonYagis,
    tekrarVar,
    suAnYagiyor,
    ozet,
  };
}
