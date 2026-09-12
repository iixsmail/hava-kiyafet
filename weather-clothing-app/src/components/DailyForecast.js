import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { describeWeatherCode } from "../api/weather";
import * as haptik from "../ui/haptics";

// 10 günlük tahmin — yatay kaydırmalı kart şeridi.
//
// Ücretsiz planda ilk 2 gün açık, kalanı kilitli. Tamamen gizlemek yerine
// kilitli kartları göstermeye devam ediyoruz: kullanıcı neyi kaçırdığını
// görmezse yükseltme sebebi de olmuyor.
const UCRETSIZ_GUN = 2;

// Sayı olmayan değeri "NaN°" diye basmamak için. Tek bir eksik gün eskiden
// Math.min/max'i NaN yapıp bütün şeridi bozuyordu.
const gecerli = (v) => typeof v === "number" && Number.isFinite(v);
const derece = (v) => (gecerli(v) ? `${Math.round(v)}°` : "—");

export default function DailyForecast({ days, theme, isPremium, onUpgradePress }) {
  if (!days || days.length === 0) return null;

  const acikSayi = isPremium ? days.length : Math.min(UCRETSIZ_GUN, days.length);

  return (
    <View style={[styles.kart, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
      <View style={styles.baslikSatiri}>
        <Text style={[styles.baslik, { color: theme.textSecondary }]}>10 GÜNLÜK TAHMİN</Text>
        {!isPremium && (
          <Text style={[styles.baslikNot, { color: theme.accent }]}>
            {days.length - acikSayi} gün kilitli
          </Text>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.serit}
      >
        {days.map((gun, i) => {
          const kilitli = i >= acikSayi;
          const { icon } = describeWeatherCode(gun.code);

          if (kilitli) {
            return (
              <TouchableOpacity
                key={gun.date}
                style={[styles.gunKart, styles.kilitliKart, { borderColor: theme.cardBorder }]}
                onPress={() => {
                  haptik.dokunus();
                  onUpgradePress?.();
                }}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`${gun.label} tahmini kilitli, Premium ile aç`}
              >
                <Text style={[styles.gunAd, { color: theme.textMuted }]}>{gun.label}</Text>
                <Text style={styles.kilitIkon}>🔒</Text>
                <Text style={[styles.kilitMetin, { color: theme.accent }]}>Premium</Text>
              </TouchableOpacity>
            );
          }

          return (
            <View
              key={gun.date}
              style={[
                styles.gunKart,
                { borderColor: theme.cardBorder },
                i === 0 && styles.bugunKart,
              ]}
              accessibilityRole="text"
              accessibilityLabel={`${gun.label}: en yüksek ${derece(gun.max)}, en düşük ${derece(gun.min)}`}
            >
              <Text style={[styles.gunAd, { color: i === 0 ? theme.textPrimary : theme.textMuted }]}>
                {gun.label}
              </Text>
              <Text style={styles.gunIkon}>{icon}</Text>
              {gun.rainChance > 15 ? (
                <Text style={styles.yagis}>%{Math.round(gun.rainChance)}</Text>
              ) : (
                <View style={styles.yagisBos} />
              )}
              <Text style={[styles.yuksek, { color: theme.textPrimary }]}>{derece(gun.max)}</Text>
              <Text style={[styles.dusuk, { color: theme.textMuted }]}>{derece(gun.min)}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  kart: { borderRadius: 22, borderWidth: 1, paddingVertical: 15, marginTop: 16 },
  baslikSatiri: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  baslik: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  baslikNot: { fontSize: 11, fontWeight: "700" },

  serit: { paddingHorizontal: 12, gap: 8 },
  gunKart: {
    width: 72,
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  bugunKart: { backgroundColor: "rgba(255,255,255,0.17)" },
  kilitliKart: { borderStyle: "dashed", justifyContent: "center" },

  gunAd: { fontSize: 12, fontWeight: "700" },
  gunIkon: { fontSize: 26, marginTop: 2 },
  yagis: { fontSize: 10, fontWeight: "700", color: "#8FD3FF" },
  yagisBos: { height: 13 },
  yuksek: { fontSize: 16, fontWeight: "700", marginTop: 2 },
  dusuk: { fontSize: 13, fontWeight: "500" },

  kilitIkon: { fontSize: 20, marginVertical: 6 },
  kilitMetin: { fontSize: 10, fontWeight: "800" },
});
