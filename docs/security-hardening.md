# Security Hardening Guide

This document describes how to harden an OmniRID device and how to reason about
the security of the web app. Read the **Threat model** section first: it explains
what is and is not achievable, so that effort is spent where it actually helps.

---

## 1. Threat model — be clear about the limits

| Goal | Achievable? | Why |
|------|-------------|-----|
| Stop reverse engineering of the **web app** | **No** | HTML/CSS/JS are delivered to the browser. Anyone can read them. Minification and obfuscation only raise the cost; they are not protection. |
| Stop reverse engineering of a **distributed firmware image** | **No** | If you publish a `.bin`, anyone can disassemble it. Secure Boot/Flash Encryption protect the *device*, not the image. |
| Stop **tampering** with firmware on a device | **Yes** | Secure Boot v2 refuses to boot unsigned/modified firmware. |
| Stop **reading** secrets (WiFi password, keys) from a stolen/dumped device | **Yes** | Flash Encryption makes flash (including NVS) unreadable via physical access. |
| Stop unauthorised **config changes / commands** from the network | **Yes** | Lock level ≥ 1 requires an Ed25519 `X-Signature` on every write. |
| Make a **hacked client** useless | **Yes** | The client holds no secrets. All authorization lives on the device. |

**The core principle:** treat the web app and the browser as *untrusted*. Never
put a secret in the client. All trust, keys, and authorisation checks live on the
device.

**"Unhackable" does not exist.** The realistic goal is to make attacks
expensive and to ensure that a compromised client gains nothing.

---

## 2. Device hardening (this is where real protection lives)

### 2.1 Protect the WiFi AP (do this first)

The device exposes an access point (default SSID `ESP-RID`). If it is **open**
(no password), anyone in radio range can join it and read `GET /api/config`,
which includes the stored WiFi password and identity fields.

Set a WPA2-PSK password before deployment. Either:

* Via the web UI: **Configuration → Network → WiFi password** (persisted in NVS), or
* Via the CLI: `set wifi_password <value>`, or
* Via `POST /api/config` with `{"wifi_password":"<value>"}`.

`hardware/bsp-esp32/src/wifi.rs` selects `WPA2Personal` whenever a non-empty
password is configured; an empty password means an **open** AP. Prefer a long,
unique passphrase per device.

> Optional hardening (not enabled by default): ship a non-empty default AP
> password, and/or keep the config server reachable only from the AP interface.

### 2.2 Lock the device (Ed25519-signed writes)

The firmware implements a 3-tier lock system:

| Level | Behaviour |
|-------|-----------|
| 0 | Open — writes need no signature |
| 1 | Every write (`/api/config`, `/api/command`, `/ota`) requires a valid `X-Signature` |
| 2 | Irreversible — eFuse magic burned; `get_lock_level()` always returns 2 |

At level ≥ 1 the device verifies an Ed25519 signature over the request body
(`X-Signature`) and rate-limits failed attempts (10 / 60 s sliding window).

Generate a keypair, register the public key in NVS, and raise the lock level
*before* the device is deployed. Once at level 2 the setting cannot be lowered.

### 2.3 Secure Boot v2 + Flash Encryption (protects firmware and NVS)

These are **disabled by default** in
`OmniRID-firmware/hardware/bsp-esp32/sdkconfig.defaults` (see the commented
block at the end of the file). They are **one-way** operations that burn eFuses.

#### Enable them safely

1. **Generate a signing key** (Secure Boot v2 uses ECDSA-P256 by default):
   ```bash
   espsecure.py generate_signing_key --version 2 secure_boot_signing_key.pem
   ```
   Back it up **offline**. Losing it means you can never sign another firmware
   for that device.

2. **Configure via menuconfig** (preferred over editing defaults, because the
   exact option names differ between IDF versions):
   ```bash
   idf.py menuconfig
   #  Security features ->
   #    [*] Enable Secure Boot in bootloader
   #    (2)   Secure boot version
   #    (secure_boot_signing_key.pem) Secure boot signing key
   #    [*] Enable Flash Encryption on boot
   #    (Release) Flash encryption mode
   #  Security features -> Potentially insecure options ->
   #    [ ] Enable insecure Secure Boot / Flash Encryption  (leave OFF)
   ```

3. **First flash in "development" mode**, verify the device boots, then burn the
   `RELEASE` eFuses (this is the irreversible step).

4. **Protect the eFuses**: enable Secure Boot digest + key read protection, and
   Flash Encryption key read protection, so the keys cannot be read back.

#### What this buys you

* A dumped flash chip yields ciphertext — the WiFi password and Ed25519 keys in
  NVS are not readable.
* Flashing a modified firmware image fails signature verification.

#### Risks

* Irreversible. A bad key or a lost key bricks the device.
* Must be provisioned per device (or with a securely managed shared key).
* Does **not** protect a firmware image you publish for download.

### 2.4 Transport security (in transit)

The on-device HTTP server runs **plain HTTP over the AP**. WPA2-PSK encrypts the
wireless link, so data in transit is protected *within the AP* but not against a
client that has joined the AP. If you need end-to-end transport protection, add a
TLS (HTTPS) server with a self-signed certificate — note that browsers will show
a certificate warning, and the PWA `connect-src` policy must allow it.

### 2.5 Device hardening checklist

- [ ] WPA2 passphrase set on the AP (not open).
- [ ] Lock level ≥ 1, with the Ed25519 public key registered in NVS.
- [ ] Lock level 2 burned for permanently-deployed devices.
- [ ] Secure Boot v2 enabled + signing key backed up offline.
- [ ] Flash Encryption enabled (Release mode) + eFuse read protection.
- [ ] Firmware signing key and encryption key stored offline, access-controlled.

---

## 3. Web app security (damage limitation)

The app is a **thin, untrusted client**. It must never be the place where
security is enforced.

### 3.1 Rules

* **Never embed secrets** in the app: no API keys, no private keys, no
  credentials. This is currently true — keep it that way.
* All authorisation is enforced **on the device**, not in the UI.
* Treat every response as untrusted input.

### 3.2 Build hardening already applied

* **Source maps disabled** in production (`sourcemap: false` in `nuxt.config.ts`)
  — shipping `.map` files makes the bundle trivial to reconstruct.
* **Nuxt DevTools disabled** in production builds.
* **`Referrer-Policy: no-referrer`** meta tag.
* **Dependency auditing**: `cargo audit` / `cargo deny` for firmware, and
  `npm audit` for the web app (see CI).
* **GitHub Actions pinned by commit SHA**; Dependabot enabled.

### 3.3 JavaScript obfuscation (optional, best-effort)

The production build can be obfuscated (`npm run obfuscate`, wired into
`npm run build`). This raises the cost of casual reverse engineering. It is
**not** security: a determined attacker can still de-obfuscate. Never rely on it
to protect anything.

### 3.4 Content Security Policy

GitHub Pages cannot send HTTP response headers, so a strict CSP is not
practically enforceable there. On a self-hosted deployment, set a CSP
(`img-src` must allow the map tile host; `connect-src` must allow the device
address; `style-src` typically needs `'unsafe-inline'` for the UI framework).

---

## 4. Hosting on GitHub Pages — architectural notes

The web app is built as a **static single-page application** and published to
GitHub Pages (see `.github/workflows/deploy-pages.yml`). This has consequences:

* **There is no server.** The Nitro API route `/api/esp/**` (the hardened proxy)
  does **not** exist on GitHub Pages. It only runs during local development and
  on a self-hosted (`nuxt build`) deployment.
* **Mixed content.** GitHub Pages is HTTPS. A page served over HTTPS cannot make
  an `fetch()` to the device at `http://192.168.4.1` — browsers block it as
  *mixed content*. The device also sends no CORS headers, so the request would
  be blocked anyway.
* Therefore, on GitHub Pages the app is usable in **simulated/virtual mode**
  and as documentation. Real device control over WiFi requires either the
  device's own web UI (`http://192.168.4.1`) or a self-hosted deployment of the
  app with its proxy. WebSerial (USB) flashing works over HTTPS.

Do not assume the Pages-hosted client can talk to the LAN device.

---

## 5. Repository / GitHub hardening

* Enable **2FA** on the organisation/account.
* Protect the deployment branch: required reviews, no force-push, signed commits.
* Protect the `github-pages` **environment** (deployment branches + reviewers).
* Keep Actions pinned to SHAs (already done) and review Dependabot PRs.
* Never commit keys. Signing/encryption keys stay offline.

---

## 6. Known gaps in this repository (tracked, not yet closed)

* **HTTP handlers do not yet enforce signatures.**
  `OmniRID-firmware/hardware/bsp-esp32/src/web.rs` registers `/api/config`
  (POST) and `/api/reset` (POST) handlers that currently apply changes without
  calling the lock-level / `X-Signature` checks implemented in
  `rid-app/src/web_config.rs`. Until this is wired up, lock level ≥ 1 is **not**
  enforced on the Rust firmware. The pure logic and its tests already exist;
  the HTTP layer needs to pass the lock level and the `X-Signature` header into
  `signed_action_decision` / `handle_command`.
* **OTA via the API is not wired.** `POST /ota` returns "not yet wired"; the
  browser computes `X-Expected-SHA256` and (at lock ≥ 1) `X-Signature`, but the
  server does not yet read or verify those headers.
* **`POST /api/reset` is unauthenticated** in the same handler (factory reset
  should require a signature at lock ≥ 1, mirroring `handle_command`).

Closing these is the single highest-impact firmware security task.
