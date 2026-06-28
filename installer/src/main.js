const getTauri = () => window.__TAURI__ || {};
const getInvoke = () => (getTauri().core ? getTauri().core.invoke : window.__TAURI_INVOKE__);
const getListen = () => (getTauri().event ? getTauri().event.listen : null);
const getWindow = () => (getTauri().window ? (getTauri().window.getCurrentWindow ? getTauri().window.getCurrentWindow() : getTauri().window.appWindow) : null);

document.addEventListener('DOMContentLoaded', async () => {
    const installPathInput = document.getElementById('install-path');
    const browseBtn = document.getElementById('browse-btn');
    const installBtn = document.getElementById('install-btn');
    const closeBtn = document.getElementById('close-btn');
    
    const setupView = document.getElementById('setup-view');
    const progressView = document.getElementById('progress-view');
    const finishView = document.getElementById('finish-view');
    
    const progressFill = document.getElementById('progress-fill');
    const progressPercent = document.getElementById('progress-percent');
    const statusText = document.getElementById('status-text');
    const shortcutDesktop = document.getElementById('shortcut-desktop');

    const finishAutostart = document.getElementById('finish-autostart');
    const finishStartmenu = document.getElementById('finish-startmenu');
    const finishLaunch = document.getElementById('finish-launch');
    const finishCloseBtn = document.getElementById('finish-close-btn');

    const invoke = getInvoke();
    const listen = getListen();
    const win = getWindow();

    const doExitWindow = async () => {
        try {
            if (invoke) {
                await invoke('close_installer');
            }
        } catch (e) {
            console.error("close_installer error:", e);
        }
        try {
            if (win && win.close) {
                await win.close();
            }
        } catch (e) {}
        window.close();
    };

    // Get default path
    try {
        if (invoke) {
            const defaultPath = await invoke('get_default_install_path');
            installPathInput.value = defaultPath;
        } else {
            installPathInput.value = "C:\\VoiceType";
        }
    } catch (e) {
        console.error("Default path error:", e);
        installPathInput.value = "C:\\VoiceType";
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', async () => {
            await doExitWindow();
        });
    }

    if (browseBtn) {
        browseBtn.addEventListener('click', async () => {
            try {
                if (invoke) {
                    let selectedPath = await invoke('select_directory');
                    if (selectedPath) {
                        const trimmed = selectedPath.trim().replace(/[\\/]+$/, '');
                        if (!trimmed.toLowerCase().endsWith('voicetype')) {
                            selectedPath = trimmed + '\\VoiceType';
                        } else {
                            selectedPath = trimmed;
                        }
                        installPathInput.value = selectedPath;
                    }
                }
            } catch (e) {
                console.error("Browse error:", e);
                alert("Browse error: " + e);
            }
        });
    }

    // Listen for progress updates from Rust
    if (listen) {
        try {
            await listen('install-progress', (event) => {
                const { progress, status } = event.payload || {};
                if (progress !== undefined) {
                    progressFill.style.width = `${progress}%`;
                    progressPercent.innerText = `${Math.round(progress)}%`;
                }
                if (status) {
                    statusText.innerText = status;
                }
            });
        } catch (e) {
            console.error("Listen error:", e);
        }
    }

    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (!installPathInput.value) {
                alert("Please specify an installation path.");
                return;
            }
            
            // Switch to progress view
            setupView.style.display = 'none';
            progressView.style.display = 'flex';
            
            try {
                if (invoke) {
                    await invoke('install_app', {
                        path: installPathInput.value,
                        createDesktopShortcut: shortcutDesktop ? shortcutDesktop.checked : true
                    });
                    
                    // Show finish view instead of auto-launching
                    setTimeout(() => {
                        progressView.style.display = 'none';
                        finishView.style.display = 'flex';
                    }, 500);
                } else {
                    throw new Error("Tauri IPC is not available.");
                }
                
            } catch (e) {
                statusText.innerText = "Installation Failed: " + (e.message || e);
                statusText.style.color = "#ff3b3b";
            }
        });
    }

    if (finishCloseBtn) {
        finishCloseBtn.addEventListener('click', async () => {
            try {
                if (invoke) {
                    await invoke('finalize_installation', {
                        path: installPathInput.value,
                        createAutostart: finishAutostart ? finishAutostart.checked : true,
                        createStartMenu: finishStartmenu ? finishStartmenu.checked : true,
                        launch: finishLaunch ? finishLaunch.checked : true
                    });
                }
            } catch (e) {
                console.error("Finalize error:", e);
            }

            await doExitWindow();
        });
    }
});
