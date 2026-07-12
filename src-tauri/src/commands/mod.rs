// src-tauri/src/commands/mod.rs
//
// Single Responsibility: Aggregates and re-exports all modular Tauri command submodules
// (config, engine, model, audio, control, window) for integration in main.rs.

pub mod config;
pub mod engine;
pub mod model;
pub mod audio;
pub mod control;
pub mod window;

pub use config::*;
pub use engine::*;
pub use model::*;
pub use audio::*;
pub use control::*;
pub use window::*;
