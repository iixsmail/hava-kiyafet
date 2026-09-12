// Ana ekran widget'ı veri testleri.
//
// Widget ayrı bir JS bağlamında, uygulama KAPALIYKEN çalışıyor. Hatası
// kullanıcıya gösterilemiyor, logcat'te bile zor görünüyor. Bu yüzden
// dönüşümü burada sabitliyoruz.

import { bolum, test, esit, ozet } from "./kosucu.mjs";

const { widgetVerisi, eskiMi, BAYATLAMA_MS } = await import("../src/widget/veri.js");

const onbellek = (o = {}) => ({
  ad: o.ad ?? "Ankara, Ankara",
  ts: o.ts ?? Date.now(),
  data: {
    current: {
      temperature_2m: o.temp ?? 23.4,
      apparent_temperature: o.hissedilen ?? 22,
      weather_code: o.kod ?? 0,
      wind_speed_10m: o.ruzgar ?? 5,
      precipitation: o.yagis ?? 0,
      relative_humidity_2m: 45,
      uv_index: 3,
      is_day: o.gunduz ?? 1,
    },
  },
});

// ---------------------------------------------------------------------------
bolum("Veri dönüşümü");

{
  const v = widgetVerisi(onbellek());
  esit("derece yuvarlanıyor", v.derece, 23);
  esit("konum taşınıyor", v.konum, "Ankara, Ankara");
  test("durum metni dolu", typeof v.durum === "string" && v.durum.length > 2);
  test("ikon dolu", typeof v.ikon === "string" && v.ikon.length > 0);
  test("öneri dolu", typeof v.oneri === "string" && v.oneri.length > 8);
  test("çıktıda NaN yok", !JSON.stringify(v).includes("NaN"));
  test("çıktıda undefined yok", !JSON.stringify(v).includes("undefined"));
}

{
  // Gece kodu farklı ikon vermeli.
  const gunduz = widgetVerisi(onbellek({ kod: 0, gunduz: 1 }));
  const gece = widgetVerisi(onbellek({ kod: 0, gunduz: 0 }));
  test("gece ikonu farklı", gunduz.ikon !== gece.ikon, `${gunduz.ikon} vs ${gece.ikon}`);
}

{
  // Kişisel kayma widget'a da uygulanmalı; yoksa uygulama içinde "hırka"
  // derken ana ekranda "tişört" yazar.
  //
  // Not: bu test başta `headline` üzerinden yazılmıştı ve kaldı — çünkü
  // headline HAVA DURUMUNU anlatıyor, sıcaklıktan bağımsız. Widget'ın
  // göstermesi gereken şey kıyafet maddeleriydi; testin yakaladığı şey
  // aslında tasarım kusuruydu.
  // 19° "Uzun kollu" bandında; kayma sınırı ±5 olduğu için 19−5=14 bir alt
  // banda ("Hırka") düşüyor. Bant sınırını geçmeyen bir değer seçmek testi
  // anlamsız kılardı.
  const notr = widgetVerisi(onbellek({ hissedilen: 19 }), null);
  const usuyen = widgetVerisi(onbellek({ hissedilen: 19 }), { ham: -6 });
  test("kayma öneriyi değiştiriyor", notr.oneri !== usuyen.oneri, `${notr.oneri} vs ${usuyen.oneri}`);
  esit("kayma dereceyi DEĞİŞTİRMİYOR", notr.derece, usuyen.derece);
}

{
  // Öneri, hava durumu cümlesi değil KIYAFET olmalı.
  const v = widgetVerisi(onbellek({ hissedilen: 24, kod: 0 }));
  test("öneri hava cümlesi değil", !v.oneri.includes("gün seni bekliyor"), v.oneri);
  test("öneri kısa", v.oneri.length <= 40, v.oneri);
}

{
  // Yağmurda hem şemsiye hem kıyafet görünmeli.
  const v = widgetVerisi(onbellek({ hissedilen: 12, kod: 63, yagis: 2 }));
  test("yağmurda şemsiye/yağmurluk geçiyor", /Şemsiye|Yağmurluk/i.test(v.oneri), v.oneri);
  test("en fazla iki madde", v.oneri.split(" · ").length <= 2, v.oneri);
}

// ---------------------------------------------------------------------------
bolum("Eksik veri");

esit("önbellek yoksa null", widgetVerisi(null), null);
esit("data yoksa null", widgetVerisi({ ad: "X", ts: 1 }), null);
esit("current yoksa null", widgetVerisi({ data: {} }), null);
esit("sıcaklık yoksa null", widgetVerisi({ data: { current: { weather_code: 0 } } }), null);
esit("ad yoksa varsayılan", widgetVerisi(onbellek({ ad: "" })).konum, "Konumun");

// ---------------------------------------------------------------------------
bolum("Bayatlama");

esit("taze veri bayat değil", eskiMi(Date.now()), false);
esit("eşiğin hemen altı taze", eskiMi(Date.now() - (BAYATLAMA_MS - 1000)), false);
esit("eşiğin üstü bayat", eskiMi(Date.now() - (BAYATLAMA_MS + 1000)), true);
esit("zaman damgası yoksa bayat", eskiMi(undefined), true);
esit("bozuk damga bayat", eskiMi("dün"), true);
esit("bayatlık çıktıya yansıyor", widgetVerisi(onbellek({ ts: Date.now() - 5 * 3600 * 1000 })).eskimis, true);

process.exit(ozet());
