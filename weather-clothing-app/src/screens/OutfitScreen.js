import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../components/GradientBackground";
import Avatar from "../components/Avatar";
import PaywallSheet from "../components/PaywallSheet";
import { ETKINLIKLER } from "../logic/localStylist";
import { useAds } from "../context/AdsContext";
import { KombinIskeleti } from "../ui/Skeleton";
import * as haptik from "../ui/haptics";
import ClothingSilhouette from "../components/ClothingSilhouette";
import { getWeatherTheme, VARSAYILAN_TEMA } from "../theme/weatherTheme";
import { describeWeatherCode, getCurrentRainChance, getDailyForecast } from "../api/weather";
import { useWeather } from "../context/WeatherContext";
import { useWardrobe } from "../context/WardrobeContext";
import { usePremium } from "../context/PremiumContext";

const KATMAN_ADI = {
  ust: "Üst",
  dis: "Dış giyim",
  alt: "Alt",
  ayakkabi: "Ayakkabı",
  aksesuar: "Aksesuar",
};

// Kombin kartlarının görünme sırası — giyinme sırası.
const SIRA = ["dis", "ust", "alt", "ayakkabi", "aksesuar"];

/** Kalan hak sayacı — dolu/boş noktalarla. */
function KrediSayaci({ kredi, theme }) {
  if (!kredi) return null;
  const pencere = kredi.kombinBirim === "gun" ? "bugün" : "bu ay";

  // Limit büyükse (premium 20) nokta basmak anlamsız; sayı gösteriyoruz.
  const noktaliGoster = kredi.kombinLimit <= 6;

  return (
    <View style={[styles.sayacKutu, { borderColor: theme.cardBorder }]}>
      {noktaliGoster ? (
        <View style={styles.noktalar}>
          {Array.from({ length: kredi.kombinLimit }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.nokta,
                { backgroundColor: i < kredi.kombinKalan ? theme.accent : "rgba(255,255,255,0.22)" },
              ]}
            />
          ))}
        </View>
      ) : null}
      <Text style={[styles.sayacMetin, { color: theme.textSecondary }]}>
        {kredi.kombinKalan}/{kredi.kombinLimit} öneri · {pencere}
      </Text>
    </View>
  );
}

export default function OutfitScreen({ onBack, onNavigateWardrobe, onNavigatePremium }) {
  const insets = useSafeAreaInsets();
  const { weatherData, locationName } = useWeather();
  const {
    parcalar,
    kombin,
    kombinYukleniyor,
    kombinHatasi,
    kombinOner,
    kredi,
    gorselUri,
    yapayZekaAcik,
    krediyiYenile,
  } = useWardrobe();
  const { isPremium } = usePremium();
  const { odulluGoster, oduluHazir, odulDestekleniyor } = useAds();

  const [etkinlik, setEtkinlik] = useState("gunluk");
  const [kilitli, setKilitli] = useState(null);
  const [odulAliniyor, setOdulAliniyor] = useState(false);

  const current = weatherData?.current;
  const theme = useMemo(
    () => (current ? getWeatherTheme(current.weather_code, current.is_day) : VARSAYILAN_TEMA),
    [current]
  );

  // Sunucuya giden hava özeti. Fotoğraf YOK — sadece bu sayılar ve gardırop
  // metadatası gidiyor, istek bu yüzden hem ucuz hem hızlı.
  const havaOzeti = useMemo(() => {
    if (!current || !weatherData) return null;
    const bugun = getDailyForecast(weatherData)[0];
    return {
      sicaklik: current.temperature_2m,
      hissedilen: current.apparent_temperature ?? current.temperature_2m,
      kod: current.weather_code,
      durum: describeWeatherCode(current.weather_code, current.is_day).text,
      ruzgar: current.wind_speed_10m ?? 0,
      yagisIhtimali: getCurrentRainChance(weatherData),
      nem: current.relative_humidity_2m ?? 50,
      gunduz: current.is_day ?? 1,
      enDusuk: bugun?.min ?? current.temperature_2m,
      enYuksek: bugun?.max ?? current.temperature_2m,
    };
  }, [current, weatherData]);

  // Modelin seçtiği id'leri gerçek parçalara bağla.
  //
  // Yalnızca URI taşımak yetmiyor: katalogdan eklenen parçaların fotoğrafı
  // yok ve URI null geliyor. Avatar bunu "bu katmanda parça yok" sanıp boş
  // yuva çiziyordu. Parçanın VARLIĞINI ayrıca taşıyoruz.
  const slotlar = useMemo(() => {
    const s = {};
    for (const secim of kombin?.secilenler ?? []) {
      const parca = parcalar.find((p) => p.id === secim.id);
      if (parca) s[secim.katman] = { uri: gorselUri(parca), ad: parca.ad, tur: parca.tur };
    }
    return s;
  }, [kombin, parcalar, gorselUri]);

  // Katman sırasına göre dizilmiş seçimler + gerçek parça kaydı.
  const secimler = useMemo(() => {
    const ham = (kombin?.secilenler ?? [])
      .map((s) => ({ ...s, parca: parcalar.find((p) => p.id === s.id) }))
      .filter((s) => s.parca);
    return ham.sort((a, b) => SIRA.indexOf(a.katman) - SIRA.indexOf(b.katman));
  }, [kombin, parcalar]);

  const etiketliSayi = parcalar.filter((p) => p.etiketlendi).length;
  const krediBitti = kredi && kredi.kombinKalan === 0;

  const oner = async () => {
    if (!havaOzeti) return;
    haptik.dokunus();
    const sonuc = await kombinOner(havaOzeti, { etkinlik });
    sonuc.ok ? haptik.basari() : haptik.hata();
  };

  const etkinlikSec = (anahtar) => {
    const mod = ETKINLIKLER[anahtar];
    // Premium mod: mini paywall aç, seçimi DEĞİŞTİRME. Seçili gösterip
    // sonra günlük moda düşmek kullanıcıyı yanıltırdı.
    if (mod?.premium && !isPremium) {
      haptik.uyari();
      setKilitli("etkinlik");
      return;
    }
    haptik.dokunus();
    setEtkinlik(anahtar);
  };

  /**
   * Ödüllü reklam akışı.
   *
   * Kredi SUNUCUDA açılıyor: reklam izlendiğinde Google bizim sunucumuza
   * imzalı bir çağrı yapıyor (SSV) ve kredi orada veriliyor. Buradan sadece
   * reklamı gösterip sonra krediyi YENİDEN OKUYORUZ — istemcinin "izledim"
   * demesiyle kredi vermek, sayacı sunucuda tutmanın anlamını yok ederdi.
   */
  const odulIzle = async () => {
    haptik.dokunus();
    setOdulAliniyor(true);
    try {
      const { odulKazanildi } = await odulluGoster();
      if (!odulKazanildi) {
        haptik.hata();
        return;
      }
      haptik.basari();
      // SSV callback'i Google'dan sunucumuza ulaşana kadar kısa bir gecikme
      // olabiliyor; bir kez bekleyip tekrar okuyoruz.
      await new Promise((r) => setTimeout(r, 1200));
      await krediyiYenile?.();
    } finally {
      setOdulAliniyor(false);
    }
  };

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

          {/* Gardıroba giriş HER ZAMAN burada.
              Eskiden yalnızca gardırop BOŞKEN çizilen "Önce gardırobunu
              oluştur" düğmesinden gidiliyordu; parça eklendikten sonra
              gardırop ekranına ulaşmanın hiçbir yolu kalmıyordu — kullanıcı
              kıyafet ekleyemiyor, silemiyor, fotoğraf koyamıyordu. */}
          <View style={styles.ustSag}>
            {yapayZekaAcik && <KrediSayaci kredi={kredi} theme={theme} />}
            <TouchableOpacity
              style={[styles.gardiropLink, { borderColor: theme.cardBorder }]}
              onPress={() => {
                haptik.dokunus();
                onNavigateWardrobe();
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Gardırobumu düzenle"
            >
              <Text style={styles.gardiropLinkIkon}>🧺</Text>
              <Text style={[styles.gardiropLinkMetin, { color: theme.textSecondary }]}>
                Gardırobum
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.baslik, { color: theme.textPrimary }]}>Bugün ne giysem?</Text>
        {current && (
          <Text style={[styles.havaSatiri, { color: theme.textSecondary }]}>
            {locationName} · {Math.round(current.temperature_2m)}° ·{" "}
            {describeWeatherCode(current.weather_code, current.is_day).text}
          </Text>
        )}

        {/* Etkinlik modları. Premium olanlar kilit rozetiyle görünüyor —
            tamamen gizlemek yerine ne kaçırdığını göstermek yükseltme
            sebebi yaratıyor. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.etkinlikSerit}>
            {Object.entries(ETKINLIKLER).map(([anahtar, mod]) => {
              const aktif = etkinlik === anahtar;
              const kilit = mod.premium && !isPremium;
              return (
                <TouchableOpacity
                  key={anahtar}
                  style={[
                    styles.etkinlikCip,
                    { borderColor: theme.cardBorder },
                    aktif && { backgroundColor: theme.accent, borderColor: theme.accent },
                  ]}
                  onPress={() => etkinlikSec(anahtar)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: aktif }}
                  accessibilityLabel={`${mod.ad}${kilit ? " — Premium" : ""}`}
                >
                  <Text style={styles.etkinlikIkon}>{mod.ikon}</Text>
                  <Text
                    style={[
                      styles.etkinlikMetin,
                      { color: theme.textPrimary },
                      aktif && styles.etkinlikMetinAktif,
                    ]}
                  >
                    {mod.ad}
                  </Text>
                  {kilit && <Text style={styles.etkinlikKilit}>🔒</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View
          style={[styles.avatarKutu, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
        >
          <Avatar slotlar={slotlar} theme={theme} />
        </View>

        {kombinYukleniyor && (
          <View style={{ marginTop: 22 }}>
            <KombinIskeleti />
          </View>
        )}

        {!kombinYukleniyor && kombin && (
          <>
            <Text style={[styles.kombinBaslik, { color: theme.textPrimary }]}>{kombin.baslik}</Text>
            <Text style={[styles.kombinOzet, { color: theme.textSecondary }]}>{kombin.ozet}</Text>

            {/* Katmanlı kartlar: her parça kendi fotoğrafı ve gerekçesiyle.
                Düz liste yerine kart kullanmak, kullanıcının "neden bu?"
                sorusuna cevabı parçayla YAN YANA görmesini sağlıyor. */}
            <View style={styles.katmanListesi}>
              {secimler.map((s) => (
                <View
                  key={s.id}
                  style={[
                    styles.katmanKart,
                    { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
                  ]}
                  accessibilityRole="text"
                  accessibilityLabel={`${KATMAN_ADI[s.katman] || ""}: ${s.parca.ad}. ${s.neden}`}
                >
                  {gorselUri(s.parca) ? (
                    <Image source={{ uri: gorselUri(s.parca) }} style={styles.katmanGorsel} />
                  ) : (
                    <View style={[styles.katmanGorsel, styles.katmanSiluet]}>
                      <ClothingSilhouette katman={s.katman} tur={s.parca?.tur} size={36} opak={0.55} />
                    </View>
                  )}
                  <View style={styles.katmanMetin}>
                    <Text style={[styles.katmanEtiket, { color: theme.textMuted }]}>
                      {(KATMAN_ADI[s.katman] || "").toUpperCase()}
                    </Text>
                    <Text style={[styles.katmanAd, { color: theme.textPrimary }]} numberOfLines={1}>
                      {s.parca.ad}
                    </Text>
                    <Text style={[styles.katmanNeden, { color: theme.textSecondary }]} numberOfLines={2}>
                      {s.neden}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {kombin.eksik && (
              <View style={[styles.eksikKutu, { borderColor: theme.accent }]}>
                <Text style={[styles.eksikBaslik, { color: theme.accent }]}>
                  Gardırobunda eksik
                </Text>
                <Text style={styles.eksikMetin}>{kombin.eksik}</Text>
              </View>
            )}
          </>
        )}

        {kombinHatasi && (
          <View style={styles.hataKutu}>
            <Text style={styles.hataMetin}>{kombinHatasi}</Text>
          </View>
        )}

        {etiketliSayi === 0 ? (
          <TouchableOpacity
            style={[styles.anaButon, { backgroundColor: theme.accent }]}
            onPress={() => {
              haptik.dokunus();
              onNavigateWardrobe();
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Gardırobunu oluştur"
          >
            <Text style={styles.anaButonMetin}>Önce gardırobunu oluştur</Text>
          </TouchableOpacity>
        ) : yapayZekaAcik && krediBitti && !kredi.premium ? (
          <>
            {/* Ödüllü reklam: hakkı dolan kullanıcıya para ödemeden devam
                yolu. Kredi sunucuda, Google'ın imzalı SSV çağrısıyla
                açılıyor. */}
            {odulDestekleniyor && (
              <TouchableOpacity
                style={[styles.odulButon, { borderColor: theme.accent }, odulAliniyor && styles.pasif]}
                onPress={odulIzle}
                disabled={odulAliniyor || !oduluHazir}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Kısa reklam izle, bir kombin hakkı kazan"
              >
                {odulAliniyor ? (
                  <ActivityIndicator color={theme.accent} />
                ) : (
                  <>
                    <Text style={styles.odulIkon}>🎬</Text>
                    <Text style={[styles.odulMetin, { color: theme.accent }]}>
                      {oduluHazir
                        ? "Kısa reklam izle, +1 kombin kazan"
                        : "Reklam hazırlanıyor…"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.anaButon, { backgroundColor: theme.accent }]}
              onPress={() => {
                haptik.dokunus();
                onNavigatePremium();
              }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Premium ile devam et"
            >
              <Text style={styles.anaButonMetin}>Premium ile devam et</Text>
            </TouchableOpacity>
            <Text style={[styles.krediNot, { color: theme.textMuted }]}>
              Bugünlük hakkın doldu, yarın yenilenir. Premium'da her gün 20 öneri.
            </Text>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[
                styles.anaButon,
                { backgroundColor: theme.accent },
                kombinYukleniyor && styles.pasif,
              ]}
              onPress={oner}
              disabled={kombinYukleniyor || !havaOzeti}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={kombin ? "Başka bir kombin öner" : "Kombin öner"}
            >
              {kombinYukleniyor ? (
                <ActivityIndicator color="#241A4D" />
              ) : (
                <Text style={styles.anaButonMetin}>
                  {kombin ? "Başka bir kombin öner" : "Kombin öner"}
                </Text>
              )}
            </TouchableOpacity>

            {yapayZekaAcik && kredi && !kredi.premium && (
              <Text style={[styles.krediNot, { color: theme.textMuted }]}>
                Ücretsiz planda {kredi.kombinBirim === "gun" ? "günde" : "ayda"}{" "}
                {kredi.kombinLimit} öneri. Premium'da her gün 20 öneri ve reklamsız kullanım.
              </Text>
            )}
          </>
        )}
      </ScrollView>

      <PaywallSheet
        gorunur={!!kilitli}
        ozellik={kilitli}
        onKapat={() => setKilitli(null)}
        onPremium={onNavigatePremium}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ustSag: { flexDirection: "row", alignItems: "center", gap: 10 },
  gardiropLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  gardiropLinkIkon: { fontSize: 13 },
  gardiropLinkMetin: { fontSize: 12.5, fontWeight: "700" },
  katmanSiluet: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.10)" },
  kok: { flex: 1, backgroundColor: "#16233B" },
  icerik: { paddingHorizontal: 20 },
  ustBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  // lineHeight ile dokunma/erişilebilirlik yüksekliği 22dp'den 44dp'ye
  // çıkıyor. hitSlop yalnızca dokunma olayını genişletiyor, TalkBack'in
  // düğümünü büyütmüyor; geri dönüş yolu dokunarak keşifte zor bulunuyordu.
  geri: { fontSize: 16, fontWeight: "600", lineHeight: 44 },

  sayacKutu: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  noktalar: { flexDirection: "row", gap: 4 },
  nokta: { width: 6, height: 6, borderRadius: 3 },
  sayacMetin: { fontSize: 11, fontWeight: "700" },

  baslik: { fontSize: 30, fontWeight: "800", marginTop: 16, letterSpacing: -0.4 },
  havaSatiri: { fontSize: 13, marginTop: 5 },

  avatarKutu: {
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 26,
    paddingVertical: 20,
    alignItems: "center",
  },

  kombinBaslik: {
    fontSize: 19,
    fontWeight: "700",
    marginTop: 22,
    textAlign: "center",
    letterSpacing: -0.2,
  },
  kombinOzet: { fontSize: 14, lineHeight: 20, marginTop: 7, textAlign: "center" },

  katmanListesi: { marginTop: 18, gap: 10 },
  katmanKart: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
  },
  katmanGorsel: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  katmanMetin: { flex: 1, gap: 2 },
  katmanEtiket: { fontSize: 9, fontWeight: "800", letterSpacing: 0.9 },
  katmanAd: { fontSize: 15, fontWeight: "700" },
  katmanNeden: { fontSize: 12, lineHeight: 16 },

  eksikKutu: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 18,
    padding: 15,
    backgroundColor: "rgba(0,0,0,0.22)",
    gap: 4,
  },
  eksikBaslik: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  eksikMetin: { color: "rgba(255,255,255,0.84)", fontSize: 13, lineHeight: 18 },

  hataKutu: {
    marginTop: 16,
    backgroundColor: "rgba(220,38,38,0.22)",
    borderColor: "rgba(255,150,150,0.45)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  hataMetin: { color: "#FFE1E1", fontSize: 13, lineHeight: 18 },

  bilgiKutu: { marginTop: 20, borderWidth: 1, borderRadius: 16, padding: 16, alignItems: "center" },
  bilgiMetin: { fontSize: 13, textAlign: "center", lineHeight: 19 },

  anaButon: { marginTop: 24, borderRadius: 18, paddingVertical: 18, alignItems: "center" },
  pasif: { opacity: 0.7 },
  anaButonMetin: { color: "#241A4D", fontSize: 16, fontWeight: "800" },

  krediNot: { fontSize: 11, textAlign: "center", marginTop: 14, lineHeight: 16 },

  etkinlikSerit: { flexDirection: "row", gap: 8, marginTop: 16, paddingRight: 4 },
  etkinlikCip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  etkinlikIkon: { fontSize: 14 },
  etkinlikMetin: { fontSize: 13, fontWeight: "700" },
  etkinlikMetinAktif: { color: "#241A4D", fontWeight: "800" },
  etkinlikKilit: { fontSize: 11 },

  odulButon: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 18,
    paddingVertical: 16,
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  odulIkon: { fontSize: 16 },
  odulMetin: { fontSize: 14, fontWeight: "800" },
});
