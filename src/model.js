/**
 * Module: Engine Models Manager
 * Single Responsibility: Manages available offline speech models (Vosk, Sherpa, Whisper),
 * download queue, progress trackers, model storage cleanups, and local environment setup.
 */

import { state } from './state.js';
import { t } from './i18n.js';
import { ToastManager } from './toast.js';

export function formatBytes(bytes) {
  if (bytes > 1073741824) {
    return (bytes / 1073741824).toFixed(2) + ' GB';
  } else {
    return (bytes / 1048576).toFixed(1) + ' MB';
  }
}

export async function renderAvailableModels(engineId) {
  if (engineId === 'faster_whisper') engineId = 'whisper';
  let container = document.getElementById('config-fields-whisper');
  if (engineId === 'vosk') container = document.getElementById('config-fields-vosk');
  if (engineId === 'sherpa_onnx') container = document.getElementById('config-fields-sherpa');
  if (!container) return;

  const radioGroup = container.querySelector('.radio-group');
  if (!radioGroup) return;

  if (window.__TAURI__) {
    try {
      // Show animated loader while downloading the list from server
      radioGroup.innerHTML = `
        <div style="color: var(--text-secondary); font-size: 13px; display: flex; align-items: center; gap: 10px; padding: 5px 0;">
          <span class="spinner" style="width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.1); border-top-color: var(--accent-green); border-radius: 50%; display: inline-block; animation: spin 0.8s linear infinite;"></span>
          ${t('engines.loading_models')}
        </div>
      `;
      
      const lang = state.pendingConfig ? state.pendingConfig.general.language : 'pl';
      const models = await window.__TAURI__.core.invoke('get_available_models', { engine: engineId, language: lang });
      radioGroup.innerHTML = '';
      
      if (models.length === 0) {
        radioGroup.innerHTML = `<div style="color: var(--text-muted); font-size: 13px;">${t('engines.no_models_found')}</div>`;
        return;
      }

      // Check active model based on pendingConfig
      let hasActive = false;
      models.forEach(model => {
        if (state.pendingConfig) {
          if (engineId === 'vosk') {
            model.is_active = state.pendingConfig.engine.vosk.model_path.includes(model.id);
          } else if (engineId === 'sherpa_onnx') {
            model.is_active = state.pendingConfig.engine.sherpa_onnx.model_path.includes(model.id);
          } else {
            model.is_active = state.pendingConfig.engine.whisper.model === model.id;
          }
          if (model.is_active) hasActive = true;
        }
      });

      // If no model is active in current configuration, auto-select first one
      if (!hasActive && models.length > 0) {
        let shouldAutoSelect = false;
        if (state.pendingConfig && state.activeConfig) {
          let currentModelId = '';
          if (engineId === 'vosk') {
            currentModelId = (state.pendingConfig.engine.vosk.model_path || '').split(/[/\\]/).pop();
          } else if (engineId === 'sherpa_onnx') {
            currentModelId = (state.pendingConfig.engine.sherpa_onnx.model_path || '').split(/[/\\]/).pop();
          } else {
            currentModelId = state.pendingConfig.engine.whisper.model;
          }
          
          if (!currentModelId || 
              state.pendingConfig.general.language !== state.activeConfig.general.language ||
              state.pendingConfig.engine.type !== state.activeConfig.engine.type) {
            shouldAutoSelect = true;
          }
        } else {
          shouldAutoSelect = true;
        }

        if (shouldAutoSelect) {
          console.log(`[renderAvailableModels] Auto-selecting first model for engine '${engineId}' (no active model).`);
          models[0].is_active = true;
          const modelId = models[0].id;
          if (state.pendingConfig) {
            if (engineId === 'vosk') {
              state.pendingConfig.engine.vosk.model_path = `models/vosk/${modelId}`;
            } else if (engineId === 'sherpa_onnx') {
              state.pendingConfig.engine.sherpa_onnx.model_path = `models/sherpa/${modelId}`;
            } else {
              state.pendingConfig.engine.whisper.model = modelId;
            }
            if (typeof window.checkEngineDirty === 'function') {
              window.checkEngineDirty();
            }
          }
        }
      }

      models.forEach(model => {
        const label = document.createElement('label');
        label.className = 'radio-container';
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.marginBottom = '10px';
        label.style.cursor = 'pointer';
        label.innerHTML = `
          <input type="radio" name="${engineId}-model-size" value="${model.id}" ${model.is_active ? 'checked' : ''}>
          <span class="radio-label" style="margin-left: 8px;">${model.name} (${model.size_text})</span>
        `;
        radioGroup.appendChild(label);
      });

      if (engineId === 'vosk') {
        const tip = document.createElement('div');
        tip.style.marginTop = '12px';
        tip.style.fontSize = '12px';
        tip.style.color = 'var(--text-muted)';
        tip.style.lineHeight = '1.5';
        tip.innerHTML = t('engines.tip.whisper');
        radioGroup.appendChild(tip);
      } else if (engineId === 'sherpa_onnx') {
        const tip = document.createElement('div');
        tip.style.marginTop = '12px';
        tip.style.fontSize = '12px';
        tip.style.color = 'var(--text-muted)';
        tip.style.lineHeight = '1.5';
        tip.innerHTML = t('engines.tip.sherpa');
        radioGroup.appendChild(tip);
      }

      // Register choice change
      const radios = radioGroup.querySelectorAll(`input[name="${engineId}-model-size"]`);
      radios.forEach(radio => {
        radio.onchange = async (e) => {
          const modelId = e.target.value;
          if (window.__TAURI__) {
            try {
              const info = await window.__TAURI__.core.invoke('get_model_info_cmd', { engine: engineId, model: modelId });
              if (engineId === 'vosk') {
                state.pendingConfig.engine.vosk.model_path = `models/${info.dest_filename}`;
              } else if (engineId === 'sherpa_onnx') {
                state.pendingConfig.engine.sherpa_onnx.model_path = `models/${info.dest_filename}`;
              } else {
                state.pendingConfig.engine.whisper.model = modelId;
              }
              if (typeof window.checkEngineDirty === 'function') {
                window.checkEngineDirty();
              }
              updateModelStatusText(engineId, modelId);
            } catch (err) {
              ToastManager.show({ type: 'error', title: t('toast.model_config_error'), message: err.toString() });
            }
          }
        };
      });

      // Set initial status
      const activeModel = models.find(m => m.is_active) || models[0];
      if (activeModel) {
        updateModelStatusText(engineId, activeModel.id);
      }
    } catch (err) {
      console.error('Error fetching model list:', err);
    }
  }
}

export async function updateModelStatusText(engineId, modelId) {
  let statusSpanId = 'whisper-model-status';
  if (engineId === 'vosk') statusSpanId = 'vosk-model-status';
  if (engineId === 'sherpa_onnx') statusSpanId = 'sherpa-model-status';

  const statusSpan = document.getElementById(statusSpanId);
  if (!statusSpan) return;

  let btnId = 'btn-download-whisper';
  if (engineId === 'vosk') btnId = 'btn-download-vosk';
  if (engineId === 'sherpa_onnx') btnId = 'btn-download-sherpa';

  const downloadBtn = document.getElementById(btnId);

  if (window.__TAURI__) {
    try {
      const checkEngine = engineId === 'faster_whisper' ? 'whisper' : engineId;
      const isDownloaded = await window.__TAURI__.core.invoke('check_model_downloaded', { engine: checkEngine, model: modelId });
      if (isDownloaded) {
        statusSpan.textContent = t('engines.status.downloaded');
        statusSpan.className = 'status-value highlight';
        if (downloadBtn) {
          downloadBtn.textContent = t('engines.status.downloaded');
          downloadBtn.disabled = true;
          downloadBtn.style.opacity = '0.5';
          downloadBtn.style.cursor = 'not-allowed';
        }
      } else {
        statusSpan.textContent = t('engines.status.not_downloaded');
        statusSpan.className = 'status-value';
        if (downloadBtn) {
          downloadBtn.textContent = t('engines.status.btn_download');
          downloadBtn.disabled = false;
          downloadBtn.style.opacity = '1';
          downloadBtn.style.cursor = 'pointer';
        }
      }
    } catch (err) {
      console.error(err);
    }
  }
}

export function checkIsDownloading() {
  return state.downloadQueue.some(q => q.status === 'downloading' || q.status === 'queued');
}

export async function updateQuickModelOptions() {
  const quickEngineSelect = document.getElementById('quick-download-engine');
  const quickLangSelect = document.getElementById('quick-download-lang');
  const quickModelSelect = document.getElementById('quick-download-model');
  const quickModelLoader = document.getElementById('quick-download-model-loader');
  const quickDownloadBtn = document.getElementById('quick-download-btn');

  if (!quickEngineSelect || !quickModelSelect) return;
  const eng = quickEngineSelect.value;
  
  if (quickModelLoader) quickModelLoader.style.display = 'block';
  quickModelSelect.disabled = true;
  if (quickDownloadBtn) quickDownloadBtn.disabled = true;

  if (eng === 'whisper' || eng === 'faster_whisper') {
    if (quickLangSelect) {
      quickLangSelect.innerHTML = `<option value="all">${t('downloads.quick.all_langs')}</option>`;
      quickLangSelect.disabled = true;
    }
  } else {
    if (quickLangSelect && quickLangSelect.disabled) {
      quickLangSelect.disabled = false;
      quickLangSelect.innerHTML = `
        <option value="pl">Polski (Polish)</option>
        <option value="en">English (Angielski)</option>
        <option value="de">Deutsch (Niemiecki)</option>
        <option value="fr">Français (Francuski)</option>
        <option value="es">Español (Hiszpański)</option>
        <option value="it">Italiano (Włoski)</option>
        <option value="ru">Русский (Rosyjski)</option>
      `;
      if (state.activeConfig && state.activeConfig.general) {
        quickLangSelect.value = state.activeConfig.general.language;
      } else if (state.pendingConfig && state.pendingConfig.general) {
        quickLangSelect.value = state.pendingConfig.general.language;
      } else {
        quickLangSelect.value = 'pl';
      }
    }
  }

  const currentLang = (eng === 'whisper' || eng === 'faster_whisper') ? null : (quickLangSelect ? quickLangSelect.value : 'pl');
  const targetEngine = (eng === 'faster_whisper') ? 'whisper' : eng;

  try {
    let models = [];
    if (window.__TAURI__) {
      models = await window.__TAURI__.core.invoke('get_available_models', { engine: targetEngine, language: currentLang });
    } else {
      // Mock models for local testing
      if (targetEngine === 'vosk') {
        if (currentLang === 'pl') {
          models = [
            { id: 'vosk-model-small-pl-0.22', name: 'Mikro (small) - vosk-model-small-pl-0.22', size_text: '50 MB', is_downloaded: false },
            { id: 'vosk-model-pl-0.22-lgraph', name: 'Duży (lgraph) - vosk-model-pl-0.22-lgraph', size_text: '1.2 GB', is_downloaded: false }
          ];
        } else {
          models = [
            { id: 'vosk-model-small-en-us-0.15', name: 'Mikro (small) - vosk-model-small-en-us-0.15', size_text: '40 MB', is_downloaded: false }
          ];
        }
      } else if (targetEngine === 'sherpa_onnx') {
        models = [
          { id: 'sherpa-onnx-whisper-tiny', name: 'Whisper ONNX Tiny (Multilingual)', size_text: '75 MB', is_downloaded: false },
          { id: 'sherpa-onnx-whisper-small', name: 'Whisper ONNX Small (Multilingual)', size_text: '480 MB', is_downloaded: false }
        ];
      } else {
        models = [
          { id: 'tiny', name: 'Whisper tiny', size_text: '77 MB', is_downloaded: false },
          { id: 'base', name: 'Whisper base', size_text: '147 MB', is_downloaded: false }
        ];
      }
    }

    quickModelSelect.innerHTML = '';
    if (models.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = t('engines.no_models_found');
      quickModelSelect.appendChild(opt);
    } else {
      models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = `${m.name} (${m.size_text})${m.is_downloaded ? ` ✔ (${t('engines.status.installed')})` : ''}`;
        quickModelSelect.appendChild(opt);
      });
      if (quickDownloadBtn) quickDownloadBtn.disabled = false;

      // Handle pending model highlight
      if (state.pendingModelHighlight) {
        try {
          const { modelId } = state.pendingModelHighlight;
          if (quickModelSelect && modelId) {
            const optionExists = Array.from(quickModelSelect.options).some(opt => opt.value === modelId);
            if (optionExists) {
              quickModelSelect.value = modelId;
            } else {
              const partialOpt = Array.from(quickModelSelect.options).find(opt => opt.value.includes(modelId) || modelId.includes(opt.value));
              if (partialOpt) {
                quickModelSelect.value = partialOpt.value;
              }
            }
          }
          if (quickDownloadBtn) {
            quickDownloadBtn.classList.add('btn-highlight-pulse');
          }
        } catch (err) {
          console.error('[QuickDownload] Error highlighting target model:', err);
        } finally {
          state.pendingModelHighlight = null;
        }
      }
    }
  } catch (err) {
    console.error('Error fetching available models:', err);
    quickModelSelect.innerHTML = `<option value="">${t('engines.no_models_found')}</option>`;
  } finally {
    if (quickModelLoader) quickModelLoader.style.display = 'none';
    quickModelSelect.disabled = false;
  }
}

export function getDownloadMode() {
  const checked = document.querySelector('input[name="download-mode"]:checked');
  return checked ? checked.value : 'sequential';
}

let isProcessingQueue = false;

export async function processDownloadQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  try {
    const mode = getDownloadMode();
    const downloadingItems = state.downloadQueue.filter(q => q.status === 'downloading');
    const queuedItems = state.downloadQueue.filter(q => q.status === 'queued');

    if (queuedItems.length === 0) return;

    if (mode === 'sequential') {
      if (downloadingItems.length === 0) {
        const nextItem = queuedItems[0];
        await startSingleDownload(nextItem);
      }
    } else {
      for (const item of queuedItems) {
        startSingleDownload(item);
      }
    }
  } finally {
    isProcessingQueue = false;
  }
}

export async function startSingleDownload(item) {
  console.log('[DOWNLOAD_START] Starting download for item:', item);
  item.status = 'downloading';
  renderDownloadQueue();
  updateDashboardDownloadState(null);
  updateGlobalProcessingBanner(true, t('downloads.status.downloading'), item.model);

  if (window.__TAURI__) {
    try {
      ToastManager.show({ type: 'info', title: t('toast.download_started'), message: t('toast.download_started_msg', { model: item.model }) });
      const checkEngine = item.engine === 'faster_whisper' ? 'whisper' : item.engine;
      await window.__TAURI__.core.invoke('download_model', { engine: checkEngine, model: item.model });
      
      if (item.status !== 'cancelled') {
        item.status = 'completed';
        ToastManager.show({ type: 'success', title: t('toast.download_finished'), message: t('toast.download_finished_msg', { model: item.model }) });
      }
    } catch (err) {
      console.error('[DOWNLOAD_ERROR] Error occurred during download:', err);
      if (item.status !== 'cancelled') {
        item.status = 'error';
        ToastManager.show({ type: 'error', title: t('toast.download_error'), message: err.toString() });
      }
    } finally {
      const isAnyActiveLeft = state.downloadQueue.some(q => q.status === 'downloading');
      if (!isAnyActiveLeft) {
        updateGlobalProcessingBanner(false);
      }
      renderDownloadQueue();
      updateDashboardDownloadState(null);
      renderInstalledModelsManager();
      updateQuickModelOptions();
      setTimeout(() => processDownloadQueue(), 300);
    }
  } else {
    // Mock download behavior
    let percent = 0;
    const interval = setInterval(() => {
      if (item.status === 'cancelled') {
        clearInterval(interval);
        return;
      }
      percent += 20;
      updateDownloadProgress({
        model: item.model,
        downloaded_mb: Math.floor(percent * 0.5),
        total_mb: 50,
        percent: percent
      });
      if (percent >= 100) {
        clearInterval(interval);
        item.status = 'completed';
        renderDownloadQueue();
        updateQuickModelOptions();
        setTimeout(() => processDownloadQueue(), 300);
      }
    }, 400);
  }
}

export async function triggerModelDownloadExplicit(engineId, modelName) {
  const progressContainer = document.getElementById('download-progress-container');
  const fill = document.getElementById('download-progress-fill');
  const text = document.getElementById('download-progress-text');
  const percentEl = document.getElementById('download-progress-percent');

  if (progressContainer) progressContainer.style.display = 'block';
  if (fill) fill.style.width = '0%';
  if (percentEl) percentEl.textContent = '0%';
  if (text) text.textContent = t('downloads.active.initializing');

  addModelToDownloadQueue(engineId, modelName);
}

export async function triggerModelDownload(engineId) {
  let modelName = '';
  const checkedRadio = document.querySelector(`input[name="${engineId}-model-size"]:checked`);
  if (checkedRadio) {
    modelName = checkedRadio.value;
  }

  if (!modelName) {
    ToastManager.show({ type: 'error', title: t('toast.select_model_title'), message: t('toast.select_model_msg') });
    return;
  }

  const progressContainer = document.getElementById('download-progress-container');
  const fill = document.getElementById('download-progress-fill');
  const text = document.getElementById('download-progress-text');
  const percentEl = document.getElementById('download-progress-percent');

  if (progressContainer) progressContainer.style.display = 'block';
  if (fill) fill.style.width = '0%';
  if (percentEl) percentEl.textContent = '0%';
  if (text) text.textContent = t('downloads.active.initializing');

  addModelToDownloadQueue(engineId, modelName);
}

export function updateDashboardDownloadState(progress) {
  const dashStatus = document.getElementById('dashboard-engine-download-status');
  const dashFill = document.getElementById('dashboard-engine-progress-fill');
  const dashText = document.getElementById('dashboard-engine-progress-text');
  const dashPercent = document.getElementById('dashboard-engine-progress-percent');

  const isDownloading = checkIsDownloading();

  if (typeof window.checkActiveEngineAvailability === 'function') {
    window.checkActiveEngineAvailability();
  }
  if (typeof window.updateDashboardActiveEngineCard === 'function') {
    window.updateDashboardActiveEngineCard();
  }

  if (dashStatus && dashFill && dashText && dashPercent) {
    if (isDownloading && progress && progress.percent < 100) {
      dashStatus.style.display = 'block';
      dashFill.style.width = `${progress.percent}%`;
      dashPercent.textContent = `${Math.round(progress.percent)}%`;
      if (progress.downloaded_mb !== undefined && progress.total_mb !== undefined) {
        dashText.textContent = `${progress.downloaded_mb.toFixed(1)} MB / ${progress.total_mb.toFixed(1)} MB`;
      } else {
        dashText.textContent = t('dash.status.downloading_model');
      }
    } else {
      dashStatus.style.display = 'none';
    }
  }
}

export function updateGlobalProcessingBanner(active, message = null, detail = null) {
  const banner = document.getElementById('global-processing-banner');
  const titleEl = document.getElementById('processing-banner-title');
  const detailEl = document.getElementById('processing-banner-detail');

  if (!banner) return;

  if (active) {
    banner.style.display = 'flex';
    if (titleEl) titleEl.textContent = message || '';
    if (detailEl) {
      detailEl.textContent = detail || '';
      detailEl.style.display = detail ? 'block' : 'none';
    }
  } else {
    banner.style.display = 'none';
  }
}

export function updateDownloadProgress(progress) {
  const queueItem = state.downloadQueue.find(q => q.model === progress.model);
  if (queueItem) {
    if (queueItem.status === 'cancelled') return;
    queueItem.percent = progress.percent;
    queueItem.downloaded_mb = progress.downloaded_mb;
    queueItem.total_mb = progress.total_mb;
    if (progress.percent >= 100) {
      queueItem.status = 'completed';
    }
  }

  let activeStatusText = '';
  if (progress.status_key) {
    activeStatusText = t(`downloads.status.${progress.status_key}`);
  } else if (progress.status_text) {
    const rawText = progress.status_text;
    if (rawText === 'Pobieranie pliku...') activeStatusText = t('downloads.status.downloading');
    else if (rawText === 'Rozpakowywanie archiwum...') activeStatusText = t('downloads.status.unpacking');
    else if (rawText === 'Finalizowanie zapisu...') activeStatusText = t('downloads.status.finalizing');
    else if (rawText === 'Ukończono') activeStatusText = t('downloads.status.completed');
    else activeStatusText = rawText;
  } else {
    activeStatusText = progress.percent >= 99.9 && progress.percent < 100 ? t('downloads.status.unpacking') : t('downloads.status.downloading');
  }

  if (progress.percent < 100) {
    const detailMsg = progress.downloaded_mb !== undefined && progress.total_mb !== undefined
      ? `${progress.model} — ${progress.downloaded_mb.toFixed(1)} MB / ${progress.total_mb.toFixed(1)} MB (${Math.round(progress.percent)}%)`
      : `${progress.model} (${Math.round(progress.percent)}%)`;
    updateGlobalProcessingBanner(true, activeStatusText, detailMsg);
  }

  let updatedDOM = false;
  if (queueItem) {
    const itemEl = document.getElementById(`download-item-${queueItem.id}`);
    if (itemEl) {
      const fill = itemEl.querySelector('.progress-bar-fill');
      const stats = itemEl.querySelector('.download-stats');
      const percentEl = itemEl.querySelector('.download-percent');
      const badge = itemEl.querySelector('.download-badge');

      if (fill) fill.style.width = `${progress.percent}%`;
      if (percentEl) percentEl.textContent = `${Math.round(progress.percent)}%`;
      if (stats) {
        let statusLbl = '';
        if (progress.status_key) {
          statusLbl = t(`downloads.status.${progress.status_key}`);
        } else if (progress.status_text) {
          const rawText = progress.status_text;
          if (rawText === 'Pobieranie pliku...') statusLbl = t('downloads.status.downloading');
          else if (rawText === 'Rozpakowywanie archiwum...') statusLbl = t('downloads.status.unpacking');
          else if (rawText === 'Finalizowanie zapisu...') statusLbl = t('downloads.status.finalizing');
          else if (rawText === 'Ukończono') statusLbl = t('downloads.status.completed');
          else statusLbl = rawText;
        }

        if (statusLbl && progress.percent < 100) {
          if (progress.downloaded_mb !== undefined && progress.total_mb !== undefined) {
            stats.textContent = `${progress.downloaded_mb.toFixed(1)} MB / ${progress.total_mb.toFixed(1)} MB (${statusLbl})`;
          } else {
            stats.textContent = statusLbl;
          }
        } else if (progress.downloaded_mb !== undefined && progress.total_mb !== undefined) {
          stats.textContent = `${progress.downloaded_mb.toFixed(1)} MB / ${progress.total_mb.toFixed(1)} MB`;
        } else {
          stats.textContent = t('downloads.status.finalizing') || 'Kończenie pobierania...';
        }
      }
      if (badge && queueItem.status === 'completed') {
        badge.style.color = 'var(--accent-green)';
        badge.style.background = 'rgba(16,185,129,0.15)';
        badge.textContent = t('downloads.status.completed');
      }
      updatedDOM = true;
    }
  }

  const container = document.getElementById('download-progress-container');
  const fill = document.getElementById('download-progress-fill');
  const text = document.getElementById('download-progress-text');
  const percentEl = document.getElementById('download-progress-percent');

  if (container && fill && text && percentEl) {
    container.style.display = 'block';
    fill.style.width = `${progress.percent}%`;
    
    let statusLbl = '';
    if (progress.status_key) {
      statusLbl = t(`downloads.status.${progress.status_key}`);
    } else if (progress.status_text) {
      const rawText = progress.status_text;
      if (rawText === 'Pobieranie pliku...') statusLbl = t('downloads.status.downloading');
      else if (rawText === 'Rozpakowywanie archiwum...') statusLbl = t('downloads.status.unpacking');
      else if (rawText === 'Finalizowanie zapisu...') statusLbl = t('downloads.status.finalizing');
      else if (rawText === 'Ukończono') statusLbl = t('downloads.status.completed');
      else statusLbl = rawText;
    }

    if (statusLbl) {
      text.textContent = statusLbl;
    } else if (progress.downloaded_mb !== undefined && progress.total_mb !== undefined) {
      text.textContent = `${progress.downloaded_mb.toFixed(1)} MB / ${progress.total_mb.toFixed(1)} MB`;
    } else {
      text.textContent = progress.done ? t('downloads.status.completed') : (t('downloads.status.finalizing') || 'Kończenie pobierania...');
    }
    
    percentEl.textContent = `${Math.round(progress.percent)}%`;
  }

  updateDashboardDownloadState(progress);

  if (!updatedDOM || progress.percent >= 100) {
    renderDownloadQueue();
  }

  if (progress.percent >= 100) {
    const isAnyActiveLeft = state.downloadQueue.some(q => q.status === 'downloading' && q.model !== progress.model);
    if (!isAnyActiveLeft) {
      updateGlobalProcessingBanner(false);
    }
    setTimeout(() => {
      if (container) container.style.display = 'none';
      const engineId = progress.model.startsWith('vosk-model') ? 'vosk' : (progress.model.startsWith('sherpa') ? 'sherpa_onnx' : 'whisper');
      updateModelStatusText(engineId, progress.model);
      renderInstalledModelsManager();
      updateDashboardDownloadState(null);
    }, 2000);
  }
}

export function removeModelFromDownloadQueue(engine, model) {
  const normalize = (eng) => (eng === 'faster_whisper' ? 'whisper' : eng);
  const targetEngine = normalize(engine);

  for (let i = state.downloadQueue.length - 1; i >= 0; i--) {
    const item = state.downloadQueue[i];
    const itemEngine = normalize(item.engine);
    if (model) {
      if (itemEngine === targetEngine && item.model === model) {
        state.downloadQueue.splice(i, 1);
      }
    } else {
      if (itemEngine === targetEngine) {
        state.downloadQueue.splice(i, 1);
      }
    }
  }
  renderDownloadQueue();
}

export function addModelToDownloadQueue(engine, model) {
  let existing = state.downloadQueue.find(q => q.engine === engine && q.model === model);
  if (existing) {
    if (existing.status === 'completed') {
      ToastManager.show({ type: 'info', title: t('toast.model_downloaded_title'), message: t('toast.model_downloaded_msg') });
      return;
    }
    existing.status = 'queued';
    existing.percent = 0;
  } else {
    existing = {
      id: `${engine}_${model}`,
      engine,
      model,
      status: 'queued',
      percent: 0,
      downloaded_mb: 0,
      total_mb: 0,
    };
    state.downloadQueue.push(existing);
  }
  updateDashboardDownloadState(null);
  renderDownloadQueue();
  processDownloadQueue();
}

export function renderDownloadQueue() {
  const activeContainer = document.getElementById('download-active-container');
  const historyContainer = document.getElementById('download-history-container');
  if (!activeContainer || !historyContainer) return;

  const activeItems = state.downloadQueue.filter(q => q.status === 'downloading' || q.status === 'queued' || q.status === 'paused');
  const historyItems = state.downloadQueue.filter(q => q.status === 'completed' || q.status === 'cancelled' || q.status === 'error');

  const isDownloading = activeItems.length > 0;
  document.querySelectorAll('input[name="download-mode"]').forEach(radio => {
    radio.disabled = isDownloading;
  });

  if (activeItems.length === 0) {
    activeContainer.innerHTML = `<div style="font-size: 13px; color: var(--text-muted); font-style: italic;">${t('downloads.active.empty')}</div>`;
  } else {
    activeContainer.innerHTML = '';
    activeItems.forEach(item => {
      const el = document.createElement('div');
      el.id = `download-item-${item.id}`;
      el.style.background = 'rgba(255,255,255,0.02)';
      el.style.border = '1px solid var(--border-subtle)';
      el.style.borderRadius = '8px';
      el.style.padding = '12px 14px';
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      el.style.gap = '8px';

      const badge = item.status === 'downloading' ? 
        t('downloads.active.downloading') :
        t('downloads.active.queued');
      const badgeStyle = item.status === 'downloading' ?
        'color: var(--accent-green); background: rgba(16,185,129,0.15);' :
        'color: var(--accent-gold); background: rgba(245,158,11,0.15);';

      el.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 700; font-size: 13px; color: var(--text-primary);">${item.model}</span>
            <span style="font-size: 10px; color: var(--text-muted); background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">${item.engine}</span>
            <span class="download-badge" style="${badgeStyle} padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;">${badge}</span>
          </div>
          <button class="btn-cancel-queue" data-id="${item.id}" style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">${t('btn.cancel')}</button>
        </div>
        <div class="progress-bar-bg" style="background: rgba(255,255,255,0.06); height: 6px; border-radius: 3px; overflow: hidden;">
          <div class="progress-bar-fill" style="width: ${item.percent}%; height: 100%; background: var(--accent-green); transition: width 0.2s;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted);">
          <span class="download-stats">${item.downloaded_mb ? `${item.downloaded_mb.toFixed(1)} MB / ${item.total_mb.toFixed(1)} MB` : t('downloads.active.initializing')}</span>
          <span class="download-percent">${Math.round(item.percent)}%</span>
        </div>
      `;
      activeContainer.appendChild(el);
    });

    activeContainer.onclick = async (e) => {
      const btn = e.target.closest('.btn-cancel-queue');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      const item = state.downloadQueue.find(q => q.id === id);
      if (item) {
        item.status = 'cancelled';
        item.percent = 0;
        if (window.__TAURI__) {
          const checkEngine = item.engine === 'faster_whisper' ? 'whisper' : item.engine;
          try {
            await window.__TAURI__.core.invoke('cleanup_model_tmp_files', { engine: checkEngine, model: item.model });
          } catch (err) {
            console.error('[CANCEL_QUEUE] Error during cleanup:', err);
          }
        }
        ToastManager.show({ type: 'info', title: t('toast.download_cancelled'), message: t('toast.download_cancelled_msg', { model: item.model }) });
        updateDashboardDownloadState(null);
        renderDownloadQueue();
        setTimeout(() => processDownloadQueue(), 300);
      }
    };
  }

  if (historyItems.length === 0) {
    historyContainer.innerHTML = `<div style="font-size: 13px; color: var(--text-muted); font-style: italic;">${t('downloads.history.empty')}</div>`;
  } else {
    historyContainer.innerHTML = '';
    historyItems.forEach(item => {
      const el = document.createElement('div');
      el.style.background = 'rgba(255,255,255,0.01)';
      el.style.border = '1px solid rgba(255,255,255,0.04)';
      el.style.borderRadius = '6px';
      el.style.padding = '8px 12px';
      el.style.display = 'flex';
      el.style.justifyContent = 'space-between';
      el.style.alignItems = 'center';

      const statusBadge = item.status === 'completed' ?
        `<span style="color: var(--accent-green); background: rgba(16,185,129,0.12); padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">${t('downloads.history.completed')}</span>` :
        `<span style="color: var(--text-error); background: rgba(239,68,68,0.12); padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">${t('downloads.history.cancelled')}</span>`;

      el.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 13px; font-weight: 600; color: var(--text-secondary);">${item.model}</span>
          <span style="font-size: 10px; color: var(--text-muted); background: rgba(255,255,255,0.04); padding: 1px 5px; border-radius: 3px;">${item.engine}</span>
        </div>
        <div>${statusBadge}</div>
      `;
      historyContainer.appendChild(el);
    });
  }
}

export async function renderInstalledModelsManager() {
  const container = document.getElementById('installed-models-container');
  const totalBadge = document.getElementById('installed-models-total-badge');
  if (!container) return;

  if (window.__TAURI__) {
    try {
      const groups = await window.__TAURI__.core.invoke('get_installed_models_summary');
      container.innerHTML = '';

      let grandTotalBytes = 0;

      groups.forEach(group => {
        grandTotalBytes += group.total_size_bytes;

        const groupEl = document.createElement('div');
        groupEl.style.background = 'rgba(255,255,255,0.02)';
        groupEl.style.border = '1px solid var(--border-subtle)';
        groupEl.style.borderRadius = '10px';
        groupEl.style.padding = '14px 16px';
        groupEl.style.display = 'flex';
        groupEl.style.flexDirection = 'column';
        groupEl.style.gap = '12px';

        let modelsHtml = '';
        if (group.models.length === 0) {
          modelsHtml = `<div style="font-size: 12px; color: var(--text-muted); font-style: italic;">${t('models.manager.empty_group')}</div>`;
        } else {
          modelsHtml = group.models.map(m => `
            <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-elevated); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.04);">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 13px; font-weight: 500; color: var(--text-primary);">${m.name}</span>
                <span style="font-size: 11px; color: var(--text-muted); background: rgba(255, 255, 255, 0.06); padding: 2px 6px; border-radius: 4px;">${m.size_text}</span>
              </div>
              <button class="btn-delete-single-model" data-engine="${group.engine_id}" data-model="${m.model_id}" title="${t('models.manager.delete_tooltip')}" style="background: transparent; border: none; color: #ff4d4d; cursor: pointer; padding: 4px 8px; border-radius: 4px; display: flex; align-items: center; gap: 4px; font-size: 12px; transition: background 0.2s;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>
                ${t('models.manager.delete')}
              </button>
            </div>
          `).join('');
        }

        groupEl.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 14px; color: var(--accent-green);">${group.engine_name}</span>
              <span style="font-size: 12px; color: var(--text-secondary); font-weight: 600;">(${group.total_size_text})</span>
            </div>
            ${group.models.length > 0 ? `
              <button class="btn-delete-group-models" data-engine="${group.engine_id}" title="${t('models.manager.delete_all')}" style="background: rgba(255, 77, 77, 0.1); border: 1px solid rgba(255, 77, 77, 0.3); color: #ff4d4d; cursor: pointer; padding: 6px 12px; border-radius: 6px; display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; transition: all 0.2s;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>
                ${t('models.manager.delete_all')} (${group.models.length})
              </button>
            ` : ''}
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 4px;">
            ${modelsHtml}
          </div>
        `;
        container.appendChild(groupEl);
      });

      if (totalBadge) {
        totalBadge.textContent = `${t('models.manager.total')} ${formatBytes(grandTotalBytes)}`;
      }

      container.querySelectorAll('.btn-delete-single-model').forEach(btn => {
        btn.onclick = (e) => {
          const engine = e.currentTarget.getAttribute('data-engine');
          const model = e.currentTarget.getAttribute('data-model');
          showCustomConfirmModal({
            title: t('models.delete_confirm_title'),
            message: t('models.delete_confirm_msg', { model, engine }),
            confirmText: t('models.delete_confirm_btn'),
            onConfirm: async () => {
              try {
                await window.__TAURI__.core.invoke('delete_installed_model', { engine, model });
                ToastManager.show({ type: 'success', title: t('toast.model_deleted'), message: t('toast.model_deleted_msg', { model }) });
                removeModelFromDownloadQueue(engine, model);
                await renderInstalledModelsManager();
                const activeEngineId = state.pendingConfig ? state.pendingConfig.engine.type : 'vosk';
                await renderAvailableModels(activeEngineId);
                if (typeof window.updateDashboardActiveEngineCard === 'function') {
                  await window.updateDashboardActiveEngineCard();
                }
                if (typeof window.checkActiveEngineAvailability === 'function') {
                  await window.checkActiveEngineAvailability();
                }
              } catch (err) {
                ToastManager.show({ type: 'error', title: t('toast.model_delete_error'), message: err.toString() });
              }
            }
          });
        };
      });

      container.querySelectorAll('.btn-delete-group-models').forEach(btn => {
        btn.onclick = (e) => {
          const engine = e.currentTarget.getAttribute('data-engine');
          showCustomConfirmModal({
            title: t('models.delete_all_confirm_title'),
            message: t('models.delete_all_confirm_msg', { engine }),
            confirmText: t('models.delete_all_confirm_btn'),
            onConfirm: async () => {
              try {
                await window.__TAURI__.core.invoke('delete_installed_model', { engine, model: null });
                ToastManager.show({ type: 'success', title: t('toast.all_models_deleted'), message: t('toast.all_models_deleted_msg') });
                removeModelFromDownloadQueue(engine, null);
                await renderInstalledModelsManager();
                const activeEngineId = state.pendingConfig ? state.pendingConfig.engine.type : 'vosk';
                await renderAvailableModels(activeEngineId);
                if (typeof window.updateDashboardActiveEngineCard === 'function') {
                  await window.updateDashboardActiveEngineCard();
                }
                if (typeof window.checkActiveEngineAvailability === 'function') {
                  await window.checkActiveEngineAvailability();
                }
              } catch (err) {
                ToastManager.show({ type: 'error', title: t('toast.model_delete_error'), message: err.toString() });
              }
            }
          });
        };
      });

    } catch (err) {
      console.error('Error loading model summary:', err);
    }
  }
}

export function showCustomConfirmModal({ title, message, confirmText, cancelText, isDanger = true, isHazard = false, onConfirm, onCancel }) {
  const cancelBtnText = cancelText || t('btn.cancel');
  const confirmBtnText = confirmText || (isDanger ? t('models.btn.delete') : t('btn.apply'));
  
  let headerColor = 'var(--accent-green)';
  let btnBackground = 'var(--accent-green)';
  let btnTextColor = 'var(--accent-contrast-text, #080c08)';
  let iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>';

  if (isHazard) {
    headerColor = '#ff4400';
    btnBackground = '#ff4400';
    btnTextColor = '#ffffff';
    iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  } else if (isDanger) {
    headerColor = '#ff4d4d';
    btnBackground = '#ff4d4d';
    btnTextColor = '#ffffff';
    iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>';
  }

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.style.zIndex = '100000';

  const card = document.createElement('div');
  card.className = 'modal-card';
  card.style.maxWidth = '420px';

  card.innerHTML = `
    <div class="modal-title" style="color: ${headerColor}; display: flex; align-items: center; gap: 8px;">
      ${iconSvg}
      ${title}
    </div>
    <div class="modal-body" style="margin-top: 12px; margin-bottom: 24px;">
      <p style="margin: 0; font-size: 14px; color: var(--text-secondary); line-height: 1.5;">${message}</p>
    </div>
    <div style="display: flex; justify-content: flex-end; gap: 12px;">
      <button class="btn-cancel" style="background: transparent; border: 1px solid var(--border-subtle); color: var(--text-secondary); padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600;">${cancelBtnText}</button>
      <button class="btn-confirm-action" style="background: ${btnBackground}; border: none; color: ${btnTextColor}; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 700; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">${confirmBtnText}</button>
    </div>
  `;

  backdrop.appendChild(card);
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  card.querySelector('.btn-cancel').onclick = () => {
    close();
    if (onCancel) onCancel();
  };
  card.querySelector('.btn-confirm-action').onclick = () => {
    close();
    if (onConfirm) onConfirm();
  };
}

export function setupModelEventListeners() {
  const downloadVoskBtn = document.getElementById('btn-download-vosk');
  const downloadWhisperBtn = document.getElementById('btn-download-whisper');
  const downloadSherpaBtn = document.getElementById('btn-download-sherpa');

  if (downloadVoskBtn) downloadVoskBtn.addEventListener('click', () => triggerModelDownload('vosk'));
  if (downloadWhisperBtn) downloadWhisperBtn.addEventListener('click', () => triggerModelDownload('whisper'));
  if (downloadSherpaBtn) downloadSherpaBtn.addEventListener('click', () => triggerModelDownload('sherpa_onnx'));

  const quickEngineSelect = document.getElementById('quick-download-engine');
  const quickLangSelect = document.getElementById('quick-download-lang');
  const quickModelSelect = document.getElementById('quick-download-model');
  const quickDownloadBtn = document.getElementById('quick-download-btn');

  if (quickEngineSelect) {
    quickEngineSelect.addEventListener('change', () => {
      if (quickDownloadBtn) quickDownloadBtn.classList.remove('btn-highlight-pulse');
      updateQuickModelOptions();
    });
  }
  if (quickLangSelect) {
    quickLangSelect.addEventListener('change', () => {
      if (quickDownloadBtn) quickDownloadBtn.classList.remove('btn-highlight-pulse');
      updateQuickModelOptions();
    });
  }

  if (quickDownloadBtn) {
    quickDownloadBtn.addEventListener('click', () => {
      quickDownloadBtn.classList.remove('btn-highlight-pulse');
      const eng = quickEngineSelect ? quickEngineSelect.value : 'vosk';
      const mdl = quickModelSelect ? quickModelSelect.value : '';
      if (mdl) {
        triggerModelDownloadExplicit(eng, mdl);
      }
    });

    quickDownloadBtn.addEventListener('mouseenter', () => {
      if (quickDownloadBtn.classList.contains('btn-highlight-pulse')) {
        try {
          const computedStyle = window.getComputedStyle(quickDownloadBtn);
          const currentTransform = computedStyle.transform;
          const currentBoxShadow = computedStyle.boxShadow;

          quickDownloadBtn.style.transform = currentTransform;
          quickDownloadBtn.style.boxShadow = currentBoxShadow;
          quickDownloadBtn.style.animation = 'none';
          
          quickDownloadBtn.classList.remove('btn-highlight-pulse');

          void quickDownloadBtn.offsetHeight;

          quickDownloadBtn.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), box-shadow 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
          quickDownloadBtn.style.transform = 'translateY(-1px) scale(1)';
          quickDownloadBtn.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.25)';

          setTimeout(() => {
            quickDownloadBtn.style.transform = '';
            quickDownloadBtn.style.boxShadow = '';
            quickDownloadBtn.style.animation = '';
            quickDownloadBtn.style.transition = '';
          }, 300);
        } catch (err) {
          console.error('[QuickDownload] Error in smooth hover transition:', err);
          quickDownloadBtn.classList.remove('btn-highlight-pulse');
        }
      }
    });
  }

  const clearDownloadHistoryBtn = document.getElementById('clear-download-history-btn');
  if (clearDownloadHistoryBtn) {
    clearDownloadHistoryBtn.addEventListener('click', () => {
      for (let i = state.downloadQueue.length - 1; i >= 0; i--) {
        if (state.downloadQueue[i].status === 'completed' || state.downloadQueue[i].status === 'cancelled' || state.downloadQueue[i].status === 'error') {
          state.downloadQueue.splice(i, 1);
        }
      }
      renderDownloadQueue();
    });
  }

  document.querySelectorAll('input[name="download-mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      processDownloadQueue();
    });
  });
}

// Bind to window for global access/event registrations
window.renderAvailableModels = renderAvailableModels;
window.updateModelStatusText = updateModelStatusText;
window.updateQuickModelOptions = updateQuickModelOptions;
window.renderDownloadQueue = renderDownloadQueue;
window.renderInstalledModelsManager = renderInstalledModelsManager;
window.addModelToDownloadQueue = addModelToDownloadQueue;
window.processDownloadQueue = processDownloadQueue;
window.updateDownloadProgress = updateDownloadProgress;
window.showCustomConfirmModal = showCustomConfirmModal;
