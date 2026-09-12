import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Svg, { Path, Circle, G } from "react-native-svg";
import * as haptik from "../ui/haptics";

// Gardırop girişi — uygulamanın asıl farkı burası.
//
// Önceden diğer gezinme satırlarıyla aynı boyda, aynı görünümdeydi ve "bavul
// asistanı"ndan ayırt edilemiyordu. Bir liste satırı, uygulamanın can alıcı
// özelliğini taşıyamaz: kullanıcı onu gezinme gürültüsü sanıp geçiyor.
//
// Kart iki farklı iş yapıyor:
//   gardırop BOŞSA  → davet: ne olduğunu anlat, ilk adımı kolay göster
//   gardırop DOLUYSA → eylem: bugünün kombinini üret
// İkisi tek bileşen çünkü aynı yerde duruyorlar ve kullanıcı için aynı şeyin
// iki hâli.

const ALTIN = "#FFC65C";

/** Basit vektör kıyafet siluetleri — emoji yerine, her boyutta net. */
function ParcaSilueti({ tur, renk = "#FFFFFF", opak = 1, size = 34 }) {
  const yollar = {
    tisort:
      "M18 8 L28 4 C30 8 34 10 38 10 C42 10 46 8 48 4 L58 8 L64 20 L56 24 L54 20 L54 58 C54 60 53 61 51 61 L25 61 C23 61 22 60 22 58 L22 20 L20 24 L12 20 Z",
    pantolon:
      "M24 6 L52 6 L54 30 L52 70 L42 70 L38 38 L34 70 L24 70 L22 30 Z",
    // Mont, tişörtten AÇIKÇA ayrılmalı: yakası dik, omuzları geniş, boyu uzun.
    // Aynı silueti iki kez göstermek "üç parça" izlenimini yok ediyordu.
    mont:
      "M16 12 L30 4 L38 12 L46 4 L60 12 L67 28 L58 32 L58 64 C58 66 57 67 55 67 L21 67 C19 67 18 66 18 64 L18 32 L9 28 Z",
    ayakkabi:
      "M14 46 L28 46 L34 52 C40 56 50 56 58 56 C62 56 64 58 64 62 L64 66 L14 66 Z",
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 76 76">
      <Path d={yollar[tur]} fill={renk} opacity={opak} />
      {/* Fermuar: montu tişörtten ilk bakışta ayıran işaret. */}
      {tur === "mont" && (
        <Path
          d="M38 12 L38 67"
          stroke="rgba(20,32,58,0.55)"
          strokeWidth={3}
          strokeLinecap="round"
          opacity={opak}
        />
      )}
    </Svg>
  );
}

/** Boş durumda gösterilen "yapay zeka + gardırop" görseli. */
function Sahne() {
  // Kıvılcım askılığın ÜSTÜNDE duruyor, parçaların üstünde değil: parçaların
  // üzerine bindiğinde siluetleri kesiyor ve görsel karmakarışık oluyordu.
  return (
    <Svg width={104} height={96} viewBox="0 0 104 96">
      <G transform="translate(80,13)">
        <Path d="M0 -12 L2.8 -2.8 L12 0 L2.8 2.8 L0 12 L-2.8 2.8 L-12 0 L-2.8 -2.8 Z" fill={ALTIN} />
        <Circle cx={16} cy={9} r={2.4} fill={ALTIN} opacity={0.8} />
        <Circle cx={-15} cy={8} r={1.8} fill={ALTIN} opacity={0.55} />
      </G>

      {/* askılık çubuğu */}
      <Path d="M8 32 L96 32" stroke="rgba(255,255,255,0.38)" strokeWidth={3} strokeLinecap="round" />
      {[22, 52, 82].map((x, i) => (
        <G key={x}>
          <Path
            d={`M${x} 32 L${x} 41`}
            stroke="rgba(255,255,255,0.38)"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <G transform={`translate(${x - 19},38) scale(0.52)`}>
            <ParcaSilueti
              tur={["tisort", "mont", "pantolon"][i]}
              renk="#FFFFFF"
              opak={[0.95, 0.8, 0.66][i]}
              size={76}
            />
          </G>
        </G>
      ))}
    </Svg>
  );
}

export default function WardrobeHeroCard({ parcaSayisi, theme, onAc }) {
  const bos = parcaSayisi === 0;

  return (
    <TouchableOpacity
      style={[styles.kart, { borderColor: bos ? ALTIN : theme.cardBorder }]}
      onPress={() => {
        haptik.dokunus();
        onAc();
      }}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={
        bos
          ? "Gardırobunu oluştur — parçalarını ekle, havaya göre kombin önerelim"
          : `Bugün ne giysem — ${parcaSayisi} parçandan kombin öner`
      }
    >
      <View style={styles.ustSatir}>
        <View style={styles.metinSutunu}>
          <View style={[styles.rozet, { borderColor: ALTIN }]}>
            <Text style={styles.rozetMetin}>✦ GARDIROBUN</Text>
          </View>
          <Text style={styles.baslik}>
            {bos ? "Kendi dolabından\nkombin öner" : "Bugün ne giysem?"}
          </Text>
          <Text style={styles.aciklama}>
            {bos
              ? "Dolabındaki parçaları işaretle; hava durumuna göre hangisini giyeceğini söyleyelim."
              : `${parcaSayisi} parçan hazır. Bugünün havasına uyan kombini seçelim.`}
          </Text>
        </View>

        <View style={styles.gorselKutu}>
          {bos ? (
            <Sahne />
          ) : (
            <View style={styles.parcaYigini}>
              <ParcaSilueti tur="tisort" opak={0.95} size={46} />
              <ParcaSilueti tur="pantolon" opak={0.7} size={46} />
              <ParcaSilueti tur="ayakkabi" opak={0.5} size={46} />
            </View>
          )}
        </View>
      </View>

      <View style={styles.butonSatiri}>
        <View style={styles.buton}>
          <Text style={styles.butonMetin}>
            {bos ? "İlk parçanı ekle" : "Kombin öner"}
          </Text>
          <Text style={styles.butonOk}>→</Text>
        </View>
        {bos && <Text style={styles.ipucu}>30 saniye sürer</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  kart: {
    marginTop: 18,
    borderRadius: 26,
    borderWidth: 1.5,
    padding: 18,
    // Diğer kartlardan belirgin biçimde daha koyu: gradyanın üstünde
    // "öne çıkan pano" hissi veriyor, sıradan bir satır gibi görünmüyor.
    backgroundColor: "rgba(12,20,38,0.55)",
    gap: 16,
  },

  ustSatir: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  metinSutunu: { flex: 1, gap: 9 },

  rozet: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  rozetMetin: { color: ALTIN, fontSize: 9.5, fontWeight: "900", letterSpacing: 1.1 },

  baslik: { color: "#FFFFFF", fontSize: 21, fontWeight: "800", lineHeight: 26, letterSpacing: -0.3 },
  aciklama: { color: "rgba(255,255,255,0.72)", fontSize: 13, lineHeight: 18.5 },

  gorselKutu: { width: 104, alignItems: "center", justifyContent: "flex-start" },
  parcaYigini: { flexDirection: "row", marginLeft: -6 },

  butonSatiri: { flexDirection: "row", alignItems: "center", gap: 12 },
  buton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: ALTIN,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 20,
  },
  butonMetin: { color: "#241A4D", fontSize: 14.5, fontWeight: "800" },
  butonOk: { color: "#241A4D", fontSize: 15, fontWeight: "800" },
  ipucu: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "600" },
});
