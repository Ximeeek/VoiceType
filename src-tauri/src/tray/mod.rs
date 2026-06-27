use tauri::{AppHandle, Manager};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{TrayIconBuilder, MouseButton, TrayIconEvent};

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let header = MenuItem::with_id(app, "header", "VoiceType", false, None::<&str>)?;
    let status = MenuItem::with_id(app, "tray_status", "Status: Idle", false, None::<&str>)?;
    let show_window = MenuItem::with_id(app, "show_window", "Pokaz okno", true, None::<&str>)?;
    let toggle_pause = MenuItem::with_id(app, "toggle_pause", "Wstrzymaj nasluchiwanie", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "open_settings", "Ustawienia", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Zamknij VoiceType", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[
        &header,
        &PredefinedMenuItem::separator(app)?,
        &status,
        &PredefinedMenuItem::separator(app)?,
        &show_window,
        &toggle_pause,
        &PredefinedMenuItem::separator(app)?,
        &settings,
        &PredefinedMenuItem::separator(app)?,
        &quit,
    ])?;

    TrayIconBuilder::new()
        .menu(&menu)
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "show_window" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "toggle_pause" => {
                    // TODO
                }
                "open_settings" => {
                    // TODO
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

pub fn update_tray_status(app: &AppHandle, _text: &str) {
    if let Some(window) = app.get_webview_window("main") {
        if let Some(_menu) = window.menu() {

            // Note: properly updating menu item text in Tauri 2 tray requires retaining the MenuItem reference 
            // or searching through items. As a simplified placeholder we would update it here.
        }
    }
}
