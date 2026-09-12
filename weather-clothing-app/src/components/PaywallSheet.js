import React, { useEffect, useRef } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from "react-native";
import * as haptik from "../ui/haptics";
import { usePremium } from "../context/PremiumContext";

const ALTIN = "#FFC65C";

// Kilitli özelliğe dokunulduğunda açılan mini paywall.
//
// Neden tam ekran paywall'a yönlendirmiyoruz: kullanıcı o an bir işin
// ortasında ("bavul listesi hazırlayayım"). Onu başka bir ekrana atmak
// bağlamı koparıyor ve dönüşümü düşürüyor. Burada ne istediğini hatırlatıp
// tek dokunuşla devam etme ya da kapatma imkânı veriyoruz.
//
// "Şimdi değil" HER ZAMAN görünür ve kapatma serbest. Kapatılamayan ya da
// çıkışı gizlenmiş paywall, Play'in "yanıltıcı abonelik akışı" maddesine
// giriyor ve kullanıcıyı da kaçırıyor.

export const KILITLI_OZELLIKLER = {
  bavul: {
    ikon: "🧳",
    baslik: "Bavul asistanı",
    metin:
      "Gideceğin yerin tahminine göre otomatik bavul listesi hazırlar ve gardırobundan eşleşen parçaları önerir.",
    faydalar: ["Tarih aralığına göre liste", "Gardıropla eşleştirme", "Hava koşuluna özel hatırlatmalar"],
  },
  etkinlik: {
    ikon: "💼",
    baslik: "Etkinlik kombinleri",
    metin:
      "İş, spor ve akşam yemeği için ayrı kombin modları. Aynı hava, farklı ortam — kıyafet de farklı olmalı.",
    faydalar: ["İş / resmi modu", "Spor modu", "Akşam yemeği modu"],
  },
  katman: {
    ikon: "🌡️",
    baslik: "Saat saat ne giymeli",
    metin:
      "Gün içinde sıcaklık çok değişiyorsa ne zaman üstünü çıkarıp ne zaman tekrar giyeceğini saat saat söyler.",
    // Yağış ve soğuma uyarıları ücretsize açıldı; paywall'da vaat etmek
    // artık yanıltıcı olurdu.
    faydalar: ["Saatlik çizelge", "10 günlük tam tahmin", "Gardırobundan kombin"],
  },
  tahmin: {
    ikon: "📅",
    baslik: "10 günlük tahmin",
    metin: "Ücretsiz planda 2 gün açık. Premium ile haftayı ve sonrasını önceden planla.",
    faydalar: ["10 günün tamamı", "Günlük yağış ihtimali", "Seyahat planlaması"],
  },
  gardirop: {
    ikon: "👕",
    baslik: "Sınırsız gardırop",
    metin:
      "Ücretsiz planda 20 parça saklanabiliyor. Premium ile gardırobunun tamamını ekle — öneriler de o kadar isabetli olur.",
    faydalar: ["Sınırsız parça", "Ayda 500 fotoğraf tanıma", "Kumaş bazlı öneri"],
  },
};

export default function PaywallSheet({ gorunur, ozellik, onKapat, onPremium }) {
  const { planlar, varsayilanPlan } = usePremium();
  const kaydir = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(kaydir, {
      toValue: gorunur ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [gorunur, kaydir]);

  const bilgi = KILITLI_OZELLIKLER[ozellik];
  if (!bilgi) return null;

  const cevir = kaydir.interpolate({ inputRange: [0, 1], outputRange: [420, 0] });

  return (
    <Modal visible={gorunur} transparent animationType="fade" onRequestClose={onKapat} statusBarTranslucent>
      <View style={styles.perde}>
        {/* Perdeye dokunmak da kapatıyor — çıkışı zorlaştırmıyoruz. */}
        <TouchableOpacity style={styles.perdeAlan} activeOpacity={1} onPress={onKapat} />

        <Animated.View style={[styles.sayfa, { transform: [{ translateY: cevir }] }]}>
          <View style={styles.tutamak} />

          <View style={styles.ikonDaire}>
            <Text style={styles.ikon}>{bilgi.ikon}</Text>
          </View>

          <Text style={styles.rozet}>PREMIUM ÖZELLİK</Text>
          <Text style={styles.baslik}>{bilgi.baslik}</Text>
          <Text style={styles.metin}>{bilgi.metin}</Text>

          <View style={styles.faydaListe}>
            {bilgi.faydalar.map((f) => (
              <View key={f} style={styles.faydaSatir}>
                <Text style={styles.faydaTik}>✦</Text>
                <Text style={styles.faydaMetin}>{f}</Text>
              </View>
            ))}
          </View>

          {/* Fiyat YALNIZCA Play'den geldiyse. Yer tutucu rakam yazıp gerçek
              fiyat farklı çıkarsa yanıltıcı beyan olur. */}
          {varsayilanPlan?.fiyat ? (
            <Text style={styles.fiyat}>
              {varsayilanPlan.donemMetni.sifat} {varsayilanPlan.fiyat}
              {varsayilanPlan.tasarrufYuzde > 0 ? ` · %${varsayilanPlan.tasarrufYuzde} avantaj` : ""}
            </Text>
          ) : planlar.length === 0 ? (
            <Text style={styles.fiyatBos}>Planlar mağazadan yüklenecek</Text>
          ) : null}

          <TouchableOpacity
            style={styles.anaButon}
            onPress={() => {
              haptik.dokunus();
              onKapat();
              onPremium?.();
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Premium planlarını gör"
          >
            <Text style={styles.anaButonMetin}>Premium'u incele</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.kapatButon}
            onPress={() => {
              haptik.dokunus();
              onKapat();
            }}
            accessibilityRole="button"
            accessibilityLabel="Şimdi değil"
          >
            <Text style={styles.kapatMetin}>Şimdi değil</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  perde: { flex: 1, backgroundColor: "rgba(0,0,0,0.58)", justifyContent: "flex-end" },
  perdeAlan: { flex: 1 },
  sayfa: {
    backgroundColor: "#1B2740",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 30,
    alignItems: "center",
  },
  tutamak: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.28)",
    marginBottom: 20,
  },
  ikonDaire: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "rgba(255,198,92,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,198,92,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  ikon: { fontSize: 30 },
  rozet: { color: ALTIN, fontSize: 10, fontWeight: "800", letterSpacing: 1.3, marginTop: 14 },
  baslik: { color: "#fff", fontSize: 23, fontWeight: "800", marginTop: 6, textAlign: "center" },
  metin: {
    color: "rgba(255,255,255,0.70)",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 10,
  },

  faydaListe: { alignSelf: "stretch", gap: 10, marginTop: 20 },
  faydaSatir: { flexDirection: "row", alignItems: "center", gap: 10 },
  faydaTik: { color: ALTIN, fontSize: 13, fontWeight: "800" },
  faydaMetin: { color: "rgba(255,255,255,0.88)", fontSize: 14, flex: 1 },

  fiyat: { color: ALTIN, fontSize: 14, fontWeight: "800", marginTop: 20 },
  fiyatBos: { color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 20 },

  anaButon: {
    alignSelf: "stretch",
    backgroundColor: ALTIN,
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: "center",
    marginTop: 18,
  },
  anaButonMetin: { color: "#241A4D", fontSize: 16, fontWeight: "800" },
  kapatButon: { paddingVertical: 14 },
  kapatMetin: { color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: "600" },
});
