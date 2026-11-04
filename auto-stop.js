// Auto-stop running timer at 2h — only for Selman
(() => {
  'use strict';

  const MAX_MINUTES = 120; // 2 hours (app default auto-stop is 3h)
  const POLL_MS = 10_000;
  const BASE_URL = 'https://hyperactive.pro/api';
  const LOG = '[HyperActive Ext][AutoStop]';

  let pollId = null;
  let stopping = false;
  const stoppedIds = new Set(); // avoid double-stop for same timer

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

  // Gate: only Selman Sahbudak
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

  // Prefer clicking Stop so React/Redux stays in sync
  const stopViaDom = () => {
    const active = document.querySelector('.entry.active-entry');
    if (!active) return { found: false };

    const timeEl =
      active.querySelector('.entry-time') ||
      active.querySelector('.entry-actions .font-medium-2') ||
      active.querySelector('.font-medium-2');
    const minutes = parseHmToMinutes(timeEl?.textContent);
    if (minutes == null) return { found: true, minutes: null, stopped: false };

    if (minutes < MAX_MINUTES) {
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
    console.info(LOG, 'DOM stop clicked', { minutes, label: timeEl?.textContent });
    showToast(`Timer otomatik durduruldu (${timeEl?.textContent} ≥ 2 saat)`);
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

  // Fallback when not on /time or DOM miss — stop via API
  const stopViaApi = async () => {
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

    // weeklyTimers shape: timers = { 'YYYY-MM-DD': [entries...] } or nested arrays
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
    if (mins < MAX_MINUTES) return false;
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

    console.info(LOG, 'API stop ok', { id: running.id, minutes: mins });
    showToast(`Timer otomatik durduruldu (${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')} ≥ 2 saat)`);

    // Soft refresh timesheet list if present
    if (window.location.pathname === '/time') {
      setTimeout(() => window.location.reload(), 800);
    }
    return true;
  };

  const tick = async () => {
    if (!isSelman() || stopping) return;
    stopping = true;
    try {
      if (window.location.pathname === '/time') {
        const dom = stopViaDom();
        if (dom.stopped) return;
        // DOM shows ≥2h but click failed, or no active-entry class — try API
        if (dom.found && dom.minutes != null && dom.minutes >= MAX_MINUTES) {
          await stopViaApi();
        } else if (!dom.found) {
          await stopViaApi();
        }
      } else {
        await stopViaApi();
      }
    } catch (err) {
      console.warn(LOG, 'tick error', err?.message || err);
    } finally {
      stopping = false;
    }
  };

  const start = () => {
    if (pollId) return;
    if (!isSelman()) {
      console.debug(LOG, 'skipped — not Selman');
      return;
    }
    console.info(LOG, 'enabled — auto-stop at 2h');
    tick();
    pollId = setInterval(tick, POLL_MS);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
