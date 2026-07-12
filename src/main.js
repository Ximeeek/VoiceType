/**
 * Module: Main App Bootstrap Entry
 * Single Responsibility: Entry point for initialization, Tauri IPC events orchestration,
 * status orb bindings, and loading modules in the correct dependency order.
 */

import { state, saveConfigState } from './state.js';
import { setLanguage, t, updateDOMTranslations, getLanguage, onLanguageChange } from './i18n.js';
import { setupUpdateNotificationUI, initUpdater } from './updater.js';
import { ToastManager } from './toast.js';
import { setupNavigationListeners, confirmUnsavedChanges } from './navigation.js';
import { setupAppearanceEventListeners, applyAppearanceSettings } from './theme.js';
import { setupModelEventListeners, updateDownloadProgress, updateQuickModelOptions, renderInstalledModelsManager, renderDownloadQueue, removeModelFromDownloadQueue } from './model.js';
import { setupDashboardEventListeners, checkActiveEngineAvailability, updateDashboardActiveEngineCard, renderTriggerWords, renderStopWords } from './dashboard.js';
import { setupSettingsEventListeners, checkPython, loadConfigGeneralUI, updateActiveEnginePanel, isPythonAvailableGlobal, updateEngineCardsLockUI, updateEngineCardsUI, checkEngineDirty } from './settings-ui.js';
import { setupChangelogEventListeners, checkAndShowChangelogOnStartup, renderChangelog } from './changelog.js';
import { setupHistoryStatsEventListeners, renderHistoryUI, renderStatsPage } from './history-stats.js';
import { OnboardingController } from './onboarding.js';
import { populateAudioDevices } from './audio.js';

// Expose configs on window object for backward compatibility with older components
Object.defineProperty(window, 'activeConfig', {
  get() { return state.activeConfig; },
  set(val) { state.activeConfig = val; }
});
Object.defineProperty(window, 'pendingConfig', {
  get() { return state.pendingConfig; },
  set(val) { state.pendingConfig = val; }
});

// App State Cache
let currentStatus = 'idle';
let partialElement = null;

// Expose ToastManager globally
window.ToastManager = ToastManager;

// Titlebar Controls
const minimizeBtn = document.getElementById('minimize-btn');
const closeBtn = document.getElementById('close-btn');

if (minimizeBtn) {
  minimizeBtn.addEventListener('click', () => {
    if (window.__TAURI__) {
      window.__TAURI__.core.invoke('minimize_window');
    }
  });
}

if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    if (window.__TAURI__) {
      window.__TAURI__.core.invoke('hide_window');
    }
  });
}

// Update Orb Visuals
function updateOrbState(status) {
  currentStatus = status.toLowerCase();
  state.currentStatus = currentStatus;
  const orb = document.getElementById('status-orb');
  const statusText = document.getElementById('status-text');
  const statusSubtext = document.getElementById('status-subtext');
  if (!orb || !statusText || !statusSubtext) return;

  orb.className = 'orb';
  
  if (currentStatus === 'idle') {
    orb.classList.add('idle');
    statusText.textContent = t('orb.status.idle');
    statusSubtext.textContent = t('orb.subtext.idle');
  } else if (currentStatus === 'listening') {
    orb.classList.add('listening');
    statusText.textContent = t('orb.status.listening');
    statusSubtext.textContent = t('orb.subtext.listening');
  } else if (currentStatus === 'dictating') {
    orb.classList.add('dictating');
    statusText.textContent = t('orb.status.dictating');
    statusSubtext.textContent = t('orb.subtext.dictating');
    
    const container = document.getElementById('transcript-container');
    if (container) {
      container.innerHTML = '';
    }
  } else if (currentStatus === 'processing') {
    orb.classList.add('processing');
    statusText.textContent = t('orb.status.processing');
    statusSubtext.textContent = t('orb.subtext.processing');
  } else if (currentStatus === 'paused') {
    orb.classList.add('paused');
    statusText.textContent = t('orb.status.paused');
    statusSubtext.textContent = t('orb.subtext.paused');
  } else if (currentStatus.startsWith('error')) {
    orb.classList.add('error');
    statusText.textContent = t('orb.status.error');
    statusSubtext.textContent = status;
  }

  const forceDictateBtn = document.getElementById('btn-force-dictate');
  if (forceDictateBtn) {
    if (currentStatus === 'idle' || currentStatus === 'listening') {
      forceDictateBtn.disabled = false;
      forceDictateBtn.style.opacity = '1';
      forceDictateBtn.style.pointerEvents = 'auto';
    } else {
      forceDictateBtn.disabled = true;
      forceDictateBtn.style.opacity = '0.5';
      forceDictateBtn.style.pointerEvents = 'none';
    }
  }
}

// Force Dictate Button
const forceDictateBtn = document.getElementById('btn-force-dictate');
if (forceDictateBtn) {
  forceDictateBtn.addEventListener('click', async () => {
    if (window.__TAURI__) {
      try {
        await window.__TAURI__.core.invoke('force_dictate');
        ToastManager.show({ type: 'success', title: t('toast.force_dictate'), message: t('toast.force_dictate_msg') });
      } catch (err) {
        ToastManager.show({ type: 'error', title: t('toast.force_dictate_failed'), message: err.toString() });
      }
    } else {
      updateOrbState('dictating');
      ToastManager.show({ type: 'success', title: t('toast.force_dictate_mock') });
    }
  });
}

// Click orb toggle pause/resume
const orb = document.getElementById('status-orb');
if (orb) {
  orb.addEventListener('click', async () => {
    if (window.__TAURI__) {
      try {
        if (currentStatus === 'paused') {
          await window.__TAURI__.core.invoke('resume_listening');
          ToastManager.show({ type: 'info', title: t('toast.listening_resumed') });
        } else {
          await window.__TAURI__.core.invoke('pause_listening');
          ToastManager.show({ type: 'info', title: t('toast.listening_paused') });
        }
      } catch (err) {
        ToastManager.show({ type: 'error', title: t('toast.command_error'), message: err.toString() });
      }
    } else {
      updateOrbState(currentStatus === 'paused' ? 'idle' : 'paused');
    }
  });
}

// Live Transcript Rendering
function updateTranscriptPartial(text) {
  const container = document.getElementById('transcript-container');
  const placeholder = document.getElementById('transcript-placeholder');
  if (!container) return;

  if (placeholder) placeholder.style.display = 'none';

  if (!text || text.trim() === '') {
    if (partialElement) {
      partialElement.remove();
      partialElement = null;
    }
    checkPlaceholder();
    return;
  }

  if (!partialElement) {
    partialElement = document.createElement('div');
    partialElement.className = 'transcript-line partial';
    container.appendChild(partialElement);
  }
  
  partialElement.textContent = text;
  container.scrollTop = container.scrollHeight;
}

function updateTranscriptFinal(text) {
  const container = document.getElementById('transcript-container');
  const placeholder = document.getElementById('transcript-placeholder');
  if (!container || !text || text.trim() === '') return;

  if (placeholder) placeholder.style.display = 'none';

  if (partialElement) {
    partialElement.remove();
    partialElement = null;
  }

  const finalElement = document.createElement('div');
  finalElement.className = 'transcript-line final';
  finalElement.textContent = text;
  container.appendChild(finalElement);

  state.dictationCount++;
  const wordsInText = text.trim().split(/\s+/).filter(w => w.length > 0).length;
  state.wordCount += wordsInText;

  document.getElementById('stat-dictations').textContent = state.dictationCount;
  document.getElementById('stat-words').textContent = state.wordCount;

  const lines = container.querySelectorAll('.transcript-line');
  if (lines.length > 8) {
    for (let i = 0; i < lines.length - 8; i++) {
      lines[i].remove();
    }
  }

  container.scrollTop = container.scrollHeight;

  try {
    const historyList = JSON.parse(localStorage.getItem('transcript_history') || '[]');
    const newEntry = {
      id: 'tr_' + Date.now(),
      timestamp: Date.now(),
      text: text
    };
    historyList.unshift(newEntry);
    localStorage.setItem('transcript_history', JSON.stringify(historyList));
    renderHistoryUI();
  } catch (err) {
    console.error('Failed to save history:', err);
  }
}

function checkPlaceholder() {
  const container = document.getElementById('transcript-container');
  const placeholder = document.getElementById('transcript-placeholder');
  const lines = container.querySelectorAll('.transcript-line');
  if (lines.length === 0 && placeholder) {
    placeholder.style.display = 'flex';
  }
}

// Addons System Manager
const btnViewAllAddons = document.getElementById('btn-view-all-addons');
const addonsModal = document.getElementById('addons-modal');
const btnAddonsCloseX = document.getElementById('btn-addons-modal-close-x');
const btnAddonsClose = document.getElementById('btn-addons-modal-close');

if (btnViewAllAddons && addonsModal) {
  btnViewAllAddons.addEventListener('click', () => {
    addonsModal.style.display = 'flex';
    renderAddonsManagerUI();
  });
}

if (btnAddonsCloseX && addonsModal) {
  btnAddonsCloseX.addEventListener('click', () => {
    addonsModal.style.display = 'none';
  });
}

if (btnAddonsClose && addonsModal) {
  btnAddonsClose.addEventListener('click', () => {
    addonsModal.style.display = 'none';
  });
}

async function renderAddonsManagerUI() {
  const container = document.getElementById('addons-list-container');
  if (!container) return;

  container.innerHTML = '';

  const pyCard = document.createElement('div');
  pyCard.style.background = 'var(--bg-elevated)';
  pyCard.style.border = '1px solid var(--border-subtle)';
  pyCard.style.borderRadius = '10px';
  pyCard.style.padding = '12px 16px';
  pyCard.style.display = 'flex';
  pyCard.style.justifyContent = 'space-between';
  pyCard.style.alignItems = 'center';

  pyCard.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="background: rgba(59,130,246,0.15); color: #3b82f6; padding: 8px; border-radius: 8px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
      </div>
      <div>
        <div style="font-weight: 700; font-size: 14px; color: var(--text-primary);">${t('addons.py.title')}</div>
        <div style="font-size: 12px; color: var(--text-muted);">${isPythonAvailableGlobal ? t('addons.py.installed') : t('addons.py.not_installed')}</div>
      </div>
    </div>
    <div>
      ${isPythonAvailableGlobal ? `
        <button id="btn-remove-python-env" style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">${t('addons.py.remove_btn')}</button>
      ` : `
        <span style="font-size: 11px; color: var(--text-muted); background: rgba(255,255,255,0.06); padding: 4px 8px; border-radius: 4px;">${t('addons.py.not_installed')}</span>
      `}
    </div>
  `;
  container.appendChild(pyCard);

  const removePyBtn = pyCard.querySelector('#btn-remove-python-env');
  if (removePyBtn) {
    removePyBtn.onclick = () => {
      ToastManager.show({ type: 'info', title: t('removing_env_title'), message: t('toast.removing_env_msg') });
    };
  }

  if (window.__TAURI__) {
    try {
      const summary = await window.__TAURI__.core.invoke('get_installed_models_summary');
      summary.forEach(group => {
        const groupEl = document.createElement('div');
        groupEl.style.background = 'rgba(255,255,255,0.02)';
        groupEl.style.border = '1px solid var(--border-subtle)';
        groupEl.style.borderRadius = '10px';
        groupEl.style.padding = '12px 16px';
        groupEl.style.display = 'flex';
        groupEl.style.flexDirection = 'column';
        groupEl.style.gap = '10px';

        let modelsListHtml = '';
        if (group.models.length === 0) {
          modelsListHtml = `<div style="font-size: 12px; color: var(--text-muted); font-style: italic;">${t('addons.models.empty')}</div>`;
        } else {
          modelsListHtml = group.models.map(m => `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 6px 10px; border-radius: 6px;">
              <span style="font-size: 12px; color: var(--text-secondary);">${m.name} (${m.size_text})</span>
              <button class="btn-remove-addon-model" data-engine="${group.engine_id}" data-model="${m.model_id}" style="background: transparent; border: none; color: #ef4444; cursor: pointer; font-size: 12px; font-weight: 600;">${t('models.manager.delete')}</button>
            </div>
          `).join('');
        }

        groupEl.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-weight: 700; font-size: 13px; color: var(--accent-green);">${group.engine_name} (${group.total_size_text})</div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${modelsListHtml}
          </div>
        `;
        container.appendChild(groupEl);
      });

      container.querySelectorAll('.btn-remove-addon-model').forEach(btn => {
        btn.onclick = async (e) => {
          const engine = e.currentTarget.getAttribute('data-engine');
          const model = e.currentTarget.getAttribute('data-model');
          try {
            await window.__TAURI__.core.invoke('delete_installed_model', { engine, model });
            ToastManager.show({ type: 'success', title: t('toast.model_deleted'), message: `Model ${model} usunięty z dysku.` });
            removeModelFromDownloadQueue(engine, model);
            renderAddonsManagerUI();
            renderInstalledModelsManager();
            await updateDashboardActiveEngineCard();
            await checkActiveEngineAvailability();
          } catch (err) {
            ToastManager.show({ type: 'error', title: t('toast.model_delete_error'), message: err.toString() });
          }
        };
      });
    } catch (err) {
      console.error(err);
    }
  }
}

// App Version Badging in About Page
let cachedVersionInfo = null;

async function updateAppVersionBadge() {
  const badgeEl = document.getElementById('about-app-version-badge');
  if (!badgeEl) return;

  try {
    if (window.__TAURI__) {
      cachedVersionInfo = await window.__TAURI__.core.invoke('get_app_version_info');
    } else {
      cachedVersionInfo = {
        version: 'DEV',
        is_dev: true,
        is_prerelease: false,
        channel: 'dev',
        display_tag: 'DEV'
      };
    }
  } catch (err) {
    console.warn('[ABOUT] Error fetching version info:', err);
    cachedVersionInfo = {
      version: 'DEV',
      is_dev: true,
      is_prerelease: false,
      channel: 'dev',
      display_tag: 'DEV'
    };
  }

  window.cachedVersionInfo = cachedVersionInfo;
  renderAppVersionBadge(cachedVersionInfo);
}

function renderAppVersionBadge(info) {
  const badgeEl = document.getElementById('about-app-version-badge');
  if (!badgeEl || !info) return;

  if (info.is_dev) {
    badgeEl.textContent = 'DEV';
    badgeEl.style.background = 'rgba(245, 158, 11, 0.18)';
    badgeEl.style.color = '#f59e0b';
    badgeEl.style.border = '1px solid rgba(245, 158, 11, 0.4)';
  } else if (info.is_prerelease) {
    badgeEl.textContent = `v${info.version} (Nightly)`;
    badgeEl.style.background = 'rgba(139, 92, 246, 0.18)';
    badgeEl.style.color = '#a78bfa';
    badgeEl.style.border = '1px solid rgba(139, 92, 246, 0.4)';
  } else {
    badgeEl.textContent = `v${info.version} (Stable)`;
    badgeEl.style.background = 'rgba(16, 185, 129, 0.18)';
    badgeEl.style.color = 'var(--accent-green)';
    badgeEl.style.border = '1px solid rgba(16, 185, 129, 0.4)';
  }
}

// Bind About Repository Button
const aboutGithubRepoBtn = document.getElementById('about-github-repo-btn');
if (aboutGithubRepoBtn) {
  aboutGithubRepoBtn.addEventListener('click', () => {
    const repoUrl = 'https://github.com/Ximeeek/VoiceType';
    if (window.__TAURI__) {
      window.__TAURI__.core.invoke('open_url', { url: repoUrl });
    } else {
      window.open(repoUrl, '_blank');
    }
  });
}

// Bind About Check Updates Button
const aboutCheckUpdatesBtn = document.getElementById('about-check-updates-btn');
if (aboutCheckUpdatesBtn) {
  aboutCheckUpdatesBtn.addEventListener('click', async () => {
    try {
      ToastManager.show({ type: 'info', title: t('about.check_updates'), message: t('updater.checking') || 'Checking for updates...' });
      await initUpdater((status) => {
        if (status.type === 'up_to_date') {
          ToastManager.show({ type: 'success', title: t('about.check_updates'), message: t('updater.up_to_date') || 'VoiceType is up to date!' });
        } else if (status.type === 'downloading') {
          ToastManager.show({ type: 'info', title: t('about.check_updates'), message: `Downloading update v${status.version} (${status.progress}%)...` });
        } else if (status.type === 'ready_to_install') {
          ToastManager.show({ type: 'success', title: t('about.check_updates'), message: `Update v${status.version} ready to install.` });
        }
      });
    } catch (e) {
      ToastManager.show({ type: 'error', title: t('about.check_updates'), message: e.message || e.toString() });
    }
  });
}

// Verify model on startup
async function verifyStartupModel() {
  if (!window.__TAURI__ || !state.activeConfig || !state.activeConfig.engine) return;
  const engineId = state.activeConfig.engine.type;
  if (!['vosk', 'sherpa_onnx', 'whisper', 'faster_whisper'].includes(engineId)) return;

  let modelId = '';
  if (engineId === 'vosk') modelId = (state.activeConfig.engine.vosk.model_path || '').split(/[/\\]/).pop();
  else if (engineId === 'sherpa_onnx') modelId = (state.activeConfig.engine.sherpa_onnx.model_path || '').split(/[/\\]/).pop();
  else modelId = state.activeConfig.engine.whisper.model;

  const checkEngine = engineId === 'faster_whisper' ? 'whisper' : engineId;
  try {
    const isDownloaded = await window.__TAURI__.core.invoke('check_model_downloaded', { engine: checkEngine, model: modelId });
    if (!isDownloaded) {
      const summary = await window.__TAURI__.core.invoke('get_installed_models_summary');
      let foundModel = null;
      let foundEngine = null;

      for (const group of summary) {
        if (group.models && group.models.length > 0) {
          foundEngine = group.engine_id;
          foundModel = group.models[0].model_id;
          break;
        }
      }

      if (foundModel && foundEngine) {
        state.activeConfig.engine.type = foundEngine;
        if (foundEngine === 'vosk') state.activeConfig.engine.vosk.model_path = `models/vosk/${foundModel}`;
        else if (foundEngine === 'sherpa_onnx') state.activeConfig.engine.sherpa_onnx.model_path = `models/sherpa/${foundModel}`;
        else state.activeConfig.engine.whisper.model = foundModel;

        state.pendingConfig = JSON.parse(JSON.stringify(state.activeConfig));
        await saveConfigState();
        updateActiveEnginePanel(foundEngine);
        ToastManager.show({
          type: 'warning',
          title: t('toast.last_model_not_found_title'),
          message: t('toast.last_model_not_found_msg', { model: modelId, foundModel: foundModel }),
          persistent: true
        });
      } else {
        const modelShortLabel = document.getElementById('engine-model-short');
        if (modelShortLabel) {
          modelShortLabel.textContent = t('engines.status.not_downloaded');
          modelShortLabel.style.color = '#ef4444';
        }
        ToastManager.show({
          type: 'error',
          title: t('toast.missing_model_error_title'),
          message: t('toast.missing_model_error_msg', { model: modelId }),
          persistent: true
        });
      }
    }
  } catch (err) {
    console.error('Error validating model at startup:', err);
  }
}

// Bind Day Stats Modal Close Buttons
const dayStatsModal = document.getElementById('day-stats-modal');
const btnDayCloseX = document.getElementById('btn-day-stats-modal-close-x');
const btnDayClose = document.getElementById('btn-day-stats-modal-close');
if (dayStatsModal) {
  if (btnDayCloseX) btnDayCloseX.onclick = () => dayStatsModal.style.display = 'none';
  if (btnDayClose) btnDayClose.onclick = () => dayStatsModal.style.display = 'none';
}

// Language update callback wiring
onLanguageChange(() => {
  try {
    const activeEngine = state.pendingConfig ? state.pendingConfig.engine.type : (state.activeConfig ? state.activeConfig.engine.type : 'vosk');
    updateActiveEnginePanel(activeEngine);
    renderHistoryUI();
    renderDownloadQueue();
    renderInstalledModelsManager();
    updateDashboardActiveEngineCard();
    renderAddonsManagerUI();
    updateEngineCardsLockUI();
    updateDOMTranslations();

    const statsPage = document.getElementById('page-stats');
    if (statsPage && statsPage.classList.contains('active')) {
      renderStatsPage();
    }

    if (cachedVersionInfo) renderAppVersionBadge(cachedVersionInfo);
    if (window.cachedReleases) renderChangelog();
  } catch (err) {
    console.error('[i18n] Error updating UI on language change:', err);
  }
});

// Main Initialization Sequence
async function init() {
  if (window.__TAURI__) {
    try {
      await checkPython();

      const config = await window.__TAURI__.core.invoke('get_config');
      state.activeConfig = config;
      state.pendingConfig = JSON.parse(JSON.stringify(config));
      
      setLanguage(config.general && config.general.language ? config.general.language : (navigator.language.startsWith('pl') ? 'pl' : 'en'));
      setupAppearanceEventListeners();
      applyAppearanceSettings(config);
      await updateAppVersionBadge();

      await OnboardingController.init();
      await checkAndShowChangelogOnStartup();

      renderTriggerWords(config.trigger.words);
      renderStopWords(config.dictation.stop_words);
      loadConfigGeneralUI(config);

      const engines = await window.__TAURI__.core.invoke('list_engines');
      const active = engines.find(e => e.is_active);
      
      if (active) {
        document.querySelectorAll('.engine-card').forEach(c => {
          c.classList.remove('active');
          const badge = c.querySelector('.engine-card-badge');
          if (badge) {
            badge.classList.remove('active');
            badge.textContent = t('engines.badge.select');
          }
        });
        const activeCard = document.querySelector(`.engine-card[data-engine-id="${active.id}"]`);
        if (activeCard) {
          activeCard.classList.add('active');
          const badge = activeCard.querySelector('.engine-card-badge');
          if (badge) {
            badge.classList.add('active');
            badge.textContent = t('engines.badge.active');
          }
          updateActiveEnginePanel(active.id);
          await verifyStartupModel();
        }
      }

      await populateAudioDevices();

      const btnGoToDownloads = document.getElementById('btn-overlay-go-to-downloads');
      if (btnGoToDownloads) {
        btnGoToDownloads.addEventListener('click', () => {
          try {
            if (state.activeConfig?.engine) {
              const engineId = state.activeConfig.engine.type;
              let modelId = '';
              if (engineId === 'vosk') {
                modelId = (state.activeConfig.engine.vosk.model_path || '').split(/[/\\]/).pop();
              } else if (engineId === 'sherpa_onnx') {
                modelId = (state.activeConfig.engine.sherpa_onnx.model_path || '').split(/[/\\]/).pop();
              } else if (engineId === 'whisper' || engineId === 'faster_whisper') {
                modelId = state.activeConfig.engine.whisper.model;
              }

              if (modelId) {
                state.pendingModelHighlight = { engineId, modelId };
              }
            }
          } catch (err) {
            console.error('[Dashboard] Error setting pending model highlight:', err);
          }

          const navDownloads = document.getElementById('nav-downloads');
          if (navDownloads) {
            navDownloads.click();
          }
        });
      }

      await checkActiveEngineAvailability();

      await window.__TAURI__.event.listen('status_changed', (event) => {
        updateOrbState(event.payload);
      });
      
      await window.__TAURI__.event.listen('transcript_partial', (event) => {
        updateTranscriptPartial(event.payload);
      });
      
      await window.__TAURI__.event.listen('transcript_final', (event) => {
        updateTranscriptFinal(event.payload);
      });
      
      await window.__TAURI__.event.listen('engine_error', (event) => {
        ToastManager.show({ type: 'error', title: t('toast.engine_error'), message: event.payload, persistent: true });
      });

      await window.__TAURI__.event.listen('download_progress', (event) => {
        updateDownloadProgress(event.payload);
        OnboardingController.handleDownloadProgress(event.payload);
      });
      
      await window.__TAURI__.event.listen('no_input_copied', () => {
        ToastManager.show({ 
          type: 'warning', 
          title: t('toast.no_text_field'), 
          message: t('toast.no_input_copied_msg') 
        });
      });

      ToastManager.show({ type: 'success', title: t('toast.voicetype_active_title'), message: t('toast.voicetype_active_msg') });
      renderHistoryUI();
    } catch (err) {
      console.error(err);
      ToastManager.show({ type: 'error', title: t('toast.initialization_error'), message: err.toString(), persistent: true });
    }
  } else {
    // Mock environment for web/browser preview
    state.activeConfig = {
      trigger: { words: ['zaczynamy', 'start'], fuzzy_match: true },
      dictation: { stop_words: ['stop', 'done'], silence_timeout_ms: 1500, stop_word_remove_from_text: true, start_delay_ms: 0, live_typing_interval_ms: 2000 },
      general: { autostart: false, language: 'pl' },
      input: { clipboard_fallback: true, clipboard_toast: true, auto_enter: false },
      audio: { input_device: 'default' },
      engine: { type: 'vosk', vosk: { model_path: 'models/vosk/vosk-model-small-pl-0.22' } },
      ui: { theme: 'neon' }
    };
    state.pendingConfig = JSON.parse(JSON.stringify(state.activeConfig));
    renderTriggerWords(state.activeConfig.trigger.words);
    renderStopWords(state.activeConfig.dictation.stop_words);
    loadConfigGeneralUI(state.activeConfig);
    populateAudioDevices();
    updateActiveEnginePanel('vosk');
    updateOrbState('idle');
    renderHistoryUI();
    ToastManager.show({ type: 'info', title: t('toast.mock_env_title'), message: t('toast.mock_env_msg') });
  }

  const quickLangSelect = document.getElementById('quick-lang-select');
  if (quickLangSelect && state.activeConfig?.general) {
    quickLangSelect.value = state.activeConfig.general.language;
  }
  updateQuickModelOptions();
  setupUpdateNotificationUI();

  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    console.log('[VoiceType] Initialization complete, dismissing loading screen.');
    loadingScreen.classList.add('fade-out');
    setTimeout(() => {
      loadingScreen.remove();
    }, 400);
  }
}

// Bind submodules listeners
setupNavigationListeners();
setupModelEventListeners();
setupDashboardEventListeners();
setupSettingsEventListeners();
setupChangelogEventListeners();
setupHistoryStatsEventListeners();

// Trigger boot
document.addEventListener('DOMContentLoaded', init);
export { updateOrbState };
