// Hazır katalog testleri.
//
// Katalog, kombin motorunun gördüğü TEK veri kaynağı olacak (fotoğrafsız
// kurulum yapan kullanıcıda). Bir katman boş kalırsa ya da sıcaklık
// aralıklarında delik olursa, kullanıcı "öneri çıkmıyor" ekranıyla karşılaşır
// ve bunu katalogun hatası olarak göremez.

import { bolum, test, esit, ozet } from "./kosucu.mjs";

const { KATALOG, KATMAN_BASLIKLARI, VARSAYILAN_SECIM, katalogParcasi, secimDurumu, kotayaSigdir } =
  await import("../src/logic/katalog.js");
const { yerelKombinSec } = await import("../src/logic/localStylist.js");

const KATMANLAR = ["ust", "alt", "dis", "ayakkabi", "aksesuar"];
const RESMIYETLER = ["gunluk", "spor", "yari-resmi", "resmi"];

// ---------------------------------------------------------------------------
bolum("Katalog bütünlüğü");

test("kimlikler benzersiz", new Set(KATALOG.map((k) => k.id)).size === KATALOG.length);
test("adlar benzersiz", new Set(KATALOG.map((k) => k.ad)).size === KATALOG.length);
test("her kalemin katmanı geçerli", KATALOG.every((k) => KATMANLAR.includes(k.katman)));
test("her kalemin resmiyeti geçerli", KATALOG.every((k) => RESMIYETLER.includes(k.resmiyet)));
test("aralıklar sayı ve tutarlı", KATALOG.every((k) => Number.isFinite(k.minC) && Number.isFinite(k.maxC) && k.minC < k.maxC));

for (const katman of KATMANLAR) {
  test(`${katman} katmanında kalem var`, KATALOG.some((k) => k.katman === katman));
}

esit(
  "bölüm başlıkları tüm katmanları kapsıyor",
  KATMAN_BASLIKLARI.map((b) => b.katman).sort().join(),
  [...KATMANLAR].sort().join()
);

// ---------------------------------------------------------------------------
bolum("Sıcaklık kapsaması");

{
  // RİSK: aralıklarda delik kalırsa o sıcaklıkta hiçbir üst/alt seçilemez ve
  // kullanıcı boş öneriyle kalır. -5 ile 40 arasını tarıyoruz.
  const bosluklar = { ust: [], alt: [], ayakkabi: [] };
  for (let t = -5; t <= 40; t++) {
    for (const katman of Object.keys(bosluklar)) {
      const kapsayan = KATALOG.filter(
        (k) => k.katman === katman && k.minC <= t && k.maxC >= t
      );
      if (kapsayan.length === 0) bosluklar[katman].push(t);
    }
  }
  esit("üst her sıcaklıkta var", bosluklar.ust.join(","), "");
  esit("alt her sıcaklıkta var", bosluklar.alt.join(","), "");
  esit("ayakkabı her sıcaklıkta var", bosluklar.ayakkabi.join(","), "");
}

{
  // Soğukta dış giyim ŞART; localStylist 16°'nin altında dış katman arıyor.
  const soguk = KATALOG.filter((k) => k.katman === "dis" && k.minC <= -5);
  test("çok soğuk için dış giyim var", soguk.length > 0);
}

// ---------------------------------------------------------------------------
bolum("Varsayılan seçim");

{
  const gecerli = VARSAYILAN_SECIM.every((id) => KATALOG.some((k) => k.id === id));
  test("varsayılan kimlikler katalogda var", gecerli);
  const d = secimDurumu(VARSAYILAN_SECIM);
  test("varsayılan seçim kombine yeter", d.yeterli);
  test("varsayılanda ayakkabı var", d.ayakkabiVar);
  // Ücretsiz sınır 20; varsayılan bunun çok altında kalmalı ki kullanıcı
  // ilk adımda kotasını tüketmesin.
  test("varsayılan seçim kotayı doldurmuyor", VARSAYILAN_SECIM.length <= 10);
}

// ---------------------------------------------------------------------------
bolum("Seçim durumu");

esit("boş seçim yetersiz", secimDurumu([]).yeterli, false);
esit("boş seçimde iki eksik", secimDurumu([]).eksikler.length, 2);
esit("yalnız üst yetersiz", secimDurumu(["k-tisort"]).yeterli, false);
esit("yalnız üstte eksik alt", secimDurumu(["k-tisort"]).eksikler.join(), "bir alt");
esit("üst+alt yeterli", secimDurumu(["k-tisort", "k-kot"]).yeterli, true);
esit("bilinmeyen kimlik sayılmıyor", secimDurumu(["yok-boyle-bir-sey"]).sayi, 0);

// ---------------------------------------------------------------------------
bolum("Gardırop kaydına çevirme");

{
  const p = katalogParcasi(KATALOG.find((k) => k.id === "k-yagmurluk"));
  esit("etiketlendi işaretli", p.etiketlendi, true);
  esit("su geçirmez korunuyor", p.suGecirmez, true);
  esit("katman korunuyor", p.katman, "dis");
  test("aralık taşınıyor", Number.isFinite(p.minC) && Number.isFinite(p.maxC));
}

esit(
  "su geçirmez olmayanlar false",
  katalogParcasi(KATALOG.find((k) => k.id === "k-tisort")).suGecirmez,
  false
);

// ---------------------------------------------------------------------------
bolum("Katalogla kombin üretilebiliyor");

{
  // RİSK: katalog kendi başına kombin üretemiyorsa özellik anlamsız.
  // Varsayılan seçimle, uçtan uca yerel motoru çalıştırıyoruz.
  const parcalar = KATALOG.filter((k) => VARSAYILAN_SECIM.includes(k.id)).map((k, i) => ({
    ...katalogParcasi(k),
    id: `t${i}`,
  }));
  const hava = (hissedilen) => ({ hissedilen, kod: 0, yagis: 0, ruzgar: 5, uv: 3 });

  for (const derece of [-2, 8, 15, 22, 30]) {
    const k = yerelKombinSec(parcalar, hava(derece), { etkinlik: "gunluk" });
    test(`${derece}° için kombin çıkıyor`, !!k);
    if (k) {
      const katmanlar = k.secilenler.map((s) => s.katman);
      test(`${derece}° kombininde üst var`, katmanlar.includes("ust"));
      test(`${derece}° kombininde alt var`, katmanlar.includes("alt"));
    }
  }
}

{
  // Yağmurda su geçirmez parça öne çıkmalı.
  const parcalar = KATALOG.filter((k) =>
    ["k-tisort", "k-kot", "k-sneaker", "k-yagmurluk", "k-kotceket"].includes(k.id)
  ).map((k, i) => ({ ...katalogParcasi(k), id: `y${i}`, ad: k.ad }));
  const k = yerelKombinSec(parcalar, { hissedilen: 14, kod: 63, yagis: 80, ruzgar: 10, uv: 1 }, {
    etkinlik: "gunluk",
  });
  const dis = k?.secilenler.find((s) => s.katman === "dis");
  const secilenParca = parcalar.find((p) => p.id === dis?.id);
  esit("yağmurda yağmurluk seçiliyor", secilenParca?.ad ?? "", "Yağmurluk");
}

// ---------------------------------------------------------------------------
bolum("Kotaya sığdırma");

const katmanSayilari = (liste) =>
  liste.reduce((a, p) => ({ ...a, [p.katman]: (a[p.katman] ?? 0) + 1 }), {});

{
  // RİSK — cihazda yakalandı: baştan kırpmak (slice) katalog sırasını
  // izliyor ve 30 kalemin tamamı seçildiğinde ilk 20'si 8 üst + 6 alt +
  // 6 dış oluyordu. Kullanıcı ayakkabı işaretlemiş ama gardırobuna hiç
  // ayakkabı girmiyordu.
  const hepsi = KATALOG.map(katalogParcasi);
  const sigan = kotayaSigdir(hepsi, 20);
  esit("kotaya tam sığıyor", sigan.length, 20);
  const s = katmanSayilari(sigan);
  for (const katman of KATMANLAR) {
    test(`${katman} katmanı kırpmadan sağ çıkıyor`, (s[katman] ?? 0) > 0);
  }
  // Naif kırpmanın ne verdiğini de gösteriyoruz ki fark belgelenmiş olsun.
  const naif = katmanSayilari(hepsi.slice(0, 20));
  esit("naif kırpmada ayakkabı yok", naif.ayakkabi ?? 0, 0);
}

{
  const hepsi = KATALOG.map(katalogParcasi);
  esit("kota yeterliyse hepsi geçiyor", kotayaSigdir(hepsi, 100).length, hepsi.length);
  esit("sınırsız kotada hepsi geçiyor", kotayaSigdir(hepsi, Infinity).length, hepsi.length);
  esit("sıfır kotada hiçbiri", kotayaSigdir(hepsi, 0).length, 0);
  esit("negatif kotada hiçbiri", kotayaSigdir(hepsi, -3).length, 0);
  esit("boş seçim boş döner", kotayaSigdir([], 10).length, 0);
}

{
  // Katman içindeki sıra korunmalı: listede önce gelen önce girmeli.
  const ustler = KATALOG.filter((k) => k.katman === "ust").map(katalogParcasi);
  const sigan = kotayaSigdir(ustler, 3);
  esit("tek katmanda sıra korunuyor", sigan.map((p) => p.ad).join(","), ustler.slice(0, 3).map((p) => p.ad).join(","));
}

{
  // Kota dar olsa bile üst ve alt önce pay almalı — kombin için zorunlular.
  const hepsi = KATALOG.map(katalogParcasi);
  const s = katmanSayilari(kotayaSigdir(hepsi, 2));
  test("iki parçalık kotada üst ve alt geliyor", (s.ust ?? 0) === 1 && (s.alt ?? 0) === 1);
}

ozet();
