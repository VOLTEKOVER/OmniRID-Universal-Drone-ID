# Project Tasks & Roadmap

## Completed tasks (as of 2026‑11‑02)
- **PWA quality gate**: `pnpm typecheck`, `pnpm lint` and `pnpm build` are clean (0 errors/problems); the six `v-html` guide renders now go through a whitelist `GuideRichText` renderer.
- **CI**: `.github/workflows/pr-checks.yml` runs the PWA lint/typecheck/build with pnpm (matching `packageManager`/`pnpm-lock.yaml`).
- **Firmware**: `cargo fmt --check`, clippy, build and tests are green; `POST /ota` is wired to `rid_app::ota`; USB re-init is gated by chip/`mavlink_usb_enable`.
- **Firmware cross-builds**: `esp32`, `esp32s3` and `esp32c6` all build locally with `-Z build-std`; the Xtensa link failure from issue #43 is not reproducible after the build fixes (libc pinned to 0.2.189 for the ESP-IDF `stat` ABI).
- **Docs/cleanup**: README/CONTRIBUTING test count corrected to 307; `SECURITY.md` OTA/session text refreshed; `sdkconfig.defaults` points at `SECURITY.md`; root placeholder npm files and committed PWA archives removed.
- **Firmware** (2026‑10‑30): Updated `cc` crate to v1.10, fixed UART re‑init placeholder after config changes. (Commit `fix(firmware): update cc dependency and re‑init UART via USB CDC`)
- **PWA** (2026‑10‑30): Enabled strict TypeScript mode, added offline fallback page (`public/offline.html`), enhanced Service Worker caching, upgraded Nuxt to 4.6.3 and related dependencies. (Commit `feat(pwa): enable strict TypeScript, add offline fallback page, improve service worker`)
- **Documentation** (2026‑10‑30): Updated `README.md` with offline support note and dependency upgrades.
- **Dependency audit** (2026‑10‑30): Bumped `@iconify-json/lucide`, `@types/node`, `nuxt`.

## In‑progress / pending tasks
- ✅ Resolve strict‑mode TypeScript errors — `pnpm typecheck` is clean.
- Implement the OTA upload UI in the app (firmware `POST /ota` is implemented and gated by `X-Expected-SHA256` / `X-Signature`; only the app upload UI is pending).
- **App deep review** – proxy/SSRF handling, service worker caching, auth middleware, polling leaks, and firmware↔app field/limit mismatches.
- ✅ Align Wi‑Fi credential length limits between firmware (MAX_STR_LEN = 63) and UI (now 32).
- ✅ Add CI job for the PWA (lint, typecheck, build) to the GitHub workflow.
- ✅ Document OTA workflow and security hardening steps in `SECURITY.md`.
- **Web UI / ground‑station polish backlog** (issue #54) – UI/UX improvements, polish, accessibility.
- **GNSS advanced options** – expose constellation/SBAS/NMEA rate/GNSS enable toggles if supported by firmware.
- **DroneCAN AHRS / Identity** – implement AHRS and Identity parsing (issue #52).
- **Non‑ASTM output encoders** – GB 42590 / FRDID support (issue #46).
- **BLE 5.0 Long Range on ESP32‑C6** – enable and test long‑range BLE.
- **ESP‑NOW mesh relay** – multi‑hop range extension (issue #29).
- **LoRa SX1262 backup** – integrate LoRa radio backup link (issue #29).
- **SD‑card + geofence logging** – flight‑log recovery and geofence storage (issue #29).
- **Ground tools** – timing analysis, NVS provisioning, Meshtastic bridge, mesh mapper (issue #53).
- **Refactors & portability** – code refactors (issue #26) and dependency management (issue #27).
- ✅ **Xtensa cross-build** – `esp32`/`esp32s3` build locally; the issue #43 link failure was not reproduced after the build fixes.
- **Firmware deep review** – review the firmware core, protocol parsers, `out-astm`, and the `bsp-esp32` web API / FFI.
- **ESP‑IDF 6 / `esp-idf-sys` 0.38** – address binding and opaque structs issues (issue #43).
- **TypeScript 7 migration** – upgrade to TS 7 once compatibility issues resolved.
- **Docs policy** – keep `docs/` for images only; remove stale documentation links.
- **`sdkconfig.defaults` comment** – ✅ updated to reference `SECURITY.md`.


## In‑progress / pending strategic priorities
- 🔢 **1. Repository optimization** – distinguishes sources, tools, artifacts; 167K file review; `target/`, `.gitignore`, Cargo cache, Python venvs cleanup; goal: clear separation of sources vs artifacts
- 🔧 **2. Configuration consistency** – centralize 60+ firmware settings; cross‑check Rust (`device.rs`), TypeScript (`device.ts`, `guide.ts`), Vue (`firmware.vue`); automate convergence validation
- 🛡️ **3. OTA reliability** – test firmware uploads of varied sizes, wrong hash, missing/invalid signature, device disconnection mid‑upload, reboot after update, rollback/recovery from failed OTA
- 📊 **4. Hardware compatibility matrix** – verify Wi‑Fi/BLE/UART/DroneCAN/WebSerial per target (ESP32/ESP32-S3/ESP32-C6); fill support matrix; document non‑supported combos
- ✅ **5. Automated testing** – Rust/TS parameter validation, OPTIONS bitmask, lock levels, OTA security, frontend‑firmware API compat, all three target compatilities

## Future roadmap (high‑level)
- **LoRa support**: integrate LoRa radio driver and expose as an additional broadcast medium.
- **Non‑ASTM encoders**: implement GB 42590 / FRDID encoders (issue #46).
- **Flash encryption**: enable ESP‑IDF flash encryption (eFuse AES‑256) for secure OTA.
- **DroneCAN identity**: decode identity/AHRS from DroneCAN (issue #52).
- **Advanced UI polish**: improve UX polish, theme customization, and desktop client.
- **Security audit**: complete full penetration testing and address all critical findings before any production release.

---
*Keep this file updated as tasks are completed or new ideas emerge.*
