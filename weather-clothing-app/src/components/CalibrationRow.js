import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import * as haptik from "../ui/haptics";
import { useKalibrasyon } from "../hooks/useKalibrasyon";

// "Bu öneri nasıldı?" — kişisel sıcaklık kalibrasyonunun giriş noktası.
//
// Tek dokunuş bilinçli: üç seçenekten fazlası ya da serbest metin, her gün
// tekrarlanacak bir eylem için fazla maliyetli olur ve kimse doldurmaz.
//
// Dokunuştan sonra çipler kaybolmuyor, seçili hâlde kalıyor: kullanıcı ne
// dediğini görebilsin ve yanlış dokunduysa aynı gün içinde düzeltebilsin
// (aynı gün ikinci dokunuş ekleme değil, revize sayılıyor).

const SECENEKLER = [
  { etiket: "usudum", ikon: "🥶", metin: "Üşüdüm" },
  { etiket: "tamOldu", ikon: "👌", metin: "Tam oldu" },
  { etiket: "terledim", ikon: "🥵", metin: "Terledim" },
];

export default function CalibrationRow({ theme }) {
  const { geriBildir, aciklama, olgun, sayac } = useKalibrasyon();
  // Yalnızca bu oturumda dokunulanı vurguluyoruz. Kalıcı olarak "dün üşüdüm
  // demiştin" göstermek, bugünün sorusunu cevaplanmış gibi gösterirdi.
  const [secilen, setSecilen] = useState(null);

  const dokun = (etiket) => {
    haptik.dokunus();
    setSecilen(etiket);
    geriBildir(etiket);
  };

  return (
    <View style={[styles.kutu, { borderColor: theme.cardBorder }]}>
      <Text style={[styles.soru, { color: theme.textSecondary }]}>
        {secilen ? "Kaydedildi — öneri buna göre ayarlanıyor." : "Bu öneri sana nasıl geldi?"}
      </Text>

      <View style={styles.serit}>
        {SECENEKLER.map((s) => {
          const aktif = secilen === s.etiket;
          return (
            <TouchableOpacity
              key={s.etiket}
              style={[
                styles.cip,
                { borderColor: theme.cardBorder },
                aktif && { backgroundColor: theme.accent, borderColor: theme.accent },
              ]}
              onPress={() => dokun(s.etiket)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: aktif }}
              accessibilityLabel={`${s.metin} — öneriyi buna göre ayarla`}
            >
              <Text style={styles.cipIkon}>{s.ikon}</Text>
              <Text
                style={[
                  styles.cipMetin,
                  { color: theme.textPrimary },
                  aktif && styles.cipMetinAktif,
                ]}
              >
                {s.metin}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Ne öğrendiğimizi açıkça söylüyoruz. Sessizce eşik kaydıran bir
          uygulama, kullanıcıya tutarsız görünür. */}
      {(olgun || sayac > 0) && (
        <Text style={[styles.durum, { color: theme.textMuted }]}>{aciklama}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  kutu: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    gap: 10,
  },
  soru: { fontSize: 12.5, fontWeight: "700" },
  serit: { flexDirection: "row", gap: 8 },
  cip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  cipIkon: { fontSize: 14 },
  cipMetin: { fontSize: 12.5, fontWeight: "700" },
  cipMetinAktif: { color: "#241A4D", fontWeight: "800" },
  durum: { fontSize: 11.5, lineHeight: 16 },
});
