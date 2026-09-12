// Sabah bildiriminin gün özeti.
//
// ASIL DÜZELTME BURASI. Sabah bildirimi eskiden YALNIZCA 08:00 saatini
// anlatıyordu: "Bugün 12° ve parçalı bulutlu". Ama insan sabah 08:00 için
// değil, GÜN İÇİN giyiniyor. 12°'de çıkıp 26°'ye varan bir günde kullanıcı
// kalın giyinip öğlen pişiyor — üstelik bunu uygulamanın hatası sanıyor.
//
// İkinci ve daha ağır eksik: saat 14:00'te yağmur varsa 08:00 kovası kuru
// olduğu için sabah bildirimi şemsiyeden HİÇ söz etmiyordu. Oysa şemsiye
// kararı tam o an, evden çıkarken veriliyor. Bir kıyafet uygulamasının
// kaçırabileceği en pahalı bilgi buydu.
//
// Bu modül saf: karar da metin de test edilebilir.

import { eylemCumlesi, YAGIS_MM_ESIGI, YAGIS_IHTIMAL_ESIGI, YAGIS_KESIN_MM } from "./uyarilar.js";

/**
 * Günü "salınımlı" saymak için gereken en küçük fark (hissedilen, °C).
 *
 * 6°: altındaki farklar tek bir kıyafetle geçilebiliyor ve her gün
 * "katmanlı giyin" demek uyarıyı anlamsızlaştırır. Üstünde ise sabah
 * giydiğini öğlen çıkarmak gerçekten gerekiyor.
 */
export const SALINIM_ESIGI = 6;

const saatEtiketi = (iso) => iso?.slice(11, 16) ?? "";
const gunu = (iso) => iso?.slice(0, 10) ?? "";

const KAR_KODLARI = new Set([71, 73, 75, 77, 85, 86]);

/**
 * Bildirimin ateşleneceği saatten gün sonuna kadar olan dilimi çıkarır.
 *
 * Gün sonu ile sınırlıyoruz: sabah bildiriminde yarının yağmurunu haber
 * vermek kafa karıştırıyor ("bugün mü yarın mı?"), üstelik yarın sabah
 * zaten kendi bildirimi gidiyor.
 */
export function gunDilimi(saatler, baslangicIso) {
  if (!Array.isArray(saatler) || saatler.length === 0) return [];
  const bas = baslangicIso ? saatler.findIndex((s) => s.time === baslangicIso) : 0;
  if (bas < 0) return [];
  const gun = gunu(saatler[bas].time);
  return saatler.slice(bas).filter((s) => gunu(s.time) === gun);
}

/**
 * Gün içindeki yağış penceresi.
 *
 * Eşikler `uyarilar.js` ile ORTAK: sabah "şemsiye al" deyip saat 13:00'te
 * gelen uyarının susması (ya da tersi) iki ayrı uygulama gibi görünürdü.
 *
 * @returns null | { basla, bitir, mm, kar }
 */
export function yagisPenceresi(dilim) {
  const yagisli = (s) => {
    const mm = s.yagisMm ?? 0;
    const ihtimal = s.rainChance ?? 0;
    return mm >= YAGIS_KESIN_MM || (mm >= YAGIS_MM_ESIGI && ihtimal >= YAGIS_IHTIMAL_ESIGI);
  };

  const ilk = dilim.findIndex(yagisli);
  if (ilk < 0) return null;

  let son = ilk;
  for (let i = ilk; i < dilim.length; i++) if (yagisli(dilim[i])) son = i;

  const toplam = dilim
    .slice(ilk, son + 1)
    .reduce((a, s) => a + (s.yagisMm ?? 0), 0);

  return {
    basla: saatEtiketi(dilim[ilk].time),
    bitir: son > ilk ? saatEtiketi(dilim[son].time) : null,
    mm: Number(toplam.toFixed(1)),
    kar: KAR_KODLARI.has(dilim[ilk].code),
  };
}

/**
 * Günün hissedilen sıcaklık profili.
 *
 * @param dilim gunDilimi çıktısı
 * @param kayma kişisel sıcaklık kayması (°C)
 * @returns null | { baslangic, enSicak, enSoguk, salinim }
 */
export function sicaklikProfili(dilim, kayma = 0) {
  if (dilim.length === 0) return null;

  const hs = (s) => Math.round((s.hissedilen ?? s.temp ?? 0) + kayma);

  let enSicak = dilim[0];
  let enSoguk = dilim[0];
  for (const s of dilim) {
    if (hs(s) > hs(enSicak)) enSicak = s;
    if (hs(s) < hs(enSoguk)) enSoguk = s;
  }

  return {
    baslangic: { saat: saatEtiketi(dilim[0].time), hissedilen: hs(dilim[0]) },
    enSicak: { saat: saatEtiketi(enSicak.time), hissedilen: hs(enSicak) },
    enSoguk: { saat: saatEtiketi(enSoguk.time), hissedilen: hs(enSoguk) },
    // Salınım, çıkışta giydiğinin gün içinde ne kadar fazla geleceği.
    salinim: hs(enSicak) - hs(dilim[0]),
  };
}

/**
 * Yağış cümlesi — sabah bildiriminin en pahalı bilgisi.
 *
 * Miktara göre iki kalıp: 1 mm üstünde şemsiye şart, altında "hafif" deyip
 * kullanıcıyı boşuna şemsiye taşıtmıyoruz. Saat aralığı veriyoruz ki
 * "bütün gün yağacak" korkusu oluşmasın.
 */
export function yagisCumlesi(pencere) {
  if (!pencere) return null;

  const tur = pencere.kar ? "kar" : "yağmur";
  const ne = pencere.bitir
    ? `${pencere.basla}–${pencere.bitir} arası`
    : `${pencere.basla} civarı`;

  if (pencere.kar) return `${ne} ${tur} var, kaymaz ayakkabı giy.`;
  if (pencere.mm >= 1) return `${ne} ${tur} var, şemsiyeni al.`;
  return `${ne} hafif ${tur} olabilir.`;
}

/**
 * Salınım cümlesi.
 *
 * Yalnızca gerçekten katman gerektiren günlerde çıkıyor; her gün
 * "katmanlı giyin" demek cümleyi görünmez yapar.
 */
export function salinimCumlesi(profil) {
  if (!profil || profil.salinim < SALINIM_ESIGI) return null;
  return `Öğleden sonra ${profil.enSicak.hissedilen}°'yi buluyor, katmanlı giyin.`;
}

/**
 * Sabah bildiriminin başlığı ve gövdesi.
 *
 * Başlıkta günün ARALIĞI var, tek bir saat değil: kullanıcı bildirime
 * bakar bakmaz "bugün ne kadar değişecek" sorusunun cevabını görüyor.
 *
 * @param dilim   gunDilimi çıktısı (bildirimin saatinden gün sonuna)
 * @param secenek { kayma, emoji, durum, kombinBasligi }
 * @returns null | { baslik, govde }
 */
export function sabahOzetMetni(dilim, { kayma = 0, emoji = "", durum = "", kombinBasligi = null } = {}) {
  const profil = sicaklikProfili(dilim, kayma);
  if (!profil) return null;

  const { baslangic, enSicak } = profil;

  // Aralık yalnızca gerçekten değişen günlerde gösteriliyor; sabit bir
  // günde "22° → 22°" yazmak gürültü.
  const baslik =
    enSicak.hissedilen - baslangic.hissedilen >= 3
      ? `Bugün ${baslangic.hissedilen}° → ${enSicak.hissedilen}° ${emoji}`.trim()
      : `Bugün ${baslangic.hissedilen}° ve ${durum} ${emoji}`.trim();

  // Gövde en fazla iki cümle: bildirim gölgesinde üçüncüsü kırpılıyor ve
  // yarım cümle hiç göstermemekten kötü.
  const parcalar = [];

  // Kullanıcının kendi gardırobundan gelen öneri her zaman önce: en somut bilgi.
  parcalar.push(kombinBasligi || `Çıkarken ${eylemCumlesi(baslangic.hissedilen)}.`);

  const yagis = yagisCumlesi(yagisPenceresi(dilim));
  if (yagis) parcalar.push(yagis);
  else {
    const salinim = salinimCumlesi(profil);
    if (salinim) parcalar.push(salinim);
  }

  return { baslik, govde: parcalar.join(" ") };
}

/**
 * Kaç günlük sabah bildirimi önceden planlanıyor.
 *
 * 7 gün: iOS'un 64 bekleyen bildirim sınırının çok altında kalıyor ve
 * kullanıcı uygulamayı bir hafta açmasa bile her sabah O GÜNE ait doğru
 * metni alıyor.
 */
export const SABAH_GUN_SAYISI = 7;

/**
 * Önümüzdeki günlerin sabah saatlerini bulur.
 *
 * ASIL DÜZELTME: sabah bildirimi eskiden TEK bir `DAILY` tekrarlı
 * tetikleyiciydi ve metni bir kez yazılıyordu. Kullanıcı uygulamayı üç gün
 * açmazsa üç sabah üst üste AYNI metni alıyordu — "Bugün 14° → 22°,
 * 10:00–16:00 arası yağmur var" cümlesi hava bambaşkayken de gidiyordu.
 * Kendinden emin biçimde yanlış bildirim, hiç bildirim almamaktan kötü.
 *
 * Artık her gün için ayrı, o güne ait metinle tek seferlik bildirim
 * planlıyoruz.
 *
 * @param saatler getHourlyForecast çıktısı (birkaç günlük)
 * @param sabahSaat 0-23
 * @param simdi karşılaştırma anı (ms) — testte sabitlenebilsin diye
 * @returns her gün için bir saat kaydı dizisi
 */
export function sabahSaatleri(saatler, sabahSaat, simdi = Date.now()) {
  if (!Array.isArray(saatler)) return [];

  const gorulen = new Set();
  const secilen = [];

  for (const s of saatler) {
    if (Number(s.time?.slice(11, 13)) !== sabahSaat) continue;

    const gun = gunu(s.time);
    if (gorulen.has(gun)) continue;
    gorulen.add(gun);

    // Geçmiş sabahları atlıyoruz: bugün saat 14:00'te uygulama açıldıysa
    // bu sabahın 08:00'i için bildirim planlamak anlamsız.
    if (new Date(s.time).getTime() <= simdi) continue;

    secilen.push(s);
    if (secilen.length >= SABAH_GUN_SAYISI) break;
  }

  return secilen;
}

/**
 * Uyarıların kaç güne bakacağı.
 *
 * Yağış ve soğuma uyarıları eskiden YALNIZCA önümüzdeki 12 saate bakıyordu:
 * tek bir yağmur, tek bir soğuma uyarısı. Sabah özetleri 7 günü kapsarken
 * uyarıların bir günü bile tamamlamaması tutarsızdı — kullanıcı yarın
 * öğleden sonraki sağanağı, uygulamayı o gün açmadıkça hiç öğrenemiyordu.
 *
 * 4 gün: tahminin güvenilir kaldığı aralık. Daha uzağı için yağış
 * zamanlaması zaten saat saat tutmuyor ve yanlış saatli uyarı, uyarıya
 * duyulan güveni götürüyor.
 */
export const UYARI_GUN_SAYISI = 4;

/**
 * Saatlik seriyi günlere böler.
 *
 * @param saatler getHourlyForecast çıktısı
 * @param gunSayisi en fazla kaç gün
 * @returns her biri o güne ait saatlerden oluşan diziler
 */
export function gunlereBol(saatler, gunSayisi = UYARI_GUN_SAYISI) {
  if (!Array.isArray(saatler)) return [];

  const gruplar = new Map();
  for (const s of saatler) {
    const g = gunu(s.time);
    if (!g) continue;
    if (!gruplar.has(g)) gruplar.set(g, []);
    gruplar.get(g).push(s);
  }

  return [...gruplar.values()].slice(0, gunSayisi);
}

/**
 * Günü, en sıcak saatinden itibaren dilimler.
 *
 * Soğuma uyarısı, dilimin İLK saatini taban alıp düşüşü ondan ölçüyor.
 * Bugün için doğru: taban "şu an". Ama gelecek günlerin dilimi 00:00'dan
 * başlıyor ve gece yarısı zaten günün en soğuk anı — 26°'den 14°'ye düşen
 * bir günde bile düşüş görünmüyor, uyarı hiç çıkmıyordu.
 *
 * Tepe noktasından başlatınca uyarının anlamı da doğru oluyor: "gündüz
 * sıcaktı, akşam üşüyeceksin".
 */
export function tepedenDilimle(gunSaatleri) {
  if (!Array.isArray(gunSaatleri) || gunSaatleri.length === 0) return [];
  const hs = (s) => s.hissedilen ?? s.temp ?? -Infinity;
  let tepe = 0;
  for (let i = 1; i < gunSaatleri.length; i++) {
    if (hs(gunSaatleri[i]) > hs(gunSaatleri[tepe])) tepe = i;
  }
  return gunSaatleri.slice(tepe);
}
