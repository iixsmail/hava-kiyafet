import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePremium } from "./PremiumContext";
import { cihazKimligiAl } from "../api/stylist";

// Reklam yönetimi: banner, geçiş (interstitial) ve ödüllü (rewarded).
//
// Native modül korumalı yükleniyor — Expo Go'da veya modülü içermeyen bir
// build'de doğrudan import TÜM uygulamayı düşürürdü.
let Ads = null;
try {
  Ads = require("react-native-google-mobile-ads");
} catch (e) {
  Ads = null;
}

// --- Reklam birimleri ------------------------------------------------------
//
// Google'ın RESMİ Android test birimleri. Bunlar herkese açık sabitler; gerçek
// gelir üretmezler ama tıklanmaları da güvenlidir.
//
// ⚠️ Kendi GERÇEK reklamına asla tıklama — AdMob bunu geçersiz trafik sayar
// ve hesabı kalıcı olarak kapatabilir. Geliştirmede daima test birimi
// kullanılmasının sebebi bu.
const TEST_BIRIMLERI = {
  banner: "ca-app-pub-3940256099942544/6300978111",
  interstitial: "ca-app-pub-3940256099942544/1033173712",
  rewarded: "ca-app-pub-3940256099942544/5224354917",
};

// Gerçek birimler. AdMob panelinde oluşturup buraya yazıyorsun.
const GERCEK_BIRIMLER = {
  banner: "ca-app-pub-2234260593125912/5609768481",
  interstitial: "", // TODO: AdMob > Reklam birimleri > Geçiş reklamı
  rewarded: "", // TODO: AdMob > Reklam birimleri > Ödüllü reklam
};

function birimSec(tur) {
  // Geliştirmede HER ZAMAN test birimi: akış uçtan uca denenebilsin.
  if (__DEV__) return Ads?.TestIds?.[tur.toUpperCase()] ?? TEST_BIRIMLERI[tur];

  const gercek = GERCEK_BIRIMLER[tur];
  if (gercek && gercek.startsWith("ca-app-pub-")) return gercek;

  // Üretimde gerçek birim yoksa o formatı KAPATIYORUZ.
  //
  // Eskiden test birimine düşüyordu. Emülatörde release derlemesinde
  // görüldü: kullanıcıya üzerinde "Test Ad" yazan bir geçiş reklamı
  // açılıyor. Gelir getirmediği gibi uygulamayı bozuk gösteriyor.
  // Boş dizge reklamGosterilebilir() kontrolüne takılıp formatı sessizce
  // devre dışı bırakıyor — banner'ın gerçek birimi olduğu için o çalışmaya
  // devam ediyor.
  return "";
}

export const REKLAM_BIRIMLERI = {
  banner: birimSec("banner"),
  interstitial: birimSec("interstitial"),
  rewarded: birimSec("rewarded"),
};

// Üretim derlemesinde eksik birimleri bir kez uyar.
if (!__DEV__) {
  const eksik = Object.entries(GERCEK_BIRIMLER)
    .filter(([, v]) => !v || !v.startsWith("ca-app-pub-"))
    .map(([k]) => k);
  if (eksik.length) {
    console.warn(
      `[Reklam] UYARI: ${eksik.join(", ")} için gerçek AdMob birimi ayarlanmamış; ` +
        "bu formatlar KAPALI ve bu sürümde gelir üretmiyorlar. " +
        "src/context/AdsContext.js içindeki GERCEK_BIRIMLER değerlerini doldur."
    );
  }
}

// --- Frekans sınırları -----------------------------------------------------
// Kullanıcıyı boğmamak için. Bu sayılar bilinçli olarak DÜŞÜK: geçiş reklamı
// en çok gelir getiren format ama aynı zamanda en çok kaldırılma sebebi.
const SAYAC_ANAHTARI = "reklamSayaclari.v1";

export const LIMITLER = {
  // Her N parça eklemede bir geçiş reklamı
  parcaBasinaGecis: 3,
  // Şehir aramasından sonra günde en fazla N geçiş reklamı
  gunlukAramaGecis: 2,
  // İki geçiş reklamı arasında en az bu kadar saniye geçmeli. Art arda
  // reklam, tek başına en yüksek kaldırılma sebeplerinden biri.
  gecisAraSaniye: 90,
};

function bugununAnahtari() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const AdsContext = createContext(null);

export function AdsProvider({ children }) {
  const { isPremium } = usePremium();

  const [sayaclar, setSayaclar] = useState({
    gun: bugununAnahtari(),
    parcaEkleme: 0,
    aramaGecis: 0,
  });
  const sonGecisRef = useRef(0);
  const interstitialRef = useRef(null);
  const [oduluHazir, setOduluHazir] = useState(false);
  const rewardedRef = useRef(null);

  // Premium satın alınınca reklamlar ANINDA ölmeli.
  //
  // Sadece bileşeni gizlemek yetmiyor: yüklü bir geçiş reklamı ve olay
  // dinleyicileri arka planda kalıyor, kullanıcı parasını ödedikten sonra
  // bir sonraki tetikte tam ekran reklam yiyor. Burada nesneleri de yok
  // ediyoruz.
  const reklamlariYokEt = useCallback(() => {
    try {
      interstitialRef.current?.removeAllListeners?.();
    } catch (e) {
      /* yoksay */
    }
    try {
      rewardedRef.current?.removeAllListeners?.();
    } catch (e) {
      /* yoksay */
    }
    interstitialRef.current = null;
    rewardedRef.current = null;
    setOduluHazir(false);
  }, []);

  useEffect(() => {
    if (isPremium) reklamlariYokEt();
  }, [isPremium, reklamlariYokEt]);

  // Sayaçları diskten oku; gün değiştiyse sıfırla.
  useEffect(() => {
    (async () => {
      try {
        const ham = await AsyncStorage.getItem(SAYAC_ANAHTARI);
        const kayit = ham ? JSON.parse(ham) : null;
        if (kayit?.gun === bugununAnahtari()) setSayaclar(kayit);
      } catch (e) {
        console.log("Reklam sayaçları okunamadı:", e?.message);
      }
    })();
  }, []);

  const sayaclariYaz = useCallback(async (yeni) => {
    setSayaclar(yeni);
    try {
      await AsyncStorage.setItem(SAYAC_ANAHTARI, JSON.stringify(yeni));
    } catch (e) {
      console.log("Reklam sayaçları yazılamadı:", e?.message);
    }
  }, []);

  const reklamGosterilebilir = useCallback(
    (tur) => {
      if (isPremium) return false;
      if (!Ads) return false;
      if (!REKLAM_BIRIMLERI[tur]) return false;
      return true;
    },
    [isPremium]
  );

  // --- Geçiş reklamı -------------------------------------------------------

  const gecisHazirla = useCallback(() => {
    if (!reklamGosterilebilir("interstitial")) return null;
    if (interstitialRef.current) return interstitialRef.current;
    try {
      const ad = Ads.InterstitialAd.createForAdRequest(REKLAM_BIRIMLERI.interstitial, {
        requestNonPersonalizedAdsOnly: true,
      });
      ad.addAdEventListener(Ads.AdEventType.LOADED, () => {});
      ad.addAdEventListener(Ads.AdEventType.ERROR, (e) =>
        console.log("Geçiş reklamı yüklenemedi:", e?.message)
      );
      ad.load();
      interstitialRef.current = ad;
      return ad;
    } catch (e) {
      console.log("Geçiş reklamı kurulamadı:", e?.message);
      return null;
    }
  }, [reklamGosterilebilir]);

  /**
   * Geçiş reklamı göstermeyi DENER. Frekans sınırı dolmuşsa sessizce geçer.
   * @param sebep "parcaEkleme" | "arama"
   * @returns gösterildi mi
   */
  const gecisDene = useCallback(
    async (sebep) => {
      if (!reklamGosterilebilir("interstitial")) return false;

      // Art arda reklam koruması
      const simdi = Date.now();
      if (simdi - sonGecisRef.current < LIMITLER.gecisAraSaniye * 1000) return false;

      const bugun = bugununAnahtari();
      const s = sayaclar.gun === bugun ? sayaclar : { gun: bugun, parcaEkleme: 0, aramaGecis: 0 };

      let goster = false;
      let yeni = { ...s };

      if (sebep === "parcaEkleme") {
        yeni.parcaEkleme = s.parcaEkleme + 1;
        goster = yeni.parcaEkleme % LIMITLER.parcaBasinaGecis === 0;
      } else if (sebep === "arama") {
        if (s.aramaGecis < LIMITLER.gunlukAramaGecis) {
          yeni.aramaGecis = s.aramaGecis + 1;
          goster = true;
        }
      }

      await sayaclariYaz(yeni);
      if (!goster) return false;

      const ad = interstitialRef.current ?? gecisHazirla();
      if (!ad?.loaded) {
        // Yüklenmemişse bekletmiyoruz — kullanıcıyı reklam için bekletmek
        // reklamdan elde edilecek gelirden pahalıya patlar.
        gecisHazirla();
        return false;
      }

      try {
        ad.show();
        sonGecisRef.current = simdi;
        interstitialRef.current = null;
        setTimeout(gecisHazirla, 1000); // bir sonraki için hazırla
        return true;
      } catch (e) {
        console.log("Geçiş reklamı gösterilemedi:", e?.message);
        return false;
      }
    },
    [reklamGosterilebilir, sayaclar, sayaclariYaz, gecisHazirla]
  );

  // --- Ödüllü reklam -------------------------------------------------------

  const oduluHazirla = useCallback(async () => {
    if (!reklamGosterilebilir("rewarded")) return null;
    if (rewardedRef.current) return rewardedRef.current;
    try {
      const ad = Ads.RewardedAd.createForAdRequest(REKLAM_BIRIMLERI.rewarded, {
        requestNonPersonalizedAdsOnly: true,
        // SUNUCU TARAFLI DOĞRULAMA (SSV).
        //
        // Ödülü istemcinin "izledim" demesine dayanarak vermek, uygulamayı
        // kurcalayan birine sınırsız kredi vermek demek. AdMob, reklam
        // izlendiğinde BİZİM sunucumuza doğrudan çağrı yapıyor; krediyi o
        // çağrı açıyor. userId olarak kredi sayacının anahtarı olan cihaz
        // kimliğini gönderiyoruz.
        serverSideVerificationOptions: {
          userId: await cihazKimligiAl(),
          customData: "kombin",
        },
      });
      ad.addAdEventListener(Ads.RewardedAdEventType.LOADED, () => setOduluHazir(true));
      ad.addAdEventListener(Ads.AdEventType.ERROR, (e) => {
        setOduluHazir(false);
        console.log("Ödüllü reklam yüklenemedi:", e?.message);
      });
      ad.load();
      rewardedRef.current = ad;
      return ad;
    } catch (e) {
      console.log("Ödüllü reklam kurulamadı:", e?.message);
      return null;
    }
  }, [reklamGosterilebilir]);

  /**
   * Ödüllü reklamı gösterir.
   * @returns {Promise<{gosterildi: boolean, odulKazanildi: boolean}>}
   */
  const odulluGoster = useCallback(async () => {
    if (!reklamGosterilebilir("rewarded")) {
      return { gosterildi: false, odulKazanildi: false };
    }
    const ad = rewardedRef.current ?? (await oduluHazirla());
    if (!ad?.loaded) {
      await oduluHazirla();
      return { gosterildi: false, odulKazanildi: false };
    }

    return new Promise((resolve) => {
      let kazanildi = false;
      const temizle = [];

      temizle.push(
        ad.addAdEventListener(Ads.RewardedAdEventType.EARNED_REWARD, () => {
          kazanildi = true;
        })
      );
      temizle.push(
        ad.addAdEventListener(Ads.AdEventType.CLOSED, () => {
          temizle.forEach((f) => {
            try {
              f?.();
            } catch {
              /* yoksay */
            }
          });
          rewardedRef.current = null;
          setOduluHazir(false);
          setTimeout(oduluHazirla, 1000);
          resolve({ gosterildi: true, odulKazanildi: kazanildi });
        })
      );

      try {
        ad.show();
      } catch (e) {
        console.log("Ödüllü reklam gösterilemedi:", e?.message);
        resolve({ gosterildi: false, odulKazanildi: false });
      }
    });
  }, [reklamGosterilebilir, oduluHazirla]);

  // Reklamları önceden hazırla (premium değilse)
  useEffect(() => {
    if (isPremium || !Ads) return;
    gecisHazirla();
    oduluHazirla();
  }, [isPremium, gecisHazirla, oduluHazirla]);

  return (
    <AdsContext.Provider
      value={{
        // Tek doğruluk kaynağı: premium ise HİÇBİR reklam bileşeni
        // render edilmiyor, hiçbir istek atılmıyor.
        reklamAcik: !isPremium && !!Ads,
        bannerId: REKLAM_BIRIMLERI.banner,
        gecisDene,
        odulluGoster,
        oduluHazir,
        odulDestekleniyor: reklamGosterilebilir("rewarded"),
        sayaclar,
      }}
    >
      {children}
    </AdsContext.Provider>
  );
}

export function useAds() {
  const ctx = useContext(AdsContext);
  if (!ctx) throw new Error("useAds, AdsProvider içinde kullanılmalı.");
  return ctx;
}
