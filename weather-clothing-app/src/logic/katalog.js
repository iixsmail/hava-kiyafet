// Hazır kıyafet kataloğu — gardıroba fotoğrafsız, hızlı giriş.
//
// Neden var: gardırop uygulamanın asıl farkı ama arkasında 8-10 fotoğraf
// çekme angaryası vardı. Çoğu kullanıcı o eşiği aşmıyor ve kombin, bavul,
// katman planı özelliklerinin hepsi boş gardırop yüzünden erişilemez kalıyor.
// Burada listeden işaretleyerek 30 saniyede gardırop kuruluyor; fotoğraf
// isteğe bağlı bir zenginleştirmeye dönüşüyor.
//
// Sıcaklık aralıkları (minC–maxC) "bu parça tek başına hangi havada rahat
// eder" sorusunun cevabı; localStylist bunları hissedilen sıcaklıkla
// karşılaştırıyor. Aralıklar bilinçli olarak GENİŞ ve ÜST ÜSTE BİNİYOR:
// dar aralıklar, ara sıcaklıklarda hiçbir parçanın seçilememesine yol açar.
//
// Kazak ve kot bilerek -15'e kadar iniyor: donma altında da giyilen
// parçalar bunlar ve üst/alt katmanda kapsama DELİĞİ kalmamalı. Delik
// kalırsa o sıcaklıkta kombin hiç üretilemiyor (tests/katalog.test.mjs
// -5..40 arasını tarayıp bunu denetliyor).

export const KATALOG = [
  // --- Üst ---------------------------------------------------------------
  { id: "k-tisort", ad: "Tişört", katman: "ust", tur: "tişört", kumas: "pamuk", minC: 18, maxC: 40, resmiyet: "gunluk" },
  { id: "k-uzunkol", ad: "Uzun kollu tişört", katman: "ust", tur: "uzun kollu", kumas: "pamuk", minC: 12, maxC: 24, resmiyet: "gunluk" },
  { id: "k-gomlek", ad: "Gömlek", katman: "ust", tur: "gömlek", kumas: "pamuk", minC: 14, maxC: 28, resmiyet: "resmi" },
  { id: "k-sweatshirt", ad: "Sweatshirt", katman: "ust", tur: "sweatshirt", kumas: "pamuk", minC: 6, maxC: 18, resmiyet: "spor" },
  { id: "k-kazak", ad: "Kazak", katman: "ust", tur: "kazak", kumas: "yün", minC: -15, maxC: 14, resmiyet: "gunluk" },
  { id: "k-hirka", ad: "Hırka", katman: "ust", tur: "hırka", kumas: "triko", minC: 8, maxC: 20, resmiyet: "yari-resmi" },
  { id: "k-bluz", ad: "Bluz", katman: "ust", tur: "bluz", kumas: "polyester", minC: 16, maxC: 30, resmiyet: "yari-resmi" },
  { id: "k-atlet", ad: "Atlet", katman: "ust", tur: "atlet", kumas: "pamuk", minC: 25, maxC: 45, resmiyet: "spor" },

  // --- Alt ---------------------------------------------------------------
  { id: "k-kot", ad: "Kot pantolon", katman: "alt", tur: "kot", kumas: "denim", minC: -15, maxC: 26, resmiyet: "gunluk" },
  { id: "k-kumaspantolon", ad: "Kumaş pantolon", katman: "alt", tur: "pantolon", kumas: "polyester", minC: 6, maxC: 28, resmiyet: "resmi" },
  { id: "k-esofman", ad: "Eşofman altı", katman: "alt", tur: "eşofman", kumas: "pamuk", minC: 4, maxC: 22, resmiyet: "spor" },
  { id: "k-sort", ad: "Şort", katman: "alt", tur: "şort", kumas: "pamuk", minC: 22, maxC: 45, resmiyet: "spor" },
  { id: "k-etek", ad: "Etek", katman: "alt", tur: "etek", kumas: "polyester", minC: 16, maxC: 32, resmiyet: "yari-resmi" },
  { id: "k-tayt", ad: "Tayt", katman: "alt", tur: "tayt", kumas: "polyester", minC: 8, maxC: 24, resmiyet: "spor" },

  // --- Dış giyim ---------------------------------------------------------
  { id: "k-incemont", ad: "İnce mont", katman: "dis", tur: "mont", kumas: "polyester", minC: 6, maxC: 16, resmiyet: "gunluk" },
  { id: "k-kalinmont", ad: "Kalın mont", katman: "dis", tur: "mont", kumas: "polyester", minC: -15, maxC: 8, resmiyet: "gunluk" },
  { id: "k-yagmurluk", ad: "Yağmurluk", katman: "dis", tur: "yağmurluk", kumas: "polyester", minC: 4, maxC: 20, resmiyet: "gunluk", suGecirmez: true },
  { id: "k-kaban", ad: "Kaban", katman: "dis", tur: "kaban", kumas: "yün", minC: -10, maxC: 10, resmiyet: "yari-resmi" },
  { id: "k-ceket", ad: "Blazer ceket", katman: "dis", tur: "ceket", kumas: "polyester", minC: 10, maxC: 22, resmiyet: "resmi" },
  { id: "k-kotceket", ad: "Kot ceket", katman: "dis", tur: "ceket", kumas: "denim", minC: 12, maxC: 22, resmiyet: "gunluk" },
  { id: "k-ruzgarlik", ad: "Rüzgarlık", katman: "dis", tur: "rüzgarlık", kumas: "polyester", minC: 8, maxC: 20, resmiyet: "spor", suGecirmez: true },

  // --- Ayakkabı ----------------------------------------------------------
  { id: "k-sneaker", ad: "Spor ayakkabı", katman: "ayakkabi", tur: "sneaker", kumas: "polyester", minC: 4, maxC: 32, resmiyet: "spor" },
  { id: "k-klasikayakkabi", ad: "Klasik ayakkabı", katman: "ayakkabi", tur: "ayakkabı", kumas: "deri", minC: 4, maxC: 28, resmiyet: "resmi" },
  { id: "k-bot", ad: "Bot", katman: "ayakkabi", tur: "bot", kumas: "deri", minC: -15, maxC: 14, resmiyet: "gunluk", suGecirmez: true },
  { id: "k-sandalet", ad: "Sandalet", katman: "ayakkabi", tur: "sandalet", kumas: "deri", minC: 24, maxC: 45, resmiyet: "gunluk" },

  // --- Aksesuar ----------------------------------------------------------
  // Aksesuarları localStylist yalnızca hissedilen 12°'nin altında veya UV 7+
  // iken değerlendiriyor; aralıkları buna göre dar tutuyoruz.
  { id: "k-atki", ad: "Atkı", katman: "aksesuar", tur: "atkı", kumas: "yün", minC: -15, maxC: 10, resmiyet: "gunluk" },
  { id: "k-bere", ad: "Bere", katman: "aksesuar", tur: "bere", kumas: "yün", minC: -15, maxC: 8, resmiyet: "gunluk" },
  { id: "k-eldiven", ad: "Eldiven", katman: "aksesuar", tur: "eldiven", kumas: "yün", minC: -15, maxC: 6, resmiyet: "gunluk" },
  { id: "k-sapka", ad: "Şapka", katman: "aksesuar", tur: "şapka", kumas: "pamuk", minC: 18, maxC: 45, resmiyet: "spor" },
];

/** Ekranın bölüm bölüm çizmesi için katmana göre gruplanmış hâli. */
export const KATMAN_BASLIKLARI = [
  { katman: "ust", baslik: "Üst" },
  { katman: "alt", baslik: "Alt" },
  { katman: "dis", baslik: "Dış giyim" },
  { katman: "ayakkabi", baslik: "Ayakkabı" },
  { katman: "aksesuar", baslik: "Aksesuar" },
];

/**
 * İlk açılışta işaretli gelen parçalar.
 *
 * Boş listeyle başlamak kullanıcıyı 30 seçenek karşısında düşünmeye
 * zorluyor; en yaygın altısını önceden işaretleyip "gerekirse çıkar"
 * demek, ilk adımı tek dokunuşa indiriyor. Seçim ÖNERİ, dayatma değil.
 */
export const VARSAYILAN_SECIM = [
  "k-tisort",
  "k-gomlek",
  "k-kot",
  "k-sweatshirt",
  "k-incemont",
  "k-sneaker",
];

/** Katalog kaydını gardırop kaydına çevirir. */
export function katalogParcasi(k) {
  return {
    ad: k.ad,
    tur: k.tur,
    katman: k.katman,
    kumas: k.kumas,
    minC: k.minC,
    maxC: k.maxC,
    renk: "",
    desen: "düz",
    suGecirmez: k.suGecirmez ?? false,
    resmiyet: k.resmiyet,
    // Katalogdan gelen parça ONAYLANMIŞ sayılıyor: kullanıcı zaten listeden
    // bilinçli olarak seçti, ayrıca bir onay ekranı göstermek gereksiz adım.
    etiketlendi: true,
  };
}

/**
 * Seçimi kotaya sığdırır — katmanlar arasında SIRAYLA dağıtarak.
 *
 * Baştan kırpmak (slice) katalog sırasını izliyor: kullanıcı 30 kalemin
 * hepsini seçtiğinde ilk 20'si 8 üst + 6 alt + 6 dış oluyor ve ayakkabı ile
 * aksesuar tamamen düşüyordu. Kullanıcı ayakkabı işaretlemiş ama gardırobuna
 * hiç ayakkabı girmemiş oluyor — açıklanamaz bir sonuç.
 *
 * Sırayla dağıtım her katmandan en az birer tane geçmesini sağlıyor; katman
 * içindeki sıra korunuyor, yani listede önce gelen önce giriyor.
 */
export function kotayaSigdir(secilenler, kota) {
  if (!Number.isFinite(kota)) return [...secilenler];
  if (kota <= 0) return [];
  if (secilenler.length <= kota) return [...secilenler];

  // Katmana göre kuyruklar; katman sırası KATMAN_BASLIKLARI'ndan geliyor ki
  // "üst" ve "alt" (kombin için zorunlu olanlar) önce paylarını alsın.
  const kuyruklar = new Map();
  for (const { katman } of KATMAN_BASLIKLARI) kuyruklar.set(katman, []);
  for (const p of secilenler) {
    if (!kuyruklar.has(p.katman)) kuyruklar.set(p.katman, []);
    kuyruklar.get(p.katman).push(p);
  }

  const sonuc = [];
  let kaldi = true;
  while (sonuc.length < kota && kaldi) {
    kaldi = false;
    for (const kuyruk of kuyruklar.values()) {
      if (sonuc.length >= kota) break;
      if (kuyruk.length) {
        sonuc.push(kuyruk.shift());
        kaldi = true;
      }
    }
  }
  return sonuc;
}

/**
 * Seçimin kombin üretmeye yetip yetmediğini söyler.
 *
 * Kombin için en az bir üst ve bir alt gerekiyor; ayakkabı olmadan da öneri
 * çıkıyor ama eksik hissettiriyor. Kullanıcıyı "ekle" dedikten SONRA boş
 * sonuçla karşılaştırmaktansa, seçim ekranında uyarmak daha iyi.
 */
export function secimDurumu(secilenIdler) {
  const secilen = KATALOG.filter((k) => secilenIdler.includes(k.id));
  const varMi = (katman) => secilen.some((k) => k.katman === katman);
  const eksikler = [];
  if (!varMi("ust")) eksikler.push("bir üst");
  if (!varMi("alt")) eksikler.push("bir alt");
  return {
    sayi: secilen.length,
    yeterli: eksikler.length === 0,
    eksikler,
    ayakkabiVar: varMi("ayakkabi"),
  };
}
