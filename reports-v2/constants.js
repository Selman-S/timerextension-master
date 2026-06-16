// Reports V2 — shared constants
(() => {
  'use strict';

  window.ReportsV2Constants = {
    REPORTS_V2_CONTAINER_ID: 'hyperactive-reports-v2-container',
    BASE_URL: 'https://hyperactive.pro/api',
    AVATAR_URL: 'https://hyperactive.pro/cdn/avatar',
    MIN_AVG_HOURS: 10,
    MIN_AVG_MINUTES: 10 * 60,
    CRO_DEPARTMENT_ID: 3,
    MANUAL_LIMITS_KEY: 'ha_cro_manual_limits',
    LATE_ENTRY_DAYS: 2,
    TREND_MONTH_COUNT: 6,
    TITLE_OPTIONS: [
      { id: '0', label: 'Intern' },
      { id: '1', label: 'Jr' },
      { id: '2', label: 'Executive' },
      { id: '3', label: 'Sr' },
      { id: '4', label: 'Lead' },
      { id: '5', label: 'Team Lead' },
      { id: '6', label: 'Manager' },
      { id: '7', label: 'Director' },
      { id: '8', label: 'Founder' },
      { id: '9', label: 'Consultant' },
      { id: '10', label: 'Sr Manager' },
      { id: '11', label: 'C-Level' },
    ],
  };
})();
