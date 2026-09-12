import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePremium } from "../context/PremiumContext";
import { useWardrobe } from "../context/WardrobeContext";
import GradientBackground from "../components/GradientBackground";
import * as haptik from "../ui/haptics";

// Satın alma ekranı hava durumundan bağımsız olduğu için sabit,
// "değerli" hissettiren koyu mor/lacivert bir palet kullanıyor.
const PREMIUM_GRADIENT = ["#140E2E", "#241A4D", "#3A2A6B"];
const ALTIN = "#FFC65C";

// Karşılaştırma tablosu düz bir avantaj listesinden daha ikna edici:
// kullanıcı neyi kazanacağını YAN YANA görüyor. Ama tablo, uygulamada
// GERÇEKTEN erişilebilen özellikleri göstermek zorunda.
//
// Yapay zeka satırları yalnızca sunucu yapılandırıldığında (v1.1) çıkıyor:
// v1.0'da gardırop ve kombin motoru tamamen gizli, o hâlde tabloda vaat
// etmek kullanıcının satın alıp bulamayacağı bir şeyi satmak olurdu.
// Bu, Play'in "yanıltıcı beyan" kapsamına giren ve iade talebi doğuran bir
// durum.
function karsilastirma(yapayZekaAcik) {
  const yapayZeka = [
    { ikon: "✨", ozellik: "Yapay zeka kombin motoru", ucretsiz: "Günde 1", premium: "Günde 20" },
    { ikon: "📷", ozellik: "Gardıroba parça ekleme", ucretsiz: "Ayda 20", premium: "Ayda 500" },
    { ikon: "🔔", ozellik: "Sabah bildiriminde kombin", ucretsiz: "—", premium: "Var" },
  ];

  const ortak = [
    { ikon: "🚫", ozellik: "Reklamsız deneyim", ucretsiz: "—", premium: "Var" },
    { ikon: "🧳", ozellik: "Bavul asistanı", ucretsiz: "—", premium: "Var" },
    { ikon: "💼", ozellik: "Etkinlik kombinleri", ucretsiz: "Günlük", premium: "4 mod" },
    { ikon: "🌡️", ozellik: "Saatlik katman planı", ucretsiz: "—", premium: "Var" },
    { ikon: "👕", ozellik: "Gardırop kapasitesi", ucretsiz: "20 parça", premium: "Sınırsız" },
    // Bu iki uyarı ARTIK ÜCRETSİZ. Tabloda "—" bırakmak, kullanıcının
    // zaten sahip olduğu şeyi satmak olurdu.
    { ikon: "⛈️", ozellik: "Yağış uyarısı", ucretsiz: "Var", premium: "Var" },
    { ikon: "❄️", ozellik: "Ani soğuma uyarısı", ucretsiz: "Var", premium: "Var" },
    { ikon: "📅", ozellik: "10 günlük detaylı tahmin", ucretsiz: "2 gün", premium: "10 gün" },
    { ikon: "👔", ozellik: "Kıyafet önerileri", ucretsiz: "İlk 3", premium: "Tümü" },
    { ikon: "💧", ozellik: "Nem ve UV bazlı tavsiyeler", ucretsiz: "—", premium: "Var" },
    { ikon: "☀️", ozellik: "Sabah özeti bildirimi", ucretsiz: "Var", premium: "Var" },
  ];

  return yapayZekaAcik ? [...yapayZeka, ...ortak] : ortak;
}

export default function PremiumScreen({ onBack }) {
  const {
    isPremium,
    purchasing,
    purchasePremium,
    restorePurchases,
    planlar,
    varsayilanPlan,
    iapReady,
  } = usePremium();

  // Seçili plan. Play'den planlar geldiğinde varsayılan olarak en avantajlı
  // (en çok tasarruf ettiren) plan işaretli geliyor.
  const [seciliJeton, setSeciliJeton] = useState(null);
  const secili = planlar.find((p) => p.jeton === seciliJeton) ?? varsayilanPlan;
  const { krediyiYenile, yapayZekaAcik } = useWardrobe();
  const KARSILASTIRMA = useMemo(() => karsilastirma(yapayZekaAcik), [yapayZekaAcik]);
  const [localError, setLocalError] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const insets = useSafeAreaInsets();

  // Plan yokken butonun ne diyeceği. "Yükleniyor…" yalnızca gerçekten
  // beklerken doğru; Play bağlantısı kurulamamışsa bekleyecek bir şey yok
  // ve sonsuza kadar "yükleniyor" yazmak kullanıcıyı boşuna bekletiyor.
  const butonMetni = iapReady ? "Planlar yükleniyor…" : "Planlar şu an açılamıyor";

  const handlePurchase = async () => {
    setLocalError(null);
    haptik.dokunus();
    // Kullanıcının SEÇTİĞİ planın token'ı gönderiliyor; sabit ilk teklifi
    // göndermek yıllığı seçen kullanıcıyı aylığa abone ederdi.
    const result = await purchasePremium(secili?.jeton);
    if (!result.success) {
      haptik.hata();
      setLocalError(result.error || "Satın alma başlatılamadı.");
      return;
    }
    // Not: Gerçek onay Google Play ödeme ekranından geldikten SONRA,
    // PremiumContext içindeki purchaseUpdatedListener tarafından işlenir.
    // Bu yüzden burada "başarılı" demiyoruz.
  };

  const handleRestore = async () => {
    setRestoring(true);
    setLocalError(null);
    haptik.dokunus();
    const result = await restorePurchases();
    setRestoring(false);

    if (result.success && result.restored) {
      haptik.basari();
      // Sunucudaki kredi tavanı da premium'a göre yeniden okunmalı, yoksa
      // kullanıcı aboneliğini geri yükleyip hâlâ ücretsiz limiti görüyor.
      krediyiYenile?.();
      Alert.alert("Bulundu", "Aktif aboneliğin geri yüklendi.");
    } else if (result.success) {
      Alert.alert("Sonuç", "Aktif bir abonelik bulunamadı.");
    } else {
      haptik.hata();
      setLocalError(result.error || "Geri yükleme başarısız oldu.");
    }
  };

  return (
    <View style={styles.kok}>
      <GradientBackground colors={PREMIUM_GRADIENT} />

      <ScrollView
        contentContainerStyle={[
          styles.icerik,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 44 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() => {
            haptik.dokunus();
            onBack();
          }}
          style={styles.geriButon}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Geri"
        >
          <Text style={styles.geriMetin}>‹ Geri</Text>
        </TouchableOpacity>

        <View style={styles.basliksBolum}>
          <Text style={styles.rozet}>✨ PREMIUM</Text>
          <Text style={styles.baslik}>
            {yapayZekaAcik ? "Dolabın\nakıllansın" : "Havayı tam\nolarak bil"}
          </Text>
          <Text style={styles.altBaslik}>
            {yapayZekaAcik
              ? "Gardırobundaki parçalardan her gün kombin öneren yapay zeka stilisti, akıllı bildirimler ve reklamsız kullanım."
              : "10 günlük tam tahmin, saatlik çizelge, gardırobundan kombin önerileri — reklamsız."}
          </Text>
        </View>

        {/* Plan seçici.

            Fiyat, faturalandırma dönemi ve OTOMATİK YENİLENDİĞİ bilgisi satın
            alma butonundan ÖNCE, açıkça yazılmak zorunda (Play "Abonelikler"
            politikası). Eksikse sürüm incelemede reddedilir.

            Hiçbiri KODA SABİTLENMİYOR — fiyat da dönem de tasarruf oranı da
            Play'deki base plan'lardan okunuyor. Sabitlenseydi, Console'da
            fiyat değiştiği an uygulama yanlış rakam gösterirdi. */}
        {planlar.length > 0 ? (
          <View style={styles.planListesi}>
            {planlar.map((p) => {
              const aktif = secili?.jeton === p.jeton;
              return (
                <TouchableOpacity
                  key={p.jeton}
                  style={[styles.planKart, aktif && styles.planKartAktif]}
                  onPress={() => {
                    haptik.dokunus();
                    setSeciliJeton(p.jeton);
                  }}
                  activeOpacity={0.85}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: aktif }}
                  accessibilityLabel={`${p.donemMetni.sifat} plan, ${p.fiyat}${
                    p.tasarrufYuzde ? `, yüzde ${p.tasarrufYuzde} tasarruf` : ""
                  }`}
                >
                  {p.populer && (
                    <View style={styles.populerRozet}>
                      <Text style={styles.populerMetin}>EN POPÜLER</Text>
                    </View>
                  )}

                  <View style={styles.planSatir}>
                    <View style={[styles.radyo, aktif && styles.radyoAktif]}>
                      {aktif && <View style={styles.radyoIc} />}
                    </View>

                    <View style={styles.planMetin}>
                      <Text style={styles.planDonem}>{p.donemMetni.sifat}</Text>
                      <Text style={styles.planNot}>
                        {p.donemMetni.sik} yenilenir
                        {p.tasarrufYuzde > 0 ? ` · %${p.tasarrufYuzde} tasarruf` : ""}
                      </Text>
                    </View>

                    <Text style={[styles.planFiyat, aktif && styles.planFiyatAktif]}>
                      {p.fiyat}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.fiyatKutu}>
            <Text style={styles.fiyatNot}>
              {iapReady
                ? "Planlar Google Play'den yükleniyor…"
                : "Planlar Google Play'den okunamadı."}
            </Text>
          </View>
        )}

        <View style={styles.tabloKart}>
          <View style={styles.tabloBaslikSatiri}>
            <Text style={[styles.tabloBaslik, styles.tabloOzellikSutun]}>ÖZELLİK</Text>
            <Text style={[styles.tabloBaslik, styles.tabloDegerSutun]}>ÜCRETSİZ</Text>
            <Text style={[styles.tabloBaslik, styles.tabloDegerSutun, styles.tabloPremium]}>
              PREMIUM
            </Text>
          </View>

          {KARSILASTIRMA.map((s, i) => (
            <View
              key={s.ozellik}
              style={[styles.tabloSatir, i < KARSILASTIRMA.length - 1 && styles.tabloAyrac]}
              accessibilityRole="text"
              accessibilityLabel={`${s.ozellik}: ücretsiz ${s.ucretsiz}, premium ${s.premium}`}
            >
              <View style={[styles.tabloOzellikSutun, styles.ozellikHucre]}>
                <Text style={styles.ozellikIkon}>{s.ikon}</Text>
                <Text style={styles.ozellikMetin}>{s.ozellik}</Text>
              </View>
              <Text style={[styles.tabloDeger, styles.tabloDegerSutun]}>{s.ucretsiz}</Text>
              <Text style={[styles.tabloDeger, styles.tabloDegerSutun, styles.tabloDegerAltin]}>
                {s.premium}
              </Text>
            </View>
          ))}
        </View>

        {isPremium ? (
          <View style={styles.aktifKutu}>
            <Text style={styles.aktifMetin}>Premium aktif 🎉</Text>
            <Text style={styles.aktifAlt}>Tüm özellikler açık, iyi kullanımlar.</Text>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={[
                styles.satinAlButon,
                (purchasing || !secili) && styles.butonPasif,
              ]}
              onPress={handlePurchase}
              disabled={purchasing || !secili}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={
                secili
                  ? `${secili.fiyat} karşılığında ${secili.donemMetni.sifat.toLowerCase()} Premium'a geç`
                  : butonMetni
              }
            >
              {purchasing ? (
                <ActivityIndicator color="#241A4D" />
              ) : (
                <Text style={styles.satinAlMetin}>
                  {secili
                    ? `${secili.donemMetni.sifat} plan · ${secili.fiyat}`
                    : butonMetni}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.geriYukleButon}
              onPress={handleRestore}
              disabled={restoring}
              accessibilityRole="button"
              accessibilityLabel="Satın almalarımı geri yükle"
            >
              <Text style={styles.geriYukleMetin}>
                {restoring ? "Kontrol ediliyor..." : "Satın almalarımı geri yükle"}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {localError && (
          <View style={styles.hataKutu}>
            <Text style={styles.hataMetin}>{localError}</Text>
          </View>
        )}

        {!iapReady && !isPremium && (
          <Text style={styles.uyariMetin}>
            ⚠️ Bu ortamda satın alma kullanılamıyor. Gerçek ödeme ekranı yalnızca Play
            Store'dan indirilen sürümde açılır.
          </Text>
        )}

        <Text style={styles.aciklama}>
          Abonelik {secili ? `${secili.donemMetni.sifat.toLowerCase()} olarak ` : ""}
          otomatik yenilenir ve ücret Google Play hesabından tahsil edilir. Yenilemeyi
          durdurmak için dönem bitiminden en az 24 saat önce Google Play &gt; Abonelikler
          bölümünden iptal etmen yeterli; iptal ettiğinde mevcut dönemin sonuna kadar
          Premium açık kalır. Plan değiştirirsen Google Play kalan süreyi orantılı olarak
          mahsup eder. Ödeme tamamen Google Play tarafından işlenir; kart bilgilerin
          bizimle paylaşılmaz.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  kok: { flex: 1, backgroundColor: "#140E2E" },
  icerik: { paddingHorizontal: 22 },
  geriButon: { marginBottom: 18 },
  // lineHeight ile yükseklik 22dp'den 44dp'ye çıkıyor; diğer ekranlardaki
  // geri düğmeleriyle aynı düzeltme.
  geriMetin: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 44,
  },

  basliksBolum: { gap: 10 },
  rozet: { color: ALTIN, fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  baslik: { color: "#fff", fontSize: 34, fontWeight: "800", lineHeight: 39, letterSpacing: -0.6 },
  altBaslik: { color: "rgba(255,255,255,0.66)", fontSize: 14, lineHeight: 21 },

  planListesi: { marginTop: 26, marginBottom: 24, gap: 10 },
  planKart: {
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 15,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  planKartAktif: { borderColor: ALTIN, backgroundColor: "rgba(255,198,92,0.12)" },
  populerRozet: {
    position: "absolute",
    top: -9,
    right: 16,
    backgroundColor: ALTIN,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  populerMetin: { color: "#241A4D", fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
  planSatir: { flexDirection: "row", alignItems: "center", gap: 13 },
  radyo: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  radyoAktif: { borderColor: ALTIN },
  radyoIc: { width: 10, height: 10, borderRadius: 5, backgroundColor: ALTIN },
  planMetin: { flex: 1, gap: 2 },
  planDonem: { color: "#fff", fontSize: 16, fontWeight: "700" },
  planNot: { color: "rgba(255,255,255,0.55)", fontSize: 12 },
  planFiyat: { color: "rgba(255,255,255,0.85)", fontSize: 17, fontWeight: "700" },
  planFiyatAktif: { color: ALTIN, fontWeight: "800" },

  fiyatKutu: { alignItems: "center", marginTop: 28, marginBottom: 24 },
  fiyat: { color: "#fff", fontSize: 40, fontWeight: "800", letterSpacing: -1 },
  fiyatNot: { color: "rgba(255,255,255,0.62)", fontSize: 12, marginTop: 5, fontWeight: "600" },
  fiyatGunluk: { color: "rgba(255,255,255,0.42)", fontSize: 11, marginTop: 3 },

  tabloKart: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 26,
  },
  tabloBaslikSatiri: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.12)",
  },
  tabloBaslik: { color: "rgba(255,255,255,0.45)", fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  tabloPremium: { color: ALTIN },
  tabloOzellikSutun: { flex: 1 },
  tabloDegerSutun: { width: 62, textAlign: "center" },

  tabloSatir: { flexDirection: "row", alignItems: "center", paddingVertical: 13 },
  tabloAyrac: { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  ozellikHucre: { flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 8 },
  ozellikIkon: { fontSize: 15 },
  ozellikMetin: { color: "#fff", fontSize: 13, fontWeight: "600", flex: 1 },
  tabloDeger: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "600" },
  tabloDegerAltin: { color: ALTIN, fontWeight: "800" },

  satinAlButon: { backgroundColor: ALTIN, borderRadius: 18, paddingVertical: 18, alignItems: "center" },
  butonPasif: { opacity: 0.7 },
  satinAlMetin: { color: "#241A4D", fontSize: 17, fontWeight: "800" },
  geriYukleButon: { marginTop: 15, alignItems: "center", paddingVertical: 6 },
  geriYukleMetin: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600" },

  aktifKutu: {
    backgroundColor: "rgba(74,222,128,0.18)",
    borderColor: "rgba(74,222,128,0.4)",
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 20,
    alignItems: "center",
    gap: 4,
  },
  aktifMetin: { color: "#BBF7D0", fontWeight: "800", fontSize: 16 },
  aktifAlt: { color: "rgba(255,255,255,0.6)", fontSize: 12 },

  hataKutu: {
    marginTop: 16,
    backgroundColor: "rgba(220,38,38,0.22)",
    borderColor: "rgba(255,150,150,0.45)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  hataMetin: { color: "#FFE1E1", fontSize: 13, lineHeight: 18 },

  uyariMetin: {
    color: "#FCD9A0",
    marginTop: 18,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
  },
  aciklama: {
    color: "rgba(255,255,255,0.42)",
    fontSize: 11,
    marginTop: 24,
    textAlign: "center",
    lineHeight: 16,
  },
});
