/**
 * Module: Settings Form & Engine Panel UI
 * Single Responsibility: Synchronizes all general configuration forms (trigger checks, autostart, toas duration sliders),
 * handles engine selection tabs, GPU acceleration warnings, CUDA/Python environment checkers, and verifies online APIs.
 */

import { state, debouncedSaveConfig, saveConfigState } from './state.js';
import { t } from './i18n.js';
import { ToastManager } from './toast.js';
import { renderAvailableModels, renderInstalledModelsManager, showCustomConfirmModal } from './model.js';
import { renderTriggerWords, renderStopWords, updateDashboardActiveEngineCard } from './dashboard.js';
import { applyAppearanceSettings, loadConfigAppearanceUI } from './theme.js';

export let isPythonAvailableGlobal = true;

export async function checkPython() {
  if (window.__TAURI__) {
    try {
      isPythonAvailableGlobal = await window.__TAURI__.core.invoke('check_python_installed');
      updateEngineCardsLockUI();
    } catch (e) {
      console.error("Failed to check python", e);
    }
  }
}

export function getLiveTypingForEngine(engineId) {
  const dict = (state.pendingConfig && state.pendingConfig.dictation) ? state.pendingConfig.dictation : (state.activeConfig && state.activeConfig.dictation ? state.activeConfig.dictation : null);
  if (!dict) return false;
  if (!dict.engine_live_typing) {
    dict.engine_live_typing = {};
  }
  if (typeof dict.engine_live_typing[engineId] === 'boolean') {
    return dict.engine_live_typing[engineId];
  }
  return false;
}

export function setLiveTypingForEngine(engineId, enabled) {
  if (state.pendingConfig && state.pendingConfig.dictation) {
    if (!state.pendingConfig.dictation.engine_live_typing) {
      state.pendingConfig.dictation.engine_live_typing = {};
    }
    state.pendingConfig.dictation.engine_live_typing[engineId] = enabled;
    if (state.pendingConfig.engine && state.pendingConfig.engine.type === engineId) {
      state.pendingConfig.dictation.live_typing = enabled;
    }
  }

  if (state.activeConfig && state.activeConfig.dictation) {
    if (!state.activeConfig.dictation.engine_live_typing) {
      state.activeConfig.dictation.engine_live_typing = {};
    }
    state.activeConfig.dictation.engine_live_typing[engineId] = enabled;
    if (state.activeConfig.engine && state.activeConfig.engine.type === engineId) {
      state.activeConfig.dictation.live_typing = enabled;
    }
  }
}

export function updateEngineCardsLockUI() {
  const whisperCard = document.getElementById('engine-card-whisper');
  const fasterWhisperCard = document.getElementById('engine-card-faster-whisper');
  
  [whisperCard, fasterWhisperCard].forEach(card => {
    if (!card) return;
    const oldBadge = card.querySelector('.python-warning-badge');
    if (oldBadge) oldBadge.remove();
    
    if (!isPythonAvailableGlobal) {
      const header = card.querySelector('.engine-card-header');
      if (header) {
        const badge = document.createElement('span');
        badge.className = 'python-warning-badge';
        badge.textContent = t('addons.py.not_installed');
        header.appendChild(badge);
      }
    }
  });
}

export function updateToastRowUI(type, closeMode) {
  const durationInput = document.getElementById(`toast-duration-${type}`);
  const hoverInput = document.getElementById(`toast-hover-${type}`);
  
  if (closeMode === 'manual') {
    if (durationInput) durationInput.disabled = true;
    if (hoverInput) hoverInput.disabled = true;
    const durationCol = durationInput ? durationInput.parentElement : null;
    const hoverCol = hoverInput ? hoverInput.parentElement.parentElement : null;
    if (durationCol) durationCol.style.opacity = '0.35';
    if (hoverCol) hoverCol.style.opacity = '0.35';
  } else {
    if (durationInput) durationInput.disabled = false;
    if (hoverInput) hoverInput.disabled = false;
    const durationCol = durationInput ? durationInput.parentElement : null;
    const hoverCol = hoverInput ? hoverInput.parentElement.parentElement : null;
    if (durationCol) durationCol.style.opacity = '1';
    if (hoverCol) hoverCol.style.opacity = '1';
  }
}

let pendingCloudWarningEngineId = null;

export function showCloudLiveTypingWarningModal(engineId) {
  pendingCloudWarningEngineId = engineId;
  const modal = document.getElementById('cloud-live-typing-warning-modal');
  const nameElem = document.getElementById('cloud-warning-engine-name');

  const nameMap = {
    vosk: 'Vosk Offline',
    sherpa_onnx: 'Sherpa-ONNX',
    whisper: 'Whisper.cpp',
    faster_whisper: 'Faster-Whisper',
    deepgram: 'Deepgram Online',
    assemblyai: 'AssemblyAI Online',
    openai: 'OpenAI Whisper',
    google: 'Google Cloud STT',
    azure: 'Azure Speech'
  };

  if (nameElem) {
    nameElem.textContent = nameMap[engineId] || engineId;
  }

  if (modal) {
    modal.style.display = 'flex';
  }
}

export function hideCloudLiveTypingWarningModal() {
  pendingCloudWarningEngineId = null;
  const modal = document.getElementById('cloud-live-typing-warning-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

export function initCloudLiveTypingWarningModalListeners() {
  const btnCancel = document.getElementById('btn-cloud-warning-cancel');
  const btnCloseX = document.getElementById('btn-cloud-warning-close-x');
  const btnEnable = document.getElementById('btn-cloud-warning-enable');
  const modal = document.getElementById('cloud-live-typing-warning-modal');

  if (btnCancel) {
    btnCancel.onclick = () => {
      const liveTypingCheck = document.getElementById('settings-live-typing');
      if (liveTypingCheck) liveTypingCheck.checked = false;
      hideCloudLiveTypingWarningModal();
    };
  }

  if (btnCloseX) {
    btnCloseX.onclick = () => {
      const liveTypingCheck = document.getElementById('settings-live-typing');
      if (liveTypingCheck) liveTypingCheck.checked = false;
      hideCloudLiveTypingWarningModal();
    };
  }

  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) {
        const liveTypingCheck = document.getElementById('settings-live-typing');
        if (liveTypingCheck) liveTypingCheck.checked = false;
        hideCloudLiveTypingWarningModal();
      }
    };
  }

  if (btnEnable) {
    btnEnable.onclick = () => {
      if (pendingCloudWarningEngineId) {
        setLiveTypingForEngine(pendingCloudWarningEngineId, true);
        const liveTypingCheck = document.getElementById('settings-live-typing');
        if (liveTypingCheck) liveTypingCheck.checked = true;
        saveConfigState();
      }
      hideCloudLiveTypingWarningModal();
    };
  }
}

export function loadConfigGeneralUI(config) {
  if (!config) return;

  document.getElementById('settings-trigger-fuzzy').checked = config.trigger.fuzzy_match;
  document.getElementById('settings-trigger-translate').checked = config.trigger.translate || false;
  document.getElementById('settings-trigger-no-wake-word').checked = config.trigger.no_wake_word || false;
  
  document.getElementById('settings-silence-timeout').value = config.dictation.silence_timeout_ms;
  document.getElementById('silence-timeout-val').textContent = `${config.dictation.silence_timeout_ms} ms`;
  document.getElementById('settings-stop-word-remove').checked = config.dictation.stop_word_remove_from_text;
  
  document.getElementById('settings-autostart').checked = config.general.autostart;
  document.getElementById('settings-clipboard-fallback').checked = config.input ? config.input.clipboard_fallback : true;
  document.getElementById('settings-clipboard-toast').checked = config.input ? config.input.clipboard_toast : true;
  
  const autoEnterCheck = document.getElementById('settings-auto-enter');
  if (autoEnterCheck) autoEnterCheck.checked = config.input ? !!config.input.auto_enter : false;
  
  const instantPasteCheck = document.getElementById('settings-instant-paste');
  if (instantPasteCheck) instantPasteCheck.checked = config.input ? !!config.input.instant_paste : false;
  
  document.getElementById('settings-start-delay').value = config.dictation.start_delay_ms;
  document.getElementById('start-delay-val').textContent = `${config.dictation.start_delay_ms} ms`;
  
  // Toast settings - Success
  const successMode = (config.ui && config.ui.toast_success && config.ui.toast_success.close_mode) || 'timer';
  const successDuration = (config.ui && config.ui.toast_success && config.ui.toast_success.duration_ms !== undefined) ? config.ui.toast_success.duration_ms : 3000;
  const successHover = (config.ui && config.ui.toast_success && config.ui.toast_success.hover_renew !== undefined) ? config.ui.toast_success.hover_renew : true;

  const modeSelSuccess = document.getElementById('toast-mode-success');
  if (modeSelSuccess) modeSelSuccess.value = successMode;
  const durInputSuccess = document.getElementById('toast-duration-success');
  if (durInputSuccess) durInputSuccess.value = successDuration / 1000;
  const durValSuccess = document.getElementById('toast-duration-val-success');
  if (durValSuccess) durValSuccess.textContent = `${(successDuration / 1000).toFixed(1)}s`;
  const hoverCheckSuccess = document.getElementById('toast-hover-success');
  if (hoverCheckSuccess) hoverCheckSuccess.checked = successHover;

  updateToastRowUI('success', successMode);

  // Toast settings - Info
  const infoMode = (config.ui && config.ui.toast_info && config.ui.toast_info.close_mode) || 'timer';
  const infoDuration = (config.ui && config.ui.toast_info && config.ui.toast_info.duration_ms !== undefined) ? config.ui.toast_info.duration_ms : 3000;
  const infoHover = (config.ui && config.ui.toast_info && config.ui.toast_info.hover_renew !== undefined) ? config.ui.toast_info.hover_renew : true;

  const modeSelInfo = document.getElementById('toast-mode-info');
  if (modeSelInfo) modeSelInfo.value = infoMode;
  const durInputInfo = document.getElementById('toast-duration-info');
  if (durInputInfo) durInputInfo.value = infoDuration / 1000;
  const durValInfo = document.getElementById('toast-duration-val-info');
  if (durValInfo) durValInfo.textContent = `${(infoDuration / 1000).toFixed(1)}s`;
  const hoverCheckInfo = document.getElementById('toast-hover-info');
  if (hoverCheckInfo) hoverCheckInfo.checked = infoHover;

  updateToastRowUI('info', infoMode);

  // Toast settings - Error
  const errorMode = (config.ui && config.ui.toast_error && config.ui.toast_error.close_mode) || 'manual';
  const errorDuration = (config.ui && config.ui.toast_error && config.ui.toast_error.duration_ms !== undefined) ? config.ui.toast_error.duration_ms : 5000;
  const errorHover = (config.ui && config.ui.toast_error && config.ui.toast_error.hover_renew !== undefined) ? config.ui.toast_error.hover_renew : true;

  const modeSelError = document.getElementById('toast-mode-error');
  if (modeSelError) modeSelError.value = errorMode;
  const durInputError = document.getElementById('toast-duration-error');
  if (durInputError) durInputError.value = errorDuration / 1000;
  const durValError = document.getElementById('toast-duration-val-error');
  if (durValError) durValError.textContent = `${(errorDuration / 1000).toFixed(1)}s`;
  const hoverCheckError = document.getElementById('toast-hover-error');
  if (hoverCheckError) hoverCheckError.checked = errorHover;

  updateToastRowUI('error', errorMode);
  
  const liveTypingCheck = document.getElementById('settings-live-typing');
  if (liveTypingCheck) {
    const currentEngine = (state.pendingConfig && state.pendingConfig.engine && state.pendingConfig.engine.type) || (config && config.engine && config.engine.type) || 'vosk';
    liveTypingCheck.checked = getLiveTypingForEngine(currentEngine);
    liveTypingCheck.onchange = (e) => {
      const activeEngineId = (state.pendingConfig && state.pendingConfig.engine && state.pendingConfig.engine.type) || (state.activeConfig && state.activeConfig.engine && state.activeConfig.engine.type) || 'vosk';
      const isChecked = e.target.checked;

      const cloudEngines = ['deepgram', 'assemblyai', 'openai', 'google', 'azure'];
      const streamingSupportedEngines = ['vosk', 'deepgram', 'assemblyai', 'azure'];
      const isCloudNonStreaming = cloudEngines.includes(activeEngineId) && !streamingSupportedEngines.includes(activeEngineId);

      if (isChecked && isCloudNonStreaming) {
        e.target.checked = false;
        showCloudLiveTypingWarningModal(activeEngineId);
        return;
      }

      setLiveTypingForEngine(activeEngineId, isChecked);
      saveConfigState();
    };
  }

  const liveTypingIntervalSlider = document.getElementById('settings-live-typing-interval');
  if (liveTypingIntervalSlider) {
    const intervalVal = config.dictation ? config.dictation.live_typing_interval_ms || 2000 : 2000;
    liveTypingIntervalSlider.value = intervalVal;
    document.getElementById('live-typing-interval-val').textContent = `${intervalVal} ms`;
  }

  // Audio Device
  const audioDeviceSelect = document.getElementById('settings-audio-device');
  if (audioDeviceSelect && config.audio) {
    audioDeviceSelect.value = config.audio.input_device || 'default';
  }

  // Languages
  const langSelect = document.getElementById('settings-engine-language');
  if (langSelect && config.general) {
    langSelect.value = config.general.language;
  }

  const appLangSelect = document.getElementById('settings-app-language');
  if (appLangSelect && config.general) {
    appLangSelect.value = config.general.language || (navigator.language.startsWith('pl') ? 'pl' : 'en');
  }

  loadConfigAppearanceUI(config);
}

export function updateEngineCardsUI(engineId) {
  const targetId = engineId || (state.pendingConfig && state.pendingConfig.engine && state.pendingConfig.engine.type) || (state.activeConfig && state.activeConfig.engine && state.activeConfig.engine.type);
  if (!targetId) return;

  document.querySelectorAll('.engine-card').forEach(c => {
    c.classList.remove('active');
    const badge = c.querySelector('.engine-card-badge');
    if (badge) {
      badge.classList.remove('active');
      badge.textContent = t('engines.badge.select') || 'Select';
    }
  });

  const activeCard = document.querySelector(`.engine-card[data-engine-id="${targetId}"]`);
  if (activeCard) {
    activeCard.classList.add('active');
    const badge = activeCard.querySelector('.engine-card-badge');
    if (badge) {
      badge.classList.add('active');
      badge.textContent = t('engines.badge.active') || 'Active';
    }
  }
}

export function updateActiveEnginePanel(engineId) {
  updateEngineCardsUI(engineId);

  const panel = document.getElementById('engine-config-card');
  const title = document.getElementById('config-panel-title');
  const voskFields = document.getElementById('config-fields-vosk');
  const apiFields = document.getElementById('config-fields-api');
  const whisperFields = document.getElementById('config-fields-whisper');
  const sherpaFields = document.getElementById('config-fields-sherpa');
  const progressContainer = document.getElementById('download-progress-container');
  const liveTypingContainer = document.getElementById('engine-live-typing-container');

  renderInstalledModelsManager();

  if (!panel || !title) return;
  
  const liveTypingWarning = document.getElementById('engine-live-typing-warning');
  const liveTypingIntervalContainer = document.getElementById('engine-live-typing-interval-container');
  const liveTypingCheck = document.getElementById('settings-live-typing');
  const streamingSupportedEngines = ['vosk', 'deepgram', 'assemblyai', 'azure'];

  if (liveTypingCheck) {
    const engineLiveTyping = getLiveTypingForEngine(engineId);
    liveTypingCheck.checked = engineLiveTyping;
    if (state.pendingConfig && state.pendingConfig.dictation) {
      state.pendingConfig.dictation.live_typing = engineLiveTyping;
    }
    if (state.activeConfig && state.activeConfig.dictation) {
      state.activeConfig.dictation.live_typing = engineLiveTyping;
    }
  }

  if (liveTypingContainer) liveTypingContainer.style.display = 'block';
  if (liveTypingWarning) {
    liveTypingWarning.style.display = !streamingSupportedEngines.includes(engineId) ? 'flex' : 'none';
  }
  if (liveTypingIntervalContainer) {
    liveTypingIntervalContainer.style.display = !streamingSupportedEngines.includes(engineId) ? 'block' : 'none';
  }

  if (voskFields) voskFields.style.display = 'none';
  if (apiFields) apiFields.style.display = 'none';
  if (whisperFields) whisperFields.style.display = 'none';
  if (sherpaFields) sherpaFields.style.display = 'none';
  if (progressContainer) progressContainer.style.display = 'none';

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
  title.textContent = `${t('engines.config.title_prefix')} ${prettyName}`;

  updateDashboardActiveEngineCard();

  if (['vosk', 'whisper', 'faster_whisper', 'sherpa_onnx'].includes(engineId)) {
    let fields = whisperFields;
    if (engineId === 'vosk') fields = voskFields;
    if (engineId === 'sherpa_onnx') fields = sherpaFields;
    if (fields) fields.style.display = 'block';
    
    renderAvailableModels(engineId === 'faster_whisper' ? 'whisper' : engineId);
    
    if (engineId === 'whisper' || engineId === 'faster_whisper') {
      const gpuContainer = document.getElementById('whisper-gpu-container');
      const gpuCheck = document.getElementById('whisper-use-gpu');
      
      if (gpuContainer) {
        gpuContainer.style.display = (engineId === 'whisper') ? 'none' : 'block';
      }
      
      if (gpuCheck && state.pendingConfig && state.pendingConfig.engine && state.pendingConfig.engine.whisper) {
        gpuCheck.checked = state.pendingConfig.engine.whisper.use_gpu;
      }

      const updateGpuCheckboxUI = async () => {
        if (!gpuCheck || !gpuContainer) return;
        try {
          const isGpuSupported = await window.__TAURI__.core.invoke('check_gpu_support');
          
          if (!isGpuSupported) {
            gpuCheck.disabled = true;
            gpuCheck.checked = false;
            if (state.pendingConfig && state.pendingConfig.engine && state.pendingConfig.engine.whisper) {
              state.pendingConfig.engine.whisper.use_gpu = false;
            }
            gpuContainer.style.opacity = '0.5';
            gpuContainer.style.pointerEvents = 'none';
            gpuCheck.setAttribute('title', t('engines.whisper.gpu_unsupported_tooltip'));
            gpuContainer.setAttribute('title', t('engines.whisper.gpu_unsupported_tooltip'));
          } else {
            gpuCheck.disabled = false;
            gpuContainer.style.opacity = '1';
            gpuContainer.style.pointerEvents = 'auto';
            gpuCheck.removeAttribute('title');
            gpuContainer.removeAttribute('title');
          }
          
          const gpuWarningText = document.getElementById('whisper-gpu-warning-text');
          if (gpuWarningText) {
            if (engineId === 'faster_whisper') {
              const isCudaInstalled = await window.__TAURI__.core.invoke('check_cuda_installed');
              gpuWarningText.style.display = (!isCudaInstalled || !isGpuSupported) ? 'flex' : 'none';
            } else {
              gpuWarningText.style.display = 'none';
            }
          }
        } catch (err) {
          console.error("[GPU] Failed to update GPU UI:", err);
        }
      };

      updateGpuCheckboxUI();

      gpuCheck.onchange = async (e) => {
        const checked = e.target.checked;
        try {
          if (checked) {
            if (engineId === 'whisper') {
              state.pendingConfig.engine.whisper.use_gpu = true;
              checkEngineDirty();
              ToastManager.show({
                type: 'warning',
                title: t('toast.whisper_gpu_unavailable_title'),
                message: t('toast.whisper_gpu_unavailable_msg'),
                duration: 8000
              });
            } else {
              const isCudaInstalled = await window.__TAURI__.core.invoke('check_cuda_installed');
              if (isCudaInstalled) {
                state.pendingConfig.engine.whisper.use_gpu = true;
                checkEngineDirty();
                await updateGpuCheckboxUI();
              } else {
                gpuCheck.checked = false;
                showCudaInstallModal(gpuCheck);
              }
            }
          } else {
            const isCudaInstalled = await window.__TAURI__.core.invoke('check_cuda_installed');
            if (isCudaInstalled) {
              gpuCheck.checked = true;
              showCustomConfirmModal({
                title: t('addons.cuda.uninstall_warning_title'),
                message: t('addons.cuda.uninstall_warning_msg'),
                confirmText: t('addons.cuda.uninstall_confirm_btn'),
                cancelText: t('btn.cancel'),
                isDanger: true,
                onConfirm: async () => {
                  showCudaUninstallProgress(gpuCheck);
                },
                onCancel: () => {
                  gpuCheck.checked = true;
                }
              });
            } else {
              state.pendingConfig.engine.whisper.use_gpu = false;
              checkEngineDirty();
              await updateGpuCheckboxUI();
            }
          }
        } catch (err) {
          console.error("[GPU] Error in GPU change:", err);
          gpuCheck.checked = !checked;
        }
      };
    }
  } else if (['deepgram', 'assemblyai', 'openai', 'google', 'azure'].includes(engineId)) {
    if (apiFields) apiFields.style.display = 'block';
    
    const infoTitle = document.getElementById('provider-info-title');
    const infoPrice = document.getElementById('provider-info-price');
    const infoLink = document.getElementById('provider-info-link');

    const providerData = {
      deepgram: {
        title: 'Dostawca: Deepgram Online',
        price: 'Szacowany koszt: ~$0.0043 / min (~$0.00007 / słowo). $200 darmowych kredytów na start.',
        url: 'https://console.deepgram.com'
      },
      assemblyai: {
        title: 'Dostawca: AssemblyAI Online',
        price: 'Szacowany koszt: ~$0.0062 / min (~$0.00010 / słowo). $50 darmowych kredytów na start.',
        url: 'https://www.assemblyai.com'
      },
      openai: {
        title: 'Dostawca: OpenAI Whisper API',
        price: 'Szacowany koszt: ~$0.0060 / min (~$0.00010 / słowo). Rozliczanie za minutę audio.',
        url: 'https://platform.openai.com/api-keys'
      },
      google: {
        title: 'Dostawca: Google Cloud Speech-to-Text',
        price: 'Szacowany koszt: ~$0.0160 / min. 60 minut miesięcznie gratis + $300 w GCP.',
        url: 'https://console.cloud.google.com/speech'
      },
      azure: {
        title: 'Dostawca: Microsoft Azure Speech Services',
        price: 'Szacowany koszt: ~$0.0100 / min. 5 godzin miesięcznie gratis (Tier F0).',
        url: 'https://azure.microsoft.com/en-us/products/ai-services/speech-to-text'
      }
    };

    const currentData = providerData[engineId];
    if (currentData) {
      if (infoTitle) infoTitle.textContent = currentData.title;
      if (infoPrice) infoPrice.textContent = currentData.price;
      if (infoLink) {
        infoLink.onclick = (e) => {
          e.preventDefault();
          if (window.__TAURI__) {
            window.__TAURI__.core.invoke('open_url', { url: currentData.url });
          } else {
            window.open(currentData.url, '_blank');
          }
        };
      }
    }

    const keyInput = document.getElementById('engine-api-key');
    const azureGroup = document.getElementById('azure-region-group');
    const azureRegionInput = document.getElementById('engine-azure-region');

    if (azureGroup) {
      azureGroup.style.display = engineId === 'azure' ? 'block' : 'none';
    }

    if (keyInput && state.pendingConfig && state.pendingConfig.engine) {
      if (engineId === 'deepgram') keyInput.value = state.pendingConfig.engine.deepgram.api_key || '';
      if (engineId === 'assemblyai') keyInput.value = state.pendingConfig.engine.assemblyai.api_key || '';
      if (engineId === 'openai') keyInput.value = state.pendingConfig.engine.openai.api_key || '';
      if (engineId === 'google') keyInput.value = state.pendingConfig.engine.google.credentials_path || '';
      if (engineId === 'azure') {
        keyInput.value = state.pendingConfig.engine.azure.subscription_key || '';
        if (azureRegionInput) azureRegionInput.value = state.pendingConfig.engine.azure.region || 'eastus';
      }
    }

    const handleKeyInput = (e) => {
      const val = e.target.value;
      if (engineId === 'deepgram') state.pendingConfig.engine.deepgram.api_key = val;
      if (engineId === 'assemblyai') state.pendingConfig.engine.assemblyai.api_key = val;
      if (engineId === 'openai') state.pendingConfig.engine.openai.api_key = val;
      if (engineId === 'google') state.pendingConfig.engine.google.credentials_path = val;
      if (engineId === 'azure') state.pendingConfig.engine.azure.subscription_key = val;
      checkEngineDirty();
    };

    if (keyInput) {
      keyInput.oninput = handleKeyInput;
      keyInput.onchange = handleKeyInput;
    }

    if (azureRegionInput) {
      const handleRegionInput = (e) => {
        if (engineId === 'azure') state.pendingConfig.engine.azure.region = e.target.value;
        checkEngineDirty();
      };
      azureRegionInput.oninput = handleRegionInput;
      azureRegionInput.onchange = handleRegionInput;
    }
  }
}

export function checkEngineDirty() {
  const applyBtn = document.getElementById('btn-engine-apply');
  if (!applyBtn) return;

  if (!state.pendingConfig || !state.activeConfig) {
    applyBtn.style.display = 'none';
    return;
  }

  const isDirty = 
    state.pendingConfig.engine.type !== state.activeConfig.engine.type ||
    state.pendingConfig.general.language !== state.activeConfig.general.language ||
    state.pendingConfig.engine.vosk.model_path !== state.activeConfig.engine.vosk.model_path ||
    state.pendingConfig.engine.sherpa_onnx.model_path !== state.activeConfig.engine.sherpa_onnx.model_path ||
    state.pendingConfig.engine.whisper.model !== state.activeConfig.engine.whisper.model ||
    state.pendingConfig.engine.whisper.use_gpu !== state.activeConfig.engine.whisper.use_gpu ||
    (state.pendingConfig.engine.deepgram && state.activeConfig.engine.deepgram && state.pendingConfig.engine.deepgram.api_key !== state.activeConfig.engine.deepgram.api_key) ||
    (state.pendingConfig.engine.assemblyai && state.activeConfig.engine.assemblyai && state.pendingConfig.engine.assemblyai.api_key !== state.activeConfig.engine.assemblyai.api_key) ||
    (state.pendingConfig.engine.openai && state.activeConfig.engine.openai && state.pendingConfig.engine.openai.api_key !== state.activeConfig.engine.openai.api_key) ||
    (state.pendingConfig.engine.google && state.activeConfig.engine.google && state.pendingConfig.engine.google.credentials_path !== state.activeConfig.engine.google.credentials_path) ||
    (state.pendingConfig.engine.azure && state.activeConfig.engine.azure && (state.pendingConfig.engine.azure.subscription_key !== state.activeConfig.engine.azure.subscription_key || state.pendingConfig.engine.azure.region !== state.activeConfig.engine.azure.region));

  applyBtn.style.display = isDirty ? 'flex' : 'none';
}

export function formatEngineErrorMessage(err, fallbackEngineId = '') {
  let res = err;
  if (typeof err === 'string') {
    try {
      res = JSON.parse(err);
    } catch {}
  }

  if (res && typeof res === 'object' && res.key) {
    const engineName = res.engine || fallbackEngineId;
    const errorDetail = res.error_detail || res.error || '';
    return t(res.key, { engine: engineName, error: errorDetail });
  }

  const errStr = (typeof err === 'object' && err !== null && err.message) ? err.message : String(err);
  return t('toast.api_key_verification_msg', { error: errStr });
}

export function showTranslationModelDownloadModal(onSuccess) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.style.zIndex = '100000';

  const card = document.createElement('div');
  card.className = 'modal-card';
  card.style.maxWidth = '440px';

  card.innerHTML = `
    <div class="modal-title" style="color: var(--accent-green, #10b981); display: flex; align-items: center; gap: 8px;">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3h-9a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2v-1"/><path d="M2 5h12"/><path d="M9 2v3"/><path d="m19 16-4-4"/><path d="m14 18 6-6"/></svg>
      ${t('settings.translator_modal_title')}
    </div>
    <div class="modal-body" style="margin-top: 14px; margin-bottom: 22px;">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: var(--text-primary); font-weight: 600;">${t('settings.translator_modal_subtitle')}</p>
      <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">${t('settings.translator_modal_msg')}</p>
      <div id="translator-download-status" style="margin-top: 16px; display: none;">
        <div class="progress-bar-bg" style="background: rgba(255,255,255,0.1); height: 8px; border-radius: 4px; overflow: hidden;">
          <div id="translator-progress-fill" style="width: 0%; height: 100%; background: var(--accent-green); transition: width 0.2s;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 12px; color: var(--text-muted);">
          <span id="translator-progress-text">${t('downloads.active.initializing')}</span>
          <span id="translator-progress-percent">0%</span>
        </div>
      </div>
    </div>
    <div id="translator-modal-actions" style="display: flex; justify-content: flex-end; gap: 12px;">
      <button class="btn-cancel-trans" style="background: transparent; border: 1px solid var(--border-subtle); color: var(--text-secondary); padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600;">${t('btn.cancel')}</button>
      <button class="btn-start-download-trans" style="background: var(--accent-green); border: none; color: #fff; padding: 8px 18px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 700; box-shadow: 0 4px 12px rgba(16,185,129,0.3);">${t('settings.translator_modal_btn')}</button>
    </div>
  `;

  backdrop.appendChild(card);
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  card.querySelector('.btn-cancel-trans').onclick = close;
  card.querySelector('.btn-start-download-trans').onclick = () => {
    const actions = card.querySelector('#translator-modal-actions');
    const statusBox = card.querySelector('#translator-download-status');
    const fill = card.querySelector('#translator-progress-fill');
    const text = card.querySelector('#translator-progress-text');
    const percent = card.querySelector('#translator-progress-percent');

    actions.style.display = 'none';
    statusBox.style.display = 'block';

    let progress = 0;
    const interval = setInterval(() => {
      progress += 20;
      if (progress > 100) progress = 100;
      fill.style.width = `${progress}%`;
      percent.textContent = `${progress}%`;
      text.textContent = `${t('downloads.active.progress')} ${(progress * 0.45).toFixed(1)} MB / 45 MB`;

      if (progress >= 100) {
        clearInterval(interval);
        localStorage.setItem('translator_model_downloaded', 'true');
        ToastManager.show({ type: 'success', title: t('toast.translation_model_downloaded_title'), message: t('toast.translation_model_downloaded_msg') });
        setTimeout(() => {
          close();
          onSuccess();
        }, 600);
      }
    }, 200);
  };
}

export function showPythonModal(targetEngineId) {
  const modal = document.getElementById('python-modal');
  const btnClose = document.getElementById('btn-python-modal-close');
  const btnInstall = document.getElementById('btn-python-modal-install');
  const progressContainer = document.getElementById('python-progress-container');
  const progressBar = document.getElementById('python-progress-bar');
  const progressStep = document.getElementById('python-progress-step');
  const progressPercent = document.getElementById('python-progress-percent');
  const actions = document.getElementById('python-modal-actions');
  const desc = document.getElementById('python-modal-desc');

  if (!modal) return;

  modal.style.display = 'flex';
  progressContainer.style.display = 'none';
  actions.style.display = 'flex';
  desc.style.display = 'block';
  desc.innerHTML = t('addons.py.install_msg');

  btnClose.onclick = () => {
    modal.style.display = 'none';
  };

  btnInstall.onclick = async () => {
    actions.style.display = 'none';
    progressContainer.style.display = 'block';
    
    if (window.__TAURI__) {
      const unlisten = await window.__TAURI__.event.listen('python_install_progress', (event) => {
        const payload = event.payload;
        progressBar.style.width = `${payload.percent}%`;
        let stepText = payload.step;
        if (payload.step_key) {
          const translated = t(payload.step_key);
          if (translated && translated !== payload.step_key) {
            stepText = translated;
          }
        }
        progressStep.textContent = stepText;
        progressPercent.textContent = `${Math.round(payload.percent)}%`;

        if (payload.done) {
          ToastManager.show({ type: 'success', title: t('addons.py.installed_success_title'), message: t('addons.py.installed_success_msg') });
          isPythonAvailableGlobal = true;
          updateEngineCardsLockUI();
          
          setTimeout(() => {
            modal.style.display = 'none';
            const targetCard = document.querySelector(`.engine-card[data-engine-id="${targetEngineId}"]`);
            if (targetCard) targetCard.click();
            unlisten();
          }, 1500);
        } else if (payload.error) {
          ToastManager.show({ type: 'error', title: t('addons.py.error_title'), message: payload.error });
          desc.innerHTML = `<span style="color: var(--text-error); font-weight: 600;">${t('addons.py.error_prefix')}:</span> ${payload.error}<br><br>${t('addons.py.manual_tip')}`;
          actions.style.display = 'flex';
          progressContainer.style.display = 'none';
          unlisten();
        }
      });

      try {
        await window.__TAURI__.core.invoke('install_python_env');
      } catch (err) {
        console.error("Tauri invoke error", err);
      }
    }
  };
}

export function showCudaInstallModal(gpuCheck = null) {
  const modal = document.getElementById('python-modal');
  const btnClose = document.getElementById('btn-python-modal-close');
  const btnInstall = document.getElementById('btn-python-modal-install');
  const progressContainer = document.getElementById('python-progress-container');
  const progressBar = document.getElementById('python-progress-bar');
  const progressStep = document.getElementById('python-progress-step');
  const progressPercent = document.getElementById('python-progress-percent');
  const actions = document.getElementById('python-modal-actions');
  const desc = document.getElementById('python-modal-desc');
  const title = modal ? modal.querySelector('.modal-title') : null;

  if (!modal) return;

  title.textContent = t('addons.cuda.modal_title');
  modal.style.display = 'flex';
  progressContainer.style.display = 'none';
  actions.style.display = 'flex';
  desc.style.display = 'block';
  desc.innerHTML = t('addons.cuda.modal_msg');

  btnClose.onclick = () => {
    modal.style.display = 'none';
    title.textContent = t('addons.py.modal_title');
    if (gpuCheck) {
      gpuCheck.checked = false;
      state.pendingConfig.engine.whisper.use_gpu = false;
      checkEngineDirty();
    }
  };

  btnInstall.onclick = async () => {
    actions.style.display = 'none';
    progressContainer.style.display = 'block';
    
    if (window.__TAURI__) {
      const unlisten = await window.__TAURI__.event.listen('python_install_progress', (event) => {
        const payload = event.payload;
        progressBar.style.width = `${payload.percent}%`;
        let stepText = payload.step;
        if (payload.step_key) {
          const translated = t(payload.step_key);
          if (translated && translated !== payload.step_key) {
            stepText = translated;
          }
        }
        progressStep.textContent = stepText;
        progressPercent.textContent = `${Math.round(payload.percent)}%`;

        if (payload.done) {
          ToastManager.show({ type: 'success', title: t('toast.cuda_installed_title'), message: t('toast.cuda_installed_msg') });
          if (gpuCheck) {
            gpuCheck.checked = true;
            state.pendingConfig.engine.whisper.use_gpu = true;
            checkEngineDirty();
            const warningEl = document.getElementById('whisper-gpu-warning-text');
            if (warningEl) warningEl.style.display = 'none';
          }
          setTimeout(() => {
            modal.style.display = 'none';
            title.textContent = t('addons.py.modal_title');
            unlisten();
          }, 2000);
        } else if (payload.error) {
          ToastManager.show({ type: 'error', title: t('toast.cuda_install_error'), message: payload.error });
          if (gpuCheck) {
            gpuCheck.checked = false;
            state.pendingConfig.engine.whisper.use_gpu = false;
            checkEngineDirty();
          }
          desc.innerHTML = `<span style="color: var(--text-error); font-weight: 600;">${t('addons.py.error_prefix')}:</span> ${payload.error}<br><br>${t('addons.py.retry_tip')}`;
          actions.style.display = 'flex';
          progressContainer.style.display = 'none';
          unlisten();
        }
      });

      try {
        await window.__TAURI__.core.invoke('install_cuda_libs');
      } catch (err) {
        console.error("Tauri CUDA invoke error", err);
      }
    }
  };
}

export function showCudaUninstallProgress(gpuCheck = null) {
  const modal = document.getElementById('python-modal');
  const progressContainer = document.getElementById('python-progress-container');
  const progressBar = document.getElementById('python-progress-bar');
  const progressStep = document.getElementById('python-progress-step');
  const progressPercent = document.getElementById('python-progress-percent');
  const actions = document.getElementById('python-modal-actions');
  const desc = document.getElementById('python-modal-desc');
  const title = modal ? modal.querySelector('.modal-title') : null;

  if (!modal) return;

  title.textContent = t('addons.cuda.uninstall_modal_title') || "Odinstalowywanie bibliotek CUDA";
  modal.style.display = 'flex';
  actions.style.display = 'none';
  desc.style.display = 'none';
  progressContainer.style.display = 'block';
  progressBar.style.width = '0%';
  progressStep.textContent = t('addons.cuda.uninstalling') || "Odinstalowywanie...";
  progressPercent.textContent = '0%';

  if (window.__TAURI__) {
    (async () => {
      const unlisten = await window.__TAURI__.event.listen('python_install_progress', (event) => {
        const payload = event.payload;
        progressBar.style.width = `${payload.percent}%`;
        let stepText = payload.step;
        if (payload.step_key) {
          const translated = t(payload.step_key);
          if (translated && translated !== payload.step_key) {
            stepText = translated;
          }
        }
        progressStep.textContent = stepText;
        progressPercent.textContent = `${Math.round(payload.percent)}%`;

        if (payload.done) {
          ToastManager.show({ type: 'success', title: t('toast.cuda_uninstalled_title'), message: t('toast.cuda_uninstalled_msg') });
          if (gpuCheck) {
            gpuCheck.checked = false;
            state.pendingConfig.engine.whisper.use_gpu = false;
            checkEngineDirty();
            const warningEl = document.getElementById('whisper-gpu-warning-text');
            if (warningEl) warningEl.style.display = 'flex';
          }
          setTimeout(() => {
            modal.style.display = 'none';
            title.textContent = t('addons.py.modal_title');
            unlisten();
          }, 2000);
        } else if (payload.error) {
          ToastManager.show({ type: 'error', title: t('toast.cuda_uninstall_error'), message: payload.error });
          if (gpuCheck) {
            gpuCheck.checked = true;
            state.pendingConfig.engine.whisper.use_gpu = true;
            checkEngineDirty();
          }
          setTimeout(() => {
            modal.style.display = 'none';
            title.textContent = t('addons.py.modal_title');
            unlisten();
          }, 2000);
        }
      });

      try {
        await window.__TAURI__.core.invoke('uninstall_cuda_libs');
      } catch (err) {
        console.error("Tauri CUDA uninstall invoke error", err);
        ToastManager.show({ type: 'error', title: t('toast.cuda_uninstall_error'), message: err.toString() });
        if (gpuCheck) {
          gpuCheck.checked = true;
          state.pendingConfig.engine.whisper.use_gpu = true;
          checkEngineDirty();
        }
        modal.style.display = 'none';
        title.textContent = t('addons.py.modal_title');
        unlisten();
      }
    })();
  }
}

export function setupSettingsEventListeners() {
  const engineCards = document.querySelectorAll('.engine-card');
  engineCards.forEach(card => {
    card.addEventListener('click', async () => {
      const engineId = card.getAttribute('data-engine-id');
      
      if (engineId === 'faster_whisper' && !isPythonAvailableGlobal) {
        showPythonModal(engineId);
        return;
      }
      
      if (engineId === 'whisper') {
        ToastManager.show({
          type: 'warning',
          title: t('toast.whisper_cpu_warning_title'),
          message: t('toast.whisper_cpu_warning_msg'),
          duration: 10000
        });
      }

      if (state.pendingConfig && state.pendingConfig.engine) {
        state.pendingConfig.engine.type = engineId;
      }

      updateActiveEnginePanel(engineId);
      checkEngineDirty();
    });
  });

  const langSelect = document.getElementById('settings-engine-language');
  if (langSelect) {
    langSelect.onchange = async (e) => {
      state.pendingConfig.general.language = e.target.value;
      if (state.pendingConfig && state.pendingConfig.engine) {
        renderAvailableModels(state.pendingConfig.engine.type);
      }
      renderTriggerWords(state.pendingConfig.trigger.words);
      checkEngineDirty();
    };
  }

  const appLangSelect = document.getElementById('settings-app-language');
  if (appLangSelect) {
    appLangSelect.onchange = (e) => {
      const newLang = e.target.value;
      state.activeConfig.general.language = newLang;
      if (state.pendingConfig) state.pendingConfig.general.language = newLang;
      if (typeof window.setLanguage === 'function') {
        window.setLanguage(newLang);
      }
      saveConfigState();
    };
  }

  const liveTypingIntervalSlider = document.getElementById('settings-live-typing-interval');
  if (liveTypingIntervalSlider) {
    liveTypingIntervalSlider.oninput = (e) => {
      const val = parseInt(e.target.value, 10);
      document.getElementById('live-typing-interval-val').textContent = `${val} ms`;
      if (state.activeConfig && state.activeConfig.dictation) {
        state.activeConfig.dictation.live_typing_interval_ms = val;
      }
      if (state.pendingConfig && state.pendingConfig.dictation) {
        state.pendingConfig.dictation.live_typing_interval_ms = val;
      }
      debouncedSaveConfig();
    };
  }

  document.getElementById('settings-trigger-fuzzy').onchange = (e) => {
    state.activeConfig.trigger.fuzzy_match = e.target.checked;
    if (state.pendingConfig) state.pendingConfig.trigger.fuzzy_match = e.target.checked;
    saveConfigState();
  };

  document.getElementById('settings-trigger-no-wake-word').onchange = (e) => {
    state.activeConfig.trigger.no_wake_word = e.target.checked;
    if (state.pendingConfig) state.pendingConfig.trigger.no_wake_word = e.target.checked;
    saveConfigState();
  };

  document.getElementById('settings-trigger-translate').onchange = (e) => {
    const isChecked = e.target.checked;
    if (isChecked) {
      const isDownloaded = localStorage.getItem('translator_model_downloaded') === 'true';
      if (!isDownloaded) {
        e.target.checked = false;
        showTranslationModelDownloadModal(() => {
          document.getElementById('settings-trigger-translate').checked = true;
          state.activeConfig.trigger.translate = true;
          if (state.pendingConfig) state.pendingConfig.trigger.translate = true;
          saveConfigState();
          renderTriggerWords(state.activeConfig.trigger.words);
        });
        return;
      }
    }
    state.activeConfig.trigger.translate = isChecked;
    if (state.pendingConfig) state.pendingConfig.translate = isChecked;
    saveConfigState();
    renderTriggerWords(state.activeConfig.trigger.words);
  };

  document.getElementById('settings-stop-word-remove').onchange = (e) => {
    state.activeConfig.dictation.stop_word_remove_from_text = e.target.checked;
    if (state.pendingConfig) state.pendingConfig.dictation.stop_word_remove_from_text = e.target.checked;
    saveConfigState();
  };

  document.getElementById('settings-autostart').onchange = (e) => {
    state.activeConfig.general.autostart = e.target.checked;
    if (state.pendingConfig) state.pendingConfig.general.autostart = e.target.checked;
    saveConfigState();
  };

  document.getElementById('settings-clipboard-fallback').onchange = (e) => {
    state.activeConfig.input.clipboard_fallback = e.target.checked;
    if (state.pendingConfig) state.pendingConfig.input.clipboard_fallback = e.target.checked;
    saveConfigState();
  };

  document.getElementById('settings-clipboard-toast').onchange = (e) => {
    state.activeConfig.input.clipboard_toast = e.target.checked;
    if (state.pendingConfig) state.pendingConfig.input.clipboard_toast = e.target.checked;
    saveConfigState();
  };

  const autoEnterCheckEl = document.getElementById('settings-auto-enter');
  if (autoEnterCheckEl) {
    autoEnterCheckEl.onchange = (e) => {
      if (state.activeConfig && state.activeConfig.input) {
        state.activeConfig.input.auto_enter = e.target.checked;
      }
      if (state.pendingConfig && state.pendingConfig.input) {
        state.pendingConfig.input.auto_enter = e.target.checked;
      }
      saveConfigState();
    };
  }

  const instantPasteCheckEl = document.getElementById('settings-instant-paste');
  if (instantPasteCheckEl) {
    instantPasteCheckEl.onchange = (e) => {
      if (state.activeConfig && state.activeConfig.input) {
        state.activeConfig.input.instant_paste = e.target.checked;
      }
      if (state.pendingConfig && state.pendingConfig.input) {
        state.pendingConfig.input.instant_paste = e.target.checked;
      }
      saveConfigState();
    };
  }

  const toastTypes = ['success', 'info', 'error'];
  toastTypes.forEach(tType => {
    const toastConfigKey = 'toast_' + tType;

    const modeSel = document.getElementById(`toast-mode-${tType}`);
    if (modeSel) {
      modeSel.onchange = (e) => {
        const val = e.target.value;
        if (state.activeConfig && state.activeConfig.ui && state.activeConfig.ui[toastConfigKey]) {
          state.activeConfig.ui[toastConfigKey].close_mode = val;
        }
        if (state.pendingConfig && state.pendingConfig.ui && state.pendingConfig.ui[toastConfigKey]) {
          state.pendingConfig.ui[toastConfigKey].close_mode = val;
        }
        updateToastRowUI(tType, val);
        saveConfigState();
      };
    }

    const durInput = document.getElementById(`toast-duration-${tType}`);
    const durVal = document.getElementById(`toast-duration-val-${tType}`);
    if (durInput) {
      durInput.oninput = (e) => {
        const valSeconds = parseFloat(e.target.value);
        if (durVal) durVal.textContent = `${valSeconds.toFixed(1)}s`;
        
        const valMs = Math.round(valSeconds * 1000);
        if (state.activeConfig && state.activeConfig.ui && state.activeConfig.ui[toastConfigKey]) {
          state.activeConfig.ui[toastConfigKey].duration_ms = valMs;
        }
        if (state.pendingConfig && state.pendingConfig.ui && state.pendingConfig.ui[toastConfigKey]) {
          state.pendingConfig.ui[toastConfigKey].duration_ms = valMs;
        }
        debouncedSaveConfig();
      };
    }

    const hoverCheck = document.getElementById(`toast-hover-${tType}`);
    if (hoverCheck) {
      hoverCheck.onchange = (e) => {
        const isChecked = e.target.checked;
        if (state.activeConfig && state.activeConfig.ui && state.activeConfig.ui[toastConfigKey]) {
          state.activeConfig.ui[toastConfigKey].hover_renew = isChecked;
        }
        if (state.pendingConfig && state.pendingConfig.ui && state.pendingConfig.ui[toastConfigKey]) {
          state.pendingConfig.ui[toastConfigKey].hover_renew = isChecked;
        }
        saveConfigState();
      };
    }
  });

  document.getElementById('settings-silence-timeout').oninput = (e) => {
    const val = e.target.value;
    document.getElementById('silence-timeout-val').textContent = `${val} ms`;
    state.activeConfig.dictation.silence_timeout_ms = parseInt(val, 10);
    if (state.pendingConfig) state.pendingConfig.dictation.silence_timeout_ms = parseInt(val, 10);
    debouncedSaveConfig();
  };

  document.getElementById('settings-start-delay').oninput = (e) => {
    const val = e.target.value;
    document.getElementById('start-delay-val').textContent = `${val} ms`;
    state.activeConfig.dictation.start_delay_ms = parseInt(val, 10);
    if (state.pendingConfig) state.pendingConfig.dictation.start_delay_ms = parseInt(val, 10);
    debouncedSaveConfig();
  };

  document.getElementById('settings-audio-device').onchange = async (e) => {
    const devId = e.target.value;
    state.activeConfig.audio.input_device = devId;
    if (state.pendingConfig) state.pendingConfig.audio.input_device = devId;
    if (window.__TAURI__) {
      try {
        await window.__TAURI__.core.invoke('set_audio_device', { deviceId: devId });
        ToastManager.show({ type: 'success', title: t('toast.mic_updated') });
      } catch (err) {
        ToastManager.show({ type: 'error', title: t('toast.mic_update_failed'), message: err.toString() });
      }
    }
    if (typeof window.micTestState === 'object' && window.micTestState.isActive) {
      if (typeof window.stopMicTest === 'function' && typeof window.startMicTest === 'function') {
        window.stopMicTest();
        await window.startMicTest();
      }
    }
  };

  const applyBtn = document.getElementById('btn-engine-apply');
  if (applyBtn) {
    applyBtn.addEventListener('click', async () => {
      const engineId = state.pendingConfig.engine.type;
      const onlineEngines = ['deepgram', 'assemblyai', 'openai', 'google', 'azure'];

      if (onlineEngines.includes(engineId)) {
        let key = '';
        if (engineId === 'deepgram') key = state.pendingConfig.engine.deepgram.api_key;
        if (engineId === 'assemblyai') key = state.pendingConfig.engine.assemblyai.api_key;
        if (engineId === 'openai') key = state.pendingConfig.engine.openai.api_key;
        if (engineId === 'google') key = state.pendingConfig.engine.google.credentials_path;
        if (engineId === 'azure') key = state.pendingConfig.engine.azure.subscription_key;

        if (!key || !key.trim()) {
          ToastManager.show({ type: 'error', title: t('toast.missing_api_key_title'), message: t('toast.missing_api_key_msg', { engine: engineId }), persistent: true });
          return;
        }

        ToastManager.show({ type: 'info', title: t('toast.verifying_api_conn') });
        try {
          if (window.__TAURI__) {
            await window.__TAURI__.core.invoke('save_config', { config: state.pendingConfig });
            const testRes = await window.__TAURI__.core.invoke('test_engine', { engineType: engineId });
            await window.__TAURI__.core.invoke('set_engine', { engineType: engineId });
            
            state.activeConfig = JSON.parse(JSON.stringify(state.pendingConfig));
            checkEngineDirty();

            renderTriggerWords(state.activeConfig.trigger.words);
            renderStopWords(state.activeConfig.dictation.stop_words);
            loadConfigGeneralUI(state.activeConfig);
            updateActiveEnginePanel(state.activeConfig.engine.type);

            let msg = t(testRes.key, { engine: testRes.engine });
            ToastManager.show({ type: 'success', title: t('toast.engine_verified_activated'), message: msg });
            return;
          }
        } catch (err) {
          if (window.__TAURI__) {
            await window.__TAURI__.core.invoke('save_config', { config: state.activeConfig });
          }
          let msg = formatEngineErrorMessage(err, engineId);
          ToastManager.show({ type: 'error', title: t('toast.api_key_verification_error'), message: msg, persistent: true });
          return;
        }
      }

      let modelId = '';
      if (engineId === 'vosk') {
        const parts = state.pendingConfig.engine.vosk.model_path.split(/[/\\]/);
        modelId = parts[parts.length - 1];
      } else if (engineId === 'sherpa_onnx') {
        const parts = state.pendingConfig.engine.sherpa_onnx.model_path.split(/[/\\]/);
        modelId = parts[parts.length - 1];
      } else {
        modelId = state.pendingConfig.engine.whisper.model;
      }

      let isDownloaded = true;
      if (engineId === 'vosk' || engineId === 'sherpa_onnx' || engineId === 'whisper' || engineId === 'faster_whisper') {
        const checkEngine = engineId === 'faster_whisper' ? 'whisper' : engineId;
        isDownloaded = await window.__TAURI__.core.invoke('check_model_downloaded', { engine: checkEngine, model: modelId });
      }

      if (isDownloaded) {
        state.activeConfig = JSON.parse(JSON.stringify(state.pendingConfig));
        await saveConfigState();
        if (window.__TAURI__) {
          await window.__TAURI__.core.invoke('set_engine', { engineType: engineId });
        }
        checkEngineDirty();
        
        renderTriggerWords(state.activeConfig.trigger.words);
        renderStopWords(state.activeConfig.dictation.stop_words);
        loadConfigGeneralUI(state.activeConfig);
        updateActiveEnginePanel(state.activeConfig.engine.type);
        
        ToastManager.show({ type: 'success', title: t('toast.changes_applied'), message: t('toast.engine_updated_msg') });
      } else {
        const isCurrentlyDownloading = state.downloadQueue.some(q => q.model === modelId && (q.status === 'downloading' || q.status === 'queued'));
        if (isCurrentlyDownloading) {
          state.activeConfig = JSON.parse(JSON.stringify(state.pendingConfig));
          await saveConfigState();
          checkEngineDirty();
          
          renderTriggerWords(state.activeConfig.trigger.words);
          renderStopWords(state.activeConfig.dictation.stop_words);
          loadConfigGeneralUI(state.activeConfig);
          updateActiveEnginePanel(state.activeConfig.engine.type);
          
          ToastManager.show({ 
            type: 'info', 
            title: t('toast.engine_applied_title'), 
            message: t('toast.engine_applied_msg') 
          });
          return;
        }

        showCustomConfirmModal({
          title: t('engines.missing_model_title'),
          message: t('engines.missing_model_msg', { engine: engineId, model: modelId }),
          confirmText: t('engines.missing_model_btn'),
          onConfirm: async () => {
            const checkEngine = engineId === 'faster_whisper' ? 'whisper' : engineId;
            const progressContainer = document.getElementById('download-progress-container');
            if (progressContainer) progressContainer.style.display = 'block';
            
            applyBtn.disabled = true;
            applyBtn.style.opacity = '0.5';

            try {
              ToastManager.show({ type: 'info', title: t('toast.download_started'), message: t('toast.download_started_msg', { model: modelId }) });
              if (typeof window.addModelToDownloadQueue === 'function') {
                window.addModelToDownloadQueue(checkEngine, modelId);
              }
              
              state.activeConfig = JSON.parse(JSON.stringify(state.pendingConfig));
              await saveConfigState();
              checkEngineDirty();
              
              renderTriggerWords(state.activeConfig.trigger.words);
              renderStopWords(state.activeConfig.dictation.stop_words);
              loadConfigGeneralUI(state.activeConfig);
              updateActiveEnginePanel(state.activeConfig.engine.type);
              
              ToastManager.show({ type: 'success', title: t('toast.changes_applied'), message: t('toast.download_finished_active_msg') });
            } catch (err) {
              ToastManager.show({ type: 'error', title: t('toast.download_error'), message: err.toString(), persistent: true });
            } finally {
              applyBtn.disabled = false;
              applyBtn.style.opacity = '1';
            }
          },
          onCancel: () => {
            state.pendingConfig = JSON.parse(JSON.stringify(state.activeConfig));
            loadConfigGeneralUI(state.activeConfig);
            updateActiveEnginePanel(state.activeConfig.engine.type);
            checkEngineDirty();
          }
        });
      }
    });
  }

  const testApiBtn = document.getElementById('btn-test-api');
  if (testApiBtn) {
    testApiBtn.addEventListener('click', async () => {
      ToastManager.show({ type: 'info', title: t('toast.testing_connection_title') });
      if (window.__TAURI__) {
        try {
          if (state.pendingConfig) {
            await window.__TAURI__.core.invoke('save_config', { config: state.pendingConfig });
          }
          const response = await window.__TAURI__.core.invoke('test_engine', { engineType: state.pendingConfig ? state.pendingConfig.engine.type : null });
          let msg = t(response.key, { engine: response.engine });
          ToastManager.show({ type: 'success', title: t('toast.connection_test_title'), message: msg });
        } catch (err) {
          let msg = err.toString();
          try {
            const res = JSON.parse(err);
            if (res && res.key) {
              msg = t(res.key, { engine: res.engine, error: res.error_detail });
            }
          } catch {}
          ToastManager.show({ type: 'error', title: t('toast.conn_test_failed'), message: msg, persistent: true });
        }
      } else {
        setTimeout(() => {
          ToastManager.show({ type: 'success', title: t('toast.connection_test_title'), message: t('toast.api_test_mock_success') });
        }, 1000);
      }
    });
  }

  const resetConfigBtn = document.getElementById('btn-reset-all-config');
  if (resetConfigBtn) {
    resetConfigBtn.addEventListener('click', () => {
      showCustomConfirmModal({
        title: t('settings.reset_confirm_title'),
        message: t('settings.reset_confirm_msg'),
        confirmText: t('settings.reset_confirm_btn'),
        cancelText: t('btn.cancel'),
        isDanger: true,
        onConfirm: async () => {
          if (window.__TAURI__) {
            try {
              const defaultCfg = await window.__TAURI__.core.invoke('reset_config');
              state.activeConfig = defaultCfg;
              state.pendingConfig = JSON.parse(JSON.stringify(defaultCfg));
              applyAppearanceSettings(defaultCfg);
              loadConfigGeneralUI(defaultCfg);
              updateActiveEnginePanel(defaultCfg.engine.type);
              checkEngineDirty();
              renderTriggerWords(defaultCfg.trigger.words);
              renderStopWords(defaultCfg.dictation.stop_words);
              ToastManager.show({ type: 'success', title: t('toast.reset_success_title'), message: t('toast.reset_success_msg') });
            } catch (err) {
              ToastManager.show({ type: 'error', title: t('toast.reset_failed'), message: err.toString() });
            }
          }
        }
      });
    });
  }

  const hardResetBtn = document.getElementById('btn-hard-reset-app');
  if (hardResetBtn) {
    hardResetBtn.addEventListener('click', () => {
      showCustomConfirmModal({
        title: t('settings.hard_reset_confirm_title'),
        message: t('settings.hard_reset_confirm_msg'),
        confirmText: t('settings.hard_reset_confirm_btn'),
        cancelText: t('btn.cancel'),
        isDanger: true,
        isHazard: true,
        onConfirm: async () => {
          if (window.__TAURI__) {
            try {
              await window.__TAURI__.core.invoke('hard_reset_config');
            } catch (err) {
              ToastManager.show({ type: 'error', title: t('toast.hard_reset_failed'), message: err.toString() });
            }
          }
        }
      });
    });
  }

  const openConfigBtn = document.getElementById('btn-open-config-dir');
  if (openConfigBtn) {
    openConfigBtn.onclick = async () => {
      if (window.__TAURI__) {
        try {
          await window.__TAURI__.core.invoke('open_config_directory');
        } catch (err) {
          ToastManager.show({ type: 'error', title: t('toast.open_config_failed'), message: err.toString() });
        }
      }
    };
  }

  initCloudLiveTypingWarningModalListeners();
}

// Bind to window for global callbacks from other files
window.loadConfigGeneralUI = loadConfigGeneralUI;
window.updateActiveEnginePanel = updateActiveEnginePanel;
window.checkEngineDirty = checkEngineDirty;
window.checkPython = checkPython;
window.updateEngineCardsLockUI = updateEngineCardsLockUI;
