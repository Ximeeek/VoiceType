import { setLanguage, t, updateDOMTranslations, getLanguage, onLanguageChange } from './i18n.js';
import { setupUpdateNotificationUI, initUpdater } from './updater.js';

const ACCENT_PRESETS = {
  neon: { main: '#39ff50', sec: '#e0147a', dim: 'rgba(57,255,80,0.12)', border: 'rgba(57,255,80,0.25)' },
  electric: { main: '#00d4ff', sec: '#7b2fff', dim: 'rgba(0,212,255,0.12)', border: 'rgba(0,212,255,0.25)' },
  plasma: { main: '#9b59ff', sec: '#e0147a', dim: 'rgba(155,89,255,0.12)', border: 'rgba(155,89,255,0.25)' },
  amber: { main: '#ff8c00', sec: '#ff2d6f', dim: 'rgba(255,140,0,0.12)', border: 'rgba(255,140,0,0.25)' },
  rose: { main: '#ff2d6f', sec: '#ff8c00', dim: 'rgba(255,45,111,0.12)', border: 'rgba(255,45,111,0.25)' },
  arctic: { main: '#e8f4f8', sec: '#4a9eff', dim: 'rgba(232,244,248,0.12)', border: 'rgba(232,244,248,0.25)' }
};

function hexToRgba(hex, alpha) {
  if (!hex || typeof hex !== 'string') return `rgba(57,255,80,${alpha})`;
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(57,255,80,${alpha})`;
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

function getContrastTextColor(hex) {
  if (!hex || typeof hex !== 'string') return '#080c08';
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return '#080c08';
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.55 ? '#080c08' : '#ffffff';
}

function applyAppearanceSettings(config) {
  if (!config || !config.ui) return;
  const ui = config.ui;

  document.documentElement.setAttribute('data-theme', ui.theme || 'dark');

  const isDual = ui.dual_accent || false;
  document.body.classList.toggle('dual-accent', isDual);

  const presetKey = ui.accent_preset || 'neon';
  let mainColor, secColor, dimColor, borderColor;

  if (presetKey === 'custom') {
    mainColor = ui.accent_custom_main || '#39ff50';
    secColor = isDual ? (ui.accent_custom_sec || '#e0147a') : mainColor;
    dimColor = hexToRgba(mainColor, 0.12);
    borderColor = hexToRgba(mainColor, 0.25);
  } else {
    const preset = ACCENT_PRESETS[presetKey] || ACCENT_PRESETS.neon;
    mainColor = preset.main;
    secColor = isDual ? preset.sec : mainColor;
    dimColor = preset.dim;
    borderColor = preset.border;
  }

  const contrastText = getContrastTextColor(mainColor);
  const pulseColor = hexToRgba(mainColor, 0.4);

  document.documentElement.style.setProperty('--accent-green', mainColor);
  document.documentElement.style.setProperty('--accent-magenta', secColor);
  document.documentElement.style.setProperty('--accent-green-dim', dimColor);
  document.documentElement.style.setProperty('--border-accent', borderColor);
  document.documentElement.style.setProperty('--accent-green-pulse', pulseColor);
  document.documentElement.style.setProperty('--accent-contrast-text', contrastText);

  const orb = document.getElementById('status-orb');
  if (orb) {
    orb.className = orb.className.replace(/\borb-style-\S+/g, '').trim();
    orb.classList.add(`orb-style-${ui.orb_style || 'liquid'}`);
  }

  document.body.className = document.body.className.replace(/\bbg-\S+/g, '').trim();
  document.body.classList.add(`bg-${ui.background_style || 'void'}`);

  document.documentElement.className = document.documentElement.className.replace(/\bdensity-\S+/g, '').trim();
  document.documentElement.classList.add(`density-${ui.ui_density || 'comfortable'}`);

  document.body.className = document.body.className.replace(/\banim-\S+/g, '').trim();
  document.body.classList.add(`anim-${ui.animation_intensity || 'full'}`);

  const opacity = (ui.window_opacity !== undefined) ? ui.window_opacity : 1.0;
  document.body.style.opacity = opacity;
}

function loadConfigAppearanceUI(config) {
  if (!config || !config.ui) return;
  const ui = config.ui;

  document.querySelectorAll('[data-appearance-theme]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-appearance-theme') === (ui.theme || 'dark'));
  });

  const dualToggle = document.getElementById('settings-dual-accent');
  if (dualToggle) dualToggle.checked = ui.dual_accent || false;

  const currentPreset = ui.accent_preset || 'neon';
  document.querySelectorAll('.preset-card').forEach(card => {
    card.classList.toggle('active', card.getAttribute('data-accent-preset') === currentPreset);
    const secSwatch = card.querySelector('.preset-swatch-sec');
    if (secSwatch) {
      secSwatch.style.display = ui.dual_accent ? 'block' : 'none';
    }
  });

  const pickersContainer = document.getElementById('custom-color-pickers');
  if (pickersContainer) {
    pickersContainer.style.display = currentPreset === 'custom' ? 'flex' : 'none';
    if (pickersContainer.children.length >= 2) {
      pickersContainer.children[1].style.display = ui.dual_accent ? 'flex' : 'none';
    }
  }

  const customMain = ui.accent_custom_main || '#39ff50';
  const customSec = ui.accent_custom_sec || '#e0147a';

  const swatchMain = document.getElementById('custom-swatch-main');
  const swatchSec = document.getElementById('custom-swatch-sec');
  if (swatchMain) swatchMain.style.background = customMain;
  if (swatchSec) swatchSec.style.background = customSec;

  const mainInput = document.getElementById('accent-custom-main-input');
  const mainText = document.getElementById('accent-custom-main-text');
  const secInput = document.getElementById('accent-custom-sec-input');
  const secText = document.getElementById('accent-custom-sec-text');
  if (mainInput) mainInput.value = customMain;
  if (mainText) mainText.value = customMain;
  if (secInput) secInput.value = customSec;
  if (secText) secText.value = customSec;

  document.querySelectorAll('[data-orb-style]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-orb-style') === (ui.orb_style || 'liquid'));
  });

  document.querySelectorAll('[data-bg-style]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-bg-style') === (ui.background_style || 'void'));
  });

  document.querySelectorAll('[data-ui-density]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-ui-density') === (ui.ui_density || 'comfortable'));
  });

  document.querySelectorAll('[data-anim-intensity]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-anim-intensity') === (ui.animation_intensity || 'full'));
  });

  const opacityInput = document.getElementById('settings-window-opacity');
  const opacityVal = document.getElementById('window-opacity-val');
  if (opacityInput && opacityVal) {
    const valPercent = Math.round((ui.window_opacity || 1.0) * 100);
    opacityInput.value = valPercent;
    opacityVal.textContent = `${valPercent}%`;
  }
}

function setupAppearanceEventListeners() {
  document.querySelectorAll('[data-appearance-theme]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const theme = e.currentTarget.getAttribute('data-appearance-theme');
      if (activeConfig && activeConfig.ui) {
        activeConfig.ui.theme = theme;
        if (pendingConfig && pendingConfig.ui) pendingConfig.ui.theme = theme;
        applyAppearanceSettings(activeConfig);
        loadConfigAppearanceUI(activeConfig);
        saveConfigState();
      }
    });
  });

  const dualToggle = document.getElementById('settings-dual-accent');
  if (dualToggle) {
    dualToggle.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      if (activeConfig && activeConfig.ui) {
        activeConfig.ui.dual_accent = isChecked;
        if (pendingConfig && pendingConfig.ui) pendingConfig.ui.dual_accent = isChecked;
        applyAppearanceSettings(activeConfig);
        loadConfigAppearanceUI(activeConfig);
        saveConfigState();
      }
    });
  }

  document.querySelectorAll('.preset-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const preset = e.currentTarget.getAttribute('data-accent-preset');
      if (activeConfig && activeConfig.ui) {
        activeConfig.ui.accent_preset = preset;
        if (pendingConfig && pendingConfig.ui) pendingConfig.ui.accent_preset = preset;
        applyAppearanceSettings(activeConfig);
        loadConfigAppearanceUI(activeConfig);
        saveConfigState();
      }
    });
  });

  function updateCustomAccent(main, sec) {
    if (!activeConfig || !activeConfig.ui) return;
    if (main !== null) {
      activeConfig.ui.accent_custom_main = main;
      if (pendingConfig && pendingConfig.ui) pendingConfig.ui.accent_custom_main = main;
    }
    if (sec !== null) {
      activeConfig.ui.accent_custom_sec = sec;
      if (pendingConfig && pendingConfig.ui) pendingConfig.ui.accent_custom_sec = sec;
    }
    activeConfig.ui.accent_preset = 'custom';
    if (pendingConfig && pendingConfig.ui) pendingConfig.ui.accent_preset = 'custom';
    applyAppearanceSettings(activeConfig);
    loadConfigAppearanceUI(activeConfig);
    debouncedSaveConfig();
  }

  const mainInput = document.getElementById('accent-custom-main-input');
  const mainText = document.getElementById('accent-custom-main-text');
  const secInput = document.getElementById('accent-custom-sec-input');
  const secText = document.getElementById('accent-custom-sec-text');

  if (mainInput) {
    mainInput.addEventListener('input', (e) => {
      if (mainText) mainText.value = e.target.value;
      updateCustomAccent(e.target.value, null);
    });
  }
  if (mainText) {
    mainText.addEventListener('input', (e) => {
      if (mainInput && e.target.value.match(/^#[0-9A-Fa-f]{6}$/)) {
        mainInput.value = e.target.value;
      }
      updateCustomAccent(e.target.value, null);
    });
  }
  if (secInput) {
    secInput.addEventListener('input', (e) => {
      if (secText) secText.value = e.target.value;
      updateCustomAccent(null, e.target.value);
    });
  }
  if (secText) {
    secText.addEventListener('input', (e) => {
      if (secInput && e.target.value.match(/^#[0-9A-Fa-f]{6}$/)) {
        secInput.value = e.target.value;
      }
      updateCustomAccent(null, e.target.value);
    });
  }

  document.querySelectorAll('[data-orb-style]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const style = e.currentTarget.getAttribute('data-orb-style');
      if (activeConfig && activeConfig.ui) {
        activeConfig.ui.orb_style = style;
        if (pendingConfig && pendingConfig.ui) pendingConfig.ui.orb_style = style;
        applyAppearanceSettings(activeConfig);
        loadConfigAppearanceUI(activeConfig);
        saveConfigState();
      }
    });
  });

  document.querySelectorAll('[data-bg-style]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const bg = e.currentTarget.getAttribute('data-bg-style');
      if (activeConfig && activeConfig.ui) {
        activeConfig.ui.background_style = bg;
        if (pendingConfig && pendingConfig.ui) pendingConfig.ui.background_style = bg;
        applyAppearanceSettings(activeConfig);
        loadConfigAppearanceUI(activeConfig);
        saveConfigState();
      }
    });
  });

  document.querySelectorAll('[data-ui-density]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const density = e.currentTarget.getAttribute('data-ui-density');
      if (activeConfig && activeConfig.ui) {
        activeConfig.ui.ui_density = density;
        if (pendingConfig && pendingConfig.ui) pendingConfig.ui.ui_density = density;
        applyAppearanceSettings(activeConfig);
        loadConfigAppearanceUI(activeConfig);
        saveConfigState();
      }
    });
  });

  document.querySelectorAll('[data-anim-intensity]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const anim = e.currentTarget.getAttribute('data-anim-intensity');
      if (activeConfig && activeConfig.ui) {
        activeConfig.ui.animation_intensity = anim;
        if (pendingConfig && pendingConfig.ui) pendingConfig.ui.animation_intensity = anim;
        applyAppearanceSettings(activeConfig);
        loadConfigAppearanceUI(activeConfig);
        saveConfigState();
      }
    });
  });

  const opacityInput = document.getElementById('settings-window-opacity');
  if (opacityInput) {
    opacityInput.addEventListener('input', (e) => {
      const valPercent = parseInt(e.target.value, 10);
      const valFloat = parseFloat((valPercent / 100).toFixed(2));
      const opacityVal = document.getElementById('window-opacity-val');
      if (opacityVal) opacityVal.textContent = `${valPercent}%`;

      if (activeConfig && activeConfig.ui) {
        activeConfig.ui.window_opacity = valFloat;
        if (pendingConfig && pendingConfig.ui) pendingConfig.ui.window_opacity = valFloat;
        applyAppearanceSettings(activeConfig);
        debouncedSaveConfig();
      }
    });
  }
}

// Toast Notification System
class ToastManager {
  static show({ type, title, message = '', persistent = false }) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const id = 'toast-' + Math.random().toString(36).substr(2, 9);
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.id = id;

    // Extract configurations specific to the toast type (success, info, error)
    let closeMode = 'timer';
    let durationMs = 3000;
    let hoverRenew = true;

    if (activeConfig && activeConfig.ui) {
      let toastConfigKey = 'toast_info';
      if (type === 'success') {
        toastConfigKey = 'toast_success';
      } else if (type === 'error') {
        toastConfigKey = 'toast_error';
      }
      
      const tCfg = activeConfig.ui[toastConfigKey];
      if (tCfg) {
        closeMode = tCfg.close_mode || 'timer';
        durationMs = tCfg.duration_ms !== undefined ? tCfg.duration_ms : 3000;
        hoverRenew = tCfg.hover_renew !== undefined ? tCfg.hover_renew : true;
      }
    } else {
      // Hardcoded fallback matching original behavior if config isn't loaded yet
      if (type === 'error') {
        closeMode = 'manual';
        durationMs = 5000;
      }
    }

    const isPersistent = closeMode === 'manual';

    let closeBtnHtml = '';
    if (isPersistent) {
      closeBtnHtml = `<button class="toast-close">×</button>`;
    }

    toast.innerHTML = `
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
      ${closeBtnHtml}
    `;

    container.appendChild(toast);

    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => ToastManager.hide(id));
    }

    if (!isPersistent) {
      const timerBar = document.createElement('div');
      timerBar.className = 'toast-timer';
      toast.appendChild(timerBar);

      const totalDuration = durationMs;
      let remainingTime = totalDuration;
      let lastTick = Date.now();
      let isHovered = false;
      let frameId = null;

      toast.addEventListener('mouseenter', () => {
        isHovered = true;
        if (hoverRenew) {
          remainingTime = totalDuration;
          timerBar.style.transform = 'scaleX(1)';
        }
        toast.style.opacity = '1';
      });

      toast.addEventListener('mouseleave', () => {
        isHovered = false;
        lastTick = Date.now();
      });

      const tick = () => {
        if (!toast.parentNode) {
          if (frameId) cancelAnimationFrame(frameId);
          return;
        }

        if (isHovered) {
          lastTick = Date.now();
          frameId = requestAnimationFrame(tick);
          return;
        }

        const now = Date.now();
        const delta = now - lastTick;
        lastTick = now;

        remainingTime -= delta;
        if (remainingTime <= 0) {
          if (frameId) cancelAnimationFrame(frameId);
          toast.remove();
        } else {
          const ratio = Math.max(0, remainingTime / totalDuration);
          timerBar.style.transform = `scaleX(${ratio})`;
          toast.style.opacity = `${ratio}`;
          frameId = requestAnimationFrame(tick);
        }
      };

      frameId = requestAnimationFrame(tick);
    }
  }

  static hide(id) {
    const toast = document.getElementById(id);
    if (toast) {
      toast.style.animation = 'toast-out 0.2s ease forwards';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 200);
    }
  }
}

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

// Sidebar Navigation
const navButtons = document.querySelectorAll('.sidebar-btn[data-page]');
const pages = document.querySelectorAll('.page');

navButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetPageId = btn.getAttribute('data-page');
    const currentPage = document.querySelector('.page.active');
    if (currentPage && currentPage.id === `page-${targetPageId}`) return;

    // Stop microphone test when navigating away
    if (typeof stopMicTest === 'function') {
      stopMicTest();
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
        checkActiveEngineAvailability();
        updateDashboardActiveEngineCard();
      }
      if (targetPageId === 'about') {
        console.log('[Navigation] Navigating to about section. Fetching changelog...');
        loadChangelog();
      }
      if (targetPageId === 'downloads') {
        console.log('[Navigation] Navigating to downloads section.');
        if (window.pendingModelHighlight) {
          const { engineId, modelId } = window.pendingModelHighlight;
          console.log('[Navigation] Found pending model highlight:', engineId, modelId);
          if (quickEngineSelect) {
            quickEngineSelect.value = engineId;
          }
          if (quickLangSelect) {
            let lang = (activeConfig && activeConfig.general && activeConfig.general.language) || 'pl';
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
        updateQuickModelOptions();
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
    if (typeof stopMicTest === 'function') {
      stopMicTest();
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

// App State Cache
let activeConfig = null;
let pendingConfig = null;
let currentStatus = 'idle';
let triggerWords = [];
let stopWords = [];
let partialElement = null;
let dictationCount = 0;
let wordCount = 0;
let isGlobalDownloading = false;
const downloadQueue = [];

// Debouncer helper for range sliders
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Save active config state to backend
async function saveConfigState() {
  if (!activeConfig) return;
  if (window.__TAURI__) {
    try {
      await window.__TAURI__.core.invoke('save_config', { config: activeConfig });
    } catch (err) {
      ToastManager.show({ type: 'error', title: t('toast.save_config_failed'), message: err.toString() });
    }
  }
}

const debouncedSaveConfig = debounce(saveConfigState, 500);

// Populate audio device select
async function populateAudioDevices() {
  const select = document.getElementById('settings-audio-device');
  if (!select) return;

  if (window.__TAURI__) {
    try {
      const devices = await window.__TAURI__.core.invoke('list_audio_devices');
      select.innerHTML = '';
      
      // Prepend Default Device option
      const defaultOpt = document.createElement('option');
      defaultOpt.value = 'default';
      defaultOpt.textContent = t('settings.mic.default') || 'Default Device';
      select.appendChild(defaultOpt);

      devices.forEach(device => {
        const opt = document.createElement('option');
        opt.value = device.id;
        opt.textContent = device.name;
        select.appendChild(opt);
      });
      
      if (activeConfig && activeConfig.audio) {
        const targetVal = activeConfig.audio.input_device || 'default';
        select.value = targetVal;
      } else {
        select.value = 'default';
      }
    } catch (err) {
      console.error('Failed to query audio devices:', err);
    }
  } else {
    // Mock
    select.innerHTML = '<option value="default">Default Input Device</option><option value="mic-1">External Microphone</option>';
  }
}

// Microphone Test Logic
const micTestState = {
  isActive: false,
  stream: null,
  audioCtx: null,
  analyser: null,
  source: null,
  gainNode: null,
  animationId: null
};

async function startMicTest() {
  console.log('[MicTest] Starting microphone test...');
  try {
    const micSelect = document.getElementById('settings-audio-device');
    const selectedDeviceName = micSelect ? micSelect.value : 'default';
    
    let constraints = { audio: true };
    
    if (selectedDeviceName && selectedDeviceName !== 'default') {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioDevices = devices.filter(d => d.kind === 'audioinput');
        const matched = audioDevices.find(d => d.label === selectedDeviceName || d.deviceId === selectedDeviceName);
        if (matched) {
          constraints = {
            audio: { deviceId: { exact: matched.deviceId } }
          };
        } else {
          console.warn(`[MicTest] Device '${selectedDeviceName}' not found in enumerateDevices labels.`);
        }
      } catch (err) {
        console.error('[MicTest] Error enumerating devices:', err);
      }
    }
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    micTestState.stream = stream;
    micTestState.isActive = true;
    
    // Create AudioContext
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    micTestState.audioCtx = new AudioContextClass();
    
    micTestState.source = micTestState.audioCtx.createMediaStreamSource(stream);
    
    micTestState.analyser = micTestState.audioCtx.createAnalyser();
    micTestState.analyser.fftSize = 256;
    micTestState.source.connect(micTestState.analyser);
    
    micTestState.gainNode = micTestState.audioCtx.createGain();
    
    const loopbackCheck = document.getElementById('settings-mic-test-loopback');
    const loopbackChecked = loopbackCheck ? loopbackCheck.checked : true;
    micTestState.gainNode.gain.value = loopbackChecked ? 1.0 : 0.0;
    
    micTestState.source.connect(micTestState.gainNode);
    micTestState.gainNode.connect(micTestState.audioCtx.destination);
    
    // Start animation frame loop for level indicator
    const bufferLength = micTestState.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    function updateVolume() {
      if (!micTestState.isActive) return;
      
      micTestState.analyser.getByteTimeDomainData(dataArray);
      
      let sumSquares = 0.0;
      for (let i = 0; i < bufferLength; i++) {
        const norm = (dataArray[i] - 128) / 128;
        sumSquares += norm * norm;
      }
      const rms = Math.sqrt(sumSquares / bufferLength);
      
      // Scale RMS dynamically to 0-100% representation
      const level = Math.min(Math.round(rms * 500), 100);
      
      const fillEl = document.getElementById('mic-level-bar-fill');
      const valEl = document.getElementById('mic-test-level-val');
      if (fillEl) fillEl.style.width = `${level}%`;
      if (valEl) valEl.textContent = `${level}%`;
      
      micTestState.animationId = requestAnimationFrame(updateVolume);
    }
    
    micTestState.animationId = requestAnimationFrame(updateVolume);
    
    // Update UI state
    const btn = document.getElementById('btn-toggle-mic-test');
    if (btn) {
      btn.classList.add('active');
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>
        <span data-i18n="settings.mic_test.stop">Zatrzymaj test</span>
      `;
      updateDOMTranslations();
    }
    
    const details = document.getElementById('mic-test-details');
    if (details) details.style.display = 'flex';
    
    console.log('[MicTest] Microphone test started successfully.');
  } catch (err) {
    console.error('[MicTest] Failed to start microphone test:', err);
    ToastManager.show({
      type: 'error',
      title: t('toast.mic_test_failed') || 'Failed to access microphone',
      message: err.toString()
    });
    stopMicTest();
  }
}

function stopMicTest() {
  console.log('[MicTest] Stopping microphone test...');
  micTestState.isActive = false;
  
  if (micTestState.animationId) {
    cancelAnimationFrame(micTestState.animationId);
    micTestState.animationId = null;
  }
  
  if (micTestState.stream) {
    micTestState.stream.getTracks().forEach(track => track.stop());
    micTestState.stream = null;
  }
  
  if (micTestState.audioCtx) {
    if (micTestState.audioCtx.state !== 'closed') {
      micTestState.audioCtx.close().catch(err => console.error('[MicTest] Error closing AudioContext:', err));
    }
    micTestState.audioCtx = null;
  }
  
  micTestState.source = null;
  micTestState.analyser = null;
  micTestState.gainNode = null;
  
  // Reset UI
  const fillEl = document.getElementById('mic-level-bar-fill');
  const valEl = document.getElementById('mic-test-level-val');
  if (fillEl) fillEl.style.width = '0%';
  if (valEl) valEl.textContent = '0%';
  
  // Toggle button state and text
  const btn = document.getElementById('btn-toggle-mic-test');
  if (btn) {
    btn.classList.remove('active');
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play"><polygon points="6 3 20 12 6 21 6 3"/></svg>
      <span data-i18n="settings.mic_test.start">Testuj mikrofon</span>
    `;
    updateDOMTranslations();
  }
  
  const details = document.getElementById('mic-test-details');
  if (details) details.style.display = 'none';
}

async function toggleMicTest() {
  if (micTestState.isActive) {
    stopMicTest();
  } else {
    await startMicTest();
  }
}

// Render trigger chips
const translationCache = {
  "czarny_en": "black",
  "czarny_de": "schwarz",
  "komputer_en": "computer",
  "komputer_pl": "komputer",
  "zaczynamy_en": "start",
  "zaczynamy_de": "starten",
  "stop_en": "stop"
};

async function resolveDynamicTranslation(word, targetLang) {
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

function renderTriggerWords(words) {
  triggerWords = words || [];
  const dashboardContainer = document.getElementById('trigger-chips-container');
  const settingsContainer = document.getElementById('settings-trigger-chips');
  
  const drawChips = async (container) => {
    if (!container) return;
    container.innerHTML = '';
    
    if (triggerWords.length === 0) {
      container.innerHTML = `<div style="color: var(--text-muted); font-size: 13px; font-style: italic;">${t('dash.no_triggers')}</div>`;
      return;
    }

    const lang = (pendingConfig && pendingConfig.general && pendingConfig.general.language) ? pendingConfig.general.language : 'pl';
    const shouldTranslate = pendingConfig && pendingConfig.trigger && pendingConfig.trigger.translate;

    for (const word of triggerWords) {
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
        const updatedList = triggerWords.filter(w => w !== wordToRemove);
        
        triggerWords = updatedList;
        if (activeConfig && activeConfig.trigger) {
          activeConfig.trigger.words = updatedList;
        }
        if (pendingConfig && pendingConfig.trigger) {
          pendingConfig.trigger.words = updatedList;
        }

        renderTriggerWords(updatedList);
        
        if (window.__TAURI__) {
          try {
            await window.__TAURI__.core.invoke('set_trigger_words', { words: updatedList });
            console.log('[TRIGGER_UI] Updated trigger words on backend:', updatedList);
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

// Render stop words chips
function renderStopWords(words) {
  stopWords = words || [];
  const settingsContainer = document.getElementById('settings-stop-chips');
  if (!settingsContainer) return;

  settingsContainer.innerHTML = '';
  
  if (stopWords.length === 0) {
    settingsContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 13px; font-style: italic;">${t('settings.no_stops')}</div>`;
    return;
  }

  stopWords.forEach(word => {
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
      const updatedList = stopWords.filter(w => w !== wordToRemove);
      
      stopWords = updatedList;
      if (activeConfig && activeConfig.dictation) {
        activeConfig.dictation.stop_words = updatedList;
      }
      if (pendingConfig && pendingConfig.dictation) {
        pendingConfig.dictation.stop_words = updatedList;
      }

      renderStopWords(updatedList);
      
      if (window.__TAURI__) {
        try {
          await window.__TAURI__.core.invoke('set_stop_words', { words: updatedList });
          console.log('[STOP_WORDS_UI] Updated stop words on backend:', updatedList);
          ToastManager.show({ type: 'success', title: t('toast.stop_updated') });
        } catch (err) {
          console.error('[STOP_WORDS_UI_ERROR] Failed to update stop words on backend:', err);
          ToastManager.show({ type: 'error', title: t('toast.update_failed'), message: err.toString() });
        }
      }
    });
  });
}

// Add triggers & stops
const triggerInputDashboard = document.getElementById('trigger-input');
const triggerAddBtnDashboard = document.getElementById('trigger-add-btn');
const triggerInputSettings = document.getElementById('settings-trigger-input');
const triggerAddBtnSettings = document.getElementById('settings-trigger-add-btn');

async function handleAddTrigger(inputEl) {
  if (!inputEl) return;
  const newWord = inputEl.value.trim().toLowerCase();
  if (!newWord) return;

  console.log('[TRIGGER_UI] Adding new trigger word:', newWord);

  if (triggerWords.includes(newWord)) {
    console.log('[TRIGGER_UI] Word already registered:', newWord);
    ToastManager.show({ type: 'info', title: t('toast.word_registered') });
    return;
  }

  const updatedList = [...triggerWords, newWord];
  triggerWords = updatedList;
  if (activeConfig && activeConfig.trigger) {
    activeConfig.trigger.words = updatedList;
  }
  if (pendingConfig && pendingConfig.trigger) {
    pendingConfig.trigger.words = updatedList;
  }

  renderTriggerWords(updatedList);
  inputEl.value = '';

  if (window.__TAURI__) {
    try {
      await window.__TAURI__.core.invoke('set_trigger_words', { words: updatedList });
      console.log('[TRIGGER_UI] Successfully saved new trigger words list to backend:', updatedList);
      ToastManager.show({ type: 'success', title: t('toast.trigger_added') });
    } catch (err) {
      console.error('[TRIGGER_UI_ERROR] Failed to set trigger words on backend:', err);
      ToastManager.show({ type: 'error', title: t('toast.add_failed'), message: err.toString() });
    }
  }
}

if (triggerAddBtnDashboard) triggerAddBtnDashboard.addEventListener('click', () => handleAddTrigger(triggerInputDashboard));
if (triggerInputDashboard) triggerInputDashboard.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAddTrigger(triggerInputDashboard); });
if (triggerAddBtnSettings) triggerAddBtnSettings.addEventListener('click', () => handleAddTrigger(triggerInputSettings));
if (triggerInputSettings) triggerInputSettings.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAddTrigger(triggerInputSettings); });

const stopInput = document.getElementById('settings-stop-input');
const stopAddBtn = document.getElementById('settings-stop-add-btn');

async function handleAddStop() {
  if (!stopInput) return;
  const newWord = stopInput.value.trim().toLowerCase();
  if (!newWord) return;

  if (stopWords.includes(newWord)) {
    ToastManager.show({ type: 'info', title: t('toast.word_registered') });
    return;
  }

  const updatedList = [...stopWords, newWord];
  stopWords = updatedList;
  if (activeConfig && activeConfig.dictation) {
    activeConfig.dictation.stop_words = updatedList;
  }
  if (pendingConfig && pendingConfig.dictation) {
    pendingConfig.dictation.stop_words = updatedList;
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

if (stopAddBtn) stopAddBtn.addEventListener('click', handleAddStop);
if (stopInput) stopInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAddStop(); });

let pendingCloudWarningEngineId = null;

function getLiveTypingForEngine(engineId) {
  const dict = (pendingConfig && pendingConfig.dictation) ? pendingConfig.dictation : (activeConfig && activeConfig.dictation ? activeConfig.dictation : null);
  if (!dict) return false;
  if (!dict.engine_live_typing) {
    dict.engine_live_typing = {};
  }
  if (typeof dict.engine_live_typing[engineId] === 'boolean') {
    return dict.engine_live_typing[engineId];
  }
  return false;
}

function setLiveTypingForEngine(engineId, enabled) {
  if (pendingConfig && pendingConfig.dictation) {
    if (!pendingConfig.dictation.engine_live_typing) {
      pendingConfig.dictation.engine_live_typing = {};
    }
    pendingConfig.dictation.engine_live_typing[engineId] = enabled;
    if (pendingConfig.engine && pendingConfig.engine.type === engineId) {
      pendingConfig.dictation.live_typing = enabled;
    }
  }

  if (activeConfig && activeConfig.dictation) {
    if (!activeConfig.dictation.engine_live_typing) {
      activeConfig.dictation.engine_live_typing = {};
    }
    activeConfig.dictation.engine_live_typing[engineId] = enabled;
    if (activeConfig.engine && activeConfig.engine.type === engineId) {
      activeConfig.dictation.live_typing = enabled;
    }
  }
}

function showCloudLiveTypingWarningModal(engineId) {
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

function hideCloudLiveTypingWarningModal() {
  pendingCloudWarningEngineId = null;
  const modal = document.getElementById('cloud-live-typing-warning-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function initCloudLiveTypingWarningModalListeners() {
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

// Helper to update toast row state in settings UI
function updateToastRowUI(type, closeMode) {
  const durationInput = document.getElementById(`toast-duration-${type}`);
  const durationVal = document.getElementById(`toast-duration-val-${type}`);
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

// Load Configuration into General settings UI elements
function loadConfigGeneralUI(config) {
  // Trigger config
  document.getElementById('settings-trigger-fuzzy').checked = config.trigger.fuzzy_match;
  document.getElementById('settings-trigger-translate').checked = config.trigger.translate || false;
  
  // Stop config
  document.getElementById('settings-silence-timeout').value = config.dictation.silence_timeout_ms;
  document.getElementById('silence-timeout-val').textContent = `${config.dictation.silence_timeout_ms} ms`;
  document.getElementById('settings-stop-word-remove').checked = config.dictation.stop_word_remove_from_text;
  
  // Behavior config
  document.getElementById('settings-autostart').checked = config.general.autostart;
  document.getElementById('settings-clipboard-fallback').checked = config.input ? config.input.clipboard_fallback : true;
  document.getElementById('settings-clipboard-toast').checked = config.input ? config.input.clipboard_toast : true;
  const autoEnterCheck = document.getElementById('settings-auto-enter');
  if (autoEnterCheck) {
    autoEnterCheck.checked = config.input ? !!config.input.auto_enter : false;
  }
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
    const currentEngine = (pendingConfig && pendingConfig.engine && pendingConfig.engine.type) || (config && config.engine && config.engine.type) || 'vosk';
    liveTypingCheck.checked = getLiveTypingForEngine(currentEngine);
    liveTypingCheck.onchange = (e) => {
      const activeEngineId = (pendingConfig && pendingConfig.engine && pendingConfig.engine.type) || (activeConfig && activeConfig.engine && activeConfig.engine.type) || 'vosk';
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
    
    liveTypingIntervalSlider.oninput = (e) => {
      const val = parseInt(e.target.value, 10);
      document.getElementById('live-typing-interval-val').textContent = `${val} ms`;
      if (activeConfig && activeConfig.dictation) {
        activeConfig.dictation.live_typing_interval_ms = val;
      }
      if (pendingConfig && pendingConfig.dictation) {
        pendingConfig.dictation.live_typing_interval_ms = val;
      }
      debouncedSaveConfig();
    };
  }

  // Bind change listeners to trigger immediate save config
  document.getElementById('settings-trigger-fuzzy').onchange = (e) => {
    activeConfig.trigger.fuzzy_match = e.target.checked;
    if (pendingConfig) pendingConfig.trigger.fuzzy_match = e.target.checked;
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
          activeConfig.trigger.translate = true;
          if (pendingConfig) pendingConfig.trigger.translate = true;
          saveConfigState();
          renderTriggerWords(activeConfig.trigger.words);
        });
        return;
      }
    }
    activeConfig.trigger.translate = isChecked;
    if (pendingConfig) pendingConfig.trigger.translate = isChecked;
    saveConfigState();
    renderTriggerWords(activeConfig.trigger.words);
  };

  document.getElementById('settings-stop-word-remove').onchange = (e) => {
    activeConfig.dictation.stop_word_remove_from_text = e.target.checked;
    if (pendingConfig) pendingConfig.dictation.stop_word_remove_from_text = e.target.checked;
    saveConfigState();
  };

  document.getElementById('settings-autostart').onchange = (e) => {
    activeConfig.general.autostart = e.target.checked;
    if (pendingConfig) pendingConfig.general.autostart = e.target.checked;
    saveConfigState();
  };

  document.getElementById('settings-clipboard-fallback').onchange = (e) => {
    activeConfig.input.clipboard_fallback = e.target.checked;
    if (pendingConfig) pendingConfig.input.clipboard_fallback = e.target.checked;
    saveConfigState();
  };

  document.getElementById('settings-clipboard-toast').onchange = (e) => {
    activeConfig.input.clipboard_toast = e.target.checked;
    if (pendingConfig) pendingConfig.input.clipboard_toast = e.target.checked;
    saveConfigState();
  };

  const autoEnterCheckEl = document.getElementById('settings-auto-enter');
  if (autoEnterCheckEl) {
    autoEnterCheckEl.onchange = (e) => {
      if (activeConfig && activeConfig.input) {
        activeConfig.input.auto_enter = e.target.checked;
      }
      if (pendingConfig && pendingConfig.input) {
        pendingConfig.input.auto_enter = e.target.checked;
      }
      saveConfigState();
    };
  }

  const toastTypes = ['success', 'info', 'error'];
  toastTypes.forEach(tType => {
    const toastConfigKey = 'toast_' + tType;

    // Mode Selector change
    const modeSel = document.getElementById(`toast-mode-${tType}`);
    if (modeSel) {
      modeSel.onchange = (e) => {
        const val = e.target.value;
        if (activeConfig && activeConfig.ui && activeConfig.ui[toastConfigKey]) {
          activeConfig.ui[toastConfigKey].close_mode = val;
        }
        if (pendingConfig && pendingConfig.ui && pendingConfig.ui[toastConfigKey]) {
          pendingConfig.ui[toastConfigKey].close_mode = val;
        }
        updateToastRowUI(tType, val);
        saveConfigState();
      };
    }

    // Duration Slider input
    const durInput = document.getElementById(`toast-duration-${tType}`);
    const durVal = document.getElementById(`toast-duration-val-${tType}`);
    if (durInput) {
      durInput.oninput = (e) => {
        const valSeconds = parseFloat(e.target.value);
        if (durVal) durVal.textContent = `${valSeconds.toFixed(1)}s`;
        
        const valMs = Math.round(valSeconds * 1000);
        if (activeConfig && activeConfig.ui && activeConfig.ui[toastConfigKey]) {
          activeConfig.ui[toastConfigKey].duration_ms = valMs;
        }
        if (pendingConfig && pendingConfig.ui && pendingConfig.ui[toastConfigKey]) {
          pendingConfig.ui[toastConfigKey].duration_ms = valMs;
        }
        debouncedSaveConfig();
      };
    }

    // Hover Renew change
    const hoverCheck = document.getElementById(`toast-hover-${tType}`);
    if (hoverCheck) {
      hoverCheck.onchange = (e) => {
        const isChecked = e.target.checked;
        if (activeConfig && activeConfig.ui && activeConfig.ui[toastConfigKey]) {
          activeConfig.ui[toastConfigKey].hover_renew = isChecked;
        }
        if (pendingConfig && pendingConfig.ui && pendingConfig.ui[toastConfigKey]) {
          pendingConfig.ui[toastConfigKey].hover_renew = isChecked;
        }
        saveConfigState();
      };
    }
  });

  // Bind sliders
  document.getElementById('settings-silence-timeout').oninput = (e) => {
    const val = e.target.value;
    document.getElementById('silence-timeout-val').textContent = `${val} ms`;
    activeConfig.dictation.silence_timeout_ms = parseInt(val, 10);
    if (pendingConfig) pendingConfig.dictation.silence_timeout_ms = parseInt(val, 10);
    debouncedSaveConfig();
  };

  document.getElementById('settings-start-delay').oninput = (e) => {
    const val = e.target.value;
    document.getElementById('start-delay-val').textContent = `${val} ms`;
    activeConfig.dictation.start_delay_ms = parseInt(val, 10);
    if (pendingConfig) pendingConfig.dictation.start_delay_ms = parseInt(val, 10);
    debouncedSaveConfig();
  };

  // Bind microphone
  document.getElementById('settings-audio-device').onchange = async (e) => {
    const devId = e.target.value;
    activeConfig.audio.input_device = devId;
    if (pendingConfig) pendingConfig.audio.input_device = devId;
    if (window.__TAURI__) {
      try {
        await window.__TAURI__.core.invoke('set_audio_device', { deviceId: devId });
        ToastManager.show({ type: 'success', title: t('toast.mic_updated') });
      } catch (err) {
        ToastManager.show({ type: 'error', title: t('toast.mic_update_failed'), message: err.toString() });
      }
    }
    
    // If mic test is currently active, restart it with the new device
    if (micTestState.isActive) {
      console.log('[MicTest] Microphone changed while testing. Restarting test...');
      stopMicTest();
      await startMicTest();
    }
  };

  // Bind microphone test controls
  const btnToggleMic = document.getElementById('btn-toggle-mic-test');
  if (btnToggleMic) {
    btnToggleMic.onclick = async (e) => {
      e.preventDefault();
      try {
        await toggleMicTest();
      } catch (err) {
        console.error('[MicTest] Error toggling mic test:', err);
      }
    };
  }

  const loopbackCheck = document.getElementById('settings-mic-test-loopback');
  if (loopbackCheck) {
    loopbackCheck.onchange = (e) => {
      if (micTestState.gainNode) {
        micTestState.gainNode.gain.value = e.target.checked ? 1.0 : 0.0;
      }
    };
  }

  // Bind engine language selector
  const langSelect = document.getElementById('settings-engine-language');
  if (langSelect && config.general) {
    langSelect.value = config.general.language;
    langSelect.onchange = async (e) => {
      pendingConfig.general.language = e.target.value;
      
      // Refresh available models list when language changes in pending config
      if (pendingConfig && pendingConfig.engine) {
        renderAvailableModels(pendingConfig.engine.type);
      }
      
      // Update trigger chips preview immediately
      renderTriggerWords(pendingConfig.trigger.words);
      
      checkEngineDirty();
    };
  }

  // Bind App Language selector
  const appLangSelect = document.getElementById('settings-app-language');
  if (appLangSelect && config.general) {
    appLangSelect.value = config.general.language || (navigator.language.startsWith('pl') ? 'pl' : 'en');
    appLangSelect.onchange = (e) => {
      const newLang = e.target.value;
      activeConfig.general.language = newLang;
      if (pendingConfig) pendingConfig.general.language = newLang;
      setLanguage(newLang);
      saveConfigState();
    };
  }

  loadConfigAppearanceUI(config);
}

function updateEngineCardsUI(engineId) {
  const targetId = engineId || (pendingConfig && pendingConfig.engine && pendingConfig.engine.type) || (activeConfig && activeConfig.engine && activeConfig.engine.type);
  if (!targetId) return;

  document.querySelectorAll('.engine-card').forEach(c => {
    c.classList.remove('active');
    const badge = c.querySelector('.engine-card-badge');
    if (badge) {
      badge.classList.remove('active');
      badge.textContent = typeof t === 'function' ? t('engines.badge.select') : 'Select';
    }
  });

  const activeCard = document.querySelector(`.engine-card[data-engine-id="${targetId}"]`);
  if (activeCard) {
    activeCard.classList.add('active');
    const badge = activeCard.querySelector('.engine-card-badge');
    if (badge) {
      badge.classList.add('active');
      badge.textContent = typeof t === 'function' ? t('engines.badge.active') : 'Active';
    }
  }
}

// Engine Selection & dynamic panels
const engineCards = document.querySelectorAll('.engine-card');

engineCards.forEach(card => {
  card.addEventListener('click', async () => {
    const engineId = card.getAttribute('data-engine-id');
    
    // Check python dependency (only for faster_whisper, native whisper doesn't need python)
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

    if (pendingConfig && pendingConfig.engine) {
      pendingConfig.engine.type = engineId;
    }

    // Refresh configurations panel using pending config
    updateActiveEnginePanel(engineId);
    checkEngineDirty();
  });
});

function updateActiveEnginePanel(engineId) {
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
  
  // Toggle Live Typing container and warning badge visibility
  const liveTypingWarning = document.getElementById('engine-live-typing-warning');
  const liveTypingIntervalContainer = document.getElementById('engine-live-typing-interval-container');
  const liveTypingCheck = document.getElementById('settings-live-typing');
  const streamingSupportedEngines = ['vosk', 'deepgram', 'assemblyai', 'azure'];

  if (liveTypingCheck) {
    const engineLiveTyping = getLiveTypingForEngine(engineId);
    liveTypingCheck.checked = engineLiveTyping;
    if (pendingConfig && pendingConfig.dictation) {
      pendingConfig.dictation.live_typing = engineLiveTyping;
    }
    if (activeConfig && activeConfig.dictation) {
      activeConfig.dictation.live_typing = engineLiveTyping;
    }
  }

  if (liveTypingContainer) {
    liveTypingContainer.style.display = 'block';
  }
  if (liveTypingWarning) {
    if (!streamingSupportedEngines.includes(engineId)) {
      liveTypingWarning.style.display = 'flex';
    } else {
      liveTypingWarning.style.display = 'none';
    }
  }
  if (liveTypingIntervalContainer) {
    if (!streamingSupportedEngines.includes(engineId)) {
      liveTypingIntervalContainer.style.display = 'block';
    } else {
      liveTypingIntervalContainer.style.display = 'none';
    }
  }

  // Reset fields display
  if (voskFields) voskFields.style.display = 'none';
  if (apiFields) apiFields.style.display = 'none';
  if (whisperFields) whisperFields.style.display = 'none';
  if (sherpaFields) sherpaFields.style.display = 'none';
  if (progressContainer) progressContainer.style.display = 'none';

  // Capitalize name
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

  // Dashboard active display
  updateDashboardActiveEngineCard();

  if (['vosk', 'whisper', 'faster_whisper', 'sherpa_onnx'].includes(engineId)) {
    let fields = whisperFields;
    if (engineId === 'vosk') fields = voskFields;
    if (engineId === 'sherpa_onnx') fields = sherpaFields;
    if (fields) fields.style.display = 'block';
    
    // Load and render the list of available models
    renderAvailableModels(engineId === 'faster_whisper' ? 'whisper' : engineId);
    
    // If it's Whisper or Faster-Whisper, handle GPU checkboxes
    if (engineId === 'whisper' || engineId === 'faster_whisper') {
      const gpuContainer = document.getElementById('whisper-gpu-container');
      const gpuCheck = document.getElementById('whisper-use-gpu');
      
      if (engineId === 'whisper') {
        if (gpuContainer) gpuContainer.style.display = 'none';
      } else {
        if (gpuContainer) gpuContainer.style.display = 'block';
      }
      
      if (pendingConfig && pendingConfig.engine && pendingConfig.engine.whisper) {
        gpuCheck.checked = pendingConfig.engine.whisper.use_gpu;
      }

      const updateGpuCheckboxUI = async () => {
        try {
          console.log("[GPU] Checking hardware GPU support...");
          const isGpuSupported = await window.__TAURI__.core.invoke('check_gpu_support');
          console.log(`[GPU] Hardware GPU support: ${isGpuSupported}`);
          
          if (!isGpuSupported) {
            gpuCheck.disabled = true;
            gpuCheck.checked = false;
            pendingConfig.engine.whisper.use_gpu = false;
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
              if (!isCudaInstalled || !isGpuSupported) {
                gpuWarningText.style.display = 'flex';
              } else {
                gpuWarningText.style.display = 'none';
              }
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
        console.log(`[GPU Log] Checkbox click event triggered. New visual checked status: ${checked}`);
        
        try {
          if (checked) {
            console.log("[GPU Log] User clicked to ENABLE GPU.");
            if (engineId === 'whisper') {
              console.log("[GPU Log] Engine is Whisper.cpp (CPU only on this system). Setting use_gpu to true and showing warning toast.");
              pendingConfig.engine.whisper.use_gpu = true;
              checkEngineDirty();
              ToastManager.show({
                type: 'warning',
                title: t('toast.whisper_gpu_unavailable_title'),
                message: t('toast.whisper_gpu_unavailable_msg'),
                duration: 8000
              });
            } else {
              console.log("[GPU Log] Engine is Faster-Whisper. Invoking check_cuda_installed...");
              const isCudaInstalled = await window.__TAURI__.core.invoke('check_cuda_installed');
              console.log(`[GPU Log] check_cuda_installed returned: ${isCudaInstalled}`);
              
              if (isCudaInstalled) {
                console.log("[GPU Log] CUDA is already fully installed. Enabling GPU directly and updating UI.");
                pendingConfig.engine.whisper.use_gpu = true;
                checkEngineDirty();
                await updateGpuCheckboxUI();
              } else {
                console.log("[GPU Log] CUDA is NOT installed. Visual checkbox reset to false. Showing showCudaInstallModal.");
                gpuCheck.checked = false;
                showCudaInstallModal(gpuCheck);
              }
            }
          } else {
            console.log("[GPU Log] User clicked to DISABLE GPU.");
            console.log("[GPU Log] Invoking check_cuda_installed to determine if we should warn about package deletion...");
            const isCudaInstalled = await window.__TAURI__.core.invoke('check_cuda_installed');
            console.log(`[GPU Log] check_cuda_installed returned: ${isCudaInstalled}`);
            
            if (isCudaInstalled) {
              console.log("[GPU Log] CUDA is installed. Reverting checkbox visually to checked, showing warning confirm modal.");
              gpuCheck.checked = true;
              
              showCustomConfirmModal({
                title: t('addons.cuda.uninstall_warning_title'),
                message: t('addons.cuda.uninstall_warning_msg'),
                confirmText: t('addons.cuda.uninstall_confirm_btn'),
                cancelText: t('btn.cancel'),
                isDanger: true,
                onConfirm: async () => {
                  console.log("[GPU Log] User confirmed uninstallation in modal. Launching showCudaUninstallProgress.");
                  try {
                    showCudaUninstallProgress(gpuCheck);
                  } catch (err) {
                    console.error("[GPU Log] Exception starting CUDA uninstall:", err);
                    ToastManager.show({ type: 'error', title: t('toast.cuda_uninstall_error'), message: err.toString() });
                    throw err;
                  }
                },
                onCancel: () => {
                  console.log("[GPU Log] User cancelled uninstallation. Reverting checkbox visually to checked.");
                  gpuCheck.checked = true;
                }
              });
            } else {
              console.log("[GPU Log] CUDA is NOT installed anyway. Disabling GPU directly and updating UI.");
              pendingConfig.engine.whisper.use_gpu = false;
              checkEngineDirty();
              await updateGpuCheckboxUI();
            }
          }
        } catch (err) {
          console.error("[GPU Log] Exception in checkbox onchange handler:", err);
          ToastManager.show({ type: 'error', title: t('toast.cuda_uninstall_error'), message: err.toString() });
          gpuCheck.checked = !checked;
          throw err;
        }
      };
    }
  } else if (['deepgram', 'assemblyai', 'openai', 'google', 'azure'].includes(engineId)) {
    apiFields.style.display = 'block';
    
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

    if (pendingConfig && pendingConfig.engine) {
      if (engineId === 'deepgram') keyInput.value = pendingConfig.engine.deepgram.api_key || '';
      if (engineId === 'assemblyai') keyInput.value = pendingConfig.engine.assemblyai.api_key || '';
      if (engineId === 'openai') keyInput.value = pendingConfig.engine.openai.api_key || '';
      if (engineId === 'google') keyInput.value = pendingConfig.engine.google.credentials_path || '';
      if (engineId === 'azure') {
        keyInput.value = pendingConfig.engine.azure.subscription_key || '';
        if (azureRegionInput) azureRegionInput.value = pendingConfig.engine.azure.region || 'eastus';
      }
    }

    const handleKeyInput = (e) => {
      const val = e.target.value;
      if (engineId === 'deepgram') pendingConfig.engine.deepgram.api_key = val;
      if (engineId === 'assemblyai') pendingConfig.engine.assemblyai.api_key = val;
      if (engineId === 'openai') pendingConfig.engine.openai.api_key = val;
      if (engineId === 'google') pendingConfig.engine.google.credentials_path = val;
      if (engineId === 'azure') pendingConfig.engine.azure.subscription_key = val;
      checkEngineDirty();
    };

    keyInput.oninput = handleKeyInput;
    keyInput.onchange = handleKeyInput;

    if (azureRegionInput) {
      const handleRegionInput = (e) => {
        if (engineId === 'azure') pendingConfig.engine.azure.region = e.target.value;
        checkEngineDirty();
      };
      azureRegionInput.oninput = handleRegionInput;
      azureRegionInput.onchange = handleRegionInput;
    }
  }
  checkActiveEngineAvailability();
}

async function updateDashboardActiveEngineCard() {
  if (!activeConfig || !activeConfig.engine) return;
  const engineId = activeConfig.engine.type;

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

  // Dashboard active display
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
    console.log('[Dashboard] Checking GPU/CUDA warning state for engine:', engineId);
    if (engineId === 'faster_whisper') {
      try {
        if (window.__TAURI__) {
          const isGpuSupported = await window.__TAURI__.core.invoke('check_gpu_support');
          const isCudaInstalled = await window.__TAURI__.core.invoke('check_cuda_installed');
          console.log(`[Dashboard] GPU supported: ${isGpuSupported}, CUDA installed: ${isCudaInstalled}`);
          if (isGpuSupported && !isCudaInstalled) {
            gpuWarningEl.style.display = 'inline-flex';
            gpuWarningEl.setAttribute('title', t('engines.whisper.gpu_slower_warning'));
          } else {
            gpuWarningEl.style.display = 'none';
          }
        } else {
          // Web mock demo mode
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

  if (langBadge && activeConfig.general) {
    langBadge.textContent = (activeConfig.general.language || 'pl').toUpperCase();
  }

  if (modelShortLabel) {
    if (['vosk', 'sherpa_onnx', 'whisper', 'faster_whisper'].includes(engineId)) {
      let rawModel = '';
      if (engineId === 'vosk') {
        const parts = (activeConfig.engine.vosk.model_path || '').split(/[/\\]/);
        rawModel = parts[parts.length - 1] || 'vosk-model';
      } else if (engineId === 'sherpa_onnx') {
        const parts = (activeConfig.engine.sherpa_onnx.model_path || '').split(/[/\\]/);
        rawModel = parts[parts.length - 1] || 'sherpa-model';
      } else {
        rawModel = activeConfig.engine.whisper.model || 'base';
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

async function checkActiveEngineAvailability() {
  const overlay = document.getElementById('dictation-disabled-overlay');
  const textEl = document.getElementById('dictation-disabled-text');
  const btnGoToDownloads = document.getElementById('btn-overlay-go-to-downloads');
  if (!overlay || !textEl) return;

  const isDownloading = checkIsDownloading();
  if (isDownloading) {
    overlay.style.display = 'flex';
    textEl.textContent = t('dash.overlay.downloading_model');
    if (btnGoToDownloads) btnGoToDownloads.style.display = 'none';
    return;
  }

  if (!activeConfig || !activeConfig.engine) return;
  const engineId = activeConfig.engine.type;

  // Cloud/online engines don't need local models
  if (!['vosk', 'sherpa_onnx', 'whisper', 'faster_whisper'].includes(engineId)) {
    overlay.style.display = 'none';
    return;
  }

  let modelId = '';
  if (engineId === 'vosk') {
    modelId = (activeConfig.engine.vosk.model_path || '').split(/[/\\]/).pop();
  } else if (engineId === 'sherpa_onnx') {
    modelId = (activeConfig.engine.sherpa_onnx.model_path || '').split(/[/\\]/).pop();
  } else {
    modelId = activeConfig.engine.whisper.model;
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
    // Mock environment
    overlay.style.display = 'none';
  }
}

async function renderAvailableModels(engineId) {
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
      
      const lang = pendingConfig ? pendingConfig.general.language : 'pl';
      const models = await window.__TAURI__.core.invoke('get_available_models', { engine: engineId, language: lang });
      radioGroup.innerHTML = '';
      
      if (models.length === 0) {
        radioGroup.innerHTML = `<div style="color: var(--text-muted); font-size: 13px;">${t('engines.no_models_found')}</div>`;
        return;
      }

      // Sprawdzamy aktywny model na podstawie pendingConfig
      let hasActive = false;
      models.forEach(model => {
        if (pendingConfig) {
          if (engineId === 'vosk') {
            model.is_active = pendingConfig.engine.vosk.model_path.includes(model.id);
          } else if (engineId === 'sherpa_onnx') {
            model.is_active = pendingConfig.engine.sherpa_onnx.model_path.includes(model.id);
          } else {
            model.is_active = pendingConfig.engine.whisper.model === model.id;
          }
          if (model.is_active) hasActive = true;
        }
      });

      // If no model is active in the current configuration (e.g. after language change),
      // automatically select the first one from the list and update pendingConfig
      if (!hasActive && models.length > 0) {
        let shouldAutoSelect = false;
        if (pendingConfig && activeConfig) {
          let currentModelId = '';
          if (engineId === 'vosk') {
            currentModelId = (pendingConfig.engine.vosk.model_path || '').split(/[/\\]/).pop();
          } else if (engineId === 'sherpa_onnx') {
            currentModelId = (pendingConfig.engine.sherpa_onnx.model_path || '').split(/[/\\]/).pop();
          } else {
            currentModelId = pendingConfig.engine.whisper.model;
          }
          
          if (!currentModelId || 
              pendingConfig.general.language !== activeConfig.general.language ||
              pendingConfig.engine.type !== activeConfig.engine.type) {
            shouldAutoSelect = true;
          }
        } else {
          shouldAutoSelect = true;
        }

        if (shouldAutoSelect) {
          console.log(`[renderAvailableModels] Auto-selecting first model for engine '${engineId}' (no active model & change detected).`);
          models[0].is_active = true;
          const modelId = models[0].id;
          if (pendingConfig) {
            if (engineId === 'vosk') {
              pendingConfig.engine.vosk.model_path = `models/vosk/${modelId}`;
            } else if (engineId === 'sherpa_onnx') {
              pendingConfig.engine.sherpa_onnx.model_path = `models/sherpa/${modelId}`;
            } else {
              pendingConfig.engine.whisper.model = modelId;
            }
            checkEngineDirty();
          }
        } else {
          console.log(`[renderAvailableModels] Not auto-selecting model for engine '${engineId}' because we are not editing/switching language/engine.`);
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
                pendingConfig.engine.vosk.model_path = `models/${info.dest_filename}`;
              } else if (engineId === 'sherpa_onnx') {
                pendingConfig.engine.sherpa_onnx.model_path = `models/${info.dest_filename}`;
              } else {
                pendingConfig.engine.whisper.model = modelId;
              }
              checkEngineDirty();
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

async function updateModelStatusText(engineId, modelId) {
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

// Download Model binds
const downloadVoskBtn = document.getElementById('btn-download-vosk');
const downloadWhisperBtn = document.getElementById('btn-download-whisper');
const downloadSherpaBtn = document.getElementById('btn-download-sherpa');

if (downloadVoskBtn) downloadVoskBtn.addEventListener('click', () => triggerModelDownload('vosk'));
if (downloadWhisperBtn) downloadWhisperBtn.addEventListener('click', () => triggerModelDownload('whisper'));
if (downloadSherpaBtn) downloadSherpaBtn.addEventListener('click', () => triggerModelDownload('sherpa_onnx'));

const quickEngineSelect = document.getElementById('quick-download-engine');
const quickLangSelect = document.getElementById('quick-download-lang');
const quickModelSelect = document.getElementById('quick-download-model');
const quickModelLoader = document.getElementById('quick-download-model-loader');
const quickDownloadBtn = document.getElementById('quick-download-btn');

function checkIsDownloading() {
  return downloadQueue.some(q => q.status === 'downloading' || q.status === 'queued');
}

async function updateQuickModelOptions() {
  if (!quickEngineSelect || !quickModelSelect) return;
  const eng = quickEngineSelect.value;
  
  // Show loader and disable select/button
  if (quickModelLoader) quickModelLoader.style.display = 'block';
  quickModelSelect.disabled = true;
  if (quickDownloadBtn) quickDownloadBtn.disabled = true;

  // For Whisper/Faster-Whisper, models are multilingual/universal. Disable the language select.
  if (eng === 'whisper' || eng === 'faster_whisper') {
    if (quickLangSelect) {
      quickLangSelect.innerHTML = `<option value="all">${t('downloads.quick.all_langs')}</option>`;
      quickLangSelect.disabled = true;
    }
  } else {
    // Restore languages if disabled
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
      // Default to app language
      if (activeConfig && activeConfig.general) {
        quickLangSelect.value = activeConfig.general.language;
      } else if (pendingConfig && pendingConfig.general) {
        quickLangSelect.value = pendingConfig.general.language;
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
      // Mock options for web development/offline testing
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
          { id: 'base', name: 'Whisper base', size_text: '147 MB', is_downloaded: false },
          { id: 'small', name: 'Whisper small', size_text: '487 MB', is_downloaded: false }
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

      // Handle pending model selection and highlighting
      if (window.pendingModelHighlight) {
        try {
          const { modelId } = window.pendingModelHighlight;
          console.log(`[QuickDownload] Processing pending model highlight. Target model ID: ${modelId}`);
          if (quickModelSelect && modelId) {
            const optionExists = Array.from(quickModelSelect.options).some(opt => opt.value === modelId);
            if (optionExists) {
              quickModelSelect.value = modelId;
              console.log(`[QuickDownload] Selected exact match option: ${modelId}`);
            } else {
              const partialOpt = Array.from(quickModelSelect.options).find(opt => opt.value.includes(modelId) || modelId.includes(opt.value));
              if (partialOpt) {
                quickModelSelect.value = partialOpt.value;
                console.log(`[QuickDownload] Selected partial match option: ${partialOpt.value} for target: ${modelId}`);
              } else {
                console.warn(`[QuickDownload] Target model ID ${modelId} not found in available options.`);
              }
            }
          }

          if (quickDownloadBtn) {
            console.log('[QuickDownload] Adding highlighting pulse class to download button.');
            quickDownloadBtn.classList.add('btn-highlight-pulse');
          }
        } catch (err) {
          console.error('[QuickDownload] Error highlighting target model:', err);
        } finally {
          window.pendingModelHighlight = null;
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

if (quickEngineSelect) {
  quickEngineSelect.addEventListener('change', () => {
    console.log('[QuickDownload] Engine selection changed. Removing highlighting pulse.');
    if (quickDownloadBtn) quickDownloadBtn.classList.remove('btn-highlight-pulse');
    updateQuickModelOptions();
  });
}
if (quickLangSelect) {
  quickLangSelect.addEventListener('change', () => {
    console.log('[QuickDownload] Language selection changed. Removing highlighting pulse.');
    if (quickDownloadBtn) quickDownloadBtn.classList.remove('btn-highlight-pulse');
    updateQuickModelOptions();
  });
}

if (quickDownloadBtn) {
  quickDownloadBtn.addEventListener('click', () => {
    console.log('[QuickDownload] Download button clicked. Removing highlighting pulse.');
    quickDownloadBtn.classList.remove('btn-highlight-pulse');
    const eng = quickEngineSelect ? quickEngineSelect.value : 'vosk';
    const mdl = quickModelSelect ? quickModelSelect.value : '';
    if (mdl) {
      try {
        triggerModelDownloadExplicit(eng, mdl);
      } catch (err) {
        console.error('[QuickDownload] Error triggering model download:', err);
        throw err;
      }
    } else {
      console.warn('[QuickDownload] No model selected for download.');
    }
  });

  quickDownloadBtn.addEventListener('mouseenter', () => {
    if (quickDownloadBtn.classList.contains('btn-highlight-pulse')) {
      console.log('[QuickDownload] Mouse entered download button. Freezing and transitioning pulse smoothly.');
      try {
        // Capture computed styles of current animation frame
        const computedStyle = window.getComputedStyle(quickDownloadBtn);
        const currentTransform = computedStyle.transform;
        const currentBoxShadow = computedStyle.boxShadow;

        // Apply captured states inline and remove animation class immediately (avoids keyframe override)
        quickDownloadBtn.style.transform = currentTransform;
        quickDownloadBtn.style.boxShadow = currentBoxShadow;
        quickDownloadBtn.style.animation = 'none';
        
        quickDownloadBtn.classList.remove('btn-highlight-pulse');

        // Force browser layout reflow to register style changes
        void quickDownloadBtn.offsetHeight;

        // Apply transition and target hover state styles
        quickDownloadBtn.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), box-shadow 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
        quickDownloadBtn.style.transform = 'translateY(-1px) scale(1)';
        quickDownloadBtn.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.25)';

        // Cleanup inline overrides so natural CSS takes over
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
    for (let i = downloadQueue.length - 1; i >= 0; i--) {
      if (downloadQueue[i].status === 'completed' || downloadQueue[i].status === 'cancelled' || downloadQueue[i].status === 'error') {
        downloadQueue.splice(i, 1);
      }
    }
    renderDownloadQueue();
  });
}

function getDownloadMode() {
  const checked = document.querySelector('input[name="download-mode"]:checked');
  return checked ? checked.value : 'sequential';
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('input[name="download-mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      processDownloadQueue();
    });
  });
});

let isProcessingQueue = false;

async function processDownloadQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  try {
    const mode = getDownloadMode();
    const downloadingItems = downloadQueue.filter(q => q.status === 'downloading');
    const queuedItems = downloadQueue.filter(q => q.status === 'queued');

    if (queuedItems.length === 0) return;

    if (mode === 'sequential') {
      if (downloadingItems.length === 0) {
        const nextItem = queuedItems[0];
        await startSingleDownload(nextItem);
      }
    } else {
      // concurrent mode: start all queued items
      for (const item of queuedItems) {
        startSingleDownload(item);
      }
    }
  } finally {
    isProcessingQueue = false;
  }
}

async function startSingleDownload(item) {
  console.log('[DOWNLOAD_START] Starting download for item:', item);
  item.status = 'downloading';
  renderDownloadQueue();
  updateDashboardDownloadState(null);
  updateGlobalProcessingBanner(true, t('downloads.status.downloading'), item.model);

  if (window.__TAURI__) {
    try {
      ToastManager.show({ type: 'info', title: t('toast.download_started'), message: t('toast.download_started_msg', { model: item.model }) });
      const checkEngine = item.engine === 'faster_whisper' ? 'whisper' : item.engine;
      console.log('[DOWNLOAD_START] Calling download_model in Tauri for engine:', checkEngine, 'model:', item.model);
      await window.__TAURI__.core.invoke('download_model', { engine: checkEngine, model: item.model });
      
      console.log('[DOWNLOAD_FINISH] Finished invoking download_model, item status:', item.status);
      if (item.status !== 'cancelled') {
        item.status = 'completed';
        console.log('[DOWNLOAD_FINISH] Marked download as completed:', item.model);
        ToastManager.show({ type: 'success', title: t('toast.download_finished'), message: t('toast.download_finished_msg', { model: item.model }) });
      } else {
        console.log('[DOWNLOAD_FINISH] Download was cancelled in progress, skipping marking as completed.');
      }
    } catch (err) {
      console.error('[DOWNLOAD_ERROR] Error occurred during download:', err, 'current status:', item.status);
      if (item.status !== 'cancelled') {
        item.status = 'error';
        ToastManager.show({ type: 'error', title: t('toast.download_error'), message: err.toString() });
      } else {
        console.log('[DOWNLOAD_ERROR] Error ignored because status is cancelled.');
      }
    } finally {
      const isAnyActiveLeft = downloadQueue.some(q => q.status === 'downloading');
      if (!isAnyActiveLeft) {
        updateGlobalProcessingBanner(false);
      }
      renderDownloadQueue();
      updateDashboardDownloadState(null);
      renderInstalledModelsManager();
      updateQuickModelOptions();
      console.log('[DOWNLOAD_CLEANUP] Download completed or aborted for:', item.model, 'Moving to next item.');
      setTimeout(() => processDownloadQueue(), 300);
    }
  } else {
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

async function triggerModelDownloadExplicit(engineId, modelName) {
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

async function triggerModelDownload(engineId) {
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

function updateDashboardDownloadState(progress) {
  const dashStatus = document.getElementById('dashboard-engine-download-status');
  const dashFill = document.getElementById('dashboard-engine-progress-fill');
  const dashText = document.getElementById('dashboard-engine-progress-text');
  const dashPercent = document.getElementById('dashboard-engine-progress-percent');

  const isDownloading = checkIsDownloading();

  checkActiveEngineAvailability();
  updateDashboardActiveEngineCard();

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

function updateGlobalProcessingBanner(active, message = null, detail = null) {
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

function updateDownloadProgress(progress) {
  const queueItem = downloadQueue.find(q => q.model === progress.model);
  if (queueItem) {
    if (queueItem.status === 'cancelled') {
      return;
    }
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
    const isAnyActiveLeft = downloadQueue.some(q => q.status === 'downloading' && q.model !== progress.model);
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

function removeModelFromDownloadQueue(engine, model) {
  const normalize = (eng) => (eng === 'faster_whisper' ? 'whisper' : eng);
  const targetEngine = normalize(engine);

  for (let i = downloadQueue.length - 1; i >= 0; i--) {
    const item = downloadQueue[i];
    const itemEngine = normalize(item.engine);
    if (model) {
      if (itemEngine === targetEngine && item.model === model) {
        downloadQueue.splice(i, 1);
      }
    } else {
      if (itemEngine === targetEngine) {
        downloadQueue.splice(i, 1);
      }
    }
  }
  renderDownloadQueue();
}

function addModelToDownloadQueue(engine, model) {
  let existing = downloadQueue.find(q => q.engine === engine && q.model === model);
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
    downloadQueue.push(existing);
  }
  updateDashboardDownloadState(null);
  renderDownloadQueue();
  processDownloadQueue();
}

function renderDownloadQueue() {
  const activeContainer = document.getElementById('download-active-container');
  const historyContainer = document.getElementById('download-history-container');
  if (!activeContainer || !historyContainer) return;

  const activeItems = downloadQueue.filter(q => q.status === 'downloading' || q.status === 'queued' || q.status === 'paused');
  const historyItems = downloadQueue.filter(q => q.status === 'completed' || q.status === 'cancelled' || q.status === 'error');

  // Block the ability to change download mode when downloads are active or queued
  const isDownloading = activeItems.length > 0;
  document.querySelectorAll('input[name="download-mode"]').forEach(radio => {
    radio.disabled = isDownloading;
  });

  // Render Active Downloads
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
      console.log('[DOWNLOAD_ACTIVE_CONTAINER] Click detected in active downloads container:', e.target);
      const btn = e.target.closest('.btn-cancel-queue');
      if (!btn) {
        console.log('[DOWNLOAD_ACTIVE_CONTAINER] Click was not on the cancel button.');
        return;
      }
      const id = btn.getAttribute('data-id');
      console.log('[CANCEL_QUEUE] Clicked cancel for download ID:', id);
      const item = downloadQueue.find(q => q.id === id);
      if (item) {
        console.log('[CANCEL_QUEUE] Found item in download queue:', item);
        item.status = 'cancelled';
        item.percent = 0;
        if (window.__TAURI__) {
          const checkEngine = item.engine === 'faster_whisper' ? 'whisper' : item.engine;
          console.log('[CANCEL_QUEUE] Calling cleanup_model_tmp_files for engine:', checkEngine, 'model:', item.model);
          try {
            await window.__TAURI__.core.invoke('cleanup_model_tmp_files', { engine: checkEngine, model: item.model });
            console.log('[CANCEL_QUEUE] Cleanup completed successfully.');
          } catch (err) {
            console.error('[CANCEL_QUEUE] Error during cleanup:', err);
          }
        } else {
          console.log('[CANCEL_QUEUE] No Tauri environment - simulated cleanup.');
        }
        ToastManager.show({ type: 'info', title: t('toast.download_cancelled'), message: t('toast.download_cancelled_msg', { model: item.model }) });
        updateDashboardDownloadState(null);
        renderDownloadQueue();
        setTimeout(() => processDownloadQueue(), 300);
      } else {
        console.warn('[CANCEL_QUEUE] Nie znaleziono elementu o ID:', id, 'w kolejce pobierania:', downloadQueue);
      }
    };
  }

  // Render History Downloads
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

async function renderInstalledModelsManager() {
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
            <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-elevated); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.04);">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 13px; font-weight: 500; color: var(--text-primary);">${m.name}</span>
                <span style="font-size: 11px; color: var(--text-muted); background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px;">${m.size_text}</span>
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
                const activeEngineId = pendingConfig ? pendingConfig.engine.type : 'vosk';
                await renderAvailableModels(activeEngineId);
                await updateDashboardActiveEngineCard();
                await checkActiveEngineAvailability();
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
                const activeEngineId = pendingConfig ? pendingConfig.engine.type : 'vosk';
                await renderAvailableModels(activeEngineId);
                await updateDashboardActiveEngineCard();
                await checkActiveEngineAvailability();
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

function showCustomConfirmModal({ title, message, confirmText, cancelText, isDanger = true, isHazard = false, onConfirm, onCancel }) {
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

function getEngineApiKey(engineType, configEngine) {
  if (!configEngine) return '';
  if (engineType === 'deepgram') return configEngine.deepgram?.api_key || '';
  if (engineType === 'assemblyai') return configEngine.assemblyai?.api_key || '';
  if (engineType === 'openai') return configEngine.openai?.api_key || '';
  if (engineType === 'google') return configEngine.google?.credentials_path || '';
  if (engineType === 'azure') return configEngine.azure?.subscription_key || '';
  return '';
}

function setEngineApiKey(engineType, configEngine, val) {
  if (!configEngine) return;
  if (!configEngine[engineType]) configEngine[engineType] = {};
  if (engineType === 'deepgram') configEngine.deepgram.api_key = val;
  if (engineType === 'assemblyai') configEngine.assemblyai.api_key = val;
  if (engineType === 'openai') configEngine.openai.api_key = val;
  if (engineType === 'google') configEngine.google.credentials_path = val;
  if (engineType === 'azure') configEngine.azure.subscription_key = val;
}

function triggerShakeError(element) {
  if (!element) return;
  element.classList.remove('btn-shake-error');
  void element.offsetWidth;
  element.classList.add('btn-shake-error');
  setTimeout(() => {
    element.classList.remove('btn-shake-error');
  }, 600);
}

function formatEngineErrorMessage(err, fallbackEngineId = '') {
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

function getEngineChangesDescription() {
  if (!pendingConfig || !activeConfig) return '';
  const changes = [];
  if (pendingConfig.engine.type !== activeConfig.engine.type) {
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
    changes.push(`• ${t('desc.change_engine')}: <b>${names[activeConfig.engine.type] || activeConfig.engine.type}</b> ➔ <b>${names[pendingConfig.engine.type] || pendingConfig.engine.type}</b>`);
  }
  if (pendingConfig.general.language !== activeConfig.general.language) {
    changes.push(`• ${t('desc.change_language')}: <b>${activeConfig.general.language}</b> ➔ <b>${pendingConfig.general.language}</b>`);
  }
  if (pendingConfig.engine.vosk.model_path !== activeConfig.engine.vosk.model_path) {
    const mName = pendingConfig.engine.vosk.model_path.split(/[/\\]/).pop();
    changes.push(`• ${t('desc.change_model_vosk')} <b>${mName}</b>`);
  }
  if (pendingConfig.engine.sherpa_onnx.model_path !== activeConfig.engine.sherpa_onnx.model_path) {
    const mName = pendingConfig.engine.sherpa_onnx.model_path.split(/[/\\]/).pop();
    changes.push(`• ${t('desc.change_model_sherpa')} <b>${mName}</b>`);
  }
  if (pendingConfig.engine.whisper.model !== activeConfig.engine.whisper.model) {
    changes.push(`• ${t('desc.change_model_whisper')} <b>${pendingConfig.engine.whisper.model}</b>`);
  }
  if (pendingConfig.engine.whisper.use_gpu !== activeConfig.engine.whisper.use_gpu) {
    const status = pendingConfig.engine.whisper.use_gpu ? t('desc.enabled') : t('desc.disabled');
    changes.push(`• ${t('desc.gpu_acceleration')}: <b>${status}</b>`);
  }
  return changes.join('<br>');
}

function showDownloadingNavigationModal() {
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
    const activeItem = downloadQueue.find(q => q.status === 'downloading' || q.status === 'queued');
    if (activeItem) {
      activeItem.status = 'cancelled';
      if (window.__TAURI__) {
        await window.__TAURI__.core.invoke('cleanup_model_tmp_files', { engine: activeItem.engine, model: activeItem.model });
      }
    } else if (window.__TAURI__ && pendingConfig) {
      const engineId = pendingConfig.engine.type;
      let modelId = '';
      if (engineId === 'vosk') modelId = pendingConfig.engine.vosk.model_path.split(/[/\\]/).pop();
      else if (engineId === 'sherpa_onnx') modelId = pendingConfig.engine.sherpa_onnx.model_path.split(/[/\\]/).pop();
      else modelId = pendingConfig.engine.whisper.model;
      await window.__TAURI__.core.invoke('cleanup_model_tmp_files', { engine: engineId, model: modelId });
    }

    isGlobalDownloading = false;
    pendingConfig = JSON.parse(JSON.stringify(activeConfig));
    loadConfigGeneralUI(activeConfig);
    updateActiveEnginePanel(activeConfig.engine.type);
    checkEngineDirty();
    renderDownloadQueue();
    ToastManager.show({ type: 'info', title: t('toast.model_removed_nav_title'), message: t('toast.model_removed_nav_msg') });
  };
}

async function confirmUnsavedChanges(onProceed) {
  console.log("[confirmUnsavedChanges] Checking for unsaved changes before page transition...");
  const applyBtn = document.getElementById('btn-engine-apply');
  if (applyBtn && applyBtn.style.display !== 'none') {
    console.log("[confirmUnsavedChanges] Unsaved changes detected (apply button is visible).");
    const engineId = pendingConfig.engine.type;
    let modelId = '';
    if (engineId === 'vosk') {
      modelId = pendingConfig.engine.vosk.model_path.split(/[/\\]/).pop();
    } else if (engineId === 'sherpa_onnx') {
      modelId = pendingConfig.engine.sherpa_onnx.model_path.split(/[/\\]/).pop();
    } else {
      modelId = pendingConfig.engine.whisper.model;
    }

    let isDownloaded = true;
    if (window.__TAURI__ && ['vosk', 'sherpa_onnx', 'whisper', 'faster_whisper'].includes(engineId)) {
      const checkEngine = engineId === 'faster_whisper' ? 'whisper' : engineId;
      isDownloaded = await window.__TAURI__.core.invoke('check_model_downloaded', { engine: checkEngine, model: modelId });
    }

    if (!isDownloaded) {
      console.log(`[confirmUnsavedChanges] Target model '${modelId}' is not downloaded.`);
      const isCurrentlyDownloading = downloadQueue.some(q => q.model === modelId && (q.status === 'downloading' || q.status === 'queued'));
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
        pendingConfig = JSON.parse(JSON.stringify(activeConfig));
        loadConfigGeneralUI(activeConfig);
        updateActiveEnginePanel(activeConfig.engine.type);
        checkEngineDirty();
        renderAvailableModels(activeConfig.engine.type);
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

function showMissingModelNavigationGuardModal({ engine, modelId, onProceed }) {
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
      pendingConfig = JSON.parse(JSON.stringify(activeConfig));
      loadConfigGeneralUI(activeConfig);
      updateActiveEnginePanel(activeConfig.engine.type);
      checkEngineDirty();
      renderAvailableModels(activeConfig.engine.type);
      ToastManager.show({ type: 'info', title: t('toast.download_cancelled'), message: t('toast.download_cancelled_nav_msg') });
    }
    close();
  };

  card.querySelector('.btn-discard-nav').onclick = () => {
    console.log("[showMissingModelNavigationGuardModal] 'Don't Save' clicked. Discarding changes and proceeding with transition.");
    close();
    pendingConfig = JSON.parse(JSON.stringify(activeConfig));
    loadConfigGeneralUI(activeConfig);
    updateActiveEnginePanel(activeConfig.engine.type);
    checkEngineDirty();
    renderAvailableModels(activeConfig.engine.type);
    ToastManager.show({ type: 'info', title: t('toast.model_restored_title'), message: t('toast.model_restored_msg') });
    onProceed();
  };

  card.querySelector('.btn-download-nav').onclick = async () => {
    console.log("[showMissingModelNavigationGuardModal] 'Download and Save' clicked. Initiating download and proceeding with transition.");
    addModelToDownloadQueue(engine, modelId);
    activeConfig = JSON.parse(JSON.stringify(pendingConfig));
    if (window.__TAURI__) {
      await saveConfigState();
    }
    checkEngineDirty();
    updateActiveEnginePanel(activeConfig.engine.type);
    ToastManager.show({ type: 'info', title: t('toast.download_started_activated_title'), message: t('toast.download_started_activated_msg', { model: modelId }) });
    close();
    onProceed();
  };
}

function showUnsavedChangesModal({ description, onProceed, onDiscard }) {
  console.log("[showUnsavedChangesModal] Opening unsaved changes modal...");
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.style.zIndex = '100000';

  const card = document.createElement('div');
  card.className = 'modal-card';
  card.style.maxWidth = '460px';

  const ONLINE_ENGINES = ['deepgram', 'assemblyai', 'openai', 'google', 'azure'];
  const pendingEngineId = pendingConfig?.engine?.type;
  const isOnlineEngine = ONLINE_ENGINES.includes(pendingEngineId);
  const currentApiKey = isOnlineEngine ? getEngineApiKey(pendingEngineId, pendingConfig.engine) : '';
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
      setEngineApiKey(pendingEngineId, pendingConfig.engine, val);

      const mainKeyInput = document.getElementById('engine-api-key');
      if (mainKeyInput) mainKeyInput.value = val;

      checkEngineDirty();

      if (val.trim().length > 0) {
        btnSave.disabled = false;
        btnSave.style.opacity = '1';
        btnSave.style.cursor = 'pointer';
        apiKeyInput.style.borderColor = 'var(--border-subtle)';
        if (apiKeyLabel) apiKeyLabel.style.color = 'var(--text-primary)';
      } else {
        btnSave.disabled = true;
        btnSave.style.opacity = '0.5';
        btnSave.style.cursor = 'not-allowed';
        apiKeyInput.style.borderColor = '#ef4444';
        if (apiKeyLabel) apiKeyLabel.style.color = '#ef4444';
      }
    });
  }

  btnCancel.onclick = () => {
    console.log("[showUnsavedChangesModal] Cancel clicked.");
    close();
  };

  btnDiscard.onclick = () => {
    console.log("[showUnsavedChangesModal] Discard clicked.");
    close();
    if (onDiscard) onDiscard();
  };

  btnSave.onclick = async () => {
    console.log("[showUnsavedChangesModal] Save and Apply clicked.");
    if (btnSave.disabled) {
      console.log("[showUnsavedChangesModal] Save button disabled. Triggering shake.");
      triggerShakeError(btnSave);
      return;
    }

    const engineId = pendingConfig.engine.type;

    if (ONLINE_ENGINES.includes(engineId)) {
      const key = getEngineApiKey(engineId, pendingConfig.engine);
      if (!key || !key.trim()) {
        console.warn("[showUnsavedChangesModal] Missing API key when saving.");
        ToastManager.show({ type: 'error', title: t('toast.missing_api_key_title'), message: t('toast.missing_api_key_msg', { engine: engineId }), persistent: true });
        triggerShakeError(btnSave);
        return;
      }

      btnSave.disabled = true;
      const origText = btnSave.textContent;
      btnSave.textContent = t('nav.unsaved_changes_verifying');
      btnSave.style.opacity = '0.7';

      ToastManager.show({ type: 'info', title: t('toast.verifying_api_conn') });

      try {
        if (window.__TAURI__) {
          await window.__TAURI__.core.invoke('save_config', { config: pendingConfig });
          const testRes = await window.__TAURI__.core.invoke('test_engine', { engineType: engineId });
          await window.__TAURI__.core.invoke('set_engine', { engineType: engineId });

          activeConfig = JSON.parse(JSON.stringify(pendingConfig));
          checkEngineDirty();

          renderTriggerWords(activeConfig.trigger.words);
          renderStopWords(activeConfig.dictation.stop_words);
          loadConfigGeneralUI(activeConfig);
          updateActiveEnginePanel(activeConfig.engine.type);

          let msg = t(testRes.key, { engine: testRes.engine });
          ToastManager.show({ type: 'success', title: t('toast.engine_verified_activated'), message: msg });

          close();
          if (onProceed) onProceed();
          return;
        } else {
          activeConfig = JSON.parse(JSON.stringify(pendingConfig));
          checkEngineDirty();
          close();
          if (onProceed) onProceed();
          return;
        }
      } catch (err) {
        console.error("[showUnsavedChangesModal] API Key verification error:", err);
        if (window.__TAURI__) {
          try {
            await window.__TAURI__.core.invoke('save_config', { config: activeConfig });
          } catch (e) {
            console.error("Failed to restore active config:", e);
          }
        }
        let msg = formatEngineErrorMessage(err, engineId);
        ToastManager.show({ type: 'error', title: t('toast.api_key_verification_error'), message: msg, persistent: true });

        btnSave.disabled = false;
        btnSave.textContent = origText;
        btnSave.style.opacity = '1';
        btnSave.style.cursor = 'pointer';
        triggerShakeError(btnSave);
        return;
      }
    } else {
      activeConfig = JSON.parse(JSON.stringify(pendingConfig));
      await saveConfigState();
      if (window.__TAURI__) {
        await window.__TAURI__.core.invoke('set_engine', { engineType: engineId });
      }
      checkEngineDirty();

      renderTriggerWords(activeConfig.trigger.words);
      renderStopWords(activeConfig.dictation.stop_words);
      loadConfigGeneralUI(activeConfig);
      updateActiveEnginePanel(activeConfig.engine.type);

      ToastManager.show({ type: 'success', title: t('toast.changes_applied'), message: t('toast.engine_updated_msg') });
      close();
      if (onProceed) onProceed();
    }
  };
}

function showTranslationModelDownloadModal(onSuccess) {
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

// Test Connection Button
const testApiBtn = document.getElementById('btn-test-api');
if (testApiBtn) {
  testApiBtn.addEventListener('click', async () => {
    ToastManager.show({ type: 'info', title: t('toast.testing_connection_title') });
    if (window.__TAURI__) {
      try {
        if (pendingConfig) {
          await window.__TAURI__.core.invoke('save_config', { config: pendingConfig });
        }
        const response = await window.__TAURI__.core.invoke('test_engine', { engineType: pendingConfig ? pendingConfig.engine.type : null });
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

// Reset Configuration Button
const resetConfigBtn = document.getElementById('btn-reset-all-config');
if (resetConfigBtn) {
  resetConfigBtn.addEventListener('click', () => {
    showCustomConfirmModal({
      title: t('settings.reset_confirm_title'),
      message: t('settings.reset_confirm_message'),
      confirmText: t('settings.reset_confirm_btn'),
      isDanger: true,
      onConfirm: async () => {
        if (window.__TAURI__) {
          try {
            const defaultCfg = await window.__TAURI__.core.invoke('reset_config');
            activeConfig = defaultCfg;
            
            // Reload all layouts
            renderTriggerWords(defaultCfg.trigger.words);
            renderStopWords(defaultCfg.dictation.stop_words);
            loadConfigGeneralUI(defaultCfg);
            
            // Swapping to Vosk card automatically
            const voskCard = document.getElementById('engine-card-vosk');
            if (voskCard) voskCard.click();

            ToastManager.show({ type: 'success', title: t('toast.reset_success') });
          } catch (err) {
            ToastManager.show({ type: 'error', title: t('toast.reset_failed'), message: err.toString() });
          }
        } else {
          ToastManager.show({ type: 'success', title: t('toast.reset_mock_success') });
        }
      }
    });
  });
}

// Open Config Directory Button
const openConfigDirBtn = document.getElementById('btn-open-config-dir');
if (openConfigDirBtn) {
  openConfigDirBtn.addEventListener('click', async () => {
    if (window.__TAURI__) {
      try {
        await window.__TAURI__.core.invoke('open_config_directory');
      } catch (err) {
        ToastManager.show({ type: 'error', title: 'Failed to open directory', message: err.toString() });
      }
    } else {
      ToastManager.show({ type: 'success', title: 'Open Config Directory Simulated (non-Tauri)' });
    }
  });
}

// Hard Reset Button
const hardResetBtn = document.getElementById('btn-hard-reset');
if (hardResetBtn) {
  hardResetBtn.addEventListener('click', () => {
    console.log('[UI] Hard Reset button clicked, opening confirmation modal');
    showCustomConfirmModal({
      title: t('about.hard_reset.title'),
      message: t('about.hard_reset.confirm'),
      confirmText: t('about.hard_reset.btn'),
      isDanger: false,
      isHazard: true,
      onConfirm: async () => {
        console.log('[UI] Hard Reset confirmed. Initiating hard reset process...');
        if (window.__TAURI__) {
          try {
            await window.__TAURI__.core.invoke('hard_reset_config');
            console.log('[UI] Hard Reset successful, exiting process.');
            window.__TAURI__.process.exit(0);
          } catch (err) {
            console.error('[UI] Hard Reset failed:', err);
            ToastManager.show({ type: 'error', title: t('toast.reset_failed'), message: err.toString() });
            throw err;
          }
        } else {
          console.warn('[UI] Hard Reset simulated (non-Tauri environment)');
          ToastManager.show({ type: 'success', title: 'Hard Reset Simulated (non-Tauri)' });
        }
      },
      onCancel: () => {
        console.log('[UI] Hard Reset confirmation cancelled');
      }
    });
  });
}

// Update Orb Visuals
function updateOrbState(status) {
  currentStatus = status.toLowerCase();
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
    
    // Clear recent transcripts container for the new session!
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

  // Update session counters
  dictationCount++;
  const wordsInText = text.trim().split(/\s+/).filter(w => w.length > 0).length;
  wordCount += wordsInText;

  document.getElementById('stat-dictations').textContent = dictationCount;
  document.getElementById('stat-words').textContent = wordCount;

  // Limit container to 8 lines
  const lines = container.querySelectorAll('.transcript-line');
  if (lines.length > 8) {
    for (let i = 0; i < lines.length - 8; i++) {
      lines[i].remove();
    }
  }

  container.scrollTop = container.scrollHeight;

  // Add to history
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

// ==========================================
// ONBOARDING SETUP WIZARD CONTROLLER
// ==========================================
const OnboardingController = {
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
      this.selectedLanguage = activeConfig.general && activeConfig.general.language 
        ? activeConfig.general.language 
        : (navigator.language.startsWith('pl') ? 'pl' : 'en');
      this.selectedSpeechLanguage = this.selectedLanguage;
      
      this.updateLanguageUI();
      this.bindEvents();
      
      // Show onboarding modal
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
    
    // Apply language dynamically to onboarding translations
    setLanguage(this.selectedLanguage);
    
    // Update labels/buttons based on language
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
    // Language buttons (UI Language)
    const langEn = document.getElementById('onboard-lang-en');
    if (langEn) {
      langEn.onclick = () => {
        this.selectedLanguage = 'en';
        this.selectedSpeechLanguage = 'en'; // default sync
        this.updateLanguageUI();
      };
    }
    const langPl = document.getElementById('onboard-lang-pl');
    if (langPl) {
      langPl.onclick = () => {
        this.selectedLanguage = 'pl';
        this.selectedSpeechLanguage = 'pl'; // default sync
        this.updateLanguageUI();
      };
    }

    // Speech Dictation Language buttons
    document.querySelectorAll('[id^="onboard-speech-lang-"]').forEach(btn => {
      btn.onclick = () => {
        this.selectedSpeechLanguage = btn.getAttribute('data-lang');
        document.querySelectorAll('[id^="onboard-speech-lang-"]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.updateOfflineModelInfo();
      };
    });

    // Skip Button
    const skipBtn = document.getElementById('onboard-skip-btn');
    if (skipBtn) {
      skipBtn.onclick = (e) => {
        e.preventDefault();
        this.skipSetup();
      };
    }

    // Category Choice Cards (Offline vs Cloud)
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

    // Cloud setup: provider dropdown change
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

    // Cloud connection test
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
          // Prepare activeConfig parameters based on tested provider
          activeConfig.engine.type = provider;
          if (provider === 'deepgram') {
            activeConfig.engine.deepgram.api_key = keyVal;
          } else if (provider === 'assemblyai') {
            activeConfig.engine.assemblyai.api_key = keyVal;
          } else if (provider === 'openai') {
            activeConfig.engine.openai.api_key = keyVal;
          } else if (provider === 'google') {
            activeConfig.engine.google.credentials_path = keyVal;
          } else if (provider === 'azure') {
            activeConfig.engine.azure.subscription_key = keyVal;
            activeConfig.engine.azure.region = extraVal;
          }
          
          // Temporarily save config to disk so test_engine command reads updated keys
          await window.__TAURI__.core.invoke('save_config', { config: activeConfig });
          
          // Test
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

    // Offline setup: Profile cards clicks
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

    // Offline setup: engine sub-select for Mid profile
    const offlineEngineSelect = document.getElementById('onboard-offline-engine-select');
    if (offlineEngineSelect) {
      offlineEngineSelect.onchange = () => {
        this.selectedEngine = offlineEngineSelect.value;
        this.updateOfflineModelInfo();
      };
    }

    // Offline setup: Auto space matching checkbox
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

    // Offline setup: GB limits pills
    document.querySelectorAll('.gb-pill-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.gb-pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.gbLimit = parseFloat(btn.dataset.gb);
        this.updateOfflineModelInfo();
      };
    });

    // Offline setup: 10% Upgrade confirm/stay buttons
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

    // Next / Back buttons
    const prevBtn = document.getElementById('btn-onboard-prev');
    if (prevBtn) {
      prevBtn.onclick = () => {
        if (this.isDownloading) return;
        
        // Custom reverse navigation for 8 steps
        if (this.currentStep === 7) {
          if (this.selectedCategory === 'cloud') {
            this.goToStep(4);
          } else {
            // Check if model is downloaded
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
        
        // Step Transitions & Validations
        if (this.currentStep === 3) {
          // Category picked -> Setup dynamic sections in step 4
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
            // Skip Step 5 and Step 6 (Offline model options and download) for Cloud
            this.goToStep(7);
            return;
          } else {
            // Advancing from Offline setup profile card, check free disk space
            await this.queryDiskSpace();
            this.goToStep(5);
            return;
          }
        }

        if (this.currentStep === 5) {
          // Advancing from model space limit selector
          const isDownloaded = await window.__TAURI__.core.invoke('check_model_downloaded', { 
            engine: this.selectedEngine, 
            model: this.selectedModelId 
          });
          if (isDownloaded) {
            // Skip Step 6 (downloader progress page)
            this.goToStep(7);
          } else {
            // Setup model name label on downloader page
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
          // Prepare Summary (Step 8)
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

    // Download model button
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
      console.log(`[Onboarding] Checked free disk space: ${sizeGB} GB (${freeSpaceBytes} bytes)`);
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
        // Leave at least 5 GB free disk space
        const safetyMarginBytes = 5 * 1024 * 1024 * 1024;
        const allowedBytes = Math.max(100 * 1024 * 1024, this.freeDiskSpaceBytes - safetyMarginBytes);
        
        // Find largest model that fits allowedBytes
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
      
      // 10% Upgrade Check (only if manual limit is active)
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

    // Update Dots indicator
    document.querySelectorAll('.onboard-dot').forEach(el => {
      el.classList.remove('active');
    });
    const targetDotEl = document.querySelector(`.onboard-dot[data-step-dot="${step}"]`);
    if (targetDotEl) targetDotEl.classList.add('active');

    // Update Back button visibility
    const prevBtn = document.getElementById('btn-onboard-prev');
    if (prevBtn) {
      prevBtn.style.visibility = (step === 1) ? 'hidden' : 'visible';
    }

    // Update Next button text
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

    // Disable wizard buttons
    const prevBtn = document.getElementById('btn-onboard-prev');
    if (prevBtn) prevBtn.disabled = true;
    const nextBtn = document.getElementById('btn-onboard-next');
    if (nextBtn) nextBtn.disabled = true;

    try {
      console.log(`[Onboarding] Downloading model: ${this.selectedModelId} for engine: ${this.selectedEngine}`);
      
      // Cleanup any empty model directory to prevent crashes before beginning download
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
      
      // Complete
      this.isDownloading = false;
      if (statusText) statusText.textContent = t('onboard.model.download_complete');
      if (percentageText) percentageText.textContent = '100%';
      if (progressFill) progressFill.style.width = '100%';
      
      if (prevBtn) prevBtn.disabled = false;
      if (nextBtn) nextBtn.disabled = false;
      
      // Auto-advance
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
    activeConfig.general.first_start_completed = true;
    pendingConfig = JSON.parse(JSON.stringify(activeConfig));
    
    try {
      if (window.__TAURI__) {
        await window.__TAURI__.core.invoke('save_config', { config: activeConfig });
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
        // Show changelog immediately after onboarding finishes
        checkAndShowChangelogOnStartup();
      }, 400);
    }
  },

  async completeSetup() {
    console.log('[Onboarding] Completing setup and saving configuration...');
    
    // Save language
    activeConfig.general.language = this.selectedSpeechLanguage;
    
    // Save engine & models
    activeConfig.engine.type = this.selectedEngine;
    if (this.selectedCategory === 'offline') {
      if (this.selectedEngine === 'vosk') {
        activeConfig.engine.vosk.model_path = `models/vosk/${this.selectedModelId}`;
      } else if (this.selectedEngine === 'sherpa_onnx') {
        activeConfig.engine.sherpa_onnx.model_path = `models/sherpa/${this.selectedModelId}`;
      } else if (this.selectedEngine === 'whisper') {
        activeConfig.engine.whisper.model = this.selectedModelId;
        activeConfig.engine.whisper.use_gpu = false;
      } else if (this.selectedEngine === 'faster_whisper') {
        activeConfig.engine.faster_whisper.model = this.selectedModelId;
        activeConfig.engine.whisper.model = this.selectedModelId;
        activeConfig.engine.whisper.use_gpu = this.hasGpu;
        if (this.hasGpu) {
          activeConfig.engine.faster_whisper.device = 'cuda';
        } else {
          activeConfig.engine.faster_whisper.device = 'cpu';
        }
      }
    }

    // Save autostart & minimized
    const autostartVal = document.getElementById('onboard-pref-autostart').checked;
    activeConfig.general.autostart = autostartVal;
    
    const minimizedVal = document.getElementById('onboard-pref-minimized').checked;
    activeConfig.ui.start_minimized = minimizedVal;

    // Set complete
    activeConfig.general.first_start_completed = true;

    pendingConfig = JSON.parse(JSON.stringify(activeConfig));
    
    try {
      if (window.__TAURI__) {
        await window.__TAURI__.core.invoke('save_config', { config: activeConfig });
        
        applyAppearanceSettings(activeConfig);
        loadConfigGeneralUI(activeConfig);
        renderTriggerWords(activeConfig.trigger.words);
        renderStopWords(activeConfig.dictation.stop_words);
        
        await window.__TAURI__.core.invoke('set_engine', { engineType: this.selectedEngine });
      }
      
      activeConfig = JSON.parse(JSON.stringify(pendingConfig));
      checkEngineDirty();
      updateActiveEnginePanel(activeConfig.engine.type);
      updateEngineCardsUI(activeConfig.engine.type);

      this.closeModal();
      ToastManager.show({ type: 'success', title: t('toast.voicetype_active_title'), message: t('toast.voicetype_active_msg') });
      await checkActiveEngineAvailability();
      
    } catch (err) {
      console.error('[Onboarding] Failed to save configuration:', err);
      ToastManager.show({ type: 'error', title: 'Configuration error', message: err.toString() });
    }
  }
};

// Application Initialization
async function init() {
  if (window.__TAURI__) {
    try {
      // 0. Check python availability
      await checkPython();

      // 1. Get initial configuration
      const config = await window.__TAURI__.core.invoke('get_config');
      activeConfig = config;
      pendingConfig = JSON.parse(JSON.stringify(config));
      
      // Initialize i18n and Appearance
      setLanguage(config.general && config.general.language ? config.general.language : (navigator.language.startsWith('pl') ? 'pl' : 'en'));
      setupAppearanceEventListeners();
      applyAppearanceSettings(config);
      await updateAppVersionBadge();

      // Run onboarding if needed
      await OnboardingController.init();

      // Check and show changelog modal if updated
      await checkAndShowChangelogOnStartup();

      // 2. Render UI lists
      renderTriggerWords(config.trigger.words);
      renderStopWords(config.dictation.stop_words);
      loadConfigGeneralUI(config);
      initCloudLiveTypingWarningModalListeners();

      // 3. Query engines list
      const engines = await window.__TAURI__.core.invoke('list_engines');
      const active = engines.find(e => e.is_active);
      
      // Select the correct engine card visually
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

      // Populate audio devices
      await populateAudioDevices();

      // Bind missing model downloads shortcut button
      const btnGoToDownloads = document.getElementById('btn-overlay-go-to-downloads');
      if (btnGoToDownloads) {
        btnGoToDownloads.addEventListener('click', () => {
          console.log('[Dashboard] Go to downloads button clicked due to missing model warning.');
          try {
            if (activeConfig && activeConfig.engine) {
              const engineId = activeConfig.engine.type;
              let modelId = '';
              if (engineId === 'vosk') {
                modelId = (activeConfig.engine.vosk.model_path || '').split(/[/\\]/).pop();
              } else if (engineId === 'sherpa_onnx') {
                modelId = (activeConfig.engine.sherpa_onnx.model_path || '').split(/[/\\]/).pop();
              } else if (engineId === 'whisper' || engineId === 'faster_whisper') {
                modelId = activeConfig.engine.whisper.model;
              }

              if (modelId) {
                console.log(`[Dashboard] Redirecting for missing model. Engine: ${engineId}, Model: ${modelId}`);
                window.pendingModelHighlight = { engineId, modelId };
              } else {
                console.warn('[Dashboard] Could not determine model ID from activeConfig.');
              }
            } else {
              console.warn('[Dashboard] activeConfig or engine config is not defined.');
            }
          } catch (err) {
            console.error('[Dashboard] Error setting pending model highlight:', err);
          }

          const navDownloads = document.getElementById('nav-downloads');
          if (navDownloads) {
            console.log('[Dashboard] Triggering click on navigation downloads button.');
            navDownloads.click();
          } else {
            console.error('[Dashboard] Navigation element nav-downloads not found.');
          }
        });
      }

      // Check active engine availability immediately on startup
      await checkActiveEngineAvailability();

      // 4. Register IPC event listeners
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
        console.log('[NO_INPUT_COPIED] Event received in frontend - showing in-app toast notification');
        ToastManager.show({ 
          type: 'warning', 
          title: t('toast.no_text_field'), 
          message: t('toast.no_input_copied_msg') 
        });
      });

      // 5. Initial welcome message
      ToastManager.show({ type: 'success', title: t('toast.voicetype_active_title'), message: t('toast.voicetype_active_msg') });
      renderHistoryUI();
    } catch (err) {
      console.error(err);
      ToastManager.show({ type: 'error', title: t('toast.initialization_error'), message: err.toString(), persistent: true });
    }
  } else {
    // Mock configuration for dev environment
    activeConfig = {
      trigger: { words: ['zaczynamy', 'start'], fuzzy_match: true },
      dictation: { stop_words: ['stop', 'done'], silence_timeout_ms: 1500, stop_word_remove_from_text: true, start_delay_ms: 0, live_typing_interval_ms: 2000 },
      general: { autostart: false },
      input: { clipboard_fallback: true, clipboard_toast: true, auto_enter: false },
      audio: { input_device: 'default' },
      engine: { type: 'vosk', vosk: { model_path: 'models/vosk/vosk-model-small-pl-0.22' } }
    };
    pendingConfig = JSON.parse(JSON.stringify(activeConfig));
    renderTriggerWords(activeConfig.trigger.words);
    renderStopWords(activeConfig.dictation.stop_words);
    loadConfigGeneralUI(activeConfig);
    populateAudioDevices();
    updateActiveEnginePanel('vosk');
    updateOrbState('idle');
    renderHistoryUI();
    ToastManager.show({ type: 'info', title: t('toast.mock_env_title'), message: t('toast.mock_env_msg') });
  }
  if (quickLangSelect && activeConfig && activeConfig.general) {
    quickLangSelect.value = activeConfig.general.language;
  }
  updateQuickModelOptions();
  setupUpdateNotificationUI();

  // Dismiss loading screen
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    console.log('[VoiceType] Initialization complete, dismissing loading screen.');
    loadingScreen.classList.add('fade-out');
    setTimeout(() => {
      loadingScreen.remove();
    }, 450);
  }
}

document.addEventListener('DOMContentLoaded', init);

let isPythonAvailableGlobal = true;

async function checkPython() {
  if (window.__TAURI__) {
    try {
      isPythonAvailableGlobal = await window.__TAURI__.core.invoke('check_python_installed');
      updateEngineCardsLockUI();
    } catch (e) {
      console.error("Failed to check python", e);
    }
  }
}

function updateEngineCardsLockUI() {
  const whisperCard = document.getElementById('engine-card-whisper');
  const fasterWhisperCard = document.getElementById('engine-card-faster-whisper');
  
  [whisperCard, fasterWhisperCard].forEach(card => {
    if (!card) return;
    
    // Remove any existing warning badge
    const oldBadge = card.querySelector('.python-warning-badge');
    if (oldBadge) oldBadge.remove();
    
    if (!isPythonAvailableGlobal) {
      // Add a python warning badge
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

function showPythonModal(targetEngineId) {
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

  // Reset modal state
  modal.style.display = 'flex';
  progressContainer.style.display = 'none';
  actions.style.display = 'flex';
  desc.style.display = 'block';
  desc.innerHTML = t('addons.py.install_msg');

  btnClose.onclick = () => {
    modal.style.display = 'none';
  };

  btnInstall.onclick = async () => {
    // Hide buttons, show progress bar
    actions.style.display = 'none';
    progressContainer.style.display = 'block';
    
    if (window.__TAURI__) {
      // Listen to progress events
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
            // Click the card they wanted originally to select it!
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

function showCudaInstallModal(gpuCheck = null) {
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
      pendingConfig.engine.whisper.use_gpu = false;
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
            pendingConfig.engine.whisper.use_gpu = true;
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
            pendingConfig.engine.whisper.use_gpu = false;
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

function showCudaUninstallProgress(gpuCheck = null) {
  const modal = document.getElementById('python-modal');
  const btnClose = document.getElementById('btn-python-modal-close');
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
            pendingConfig.engine.whisper.use_gpu = false;
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
            pendingConfig.engine.whisper.use_gpu = true;
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
          pendingConfig.engine.whisper.use_gpu = true;
          checkEngineDirty();
        }
        modal.style.display = 'none';
        title.textContent = t('addons.py.modal_title');
        unlisten();
      }
    })();
  }
}

function checkEngineDirty() {
  const applyBtn = document.getElementById('btn-engine-apply');
  if (!applyBtn) return;

  if (!pendingConfig || !activeConfig) {
    applyBtn.style.display = 'none';
    return;
  }

  const isDirty = 
    pendingConfig.engine.type !== activeConfig.engine.type ||
    pendingConfig.general.language !== activeConfig.general.language ||
    pendingConfig.engine.vosk.model_path !== activeConfig.engine.vosk.model_path ||
    pendingConfig.engine.sherpa_onnx.model_path !== activeConfig.engine.sherpa_onnx.model_path ||
    pendingConfig.engine.whisper.model !== activeConfig.engine.whisper.model ||
    pendingConfig.engine.whisper.use_gpu !== activeConfig.engine.whisper.use_gpu ||
    (pendingConfig.engine.deepgram && activeConfig.engine.deepgram && pendingConfig.engine.deepgram.api_key !== activeConfig.engine.deepgram.api_key) ||
    (pendingConfig.engine.assemblyai && activeConfig.engine.assemblyai && pendingConfig.engine.assemblyai.api_key !== activeConfig.engine.assemblyai.api_key) ||
    (pendingConfig.engine.openai && activeConfig.engine.openai && pendingConfig.engine.openai.api_key !== activeConfig.engine.openai.api_key) ||
    (pendingConfig.engine.google && activeConfig.engine.google && pendingConfig.engine.google.credentials_path !== activeConfig.engine.google.credentials_path) ||
    (pendingConfig.engine.azure && activeConfig.engine.azure && (pendingConfig.engine.azure.subscription_key !== activeConfig.engine.azure.subscription_key || pendingConfig.engine.azure.region !== activeConfig.engine.azure.region));

  if (isDirty) {
    applyBtn.style.display = 'flex';
  } else {
    applyBtn.style.display = 'none';
  }
}

const applyBtn = document.getElementById('btn-engine-apply');
if (applyBtn) {
  applyBtn.addEventListener('click', async () => {
    const engineId = pendingConfig.engine.type;
    const onlineEngines = ['deepgram', 'assemblyai', 'openai', 'google', 'azure'];

    if (onlineEngines.includes(engineId)) {
      let key = '';
      if (engineId === 'deepgram') key = pendingConfig.engine.deepgram.api_key;
      if (engineId === 'assemblyai') key = pendingConfig.engine.assemblyai.api_key;
      if (engineId === 'openai') key = pendingConfig.engine.openai.api_key;
      if (engineId === 'google') key = pendingConfig.engine.google.credentials_path;
      if (engineId === 'azure') key = pendingConfig.engine.azure.subscription_key;

      if (!key || !key.trim()) {
        ToastManager.show({ type: 'error', title: t('toast.missing_api_key_title'), message: t('toast.missing_api_key_msg', { engine: engineId }), persistent: true });
        return;
      }

      ToastManager.show({ type: 'info', title: t('toast.verifying_api_conn') });
      try {
        if (window.__TAURI__) {
          await window.__TAURI__.core.invoke('save_config', { config: pendingConfig });
          const testRes = await window.__TAURI__.core.invoke('test_engine', { engineType: engineId });
          await window.__TAURI__.core.invoke('set_engine', { engineType: engineId });
          
          activeConfig = JSON.parse(JSON.stringify(pendingConfig));
          checkEngineDirty();

          renderTriggerWords(activeConfig.trigger.words);
          renderStopWords(activeConfig.dictation.stop_words);
          loadConfigGeneralUI(activeConfig);
          updateActiveEnginePanel(activeConfig.engine.type);

          let msg = t(testRes.key, { engine: testRes.engine });
          ToastManager.show({ type: 'success', title: t('toast.engine_verified_activated'), message: msg });
          return;
        }
      } catch (err) {
        if (window.__TAURI__) {
          await window.__TAURI__.core.invoke('save_config', { config: activeConfig });
        }
        let msg = formatEngineErrorMessage(err, engineId);
        ToastManager.show({ type: 'error', title: t('toast.api_key_verification_error'), message: msg, persistent: true });
        return;
      }
    }

    let modelId = '';
    if (engineId === 'vosk') {
      const parts = pendingConfig.engine.vosk.model_path.split(/[/\\]/);
      modelId = parts[parts.length - 1];
    } else if (engineId === 'sherpa_onnx') {
      const parts = pendingConfig.engine.sherpa_onnx.model_path.split(/[/\\]/);
      modelId = parts[parts.length - 1];
    } else {
      modelId = pendingConfig.engine.whisper.model;
    }

    let isDownloaded = true;
    if (engineId === 'vosk' || engineId === 'sherpa_onnx' || engineId === 'whisper' || engineId === 'faster_whisper') {
      const checkEngine = engineId === 'faster_whisper' ? 'whisper' : engineId;
      isDownloaded = await window.__TAURI__.core.invoke('check_model_downloaded', { engine: checkEngine, model: modelId });
    }

    if (isDownloaded) {
      activeConfig = JSON.parse(JSON.stringify(pendingConfig));
      await saveConfigState();
      if (window.__TAURI__) {
        await window.__TAURI__.core.invoke('set_engine', { engineType: engineId });
      }
      checkEngineDirty();
      
      renderTriggerWords(activeConfig.trigger.words);
      renderStopWords(activeConfig.dictation.stop_words);
      loadConfigGeneralUI(activeConfig);
      updateActiveEnginePanel(activeConfig.engine.type);
      
      ToastManager.show({ type: 'success', title: t('toast.changes_applied'), message: t('toast.engine_updated_msg') });
    } else {
      const isCurrentlyDownloading = downloadQueue.some(q => q.model === modelId && (q.status === 'downloading' || q.status === 'queued'));
      if (isCurrentlyDownloading) {
        activeConfig = JSON.parse(JSON.stringify(pendingConfig));
        await saveConfigState();
        checkEngineDirty();
        
        renderTriggerWords(activeConfig.trigger.words);
        renderStopWords(activeConfig.dictation.stop_words);
        loadConfigGeneralUI(activeConfig);
        updateActiveEnginePanel(activeConfig.engine.type);
        
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
            await window.__TAURI__.core.invoke('download_model', { engine: checkEngine, model: modelId });
            
            activeConfig = JSON.parse(JSON.stringify(pendingConfig));
            await saveConfigState();
            checkEngineDirty();
            
            renderTriggerWords(activeConfig.trigger.words);
            renderStopWords(activeConfig.dictation.stop_words);
            loadConfigGeneralUI(activeConfig);
            updateActiveEnginePanel(activeConfig.engine.type);
            
            ToastManager.show({ type: 'success', title: t('toast.changes_applied'), message: t('toast.download_finished_active_msg') });
          } catch (err) {
            ToastManager.show({ type: 'error', title: t('toast.download_error'), message: err.toString(), persistent: true });
          } finally {
            applyBtn.disabled = false;
            applyBtn.style.opacity = '1';
          }
        },
        onCancel: () => {
          pendingConfig = JSON.parse(JSON.stringify(activeConfig));
          loadConfigGeneralUI(activeConfig);
          updateActiveEnginePanel(activeConfig.engine.type);
          checkEngineDirty();
        }
      });
    }
  });
}

function formatBytes(bytes) {
  if (bytes > 1073741824) {
    return (bytes / 1073741824).toFixed(2) + ' GB';
  } else {
    return (bytes / 1048576).toFixed(1) + ' MB';
  }
}

// ==========================================
// TRANSCRIPT HISTORY MODULE
// ==========================================
function formatDatePl(timestamp) {
  const months = [
    "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
    "lipca", "sierpnia", "września", "października", "listopada", "grudnia"
  ];
  const d = new Date(timestamp);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatTime(timestamp) {
  const d = new Date(timestamp);
  const pad = (n) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function renderHistoryUI() {
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
      
      // Bind copy buttons
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

    // Group transcripts by date
    const groups = {};
    historyList.forEach(entry => {
      const dateStr = formatDatePl(entry.timestamp);
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(entry);
    });

    pageContainer.innerHTML = '';
    
    // For each date group
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

    // Bind copy buttons on history page
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

// Bind Clear History Button
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
        ToastManager.show({ type: 'success', title: t('toast.history_cleared') });
      }
    });
  });
}

// Bind Dashboard "View All" Button
const dashboardViewHistoryBtn = document.getElementById('dashboard-view-history-btn');
if (dashboardViewHistoryBtn) {
  dashboardViewHistoryBtn.addEventListener('click', () => {
    const navBtn = document.getElementById('nav-history');
    if (navBtn) navBtn.click();
  });
}

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
      if (typeof ToastManager !== 'undefined') {
        ToastManager.show({ type: 'info', title: t('about.check_updates'), message: t('updater.checking') || 'Checking for updates...' });
      }
      await initUpdater((status) => {
        if (status.type === 'up_to_date') {
          if (typeof ToastManager !== 'undefined') {
            ToastManager.show({ type: 'success', title: t('about.check_updates'), message: t('updater.up_to_date') || 'VoiceType is up to date!' });
          }
        } else if (status.type === 'downloading') {
          if (typeof ToastManager !== 'undefined') {
            ToastManager.show({ type: 'info', title: t('about.check_updates'), message: `Downloading update v${status.version} (${status.progress}%)...` });
          }
        } else if (status.type === 'ready_to_install') {
          if (typeof ToastManager !== 'undefined') {
            ToastManager.show({ type: 'success', title: t('about.check_updates'), message: `Update v${status.version} ready to install.` });
          }
        }
      });
    } catch (e) {
      if (typeof ToastManager !== 'undefined') {
        ToastManager.show({ type: 'error', title: t('about.check_updates'), message: e.message || e.toString() });
      }
    }
  });
}

// ==========================================
// STARTUP MODEL VERIFICATION
// ==========================================
async function verifyStartupModel() {
  if (!window.__TAURI__ || !activeConfig || !activeConfig.engine) return;
  const engineId = activeConfig.engine.type;
  if (!['vosk', 'sherpa_onnx', 'whisper', 'faster_whisper'].includes(engineId)) return;

  let modelId = '';
  if (engineId === 'vosk') modelId = (activeConfig.engine.vosk.model_path || '').split(/[/\\]/).pop();
  else if (engineId === 'sherpa_onnx') modelId = (activeConfig.engine.sherpa_onnx.model_path || '').split(/[/\\]/).pop();
  else modelId = activeConfig.engine.whisper.model;

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
        activeConfig.engine.type = foundEngine;
        if (foundEngine === 'vosk') activeConfig.engine.vosk.model_path = `models/vosk/${foundModel}`;
        else if (foundEngine === 'sherpa_onnx') activeConfig.engine.sherpa_onnx.model_path = `models/sherpa/${foundModel}`;
        else activeConfig.engine.whisper.model = foundModel;

        pendingConfig = JSON.parse(JSON.stringify(activeConfig));
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

// ==========================================
// ADDONS SYSTEM MANAGER MODULE
// ==========================================
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

  // 1. Python Environment Component
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

  // 2. Speech Models Summary
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

onLanguageChange(() => {
  try {
    const activeEngine = pendingConfig ? pendingConfig.engine.type : (activeConfig ? activeConfig.engine.type : 'vosk');
    updateActiveEnginePanel(activeEngine);
    renderHistoryUI();
    renderDownloadQueue();
    renderInstalledModelsManager();
    updateDashboardActiveEngineCard();
    renderAddonsManagerUI();
    updateEngineCardsLockUI();
    updateDOMTranslations();
    if (cachedVersionInfo) renderAppVersionBadge(cachedVersionInfo);
    if (cachedReleases) renderChangelog();
  } catch (err) {
    console.error('[i18n] Error updating UI on language change:', err);
  }
});

// Changelog Functionality
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

function parseMarkdown(text) {
  if (!text) return '';
  
  // Escape HTML tags to prevent XSS
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headings
  html = html.replace(/^### (.*?)$/gm, '<h4 style="margin: 12px 0 6px 0; font-weight: 700; color: var(--text-primary); font-size: 13px;">$1</h4>');
  html = html.replace(/^## (.*?)$/gm, '<h3 style="margin: 16px 0 8px 0; font-weight: 800; color: var(--text-primary); font-size: 14px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 4px;">$1</h3>');
  html = html.replace(/^# (.*?)$/gm, '<h2 style="margin: 18px 0 10px 0; font-weight: 800; color: var(--text-primary); font-size: 16px;">$1</h2>');

  // Bullet points
  html = html.replace(/^[-\*\u2022]\s+(.*?)$/gm, '<li style="margin-left: 12px; margin-bottom: 4px; list-style-type: disc; font-size: 12px; line-height: 1.4; color: var(--text-secondary);">$1</li>');

  // Bold text
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--text-primary); font-weight: 600;">$1</strong>');

  // Inline code
  html = html.replace(/`(.*?)`/g, '<code style="background: rgba(255, 255, 255, 0.08); color: var(--accent-green); padding: 2px 5px; border-radius: 4px; font-family: monospace; font-size: 11px; border: 1px solid var(--border-subtle);">$1</code>');

  // Links
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, (match, linkText, url) => {
    return `<a href="#" onclick="window.openChangelogUrl('${url}'); return false;" style="color: var(--accent-green); text-decoration: none; border-bottom: 1px dashed var(--accent-green);" onmouseover="this.style.borderBottomStyle='solid'" onmouseout="this.style.borderBottomStyle='dashed'">${linkText}</a>`;
  });

  // Paragraph blocks (two newlines)
  html = html.replace(/\n\n/g, '<div style="height: 8px;"></div>');
  
  // Newlines
  html = html.replace(/\n/g, '<br>');

  return html;
}

async function loadChangelog() {
  const versionsListEl = document.getElementById('changelog-versions-list');
  const detailsViewEl = document.getElementById('changelog-details-view');
  if (!versionsListEl || !detailsViewEl) return;

  // Render loading state if not loaded
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
      console.log(`[Changelog] Loaded ${cachedReleases.length} releases successfully.`);
    } catch (err) {
      console.error('[Changelog] Error loading releases:', err);
      versionsListEl.innerHTML = `<div style="font-size: 12px; color: #ef4444; text-align: center; margin-top: 30px;" data-i18n="about.changelog.error">${t('about.changelog.error')}</div>`;
      return;
    }
  }

  renderChangelog();
}

function renderChangelog() {
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

  // Determine which release to auto-select
  let selectTarget = null;
  if (activeSelectedReleaseId) {
    selectTarget = filtered.find(r => r.id === activeSelectedReleaseId);
  }
  if (!selectTarget) {
    // Find current version
    const currentVer = (cachedVersionInfo?.version || '').replace(/^v/, '');
    selectTarget = filtered.find(r => r.tag_name.replace(/^v/, '') === currentVer) || filtered[0];
  }

  if (selectTarget) {
    activeSelectedReleaseId = selectTarget.id;
    renderReleaseDetails(selectTarget);
  }

  versionsListEl.innerHTML = '';
  filtered.forEach(rel => {
    const isCurrent = rel.tag_name.replace(/^v/, '') === (cachedVersionInfo?.version || '').replace(/^v/, '');
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
      console.log(`[Changelog] Version clicked: ${rel.tag_name}`);
      activeSelectedReleaseId = rel.id;
      renderReleaseDetails(rel);
      
      // Update active styling
      document.querySelectorAll('.changelog-version-btn').forEach(btn => btn.classList.remove('active'));
      itemEl.classList.add('active');
    });

    versionsListEl.appendChild(itemEl);
  });
}

function renderReleaseDetails(release) {
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

// Bind Changelog Filters
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('changelog-filter-stable')?.addEventListener('change', () => {
    console.log('[Changelog] Filter stable changed');
    renderChangelog();
  });
  document.getElementById('changelog-filter-pre')?.addEventListener('change', () => {
    console.log('[Changelog] Filter pre changed');
    renderChangelog();
  });
});

async function checkAndShowChangelogOnStartup() {
  if (!window.__TAURI__) return;

  // If onboarding is active/running, don't show the changelog modal
  const onboardingModal = document.getElementById('onboarding-modal');
  if (onboardingModal && onboardingModal.style.display !== 'none') {
    console.log('[Changelog Startup] Onboarding is active, skipping changelog check.');
    return;
  }

  try {
    const showChangelog = await window.__TAURI__.core.invoke('check_show_changelog');
    if (!showChangelog) return;

    console.log('[Changelog Startup] Showing startup changelog modal...');

    // Load releases if not cached yet
    if (!cachedReleases) {
      try {
        console.log('[Changelog Startup] Fetching releases from GitHub API...');
        const response = await fetch('https://api.github.com/repos/Ximeeek/VoiceType/releases');
        if (response.ok) {
          cachedReleases = await response.json();
          console.log(`[Changelog Startup] Loaded ${cachedReleases.length} releases successfully.`);
        }
      } catch (err) {
        console.error('[Changelog Startup] Failed to fetch releases from GitHub:', err);
      }
    }

    const currentVer = (cachedVersionInfo?.version || '').replace(/^v/, '');
    let release = null;
    if (cachedReleases && cachedReleases.length > 0) {
      release = cachedReleases.find(r => r.tag_name.replace(/^v/, '') === currentVer);
      if (!release && (cachedVersionInfo?.is_dev || currentVer === 'DEV')) {
        // Fallback to the latest release for testing/dev purposes
        release = cachedReleases[0];
      }
    }

    if (release) {
      showStartupChangelogModal(release);
    } else {
      console.warn('[Changelog Startup] No release found matching version:', currentVer);
    }
  } catch (err) {
    console.error('[Changelog Startup] Error checking/showing changelog on startup:', err);
  }
}

function showStartupChangelogModal(release) {
  const modal = document.getElementById('startup-changelog-modal');
  const subtitleEl = document.getElementById('startup-changelog-subtitle');
  const contentEl = document.getElementById('startup-changelog-content');
  const closeBtnX = document.getElementById('btn-startup-changelog-close-x');
  const closeBtn = document.getElementById('btn-startup-changelog-close');

  if (!modal || !contentEl) return;

  // Set subtitle with translated version string
  const versionStr = release.tag_name;
  if (subtitleEl) {
    subtitleEl.textContent = t('about.changelog.startup_subtitle', { version: versionStr });
  }

  // Parse and display release body
  contentEl.innerHTML = parseChangelogToStructuredHtml(release.body);

  // Show modal
  modal.style.display = 'flex';

  // Helper to close and save
  const closeModalAndSave = async () => {
    modal.style.display = 'none';
    
    // Save version in config so it won't show again
    if (activeConfig && activeConfig.general) {
      activeConfig.general.last_seen_version = cachedVersionInfo?.version || '';
      pendingConfig = JSON.parse(JSON.stringify(activeConfig));
      try {
        if (window.__TAURI__) {
          await window.__TAURI__.core.invoke('save_config', { config: activeConfig });
          console.log('[Changelog Startup] Saved last_seen_version to config:', activeConfig.general.last_seen_version);
        }
      } catch (err) {
        console.error('[Changelog Startup] Failed to save config after changelog view:', err);
      }
    }
  };

  closeBtnX.onclick = closeModalAndSave;
  closeBtn.onclick = closeModalAndSave;
}

function parseChangelogToStructuredHtml(body) {
  if (!body) return '';

  // Clean lines
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

    // Check for "## Key Changes" or similar headings to start parsing categories
    if (line.startsWith('## ') || line.startsWith('# ')) {
      if (line.toLowerCase().includes('changes') || line.toLowerCase().includes('zmian')) {
        inKeyChanges = true;
        continue;
      }
    }

    // Check for footer / licensing
    if (line.startsWith('**Licensing**') || line.toLowerCase().includes('license') || line.toLowerCase().includes('licencja')) {
      finishedCategories = true;
    }

    if (finishedCategories) {
      footerLines.push(line);
      continue;
    }

    if (!inKeyChanges) {
      // Intro lines before categories start
      introLines.push(line);
      continue;
    }

    // Check if line is a category header
    const isHeading = line.startsWith('###');
    const isBoldHeader = line.startsWith('**') && line.endsWith('**');

    if (isHeading || isBoldHeader) {
      // Save previous category if any
      if (currentCategory && currentItems.length > 0) {
        html += renderCategoryCard(currentCategory, currentItems);
      }
      // Set new category
      currentCategory = line.replace(/^###\s+/, '').replace(/^\*\*/, '').replace(/\*\*$/, '');
      currentItems = [];
    } else if (line.startsWith('-') || line.startsWith('*')) {
      // It's a list item
      currentItems.push(line);
    } else {
      // If we don't have list item but we are under categories, it could be an inline text or part of a category
      if (currentCategory) {
        currentItems.push(line);
      } else {
        introLines.push(line);
      }
    }
  }

  // Render the last category
  if (currentCategory && currentItems.length > 0) {
    html += renderCategoryCard(currentCategory, currentItems);
  }

  // Render intro block
  let introHtml = '';
  if (introLines.length > 0) {
    const processedIntro = parseMarkdownFormatting(introLines.join('<br>'));
    introHtml = `
      <div style="font-size: 12.5px; line-height: 1.55; color: var(--text-secondary); margin-bottom: 14px; padding: 10px 12px; background: rgba(57, 255, 80, 0.04); border-left: 3px solid var(--accent-green); border-radius: 6px;">
        ${processedIntro}
      </div>
    `;
  }

  // Render footer block
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

function renderCategoryCard(categoryName, items) {
  let listItemsHtml = '';
  items.forEach(item => {
    let cleanItem = item.replace(/^[-\*\u2022]\s+/, '').trim();
    
    let title = '';
    let desc = cleanItem;
    
    // Match bold text at the beginning
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

function parseMarkdownFormatting(text) {
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
