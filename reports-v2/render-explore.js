// Reports V2 — explore tab
(() => {
  'use strict';

  const C = window.ReportsV2Constants;
  const U = window.ReportsV2Utils;
  const {
    AVATAR_URL,
    MIN_AVG_HOURS,
    TITLE_OPTIONS,
    LATE_ENTRY_DAYS,
    CRO_DEPARTMENT_ID,
    REPORTS_V2_CONTAINER_ID,
  } = C;
  const {
    formatMinutesReadable,
    convertMinutesToDecimalHours,
    rankMedal,
    renderTrend,
    formatTrend,
    renderProgressBar,
    getMonthRange,
  } = U;


  window.ReportsV2RenderExplore = {
    renderExploreTab(...args) {

      const { exploreFilters, filterOptions, dashboardData, detailedData } = this.state;
      const activeChips = this.renderActiveFilterChips();

      return `
        <div class="rv2-explore">
          <div class="filter-card rv2-explore-filters">
            <div class="filter-header filter-header-plain"><h3>Filtreler</h3></div>
            <div class="filter-body">
              <div class="rv2-date-presets rv2-explore-presets">
                <button class="rv2-preset" data-ex-preset="0">Bu ay</button>
                <button class="rv2-preset" data-ex-preset="-1">Geçen ay</button>
                <button class="rv2-preset" data-ex-billable="true">Billable</button>
                <button class="rv2-preset" data-ex-billable="false">Non-Billable</button>
                <button class="rv2-preset" data-ex-billable="">Tümü</button>
              </div>

              ${activeChips}

              <div class="filter-row rv2-filter-grid">
                <div class="filter-group">
                  <label>Başlangıç</label>
                  <input type="date" id="start-date" value="${exploreFilters.startDate}" class="form-control">
                </div>
                <div class="filter-group">
                  <label>Bitiş</label>
                  <input type="date" id="end-date" value="${exploreFilters.endDate}" class="form-control">
                </div>
                <div class="filter-group">
                  <label>Kullanıcı</label>
                  <select id="user-filter" class="form-control">
                    <option value="">Tümü</option>
                    ${filterOptions.users.map((u) => `<option value="${u.id}" ${exploreFilters.userId == u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
                  </select>
                </div>
                <div class="filter-group">
                  <label>Client</label>
                  <select id="client-filter" class="form-control">
                    <option value="">Tümü</option>
                    ${filterOptions.clients.map((c) => `<option value="${c.id}" ${exploreFilters.clientId == c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                  </select>
                </div>
                <div class="filter-group">
                  <label>Proje</label>
                  <select id="project-filter" class="form-control">
                    <option value="">Tümü</option>
                    ${filterOptions.projects.map((p) => `<option value="${p.id}" ${exploreFilters.projectId == p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                  </select>
                </div>
                <div class="filter-group">
                  <label>Departman</label>
                  <select id="department-filter" class="form-control">
                    <option value="">Tümü</option>
                    ${filterOptions.departments.map((d) => `<option value="${d.id}" ${exploreFilters.departmentId == d.id ? 'selected' : ''}>${d.name}</option>`).join('')}
                  </select>
                </div>
                <div class="filter-group">
                  <label>Takım</label>
                  <select id="team-filter" class="form-control">
                    <option value="">Tümü</option>
                    ${filterOptions.teams.map((t) => `<option value="${t.id}" ${exploreFilters.teamId == t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
                  </select>
                </div>
                <div class="filter-group">
                  <label>Unvan</label>
                  <select id="title-filter" class="form-control">
                    <option value="">Tümü</option>
                    ${TITLE_OPTIONS.map((t) => `<option value="${t.id}" ${exploreFilters.titleId == t.id ? 'selected' : ''}>${t.label}</option>`).join('')}
                  </select>
                </div>
                <div class="filter-group">
                  <label>Billable</label>
                  <select id="billable-filter" class="form-control">
                    <option value="">Tümü</option>
                    <option value="true" ${exploreFilters.billable === 'true' ? 'selected' : ''}>Billable</option>
                    <option value="false" ${exploreFilters.billable === 'false' ? 'selected' : ''}>Non-Billable</option>
                  </select>
                </div>
              </div>
              <div class="filter-actions">
                <button id="clear-filters" class="btn btn-secondary">Temizle</button>
                <button id="apply-filters" class="btn btn-primary">Ara</button>
              </div>
            </div>
          </div>

          ${dashboardData ? this.renderExploreStats() : '<p class="rv2-empty">Filtreleri seçip Ara butonuna basın.</p>'}
          ${dashboardData ? this.renderExploreTables() : ''}
          ${this.state.exploreComputed?.lateEntries?.length ? this.renderLateEntries() : ''}
          ${detailedData?.entries ? this.renderDetailedEntries() : ''}
        </div>
      `;
    },

    renderActiveFilterChips(...args) {

      const { exploreFilters, filterOptions } = this.state;
      const chips = [];

      const findName = (list, id) => list.find((x) => String(x.id) === String(id))?.name;

      if (exploreFilters.userId) chips.push({ type: 'userId', label: findName(filterOptions.users, exploreFilters.userId) });
      if (exploreFilters.clientId) chips.push({ type: 'clientId', label: findName(filterOptions.clients, exploreFilters.clientId) });
      if (exploreFilters.projectId) chips.push({ type: 'projectId', label: findName(filterOptions.projects, exploreFilters.projectId) });
      if (exploreFilters.departmentId) chips.push({ type: 'departmentId', label: findName(filterOptions.departments, exploreFilters.departmentId) });
      if (exploreFilters.teamId) chips.push({ type: 'teamId', label: findName(filterOptions.teams, exploreFilters.teamId) });
      if (exploreFilters.titleId) {
        const titleLabel = TITLE_OPTIONS.find((t) => t.id === String(exploreFilters.titleId))?.label;
        if (titleLabel) chips.push({ type: 'titleId', label: titleLabel });
      }
      if (exploreFilters.billable === 'true') chips.push({ type: 'billable', label: 'Billable' });
      if (exploreFilters.billable === 'false') chips.push({ type: 'billable', label: 'Non-Billable' });

      if (!chips.length) return '';

      return `
        <div class="rv2-chips">
          ${chips.map((c) => `<span class="rv2-chip" data-chip="${c.type}">${c.label} ×</span>`).join('')}
        </div>
      `;
    },

    renderExploreStats(...args) {

      const { summary } = this.state.dashboardData;
      const exploreSummary = this.state.exploreSummary;
      if (!summary) return '';

      const billablePct =
        exploreSummary?.totalHours > 0
          ? Math.round((exploreSummary.billableHours / exploreSummary.totalHours) * 100)
          : null;

      return `
        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-card-top">
              <span class="stat-label">Toplam Saat</span>
              ${renderTrend(summary.totalHours, summary.previousPeriodTotalHours)}
            </div>
            <div class="stat-number">${formatMinutesReadable(summary.totalHours)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-top"><span class="stat-label">Billable Oranı</span></div>
            <div class="stat-number">${billablePct != null ? `%${billablePct}` : '—'}</div>
            ${billablePct != null ? renderProgressBar(billablePct) : ''}
          </div>
          <div class="stat-card">
            <div class="stat-card-top"><span class="stat-label">Kullanıcı</span></div>
            <div class="stat-number">${summary.uniqueUsers}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-top"><span class="stat-label">Client</span></div>
            <div class="stat-number">${summary.uniqueClients}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-top"><span class="stat-label">Kayıt</span></div>
            <div class="stat-number">${summary.totalEntries}</div>
          </div>
        </div>
      `;
    },

    renderExploreTables(...args) {

      const { dashboardData } = this.state;
      const computed = this.state.exploreComputed || {};
      return `
        <div class="tables-row">
          ${this.renderSummaryTable('Client', dashboardData.clientSummary, 'clientName', 'clientId', 'client')}
          ${this.renderSummaryTable('Kullanıcı', dashboardData.userSummary, 'userName', 'userId', 'user', true, true)}
          ${this.renderSummaryTable('Proje', computed.projectSummary, 'projectName', 'projectId', 'project')}
          ${this.renderSummaryTable('Departman', dashboardData.departmentSummary, 'departmentName', 'departmentId', 'department')}
          ${this.renderSummaryTable('Action Item', dashboardData.actionItemSummary, 'taskName', 'taskId', 'task')}
          ${this.renderSummaryTable('Takım', computed.teamSummary, 'teamName', 'teamId', 'team')}
        </div>
      `;
    },

    renderSummaryTable(
      title,
      rows,
      nameKey,
      idKey,
      filterType,
      withAvatar = false,
      withBillableRatio = false
    ) {

      if (!rows?.length) return '';
      const exportKey = filterType === 'task' ? 'task' : filterType === 'project' ? 'project' : filterType;
      const userRatios = this.state.exploreComputed?.userBillableRatios || {};

      return `
        <div class="table-card">
          <div class="table-header">
            <h4>${title}</h4>
            <button class="btn-download" data-export-type="${exportKey}">CSV</button>
          </div>
          <div class="table-body">
            <table class="data-table">
              <thead>
                <tr>
                  <th>${title}</th>
                  <th class="text-right">Saat</th>
                  ${withBillableRatio ? '<th class="text-center">B%</th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${rows.map((row) => {
                  const bPct = withBillableRatio
                    ? userRatios[row.userId] ?? null
                    : null;
                  return `
                  <tr>
                    <td class="clickable" data-filter-type="${filterType}" data-filter-id="${row[idKey]}">
                      ${withAvatar && row.userAvatar ? `<img src="${AVATAR_URL}/${row.userAvatar}" class="avatar" onerror="this.style.display='none'">` : ''}
                      ${row[nameKey]}
                      ${row.clientName ? `<br><small class="text-muted">${row.clientName}</small>` : ''}
                    </td>
                    <td class="text-right">${formatMinutesReadable(row.totalHours)}</td>
                    ${withBillableRatio ? `<td class="text-center">${bPct != null ? `%${bPct}` : '—'}</td>` : ''}
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    },

    renderLateEntries(...args) {

      const lateEntries = this.state.exploreComputed?.lateEntries || [];
      return `
        <div class="table-card table-card-full rv2-late-card">
          <div class="table-header">
            <h4>Geç Girilen Kayıtlar (${lateEntries.length})</h4>
            <span class="rv2-hint">>${LATE_ENTRY_DAYS} gün sonra girilen</span>
            <button class="btn-download" data-export-type="late">CSV</button>
          </div>
          <div class="table-body rv2-detailed-body">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Çalışılan</th><th>Girildi</th><th>Gecikme</th>
                  <th>Kullanıcı</th><th>Client</th><th>Proje</th><th class="text-right">Saat</th>
                </tr>
              </thead>
              <tbody>
                ${lateEntries.map((e) => {
                  const spent = new Date(e.spent_at || e.date);
                  const entered = new Date(e.enteredAt);
                  const delayDays = Math.floor((entered - spent) / 86400000);
                  return `
                  <tr>
                    <td>${spent.toLocaleDateString('tr-TR')}</td>
                    <td>${entered.toLocaleDateString('tr-TR')}</td>
                    <td class="rv2-warn">${delayDays} gün</td>
                    <td>${e.userName}</td>
                    <td>${e.clientName || '—'}</td>
                    <td>${e.projectName || '—'}</td>
                    <td class="text-right">${formatMinutesReadable(e.hours)}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    },

    renderDetailedEntries(...args) {

      const { detailedData } = this.state;
      const entries = detailedData?.entries || [];
      return `
        <div class="table-card table-card-full">
          <div class="table-header">
            <h4>Detaylı Kayıtlar (${entries.length})</h4>
            <button class="btn-download" data-export-type="detailed">CSV</button>
          </div>
          <div class="table-body rv2-detailed-body">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Tarih</th><th>Kullanıcı</th><th>Departman</th><th>Client</th><th>Proje</th>
                  <th>Not</th><th class="text-right">Saat</th><th class="text-center">Tip</th>
                </tr>
              </thead>
              <tbody>
                ${entries.map((e) => `
                  <tr>
                    <td>${new Date(e.date).toLocaleDateString('tr-TR')}</td>
                    <td>${e.userName}</td>
                    <td>${e.departmentName || '—'}</td>
                    <td class="clickable" data-filter-type="client" data-filter-id="${e.clientId}">${e.clientName || '—'}</td>
                    <td>${e.projectName || '—'}</td>
                    <td title="${(e.notes || '').replace(/"/g, '&quot;')}">${(e.notes || '—').substring(0, 40)}${(e.notes || '').length > 40 ? '…' : ''}</td>
                    <td class="text-right">${formatMinutesReadable(e.hours)}</td>
                    <td class="text-center"><span class="badge ${e.billable ? 'badge-success' : 'badge-secondary'}">${e.billable ? 'B' : 'NB'}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  };
})();
