// Yalnızca WEB için boş modül.
//
// react-native-google-mobile-ads ve expo-iap, React Native'in native-only
// iç modüllerini (codegenNativeComponent, TurboModuleRegistry) import
// ediyor. Bunlar tarayıcıda yok; Metro web paketini bu yüzden kuramıyor.
//
// Uygulama kodu bu paketleri zaten korumalı `require` ile yüklüyor ve
// yoksa ilgili özelliği sessizce gizliyor (AdBanner reklam alanını boş
// bırakıyor, PremiumContext satın almayı devre dışı bırakıyor). Dolayısıyla
// bu stub, web'de o "modül yok" dalını tetiklemekten başka bir şey yapmıyor.
//
// ANDROID'E ETKİSİ YOK: metro.config.js bu yönlendirmeyi yalnızca
// platform === "web" iken uyguluyor.
module.exports = {};
