// Reports V2 — Chart.js wrappers (line + pie)
(() => {
  'use strict';

  const CHART_COLORS = [
    '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4',
    '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#a855f7', '#0ea5e9',
  ];

  let instances = [];
  let instancesById = new Map();
  let queue = [];
  let idCounter = 0;
  let pluginsRegistered = false;

  const nextId = (prefix) => `rv2-chart-${prefix}-${++idCounter}`;

  const minutesToHours = (m) => Math.round((Number(m) || 0) / 6) / 10;

  const ensurePlugins = () => {
    if (pluginsRegistered || typeof Chart === 'undefined') return;
    if (typeof ChartDataLabels !== 'undefined') {
      Chart.register(ChartDataLabels);
    }
    pluginsRegistered = true;
  };

  const lineOptions = () => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.parsed.y} sa`,
          afterLabel: (ctx) => {
            const pts = ctx.chart.$rv2Points;
            const change = pts?.[ctx.dataIndex]?.changePct;
            if (change == null) return '';
            return `Değişim: ${change > 0 ? '+' : ''}${change}%`;
          },
        },
      },
      datalabels: {
        display: (ctx) => Number(ctx.dataset.data[ctx.dataIndex]) > 0,
        align: 'top',
        anchor: 'end',
        offset: 4,
        formatter: (v) => `${v} sa`,
        color: '#64748b',
        font: { size: 10, weight: '600' },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Saat', color: '#64748b', font: { size: 11 } },
        grid: { color: 'rgba(148,163,184,0.2)' },
        ticks: { color: '#64748b' },
      },
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 10 } },
      },
    },
  });

  const pieOptions = () => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '52%',
    plugins: {
      legend: {
        position: 'right',
        labels: { boxWidth: 10, padding: 10, font: { size: 11 }, color: '#475569' },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const pct = total ? Math.round((ctx.parsed / total) * 100) : 0;
            return `${ctx.label}: ${ctx.parsed} sa (%${pct})`;
          },
        },
      },
      datalabels: {
        display: (ctx) => {
          const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
          if (!total) return false;
          return (ctx.dataset.data[ctx.dataIndex] / total) * 100 >= 6;
        },
        formatter: (v, ctx) => {
          const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
          const pct = total ? Math.round((v / total) * 100) : 0;
          return `%${pct}`;
        },
        color: '#fff',
        font: { weight: 'bold', size: 10 },
      },
    },
  });

  window.ReportsV2Charts = {
    seriesColor(index) {
      return CHART_COLORS[Math.abs(index) % CHART_COLORS.length];
    },

    beginRender() {
      instances.forEach((c) => c.destroy());
      instances = [];
      instancesById.clear();
      queue = [];
    },

    queueLineChart(points, { label = 'Billable', color = '#6366f1', idPrefix = 'line', chartId } = {}) {
      if (!points?.length) return '<p class="rv2-empty">Veri yok</p>';
      const id = chartId || nextId(idPrefix);
      queue.push({ type: 'line', id, points, label, color });
      return `<div class="rv2-chart-wrap rv2-chart-wrap-line"><canvas id="${id}"></canvas></div>`;
    },

    queuePieChart(items, { labelKey = 'name', valueKey = 'value', idPrefix = 'pie', chartId } = {}) {
      const filtered = (items || []).filter((i) => Number(i[valueKey]) > 0);
      if (!filtered.length) return '<p class="rv2-empty">Veri yok</p>';
      const id = chartId || nextId(idPrefix);
      queue.push({ type: 'pie', id, items: filtered, labelKey, valueKey });
      return `<div class="rv2-chart-wrap rv2-chart-wrap-pie"><canvas id="${id}"></canvas></div>`;
    },

    // Update an existing line chart without re-mounting other charts
    updateLineChart(chartId, points, { label = 'Billable', color = '#6366f1' } = {}) {
      if (!points?.length) return;
      const chart = instancesById.get(chartId);
      if (!chart) return;
      const ds = chart.data.datasets[0];
      chart.data.labels = points.map((p) => p.label);
      ds.data = points.map((p) => minutesToHours(p.value));
      ds.label = label;
      ds.borderColor = color;
      ds.backgroundColor = `${color}22`;
      ds.pointBackgroundColor = color;
      chart.$rv2Points = points;
      chart.update();
    },

    mountAll() {
      if (typeof Chart === 'undefined') return;
      ensurePlugins();

      queue.forEach((cfg) => {
        const el = document.getElementById(cfg.id);
        if (!el) return;

        if (cfg.type === 'line') {
          const chart = new Chart(el, {
            type: 'line',
            data: {
              labels: cfg.points.map((p) => p.label),
              datasets: [
                {
                  label: cfg.label,
                  data: cfg.points.map((p) => minutesToHours(p.value)),
                  borderColor: cfg.color,
                  backgroundColor: `${cfg.color}22`,
                  fill: true,
                  tension: 0.35,
                  pointRadius: 5,
                  pointHoverRadius: 7,
                  pointBackgroundColor: cfg.color,
                  pointBorderColor: '#fff',
                  pointBorderWidth: 2,
                  borderWidth: 2.5,
                },
              ],
            },
            options: lineOptions(),
          });
          chart.$rv2Points = cfg.points;
          instances.push(chart);
          instancesById.set(cfg.id, chart);
          return;
        }

        if (cfg.type === 'pie') {
          const labels = cfg.items.map((i) => i[cfg.labelKey]);
          const data = cfg.items.map((i) => minutesToHours(i[cfg.valueKey]));
          const colors = cfg.items.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);
          const chart = new Chart(el, {
            type: 'doughnut',
            data: {
              labels,
              datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }],
            },
            options: pieOptions(),
          });
          instances.push(chart);
          instancesById.set(cfg.id, chart);
        }
      });

      queue = [];
    },

    destroyAll() {
      instances.forEach((c) => c.destroy());
      instances = [];
      instancesById.clear();
      queue = [];
    },
  };
})();
