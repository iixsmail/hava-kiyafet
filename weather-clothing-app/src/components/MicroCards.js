import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { ruzgarOku, ruzgarYonu } from "../api/weather";

// Yağış, rüzgar, UV, nem, basınç, görüş ve gün doğumu/batımı için kompakt
// ölçüm kartları.
//
// Önceki hâlinde bunlar tek bir kutuda dikey çizgilerle ayrılmış küçük
// metinlerdi; okunmuyordu. Ayrı kartlar her ölçüme kendi alanını veriyor ve
// altındaki tek satırlık yorum sayıyı anlamlandırıyor — asıl değer sayının
// kendisinde değil, ne yapılması gerektiğinde. "%32" değil, "%32 · Şemsiye
// gerekmez".

function yorum(tur, deger, ek) {
  if (deger == null || Number.isNaN(deger)) return "Veri yok";
  switch (tur) {
    case "yagis": {
      // Miktar biliniyorsa onu söylüyoruz: "%80" bir şey ifade etmez ama
      // "3 mm bekleniyor" giyinme kararını doğrudan değiştirir.
      const mm = typeof ek === "number" && Number.isFinite(ek) && ek > 0 ? ek : null;
      if (mm) {
        if (mm < 1) return `${mm.toFixed(1)} mm · çiseleme`;
        if (mm < 4) return `${mm.toFixed(1)} mm · şemsiye al`;
        return `${Math.round(mm)} mm · kuvvetli`;
      }
      if (deger < 15) return "Şemsiye gerekmez";
      if (deger < 45) return "İhtimal var";
      if (deger < 70) return "Şemsiyeni al";
      return "Yağmur çok olası";
    }
    case "ruzgar":
      if (deger < 12) return ek ? `${ek} yönünden, sakin` : "Sakin";
      if (deger < 25) return ek ? `${ek} yönünden hafif` : "Hafif esinti";
      if (deger < 40) return ek ? `${ek} yönünden sert` : "Rüzgarlı";
      return "Kuvvetli, dikkat";
    case "uv":
      if (deger < 3) return "Koruma gerekmez";
      if (deger < 6) return "Orta, gölge iyi gelir";
      if (deger < 8) return "Yüksek, krem sür";
      return "Çok yüksek, kaçın";
    case "nem":
      // Yorumu ÇİY NOKTASINA göre veriyoruz (varsa), bağıl neme göre değil:
      // %70 bağıl nem 5°C'de kuru, 28°C'de boğucu hissettirir. Çiy noktası
      // sıcaklıktan bağımsız, mutlak bir konfor ölçüsü.
      if (typeof ek === "number" && Number.isFinite(ek)) {
        // Eşikleri GÖSTERİLEN (yuvarlanmış) değere uyguluyoruz. Ham değere
        // uygulamak "Çiy 5° · çok kuru" gibi kendi kendisiyle çelişen bir
        // satır üretiyordu (4.7 → yazıda 5, eşikte <5).
        const c = Math.round(ek);
        if (c < 5) return `Çiy ${c}° · çok kuru`;
        if (c < 10) return `Çiy ${c}° · kuru, ferah`;
        if (c < 16) return `Çiy ${c}° · dengeli`;
        if (c < 19) return `Çiy ${c}° · hafif ağır`;
        if (c < 23) return `Çiy ${c}° · nemli`;
        return `Çiy ${c}° · bunaltıcı`;
      }
      if (deger < 30) return "Kuru, nemlendir";
      if (deger < 60) return "Dengeli";
      if (deger < 75) return "Nemli";
      return "Bunaltıcı";
    case "basinc":
      // 1013 hPa standart atmosfer basıncı. Bu eşikler yalnızca deniz
      // seviyesine indirgenmiş basınç (pressure_msl) için geçerli; yüzey
      // basıncıyla kullanılırsa rakımlı şehirlerde hep "düşük" çıkar.
      if (deger < 1000) return "Alçak, hava bozabilir";
      if (deger > 1025) return "Yüksek, açık hava";
      return "Normal";
    case "gorus":
      // Metre cinsinden geliyor.
      if (deger < 1000) return "Çok düşük, dikkat";
      if (deger < 4000) return "Puslu";
      if (deger < 10000) return "Orta";
      return "Berrak";
    default:
      return "";
  }
}

function MikroKart({ ikon, etiket, deger, birim, tur, sayi, ek, theme, altMetin }) {
  const aciklama = altMetin ?? yorum(tur, sayi, ek);
  return (
    <View
      style={[styles.kart, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
      accessibilityRole="text"
      accessibilityLabel={`${etiket}: ${deger}${birim || ""}, ${aciklama}`}
    >
      <View style={styles.ustSatir}>
        <Text style={styles.ikon}>{ikon}</Text>
        <Text style={[styles.etiket, { color: theme.textMuted }]}>{etiket}</Text>
      </View>
      <Text style={[styles.deger, { color: theme.textPrimary }]} numberOfLines={1}>
        {deger}
        {birim ? <Text style={styles.birim}>{birim}</Text> : null}
      </Text>
      <Text style={[styles.yorum, { color: theme.textMuted }]} numberOfLines={1}>
        {aciklama}
      </Text>
    </View>
  );
}

// Sayı olmayan değer geldiğinde "NaN" değil "—" göster.
const gs = (v, ondalik = 0) =>
  typeof v === "number" && Number.isFinite(v) ? v.toFixed(ondalik) : "—";

// Yoruma GÖSTERİLEN sayıyı veriyoruz, ham ölçümü değil.
//
// Cihazda yakalandı: UV 2.6 ile UV 3.4 ekranda ikisi de "3" yazıyor ama
// biri "Koruma gerekmez" diğeri "Orta, gölge iyi gelir" diyordu. Aynı sayıya
// çelişen iki tavsiye, kullanıcı için ölçümün yanlış olmasından beter.
const yv = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : v);

export default function MicroCards({ current, rainChance, gorus, gunes, theme }) {
  if (!current) return null;

  const nem = current.relative_humidity_2m;
  const ruzgar = current.wind_speed_10m;
  const uv = current.uv_index;
  const basinc = current.pressure_msl;
  const yon = ruzgarYonu(current.wind_direction_10m);
  const ok = ruzgarOku(current.wind_direction_10m);

  // Görüş mesafesi metre geliyor; 10 km üstünü "10+" diye gösteriyoruz —
  // meteorolojik olarak 10 km zaten "sınırsız berraklık" sayılıyor ve
  // "24 km" yazmak bilgi katmıyor.
  const gorusKm =
    typeof gorus === "number" && Number.isFinite(gorus)
      ? gorus >= 10000
        ? "10+"
        : (gorus / 1000).toFixed(1)
      : "—";

  return (
    <View style={styles.izgara}>
      <MikroKart
        ikon="☂️"
        etiket="YAĞIŞ"
        deger={rainChance != null ? `%${gs(rainChance)}` : "—"}
        tur="yagis"
        sayi={yv(rainChance)}
        ek={current.precipitation}
        theme={theme}
      />
      <MikroKart
        ikon={ok ?? "💨"}
        etiket="RÜZGAR"
        deger={gs(ruzgar)}
        birim=" km/s"
        tur="ruzgar"
        sayi={yv(ruzgar)}
        ek={yon}
        theme={theme}
      />
      <MikroKart ikon="🕶️" etiket="UV" deger={gs(uv)} tur="uv" sayi={yv(uv)} theme={theme} />
      <MikroKart
        ikon="💧"
        etiket="NEM"
        deger={nem != null ? `%${gs(nem)}` : "—"}
        tur="nem"
        sayi={yv(nem)}
        ek={current.dew_point_2m}
        theme={theme}
      />
      <MikroKart
        ikon="🌡️"
        etiket="BASINÇ"
        deger={gs(basinc)}
        birim=" hPa"
        tur="basinc"
        sayi={yv(basinc)}
        theme={theme}
      />
      <MikroKart
        ikon="👁️"
        etiket="GÖRÜŞ"
        deger={gorusKm}
        birim={gorusKm === "—" ? "" : " km"}
        tur="gorus"
        sayi={gorus}
        theme={theme}
      />
      {gunes && (
        <>
          <MikroKart
            ikon="🌅"
            etiket="GÜN DOĞUMU"
            deger={gunes.dogus}
            theme={theme}
            altMetin="Sabah aydınlanıyor"
          />
          <MikroKart
            ikon="🌇"
            etiket="GÜN BATIMI"
            deger={gunes.batis}
            theme={theme}
            altMetin={`${gunlukIsik(gunes)} gün ışığı`}
          />
        </>
      )}
    </View>
  );
}

// "13s 30dk" — gün doğumu ile batımı arasındaki süre.
function gunlukIsik(gunes) {
  try {
    const [dS, dD] = gunes.dogus.split(":").map(Number);
    const [bS, bD] = gunes.batis.split(":").map(Number);
    const dakika = bS * 60 + bD - (dS * 60 + dD);
    if (!Number.isFinite(dakika) || dakika <= 0) return "—";
    return `${Math.floor(dakika / 60)}s ${dakika % 60}dk`;
  } catch {
    return "—";
  }
}

const styles = StyleSheet.create({
  izgara: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 20,
  },
  kart: {
    // İki sütun: kartlar ikişerli satırlara oturuyor ve her biri nefes alıyor.
    width: "47.6%",
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 5,
  },
  ustSatir: { flexDirection: "row", alignItems: "center", gap: 6 },
  ikon: { fontSize: 13 },
  etiket: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  deger: { fontSize: 23, fontWeight: "600", letterSpacing: -0.5 },
  birim: { fontSize: 13, fontWeight: "500" },
  yorum: { fontSize: 11, fontWeight: "500" },
});
