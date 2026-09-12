import { createVerify } from "node:crypto";

// AdMob "Sunucu Taraflı Doğrulama" (SSV) callback'i.
//
// NEDEN ŞART: ödüllü reklamın karşılığı olan krediyi istemcinin "reklamı
// izledim" demesine dayanarak vermek, uygulamayı kurcalayan birine sınırsız
// kredi vermek demektir. Kredi sayacını sunucuda tutmamızın bütün sebebi
// buydu; ödülü istemciye güvenerek vermek o korumayı delerdi.
//
// Doğru akış:
//   1. İstemci ödüllü reklamı SSV seçenekleriyle yüklüyor (userId = cihaz)
//   2. Kullanıcı reklamı sonuna kadar izliyor
//   3. GOOGLE bizim sunucumuza imzalı bir GET isteği atıyor
//   4. Bu dosya imzayı doğrulayıp krediyi açıyor
//
// İmza doğrulanmadan kredi verilirse, uç noktanın adresini bilen herkes
// sınırsız kredi üretebilir.

const ANAHTAR_URL = "https://gstatic.com/admob/reward/verifier-keys.json";

type Anahtar = { keyId: string; pem: string; base64: string };

let anahtarOnbellek: { anahtarlar: Map<string, string>; gecerlilik: number } | null = null;

async function anahtarlariAl(): Promise<Map<string, string>> {
  if (anahtarOnbellek && Date.now() < anahtarOnbellek.gecerlilik) {
    return anahtarOnbellek.anahtarlar;
  }

  const res = await fetch(ANAHTAR_URL);
  if (!res.ok) throw new Error(`Doğrulama anahtarları alınamadı: ${res.status}`);
  const j = (await res.json()) as { keys: Anahtar[] };

  const harita = new Map<string, string>();
  for (const k of j.keys ?? []) {
    if (k.keyId != null && k.pem) harita.set(String(k.keyId), k.pem);
  }

  // Google anahtarları nadiren döndürüyor; 24 saat önbellek yeterli ve her
  // ödül için ağ çağrısı yapmayı önlüyor.
  anahtarOnbellek = { anahtarlar: harita, gecerlilik: Date.now() + 24 * 60 * 60 * 1000 };
  return harita;
}

/**
 * SSV isteğinin gerçekten Google'dan geldiğini doğrular.
 *
 * Google, sorgu dizesindeki `signature` ve `key_id` DIŞINDAKİ her şeyi
 * imzalıyor — yani imzalanan metin, bu iki parametrenin başladığı yere
 * kadarki ham sorgu dizesi. Bunu yeniden kurarken parametre sırasını
 * değiştirmek imzayı bozar, o yüzden ham dizeyi kesiyoruz.
 */
export async function ssvDogrula(hamSorgu: string): Promise<boolean> {
  const parametreler = new URLSearchParams(hamSorgu);
  const imza = parametreler.get("signature");
  const anahtarId = parametreler.get("key_id");
  if (!imza || !anahtarId) return false;

  const kesme = hamSorgu.indexOf("&signature=");
  if (kesme < 0) return false;
  const imzalananMetin = hamSorgu.slice(0, kesme);

  try {
    const anahtarlar = await anahtarlariAl();
    const pem = anahtarlar.get(anahtarId);
    if (!pem) return false;

    return createVerify("SHA256")
      .update(imzalananMetin)
      .verify(pem, Buffer.from(imza, "base64url"));
  } catch (e) {
    console.error("SSV doğrulaması başarısız:", (e as Error).message);
    return false;
  }
}

/**
 * Aynı ödülün iki kez sayılmasını engeller.
 *
 * Google ağ hatası durumunda callback'i TEKRAR gönderebiliyor. `transaction_id`
 * ile tekilleştirmezsek tek reklam izleyip iki kredi almak mümkün olur.
 */
const islenmisIslemler = new Map<string, number>();
const ISLEM_OMRU = 24 * 60 * 60 * 1000;

export function islemYeniMi(islemId: string): boolean {
  const simdi = Date.now();

  // Eski kayıtları temizle — sınırsız büyüyen Map bellek sızıntısı olurdu.
  // Anlık görüntü üzerinde dönüyoruz: iterasyon sırasında Map'ten silmek
  // bazı motorlarda tanımsız davranış.
  for (const [id, ts] of [...islenmisIslemler]) {
    if (simdi - ts > ISLEM_OMRU) islenmisIslemler.delete(id);
  }

  if (islenmisIslemler.has(islemId)) return false;
  islenmisIslemler.set(islemId, simdi);
  return true;
}
