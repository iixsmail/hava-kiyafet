import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { KombinSemasi, ParcaSemasi, type Kombin, type Parca } from "./schema.ts";

// API anahtarı YALNIZCA burada, sunucu ortamında. Uygulamanın içine asla
// gömülmüyor: bir .aab'den JS paketini çıkarıp içindeki sabitleri okumak
// birkaç komutluk iş.
//
// İstemci TEMBEL kuruluyor: modül değerlendirilirken kurulsaydı, .env
// yüklenme sırasına bağımlı olurduk ve anahtar boş yakalanabilirdi.
let _ai: GoogleGenAI | null = null;

function istemci(): GoogleGenAI {
  const anahtar = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!anahtar) {
    throw new Error("Yapay zeka servisi yapılandırılmamış (GEMINI_API_KEY eksik).");
  }
  if (!_ai) _ai = new GoogleGenAI({ apiKey: anahtar });
  return _ai;
}

// Google AI Studio ücretsiz katmanı: gemini-2.5-flash.
const MODEL = "gemini-2.5-flash";

/**
 * Zod şemasını Gemini'nin kabul ettiği JSON Schema'ya çevirir.
 *
 * İki anahtarı ayıklamak zorundayız: `$schema` ve `additionalProperties`.
 * Gemini'nin yapısal çıktı doğrulayıcısı bunları tanımıyor ve şemanın
 * tamamını reddediyor. `z.toJSONSchema` ikisini de üretiyor.
 */
function gemineUygunSema(sema: z.ZodType): Record<string, unknown> {
  const temizle = (d: any): any => {
    if (Array.isArray(d)) return d.map(temizle);
    if (d && typeof d === "object") {
      const c: any = {};
      for (const [k, v] of Object.entries(d)) {
        if (k === "$schema" || k === "additionalProperties") continue;
        c[k] = temizle(v);
      }
      return c;
    }
    return d;
  };
  return temizle(z.toJSONSchema(sema));
}

const PARCA_SEMA = gemineUygunSema(ParcaSemasi);
const KOMBIN_SEMA = gemineUygunSema(KombinSemasi);

// Sistem talimatları SABİT tutuluyor ve istekte HER ZAMAN ilk sırada gidiyor.
// Gemini 2.5 ailesi, isteğin başındaki değişmeyen kısmı otomatik olarak
// önbelleğe alıyor (implicit caching); talimatı değiştirmek veya araya
// değişken metin sokmak bu kazancı iptal eder.
const ETIKET_TALIMATI = `Sen bir gardırop asistanısın. Sana verilen fotoğraftaki TEK bir giyim
eşyasını inceleyip niteliklerini çıkarıyorsun.

Kurallar:
- Sıcaklık aralığını (minC/maxC) o parçanın TEK BAŞINA değil, tipik bir kombinin
  parçası olarak rahat giyilebileceği aralık olarak ver. Örnek: kısa kollu tişört
  18–35, kalın kaban -10–8, kot pantolon 5–28.
- "katman" alanı: üst beden giysisi = ust, alt beden = alt, dış giyim (mont, kaban,
  ceket, yağmurluk) = dis, ayakkabı = ayakkabi, atkı/bere/eldiven/şapka = aksesuar.
- "kumas" alanı: fotoğraftan görünen malzeme (pamuk, yün, denim, deri, polyester...).
  Emin değilsen en olası malzemeyi yaz.
- Fotoğrafta giyim eşyası yoksa (boş oda, yemek, insan portresi vb.) kiyafetMi=false
  ver ve diğer alanları makul varsayılanlarla doldur.
- Tüm metin alanları TÜRKÇE olsun.`;

const KOMBIN_TALIMATI = `Sen bir stil danışmanısın. Kullanıcının kendi gardırobundaki parçalardan,
o günün hava durumuna uygun bir kombin seçiyorsun.

Kurallar:
- SADECE sana verilen gardırop listesindeki id'leri kullan. Listede olmayan bir
  parçayı asla uydurma.
- Her katmandan en fazla bir parça seç. Hava uygunsa "dis" katmanını boş bırakabilirsin.
- Parçaların minC/maxC aralığıyla günün hissedilen sıcaklığını karşılaştır.
- Yağış varsa suGecirmez parçalara öncelik ver.
- Kumaş ile hava uyumunu gözet: yün soğukta, pamuk/keten sıcakta.
- Renk uyumunu gözet ama sıcaklık uygunluğundan asla ödün verme.
- Gardıropta bugün gerçekten gereken bir şey yoksa (örn. yağmurluk yok ama yağmur var)
  bunu "eksik" alanına yaz.
- Tüm metinler TÜRKÇE, sade ve samimi olsun. Abartılı moda jargonu kullanma.`;

/**
 * Modelin döndürdüğü metni JSON'a çevirip Zod ile DOĞRULAR.
 *
 * responseSchema tek başına yeterli değil: şema uyumu güçlü bir yönlendirme
 * ama sözleşme değil. Zod'dan geçirmezsek eksik bir alan sessizce
 * `undefined` olarak veritabanına yazılır ve hata çok sonra, kombin
 * seçilirken ortaya çıkar.
 */
function dogrula<T>(sema: z.ZodType<T>, metin: string | undefined, nerede: string): T {
  if (!metin) throw new Error(`${nerede}: model boş yanıt döndürdü.`);

  let ham: unknown;
  try {
    ham = JSON.parse(metin);
  } catch {
    throw new Error(`${nerede}: model geçersiz JSON döndürdü.`);
  }

  const sonuc = sema.safeParse(ham);
  if (!sonuc.success) {
    const ilk = sonuc.error.issues[0];
    throw new Error(`${nerede}: beklenmeyen alan (${ilk?.path?.join(".") || "?"}).`);
  }
  return sonuc.data;
}

/** Bir kıyafet fotoğrafını niteliklere çevirir. Parça başına bir kez çağrılır. */
export async function etiketle(base64: string, mime: string): Promise<Parca> {
  const cevap = await istemci().models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: mime, data: base64 } },
          { text: "Bu giyim eşyasının niteliklerini çıkar." },
        ],
      },
    ],
    config: {
      systemInstruction: ETIKET_TALIMATI,
      responseMimeType: "application/json",
      responseJsonSchema: PARCA_SEMA,
      // Etiketleme bir çıkarım işi, muhakeme değil. Düşünmeyi kapatmak hem
      // yanıtı hızlandırıyor hem ücretsiz katman kotasını koruyor.
      thinkingConfig: { thinkingBudget: 0 },
      temperature: 0.2,
    },
  });

  return dogrula(ParcaSemasi, cevap.text, "Etiketleme");
}

export type HavaOzeti = {
  sicaklik: number;
  hissedilen: number;
  kod: number;
  durum: string;
  ruzgar: number;
  yagisIhtimali: number | null;
  nem: number;
  gunduz: number;
  enDusuk: number;
  enYuksek: number;
};

/** Gardırop özetinden (FOTOĞRAFSIZ) günün kombinini seçer. */
export async function kombinSec(gardirop: unknown[], hava: HavaOzeti): Promise<Kombin> {
  const havaMetni = [
    `Şu an ${Math.round(hava.sicaklik)}°C, hissedilen ${Math.round(hava.hissedilen)}°C.`,
    `Durum: ${hava.durum}.`,
    `Günün aralığı ${Math.round(hava.enDusuk)}°C – ${Math.round(hava.enYuksek)}°C.`,
    `Rüzgar ${Math.round(hava.ruzgar)} km/s, nem %${Math.round(hava.nem)}.`,
    hava.yagisIhtimali != null ? `Yağış ihtimali %${Math.round(hava.yagisIhtimali)}.` : "",
    hava.gunduz === 0 ? "Şu an gece." : "Şu an gündüz.",
  ]
    .filter(Boolean)
    .join(" ");

  const cevap = await istemci().models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              `Gardırop:\n${JSON.stringify(gardirop)}\n\n` +
              `Hava durumu:\n${havaMetni}\n\nBugün için bir kombin seç.`,
          },
        ],
      },
    ],
    config: {
      systemInstruction: KOMBIN_TALIMATI,
      responseMimeType: "application/json",
      responseJsonSchema: KOMBIN_SEMA,
      // Kombin seçimi gerçek bir karşılaştırma işi — burada az miktarda
      // düşünmeye izin veriyoruz, ama sınırlı tutuyoruz.
      thinkingConfig: { thinkingBudget: 512 },
      temperature: 0.6,
    },
  });

  return dogrula(KombinSemasi, cevap.text, "Kombin");
}

export function anahtarVarMi(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}
