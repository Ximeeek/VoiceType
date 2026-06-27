const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const { appWindow } = window.__TAURI__.window;

document.addEventListener('DOMContentLoaded', async () => {
    const installPathInput = document.getElementById('install-path');
    const browseBtn = document.getElementById('browse-btn');
    const installBtn = document.getElementById('install-btn');
    const closeBtn = document.getElementById('close-btn');
    
    const setupView = document.getElementById('setup-view');
    const progressView = document.getElementById('progress-view');
    const progressFill = document.getElementById('progress-fill');
    const progressPercent = document.getElementById('progress-percent');
    const statusText = document.getElementById('status-text');
    const shortcutDesktop = document.getElementById('shortcut-desktop');

    // Get default path
    try {
        const defaultPath = await invoke('get_default_install_path');
        installPathInput.value = defaultPath;
    } catch (e) {
        console.error(e);
        installPathInput.value = "C:\\VoiceType";
    }

    closeBtn.addEventListener('click', async () => {
        await appWindow.close();
    });

    browseBtn.addEventListener('click', async () => {
        try {
            const selectedPath = await invoke('select_directory');
            if (selectedPath) {
                installPathInput.value = selectedPath;
            }
        } catch (e) {
            console.error("Browse error:", e);
        }
    });

    // Listen for progress updates from Rust
    await listen('install-progress', (event) => {
        const { progress, status } = event.payload;
        progressFill.style.width = `${progress}%`;
        progressPercent.innerText = `${Math.round(progress)}%`;
        if (status) {
            statusText.innerText = status;
        }
    });

    installBtn.addEventListener('click', async () => {
        // Switch to progress view
        setupView.style.display = 'none';
        progressView.style.display = 'flex';
        
        try {
            await invoke('install_app', {
                path: installPathInput.value,
                createDesktopShortcut: shortcutDesktop.checked
            });
            
            statusText.innerText = "Installation Complete!";
            progressFill.style.width = "100%";
            progressPercent.innerText = "100%";
            
            setTimeout(async () => {
                await invoke('launch_app', { path: installPathInput.value });
                await appWindow.close();
            }, 1500);
            
        } catch (e) {
            statusText.innerText = "Installation Failed: " + e;
            statusText.style.color = "#ff3b3b";
        }
    });
});
