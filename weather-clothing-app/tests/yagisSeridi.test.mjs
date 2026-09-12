// Yağış şeridi testleri.
//
// Bu şerit "şimdi çıksam ıslanır mıyım" sorusunu cevaplıyor. Yanlış bir
// "kesiliyor" saati kullanıcıyı yağmurun ortasına gönderir.

import { bolum, test, esit, ozet } from "./kosucu.mjs";

const { yagisSeridi, CEYREK_SAYISI, GOSTERME_ESIGI, KURU_ARA } =
  await import("../src/logic/yagisSeridi.js");

// mm dizisinden çeyrek serisi kurar; 10:00'dan başlayarak 15'er dakika.
const seri = (mmler, baslangicDk = 0) =>
  mmler.map((mm, i) => {
    const toplam = baslangicDk + i * 15;
    const saat = 10 + Math.floor(toplam / 60);
    const dk = toplam % 60;
    return {
      time: `2026-08-28T${String(saat).padStart(2, "0")}:${String(dk).padStart(2, "0")}`,
      yagisMm: mm,
    };
  });

// ---------------------------------------------------------------------------
bolum("Gösterme eşiği");

esit("kuru seride şerit yok", yagisSeridi(seri(Array(24).fill(0))), null);
esit("eser miktarda şerit yok", yagisSeridi(seri([0, 0.05, 0, 0.05, ...Array(20).fill(0)])), null);
esit("kısa seride şerit yok", yagisSeridi(seri([2, 3])), null);
esit("boş seride şerit yok", yagisSeridi([]), null);
esit("null seride şerit yok", yagisSeridi(null), null);

test(
  "eşiğin üstünde şerit var",
  yagisSeridi(seri([0, 0, GOSTERME_ESIGI + 0.1, 0, ...Array(20).fill(0)])) !== null
);

// ---------------------------------------------------------------------------
bolum("Başlangıç ve bitiş");

{
  // 10:00'da kuru, 10:30'da başlıyor, 11:15'te kesiliyor.
  const s = yagisSeridi(seri([0, 0, 0.5, 0.8, 0.4, 0, 0, 0, ...Array(16).fill(0)]));
  esit("başlangıç saati", s.basla, "10:30");
  esit("bitiş saati", s.bitir, "11:15");
  esit("şu an yağmıyor", s.suAnYagiyor, false);
  esit("özet doğru", s.ozet, "10:30 gibi başlıyor, 11:15 gibi kesiliyor.");
}

{
  // Şu an yağıyorsa cümle farklı olmalı: "başlıyor" demek saçma olurdu.
  const s = yagisSeridi(seri([1.2, 0.9, 0.4, 0, 0, 0, ...Array(18).fill(0)]));
  esit("şu an yağıyor işaretli", s.suAnYagiyor, true);
  esit("özet şu ana göre", s.ozet, "Şu an yağıyor, 10:45 gibi kesiliyor.");
}

{
  // Pencere boyunca sürüyorsa bitiş yok.
  const s = yagisSeridi(seri(Array(24).fill(0.5)));
  esit("bitiş yok", s.bitir, null);
  test("özet sürüyor diyor", s.ozet.includes("sürüyor"));
}

{
  // RİSK: tek kuru çeyreği "kesildi" saymak, aralıklı sağanakta kullanıcıyı
  // yağmurun ortasına gönderir. 30 dakika kuru kalmalı.
  const s = yagisSeridi(seri([0, 1, 1, 0, 1, 1, 0, 0, 0, ...Array(15).fill(0)]));
  esit("tek kuru çeyrek kesinti sayılmıyor", s.bitir, "11:30");
}

esit(
  "kuru ara sabiti bekleneni veriyor",
  yagisSeridi(seri([0, 1, ...Array(KURU_ARA).fill(0), 1, ...Array(20).fill(0)])).bitir,
  "10:30"
);

// ---------------------------------------------------------------------------
bolum("Aralıklı yağış");

{
  // RİSK — cihazda yakalandı: cümle yalnızca ilk atağı anlatınca çubuklarla
  // çelişiyordu. "11:15 gibi kesiliyor" derken grafikte 12:30'da daha
  // yoğun yağış duruyordu; kullanıcı bitti sanıp ıslanıyor.
  const s = yagisSeridi(seri([0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 2, 2, ...Array(12).fill(0)]));
  esit("tekrar işaretleniyor", s.tekrarVar, true);
  esit("son yağış saati", s.sonYagis, "12:45");
  esit("özet aralıklı diyor", s.ozet, "Aralıklı yağış — 10:15 ile 12:45 arası.");
  test("özet 'kesiliyor' demiyor", !s.ozet.includes("kesiliyor"));
}

{
  // Tek atak varsa eski cümle korunmalı.
  const s = yagisSeridi(seri([0, 1, 1, 0, 0, 0, ...Array(18).fill(0)]));
  esit("tekrar yok", s.tekrarVar, false);
  esit("tek atakta net cümle", s.ozet, "10:15 gibi başlıyor, 10:45 gibi kesiliyor.");
}

{
  // Şu an yağıyor ve sonra tekrar var.
  const s = yagisSeridi(seri([1, 1, 0, 0, 0, 0, 2, 2, ...Array(16).fill(0)]));
  esit("şu an yağıyor + tekrar", s.ozet, "Aralıklı yağış — 11:45 civarına kadar sürüyor.");
}

// ---------------------------------------------------------------------------
bolum("Çubuklar");

{
  const s = yagisSeridi(seri([0, 0.5, 2, 1, ...Array(20).fill(0)]));
  esit("çubuk sayısı pencereyle aynı", s.barlar.length, CEYREK_SAYISI);
  esit("en büyük değer", s.enBuyuk, 2);
  esit("en büyüğün oranı 1", s.barlar[2].oran, 1);
  esit("yarısının oranı 0.5", s.barlar[3].oran, 0.5);
  esit("kurunun oranı 0", s.barlar[0].oran, 0);
  esit("toplam doğru", Number(s.toplam.toFixed(1)), 3.5);
}

{
  const s = yagisSeridi(seri([0, 0, 1, 1, ...Array(20).fill(0)]));
  const basiOlan = s.barlar.filter((b) => b.saatBasi).map((b) => b.saat);
  test("yalnızca tam saatler etiketli", basiOlan.every((x) => x.endsWith(":00")));
  test("her saatte bir etiket var", basiOlan.length >= 5 && basiOlan.length <= 7);
}

{
  // Pencere 24 çeyrekle sınırlı; fazlası kırpılmalı.
  const s = yagisSeridi(seri([...Array(30).fill(0.3)]));
  esit("pencere kırpılıyor", s.barlar.length, CEYREK_SAYISI);
}

// ---------------------------------------------------------------------------
bolum("Dayanıklılık");

{
  // Eksik mm alanı sıfır sayılmalı, NaN üretmemeli.
  const s = yagisSeridi([
    { time: "2026-08-28T10:00" },
    { time: "2026-08-28T10:15", yagisMm: 1 },
    { time: "2026-08-28T10:30", yagisMm: null },
    { time: "2026-08-28T10:45", yagisMm: 0.5 },
  ]);
  test("NaN sızmıyor", !JSON.stringify(s).includes("NaN"));
  esit("eksik alan sıfır sayılıyor", s.barlar[0].mm, 0);
}

process.exit(ozet());
