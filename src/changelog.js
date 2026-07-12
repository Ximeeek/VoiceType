/**
 * Module: Changelog & Releases Tracker
 * Single Responsibility: Fetches release logs from GitHub, parses Markdown release descriptions
 * to structured HTML, and manages the startup changelog notification modal.
 */

import { state, saveConfigState } from './state.js';
import { t, getLanguage } from './i18n.js';
import { ToastManager } from './toast.js';

let cachedReleases = null;
let activeSelectedReleaseId = null;

window.openChangelogUrl = (url) => {
  console.log('[UI] Opening changelog link in external browser:', url);
  if (window.__TAURI__) {
    window.__TAURI__.core.invoke('open_url', { url: url });
  } else {
    window.open(url, '_blank');
  }
};

export function parseMarkdownFormatting(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;br&gt;/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--text-primary); font-weight: 600;">$1</strong>')
    .replace(/`(.*?)`/g, '<code style="background: rgba(255, 255, 255, 0.08); color: var(--accent-green); padding: 1px 4px; border-radius: 4px; font-family: monospace; font-size: 11px; border: 1px solid var(--border-subtle);">$1</code>')
    .replace(/\[(.*?)\]\((.*?)\)/g, (match, linkText, url) => {
      return `<a href="#" onclick="window.openChangelogUrl('${url}'); return false;" style="color: var(--accent-green); text-decoration: none; border-bottom: 1px dashed var(--accent-green);" onmouseover="this.style.borderBottomStyle='solid'" onmouseout="this.style.borderBottomStyle='dashed'">${linkText}</a>`;
    });
}

export function renderCategoryCard(categoryName, items) {
  let listItemsHtml = '';
  items.forEach(item => {
    let cleanItem = item.replace(/^[-\*\u2022]\s+/, '').trim();
    
    let title = '';
    let desc = cleanItem;
    
    const boldMatch = cleanItem.match(/^\*\*(.*?)\*\*[:\s]*/);
    if (boldMatch) {
      title = boldMatch[1];
      desc = cleanItem.substring(boldMatch[0].length);
    }
    
    desc = parseMarkdownFormatting(desc);

    listItemsHtml += `
      <li style="font-size: 12px; line-height: 1.5; color: var(--text-secondary); display: flex; align-items: flex-start; gap: 8px;">
        <span style="color: var(--accent-green); margin-top: 2px; font-size: 10px;">✦</span>
        <div style="flex: 1;">
          ${title ? `<strong style="color: var(--text-primary); font-weight: 700;">${title}:</strong> ` : ''}${desc}
        </div>
      </li>
    `;
  });

  return `
    <div style="background: rgba(255, 255, 255, 0.015); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px; margin-bottom: 10px; display: flex; flex-direction: column; gap: 8px; transition: all 0.2s ease;">
      <div style="font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.04); padding-bottom: 6px;">
        <span style="width: 6px; height: 6px; border-radius: 50%; background: var(--accent-green); box-shadow: 0 0 6px var(--accent-green);"></span>
        ${categoryName}
      </div>
      <ul style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px;">
        ${listItemsHtml}
      </ul>
    </div>
  `;
}

export function parseChangelogToStructuredHtml(body) {
  if (!body) return '';

  const lines = body.split('\n').map(line => line.trim());

  let html = '';
  let currentCategory = null;
  let currentItems = [];
  let introLines = [];
  let footerLines = [];
  
  let inKeyChanges = false;
  let finishedCategories = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === '') continue;

    if (line.startsWith('## ') || line.startsWith('# ')) {
      if (line.toLowerCase().includes('changes') || line.toLowerCase().includes('zmian')) {
        inKeyChanges = true;
        continue;
      }
    }

    if (line.startsWith('**Licensing**') || line.toLowerCase().includes('license') || line.toLowerCase().includes('licencja')) {
      finishedCategories = true;
    }

    if (finishedCategories) {
      footerLines.push(line);
      continue;
    }

    if (!inKeyChanges) {
      introLines.push(line);
      continue;
    }

    const isHeading = line.startsWith('###');
    const isBoldHeader = line.startsWith('**') && line.endsWith('**');

    if (isHeading || isBoldHeader) {
      if (currentCategory && currentItems.length > 0) {
        html += renderCategoryCard(currentCategory, currentItems);
      }
      currentCategory = line.replace(/^###\s+/, '').replace(/^\*\text/, '').replace(/^\*\*/, '').replace(/\*\*$/, '');
      currentItems = [];
    } else if (line.startsWith('-') || line.startsWith('*')) {
      currentItems.push(line);
    } else {
      if (currentCategory) {
        currentItems.push(line);
      } else {
        introLines.push(line);
      }
    }
  }

  if (currentCategory && currentItems.length > 0) {
    html += renderCategoryCard(currentCategory, currentItems);
  }

  let introHtml = '';
  if (introLines.length > 0) {
    const processedIntro = parseMarkdownFormatting(introLines.join('<br>'));
    introHtml = `
      <div style="font-size: 12.5px; line-height: 1.55; color: var(--text-secondary); margin-bottom: 14px; padding: 10px 12px; background: rgba(57, 255, 80, 0.04); border-left: 3px solid var(--accent-green); border-radius: 6px;">
        ${processedIntro}
      </div>
    `;
  }

  let footerHtml = '';
  if (footerLines.length > 0) {
    const cleanedFooterLines = footerLines.map(line => line.replace(/^[-\*\u2022]\s+/, '').trim());
    const processedFooter = parseMarkdownFormatting(cleanedFooterLines.join('<br>'));
    footerHtml = `
      <div style="font-size: 11px; color: var(--text-muted); text-align: center; margin-top: 16px; border-top: 1px solid var(--border-subtle); padding-top: 10px; line-height: 1.4;">
        ${processedFooter}
      </div>
    `;
  }

  return introHtml + html + footerHtml;
}

export function renderReleaseDetails(release) {
  const detailsViewEl = document.getElementById('changelog-details-view');
  if (!detailsViewEl) return;

  const isPrerelease = release.prerelease;
  const publishDate = new Date(release.published_at);
  const dateStr = publishDate.toLocaleDateString(getLanguage() === 'pl' ? 'pl-PL' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const typeLabel = isPrerelease ? t('about.changelog.prerelease') : t('about.changelog.stable');
  const typeColor = isPrerelease ? '#a78bfa' : 'var(--accent-green)';
  const typeBg = isPrerelease ? 'rgba(139, 92, 246, 0.15)' : 'var(--accent-green-dim)';
  const typeBorder = isPrerelease ? 'rgba(139, 92, 246, 0.4)' : 'rgba(57, 255, 80, 0.4)';

  detailsViewEl.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 4px;">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
        <h3 style="margin: 0; font-family: 'Space Grotesk', sans-serif; font-weight: 800; font-size: 15px; color: var(--text-primary);">${release.name || release.tag_name}</h3>
        <span style="background: ${typeBg}; border: 1px solid ${typeBorder}; color: ${typeColor}; font-size: 9px; padding: 2px 8px; border-radius: 6px; font-weight: 700; text-transform: uppercase;">${typeLabel}</span>
      </div>
      <div style="font-size: 10px; color: var(--text-muted);">${dateStr}</div>
    </div>
    <hr style="border: 0; border-top: 1px solid var(--border-subtle); margin: 6px 0;">
    <div style="flex: 1; font-size: 12px; color: var(--text-secondary); line-height: 1.6; padding-right: 4px;">
      ${parseChangelogToStructuredHtml(release.body)}
    </div>
  `;
}

export function renderChangelog() {
  const versionsListEl = document.getElementById('changelog-versions-list');
  const detailsViewEl = document.getElementById('changelog-details-view');
  if (!versionsListEl || !detailsViewEl) return;

  const filterStable = document.getElementById('changelog-filter-stable')?.checked ?? true;
  const filterPre = document.getElementById('changelog-filter-pre')?.checked ?? true;

  const filtered = (cachedReleases || []).filter(rel => {
    if (rel.prerelease) return filterPre;
    return filterStable;
  });

  if (filtered.length === 0) {
    versionsListEl.innerHTML = `<div style="font-size: 11px; color: var(--text-muted); text-align: center; margin-top: 30px;" data-i18n="about.changelog.no_releases">${t('about.changelog.no_releases')}</div>`;
    detailsViewEl.innerHTML = `<div style="font-size: 12px; color: var(--text-muted); text-align: center; margin-top: 50px;" data-i18n="about.changelog.select_prompt">${t('about.changelog.select_prompt')}</div>`;
    activeSelectedReleaseId = null;
    return;
  }

  let selectTarget = null;
  if (activeSelectedReleaseId) {
    selectTarget = filtered.find(r => r.id === activeSelectedReleaseId);
  }
  if (!selectTarget) {
    const currentVer = (window.cachedVersionInfo?.version || '').replace(/^v/, '');
    selectTarget = filtered.find(r => r.tag_name.replace(/^v/, '') === currentVer) || filtered[0];
  }

  if (selectTarget) {
    activeSelectedReleaseId = selectTarget.id;
    renderReleaseDetails(selectTarget);
  }

  versionsListEl.innerHTML = '';
  filtered.forEach(rel => {
    const isCurrent = rel.tag_name.replace(/^v/, '') === (window.cachedVersionInfo?.version || '').replace(/^v/, '');
    const isActive = rel.id === activeSelectedReleaseId;
    const isPrerelease = rel.prerelease;
    const publishDate = new Date(rel.published_at);
    
    const dateStr = publishDate.toLocaleDateString(getLanguage() === 'pl' ? 'pl-PL' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    const itemEl = document.createElement('div');
    itemEl.className = `changelog-version-btn ${isActive ? 'active' : ''} ${isCurrent ? 'current' : ''}`;
    
    const typeLabel = isPrerelease ? t('about.changelog.prerelease') : t('about.changelog.stable');
    const badgeHtml = isCurrent ? `<span style="background: rgba(57, 255, 80, 0.18); border: 1px solid rgba(57, 255, 80, 0.4); color: var(--accent-green); font-size: 9px; padding: 1px 6px; border-radius: 4px; font-weight: 800; text-transform: uppercase;">${t('about.changelog.current_version')}</span>` : '';

    itemEl.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
        <span style="font-weight: 700; font-size: 12px; color: ${isActive ? 'var(--accent-green)' : 'var(--text-primary)'};">${rel.tag_name}</span>
        ${badgeHtml}
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: var(--text-secondary);">
        <span>${dateStr}</span>
        <span style="color: ${isPrerelease ? '#a78bfa' : 'var(--accent-green)'}; font-weight: 600;">${typeLabel}</span>
      </div>
    `;

    itemEl.addEventListener('click', () => {
      activeSelectedReleaseId = rel.id;
      renderReleaseDetails(rel);
      
      document.querySelectorAll('.changelog-version-btn').forEach(btn => btn.classList.remove('active'));
      itemEl.classList.add('active');
    });

    versionsListEl.appendChild(itemEl);
  });
}

export async function loadChangelog() {
  const versionsListEl = document.getElementById('changelog-versions-list');
  const detailsViewEl = document.getElementById('changelog-details-view');
  if (!versionsListEl || !detailsViewEl) return;

  if (!cachedReleases) {
    versionsListEl.innerHTML = `<div style="font-size: 12px; color: var(--text-muted); text-align: center; margin-top: 30px;" data-i18n="about.changelog.loading">${t('about.changelog.loading')}</div>`;
    detailsViewEl.innerHTML = `<div style="font-size: 12px; color: var(--text-muted); text-align: center; margin-top: 50px;" data-i18n="about.changelog.select_prompt">${t('about.changelog.select_prompt')}</div>`;

    try {
      console.log('[Changelog] Fetching releases from GitHub API...');
      const response = await fetch('https://api.github.com/repos/Ximeeek/VoiceType/releases');
      if (!response.ok) {
        throw new Error(`Failed to fetch releases: HTTP ${response.status}`);
      }
      cachedReleases = await response.json();
    } catch (err) {
      console.error('[Changelog] Error loading releases:', err);
      versionsListEl.innerHTML = `<div style="font-size: 12px; color: #ef4444; text-align: center; margin-top: 30px;" data-i18n="about.changelog.error">${t('about.changelog.error')}</div>`;
      return;
    }
  }

  renderChangelog();
}

export function showStartupChangelogModal(release) {
  const modal = document.getElementById('startup-changelog-modal');
  const subtitleEl = document.getElementById('startup-changelog-subtitle');
  const contentEl = document.getElementById('startup-changelog-content');
  const closeBtnX = document.getElementById('btn-startup-changelog-close-x');
  const closeBtn = document.getElementById('btn-startup-changelog-close');

  if (!modal || !contentEl) return;

  const versionStr = release.tag_name;
  if (subtitleEl) {
    subtitleEl.textContent = t('about.changelog.startup_subtitle', { version: versionStr });
  }

  contentEl.innerHTML = parseChangelogToStructuredHtml(release.body);
  modal.style.display = 'flex';

  const closeModalAndSave = async () => {
    modal.style.display = 'none';
    
    if (state.activeConfig && state.activeConfig.general) {
      state.activeConfig.general.last_seen_version = window.cachedVersionInfo?.version || '';
      state.pendingConfig = JSON.parse(JSON.stringify(state.activeConfig));
      try {
        if (window.__TAURI__) {
          await window.__TAURI__.core.invoke('save_config', { config: state.activeConfig });
        }
      } catch (err) {
        console.error('[Changelog Startup] Failed to save config after changelog view:', err);
      }
    }
  };

  closeBtnX.onclick = closeModalAndSave;
  closeBtn.onclick = closeModalAndSave;
}

export async function checkAndShowChangelogOnStartup() {
  if (!window.__TAURI__) return;

  const onboardingModal = document.getElementById('onboarding-modal');
  if (onboardingModal && onboardingModal.style.display !== 'none') {
    console.log('[Changelog Startup] Onboarding is active, skipping changelog check.');
    return;
  }

  try {
    const showChangelog = await window.__TAURI__.core.invoke('check_show_changelog');
    if (!showChangelog) return;

    if (!cachedReleases) {
      try {
        const response = await fetch('https://api.github.com/repos/Ximeeek/VoiceType/releases');
        if (response.ok) {
          cachedReleases = await response.json();
        }
      } catch (err) {
        console.error('[Changelog Startup] Failed to fetch releases from GitHub:', err);
      }
    }

    const currentVer = (window.cachedVersionInfo?.version || '').replace(/^v/, '');
    let release = null;
    if (cachedReleases && cachedReleases.length > 0) {
      release = cachedReleases.find(r => r.tag_name.replace(/^v/, '') === currentVer);
      if (!release && (window.cachedVersionInfo?.is_dev || currentVer === 'DEV')) {
        release = cachedReleases[0];
      }
    }

    if (release) {
      showStartupChangelogModal(release);
    }
  } catch (err) {
    console.error('[Changelog Startup] Error checking/showing changelog on startup:', err);
  }
}

export function setupChangelogEventListeners() {
  document.getElementById('changelog-filter-stable')?.addEventListener('change', () => {
    renderChangelog();
  });
  document.getElementById('changelog-filter-pre')?.addEventListener('change', () => {
    renderChangelog();
  });
}

// Bind to window for global access
window.loadChangelog = loadChangelog;
window.checkAndShowChangelogOnStartup = checkAndShowChangelogOnStartup;
