# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest universal | Yes |
| < latest | No |

## Reporting a Vulnerability

If you discover a security vulnerability in ESP Remote ID, please report it
responsibly. **Do not open a public GitHub issue for security vulnerabilities.**

Instead, please email the maintainers or use
[GitHub's private vulnerability reporting](https://github.com/VOLTEKOVER/OmniRID-Universal-Drone-ID/security/advisories/new).

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### What to expect

- Acknowledgment within 48 hours
- Assessment within 1 week
- Fix or mitigation plan communicated to you

## Security Considerations

This project implements a **WiFi AP + REST API** Remote ID transmitter:

- **Web config server** runs on `192.168.4.1` (AP network) — no inbound internet exposure
- **Authentication pages** available via Ed25519 signing (ASTM F3411-22a compliant)
- **3-tier lock system**: Level 0 (open), Level 1 (Ed25519 signed commands), Level 2 (eFuse permanent)
- **OTA updates** with SHA-256 integrity + optional Ed25519 signature verification
- **Key management** — Ed25519 keys stored in NVS (flash encryption on the roadmap, see issue #47)

### Hardening guide

See [`docs/security-hardening.md`](docs/security-hardening.md) for the full
threat model and the step-by-step procedure to enable WPA2 on the AP, the lock
system, and Secure Boot v2 + Flash Encryption. Those features are **not enabled
by default**.

### What is (and is not) protectable

- A **client-side web app cannot be protected from reverse engineering**: its
  HTML/CSS/JS are delivered to the browser. Minification/obfuscation only raise
  the cost. **No secret may be embedded in the app** — and none is.
- A **distributed firmware image cannot be protected from reverse engineering.**
  Secure Boot prevents *running* modified firmware; Flash Encryption prevents
  *reading* flash. Neither hides a published `.bin`.
- The web app is treated as **untrusted**: all authorisation is enforced on the
  device.

### GitHub Pages hosting

The app is published as a **static SPA** to GitHub Pages, where **no server
runs**. Consequently the `/api/esp/**` proxy (local development and self-hosted
deployments only) is absent, and browsers block HTTPS→HTTP access to the device
(mixed content), which also sends no CORS headers. On GitHub Pages the app is
usable in **simulated mode** and as documentation; real device control over WiFi
requires the device's own UI or a self-hosted deployment of the app.

### Web Configuration

The web configuration interface is served on the AP network (192.168.4.1) with
optional WPA2-PSK password protection. At lock level 0, no authentication is
required for config changes. At level ≥ 1, all POST requests to `/api/config`
and `/ota` require an `X-Signature` header (Ed25519 signature over the SHA-256
hash of the body).

### Firmware Updates

OTA updates are uploaded via the web UI as HTTP POST to `/ota`. The browser
computes a SHA-256 hash (Web Crypto API) sent as `X-Expected-SHA256` header.
The server independently verifies the hash. At lock level ≥ 1, an Ed25519
signature (`X-Signature` header) is also required. A dual-OTA partition scheme
ensures automatic rollback on failure.

### Security Hardening

- **Safe JSON parsing** — all JSON inputs parsed with `serde_json` (no unsafe C parsers)
- **Rate limiting** — 10 failed signature attempts per 60s sliding window, then lockout
- **Safe string handling** — Rust's ownership model prevents buffer overflows
- **psa_crypto_init()** — PSA Crypto API initialized at boot for ESP-IDF v5+
- **Shared verification module** — `rid-core::security` used by both web config and OTA

### Known gaps (tracked, not yet closed)

The Rust HTTP layer `hardware/bsp-esp32/src/web.rs` does **not yet enforce** the
lock-level / `X-Signature` checks on `POST /api/config`, `POST /api/reset` and
`POST /ota`; the logic exists and is tested in `rid-app/src/web_config.rs` but is
not wired into the handlers. Until then, lock level ≥ 1 is not enforced on the
Rust firmware. Closing this is the highest-impact firmware security task. See
`docs/security-hardening.md` §6 for details.
