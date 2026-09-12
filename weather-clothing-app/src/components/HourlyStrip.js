import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { describeWeatherCode } from "../api/weather";

// Önümüzdeki 24 saat — yatay kaydırmalı şerit.
//
// "Şimdi" sütunu vurgulanıyor ve gündüz/gece ikonu saat bazında değişiyor:
// gece 23:00'te güneş göstermek yanlış görünüyordu.
export default function HourlyStrip({ hours, theme }) {
  if (!hours || hours.length === 0) return null;

  return (
    <View style={[styles.kart, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
      <Text style={[styles.baslik, { color: theme.textSecondary }]}>SAATLİK TAHMİN</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.serit}
      >
        {hours.map((saat, i) => {
          const { icon } = describeWeatherCode(saat.code, saat.isDay);
          const simdi = i === 0;
          const derece =
            typeof saat.temp === "number" && Number.isFinite(saat.temp)
              ? `${Math.round(saat.temp)}°`
              : "—";

          return (
            <View
              key={saat.time}
              style={[styles.sutun, simdi && styles.sutunSimdi]}
              accessibilityRole="text"
              accessibilityLabel={`${saat.label}: ${derece}`}
            >
              <Text
                style={[
                  styles.saat,
                  { color: simdi ? theme.textPrimary : theme.textMuted },
                  simdi && styles.saatVurgu,
                ]}
              >
                {saat.label}
              </Text>
              <Text style={styles.ikon}>{icon}</Text>
              {saat.rainChance > 15 ? (
                <Text style={styles.yagis}>%{Math.round(saat.rainChance)}</Text>
              ) : (
                <View style={styles.yagisBos} />
              )}
              <Text style={[styles.derece, { color: theme.textPrimary }]}>{derece}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  kart: { borderRadius: 22, borderWidth: 1, paddingVertical: 15, marginTop: 16 },
  baslik: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  serit: { paddingHorizontal: 12, gap: 6 },
  sutun: {
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    gap: 5,
    minWidth: 60,
  },
  sutunSimdi: { backgroundColor: "rgba(255,255,255,0.17)" },
  saat: { fontSize: 12, fontWeight: "600" },
  saatVurgu: { fontWeight: "800" },
  ikon: { fontSize: 24 },
  yagis: { fontSize: 10, fontWeight: "700", color: "#8FD3FF" },
  yagisBos: { height: 13 },
  derece: { fontSize: 16, fontWeight: "700" },
});
