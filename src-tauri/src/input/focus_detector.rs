#[derive(Debug, Clone)]
pub enum FocusResult {
    UiaTextField,
    WinApiTextField,
    NoTextField,
}

pub fn detect_focused_text_field() -> FocusResult {
    #[cfg(windows)]
    {
        #[allow(unused_imports)]
        use windows::Win32::System::Com::{CoInitializeEx, COINIT_APARTMENTTHREADED};
        use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetClassNameW};

        // Warstwa 1: UIA (Omijamy żeby uprościć, WinAPI wystarczy do większości)
        // W przyszłości można tu dodać UIAutomation
        
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.0 != std::ptr::null_mut() {
                let mut class_name = [0u16; 256];
                let len = GetClassNameW(hwnd, &mut class_name);
                if len > 0 {
                    let class_string = String::from_utf16_lossy(&class_name[..len as usize]);
                    let known_classes = [
                        "Edit", "RichEdit20W", "RICHEDIT50W", "RichEditD2DPT",
                        "Chrome_RenderWidgetHostHWND", "MozillaWindowClass",
                        "RichEdit20A", "EDIT", "Notepad", "ApplicationFrameWindow"
                    ];
                    
                    for class in known_classes.iter() {
                        if class_string.contains(class) {
                            return FocusResult::WinApiTextField;
                        }
                    }
                }
            }
        }
        
        // Zawsze pozwalamy na pisanie dla ułatwienia (bo Focus może być w kontrolkach)
        // Dla pewności zwracamy WinApiTextField by default, 
        // lub NoTextField jeśli chcemy być surowi. Zostawmy WinApiTextField jako fallback.
        FocusResult::WinApiTextField
    }
    #[cfg(not(windows))]
    {
        FocusResult::NoTextField
    }
}
