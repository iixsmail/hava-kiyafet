import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../components/GradientBackground";
import TagConfirmModal from "../components/TagConfirmModal";
import PaywallSheet from "../components/PaywallSheet";
import { useAds } from "../context/AdsContext";
import { GardiropIskeleti } from "../ui/Skeleton";
import * as haptik from "../ui/haptics";
import ClothingSilhouette from "../components/ClothingSilhouette";
import { getWeatherTheme, VARSAYILAN_TEMA } from "../theme/weatherTheme";
import { useWeather } from "../context/WeatherContext";
import { useWardrobe } from "../context/WardrobeContext";

// Kategori sırası kasıtlı: kullanıcı gardırobunu bu sırayla kuruyor ve
// kombin de bu sırayla giyiliyor.
const KATEGORILER = [
  { anahtar: "ust", ad: "Üst", ikon: "👕" },
  { anahtar: "dis", ad: "Dış giyim", ikon: "🧥" },
  { anahtar: "alt", ad: "Alt", ikon: "👖" },
  { anahtar: "ayakkabi", ad: "Ayakkabı", ikon: "👟" },
  { anahtar: "aksesuar", ad: "Aksesuar", ikon: "🧣" },
  { anahtar: "diger", ad: "Diğer", ikon: "📦" },
];

/** Silinirken küçülüp solan kart. */
function ParcaKarti({ parca, uri, theme, onSil }) {
  const olcek = useRef(new Animated.Value(1)).current;

  const silAnimasyonlu = () => {
    // Animasyonu silme işleminden ÖNCE oynatıyoruz: kart aniden kaybolmak
    // yerine küçülerek gidiyor, kullanıcı ne olduğunu görüyor.
    Animated.timing(olcek, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => onSil(parca.id));
  };

  const onayla = () => {
    haptik.uyari();
    Alert.alert("Parçayı sil", `"${parca.ad}" gardırobundan kaldırılsın mı?`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: () => {
          haptik.agir();
          silAnimasyonlu();
        },
      },
    ]);
  };

  return (
    <Animated.View
      style={[
        styles.kartSarmal,
        { transform: [{ scale: olcek }], opacity: olcek },
      ]}
    >
      <TouchableOpacity
        style={[styles.kart, { borderColor: theme.cardBorder }]}
        onLongPress={onayla}
        delayLongPress={320}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${parca.ad}. Silmek için basılı tut.`}
      >
        {/* Katalogdan eklenen parçaların fotoğrafı yok; boş kutu yerine
            katmanına göre siluet çiziyoruz. */}
        {uri ? (
          <Image source={{ uri }} style={styles.kartGorsel} />
        ) : (
          <View style={styles.kartSiluet}>
            <ClothingSilhouette katman={parca.katman} tur={parca.tur} size={52} opak={0.5} />
          </View>
        )}
        <View style={styles.kartAlt}>
          <Text style={styles.kartAd} numberOfLines={1}>
            {parca.ad}
          </Text>
          <View style={styles.kartMeta}>
            {parca.minC != null && parca.maxC != null && (
              <Text style={styles.kartAralik}>
                {Math.round(parca.minC)}°–{Math.round(parca.maxC)}°
              </Text>
            )}
            {parca.suGecirmez && <Text style={styles.kartRozet}>💧</Text>}
          </View>
        </View>
        {!parca.etiketlendi && (
          <View style={styles.bekliyorRozet}>
            <Text style={styles.bekliyorMetin}>!</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function WardrobeScreen({ onBack, onNavigateOutfit, onNavigatePremium, onNavigateQuickSetup }) {
  const insets = useSafeAreaInsets();
  const { weatherData } = useWeather();
  const {
    parcalar,
    yukleniyor,
    ekleniyor,
    kredi,
    parcaEkle,
    parcaSil,
    gorselUri,
    yapayZekaAcik,
    bekleyenParca,
    parcaOnayla,
    parcaVazgec,
    eksikler,
  } = useWardrobe();
  const { gecisDene } = useAds();
  const [mesaj, setMesaj] = useState(null);
  const [kilitli, setKilitli] = useState(null);
  // Varsayılan, yapay zekanın AÇIK olup olmamasına bakıyor.
  //
  // `false` sabit bırakılınca, ekleme akışından geçmeden gelen parçalar
  // (açılışta kurtarılan yarım kalmış etiketleme) "TANINDI" rozetiyle
  // görünüyordu — oysa yapay zeka kapalıyken hiçbir tanıma yapılmamış olur.
  const [elleEtiket, setElleEtiket] = useState(!yapayZekaAcik);

  const current = weatherData?.current;
  const theme = useMemo(
    () => (current ? getWeatherTheme(current.weather_code, current.is_day) : VARSAYILAN_TEMA),
    [current]
  );

  const ekle = async (kaynak) => {
    setMesaj(null);
    haptik.dokunus();
    const sonuc = await parcaEkle(kaynak);
    if (sonuc.iptal) return;

    // Onay modalındaki rozet buna bakıyor. Yapay zeka kapalıyken ya da
    // etiketleme başarısız olduğunda değerler tahmini; "TANINDI" demek
    // kullanıcıya yapılmamış bir işi yapılmış gibi göstermek olurdu.
    setElleEtiket(!!sonuc.elle);

    // Ücretsiz sınır doldu: mini paywall. Kontrol fotoğraf çekilmeden ÖNCE
    // yapılıyor (WardrobeContext), yani kullanıcı boşuna uğraşmıyor.
    if (sonuc.kilitli) {
      haptik.uyari();
      setKilitli(sonuc.kilitli);
      return;
    }

    if (!sonuc.ok) {
      haptik.hata();
      setMesaj(sonuc.hata);
      return;
    }

    // Geçiş reklamı parça eklendikten SONRA — onay modalı kapanınca
    // gösterilmesi için değil, sayaç ilerlesin diye burada tetikleniyor.
    // Frekans: her 3 eklemede 1, iki reklam arası en az 90 sn (AdsContext).
    gecisDene("parcaEkleme");
  };

  const kameradanEkle = () => {
    // Kılavuz uyarısı: en sık hata, kıyafetin giyilmiş hâlde veya
    // karmakarışık bir zeminde çekilmesi. Model o zaman ya yanlış parçayı
    // etiketliyor ya da hiç bulamıyor.
    haptik.dokunus();
    Alert.alert(
      "Fotoğraf ipucu",
      "Kıyafeti düz bir zemine serip TEK BAŞINA çek. Üzerinde giyili olmasın, kadrajda başka eşya bulunmasın — tanıma böyle çok daha isabetli oluyor.",
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Kamerayı aç", onPress: () => ekle("kamera") },
      ]
    );
  };

  const gruplar = useMemo(() => {
    const g = {};
    for (const p of parcalar) {
      const k = KATEGORILER.some((c) => c.anahtar === p.katman) ? p.katman : "diger";
      (g[k] ||= []).push(p);
    }
    return g;
  }, [parcalar]);

  const etiketliSayi = parcalar.filter((p) => p.etiketlendi).length;

  return (
    <View style={styles.kok}>
      <GradientBackground colors={theme.gradient} />
      <ScrollView
        contentContainerStyle={[
          styles.icerik,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.ustBar}>
          <TouchableOpacity
            onPress={() => {
              haptik.dokunus();
              onBack();
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Geri"
          >
            <Text style={[styles.geri, { color: theme.textSecondary }]}>‹ Geri</Text>
          </TouchableOpacity>
          {kredi && (
            <View style={[styles.krediRozet, { borderColor: theme.cardBorder }]}>
              <Text style={[styles.krediMetin, { color: theme.textSecondary }]}>
                {kredi.premium
                  ? "Premium"
                  : `${kredi.etiketKalan} ekleme · ${kredi.etiketBirim === "gun" ? "bugün" : "bu ay"}`}
              </Text>
            </View>
          )}
        </View>

        <Text style={[styles.baslik, { color: theme.textPrimary }]}>Gardırobum</Text>
        <Text style={[styles.altBaslik, { color: theme.textSecondary }]}>
          {parcalar.length === 0
            ? "Dolabındaki parçaları ekle, havaya göre kombin önerelim."
            : `${parcalar.length} parça${etiketliSayi < parcalar.length ? ` · ${parcalar.length - etiketliSayi} tanesi onay bekliyor` : ""}`}
        </Text>

        {/* Hızlı kurulum fotoğraf seçeneklerinin ÜSTÜNDE ve vurgulu: asıl
            engel fotoğraf çekme angaryasıydı, kolay yol önce görünmeli. */}
        <TouchableOpacity
          style={styles.hizliButon}
          onPress={() => {
            haptik.dokunus();
            onNavigateQuickSetup?.();
          }}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Hazır listeden seç — fotoğrafsız, 30 saniye"
        >
          <Text style={styles.hizliIkon}>⚡</Text>
          <View style={styles.hizliMetinKutu}>
            <Text style={styles.hizliBaslik}>Hazır listeden seç</Text>
            <Text style={styles.hizliAlt}>Fotoğraf gerekmez · 30 saniye</Text>
          </View>
          <Text style={styles.hizliOk}>→</Text>
        </TouchableOpacity>

        <Text style={[styles.ayiracMetin, { color: theme.textMuted }]}>ya da fotoğraf ekle</Text>

        <View style={styles.butonSatiri}>
          <TouchableOpacity
            style={[styles.ekleButon, { borderColor: theme.cardBorder }]}
            onPress={kameradanEkle}
            disabled={ekleniyor}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Fotoğraf çek"
          >
            <Text style={styles.ekleIkon}>📷</Text>
            <Text style={styles.ekleMetin}>Fotoğraf çek</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ekleButon, { borderColor: theme.cardBorder }]}
            onPress={() => ekle("galeri")}
            disabled={ekleniyor}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Galeriden seç"
          >
            <Text style={styles.ekleIkon}>🖼️</Text>
            <Text style={styles.ekleMetin}>Galeriden seç</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.ipucuKart, { borderColor: theme.cardBorder }]}>
          <Text style={styles.ipucuIkon}>💡</Text>
          <Text style={[styles.ipucuMetin, { color: theme.textMuted }]}>
            Kıyafeti düz zeminde, tek başına çek. Üzerinde giyili olmasın —
            tanıma böyle çok daha isabetli.
          </Text>
        </View>

        {ekleniyor && (
          <View style={[styles.durumKutu, { borderColor: theme.cardBorder }]}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={[styles.durumMetin, { color: theme.textSecondary }]}>
              {yapayZekaAcik ? "Parça tanınıyor..." : "Ekleniyor..."}
            </Text>
          </View>
        )}

        {mesaj && (
          <View style={styles.hataKutu}>
            <Text style={styles.hataMetin}>{mesaj}</Text>
          </View>
        )}

        {yukleniyor ? (
          <View style={{ marginTop: 24 }}>
            <GardiropIskeleti />
          </View>
        ) : parcalar.length === 0 ? (
          <View style={[styles.bosKutu, { borderColor: theme.cardBorder }]}>
            <Text style={styles.bosIkon}>🧺</Text>
            <Text style={[styles.bosBaslik, { color: theme.textPrimary }]}>Gardırobun boş</Text>
            <Text style={[styles.bosMetin, { color: theme.textSecondary }]}>
              En hızlı yol yukarıdaki hazır liste: sahip olduklarını işaretle,
              gardırobun bir dakikadan kısa sürede hazır olsun. Dilediğin
              parçanın fotoğrafını sonradan ekleyebilirsin.
            </Text>
          </View>
        ) : (
          <>
            {KATEGORILER.filter((c) => gruplar[c.anahtar]?.length).map((c) => (
              <View key={c.anahtar} style={styles.grup}>
                <View style={styles.grupBaslikSatiri}>
                  <Text style={styles.grupIkon}>{c.ikon}</Text>
                  <Text style={[styles.grupBaslik, { color: theme.textSecondary }]}>
                    {c.ad.toUpperCase()}
                  </Text>
                  <Text style={[styles.grupSayi, { color: theme.textMuted }]}>
                    {gruplar[c.anahtar].length}
                  </Text>
                </View>
                <View style={styles.izgara}>
                  {gruplar[c.anahtar].map((p) => (
                    <ParcaKarti
                      key={p.id}
                      parca={p}
                      uri={gorselUri(p)}
                      theme={theme}
                      onSil={parcaSil}
                    />
                  ))}
                </View>
              </View>
            ))}

            {/* Gardıroptaki boşluklar. Kombin motoru yalnızca gördüğü
                parçalardan seçebiliyor; eksiği önceden söylemek, sonradan
                "öneriler kötü" denmesinden iyi. */}
            {eksikler.length > 0 && (
              <View style={[styles.eksikKart, { borderColor: theme.cardBorder }]}>
                <Text style={[styles.eksikBaslik, { color: theme.accent }]}>
                  GARDIROBUNU TAMAMLA
                </Text>
                <Text style={[styles.eksikAlt, { color: theme.textMuted }]}>
                  Bunlar eklendiğinde öneriler belirgin şekilde isabetli oluyor.
                </Text>
                {eksikler.map((e) => (
                  <View key={e.katman} style={styles.eksikSatir}>
                    <Text style={[styles.eksikNokta, { color: theme.accent }]}>+</Text>
                    <Text style={[styles.eksikMetin, { color: theme.textSecondary }]}>
                      {e.metin}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {etiketliSayi > 0 && onNavigateOutfit && (
              <TouchableOpacity
                style={[styles.kombinButon, { backgroundColor: theme.accent }]}
                onPress={() => {
                  haptik.dokunus();
                  onNavigateOutfit();
                }}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Bugünün kombinini gör"
              >
                <Text style={styles.kombinButonMetin}>✨ Bugünün kombinini gör</Text>
              </TouchableOpacity>
            )}

            <Text style={[styles.ipucu, { color: theme.textMuted }]}>
              Silmek için parçaya basılı tut.
            </Text>
          </>
        )}
      </ScrollView>

      <PaywallSheet
        gorunur={!!kilitli}
        ozellik={kilitli}
        onKapat={() => setKilitli(null)}
        onPremium={onNavigatePremium}
      />

      <TagConfirmModal
        gorunur={!!bekleyenParca}
        parca={bekleyenParca}
        gorselUri={bekleyenParca ? gorselUri(bekleyenParca) : null}
        elleEtiket={elleEtiket}
        onKaydet={parcaOnayla}
        onIptal={parcaVazgec}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  kok: { flex: 1, backgroundColor: "#16233B" },
  icerik: { paddingHorizontal: 20 },
  ustBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  // lineHeight ile dokunma/erişilebilirlik yüksekliği 22dp'den 44dp'ye
  // çıkıyor. hitSlop yalnızca dokunma olayını genişletiyor, TalkBack'in
  // düğümünü büyütmüyor; geri dönüş yolu dokunarak keşifte zor bulunuyordu.
  geri: { fontSize: 16, fontWeight: "600", lineHeight: 44 },
  krediRozet: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5 },
  krediMetin: { fontSize: 11, fontWeight: "700" },

  baslik: { fontSize: 30, fontWeight: "800", marginTop: 18, letterSpacing: -0.4 },
  altBaslik: { fontSize: 14, marginTop: 5, lineHeight: 20 },

  hizliButon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 20,
    backgroundColor: "#FFC65C",
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 17,
  },
  hizliIkon: { fontSize: 19 },
  hizliMetinKutu: { flex: 1, gap: 2 },
  hizliBaslik: { color: "#241A4D", fontSize: 15.5, fontWeight: "800" },
  hizliAlt: { color: "rgba(36,26,77,0.75)", fontSize: 12, fontWeight: "700" },
  hizliOk: { color: "#241A4D", fontSize: 17, fontWeight: "800" },
  ayiracMetin: {
    fontSize: 11.5,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 14,
    letterSpacing: 0.3,
  },

  butonSatiri: { flexDirection: "row", gap: 10, marginTop: 20 },
  ekleButon: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: "center",
    gap: 7,
  },
  ekleIkon: { fontSize: 22 },
  ekleMetin: { color: "#fff", fontSize: 13, fontWeight: "700" },

  ipucuKart: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginTop: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 16,
    padding: 13,
  },
  ipucuIkon: { fontSize: 14, marginTop: 1 },
  ipucuMetin: { flex: 1, fontSize: 12, lineHeight: 17 },

  durumKutu: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  durumMetin: { fontSize: 13, fontWeight: "600" },

  hataKutu: {
    marginTop: 14,
    backgroundColor: "rgba(220,38,38,0.22)",
    borderColor: "rgba(255,150,150,0.45)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  hataMetin: { color: "#FFE1E1", fontSize: 13, lineHeight: 18 },

  bosKutu: {
    marginTop: 26,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 20,
    padding: 26,
    alignItems: "center",
    gap: 8,
  },
  bosIkon: { fontSize: 40 },
  bosBaslik: { fontSize: 17, fontWeight: "700" },
  bosMetin: { fontSize: 13, lineHeight: 19, textAlign: "center" },

  grup: { marginTop: 26 },
  grupBaslikSatiri: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 11 },
  grupIkon: { fontSize: 13 },
  grupBaslik: { fontSize: 11, fontWeight: "700", letterSpacing: 1, flex: 1 },
  grupSayi: { fontSize: 11, fontWeight: "700" },

  izgara: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kartSarmal: { width: "31.5%" },
  kart: {
    aspectRatio: 0.76,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  kartGorsel: { width: "100%", flex: 1 },
  kartSiluet: { width: "100%", flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.10)" },
  kartAlt: { paddingHorizontal: 8, paddingVertical: 7, backgroundColor: "rgba(0,0,0,0.38)" },
  kartAd: { color: "#fff", fontSize: 10, fontWeight: "700" },
  kartMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  kartAralik: { color: "rgba(255,255,255,0.65)", fontSize: 9, fontWeight: "600" },
  kartRozet: { fontSize: 9 },

  bekliyorRozet: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: "#FFC65C",
    alignItems: "center",
    justifyContent: "center",
  },
  bekliyorMetin: { color: "#241A4D", fontSize: 12, fontWeight: "900" },

  eksikKart: {
    marginTop: 26,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 20,
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.20)",
    gap: 4,
  },
  eksikBaslik: { fontSize: 10, fontWeight: "800", letterSpacing: 0.9 },
  eksikAlt: { fontSize: 12, lineHeight: 17, marginBottom: 6 },
  eksikSatir: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 3 },
  eksikNokta: { fontSize: 14, fontWeight: "800", lineHeight: 18 },
  eksikMetin: { flex: 1, fontSize: 13, lineHeight: 18 },

  kombinButon: {
    marginTop: 26,
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: "center",
  },
  kombinButonMetin: { color: "#241A4D", fontSize: 16, fontWeight: "800" },

  ipucu: { fontSize: 11, textAlign: "center", marginTop: 18 },
});
