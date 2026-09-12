import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getHourlyForecast,
  getDailyForecast,
  getCurrentRainChance,
  getCurrentVisibility,
  getSunTimes,
  getDunFarki,
  get15Dakikalik,
} from "../api/weather";
import { getClothingAdvice } from "../logic/clothingAdvice";
import { getWeatherTheme, VARSAYILAN_TEMA } from "../theme/weatherTheme";
import GradientBackground from "../components/GradientBackground";
import WeatherCard from "../components/WeatherCard";
import MicroCards from "../components/MicroCards";
import HourlyStrip from "../components/HourlyStrip";
import DailyForecast from "../components/DailyForecast";
import ClothingCard from "../components/ClothingCard";
import AdBanner from "../components/AdBanner";
import LayerPlanCard from "../components/LayerPlanCard";
import PaywallSheet from "../components/PaywallSheet";
import { katmanPlani } from "../logic/layerPlan";
import { yagisSeridi } from "../logic/yagisSeridi";
import { kalanGun, kalanGunMetni } from "../logic/kalanGun";
import PrecipitationStrip from "../components/PrecipitationStrip";
import { useKalibrasyon } from "../hooks/useKalibrasyon";
import WardrobeHeroCard from "../components/WardrobeHeroCard";
import { useAds } from "../context/AdsContext";
import { HavaIskeleti } from "../ui/Skeleton";
import * as haptik from "../ui/haptics";
import { usePremium } from "../context/PremiumContext";
import { useWeather } from "../context/WeatherContext";
import { useWardrobe } from "../context/WardrobeContext";

// "14:05" — Intl'e güvenmiyoruz: Hermes'te tam ICU verisi her cihazda yok.
function saatBiciminde(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function HomeScreen({
  onNavigatePremium,
  // Gardıroba giriş artık kombin ekranının başlığından; ana ekran kartı
  // boşken hızlı kuruluma, doluyken kombine gidiyor.
  onNavigateQuickSetup,
  onNavigateOutfit,
  onNavigateSettings,
  onNavigatePacking,
}) {
  const { isPremium } = usePremium();
  const { parcalar, yapayZekaAcik } = useWardrobe();
  const { gecisDene } = useAds();
  // Kilitli özelliğe dokunulunca açılan mini paywall
  const [kilitli, setKilitli] = useState(null);
  // Hava durumu state'i WeatherProvider'da tutuluyor; bu sayede başka bir
  // ekrana gidip gelince seçilen şehir kaybolmuyor.
  const {
    loading,
    refreshing,
    searching,
    error,
    locationName,
    weatherData,
    cityQuery,
    setCityQuery,
    searchCity,
    refresh,
    loadFromDeviceLocation,
    sehirSonuclari,
    sehirSec,
    sonuclariTemizle,
    sonGuncelleme,
    cevrimdisi,
    kayitliSehirler,
    aktifKayitli,
    sehirKaydet,
    sehirKaldir,
    kayitliSehreGec,
    sehirKimligi,
    azamiSehir,
  } = useWeather();

  // Edge-to-edge zorunlu olduğu için sistem çubuklarının boyunu
  // içeriğe padding olarak ekliyoruz.
  const insets = useSafeAreaInsets();

  const current = weatherData?.current;

  const theme = useMemo(
    () => (current ? getWeatherTheme(current.weather_code, current.is_day) : VARSAYILAN_TEMA),
    [current]
  );

  // Kişisel kayma öneriye giriyor, gösterilen dereceye değil.
  const { kayma } = useKalibrasyon();
  const advice = current ? getClothingAdvice(current, { isPremium, kayma }) : null;
  const hours = useMemo(() => getHourlyForecast(weatherData, 24), [weatherData]);
  const days = useMemo(() => getDailyForecast(weatherData), [weatherData]);
  const rainChance = useMemo(() => getCurrentRainChance(weatherData), [weatherData]);
  const gorus = useMemo(() => getCurrentVisibility(weatherData), [weatherData]);
  const gunes = useMemo(() => getSunTimes(weatherData), [weatherData]);
  const dunFarki = useMemo(() => getDunFarki(weatherData), [weatherData]);

  // Günün kalanı — Y/D takvim gününe ait ve öğleden sonra yanıltıyor.
  const kalanMetni = useMemo(() => {
    const saatler = getHourlyForecast(weatherData, 24);
    return kalanGunMetni(kalanGun(saatler, days[0]));
  }, [weatherData, days]);
  // Kayda değer yağış yoksa null döner ve kart hiç çizilmez.
  const yagisSerit = useMemo(
    () => yagisSeridi(get15Dakikalik(weatherData, 24)),
    [weatherData]
  );
  // Gün içi fark 5°C altındaysa null döner ve kart hiç görünmez.
  const plan = useMemo(() => katmanPlani(hours), [hours]);

  const ara = async () => {
    haptik.dokunus();
    // Klavyeyi kapatıyoruz: birden fazla eşleşme dönünce "hangisi?" listesi
    // klavyenin ARKASINDA kalıyor ve kullanıcı seçenekleri göremiyordu.
    // Aramaya bastıysa yazmayı bitirmiştir.
    Keyboard.dismiss();
    const sonuc = await searchCity(cityQuery);
    // Geçiş reklamı arama BİTTİKTEN sonra: kullanıcıyı sonucu görmeden
    // reklamla karşılamak, aramanın kendisini cezalandırmak olurdu.
    // Frekans sınırı AdsContext'te (günde en fazla 2, 90 sn ara).
    if (sonuc) gecisDene("arama");
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
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              haptik.dokunus();
              refresh();
            }}
            tintColor="#fff"
            colors={["#fff"]}
            progressBackgroundColor="rgba(0,0,0,0.3)"
          />
        }
      >
        <View style={styles.ustBar}>
          {/* numberOfLines + flexShrink birlikte: dar ekranda "Çevrimdışı" ve
              "Premium" rozetleri aynı anda görününce satır taşıyor ve ayar
              dişlisi ekran dışında kalıyordu. Taşmayı başlık emiyor —
              rozetlerin ikisi de dokunulabilir hedef, başlık değil. */}
          <Text
            style={[styles.uygulamaAdi, { color: theme.textPrimary }]}
            numberOfLines={1}
          >
            Hava & Kıyafet
          </Text>
          <View style={styles.ustBarSag}>
            {cevrimdisi && (
              <View style={[styles.cevrimdisiRozet, { borderColor: theme.cardBorder }]}>
                <Text style={[styles.cevrimdisiMetin, { color: theme.textSecondary }]}>
                  Eski veri
                </Text>
              </View>
            )}
            {!isPremium && (
              <TouchableOpacity
                style={[styles.premiumRozet, { borderColor: theme.accent }]}
                onPress={() => {
                  haptik.dokunus();
                  onNavigatePremium();
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Premium'a geç"
              >
                <Text style={[styles.premiumRozetMetin, { color: theme.accent }]}>✨ Premium</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                haptik.dokunus();
                onNavigateSettings?.();
              }}
              hitSlop={10}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Bildirim ayarları"
            >
              <Text style={styles.ayarIkon}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.aramaSatiri}>
          <View
            style={[
              styles.inputKutu,
              { backgroundColor: theme.inputBg, borderColor: theme.cardBorder },
            ]}
          >
            <Text style={styles.aramaIkon}>🔍</Text>
            <TextInput
              style={[styles.input, { color: theme.textPrimary }]}
              placeholder="Şehir ara (örn. Ankara)"
              placeholderTextColor={theme.textMuted}
              value={cityQuery}
              onChangeText={setCityQuery}
              onSubmitEditing={ara}
              returnKeyType="search"
              accessibilityLabel="Şehir arama kutusu"
            />
          </View>

          {/* Konumu her an yeniden denemek için: ilk açılışta izin
              reddedilmiş veya GPS kapalıysa kullanıcı buradan tetikler. */}
          <TouchableOpacity
            style={[styles.ikonButon, { borderColor: theme.cardBorder }]}
            onPress={() => {
              haptik.dokunus();
              loadFromDeviceLocation();
            }}
            disabled={loading}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Konumumu kullan"
          >
            <Text style={styles.konumIkon}>📍</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.aramaButon, { borderColor: theme.cardBorder }]}
            onPress={ara}
            disabled={searching}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Ara"
          >
            {searching ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.aramaButonMetin}>Ara</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Kayıtlı şehirler. Hava uygulamalarında en temel beklentilerden
            biri; önceden her arama öncekini siliyordu. */}
        {(kayitliSehirler.length > 0 || (weatherData && !aktifKayitli)) && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sehirSerit}
            keyboardShouldPersistTaps="handled"
          >
            {weatherData && !aktifKayitli && kayitliSehirler.length < azamiSehir && (
              <TouchableOpacity
                style={[styles.sehirCip, styles.sehirEkleCip, { borderColor: theme.accent }]}
                onPress={async () => {
                  // Başarıyı ÖNCEDEN kutlamıyoruz: kaydetme başarısız
                  // olabiliyor ve sessizce hiçbir şey olmaması kullanıcıya
                  // düğmenin bozuk olduğunu düşündürüyordu.
                  const sonuc = await sehirKaydet();
                  if (sonuc) {
                    haptik.basari();
                  } else {
                    haptik.hata();
                    Alert.alert(
                      "Şehir kaydedilemedi",
                      "Konum bilgisi eksik. Yukarıdan şehri tekrar arayıp dener misin?"
                    );
                  }
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`${locationName} şehrini kaydet`}
              >
                <Text style={[styles.sehirCipMetin, { color: theme.accent }]}>
                  + Bu şehri kaydet
                </Text>
              </TouchableOpacity>
            )}

            {kayitliSehirler.map((sh) => {
              const kimlik = sehirKimligi(sh);
              const aktif = aktifKayitli && sh.ad === locationName;
              return (
                <TouchableOpacity
                  key={kimlik}
                  style={[
                    styles.sehirCip,
                    { borderColor: theme.cardBorder },
                    aktif && { backgroundColor: "rgba(255,255,255,0.22)" },
                  ]}
                  onPress={() => {
                    haptik.dokunus();
                    kayitliSehreGec(sh);
                  }}
                  onLongPress={() => {
                    haptik.uyari();
                    Alert.alert("Şehri kaldır", `"${sh.ad}" listeden çıkarılsın mı?`, [
                      { text: "Vazgeç", style: "cancel" },
                      {
                        text: "Kaldır",
                        style: "destructive",
                        onPress: () => {
                          haptik.agir();
                          sehirKaldir(kimlik);
                        },
                      },
                    ]);
                  }}
                  delayLongPress={350}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`${sh.ad} şehrine geç. Kaldırmak için basılı tut.`}
                >
                  <Text
                    style={[
                      styles.sehirCipMetin,
                      { color: aktif ? theme.textPrimary : theme.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {sh.ad}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Birden fazla şehir eşleştiyse kullanıcı seçsin. Önceden ilk sonuç
            sessizce alınıyordu ve yanlış ülkeye düşmek mümkündü. */}
        {sehirSonuclari.length > 0 && (
          <View
            style={[styles.sonucKutu, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
          >
            <View style={styles.sonucBaslikSatiri}>
              <Text style={[styles.sonucBaslik, { color: theme.textSecondary }]}>
                {sehirSonuclari.length} EŞLEŞME — HANGİSİ?
              </Text>
              <TouchableOpacity onPress={sonuclariTemizle} hitSlop={10}>
                <Text style={[styles.sonucKapat, { color: theme.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>
            {sehirSonuclari.map((s, i) => (
              <TouchableOpacity
                key={`${s.latitude},${s.longitude}`}
                style={[styles.sonucSatir, i < sehirSonuclari.length - 1 && styles.sonucAyrac]}
                onPress={() => {
                  haptik.dokunus();
                  sehirSec(s);
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${s.etiket} şehrini seç`}
              >
                <Text style={[styles.sonucMetin, { color: theme.textPrimary }]}>{s.etiket}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {error && (
          <View style={styles.hataKutu}>
            <Text style={styles.hataMetin}>{error}</Text>
            <TouchableOpacity onPress={loadFromDeviceLocation} activeOpacity={0.8}>
              <Text style={styles.hataButon}>📍 Konumumu tekrar dene</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* İskelet yalnızca HİÇ veri yokken. Önbellekten veri geldiyse
            (çevrimdışı açılış) doğrudan gerçek içerik gösteriliyor. */}
        {loading && !weatherData && <HavaIskeleti />}

        {weatherData && (
          <>
            <WeatherCard
              locationName={locationName}
              current={current}
              theme={theme}
              bugun={days[0]}
              dunFarki={dunFarki}
              kalan={kalanMetni}
            />

            {/* Yağış şeridi hava kartının hemen altında: yağmurlu bir günde
                "ne zaman kesilir" sorusu "ne giyeyim"den önce geliyor.
                Yalnızca kayda değer yağış varken görünüyor, açık havada
                sıralamayı hiç değiştirmiyor. */}
            <PrecipitationStrip serit={yagisSerit} theme={theme} />

            {/* SIRALAMA — kullanıcının kararı: önce hava, sonra "ne giyeyim",
                sonra uygulamanın asıl farkı olan gardırop. Ölçüm kartları en
                alta indi: bunlar meraklıya hitap eden ayrıntılar, günlük
                kararı değiştiren şey değil. */}
            <ClothingCard
              advice={advice}
              theme={theme}
              isPremium={isPremium}
              onUpgradePress={onNavigatePremium}
            />

            {/* Gardırop girişi. Sunucuya bağlı DEĞİL: etiketleme elle
                yapılabiliyor, kombin seçimi cihazda çalışıyor. Yapay zeka
                yalnızca bunu hızlandırıyor. */}
            <WardrobeHeroCard
              parcaSayisi={parcalar.length}
              theme={theme}
              // Boşken DOĞRUDAN hızlı kuruluma: kart "30 saniye sürer" diyor,
              // kullanıcıyı fotoğraf ekranına düşürmek o sözü tutmuyor.
              onAc={() =>
                parcalar.length === 0 ? onNavigateQuickSetup() : onNavigateOutfit()
              }
            />

            <TouchableOpacity
              style={[
                styles.gardiropKart,
                { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
              ]}
              onPress={() => {
                haptik.dokunus();
                // Kilitli özellik: ücretsiz kullanıcı mini paywall görüyor,
                // tam ekran paywall'a atılmıyor — bağlam kopmuyor.
                isPremium ? onNavigatePacking?.() : setKilitli("bavul");
              }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Bavul asistanı"
            >
              <View style={styles.gardiropIkonKutu}>
                <Text style={styles.gardiropIkon}>🧳</Text>
              </View>
              <View style={styles.gardiropMetin}>
                <Text style={[styles.gardiropBaslik, { color: theme.textPrimary }]}>
                  Bavul asistanı
                </Text>
                <Text style={[styles.gardiropAlt, { color: theme.textMuted }]} numberOfLines={2}>
                  Gideceğin günlerin tahminine göre bavul listesi çıkarır
                </Text>
              </View>
              {isPremium ? (
                <Text style={[styles.gardiropOk, { color: theme.textSecondary }]}>›</Text>
              ) : (
                <Text style={styles.kilitRozet}>🔒</Text>
              )}
            </TouchableOpacity>

            <LayerPlanCard
              plan={plan}
              theme={theme}
              isPremium={isPremium}
              onKilit={setKilitli}
            />

            <HourlyStrip hours={hours} theme={theme} />

            <DailyForecast
              days={days}
              theme={theme}
              isPremium={isPremium}
              onUpgradePress={onNavigatePremium}
            />

            {/* Ölçüm kartları EN ALTTA: yağış, rüzgar, UV, nem, basınç,
                görüş, gün doğumu/batımı. Bunlar günün kararını değiştirmiyor;
                üstte durduklarında asıl içeriği aşağı itiyorlardı. */}
            <MicroCards
              current={current}
              rainChance={rainChance}
              gorus={gorus}
              gunes={gunes}
              theme={theme}
            />

            {sonGuncelleme && (
              <Text style={[styles.guncellemeMetin, { color: theme.textMuted }]}>
                {cevrimdisi
                  ? `Son kayıt ${saatBiciminde(sonGuncelleme)} · yenilemek için aşağı çek`
                  : `${saatBiciminde(sonGuncelleme)} itibarıyla · yenilemek için aşağı çek`}
              </Text>
            )}
          </>
        )}

        {!isPremium && (
          <>
            <View style={styles.reklamKutu}>
              <AdBanner />
            </View>

            <TouchableOpacity
              style={[styles.premiumSerit, { borderColor: theme.accent }]}
              onPress={() => {
                haptik.dokunus();
                onNavigatePremium();
              }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Premium'a geç"
            >
              <Text style={styles.premiumSeritBaslik}>✨ Premium'a geç</Text>
              {/* Yapay zeka kapalıyken (v1.0) onu vaat etmiyoruz — kullanıcı
                  satın alıp bulamayınca iade ister ve puan düşer. */}
              <Text style={styles.premiumSeritAlt}>
                {yapayZekaAcik
                  ? "Reklamsız kullanım, 10 günlük tahmin ve yapay zeka kombin asistanı"
                  // Yağış uyarıları ÜCRETSİZ oldu; burada Premium avantajı
                  // diye saymak kullanıcının zaten sahip olduğunu satmaktı.
                  : "Reklamsız kullanım, 10 günlük tahmin ve saatlik katman planı"}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <PaywallSheet
        gorunur={!!kilitli}
        ozellik={kilitli}
        onKapat={() => setKilitli(null)}
        onPremium={onNavigatePremium}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  kok: { flex: 1, backgroundColor: "#16233B" },
  icerik: { paddingHorizontal: 20 },

  ustBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  ustBarSag: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 },
  uygulamaAdi: { fontSize: 20, fontWeight: "700", letterSpacing: 0.2, flexShrink: 1, marginRight: 8 },
  cevrimdisiRozet: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  cevrimdisiMetin: { fontSize: 11, fontWeight: "700" },
  // paddingVertical 6 → 12: rozetin yüksekliği 30dp'ydi, dokunma
  // kılavuzlarının (44dp) belirgin altında.
  premiumRozet: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: "center",
  },
  premiumRozetMetin: { fontSize: 12, fontWeight: "700" },
  // Dolgu BİLEREK burada: hitSlop yalnızca dokunma olayını genişletiyor,
  // erişilebilirlik düğümünü büyütmüyor. TalkBack'te dokunarak keşfeden
  // kullanıcı 24dp'lik bir hedefi zor buluyordu. Ölçüldü: 24x26dp → 44x44dp.
  ayarIkon: { fontSize: 19, textAlign: "center", minWidth: 44, lineHeight: 44 },

  aramaSatiri: { flexDirection: "row", gap: 8 },
  inputKutu: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 7,
  },
  aramaIkon: { fontSize: 14 },
  input: { flex: 1, fontSize: 14, paddingVertical: 11 },
  ikonButon: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  konumIkon: { fontSize: 17 },
  aramaButon: {
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 18,
    justifyContent: "center",
    minWidth: 58,
    alignItems: "center",
  },
  aramaButonMetin: { color: "#fff", fontWeight: "700", fontSize: 14 },

  sehirSerit: { gap: 8, paddingVertical: 12, paddingRight: 4 },
  sehirCip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    // 8 → 12: çipin yüksekliği 36dp'ydi; kaydetme, yanlışlıkla ıskalanması
    // can sıkan bir işlem.
    paddingVertical: 12,
    maxWidth: 190,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  sehirEkleCip: { borderStyle: "dashed", backgroundColor: "transparent" },
  sehirCipMetin: { fontSize: 13, fontWeight: "700" },
  sonucKutu: { marginTop: 12, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14 },
  sonucBaslikSatiri: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    paddingBottom: 6,
  },
  sonucBaslik: { fontSize: 10, fontWeight: "700", letterSpacing: 0.9 },
  sonucKapat: { fontSize: 14, fontWeight: "700" },
  sonucSatir: { paddingVertical: 12 },
  sonucAyrac: { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.10)" },
  sonucMetin: { fontSize: 14, fontWeight: "600" },

  hataKutu: {
    marginTop: 14,
    backgroundColor: "rgba(220,38,38,0.22)",
    borderColor: "rgba(255,150,150,0.45)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  hataMetin: { color: "#FFE1E1", fontSize: 13, lineHeight: 18 },
  hataButon: { color: "#fff", fontSize: 13, fontWeight: "700" },

  gardiropKart: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
  },
  gardiropIkonKutu: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  gardiropIkon: { fontSize: 22 },
  gardiropMetin: { flex: 1, gap: 3 },
  gardiropBaslik: { fontSize: 15, fontWeight: "700" },
  gardiropAlt: { fontSize: 12, lineHeight: 16 },
  gardiropOk: { fontSize: 26, fontWeight: "300", marginTop: -3 },
  kilitRozet: { fontSize: 15 },

  guncellemeMetin: { fontSize: 11, textAlign: "center", marginTop: 18 },

  reklamKutu: {
    marginTop: 18,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  premiumSerit: {
    marginTop: 16,
    backgroundColor: "rgba(0,0,0,0.28)",
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    alignItems: "center",
    gap: 4,
  },
  premiumSeritBaslik: { color: "#FFC65C", fontSize: 16, fontWeight: "800" },
  premiumSeritAlt: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
});
