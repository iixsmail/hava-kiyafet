import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../components/GradientBackground";
import * as haptik from "../ui/haptics";
import { useNotifications } from "../context/NotificationContext";
import { usePremium } from "../context/PremiumContext";
import { useWardrobe } from "../context/WardrobeContext";

const ALTIN = "#FFC65C";
const GRADIENT = ["#101A2E", "#1B2C4D", "#2A4272"];

/**
 * İlk açılış tanıtımı.
 *
 * Üç amacı var, sırası önemli:
 *   1. Uygulamanın ne yaptığını 10 saniyede anlatmak
 *   2. Bildirim iznini DOĞRU ANDA istemek — sistem penceresini bağlamsız
 *      açmak en yüksek ret oranını üretiyor; ne işe yaradığını anlattıktan
 *      sonra sormak kabul oranını belirgin artırıyor
 *   3. Premium'u tanıtmak — ama kapatılamaz bir duvar olarak DEĞİL
 *
 * Son sayfada "Şimdilik ücretsiz devam et" her zaman görünür durumda.
 * Kapatılamayan ya da gizlenmiş çıkışlı bir tanıtım hem kullanıcıyı kaçırır
 * hem Play'in "yanıltıcı abonelik akışı" maddesine girer.
 */
export default function OnboardingScreen({ onBitir, onNavigatePremium }) {
  const insets = useSafeAreaInsets();
  const { izinIste, destekleniyor } = useNotifications();
  const { planlar, varsayilanPlan } = usePremium();
  const { yapayZekaAcik } = useWardrobe();

  const [sayfa, setSayfa] = useState(0);
  const [izinSoruldu, setIzinSoruldu] = useState(false);
  const kaydirici = useRef(null);

  // Sayfa genişliğini KABIN KENDİSİNDEN ölçüyoruz.
  //
  // Önce Dimensions.get("window") kullanıyordum ama o değer modül
  // yüklenirken bir kez okunuyor: pencere sonradan yeniden boyutlanırsa
  // (web, katlanabilir cihaz, çoklu pencere) sayfa genişliği bayat kalıyor
  // ve scrollTo yanlış konuma gidiyor — göstergeler ilerliyor ama içerik
  // yerinde kalıyordu. onLayout her zaman güncel genişliği veriyor.
  const [genislik, setGenislik] = useState(0);

  // Tanıtım yalnızca uygulamada GERÇEKTEN olan şeyleri anlatıyor: olmayan
  // bir özelliği vaat etmek, kullanıcı onu arayınca güvensizlik yaratır.
  // Gardırop sayfasının metni bu yüzden yapay zekanın açık olup olmamasına
  // göre değişiyor.
  const sayfalar = [
    {
      ikon: "🌤️",
      baslik: "Havayı değil,\nne giyeceğini söyler",
      metin:
        "Sıcaklık, çiy noktası, rüzgar ve yağışı birlikte değerlendirip somut öneri üretir: “Rüzgarlı, ince bir rüzgarlık işine yarar.”",
      altlar: ["Saatlik ve 10 günlük tahmin", "8 detaylı ölçüm kartı", "Çevrimdışı da çalışır"],
    },
    // Gardırop HER İKİ durumda da tanıtılıyor, yalnızca vaadi değişiyor.
    //
    // Önceden bu bölüm tamamen yapay zekaya bağlıydı ve sunucu kapalıyken
    // tanıtımda gardıroptan hiç söz edilmiyordu. Oysa özellik çalışıyor:
    // kullanıcı parçalarını işaretliyor, cihaz içi motor havaya göre kombin
    // kuruyor. Uygulamanın en ayırt edici tarafını görünmez bırakmak,
    // kullanıcının onu hiç keşfetmemesi demekti.
    yapayZekaAcik
      ? {
          ikon: "👔",
          baslik: "Kendi dolabından\nkombin önerir",
          metin:
            "Kıyafetlerinin fotoğrafını bir kez tanır; sonra her gün havaya en uygun kombini senin gardırobundan seçer.",
          altlar: ["Fotoğraf cihazında kalır", "Neden o parça, açıklar", "Tek dokunuşla düzeltirsin"],
        }
      : {
          ikon: "👔",
          baslik: "Kendi dolabından\nkombin önerir",
          metin:
            "Sahip olduğun parçaları bir kez işaretle; her sabah o günün havasına uyan kombini gardırobundan seçelim.",
          altlar: ["Kurulumu 30 saniye", "Neden o parça, açıklar", "Her şey cihazında kalır"],
        },
    {
      ikon: "🔔",
      baslik: "Sabah hazırlanırken\nhatırlatır",
      metin:
        "Her sabah seçtiğin saatte günün havasını ve kıyafet önerini gönderir. Tamamen cihazında üretilir, internet gerekmez.",
      altlar: ["Saatini sen seçersin", "İstediğin zaman kapatırsın"],
      izinSayfasi: true,
    },
    {
      ikon: "✨",
      baslik: "Premium ile\ndaha fazlası",
      metin: "İstersen ücretsiz devam et — temel özelliklerin hepsi açık.",
      premiumSayfasi: true,
    },
  ];

  const sonSayfa = sayfa === sayfalar.length - 1;

  // Sayfa numarası YALNIZCA gerçek kaydırma konumundan türetiliyor
  // (aşağıdaki onScroll). Burada ayrıca setSayfa çağırmıyoruz.
  //
  // Sebebi: önce iyimser davranıp state'i elle ilerletiyordum. Kaydırma
  // herhangi bir sebeple gerçekleşmezse gösterge "3. sayfa" derken içerik
  // 1. sayfada kalıyordu — kullanıcı için bozuk uygulama demek. Tek kaynak
  // gerçek konum olunca gösterge ile içerik ASLA çelişemiyor.
  const gecisYap = (hedef) => {
    if (hedef < 0 || hedef >= sayfalar.length || genislik <= 0) return;
    haptik.dokunus();
    kaydirici.current?.scrollTo({ x: hedef * genislik, animated: true });
  };

  const ileri = async () => {
    const mevcut = sayfalar[sayfa];

    // Bildirim sayfasından ilerlerken izni SOR. Kullanıcı ne işe yaradığını
    // okuduktan hemen sonra soruluyor — en yüksek kabul anı burası.
    if (mevcut?.izinSayfasi && destekleniyor && !izinSoruldu) {
      setIzinSoruldu(true);
      const verildi = await izinIste();
      verildi ? haptik.basari() : haptik.dokunus();
    }

    if (sonSayfa) {
      haptik.basari();
      onBitir();
      return;
    }
    gecisYap(sayfa + 1);
  };

  return (
    <View style={styles.kok}>
      <GradientBackground colors={GRADIENT} />

      <View style={[styles.ustBar, { paddingTop: insets.top + 12 }]}>
        {/* Atla her sayfada görünür — kapatılamayan tanıtım kullanıcıyı kaçırır. */}
        <TouchableOpacity
          onPress={() => {
            haptik.dokunus();
            onBitir();
          }}
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel="Tanıtımı atla"
        >
          <Text style={styles.atla}>Atla</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={kaydirici}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onLayout={(e) => setGenislik(e.nativeEvent.layout.width)}
        onScroll={(e) => {
          if (genislik <= 0) return;
          const yeni = Math.round(e.nativeEvent.contentOffset.x / genislik);
          const sinirli = Math.max(0, Math.min(sayfalar.length - 1, yeni));
          if (sinirli !== sayfa) setSayfa(sinirli);
        }}
        style={styles.kaydirici}
      >
        {sayfalar.map((s, i) => (
          <View key={i} style={[styles.sayfa, genislik > 0 && { width: genislik }]}>
            <Text style={styles.ikon}>{s.ikon}</Text>
            <Text style={styles.baslik}>{s.baslik}</Text>
            <Text style={styles.metin}>{s.metin}</Text>

            {s.altlar && (
              <View style={styles.altListe}>
                {s.altlar.map((a) => (
                  <View key={a} style={styles.altSatir}>
                    <Text style={styles.altTik}>✓</Text>
                    <Text style={styles.altMetin}>{a}</Text>
                  </View>
                ))}
              </View>
            )}

            {s.premiumSayfasi && (
              <PremiumOnizleme
                planlar={planlar}
                varsayilan={varsayilanPlan}
                yapayZekaAcik={yapayZekaAcik}
              />
            )}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.altBar, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.noktalar}>
          {sayfalar.map((_, i) => (
            <View key={i} style={[styles.nokta, i === sayfa && styles.noktaAktif]} />
          ))}
        </View>

        <TouchableOpacity
          style={styles.anaButon}
          onPress={ileri}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={sonSayfa ? "Başla" : "Devam et"}
        >
          <Text style={styles.anaButonMetin}>
            {sonSayfa ? "Ücretsiz başla" : "Devam"}
          </Text>
        </TouchableOpacity>

        {sonSayfa && (
          <TouchableOpacity
            style={styles.premiumButon}
            onPress={() => {
              haptik.dokunus();
              onBitir();
              onNavigatePremium?.();
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Premium planları incele"
          >
            <Text style={styles.premiumButonMetin}>Premium planları incele</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/** Son sayfadaki premium özeti — fiyat varsa Play'den, yoksa hiç iddia yok. */
function PremiumOnizleme({ planlar, varsayilan, yapayZekaAcik }) {
  const parlama = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const d = Animated.loop(
      Animated.sequence([
        Animated.timing(parlama, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(parlama, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    d.start();
    return () => d.stop();
  }, [parlama]);

  const opaklik = parlama.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  // Yağış ve ani soğuma uyarıları ÜCRETSİZE AÇILDI; burada Premium avantajı
  // diye saymak, kullanıcının zaten sahip olduğu şeyi satmak olurdu.
  const avantajlar = [
    "Reklamsız kullanım",
    "10 günlük tahminin tamamı",
    "Saat saat ne giymeli",
    ...(yapayZekaAcik ? ["Günde 20 yapay zeka kombini"] : ["Tüm kıyafet önerileri"]),
  ];

  return (
    <View style={styles.premiumKutu}>
      {avantajlar.map((a) => (
        <View key={a} style={styles.altSatir}>
          <Animated.Text style={[styles.premiumTik, { opacity: opaklik }]}>✦</Animated.Text>
          <Text style={styles.altMetin}>{a}</Text>
        </View>
      ))}

      {/* Fiyat YALNIZCA Play'den geldiyse gösteriliyor. Yer tutucu bir rakam
          yazmak, gerçek fiyat farklı çıktığında yanıltıcı beyan olurdu. */}
      {varsayilan?.fiyat ? (
        <Text style={styles.premiumFiyat}>
          {varsayilan.donemMetni.sifat} {varsayilan.fiyat}
          {varsayilan.tasarrufYuzde > 0 ? ` · %${varsayilan.tasarrufYuzde} avantaj` : ""}
        </Text>
      ) : planlar.length === 0 ? (
        <Text style={styles.premiumFiyatBos}>Planlar mağazadan yüklenecek</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  kok: { flex: 1, backgroundColor: "#101A2E" },
  ustBar: { paddingHorizontal: 20, alignItems: "flex-end" },
  atla: { color: "rgba(255,255,255,0.6)", fontSize: 15, fontWeight: "600" },

  kaydirici: { flex: 1 },
  sayfa: { paddingHorizontal: 32, alignItems: "center", justifyContent: "center", flex: 1 },
  ikon: { fontSize: 68, marginBottom: 26 },
  baslik: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 37,
    letterSpacing: -0.5,
  },
  metin: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 14,
  },

  altListe: { marginTop: 26, gap: 10, alignSelf: "stretch" },
  altSatir: { flexDirection: "row", alignItems: "center", gap: 10 },
  altTik: { color: ALTIN, fontSize: 14, fontWeight: "800" },
  altMetin: { color: "rgba(255,255,255,0.86)", fontSize: 14, flex: 1 },

  premiumKutu: {
    marginTop: 24,
    alignSelf: "stretch",
    gap: 11,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,198,92,0.35)",
    borderRadius: 20,
    padding: 18,
  },
  premiumTik: { color: ALTIN, fontSize: 14, fontWeight: "800" },
  premiumFiyat: {
    color: ALTIN,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 6,
    textAlign: "center",
  },
  premiumFiyatBos: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
  },

  altBar: { paddingHorizontal: 26, gap: 14 },
  noktalar: { flexDirection: "row", justifyContent: "center", gap: 7, marginBottom: 4 },
  nokta: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  noktaAktif: { backgroundColor: ALTIN, width: 20 },

  anaButon: { backgroundColor: ALTIN, borderRadius: 18, paddingVertical: 17, alignItems: "center" },
  anaButonMetin: { color: "#241A4D", fontSize: 16, fontWeight: "800" },
  premiumButon: { alignItems: "center", paddingVertical: 6 },
  premiumButonMetin: { color: "rgba(255,255,255,0.75)", fontSize: 14, fontWeight: "600" },
});
