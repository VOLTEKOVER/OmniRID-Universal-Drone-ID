//! Board-agnostic Remote ID application layer: firmware configuration, web
//! JSON API, console CLI, security primitives, runtime state, NVS contract,
//! and BLE 4.x legacy advertisement framing.
//!
//! The crate is `no_std` + `alloc` and has no ESP-IDF dependency: it builds
//! and tests on any host. Board glues are thin adapters on top of it:
//! `bsp-esp32` (real hardware) and `bsp-sim` (Windows host simulation).
#![no_std]

extern crate alloc;

pub mod app_auth;
pub mod ble4;
pub mod cli;
pub mod config;
pub mod json;
pub mod led_status;
pub mod nvs;
pub mod ota;
pub mod state;
pub mod web;
pub mod web_config;

pub use ble4::build_legacy_adv;
pub use cli::{
    apply_demo_mode, apply_kalman, config_set_field, parse_i64_base0, parse_line, parse_log_level,
    parse_protocol_name, proto_name, set_tx_mode, ConfigSetError, KalmanUsageError, TxModeError,
    MAX_ARGS,
};
pub use config::{BspConfig, AUTH_KEY_MAX_LEN};
pub use json::{apply_json, config_to_json, parse_region_name, region_name};
pub use led_status::{
    blink_1hz, blink_4hz, blink_double, led_state_entry, pulse, rainbow, solid, LedPattern,
    LedState, LedStateMachine, Rgb, TX_FLASH_MS,
};
pub use nvs::{erase, load, reset_preserve_keys, save, NvsStore};
pub use ota::{
    ota_preflight_error, validate_ota_upload, OtaError, OtaUpload, RecvChunk, OTA_MAX_IDLE_STALLS,
};
// Re-export security helpers so the application layer exposes them.
pub use app_auth::AppAuthState;
pub use rid_core::security::{
    b64_decode, bytes_to_hex, hex_to_bytes, verify_sha256, verify_signed_body,
};
pub use state::{standard_name, state_to_json, State, FW_VERSION};
pub use web::{json_escape, level_from_line, LogRing, SigRate};
pub use web_config::{
    command_kind, command_needs_auth, handle_command, normalize_command, signed_action_decision,
    CommandKind, CommandOutcome, ConfigWrite,
};
