# Hava & Kıyafet — stil sunucusu

Uygulamayla **Google Gemini** arasındaki aracı. Tek varlık sebebi: **API
anahtarı uygulamanın içine giremez.** Bir `.aab` dosyasından JS paketini
çıkarıp içindeki sabitleri okumak üç komutluk iş — anahtarı oraya koyarsak
kotayı başkası tüketir.

Ayrıca kredi sayacı da burada duruyor; istemcide dursaydı kurcalanabilirdi.

**Model:** `gemini-2.5-flash` (Google AI Studio ücretsiz katmanı)

## Uç noktalar

| Yol | Ne yapar | Ne kadar sıklıkla |
|---|---|---|
| `POST /v1/etiketle` | Fotoğraf → `{tur, katman, kumas, renk, minC, maxC, suGecirmez, resmiyet}` | Parça başına **bir kez** |
| `POST /v1/kombin` | Gardırop metadatası + hava → seçilen parça id'leri + gerekçe | Kullanıcı istedikçe |
| `GET /v1/kredi` | Kalan hak | Ekran açılışlarında |
| `GET /saglik` | Ayakta mı, anahtar ve Play doğrulaması var mı | — |

Her istekte `x-cihaz` başlığı zorunlu. `x-play-jeton` varsa premium olarak
doğrulanmaya çalışılır.

**Kombin isteğinde fotoğraf gönderilmiyor** — sadece etiketleme sırasında
çıkarılmış metin nitelikleri gidiyor. Bir fotoğraf ömrü boyunca en fazla bir
kez API'ye ulaşıyor.

## Yapısal çıktı — iki katmanlı güvence

1. `responseMimeType: "application/json"` + `responseJsonSchema` ile modele
   şema dayatılıyor.
2. Dönen JSON ayrıca **Zod ile doğrulanıyor**.

İkinci katman şart: şema uyumu güçlü bir yönlendirme ama sözleşme değil.
Doğrulamadan geçirmezsek eksik bir alan sessizce `undefined` olarak
kaydedilir ve hata çok sonra, kombin seçilirken ortaya çıkar.

`z.toJSONSchema()` çıktısındaki `$schema` ve `additionalProperties`
anahtarları ayıklanıyor — Gemini'nin doğrulayıcısı bunları tanımıyor ve
şemanın tamamını reddediyor.

## Çalıştırma

```bash
npm install
```

```bash
GEMINI_API_KEY=... npm start
```

Node 22+ gerekiyor (TypeScript'i doğrudan çalıştırıyor, derleme adımı yok).
Anahtarı [Google AI Studio](https://aistudio.google.com/apikey)'dan alıyorsun.

## Ortam değişkenleri

| Değişken | Zorunlu | Ne işe yarar |
|---|---|---|
| `GEMINI_API_KEY` | **Evet** | Gemini erişimi (`GOOGLE_API_KEY` de kabul edilir) |
| `PORT` | Hayır | Varsayılan 8787 |
| `DB_YOLU` | Hayır | Kredi veritabanı, varsayılan `krediler.db` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Hayır ama önerilir | Play abonelik doğrulaması. **Yoksa herkes ücretsiz sayılır** |
| `PLAY_PAKET_ADI` | Hayır | Varsayılan `com.ismail.havakiyafet` |

`GOOGLE_SERVICE_ACCOUNT_JSON`, Google Cloud'da oluşturduğun servis hesabının
JSON anahtarının **tamamı** (tek satır olarak). Servis hesabına Play Console
> Users and permissions üzerinden "View financial data" yetkisi vermen
gerekiyor. Bu, Gemini anahtarından **ayrı** bir şey.

## Kredi limitleri

`src/credits.ts` içinde:

```
ücretsiz : günde  1 kombin, ayda  20 etiketleme
premium  : günde 20 kombin, ayda 500 etiketleme
```

İki sayaç iki ayrı pencerede (kombin günlük, etiket aylık) ve ikisi de
"sonsuza kadar toplam" değil — bir kez limiti dolduran kullanıcı kalıcı
olarak kilitlenmesin, gardırobunu zamanla büyütebilsin diye.

Gemini ücretsiz katmanı günde ~1500 istek veriyor; bu limitlerle 1500 aktif
ücretsiz kullanıcıya kadar kota sorunu çıkmaz.

Premium bilinçli olarak **sonlu**. Mağaza metninde "sınırsız" yerine "adil
kullanım" de.

Başarısız bir çağrı krediyi yakmaz — harcanan kredi iade edilir. İade
pencere kontrolü yapıyor: gece yarısını geçen bir istekte sayaç zaten
sıfırlanmışsa düşürmek bir sonraki güne fazladan hak verirdi.

## ⚠️ Ücretsiz katman ve veri gizliliği

Google, Gemini API'sinin **ücretsiz** katmanında gönderilen içeriği kendi
hizmetlerini geliştirmek için kullanabiliyor. Kullanıcıların kıyafet
fotoğraflarını gönderdiğimiz için bu, gizlilik politikasında **açıkça
yazılmak zorunda** — yazıldı (`legal/privacy-policy.html`).

Bu maddeyi ortadan kaldırmanın tek yolu Gemini'nin ücretli katmanına
geçmek. Play'in Veri güvenliği formu ile gizlilik politikası birbiriyle
tutarlı olmak zorunda; birinde söyleyip diğerinde saklamak ret sebebi.

## Dağıtımdan sonra

`weather-clothing-app/src/config.js` içindeki `SUNUCU_URL` değerini sunucunun
adresiyle doldur. **Boş bırakıldığı sürece uygulama yapay zeka özelliklerini
hiç göstermez** — v1.0 üretim başvurusu bu yüzden güvenle yapılabiliyor.

Yerelde telefondan test ederken `localhost` işe yaramaz; bilgisayarının yerel
ağ adresini yaz (örn. `http://192.168.1.20:8787`).

## Üretime almadan önce

- [ ] `GEMINI_API_KEY` ayarla
- [ ] `GOOGLE_SERVICE_ACCOUNT_JSON` ayarla — yoksa premium hiç çalışmaz
- [ ] HTTPS arkasına al (Play, düz HTTP'ye izin vermiyor)
- [ ] `krediler.db` kalıcı bir diskte olsun — konteyner yeniden başlayınca
      sıfırlanırsa herkes kredisini yeniler
- [ ] Gizlilik politikasındaki ücretsiz katman maddesini bir kez daha oku
