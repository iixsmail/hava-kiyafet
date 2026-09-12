import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../components/GradientBackground";
import { KombinIskeleti } from "../ui/Skeleton";
import * as haptik from "../ui/haptics";
import ClothingSilhouette from "../components/ClothingSilhouette";
import { getWeatherTheme, VARSAYILAN_TEMA } from "../theme/weatherTheme";
import { getDailyForecast, describeWeatherCode } from "../api/weather";
import { bavulListesi } from "../logic/layerPlan";
import { useWeather } from "../context/WeatherContext";
import { useWardrobe } from "../context/WardrobeContext";

// Bavul asistanı.
//
// Tarih seçici yerine "kaç gün" seçtiriyoruz. Sebebi: tahmin zaten yalnızca
// önümüzdeki 10 günü kapsıyor; takvim açıp kullanıcıyı kapsam dışı bir tarih
// seçip boş sonuç almaya davet etmek kötü bir deneyim. Gün sayısı hem daha
// hızlı hem her seçim geçerli.
const GUN_SECENEKLERI = [2, 3, 5, 7, 10];

export default function PackingScreen({ onBack, onNavigateWardrobe }) {
  const insets = useSafeAreaInsets();
  const { weatherData, locationName, kayitliSehirler, kayitliSehreGec } = useWeather();
  const { parcalar, gorselUri } = useWardrobe();

  const [gunSayisi, setGunSayisi] = useState(3);

  const current = weatherData?.current;
  const theme = useMemo(
    () => (current ? getWeatherTheme(current.weather_code, current.is_day) : VARSAYILAN_TEMA),
    [current]
  );

  const gunler = useMemo(() => getDailyForecast(weatherData), [weatherData]);
  const liste = useMemo(
    () => bavulListesi(gunler.slice(0, gunSayisi), parcalar),
    [gunler, gunSayisi, parcalar]
  );

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

        <Text style={[styles.baslik, { color: theme.textPrimary }]}>Bavul asistanı</Text>
        <Text style={[styles.altBaslik, { color: theme.textSecondary }]}>
          {locationName} tahminine göre ne alman gerektiğini çıkarır.
        </Text>

        {/* Şehir seçimi — kayıtlı şehirlerden. Ayrı bir arama alanı eklemek
            yerine mevcut kayıtlı şehir listesini kullanmak, kullanıcıyı iki
            farklı yerde şehir yönetmeye zorlamıyor. */}
        {kayitliSehirler.length > 0 && (
          <>
            <Text style={[styles.bolumBaslik, { color: theme.textMuted }]}>NEREYE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.serit}>
                {kayitliSehirler.map((sh) => {
                  const aktif = sh.ad === locationName;
                  return (
                    <TouchableOpacity
                      key={`${sh.enlem},${sh.boylam}`}
                      style={[
                        styles.cip,
                        { borderColor: theme.cardBorder },
                        aktif && { backgroundColor: theme.accent, borderColor: theme.accent },
                      ]}
                      onPress={() => {
                        haptik.dokunus();
                        kayitliSehreGec(sh);
                      }}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityState={{ selected: aktif }}
                    >
                      <Text
                        style={[
                          styles.cipMetin,
                          { color: theme.textPrimary },
                          aktif && styles.cipMetinAktif,
                        ]}
                        numberOfLines={1}
                      >
                        {sh.ad}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </>
        )}

        <Text style={[styles.bolumBaslik, { color: theme.textMuted }]}>KAÇ GÜN</Text>
        <View style={styles.serit}>
          {GUN_SECENEKLERI.map((g) => {
            const aktif = g === gunSayisi;
            const kapsamDisi = g > gunler.length;
            return (
              <TouchableOpacity
                key={g}
                style={[
                  styles.cip,
                  { borderColor: theme.cardBorder },
                  aktif && { backgroundColor: theme.accent, borderColor: theme.accent },
                  kapsamDisi && styles.cipPasif,
                ]}
                onPress={() => {
                  haptik.dokunus();
                  setGunSayisi(g);
                }}
                disabled={kapsamDisi}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: aktif, disabled: kapsamDisi }}
                accessibilityLabel={`${g} gün`}
              >
                <Text
                  style={[styles.cipMetin, { color: theme.textPrimary }, aktif && styles.cipMetinAktif]}
                >
                  {g} gün
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {!liste ? (
          <View style={{ marginTop: 24 }}>
            <KombinIskeleti />
          </View>
        ) : (
          <>
            <View
              style={[styles.ozetKart, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
            >
              <View style={styles.ozetSatir}>
                <View style={styles.ozetKutu}>
                  <Text style={[styles.ozetDeger, { color: theme.textPrimary }]}>
                    {liste.enDusuk}° – {liste.enYuksek}°
                  </Text>
                  <Text style={[styles.ozetEtiket, { color: theme.textMuted }]}>
                    {liste.gunSayisi} günlük aralık
                  </Text>
                </View>
                <View style={styles.ozetAyrac} />
                <View style={styles.ozetKutu}>
                  <Text style={[styles.ozetDeger, { color: theme.textPrimary }]}>
                    {liste.yagisliGun}
                  </Text>
                  <Text style={[styles.ozetEtiket, { color: theme.textMuted }]}>yağışlı gün</Text>
                </View>
              </View>
            </View>

            {/* Günlük şerit — hangi günün ne olduğunu görmek listeye güven
                veriyor. Sadece "18–29°" demek soyut kalıyor. */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.gunSerit}>
                {gunler.slice(0, gunSayisi).map((g) => (
                  <View
                    key={g.date}
                    style={[styles.gunKart, { borderColor: theme.cardBorder }]}
                  >
                    <Text style={[styles.gunAd, { color: theme.textMuted }]}>{g.label}</Text>
                    <Text style={styles.gunIkon}>{describeWeatherCode(g.code).icon}</Text>
                    <Text style={[styles.gunDerece, { color: theme.textPrimary }]}>
                      {Math.round(g.max)}°
                    </Text>
                    <Text style={[styles.gunDereceAlt, { color: theme.textMuted }]}>
                      {Math.round(g.min)}°
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            {liste.gardiropBos && (
              <TouchableOpacity
                style={[styles.uyariKart, { borderColor: theme.accent }]}
                onPress={() => {
                  haptik.dokunus();
                  onNavigateWardrobe?.();
                }}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Gardırobunu oluştur"
              >
                <Text style={[styles.uyariBaslik, { color: theme.accent }]}>
                  Gardırobun boş
                </Text>
                <Text style={styles.uyariMetin}>
                  Aşağıdaki liste sadece kaç parça alman gerektiğini söylüyor. Gardırobunu
                  oluşturursan hangi parçaları alacağını da eşleştiririz.
                </Text>
              </TouchableOpacity>
            )}

            <Text style={[styles.bolumBaslik, { color: theme.textMuted }]}>BAVULA KOY</Text>
            <View style={styles.kalemListe}>
              {liste.kalemler.map((k) => (
                <View
                  key={k.katman}
                  style={[styles.kalemKart, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
                >
                  <View style={styles.kalemBaslikSatiri}>
                    <Text style={[styles.kalemAd, { color: theme.textPrimary }]}>
                      {k.adet} {k.katmanAdi}
                    </Text>
                    {k.eksik > 0 && (
                      <Text style={[styles.kalemEksik, { color: theme.accent }]}>
                        {k.eksik} eşleşmedi
                      </Text>
                    )}
                  </View>

                  {k.eslesenler.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.parcaSerit}>
                        {k.eslesenler.map((p) => (
                          <View key={p.id} style={styles.parcaKutu}>
                            {gorselUri(p) ? (
                              <Image source={{ uri: gorselUri(p) }} style={styles.parcaGorsel} />
                            ) : (
                              <View style={[styles.parcaGorsel, styles.parcaSiluet]}>
                                <ClothingSilhouette katman={p.katman} tur={p.tur} size={30} opak={0.55} />
                              </View>
                            )}
                            <Text style={styles.parcaAd} numberOfLines={1}>
                              {p.ad}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  ) : (
                    <Text style={[styles.kalemBos, { color: theme.textMuted }]}>
                      Gardırobunda bu aralığa uygun {k.katmanAdi} yok.
                    </Text>
                  )}
                </View>
              ))}
            </View>

            {liste.ekstralar.length > 0 && (
              <View style={[styles.ekstraKart, { borderColor: theme.cardBorder }]}>
                <Text style={[styles.bolumBaslik, { color: theme.textMuted, marginTop: 0 }]}>
                  UNUTMA
                </Text>
                {liste.ekstralar.map((e) => (
                  <View key={e} style={styles.ekstraSatir}>
                    <Text style={[styles.ekstraNokta, { color: theme.accent }]}>•</Text>
                    <Text style={[styles.ekstraMetin, { color: theme.textSecondary }]}>{e}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  parcaSiluet: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.10)" },
  kok: { flex: 1, backgroundColor: "#16233B" },
  icerik: { paddingHorizontal: 20 },
  // lineHeight ile dokunma/erişilebilirlik yüksekliği 22dp'den 44dp'ye
  // çıkıyor. hitSlop yalnızca dokunma olayını genişletiyor, TalkBack'in
  // düğümünü büyütmüyor; geri dönüş yolu dokunarak keşifte zor bulunuyordu.
  geri: { fontSize: 16, fontWeight: "600", lineHeight: 44 },
  baslik: { fontSize: 30, fontWeight: "800", marginTop: 18, letterSpacing: -0.4 },
  altBaslik: { fontSize: 14, marginTop: 5, lineHeight: 20 },

  bolumBaslik: { fontSize: 10, fontWeight: "800", letterSpacing: 0.9, marginTop: 24, marginBottom: 10 },
  serit: { flexDirection: "row", gap: 8, flexWrap: "wrap", paddingRight: 4 },
  cip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: "rgba(255,255,255,0.10)",
    maxWidth: 190,
  },
  cipPasif: { opacity: 0.35 },
  cipMetin: { fontSize: 13, fontWeight: "700" },
  cipMetinAktif: { color: "#241A4D", fontWeight: "800" },

  ozetKart: { marginTop: 22, borderWidth: 1, borderRadius: 22, padding: 18 },
  ozetSatir: { flexDirection: "row", alignItems: "center" },
  ozetKutu: { flex: 1, alignItems: "center", gap: 3 },
  ozetAyrac: { width: 1, height: 34, backgroundColor: "rgba(255,255,255,0.14)" },
  ozetDeger: { fontSize: 21, fontWeight: "800" },
  ozetEtiket: { fontSize: 11, fontWeight: "600" },

  gunSerit: { flexDirection: "row", gap: 8, marginTop: 14, paddingRight: 4 },
  gunKart: {
    width: 62,
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: 16,
    borderWidth: 1,
    gap: 3,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  gunAd: { fontSize: 11, fontWeight: "700" },
  gunIkon: { fontSize: 21 },
  gunDerece: { fontSize: 15, fontWeight: "700" },
  gunDereceAlt: { fontSize: 12, fontWeight: "500" },

  uyariKart: {
    marginTop: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 18,
    padding: 15,
    backgroundColor: "rgba(0,0,0,0.22)",
    gap: 5,
  },
  uyariBaslik: { fontSize: 14, fontWeight: "800" },
  uyariMetin: { color: "rgba(255,255,255,0.75)", fontSize: 12.5, lineHeight: 18 },

  kalemListe: { gap: 10 },
  kalemKart: { borderWidth: 1, borderRadius: 20, padding: 15, gap: 11 },
  kalemBaslikSatiri: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kalemAd: { fontSize: 15, fontWeight: "800" },
  kalemEksik: { fontSize: 11, fontWeight: "700" },
  kalemBos: { fontSize: 12, lineHeight: 17 },

  parcaSerit: { flexDirection: "row", gap: 9, paddingRight: 4 },
  parcaKutu: { width: 66, gap: 4 },
  parcaGorsel: {
    width: 66,
    height: 66,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  parcaAd: { color: "rgba(255,255,255,0.75)", fontSize: 10, fontWeight: "600" },

  ekstraKart: {
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.20)",
  },
  ekstraSatir: { flexDirection: "row", alignItems: "flex-start", gap: 9, paddingVertical: 4 },
  ekstraNokta: { fontSize: 15, fontWeight: "800", lineHeight: 19 },
  ekstraMetin: { flex: 1, fontSize: 13, lineHeight: 19 },
});
