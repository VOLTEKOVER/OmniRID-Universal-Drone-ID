//! Application assembly wiring the controller, scheduler, and BSP-facing
//! layers into the running firmware.
//!
//! The `Controller` keeps the full BSP config, derives the hub-facing
//! `rid_interface::Config` and drives the scheduler. The hardware (parsers as
//! `GpsSource`, radios as `Transmitter`, NVS, web server, LEDC) is
//! injected by the BSP, so everything here is host-testable.
//!
//! Also provides the `/api/capabilities` build descriptor for the external
//! OmniRID PWA (Fase 5) and the JSON payloads of the three API endpoints
//! (`/api/config`, `/api/status`, `/api/capabilities`).
#![no_std]

extern crate alloc;

pub mod capabilities;
pub mod controller;

pub use capabilities::{capabilities_json, Capabilities};
pub use controller::{
    core_config, derive_ids_from_mac, is_placeholder_id, mavlink_tx_enabled, Controller,
    SetConfigOutcome,
};
