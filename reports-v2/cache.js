// Reports V2 — tab data cache (avoid repeat API calls)
(() => {
  'use strict';

  window.ReportsV2Cache = {
    cacheKey(filters, extra = '') {
      const start = filters?.startDate || '';
      const end = filters?.endDate || '';
      return extra ? `${start}|${end}|${extra}` : `${start}|${end}`;
    },

    getCached(bucket) {
      return this.state.dataCache[bucket]?.data ?? null;
    },

    getCacheKey(bucket) {
      return this.state.dataCache[bucket]?.key ?? null;
    },

    setCached(bucket, key, data) {
      this.state.dataCache[bucket] = { key, data };
    },

    clearCacheBucket(bucket) {
      this.state.dataCache[bucket] = { key: null, data: null };
    },

    invalidateDateCaches() {
      ['personal', 'departments', 'ranking', 'brands'].forEach((b) => this.clearCacheBucket(b));
    },
  };
})();
