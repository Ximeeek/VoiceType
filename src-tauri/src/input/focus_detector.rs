#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FocusResult {
    UiaTextField,
    WinApiTextField,
    NoTextField,
}

pub fn detect_focused_text_field() -> FocusResult {
    #[cfg(windows)]
    {
        use windows::Win32::System::Com::{
            CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER,
            COINIT_APARTMENTTHREADED,
        };
        use windows::Win32::UI::Accessibility::{
            CUIAutomation, IUIAutomation, IUIAutomationElement, IUIAutomationValuePattern,
            UIA_ComboBoxControlTypeId, UIA_DocumentControlTypeId, UIA_EditControlTypeId,
            UIA_TextControlTypeId, UIA_ValuePatternId,
        };
        use windows::Win32::UI::WindowsAndMessaging::{
            GetClassNameW, GetForegroundWindow, GetGUIThreadInfo, GetWindowThreadProcessId,
            GUI_CARETBLINKING, GUITHREADINFO, GUITHREADINFO_FLAGS,
        };
        use windows::core::Interface;

        // 1. Try Windows UI Automation (most accurate for modern browsers, Electron, UWP, Office)
        let uia_result = unsafe {
            let com_init = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
            let res = (|| -> Option<FocusResult> {
                let automation: IUIAutomation =
                    CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER).ok()?;
                let focused_elem: IUIAutomationElement = automation.GetFocusedElement().ok()?;

                let control_type = focused_elem.CurrentControlType().ok()?;
                let elem_name = focused_elem.CurrentName().unwrap_or_default();
                let class_name = focused_elem.CurrentClassName().unwrap_or_default();
                println!(
                    "[FOCUS_DETECTOR] UIA element class: '{}', name: '{}', control_type: {:?}",
                    class_name, elem_name, control_type
                );

                let name_lower = elem_name.to_string().to_lowercase();
                let class_lower = class_name.to_string().to_lowercase();
                if name_lower.contains("voicetype") || class_lower.contains("voicetype") {
                    println!("[FOCUS_DETECTOR] Focused element belongs to VoiceType -> NoTextField");
                    return Some(FocusResult::NoTextField);
                }

                // Control types:
                // UIA_EditControlTypeId = 30004
                // UIA_DocumentControlTypeId = 30030 (Web pages, code editors, Word)
                // UIA_TextControlTypeId = 30014
                // UIA_ComboBoxControlTypeId = 30003
                if control_type == UIA_EditControlTypeId
                    || control_type == UIA_DocumentControlTypeId
                    || control_type == UIA_TextControlTypeId
                    || control_type == UIA_ComboBoxControlTypeId
                {
                    // Check if element is read-only
                    if let Ok(pattern_obj) = focused_elem.GetCurrentPattern(UIA_ValuePatternId) {
                        if let Ok(val_pattern) = pattern_obj.cast::<IUIAutomationValuePattern>() {
                            if let Ok(is_read_only) = val_pattern.CurrentIsReadOnly() {
                                if is_read_only.as_bool() {
                                    println!("[FOCUS_DETECTOR] UIA element is read-only -> NoTextField");
                                    return Some(FocusResult::NoTextField);
                                }
                            }
                        }
                    }
                    println!("[FOCUS_DETECTOR] UIA text field confirmed!");
                    return Some(FocusResult::UiaTextField);
                }

                None
            })();

            if com_init.is_ok() {
                CoUninitialize();
            }

            res
        };

        if let Some(result) = uia_result {
            return result;
        }

        // 2. Fallback to Win32 GUI Thread Info & Window Class Check
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.0 != std::ptr::null_mut() {
                let mut title = [0u16; 256];
                let title_len = windows::Win32::UI::WindowsAndMessaging::GetWindowTextW(hwnd, &mut title);
                if title_len > 0 {
                    let title_str = String::from_utf16_lossy(&title[..title_len as usize]).to_lowercase();
                    if title_str.contains("voicetype") {
                        println!("[FOCUS_DETECTOR] Win32 foreground window is VoiceType -> NoTextField");
                        return FocusResult::NoTextField;
                    }
                }

                let thread_id = GetWindowThreadProcessId(hwnd, None);
                let mut gui_info = GUITHREADINFO {
                    cbSize: std::mem::size_of::<GUITHREADINFO>() as u32,
                    ..Default::default()
                };

                if GetGUIThreadInfo(thread_id, &mut gui_info).is_ok() {
                    // Check for active caret
                    if !gui_info.hwndCaret.0.is_null()
                        || (gui_info.flags & GUI_CARETBLINKING) != GUITHREADINFO_FLAGS(0)
                    {
                        println!("[FOCUS_DETECTOR] Win32 active caret detected!");
                        return FocusResult::WinApiTextField;
                    }

                    // Check focused HWND class
                    let target_hwnd = if !gui_info.hwndFocus.0.is_null() {
                        gui_info.hwndFocus
                    } else {
                        hwnd
                    };

                    let mut class_name = [0u16; 256];
                    let len = GetClassNameW(target_hwnd, &mut class_name);
                    if len > 0 {
                        let class_string = String::from_utf16_lossy(&class_name[..len as usize]);
                        let class_lower = class_string.to_lowercase();
                        println!("[FOCUS_DETECTOR] Win32 focused control class: '{}'", class_string);

                        let known_edit_classes = [
                            "edit",
                            "richedit",
                            "richedit20w",
                            "richedit50w",
                            "richeditd2dpt",
                            "scintilla",
                            "consolewindowclass",
                            "virtualconsoleclass",
                            "termcontrol",
                        ];

                        for class in known_edit_classes.iter() {
                            if class_lower.contains(class) {
                                println!("[FOCUS_DETECTOR] Win32 edit class match: '{}'", class);
                                return FocusResult::WinApiTextField;
                            }
                        }
                    }
                }
            }
        }

        println!("[FOCUS_DETECTOR] No text field detected -> NoTextField");
        FocusResult::NoTextField
    }
    #[cfg(not(windows))]
    {
        FocusResult::NoTextField
    }
}
