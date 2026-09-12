// .env dosyasını Node'un yerleşik yükleyicisiyle okur (ek bağımlılık yok).
//
// Neden ayrı bir modül: ESM'de `import` deyimleri hoist edilir ve modüller
// import SIRASINA göre değerlendirilir. `index.ts` içine düz bir
// `process.loadEnvFile()` satırı yazsaydık, o satır çalışmadan önce
// `gemini.ts` çoktan değerlendirilmiş ve `process.env` boşken okunmuş
// olurdu. Bu modülü index.ts'in İLK import'u yaparak yüklemenin diğer her
// şeyden önce olmasını garantiliyoruz.

try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {
  /* .env yok — değişkenler doğrudan ortamdan gelebilir */
}

export {};
