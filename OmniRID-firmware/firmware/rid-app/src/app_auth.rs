//! App panel authentication (password-based) with session tokens.
//! Unifies app user auth with device authorization for config writes.

extern crate alloc;

use alloc::string::String;
use alloc::vec::Vec;

const TOKEN_LEN: usize = 32;
const MAX_SESSIONS: usize = 4;
const MAX_PASSWORD_ATTEMPTS: u8 = 10;
const PASSWORD_ATTEMPT_WINDOW_MS: u32 = 60_000;

#[derive(Clone, Debug)]
struct Session {
    token: [u8; TOKEN_LEN],
    expires_ms: u64,
}

pub struct AppAuthState {
    sessions: Vec<Session>,
    password_attempt_window_start_ms: u32,
    password_attempts: u8,
}

impl AppAuthState {
    pub fn new() -> Self {
        Self {
            sessions: Vec::new(),
            password_attempt_window_start_ms: 0,
            password_attempts: 0,
        }
    }

    pub fn clear_expired(&mut self, now_ms: u64) {
        self.sessions.retain(|s| s.expires_ms > now_ms);
    }

    pub fn allow_password_attempt(&mut self, now_ms: u32) -> bool {
        if now_ms.wrapping_sub(self.password_attempt_window_start_ms) >= PASSWORD_ATTEMPT_WINDOW_MS
        {
            self.password_attempt_window_start_ms = now_ms;
            self.password_attempts = 0;
        }
        if self.password_attempts >= MAX_PASSWORD_ATTEMPTS {
            return false;
        }
        self.password_attempts += 1;
        true
    }

    pub fn reset_password_attempts(&mut self, now_ms: u32) {
        self.password_attempt_window_start_ms = now_ms;
        self.password_attempts = 0;
    }

    pub fn create_session(
        &mut self,
        now_ms: u64,
        ttl_ms: u64,
        token_bytes: [u8; TOKEN_LEN],
    ) -> String {
        self.clear_expired(now_ms);
        if self.sessions.len() >= MAX_SESSIONS {
            self.sessions.remove(0);
        }
        let token_hex = hex_string(&token_bytes);
        self.sessions.push(Session {
            token: token_bytes,
            expires_ms: now_ms.saturating_add(ttl_ms),
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
        self.sessions.iter().fold(false, |found, session| {
            let difference = session
                .token
                .iter()
                .zip(bytes.iter())
                .fold(0u8, |difference, (left, right)| difference | (left ^ right));
            found | (difference == 0)
        })
    }

    pub fn revoke_all(&mut self) {
        self.sessions.clear();
    }
}

pub fn json_string_field(body: &[u8], field: &str) -> Option<String> {
    let value: serde_json::Value = serde_json::from_slice(body).ok()?;
    Some(value.get(field)?.as_str()?.into())
}

pub fn password_matches(stored: &[u8; 33], candidate: &str) -> bool {
    let candidate = candidate.as_bytes();
    if candidate.len() > 32 {
        return false;
    }

    let stored_len = stored.iter().position(|&byte| byte == 0).unwrap_or(32);
    let mut difference = (stored_len != candidate.len()) as u8;
    for (index, stored_byte) in stored.iter().take(32).enumerate() {
        difference |= *stored_byte ^ candidate.get(index).copied().unwrap_or(0);
    }
    difference == 0
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

#[cfg(test)]
mod tests {
    use super::*;
    use alloc::format;

    #[test]
    fn session_tokens_come_from_supplied_entropy_and_expire() {
        let mut auth = AppAuthState::new();
        let token = [0x5a; TOKEN_LEN];
        let encoded = auth.create_session(100, 50, token);

        assert_eq!(encoded, "5a".repeat(TOKEN_LEN));
        assert!(auth.is_valid(&encoded, 149));
        assert!(!auth.is_valid(&encoded, 150));
    }

    #[test]
    fn session_tokens_are_checked_without_early_exit_on_byte_mismatch() {
        let mut auth = AppAuthState::new();
        let token = [0xa5; TOKEN_LEN];
        let encoded = auth.create_session(100, 100, token);
        assert!(auth.is_valid(&encoded, 101));
        assert!(!auth.is_valid(&format!("00{}", &encoded[2..]), 101));
        assert!(!auth.is_valid(&format!("{}00", &encoded[..encoded.len() - 2]), 101));
    }

    #[test]
    fn password_attempts_are_limited_and_reset_after_window() {
        let mut auth = AppAuthState::new();
        for _ in 0..MAX_PASSWORD_ATTEMPTS {
            assert!(auth.allow_password_attempt(1_000));
        }
        assert!(!auth.allow_password_attempt(1_000));
        assert!(auth.allow_password_attempt(1_000 + PASSWORD_ATTEMPT_WINDOW_MS));
    }

    #[test]
    fn password_field_parsing_handles_json_escaping_and_rejects_non_strings() {
        assert_eq!(
            json_string_field(br#"{"password":"p\"ass"}"#, "password").as_deref(),
            Some("p\"ass")
        );
        assert_eq!(json_string_field(br#"{"password":123}"#, "password"), None);
        assert_eq!(json_string_field(b"{", "password"), None);
    }

    #[test]
    fn password_matching_checks_full_length_and_contents() {
        let mut stored = [0u8; 33];
        stored[..32].copy_from_slice(b"abcdefghijklmnopqrstuvwxyz123456");
        assert!(password_matches(
            &stored,
            "abcdefghijklmnopqrstuvwxyz123456"
        ));
        assert!(!password_matches(
            &stored,
            "abcdefghijklmnopqrstuvwxyz123456extra"
        ));

        stored[31] = 0;
        stored[32] = 0;
        assert!(password_matches(&stored, "abcdefghijklmnopqrstuvwxyz12345"));
        assert!(!password_matches(
            &stored,
            "abcdefghijklmnopqrstuvwxyz12345x"
        ));
    }
}

impl Default for AppAuthState {
    fn default() -> Self {
        Self::new()
    }
}
