# 🚀 Hyperactive Pro Timer Queue System

## 📖 Genel Bakış

Bu Chrome eklentisi, Hyperactive Pro zaman takip sistemindeki **59 dakika limit** ve **manuel süre girişi kısıtlaması** sorunlarını çözmek için geliştirilmiştir.

### ❌ Problem
- Manuel süre girişi devre dışı bırakıldı
- Her timer maksimum 59 dakika çalışabiliyor
- Geçmiş tarihler için kayıt eklenemiyor
- Günlük 8 saat limit mevcut

### ✅ Çözüm
**Otomatik Timer Queue (Sıra) Sistemi:**
- Birden fazla time'ı sıraya ekleyin
- Otomatik olarak 59 dakikalık parçalara bölünür
- Sırayla işlenir ve tamamlanır
- Günlük limit kontrolü yapar
- Pause/Resume desteği

---

## 🎯 Özellikler

### 1. ⏱️ Akıllı Queue Yönetimi
- **Otomatik bölme:** 140 dakikalık kayıt → 59dk + 59dk + 22dk
- **Sıralı işlem:** Her kayıt sırayla otomatik işlenir
- **Durum takibi:** Pending → Running → Completed
- **Hata yönetimi:** API hatalarında otomatik retry

### 2. 🎨 Kullanıcı Dostu Arayüz
- **Floating button:** Sağ alt köşede minimal ikon
- **Genişletilebilir panel:** Tüm kontroller tek yerde
- **Drag & drop:** Paneli istediğiniz yere taşıyın
- **Real-time updates:** Anlık ilerleme takibi

### 3. 📊 Detaylı İstatistikler
- Toplam planlanan süre
- Tamamlanan süre
- Günlük kullanım (mevcut/limit)
- Yüzdesel ilerleme

### 4. 🔔 Bildirim Sistemi
- Başarılı işlemler
- Hata bildirimleri
- Uyarılar (günlük limit yaklaşıyor)
- Günlük bildirim geçmişi

### 5. 💾 Akıllı Depolama
- Chrome storage ile kalıcı saklama
- **Günlük otomatik sıfırlama:** Her yeni günde (gece yarısı) queue otomatik temizlenir
- Sayfa yenilendiğinde devam etme (aynı gün içinde)
- Queue durumu gün içinde korunur
- İlk açılışta ve her 5 saniyede tarih kontrolü

### 6. 🛡️ Güvenlik & Kontrol
- Günlük 8 saat limit kontrolü
- Çakışma tespiti (başka tab'da timer)
- Offline durumu algılama
- Tab kapatma uyarısı

---

## 🚀 Kurulum

### 1. Dosyaları Hazırlayın
```
timerextension-master/
├── manifest.json
├── queue-manager.js
├── queue-core.js
├── queue-ui.js
├── content.js (mevcut)
├── libs/
│   ├── chart.min.js
│   └── chartjs-plugin-datalabels.min.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### 2. Chrome'a Yükleyin
1. Chrome'da `chrome://extensions/` adresine gidin
2. Sağ üstten **"Developer mode"** aktif edin
3. **"Load unpacked"** butonuna tıklayın
4. `timerextension-master` klasörünü seçin
5. Eklenti yüklendi! ✅

### 3. Kullanmaya Başlayın
1. `https://hyperactive.pro` sitesine gidin
2. Sağ alt köşede **📋** ikonu görünecek
3. İkona tıklayın ve queue panel'i açılacak

---

## 📱 Kullanım Kılavuzu

### Yeni Time Ekleme

1. **Proje Seçin**
   - Dropdown'dan projenizi seçin
   - Otomatik olarak action itemlar yüklenecek

2. **Action Item Seçin**
   - Departmanlara göre gruplandırılmış liste
   - Billable/Non-billable gösterilir

3. **Task Seçin** (Opsiyonel)
   - Trello/ClickUp task'larınızı arayın
   - Autocomplete ile hızlı seçim

4. **Not Girin**
   - Ne üzerinde çalıştığınızı yazın
   - Emoji desteklenir (backend otomatik temizler)

5. **Süre Girin**
   - Dakika cinsinden (örn: 140)
   - Sistem otomatik 59dk'lık parçalara böler

6. **Queue'ya Ekle**
   - Butona tıklayın
   - Item queue listesine eklenir

### Queue Kontrolü

#### ▶️ Start
- Queue'yu başlatır
- İlk item'dan başlar
- Mevcut çalışan timer varsa durdurur

#### ⏸️ Pause
- Mevcut timer'ı durdurur
- Queue'yu bekletir
- Resume ile kaldığı yerden devam eder

#### ▶️ Resume
- Pause'dan sonra devam eder
- Kaldığı yerden işleme devam eder

#### ⏹️ Stop
- Queue'yu tamamen durdurur
- Mevcut timer kapatılır
- İlerlemeler kayıtlıdır

#### 🗑️ Clear
- Tüm queue'yu temizler
- Tamamlanan kayıtları siler

### Queue Item İşlemleri

Her item üzerinde:
- **✏️ Düzenle:** Bilgileri değiştir (pending ise)
- **🗑️ Sil:** Queue'dan kaldır (running değilse)
- **↑/↓:** Sırada yukarı/aşağı taşı
- **⏭️ Atla:** Mevcut item'ı atla (running ise)

---

## 🔧 Nasıl Çalışır?

### Akış Diyagramı

```
1. Kullanıcı 140dk'lık time ekler
   ↓
2. Queue item oluşturulur
   ↓
3. "Start Queue" tıklanır
   ↓
4. İlk chunk (59dk) için timer başlatılır
   API: POST /time (backend otomatik başlatır)
   ↓
5. 59 dakika sayaç çalışır (her 1dk'da güncelleme)
   ↓
6. 59 dakika dolunca:
   API: POST /time/:id/stop
   ↓
7. Kalan süre var mı? (140 - 59 = 81dk)
   ↓
8. İkinci chunk (59dk) için yeni timer başlatılır
   API: POST /time
   ↓
9. 59 dakika sayaç çalışır
   ↓
10. 59 dakika dolunca:
    API: POST /time/:id/stop
    ↓
11. Kalan süre var mı? (81 - 59 = 22dk)
    ↓
12. Üçüncü chunk (22dk) için yeni timer başlatılır
    API: POST /time
    ↓
13. 22 dakika sayaç çalışır
    ↓
14. 22 dakika dolunca:
    API: POST /time/:id/stop
    ↓
15. Item tamamlandı! ✅
    Sıradaki item'a geç
```

### API İletişimi

**Timer Oluşturma:**
```javascript
POST /api/time?startDate=2026-01-21
Body: {
  projectId: 123,
  taskId: 456,
  trelloId: 789,
  notes: "Logo renk düzenlemesi",
  time: 0  // Backend otomatik başlatır
}
```

**Timer Durdurma:**
```javascript
POST /api/time/12345/stop
// Backend geçen süreyi hesaplar ve kaydeder
```

**Kontrol:**
```javascript
GET /api/time/check?date=2026-01-21
// Çalışan timer var mı kontrol eder
```

---

## 🧪 Test Modu

### Test Modu Devre Dışı

**Varsayılan:** Test modu **KAPALI** (TEST_MODE = false)

Test modu şu anda **devre dışı bırakıldı** çünkü:
- ❌ Backend timer'ları gerçek zamanda çalışıyor
- ❌ UI hızlı ama backend yavaş → senkronizasyon sorunu
- ❌ Timer'lar 0 dakika olarak kaydediliyor

**Production Modda (Şu Anki Durum):**
- ✅ 1 dakika = 1 dakika (gerçek zaman)
- ✅ Backend timer'ı ile tam senkronize
- ✅ Timer kayıtları doğru süre ile oluşuyor
- ℹ️ Panel başlığında "TEST MODE" etiketi görünmüyor

**Test İçin:**
- En az 1-2 dakikalık timer'lar oluşturun
- Gerçek zamanda test edin
- Sayfa yenilendiğinde countdown'un devam ettiğini kontrol edin

**İleride Test Modu (Şimdilik Kullanmayın):**
Test modu backend simülasyonu ile birlikte çalışacak şekilde güncellenecek.

---

## 💡 İpuçları & Püf Noktaları

### ✅ En İyi Pratikler

1. **Gerçekçi Süreler Girin**
   - Tahmini sürenizi biraz yüksek tutun
   - Kesintiler için buffer bırakın

2. **Günlük Limitinizi Planlayın**
   - Sabah queue'nuzu hazırlayın
   - 8 saat limitini aşmayın
   - ⚠️ **Gece yarısı queue otomatik sıfırlanır!**

3. **Günlük Sıfırlama**
   - Her gün queue temiz başlar
   - Önceki günün kayıtları korunmaz
   - İlk açılışta "Yeni gün başladı!" bildirimi gelir
   - Sayfa açık kalsa bile gece yarısında otomatik reset

4. **Düzenli Kontrol**
   - Floating button badge'ine bakın
   - Kalan item sayısını takip edin

4. **Pause Kullanın**
   - Toplantı arası: Pause
   - Mola sonrası: Resume

### ⚠️ Dikkat Edilmesi Gerekenler

1. **Çakışmalardan Kaçının**
   - Başka tab'da timer başlatmayın
   - Queue çalışırken manuel timer açmayın

2. **İnternet Bağlantısı**
   - Queue çalışırken bağlantı gerekli
   - Offline olursanız otomatik pause olur

3. **Tab Kapatma**
   - Queue çalışırken uyarı verir
   - Mutlaka stop edin veya bitirmesini bekleyin

4. **Günlük Sıfırlama**
   - Her gün 00:00'da storage temizlenir
   - Queue yeni güne taşınmaz

---

## 🐛 Sorun Giderme

### Eklenti görünmüyor
- Sayfayı yenileyin (F5)
- Eklentiyi Chrome'da kontrol edin
- Console'da hata var mı bakın (F12)

### Queue başlamıyor
- Günlük limitinizi kontrol edin
- En az 1 pending item olmalı
- İnternet bağlantınızı kontrol edin

### Timer durmuyor
- Manuel "Stop Queue" tıklayın
- Sayfayı yenileyin
- Backend'de timer'ı manuel durdurun

### API hataları
- Console'da hata loglarını kontrol edin
- Token'ınızın geçerli olduğundan emin olun
- Network sekmesinde istekleri inceleyin

---

## 📊 Teknik Detaylar

### Storage Yapısı
```javascript
Chrome Storage Local:
- timerQueue_state: Queue durumu (isRunning, isPaused, vb.)
- timerQueue_items: Queue item'ları (array)
- timerQueue_dailyStats: Günlük istatistikler
- timerQueue_notifications: Bildirimler
- timerQueue_settings: Kullanıcı ayarları
```

### Performans
- **Interval:** 60 saniye (her dakika)
- **Check Interval:** 5 saniye (çakışma kontrolü)
- **UI Update:** 5 saniye
- **API Retry:** 3 deneme, exponential backoff

### Limitler
- **Timer Limit:** 59 dakika
- **Günlük Limit:** 480 dakika (8 saat)
- **Max Queue Size:** Sınırsız (tavsiye: 10-15 item)
- **Notification History:** 50 kayıt

---

## 🔮 Gelecek Özellikler

### Planlanan
- [ ] Şablon (template) desteği
- [ ] Raporlama ekranı
- [ ] Keyboard shortcuts
- [ ] Ses bildirimleri
- [ ] Dark mode
- [ ] Export/Import queue

### Düşünülüyor
- [ ] Birden fazla queue
- [ ] Öncelik sistemi
- [ ] Zaman bloklama (pomodoro)
- [ ] Entegre takvim

---

## 📝 Changelog

### v2.0.0 (21 Ocak 2026)
- ✨ Queue sistem eklendi
- ✨ 59 dakika otomatik bölme
- ✨ Pause/Resume desteği
- ✨ Bildirim sistemi
- ✨ Günlük limit kontrolü
- ✨ Drag & drop panel
- 🎨 Modern UI tasarımı

### v1.1 (Önceki)
- Workload analizi
- Grafik gösterimi
- Reports link

---

## 🤝 Katkıda Bulunma

Bu proje özel kullanım içindir, ancak önerilerinizi paylaşabilirsiniz!

---

## 📞 Destek

Sorun yaşarsanız:
1. Console loglarını kontrol edin (F12 → Console)
2. Network sekmesinde API isteklerini inceleyin
3. Storage'ı kontrol edin (F12 → Application → Storage)

---

## 📜 Lisans

Private Use - Hyperactive Pro için özel geliştirilmiştir.

---

**Son Güncelleme:** 21 Ocak 2026
**Versiyon:** 2.0.0
**Geliştirici:** Timer Queue Team 🚀
