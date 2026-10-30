# Changelog

All notable changes to this project will be documented in this file.

## [2026‑10‑30] – "Offline & Strict TypeScript"
- **Firmware**: Bumped `cc` crate to 1.10; added UART re‑initialisation via `bsp_esp32::usb::init()` after config changes. (commit `fix(firmware): update cc dependency and re‑init UART via USB CDC`)
- **PWA**: Enabled strict TypeScript mode (`tsconfig.json` `"strict": true`). Added offline fallback page (`public/offline.html`). Updated Service Worker to cache the shell and serve the offline page on network failure. Upgraded dependencies: Nuxt 4.6.3, `@iconify-json/lucide` 1.2.149, `@types/node` 26.6.6. (commit `feat(pwa): enable strict TypeScript, add offline fallback page, improve service worker`)
- **Documentation**: Updated `README.md` with notes on offline support and dependency upgrades.
- **Task tracking**: Added `TASKS.md`, `ROADMAP.md` and updated `shared-todo.md` entries.

## [2026‑10‑19] – "Initial Release"
- Initial version with core firmware, PWA dashboard, and basic Remote ID broadcasting.

---
*All dates are in ISO YYYY‑MM‑DD format.*
