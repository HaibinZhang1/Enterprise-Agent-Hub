//! P1 Rust Store boundary for Central Store, SQLite local state, and offline events.
//!
//! This module intentionally contains only Store-owned concerns. Tool adapter detection,
//! target path validation, format transformation, and symlink/copy distribution belong in
//! the adapter/distribution layer; the Store records those results and owns the Central Store.

pub mod central_store;
pub mod commands;
pub mod hash;
pub mod models;
pub mod offline_queue;
pub mod sqlite;
