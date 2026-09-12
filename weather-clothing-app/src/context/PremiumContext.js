import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { playJetonuKaydet } from "../api/stylist";

// expo-iap native kod içerir ve Expo Go'da MEVCUT DEĞİLDİR.
// Dosyanın en üstünde normal `import` ile çağırırsak modül yüklenirken
// hata fırlatır ve TÜM UYGULAMA açılmaz ("App entry not found").
// Bu yüzden korumalı (lazy) require kullanıyoruz.
let IAP = null;
try {
  IAP = require("expo-iap");
} catch (e) {
  IAP = null;
}

// Play Console > Monetization > Subscriptions kısmında bu ID ile bir abonelik
// oluşturup fiyatını 250 TL / yıl olarak ayarlaman gerekiyor. Fiyat mağazada
// (kodda değil) Play Console tarafında belirlenir.
export const PREMIUM_SUBSCRIPTION_ID = "premium_yillik";

const PREMIUM_ONBELLEK = "premiumDurumu.v1";

// Premium durumu neden yerelde de saklanıyor: uygulama her açılışta Play'e
// soruyor, ama o çağrı internet gerektiriyor. Önbellek olmadan, parasını ödemiş
// bir kullanıcı uçakta uygulamayı açtığında REKLAM görüyordu. Önbellek yalnızca
// arayüzü sürüyor — gerçek yetki hâlâ Play'de ve sunucu tarafında.
async function premiumDurumunuOku() {
  try {
    return (await AsyncStorage.getItem(PREMIUM_ONBELLEK)) === "1";
  } catch {
    return false;
  }
}

async function premiumDurumunuYaz(deger) {
  try {
    await AsyncStorage.setItem(PREMIUM_ONBELLEK, deger ? "1" : "0");
  } catch (e) {
    console.log("Premium durumu yazılamadı:", e?.message);
  }
}

const PremiumContext = createContext(null);

export const DONEM_METNI = {
  yil: { sifat: "Yıllık", sik: "yılda bir", kisa: "yıl", tekil: "yıl" },
  ay: { sifat: "Aylık", sik: "ayda bir", kisa: "ay", tekil: "ay" },
  hafta: { sifat: "Haftalık", sik: "haftada bir", kisa: "hafta", tekil: "hafta" },
};

// ISO 8601 süre ("P1M", "P1Y") -> iç anahtarımız.
function donemAnahtari(sure) {
  if (typeof sure !== "string") return null;
  if (/^P\d*Y$/.test(sure)) return "yil";
  if (/^P\d*M$/.test(sure)) return "ay";
  if (/^P\d*W$/.test(sure)) return "hafta";
  return null;
}

// Bir dönemin yıllık kaç kez faturalandığı — planları kıyaslamak için.
const YILLIK_ADET = { yil: 1, ay: 12, hafta: 52 };

// Ücretli (tanıtım olmayan) fiyat aşaması. Deneme süresi tanımlanmışsa ilk
// aşama 0 TL olur; kullanıcıya "bedava" yazmak yanlış olurdu.
function ucretliAsama(teklif) {
  const asamalar = teklif?.pricingPhasesAndroid?.pricingPhaseList ?? [];
  return asamalar.find((a) => a?.priceAmountMicros !== "0") ?? asamalar[0] ?? null;
}

/**
 * Play'deki ürünün TÜM base plan'larını uygulamanın anlayacağı plan
 * listesine çevirir.
 *
 * Play'de doğru model tek bir abonelik ÜRÜNÜ ve altında birden çok BASE
 * PLAN'dır (aylık, yıllık). Her base plan ayrı bir `subscriptionOffer` olarak
 * geliyor ve kendi `offerTokenAndroid`'i var — satın alırken hangi planı
 * seçtiyse ONUN token'ı gönderilmek zorunda, yoksa Play yanlış planı açar.
 *
 * Fiyat, dönem ve tasarruf oranının tamamı Play'den türetiliyor; hiçbiri
 * koda gömülü değil. Console'da fiyatı değiştirdiğinde uygulama kendiliğinden
 * doğru rakamı gösterir — sabit yazılsaydı yanlış fiyat göstermek Play
 * politikası ihlali olurdu.
 */
function planlariCikar(urun) {
  const teklifler = urun?.subscriptionOffers ?? [];
  const planlar = [];

  for (const teklif of teklifler) {
    const asama = ucretliAsama(teklif);
    const jeton = teklif?.offerTokenAndroid;
    const donem = donemAnahtari(asama?.billingPeriod);
    if (!jeton || !donem) continue;

    const mikro = Number(asama?.priceAmountMicros);
    planlar.push({
      jeton,
      donem,
      donemMetni: DONEM_METNI[donem],
      fiyat: asama?.formattedPrice ?? teklif?.displayPrice ?? null,
      // Yıllık maliyet, planları adil kıyaslamanın tek yolu.
      yillikMaliyet: Number.isFinite(mikro) ? (mikro / 1e6) * YILLIK_ADET[donem] : null,
      paraBirimi: asama?.priceCurrencyCode ?? null,
    });
  }

  // En uzun dönem üstte: yıllık plan hem daha avantajlı hem bizim için daha
  // değerli, kullanıcı önce onu görsün.
  planlar.sort((a, b) => YILLIK_ADET[a.donem] - YILLIK_ADET[b.donem]);

  // Tasarruf oranı: en pahalı yıllık maliyete göre. Rakamı biz uydurmuyoruz,
  // Play'deki gerçek fiyatlardan hesaplıyoruz.
  const maliyetler = planlar.map((p) => p.yillikMaliyet).filter((v) => Number.isFinite(v));
  const enPahali = maliyetler.length ? Math.max(...maliyetler) : null;

  for (const p of planlar) {
    p.tasarrufYuzde =
      enPahali && p.yillikMaliyet && enPahali > p.yillikMaliyet
        ? Math.round((1 - p.yillikMaliyet / enPahali) * 100)
        : 0;
    // "En popüler" rozetini en çok tasarruf ettiren plana veriyoruz —
    // pazarlama sezgisiyle değil, hesaplanan değerle.
    p.populer = false;
  }
  const enIyi = planlar.reduce(
    (a, b) => ((b.tasarrufYuzde ?? 0) > (a?.tasarrufYuzde ?? -1) ? b : a),
    null
  );
  if (enIyi && enIyi.tasarrufYuzde > 0) enIyi.populer = true;

  return planlar;
}

export function PremiumProvider({ children }) {
  const [isPremium, setIsPremium] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [products, setProducts] = useState([]); // Play Console'dan gelen gerçek fiyat/para birimi burada
  const [iapReady, setIapReady] = useState(false);
  const purchaseUpdateSub = useRef(null);
  const purchaseErrorSub = useRef(null);

  // Play'e sormadan ÖNCE önbellekten oku: aksi halde premium kullanıcı
  // uygulamayı her açtığında, Play cevap verene kadar reklam görüyor.
  useEffect(() => {
    let mounted = true;
    premiumDurumunuOku().then((v) => {
      if (mounted && v) setIsPremium(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    // Expo Go: IAP native modülü yok, satın alma devre dışı ama uygulama
    // normal çalışmaya devam eder.
    if (!IAP) return;

    let mounted = true;

    async function setupIAP() {
      try {
        await IAP.initConnection();
        if (!mounted) return;

        // ÖNEMLİ: Dinleyiciler ancak bağlantı KURULDUKTAN sonra eklenir.
        // Play Billing yoksa (emülatör, Play Store'suz cihaz) bu çağrılar
        // "Billing is unavailable" şeklinde yakalanamayan bir hataya yol
        // açıyordu; buraya taşıyarak o ortamlarda hiç çağrılmamalarını
        // sağlıyoruz.
        purchaseUpdateSub.current = IAP.purchaseUpdatedListener(async (purchase) => {
          try {
            await IAP.finishTransaction({ purchase, isConsumable: false });
            // Satın alma jetonunu SAKLIYORUZ. Stil sunucusu premium'u bu
            // jetonla Google Play'e sorarak doğruluyor — jetonu kaydetmezsek
            // sunucu tarafında herkes ücretsiz kullanıcı görünür ve premium
            // kredileri hiç açılmaz.
            const jeton = purchase?.purchaseToken ?? purchase?.purchaseTokenAndroid;
            if (jeton) await playJetonuKaydet(jeton);
            await premiumDurumunuYaz(true);
            setIsPremium(true);
          } catch (err) {
            console.log("Satın alma tamamlanırken hata:", err?.message);
          } finally {
            setPurchasing(false);
          }
        });

        purchaseErrorSub.current = IAP.purchaseErrorListener((error) => {
          console.log("Satın alma hatası:", error?.message);
          setPurchasing(false);
        });

        // Aktif abonelik var mı? getActiveSubscriptions kullanıyoruz çünkü
        // hasActiveSubscriptions sadece true/false dönüyor; bize satın alma
        // JETONU da lazım — sunucu premium'u onunla doğruluyor. Cihaz
        // değiştiren veya uygulamayı silip kuran kullanıcı için tek yol bu.
        const abonelikler = await IAP.getActiveSubscriptions([PREMIUM_SUBSCRIPTION_ID]);
        const aktifAbonelik = Array.isArray(abonelikler)
          ? abonelikler.find((a) => a?.isActive)
          : null;

        if (mounted) {
          if (aktifAbonelik) {
            const jeton = aktifAbonelik.purchaseToken ?? aktifAbonelik.purchaseTokenAndroid;
            if (jeton) await playJetonuKaydet(jeton);
            await premiumDurumunuYaz(true);
            setIsPremium(true);
          } else {
            // Play "abonelik yok" diyorsa önbelleği de düzeltiyoruz; iptal eden
            // kullanıcı sonsuza kadar premium kalmasın.
            await premiumDurumunuYaz(false);
            setIsPremium(false);
          }
        }

        // Play Console'da tanımladığın gerçek fiyat/teklif bilgisini çek
        const urunler = await IAP.fetchProducts({
          skus: [PREMIUM_SUBSCRIPTION_ID],
          type: "subs",
        });
        if (mounted) setProducts(Array.isArray(urunler) ? urunler : []);

        if (mounted) setIapReady(true);
      } catch (err) {
        // Expo Go'da, emülatörde veya abonelik Play Console'da henüz
        // "aktif" değilse burası hata verir — BEKLENEN durumdur.
        console.log("IAP başlatılamadı:", err?.message);
      }
    }

    setupIAP().catch((e) => console.log("IAP kurulumunda beklenmeyen hata:", e?.message));

    return () => {
      mounted = false;
      purchaseUpdateSub.current?.remove?.();
      purchaseErrorSub.current?.remove?.();
      // endConnection() Promise döndürür — try/catch reddi yakalayamaz,
      // bu yüzden ayrıca .catch() gerekiyor.
      try {
        Promise.resolve(IAP.endConnection()).catch(() => {});
      } catch (e) {
        /* yoksay */
      }
    };
  }, []);

  // Planların TAMAMI Play'den türetiliyor — fiyat, dönem, tasarruf oranı.
  // Play'e bağlanamadıysak (Expo Go, emülatör) liste boş kalıyor ve arayüz
  // hiçbir fiyat iddiasında bulunmuyor; satın alma butonu da o ortamlarda
  // zaten çalışmıyor, yani kullanıcı yanlış fiyata dayanarak bir şey
  // satın alamaz.
  const planlar = useMemo(() => planlariCikar(products[0]), [products]);

  // Geriye dönük uyumluluk: tek plan bekleyen eski ekranlar için.
  const varsayilanPlan = planlar.find((p) => p.populer) ?? planlar[0] ?? null;
  const displayPrice = varsayilanPlan?.fiyat ?? "—";
  const donem = varsayilanPlan?.donemMetni ?? null;

  const purchasePremium = useCallback(async (offerToken) => {
    if (!IAP || !iapReady) {
      return {
        success: false,
        error:
          "Satın alma sistemi bu ortamda kullanılamıyor. Gerçek satın almayı test etmek için Play Store'dan (kapalı test) indirilen sürümü kullanman gerekiyor.",
      };
    }

    // Kullanıcının SEÇTİĞİ planın token'ı gönderilmek zorunda; ilk teklifi
    // sabit göndermek, kullanıcı yıllığı seçse bile aylık plana abone
    // etmesine yol açardı.
    const secilen = planlar.find((p) => p.jeton === offerToken) ?? planlar[0];

    if (!secilen?.jeton) {
      return {
        success: false,
        error: `Abonelik planı bulunamadı. Play Console'da '${PREMIUM_SUBSCRIPTION_ID}' aboneliğinin ve en az bir base plan'in AKTİF olduğundan emin ol.`,
      };
    }

    setPurchasing(true);
    try {
      // Bu çağrı GERÇEK Google Play ödeme ekranını açar. Kullanıcı burada
      // onaylamadan hiçbir şey satın alınmaz.
      // Sonuç purchaseUpdatedListener üzerinden asenkron gelir — dönen
      // değere güvenilmez (expo-iap olay tabanlı çalışır).
      await IAP.requestPurchase({
        type: "subs",
        request: {
          google: {
            skus: [PREMIUM_SUBSCRIPTION_ID],
            subscriptionOffers: [
              { sku: PREMIUM_SUBSCRIPTION_ID, offerToken: secilen.jeton },
            ],
          },
        },
      });
      return { success: true, pending: true, plan: secilen };
    } catch (err) {
      setPurchasing(false);
      return { success: false, error: err?.message || "Satın alma başlatılamadı." };
    }
  }, [iapReady, planlar]);

  const restorePurchases = useCallback(async () => {
    if (!IAP) {
      return { success: false, error: "Satın alma sistemi bu ortamda yok." };
    }
    try {
      // Buradan da jetonu alıyoruz: "geri yükle" diyen kullanıcı genelde
      // cihaz değiştirmiş oluyor, sunucudaki premium hakkı ancak jeton
      // kaydedilirse açılır.
      const abonelikler = await IAP.getActiveSubscriptions([PREMIUM_SUBSCRIPTION_ID]);
      const aktifAbonelik = Array.isArray(abonelikler)
        ? abonelikler.find((a) => a?.isActive)
        : null;

      if (aktifAbonelik) {
        const jeton = aktifAbonelik.purchaseToken ?? aktifAbonelik.purchaseTokenAndroid;
        if (jeton) await playJetonuKaydet(jeton);
      }
      await premiumDurumunuYaz(!!aktifAbonelik);
      setIsPremium(!!aktifAbonelik);
      return { success: true, restored: !!aktifAbonelik };
    } catch (err) {
      return { success: false, error: err?.message || "Geri yükleme başarısız oldu." };
    }
  }, []);

  return (
    <PremiumContext.Provider
      value={{
        isPremium,
        purchasing,
        purchasePremium,
        restorePurchases,
        setIsPremium,
        planlar,
        varsayilanPlan,
        displayPrice,
        donem,
        iapReady,
      }}
    >
      {children}
    </PremiumContext.Provider>
  );
}

export function usePremium() {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error("usePremium, PremiumProvider içinde kullanılmalı.");
  return ctx;
}
