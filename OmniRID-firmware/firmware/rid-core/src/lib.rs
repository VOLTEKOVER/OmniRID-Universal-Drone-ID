//! Central processing for the Remote ID firmware. No hardware dependencies;
//! compiles identically on the real BSP and on the host simulator.
#![no_std]

extern crate alloc;

pub mod auth;
pub mod hub;
pub mod kalman;
pub mod patrol;
pub mod protocol_detect;
pub mod readiness;
pub mod scheduler;
pub mod security;
