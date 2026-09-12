import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import * as haptik from "../ui/haptics";
import CalibrationRow from "./CalibrationRow";

// Uygulamanın asıl değeri burası: "bugün ne giymeli".
//
// Önceki tasarımın sorunu: öneriler her zaman iki sütunlu ızgaraya
// diziliyordu. Tek öneri olduğunda ekranda kocaman boş bir kutu ve yalnız
// bir daire kalıyor, uygulama yarım kalmış gibi görünüyordu. Ilıman bir
// günde tek öneri çıkması NORMAL — o yüzden düzenin öneri sayısına göre
// değişmesi gerekiyor:
//
//   1 öneri  -> yatay, geniş satır (boşluk kalmıyor)
//   2+ öneri -> iki sütunlu ızgara
//
// Kombin emoji şeridi de tek emoji kaldığında gizleniyor: tek daire
// "eksik" hissi veriyordu.

function OneriSatiri({ tip, theme }) {
  return (
    <View style={[styles.satirKart, { borderColor: theme.cardBorder }]}>
      <View style={styles.satirIkonDaire}>
        <Text style={styles.satirIkon}>{tip.icon}</Text>
      </View>
      <View style={styles.satirMetin}>
        <Text style={[styles.satirBaslik, { color: theme.textPrimary }]}>{tip.title}</Text>
        <Text style={[styles.satirAciklama, { color: theme.textMuted }]}>{tip.text}</Text>
      </View>
    </View>
  );
}

function OneriKutusu({ tip, theme }) {
  return (
    <View style={[styles.kutu, { borderColor: theme.cardBorder }]}>
      <View style={styles.kutuIkonDaire}>
        <Text style={styles.kutuIkon}>{tip.icon}</Text>
      </View>
      <Text style={[styles.kutuBaslik, { color: theme.textPrimary }]} numberOfLines={2}>
        {tip.title}
      </Text>
      <Text style={[styles.kutuMetin, { color: theme.textMuted }]} numberOfLines={3}>
        {tip.text}
      </Text>
    </View>
  );
}

export default function ClothingCard({ advice, theme, isPremium, onUpgradePress }) {
  if (!advice) return null;

  const oneriler = advice.tips ?? [];
  const tekOneri = oneriler.length === 1;
  // Tek emojilik "kombin şeridi" yalnız bir daire olarak görünüyordu; en az
  // iki parça varken anlamlı.
  const kombinGoster = (advice.outfit?.length ?? 0) >= 2;

  return (
    <View style={[styles.kart, { borderColor: theme.cardBorder }]}>
      <View style={styles.baslikSatiri}>
        <View style={styles.baslikIkonDaire}>
          <Text style={styles.baslikIkon}>👔</Text>
        </View>
        <View style={styles.baslikMetin}>
          <Text style={[styles.ustEtiket, { color: theme.textMuted }]}>BUGÜN NE GİYMELİ</Text>
          <Text style={[styles.ozet, { color: theme.textPrimary }]}>{advice.headline}</Text>
        </View>
      </View>

      {kombinGoster && (
        <View style={styles.kombinSerit}>
          {advice.outfit.map((emoji, i) => (
            <View key={i} style={styles.kombinKutu}>
              <Text style={styles.kombinEmoji}>{emoji}</Text>
            </View>
          ))}
        </View>
      )}

      {advice.ozet ? (
        <View style={[styles.rozetSatiri, { borderColor: theme.accent }]}>
          <Text style={[styles.rozetMetin, { color: theme.accent }]}>{advice.ozet}</Text>
        </View>
      ) : null}

      {oneriler.length > 0 && (
        <View style={tekOneri ? styles.tekliAlan : styles.izgara}>
          {oneriler.map((tip, i) =>
            tekOneri ? (
              <OneriSatiri key={i} tip={tip} theme={theme} />
            ) : (
              <OneriKutusu key={i} tip={tip} theme={theme} />
            )
          )}
        </View>
      )}

      {!isPremium && advice.lockedExtraCount > 0 && (
        <TouchableOpacity
          style={[styles.kilitKutu, { borderColor: theme.accent }]}
          onPress={() => {
            haptik.dokunus();
            onUpgradePress?.();
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`${advice.lockedExtraCount} öneri daha, Premium ile aç`}
        >
          <Text style={styles.kilitIkon}>🔒</Text>
          <Text style={styles.kilitMetin}>
            +{advice.lockedExtraCount} öneri daha
          </Text>
          <Text style={[styles.kilitAlt, { color: theme.accent }]}>Premium ile aç →</Text>
        </TouchableOpacity>
      )}

      {/* Kalibrasyon kartın EN ALTINDA: kullanıcı önce öneriyi okusun, sonra
          değerlendirsin. Üste koymak, henüz görmediği bir şeyi sormak olurdu. */}
      <CalibrationRow theme={theme} />
    </View>
  );
}

const styles = StyleSheet.create({
  kart: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    marginTop: 16,
  },

  baslikSatiri: { flexDirection: "row", alignItems: "center", gap: 12 },
  baslikIkonDaire: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  baslikIkon: { fontSize: 20 },
  baslikMetin: { flex: 1, gap: 3 },
  ustEtiket: { fontSize: 10, fontWeight: "800", letterSpacing: 0.9 },
  ozet: { fontSize: 16, fontWeight: "700", lineHeight: 21 },

  kombinSerit: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginTop: 18,
  },
  kombinKutu: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255,255,255,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  kombinEmoji: { fontSize: 27 },

  rozetSatiri: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 16,
  },
  rozetMetin: { fontSize: 12, fontWeight: "800", letterSpacing: 0.2 },

  // Tek öneri: yatay ve geniş — ızgara boşluğu oluşmuyor.
  tekliAlan: { marginTop: 14 },
  satirKart: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(0,0,0,0.20)",
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 15,
  },
  satirIkonDaire: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  satirIkon: { fontSize: 23 },
  satirMetin: { flex: 1, gap: 3 },
  satirBaslik: { fontSize: 15, fontWeight: "800" },
  satirAciklama: { fontSize: 12.5, lineHeight: 17 },

  izgara: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  kutu: {
    width: "47.5%",
    flexGrow: 1,
    backgroundColor: "rgba(0,0,0,0.20)",
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 5,
  },
  kutuIkonDaire: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  kutuIkon: { fontSize: 21 },
  kutuBaslik: { fontSize: 13, fontWeight: "800", textAlign: "center" },
  kutuMetin: { fontSize: 11.5, lineHeight: 15, textAlign: "center" },

  kilitKutu: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 14,
    backgroundColor: "rgba(0,0,0,0.28)",
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  kilitIkon: { fontSize: 14 },
  kilitMetin: { color: "#FFFFFF", fontWeight: "700", fontSize: 13, flex: 1 },
  kilitAlt: { fontSize: 12, fontWeight: "800" },
});
