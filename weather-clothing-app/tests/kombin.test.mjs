// Cihazdaki kombin motoru testleri.
//
// Bu motor, yapay zeka servisi kapalıyken / kotası dolduğunda / internet
// yokken kullanıcının gördüğü tek öneri kaynağı. Saçma bir öneri (30
// derecede kaban) motorun güvenilirliğini tek hamlede bitirir.

import { bolum, test, esit, ozet } from "./kosucu.mjs";

const { yerelKombinSec, tahminiEtiket, ETKINLIKLER } = await import("../src/logic/localStylist.js");
const { katmanPlani, bavulListesi } = await import("../src/logic/layerPlan.js");

const p = (id, katman, minC, maxC, ek = {}) => ({
  id,
  katman,
  minC,
  maxC,
  ad: id,
  etiketlendi: true,
  suGecirmez: false,
  ...ek,
});

// Tipik bir gardırop
const GARDIROP = [
  p("tisort", "ust", 18, 35),
  p("kazak", "ust", 2, 16),
  p("gomlek", "ust", 14, 26),
  p("kot", "alt", 5, 28),
  p("sort", "alt", 22, 40),
  p("mont", "dis", -10, 10),
  p("yagmurluk", "dis", 5, 20, { suGecirmez: true }),
  p("sneaker", "ayakkabi", 10, 32),
  p("bot", "ayakkabi", -5, 16, { suGecirmez: true }),
  p("atki", "aksesuar", -10, 8),
];

const hava = (o = {}) => ({
  sicaklik: 20,
  hissedilen: 20,
  kod: 0,
  ruzgar: 8,
  yagisIhtimali: 0,
  uv: 3,
  ...o,
});

const secilen = (k, katman) => k?.secilenler?.find((s) => s.katman === katman)?.id ?? null;

// ---------------------------------------------------------------------------
bolum("Sıcaklığa göre seçim");

{
  const k = yerelKombinSec(GARDIROP, hava({ hissedilen: 30 }));
  esit("30°'de tişört", secilen(k, "ust"), "tisort");
  esit("30°'de şort", secilen(k, "alt"), "sort");
  // RİSK: sıcakta dış katman önermek motorun güvenilirliğini bitirir.
  esit("30°'de dış giyim YOK", secilen(k, "dis"), null);
  esit("30°'de atkı YOK", secilen(k, "aksesuar"), null);
}

{
  const k = yerelKombinSec(GARDIROP, hava({ hissedilen: 2 }));
  esit("2°'de kazak", secilen(k, "ust"), "kazak");
  esit("2°'de mont", secilen(k, "dis"), "mont");
  esit("2°'de bot", secilen(k, "ayakkabi"), "bot");
  esit("2°'de atkı var", secilen(k, "aksesuar"), "atki");
}

{
  const k = yerelKombinSec(GARDIROP, hava({ hissedilen: 20 }));
  // 20° gömleğin (14–26) tam ortasına tişörtten (18–35) daha yakın.
  esit("20°'de gömlek tercih ediliyor", secilen(k, "ust"), "gomlek");
  esit("20°'de dış giyim yok", secilen(k, "dis"), null);
}

// ---------------------------------------------------------------------------
bolum("Yağış");

{
  const k = yerelKombinSec(GARDIROP, hava({ hissedilen: 14, kod: 63 }));
  // RİSK: yağmurda su geçirmez parçayı atlamak, uygulamanın tek işini
  // yapmaması demek.
  esit("yağmurda yağmurluk", secilen(k, "dis"), "yagmurluk");
  esit("yağmurda su geçirmez ayakkabı", secilen(k, "ayakkabi"), "bot");
}

{
  // Kod açık ama ihtimal yüksek — yine yağışlı sayılmalı.
  const k = yerelKombinSec(GARDIROP, hava({ hissedilen: 15, kod: 0, yagisIhtimali: 80 }));
  esit("yüksek ihtimalde de yağmurluk", secilen(k, "dis"), "yagmurluk");
}

{
  // Kuru havada, AYNI sıcaklık aralığında su geçirmez olmayan bir alternatif
  // varsa onun tercih edilmesi gerekiyor: su geçirmezlik kuru günde bir
  // avantaj değil.
  //
  // Not: bu testin ilk hâli "kuru havada yağmurluk seçilmesin" diyordu ve
  // kaldı — ama hatalı olan testti. Gardıropta tek alternatif -10..10
  // aralığındaki kalın mont olduğunda, 15°C'de yağmurluğu ince ceket gibi
  // giymek DOĞRU davranış. Ölçülmesi gereken şey eşit koşulda tercih.
  const esitAlternatif = [...GARDIROP, p("ceket", "dis", 5, 20)];
  const kuru = yerelKombinSec(esitAlternatif, hava({ hissedilen: 15, kod: 0, yagisIhtimali: 10 }));
  const yagmurlu = yerelKombinSec(esitAlternatif, hava({ hissedilen: 15, kod: 63 }));

  esit("kuru havada normal ceket", secilen(kuru, "dis"), "ceket");
  esit("yağmurda yağmurluk", secilen(yagmurlu, "dis"), "yagmurluk");
}

// ---------------------------------------------------------------------------
bolum("Rüzgar");

{
  const sakin = yerelKombinSec(GARDIROP, hava({ hissedilen: 19, ruzgar: 5 }));
  const sert = yerelKombinSec(GARDIROP, hava({ hissedilen: 19, ruzgar: 40 }));
  esit("19° sakin havada dış giyim yok", secilen(sakin, "dis"), null);
  test("19° sert rüzgarda dış giyim var", secilen(sert, "dis") !== null, `seçilen: ${secilen(sert, "dis")}`);
}

// ---------------------------------------------------------------------------
bolum("Çeşitlilik");

{
  const ilk = yerelKombinSec(GARDIROP, hava({ hissedilen: 22 }));
  const ikinci = yerelKombinSec(GARDIROP, hava({ hissedilen: 22 }), {
    sonKullanilanIdler: ilk.secilenler.map((s) => s.id),
  });
  // RİSK: her gün aynı kombini öneren motor kullanılmaz hale gelir.
  test(
    "art arda çağrıda öneri değişiyor",
    secilen(ilk, "ust") !== secilen(ikinci, "ust"),
    `${secilen(ilk, "ust")} -> ${secilen(ikinci, "ust")}`
  );
}

// ---------------------------------------------------------------------------
bolum("Eksik gardırop");

{
  const k = yerelKombinSec([p("tisort", "ust", 18, 35)], hava({ hissedilen: 25 }));
  esit("tek parçayla da öneri üretiyor", k.secilenler.length, 1);
  test("eksikleri bildiriyor", typeof k.eksik === "string" && k.eksik.length > 0, k.eksik);
}

{
  // Sadece kışlık parçalar varken yaz günü
  const k = yerelKombinSec([p("mont", "dis", -10, 5), p("bot", "ayakkabi", -5, 10)], hava({ hissedilen: 32 }));
  // RİSK: uygun olmayan parçayı zorlamak, "32 derecede mont giy" demek olurdu.
  test("uygunsuz parça zorlanmıyor", !k || k.secilenler.length === 0 || secilen(k, "dis") === null, JSON.stringify(k?.secilenler ?? []));
}

esit("boş gardırop null", yerelKombinSec([], hava()), null);
esit("etiketsiz gardırop null", yerelKombinSec([{ id: "x", etiketlendi: false }], hava()), null);

// ---------------------------------------------------------------------------
bolum("Çıktı bütünlüğü");

{
  const k = yerelKombinSec(GARDIROP, hava({ hissedilen: 12, kod: 61 }));
  test("başlık dolu", typeof k.baslik === "string" && k.baslik.length > 5, k.baslik);
  test("özet dolu", typeof k.ozet === "string" && k.ozet.length > 5, k.ozet);
  test("her seçimin gerekçesi var", k.secilenler.every((s) => s.neden?.length > 5));
  test("her seçimin id ve katmanı var", k.secilenler.every((s) => s.id && s.katman));
  esit("kaynak cihaz olarak işaretli", k.kaynak, "cihaz");
  test("çıktıya NaN sızmıyor", !JSON.stringify(k).includes("NaN"));
  // Her katmandan en fazla bir parça
  const katmanlar = k.secilenler.map((s) => s.katman);
  esit("katman tekrarı yok", katmanlar.length, new Set(katmanlar).size);
}

// ---------------------------------------------------------------------------
bolum("Elle etiketleme varsayılanları");

{
  const t = tahminiEtiket();
  test("makul sıcaklık aralığı", t.minC < t.maxC && t.minC >= -20 && t.maxC <= 45, `${t.minC}–${t.maxC}`);
  test("geçerli katman", ["ust", "alt", "dis", "ayakkabi", "aksesuar"].includes(t.katman));
  test("geçerli resmiyet", ["spor", "gunluk", "yari-resmi", "resmi"].includes(t.resmiyet));
  esit("kıyafet olarak işaretli", t.kiyafetMi, true);
}

// ---------------------------------------------------------------------------
bolum("Etkinlik modları");

{
  const g = [
    p("takim", "ust", 10, 24, { resmiyet: "resmi" }),
    p("tsort", "ust", 10, 24, { resmiyet: "spor" }),
    p("gomlek2", "ust", 10, 24, { resmiyet: "gunluk" }),
    p("pantolon", "alt", 5, 28),
    p("ayakkabi1", "ayakkabi", 5, 30),
  ];
  esit("iş modunda resmi seçiliyor", secilen(yerelKombinSec(g, hava({ hissedilen: 18 }), { etkinlik: "is" }), "ust"), "takim");
  esit("spor modunda spor seçiliyor", secilen(yerelKombinSec(g, hava({ hissedilen: 18 }), { etkinlik: "spor" }), "ust"), "tsort");
  esit("günlük modda günlük seçiliyor", secilen(yerelKombinSec(g, hava({ hissedilen: 18 }), { etkinlik: "gunluk" }), "ust"), "gomlek2");
}

{
  // RİSK: etkinlik puanı sıcaklığı ezerse, iş modunda 35 derecede takım
  // önerilir. Etkinlik bir TERCİH, zorunluluk değil.
  const g = [
    p("takim", "ust", 5, 18, { resmiyet: "resmi" }),
    p("tsort", "ust", 20, 35, { resmiyet: "spor" }),
  ];
  esit("sıcakta etkinlik sıcaklığı ezmiyor", secilen(yerelKombinSec(g, hava({ hissedilen: 32 }), { etkinlik: "is" }), "ust"), "tsort");
}

{
  // Tercih edilen resmiyet yoksa kullanıcı boş kalmamalı.
  const g = [p("tsort", "ust", 10, 30, { resmiyet: "spor" }), p("alt1", "alt", 5, 30)];
  const k = yerelKombinSec(g, hava({ hissedilen: 20 }), { etkinlik: "is" });
  esit("resmi parça yoksa yine öneri var", secilen(k, "ust"), "tsort");
}

test("ücretsizde sadece günlük açık", ETKINLIKLER.gunluk.premium === false && ETKINLIKLER.is.premium && ETKINLIKLER.spor.premium && ETKINLIKLER.aksam.premium);

// ---------------------------------------------------------------------------
bolum("Saatlik katman çizelgesi");

const saat = (h, temp, ek = {}) => ({ time: `2026-08-25T${String(h).padStart(2, "0")}:00`, temp, code: 0, rainChance: 0, ...ek });

{
  // Sabah 12, öğleden sonra 26 — kullanıcının tarif ettiği senaryo
  const s = [saat(8, 12), saat(10, 17), saat(12, 22), saat(14, 26), saat(18, 21), saat(21, 14)];
  const plan = katmanPlani(s);
  test("büyük fark plan üretiyor", plan !== null);
  esit("fark doğru", plan.fark, 14);
  esit("en yüksek saat", plan.enYuksek.saat, "14:00");
  test("katman çıkarma adımı var", plan.adimlar.some((a) => a.eylem === "cikar"));
  // RİSK: sabah montu çıkarıp akşam üşümek bu özelliğin çözmesi gereken şey.
  test("akşam geri giyme uyarısı var", plan.adimlar.some((a) => a.eylem === "ekle"));
}

{
  // RİSK: küçük farkta da uyarı vermek, her gün "katman çıkar" demek olur ve
  // uyarıyı anlamsızlaştırır.
  const s = [saat(8, 20), saat(12, 22), saat(16, 23), saat(20, 21)];
  esit("küçük farkta plan yok", katmanPlani(s), null);
}

{
  const s = [saat(8, 20), saat(12, 21), saat(16, 19, { rainChance: 80 }), saat(20, 14)];
  const plan = katmanPlani(s);
  test("yağış adımı ekleniyor", plan?.adimlar.some((a) => a.eylem === "yagis"));
}

esit("yetersiz veriyle plan yok", katmanPlani([saat(8, 10), saat(9, 25)]), null);
esit("boş veriyle plan yok", katmanPlani([]), null);

{
  // RİSK — cihazda yakalandı: pencere sabit saat sayısıyla alınınca gece
  // yarısını aşıyor, ertesi gecenin 02:00'si "en düşük" seçiliyor ve sabah
  // açan kullanıcıya "yanına katman al" deniyordu. Oysa o gün asıl olay
  // öğleden sonra 32°'ye ISINMASI. Pencere günün kalanı olmalı.
  const ertesi = (h, temp) => ({ time: `2026-08-26T${String(h).padStart(2, "0")}:00`, temp, code: 0, rainChance: 0 });
  const s = [saat(9, 23), saat(12, 28), saat(16, 32), saat(20, 25), saat(23, 22), ertesi(2, 21), ertesi(5, 21)];
  const plan = katmanPlani(s);
  esit("gün içi kapsamı seçiliyor", plan.kapsam, "gunIci");
  esit("en düşük ertesi güne kaymıyor", plan.enDusuk.saat, "23:00");
  esit("en yüksek bugünün zirvesi", plan.enYuksek.saat, "16:00");
  // Asıl hata buydu: akşam serinliği yüzünden ısınma hiç görülmüyordu.
  test("ısınma adımı üretiliyor", plan.adimlar.some((a) => a.eylem === "cikar"));
  test("akşam geri giyme adımı da var", plan.adimlar.some((a) => a.eylem === "ekle"));
  esit("zirve adımı 16:00", plan.adimlar.find((a) => a.eylem === "cikar").saat, "16:00");
}

{
  // Karar HİSSEDİLENE göre. Çıplak sıcaklık 5° düşmüyor ama rüzgar
  // yüzünden hissedilen düşüyor: katman uyarısı çıkmalı.
  const rzg = (h, temp, hissedilen) => ({ ...saat(h, temp), hissedilen });
  const s = [rzg(9, 20, 20), rzg(12, 19, 18), rzg(15, 18, 13), rzg(18, 17, 12)];
  const plan = katmanPlani(s);
  test("rüzgarlı düşüşte plan çıkıyor", plan !== null);
  test("katman ekleme adımı var", plan.adimlar.some((a) => a.eylem === "ekle"));
  // Gösterilen derece ÖLÇÜM olmalı, hissedilen değil.
  esit("gösterilen derece ölçüm", plan.adimlar.find((a) => a.eylem === "ekle").derece, 18);
}

{
  // Tersi: çıplak sıcaklık çok düşüyor ama hissedilen sabit — plan yok.
  const rzg = (h, temp, hissedilen) => ({ ...saat(h, temp), hissedilen });
  const s = [rzg(9, 25, 17), rzg(12, 22, 17), rzg(15, 19, 16), rzg(18, 18, 16)];
  esit("hissedilen sabitse plan yok", katmanPlani(s), null);
}

{
  // Salınım eşiği aşıyor ama kullanıcı günün ortasında açmış: ne anlamlı
  // ısınma ne anlamlı soğuma var. "Katman planla" deyip hiçbir adım
  // önermemektense kartı hiç göstermiyoruz.
  const s = [saat(13, 25), saat(15, 27), saat(17, 28), saat(20, 22)];
  esit("eylemsiz planda kart yok", katmanPlani(s), null);
}

{
  // Akşam açan kullanıcı: planlanacak "gün içi" kalmadı. Kartı yok saymak
  // yerine geceye bakıyoruz — o saatte doğru tavsiye "soğuyor, katman al".
  const ertesi = (h, temp) => ({ time: `2026-08-26T${String(h).padStart(2, "0")}:00`, temp, code: 0, rainChance: 0 });
  const s = [saat(21, 24), saat(22, 22), saat(23, 20), ertesi(1, 17), ertesi(4, 14), ertesi(7, 15)];
  const plan = katmanPlani(s);
  esit("gece kapsamına düşüyor", plan.kapsam, "gece");
  test("katman ekleme adımı var", plan.adimlar.some((a) => a.eylem === "ekle"));
  // RİSK: adımlar saat ETİKETİNE göre sıralanınca "04:00" "21:00"ın önüne
  // düşüyor ve zaman çizelgesi ters görünüyordu.
  const sirali = plan.adimlar.map((a) => a.iso);
  esit("adımlar kronolojik", JSON.stringify(sirali), JSON.stringify([...sirali].sort()));
  esit("ilk adım şu an", plan.adimlar[0].saat, "21:00");
}

// ---------------------------------------------------------------------------
bolum("Bavul asistanı");

const gun = (min, max, rain = 0) => ({ date: "2026-09-01", label: "Pzt", code: 0, min, max, rainChance: rain });

{
  const liste = bavulListesi([gun(18, 28), gun(19, 29), gun(17, 27)], GARDIROP);
  esit("gün sayısı", liste.gunSayisi, 3);
  esit("en düşük", liste.enDusuk, 17);
  esit("en yüksek", liste.enYuksek, 29);
  test("üst kalemi var", liste.kalemler.some((k) => k.katman === "ust"));
  // RİSK: sıcak seyahate mont koydurmak listeyi güvenilmez yapar.
  test("sıcak seyahatte dış giyim yok", !liste.kalemler.some((k) => k.katman === "dis"), JSON.stringify(liste.kalemler.map((k) => k.katman)));
}

{
  const liste = bavulListesi([gun(2, 8), gun(0, 6)], GARDIROP);
  test("soğuk seyahatte dış giyim var", liste.kalemler.some((k) => k.katman === "dis"));
  test("soğukta aksesuar hatırlatması", liste.ekstralar.some((e) => /Atkı/.test(e)));
}

{
  const liste = bavulListesi([gun(15, 20, 70), gun(14, 19, 80)], GARDIROP);
  esit("yağışlı gün sayısı", liste.yagisliGun, 2);
  test("yağış hatırlatması var", liste.ekstralar.some((e) => /yağış/i.test(e)));
}

{
  const liste = bavulListesi([gun(18, 28)], []);
  test("boş gardırop bildiriliyor", liste.gardiropBos === true);
  test("gardıropsuz da kalem listesi var", liste.kalemler.length > 0);
  test("eksik sayısı bildiriliyor", liste.kalemler.every((k) => k.eksik === k.adet));
}

esit("veri yoksa null", bavulListesi([], GARDIROP), null);

process.exit(ozet());
