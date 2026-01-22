# Timer Queue System - Detaylı Özellik Dokümantasyonu

## 📋 Genel Bakış
Kullanıcının manuel süre girişi yapamaması nedeniyle, otomatik timer queue (sıra) sistemi geliştiriliyor.

---

## 🎯 Ana Özellikler

### 1. Queue (Sıra) Oluşturma
- **Kullanıcı Girişleri:**
  - Proje seçimi (dropdown)
  - Action Item seçimi (dropdown)
  - Task seçimi (autocomplete)
  - Note girişi (text)
  - Süre girişi (dakika)

- **Örnek Kullanım:**
  ```
  A Projesi - Design - Logo tasarımı - "Logo renk düzenlemesi" - 140dk
  B Projesi - Development - API - "User endpoint" - 100dk
  C Projesi - Testing - Bug Fix - "Login hatası" - 40dk
  ```

### 2. Otomatik Timer Yönetimi
- **59 Dakika Bölümleme:**
  - 140dk → [59dk, 59dk, 22dk] (3 ayrı timer kaydı)
  - Her 59dk'da otomatik stop + yeni start
  - Son parça kalan süre kadar

- **API İşlem Sırası:**
  ```
  1. Mevcut çalışan timer'ı durdur (POST /time/:id/stop)
  2. Yeni timer oluştur (POST /time)
  3. 59 dakika bekle (setInterval)
  4. Timer'ı durdur
  5. Sıradaki item'a geç
  ```

### 3. Queue Kontrolleri
- **Start Queue:** Sırayı başlat
- **Pause Queue:** Sırayı duraklat (mevcut timer durur, queue beklemede kalır)
- **Resume Queue:** Kaldığı yerden devam et
- **Stop Queue:** Tamamen durdur ve sıfırla
- **Clear Queue:** Tüm queue'yu temizle

### 4. Item Yönetimi
- **Düzenleme:** Queue'daki item'ları düzenle
- **Silme:** Tek tek silme
- **Atlama:** Bir item'ı atla, sonrakine geç
- **Sıra Değiştirme:** Drag & drop ile sıralama

### 5. Günlük Sıfırlama (Daily Reset)
- **Otomatik Reset:** Gece yarısı geçtiğinde queue otomatik temizlenir
- **İlk Açılış Kontrolü:** Her gün ilk açılışta tarih kontrolü yapılır
- **Periyodik Kontrol:** Sayfa açık kaldığında her 5 saniyede bir tarih kontrolü
- **Sıfırlanan Veriler:**
  - Queue items (tüm time sırası)
  - Queue state (çalışma durumu)
  - Daily stats (günlük istatistikler)
  - Notifications (bildirimler)
- **Kullanıcı Bildirimi:** "Yeni gün başladı! Queue sıfırlandı. ☀️"

---

## 🎨 UI/UX Tasarımı

### Sağ Alt Köşe İkonu
```
┌────────────────┐
│   📋 Queue     │  ← Minimize edilmiş durum
│   (3 item)     │
└────────────────┘
```

### Genişletilmiş Panel
```
┌─────────────────────────────────────────────────────┐
│  🕐 Timer Queue Manager                    [−] [×]  │
├─────────────────────────────────────────────────────┤
│  [▶ Start] [⏸ Pause] [⏹ Stop] [🗑 Clear]           │
│                                                     │
│  Toplam Süre: 280dk (~4s 40dk) | Kalan: 162dk     │
│  Günlük Limit: 318dk / 480dk (⚠️ 162dk kaldı)     │
│  Progress: ████████░░░░░░░░ 42%                    │
├─────────────────────────────────────────────────────┤
│  📝 Yeni Time Ekle                                  │
│  Proje:      [▼ A Projesi              ]           │
│  Action:     [▼ Design                 ]           │
│  Task:       [🔍 Logo tasarımı         ]           │
│  Note:       [  Logo renk düzenlemesi  ]           │
│  Süre (dk):  [  140                    ]           │
│              [+ Ekle] [📋 Şablon Ekle]             │
├─────────────────────────────────────────────────────┤
│  📋 Queue Listesi (3 item)                         │
│                                                     │
│  ✅ 1. A Projesi - Design - Logo                   │
│      "Logo renk düzenlemesi" - 140dk               │
│      Durum: ████████████████████ 100% (Tamamlandı) │
│      Planlanan: 140dk | Gerçek: 118dk (59+59)     │
│      [✏] [🗑] [↓]                                  │
│                                                     │
│  ▶️ 2. B Projesi - Development - API  ← AKTİF      │
│      "User endpoint" - 100dk                       │
│      Durum: ████████░░░░░░░░░░░ 42% (42dk/100dk)  │
│      [⏸] [✏] [🗑] [⏭]                             │
│                                                     │
│  ⏳ 3. C Projesi - Testing - Bug Fix               │
│      "Login hatası" - 40dk                         │
│      Durum: ░░░░░░░░░░░░░░░░░░░ 0% (Bekliyor)     │
│      [✏] [🗑] [↑]                                  │
├─────────────────────────────────────────────────────┤
│  📊 Bugünkü Özet                                   │
│  Tamamlanan: 2 time | Başarı: 84% | Fark: -22dk   │
│                                                     │
│  ⚠️ Bildirimler (Bugün)                            │
│  • 14:32 - API hatası: B Projesi timer oluşturul..│
│  • 15:10 - Günlük limit %80'e ulaştı              │
└─────────────────────────────────────────────────────┘
```

---

## 💾 Storage Yapısı

```javascript
{
  "queueState": {
    "isRunning": false,
    "isPaused": false,
    "currentIndex": 0,
    "startTime": null,
    "pauseTime": null,
    "totalPauseTime": 0
  },
  "queue": [
    {
      "id": "uuid-1",
      "projectId": 123,
      "projectName": "A Projesi",
      "taskId": 456,
      "taskName": "Design",
      "trelloId": 789,
      "trelloTitle": "Logo tasarımı",
      "notes": "Logo renk düzenlemesi",
      "totalDuration": 140,        // Planlanan
      "remainingDuration": 140,    // Kalan
      "completedDuration": 0,      // Tamamlanan
      "status": "pending",         // pending | running | completed | error
      "createdAt": "2026-01-21T10:00:00",
      "startedAt": null,
      "completedAt": null,
      "timerIds": [],              // Oluşturulan timer ID'leri
      "currentTimerId": null,
      "error": null
    }
  ],
  "dailyStats": {
    "date": "2026-01-21",
    "totalPlanned": 280,
    "totalCompleted": 118,
    "totalRemaining": 162,
    "dailyLimit": 480,
    "dailyUsed": 318
  },
  "notifications": [
    {
      "id": "notif-1",
      "type": "error",            // error | warning | info | success
      "message": "API hatası: Timer oluşturulamadı",
      "timestamp": "2026-01-21T14:32:00",
      "read": false
    }
  ],
  "templates": [
    {
      "id": "template-1",
      "name": "Günlük Rutin",
      "items": [
        { "projectId": 123, "taskId": 456, "notes": "Daily meeting", "duration": 30 },
        { "projectId": 123, "taskId": 789, "notes": "Email check", "duration": 20 }
      ]
    }
  ],
  "recentUsed": [
    {
      "projectId": 123,
      "projectName": "A Projesi",
      "taskId": 456,
      "taskName": "Design"
    }
  ]
}
```

---

## 🔄 İş Akışı (Workflow)

### Queue Başlatma
```
1. Kullanıcı "Start Queue" tıklar
2. queueState.isRunning = true
3. currentIndex = 0 (ilk item)
4. Mevcut çalışan timer'ı durdur (API: POST /time/{id}/stop)
5. İlk queue item için timer oluştur
6. processQueueItem() fonksiyonu çalışır
```

### Queue Item İşleme
```
processQueueItem(index):
  1. item = queue[index]
  2. item.status = 'running'
  3. Günlük limit kontrolü (dailyUsed + item.remainingDuration <= 480)
  4. Timer oluştur (API: POST /time)
     body: {
       projectId, taskId, trelloId, notes,
       time: 0  // Backend otomatik başlatır
     }
  5. Response'dan timer.id al
  6. item.timerIds.push(timer.id)
  7. item.currentTimerId = timer.id
  8. Süre sayacı başlat:
     - Her 1dk'da remainingDuration--
     - Her 1dk'da completedDuration++
     - UI'ı güncelle
  9. 59 dakika veya item.remainingDuration dolunca:
     - Timer durdur (API: POST /time/{id}/stop)
     - Eğer remainingDuration > 0:
       → Yeni timer başlat (adım 4'e dön)
     - Yoksa:
       → item.status = 'completed'
       → currentIndex++
       → processQueueItem(currentIndex)
```

### Pause İşlemi
```
1. Kullanıcı "Pause" tıklar
2. Mevcut timer'ı durdur (API: POST /time/{currentTimerId}/stop)
3. queueState.isPaused = true
4. queueState.pauseTime = now()
5. Interval'i durdur (clearInterval)
```

### Resume İşlemi
```
1. Kullanıcı "Resume" tıklar
2. Pause süresini hesapla
3. queueState.totalPauseTime += (now() - pauseTime)
4. queueState.isPaused = false
5. Yeni timer başlat (kaldığı yerden)
6. Interval'i yeniden başlat
```

---

## 🛡️ Hata Yönetimi ve Güvenlik

### API Retry Mekanizması
```javascript
async function apiCallWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (i === maxRetries - 1) {
        // Son deneme de başarısız
        addNotification({
          type: 'error',
          message: `API hatası: ${error.message}`
        });
        throw error;
      }
      // 2^i * 1000ms bekle (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}
```

### Günlük Limit Kontrolü
```javascript
function checkDailyLimit(additionalMinutes) {
  const { dailyUsed, dailyLimit } = storage.dailyStats;
  const newTotal = dailyUsed + additionalMinutes;
  
  if (newTotal > dailyLimit) {
    addNotification({
      type: 'error',
      message: `Günlük limit aşımı! (${newTotal}/${dailyLimit}dk)`
    });
    return false;
  }
  
  // %80 uyarısı
  if (newTotal >= dailyLimit * 0.8 && dailyUsed < dailyLimit * 0.8) {
    addNotification({
      type: 'warning',
      message: 'Günlük limitin %80\'ine ulaştın!'
    });
  }
  
  return true;
}
```

### Çakışma Kontrolü
```javascript
// Başka tabda timer başlatılmış mı kontrol et
setInterval(async () => {
  const response = await fetch('/api/time/check');
  const { time } = await response.json();
  
  if (time && time.isStarting && !isOurTimer(time.id)) {
    pauseQueue();
    addNotification({
      type: 'warning',
      message: 'Başka bir sekmede timer başlatıldı. Queue duraklatıldı.'
    });
  }
}, 5000);
```

### Offline Durumu
```javascript
window.addEventListener('offline', () => {
  if (queueState.isRunning) {
    pauseQueue();
    addNotification({
      type: 'warning',
      message: 'İnternet bağlantısı kesildi. Queue duraklatıldı.'
    });
  }
});

window.addEventListener('online', () => {
  addNotification({
    type: 'info',
    message: 'İnternet bağlantısı geri geldi.'
  });
});
```

### Tab Kapatma Uyarısı
```javascript
window.addEventListener('beforeunload', (e) => {
  if (queueState.isRunning) {
    e.preventDefault();
    e.returnValue = 'Queue çalışıyor. Emin misiniz?';
    return e.returnValue;
  }
});
```

---

## 🎹 Keyboard Shortcuts

- `Enter` - Queue'ya ekle / Düzenlemeyi kaydet
- `Esc` - Düzenleme modundan çık
- `Delete` - Seçili item'ı sil
- `Space` - Queue başlat/duraklat
- `↑/↓` - Item sırasını değiştir
- `Ctrl+S` - Şablon olarak kaydet

---

## 🔊 Bildirim Sistemi

### Ses Bildirimleri (Opsiyonel)
```javascript
const sounds = {
  itemCompleted: new Audio('/sounds/complete.mp3'),
  queueCompleted: new Audio('/sounds/finish.mp3'),
  error: new Audio('/sounds/error.mp3')
};

function playSound(type) {
  if (settings.soundEnabled) {
    sounds[type].play();
  }
}
```

### Browser Notifications
```javascript
if (Notification.permission === 'granted') {
  new Notification('Timer Queue', {
    body: 'B Projesi tamamlandı! (100dk)',
    icon: '/icons/icon128.png'
  });
}
```

---

## 📊 Raporlama

### Günlük Özet
```javascript
{
  "date": "2026-01-21",
  "totalItems": 5,
  "completedItems": 3,
  "totalPlanned": 280,      // Toplam planlanan
  "totalActual": 236,       // Gerçek harcanan (59+59+59+59 vs 140+100)
  "difference": -44,        // Fark (negatif = az harcandı)
  "successRate": 0.84,      // 84% başarı
  "averageAccuracy": 0.92   // Ortalama doğruluk
}
```

---

## 🚀 Optimizasyonlar

### Lazy Loading
- Proje/task listelerini sadece dropdown açıldığında yükle

### Debounce
- Autocomplete için 300ms debounce

### Cache
- Son kullanılan proje/task'ları cache'le

### Minimize State Updates
- UI güncellemelerini requestAnimationFrame ile grupla

---

## 🧪 Test Senaryoları

1. **Normal Akış:** 3 item ekle, queue başlat, tamamlanmasını bekle
2. **Pause/Resume:** Ortada pause et, 5dk bekle, resume et
3. **Manuel Stop:** Kullanıcı ortadaki timer'ı manuel durdurur
4. **Limit Aşımı:** 8 saatten fazla eklemeye çalış
5. **API Hatası:** Network'ü kes, retry'ı test et
6. **Tab Kapatma:** Queue çalışırken tab'ı kapat
7. **Çakışma:** İki tab'da queue başlat
8. **Offline:** İnternet kesilince ne olur
9. **Sayfa Yenileme:** Queue çalışırken F5 bas
10. **Drag & Drop:** Sıralamayı değiştir

---

## 📝 Notlar

- Storage günlük sıfırlanır (yeni gün başladığında)
- Bildirimler günlük bazda saklanır
- Şablonlar kalıcı saklanır
- Recent used son 10 item tutulur

---

## 🎯 Geliştirme Öncelikleri

### Phase 1 (MVP)
- [x] Queue oluşturma UI
- [x] Basit timer yönetimi (59dk bölme yok)
- [x] Storage implementasyonu
- [x] Start/Stop fonksiyonları

### Phase 2 (Core)
- [ ] 59dk otomatik bölme
- [ ] Pause/Resume
- [ ] Günlük limit kontrolü
- [ ] Hata yönetimi

### Phase 3 (Enhanced)
- [ ] Drag & drop
- [ ] Şablonlar
- [ ] Raporlama
- [ ] Keyboard shortcuts

### Phase 4 (Polish)
- [ ] Ses bildirimleri
- [ ] Browser notifications
- [ ] Offline support
- [ ] Animasyonlar

---

**Son Güncelleme:** 21 Ocak 2026
