// Widget'ı uygulama içinden güncelleme.
//
// NEDEN GEREKLİ: widget'ın kendi `updatePeriodMillis` döngüsü Android
// tarafından en az 30 dakikaya sabitleniyor ve cihaz uykudayken hiç
// çalışmıyor. Buna güvenirsek kullanıcı uygulamada 12° görürken ana ekranda
// yarım saat boyunca 18° yazmaya devam ediyor — iki ayrı uygulama gibi
// duruyor ve hangisine güveneceği belli olmuyor.
//
// Çözüm: önbellek her tazelendiğinde widget'ı biz itiyoruz. Ana ekranda
// widget yoksa kütüphane zaten hiçbir şey yapmıyor, maliyeti sıfır.

import React from "react";
import { HavaWidget } from "./HavaWidget";
import { widgetVerisi } from "./veri";

/**
 * @param onbellek WeatherContext'in yazdığı { data, ad, ts }
 * @param kalibrasyon kişisel sıcaklık kayması durumu
 */
export async function widgetiGuncelle(onbellek, kalibrasyon) {
  try {
    // Modülü tembel yüklüyoruz: widget yalnızca Android'de var ve bu dosya
    // hava akışının içinde çağrılıyor. İçe aktarma hatası hava durumunu
    // ÇÖKERTMEMELİ — kullanıcının asıl işi o.
    const { requestWidgetUpdate } = require("react-native-android-widget");
    const veri = widgetVerisi(onbellek, kalibrasyon);
    await requestWidgetUpdate({
      widgetName: "Hava",
      renderWidget: () => <HavaWidget veri={veri} />,
    });
  } catch (e) {
    console.log("Widget güncellenemedi:", e?.message);
  }
}
