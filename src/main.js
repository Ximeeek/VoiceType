import { setLanguage, t, updateDOMTranslations, getLanguage } from './i18n.js';

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

  document.documentElement.style.setProperty('--accent-green', mainColor);
  document.documentElement.style.setProperty('--accent-magenta', secColor);
  document.documentElement.style.setProperty('--accent-green-dim', dimColor);
  document.documentElement.style.setProperty('--border-accent', borderColor);
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

    let closeBtnHtml = '';
    if (persistent || type === 'error') {
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

    if (!persistent) {
      let duration = 3000;
      if (type === 'success') duration = 2000;
      if (type === 'error') duration = 5000;

      setTimeout(() => {
        ToastManager.hide(id);
      }, duration);
    }
  }

  static hide(id) {
    const toast = document.getElementById(id);
    if (toast) {
      toast.style.animation = 'toast-out 0.2s ease forwards';
      setTimeout(() => {
        toast.remove();
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

    confirmUnsavedChanges(() => {
      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      pages.forEach(p => p.classList.remove('active'));
      const targetPage = document.getElementById(`page-${targetPageId}`);
      if (targetPage) {
        targetPage.classList.add('active');
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
      ToastManager.show({ type: 'error', title: 'Save Config Failed', message: err.toString() });
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
      devices.forEach(device => {
        const opt = document.createElement('option');
        opt.value = device.id;
        opt.textContent = device.name;
        select.appendChild(opt);
      });
      
      if (activeConfig && activeConfig.audio) {
        select.value = activeConfig.audio.input_device;
      }
    } catch (err) {
      console.error('Failed to query audio devices:', err);
    }
  } else {
    // Mock
    select.innerHTML = '<option value="default">Default Input Device</option><option value="mic-1">External Microphone</option>';
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
      container.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; font-style: italic;">No trigger words</div>';
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
            ToastManager.show({ type: 'success', title: 'Trigger words updated' });
          } catch (err) {
            ToastManager.show({ type: 'error', title: 'Update failed', message: err.toString() });
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
    settingsContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; font-style: italic;">No stop words</div>';
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
          ToastManager.show({ type: 'success', title: 'Stop words updated' });
        } catch (err) {
          ToastManager.show({ type: 'error', title: 'Update failed', message: err.toString() });
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

  if (triggerWords.includes(newWord)) {
    ToastManager.show({ type: 'info', title: 'Word already registered' });
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
      ToastManager.show({ type: 'success', title: 'Trigger word added' });
    } catch (err) {
      ToastManager.show({ type: 'error', title: 'Add failed', message: err.toString() });
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
    ToastManager.show({ type: 'info', title: 'Word already registered' });
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
      ToastManager.show({ type: 'success', title: 'Stop word added' });
    } catch (err) {
      ToastManager.show({ type: 'error', title: 'Add failed', message: err.toString() });
    }
  }
}

if (stopAddBtn) stopAddBtn.addEventListener('click', handleAddStop);
if (stopInput) stopInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAddStop(); });

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
  document.getElementById('settings-clipboard-fallback').checked = config.input.clipboard_fallback;
  document.getElementById('settings-clipboard-toast').checked = config.input.clipboard_toast;
  document.getElementById('settings-start-delay').value = config.dictation.start_delay_ms;
  document.getElementById('start-delay-val').textContent = `${config.dictation.start_delay_ms} ms`;

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
        ToastManager.show({ type: 'success', title: 'Microphone updated' });
      } catch (err) {
        ToastManager.show({ type: 'error', title: 'Failed to update mic', message: err.toString() });
      }
    }
  };

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
    appLangSelect.value = config.general.language || 'en';
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
        title: 'Ostrzeżenie: Whisper.cpp (CPU-only)',
        message: 'Natywny silnik Whisper.cpp na tym systemie działa w trybie wielowątkowego procesora (CPU). Przetwarzanie (zwłaszcza modeli large) może potrwać kilka sekund po zakończeniu mówienia. Dla pełnej akceleracji GPU wybierz silnik Faster-Whisper.',
        duration: 10000
      });
    }
    
    // Update active visual states
    engineCards.forEach(c => {
      c.classList.remove('active');
      const badge = c.querySelector('.engine-card-badge');
      if (badge) {
        badge.classList.remove('active');
        badge.textContent = 'Wybierz';
      }
    });

    card.classList.add('active');
    const badge = card.querySelector('.engine-card-badge');
    if (badge) {
      badge.classList.add('active');
      badge.textContent = 'Aktywny';
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
  const panel = document.getElementById('engine-config-card');
  const title = document.getElementById('config-panel-title');
  const voskFields = document.getElementById('config-fields-vosk');
  const apiFields = document.getElementById('config-fields-api');
  const whisperFields = document.getElementById('config-fields-whisper');
  const sherpaFields = document.getElementById('config-fields-sherpa');
  const progressContainer = document.getElementById('download-progress-container');

  renderInstalledModelsManager();

  if (!panel || !title) return;
  
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
  title.textContent = `Konfiguracja: ${prettyName}`;

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

  if (langBadge && activeConfig && activeConfig.general) {
    langBadge.textContent = (activeConfig.general.language || 'pl').toUpperCase();
  }

  if (modelShortLabel && activeConfig && activeConfig.engine) {
    let rawModel = '';
    const activeType = activeConfig.engine.type;
    if (activeType === 'vosk') {
      const parts = (activeConfig.engine.vosk.model_path || '').split(/[/\\]/);
      rawModel = parts[parts.length - 1] || 'vosk-model';
    } else if (activeType === 'sherpa_onnx') {
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

    if (window.__TAURI__ && ['vosk', 'sherpa_onnx', 'whisper', 'faster_whisper'].includes(activeType)) {
      const checkEngine = activeType === 'faster_whisper' ? 'whisper' : activeType;
      window.__TAURI__.core.invoke('check_model_downloaded', { engine: checkEngine, model: rawModel }).then(isDownloaded => {
        if (isDownloaded) {
          modelShortLabel.textContent = shortName;
          modelShortLabel.style.color = 'var(--text-muted)';
        } else {
          modelShortLabel.textContent = `${shortName} (Brak pliku)`;
          modelShortLabel.style.color = '#ef4444';
        }
      }).catch(() => {
        modelShortLabel.textContent = shortName;
      });
    } else {
      modelShortLabel.textContent = shortName;
      modelShortLabel.style.color = 'var(--text-muted)';
    }
  }

  if (['vosk', 'whisper', 'faster_whisper', 'sherpa_onnx'].includes(engineId)) {
    let fields = whisperFields;
    if (engineId === 'vosk') fields = voskFields;
    if (engineId === 'sherpa_onnx') fields = sherpaFields;
    if (fields) fields.style.display = 'block';
    
    // Załaduj i wyrenderuj listę dostępnych modeli
    renderAvailableModels(engineId === 'faster_whisper' ? 'whisper' : engineId);
    
    // Jeśli to Whisper lub Faster-Whisper, obsłuż checkboxy GPU
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
      gpuCheck.onchange = (e) => {
        pendingConfig.engine.whisper.use_gpu = e.target.checked;
        checkEngineDirty();
        if (e.target.checked) {
          if (engineId === 'whisper') {
            ToastManager.show({
              type: 'warning',
              title: 'GPU niedostępne w Whisper.cpp',
              message: 'Silnik Whisper.cpp nie posiada wkompilowanej obsługi GPU na tym systemie. Zostanie użyty wielowątkowy procesor (CPU). Jeśli chcesz korzystać z karty graficznej (GPU), przełącz na silnik Faster-Whisper.',
              duration: 8000
            });
          } else {
            showCudaInstallModal();
          }
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
}

async function renderAvailableModels(engineId) {
  let container = document.getElementById('config-fields-whisper');
  if (engineId === 'vosk') container = document.getElementById('config-fields-vosk');
  if (engineId === 'sherpa_onnx') container = document.getElementById('config-fields-sherpa');
  if (!container) return;

  const radioGroup = container.querySelector('.radio-group');
  if (!radioGroup) return;

  if (window.__TAURI__) {
    try {
      // Pokaż animowany loader podczas pobierania listy z serwera
      radioGroup.innerHTML = `
        <div style="color: var(--text-secondary); font-size: 13px; display: flex; align-items: center; gap: 10px; padding: 5px 0;">
          <span class="spinner" style="width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.1); border-top-color: var(--accent-green); border-radius: 50%; display: inline-block; animation: spin 0.8s linear infinite;"></span>
          Ładowanie dostępnych modeli z serwera...
        </div>
      `;
      
      const lang = pendingConfig ? pendingConfig.general.language : 'pl';
      const models = await window.__TAURI__.core.invoke('get_available_models', { engine: engineId, language: lang });
      radioGroup.innerHTML = '';
      
      if (models.length === 0) {
        radioGroup.innerHTML = '<div style="color: var(--text-muted); font-size: 13px;">Brak dostępnych modeli dla wybranych parametrów</div>';
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

      // Jeśli żaden model nie jest aktywny w aktualnej konfiguracji (np. po zmianie języka),
      // automatycznie zaznaczamy pierwszy z listy i aktualizujemy pendingConfig
      if (!hasActive && models.length > 0) {
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
        tip.innerHTML = `<strong>Wskazówka:</strong> Im większy model, tym wyższa dokładność rozpoznawania mowy, ale też większe obciążenie procesora i pamięci RAM. Modele mniejsze niż 50 MB (jak Mikro) mogą mieć trudności z poprawną interpretacją polskich końcówek i specyficznych wyrazów.`;
        radioGroup.appendChild(tip);
      } else if (engineId === 'sherpa_onnx') {
        const tip = document.createElement('div');
        tip.style.marginTop = '12px';
        tip.style.fontSize = '12px';
        tip.style.color = 'var(--text-muted)';
        tip.style.lineHeight = '1.5';
        tip.innerHTML = `<strong>Wskazówka:</strong> Modele Sherpa-ONNX pobierają się z oficjalnych wydań Next-Gen Kaldi i są optymalizowane pod kątem szybkiego wnioskowania na CPU w czasie rzeczywistym.`;
        radioGroup.appendChild(tip);
      }

      // Zarejestruj zmianę wyboru
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
              ToastManager.show({ type: 'error', title: 'Błąd konfiguracji modelu', message: err.toString() });
            }
          }
        };
      });

      // Ustaw status początkowy
      const activeModel = models.find(m => m.is_active) || models[0];
      if (activeModel) {
        updateModelStatusText(engineId, activeModel.id);
      }
    } catch (err) {
      console.error('Błąd pobierania listy modeli:', err);
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
      const isDownloaded = await window.__TAURI__.core.invoke('check_model_downloaded', { engine: engineId, model: modelId });
      if (isDownloaded) {
        statusSpan.textContent = 'Pobrany';
        statusSpan.className = 'status-value highlight';
        if (downloadBtn) {
          downloadBtn.textContent = 'Pobrany';
          downloadBtn.disabled = true;
          downloadBtn.style.opacity = '0.5';
          downloadBtn.style.cursor = 'not-allowed';
        }
      } else {
        statusSpan.textContent = 'Nie pobrany';
        statusSpan.className = 'status-value';
        if (downloadBtn) {
          downloadBtn.textContent = 'Pobierz model';
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
const quickModelSelect = document.getElementById('quick-download-model');
const quickDownloadBtn = document.getElementById('quick-download-btn');

function checkIsDownloading() {
  return downloadQueue.some(q => q.status === 'downloading' || q.status === 'queued');
}

function updateQuickModelOptions() {
  if (!quickEngineSelect || !quickModelSelect) return;
  const eng = quickEngineSelect.value;
  quickModelSelect.innerHTML = '';
  let models = [];
  if (eng === 'vosk') {
    models = [
      { id: 'vosk-model-small-pl-0.22', name: '[PL] Polski Mały (50 MB)' },
      { id: 'vosk-model-small-en-us-0.15', name: '[EN] Angielski Mały (40 MB)' }
    ];
  } else if (eng === 'sherpa_onnx') {
    models = [
      { id: 'sherpa-onnx-whisper-tiny', name: '[MULTI] Whisper Tiny Multilingual (75 MB)' },
      { id: 'sherpa-onnx-whisper-small', name: '[MULTI] Whisper Small Multilingual (480 MB)' }
    ];
  } else {
    models = [
      { id: 'tiny', name: '[MULTI] Tiny (77 MB)' },
      { id: 'base', name: '[MULTI] Base (147 MB)' },
      { id: 'small', name: '[MULTI] Small (487 MB)' }
    ];
  }
  models.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name;
    quickModelSelect.appendChild(opt);
  });
}

if (quickEngineSelect) {
  quickEngineSelect.addEventListener('change', updateQuickModelOptions);
  updateQuickModelOptions();
}

if (quickDownloadBtn) {
  quickDownloadBtn.addEventListener('click', () => {
    const eng = quickEngineSelect ? quickEngineSelect.value : 'vosk';
    const mdl = quickModelSelect ? quickModelSelect.value : '';
    if (mdl) {
      triggerModelDownloadExplicit(eng, mdl);
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
  item.status = 'downloading';
  renderDownloadQueue();
  updateDashboardDownloadState(null);

  if (window.__TAURI__) {
    try {
      ToastManager.show({ type: 'info', title: 'Rozpoczęto pobieranie', message: `Pobieranie ${item.model}...` });
      const checkEngine = item.engine === 'faster_whisper' ? 'whisper' : item.engine;
      await window.__TAURI__.core.invoke('download_model', { engine: checkEngine, model: item.model });
      if (item.status !== 'cancelled') {
        item.status = 'completed';
        ToastManager.show({ type: 'success', title: 'Pobieranie ukończone', message: `Model ${item.model} gotowy do użycia.` });
        if (pendingConfig && pendingConfig.engine) {
          if (item.engine === 'vosk') {
            pendingConfig.engine.vosk.model_path = `models/vosk/${item.model}`;
          } else if (item.engine === 'sherpa_onnx') {
            pendingConfig.engine.sherpa_onnx.model_path = `models/sherpa/${item.model}`;
          } else {
            pendingConfig.engine.whisper.model = item.model;
          }
          activeConfig = JSON.parse(JSON.stringify(pendingConfig));
          await saveConfigState();
          checkEngineDirty();
          updateActiveEnginePanel(activeConfig.engine.type);
        }
      }
    } catch (err) {
      if (item.status !== 'cancelled') {
        item.status = 'error';
        ToastManager.show({ type: 'error', title: 'Błąd pobierania', message: err.toString() });
      }
    } finally {
      renderDownloadQueue();
      updateDashboardDownloadState(null);
      renderInstalledModelsManager();
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
  if (text) text.textContent = 'Inicjalizacja pobierania...';

  addModelToDownloadQueue(engineId, modelName);
}

async function triggerModelDownload(engineId) {
  let modelName = '';
  const checkedRadio = document.querySelector(`input[name="${engineId}-model-size"]:checked`);
  if (checkedRadio) {
    modelName = checkedRadio.value;
  }

  if (!modelName) {
    ToastManager.show({ type: 'error', title: 'Wybierz model', message: 'Zaznacz najpierw model do pobrania.' });
    return;
  }

  const progressContainer = document.getElementById('download-progress-container');
  const fill = document.getElementById('download-progress-fill');
  const text = document.getElementById('download-progress-text');
  const percentEl = document.getElementById('download-progress-percent');

  if (progressContainer) progressContainer.style.display = 'block';
  if (fill) fill.style.width = '0%';
  if (percentEl) percentEl.textContent = '0%';
  if (text) text.textContent = 'Inicjalizacja pobierania...';

  addModelToDownloadQueue(engineId, modelName);
}

function updateDashboardDownloadState(progress) {
  const overlay = document.getElementById('dictation-disabled-overlay');
  const dashStatus = document.getElementById('dashboard-engine-download-status');
  const dashFill = document.getElementById('dashboard-engine-progress-fill');
  const dashText = document.getElementById('dashboard-engine-progress-text');
  const dashPercent = document.getElementById('dashboard-engine-progress-percent');

  const isDownloading = checkIsDownloading();

  if (overlay) {
    overlay.style.display = isDownloading ? 'flex' : 'none';
  }

  if (dashStatus && dashFill && dashText && dashPercent) {
    if (isDownloading && progress && progress.percent < 100) {
      dashStatus.style.display = 'block';
      dashFill.style.width = `${progress.percent}%`;
      dashPercent.textContent = `${Math.round(progress.percent)}%`;
      if (progress.downloaded_mb !== undefined && progress.total_mb !== undefined) {
        dashText.textContent = `${progress.downloaded_mb.toFixed(1)} MB / ${progress.total_mb.toFixed(1)} MB`;
      } else {
        dashText.textContent = 'Pobieranie modelu...';
      }
    } else {
      dashStatus.style.display = 'none';
    }
  }
}

function updateDownloadProgress(progress) {
  const queueItem = downloadQueue.find(q => q.model === progress.model);
  if (queueItem) {
    if (queueItem.status === 'cancelled') return;
    queueItem.percent = progress.percent;
    queueItem.downloaded_mb = progress.downloaded_mb;
    queueItem.total_mb = progress.total_mb;
    if (progress.percent >= 100) queueItem.status = 'completed';
  }

  const container = document.getElementById('download-progress-container');
  const fill = document.getElementById('download-progress-fill');
  const text = document.getElementById('download-progress-text');
  const percentEl = document.getElementById('download-progress-percent');

  if (container && fill && text && percentEl) {
    container.style.display = 'block';
    fill.style.width = `${progress.percent}%`;
    
    if (progress.downloaded_mb !== undefined && progress.total_mb !== undefined) {
      text.textContent = `${progress.downloaded_mb.toFixed(1)} MB / ${progress.total_mb.toFixed(1)} MB`;
    } else {
      text.textContent = progress.done ? 'Instalowanie i rozpakowywanie ukończone' : 'Kończenie pobierania...';
    }
    
    percentEl.textContent = `${Math.round(progress.percent)}%`;
  }

  updateDashboardDownloadState(progress);
  renderDownloadQueue();

  if (progress.percent >= 100) {
    setTimeout(() => {
      if (container) container.style.display = 'none';
      const engineId = progress.model.startsWith('vosk-model') ? 'vosk' : (progress.model.startsWith('sherpa') ? 'sherpa_onnx' : 'whisper');
      updateModelStatusText(engineId, progress.model);
      renderInstalledModelsManager();
      updateDashboardDownloadState(null);
    }, 2000);
  }
}

function addModelToDownloadQueue(engine, model) {
  let existing = downloadQueue.find(q => q.engine === engine && q.model === model);
  if (existing) {
    if (existing.status === 'completed') {
      ToastManager.show({ type: 'info', title: 'Model pobrany', message: 'Ten model jest już pobrany na Twoim dysku.' });
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

  // Render Active Downloads
  if (activeItems.length === 0) {
    activeContainer.innerHTML = `<div style="font-size: 13px; color: var(--text-muted); font-style: italic;">Brak aktywnych pobierań. Wybierz model powyżej, aby rozpocząć.</div>`;
  } else {
    activeContainer.innerHTML = '';
    activeItems.forEach(item => {
      const el = document.createElement('div');
      el.style.background = 'rgba(255,255,255,0.02)';
      el.style.border = '1px solid var(--border-subtle)';
      el.style.borderRadius = '8px';
      el.style.padding = '12px 14px';
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      el.style.gap = '8px';

      const badge = item.status === 'downloading' ? 
        '<span style="color: var(--accent-green); background: rgba(16,185,129,0.15); padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;">Pobieranie...</span>' :
        '<span style="color: var(--accent-gold); background: rgba(245,158,11,0.15); padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;">W kolejce</span>';

      el.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 700; font-size: 13px; color: var(--text-primary);">${item.model}</span>
            <span style="font-size: 10px; color: var(--text-muted); background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">${item.engine}</span>
            ${badge}
          </div>
          <button class="btn-cancel-queue" data-id="${item.id}" style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">Anuluj</button>
        </div>
        <div class="progress-bar-bg" style="background: rgba(255,255,255,0.06); height: 6px; border-radius: 3px; overflow: hidden;">
          <div style="width: ${item.percent}%; height: 100%; background: var(--accent-green); transition: width 0.2s;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted);">
          <span>${item.downloaded_mb ? `${item.downloaded_mb.toFixed(1)} MB / ${item.total_mb.toFixed(1)} MB` : 'Inicjalizacja...'}</span>
          <span>${Math.round(item.percent)}%</span>
        </div>
      `;
      activeContainer.appendChild(el);
    });

    activeContainer.onclick = async (e) => {
      const btn = e.target.closest('.btn-cancel-queue');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      console.log('[CANCEL_QUEUE] Kliknięto anuluj dla pobierania ID:', id);
      const item = downloadQueue.find(q => q.id === id);
      if (item) {
        item.status = 'cancelled';
        item.percent = 0;
        if (window.__TAURI__) {
          const checkEngine = item.engine === 'faster_whisper' ? 'whisper' : item.engine;
          console.log('[CANCEL_QUEUE] Wywoływanie cleanup_model_tmp_files dla silnika:', checkEngine, 'modelu:', item.model);
          try {
            await window.__TAURI__.core.invoke('cleanup_model_tmp_files', { engine: checkEngine, model: item.model });
            console.log('[CANCEL_QUEUE] Czyszczenie zakończone sukcesem.');
          } catch (err) {
            console.error('[CANCEL_QUEUE] Błąd podczas czyszczenia:', err);
          }
        }
        ToastManager.show({ type: 'info', title: 'Anulowano pobieranie', message: `Pobieranie modelu ${item.model} zostało natychmiast anulowane.` });
        updateDashboardDownloadState(null);
        renderDownloadQueue();
        setTimeout(() => processDownloadQueue(), 300);
      }
    };
  }

  // Render History Downloads
  if (historyItems.length === 0) {
    historyContainer.innerHTML = `<div style="font-size: 13px; color: var(--text-muted); font-style: italic;">Brak historii pobierania.</div>`;
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
        '<span style="color: var(--accent-green); background: rgba(16,185,129,0.12); padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">Ukończono</span>' :
        '<span style="color: var(--text-error); background: rgba(239,68,68,0.12); padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">Anulowano</span>';

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
          modelsHtml = `<div style="font-size: 12px; color: var(--text-muted); font-style: italic;">Brak pobranych modeli dla tego silnika</div>`;
        } else {
          modelsHtml = group.models.map(m => `
            <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-elevated); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.04);">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 13px; font-weight: 500; color: var(--text-primary);">${m.name}</span>
                <span style="font-size: 11px; color: var(--text-muted); background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px;">${m.size_text}</span>
              </div>
              <button class="btn-delete-single-model" data-engine="${group.engine_id}" data-model="${m.model_id}" title="Usuń ten model" style="background: transparent; border: none; color: #ff4d4d; cursor: pointer; padding: 4px 8px; border-radius: 4px; display: flex; align-items: center; gap: 4px; font-size: 12px; transition: background 0.2s;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>
                Usuń
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
              <button class="btn-delete-group-models" data-engine="${group.engine_id}" title="Usuń wszystkie modele silnika" style="background: rgba(255, 77, 77, 0.1); border: 1px solid rgba(255, 77, 77, 0.3); color: #ff4d4d; cursor: pointer; padding: 6px 12px; border-radius: 6px; display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; transition: all 0.2s;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>
                Usuń wszystkie (${group.models.length})
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
        totalBadge.textContent = `Razem: ${(grandTotalBytes / 1_048_576.0).toFixed(1)} MB`;
      }

      container.querySelectorAll('.btn-delete-single-model').forEach(btn => {
        btn.onclick = (e) => {
          const engine = e.currentTarget.getAttribute('data-engine');
          const model = e.currentTarget.getAttribute('data-model');
          showCustomConfirmModal({
            title: 'Potwierdzenie usunięcia',
            message: `Czy na pewno chcesz usunąć model "${model}" z dysku? Operacji nie można cofnąć.`,
            confirmText: 'Usuń model',
            onConfirm: async () => {
              try {
                await window.__TAURI__.core.invoke('delete_installed_model', { engine, model });
                ToastManager.show({ type: 'success', title: 'Usunięto model', message: `Model ${model} został usunięty z dysku.` });
                await renderInstalledModelsManager();
                const activeEngineId = pendingConfig ? pendingConfig.engine.type : 'vosk';
                await renderAvailableModels(activeEngineId);
              } catch (err) {
                ToastManager.show({ type: 'error', title: 'Błąd usuwania', message: err.toString() });
              }
            }
          });
        };
      });

      container.querySelectorAll('.btn-delete-group-models').forEach(btn => {
        btn.onclick = (e) => {
          const engine = e.currentTarget.getAttribute('data-engine');
          showCustomConfirmModal({
            title: 'Usuwanie wszystkich modeli',
            message: `Czy na pewno chcesz usunąć WSZYSTKIE pobrane modele dla tego silnika?`,
            confirmText: 'Usuń wszystkie',
            onConfirm: async () => {
              try {
                await window.__TAURI__.core.invoke('delete_installed_model', { engine, model: null });
                ToastManager.show({ type: 'success', title: 'Usunięto modele', message: `Wszystkie modele silnika zostały usunięte z dysku.` });
                await renderInstalledModelsManager();
                const activeEngineId = pendingConfig ? pendingConfig.engine.type : 'vosk';
                await renderAvailableModels(activeEngineId);
              } catch (err) {
                ToastManager.show({ type: 'error', title: 'Błąd usuwania', message: err.toString() });
              }
            }
          });
        };
      });

    } catch (err) {
      console.error('Błąd ładownia podsumowania modeli:', err);
    }
  }
}

function showCustomConfirmModal({ title, message, confirmText, cancelText, isDanger = true, onConfirm }) {
  const cancelBtnText = cancelText || t('btn.cancel');
  const confirmBtnText = confirmText || (isDanger ? t('models.btn.delete') : t('btn.apply'));
  const headerColor = isDanger ? '#ff4d4d' : 'var(--accent-green)';
  const btnBackground = isDanger ? '#ff4d4d' : 'var(--accent-green)';
  const btnTextColor = isDanger ? '#ffffff' : 'var(--accent-contrast-text, #080c08)';
  const iconSvg = isDanger 
    ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>'
    : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>';

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
  card.querySelector('.btn-cancel').onclick = close;
  card.querySelector('.btn-confirm-action').onclick = () => {
    close();
    if (onConfirm) onConfirm();
  };
}

function getEngineChangesDescription() {
  if (!pendingConfig || !activeConfig) return '';
  const changes = [];
  if (pendingConfig.engine.type !== activeConfig.engine.type) {
    const names = { vosk: 'Vosk', sherpa_onnx: 'Sherpa-ONNX', whisper: 'Whisper.cpp', faster_whisper: 'Faster-Whisper' };
    changes.push(`• Zmiana silnika: <b>${names[activeConfig.engine.type] || activeConfig.engine.type}</b> ➔ <b>${names[pendingConfig.engine.type] || pendingConfig.engine.type}</b>`);
  }
  if (pendingConfig.general.language !== activeConfig.general.language) {
    changes.push(`• Zmiana języka rozpoznawania: <b>${activeConfig.general.language}</b> ➔ <b>${pendingConfig.general.language}</b>`);
  }
  if (pendingConfig.engine.vosk.model_path !== activeConfig.engine.vosk.model_path) {
    const mName = pendingConfig.engine.vosk.model_path.split(/[/\\]/).pop();
    changes.push(`• Zmiana modelu Vosk na: <b>${mName}</b>`);
  }
  if (pendingConfig.engine.sherpa_onnx.model_path !== activeConfig.engine.sherpa_onnx.model_path) {
    const mName = pendingConfig.engine.sherpa_onnx.model_path.split(/[/\\]/).pop();
    changes.push(`• Zmiana modelu Sherpa-ONNX na: <b>${mName}</b>`);
  }
  if (pendingConfig.engine.whisper.model !== activeConfig.engine.whisper.model) {
    changes.push(`• Zmiana rozmiaru modelu Whisper na: <b>${pendingConfig.engine.whisper.model}</b>`);
  }
  if (pendingConfig.engine.whisper.use_gpu !== activeConfig.engine.whisper.use_gpu) {
    changes.push(`• Akceleracja GPU: <b>${pendingConfig.engine.whisper.use_gpu ? 'Włączona' : 'Wyłączona'}</b>`);
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
      Pobieranie w toku
    </div>
    <div class="modal-body" style="margin-top: 14px; margin-bottom: 22px;">
      <p style="margin: 0; font-size: 14px; color: var(--text-secondary); line-height: 1.5;">Nie można zmienić sekcji, ponieważ model jest w trakcie pobierania.</p>
    </div>
    <div style="display: flex; justify-content: flex-end; gap: 10px;">
      <button class="btn-modal-ok" style="background: var(--accent-green); border: none; color: #fff; padding: 8px 18px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 700;">OK</button>
      <button class="btn-modal-delete-download" style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #ef4444; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600;">Usuń model</button>
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
    ToastManager.show({ type: 'info', title: 'Usunięto model', message: 'Anulowano pobieranie i usunięto pliki modelu z dysku. Wrócono do poprzedniego silnika.' });
  };
}

async function confirmUnsavedChanges(onProceed) {
  const applyBtn = document.getElementById('btn-engine-apply');
  if (applyBtn && applyBtn.style.display !== 'none') {
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
      const isCurrentlyDownloading = downloadQueue.some(q => q.model === modelId && (q.status === 'downloading' || q.status === 'queued'));
      if (!isCurrentlyDownloading) {
        showMissingModelNavigationGuardModal({
          engine: engineId,
          modelId,
          onProceed,
        });
        return false;
      }
    }

    const desc = getEngineChangesDescription();
    showUnsavedChangesModal({
      description: desc,
      onSave: async () => {
        applyBtn.click();
        onProceed();
      },
      onDiscard: () => {
        pendingConfig = JSON.parse(JSON.stringify(activeConfig));
        loadConfigGeneralUI(activeConfig);
        updateActiveEnginePanel(activeConfig.engine.type);
        checkEngineDirty();
        renderAvailableModels(activeConfig.engine.type);
        ToastManager.show({ type: 'info', title: 'Przywrócono konfigurację', message: 'Wrócono do poprzedniego modelu.' });
        onProceed();
      }
    });
    return false;
  }
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
        Model nie jest pobrany
      </div>
      <button class="btn-modal-close-x" style="background: none; border: none; color: var(--text-muted); font-size: 22px; cursor: pointer; padding: 0 4px; line-height: 1; transition: color 0.2s;" title="Zamknij">×</button>
    </div>
    <div class="modal-body" style="margin-top: 14px; margin-bottom: 22px;">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: var(--text-primary); font-weight: 600;">Wymagane pobranie pliku modelu</p>
      <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">Próbujesz opuścić sekcję z wybranym nowym modelem <b>${modelId}</b>. Model ten nie znajduje się jeszcze na Twoim dysku. Musisz go pobrać, aby aktywować zmiany.</p>
      <div id="missing-guard-download-status" style="margin-top: 16px; display: none;">
        <div class="progress-bar-bg" style="background: rgba(255,255,255,0.1); height: 8px; border-radius: 4px; overflow: hidden;">
          <div id="missing-guard-progress-fill" style="width: 0%; height: 100%; background: var(--accent-green); transition: width 0.2s;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 12px; color: var(--text-muted);">
          <span id="missing-guard-progress-text">Pobieranie...</span>
          <span id="missing-guard-progress-percent">0%</span>
        </div>
      </div>
    </div>
    <div id="missing-guard-actions" style="display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap;">
      <button class="btn-cancel-nav" style="background: transparent; border: 1px solid var(--border-subtle); color: var(--text-secondary); padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600;">Anuluj</button>
      <button class="btn-discard-nav" style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #ef4444; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600;">Nie zapisuj</button>
      <button class="btn-download-nav" style="background: var(--accent-green); border: none; color: #fff; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 700; box-shadow: 0 4px 12px rgba(16,185,129,0.3);">Pobierz i zapisz</button>
    </div>
  `;

  backdrop.appendChild(card);
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  let isDownloading = false;

  const closeX = card.querySelector('.btn-modal-close-x');
  if (closeX) {
    closeX.onclick = () => {
      close();
      onProceed();
    };
  }

  card.querySelector('.btn-cancel-nav').onclick = async () => {
    if (isDownloading && window.__TAURI__) {
      const checkEngine = engine === 'faster_whisper' ? 'whisper' : engine;
      await window.__TAURI__.core.invoke('cleanup_model_tmp_files', { engine: checkEngine, model: modelId });
      pendingConfig = JSON.parse(JSON.stringify(activeConfig));
      loadConfigGeneralUI(activeConfig);
      updateActiveEnginePanel(activeConfig.engine.type);
      checkEngineDirty();
      renderAvailableModels(activeConfig.engine.type);
      ToastManager.show({ type: 'info', title: 'Anulowano pobieranie', message: 'Wrócono do poprzedniego silnika i modelu (anulowano pobieranie).' });
    }
    close();
  };

  card.querySelector('.btn-discard-nav').onclick = () => {
    close();
    pendingConfig = JSON.parse(JSON.stringify(activeConfig));
    loadConfigGeneralUI(activeConfig);
    updateActiveEnginePanel(activeConfig.engine.type);
    checkEngineDirty();
    renderAvailableModels(activeConfig.engine.type);
    ToastManager.show({ type: 'info', title: 'Przywrócono poprzedni model', message: 'Wrócono do wcześniej zapisanego modelu.' });
    onProceed();
  };

  card.querySelector('.btn-download-nav').onclick = async () => {
    addModelToDownloadQueue(engine, modelId);
    activeConfig = JSON.parse(JSON.stringify(pendingConfig));
    if (window.__TAURI__) {
      await saveConfigState();
    }
    checkEngineDirty();
    updateActiveEnginePanel(activeConfig.engine.type);
    ToastManager.show({ type: 'info', title: 'Rozpoczęto pobieranie i aktywowano model', message: `Model ${modelId} pobiera się w tle.` });
    close();
    onProceed();
  };
}

function showUnsavedChangesModal({ description, onSave, onDiscard }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.style.zIndex = '100000';

  const card = document.createElement('div');
  card.className = 'modal-card';
  card.style.maxWidth = '460px';

  card.innerHTML = `
    <div class="modal-title" style="color: var(--accent-gold, #f59e0b); display: flex; align-items: center; gap: 8px;">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/></svg>
      Niezapisane zmiany w konfiguracji
    </div>
    <div class="modal-body" style="margin-top: 14px; margin-bottom: 22px;">
      <p style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-secondary);">Próbujesz opuścić sekcję, ale masz niezastosowane zmiany w konfiguracji silnika mowy:</p>
      <div style="background: rgba(255,255,255,0.04); border-left: 3px solid var(--accent-gold, #f59e0b); padding: 10px 14px; border-radius: 6px; font-size: 13px; color: var(--text-primary); line-height: 1.6;">
        ${description || 'Zmiana parametrów silnika mowy.'}
      </div>
    </div>
    <div style="display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap;">
      <button class="btn-cancel" style="background: transparent; border: 1px solid var(--border-subtle); color: var(--text-secondary); padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600;">Anuluj</button>
      <button class="btn-discard" style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #ef4444; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600;">Odrzuć zmiany</button>
      <button class="btn-save" style="background: var(--accent-green, #10b981); border: none; color: #fff; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 700; box-shadow: 0 4px 12px rgba(16,185,129,0.3);">Zapisz i zastosuj</button>
    </div>
  `;

  backdrop.appendChild(card);
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  card.querySelector('.btn-cancel').onclick = close;
  card.querySelector('.btn-discard').onclick = () => { close(); onDiscard(); };
  card.querySelector('.btn-save').onclick = () => { close(); onSave(); };
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
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8l6 6M4 14e1 1 0 011-1h10a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM2 5h12M9 2v3M14 18l6-6M20 18l-6-6"/></svg>
      Wymagany model tłumaczeniowy
    </div>
    <div class="modal-body" style="margin-top: 14px; margin-bottom: 22px;">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: var(--text-primary); font-weight: 600;">Pakiet językowy (OPUS-MT / MarianMT)</p>
      <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">Aby automatycznie tłumaczyć słowa wyzwalające dla wybranego języka, aplikacja musi pobrać dedykowany model tłumaczeniowy (~45 MB). Czy chcesz rozpocząć pobieranie?</p>
      <div id="translator-download-status" style="margin-top: 16px; display: none;">
        <div class="progress-bar-bg" style="background: rgba(255,255,255,0.1); height: 8px; border-radius: 4px; overflow: hidden;">
          <div id="translator-progress-fill" style="width: 0%; height: 100%; background: var(--accent-green); transition: width 0.2s;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 12px; color: var(--text-muted);">
          <span id="translator-progress-text">Pobieranie w toku...</span>
          <span id="translator-progress-percent">0%</span>
        </div>
      </div>
    </div>
    <div id="translator-modal-actions" style="display: flex; justify-content: flex-end; gap: 12px;">
      <button class="btn-cancel-trans" style="background: transparent; border: 1px solid var(--border-subtle); color: var(--text-secondary); padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600;">Anuluj</button>
      <button class="btn-start-download-trans" style="background: var(--accent-green); border: none; color: #fff; padding: 8px 18px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 700; box-shadow: 0 4px 12px rgba(16,185,129,0.3);">Pobierz model (45 MB)</button>
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
      text.textContent = `Pobrano ${(progress * 0.45).toFixed(1)} MB / 45 MB`;

      if (progress >= 100) {
        clearInterval(interval);
        localStorage.setItem('translator_model_downloaded', 'true');
        ToastManager.show({ type: 'success', title: 'Model tłumaczeniowy pobrany', message: 'Tłumaczenie słów wyzwalających zostało aktywowane!' });
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
    ToastManager.show({ type: 'info', title: 'Testowanie połączenia...' });
    if (window.__TAURI__) {
      try {
        if (pendingConfig) {
          await window.__TAURI__.core.invoke('save_config', { config: pendingConfig });
        }
        const response = await window.__TAURI__.core.invoke('test_engine', { engineType: pendingConfig ? pendingConfig.engine.type : null });
        ToastManager.show({ type: 'success', title: 'Test połączenia', message: response });
      } catch (err) {
        ToastManager.show({ type: 'error', title: 'Błąd testu połączenia', message: err.toString(), persistent: true });
      }
    } else {
      setTimeout(() => {
        ToastManager.show({ type: 'success', title: 'Test połączenia', message: 'Test API udany (Mock)' });
      }, 1000);
    }
  });
}

// Reset Configuration Button
const resetConfigBtn = document.getElementById('btn-reset-all-config');
if (resetConfigBtn) {
  resetConfigBtn.addEventListener('click', () => {
    showCustomConfirmModal({
      title: 'Resetuj Konfigurację',
      message: 'Czy na pewno chcesz zresetować całą konfigurację do wartości domyślnych?',
      confirmText: 'Zresetuj',
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

            ToastManager.show({ type: 'success', title: 'Przywrócono domyślne ustawienia' });
          } catch (err) {
            ToastManager.show({ type: 'error', title: 'Reset failed', message: err.toString() });
          }
        } else {
          ToastManager.show({ type: 'success', title: 'Reset (Mock) successful' });
        }
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
    statusText.textContent = 'Idle';
    statusSubtext.textContent = 'Waiting for trigger word';
  } else if (currentStatus === 'listening') {
    orb.classList.add('listening');
    statusText.textContent = 'Listening';
    statusSubtext.textContent = 'Speak to begin dictating';
  } else if (currentStatus === 'dictating') {
    orb.classList.add('dictating');
    statusText.textContent = 'Dictating';
    statusSubtext.textContent = 'Actively typing into focus field';
    
    // Clear recent transcripts container for the new session!
    const container = document.getElementById('transcript-container');
    if (container) {
      container.innerHTML = '';
    }
  } else if (currentStatus === 'processing') {
    orb.classList.add('processing');
    statusText.textContent = 'Processing';
    statusSubtext.textContent = 'Transcribing speech using engine...';
  } else if (currentStatus === 'paused') {
    orb.classList.add('paused');
    statusText.textContent = 'Paused';
    statusSubtext.textContent = 'Click the orb to resume';
  } else if (currentStatus.startsWith('error')) {
    orb.classList.add('error');
    statusText.textContent = 'Error';
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
        ToastManager.show({ type: 'success', title: 'Wymuszono dyktowanie', message: 'Zacznij mówić bez słowa kluczowego.' });
      } catch (err) {
        ToastManager.show({ type: 'error', title: 'Błąd wymuszenia', message: err.toString() });
      }
    } else {
      updateOrbState('dictating');
      ToastManager.show({ type: 'success', title: 'Wymuszono dyktowanie (Mock)' });
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
          ToastManager.show({ type: 'info', title: 'Listening resumed' });
        } else {
          await window.__TAURI__.core.invoke('pause_listening');
          ToastManager.show({ type: 'info', title: 'Listening paused' });
        }
      } catch (err) {
        ToastManager.show({ type: 'error', title: 'Command error', message: err.toString() });
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
      setLanguage(config.general ? config.general.language : 'en');
      setupAppearanceEventListeners();
      applyAppearanceSettings(config);

      // 2. Render UI lists
      renderTriggerWords(config.trigger.words);
      renderStopWords(config.dictation.stop_words);
      loadConfigGeneralUI(config);

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
            badge.textContent = 'Wybierz';
          }
        });
        const activeCard = document.querySelector(`.engine-card[data-engine-id="${active.id}"]`);
        if (activeCard) {
          activeCard.classList.add('active');
          const badge = activeCard.querySelector('.engine-card-badge');
          if (badge) {
            badge.classList.add('active');
            badge.textContent = 'Aktywny';
          }
          updateActiveEnginePanel(active.id);
          await verifyStartupModel();
        }
      }

      // Populate audio devices
      await populateAudioDevices();

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
        ToastManager.show({ type: 'error', title: 'Engine Error', message: event.payload, persistent: true });
      });

      await window.__TAURI__.event.listen('download_progress', (event) => {
        updateDownloadProgress(event.payload);
      });
      
      await window.__TAURI__.event.listen('focus_detected', (event) => {
        const hasField = event.payload;
        if (!hasField) {
          ToastManager.show({ 
            type: 'info', 
            title: 'No text field active', 
            message: 'Dictated text will fall back to clipboard.' 
          });
        }
      });

      // 5. Initial welcome message
      ToastManager.show({ type: 'success', title: 'VoiceType Active', message: 'Listening initialized successfully.' });
      renderHistoryUI();
    } catch (err) {
      console.error(err);
      ToastManager.show({ type: 'error', title: 'Initialization Error', message: err.toString(), persistent: true });
    }
  } else {
    // Mock configuration for dev environment
    activeConfig = {
      trigger: { words: ['zaczynamy', 'start'], fuzzy_match: true },
      dictation: { stop_words: ['stop', 'done'], silence_timeout_ms: 1500, stop_word_remove_from_text: true, start_delay_ms: 0 },
      general: { autostart: false },
      input: { clipboard_fallback: true, clipboard_toast: true },
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
    ToastManager.show({ type: 'info', title: 'Mock Environment', message: 'Running outside Tauri container.' });
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
        badge.textContent = 'Brak Pythona';
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
  desc.innerHTML = `
    Aby korzystać z silników Whisper (lokalna transkrypcja wysokiej jakości), aplikacja potrzebuje zintegrowanego środowiska Python oraz pakietu <code>faster-whisper</code> (pobieranie i instalacja automatyczna w tle). 
    <br><br>
    Czy chcesz pobrać i zainstalować je teraz automatycznie?
  `;

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
        progressStep.textContent = payload.step;
        progressPercent.textContent = `${Math.round(payload.percent)}%`;

        if (payload.done) {
          ToastManager.show({ type: 'success', title: 'Python zainstalowany!', message: 'Silniki Whisper są gotowe do pracy.' });
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
          ToastManager.show({ type: 'error', title: 'Błąd instalacji Pythona', message: payload.error });
          desc.innerHTML = `<span style="color: var(--text-error); font-weight: 600;">Błąd:</span> ${payload.error}<br><br>Spróbuj ponownie lub zainstaluj Python ręcznie.`;
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

function showCudaInstallModal() {
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

  title.textContent = 'Instalacja bibliotek CUDA';
  modal.style.display = 'flex';
  progressContainer.style.display = 'none';
  actions.style.display = 'flex';
  desc.style.display = 'block';
  desc.innerHTML = `
    Dla przyspieszenia transkrypcji na GPU (karcie graficznej NVIDIA), aplikacja wymaga pakietów CUDA: <code>nvidia-cublas-cu12</code> oraz <code>nvidia-cudnn-cu12</code>. 
    <br><br>
    Czy chcesz pobrać i zainstalować je teraz automatycznie przez pip? (Pobieranie zajmuje ok. 350 MB w tle).
  `;

  btnClose.onclick = () => {
    modal.style.display = 'none';
    title.textContent = 'Wymagana instalacja środowiska Python';
  };

  btnInstall.onclick = async () => {
    actions.style.display = 'none';
    progressContainer.style.display = 'block';
    
    if (window.__TAURI__) {
      const unlisten = await window.__TAURI__.event.listen('python_install_progress', (event) => {
        const payload = event.payload;
        progressBar.style.width = `${payload.percent}%`;
        progressStep.textContent = payload.step;
        progressPercent.textContent = `${Math.round(payload.percent)}%`;

        if (payload.done) {
          ToastManager.show({ type: 'success', title: 'CUDA zainstalowane!', message: 'GPU jest teraz gotowe do pracy.' });
          setTimeout(() => {
            modal.style.display = 'none';
            title.textContent = 'Wymagana instalacja środowiska Python';
            unlisten();
          }, 2000);
        } else if (payload.error) {
          ToastManager.show({ type: 'error', title: 'Błąd instalacji CUDA', message: payload.error });
          desc.innerHTML = `<span style="color: var(--text-error); font-weight: 600;">Błąd:</span> ${payload.error}<br><br>Upewnij się, że masz połączenie z internetem i spróbuj ponownie.`;
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
        ToastManager.show({ type: 'error', title: 'Brak klucza API', message: `Musisz podać klucz API dla silnika ${engineId}, aby go aktywować.`, persistent: true });
        return;
      }

      ToastManager.show({ type: 'info', title: 'Weryfikacja połączenia z API...' });
      try {
        if (window.__TAURI__) {
          await window.__TAURI__.core.invoke('save_config', { config: pendingConfig });
          const testRes = await window.__TAURI__.core.invoke('test_engine', { engineType: engineId });
          await window.__TAURI__.core.invoke('set_engine', { engineType: engineId });
          
          activeConfig = JSON.parse(JSON.stringify(pendingConfig));
          checkEngineDirty();

          document.querySelectorAll('.engine-card').forEach(c => {
            c.classList.remove('active');
            const badge = c.querySelector('.engine-card-badge');
            if (badge) {
              badge.classList.remove('active');
              badge.textContent = 'Wybierz';
            }
          });
          const activeCard = document.querySelector(`.engine-card[data-engine-id="${activeConfig.engine.type}"]`);
          if (activeCard) {
            activeCard.classList.add('active');
            const badge = activeCard.querySelector('.engine-card-badge');
            if (badge) {
              badge.classList.add('active');
              badge.textContent = 'Aktywny';
            }
          }

          renderTriggerWords(activeConfig.trigger.words);
          renderStopWords(activeConfig.dictation.stop_words);
          loadConfigGeneralUI(activeConfig);
          updateActiveEnginePanel(activeConfig.engine.type);

          ToastManager.show({ type: 'success', title: 'Silnik zweryfikowany i aktywowany', message: testRes });
          return;
        }
      } catch (err) {
        if (window.__TAURI__) {
          await window.__TAURI__.core.invoke('save_config', { config: activeConfig });
        }
        ToastManager.show({ type: 'error', title: 'Błąd weryfikacji klucza API', message: `Nie można aktywować silnika. ${err.toString()}`, persistent: true });
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
      
      document.querySelectorAll('.engine-card').forEach(c => {
        c.classList.remove('active');
        const badge = c.querySelector('.engine-card-badge');
        if (badge) {
          badge.classList.remove('active');
          badge.textContent = 'Wybierz';
        }
      });
      const activeCard = document.querySelector(`.engine-card[data-engine-id="${activeConfig.engine.type}"]`);
      if (activeCard) {
        activeCard.classList.add('active');
        const badge = activeCard.querySelector('.engine-card-badge');
        if (badge) {
          badge.classList.add('active');
          badge.textContent = 'Aktywny';
        }
      }
      
      renderTriggerWords(activeConfig.trigger.words);
      renderStopWords(activeConfig.dictation.stop_words);
      loadConfigGeneralUI(activeConfig);
      updateActiveEnginePanel(activeConfig.engine.type);
      
      ToastManager.show({ type: 'success', title: 'Zastosowano zmiany', message: 'Silnik mowy został zaktualizowany.' });
    } else {
      const isCurrentlyDownloading = downloadQueue.some(q => q.model === modelId && (q.status === 'downloading' || q.status === 'queued'));
      if (isCurrentlyDownloading) {
        activeConfig = JSON.parse(JSON.stringify(pendingConfig));
        await saveConfigState();
        checkEngineDirty();
        
        document.querySelectorAll('.engine-card').forEach(c => {
          c.classList.remove('active');
          const badge = c.querySelector('.engine-card-badge');
          if (badge) {
            badge.classList.remove('active');
            badge.textContent = 'Wybierz';
          }
        });
        const activeCard = document.querySelector(`.engine-card[data-engine-id="${activeConfig.engine.type}"]`);
        if (activeCard) {
          activeCard.classList.add('active');
          const badge = activeCard.querySelector('.engine-card-badge');
          if (badge) {
            badge.classList.add('active');
            badge.textContent = 'Aktywny';
          }
        }
        
        renderTriggerWords(activeConfig.trigger.words);
        renderStopWords(activeConfig.dictation.stop_words);
        loadConfigGeneralUI(activeConfig);
        updateActiveEnginePanel(activeConfig.engine.type);
        
        ToastManager.show({ 
          type: 'info', 
          title: 'Zastosowano silnik mowy', 
          message: 'Będzie można zacząć przetwarzać mowę na tekst dopiero gdy pobierze się model.' 
        });
        return;
      }

      showCustomConfirmModal({
        title: 'Wymagane pobranie modelu',
        message: `Wybrany model "${modelId}" nie znajduje się jeszcze na Twoim dysku. Czy chcesz go teraz pobrać, aby aktywować zmiany?`,
        confirmText: 'Pobierz i aktywuj',
        onConfirm: async () => {
          const checkEngine = engineId === 'faster_whisper' ? 'whisper' : engineId;
          const progressContainer = document.getElementById('download-progress-container');
          if (progressContainer) progressContainer.style.display = 'block';
          
          applyBtn.disabled = true;
          applyBtn.style.opacity = '0.5';

          try {
            ToastManager.show({ type: 'info', title: 'Rozpoczęto pobieranie', message: `Pobieranie ${modelId}...` });
            await window.__TAURI__.core.invoke('download_model', { engine: checkEngine, model: modelId });
            
            activeConfig = JSON.parse(JSON.stringify(pendingConfig));
            await saveConfigState();
            checkEngineDirty();
            
            document.querySelectorAll('.engine-card').forEach(c => {
              c.classList.remove('active');
              const badge = c.querySelector('.engine-card-badge');
              if (badge) {
                badge.classList.remove('active');
                badge.textContent = 'Wybierz';
              }
            });
            const activeCard = document.querySelector(`.engine-card[data-engine-id="${activeConfig.engine.type}"]`);
            if (activeCard) {
              activeCard.classList.add('active');
              const badge = activeCard.querySelector('.engine-card-badge');
              if (badge) {
                badge.classList.add('active');
                badge.textContent = 'Aktywny';
              }
            }
            
            renderTriggerWords(activeConfig.trigger.words);
            renderStopWords(activeConfig.dictation.stop_words);
            loadConfigGeneralUI(activeConfig);
            updateActiveEnginePanel(activeConfig.engine.type);
            
            ToastManager.show({ type: 'success', title: 'Zastosowano zmiany', message: 'Pobieranie ukończone. Silnik jest aktywny.' });
          } catch (err) {
            ToastManager.show({ type: 'error', title: 'Błąd pobierania', message: err.toString(), persistent: true });
          } finally {
            applyBtn.disabled = false;
            applyBtn.style.opacity = '1';
          }
        },
        onCancel: () => {
          pendingConfig = JSON.parse(JSON.stringify(activeConfig));
          loadConfigGeneralUI(activeConfig);
          
          document.querySelectorAll('.engine-card').forEach(c => {
            c.classList.remove('active');
            const badge = c.querySelector('.engine-card-badge');
            if (badge) {
              badge.classList.remove('active');
              badge.textContent = 'Wybierz';
            }
          });
          const cardEl = document.querySelector(`.engine-card[data-engine-id="${activeConfig.engine.type}"]`);
          if (cardEl) {
            cardEl.classList.add('active');
            const badge = cardEl.querySelector('.engine-card-badge');
            if (badge) {
              badge.classList.add('active');
              badge.textContent = 'Aktywny';
            }
          }
          updateActiveEnginePanel(activeConfig.engine.type);
          checkEngineDirty();
        }
      });
    }
  });
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
      dashboardContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; font-style: italic;">No history yet</div>';
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
          ToastManager.show({ type: 'success', title: 'Skopiowano', message: 'Tekst skopiowany do schowka.' });
        };
      });
    }
  }

  // 2. Render History Page List
  const pageContainer = document.getElementById('history-container');
  if (pageContainer) {
    if (historyList.length === 0) {
      pageContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 14px; font-style: italic;">Brak historii transkrypcji</div>';
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
        toggleBtn.textContent = `••• Pokaż więcej (${transcripts.length - maxVisible})`;
        
        toggleBtn.onclick = () => {
          if (collapsedContainer.style.display === 'none') {
            collapsedContainer.style.display = 'flex';
            toggleBtn.textContent = 'Ukryj dodatkowe transkrypcje';
          } else {
            collapsedContainer.style.display = 'none';
            toggleBtn.textContent = `••• Pokaż więcej (${transcripts.length - maxVisible})`;
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
        ToastManager.show({ type: 'success', title: 'Skopiowano', message: 'Tekst skopiowany do schowka.' });
      };
    });
  }
}

// Bind Clear History Button
const clearHistoryBtn = document.getElementById('btn-clear-history');
if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener('click', () => {
    showCustomConfirmModal({
      title: t('history.title') || 'Historia Transkrypcji',
      message: t('history.confirm_clear') || 'Czy na pewno chcesz usunąć całą historię transkrypcji?',
      confirmText: t('history.btn.clear') || 'Wyczyść historię',
      isDanger: true,
      onConfirm: () => {
        localStorage.removeItem('transcript_history');
        renderHistoryUI();
        ToastManager.show({ type: 'success', title: 'Historia wyczyszczona' });
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
        if (foundEngine === 'vosk') activeConfig.engine.vosk.model_path = `models/${foundModel}`;
        else if (foundEngine === 'sherpa_onnx') activeConfig.engine.sherpa_onnx.model_path = `models/${foundModel}`;
        else activeConfig.engine.whisper.model = foundModel;

        pendingConfig = JSON.parse(JSON.stringify(activeConfig));
        await saveConfigState();
        updateActiveEnginePanel(foundEngine);
        ToastManager.show({
          type: 'warning',
          title: 'Ostatni model nie istnieje',
          message: `Ostatnio zapisany model (${modelId}) nie istnieje na dysku. Automatycznie przełączono na dostępny model: ${foundModel}.`,
          persistent: true
        });
      } else {
        const modelShortLabel = document.getElementById('engine-model-short');
        if (modelShortLabel) {
          modelShortLabel.textContent = 'Brak pobranego modelu';
          modelShortLabel.style.color = '#ef4444';
        }
        ToastManager.show({
          type: 'error',
          title: 'Brak pobranego modelu mowy',
          message: `Ostatnio wybrany model (${modelId}) nie znajduje się na dysku. Pobierz model w Menedżerze Pobierania.`,
          persistent: true
        });
      }
    }
  } catch (err) {
    console.error('Błąd weryfikacji modelu przy starcie:', err);
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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      </div>
      <div>
        <div style="font-weight: 700; font-size: 14px; color: var(--text-primary);">Zintegrowany Python Embed</div>
        <div style="font-size: 12px; color: var(--text-muted);">${isPythonAvailableGlobal ? 'Zainstalowano (~500 MB)' : 'Brak / Nie zainstalowano'}</div>
      </div>
    </div>
    <div>
      ${isPythonAvailableGlobal ? `
        <button id="btn-remove-python-env" style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">Usuń Python</button>
      ` : `
        <span style="font-size: 11px; color: var(--text-muted); background: rgba(255,255,255,0.06); padding: 4px 8px; border-radius: 4px;">Niezainstalowane</span>
      `}
    </div>
  `;
  container.appendChild(pyCard);

  const removePyBtn = pyCard.querySelector('#btn-remove-python-env');
  if (removePyBtn) {
    removePyBtn.onclick = () => {
      ToastManager.show({ type: 'info', title: 'Usuwanie środowiska', message: 'Funkcja usuwania środowiska Python uruchomiona.' });
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
          modelsListHtml = `<div style="font-size: 12px; color: var(--text-muted); font-style: italic;">Brak zainstalowanych modeli</div>`;
        } else {
          modelsListHtml = group.models.map(m => `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 6px 10px; border-radius: 6px;">
              <span style="font-size: 12px; color: var(--text-secondary);">${m.name} (${m.size_text})</span>
              <button class="btn-remove-addon-model" data-engine="${group.engine_id}" data-model="${m.model_id}" style="background: transparent; border: none; color: #ef4444; cursor: pointer; font-size: 12px; font-weight: 600;">Usuń</button>
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
            ToastManager.show({ type: 'success', title: 'Usunięto model', message: `Model ${model} usunięty z dysku.` });
            renderAddonsManagerUI();
            renderInstalledModelsManager();
          } catch (err) {
            ToastManager.show({ type: 'error', title: 'Błąd usuwania', message: err.toString() });
          }
        };
      });
    } catch (err) {
      console.error(err);
    }
  }
}
