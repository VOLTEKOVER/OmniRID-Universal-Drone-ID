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
use embedded_svc::io::Read;
use esp_idf_svc as _;
use esp_idf_svc::http::server::EspHttpServer;
use esp_idf_svc::http::Method;
use esp_idf_svc::io::EspIOError;
use esp_idf_svc::sys::EspError;
use rid_app::web;
use rid_app::web_config::{
    handle_command, signed_action_decision, CommandKind, CommandOutcome, ConfigWrite,
};

use crate::SharedState;

/// Response headers for the JSON API.
const JSON_CT: &[(&str, &str)] = &[("Content-Type", "application/json")];

/// CORS + JSON headers: the PWA is served from another origin (GitHub
/// Pages) and reaches the device directly over its AP, so every response
/// must be readable cross-origin.
const CORS_JSON: &[(&str, &str)] = &[
    ("Content-Type", "application/json"),
    ("Access-Control-Allow-Origin", "*"),
    ("Access-Control-Allow-Methods", "GET, POST, OPTIONS"),
    ("Access-Control-Allow-Headers", "Content-Type, X-Signature, X-Expected-SHA256"),
];

/// Preflight response headers: echo the request headers/methods the PWA
/// may send (JSON bodies, Ed25519 signatures, OTA hash).
const CORS_PREFLIGHT: &[(&str, &str)] = &[
    ("Access-Control-Allow-Origin", "*"),
    ("Access-Control-Allow-Methods", "GET, POST, OPTIONS"),
    ("Access-Control-Allow-Headers", "Content-Type, X-Signature, X-Expected-SHA256"),
    ("Access-Control-Max-Age", "86400"),
];

/// Monotonic millisecond clock, mirroring the C `esp_timer_get_time() / 1000`.
fn now_ms() -> u32 {
    unsafe { (esp_idf_svc::sys::esp_timer_get_time() / 1000) as u32 }
}

/// Live lock level (clamped to `u8`) plus the authorised public keys.
fn lock_and_keys(state: &SharedState) -> (u8, [rid_interface::FixedKeyStr; rid_interface::NUM_KEYS]) {
    let ctl = state.ctl.lock();
    (
        ctl.bsp_config.lock_level.max(0) as u8,
        ctl.bsp_config.public_keys,
    )
}

/// Signed-action gate for a config write or factory reset. At lock level >= 1
/// this requires a valid `X-Signature` over `body` and honours the failure
/// rate limiter; below that it always passes (see `rid_app::web_config`).
fn write_decision(state: &SharedState, body: &[u8], sig: Option<&[u8]>) -> ConfigWrite {
    let (level, keys) = lock_and_keys(state);
    let mut rate = state.sig_rate.lock();
    signed_action_decision(level, body, sig, &keys, &mut rate, now_ms())
}

/// Signed-command gate for `/api/command`. At lock level >= 1 restart/reset
/// commands require a valid `X-Signature` and now honour the same failure
/// rate limiter as config writes (`dataflow.md` #11).
fn command_decision(state: &SharedState, body: &[u8], sig: Option<&[u8]>) -> CommandOutcome {
    let (level, keys) = lock_and_keys(state);
    let mut rate = state.sig_rate.lock();
    handle_command(level, body, sig, &keys, &mut rate, now_ms())
}

/// Register an OPTIONS preflight handler for a path.
fn add_cors_preflight(
    server: &mut EspHttpServer<'static>,
    path: &'static str,
) -> Result<(), EspError> {
    server
        .fn_handler(path, Method::Options, move |req| -> Result<(), EspIOError> {
            req.into_response(204, None, CORS_PREFLIGHT)?;
            Ok(())
        })
        .map(|_| ())
}

/// Start the HTTP server with all API routes.
///
/// `EspHttpServer::new` starts the server immediately (there is no separate
/// `start()` step).  Each `fn_handler` closure returns `Result<(), EspIOError>`
/// and pushes the response body through `into_response`'s `message` argument.
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
        "/ota",
    ] {
        add_cors_preflight(&mut server, path)?;
    }

    // GET /api/config
    {
        let state = state.clone();
        server
            .fn_handler("/api/config", Method::Get, move |req| -> Result<(), EspIOError> {
                let lock = state.ctl.lock();
                let json = lock.config_json();
                req.into_response(200, Some(json.as_str()), CORS_JSON)?;
                Ok(())
            })
            .expect("register handler");
    }

    // POST /api/config
    {
        let state = state.clone();
        server
            .fn_handler("/api/config", Method::Post, move |mut req| -> Result<(), EspIOError> {
                let mut body = Vec::new();
                let mut buf = [0u8; 1024];
                loop {
                    let n = req.read(&mut buf)?;
                    if n == 0 {
                        break;
                    }
                    body.extend_from_slice(&buf[..n]);
                }
                let json_str = alloc::str::from_utf8(&body).unwrap_or("{}");
                let sig = req.header("X-Signature").map(|s| s.as_bytes().to_vec());
                match write_decision(&state, &body, sig.as_deref()) {
                    ConfigWrite::RateLimited => {
                        req.into_response(
                            429,
                            Some(r#"{"error":"too many failed signature attempts"}"#),
                            CORS_JSON,
                        )?;
                        return Ok(());
                    }
                    ConfigWrite::InvalidSignature => {
                        req.into_response(
                            401,
                            Some(r#"{"error":"invalid or missing signature"}"#),
                            CORS_JSON,
                        )?;
                        return Ok(());
                    }
                    ConfigWrite::Ok => {}
                }
                let result = {
                    let mut lock = state.ctl.lock();
                    if rid_app::json::apply_json(&mut lock.bsp_config, json_str) {
                        let cfg = lock.bsp_config.clone();
                        let outcome = lock.set_config(&cfg);
                        super::nvs_save(&lock.bsp_config);
                        if outcome.protocol_reinit_required {
                            // TODO: re-init UART
                        }
                        true
                    } else {
                        false
                    }
                };
                let resp = if result { r#"{"ok":true}"# } else { r#"{"error":"invalid config"}"# };
                req.into_response(200, Some(resp), CORS_JSON)?;
                Ok(())
            })
            .expect("register handler");
    }

    // GET /api/status
    {
        let state = state.clone();
        server
            .fn_handler("/api/status", Method::Get, move |req| -> Result<(), EspIOError> {
                let lock = state.ctl.lock();
                let json = lock.status_json();
                req.into_response(200, Some(json.as_str()), CORS_JSON)?;
                Ok(())
            })
            .expect("register handler");
    }

    // GET /api/capabilities
    {
        server
            .fn_handler("/api/capabilities", Method::Get, move |req| -> Result<(), EspIOError> {
                let json = crate::capabilities::capabilities_json();
                req.into_response(200, Some(json.as_str()), CORS_JSON)?;
                Ok(())
            })
            .expect("register handler");
    }

    // POST /api/reset
    {
        let state = state.clone();
        server
            .fn_handler("/api/reset", Method::Post, move |mut req| -> Result<(), EspIOError> {
                let mut body = Vec::new();
                let mut buf = [0u8; 256];
                loop {
                    let n = req.read(&mut buf)?;
                    if n == 0 {
                        break;
                    }
                    body.extend_from_slice(&buf[..n]);
                }
                let sig = req.header("X-Signature").map(|s| s.as_bytes().to_vec());
                match write_decision(&state, &body, sig.as_deref()) {
                    ConfigWrite::RateLimited => {
                        req.into_response(
                            429,
                            Some(r#"{"error":"too many failed signature attempts"}"#),
                            CORS_JSON,
                        )?;
                        return Ok(());
                    }
                    ConfigWrite::InvalidSignature => {
                        req.into_response(
                            401,
                            Some(r#"{"error":"invalid or missing signature"}"#),
                            CORS_JSON,
                        )?;
                        return Ok(());
                    }
                    ConfigWrite::Ok => {}
                }
                {
                    let mut lock = state.ctl.lock();
                    lock.factory_reset();
                    super::nvs_erase();
                }
                req.into_response(200, Some(r#"{"ok":true}"#), CORS_JSON)?;
                Ok(())
            })
            .expect("register handler");
    }

    // GET /api/logs
    {
        let state = state.clone();
        server
            .fn_handler("/api/logs", Method::Get, move |req| -> Result<(), EspIOError> {
                let lock = state.log_ring.lock();
                let mut buf = [0u8; web::LOG_BUF_SIZE];
                let n = lock.render_log_json(&mut buf);
                let json = String::from_utf8_lossy(&buf[..n]);
                req.into_response(200, Some(json.as_ref()), CORS_JSON)?;
                Ok(())
            })
            .expect("register handler");
    }

    // POST /api/command — signed control commands (restart / reset / status).
    {
        let state = state.clone();
        server
            .fn_handler("/api/command", Method::Post, move |mut req| -> Result<(), EspIOError> {
                let mut body = Vec::new();
                let mut buf = [0u8; 256];
                loop {
                    let n = req.read(&mut buf)?;
                    if n == 0 {
                        break;
                    }
                    body.extend_from_slice(&buf[..n]);
                }
                let sig = req.header("X-Signature").map(|s| s.as_bytes().to_vec());
                match command_decision(&state, &body, sig.as_deref()) {
                    CommandOutcome::RateLimited => {
                        req.into_response(
                            429,
                            Some(r#"{"error":"too many failed signature attempts"}"#),
                            CORS_JSON,
                        )?;
                        return Ok(());
                    }
                    CommandOutcome::InvalidSignature => {
                        req.into_response(
                            401,
                            Some(r#"{"error":"invalid or missing signature"}"#),
                            CORS_JSON,
                        )?;
                    }
                    CommandOutcome::Ok(CommandKind::Status) => {
                        let json = state.ctl.lock().status_json();
                        req.into_response(200, Some(json.as_str()), CORS_JSON)?;
                    }
                    CommandOutcome::Ok(CommandKind::FactoryReset) => {
                        {
                            let mut lock = state.ctl.lock();
                            lock.factory_reset();
                            super::nvs_erase();
                        }
                        req.into_response(200, Some(r#"{"ok":true}"#), CORS_JSON)?;
                    }
                    CommandOutcome::Ok(CommandKind::Restart) => {
                        req.into_response(200, Some(r#"{"ok":true}"#), CORS_JSON)?;
                        crate::ota::reboot();
                    }
                    CommandOutcome::Ok(CommandKind::Unknown) => {
                        req.into_response(400, Some(r#"{"error":"unknown command"}"#), CORS_JSON)?;
                    }
                }
                Ok(())
            })
            .expect("register handler");
    }

    // POST /ota
    {
        let state = state.clone();
        server
            .fn_handler("/ota", Method::Post, move |mut req| -> Result<(), EspIOError> {
                // Read body.
                let mut body = Vec::new();
                let mut buf = [0u8; 4096];
                loop {
                    let n = req.read(&mut buf)?;
                    if n == 0 {
                        break;
                    }
                    body.extend_from_slice(&buf[..n]);
                }
                // The firmware image is not applied yet, but the same
                // signed-action gate already protects the endpoint so that a
                // locked device rejects unsigned uploads as soon as
                // `X-Expected-SHA256` + `X-Signature` handling lands here.
                let sig = req.header("X-Signature").map(|s| s.as_bytes().to_vec());
                match write_decision(&state, &body, sig.as_deref()) {
                    ConfigWrite::RateLimited => {
                        req.into_response(
                            429,
                            Some(r#"{"error":"too many failed signature attempts"}"#),
                            CORS_JSON,
                        )?;
                        return Ok(());
                    }
                    ConfigWrite::InvalidSignature => {
                        req.into_response(
                            401,
                            Some(r#"{"error":"invalid or missing signature"}"#),
                            CORS_JSON,
                        )?;
                        return Ok(());
                    }
                    ConfigWrite::Ok => {}
                }
                let resp = r#"{"error":"OTA via API not yet wired - use /update"}"#;
                req.into_response(200, Some(resp), CORS_JSON)?;
                Ok(())
            })
            .expect("register handler");
    }

    Ok(server)
}
