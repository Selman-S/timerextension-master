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

  let limitsCache = null;

  const loadLimits = () => {
    if (limitsCache) return limitsCache;
    try {
      const list = JSON.parse(sessionStorage.getItem(LIMITS_KEY) || '[]');
      limitsCache = Array.isArray(list) ? list : [];
    } catch {
      limitsCache = [];
    }
    return limitsCache;
  };

  // Past days cannot be edited, so only today's limits are kept
  const keepToday = (list) => {
    const day = pageDay();
    if (!day) return list.filter((item) => item.day);
    return list.filter((item) => item.day === day);
  };

  const limitKey = (item) => item.id || `${item.day}|${item.ordinal}|${item.visible || item.hint}`;

  const saveLimits = (list) => {
    limitsCache = keepToday(list);
    try {
      sessionStorage.setItem(LIMITS_KEY, JSON.stringify(limitsCache));
    } catch {
      /* private mode */
    }
    try {
      chrome.storage?.local?.set({ [LIMITS_KEY]: limitsCache });
    } catch {
      /* storage unavailable */
    }
  };

  // Keep limits after a reload. Merge by id so two rows with the same note both survive.
  const hydrateLimits = () => {
    try {
      chrome.storage?.local?.get(LIMITS_KEY, (data) => {
        const stored = data?.[LIMITS_KEY];
        if (!Array.isArray(stored) || !stored.length) return;
        const merged = new Map();
        [...stored, ...loadLimits()].forEach((item) => {
          const key = limitKey(item);
          if (key) merged.set(key, item);
        });
        saveLimits([...merged.values()]);
        updateRemainUi();
      });
    } catch {
      /* ignore */
    }
  };

  const upsertLimit = (hint, minutes, extra = {}) => {
    const mins = Math.min(600, Math.max(1, Math.round(Number(minutes) || 0)));
    const rowBlob = extra.rowBlob || '';
    const visible = extra.visible || '';
    const list = loadLimits().filter((item) => item.id !== extra.id);
    const id = extra.id || '';
    list.push({
      id,
      hint,
      minutes: mins,
      rowBlob,
      visible,
      day: extra.day || '',
      ordinal: Number.isInteger(extra.ordinal) ? extra.ordinal : -1,
      project: extra.project || '',
      task: extra.task || '',
    });
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
        box-sizing: border-box;
        padding: 10px 12px;
        border: 1px dashed #0f766e;
        border-radius: 10px;
        background: #f0fdfa;
      }
      #ha-planned-stop-wrap[hidden] { display: none !important; }
      /* Room at the bottom of the form so the fixed panel sits inside the modal */
      .modal.show .timesheet-modal .modal-body {
        padding-bottom: var(--ha-limit-pad, 140px) !important;
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

  const entryBlob = (entry) => {
    const info = entry?.querySelector('.entry-info');
    if (!info) return '';
    const clone = info.cloneNode(true);
    clone.querySelectorAll('.ha-queue-mark, .ha-remain-badge').forEach((node) => node.remove());
    return clone.textContent || '';
  };

  // ClickUp title or note actually painted on the row — stable across reload
  const rowVisible = (entry) =>
    norm(
      entry?.querySelector('.clickup-link')?.textContent ||
        entry?.querySelector('.entry-note')?.textContent ||
        ''
    );

  const norm = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();

  // Row that opened the modal, so the badge can stick even when the note is not rendered
  let pendingRowBlob = '';
  let pendingVisible = '';
  let pendingOrdinal = -1;

  // "Project - (Client)|note" so two tasks on the same brand stay separate
  const modalFields = (modal) => {
    const project = norm(selectedLabel(modal, 'project').split(' - (')[0]);
    const notes = norm(modal.querySelector('input.note-input, textarea.note-input')?.value || '');
    const task = norm(selectedLabel(modal, 'task').replace(/\s*\(\d+\)\s*$/, ''));
    return { project, notes, task };
  };

  const modalHint = (modal) => {
    const { project, notes, task } = modalFields(modal);
    const distinctive = notes || task;
    if (!project || !distinctive) return '';
    return `${project}|${distinctive.slice(0, 40)}`;
  };

  const projectOf = (item) => item.project || String(item.hint || '').split('|')[0] || '';

  // Limits belong to the day they were saved on, not every later row with a similar title
  const pageDay = () => {
    const label = document.querySelector('.calendar-navigation .month')?.textContent || '';
    const match = label.replace(/\s+/g, ' ').match(/(\d{1,2})\s+([A-Za-z]{3})/);
    if (!match) return '';
    const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    const month = months[match[2].toLowerCase()];
    if (!month) return '';
    const year = new Date().getFullYear();
    return `${year}-${String(month).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`;
  };

  // Text after the project name, so two Pegasus rows do not share one max
  const taskTail = (text, project) => {
    let value = norm(text);
    const name = norm(project);
    if (name && value.startsWith(name)) value = value.slice(name.length);
    return value.replace(/^[\s\-–()]+/, '').trim();
  };

  const sameTask = (a, b) => {
    const left = norm(a);
    const right = norm(b);
    if (left.length < 12 || right.length < 12) return false;
    const n = 16;
    return left.includes(right.slice(0, n)) || right.includes(left.slice(0, n));
  };

  // Same description on a new entry must not inherit another entry's max
  const rowsLike = (visible) => {
    const key = norm(visible);
    if (!key) return [];
    return entryList().filter((entry) => rowVisible(entry) === key);
  };

  const limitMatches = (item, entry) => {
    const day = pageDay();
    if (!item.day || !day || item.day !== day) return false;
    const shown = rowVisible(entry);
    const key = norm(item.visible);
    // Prefer the task title saved with this limit. Index alone misses rows after a re-render.
    if (key && shown === key) {
      const group = rowsLike(key);
      if (group.length <= 1) return group[0] === entry;
      return group[item.ordinal] === entry || group.indexOf(entry) === item.ordinal;
    }
    if (!Number.isInteger(item.ordinal) || item.ordinal < 0) return false;
    return entryList()[item.ordinal] === entry;
  };

  // After Start, attach a brand-new limit to the row that actually began
  const pinFreshLimits = () => {
    const active = runningEntry();
    if (!active) return;
    const shown = rowVisible(active);
    let changed = false;
    const list = [];
    let pinned = false;
    loadLimits()
      .slice()
      .reverse()
      .forEach((item) => {
        const fresh = String(item.id || '').startsWith('new|');
        if (pinned || !fresh || item.ordinal >= 0 || item.day !== pageDay()) {
          list.push(item);
          return;
        }
        const ordinal = entryList().indexOf(active);
        if (ordinal < 0) {
          list.push(item);
          return;
        }
        const nextId = `${item.day}|${ordinal}|${shown}`;
        if (loadLimits().some((other) => other !== item && other.id === nextId)) {
          list.push(item);
          return;
        }
        pinned = true;
        changed = true;
        list.push({
          ...item,
          ordinal,
          visible: shown,
          id: nextId,
        });
      });
    list.reverse();
    if (changed) saveLimits(list);
  };

  const entryList = () => [...document.querySelectorAll('.entries > .entry')];

  // One limit per row, and only when the task text matches — never by project alone
  const limitMap = () => {
    const entries = entryList();
    const limits = loadLimits();
    const map = new Map();
    const used = new Set();
    entries.forEach((entry) => {
      const hits = limits.filter((item) => !used.has(item) && limitMatches(item, entry));
      hits.sort((a, b) => (b.visible || b.hint || '').length - (a.visible || a.hint || '').length);
      if (!hits[0]) return;
      map.set(entry, hits[0]);
      used.add(hits[0]);
    });
    return map;
  };

  const limitForEntry = (entry) => {
    if (!entry) return null;
    return limitMap().get(entry) || null;
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

  // Panel lives outside React, so hide it in the same frame the modal starts closing
  let suppressPanelUntil = 0;
  const hideLimitPanel = () => {
    const wrap = document.getElementById('ha-planned-stop-wrap');
    if (wrap && !wrap.hidden) wrap.hidden = true;
  };
  const dismissLimitPanel = () => {
    suppressPanelUntil = Date.now() + 500;
    hideLimitPanel();
  };

  const timesheetModalOpen = () => !!document.querySelector('.modal.show .timesheet-modal');

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

  // Pin the panel to the bottom of the modal body, same width as the form
  const placeLimitPanel = (modal, wrap) => {
    const body = modal.querySelector('.modal-body') || modal;
    wrap.hidden = false;
    const panelH = wrap.offsetHeight || 118;
    const pad = `${panelH + 20}px`;
    if (document.documentElement.style.getPropertyValue('--ha-limit-pad') !== pad) {
      document.documentElement.style.setProperty('--ha-limit-pad', pad);
    }
    const rect = body.getBoundingClientRect();
    const cs = getComputedStyle(body);
    const padL = parseFloat(cs.paddingLeft) || 16;
    const padR = parseFloat(cs.paddingRight) || 16;
    const left = Math.round(rect.left + padL);
    const width = Math.max(220, Math.round(rect.width - padL - padR));
    const top = Math.round(rect.bottom - panelH - 8);
    const nextLeft = `${left}px`;
    const nextTop = `${top}px`;
    const nextWidth = `${width}px`;
    if (wrap.style.left !== nextLeft) wrap.style.left = nextLeft;
    if (wrap.style.top !== nextTop) wrap.style.top = nextTop;
    if (wrap.style.width !== nextWidth) wrap.style.width = nextWidth;
  };

  const enhanceModal = () => {
    const modal = document.querySelector('.modal.show .timesheet-modal');
    const existing = document.getElementById('ha-planned-stop-wrap');
    if (!modal || Date.now() < suppressPanelUntil) {
      hideLimitPanel();
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
          const adding = /add time entry/i.test(
            open?.querySelector('.timesheet-modal-header__title')?.textContent || ''
          );
          if (!adding && pendingVisible) {
            saveLimits(
              loadLimits().filter(
                (item) => !(item.day === pageDay() && item.ordinal === pendingOrdinal && norm(item.visible) === pendingVisible)
              )
            );
          }
          if (inputEl) inputEl.value = '';
          showToast('Max sınır kaldırıldı');
          updateRemainUi();
        });
      }
      placeLimitPanel(modal, wrap);

      const input = wrap.querySelector('#ha-planned-stop-input');
      const remainEl = wrap.querySelector('#ha-planned-remain-modal');
      const adding = /add time entry/i.test(
        modal.querySelector('.timesheet-modal-header__title')?.textContent || ''
      );
      // A new entry starts empty even when the note matches an older time
      if (adding) {
        if (input && input.dataset.mode !== 'add') {
          input.value = '';
          input.dataset.filledHint = '';
          input.dataset.mode = 'add';
        }
        if (remainEl && (!remainEl.hidden || remainEl.textContent)) {
          remainEl.hidden = true;
          remainEl.textContent = '';
        }
      }
      const hint = modalHint(modal);
      const saved = adding
        ? null
        : loadLimits().find(
            (item) =>
              item.day === pageDay() &&
              item.ordinal === pendingOrdinal &&
              norm(item.visible) === pendingVisible
          );
      if (!adding && saved && input && document.activeElement !== input && input.dataset.filledHint !== hint) {
        input.value = String(saved.minutes);
        input.dataset.filledHint = `${hint}|${pendingOrdinal}`;
        input.dataset.mode = 'edit';
      }
      const active = runningEntry();
      const activeLimit = limitForEntry(active);
      const modalIsRunning =
        !adding &&
        !!activeLimit &&
        entryList()[pendingOrdinal] === active;
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
    pinFreshLimits();
    updateRowRemain();
    paintQueueMarks();
    enhanceModal();
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
        const fields = modal ? modalFields(modal) : null;
        const hint = fields && (fields.notes || fields.task) ? `${fields.project}|${(fields.notes || fields.task).slice(0, 40)}` : '';
        const adding = /add time entry/i.test(
          modal?.querySelector('.timesheet-modal-header__title')?.textContent || ''
        );
        const visible = adding ? fields?.notes || fields?.task || '' : pendingVisible || fields?.task || fields?.notes || '';
        const ordinal = adding ? -1 : pendingOrdinal;
        if (hint && raw && Number(raw) > 0) {
          upsertLimit(hint, raw, {
            id: adding ? `new|${pageDay()}|${Date.now()}` : `${pageDay()}|${ordinal}|${visible}`,
            rowBlob: pendingRowBlob,
            visible,
            day: pageDay(),
            ordinal,
            project: fields.project,
            task: fields.task,
          });
          showToast(`Max ${Math.min(600, Math.round(Number(raw)))} dk. Dolunca durur.`);
        }
        pendingRowBlob = '';
        pendingVisible = '';
        pendingOrdinal = -1;
        [400, 1000, 1800].forEach((ms) => setTimeout(updateRemainUi, ms));
      },
      true
    );

    // Remember the row opened from the pencil, before the modal covers it
    document.addEventListener(
      'click',
      (e) => {
        if (!isSelman()) return;
        const edit = e.target.closest?.('.entry .edit-btn');
        if (edit) {
          const row = edit.closest('.entry');
          pendingRowBlob = norm(entryBlob(row));
          pendingVisible = rowVisible(row);
          pendingOrdinal = entryList().indexOf(row);
          return;
        }
        if (e.target.closest?.('.new-entry-btn')) {
          pendingRowBlob = '';
          pendingVisible = '';
          pendingOrdinal = -1;
        }
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
    hydrateLimits();
    bindStartCapture();
    // Close button, Cancel, and Escape dismiss the modal before the next UI tick
    document.addEventListener(
      'click',
      (e) => {
        const t = e.target;
        if (!t?.closest || t.closest('#ha-planned-stop-wrap')) return;
        const dismiss =
          t.closest('.timesheet-modal .close, .timesheet-modal button[aria-label="Close"]') ||
          [...document.querySelectorAll('.timesheet-modal button')].find(
            (btn) => btn.contains(t) && /^cancel$/i.test((btn.textContent || '').replace(/\s+/g, ' ').trim())
          );
        if (dismiss) dismissLimitPanel();
      },
      true
    );
    document.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape' && timesheetModalOpen()) dismissLimitPanel();
      },
      true
    );
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
      // Modal loses .show (or unmounts) on close; don't wait for the 1s tick
      if (!timesheetModalOpen()) hideLimitPanel();
      if (uiBusy) return;
      const reactWipedBadges = mutations.some((m) =>
        [...m.removedNodes].some(
          (node) =>
            node.nodeType === 1 &&
            (node.classList?.contains('ha-remain-badge') ||
              node.classList?.contains('ha-queue-mark') ||
              !!node.querySelector?.('.ha-remain-badge, .ha-queue-mark'))
        )
      );
      if (!reactWipedBadges) return;
      updateRemainUi();
    });
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });

    // Refresh poll speed when planned stop is set/cleared
    setInterval(schedulePoll, 15_000);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
