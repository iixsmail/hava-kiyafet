import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import * as haptik from "../ui/haptics";

// Saatlik katman değişim çizelgesi.
//
// Yalnızca gün içi fark 5°C ve üzeriyse görünüyor (plan null dönüyorsa hiç
// render edilmiyor). Her gün göstermek uyarıyı anlamsızlaştırırdı; bu tür
// bir kart ancak seyrek ve isabetli olduğunda değerli.
//
// Ücretsiz kullanıcıya kartın BAŞLIĞI ve farkı gösteriliyor, adımlar kilitli.
// Tamamen gizlemek yerine ne kaçırdığını göstermek yükseltme sebebi yaratıyor.

const EYLEM_IKON = {
  baslangic: "🚪",
  cikar: "☀️",
  ekle: "🧥",
  yagis: "☂️",
};

export default function LayerPlanCard({ plan, theme, isPremium, onKilit }) {
  if (!plan) return null;

  return (
    <View style={[styles.kart, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
      <View style={styles.baslikSatiri}>
        <View style={styles.ikonDaire}>
          <Text style={styles.baslikIkon}>🌡️</Text>
        </View>
        <View style={styles.baslikMetin}>
          <Text style={[styles.ustEtiket, { color: theme.textMuted }]}>
            {plan.kapsam === "gece" ? "GECE BOYUNCA" : "GÜN İÇİ DEĞİŞİM"}
          </Text>
          <Text style={[styles.baslik, { color: theme.textPrimary }]}>
            {plan.fark}° fark var — katman planla
          </Text>
        </View>
      </View>

      <View style={styles.aralikSatiri}>
        <Text style={[styles.aralikMetin, { color: theme.textSecondary }]}>
          {plan.enDusuk.saat} · {plan.enDusuk.derece}°
        </Text>
        <View style={[styles.cizgi, { backgroundColor: theme.cardBorder }]} />
        <Text style={[styles.aralikMetin, { color: theme.textSecondary }]}>
          {plan.enYuksek.saat} · {plan.enYuksek.derece}°
        </Text>
      </View>

      {isPremium ? (
        <View style={styles.adimListe}>
          {plan.adimlar.map((a, i) => (
            <View key={`${a.saat}-${i}`} style={styles.adimSatir}>
              <View style={styles.adimSol}>
                <Text style={styles.adimIkon}>{EYLEM_IKON[a.eylem] ?? "•"}</Text>
                {i < plan.adimlar.length - 1 && (
                  <View style={[styles.dikeyCizgi, { backgroundColor: theme.cardBorder }]} />
                )}
              </View>
              <View style={styles.adimMetin}>
                <Text style={[styles.adimSaat, { color: theme.textMuted }]}>{a.saat}</Text>
                <Text style={[styles.adimAciklama, { color: theme.textPrimary }]}>{a.metin}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.kilitKutu, { borderColor: theme.accent }]}
          onPress={() => {
            haptik.dokunus();
            onKilit?.("katman");
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Saat saat giyinme planını Premium ile aç"
        >
          <Text style={styles.kilitIkon}>🔒</Text>
          <Text style={styles.kilitMetin}>
            {plan.adimlar.length} adımlık saatlik plan
          </Text>
          <Text style={[styles.kilitAlt, { color: theme.accent }]}>Premium ile aç →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  kart: { borderWidth: 1, borderRadius: 24, padding: 18, marginTop: 16 },

  baslikSatiri: { flexDirection: "row", alignItems: "center", gap: 12 },
  ikonDaire: {
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
  baslik: { fontSize: 15, fontWeight: "700", lineHeight: 20 },

  aralikSatiri: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },
  aralikMetin: { fontSize: 13, fontWeight: "700" },
  cizgi: { flex: 1, height: 1 },

  adimListe: { marginTop: 16 },
  adimSatir: { flexDirection: "row", gap: 12 },
  adimSol: { alignItems: "center", width: 26 },
  adimIkon: { fontSize: 17 },
  dikeyCizgi: { width: 1, flex: 1, marginVertical: 4 },
  adimMetin: { flex: 1, paddingBottom: 14, gap: 2 },
  adimSaat: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },
  adimAciklama: { fontSize: 13.5, lineHeight: 19 },

  kilitKutu: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 16,
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
