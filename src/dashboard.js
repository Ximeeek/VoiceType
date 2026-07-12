/**
 * Module: Dictation Control & Dashboard
 * Single Responsibility: Updates active engine status displays on the dashboard,
 * handles trigger words lists (adding, removing, Google Translate resolving),
 * and hooks dictation start/stop events.
 */

import { state } from './state.js';
import { t, updateDOMTranslations } from './i18n.js';
import { ToastManager } from './toast.js';

const translationCache = {
  "czarny_en": "black",
  "czarny_de": "schwarz",
  "komputer_en": "computer",
  "komputer_pl": "komputer",
  "zaczynamy_en": "start",
  "zaczynamy_de": "starten",
  "stop_en": "stop"
};

export async function resolveDynamicTranslation(word, targetLang) {
  const key = `${word.toLowerCase().trim()}_${targetLang}`;
  if (translationCache[key]) return translationCache[key];

  try {
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(word)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data[0] && data[0][0] && data[0][0][0]) {
        const translated = data[0][0][0].trim().toLowerCase();
        translationCache[key] = translated;
        return translated;
      }
    }
  } catch (e) {
    console.warn("Dynamic translation fallback:", e);
  }
  return word.toLowerCase();
}

export function renderTriggerWords(words) {
  state.triggerWords = words || [];
  const dashboardContainer = document.getElementById('trigger-chips-container');
  const settingsContainer = document.getElementById('settings-trigger-chips');
  
  const drawChips = async (container) => {
    if (!container) return;
    container.innerHTML = '';
    
    if (state.triggerWords.length === 0) {
      container.innerHTML = `<div style="color: var(--text-muted); font-size: 13px; font-style: italic;">${t('dash.no_triggers')}</div>`;
      return;
    }

    const lang = (state.pendingConfig && state.pendingConfig.general && state.pendingConfig.general.language) ? state.pendingConfig.general.language : 'pl';
    const shouldTranslate = state.pendingConfig && state.pendingConfig.trigger && state.pendingConfig.trigger.translate;

    for (const word of state.triggerWords) {
      const chip = document.createElement('div');
      chip.className = 'chip';
      
      let displayText = word;
      if (shouldTranslate) {
        const translated = await resolveDynamicTranslation(word, lang);
        displayText = `${word} (${lang}: ${translated})`;
      }

      chip.innerHTML = `
        <span>${displayText}</span>
        <span class="chip-remove" data-word="${word}">×</span>
      `;
      container.appendChild(chip);
    }

    container.querySelectorAll('.chip-remove').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const wordToRemove = e.target.getAttribute('data-word');
        console.log('[TRIGGER_UI] Removing trigger word:', wordToRemove);
        const updatedList = state.triggerWords.filter(w => w !== wordToRemove);
        
        state.triggerWords = updatedList;
        if (state.activeConfig && state.activeConfig.trigger) {
          state.activeConfig.trigger.words = updatedList;
        }
        if (state.pendingConfig && state.pendingConfig.trigger) {
          state.pendingConfig.trigger.words = updatedList;
        }

        renderTriggerWords(updatedList);
        
        if (window.__TAURI__) {
          try {
            await window.__TAURI__.core.invoke('set_trigger_words', { words: updatedList });
            ToastManager.show({ type: 'success', title: t('toast.trigger_updated') });
          } catch (err) {
            console.error('[TRIGGER_UI_ERROR] Failed to update trigger words on backend:', err);
            ToastManager.show({ type: 'error', title: t('toast.update_failed'), message: err.toString() });
          }
        }
      });
    });
  };

  drawChips(dashboardContainer);
  drawChips(settingsContainer);
}

export function renderStopWords(words) {
  state.stopWords = words || [];
  const settingsContainer = document.getElementById('settings-stop-chips');
  if (!settingsContainer) return;

  settingsContainer.innerHTML = '';
  
  if (state.stopWords.length === 0) {
    settingsContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 13px; font-style: italic;">${t('settings.no_stops')}</div>`;
    return;
  }

  state.stopWords.forEach(word => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.innerHTML = `
      <span>${word}</span>
      <span class="chip-remove" data-word="${word}">×</span>
    `;
    settingsContainer.appendChild(chip);
  });

  settingsContainer.querySelectorAll('.chip-remove').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const wordToRemove = e.target.getAttribute('data-word');
      console.log('[STOP_WORDS_UI] Removing stop word:', wordToRemove);
      const updatedList = state.stopWords.filter(w => w !== wordToRemove);
      
      state.stopWords = updatedList;
      if (state.activeConfig && state.activeConfig.dictation) {
        state.activeConfig.dictation.stop_words = updatedList;
      }
      if (state.pendingConfig && state.pendingConfig.dictation) {
        state.pendingConfig.dictation.stop_words = updatedList;
      }

      renderStopWords(updatedList);
      
      if (window.__TAURI__) {
        try {
          await window.__TAURI__.core.invoke('set_stop_words', { words: updatedList });
          ToastManager.show({ type: 'success', title: t('toast.stop_updated') });
        } catch (err) {
          console.error('[STOP_WORDS_UI_ERROR] Failed to update stop words on backend:', err);
          ToastManager.show({ type: 'error', title: t('toast.update_failed'), message: err.toString() });
        }
      }
    });
  });
}

export async function handleAddTrigger(inputEl) {
  if (!inputEl) return;
  const newWord = inputEl.value.trim().toLowerCase();
  if (!newWord) return;

  if (state.triggerWords.includes(newWord)) {
    ToastManager.show({ type: 'info', title: t('toast.word_registered') });
    return;
  }

  const updatedList = [...state.triggerWords, newWord];
  state.triggerWords = updatedList;
  if (state.activeConfig && state.activeConfig.trigger) {
    state.activeConfig.trigger.words = updatedList;
  }
  if (state.pendingConfig && state.pendingConfig.trigger) {
    state.pendingConfig.trigger.words = updatedList;
  }

  renderTriggerWords(updatedList);
  inputEl.value = '';

  if (window.__TAURI__) {
    try {
      await window.__TAURI__.core.invoke('set_trigger_words', { words: updatedList });
      ToastManager.show({ type: 'success', title: t('toast.trigger_added') });
    } catch (err) {
      console.error('[TRIGGER_UI_ERROR] Failed to set trigger words on backend:', err);
      ToastManager.show({ type: 'error', title: t('toast.add_failed'), message: err.toString() });
    }
  }
}

export async function handleAddStop() {
  const stopInput = document.getElementById('settings-stop-input');
  if (!stopInput) return;
  const newWord = stopInput.value.trim().toLowerCase();
  if (!newWord) return;

  if (state.stopWords.includes(newWord)) {
    ToastManager.show({ type: 'info', title: t('toast.word_registered') });
    return;
  }

  const updatedList = [...state.stopWords, newWord];
  state.stopWords = updatedList;
  if (state.activeConfig && state.activeConfig.dictation) {
    state.activeConfig.dictation.stop_words = updatedList;
  }
  if (state.pendingConfig && state.pendingConfig.dictation) {
    state.pendingConfig.dictation.stop_words = updatedList;
  }

  renderStopWords(updatedList);
  stopInput.value = '';

  if (window.__TAURI__) {
    try {
      await window.__TAURI__.core.invoke('set_stop_words', { words: updatedList });
      ToastManager.show({ type: 'success', title: t('toast.stop_added') });
    } catch (err) {
      ToastManager.show({ type: 'error', title: t('toast.add_failed'), message: err.toString() });
    }
  }
}

export async function checkActiveEngineAvailability() {
  const overlay = document.getElementById('dictation-disabled-overlay');
  const textEl = document.getElementById('dictation-disabled-text');
  const btnGoToDownloads = document.getElementById('btn-overlay-go-to-downloads');
  if (!overlay || !textEl) return;

  if (typeof window.checkIsDownloading === 'function' && window.checkIsDownloading()) {
    overlay.style.display = 'flex';
    textEl.textContent = t('dash.overlay.downloading_model');
    if (btnGoToDownloads) btnGoToDownloads.style.display = 'none';
    return;
  }

  if (!state.activeConfig || !state.activeConfig.engine) return;
  const engineId = state.activeConfig.engine.type;

  if (!['vosk', 'sherpa_onnx', 'whisper', 'faster_whisper'].includes(engineId)) {
    overlay.style.display = 'none';
    return;
  }

  let modelId = '';
  if (engineId === 'vosk') {
    modelId = (state.activeConfig.engine.vosk.model_path || '').split(/[/\\]/).pop();
  } else if (engineId === 'sherpa_onnx') {
    modelId = (state.activeConfig.engine.sherpa_onnx.model_path || '').split(/[/\\]/).pop();
  } else {
    modelId = state.activeConfig.engine.whisper.model;
  }

  if (!modelId) {
    overlay.style.display = 'flex';
    textEl.textContent = t('dash.overlay.missing_model');
    if (btnGoToDownloads) {
      btnGoToDownloads.style.display = 'block';
      btnGoToDownloads.textContent = t('dash.overlay.btn_download');
    }
    return;
  }

  if (window.__TAURI__) {
    const checkEngine = engineId === 'faster_whisper' ? 'whisper' : engineId;
    try {
      const isDownloaded = await window.__TAURI__.core.invoke('check_model_downloaded', { engine: checkEngine, model: modelId });
      if (isDownloaded) {
        overlay.style.display = 'none';
      } else {
        overlay.style.display = 'flex';
        textEl.textContent = t('dash.overlay.missing_model');
        if (btnGoToDownloads) {
          btnGoToDownloads.style.display = 'block';
          btnGoToDownloads.textContent = t('dash.overlay.btn_download');
        }
      }
    } catch (e) {
      console.error('Error checking active engine availability:', e);
    }
  } else {
    overlay.style.display = 'none';
  }
}

export async function updateDashboardActiveEngineCard() {
  if (!state.activeConfig || !state.activeConfig.engine) return;
  const engineId = state.activeConfig.engine.type;

  let nameMap = {
    vosk: 'Vosk Offline',
    sherpa_onnx: 'Sherpa-ONNX',
    whisper: 'Whisper.cpp',
    faster_whisper: 'Faster-Whisper',
    deepgram: 'Deepgram Online',
    assemblyai: 'AssemblyAI Online',
    openai: 'OpenAI Whisper',
    google: 'Google STT',
    azure: 'Azure Speech'
  };
  
  const prettyName = nameMap[engineId] || engineId;

  const activeEngineLabel = document.getElementById('engine-name');
  const activeEngineBadge = document.getElementById('engine-badge');
  const langBadge = document.getElementById('engine-lang-badge');
  const modelShortLabel = document.getElementById('engine-model-short');

  if (activeEngineLabel && activeEngineBadge) {
    activeEngineLabel.textContent = prettyName;
    const isStreaming = ['vosk', 'sherpa_onnx', 'deepgram', 'assemblyai', 'azure'].includes(engineId);
    activeEngineBadge.textContent = isStreaming ? 'Streaming' : 'Batch';
  }

  // GPU CUDA warning display check on dashboard
  const gpuWarningEl = document.getElementById('dashboard-gpu-warning');
  if (gpuWarningEl) {
    if (engineId === 'faster_whisper') {
      try {
        if (window.__TAURI__) {
          const isGpuSupported = await window.__TAURI__.core.invoke('check_gpu_support');
          const isCudaInstalled = await window.__TAURI__.core.invoke('check_cuda_installed');
          if (isGpuSupported && !isCudaInstalled) {
            gpuWarningEl.style.display = 'inline-flex';
            gpuWarningEl.setAttribute('title', t('engines.whisper.gpu_slower_warning'));
          } else {
            gpuWarningEl.style.display = 'none';
          }
        } else {
          gpuWarningEl.style.display = 'inline-flex';
          gpuWarningEl.setAttribute('title', t('engines.whisper.gpu_slower_warning'));
        }
      } catch (err) {
        console.error('[Dashboard] Error during active engine card GPU warning check:', err);
        gpuWarningEl.style.display = 'none';
      }
    } else {
      gpuWarningEl.style.display = 'none';
    }
  }

  if (langBadge && state.activeConfig.general) {
    langBadge.textContent = (state.activeConfig.general.language || 'pl').toUpperCase();
  }

  if (modelShortLabel) {
    if (['vosk', 'sherpa_onnx', 'whisper', 'faster_whisper'].includes(engineId)) {
      let rawModel = '';
      if (engineId === 'vosk') {
        const parts = (state.activeConfig.engine.vosk.model_path || '').split(/[/\\]/);
        rawModel = parts[parts.length - 1] || 'vosk-model';
      } else if (engineId === 'sherpa_onnx') {
        const parts = (state.activeConfig.engine.sherpa_onnx.model_path || '').split(/[/\\]/);
        rawModel = parts[parts.length - 1] || 'sherpa-model';
      } else {
        rawModel = state.activeConfig.engine.whisper.model || 'base';
      }
      let shortName = rawModel
        .replace(/^sherpa-onnx-/, '')
        .replace(/^vosk-model-/, '')
        .replace(/-0\.\d+$/, '')
        .replace(/-lgraph$/, '');

      if (window.__TAURI__) {
        const checkEngine = engineId === 'faster_whisper' ? 'whisper' : engineId;
        try {
          const isDownloaded = await window.__TAURI__.core.invoke('check_model_downloaded', { engine: checkEngine, model: rawModel });
          if (isDownloaded) {
            modelShortLabel.textContent = shortName;
            modelShortLabel.style.color = 'var(--text-muted)';
          } else {
            modelShortLabel.textContent = `${shortName} (${t('engines.status.not_installed')})`;
            modelShortLabel.style.color = '#ef4444';
          }
        } catch (e) {
          modelShortLabel.textContent = shortName;
          modelShortLabel.style.color = 'var(--text-muted)';
        }
      } else {
        modelShortLabel.textContent = shortName;
        modelShortLabel.style.color = 'var(--text-muted)';
      }
    } else {
      modelShortLabel.textContent = 'Chmura';
      modelShortLabel.style.color = 'var(--text-muted)';
    }
  }
}

export function setupDashboardEventListeners() {
  const triggerInputDashboard = document.getElementById('trigger-input');
  const triggerAddBtnDashboard = document.getElementById('trigger-add-btn');
  const triggerInputSettings = document.getElementById('settings-trigger-input');
  const triggerAddBtnSettings = document.getElementById('settings-trigger-add-btn');

  if (triggerAddBtnDashboard) triggerAddBtnDashboard.addEventListener('click', () => handleAddTrigger(triggerInputDashboard));
  if (triggerInputDashboard) triggerInputDashboard.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAddTrigger(triggerInputDashboard); });
  if (triggerAddBtnSettings) triggerAddBtnSettings.addEventListener('click', () => handleAddTrigger(triggerInputSettings));
  if (triggerInputSettings) triggerInputSettings.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAddTrigger(triggerInputSettings); });

  const stopInput = document.getElementById('settings-stop-input');
  const stopAddBtn = document.getElementById('settings-stop-add-btn');

  if (stopAddBtn) stopAddBtn.addEventListener('click', handleAddStop);
  if (stopInput) stopInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAddStop(); });

  const btnGoToDownloads = document.getElementById('btn-overlay-go-to-downloads');
  if (btnGoToDownloads) {
    btnGoToDownloads.onclick = () => {
      const activeEngineId = state.activeConfig ? state.activeConfig.engine.type : 'vosk';
      let modelId = '';
      if (activeEngineId === 'vosk') {
        modelId = (state.activeConfig.engine.vosk.model_path || '').split(/[/\\]/).pop();
      } else if (activeEngineId === 'sherpa_onnx') {
        modelId = (state.activeConfig.engine.sherpa_onnx.model_path || '').split(/[/\\]/).pop();
      } else {
        modelId = state.activeConfig.engine.whisper.model;
      }
      
      console.log(`[Dashboard] Overlay 'Go to downloads' clicked. Pre-highlighting model: ${modelId} under engine: ${activeEngineId}`);
      state.pendingModelHighlight = { engineId: activeEngineId, modelId };

      const navDownloads = document.getElementById('nav-downloads');
      if (navDownloads) navDownloads.click();
    };
  }
}

// Bind to window for global access
window.checkActiveEngineAvailability = checkActiveEngineAvailability;
window.updateDashboardActiveEngineCard = updateDashboardActiveEngineCard;
window.renderTriggerWords = renderTriggerWords;
window.renderStopWords = renderStopWords;
window.handleAddTrigger = handleAddTrigger;
window.handleAddStop = handleAddStop;
