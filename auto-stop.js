// Selman-only: auto-stop at 2h max, or earlier if planned minutes set in New Entry modal
(() => {
  'use strict';

  const MAX_MINUTES = 120; // hard cap (app default is 3h)
  const POLL_MS = 8_000;
  const FAST_POLL_MS = 4_000;
  const BASE_URL = 'https://hyperactive.pro/api';
  const STORAGE_KEY = 'ha_planned_stop';
  const LOG = '[HyperActive Ext][AutoStop]';

  let pollId = null;
  let stopping = false;
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
      return { minutes: Math.min(Math.round(minutes), MAX_MINUTES), setAt: data.setAt || Date.now() };
    } catch {
      return null;
    }
  };

  const setPlanned = (minutes) => {
    const mins = Math.min(Math.max(1, Math.round(Number(minutes) || 0)), MAX_MINUTES);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ minutes: mins, setAt: Date.now() }));
    console.info(LOG, 'planned stop saved', { minutes: mins });
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
    `;
    document.head.appendChild(style);
  };

  // Inject planned-duration field into Add Time Entry modal
  const enhanceModal = () => {
    const modal = document.querySelector('.modal.show .timesheet-modal, .timesheet-modal');
    if (!modal || !modal.closest('.modal.show')) return;

    if (modal.querySelector('#ha-planned-stop-wrap')) return;

    const timeInput = modal.querySelector('input.time-input');
    const form = modal.querySelector('#modal-entry-form') || modal.querySelector('form');
    if (!form && !timeInput) return;

    injectStyles();

    const wrap = document.createElement('div');
    wrap.id = 'ha-planned-stop-wrap';
    wrap.innerHTML = `
      <label for="ha-planned-stop-input">Otomatik durdur (dakika)</label>
      <div class="ha-planned-row">
        <input id="ha-planned-stop-input" type="number" min="1" max="${MAX_MINUTES}"
          step="1" placeholder="örn. 40" />
        <p class="ha-planned-hint">Start Timer sonrası bu sürede durur · max ${MAX_MINUTES} dk</p>
      </div>
    `;

    // Place under notes/time row when possible
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

    // Keep focus usable; don't fight React re-renders
    const input = wrap.querySelector('#ha-planned-stop-input');
    input?.addEventListener('keydown', (e) => e.stopPropagation());
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
          setPlanned(raw);
          showToast(`Timer ${Math.min(Math.round(Number(raw)), MAX_MINUTES)} dk sonra otomatik duracak`);
        } else {
          clearPlanned();
        }
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

    if (minutes < limitMinutes) {
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
    if (mins < limitMinutes) return false;
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

      const planned = getPlanned();
      const limitMinutes = planned?.minutes || MAX_MINUTES;

      if (window.location.pathname === '/time') {
        const dom = stopViaDom(limitMinutes);
        if (dom.stopped) return;
        if (dom.found && dom.minutes != null && dom.minutes >= limitMinutes) {
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
    console.info(LOG, 'enabled — planned modal stop + 2h safety cap');
    bindStartCapture();
    enhanceModal();
    tick();
    schedulePoll();

    // Re-inject field when modal opens / React re-renders
    const mo = new MutationObserver(() => {
      if (document.querySelector('.modal.show .timesheet-modal')) {
        enhanceModal();
      }
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
