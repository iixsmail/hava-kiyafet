# Play Store Yayın Adımları — sırayla takip et

Hesabın açık ve 25$ ödendi. Buradan sonrası bu sırayla.

---

## ADIM 0 — Bugün mutlaka başlat (14 günlük sayaç yüzünden)

Yeni geliştirici hesaplarında Google, production'a geçmeden önce
**en az 12 test kullanıcısıyla kesintisiz 14 gün kapalı test (closed testing)**
şartı koşuyor. Bu süre atlanamaz, kısaltılamaz. Yani en kritik iş,
kapalı testi **bir an önce başlatmak** — sayaç ne kadar erken başlarsa
gelir de o kadar erken başlar.

12 test kullanıcısını şimdiden ayarla (arkadaş/aile Gmail adresleri).
Hepsinin testi *kabul etmiş* ve uygulamayı *kurmuş* olması gerekiyor.

---

## ADIM 1 — AdMob reklam kimlikleri  [TAMAMLANDI ✓]

Her ikisi de kodda tanımlı:

- **App ID** (`app.json`): `ca-app-pub-2234260593125912~7064265042`
- **Banner ad unit ID** (`src/components/AdBanner.js`):
  `ca-app-pub-2234260593125912/5609768481`

Yayınlanan sürüm **gerçek reklam** gösterir ve gelir üretir.
Geliştirme sırasında (`__DEV__`) otomatik olarak test reklamı gösterilir.

⚠️ **Kendi uygulamandaki gerçek reklamlara ASLA tıklama.** AdMob bunu
"geçersiz trafik" sayar ve hesabını kalıcı olarak kapatabilir. Yerelde
`npx expo start` ile test ederken test reklamı çıkar, orada tıklamak serbest.

---

## ADIM 2 — Play Console'da abonelik ürününü oluştur

Play Console > Monetization > Subscriptions > Create subscription

- **Product ID:** `premium_yillik`  ← kodla birebir aynı olmalı, sonradan değişmez
- **Ad:** Premium Yıllık
- Sonra bir **base plan** oluştur:
  - Billing period: **1 yıl (Yearly)**
  - Auto-renewing: açık
  - Fiyat: **250,00 TRY** (Türkiye)
- Base plan'i **Activate** etmeyi unutma (aktif değilse uygulamada görünmez)

---

## ADIM 3 — Gizlilik politikasını yayınla

`legal/privacy-policy.html` dosyası hazır. Ücretsiz barındırma için
en hızlı yol GitHub Pages — detaylı adımlar `play-store-listing.txt`
dosyasının içinde.

Çıkan URL'i Play Console > App content > Privacy policy alanına yapıştır.

---

## ADIM 4 — Mağaza listesi + zorunlu formlar

`legal/play-store-listing.txt` içinde hazır metinler var:
- Uygulama adı, kısa açıklama, tam açıklama → kopyala-yapıştır
- Data safety formu cevapları
- İçerik derecelendirmesi anketi cevapları
- Hedef kitle

### Görseller — `tools/play-gorseller.ps1` ile üretiliyor

```bash
pwsh -File tools/play-gorseller.ps1
```

Çıktılar `store-assets/` klasörüne düşer:
- **play-icon-512.png** — uygulama simgesi (hazır)
- **play-feature-1024x500.png** — özellik grafiği (hazır)
- **screenshots/** — telefon ekran görüntüleri

**Ekran görüntüleri için:** telefondan aldığın PNG'leri
`tools/ham-ekran-goruntuleri/` klasörüne atıp script'i tekrar çalıştır.

⚠️ Neden script'ten geçirmek gerekiyor: Play, telefon ekran görüntülerinde
en boy oranının **16:9 ile 9:16 arasında** olmasını istiyor. Modern
telefonlar 20:9 (~0.46) çekiyor ve bu oran **reddediliyor**. Script,
görüntüyü kırpmadan kenarlara uygulamanın zemin renginde bant ekleyip
orana getiriyor — içerik kaybolmuyor.

---

## ADIM 5 — Üretim paketini derle

### A) Yerelde (EAS kotası dolduğunda — şu an kullandığımız yol)

```bash
npx expo prebuild --platform android --clean
```

Sonra Gradle (JAVA_HOME uyumlu bir JDK'yı göstermeli — Gradle 8.14 en
fazla **JDK 24** destekler, JDK 25 ÇALIŞMAZ):

```bash
cd android && ./gradlew bundleRelease --no-daemon
```

Çıktı: `android/app/build/outputs/bundle/release/app-release.aab`

İmzalama otomatik: `plugins/withReleaseSigning.js` config plugin'i her
prebuild sonrası `credentials/` klasöründeki anahtarı bağlar. O klasör
yoksa debug anahtarıyla imzalar (Play kabul etmez), bu yüzden
`credentials/upload-key.jks` ve `keystore.properties` mutlaka dursun.

**İmzayı her zaman doğrula** (yanlış anahtar Play'de reddedilir):

```bash
keytool -printcert -jarfile app-release.aab
```

SHA1 şu olmalı: `17:C8:3F:17:24:B2:51:A8:18:53:D4:7C:DB:2E:E8:7A:D5:C2:49:34`

### B) EAS ile (kota yenilendiğinde — 1 Eylül)

```bash
eas build --profile production --platform android
```

Anahtar EAS'ta da kayıtlı (`Build Credentials GJTo16MNVi`), imza aynı
çıkar. ⚠️ Bu anahtarı silme — kaybolursa uygulamayı bir daha
güncelleyemezsin.

### ÖNEMLİ: Yeni Mimari şu an KAPALI

`app.json` içinde `"newArchEnabled": false`. Sebep teknik bir zorunluluk:
Windows'un 260 karakterlik dosya yolu sınırı yüzünden Yeni Mimari'nin C++
kod üretimi yerelde derlenemiyordu
(`ninja: Filename longer than 260 characters`).

Uygulama işlevsel olarak etkilenmiyor, Play de bu ayarla ilgilenmiyor.
Ama React Native Legacy mimariyi kaldırıyor ve **Expo SDK 55+ desteklemiyor**.
İleride şu üçünden biri gerekecek:
1. Projeyi kısa bir yola taşı (örn. `C:\hk`) — tek başına yetmeyebilir
2. Windows uzun yol desteğini aç (registry, yönetici izni gerekir)
3. EAS bulut derlemesini kullan (Linux'ta bu sınır yok) — en kolayı

### Teknik durum (Ağustos 2026 itibarıyla)

Proje **Expo SDK 54 / React Native 0.81** üzerine taşındı. Sebebi:
Google Play, yeni uygulamalardan **API 36 (Android 16)** hedeflemesini ve
**16 KB sayfa boyutu** desteğini şart koşuyor. Eski SDK 51 (API 34) ile
sürüm **reddediliyordu** — 13, 14 ve 15 numaralı build'lerin hata
vermesinin sebebi buydu.

Sabitlenen sürümler (`app.json` > expo-build-properties):
`compileSdk 36`, `targetSdk 36`, `buildTools 36.0.0`, `minSdk 24`.

**Paket sürümlerine dokunma:**
- `react-native-google-mobile-ads` **16.0.0**'da sabit. 16.1+ sürümleri
  `play-services-ads 25.x` çekiyor; o kütüphane Kotlin 2.3 ile derlenmiş
  ve SDK 54'ün Kotlin 2.1'i ile **derlenmiyor**
  (`compileReleaseKotlin` hatası). 16.0.0 ise `play-services-ads 24.6.0`
  kullanıyor ve sorunsuz.
- Satın alma katmanı `react-native-iap` yerine **expo-iap**'e taşındı
  (eski paket RN 0.81 ile çalışmıyor).

---

## ADIM 6 — Kapalı teste yükle ve 14 günü başlat

1. Play Console > Testing > **Closed testing** > yeni sürüm oluştur
2. `.aab` dosyasını yükle
3. Tester listesine 12+ Gmail adresi ekle
4. Yayınla, test bağlantısını testçilere gönder, hepsinin kurmasını sağla
5. **Kendini de tester olarak ekle** — gerçek satın alma akışını ancak
   böyle test edebilirsin (Play Console > Setup > License testing'e de
   kendi hesabını ekle ki test satın alması ücretsiz olsun)

---

## ADIM 7 — 14 gün sonra production'a başvur

Kapalı test şartı tamamlanınca Play Console sana "production'a
başvurabilirsin" der. Başvurudan sonra Google incelemesi genelde
birkaç gün sürer.

---

## Yayın öncesi son kontrol

- [x] `AdBanner.js` içindeki banner ID gerçek (test değil)
- [x] targetSdkVersion 36 (Play'in API 36 şartı)
- [x] Gereksiz izinler kaldırıldı (SYSTEM_ALERT_WINDOW, depolama, VIBRATE)
- [ ] Play Console'da `premium_yillik` aboneliği **aktif** ve altında
      İKİ base plan tanımlı: aylık 99,99 TL + yıllık 359,99 TL
- [ ] Gizlilik politikası URL'i çalışıyor
- [ ] Data safety formu dolduruldu
- [ ] İçerik derecelendirmesi anketi tamamlandı
- [ ] Ekran görüntüleri + feature graphic yüklendi
- [ ] Gerçek cihazda satın alma akışı test edildi (ödeme ekranı AÇILIYOR mu)
