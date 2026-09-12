// Metro yapılandırması — TEK amacı `expo start --web`'i çalışır tutmak.
//
// Web önizlemesi arayüzü hızlıca gözden geçirmek için kullanışlı, ama
// react-native-google-mobile-ads ve expo-iap React Native'in native-only iç
// modüllerini import ediyor ve web paketi kurulamıyor.
//
// Bu dosya o iki paketi YALNIZCA web'de boş bir stub'a yönlendiriyor.
// `platform !== "web"` olan her durumda Metro'nun varsayılan çözümleyicisi
// aynen çalışıyor — yani Android/iOS paketi bit bazında etkilenmiyor.

const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

const SADECE_NATIVE = ["react-native-google-mobile-ads", "expo-iap"];
const STUB = path.resolve(__dirname, "web-stubs/native-only.js");

const varsayilanCozumleyici = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === "web" &&
    SADECE_NATIVE.some((p) => moduleName === p || moduleName.startsWith(`${p}/`))
  ) {
    return { type: "sourceFile", filePath: STUB };
  }
  return (varsayilanCozumleyici ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
