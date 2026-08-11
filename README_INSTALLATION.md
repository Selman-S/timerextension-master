# Timer Queue Extension - Kurulum

Time sayfasında **timer queue** ve kişisel **billable pulse** panelini içerir.

## Kurulum

1. `chrome://extensions` → Geliştirici modunu aç
2. **Paketlenmemiş öğe yükle** → `timerextension-master` klasörünü seç

## Yenileme (kod değişince)

1. `chrome://extensions` → extension kartında **Yenile**
2. Hyperactive.pro sayfasında hard refresh: `Ctrl + Shift + R`

## Ne çalışır?

- `/time` sayfasında sağ altta queue butonu (📋)
- Queue paneli: sıralı timer ekleme, başlatma, günlük limit
- Timesheet üstünde **Senin Pulse**: bu ay / geçen ay / ortalama / vs ort. + SVG trend

## Script sırası

```
1. queue-manager.js  → Utils, Storage, API, Notification
2. queue-core.js      → QueueManager
3. queue-ui-1/2/3.js + queue-ui.js → UIManager
4. my-pulse.js        → Kişisel billable özet + trend
```

## Storage keys

- `timerQueue_state`
- `timerQueue_items`
- `timerQueue_dailyStats`
- `timerQueue_notifications`
- `timerQueue_templates`
- `timerQueue_recentUsed`
- `timerQueue_settings`
