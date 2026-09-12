// Stil sunucusuyla konuşan katman.
//
// Yapay zeka servisine DOĞRUDAN buradan çağrı yapılmıyor — API anahtarı uygulamanın içine
// girmiyor. Bütün istekler kendi sunucumuza gidiyor, anahtar orada duruyor,
// kredi sayacı da orada tutuluyor (istemcide tutulsa kurcalanabilirdi).

import AsyncStorage from "@react-native-async-storage/async-storage";
import { SUNUCU_URL, sunucuHazirMi } from "../config";

const CIHAZ_ANAHTARI = "cihazKimligi.v1";

// Cihaz başına bir kimlik. Kredi sayacı buna bağlı. Kişisel bilgi içermiyor,
// rastgele üretiliyor ve cihazdan dışarı yalnızca kendi sunucumuza gidiyor.
let cihazKimligiOnbellek = null;

async function cihazKimligi() {
  if (cihazKimligiOnbellek) return cihazKimligiOnbellek;
  let k = await AsyncStorage.getItem(CIHAZ_ANAHTARI);
  if (!k) {
    k = `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    await AsyncStorage.setItem(CIHAZ_ANAHTARI, k);
  }
  cihazKimligiOnbellek = k;
  return k;
}

// Premium doğrulaması sunucuda Google Play'e sorularak yapılıyor; buradan
// sadece satın alma jetonunu taşıyoruz. "Ben premium'um" demek yetmiyor.
const JETON_ANAHTARI = "playJetonu.v1";

export async function playJetonuKaydet(jeton) {
  if (jeton) await AsyncStorage.setItem(JETON_ANAHTARI, String(jeton));
}

async function playJetonu() {
  return (await AsyncStorage.getItem(JETON_ANAHTARI)) || "";
}

async function istek(yol, secenekler = {}) {
  if (!sunucuHazirMi()) {
    throw new Error("Yapay zeka servisi bu sürümde yapılandırılmamış.");
  }

  const kontrol = new AbortController();
  // Model çağrısı uzun sürebiliyor; ama sonsuza
  // kadar da bekletmiyoruz — kullanıcı dönen bir spinner'a mahkum kalmasın.
  const zamanlayici = setTimeout(() => kontrol.abort(), 60000);

  try {
    const res = await fetch(`${SUNUCU_URL}${yol}`, {
      ...secenekler,
      signal: kontrol.signal,
      headers: {
        "content-type": "application/json",
        "x-cihaz": await cihazKimligi(),
        "x-play-jeton": await playJetonu(),
        ...(secenekler.headers || {}),
      },
    });

    const govde = await res.json().catch(() => ({}));
    if (!res.ok) {
      const hata = new Error(govde.hata || "Servise ulaşılamadı.");
      hata.kod = res.status;
      hata.kredi = govde.kredi ?? null;
      throw hata;
    }
    return govde;
  } catch (e) {
    if (e.name === "AbortError") throw new Error("Servis yanıt vermedi, tekrar dene.");
    // `fetch` bağlantı koptuğunda İNGİLİZCE "Network request failed" fırlatıyor
    // ve bu metin doğrudan kullanıcının ekranına düşüyor. Türkçeleştiriyoruz.
    if (e instanceof TypeError) {
      throw new Error("İnternet bağlantısı yok gibi görünüyor. Bağlantını kontrol et.");
    }
    throw e;
  } finally {
    clearTimeout(zamanlayici);
  }
}

/** Fotoğrafı modele etiketletir. Parça başına BİR KEZ çağrılır. */
export async function etiketle(base64, mime = "image/jpeg") {
  return istek("/v1/etiketle", {
    method: "POST",
    body: JSON.stringify({ gorsel: base64, mime }),
  });
}

/** Gardırop özeti + hava durumundan günün kombinini ister. Fotoğraf gitmez. */
export async function kombinIste(gardirop, hava) {
  return istek("/v1/kombin", {
    method: "POST",
    body: JSON.stringify({ gardirop, hava }),
  });
}

/** Ödüllü reklam SSV'sinde userId olarak gönderiliyor. */
export async function cihazKimligiAl() {
  return cihazKimligi();
}

export async function krediDurumu() {
  return istek("/v1/kredi", { method: "GET" });
}
