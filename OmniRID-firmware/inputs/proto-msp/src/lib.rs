//! MSP (MultiWii Serial Protocol) input.
//!
//! A pure streaming parser (`MspParser::feed`) paired with an `MspSource` that
//! owns a `UartRead` and implements the `rid-interface` `GpsSource` contract.
//! `no_std`, allocation-free.

#![no_std]

#[cfg(test)]
extern crate std;

pub mod parser;
pub mod source;

pub use parser::{MspParser, MSP_BUF_SIZE};
pub use source::MspSource;
