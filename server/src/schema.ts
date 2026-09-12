import { z } from "zod";

// Katman adları uygulamadaki avatar slotlarıyla BİREBİR aynı olmalı —
// Modelin döndürdüğü katman doğrudan slot anahtarı olarak kullanılıyor.
export const KATMANLAR = ["ust", "alt", "dis", "ayakkabi", "aksesuar"] as const;

export const RESMIYET = ["spor", "gunluk", "yari-resmi", "resmi"] as const;

/**
 * Bir kıyafet fotoğrafından çıkarılan nitelikler.
 *
 * minC/maxC alanları kasıtlı olarak "bu parça kaç derecede giyilir" sorusunun
 * cevabı — sonraki kombin isteğinde fotoğrafı tekrar göndermeyip yalnızca bu
 * sayılarla çalışabilmemizi sağlıyor. Etiketleme parça başına BİR KEZ yapılır.
 */
export const ParcaSemasi = z.object({
  kiyafetMi: z
    .boolean()
    .describe("Fotoğrafta gerçekten bir giyim eşyası veya aksesuar var mı"),
  ad: z.string().describe("Kısa Türkçe ad, örn. 'Lacivert kot pantolon'"),
  tur: z.string().describe("Parçanın türü, örn. 'kot pantolon', 'triko kazak'"),
  katman: z.enum(KATMANLAR),
  kumas: z
    .string()
    .describe("Görünen kumaş/malzeme, Türkçe — örn. 'pamuk', 'yün', 'deri', 'denim', 'polyester'"),
  minC: z.number().describe("Bu parçanın rahat giyilebildiği en düşük sıcaklık (°C)"),
  maxC: z.number().describe("Bu parçanın rahat giyilebildiği en yüksek sıcaklık (°C)"),
  renk: z.string().describe("Baskın renk, Türkçe"),
  desen: z.string().describe("Desen, örn. 'düz', 'çizgili', 'ekose'"),
  suGecirmez: z.boolean(),
  resmiyet: z.enum(RESMIYET),
});

export type Parca = z.infer<typeof ParcaSemasi>;

/** Günün kombini: gardıroptan seçilen parçalar ve gerekçesi. */
export const KombinSemasi = z.object({
  secilenler: z
    .array(
      z.object({
        id: z.string().describe("Gardıroptaki parçanın id'si, birebir kopyala"),
        katman: z.enum(KATMANLAR),
        neden: z.string().describe("Tek cümle, neden bu parça"),
      })
    )
    .describe("Her katmandan en fazla bir parça"),
  baslik: z.string().describe("Kısa, samimi bir cümle, örn. 'Serin bir gün, katman ekle.'"),
  ozet: z.string().describe("İki cümlelik açıklama"),
  eksik: z
    .string()
    .nullable()
    .describe("Gardıropta bugün için eksik olan bir şey varsa yaz, yoksa null"),
});

export type Kombin = z.infer<typeof KombinSemasi>;
