// Selman-only: auto-stop at 2h max, or earlier if planned minutes set in New Entry modal
(() => {
  'use strict';

  const MAX_MINUTES = 120; // hard cap (app default is 3h)
  const POLL_MS = 8_000;
  const FAST_POLL_MS = 4_000;
  const UI_TICK_MS = 1_000; // remaining countdown refresh
  const BASE_URL = 'https://hyperactive.pro/api';
  const LIMITS_KEY = 'ha_entry_limits';
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

  const loadLimits = () => {
    try {
      const list = JSON.parse(sessionStorage.getItem(LIMITS_KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  };

  const saveLimits = (list) => sessionStorage.setItem(LIMITS_KEY, JSON.stringify(list));

  const upsertLimit = (hint, minutes) => {
    const mins = Math.min(600, Math.max(1, Math.round(Number(minutes) || 0)));
    const list = loadLimits().filter((item) => item.hint !== hint);
    list.push({ hint, minutes: mins });
    saveLimits(list);
  };

  const removeLimitByHint = (hint) => {
    saveLimits(loadLimits().filter((item) => item.hint !== hint));
  };

  // Anchor the minute shown on the row so seconds keep counting between UI updates
  let elapsedAnchor = { key: '', label: '', minutes: 0, at: 0 };

  // Running row after an in-page start, even before React adds active-entry
  const runningEntry = () =>
    document.querySelector('.entry.active-entry') ||
    [...document.querySelectorAll('.entries .entry, .timesheet .entry')].find((entry) =>
      /stop/i.test(entry.querySelector('button.start-btn, button.btn-danger')?.textContent || '')
    );

  // The clock text only, not the badges sitting beside it
  const clockText = (entry) => {
    if (!entry) return '';
    for (const node of entry.querySelectorAll('.entry-time, .font-medium-2, span')) {
      const own = [...node.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent)
        .join('')
        .trim();
      if (/^\d+:\d{2}$/.test(own)) return own;
    }
    return '';
  };

  const readEntryClock = () => {
    const text = clockText(runningEntry());
    return { text, minutes: parseHmToMinutes(text) };
  };

  // Elapsed ms on the open entry (shown time + seconds since that label appeared)
  const getElapsedMs = () => {
    const { text, minutes } = readEntryClock();
    if (minutes == null) return null;
    const active = runningEntry();
    const key = `${active ? entryBlob(active).slice(0, 80) : ''}|${text}`;
    if (elapsedAnchor.key !== key) {
      elapsedAnchor = { key, label: text, minutes, at: Date.now() };
    }
    return elapsedAnchor.minutes * 60_000 + (Date.now() - elapsedAnchor.at);
  };

  // Only the running row's own max. A new modal must not inherit another timer.
  const getActiveTargetMinutes = () => {
    return limitForEntry(runningEntry())?.minutes || null;
  };

  // Remaining until that row's target, minus time already on it (4 stays 4, 2 stays 2)
  const getRemainingMs = () => {
    const minutes = getActiveTargetMinutes();
    if (!minutes) return null;
    const elapsed = getElapsedMs();
    if (elapsed == null) return null;
    return minutes * 60_000 - elapsed;
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

  const injectStyles = () => {
    if (document.getElementById('ha-planned-stop-style')) return;
    const style = document.createElement('style');
    style.id = 'ha-planned-stop-style';
    style.textContent = `
      #ha-planned-stop-wrap {
        position: fixed;
        z-index: 2000;
        padding: 10px 12px;
        border: 1px dashed #0f766e;
        border-radius: 10px;
        background: #f0fdfa;
        box-shadow: 0 8px 24px rgba(0,0,0,.08);
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
      #ha-limit-clear {
        border: 0;
        background: transparent;
        color: #b45309;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        text-decoration: underline;
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
      .ha-queue-mark {
        display: inline-flex;
        align-items: center;
        margin-right: 8px;
        padding: 3px 8px;
        border-radius: 999px;
        font: 700 12px/1.2 system-ui, sans-serif;
        white-space: nowrap;
      }
      .ha-queue-mark.is-open {
        background: #e7e5e4;
        color: #57534e;
        border: 1px solid #d6d3d1;
      }
      .ha-queue-mark.is-done {
        background: #dcfce7;
        color: #166534;
        border: 1px solid #86efac;
      }
    `;
    document.head.appendChild(style);
  };

  // Badge on active timesheet row: "kalan 39:12"
  const updateRowRemain = () => {
    uiBusy = true;
    try {
      injectStyles();
      const active = runningEntry();
      document.querySelectorAll('.ha-remain-badge').forEach((el) => {
        if (!active || !active.contains(el)) el.remove();
      });
      const remainMs = getRemainingMs();
      const target = getActiveTargetMinutes();

      if (!active || remainMs == null || !target) {
        document.querySelectorAll('.ha-remain-badge').forEach((el) => el.remove());
        return;
      }

      const timeEl =
        [...active.querySelectorAll('.entry-time, .font-medium-2, span')].find((node) =>
          /^\d+:\d{2}$/.test(
            [...node.childNodes]
              .filter((n) => n.nodeType === 3)
              .map((n) => n.textContent)
              .join('')
              .trim()
          )
        ) || null;
      if (!timeEl?.parentElement) return;

      let badge = active.querySelector('.ha-remain-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'ha-remain-badge';
        const maxBadge = active.querySelector('.ha-queue-mark');
        timeEl.parentElement.insertBefore(badge, maxBadge || timeEl);
      }

      const label = remainMs <= 0 ? 'kalan 0:00' : `kalan ${formatRemain(remainMs)}`;
      const title = `Planlı stop: ${target} dk`;
      const urgent = remainMs <= 5 * 60_000;
      if (badge.textContent !== label) badge.textContent = label;
      if (badge.title !== title) badge.title = title;
      badge.classList.toggle('is-urgent', urgent);
    } finally {
      uiBusy = false;
    }
  };

  const entryBlob = (entry) => entry?.querySelector('.entry-info')?.textContent || '';

  const norm = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();

  // "Project - (Client)|note" so two tasks on the same brand stay separate
  const modalHint = (modal) => {
    const project = selectedLabel(modal, 'project').split(' - (')[0];
    const notes = modal.querySelector('input.note-input, textarea.note-input')?.value || '';
    const task = selectedLabel(modal, 'task').replace(/\s*\(\d+\)\s*$/, '');
    const distinctive = notes.trim() || task.trim();
    if (!project.trim() || !distinctive) return '';
    return `${norm(project)}|${norm(distinctive).slice(0, 40)}`;
  };

  const limitForEntry = (entry) => {
    if (!entry) return null;
    const blob = norm(entryBlob(entry));
    const hits = loadLimits().filter((item) => {
      const [project, note] = String(item.hint || '').split('|');
      return project && note && blob.includes(project) && blob.includes(note.slice(0, 18));
    });
    hits.sort((a, b) => b.hint.length - a.hint.length);
    return hits[0] || null;
  };

  // After a max is reached, start the next row that also has a max. Skip the rest.
  const startNextLimited = (fromEntry) => {
    const rows = [...document.querySelectorAll('.entries .entry, .timesheet .entries .entry')];
    const from = rows.indexOf(fromEntry);
    for (let i = Math.max(0, from + 1); i < rows.length; i++) {
      const limit = limitForEntry(rows[i]);
      if (!limit) continue;
      const btn = [...rows[i].querySelectorAll('button')].find((b) =>
        /^\s*start\s*$/i.test((b.textContent || '').replace(/\s+/g, ' ').trim())
      );
      if (!btn) continue;
      showToast(`Sonraki kayıt başlıyor · max ${limit.minutes} dk`);
      btn.click();
      // React swaps the row without a reload; repaint the remain badge after it mounts
      [400, 1000, 1800].forEach((ms) => setTimeout(updateRemainUi, ms));
      return;
    }
  };

  const paintQueueMarks = () => {
    uiBusy = true;
    try {
      injectStyles();
      document.querySelectorAll('.timesheet .entry, .entries .entry').forEach((entry) => {
        const match = limitForEntry(entry);
        let badge = entry.querySelector('.ha-queue-mark');
        if (!match) {
          badge?.remove();
          entry.classList.remove('ha-max-open', 'ha-max-done');
          return;
        }
        const timeEl = entry.querySelector('.entry-time') || entry.querySelector('.font-medium-2');
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'ha-queue-mark';
          if (timeEl?.parentElement) timeEl.parentElement.insertBefore(badge, timeEl);
          else entry.querySelector('.entry-info')?.appendChild(badge);
        }
        const shown = parseHmToMinutes(timeEl?.textContent);
        const elapsedMin = entry.classList.contains('active-entry')
          ? (getElapsedMs() ?? (shown || 0) * 60_000) / 60_000
          : shown ?? 0;
        const reached = elapsedMin >= match.minutes;
        const label = reached ? `max ${match.minutes} dk · doldu` : `max ${match.minutes} dk`;
        if (badge.textContent !== label) badge.textContent = label;
        badge.classList.toggle('is-done', reached);
        badge.classList.toggle('is-open', !reached);
        entry.classList.remove('ha-max-done', 'ha-max-open');
      });
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

  // Bind or clear the max on the entry currently open in the modal
  const saveModalLimit = (modal, minutes) => {
    const hint = modalHint(modal);
    if (!hint) {
      showToast('Önce proje ve not seç');
      return false;
    }
    if (!minutes || minutes < 1) {
      removeLimitByHint(hint);
      return true;
    }
    upsertLimit(hint, minutes);
    return true;
  };

  // Inject planned-duration field once; refresh remaining text cheaply
  const placeLimitPanel = (modal, wrap) => {
    const anchor = modal.querySelector('input.time-input') || modal.querySelector('.modal-footer');
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(420, modal.getBoundingClientRect().width - 48);
    const left = Math.max(8, rect.left);
    const top = Math.min(window.innerHeight - 90, rect.bottom + 8);
    const nextLeft = `${left}px`;
    const nextTop = `${top}px`;
    const nextWidth = `${width}px`;
    wrap.hidden = false;
    if (wrap.style.left !== nextLeft) wrap.style.left = nextLeft;
    if (wrap.style.top !== nextTop) wrap.style.top = nextTop;
    if (wrap.style.width !== nextWidth) wrap.style.width = nextWidth;
  };

  const enhanceModal = () => {
    const modal = document.querySelector('.modal.show .timesheet-modal');
    const existing = document.getElementById('ha-planned-stop-wrap');
    if (!modal) {
      if (existing) existing.hidden = true;
      return;
    }

    uiBusy = true;
    try {
      injectStyles();

      let wrap = existing;
      if (!wrap) {
        const timeInput = modal.querySelector('input.time-input');
        const form = modal.querySelector('#modal-entry-form') || modal.querySelector('form');
        if (!form && !timeInput) return;

        wrap = document.createElement('div');
        wrap.id = 'ha-planned-stop-wrap';
        wrap.innerHTML = `
          <label for="ha-planned-stop-input">Max süre (dakika)</label>
          <div class="ha-planned-row">
          <input id="ha-planned-stop-input" type="number" min="1" max="600"
            step="1" placeholder="boş = sınırsız" />
          <button type="button" id="ha-limit-clear">Max sınırı kaldır</button>
          </div>
          <p class="ha-planned-hint">Start veya Update ile kaydolur. Sınırı olan kayıt bitince listedeki sonraki sınırlı kayıt başlar.</p>
          <div id="ha-planned-remain-modal" hidden></div>
        `;

        document.body.appendChild(wrap);

        const inputEl = wrap.querySelector('#ha-planned-stop-input');
        inputEl?.addEventListener('keydown', (e) => e.stopPropagation());
        wrap.querySelector('#ha-limit-clear')?.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const open = document.querySelector('.modal.show .timesheet-modal');
          const hint = open ? modalHint(open) : '';
          if (hint) removeLimitByHint(hint);
          if (inputEl) inputEl.value = '';
          showToast('Max sınır kaldırıldı');
          updateRemainUi();
        });
      }
      placeLimitPanel(modal, wrap);

      const input = wrap.querySelector('#ha-planned-stop-input');
      const remainEl = wrap.querySelector('#ha-planned-remain-modal');
      const hint = modalHint(modal);
      const saved = loadLimits().find((item) => item.hint === hint);
      if (saved && input && document.activeElement !== input && input.dataset.filledHint !== hint) {
        input.value = String(saved.minutes);
        input.dataset.filledHint = hint;
      }
      const active = document.querySelector('.entry.active-entry');
      const activeLimit = limitForEntry(active);
      const modalIsRunning = !!(hint && activeLimit && activeLimit.hint === hint);
      if (remainEl && modalIsRunning) {
        const remainMs = getRemainingMs();
        const elapsedMs = getElapsedMs();
        const text =
          remainMs == null
            ? `Max ${activeLimit.minutes} dk`
            : remainMs <= 0
              ? 'Kalan süre: 0:00'
              : `Kalan süre: ${formatRemain(remainMs)} / ${activeLimit.minutes} dk`;
        remainEl.hidden = false;
        remainEl.classList.toggle('is-urgent', remainMs != null && remainMs <= 5 * 60_000);
        if (remainEl.textContent !== text) remainEl.textContent = text;
      } else if (remainEl && saved) {
        const text = `Max ${saved.minutes} dk`;
        remainEl.hidden = false;
        remainEl.classList.remove('is-urgent');
        if (remainEl.textContent !== text) remainEl.textContent = text;
      } else if (remainEl && (!remainEl.hidden || remainEl.textContent)) {
        remainEl.hidden = true;
        remainEl.textContent = '';
      }
    } finally {
      uiBusy = false;
    }
  };

  const updateRemainUi = () => {
    updateRowRemain();
    paintQueueMarks();
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
        if (!/start timer|update entry/i.test(label)) return;

        const modal = btn.closest('.timesheet-modal') || document.querySelector('.modal.show .timesheet-modal');
        const raw = document.getElementById('ha-planned-stop-input')?.value?.trim();
        const hint = modal ? modalHint(modal) : '';
        if (hint && raw && Number(raw) > 0) {
          upsertLimit(hint, raw);
          showToast(`Max ${Math.min(600, Math.round(Number(raw)))} dk. Dolunca durur.`);
        }
        setTimeout(updateRemainUi, 400);
      },
      true
    );

    // Starting a row uses that row's queued minutes, not the last one added
    document.addEventListener(
      'click',
      (e) => {
        if (!isSelman()) return;
        const btn = e.target.closest('.entry button.start-btn');
        if (!btn || /stop/i.test(btn.textContent || '')) return;
        elapsedAnchor = { key: '', label: '', minutes: 0, at: 0 };
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

    const stoppedEntry = active;
    stopBtn.click();
    console.info(LOG, 'DOM stop clicked', { minutes, limitMinutes, label: timeEl?.textContent });
    showToast(`Max süre doldu (${limitMinutes} dk)`);
    updateRemainUi();
    setTimeout(() => startNextLimited(stoppedEntry), 700);
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
    updateRemainUi();
    const stoppedEntry = document.querySelector('.entry.active-entry');
    setTimeout(() => startNextLimited(stoppedEntry), 700);
    return true;
  };

  const tick = async () => {
    if (!isSelman() || stopping) return;
    stopping = true;
    try {
      enhanceModal();
      updateRowRemain();

      const limitMinutes = getActiveTargetMinutes();
      if (!limitMinutes) return;

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
    const interval = loadLimits().length ? FAST_POLL_MS : POLL_MS;
    pollId = setInterval(tick, interval);
  };

  const start = () => {
    if (!isSelman()) {
      console.debug(LOG, 'skipped — not Selman');
      return;
    }
    console.info(LOG, 'enabled — per-entry max, chain only limited rows');
    removeQueueWindow();
    setInterval(removeQueueWindow, 1000);
    bindStartCapture();
    enhanceModal();
    updateRemainUi();
    tick();
    schedulePoll();

    if (uiTickId) clearInterval(uiTickId);
    uiTickId = setInterval(updateRemainUi, UI_TICK_MS);

    // Debounced: only re-inject when modal appears — never from our own writes
    const isOurs = (node) => {
      if (!node || node.nodeType !== 1) return false;
      return (
        node.id === 'ha-planned-stop-wrap' ||
        node.id === 'ha-planned-remain-modal' ||
        node.classList?.contains('ha-remain-badge') ||
        node.classList?.contains('ha-queue-mark') ||
        !!node.closest?.('#ha-planned-stop-wrap, .ha-remain-badge, .ha-queue-mark')
      );
    };
    const mo = new MutationObserver((mutations) => {
      if (uiBusy) return;
      const reactWipedBadges = mutations.some((m) =>
        [...m.removedNodes].some(
          (node) =>
            node.nodeType === 1 &&
            (node.classList?.contains('ha-remain-badge') || node.classList?.contains('ha-queue-mark'))
        )
      );
      if (!reactWipedBadges) return;
      updateRemainUi();
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
