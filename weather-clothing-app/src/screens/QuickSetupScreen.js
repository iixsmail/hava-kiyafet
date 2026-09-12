import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../components/GradientBackground";
import ClothingSilhouette from "../components/ClothingSilhouette";
import { getWeatherTheme, VARSAYILAN_TEMA } from "../theme/weatherTheme";
import { useWeather } from "../context/WeatherContext";
import { useWardrobe } from "../context/WardrobeContext";
import { KATALOG, KATMAN_BASLIKLARI, VARSAYILAN_SECIM, katalogParcasi, secimDurumu } from "../logic/katalog";
import * as haptik from "../ui/haptics";

// Gardıroba fotoğrafsız hızlı giriş.
//
// Asıl amaç eşiği düşürmek: fotoğraf çekme akışı 8-10 parça için dakikalar
// sürüyor ve çoğu kullanıcı yarıda bırakıyordu. Burada listeden işaretleyip
// tek dokunuşla bitiyor; fotoğraf sonradan istenirse eklenebiliyor.

const ALTIN = "#FFC65C";

export default function QuickSetupScreen({ onBack, onBitti, onKameraya, onNavigatePremium }) {
  const insets = useSafeAreaInsets();
  const { weatherData } = useWeather();
  const { katalogdanEkle, parcaSiniri, parcalar } = useWardrobe();

  const [secili, setSecili] = useState(() => new Set(VARSAYILAN_SECIM));
  const [ekleniyor, setEkleniyor] = useState(false);

  const current = weatherData?.current;
  const theme = useMemo(
    () => (current ? getWeatherTheme(current.weather_code, current.is_day) : VARSAYILAN_TEMA),
    [current]
  );

  const idler = useMemo(() => [...secili], [secili]);
  const durum = useMemo(() => secimDurumu(idler), [idler]);

  // Ücretsiz planda kalan kota. Kullanıcı 25 parça işaretleyip "20'si geldi"
  // sürprizini yaşamasın diye seçerken uyarıyoruz.
  const kalanKota = Number.isFinite(parcaSiniri)
    ? Math.max(0, parcaSiniri - parcalar.length)
    : Infinity;
  const kotaDoldu = kalanKota === 0;
  const kotaAsildi = !kotaDoldu && durum.sayi > kalanKota;
  // Butonun söz verdiği sayı, gerçekten eklenecek sayı olmalı.
  const eklenecek = Math.min(durum.sayi, kalanKota);

  const degistir = (id) => {
    haptik.dokunus();
    setSecili((s) => {
      const y = new Set(s);
      y.has(id) ? y.delete(id) : y.add(id);
      return y;
    });
  };

  const ekle = async () => {
    // Kota doluyken buton zaten Premium'a götürüyor; buraya düşmemeli.
    if (kotaDoldu || !durum.yeterli || ekleniyor) return;
    haptik.dokunus();
    setEkleniyor(true);
    const secilenler = KATALOG.filter((k) => secili.has(k.id)).map(katalogParcasi);
    const sonuc = await katalogdanEkle(secilenler);
    setEkleniyor(false);
    if (sonuc.ok) {
      haptik.basari();
      onBitti?.(sonuc);
    } else {
      haptik.hata();
      // Tek başarısızlık sebebi kota; kullanıcıyı sessiz bırakmak yerine
      // çıkış yolunu gösteriyoruz.
      if (sonuc.kilitli) onNavigatePremium?.();
    }
  };

  return (
    <View style={styles.kok}>
      <GradientBackground colors={theme.gradient} />

      <ScrollView
        contentContainerStyle={[
          styles.icerik,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 150 },
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

        <Text style={[styles.baslik, { color: theme.textPrimary }]}>Dolabında ne var?</Text>
        <Text style={[styles.altBaslik, { color: theme.textSecondary }]}>
          Sahip olduklarını işaretle — fotoğraf gerekmez. Sonra istediğin
          parçanın fotoğrafını ekleyebilirsin.
        </Text>

        {KATMAN_BASLIKLARI.map(({ katman, baslik }) => {
          const grup = KATALOG.filter((k) => k.katman === katman);
          return (
            <View key={katman} style={styles.bolum}>
              <Text style={[styles.bolumBaslik, { color: theme.textMuted }]}>
                {baslik.toUpperCase()}
              </Text>
              <View style={styles.izgara}>
                {grup.map((k) => {
                  const aktif = secili.has(k.id);
                  return (
                    <TouchableOpacity
                      key={k.id}
                      style={[
                        styles.kalem,
                        { borderColor: aktif ? ALTIN : theme.cardBorder },
                        aktif && styles.kalemAktif,
                      ]}
                      onPress={() => degistir(k.id)}
                      activeOpacity={0.85}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: aktif }}
                      accessibilityLabel={k.ad}
                    >
                      <ClothingSilhouette
                        katman={k.katman}
                        tur={k.tur}
                        size={38}
                        opak={aktif ? 0.95 : 0.5}
                      />
                      <Text
                        style={[
                          styles.kalemMetin,
                          { color: aktif ? "#FFFFFF" : theme.textSecondary },
                        ]}
                        numberOfLines={2}
                      >
                        {k.ad}
                      </Text>
                      {aktif && (
                        <View style={styles.tik}>
                          <Text style={styles.tikMetin}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}

        <TouchableOpacity
          style={[styles.kameraSatiri, { borderColor: theme.cardBorder }]}
          onPress={() => {
            haptik.dokunus();
            onKameraya?.();
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Bunun yerine fotoğraf çekerek ekle"
        >
          <Text style={styles.kameraIkon}>📷</Text>
          <Text style={[styles.kameraMetin, { color: theme.textSecondary }]}>
            Kendi kıyafetinin fotoğrafını eklemek istersen
          </Text>
          <Text style={[styles.kameraOk, { color: theme.textSecondary }]}>›</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Alt çubuk sabit: kullanıcı listeyi kaydırırken kaç parça seçtiğini ve
          bitirme düğmesini kaybetmiyor. */}
      <View style={[styles.altCubuk, { paddingBottom: insets.bottom + 14 }]}>
        {kotaDoldu ? (
          <Text style={styles.uyari}>
            Ücretsiz plandaki {parcaSiniri} parçalık gardırop hakkın dolu.
          </Text>
        ) : !durum.yeterli ? (
          <Text style={styles.uyari}>
            Kombin için en az {durum.eksikler.join(" ve ")} seç.
          </Text>
        ) : kotaAsildi ? (
          <Text style={styles.uyari}>
            Ücretsiz planda {kalanKota} parça hakkın kaldı — her katmandan
            dengeli olacak şekilde {kalanKota} tanesi eklenecek.
          </Text>
        ) : !durum.ayakkabiVar ? (
          <Text style={styles.ipucu}>Bir ayakkabı da seçersen öneri tamamlanır.</Text>
        ) : null}

        {/* Kota doluyken düğme "N parçayı ekle" deyip sessizce başarısız
            oluyordu: kullanıcı ne olduğunu anlamıyor ve çıkış yolu
            göremiyordu. Artık doğrudan Premium'a götürüyor. */}
        {kotaDoldu ? (
          <TouchableOpacity
            style={styles.ekleButon}
            onPress={() => {
              haptik.dokunus();
              onNavigatePremium?.();
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Premium ile sınırsız gardırop"
          >
            <Text style={styles.ekleMetin}>Premium ile sınırsız gardırop</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.ekleButon, (!durum.yeterli || ekleniyor) && styles.butonPasif]}
            onPress={ekle}
            disabled={!durum.yeterli || ekleniyor}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`${eklenecek} parçayı gardıroba ekle`}
          >
            {ekleniyor ? (
              <ActivityIndicator color="#241A4D" />
            ) : (
              <Text style={styles.ekleMetin}>{eklenecek} parçayı ekle</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  kok: { flex: 1, backgroundColor: "#16233B" },
  icerik: { paddingHorizontal: 20 },
  // lineHeight ile dokunma/erişilebilirlik yüksekliği 22dp'den 44dp'ye
  // çıkıyor. hitSlop yalnızca dokunma olayını genişletiyor, TalkBack'in
  // düğümünü büyütmüyor; geri dönüş yolu dokunarak keşifte zor bulunuyordu.
  geri: { fontSize: 16, fontWeight: "600", lineHeight: 44 },
  baslik: { fontSize: 30, fontWeight: "800", marginTop: 18, letterSpacing: -0.5 },
  altBaslik: { fontSize: 14, marginTop: 6, lineHeight: 20 },

  bolum: { marginTop: 26, gap: 11 },
  bolumBaslik: { fontSize: 10.5, fontWeight: "800", letterSpacing: 1 },
  izgara: { flexDirection: "row", flexWrap: "wrap", gap: 10 },

  kalem: {
    width: "31.2%",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 18,
    paddingVertical: 13,
    paddingHorizontal: 6,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  kalemAktif: { backgroundColor: "rgba(255,198,92,0.16)" },
  kalemMetin: { fontSize: 12, fontWeight: "700", textAlign: "center", lineHeight: 15 },
  tik: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: ALTIN,
    alignItems: "center",
    justifyContent: "center",
  },
  tikMetin: { color: "#241A4D", fontSize: 12, fontWeight: "900" },

  kameraSatiri: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginTop: 28,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  kameraIkon: { fontSize: 17 },
  kameraMetin: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  kameraOk: { fontSize: 20, fontWeight: "300" },

  altCubuk: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 9,
    backgroundColor: "rgba(10,17,33,0.94)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  uyari: { color: ALTIN, fontSize: 12.5, fontWeight: "700", textAlign: "center" },
  ipucu: { color: "rgba(255,255,255,0.6)", fontSize: 12.5, fontWeight: "600", textAlign: "center" },

  ekleButon: {
    backgroundColor: ALTIN,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
  },
  butonPasif: { opacity: 0.45 },
  ekleMetin: { color: "#241A4D", fontSize: 16, fontWeight: "800" },
});
