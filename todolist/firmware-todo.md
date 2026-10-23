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

- [ ] **`POST /ota` is a stub.** `hardware/bsp-esp32/src/web.rs` answers `501 {"error":"OTA not implemented; flash via serial/USB"}`. There is no server-side upload / `X-Expected-SHA256` / `X-Signature` handling, even though `firmware/rid-app/src/ota.rs` contains the validators + tests. Decide: implement streaming upload (with the lock-level gate), or remove the endpoint and drop the app OTA page.
- [ ] **Flash encryption (#47).** Not enabled; `auth_private_key` (Ed25519) is stored in NVS in plaintext. Until `CONFIG_SECURE_FLASH_ENC` is a production option, treat NVS as readable.
- [ ] **Lock ≥ 1 has no working browser client.** `write_decision` / `handle_command` correctly reject unsigned `POST /api/config`, `/api/command`, `/api/reset` at lock ≥ 1 (HTTP 401, 429 after 10 failures/60 s — verified in `web.rs`). But the PWA cannot produce an Ed25519 signature (no private key client-side), so at lock ≥ 1 the device is configurable only via the Console's manual `X-Signature` field or the CLI. Decide the intended flow.
- [ ] **Auth sign/verify asymmetry.** Self-signing uses pure Ed25519 while verification uses a SHA-256 pre-hash in some paths. Verify that signatures produced by the device validate under the client's convention (and vice-versa) before relying on it.

## 2. To verify — parsers / runtime

- [ ] **MAVLink USB vs console UART0 (#22).** The Rust port maps MAVLink-USB to the USB-Serial/JTAG peripheral (`hardware/bsp-esp32/src/usb.rs`), not UART0 as in the deleted C code, so the original clash is architecturally gone. On C3/C6 the same peripheral may also carry console output — needs a runtime/hardware check. `sdkconfig.defaults` declares no console setting. Then close the issue with a decision (documented close vs explicit sdkconfig fix).
- [ ] **DroneCAN `AHRS` (1000) / `Identity` (8192) are still no-ops (#52).** `inputs/proto-dronecan/src/parser.rs` returns early for them ("AHRS/Identity and anything else are no-ops"). The wire format for `org.drone_id.Identity` is not specified upstream. Fix2 reassembly itself works and is tested.
- [ ] **Kalman writes `g_state.gps` without a lock.** Confirm no other thread (HTTP API, CLI) can read the same struct concurrently; otherwise move to a locked snapshot. (Old C-era race row — re-check against the Rust ownership model.)
- [ ] **`wifi_ssid` / `wifi_password` are capped at `MAX_STR_LEN = 32`** (`firmware/rid-interface/src/types.rs`), vs the WPA2 limit of 63 for the PSK. The app currently accepts up to 63. Either raise the firmware cap or clamp the input (see `shared-todo.md`).
- [ ] **`operator_lat/lon` are stored as `f32` in NVS** (~1e-7° precision). Acceptable for RID; widen or document if survey-grade is ever needed.
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
