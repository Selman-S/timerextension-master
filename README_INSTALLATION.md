# Timer Queue Extension - Kurulum ve Yenileme Talimatları

## İlk Kurulum

1. **Chrome'da Extension Sayfasını Açın**
   - Tarayıcınızda `chrome://extensions` adresine gidin
   - Veya Menü → Daha Fazla Araç → Uzantılar

2. **Geliştirici Modunu Aktifleştirin**
   - Sağ üst köşedeki "Geliştirici modu" (Developer mode) anahtarını açın

3. **Extension'ı Yükleyin**
   - "Paketlenmemiş öğe yükle" (Load unpacked) butonuna tıklayın
   - `timerextension-master` klasörünü seçin
   - "Klasör Seç" butonuna tıklayın

## Extension'ı Yeniden Yükle (Kod Değişikliklerinden Sonra)

### Yöntem 1: Hızlı Yenileme
1. `chrome://extensions` sayfasına gidin
2. "Hyperactive Pro Time Enhancer" kartını bulun
3. Yenile ⟳ butonuna tıklayın

### Yöntem 2: Tam Cache Temizleme (Önerilen)
1. `chrome://extensions` sayfasına gidin
2. "Hyperactive Pro Time Enhancer" extension'ını **KALDIR** (Remove)
3. Tarayıcıyı **tamamen kapatın** (tüm pencereler)
4. Chrome'u yeniden açın
5. `chrome://extensions` sayfasına gidin
6. "Paketlenmemiş öğe yükle" ile tekrar yükleyin

### Yöntem 3: Extension ID Koruma (Geliştirme İçin)
1. `chrome://extensions` sayfasında extension ID'yi kopyalayın
2. Yenile butonuna tıklayın
3. Hyperactive.pro sayfasını **Hard Refresh** yapın:
   - Windows/Linux: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

## Hata Ayıklama

### Console Hatalarını Kontrol Etme
1. Hyperactive.pro sayfasını açın
2. F12 tuşuna basın (Developer Tools)
3. "Console" sekmesine gidin
4. Hataları kontrol edin

### Background Script Hatalarını Kontrol Etme
1. `chrome://extensions` sayfasına gidin
2. Extension kartında "Hataları görüntüle" linkine tıklayın (varsa)
3. Veya extension kartında "service worker" linkine tıklayın

### Extension Çalışıyor mu Kontrol
1. Hyperactive.pro sayfasını açın
2. Sağ altta **📋** (clipboard) ikonu görünmeli
3. Time sayfasında grafik ikonu ve bilgi kutusu görünmeli
4. Reports linki sol menüde görünmeli

## Sık Karşılaşılan Sorunlar

### 1. "Cannot read properties of null" Hatası
**Sebep:** Browser eski kodu cache'lemiş
**Çözüm:** 
- Extension'ı kaldırıp yeniden yükleyin
- Sayfayı Hard Refresh yapın (Ctrl+Shift+R)

### 2. "Utils is not defined" Hatası
**Sebep:** Script yükleme sırası bozulmuş
**Çözüm:**
- Extension'ı tamamen kaldırıp yeniden yükleyin
- manifest.json dosyasının değişmediğinden emin olun

### 3. Queue Butonu Görünmüyor
**Sebep:** Script henüz yüklenmemiş veya sayfa hazır değil
**Çözüm:**
- Sayfayı yenileyin
- Console'da hata var mı kontrol edin
- Extension'ın aktif olduğundan emin olun

### 4. API Çağrıları Çalışmıyor
**Sebep:** Authorization token alınamıyor
**Çözüm:**
- Hyperactive.pro'ya giriş yapın
- Sayfayı yenileyin
- localStorage'da 'user' anahtarını kontrol edin

## Test Checklist

Extension yüklendikten sonra kontrol edin:

- [ ] Extension `chrome://extensions` sayfasında aktif görünüyor
- [ ] Hyperactive.pro sayfası açıldığında console'da hata yok
- [ ] Sağ altta 📋 queue butonu görünüyor
- [ ] Queue butonuna tıklayınca panel açılıyor
- [ ] Time sayfasında bilgi kutusu ve grafik ikonu var
- [ ] Sol menüde "Reports" linki var
- [ ] Workload sayfasında "Markalarım — Workload" paneli görünüyor

## Geliştirme Notları

### Script Yükleme Sırası (manifest.json)
```
1. libs/chart.min.js
2. libs/chartjs-plugin-datalabels.min.js
3. queue-manager.js    → Utils, Storage, API, Notification export
4. queue-core.js        → QueueManager export
5. queue-ui.js          → UIManager export
6. content.js           → Mevcut özellikler
```

### Global Variables
Extension şu global değişkenleri kullanır:
- `window.Utils`
- `window.CONFIG`
- `window.STORAGE_KEYS`
- `window.StorageManager`
- `window.APIManager`
- `window.NotificationManager`
- `window.QueueManager`
- `window.UIManager`

### Storage Keys
LocalStorage'da şu anahtarlar kullanılır:
- `timerQueue_state`
- `timerQueue_items`
- `timerQueue_dailyStats`
- `timerQueue_notifications`
- `timerQueue_templates`
- `timerQueue_recentUsed`
- `timerQueue_settings`
