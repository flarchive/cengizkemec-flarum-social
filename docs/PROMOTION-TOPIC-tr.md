# Flarum Social 1.1.9 — Flarum'unuzu yaşayan bir topluluk alanına dönüştürün

Selamlar,

Flarum'un güçlü forum altyapısını koruyup üzerine Discord tarzı bir sosyal katman ekleyen **Flarum Social** eklentisinin yeni sürümünü paylaşmaktan mutluluk duyuyorum.

**Canlı örnek:** [warthunder.tr/social](https://warthunder.tr/social)  
**GitHub:** [cengizkemec/flarum-social](https://github.com/cengizkemec/flarum-social)  
**Son sürüm:** [v1.1.9](https://github.com/cengizkemec/flarum-social/releases/tag/v1.1.9)

Flarum Social; klasik forum yapısını bırakmadan topluluğunuza akış, medya, sesli odalar, yazı kanalları ve özel mesajlar eklemek isteyenler için geliştirildi. Tüm sosyal özellikler Flarum'un kullanıcı, grup, izin ve moderasyon altyapısıyla birlikte çalışır.

## Öne çıkanlar

### Sosyal akış
Gönderi, yorum, tepki, kaydetme, hashtag ve @bahsetme desteğiyle tanıdık bir sosyal medya akışı. Gönderilere fotoğraf, video ve dosya eklenebilir; bağlantılar otomatik önizlenir.

### Medya kütüphanesi
Sürükle-bırak, çoklu dosya ve panodan görsel yapıştırma desteği. Görseller için küçük resimler, videolar için oynatıcı, belgeler için indirme bağlantıları ve tam ekran görüntüleyici bulunur.

### Sesli odalar
LiveKit altyapısıyla gerçek zamanlı sesli sohbet. Mikrofon, sağırlaştırma, bas-konuş, ses seviyesi kontrolü, Discord tarzı katılma/ayrılma sesleri ve bağlantı kalitesi göstergesi.

### Ekran paylaşımı
Odadaki herkesin izleyebileceği canlı ekran paylaşımı. Paylaşım başladığında diğer katılımcılara bildirim ve sesli uyarı gider; tarayıcı arka plandaysa masaüstü bildirimi de gönderilebilir.

### Bağlantı bilgisi ve ping grafiği
Son 5 dakikalık gecikmeyi gösteren Discord tarzı ping grafiği; anlık, minimum, ortalama ve maksimum değerler, bağlantı kalitesi, bağlı kalma süresi ve sunucu bilgisi.

### AFK yönetimi
Yönetici tarafından seçilen AFK odası ve süre ile hareketsiz üyeler otomatik olarak taşınır. Mikrofon ve ses kapatılır; üye bildirim üzerinden önceki odasına dönebilir.

### Yazı kanalları ve odalar
Kategorilere ayrılmış kalıcı veya geçici odalar, metin kanalları, şifreli odalar, davet bağlantıları, kapasite sınırları ve oda bazlı moderasyon.

### Özel mesajlar ve hikâyeler
Flarum'un yerel mesajlaşma altyapısıyla uyumlu özel mesajlar; 24 saatlik hikâyeler, görüntüleyen listesi ve hikâye yönetimi.

### Profiller ve sosyal grafik
Kapak görseli, biyografi, takipçi/takip listeleri, arkadaşlık istekleri, rol renkleri, çevrimiçi durumu ve son gönderiler.

### Bildirimler
Uygulama içi bildirimler, isteğe bağlı Centrifugo ile gerçek zamanlı iletim ve ekran paylaşımı gibi olaylar için masaüstü bildirimleri.

### Mobil deneyim
Mobil alt gezinme çubuğu, dokunmatik uyumlu menü, tam ekran medya görüntüleyici ve küçük ekranlarda düzenli yerleşim.

### Yönetim ve moderasyon
Flarum ACP içinde tam yönetim paneli: oda ve kategori yöneticisi, oda sıralaması, izinler, moderasyon kayıtları, raporlar, temizlik araçları ve ses/medya ayarları.

### Entegrasyonlar
- **FoF Upload** ile isteğe bağlı ortak medya depolama
- **FoF Links**, **FoF News Widget**, **FoF Profile Cover** ve **FoF Widgets** desteği
- **flarum/messages** ile yerel mesajlaşma
- **Centrifugo** ile gerçek zamanlı kanallar
- **S3 uyumlu** medya depolama
- **PWA** ve mobil kurulum desteği
- Türkçe ve İngilizce dil desteği

## 1.1.9'da neler var?

- Mobilde Social menü butonunun Flarum'un kendi menü butonu tarafından kapatılması sorunu giderildi.
- Sosyal çekmece, sekmeler, gönderi menüleri ve tepki seçicileri artık anında tepki veriyor.
- Ekran paylaşımı bildirimleri, ping grafiği, AFK odası ve FoF Upload depolama seçeneği önceki sürümlerden itibaren kullanılabilir.
- Veritabanı değişikliği gerektirmez.

## Kurulum

```bash
composer require cengizkemec/flarum-social
php flarum migrate
php flarum assets:publish
php flarum cache:clear
```

Ardından **ACP → Flarum Social** bölümünden eklentiyi etkinleştirip gerekli ayarları yapabilirsiniz.

## Gereksinimler

- Flarum 2.0 veya üzeri
- PHP 8.3 veya üzeri
- Sesli odalar ve ekran paylaşımı için **LiveKit** sunucusu
- İsteğe bağlı: Centrifugo, S3 uyumlu depolama, FoF Upload

## Kimler için?

- Oyun toplulukları ve filolar
- Yayıncılar ve içerik üreticileri
- Yerel topluluklar ve ekipler
- Forumunu Discord benzeri bir merkeze dönüştürmek isteyen Flarum kullanıcıları

Canlı örnek olarak [warthunder.tr/social](https://warthunder.tr/social) adresini inceleyebilirsiniz. Gerçek bir topluluk üzerinde akış, medya, odalar ve sesli sohbet birlikte çalışıyor.

Geri bildirim, hata bildirimi ve katkılar için GitHub deposunu kullanabilirsiniz. Proje **MIT** lisanslıdır ve açık kaynak olarak geliştirilmeye devam ediyor.

**GitHub:** [github.com/cengizkemec/flarum-social](https://github.com/cengizkemec/flarum-social)  
**Sürümler:** [github.com/cengizkemec/flarum-social/releases](https://github.com/cengizkemec/flarum-social/releases)

Görüşlerinizi ve önerilerinizi bekliyorum.
