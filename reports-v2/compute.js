// Reports V2 — aggregation & computation helpers (mixed into manager)
(() => {
  'use strict';

  const { MIN_AVG_MINUTES, MANUAL_LIMITS_KEY, LATE_ENTRY_DAYS } = window.ReportsV2Constants;
  const { fetchAPI } = window.ReportsV2Utils;

  window.ReportsV2Compute = {
    calcDepartmentAverages(entries) {
      const byDeptUser = {};

      entries.forEach((e) => {
        const deptId = e.departmentId;
        if (!deptId) return;
        if (!byDeptUser[deptId]) byDeptUser[deptId] = {};
        const uid = e.userId;
        byDeptUser[deptId][uid] = (byDeptUser[deptId][uid] || 0) + (Number(e.hours) || 0);
      });

      const result = {};
      Object.entries(byDeptUser).forEach(([deptId, usersMap]) => {
        const allMinutes = Object.values(usersMap);
        const qualified = allMinutes.filter((m) => m >= MIN_AVG_MINUTES);
        result[deptId] = {
          totalUsers: allMinutes.length,
          qualifiedCount: qualified.length,
          avgMinutes:
            qualified.length > 0
              ? qualified.reduce((s, m) => s + m, 0) / qualified.length
              : null,
        };
      });
      return result;
    },

    // All hours, every user included (no billable filter, no min-hours cutoff)
    calcDepartmentAveragesAll(entries) {
      const byDeptUser = {};

      entries.forEach((e) => {
        const deptId = e.departmentId;
        if (!deptId) return;
        if (!byDeptUser[deptId]) {
          byDeptUser[deptId] = { name: e.departmentName, users: {} };
        }
        const uid = e.userId;
        byDeptUser[deptId].users[uid] =
          (byDeptUser[deptId].users[uid] || 0) + (Number(e.hours) || 0);
      });

      const result = {};
      Object.entries(byDeptUser).forEach(([deptId, { name, users }]) => {
        const allMinutes = Object.values(users);
        result[deptId] = {
          name,
          totalUsers: allMinutes.length,
          avgMinutes:
            allMinutes.length > 0
              ? allMinutes.reduce((s, m) => s + m, 0) / allMinutes.length
              : null,
        };
      });
      return result;
    },

    getTopUsersByDepartment(deptId, limit = 10) {
      const entries = this.state.leaderboardData?.entries || [];
      const userMap = {};

      entries
        .filter((e) => Number(e.departmentId) === Number(deptId))
        .forEach((e) => {
          userMap[e.userId] = userMap[e.userId] || {
            userId: e.userId,
            name: e.userName,
            minutes: 0,
          };
          userMap[e.userId].minutes += Number(e.hours) || 0;
        });

      return Object.values(userMap)
        .sort((a, b) => b.minutes - a.minutes)
        .slice(0, limit);
    },

    // Client-side team summary (backend does not return teamSummary)
    computeTeamSummary(entries) {
      const userMinutes = {};
      entries.forEach((e) => {
        userMinutes[e.userId] = (userMinutes[e.userId] || 0) + (Number(e.hours) || 0);
      });

      return (this.state.teamsWithMembers || [])
        .filter((t) => t.is_active !== false)
        .map((team) => {
          const members = team.Users || [];
          const totalHours = members.reduce((s, u) => s + (userMinutes[u.id] || 0), 0);
          return {
            teamId: team.id,
            teamName: team.name,
            totalHours,
            userCount: members.filter((u) => userMinutes[u.id] > 0).length,
          };
        })
        .filter((t) => t.totalHours > 0)
        .sort((a, b) => b.totalHours - a.totalHours);
    },

    computeProjectSummary(entries) {
      const map = {};
      entries.forEach((e) => {
        if (!map[e.projectId]) {
          map[e.projectId] = {
            projectId: e.projectId,
            projectName: e.projectName,
            clientName: e.clientName,
            totalHours: 0,
          };
        }
        map[e.projectId].totalHours += Number(e.hours) || 0;
      });
      return Object.values(map).sort((a, b) => b.totalHours - a.totalHours);
    },

    // Entries entered more than LATE_ENTRY_DAYS after spent_at
    computeLateEntries(entries) {
      const thresholdMs = LATE_ENTRY_DAYS * 24 * 60 * 60 * 1000;
      return entries
        .filter((e) => {
          if (!e.enteredAt) return false;
          const spent = new Date(e.spent_at || e.date);
          const entered = new Date(e.enteredAt);
          return entered - spent > thresholdMs;
        })
        .sort((a, b) => new Date(b.enteredAt) - new Date(a.enteredAt));
    },

    getManualLimits() {
      try {
        return JSON.parse(localStorage.getItem(MANUAL_LIMITS_KEY) || '{}');
      } catch {
        return {};
      }
    },

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

    resolveLimit(projectId, apiLimit, manualLimits) {
      if (apiLimit != null && apiLimit > 0) return { limit: apiLimit, fromApi: true };
      const manual = manualLimits[String(projectId)];
      if (manual != null && manual > 0) return { limit: manual, fromApi: false };
      return { limit: null, fromApi: false };
    },

    async getWorkloadLimitsByClient(clientId, departmentId) {
      const res = await fetchAPI(
        `/services/workload?clientId=${clientId}&departmentId=${departmentId}`
      );
      if (!res?.success) return {};
      const byProject = {};
      (res.services || []).forEach((service) => {
        const limit = Number(service.limits) || null;
        (service.Projects || []).forEach((project) => {
          if (limit != null) byProject[project.id] = limit;
        });
      });
      return byProject;
    },
  };
})();
