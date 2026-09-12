import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as sehirDepo from "../storage/cities";
import { fetchWeather, geocodeCity } from "../api/weather";
import { widgetiGuncelle } from "../widget/guncelle";
import { oku as kalibrasyonuOku } from "../storage/kalibrasyon";
import * as tanitimDepo from "../storage/tanitim";

// --- Çevrimdışı önbellek ---------------------------------------------------
// Uygulama metroda, uçakta veya kapsama dışında açıldığında boş ekran yerine
// en son gördüğü havayı göstersin. Veri bayat olabilir — bunu gizlemiyoruz,
// `cevrimdisi` bayrağıyla arayüzde açıkça belirtiyoruz.
const ONBELLEK_ANAHTARI = "havaOnbellek.v1";

async function onbellegeYaz(data, ad) {
  const kayit = { data, ad, ts: Date.now() };
  try {
    await AsyncStorage.setItem(ONBELLEK_ANAHTARI, JSON.stringify(kayit));
  } catch (e) {
    console.log("Hava önbelleğe yazılamadı:", e?.message);
  }
  // Ana ekran widget'ı aynı veriyi okuyor; yazar yazmaz itiyoruz ki
  // uygulamayla widget arasında saatlerce süren fark oluşmasın.
  // Yazma başarısız olsa bile deniyoruz: widget'ın elindeki veri
  // ne olursa olsun bundan daha eski.
  widgetiGuncelle(kayit, kalibrasyonuOku());
}

async function onbellektenOku() {
  try {
    const ham = await AsyncStorage.getItem(ONBELLEK_ANAHTARI);
    if (!ham) return null;
    const p = JSON.parse(ham);
    return p?.data ? p : null;
  } catch {
    return null;
  }
}

// Hava durumu state'i neden burada, HomeScreen'de değil:
// App.js ekranlar arasında koşullu render yapıyor (home | premium).
// State HomeScreen içinde tutulunca, kullanıcı Premium ekranına girip
// geri döndüğünde HomeScreen SÖKÜLÜP yeniden kuruluyor ve seçilen şehir
// kayboluyordu. Provider ekranların üstünde durduğu için state korunuyor.

// expo-location'ın getCurrentPositionAsync çağrısının kendi zaman aşımı
// YOKTUR: GPS sinyali alamayan bir cihazda promise ne çözülür ne
// reddedilir, sonsuza kadar askıda kalır.
function zamanAsimiIle(promise, ms, mesaj) {
  let zamanlayici;
  const zamanAsimi = new Promise((_, reject) => {
    zamanlayici = setTimeout(() => reject(new Error(mesaj)), ms);
  });
  return Promise.race([promise, zamanAsimi]).finally(() => clearTimeout(zamanlayici));
}

const WeatherContext = createContext(null);

export function WeatherProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [locationName, setLocationName] = useState("Konum");
  const [weatherData, setWeatherData] = useState(null);
  // Arama kutusunun içeriği de burada tutuluyor ki ekran değişince silinmesin
  const [cityQuery, setCityQuery] = useState("");
  // Birden fazla eşleşme çıktığında kullanıcıya sunulan liste
  const [sehirSonuclari, setSehirSonuclari] = useState([]);
  // Verinin ne zaman çekildiği — kullanıcı bayat veriye bakıp bakmadığını bilsin
  const [sonGuncelleme, setSonGuncelleme] = useState(null);
  // Ekranda gösterilen veri ağdan mı geldi, önbellekten mi?
  const [cevrimdisi, setCevrimdisi] = useState(false);
  // Ertelenen konum isteği için: önbelleği ve "bir kez çalıştı" durumunu taşır.
  const onbellekRef = useRef(null);
  const konumIstendi = useRef(false);

  /**
   * "Çevrimdışı" rozetinin eşiği.
   *
   * Rozet eskiden "son ağ isteği başarısız oldu" demekti; bu YANILTICIYDI.
   * Konum izni verilmeyen kullanıcıda açılıştaki konum isteği hep
   * başarısız oluyor ve interneti kusursuz olsa bile, elle aradığı şehrin
   * saniyeler önce çekilmiş verisinin üstünde kalıcı "Çevrimdışı ·
   * bağlantı bekleniyor" yazıyordu.
   *
   * Rozetin cevaplaması gereken soru "istek başarılı mıydı" değil,
   * "baktığım şey güncel mi". Bu yüzden verinin YAŞINA bakıyoruz. 1 saat:
   * hava bu sürede kıyafet kararını değiştirecek kadar değişmiyor, ama
   * daha eskisi için uyarmak gerekiyor.
   */
  const BAYAT_ESIGI_MS = 60 * 60 * 1000;
  // Kullanıcının kaydettiği şehirler ve o an hangisinin açık olduğu
  const [kayitliSehirler, setKayitliSehirler] = useState([]);
  const [aktifSehir, setAktifSehir] = useState(null);
  const ilkYuklemeYapildi = useRef(false);
  // Konum adını ref'te de tutuyoruz: `loadByCoords` yenilemede name=null ile
  // çağrılıyor ve önbelleğe null yazarsak, çevrimdışı açılışta konum adı
  // "Konum" olarak geri gelirdi.
  const konumAdiRef = useRef("Konum");
  // Aktif konumun koordinatı — "bu şehri kaydet" için gerekli.
  const koordinatRef = useRef(null);

  const loadByCoords = useCallback(async (lat, lon, name) => {
    setError(null);
    try {
      const data = await fetchWeather(lat, lon);
      setWeatherData(data);
      koordinatRef.current = { enlem: lat, boylam: lon };
      if (name) {
        setLocationName(name);
        konumAdiRef.current = name;
      }
      setAktifSehir({ ad: konumAdiRef.current, enlem: lat, boylam: lon });
      setSonGuncelleme(Date.now());
      setCevrimdisi(false);
      setLoading(false);
      onbellegeYaz(data, konumAdiRef.current);
      return true;
    } catch (e) {
      setError(e.message || "Hava durumu alınamadı.");
      return false;
    }
  }, []);

  const loadFromDeviceLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Konum izni verilmedi. Yukarıdan şehir arayabilirsin.");
        return false;
      }

      // Önce son bilinen konum: anında döner, GPS beklemez.
      let pos = await Location.getLastKnownPositionAsync().catch(() => null);

      // Yoksa taze konum iste — ama 15 saniyeden fazla bekleme.
      if (!pos) {
        pos = await zamanAsimiIle(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          15000,
          "Konum zaman aşımına uğradı."
        );
      }

      // Koordinattan şehir adı çöz. Başarısız olursa hava durumunu yine
      // gösteriyoruz, sadece isim jenerik kalıyor.
      const places = await zamanAsimiIle(
        Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
        8000,
        "Adres çözümlenemedi."
      ).catch(() => []);

      const yer = places?.[0];
      const ad =
        [yer?.city || yer?.subregion, yer?.region].filter(Boolean).join(", ") ||
        yer?.city ||
        yer?.subregion ||
        "Konumun";

      return await loadByCoords(pos.coords.latitude, pos.coords.longitude, ad);
    } catch (e) {
      setError("Konum alınamadı. Yukarıdan şehir arayabilir veya tekrar deneyebilirsin.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [loadByCoords]);

  const sehirEtiketi = (r) =>
    [r.name, r.admin1, r.country].filter(Boolean).join(", ");

  const sehirSec = useCallback(
    async (sonuc) => {
      setSehirSonuclari([]);
      setCityQuery("");
      return loadByCoords(sonuc.latitude, sonuc.longitude, [sonuc.name, sonuc.admin1]
        .filter(Boolean)
        .join(", "));
    },
    [loadByCoords]
  );

  const searchCity = useCallback(
    async (query) => {
      const aranan = (query ?? "").trim();
      if (!aranan) return false;
      setSearching(true);
      setError(null);
      setSehirSonuclari([]);
      try {
        const results = await geocodeCity(aranan);

        // Tek sonuç varsa doğrudan aç. Birden fazlaysa KULLANICIYA SOR:
        // önceden koşulsuz results[0] alınıyordu ve "Ankara" arayan biri
        // bambaşka bir ülkedeki aynı adlı kasabaya düşebiliyordu.
        if (results.length === 1) return await sehirSec(results[0]);

        setSehirSonuclari(results.map((r) => ({ ...r, etiket: sehirEtiketi(r) })));
        return true;
      } catch (e) {
        setError(e.message || "Şehir bulunamadı.");
        return false;
      } finally {
        setSearching(false);
      }
    },
    [sehirSec]
  );

  const sonuclariTemizle = useCallback(() => setSehirSonuclari([]), []);

  // --- Kayıtlı şehirler ----------------------------------------------------
  // Kullanıcı memleketini, çalıştığı şehri ve gideceği yeri kaydedip
  // aralarında tek dokunuşla geçebilsin. Önceden her arama öncekini
  // siliyordu ve şehir adını tekrar yazmak gerekiyordu.

  useEffect(() => {
    sehirDepo.listele().then(setKayitliSehirler);
  }, []);

  const sehirKaydet = useCallback(async () => {
    // Koordinatı `weatherData`dan alıyoruz, `koordinatRef`ten değil.
    //
    // `koordinatRef` yalnızca loadByCoords içinde doldurulan bir AYNA.
    // Önbellekten açılışta (çevrimdışı ya da konum izni yokken) o yol hiç
    // çalışmıyor ve ref null kalıyordu: kullanıcı en son şehrini görüyor ama
    // "Bu şehri kaydet" hiçbir şey yapmıyor, geri bildirim de vermiyordu.
    // `weatherData` önbellekle birlikte kalıcı, tek kaynak o.
    const enlem = weatherData?.latitude ?? koordinatRef.current?.enlem;
    const boylam = weatherData?.longitude ?? koordinatRef.current?.boylam;
    if (enlem == null || boylam == null) return null;

    const yeni = await sehirDepo.ekle({ ad: konumAdiRef.current, enlem, boylam });
    setKayitliSehirler(yeni);
    // Kaydedilen şehir aynı zamanda AKTİF olan; rozet vurgusu buna bakıyor.
    setAktifSehir({ ad: konumAdiRef.current, enlem, boylam });
    return yeni;
  }, [weatherData]);

  const sehirKaldir = useCallback(async (kimlik) => {
    const yeni = await sehirDepo.kaldir(kimlik);
    setKayitliSehirler(yeni);
    return yeni;
  }, []);

  const kayitliSehreGec = useCallback(
    async (sehir) => {
      setLoading(true);
      try {
        // Listeyi de tazeliyoruz: `ekle` seçileni başa taşıyor, böylece en
        // son kullanılan şehir hep en solda kalıyor.
        const yeni = await sehirDepo.ekle(sehir);
        setKayitliSehirler(yeni);
        return await loadByCoords(sehir.enlem, sehir.boylam, sehir.ad);
      } finally {
        setLoading(false);
      }
    },
    [loadByCoords]
  );

  const aktifKayitli = kayitliSehirler.some(
    (s) => sehirDepo.sehirKimligi(s) === sehirDepo.sehirKimligi(aktifSehir)
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Kullanıcı bir şehir seçtiyse onu koru, konuma geri dönme.
      if (weatherData?.latitude != null && weatherData?.longitude != null) {
        await loadByCoords(weatherData.latitude, weatherData.longitude, null);
      } else {
        await loadFromDeviceLocation();
      }
    } finally {
      setRefreshing(false);
    }
  }, [weatherData, loadByCoords, loadFromDeviceLocation]);

  // Uygulama ilk açıldığında: ÖNCE önbellek, SONRA ağ.
  //
  // Çevrimdışı-öncelikli akış: kullanıcı boş ekrana bakmıyor, en son gördüğü
  // havayı anında görüyor; taze veri gelince sessizce üstüne yazılıyor.
  // Ağ başarısız olursa önbellekteki veri ekranda kalıyor ve "çevrimdışı"
  // olarak işaretleniyor — hata ekranı göstermektense bayat ama gerçek veri
  // göstermek daha faydalı.
  useEffect(() => {
    if (ilkYuklemeYapildi.current) return;
    ilkYuklemeYapildi.current = true;

    (async () => {
      const onbellek = await onbellektenOku();
      if (onbellek) {
        setWeatherData(onbellek.data);
        if (onbellek.ad) {
          setLocationName(onbellek.ad);
          konumAdiRef.current = onbellek.ad;
        }
        setSonGuncelleme(onbellek.ts ?? null);
        setCevrimdisi(true);
        // Aktif şehri de kuruyoruz: kayıtlı şehir rozetlerindeki "şu an bu
        // şehirdesin" vurgusu buna bakıyor ve önbellekten açılışta hiçbir
        // rozet vurgulanmıyordu.
        if (onbellek.data?.latitude != null && onbellek.data?.longitude != null) {
          koordinatRef.current = {
            enlem: onbellek.data.latitude,
            boylam: onbellek.data.longitude,
          };
          setAktifSehir({
            ad: onbellek.ad ?? konumAdiRef.current,
            enlem: onbellek.data.latitude,
            boylam: onbellek.data.longitude,
          });
        }
        setLoading(false); // iskelet yerine gerçek veri göster
      }

      // KONUM İSTEĞİ TANITIM BİTENE KADAR ERTELENİYOR.
      //
      // Temiz kurulumda bu istek hemen çalışıyordu ve kullanıcı, uygulama
      // daha kendini tanıtmadan bir sistem izin penceresiyle karşılaşıyordu.
      // Cihazda görüldü: pencere tanıtımın üstüne biniyor. Ne istendiğini
      // bilmeden verilen karar çoğunlukla "reddet" oluyor ve kullanıcı
      // sonsuza kadar şehri elle aramak zorunda kalıyor.
      if (tanitimDepo.oku() !== true) {
        onbellekRef.current = onbellek;
        return;
      }

      const basarili = await loadFromDeviceLocation().catch((e) => {
        console.log("Konum yüklenirken beklenmeyen hata:", e?.message);
        return false;
      });

      // Ağ başarısız ama elimizde önbellek varsa: hatayı gizle, bayat veriyi
      // göstermeye devam et. Kullanıcıya kırmızı kutu yerine ince bir
      // "çevrimdışı" rozeti yeterli.
      if (!basarili && onbellek) setError(null);
    })();
  }, [loadFromDeviceLocation]);

  // Tanıtım bitince ertelenen konum isteğini çalıştır.
  useEffect(() => {
    const calistir = async () => {
      if (tanitimDepo.oku() !== true) return;
      if (konumIstendi.current) return;
      konumIstendi.current = true;

      const basarili = await loadFromDeviceLocation().catch((e) => {
        console.log("Konum yüklenirken beklenmeyen hata:", e?.message);
        return false;
      });
      if (!basarili && onbellekRef.current) setError(null);
    };

    // Tanıtım zaten bitmişse (her normal açılış) hemen; değilse bitince.
    calistir();
    return tanitimDepo.abone(calistir);
  }, [loadFromDeviceLocation]);

  // Rozeti burada türetiyoruz: `cevrimdisi` bayrağı yalnızca "önbellekten
  // açıldık" demek; kullanıcıya bayat olduğunu söylemek için verinin
  // gerçekten eskimiş olması da gerekiyor.
  const veriBayat =
    cevrimdisi &&
    (sonGuncelleme == null || Date.now() - sonGuncelleme > BAYAT_ESIGI_MS);

  return (
    <WeatherContext.Provider
      value={{
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
        cevrimdisi: veriBayat,
        kayitliSehirler,
        aktifSehir,
        aktifKayitli,
        sehirKaydet,
        sehirKaldir,
        kayitliSehreGec,
        sehirKimligi: sehirDepo.sehirKimligi,
        azamiSehir: sehirDepo.AZAMI,
      }}
    >
      {children}
    </WeatherContext.Provider>
  );
}

export function useWeather() {
  const ctx = useContext(WeatherContext);
  if (!ctx) throw new Error("useWeather, WeatherProvider içinde kullanılmalı.");
  return ctx;
}
