// Kişisel sıcaklık kalibrasyonu testleri.
//
// Bu modül kullanıcının gördüğü ÖNERİYİ kaydırıyor. Yanlış yöne kayması
// ("üşüdüm" deyince daha ince giydirmesi) uygulamayı işe yaramaz hale
// getirir; sınırsız kayması ise birkaç kötü günü kalıcı sapmaya çevirir.

import { bolum, test, esit, ozet } from "./kosucu.mjs";

const K = await import("../src/logic/kalibrasyon.js");
const {
  ADIM,
  SINIR,
  OLGUNLUK,
  BOS_DURUM,
  kaymaDegeri,
  etkiliSicaklik,
  geriBildirimUygula,
  ozet: kOzet,
  aciklama,
  bugununGunu,
} = K;

// Ardışık günlerde geri bildirim vermek için kısayol.
const gun = (n) => `2026-03-${String(n).padStart(2, "0")}`;
const zincir = (etiketler, baslangic = BOS_DURUM) =>
  etiketler.reduce((d, e, i) => geriBildirimUygula(d, e, gun(i + 1)), baslangic);

// ---------------------------------------------------------------------------
bolum("Yön");

{
  // RİSK: yön ters olursa uygulama üşüyen kullanıcıyı daha da ince giydirir.
  const d = geriBildirimUygula(BOS_DURUM, "usudum", gun(1));
  test("üşüdüm kaymayı negatife çeker", kaymaDegeri(d) < 0);
  test("üşüdükten sonra hava daha serin sayılır", etkiliSicaklik(14, d) < 14);
}

{
  const d = geriBildirimUygula(BOS_DURUM, "terledim", gun(1));
  test("terledim kaymayı pozitife çeker", kaymaDegeri(d) > 0);
  test("terledikten sonra hava daha ılık sayılır", etkiliSicaklik(14, d) > 14);
}

{
  const d = geriBildirimUygula(BOS_DURUM, "tamOldu", gun(1));
  esit("tam oldu kaymayı oynatmaz", kaymaDegeri(d), 0);
  esit("tam oldu yine de kanıt sayılır", d.sayac, 1);
}

esit("boş durumda kayma yok", kaymaDegeri(BOS_DURUM), 0);
esit("boş durumda sıcaklık değişmez", etkiliSicaklik(14, BOS_DURUM), 14);

// ---------------------------------------------------------------------------
bolum("Günlük sınır ve düzeltme");

{
  // RİSK: aynı gün üst üste dokunmak kaymayı uca savurabilir.
  let d = BOS_DURUM;
  for (let i = 0; i < 6; i++) d = geriBildirimUygula(d, "usudum", gun(1));
  esit("aynı gün altı dokunuş tek adım", Math.abs(kaymaDegeri(d)), ADIM);
  esit("aynı gün sayaç bir kez artar", d.sayac, 1);
}

{
  // Yanlış dokunan kullanıcı kendini düzeltebilmeli.
  let d = geriBildirimUygula(BOS_DURUM, "usudum", gun(1));
  d = geriBildirimUygula(d, "terledim", gun(1));
  esit("aynı gün ters düzeltme yönü çevirir", kaymaDegeri(d), ADIM);
  d = geriBildirimUygula(d, "tamOldu", gun(1));
  esit("aynı gün nötre dönüş sıfırlar", kaymaDegeri(d), 0);
}

{
  const d = zincir(["usudum", "usudum", "usudum"]);
  esit("farklı günler birikir", Number(kaymaDegeri(d).toFixed(2)), Number((-3 * ADIM).toFixed(2)));
  esit("her gün sayacı artırır", d.sayac, 3);
}

{
  // Dünkü düzeltme bugünkü dokunuşu yutmamalı.
  let d = geriBildirimUygula(BOS_DURUM, "usudum", gun(1));
  d = geriBildirimUygula(d, "usudum", gun(1)); // aynı gün — yutulur
  d = geriBildirimUygula(d, "usudum", gun(2)); // yeni gün — eklenir
  esit("yeni gün ayrı sayılır", Number(kaymaDegeri(d).toFixed(2)), Number((-2 * ADIM).toFixed(2)));
}

// ---------------------------------------------------------------------------
bolum("Sınır");

{
  const d = zincir(Array(20).fill("usudum"));
  esit("kayma alt sınırda durur", kaymaDegeri(d), -SINIR);
  test("ham birikim sınırın ötesinde tutulur", d.ham < -SINIR);
}

{
  // RİSK: sınırı SAKLASAYDIK, sınıra dayanmış kullanıcının aynı gün içindeki
  // düzeltmesi geri alınamaz ve kayma orada kilitlenirdi.
  let d = zincir(Array(20).fill("usudum"));
  const hamOnce = d.ham;
  d = geriBildirimUygula(d, "terledim", gun(20));
  esit("aynı gün düzeltme ham değeri tam geri alır", Number((d.ham - hamOnce).toFixed(2)), Number((2 * ADIM).toFixed(2)));
}

esit("üst sınır da simetrik", kaymaDegeri(zincir(Array(20).fill("terledim"))), SINIR);

// ---------------------------------------------------------------------------
bolum("Özet ve açıklama");

esit("başlangıçta olgun değil", kOzet(BOS_DURUM).olgun, false);
esit("olgunluk eşiğinde olgun", kOzet(zincir(Array(OLGUNLUK).fill("usudum"))).olgun, true);
esit("üşüyen yönü", kOzet(zincir(Array(4).fill("usudum"))).yon, "usuyan");
esit("terleyen yönü", kOzet(zincir(Array(4).fill("terledim"))).yon, "terleyen");
esit("hep tam oldu nötr kalır", kOzet(zincir(Array(4).fill("tamOldu"))).yon, "notr");

{
  // Geri bildirimleri birbirini götüren kullanıcıya "seni üşüyen biliyoruz"
  // demek yanlış olurdu — kayma sıfır, söylenecek bir şey yok.
  const d = zincir(["usudum", "terledim", "tamOldu"]);
  esit("birbirini götüren geri bildirim nötr", kOzet(d).yon, "notr");
  test("nötrde davet metni", aciklama(d).includes("Birkaç geri bildirim"));
  esit("nötr olsa da olgun sayılır", kOzet(d).olgun, true);
}

{
  // Tek yönlü tek bir geri bildirim bile uygulanıyor; 0.8°'yi "1°" diye
  // bildirmek doğru — gerçekten o kadar kaydırıyoruz.
  const d = zincir(["usudum", "tamOldu", "tamOldu"]);
  esit("tek yönlü kayma korunur", Number(kaymaDegeri(d).toFixed(2)), -ADIM);
  esit("yönü bildiriliyor", kOzet(d).yon, "usuyan");
}

test("olgun kullanıcıya derece anlatılıyor", aciklama(zincir(Array(4).fill("usudum"))).includes("serin"));
test("terleyene ılık deniyor", aciklama(zincir(Array(4).fill("terledim"))).includes("ılık"));

// ---------------------------------------------------------------------------
bolum("Dayanıklılık");

esit("bilinmeyen etiket durumu bozmaz", geriBildirimUygula(BOS_DURUM, "hmm", gun(1)), BOS_DURUM);
esit("gün yoksa dokunmaz", geriBildirimUygula(BOS_DURUM, "usudum", null), BOS_DURUM);
esit("durum null ise boş kabul", kaymaDegeri(null), 0);
esit("sıcaklık sayı değilse dokunulmaz", etkiliSicaklik(undefined, zincir(["usudum"])), undefined);
esit("NaN sıcaklık geçer", Number.isNaN(etkiliSicaklik(NaN, BOS_DURUM)), true);

{
  const g = bugununGunu(new Date(2026, 2, 7));
  esit("gün biçimi sıfır dolgulu", g, "2026-03-07");
}

ozet();
