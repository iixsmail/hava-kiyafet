// Gardırobun cihazdaki kalıcı deposu — SQLite + dosya sistemi.
//
// İki parça halinde tutuluyor:
//   - Görseller: uygulamanın belge klasöründe (gardirop/) gerçek dosya olarak
//   - Kayıtlar:  SQLite tablosunda
//
// Görselleri neden veritabanına koymuyoruz: her okumada tamamı belleğe
// açılırdı ve 30 fotoğraflık bir gardırop onlarca MB eder. Dosyalar diskte,
// tablo küçük ve sorgulanabilir kalıyor.
//
// Kayıtta MUTLAK URI değil, yalnızca DOSYA ADI saklanıyor. Belge klasörünün
// tam yolu uygulama güncellemeleri arasında değişebiliyor; mutlak URI
// saklarsak güncellemeden sonra bütün fotoğraflar "kayıp" görünür.
//
// Neden AsyncStorage değil SQLite: AsyncStorage tek bir JSON dizisi tutuyordu
// ve her ekleme/silme tüm gardırobu okuyup yeniden yazıyordu. SQLite'ta
// katmana göre filtreleme, sıralama ve tek satır güncelleme O(1)'e yakın;
// ayrıca yarım kalan bir yazma tüm listeyi bozamıyor.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";
import * as SQLite from "expo-sqlite";

const KLASOR_ADI = "gardirop";
const VT_ADI = "gardirop.db";
const ESKI_INDEKS = "gardirop.v1"; // AsyncStorage'daki eski depo

let _vt = null;

function vt() {
  if (_vt) return _vt;
  _vt = SQLite.openDatabaseSync(VT_ADI);

  _vt.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS parcalar (
      id          TEXT PRIMARY KEY NOT NULL,
      dosya       TEXT NOT NULL,
      ad          TEXT,
      tur         TEXT,
      katman      TEXT,
      kumas       TEXT,
      minC        REAL,
      maxC        REAL,
      renk        TEXT,
      desen       TEXT,
      suGecirmez  INTEGER NOT NULL DEFAULT 0,
      resmiyet    TEXT,
      etiketlendi INTEGER NOT NULL DEFAULT 0,
      eklendi     INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS parcalar_katman ON parcalar (katman);
    CREATE INDEX IF NOT EXISTS parcalar_eklendi ON parcalar (eklendi DESC);
  `);

  return _vt;
}

function klasor() {
  const d = new Directory(Paths.document, KLASOR_ADI);
  if (!d.exists) d.create({ intermediates: true });
  return d;
}

// SQLite'ta boolean yok; 0/1 saklanıp okurken geri çevriliyor.
function satirdanKayit(s) {
  if (!s) return null;
  return {
    ...s,
    suGecirmez: s.suGecirmez === 1,
    etiketlendi: s.etiketlendi === 1,
  };
}

/** Kayıttaki dosya adından o anki geçerli mutlak URI'yi üretir. */
export function gorselUri(kayit) {
  if (!kayit?.dosya) return null;
  return new File(Paths.document, KLASOR_ADI, kayit.dosya).uri;
}

// --- AsyncStorage'dan tek seferlik göç ------------------------------------
// Uygulamanın önceki sürümü gardırobu AsyncStorage'da tutuyordu. Kullanıcı
// güncellediğinde parçaları kaybetmesin diye bir kez içeri aktarıyoruz.
// Görsel dosyaları zaten aynı klasörde duruyor, yalnızca kayıtlar taşınıyor.
let gocDenendi = false;

async function eskiDepodanGocEt() {
  if (gocDenendi) return;
  gocDenendi = true;
  try {
    const ham = await AsyncStorage.getItem(ESKI_INDEKS);
    if (!ham) return;

    const liste = JSON.parse(ham);
    if (!Array.isArray(liste) || liste.length === 0) {
      await AsyncStorage.removeItem(ESKI_INDEKS);
      return;
    }

    const d = vt();
    d.withTransactionSync(() => {
      for (const k of liste) {
        if (!k?.id || !k?.dosya) continue;
        d.runSync(
          `INSERT OR IGNORE INTO parcalar
             (id, dosya, ad, tur, katman, kumas, minC, maxC, renk, desen, suGecirmez, resmiyet, etiketlendi, eklendi)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            k.id,
            k.dosya,
            k.ad ?? null,
            k.tur ?? null,
            k.katman ?? null,
            k.kumas ?? null,
            k.minC ?? null,
            k.maxC ?? null,
            k.renk ?? null,
            k.desen ?? null,
            k.suGecirmez ? 1 : 0,
            k.resmiyet ?? null,
            k.etiketlendi ? 1 : 0,
            k.eklendi ?? Date.now(),
          ]
        );
      }
    });

    // Göç başarılıysa eski anahtarı sil ki bir daha çalışmasın.
    await AsyncStorage.removeItem(ESKI_INDEKS);
    console.log(`Gardırop SQLite'a taşındı: ${liste.length} parça`);
  } catch (e) {
    console.log("Eski gardırop taşınamadı:", e?.message);
  }
}

export async function listele() {
  await eskiDepodanGocEt();

  const satirlar = vt().getAllSync("SELECT * FROM parcalar ORDER BY eklendi DESC");

  // Dosyası silinmiş kayıtları ayıkla (kullanıcı depolamayı temizlemiş olabilir)
  const saglam = [];
  const olu = [];
  for (const s of satirlar) {
    // Hazır katalogdan eklenen parçaların fotoğrafı YOK ve olmaması normal.
    // Bu kontrol boş dosya adını "kayıp fotoğraf" sayıp kaydı siliyordu:
    // katalog ekleme başarılı oluyor, hemen ardından gelen listele() çağrısı
    // altı parçayı da siliyordu. Hata da vermiyordu, çünkü bu temizlik
    // sessiz çalışacak şekilde tasarlanmış.
    if (!s.dosya) {
      saglam.push(s);
      continue;
    }
    try {
      if (new File(Paths.document, KLASOR_ADI, s.dosya).exists) saglam.push(s);
      else olu.push(s.id);
    } catch {
      olu.push(s.id);
    }
  }
  if (olu.length) {
    const d = vt();
    d.withTransactionSync(() => {
      for (const id of olu) d.runSync("DELETE FROM parcalar WHERE id = ?", [id]);
    });
  }

  return saglam.map(satirdanKayit);
}

/**
 * Hazır katalogdan FOTOĞRAFSIZ parçaları toplu ekler.
 *
 * `dosya` boş dizge kalıyor — sütun NOT NULL, ama `gorselUri()` zaten boş
 * `dosya` için null döndürüyor ve arayüz o durumda siluet çiziyor.
 *
 * Tek transaction: yarım kalmış bir ekleme, kullanıcıya "6 parça seçtim, 3'ü
 * geldi" gibi açıklanamaz bir sonuç bırakırdı.
 */
export function katalogEkle(parcalar) {
  const db = vt();
  const eklenenler = [];

  db.withTransactionSync(() => {
    for (const meta of parcalar) {
      const id = `kat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const kayit = {
        id,
        dosya: "",
        ad: meta.ad ?? "Parça",
        tur: meta.tur ?? null,
        katman: meta.katman ?? null,
        kumas: meta.kumas ?? null,
        minC: meta.minC ?? null,
        maxC: meta.maxC ?? null,
        renk: meta.renk ?? null,
        desen: meta.desen ?? null,
        suGecirmez: meta.suGecirmez ?? false,
        resmiyet: meta.resmiyet ?? null,
        etiketlendi: meta.etiketlendi ?? true,
        eklendi: Date.now(),
      };
      db.runSync(
        `INSERT INTO parcalar
           (id, dosya, ad, tur, katman, kumas, minC, maxC, renk, desen, suGecirmez, resmiyet, etiketlendi, eklendi)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          kayit.id, kayit.dosya, kayit.ad, kayit.tur, kayit.katman, kayit.kumas,
          kayit.minC, kayit.maxC, kayit.renk, kayit.desen,
          kayit.suGecirmez ? 1 : 0, kayit.resmiyet, kayit.etiketlendi ? 1 : 0, kayit.eklendi,
        ]
      );
      eklenenler.push(kayit);
    }
  });

  return eklenenler;
}

// Seçilen fotoğrafı kalıcı klasöre kopyalar ve kaydı ekler.
// kaynakUri: ImagePicker'dan gelen geçici dosya (cache'te, silinebilir)
export async function ekle(kaynakUri, meta = {}) {
  const d = klasor();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const uzanti = (kaynakUri.split(".").pop() || "jpg").split("?")[0].slice(0, 4);
  const dosya = `${id}.${uzanti}`;

  new File(kaynakUri).copy(new File(d, dosya));

  const kayit = {
    id,
    dosya,
    ad: meta.ad ?? "Yeni parça",
    tur: meta.tur ?? null,
    katman: meta.katman ?? null,
    kumas: meta.kumas ?? null,
    minC: meta.minC ?? null,
    maxC: meta.maxC ?? null,
    renk: meta.renk ?? null,
    desen: meta.desen ?? null,
    suGecirmez: meta.suGecirmez ?? false,
    resmiyet: meta.resmiyet ?? null,
    etiketlendi: meta.etiketlendi ?? false,
    eklendi: Date.now(),
  };

  vt().runSync(
    `INSERT INTO parcalar
       (id, dosya, ad, tur, katman, kumas, minC, maxC, renk, desen, suGecirmez, resmiyet, etiketlendi, eklendi)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      kayit.id,
      kayit.dosya,
      kayit.ad,
      kayit.tur,
      kayit.katman,
      kayit.kumas,
      kayit.minC,
      kayit.maxC,
      kayit.renk,
      kayit.desen,
      kayit.suGecirmez ? 1 : 0,
      kayit.resmiyet,
      kayit.etiketlendi ? 1 : 0,
      kayit.eklendi,
    ]
  );

  return kayit;
}

// Yalnızca gelen alanları günceller — dinamik SET listesi kuruyoruz ki
// yamada olmayan sütunlar sıfırlanmasın.
const GUNCELLENEBILIR = [
  "ad",
  "tur",
  "katman",
  "kumas",
  "minC",
  "maxC",
  "renk",
  "desen",
  "suGecirmez",
  "resmiyet",
  "etiketlendi",
];

export async function guncelle(id, yama) {
  const alanlar = Object.keys(yama).filter((k) => GUNCELLENEBILIR.includes(k));
  if (alanlar.length === 0) return null;

  const degerler = alanlar.map((k) => {
    const v = yama[k];
    if (k === "suGecirmez" || k === "etiketlendi") return v ? 1 : 0;
    return v ?? null;
  });

  vt().runSync(
    `UPDATE parcalar SET ${alanlar.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`,
    [...degerler, id]
  );

  return satirdanKayit(vt().getFirstSync("SELECT * FROM parcalar WHERE id = ?", [id]));
}

export async function sil(id) {
  const kayit = vt().getFirstSync("SELECT dosya FROM parcalar WHERE id = ?", [id]);
  if (kayit?.dosya) {
    try {
      const f = new File(Paths.document, KLASOR_ADI, kayit.dosya);
      if (f.exists) f.delete();
    } catch (e) {
      // Dosya zaten yoksa kaydı yine de düşürüyoruz.
      console.log("Görsel silinemedi:", e?.message);
    }
  }
  vt().runSync("DELETE FROM parcalar WHERE id = ?", [id]);
}

/** Etiketleme isteği için fotoğrafı base64'e çevirir. */
export async function base64Al(kayit) {
  const f = new File(Paths.document, KLASOR_ADI, kayit.dosya);
  if (!f.exists) throw new Error("Fotoğraf bulunamadı.");
  return f.base64();
}

// Sunucuya gönderilen "hafif" temsil: FOTOĞRAF YOK, sadece metin nitelikler.
// Günlük kombin isteği bunun üzerinden çalışıyor — görsel göndermediğimiz için
// istek hem çok daha ucuz hem çok daha hızlı.
export function ozet(kayit) {
  return {
    id: kayit.id,
    ad: kayit.ad,
    tur: kayit.tur,
    katman: kayit.katman,
    kumas: kayit.kumas,
    minC: kayit.minC,
    maxC: kayit.maxC,
    renk: kayit.renk,
    desen: kayit.desen,
    suGecirmez: kayit.suGecirmez,
    resmiyet: kayit.resmiyet,
  };
}

/**
 * Gardıroptaki boşlukları bulur — kullanıcıyı nazikçe yönlendirmek için.
 *
 * Kombin motoru ancak gördüğü parçalardan seçebiliyor; eksik katman varsa
 * öneri zayıf çıkıyor ve kullanıcı sebebini bilmiyor. Bunu önceden söylemek,
 * sonradan "öneriler kötü" demesinden iyi.
 */
export function eksikler(parcalar) {
  const etiketli = parcalar.filter((p) => p.etiketlendi);
  const katmanlar = new Set(etiketli.map((p) => p.katman));

  const oneriler = [];
  if (!katmanlar.has("ust")) oneriler.push({ katman: "ust", metin: "Bir üst ekle (tişört, gömlek, kazak)" });
  if (!katmanlar.has("alt")) oneriler.push({ katman: "alt", metin: "Bir alt ekle (pantolon, etek)" });
  if (!katmanlar.has("ayakkabi")) oneriler.push({ katman: "ayakkabi", metin: "Bir ayakkabı ekle" });
  if (!katmanlar.has("dis")) oneriler.push({ katman: "dis", metin: "Bir dış giyim ekle (mont, ceket)" });

  // Soğuk hava için yeterli parça var mı? minC'si düşük hiç parça yoksa
  // kışın öneri üretilemez.
  const soguk = etiketli.filter((p) => typeof p.minC === "number" && p.minC <= 8);
  if (etiketli.length >= 4 && soguk.length === 0) {
    oneriler.push({ katman: "soguk", metin: "Soğuk hava için kalın bir parça ekle" });
  }

  // Yağmurluk / su geçirmez parça
  if (etiketli.length >= 4 && !etiketli.some((p) => p.suGecirmez)) {
    oneriler.push({ katman: "yagmur", metin: "Yağmurluk veya su geçirmez bir parça ekle" });
  }

  return oneriler;
}
