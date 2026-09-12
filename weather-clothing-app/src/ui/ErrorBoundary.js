import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";

/**
 * Uygulama genelinde hata sınırı.
 *
 * Bu olmadan, herhangi bir ekranda oluşan render hatası TÜM uygulamayı beyaz
 * ekrana düşürüyor: kullanıcı ne olduğunu anlamıyor, geri dönemiyor ve tek
 * çaresi uygulamayı kapatıp açmak. Mağazada bunun karşılığı 1 yıldız.
 *
 * React'te hata sınırı SINIF bileşeni olmak zorunda — hook karşılığı yok.
 *
 * Not: yalnızca RENDER sırasındaki hataları yakalar. Olay işleyicilerindeki
 * ve async kodlardaki hatalar buraya düşmez; onlar zaten kendi try/catch
 * bloklarında ele alınıyor.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hata: null };
  }

  static getDerivedStateFromError(hata) {
    return { hata };
  }

  componentDidCatch(hata, bilgi) {
    // Üretimde bir hata izleme servisi varsa buraya bağlanır. Şimdilik
    // konsola yazıyoruz — en azından geliştirme ve `adb logcat` sırasında
    // görünür oluyor.
    console.log("Yakalanan render hatası:", hata?.message, bilgi?.componentStack);
  }

  yenidenDene = () => {
    // State'i temizlemek bileşen ağacını yeniden kurar. Hata geçici bir
    // veriden kaynaklandıysa (bozuk API yanıtı gibi) uygulama toparlar.
    this.setState({ hata: null });
  };

  render() {
    if (!this.state.hata) return this.props.children;

    return (
      <View style={styles.kok}>
        <ScrollView contentContainerStyle={styles.icerik}>
          <Text style={styles.ikon}>🌧️</Text>
          <Text style={styles.baslik}>Bir şeyler ters gitti</Text>
          <Text style={styles.metin}>
            Beklenmedik bir hata oldu. Tekrar denemek çoğu zaman yeterli oluyor;
            sorun sürerse uygulamayı kapatıp açabilirsin.
          </Text>

          <TouchableOpacity
            style={styles.buton}
            onPress={this.yenidenDene}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Tekrar dene"
          >
            <Text style={styles.butonMetin}>Tekrar dene</Text>
          </TouchableOpacity>

          {__DEV__ && (
            <Text style={styles.ayrinti} selectable>
              {String(this.state.hata?.message ?? this.state.hata)}
            </Text>
          )}
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  kok: { flex: 1, backgroundColor: "#16233B" },
  icerik: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 14 },
  ikon: { fontSize: 54 },
  baslik: { color: "#fff", fontSize: 21, fontWeight: "800", textAlign: "center" },
  metin: {
    color: "rgba(255,255,255,0.70)",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 8,
  },
  buton: {
    backgroundColor: "#FFC65C",
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 34,
  },
  butonMetin: { color: "#241A4D", fontSize: 15, fontWeight: "800" },
  ayrinti: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    marginTop: 20,
    textAlign: "center",
    fontFamily: "monospace",
  },
});
