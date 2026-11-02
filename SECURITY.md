# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest `omnirid-webapp-pwa` | Yes |
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
- **Firmware update** over USB/serial, or OTA via `POST /ota` (SHA-256 + Ed25519 validation, dual-OTA partition with rollback)
- **Key management** — Ed25519 keys stored in NVS (flash encryption on the roadmap, see issue #47)

### Hardening checklist

These features are **not enabled by default**. See the current gaps at the end
of this file and the firmware backlog in
[`todolist/firmware-todo.md`](todolist/firmware-todo.md).

**Device (the only real boundary):**

1. **Protect the WiFi AP.** The AP password defaults to empty (open network).
   Set a WPA2-PSK password from the configuration, change the SSID, and keep
   the device off untrusted networks.
2. **Use lock level ≥ 1.** Sensitive writes then require either a password-authenticated
   app session (`X-App-Token`) or an Ed25519 `X-Signature` (`POST /api/config`,
   `/api/reset`, `/api/command`). The PWA signs in to obtain the session token; the
   CLI and the Console's manual signature field can be used for Ed25519.
3. **Enable Secure Boot v2 + Flash Encryption** in production (both protect the
   *device*, not a published `.bin`). They are not enabled in the default
   `sdkconfig` yet — see issue #47.
4. **Treat the device as physically reachable:** USB/serial access is a full
   compromise unless Secure Boot/Flash Encryption are enabled.
5. **Flash firmware over USB/serial** — OTA is not implemented (see below).

**Web app (damage limitation only):**

- No secrets are embedded in the app; all authorisation is enforced on the device.
- The production build minifies and obfuscates the bundle (raises cost only — not security).
- Static hosting cannot send response headers; on a **self-hosted** deployment set
  a CSP (`connect-src` must allow the device address, `img-src` the map tile host).
- Whoever serves the app can modify it: use a trusted origin and verify the
  device address.

### What is (and is not) protectable

- A **client-side web app cannot be protected from reverse engineering**: its
  HTML/CSS/JS are delivered to the browser. Minification/obfuscation only raise
  the cost. **No secret may be embedded in the app** — and none is.
- A **distributed firmware image cannot be protected from reverse engineering.**
  Secure Boot prevents *running* modified firmware; Flash Encryption prevents
  *reading* flash. Neither hides a published `.bin`.
- The web app is treated as **untrusted**: all authorisation is enforced on the
  device.

### Hosting

The app is a **static SPA**. There is no server in the static build, so the
`/api/esp/**` proxy (development and self-hosted `nuxt build` only) does not
exist there.

- On a **static HTTPS host** (e.g. GitHub Pages), browsers block
  HTTPS→HTTP requests to `http://192.168.4.1` as *mixed content*. Real device
  control therefore needs a self-hosted deployment with the proxy, or the app
  served over HTTP/localhost where direct CORS requests are allowed. The
  firmware sends permissive CORS headers + `OPTIONS` preflight on every route.
- WebSerial flashing works over HTTPS.
- The old hosted docs/demo site has been removed; `docs/` now contains only
  images.

### Web Configuration

The firmware is **headless**: it serves only a JSON API on the AP network
(`192.168.4.1`), with permissive CORS and `OPTIONS` preflight. Configuration is
edited through the external PWA (or `curl`).

- At **lock level 0**, no authentication is required for config changes.
- At **lock level ≥ 1**, `POST /api/config`, `POST /api/reset` and signed
  commands on `POST /api/command` require either a valid `X-App-Token` session
  or an `X-Signature` header (Ed25519). Failures share a rate limiter
  (10 failed attempts / 60 s → HTTP 429).
- The PWA obtains an `X-App-Token` session after password login, so locked
  devices can also be configured from the browser.

### Firmware Updates

**OTA is implemented.** `POST /ota` validates the upload (SHA-256 via
`X-Expected-SHA256`, Ed25519 via `X-Signature` at lock ≥ 1), writes to the
inactive OTA partition, selects it and reboots; a failed update keeps the
running image. The validators are tested in `firmware/rid-app/src/ota.rs`.
The PWA does not yet expose the OTA upload UI — use USB/WebSerial or call the
endpoint directly.

### Security Hardening

- **Safe JSON parsing** — all JSON inputs parsed with `serde_json` (no unsafe C parsers)
- **Rate limiting** — 10 failed signature attempts per 60s sliding window, then lockout
- **Safe string handling** — bounded types (`MAX_STR_LEN`) and Rust's ownership model prevent buffer overflows
- **Shared verification module** — `rid-core::security` used by the web handlers and the OTA validators

### Known gaps (tracked, not yet closed)

- **Flash Encryption / Secure Boot v2 are not enabled** in the default
  `sdkconfig` (issue #47). The Ed25519 private key is stored in NVS in plaintext.
- Not a gap anymore: locked devices can be configured from the browser after
  password login (`X-App-Token` session); Ed25519 signatures remain available
  for CLI/advanced use.
- Not a gap anymore: `POST /ota` is wired to the validators in
  `rid-app::ota` (hash/signature checks, dual-OTA partition, reboot). The app
  upload UI is still pending.
