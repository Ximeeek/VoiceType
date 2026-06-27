#[cfg(windows)]
pub fn set_autostart(enabled: bool, exe_path: &str) -> anyhow::Result<()> {
    use windows::Win32::System::Registry::*;
    use windows::Win32::Foundation::ERROR_FILE_NOT_FOUND;
    use windows::core::PCWSTR;
    use std::os::windows::ffi::OsStrExt;
    use std::ffi::OsStr;

    let subkey: Vec<u16> = OsStr::new(r"Software\Microsoft\Windows\CurrentVersion\Run")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let value_name: Vec<u16> = OsStr::new("VoiceType")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        let mut hkey = HKEY::default();
        let status = RegOpenKeyExW(
            HKEY_CURRENT_USER,
            PCWSTR(subkey.as_ptr()),
            0,
            KEY_WRITE | KEY_READ,
            &mut hkey,
        );
        if status.is_err() {
            return Err(anyhow::anyhow!("Failed to open registry key: {:?}", status));
        }

        if enabled {
            let val_str = format!("\"{}\" --minimized", exe_path);
            let val_utf16: Vec<u16> = OsStr::new(&val_str)
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();
            let bytes_len = (val_utf16.len() * 2) as u32;
            let res = RegSetValueExW(
                hkey,
                PCWSTR(value_name.as_ptr()),
                0,
                REG_SZ,
                Some(std::slice::from_raw_parts(val_utf16.as_ptr() as *const u8, bytes_len as usize)),
            );
            let _ = RegCloseKey(hkey);
            if res.is_err() {
                return Err(anyhow::anyhow!("Failed to set registry value: {:?}", res));
            }
        } else {
            let res = RegDeleteValueW(hkey, PCWSTR(value_name.as_ptr()));
            let _ = RegCloseKey(hkey);
            if res.is_err() && res != ERROR_FILE_NOT_FOUND {
                // Ignore error if value didn't exist
            }
        }
    }
    Ok(())
}

#[cfg(not(windows))]
pub fn set_autostart(_enabled: bool, _exe_path: &str) -> anyhow::Result<()> {
    Ok(())
}
