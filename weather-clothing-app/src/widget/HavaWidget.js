import React from "react";
import { FlexWidget, TextWidget } from "react-native-android-widget";

// Ana ekran widget'ı.
//
// Neden var: hava durumu uygulamaları ana ekranda yaşıyor. Açılmayan
// uygulama siliniyor. Kullanıcının sabah bakacağı tek şey "kaç derece ve ne
// giyeyim" — widget bu ikisini uygulamayı açmadan veriyor.
//
// DİKKAT: burada React Native bileşenleri KULLANILAMAZ. Widget, Android'in
// RemoteViews sistemine çeviriliyor ve yalnızca bu kütüphanenin sunduğu
// bileşenler destekleniyor. StyleSheet de yok; stiller doğrudan prop.

const ARKA = "#16233B";
const ALTIN = "#FFC65C";
const BEYAZ = "#FFFFFF";
const SOLUK = "#A8B6CC";

/**
 * @param veri null | { derece, durum, ikon, konum, oneri, guncelleme }
 *   null ise "henüz veri yok" hâli çiziliyor — boş widget "bozuk" görünür.
 */
export function HavaWidget({ veri }) {
  if (!veri) {
    return (
      <FlexWidget
        clickAction="OPEN_APP"
        style={{
          height: "match_parent",
          width: "match_parent",
          backgroundColor: ARKA,
          borderRadius: 24,
          justifyContent: "center",
          alignItems: "center",
          padding: 12,
        }}
      >
        <TextWidget
          text="Hava & Kıyafet"
          style={{ fontSize: 14, fontWeight: "700", color: BEYAZ }}
        />
        <TextWidget
          text="Açıp şehrini seç"
          style={{ fontSize: 12, color: SOLUK, marginTop: 4 }}
        />
      </FlexWidget>
    );
  }

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: ARKA,
        borderRadius: 24,
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 14,
      }}
    >
      {/* Üst satır: konum ve durum */}
      <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
        <TextWidget
          text={veri.ikon}
          style={{ fontSize: 16, marginRight: 6 }}
        />
        <TextWidget
          text={veri.konum}
          maxLines={1}
          style={{ fontSize: 12, fontWeight: "600", color: SOLUK }}
        />
      </FlexWidget>

      {/* Derece — widget'ta okunması gereken ilk şey */}
      <FlexWidget style={{ flexDirection: "row", alignItems: "flex-end" }}>
        <TextWidget
          text={`${veri.derece}°`}
          style={{ fontSize: 38, fontWeight: "300", color: BEYAZ }}
        />
        <TextWidget
          text={veri.durum}
          maxLines={1}
          style={{ fontSize: 12, color: SOLUK, marginLeft: 8, marginBottom: 8 }}
        />
      </FlexWidget>

      {/* Uygulamanın asıl işi: ne giyeyim */}
      <TextWidget
        text={veri.oneri}
        maxLines={2}
        style={{ fontSize: 12.5, fontWeight: "600", color: ALTIN }}
      />
    </FlexWidget>
  );
}
