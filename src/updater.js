const FULL_BINARY_SILENT_MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const ASSETS_SILENT_MAX_BYTES = 2 * 1024 * 1024;        // 2 MB
const ASSETS_MANIFEST_URL = 'https://raw.githubusercontent.com/Ximeeek/VoiceType/main/assets-manifest.json';

async function checkAssetsUpdate() {
  try {
    if (!window.__TAURI__) return false;
    
    const httpFetch = (window.__TAURI__.http && window.__TAURI__.http.fetch) 
      ? window.__TAURI__.http.fetch 
      : window.fetch.bind(window);

    const response = await httpFetch(ASSETS_MANIFEST_URL);
    if (!response.ok) return false;
    const manifest = await response.json();

    const fs = window.__TAURI__.fs;
    if (!fs) return false;

    const baseDir = fs.BaseDirectory ? fs.BaseDirectory.AppData : 1;
    const localVersionFileExists = await fs.exists('assets-version.txt', { baseDir });
    let localVersion = '0.0.0';
    if (localVersionFileExists) {
      localVersion = await fs.readTextFile('assets-version.txt', { baseDir });
    }

    if (manifest.version === localVersion.trim()) return false;
    if (manifest.size > ASSETS_SILENT_MAX_BYTES) return false;

    const assetsResponse = await httpFetch(manifest.url);
    const arrayBuffer = await assetsResponse.arrayBuffer();
    const assetsData = new Uint8Array(arrayBuffer);

    await fs.writeFile('assets.zip', assetsData, { baseDir });
    const encoder = new TextEncoder();
    await fs.writeFile('assets-version.txt', encoder.encode(manifest.version), { baseDir });

    return true;
  } catch (err) {
    console.warn('[UPDATER] Assets check error:', err);
    return false;
  }
}

async function checkBinaryUpdate(onStatus) {
  if (!window.__TAURI__ || !window.__TAURI__.updater) return;
  
  const updater = window.__TAURI__.updater;
  const update = await updater.check();
  if (!update || !update.available) return;

  let totalSize;
  let isSilent = true;

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        totalSize = event.data.contentLength;
        isSilent = !totalSize || totalSize < FULL_BINARY_SILENT_MAX_BYTES;
        onStatus({ type: 'downloading', version: update.version, progress: 0, isSilent });
        break;

      case 'Progress':
        if (totalSize && totalSize > 0) {
          const progress = Math.round((event.data.chunkLength / totalSize) * 100);
          onStatus({ type: 'downloading', version: update.version, progress, isSilent });
        }
        break;

      case 'Finished':
        if (isSilent) {
          setTimeout(() => installAndRelaunch(), 2000);
        } else {
          onStatus({ type: 'ready_to_install', version: update.version });
        }
        break;
    }
  });
}

export async function initUpdater(onStatus) {
  onStatus({ type: 'checking' });

  await checkAssetsUpdate();

  try {
    await checkBinaryUpdate(onStatus);
    onStatus({ type: 'up_to_date' });
  } catch (err) {
    console.warn('[UPDATER] Binary check error:', err);
    onStatus({ type: 'idle' });
  }
}

export async function installAndRelaunch() {
  if (window.__TAURI__ && window.__TAURI__.process) {
    await window.__TAURI__.process.relaunch();
  }
}

export function setupUpdateNotificationUI() {
  const container = document.getElementById('update-notification-container');
  if (!container) return;

  const renderStatus = (status) => {
    if (!status || status.type === 'idle' || status.type === 'up_to_date' || status.type === 'checking') {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    container.style.display = 'block';

    if (status.type === 'downloading' && status.isSilent) {
      container.innerHTML = `
        <div class="update-card" style="padding: 12px 16px;">
          <div class="update-header" style="margin-bottom: 0;">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--accent-green)" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span class="update-title" style="font-size: 13px;">Aktualizuję aplikację w tle...</span>
          </div>
        </div>
      `;
      return;
    }

    if (status.type === 'downloading' && !status.isSilent) {
      container.innerHTML = `
        <div class="update-card">
          <div class="update-header">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--accent-green)" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span class="update-title">Pobieranie aktualizacji ${status.version}...</span>
          </div>
          <div class="update-message">Pobrano ${status.progress}% wygenerowanej paczki wydań.</div>
          <div class="update-progress-container">
            <div class="update-progress-bar" style="width: ${status.progress}%;"></div>
          </div>
        </div>
      `;
      return;
    }

    if (status.type === 'ready_to_install') {
      container.innerHTML = `
        <div class="update-card">
          <div class="update-header">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--accent-green)" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span class="update-title">Aktualizacja ${status.version} gotowa!</span>
          </div>
          <div class="update-message">Nowa wersja aplikacji została pobrana i przygotowana do instalacji.</div>
          <div class="update-actions">
            <button class="btn-secondary" id="btn-update-later" style="padding: 6px 12px; font-size: 12px;">Później</button>
            <button class="btn-primary" id="btn-update-install" style="padding: 6px 12px; font-size: 12px;">Zainstaluj i uruchom ponownie</button>
          </div>
        </div>
      `;

      document.getElementById('btn-update-install')?.addEventListener('click', () => {
        installAndRelaunch();
      });
      document.getElementById('btn-update-later')?.addEventListener('click', () => {
        container.style.display = 'none';
      });
    }
  };

  setTimeout(() => {
    initUpdater(renderStatus);
  }, 3000);
}
