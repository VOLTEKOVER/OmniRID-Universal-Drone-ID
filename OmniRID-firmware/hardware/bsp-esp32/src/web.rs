//! ESP-IDF HTTP server: JSON API endpoints and OTA only — no embedded UI.
//!
//! The firmware is headless: all configuration logic lives in the external
//! OmniRID PWA (GitHub Pages), which talks to these endpoints over the
//! device's WiFi AP.  Every response carries permissive CORS headers and
//! each route has an OPTIONS preflight handler so browser clients on a
//! different origin (the PWA) can call the API directly.  The pure logic
//! (JSON rendering, OTA validation, log ring) lives in `rid_app`.

use alloc::string::String;
use alloc::sync::Arc;
use alloc::vec::Vec;
use embedded_svc::io::Write;
use esp_idf_svc as _;
use esp_idf_svc::http::server::{EspHttpConnection, EspHttpServer, Method, Request};
use esp_idf_svc::io::EspIOError;
use esp_idf_svc::sys::EspError;
use rid_app::web;
use rid_app::web_config::{
    handle_command, signed_action_decision, CommandKind, CommandOutcome, ConfigWrite,
};

use crate::SharedState;

/// CORS + JSON headers: the PWA is served from another origin (GitHub
/// Pages) and reaches the device directly over its AP, so every response
/// must be readable cross-origin.
const CORS_JSON: &[(&str, &str)] = &[
    ("Content-Type", "application/json"),
    ("Access-Control-Allow-Origin", "*"),
    ("Access-Control-Allow-Methods", "GET, POST, OPTIONS"),
    (
        "Access-Control-Allow-Headers",
        "Content-Type, X-Signature, X-Expected-SHA256, X-App-Token",
    ),
];

/// Preflight response headers: echo the request headers/methods the PWA
/// may send (JSON bodies, Ed25519 signatures, app session token, OTA hash).
const CORS_PREFLIGHT: &[(&str, &str)] = &[
    ("Access-Control-Allow-Origin", "*"),
    ("Access-Control-Allow-Methods", "GET, POST, OPTIONS"),
    (
        "Access-Control-Allow-Headers",
        "Content-Type, X-Signature, X-Expected-SHA256, X-App-Token",
    ),
    ("Access-Control-Max-Age", "86400"),
];

/// Maximum accepted body for `POST /api/config` (the whole config document).
const MAX_CONFIG_BODY: usize = 16 * 1024;

/// Maximum accepted body for `POST /api/reset` and `POST /api/command`.
const MAX_CMD_BODY: usize = 4 * 1024;

/// Re-initialise the USB CDC UART after a protocol switch. USB CDC only
/// exists on the S3/C6, so this is a no-op on the classic ESP32; it is also
/// skipped when MAVLink-over-USB is disabled.
#[cfg(any(feature = "esp32s3", feature = "esp32c6"))]
fn reinit_usb_if_needed(should_reinit: bool) {
    if should_reinit {
        crate::usb::init();
    }
}

/// No-op counterpart for chips without the `usb` module.
#[cfg(not(any(feature = "esp32s3", feature = "esp32c6")))]
fn reinit_usb_if_needed(_should_reinit: bool) {}

/// HTTP reason phrase for the status codes this API returns.
fn reason_phrase(status: u16) -> &'static str {
    match status {
        200 => "OK",
        204 => "No Content",
        400 => "Bad Request",
        401 => "Unauthorized",
        404 => "Not Found",
        413 => "Payload Too Large",
        429 => "Too Many Requests",
        500 => "Internal Server Error",
        501 => "Not Implemented",
        _ => "",
    }
}

/// Send a complete JSON response: status line + CORS headers + body.
///
/// `embedded_svc`'s `into_response(status, message, headers)` takes the HTTP
/// *reason phrase* as `message`; the payload has to be written on the
/// returned `Response`.  (Passing the JSON as `message` would put it in the
/// status line — where clients discard it — and send an empty body.)
fn send_json(
    req: Request<&mut EspHttpConnection<'_>>,
    status: u16,
    body: &str,
) -> Result<(), EspIOError> {
    let mut resp = req.into_response(status, Some(reason_phrase(status)), CORS_JSON)?;
    resp.write_all(body.as_bytes())
}

/// Read the whole request body into a buffer, capped at `max` bytes.
/// Returns `None` when the body exceeds the cap (the caller answers 413).
fn read_body(
    req: &mut Request<&mut EspHttpConnection<'_>>,
    max: usize,
) -> Result<Option<Vec<u8>>, EspIOError> {
    let mut body = Vec::new();
    let mut buf = [0u8; 1024];
    loop {
        let n = req.read(&mut buf)?;
        if n == 0 {
            break;
        }
        if body.len() + n > max {
            return Ok(None);
        }
        body.extend_from_slice(&buf[..n]);
    }
    Ok(Some(body))
}

/// Monotonic millisecond clock, mirroring the C `esp_timer_get_time() / 1000`.
fn now_ms() -> u32 {
    unsafe { (esp_idf_svc::sys::esp_timer_get_time() / 1000) as u32 }
}

/// Live lock level (clamped to `u8`) plus the authorised public keys.
fn lock_and_keys(
    state: &SharedState,
) -> (u8, [rid_interface::FixedKeyStr; rid_interface::NUM_KEYS]) {
    let ctl = state.ctl.lock();
    (
        ctl.bsp_config.lock_level.max(0) as u8,
        ctl.bsp_config.public_keys,
    )
}

fn app_session_valid(state: &SharedState, token: Option<&str>) -> bool {
    if let Some(t) = token {
        if t.is_empty() {
            return false;
        }
        let mut auth = state.app_auth.lock();
        return auth.is_valid(t, now_ms() as u64);
    }
    false
}

/// Signed-action gate for a config write or factory reset. At lock level >= 1
/// prefer valid app session; otherwise fall back to `X-Signature`.
fn write_decision(state: &SharedState, body: &[u8], sig: Option<&[u8]>, app_token: Option<&str>) -> ConfigWrite {
    let (level, keys) = lock_and_keys(state);
    let mut rate = state.sig_rate.lock();
    let session_ok = app_session_valid(state, app_token);
    signed_action_decision(level, body, sig, &keys, &mut rate, now_ms(), session_ok)
}

/// Command gate for `/api/command`. Prefer app session; fall back to signature.
fn command_decision(state: &SharedState, body: &[u8], sig: Option<&[u8]>, app_token: Option<&str>) -> CommandOutcome {
    let (level, keys) = lock_and_keys(state);
    let mut rate = state.sig_rate.lock();
    let session_ok = app_session_valid(state, app_token);
    handle_command(level, body, sig, &keys, &mut rate, now_ms(), session_ok)
}

/// Register an OPTIONS preflight handler for a path.
fn add_cors_preflight(
    server: &mut EspHttpServer<'static>,
    path: &'static str,
) -> Result<(), EspError> {
    server
        .fn_handler(
            path,
            Method::Options,
            move |req| -> Result<(), EspIOError> {
                // No body: the native handler sends the bare 204 via `complete()`.
                req.into_response(204, Some(reason_phrase(204)), CORS_PREFLIGHT)?;
                Ok(())
            },
        )
        .map(|_| ())
}

/// Start the HTTP server with all API routes.
///
/// `EspHttpServer::new` starts the server immediately (there is no separate
/// `start()` step).  Each `fn_handler` closure returns `Result<(), EspIOError>`:
/// responses go through [`send_json`], which sets the status line + CORS
/// headers with `into_response` and then writes the JSON body on the
/// returned `Response` (in `embedded-svc` the `into_response` `message`
/// argument is the HTTP reason phrase, NOT the payload).
pub fn start(state: Arc<SharedState>) -> Result<EspHttpServer<'static>, EspError> {
    let mut server = EspHttpServer::new(&Default::default()).expect("httpd start");

    // CORS preflight for every API route (browser clients on another origin).
    for path in [
        "/api/config",
        "/api/status",
        "/api/capabilities",
        "/api/reset",
        "/api/logs",
        "/api/command",
        "/api/app/auth/status",
        "/api/app/auth",
        "/api/app/auth/set",
        "/ota",
    ] {
        add_cors_preflight(&mut server, path)?;
    }

    // GET /api/config
    {
        let state = state.clone();
        server
            .fn_handler(
                "/api/config",
                Method::Get,
                move |req| -> Result<(), EspIOError> {
                    let json = state.ctl.lock().config_json();
                    send_json(req, 200, &json)?;
                    Ok(())
                },
            )
            .expect("register handler");
    }

    // GET /api/app/auth/status
    {
        let state = state.clone();
        server
            .fn_handler(
                "/api/app/auth/status",
                Method::Get,
                move |req| -> Result<(), EspIOError> {
                    let ctl = state.ctl.lock();
                    let has_pass = {
                        let p = &ctl.bsp_config.app_password;
                        p[0] != 0
                    };
                    let token = req.header("X-App-Token");
                    let authed = if let Some(t) = token {
                        let mut auth = state.app_auth.lock();
                        auth.is_valid(t, now_ms() as u64)
                    } else {
                        false
                    };
                    let json = if has_pass {
                        if authed {
                            r#"{"required":true,"enabled":true,"passwordSet":true,"authenticated":true}"#
                        } else {
                            r#"{"required":true,"enabled":true,"passwordSet":true,"authenticated":false}"#
                        }
                    } else {
                        r#"{"required":false,"enabled":false,"passwordSet":false,"authenticated":true}"#
                    };
                    send_json(req, 200, json)?;
                    Ok(())
                },
            )
            .expect("register handler");
    }

    // POST /api/app/auth
    {
        let state = state.clone();
        server
            .fn_handler(
                "/api/app/auth",
                Method::Post,
                move |mut req| -> Result<(), EspIOError> {
                    let Some(body) = read_body(&mut req, MAX_CMD_BODY)? else {
                        send_json(req, 413, r#"{"error":"payload too large"}"#)?;
                        return Ok(());
                    };
                    // simple JSON parse for {"password":"..."}
                    let s = alloc::str::from_utf8(&body).unwrap_or("");
                    // naive extract
                    let mut pwd = alloc::string::String::new();
                    if let Some(i) = s.find("\"password\"") {
                        let rest = &s[i..];
                        if let Some(c1) = rest.find(':') {
                            let rest2 = &rest[c1 + 1..];
                            // skip spaces
                            let mut j = 0;
                            let bytes = rest2.as_bytes();
                            while j < bytes.len() && (bytes[j] == b' ' || bytes[j] == b'\t' || bytes[j] == b'"') {
                                j += 1;
                            }
                            let mut k = j;
                            while k < bytes.len() && bytes[k] != b'"' && bytes[k] != b',' && bytes[k] != b'}' {
                                k += 1;
                            }
                            if k > j {
                                pwd.push_str(&rest2[j..k]);
                            }
                        }
                    }
                    let ctl = state.ctl.lock();
                    let stored = &ctl.bsp_config.app_password;
                    // compare
                    let mut ok = false;
                    if stored[0] == 0 {
                        ok = true; // no password set
                    } else {
                        let mut m = 0;
                        let pbytes = pwd.as_bytes();
                        while m < 32 && stored[m] != 0 && pbytes.get(m) == Some(&stored[m]) {
                            m += 1;
                        }
                        if m > 0 && stored[m] == 0 && pbytes.len() == m {
                            ok = true;
                        } else if stored[0] == 0 {
                            ok = true;
                        }
                    }
                    drop(ctl);
                    if !ok {
                        send_json(req, 401, r#"{"ok":false,"authenticated":false,"error":"invalid password"}"#)?;
                        return Ok(());
                    }
                    let token = {
                        let mut auth = state.app_auth.lock();
                        auth.create_session(now_ms() as u64, 3600_000)
                    };
                    let resp = alloc::format!(r#"{{"ok":true,"authenticated":true,"token":"{}"}}"#, token);
                    send_json(req, 200, &resp)?;
                    Ok(())
                },
            )
            .expect("register handler");
    }

    // POST /api/app/auth/set
    {
        let state = state.clone();
        server
            .fn_handler(
                "/api/app/auth/set",
                Method::Post,
                move |mut req| -> Result<(), EspIOError> {
                    let Some(body) = read_body(&mut req, MAX_CMD_BODY)? else {
                        send_json(req, 413, r#"{"error":"payload too large"}"#)?;
                        return Ok(());
                    };
                    let s = alloc::str::from_utf8(&body).unwrap_or("");
                    let mut new_pwd = alloc::string::String::new();
                    let mut cur_pwd = alloc::string::String::new();
                    // naive extract newPassword/currentPassword
                    if let Some(i) = s.find("\"newPassword\"") {
                        let rest = &s[i..];
                        if let Some(c1) = rest.find(':') {
                            let rest2 = &rest[c1 + 1..];
                            let mut j = 0;
                            let bytes = rest2.as_bytes();
                            while j < bytes.len() && (bytes[j] == b' ' || bytes[j] == b'\t' || bytes[j] == b'"') {
                                j += 1;
                            }
                            let mut k = j;
                            while k < bytes.len() && bytes[k] != b'"' {
                                k += 1;
                            }
                            if k > j {
                                new_pwd.push_str(&rest2[j..k]);
                            }
                        }
                    }
                    if let Some(i) = s.find("\"currentPassword\"") {
                        let rest = &s[i..];
                        if let Some(c1) = rest.find(':') {
                            let rest2 = &rest[c1 + 1..];
                            let mut j = 0;
                            let bytes = rest2.as_bytes();
                            while j < bytes.len() && (bytes[j] == b' ' || bytes[j] == b'\t' || bytes[j] == b'"') {
                                j += 1;
                            }
                            let mut k = j;
                            while k < bytes.len() && bytes[k] != b'"' {
                                k += 1;
                            }
                            if k > j {
                                cur_pwd.push_str(&rest2[j..k]);
                            }
                        }
                    }
                    let (level, _keys) = lock_and_keys(&state);
                    let app_token = req.header("X-App-Token");
                    let session_ok = app_session_valid(&state, app_token);
                    if level >= 1 && !session_ok {
                        send_json(req, 401, r#"{"ok":false,"error":"unauthorized"}"#)?;
                        return Ok(());
                    }
                    // if password currently set, require current password or valid session
                    {
                        let ctl = state.ctl.lock();
                        let stored = &ctl.bsp_config.app_password;
                        if stored[0] != 0 {
                            // verify current if provided, else rely on session
                            if !cur_pwd.is_empty() {
                                let mut m = 0;
                                let pbytes = cur_pwd.as_bytes();
                                let mut match_cur = true;
                                while m < 32 {
                                    let sb = stored[m];
                                    let cb = pbytes.get(m).copied().unwrap_or(0);
                                    if sb == 0 && cb == 0 { break; }
                                    if sb != cb { match_cur = false; break; }
                                    m += 1;
                                    if sb == 0 { break; }
                                }
                                if !match_cur {
                                    send_json(req, 401, r#"{"ok":false,"error":"invalid current password"}"#)?;
                                    return Ok(());
                                }
                            } else if !session_ok {
                                send_json(req, 401, r#"{"ok":false,"error":"invalid current password"}"#)?;
                                return Ok(());
                            }
                        }
                    }
                    if new_pwd.is_empty() {
                        send_json(req, 400, r#"{"ok":false,"error":"new password required"}"#)?;
                        return Ok(());
                    }
                    if new_pwd.len() > 32 {
                        send_json(req, 400, r#"{"ok":false,"error":"password too long"}"#)?;
                        return Ok(());
                    }
                    {
                        let mut ctl = state.ctl.lock();
                        let mut buf = [0u8; 33];
                        let nb = new_pwd.as_bytes();
                        let n = nb.len().min(32);
                        buf[..n].copy_from_slice(&nb[..n]);
                        buf[n] = 0;
                        ctl.bsp_config.app_password = buf;
                        // persist
                        super::nvs_save(&ctl.bsp_config);
                    }
                    {
                        let mut auth = state.app_auth.lock();
                        auth.revoke_all();
                    }
                    send_json(req, 200, r#"{"ok":true}"#)?;
                    Ok(())
                },
            )
            .expect("register handler");
    }

    // POST /api/config
    {
        let state = state.clone();
        server
            .fn_handler(
                "/api/config",
                Method::Post,
                move |mut req| -> Result<(), EspIOError> {
                    let Some(body) = read_body(&mut req, MAX_CONFIG_BODY)? else {
                        send_json(req, 413, r#"{"error":"payload too large"}"#)?;
                        return Ok(());
                    };
                    let json_str = alloc::str::from_utf8(&body).unwrap_or("{}");
                    let sig = req.header("X-Signature").map(|s| s.as_bytes().to_vec());
                    let app_token = req.header("X-App-Token");
                    match write_decision(&state, &body, sig.as_deref(), app_token) {
                        ConfigWrite::RateLimited => {
                            send_json(
                                req,
                                429,
                                r#"{"error":"too many failed signature attempts"}"#,
                            )?;
                            return Ok(());
                        }
                        ConfigWrite::InvalidSignature => {
                            send_json(req, 401, r#"{"error":"invalid or missing signature"}"#)?;
                            return Ok(());
                        }
                        ConfigWrite::Unauthorized => {
                            send_json(req, 401, r#"{"error":"unauthorized"}"#)?;
                            return Ok(());
                        }
                        ConfigWrite::Ok => {}
                    }
                    let applied = {
                        let mut lock = state.ctl.lock();
                        if rid_app::json::apply_json(&mut lock.bsp_config, json_str) {
                            let cfg = lock.bsp_config.clone();
                            let outcome = lock.set_config(&cfg);
                            super::nvs_save(&lock.bsp_config);
                            reinit_usb_if_needed(
                                outcome.protocol_reinit_required && cfg.mavlink_usb_enable,
                            );
                            true
                        } else {
                            false
                        }
                    };
                    // A body that cannot be parsed as a config document is a
                    // client error; anything else was applied and persisted.
                    if applied {
                        send_json(req, 200, r#"{"ok":true}"#)?;
                    } else {
                        send_json(req, 400, r#"{"error":"invalid config"}"#)?;
                    }
                    Ok(())
                },
            )
            .expect("register handler");
    }

    // GET /api/status
    {
        let state = state.clone();
        server
            .fn_handler(
                "/api/status",
                Method::Get,
                move |req| -> Result<(), EspIOError> {
                    let json = state.ctl.lock().status_json();
                    send_json(req, 200, &json)?;
                    Ok(())
                },
            )
            .expect("register handler");
    }

    // GET /api/capabilities
    {
        server
            .fn_handler(
                "/api/capabilities",
                Method::Get,
                move |req| -> Result<(), EspIOError> {
                    let json = crate::capabilities::capabilities_json();
                    send_json(req, 200, &json)?;
                    Ok(())
                },
            )
            .expect("register handler");
    }

    // POST /api/reset
    {
        let state = state.clone();
        server
            .fn_handler(
                "/api/reset",
                Method::Post,
                move |mut req| -> Result<(), EspIOError> {
                    let Some(body) = read_body(&mut req, MAX_CMD_BODY)? else {
                        send_json(req, 413, r#"{"error":"payload too large"}"#)?;
                        return Ok(());
                    };
                    let sig = req.header("X-Signature").map(|s| s.as_bytes().to_vec());
                    let app_token = req.header("X-App-Token");
                    match write_decision(&state, &body, sig.as_deref(), app_token) {
                        ConfigWrite::RateLimited => {
                            send_json(
                                req,
                                429,
                                r#"{"error":"too many failed signature attempts"}"#,
                            )?;
                            return Ok(());
                        }
                        ConfigWrite::InvalidSignature => {
                            send_json(req, 401, r#"{"error":"invalid or missing signature"}"#)?;
                            return Ok(());
                        }
                        ConfigWrite::Unauthorized => {
                            send_json(req, 401, r#"{"error":"unauthorized"}"#)?;
                            return Ok(());
                        }
                        ConfigWrite::Ok => {}
                    }
                    {
                        let mut lock = state.ctl.lock();
                        lock.factory_reset();
                        // Wipe the config but keep the authorised public keys: a
                        // factory reset must not silently unlock a locked device.
                        super::nvs_reset_preserve_keys();
                    }
                    send_json(req, 200, r#"{"ok":true}"#)?;
                    Ok(())
                },
            )
            .expect("register handler");
    }

    // GET /api/logs
    {
        let state = state.clone();
        server
            .fn_handler(
                "/api/logs",
                Method::Get,
                move |req| -> Result<(), EspIOError> {
                    let mut buf = [0u8; web::LOG_BUF_SIZE];
                    // Render under the lock, then send with the lock released:
                    // `send_json` performs socket I/O that must not block the
                    // log ring.
                    let n = {
                        let lock = state.log_ring.lock();
                        lock.render_log_json(&mut buf)
                    };
                    let json = String::from_utf8_lossy(&buf[..n]);
                    send_json(req, 200, &json)?;
                    Ok(())
                },
            )
            .expect("register handler");
    }

    // POST /api/command — signed control commands (restart / reset / status).
    {
        let state = state.clone();
        server
            .fn_handler(
                "/api/command",
                Method::Post,
                move |mut req| -> Result<(), EspIOError> {
                    let Some(body) = read_body(&mut req, MAX_CMD_BODY)? else {
                        send_json(req, 413, r#"{"error":"payload too large"}"#)?;
                        return Ok(());
                    };
                    let sig = req.header("X-Signature").map(|s| s.as_bytes().to_vec());
                    let app_token = req.header("X-App-Token");
                    match command_decision(&state, &body, sig.as_deref(), app_token) {
                        CommandOutcome::RateLimited => {
                            send_json(
                                req,
                                429,
                                r#"{"error":"too many failed signature attempts"}"#,
                            )?;
                            return Ok(());
                        }
                        CommandOutcome::InvalidSignature => {
                            send_json(req, 401, r#"{"error":"invalid or missing signature"}"#)?;
                            return Ok(());
                        }
                        CommandOutcome::Ok(CommandKind::Status) => {
                            let json = state.ctl.lock().status_json();
                            send_json(req, 200, &json)?;
                        }
                        CommandOutcome::Ok(CommandKind::FactoryReset) => {
                            {
                                let mut lock = state.ctl.lock();
                                lock.factory_reset();
                                // Keep the authorised public keys (see /api/reset).
                                super::nvs_reset_preserve_keys();
                            }
                            send_json(req, 200, r#"{"ok":true}"#)?;
                        }
                        CommandOutcome::Ok(CommandKind::Restart) => {
                            send_json(req, 200, r#"{"ok":true}"#)?;
                            // Reboot only after the HTTP stack has flushed the
                            // response: the native handler still has to run
                            // `complete()` (the chunked terminator) after this
                            // closure returns, so an immediate `esp_restart()`
                            // here would cut the connection mid-response.
                            crate::ota::reboot();
                        }
                        CommandOutcome::Ok(CommandKind::Unknown) => {
                            send_json(req, 400, r#"{"error":"unknown command"}"#)?;
                        }
                    }
                    Ok(())
                },
            )
            .expect("register handler");
    }

    // POST /ota
    {
        let state = state.clone();
        server
            .fn_handler(
                "/ota",
                Method::Post,
                move |mut req| -> Result<(), EspIOError> {
                    use rid_app::ota::{ota_body_cap, validate_ota_upload, OtaError, OtaUpload, RecvChunk};

                    let (lock_level, public_keys) = lock_and_keys(&state);
                    let content_len: usize = req
                        .header("Content-Length")
                        .and_then(|s| s.parse().ok())
                        .unwrap_or(0);
                    let expected_sha256 = req
                        .header("X-Expected-SHA256")
                        .filter(|s| s.len() <= 64)
                        .map(|s| s.as_bytes().to_vec());
                    let signature = req
                        .header("X-Signature")
                        .filter(|s| s.len() < 512)
                        .map(|s| s.as_bytes().to_vec());
                    if expected_sha256.is_none() {
                        send_json(req, 400, r#"{"error":"missing X-Expected-SHA256"}"#)?;
                        return Ok(());
                    }

                    let mut ota_handle = match crate::ota::OtaHandle::begin() {
                        Some(h) => h,
                        None => {
                            send_json(req, 500, r#"{"error":"ota begin failed"}"#)?;
                            return Ok(());
                        }
                    };

                    let body_cap = ota_body_cap(content_len);
                    let mut buf = [0u8; 1024];
                    let mut collected: alloc::vec::Vec<alloc::vec::Vec<u8>> = alloc::vec::Vec::new();
                    loop {
                        match req.read(&mut buf) {
                            Ok(0) => break,
                            Ok(n) => {
                                let mut v = alloc::vec![0u8; n];
                                v.copy_from_slice(&buf[..n]);
                                collected.push(v);
                            }
                            Err(_) => break,
                        }
                    }

                    let upload = OtaUpload {
                        lock_level,
                        content_len,
                        expected_sha256: expected_sha256.as_deref(),
                        signature: signature.as_deref(),
                        public_keys: &public_keys,
                        body_cap,
                    };

                    let res = validate_ota_upload(upload, |data| crate::ota::ota_write(&mut ota_handle, data), collected.iter().map(|v| RecvChunk::Data(v.as_slice())));
                    match res {
                        Err(OtaError::PermanentlyLocked) => {
                            send_json(req, 403, r#"{"error":"permanently locked"}"#)?;
                            Ok(())
                        }
                        Err(OtaError::MissingSignature) => {
                            send_json(req, 401, r#"{"error":"missing signature"}"#)?;
                            Ok(())
                        }
                        Err(OtaError::WriteFailed) => {
                            send_json(req, 500, r#"{"error":"write failed"}"#)?;
                            Ok(())
                        }
                        Err(OtaError::MissingExpectedHash) => {
                            send_json(req, 400, r#"{"error":"missing X-Expected-SHA256"}"#)?;
                            Ok(())
                        }
                        Err(OtaError::HashMismatch) => {
                            send_json(req, 400, r#"{"error":"hash mismatch"}"#)?;
                            Ok(())
                        }
                        Err(OtaError::InvalidSignature) => {
                            send_json(req, 401, r#"{"error":"invalid signature"}"#)?;
                            Ok(())
                        }
                        Err(OtaError::UploadIncomplete) => {
                            send_json(req, 400, r#"{"error":"incomplete upload"}"#)?;
                            Ok(())
                        }
                        Ok(()) => {
                            if crate::ota::ota_end(ota_handle) {
                                send_json(req, 200, r#"{"ok":true,"reboot":true}"#)?;
                                crate::ota::reboot()
                            } else {
                                send_json(req, 500, r#"{"error":"ota end failed"}"#)?;
                                Ok(())
                            }
                        }
                    }
                },
            )
            .expect("register handler");
    }

    Ok(server)
}
