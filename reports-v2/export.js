// Reports V2 — CSV export
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
    convertMinutesToHours,
    convertMinutesToDecimalHours,
    rankMedal,
    renderTrend,
    formatTrend,
    getMonthRange,
  } = U;


  window.ReportsV2Export = {
    exportCSV(type) {

      let csvData = [];
      let filename = '';
      const { dashboardData, detailedData, leaderboardFilters, exploreFilters } = this.state;
      const departmentsData = this.getCached('departments');
      const rankingData = this.getCached('ranking');
      const brandsData = this.getCached('brands');

      switch (type) {
        case 'lb-total':
          csvData = (departmentsData?.departments || []).map((d, i) => ({
            Rank: i + 1,
            Department: d.name,
            Hours: convertMinutesToDecimalHours(d.totalMinutes),
            'MoM %': formatTrend(d.totalMinutes, d.prevTotalMinutes).text,
            'Billable %': d.billableRatio != null ? d.billableRatio : '',
            Users: d.userCount,
          }));
          filename = `leaderboard-total-${leaderboardFilters.startDate}.csv`;
          break;
        case 'lb-users':
          csvData = (rankingData?.userLeaderboard || []).map((u, i) => ({
            Rank: i + 1,
            User: u.name,
            Department: u.department,
            Hours: convertMinutesToDecimalHours(u.totalMinutes),
            Clients: u.clientCount,
          }));
          filename = `leaderboard-users-${leaderboardFilters.startDate}.csv`;
          break;
        case 'lb-avg':
          csvData = (departmentsData?.departments || []).map((d) => ({
            Department: d.name,
            'Avg Hours': d.avgMinutes ? convertMinutesToDecimalHours(d.avgMinutes) : '',
            'Qualified Users': d.qualifiedUsers,
            'Total Users': d.totalUsers,
          }));
          filename = `leaderboard-avg-${leaderboardFilters.startDate}.csv`;
          break;
        case 'lb-avg-all':
          csvData = (departmentsData?.allAverageDepartments || []).map((d) => ({
            Department: d.name,
            'Avg Hours': d.avgMinutes ? convertMinutesToDecimalHours(d.avgMinutes) : '',
            Users: d.userCount,
          }));
          filename = `leaderboard-avg-all-${leaderboardFilters.startDate}.csv`;
          break;
        case 'client':
          csvData = (dashboardData?.clientSummary || []).map((c) => ({
            Client: c.clientName,
            Hours: convertMinutesToDecimalHours(c.totalHours),
          }));
          filename = `client-${exploreFilters.startDate}.csv`;
          break;
        case 'user':
          csvData = (dashboardData?.userSummary || []).map((u) => ({
            User: u.userName,
            Hours: convertMinutesToDecimalHours(u.totalHours),
          }));
          filename = `user-${exploreFilters.startDate}.csv`;
          break;
        case 'department':
          csvData = (dashboardData?.departmentSummary || []).map((d) => ({
            Department: d.departmentName,
            Hours: convertMinutesToDecimalHours(d.totalHours),
          }));
          filename = `department-${exploreFilters.startDate}.csv`;
          break;
        case 'task':
          csvData = (dashboardData?.actionItemSummary || []).map((t) => ({
            Task: t.taskName,
            Hours: convertMinutesToDecimalHours(t.totalHours),
            Billable: t.billable ? 'Yes' : 'No',
          }));
          filename = `task-${exploreFilters.startDate}.csv`;
          break;
        case 'team':
          csvData = (this.state.exploreComputed?.teamSummary || []).map((t) => ({
            Team: t.teamName,
            Hours: convertMinutesToDecimalHours(t.totalHours),
            Users: t.userCount,
          }));
          filename = `team-${exploreFilters.startDate}.csv`;
          break;
        case 'project':
          csvData = (this.state.exploreComputed?.projectSummary || []).map((p) => ({
            Project: p.projectName,
            Client: p.clientName,
            Hours: convertMinutesToDecimalHours(p.totalHours),
          }));
          filename = `project-${exploreFilters.startDate}.csv`;
          break;
        case 'brands':
          csvData = (brandsData?.rows || []).map((r) => ({
            Brand: r.brand,
            Client: r.client,
            'My Hours': r.myWorkedHours,
            'Team Hours': r.teamWorkedHours,
            Limit: r.limit ?? '',
            Remaining: r.remaining ?? '',
            Percent: r.pct != null ? r.pct : '',
          }));
          filename = `brands-${leaderboardFilters.startDate}.csv`;
          break;
        case 'late':
          csvData = (this.state.exploreComputed?.lateEntries || []).map((e) => ({
            SpentAt: e.spent_at || e.date,
            EnteredAt: e.enteredAt,
            User: e.userName,
            Client: e.clientName,
            Project: e.projectName,
            Hours: convertMinutesToDecimalHours(e.hours),
          }));
          filename = `late-entries-${exploreFilters.startDate}.csv`;
          break;
        case 'detailed':
          csvData = (detailedData?.entries || []).map((e) => ({
            Date: e.date,
            User: e.userName,
            Department: e.departmentName,
            Client: e.clientName,
            Project: e.projectName,
            Hours: convertMinutesToDecimalHours(e.hours),
            Billable: e.billable ? 'Yes' : 'No',
            Note: e.notes || '',
          }));
          filename = `detailed-${exploreFilters.startDate}.csv`;
          break;
      }

      if (!csvData.length) return;
      const headers = Object.keys(csvData[0]);
      const csv = [headers.join(','), ...csvData.map((r) => headers.map((h) => `"${r[h] ?? ''}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
    }
  };
})();
