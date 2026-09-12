import React from "react";
import { View, Text, StyleSheet } from "react-native";

// Önümüzdeki 6 saatin yağışı, 15 dakikalık çubuklarla.
//
// Kullanıcının yağmurlu günde sorduğu soru "%60 ihtimal" değil: "şimdi
// çıksam ıslanır mıyım, yarım saat beklesem geçer mi?". Saatlik kovalarla
// bu soruya cevap verilemiyordu.
//
// Kart YALNIZCA kayda değer yağış varken görünüyor (yagisSeridi null
// dönerse hiç çizilmiyor); açık havada 24 boş çubuk göstermek gürültü olurdu.

const YAGMUR = "#7EC8F5";
const EN_KUCUK_YUKSEKLIK = 3;
const CUBUK_ALANI = 56;

export default function PrecipitationStrip({ serit, theme }) {
  if (!serit) return null;

  return (
    <View style={[styles.kart, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
      <View style={styles.baslikSatiri}>
        <Text style={styles.ikon}>💧</Text>
        <View style={styles.baslikMetin}>
          <Text style={[styles.ustEtiket, { color: theme.textMuted }]}>ÖNÜMÜZDEKİ 6 SAAT</Text>
          <Text style={[styles.ozet, { color: theme.textPrimary }]}>{serit.ozet}</Text>
        </View>
      </View>

      <View style={styles.grafik}>
        {serit.barlar.map((b) => (
          <View key={b.iso} style={styles.sutun}>
            <View
              style={[
                styles.cubuk,
                {
                  // Sıfır olmayan her yağış GÖRÜNMELİ: oranla çarpınca
                  // hafif yağış 1 piksel kalıyor ve fark edilmiyordu.
                  height: b.mm > 0
                    ? Math.max(EN_KUCUK_YUKSEKLIK, b.oran * CUBUK_ALANI)
                    : 1,
                  backgroundColor: b.mm > 0 ? YAGMUR : theme.cardBorder,
                  opacity: b.mm > 0 ? 0.55 + b.oran * 0.45 : 1,
                },
              ]}
            />
          </View>
        ))}
      </View>

      <View style={styles.saatSatiri}>
        {serit.barlar.map((b) => (
          <View key={b.iso} style={styles.sutun}>
            {/* Yalnızca tam saatler etiketli; her çeyreğe yazmak okunmuyor. */}
            {b.saatBasi && (
              <Text style={[styles.saatMetin, { color: theme.textMuted }]} numberOfLines={1}>
                {b.saat.slice(0, 2)}
              </Text>
            )}
          </View>
        ))}
      </View>

      <Text style={[styles.altBilgi, { color: theme.textMuted }]}>
        Toplam {serit.toplam.toFixed(1)} mm · en yoğun {serit.enBuyuk.toFixed(1)} mm
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  kart: { borderWidth: 1, borderRadius: 24, padding: 18, marginTop: 16 },

  baslikSatiri: { flexDirection: "row", alignItems: "center", gap: 12 },
  ikon: { fontSize: 20 },
  baslikMetin: { flex: 1, gap: 3 },
  ustEtiket: { fontSize: 10, fontWeight: "800", letterSpacing: 0.9 },
  ozet: { fontSize: 15, fontWeight: "700", lineHeight: 20 },

  grafik: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: CUBUK_ALANI,
    marginTop: 16,
    gap: 2,
  },
  sutun: { flex: 1, alignItems: "center" },
  cubuk: { width: "100%", borderRadius: 3 },

  saatSatiri: { flexDirection: "row", marginTop: 6, gap: 2 },
  saatMetin: { fontSize: 9.5, fontWeight: "700" },

  altBilgi: { fontSize: 11.5, fontWeight: "600", marginTop: 10 },
});
