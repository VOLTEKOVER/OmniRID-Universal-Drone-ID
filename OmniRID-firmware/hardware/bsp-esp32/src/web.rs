//! ESP-IDF HTTP server: serves the embedded web UI, API endpoints, and OTA.
//!
//! Port of the HTTP routing from `web_config.c` and `rid_ota.c`.  The pure
//! logic (JSON rendering, OTA validation, log ring) lives in `rid_app`.

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
use rid_app::webui;

use crate::SharedState;

/// Response headers for the JSON API.
const JSON_CT: &[(&str, &str)] = &[("Content-Type", "application/json")];

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
/// commands require a valid `X-Signature`; there is no rate limiter here.
fn command_decision(state: &SharedState, body: &[u8], sig: Option<&[u8]>) -> CommandOutcome {
    let (level, keys) = lock_and_keys(state);
    handle_command(level, body, sig, &keys)
}

/// Start the HTTP server with all API routes.
///
/// `EspHttpServer::new` starts the server immediately (there is no separate
/// `start()` step).  Each `fn_handler` closure returns `Result<(), EspIOError>`
/// and pushes the response body through `into_response`'s `message` argument.
pub fn start(state: Arc<SharedState>) -> Result<EspHttpServer<'static>, EspError> {
    let mut server = EspHttpServer::new(&Default::default()).expect("httpd start");

    // Serve embedded web UI assets.
    for asset in webui::ASSETS {
        let path = asset.path;
        server
            .fn_handler(path, Method::Get, move |req| -> Result<(), EspIOError> {
                let content_type = asset.content_type;
                req.into_response(200, Some(asset.data), &[("Content-Type", content_type)])?;
                Ok(())
            })
            .expect("register handler");
    }

    // GET /api/config
    {
        let state = state.clone();
        server
            .fn_handler("/api/config", Method::Get, move |req| -> Result<(), EspIOError> {
                let lock = state.ctl.lock();
                let json = lock.config_json();
                req.into_response(
                    200,
                    Some(json.as_str()),
                    &[("Content-Type", "application/json")],
                )?;
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
                            JSON_CT,
                        )?;
                        return Ok(());
                    }
                    ConfigWrite::InvalidSignature => {
                        req.into_response(
                            401,
                            Some(r#"{"error":"invalid or missing signature"}"#),
                            JSON_CT,
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
                req.into_response(
                    200,
                    Some(resp),
                    &[("Content-Type", "application/json")],
                )?;
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
                req.into_response(
                    200,
                    Some(json.as_str()),
                    &[("Content-Type", "application/json")],
                )?;
                Ok(())
            })
            .expect("register handler");
    }

    // GET /api/capabilities
    {
        server
            .fn_handler("/api/capabilities", Method::Get, move |req| -> Result<(), EspIOError> {
                let json = crate::capabilities::capabilities_json();
                req.into_response(
                    200,
                    Some(json.as_str()),
                    &[("Content-Type", "application/json")],
                )?;
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
                            JSON_CT,
                        )?;
                        return Ok(());
                    }
                    ConfigWrite::InvalidSignature => {
                        req.into_response(
                            401,
                            Some(r#"{"error":"invalid or missing signature"}"#),
                            JSON_CT,
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
                req.into_response(
                    200,
                    Some(r#"{"ok":true}"#),
                    &[("Content-Type", "application/json")],
                )?;
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
                req.into_response(
                    200,
                    Some(json.as_ref()),
                    &[("Content-Type", "application/json")],
                )?;
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
                    CommandOutcome::InvalidSignature => {
                        req.into_response(
                            401,
                            Some(r#"{"error":"invalid or missing signature"}"#),
                            JSON_CT,
                        )?;
                    }
                    CommandOutcome::Ok(CommandKind::Status) => {
                        let json = state.ctl.lock().status_json();
                        req.into_response(200, Some(json.as_str()), JSON_CT)?;
                    }
                    CommandOutcome::Ok(CommandKind::FactoryReset) => {
                        {
                            let mut lock = state.ctl.lock();
                            lock.factory_reset();
                            super::nvs_erase();
                        }
                        req.into_response(200, Some(r#"{"ok":true}"#), JSON_CT)?;
                    }
                    CommandOutcome::Ok(CommandKind::Restart) => {
                        req.into_response(200, Some(r#"{"ok":true}"#), JSON_CT)?;
                        crate::ota::reboot();
                    }
                    CommandOutcome::Ok(CommandKind::Unknown) => {
                        req.into_response(
                            400,
                            Some(r#"{"error":"unknown command"}"#),
                            JSON_CT,
                        )?;
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
                            JSON_CT,
                        )?;
                        return Ok(());
                    }
                    ConfigWrite::InvalidSignature => {
                        req.into_response(
                            401,
                            Some(r#"{"error":"invalid or missing signature"}"#),
                            JSON_CT,
                        )?;
                        return Ok(());
                    }
                    ConfigWrite::Ok => {}
                }
                let resp = r#"{"error":"OTA via API not yet wired - use /update"}"#;
                req.into_response(200, Some(resp), JSON_CT)?;
                Ok(())
            })
            .expect("register handler");
    }

    Ok(server)
}
