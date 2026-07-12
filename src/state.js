/**
 * Module: Application State Store
 * Single Responsibility: Manages global reactive application variables,
 * debounced configuration saving, and Tauri configuration integration.
 */

import { t } from './i18n.js';

// Debouncer helper for range sliders and state saving
export function debounce(func, wait) {
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

export const state = {
  activeConfig: null,
  pendingConfig: null,
  currentStatus: 'idle',
  triggerWords: [],
  stopWords: [],
  partialElement: null,
  dictationCount: 0,
  wordCount: 0,
  isGlobalDownloading: false,
  downloadQueue: [],
  
  // Highlighting models helper
  pendingModelHighlight: null
};

// Expose state globally for backward compatibility / easy debugging
window.appState = state;

export async function saveConfigState() {
  if (!state.activeConfig) return;
  if (window.__TAURI__) {
    try {
      await window.__TAURI__.core.invoke('save_config', { config: state.activeConfig });
    } catch (err) {
      if (window.ToastManager) {
        window.ToastManager.show({ 
          type: 'error', 
          title: t('toast.save_config_failed') || 'Failed to save configuration', 
          message: err.toString() 
        });
      } else {
        console.error('Failed to save config:', err);
      }
    }
  }
}

export const debouncedSaveConfig = debounce(saveConfigState, 500);
