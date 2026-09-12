import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import * as depo from "../storage/wardrobe";
import { etiketle as etiketleUzak, kombinIste, krediDurumu } from "../api/stylist";
import { sunucuHazirMi } from "../config";
import { yerelKombinSec, tahminiEtiket } from "../logic/localStylist";
import { etkiliSicaklik } from "../logic/kalibrasyon";
import { kotayaSigdir } from "../logic/katalog";
import * as kalibrasyonDepo from "../storage/kalibrasyon";
import { usePremium } from "./PremiumContext";

const WardrobeContext = createContext(null);

// Ücretsiz planda saklanabilecek parça sayısı. Premium'da sınırsız.
// 20 bilinçli bir sayı: tipik bir kullanıcı için "işe yarar ama dar" —
// gardırobun tamamını eklemek isteyen yükseltiyor.
export const UCRETSIZ_PARCA_SINIRI = 20;

// Fotoğrafı yüklemeden önce küçültüyoruz: kamera 12 MP çekiyor, o boyut hem
// ağdan geçerken yavaş hem de etiketleme için tamamen gereksiz. Kalite 0.6 ve
// kare kırpma, modelin parçayı tanıması için fazlasıyla yeterli.
const SECIM_AYARLARI = {
  mediaTypes: ["images"],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.6,
  base64: false,
};

export function WardrobeProvider({ children }) {
  // Premium durumu değişince kredi tavanı da değişiyor (günde 1 -> günde 20).
  // Satın alma sırasında sunucuya yeniden sormazsak kullanıcı parasını ödeyip
  // hâlâ "hakkın doldu" ekranını görüyor.
  const { isPremium } = usePremium();
  const [parcalar, setParcalar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [ekleniyor, setEkleniyor] = useState(false);
  const [kredi, setKredi] = useState(null);

  const [kombin, setKombin] = useState(null);
  const [kombinYukleniyor, setKombinYukleniyor] = useState(false);
  const [kombinHatasi, setKombinHatasi] = useState(null);

  // Etiketlenmiş ama kullanıcı henüz ONAYLAMAMIŞ parça. Modal bunu gösteriyor;
  // onaylanana kadar gardırop listesinde "etiketlendi" sayılmıyor, dolayısıyla
  // kombin önerisine de girmiyor.
  const [bekleyenParca, setBekleyenParca] = useState(null);

  const yenile = useCallback(async () => {
    const liste = await depo.listele();
    setParcalar(liste);
    return liste;
  }, []);

  useEffect(() => {
    yenile()
      .then((liste) => {
        // Yarıda kalmış etiketlemeyi kurtar.
        //
        // Kullanıcı fotoğrafı çekip onay modalını kapatmadan uygulamayı
        // kapatırsa parça `etiketlendi = 0` olarak diskte kalıyordu: kombine
        // hiç girmiyor ama ücretsiz kotayı işgal ediyor ve tamamlamanın
        // hiçbir yolu yok. Gardırop ekranı "1 tanesi onay bekliyor" yazıp
        // duruyordu. Açılışta bekleyeni geri alıyoruz; modal gardırop
        // ekranında yeniden açılıp kullanıcı işi bitirebiliyor.
        const bekleyen = (liste ?? []).find((p) => !p.etiketlendi);
        if (bekleyen) setBekleyenParca((mevcut) => mevcut ?? bekleyen);
      })
      .catch((e) => console.log("Gardırop okunamadı:", e?.message))
      .finally(() => setYukleniyor(false));
  }, [yenile]);

  // Kredi bilgisi sunucudan gelir; yapılandırma yoksa hiç sorulmaz.
  const krediyiYenile = useCallback(async () => {
    if (!sunucuHazirMi()) return null;
    try {
      const { kredi: k } = await krediDurumu();
      setKredi(k);
      return k;
    } catch (e) {
      console.log("Kredi durumu alınamadı:", e?.message);
      return null;
    }
  }, []);

  useEffect(() => {
    krediyiYenile();
  }, [krediyiYenile, isPremium]);

  // kaynak: "kamera" | "galeri"
  const parcaEkle = useCallback(
    async (kaynak = "galeri") => {
      // Ücretsiz sınır kontrolü ekleme AKIŞINDAN ÖNCE: kullanıcıya fotoğraf
      // çektirip sonra "olmadı" demek en kötü sonuç.
      if (!isPremium && parcalar.length >= UCRETSIZ_PARCA_SINIRI) {
        return { ok: false, kilitli: "gardirop" };
      }
      setEkleniyor(true);
      try {
        const izin =
          kaynak === "kamera"
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!izin.granted) {
          return {
            ok: false,
            hata:
              kaynak === "kamera"
                ? "Kamera izni verilmedi. Ayarlardan açabilirsin."
                : "Galeri izni verilmedi. Ayarlardan açabilirsin.",
          };
        }

        const sonuc =
          kaynak === "kamera"
            ? await ImagePicker.launchCameraAsync(SECIM_AYARLARI)
            : await ImagePicker.launchImageLibraryAsync(SECIM_AYARLARI);
        if (sonuc.canceled || !sonuc.assets?.length) return { ok: false, iptal: true };

        // Önce diske al: etiketleme başarısız olsa bile fotoğraf kaybolmasın,
        // kullanıcı sonra tekrar deneyebilsin.
        const kayit = await depo.ekle(sonuc.assets[0].uri, { ad: "Etiketleniyor..." });
        await yenile();

        // Sunucu yoksa ELLE etiketlemeye düşüyoruz: parça yine gardıroba
        // giriyor, kullanıcı onay modalında bilgileri kendisi dolduruyor.
        // Önceden bu durumda parça "Yeni parça" olarak kalıyor ve kombin
        // önerisine hiç girmiyordu — özellik sessizce ölüydü.
        if (!sunucuHazirMi()) {
          const t = tahminiEtiket();
          await depo.guncelle(kayit.id, { ...t, etiketlendi: false });
          const liste = await yenile();
          setBekleyenParca(liste.find((p) => p.id === kayit.id) ?? { ...kayit, ...t });
          return { ok: true, onayBekliyor: true, elle: true };
        }

        try {
          const base64 = await depo.base64Al(kayit);
          const { parca, kredi: k } = await etiketleUzak(base64, "image/jpeg");
          if (k) setKredi(k);

          if (!parca.kiyafetMi) {
            await depo.sil(kayit.id);
            await yenile();
            return {
              ok: false,
              hata: "Bu fotoğrafta bir giyim eşyası göremedim. Yalnızca kıyafeti kadraja al.",
            };
          }

          // Niteliklerini yaz ama ONAYLANMIŞ sayma: etiketlendi bayrağı
          // kullanıcı modalda "ekle" diyene kadar false kalıyor.
          await depo.guncelle(kayit.id, { ...parca, etiketlendi: false });
          const liste = await yenile();
          const guncel = liste.find((p) => p.id === kayit.id);
          setBekleyenParca(guncel ?? { ...kayit, ...parca });
          return { ok: true, onayBekliyor: true, kayit: guncel };
        } catch (e) {
          // Etiketleme başarısız (kota, ağ, servis hatası): parçayı ATMIYORUZ.
          // Tahmini değerlerle onay modalını açıyoruz; kullanıcı elle
          // düzeltip devam ediyor. Fotoğrafı çekip "olmadı" demek en kötü
          // sonuç olurdu.
          const t = tahminiEtiket();
          await depo.guncelle(kayit.id, { ...t, etiketlendi: false });
          const liste = await yenile();
          if (e.kredi) setKredi(e.kredi);
          setBekleyenParca(liste.find((p) => p.id === kayit.id) ?? { ...kayit, ...t });
          return { ok: true, onayBekliyor: true, elle: true, uyari: e.message };
        }
      } finally {
        setEkleniyor(false);
      }
    },
    [yenile, isPremium, parcalar.length]
  );

  /** Modaldaki düzeltmeleri kaydeder ve parçayı gardıroba resmen alır. */
  const parcaOnayla = useCallback(
    async (taslak) => {
      if (!taslak?.id) return;
      await depo.guncelle(taslak.id, { ...taslak, etiketlendi: true });
      setBekleyenParca(null);
      await yenile();
    },
    [yenile]
  );

  /** Kullanıcı vazgeçti: fotoğrafı da kaydı da sil, yarım parça kalmasın. */
  const parcaVazgec = useCallback(async () => {
    const id = bekleyenParca?.id;
    setBekleyenParca(null);
    if (id) {
      await depo.sil(id);
      await yenile();
    }
  }, [bekleyenParca, yenile]);

  /**
   * Hazır katalogdan seçilen parçaları ekler.
   *
   * Ücretsiz sınırı burada da uyguluyoruz: katalogda 30 kalem var, sınır 20.
   * Sessizce hepsini eklemek sınırı delerdi; sessizce kırpmak ise kullanıcıya
   * "seçtiklerim gelmedi" dedirtirdi. Kalan kotaya sığdırıp KAÇ TANESİNİN
   * eklendiğini geri bildiriyoruz.
   */
  const katalogdanEkle = useCallback(
    async (secilenler) => {
      if (!secilenler?.length) return { ok: false, eklenen: 0 };

      const kalan = isPremium
        ? secilenler.length
        : Math.max(0, UCRETSIZ_PARCA_SINIRI - parcalar.length);

      if (kalan === 0) return { ok: false, eklenen: 0, kilitli: "gardirop" };

      // Baştan kırpmak yerine katmanlar arasında sırayla dağıtıyoruz;
      // yoksa kota dolduğunda ayakkabı ve aksesuar hiç eklenmiyordu.
      const sigan = kotayaSigdir(secilenler, kalan);
      depo.katalogEkle(sigan);
      await yenile();

      return {
        ok: true,
        eklenen: sigan.length,
        atlanan: secilenler.length - sigan.length,
      };
    },
    [isPremium, parcalar.length, yenile]
  );

  const parcaSil = useCallback(
    async (id) => {
      await depo.sil(id);
      // Silinen parça kombindeyse öneriyi de düşür, ölü referans kalmasın.
      setKombin((k) => (k?.secilenler?.some((s) => s.id === id) ? null : k));
      await yenile();
    },
    [yenile]
  );

  const kombinOner = useCallback(
    async (hava, { etkinlik = "gunluk" } = {}) => {
      if (parcalar.length === 0) {
        setKombinHatasi("Önce gardırobuna birkaç parça ekle.");
        return { ok: false };
      }
      setKombinYukleniyor(true);
      setKombinHatasi(null);

      const onaylanmis = parcalar.filter((p) => p.etiketlendi);
      if (onaylanmis.length === 0) {
        setKombinYukleniyor(false);
        setKombinHatasi("Önce eklediğin parçaları onayla.");
        return { ok: false };
      }

      // CİHAZDA seçim her zaman yapılıyor; yapay zeka varsa üstüne yazıyor.
      // Böylece servis kapalı, kotan dolu veya internet yokken de öneri
      // geliyor — bozuk ekran yerine çalışan ekran.
      // Kişisel kayma parça seçimine de giriyor: kullanıcı üşüyense aynı
      // havada bir üst kalınlıktaki parçalar öne çıkıyor. Yalnızca SEÇİMİ
      // etkiliyor, ekranda yazan dereceyi değil.
      const kisisel = {
        ...hava,
        hissedilen: etkiliSicaklik(hava?.hissedilen, kalibrasyonDepo.oku()),
      };

      const yerel = yerelKombinSec(onaylanmis, kisisel, {
        sonKullanilanIdler: (kombin?.secilenler ?? []).map((s) => s.id),
        // Etkinlik modları Premium; ücretsizde her zaman "gunluk".
        etkinlik: isPremium ? etkinlik : "gunluk",
      });
      if (yerel) setKombin(yerel);

      if (!sunucuHazirMi()) {
        setKombinYukleniyor(false);
        return yerel ? { ok: true, kombin: yerel } : { ok: false };
      }

      try {
        const { kombin: k, kredi: kr } = await kombinIste(onaylanmis.map(depo.ozet), hava);
        setKombin({ ...k, kaynak: "yapayZeka" });
        if (kr) setKredi(kr);
        return { ok: true, kombin: k };
      } catch (e) {
        if (e.kredi) setKredi(e.kredi);
        // Yerel öneri ekranda duruyor; hatayı ölümcül göstermiyoruz.
        setKombinHatasi(
          yerel
            ? `Yapay zeka önerisi alınamadı; cihazdaki öneri gösteriliyor.`
            : e.message
        );
        return { ok: !!yerel, kombin: yerel, hata: e.message, kod: e.kod };
      } finally {
        setKombinYukleniyor(false);
      }
    },
    [parcalar]
  );

  return (
    <WardrobeContext.Provider
      value={{
        parcalar,
        yukleniyor,
        ekleniyor,
        kredi,
        kombin,
        kombinYukleniyor,
        kombinHatasi,
        eksikler: depo.eksikler(parcalar),
        parcaSiniri: isPremium ? Infinity : UCRETSIZ_PARCA_SINIRI,
        sinirDoldu: !isPremium && parcalar.length >= UCRETSIZ_PARCA_SINIRI,
        parcaEkle,
        parcaSil,
        katalogdanEkle,
        bekleyenParca,
        parcaOnayla,
        parcaVazgec,
        kombinOner,
        krediyiYenile,
        gorselUri: depo.gorselUri,
        // Gardırop artık sunucudan BAĞIMSIZ çalışıyor; bu bayrak yalnızca
        // "yapay zeka katmanı var mı" sorusunu cevaplıyor.
        yapayZekaAcik: sunucuHazirMi(),
      }}
    >
      {children}
    </WardrobeContext.Provider>
  );
}

export function useWardrobe() {
  const ctx = useContext(WardrobeContext);
  if (!ctx) throw new Error("useWardrobe, WardrobeProvider içinde kullanılmalı.");
  return ctx;
}
