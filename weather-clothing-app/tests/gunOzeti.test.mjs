// Sabah bildiriminin gün özeti testleri.
//
// Eski davranış YALNIZCA bildirimin saatine bakıyordu. Buradaki testlerin
// çoğu o hatanın geri gelmesini engellemek için var.

import { bolum, test, esit, ozet } from "./kosucu.mjs";

const {
  SALINIM_ESIGI,
  SABAH_GUN_SAYISI,
  sabahSaatleri,
  gunDilimi,
  yagisPenceresi,
  sicaklikProfili,
  yagisCumlesi,
  salinimCumlesi,
  sabahOzetMetni,
} = await import("../src/logic/gunOzeti.js");

// Saat üretici. gun: "2026-08-28" varsayılan.
const s = (saat, temp, ek = {}) => ({
  time: `${ek.gun ?? "2026-08-28"}T${String(saat).padStart(2, "0")}:00`,
  temp,
  hissedilen: ek.hissedilen ?? temp,
  code: ek.code ?? 0,
  rainChance: ek.rainChance ?? 0,
  yagisMm: ek.yagisMm ?? 0,
});

// ---------------------------------------------------------------------------
bolum("Gün dilimi");

{
  // Bildirim 08:00'de ateşleniyor; dilim o saatten GÜN SONUNA kadar olmalı.
  const saatler = [
    s(6, 10), s(7, 11), s(8, 12), s(14, 26), s(23, 15),
    s(2, 13, { gun: "2026-08-29" }), s(9, 20, { gun: "2026-08-29" }),
  ];
  const d = gunDilimi(saatler, "2026-08-28T08:00");
  esit("dilim 08:00'de başlıyor", d[0].time, "2026-08-28T08:00");
  esit("yarın dışarıda", d.length, 3);
  esit("son saat bugünün", d[d.length - 1].time, "2026-08-28T23:00");
}

esit("boş seride boş dilim", gunDilimi([], "x").length, 0);
esit("null seride boş dilim", gunDilimi(null, "x").length, 0);
esit("bulunmayan başlangıçta boş dilim", gunDilimi([s(8, 12)], "yok").length, 0);

{
  // Başlangıç verilmezse baştan alıyor.
  const d = gunDilimi([s(8, 12), s(9, 14)], null);
  esit("başlangıçsız dilim baştan", d.length, 2);
}

// ---------------------------------------------------------------------------
bolum("Sıcaklık profili");

{
  const d = [s(8, 12), s(12, 20), s(15, 26), s(20, 18)];
  const p = sicaklikProfili(d);
  esit("başlangıç saati", p.baslangic.saat, "08:00");
  esit("başlangıç derecesi", p.baslangic.hissedilen, 12);
  esit("en sıcak saat", p.enSicak.saat, "15:00");
  esit("en sıcak derece", p.enSicak.hissedilen, 26);
  esit("en soğuk derece", p.enSoguk.hissedilen, 12);
  // Salınım ÇIKIŞTAN itibaren ne kadar ısınacağı — gün min'i değil.
  esit("salınım çıkışa göre", p.salinim, 14);
}

{
  // Karar hissedilene göre; çıplak sıcaklık değil.
  const d = [s(8, 18, { hissedilen: 11 }), s(15, 20, { hissedilen: 19 })];
  const p = sicaklikProfili(d);
  esit("profil hissedileni kullanıyor", p.baslangic.hissedilen, 11);
}

{
  // Kişisel kayma hem başlangıca hem tepeye uygulanıyor; salınım değişmiyor.
  const d = [s(8, 12), s(15, 22)];
  const p = sicaklikProfili(d, -4);
  esit("kayma başlangıca uygulanıyor", p.baslangic.hissedilen, 8);
  esit("kayma tepeye uygulanıyor", p.enSicak.hissedilen, 18);
  esit("salınım kaymadan etkilenmiyor", p.salinim, 10);
}

esit("boş dilimde profil yok", sicaklikProfili([]), null);

// ---------------------------------------------------------------------------
bolum("Yağış penceresi");

{
  // ASIL EKSİK: 08:00 kuru ama 14:00'te yağmur var. Eski kod bunu hiç
  // görmüyordu ve sabah bildirimi şemsiyeden söz etmiyordu.
  const d = [s(8, 20), s(12, 24), s(14, 22, { yagisMm: 2.2, rainChance: 80, code: 63 }), s(18, 20)];
  const p = yagisPenceresi(d);
  test("öğleden sonraki yağış yakalanıyor", p !== null);
  esit("başlangıç saati", p.basla, "14:00");
  esit("tek saatte bitiş yok", p.bitir, null);
  esit("miktar", p.mm, 2.2);
}

{
  const d = [
    s(8, 20),
    s(13, 21, { yagisMm: 1.0, rainChance: 70, code: 61 }),
    s(14, 21, { yagisMm: 2.0, rainChance: 80, code: 63 }),
    s(19, 19),
  ];
  const p = yagisPenceresi(d);
  esit("pencere sonu", p.bitir, "14:00");
  esit("toplam miktar", p.mm, 3);
}

{
  // Çisenti şemsiye gerektirmiyor: yalnız ihtimal yüksek diye uyarmıyoruz.
  const d = [s(8, 20), s(14, 21, { yagisMm: 0.1, rainChance: 90, code: 51 })];
  esit("çisentide pencere yok", yagisPenceresi(d), null);
}

{
  // Miktar kesin eşiğin üstündeyse ihtimale bakmıyoruz.
  const d = [s(8, 20), s(14, 21, { yagisMm: 2.0, rainChance: 10, code: 63 })];
  test("yüksek miktar düşük ihtimalde de sayılıyor", yagisPenceresi(d) !== null);
}

{
  const d = [s(8, 0), s(14, -1, { yagisMm: 3, rainChance: 80, code: 73 })];
  esit("kar işaretleniyor", yagisPenceresi(d).kar, true);
}

esit("kuru günde pencere yok", yagisPenceresi([s(8, 20), s(15, 25)]), null);
esit("boş dilimde pencere yok", yagisPenceresi([]), null);

// ---------------------------------------------------------------------------
bolum("Cümleler");

esit(
  "tek saatlik yağmurda 'civarı'",
  yagisCumlesi({ basla: "14:00", bitir: null, mm: 2, kar: false }),
  "14:00 civarı yağmur var, şemsiyeni al."
);
esit(
  "aralıklı yağmurda tire",
  yagisCumlesi({ basla: "13:00", bitir: "16:00", mm: 4, kar: false }),
  "13:00–16:00 arası yağmur var, şemsiyeni al."
);
esit(
  "az yağışta şemsiye denmiyor",
  yagisCumlesi({ basla: "14:00", bitir: null, mm: 0.5, kar: false }),
  "14:00 civarı hafif yağmur olabilir."
);
esit(
  "karda kaymaz ayakkabı",
  yagisCumlesi({ basla: "07:00", bitir: null, mm: 3, kar: true }),
  "07:00 civarı kar var, kaymaz ayakkabı giy."
);
esit("pencere yoksa cümle yok", yagisCumlesi(null), null);

{
  const az = sicaklikProfili([s(8, 20), s(15, 23)]);
  esit("küçük salınımda cümle yok", salinimCumlesi(az), null);
  const cok = sicaklikProfili([s(8, 12), s(15, 12 + SALINIM_ESIGI)]);
  test("eşikte cümle var", salinimCumlesi(cok) !== null);
  test("cümle tepeyi söylüyor", salinimCumlesi(cok).includes(`${12 + SALINIM_ESIGI}°`));
}

// ---------------------------------------------------------------------------
bolum("Sabah özeti metni");

{
  // ASIL HATA: eskiden başlık "Bugün 12°" idi ve 26°'ye çıktığı
  // söylenmiyordu; kullanıcı fazla giyiniyordu.
  const d = [s(8, 12), s(12, 20), s(15, 26), s(20, 18)];
  const m = sabahOzetMetni(d, { emoji: "⛅", durum: "parçalı bulutlu" });
  esit("başlıkta aralık var", m.baslik, "Bugün 12° → 26° ⛅");
  test("gövde çıkış önerisi içeriyor", m.govde.includes("Çıkarken"));
  test("gövde salınımı söylüyor", m.govde.includes("26°"));
}

{
  // Sabit günde aralık yerine durum yazılıyor.
  const d = [s(8, 22), s(15, 23)];
  const m = sabahOzetMetni(d, { emoji: "☀️", durum: "açık" });
  esit("sabit günde durum başlığı", m.baslik, "Bugün 22° ve açık ☀️");
  test("başlıkta ok yok", !m.baslik.includes("→"));
}

{
  // Yağış varsa salınım cümlesinin YERİNE geçiyor: şemsiye daha kritik ve
  // üç cümle bildirim gölgesinde kırpılıyor.
  const d = [s(8, 12), s(14, 22, { yagisMm: 3, rainChance: 80, code: 63 }), s(16, 24)];
  const m = sabahOzetMetni(d, { emoji: "🌧️", durum: "yağmurlu" });
  test("gövde şemsiyeyi söylüyor", m.govde.includes("şemsiye"));
  test("yağış varken salınım cümlesi yok", !m.govde.includes("çıkarabileceğin"));
  test("gövde en fazla iki cümle", m.govde.split(". ").length <= 2);
}

{
  // Gardırop önerisi varsa onu kullanıyor — en somut bilgi.
  const d = [s(8, 12), s(15, 26)];
  const m = sabahOzetMetni(d, { kombinBasligi: "Kot + gri sweatshirt" });
  test("kombin gövdede", m.govde.startsWith("Kot + gri sweatshirt"));
  test("kombin varken de yağış/salınım ekleniyor", m.govde.includes("26°"));
}

{
  // Kişisel kayma başlığa yansıyor.
  const d = [s(8, 12), s(15, 26)];
  const m = sabahOzetMetni(d, { kayma: -3, emoji: "⛅", durum: "bulutlu" });
  esit("kayma başlıkta", m.baslik, "Bugün 9° → 23° ⛅");
}

esit("boş dilimde metin yok", sabahOzetMetni([]), null);

{
  // Emoji/durum verilmezse başlık kekelememeli (boşluk artığı olmamalı).
  const m = sabahOzetMetni([s(8, 22)], {});
  test("başlık sonunda boşluk yok", m.baslik === m.baslik.trim());
  test("çift boşluk yok", !m.baslik.includes("  "));
}

// ---------------------------------------------------------------------------
bolum("Çok günlü sabah planlaması");

// 10 günlük saatlik seri üretir (her gün 00:00–23:00).
const cokGun = (gunSayisi = 10, bas = "2026-08-28") => {
  const out = [];
  const [Y, M, D] = bas.split("-").map(Number);
  for (let g = 0; g < gunSayisi; g++) {
    const d = new Date(Y, M - 1, D + g);
    const gun = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    for (let h = 0; h < 24; h++) out.push(s(h, 15 + (h % 12), { gun }));
  }
  return out;
};

{
  // Bugün saat 14:00; bu sabahın 08:00'i geçmiş, atlanmalı.
  const simdi = new Date("2026-08-28T14:00").getTime();
  const h = sabahSaatleri(cokGun(), 8, simdi);
  esit("bir haftalık planlanıyor", h.length, SABAH_GUN_SAYISI);
  esit("geçmiş sabah atlanıyor", h[0].time, "2026-08-29T08:00");
  esit("her kayıt sabah saati", h.every((x) => x.time.slice(11) === "08:00"), true);
  esit("günler benzersiz", new Set(h.map((x) => x.time.slice(0, 10))).size, SABAH_GUN_SAYISI);
}

{
  // Bugün saat 06:00; bu sabahın 08:00'i HENÜZ gelmedi, dahil olmalı.
  const simdi = new Date("2026-08-28T06:00").getTime();
  const h = sabahSaatleri(cokGun(), 8, simdi);
  esit("bugünün sabahı dahil", h[0].time, "2026-08-28T08:00");
}

{
  // Seri kısaysa olan kadarını planlıyoruz, uydurmuyoruz.
  const simdi = new Date("2026-08-28T06:00").getTime();
  const h = sabahSaatleri(cokGun(3), 8, simdi);
  esit("kısa seride 3 gün", h.length, 3);
}

esit("boş seride plan yok", sabahSaatleri([], 8, Date.now()).length, 0);
esit("null seride plan yok", sabahSaatleri(null, 8, Date.now()).length, 0);

{
  // Farklı sabah saati ayarı.
  const simdi = new Date("2026-08-28T00:30").getTime();
  const h = sabahSaatleri(cokGun(), 6, simdi);
  esit("06:00 ayarı", h[0].time, "2026-08-28T06:00");
}

{
  // Her sabahın metni KENDİ gününü anlatmalı — asıl düzeltme bu.
  const simdi = new Date("2026-08-28T14:00").getTime();
  const seri = cokGun();
  const h = sabahSaatleri(seri, 8, simdi);
  const metinler = h.map((x) => sabahOzetMetni(gunDilimi(seri, x.time), {}));
  test("her gün metin üretiliyor", metinler.every((m) => m && m.baslik));
  const gunler = h.map((x) => gunDilimi(seri, x.time)[0].time.slice(0, 10));
  esit("her metin ayrı güne ait", new Set(gunler).size, SABAH_GUN_SAYISI);
}

process.exit(ozet());
