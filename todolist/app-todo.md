# OmniRID — App (PWA) To-Do / To-Verify

> Scope: the Nuxt 4 browser app only (`OmniRID-app/`).
> Firmware → [`firmware-todo.md`](firmware-todo.md) · App↔firmware + repo → [`shared-todo.md`](shared-todo.md)
> Last verified against the code: 2026-10-19.

## Snapshot (verified in the repo)

- Nuxt 4 + Vue 3 + Nuxt UI + Pinia, source in `OmniRID-app/app/`; dev `pnpm dev`, build `pnpm build`, lint `nuxt eslint`, typecheck `nuxt typecheck` (0 errors).
- Device API integration **is wired**: `device/ConfigPage.vue` loads `GET api/config` (line 259) and saves with `POST api/config` (line 370) through `useEspConnection().proxyFetch` (Nitro proxy `/api/esp/**`, or direct `http://<ip>` when no proxy).
- Pages in `pages.config.ts`: Firmware, Guide, Monitor (dashboard), OmniRID TX Configuration (nation, identity, flight-controller, hardware, memory, security, console, presets, logging), OmniRID RX Configuration (receiver, hardware, memory, security, console, logging — all `planned`).
- Routing convention: one file per sidebar page, route = kebab-case of the page name (`pages/tx/console.vue` → `/tx/console`, `pages/guide.vue` → `/guide`). Old `/device/*`, `/tools/*`, `/docs/guide` and `/compliance-security/*` paths redirect to the new ones.
- There is **no app CI**: no workflow runs `lint`, `typecheck` or a build.

---

## 1. Dead references — fixed 2026-10-23

- [x] **`appSoftwareStatusUrl`** (`app/config/app.ts`) → `blob/omnirid-webapp-pwa/todolist/firmware-todo.md`.
- [x] **`appInstallerUrl`** → GitHub Releases (the Pages site is gone; `docs/` now only holds `images/`). Both exports are currently unused by the UI — wire or drop them.
- [x] **`guide.ts`** — project structure, build/flash commands and OTA status refreshed; `rid-rust-ci.yml` no longer referenced; Pages/demo links removed.

## 2. To do — features / UX

- [x] **OTA page marked not implemented.** Firmware `POST /ota` returns `501`; OTA upload disabled in UI with clear warning. Use USB/WebSerial flashing only.
- [x] **Lock ≥ 1 handled in UI.** Added warnings/blocks in ConfigPage and Security, restart/reset guarded via `/api/command` and `/api/reset`, red confirmation modals for lock level and app password changes, route protection middleware, lock level tracking from device. Console still required for signed requests when locked.
- [x] **WiFi SSID/password length aligned.** Limits set to 32/32 in `app/config/device.ts` to match firmware `MAX_STR_LEN = 32`.
- [x] **Configuration checklist** - derived from `/api/config` with validation and compliance checks, percentage computed from required items.
- [x] **Config diff before save** — implemented in ConfigPage with snapshot tracking and change detection.
- [x] **Firmware page** — OTA marked not implemented; WebSerial flow present, OTA disabled.
- [x] **Sensors** — Added `/device/sensors` page with live telemetry, `/tools/sensors` redirects to it.
- [ ] **Web UI / ground-station polish backlog (#54).** (ongoing)
- [x] **Availability matrix / lock protection** — Added lock level tracking and middleware protection; Security page accessible, other pages respect requirements.

## 3. To verify

- [x] **PWA status** — added service worker registration, install prompt/banner, online/offline and update notifications. App can be installed and used offline.
- [x] **Presets / logging / console** — Console has history and live logs, presets round-trip `/api/config`. Functional.

## 4. Verified OK (don't re-open)

Config read on page load + `POST /api/config` on save through `proxyFetch`; ESP connection indicator with live `GET /api/capabilities`; address persistence in `localStorage`; notification feed driven by real events; export/import JSON (Ctrl+E/Ctrl+S); theme; mobile responsive layout; no app-side ASTM decoding / BLE capture (by design).

## 5. Dashboard / Map enhancements

- [x] **Diagnostics export** — Added in Memory page (export config/capabilities/status/logs).
- [x] **LED/status indicator** — Added status indicator in header showing connection, GPS, TX state with colors and tooltip.
- [x] **Firmware update wizard/UI** — Firmware page updated with clear OTA not implemented status, USB/WebSerial flow present. OTA disabled until firmware supports it.
- [ ] **GNSS advanced options** — Expose constellation/SBAS/NMEA rate/GNSS enable toggles if supported by firmware API (check firmware capabilities).
- [ ] **Nearby drones panel** — Enhance with filtering, sorting, distance/bearing from own drone, and auto-fit bounds.
- [ ] **Map layers/controls** — Add scale, compass, measurement tool, offline tile fallback, and fullscreen toggle (basic map present).

## 7. Detections UX – Additional Dronetag-like features

- [ ] **Detection detail quick actions** — Add "Export", "Delete", "Mark as seen/unseen" directly in detection detail header.
- [ ] **Multi-source timeline** — Show combined timeline of packets per receiver (color-coded by reception tech: BLE/Wi-Fi Beacon/Wi-Fi NAN/ADS-B).
- [ ] **Operator info panel** — Expand operator details (Operator ID, location area, if present) in detection detail.
- [ ] **Flight context** — Display takeoff/time of day, duration, max altitude/speed, distance traveled in summary.
- [ ] **Map clustering** — Cluster nearby detections on the main map/list map view to avoid overlap.
- [ ] **Live detection badge** — Show "LIVE" badge for detections updated in the last 60s on the list/map.
- [x] **Filter persistence** — Added localStorage persistence in notifications/settings; can extend to other lists as needed.
- [ ] **Keyboard navigation** — Arrow keys / Enter to navigate detections in list and open detail.
- [ ] **Responsive detail layout** — Split view on desktop, stacked view on mobile with map toggle.
- [ ] **Shareable detection link** — Generate a local URL fragment `#rx/detections/:id` to open a specific detection directly.
