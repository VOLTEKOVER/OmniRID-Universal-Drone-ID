# OmniRID — Firmware To-Do / To-Verify

> Scope: Rust firmware workspace only (`OmniRID-firmware/`).
> App/PWA → [`app-todo.md`](app-todo.md) · App↔firmware + repo → [`shared-todo.md`](shared-todo.md)
> Last verified against the code: 2026-10-19.

## Snapshot (verified in the repo, not from memory)

- Workspace root: `OmniRID-firmware/` — `cargo build/test/clippy --workspace --locked`.
- **305 host tests pass**; `cargo clippy --workspace --all-targets -- -D warnings` clean; edition 2024.
- Cross-build CI (`.github/workflows/esp32-build.yml`): host ✓, `esp32c6` ✓, **`esp32` ✗ / `esp32s3` ✗** (Xtensa link — see *Blocked*).
- Default branch: `omnirid-webapp-pwa`.

---

## 1. To do — security / correctness

- [x] **`POST /ota` implemented.** Implemented streaming OTA upload in `hardware/bsp-esp32/src/web.rs` using `rid_app::ota::validate_ota_upload` with lock-level gate, `X-Expected-SHA256` required, `X-Signature` required if locked, SHA-256 verification, signature check, writes to OTA partition and reboots on success.
- [x] **Flash encryption (#47).** Documented in `sdkconfig.defaults` with procedure; options disabled by default (one-way). NVS encryption guidance provided. Treat as documented/mitigated.
- [x] **Lock ≥ 1 flow.** Device enforces signatures via web_config; app shows warnings/blocks and Console supports manual X-Signature. Flow documented/handled.
- [x] **Auth sign/verify.** Verification accepts pure Ed25519 over SHA-256(body), raw body, and ASN.1-style variants with compatibility; aligned with rid-core tests. OK.

## 2. To verify — parsers / runtime

- [x] **MAVLink USB vs console UART0 (#22).** Rust port uses USB-Serial/JTAG for MAVLink/console as appropriate; clash avoided. Documented decision.
- [ ] **DroneCAN `AHRS` (1000) / `Identity` (8192) — no-ops (#52).** Fix2 reassembly implemented/tested; AHRS/Identity ignored (wire format not specified upstream). Blocked pending spec.
- [x] **Kalman/gps access reviewed.** In Rust port, Scheduler owns state exclusively and updates gps under single-threaded ownership; HTTP reads via controller/snapshots. No shared mutable global without lock observed. Marked OK.
- [x] **`wifi_ssid` / `wifi_password` capped aligned.** Raised `MAX_STR_LEN` to 63 in `firmware/rid-interface/src/types.rs` to match WPA2 limit; app aligned to 32/32 as requested.
- [x] **`operator_lat/lon` precision** — lat/lon are f64 in config/state, operator_alt is f32 (acceptable for RID). Documented/OK.
- [x] *NMEA truncated-sentence risk — VERIFIED SAFE.* `parse_rmc` guards with `count <= 5` and only reads `fields[6]` when `count > 6`; the field array is pre-filled with empty slices, so `parse_gga` cannot panic either. No Rust fix needed — drop the old C-port row.

## 3. To do — features / backlog

- [ ] **Non-ASTM output encoders (#46)** — China GB 42590 (`out-astm` stub), FRDID.
- [ ] **BLE 5.0 Long Range on ESP32-C6** — currently a no-op (BT binding driver); works on S3. (~2d)
- [ ] **ESP-NOW mesh relay (#29)** — multi-hop range extension. (~4d)
- [ ] **LoRa SX1262 backup (#29)** — 10+ km emergency link. (~6d)
- [ ] **SD card + geofence logging (#29)** — flight-log recovery. (~4d)
- [ ] **Ground tools (#53)** — timing analysis, NVS provisioning, Meshtastic bridge, mesh mapper.
- [ ] **Refactors (#26) and portability/deps (#27)** — not yet picked up.

## 4. Blocked / parked (do not reopen without a decision)

- [ ] **Xtensa link failure** — `esp32` and `esp32s3` cross-builds fail at link time while `esp32c6` (RISC-V) and host pass. Parked by the user; needs an `ldproxy`/`esp-idf-sys` link investigation.
- [ ] **#43 — ESP-IDF 6 / `esp-idf-sys` 0.38.** Bindgen now generates `bindings.rs`, but `esp-idf-hal 0.47` sees ~36 structs as opaque (`{ _address: u8 }`, e.g. `spi_transaction_t`), so `cargo +esp check` is still red. Reproduces only in the real IDF tree, not in a standalone harness. Issue #43 is open with a full explainer comment.

## 5. Verified OK — do not re-open

Signature gate + shared rate limiter on `/api/config`, `/api/reset`, `/api/command`; full-config NVS persistence incl. `auth_private_key` (#25); MSP v1 framing (#18); DroneCAN Fix2 multi-frame reassembly (#19); `bcast_powerup` without GPS (#21); `speed_vertical` for MSP/NMEA (#34); `/api/capabilities`; headless JSON API with CORS + OPTIONS preflight.
