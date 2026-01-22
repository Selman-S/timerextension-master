// Timer Queue Manager - Main Module
// Auto time entry system with 59-minute split logic

(() => {
  'use strict';

  // ============================================================================
  // CONSTANTS & CONFIG
  // ============================================================================
  
  const CONFIG = {
    TIMER_LIMIT: 59,                    // Max 59 minutes per timer
    DAILY_LIMIT: 480,                   // 8 hours daily limit
    CHECK_INTERVAL: 5000,               // Check running timer every 5s
    SAVE_INTERVAL: 30000,               // Save to storage every 30s
    API_RETRY_MAX: 3,                   // Max retry for API calls
    API_RETRY_DELAY: 2000,              // Delay between retries
    NOTIFICATION_DURATION: 5000,        // Notification display time
    TEST_MODE: false,                   // Test mode: if true, 1 minute = 1 second (SET TO FALSE FOR PRODUCTION!)
    COUNTDOWN_INTERVAL: 60000,          // Countdown check interval (1 minute in production)
  };

  const STORAGE_KEYS = {
    QUEUE_STATE: 'timerQueue_state',
    QUEUE_ITEMS: 'timerQueue_items',
    DAILY_STATS: 'timerQueue_dailyStats',
    NOTIFICATIONS: 'timerQueue_notifications',
    TEMPLATES: 'timerQueue_templates',
    RECENT_USED: 'timerQueue_recentUsed',
    SETTINGS: 'timerQueue_settings',
  };

  const API_ENDPOINTS = {
    TIME_CREATE: '/time',
    TIME_START: (id) => `/time/${id}/start`,
    TIME_STOP: (id) => `/time/${id}/stop`,
    TIME_DELETE: (id) => `/time/${id}`,
    CLIENT_LIST: '/client',
    TASK_LIST: (projectId) => `/task/${projectId}`,
    TRELLO_SEARCH: '/trello/search/user',
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const Utils = {
    // Generate unique ID
    generateId: () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,

    // Get today's date string
    getTodayString: () => new Date().toISOString().split('T')[0],

    // Format minutes to "Xh Ym" format
    formatMinutes: (minutes) => {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      if (h === 0) return `${m}dk`;
      if (m === 0) return `${h}s`;
      return `${h}s ${m}dk`;
    },

    // Format time for display
    formatTime: (date) => {
      return new Date(date).toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit'
      });
    },

    // Debounce function
    debounce: (func, wait) => {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    // Deep clone object
    deepClone: (obj) => JSON.parse(JSON.stringify(obj)),

    // Check if same day
    isSameDay: (date1, date2) => {
      const d1 = new Date(date1);
      const d2 = new Date(date2);
      return d1.getFullYear() === d2.getFullYear() &&
             d1.getMonth() === d2.getMonth() &&
             d1.getDate() === d2.getDate();
    },
  };

  // ============================================================================
  // STORAGE MANAGER
  // ============================================================================

  const StorageManager = {
    // Get from chrome storage
    get: async (key) => {
      return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
          resolve(result[key] || null);
        });
      });
    },

    // Set to chrome storage
    set: async (key, value) => {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, resolve);
      });
    },

    // Initialize storage with default values
    init: async () => {
      const today = Utils.getTodayString();
      
      // Check if need to reset daily data
      const dailyStats = await StorageManager.get(STORAGE_KEYS.DAILY_STATS);
      const needsReset = !dailyStats || dailyStats.date !== today;
      
      if (needsReset) {
        await StorageManager.resetDaily();
        return { needsReset: true };  // Return flag for UI notification
      }

      // Initialize other storages if not exist
      const queueState = await StorageManager.get(STORAGE_KEYS.QUEUE_STATE);
      if (!queueState) {
        await StorageManager.set(STORAGE_KEYS.QUEUE_STATE, {
          isRunning: false,
          isPaused: false,
          currentIndex: 0,
          startTime: null,
          pauseTime: null,
          totalPauseTime: 0,
        });
      }

      const queueItems = await StorageManager.get(STORAGE_KEYS.QUEUE_ITEMS);
      if (!queueItems) {
        await StorageManager.set(STORAGE_KEYS.QUEUE_ITEMS, []);
      }

      const settings = await StorageManager.get(STORAGE_KEYS.SETTINGS);
      if (!settings) {
        await StorageManager.set(STORAGE_KEYS.SETTINGS, {
          soundEnabled: true,
          notificationsEnabled: true,
          autoStart: true,
        });
      }
      
      return { needsReset: false };
    },

    // Reset daily data
    resetDaily: async () => {
      const today = Utils.getTodayString();
      
      // Reset daily stats
      await StorageManager.set(STORAGE_KEYS.DAILY_STATS, {
        date: today,
        totalPlanned: 0,
        totalCompleted: 0,
        totalRemaining: 0,
        dailyLimit: CONFIG.DAILY_LIMIT,
        dailyUsed: 0,
      });
      
      // Clear queue items (daily reset)
      await StorageManager.set(STORAGE_KEYS.QUEUE_ITEMS, []);
      
      // Reset queue state
      await StorageManager.set(STORAGE_KEYS.QUEUE_STATE, {
        isRunning: false,
        isPaused: false,
        currentIndex: 0,
        startTime: null,
        pauseTime: null,
        totalPauseTime: 0,
      });
      
      // Clear notifications
      await StorageManager.set(STORAGE_KEYS.NOTIFICATIONS, []);
      
      console.log('Queue: Daily reset completed for', today);
    },

    // Get all data
    getAll: async () => {
      const [state, items, stats, notifications, templates, recentUsed, settings] = await Promise.all([
        StorageManager.get(STORAGE_KEYS.QUEUE_STATE),
        StorageManager.get(STORAGE_KEYS.QUEUE_ITEMS),
        StorageManager.get(STORAGE_KEYS.DAILY_STATS),
        StorageManager.get(STORAGE_KEYS.NOTIFICATIONS),
        StorageManager.get(STORAGE_KEYS.TEMPLATES),
        StorageManager.get(STORAGE_KEYS.RECENT_USED),
        StorageManager.get(STORAGE_KEYS.SETTINGS),
      ]);

      return {
        queueState: state,
        queue: items || [],
        dailyStats: stats,
        notifications: notifications || [],
        templates: templates || [],
        recentUsed: recentUsed || [],
        settings: settings,
      };
    },
  };

  // ============================================================================
  // API MANAGER
  // ============================================================================

  const APIManager = {
    // Base fetch with auth
    fetch: async (url, options = {}) => {
      const token = localStorage.getItem('user');
      const baseUrl = 'https://hyperactive.pro/api';
      
      const defaultOptions = {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options.headers,
        },
        ...options,
      };

      const response = await fetch(baseUrl + url, defaultOptions);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }
      
      return data;
    },

    // Fetch with retry logic
    fetchWithRetry: async (url, options = {}, retries = CONFIG.API_RETRY_MAX) => {
      for (let i = 0; i < retries; i++) {
        try {
          return await APIManager.fetch(url, options);
        } catch (error) {
          if (i === retries - 1) throw error;
          // Exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, CONFIG.API_RETRY_DELAY * Math.pow(2, i))
          );
        }
      }
    },

    // Create new timer
    createTimer: async (data) => {
      const today = Utils.getTodayString();
      return await APIManager.fetchWithRetry(API_ENDPOINTS.TIME_CREATE, {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          time: 0, // Always 0, backend will start timer
          startDate: today,
        }),
      });
    },

    // Stop timer
    stopTimer: async (timerId) => {
      return await APIManager.fetchWithRetry(API_ENDPOINTS.TIME_STOP(timerId), {
        method: 'POST',
      });
    },

    // Get timer details
    getTimer: async (timerId) => {
      return await APIManager.fetch(`/time/${timerId}`);
    },

    // Get client list (projects)
    getClients: async () => {
      return await APIManager.fetch(API_ENDPOINTS.CLIENT_LIST);
    },

    // Get daily timers for today
    getDailyTimers: async (date) => {
      const targetDate = date || Utils.getTodayString();
      return await APIManager.fetch(`/time?startDate=${targetDate}`);
    },

    // Get task list for project
    getTasks: async (projectId) => {
      return await APIManager.fetch(API_ENDPOINTS.TASK_LIST(projectId));
    },

    // Search trello tasks
    searchTrelloTasks: async (query, projectId) => {
      return await APIManager.fetch(
        `${API_ENDPOINTS.TRELLO_SEARCH}?query=${encodeURIComponent(query)}&projectId=${projectId}`
      );
    },

    // Get daily total time
    getDailyTotal: async () => {
      try {
        const response = await fetch('https://hyperactive.pro/api/time', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('user')}`,
          }
        });
        const data = await response.json();
        
        if (data.success) {
          // Calculate today's total from timers
          const today = Utils.getTodayString();
          const todayTimers = data.timers.flat().filter(timer => 
            Utils.isSameDay(timer.spent_at, today)
          );
          
          return todayTimers.reduce((sum, timer) => sum + (timer.total_time || 0), 0);
        }
        return 0;
      } catch (error) {
        console.error('Error getting daily total:', error);
        return 0;
      }
    },
  };

  // ============================================================================
  // NOTIFICATION MANAGER
  // ============================================================================

  const NotificationManager = {
    // Add notification
    add: async (type, message) => {
      const notifications = await StorageManager.get(STORAGE_KEYS.NOTIFICATIONS) || [];
      const notification = {
        id: Utils.generateId(),
        type, // error | warning | info | success
        message,
        timestamp: new Date().toISOString(),
        read: false,
      };
      
      notifications.unshift(notification);
      
      // Keep only last 50 notifications
      if (notifications.length > 50) {
        notifications.splice(50);
      }
      
      await StorageManager.set(STORAGE_KEYS.NOTIFICATIONS, notifications);
      
      // Show in UI
      NotificationManager.show(notification);
      
      return notification;
    },

    // Show notification in UI
    show: (notification) => {
      const container = document.getElementById('queue-notifications-container');
      if (!container) return;

      const notifEl = document.createElement('div');
      notifEl.className = `queue-notification queue-notification-${notification.type}`;
      notifEl.innerHTML = `
        <div class="queue-notification-content">
          <span class="queue-notification-icon">${NotificationManager.getIcon(notification.type)}</span>
          <span class="queue-notification-message">${notification.message}</span>
          <span class="queue-notification-time">${Utils.formatTime(notification.timestamp)}</span>
        </div>
      `;

      container.appendChild(notifEl);

      // Auto remove after duration
      setTimeout(() => {
        notifEl.style.opacity = '0';
        setTimeout(() => notifEl.remove(), 300);
      }, CONFIG.NOTIFICATION_DURATION);
    },

    // Get icon for notification type
    getIcon: (type) => {
      const icons = {
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️',
        success: '✅',
      };
      return icons[type] || 'ℹ️';
    },

    // Play sound
    playSound: async (type) => {
      const settings = await StorageManager.get(STORAGE_KEYS.SETTINGS);
      if (!settings || !settings.soundEnabled) return;

      // You can add actual sound files here
      // For now, just using system beep
      if (type === 'success') {
        // Success sound
      } else if (type === 'error') {
        // Error sound
      }
    },
  };

  // Export to global scope for use in other modules
  window.Utils = Utils;
  window.CONFIG = CONFIG;
  window.STORAGE_KEYS = STORAGE_KEYS;
  window.API_ENDPOINTS = API_ENDPOINTS;
  window.StorageManager = StorageManager;
  window.APIManager = APIManager;
  window.NotificationManager = NotificationManager;

})();
