<p align="center">
  <img src="docs/images/logo_with_text.svg" alt="OmniRID" width="420">
</p>

<p align="center">
  <a href="https://github.com/VOLTEKOVER/OmniRID-Universal-Drone-ID/actions/workflows/esp32-build.yml"><img src="https://img.shields.io/github/actions/workflow/status/VOLTEKOVER/OmniRID-Universal-Drone-ID/esp32-build.yml?logo=github" alt="CI"></a>
  <img src="https://img.shields.io/badge/BETA-000?logo=esphome&color=f9a825" alt="BETA">
  <a href="https://github.com/VOLTEKOVER/OmniRID-Universal-Drone-ID/releases"><img src="https://img.shields.io/github/v/release/VOLTEKOVER/OmniRID-Universal-Drone-ID?include_prereleases&logo=github&label=version" alt="Release"></a>
  <a href="https://www.espressif.com/"><img src="https://img.shields.io/badge/ESP32%20|%20S3%20|%20C6-000?logo=espressif" alt="Platform"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/VOLTEKOVER/OmniRID-Universal-Drone-ID?color=blue" alt="License"></a>
</p>

<p align="center">
  <img src="docs/images/ardupilot_logo.webp" height="28" alt="ArduPilot">&nbsp;&nbsp;
  <img src="docs/images/betaflight_logo.svg" height="28" alt="Betaflight">&nbsp;&nbsp;
  <img src="docs/images/inav_logo.png" height="28" alt="INAV">
</p>

OmniRID is an **open-source Drone ID transmitter** for ESP32 that turns any flight controller into a standards-compliant Remote ID beacon. It is written in **Rust 🦀**.

- **Input** from any flight controller or direct GPS module: **MAVLink · MSP · NMEA · DroneCAN**
- **Output** to the Remote ID standard: **ASTM F3411-22a** (GB 42590-2023 and FRDID encoders on the roadmap, see issue #46)
- **Broadcast** via **WiFi Beacon + NAN**; BLE support depends on the ESP32 chip

<p align="center">
  <a href="https://github.com/VOLTEKOVER/OmniRID-Universal-Drone-ID"><b>Source</b></a>&nbsp;&nbsp;
  <a href="https://github.com/VOLTEKOVER/OmniRID-Universal-Drone-ID/tree/omnirid-webapp-pwa/OmniRID-app"><b>Ground Station</b></a>&nbsp;&nbsp;
  <a href="./TASKS.md"><b>Backlog</b></a>
</p>

---

> [!CAUTION]
> ## ⚠️ No release until the security audit is complete
>
> **This firmware has not been security tested yet.**
> No official release will be published until a full security audit
> (penetration testing, firmware analysis, protocol fuzzing) has been
> performed and all critical/high findings resolved.
>
> **Do not use on production aircraft.** Development and ground testing only.
> Details in [SECURITY.md](SECURITY.md).

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Features](#features)
3. [Ground Station (Web App / PWA)](#ground-station-web-app--pwa)
4. [Demo & CLI](#demo--cli)
5. [Hardware](#hardware)
6. [Build](#build)
7. [Project Structure](#project-structure)
8. [Documentation](#documentation)
9. [Security](#security)
10. [Contributing](#contributing)
11. [License & Ecosystem](#license--ecosystem)

---

## Quick Start

The old standalone HTML demo was removed together with the static docs site. Hardware is
required, but no flight controller is: the firmware has a built-in **demo mode** that
simulates a GPS patrol.

1. Flash the firmware to your ESP32 (see [Hardware](#hardware) and [Build](#build)).
2. Connect to the WiFi network **ESP-RID**.
3. Start the OmniRID App (see [Ground Station](#ground-station-web-app--pwa)) and point it at `192.168.4.1`.
4. Enable **Demo mode** in the options to get simulated telemetry without a flight controller.

---

## Features

### Input (GPS from flight controller)

| Protocol      | Format                | Details                                                                           |
|---------------|----------------------|-----------------------------------------------------------------------------------|
| **MAVLink v2** | ArduPilot/PX4        | `GPS_RAW_INT`, `GLOBAL_POSITION_INT`, `HEARTBEAT`, `OPEN_DRONE_ID_*`               |
| **MSP**        | Betaflight/iNAV      | `MSP_RAW_GPS` (106), `MSP_ATTITUDE` (108), `MSP_STATUS` (101)                     |
| **NMEA 0183**  | Direct GPS module    | `$GPGGA`, `$GNGGA`, `$GPRMC`, `$GNRMC`, `$GPVTG`, `$GNVTG`                        |
| **DroneCAN**   | CAN bus              | `uavcan.equipment.gnss.Fix2`; AHRS Solution (DTID 1000)                           |

### Output (Remote ID broadcast)

| Medium        | Standard          | Range                        |
|---------------|-------------------|-----------------------------|
| **WiFi Beacon** | IEEE 802.11 Mgmt | ~100 m (typical)            |
| **WiFi NAN**    | Service Discovery | ~100 m                       |
| **BLE 4.x**      | Legacy advertising (ESP32 / S3) | ~50 m                |
| **BLE 5.x**      | Extended advertising (S3) | Hardware and regulatory conditions apply |
| **LoRa**         | (planned)          | ~1000 m                      |

### Protocol Versions
- **Input**: MAVLink v2, MSP v1, NMEA 0183, DroneCAN (CAN‑bus)
- **Output**: ASTM F3411‑22a (Remote ID)

### Radio & protocols

| Feature               | Details                                                                                         |
|----------------------|--------------------------------------------------------------------------------------------------|
| **Broadcast**        | WiFi Beacon + WiFi NAN; BLE legacy on ESP32/S3 and extended advertising on S3. BLE is not implemented on C6. |
| **Input protocols** | MAVLink v2 (ArduPilot/PX4), MSP (Betaflight/iNAV), NMEA, DroneCAN/CAN bus — auto‑detected         |
| **GPS source**       | From flight controller (MAVLink/MSP/NMEA/CAN) or a direct GPS module, with takeoff‑location capture |
| **Position filter** | 1D × 3 Kalman filter (lat/lon/alt) with velocity prediction, 3 s timeout                         |

### Security & compliance

| Feature | Details |
|---|---|
| **Authentication** | Ed25519 signing (ASTM F3411-22a compliant), 4 pages per broadcast cycle |
| **Lock levels** | 3 tiers: Normal / Ed25519 signed / eFuse permanent |
| **Firmware update** | WiFi OTA streams the image and verifies SHA-256; Ed25519 signatures are required at lock level 1. USB flashing is external. |
| **Hardening** | JSON parsing, rate limits, bounded upload sizes, random session tokens and bounded strings |

---

## Ground Station (Web App / PWA)

The PWA includes an **offline fallback page** (`offline.html`) and strict TypeScript checking. It provides device configuration, a live readiness checklist, heap reporting, logs, route history stored in the browser, and firmware OTA upload.


| Component | Stack |
|---|---|
| **Framework** | Nuxt 4 / Vue 3 (Vite + Nitro static) |
| **UI** | Nuxt UI (@nuxt/ui) — device configuration panels, checklists, notifications |
| **PWA** | Nuxt 4 static generate (`nuxt generate`) — service worker + web manifest present (installable when served over HTTPS with correct scope) |
| **State** | Pinia + composables — configuration state and dashboard shell |
| **Server API** | `OmniRID-app/server/routes/api/esp/[...path].ts` — allowlisted, size-bounded proxy used for OTA and same-origin device access; host the Nuxt server to use it |

> **Current boundary**: `OmniRID-app` is a browser **configuration dashboard** for
> the OmniRID ESP32 device. It does **not** contain a browser-side ASTM decoder,
> a BLE/Serial capture pipeline or a PCAP/KML importer — decoding lives in the
> Rust firmware (parsers) and ASTM output is produced on the device. The pages
> talk to the firmware through `/api/*` (via the dev proxy or directly when
> CORS allows it).

Static SPA, no server required for the UI (device access needs the proxy or direct CORS):

```bash
cd OmniRID-app
pnpm install
pnpm dev                # http://localhost:3000 (hot reload)
pnpm build              # static build in OmniRID-app/.output/public
pnpm preview            # serve the build
pnpm typecheck          # vue-tsc
pnpm lint
```

### Current user-visible behavior

1. **ESP connection** — The header shows the connection state and the address
   (`192.168.4.1` by default), verified by a live `GET /api/capabilities`.
   The address popover persists the value in `localStorage` and retries the
   connection; state changes raise info/error notifications.
2. **Readiness checklist** — A side panel reports checks and actionable
   configuration issues, including device capability and conflicting options.
   Live device checks require a connected ESP.
3. **Configuration pages** — Settings load from `GET /api/config`, are
   validated before saving, and are sent with `POST /api/config`; saving is
   blocked while the device is offline.
4. **Notifications** — Connection and configuration events (connection loss/gain, config saved, preset
   applied, import/export) feed the three-level slideover; unread badge,
   mark-all-read and clear are supported.
5. **Tools and memory** — Console reads logs and sends commands; logging
   exports status telemetry as CSV. Memory displays live heap metrics; flash,
   NVS and SD usage are not reported because the firmware does not expose
   reliable usage data for them.
6. **Firmware page** — Uploads `.bin` images through the same-origin proxy in a
   self-hosted Nuxt deployment.
   The app computes SHA-256; the device verifies the digest and requires
   Ed25519 at lock level 1. USB flashing and recovery use an external tool.
7. **Theme** — Light/dark switch shared by header and sidebar.

---

## Demo & CLI

<p align="center">
  <img src="docs/images/dashboard.png" alt="OmniRID Dashboard" width="820">
</p>

The firmware has a built-in **demo mode** (Options bit 3, or the `demo` CLI
command) that simulates a GPS patrol, so no flight controller is required.

### CLI commands (after flashing)

```
> status              # Show GPS, TX rates, identity state
> config get uas_id   # Check config
> transmit 10         # Force 10 packets
> patrol              # Start demo GPS patrol
```

---

## Hardware

### Minimum wiring (ESP32 + flight controller)

```
Flight Controller    ESP32 (or variant)
───────────────────── ─────────────────────
TX (UART)            ->   GPIO16 (UART2 RX)
GND                  ->   GND
5V (BEC)             ->   5V / VIN
```

> **NMEA tap**: add a **1 kΩ series resistor** on the tap line to prevent backfeed.

### Recommended: Seeed XIAO ESP32-C6 (zero-solder kit)

| Feature | Benefit |
|---|---|
| **21 × 17.8 mm** | Fits in any enclosure |
| **USB-C + LiPo charger** | Battery-ready, no soldering |
| **WiFi 6 + BT 5.3** | Better range & throughput |
| **802.15.4 capable** | Future mesh support |
| **U.FL + ceramic antenna** | Switchable antenna, multi-band |
| **Stackable with L76K GNSS** | Direct GPS module option |
| **~$15 total cost** | Best value |

Full BOM: the two tables above; default GPIO mapping lives in
`OmniRID-firmware/hardware/bsp-esp32` (the old `prototype_bom.md` was removed —
it remains in git history).

---

## Build

### CI (no local toolchain)

Every push to `omnirid-webapp-pwa` runs host tests, Clippy and the three ESP32
cross-builds via GitHub Actions. The host build and all three ESP32 targets (`esp32`,
`esp32s3`, `esp32c6`) build locally; see the
[latest builds](https://github.com/VOLTEKOVER/OmniRID-Universal-Drone-ID/actions/workflows/esp32-build.yml)
for the current CI result.

### Host build (Linux / macOS / Windows)

```bash
git clone https://github.com/VOLTEKOVER/OmniRID-Universal-Drone-ID.git
cd OmniRID-Universal-Drone-ID/OmniRID-firmware

cargo build --workspace           # builds all crates for the host
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
```

### ESP32 cross-build

The ESP32 BSP is a standalone workspace in `OmniRID-firmware/hardware/bsp-esp32`.
Xtensa targets need the `esp` toolchain (esp-rs); the RISC-V C6 target needs
nightly with `rust-src` and a RISC-V GCC toolchain.

```bash
cd OmniRID-firmware/hardware/bsp-esp32

# ESP32 / ESP32-S3 (Xtensa, esp toolchain)
RUSTC_BOOTSTRAP=1 cargo +esp build -Z build-std=std,panic_abort \
  --no-default-features --features esp32,hardware --target xtensa-esp32-espidf
RUSTC_BOOTSTRAP=1 cargo +esp build -Z build-std=std,panic_abort \
  --no-default-features --features esp32s3,hardware --target xtensa-esp32s3-espidf

# ESP32-C6 (RISC-V, pinned nightly + rust-src)
RUSTC_BOOTSTRAP=1 cargo +nightly-2026-04-15 build -Z build-std=std,panic_abort \
  --no-default-features --features esp32c6,hardware --target riscv32imac-esp-espidf
```

> Cross-build status: host, ESP32, ESP32-S3 and ESP32-C6 all build locally
> with `-Z build-std`; check the Actions run for the current CI result.

### Flash & connect

| Step | Action |
|:---:|---|
| 1 | Flash the firmware to your ESP32 via USB |
| 2 | Connect to WiFi network **ESP-RID** |
| 3 | Start the OmniRID App (`cd OmniRID-app && pnpm dev`) and connect it to `192.168.4.1` (device AP) to configure |

---

## Project Structure

Rust workspace (members: `firmware/*`, `inputs/*`, `outputs/*`, `external-libs/*`); the ESP32 BSP lives outside as a standalone crate with its own target triple.

```
OmniRID-Universal-Drone-ID/
├── OmniRID-firmware/            # Rust workspace root
│   ├── Cargo.toml                # Workspace manifest
│   │
│   ├── firmware/                 # Firmware crates
│   │   ├── app/                  # Binary entry point
│   │   ├── rid-core/             # Core logic (no_std, alloc)
│   │   ├── rid-app/              # Application layer (JSON API, CLI, NVS, OTA)
│   │   ├── rid-interface/        # Shared traits/interfaces
│   │   └── bsp-sim/              # Simulated board support (host tests)
│   │
│   ├── inputs/                   # Protocol parsers
│   │   ├── proto-mavlink/
│   │   ├── proto-msp/
│   │   ├── proto-nmea/
│   │   ├── proto-dronecan/
│   │   └── proto-usb-mavlink/
│   │
│   ├── outputs/
│   │   └── out-astm/             # ASTM F3411-22a output
│   │
│   ├── external-libs/
│   │   └── opendroneid-sys/      # OpenDroneID C FFI bindings (vendored)
│   │
│   ├── hardware/
│   │   └── bsp-esp32/            # ESP32 board support (standalone workspace)
│   │
│   └── scripts/                  # Build/helper scripts
│
├── OmniRID-app/                  # Ground station (Nuxt 4 PWA)
│   ├── nuxt.config.ts            # Nuxt + UI + state config (SPA, no server)
│   ├── package.json
│   ├── app/                      # Source (layouts, pages, components, composables)
│   │   ├── pages.config.ts       # Navigation manifest (4 groups, page status)
│   │   ├── layouts/default.vue   # Dashboard shell (sidebar, header, search)
│   │   ├── pages/                # dashboard, firmware, guide, tx/*, rx/* (one file per sidebar page)
│   │   ├── components/           # device/ConfigPage, SectionTabs, ConsoleTerminal, …
│   │   └── composables/          # useDashboard, useEspConnection, useDeviceProfile, useNotifications, …
│   ├── server/routes/api/esp/    # Dev/self-hosted proxy to the device (absent in static build)
│   └── public/                   # Static assets (icons, images, manifest)
│
├── docs/                         # Images only (static docs site removed)
│   └── images/
│
├── TASKS.md                      # Consolidated project backlog / roadmap
├── 3D_FILES/                     # Enclosure/casing 3D models
├── .github/workflows/            # CI (esp32-build, protocol-updates, release, security-audit)
│
├── SECURITY.md
├── LICENSE                       # Apache 2.0
└── README.md
```

---

## Documentation

| Resource | Link |
|---|---|
| **Project backlog** | [`TASKS.md`](TASKS.md) |
| **Hardware BOM** | See the hardware section |
| **API Reference** | Headless `/api/*` JSON endpoints with CORS; also described in the in-app Guide page |

---

## Security

### Authentication (lock system)

| Level | Name | Behavior |
|:---:|---|---|
| **0** | Normal | No restrictions, full read access to config |
| **1** | Ed25519 signed | Signature required for `POST /api/config`, `/api/reset`, `/api/command` |
| **2** | eFuse permanent | Reads the magic value in `EFUSE_BLK3`; irreversible (chip erase only) |

### OTA updates

`POST /ota` is implemented as a streamed firmware upload. The app computes the
image digest and forwards the binary through the allowlisted proxy; the device
checks the expected digest, declared length and signature policy before
finishing the update. A reboot is deferred until the HTTP response can finish.
Use USB/serial flashing for first installation and recovery. Device-level
disconnection and rollback behavior still require hardware verification.

- **Client-side SHA-256** computed with the Web Crypto API
- **`X-Expected-SHA256`** header (required at every lock level)
- **`X-Signature`** header (required when lock level ≥ 1; level 2 blocks OTA)
- Server-side SHA-256 and Ed25519 verification during streaming
- Rollback/recovery remains hardware-dependent and needs on-device verification

### Hardening

- **Safe JSON parsing** — all web API inputs are validated (no unsafe `cJSON` in Rust)
- **Rate limiting** — 10 failed signature attempts per 60 s sliding window
- **Bounded strings** — all string fields use stack-allocated or length-bounded types
- **No unsafe in hot paths** — memory safety enforced by Rust's type system at compile time

### Key storage

- The Ed25519 **private key** is stored in NVS in plaintext (flash encryption is not enabled by default, see issue #47)
- Up to **5 public keys** are supported for command authentication at each lock level
- Once flash encryption lands, enable `CONFIG_SECURE_FLASH_ENC` on production builds

---

## Contributing

1. Use Rust edition 2024 and follow `rustfmt` defaults.
2. Run `cargo test --workspace` and `cargo clippy --workspace --all-targets -- -D warnings` before submitting.
3. Test on at least one target.
4. Update documentation for significant changes.
5. Open a PR with a description and hardware test notes.

Full checklist: [`PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md)

---

## License & Ecosystem

```
OmniRID — Open Drone ID transmitter for ESP32
Copyright (C) 2024-2026 VOLTEKOVER

Based on Intel Open Drone ID (https://github.com/opendroneid)
Copyright (C) 2019-2023 Intel Corporation

Licensed under the Apache License, Version 2.0.
See the LICENSE file for details.
```

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/VOLTEKOVER">VOLTEKOVER</a>
</p>
