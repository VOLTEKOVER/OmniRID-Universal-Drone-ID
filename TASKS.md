# Project Tasks & Roadmap

## Completed tasks (as of 2026‑10‑30)
- **Firmware**: Updated `cc` crate to v1.10, fixed UART re‑init placeholder after config changes. (Commit `fix(firmware): update cc dependency and re‑init UART via USB CDC`)
- **PWA**: Enabled strict TypeScript mode, added offline fallback page (`public/offline.html`), enhanced Service Worker caching, upgraded Nuxt to 4.6.3 and related dependencies. (Commit `feat(pwa): enable strict TypeScript, add offline fallback page, improve service worker`)
- **Documentation**: Updated `README.md` with offline support note and dependency upgrades.
- **Dependency audit**: Bumped `@iconify-json/lucide`, `@types/node`, `nuxt`.

## In‑progress / pending tasks
- Resolve strict‑mode TypeScript errors (≈ 1 k errors) to improve type safety across the PWA.
- Implement OTA end‑to‑end support in the UI (currently a stub) and align UI with firmware `POST /ota`.
- Align Wi‑Fi credential length limits between firmware (MAX_STR_LEN = 63) and UI (currently 32).
- Add CI job for the PWA (lint, typecheck, build) to the GitHub workflow.
- Document OTA workflow and security hardening steps in `SECURITY.md`.
- **Web UI / ground‑station polish backlog** (issue #54) – UI/UX improvements, polish, accessibility.
- **GNSS advanced options** – expose constellation/SBAS/NMEA rate/GNSS enable toggles if supported by firmware.
- **DroneCAN AHRS / Identity** – implement AHRS and Identity parsing (issue #52).
- **Non‑ASTM output encoders** – GB 42590 / FRDID support (issue #46).
- **BLE 5.0 Long Range on ESP32‑C6** – enable and test long‑range BLE.
- **ESP‑NOW mesh relay** – multi‑hop range extension (issue #29).
- **LoRa SX1262 backup** – integrate LoRa radio backup link (issue #29).
- **SD‑card + geofence logging** – flight‑log recovery and geofence storage (issue #29).
- **Ground tools** – timing analysis, NVS provisioning, Meshtastic bridge, mesh mapper (issue #53).
- **Refactors & portability** – code refactors (issue #26) and dependency management (issue #27).
- **Xtensa cross‑build failure** – investigate and fix link failures on ESP32/ESP32S3 (issue #43).
- **ESP‑IDF 6 / `esp-idf-sys` 0.38** – address binding and opaque structs issues (issue #43).
- **TypeScript 7 migration** – upgrade to TS 7 once compatibility issues resolved.
- **Docs policy** – keep `docs/` for images only; remove stale documentation links.
- **`sdkconfig.defaults` comment** – update reference to removed security‑hardening doc (pending if firmware touched).

## Future roadmap (high‑level)
- **LoRa support**: integrate LoRa radio driver and expose as an additional broadcast medium.
- **Non‑ASTM encoders**: implement GB 42590 / FRDID encoders (issue #46).
- **Flash encryption**: enable ESP‑IDF flash encryption (eFuse AES‑256) for secure OTA.
- **DroneCAN identity**: decode identity/AHRS from DroneCAN (issue #52).
- **Advanced UI polish**: improve UX polish, theme customization, and desktop client.
- **Security audit**: complete full penetration testing and address all critical findings before any production release.

---
*Keep this file updated as tasks are completed or new ideas emerge.*
