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
        "Content-Type, X-Signature, X-Expected-SHA256",
    ),
];

/// Preflight response headers: echo the request headers/methods the PWA
/// may send (JSON bodies, Ed25519 signatures, OTA hash).
const CORS_PREFLIGHT: &[(&str, &str)] = &[
    ("Access-Control-Allow-Origin", "*"),
    ("Access-Control-Allow-Methods", "GET, POST, OPTIONS"),
    (
        "Access-Control-Allow-Headers",
        "Content-Type, X-Signature, X-Expected-SHA256",
    ),
    ("Access-Control-Max-Age", "86400"),
];

/// Maximum accepted body for `POST /api/config` (the whole config document).
const MAX_CONFIG_BODY: usize = 16 * 1024;

/// Maximum accepted body for `POST /api/reset` and `POST /api/command`.
const MAX_CMD_BODY: usize = 4 * 1024;

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
                    match write_decision(&state, &body, sig.as_deref()) {
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
                        ConfigWrite::Ok => {}
                    }
                    let applied = {
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
                    match write_decision(&state, &body, sig.as_deref()) {
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
                    match command_decision(&state, &body, sig.as_deref()) {
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
                            let _ = std::thread::Builder::new().stack_size(4096).spawn(|| {
                                std::thread::sleep(std::time::Duration::from_millis(300));
                                crate::ota::reboot();
                            });
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

    // POST /ota — reserved for firmware uploads.
    //
    // The upload pipeline (streaming into the OTA partition + hash/signature
    // verification) is not implemented in this build, so the request is
    // rejected up front — before any body is buffered: holding a whole
    // update image in RAM would be an easy memory-exhaustion vector.  The
    // signed-action gate must come back together with the real
    // implementation (there is nothing to protect while the endpoint only
    // answers 501).
    {
        server
            .fn_handler("/ota", Method::Post, move |req| -> Result<(), EspIOError> {
                send_json(
                    req,
                    501,
                    r#"{"error":"OTA not implemented; flash via serial/USB"}"#,
                )?;
                Ok(())
            })
            .expect("register handler");
    }

    Ok(server)
}
