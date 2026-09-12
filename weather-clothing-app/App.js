import React, { useState, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { View, StyleSheet, BackHandler } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PremiumProvider } from "./src/context/PremiumContext";
import { WeatherProvider } from "./src/context/WeatherContext";
import { WardrobeProvider } from "./src/context/WardrobeContext";
import { NotificationProvider } from "./src/context/NotificationContext";
import { AdsProvider } from "./src/context/AdsContext";
import ErrorBoundary from "./src/ui/ErrorBoundary";
import * as kalibrasyon from "./src/storage/kalibrasyon";
import * as tanitimDepo from "./src/storage/tanitim";
import HomeScreen from "./src/screens/HomeScreen";
import PremiumScreen from "./src/screens/PremiumScreen";
import WardrobeScreen from "./src/screens/WardrobeScreen";
import OutfitScreen from "./src/screens/OutfitScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import OnboardingScreen from "./src/screens/OnboardingScreen";
import PackingScreen from "./src/screens/PackingScreen";
import QuickSetupScreen from "./src/screens/QuickSetupScreen";

// Tanıtım anahtarı artık src/storage/tanitim.js içinde.


export default function App() {
  // Gezinme geçmişi. Son eleman görünen ekran.
  //
  // Sabit bir "ebeveyn ekran" tablosu yetmiyor: kombin ekranına hem ana
  // ekrandan hem gardıroptan giriliyor, geri tuşu geldiği yere dönmeli.
  // Geçmişi tutmak bunu kendiliğinden çözüyor.
  // "home" | "premium" | "wardrobe" | "outfit" | "settings" | "packing" | "quicksetup"
  const [gecmis, setGecmis] = useState(["home"]);
  const screen = gecmis[gecmis.length - 1];

  const git = (hedef) =>
    setGecmis((g) => (g[g.length - 1] === hedef ? g : [...g, hedef]));
  // Geçmişte tek eleman kalınca ana ekrandayız; oradan geri basmak
  // uygulamadan çıkmalı (aşağıdaki BackHandler false döndürüyor).
  const geri = () => setGecmis((g) => (g.length > 1 ? g.slice(0, -1) : g));
  // Bulunulan ekranın YERİNE geç: tamamlanmış bir adıma geri dönülmesin.
  const degistir = (hedef) => setGecmis((g) => [...g.slice(0, -1), hedef]);

  // Tanıtım durumu: null = henüz bilinmiyor (diskten okunuyor).
  // Bilinmeden hiçbir şey çizmiyoruz; aksi halde ana ekran bir kare görünüp
  // üstüne tanıtım biniyor ve "sıçrama" hissi oluşuyor.
  const [tanitimGerekli, setTanitimGerekli] = useState(null);

  // Kişisel sıcaklık kaymasını diskten okuyoruz. Beklemiyoruz: yüklenene
  // kadar kayma 0, yani öneri "ortalama" hâliyle görünüyor ve okuma bitince
  // kendini düzeltiyor. Açılışı bunun için geciktirmeye değmez.
  useEffect(() => {
    kalibrasyon.yukle();
  }, []);

  // Tanıtım durumu artık ortak depoda: WeatherContext de buna bakıyor ve
  // tanıtım bitmeden konum izni istemiyor.
  useEffect(() => {
    let mounted = true;
    tanitimDepo
      .yukle()
      .then((gorundu) => mounted && setTanitimGerekli(!gorundu));
    return () => {
      mounted = false;
    };
  }, []);

  const tanitimiBitir = async () => {
    setTanitimGerekli(false);
    // Depo, abonelerine haber veriyor: WeatherContext ertelediği konum
    // isteğini tam bu anda çalıştırıyor.
    await tanitimDepo.bitir();
  };

  // Android donanım geri tuşu. Yakalamazsak sistem varsayılanı devreye
  // girip UYGULAMAYI KAPATIYOR — kullanıcı alt ekranlardan geri
  // bastığında ana ekrana dönmek yerine uygulamadan çıkmış oluyordu.
  // true döndürmek "bu tuşu ben işledim" demek; ana ekrandayken false
  // döndürüyoruz ki normal çıkış davranışı korunsun.
  useEffect(() => {
    const abonelik = BackHandler.addEventListener("hardwareBackPress", () => {
      if (screen !== "home") {
        // Geldiği ekrana dönüyor. Önceden her ekrandan doğrudan ana ekrana
        // atıyordu ve kullanıcı yerini kaybediyordu.
        geri();
        return true;
      }
      return false;
    });
    return () => abonelik.remove();
  }, [screen]);

  return (
    // Hata sınırı EN DIŞTA: herhangi bir ekranda oluşan render hatası tüm
    // uygulamayı beyaz ekrana düşürmek yerine toparlanabilir bir ekran
    // gösteriyor.
    <ErrorBoundary>
      <SafeAreaProvider>
        <PremiumProvider>
          {/* WeatherProvider ekranların ÜSTÜNDE duruyor: başka bir ekrana
              girip geri dönünce seçilen şehir ve hava verisi korunuyor. */}
          <WeatherProvider>
            {/* Gardırop da ekranların üstünde: parçalar ve üretilen kombin
                ekran değiştirince sıfırlanmasın. */}
            <WardrobeProvider>
              {/* Bildirimler en içte: metinlerini hem hava verisinden hem
                  üretilen kombinden okuyor, ikisi de üstteki sağlayıcılarda. */}
              <NotificationProvider>
                {/* Reklamlar en içte: premium durumunu okuyup satın alma
                    anında tüm reklam nesnelerini yok ediyor. */}
                <AdsProvider>
                {/*
                  Expo SDK 54 / Android 16'da "edge-to-edge" ZORUNLUDUR ve
                  kapatılamaz: içerik durum çubuğunun ve gezinme çubuğunun
                  altına kadar uzanır. Bu yüzden burada SafeAreaView
                  KULLANMIYORUZ — arka plan gradyanının ekranın tamamını
                  kaplamasını istiyoruz. Güvenli alan boşluğunu her ekran
                  kendi içeriğine padding olarak uyguluyor
                  (useSafeAreaInsets).
                */}
                <View style={styles.kok}>
                  <StatusBar style="light" translucent />

                  {tanitimGerekli === null ? null : tanitimGerekli ? (
                    <OnboardingScreen
                      onBitir={tanitimiBitir}
                      onNavigatePremium={() => git("premium")}
                    />
                  ) : (
                    <>
                      {screen === "home" && (
                        <HomeScreen
                          onNavigatePremium={() => git("premium")}
                          onNavigateOutfit={() => git("outfit")}
                          onNavigateSettings={() => git("settings")}
                          onNavigateQuickSetup={() => git("quicksetup")}
                          onNavigatePacking={() => git("packing")}
                        />
                      )}
                      {screen === "premium" && (
                        <PremiumScreen onBack={geri} />
                      )}
                      {screen === "wardrobe" && (
                        <WardrobeScreen
                          onBack={geri}
                          onNavigateOutfit={() => git("outfit")}
                          onNavigatePremium={() => git("premium")}
                          onNavigateQuickSetup={() => git("quicksetup")}
                        />
                      )}
                      {screen === "quicksetup" && (
                        <QuickSetupScreen
                          onBack={geri}
                          // Ekledikten sonra doğrudan kombine gidiyoruz:
                          // kullanıcı emeğinin karşılığını hemen görsün.
                          // Yığında hızlı kurulumun YERİNE geçiyor — iş
                          // bittikten sonra oraya geri dönmenin anlamı yok.
                          onBitti={() => degistir("outfit")}
                          onKameraya={geri}
                          onNavigatePremium={() => git("premium")}
                        />
                      )}
                      {screen === "outfit" && (
                        <OutfitScreen
                          onBack={geri}
                          onNavigateWardrobe={() => git("wardrobe")}
                          onNavigatePremium={() => git("premium")}
                        />
                      )}
                      {screen === "packing" && (
                        <PackingScreen
                          onBack={geri}
                          onNavigateWardrobe={() => git("wardrobe")}
                        />
                      )}
                      {screen === "settings" && (
                        <SettingsScreen
                          onBack={geri}
                          onNavigatePremium={() => git("premium")}
                        />
                      )}
                    </>
                  )}
                </View>
                </AdsProvider>
              </NotificationProvider>
            </WardrobeProvider>
          </WeatherProvider>
        </PremiumProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  kok: { flex: 1, backgroundColor: "#16233B" },
});
