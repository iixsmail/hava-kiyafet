// Minik test koşucusu — ek bağımlılık yok.
//
// Neden jest değil: jest, React Native preset'i ve babel yapılandırmasıyla
// birlikte ~50 MB bağımlılık ve kırılgan bir kurulum getiriyor. Buradaki
// testler saf mantık ve veri katmanını sınıyor; onun için düz Node yeterli
// ve `npm test` bir saniyede bitiyor. Bileşen render testi gerekirse o zaman
// jest + @testing-library/react-native eklenir.

let toplam = 0;
let kalan = 0;
const basliklar = [];

export function bolum(ad) {
  basliklar.push(ad);
  console.log(`\n${ad}`);
}

export function test(ad, kosul, ayrinti = "") {
  toplam++;
  const ok = kosul === true;
  if (!ok) kalan++;
  const isaret = ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
  console.log(`  ${isaret} ${ad}${ayrinti ? `  — ${ayrinti}` : ""}`);
}

export function esit(ad, gelen, beklenen) {
  const ok = Object.is(gelen, beklenen);
  test(ad, ok, ok ? "" : `beklenen ${JSON.stringify(beklenen)}, gelen ${JSON.stringify(gelen)}`);
}

export function yakin(ad, gelen, beklenen, tolerans = 0.01) {
  const ok = typeof gelen === "number" && Math.abs(gelen - beklenen) <= tolerans;
  test(ad, ok, ok ? "" : `beklenen ~${beklenen}, gelen ${gelen}`);
}

export function atmali(ad, fn) {
  let atti = false;
  try {
    fn();
  } catch {
    atti = true;
  }
  test(ad, atti, atti ? "" : "hata fırlatması bekleniyordu");
}

export function ozet() {
  const cizgi = "─".repeat(52);
  console.log(`\n${cizgi}`);
  if (kalan === 0) {
    console.log(`\x1b[32m  ${toplam} test · hepsi geçti\x1b[0m`);
  } else {
    console.log(`\x1b[31m  ${toplam} test · ${kalan} KALDI\x1b[0m`);
  }
  return kalan;
}
