// Timer Queue Manager - UI Components (Main)
// Combines all 3 parts and initializes the UI

(() => {
  'use strict';

  // ============================================================================
  // UI MANAGER - MAIN (Combines Part 1, 2, 3)
  // ============================================================================

  const UIManager = {
    // UI element references
    elements: {},
    isMinimized: false,
    isInitialized: false,
    updateIntervalId: null,

    // Initialize UI
    init: (showNotification = false) => {
      // Part 1: Create styles and UI elements
      window.UIManagerPart1.createStyles();
      UIManager.elements.floatingBtn = window.UIManagerPart1.createFloatingButton();
      UIManager.elements.panel = window.UIManagerPart1.createPanel();
      UIManager.elements.notificationContainer = window.UIManagerPart1.createNotificationContainer();
      
      // Part 2: Attach event listeners
      window.UIManagerPart2.attachEventListeners(UIManager.elements);
      
      // Part 3: Start UI update loop (only once)
      if (!UIManager.updateIntervalId) {
        UIManager.updateIntervalId = window.UIManagerPart3.startUIUpdate();
      }
      
      // Mark as initialized
      UIManager.isInitialized = true;
      
      // Check and notify if queue is running (only on navigation)
      if (showNotification) {
        UIManager.checkAndNotifyRunningQueue();
      }
    },
    
    // Cleanup UI
    cleanup: () => {
      // Remove elements
      if (UIManager.elements.floatingBtn) {
        UIManager.elements.floatingBtn.remove();
      }
      if (UIManager.elements.panel) {
        UIManager.elements.panel.remove();
      }
      
      // Reset state
      UIManager.elements = {};
      UIManager.isInitialized = false;
    },
    
    // Check if queue is already running and notify
    checkAndNotifyRunningQueue: async () => {
      try {
        const data = await window.StorageManager.getAll();
        if (data.queueState.isRunning && !data.queueState.isPaused) {
          await window.NotificationManager.add('info', 'Queue zaten çalışıyor!');
        }
      } catch (error) {
        console.error('Error checking queue state:', error);
      }
    },

    // Part 1 methods (delegated)
    createStyles: () => window.UIManagerPart1.createStyles(),
    createFloatingButton: () => window.UIManagerPart1.createFloatingButton(),
    createPanel: () => window.UIManagerPart1.createPanel(),
    createNotificationContainer: () => window.UIManagerPart1.createNotificationContainer(),

    // Part 2 methods (delegated)
    attachEventListeners: () => window.UIManagerPart2.attachEventListeners(UIManager.elements),
    togglePanel: () => window.UIManagerPart2.togglePanel(UIManager.elements),
    closePanel: () => window.UIManagerPart2.closePanel(UIManager.elements),
    minimizePanel: () => window.UIManagerPart2.minimizePanel(),
    makePanelDraggable: () => window.UIManagerPart2.makePanelDraggable(UIManager.elements),
    searchProjects: (query) => window.UIManagerPart2.searchProjects(query),
    searchTasks: (query) => window.UIManagerPart2.searchTasks(query),
    searchTrelloTasks: (query) => window.UIManagerPart2.searchTrelloTasks(query),
    handleAddItem: () => window.UIManagerPart2.handleAddItem(),

    // Part 3 methods (delegated)
    updateUI: () => window.UIManagerPart3.updateUI(UIManager.elements),
    updateStats: (data) => window.UIManagerPart3.updateStats(data),
    updateQueueList: (data) => window.UIManagerPart3.updateQueueList(data),
    deleteItem: (itemId) => window.UIManagerPart3.deleteItem(itemId),
    moveItemUp: (itemId) => window.UIManagerPart3.moveItemUp(itemId),
    moveItemDown: (itemId) => window.UIManagerPart3.moveItemDown(itemId),
    skipItem: () => window.UIManagerPart3.skipItem(),
    editItem: (itemId) => window.UIManagerPart3.editItem(itemId),
    startUIUpdate: () => window.UIManagerPart3.startUIUpdate()
  };

  // Export UIManager to global scope
  window.UIManager = UIManager;

  // Initialize when DOM is ready (only on /time page)
  const initQueue = (showNotification = false) => {
    // Only show queue on /time page
    if (window.location.href.includes('/time')) {
      window.QueueManager.init();
      UIManager.init(showNotification);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initQueue);
  } else {
    initQueue();
  }

  // Track last URL to detect navigation
  let lastUrl = window.location.href;
  
  // Re-check on URL changes (for SPA navigation)
  setInterval(() => {
    const currentUrl = window.location.href;
    const urlChanged = currentUrl !== lastUrl;
    const queueBtn = document.getElementById('queue-floating-btn');
    const isTimePage = currentUrl.includes('/time');
    
    if (isTimePage && !queueBtn) {
      // On time page but queue not initialized
      console.log('Queue: Initializing on /time page');
      initQueue(false); // Don't show notification on first load
    } else if (!isTimePage && queueBtn) {
      // Not on time page but queue is visible, hide it
      queueBtn.style.display = 'none';
      const panel = document.getElementById('queue-panel');
      if (panel) panel.style.display = 'none';
      UIManager.isInitialized = false; // Mark as not initialized for next visit
    } else if (isTimePage && queueBtn) {
      // On time page and queue exists
      queueBtn.style.display = 'flex';
      
      // If URL changed (navigated to /time from another page), reinitialize
      if (urlChanged && !UIManager.isInitialized) {
        console.log('Queue: Reinitializing after navigation');
        UIManager.cleanup();
        initQueue(true); // Show notification on navigation
      }
    }
    
    lastUrl = currentUrl;
  }, 1000);

})();
