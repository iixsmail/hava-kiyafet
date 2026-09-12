# Hava & Kıyafet 🌦️👔

Ücretsiz hava durumu uygulaması. Günün hava durumunu gösterir ve buna göre
kıyafet/eşya önerisi verir (örn. "Hafif yağmur geçişi var, şemsiyeni al").
**Ücretsiz plan:** Google reklamları gösterilir.
**Premium (250 TL/yıl):** reklamsız kullanım + 7 günlük tahmin + tüm öneriler.

Bu proje **Expo (React Native)** ile yazıldı. Hava verisi **Open-Meteo**'dan
geliyor (ücretsiz, API anahtarı gerektirmiyor).

---

## ÖNEMLİ: Artık gerçek ödeme ve gerçek reklam altyapısı var

Önceki sürümde "Premium'a geç" butonu satın almayı simüle ediyordu (anında
premium yapıyordu). Artık kod **gerçek Google Play ödeme akışını**
(`react-native-iap`) ve **gerçek AdMob reklamlarını**
(`react-native-google-mobile-ads`) kullanıyor. Bunun için:

1. **Expo Go artık yeterli değil** — bu iki paket native modül içeriyor,
   sadece bir "development build" veya Play Store'dan indirilen gerçek
   uygulamada çalışırlar. Aşağıdaki adım 2'yi takip et.
2. Kodu ilk açtığında (Expo Go'da) satın alma ekranı sana şu uyarıyı
   gösterecek: *"Gerçek ödeme ekranı sadece development build'de açılır"* —
   bu bir hata değil, beklenen davranış.

---

## 1) Bilgisayarında geliştirme (Expo Go ile — hızlı test)

```bash
npm install
npx expo start
```
Telefonunda **Expo Go** ile QR kodu tara. Hava durumu, konum, kıyafet
önerisi ve reklamsız/premium arayüz burada tam çalışır. Sadece **gerçek
satın alma ve gerçek reklam** bu modda çalışmaz (adım 3'e bak).

---

## 2) Google Play Console kurulumu (25$ tek seferlik ücret)

1. [Google Play Console](https://play.google.com/console)'da hesap aç,
   uygulamanı oluştur, paket adı `com.ismail.havakiyafet` (veya `app.json`
   içinde değiştirdiğin ad).
2. **Monetization > Subscriptions** kısmından yeni bir abonelik oluştur:
   - Ürün ID: `premium_yillik` (kodla birebir aynı olmalı)
   - Faturalama periyodu: **1 yıl**
   - Fiyat: **250,00 TL** (Türkiye için) — Play Console farklı ülkeler için
     otomatik döviz karşılığı önerir, istersen düzenleyebilirsin.
3. **Monetization > Ad units** ile bağlantılı olarak, önce
   [AdMob](https://apps.admob.com)'da hesap aç, uygulamanı ekle, bir
   **Banner** reklam birimi oluştur. Sana iki ID verecek:
   - **App ID** (`ca-app-pub-XXXX~YYYY` formatında) → `app.json` içindeki
     `androidAppId` alanına yaz
   - **Ad unit ID** (`ca-app-pub-XXXX/ZZZZ` formatında) → `src/components/AdBanner.js`
     içindeki `PRODUCTION_BANNER_ID` değerine yaz

---

## 3) Gerçek ödeme ve reklamı test etmek (development build)

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --profile development --platform android
```

Bu, telefonuna kurabileceğin bir `.apk` üretir (Play Store'a yüklemeden).
Bu build içinde artık **gerçek Google Play ödeme ekranı** açılır ve
**gerçek AdMob reklamları** (test modunda, `TestIds.BANNER`) görünür.

Not: Gerçek ödeme test etmek için uygulamanın Play Console'da en az
**"kapalı test" (closed testing)** aşamasında olması ve senin test
kullanıcısı olarak eklenmiş olman gerekir — bu Google'ın kuralı, atlanamaz.

---

## 4) Play Store'a yayınlamak (üretim paketi)

```bash
eas build --profile production --platform android
```

Bu `.aab` dosyasını doğrudan Play Console'a yükle. **Yayınlamadan önce**
`src/components/AdBanner.js` içindeki `PRODUCTION_BANNER_ID`'nin gerçek
(test değil) ID olduğundan emin ol — test ID ile yayınlarsan reklam geliri
almazsın ve AdMob hesabın uyarı alabilir.

---

## 5) Gelir modeli özeti

| Plan | Fiyat | Reklam | Özellikler |
|---|---|---|---|
| Ücretsiz | 0 TL | Google (AdMob) banner reklamı var | Günlük hava + en fazla 3 kıyafet önerisi |
| Premium | 250 TL / yıl | Reklamsız | 7 günlük tahmin + tüm öneriler + nem/UV detayları |

Reklam geliri **gösterim/tıklama başına** AdMob'dan gelir; abonelik geliri
**yıllık yenilemede** Google Play'den gelir (Google, %15-30 arası komisyon
alır, bkz. [Play Console fiyatlandırma politikası](https://support.google.com/googleplay/android-developer/answer/112622)).

---

## 6) Proje yapısı

```
App.js                          → Giriş noktası, ekran geçişleri
src/api/weather.js               → Open-Meteo API çağrıları
src/logic/clothingAdvice.js      → Hava durumuna göre kıyafet önerisi mantığı
src/context/PremiumContext.js    → Gerçek IAP (abonelik) mantığı
src/screens/HomeScreen.js        → Ana ekran (hava durumu + öneri + reklam)
src/screens/PremiumScreen.js     → Gerçek satın alma ekranı
src/components/WeatherCard.js    → Hava durumu kartı
src/components/ClothingCard.js   → Kıyafet önerisi kartı
src/components/AdBanner.js       → AdMob banner reklamı (sadece ücretsiz planda)
```

## 7) İkon ve splash ekranı

`assets/icon.png` ve `assets/adaptive-icon.png` artık projede mevcut (gönderdiğin
ikon eklendi). Not: Android'in "adaptive icon" sistemi, `adaptive-icon.png`
üzerine kendi maskesini (yuvarlatma/kesme) uygular. Gönderdiğin görsel zaten
kendi köşe yuvarlatmasını içerdiği için Android'de hafif bir "çifte
yuvarlatma" görünümü oluşabilir — sorun çıkarmaz, sadece kozmetik. İstersen
sana maskesiz, düz kare bir "foreground" versiyonu da hazırlayabilirim.

## 8) Bilinen sürüm uyumluluk notu (ÖNEMLİ)

`react-native-google-mobile-ads` paketi bilerek **13.6.0** sürümüne
sabitlendi (package.json'da `^` işareti YOK). 14.x ve üzeri sürümler React
Native'in "Yeni Mimari"sini (0.76+) gerektiriyor; bizim projemiz Expo SDK 51
(React Native 0.74.5, eski mimari) kullandığı için 14.x sürümleriyle
`compileReleaseKotlin` derleme hatası (`Too many arguments for public
constructor ViewGroupManager`) alırsın. Expo SDK'yı ileride 52+'ya
yükseltirsen bu paketi de güncelleyebilirsin — ama şimdilik 13.6.0'da kal.
