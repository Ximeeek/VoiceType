// src-tauri/src/notification.rs
//
// Single Responsibility: Manages building, displaying, positioning, and auto-closing
// custom HTML notification windows (e.g. for minimized-to-tray and no-input states).

use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{Manager, Emitter};

static LAST_NO_INPUT_NOTIF_TIME: AtomicU64 = AtomicU64::new(0);

fn get_now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

pub fn handle_no_input_notification(app: &tauri::AppHandle) {
    let main_window = app.get_webview_window("main");
    let is_minimized_or_hidden = match main_window {
        Some(ref window) => {
            let is_min = window.is_minimized().unwrap_or(false);
            let is_vis = window.is_visible().unwrap_or(true);
            let is_foc = window.is_focused().unwrap_or(true);
            println!("[NO_INPUT_NOTIF] main_window: is_min={}, is_vis={}, is_foc={}", is_min, is_vis, is_foc);
            is_min || !is_vis || !is_foc
        }
        None => true,
    };

    println!("[NO_INPUT_NOTIF] Final decision: is_minimized_or_hidden={}", is_minimized_or_hidden);

    if is_minimized_or_hidden {
        show_custom_notification(app, "no_input");
    } else {
        let _ = app.emit("no_input_copied", ());
    }
}

pub fn show_custom_notification(app: &tauri::AppHandle, notif_type: &str) {
    let now = get_now_ms();

    if notif_type == "no_input" {
        LAST_NO_INPUT_NOTIF_TIME.store(now, Ordering::Relaxed);
    } else if notif_type == "tray" {
        let last_no_input = LAST_NO_INPUT_NOTIF_TIME.load(Ordering::Relaxed);
        if now.saturating_sub(last_no_input) < 3500 {
            println!("[NOTIFICATION] Suppressing 'tray' notification because 'no_input' was recently shown.");
            return;
        }
    }

    println!("[NOTIFICATION] Triggering custom system notification: type='{}'", notif_type);
    let notif_type_string = notif_type.to_string();

    if let Some(existing) = app.get_webview_window("notification") {
        println!("[NOTIFICATION] Reusing existing notification window with type: '{}'", notif_type);
        let _ = existing.emit("show_notification", notif_type_string);
        if let Ok(Some(monitor)) = existing.primary_monitor() {
            let size = monitor.size();
            let scale_factor = monitor.scale_factor();
            let width = 360.0;
            let height = 96.0;
            let x = (size.width as f64 / scale_factor) - width - 20.0;
            let y = (size.height as f64 / scale_factor) - height - 60.0;
            let _ = existing.set_position(tauri::Position::Logical(tauri::LogicalPosition::new(x, y)));
        }
        let _ = existing.show();
        return;
    }

    let app_clone = app.clone();
    let mut url_str = format!("notification.html?type={}", notif_type);

    if let Some(state) = app.try_state::<std::sync::Arc<crate::AppState>>() {
        if let Ok(config) = state.config.try_lock() {
            let ui = &config.ui;
            let main_color = ui.accent_custom_main.replace('#', "%23");
            let sec_color = ui.accent_custom_sec.replace('#', "%23");
            url_str = format!(
                "notification.html?type={}&theme={}&accent_preset={}&dual_accent={}&accent_custom_main={}&accent_custom_sec={}",
                notif_type,
                ui.theme,
                ui.accent_preset,
                ui.dual_accent,
                main_color,
                sec_color
            );
        }
    }

    match tauri::WebviewWindowBuilder::new(
        app,
        "notification",
        tauri::WebviewUrl::App(url_str.into())
    )
    .title("VoiceType Notification")
    .decorations(false)
    .transparent(true)
    .shadow(false)
    .skip_taskbar(true)
    .always_on_top(true)
    .resizable(false)
    .inner_size(360.0, 96.0)
    .visible(false)
    .focused(false)
    .build() {
        Ok(window) => {
            #[cfg(windows)]
            {
                use windows::Win32::UI::WindowsAndMessaging::{
                    GetWindowLongW, SetWindowLongW, GWL_EXSTYLE, WS_EX_NOACTIVATE
                };
                if let Ok(hwnd) = window.hwnd() {
                    unsafe {
                        let our_hwnd = windows::Win32::Foundation::HWND(hwnd.0 as *mut _);
                        let ex_style = GetWindowLongW(our_hwnd, GWL_EXSTYLE);
                        let _ = SetWindowLongW(our_hwnd, GWL_EXSTYLE, ex_style | WS_EX_NOACTIVATE.0 as i32);
                    }
                }
            }

            if let Ok(Some(monitor)) = window.primary_monitor() {
                let size = monitor.size();
                let scale_factor = monitor.scale_factor();
                let width = 360.0;
                let height = 96.0;
                let x = (size.width as f64 / scale_factor) - width - 20.0;
                let y = (size.height as f64 / scale_factor) - height - 60.0;
                let _ = window.set_position(tauri::Position::Logical(tauri::LogicalPosition::new(x, y)));
                let _ = window.show();
            } else {
                let _ = window.show();
            }

            // Auto-close after 4 seconds
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_millis(4000)).await;
                if let Some(w) = app_clone.get_webview_window("notification") {
                    let _ = w.close();
                }
            });
        }
        Err(err) => {
            eprintln!("[NOTIFICATION_ERROR] Failed to build notification window: {}", err);
        }
    }
}
