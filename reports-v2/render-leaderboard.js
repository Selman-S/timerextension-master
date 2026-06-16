// Reports V2 — tab renderers (personal, trends, departments, ranking)
(() => {
  'use strict';

  const { AVATAR_URL, MIN_AVG_HOURS } = window.ReportsV2Constants;
  const {
    formatMinutesReadable,
    rankMedal,
    renderTrend,
    renderDeptTrendTabs,
    renderBrandTrendTabs,
    buildTrendPoints,
  } = window.ReportsV2Utils;

  const C = () => window.ReportsV2Charts;

  const loadingBlock = () => '<p class="rv2-empty">Veri yükleniyor…</p>';

  const personalTrendInsight = (points) => {
    if (!points?.length) return '';
    const last = points[points.length - 1];
    if (last.changePct == null) return 'Son 6 ayın billable trendi.';
    const dir = last.changePct > 0 ? 'artış' : last.changePct < 0 ? 'düşüş' : 'değişim yok';
    return `Geçen aya göre %${Math.abs(last.changePct)} ${dir} gösterdin.`;
  };

  const totalTrendInsight = (points) => {
    if (!points?.length) return '';
    const last = points[points.length - 1];
    if (last.changePct == null) return 'Son 6 ayın billable trendi.';
    const dir = last.changePct > 0 ? 'artış' : last.changePct < 0 ? 'düşüş' : 'değişim yok';
    return `Geçen aya göre toplam billable %${Math.abs(last.changePct)} ${dir} gösterdi.`;
  };

  const singleDeptTrendInsight = (dept, months) => {
    if (!dept || !months?.length) return '';
    const points = buildTrendPoints(dept.values, months.map((m) => m.label));
    const last = points[points.length - 1];
    if (last.changePct == null) return `${dept.name} için son 6 ayın billable trendi.`;
    const dir = last.changePct > 0 ? 'artış' : last.changePct < 0 ? 'düşüş' : 'değişim yok';
    return `${dept.name} geçen aya göre %${Math.abs(last.changePct)} ${dir} gösterdi.`;
  };

  const brandTrendInsight = (brand, months) => {
    if (!brand || !months?.length) return '';
    const points = buildTrendPoints(brand.values, months.map((m) => m.label));
    const last = points[points.length - 1];
    if (last.changePct == null) return `${brand.name} markasında son 6 ayın trendi.`;
    const dir = last.changePct > 0 ? 'artış' : last.changePct < 0 ? 'düşüş' : 'değişim yok';
    return `${brand.name} markasında geçen aya göre %${Math.abs(last.changePct)} ${dir}.`;
  };

  window.ReportsV2RenderLeaderboard = {
    // Update only brand trend block — keeps upper charts intact
    updatePersonalBrandTrend(brandId) {
      const cached = this.getCached('personal');
      if (!cached?.brandMonthlyTrends) return;
      const { brandMonthlyTrends } = cached;
      const brandSeries = brandMonthlyTrends.brands || [];
      const activeBrand =
        brandSeries.find((b) => String(b.id) === String(brandId)) || brandSeries[0];
      if (!activeBrand) return;

      this.state.selectedTrendBrandId = brandId;

      document.querySelectorAll('.rv2-brand-tab').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.brandId === String(brandId));
      });

      const labels = brandMonthlyTrends.months.map((m) => m.label);
      const points = buildTrendPoints(activeBrand.values, labels);
      const colorIdx = brandSeries.findIndex((b) => String(b.id) === String(activeBrand.id));
      const color = window.ReportsV2Charts?.seriesColor(colorIdx) || '#6366f1';

      window.ReportsV2Charts?.updateLineChart('rv2-chart-brand-trend', points, {
        label: activeBrand.name,
        color,
      });

      const footer = document.querySelector('.rv2-personal-brands .table-card-footer');
      if (footer) footer.textContent = brandTrendInsight(activeBrand, brandMonthlyTrends.months);
    },

    renderPersonalTab() {
      const cached = this.getCached('personal');
      if (!cached) return loadingBlock();

      const { personal, brandMonthlyTrends } = cached;
      const { selectedTrendBrandId } = this.state;
      if (!personal) return '<p class="rv2-empty">Kişisel özet için giriş yapılmış olmalı.</p>';

      const brandSeries = brandMonthlyTrends?.brands || [];
      const activeBrandId = selectedTrendBrandId ?? brandSeries[0]?.id ?? null;
      const activeBrand =
        brandSeries.find((b) => String(b.id) === String(activeBrandId)) || brandSeries[0] || null;

      const brandBars = personal.brands
        .map((b) => ({ name: b.name, value: b.minutes }))
        .sort((a, b) => b.value - a.value);

      return `
        <div class="rv2-personal-section">
          <div class="rv2-section-head">
            <div class="rv2-section-head-text">
              ${personal.avatar ? `<img src="${AVATAR_URL}/${personal.avatar}" class="rv2-personal-avatar" onerror="this.style.display='none'">` : ''}
              <div>
                <h2 class="rv2-section-title">Senin Özetin</h2>
                <p class="rv2-section-sub">${personal.name} — seçili dönem ve sıralamaların</p>
              </div>
            </div>
          </div>

          <div class="stats-row rv2-personal-stats">
            <div class="stat-card stat-card-hero">
              <div class="stat-card-top"><span class="stat-label">Bu Dönem Çalışman</span></div>
              <div class="stat-hero-main">${formatMinutesReadable(personal.periodMinutes)}</div>
              <div class="stat-hero-sub">${personal.clientCount} client</div>
            </div>
            <div class="stat-card">
              <div class="stat-card-top"><span class="stat-label">Dönem Sıralaman</span></div>
              <div class="stat-number">${personal.periodRank != null ? `#${personal.periodRank}` : '—'}</div>
              <div class="stat-label">/${personal.periodTotal} kişi</div>
            </div>
            <div class="stat-card">
              <div class="stat-card-top"><span class="stat-label">Yıl Toplam Sıralaman</span></div>
              <div class="stat-number">${personal.ytdRank != null ? `#${personal.ytdRank}` : '—'}</div>
              <div class="stat-label">/${personal.ytdTotal} kişi · ${formatMinutesReadable(personal.ytdMinutes)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-card-top"><span class="stat-label">Son Ay Değişimin</span></div>
              <div class="stat-number ${personal.lastMonthChange > 0 ? 'rv2-ok' : personal.lastMonthChange < 0 ? 'rv2-danger' : ''}">
                ${personal.lastMonthChange != null ? `${personal.lastMonthChange > 0 ? '+' : ''}${personal.lastMonthChange}%` : '—'}
              </div>
              <div class="stat-label">geçen aya göre</div>
            </div>
          </div>

          <div class="rv2-trend-row">
            <div class="table-card">
              <div class="table-header">
                <h4>Aylık Billable Trendin</h4>
                <span class="rv2-hint">Son 6 ay</span>
              </div>
              <div class="table-card-body-padded">
                ${C()?.queueLineChart(personal.myTrendPoints, {
                  label: 'Billable',
                  chartId: 'rv2-chart-personal-trend',
                }) || '<p class="rv2-empty">Grafik yüklenemedi</p>'}
              </div>
              <div class="table-card-footer">${personalTrendInsight(personal.myTrendPoints)}</div>
            </div>

            <div class="table-card">
              <div class="table-header">
                <h4>Marka Dağılımın</h4>
                <span class="rv2-hint">Seçili dönem</span>
              </div>
              <div class="table-card-body-padded">
                ${brandBars.length
                  ? C()?.queuePieChart(brandBars, { chartId: 'rv2-chart-brand-pie' }) || '<p class="rv2-empty">Grafik yüklenemedi</p>'
                  : '<p class="rv2-empty">Bu dönemde marka kaydı yok.</p>'}
              </div>
              <div class="table-card-footer">${
                brandBars.length
                  ? `En çok çalıştığın marka: ${brandBars[0].name} (${formatMinutesReadable(brandBars[0].value)}).`
                  : 'Seçili dönemde billable kayıt bulunamadı.'
              }</div>
            </div>
          </div>

          ${brandSeries.length ? `
            <div class="table-card rv2-personal-brands">
              <div class="table-header">
                <h4>Markaların — Aylık Trend</h4>
                <span class="rv2-hint">Marka seç</span>
              </div>
              <div class="table-card-body-padded">
                ${renderBrandTrendTabs(brandMonthlyTrends.months, brandSeries, activeBrandId)}
              </div>
              <div class="table-card-footer">${brandTrendInsight(activeBrand, brandMonthlyTrends.months)}</div>
            </div>
          ` : ''}
        </div>
      `;
    },

    renderTrendsTab() {
      const data = this.getCached('trends');
      if (!data) return loadingBlock();

      const { selectedTrendDeptId } = this.state;
      const deptSeries = data.departments || [];
      const activeDeptId = selectedTrendDeptId ?? deptSeries[0]?.id ?? null;
      const activeDept =
        deptSeries.find((d) => String(d.id) === String(activeDeptId)) || deptSeries[0] || null;

      const latestIdx = Math.max(0, (deptSeries[0]?.values?.length || 1) - 1);
      const deptPieItems = deptSeries
        .map((d) => ({ name: d.name, value: d.values[latestIdx] || 0 }))
        .sort((a, b) => b.value - a.value);

      return `
        <div class="rv2-trend-row">
          <div class="table-card">
            <div class="table-header">
              <h4>Toplam Billable — Aylık Trend</h4>
              <span class="rv2-hint">Son ${data.months?.length || 6} ay</span>
            </div>
            <div class="table-card-body-padded">
              ${C()?.queueLineChart(data.total || [], { label: 'Toplam', color: '#6366f1', idPrefix: 'total-trend' }) || '<p class="rv2-empty">Grafik yüklenemedi</p>'}
            </div>
            <div class="table-card-footer">${totalTrendInsight(data.total)}</div>
          </div>

          <div class="table-card">
            <div class="table-header">
              <h4>Departman Dağılımı</h4>
              <span class="rv2-hint">Son ay billable</span>
            </div>
            <div class="table-card-body-padded">
              ${C()?.queuePieChart(deptPieItems, { idPrefix: 'dept-pie-trends' }) || '<p class="rv2-empty">Grafik yüklenemedi</p>'}
            </div>
            <div class="table-card-footer">${
              deptPieItems.length
                ? `En yüksek pay: ${deptPieItems[0].name} (${formatMinutesReadable(deptPieItems[0].value)}).`
                : 'Departman verisi yok.'
            }</div>
          </div>
        </div>

        <div class="table-card">
          <div class="table-header">
            <h4>Departman — Aylık Trend</h4>
            <span class="rv2-hint">Departman seç</span>
          </div>
          <div class="table-card-body-padded">
            ${renderDeptTrendTabs(data.months || [], deptSeries, activeDeptId)}
          </div>
          <div class="table-card-footer">${singleDeptTrendInsight(activeDept, data.months)}</div>
        </div>
      `;
    },

    renderDepartmentsTab() {
      const data = this.getCached('departments');
      if (!data) return loadingBlock();

      const { departments, allAverageDepartments } = data;

      const deptPieItems = departments.map((d) => ({
        name: d.name,
        value: d.totalMinutes,
      }));

      return `
        <div class="table-card rv2-dept-pie-card">
          <div class="table-header">
            <h4>Departman Dağılımı</h4>
            <span class="rv2-hint">Seçili dönem billable</span>
          </div>
          <div class="table-card-body-padded">
            ${C()?.queuePieChart(deptPieItems, { idPrefix: 'dept-pie-period' }) || '<p class="rv2-empty">Grafik yüklenemedi</p>'}
          </div>
          <div class="table-card-footer">${
            deptPieItems.length
              ? `En yüksek departman: ${departments[0]?.name} (${formatMinutesReadable(departments[0]?.totalMinutes)}).`
              : 'Bu dönemde departman verisi yok.'
          }</div>
        </div>

        <div class="rv2-lb-split">
          <div class="table-card">
            <div class="table-header">
              <h4>Departman — Billable Toplam</h4>
              <button class="btn-download" data-export-type="lb-total">CSV</button>
            </div>
            <div class="table-body">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Departman</th>
                    <th class="text-right">Saat</th>
                    <th class="text-center"><span class="th-main">Dönem Değişimi</span><span class="th-sub">önceki döneme göre</span></th>
                    <th class="text-center">Kişi</th>
                  </tr>
                </thead>
                <tbody>
                  ${departments.length === 0 ? '<tr><td colspan="5" class="rv2-empty">Veri yok</td></tr>' : ''}
                  ${departments
                    .map(
                      (d, i) => `
                    <tr>
                      <td class="rv2-rank">${rankMedal(i)}</td>
                      <td><strong>${d.name}</strong></td>
                      <td class="text-right"><strong>${formatMinutesReadable(d.totalMinutes)}</strong></td>
                      <td class="text-center">${renderTrend(d.totalMinutes, d.prevTotalMinutes)}</td>
                      <td class="text-center">${d.userCount}</td>
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div class="table-card">
            <div class="table-header">
              <h4>Departman — Ortalama Billable</h4>
              <span class="rv2-hint">≥${MIN_AVG_HOURS}sa olanlar dahil</span>
              <button class="btn-download" data-export-type="lb-avg">CSV</button>
            </div>
            <div class="table-body">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Departman</th>
                    <th class="text-right">Ortalama</th>
                    <th class="text-center">Dahil / Toplam</th>
                  </tr>
                </thead>
                <tbody>
                  ${[...departments]
                    .sort((a, b) => (b.avgMinutes || 0) - (a.avgMinutes || 0))
                    .map(
                      (d) => `
                    <tr>
                      <td><strong>${d.name}</strong></td>
                      <td class="text-right">${d.avgMinutes != null ? formatMinutesReadable(d.avgMinutes) : '—'}</td>
                      <td class="text-center text-muted">${d.qualifiedUsers} / ${d.totalUsers}</td>
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="table-card" style="margin-top:16px">
          <div class="table-header">
            <h4>Departman — Ortalama (Tüm Saat)</h4>
            <span class="rv2-hint">Billable + Non-billable</span>
            <button class="btn-download" data-export-type="lb-avg-all">CSV</button>
          </div>
          <div class="table-body">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Departman</th>
                  <th class="text-right">Ortalama</th>
                  <th class="text-center">Kişi</th>
                </tr>
              </thead>
              <tbody>
                ${allAverageDepartments.length === 0 ? '<tr><td colspan="3" class="rv2-empty">Veri yok</td></tr>' : ''}
                ${allAverageDepartments
                  .map(
                    (d) => `
                  <tr>
                    <td><strong>${d.name}</strong></td>
                    <td class="text-right">${d.avgMinutes != null ? formatMinutesReadable(d.avgMinutes) : '—'}</td>
                    <td class="text-center text-muted">${d.userCount}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    },

    renderRankingTab() {
      const data = this.getCached('ranking');
      if (!data) return loadingBlock();

      const { userLeaderboard, myPeriodRank, myUserId } = data;
      const personal = this.getCached('personal')?.personal;
      const currentUserId = myUserId || personal?.userId;
      const { selectedTrendUserId, otherUserTrendPoints } = this.state;
      const viewingOther =
        selectedTrendUserId &&
        currentUserId &&
        String(selectedTrendUserId) !== String(currentUserId);
      const otherUser = viewingOther
        ? userLeaderboard.find((u) => String(u.userId) === String(selectedTrendUserId))
        : null;
      const rankLabel = myPeriodRank ?? personal?.periodRank;

      const myRowHighlight = (userId) => {
        if (String(userId) === String(currentUserId)) return 'rv2-row-me';
        if (viewingOther && String(userId) === String(selectedTrendUserId)) return 'rv2-row-selected';
        return '';
      };

      return `
        <div class="table-card">
          <div class="table-header">
            <h4>Kişisel Liderlik — Billable</h4>
            <span class="rv2-hint">${rankLabel != null ? `Sen: #${rankLabel}` : ''} · başkasına tıkla</span>
            <button class="btn-download" data-export-type="lb-users">CSV</button>
          </div>
          <div class="table-body">
            <table class="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Kullanıcı</th>
                  <th>Departman</th>
                  <th class="text-right">Saat</th>
                  <th class="text-center">Client</th>
                </tr>
              </thead>
              <tbody>
                ${userLeaderboard.length === 0 ? '<tr><td colspan="5" class="rv2-empty">Veri yok</td></tr>' : ''}
                ${userLeaderboard
                  .slice(0, 50)
                  .map(
                    (u, i) => `
                  <tr class="rv2-user-row ${myRowHighlight(u.userId)}" data-user-id="${u.userId}">
                    <td class="rv2-rank">${rankMedal(i)}</td>
                    <td>
                      ${u.avatar ? `<img src="${AVATAR_URL}/${u.avatar}" class="avatar" onerror="this.style.display='none'">` : ''}
                      ${u.name}${String(u.userId) === String(currentUserId) ? ' <span class="rv2-me-badge">Sen</span>' : ''}
                    </td>
                    <td>${u.department}</td>
                    <td class="text-right"><strong>${formatMinutesReadable(u.totalMinutes)}</strong></td>
                    <td class="text-center">${u.clientCount}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div id="rv2-user-trend-panel" class="table-card rv2-user-trend ${viewingOther && otherUserTrendPoints ? '' : 'hidden'}">
          <div class="table-header">
            <h4>${otherUser ? `${otherUser.name} — Aylık Trend` : 'Kullanıcı Trendi'}</h4>
            <button type="button" id="rv2-user-trend-close" class="btn btn-secondary btn-sm">Kapat</button>
          </div>
          <div class="table-card-body-padded">
            ${otherUserTrendPoints
              ? C()?.queueLineChart(otherUserTrendPoints, { label: 'Billable', color: '#8b5cf6', idPrefix: 'user-trend' }) || ''
              : ''}
          </div>
        </div>
      `;
    },
  };
})();
