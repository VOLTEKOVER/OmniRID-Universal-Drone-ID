//! MAVLink v2 TX telemetry: packs HEARTBEAT and OPEN_DRONE_ID_SYSTEM frames
//! and writes them to a byte sink (USB Serial/JTAG on hardware, a mock on the
//! host).
//!
//! The messages are sent to the USB console port when `mavlink_usb_enable`
//! is set. Unlike the input `proto-*` crates this one does not implement
//! `GpsSource`: it is telemetry out.
#![no_std]

#[cfg(test)]
extern crate std;

pub mod pack;
pub mod tx;

pub use pack::{pack_heartbeat, pack_open_drone_id_system, MAX_FRAME_LEN};
pub use tx::{MavlinkUsbTx, HEARTBEAT_PERIOD_US, OP_ALT_UNKNOWN, SYSTEM_PERIOD_US};
