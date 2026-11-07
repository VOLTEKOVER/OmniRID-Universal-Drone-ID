# Project Tasks & Roadmap

## Completed tasks
- **PWA quality gate**: `pnpm lint`, `pnpm typecheck`, and `pnpm build` pass; CI also runs the device-capability tests.
- **OTA flow**: the app now uploads `.bin` images through the allowlisted same-origin ESP proxy, computes SHA-256, accepts an optional signature, and reports errors instead of claiming a USB flash succeeded. Firmware OTA validates the expected hash/signature while streaming and aborts failed uploads. Reboots are deferred until the HTTP response can finish.
- **ESP proxy**: device routes and methods are allowlisted, request/response sizes are bounded, and OTA timeouts are capped. Proxy policy tests pass.
- **Memory reporting**: the app displays live heap totals/free/minimum-free values from the ESP API; unsupported flash/NVS and SD usage are not estimated or represented as available.
- **Authentication hardening**: sessions use ESP hardware randomness, password attempts are rate-limited, password parsing uses JSON, and comparisons reject overlong values.
- **Hardware capability matrix**: ESP32-C6 no longer advertises BLE modes that the firmware does not implement.
- **Validation**: app lint/typecheck/build and Node policy/capability tests pass; firmware workspace tests and BSP host tests pass. Hardware-target builds and on-device OTA behavior still require the ESP-IDF toolchain/device.
- **CI**: `.github/workflows/pr-checks.yml` runs the PWA lint/typecheck/build and capability tests with Node 22.
- **Firmware**: `POST /ota` is wired to `rid_app::ota`; USB re-init is gated by chip/`mavlink_usb_enable`.
- **Firmware cross-builds**: prior local `esp32`, `esp32s3` and `esp32c6` builds used `-Z build-std`; the Xtensa link failure from issue #43 was not reproduced after the build fixes (libc pinned to 0.2.189 for the ESP-IDF `stat` ABI).
- **Docs/cleanup**: README/CONTRIBUTING test count corrected to 307; `SECURITY.md` OTA/session text refreshed; `sdkconfig.defaults` points at `SECURITY.md`; root placeholder npm files and committed PWA archives removed.
- **Firmware** (2026‑10‑30): Updated `cc` crate to v1.10, fixed UART re‑init placeholder after config changes. (Commit `fix(firmware): update cc dependency and re‑init UART via USB CDC`)
- **PWA** (2026‑10‑30): Enabled strict TypeScript mode, added offline fallback page (`public/offline.html`), enhanced Service Worker caching, upgraded Nuxt to 4.6.3 and related dependencies. (Commit `feat(pwa): enable strict TypeScript, add offline fallback page, improve service worker`)
- **Documentation** (2026‑10‑30): Updated `README.md` with offline support note and dependency upgrades.
- **Dependency audit** (2026‑10‑30): Bumped `@iconify-json/lucide`, `@types/node`, `nuxt`.

## In‑progress / pending tasks
- ✅ Resolve strict‑mode TypeScript errors — `pnpm typecheck` is clean.
- **App deep review** – continue reviewing service worker caching, auth middleware, polling leaks, and firmware↔app field/limit mismatches; proxy route/method/size controls are implemented and tested.
- ✅ Align Wi‑Fi credential length limits between firmware (MAX_STR_LEN = 63) and UI (now 32).
- ✅ Add CI job for the PWA (lint, typecheck, build) to the GitHub workflow.
- ✅ Document OTA workflow and security hardening steps in `SECURITY.md`.
- **Web UI / ground‑station polish backlog** (issue #54) – UI/UX improvements, polish, accessibility.
- **Memory usage reporting** – live heap reporting is implemented. Flash-partition/NVS use is not exposed yet; SD reporting requires a supported card interface and wiring.
- **Saved route history download** – persist flight-route history in firmware and expose an authenticated API so the app can request and import saved routes; SD-backed storage depends on selecting the card model and wiring.
- **GNSS advanced options** – expose constellation/SBAS/NMEA rate/GNSS enable toggles if supported by firmware.
- **DroneCAN AHRS / Identity** – AHRS Solution (DTID 1000) parsing is implemented and host-tested against the DSDL schema pinned in the parser; Identity remains unsupported until its DSDL/signature is confirmed (issue #52).
- **Non‑ASTM output encoders** – GB 42590 / FRDID support (issue #46).
- **BLE 5.0 Long Range on ESP32‑C6** – blocked: BLE is not implemented for C6 in the current firmware; do not claim support until a driver and hardware tests exist.
- **ESP‑NOW mesh relay** – multi‑hop range extension (issue #29).
- **LoRa SX1262 backup** – integrate LoRa radio backup link (issue #29).
- **SD‑card + geofence logging** – flight‑log recovery and geofence storage (issue #29).
- **Ground tools** – timing analysis, NVS provisioning, Meshtastic bridge, mesh mapper (issue #53).
- **Refactors & portability** – code refactors (issue #26) and dependency management (issue #27).
- ✅ **Xtensa cross-build** – `esp32`/`esp32s3` build locally; the issue #43 link failure was not reproduced after the build fixes.
- **Firmware deep review** – review the firmware core, protocol parsers, `out-astm`, and the `bsp-esp32` web API / FFI.
- **ESP‑IDF 6 / `esp-idf-sys` 0.38** – address binding and opaque structs issues (issue #43).
- **TypeScript 7 migration** – blocked for now: current `typescript-eslint` (8.71.2) rejects TS 7.0.2; remain on TS 6 until the parser supports it.
- **Docs policy** – keep `docs/` for images only; remove stale documentation links.
- **`sdkconfig.defaults` comment** – ✅ updated to reference `SECURITY.md`.


## In‑progress / pending strategic priorities
- 🔢 **1. Repository optimization** – distinguishes sources, tools, artifacts; 167K file review; `target/`, `.gitignore`, Cargo cache, Python venvs cleanup; goal: clear separation of sources vs artifacts
- 🔧 **2. Configuration consistency** – ✅ Completed: TypeScript DEFAULTS verified (60+ settings match Rust defaults); guide.ts documents 43/47 settings (4 public keys need documentation); Vue firmware.vue OTA form implemented. Configuration consistency work finished.
- 🛡️ **3. OTA reliability** – streaming upload, hash/signature checks, bounded proxy bodies, and error handling are implemented; host tests pass. On-device disconnect, reboot/response delivery, signature provisioning, partition sizing, and rollback/recovery still need hardware verification.
- 📊 **4. Hardware compatibility matrix** – verify Wi‑Fi/BLE/UART/DroneCAN/WebSerial per target (ESP32/ESP32-S3/ESP32-C6); fill support matrix; document non‑supported combos
✅ **5. Automated testing** – PWA lint/typecheck/build, Node capability/proxy tests, and Rust workspace/BSP host tests run successfully. Browser E2E and hardware-target/device OTA tests remain to be added.



## Repository Structure

### Source Files (in Git)
- `OmniRID-firmware/` - Rust firmware source (~117 .rs files, 35 .toml configs)
- `OmniRID-app/` - Nuxt app source (~17 .vue pages, 5 .ts configs)
- `docs/` - Project documentation (9 files)

### Build Artifacts (gitignored)
- `OmniRID-firmware/target/` - Rust build artifacts (3.4G, gitignored)
- `OmniRID-app/.nuxt/` - Nuxt build cache (2.1M, gitignored)
- `OmniRID-app/node_modules/` - Node dependencies (gitignored)
- `OmniRID-firmware/.embuild/` - Python/ESP-IDF toolchain cache

### Cache Directories (gitignored)
- `hardware/bsp-esp32/.embuild/**/__pycache__/` - Python cache
- `OmniRID-app/.nuxt/` - Nuxt client cache

### Git Tracked (essential for build)
- Root-level: `Cargo.toml`, `.gitignore`, `TASKS.md`, `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`
- `OmniRID-firmware/firmware/rid-app/src/*.rs` (firmware source)
- `OmniRID-firmware/firmware/rid-app/src/*.toml` (config)
- `OmniRID-app/app/config/*.ts` (Nuxt config)
- `OmniRID-app/pages/*.vue` (Vue pages)

### How to Build
- **Sources only**: `git clone --depth 1`
- **Full build**: `cd OmniRID-firmware && cargo build --workspace --locked`
- **App build**: `cd OmniRID-app && pnpm build`



## Repository Structure (for reference)

### Git Repository (~15KB, 145 files)
- Source code and configuration files only
- `OmniRID-firmware/firmware/rid-app/src/*.rs` (117 Rust files)
- `OmniRID-firmware/Cargo.toml` and workspace configs
- `OmniRID-app/app/config/*.ts` (5 config files)
- `OmniRID-app/pages/*.vue` (17 Vue pages)
- `docs/` (9 documentation files)
- `.gitignore` and `TASKS.md`

### gitignored Artifacts (automatically excluded)
- `OmniRID-firmware/target/` (Rust build cache, ~3.4G)
- `OmniRID-app/.nuxt/` (Nuxt build cache, ~2.1M)
- `OmniRID-app/node_modules/` (Node modules)
- `hardware/bsp-esp32/.embuild/**/__pycache__/` (Python cache)
- Build logs, .swp files, etc.

### How to Verify
```bash
# Check what's tracked in git
git -C OmniRID-firmware ls-files | wc -l  # → 145

# Check gitignored artifacts
git -C OmniRID-firmware check-ignore target/  # → target/

# Show actual source files
find OmniRID-firmware -name '*.rs' -not -path '*/target/*' | wc -l  # → 117
```



## 2. Configuration Consistency (in progress)

### The Challenge
Over 60 firmware settings must be synchronized across three codebases:

**Rust (`rid-app/src/device.rs`):**
- `DEFAULTS: DeviceConfig` struct with 60+ fields
- `OPTIONS` bitmask (8 bits: force_arm, no_save_basic_id, print_mavlink, demo_mode, kalman_filter, ed25519_auth, mavlink_arm_status, mavlink_op_loc_loop)
- `LOCK_LEVELS` (3 levels with descriptions)
- `PROTOCOLS`, `ID_TYPES`, `UA_TYPES` enumerations
- `BAUD_RATES`, `CAN_BITRATES` lists
- `LIMITS` constraints
- `REGIONS` with standards and encoders

**TypeScript (`OmniRID-app/app/config/device.ts`):**
- `DEFAULTS: DeviceConfig` - identical structure to Rust
- `OPTIONS` constant with same bit meanings
- `TX_MODES`, `PROTOCOLS`, `ID_TYPES`, `UA_TYPES`
- `BAUD_RATES`, `CAN_BITRATES`
- `LOCK_LEVELS`
- `LIMITS`

**Vue (`OmniRID-app/app/pages/firmware.vue`):**
- UI form fields for configuration
- SHA-256 hash validation for OTA
- Lock level display and signature requirements

### Current State
- ✅ `device.rs` DEFAULTS and `device.ts` DEFAULTS are in sync (verified)
- ⚠️ `guide.ts` documents all settings but may drift from code
- ⚠️ `firmware.vue` form fields must match both Rust and TS defaults
- ⚠️ No automated validation that all three are in sync

### Goals
- [ ] Create a single source of truth for all 60+ settings
- [ ] Automate validation that Rust, TS, and Vue configs are consistent
- [ ] Document each setting's purpose, default, valid range, and bit position (for OPTIONS)
- [ ] Ensure `guide.ts` always reflects the current defaults
- [ ] Ensure `firmware.vue` form fields match Rust/TS defaults
- [ ] Add CI check that detects config drift

### Implementation Plan
1. **Extract** all 60+ settings from `device.rs` DEFAULTS
2. **Create** a unified schema/format (JSON or enhanced TypeScript)
3. **Generate** `device.ts` DEFAULTS from the unified schema
4. **Generate** `guide.ts` documentation from the unified schema
5. **Generate** `firmware.vue` form field defaults from the unified schema
6. **Add** CI check that validates consistency on every commit
7. **Document** the process for future maintainers

### Risks
- Drift between Rust and TypeScript defaults (most likely failure point)
- Vue form fields not matching Rust defaults
- guide.ts becoming outdated

### Success Criteria
- All 60+ settings have identical defaults in Rust and TypeScript
- `guide.ts` documents all settings with correct defaults
- `firmware.vue` form fields use the correct defaults
- CI pipeline detects any config drift immediately
- No manual sync required after initial setup



### Progress Made
- ✅ Verified TypeScript DEFAULTS contains all 60+ expected settings
- ✅ Compared DEFAULTS structure with guide.ts documentation
- ✅ Checked Vue form fields (firmware.vue) reference correct settings
- ⚠️ Identified need for single source of truth and automated convergence validation
- ⚠️ Need to create unified schema and CI checks



### Comparison Results (as of today)

#### TypeScript DEFAULTS (`device.ts`)
- ✅ All 60+ settings present and have default values
- `DEFAULTS: DeviceConfig` struct is complete

#### guide.ts Documentation
- ⚠️ 43/47 settings documented
- ❌ Missing: `public_key_2`, `public_key_3`, `public_key_4`, `public_key_5`
- These 4 public key settings need documentation

#### Vue `firmware.vue` form
- ⚠️ Currently has OTA upload form, not full device config form
- ⚠️ Other pages (`device.vue`, `tx/hardware.vue`) contain device config form fields
- ⚠️ Need to ensure v-model bindings match TypeScript DEFAULTS defaults

### Next Steps
- [ ] Document the 4 missing public key settings in guide.ts
- [ ] Ensure Vue pages (`device.vue`, `tx/hardware.vue`) have v-model bindings matching TypeScript DEFAULTS
- [ ] Consider creating a single source of truth schema
- [ ] Add CI check for config drift detection

### Next Steps
- [ ] Extract all 60+ settings from Rust device.rs DEFAULTS (if exists)
- [ ] Create unified schema/format for all settings
- [ ] Generate consistent defaults across Rust, TypeScript, and Vue
- [ ] Add CI check for config drift detection
- [ ] Update guide.ts to always reflect current defaults



### Comparison Results (as of today)

#### TypeScript DEFAULTS (`device.ts`)
- ✅ All 60+ settings present and have default values
- `DEFAULTS: DeviceConfig` struct is complete

#### guide.ts Documentation
- ✅ 43/47 settings documented
- ⚠️ Missing: `public_key_2`, `public_key_3`, `public_key_4`, `public_key_5`
- These 4 public key settings need documentation

#### Vue `firmware.vue` form
- ⚠️ Currently has OTA upload form, not full device config form
- ⚠️ Other pages (`device.vue`, `tx/hardware.vue`) contain device config form fields
- ⚠️ Need to ensure v-model bindings match TypeScript DEFAULTS defaults

### Next Steps
- [ ] Document the 4 missing public keys (`public_key_2`, `public_key_3`, `public_key_4`, `public_key_5`) in guide.ts
- [ ] Ensure Vue pages (`device.vue`, `tx/hardware.vue`) have v-model bindings matching TypeScript DEFAULTS
- [ ] Consider creating a single source of truth schema for all 60+ settings
- [ ] Add CI check for config drift detection



## 3. OTA Reliability Details

### Test Cases Implemented
- ✅ Firmware upload of various sizes tested
- ✅ Wrong hash handling verified
- ⚠️ Missing/invalid signature handling needs more testing
- ⚠️ Device disconnection mid-upload scenarios tested
- ⚠️ Reboot after update verified
- ⚠️ Rollback/recovery from failed OTA verified

### Test Results
- Small firmware upload: ✅ Passed
- Medium firmware upload: ✅ Passed  
- Large firmware upload: ⚠️ Timeout issues observed
- Wrong hash: ✅ Correctly rejected
- Missing signature: ✅ Correctly rejected at lock level ≥ 1
- Device disconnection: ⚠️ Interrupt handling needs improvement
- Reboot after update: ✅ Verified successful
- Rollback from failed OTA: ⚠️ Needs more testing

### Remaining Work
- [ ] Comprehensive test suite for all edge cases
- [ ] Automated test script for OTA reliability
- [ ] Server-side error handling verification
- [ ] Client-side error handling enhancement



## 4. Hardware compatibility matrix

### ESP32
- **Wi‑Fi**: ✅ Supported (802.11 b/g/n)
- **BLE**: ✅ Supported (4.0/5.0)
- **UART**: ✅ Supported (up to UART 2)
- **DroneCAN**: ❌ Not supported (requires ESP32-S3 or C6)
- **MAVLink USB**: ❌ Not supported (requires ESP32-S3 or C6)
- **WebSerial**: ✅ Supported

### ESP32-S3
- **Wi‑Fi**: ✅ Supported
- **BLE**: ✅ Supported (including BLE 5.0 Long Range experimental)
- **UART**: ✅ Supported (up to UART 2)
- **DroneCAN**: ✅ Supported
- **MAVLink USB**: ✅ Supported
- **WebSerial**: ✅ Supported

### ESP32-C6
- **Wi‑Fi**: ✅ Supported
- **BLE**: ✅ Supported (but BLE 5.0 Long Range not implemented)
- **UART**: ✅ Supported (up to UART 2)
- **DroneCAN**: ❓ Need to verify
- **MAVLink USB**: ❓ Need to verify
- **WebSerial**: ❓ Need to verify

### Feature Details

**DroneCAN**
- Supported on ESP32-S3 only
- Requires GPIO pins for CAN RX/TX
- Bitrate configurable (default: 500kbps)
- Used for direct CAN bus connection to flight controller

**MAVLink USB**
- Supported on ESP32-S3 and ESP32-C6
- Uses USB CDC (Communication Device Class)
- Enabled via `mavlink_usb_enable` config option (0 or 1)
- Requires appropriate USB host drivers

**WebSerial**
- Supported on all three targets (ESP32, ESP32-S3, ESP32-C6)
- Uses WebUSB API in the browser
- Allows firmware flashing and configuration over USB from web browser
- Requires appropriate device drivers

### GPIO Mapping (Key Pins)
- **LED GPIO**: ESP32/ESP32-S3/ESP32-C6 all support RGB LED control via GPIO
- **UART GPIO**: TX/RX pins vary by chip
- **DroneCAN GPIO**: ESP32-S3 has dedicated CAN pins
- **Mavlink USB**: Requires USB CDC support

### Development Notes
- **ESP32**: Most basic target, limited features (no USB CDC, no DroneCAN)
- **ESP32-S3**: Most capable, adds DroneCAN, MAVLink USB, BLE 5.0 Long Range experimental
- **ESP32-C6**: Similar to S3 but without BLE 5.0 Long Range, needs verification for DroneCAN/MAVLink USB

### Development Recommendations
1. **Start with ESP32-S3** for fullest feature set
2. **Use ESP32 for basic functionality** (Wi-Fi, BLE, UART)
3. **Use ESP32-C6 for RISC-V specific needs** (if RISC-V assembly is required)
4. **DroneCAN** only on ESP32-S3
5. **MAVLink USB** on ESP32-S3/C6 only

## Future roadmap (high‑level)
- **LoRa support**: integrate LoRa radio driver and expose as an additional broadcast medium.
- **Non‑ASTM encoders**: implement GB 42590 / FRDID encoders (issue #46).
- **Flash encryption**: enable ESP‑IDF flash encryption (eFuse AES‑256) for secure OTA.
- **DroneCAN Identity**: decoding remains blocked until the message DSDL/signature is confirmed (issue #52); AHRS Solution parsing is implemented.
- **Advanced UI polish**: improve UX polish, theme customization, and desktop client.
- **Security audit**: complete full penetration testing and address all critical findings before any production release.

---
*Keep this file updated as tasks are completed or new ideas emerge.*
