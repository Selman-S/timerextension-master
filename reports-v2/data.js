// Reports V2 — lazy tab data loaders
(() => {
  'use strict';

  const { CRO_DEPARTMENT_ID, TREND_MONTH_COUNT } = window.ReportsV2Constants;
  const {
    fetchAPI,
    getPreviousPeriodRange,
    getCurrentUser,
    getMonthRange,
    getYearToDateRange,
    formatMonthLabel,
    buildTrendPoints,
  } = window.ReportsV2Utils;

  window.ReportsV2Data = {
    async loadFilterOptions() {
      try {
        const [filterRes, teamsRes] = await Promise.all([
          fetchAPI('/reports/filter-options'),
          fetchAPI('/team/all'),
        ]);
        if (filterRes.success) this.state.filterOptions = filterRes.data;
        if (teamsRes.success) this.state.teamsWithMembers = teamsRes.teams || [];
      } catch (e) {
        console.error('Filter options error:', e);
      }
    },

    buildQueryParams(filters, extra = {}) {
      const params = new URLSearchParams();
      Object.entries({ ...filters, ...extra }).forEach(([key, value]) => {
        if (value !== null && value !== '' && value !== undefined) {
          params.append(key, value);
        }
      });
      return params;
    },

    // 6 months of personal detailed entries → user trend + brand monthly series
    async fetchMyMonthlyData(userId) {
      const offsets = [];
      for (let i = TREND_MONTH_COUNT - 1; i >= 0; i--) offsets.push(-i);
      const months = offsets.map((offset) => ({
        offset,
        label: formatMonthLabel(offset),
        ...getMonthRange(offset),
      }));

      const responses = await Promise.all(
        months.map((m) => {
          const params = this.buildQueryParams(
            { startDate: m.startDate, endDate: m.endDate, userId: String(userId) },
            { billable: 'true', limit: '500' }
          );
          return fetchAPI(`/reports/detailed?${params}`);
        })
      );

      const userValues = new Array(months.length).fill(0);
      const brandMap = {};

      responses.forEach((res, monthIdx) => {
        (res.data?.entries || []).forEach((e) => {
          const h = Number(e.hours) || 0;
          userValues[monthIdx] += h;
          const id = e.projectId;
          if (!brandMap[id]) {
            brandMap[id] = {
              id,
              name: e.projectName,
              client: e.clientName,
              values: new Array(months.length).fill(0),
            };
          }
          brandMap[id].values[monthIdx] += h;
          brandMap[id].name = e.projectName;
          brandMap[id].client = e.clientName;
        });
      });

      return {
        months,
        userTrendPoints: buildTrendPoints(userValues, months.map((m) => m.label)),
        brandMonthlyTrends: {
          months,
          brands: Object.values(brandMap).sort(
            (a, b) => (b.values[b.values.length - 1] || 0) - (a.values[a.values.length - 1] || 0)
          ),
        },
      };
    },

    buildPersonalSummary({
      userId,
      periodEntries,
      userLeaderboard,
      ytdUserSummary,
      userTrendPoints,
      filterOptions,
    }) {
      const uid = Number(userId);
      const myLb = userLeaderboard.find((u) => Number(u.userId) === uid);
      const periodIdx = userLeaderboard.findIndex((u) => Number(u.userId) === uid);
      const ytdSorted = [...(ytdUserSummary || [])].sort((a, b) => b.totalHours - a.totalHours);
      const ytdIdx = ytdSorted.findIndex((u) => Number(u.userId) === uid);
      const myYtd = ytdSorted.find((u) => Number(u.userId) === uid);

      const brandMap = {};
      periodEntries.forEach((e) => {
        const id = e.projectId;
        if (!brandMap[id]) {
          brandMap[id] = { id, name: e.projectName, client: e.clientName, minutes: 0 };
        }
        brandMap[id].minutes += Number(e.hours) || 0;
      });
      const brands = Object.values(brandMap).sort((a, b) => b.minutes - a.minutes);

      const lastChange =
        userTrendPoints?.length > 0 ? userTrendPoints[userTrendPoints.length - 1].changePct : null;
      const optUser = filterOptions?.users?.find((u) => Number(u.id) === uid);

      return {
        userId: uid,
        name: myLb?.name || optUser?.name || 'Sen',
        avatar: myLb?.avatar,
        periodMinutes: myLb?.totalMinutes || 0,
        periodRank: periodIdx >= 0 ? periodIdx + 1 : null,
        periodTotal: userLeaderboard.length,
        ytdMinutes: myYtd?.totalHours || 0,
        ytdRank: ytdIdx >= 0 ? ytdIdx + 1 : null,
        ytdTotal: ytdSorted.length,
        clientCount: myLb?.clientCount || 0,
        brands,
        myTrendPoints: userTrendPoints || [],
        lastMonthChange: lastChange,
      };
    },

    // Tab: Senin Özetin (~4 API calls)
    async loadPersonalData() {
      const { leaderboardFilters } = this.state;
      const user = getCurrentUser();
      const userId = user?.id;
      if (!userId) return { personal: null, brandMonthlyTrends: null };

      const billableParams = this.buildQueryParams(leaderboardFilters, {
        billable: 'true',
        limit: '500',
      });
      const periodUserParams = this.buildQueryParams(
        { ...leaderboardFilters, userId: String(userId) },
        { billable: 'true', limit: '500' }
      );
      const ytdParams = this.buildQueryParams(getYearToDateRange(), {
        billable: 'true',
        limit: '500',
      });

      const [periodDash, ytdDash, periodDetail, monthly] = await Promise.all([
        fetchAPI(`/reports/dashboard?${billableParams}`),
        fetchAPI(`/reports/dashboard?${ytdParams}`),
        fetchAPI(`/reports/detailed?${periodUserParams}`),
        this.fetchMyMonthlyData(userId),
      ]);

      const userLeaderboard = (periodDash.data?.userSummary || [])
        .map((u) => ({
          userId: u.userId,
          name: u.userName,
          avatar: u.userAvatar,
          totalMinutes: u.totalHours,
          clientCount: u.clientCount,
        }))
        .sort((a, b) => b.totalMinutes - a.totalMinutes);

      const personal = this.buildPersonalSummary({
        userId,
        periodEntries: periodDetail.data?.entries || [],
        userLeaderboard,
        ytdUserSummary: ytdDash.data?.userSummary || [],
        userTrendPoints: monthly.userTrendPoints,
        filterOptions: this.state.filterOptions,
      });

      this.state.selectedTrendUserId = userId;

      return {
        personal,
        brandMonthlyTrends: monthly.brandMonthlyTrends,
      };
    },

    // Tab: Genel Trend (6 dashboard calls)
    async loadTrendsData() {
      const offsets = [];
      for (let i = TREND_MONTH_COUNT - 1; i >= 0; i--) offsets.push(-i);
      const months = offsets.map((offset) => ({
        offset,
        label: formatMonthLabel(offset),
        ...getMonthRange(offset),
      }));

      const responses = await Promise.all(
        months.map((m) => {
          const params = this.buildQueryParams(
            { startDate: m.startDate, endDate: m.endDate },
            { billable: 'true', limit: '500' }
          );
          return fetchAPI(`/reports/dashboard?${params}`);
        })
      );

      const totalValues = responses.map((r) => r.data?.summary?.totalHours || 0);
      const deptMap = {};

      responses.forEach((res, monthIdx) => {
        (res.data?.departmentSummary || []).forEach((d) => {
          if (!deptMap[d.departmentId]) {
            deptMap[d.departmentId] = {
              id: d.departmentId,
              name: d.departmentName,
              values: new Array(months.length).fill(0),
            };
          }
          deptMap[d.departmentId].values[monthIdx] = d.totalHours || 0;
          deptMap[d.departmentId].name = d.departmentName;
        });
      });

      return {
        months,
        total: buildTrendPoints(totalValues, months.map((m) => m.label)),
        departments: Object.values(deptMap).sort(
          (a, b) => (b.values[b.values.length - 1] || 0) - (a.values[a.values.length - 1] || 0)
        ),
      };
    },

    // Tab: Departmanlar (4 API calls)
    async loadDepartmentsData() {
      const { leaderboardFilters } = this.state;
      const prevRange = getPreviousPeriodRange(
        leaderboardFilters.startDate,
        leaderboardFilters.endDate
      );

      const billableParams = this.buildQueryParams(leaderboardFilters, {
        billable: 'true',
        limit: '500',
      });
      const allParams = this.buildQueryParams(leaderboardFilters, { limit: '500' });
      const prevBillableParams = this.buildQueryParams(prevRange, {
        billable: 'true',
        limit: '500',
      });

      const [dashboardRes, dashboardAllRes, dashboardPrevRes, detailedRes, detailedAllRes] =
        await Promise.all([
          fetchAPI(`/reports/dashboard?${billableParams}`),
          fetchAPI(`/reports/dashboard?${allParams}`),
          fetchAPI(`/reports/dashboard?${prevBillableParams}`),
          fetchAPI(`/reports/detailed?${billableParams}`),
          fetchAPI(`/reports/detailed?${allParams}`),
        ]);

      const deptSummary = dashboardRes.data?.departmentSummary || [];
      const deptAllSummary = dashboardAllRes.data?.departmentSummary || [];
      const prevDeptMap = {};
      (dashboardPrevRes.data?.departmentSummary || []).forEach((d) => {
        prevDeptMap[d.departmentId] = d.totalHours;
      });

      const allDeptMinutes = {};
      deptAllSummary.forEach((d) => {
        allDeptMinutes[d.departmentId] = d.totalHours;
      });

      const entries = detailedRes.data?.entries || [];
      const allEntries = detailedAllRes.data?.entries || [];
      const deptAverages = this.calcDepartmentAverages(entries);
      const allDeptAverages = this.calcDepartmentAveragesAll(allEntries);

      const departments = deptSummary
        .map((d) => {
          const allMin = allDeptMinutes[d.departmentId] || 0;
          const billableMin = d.totalHours;
          return {
            departmentId: d.departmentId,
            name: d.departmentName,
            totalMinutes: billableMin,
            prevTotalMinutes: prevDeptMap[d.departmentId] || 0,
            userCount: d.userCount,
            billableRatio: allMin > 0 ? Math.round((billableMin / allMin) * 100) : null,
            avgMinutes: deptAverages[d.departmentId]?.avgMinutes ?? null,
            qualifiedUsers: deptAverages[d.departmentId]?.qualifiedCount ?? 0,
            totalUsers: deptAverages[d.departmentId]?.totalUsers ?? 0,
          };
        })
        .sort((a, b) => b.totalMinutes - a.totalMinutes);

      const allAverageDepartments = Object.entries(allDeptAverages)
        .map(([departmentId, data]) => ({
          departmentId: Number(departmentId),
          name: data.name,
          avgMinutes: data.avgMinutes,
          userCount: data.totalUsers,
        }))
        .sort((a, b) => (b.avgMinutes || 0) - (a.avgMinutes || 0));

      return { departments, allAverageDepartments };
    },

    // Tab: Liderlik (2 API calls; user monthly on demand)
    async loadRankingData() {
      const { leaderboardFilters } = this.state;
      const billableParams = this.buildQueryParams(leaderboardFilters, {
        billable: 'true',
        limit: '500',
      });

      const [dashboardRes, detailedRes] = await Promise.all([
        fetchAPI(`/reports/dashboard?${billableParams}`),
        fetchAPI(`/reports/detailed?${billableParams}`),
      ]);

      const entries = detailedRes.data?.entries || [];
      const userDeptMap = {};
      entries.forEach((e) => {
        if (e.userId) userDeptMap[e.userId] = e.departmentName;
      });

      const userLeaderboard = (dashboardRes.data?.userSummary || [])
        .map((u) => ({
          userId: u.userId,
          name: u.userName,
          avatar: u.userAvatar,
          department: userDeptMap[u.userId] || '—',
          totalMinutes: u.totalHours,
          clientCount: u.clientCount,
        }))
        .sort((a, b) => b.totalMinutes - a.totalMinutes);

      const currentUser = getCurrentUser();
      const myIdx = currentUser?.id
        ? userLeaderboard.findIndex((u) => Number(u.userId) === Number(currentUser.id))
        : -1;

      return {
        userLeaderboard,
        myPeriodRank: myIdx >= 0 ? myIdx + 1 : null,
        myUserId: currentUser?.id,
      };
    },

    // Lazy: another user's monthly trend (cached per user)
    async loadUserMonthlyTrend(userId) {
      const key = `user|${userId}`;
      if (this.getCacheKey('userTrends') === key && this.getCached('userTrends')) {
        return this.getCached('userTrends');
      }
      const monthly = await this.fetchMyMonthlyData(userId);
      this.setCached('userTrends', key, monthly.userTrendPoints);
      return monthly.userTrendPoints;
    },

    async loadBrandsData() {
      const { leaderboardFilters, brandsDeptId } = this.state;
      const user = getCurrentUser();
      const params = this.buildQueryParams(leaderboardFilters, {
        departmentId: String(brandsDeptId),
        billable: 'true',
        limit: '500',
      });

      const detailedRes = await fetchAPI(`/reports/detailed?${params}`);
      const teamEntries = detailedRes.data?.entries || [];

      let myEntries = teamEntries;
      if (user?.id) {
        myEntries = teamEntries.filter((e) => Number(e.userId) === Number(user.id));
      }

      const projects = new Map();
      teamEntries.forEach((entry) => {
        const key = String(entry.projectId);
        if (!projects.has(key)) {
          projects.set(key, {
            projectId: entry.projectId,
            brand: entry.projectName,
            clientId: entry.clientId,
            client: entry.clientName,
            department: entry.departmentName,
            teamMinutes: 0,
          });
        }
        projects.get(key).teamMinutes += Number(entry.hours) || 0;
      });

      const myMinutes = {};
      myEntries.forEach((e) => {
        myMinutes[e.projectId] = (myMinutes[e.projectId] || 0) + (Number(e.hours) || 0);
      });

      const projectList = Array.from(projects.values())
        .map((p) => ({ ...p, workedMinutes: myMinutes[p.projectId] || 0 }))
        .sort((a, b) => b.teamMinutes - a.teamMinutes);

      const clientIds = [...new Set(projectList.map((p) => p.clientId))];
      const wlCache = {};
      await Promise.all(
        clientIds.map(async (clientId) => {
          wlCache[clientId] = await this.getWorkloadLimitsByClient(clientId, brandsDeptId);
        })
      );

      const manualLimits = this.getManualLimits();
      const rows = projectList.map((proj) => {
        const apiLimit = wlCache[proj.clientId]?.[proj.projectId] ?? null;
        const { limit, fromApi } = this.resolveLimit(proj.projectId, apiLimit, manualLimits);
        const myWorkedHours = Math.round((proj.workedMinutes / 60) * 10) / 10;
        const teamWorkedHours = Math.round((proj.teamMinutes / 60) * 10) / 10;
        const remaining =
          limit != null ? Math.round((limit - teamWorkedHours) * 10) / 10 : null;
        const pct =
          limit != null && limit > 0 ? Math.round((teamWorkedHours / limit) * 100) : null;
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

      const rowsWithLimit = rows.filter((r) => r.limit != null);
      const totalLimit = rowsWithLimit.reduce((s, r) => s + r.limit, 0);
      const totalCroTeam = rows.reduce((s, r) => s + r.teamWorkedHours, 0);

      return {
        rows,
        deptId: brandsDeptId,
        summary: {
          myTotal: rows.reduce((s, r) => s + r.myWorkedHours, 0),
          brandCount: new Set(rows.map((r) => r.brand)).size,
          teamTotal: totalCroTeam,
          limitTotal: rowsWithLimit.length ? totalLimit : null,
          // Portfolio remaining: limit sum minus all dept hours (incl. brands without limit)
          remainingTotal:
            rowsWithLimit.length > 0
              ? Math.round((totalLimit - totalCroTeam) * 10) / 10
              : null,
          overallPct: totalLimit > 0 ? Math.round((totalCroTeam / totalLimit) * 100) : null,
        },
      };
    },

    async loadExploreData() {
      const params = this.buildQueryParams(this.state.exploreFilters, { limit: '500' });
      const summaryParams = this.buildQueryParams(this.state.exploreFilters);
      const [dashboardRes, detailedRes, summaryRes] = await Promise.all([
        fetchAPI(`/reports/dashboard?${params}`),
        fetchAPI(`/reports/detailed?${params}`),
        fetchAPI(`/reports/summary?${summaryParams}`),
      ]);

      const entries = detailedRes.data?.entries || [];
      const userBillableRatios = {};
      entries.forEach((e) => {
        if (!userBillableRatios[e.userId]) userBillableRatios[e.userId] = { b: 0, t: 0 };
        userBillableRatios[e.userId].t += Number(e.hours) || 0;
        if (e.billable) userBillableRatios[e.userId].b += Number(e.hours) || 0;
      });
      Object.keys(userBillableRatios).forEach((uid) => {
        const { b, t } = userBillableRatios[uid];
        userBillableRatios[uid] = t > 0 ? Math.round((b / t) * 100) : null;
      });

      return {
        dashboardData: dashboardRes.data,
        detailedData: detailedRes.data,
        exploreSummary: summaryRes.data?.summary || null,
        exploreComputed: {
          teamSummary: this.computeTeamSummary(entries),
          projectSummary: this.computeProjectSummary(entries),
          lateEntries: this.computeLateEntries(entries),
          userBillableRatios,
        },
      };
    },
  };
})();
