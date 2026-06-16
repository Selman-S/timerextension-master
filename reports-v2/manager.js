// Reports V2 — core manager (state, init, lazy tab loading)
(() => {
  'use strict';

  const { REPORTS_V2_CONTAINER_ID, CRO_DEPARTMENT_ID } = window.ReportsV2Constants;
  const { getMonthRange } = window.ReportsV2Utils;

  const emptyCache = () => ({
    personal: { key: null, data: null },
    trends: { key: null, data: null },
    departments: { key: null, data: null },
    ranking: { key: null, data: null },
    brands: { key: null, data: null },
    explore: { key: null, data: null },
    userTrends: { key: null, data: null },
  });

  const ReportsV2Manager = {
    state: {
      loading: false,
      activeTab: 'personal',
      leaderboardFilters: getMonthRange(0),
      dataCache: emptyCache(),
      selectedTrendDeptId: null,
      selectedTrendUserId: null,
      selectedTrendBrandId: null,
      otherUserTrendPoints: null,
      brandsDeptId: CRO_DEPARTMENT_ID,
      teamsWithMembers: [],
      filterOptions: { users: [], clients: [], projects: [], departments: [], teams: [] },
      exploreFilters: {
        ...getMonthRange(0),
        userId: null,
        clientId: null,
        projectId: null,
        departmentId: null,
        teamId: null,
        titleId: null,
        billable: 'true',
      },
    },

    async init() {
      const onReportsPage = window.location.pathname.includes('/reports-new');
      if (!onReportsPage) {
        this.destroy();
        return;
      }
      if (document.getElementById(REPORTS_V2_CONTAINER_ID)) return;

      await this.waitForPageReady();
      this.createContainer();
      this.showLoadingState();
      try {
        await this.loadFilterOptions();
        await this.ensureTabData('personal');
      } catch (e) {
        console.error('Reports init error:', e);
      } finally {
        this.hideLoadingState();
      }
      this.render();
    },

    // Load tab data only if not cached
    async ensureTabData(tab) {
      const { leaderboardFilters, brandsDeptId, exploreFilters } = this.state;
      const fKey = this.cacheKey(leaderboardFilters);

      switch (tab) {
        case 'personal': {
          if (this.getCacheKey('personal') === fKey && this.getCached('personal')) return;
          const data = await this.loadPersonalData();
          this.setCached('personal', fKey, data);
          return;
        }
        case 'trends': {
          const key = 'trends|6m';
          if (this.getCacheKey('trends') === key && this.getCached('trends')) return;
          const data = await this.loadTrendsData();
          this.setCached('trends', key, data);
          return;
        }
        case 'departments': {
          if (this.getCacheKey('departments') === fKey && this.getCached('departments')) return;
          const data = await this.loadDepartmentsData();
          this.setCached('departments', fKey, data);
          return;
        }
        case 'ranking': {
          if (this.getCacheKey('ranking') === fKey && this.getCached('ranking')) return;
          const data = await this.loadRankingData();
          this.setCached('ranking', fKey, data);
          return;
        }
        case 'brands': {
          const bKey = this.cacheKey(leaderboardFilters, `dept:${brandsDeptId}`);
          if (this.getCacheKey('brands') === bKey && this.getCached('brands')) return;
          const data = await this.loadBrandsData();
          this.setCached('brands', bKey, data);
          return;
        }
        case 'explore': {
          const eKey = this.cacheKey(exploreFilters, JSON.stringify({
            userId: exploreFilters.userId,
            clientId: exploreFilters.clientId,
            projectId: exploreFilters.projectId,
            departmentId: exploreFilters.departmentId,
            teamId: exploreFilters.teamId,
            titleId: exploreFilters.titleId,
            billable: exploreFilters.billable,
          }));
          if (this.getCacheKey('explore') === eKey && this.getCached('explore')) {
            const cached = this.getCached('explore');
            this.state.dashboardData = cached.dashboardData;
            this.state.detailedData = cached.detailedData;
            this.state.exploreSummary = cached.exploreSummary;
            this.state.exploreComputed = cached.exploreComputed;
            return;
          }
          const data = await this.loadExploreData();
          this.state.dashboardData = data.dashboardData;
          this.state.detailedData = data.detailedData;
          this.state.exploreSummary = data.exploreSummary;
          this.state.exploreComputed = data.exploreComputed;
          this.setCached('explore', eKey, data);
          return;
        }
        default:
          return;
      }
    },

    async switchTab(tab) {
      if (tab === this.state.activeTab) return;
      this.state.activeTab = tab;
      this.showLoadingState();
      try {
        await this.ensureTabData(tab);
      } catch (e) {
        console.error('Tab load error:', e);
      } finally {
        this.hideLoadingState();
      }
      this.render();
    },

    async reloadActiveTab() {
      const tab = this.state.activeTab;
      if (tab === 'personal' || tab === 'departments' || tab === 'ranking' || tab === 'brands') {
        this.invalidateDateCaches();
        this.clearCacheBucket('userTrends');
      } else if (tab === 'brands') {
        this.clearCacheBucket('brands');
      } else if (tab === 'explore') {
        this.clearCacheBucket('explore');
      }
      this.state.otherUserTrendPoints = null;
      this.state.selectedTrendDeptId = null;
      this.state.selectedTrendBrandId = null;
      this.showLoadingState();
      try {
        await this.ensureTabData(tab);
      } finally {
        this.hideLoadingState();
      }
      this.render();
    },

    destroy() {
      window.ReportsV2Charts?.destroyAll();
      document.getElementById(REPORTS_V2_CONTAINER_ID)?.remove();
    },

    waitForPageReady() {
      return new Promise((resolve) => {
        if (document.body) resolve();
        else window.addEventListener('DOMContentLoaded', resolve);
      });
    },

    createContainer() {
      const container = document.createElement('div');
      container.id = REPORTS_V2_CONTAINER_ID;
      container.className = 'reports-v2-extension';
      document.body.appendChild(container);
    },
  };

  Object.assign(
    ReportsV2Manager,
    window.ReportsV2Cache,
    window.ReportsV2Compute,
    window.ReportsV2Data,
    window.ReportsV2RenderShell,
    window.ReportsV2RenderLeaderboard,
    window.ReportsV2RenderBrands,
    window.ReportsV2RenderExplore,
    window.ReportsV2Events,
    window.ReportsV2Export
  );

  window.ReportsV2Manager = ReportsV2Manager;
})();
