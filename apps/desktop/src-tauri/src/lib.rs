//! Minimal Tauri-side library surface for the P1 foundation loop.
//!
//! The production Tauri entrypoint can wrap these modules with `#[tauri::command]`
//! functions later; keeping this crate dependency-light lets the Store/Adapter
//! boundary compile and test independently in the current repository snapshot.

pub mod adapters;

pub mod commands {
    pub mod distribution;
    pub mod path_validation;
    pub mod tool_detection;
}

pub mod store;
