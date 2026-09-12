# PROJECT_STATE — Hava & Kıyafet

**Son güncelleme:** 25 Ağustos 2026

> ## ⚠️ ÖNCE OKU — iki ayrı sürüm var
>
> **v1.0 (yayınlanacak olan):** kapalı testte, versionCode 22/23. Sadece hava
> durumu + kıyafet önerisi. **Önce bu yayınlanacak.**
>
> **v1.1 (kodda hazır, YAYINLANMAYACAK):** gardırop, Gemini entegrasyonu,
> kredi sistemi, avatar. Kaynak ağacında duruyor ama `src/config.js` içindeki
> `SUNUCU_URL` **boş** olduğu için uygulama bu özellikleri hiç göstermiyor.
> v1.0 yayınlanana kadar böyle kalmalı — dolduran an itibarıyla uygulama
> fotoğraf toplayan bir uygulamaya dönüşür ve Play beyanları değişir.
>
> Ayrıntılar için bölüm 10'a bak.

**Amaç:** Google Play'de yayınlamak. Gelir modeli: ücretsiz plan reklamlı,
Premium 250 TL/yıl reklamsız.

Bu dosya, Windows'ta yapılan çalışmanın Mac'te kesintisiz devam edebilmesi
için yazıldı. **Mac'e geçerken dikkat edilmesi gerekenler için "Mac'e Geçiş"
bölümünü mutlaka oku — orada kaybolması kolay iki kritik madde var.**

---

## 1. Şu anki durum — tek bakışta

| Konu | Durum |
|---|---|
| Kod | Çalışıyor, temiz paketleniyor (768 modül) |
| Son sürüm | **versionCode 23** (kodda; DERLENMEDİ — bkz. aşağı) |
| v1.1 özellikleri | Kodda hazır ama `SUNUCU_URL` boş olduğu için KAPALI |
| Derlenmiş paket | v22 (`hava-kiyafet-v22-play.aab`), gündüz teması düzeltmesi İÇERMEZ |
| Play Console kurulumu | **1/11 tamamlandı** — asıl darboğaz |
| Kapalı test | Kilitli (kurulum bitmeden açılmıyor) |
| Kayıtlı test kullanıcısı | **0** (12 gerekiyor) |
| Mağaza görselleri | Hazır (`store-assets/`) |
| Gizlilik politikası URL'i | **Yok — barındırılması gerekiyor** |
| Abonelik ürünü | Play Console'da doğrulanmadı |
| Reklam | Entegrasyon çalışıyor, gerçek cihazda henüz görünmedi |

**Kritik yol:** Play Console'daki 11 maddelik kurulum → kapalı test kanalı →
12 testçi kaydı → **14 gün** → üretime başvuru → Google incelemesi.
14 günlük sayaç, testçiler uygulamayı **kurduğunda** başlıyor, sürüm
yayınlandığında değil.

### Yüklenmeye hazır paket

```
hava-kiyafet-v22-play.aab        (proje klasörünün bir üstünde)
45.76 MB · versionCode 22 · targetSdk 36
SHA1: 17:C8:3F:17:24:B2:51:A8:18:53:D4:7C:DB:2E:E8:7A:D5:C2:49:34  ✓ Mac'te yeniden doğrulandı
```

Play'de daha önce kabul edilen versionCode 16 vardı; v20/v21 ara
sürümlerdi, v22 gece metni düzeltmesini de içeriyor.

**Ama v22 artık koddan geride.** 10 Ağustos 2026'da yapılan düzeltmeler
(gündüz teması kontrastı, kapalı hava metni, abonelik otomatik yenileme
ibaresi, uygulama adındaki Türkçe karakter) yalnızca kaynakta;
`versionCode` 23'e çıkarıldı ve **v23 henüz derlenmedi.**

### Derleme araçları — 25 Ağustos 2026 itibarıyla

```
node 26.7.0  ✓      npm 11.19.0 ✓
JDK  21.0.12 ✓      (Temurin, JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home)
cmdline-tools ✓     (sdkmanager PATH'te)
Android SDK paketleri ✗  — ANDROID_HOME boş, ~/Library/Android/sdk yok
```

Kalan tek adım:
```bash
export ANDROID_HOME="$HOME/Library/Android/sdk" && sdkmanager --sdk_root="$ANDROID_HOME" --licenses
```
```bash
sdkmanager --sdk_root="$HOME/Library/Android/sdk" "platform-tools" "platforms;android-36" "build-tools;36.0.0" "ndk;27.1.12297006"
```
Ardından bölüm 6'daki derleme komutları.

**Not:** `node_modules` disk imajından kopyalanırken iki paket bozulmuştu
(`hermes-parser` ve `expo-modules-core` eksik dosyalarla inmişti, Metro
paketlemesi çöküyordu). `npm ci` ile temizlendi. Benzer bir hata görürsen
önce `rm -rf node_modules && npm ci` dene.

EAS kotası 1 Eylül 2026'da yenileniyor; o tarihten sonra araç kurmadan
`eas build` ile de derlenebilir.

---

## 0. BİLGİSAYARI KAPATMADAN ÖNCE — Mac'e taşınacaklar

Proje klasörünü kopyalaman yetmez. Şunlar ayrıca gerekiyor:

| Ne | Neden | Nerede |
|---|---|---|
| **`credentials/` klasörü** | `.gitignore`'da, git ile GİTMEZ. Onsuz `.aab` doğru anahtarla imzalanamaz ve Play reddeder | `weather-clothing-app/credentials/` |
| `hava-kiyafet-v22-play.aab` | Yüklemeye hazır paket; Mac'te yeniden derlemek istemezsen | `hava-kiyafet-app/` |
| `store-assets/` | Mağaza görselleri (Mac'te yeniden üretilemez, bkz. bölüm 5) | `weather-clothing-app/store-assets/` |

**`node_modules/` ve `android/` klasörlerini taşıma** — Mac'te
`npm install` + `npx expo prebuild` ile yeniden üretilecekler, taşımak
sorun çıkarır.

İmzalama anahtarını ayrıca güvenli bir yere yedekle (parola yöneticisi veya
şifreli disk). Aynısı EAS'ta da duruyor ama tek kopyaya güvenme.

---

## 2. Teknoloji yığını ve NEDEN bu sürümler

```
Expo SDK      54.0.36
React Native  0.81.5
React         19.1.0
targetSdk     36   (compileSdk 36, minSdk 24, buildTools 36.0.0)
Kotlin        2.2.20
NDK           27.1.12297006 (16 KB sayfa hizalaması buradan geliyor)
```

### ⚠️ Sürümleri yükseltme — üçü de bilinçli olarak sabitlendi

`package.json`'da caret (`^`) YOK. Kaldırma sebebi: caret'li haldeyken
`npm install` paketleri build'i çökerten sürümlere yükseltiyordu.

| Paket | Sabit | Yükseltirsen ne olur |
|---|---|---|
| `react-native-google-mobile-ads` | **16.0.0** | 16.1+ → `play-services-ads 25.x` çeker; o kütüphane Kotlin 2.3 ile derlenmiş, SDK 54'ün Kotlin 2.2'si okuyamaz → `:react-native-google-mobile-ads:compileReleaseKotlin` FAILED |
| `expo-iap` | **5.0.0** | 5.2.0 → `openiap-google 3.2.0` çeker; o da `kotlin-stdlib 2.4.10` getirir → `:expo:compileReleaseKotlin` FAILED |
| Expo SDK | **54** | SDK 54'ün Kotlin tavanı **2.2.20**. Ekosistem Kotlin 2.4'e geçtiği için SDK 54 giderek daha çok pakete uyumsuz kalıyor. Kalıcı çözüm SDK 56/57'ye çıkmak (aşağıya bak) |

Maven'dan doğrulanan eşleşme:
```
openiap-google 3.0.0 -> kotlin-stdlib 2.2.0   ✓ uyumlu
openiap-google 3.2.0 -> kotlin-stdlib 2.4.10  ✗ uyumsuz
```

### ⚠️ Yeni Mimari KAPALI — ve bu Windows'a özgü bir taviz

`app.json` içinde `"newArchEnabled": false`.

**Tek sebebi Windows'un 260 karakterlik dosya yolu sınırı.** Yeni Mimari'nin
C++ kod üretimi, nesne dosyası yoluna kaynak yolunu da gömüyor ve toplam
~380 karaktere çıkıyordu:

```
ninja: error: Filename longer than 260 characters
```

**macOS'ta bu sınır yok.** Mac'te ilk iş olarak `newArchEnabled: true` yapıp
denemek mantıklı — çalışırsa SDK 55+ yolu da açılmış olur (SDK 55 Legacy
mimariyi desteklemiyor).

---

## 3. Kimlikler ve sırlar

```
Paket adı        : com.ismail.havakiyafet
EAS project      : 4595a818-bcbc-4d1b-8e27-9bca8b8f482b
AdMob App ID     : ca-app-pub-2234260593125912~7064265042
AdMob Banner ID  : ca-app-pub-2234260593125912/5609768481
Abonelik ID      : premium_yillik   (koddaki değerle birebir aynı olmalı)
```

### İmzalama anahtarı — KAYBEDİLİRSE UYGULAMA GÜNCELLENEMEZ

```
credentials/
├── upload-key.jks
└── keystore.properties   (storePassword, keyAlias, keyPassword)
```

- Bu klasör `.gitignore`'da → **git ile Mac'e geçmez, elle taşınman gerekir**
- Aynı anahtar EAS'ta da duruyor: `Build Credentials GJTo16MNVi`
- Play bu anahtarı kaydetti (versionCode 16 kabul edildi), yani **başka
  anahtarla imzalanan paket reddedilir**

Her `.aab`'yi yüklemeden önce imzayı doğrula:

```bash
keytool -printcert -jarfile app-release.aab
```

Beklenen SHA1:
```
17:C8:3F:17:24:B2:51:A8:18:53:D4:7C:DB:2E:E8:7A:D5:C2:49:34
```

---

## 4. Bu oturumda çözülen gerçek hatalar

Hepsi kapalıdır; tekrar ortaya çıkarsa sebebini burada bul.

| # | Hata | Kök neden | Çözüm |
|---|---|---|---|
| 1 | Build 13-14-15 `ERRORED` | `app.json`, `react-native-google-mobile-ads`'i Expo plugin olarak kaydediyordu ama 13.6.0'da plugin YOK | Paket 16.0.0'a çıkarıldı (plugin içeriyor), `app.json` düzeltildi |
| 2 | Play sürümü reddedilir | `targetSdk 34`; Play API 36 istiyor + 16 KB sayfa şartı | Expo SDK 51 → 54 göçü, `expo-build-properties` ile 36 sabitlendi |
| 3 | Abonelik satılamıyor | Android'de `offerToken` zorunlu, gönderilmiyordu | `expo-iap` ile `subscriptionOffers: [{ sku, offerToken }]` |
| 4 | Fiyat hep sabit "₺250,00" | Android'de fiyat `localizedPrice`'ta değil | `subscriptionOffers[0].displayPrice` |
| 5 | Expo Go'da "App entry not found" | Native modüller dosya başında `import` ediliyordu, modül yüklenirken tüm uygulamayı düşürüyordu | Korumalı `require` (try/catch) |
| 6 | "Billing is unavailable" sarı uyarısı | `purchaseUpdatedListener` bağlantı kurulmadan çağrılıyordu | Dinleyiciler `initConnection()` başarılı olduktan SONRA kuruluyor |
| 7 | "Hava durumu alınıyor..." sonsuza kadar takılı | `getCurrentPositionAsync`'in zaman aşımı YOK, GPS'siz cihazda promise hiç çözülmüyor | `getLastKnownPositionAsync` + 15 sn zaman aşımı |
| 8 | Şehir seçimi kayboluyor | `App.js` Premium'a geçerken `HomeScreen`'i söküyordu | State `WeatherProvider`'a taşındı (ekranların üstünde) |
| 9 | Geri tuşu uygulamayı kapatıyor | Android donanım geri tuşu dinlenmiyordu | `BackHandler` — Premium'dayken ana ekrana döner |
| 10 | Gece "Güneşli bir gün" yazıyordu | Kıyafet mantığı gündüz/gece ayrımı yapmıyordu | `is_day` bilgisi metne bağlandı |
| 11 | Kotlin çakışması (2 kez) | Bkz. bölüm 2 | Paket sürümleri sabitlendi |
| 12 | Windows yol sınırı | Bkz. bölüm 2 | Yeni Mimari kapatıldı |

### 25 Ağustos 2026 turunda bulunanlar

| # | Hata | Kök neden | Çözüm |
|---|---|---|---|
| 13 | Saatlik şeritte "Şimdi" bir sonraki saati gösteriyordu | `current.time` dakika içeriyor ("14:30"), saatlik seri tam saatte; `t >= now` içinde bulunulan saati atlıyordu | Karşılaştırmadan önce saate yuvarlama |
| 14 | Sakin günde sürekli "Rüzgarlık" uyarısı | Karar `gusts ?? wind` ile veriliyordu; ani rüzgar sıradan günde 40 km/s'i aşıyor | Karar sürekli rüzgara bağlandı, ani rüzgar ayrı uyarı |
| 15 | "Bugün 21°/24°" derken ölçüm 26° | Günlük min/max TAHMİN, current ÖLÇÜM — çelişebiliyor | Bugünün aralığı ölçümü kapsayacak şekilde genişletiliyor |
| 16 | Premium sunucuda hiç çalışmıyordu | Satın alma jetonu hiçbir yere kaydedilmiyordu; sunucu Play'e soramıyordu | `purchaseToken` kaydediliyor, `getActiveSubscriptions` ile yeniden ele geçiriliyor |
| 17 | Premium kullanıcı çevrimdışıyken reklam görüyordu | Durum yalnızca Play'e sorularak biliniyordu | AsyncStorage önbelleği (yalnızca arayüz için; yetki hâlâ Play'de) |
| 18 | AEA'da rızasız kişiselleştirilmiş reklam | `requestNonPersonalizedAdsOnly: false` sabitti | UMP rıza akışı (`AdsConsent.gatherConsent`), rıza bilinene kadar NPA |
| 19 | **Haptik yayın derlemesinde ölüydü** | `expo-haptics` VIBRATE istiyor ama `app.json` onu `blockedPermissions`'ta engelliyordu | VIBRATE engelden çıkarılıp izinlere alındı |
| 20 | `hermes-parser` / `expo-modules-core` bozuk | Disk imajından kopyalarken eksik dosyalarla inmişler, Metro çöküyordu | `rm -rf node_modules && npm ci` |
| 21 | Gemini şemayı reddediyordu | `z.toJSONSchema` `$schema` ve `additionalProperties` üretiyor, Gemini tanımıyor | Şema temizleyici (`gemineUygunSema`) |
| 22 | `.env` anahtarı görünmüyordu | ESM'de import'lar hoist edilir; `loadEnvFile` `gemini.ts` değerlendirildikten sonra çalışıyordu | Ayrı `env.ts` ilk import + tembel istemci kurulumu |
| 23 | Kredi metinleri "bu ay" diyordu | Ücretsiz plan aylıktan günlüğe döndü, metinler sabit yazılmıştı | Metinler sunucudan gelen `kombinBirim`'e bağlandı |

### 25 Ağustos 2026 — son tur

| # | Hata / ekleme | Ayrıntı |
|---|---|---|
| 24 | **Paywall erişilemeyen özellik satıyordu** | Karşılaştırma tablosu v1.0'da tamamen gizli olan yapay zeka satırlarını gösteriyordu. Tablo artık `yapayZekaAcik`'a göre kuruluyor; ana ekrandaki Premium şeridi ve paywall başlığı da öyle |
| 25 | **Yağış/soğuma uyarısı "Premium" diye satılıyordu ama koda hiç kontrol konmamıştı** | Ücretsiz kullanıcı da alıyordu — yani zaten sahip olduğu şeye para ödeyecekti. Uyarılar gerçekten Premium'a bağlandı; Ayarlar'da rozet çıkıyor. Sabah özeti herkeste açık kaldı |
| 26 | Tanıtım göstergesi içerikle çelişebiliyordu | Sayfa numarası ayrı state'ten besleniyordu; kaydırma başarısız olursa gösterge "3. sayfa" derken içerik 1. sayfada kalıyordu. Artık YALNIZCA gerçek kaydırma konumundan türetiliyor |
| 27 | `Dimensions.get("window")` modül yüklenirken okunuyordu | Pencere yeniden boyutlanınca sayfa genişliği bayat kalıyordu. `onLayout` ile kaptan ölçülüyor |
| 28 | **`planlar` tanımlanmadan kullanılıyordu (TDZ)** | `purchasePremium`, `planlar`'a ondan önce erişiyordu — uygulama açılışta çöküyordu. Paketleme ve sözdizimi kontrolü yakalayamadı; ancak ÇALIŞTIRINCA çıktı. Bildirim: hata sınırı bunu yakaladı |

**Yeni dosyalar:** `src/screens/OnboardingScreen.js`, `src/ui/ErrorBoundary.js`

**Tanıtım akışı:** ilk açılışta 3 sayfa (yapay zeka açıkken 4). Bildirim izni
bağlamı anlatıldıktan SONRA isteniyor — sistem penceresini boşlukta açmak en
yüksek ret oranını üretiyor. Son sayfada premium tanıtımı var ama "Atla" her
sayfada ve "Ücretsiz başla" her zaman görünür: kapatılamayan tanıtım hem
kullanıcı kaybettirir hem Play'in yanıltıcı abonelik akışı maddesine girer.
Durum `AsyncStorage`'da `tanitimGorunduMu.v1` anahtarında.

**Hata sınırı:** `App.js`'in en dışında. Öncesinde herhangi bir render hatası
tüm uygulamayı beyaz ekrana düşürüyordu. Bu turda kendi soktuğum TDZ hatasını
da bu yakaladı.

---

## 5. Mağaza görselleri — HAZIR

```
store-assets/
├── play-icon-512.png              512×512      ✓
├── play-feature-1024x500.png      1024×500     ✓
├── screenshots-telefon/           4 adet       ✓
├── screenshots-tablet7/           4 adet       ✓
└── screenshots-tablet10/          4 adet       ✓
```

Hepsi Play kurallarına karşı doğrulandı (oran 0.5625-1.7778 arası, kenarlar
sınırlar içinde). Ekran görüntüleri Ankara / gece teması, reklam kadrajda
değil, Premium ekranındaki emülatöre özgü uyarı kırpıldı.

### ⚠️ Üretim script'leri Windows'a bağımlı

`tools/play-gorseller.ps1` ve `tools/ekran-goruntusu-al.ps1`, .NET'in
`System.Drawing` kütüphanesini kullanıyor. **Bu kütüphane yalnızca
Windows'ta çalışır** — Mac'te `pwsh` kurulu olsa bile bu script'ler
çalışmaz.

Mac'te görselleri yeniden üretmen gerekirse: mevcut çıktılar zaten hazır,
dokunmana gerek yok. Yine de gerekirse `sips` (macOS'ta yerleşik) veya
ImageMagick ile aynı işi yapabilirsin. Kurallar:
- Telefon/7 inç: her kenar 320-3840, oran 16:9 ile 9:16 arası
- 10 inç: her kenar 1080-7680
- Modern telefonlar 20:9 (~0.46) çekiyor → **Play bunu reddeder**, kenarlara
  bant ekleyip 0.5625'e getirmek gerekiyor (kırpma değil, bant)

Mağaza metinleri: `legal/magaza-metinleri.txt` (tam açıklama dahil)

---

## 6. Derleme

### Yerel derleme (şu an kullanılan yol)

EAS ücretsiz kotası **doldu, 1 Eylül 2026'da yenileniyor**. O yüzden yerel
derleme kuruldu.

```bash
npx expo prebuild --platform android --clean
cd android && ./gradlew bundleRelease --no-daemon
```

Çıktı: `android/app/build/outputs/bundle/release/app-release.aab`

İmzalama otomatik: `plugins/withReleaseSigning.js` config plugin'i her
prebuild sonrası `credentials/` klasöründeki anahtarı bağlar. Klasör yoksa
debug anahtarıyla imzalar (**Play reddeder**), o yüzden klasörün varlığını
kontrol et.

**Mac'te JDK:** Gradle 8.14 en fazla **JDK 24** destekler. Windows'ta JDK 21
kullanıldı. Mac'te:
```bash
brew install --cask temurin@21
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
```
(Windows'taki JDK geçici klasördeydi, taşınmıyor.)

### EAS ile derleme (1 Eylül sonrası)

```bash
eas build --profile production --platform android
```
Anahtar EAS'ta kayıtlı, imza aynı çıkar. EAS Linux'ta derlediği için
**Windows yol sınırı yok** → Yeni Mimari'yi açabilirsin.

---

## 7. YARIN YAPILACAKLAR — öncelik sırasıyla

### A) Mac'e geçiş (önce bunlar)

1. `credentials/` klasörünü **elle** kopyala (git'te yok, `.aab` bunsuz
   imzalanamaz)
2. `npm install` — package.json sabitlenmiş sürümleri kuracak
3. JDK 21 kur, `JAVA_HOME` ayarla
4. Doğrula: `npx expo export --platform android` temiz derleniyor mu

### B) Play Console kurulumu — 11 madde (asıl darboğaz)

Kapalı test bu bitmeden AÇILMIYOR.

1. **Gizlilik politikası** ← tek gerçek blokaj. `legal/privacy-policy.html`
   dosyasını GitHub Pages'e koy, URL'i gir
2. Oturum açma bilgileri → "Tüm işlevler özel erişim olmadan kullanılabilir"
3. Reklam → **Evet**, reklam içeriyor
4. İçerik derecelendirme → hepsine Hayır, sonuç 3+
5. Hedef kitle → **13+**, çocuk kategorisini SEÇME
6. Veri güvenliği → cevaplar `legal/play-store-listing.txt` içinde
7. Resmi kurum uygulamaları → Hayır
8. Finans ile ilgili özellikler → **Hayır** (abonelik finansal hizmet değil)
9. Sağlık → Hayır
10. Kategori **Hava Durumu** + iletişim e-postası
11. Mağaza girişi → tam açıklamayı `legal/magaza-metinleri.txt`'ten güncelle
    (şu an 190 karakter, olması gereken ~1500)

### C) Kapalı test — 14 günlük sayaç

1. **12 test kullanıcısının Gmail adresini topla** — şu an 0 kayıtlı, bu
   takvimin gerçek darboğazı, bugün başlat
2. Kapalı test kanalı: ülke/bölge → Türkiye
3. Sürüm oluştur, **versionCode 22**'yi yükle
4. Testçilere davet gönder; **kabul edip kurmaları** şart
5. 14 gün boyunca kaldırmamalarını sağla

### D) Abonelik ve reklam doğrulaması

- Play Console → Monetization → Subscriptions → `premium_yillik` → base
  plan **Activate** edilmiş mi? Değilse uygulama "Abonelik teklifi
  bulunamadı" der (bu mesaj kodun doğru çalıştığının işareti)
- Setup → **License testing** → kendi Gmail'ini ekle (ücretsiz test satın
  alma)
- Gerçek cihazda Premium ekranını aç → **Google Play ödeme penceresi
  açılıyor mu?** `offerToken` düzeltmesinin asıl sınavı bu
- AdMob panelinde kırmızı kısıtlama uyarısı (ödeme/vergi/kimlik) var mı bak

### E) Opsiyonel ama değerli (Mac'te kolay)

- `newArchEnabled: true` dene — Windows sınırı Mac'te yok
- Başarılıysa Expo SDK 56/57'ye çıkmayı planla (SDK 54 Kotlin tavanı 2.2.20
  ve ekosistem 2.4'e geçti)
- Yükseltirsen `react-native-google-mobile-ads` ve `expo-iap`'in son
  sürümleri de kullanılabilir hale gelir

---

## 8. Doğrulanmış vs doğrulanmamış

**Gözlemleyerek doğrulandı:**
- Konum tespiti (gerçek telefonda "Yenimahalle, Ankara")
- Dinamik gece/gündüz teması, saatlik ve 7 günlük tahmin
- Kıyafet önerileri, emoji kombin şeridi
- Play'in paketi kabul etmesi (targetSdk 36 onaylandı)
- **Reklam entegrasyonu** — emülatörde banner yüklendi ("Test Ad" etiketiyle;
  AdMob emülatörleri otomatik test cihazı sayar)
- İmza doğrulaması (SHA1/SHA256 eşleşiyor)

**Henüz doğrulanmadı:**
- Gerçek cihazda gerçek reklam gösterimi (yeni reklam birimi ısınmamış olabilir)
- Satın alma akışının uçtan uca çalışması (Play Console'da abonelik aktif değil)

---

## 9. Dosya haritası

```
App.js                          Giriş, ekran geçişi, Android geri tuşu
src/context/WeatherContext.js   Hava durumu state'i (ekranların üstünde)
src/context/PremiumContext.js   expo-iap, abonelik, offerToken
src/screens/HomeScreen.js       Ana ekran
src/screens/PremiumScreen.js    Satın alma ekranı
src/components/                 WeatherCard, ClothingCard, HourlyStrip,
                                DailyForecast, AdBanner, GradientBackground
src/logic/clothingAdvice.js     Kıyafet önerisi mantığı (gündüz/gece dahil)
src/api/weather.js              Open-Meteo çağrıları + yardımcılar
src/theme/weatherTheme.js       Havaya/saate göre renk paleti
plugins/withReleaseSigning.js   Release imzalamayı prebuild sonrası bağlar
tools/*.ps1                     Görsel üretimi (SADECE WINDOWS)
legal/                          Gizlilik politikası, mağaza metinleri,
                                yayın adımları
credentials/                    İmzalama anahtarı (git'te YOK)
store-assets/                   Play görselleri (hazır)
```

---

## 10. v1.1 — Gardırop + Gemini (kodda hazır, kapalı)

25 Ağustos 2026'da eklendi. **Yayınlanmadan önce v1.0'ın Play'de canlı
olması gerekiyor.**

### Açma anahtarı

`src/config.js` → `SUNUCU_URL`. Boş olduğu sürece:
- Ana ekranda gardırop kartı **görünmez**
- Gardırop ve kombin ekranlarına ulaşılamaz
- Kamera izni hiç istenmez

Bu kasıtlı: yayına çalışmayan bir buton çıkmasın.

### Mimari

```
Uygulama                          Sunucu (../server)          Gemini 2.5 Flash
────────                          ──────────────────          ────────────────
fotoğraf çek ──────────────────►  /v1/etiketle  ────────────►  vision + yapısal çıktı
  (parça başına BİR KEZ)          kredi düş                    {tür, katman, minC/maxC...}
                                                              
"kombin öner" ─────────────────►  /v1/kombin    ────────────►  yalnızca METİN metadata
  (fotoğraf GİTMEZ)               kredi düş                    seçilen id'ler + gerekçe
```

Fotoğraflar cihazda `belgeler/gardirop/` altında; indeks AsyncStorage'da.
Kayıtta mutlak URI değil **dosya adı** tutuluyor — belge klasörünün yolu
uygulama güncellemeleri arasında değişebiliyor, mutlak URI saklarsak
güncellemeden sonra bütün fotoğraflar kaybolmuş görünür.

### Kredi sistemi

Sayaç **sunucuda** (SQLite). İstemcide olsaydı kurcalanabilirdi.

```
ücretsiz : günde  1 kombin, ayda  20 etiketleme
premium  : günde 20 kombin, ayda 500 etiketleme
```

Premium bilinçli olarak "sınırsız" değil — ölçümlü API'de tek kötü niyetli
hesap ciddi fatura çıkarabilir. Mağaza metninde "adil kullanım" de.

Başarısız model çağrısı krediyi yakmıyor (iade ediliyor; iade pencere
kontrolü yapıyor).

### Premium doğrulaması — zincirin tamamı

Bu zincirde bir halka kopuk olursa premium sunucuda **hiç** çalışmaz:

1. `PremiumContext` satın alma sonrası `purchase.purchaseToken`'ı alır
2. `playJetonuKaydet()` ile AsyncStorage'a yazar
3. `stylist.js` her istekte `x-play-jeton` başlığında gönderir
4. `server/src/play.ts` jetonu Google Play'e sorar
5. `GOOGLE_SERVICE_ACCOUNT_JSON` yoksa **herkes ücretsiz sayılır**

### Yapılacaklar (v1.0 yayınlandıktan sonra)

1. Sunucuyu bir yere dağıt, HTTPS arkasına al
2. `server/.env` içine `GEMINI_API_KEY` ve `GOOGLE_SERVICE_ACCOUNT_JSON` yaz
3. Gemini ücretsiz katman kotasını (günde ~1500 istek) izle
4. `SUNUCU_URL`'i doldur
5. Gizlilik politikasını yeniden yayınla (fotoğraf bölümü eklendi)
6. Veri güvenliği formuna **Fotoğraflar** kategorisini ekle
   (`legal/play-store-listing.txt` içinde hazır)
7. CAMERA izni gerekçesini Play'e gir
8. `versionCode`'u artır, derle, yükle

### ⚠️ Gemini ücretsiz katmanı ve veri gizliliği

Google, ücretsiz katmanda gönderilen içeriği kendi hizmetlerini geliştirmek
için kullanabiliyor. Kullanıcıların kıyafet fotoğrafları söz konusu olduğu
için bu gizlilik politikasında AÇIKÇA yazılı. Play'in Veri güvenliği formu
ile politika tutarlı olmak zorunda — birinde söyleyip diğerinde saklamak ret
sebebi. Kurtulmanın tek yolu ücretli katman.

### Uçtan uca test EDİLMEDİ

Gemini çağrıları gerçek bir API anahtarıyla hiç çalıştırılmadı — anahtar
kullanıcıda. `.env` zinciri sahte anahtarla doğrulandı (Google "API key not
valid" dedi, yani istek doğru biçimlendi). Şema dönüşümü, kredi muhasebesi,
iade mantığı, HTTP katmanı ve doğrulama testleri geçti.
