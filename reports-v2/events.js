// Reports V2 — event handlers
(() => {
  'use strict';

  const { CRO_DEPARTMENT_ID } = window.ReportsV2Constants;
  const { getMonthRange } = window.ReportsV2Utils;

  window.ReportsV2Events = {
    attachEventListeners() {
      document.getElementById('rv2-back')?.addEventListener('click', () => {
        this.destroy();
        window.location.href = '/dashboard';
      });

      document.querySelectorAll('.rv2-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.switchTab(btn.dataset.tab);
        });
      });

      document.getElementById('lb-apply')?.addEventListener('click', async () => {
        this.state.leaderboardFilters = {
          startDate: document.getElementById('lb-start')?.value,
          endDate: document.getElementById('lb-end')?.value,
        };
        await this.reloadActiveTab();
      });

      document.querySelectorAll('[data-lb-preset]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const offset = Number(btn.dataset.lbPreset);
          this.state.leaderboardFilters = getMonthRange(offset);
          await this.reloadActiveTab();
        });
      });

      document.querySelectorAll('.rv2-dept-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.state.selectedTrendDeptId = btn.dataset.deptId;
          this.render();
        });
      });

      document.querySelectorAll('.rv2-brand-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (this.state.activeTab === 'personal') {
            this.updatePersonalBrandTrend(btn.dataset.brandId);
            return;
          }
          this.state.selectedTrendBrandId = btn.dataset.brandId;
          this.render();
        });
      });

      document.querySelectorAll('.rv2-user-row').forEach((row) => {
        const userId = row.dataset.userId;
        const myId = this.getCached('personal')?.personal?.userId;
        row.addEventListener('click', async () => {
          if (myId && String(userId) === String(myId)) return;
          this.state.selectedTrendUserId = userId;
          this.showLoadingState();
          try {
            this.state.otherUserTrendPoints = await this.loadUserMonthlyTrend(userId);
          } finally {
            this.hideLoadingState();
          }
          this.render();
          document.getElementById('rv2-user-trend-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      });

      document.getElementById('rv2-user-trend-close')?.addEventListener('click', () => {
        const myId = this.getCached('personal')?.personal?.userId;
        this.state.selectedTrendUserId = myId || null;
        this.state.otherUserTrendPoints = null;
        this.render();
      });

      document.getElementById('brands-refresh')?.addEventListener('click', async () => {
        this.state.brandsDeptId = Number(document.getElementById('brands-dept')?.value) || CRO_DEPARTMENT_ID;
        this.clearCacheBucket('brands');
        this.showLoadingState();
        try {
          await this.ensureTabData('brands');
        } finally {
          this.hideLoadingState();
        }
        this.render();
      });

      document.getElementById('brands-dept')?.addEventListener('change', async () => {
        this.state.brandsDeptId = Number(document.getElementById('brands-dept')?.value) || CRO_DEPARTMENT_ID;
        this.clearCacheBucket('brands');
        this.showLoadingState();
        try {
          await this.ensureTabData('brands');
        } finally {
          this.hideLoadingState();
        }
        this.render();
      });

      document.querySelectorAll('.rv2-limit-input').forEach((input) => {
        const save = async () => {
          this.setManualLimit(input.dataset.projectId, input.value);
          this.clearCacheBucket('brands');
          await this.ensureTabData('brands');
          this.render();
        };
        input.addEventListener('change', save);
        input.addEventListener('blur', save);
      });

      document.getElementById('apply-filters')?.addEventListener('click', async () => {
        this.updateExploreFilters();
        this.clearCacheBucket('explore');
        this.showLoadingState();
        try {
          await this.ensureTabData('explore');
        } finally {
          this.hideLoadingState();
        }
        this.render();
      });

      document.getElementById('clear-filters')?.addEventListener('click', async () => {
        this.state.exploreFilters = {
          ...getMonthRange(0),
          userId: null,
          clientId: null,
          projectId: null,
          departmentId: null,
          teamId: null,
          titleId: null,
          billable: 'true',
        };
        this.clearCacheBucket('explore');
        this.showLoadingState();
        try {
          await this.ensureTabData('explore');
        } finally {
          this.hideLoadingState();
        }
        this.render();
      });

      document.querySelectorAll('[data-ex-preset]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const offset = Number(btn.dataset.exPreset);
          this.state.exploreFilters = { ...this.state.exploreFilters, ...getMonthRange(offset) };
          this.clearCacheBucket('explore');
          this.showLoadingState();
          try {
            await this.ensureTabData('explore');
          } finally {
            this.hideLoadingState();
          }
          this.render();
        });
      });

      document.querySelectorAll('[data-ex-billable]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const val = btn.dataset.exBillable;
          this.state.exploreFilters.billable = val === '' ? null : val;
          this.clearCacheBucket('explore');
          this.showLoadingState();
          try {
            await this.ensureTabData('explore');
          } finally {
            this.hideLoadingState();
          }
          this.render();
        });
      });

      document.querySelectorAll('.rv2-chip').forEach((chip) => {
        chip.addEventListener('click', async () => {
          const type = chip.dataset.chip;
          if (type === 'billable') this.state.exploreFilters.billable = null;
          else this.state.exploreFilters[type] = null;
          this.clearCacheBucket('explore');
          this.showLoadingState();
          try {
            await this.ensureTabData('explore');
          } finally {
            this.hideLoadingState();
          }
          this.render();
        });
      });

      document.querySelectorAll('.clickable[data-filter-type]').forEach((el) => {
        el.addEventListener('click', async () => {
          const type = el.dataset.filterType;
          const id = el.dataset.filterId;
          const map = {
            client: 'clientId',
            user: 'userId',
            department: 'departmentId',
            team: 'teamId',
            project: 'projectId',
          };
          if (map[type]) {
            this.state.exploreFilters[map[type]] = id;
            this.clearCacheBucket('explore');
            this.showLoadingState();
            try {
              await this.ensureTabData('explore');
            } finally {
              this.hideLoadingState();
            }
            this.render();
          }
        });
      });

      document.querySelectorAll('.btn-download[data-export-type]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.exportCSV(btn.getAttribute('data-export-type'));
        });
      });
    },

    updateExploreFilters() {
      const g = (id) => document.getElementById(id)?.value || null;
      this.state.exploreFilters = {
        startDate: g('start-date') || this.state.exploreFilters.startDate,
        endDate: g('end-date') || this.state.exploreFilters.endDate,
        userId: g('user-filter') || null,
        clientId: g('client-filter') || null,
        projectId: g('project-filter') || null,
        departmentId: g('department-filter') || null,
        teamId: g('team-filter') || null,
        titleId: g('title-filter') || null,
        billable: g('billable-filter') || null,
      };
    },
  };
})();
