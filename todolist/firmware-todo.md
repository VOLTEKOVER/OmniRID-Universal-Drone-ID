# Firmware Backlog

Findings from the repo scan on 2026-11-01. Host baseline: `cargo test --workspace` passes,
`cargo clippy --workspace --all-targets -D warnings` is clean, `cargo fmt --check` **fails**.

## 🔴 Blocking (breaks build / CI)

- [x] **Uncommitted `crate::` rewrite breaks the hardware binary** — reverted to
  `bsp_esp32::…`; `main.rs` now matches the library-crate paths.
- [x] **`crate::usb::init()` called unconditionally in `web.rs`** — replaced with
  `reinit_usb_if_needed()`, guarded by `esp32s3`/`esp32c6` cfg and `cfg.mavlink_usb_enable`.
- [x] **`cargo fmt --check` fails (11 diffs)** — `cargo fmt --all` applied; host
  fmt/clippy/build/test are green.
- [ ] **Xtensa `esp32`/`esp32s3` link failure** (issue #43). This is the existing item; it's tracked here because the README links to this file.
  Local cross-build verification was blocked by a toolchain/ESP-IDF mismatch
  (`bindgen: unknown type name '__FILE'`), not a project-code error.

## 🟡 Cleanup

- [x] `web.rs`: dropped the redundant `.as_deref()` and the case-insensitive `"x-app-token"` fallback.
- [x] `sdkconfig.defaults:51` no longer points at the removed `docs/security-hardening.md`; it now references
  the "Security Hardening" section of `SECURITY.md`.
- [x] `POST /ota` is wired up in `web.rs` (`rid_app::ota` validation, hash/signature checks,
  reboot on success). The app-side upload UI remains pending.
- [x] README/CONTRIBUTING test count recounted: **307** tests (was 305).

## 🔍 Deep review (pending)

Per-module review results for the firmware core, the parsers, out-astm and the bsp-esp32 web API / FFI
will be added below when the review completes.
