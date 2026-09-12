// Günün kalanı testleri.
//
// Cihazda ölçülen hata: kart 19–24.1° gösterirken günün kalanı 19.9–22.7°ydi.
// Kullanıcı gelmeyecek bir sıcağı bekliyor, gelmeyecek bir serinliğe göre
// yanına bir şey alıyor.

import { bolum, test, esit, ozet } from "./kosucu.mjs";

const { kalanGun, kalanGunMetni, FARK_ESIGI } =
  await import("../src/logic/kalanGun.js");

const s = (saat, temp, gun = "2026-08-28") => ({
  time: `${gun}T${String(saat).padStart(2, "0")}:00`,
  temp,
});

// ---------------------------------------------------------------------------
bolum("Gösterme kararı");

{
  // ASIL VAKA (Erzurum, saat 15:00): kart 13–24° gösteriyor ama 13° gece
  // yarısı olmuş, bitmiş. Günün kalanı yalnızca 17–24°. Kullanıcı
  // gelmeyecek bir akşam serinliğine göre mont alıyor.
  //
  // Farkın DİPTE olması tipik: öğleden sonra bakan kullanıcı için gecenin
  // en düşüğü çoktan geçmiş oluyor.
  const saatler = [s(15, 24), s(17, 22), s(19, 20), s(21, 18), s(23, 17)];
  const k = kalanGun(saatler, { max: 24, min: 13 });
  test("dipteki daralma yakalanıyor", k !== null);
  esit("kalan max", k.max, 24);
  esit("kalan min", k.min, 17);
}

{
  // Tepedeki daralma da yakalanmalı: akşam bakan kullanıcı için öğlenin
  // sıcağı geçmiş oluyor.
  const saatler = [s(19, 22), s(20, 21), s(21, 20), s(22, 19)];
  const k = kalanGun(saatler, { max: 31, min: 18 });
  test("tepedeki daralma yakalanıyor", k !== null);
  esit("kalan max tepe değil", k.max, 22);
}

{
  // Aralık aynıysa ikinci satır tekrar olur; göstermiyoruz.
  const saatler = [s(8, 19), s(12, 24), s(18, 21), s(23, 19)];
  esit("aynı aralıkta gösterilmiyor", kalanGun(saatler, { max: 24, min: 19 }), null);
}

{
  // Eşiğin ALTINDA kalan fark gösterilmiyor.
  const saatler = [s(15, 23), s(16, 22), s(17, 21), s(18, 20)];
  esit(
    "eşik altı fark gösterilmiyor",
    kalanGun(saatler, { max: 23 + (FARK_ESIGI - 1), min: 20 - (FARK_ESIGI - 1) }),
    null
  );
}

// ---------------------------------------------------------------------------
bolum("Sınırlar ve dayanıklılık");

{
  // Gün bitmek üzereyse "21–21°" gürültü; göstermiyoruz.
  const saatler = [s(22, 21), s(23, 20)];
  esit("gün sonunda gösterilmiyor", kalanGun(saatler, { max: 28, min: 19 }), null);
}

{
  // Yarına taşan seride yalnızca BUGÜN sayılmalı; yarının sıcağı kalan
  // güne karışırsa aralık yanlış genişler.
  const saatler = [
    s(20, 20), s(21, 19), s(22, 18), s(23, 17),
    s(13, 35, "2026-08-29"),
  ];
  const k = kalanGun(saatler, { max: 30, min: 17 });
  test("bugüne sınırlanıyor", k !== null);
  esit("yarının sıcağı sızmıyor", k.max, 20);
  esit("sayılan saat sayısı", k.saatSayisi, 4);
}

esit("boş seride yok", kalanGun([], { max: 20, min: 10 }), null);
esit("null seride yok", kalanGun(null, { max: 20, min: 10 }), null);
esit("günlük veri yoksa yok", kalanGun([s(15, 20), s(16, 19), s(17, 18)], null), null);
esit(
  "günlük max eksikse yok",
  kalanGun([s(15, 20), s(16, 19), s(17, 18)], { min: 10 }),
  null
);

{
  // Sıcaklığı olmayan kayıtlar elenmeli, NaN üretmemeli.
  const saatler = [s(15, 22), { time: "2026-08-28T16:00" }, s(17, 18), s(18, 17)];
  const k = kalanGun(saatler, { max: 26, min: 17 });
  test("NaN sızmıyor", k === null || (!Number.isNaN(k.max) && !Number.isNaN(k.min)));
}

// ---------------------------------------------------------------------------
bolum("Metin");

esit("aralık metni", kalanGunMetni({ max: 23, min: 20 }), "Bundan sonra 20–23°");
esit("sabit metni", kalanGunMetni({ max: 21, min: 21 }), "Bundan sonra 21° civarı");
esit("veri yoksa metin yok", kalanGunMetni(null), null);

process.exit(ozet());
