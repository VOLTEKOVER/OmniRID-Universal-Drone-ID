# Project Tasks & Roadmap

## Completed tasks (as of 2026‑10‑30)
- **Firmware**: Updated `cc` crate to v1.10, fixed UART re‑init placeholder after config changes. (Commit `fix(firmware): update cc dependency and re‑init UART via USB CDC`)
- **PWA**: Enabled strict TypeScript mode, added offline fallback page (`public/offline.html`), enhanced Service Worker caching, upgraded Nuxt to 4.6.3 and related dependencies. (Commit `feat(pwa): enable strict TypeScript, add offline fallback page, improve service worker`)
- **Documentation**: Updated `README.md` with offline support note and dependency upgrades.
- **Dependency audit**: Bumped `@iconify-json/lucide`, `@types/node`, `nuxt`.

## In‑progress / pending tasks
- Resolve strict‑mode TypeScript errors (≈ 1 k errors) to improve type safety across the PWA.
- Implement OTA end‑to‑end support in the UI (currently a stub).
- Align Wi‑Fi credential length limits between firmware (63) and UI (currently 32).
- Add CI job for the PWA (lint, typecheck, build) to the GitHub workflow.
- Document OTA workflow and security hardening steps in `SECURITY.md`.

## Future roadmap (high‑level)
- **LoRa support**: integrate LoRa radio driver and expose as an additional broadcast medium.
- **Non‑ASTM encoders**: implement GB 42590 / FRDID encoders (issue #46).
- **Flash encryption**: enable ESP‑IDF flash encryption (eFuse AES‑256) for secure OTA.
- **DroneCAN identity**: decode identity/AHRS from DroneCAN (issue #52).
- **Advanced UI polish**: improve UX polish, theme customization, and desktop client.
- **Security audit**: complete full penetration testing and address all critical findings before any production release.

---
*Keep this file updated as tasks are completed or new ideas emerge.*
