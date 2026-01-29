// content.js

(() => {
  // Bilgi Kutusunun ID'si
  const INFO_CONTAINER_ID = 'hyperactive-time-info-container';
  const CHART_ICON_ID = 'hyperactive-time-chart-icon';
  const CHART_MODAL_ID = 'hyperactive-time-chart-modal';
  const CHART_CANVAS_ID = 'hyperactive-time-chart-canvas';
  const WORKLOAD_INFO_ID = 'hyperactive-workload-info';
  const WORKLOAD_REFRESH_BTN_ID = 'hyperactive-workload-refresh-btn';
  const REPORTS_LINK_ID = 'hyperactive-reports-link';

  // Interval Süresi (ms)
  const CHECK_INTERVAL = 1000; // 1 saniye

  // Yardımcı Fonksiyonlar
  const getUnixTimestamps = (year, month, dayStart, dayEnd) => {
    const startDate = new Date(year, month, dayStart);
    const endDate = new Date(year, month, dayEnd, 23, 59, 59, 999);
    return [startDate.getTime(), endDate.getTime()];
  };

  const fetchBillableTime = async (start, end) => {
    try {
      const response = await fetch("https://hyperactive.pro/api/reports/v2", {
        "headers": {
          "accept": "application/json",
          "accept-language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
          "authorization": `Bearer ${localStorage.getItem('user')}`,
          "content-type": "application/json",
          "priority": "u=1, i",
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin"
        },
        "referrer": "https://hyperactive.pro/admin/reports/",
        "referrerPolicy": "strict-origin-when-cross-origin",
        "body": JSON.stringify({
          "clients": [],
          "departments": [],
          "projects": [],
          "tasks": [],
          "dates": [start, end],
          "users": [],
          "userTitles": [],
          "groupId": 0
        }),
        "method": "POST",
        "mode": "cors",
        "credentials": "include"
      });

      const data = await response.json();
      let totalBillable = 0;

      if (data.success && Array.isArray(data.data)) {
        data.data.forEach(client => {
          totalBillable += parseInt(client.billable_time, 10);
        });
      }

      return totalBillable; // Dakika cinsinden
    } catch (error) {
      console.error("Fetch hatası:", error);
      return 0;
    }
  };

  const convertMinutesToHours = (minutes) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs} saat ${mins} dakika`;
  };

  // Tarih Hesaplama Fonksiyonları
  const getCurrentMonthRange = () => {
    const now = new Date();
    return getUnixTimestamps(now.getFullYear(), now.getMonth(), 1, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
  };

  const getPreviousMonthRange = () => {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return getUnixTimestamps(prevMonth.getFullYear(), prevMonth.getMonth(), 1, new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0).getDate());
  };

  const getAllFullMonthsSince = (startYear, startMonth) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let months = [];
    let year = startYear;
    let month = startMonth;

    while (year < currentYear || (year === currentYear && month < currentMonth)) {
      const endDay = new Date(year, month + 1, 0).getDate();
      months.push(getUnixTimestamps(year, month, 1, endDay));
      month++;
      if (month > 11) {
        month = 0;
        year++;
      }
    }

    return months;
  };

  // Çizgi Grafik Çizim Fonksiyonu
  const drawChart = (monthlyData, averageHours) => {
    // Modal İçeriğini Oluşturma
    const existingModal = document.getElementById(CHART_MODAL_ID);
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = CHART_MODAL_ID;
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '84px';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.zIndex = '10000';

    const modalContent = document.createElement('div');
    modalContent.style.width = '80%';
    modalContent.style.maxWidth = '800px';
    modalContent.style.backgroundColor = '#fff';
    modalContent.style.borderRadius = '8px';
    modalContent.style.padding = '20px';
    modalContent.style.position = 'relative';

    // Kapatma Butonu
    const closeButton = document.createElement('span');
    closeButton.innerHTML = '&times;';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '10px';
    closeButton.style.right = '20px';
    closeButton.style.fontSize = '30px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.color = '#aaa';
    closeButton.addEventListener('mouseover', () => {
      closeButton.style.color = '#000';
    });
    closeButton.addEventListener('mouseout', () => {
      closeButton.style.color = '#aaa';
    });
    closeButton.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    // Başlık
    const title = document.createElement('h2');
    title.textContent = 'Çalışma Saatleri Grafiği';
    title.style.textAlign = 'center';
    title.style.marginBottom = '20px';

    // Canvas
    const canvas = document.createElement('canvas');
    canvas.id = CHART_CANVAS_ID;
    canvas.width = 700;
    canvas.height = 400;

    modalContent.appendChild(closeButton);
    modalContent.appendChild(title);
    modalContent.appendChild(canvas);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Chart.js ile Grafik Oluşturma
    const ctx = canvas.getContext('2d');

    const labels = monthlyData.map(data => data.month);
    const dataValues = monthlyData.map(data => parseFloat(data.hours));

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Çalışma Saatleri',
            data: dataValues,
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgb(54, 162, 235)',
            fill: false,
            tension: 0.4,
            pointBackgroundColor: '#007BFF',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: '#007BFF',
          },
          {
            label: 'Ortalama Çalışma Saatleri',
            data: Array(dataValues.length).fill(averageHours),
            borderColor: 'rgb(255, 55, 132)', 
            backgroundColor: 'rgb(255, 55, 132,0)',
            borderDash: [10, 5],
            fill: false,
            tension: 0.4,
          },
          {
            label: 'Hedef Saat',
            data: Array(dataValues.length).fill(120), // Target hours: 120
            borderColor: 'rgb(143, 190, 0)', // İstediğiniz renge göre ayarlayabilirsiniz
            backgroundColor: 'rgb(143, 190, 0,0)',
            fill: false,
            tension: 0.4,
            borderDash: [5, 5], // Kesikli çizgi için
          }
          
        ]
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ${context.parsed.y} saat`;
              }
            }
          },
          legend: {
            display: true,
            position: 'top',
          },
          datalabels: {
            backgroundColor: function(context) {
              return context.dataset.backgroundColor;
            },
            borderRadius: 4,
            color: 'white',
            font: {
              weight: 'bold'
            },
            formatter: Math.round,
            padding: 6
          },
        },
        layout: {
          padding: {
            top: 32,
            right: 16,
            bottom: 16,
            left: 8
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Çalışma Saatleri (saat)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Aylar'
            }
          }
        }
      },
      plugins: [ChartDataLabels] // Plugin'i ekleyin (Opsiyonel)
    });
  };

  // Bilgi Kutusunu ve Grafik İkonunu Oluşturma
  const createInfoAndIconContainer = () => {
    // Eğer zaten mevcutsa, tekrar oluşturma
    if (document.getElementById(INFO_CONTAINER_ID)) return;

    // Check if timesheet-card exists first - early return if not
    const timesheetCardCheck = document.querySelector('.timesheet-card');
    if (!timesheetCardCheck) {
      return; // Page not ready, elements not loaded yet
    }

    const infoContainer = document.createElement('div');
    infoContainer.id = INFO_CONTAINER_ID;
    infoContainer.style.position = 'absolute';
    infoContainer.style.top = '-5px';
    infoContainer.style.left = '10px';
    infoContainer.style.padding = '10px';
    infoContainer.style.borderRadius = '5px';
    infoContainer.style.display = 'flex';
    infoContainer.style.gap = '12px';
    infoContainer.style.color = '#7367f0';
    infoContainer.style.zIndex = '1000';
    // Bilgi İçeriği
    const infoHTML = `
      <p><strong>Bu Ay:</strong> Yükleniyor...</p>
      <p><strong>Geçen Ay:</strong> Yükleniyor...</p>
      <p><strong>Geçmiş Ayların Ortalaması:</strong> Yükleniyor...</p>
    `;
    infoContainer.innerHTML = infoHTML;

    // Grafik İkonu (SVG Kullanarak)
    const chartIcon = document.createElement('div');
    chartIcon.id = CHART_ICON_ID;
    chartIcon.innerHTML = `
    <svg viewBox="64 64 896 896" focusable="false" data-icon="bar-chart" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M888 792H200V168c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v688c0 4.4 3.6 8 8 8h752c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8zm-600-80h56c4.4 0 8-3.6 8-8V560c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v144c0 4.4 3.6 8 8 8zm152 0h56c4.4 0 8-3.6 8-8V384c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v320c0 4.4 3.6 8 8 8zm152 0h56c4.4 0 8-3.6 8-8V462c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v242c0 4.4 3.6 8 8 8zm152 0h56c4.4 0 8-3.6 8-8V304c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v400c0 4.4 3.6 8 8 8z"></path></svg>
    `;
   
    chartIcon.style.position = 'fixed';
    chartIcon.style.top = '5px';
    chartIcon.style.right = '10px';
    chartIcon.style.width = '24px';
    chartIcon.style.height = '24px';
    chartIcon.style.cursor = 'pointer';
    chartIcon.style.zIndex = '1000';
    chartIcon.style.display= "flex";
    chartIcon.style.justifyContent= "center";
    chartIcon.style.alignItems= "center";
    chartIcon.style.color= "white";
    chartIcon.style.borderRadius= "60px";
    chartIcon.style.background= "#4839eb";
    chartIcon.title = 'Grafiği Göster';

    // Event Listener Ekleme
    chartIcon.addEventListener('click', () => {
      const average = parseFloat(infoContainer.getAttribute('data-average'));
      const monthlyData = JSON.parse(infoContainer.getAttribute('data-monthly'));
      drawChart(monthlyData, average);
    });

    // Check if timesheet-card exists before trying to append
    const timesheetCard = document.querySelector('.timesheet-card');
    if (timesheetCard) {
      const contentWrapper = timesheetCard.closest('.content-wrapper');
      if (contentWrapper) {
        contentWrapper.appendChild(infoContainer);
      }
    }
    document.body.appendChild(chartIcon);
  };

  // Bilgi Kutusunu Güncelleme Fonksiyonu
  const updateInfoContainer = async () => {
    const infoContainer = document.getElementById(INFO_CONTAINER_ID);
    if (!infoContainer) {
      // Info container not created yet, silently return
      return;
    }

    const [currentStart, currentEnd] = getCurrentMonthRange();
    const [prevStart, prevEnd] = getPreviousMonthRange();
    
    // Son 12 tamamlanmış ayı al (şu anki ay dahil değil)
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 12, 1);
    const allMonthsRanges = getAllFullMonthsSince(startDate.getFullYear(), startDate.getMonth());

    // Verileri Getirme
    const currentBillable = await fetchBillableTime(currentStart, currentEnd);
    const previousBillable = await fetchBillableTime(prevStart, prevEnd);

    // Geçmiş Ayların Ortalamaını Hesaplama (son 12 ay)
    let totalPastBillable = 0;
    for (const [start, end] of allMonthsRanges) {
      totalPastBillable += await fetchBillableTime(start, end);
    }
    const averagePastBillable = allMonthsRanges.length > 0 ? totalPastBillable / allMonthsRanges.length : 0;
    const averageHours = (averagePastBillable / 60).toFixed(2);

    // Bilgi Kutusunu Güncelleme
    infoContainer.innerHTML = `
      <p><strong>Bu Ay:</strong> ${convertMinutesToHours(currentBillable)}</p>
      <p><strong>Geçen Ay:</strong> ${convertMinutesToHours(previousBillable)}</p>
      <p><strong>Geçmiş Ayların Ortalaması:</strong> ${convertMinutesToHours(Math.round(averagePastBillable))}</p>
    `;

    // Son bir yılın çalışma saatlerini al
    const lastYearRanges = getAllFullMonthsSince(new Date().getFullYear() - 1, new Date().getMonth() + 1); // Son 12 ay
    const monthlyData = [];

    for (const [start, end] of lastYearRanges) {
      const billable = await fetchBillableTime(start, end);
      const date = new Date(start);
      const monthName = date.toLocaleString('default', { month: 'short', year: 'numeric' });
      monthlyData.push({
        month: monthName,
        hours: (billable / 60).toFixed(2) // Saat cinsinden
      });
    }

    // Bilgileri Modal İçin Saklama
    infoContainer.setAttribute('data-average', averageHours);
    infoContainer.setAttribute('data-monthly', JSON.stringify(monthlyData));
  };

  // Bilgi Kutusunu Ekleme Fonksiyonu
  const addInfoContainer = async () => {
    // Check if timesheet-card exists first
    const timesheetCard = document.querySelector('.timesheet-card');
    if (!timesheetCard) {
      // Not on the correct page yet, elements not loaded
      return;
    }

    // Bilgi Kutusunu ve İkonu Oluştur
    createInfoAndIconContainer();

    // Bilgi Kutusunu Güncelle
    await updateInfoContainer();
  };

  // Bilgi Kutusunu Kaldırma Fonksiyonu
  const removeInfoContainer = () => {
    const infoContainer = document.getElementById(INFO_CONTAINER_ID);
    if (infoContainer && infoContainer.parentNode) {
      infoContainer.parentNode.removeChild(infoContainer);
    }

    const chartIcon = document.getElementById(CHART_ICON_ID);
    if (chartIcon && chartIcon.parentNode) {
      chartIcon.parentNode.removeChild(chartIcon);
    }

    const modal = document.getElementById(CHART_MODAL_ID);
    if (modal && modal.parentNode) {
      modal.parentNode.removeChild(modal);
    }
  };

  // Workload Sayfası İçin Fonksiyonlar
  const calculateWorkedHours = () => {
    const rows = document.querySelectorAll('.rdt_TableRow');
    let totalWorkedHours = 0;
    let totalServiceLimit = 0;
    let totalRemainingTime = 0;
    
    // Önce tüm mevcut çalışılan süre bilgilerini temizle
    const existingElements = document.querySelectorAll('.worked-hours-info');
    existingElements.forEach(element => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
    
    // Tablo başlığına "Çalışılan" bilgisi ekle
    const headerRow = document.querySelector('.rdt_TableHeadRow');
    if (headerRow) {
      const remainingTimeHeader = headerRow.querySelector('[id="column-function(e){return e.remainingTime}"]');
      if (remainingTimeHeader && !remainingTimeHeader.querySelector('.worked-hours-header')) {
        const headerText = remainingTimeHeader.querySelector('div');
        if (headerText) {
          const originalText = headerText.textContent;
          headerText.innerHTML = `${originalText} <span class="worked-hours-header" style="font-size: 12px; opacity: 0.8;">(Çalışılan)</span>`;
        }
      }
    }
    
    rows.forEach(row => {
      // Tüm hücreleri al
      const cells = row.querySelectorAll('.rdt_TableCell');
      
      // Hücrelerin içeriğini kontrol et
      if (cells.length >= 6) {
        // Service Limits (3. hücre)
        const serviceLimitCell = cells[2];
        // Remaining Time (6. hücre)
        const remainingTimeCell = cells[5];
        
        if (serviceLimitCell && remainingTimeCell) {
          try {
            // Sadece sayısal değeri almak için textContent'i temizle
            const serviceLimitText = serviceLimitCell.textContent.trim();
            const remainingTimeText = remainingTimeCell.textContent.trim();
            
            // Sayısal değerleri çıkar - regex ile sayıları bul
            const serviceLimitMatch = serviceLimitText.match(/\d+/);
            
            // Kalan süre için negatif değerleri de kontrol et
            const isNegativeRemaining = remainingTimeText.includes('-');
            const remainingTimeMatch = remainingTimeText.match(/\d+/);
            
            if (serviceLimitMatch && remainingTimeMatch) {
              const serviceLimit = parseInt(serviceLimitMatch[0], 10);
              let remainingTime = parseInt(remainingTimeMatch[0], 10);
              
              // Eğer kalan süre negatifse, değeri negatif yap
              if (isNegativeRemaining) {
                remainingTime = -remainingTime;
              }
              
              const workedHours = serviceLimit - remainingTime;
              
              // Toplamları güncelle
              totalServiceLimit += serviceLimit;
              totalRemainingTime += remainingTime;
              totalWorkedHours += workedHours;
              
              // Çalışılan süreyi kalan süre hücresine ekle
              const workedHoursElement = document.createElement('span');
              workedHoursElement.className = 'worked-hours-info';
              
              // Stil ayarları
              if (remainingTime < 0) {
                workedHoursElement.style.color = '#e83e8c'; // Pembe renk
              } else {
                workedHoursElement.style.color = '#4839eb'; // Mavi renk
              }
              
              workedHoursElement.style.marginLeft = '5px';
              workedHoursElement.style.fontSize = '12px';
              workedHoursElement.textContent = `(${workedHours})`;
              
              // Kalan süre hücresindeki bold elementi bul
              const boldElement = remainingTimeCell.querySelector('b');
              if (boldElement) {
                boldElement.appendChild(workedHoursElement);
              } else {
                remainingTimeCell.appendChild(workedHoursElement);
              }
            }
          } catch (error) {
            // Hata durumunda sessizce devam et
          }
        }
      }
    });
    
    return {
      totalWorkedHours,
      totalServiceLimit,
      totalRemainingTime
    };
  };

  const addWorkloadInfo = () => {
    // Eğer zaten varsa kaldır
    removeWorkloadInfo();
    
    // Toplam çalışılan süreyi hesapla
    const { totalWorkedHours, totalServiceLimit, totalRemainingTime } = calculateWorkedHours();
    
    // Bilgi kutusunu oluştur
    const infoContainer = document.createElement('div');
    infoContainer.id = WORKLOAD_INFO_ID;
    infoContainer.style.padding = '15px';
    infoContainer.style.margin = '10px 0';
    infoContainer.style.backgroundColor = '#f8f8f8';
    infoContainer.style.borderRadius = '5px';
    infoContainer.style.border = '1px solid #e0e0e0';
    infoContainer.style.color = '#333';
    infoContainer.style.fontWeight = 'bold';
    infoContainer.style.fontSize = '16px';
    
    // Bilgi içeriği için container
    const contentContainer = document.createElement('div');
    contentContainer.style.display = 'flex';
    contentContainer.style.justifyContent = 'space-between';
    contentContainer.style.alignItems = 'center';
    contentContainer.style.flexWrap = 'wrap';
    contentContainer.style.gap = '15px';
    
    // Tamamlanma yüzdesi
    const completionRate = Math.round((totalWorkedHours / totalServiceLimit) * 100);
    
    // Bilgi kartları
    const createInfoCard = (title, value, color, icon = null) => {
      const card = document.createElement('div');
      card.style.padding = '10px 15px';
      card.style.borderRadius = '4px';
      card.style.backgroundColor = 'white';
      card.style.border = `1px solid ${color}`;
      card.style.minWidth = '180px';
      card.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
      
      const titleElement = document.createElement('div');
      titleElement.style.fontSize = '12px';
      titleElement.style.color = '#666';
      titleElement.style.marginBottom = '5px';
      titleElement.textContent = title;
      
      const valueElement = document.createElement('div');
      valueElement.style.fontSize = '18px';
      valueElement.style.color = color;
      valueElement.style.fontWeight = 'bold';
      valueElement.textContent = value;
      
      card.appendChild(titleElement);
      card.appendChild(valueElement);
      
      return card;
    };
    
    // Toplam çalışılan süre kartı
    const workedHoursCard = createInfoCard('Toplam Çalışılan Süre', `${totalWorkedHours} saat`, '#4839eb');
    
    // Toplam limit kartı
    const limitCard = createInfoCard('Toplam Limit', `${totalServiceLimit} saat`, '#28a745');
    
    // Toplam kalan süre kartı - renk ve mesaj duruma göre değişir
    let remainingColor = '#17a2b8'; // Varsayılan mavi
    let remainingText = `${totalRemainingTime} saat`;
    
    if (totalRemainingTime < 0) {
      remainingColor = '#e83e8c'; // Pembe
      remainingText = `${totalRemainingTime} saat (Hedefin üzerinde)`;
    }
    
    const remainingCard = createInfoCard('Toplam Kalan Süre', remainingText, remainingColor);
    
    // Tamamlanma yüzdesi kartı
    let completionColor = '#17a2b8'; // Varsayılan mavi
    
    if (completionRate >= 100) {
      completionColor = '#28a745'; // Yeşil
    } else if (completionRate >= 75) {
      completionColor = '#ffc107'; // Sarı
    } else if (completionRate >= 50) {
      completionColor = '#fd7e14'; // Turuncu
    } else {
      completionColor = '#dc3545'; // Kırmızı
    }
    
    const completionCard = createInfoCard('Tamamlanma Oranı', `%${completionRate}`, completionColor);
    
    // Kartları container'a ekle
    contentContainer.appendChild(workedHoursCard);
    contentContainer.appendChild(limitCard);
    contentContainer.appendChild(remainingCard);
    contentContainer.appendChild(completionCard);
    
    infoContainer.appendChild(contentContainer);
    
    // Tablonun üstüne ekle
    const tableHeader = document.querySelector('.sc-idXgbr');
    if (tableHeader && tableHeader.parentNode) {
      tableHeader.parentNode.insertBefore(infoContainer, tableHeader.nextSibling);
    }
  };

  const removeWorkloadInfo = () => {
    // Bilgi kutusunu kaldır
    const infoContainer = document.getElementById(WORKLOAD_INFO_ID);
    if (infoContainer && infoContainer.parentNode) {
      infoContainer.parentNode.removeChild(infoContainer);
    }
    
    // Satır sonlarındaki çalışılan süre bilgilerini kaldır
    const workedHoursElements = document.querySelectorAll('.worked-hours-info');
    workedHoursElements.forEach(element => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
  };

  // Add Reports link to navbar
  const addReportsLink = () => {
    // Check if Reports link already exists
    if (document.getElementById(REPORTS_LINK_ID)) {
      return;
    }

    // Find the navigation menu
    const navigation = document.querySelector('.navigation.navigation-main');
    if (!navigation) {
      return;
    }

    // Find Workload menu item
    const workloadLink = Array.from(navigation.querySelectorAll('.nav-item a')).find(
      a => a.getAttribute('href') === '/workload'
    );

    if (!workloadLink || !workloadLink.parentElement) {
      return;
    }

    // Create Reports menu item
    const reportsItem = document.createElement('li');
    reportsItem.className = 'nav-item';
    reportsItem.id = REPORTS_LINK_ID;

    reportsItem.innerHTML = `
      <a href="/reports" class="d-flex justify-content-start">
        <div class="menu-text">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <span class="menu-item menu-title">Reports</span>
        </div>
      </a>
    `;

    // Insert Reports link after Workload
    const workloadItem = workloadLink.parentElement;
    workloadItem.parentNode.insertBefore(reportsItem, workloadItem.nextSibling);
  };

  // Update active state of navigation links
  const updateActiveNavLink = () => {
    const currentURL = window.location.href;
    const navigation = document.querySelector('.navigation.navigation-main');
    
    if (!navigation) {
      return;
    }

    // Get all nav items
    const navItems = navigation.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
      const link = item.querySelector('a');
      if (!link) return;
      
      const href = link.getAttribute('href');
      
      // Check if current page matches this link
      if (href && (currentURL.includes(href) || window.location.pathname === href)) {
        // Add active class
        item.classList.add('active');
      } else {
        // Remove active class
        item.classList.remove('active');
      }
    });
  };

  // URL Takip Fonksiyonu
  const trackURL = () => {
    const currentURL = window.location.href;
    const isTimePage = currentURL.includes('https://hyperactive.pro/time');
    const isWorkloadPage = currentURL.includes('https://hyperactive.pro/workload');

    // Add Reports link to navbar (works on all pages)
    addReportsLink();
    
    // Update active state for all navigation links
    updateActiveNavLink();

    // Time sayfasında
    if (isTimePage) {
      if (!document.getElementById(INFO_CONTAINER_ID)) {
        addInfoContainer();
      }
      removeWorkloadInfo();
    } 
    // Workload sayfasında
    else if (isWorkloadPage) {
      removeInfoContainer();
      addWorkloadInfo();
    } 
    // Diğer sayfalarda
    else {
      removeInfoContainer();
      removeWorkloadInfo();
    }
  };

  // İlk Kontrol
  trackURL();

  // Interval ile URL'yi Takip Et
  setInterval(trackURL, CHECK_INTERVAL);
})();
