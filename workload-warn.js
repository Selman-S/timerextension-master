// Warn inside the time modal when the selected brand has under 4h left this month
(() => {
  'use strict';

  const BASE_URL = 'https://hyperactive.pro/api';
  const WARN_UNDER = 4;
  const CACHE_MS = 5 * 60 * 1000;
  const BOX_ID = 'ha-brand-remain';

  let services = [];
  let fetchedAt = 0;
  let loading = null;

  const norm = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();

  const getToken = () => {
    try { return localStorage.getItem('user'); } catch { return ''; }
  };

  // Same remaining math as the workload table: limit hours minus billable hours
  const remainingHours = (service) => {
    const used = (service.Projects || []).reduce((sum, project) => sum + Number(project.total_time || 0), 0) / 60;
    return Number(service.limits || 0) - used;
  };

  const loadServices = async () => {
    if (services.length && Date.now() - fetchedAt < CACHE_MS) return services;
    if (loading) return loading;
    loading = fetch(`${BASE_URL}/services/workload`, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
    })
      .then((res) => res.json())
      .then((json) => {
        services = Array.isArray(json?.services) ? json.services : [];
        fetchedAt = Date.now();
        return services;
      })
      .catch(() => services)
      .finally(() => { loading = null; });
    return loading;
  };

  // "Pegasus - (Pegasus)" → brand in parentheses, project name before it
  const readProject = (modal) => {
    const label = [...modal.querySelectorAll('label')].find((el) =>
      /^project\b/i.test((el.textContent || '').replace(/\s+/g, ' ').trim())
    );
    const raw = label?.closest('.form-group')?.querySelector('.select__single-value')?.textContent?.trim() || '';
    if (!raw || /^select/i.test(raw)) return null;
    const paren = raw.match(/\(([^)]+)\)\s*$/);
    const brand = paren ? paren[1].trim() : '';
    const project = raw.replace(/\s*-\s*\([^)]+\)\s*$/, '').trim();
    return { brand, project, raw };
  };

  // Lowest remaining service that belongs to this brand
  const matchService = (pick) => {
    const brand = norm(pick.brand);
    const project = norm(pick.project);
    const hits = services.filter((service) =>
      (service.Projects || []).some((item) => {
        const client = norm(item.Client?.name);
        const name = norm(item.name);
        if (brand && (client === brand || name === brand)) return true;
        if (project && (name === project || client === project)) return true;
        return false;
      })
    );
    if (!hits.length) return null;
    return hits.reduce((lowest, service) =>
      remainingHours(service) < remainingHours(lowest) ? service : lowest
    );
  };

  const formatHours = (hours) => {
    const rounded = Math.round(hours * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  };

  const paint = (modal, service) => {
    let box = modal.querySelector(`#${BOX_ID}`);
    const hours = service ? remainingHours(service) : null;
    if (!service || hours >= WARN_UNDER) {
      box?.remove();
      return;
    }
    if (!box) {
      box = document.createElement('div');
      box.id = BOX_ID;
      const projectGroup = [...modal.querySelectorAll('label')].find((el) =>
        /^project\b/i.test((el.textContent || '').replace(/\s+/g, ' ').trim())
      )?.closest('.form-group');
      (projectGroup || modal.querySelector('.modal-body') || modal).insertAdjacentElement(
        projectGroup ? 'afterend' : 'beforeend',
        box
      );
    }
    const name = service.name || 'Bu marka';
    box.textContent = `${name}: kalan ${formatHours(hours)} saat. 4 saatin altında.`;
    box.classList.toggle('is-over', hours < 0);
  };

  const tick = () => {
    const modal = document.querySelector('.modal.show .timesheet-modal');
    if (!modal) return;
    const pick = readProject(modal);
    if (!pick) {
      modal.querySelector(`#${BOX_ID}`)?.remove();
      return;
    }
    loadServices().then(() => {
      const open = document.querySelector('.modal.show .timesheet-modal');
      if (!open) return;
      const current = readProject(open);
      if (!current || current.raw !== pick.raw) return;
      paint(open, matchService(current));
    });
  };

  const style = document.createElement('style');
  style.textContent = `
    #${BOX_ID} {
      margin: 8px 0 4px;
      padding: 8px 10px;
      border-radius: 8px;
      background: #fff7ed;
      border: 1px solid #fdba74;
      color: #9a3412;
      font-size: 13px;
      font-weight: 600;
      line-height: 1.35;
    }
    #${BOX_ID}.is-over {
      background: #fee2e2;
      border-color: #f87171;
      color: #991b1b;
    }
  `;
  document.documentElement.appendChild(style);

  setInterval(tick, 700);
})();
