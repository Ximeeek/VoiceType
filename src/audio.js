/**
 * Module: Audio Devices & Level Testing
 * Single Responsibility: Retrives recording hardware, configures selected microphone input,
 * and handles WebAudio loopback/analyser level checks for visual audio feedback.
 */

import { state } from './state.js';
import { t, updateDOMTranslations } from './i18n.js';
import { ToastManager } from './toast.js';

// Microphone Test Logic
export const micTestState = {
  isActive: false,
  stream: null,
  audioCtx: null,
  analyser: null,
  source: null,
  gainNode: null,
  animationId: null
};

export async function populateAudioDevices() {
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
      
      if (state.activeConfig && state.activeConfig.audio) {
        const targetVal = state.activeConfig.audio.input_device || 'default';
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

export async function startMicTest() {
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

export function stopMicTest() {
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
  if (fillEl) fillEl.style.width = `0%`;
  if (valEl) valEl.textContent = `0%`;
  
  const btn = document.getElementById('btn-toggle-mic-test');
  if (btn) {
    btn.classList.remove('active');
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play"><polygon points="6 3 20 12 6 21 6 3"/></svg>
      <span data-i18n="settings.mic_test.start">Rozpocznij test</span>
    `;
    updateDOMTranslations();
  }
  
  const details = document.getElementById('mic-test-details');
  if (details) details.style.display = 'none';
}

export async function toggleMicTest() {
  if (micTestState.isActive) {
    stopMicTest();
  } else {
    await startMicTest();
  }
}

// Bind to window for global callbacks from navigation buttons
window.stopMicTest = stopMicTest;
window.toggleMicTest = toggleMicTest;
