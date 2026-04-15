//! Minimal Tauri-side library surface for the P1 foundation loop.
//!
//! The production Tauri entrypoint can wrap these modules with `#[tauri::command]`
//! functions later; keeping this crate dependency-light lets the Store/Adapter
//! boundary compile and test independently in the current repository snapshot.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

pub mod adapters;

pub mod commands {
    pub mod distribution;
    pub mod local_state;
    pub mod local_state_types;
    pub mod path_validation;
    pub mod project_directory;
    pub mod tool_detection;
}

pub mod store;
