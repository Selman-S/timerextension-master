// Selman-only: auto-stop at 2h max, or earlier if planned minutes set in New Entry modal
(() => {
  'use strict';

  const MAX_MINUTES = 120; // hard cap (app default is 3h)
  const POLL_MS = 8_000;
  const FAST_POLL_MS = 4_000;
  const UI_TICK_MS = 1_000; // remaining countdown refresh
  const BASE_URL = 'https://hyperactive.pro/api';
  const STORAGE_KEY = 'ha_planned_stop';
  const LOG = '[HyperActive Ext][AutoStop]';

  let pollId = null;
  let uiTickId = null;
  let stopping = false;
  let uiBusy = false; // ignore our own DOM writes in MutationObserver
  let moTimer = null;
  const stoppedIds = new Set();

  const getToken = () => localStorage.getItem('user');

  const decodeUser = () => {
    try {
      const token = getToken();
      if (!token) return null;
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(base64));
    } catch {
      return null;
    }
  };

  const isSelman = () => {
    const user = decodeUser();
    if (!user) return false;
    const blob = [user.name, user.email, user.avatar]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return blob.includes('selman') || blob.includes('sahbudak');
  };

  const parseHmToMinutes = (text) => {
    const m = String(text || '').trim().match(/^(\d+):(\d{2})$/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  };

  const formatRemain = (ms) => {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const todayIso = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const getPlanned = () => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      const minutes = Number(data?.minutes);
      if (!Number.isFinite(minutes) || minutes < 1) return null;
      return {
        minutes: Math.min(Math.round(minutes), MAX_MINUTES),
        setAt: Number(data.setAt) || Date.now(),
      };
    } catch {
      return null;
    }
  };

  // Anchor the minute shown on the row so seconds keep counting between UI updates
  let elapsedAnchor = { label: '', minutes: 0, at: 0 };

  const readEntryClock = () => {
    const row = document.querySelector('.entry.active-entry .entry-time');
    const modalInput = document.querySelector('.modal.show .timesheet-modal input.time-input');
    const text = String(row?.textContent || modalInput?.value || '').trim();
    return { text, minutes: parseHmToMinutes(text) };
  };

  // Elapsed ms on the open entry (shown time + seconds since that label appeared)
  const getElapsedMs = () => {
    const { text, minutes } = readEntryClock();
    if (minutes == null) return null;
    if (elapsedAnchor.label !== text) {
      elapsedAnchor = { label: text, minutes, at: Date.now() };
    }
    return elapsedAnchor.minutes * 60_000 + (Date.now() - elapsedAnchor.at);
  };

  // Remaining until the target, minus time already on this entry (90 − 53 = 37)
  const getRemainingMs = () => {
    const planned = getPlanned();
    if (!planned) return null;
    const elapsed = getElapsedMs();
    if (elapsed == null) return planned.setAt + planned.minutes * 60_000 - Date.now();
    return planned.minutes * 60_000 - elapsed;
  };

  const setPlanned = (minutes, keepSetAt) => {
    const mins = Math.min(Math.max(1, Math.round(Number(minutes) || 0)), MAX_MINUTES);
    const prev = keepSetAt ? getPlanned() : null;
    const setAt = prev?.setAt || Date.now();
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ minutes: mins, setAt }));
    console.info(LOG, 'planned stop saved', { minutes: mins, setAt });
  };

  const clearPlanned = () => sessionStorage.removeItem(STORAGE_KEY);

  const showToast = (message) => {
    let el = document.getElementById('ha-auto-stop-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ha-auto-stop-toast';
      el.style.cssText = [
        'position:fixed',
        'bottom:24px',
        'left:50%',
        'transform:translateX(-50%)',
        'z-index:2147483647',
        'background:#0f766e',
        'color:#fff',
        'padding:10px 16px',
        'border-radius:10px',
        'font:600 13px/1.3 system-ui,sans-serif',
        'box-shadow:0 8px 24px rgba(0,0,0,.18)',
        'max-width:90vw',
      ].join(';');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.display = 'block';
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => {
      el.style.display = 'none';
    }, 4500);
  };

  const injectStyles = () => {
    if (document.getElementById('ha-planned-stop-style')) return;
    const style = document.createElement('style');
    style.id = 'ha-planned-stop-style';
    style.textContent = `
      #ha-planned-stop-wrap {
        margin-top: 8px;
        padding: 10px 12px;
        border: 1px dashed #0f766e;
        border-radius: 10px;
        background: #f0fdfa;
      }
      #ha-planned-stop-wrap label {
        display: block;
        font-size: 11px;
        font-weight: 650;
        color: #0f766e;
        margin-bottom: 6px;
      }
      #ha-planned-stop-wrap .ha-planned-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      #ha-planned-stop-input {
        width: 88px;
        border: 1px solid #99f6e4;
        border-radius: 8px;
        padding: 6px 8px;
        font-size: 14px;
        font-weight: 600;
      }
      #ha-planned-stop-wrap .ha-planned-hint {
        font-size: 11px;
        color: #57534e;
        margin: 0;
      }
      #ha-queue-add {
        border: 0;
        background: #5b21b6;
        color: #fff;
        border-radius: 8px;
        padding: 7px 12px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }
      #queue-panel, #queue-floating-btn { display: none !important; }
      #ha-planned-remain-modal {
        margin-top: 8px;
        font-size: 13px;
        font-weight: 700;
        color: #0f766e;
      }
      #ha-planned-remain-modal.is-urgent { color: #b45309; }
      .ha-remain-badge {
        display: inline-flex;
        align-items: center;
        margin-right: 10px;
        padding: 3px 8px;
        border-radius: 999px;
        background: #ccfbf1;
        color: #0f766e;
        font: 700 12px/1.2 system-ui, sans-serif;
        white-space: nowrap;
        border: 1px solid #99f6e4;
      }
      .ha-remain-badge.is-urgent {
        background: #ffedd5;
        color: #c2410c;
        border-color: #fdba74;
      }
    `;
    document.head.appendChild(style);
  };

  // Badge on active timesheet row: "kalan 39:12"
  const updateRowRemain = () => {
    uiBusy = true;
    try {
      injectStyles();
      document.querySelectorAll('.ha-remain-badge').forEach((el) => {
        if (!el.closest('.entry.active-entry')) el.remove();
      });

      const active = document.querySelector('.entry.active-entry');
      const remainMs = getRemainingMs();
      const planned = getPlanned();

      if (!active || remainMs == null || !planned) {
        document.querySelectorAll('.ha-remain-badge').forEach((el) => el.remove());
        return;
      }

      const actions = active.querySelector('.entry-actions');
      const timeEl = active.querySelector('.entry-time');
      if (!actions || !timeEl) return;

      let badge = active.querySelector('.ha-remain-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'ha-remain-badge';
        actions.insertBefore(badge, timeEl);
      }

      const label = remainMs <= 0 ? 'kalan 0:00' : `kalan ${formatRemain(remainMs)}`;
      const title = `Planlı stop: ${planned.minutes} dk`;
      const urgent = remainMs <= 5 * 60_000;
      if (badge.textContent !== label) badge.textContent = label;
      if (badge.title !== title) badge.title = title;
      badge.classList.toggle('is-urgent', urgent);
    } finally {
      uiBusy = false;
    }
  };

  // Drop the old floating queue window if another script created it
  const removeQueueWindow = () => {
    document.getElementById('queue-panel')?.remove();
    document.getElementById('queue-floating-btn')?.remove();
  };

  // Visible react-select label inside the form group (page state is not readable from the extension)
  const selectedLabel = (modal, labelText) => {
    const label = [...modal.querySelectorAll('label')].find((el) => {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      return text === labelText || text.startsWith(labelText);
    });
    const group = label?.closest('.form-group');
    return group?.querySelector('.select__single-value')?.textContent?.trim() || '';
  };

  // Add the open timer modal entry onto the hidden queue and start it
  const addCurrentEntryToQueue = async (modal) => {
    const minutes = Number(document.getElementById('ha-planned-stop-input')?.value);
    if (!Number.isFinite(minutes) || minutes < 1) {
      showToast('Önce dakika yaz');
      return;
    }
    if (!window.APIManager?.getClients || !window.QueueManager?.addItem) {
      showToast('Sıra hazır değil. Eklentiyi yenile.');
      return;
    }

    const projectLabel = selectedLabel(modal, 'project');
    const actionLabel = selectedLabel(modal, 'action item');
    const taskLabel = selectedLabel(modal, 'task');
    let notes = modal.querySelector('input.note-input, textarea.note-input')?.value?.trim() || '';
    if (!notes) notes = taskLabel.replace(/\s*\(\d+\)\s*$/, '').trim() || actionLabel;
    if (!projectLabel || !actionLabel || !notes) {
      showToast('Proje, action item ve not gerekli');
      return;
    }

    let clients;
    try {
      clients = await window.APIManager.getClients();
    } catch (err) {
      showToast(err?.message || 'Proje listesi alınamadı');
      return;
    }
    let project = null;
    for (const client of clients.clients || []) {
      for (const item of client.Projects || []) {
        const label = `${item.name} - (${client.name})`;
        if (label === projectLabel || item.name === projectLabel) {
          project = { id: item.id, name: item.name };
        }
      }
    }
    if (!project) {
      showToast('Proje bulunamadı');
      return;
    }

    let taskRes;
    try {
      taskRes = await window.APIManager.getTasks(project.id);
    } catch (err) {
      showToast(err?.message || 'Action item listesi alınamadı');
      return;
    }
    const actions = taskRes.tasks?.Tasks || taskRes.Tasks || [];
    const action = actions.find((item) => item.name === actionLabel);
    if (!action) {
      showToast('Action item bulunamadı');
      return;
    }

    const trelloMatch = taskLabel.match(/\((\d+)\)\s*$/);
    const duration = Math.min(Math.round(minutes), 600);
    const before = await window.StorageManager?.getAll?.();
    const wasRunning = !!before?.queueState?.isRunning && !before?.queueState?.isPaused;
    await window.QueueManager.addItem({
      projectId: project.id,
      projectName: project.name,
      taskId: action.id,
      taskName: action.name,
      trelloId: trelloMatch ? trelloMatch[1] : null,
      trelloTitle: taskLabel,
      notes,
      duration,
    });
    showToast(`${duration} dk sıraya eklendi`);
    if (!wasRunning && window.QueueManager.start) {
      await window.QueueManager.start();
    }
  };

  // Inject planned-duration field once; refresh remaining text cheaply
  const enhanceModal = () => {
    const modal = document.querySelector('.modal.show .timesheet-modal');
    if (!modal) return;

    uiBusy = true;
    try {
      injectStyles();

      let wrap = modal.querySelector('#ha-planned-stop-wrap');
      if (!wrap) {
        const timeInput = modal.querySelector('input.time-input');
        const form = modal.querySelector('#modal-entry-form') || modal.querySelector('form');
        if (!form && !timeInput) return;

        wrap = document.createElement('div');
        wrap.id = 'ha-planned-stop-wrap';
        wrap.innerHTML = `
          <label for="ha-planned-stop-input">Otomatik durdur (dakika)</label>
          <div class="ha-planned-row">
          <input id="ha-planned-stop-input" type="number" min="1" max="600"
            step="1" placeholder="örn. 40" />
          <p class="ha-planned-hint">Start Timer max ${MAX_MINUTES} dk · Sıraya ekle daha uzun süreyi böler</p>
          </div>
          <button type="button" id="ha-queue-add">Sıraya ekle</button>
          <div id="ha-planned-remain-modal" hidden></div>
        `;

        const timeCol = timeInput?.closest('.col-sm-3, .col-3, [class*="col-"]');
        const row = timeCol?.parentElement;
        if (row) {
          const full = document.createElement('div');
          full.className = 'col-sm-12';
          full.appendChild(wrap);
          row.appendChild(full);
        } else if (form) {
          form.appendChild(wrap);
        } else {
          modal.querySelector('.modal-body')?.appendChild(wrap);
        }

        const inputEl = wrap.querySelector('#ha-planned-stop-input');
        inputEl?.addEventListener('keydown', (e) => e.stopPropagation());
        inputEl?.addEventListener('change', () => {
          const raw = inputEl.value?.trim();
          if (raw && Number(raw) > 0) {
            setPlanned(raw, !!getPlanned());
            updateRemainUi();
          } else if (!raw) {
            clearPlanned();
            updateRemainUi();
          }
        });
        wrap.querySelector('#ha-queue-add')?.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          addCurrentEntryToQueue(modal);
        });
      }

      const planned = getPlanned();
      const input = wrap.querySelector('#ha-planned-stop-input');
      const remainEl = wrap.querySelector('#ha-planned-remain-modal');
      const successBtn = modal.querySelector('button.btn-success');
      const btnLabel = (successBtn?.textContent || '').replace(/\s+/g, ' ').trim();
      const isUpdate = /update entry/i.test(btnLabel);

      if (planned && input && document.activeElement !== input && (isUpdate || !input.value)) {
        const next = String(planned.minutes);
        if (input.value !== next) input.value = next;
      }

      if (remainEl) {
        const remainMs = getRemainingMs();
        if (planned && remainMs != null && document.querySelector('.entry.active-entry')) {
          const elapsedMs = getElapsedMs();
          const elapsedLabel = elapsedMs == null ? '' : `${formatRemain(elapsedMs)} / `;
          const text =
            remainMs <= 0
              ? 'Kalan süre: 0:00 (durduruluyor…)'
              : `Kalan süre: ${formatRemain(remainMs)} · ${elapsedLabel}${planned.minutes} dk`;
          remainEl.hidden = false;
          remainEl.classList.toggle('is-urgent', remainMs <= 5 * 60_000);
          if (remainEl.textContent !== text) remainEl.textContent = text;
        } else if (!remainEl.hidden || remainEl.textContent) {
          remainEl.hidden = true;
          remainEl.textContent = '';
        }
      }
    } finally {
      uiBusy = false;
    }
  };

  const updateRemainUi = () => {
    updateRowRemain();
    if (document.querySelector('.modal.show .timesheet-modal')) {
      enhanceModal();
    }
  };

  // Capture planned minutes when Start Timer is clicked
  const bindStartCapture = () => {
    document.addEventListener(
      'click',
      (e) => {
        if (!isSelman()) return;
        const btn = e.target.closest('.timesheet-modal button.btn-success, .modal.show button.btn-success');
        if (!btn) return;
        const label = (btn.textContent || '').replace(/\s+/g, ' ').trim();
        if (!/start timer/i.test(label)) return;

        const plannedInput = document.getElementById('ha-planned-stop-input');
        const raw = plannedInput?.value?.trim();
        if (raw && Number(raw) > 0) {
          setPlanned(raw, false);
          showToast(`Timer ${Math.min(Math.round(Number(raw)), MAX_MINUTES)} dk sonra otomatik duracak`);
          setTimeout(updateRemainUi, 400);
        } else {
          clearPlanned();
          updateRemainUi();
        }
      },
      true
    );

    // Clear planned UI when user manually stops
    document.addEventListener(
      'click',
      (e) => {
        if (!isSelman()) return;
        const stopBtn = e.target.closest('button.start-btn.btn-danger');
        if (!stopBtn) return;
        // Keep planned only if auto-stop path; manual stop clears display after short delay
        setTimeout(() => {
          if (!document.querySelector('.entry.active-entry')) {
            // leave storage until auto-stop consumed, but hide badge
            document.querySelectorAll('.ha-remain-badge').forEach((el) => el.remove());
          }
        }, 300);
      },
      true
    );
  };

  const stopViaDom = (limitMinutes) => {
    const active = document.querySelector('.entry.active-entry');
    if (!active) return { found: false };

    const timeEl =
      active.querySelector('.entry-time') ||
      active.querySelector('.entry-actions .font-medium-2') ||
      active.querySelector('.font-medium-2');
    const minutes = parseHmToMinutes(timeEl?.textContent);
    if (minutes == null) return { found: true, minutes: null, stopped: false };

    const remainMs = getRemainingMs();
    const wallDone = remainMs != null && remainMs <= 0;
    const elapsedDone = minutes >= limitMinutes;

    if (!wallDone && !elapsedDone) {
      return { found: true, minutes, stopped: false };
    }

    const stopBtn =
      active.querySelector('button.start-btn.btn-danger') ||
      Array.from(active.querySelectorAll('button.start-btn')).find((b) =>
        /stop/i.test(b.textContent || '')
      );

    if (!stopBtn || stopBtn.disabled) {
      return { found: true, minutes, stopped: false };
    }

    stopBtn.click();
    console.info(LOG, 'DOM stop clicked', { minutes, limitMinutes, label: timeEl?.textContent });
    showToast(`Timer otomatik durduruldu (${timeEl?.textContent} ≥ ${limitMinutes} dk)`);
    clearPlanned();
    updateRemainUi();
    return { found: true, minutes, stopped: true };
  };

  const elapsedMinutes = (timer) => {
    let mins = Number(timer.total_time) || 0;
    if (timer.timer_started) {
      const started = new Date(timer.timer_started).getTime();
      if (!Number.isNaN(started)) {
        mins += Math.floor((Date.now() - started) / 60_000);
      }
    }
    return mins;
  };

  const stopViaApi = async (limitMinutes) => {
    const token = getToken();
    if (!token) return false;

    const res = await fetch(`${BASE_URL}/time?startDate=${todayIso()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const json = await res.json();
    if (!res.ok || !json.success) return false;

    const buckets = json.timers;
    let entries = [];
    if (Array.isArray(buckets)) {
      entries = buckets.flat();
    } else if (buckets && typeof buckets === 'object') {
      entries = Object.values(buckets).flat();
    }

    const running = entries.find((t) => t && t.isStarting);
    if (!running) return false;

    const mins = elapsedMinutes(running);
    const remainMs = getRemainingMs();
    const wallDone = remainMs != null && remainMs <= 0;
    if (!wallDone && mins < limitMinutes) return false;
    if (stoppedIds.has(running.id)) return false;

    stoppedIds.add(running.id);
    const stopRes = await fetch(`${BASE_URL}/time/${running.id}/stop`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const stopJson = await stopRes.json().catch(() => ({}));
    if (!stopRes.ok) {
      stoppedIds.delete(running.id);
      console.warn(LOG, 'API stop failed', stopJson);
      return false;
    }

    console.info(LOG, 'API stop ok', { id: running.id, minutes: mins, limitMinutes });
    showToast(
      `Timer otomatik durduruldu (${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')} ≥ ${limitMinutes} dk)`
    );
    clearPlanned();
    updateRemainUi();

    if (window.location.pathname === '/time') {
      setTimeout(() => window.location.reload(), 800);
    }
    return true;
  };

  const tick = async () => {
    if (!isSelman() || stopping) return;
    stopping = true;
    try {
      enhanceModal();
      updateRowRemain();

      const planned = getPlanned();
      const limitMinutes = planned?.minutes || MAX_MINUTES;

      if (window.location.pathname === '/time') {
        const dom = stopViaDom(limitMinutes);
        if (dom.stopped) return;
        if (dom.found && dom.minutes != null && (dom.minutes >= limitMinutes || (getRemainingMs() ?? 1) <= 0)) {
          await stopViaApi(limitMinutes);
        } else if (!dom.found) {
          await stopViaApi(limitMinutes);
        }
      } else {
        await stopViaApi(limitMinutes);
      }
    } catch (err) {
      console.warn(LOG, 'tick error', err?.message || err);
    } finally {
      stopping = false;
    }
  };

  const schedulePoll = () => {
    if (pollId) clearInterval(pollId);
    const interval = getPlanned() ? FAST_POLL_MS : POLL_MS;
    pollId = setInterval(tick, interval);
  };

  const start = () => {
    if (!isSelman()) {
      console.debug(LOG, 'skipped — not Selman');
      return;
    }
    console.info(LOG, 'enabled — planned modal stop + queue add, no queue window');
    removeQueueWindow();
    setInterval(removeQueueWindow, 1000);
    window.QueueManager?.init?.();
    bindStartCapture();
    enhanceModal();
    updateRemainUi();
    tick();
    schedulePoll();

    if (uiTickId) clearInterval(uiTickId);
    uiTickId = setInterval(updateRemainUi, UI_TICK_MS);

    // Debounced: only re-inject when modal appears — never from our own writes
    const mo = new MutationObserver((mutations) => {
      if (uiBusy) return;
      const ours = mutations.every((m) => {
        const t = m.target;
        return (
          (t.nodeType === 1 &&
            (t.id === 'ha-planned-stop-wrap' ||
              t.id === 'ha-planned-remain-modal' ||
              t.classList?.contains('ha-remain-badge') ||
              t.closest?.('#ha-planned-stop-wrap, .ha-remain-badge'))) ||
          (t.parentElement &&
            (t.parentElement.id === 'ha-planned-remain-modal' ||
              t.parentElement.classList?.contains('ha-remain-badge')))
        );
      });
      if (ours) return;

      clearTimeout(moTimer);
      moTimer = setTimeout(() => {
        if (document.querySelector('.modal.show .timesheet-modal')) {
          enhanceModal();
        }
      }, 200);
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // Refresh poll speed when planned stop is set/cleared
    setInterval(schedulePoll, 15_000);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
