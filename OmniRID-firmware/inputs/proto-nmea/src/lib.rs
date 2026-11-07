//! NMEA GPS input protocol.
//!
//! A pure streaming parser (`NmeaParser::feed`) paired with a `NmeaSource` that
//! owns a byte reader (`UartRead`) and implements the `rid-interface`
//! `GpsSource` contract for the scheduler. `no_std`, allocation-free.

#![no_std]

#[cfg(test)]
extern crate std;

pub mod parser;
pub mod source;

pub use parser::{NmeaParser, NMEA_BUF_SIZE};
pub use source::NmeaSource;
