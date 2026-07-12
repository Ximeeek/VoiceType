use tauri::{AppHandle, Manager};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{TrayIconBuilder, MouseButton, TrayIconEvent};

struct TrayTranslations {
    status_idle: &'static str,
    show_window: &'static str,
    toggle_pause: &'static str,
    settings: &'static str,
    quit: &'static str,
}

const TRAY_EN: TrayTranslations = TrayTranslations {
    status_idle: "Status: Idle",
    show_window: "Show Window",
    toggle_pause: "Pause Listening",
    settings: "Settings",
    quit: "Quit VoiceType",
};

const TRAY_PL: TrayTranslations = TrayTranslations {
    status_idle: "Status: Bezczynny",
    show_window: "Pokaż okno",
    toggle_pause: "Wstrzymaj nasłuchiwanie",
    settings: "Ustawienia",
    quit: "Zamknij VoiceType",
};

fn get_tray_translations(lang: &str) -> &'static TrayTranslations {
    match lang {
        "pl" => &TRAY_PL,
        _ => &TRAY_EN,
    }
}

pub fn rebuild_tray_menu(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let lang = crate::config::load_config().general.language;
    let t = get_tray_translations(&lang);

    let header = MenuItem::with_id(app, "header", "VoiceType", false, None::<&str>)?;
    let status = MenuItem::with_id(app, "tray_status", t.status_idle, false, None::<&str>)?;
    let show_window = MenuItem::with_id(app, "show_window", t.show_window, true, None::<&str>)?;
    let toggle_pause = MenuItem::with_id(app, "toggle_pause", t.toggle_pause, true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "open_settings", t.settings, true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", t.quit, true, None::<&str>)?;

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

    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_menu(Some(menu));
    }

    Ok(())
}

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let tray_icon = app.default_window_icon()
        .cloned()
        .ok_or_else(|| Box::<dyn std::error::Error>::from("Failed to get default window icon"))?;

    TrayIconBuilder::with_id("main")
        .icon(tray_icon)
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

    // Populate localized menu initially
    let _ = rebuild_tray_menu(app);

    Ok(())
}

