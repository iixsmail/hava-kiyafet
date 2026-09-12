import React, { useEffect, useState } from "react";
import { useAds } from "../context/AdsContext";
import { View, StyleSheet, Platform } from "react-native";

// ÖNEMLİ: Bu paket native kod içerir ve Expo Go'da MEVCUT DEĞİLDİR.
// Dosyanın en üstünde normal `import` ile çağırırsak, modül yüklenirken
// TurboModuleRegistry hatası fırlatır ve TÜM UYGULAMA açılmaz
// ("App entry not found"). Bileşen içindeki try/catch bunu yakalayamaz,
// çünkü hata render'dan önce, import anında oluşur.
// Bu yüzden korumalı (lazy) require kullanıyoruz.
let Ads = null;
try {
  Ads = require("react-native-google-mobile-ads");
} catch (e) {
  Ads = null;
}

// GERÇEK banner reklam birimi ID'si. AdMob konsolunda oluşturuyorsun:
// https://apps.admob.com -> Uygulamalar -> Reklam birimleri -> Banner
// Formatı: "ca-app-pub-2234260593125912/XXXXXXXXXX"
//
// Bu GERÇEK reklam birimidir — yayınlanan sürümde gerçek reklam gösterir
// ve gelir üretir.
//
// ⚠️ Kendi uygulamandaki GERÇEK reklamlara ASLA tıklama. AdMob bunu
// "geçersiz trafik" sayar ve hesabın kalıcı olarak kapatılabilir.
// Geliştirme sırasında (__DEV__) otomatik olarak test reklamı gösterilir,
// bu yüzden yerelde test ederken tıklaman sorun değildir.
const PRODUCTION_BANNER_ID = "ca-app-pub-2234260593125912/5609768481";

const hasRealAdUnit =
  typeof PRODUCTION_BANNER_ID === "string" &&
  PRODUCTION_BANNER_ID.startsWith("ca-app-pub-") &&
  !PRODUCTION_BANNER_ID.includes("X");

// Google'ın resmî Android banner test birimi.
const GOOGLE_TEST_BANNER_ID = "ca-app-pub-3940256099942544/6300978111";

const adUnitId = __DEV__
  ? Ads?.TestIds?.BANNER || GOOGLE_TEST_BANNER_ID
  : hasRealAdUnit
    ? PRODUCTION_BANNER_ID
    : GOOGLE_TEST_BANNER_ID;

if (!__DEV__ && Ads && !hasRealAdUnit) {
  console.warn(
    "[AdBanner] UYARI: Gerçek AdMob banner ID'si ayarlanmamış, test reklamı " +
      "gösteriliyor. Bu sürümden REKLAM GELİRİ ELDE EDİLMEZ. Production'a " +
      "çıkmadan önce src/components/AdBanner.js içindeki PRODUCTION_BANNER_ID " +
      "değerini AdMob'dan aldığın gerçek ID ile doldur."
  );
}

export default function AdBanner() {
  // Tek doğruluk kaynağı: premium olan kullanıcıya HİÇBİR reklam isteği
  // atılmıyor. Sadece bileşeni gizlemek yetmiyordu — istek yine gidiyordu.
  const { reklamAcik, bannerId } = useAds();
  // Rıza durumu. Öğrenene kadar KİŞİSELLEŞTİRİLMEMİŞ reklam istiyoruz —
  // yanlış tarafa düşmek pahalı: AEA/İngiltere kullanıcısına rızasız
  // kişiselleştirilmiş reklam göstermek AdMob politikası ihlali ve hesabın
  // askıya alınmasına kadar gidebiliyor.
  const [kisisellestirilmis, setKisisellestirilmis] = useState(false);
  const [reklamIstenebilir, setReklamIstenebilir] = useState(true);

  useEffect(() => {
    let mounted = true;
    const AdsConsent = Ads?.AdsConsent;
    if (!AdsConsent) return;

    (async () => {
      try {
        // gatherConsent: gerekiyorsa rıza formunu gösterir, gerekmiyorsa
        // (örn. AEA dışındaki kullanıcı) hiçbir şey göstermeden döner.
        const bilgi = await AdsConsent.gatherConsent();
        if (!mounted) return;
        if (bilgi?.canRequestAds === false) {
          setReklamIstenebilir(false);
          return;
        }
        const secimler = await AdsConsent.getUserChoices();
        if (mounted) setKisisellestirilmis(secimler?.selectPersonalisedAds === true);
      } catch (e) {
        // Rıza akışı çökerse reklamı tamamen kesmiyoruz; sadece
        // kişiselleştirmeden gösteriyoruz.
        console.log("Rıza bilgisi alınamadı:", e?.message);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Expo Go'da (veya native modül içermeyen bir build'de) reklam alanını
  // sessizce boş bırak — uygulamanın geri kalanı normal çalışsın.
  if (!reklamAcik || !Ads?.BannerAd || !reklamIstenebilir) return null;

  const { BannerAd, BannerAdSize } = Ads;

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={bannerId ?? adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: !kisisellestirilmis }}
        onAdFailedToLoad={(err) => console.log("Reklam yüklenemedi:", err?.message)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    marginBottom: Platform.OS === "ios" ? 8 : 0,
  },
});
