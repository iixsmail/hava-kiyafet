// Yerel (EAS'sız) release derlemesi için Google Play yükleme anahtarını
// bağlar.
//
// Neden config plugin: `npx expo prebuild` her çalıştığında android/
// klasörü sıfırdan üretiliyor. build.gradle'ı elle düzenlersen bir sonraki
// prebuild'de kaybolur. Bu plugin, imzalama yapılandırmasını her prebuild
// sonrası otomatik olarak yeniden ekler.
//
// Şifreler kodda DEĞİL, credentials/keystore.properties dosyasında duruyor
// ve o klasör .gitignore ile hariç tutuldu. Dosya yoksa derleme eskisi gibi
// debug anahtarıyla imzalanır (yani geliştirme akışı bozulmaz).

const { withAppBuildGradle } = require("@expo/config-plugins");

const IMZA_BLOGU = `
        release {
            def ksPropsFile = rootProject.file('../credentials/keystore.properties')
            if (ksPropsFile.exists()) {
                def ksProps = new Properties()
                ksPropsFile.withInputStream { ksProps.load(it) }
                storeFile rootProject.file('../credentials/upload-key.jks')
                storePassword ksProps['storePassword']
                keyAlias ksProps['keyAlias']
                keyPassword ksProps['keyPassword']
            }
        }`;

const YARDIMCI =
  `def ksSigningVarMi() {\n` +
  `    return rootProject.file('../credentials/keystore.properties').exists() &&\n` +
  `           rootProject.file('../credentials/upload-key.jks').exists()\n` +
  `}\n\n`;

const YENI_SATIR =
  "signingConfig ksSigningVarMi() ? signingConfigs.release : signingConfigs.debug";

// Expo şablonu sürüme göre "signingConfig = signingConfigs.debug" veya
// "signingConfig signingConfigs.debug" (eşittirsiz Groovy yazımı) üretebiliyor.
// İkisini de karşılamalıyız.
const DEBUG_ATAMA = /signingConfig\s*=?\s*signingConfigs\.debug/g;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      console.warn(
        "withReleaseSigning: build.gradle.kts tespit edildi, imzalama otomatik eklenemedi."
      );
      return config;
    }

    let icerik = config.modResults.contents;

    // Zaten uygulanmışsa tekrar dokunma
    if (icerik.includes("ksSigningVarMi() ? signingConfigs.release")) {
      return config;
    }

    // 1) signingConfigs bloğuna "release" ekle
    if (!icerik.includes("credentials/keystore.properties")) {
      const oncesi = icerik;
      icerik = icerik.replace(
        /(signingConfigs\s*\{\s*\n\s*debug\s*\{[\s\S]*?\n\s{8}\})/,
        `$1${IMZA_BLOGU}`
      );
      if (icerik === oncesi) {
        throw new Error(
          "withReleaseSigning: signingConfigs bloğu bulunamadı, imzalama eklenemedi."
        );
      }
    }

    // 2) release buildType'ını release anahtarına bağla.
    //    "signingConfig ... signingConfigs.debug" satırı hem debug hem release
    //    buildType'ında geçiyor; SON eşleşme release'e aittir (debug bloğu
    //    dosyada önce geliyor).
    const eslesmeler = [...icerik.matchAll(DEBUG_ATAMA)];
    if (eslesmeler.length === 0) {
      throw new Error(
        "withReleaseSigning: release buildType'ındaki signingConfig satırı bulunamadı."
      );
    }
    const son = eslesmeler[eslesmeler.length - 1];
    icerik =
      icerik.slice(0, son.index) + YENI_SATIR + icerik.slice(son.index + son[0].length);

    // 3) Yardımcı fonksiyon: anahtar dosyaları yoksa debug'a düş
    if (!icerik.includes("def ksSigningVarMi()")) {
      icerik = YARDIMCI + icerik;
    }

    config.modResults.contents = icerik;
    return config;
  });
};
