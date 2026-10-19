# OmniRID — Software Status

> OmniRID is a Rust modular firmware for Remote ID broadcasting on ESP32.
> All legacy C firmware (`ESP32_DRONE_REMOTE_ID_Firmware/`) has been deleted.
> The C firmware audit and fix campaign findings (A–P, §9 of `dataflow.md`)
> remain as historical reference for the port.

Last updated: 2026-10-19
Tests: 302 passing | Clippy: clean | Edition: 2024

> Session fixes (2026-08-28): [#18] MSP framing off-by-one → MSP v1 standard;
> [#24] operator-location gate (MAVLink op location ignored by other protocols);
> [#25] NVS persistence for full config + auth lifecycle;
> [#26] xTaskCreatePinnedToCore return check + hardware-gated module;
> [#34] `speed_vertical` derived from altitude deltas for MSP/NMEA (Kalman off).
>
> Audit correction: [#19] DroneCAN reassembly, [#20] OTA signature at lock≥1 and
> [#21] `bcast_powerup` were already implemented in the Rust code (the
> `dataflow.md`/`processes.md` §10 "open" rows described the old C port). They
> were closed again on GitHub with pointers to the code.
>
> Session fixes (2026-09-16, CI green): dependabot PR #37 (pkcs8 0.10.2 →
> 0.11.0) broke the host + ESP32 cross-build again (ed25519-dalek 2.2.0
> implements DecodePrivateKey/DecodePublicKey against pkcs8 0.10 / spki 0.7);
> pinned pkcs8 back to 0.10. OmniRID-Desktop CI failed for three reasons:
> `package-lock.json` was gitignored although the workflow needs it for
> `npm ci` (now committed via a `!` negation), the unused `@abandonware/noble`
> and `pcap` optional dependencies shipped only pre-releases so `npm ci`
> could never resolve (`^1.9.2`), and `node-abi` 4.31.0 lacked the ABI entry
> for Electron 44 (`overrides` → 4.35.0). Also deleted the orphaned `main`
> branch (default is now just `universal`) and fixed the eval-weird weekly
> auto-update workflow names.

> Session fixes (2026-10-18): closed `dataflow.md` §10 #11 — `/api/command`
> (restart/reset) now shares the `SigRate` failure rate limiter with
> `/api/config` and `/api/reset` (`rid-app::web_config::handle_command`
> takes `rate`/`now_ms`, returns `CommandOutcome::RateLimited` → HTTP 429);
> implemented CLI command history (`rid-app::cli::CommandHistory`, last 10
> cmds, up/down recall) and Kalman covariance export
> (`rid_core::kalman::KalmanCovariance`, `Scheduler::kalman_covariance`).
>
> Architecture change (2026-10-18): **firmware is now headless** — the
> embedded web UI (`rid-app/webui/` + `rid-app/src/webui.rs`, ported from the
> old C `webui/`) has been deleted. `bsp-esp32::web` serves only the JSON
> API (`/api/config`, `/api/status`, `/api/capabilities`, `/api/reset`,
> `/api/logs`, `/api/command`, `/ota`) with permissive CORS + OPTIONS
> preflight, so the external OmniRID PWA (`OmniRID-app/`, GitHub Pages) is
> the single configuration surface: it connects to the device AP over WiFi
> and drives every setting through `/api/*`. The firmware keeps only the
> signed-action gate, persistence (NVS) and telemetry; no HTML/UI payload
> in flash anymore (see `dataflow.md` §10 #15 and `processes.md` §6.9).
>
> Architecture change (2026-10-18): **dynamic lights removed** — the WS2812
> strip (`rid-app/src/led_ws2812.rs`, RMT) and the 5-channel GPIO lighting
> system (`rid-app/src/lighting.rs`, 6 patterns + phase offsets) are deleted
> from firmware and app. The PWM RGB status LED (`led_status`, 7 states) is
> the only light source left: config fields `ws2812_gpio`,
> `ws2812_brightness`, `lighting_pins/patterns/phase_offsets` are gone from
> `BspConfig`/NVS/JSON, the `TickOutcome.ws2812_green`/`lighting_armed`
> flags from `rid-core`, and the RMT driver + `led::set_gpio` from the BSP.
> App side: `LIGHT_PATTERNS`, the Hardware-page sections and the chip
> feature flags `ws2812`/`gpioLighting` were dropped too (only
> `led_r/g/b_gpio` remain). See `dataflow.md` §10 #16.

> Session cleanup (2026-10-19):
> - **Static docs site deleted** (`1992a42`, pushed) — `docs/index.html`,
>   `guide.html`, `architecture.html`, `bootstrap-theme.css`, `manifest.json`
>   removed (firmware headless, PWA is the only UI); `docs/images/` (9 file)
>   kept for reuse. Risolve anche il vecchio TODO sui link a
>   `config(demo).html`.
> - **Dependabot PR tutti mergiati** su `omnirid-webapp-pwa`: #64 (13 update
>   npm in OmniRID-app, solo lockfile — includesse due downgrades di
>   transitive: undici 8.10.0→6.29.1, brace-expansion 2.1.0→1.1.21, per
>   allineare i range), #65 (softprops/action-gh-release 3.0.3), #66
>   (actions/setup-node 7.1.0). Branch dipendenti cancellati da GitHub.
>   Restano 18 alert sicurezza (3 critical, 10 high) sul default branch —
>   scesi da 78 proprio con il merge di #64.
> - **Riordino branch**: locale `universal` portato al sync con origin
>   (`9ec0988`), orfano `main` cancellato, remote `fork` (quix2k23/ESPsquawk)
>   rimosso, branch remoti già mergeati ripuliti. Online e locali restano
>   **solo** `universal` e `omnirid-webapp-pwa`.
>
> Session deps-update (2026-10-19, `098e167`/`e4131b8`/`233d3f2`):
> - **Firmware + protocolli**: tutte le crate registry aggiornate alla
>   latest — `ed25519-dalek` 2→**3.0** (rimosso `std` dalla dev-dep di
>   rid-app, feature rimossa in 3.0; API from_bytes/Signer/Verifier
>   invariate, 305 test verdi), `pkcs8` 0.10→**0.11**, `pem-rfc7468`
>   0.7→**1.0**, `spin` 0.9→**0.12** (bsp-esp32), più `cargo update`
>   integrale su entrambi i lockfile (serde_json 1.0.154, sha2 0.11.1,
>   embuild 0.33.5, esp-idf-sys 0.38.1, cc 1.9.0; duplicati sha2/getrandom/
>   rand_core collassati). inputs/outputs non avevano dipendenze indietro
>   (solo `libm`, già latest).
> - **App**: `pnpm update --latest` — nuxt 4.6.2, @nuxt/ui 4.12,
>   @vueuse 15.0, eslint 10.13, vue 3.5.44, ecc. **typescript 7 rifiutato**:
>   vue-tsc 3.3.13 non risolve il compiler nativo TS7 (`ERR_PACKAGE_PATH_NOT_EXPORTED`),
>   resta 6.0.3. Dichiarato `@types/node` esplicitamente (prima era solo un
>   peer optional risolto per caso da residui di node_modules; clean install
>   rompeva il typecheck).
> - **Bug preesistenti fixati** (`233d3f2`, erano 7 errori `nuxt typecheck`
>   mai eseguito in CI): `css` duplicato in nuxt.config.ts, guard octet in
>   isPrivateIpv4, precedenza `??` vs `?:` in ConfigPage (crash su
>   error.message quando la config request falliva), method union in
>   useEspConnection. Typecheck ora 0 errori, build+lint verdi.
> - Nota: i PR Dependabot #67/#68/#70/#72 arrivati nel mentre sono stati
>   risolti in rebase (i bump erano già inclusi negli update locali).
>
> Session opendroneid-sync (2026-10-19, `52956a7`/`cd189df`):
> - **PR #73 chiusa come DOWNGRADE**: la sync settimanale punta a
>   `releases/latest` di opendroneid-core-c, ma l'ultima release (v2.0)
>   è del 2022-04-06 — più vecchia dello stato vendored che segue
>   **master** (v2.0 rimuove `round()` da tutti gli encoder →
>   troncamento invece di arrotondamento, toglie `const`, ecc.). I gate
>   l'hanno preso: 3 test rotti (encode_system_roundtrip + 2 out-astm
>   byte-exact). Vendor attuale = master + 2 micro-patch locali
>   (PRIu32 per toolchain embedded, guard `#ifndef` INV_ALT/
>   MAX_TIMESTAMP) — ora formalizzate in
>   `vendor/local-tweaks.patch`.
> - **Sync fissa per seguire master pinnato a SHA** (non releases):
>   lo script scarica dal ref e ri-applica le patch locali (patch che
>   fallisce ad alta voce se upstream tocca le stesse righe); il
>   workflow risolve la SHA di master, chiude le PR sync superseded,
>   branch `ci/opendroneid-master-<sha7>`. Validato end-to-end:
>   sync su master 849c03a riproduce i file byte-identici →
>   "No changes", dispatch verde 5/5.
> - **Bug YAML fixato** (`cd189df`): le righe di continuazione del
>   BODY multi-riga erano a colonna 0 → block scalar chiuso prima del
>   tempo, workflow intero non parsabile (422 su dispatch). Lezione:
>   validare con python yaml.safe_load dopo ogni edit di workflow.
> - Branch `ci/opendroneid-v2.0` eliminato (remote+locale); zero PR
>   aperte sul repo. `origin/HEAD` locale aggiornato a
>   `omnirid-webapp-pwa` (era stale su `universal`).
>
> Session dependabot-config (`9662016`):
> - **Perché Dependabot non aveva aggiornato nulla**: fino a `c1dffa4`
>   (oggi 11:00) la config guardava cartelle fantasma — cargo →
>   `/OmniRID` (layout pre-riorganizzazione), npm →
>   `/OmniRID-Desktop` (mai esistita), entry bsp-esp32 assente. Appena
>   fixata: 4 PR in un minuto (pem-rfc7468, serde_json, dalek,
>   vueuse) — cioè esattamente le librerie poi fatte a mano perché
>   rosse/non mergeabili (dalek 3 con feature `std` fantasma, bug
>   clippy-su-merge-ref, nessun auto-merge, `limit: 2` a bloccare la
>   coda di ~30 librerie).
> - Config ora: **limit 2→10** per ecosistema, **groups** minor+patch
>   in una PR sola/settimana per ecosistema, breaking (e minor 0.x
>   cargo) in PR singole. **Zero ignore** — TypeScript 7 incluso
>   (l'incompatibilità con vue-tsc la gestisce l'utente a parte).

---

## Workspace Structure

```
OmniRID/
├── firmware/          # Core (no_std, agnostic)
│   ├── rid-interface/   # Trait contracts (0 tests, pure types)
│   ├── rid-core/        # Hub, scheduler, kalman, auth, security (62 tests)
│   ├── rid-app/         # CLI, web, NVS, OTA, LED status (103 tests)
│   ├── app/             # Controller assembly + /api/capabilities (12 tests)
│   └── bsp-sim/         # Host simulator (binary demo, 0 tests)
├── inputs/            # Protocol parsers
│   ├── proto-mavlink/   # MAVLink v1/v2 (27 tests)
│   ├── proto-nmea/      # NMEA GGA/RMC/VTG (19 tests)
│   ├── proto-msp/       # MSP v1 (15 tests)
│   ├── proto-dronecan/  # UAVCAN v0 Fix2 (16 tests)
│   └── proto-usb-mavlink/ # USB CDC MAVLink (11 tests)
├── outputs/           # Broadcast standards
│   └── out-astm/        # ASTM F3411-22a WiFi/BLE (26 tests)
├── external-libs/     # Vendored C wrapped via FFI
│   └── opendroneid-sys/ # Intel OpenDroneID (11 tests)
└── hardware/          # Real BSP (excluded from workspace)
    └── bsp-esp32/       # ESP32 WiFi/BLE/NVS/LED/USB/OTA (5 tests caps+core)
```

---

## 🎯 TODO — Rust Firmware

### 🔴 CRITICAL — Security & Correctness

- [x] JSON parsing (serde_json replaces naive strstr/C)
- [x] Ed25519 verify_signed_body (ed25519-dalek + pkcs8)
- [x] OTA upload timeout + signature verification
- [x] Base64 strict padding (rid-core::security)
- [x] Rate limiting on signed commands (SigRate in rid-app::web)

### 🟡 HIGH — Quality & Robustness

- [x] Config race conditions (Rust ownership eliminates g_config data race)
- [x] Parser isolation (each proto-* is a separate crate, no shared UART)
- [x] Populate UAS data dedup (out-astm::build_uas)
- [x] GPS staleness detection (rid-core::scheduler)
- [x] **Dual-core pinning** — Core 0 (WiFi TX) / Core 1 (Scheduler+BLE+UI) via `bsp_esp32::core`
- [x] **Release binary / build matrix ESP32** — CI `esp32-build.yml` cross-compila esp32/esp32s3/esp32c6 (xtensa + riscv32imac, build-std) e gira host checks; il packaging degli installer resta in `release.yml` (tag `v*`)

### 🟠 FEATURES — Future

- [ ] **Non-ASTM output encoders** — China GB 42590 (stub in out-astm::stubs), FRDID (US FRIAs)
- [ ] **ESP-NOW mesh relay** — multi-hop range extension (~4d)
- [ ] **LoRa SX1262 backup** — 10+ km emergency link (~6d)
- [ ] **SD Card + geofence logging** — flight log recovery (~4d)
- [x] **CLI command history** — circular buffer last 10 cmds (`rid-app::cli::CommandHistory`)
- [x] **Kalman covariance export** — diagnostic API (`rid_core::kalman::KalmanCovariance`, `Scheduler::kalman_covariance`)
- [x] **Stats tracking** — ticks, GPS updates/discards, parse errors, signatures, TX fails, OTA count (`rid_interface::Stats`, serialized in `/api/status`)

### 🔵 CI/CD & Auto-Update

- [x] **Auto-update la verifica upstream** — `protocol-updates.yml` (settimanale) confronta upstream per OpenDroneID, MAVLink, DroneCAN, ESP-IDF e pagine regulatory; opendroneid è ancora path-dependency (vendored), non `rev` dep
- [ ] **Flash encryption** — eFuse AES-256 (port from peinser)

### 📌 GitHub — Aperti / in corso (aggiornamento 2026-10-19)

- [ ] **[#43] ESP-IDF 6.0 / esp-idf-sys 0.38** — bump committato e **pushato**
  in `ac65114`: esp-idf-sys 0.37 → 0.38.1, esp-idf-svc 0.52 → 0.53
  (re-vendorizzato), esp-idf-hal 0.46 → 0.47. Contro IDF 6.0.2 **bindgen ora
  genera `bindings.rs` per la prima volta**. Rimanente blocco: `esp-idf-hal
  0.47` fallisce perché 36 struct (tra cui `spi_transaction_t`,
  `rmt_encoder_t`) vengono generate **opache** (`{ _address: u8 }`) →
  `cargo +esp check` hardware ancora rosso. **Diagnosi avanzata, poi
  sospeso su richiesta dell'utente** (riprendere solo su richiesta):
  - Harness riproduttivo in `/tmp/opencode/bgtest` che invecchia
    *esattamente* la invocazione di bindgen di esp-idf-sys 0.38.1 (Factory
    da embuild cmake file-api, 245 argomenti clang, picolibc, define
    `ESP_IDF_COMP*`, `-target riscv32`) → con **entrambi** i libclang
    (20.1 Espressif e 23.1 di sistema) produce bindings **corretti**
    (1 sola struct truly empty). Quindi: non è bindgen, non è libclang,
    non è la versione dei crate.
  - Escluso anche: flag opaque-type (nessuno in esp-idf-sys/embuild),
    header extra (`pub mod` = 0), path di include relativi.
  - Enigma riscontrato solo nel build reale: `spi_transaction_t` risulta
    `{ _address: u8 }` pur essendoci la definizione completa in
    `driver/spi_master.h` (mentre `spi_device_t` fwd-decl viene gestito
    correttamente). stderr del build script reale identico (19 warning).
  - Prossimi passi (quando si riprende): verificare doppie copie di
    `driver/spi_master.h` nell'albero IDF con shadowing in include-order;
    forzare il rerun del build script cancellando
    `target/.../.fingerprint/esp-idf-sys-*` (cmake build in `out/build`
    sopravvive) per un loop di riproduzione veloce e diff real-vs-harness.
- [ ] **[#22] Conflitto MAVLink USB / console UART0** (riaperto, "ancora
  valido") — il port Rust usa già `usb_serial_jtag_*` per la console;
  `sdkconfig.defaults` non dichiara alcuna impostazione console. Serve una
  decisione: chiusura documentata o fix esplicito in sdkconfig. Indagine
  avviata ma interrotta.
- [ ] **Backlog non ancora preso** — #26 (refactor prioritari), #27
  (portabilità + dipendenze), #29 (mesh/LoRa/SD/CLI/Kalman/stats — parte già
  fatto), #46 (encoder non-ASTM), #47 (flash encryption), #52 (DroneCAN
  Identity/AHRS), #53 (ground tools), #54 (Web UI polish).
- [x] **Dependabot PR** — #64/#65/#66 mergiati (vedi nota sessione 2026-10-19).
  Restano gli **alert di sicurezza** su GitHub: **18** (3 critical, 10 high,
  2 moderate, 3 low) sul default branch — scesi da 78 dopo il merge di #64 →
  https://github.com/VOLTEKOVER/OmniRID-Universal-Drone-ID/security/dependabot
  (la parte npm coperta in parte da #64; il grosso è altrove — C firmware
  legacy / dipendenze non npm, da verificare).

---

## ✅ DONE — Completed Work

### Workspace & Architecture
- Single workspace with glob members, `exclude = ["hardware"]`
- `rid-interface` trait contracts (no_std, zero deps)
- `bsp-esp32` isolated in `hardware/`, standalone workspace, host-compilable
 - 319 tests passing across all crates
- Clippy clean (`-D warnings`)

### Firmware Core (Fase 0–5)
- rid-core: hub (region dispatch, standard selection), scheduler (tick, GPS staleness, Kalman), auth (Ed25519), security (base64/hex/SHA-256/Ed25519), protocol_detect (auto-detect), readiness (per-region gate), patrol (demo GPS)
- rid-app: CLI (config set/get), JSON API, web_config (signed commands, rate limit), NVS (save/load/reset_preserve_keys), OTA (timeout, signature, SHA-256 streaming), BLE 4.x legacy adv, LED status (7-state RGB) — embedded web UI **removed 2026-10-18** (headless firmware, config handled by the external OmniRID PWA); WS2812 + 5-ch GPIO lighting **removed 2026-10-18** (RGB status LED is the only light source)
- app: Controller (assemble BSP + input + output), /api/capabilities, derive_ids_from_mac

### Input Protocols
- proto-mavlink: MAVLink v1/v2 framing, CRC, MESSAGE_PACK, GPS decode
- proto-nmea: streaming GGA/RMC/VTG parser
- proto-msp: MSP v1 RAW_GPS/ATTITUDE/STATUS
- proto-dronecan: full UAVCAN v0 transfer reassembly, Fix2 DSDL
- proto-usb-mavlink: USB CDC heartbeat + OPEN_DRONE_ID_SYSTEM frames

### Output Standards
- out-astm: ASTM F3411-22a, WiFi beacon + NAN, BLE 4.x rotation, MESSAGE_PACK encode
- opendroneid-sys: vendored Intel C lib with Rust FFI, auto-update weekly

### Hardware (bsp-esp32)
- WiFi beacon/NAN injection, BLE 4.x/5.0 LR (C6 emerge come no-op per binding driver BT), NVS, USB CDC, LED (LEDC/RMT), headless JSON API (CORS-enabled, no embedded UI), OTA
- Capability matrix per chip (esp32/s3/c6)
- Dual-core pinning: Core 0 (WiFi TX) / Core 1 (Scheduler+BLE+UI)
- Feature-gated: `#[cfg(feature = "hardware")]`

### CI/CD (7 workflow)
- OmniRID Host Build (ex "OmniRID CI"): build/test/clippy/fmt su ubuntu + windows
- ESP32 Firmware Cross-Build: host checks + matrix esp32/esp32s3/esp32c6 (`-Z build-std`)
- OmniRID App CI: JS syntax + JSON + serve smoke test (`OmniRID-app`, ex desktop CI)
- Weekly Upstream Sync (ex "Weekly checks"): OpenDroneID, MAVLink, DroneCAN, ESP-IDF, regulatory pages
- Security Audit (cargo-audit + cargo-deny), Release (tag `v*`), Deploy Pages (`docs/`)
- Default branch: `universal` (branch `main` orfana eliminata)

### Documentation & Web App
- guide.html, index.html — all updated for Rust
- OmniRID-app: Nuxt 4 PWA on GitHub Pages — the **only** configuration surface (firmware web UI removed 2026-10-18)

### Audit Fixes (session 2026-08-28)
- [#18] MSP framing corrected: replaced the replicated C off-by-one quirk with standard MSP v1 framing (`buf[3]=size, buf[4]=type, payload=buf[5..]`). Unblocks §10.1 / dataflow section-2 "blocked by §10.1" rows.
- [#24] Operator-location gate: non-MAVLink protocols ignore MAVLink operator location unless explicitly selected (`non_mavlink_protocol_ignores_mavlink_operator_location`).
- [#25] NVS persistence: full config now persisted (protocol, uart_port, tx_pin, rx_pin, dronecan_*, mavlink_usb_enable, ota_trigger_gpio, auth_private_key, start_delay_ms) via get_blob/set_blob + auth lifecycle. Closes dataflow §5/§10.7/§10.8 and processes §6.12 gaps. (`ws2812_*`/`lighting_*` later removed with the dynamic lights, 2026-10-18.)
- [#26] xTaskCreatePinnedToCore return-checked; task module hardware-gated.

### CI Fixes (session 2026-09-16)
- OmniRID-Desktop removed (session 2026-09-17): replaced by OmniRID-app PWA (branch `omnirid-webapp-pwa`).
- `pkcs8` pinned back to 0.10 (2nd time) so the direct dep matches ed25519-dalek 2.2.0 features; Cargo.lock resolves to a single pkcs8 0.10.2/spki 0.7.3.
- OmniRID-Desktop `package-lock.json` committed (gitignore negation) so `npm ci` + setup-node cache work.
- Dropped unused `@abandonware/noble`/`pcap` optional deps (pre-release-only versions broke lockfile sync).
- `node-abi` overridden to 4.35.0 for Electron 44 ABI (rebuild `@serialport/bindings-cpp`).
- Deleted orphaned `main` branch; `--base universal` in auto-update PRs.
- Removed stale GitHub Actions registration of the deleted `opendroneid-update.yml` (its 4 runs were deleted).

---

## 📋 C → Rust Port Summary

| C File(s) | Rust Crate | Status |
|---|---|---|
| `esp_remote_id.h` | `rid-interface` | ✅ |
| `esp_remote_id.c` | `rid-core` + `app` | ✅ |
| `rid_kalman.c` | `rid-core::kalman` | ✅ |
| `rid_output.c/h` | `rid-core::hub` | ✅ |
| `rid_auth.c` | `rid-core::auth` | ✅ |
| `rid_security.c` | `rid-core::security` | ✅ |
| `protocol_detect.c` | `rid-core::protocol_detect` | ✅ |
| `mavlink_parser.c` | `inputs/proto-mavlink` | ✅ |
| `nmea_parser.c` | `inputs/proto-nmea` | ✅ |
| `msp_parser.c` | `inputs/proto-msp` | ✅ |
| `rid_dronecan.c` | `inputs/proto-dronecan` | ✅ |
| `rid_mavlink_usb.c` + `rid_mavlink_tx.c` | `inputs/proto-usb-mavlink` | ✅ |
| `odid_common.c` + `wifi.c` + `ble_tx.c` | `outputs/out-astm` | ✅ |
| `opendroneid.c` + `mav2odid.c` | `external-libs/opendroneid-sys` | ✅ |
| `web_config.c` (pure) | `rid-app::web_config` | ✅ |
| `cli.c` (pure) | `rid-app::cli` | ✅ |
| `nvs_storage.c` | `rid-app::nvs` + `bsp-esp32::nvs` | ✅ |
| `led_status.c` | `rid-app::led_status` | ✅ |
| `led_ws2812.c` | — | ❌ removed 2026-10-18 (dynamic lights dropped) |
| `rid_lighting.c` | — | ❌ removed 2026-10-18 (dynamic lights dropped) |
| `rid_ota.c` (validation) | `rid-app::ota` + `bsp-esp32::ota` | ✅ |
| `ble_tx.c` (framing) | `rid-app::ble4` + `bsp-esp32::ble` | ✅ |
| ESP-IDF HW (WiFi/BLE/NVS/LED/USB) | `hardware/bsp-esp32` | ✅ |

---

## 🛩️ Firmware Roadmap

| Prio | Feature | Effort | Status |
|------|---------|--------|--------|
| P0 | Non-ASTM encoders (CN 42590, FRDID) | ~5d | Future |
| P0 | Veri BLE 5.0 su ESP32-C6 (driver BT binding; oggi no-op) | ~2d | Future |
| P1 | ESP-NOW mesh relay | ~4d | Future |
| P1 | LoRa SX1262 backup | ~6d | Future |
| P2 | Flash encryption (eFuse AES-256) | ~2d | Future |
| P2 | SD Card + geofence logging | ~4d | Future |
| P3 | Kalman covariance export | ~1d | Future |

## 🖥️ Ground Tools Roadmap

| Tool | Effort | Status |
|------|--------|--------|
| Timing Analysis | ~1d | Future |
| NVS Provisioning | ~1d | Future |
| Meshtastic Bridge | ~2d | Future |
| Mesh Mapper | ~3d | Future |

---

## Port Sources

- **peinser/esp-remoteid** — Ed25519, OTA, DroneCAN, MAVLink, flash encryption, WS2812, GPIO lighting. Most ported; missing flash encryption. (WS2812/GPIO lighting deliberately not kept — dynamic lights dropped from our firmware 2026-10-18.)
- **colonelpanichacks/Sky-Spy** — WiFi promiscuous + BLE RID receiver, dual-core pinning, mesh mapper.
- **JimZGChow/wifi-rid-to-mesh** — RID→LoRa Meshtastic bridge, French RID format.
- **PeterJBurke/esp32-c3-remote-id** — Arduino RID with timing analysis.
