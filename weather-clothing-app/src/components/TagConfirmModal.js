import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  Image,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  useWindowDimensions,
} from "react-native";
import * as haptik from "../ui/haptics";

// Gemini analizinden sonra kullanıcıya çıkan onay ekranı.
//
// Neden var: görsel çıkarım genelde doğru ama her zaman değil — "lacivert"
// dediği şey siyah olabilir, süveteri hırka sanabilir. Kullanıcı yanlışı
// düzeltemezse, o yanlış bilgi bütün kombin önerilerini bozar ve kullanıcı
// nedenini anlamaz. Burada düzeltmek, sonradan "öneriler saçma" demesinden
// çok daha ucuz.
//
// Her alan tek dokunuşla değişiyor; serbest metin yalnızca isim ve renk için.

const KATMANLAR = [
  { deger: "ust", etiket: "Üst", ikon: "👕" },
  { deger: "dis", etiket: "Dış", ikon: "🧥" },
  { deger: "alt", etiket: "Alt", ikon: "👖" },
  { deger: "ayakkabi", etiket: "Ayakkabı", ikon: "👟" },
  { deger: "aksesuar", etiket: "Aksesuar", ikon: "🧣" },
];

const RESMIYET = [
  { deger: "spor", etiket: "Spor" },
  { deger: "gunluk", etiket: "Günlük" },
  { deger: "yari-resmi", etiket: "Yarı resmi" },
  { deger: "resmi", etiket: "Resmi" },
];

const SIK_KUMASLAR = ["pamuk", "yün", "denim", "deri", "polyester", "keten", "triko"];

function Secenekler({ baslik, secenekler, secili, onSec }) {
  return (
    <View style={styles.bolum}>
      <Text style={styles.bolumBaslik}>{baslik}</Text>
      <View style={styles.cipSatiri}>
        {secenekler.map((s) => {
          const aktif = secili === s.deger;
          return (
            <TouchableOpacity
              key={s.deger}
              style={[styles.cip, aktif && styles.cipAktif]}
              onPress={() => {
                haptik.dokunus();
                onSec(s.deger);
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: aktif }}
              accessibilityLabel={s.etiket}
            >
              {s.ikon ? <Text style={styles.cipIkon}>{s.ikon}</Text> : null}
              <Text style={[styles.cipMetin, aktif && styles.cipMetinAktif]}>{s.etiket}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TagConfirmModal({ gorunur, parca, gorselUri, elleEtiket, onKaydet, onIptal }) {
  // Sayfa yüksekliğini PİKSEL olarak veriyoruz.
  //
  // "90%" yüzdesi bu modalda güvenilir çözülmedi: cihazda ölçtük, ScrollView
  // sayfanın tamamını yutup düğme çubuğuna sıfır yükseklik bırakıyordu ve
  // kullanıcı çektiği fotoğrafı KAYDEDEMİYORDU. flexShrink, kesin yüzde ve
  // minHeight ayrı ayrı denendi, hiçbiri çözmedi. Sayısal yükseklikte
  // Yoga'ya yorumlanacak bir şey kalmıyor.
  const { height: pencereYuksekligi } = useWindowDimensions();
  const sayfaYuksekligi = Math.round(pencereYuksekligi * 0.88);
  const [taslak, setTaslak] = useState(parca);
  const kaydir = React.useRef(new Animated.Value(0)).current;

  // parca prop'u her açılışta değişiyor; taslağı sıfırlıyoruz ki bir önceki
  // parçanın düzenlemeleri yeni parçaya sızmasın.
  useEffect(() => {
    setTaslak(parca);
  }, [parca]);

  useEffect(() => {
    Animated.timing(kaydir, {
      toValue: gorunur ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [gorunur, kaydir]);

  if (!taslak) return null;

  const guncelle = (yama) => setTaslak((t) => ({ ...t, ...yama }));

  const cevir = kaydir.interpolate({ inputRange: [0, 1], outputRange: [420, 0] });

  const suGecirmezSecenekleri = [
    { deger: "hayir", etiket: "Hayır" },
    { deger: "evet", etiket: "Su geçirmez" },
  ];

  return (
    <Modal
      visible={gorunur}
      transparent
      animationType="fade"
      onRequestClose={onIptal}
      statusBarTranslucent
    >
      <View style={styles.perde}>
        <Animated.View
          style={[
            styles.sayfa,
            { height: sayfaYuksekligi, transform: [{ translateY: cevir }] },
          ]}
        >
          <View style={styles.tutamak} />

          <ScrollView
            // flexShrink OLMADAN bu ScrollView içeriğinin tam boyunu
            // istiyordu: sayfa maxHeight'e kırpılıyor ve son çocuk olan
            // düğme çubuğu ekranın ALTINA taşıyordu. Kullanıcı kıyafetin
            // fotoğrafını çekip parçayı KAYDEDEMİYORDU — düğmeler
            // erişilebilirlik ağacında bile görünmüyordu.
            style={styles.kaydirma}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.icerik}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.ustSatir}>
              {gorselUri ? (
                <Image source={{ uri: gorselUri }} style={styles.onizleme} />
              ) : (
                <View style={[styles.onizleme, styles.onizlemeBos]} />
              )}
              <View style={styles.ustMetin}>
                {/* Yapay zeka kapalıyken veya etiketleme başarısız olduğunda
                    değerler tahmini. "TANINDI" demek, yapılmamış bir işi
                    yapılmış gibi göstermek olurdu. */}
                <Text style={[styles.rozet, elleEtiket && styles.rozetElle]}>
                  {elleEtiket ? "BİLGİLERİ SEN DOLDUR" : "TANINDI"}
                </Text>
                <Text style={styles.tur} numberOfLines={2}>
                  {taslak.tur || "Kıyafet"}
                </Text>
                {taslak.minC != null && taslak.maxC != null && (
                  <Text style={styles.aralik}>
                    {Math.round(taslak.minC)}° – {Math.round(taslak.maxC)}° arası
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.bolum}>
              <Text style={styles.bolumBaslik}>AD</Text>
              <TextInput
                style={styles.girdi}
                value={taslak.ad ?? ""}
                onChangeText={(v) => guncelle({ ad: v })}
                placeholder="Örn. Lacivert kot pantolon"
                placeholderTextColor="rgba(255,255,255,0.35)"
                accessibilityLabel="Parça adı"
              />
            </View>

            <Secenekler
              baslik="PARÇA GRUBU"
              secenekler={KATMANLAR}
              secili={taslak.katman}
              onSec={(v) => guncelle({ katman: v })}
            />

            <View style={styles.bolum}>
              <Text style={styles.bolumBaslik}>RENK</Text>
              <TextInput
                style={styles.girdi}
                value={taslak.renk ?? ""}
                onChangeText={(v) => guncelle({ renk: v })}
                placeholder="Örn. lacivert"
                placeholderTextColor="rgba(255,255,255,0.35)"
                accessibilityLabel="Renk"
              />
            </View>

            <View style={styles.bolum}>
              <Text style={styles.bolumBaslik}>KUMAŞ</Text>
              <TextInput
                style={styles.girdi}
                value={taslak.kumas ?? ""}
                onChangeText={(v) => guncelle({ kumas: v })}
                placeholder="Örn. pamuk"
                placeholderTextColor="rgba(255,255,255,0.35)"
                accessibilityLabel="Kumaş"
              />
              <View style={[styles.cipSatiri, { marginTop: 8 }]}>
                {SIK_KUMASLAR.map((k) => (
                  <TouchableOpacity
                    key={k}
                    style={[styles.cip, styles.cipKucuk, taslak.kumas === k && styles.cipAktif]}
                    onPress={() => {
                      haptik.dokunus();
                      guncelle({ kumas: k });
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[styles.cipMetin, taslak.kumas === k && styles.cipMetinAktif]}
                    >
                      {k}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Secenekler
              baslik="TARZ"
              secenekler={RESMIYET}
              secili={taslak.resmiyet}
              onSec={(v) => guncelle({ resmiyet: v })}
            />

            <Secenekler
              baslik="YAĞMURA DAYANIKLI MI"
              secenekler={suGecirmezSecenekleri}
              secili={taslak.suGecirmez ? "evet" : "hayir"}
              onSec={(v) => guncelle({ suGecirmez: v === "evet" })}
            />
          </ScrollView>

          <View style={styles.altBar}>
            <TouchableOpacity
              style={styles.iptalButon}
              onPress={() => {
                haptik.dokunus();
                onIptal();
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Vazgeç ve parçayı silme"
            >
              <Text style={styles.iptalMetin}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.kaydetButon}
              onPress={() => {
                haptik.basari();
                onKaydet(taslak);
              }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Gardıroba kaydet"
            >
              <Text style={styles.kaydetMetin}>Gardıroba ekle</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const ALTIN = "#FFC65C";

const styles = StyleSheet.create({
  perde: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sayfa: {
    backgroundColor: "#1B2740",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
  },
  tutamak: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.28)",
    alignSelf: "center",
    marginBottom: 14,
  },
  kaydirma: { flex: 1 },
  icerik: { paddingHorizontal: 20, paddingBottom: 16 },

  ustSatir: { flexDirection: "row", gap: 14, alignItems: "center", marginBottom: 22 },
  onizleme: { width: 82, height: 82, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.10)" },
  onizlemeBos: { borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  ustMetin: { flex: 1, gap: 3 },
  rozet: { color: ALTIN, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  rozetElle: { color: "rgba(255,255,255,0.55)" },
  tur: { color: "#fff", fontSize: 19, fontWeight: "700" },
  aralik: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "500" },

  bolum: { marginBottom: 20 },
  bolumBaslik: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 9,
  },
  girdi: {
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 15,
  },

  cipSatiri: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  cipKucuk: { paddingHorizontal: 11, paddingVertical: 7 },
  cipAktif: { backgroundColor: ALTIN, borderColor: ALTIN },
  cipIkon: { fontSize: 14 },
  cipMetin: { color: "rgba(255,255,255,0.82)", fontSize: 13, fontWeight: "600" },
  cipMetinAktif: { color: "#241A4D", fontWeight: "800" },

  altBar: {
    // flexShrink: 0 ŞART. Ölçtük: sayfa maxHeight'e sığdırılırken daralan
    // taraf ScrollView değil BU ÇUBUK oluyordu ve yüksekliği sıfıra
    // iniyordu — düğmeler erişilebilirlik ağacında bile görünmüyordu.
    flexShrink: 0,
    // minHeight KESİN bir kısıt: flex hesabı ne yaparsa yapsın çubuk bu
    // yüksekliğin altına inemiyor. flexShrink:0 ve sayfaya kesin yükseklik
    // vermek tek başına yetmedi — cihazda ölçtük, çubuk yine 0 kalıyordu.
    minHeight: 92,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.10)",
  },
  iptalButon: {
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    justifyContent: "center",
  },
  iptalMetin: { color: "rgba(255,255,255,0.8)", fontSize: 15, fontWeight: "600" },
  kaydetButon: {
    flex: 1,
    backgroundColor: ALTIN,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  kaydetMetin: { color: "#241A4D", fontSize: 16, fontWeight: "800" },
});
