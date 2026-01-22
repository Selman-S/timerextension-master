// Timer Queue Manager - UI Components (Part 1/3)
// Styles and UI creation

(() => {
  'use strict';

  // ============================================================================
  // UI MANAGER - PART 1: STYLES & CREATION
  // ============================================================================

  window.UIManagerPart1 = {
    // Create CSS styles
    createStyles: () => {
      const style = document.createElement('style');
      style.textContent = `
        /* Queue Manager Styles - Modern Design */
        #queue-floating-btn {
          position: fixed;
          bottom: 24px;
          right: 76px;
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%);
          border-radius: 20px;
          box-shadow: 0 8px 32px rgba(99, 102, 241, 0.35),
                      0 2px 8px rgba(99, 102, 241, 0.2);
          cursor: pointer;
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 28px;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          user-select: none;
          backdrop-filter: blur(10px);
        }
        
        #queue-floating-btn:hover {
          transform: translateY(-4px) scale(1.05);
          box-shadow: 0 12px 48px rgba(99, 102, 241, 0.45),
                      0 4px 16px rgba(99, 102, 241, 0.3);
        }
        
        #queue-floating-btn:active {
          transform: translateY(-2px) scale(1.02);
        }
        
        #queue-floating-btn .queue-badge {
          position: absolute;
          top: -6px;
          right: -6px;
          background: linear-gradient(135deg, #ef4444 0%, #f59e0b 100%);
          color: white;
          border-radius: 14px;
          padding: 3px 9px;
          font-size: 11px;
          font-weight: 700;
          min-width: 22px;
          text-align: center;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
          animation: pulse-badge 2s infinite;
        }
        
        @keyframes pulse-badge {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        
        #queue-panel {
          position: fixed;
          bottom: 100px;
          right: 24px;
          width: 440px;
          max-height: 88vh;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px) saturate(180%);
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15),
                      0 8px 24px rgba(0, 0, 0, 0.1),
                      inset 0 1px 0 rgba(255, 255, 255, 0.6);
          z-index: 99998;
          display: none;
          flex-direction: column;
          overflow-x: hidden;
          overflow-y: auto;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        #queue-panel::-webkit-scrollbar {
          width: 6px;
        }
        
        #queue-panel::-webkit-scrollbar-track {
          background: transparent;
        }
        
        #queue-panel::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.4);
          border-radius: 10px;
          transition: background 0.3s;
        }
        
        #queue-panel::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.7);
        }
        
        #queue-panel.active {
          display: flex;
        }
        
        .queue-header {
          flex-shrink: 0;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%);
          color: white;
          padding: 18px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: move;
          border-radius: 24px 24px 0 0;
          position: relative;
          overflow: hidden;
        }
        
        .queue-header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 100%);
          pointer-events: none;
        }
        
        .queue-header h3 {
          margin: 0;
          font-size: 17px;
          font-weight: 700;
          letter-spacing: -0.3px;
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .queue-header-actions {
          display: flex;
          gap: 8px;
          position: relative;
          z-index: 1;
        }
        
        .queue-header-btn {
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-size: 16px;
          font-weight: 600;
        }
        
        .queue-header-btn:hover {
          background: rgba(255, 255, 255, 0.25);
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        .queue-header-btn:active {
          transform: scale(0.95);
        }
        
        .queue-controls {
          flex-shrink: 0;
          display: flex;
          gap: 10px;
          padding: 16px 20px;
          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
          border-bottom: 1px solid rgba(148, 163, 184, 0.12);
        }
        
        .queue-btn {
          flex: 1;
          padding: 10px 14px;
          border: none;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          position: relative;
          overflow: hidden;
        }
        
        .queue-btn::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.5);
          transform: translate(-50%, -50%);
          transition: width 0.6s, height 0.6s;
        }
        
        .queue-btn:hover::before {
          width: 300px;
          height: 300px;
        }
        
        .queue-btn > * {
          position: relative;
          z-index: 1;
        }
        
        .queue-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          filter: grayscale(0.5);
        }
        
        .queue-btn-start {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }
        
        .queue-btn-start:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
        }
        
        .queue-btn-start:active:not(:disabled) {
          transform: translateY(0);
        }
        
        .queue-btn-pause {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
        }
        
        .queue-btn-pause:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(245, 158, 11, 0.4);
        }
        
        .queue-btn-stop {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        }
        
        .queue-btn-stop:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
        }
        
        .queue-btn-clear {
          background: linear-gradient(135deg, #64748b 0%, #475569 100%);
          color: white;
          box-shadow: 0 4px 12px rgba(100, 116, 139, 0.3);
        }
        
        .queue-btn-clear:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(100, 116, 139, 0.4);
        }
        
        .queue-stats {
          flex-shrink: 0;
          padding: 16px 20px;
          background: linear-gradient(180deg, #fafbfc 0%, #f3f4f6 100%);
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.12);
        }
        
        .queue-stat-item {
          background: white;
          padding: 14px;
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        
        .queue-stat-item::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 4px;
          height: 100%;
          background: linear-gradient(180deg, #6366f1 0%, #8b5cf6 100%);
        }
        
        .queue-stat-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(99, 102, 241, 0.15);
        }
        
        .queue-stat-label {
          font-size: 10px;
          color: #64748b;
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          font-weight: 600;
        }
        
        .queue-stat-value {
          font-size: 18px;
          font-weight: 700;
          background: linear-gradient(135deg, #1e293b 0%, #475569 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .queue-progress-bar {
          width: 100%;
          height: 10px;
          background: #e5e7eb;
          border-radius: 10px;
          overflow: hidden;
          margin-top: 12px;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.06);
        }
        
        .queue-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%);
          transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 10px;
          position: relative;
        }
        
        .queue-progress-fill::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%);
          animation: shimmer 2s infinite;
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        .queue-form {
          flex-shrink: 0;
          padding: 20px;
          background: white;
          border-bottom: 1px solid rgba(148, 163, 184, 0.12);
          position: relative;
          z-index: 1;
        }
        
        .queue-form-title {
          font-size: 14px;
          font-weight: 700;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding-bottom: 12px;
          border-bottom: 2px solid #f1f5f9;
        }
        
        .queue-form-group {
          margin-bottom: 16px;
        }
        
        .queue-form-label {
          display: block;
          font-size: 11px;
          color: #64748b;
          margin-bottom: 6px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }
        
        .queue-form-input,
        .queue-form-select {
          width: 100%;
          padding: 11px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          font-size: 13px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          background: #f8fafc;
          font-family: inherit;
        }
        
        .queue-form-input:hover,
        .queue-form-select:hover {
          border-color: #cbd5e0;
          background: white;
        }
        
        .queue-form-input:focus,
        .queue-form-select:focus {
          outline: none;
          border-color: #6366f1;
          background: white;
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
          transform: translateY(-1px);
        }
        
        .queue-form-input::placeholder {
          color: #94a3b8;
        }

        .autocomplete-results {
          max-height: 200px;
          overflow-y: auto;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          margin-top: 6px;
          background: white;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
          animation: fadeIn 0.2s ease;
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .autocomplete-item {
          padding: 12px 14px;
          cursor: pointer;
          border-bottom: 1px solid #f1f5f9;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          background: white;
        }

        .autocomplete-item:hover {
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          padding-left: 18px;
        }

        .autocomplete-item:last-child {
          border-bottom: none;
        }
        
        .autocomplete-item-title {
          font-size: 13px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 3px;
        }
        
        .autocomplete-item-subtitle {
          font-size: 11px;
          color: #94a3b8;
        }

        .queue-form-actions {
          display: flex;
          gap: 10px;
          margin-top: 18px;
        }
        
        .queue-form-btn {
          flex: 1;
          padding: 12px 16px;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        
        .queue-form-btn::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.5);
          transform: translate(-50%, -50%);
          transition: width 0.6s, height 0.6s;
        }
        
        .queue-form-btn:hover::before {
          width: 300px;
          height: 300px;
        }
        
        .queue-form-btn-primary {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }
        
        .queue-form-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
        }
        
        .queue-form-btn-primary:active {
          transform: translateY(0);
        }
        
        .queue-list {
          flex-shrink: 0;
          padding: 20px;
          background: #fafbfc;
          position: relative;
          z-index: 0;
        }
        
        .queue-list-title {
          font-size: 13px;
          font-weight: 700;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 2px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .queue-list-title span:last-child {
          font-size: 12px;
          color: #94a3b8;
          font-weight: 600;
          background: #f1f5f9;
          padding: 4px 12px;
          border-radius: 20px;
        }
        
        .queue-list-empty {
          text-align: center;
          padding: 60px 20px;
          color: #94a3b8;
          animation: fadeIn 0.5s ease;
        }
        
        .queue-item {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 18px;
          margin-bottom: 12px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          position: relative;
          overflow: hidden;
        }
        
        .queue-item::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          background: #e2e8f0;
          transition: all 0.3s;
        }
        
        .queue-item:hover {
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
          transform: translateY(-2px);
        }
        
        .queue-item.active {
          border-color: #6366f1;
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          box-shadow: 0 8px 32px rgba(99, 102, 241, 0.2);
        }
        
        .queue-item.active::before {
          background: linear-gradient(180deg, #6366f1 0%, #8b5cf6 100%);
        }
        
        .queue-item.completed {
          opacity: 0.65;
        }
        
        .queue-item.completed::before {
          background: linear-gradient(180deg, #10b981 0%, #059669 100%);
        }
        
        .queue-item.error {
          border-color: #ef4444;
          background: #fef2f2;
        }
        
        .queue-item.error::before {
          background: linear-gradient(180deg, #ef4444 0%, #dc2626 100%);
        }
        
        .queue-item-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
        }
        
        .queue-item-status {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          transition: all 0.3s;
        }
        
        .queue-item-status.pending {
          background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
        }
        
        .queue-item-status.running {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
          animation: pulse 2s ease-in-out infinite;
          box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4);
        }
        
        .queue-item-status.completed {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
        }
        
        .queue-item-status.error {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.05);
          }
        }
        
        .queue-item-info {
          flex: 1;
          min-width: 0;
        }
        
        .queue-item-title {
          font-size: 15px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: -0.2px;
        }
        
        .queue-item-subtitle {
          font-size: 13px;
          color: #64748b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 500;
        }
        
        .queue-item-note {
          font-size: 12px;
          color: #475569;
          margin-top: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-style: italic;
        }
        
        .queue-item-progress {
          margin: 14px 0;
        }
        
        .queue-item-progress-info {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #64748b;
          margin-bottom: 8px;
          font-weight: 600;
        }
        
        .queue-item-progress-bar {
          width: 100%;
          height: 8px;
          background: #e5e7eb;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.06);
          position: relative;
        }
        
        .queue-item-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%);
          transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 10px;
          position: relative;
        }
        
        .queue-item-progress-fill::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%);
          animation: shimmer 2s infinite;
        }
        
        .queue-item-progress-fill.completed {
          background: linear-gradient(90deg, #10b981 0%, #059669 100%);
        }
        
        .queue-item-actions {
          display: flex;
          gap: 8px;
          margin-top: 14px;
          flex-wrap: wrap;
        }
        
        .queue-item-btn {
          padding: 7px 14px;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          align-items: center;
          gap: 5px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
        }
        
        .queue-item-btn:hover {
          background: #f8fafc;
          border-color: #6366f1;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
        }
        
        .queue-item-btn:active {
          transform: translateY(0);
        }
        
        .queue-item-error-msg {
          background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
          color: #dc2626;
          padding: 10px 14px;
          border-radius: 10px;
          border-left: 4px solid #ef4444;
          font-size: 12px;
          margin-top: 12px;
          font-weight: 500;
        }
        
        #queue-notifications-container {
          position: fixed;
          top: 24px;
          right: 24px;
          z-index: 100000;
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-width: 420px;
        }
        
        .queue-notification {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px) saturate(180%);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12),
                      0 2px 8px rgba(0, 0, 0, 0.08);
          padding: 16px 18px;
          animation: slideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .queue-notification:hover {
          transform: translateX(-4px);
          box-shadow: 0 12px 48px rgba(0, 0, 0, 0.15),
                      0 4px 16px rgba(0, 0, 0, 0.1);
        }
        
        @keyframes slideIn {
          from {
            transform: translateX(450px) scale(0.9);
            opacity: 0;
          }
          to {
            transform: translateX(0) scale(1);
            opacity: 1;
          }
        }
        
        .queue-notification-content {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        
        .queue-notification-icon {
          font-size: 24px;
          flex-shrink: 0;
          animation: iconPop 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        @keyframes iconPop {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
        
        .queue-notification-message {
          flex: 1;
          font-size: 14px;
          color: #1e293b;
          font-weight: 500;
          line-height: 1.5;
        }
        
        .queue-notification-time {
          font-size: 11px;
          color: #94a3b8;
          flex-shrink: 0;
          font-weight: 600;
        }
        
        .queue-notification-error {
          border-left: 4px solid #ef4444;
          background: linear-gradient(135deg, rgba(254, 242, 242, 0.9) 0%, rgba(255, 255, 255, 0.95) 100%);
        }
        
        .queue-notification-warning {
          border-left: 4px solid #f59e0b;
          background: linear-gradient(135deg, rgba(254, 252, 232, 0.9) 0%, rgba(255, 255, 255, 0.95) 100%);
        }
        
        .queue-notification-success {
          border-left: 4px solid #10b981;
          background: linear-gradient(135deg, rgba(236, 253, 245, 0.9) 0%, rgba(255, 255, 255, 0.95) 100%);
        }
        
        .queue-notification-info {
          border-left: 4px solid #6366f1;
          background: linear-gradient(135deg, rgba(238, 242, 255, 0.9) 0%, rgba(255, 255, 255, 0.95) 100%);
        }
        
        /* Scrollbar styles */
        .queue-list::-webkit-scrollbar,
        .queue-form::-webkit-scrollbar {
          width: 6px;
        }
        
        .queue-list::-webkit-scrollbar-track,
        .queue-form::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        
        .queue-list::-webkit-scrollbar-thumb,
        .queue-form::-webkit-scrollbar-thumb {
          background: #cbd5e0;
          border-radius: 3px;
        }
        
        .queue-list::-webkit-scrollbar-thumb:hover,
        .queue-form::-webkit-scrollbar-thumb:hover {
          background: #a0aec0;
        }
      `;
      document.head.appendChild(style);
    },

    // Create floating button
    createFloatingButton: () => {
      const btn = document.createElement('div');
      btn.id = 'queue-floating-btn';
      btn.innerHTML = `
        📋
        <span class="queue-badge">0</span>
      `;
      document.body.appendChild(btn);
      return btn;
    },

    // Create main panel
    createPanel: () => {
      const panel = document.createElement('div');
      panel.id = 'queue-panel';
      panel.innerHTML = `
        <div class="queue-header" id="queue-header">
          <h3>⏱️ Timer Queue ${window.CONFIG && window.CONFIG.TEST_MODE ? '<span style="background: #f56565; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-left: 5px;">TEST MODE</span>' : ''}</h3>
          <div class="queue-header-actions">
            <button class="queue-header-btn" id="queue-minimize-btn" title="Minimize">−</button>
            <button class="queue-header-btn" id="queue-close-btn" title="Close">×</button>
          </div>
        </div>
        
        <div class="queue-controls">
          <button class="queue-btn queue-btn-start" id="queue-start-btn" title="Start Queue">
            ▶️
          </button>
          <button class="queue-btn queue-btn-pause" id="queue-pause-btn" disabled title="Pause/Resume">
            ⏸️
          </button>
          <button class="queue-btn queue-btn-stop" id="queue-stop-btn" disabled title="Stop Queue">
            ⏹️
          </button>
          <button class="queue-btn queue-btn-clear" id="queue-clear-btn" title="Clear All">
            🗑️
          </button>
        </div>
        
        <div class="queue-stats" id="queue-stats">
          <!-- Will be populated dynamically -->
        </div>
        
        <div class="queue-form">
          <div class="queue-form-title">➕ Yeni Time</div>
          <form id="queue-add-form">
            <div class="queue-form-group">
              <label class="queue-form-label">📁 Proje</label>
              <input type="text" class="queue-form-input" id="queue-project-input" placeholder="Proje ara...">
              <input type="hidden" id="queue-project-id">
              <input type="hidden" id="queue-client-id">
              <div id="queue-project-results" style="display: none;"></div>
            </div>
            <div class="queue-form-group">
              <label class="queue-form-label">📋 Action Item</label>
              <input type="text" class="queue-form-input" id="queue-task-input" placeholder="Action Item ara..." disabled>
              <input type="hidden" id="queue-task-id">
              <div id="queue-task-results" style="display: none;"></div>
            </div>
            <div class="queue-form-group">
              <label class="queue-form-label">🎯 Task (Opsiyonel)</label>
              <input type="text" class="queue-form-input" id="queue-trello-input" placeholder="Task ara..." disabled>
              <input type="hidden" id="queue-trello-id">
              <div id="queue-trello-results" style="display: none;"></div>
            </div>
            <div class="queue-form-group">
              <label class="queue-form-label">📝 Not</label>
              <input type="text" class="queue-form-input" id="queue-note-input" placeholder="Not..." required>
            </div>
            <div class="queue-form-group">
              <label class="queue-form-label">⏱️ Süre (dk)</label>
              <input type="number" class="queue-form-input" id="queue-duration-input" placeholder="140" min="1" required>
            </div>
            <div class="queue-form-actions">
              <button type="submit" class="queue-form-btn queue-form-btn-primary">
                ✅ Ekle
              </button>
            </div>
          </form>
        </div>
        
        <div class="queue-list" id="queue-list">
          <div class="queue-list-title">
            <span>📋 Queue Listesi</span>
            <span id="queue-count">0 item</span>
          </div>
          <div id="queue-items-container">
            <div class="queue-list-empty">
              <div style="font-size: 48px; margin-bottom: 10px;">📭</div>
              <div>Queue boş. Yukarıdan time ekleyin!</div>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(panel);
      return panel;
    },

    // Create notification container
    createNotificationContainer: () => {
      const container = document.createElement('div');
      container.id = 'queue-notifications-container';
      document.body.appendChild(container);
      return container;
    }
  };

})();
