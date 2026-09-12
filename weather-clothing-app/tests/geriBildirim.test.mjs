// Geri bildirim e-postası testleri.
//
// Bu kanal, uygulama tamamen cihazda çalıştığı ve hiç kullanım verisi
// toplamadığı için kullanıcının derdini duyabildiğimiz TEK yol. Bozuk bir
// bağlantı ya da eksik sürüm bilgisi, gelen bildirimi işe yaramaz kılıyor.

import { readFileSync } from "node:fs";
import { bolum, test, esit, ozet } from "./kosucu.mjs";

const { govdeMetni, mailtoBaglantisi, KONU } =
  await import("../src/logic/geriBildirim.js");
const { GERI_BILDIRIM_EPOSTA, UYGULAMA_SURUMU, UYGULAMA_SURUM_KODU } =
  await import("../src/config.js");

// ---------------------------------------------------------------------------
bolum("Sürüm bilgisi app.json ile aynı");

// Sürüm elle iki yerde tutuluyor. Ayrışırsa gelen hata bildiriminde YANLIŞ
// sürüm yazar ve hatayı yanlış yerde ararız.
{
  const app = JSON.parse(readFileSync(new URL("../app.json", import.meta.url), "utf8")).expo;
  esit("sürüm adı eşleşiyor", UYGULAMA_SURUMU, app.version);
  esit("sürüm kodu eşleşiyor", UYGULAMA_SURUM_KODU, app.android.versionCode);
}

// ---------------------------------------------------------------------------
bolum("Gövde");

{
  const g = govdeMetni({ android: "16", apiSeviyesi: 36, sehir: "Rize" });
  test("kullanıcı için yer var", g.startsWith("Buraya yazabilirsin:"));
  test("sürüm geçiyor", g.includes(`${UYGULAMA_SURUMU} (${UYGULAMA_SURUM_KODU})`));
  test("android geçiyor", g.includes("Android: 16 (API 36)"));
  test("şehir geçiyor", g.includes("Şehir: Rize"));

  // Yazma alanı EN ÜSTTE olmalı: altta olsaydı kullanıcı tanı bloğunu
  // aşağı itmek ya da silmek zorunda kalır, çoğu kişi vazgeçerdi.
  test("tanı bloğu yazma alanının altında", g.indexOf("Sürüm:") > g.indexOf("Buraya yazabilirsin"));
}

{
  // Eksik bilgi satırı hiç yazılmamalı; "Android: undefined" gönderilemez.
  const g = govdeMetni({});
  test("eksik alanlar atlanıyor", !g.includes("undefined"));
  test("android yoksa satır yok", !g.includes("Android:"));
  test("şehir yoksa satır yok", !g.includes("Şehir:"));
  test("sürüm her durumda var", g.includes("Sürüm:"));
}

esit("argümansız çağrı çökmüyor", typeof govdeMetni(), "string");

// ---------------------------------------------------------------------------
bolum("mailto bağlantısı");

{
  const b = mailtoBaglantisi({ android: "16", sehir: "Rize" });
  test("mailto ile başlıyor", b.startsWith(`mailto:${GERI_BILDIRIM_EPOSTA}?`));
  test("konu var", b.includes("subject="));
  test("gövde var", b.includes("body="));

  // Kodlanmamış boşluk, & ya da satır sonu bağlantıyı bozuyor: e-posta
  // uygulaması konuyu yarıda kesiyor ya da hiç açılmıyor.
  const sorgu = b.slice(b.indexOf("?") + 1);
  test("boşluk kodlanmış", !sorgu.includes(" "));
  test("satır sonu kodlanmış", !sorgu.includes("\n"));
  test("çözülünce konu geri geliyor", decodeURIComponent(sorgu.split("subject=")[1].split("&body=")[0]) === KONU);
}

{
  // Türkçe karakterler ve & işareti kodlamayı bozmamalı.
  const b = mailtoBaglantisi({ sehir: "Şanlıurfa & çevresi" });
  test("türkçe karakter kodlanmış", !/[çğıöşüÇĞİÖŞÜ]/.test(b));
  const govde = decodeURIComponent(b.split("&body=")[1]);
  test("şehir adı bozulmadan geri geliyor", govde.includes("Şanlıurfa & çevresi"));
}

test("e-posta adresi geçerli görünüyor", /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(GERI_BILDIRIM_EPOSTA));

process.exit(ozet());
