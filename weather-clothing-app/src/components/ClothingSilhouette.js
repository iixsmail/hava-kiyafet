import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";

// Katmana göre vektör kıyafet silueti.
//
// İki yerde gerekiyor:
//   1) hazır katalog listesinde (henüz fotoğraf yok)
//   2) katalogdan eklenmiş parçaların gardırop/kombin/bavul ekranlarındaki
//      görselinde (hiç fotoğraf olmayacak)
//
// Fotoğrafsız parçayı boş bir kutu olarak çizmek "bozuk" hissi veriyordu;
// siluet, parçanın ne olduğunu tek bakışta anlatıyor.

// Katman bazlı temel siluetler.
const YOLLAR = {
  ust: "M18 8 L28 4 C30 8 34 10 38 10 C42 10 46 8 48 4 L58 8 L64 20 L56 24 L54 20 L54 58 C54 60 53 61 51 61 L25 61 C23 61 22 60 22 58 L22 20 L20 24 L12 20 Z",
  alt: "M24 6 L52 6 L54 30 L52 70 L42 70 L38 38 L34 70 L24 70 L22 30 Z",
  dis: "M16 12 L30 4 L38 12 L46 4 L60 12 L67 28 L58 32 L58 64 C58 66 57 67 55 67 L21 67 C19 67 18 66 18 64 L18 32 L9 28 Z",
  ayakkabi:
    "M12 44 L27 44 L33 51 C39 56 50 57 58 57 C63 57 66 59 66 63 L66 68 L12 68 Z",
  aksesuar:
    "M20 18 C20 12 26 8 38 8 C50 8 56 12 56 18 L56 24 L48 24 L48 19 C48 16 44 15 38 15 C32 15 28 16 28 19 L28 62 C28 66 25 68 22 68 C19 68 16 66 16 62 L16 24 L20 24 Z",
};

// Tür bazlı siluetler.
//
// Katalog ekranında bir katmandaki sekiz kalem de aynı tişörtü gösteriyordu;
// ikon hiçbir şey anlatmıyor, yalnızca gürültü ekliyordu. Görsel olarak
// AÇIKÇA ayrılan türlere kendi şeklini veriyoruz, kalanlar katman siluetine
// düşüyor.
const TUR_YOLLARI = {
  // Üst
  "uzun kollu":
    "M18 8 L28 4 C30 8 34 10 38 10 C42 10 46 8 48 4 L58 8 L66 22 L64 48 L55 48 L54 26 L54 58 C54 60 53 61 51 61 L25 61 C23 61 22 60 22 58 L22 26 L21 48 L12 48 L10 22 Z",
  atlet:
    "M27 8 L33 5 C34 10 36 12 38 12 C40 12 42 10 43 5 L49 8 L50 20 L48 22 L48 58 C48 60 47 61 45 61 L31 61 C29 61 28 60 28 58 L28 22 L26 20 Z",
  etek: "M28 8 L48 8 L50 22 L58 62 C58 64 57 65 55 65 L21 65 C19 65 18 64 18 62 L26 22 Z",
  // Alt
  "şort": "M24 6 L52 6 L54 24 L52 44 L42 44 L38 28 L34 44 L24 44 L22 24 Z",
  tayt: "M27 6 L49 6 L50 26 L47 70 L41 70 L38 34 L35 70 L29 70 L26 26 Z",
  // Ayakkabı
  bot: "M20 20 L34 20 L34 46 C40 52 52 54 60 54 C64 54 66 56 66 60 L66 68 L20 68 Z",
  // Taban + Y bantlar. Önceki hâli yalnızca çizgiyle çiziliyordu ve
  // "kapaklı kutu" gibi görünüyordu; artık dolgu, sandalet gibi okunuyor.
  sandalet:
    "M12 56 L64 56 C67 56 68 58 68 61 C68 65 66 67 63 67 L17 67 C14 67 12 65 12 61 Z"
    + " M27 56 L37 38 L43 41 L34 56 Z"
    + " M49 56 L39 38 L44 36 L55 56 Z",
  // Aksesuar
  bere: "M18 44 C18 24 26 12 38 12 C50 12 58 24 58 44 L60 44 C63 44 64 46 64 49 C64 52 63 54 60 54 L16 54 C13 54 12 52 12 49 C12 46 13 44 16 44 Z",
  // Atkı: üst üste iki DALGALI bant — katlanmış kumaş.
  //
  // İki deneme başarısız oldu: tek kıvrımlı hâli bastona, boyun bandı +
  // iki sarkan uç hâli "π" harfine benziyordu. Dalgalı bant, 38 pikselde
  // bile kumaş olarak okunuyor ve bere/şapkadan açıkça ayrılıyor.
  "atkı":
    "M10 20 C19 11 30 11 38 18 C46 25 57 25 66 16 L66 31 C57 40 46 40 38 33 C30 26 19 26 10 35 Z"
    + " M10 44 C19 35 30 35 38 42 C46 49 57 49 66 40 L66 55 C57 64 46 64 38 57 C30 50 19 50 10 59 Z",
  "şapka":
    "M20 40 C20 22 27 12 38 12 C49 12 56 22 56 40 L66 44 C69 45 70 47 70 50 L6 50 C6 47 7 45 10 44 Z",
  eldiven:
    "M24 30 C24 26 26 24 29 24 L29 16 C29 13 31 11 34 11 C37 11 39 13 39 16 L39 24 L42 24 L42 18 C42 15 44 13 47 13 C50 13 52 15 52 18 L52 46 C52 60 44 68 36 68 C28 68 22 60 22 50 L22 36 C22 33 23 31 26 31 Z",
};

export default function ClothingSilhouette({ katman, tur, size = 44, renk = "#FFFFFF", opak = 0.9 }) {
  const turYolu = tur ? TUR_YOLLARI[tur] : null;
  const yol = turYolu ?? YOLLAR[katman] ?? YOLLAR.ust;

  return (
    <Svg width={size} height={size} viewBox="0 0 76 76">
      <Path d={yol} fill={renk} opacity={opak} />
      {/* Gömleğin yakası ve düğme sırası: tişörtten ilk bakışta ayırıyor. */}
      {tur === "gömlek" && (
        <>
          <Path d="M38 12 L30 22 L38 26 L46 22 Z" fill="rgba(20,32,58,0.55)" opacity={opak} />
          <Path d="M38 28 L38 60" stroke="rgba(20,32,58,0.45)" strokeWidth={2.5} strokeLinecap="round" opacity={opak} />
        </>
      )}
      {/* Kazak/sweatshirt: örgü hissi için etek lastiği. */}
      {(tur === "kazak" || tur === "sweatshirt") && (
        <Path d="M23 53 L53 53" stroke="rgba(20,32,58,0.4)" strokeWidth={4} opacity={opak} />
      )}
      {/* Hırka açık önlü. */}
      {tur === "hırka" && (
        <Path d="M38 12 L38 61" stroke="rgba(20,32,58,0.5)" strokeWidth={3} strokeLinecap="round" opacity={opak} />
      )}
      {(katman === "dis" && !turYolu) && (
        <Path
          d="M38 12 L38 67"
          stroke="rgba(20,32,58,0.5)"
          strokeWidth={3}
          strokeLinecap="round"
          opacity={opak}
        />
      )}
    </Svg>
  );
}

/**
 * Parçanın görseli: fotoğraf varsa o, yoksa siluet.
 *
 * `cocuk` olarak <Image> geçiliyor — bu bileşen görseli kendi çizmiyor ki
 * her ekran kendi boyut/köşe stilini uygulayabilsin.
 */
export function ParcaGorseli({ uri, katman, boyut = 56, cocuk = null, style }) {
  if (uri) return cocuk;
  return (
    <View style={[styles.bos, { width: boyut, height: boyut, borderRadius: boyut * 0.28 }, style]}>
      <ClothingSilhouette katman={katman} size={boyut * 0.72} opak={0.55} />
    </View>
  );
}

const styles = StyleSheet.create({
  bos: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
});
