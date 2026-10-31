# Firmware Overview (v0.1)

**OmniRID‑Universal‑Drone‑ID** ships a pure‑Rust firmware that runs on ESP32‑family chips and implements the ASTM F3411‑22a Remote ID specification.  The firmware is deliberately split into three *no‑std* crates that communicate through well‑defined contracts, making the core logic hardware‑agnostic and fully unit‑testable on the host.

---

## 1. Crate architecture

| Crate | Responsibility | Key modules |
|------:|----------------|------------|
| `rid‑core` | Central processing, scheduling, Kalman filter, demo patrol, protocol auto‑detection, transmission gating. | `scheduler.rs`, `patrol.rs`, `protocol_detect.rs`, `kalman.rs`, `readiness.rs` |
| `rid‑app`  | Board‑agnostic application layer: configuration handling, JSON API, CLI, OTA validation, security primitives, LED state machine, NVS persistence, web helpers. | `config.rs`, `json.rs`, `ota.rs`, `cli.rs`, `led_status.rs`, `web.rs` |
| `rid‑interface` | Neutral data contracts shared by *core* and *app* (and the BSP adapters). Defines fixed‑size C‑style strings, enums, and the `GpsSource` / `Transmitter` traits. | `types.rs`, `input.rs`, `odid.rs`, `region.rs` |

The **BSP** (e.g. `bsp‑esp32`) provides concrete implementations of `UartRead`, `UartWrite`, and `CanRead`/`CanWrite` that plug into `rid‑core`/`rid‑app`.  Because the core never touches hardware directly, the same logic can be executed on the host for fast unit testing (`bsp‑sim`).

---

## 2. Input handling & auto‑detection

`rid‑core::protocol_detect::detect_protocol` inspects the raw UART buffer and classifies the stream according to the following precedence (see the source for the exact byte patterns):

1. **Empty buffer** → `Protocol::Unknown` (no data).
2. **MSP** – the buffer starts with the literal `"$M<"` (three bytes).
3. **NMEA** – the buffer starts with `"$G"` or `"$N"`.
4. **MAVLink** – the buffer contains a MAVLink start byte (`0xFE` for v1 or `0xFD` for v2) followed by a payload length that fits inside the buffer.
5. Anything else → `Protocol::Unknown` (the previous C implementation mistakenly fell back to NMEA, causing real MAVLink/MSP streams to be starved – see issue #48).

The detection routine is *pure*; it never consumes bytes.  The caller (the UART source in the BSP) re‑feeds the *same* buffer to the appropriate parser based on the returned enum.

### DroneCAN
DroneCAN data is **not** part of the auto‑detect loop; it is a secondary source.  The scheduler treats a CAN frame as a separate `gps` field (`dronecan: Option<GpsData>`).  When present, it can be merged with the primary GPS fix (see `Scheduler::tick`).

---

## 3. Demo mode

When the configuration option `OPT_DEMO_MODE` (bit 3) is set, the scheduler bypasses all hardware input and synthesises a simple circular patrol trajectory (`rid‑core::patrol::Patrol`).  The demo generates:

* Latitude/longitude around Rome (≈ 41.9028 / 12.4964) with a radius of ~0.003°.
* Altitude wobbling between 30 m and 70 m.
* Speed roughly 6 m/s with a small sinusoidal variation.
* A realistic GPS fix type (2‑4) and satellite count (6‑16).

The demo mode is also exposed through the CLI (`demo` command) and via the web UI (checkbox under *Options*).  It is useful for rapid UI testing without a physical flight controller.

---

## 4. Output / transmission

`rid‑core` builds an `Identity` and a `GpsData` structure on every tick.  The `Transmitter` trait (implemented by the BSP‑specific output crates) receives these structures and forwards them to the four supported radio transports:

| Transport | Implementation | Frequency (default) |
|----------:|----------------|----------------------|
| Wi‑Fi **Beacon** | `wifi_bcn` | `wifi_bcn_rate_hz` (1 Hz) |
| Wi‑Fi **NAN**   | `wifi_nan` | `wifi_nan_rate_hz` (0 Hz, disabled by default) |
| BLE **Legacy**  | `ble4`     | `ble4_rate_hz` (1 Hz) |
| BLE **Long‑Range** | `ble5`   | `ble5_rate_hz` (1 Hz) |

Each transmission carries the ASTM F3411‑22a payload (`out‑astm` crate) signed with the Ed25519 private key (stored in NVS, see *Security* below).  The `bcast_powerup` flag forces a transmission on power‑up even when no GPS fix is available – a regression from the original C code was fixed in the scheduler (`update_transmissions` now runs unconditionally).

---

## 5. Configuration & lock levels

Configuration lives in a `BspConfig` struct (`rid‑app::config`).  It mirrors the original `rid_config_t` C struct and is persisted in NVS via `rid_app::nvs`.  Important fields include:

* **UART** – `uart_port`, `baud_rate`, `tx_pin`, `rx_pin`.
* **Region** – `region` (auto or ISO‑defined).
* **IDs** – `uas_id`, `operator_id`, optional secondary IDs.
* **Transmit modes** – bitmask (`TRANSMIT_WIFI_BCN`, `TRANSMIT_WIFI_NAN`, `TRANSMIT_BLE4`, `TRANSMIT_BLE5`).
* **Lock level** – `lock_level` (`0` = Normal, `1` = Ed25519‑signed, `2` = eFuse permanent).  When `lock_level >= 1` every POST to `/api/config` and every OTA upload must include a valid Ed25519 signature (`X‑Signature` header).  The permanent lock (`eFuse`) disables all writes except a full flash erase.

**OTA** – The `/ota` endpoint currently returns `501 Not Implemented`.  Validation logic (`validate_ota_upload`) already exists (SHA‑256 checksum + Ed25519 signature) but the HTTP handler is not wired.  The stub is intentional until the flash‑encryption workflow is finalised.

---

## 6. Security hardening

* **Authentication** – Ed25519 keys (max 512 bytes PEM).  The firmware signs each ASTM broadcast (four pages per cycle).  Verification helpers live in `rid_core::security` and are re‑exported by `rid_app`.
* **Rate limiting** – A simple per‑IP counter caps failed signature attempts to 10 per 60 s.
* **Bounded strings** – All public‑facing strings are stored in fixed‑size buffers (`MAX_STR_LEN` = 63, `MAX_KEY_LEN` = 256) and validated on every write.
* **Safe JSON** – The web API uses `serde_json` with strict type definitions; malformed JSON is rejected before touching NVS.

---

## 7. Build & flash workflow (v0.1)

```bash
# Clone the repo (already done for you)
cd OmniRID-firmware

# Host build – useful for running tests and the simulator
cargo build --workspace           # builds all crates for the host
cargo test  --workspace           # runs 300+ unit tests
cargo clippy --workspace --all-targets -- -D warnings

# ESP32 cross‑build (choose the target you need)
cd hardware/bsp-esp32
# Xtensa targets (ESP32, ESP32‑S3)
RUSTC_BOOTSTRAP=1 cargo +esp build -Z build-std=std,panic_abort \
    --no-default-features --features esp32,hardware \
    --target xtensa-esp32-espidf
RUSTC_BOOTSTRAP=1 cargo +esp build -Z build-std=std,panic_abort \
    --no-default-features --features esp32s3,hardware \
    --target xtensa-esp32s3-espidf
# RISC‑V target (ESP32‑C6)
RUSTC_BOOTSTRAP=1 cargo +nightly build -Z build-std=std,panic_abort \
    --no-default-features --features esp32c6,hardware \
    --target riscv32imac-esp-espidf
```

**Flashing** (USB/serial):
```bash
# Using espflash (or any serial flasher)
espflash write-target <binary>
```

**Demo mode** can be enabled either by setting the `OPT_DEMO_MODE` bit in the NVS config (via the web UI) or by passing the `demo` CLI command after flashing.

---

## 8. Known limitations / TODO (as of v0.1)

| Area | Open items |
|------|------------|
| OTA | Wire the validated upload handler to the HTTP endpoint; enable flash‑encryption (`CONFIG_SECURE_FLASH_ENC`). |
| BLE 5 Long‑Range | Validate on ESP32‑C6 hardware; currently only the scheduler toggles the flag. |
| Wi‑Fi NAN | Not wired in the default config (rate = 0). |
| Xtensa build failures | The CI shows failures for `esp32`/`esp32s3` – tracked in `todolist/firmware‑todo.md`. |
| Security audit | Full penetration testing, fuzzing of parsers, and lock‑level hardening are pending (see `SECURITY.md`). |

---

## 9. References

* **Source code** – `OmniRID-firmware/` (Rust workspace).
* **Protocol specs** – ASTM F3411‑22a, OpenDroneID (Intel).
* **Design documents** – `README.md` (high‑level overview), `SECURITY.md` (security model), `CHANGELOG.md` (release notes).

---

*The firmware is currently in **beta** (v0.1).  All public‑facing behavior is documented here to keep the top‑level README concise and to provide developers with an accurate, code‑driven reference.*
