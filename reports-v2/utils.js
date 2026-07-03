// Reports V2 — API, date/time helpers, formatting
(() => {
  'use strict';

  const { BASE_URL } = window.ReportsV2Constants;

  const getAuthToken = () => localStorage.getItem('user');

  const fetchAPI = async (endpoint, options = {}) => {
    const token = getAuthToken();
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
    return data;
  };

  const formatLocalDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getMonthRange = (offset = 0) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
    return { startDate: formatLocalDate(start), endDate: formatLocalDate(end) };
  };

  // Jan 1 → today for YTD rankings
  const getYearToDateRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    return { startDate: formatLocalDate(start), endDate: formatLocalDate(now) };
  };

  const convertMinutesToHours = (minutes) => {
    const m = Number(minutes) || 0;
    if (m === 0) return '0:00';
    const hours = Math.floor(m / 60);
    const mins = Math.round(m % 60);
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  // Readable hours with thousand separators (e.g. 2.918:45 sa)
  const formatMinutesReadable = (minutes) => {
    const raw = convertMinutesToHours(minutes);
    const [h, min] = raw.split(':');
    const formattedH = Number(h).toLocaleString('tr-TR');
    if (!min || min === '00') return `${formattedH} sa`;
    return `${formattedH}:${min} sa`;
  };

  const renderProgressBar = (pct, variant = 'auto') => {
    const p = Math.min(100, Math.max(0, Number(pct) || 0));
    let barClass = 'rv2-bar-ok';
    if (variant === 'auto') {
      barClass = p >= 100 ? 'rv2-bar-danger' : p >= 80 ? 'rv2-bar-warn' : 'rv2-bar-ok';
    } else {
      barClass = `rv2-bar-${variant}`;
    }
    return `<div class="rv2-progress" title="%${p}"><div class="rv2-progress-fill ${barClass}" style="width:${p}%"></div></div>`;
  };

  // Pill-segment progress (reference: Active Learning Programs table)
  const renderSegmentedProgress = (pct, segments = 24) => {
    const p = Math.min(100, Math.max(0, Math.round(Number(pct) || 0)));
    const filled = Math.round((p / 100) * segments);
    let segClass = 'rv2-seg-ok';
    if (p >= 100) segClass = 'rv2-seg-danger';
    else if (p >= 80) segClass = 'rv2-seg-warn';

    const pills = Array.from({ length: segments }, (_, i) =>
      `<span class="rv2-seg ${i < filled ? segClass : 'rv2-seg-empty'}"></span>`
    ).join('');

    return `<div class="rv2-segmented" title="%${p}"><div class="rv2-seg-track">${pills}</div><span class="rv2-seg-pct">${p}%</span></div>`;
  };

  // Horizontal bar rows — kept for non-chart fallbacks
  const renderHorizBars = (items, { valueKey, labelKey, format = (v) => v, maxItems = 6 } = {}) => {
    if (!items?.length) return '';
    const slice = items.slice(0, maxItems);
    const max = Math.max(...slice.map((i) => Number(i[valueKey]) || 0), 1);
    return `<div class="rv2-hbar-chart">${slice
      .map((item) => {
        const val = Number(item[valueKey]) || 0;
        const width = Math.round((val / max) * 100);
        return `<div class="rv2-hbar-row">
          <span class="rv2-hbar-label">${item[labelKey]}</span>
          <div class="rv2-hbar-track"><div class="rv2-hbar-fill" style="width:${width}%"></div></div>
          <span class="rv2-hbar-value">${format(val)}</span>
        </div>`;
      })
      .join('')}</div>`;
  };

  const convertMinutesToDecimalHours = (minutes) => {
    if (!minutes) return 0;
    return (minutes / 60).toFixed(2);
  };

  const rankMedal = (index) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return index + 1;
  };

  const getPreviousPeriodRange = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.round((end - start) / 86400000) + 1;
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - days + 1);
    return { startDate: formatLocalDate(prevStart), endDate: formatLocalDate(prevEnd) };
  };

  const formatTrend = (current, previous) => {
    const cur = Number(current) || 0;
    const prev = Number(previous) || 0;
    if (prev === 0) {
      if (cur > 0) return { text: '↑ yeni', cls: 'rv2-trend-up' };
      return { text: '—', cls: 'rv2-trend-flat' };
    }
    const pct = Math.round(((cur - prev) / prev) * 100);
    if (pct === 0) return { text: '→ 0%', cls: 'rv2-trend-flat' };
    if (pct > 0) return { text: `↑ ${pct}%`, cls: 'rv2-trend-up' };
    return { text: `↓ ${Math.abs(pct)}%`, cls: 'rv2-trend-down' };
  };

  const renderTrend = (current, previous) => {
    const t = formatTrend(current, previous);
    return `<span class="rv2-trend-badge ${t.cls}">${t.text}</span>`;
  };

  const getCurrentUser = () => {
    try {
      const token = localStorage.getItem('user');
      if (!token) return null;
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(base64));
    } catch {
      return null;
    }
  };

  const toHours = (minutes) => Math.round((minutes / 60) * 10) / 10;

  const MONTH_NAMES_TR = [
    'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara',
  ];

  // Short month label for trend charts (e.g. "Haz 26")
  const formatMonthLabel = (offset) => {
    const { startDate } = getMonthRange(offset);
    const d = new Date(startDate);
    return `${MONTH_NAMES_TR[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
  };

  // Offsets for N completed months ending at filter end (skips partial current month)
  const getTrendMonthOffsets = (endDateStr, count = window.ReportsV2Constants.TREND_MONTH_COUNT) => {
    const now = new Date();
    const ref = endDateStr ? new Date(`${endDateStr}T12:00:00`) : now;
    const todayMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const refMonth = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const monthsFromToday =
      (refMonth.getFullYear() - todayMonth.getFullYear()) * 12 +
      (refMonth.getMonth() - todayMonth.getMonth());
    const lastDayOfRefMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
    const isRefMonthComplete = ref.getDate() >= lastDayOfRefMonth;
    const isRefCurrentMonth = monthsFromToday === 0;

    let lastOffsetFromToday = monthsFromToday;
    if (isRefCurrentMonth && !isRefMonthComplete) {
      lastOffsetFromToday = -1;
    }

    const offsets = [];
    for (let i = count - 1; i >= 0; i--) offsets.push(lastOffsetFromToday - i);
    return offsets;
  };

  const buildTrendMonths = (endDateStr, count = window.ReportsV2Constants.TREND_MONTH_COUNT) =>
    getTrendMonthOffsets(endDateStr, count).map((offset) => ({
      offset,
      label: formatMonthLabel(offset),
      ...getMonthRange(offset),
    }));

  // % change vs average of all prior months in the series (not raw MoM)
  const calcAvgPriorChangePct = (value, priorValues) => {
    if (!priorValues?.length) return null;
    const avg = priorValues.reduce((s, v) => s + v, 0) / priorValues.length;
    if (avg === 0) return value > 0 ? 100 : 0;
    return Math.round(((value - avg) / avg) * 100);
  };

  // Attach average-based change % to each point in a time series
  const buildTrendPoints = (values, labels) =>
    values.map((value, i) => {
      const numValue = Number(value) || 0;
      const prior = values.slice(0, i).map((v) => Number(v) || 0);
      const changePct = i > 0 ? calcAvgPriorChangePct(numValue, prior) : null;
      return { label: labels[i], value: numValue, changePct };
    });

  // Generic tabbed monthly trend (departments or brands) — line chart via Chart.js
  const renderTrendTabs = (
    months,
    series,
    activeId,
    { dataAttr = 'series-id', tabClass = 'rv2-series-tab', tabMetric = 'change', chartId, colorizeTabs = false } = {}
  ) => {
    if (!series?.length) return '<p class="rv2-empty">Veri yok</p>';
    const C = window.ReportsV2Charts;
    const labels = months.map((m) => m.label);
    const active = series.find((s) => String(s.id) === String(activeId)) || series[0];
    const points = buildTrendPoints(active.values, labels);
    const colorIdx = series.findIndex((s) => String(s.id) === String(active.id));
    const color = C?.seriesColor(colorIdx) || '#6366f1';

    const tabSecondary = (s) => {
      const points = buildTrendPoints(s.values, labels);
      const lastPoint = points[points.length - 1];
      if (tabMetric === 'hours') {
        return `<span class="rv2-dept-tab-metric">${formatMinutesReadable(lastPoint.value)}</span>`;
      }
      if (lastPoint.changePct == null) {
        return `<span class="rv2-dept-tab-metric">${formatMinutesReadable(lastPoint.value)}</span>`;
      }
      const change = lastPoint.changePct;
      const chCls = change >= 0 ? 'rv2-chart-change-up' : 'rv2-chart-change-down';
      return `<span class="rv2-dept-tab-change ${chCls}">${change >= 0 ? '+' : ''}${change}%</span>`;
    };

    const tabs = series
      .map((s, i) => {
        const isActive = String(s.id) === String(active.id);
        const sub = s.client ? `<span class="rv2-tab-sub">${s.client}</span>` : '';
        const tabColor = colorizeTabs ? C?.seriesColor(i) || '#6366f1' : '';
        const styleAttr = tabColor ? ` style="--rv2-tab-color:${tabColor}"` : '';
        const nameCls = colorizeTabs ? 'rv2-dept-tab-name rv2-brand-tab-name' : 'rv2-dept-tab-name';
        return `<button type="button" class="${tabClass} ${isActive ? 'active' : ''}" data-${dataAttr}="${s.id}"${styleAttr}>
          <span class="${nameCls}">${s.name}</span>${sub}
          ${tabSecondary(s)}
        </button>`;
      })
      .join('');

    const chartHtml = C
      ? C.queueLineChart(points, { label: active.name, color, idPrefix: dataAttr, chartId })
      : '<p class="rv2-empty">Chart.js yüklenemedi</p>';

    return `<div class="rv2-dept-trend-tabs">
      <nav class="rv2-dept-tabs">${tabs}</nav>
      ${chartHtml}
    </div>`;
  };

  const renderDeptTrendTabs = (months, series, activeDeptId = null) =>
    renderTrendTabs(months, series, activeDeptId, { dataAttr: 'dept-id', tabClass: 'rv2-dept-tab' });

  const renderBrandTrendTabs = (months, series, activeBrandId = null) =>
    renderTrendTabs(months, series, activeBrandId, {
      dataAttr: 'brand-id',
      tabClass: 'rv2-brand-tab',
      tabMetric: 'change',
      chartId: 'rv2-chart-brand-trend',
      colorizeTabs: true,
    });

  window.ReportsV2Utils = {
    fetchAPI,
    formatLocalDate,
    getMonthRange,
    getYearToDateRange,
    convertMinutesToHours,
    formatMinutesReadable,
    convertMinutesToDecimalHours,
    rankMedal,
    getPreviousPeriodRange,
    formatTrend,
    renderTrend,
    renderProgressBar,
    renderSegmentedProgress,
    getCurrentUser,
    toHours,
    formatMonthLabel,
    getTrendMonthOffsets,
    buildTrendMonths,
    calcAvgPriorChangePct,
    buildTrendPoints,
    renderDeptTrendTabs,
    renderBrandTrendTabs,
  };
})();
