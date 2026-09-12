import React, { useEffect, useRef } from "react";
import { Animated, View, StyleSheet, Easing } from "react-native";

// İskelet (shimmer) yükleme durumları.
//
// Neden spinner değil: dönen bir çember "bir şey oluyor" der ama "ne
// geleceğini" söylemez; ekran veri gelince zıplar. İskelet, gelecek içeriğin
// yerini önceden tutar — algılanan bekleme süresi kısalır ve düzen oturmuş
// kalır.
//
// Animasyon useNativeDriver ile JS iş parçacığından çıkarılıyor: veri
// çekilirken JS meşgul olsa bile parıltı takılmıyor.

function useParilti() {
  const deger = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const dongu = Animated.loop(
      Animated.sequence([
        Animated.timing(deger, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(deger, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    dongu.start();
    return () => dongu.stop();
  }, [deger]);

  return deger.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
}

/** Tek bir iskelet bloğu. */
export function Kemik({ w = "100%", h = 14, r = 8, style }) {
  const opaklik = useParilti();
  return (
    <Animated.View
      style={[
        styles.kemik,
        { width: w, height: h, borderRadius: r, opacity: opaklik },
        style,
      ]}
    />
  );
}

/** Ana ekranın hava durumu bölümünün iskeleti. */
export function HavaIskeleti() {
  return (
    <View style={styles.hava}>
      <Kemik w={140} h={13} r={7} />
      <Kemik w={88} h={88} r={44} style={{ marginTop: 16 }} />
      <Kemik w={150} h={64} r={16} style={{ marginTop: 12 }} />
      <Kemik w={110} h={17} r={9} style={{ marginTop: 10 }} />

      <View style={styles.mikroSatir}>
        {[0, 1, 2, 3].map((i) => (
          <Kemik key={i} w="23%" h={72} r={18} />
        ))}
      </View>

      <Kemik h={128} r={22} style={{ marginTop: 16 }} />
      <Kemik h={112} r={22} style={{ marginTop: 14 }} />
    </View>
  );
}

/** Gardırop ızgarasının iskeleti. */
export function GardiropIskeleti({ adet = 6 }) {
  return (
    <View style={styles.izgara}>
      {Array.from({ length: adet }).map((_, i) => (
        <Kemik key={i} w="31.5%" h={132} r={16} />
      ))}
    </View>
  );
}

/** Kombin önerisi beklenirken. */
export function KombinIskeleti() {
  return (
    <View style={{ gap: 12 }}>
      <Kemik w="70%" h={18} r={9} style={{ alignSelf: "center" }} />
      <Kemik w="90%" h={13} r={7} style={{ alignSelf: "center" }} />
      <Kemik h={64} r={16} style={{ marginTop: 8 }} />
      <Kemik h={64} r={16} />
      <Kemik h={64} r={16} />
    </View>
  );
}

const styles = StyleSheet.create({
  kemik: { backgroundColor: "rgba(255,255,255,0.18)" },
  hava: { alignItems: "center", marginTop: 8 },
  mikroSatir: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 22,
  },
  izgara: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
});
