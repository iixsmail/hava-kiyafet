import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import ClothingSilhouette from "./ClothingSilhouette";

// Kombini bir figür üzerinde gösterir.
//
// Neden üretilmiş görsel değil: kullandığımız model görsel üretmiyor; ayrı bir görsel
// modeli eklemek her öneriyi pahalı ve yavaş yapardı — üstelik kullanıcının
// GERÇEK kıyafetini değil, ona benzeyen bir çizimi gösterirdi. Burada
// kullanıcının kendi fotoğrafları bir siluetin üstündeki bölgelere
// yerleştiriliyor: hem dürüst hem anında.

const BOS = {
  ust: { ikon: "👕", etiket: "Üst" },
  alt: { ikon: "👖", etiket: "Alt" },
  dis: { ikon: "🧥", etiket: "Dış" },
  ayakkabi: { ikon: "👟", etiket: "Ayakkabı" },
  aksesuar: { ikon: "🧣", etiket: "Aksesuar" },
};

function Slot({ katman, dolgu, style, kucuk }) {
  const bos = BOS[katman];

  // Fotoğraf varsa fotoğraf.
  if (dolgu?.uri) {
    return (
      <View style={[styles.slot, style]}>
        <Image source={{ uri: dolgu.uri }} style={styles.gorsel} resizeMode="cover" />
      </View>
    );
  }

  // Parça SEÇİLMİŞ ama fotoğrafı yok (katalogdan eklenmiş): siluet çiziyoruz.
  // Boş yuvayla aynı görünmesi, kombinde parça yokmuş gibi okunuyordu.
  if (dolgu) {
    return (
      <View style={[styles.slot, styles.slotSiluet, style]}>
        <ClothingSilhouette katman={katman} tur={dolgu.tur} size={kucuk ? 26 : 44} opak={0.75} />
      </View>
    );
  }

  return (
    <View style={[styles.slot, styles.slotBos, style]}>
      <Text style={kucuk ? styles.bosIkonKucuk : styles.bosIkon}>{bos.ikon}</Text>
      {!kucuk && <Text style={styles.bosEtiket}>{bos.etiket}</Text>}
    </View>
  );
}

export default function Avatar({ slotlar = {}, theme }) {
  return (
    <View style={styles.sahne}>
      {/* Siluet — kıyafetlerin arkasında duran nötr gövde */}
      <View style={styles.siluet} pointerEvents="none">
        <View style={[styles.kafa, { borderColor: theme.cardBorder }]} />
        <View style={[styles.govde, { borderColor: theme.cardBorder }]} />
        <View style={styles.bacakSatiri}>
          <View style={[styles.bacak, { borderColor: theme.cardBorder }]} />
          <View style={[styles.bacak, { borderColor: theme.cardBorder }]} />
        </View>
      </View>

      <View style={styles.katmanlar}>
        <View style={styles.ustSatir}>
          <Slot katman="dis" dolgu={slotlar.dis} style={styles.disSlot} kucuk />
          <Slot katman="ust" dolgu={slotlar.ust} style={styles.ustSlot} />
          <Slot katman="aksesuar" dolgu={slotlar.aksesuar} style={styles.aksesuarSlot} kucuk />
        </View>
        <Slot katman="alt" dolgu={slotlar.alt} style={styles.altSlot} />
        <Slot katman="ayakkabi" dolgu={slotlar.ayakkabi} style={styles.ayakkabiSlot} kucuk />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slotSiluet: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)" },
  sahne: { alignItems: "center", justifyContent: "center", paddingVertical: 6 },

  siluet: { ...StyleSheet.absoluteFillObject, alignItems: "center", paddingTop: 4 },
  kafa: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  govde: {
    width: 96,
    height: 130,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  bacakSatiri: { flexDirection: "row", gap: 8, marginTop: 4 },
  bacak: {
    width: 40,
    height: 108,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  katmanlar: { alignItems: "center" },
  ustSatir: { flexDirection: "row", alignItems: "center", gap: 8 },

  slot: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  slotBos: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.24)",
  },
  gorsel: { width: "100%", height: "100%" },

  disSlot: { width: 58, height: 104 },
  ustSlot: { width: 116, height: 132 },
  aksesuarSlot: { width: 58, height: 58, borderRadius: 29 },
  altSlot: { width: 108, height: 128, marginTop: 8 },
  ayakkabiSlot: { width: 96, height: 52, marginTop: 8 },

  bosIkon: { fontSize: 28, opacity: 0.75 },
  bosIkonKucuk: { fontSize: 20, opacity: 0.7 },
  bosEtiket: { color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: "600", marginTop: 3 },
});
