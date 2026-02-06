// ReportsV2 Extension - Vanilla JS implementation
// Reports Dashboard integration for Chrome Extension

(() => {
  'use strict';

  const REPORTS_V2_CONTAINER_ID = 'hyperactive-reports-v2-container';
  const BASE_URL = 'https://hyperactive.pro/api';
  const AVATAR_URL = 'https://hyperactive.pro/cdn/avatar';

  // Utility functions
  const getAuthToken = () => localStorage.getItem('user');

  const fetchAPI = async (endpoint, options = {}) => {
    const token = getAuthToken();
    const url = `${BASE_URL}${endpoint}`;
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, defaultOptions);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  };

  // Convert minutes to hours format (H:MM)
  const convertMinutesToHours = (minutes) => {
    if (!minutes || minutes === 0) return '0:00';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  // Convert minutes to decimal hours (for CSV)
  const convertMinutesToDecimalHours = (minutes) => {
    if (!minutes || minutes === 0) return 0;
    return (minutes / 60).toFixed(2);
  };

  // Format date
  const formatDate = (date) => {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };

  // Get start/end of month
  const getMonthRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      startDate: formatDate(start),
      endDate: formatDate(end),
    };
  };

  // ReportsV2 Manager
  const ReportsV2Manager = {
    state: {
      loading: false,
      dashboardData: null,
      detailedData: null,
      filterOptions: {
        users: [],
        clients: [],
        projects: [],
        departments: [],
        teams: [],
      },
      filters: {
        ...getMonthRange(),
        userId: null,
        clientId: null,
        projectId: null,
        departmentId: null,
        teamId: null,
        billable: null,
      },
      sortConfig: {},
    },

    // Initialize ReportsV2
    async init() {
      const currentURL = window.location.href;
      const isReportsV2Page = currentURL.includes('/reports-new');

      if (!isReportsV2Page) return;

      // Check if container already exists
      if (document.getElementById(REPORTS_V2_CONTAINER_ID)) {
        return;
      }

      // Wait for page to load
      await this.waitForPageReady();

      // Create container
      this.createContainer();

      // Load filter options
      await this.loadFilterOptions();

      // Load dashboard data
      await this.loadDashboardData();
      await this.loadDetailedData();

      // Render UI
      this.render();
    },

    // Wait for page to be ready
    waitForPageReady() {
      return new Promise((resolve) => {
        if (document.body) {
          resolve();
        } else {
          window.addEventListener('DOMContentLoaded', resolve);
        }
      });
    },

    // Create container
    createContainer() {
      const container = document.createElement('div');
      container.id = REPORTS_V2_CONTAINER_ID;
      container.className = 'reports-v2-extension';
      container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: white;
        z-index: 99999;
        overflow-y: auto;
        padding: 20px;
      `;

      document.body.appendChild(container);
    },

    // Load filter options
    async loadFilterOptions() {
      try {
        const response = await fetchAPI('/reports/filter-options');
        if (response.success) {
          this.state.filterOptions = response.data;
        }
      } catch (error) {
        console.error('Filter options loading error:', error);
      }
    },

    // Load dashboard data
    async loadDashboardData() {
      this.state.loading = true;
      try {
        const queryParams = new URLSearchParams();
        Object.entries(this.state.filters).forEach(([key, value]) => {
          if (value !== null && value !== '') {
            queryParams.append(key, value);
          }
        });

        const response = await fetchAPI(`/reports/dashboard?${queryParams.toString()}`);
        if (response.success) {
          this.state.dashboardData = response.data;
        }
      } catch (error) {
        console.error('Dashboard data loading error:', error);
      } finally {
        this.state.loading = false;
      }
    },

    // Load detailed data
    async loadDetailedData() {
      try {
        const queryParams = new URLSearchParams();
        Object.entries(this.state.filters).forEach(([key, value]) => {
          if (value !== null && value !== '') {
            queryParams.append(key, value);
          }
        });
        queryParams.append('limit', '20');

        const response = await fetchAPI(`/reports/detailed?${queryParams.toString()}`);
        if (response.success) {
          this.state.detailedData = response.data;
        }
      } catch (error) {
        console.error('Detailed data loading error:', error);
      }
    },

    // Render UI
    render() {
      const container = document.getElementById(REPORTS_V2_CONTAINER_ID);
      if (!container) return;

      container.innerHTML = `
        <div class="reports-v2-wrapper">
          ${this.renderHeader()}
          ${this.renderFilters()}
          ${this.renderStats()}
          ${this.renderTables()}
          ${this.renderCharts()}
        </div>
      `;

      // Attach event listeners
      this.attachEventListeners();
    },

    // Render header
    renderHeader() {
      const { filters, dashboardData } = this.state;
      return `
        <div class="reports-header">
          <div>
            <h1 class="reports-title">📊 Reports Dashboard</h1>
            <p class="reports-subtitle">Interactive reports in Google Data Studio style</p>
          </div>
          <div class="reports-badges">
            <span class="badge badge-primary">
              📅 ${filters.startDate} - ${filters.endDate}
            </span>
            ${dashboardData?.summary ? `
              <span class="badge badge-success">
                ⏱ ${convertMinutesToHours(dashboardData.summary.totalHours)} hours
              </span>
            ` : ''}
          </div>
        </div>
      `;
    },

    // Render filters
    renderFilters() {
      const { filters, filterOptions } = this.state;
      return `
        <div class="filter-card">
          <div class="filter-header">
            <h3>🔍 Filters</h3>
          </div>
          <div class="filter-body">
            <div class="filter-row">
              <div class="filter-group">
                <label>Date Range</label>
                <input type="date" id="start-date" value="${filters.startDate}" class="form-control">
                <input type="date" id="end-date" value="${filters.endDate}" class="form-control">
              </div>
              <div class="filter-group">
                <label>User</label>
                <select id="user-filter" class="form-control">
                  <option value="">All</option>
                  ${filterOptions.users.map(u => `
                    <option value="${u.id}" ${filters.userId == u.id ? 'selected' : ''}>${u.name}</option>
                  `).join('')}
                </select>
              </div>
              <div class="filter-group">
                <label>Client</label>
                <select id="client-filter" class="form-control">
                  <option value="">All</option>
                  ${filterOptions.clients.map(c => `
                    <option value="${c.id}" ${filters.clientId == c.id ? 'selected' : ''}>${c.name}</option>
                  `).join('')}
                </select>
              </div>
              <div class="filter-group">
                <label>Project</label>
                <select id="project-filter" class="form-control">
                  <option value="">All</option>
                  ${filterOptions.projects.map(p => `
                    <option value="${p.id}" ${filters.projectId == p.id ? 'selected' : ''}>${p.name}</option>
                  `).join('')}
                </select>
              </div>
              <div class="filter-group">
                <label>Department</label>
                <select id="department-filter" class="form-control">
                  <option value="">All</option>
                  ${filterOptions.departments.map(d => `
                    <option value="${d.id}" ${filters.departmentId == d.id ? 'selected' : ''}>${d.name}</option>
                  `).join('')}
                </select>
              </div>
              <div class="filter-group">
                <label>Team</label>
                <select id="team-filter" class="form-control">
                  <option value="">All</option>
                  ${filterOptions.teams.map(t => `
                    <option value="${t.id}" ${filters.teamId == t.id ? 'selected' : ''}>${t.name}</option>
                  `).join('')}
                </select>
              </div>
              <div class="filter-group">
                <label>Billable</label>
                <select id="billable-filter" class="form-control">
                  <option value="">All</option>
                  <option value="true" ${filters.billable === 'true' ? 'selected' : ''}>Billable</option>
                  <option value="false" ${filters.billable === 'false' ? 'selected' : ''}>Non-Billable</option>
                </select>
              </div>
            </div>
            <div class="filter-actions">
              <button id="apply-filters" class="btn btn-primary">Apply Filters</button>
              <button id="clear-filters" class="btn btn-secondary">Clear</button>
            </div>
          </div>
        </div>
      `;
    },

    // Render stats cards
    renderStats() {
      const { dashboardData } = this.state;
      if (!dashboardData?.summary) return '';

      const { summary } = dashboardData;
      return `
        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-icon">⏱</div>
            <div class="stat-number">${convertMinutesToHours(summary.totalHours)}</div>
            <div class="stat-label">Total Hours</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">👥</div>
            <div class="stat-number">${summary.uniqueUsers}</div>
            <div class="stat-label">Active Users</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🏢</div>
            <div class="stat-number">${summary.uniqueClients}</div>
            <div class="stat-label">Client Count</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${summary.totalEntries}</div>
            <div class="stat-label">Total Entries</div>
          </div>
        </div>
      `;
    },

    // Render tables
    renderTables() {
      const { dashboardData, detailedData } = this.state;
      if (!dashboardData) return '';

      return `
        <div class="tables-row">
          ${this.renderClientSummary()}
          ${this.renderUserSummary()}
          ${this.renderActionItemSummary()}
          ${this.renderDepartmentSummary()}
          ${this.renderTeamSummary()}
          ${this.renderDailyBreakdown()}
          ${this.renderDetailedEntries()}
        </div>
      `;
    },

    // Render client summary table
    renderClientSummary() {
      const { dashboardData } = this.state;
      if (!dashboardData?.clientSummary) return '';

      return `
        <div class="table-card">
          <div class="table-header">
            <h4>Client - Hours</h4>
            <button class="btn-download" onclick="ReportsV2Manager.exportCSV('client')">📥</button>
          </div>
          <div class="table-body">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th class="text-right">Hours</th>
                </tr>
              </thead>
              <tbody>
                ${dashboardData.clientSummary.map(client => `
                  <tr>
                    <td class="clickable" onclick="ReportsV2Manager.filterByClient(${client.clientId})">
                      ${client.clientName}
                    </td>
                    <td class="text-right">${convertMinutesToHours(client.totalHours)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    },

    // Render user summary table
    renderUserSummary() {
      const { dashboardData } = this.state;
      if (!dashboardData?.userSummary) return '';

      return `
        <div class="table-card">
          <div class="table-header">
            <h4>User - Hours</h4>
            <button class="btn-download" onclick="ReportsV2Manager.exportCSV('user')">📥</button>
          </div>
          <div class="table-body">
            <table class="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th class="text-right">Hours</th>
                </tr>
              </thead>
              <tbody>
                ${dashboardData.userSummary.map(user => `
                  <tr>
                    <td class="clickable" onclick="ReportsV2Manager.filterByUser(${user.userId})">
                      <img src="${AVATAR_URL}/${user.userAvatar}" class="avatar" onerror="this.style.display='none'">
                      ${user.userName}
                    </td>
                    <td class="text-right">${convertMinutesToHours(user.totalHours)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    },

    // Render action item summary table
    renderActionItemSummary() {
      const { dashboardData } = this.state;
      if (!dashboardData?.actionItemSummary) return '';

      return `
        <div class="table-card">
          <div class="table-header">
            <h4>Action Item - Hours</h4>
            <button class="btn-download" onclick="ReportsV2Manager.exportCSV('task')">📥</button>
          </div>
          <div class="table-body">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Action Item</th>
                  <th class="text-right">Hours</th>
                  <th class="text-center">Type</th>
                </tr>
              </thead>
              <tbody>
                ${dashboardData.actionItemSummary.map(task => `
                  <tr>
                    <td>${task.taskName}</td>
                    <td class="text-right">${convertMinutesToHours(task.totalHours)}</td>
                    <td class="text-center">
                      <span class="badge ${task.billable ? 'badge-success' : 'badge-secondary'}">
                        ${task.billable ? 'Billable' : 'Non-Billable'}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    },

    // Render department summary table
    renderDepartmentSummary() {
      const { dashboardData } = this.state;
      if (!dashboardData?.departmentSummary) return '';

      return `
        <div class="table-card">
          <div class="table-header">
            <h4>Department - Hours</h4>
            <button class="btn-download" onclick="ReportsV2Manager.exportCSV('department')">📥</button>
          </div>
          <div class="table-body">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th class="text-right">Hours</th>
                </tr>
              </thead>
              <tbody>
                ${dashboardData.departmentSummary.map(dept => `
                  <tr>
                    <td class="clickable" onclick="ReportsV2Manager.filterByDepartment(${dept.departmentId})">
                      ${dept.departmentName}
                    </td>
                    <td class="text-right">${convertMinutesToHours(dept.totalHours)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    },

    // Render team summary table
    renderTeamSummary() {
      const { dashboardData } = this.state;
      if (!dashboardData?.teamSummary) return '';

      return `
        <div class="table-card">
          <div class="table-header">
            <h4>Team - Hours</h4>
            <button class="btn-download" onclick="ReportsV2Manager.exportCSV('team')">📥</button>
          </div>
          <div class="table-body">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th class="text-right">Hours</th>
                </tr>
              </thead>
              <tbody>
                ${dashboardData.teamSummary.map(team => `
                  <tr>
                    <td class="clickable" onclick="ReportsV2Manager.filterByTeam(${team.teamId})">
                      ${team.teamName}
                    </td>
                    <td class="text-right">${convertMinutesToHours(team.totalHours)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    },

    // Render daily breakdown table
    renderDailyBreakdown() {
      const { dashboardData } = this.state;
      if (!dashboardData?.dailyBreakdown) return '';

      return `
        <div class="table-card">
          <div class="table-header">
            <h4>Date - Hours</h4>
          </div>
          <div class="table-body">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th class="text-right">Hours</th>
                </tr>
              </thead>
              <tbody>
                ${dashboardData.dailyBreakdown.map(day => `
                  <tr>
                    <td>${new Date(day.date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td class="text-right">${convertMinutesToHours(day.totalHours)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    },

    // Render detailed entries table
    renderDetailedEntries() {
      const { detailedData } = this.state;
      if (!detailedData?.entries) return '';

      return `
        <div class="table-card table-card-full">
          <div class="table-header">
            <h4>Note - User - Hours</h4>
            <button class="btn-download" onclick="ReportsV2Manager.exportCSV('detailed')">📥</button>
          </div>
          <div class="table-body">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Note</th>
                  <th>User</th>
                  <th>Department</th>
                  <th>Client</th>
                  <th>Project</th>
                  <th class="text-right">Hours</th>
                  <th class="text-center">Billable</th>
                  <th class="text-center">Date</th>
                </tr>
              </thead>
              <tbody>
                ${detailedData.entries.map(entry => `
                  <tr>
                    <td title="${entry.notes || ''}">${(entry.notes || 'No note').substring(0, 50)}${entry.notes?.length > 50 ? '...' : ''}</td>
                    <td>${entry.userName}</td>
                    <td>${entry.departmentName || '-'}</td>
                    <td>${entry.clientName || '-'}</td>
                    <td>${entry.projectName || '-'}</td>
                    <td class="text-right">${convertMinutesToHours(entry.hours)}</td>
                    <td class="text-center">
                      <span class="badge ${entry.billable ? 'badge-success' : 'badge-secondary'}">
                        ${entry.billable ? 'Billable' : 'Non-Billable'}
                      </span>
                    </td>
                    <td class="text-center">${new Date(entry.date).toLocaleDateString('tr-TR')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    },

    // Render charts
    renderCharts() {
      const { dashboardData } = this.state;
      if (!dashboardData) return '';

      return `
        <div class="charts-row">
          ${this.renderDailyChart()}
          ${this.renderDepartmentPieChart()}
        </div>
      `;
    },

    // Render daily chart
    renderDailyChart() {
      const { dashboardData } = this.state;
      if (!dashboardData?.dailyBreakdown) return '';

      const chartData = dashboardData.dailyBreakdown
        .map(day => ({
          date: new Date(day.date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }),
          hours: Number((day.totalHours / 60).toFixed(2)),
          sortDate: new Date(day.date),
        }))
        .sort((a, b) => a.sortDate - b.sortDate);

      const canvasId = 'daily-chart-canvas';
      setTimeout(() => {
        this.renderBarChart(canvasId, chartData);
      }, 100);

      return `
        <div class="chart-card">
          <div class="chart-header">
            <h4>📈 Daily Hours Chart</h4>
          </div>
          <div class="chart-body">
            <canvas id="${canvasId}" width="800" height="350"></canvas>
          </div>
        </div>
      `;
    },

    // Render department pie chart
    renderDepartmentPieChart() {
      const { dashboardData } = this.state;
      if (!dashboardData?.departmentSummary) return '';

      const chartData = dashboardData.departmentSummary.map(dept => ({
        name: dept.departmentName,
        value: Number((dept.totalHours / 60).toFixed(2)),
      }));

      const canvasId = 'department-pie-canvas';
      setTimeout(() => {
        this.renderPieChart(canvasId, chartData);
      }, 100);

      return `
        <div class="chart-card">
          <div class="chart-header">
            <h4>🥧 Department Distribution</h4>
          </div>
          <div class="chart-body">
            <canvas id="${canvasId}" width="400" height="350"></canvas>
          </div>
        </div>
      `;
    },

    // Render bar chart using Chart.js
    renderBarChart(canvasId, data) {
      const canvas = document.getElementById(canvasId);
      if (!canvas || typeof Chart === 'undefined') return;

      const ctx = canvas.getContext('2d');
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.map(d => d.date),
          datasets: [{
            label: 'Hours',
            data: data.map(d => d.hours),
            backgroundColor: 'rgba(102, 126, 234, 0.8)',
            borderColor: 'rgba(102, 126, 234, 1)',
            borderWidth: 1,
          }],
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Hours',
              },
            },
          },
        },
      });
    },

    // Render pie chart using Chart.js
    renderPieChart(canvasId, data) {
      const canvas = document.getElementById(canvasId);
      if (!canvas || typeof Chart === 'undefined') return;

      const ctx = canvas.getContext('2d');
      const colors = [
        '#8884d8', '#82ca9d', '#ffc658', '#ff7300',
        '#00ff00', '#ff6384', '#36a2eb', '#ffce56',
        '#4bc0c0', '#9966ff',
      ];

      new Chart(ctx, {
        type: 'pie',
        data: {
          labels: data.map(d => d.name),
          datasets: [{
            data: data.map(d => d.value),
            backgroundColor: colors.slice(0, data.length),
          }],
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'bottom',
            },
          },
        },
      });
    },

    // Attach event listeners
    attachEventListeners() {
      // Apply filters button
      const applyBtn = document.getElementById('apply-filters');
      if (applyBtn) {
        applyBtn.addEventListener('click', () => {
          this.updateFilters();
          this.loadDashboardData();
          this.loadDetailedData();
          setTimeout(() => this.render(), 500);
        });
      }

      // Clear filters button
      const clearBtn = document.getElementById('clear-filters');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          this.state.filters = {
            ...getMonthRange(),
            userId: null,
            clientId: null,
            projectId: null,
            departmentId: null,
            teamId: null,
            billable: null,
          };
          this.loadDashboardData();
          this.loadDetailedData();
          setTimeout(() => this.render(), 500);
        });
      }
    },

    // Update filters from form
    updateFilters() {
      this.state.filters = {
        startDate: document.getElementById('start-date')?.value || this.state.filters.startDate,
        endDate: document.getElementById('end-date')?.value || this.state.filters.endDate,
        userId: document.getElementById('user-filter')?.value || null,
        clientId: document.getElementById('client-filter')?.value || null,
        projectId: document.getElementById('project-filter')?.value || null,
        departmentId: document.getElementById('department-filter')?.value || null,
        teamId: document.getElementById('team-filter')?.value || null,
        billable: document.getElementById('billable-filter')?.value || null,
      };
    },

    // Filter by client
    filterByClient(clientId) {
      this.state.filters.clientId = clientId;
      this.loadDashboardData();
      this.loadDetailedData();
      setTimeout(() => this.render(), 500);
    },

    // Filter by user
    filterByUser(userId) {
      this.state.filters.userId = userId;
      this.loadDashboardData();
      this.loadDetailedData();
      setTimeout(() => this.render(), 500);
    },

    // Filter by department
    filterByDepartment(departmentId) {
      this.state.filters.departmentId = departmentId;
      this.loadDashboardData();
      this.loadDetailedData();
      setTimeout(() => this.render(), 500);
    },

    // Filter by team
    filterByTeam(teamId) {
      this.state.filters.teamId = teamId;
      this.loadDashboardData();
      this.loadDetailedData();
      setTimeout(() => this.render(), 500);
    },

    // Export CSV
    exportCSV(type) {
      const { dashboardData, detailedData, filters } = this.state;
      let csvData = [];
      let filename = '';

      switch (type) {
        case 'client':
          csvData = dashboardData?.clientSummary?.map(c => ({
            Client: c.clientName,
            'Total Hours': convertMinutesToDecimalHours(c.totalHours),
            'User Count': c.userCount,
            'Entry Count': c.entryCount,
          })) || [];
          filename = `client-report-${filters.startDate}-${filters.endDate}.csv`;
          break;
        case 'user':
          csvData = dashboardData?.userSummary?.map(u => ({
            User: u.userName,
            'Total Hours': convertMinutesToDecimalHours(u.totalHours),
            'Entry Count': u.entryCount,
          })) || [];
          filename = `user-report-${filters.startDate}-${filters.endDate}.csv`;
          break;
        case 'task':
          csvData = dashboardData?.actionItemSummary?.map(t => ({
            'Action Item': t.taskName,
            'Total Hours': convertMinutesToDecimalHours(t.totalHours),
            Type: t.billable ? 'Billable' : 'Non-Billable',
          })) || [];
          filename = `action-item-report-${filters.startDate}-${filters.endDate}.csv`;
          break;
        case 'department':
          csvData = dashboardData?.departmentSummary?.map(d => ({
            Department: d.departmentName,
            'Total Hours': convertMinutesToDecimalHours(d.totalHours),
          })) || [];
          filename = `department-report-${filters.startDate}-${filters.endDate}.csv`;
          break;
        case 'team':
          csvData = dashboardData?.teamSummary?.map(t => ({
            Team: t.teamName,
            'Total Hours': convertMinutesToDecimalHours(t.totalHours),
          })) || [];
          filename = `team-report-${filters.startDate}-${filters.endDate}.csv`;
          break;
        case 'detailed':
          csvData = detailedData?.entries?.map(e => ({
            Date: new Date(e.date).toLocaleDateString('tr-TR'),
            User: e.userName,
            Client: e.clientName || '',
            Project: e.projectName || '',
            Task: e.taskName || '',
            Hours: convertMinutesToDecimalHours(e.hours),
            Type: e.billable ? 'Billable' : 'Non-Billable',
            Note: e.notes || '',
          })) || [];
          filename = `detailed-report-${filters.startDate}-${filters.endDate}.csv`;
          break;
      }

      if (csvData.length === 0) return;

      // Convert to CSV string
      const headers = Object.keys(csvData[0]);
      const csvRows = [
        headers.join(','),
        ...csvData.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
      ];
      const csvString = csvRows.join('\n');

      // Download
      const blob = new Blob([csvString], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    },
  };

  // Export to global scope
  window.ReportsV2Manager = ReportsV2Manager;

  // Initialize when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ReportsV2Manager.init());
  } else {
    ReportsV2Manager.init();
  }

  // Also check on URL changes (for SPA navigation)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      setTimeout(() => ReportsV2Manager.init(), 1000);
    }
  }).observe(document, { subtree: true, childList: true });

})();
