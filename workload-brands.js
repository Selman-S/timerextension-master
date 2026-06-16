// Workload panel — CRO brands (Reports API + manual limits in localStorage)
(() => {
  'use strict';

  const PANEL_ID = 'hyperactive-brands-workload-panel';
  const API_BASE = 'https://hyperactive.pro/api';
  const CRO_DEPARTMENT_ID = 3;
  const MANUAL_LIMITS_KEY = 'ha_cro_manual_limits';

  const WorkloadBrands = {
    loading: false,
    loaded: false,
    cachedProjects: null,
    cachedWlLimits: null,

    getCurrentUser() {
      try {
        const token = localStorage.getItem('user');
        if (!token) return null;
        const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(base64));
      } catch {
        return null;
      }
    },

    async apiFetch(endpoint, options = {}) {
      const token = localStorage.getItem('user');
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      });
      return response.json();
    },

    formatLocalDate(date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    },

    getMonthRange() {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        startDate: this.formatLocalDate(start),
        endDate: this.formatLocalDate(end),
      };
    },

    croReportParams(extra = {}) {
      const { startDate, endDate } = this.getMonthRange();
      return new URLSearchParams({
        startDate,
        endDate,
        departmentId: String(CRO_DEPARTMENT_ID),
        billable: 'true',
        ...extra,
      });
    },

    getManualLimits() {
      try {
        return JSON.parse(localStorage.getItem(MANUAL_LIMITS_KEY) || '{}');
      } catch {
        return {};
      }
    },

    // Save manual CRO limit per project (hours)
    setManualLimit(projectId, value) {
      const limits = this.getManualLimits();
      const key = String(projectId);
      const num = parseFloat(value);

      if (value === '' || value == null || Number.isNaN(num) || num < 0) {
        delete limits[key];
      } else {
        limits[key] = num;
      }

      localStorage.setItem(MANUAL_LIMITS_KEY, JSON.stringify(limits));
    },

    async getMyMonthlyEntries(userId) {
      const params = this.croReportParams({ userId: String(userId) });
      const res = await this.apiFetch(`/reports/detailed?${params.toString()}`);
      if (!res?.success) return [];
      return res.data?.entries || [];
    },

    async getCroTeamEntries() {
      const params = this.croReportParams();
      const res = await this.apiFetch(`/reports/detailed?${params.toString()}`);
      if (!res?.success) return [];
      return res.data?.entries || [];
    },

    toHours(minutes) {
      return Math.round((minutes / 60) * 10) / 10;
    },

    // All projects with CRO team billable time + user's minutes overlay
    buildProjectList(myEntries, teamEntries) {
      const myMinutes = {};
      myEntries.forEach((entry) => {
        const pid = entry.projectId;
        myMinutes[pid] = (myMinutes[pid] || 0) + (Number(entry.hours) || 0);
      });

      const projects = new Map();
      teamEntries.forEach((entry) => {
        const key = String(entry.projectId);
        if (!projects.has(key)) {
          projects.set(key, {
            projectId: entry.projectId,
            brand: entry.projectName,
            clientId: entry.clientId,
            client: entry.clientName,
            department: entry.departmentName || 'CRO',
            teamMinutes: 0,
          });
        }
        projects.get(key).teamMinutes += Number(entry.hours) || 0;
      });

      return Array.from(projects.values())
        .map((p) => ({
          ...p,
          workedMinutes: myMinutes[p.projectId] || 0,
        }))
        .sort((a, b) => b.teamMinutes - a.teamMinutes);
    },

    async fetchAllWorkloadLimits(projects) {
      const clientIds = [...new Set(projects.map((p) => p.clientId))];
      const cache = {};

      await Promise.all(
        clientIds.map(async (clientId) => {
          cache[clientId] = await this.getWorkloadLimitsByProject(clientId);
        })
      );

      return cache;
    },

    async getWorkloadLimitsByProject(clientId) {
      const workloadRes = await this.apiFetch(
        `/services/workload?clientId=${clientId}&departmentId=${CRO_DEPARTMENT_ID}`
      );
      if (!workloadRes?.success) return {};

      const byProject = {};
      (workloadRes.services || []).forEach((service) => {
        const limit = Number(service.limits) || null;
        (service.Projects || []).forEach((project) => {
          if (limit != null) byProject[project.id] = limit;
        });
      });
      return byProject;
    },

    // Resolve limit: API first, then manual localStorage
    resolveLimit(projectId, apiLimit, manualLimits) {
      if (apiLimit != null && apiLimit > 0) return { limit: apiLimit, fromApi: true };
      const manual = manualLimits[String(projectId)];
      if (manual != null && manual > 0) return { limit: manual, fromApi: false };
      return { limit: null, fromApi: false };
    },

    calcRemainingPct(limit, teamWorkedHours) {
      if (limit == null) return { remaining: null, pct: null };
      const remaining = Math.round((limit - teamWorkedHours) * 10) / 10;
      const pct =
        limit > 0 ? Math.round((teamWorkedHours / limit) * 100) : null;
      return { remaining, pct };
    },

    buildRows(projects, wlCache) {
      const manualLimits = this.getManualLimits();

      return projects.map((proj) => {
        const apiLimit = wlCache[proj.clientId]?.[proj.projectId] ?? null;
        const { limit, fromApi } = this.resolveLimit(proj.projectId, apiLimit, manualLimits);
        const myWorkedHours = this.toHours(proj.workedMinutes);
        const teamWorkedHours = this.toHours(proj.teamMinutes);
        const { remaining, pct } = this.calcRemainingPct(limit, teamWorkedHours);

        return {
          projectId: proj.projectId,
          brand: proj.brand,
          client: proj.client,
          department: proj.department,
          myWorkedHours,
          teamWorkedHours,
          limit,
          limitFromApi: fromApi,
          remaining,
          pct,
        };
      });
    },

    formatCell(value, suffix = '') {
      if (value == null || Number.isNaN(value)) return '—';
      return `${value}${suffix}`;
    },

    renderLimitCell(row) {
      if (row.limitFromApi && row.limit != null) {
        return `${row.limit} sa`;
      }

      const manual = this.getManualLimits()[String(row.projectId)];
      const val = manual != null ? manual : '';

      return `<input
        type="number"
        class="ha-bw-limit-input"
        data-project-id="${row.projectId}"
        value="${val}"
        min="0"
        step="0.5"
        placeholder="sa"
        title="Manuel CRO limit (localStorage)"
      />`;
    },

    renderPanel(rows) {
      this.remove();

      const panel = document.createElement('div');
      panel.id = PANEL_ID;
      panel.className = 'ha-brands-workload-panel';

      const totalMyWorked = rows.reduce((s, r) => s + (r.myWorkedHours || 0), 0);
      const totalCroTeam = rows.reduce((s, r) => s + (r.teamWorkedHours || 0), 0);
      const uniqueBrands = new Set(rows.map((r) => r.brand)).size;

      const rowsWithLimit = rows.filter((r) => r.limit != null);
      const totalLimit = rowsWithLimit.reduce((s, r) => s + r.limit, 0);
      const totalRemaining = rowsWithLimit.reduce(
        (s, r) => s + (r.remaining ?? 0),
        0
      );
      const overallPct =
        totalLimit > 0
          ? Math.round((totalCroTeam / totalLimit) * 100)
          : null;

      const fmtSummary = (val, suffix = ' sa') =>
        val == null ? '—' : `${Math.round(val * 10) / 10}${suffix}`;

      const tableRows =
        rows.length === 0
          ? '<tr><td colspan="7" class="ha-bw-empty">Bu ay CRO billable time bulunamadı.</td></tr>'
          : rows
              .map((row) => {
                const pctClass =
                  row.pct == null
                    ? ''
                    : row.pct >= 100
                      ? 'ha-bw-danger'
                      : row.pct >= 80
                        ? 'ha-bw-warn'
                        : 'ha-bw-ok';
                const remainingClass =
                  row.remaining != null && row.remaining < 0 ? 'ha-bw-danger' : '';

                return `<tr data-project-id="${row.projectId}">
                  <td><strong>${row.brand}</strong><br><small>${row.client}</small></td>
                  <td>${row.department}</td>
                  <td><strong>${row.myWorkedHours} sa</strong></td>
                  <td>${this.formatCell(row.teamWorkedHours, ' sa')}</td>
                  <td class="ha-bw-limit-cell">${this.renderLimitCell(row)}</td>
                  <td class="${remainingClass} ha-bw-remaining">${this.formatCell(row.remaining, ' sa')}</td>
                  <td class="${pctClass} ha-bw-pct">${row.pct != null ? `%${row.pct}` : '—'}</td>
                </tr>`;
              })
              .join('');

      const { startDate, endDate } = this.getMonthRange();

      panel.innerHTML = `
        <div class="ha-bw-header">
          <div>
            <h4 class="ha-bw-title">Markalarım — Workload</h4>
            <p class="ha-bw-subtitle">${startDate} – ${endDate} · CRO billable · ekip toplamı Reports New kaynağı</p>
          </div>
          <button type="button" class="ha-bw-refresh" title="Yenile">↻ Yenile</button>
        </div>
        <div class="ha-bw-summary">
          <div class="ha-bw-card"><span>Senin çalışman</span><strong>${Math.round(totalMyWorked * 10) / 10} sa</strong></div>
          <div class="ha-bw-card"><span>Marka sayısı</span><strong>${uniqueBrands}</strong></div>
          <div class="ha-bw-card"><span>CRO toplamı</span><strong>${fmtSummary(totalCroTeam)}</strong></div>
          <div class="ha-bw-card"><span>Limit toplamı</span><strong>${fmtSummary(rowsWithLimit.length ? totalLimit : null)}</strong></div>
          <div class="ha-bw-card"><span>Kalan</span><strong>${fmtSummary(rowsWithLimit.length ? totalRemaining : null)}</strong></div>
          <div class="ha-bw-card"><span>Yüzde</span><strong>${overallPct != null ? `%${overallPct}` : '—'}</strong></div>
        </div>
        <div class="ha-bw-table-wrap">
          <table class="ha-bw-table">
            <thead>
              <tr>
                <th>Marka</th>
                <th>Departman</th>
                <th>Senin saatin</th>
                <th>CRO ekip toplamı</th>
                <th>CRO limit</th>
                <th>Kalan (CRO)</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      `;

      panel.querySelector('.ha-bw-refresh').addEventListener('click', () => {
        this.cachedProjects = null;
        this.loaded = false;
        this.ensurePanel(true);
      });

      this.attachLimitHandlers(panel);

      const anchor =
        document.querySelector('.dataTable-custom') ||
        document.querySelector('header.sc-gFqAkR') ||
        document.querySelector('.card-body');

      if (anchor?.parentNode) {
        anchor.parentNode.insertBefore(panel, anchor);
      } else {
        document.body.prepend(panel);
      }

      this.loaded = true;
    },

    // Re-render from cache after manual limit change (no API refetch)
    rerenderFromCache() {
      if (!this.cachedProjects || !this.cachedWlLimits) return;
      const rows = this.buildRows(this.cachedProjects, this.cachedWlLimits);
      this.renderPanel(rows);
    },

    attachLimitHandlers(panel) {
      panel.querySelectorAll('.ha-bw-limit-input').forEach((input) => {
        const save = () => {
          const projectId = input.dataset.projectId;
          this.setManualLimit(projectId, input.value);
          this.rerenderFromCache();
        };
        input.addEventListener('change', save);
        input.addEventListener('blur', save);
      });
    },

    renderLoading() {
      this.remove();
      const panel = document.createElement('div');
      panel.id = PANEL_ID;
      panel.className = 'ha-brands-workload-panel ha-bw-loading';
      panel.innerHTML =
        '<div class="ha-bw-header"><h4 class="ha-bw-title">Markalarım — Workload</h4></div><p>Yükleniyor…</p>';
      const anchor = document.querySelector('.card-body') || document.body;
      anchor.prepend(panel);
    },

    renderError(message) {
      this.remove();
      const panel = document.createElement('div');
      panel.id = PANEL_ID;
      panel.className = 'ha-brands-workload-panel ha-bw-error';
      panel.innerHTML = `
        <div class="ha-bw-header">
          <h4 class="ha-bw-title">Markalarım — Workload</h4>
          <button type="button" class="ha-bw-refresh">↻ Tekrar dene</button>
        </div>
        <p>${message}</p>
      `;
      panel.querySelector('.ha-bw-refresh').addEventListener('click', () => {
        this.cachedProjects = null;
        this.loaded = false;
        this.ensurePanel(true);
      });
      const anchor = document.querySelector('.card-body') || document.body;
      anchor.prepend(panel);
    },

    remove() {
      const existing = document.getElementById(PANEL_ID);
      if (existing) existing.remove();
    },

    injectStyles() {
      if (document.getElementById('ha-brands-workload-styles')) return;

      const style = document.createElement('style');
      style.id = 'ha-brands-workload-styles';
      style.textContent = `
        .ha-brands-workload-panel {
          margin: 0 0 16px;
          padding: 16px;
          border: 1px solid #d8d6de;
          border-radius: 8px;
          background: #f8f8f8;
          color: #333;
        }
        .ha-bw-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 12px;
        }
        .ha-bw-title { margin: 0 0 4px; font-size: 18px; }
        .ha-bw-subtitle { margin: 0; font-size: 12px; color: #666; }
        .ha-bw-refresh {
          border: 1px solid #7367f0;
          background: #7367f0;
          color: #fff;
          border-radius: 6px;
          padding: 6px 12px;
          cursor: pointer;
          font-size: 13px;
        }
        .ha-bw-refresh:hover { opacity: 0.9; }
        .ha-bw-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 14px;
        }
        .ha-bw-card {
          background: #fff;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          padding: 10px 14px;
          min-width: 120px;
        }
        .ha-bw-card span { display: block; font-size: 11px; color: #666; margin-bottom: 4px; }
        .ha-bw-card strong { font-size: 16px; color: #4839eb; }
        .ha-bw-table-wrap { overflow-x: auto; }
        .ha-bw-table {
          width: 100%;
          border-collapse: collapse;
          background: #fff;
          font-size: 13px;
        }
        .ha-bw-table th, .ha-bw-table td {
          border: 1px solid #ebe9f1;
          padding: 8px 10px;
          text-align: left;
        }
        .ha-bw-table th { background: #f3f2f7; font-weight: 600; }
        .ha-bw-empty { text-align: center; color: #666; padding: 20px; }
        .ha-bw-danger { color: #ea5455; font-weight: 600; }
        .ha-bw-warn { color: #ff9f43; font-weight: 600; }
        .ha-bw-ok { color: #28c76f; font-weight: 600; }
        .ha-bw-loading p, .ha-bw-error p { margin: 8px 0 0; color: #666; }
        .ha-bw-limit-input {
          width: 72px;
          padding: 4px 6px;
          border: 1px solid #7367f0;
          border-radius: 4px;
          font-size: 13px;
        }
        .ha-bw-limit-input:focus {
          outline: none;
          box-shadow: 0 0 0 2px rgba(115, 103, 240, 0.25);
        }
      `;
      document.head.appendChild(style);
    },

    async ensurePanel(force = false) {
      if (this.loading) return;

      const existingPanel = document.getElementById(PANEL_ID);
      if (this.loaded && !force && existingPanel) return;
      if (this.loaded && !existingPanel) this.loaded = false;

      const user = this.getCurrentUser();
      if (!user?.id) return;

      this.injectStyles();
      this.loading = true;
      this.renderLoading();

      try {
        const [myEntries, teamEntries] = await Promise.all([
          this.getMyMonthlyEntries(user.id),
          this.getCroTeamEntries(),
        ]);

        const projects = this.buildProjectList(myEntries, teamEntries);
        const wlCache = await this.fetchAllWorkloadLimits(projects);

        this.cachedProjects = projects;
        this.cachedWlLimits = wlCache;

        const rows = this.buildRows(projects, wlCache);
        this.renderPanel(rows);
      } catch (err) {
        console.error('[HyperActive Ext] Brand workload error:', err);
        this.renderError('Veri yüklenemedi. Oturum açık olduğundan emin olun.');
      } finally {
        this.loading = false;
      }
    },
  };

  window.WorkloadBrands = WorkloadBrands;
})();
