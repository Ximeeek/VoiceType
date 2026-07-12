/**
 * Module: Toast Notification Manager
 * Single Responsibility: Renders and manages temporary or manual toast alert notifications
 * with support for custom slide animations, progress bars, and mouse hover time renewal.
 */

import { state } from './state.js';
import { t, updateDOMTranslations } from './i18n.js';

export class ToastManager {
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

    if (state.activeConfig && state.activeConfig.ui) {
      let toastConfigKey = 'toast_info';
      if (type === 'success') {
        toastConfigKey = 'toast_success';
      } else if (type === 'error') {
        toastConfigKey = 'toast_error';
      }
      
      const tCfg = state.activeConfig.ui[toastConfigKey];
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

// Expose on window for easy access from non-module or dynamically generated contexts
window.ToastManager = ToastManager;
