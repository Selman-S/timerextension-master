// Reports V2 — brands tab
(() => {
  'use strict';

  const { CRO_DEPARTMENT_ID } = window.ReportsV2Constants;
  const { renderSegmentedProgress } = window.ReportsV2Utils;

  window.ReportsV2RenderBrands = {
    renderBrandsTab() {
      const brandsData = this.getCached('brands');
      const { brandsDeptId, filterOptions } = this.state;
      if (!brandsData) {
        return '<p class="rv2-empty">Veri yükleniyor…</p>';
      }

      const { rows, summary } = brandsData;
      const deptName =
        filterOptions.departments.find((d) => Number(d.id) === Number(brandsDeptId))?.name ||
        'Departman';

      const fmt = (v, suffix = ' sa') => (v == null ? '—' : `${Math.round(v * 10) / 10}${suffix}`);

      const renderLimitCell = (row) => {
        if (row.limitFromApi && row.limit != null) return `${row.limit} sa`;
        const manual = this.getManualLimits()[String(row.projectId)];
        return `<input type="number" class="rv2-limit-input" data-project-id="${row.projectId}"
          value="${manual != null ? manual : ''}" min="0" step="0.5" placeholder="sa"
          title="Manuel limit (localStorage)" />`;
      };

      return `
        <div class="rv2-brands">
          <div class="rv2-brands-toolbar">
            <label class="rv2-field-label">Departman</label>
            <select id="brands-dept" class="form-control rv2-dept-select">
              ${filterOptions.departments
                .map(
                  (d) =>
                    `<option value="${d.id}" ${Number(brandsDeptId) === Number(d.id) ? 'selected' : ''}>${d.name}</option>`
                )
                .join('')}
            </select>
            <button id="brands-refresh" class="btn btn-primary">Yenile</button>
          </div>

          <div class="stats-row rv2-lb-stats rv2-stats-compact">
            <div class="stat-card">
              <div class="stat-card-top"><span class="stat-label">Senin çalışman</span></div>
              <div class="stat-number">${fmt(summary.myTotal)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-card-top"><span class="stat-label">Marka</span></div>
              <div class="stat-number">${summary.brandCount}</div>
            </div>
            <div class="stat-card">
              <div class="stat-card-top"><span class="stat-label">${deptName} toplamı</span></div>
              <div class="stat-number">${fmt(summary.teamTotal)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-card-top"><span class="stat-label">Limit toplamı</span></div>
              <div class="stat-number">${fmt(summary.limitTotal)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-card-top"><span class="stat-label">Kalan</span></div>
              <div class="stat-number">${fmt(summary.remainingTotal)}</div>
            </div>
            <div class="stat-card stat-card-hero">
              <div class="stat-card-top"><span class="stat-label">Doluluk</span></div>
              <div class="stat-hero-split">
                <div class="stat-hero-main">${summary.overallPct != null ? `%${summary.overallPct}` : '—'}</div>
                <div class="stat-hero-sub">${summary.overallPct != null ? `%${100 - summary.overallPct} boş` : ''}</div>
              </div>
              ${summary.overallPct != null ? renderSegmentedProgress(summary.overallPct) : ''}
            </div>
          </div>

          <div class="table-card table-card-full">
            <div class="table-header">
              <h4>Marka — ${deptName} billable limit</h4>
              <button class="btn-download" data-export-type="brands">CSV</button>
            </div>
            <div class="table-body">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Marka</th>
                    <th class="text-right">Senin saatin</th>
                    <th class="text-right">Ekip toplamı</th>
                    <th>Limit</th>
                    <th class="text-right">Kalan</th>
                    <th>Doluluk</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows.length === 0 ? `<tr><td colspan="6" class="rv2-empty">Bu dönemde ${deptName} billable kayıt yok.</td></tr>` : ''}
                  ${rows
                    .map((row) => {
                      const remClass =
                        row.remaining != null && row.remaining < 0 ? 'rv2-danger' : '';
                      return `
                    <tr>
                      <td><strong>${row.brand}</strong><br><small class="text-muted">${row.client}</small></td>
                      <td class="text-right"><strong>${row.myWorkedHours} sa</strong></td>
                      <td class="text-right">${row.teamWorkedHours} sa</td>
                      <td>${renderLimitCell(row)}</td>
                      <td class="text-right ${remClass}">${row.remaining != null ? `${row.remaining} sa` : '—'}</td>
                      <td class="rv2-bpct-cell">
                        ${row.pct != null ? renderSegmentedProgress(row.pct) : '—'}
                      </td>
                    </tr>`;
                    })
                    .join('')}
                </tbody>
              </table>
            </div>
            <div class="table-card-footer">${
              rows.length
                ? rows.filter((r) => r.pct != null && r.pct >= 80).length > 0
                  ? `${rows.filter((r) => r.pct != null && r.pct >= 80).length} marka limitin %80'ine yaklaştı veya aştı.`
                  : 'Tüm markalar limit dahilinde.'
                : 'Bu dönem için marka verisi yok.'
            }</div>
          </div>
        </div>
      `;
    },
  };
})();
