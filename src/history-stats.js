/**
 * Module: Transcript History & Statistics
 * Single Responsibility: Renders local speech dictation history cards,
 * calculates time saved metrics, and plots SVG usage/activity graphs (heatmap, daily/hourly charts).
 */

import { t, getLanguage } from './i18n.js';
import { ToastManager } from './toast.js';
import { showCustomConfirmModal } from './model.js';

export function formatDatePl(timestamp) {
  const months = [
    "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
    "lipca", "sierpnia", "września", "października", "listopada", "grudnia"
  ];
  const d = new Date(timestamp);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatTime(timestamp) {
  const d = new Date(timestamp);
  const pad = (n) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderHistoryUI() {
  const historyList = JSON.parse(localStorage.getItem('transcript_history') || '[]');
  
  // 1. Render Dashboard Recent History Card (Last 3)
  const dashboardContainer = document.getElementById('dashboard-history-list');
  if (dashboardContainer) {
    if (historyList.length === 0) {
      dashboardContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 13px; font-style: italic;">${t('dash.no_history')}</div>`;
    } else {
      dashboardContainer.innerHTML = '';
      const recent = historyList.slice(0, 3);
      recent.forEach(entry => {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.padding = '8px 12px';
        item.style.background = 'rgba(255, 255, 255, 0.03)';
        item.style.borderRadius = '6px';
        item.style.fontSize = '13px';
        item.style.gap = '10px';
        
        const timeStr = formatTime(entry.timestamp);
        
        item.innerHTML = `
          <div style="flex: 1; display: flex; flex-direction: column; gap: 4px; overflow: hidden;">
            <span style="font-size: 11px; color: var(--text-muted);">${timeStr}</span>
            <span style="color: var(--text-secondary); text-overflow: ellipsis; white-space: nowrap; overflow: hidden; font-family: 'Inter', sans-serif;">${entry.text}</span>
          </div>
          <button class="btn-copy-history" data-text="${encodeURIComponent(entry.text)}" style="background: none; border: none; cursor: pointer; color: var(--accent-green); padding: 4px; display: flex; align-items: center; justify-content: center;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          </button>
        `;
        dashboardContainer.appendChild(item);
      });
      
      dashboardContainer.querySelectorAll('.btn-copy-history').forEach(btn => {
        btn.onclick = (e) => {
          const btnEl = e.currentTarget;
          const text = decodeURIComponent(btnEl.getAttribute('data-text'));
          navigator.clipboard.writeText(text);
          ToastManager.show({ type: 'success', title: t('toast.copied_title'), message: t('toast.copied_msg') });
        };
      });
    }
  }

  // 2. Render History Page List
  const pageContainer = document.getElementById('history-container');
  if (pageContainer) {
    if (historyList.length === 0) {
      pageContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 14px; font-style: italic;">${t('history.empty')}</div>`;
      return;
    }

    const groups = {};
    historyList.forEach(entry => {
      const dateStr = formatDatePl(entry.timestamp);
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(entry);
    });

    pageContainer.innerHTML = '';
    
    Object.keys(groups).forEach(dateStr => {
      const groupEl = document.createElement('div');
      groupEl.style.display = 'flex';
      groupEl.style.flexDirection = 'column';
      groupEl.style.gap = '12px';
      
      const title = document.createElement('div');
      title.style.fontSize = '16px';
      title.style.fontWeight = '700';
      title.style.color = 'var(--text-primary)';
      title.style.fontFamily = "'Space Grotesk', sans-serif";
      title.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
      title.style.paddingBottom = '6px';
      title.style.marginTop = '10px';
      title.textContent = dateStr;
      groupEl.appendChild(title);
      
      const itemsContainer = document.createElement('div');
      itemsContainer.style.display = 'flex';
      itemsContainer.style.flexDirection = 'column';
      itemsContainer.style.gap = '10px';
      
      const collapsedContainer = document.createElement('div');
      collapsedContainer.style.display = 'none';
      collapsedContainer.style.flexDirection = 'column';
      collapsedContainer.style.gap = '10px';
      
      const transcripts = groups[dateStr];
      const maxVisible = 5;
      
      transcripts.forEach((entry, idx) => {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.padding = '12px 16px';
        item.style.background = 'rgba(255, 255, 255, 0.02)';
        item.style.border = '1px solid rgba(255, 255, 255, 0.04)';
        item.style.borderRadius = '8px';
        item.style.gap = '16px';
        
        const timeStr = formatTime(entry.timestamp);
        
        item.innerHTML = `
          <div style="flex: 1; display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 12px; font-weight: 700; color: var(--accent-green); font-family: 'Space Grotesk', sans-serif;">${timeStr}</span>
            </div>
            <div style="color: var(--text-secondary); font-size: 14px; line-height: 1.5; font-family: 'Inter', sans-serif;">${entry.text}</div>
          </div>
          <button class="btn-copy-history-page" data-text="${encodeURIComponent(entry.text)}" style="padding: 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; cursor: pointer; color: var(--text-secondary); transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.08)'; this.style.color='var(--accent-green)'" onmouseout="this.style.background='rgba(255,255,255,0.03)'; this.style.color='var(--text-secondary)'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          </button>
        `;
        
        if (idx < maxVisible) {
          itemsContainer.appendChild(item);
        } else {
          collapsedContainer.appendChild(item);
        }
      });
      
      groupEl.appendChild(itemsContainer);
      
      if (transcripts.length > maxVisible) {
        groupEl.appendChild(collapsedContainer);
        
        const toggleBtn = document.createElement('button');
        toggleBtn.style.alignSelf = 'flex-start';
        toggleBtn.style.background = 'none';
        toggleBtn.style.border = 'none';
        toggleBtn.style.color = 'var(--text-muted)';
        toggleBtn.style.fontSize = '13px';
        toggleBtn.style.cursor = 'pointer';
        toggleBtn.style.padding = '4px 8px';
        toggleBtn.style.marginTop = '4px';
        toggleBtn.style.fontWeight = '600';
        toggleBtn.style.display = 'flex';
        toggleBtn.style.alignItems = 'center';
        toggleBtn.style.gap = '4px';
        toggleBtn.textContent = t('history.show_more', { count: transcripts.length - maxVisible });
        
        toggleBtn.onclick = () => {
          if (collapsedContainer.style.display === 'none') {
            collapsedContainer.style.display = 'flex';
            toggleBtn.textContent = t('history.hide');
          } else {
            collapsedContainer.style.display = 'none';
            toggleBtn.textContent = t('history.show_more', { count: transcripts.length - maxVisible });
          }
        };
        groupEl.appendChild(toggleBtn);
      }
      
      pageContainer.appendChild(groupEl);
    });

    pageContainer.querySelectorAll('.btn-copy-history-page').forEach(btn => {
      btn.onclick = (e) => {
        const btnEl = e.currentTarget;
        const text = decodeURIComponent(btnEl.getAttribute('data-text'));
        navigator.clipboard.writeText(text);
        ToastManager.show({ type: 'success', title: t('toast.copied_title'), message: t('toast.copied_msg') });
      };
    });
  }
}

export function renderStatsPage() {
  const currentLanguage = getLanguage();
  let historyList = [];
  try {
    historyList = JSON.parse(localStorage.getItem('transcript_history') || '[]');
  } catch (e) {
    console.error('Failed to parse transcript history for stats:', e);
  }

  const noDataEl = document.getElementById('stats-no-data');
  const dashboardEl = document.getElementById('stats-dashboard');

  if (!noDataEl || !dashboardEl) return;

  noDataEl.style.display = 'none';
  dashboardEl.style.display = 'flex';

  let totalWords = 0;
  historyList.forEach(entry => {
    const text = entry.text || '';
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    totalWords += words.length;
  });

  const sortedHistory = [...historyList].sort((a, b) => a.timestamp - b.timestamp);
  let sessionsCount = 0;
  let lastTimestamp = 0;
  const SESSION_GAP_MS = 30 * 60 * 1000;

  sortedHistory.forEach(entry => {
    if (lastTimestamp === 0 || (entry.timestamp - lastTimestamp) >= SESSION_GAP_MS) {
      sessionsCount++;
    }
    lastTimestamp = entry.timestamp;
  });

  const totalDictations = historyList.length;
  const avgWordsPerUtterance = totalDictations > 0 ? Math.round(totalWords / totalDictations) : 0;

  const savedTimeSec = totalWords * (11 / 600) * 60;
  let timeSavedStr = '-';
  if (totalDictations === 0) {
    timeSavedStr = '0s';
  } else if (savedTimeSec < 60) {
    timeSavedStr = `${Math.round(savedTimeSec)}s`;
  } else if (savedTimeSec < 3600) {
    const mins = Math.floor(savedTimeSec / 60);
    const secs = Math.round(savedTimeSec % 60);
    timeSavedStr = `${mins}m ${secs}s`;
  } else {
    const hrs = Math.floor(savedTimeSec / 3600);
    const mins = Math.floor((savedTimeSec % 3600) / 60);
    timeSavedStr = `${hrs}h ${mins}m`;
  }

  document.getElementById('stats-val-dictations').textContent = totalDictations;
  document.getElementById('stats-val-words').textContent = totalWords;
  document.getElementById('stats-val-sessions').textContent = sessionsCount;
  document.getElementById('stats-val-avg-length').textContent = avgWordsPerUtterance;
  document.getElementById('stats-val-time-saved').textContent = timeSavedStr;

  renderHeatmap(historyList, currentLanguage);
  renderDailyWordsChart(historyList, currentLanguage);
  renderHourlyActivityChart(historyList, currentLanguage);
  renderWordFrequency(historyList, currentLanguage);
}

export function renderHeatmap(historyList, currentLanguage) {
  const gridContainer = document.getElementById('stats-heatmap-grid');
  const monthsContainer = document.getElementById('heatmap-months-labels');
  if (!gridContainer || !monthsContainer) return;

  gridContainer.innerHTML = '';
  monthsContainer.innerHTML = '';

  const today = new Date();
  const todayDay = today.getDay();
  const daysToSunday = todayDay === 0 ? 0 : 7 - todayDay;
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + daysToSunday);

  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 370);

  const dateMap = new Map();
  historyList.forEach(entry => {
    const d = new Date(entry.timestamp);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
  });

  let current = new Date(startDate);
  const cells = [];
  while (current <= endDate) {
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const count = dateMap.get(dateStr) || 0;
    cells.push({
      date: new Date(current),
      dateStr,
      count
    });
    current.setDate(current.getDate() + 1);
  }

  let lastMonth = -1;
  for (let w = 0; w < 53; w++) {
    const weekMonday = new Date(startDate.getTime() + w * 7 * 24 * 60 * 60 * 1000);
    const month = weekMonday.getMonth();
    if (month !== lastMonth) {
      const span = document.createElement('span');
      span.textContent = weekMonday.toLocaleDateString(currentLanguage, { month: 'short' });
      span.style.gridColumnStart = w + 1;
      monthsContainer.appendChild(span);
      lastMonth = month;
    }
  }

  cells.forEach(cell => {
    const div = document.createElement('div');
    div.className = 'contrib-cell';

    const isFuture = new Date(cell.date.getFullYear(), cell.date.getMonth(), cell.date.getDate()).getTime() > new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

    if (isFuture) {
      div.classList.add('future');
    } else {
      let lvl = 0;
      if (cell.count === 1) lvl = 1;
      else if (cell.count >= 2 && cell.count <= 3) lvl = 2;
      else if (cell.count >= 4 && cell.count <= 5) lvl = 3;
      else if (cell.count >= 6) lvl = 4;
      div.classList.add(`lvl-${lvl}`);

      const formattedDate = cell.date.toLocaleDateString(currentLanguage, { month: 'short', day: 'numeric', year: 'numeric' });
      let tooltipText = '';
      if (cell.count === 0) {
        tooltipText = currentLanguage === 'pl' ? `Brak aktywności w dniu ${formattedDate}` : `No activity on ${formattedDate}`;
      } else {
        let countLabel = '';
        if (currentLanguage === 'pl') {
          if (cell.count === 1) countLabel = '1 dyktowanie';
          else {
            const mod10 = cell.count % 10;
            const mod100 = cell.count % 100;
            let suffix = 'dyktowań';
            if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
              suffix = 'dyktowania';
            }
            countLabel = `${cell.count} ${suffix}`;
          }
          tooltipText = `${countLabel} w dniu ${formattedDate}`;
        } else {
          countLabel = cell.count === 1 ? '1 dictation' : `${cell.count} dictations`;
          tooltipText = `${countLabel} on ${formattedDate}`;
        }
      }
      div.setAttribute('data-tooltip', tooltipText);

      div.onclick = () => {
        showDayStatsModal(cell.date, cell.count, historyList, currentLanguage);
      };
    }
    gridContainer.appendChild(div);
  });
}

export function showDayStatsModal(date, count, historyList, currentLanguage) {
  const modal = document.getElementById('day-stats-modal');
  if (!modal) return;

  const dateStr = date.toLocaleDateString(currentLanguage, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const titleEl = document.getElementById('day-stats-modal-title');
  if (titleEl) {
    titleEl.textContent = t('stats.day_stats_title', { date: dateStr });
  }

  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).getTime();
  const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime();
  const dayEntries = historyList.filter(e => e.timestamp >= startOfDay && e.timestamp <= endOfDay);

  let totalWords = 0;
  dayEntries.forEach(entry => {
    const text = entry.text || '';
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    totalWords += words.length;
  });

  const sortedDayEntries = [...dayEntries].sort((a, b) => a.timestamp - b.timestamp);
  let sessionsCount = 0;
  let lastTimestamp = 0;
  const SESSION_GAP_MS = 30 * 60 * 1000;
  sortedDayEntries.forEach(entry => {
    if (lastTimestamp === 0 || (entry.timestamp - lastTimestamp) >= SESSION_GAP_MS) {
      sessionsCount++;
    }
    lastTimestamp = entry.timestamp;
  });

  const totalDictations = dayEntries.length;
  const avgWordsPerUtterance = totalDictations > 0 ? Math.round(totalWords / totalDictations) : 0;
  const savedTimeSec = totalWords * (11 / 600) * 60;
  let timeSavedStr = '-';
  if (totalDictations === 0) {
    timeSavedStr = '0s';
  } else if (savedTimeSec < 60) {
    timeSavedStr = `${Math.round(savedTimeSec)}s`;
  } else if (savedTimeSec < 3600) {
    const mins = Math.floor(savedTimeSec / 60);
    const secs = Math.round(savedTimeSec % 60);
    timeSavedStr = `${mins}m ${secs}s`;
  } else {
    const hrs = Math.floor(savedTimeSec / 3600);
    const mins = Math.floor((savedTimeSec % 3600) / 60);
    timeSavedStr = `${hrs}h ${mins}m`;
  }

  document.getElementById('day-stats-val-dictations').textContent = totalDictations;
  document.getElementById('day-stats-val-words').textContent = totalWords;
  document.getElementById('day-stats-val-sessions').textContent = sessionsCount;
  document.getElementById('day-stats-val-avg-length').textContent = avgWordsPerUtterance;
  document.getElementById('day-stats-val-time-saved').textContent = timeSavedStr;

  const listContainer = document.getElementById('day-stats-dictations-list');
  if (listContainer) {
    listContainer.innerHTML = '';
    if (dayEntries.length === 0) {
      listContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 12px; font-style: italic; text-align: center; padding: 10px 0;">${t('stats.day_no_dictations')}</div>`;
    } else {
      sortedDayEntries.forEach(entry => {
        const timeStr = new Date(entry.timestamp).toLocaleTimeString(currentLanguage, { hour: '2-digit', minute: '2-digit' });
        const item = document.createElement('div');
        item.style.borderBottom = '1px solid var(--border-subtle)';
        item.style.padding = '8px 0';
        item.style.display = 'flex';
        item.style.flexDirection = 'column';
        item.style.gap = '4px';

        item.innerHTML = `
          <div style="font-size: 11px; font-weight: 700; color: var(--accent-green);">${timeStr}</div>
          <div style="font-size: 13px; color: var(--text-primary); white-space: pre-wrap; word-break: break-word; line-height: 1.4;">${escapeHtml(entry.text)}</div>
        `;
        listContainer.appendChild(item);
      });
    }
  }

  modal.style.display = 'flex';
}

export function renderDailyWordsChart(historyList, currentLanguage) {
  const container = document.getElementById('chart-daily-words');
  if (!container) return;

  const today = new Date();
  const dailyWords = [];
  const dayNames = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();

    const dayEntries = historyList.filter(e => e.timestamp >= start && e.timestamp <= end);
    let wordCount = 0;
    dayEntries.forEach(e => {
      const text = e.text || '';
      wordCount += text.trim().split(/\s+/).filter(w => w.length > 0).length;
    });

    dailyWords.push(wordCount);
    dayNames.push(d.toLocaleDateString(currentLanguage, { weekday: 'short' }));
  }

  const maxVal = Math.max(...dailyWords, 50);
  const svgWidth = 400;
  const svgHeight = 200;
  const topMargin = 20;
  const bottomMargin = 30;
  const leftMargin = 40;
  const rightMargin = 15;

  const chartWidth = svgWidth - leftMargin - rightMargin;
  const chartHeight = svgHeight - topMargin - bottomMargin;

  const numDays = dailyWords.length;
  const barWidth = 24;
  const gap = (chartWidth - (numDays * barWidth)) / (numDays - 1);

  let gridHTML = '';
  [0, 0.5, 1].forEach(ratio => {
    const y = topMargin + chartHeight * (1 - ratio);
    const val = Math.round(ratio * maxVal);
    gridHTML += `
      <line x1="${leftMargin}" y1="${y}" x2="${svgWidth - rightMargin}" y2="${y}" stroke="var(--border-subtle)" stroke-width="1" stroke-dasharray="3,3" />
      <text x="${leftMargin - 8}" y="${y + 4}" fill="var(--text-muted)" font-size="9" text-anchor="end">${val}</text>
    `;
  });

  let barsHTML = '';
  for (let i = 0; i < numDays; i++) {
    const x = leftMargin + i * (barWidth + gap);
    const val = dailyWords[i];
    const barHeight = (val / maxVal) * chartHeight;
    const y = topMargin + chartHeight - barHeight;

    let path = '';
    if (barHeight > 0) {
      const r = Math.min(6, barHeight);
      path = `
        <path d="
          M ${x},${y + barHeight} 
          L ${x},${y + r} 
          A ${r},${r} 0 0,1 ${x + r},${y} 
          L ${x + barWidth - r},${y} 
          A ${r},${r} 0 0,1 ${x + barWidth},${y + r} 
          L ${x + barWidth},${y + barHeight} 
          Z" 
          fill="url(#statsBarGrad)"
          class="chart-bar"
        >
          <title>${getWordLabel(val, currentLanguage)}</title>
        </path>
      `;
    }

    const valLabel = val > 0 ? `<text x="${x + barWidth/2}" y="${y - 4}" fill="var(--text-secondary)" font-size="9" text-anchor="middle">${val}</text>` : '';
    const dayLabel = `<text x="${x + barWidth/2}" y="${topMargin + chartHeight + 18}" fill="var(--text-muted)" font-size="10" text-anchor="middle">${dayNames[i]}</text>`;

    barsHTML += path + dayLabel + valLabel;
  }

  container.innerHTML = `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: 100%; overflow: visible;">
      <defs>
        <linearGradient id="statsBarGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent-green)" stop-opacity="0.8" />
          <stop offset="100%" stop-color="var(--accent-green)" stop-opacity="0.1" />
        </linearGradient>
      </defs>
      ${gridHTML}
      ${barsHTML}
    </svg>
  `;
}

export function getWordLabel(val, lang) {
  if (lang !== 'pl') {
    return `${val} ${val === 1 ? 'word' : 'words'}`;
  }
  if (val === 1) return '1 słowo';
  const mod10 = val % 10;
  const mod100 = val % 100;
  let suffix = 'słów';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    suffix = 'słowa';
  }
  return `${val} ${suffix}`;
}

export function renderHourlyActivityChart(historyList, currentLanguage) {
  const container = document.getElementById('chart-hourly-activity');
  if (!container) return;

  const hourlyActivity = Array(24).fill(0);
  historyList.forEach(e => {
    const d = new Date(e.timestamp);
    hourlyActivity[d.getHours()]++;
  });

  const maxVal = Math.max(...hourlyActivity, 5);
  const svgWidth = 400;
  const svgHeight = 200;
  const topMargin = 20;
  const bottomMargin = 30;
  const leftMargin = 30;
  const rightMargin = 15;

  const chartWidth = svgWidth - leftMargin - rightMargin;
  const chartHeight = svgHeight - topMargin - bottomMargin;

  let points = [];
  for (let h = 0; h < 24; h++) {
    const x = leftMargin + (h / 23) * chartWidth;
    const y = topMargin + chartHeight - (hourlyActivity[h] / maxVal) * chartHeight;
    points.push({ x, y, val: hourlyActivity[h], hour: h });
  }

  const lineD = 'M ' + points.map(p => `${p.x},${p.y}`).join(' L ');
  const fillD = lineD + ` L ${points[23].x},${topMargin + chartHeight} L ${points[0].x},${topMargin + chartHeight} Z`;

  let dotsHTML = '';
  points.forEach(p => {
    const isData = p.val > 0;
    dotsHTML += `
      <circle id="hourly-dot-${p.hour}" cx="${p.x}" cy="${p.y}" r="3.5" fill="var(--accent-green)" class="chart-dot" style="opacity: ${isData ? '1' : '0'};" />
    `;
  });

  let gridHTML = '';
  [0, 0.5, 1].forEach(ratio => {
    const y = topMargin + chartHeight * (1 - ratio);
    const val = Math.round(ratio * maxVal);
    gridHTML += `
      <line x1="${leftMargin}" y1="${y}" x2="${svgWidth - rightMargin}" y2="${y}" stroke="var(--border-subtle)" stroke-width="1" stroke-dasharray="3,3" />
      <text x="${leftMargin - 8}" y="${y + 4}" fill="var(--text-muted)" font-size="9" text-anchor="end">${val}</text>
    `;
  });

  let xLabelsHTML = '';
  const keyHours = [0, 4, 8, 12, 16, 20, 23];
  keyHours.forEach(h => {
    const x = leftMargin + (h / 23) * chartWidth;
    xLabelsHTML += `
      <text x="${x}" y="${topMargin + chartHeight + 18}" fill="var(--text-muted)" font-size="9" text-anchor="middle">${h}:00</text>
      <line x1="${x}" y1="${topMargin}" x2="${x}" y2="${topMargin + chartHeight}" stroke="var(--border-subtle)" stroke-width="1" stroke-opacity="0.15" stroke-dasharray="2,2" />
    `;
  });

  container.innerHTML = `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: 100%; overflow: visible;">
      <defs>
        <linearGradient id="statsAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent-green)" stop-opacity="0.3" />
          <stop offset="100%" stop-color="var(--accent-green)" stop-opacity="0.0" />
        </linearGradient>
      </defs>
      ${gridHTML}
      <line id="hourly-hover-line" class="chart-hover-line" x1="0" y1="${topMargin}" x2="0" y2="${topMargin + chartHeight}" style="display: none;" />
      <path d="${fillD}" fill="url(#statsAreaGrad)" />
      <path d="${lineD}" fill="none" stroke="var(--accent-green)" stroke-width="2" />
      ${dotsHTML}
      ${xLabelsHTML}
    </svg>
  `;

  const svgEl = container.querySelector('svg');
  const tooltipEl = document.getElementById('hourly-chart-tooltip');
  const hoverLine = container.querySelector('#hourly-hover-line');

  if (svgEl && tooltipEl) {
    svgEl.onmousemove = (e) => {
      const rect = svgEl.getBoundingClientRect();
      const clientX = e.clientX;
      const clientY = e.clientY;

      const relativeX = (clientX - rect.left) * (svgWidth / rect.width);
      const chartX = relativeX - leftMargin;

      let h = Math.round((chartX / chartWidth) * 23);
      h = Math.max(0, Math.min(23, h));

      for (let i = 0; i < 24; i++) {
        const dot = container.querySelector(`#hourly-dot-${i}`);
        if (dot) {
          if (i === h) {
            dot.classList.add('active');
            dot.style.opacity = '1';
            dot.setAttribute('r', '5.5');
          } else {
            dot.classList.remove('active');
            dot.style.opacity = hourlyActivity[i] > 0 ? '1' : '0';
            dot.setAttribute('r', '3.5');
          }
        }
      }

      const targetX = leftMargin + (h / 23) * chartWidth;
      if (hoverLine) {
        hoverLine.setAttribute('x1', targetX);
        hoverLine.setAttribute('x2', targetX);
        hoverLine.style.display = 'block';
      }

      const hourEntries = historyList.filter(entry => new Date(entry.timestamp).getHours() === h);
      const totalDicts = hourEntries.length;
      let totalWords = 0;
      hourEntries.forEach(entry => {
        const words = (entry.text || '').trim().split(/\s+/).filter(w => w.length > 0);
        totalWords += words.length;
      });
      const avgWords = totalDicts > 0 ? Math.round(totalWords / totalDicts) : 0;
      const pct = historyList.length > 0 ? ((totalDicts / historyList.length) * 100).toFixed(1) : '0.0';

      tooltipEl.innerHTML = `
        <div class="tooltip-header">${h}:00 - ${(h === 23 ? 0 : h + 1)}:00</div>
        <div class="tooltip-row">
          <span class="tooltip-label">${t('stats.hourly.total_dictations')}</span>
          <span class="tooltip-value">${totalDicts}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">${t('stats.hourly.total_words')}</span>
          <span class="tooltip-value">${totalWords}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">${t('stats.hourly.avg_words')}</span>
          <span class="tooltip-value">${avgWords}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">${t('stats.hourly.activity_share')}</span>
          <span class="tooltip-value">${pct}%</span>
        </div>
      `;

      const cardRect = container.parentElement.getBoundingClientRect();
      const tooltipX = clientX - cardRect.left + 15;
      const tooltipY = clientY - cardRect.top - 10;

      tooltipEl.style.left = `${tooltipX}px`;
      tooltipEl.style.top = `${tooltipY}px`;
      tooltipEl.style.display = 'block';
    };

    svgEl.onmouseleave = () => {
      if (hoverLine) hoverLine.style.display = 'none';
      if (tooltipEl) tooltipEl.style.display = 'none';

      for (let i = 0; i < 24; i++) {
        const dot = container.querySelector(`#hourly-dot-${i}`);
        if (dot) {
          dot.classList.remove('active');
          dot.style.opacity = hourlyActivity[i] > 0 ? '1' : '0';
          dot.setAttribute('r', '3.5');
        }
      }
    };
  }
}

let wordStatsExpanded = false;

export function renderWordFrequency(historyList, currentLanguage) {
  const container = document.getElementById('stats-top-words-list');
  if (!container) return;

  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'are', 'was', 'were', 'it', 'this', 'that', 'i', 'you', 'he', 'she', 'we', 'they', 'my', 'your', 'his', 'her', 'their', 'our', 'me', 'him', 'them', 'us', 'be', 'have', 'do', 'will', 'would', 'should', 'can', 'could', 'about', 'as', 'by', 'if', 'then', 'else', 'no', 'not', 'so', 'up', 'down', 'out', 'has', 'had', 'been',
    'i', 'w', 'z', 'na', 'do', 'o', 'po', 'za', 'ze', 'a', 'ale', 'lecz', 'iż', 'że', 'bo', 'gdy', 'jak', 'tak', 'nie', 'także', 'też', 'jest', 'są', 'był', 'była', 'było', 'będzie', 'będą', 'się', 'go', 'ją', 'mu', 'jej', 'ich', 'nas', 'was', 'to', 'ten', 'ta', 'to', 'te', 'ci', 'dla', 'od', 'przez', 'pod', 'nad', 'przy', 'o', 'dla', 'ze', 'przed', 'ich', 'tylko', 'jestem', 'jesteś', 'mamy', 'macie', 'lub', 'czy', 'co', 'coś', 'kto', 'którzy', 'który', 'która', 'które', 'tam', 'tu', 'mój', 'twój', 'jego', 'jej', 'nasz', 'wasz'
  ]);

  const wordCounts = {};
  historyList.forEach(entry => {
    const text = entry.text || '';
    const clean = text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").replace(/\s+/g, " ");
    const words = clean.split(' ').filter(w => w.length > 1);
    words.forEach(w => {
      if (!stopWords.has(w)) {
        wordCounts[w] = (wordCounts[w] || 0) + 1;
      }
    });
  });

  const sortedWords = Object.entries(wordCounts)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);

  container.innerHTML = '';

  const showLimit = wordStatsExpanded ? 40 : 10;
  const topWords = sortedWords.slice(0, showLimit);

  if (topWords.length === 0) {
    container.innerHTML = `<div style="color: var(--text-muted); font-size: 13px; font-style: italic;">${
      currentLanguage === 'pl' ? 'Brak częstych słów.' : 'No frequent words found.'
    }</div>`;
    return;
  }

  topWords.forEach(item => {
    const badge = document.createElement('div');
    badge.className = 'word-badge';
    badge.innerHTML = `
      <span class="word-text">${escapeHtml(item.word)}</span>
      <span class="word-count">${item.count}x</span>
    `;
    container.appendChild(badge);
  });

  if (sortedWords.length > 10) {
    const toggleBadge = document.createElement('div');
    toggleBadge.className = 'word-badge';
    toggleBadge.style.cursor = 'pointer';
    toggleBadge.style.background = 'rgba(16, 185, 129, 0.15)';
    toggleBadge.style.borderColor = 'var(--accent-green)';
    toggleBadge.style.color = 'var(--accent-green)';
    toggleBadge.style.fontWeight = '700';
    toggleBadge.textContent = wordStatsExpanded ? t('stats.words.show_less') : t('stats.words.show_more');
    toggleBadge.onclick = () => {
      wordStatsExpanded = !wordStatsExpanded;
      renderWordFrequency(historyList, currentLanguage);
    };
    container.appendChild(toggleBadge);
  }
}

export function setupHistoryStatsEventListeners() {
  const clearHistoryBtn = document.getElementById('btn-clear-history');
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      showCustomConfirmModal({
        title: t('history.clear_confirm_title'),
        message: t('history.confirm_clear'),
        confirmText: t('history.btn.clear'),
        isDanger: true,
        onConfirm: () => {
          localStorage.removeItem('transcript_history');
          renderHistoryUI();
          renderStatsPage();
          ToastManager.show({ type: 'success', title: t('toast.history_cleared') });
        }
      });
    });
  }

  const dashboardViewHistoryBtn = document.getElementById('dashboard-view-history-btn');
  if (dashboardViewHistoryBtn) {
    dashboardViewHistoryBtn.addEventListener('click', () => {
      const navBtn = document.getElementById('nav-history');
      if (navBtn) navBtn.click();
    });
  }

  const dashboardViewStatsBtn = document.getElementById('dashboard-view-stats-btn');
  if (dashboardViewStatsBtn) {
    dashboardViewStatsBtn.addEventListener('click', () => {
      const navBtn = document.getElementById('nav-stats');
      if (navBtn) navBtn.click();
    });
  }

  const dayStatsModal = document.getElementById('day-stats-modal');
  const btnDayCloseX = document.getElementById('btn-day-stats-modal-close-x');
  const btnDayClose = document.getElementById('btn-day-stats-modal-close');
  if (dayStatsModal) {
    if (btnDayCloseX) btnDayCloseX.onclick = () => dayStatsModal.style.display = 'none';
    if (btnDayClose) btnDayClose.onclick = () => dayStatsModal.style.display = 'none';
  }
}

// Bind to window for global callbacks
window.renderHistoryUI = renderHistoryUI;
window.renderStatsPage = renderStatsPage;
