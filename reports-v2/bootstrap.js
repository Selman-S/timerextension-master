// Reports V2 — bootstrap on page load / SPA navigation
(() => {
  'use strict';

  const run = () => window.ReportsV2Manager.init();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(run, 800);
    }
  }).observe(document, { subtree: true, childList: true });
})();