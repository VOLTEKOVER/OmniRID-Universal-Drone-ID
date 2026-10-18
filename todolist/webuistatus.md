# OmniRID — Web App & Documentation Status

> **The embedded web UI was removed on 2026-10-18**: the firmware is headless
> and serves only a CORS-enabled JSON API. All configuration lives in the
> external PWA.
> Browser app: Nuxt 4 + Vue 3 + Nuxt UI, developed in `OmniRID-app/`,
> published on GitHub Pages — the single configuration surface for the device.
> Firmware: Rust workspace in `OmniRID-firmware/` (headless JSON API at
> `http://192.168.4.1/api/*`).
> Documentation: `README.md` + `docs/index.html` + `docs/guide.html`.
> Last updated: 2026-10-18 (headless firmware — embedded web UI deleted).
>
> The old Electron/React desktop application and the temporary Alpine PWA are no
> longer the active web-app architecture. The current browser app is a Nuxt
> configuration dashboard and remains under active visual and interaction work.

---

## Part 1 — Device API (Headless)

Since 2026-10-18 the firmware no longer embeds or serves any UI
(`rid-app/webui/` and `rid-app/src/webui.rs` were deleted, `git rm` in
`bsp-esp32::web`). The device exposes a pure JSON REST API on its AP
(`http://192.168.4.1`), consumed by the OmniRID PWA from another origin:

- All responses carry `Access-Control-Allow-Origin: *`.
- Every route has an `OPTIONS` preflight handler (allowed headers:
  `Content-Type`, `X-Signature`, `X-Expected-SHA256`).
- Configuration fields are unchanged (see `dataflow.md` §5); they are now
  edited exclusively through the PWA (`app/components/device/ConfigPage.vue`)
  and persisted via `POST /api/config` → NVS.

### 📊 Configurable fields (owned by the PWA UI)

**Identity:** uas_id, id_type, ua_type, op_id, self_id_text, op_lat, op_lon, op_alt, uas_id2, id_type2, ua_type2
**Transmission:** tx_wifi_bcn, tx_wifi_nan, tx_ble4, tx_ble5, wifi_ch, wifi_pwr (2-20), wifi_bcn, wifi_nan, bt4_rate, bt4_pwr, bt5_rate, bt5_pwr
**AP:** wifi_ssid, wifi_pass, websrv_en
**FC:** protocol (AUTO/MAVLink/MSP/NMEA), baud, mav_sysid, bcast_pwr
**Hardware:** led_r/g/b_gpio (RGB status LED — the only light source), uart_port, tx/rx_pin, dronecan_rx/tx_gpio, dronecan_bitrate, ota_trigger_gpio, mavlink_usb_enable, start_delay_ms
**Security:** lock_lvl, sec-password, sec-timeout, pubkey1-5, opt_arm/nosave/print/demo/kalman/auth/mavlink_arm/mavlink_op_loc/identity_gate

### 🔌 API Endpoints

| Endpoint | Method | Content |
|----------|--------|---------|
| `/api/config` | GET/POST | Config JSON |
| `/api/status` | GET | Runtime status |
| `/api/capabilities` | GET | Build descriptor |
| `/api/command` | POST | Signed commands |
| `/api/reset` | POST | Factory reset |
| `/api/logs` | GET | Log entries |
| `/ota` | POST | Firmware upload |

All routes answer `OPTIONS` preflight with `204` + CORS headers.

### ✅ Regole app da rispettare (da fare)

**Requisiti trasversali per tutta l'app:**

- [x] **Stato per feature** — Ogni feature/pagina mostra se è `stable`,
	`implemented` o `wip`: badge derivato da `pages.config.ts` reso da
	`PageHero` su tutte le pagine (incluso firmware e guide).
- [ ] **Nomenclatura pagine obbligatoria** — Architettura evoluta: la navigazione
	nasce dal manifest `pages.config.ts` con rotte annidate (`/device/*`,
	`/tools/*`), non più file flat; la regola `drone-<pagina>`/`app-<pagina>` è
	superseded dal campo `kind` (`drone`/`app`) presente nel manifest.
- [x] **Sistema notifiche completo** — `useNotifications()` (error / warning /
	info) alimentato da eventi reali: connessione ESP (loss/gain), salvataggio
	config, export/import, preset apply. Slideover con mark-all-read/clear e
	badge non letti sulla campanella. Rimossa la vecchia route statica
	`server/api/notifications.ts`. Log firmware condivisi (`useFirmwareLogs`)
	mirrorati globalmente alle notifiche; feedback standardizzato (toast + notifica
	per azioni utente, solo notifica per eventi background); API unificata.
- [x] **Componentizzazione massiccia** — `PageHero`, `ContentSection`,
	`SectionTabs`, `DeviceConfigPage`, `ConsoleTerminal`, `TelemetryRecorder`,
	`PresetManager`, `AppSettingsPopover`, `NotificationsSlideover`: la UI
	riusa blocchi pronti, quasi nessun markup manuale.

### 🔧 TODO — UI Improvements

**High:**
- [x] WiFi SSID/password maxlength 20 → 32/63
- [x] Operator lat/lon precision float → f64 (valori passati come stringa
	full-precision, nessun troncamento `toFixed`/`parseFloat` nel codice)
- [ ] Demo public-safe hardening — lato firmware

**Medium:**
- [ ] manifest.json version auto-gen — N/A: l'architettura PWA (Alpine) non è
	più attiva; l'app Nuxt non è una PWA installabile.
- [x] Settings search across all tabs — coperto dalla command palette
	(`UDashboardSearch`) costruita sullo stesso manifest; le impostazioni app
	sono nel popover header.
- [x] Export/import — export/import JSON in `DeviceConfigPage` (Ctrl+E/Ctrl+S)
	e in `PresetManager`; le chiavi auth non sono ancora esposte nell'UI,
	restano lato firmware.
- [x] Console CLI history (up/down arrows) — `ConsoleTerminal` con history,
	live log da `GET /api/logs`, invio a `POST /api/command` + `X-Signature`.
- [ ] Sensors tab real data — richiede endpoint sensori lato firmware.
- [x] Mobile responsiveness verify — header adattivo (search/etichette
	nascoste su schermi piccoli, bottoni icona); pulsanti tema/notifiche/impostazioni
	spostati nella sidebar su mobile (< lg) e slideover impostazioni dedicato.

**Low:**
- [x] Dark mode polish — verificato: nessun colore hardcoded, solo token UI.
- [x] Keyboard shortcuts — Ctrl+S (save) / Ctrl+E (export) via event bus
	`useDashboard.configActions`.
- [x] Loading states / error toasts — refresh connessione cliccabile, save
	loading, toast + notifiche su tutti gli esiti (standardizzato).
- [ ] OTA progress bar — richiede upload `/ota` lato firmware (al momento
	risponde "not yet wired - use /update").
- [ ] Compliance region auto-detect from GPS — richiede GPS lato firmware.
- [ ] Config diff view before save — richiede confronto con `/api/config`
	caricato; oggi la pagina non legge ancora lo stato del device (integrazione API incrementale).

---

## Part 2 — Browser Configuration App (OmniRID-app)

`OmniRID-app/` is the active browser UI. It is a standalone Nuxt 4 application,
separate from the Rust firmware workspace, and is intended to configure and
monitor an OmniRID device through the ESP32 web API.

### Current application architecture

| Layer | Location | Responsibility |
|-------|----------|----------------|
| Nuxt shell | `OmniRID-app/nuxt.config.ts`, `app/app.vue` | Nuxt modules, global CSS, SEO and application bootstrap |
| Navigation manifest | `OmniRID-app/app/pages.config.ts` | Single source of truth: 6 groups, page status (`stable`/`implemented`/`wip`), route resolution |
| Shared layout | `OmniRID-app/app/layouts/default.vue` | Header, sidebar (manifest-driven), connection indicator, theme, checklist and search |
| Reusable config surface | `OmniRID-app/app/components/device/ConfigPage.vue` | Shared sections, controls, validation and action bar used by device configuration pages |
| Section tabs | `OmniRID-app/app/components/SectionTabs.vue` | In-group tab band rendered from the manifest (filters `wip` pages) |
| Nested pages | `OmniRID-app/app/pages/` | device/, compliance-security/, tools/, docs/ sections plus dashboard, firmware and index |
| Shared state | `OmniRID-app/app/composables/` | `useDashboard` (slideover, shortcuts, event bus), `useEspConnection` (proxy `/api/esp/*`, conn state), `useDeviceProfile`, `useAppSettings`, `useNotifications` (3-level feed) |
| Shared components | `OmniRID-app/app/components/` | `PageHero`, `ContentSection`, `SectionTabs`, `device/ConfigPage`, `ConsoleTerminal`, `TelemetryRecorder`, `PresetManager`, `AppSettingsPopover`, `NotificationsSlideover` |
| Static assets | `OmniRID-app/public/images/` | OmniRID logo and supported ESP32/flight-controller hardware images |

### Active routes (manifest-driven, 6 groups)

| Group | Routes |
|-------|--------|
| Monitor | `/dashboard` |
| Configurazione drone | `/device/identity`, `/device/flight-controller`, `/device/transmission`, `/device/access-point`, `/device/hardware`, `/device/system` |
| Compliance & Security | `/compliance-security/compliance`, `/compliance-security/security` |
| Strumenti | `/tools/console`, `/tools/presets`, `/tools/logging`, `/tools/sensors` |
| Firmware | `/firmware` |
| Guida | `/docs/guide`, `/docs/help` |

Impostazioni app non è più una rotta: la pagina `/app-settings` è stata eliminata
e sostituita dal popover header `AppSettingsPopover` (terni, lingua, scala UI,
rapp, experience mode, disabilita internet, reopen last tab).

The old flat routes (`/identity`, `/transmission`, `/guide`, …) were removed;
navigation is entirely derived from `pages.config.ts`. Sidebar and search filter
out `wip` pages (e.g. Sensors), while the manifest still lists them for future
tabs.

### Current integration boundary

- The Rust firmware remains the owner of device configuration, persistence,
	telemetry, OTA, authentication and protocol processing.
- `OmniRID-app` currently provides the browser presentation and interaction
	layer; the pages use structured configuration surfaces and are being connected
	incrementally to the firmware API.
- The old template demo pages, demo APIs, nested repository metadata and unused
	template dependencies have been removed.
- There is no active browser-side ASTM decoder, BLE/Serial capture pipeline or
	PCAP importer in this app; those are not part of the current architecture.

### Current user-visible behavior

1. **Application startup** — Nuxt loads the global shell, applies the saved light
	or dark color preference, sets the OmniRID page metadata and renders the
	current route inside the shared dashboard layout.
2. **Navigation** — The sidebar renders the 7 manifest groups (Monitor,
	Configurazione drone, Compliance & Security, Strumenti, Firmware, Guida,
	Impostazioni) with per-page status badges and offline locking; `wip` pages
	are hidden. It can collapse and the header exposes quick navigation and search
	built from the same manifest.
3. **ESP connection indicator** — The header displays the ESP connection state
	and the configured address (`192.168.4.1` by default), verified by a live
	`GET /api/capabilities` request. The button is clickable for a manual retry
	(with loading state) and connection state changes surface as info/error
	notifications in the slideover.
4. **ESP address editor** — The address popover accepts and displays a new value,
	persists it in `localStorage` and immediately tests the connection.
5. **Configuration checklist** — Identity, flight controller, transmission and
	security items can be checked manually. The percentage is calculated in the
	browser and is not yet derived from the actual device configuration.
6. **Configuration pages** — Each page renders grouped fields from a shared
	`ConfigPage` component. Text, numeric, password, textarea, select and toggle
	controls update local reactive state.
7. **Save action** — Validates the form, POSTs the payload to `/api/config` via
	the ESP proxy and reports the outcome with a toast plus a 3-level
	notification. Save is blocked while the device is offline.
8. **Notifications** — `useNotifications()` keeps an in-memory feed seeded with
	welcome/checklist items; real events (connection loss/gain, config saved,
	preset applied, import/export) append error/warning/info entries. The bell
	shows an unread count and the slideover supports mark-all-read and clear.
9. **Theme** — The light/dark switch updates the Nuxt color mode and is shared by
	the header and sidebar controls.
10. **Firmware and tools** — Firmware page is presentational (install flow via
	WebSerial pending); Console is a working terminal (live logs from
	`GET /api/logs`, command history with ↑/↓, POST `/api/command`);
	Presets capture/apply real `/api/config` round-trips from localStorage;
	Logging records `/api/status` telemetry and exports CSV. Sensors remain a WIP
	placeholder pending a firmware endpoint.
11. **Availability by connection** — Home, Firmware, Guide and Help remain
	accessible without an ESP32 connection. Dashboard, telemetry, configuration
	and device tools are connection-dependent and are shown as offline/locked
	until the device is available.
12. **Guided configuration** — The checklist is the main onboarding path. Each
	step opens the corresponding Identity, Flight Controller, Transmission or
	Security page, while completion is tracked separately so the user can verify
	every step instead of only opening it.
13. **Profile-dependent UI** — Protocol and regulatory region are shared device
	profile selections. Flight Controller, Compliance, Transmission and Identity
	read the same profile and adapt their labels, defaults, available options and
	sections. For example, `none` exposes demo-oriented behavior, MAVLink/MSP/NMEA
	determine the relevant input context, and the China profile hides the second
	Basic ID while required operator fields vary by region.
14. **Conditional controls** — Inputs that do not apply to the selected profile
	are disabled instead of accepting misleading data. MAVLink SysID is available
	only for MAVLink or auto-detect, UART settings are blocked in Demo/None mode,
	and Operator ID/Self-ID are locked for the China GB 42590 profile. Disabled
	controls remain visible with an explanation so the user understands the rule.
15. **Input validation** — Configuration forms validate identifiers, text lengths,
	passwords, IPv4 addresses, GPS coordinates, channels, radio rates, GPIO ranges
	and startup delays. Save is blocked when a value is invalid or when settings
	conflict, such as equal TX/RX pins, incomplete DroneCAN pin pairs or MAVLink
	USB selected with a non-MAVLink protocol. Hardware target selection also
	disables BLE 5 and MAVLink USB when the selected ESP32 board cannot support
	them.

In summary, the current app is an interactive configuration prototype: routing,
layout, controls, local state, theme, checklist, search and notifications work
in the browser, while persistence, live connection status, telemetry, OTA and
device commands still have to be connected to the Rust firmware endpoints.

---

## Part 3 — Documentation Restructuring (C → Rust)

### C → Rust Reference Mapping

| Old C Reference | New Rust Reference |
|---|---|
| `main.c` | `firmware/app/src/main.rs` |
| `web_config.c` / `web_server.c` | `firmware/rid-app/src/web_config.rs` + `bsp-esp32/src/web.rs` (headless API; the C web_server UI portion was dropped, not ported) |
| `rid_security.c` | `firmware/rid-core/src/security.rs` |
| `rid_ota.c` | `firmware/rid-app/src/ota.rs` + `bsp-esp32/src/ota.rs` |
| `rid_auth.c` | `firmware/rid-core/src/auth.rs` |
| `rid_kalman.c` | `firmware/rid-core/src/kalman.rs` |
| `rid_patrol.c` | `firmware/rid-core/src/patrol.rs` |
| `rid_output.c/h` | `firmware/rid-core/src/hub.rs` |
| `protocol_detect.c` | `firmware/rid-core/src/protocol_detect.rs` |
| `mavlink_parser.c` | `inputs/proto-mavlink/src/parser.rs` |
| `nmea_parser.c` | `inputs/proto-nmea/src/parser.rs` |
| `msp_parser.c` | `inputs/proto-msp/src/parser.rs` |
| `rid_dronecan.c` | `inputs/proto-dronecan/src/parser.rs` |
| `rid_mavlink_usb.c` + `rid_mavlink_tx.c` | `inputs/proto-usb-mavlink/src/{tx,pack}.rs` |
| `odid_common.c` + `wifi.c` + `ble_tx.c` | `outputs/out-astm/src/{lib,wifi,ble4}.rs` |
| `opendroneid.c` + `mav2odid.c` | `external-libs/opendroneid-sys/` (FFI only) |
| `cli.c` | `firmware/rid-app/src/cli.rs` |
| `nvs_storage.c` | `firmware/rid-app/src/nvs.rs` + `bsp-esp32/src/nvs.rs` |
| `led_status.c` | `firmware/rid-app/src/led_status.rs` |
| `led_ws2812.c` | ❌ removed 2026-10-18 (dynamic lights dropped) |
| `rid_lighting.c` | ❌ removed 2026-10-18 (dynamic lights dropped) |
| `ble_tx.c` | `firmware/rid-app/src/ble4.rs` + `bsp-esp32/src/ble.rs` |
| `wifi_tx.c` | `bsp-esp32/src/wifi.rs` |
| `esp_remote_id.h` | `firmware/rid-interface/src/{types,input,region,odid}.rs` |
| `MAVLink c_library_v2` | `inputs/proto-mavlink` (pure Rust) |
| `Vendored C` | `opendroneid-sys` FFI bindings only |

### Search & Replace Commands

```bash
# Find all C references
git grep -n "rid_security.c\|rid_ota.c\|web_config.c\|rid_auth.c\|main.c\|opendroneid-core-c\|Vendored C"

# Replace file names
git grep -l "rid_security.c" | xargs sed -i 's/rid_security.c/firmware\/rid-core\/src\/security.rs/g'
git grep -l "rid_ota.c" | xargs sed -i 's/rid_ota.c/firmware\/rid-app\/src\/ota.rs/g'
git grep -l "web_config.c" | xargs sed -i 's/web_config.c/firmware\/rid-app\/src\/web_config.rs/g'
git grep -l "rid_auth.c" | xargs sed -i 's/rid_auth.c/firmware\/rid-core\/src\/auth.rs/g'
git grep -l "main.c" | xargs sed -i 's/main.c/firmware\/app\/src\/main.rs/g'
git grep -l "rid_kalman.c" | xargs sed -i 's/rid_kalman.c/firmware\/rid-core\/src\/kalman.rs/g'
git grep -l "nvs_storage.c" | xargs sed -i 's/nvs_storage.c/firmware\/rid-app\/src\/nvs.rs/g'
git grep -l "cli.c" | xargs sed -i 's/cli.c/firmware\/rid-app\/src\/cli.rs/g'

# Generic replacements
git grep -l "Vendored C" | xargs sed -i 's/Vendored C/FFI bindings (opendroneid-sys)/g'
git grep -l "rid_security.c/h" | xargs sed -i 's/rid_security.c\/h/rid-core::security/g'
```

### Files to Verify Before Deletion

```bash
# List all C/H files still in repo
git ls-files '*.c' '*.h'

# Check if these directories exist and are referenced
git grep -n "opendroneid-core-c\|mavlink-sys\|mbedtls"
```

Candidate deletions (after confirming no references):
- `external-libs/opendroneid-core-c/` — if fully replaced by `opendroneid-sys`
- `external-libs/mavlink/` — if replaced by `proto-mavlink` crate
- `external-libs/mbedtls/` — if provided by ESP-IDF

### Specific Text Changes by File

**README.md:**
- One-liner: "OmniRID — hardware-agnostic Open DroneID transmitter (Rust). Any flight-controller input → any RID standard output."
- Quickstart: `git clone` → `cd OmniRID` → `cargo build --workspace && cargo test --workspace`
- Remove duplicated content already in docs/
- Update badges to correct repo/branch
- Replace "Vendored Dependencies" section with Rust crate list

**docs/index.html:**
- Keep hero + WebSerial button + 3-step flash
- Remove technical deep-dives (move to guide.html)
- Add links to guide sections (Protocols, Config, OTA, Security, Hardware)

**docs/guide.html:**
- Security section: replace C file refs with Rust paths
- OTA section: update to describe Rust implementation
- Build section: remove CMake/make steps, use cargo only
- "Legacy C Firmware" section: mark as "completed port, C deleted"
- Security Hardening table: replace C file column with Rust crate paths
- "Vendored Dependencies" block: list Rust crates + opendroneid-sys only

### Post-Change Verification

```bash
# Build
cargo build --workspace

# Test
cargo test --workspace

# Check no C references remain
git grep -n "\.c\b" -- '*.md' '*.html' | grep -v "opendroneid-sys\|vendor\|changelog\|LICENSE"

# Verify links in docs
# Open docs/index.html locally, check all links resolve
```
