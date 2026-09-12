import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as bildirim from "../notifications";
import { useWeather } from "./WeatherContext";
import { useWardrobe } from "./WardrobeContext";
import { usePremium } from "./PremiumContext";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { weatherData } = useWeather();
  const { kombin } = useWardrobe();
  // Yağış ve ani soğuma uyarıları Premium'a ait; abonelik değişince
  // bildirimler yeniden planlanmalı.
  const { isPremium } = usePremium();

  const [ayarlar, setAyarlar] = useState(bildirim.VARSAYILAN_AYARLAR);
  const [izin, setIzin] = useState("undetermined");
  const [hazir, setHazir] = useState(false);
  const [planlanan, setPlanlanan] = useState(0);

  // Aynı veriyle tekrar tekrar planlamayı engelleyen imza. Yeniden planlama
  // tüm bildirimleri iptal edip kuruyor; her render'da tetiklenirse
  // kullanıcının bildirimi sürekli silinip yeniden yaratılırdı.
  const sonImza = useRef(null);

  useEffect(() => {
    (async () => {
      const a = await bildirim.ayarlariOku();
      setAyarlar(a);
      setIzin(await bildirim.izinDurumu());
      setHazir(true);
    })();
  }, []);

  const planla = useCallback(
    async (yeniAyarlar = ayarlar) => {
      if (!weatherData) return;
      const sonuc = await bildirim.yenidenPlanla({
        ayarlar: yeniAyarlar,
        weatherData,
        kombin,
        premium: isPremium,
      });
      setPlanlanan(sonuc.planlandi ?? 0);
      return sonuc;
    },
    [ayarlar, weatherData, kombin, isPremium]
  );

  // Hava verisi ya da ayarlar değişince yeniden planla.
  //
  // Yerel bildirimin metni ateşlenme anında üretilemiyor — önceden yazılmak
  // zorunda. Bu yüzden taze tahmin her geldiğinde metni yenileyip yeniden
  // kuruyoruz; aksi halde kullanıcı dünkü havayı anlatan bir bildirim alırdı.
  useEffect(() => {
    if (!hazir || !weatherData || izin !== "granted") return;

    const imza = JSON.stringify([
      weatherData?.current?.time,
      ayarlar.sabahAcik,
      ayarlar.sabahSaat,
      ayarlar.sabahDakika,
      ayarlar.yagisUyarisi,
      ayarlar.sicaklikUyarisi,
      kombin?.baslik ?? null,
      isPremium,
    ]);
    if (imza === sonImza.current) return;
    sonImza.current = imza;

    planla();
  }, [hazir, weatherData, ayarlar, izin, kombin, isPremium, planla]);

  // Uygulama öne geldiğinde izin durumunu tazele: kullanıcı sistem
  // ayarlarından bildirimleri kapatmış olabilir, arayüz bunu yansıtmalı.
  useEffect(() => {
    const abone = AppState.addEventListener("change", async (durum) => {
      if (durum === "active") setIzin(await bildirim.izinDurumu());
    });
    return () => abone.remove();
  }, []);

  const ayarGuncelle = useCallback(
    async (yama) => {
      const yeni = { ...ayarlar, ...yama };
      setAyarlar(yeni);
      await bildirim.ayarlariYaz(yeni);

      // Hepsi kapatıldıysa planlanmışları da temizle — kullanıcı kapattığı
      // halde bildirim almaya devam ederse güveni gider.
      if (!yeni.sabahAcik && !yeni.yagisUyarisi && !yeni.sicaklikUyarisi) {
        await bildirim.tumunuIptalEt();
        setPlanlanan(0);
        sonImza.current = null;
        return;
      }
      sonImza.current = null; // imzayı sıfırla ki efekt yeniden planlasın
    },
    [ayarlar]
  );

  const izinIste = useCallback(async () => {
    const verildi = await bildirim.izinIste();
    setIzin(verildi ? "granted" : "denied");
    if (verildi) {
      sonImza.current = null;
      await planla();
    }
    return verildi;
  }, [planla]);

  // Önizleme, planlanan bildirimin AYNISI olsun diye ona da aynı veriyi
  // veriyoruz. Ekran bu ayrıntıyı bilmek zorunda kalmıyor.
  const ornekGonder = useCallback(
    () =>
      bildirim.ornekGonder({
        weatherData,
        kombin,
        sabahSaat: ayarlar.sabahSaat,
      }),
    [weatherData, kombin, ayarlar.sabahSaat]
  );

  return (
    <NotificationContext.Provider
      value={{
        ayarlar,
        izin,
        planlanan,
        ayarGuncelle,
        izinIste,
        ornekGonder,
        // Uyarılar artık herkese açık; ayarlardaki kilit rozeti de kalkmalı.
        // Anahtarı bırakıyoruz ki ileride bir ayrım gerekirse tek yerden
        // geri açılabilsin.
        uyarilarPremium: false,
        destekleniyor: bildirim.bildirimVarMi(),
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications, NotificationProvider içinde kullanılmalı.");
  return ctx;
}
