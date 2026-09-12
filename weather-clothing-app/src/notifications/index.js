// Yerel bildirimler — sabah özeti, yağış ve ani sıcaklık düşüşü uyarıları.
//
// Hepsi YEREL bildirim; sunucu ya da push jetonu gerektirmiyor. Bu, v1.0 ile
// yayına çıkabilmelerinin sebebi: yapay zeka sunucusu kapalıyken de tam
// çalışıyorlar.
//
// Temel kısıt: yerel bildirim, ateşlendiği anda hava durumunu ÇEKEMEZ —
// metni önceden yazılmış olmak zorunda. Bu yüzden uygulama her açıldığında
// planlanmış bildirimler iptal edilip TAZE tahminle yeniden kuruluyor.
// Kullanıcı uygulamayı günlerce açmazsa bildirim metni bayatlar; bu yüzden
// metinde "şu an" değil, o saate ait tahmin bilgisi kullanılıyor.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { describeWeatherCode, getHourlyForecast, get15Dakikalik } from "../api/weather";
import { kaymaDegeri } from "../logic/kalibrasyon";
import { sogumaUyarisi, yagmurUyarisi } from "../logic/uyarilar";
import {
  gunDilimi,
  sabahOzetMetni,
  sabahSaatleri,
  gunlereBol,
  tepedenDilimle,
  UYARI_GUN_SAYISI,
} from "../logic/gunOzeti";
import * as kalibrasyonDepo from "../storage/kalibrasyon";
import { getClothingAdvice } from "../logic/clothingAdvice";

// Native modül korumalı yükleniyor: Expo Go'da veya modülü içermeyen bir
// build'de import hatası TÜM uygulamayı düşürürdü.
let N = null;
try {
  N = require("expo-notifications");
} catch (e) {
  N = null;
}

// Uygulama ÖNDEYKEN gelen bildirimin ne yapacağı. Varsayılan davranış
// bildirimi hiç göstermemek — kullanıcı uygulamayı açık tutarken sabah
// bildirimini kaçırırdı. Banner + ses gösteriyoruz.
if (N?.setNotificationHandler) {
  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (e) {
    console.log("Bildirim işleyicisi kurulamadı:", e?.message);
  }
}

export const AYAR_ANAHTARI = "bildirimAyarlari.v2";
// v1'den taşınıyoruz: test kullanıcıları sabah özetinin 08:00'de çok geç
// geldiğini, çıkmadan önce göremediklerini bildirdi. Varsayılanı 06:00'ya
// çektik. Anahtarı sürümlemek şart: yalnızca varsayılanı değiştirseydik
// ayarı bir kez kaydetmiş olan mevcut kullanıcılar 08:00'de kalırdı.
const ESKI_AYAR_ANAHTARI = "bildirimAyarlari.v1";
const ESKI_VARSAYILAN_SAAT = 8;

export const VARSAYILAN_AYARLAR = {
  sabahAcik: true,
  sabahSaat: 6,
  sabahDakika: 0,
  yagisUyarisi: true,
  sicaklikUyarisi: true,
};

// Android'de kanal ZORUNLU: kanal kurulmadan gönderilen bildirim sessizce
// düşürülür veya varsayılan kanala düşüp kullanıcı ayarlarına saygı göstermez.
const KANAL_SABAH = "sabah-ozeti";
const KANAL_UYARI = "hava-uyarilari";

export function bildirimVarMi() {
  return N !== null;
}

export async function ayarlariOku() {
  try {
    const ham = await AsyncStorage.getItem(AYAR_ANAHTARI);
    if (ham) return { ...VARSAYILAN_AYARLAR, ...JSON.parse(ham) };

    // v1 -> v2 göçü. Kullanıcı saati BİLEREK değiştirdiyse ona dokunmuyoruz;
    // yalnızca eski varsayılanda (08:00) kalmış olanları 06:00'ya alıyoruz.
    const eskiHam = await AsyncStorage.getItem(ESKI_AYAR_ANAHTARI);
    if (eskiHam) {
      const eski = { ...VARSAYILAN_AYARLAR, ...JSON.parse(eskiHam) };
      if (eski.sabahSaat === ESKI_VARSAYILAN_SAAT && eski.sabahDakika === 0) {
        eski.sabahSaat = VARSAYILAN_AYARLAR.sabahSaat;
      }
      await AsyncStorage.setItem(AYAR_ANAHTARI, JSON.stringify(eski));
      await AsyncStorage.removeItem(ESKI_AYAR_ANAHTARI);
      return eski;
    }

    return { ...VARSAYILAN_AYARLAR };
  } catch {
    return { ...VARSAYILAN_AYARLAR };
  }
}

export async function ayarlariYaz(ayarlar) {
  try {
    await AsyncStorage.setItem(AYAR_ANAHTARI, JSON.stringify(ayarlar));
  } catch (e) {
    console.log("Bildirim ayarları yazılamadı:", e?.message);
  }
}

export async function izinDurumu() {
  if (!N) return "yok";
  try {
    const { status } = await N.getPermissionsAsync();
    return status; // "granted" | "denied" | "undetermined"
  } catch {
    return "yok";
  }
}

export async function izinIste() {
  if (!N) return false;
  try {
    const mevcut = await N.getPermissionsAsync();
    if (mevcut.status === "granted") return true;
    const { status } = await N.requestPermissionsAsync();
    return status === "granted";
  } catch (e) {
    console.log("Bildirim izni istenemedi:", e?.message);
    return false;
  }
}

async function kanallariKur() {
  if (!N || Platform.OS !== "android") return;
  try {
    await N.setNotificationChannelAsync(KANAL_SABAH, {
      name: "Sabah özeti",
      description: "Her sabah günün havası ve kıyafet önerisi",
      importance: N.AndroidImportance.DEFAULT,
      sound: "default",
    });
    await N.setNotificationChannelAsync(KANAL_UYARI, {
      name: "Hava uyarıları",
      description: "Yağış ve ani sıcaklık değişimi uyarıları",
      // Uyarılar zamana duyarlı — kullanıcı yağmura yakalanmadan görmeli.
      importance: N.AndroidImportance.HIGH,
      sound: "default",
    });
  } catch (e) {
    console.log("Bildirim kanalları kurulamadı:", e?.message);
  }
}

// --- Metin üretimi ---------------------------------------------------------

const EMOJI_HAVA = {
  yagmur: "🌧️",
  kar: "❄️",
  firtina: "⛈️",
  sis: "🌫️",
};

function havaEmojisi(kod) {
  if ([95, 96, 99].includes(kod)) return EMOJI_HAVA.firtina;
  if ([71, 73, 75, 77, 85, 86].includes(kod)) return EMOJI_HAVA.kar;
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(kod))
    return EMOJI_HAVA.yagmur;
  if ([45, 48].includes(kod)) return EMOJI_HAVA.sis;
  return describeWeatherCode(kod, 1).icon;
}

/**
 * Sabah bildiriminin gövdesini üretir.
 *
 * `kombin` verilirse (Premium + gardırop dolu) kullanıcının GERÇEK parçaları
 * anılıyor; yoksa genel kıyafet önerisine düşüyoruz. İkisi de yoksa yalnızca
 * hava özeti — boş bildirim göndermektense az bilgi vermek yeğ.
 */
export function sabahMetni(saatlikVeri, kombin, tumSaatler = null) {
  if (!saatlikVeri) return null;

  const emoji = havaEmojisi(saatlikVeri.code);
  const durum = describeWeatherCode(saatlikVeri.code, 1).text.toLowerCase();
  const kayma = kaymaDegeri(kalibrasyonDepo.oku());

  // Bildirim BİR SAATİ değil, GÜNÜ anlatmalı.
  //
  // Eskiden yalnızca `saatlikVeri` (08:00 kovası) kullanılıyordu ve başlık
  // "Bugün 12°" oluyordu. 26°'ye çıkan bir günde kullanıcı fazla giyinip
  // öğlen pişiyordu; üstelik 14:00'teki yağmurdan hiç söz edilmiyordu ve
  // şemsiye kararı tam evden çıkarken veriliyor.
  //
  // Tüm saatlik seri verildiğinde gün özetine geçiyoruz. Verilmediğinde
  // (eski çağrılar, test) tek saatlik davranış korunuyor.
  if (Array.isArray(tumSaatler) && tumSaatler.length > 0) {
    const dilim = gunDilimi(tumSaatler, saatlikVeri.time);
    const ozet = sabahOzetMetni(dilim, {
      kayma,
      emoji,
      durum,
      kombinBasligi: kombin?.baslik ?? null,
    });
    if (ozet) return ozet;
  }

  const { temp, code } = saatlikVeri;
  const derece = Math.round(temp);
  const hissedilen = saatlikVeri.hissedilen ?? temp;

  // Hissedilen ile ölçüm belirgin ayrıştığında bunu SÖYLÜYORUZ.
  //
  // "Bugün 23°" deyip kullanıcıyı rüzgarda üşütmek, uygulamanın hatası gibi
  // görünüyor. 3° eşiği bilinçli: altındaki farklar giyim kararını
  // değiştirmiyor ve her gün parantez açmak başlığı yorar.
  const fark = Math.round(hissedilen) - derece;
  const baslik =
    Math.abs(fark) >= 3
      ? `Bugün ${derece}°, ${Math.round(hissedilen)}° gibi hissedilecek ${emoji}`
      : `Bugün ${derece}° ve ${durum} ${emoji}`;

  if (kombin?.baslik) {
    return { baslik, govde: kombin.baslik };
  }

  const oneri = getClothingAdvice(
    {
      temperature_2m: temp,
      apparent_temperature: hissedilen,
      weather_code: code,
      wind_speed_10m: saatlikVeri.ruzgar ?? 0,
      // Yağış ve nem eskiden 0 ve 50 olarak SABİTLENMİŞTİ; saatlik seri o
      // alanları taşımıyordu. Artık gerçek değerler geliyor, öneri de
      // yağmurluk/nem yorumunu doğru yapabiliyor.
      precipitation: saatlikVeri.yagisMm ?? 0,
      relative_humidity_2m: saatlikVeri.nem ?? 50,
      is_day: 1,
    },
    // Sabah bildirimi de kişiselleşiyor. Uygulama içinde "hırka" derken
    // bildirimde "tişört" demek, iki ayrı uygulama gibi görünürdü.
    { isPremium: false, kayma }
  );

  return { baslik, govde: oneri.headline };
}

// --- Planlama --------------------------------------------------------------

/** Planlanmış TÜM bildirimleri siler. Yeniden planlamadan önce çağrılıyor. */
export async function tumunuIptalEt() {
  if (!N) return;
  try {
    await N.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.log("Bildirimler iptal edilemedi:", e?.message);
  }
}

/**
 * Her şeyi taze tahminle yeniden planlar.
 *
 * Her uygulama açılışında çağrılıyor. Önce hepsini iptal edip yeniden
 * kurmak, "aynı bildirim iki kez planlandı" sınıfı hataları kökten
 * engelliyor — tekilleştirme mantığı yazmaya gerek kalmıyor.
 */
export async function yenidenPlanla({ ayarlar, weatherData, kombin, premium = false }) {
  if (!N) return { planlandi: 0 };

  const izin = await izinDurumu();
  if (izin !== "granted") return { planlandi: 0, izinYok: true };

  await kanallariKur();
  await tumunuIptalEt();

  let planlandi = 0;

  // TÜM bildirimler herkese açık.
  //
  // Yağış ve ani soğuma uyarıları önceden Premium'a kilitliydi. İki sebeple
  // açıldı: (1) ıslanmak ya da üşümek uygulamanın çözmeyi vaat ettiği asıl
  // sorun, onu ödeme duvarının arkasına koymak ücretsiz kullanıcıya eksik
  // bir uygulama bırakıyordu; (2) ücretsiz kullanıcı yalnızca sabah özeti
  // aldığı için bildirim kanalı zayıf kalıyor, uygulama unutuluyordu.
  //
  // `premium` parametresi imzada KALIYOR: çağıranları değiştirmemek ve
  // ileride bir ayrım gerekirse tek satırda geri alabilmek için.
  const uyarilarAcik = true;

  // 1) Sabah özeti — her gün aynı saatte tekrar eder.
  if (ayarlar.sabahAcik) {
    // 8 günlük saatlik seri: 7 sabahın her birine kendi metnini yazabilmek
    // için gün sonlarına kadar veri gerekiyor.
    const saatler = getHourlyForecast(weatherData, 24 * 8);
    const hedefler = sabahSaatleri(saatler, ayarlar.sabahSaat);

    // HER GÜN İÇİN AYRI, O GÜNE AİT METİN.
    //
    // Eskiden tek bir DAILY tekrarlı bildirim vardı ve metni bir kez
    // yazılıyordu; uygulama günlerce açılmazsa aynı yanlış cümle her sabah
    // tekrar gidiyordu. Artık her sabah kendi tahminini taşıyor.
    for (const hedef of hedefler) {
      const metin = sabahMetni(hedef, kombin, saatler);
      if (!metin) continue;

      // Bildirimin dakikası ayarlardan; saatlik seri yalnızca tam saat verir.
      const an = new Date(hedef.time);
      an.setMinutes(ayarlar.sabahDakika, 0, 0);
      if (an.getTime() <= Date.now() + 60 * 1000) continue;

      try {
        await N.scheduleNotificationAsync({
          content: { title: metin.baslik, body: metin.govde, sound: "default" },
          trigger: {
            type: N.SchedulableTriggerInputTypes.DATE,
            date: an,
            channelId: KANAL_SABAH,
          },
        });
        planlandi++;
      } catch (e) {
        console.log("Sabah bildirimi planlanamadı:", e?.message);
      }
    }

    // Tahmin penceresi bittikten sonrası için BİLEREK bildirim koymuyoruz.
    //
    // "Günaydın, havaya göz at" gibi bilgisiz bir hatırlatma göndermek
    // kullanıcıyı bu kanalı yok saymaya alıştırıyor; asıl söyleyecek bir
    // şeyimiz olduğu gün de görmüyor. Kullanıcı uygulamayı bir hafta
    // açmadıysa zaten her açılışta plan taze tahminle yeniden kuruluyor.
  }

  // Uyarı kararları ve metinleri `logic/uyarilar.js` içinde — orada saf ve
  // test edilebilir durumdalar. Burada yalnızca zamanlama var.
  //
  // UYARILAR ARTIK GÜN GÜN PLANLANIYOR.
  //
  // Önceden yalnızca önümüzdeki 12 saate bakılıyordu ve toplam TEK yağmur,
  // TEK soğuma uyarısı kuruluyordu. Sabah özetleri 7 günü kapsarken
  // uyarıların bir günü bile tamamlamaması tutarsızdı: kullanıcı yarın
  // öğleden sonraki sağanağı, uygulamayı o gün açmadıkça hiç öğrenmiyordu.
  const uyariCeyrekleri = get15Dakikalik(weatherData, 48);
  const kayma = kaymaDegeri(kalibrasyonDepo.oku());
  const uyariGunleri = gunlereBol(getHourlyForecast(weatherData, 24 * (UYARI_GUN_SAYISI + 1)));

  /** Uyarıyı verilen dakika kadar ÖNCESİNE planlar. */
  const uyariPlanla = async (u, oncedenDk, etiket) => {
    if (!u) return;
    const an = new Date(u.iso).getTime() - oncedenDk * 60 * 1000;
    // Geçmişe ya da bir dakikadan yakına planlamıyoruz.
    if (an <= Date.now() + 60 * 1000) return;
    try {
      await N.scheduleNotificationAsync({
        content: { title: u.baslik, body: u.govde, sound: "default" },
        trigger: {
          type: N.SchedulableTriggerInputTypes.DATE,
          date: new Date(an),
          channelId: KANAL_UYARI,
        },
      });
      planlandi++;
    } catch (e) {
      console.log(`${etiket} planlanamadı:`, e?.message);
    }
  };

  for (let g = 0; g < uyariGunleri.length; g++) {
    // Bugün "şu an"dan başlıyor; taban zaten doğru. Gelecek günler
    // 00:00'dan başlıyor ve gece yarısı günün en soğuk anı olduğu için
    // düşüş hiç görünmüyordu — onları tepe saatten dilimliyoruz.
    const gunSaatleri = g === 0 ? uyariGunleri[g] : tepedenDilimle(uyariGunleri[g]);
    // 2) Yağış uyarısı — yağıştan 45 dakika önce.
    //
    // 45 dakika: kullanıcının şemsiye alıp çıkmaya vakti olsun. Yağmur
    // başladıktan sonraki uyarı işe yaramaz.
    //
    // 15 dakikalık seri yalnızca ilk 12 saati kapsıyor; sonraki günlerde
    // başlangıç saati saatlik kovadan geliyor. Bilerek: yanlış bir
    // keskinlik yerine "16:00 civarı" demek daha dürüst.
    if (ayarlar.yagisUyarisi && uyarilarAcik) {
      await uyariPlanla(yagmurUyarisi(gunSaatleri, uyariCeyrekleri), 45, "Yağış uyarısı");
    }

    // 3) Ani soğuma — soğumadan bir saat önce.
    if (ayarlar.sicaklikUyarisi && uyarilarAcik) {
      await uyariPlanla(sogumaUyarisi(gunSaatleri, { kayma }), 60, "Soğuma uyarısı");
    }
  }

  return { planlandi };
}

/**
 * Ayarlar ekranındaki "şimdi dene" için — 5 saniye sonra örnek bildirim.
 *
 * Metni GERÇEK veriden üretiyoruz. Önceden sabit bir "15° ve yağmurlu"
 * yazıyordu; kullanıcı 23° güneşli bir günde bunu görünce önizlemenin
 * uydurma olduğunu anlıyor ve asıl sorusunun ("bana ne gönderileceksiniz?")
 * cevabını alamıyordu. Veri yoksa örnek metne düşüyoruz.
 */
export async function ornekGonder({ weatherData, kombin, sabahSaat = 6 } = {}) {
  if (!N) return false;
  await kanallariKur();

  // Planlamayla AYNI saati seçiyoruz: önizleme, gerçekten gönderilecek
  // bildirimin birebir aynısı olmalı — yoksa önizleme olmaz.
  const saatler = weatherData ? getHourlyForecast(weatherData, 48) : [];
  const hedef =
    saatler.find((s) => Number(s.time?.slice(11, 13)) === sabahSaat) ?? saatler[0];

  const metin = sabahMetni(hedef, kombin, saatler) ?? {
    baslik: "Bugün 15° ve yağmurlu 🌧️",
    govde: "Su geçirmez montunu ve şemsiyeni almayı unutma!",
  };
  try {
    await N.scheduleNotificationAsync({
      content: {
        title: metin.baslik,
        body: metin.govde,
        sound: "default",
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
        channelId: KANAL_SABAH,
      },
    });
    return true;
  } catch (e) {
    console.log("Örnek bildirim gönderilemedi:", e?.message);
    return false;
  }
}

export async function planlananSayisi() {
  if (!N) return 0;
  try {
    return (await N.getAllScheduledNotificationsAsync()).length;
  } catch {
    return 0;
  }
}
