import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { describeWeatherCode } from "../api/weather";
import WeatherGlyph from "./WeatherGlyph";
import GlyphHalo from "./GlyphHalo";

// Ekranın üst bölümü — Apple Weather hiyerarşisi:
//   konum (küçük) → ikon → DERECE (dev) → durum + günün aralığı
//
// Ölçüm kartları buradan çıkarıldı (artık MicroCards). Sebep: derecenin
// hemen altına dört küçük sayı sıkıştırmak göz hiyerarşisini bozuyordu —
// asıl bilgi olan sıcaklık ile yardımcı bilgiler aynı ağırlıkta
// görünüyordu.
/**
 * Düne göre fark cümlesi.
 *
 * İnsanlar mutlak dereceye değil DÜNE kalibre oluyor: "23°" tek başına bir
 * şey söylemiyor, "dünden 6° soğuk" ceket kararını doğrudan değiştiriyor.
 *
 * 2° eşiği bilinçli: altındaki farklar hissedilmiyor ve her gün bir satır
 * daha göstermek hiyerarşiyi bozar.
 */
function dunCumlesi(dunFarki) {
  if (!dunFarki) return null;
  const f = Math.round(dunFarki.fark);
  if (Math.abs(f) < 2) return "Dünkü gibi";
  return f < 0 ? `Dünden ${Math.abs(f)}° soğuk` : `Dünden ${f}° sıcak`;
}

export default function WeatherCard({ locationName, current, theme, bugun, dunFarki, kalan }) {
  if (!current) return null;
  const { text, icon } = describeWeatherCode(current.weather_code, current.is_day);

  const derece = Math.round(current.temperature_2m);
  const hissedilen = current.apparent_temperature;
  const hissFarki =
    typeof hissedilen === "number" && Math.abs(hissedilen - current.temperature_2m) >= 1.5;

  return (
    <View
      style={styles.hero}
      accessibilityRole="header"
      accessibilityLabel={`${locationName}, ${derece} derece, ${text}`}
    >
      <View style={styles.konumSatiri}>
        <Text style={[styles.konumIkon, { color: theme.textSecondary }]}>📍</Text>
        <Text style={[styles.konum, { color: theme.textSecondary }]} numberOfLines={1}>
          {locationName}
        </Text>
      </View>

      {/* Emoji yerine vektör: 76pt emoji Android'de büyütülmüş bir bitmap
          olarak çiziliyor ve pikselleşiyor.
          Arkasındaki hale ikonu düz zeminden ayırıyor; yalnızca ikonun
          arkasında duruyor, metinlerin altına girmiyor. */}
      <View style={styles.glifKutu}>
        <GlyphHalo mood={theme.mood} size={HALE_BOYU} />
        <WeatherGlyph
          code={current.weather_code}
          isDay={current.is_day}
          size={GLIF_BOYU}
          style={styles.glif}
        />
      </View>

      <View style={styles.dereceSatiri}>
        <Text style={[styles.derece, { color: theme.textPrimary }]}>{derece}</Text>
        <Text style={[styles.dereceIsareti, { color: theme.textSecondary }]}>°</Text>
      </View>

      <Text style={[styles.aciklama, { color: theme.textPrimary }]}>{text}</Text>

      <View style={styles.altSatir}>
        {dunCumlesi(dunFarki) && (
          <View style={[styles.dunRozet, { borderColor: theme.cardBorder }]}>
            <Text style={[styles.dunMetin, { color: theme.textSecondary }]}>
              {dunCumlesi(dunFarki)}
            </Text>
          </View>
        )}
        {bugun && (
          <Text style={[styles.aralik, { color: theme.textSecondary }]}>
            En yüksek {Math.round(bugun.max)}° · En düşük {Math.round(bugun.min)}°
          </Text>
        )}
        {/* GÜNÜN KALANI.
            Y/D değerleri takvim gününe ait; öğleden sonra bakan kullanıcı
            için gecenin en düşüğü çoktan geçmiş oluyor. Erzurum'da ölçtüm:
            kart 13° derken günün kalanı yalnızca 17°'ye iniyordu ve
            kullanıcı gelmeyecek bir akşam serinliğine göre mont alıyordu.
            Yalnızca gerçekten daraldığında görünüyor. */}
        {kalan && (
          <Text style={[styles.kalan, { color: theme.textSecondary }]}>
            {kalan}
          </Text>
        )}
        {/* Hissedilen sıcaklığı yalnızca ölçümden belirgin farklıysa
            gösteriyoruz — "22°, hissedilen 22°" satırı yer kaplayıp
            hiçbir şey söylemiyordu. */}
        {hissFarki && (
          <Text style={[styles.hissedilen, { color: theme.textMuted }]}>
            Hissedilen {Math.round(hissedilen)}°
          </Text>
        )}
      </View>
    </View>
  );
}

// İkon ve hale boyutları tek yerde: stil hesabı bunlara dayanıyor.
const GLIF_BOYU = 132;
const HALE_BOYU = 228;
const FAZLA = (HALE_BOYU - GLIF_BOYU) / 2;

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingTop: 6 },
  konumSatiri: { flexDirection: "row", alignItems: "center", gap: 5 },
  konumIkon: { fontSize: 12 },
  konum: { fontSize: 15, fontWeight: "600", maxWidth: "80%", letterSpacing: 0.2 },

  // Gölge, ikonu zeminden ayırıyor: gradyanın üstünde düz duran ikon
  // "yapıştırılmış" gibi görünüyordu.
  // Kap, HALE boyutunda sabit bir kare: hale onu tam dolduruyor, ikon da
  // ortasında duruyor. Kabı ikon boyutunda bırakıp haleyi yüzdeyle
  // ortalamayı denedik, react-native-svg'de tutmadı.
  //
  // Kap ikondan büyük olduğu için aradaki FAZLA payı negatif kenar
  // boşluğuyla geri alıyoruz; yoksa hale, üstündeki ve altındaki metinleri
  // birbirinden uzaklaştırırdı.
  glifKutu: {
    width: HALE_BOYU,
    height: HALE_BOYU,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8 - FAZLA,
    marginBottom: -6 - FAZLA,
  },
  glif: {
    shadowColor: "rgba(0,0,0,0.35)",
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 14,
    shadowOpacity: 1,
  },

  dereceSatiri: { flexDirection: "row", alignItems: "flex-start" },
  derece: { fontSize: 96, fontWeight: "200", letterSpacing: -5, lineHeight: 104 },
  dereceIsareti: { fontSize: 44, fontWeight: "200", marginTop: 10, letterSpacing: -2 },

  aciklama: { fontSize: 19, fontWeight: "600", marginTop: -6, letterSpacing: 0.2 },
  altSatir: { alignItems: "center", gap: 2, marginTop: 6 },
  dunRozet: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 6,
  },
  dunMetin: { fontSize: 12.5, fontWeight: "700", letterSpacing: 0.2 },
  aralik: { fontSize: 15, fontWeight: "600", letterSpacing: 0.3 },
  // Y/D'den bir tık silik: aynı bilginin daraltılmış hâli, onunla
  // yarışmamalı ama okunabilir kalmalı.
  kalan: { fontSize: 13, fontWeight: "600", letterSpacing: 0.2 },
  hissedilen: { fontSize: 12, fontWeight: "500" },
});
