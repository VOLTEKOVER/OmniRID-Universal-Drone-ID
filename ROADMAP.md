# Roadmap

## Short‑term (next 1–2 weeks)
- ✅ Finish fixing strict‑mode TypeScript errors; `pnpm typecheck`, `pnpm lint` and `pnpm build` pass.
- ✅ OTA upload UI, same-origin ESP proxy, streaming firmware validation, and response-safe reboot are implemented; device-level rollback/disconnection testing remains.
- ✅ Add CI pipeline for the PWA (lint, typecheck, build) to GitHub Actions.
- ✅ Align Wi‑Fi credential length limits between firmware and UI (completed).
- **Web UI / ground‑station polish backlog** (issue #54) – improve UX, accessibility, and visual polish.
- **GNSS advanced options** – expose constellation/SBAS/NMEA rate/GNSS enable toggles if supported by firmware.
- **Docs policy** – keep `docs/` for images only; remove stale documentation links.
- ✅ Update `sdkconfig.defaults` comment to reference `SECURITY.md`.
- **TypeScript 7 migration** – defer until typescript-eslint supports TS 7.0; the attempted upgrade currently breaks lint.

## Medium‑term (1–2 months)
- Implement LoRa broadcast support (hardware driver, config UI).
- Add non‑ASTM Remote ID encoders (GB 42590, FRDID) (issue #46).
- Enable flash encryption and secure OTA signatures.
- Add DroneCAN Identity parsing (AHRS Solution parsing is implemented; Identity still needs a confirmed DSDL/signature) (issue #52).
- **BLE 5.0 Long Range on ESP32‑C6** – firmware currently does not implement BLE on C6; do not expose this capability until driver support and hardware tests exist.
- **ESP‑NOW mesh relay** – multi‑hop range extension (issue #29).
- **SD‑card + geofence logging** – flight‑log recovery and geofence storage (issue #29).
- **Ground tools** – timing analysis, NVS provisioning, Meshtastic bridge, mesh mapper (issue #53).
- **Refactors & portability** – code refactors (issue #26) and dependency management (issue #27).
- **Xtensa cross‑build failure** – investigate and fix link failures on ESP32/ESP32S3 (issue #43).
- **ESP‑IDF 6 / `esp-idf-sys` 0.38** – resolve binding and opaque struct issues (issue #43).

## Long‑term (3+ months)
- Full security audit and hardening (fuzzing parsers, memory safety checks).
- Desktop client with advanced diagnostics and log export.
- Integration with external mapping services (e.g., AirMap, OpenSky).
- Community contributions: plugin system for custom encoders.

---
*This roadmap is a living document; dates and priorities may shift as the project evolves.*
