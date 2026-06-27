use crate::input::FocusResult;

pub struct LiveTypingState {
    pub injected_partial: String,
}

impl LiveTypingState {
    pub fn new() -> Self { 
        Self { injected_partial: String::new() } 
    }

    pub async fn update_partial(&mut self, new_partial: &str, focus: &FocusResult, delay_ms: u64) -> anyhow::Result<()> {
        #[cfg(windows)]
        {
            let common_prefix_len = self.injected_partial
                .chars()
                .zip(new_partial.chars())
                .take_while(|(a, b)| a == b)
                .count();
            let backspace_count = self.injected_partial.chars().count() - common_prefix_len;
            let suffix: String = new_partial.chars().skip(common_prefix_len).collect();

            if backspace_count > 0 {
                send_backspaces(backspace_count, focus).await?;
            }
            if !suffix.is_empty() {
                inject_text_raw(&suffix, focus, delay_ms).await?;
            }
            self.injected_partial = new_partial.to_string();
        }
        Ok(())
    }

    pub async fn finalize(&mut self, final_text: &str, focus: &FocusResult, delay_ms: u64) -> anyhow::Result<()> {
        let final_with_space = format!("{} ", final_text);
        #[cfg(windows)]
        {
            let common_prefix_len = self.injected_partial
                .chars()
                .zip(final_with_space.chars())
                .take_while(|(a, b)| a == b)
                .count();
            let backspace_count = self.injected_partial.chars().count() - common_prefix_len;
            let suffix: String = final_with_space.chars().skip(common_prefix_len).collect();

            if backspace_count > 0 {
                send_backspaces(backspace_count, focus).await?;
            }
            if !suffix.is_empty() {
                inject_text_raw(&suffix, focus, delay_ms).await?;
            }
        }
        self.injected_partial = String::new();
        Ok(())
    }
}

async fn inject_text_raw(text: &str, _focus: &FocusResult, delay_ms: u64) -> anyhow::Result<()> {
    #[cfg(windows)]
    {
        use windows::Win32::UI::Input::KeyboardAndMouse::*;
        
        for code_unit in text.encode_utf16() {
            let mut input_down = INPUT::default();
            input_down.r#type = INPUT_KEYBOARD;
            input_down.Anonymous.ki.wScan = code_unit;
            input_down.Anonymous.ki.dwFlags = KEYEVENTF_UNICODE;
            unsafe { SendInput(&[input_down], std::mem::size_of::<INPUT>() as i32) };
            
            tokio::time::sleep(tokio::time::Duration::from_millis(1)).await;
            
            let mut input_up = INPUT::default();
            input_up.r#type = INPUT_KEYBOARD;
            input_up.Anonymous.ki.wScan = code_unit;
            input_up.Anonymous.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;
            unsafe { SendInput(&[input_up], std::mem::size_of::<INPUT>() as i32) };
            
            let delay = if delay_ms > 0 { delay_ms } else { 1 };
            tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;
        }
    }
    Ok(())
}

async fn send_backspaces(count: usize, _focus: &FocusResult) -> anyhow::Result<()> {
    #[cfg(windows)]
    {
        use windows::Win32::UI::Input::KeyboardAndMouse::*;
        
        for _ in 0..count {
            let mut input_down = INPUT::default();
            input_down.r#type = INPUT_KEYBOARD;
            input_down.Anonymous.ki.wVk = VK_BACK;
            input_down.Anonymous.ki.dwFlags = KEYBD_EVENT_FLAGS(0);
            unsafe { SendInput(&[input_down], std::mem::size_of::<INPUT>() as i32) };
            
            tokio::time::sleep(tokio::time::Duration::from_millis(1)).await;
            
            let mut input_up = INPUT::default();
            input_up.r#type = INPUT_KEYBOARD;
            input_up.Anonymous.ki.wVk = VK_BACK;
            input_up.Anonymous.ki.dwFlags = KEYEVENTF_KEYUP;
            unsafe { SendInput(&[input_up], std::mem::size_of::<INPUT>() as i32) };
            
            tokio::time::sleep(tokio::time::Duration::from_millis(1)).await;
        }
    }
    Ok(())
}
