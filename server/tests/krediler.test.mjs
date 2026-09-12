// Kredi motoru testleri.
//
// Bu katman parayı ve kotayı yönetiyor: bir hata ya kullanıcının hakkını
// yer ya bizim faturamızı şişirir. Her test somut bir riski kapatıyor.

import { rmSync } from "node:fs";
import { bolum, test, esit, ozet } from "./kosucu.mjs";

// Her koşuda temiz veritabanı — testler birbirini kirletmesin.
const DB = "/tmp/kredi-test.db";
rmSync(DB, { force: true });
process.env.DB_YOLU = DB;

const k = await import("../src/credits.ts");

const CIHAZ = "test-cihaz";

// ---------------------------------------------------------------------------
bolum("Başlangıç limitleri");

{
  const u = k.durum(CIHAZ, false);
  esit("ücretsiz kombin limiti", u.kombinLimit, 1);
  esit("ücretsiz kombin penceresi", u.kombinBirim, "gun");
  esit("ücretsiz etiket limiti", u.etiketLimit, 20);
  esit("ücretsiz etiket penceresi", u.etiketBirim, "ay");
  esit("başlangıçta hepsi kullanılabilir", u.kombinKalan, 1);
}

{
  const p = k.durum(CIHAZ, true);
  esit("premium kombin limiti", p.kombinLimit, 20);
  esit("premium etiket limiti", p.etiketLimit, 500);
}

// ---------------------------------------------------------------------------
bolum("Harcama ve tükenme");

{
  const c = "tuketim-1";
  esit("ilk harcama başarılı", k.kombinHarca(c, false), true);
  esit("harcama sonrası kalan 0", k.durum(c, false).kombinKalan, 0);
  // RİSK: limit aşımı engellenmezse ücretsiz kullanıcı sınırsız istek atar.
  esit("limit aşımı reddediliyor", k.kombinHarca(c, false), false);
  esit("reddedilen harcama sayacı bozmuyor", k.durum(c, false).kombinKalan, 0);
}

{
  const c = "tuketim-2";
  for (let i = 0; i < 20; i++) k.etiketHarca(c, false);
  esit("20 etiketten sonra kalan 0", k.durum(c, false).etiketKalan, 0);
  esit("21. etiket reddediliyor", k.etiketHarca(c, false), false);
}

// ---------------------------------------------------------------------------
bolum("İade (rollback)");

{
  const c = "iade-1";
  k.kombinHarca(c, false);
  esit("harcandı", k.durum(c, false).kombinKalan, 0);
  // RİSK: model çağrısı bizim tarafımızdaki bir hatayla düşerse kullanıcı
  // hakkını kaybetmemeli.
  k.kombinIadeEt(c, false);
  esit("iade sonrası hak geri geldi", k.durum(c, false).kombinKalan, 1);
}

{
  const c = "iade-2";
  // RİSK: hiç harcanmamışken iade, sayacı negatife çevirip fazladan hak verir.
  k.kombinIadeEt(c, false);
  esit("harcanmadan iade hak yaratmıyor", k.durum(c, false).kombinKalan, 1);
  k.kombinIadeEt(c, false);
  k.kombinIadeEt(c, false);
  esit("tekrarlı iade de yaratmıyor", k.durum(c, false).kombinKalan, 1);
}

{
  const c = "iade-3";
  k.etiketHarca(c, false);
  k.etiketHarca(c, false);
  k.etiketIadeEt(c, false);
  esit("etiket iadesi tek birim", k.durum(c, false).etiketKalan, 19);
}

// ---------------------------------------------------------------------------
bolum("Pencere dönüşü");

{
  // RİSK: pencere döndüğünde sayaç sıfırlanmazsa kullanıcı bir daha asla
  // kombin alamaz.
  const c = "pencere-1";
  k.kombinHarca(c, false);
  esit("harcandı", k.durum(c, false).kombinKalan, 0);

  // Sayacı dünkü pencereye taşı (veritabanına doğrudan dokunmadan test
  // edemiyoruz; pencere anahtarı UTC tarihinden üretiliyor).
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(DB);
  db.prepare("UPDATE krediler SET kombinPencere = ? WHERE cihaz = ?").run("2020-01-01", c);

  esit("yeni pencerede hak yenilendi", k.durum(c, false).kombinKalan, 1);
  esit("yeni pencerede harcama yapılabiliyor", k.kombinHarca(c, false), true);
}

{
  // RİSK: gece yarısını geçen bir istekte pencere dönmüşse, iade sayacı
  // negatife çevirip ERTESİ GÜNE fazladan hak verir.
  const c = "pencere-2";
  k.kombinHarca(c, false);
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(DB);
  db.prepare("UPDATE krediler SET kombinPencere = ? WHERE cihaz = ?").run("2020-01-01", c);

  k.kombinIadeEt(c, false);
  esit("eski pencereye iade fazladan hak vermiyor", k.durum(c, false).kombinKalan, 1);
}

// ---------------------------------------------------------------------------
bolum("Premium / ücretsiz ayrımı");

{
  const c = "plan-1";
  // Ücretsiz hakkını tüket
  k.kombinHarca(c, false);
  esit("ücretsizken tükendi", k.durum(c, false).kombinKalan, 0);
  // RİSK: premium'a geçen kullanıcı hâlâ ücretsiz limitte kalırsa parasını
  // ödeyip "hakkın doldu" ekranını görür.
  test("premium'a geçince hak açılıyor", k.durum(c, true).kombinKalan > 0, `kalan ${k.durum(c, true).kombinKalan}`);
  esit("premium harcaması kabul", k.kombinHarca(c, true), true);
}

{
  const c = "plan-2";
  // Aynı sayaç iki planda farklı yorumlanıyor; sayaç ortak, tavan farklı.
  k.kombinHarca(c, true);
  k.kombinHarca(c, true);
  esit("premium 2 harcama sonrası", k.durum(c, true).kombinKalan, 18);
  esit("aynı sayaç ücretsiz tavanla 0", k.durum(c, false).kombinKalan, 0);
}

// ---------------------------------------------------------------------------
bolum("Cihaz yalıtımı");

{
  // RİSK: sayaçlar cihaz bazında ayrılmazsa bir kullanıcının harcaması
  // diğerinin hakkını yer.
  const a = "yalitim-a";
  const b = "yalitim-b";
  k.kombinHarca(a, false);
  esit("a tükendi", k.durum(a, false).kombinKalan, 0);
  esit("b etkilenmedi", k.durum(b, false).kombinKalan, 1);
}

// ---------------------------------------------------------------------------
bolum("Ödüllü reklam kredisi");

{
  const c = "odul-1";
  // Ücretsiz kullanıcı günlük hakkını tüketiyor
  k.kombinHarca(c, false);
  esit("hak tükendi", k.durum(c, false).kombinKalan, 0);

  // RİSK: ödül limiti aşamıyorsa reklam izlemenin anlamı kalmaz.
  esit("ödül eklendi", k.odulEkle(c), true);
  esit("ödül sonrası hak açıldı", k.durum(c, false).kombinKalan, 1);
  esit("ödülle harcama yapılabiliyor", k.kombinHarca(c, false), true);
  esit("tekrar tükendi", k.durum(c, false).kombinKalan, 0);
}

{
  const c = "odul-2";
  // RİSK: sınırsız ödül, kullanıcının gün boyu reklam izleyip API kotamızı
  // tüketmesine yol açar — reklam geliri o maliyeti karşılamaz.
  for (let i = 0; i < k.GUNLUK_AZAMI_ODUL; i++) {
    esit(`${i + 1}. ödül kabul`, k.odulEkle(c), true);
  }
  esit("tavan aşılmıyor", k.odulEkle(c), false);
  esit("ödül sayısı tavanda", k.odulSayisi(c), k.GUNLUK_AZAMI_ODUL);
}

{
  const c = "odul-3";
  k.odulEkle(c);
  esit("ödül limite ekleniyor", k.durum(c, false).kombinLimit, 1 + 1);
  esit("durum ödül sayısını bildiriyor", k.durum(c, false).odul, 1);
}

{
  // RİSK: pencere dönünce ödül de sıfırlanmalı; yoksa dünkü ödüller
  // sonsuza kadar birikir.
  const c = "odul-4";
  k.odulEkle(c);
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(DB);
  db.prepare("UPDATE krediler SET odulPencere = ? WHERE cihaz = ?").run("2020-01-01", c);
  esit("eski pencerenin ödülü sayılmıyor", k.odulSayisi(c), 0);
  esit("limit temel değere döndü", k.durum(c, false).kombinLimit, 1);
}

// ---------------------------------------------------------------------------
bolum("SSV imza doğrulama");

{
  const { ssvDogrula, islemYeniMi } = await import("../src/reward.ts");

  // RİSK: imza doğrulanmadan kredi verilirse, uç noktanın adresini bilen
  // herkes sınırsız kredi üretir.
  test("imzasız istek reddediliyor", (await ssvDogrula("user_id=x&reward_amount=1")) === false);
  test("uydurma imza reddediliyor", (await ssvDogrula("user_id=x&signature=sahte&key_id=1")) === false);
  test("boş sorgu reddediliyor", (await ssvDogrula("")) === false);

  // RİSK: Google ağ hatasında callback'i tekrar gönderiyor; tekilleştirmezsek
  // tek reklamdan iki kredi çıkar.
  esit("ilk işlem yeni", islemYeniMi("islem-abc"), true);
  esit("aynı işlem tekrar sayılmıyor", islemYeniMi("islem-abc"), false);
  esit("farklı işlem yeni", islemYeniMi("islem-xyz"), true);
}

process.exit(ozet());
