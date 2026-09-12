// Uygulama giriş noktası.
//
// Expo'nun varsayılan girişi (expo/AppEntry.js) yerine kendi girişimizi
// kullanıyoruz: ana ekran widget'ının görev işleyicisi burada kaydedilmek
// zorunda. Widget, uygulama kapalıyken de tetikleniyor ve o anda çalışan tek
// şey bu dosya oluyor.
import { registerRootComponent } from "expo";
import { registerWidgetTaskHandler } from "react-native-android-widget";

import App from "./App";
import { widgetGorevi } from "./src/widget/handler";

registerRootComponent(App);
registerWidgetTaskHandler(widgetGorevi);
