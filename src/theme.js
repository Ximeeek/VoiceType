/**
 * Module: Appearance & Theme Manager
 * Single Responsibility: Processes theme configurations (cyberpunk presets, custom accents),
 * computes color contrasts, applies CSS variables to the document root, and manages UI theme settings.
 */

import { state, debouncedSaveConfig, saveConfigState } from './state.js';

export const ACCENT_PRESETS = {
  neon: { main: '#39ff50', sec: '#e0147a', dim: 'rgba(57,255,80,0.12)', border: 'rgba(57,255,80,0.25)' },
  electric: { main: '#00d4ff', sec: '#7b2fff', dim: 'rgba(0,212,255,0.12)', border: 'rgba(0,212,255,0.25)' },
  plasma: { main: '#9b59ff', sec: '#e0147a', dim: 'rgba(155,89,255,0.12)', border: 'rgba(155,89,255,0.25)' },
  amber: { main: '#ff8c00', sec: '#ff2d6f', dim: 'rgba(255,140,0,0.12)', border: 'rgba(255,140,0,0.25)' },
  rose: { main: '#ff2d6f', sec: '#ff8c00', dim: 'rgba(255,45,111,0.12)', border: 'rgba(255,45,111,0.25)' },
  arctic: { main: '#e8f4f8', sec: '#4a9eff', dim: 'rgba(232,244,248,0.12)', border: 'rgba(232,244,248,0.25)' }
};

export function hexToRgba(hex, alpha) {
  if (!hex || typeof hex !== 'string') return `rgba(57,255,80,${alpha})`;
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(57,255,80,${alpha})`;
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

export function getContrastTextColor(hex) {
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

export function applyAppearanceSettings(config) {
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

export function loadConfigAppearanceUI(config) {
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

export function setupAppearanceEventListeners() {
  document.querySelectorAll('[data-appearance-theme]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const theme = e.currentTarget.getAttribute('data-appearance-theme');
      if (state.activeConfig && state.activeConfig.ui) {
        state.activeConfig.ui.theme = theme;
        if (state.pendingConfig && state.pendingConfig.ui) state.pendingConfig.ui.theme = theme;
        applyAppearanceSettings(state.activeConfig);
        loadConfigAppearanceUI(state.activeConfig);
        saveConfigState();
      }
    });
  });

  const dualToggle = document.getElementById('settings-dual-accent');
  if (dualToggle) {
    dualToggle.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      if (state.activeConfig && state.activeConfig.ui) {
        state.activeConfig.ui.dual_accent = isChecked;
        if (state.pendingConfig && state.pendingConfig.ui) state.pendingConfig.ui.dual_accent = isChecked;
        applyAppearanceSettings(state.activeConfig);
        loadConfigAppearanceUI(state.activeConfig);
        saveConfigState();
      }
    });
  }

  document.querySelectorAll('.preset-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const preset = e.currentTarget.getAttribute('data-accent-preset');
      if (state.activeConfig && state.activeConfig.ui) {
        state.activeConfig.ui.accent_preset = preset;
        if (state.pendingConfig && state.pendingConfig.ui) state.pendingConfig.ui.accent_preset = preset;
        applyAppearanceSettings(state.activeConfig);
        loadConfigAppearanceUI(state.activeConfig);
        saveConfigState();
      }
    });
  });

  function updateCustomAccent(main, sec) {
    if (!state.activeConfig || !state.activeConfig.ui) return;
    if (main !== null) {
      state.activeConfig.ui.accent_custom_main = main;
      if (state.pendingConfig && state.pendingConfig.ui) state.pendingConfig.ui.accent_custom_main = main;
    }
    if (sec !== null) {
      state.activeConfig.ui.accent_custom_sec = sec;
      if (state.pendingConfig && state.pendingConfig.ui) state.pendingConfig.ui.accent_custom_sec = sec;
    }
    state.activeConfig.ui.accent_preset = 'custom';
    if (state.pendingConfig && state.pendingConfig.ui) state.pendingConfig.ui.accent_preset = 'custom';
    applyAppearanceSettings(state.activeConfig);
    loadConfigAppearanceUI(state.activeConfig);
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
      if (state.activeConfig && state.activeConfig.ui) {
        state.activeConfig.ui.orb_style = style;
        if (state.pendingConfig && state.pendingConfig.ui) state.pendingConfig.ui.orb_style = style;
        applyAppearanceSettings(state.activeConfig);
        loadConfigAppearanceUI(state.activeConfig);
        saveConfigState();
      }
    });
  });

  document.querySelectorAll('[data-bg-style]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const bg = e.currentTarget.getAttribute('data-bg-style');
      if (state.activeConfig && state.activeConfig.ui) {
        state.activeConfig.ui.background_style = bg;
        if (state.pendingConfig && state.pendingConfig.ui) state.pendingConfig.ui.background_style = bg;
        applyAppearanceSettings(state.activeConfig);
        loadConfigAppearanceUI(state.activeConfig);
        saveConfigState();
      }
    });
  });

  document.querySelectorAll('[data-ui-density]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const density = e.currentTarget.getAttribute('data-ui-density');
      if (state.activeConfig && state.activeConfig.ui) {
        state.activeConfig.ui.ui_density = density;
        if (state.pendingConfig && state.pendingConfig.ui) state.pendingConfig.ui.ui_density = density;
        applyAppearanceSettings(state.activeConfig);
        loadConfigAppearanceUI(state.activeConfig);
        saveConfigState();
      }
    });
  });

  document.querySelectorAll('[data-anim-intensity]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const anim = e.currentTarget.getAttribute('data-anim-intensity');
      if (state.activeConfig && state.activeConfig.ui) {
        state.activeConfig.ui.animation_intensity = anim;
        if (state.pendingConfig && state.pendingConfig.ui) state.pendingConfig.ui.animation_intensity = anim;
        applyAppearanceSettings(state.activeConfig);
        loadConfigAppearanceUI(state.activeConfig);
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

      if (state.activeConfig && state.activeConfig.ui) {
        state.activeConfig.ui.window_opacity = valFloat;
        if (state.pendingConfig && state.pendingConfig.ui) state.pendingConfig.ui.window_opacity = valFloat;
        applyAppearanceSettings(state.activeConfig);
        debouncedSaveConfig();
      }
    });
  }
}
