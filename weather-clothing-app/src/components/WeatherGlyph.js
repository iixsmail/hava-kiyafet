import React from "react";
import Svg, { Circle, Path, G, Defs, LinearGradient, Stop } from "react-native-svg";

// Vektör hava ikonu.
//
// Neden emoji değil: Android'de emoji (NotoColorEmoji) BİTMAP bir yazı tipi —
// glifleri ~136 piksel. Kahraman ikonu 76pt (≈200 piksel) çizdiğimizde
// büyütülmüş bir bitmap görüntüsü çıkıyordu; kullanıcının "piksel piksel
// duruyor" dediği şeylerden biri buydu. SVG her boyutta net kalıyor ve
// cihazın emoji sürümüne göre değişmiyor.
//
// Küçük ölçeklerde (kart içi 14-20pt) emoji hâlâ sorunsuz; bu bileşen
// yalnızca BÜYÜK gösterimler için.

const GUNES = "#FFC65C";
const GUNES_KOYU = "#F0A93B";
const BULUT = "#F2F5FA";
const BULUT_KOYU = "#CBD5E4";
const YAGMUR = "#7EC8F5";
const KAR = "#E8F4FF";
const SIMSEK = "#FFD24A";
const AY = "#F5F0DC";

/** WMO kodunu çizim tipine indirger. */
export function glifTipi(code, isDay = 1) {
  const gece = isDay === 0;
  if (code === 0) return gece ? "ay" : "gunes";
  if (code === 1) return gece ? "ay-bulut" : "gunes-bulut";
  if (code === 2) return gece ? "ay-bulut" : "gunes-bulut";
  if (code === 3) return "bulut";
  if (code === 45 || code === 48) return "sis";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81].includes(code)) return "yagmur";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "kar";
  if ([82, 95, 96, 99].includes(code)) return "firtina";
  return "bulut";
}

const Bulut = ({ x = 0, y = 0, s = 1, ust = BULUT, alt = BULUT_KOYU }) => (
  <G transform={`translate(${x},${y}) scale(${s})`}>
    <Path
      d="M26 62 C13 62 3 53 3 42 C3 32 11 24 21 23 C25 12 36 5 48 5
         C63 5 76 16 78 31 C89 33 96 42 96 51 C96 57 91 62 84 62 Z"
      fill={ust}
    />
    <Path
      d="M26 62 C13 62 3 53 3 42 C3 40 3 39 4 37 C8 47 17 54 28 54 L84 54
         C89 54 93 51 95 47 C96 48 96 50 96 51 C96 57 91 62 84 62 Z"
      fill={alt}
    />
  </G>
);

// Damla: sivri tepe, altta tam yuvarlak.
//
// Kenarları tepeden tabana DÜZ indirmek koni üretiyor ve cihazda üçgen gibi
// görünüyordu. Kontrol noktaları, kenarların alttaki daireye teğet geçmesini
// sağlıyor — damla ancak o zaman damla gibi okunuyor.
const R = 5.5;
const BOY = 18;
// Alt yarım daireyi YAY (A) yerine Bézier ile çiziyoruz. Yayın süpürme
// bayrağı cihazda üst yarıyı seçiyordu ve damlanın altı düz kalıyordu —
// üçgen gibi görünüyorlardı. Bézier'de yön belirsizliği yok.
const K = R * 0.5523;
const DAMLA =
  `M0 ${-BOY}` +
  ` C${R * 0.62} ${-BOY * 0.6} ${R} ${-R * 1.55} ${R} 0` +
  ` C${R} ${K} ${K} ${R} 0 ${R}` +
  ` C${-K} ${R} ${-R} ${K} ${-R} 0` +
  ` C${-R} ${-R * 1.55} ${-R * 0.62} ${-BOY * 0.6} 0 ${-BOY} Z`;

// Kademe (i*2) bilinçli olarak küçük: 120 birimlik viewBox'ta damlalar
// aşağı doğru kayıyor ve sonuncusu alttan KIRPILIYORDU.
const Damlalar = ({ y = 0, renk = YAGMUR }) => (
  <G transform={`translate(0,${y})`}>
    {[24, 50, 76].map((x, i) => (
      <G key={x} transform={`translate(${x},${20 + i * 2})`}>
        <Path d={DAMLA} fill={renk} opacity={0.92} />
      </G>
    ))}
  </G>
);

const KarTaneleri = ({ y = 0 }) =>
  [24, 50, 76].map((x, i) => (
    <G key={x} transform={`translate(${x},${y + 12 + i * 3})`}>
      {[0, 60, 120].map((a) => (
        <Path
          key={a}
          d="M-8 0 L8 0"
          stroke={KAR}
          strokeWidth={3}
          strokeLinecap="round"
          transform={`rotate(${a})`}
        />
      ))}
    </G>
  ));

export default function WeatherGlyph({ code, isDay = 1, size = 120, style }) {
  const tip = glifTipi(code, isDay);

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" style={style}>
      <Defs>
        <LinearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={GUNES} />
          <Stop offset="1" stopColor={GUNES_KOYU} />
        </LinearGradient>
      </Defs>

      {(tip === "gunes" || tip === "gunes-bulut") && (
        <G transform={tip === "gunes" ? "translate(60,58)" : "translate(42,40)"}>
          {tip === "gunes" &&
            [0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
              <Path
                key={a}
                d="M0 -46 L0 -34"
                stroke={GUNES}
                strokeWidth={7}
                strokeLinecap="round"
                transform={`rotate(${a})`}
              />
            ))}
          <Circle r={tip === "gunes" ? 26 : 21} fill="url(#g)" />
        </G>
      )}

      {(tip === "ay" || tip === "ay-bulut") && (
        <G transform={tip === "ay" ? "translate(60,58)" : "translate(44,40)"}>
          {/* Hilal: dolu daireden ikinci daireyi "kesiyoruz" — even-odd yerine
              iki yaylı tek yol, böylece maske gerekmiyor. */}
          <Path
            d="M6 -28 A28 28 0 1 0 22 20 A22 22 0 1 1 6 -28 Z"
            fill={AY}
            transform={tip === "ay" ? "scale(1)" : "scale(0.78)"}
          />
        </G>
      )}

      {tip !== "gunes" && tip !== "ay" && tip !== "sis" && (
        <Bulut x={12} y={tip === "gunes-bulut" || tip === "ay-bulut" ? 40 : 30} s={0.95} />
      )}

      {tip === "yagmur" && <Damlalar y={89} />}
      {tip === "kar" && <KarTaneleri y={92} />}

      {tip === "firtina" && (
        // Önceki yol KENDİNİ KESİYORDU; nonzero dolgu kuralıyla yıldırım
        // yerine ince bir dilim çiziliyordu. Bu çokgen kesişmiyor: tepeden
        // sola iniyor, kırılıp aşağı devam ediyor, sağ üstten kapanıyor.
        <Path d="M64 62 L46 94 L57 94 L50 120 L76 86 L63 86 L72 62 Z" fill={SIMSEK} />
      )}

      {tip === "sis" && (
        <G>
          <Bulut x={12} y={24} s={0.9} />
          {[0, 1, 2].map((i) => (
            <Path
              key={i}
              d={`M${16 + i * 6} ${94 + i * 10} L${104 - i * 6} ${94 + i * 10}`}
              stroke={BULUT_KOYU}
              strokeWidth={6}
              strokeLinecap="round"
              opacity={0.75 - i * 0.18}
            />
          ))}
        </G>
      )}
    </Svg>
  );
}
