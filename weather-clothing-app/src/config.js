// Stil sunucusunun adresi.
//
// Sunucuyu (../server) bir yere dağıttıktan sonra bu adresi kendi URL'inle
// değiştir. Boş bırakılırsa uygulama yapay zeka özelliklerini SESSİZCE gizler
// — gardırop ve hava durumu normal çalışmaya devam eder, sadece kombin
// önerisi görünmez. Yayına yanlışlıkla çalışmayan bir buton çıkmasın diye
// böyle kurgulandı.
//
// Geliştirirken telefondan bilgisayara bağlanmak için "localhost" İŞE YARAMAZ;
// bilgisayarının yerel ağ adresini yaz (örn. http://192.168.1.20:8787).
export const SUNUCU_URL = "";

export function sunucuHazirMi() {
  return typeof SUNUCU_URL === "string" && SUNUCU_URL.startsWith("http");
}

// --- Geri bildirim ---------------------------------------------------------

/**
 * Kullanıcı geri bildirimlerinin gideceği adres.
 *
 * DİKKAT: bu adres yayınlanan uygulamanın içinde yer alıyor ve zamanla spam
 * toplayacaktır. Kişisel adresin yerine yalnızca bu iş için açtığın bir
 * adresi (örn. havakiyafet.destek@gmail.com) kullanman daha iyi olur;
 * Play Store künyesinde de aynı adresi verebilirsin.
 */
export const GERI_BILDIRIM_EPOSTA = "ismailguleser@gmail.com";

/**
 * Sürüm bilgisi — geri bildirim e-postasına eklenir.
 *
 * app.json ile AYNI olmak zorunda: hangi sürümden geldiğini bilmeden gelen
 * hata bildirimi işe yaramıyor. Testlerde eşitliği doğruluyoruz ki güncelleme
 * sırasında biri unutulmasın.
 */
export const UYGULAMA_SURUMU = "1.0.0";
export const UYGULAMA_SURUM_KODU = 29;
