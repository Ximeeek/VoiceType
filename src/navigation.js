/**
 * Module: Navigation and Window Guard
 * Single Responsibility: Manages titlebar minimizing/hiding, sidebar tab switching,
 * page change detection, and navigation guards (unsaved settings warnings, missing model alerts).
 */

import { state, saveConfigState } from './state.js';
import { t } from './i18n.js';
import { ToastManager } from './toast.js';

// Getters/setters/helpers for API keys
export function getEngineApiKey(engineType, configEngine) {
  if (!configEngine) return '';
  const eng = configEngine[engineType];
  return eng ? (eng.api_key || '') : '';
}

export function setEngineApiKey(engineType, configEngine, val) {
  if (!configEngine) return;
  if (!configEngine[engineType]) configEngine[engineType] = {};
  configEngine[engineType].api_key = val;
}

export function setupNavigationListeners() {
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

  // Sidebar Navigation
  const navButtons = document.querySelectorAll('.sidebar-btn[data-page]');
  const pages = document.querySelectorAll('.page');

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetPageId = btn.getAttribute('data-page');
      const currentPage = document.querySelector('.page.active');
      if (currentPage && currentPage.id === `page-${targetPageId}`) return;

      // Stop microphone test when navigating away
      if (typeof window.stopMicTest === 'function') {
        window.stopMicTest();
      }

      confirmUnsavedChanges(() => {
        navButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        pages.forEach(p => p.classList.remove('active'));
        const targetPage = document.getElementById(`page-${targetPageId}`);
        if (targetPage) {
          targetPage.classList.add('active');
        }
        if (targetPageId === 'dashboard') {
          if (typeof window.checkActiveEngineAvailability === 'function') {
            window.checkActiveEngineAvailability();
          }
          if (typeof window.updateDashboardActiveEngineCard === 'function') {
            window.updateDashboardActiveEngineCard();
          }
        }
        if (targetPageId === 'settings') {
          const activeEngineId = (state.activeConfig && state.activeConfig.engine && state.activeConfig.engine.type) || 'vosk';
          if (typeof window.updateActiveEnginePanel === 'function') {
            window.updateActiveEnginePanel(activeEngineId);
          }
        }
        if (targetPageId === 'about') {
          console.log('[Navigation] Navigating to about section. Fetching changelog...');
          if (typeof window.loadChangelog === 'function') {
            window.loadChangelog();
          }
        }
        if (targetPageId === 'stats') {
          if (typeof window.renderStatsPage === 'function') {
            window.renderStatsPage();
          }
        }
        if (targetPageId === 'downloads') {
          console.log('[Navigation] Navigating to downloads section.');
          if (state.pendingModelHighlight) {
            const { engineId, modelId } = state.pendingModelHighlight;
            console.log('[Navigation] Found pending model highlight:', engineId, modelId);
            const quickEngineSelect = document.getElementById('quick-download-engine');
            if (quickEngineSelect) {
              quickEngineSelect.value = engineId;
            }
            const quickLangSelect = document.getElementById('quick-download-lang');
            if (quickLangSelect) {
              let lang = (state.activeConfig && state.activeConfig.general && state.activeConfig.general.language) || 'pl';
              if (engineId === 'vosk' && modelId) {
                const knownLangs = ['pl', 'en', 'de', 'fr', 'es', 'it', 'ru'];
                for (const kl of knownLangs) {
                  if (modelId.includes(`-${kl}-`) || modelId.includes(`-${kl}`)) {
                    lang = kl;
                    break;
                  }
                }
              } else if (engineId === 'sherpa_onnx' && modelId) {
                if (modelId.includes('.en') || modelId.includes('-en-') || modelId.includes('-en')) {
                  lang = 'en';
                }
              }
              quickLangSelect.value = lang;
              console.log('[Navigation] Pre-setting quick download language to:', lang);
            }
          }
          if (typeof window.updateQuickModelOptions === 'function') {
            window.updateQuickModelOptions();
          }
        }
      });
    });
  });

  const engineChangeBtn = document.getElementById('engine-change-btn');
  if (engineChangeBtn) {
    engineChangeBtn.addEventListener('click', () => {
      const navSettings = document.getElementById('nav-settings');
      if (navSettings) {
        navSettings.click();
        const engineTab = document.querySelector('.settings-tab-btn[data-tab="engine"]');
        if (engineTab) engineTab.click();
      }
    });
  }

  // Settings Sub-Tabs Navigation
  const settingsTabs = document.querySelectorAll('.settings-tab-btn');
  const settingsTabContents = document.querySelectorAll('.settings-tab-content');

  settingsTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');
      const currentTabContent = document.querySelector('.settings-tab-content.active');
      if (currentTabContent && currentTabContent.id === `settings-tab-${targetTab}`) return;

      // Stop microphone test when switching tabs
      if (typeof window.stopMicTest === 'function') {
        window.stopMicTest();
      }

      confirmUnsavedChanges(() => {
        settingsTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        settingsTabContents.forEach(tc => tc.classList.remove('active'));
        const activeContent = document.getElementById(`settings-tab-${targetTab}`);
        if (activeContent) activeContent.classList.add('active');
      });
    });
  });
}

export function getEngineChangesDescription() {
  if (!state.pendingConfig || !state.activeConfig) return '';
  const changes = [];
  if (state.pendingConfig.engine.type !== state.activeConfig.engine.type) {
    const names = {
      vosk: 'Vosk',
      sherpa_onnx: 'Sherpa-ONNX',
      whisper: 'Whisper.cpp',
      faster_whisper: 'Faster-Whisper',
      deepgram: 'Deepgram',
      assemblyai: 'AssemblyAI',
      openai: 'OpenAI Whisper',
      google: 'Google STT',
      azure: 'Azure Speech'
    };
    changes.push(`• ${t('desc.change_engine')}: <b>${names[state.activeConfig.engine.type] || state.activeConfig.engine.type}</b> ➔ <b>${names[state.pendingConfig.engine.type] || state.pendingConfig.engine.type}</b>`);
  }
  if (state.pendingConfig.general.language !== state.activeConfig.general.language) {
    changes.push(`• ${t('desc.change_language')}: <b>${state.activeConfig.general.language}</b> ➔ <b>${state.pendingConfig.general.language}</b>`);
  }
  if (state.pendingConfig.engine.vosk.model_path !== state.activeConfig.engine.vosk.model_path) {
    const mName = state.pendingConfig.engine.vosk.model_path.split(/[/\\]/).pop();
    changes.push(`• ${t('desc.change_model_vosk')} <b>${mName}</b>`);
  }
  if (state.pendingConfig.engine.sherpa_onnx.model_path !== state.activeConfig.engine.sherpa_onnx.model_path) {
    const mName = state.pendingConfig.engine.sherpa_onnx.model_path.split(/[/\\]/).pop();
    changes.push(`• ${t('desc.change_model_sherpa')} <b>${mName}</b>`);
  }
  if (state.pendingConfig.engine.whisper.model !== state.activeConfig.engine.whisper.model) {
    changes.push(`• ${t('desc.change_model_whisper')} <b>${state.pendingConfig.engine.whisper.model}</b>`);
  }
  if (state.pendingConfig.engine.whisper.use_gpu !== state.activeConfig.engine.whisper.use_gpu) {
    const status = state.pendingConfig.engine.whisper.use_gpu ? t('desc.enabled') : t('desc.disabled');
    changes.push(`• ${t('desc.gpu_acceleration')}: <b>${status}</b>`);
  }
  return changes.join('<br>');
}

export function showDownloadingNavigationModal() {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.style.zIndex = '100000';

  const card = document.createElement('div');
  card.className = 'modal-card';
  card.style.maxWidth = '440px';

  card.innerHTML = `
    <div class="modal-title" style="color: var(--accent-gold, #f59e0b); display: flex; align-items: center; gap: 8px;">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
      ${t('nav.downloading_title')}
    </div>
    <div class="modal-body" style="margin-top: 14px; margin-bottom: 22px;">
      <p style="margin: 0; font-size: 14px; color: var(--text-secondary); line-height: 1.5;">${t('nav.downloading_msg')}</p>
    </div>
    <div style="display: flex; justify-content: flex-end; gap: 10px;">
      <button class="btn-modal-ok" style="background: var(--accent-green); border: none; color: #fff; padding: 8px 18px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 700;">${t('nav.downloading_btn_ok')}</button>
      <button class="btn-modal-delete-download" style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #ef4444; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600;">${t('nav.downloading_btn_delete')}</button>
    </div>
  `;

  backdrop.appendChild(card);
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();

  card.querySelector('.btn-modal-ok').onclick = () => close();

  card.querySelector('.btn-modal-delete-download').onclick = async () => {
    close();
    const activeItem = state.downloadQueue.find(q => q.status === 'downloading' || q.status === 'queued');
    if (activeItem) {
      activeItem.status = 'cancelled';
      if (window.__TAURI__) {
        await window.__TAURI__.core.invoke('cleanup_model_tmp_files', { engine: activeItem.engine, model: activeItem.model });
      }
    } else if (window.__TAURI__ && state.pendingConfig) {
      const engineId = state.pendingConfig.engine.type;
      let modelId = '';
      if (engineId === 'vosk') modelId = state.pendingConfig.engine.vosk.model_path.split(/[/\\]/).pop();
      else if (engineId === 'sherpa_onnx') modelId = state.pendingConfig.engine.sherpa_onnx.model_path.split(/[/\\]/).pop();
      else modelId = state.pendingConfig.engine.whisper.model;
      await window.__TAURI__.core.invoke('cleanup_model_tmp_files', { engine: engineId, model: modelId });
    }

    state.isGlobalDownloading = false;
    state.pendingConfig = JSON.parse(JSON.stringify(state.activeConfig));
    
    if (typeof window.loadConfigGeneralUI === 'function') {
      window.loadConfigGeneralUI(state.activeConfig);
    }
    if (typeof window.updateActiveEnginePanel === 'function') {
      window.updateActiveEnginePanel(state.activeConfig.engine.type);
    }
    if (typeof window.checkEngineDirty === 'function') {
      window.checkEngineDirty();
    }
    if (typeof window.renderDownloadQueue === 'function') {
      window.renderDownloadQueue();
    }
    
    ToastManager.show({ type: 'info', title: t('toast.model_removed_nav_title'), message: t('toast.model_removed_nav_msg') });
  };
}

export async function confirmUnsavedChanges(onProceed) {
  console.log("[confirmUnsavedChanges] Checking for unsaved changes before page transition...");
  const applyBtn = document.getElementById('btn-engine-apply');
  if (applyBtn && applyBtn.style.display !== 'none') {
    console.log("[confirmUnsavedChanges] Unsaved changes detected (apply button is visible).");
    const engineId = state.pendingConfig.engine.type;
    let modelId = '';
    if (engineId === 'vosk') {
      modelId = state.pendingConfig.engine.vosk.model_path.split(/[/\\]/).pop();
    } else if (engineId === 'sherpa_onnx') {
      modelId = state.pendingConfig.engine.sherpa_onnx.model_path.split(/[/\\]/).pop();
    } else {
      modelId = state.pendingConfig.engine.whisper.model;
    }

    let isDownloaded = true;
    if (window.__TAURI__ && ['vosk', 'sherpa_onnx', 'whisper', 'faster_whisper'].includes(engineId)) {
      const checkEngine = engineId === 'faster_whisper' ? 'whisper' : engineId;
      isDownloaded = await window.__TAURI__.core.invoke('check_model_downloaded', { engine: checkEngine, model: modelId });
    }

    if (!isDownloaded) {
      console.log(`[confirmUnsavedChanges] Target model '${modelId}' is not downloaded.`);
      const isCurrentlyDownloading = state.downloadQueue.some(q => q.model === modelId && (q.status === 'downloading' || q.status === 'queued'));
      if (!isCurrentlyDownloading) {
        console.log("[confirmUnsavedChanges] Showing missing model navigation guard modal.");
        showMissingModelNavigationGuardModal({
          engine: engineId,
          modelId,
          onProceed,
        });
        return false;
      }
    }

    console.log("[confirmUnsavedChanges] Showing unsaved changes modal.");
    const desc = getEngineChangesDescription();
    showUnsavedChangesModal({
      description: desc,
      onProceed: onProceed,
      onDiscard: () => {
        console.log("[confirmUnsavedChanges] User elected to DISCARD changes.");
        state.pendingConfig = JSON.parse(JSON.stringify(state.activeConfig));
        
        if (typeof window.loadConfigGeneralUI === 'function') {
          window.loadConfigGeneralUI(state.activeConfig);
        }
        if (typeof window.updateActiveEnginePanel === 'function') {
          window.updateActiveEnginePanel(state.activeConfig.engine.type);
        }
        if (typeof window.checkEngineDirty === 'function') {
          window.checkEngineDirty();
        }
        if (typeof window.renderAvailableModels === 'function') {
          window.renderAvailableModels(state.activeConfig.engine.type);
        }
        
        ToastManager.show({ type: 'info', title: t('toast.config_restored_title'), message: t('toast.config_restored_msg') });
        onProceed();
      }
    });
    return false;
  }
  console.log("[confirmUnsavedChanges] No unsaved changes. Proceeding with transition.");
  onProceed();
  return true;
}

export function showMissingModelNavigationGuardModal({ engine, modelId, onProceed }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.style.zIndex = '100000';

  const card = document.createElement('div');
  card.className = 'modal-card';
  card.style.maxWidth = '460px';

  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div class="modal-title" style="color: var(--accent-gold, #f59e0b); display: flex; align-items: center; gap: 8px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
        ${t('nav.missing_model_title')}
      </div>
      <button class="btn-modal-close-x" style="background: none; border: none; color: var(--text-muted); font-size: 22px; cursor: pointer; padding: 0 4px; line-height: 1; transition: color 0.2s;" title="${t('btn.close')}">×</button>
    </div>
    <div class="modal-body" style="margin-top: 14px; margin-bottom: 22px;">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: var(--text-primary); font-weight: 600;">${t('nav.missing_model_subtitle')}</p>
      <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">${t('nav.missing_model_msg', { model: modelId })}</p>
      <div id="missing-guard-download-status" style="margin-top: 16px; display: none;">
        <div class="progress-bar-bg" style="background: rgba(255,255,255,0.1); height: 8px; border-radius: 4px; overflow: hidden;">
          <div id="missing-guard-progress-fill" style="width: 0%; height: 100%; background: var(--accent-green); transition: width 0.2s;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 12px; color: var(--text-muted);">
          <span id="missing-guard-progress-text">${t('nav.missing_model_downloading')}</span>
          <span id="missing-guard-progress-percent">0%</span>
        </div>
      </div>
    </div>
    <div id="missing-guard-actions" style="display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap;">
      <button class="btn-cancel-nav" style="background: transparent; border: 1px solid var(--border-subtle); color: var(--text-secondary); padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600;">${t('nav.missing_model_btn_cancel')}</button>
      <button class="btn-discard-nav" style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #ef4444; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600;">${t('nav.missing_model_btn_discard')}</button>
      <button class="btn-download-nav" style="background: var(--accent-green); border: none; color: #fff; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 700; box-shadow: 0 4px 12px rgba(16,185,129,0.3);">${t('nav.missing_model_btn_download')}</button>
    </div>
  `;

  backdrop.appendChild(card);
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  let isDownloading = false;

  const closeX = card.querySelector('.btn-modal-close-x');
  if (closeX) {
    closeX.onclick = () => {
      console.log("[showMissingModelNavigationGuardModal] Close (x) clicked. Proceeding with page transition.");
      close();
      onProceed();
    };
  }

  card.querySelector('.btn-cancel-nav').onclick = async () => {
    console.log("[showMissingModelNavigationGuardModal] 'Cancel' clicked. Staying on current section.");
    if (isDownloading && window.__TAURI__) {
      const checkEngine = engine === 'faster_whisper' ? 'whisper' : engine;
      await window.__TAURI__.core.invoke('cleanup_model_tmp_files', { engine: checkEngine, model: modelId });
      state.pendingConfig = JSON.parse(JSON.stringify(state.activeConfig));
      
      if (typeof window.loadConfigGeneralUI === 'function') {
        window.loadConfigGeneralUI(state.activeConfig);
      }
      if (typeof window.updateActiveEnginePanel === 'function') {
        window.updateActiveEnginePanel(state.activeConfig.engine.type);
      }
      if (typeof window.checkEngineDirty === 'function') {
        window.checkEngineDirty();
      }
      if (typeof window.renderAvailableModels === 'function') {
        window.renderAvailableModels(state.activeConfig.engine.type);
      }
      
      ToastManager.show({ type: 'info', title: t('toast.download_cancelled'), message: t('toast.download_cancelled_nav_msg') });
    }
    close();
  };

  card.querySelector('.btn-discard-nav').onclick = () => {
    console.log("[showMissingModelNavigationGuardModal] 'Don't Save' clicked. Discarding changes and proceeding with transition.");
    close();
    state.pendingConfig = JSON.parse(JSON.stringify(state.activeConfig));
    
    if (typeof window.loadConfigGeneralUI === 'function') {
      window.loadConfigGeneralUI(state.activeConfig);
    }
    if (typeof window.updateActiveEnginePanel === 'function') {
      window.updateActiveEnginePanel(state.activeConfig.engine.type);
    }
    if (typeof window.checkEngineDirty === 'function') {
      window.checkEngineDirty();
    }
    if (typeof window.renderAvailableModels === 'function') {
      window.renderAvailableModels(state.activeConfig.engine.type);
    }
    
    ToastManager.show({ type: 'info', title: t('toast.model_restored_title'), message: t('toast.model_restored_msg') });
    onProceed();
  };

  card.querySelector('.btn-download-nav').onclick = async () => {
    console.log("[showMissingModelNavigationGuardModal] 'Download and Save' clicked. Initiating download and proceeding with transition.");
    if (typeof window.addModelToDownloadQueue === 'function') {
      window.addModelToDownloadQueue(engine, modelId);
    }
    state.activeConfig = JSON.parse(JSON.stringify(state.pendingConfig));
    if (window.__TAURI__) {
      await saveConfigState();
    }
    if (typeof window.checkEngineDirty === 'function') {
      window.checkEngineDirty();
    }
    if (typeof window.updateActiveEnginePanel === 'function') {
      window.updateActiveEnginePanel(state.activeConfig.engine.type);
    }
    ToastManager.show({ type: 'info', title: t('toast.download_started_activated_title'), message: t('toast.download_started_activated_msg', { model: modelId }) });
    close();
    onProceed();
  };
}

export function showUnsavedChangesModal({ description, onProceed, onDiscard }) {
  console.log("[showUnsavedChangesModal] Opening unsaved changes modal...");
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.style.zIndex = '100000';

  const card = document.createElement('div');
  card.className = 'modal-card';
  card.style.maxWidth = '460px';

  const ONLINE_ENGINES = ['deepgram', 'assemblyai', 'openai', 'google', 'azure'];
  const pendingEngineId = state.pendingConfig?.engine?.type;
  const isOnlineEngine = ONLINE_ENGINES.includes(pendingEngineId);
  const currentApiKey = isOnlineEngine ? getEngineApiKey(pendingEngineId, state.pendingConfig.engine) : '';
  const isKeyMissing = isOnlineEngine && (!currentApiKey || !currentApiKey.trim());

  const engineDisplayNames = {
    vosk: 'Vosk Offline',
    sherpa_onnx: 'Sherpa-ONNX',
    whisper: 'Whisper.cpp',
    faster_whisper: 'Faster-Whisper',
    deepgram: 'Deepgram Online',
    assemblyai: 'AssemblyAI Online',
    openai: 'OpenAI Whisper',
    google: 'Google Cloud STT',
    azure: 'Azure Speech Services'
  };

  let apiKeySectionHtml = '';
  if (isOnlineEngine) {
    const engineLabel = engineDisplayNames[pendingEngineId] || pendingEngineId;
    apiKeySectionHtml = `
      <div id="modal-api-key-container" style="margin-top: 14px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-subtle); padding: 12px; border-radius: 8px;">
        <label id="modal-api-key-label" style="display: block; font-size: 13px; font-weight: 600; color: ${isKeyMissing ? '#ef4444' : 'var(--text-primary)'}; margin-bottom: 6px;">
          ${t('nav.unsaved_changes_api_key_required', { engine: engineLabel })}
        </label>
        <input type="password" id="modal-api-key-input" class="settings-input" placeholder="${t('nav.unsaved_changes_api_key_placeholder')}" value="${currentApiKey.replace(/"/g, '&quot;')}" style="width: 100%; box-sizing: border-box; padding: 8px 12px; border-radius: 6px; background: rgba(255,255,255,0.05); border: 1px solid ${isKeyMissing ? '#ef4444' : 'var(--border-subtle)'}; color: var(--text-primary); font-size: 13px; outline: none; transition: border-color 0.2s;" />
      </div>
    `;
  }

  card.innerHTML = `
    <div class="modal-title" style="color: var(--accent-gold, #f59e0b); display: flex; align-items: center; gap: 8px;">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/></svg>
      ${t('nav.unsaved_changes_title')}
    </div>
    <div class="modal-body" style="margin-top: 14px; margin-bottom: 22px;">
      <p style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-secondary);">${t('nav.unsaved_changes_msg')}</p>
      <div style="background: rgba(255,255,255,0.04); border-left: 3px solid var(--accent-gold, #f59e0b); padding: 10px 14px; border-radius: 6px; font-size: 13px; color: var(--text-primary); line-height: 1.6;">
        ${description || t('nav.unsaved_changes_default_desc')}
      </div>
      ${apiKeySectionHtml}
    </div>
    <div style="display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap;">
      <button class="btn-cancel" style="background: transparent; border: 1px solid var(--border-subtle); color: var(--text-secondary); padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600;">${t('nav.unsaved_changes_btn_cancel')}</button>
      <button class="btn-discard" style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #ef4444; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600;">${t('nav.unsaved_changes_btn_discard')}</button>
      <button class="btn-save" style="background: var(--accent-green, #10b981); border: none; color: #fff; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 700; box-shadow: 0 4px 12px rgba(16,185,129,0.3); transition: all 0.2s;">${t('nav.unsaved_changes_btn_save')}</button>
    </div>
  `;

  backdrop.appendChild(card);
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  const btnCancel = card.querySelector('.btn-cancel');
  const btnDiscard = card.querySelector('.btn-discard');
  const btnSave = card.querySelector('.btn-save');
  const apiKeyInput = card.querySelector('#modal-api-key-input');
  const apiKeyLabel = card.querySelector('#modal-api-key-label');

  if (isKeyMissing) {
    btnSave.disabled = true;
    btnSave.style.opacity = '0.5';
    btnSave.style.cursor = 'not-allowed';
  }

  if (apiKeyInput) {
    apiKeyInput.addEventListener('input', (e) => {
      const val = e.target.value;
      setEngineApiKey(pendingEngineId, state.pendingConfig.engine, val);

      const mainKeyInput = document.getElementById('engine-api-key');
      if (mainKeyInput) mainKeyInput.value = val;

      if (typeof window.checkEngineDirty === 'function') {
        window.checkEngineDirty();
      }

      if (val.trim().length > 0) {
        btnSave.disabled = false;
        btnSave.style.opacity = '1';
        btnSave.style.cursor = 'pointer';
        if (apiKeyLabel) {
          apiKeyLabel.style.color = 'var(--text-primary)';
        }
        if (apiKeyInput) {
          apiKeyInput.style.borderColor = 'var(--border-subtle)';
        }
      } else {
        btnSave.disabled = true;
        btnSave.style.opacity = '0.5';
        btnSave.style.cursor = 'not-allowed';
        if (apiKeyLabel) {
          apiKeyLabel.style.color = '#ef4444';
        }
        if (apiKeyInput) {
          apiKeyInput.style.borderColor = '#ef4444';
        }
      }
    });
  }

  btnCancel.onclick = () => close();

  btnDiscard.onclick = () => {
    close();
    onDiscard();
  };

  btnSave.onclick = async () => {
    close();
    const applyBtn = document.getElementById('btn-engine-apply');
    if (applyBtn) {
      applyBtn.click();
    }
    onProceed();
  };
}

// Bind to window for global callbacks from other files
window.confirmUnsavedChanges = confirmUnsavedChanges;
window.showDownloadingNavigationModal = showDownloadingNavigationModal;
window.getEngineApiKey = getEngineApiKey;
window.setEngineApiKey = setEngineApiKey;
