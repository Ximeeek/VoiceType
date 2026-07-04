pub mod windows;

#[cfg(windows)]
pub use windows::suppress_console_in_release;

#[cfg(not(windows))]
pub fn suppress_console_in_release(_cmd: &mut std::process::Command) {}
