import React from "react";
import Svg, { Defs, RadialGradient, Stop, Circle } from "react-native-svg";
import { haleRengi } from "../theme/weatherTheme";

// Kahraman hava ikonunun arkasındaki yumuşak ışık halesi.
//
// Gerçek gradyana geçtikten sonra bile zemin düz duruyordu: ikon
// "yapıştırılmış" gibi görünüyordu. Hale, havayı bir ışık kaynağı gibi
// hissettirip derinlik veriyor.
//
// Bilerek YALNIZCA ikonun arkasında: metinlerin altına yayılan bir aydınlatma,
// tüm temalarda tek tek doğrulanmış beyaz metin kontrastını düşürürdü.
export default function GlyphHalo({ mood, size = 220 }) {
  const renk = haleRengi(mood);
  return (
    <Svg
      width={size}
      height={size}
      pointerEvents="none"
      // Kap, halenin boyutunda SABİT bir kare (WeatherCard.glifKutu) ve hale
      // onu tam dolduruyor. Yüzdeli konumlandırma (top/left "50%" + negatif
      // kenar boşluğu) denendi ama react-native-svg'de beklendiği gibi
      // çözülmedi: hale sağ-alta kayıyordu.
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      <Defs>
        {/* Duraklar kademeli: üç durakla 45%'te gözle görülür bir halka
            oluşuyordu. */}
        <RadialGradient id="hale" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={renk} stopOpacity={0.30} />
          <Stop offset="25%" stopColor={renk} stopOpacity={0.22} />
          <Stop offset="45%" stopColor={renk} stopOpacity={0.13} />
          <Stop offset="65%" stopColor={renk} stopOpacity={0.06} />
          <Stop offset="82%" stopColor={renk} stopOpacity={0.02} />
          <Stop offset="100%" stopColor={renk} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#hale)" />
    </Svg>
  );
}
