import { createSign } from "node:crypto";

// Premium doğrulaması Google Play'e SORULARAK yapılıyor. İstemcinin "ben
// premium'um" demesine güvenemeyiz: uygulamayı kurcalayan biri o bayrağı
// kolayca true yapar ve sınırsız krediye erişir.
//
// Yapılandırılmamışsa herkes ÜCRETSİZ sayılır (fail-closed). Yanlış tarafa
// düşmek pahalı: açık bırakırsak fatura bize gelir.

const PAKET = process.env.PLAY_PAKET_ADI ?? "com.ismail.havakiyafet";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";

type ServisHesabi = { client_email: string; private_key: string };

function servisHesabi(): ServisHesabi | null {
  const ham = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!ham) return null;
  try {
    const j = JSON.parse(ham);
    if (!j.client_email || !j.private_key) return null;
    return { client_email: j.client_email, private_key: j.private_key };
  } catch {
    console.error("GOOGLE_SERVICE_ACCOUNT_JSON çözümlenemedi.");
    return null;
  }
}

function b64url(v: string | Buffer) {
  return Buffer.from(v).toString("base64url");
}

let tokenOnbellek: { token: string; gecerlilik: number } | null = null;

async function erisimTokeni(sa: ServisHesabi): Promise<string> {
  if (tokenOnbellek && Date.now() < tokenOnbellek.gecerlilik) return tokenOnbellek.token;

  const simdi = Math.floor(Date.now() / 1000);
  const baslik = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const govde = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: simdi,
      exp: simdi + 3600,
    })
  );
  const imza = createSign("RSA-SHA256")
    .update(`${baslik}.${govde}`)
    .sign(sa.private_key)
    .toString("base64url");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${baslik}.${govde}.${imza}`,
    }),
  });
  if (!res.ok) throw new Error(`Google token alınamadı: ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };

  // Süresinden 5 dk önce yenile ki sınırda kalan istek 401 yemesin.
  tokenOnbellek = { token: j.access_token, gecerlilik: Date.now() + (j.expires_in - 300) * 1000 };
  return j.access_token;
}

const AKTIF_DURUMLAR = new Set([
  "SUBSCRIPTION_STATE_ACTIVE",
  "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
]);

/**
 * Play satın alma jetonunun hâlâ aktif bir aboneliğe karşılık gelip
 * gelmediğini söyler. Yapılandırma yoksa veya doğrulama başarısızsa false.
 */
export async function premiumMu(satinAlmaJetonu: string | undefined): Promise<boolean> {
  if (!satinAlmaJetonu) return false;
  const sa = servisHesabi();
  if (!sa) return false;

  try {
    const token = await erisimTokeni(sa);
    const url =
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
      `${encodeURIComponent(PAKET)}/purchases/subscriptionsv2/tokens/` +
      `${encodeURIComponent(satinAlmaJetonu)}`;

    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) return false;
    const j = (await res.json()) as { subscriptionState?: string };
    return AKTIF_DURUMLAR.has(j.subscriptionState ?? "");
  } catch (e) {
    console.error("Play doğrulaması başarısız:", (e as Error).message);
    return false;
  }
}

export function playYapilandirildiMi(): boolean {
  return servisHesabi() !== null;
}
