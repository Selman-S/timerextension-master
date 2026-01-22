// Timer Queue Manager - UI Components (Part 3/3)
// UI updates and rendering

(() => {
  'use strict';

  // ============================================================================
  // UI MANAGER - PART 3: UPDATES & RENDERING
  // ============================================================================

  window.UIManagerPart3 = {
    // Update UI
    updateUI: async (elements) => {
      const data = await window.StorageManager.getAll();
      
      // Update floating button badge
      const pendingCount = data.queue.filter(item => item.status === 'pending' || item.status === 'running').length;
      const badge = elements.floatingBtn.querySelector('.queue-badge');
      badge.textContent = pendingCount;
      badge.style.display = pendingCount > 0 ? 'block' : 'none';

      // Update control buttons
      const startBtn = document.getElementById('queue-start-btn');
      const pauseBtn = document.getElementById('queue-pause-btn');
      const stopBtn = document.getElementById('queue-stop-btn');

      if (data.queueState.isRunning) {
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        stopBtn.disabled = false;
        pauseBtn.innerHTML = data.queueState.isPaused ? '▶️' : '⏸️';
        pauseBtn.title = data.queueState.isPaused ? 'Resume Queue' : 'Pause Queue';
      } else {
        startBtn.disabled = pendingCount === 0;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
      }

      // Update stats
      window.UIManager.updateStats(data);

      // Update queue list
      window.UIManager.updateQueueList(data);
    },

    // Update stats section
    updateStats: (data) => {
      const statsContainer = document.getElementById('queue-stats');
      const totalPlanned = data.dailyStats.totalPlanned;
      const totalCompleted = data.dailyStats.totalCompleted;
      const dailyUsed = data.dailyStats.dailyUsed;
      const dailyLimit = data.dailyStats.dailyLimit;
      const progress = totalPlanned > 0 ? (totalCompleted / totalPlanned) * 100 : 0;

      statsContainer.innerHTML = `
        <div class="queue-stat-item">
          <div class="queue-stat-label">Toplam Süre</div>
          <div class="queue-stat-value">${window.Utils.formatMinutes(totalPlanned)}</div>
        </div>
        <div class="queue-stat-item">
          <div class="queue-stat-label">Tamamlanan</div>
          <div class="queue-stat-value">${window.Utils.formatMinutes(totalCompleted)}</div>
        </div>
        <div class="queue-stat-item">
          <div class="queue-stat-label">Günlük Kullanım</div>
          <div class="queue-stat-value">${window.Utils.formatMinutes(dailyUsed)} / ${window.Utils.formatMinutes(dailyLimit)}</div>
        </div>
        <div class="queue-stat-item">
          <div class="queue-stat-label">İlerleme</div>
          <div class="queue-stat-value">${progress.toFixed(0)}%</div>
        </div>
        <div class="queue-progress-bar" style="grid-column: 1 / -1;">
          <div class="queue-progress-fill" style="width: ${progress}%"></div>
        </div>
      `;
    },

    // Update queue list
    updateQueueList: (data) => {
      const container = document.getElementById('queue-items-container');
      const countEl = document.getElementById('queue-count');
      
      countEl.textContent = `${data.queue.length} item`;

      if (data.queue.length === 0) {
        container.innerHTML = `
          <div class="queue-list-empty">
            <div style="font-size: 48px; margin-bottom: 10px;">📭</div>
            <div>Queue boş. Yukarıdan time ekleyin!</div>
          </div>
        `;
        return;
      }

      container.innerHTML = data.queue.map((item, index) => {
        const progress = item.totalDuration > 0 ? (item.completedDuration / item.totalDuration) * 100 : 0;
        const isActive = index === data.queueState.currentIndex && data.queueState.isRunning;
        
        let statusIcon = '⏳';
        let statusClass = 'pending';
        
        if (item.status === 'running') {
          statusIcon = '▶️';
          statusClass = 'running';
        } else if (item.status === 'completed') {
          statusIcon = '✅';
          statusClass = 'completed';
        } else if (item.status === 'error') {
          statusIcon = '❌';
          statusClass = 'error';
        }

        return `
          <div class="queue-item ${isActive ? 'active' : ''} ${statusClass}">
            <div class="queue-item-header">
              <div class="queue-item-status ${statusClass}">${statusIcon}</div>
              <div class="queue-item-info">
                <div class="queue-item-title">${item.projectName}</div>
                <div class="queue-item-subtitle">${item.taskName}</div>
                ${item.notes ? `<div class="queue-item-note">"${item.notes}"</div>` : ''}
              </div>
            </div>
            
            <div class="queue-item-progress">
              <div class="queue-item-progress-info">
                <span>İlerleme: ${progress.toFixed(0)}%</span>
                <span>${window.Utils.formatMinutes(item.completedDuration)} / ${window.Utils.formatMinutes(item.totalDuration)}</span>
              </div>
              <div class="queue-item-progress-bar">
                <div class="queue-item-progress-fill ${item.status === 'completed' ? 'completed' : ''}" style="width: ${progress}%"></div>
              </div>
            </div>
            
            ${item.status === 'error' && item.error ? `
              <div class="queue-item-error-msg">
                ⚠️ ${item.error}
              </div>
            ` : ''}
            
            <div class="queue-item-actions">
              ${item.status !== 'completed' && item.status !== 'running' ? `
                <button class="queue-item-btn" data-action="edit" data-item-id="${item.id}">
                  ✏️ Düzenle
                </button>
              ` : ''}
              ${item.status !== 'running' ? `
                <button class="queue-item-btn" data-action="delete" data-item-id="${item.id}">
                  🗑️ Sil
                </button>
              ` : ''}
              ${index > 0 && item.status === 'pending' ? `
                <button class="queue-item-btn" data-action="move-up" data-item-id="${item.id}">
                  ↑
                </button>
              ` : ''}
              ${index < data.queue.length - 1 && item.status === 'pending' ? `
                <button class="queue-item-btn" data-action="move-down" data-item-id="${item.id}">
                  ↓
                </button>
              ` : ''}
              ${isActive && item.status === 'running' ? `
                <button class="queue-item-btn" data-action="skip">
                  ⏭️ Atla
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    },

    // Delete item
    deleteItem: async (itemId) => {
      if (confirm('Bu item\'ı silmek istediğinizden emin misiniz?')) {
        await window.QueueManager.removeItem(itemId);
        window.UIManager.updateUI();
      }
    },

    // Move item up
    moveItemUp: async (itemId) => {
      await window.QueueManager.moveUp(itemId);
      window.UIManager.updateUI();
    },

    // Move item down
    moveItemDown: async (itemId) => {
      await window.QueueManager.moveDown(itemId);
      window.UIManager.updateUI();
    },

    // Skip current item
    skipItem: async () => {
      if (confirm('Mevcut item\'ı atlamak istediğinizden emin misiniz?')) {
        await window.QueueManager.skipCurrent();
        window.UIManager.updateUI();
      }
    },

    // Edit item (simplified)
    editItem: (itemId) => {
      // You can implement a proper edit modal here
      alert('Düzenleme özelliği yakında eklenecek!');
    },

    // Start UI update loop
    startUIUpdate: () => {
      const intervalId = setInterval(() => {
        window.UIManager.updateUI();
      }, 5000); // Update every 5 seconds
      return intervalId;
    }
  };

})();
