// Personal billable pulse — /time page only (own data, scoped API)
(() => {
  'use strict';

  const PANEL_ID = 'ha-my-pulse';
  const STYLE_ID = 'ha-my-pulse-style';
  const BASE_URL = 'https://hyperactive.pro/api';
  const TREND_MONTHS = 12; // last 12 months including current
  const CHECK_MS = 1200;

  let lastPath = '';
  let loading = false;
  let chartOpen = false; // accordion starts collapsed
  let cache = null; // { key, data, fetchedAt }

  const MONTH_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

  const pad = (n) => String(n).padStart(2, '0');

  const formatLocalDate = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const getMonthRange = (offset = 0) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
    return {
      startDate: formatLocalDate(start),
      endDate: formatLocalDate(end),
      label: `${MONTH_TR[start.getMonth()]} ${String(start.getFullYear()).slice(-2)}`,
      offset,
    };
  };

  const formatHm = (minutes) => {
    const m = Math.round(Number(minutes) || 0);
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${h}:${String(min).padStart(2, '0')}`;
  };

  const toHours = (minutes) => Math.round(((Number(minutes) || 0) / 60) * 10) / 10;

  const getToken = () => localStorage.getItem('user');

  const getCurrentUser = () => {
    try {
      const token = getToken();
      if (!token) return null;
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(base64));
    } catch {
      return null;
    }
  };

  const fetchMonthMinutes = async (startDate, endDate) => {
    const params = new URLSearchParams({
      startDate,
      endDate,
      billable: 'true',
    });
    const res = await fetch(`${BASE_URL}/reports/dashboard?${params}`, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || `HTTP ${res.status}`);
    return Number(json.data?.summary?.totalHours) || 0;
  };

  // Completed months ending last month + current month as last point
  const buildTrendMonths = () => {
    const months = [];
    for (let i = TREND_MONTHS - 1; i >= 0; i--) {
      months.push(getMonthRange(-i));
    }
    return months;
  };

  const loadPulseData = async (force = false) => {
    const months = buildTrendMonths();
    const key = months.map((m) => m.startDate).join('|');
    if (!force && cache?.key === key && Date.now() - cache.fetchedAt < 60_000) {
      return cache.data;
    }

    const values = await Promise.all(
      months.map((m) => fetchMonthMinutes(m.startDate, m.endDate))
    );

    const current = values[values.length - 1] || 0;
    const previous = values[values.length - 2] || 0;
    const completed = values.slice(0, -1);
    const avg =
      completed.length > 0
        ? completed.reduce((s, v) => s + v, 0) / completed.length
        : 0;

    let vsAvgPct = null;
    if (avg > 0) {
      vsAvgPct = Math.round(((previous - avg) / avg) * 100);
    } else if (previous > 0) {
      vsAvgPct = 100;
    }

    // Compare last completed month vs avg of months before it
    const priorForLast = completed.slice(0, -1);
    let lastCompletedVsAvg = null;
    if (priorForLast.length > 0) {
      const priorAvg = priorForLast.reduce((s, v) => s + v, 0) / priorForLast.length;
      if (priorAvg > 0) {
        lastCompletedVsAvg = Math.round(((previous - priorAvg) / priorAvg) * 100);
      }
    }

    const data = {
      months,
      values,
      current,
      previous,
      avg,
      vsAvgPct: lastCompletedVsAvg ?? vsAvgPct,
      user: getCurrentUser(),
    };

    cache = { key, data, fetchedAt: Date.now() };
    return data;
  };

  const injectStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID} {
        --mp-ink: #1c1917;
        --mp-muted: #78716c;
        --mp-line: #e7e5e4;
        --mp-bg: #fafaf9;
        --mp-card: #ffffff;
        --mp-accent: #0f766e;
        --mp-up: #15803d;
        --mp-down: #b45309;
        font-family: "Segoe UI", "IBM Plex Sans", system-ui, sans-serif;
        background: var(--mp-card);
        border: 1px solid var(--mp-line);
        border-radius: 12px;
        padding: 14px 16px 12px;
        margin: 0 0 14px;
        box-shadow: 0 1px 0 rgba(28, 25, 23, 0.04);
      }
      #${PANEL_ID} .mp-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }
      #${PANEL_ID} .mp-title {
        margin: 0;
        font-size: 13px;
        font-weight: 650;
        letter-spacing: 0.02em;
        color: var(--mp-ink);
      }
      #${PANEL_ID} .mp-sub {
        margin: 2px 0 0;
        font-size: 11px;
        color: var(--mp-muted);
      }
      #${PANEL_ID} .mp-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      #${PANEL_ID} .mp-refresh {
        border: 1px solid var(--mp-line);
        background: var(--mp-bg);
        color: var(--mp-ink);
        border-radius: 8px;
        font-size: 11px;
        padding: 5px 10px;
        cursor: pointer;
      }
      #${PANEL_ID} .mp-refresh:hover { border-color: #a8a29e; }
      #${PANEL_ID} .mp-refresh:disabled { opacity: 0.55; cursor: wait; }
      #${PANEL_ID} .mp-metrics {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 12px;
      }
      #${PANEL_ID} .mp-metric {
        background: var(--mp-bg);
        border-radius: 10px;
        padding: 10px 12px;
        min-width: 0;
      }
      #${PANEL_ID} .mp-metric-label {
        display: block;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--mp-muted);
        margin-bottom: 4px;
      }
      #${PANEL_ID} .mp-metric-value {
        font-size: 20px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        color: var(--mp-ink);
        line-height: 1.1;
      }
      #${PANEL_ID} .mp-metric-value span {
        font-size: 12px;
        font-weight: 500;
        color: var(--mp-muted);
        margin-left: 2px;
      }
      #${PANEL_ID} .mp-metric.is-up .mp-metric-value { color: var(--mp-up); }
      #${PANEL_ID} .mp-metric.is-down .mp-metric-value { color: var(--mp-down); }
      #${PANEL_ID} .mp-metric-hint {
        margin-top: 4px;
        font-size: 10px;
        color: var(--mp-muted);
      }
      #${PANEL_ID} .mp-chart-wrap {
        border-top: 1px solid var(--mp-line);
        margin-top: 2px;
      }
      #${PANEL_ID} .mp-chart-toggle {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 2px 2px;
        border: 0;
        background: transparent;
        cursor: pointer;
        font: inherit;
        color: var(--mp-muted);
        text-align: left;
      }
      #${PANEL_ID} .mp-chart-toggle:hover { color: var(--mp-ink); }
      #${PANEL_ID} .mp-chart-toggle-left {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        font-weight: 600;
      }
      #${PANEL_ID} .mp-chart-chevron {
        display: inline-flex;
        width: 18px;
        height: 18px;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        background: var(--mp-bg);
        color: var(--mp-ink);
        font-size: 10px;
        transition: transform 0.18s ease;
      }
      #${PANEL_ID} .mp-chart-wrap.is-open .mp-chart-chevron {
        transform: rotate(180deg);
      }
      #${PANEL_ID} .mp-chart-body {
        display: none;
        padding: 6px 0 2px;
      }
      #${PANEL_ID} .mp-chart-wrap.is-open .mp-chart-body {
        display: block;
      }
      #${PANEL_ID} .mp-chart-head {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        margin-bottom: 6px;
        font-size: 11px;
        color: var(--mp-muted);
      }
      #${PANEL_ID} .mp-chart-legend {
        display: flex;
        gap: 12px;
        align-items: center;
      }
      #${PANEL_ID} .mp-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 2px;
        margin-right: 4px;
        vertical-align: middle;
      }
      #${PANEL_ID} .mp-dot.hours { background: var(--mp-accent); }
      #${PANEL_ID} .mp-dot.avg {
        background: transparent;
        border: 1.5px dashed #a8a29e;
        box-sizing: border-box;
      }
      #${PANEL_ID} .mp-svg {
        width: 100%;
        height: 300px;
        display: block;
      }
      #${PANEL_ID} .mp-chart-note {
        margin: 4px 0 0;
        font-size: 10px;
        color: var(--mp-muted);
      }
      #${PANEL_ID} .mp-error {
        color: var(--mp-down);
        font-size: 12px;
        margin: 0;
      }
      #${PANEL_ID} .mp-loading {
        color: var(--mp-muted);
        font-size: 12px;
        margin: 0;
      }
      @media (max-width: 900px) {
        #${PANEL_ID} .mp-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
    `;
    document.head.appendChild(style);
  };

  // Smooth monotone-ish path through points (Catmull-Rom → cubic Bezier)
  const buildSmoothPath = (pts) => {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  };

  const niceMax = (value) => {
    const v = Math.max(value, 1);
    const step = v <= 80 ? 20 : v <= 160 ? 40 : 50;
    return Math.ceil(v / step) * step;
  };

  const buildSvgChart = (months, values, avgMinutes) => {
    const w = 720;
    const h = 168;
    const padL = 36;
    const padR = 52;
    const padT = 22;
    const padB = 28;
    const hours = values.map(toHours);
    const avgH = Math.round(toHours(avgMinutes) * 10) / 10;
    const maxY = niceMax(Math.max(...hours, avgH) * 1.08);
    const n = hours.length;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const lastIdx = n - 1;

    const xAt = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
    const yAt = (v) => padT + plotH - (Math.min(v, maxY) / maxY) * plotH;

    const pts = hours.map((v, i) => ({ x: xAt(i), y: yAt(v), v, i }));
    const linePath = buildSmoothPath(pts);
    const areaPath = `${linePath} L ${xAt(lastIdx)} ${padT + plotH} L ${xAt(0)} ${padT + plotH} Z`;
    const avgY = yAt(avgH);

    // Horizontal grid + Y labels
    const gridCount = 4;
    const grid = [];
    for (let g = 0; g <= gridCount; g++) {
      const val = (maxY / gridCount) * g;
      const y = yAt(val);
      grid.push(`
        <line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}"
          stroke="#e7e5e4" stroke-width="1" />
        <text x="${padL - 6}" y="${y + 3}" text-anchor="end" fill="#a8a29e" font-size="9">${Math.round(val)}</text>
      `);
    }

    // X labels — show every month; short form for density
    const labels = months
      .map((m, i) => {
        const x = xAt(i);
        const isCurrent = i === lastIdx;
        return `<text x="${x}" y="${h - 8}" text-anchor="middle"
          fill="${isCurrent ? '#0f766e' : '#78716c'}"
          font-size="9" font-weight="${isCurrent ? '700' : '400'}">${m.label}</text>`;
      })
      .join('');

    // Value labels — skip current if crowded near neighbors; always show peaks & last completed
    const valueLabels = hours
      .map((v, i) => {
        const x = xAt(i);
        const y = Math.max(padT + 10, yAt(v) - 8);
        const isCurrent = i === lastIdx;
        const fill = isCurrent ? '#0f766e' : '#1c1917';
        return `<text x="${x}" y="${y}" text-anchor="middle" fill="${fill}"
          font-size="9" font-weight="650">${v}</text>`;
      })
      .join('');

    const dots = hours
      .map((v, i) => {
        const isCurrent = i === lastIdx;
        if (isCurrent) {
          return `<circle cx="${xAt(i)}" cy="${yAt(v)}" r="5" fill="#fff" stroke="#0f766e" stroke-width="2.25"/>
            <circle cx="${xAt(i)}" cy="${yAt(v)}" r="2" fill="#0f766e"/>`;
        }
        const above = v >= avgH;
        const fill = above ? '#0f766e' : '#b45309';
        return `<circle cx="${xAt(i)}" cy="${yAt(v)}" r="3.25" fill="${fill}" stroke="#fff" stroke-width="1.5"/>`;
      })
      .join('');

    return `
      <svg class="mp-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Son 12 ay billable trend">
        <defs>
          <linearGradient id="mpFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0f766e" stop-opacity="0.22"/>
            <stop offset="100%" stop-color="#0f766e" stop-opacity="0.02"/>
          </linearGradient>
        </defs>
        ${grid.join('')}
        <line x1="${padL}" y1="${avgY}" x2="${padL + plotW}" y2="${avgY}"
          stroke="#78716c" stroke-width="1.4" stroke-dasharray="5 4" />
        <text x="${padL + plotW + 4}" y="${avgY + 3}" fill="#78716c" font-size="9">ort ${avgH}</text>
        <path d="${areaPath}" fill="url(#mpFill)" stroke="none" />
        <path d="${linePath}" fill="none" stroke="#0f766e" stroke-width="2.4"
          stroke-linejoin="round" stroke-linecap="round" />
        ${dots}
        ${valueLabels}
        ${labels}
      </svg>
    `;
  };

  const findMountTarget = () => {
    const card = document.querySelector('.timesheet-card');
    if (!card) return null;
    // Prefer inserting before timesheet card inside its parent
    return card;
  };

  const ensurePanelShell = () => {
    injectStyles();
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;

    const card = findMountTarget();
    if (!card?.parentNode) return null;

    panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.setAttribute('aria-live', 'polite');
    panel.innerHTML = `<p class="mp-loading">Billable özet yükleniyor…</p>`;
    card.parentNode.insertBefore(panel, card);
    return panel;
  };

  const render = (panel, data) => {
    const vs = data.vsAvgPct;
    const vsClass = vs == null ? '' : vs >= 0 ? 'is-up' : 'is-down';
    const vsText =
      vs == null ? '—' : `${vs >= 0 ? '+' : ''}${vs}%`;
    const vsHint =
      vs == null
        ? 'karşılaştırma yok'
        : vs >= 0
          ? 'geçen ay · ortalamanın üstünde'
          : 'geçen ay · ortalamanın altında';

    const name = data.user?.name ? ` · ${data.user.name}` : '';

    panel.innerHTML = `
      <div class="mp-head">
        <div>
          <h2 class="mp-title">Senin Pulse${name}</h2>
          <p class="mp-sub">Sadece kendi billable saatlerin · son ${TREND_MONTHS} ay</p>
        </div>
        <div class="mp-actions">
          <button type="button" class="mp-refresh" id="ha-my-pulse-refresh">Yenile</button>
        </div>
      </div>
      <div class="mp-metrics">
        <div class="mp-metric">
          <span class="mp-metric-label">Bu ay</span>
          <div class="mp-metric-value">${formatHm(data.current)}<span>sa</span></div>
          <div class="mp-metric-hint">${data.months[data.months.length - 1].label} · devam ediyor</div>
        </div>
        <div class="mp-metric">
          <span class="mp-metric-label">Geçen ay</span>
          <div class="mp-metric-value">${formatHm(data.previous)}<span>sa</span></div>
          <div class="mp-metric-hint">${data.months[data.months.length - 2]?.label || '—'}</div>
        </div>
        <div class="mp-metric">
          <span class="mp-metric-label">Ort. (tam aylar)</span>
          <div class="mp-metric-value">${formatHm(Math.round(data.avg))}<span>sa</span></div>
          <div class="mp-metric-hint">son ${TREND_MONTHS - 1} tamamlanmış ay</div>
        </div>
        <div class="mp-metric ${vsClass}">
          <span class="mp-metric-label">vs ortalama</span>
          <div class="mp-metric-value">${vsText}</div>
          <div class="mp-metric-hint">${vsHint}</div>
        </div>
      </div>
      <div class="mp-chart-wrap ${chartOpen ? 'is-open' : ''}" id="ha-my-pulse-chart">
        <button type="button" class="mp-chart-toggle" id="ha-my-pulse-chart-toggle"
          aria-expanded="${chartOpen ? 'true' : 'false'}" aria-controls="ha-my-pulse-chart-body">
          <span class="mp-chart-toggle-left">
            <span class="mp-chart-chevron" aria-hidden="true">▾</span>
            Aylık billable · son 12 ay
          </span>
          <span>${chartOpen ? 'Gizle' : 'Grafiği göster'}</span>
        </button>
        <div class="mp-chart-body" id="ha-my-pulse-chart-body">
          <div class="mp-chart-head">
            <div class="mp-chart-legend">
              <span><i class="mp-dot hours"></i>tam ay</span>
              <span><i class="mp-dot avg"></i>ort. çizgi</span>
            </div>
          </div>
          ${buildSvgChart(data.months, data.values, data.avg)}
          <p class="mp-chart-note">Yeşil nokta ortalamanın üstü · amber altı · boş halka bu ay (devam ediyor)</p>
        </div>
      </div>
    `;

    panel.querySelector('#ha-my-pulse-refresh')?.addEventListener('click', () => {
      refresh(true);
    });

    const chartWrap = panel.querySelector('#ha-my-pulse-chart');
    const chartToggle = panel.querySelector('#ha-my-pulse-chart-toggle');
    chartToggle?.addEventListener('click', () => {
      chartOpen = !chartOpen;
      chartWrap?.classList.toggle('is-open', chartOpen);
      chartToggle.setAttribute('aria-expanded', chartOpen ? 'true' : 'false');
      const label = chartToggle.querySelector('span:last-child');
      if (label) label.textContent = chartOpen ? 'Gizle' : 'Grafiği göster';
    });
  };

  const refresh = async (force = false) => {
    if (loading) return;
    const panel = ensurePanelShell();
    if (!panel) return;

    loading = true;
    const btn = panel.querySelector('#ha-my-pulse-refresh');
    if (btn) btn.disabled = true;
    if (!panel.querySelector('.mp-metrics')) {
      panel.innerHTML = `<p class="mp-loading">Billable özet yükleniyor…</p>`;
    }

    try {
      const data = await loadPulseData(force);
      render(panel, data);
    } catch (err) {
      panel.innerHTML = `
        <div class="mp-head">
          <div>
            <h2 class="mp-title">Senin Pulse</h2>
            <p class="mp-sub">Veri alınamadı</p>
          </div>
          <button type="button" class="mp-refresh" id="ha-my-pulse-refresh">Tekrar dene</button>
        </div>
        <p class="mp-error">${err?.message || 'Bilinmeyen hata'}</p>
      `;
      panel.querySelector('#ha-my-pulse-refresh')?.addEventListener('click', () => refresh(true));
    } finally {
      loading = false;
    }
  };

  const remove = () => {
    document.getElementById(PANEL_ID)?.remove();
  };

  const sync = () => {
    const path = window.location.pathname || '';
    if (path === '/time') {
      if (!document.getElementById(PANEL_ID) || path !== lastPath) {
        refresh(false);
      }
    } else {
      remove();
    }
    lastPath = path;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sync);
  } else {
    sync();
  }

  setInterval(sync, CHECK_MS);
})();
