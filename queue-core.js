// Timer Queue Manager - Core Logic (Part 2)
// Queue processing and management

(() => {
  'use strict';

  // Assuming CONFIG, Utils, StorageManager, APIManager, NotificationManager are already defined

  // ============================================================================
  // QUEUE MANAGER - Core Logic
  // ============================================================================

  const QueueManager = {
    // Current processing state
    currentTimer: null,
    processingInterval: null,
    checkInterval: null,
    lastCheck: null,

    // Initialize queue manager
    init: async () => {
      const initResult = await StorageManager.init();
      
      // Show notification if daily reset occurred
      if (initResult && initResult.needsReset) {
        await NotificationManager.add('info', 'Yeni gün başladı! Queue sıfırlandı. ☀️');
      }
      
      // Check if queue was running before page refresh
      const data = await StorageManager.getAll();
      if (data.queueState.isRunning && !data.queueState.isPaused) {
        // Resume queue (only if not reset)
        if (!initResult || !initResult.needsReset) {
          console.log('Queue devam ediyor, running item kontrol ediliyor...');
          
          // Check if there's a running item with active timer
          const currentItem = data.queue[data.queueState.currentIndex];
          if (currentItem && currentItem.status === 'running' && currentItem.currentTimerId && currentItem.currentChunkStart) {
            console.log('Running item bulundu, geçen süre hesaplanıyor...', currentItem.currentTimerId);
            
            try {
              // Calculate elapsed time from stored start time
              const startTime = new Date(currentItem.currentChunkStart).getTime();
              const now = Date.now();
              const elapsedMs = now - startTime;
              const elapsedMinutes = CONFIG.TEST_MODE 
                ? Math.floor(elapsedMs / 1000) // seconds in test mode
                : Math.floor(elapsedMs / 60000); // minutes in production
              
              console.log('Elapsed time:', elapsedMinutes, CONFIG.TEST_MODE ? 'seconds' : 'minutes');
              
              // Calculate remaining time for current chunk
              const currentChunkDuration = currentItem.currentChunkDuration || Math.min(currentItem.remainingDuration, CONFIG.TIMER_LIMIT);
              const remainingInChunk = Math.max(0, currentChunkDuration - elapsedMinutes);
              
              console.log('Current chunk duration:', currentChunkDuration, 'Remaining:', remainingInChunk);
              
              if (remainingInChunk > 0) {
                // Resume countdown with remaining time
                console.log('Countdown kalan süre ile başlatılıyor:', remainingInChunk);
                await QueueManager.resumeCountdown(data.queueState.currentIndex, remainingInChunk, elapsedMinutes);
              } else {
                // Chunk should be completed, complete it now
                console.log('Chunk zaten tamamlanmış, complete ediliyor...');
                await QueueManager.completeChunk(data.queueState.currentIndex);
              }
            } catch (error) {
              console.error('Error checking timer status:', error);
              // Fallback to normal resume
              await QueueManager.processNext();
            }
          } else {
            console.log('Running item yok veya start time yok, processNext çağrılıyor');
            await QueueManager.processNext();
          }
        }
      }

      // Start periodic checks
      QueueManager.startPeriodicCheck();
    },

    // Start queue processing
    start: async () => {
      const data = await StorageManager.getAll();
      
      if (data.queue.length === 0) {
        await NotificationManager.add('warning', 'Queue boş! Önce time ekleyin.');
        return false;
      }

      // Check daily limit
      const dailyTotal = await APIManager.getDailyTotal();
      const queueTotal = data.queue.reduce((sum, item) => 
        sum + (item.status === 'pending' ? item.totalDuration : 0), 0
      );

      if (dailyTotal + queueTotal > Utils.getDailyLimitMinutes()) {
        await NotificationManager.add('error', 
          `Günlük limit aşımı! Mevcut: ${Utils.formatMinutes(dailyTotal)}, Queue: ${Utils.formatMinutes(queueTotal)}`
        );
        return false;
      }

      // Backend middleware will automatically stop any running timer when we create a new one
      // No need to manually check and stop here

      // Update state
      data.queueState.isRunning = true;
      data.queueState.isPaused = false;
      data.queueState.startTime = new Date().toISOString();
      data.queueState.currentIndex = data.queue.findIndex(item => item.status === 'pending');
      
      if (data.queueState.currentIndex === -1) {
        data.queueState.currentIndex = 0;
      }

      await StorageManager.set(STORAGE_KEYS.QUEUE_STATE, data.queueState);
      await NotificationManager.add('success', 'Queue başlatıldı! Sayfa yenileniyor...');
      await NotificationManager.playSound('success');

      // Reload page once to show the first timer
      setTimeout(() => {
        window.location.reload();
      }, 1500);

      // Start processing (will continue after reload from localStorage)
      await QueueManager.processNext();
      
      return true;
    },

    // Process next item in queue
    processNext: async () => {
      console.log('processNext çağrıldı');
      const data = await StorageManager.getAll();
      const { currentIndex } = data.queueState;
      const currentItem = data.queue[currentIndex];

      console.log('Current index:', currentIndex, 'Queue length:', data.queue.length);

      if (!currentItem) {
        // Queue completed
        console.log('Queue tamamlandı!');
        await QueueManager.complete();
        return;
      }

      console.log('Current item:', currentItem.projectName, 'Status:', currentItem.status);

      if (currentItem.status === 'completed') {
        // Skip completed items
        console.log('Completed item atlanıyor...');
        data.queueState.currentIndex++;
        await StorageManager.set(STORAGE_KEYS.QUEUE_STATE, data.queueState);
        await QueueManager.processNext();
        return;
      }

      // Process current item
      console.log('Item işleniyor...');
      await QueueManager.processItem(currentIndex);
    },

    // Process single queue item
    processItem: async (index) => {
      const data = await StorageManager.getAll();
      const item = data.queue[index];

      if (!item || item.status === 'completed') return;

      // Check existing timers for this project+task to avoid duplicates
      try {
        const dailyTimers = await APIManager.getDailyTimers();
        if (dailyTimers.success && dailyTimers.timers && dailyTimers.timers.length > 0) {
          const todayIndex = new Date().getDay();
          const todayTimers = dailyTimers.timers[(todayIndex + 6) % 7] || [];
          
          // Calculate already logged time for same project+task
          const existingTime = todayTimers
            .filter(t => 
              t.projectId === item.projectId && 
              t.taskId === item.taskId &&
              !item.timerIds.includes(t.id) // Exclude our own timers
            )
            .reduce((sum, t) => sum + (parseInt(t.total_time) || 0), 0);

          if (existingTime > 0) {
            await NotificationManager.add('info', 
              `${item.projectName} - ${item.taskName}: ${Utils.formatMinutes(existingTime)} zaten girilmiş`
            );
            
            // Adjust remaining duration
            if (existingTime >= item.totalDuration) {
              // Already completed manually
              item.status = 'completed';
              item.completedDuration = item.totalDuration;
              item.remainingDuration = 0;
              data.queue[index] = item;
              await StorageManager.set(STORAGE_KEYS.QUEUE_ITEMS, data.queue);
              
              await NotificationManager.add('success', 
                `${item.projectName} - ${item.taskName}: Manuel olarak tamamlanmış, atlanıyor`
              );
              
              // Move to next item
              data.queueState.currentIndex++;
              await StorageManager.set(STORAGE_KEYS.QUEUE_STATE, data.queueState);
              setTimeout(() => QueueManager.processNext(), 1000);
              return;
            }
          }
        }
      } catch (error) {
        console.error('Error checking existing timers:', error);
        // Continue anyway
      }

      // Update item status
      item.status = 'running';
      if (!item.startedAt) {
        item.startedAt = new Date().toISOString();
      }

      data.queue[index] = item;
      await StorageManager.set(STORAGE_KEYS.QUEUE_ITEMS, data.queue);

      // Calculate how much time to process in this chunk
      const chunkDuration = Math.min(item.remainingDuration, CONFIG.TIMER_LIMIT);

      try {
        // Create timer via API
        const response = await APIManager.createTimer({
          projectId: item.projectId,
          taskId: item.taskId,
          trelloId: item.trelloId,
          notes: item.notes,
        });

        if (!response.success) {
          throw new Error(response.message || 'Timer oluşturulamadı');
        }

        const timerId = response.time.id;
        item.timerIds.push(timerId);
        item.currentTimerId = timerId;
        item.currentChunkStart = new Date().toISOString(); // Store chunk start time
        item.currentChunkDuration = chunkDuration; // Store chunk duration

        data.queue[index] = item;
        await StorageManager.set(STORAGE_KEYS.QUEUE_ITEMS, data.queue);

        await NotificationManager.add('success', 
          `${item.projectName} - ${item.taskName}: ${Utils.formatMinutes(chunkDuration)} başlatıldı`
        );

        // Start countdown
        await QueueManager.startCountdown(index, chunkDuration);

      } catch (error) {
        console.error('Error processing item:', error);
        item.status = 'error';
        item.error = error.message;
        data.queue[index] = item;
        await StorageManager.set(STORAGE_KEYS.QUEUE_ITEMS, data.queue);
        
        await NotificationManager.add('error', 
          `Hata: ${item.projectName} - ${error.message}`
        );

        // Try next item after error
        data.queueState.currentIndex++;
        await StorageManager.set(STORAGE_KEYS.QUEUE_STATE, data.queueState);
        setTimeout(() => QueueManager.processNext(), 3000);
      }
    },

    // Resume countdown from where it left off
    resumeCountdown: async (index, remainingDuration, alreadyElapsed = 0) => {
      console.log(`Countdown devam ediyor: ${remainingDuration} kalan, ${alreadyElapsed} geçti`);
      
      const intervalTime = CONFIG.TEST_MODE ? 1000 : CONFIG.COUNTDOWN_INTERVAL;
      const startTime = Date.now();
      let elapsed = alreadyElapsed;
      
      // Store initial remaining duration for this chunk resume
      const data = await StorageManager.getAll();
      const initialRemaining = data.queue[index].remainingDuration;
      const originalChunkDuration = remainingDuration + alreadyElapsed;
      
      // Clear any existing interval
      if (QueueManager.processingInterval) {
        clearInterval(QueueManager.processingInterval);
      }

      console.log(`Initial remaining: ${initialRemaining}, original chunk: ${originalChunkDuration}`);

      QueueManager.processingInterval = setInterval(async () => {
        // Calculate elapsed time based on actual time
        const actualElapsed = CONFIG.TEST_MODE 
          ? Math.floor((Date.now() - startTime) / 1000) 
          : Math.floor((Date.now() - startTime) / 60000);

        // Update item progress
        const data = await StorageManager.getAll();
        const item = data.queue[index];
        
        if (!item || data.queueState.isPaused) {
          clearInterval(QueueManager.processingInterval);
          QueueManager.processingInterval = null;
          return;
        }

        // Total elapsed including what was already done
        const totalElapsed = alreadyElapsed + actualElapsed;
        
        // Calculate progress: how much is left in this chunk
        const progressInThisSession = Math.min(actualElapsed, remainingDuration);
        
        // Update remaining: initial - progress in this session
        item.remainingDuration = Math.max(0, initialRemaining - progressInThisSession);
        item.completedDuration = item.totalDuration - item.remainingDuration;
        
        data.queue[index] = item;
        await StorageManager.set(STORAGE_KEYS.QUEUE_ITEMS, data.queue);

        // Update daily stats (only increment once per minute)
        if (totalElapsed > elapsed) {
          const increment = totalElapsed - elapsed;
          data.dailyStats.dailyUsed += increment;
          data.dailyStats.totalCompleted += increment;
          data.dailyStats.totalRemaining = Math.max(0, data.dailyStats.totalRemaining - increment);
          await StorageManager.set(STORAGE_KEYS.DAILY_STATS, data.dailyStats);
          elapsed = totalElapsed;
        }

        console.log(`Countdown (resumed): ${totalElapsed}/${originalChunkDuration} - Item remaining: ${item.remainingDuration}`);

        // Check if chunk completed
        if (actualElapsed >= remainingDuration) {
          console.log('Chunk tamamlandı (resumed), completeChunk çağrılıyor...');
          clearInterval(QueueManager.processingInterval);
          QueueManager.processingInterval = null;
          await QueueManager.completeChunk(index);
          return;
        }

        // Update UI
        window.dispatchEvent(new CustomEvent('queue-progress-update'));
      }, intervalTime);
    },

    // Start countdown for current chunk
    startCountdown: async (index, duration) => {
      let elapsed = 0;
      const intervalTime = CONFIG.TEST_MODE ? 1000 : CONFIG.COUNTDOWN_INTERVAL; // 1s for test, 60s for production
      const startTime = Date.now();
      
      // Store initial remaining duration for this chunk
      const data = await StorageManager.getAll();
      const initialRemaining = data.queue[index].remainingDuration;
      
      // Clear any existing interval
      if (QueueManager.processingInterval) {
        clearInterval(QueueManager.processingInterval);
      }

      console.log(`Countdown başladı: ${duration} dakika, interval: ${intervalTime}ms, initial remaining: ${initialRemaining}`);

      QueueManager.processingInterval = setInterval(async () => {
        // Calculate elapsed time based on actual time (more accurate)
        const actualElapsed = CONFIG.TEST_MODE 
          ? Math.floor((Date.now() - startTime) / 1000) // seconds in test mode
          : Math.floor((Date.now() - startTime) / 60000); // minutes in production

        // Update item progress
        const data = await StorageManager.getAll();
        const item = data.queue[index];
        
        if (!item || data.queueState.isPaused) {
          clearInterval(QueueManager.processingInterval);
          QueueManager.processingInterval = null;
          return;
        }

        // Calculate progress for this chunk only
        const progressMinutes = Math.min(actualElapsed, duration); // Can't exceed chunk duration
        
        // Update remaining duration: initial - progress
        item.remainingDuration = Math.max(0, initialRemaining - progressMinutes);
        item.completedDuration = item.totalDuration - item.remainingDuration;
        
        data.queue[index] = item;
        await StorageManager.set(STORAGE_KEYS.QUEUE_ITEMS, data.queue);

        // Update daily stats (only increment once per minute)
        if (progressMinutes > elapsed) {
          const increment = progressMinutes - elapsed;
          data.dailyStats.dailyUsed += increment;
          data.dailyStats.totalCompleted += increment;
          data.dailyStats.totalRemaining = Math.max(0, data.dailyStats.totalRemaining - increment);
          await StorageManager.set(STORAGE_KEYS.DAILY_STATS, data.dailyStats);
          elapsed = progressMinutes;
        }

        console.log(`Countdown: ${actualElapsed}/${duration} - Progress: ${progressMinutes} - Item remaining: ${item.remainingDuration}`);

        // Check if chunk completed
        if (actualElapsed >= duration) {
          console.log('Chunk tamamlandı, completeChunk çağrılıyor...');
          clearInterval(QueueManager.processingInterval);
          QueueManager.processingInterval = null;
          await QueueManager.completeChunk(index);
          return;
        }

        // Update UI
        window.dispatchEvent(new CustomEvent('queue-progress-update'));
      }, intervalTime);
    },

    // Complete current chunk
    completeChunk: async (index) => {
      console.log('completeChunk çağrıldı, index:', index);
      const data = await StorageManager.getAll();
      const item = data.queue[index];

      if (!item) {
        console.log('completeChunk: Item bulunamadı!');
        return;
      }

      console.log('completeChunk: Item bulundu, remainingDuration:', item.remainingDuration);

      try {
        // Stop current timer (if still running)
        if (item.currentTimerId) {
          console.log('Timer durduruluyor, ID:', item.currentTimerId);
          try {
            await APIManager.stopTimer(item.currentTimerId);
            console.log('Timer durduruldu');
          } catch (stopError) {
            // Timer might already be stopped (e.g., after page reload)
            // This is fine, continue processing
            console.log('Timer stop hatası (muhtemelen zaten durdurulmuş):', stopError.message);
          }
          
          // Clear current timer info
          item.currentTimerId = null;
          item.currentChunkStart = null;
          item.currentChunkDuration = null;
        }

        // Check if item fully completed
        if (item.remainingDuration <= 0) {
          console.log('Item tamamen tamamlandı!');
          item.status = 'completed';
          item.completedAt = new Date().toISOString();
          
          data.queue[index] = item;
          await StorageManager.set(STORAGE_KEYS.QUEUE_ITEMS, data.queue);

          await NotificationManager.add('success', 
            `✅ ${item.projectName} - ${item.taskName} tamamlandı!`
          );
          await NotificationManager.playSound('success');

          // Move to next item
          console.log('Sonraki item\'a geçiliyor, sayfa yenileniyor...');
          data.queueState.currentIndex++;
          await StorageManager.set(STORAGE_KEYS.QUEUE_STATE, data.queueState);
          
          // Reload page to show updated timers and continue with next item
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          // More chunks needed, start next chunk immediately
          console.log('Daha fazla chunk gerekli, sonraki chunk başlatılıyor. Kalan:', item.remainingDuration);
          setTimeout(() => QueueManager.processItem(index), 1000);
        }

      } catch (error) {
        console.error('Error completing chunk:', error);
        await NotificationManager.add('error', `Hata: ${error.message}`);
      }
    },

    // Pause queue
    pause: async () => {
      const data = await StorageManager.getAll();
      
      if (!data.queueState.isRunning) {
        await NotificationManager.add('warning', 'Queue çalışmıyor!');
        return false;
      }

      // Stop current timer
      const currentItem = data.queue[data.queueState.currentIndex];
      if (currentItem && currentItem.currentTimerId) {
        try {
          await APIManager.stopTimer(currentItem.currentTimerId);
        } catch (error) {
          console.error('Error stopping timer:', error);
        }
      }

      // Clear intervals
      if (QueueManager.processingInterval) {
        clearInterval(QueueManager.processingInterval);
      }

      data.queueState.isPaused = true;
      data.queueState.pauseTime = new Date().toISOString();
      
      await StorageManager.set(STORAGE_KEYS.QUEUE_STATE, data.queueState);
      await NotificationManager.add('info', 'Queue duraklatıldı. Sayfa yenileniyor...');
      
      // Reload page to show updated timers
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
      return true;
    },

    // Resume queue
    resume: async () => {
      const data = await StorageManager.getAll();
      
      if (!data.queueState.isPaused) {
        await NotificationManager.add('warning', 'Queue zaten çalışıyor!');
        return false;
      }

      // Calculate pause duration
      if (data.queueState.pauseTime) {
        const pauseDuration = Date.now() - new Date(data.queueState.pauseTime).getTime();
        data.queueState.totalPauseTime += pauseDuration;
      }

      data.queueState.isPaused = false;
      data.queueState.pauseTime = null;
      
      await StorageManager.set(STORAGE_KEYS.QUEUE_STATE, data.queueState);
      await NotificationManager.add('success', 'Queue devam ediyor. Sayfa yenileniyor...');

      // Reload page to show updated timers and continue
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
      return true;
    },

    // Stop queue completely
    stop: async () => {
      const data = await StorageManager.getAll();
      
      // Stop current timer
      const currentItem = data.queue[data.queueState.currentIndex];
      if (currentItem && currentItem.currentTimerId) {
        try {
          await APIManager.stopTimer(currentItem.currentTimerId);
        } catch (error) {
          console.error('Error stopping timer:', error);
        }
      }

      // Clear intervals
      if (QueueManager.processingInterval) {
        clearInterval(QueueManager.processingInterval);
      }

      data.queueState.isRunning = false;
      data.queueState.isPaused = false;
      
      await StorageManager.set(STORAGE_KEYS.QUEUE_STATE, data.queueState);
      await NotificationManager.add('warning', 'Queue durduruldu. Sayfa yenileniyor...');
      
      // Reload page to show updated timers
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
      return true;
    },

    // Complete queue
    complete: async () => {
      await QueueManager.stop();
      
      const data = await StorageManager.getAll();
      const completed = data.queue.filter(item => item.status === 'completed');
      
      await NotificationManager.add('success', 
        `🎉 Queue tamamlandı! ${completed.length} time işlendi. Sayfa yenileniyor...`
      );
      await NotificationManager.playSound('success');

      // Reset queue state
      data.queueState.currentIndex = 0;
      await StorageManager.set(STORAGE_KEYS.QUEUE_STATE, data.queueState);
      
      // Reload page to show all completed timers
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    },

    // Clear all completed items
    clearCompleted: async () => {
      const data = await StorageManager.getAll();
      const remaining = data.queue.filter(item => item.status !== 'completed');
      
      await StorageManager.set(STORAGE_KEYS.QUEUE_ITEMS, remaining);
      await NotificationManager.add('info', 'Tamamlanan kayıtlar temizlendi');
      
      return remaining.length;
    },

    // Clear entire queue
    clearAll: async () => {
      await QueueManager.stop();
      await StorageManager.set(STORAGE_KEYS.QUEUE_ITEMS, []);
      
      const data = await StorageManager.getAll();
      data.queueState.currentIndex = 0;
      await StorageManager.set(STORAGE_KEYS.QUEUE_STATE, data.queueState);
      
      await NotificationManager.add('info', 'Queue tamamen temizlendi. Sayfa yenileniyor...');
      
      // Reload page
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    },

    // Add item to queue
    addItem: async (itemData) => {
      const data = await StorageManager.getAll();
      
      // Create queue item
      const item = {
        id: Utils.generateId(),
        projectId: itemData.projectId,
        projectName: itemData.projectName,
        taskId: itemData.taskId,
        taskName: itemData.taskName,
        trelloId: itemData.trelloId || null,
        trelloTitle: itemData.trelloTitle || '',
        notes: itemData.notes,
        totalDuration: itemData.duration,
        remainingDuration: itemData.duration,
        completedDuration: 0,
        status: 'pending',
        createdAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
        timerIds: [],
        currentTimerId: null,
        error: null,
      };

      data.queue.push(item);
      await StorageManager.set(STORAGE_KEYS.QUEUE_ITEMS, data.queue);

      // Update daily stats
      data.dailyStats.totalPlanned += item.totalDuration;
      data.dailyStats.totalRemaining += item.totalDuration;
      await StorageManager.set(STORAGE_KEYS.DAILY_STATS, data.dailyStats);

      await NotificationManager.add('success', `Queue\'ya eklendi: ${item.projectName}`);
      
      return item;
    },

    // Remove item from queue
    removeItem: async (itemId) => {
      const data = await StorageManager.getAll();
      const itemIndex = data.queue.findIndex(item => item.id === itemId);
      
      if (itemIndex === -1) return false;

      const item = data.queue[itemIndex];
      
      // Can't remove running item
      if (item.status === 'running') {
        await NotificationManager.add('error', 'Çalışan item silinemez! Önce pause edin.');
        return false;
      }

      // Update stats if pending
      if (item.status === 'pending') {
        data.dailyStats.totalPlanned -= item.totalDuration;
        data.dailyStats.totalRemaining -= item.remainingDuration;
        await StorageManager.set(STORAGE_KEYS.DAILY_STATS, data.dailyStats);
      }

      data.queue.splice(itemIndex, 1);
      await StorageManager.set(STORAGE_KEYS.QUEUE_ITEMS, data.queue);

      await NotificationManager.add('info', 'Item silindi');
      
      return true;
    },

    // Update item
    updateItem: async (itemId, updates) => {
      const data = await StorageManager.getAll();
      const itemIndex = data.queue.findIndex(item => item.id === itemId);
      
      if (itemIndex === -1) return false;

      const item = data.queue[itemIndex];
      
      // Can't update running item
      if (item.status === 'running') {
        await NotificationManager.add('error', 'Çalışan item düzenlenemez!');
        return false;
      }

      // Update stats if duration changed
      if (updates.duration && item.status === 'pending') {
        const diff = updates.duration - item.totalDuration;
        data.dailyStats.totalPlanned += diff;
        data.dailyStats.totalRemaining += diff;
        await StorageManager.set(STORAGE_KEYS.DAILY_STATS, data.dailyStats);
      }

      // Apply updates
      Object.assign(item, updates);
      if (updates.duration) {
        item.totalDuration = updates.duration;
        item.remainingDuration = updates.duration - item.completedDuration;
      }

      data.queue[itemIndex] = item;
      await StorageManager.set(STORAGE_KEYS.QUEUE_ITEMS, data.queue);

      await NotificationManager.add('success', 'Item güncellendi');
      
      return true;
    },

    // Move item up in queue
    moveUp: async (itemId) => {
      const data = await StorageManager.getAll();
      const itemIndex = data.queue.findIndex(item => item.id === itemId);
      
      if (itemIndex <= 0) return false;

      [data.queue[itemIndex - 1], data.queue[itemIndex]] = 
      [data.queue[itemIndex], data.queue[itemIndex - 1]];
      
      await StorageManager.set(STORAGE_KEYS.QUEUE_ITEMS, data.queue);
      
      return true;
    },

    // Move item down in queue
    moveDown: async (itemId) => {
      const data = await StorageManager.getAll();
      const itemIndex = data.queue.findIndex(item => item.id === itemId);
      
      if (itemIndex === -1 || itemIndex >= data.queue.length - 1) return false;

      [data.queue[itemIndex], data.queue[itemIndex + 1]] = 
      [data.queue[itemIndex + 1], data.queue[itemIndex]];
      
      await StorageManager.set(STORAGE_KEYS.QUEUE_ITEMS, data.queue);
      
      return true;
    },

    // Skip current item
    skipCurrent: async () => {
      const data = await StorageManager.getAll();
      const currentItem = data.queue[data.queueState.currentIndex];
      
      if (!currentItem || currentItem.status !== 'running') {
        await NotificationManager.add('warning', 'Atlayacak item yok!');
        return false;
      }

      // Stop current timer
      if (currentItem.currentTimerId) {
        try {
          await APIManager.stopTimer(currentItem.currentTimerId);
        } catch (error) {
          console.error('Error stopping timer:', error);
        }
      }

      // Clear interval
      if (QueueManager.processingInterval) {
        clearInterval(QueueManager.processingInterval);
      }

      // Mark as pending again
      currentItem.status = 'pending';
      data.queue[data.queueState.currentIndex] = currentItem;
      
      // Move to next
      data.queueState.currentIndex++;
      
      await StorageManager.set(STORAGE_KEYS.QUEUE_ITEMS, data.queue);
      await StorageManager.set(STORAGE_KEYS.QUEUE_STATE, data.queueState);
      
      await NotificationManager.add('info', 'Item atlandı. Sayfa yenileniyor...');
      
      // Reload page to show updated timers and continue with next item
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
      return true;
    },

    // Start periodic check for external changes
    startPeriodicCheck: () => {
      if (QueueManager.checkInterval) {
        clearInterval(QueueManager.checkInterval);
      }

      QueueManager.checkInterval = setInterval(async () => {
        // Check if day has changed (midnight detection)
        const today = Utils.getTodayString();
        const data = await StorageManager.getAll();
        
        if (data.dailyStats && data.dailyStats.date !== today) {
          // Day changed, reset everything
          await StorageManager.resetDaily();
          await NotificationManager.add('info', 'Yeni gün başladı! Queue sıfırlandı. ☀️');
          
          // Stop processing
          if (QueueManager.currentTimer) {
            clearInterval(QueueManager.processingInterval);
            QueueManager.processingInterval = null;
            QueueManager.currentTimer = null;
          }
          
          // Reload page to show fresh state
          setTimeout(() => {
            window.location.reload();
          }, 2000);
          
          return;
        }
        
        if (!data.queueState.isRunning || data.queueState.isPaused) return;

        // Check if user manually added timers (every 30 seconds, not every 5 seconds to avoid too many API calls)
        const now = Date.now();
        if (!QueueManager.lastCheck || now - QueueManager.lastCheck > 30000) {
          QueueManager.lastCheck = now;
          
          // Check current item for manual completion
          const currentIndex = data.queueState.currentIndex;
          const currentItem = data.queue[currentIndex];
          
          if (currentItem && currentItem.status === 'running') {
            try {
              const dailyTimers = await APIManager.getDailyTimers();
              if (dailyTimers.success && dailyTimers.timers && dailyTimers.timers.length > 0) {
                const todayIndex = new Date().getDay();
                const todayTimers = dailyTimers.timers[(todayIndex + 6) % 7] || [];
                
                const existingTime = todayTimers
                  .filter(t => 
                    t.projectId === currentItem.projectId && 
                    t.taskId === currentItem.taskId &&
                    !currentItem.timerIds.includes(t.id)
                  )
                  .reduce((sum, t) => sum + (parseInt(t.total_time) || 0), 0);

                if (existingTime >= currentItem.totalDuration) {
                  // Item completed manually, skip it
                  await QueueManager.skipCurrent();
                  await NotificationManager.add('info', 
                    `${currentItem.projectName} manuel tamamlandı, atlandı`
                  );
                }
              }
            } catch (error) {
              console.error('Error in periodic check:', error);
            }
          }
        }

        // Update UI periodically
        window.dispatchEvent(new Event('queue-progress-update'));
      }, CONFIG.CHECK_INTERVAL);
    },
  };

  // Export to global scope for UI access
  window.QueueManager = QueueManager;

})();
