//! MAVLink v1/v2 input protocol.
//!
//! A pure streaming parser (`MavlinkParser::feed`) paired with a
//! `MavlinkSource` that owns a byte reader (`UartRead`) and implements the
//! `rid-interface` `GpsSource` contract for the scheduler. `no_std`,
//! allocation-free.

#![no_std]

#[cfg(test)]
extern crate std;

pub mod parser;
pub mod source;

pub use parser::MavlinkParser;
pub use source::MavlinkSource;
