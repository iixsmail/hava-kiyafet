import { DatabaseSync } from "node:sqlite";

// Kredi sayacı SUNUCUDA tutuluyor. İstemcide tutulsaydı uygulamayı kurcalayan
// biri sayacı sıfırlayıp sınırsız istek atabilirdi — fatura bize gelirdi.
//
// İki ayrı sayaç, iki ayrı pencere:
//   kombin  -> GÜNLÜK  (her gün yenilenir)
//   etiket  -> AYLIK   (her ay yenilenir)
// İkisi de "sonsuza kadar toplam" değil; kullanıcı gardırobunu zamanla
// büyütebilsin ve bir kez limiti dolduran kalıcı olarak kilitlenmesin diye.

const db = new DatabaseSync(process.env.DB_YOLU ?? "krediler.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS krediler (
    cihaz          TEXT PRIMARY KEY,
    kombinSayac    INTEGER NOT NULL DEFAULT 0,
    kombinPencere  TEXT    NOT NULL DEFAULT '',
    etiketSayac    INTEGER NOT NULL DEFAULT 0,
    etiketPencere  TEXT    NOT NULL DEFAULT '',
    guncellendi    INTEGER NOT NULL DEFAULT 0
  );
`);

// Eski şemadan (etiketToplam, penceresiz) geçiş. Sütun zaten varsa ALTER
// hata verir; sessizce yutuyoruz çünkü "zaten göç etmiş" demek.
for (const sql of [
  "ALTER TABLE krediler ADD COLUMN etiketSayac INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE krediler ADD COLUMN etiketPencere TEXT NOT NULL DEFAULT ''",
]) {
  try {
    db.exec(sql);
  } catch {
    /* sütun zaten var */
  }
}

/**
 * "Sınırsız" demek yerine yüksek ama SONLU bir tavan: tek bir kötü niyetli
 * hesap ölçümlü bir API'de ciddi fatura çıkarabilir. Mağaza metninde de
 * "adil kullanım" demek, "sınırsız" deyip sınırlamaktan güvenli.
 */
export const LIMITLER = {
  ucretsiz: {
    kombin: 1,
    kombinBirim: "gun" as const,
    etiket: 20,
    etiketBirim: "ay" as const,
  },
  premium: {
    kombin: 20,
    kombinBirim: "gun" as const,
    etiket: 500,
    etiketBirim: "ay" as const,
  },
};

export type Birim = "ay" | "gun";

// Pencere anahtarı UTC üzerinden üretiliyor: sunucu saat dilimi değişse bile
// (konteyner taşıma, yaz saati) sayaç beklenmedik şekilde sıfırlanmasın.
function pencere(birim: Birim): string {
  const d = new Date();
  const ay = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return birim === "ay" ? ay : `${ay}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function satirAl(cihaz: string) {
  const mevcut = db.prepare("SELECT * FROM krediler WHERE cihaz = ?").get(cihaz) as any;
  if (mevcut) return mevcut;
  db.prepare("INSERT INTO krediler (cihaz, guncellendi) VALUES (?, ?)").run(cihaz, Date.now());
  return db.prepare("SELECT * FROM krediler WHERE cihaz = ?").get(cihaz) as any;
}

function limitler(premium: boolean) {
  return premium ? LIMITLER.premium : LIMITLER.ucretsiz;
}

// Pencere değiştiyse kullanılan sayı sıfırdan başlar. Kaydı burada
// güncellemiyoruz — yalnızca harcama anında yazıyoruz ki okuma ucuz kalsın.
function kullanilan(satirDeger: number, satirPencere: string, birim: Birim) {
  return satirPencere === pencere(birim) ? satirDeger : 0;
}

export type KrediDurumu = {
  premium: boolean;
  odul: number;
  kombinKalan: number;
  kombinLimit: number;
  kombinBirim: Birim;
  etiketKalan: number;
  etiketLimit: number;
  etiketBirim: Birim;
};

export function durum(cihaz: string, premium: boolean): KrediDurumu {
  const l = limitler(premium);
  const s = satirAl(cihaz);
  // Ödülle kazanılan haklar günlük tavanın ÜSTÜNE ekleniyor.
  const odul = s.odulPencere === pencere("gun") ? s.odulKombin : 0;
  return {
    premium,
    odul,
    kombinKalan: Math.max(
      0,
      l.kombin + odul - kullanilan(s.kombinSayac, s.kombinPencere, l.kombinBirim)
    ),
    kombinLimit: l.kombin + odul,
    kombinBirim: l.kombinBirim,
    etiketKalan: Math.max(0, l.etiket - kullanilan(s.etiketSayac, s.etiketPencere, l.etiketBirim)),
    etiketLimit: l.etiket,
    etiketBirim: l.etiketBirim,
  };
}

/** Kombin kredisi harcar. Kredi yoksa false döner ve hiçbir şey değişmez. */
export function kombinHarca(cihaz: string, premium: boolean): boolean {
  const l = limitler(premium);
  const s = satirAl(cihaz);
  const su = pencere(l.kombinBirim);
  const k = kullanilan(s.kombinSayac, s.kombinPencere, l.kombinBirim);
  const odul = s.odulPencere === pencere("gun") ? s.odulKombin : 0;
  if (k >= l.kombin + odul) return false;
  db.prepare(
    "UPDATE krediler SET kombinSayac = ?, kombinPencere = ?, guncellendi = ? WHERE cihaz = ?"
  ).run(k + 1, su, Date.now(), cihaz);
  return true;
}

/** Etiketleme kredisi harcar (parça başına bir kez). */
export function etiketHarca(cihaz: string, premium: boolean): boolean {
  const l = limitler(premium);
  const s = satirAl(cihaz);
  const su = pencere(l.etiketBirim);
  const k = kullanilan(s.etiketSayac, s.etiketPencere, l.etiketBirim);
  if (k >= l.etiket) return false;
  db.prepare(
    "UPDATE krediler SET etiketSayac = ?, etiketPencere = ?, guncellendi = ? WHERE cihaz = ?"
  ).run(k + 1, su, Date.now(), cihaz);
  return true;
}

// --- İade ---------------------------------------------------------------
// Model çağrısı başarısız olursa harcanan kredi geri verilir: kullanıcı,
// bizim tarafımızdaki bir hata yüzünden hakkını kaybetmemeli.
//
// Pencere kontrolü şart: gece yarısını geçen bir istekte pencere dönmüş
// olabilir; o durumda sayaç zaten sıfırlanmıştır ve düşürmek onu negatife
// (yani bir sonraki pencerede fazladan hak) çevirirdi.

function iade(cihaz: string, sayacAlan: string, pencereAlan: string, birim: Birim) {
  const s = satirAl(cihaz);
  if (s[pencereAlan] !== pencere(birim)) return;
  if (s[sayacAlan] <= 0) return;
  db.prepare(`UPDATE krediler SET ${sayacAlan} = ? WHERE cihaz = ?`).run(
    s[sayacAlan] - 1,
    cihaz
  );
}

export function kombinIadeEt(cihaz: string, premium: boolean): void {
  iade(cihaz, "kombinSayac", "kombinPencere", limitler(premium).kombinBirim);
}

export function etiketIadeEt(cihaz: string, premium: boolean): void {
  iade(cihaz, "etiketSayac", "etiketPencere", limitler(premium).etiketBirim);
}

// --- Ödüllü reklam kredisi -------------------------------------------------
// Ödüllü reklamla kazanılan ekstra haklar AYRI bir sütunda tutuluyor.
// Sayacı azaltarak vermek yerine ayrı tutmanın sebebi: pencere döndüğünde
// (ertesi gün) ödül hakkı da sıfırlanmalı, ama ödülün limiti aşmasına da
// izin verilmeli. Tek sayaçta ikisini ayırt edemezdik.

try {
  db.exec("ALTER TABLE krediler ADD COLUMN odulKombin INTEGER NOT NULL DEFAULT 0");
} catch {
  /* sütun zaten var */
}
try {
  db.exec("ALTER TABLE krediler ADD COLUMN odulPencere TEXT NOT NULL DEFAULT ''");
} catch {
  /* sütun zaten var */
}

// Günde kazanılabilecek en fazla ödül. Sınırsız olsaydı kullanıcı gün boyu
// reklam izleyip API kotamızı tüketebilirdi — reklam geliri o maliyeti
// karşılamaz.
export const GUNLUK_AZAMI_ODUL = 3;

/** Ödüllü reklam sonrası +1 kombin hakkı. Günlük tavan aşılırsa false. */
export function odulEkle(cihaz: string): boolean {
  const s = satirAl(cihaz);
  const su = pencere("gun");
  const mevcut = s.odulPencere === su ? s.odulKombin : 0;
  if (mevcut >= GUNLUK_AZAMI_ODUL) return false;
  db.prepare(
    "UPDATE krediler SET odulKombin = ?, odulPencere = ?, guncellendi = ? WHERE cihaz = ?"
  ).run(mevcut + 1, su, Date.now(), cihaz);
  return true;
}

/** O gün ödülle kazanılmış hak sayısı. */
export function odulSayisi(cihaz: string): number {
  const s = satirAl(cihaz);
  return s.odulPencere === pencere("gun") ? s.odulKombin : 0;
}
