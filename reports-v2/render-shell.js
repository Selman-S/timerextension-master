// Reports V2 — shell UI
(() => {
  'use strict';

  const { REPORTS_V2_CONTAINER_ID } = window.ReportsV2Constants;
  const { getMonthRange } = window.ReportsV2Utils;

  const isSameDateRange = (a, b) =>
    a?.startDate === b?.startDate && a?.endDate === b?.endDate;

  window.ReportsV2RenderShell = {
    render() {
      const container = document.getElementById(REPORTS_V2_CONTAINER_ID);
      if (!container) return;

      window.ReportsV2Charts?.beginRender();

      container.innerHTML = `
        <div class="reports-v2-wrapper">
          ${this.renderHeader()}
          ${this.renderTabs()}
          ${this.renderGlobalToolbar()}
          <div class="rv2-tab-content">
            ${this.renderTabContent()}
          </div>
        </div>
      `;

      this.attachEventListeners();
      window.ReportsV2Charts?.mountAll();
    },

    renderHeader() {
      return `
        <header class="reports-header">
          <button type="button" id="rv2-back" class="rv2-back-btn" title="Dashboard'a dön">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Dashboard
          </button>
          <div class="reports-header-text">
            <h1 class="reports-title">Reports</h1>
            <p class="reports-subtitle">Liderlik, marka limitleri ve detaylı arama</p>
          </div>
        </header>
      `;
    },

    renderTabs() {
      const { activeTab } = this.state;
      const tabs = [
        { id: 'personal', label: 'Senin Özetin' },
        { id: 'trends', label: 'Genel Trend' },
        { id: 'departments', label: 'Departmanlar' },
        { id: 'ranking', label: 'Liderlik' },
        { id: 'brands', label: 'Marka / Limit' },
        { id: 'explore', label: 'Detaylı Arama' },
      ];
      return `
        <nav class="rv2-tabs">
          ${tabs
            .map(
              (t) =>
                `<button class="rv2-tab ${activeTab === t.id ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>`
            )
            .join('')}
        </nav>
      `;
    },

    // Shared date toolbar for leaderboard + brands tabs
    renderGlobalToolbar() {
      if (this.state.activeTab === 'explore') return '';
      const { leaderboardFilters } = this.state;
      const thisMonth = getMonthRange(0);
      const lastMonth = getMonthRange(-1);
      const isThisMonth = isSameDateRange(leaderboardFilters, thisMonth);
      const isLastMonth = isSameDateRange(leaderboardFilters, lastMonth);

      return `
        <div class="rv2-toolbar">
          <div class="rv2-toolbar-inner">
            <span class="rv2-toolbar-label">Dönem</span>
            <div class="rv2-preset-group" role="group" aria-label="Hızlı dönem seçimi">
              <button type="button" class="rv2-preset ${isThisMonth ? 'active' : ''}" data-lb-preset="0">Bu ay</button>
              <button type="button" class="rv2-preset ${isLastMonth ? 'active' : ''}" data-lb-preset="-1">Geçen ay</button>
            </div>
            <span class="rv2-toolbar-divider" aria-hidden="true"></span>
            <div class="rv2-date-range">
              <input type="date" id="lb-start" value="${leaderboardFilters.startDate}" class="form-control rv2-date-input" aria-label="Başlangıç">
              <span class="rv2-date-sep">→</span>
              <input type="date" id="lb-end" value="${leaderboardFilters.endDate}" class="form-control rv2-date-input" aria-label="Bitiş">
              <button type="button" id="lb-apply" class="btn btn-primary rv2-apply-btn">Uygula</button>
            </div>
          </div>
        </div>
      `;
    },

    renderTabContent() {
      switch (this.state.activeTab) {
        case 'personal':
          return this.renderPersonalTab();
        case 'trends':
          return this.renderTrendsTab();
        case 'departments':
          return this.renderDepartmentsTab();
        case 'ranking':
          return this.renderRankingTab();
        case 'brands':
          return this.renderBrandsTab();
        case 'explore':
          return this.renderExploreTab();
        default:
          return this.renderPersonalTab();
      }
    },

    showLoadingState() {
      const container = document.getElementById(REPORTS_V2_CONTAINER_ID);
      if (!container || container.querySelector('.loading-overlay')) return;
      const overlay = document.createElement('div');
      overlay.className = 'loading-overlay';
      overlay.innerHTML = '<div class="loading-spinner-large"></div><p>Yükleniyor…</p>';
      container.appendChild(overlay);
    },

    hideLoadingState() {
      document.querySelector('.loading-overlay')?.remove();
    },
  };
})();
