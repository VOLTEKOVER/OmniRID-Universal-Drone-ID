# OmniRID — Shared To-Do (App ↔ Firmware) / Repo-wide

> Scope: cross-cutting (integration, CI, docs, security, repo hygiene).
> Firmware → [`firmware-todo.md`](firmware-todo.md) · App/PWA → [`app-todo.md`](app-todo.md)
> Verified against the code: 2026-10-19.

## Snapshot

- Boundary: HTTP JSON API at `http://192.168.4.1/api/*`, permissive CORS +
  `OPTIONS` preflight on every route. The app proxies via
  `server/routes/api/esp/[...path].ts` (dev/self-hosted) or talks directly in the
  static build (HTTP origins only — HTTPS pages block `http://` as mixed content).
- `docs/` contains only `images/` (9 files); the static docs site was removed.
- Todolist = these 3 files. The previous 6 docs (dataflow, processes,
  softwarestatus, webuistatus, security-hardening, connessione-app-firmware) are
  deleted; git history keeps them.
- Open issues: 11 (#22, #26, #27, #29, #43, #46, #47, #52, #53, #54, #74).
  Dependabot: 114 npm alerts total, **all in `fixed` state** (0 open at the check).

---

## 1. App ↔ firmware contract (both sides)

- [x] **Unify authentication/authorization (A and C together).** Treated "app user login" and "device authorization for config changes" as the same mechanism. Password verified by ESP32 (source of truth). Normal PWA flow no longer requires manual `X-Signature` pasting.
- [x] **Implement firmware-side app auth.** Added `GET /api/app/auth/status`, `POST /api/app/auth`, `POST /api/app/auth/set` in `hardware/bsp-esp32/src/web.rs`. App password stored/managed via firmware; session tokens (`X-App-Token`) issued/validated via `rid_app::app_auth`. Proxy forwards `X-App-Token` unchanged.
- [x] **Enforce session auth on writes.** At `lock_level >= 1`, `POST /api/config`, `POST /api/reset`, `POST /api/command` prefer valid app session; fall back to Ed25519 `X-Signature`. Implemented in `rid-app/src/web_config.rs` and `bsp-esp32/src/web.rs`.
- [x] **Redefine `lock_level`.** `lock_level == 0` = open; `lock_level >= 1` = protected by app user authentication (session). Not conflated with mandatory cryptographic signing for normal web UI.
- [x] **Config loading orchestration (pull model).** App explicitly loads `GET /api/config` before saves via `useEspConnection`/`ConfigPage.vue`; avoids relying solely on cached values.
- [x] **Firmware config auth vs image verification (separate).** Config auth (app session/signature) is separate from firmware image authenticity/integrity (OTA/cable flashing).
- [x] **Signing at lock ≥ 1 (replaced for normal flow).** Session auth used by default; Ed25519 kept as optional/advanced fallback.
- [ ] **OTA end-to-end.** Firmware `POST /ota` implemented. App's Firmware page currently marks/disables OTA ("not implemented"/USB-only). Align UI and behavior (enable OTA path if intended, or explicitly document "USB/serial only"). Ensure `X-Expected-SHA256` and `X-Signature` forwarding remain correct via proxy.
- [ ] **WiFi credential length.** Firmware stores `wifi_ssid`/`wifi_password` with `MAX_STR_LEN = 63`. App currently limits to 32/32 in `app/config/device.ts`. Decide and align: either raise app limits to 63 or enforce 32 on both sides with clear validation.
- [x] Config read (`GET /api/config`) + save (`POST /api/config`) through the
  proxy/direct fetch — verified in `device/ConfigPage.vue`.
- [x] `GET /api/capabilities` used for the live connection indicator.
- [x] CORS + `OPTIONS` preflight on all routes (`bsp-esp32/src/web.rs`).

## 2. Documentation & references

- [x] `README.md` — CI badge → `esp32-build.yml`; branch → `omnirid-webapp-pwa`;
  workspace path → `OmniRID-firmware/`; 305 tests; real structure (docs/ =
  images, 4 workflows); removed dead Pages/demo/BOM links; OTA marked as `501`.
- [x] `CONTRIBUTING.md` — workspace path, test count, `pnpm` app commands,
  backlog references.
- [x] `.github/PULL_REQUEST_TEMPLATE.md` — component list + backlog reference.
- [x] `SECURITY.md` — threat model/hardening folded in; correct lock/OTA status;
  no stale `docs/security-hardening.md` link.
- [x] `OmniRID-app/app/config/app.ts` — dead `GitHub Pages` + `softwarestatus.md`
  links replaced (correct branch, backlog file).
- [x] `OmniRID-app/app/config/guide.ts` — real project structure, real build
  commands, OTA marked as not implemented.
- [ ] **`OmniRID-firmware/hardware/bsp-esp32/sdkconfig.defaults`** line 43 still
  points to `docs/security-hardening.md`. It is a firmware file: **not edited**
  (per instruction). Update the comment when touching the firmware.
- [ ] **Firmware code comments** referencing `dataflow.md`:
  `firmware/rid-app/src/web_config.rs:120` and `hardware/bsp-esp32/src/web.rs:135`.
  Firmware files: **not edited** (per instruction).
- [ ] **`docs/` policy** — keep only `images/`; the static site and its links
  are gone.

## 3. CI / dependencies

- [ ] **No app CI.** No workflow runs `lint`, `typecheck` or a build for
  `OmniRID-app`. Add a minimal job (Node 22 + pnpm) or extend `release.yml`.
- [ ] **Xtensa cross-build** — `esp32`/`esp32s3` link failure, `esp32c6` green.
  Parked; see [`firmware-todo.md`](firmware-todo.md).
- [ ] **TypeScript 7** — held back at 6.0.3 because `vue-tsc` cannot resolve the
  native compiler. The user will handle the migration.
- [x] Workflows in the repo: `esp32-build.yml`, `protocol-updates.yml`,
  `release.yml`, `security-audit.yml` (README now matches).
- [x] `protocol-updates.yml` — 4 jobs (opendroneid, mavlink, dronecan,
  regulatory), run-level concurrency, MAVLink gated by
  `cargo test -p proto-mavlink --locked`.
- [x] Dependabot — 4 ecosystems, minor/patch groups, limit 10, no ignores.

## 4. GitHub backlog (open)

| # | Title | Notes |
|---|---|---|
| #22 | MAVLink USB vs console UART0 | verify at runtime (firmware) |
| #26 | Priority refactors | config snapshot, return checks, parser isolation, fuzz, timeouts |
| #27 | Portability + dependency management | |
| #29 | Feature backlog | mesh, LoRa, SD logging, CLI history, Kalman export, stats |
| #43 | ESP-IDF 6 / esp-idf-sys 0.38 | parked; explainer comment in the issue |
| #46 | Non-ASTM encoders | China GB 42590 + FRDID |
| #47 | Flash encryption (eFuse AES-256) | |
| #52 | DroneCAN Identity/AHRS decode | |
| #53 | Ground tools | timing analysis, NVS provisioning, Meshtastic bridge, mesh mapper |
| #54 | Web UI / desktop polish | |
| #74 | Regulatory pages changed | protocol-update tracking issue |

## 5. Conventions (verified)

- Default branch: `omnirid-webapp-pwa`; only `universal` + `omnirid-webapp-pwa` are kept.
- Firmware builds/tests from `OmniRID-firmware/`; BSP is a standalone workspace
  in `hardware/bsp-esp32/`.
- App is a static Nuxt 4 SPA (`pnpm dev/build/typecheck/lint`); no service worker.
