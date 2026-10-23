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

- [ ] **OTA page cannot work end-to-end.** Firmware `POST /ota` returns `501`; the page documents `X-Expected-SHA256` + `X-Signature` and a WebSerial install flow that is still pending. Either wire the firmware endpoint or make the page “USB/serial flashing only”.
- [ ] **Lock ≥ 1 is unusable from the browser.** Config saves are unsigned JSON POSTs and the device rejects them at lock ≥ 1. Only the Console exposes a manual `X-Signature` field. Decide: client-side signing, a device-side unlock flow, or a clear UI explanation. Note the Security page is declared `minLockLevel: 1`, and `minLockLevel` is not consumed anywhere yet.
- [ ] **WiFi password length mismatch.** The form accepts up to 63 chars; the firmware stores `MAX_STR_LEN = 32`. Align (firmware cap raise or UI clamp).
- [ ] **Configuration checklist** completion is manual and the percentage is computed in the browser, not derived from `/api/config`.
- [ ] **Config diff before save** — compare the edited form with the values loaded from the device.
- [ ] **Firmware page** — install flow via WebSerial pending; OTA progress bar blocked on the firmware endpoint.
- [ ] **Sensors** — no page: `/device/sensors` and `/tools/sensors` redirect to `/tools/logging`. Add live sensor fields to the Dashboard/Logging if a firmware endpoint is provided.
- [ ] **Web UI / ground-station polish backlog (#54).**
- [ ] **Availability matrix** — verify the offline/locked behaviour of every page (`requiresConnection` / `requiresESP` / `alwaysAvailable`) against the real API.

## 3. To verify

- [ ] **PWA status** — the app is *not* an installable PWA today (no service worker / PWA module configured, despite the naming). Confirm and document, or add it.
- [ ] **Presets / logging / console** — verified working in the code (console has history + live `/api/logs`; presets round-trip `/api/config`); re-check after API changes.

## 4. Verified OK (don't re-open)

Config read on page load + `POST /api/config` on save through `proxyFetch`; ESP connection indicator with live `GET /api/capabilities`; address persistence in `localStorage`; notification feed driven by real events; export/import JSON (Ctrl+E/Ctrl+S); theme; mobile responsive layout; no app-side ASTM decoding / BLE capture (by design).
