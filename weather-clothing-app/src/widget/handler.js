import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { HavaWidget } from "./HavaWidget";
import { widgetVerisi } from "./veri";

// Widget görev işleyicisi.
//
// Ayrı bir JS bağlamında, uygulama kapalıyken çalışıyor. Bu yüzden:
//   - React context'lerine erişimi YOK; veriyi doğrudan diskten okuyor.
//   - Ağ isteği YAPMIYOR. Widget güncellemesi arka planda ve sık tetikleniyor;
//     her seferinde istek atmak hem pili hem kotayı yerdi. Uygulama her
//     açıldığında önbelleği tazeliyor, widget onu okuyor.
//   - Hiçbir hata kullanıcıya gösterilemiyor; her şey try/catch içinde ve
//     en kötü durumda "açıp şehrini seç" hâli çiziliyor.

const ONBELLEK_ANAHTARI = "havaOnbellek.v1";
const KALIBRASYON_ANAHTARI = "sicaklikKalibrasyonu.v1";

async function veriOku() {
  try {
    const [ham, kalibHam] = await Promise.all([
      AsyncStorage.getItem(ONBELLEK_ANAHTARI),
      AsyncStorage.getItem(KALIBRASYON_ANAHTARI),
    ]);
    if (!ham) return null;
    const onbellek = JSON.parse(ham);
    const kalibrasyon = kalibHam ? JSON.parse(kalibHam) : null;
    return widgetVerisi(onbellek, kalibrasyon);
  } catch (e) {
    console.log("Widget verisi okunamadı:", e?.message);
    return null;
  }
}

export async function widgetGorevi(props) {
  const { widgetAction, renderWidget } = props;

  switch (widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED":
    case "WIDGET_CLICK": {
      const veri = await veriOku();
      renderWidget(<HavaWidget veri={veri} />);
      break;
    }
    case "WIDGET_DELETED":
      break;
    default:
      break;
  }
}
