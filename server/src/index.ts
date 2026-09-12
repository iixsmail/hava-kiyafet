// EN ÜSTTE kalmalı — diğer modüller değerlendirilmeden önce .env yüklensin.
import "./env.ts";

import { createServer } from "node:http";
import { anahtarVarMi, etiketle, kombinSec, type HavaOzeti } from "./gemini.ts";
import {
  durum,
  etiketHarca,
  etiketIadeEt,
  kombinHarca,
  kombinIadeEt,
  odulEkle,
  LIMITLER,
  GUNLUK_AZAMI_ODUL,
} from "./credits.ts";
import { islemYeniMi, ssvDogrula } from "./reward.ts";
import { playYapilandirildiMi, premiumMu } from "./play.ts";

const PORT = Number(process.env.PORT ?? 8787);

// Bir kıyafet fotoğrafı base64'e çevrilince ~1.3 katına çıkıyor. 8 MB tavan,
// telefon kamerasından gelen sıkıştırılmış JPEG için fazlasıyla yeterli ve
// sunucuyu devasa gövdelerle boğmayı engelliyor.
const AZAMI_GOVDE = 8 * 1024 * 1024;

function json(res: any, kod: number, govde: unknown) {
  const metin = JSON.stringify(govde);
  res.writeHead(kod, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(metin),
  });
  res.end(metin);
}

function govdeOku(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let boyut = 0;
    const parcalar: Buffer[] = [];
    req.on("data", (p: Buffer) => {
      boyut += p.length;
      if (boyut > AZAMI_GOVDE) {
        reject(new Error("Fotoğraf çok büyük."));
        req.destroy();
        return;
      }
      parcalar.push(p);
    });
    req.on("end", () => {
      try {
        resolve(parcalar.length ? JSON.parse(Buffer.concat(parcalar).toString("utf8")) : {});
      } catch {
        reject(new Error("Geçersiz istek gövdesi."));
      }
    });
    req.on("error", reject);
  });
}

// Aynı cihazdan eşzamanlı istek, kredi sayacında yarış oluşturur. Cihaz başına
// tek istek kuralı hem bunu hem de basit bir kötüye kullanım tavanını sağlıyor.
const islemde = new Set<string>();

const server = createServer(async (req, res) => {
  const yol = (req.url ?? "").split("?")[0];

  // --- AdMob ödül callback'i ---------------------------------------------
  // Bu uç noktayı GOOGLE çağırıyor, istemci DEĞİL. AdMob panelinde
  // "Server-side verification" URL'i olarak bu adres tanımlanmalı:
  //   https://SUNUCUN/v1/odul
  //
  // İmza doğrulanmadan kredi verilmiyor — adresi bilen herkesin sınırsız
  // kredi üretebilmesi demek olurdu.
  if (yol === "/v1/odul") {
    const hamSorgu = (req.url ?? "").split("?")[1] ?? "";

    if (!(await ssvDogrula(hamSorgu))) {
      console.warn("Geçersiz imzalı ödül isteği reddedildi");
      // Google'a 200 dönüyoruz ki tekrar denemesin; krediyi vermiyoruz.
      return json(res, 200, { durum: "reddedildi" });
    }

    const p = new URLSearchParams(hamSorgu);
    const odulCihaz = p.get("user_id");
    const islemId = p.get("transaction_id");

    if (!odulCihaz || !islemId) return json(res, 200, { durum: "eksik" });

    // Google ağ hatasında callback'i TEKRAR gönderebiliyor; tekilleştirmezsek
    // tek reklamdan iki kredi çıkar.
    if (!islemYeniMi(islemId)) return json(res, 200, { durum: "yinelenen" });

    const verildi = odulEkle(odulCihaz);
    console.log(`Ödül ${verildi ? "verildi" : "tavan doldu"}: ${odulCihaz}`);
    return json(res, 200, { durum: verildi ? "verildi" : "tavan" });
  }

  if (yol === "/saglik") {
    return json(res, 200, {
      durum: "ayakta",
      model: "gemini-2.5-flash",
      yapayZekaAnahtari: anahtarVarMi() ? "tanımlı" : "EKSİK",
      playDogrulamasi: playYapilandirildiMi() ? "aktif" : "yapılandırılmamış",
      limitler: LIMITLER,
      gunlukAzamiOdul: GUNLUK_AZAMI_ODUL,
    });
  }

  const cihaz = String(req.headers["x-cihaz"] ?? "").trim();
  if (!cihaz || cihaz.length > 128) {
    return json(res, 400, { hata: "Cihaz kimliği eksik." });
  }

  const premium = await premiumMu(
    typeof req.headers["x-play-jeton"] === "string" ? req.headers["x-play-jeton"] : undefined
  );

  if (yol === "/v1/kredi" && req.method === "GET") {
    return json(res, 200, { kredi: durum(cihaz, premium) });
  }

  if (req.method !== "POST") return json(res, 404, { hata: "Bulunamadı." });

  if (islemde.has(cihaz)) {
    return json(res, 429, { hata: "Önceki isteğin sürüyor, biraz bekle." });
  }
  islemde.add(cihaz);

  try {
    const govde = await govdeOku(req);

    if (yol === "/v1/etiketle") {
      const { gorsel, mime } = govde as { gorsel?: string; mime?: string };
      if (!gorsel) return json(res, 400, { hata: "Fotoğraf gelmedi." });

      if (!etiketHarca(cihaz, premium)) {
        return json(res, 402, {
          hata: "Etiketleme hakkın doldu.",
          kredi: durum(cihaz, premium),
        });
      }
      try {
        const parca = await etiketle(gorsel, mime ?? "image/jpeg");
        return json(res, 200, { parca, kredi: durum(cihaz, premium) });
      } catch (e) {
        etiketIadeEt(cihaz, premium); // başarısız çağrı krediyi yakmasın
        throw e;
      }
    }

    if (yol === "/v1/kombin") {
      const { gardirop, hava } = govde as { gardirop?: unknown[]; hava?: HavaOzeti };
      if (!Array.isArray(gardirop) || gardirop.length === 0) {
        return json(res, 400, { hata: "Gardırop boş." });
      }
      if (!hava) return json(res, 400, { hata: "Hava durumu gelmedi." });

      if (!kombinHarca(cihaz, premium)) {
        return json(res, 402, {
          hata: premium
            ? "Bugünlük kombin hakkın doldu, yarın yenilenir."
            : "Bugünlük kombin hakkın doldu. Premium'da günde 20 öneri var.",
          kredi: durum(cihaz, premium),
        });
      }
      try {
        const kombin = await kombinSec(gardirop, hava);
        return json(res, 200, { kombin, kredi: durum(cihaz, premium) });
      } catch (e) {
        kombinIadeEt(cihaz, premium);
        throw e;
      }
    }

    return json(res, 404, { hata: "Bulunamadı." });
  } catch (e) {
    const mesaj = (e as Error).message || "Beklenmeyen bir hata oluştu.";
    console.error(`[${yol}]`, mesaj);
    return json(res, 500, { hata: mesaj });
  } finally {
    islemde.delete(cihaz);
  }
});

server.listen(PORT, () => {
  console.log(`Hava & Kıyafet sunucusu :${PORT} portunda`);
  if (!anahtarVarMi()) {
    console.warn("UYARI: GEMINI_API_KEY tanımlı değil, yapay zeka çağrıları başarısız olacak.");
  }
  if (!playYapilandirildiMi()) {
    console.warn("UYARI: Play doğrulaması yapılandırılmamış — herkes ücretsiz sayılacak.");
  }
});
