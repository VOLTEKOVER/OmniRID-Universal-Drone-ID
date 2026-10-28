//! App panel authentication (password-based) with session tokens.
//! Unifies app user auth with device authorization for config writes.

extern crate alloc;

use alloc::string::String;
use alloc::vec::Vec;

const TOKEN_LEN: usize = 32;
const MAX_SESSIONS: usize = 4;

#[derive(Clone, Debug)]
struct Session {
    token: [u8; TOKEN_LEN],
    expires_ms: u64,
}

pub struct AppAuthState {
    sessions: Vec<Session>,
}

impl AppAuthState {
    pub fn new() -> Self {
        Self {
            sessions: Vec::new(),
        }
    }

    pub fn clear_expired(&mut self, now_ms: u64) {
        self.sessions.retain(|s| s.expires_ms > now_ms);
    }

    pub fn create_session(&mut self, now_ms: u64, ttl_ms: u64) -> String {
        self.clear_expired(now_ms);
        if self.sessions.len() >= MAX_SESSIONS {
            // evict oldest by expires? simple: drop first
            self.sessions.remove(0);
        }
        let mut token_bytes = [0u8; TOKEN_LEN];
        for b in token_bytes.iter_mut().take(TOKEN_LEN) {
            *b = ((now_ms as u32).wrapping_mul(131542391) as u8).wrapping_add(*b);
            // simple pseudo-random-ish; replace with better if needed
        }
        // mix in counter
        let ts = now_ms as u64;
        token_bytes[0] ^= ((ts >> 24) & 0xff) as u8;
        token_bytes[1] ^= ((ts >> 16) & 0xff) as u8;
        token_bytes[2] ^= ((ts >> 8) & 0xff) as u8;
        token_bytes[3] ^= (ts & 0xff) as u8;
        let token_hex = hex_string(&token_bytes);
        self.sessions.push(Session {
            token: token_bytes,
            expires_ms: now_ms + ttl_ms,
        });
        token_hex
    }

    pub fn is_valid(&mut self, token_hex: &str, now_ms: u64) -> bool {
        self.clear_expired(now_ms);
        let bytes = match hex_to_bytes(token_hex) {
            Some(b) => b,
            None => return false,
        };
        if bytes.len() != TOKEN_LEN {
            return false;
        }
        self.sessions.iter().any(|s| s.token == bytes)
    }

    pub fn revoke_all(&mut self) {
        self.sessions.clear();
    }
}

fn hex_string(b: &[u8]) -> String {
    const HEX: &[u8] = b"0123456789abcdef";
    let mut s = String::with_capacity(b.len() * 2);
    for &byte in b {
        s.push(HEX[(byte >> 4) as usize] as char);
        s.push(HEX[(byte & 0x0f) as usize] as char);
    }
    s
}

fn hex_to_bytes(s: &str) -> Option<[u8; TOKEN_LEN]> {
    let bytes_str = s.as_bytes();
    if bytes_str.len() != TOKEN_LEN * 2 {
        return None;
    }
    let mut out = [0u8; TOKEN_LEN];
    for i in 0..TOKEN_LEN {
        let hi = hex_char(bytes_str[2 * i])?;
        let lo = hex_char(bytes_str[2 * i + 1])?;
        out[i] = (hi << 4) | lo;
    }
    Some(out)
}

fn hex_char(c: u8) -> Option<u8> {
    match c {
        b'0'..=b'9' => Some(c - b'0'),
        b'a'..=b'f' => Some(c - b'a' + 10),
        b'A'..=b'F' => Some(c - b'A' + 10),
        _ => None,
    }
}

impl Default for AppAuthState {
    fn default() -> Self {
        Self::new()
    }
}
