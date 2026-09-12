// Kayıtlı şehirler.
//
// Hava uygulamalarında en temel beklentilerden biri: kullanıcı memleketini,
// çalıştığı şehri ve gideceği yeri kaydedip aralarında geçiş yapabilsin.
// Önceki halde her arama öncekini siliyordu — kullanıcı her seferinde
// yeniden yazmak zorundaydı.
//
// Liste küçük (en fazla 10 kayıt) olduğu için AsyncStorage yeterli; gardırop
// gibi SQLite'a taşımaya değmez.

import AsyncStorage from "@react-native-async-storage/async-storage";

const ANAHTAR = "kayitliSehirler.v1";

// Üst sınır bilinçli: sınırsız liste hem arayüzü boğuyor hem her açılışta
// hepsini yenilemek istersek API'yi gereksiz yoruyor.
export const AZAMI = 10;

// Aynı şehri iki kez eklememek için koordinat bazlı kimlik. İsim bazlı
// olsaydı "İstanbul" ile "İstanbul, Türkiye" ayrı kayıtlar olurdu.
export function sehirKimligi(s) {
  if (s?.enlem == null || s?.boylam == null) return null;
  return `${s.enlem.toFixed(3)},${s.boylam.toFixed(3)}`;
}

export async function listele() {
  try {
    const ham = await AsyncStorage.getItem(ANAHTAR);
    const liste = ham ? JSON.parse(ham) : [];
    return Array.isArray(liste) ? liste.filter((s) => sehirKimligi(s)) : [];
  } catch (e) {
    console.log("Kayıtlı şehirler okunamadı:", e?.message);
    return [];
  }
}

async function yaz(liste) {
  try {
    await AsyncStorage.setItem(ANAHTAR, JSON.stringify(liste.slice(0, AZAMI)));
  } catch (e) {
    console.log("Kayıtlı şehirler yazılamadı:", e?.message);
  }
}

/** Şehri ekler; zaten varsa başa taşır (son kullanılan üstte). */
export async function ekle(sehir) {
  const kimlik = sehirKimligi(sehir);
  if (!kimlik) return listele();

  const liste = await listele();
  const kalan = liste.filter((s) => sehirKimligi(s) !== kimlik);
  const yeni = [{ ...sehir, eklendi: Date.now() }, ...kalan].slice(0, AZAMI);
  await yaz(yeni);
  return yeni;
}

export async function kaldir(kimlik) {
  const liste = await listele();
  const yeni = liste.filter((s) => sehirKimligi(s) !== kimlik);
  await yaz(yeni);
  return yeni;
}

export async function kayitliMi(sehir) {
  const kimlik = sehirKimligi(sehir);
  if (!kimlik) return false;
  return (await listele()).some((s) => sehirKimligi(s) === kimlik);
}
