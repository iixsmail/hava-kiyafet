import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Linking,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../components/GradientBackground";
import * as haptik from "../ui/haptics";
import { getWeatherTheme, VARSAYILAN_TEMA } from "../theme/weatherTheme";
import { useWeather } from "../context/WeatherContext";
import { useNotifications } from "../context/NotificationContext";
import { useKalibrasyon } from "../hooks/useKalibrasyon";
import { requestPinWidget } from "react-native-android-widget";
import { mailtoBaglantisi } from "../logic/geriBildirim";
import { GERI_BILDIRIM_EPOSTA } from "../config";

// Yarım saatlik adımlarla 06:00–11:00 arası. Sabah bildirimi için daha geniş
// bir aralık sunmak, bir saat seçici bileşeni eklemeye değmiyordu; bu aralık
// dışında sabah bildirimi zaten anlamsız.
const SAAT_SECENEKLERI = [];
for (let s = 6; s <= 11; s++) {
  SAAT_SECENEKLERI.push({ saat: s, dakika: 0 });
  if (s < 11) SAAT_SECENEKLERI.push({ saat: s, dakika: 30 });
}

const ss = (s, d) => `${String(s).padStart(2, "0")}:${String(d).padStart(2, "0")}`;

function Satir({ baslik, aciklama, deger, onDegis, theme, devreDisi, premiumGerekli, onPremium }) {
  // Premium gerektiren satır: anahtar yerine rozet gösteriyoruz. Anahtarı
  // açık bırakıp bildirim göndermemek kullanıcıyı sessizce yanıltırdı.
  if (premiumGerekli) {
    return (
      <TouchableOpacity
        style={styles.satir}
        onPress={() => {
          haptik.dokunus();
          onPremium?.();
        }}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`${baslik} — Premium ile açılır`}
      >
        <View style={styles.satirMetin}>
          <Text style={[styles.satirBaslik, { color: theme.textPrimary }]}>{baslik}</Text>
          <Text style={[styles.satirAciklama, { color: theme.textMuted }]}>{aciklama}</Text>
        </View>
        <View style={[styles.premiumRozet, { borderColor: theme.accent }]}>
          <Text style={[styles.premiumRozetMetin, { color: theme.accent }]}>Premium</Text>
        </View>
      </TouchableOpacity>
    );
  }

  // SATIRIN TAMAMI dokunulabilir.
  //
  // Önceden yalnızca anahtarın kendisi tıklanabilirdi: 46x27dp'lik bir
  // hedef. Cihazda ölçüldü. Satırı sarmak hem hedefi ~4 katına çıkarıyor
  // hem de kullanıcıların çoğunun zaten denediği davranış.
  //
  // Erişilebilirlik rolü satıra taşındı ve anahtar ağaçtan gizlendi;
  // ikisi birden açık kalsaydı TalkBack aynı ayarı iki kez okurdu.
  return (
    <TouchableOpacity
      style={[styles.satir, devreDisi && styles.satirPasif]}
      onPress={() => {
        if (devreDisi) return;
        haptik.dokunus();
        onDegis(!deger);
      }}
      disabled={devreDisi}
      activeOpacity={0.75}
      accessibilityRole="switch"
      accessibilityState={{ checked: deger, disabled: !!devreDisi }}
      accessibilityLabel={baslik}
      accessibilityHint={aciklama}
    >
      <View style={styles.satirMetin}>
        <Text style={[styles.satirBaslik, { color: theme.textPrimary }]}>{baslik}</Text>
        <Text style={[styles.satirAciklama, { color: theme.textMuted }]}>{aciklama}</Text>
      </View>
      {/* Anahtar erişilebilirlik ağacından çıkarıldı: satırın kendisi
          zaten "switch" rolüyle, etiketiyle ve işaretli durumuyla tek
          düğüm olarak sunuluyor. İkisi birden açık kalsaydı TalkBack aynı
          ayarı iki kez okurdu. */}
      <Switch
        value={deger}
        onValueChange={(v) => {
          haptik.dokunus();
          onDegis(v);
        }}
        disabled={devreDisi}
        trackColor={{ false: "rgba(255,255,255,0.20)", true: theme.accent }}
        thumbColor="#fff"
        importantForAccessibility="no"
        accessibilityElementsHidden
      />
    </TouchableOpacity>
  );
}

export default function SettingsScreen({ onBack, onNavigatePremium }) {
  const insets = useSafeAreaInsets();
  const { weatherData, locationName } = useWeather();
  const {
    ayarlar,
    izin,
    planlanan,
    ayarGuncelle,
    izinIste,
    ornekGonder,
    destekleniyor,
    uyarilarPremium,
  } = useNotifications();
  const [deneniyor, setDeneniyor] = useState(false);
  const kalibrasyon = useKalibrasyon();

  /**
   * Widget'ı ana ekrana ekleme isteği.
   *
   * Kullanıcıyı widget seçicisinde uygulamayı aramaya bırakmak yerine
   * doğrudan sistemin "ana ekrana ekle" onayını açıyoruz. Bazı launcher'lar
   * bunu desteklemiyor; o durumda elle ekleme yolunu anlatıyoruz.
   */
  /**
   * Geri bildirim e-postasını açar.
   *
   * Sürüm, Android ve şehir bilgisini gövdeye biz koyuyoruz: kullanıcıdan
   * bunları yazmasını beklemek gerçekçi değil ve onlarsız gelen "bozuk"
   * bildirimiyle bir şey yapılamıyor.
   */
  const geriBildirimGonder = async () => {
    haptik.dokunus();
    const baglanti = mailtoBaglantisi({
      android: Platform.constants?.Release,
      apiSeviyesi: Platform.Version,
      sehir: locationName,
    });
    try {
      await Linking.openURL(baglanti);
    } catch (e) {
      // E-posta uygulaması kurulu olmayabilir; adresi göstermek en azından
      // kullanıcının kopyalamasına imkân veriyor.
      haptik.hata();
      Alert.alert(
        "E-posta uygulaması bulunamadı",
        `Görüşünü şu adrese yazabilirsin:\n\n${GERI_BILDIRIM_EPOSTA}`
      );
    }
  };

  const widgetEkle = async () => {
    haptik.dokunus();
    try {
      const kabul = await requestPinWidget({ widgetName: "Hava" });
      if (!kabul) {
        Alert.alert(
          "Elle eklemen gerekiyor",
          "Bu başlatıcı doğrudan eklemeyi desteklemiyor. Ana ekranda boş bir yere basılı tutup Widget'lar bölümünden \"Hava & Kıyafet\" widget'ını ekleyebilirsin."
        );
      }
    } catch (e) {
      haptik.hata();
      Alert.alert("Eklenemedi", "Widget şu an eklenemedi. Ana ekrandan elle ekleyebilirsin.");
    }
  };
  const saatSeritRef = useRef(null);
  // Seçili çipin şerit içindeki x konumu — çipin kendi onLayout'undan
  // geliyor. Genişliği hesaplamak yerine ÖLÇÜYORUZ: yazı tipi ölçeği
  // (erişilebilirlik ayarı) çip boyunu değiştiriyor, sabit sayı tutmaz.
  const seciliXRef = useRef(0);

  const seciliyeKaydir = useCallback(() => {
    if (!saatSeritRef.current) return;
    // Seçiliyi tam sola yapıştırmak "solda başka seçenek yok" hissi verdiği
    // için biraz pay bırakıyoruz.
    saatSeritRef.current.scrollTo({
      x: Math.max(0, seciliXRef.current - 72),
      animated: false,
    });
  }, []);

  const current = weatherData?.current;
  const theme = useMemo(
    () => (current ? getWeatherTheme(current.weather_code, current.is_day) : VARSAYILAN_TEMA),
    [current]
  );

  const izinVerildi = izin === "granted";
  const izinReddedildi = izin === "denied";

  const izinIsteVeUyar = async () => {
    haptik.dokunus();
    const verildi = await izinIste();
    if (!verildi) {
      haptik.hata();
      // Android'de bir kez reddedilen izin tekrar sorulmuyor; kullanıcıyı
      // sistem ayarlarına yönlendirmek tek yol.
      Alert.alert(
        "Bildirim izni kapalı",
        "Bildirimleri açmak için sistem ayarlarından bu uygulamaya izin vermen gerekiyor.",
        [
          { text: "Vazgeç", style: "cancel" },
          { text: "Ayarları aç", onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  const dene = async () => {
    haptik.dokunus();
    setDeneniyor(true);
    const ok = await ornekGonder();
    setDeneniyor(false);
    if (ok) {
      Alert.alert("Gönderildi", "Örnek bildirim 5 saniye içinde gelecek.");
    } else {
      haptik.hata();
      Alert.alert("Gönderilemedi", "Bildirim sistemi bu ortamda kullanılamıyor.");
    }
  };

  return (
    <View style={styles.kok}>
      <GradientBackground colors={theme.gradient} />
      <ScrollView
        contentContainerStyle={[
          styles.icerik,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() => {
            haptik.dokunus();
            onBack();
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Geri"
        >
          <Text style={[styles.geri, { color: theme.textSecondary }]}>‹ Geri</Text>
        </TouchableOpacity>

        <Text style={[styles.baslik, { color: theme.textPrimary }]}>Bildirimler</Text>
        <Text style={[styles.altBaslik, { color: theme.textSecondary }]}>
          Sabah özeti ve hava uyarıları cihazında üretilir — internet gerekmez.
        </Text>

        {!destekleniyor ? (
          <View style={[styles.bilgiKutu, { borderColor: theme.cardBorder }]}>
            <Text style={[styles.bilgiMetin, { color: theme.textSecondary }]}>
              Bildirimler bu ortamda kullanılamıyor. Play Store'dan indirilen sürümde
              çalışır.
            </Text>
          </View>
        ) : !izinVerildi ? (
          <TouchableOpacity
            style={[styles.izinKart, { borderColor: theme.accent }]}
            onPress={izinIsteVeUyar}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Bildirimlere izin ver"
          >
            <Text style={styles.izinIkon}>🔔</Text>
            <View style={styles.izinMetinKutu}>
              <Text style={[styles.izinBaslik, { color: theme.accent }]}>
                {izinReddedildi ? "Bildirim izni kapalı" : "Bildirimlere izin ver"}
              </Text>
              <Text style={[styles.izinAlt, { color: theme.textSecondary }]}>
                {izinReddedildi
                  ? "Açmak için dokun, sistem ayarlarına yönlendirelim."
                  : "Her sabah günün havasını ve ne giyeceğini gönderelim."}
              </Text>
            </View>
          </TouchableOpacity>
        ) : null}

        <View
          style={[styles.kart, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
        >
          <Satir
            baslik="Sabah özeti"
            aciklama="Günün havası ve kıyafet önerisi"
            deger={ayarlar.sabahAcik}
            onDegis={(v) => ayarGuncelle({ sabahAcik: v })}
            theme={theme}
            devreDisi={!izinVerildi}
          />

          {ayarlar.sabahAcik && (
            <View style={styles.saatBolumu}>
              <Text style={[styles.saatBaslik, { color: theme.textMuted }]}>
                GÖNDERİM SAATİ
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                ref={saatSeritRef}
                // Seçili saati görünür alana getiriyoruz.
                //
                // Varsayılan 08:00 şeridin sağ ucundaydı ve ekran açıldığında
                // yarım kırpık görünüyordu: hem seçim bozuk duruyordu hem de
                // liste orada bitiyormuş gibi görünüp 08:30 sonrasının varlığı
                // gizleniyordu.
                onLayout={seciliyeKaydir}
                onContentSizeChange={seciliyeKaydir}
              >
                <View style={styles.saatSerit}>
                  {SAAT_SECENEKLERI.map(({ saat, dakika }) => {
                    const aktif = ayarlar.sabahSaat === saat && ayarlar.sabahDakika === dakika;
                    return (
                      <TouchableOpacity
                        key={ss(saat, dakika)}
                        style={[
                          styles.saatCip,
                          { borderColor: theme.cardBorder },
                          aktif && { backgroundColor: theme.accent, borderColor: theme.accent },
                        ]}
                        onPress={() => {
                          haptik.dokunus();
                          ayarGuncelle({ sabahSaat: saat, sabahDakika: dakika });
                        }}
                        disabled={!izinVerildi}
                        activeOpacity={0.8}
                        onLayout={
                          aktif
                            ? (e) => {
                                seciliXRef.current = e.nativeEvent.layout.x;
                                seciliyeKaydir();
                              }
                            : undefined
                        }
                        accessibilityRole="button"
                        accessibilityState={{ selected: aktif }}
                        accessibilityLabel={`Bildirim saati ${ss(saat, dakika)}`}
                      >
                        <Text
                          style={[
                            styles.saatMetin,
                            { color: theme.textPrimary },
                            aktif && styles.saatMetinAktif,
                          ]}
                        >
                          {ss(saat, dakika)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}

          <View style={styles.ayrac} />

          <Satir
            baslik="Yağış uyarısı"
            aciklama="Seni ıslatacak bir yağış varsa 45 dakika önce haber verir"
            deger={ayarlar.yagisUyarisi}
            onDegis={(v) => ayarGuncelle({ yagisUyarisi: v })}
            theme={theme}
            devreDisi={!izinVerildi}
            premiumGerekli={uyarilarPremium}
            onPremium={onNavigatePremium}
          />

          <View style={styles.ayrac} />

          <Satir
            baslik="Ani sıcaklık düşüşü"
            aciklama="Hava üşütecek kadar serinlemeden bir saat önce uyarır"
            deger={ayarlar.sicaklikUyarisi}
            onDegis={(v) => ayarGuncelle({ sicaklikUyarisi: v })}
            theme={theme}
            devreDisi={!izinVerildi}
            premiumGerekli={uyarilarPremium}
            onPremium={onNavigatePremium}
          />
        </View>

        {izinVerildi && (
          <>
            <TouchableOpacity
              style={[styles.deneButon, { borderColor: theme.cardBorder }]}
              onPress={dene}
              disabled={deneniyor}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Örnek bildirim gönder"
            >
              <Text style={[styles.deneMetin, { color: theme.textPrimary }]}>
                {deneniyor ? "Gönderiliyor..." : "Örnek bildirim gönder"}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.durumMetin, { color: theme.textMuted }]}>
              {planlanan > 0
                ? `${planlanan} bildirim planlı. Uygulamayı her açtığında en güncel tahminle yenileniyor.`
                : "Şu an planlı bildirim yok."}
            </Text>
          </>
        )}

        {/* Ana ekran widget'ı */}
        <TouchableOpacity
          style={[styles.deneButon, { borderColor: theme.cardBorder }]}
          onPress={widgetEkle}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Widget'ı ana ekrana ekle"
        >
          <Text style={[styles.deneMetin, { color: theme.textPrimary }]}>
            📱 Ana ekrana widget ekle
          </Text>
        </TouchableOpacity>
        <Text style={[styles.durumMetin, { color: theme.textMuted }]}>
          Derece ve kıyafet önerisi ana ekranında görünür; uygulamayı açmana
          gerek kalmaz.
        </Text>

        {/* Kişisel kalibrasyon — kullanıcı ne öğrendiğimizi görebilsin ve
            gerekirse silebilsin. Sessizce eşik kaydıran ve geri alınamayan
            bir sistem, yanlış öğrendiğinde kullanıcıyı kilitler. */}
        <View style={[styles.kart, { borderColor: theme.cardBorder }]}>
          <View style={styles.satir}>
            <View style={styles.satirMetin}>
              <Text style={[styles.satirBaslik, { color: theme.textPrimary }]}>
                Kişisel sıcaklık ayarı
              </Text>
              <Text style={[styles.satirAciklama, { color: theme.textMuted }]}>
                {kalibrasyon.aciklama}
              </Text>
            </View>
            {kalibrasyon.sayac > 0 && (
              <TouchableOpacity
                onPress={() => {
                  haptik.dokunus();
                  Alert.alert(
                    "Sıfırlansın mı?",
                    "Senin için öğrendiğimiz sıcaklık ayarı silinecek, öneriler varsayılana dönecek.",
                    [
                      { text: "Vazgeç", style: "cancel" },
                      {
                        text: "Sıfırla",
                        style: "destructive",
                        onPress: () => kalibrasyon.sifirla(),
                      },
                    ]
                  );
                }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Kişisel sıcaklık ayarını sıfırla"
              >
                <Text style={[styles.sifirlaMetin, { color: theme.textSecondary }]}>Sıfırla</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Geri bildirim.
            Kullanıcının derdini duyabildiğimiz tek kanal: uygulama tamamen
            cihazda çalışıyor, hiçbir kullanım verisi toplamıyoruz. */}
        <TouchableOpacity
          style={[styles.deneButon, { borderColor: theme.cardBorder }]}
          onPress={geriBildirimGonder}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Geri bildirim gönder"
        >
          <Text style={[styles.deneMetin, { color: theme.textPrimary }]}>
            ✉️ Görüşünü yaz
          </Text>
        </TouchableOpacity>
        <Text style={[styles.durumMetin, { color: theme.textMuted }]}>
          Eksik gördüğün, yanlış bulduğun ya da olmasını istediğin bir şey
          varsa yaz — hepsini okuyorum.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  kok: { flex: 1, backgroundColor: "#16233B" },
  icerik: { paddingHorizontal: 20 },
  // lineHeight ile gerçek yükseklik 22dp'den 44dp'ye çıkıyor. hitSlop
  // zaten vardı ama erişilebilirlik düğümünü büyütmüyor; TalkBack'te
  // dokunarak keşfeden kullanıcı için geri dönüş yolu zor bulunuyordu.
  geri: { fontSize: 16, fontWeight: "600", lineHeight: 44 },
  baslik: { fontSize: 30, fontWeight: "800", marginTop: 18, letterSpacing: -0.4 },
  altBaslik: { fontSize: 14, marginTop: 5, lineHeight: 20 },

  bilgiKutu: { marginTop: 22, borderWidth: 1, borderRadius: 16, padding: 16 },
  bilgiMetin: { fontSize: 13, lineHeight: 19, textAlign: "center" },

  izinKart: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginTop: 22,
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  izinIkon: { fontSize: 26 },
  izinMetinKutu: { flex: 1, gap: 3 },
  izinBaslik: { fontSize: 15, fontWeight: "800" },
  izinAlt: { fontSize: 12, lineHeight: 17 },

  kart: { marginTop: 20, borderWidth: 1, borderRadius: 22, paddingHorizontal: 16 },
  satir: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 16 },
  satirPasif: { opacity: 0.45 },
  satirMetin: { flex: 1, gap: 3 },
  satirBaslik: { fontSize: 15, fontWeight: "700" },
  satirAciklama: { fontSize: 12, lineHeight: 16 },
  sifirlaMetin: { fontSize: 12.5, fontWeight: "700", textDecorationLine: "underline" },
  ayrac: { height: 1, backgroundColor: "rgba(255,255,255,0.10)" },
  premiumRozet: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5 },
  premiumRozetMetin: { fontSize: 11, fontWeight: "800" },

  saatBolumu: { paddingBottom: 16, gap: 9 },
  saatBaslik: { fontSize: 10, fontWeight: "700", letterSpacing: 0.9 },
  saatSerit: { flexDirection: "row", gap: 8, paddingRight: 4 },
  saatCip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    // 9 → 13: çip 38dp yüksekliğindeydi. Yatay kaydırılan bir şeritte
    // küçük hedefi ıskalamak kolay ve yanlış saat seçmek fark edilmiyor.
    paddingVertical: 13,
  },
  saatMetin: { fontSize: 13, fontWeight: "700" },
  saatMetinAktif: { color: "#241A4D", fontWeight: "800" },

  deneButon: {
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  deneMetin: { fontSize: 14, fontWeight: "700" },
  durumMetin: { fontSize: 11, textAlign: "center", marginTop: 14, lineHeight: 16 },
});
