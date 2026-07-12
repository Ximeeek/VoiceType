/**
 * Module: Onboarding Setup Wizard Controller
 * Single Responsibility: Orchestrates the first-run walkthrough pages, including language selection,
 * hardware GPU/disk-space validation, initial model download, and saving first-start configuration.
 */

import { state, saveConfigState } from './state.js';
import { t, setLanguage } from './i18n.js';
import { ToastManager } from './toast.js';
import { checkAndShowChangelogOnStartup } from './changelog.js';
import { applyAppearanceSettings } from './theme.js';
import { renderTriggerWords, renderStopWords, checkActiveEngineAvailability } from './dashboard.js';
import { loadConfigGeneralUI, updateActiveEnginePanel, updateEngineCardsUI } from './settings-ui.js';

export const OnboardingController = {
  currentStep: 1,
  selectedLanguage: 'pl',
  selectedSpeechLanguage: 'pl',
  selectedCategory: 'offline', // 'offline' or 'cloud'
  selectedEngine: 'vosk',
  selectedModelId: '',
  selectedModelName: '-',
  selectedModelSize: '-',
  selectedModelSizeBytes: 0,
  selectedProfile: 'low', // 'low', 'mid', 'high'
  gbLimit: 1.0,
  autoSelectSpace: true,
  freeDiskSpaceBytes: 0,
  hasGpu: false,
  isDownloading: false,
  cloudValidated: false,
  upgradeModelRef: null,

  async init() {
    console.log('[Onboarding] Initializing...');
    if (!window.__TAURI__) return;
    
    try {
      const showOnboarding = await window.__TAURI__.core.invoke('check_show_first_start');
      if (!showOnboarding) {
        console.log('[Onboarding] Setup not required, skipping.');
        return;
      }
      
      console.log('[Onboarding] Setup required! Showing modal.');
      
      // Auto-detect default language
      this.selectedLanguage = state.activeConfig?.general?.language 
        ? state.activeConfig.general.language 
        : (navigator.language.startsWith('pl') ? 'pl' : 'en');
      this.selectedSpeechLanguage = this.selectedLanguage;
      
      this.updateLanguageUI();
      this.bindEvents();
      
      const modal = document.getElementById('onboarding-modal');
      if (modal) modal.style.display = 'flex';
    } catch (err) {
      console.error('[Onboarding] Initialization failed:', err);
    }
  },

  updateLanguageUI() {
    document.querySelectorAll('.onboard-lang-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`onboard-lang-${this.selectedLanguage}`);
    if (activeBtn) activeBtn.classList.add('active');

    const activeSpeechBtn = document.getElementById(`onboard-speech-lang-${this.selectedSpeechLanguage}`);
    if (activeSpeechBtn) activeSpeechBtn.classList.add('active');
    
    setLanguage(this.selectedLanguage);
    
    const btnDownload = document.getElementById('btn-onboard-download-model');
    if (btnDownload) {
      btnDownload.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        <span>${t('onboard.model.btn_download')}</span>
      `;
    }
    
    this.updateOfflineModelInfo();
  },

  bindEvents() {
    const langEn = document.getElementById('onboard-lang-en');
    if (langEn) {
      langEn.onclick = () => {
        this.selectedLanguage = 'en';
        this.selectedSpeechLanguage = 'en';
        this.updateLanguageUI();
      };
    }
    const langPl = document.getElementById('onboard-lang-pl');
    if (langPl) {
      langPl.onclick = () => {
        this.selectedLanguage = 'pl';
        this.selectedSpeechLanguage = 'pl';
        this.updateLanguageUI();
      };
    }

    document.querySelectorAll('[id^="onboard-speech-lang-"]').forEach(btn => {
      btn.onclick = () => {
        this.selectedSpeechLanguage = btn.getAttribute('data-lang');
        document.querySelectorAll('[id^="onboard-speech-lang-"]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.updateOfflineModelInfo();
      };
    });

    const skipBtn = document.getElementById('onboard-skip-btn');
    if (skipBtn) {
      skipBtn.onclick = (e) => {
        e.preventDefault();
        this.skipSetup();
      };
    }

    const cardOffline = document.getElementById('onboard-category-offline');
    const cardCloud = document.getElementById('onboard-category-cloud');
    if (cardOffline) {
      cardOffline.onclick = () => {
        this.selectedCategory = 'offline';
        cardOffline.classList.add('active');
        if (cardCloud) cardCloud.classList.remove('active');
      };
    }
    if (cardCloud) {
      cardCloud.onclick = () => {
        this.selectedCategory = 'cloud';
        cardCloud.classList.add('active');
        if (cardOffline) cardOffline.classList.remove('active');
      };
    }

    const providerSelect = document.getElementById('onboard-cloud-provider');
    if (providerSelect) {
      providerSelect.onchange = () => {
        this.cloudValidated = false;
        const testStatus = document.getElementById('onboard-cloud-test-status');
        if (testStatus) testStatus.style.display = 'none';
        
        const provider = providerSelect.value;
        const extraContainer = document.getElementById('onboard-cloud-extra-container');
        const extraLabel = document.getElementById('onboard-cloud-extra-label');
        const extraInput = document.getElementById('onboard-cloud-extra-input');
        const keyLabel = document.querySelector('#onboard-cloud-api-key-container .input-label');
        const keyInput = document.getElementById('onboard-cloud-api-key-input');
        
        if (provider === 'azure') {
          if (extraContainer) extraContainer.style.display = 'flex';
          if (extraLabel) extraLabel.textContent = 'Azure Region (e.g. eastus)';
          if (extraInput) extraInput.placeholder = 'eastus';
          if (keyLabel) keyLabel.textContent = t('onboard.cloud.api_key');
          if (keyInput) keyInput.placeholder = 'Paste subscription key';
        } else if (provider === 'google') {
          if (extraContainer) extraContainer.style.display = 'none';
          if (keyLabel) keyLabel.textContent = t('onboard.cloud.region'); 
          if (keyInput) keyInput.placeholder = 'Paste Google API Key or Path to credentials.json';
        } else {
          if (extraContainer) extraContainer.style.display = 'none';
          if (keyLabel) keyLabel.textContent = t('onboard.cloud.api_key');
          if (keyInput) keyInput.placeholder = 'Paste your API key here';
        }
      };
    }

    const btnCloudTest = document.getElementById('btn-onboard-cloud-test');
    if (btnCloudTest) {
      btnCloudTest.onclick = async () => {
        const provider = providerSelect.value;
        const keyVal = document.getElementById('onboard-cloud-api-key-input').value.trim();
        const extraVal = document.getElementById('onboard-cloud-extra-input').value.trim();
        
        const testStatus = document.getElementById('onboard-cloud-test-status');
        if (testStatus) {
          testStatus.style.display = 'block';
          testStatus.style.color = 'var(--text-secondary)';
          testStatus.textContent = t('onboard.cloud.testing');
        }
        
        try {
          state.activeConfig.engine.type = provider;
          if (provider === 'deepgram') {
            state.activeConfig.engine.deepgram.api_key = keyVal;
          } else if (provider === 'assemblyai') {
            state.activeConfig.engine.assemblyai.api_key = keyVal;
          } else if (provider === 'openai') {
            state.activeConfig.engine.openai.api_key = keyVal;
          } else if (provider === 'google') {
            state.activeConfig.engine.google.credentials_path = keyVal;
          } else if (provider === 'azure') {
            state.activeConfig.engine.azure.subscription_key = keyVal;
            state.activeConfig.engine.azure.region = extraVal;
          }
          
          await window.__TAURI__.core.invoke('save_config', { config: state.activeConfig });
          
          const result = await window.__TAURI__.core.invoke('test_engine', { engineType: provider });
          console.log('[Onboarding] Test engine result:', result);
          
          this.cloudValidated = true;
          this.selectedEngine = provider;
          if (testStatus) {
            testStatus.style.color = 'var(--accent-green)';
            testStatus.textContent = t('onboard.cloud.test_success');
          }
        } catch (err) {
          console.error('[Onboarding] Test connection failed:', err);
          this.cloudValidated = false;
          if (testStatus) {
            testStatus.style.color = '#ef4444';
            testStatus.textContent = t('onboard.cloud.test_failed');
          }
        }
      };
    }

    const profLow = document.getElementById('onboard-profile-low');
    const profMid = document.getElementById('onboard-profile-mid');
    const profHigh = document.getElementById('onboard-profile-high');
    if (profLow) {
      profLow.onclick = () => this.setOfflineProfile('low');
    }
    if (profMid) {
      profMid.onclick = () => this.setOfflineProfile('mid');
    }
    if (profHigh) {
      profHigh.onclick = () => this.setOfflineProfile('high');
    }

    const offlineEngineSelect = document.getElementById('onboard-offline-engine-select');
    if (offlineEngineSelect) {
      offlineEngineSelect.onchange = () => {
        this.selectedEngine = offlineEngineSelect.value;
        this.updateOfflineModelInfo();
      };
    }

    const autoSpaceCheckbox = document.getElementById('onboard-offline-auto-space');
    if (autoSpaceCheckbox) {
      autoSpaceCheckbox.onchange = () => {
        this.autoSelectSpace = autoSpaceCheckbox.checked;
        const manualLimitSect = document.getElementById('onboard-offline-manual-limit-container');
        if (manualLimitSect) {
          manualLimitSect.style.display = this.autoSelectSpace ? 'none' : 'flex';
        }
        this.updateOfflineModelInfo();
      };
    }

    document.querySelectorAll('.gb-pill-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.gb-pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.gbLimit = parseFloat(btn.dataset.gb);
        this.updateOfflineModelInfo();
      };
    });

    const btnUpgrade = document.getElementById('onboard-offline-btn-upgrade');
    if (btnUpgrade) {
      btnUpgrade.onclick = () => {
        if (this.upgradeModelRef) {
          this.selectedModelId = this.upgradeModelRef.id;
          this.selectedModelName = this.upgradeModelRef.name;
          this.selectedModelSize = this.upgradeModelRef.size_text;
          this.selectedModelSizeBytes = this.upgradeModelRef.size_bytes;
          this.updateOfflineModelUI();
          
          const upgradePrompt = document.getElementById('onboard-offline-upgrade-prompt');
          if (upgradePrompt) upgradePrompt.style.display = 'none';
          this.upgradeModelRef = null;
        }
      };
    }
    const btnStay = document.getElementById('onboard-offline-btn-stay');
    if (btnStay) {
      btnStay.onclick = () => {
        const upgradePrompt = document.getElementById('onboard-offline-upgrade-prompt');
        if (upgradePrompt) upgradePrompt.style.display = 'none';
        this.upgradeModelRef = null;
      };
    }

    const prevBtn = document.getElementById('btn-onboard-prev');
    if (prevBtn) {
      prevBtn.onclick = () => {
        if (this.isDownloading) return;
        
        if (this.currentStep === 7) {
          if (this.selectedCategory === 'cloud') {
            this.goToStep(4);
          } else {
            window.__TAURI__.core.invoke('check_model_downloaded', { 
              engine: this.selectedEngine, 
              model: this.selectedModelId 
            }).then(isDownloaded => {
              if (isDownloaded) {
                this.goToStep(5);
              } else {
                this.goToStep(6);
              }
            });
          }
        } else if (this.currentStep === 8) {
          this.goToStep(7);
        } else {
          this.goToStep(this.currentStep - 1);
        }
      };
    }

    const nextBtn = document.getElementById('btn-onboard-next');
    if (nextBtn) {
      nextBtn.onclick = async () => {
        if (this.isDownloading) return;
        
        if (this.currentStep === 3) {
          const cloudSect = document.getElementById('onboard-cloud-setup-section');
          const offlineSect = document.getElementById('onboard-offline-setup-section');
          if (this.selectedCategory === 'cloud') {
            if (cloudSect) cloudSect.style.display = 'flex';
            if (offlineSect) offlineSect.style.display = 'none';
          } else {
            if (cloudSect) cloudSect.style.display = 'none';
            if (offlineSect) offlineSect.style.display = 'flex';
            await this.runGpuCheck();
          }
        }
        
        if (this.currentStep === 4) {
          if (this.selectedCategory === 'cloud') {
            if (!this.cloudValidated) {
              ToastManager.show({ type: 'warning', title: t('engines.api_key_invalid'), message: t('onboard.cloud.validation_required') });
              return;
            }
            this.goToStep(7);
            return;
          } else {
            await this.queryDiskSpace();
            this.goToStep(5);
            return;
          }
        }

        if (this.currentStep === 5) {
          const isDownloaded = await window.__TAURI__.core.invoke('check_model_downloaded', { 
            engine: this.selectedEngine, 
            model: this.selectedModelId 
          });
          if (isDownloaded) {
            this.goToStep(7);
          } else {
            const statusText = document.getElementById('onboard-download-status-text');
            if (statusText) statusText.textContent = `${t('onboard.model.btn_download')} (${this.selectedModelName})`;
            this.goToStep(6);
          }
          return;
        }

        if (this.currentStep === 6) {
          this.goToStep(7);
          return;
        }
        
        if (this.currentStep === 7) {
          const summaryLang = document.getElementById('onboard-summary-lang');
          if (summaryLang) summaryLang.textContent = this.selectedLanguage === 'pl' ? 'Polski' : 'English';
          
          const summarySpeechLang = document.getElementById('onboard-summary-speech-lang');
          if (summarySpeechLang) summarySpeechLang.textContent = this.selectedSpeechLanguage === 'pl' ? 'Polski' : 'English';

          const summaryEngine = document.getElementById('onboard-summary-engine');
          if (summaryEngine) {
            summaryEngine.textContent = this.selectedCategory === 'cloud' 
              ? `Cloud API (${this.selectedEngine.toUpperCase()})` 
              : `Offline (${this.selectedEngine === 'faster_whisper' ? 'Faster-Whisper' : this.selectedEngine === 'whisper' ? 'Whisper.cpp' : this.selectedEngine.toUpperCase()})`;
          }
          
          const summaryModelRow = document.getElementById('onboard-summary-model-row');
          const summaryModel = document.getElementById('onboard-summary-model');
          if (this.selectedCategory === 'cloud') {
            if (summaryModelRow) summaryModelRow.style.display = 'none';
          } else {
            if (summaryModelRow) summaryModelRow.style.display = 'flex';
            if (summaryModel) summaryModel.textContent = this.selectedModelName;
          }
          
          const autostartEnabled = document.getElementById('onboard-pref-autostart').checked;
          const summaryAutostart = document.getElementById('onboard-summary-autostart');
          if (summaryAutostart) {
            summaryAutostart.textContent = autostartEnabled 
              ? t('onboard.finish.summary.enabled') 
              : t('onboard.finish.summary.disabled');
          }
        }

        if (this.currentStep === 8) {
          await this.completeSetup();
          return;
        }

        this.goToStep(this.currentStep + 1);
      };
    }

    const downloadBtn = document.getElementById('btn-onboard-download-model');
    if (downloadBtn) {
      downloadBtn.onclick = () => {
        this.startModelDownload();
      };
    }
  },

  async queryDiskSpace() {
    if (!window.__TAURI__) return;
    try {
      const freeSpaceBytes = await window.__TAURI__.core.invoke('get_free_disk_space');
      this.freeDiskSpaceBytes = freeSpaceBytes;
      
      const sizeGB = (freeSpaceBytes / (1024 * 1024 * 1024)).toFixed(1);
      const freeSpaceEl = document.getElementById('onboard-offline-free-space');
      if (freeSpaceEl) {
        freeSpaceEl.textContent = `${sizeGB} GB`;
      }
    } catch (err) {
      console.error('[Onboarding] Failed to query disk space:', err);
    }
  },

  setOfflineProfile(profile) {
    this.selectedProfile = profile;
    document.querySelectorAll('.onboard-profile-card').forEach(c => c.classList.remove('active'));
    
    const card = document.getElementById(`onboard-profile-${profile}`);
    if (card) card.classList.add('active');
    
    const midSelect = document.getElementById('onboard-profile-mid-engines');
    if (midSelect) midSelect.style.display = (profile === 'mid') ? 'flex' : 'none';
    
    if (profile === 'low') {
      this.selectedEngine = 'vosk';
    } else if (profile === 'high') {
      this.selectedEngine = 'faster_whisper';
    } else {
      const select = document.getElementById('onboard-offline-engine-select');
      this.selectedEngine = select ? select.value : 'whisper';
    }
    
    this.updateOfflineModelInfo();
  },

  async updateOfflineModelInfo() {
    if (!window.__TAURI__) return;
    
    try {
      const models = await window.__TAURI__.core.invoke('get_available_models', { 
        engine: this.selectedEngine, 
        language: this.selectedSpeechLanguage 
      });
      
      if (!models || models.length === 0) {
        this.selectedModelId = '';
        this.selectedModelName = '-';
        this.selectedModelSize = '-';
        this.selectedModelSizeBytes = 0;
        this.updateOfflineModelUI();
        return;
      }
      
      models.sort((a, b) => a.size_bytes - b.size_bytes);
      
      let bestModel = null;
      let limitBytes = 0;
      
      if (this.autoSelectSpace) {
        const safetyMarginBytes = 5 * 1024 * 1024 * 1024;
        const allowedBytes = Math.max(100 * 1024 * 1024, this.freeDiskSpaceBytes - safetyMarginBytes);
        
        for (let i = models.length - 1; i >= 0; i--) {
          if (models[i].size_bytes <= allowedBytes) {
            bestModel = models[i];
            break;
          }
        }
      } else {
        limitBytes = this.gbLimit * 1024 * 1024 * 1024;
        for (let i = models.length - 1; i >= 0; i--) {
          if (models[i].size_bytes <= limitBytes) {
            bestModel = models[i];
            break;
          }
        }
      }
      
      if (!bestModel) {
        bestModel = models[0];
      }
      
      this.selectedModelId = bestModel.id;
      this.selectedModelName = bestModel.name;
      this.selectedModelSize = bestModel.size_text;
      this.selectedModelSizeBytes = bestModel.size_bytes;
      
      let upgradeModel = null;
      if (!this.autoSelectSpace && limitBytes > 0) {
        const matchedIdx = models.findIndex(m => m.id === bestModel.id);
        if (matchedIdx !== -1 && matchedIdx < models.length - 1) {
          const nextModel = models[matchedIdx + 1];
          const overflow = nextModel.size_bytes - limitBytes;
          const tenPercentOfLimit = limitBytes * 0.1;
          if (overflow <= tenPercentOfLimit) {
            upgradeModel = nextModel;
          }
        }
      }
      
      const upgradePrompt = document.getElementById('onboard-offline-upgrade-prompt');
      if (upgradeModel) {
        const pctOverflow = Math.round(((upgradeModel.size_bytes - limitBytes) / limitBytes) * 100);
        const upgradeText = document.getElementById('onboard-offline-upgrade-text');
        if (upgradeText) {
          const msg = t('onboard.offline.upgrade_msg')
            .replace('{name}', upgradeModel.name)
            .replace('{size}', upgradeModel.size_text)
            .replace('{percent}', pctOverflow);
          upgradeText.textContent = msg;
        }
        
        this.upgradeModelRef = upgradeModel;
        if (upgradePrompt) upgradePrompt.style.display = 'flex';
      } else {
        if (upgradePrompt) upgradePrompt.style.display = 'none';
        this.upgradeModelRef = null;
      }
      
      this.updateOfflineModelUI();
    } catch (err) {
      console.error('[Onboarding] Failed to search models:', err);
    }
  },
  
  updateOfflineModelUI() {
    const nameEl = document.getElementById('onboard-offline-matched-name');
    const sizeEl = document.getElementById('onboard-offline-matched-size');
    if (nameEl) nameEl.textContent = this.selectedModelName;
    if (sizeEl) sizeEl.textContent = this.selectedModelSize;
  },

  async runGpuCheck() {
    const gpuBanner = document.getElementById('onboard-offline-gpu-status');
    if (!window.__TAURI__) {
      this.hasGpu = false;
      if (gpuBanner) {
        gpuBanner.style.display = 'flex';
        gpuBanner.className = 'gpu-status-banner no-gpu';
        gpuBanner.textContent = t('onboard.offline.gpu_not_detected');
      }
      this.setOfflineProfile('low');
      return;
    }
    
    try {
      this.hasGpu = await window.__TAURI__.core.invoke('check_gpu_support');
      if (gpuBanner) {
        gpuBanner.style.display = 'flex';
        if (this.hasGpu) {
          gpuBanner.className = 'gpu-status-banner';
          gpuBanner.textContent = t('onboard.offline.gpu_detected');
          this.setOfflineProfile('high');
        } else {
          gpuBanner.className = 'gpu-status-banner no-gpu';
          gpuBanner.textContent = t('onboard.offline.gpu_not_detected');
          this.setOfflineProfile('low');
        }
      }
    } catch (err) {
      console.error('[Onboarding] GPU check failed:', err);
      this.hasGpu = false;
      if (gpuBanner) {
        gpuBanner.style.display = 'flex';
        gpuBanner.className = 'gpu-status-banner no-gpu';
        gpuBanner.textContent = t('onboard.offline.gpu_not_detected');
      }
      this.setOfflineProfile('low');
    }
  },

  goToStep(step) {
    if (step < 1 || step > 8) return;
    
    document.querySelectorAll('.onboarding-step').forEach(el => {
      el.classList.remove('active');
    });
    
    this.currentStep = step;
    
    const targetStepEl = document.querySelector(`.onboarding-step[data-step="${step}"]`);
    if (targetStepEl) targetStepEl.classList.add('active');

    document.querySelectorAll('.onboard-dot').forEach(el => {
      el.classList.remove('active');
    });
    const targetDotEl = document.querySelector(`.onboard-dot[data-step-dot="${step}"]`);
    if (targetDotEl) targetDotEl.classList.add('active');

    const prevBtn = document.getElementById('btn-onboard-prev');
    if (prevBtn) {
      prevBtn.style.visibility = (step === 1) ? 'hidden' : 'visible';
    }

    const nextBtn = document.getElementById('btn-onboard-next');
    if (nextBtn) {
      if (step === 8) {
        nextBtn.textContent = t('onboard.btn.finish');
        nextBtn.classList.add('accent');
      } else {
        nextBtn.textContent = t('onboard.btn.next');
        nextBtn.classList.remove('accent');
      }
    }
  },

  async startModelDownload() {
    this.isDownloading = true;
    const btnDownload = document.getElementById('btn-onboard-download-model');
    const progressContainer = document.getElementById('onboard-download-progress-container');
    const progressFill = document.getElementById('onboard-download-progress-fill');
    const percentageText = document.getElementById('onboard-download-percentage');
    const statusText = document.getElementById('onboard-download-status-text');

    if (btnDownload) btnDownload.style.display = 'none';
    if (progressContainer) progressContainer.style.display = 'block';
    if (percentageText) percentageText.style.display = 'block';

    if (statusText) statusText.textContent = t('onboard.model.downloading');

    const prevBtn = document.getElementById('btn-onboard-prev');
    if (prevBtn) prevBtn.disabled = true;
    const nextBtn = document.getElementById('btn-onboard-next');
    if (nextBtn) nextBtn.disabled = true;

    try {
      console.log(`[Onboarding] Downloading model: ${this.selectedModelId} for engine: ${this.selectedEngine}`);
      
      if (window.__TAURI__) {
        await window.__TAURI__.core.invoke('cleanup_model_tmp_files', { 
          engine: this.selectedEngine, 
          model: this.selectedModelId 
        });
      }

      await window.__TAURI__.core.invoke('download_model', { 
        engine: this.selectedEngine, 
        model: this.selectedModelId 
      });
      
      this.isDownloading = false;
      if (statusText) statusText.textContent = t('onboard.model.download_complete');
      if (percentageText) percentageText.textContent = '100%';
      if (progressFill) progressFill.style.width = '100%';
      
      if (prevBtn) prevBtn.disabled = false;
      if (nextBtn) nextBtn.disabled = false;
      
      setTimeout(() => {
        if (this.currentStep === 6) {
          const nextBtn = document.getElementById('btn-onboard-next');
          if (nextBtn) nextBtn.click();
        }
      }, 1000);
    } catch (err) {
      console.error('[Onboarding] Download failed:', err);
      this.isDownloading = false;
      if (statusText) statusText.textContent = 'Download error!';
      if (btnDownload) btnDownload.style.display = 'block';
      if (progressContainer) progressContainer.style.display = 'none';
      if (percentageText) percentageText.style.display = 'none';
      
      if (prevBtn) prevBtn.disabled = false;
      if (nextBtn) nextBtn.disabled = false;
      
      ToastManager.show({ type: 'error', title: 'Download failed', message: err.toString() });
    }
  },

  handleDownloadProgress(progress) {
    if (!this.isDownloading) return;
    if (progress.model !== this.selectedModelId) return;

    const progressFill = document.getElementById('onboard-download-progress-fill');
    const percentageText = document.getElementById('onboard-download-percentage');
    const statusText = document.getElementById('onboard-download-status-text');

    const pct = Math.round(progress.percent);
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (percentageText) percentageText.textContent = `${pct}%`;

    if (progress.status_text) {
      const rawText = progress.status_text;
      let activeStatusText = rawText;
      if (rawText === 'Pobieranie pliku...') activeStatusText = t('downloads.status.downloading');
      else if (rawText === 'Rozpakowywanie archiwum...') activeStatusText = t('downloads.status.unpacking');
      else if (rawText === 'Finalizowanie zapisu...') activeStatusText = t('downloads.status.finalizing');
      else if (rawText === 'Ukończono') activeStatusText = t('downloads.status.completed');
      
      if (statusText) statusText.textContent = activeStatusText;
    }
  },

  async skipSetup() {
    console.log('[Onboarding] Skip requested by user.');
    state.activeConfig.general.first_start_completed = true;
    state.pendingConfig = JSON.parse(JSON.stringify(state.activeConfig));
    
    try {
      if (window.__TAURI__) {
        await window.__TAURI__.core.invoke('save_config', { config: state.activeConfig });
      }
      this.closeModal();
      ToastManager.show({ type: 'info', title: 'Setup completed', message: 'Onboarding setup skipped.' });
    } catch (err) {
      console.error('[Onboarding] Skip failed:', err);
    }
  },

  closeModal() {
    const modal = document.getElementById('onboarding-modal');
    if (modal) {
      modal.style.opacity = '0';
      setTimeout(() => {
        modal.remove();
        checkAndShowChangelogOnStartup();
      }, 400);
    }
  },

  async completeSetup() {
    console.log('[Onboarding] Completing setup and saving configuration...');
    
    state.activeConfig.general.language = this.selectedSpeechLanguage;
    state.activeConfig.engine.type = this.selectedEngine;
    
    if (this.selectedCategory === 'offline') {
      if (this.selectedEngine === 'vosk') {
        state.activeConfig.engine.vosk.model_path = `models/vosk/${this.selectedModelId}`;
      } else if (this.selectedEngine === 'sherpa_onnx') {
        state.activeConfig.engine.sherpa_onnx.model_path = `models/sherpa/${this.selectedModelId}`;
      } else if (this.selectedEngine === 'whisper') {
        state.activeConfig.engine.whisper.model = this.selectedModelId;
        state.activeConfig.engine.whisper.use_gpu = false;
      } else if (this.selectedEngine === 'faster_whisper') {
        state.activeConfig.engine.faster_whisper.model = this.selectedModelId;
        state.activeConfig.engine.whisper.model = this.selectedModelId;
        state.activeConfig.engine.whisper.use_gpu = this.hasGpu;
        if (this.hasGpu) {
          state.activeConfig.engine.faster_whisper.device = 'cuda';
        } else {
          state.activeConfig.engine.faster_whisper.device = 'cpu';
        }
      }
    }

    const autostartVal = document.getElementById('onboard-pref-autostart').checked;
    state.activeConfig.general.autostart = autostartVal;
    
    const minimizedVal = document.getElementById('onboard-pref-minimized').checked;
    state.activeConfig.ui.start_minimized = minimizedVal;

    state.activeConfig.general.first_start_completed = true;

    state.pendingConfig = JSON.parse(JSON.stringify(state.activeConfig));
    
    try {
      if (window.__TAURI__) {
        await window.__TAURI__.core.invoke('save_config', { config: state.activeConfig });
        
        applyAppearanceSettings(state.activeConfig);
        loadConfigGeneralUI(state.activeConfig);
        renderTriggerWords(state.activeConfig.trigger.words);
        renderStopWords(state.activeConfig.dictation.stop_words);
        
        await window.__TAURI__.core.invoke('set_engine', { engineType: this.selectedEngine });
      }
      
      state.activeConfig = JSON.parse(JSON.stringify(state.pendingConfig));
      if (typeof window.checkEngineDirty === 'function') {
        window.checkEngineDirty();
      }
      updateActiveEnginePanel(state.activeConfig.engine.type);
      updateEngineCardsUI(state.activeConfig.engine.type);

      this.closeModal();
      ToastManager.show({ type: 'success', title: t('toast.voicetype_active_title'), message: t('toast.voicetype_active_msg') });
      await checkActiveEngineAvailability();
      
    } catch (err) {
      console.error('[Onboarding] Failed to save configuration:', err);
      ToastManager.show({ type: 'error', title: 'Configuration error', message: err.toString() });
    }
  }
};
