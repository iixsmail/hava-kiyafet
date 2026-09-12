# PROJECT_STATE — Hava & Kıyafet

**Son güncelleme:** 13 Eylül 2026
**Durum:** Kapalı test tamamlandı, üretim erişimi başvurusu gönderilmeyi bekliyor.

---

## 1. Nerede duruyoruz

| Konu | Durum |
|---|---|
| Kapalı test 14 gün / 12 testçi | ✅ Tamamlandı (15 testçi kayıtlı) |
| Üretim başvurusu | ⏳ Metinler hazır, **gönderilmedi** |
| Play'deki son sürüm | 29 |
| Hazırlanan sürüm | **30** (bildirim saati + dil düzeltmeleri) |
| Kaynak kodu | ✅ GitHub'da yedekli |
| Play Console fiyatları | ⏳ Düzeltilecek |
| **Android geliştirici doğrulaması** | ⚠️ **Son tarih 30 Eylül 2026** |

---

## 2. Kod nerede

```
C:\Users\ismai\Downloads\hava-kiyafet-v29-mac\   ← ÇALIŞMA KOPYASI (güncel)
github.com/iixsmail/hava-kiyafet (main)          ← yedek, sırlar hariç
~/Desktop/hava-kiyafet-app (Mac)                 ← v29 kaynağı
```

**Geçmiş uyarı:** Kaynak bir ay boyunca yalnızca Mac'te tek kopya olarak
durdu ve Mac silinince neredeyse kaybediliyordu. Artık üç yerde. Her
oturum sonunda `git push` yap.

`credentials/` klasörü (imzalama anahtarı) `.gitignore`'da — GitHub'a
gitmez, elle taşınması gerekir. Windows kopyasında ve EAS'ta mevcut.

---

## 3. Bu oturumda yapılanlar (13 Eylül)

1. **Kaynak kurtarma** — Mac'ten HTTP üzerinden çekildi (57 kaynak dosya).
2. **GitHub yedeği** — sır taraması yapıldı; `server/.envAQ...` dosyası
   yakalanıp dışarıda bırakıldı. Public depoda sır yok, doğrulandı.
3. **"Katman" jargonu temizlendi** — bildirim ve plan metinlerindeki 8
   ifade gündelik Türkçeye çevrildi (testçi geri bildirimi).
4. **Sabah bildirimi 08:00 → 06:00** — testçiler "çok geç" dedi.
   Ayar `AsyncStorage`'da saklandığı için anahtar `bildirimAyarlari.v2`'ye
   taşındı ve eski varsayılanda kalmış kullanıcılar 06:00'ya alındı.
   Saati bilerek değiştirenlerin tercihi korunuyor.
5. **Sürümleme düzeltildi** — EAS uzak sayacı 22'de kalmıştı (23-29 Mac'te
   yerel derlendiği için). Bu haliyle EAS build 22 üretiyordu ve Play
   reddederdi. `appVersionSource: local` yapılıp versionCode 30'a alındı.

---

## 4. ⚠️ Fiyat konusu — kodda değil, Play Console'da

Kod fiyatları **tamamen Play'den** okuyor (`PremiumContext.js` →
`planlariCikar`). Her base plan ayrı işleniyor, kendi `offerTokenAndroid`'i
kullanılıyor, sabit fiyat yok. Play'e ulaşılamazsa hiç fiyat gösterilmiyor.

Ekranda yanlış fiyat görünüyorsa **Console'daki değerler yanlış**:

```
premium_yillik / aylik-plan   -> ₺119,99
premium_yillik / yillik-plan  -> ₺359,99
```

Bunu düzeltmek için yeni sürüm gerekmez.

---

## 5. Sürüm kısıtları — DEĞİŞTİRME

`package.json`'da caret (`^`) yok, bilerek:

| Paket | Sabit | Yükseltirsen |
|---|---|---|
| `react-native-google-mobile-ads` | 16.0.0 | 16.1+ Kotlin 2.3 ister, SDK 54 derleyemez |
| `expo-iap` | 5.0.0 | 5.2.0 kotlin-stdlib 2.4.10 getirir, derleme kırılır |
| Expo SDK | 54 | Kotlin tavanı 2.2.20 |

**Windows'ta yerel derleme:** `newArchEnabled: true` olduğu için Windows'un
260 karakterlik yol sınırına takılır (`ninja: Filename longer than 260`).
Çözüm: EAS bulut derlemesi kullan (Linux'ta bu sınır yok). Zorunlu kalırsan
projeyi `C:\hk` gibi kısa bir yola taşı.

---

## 6. Sırada ne var

1. v30 EAS'ta derleniyor → bitince `.aab` indir
2. Play Console → iki base plan fiyatını düzelt
3. v30'u **kapalı teste** yükle
4. Üretim başvurusunu gönder — yanıtlar:
   - `basvuru/yanitlar.txt` (S1, S2, S5, S7, S8)
   - `basvuru/S3-S4-bildirim-ornegi.txt` (S3, S4, S6 — bildirim örneğiyle)
   - Çoktan seçmeli: "Zor" ve "0-10 bin"
5. **30 Eylül'e kadar Android geliştirici doğrulaması** — kaçırılırsa
   uygulama dünya genelinde Play'den kaldırılır

**Başvuruyu v30 kapalı teste yüklendikten SONRA gönder.** S4'te "yeni
sürümü testçilere tekrar dağıttım" yazıyor; beyanın doğru olması için
sürümün yayında olması gerekir.

---

## 7. İmza doğrulama

Her `.aab`'yi yüklemeden önce:

```bash
keytool -printcert -jarfile app-release.aab
```

Beklenen SHA1: `17:C8:3F:17:24:B2:51:A8:18:53:D4:7C:DB:2E:E8:7A:D5:C2:49:34`
