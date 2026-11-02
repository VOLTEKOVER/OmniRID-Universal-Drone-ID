# Contributing to OmniRID

Thanks for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- Rust stable toolchain (`rustup`)
- (Optional) `espup` for ESP32 cross-compilation
- (Optional) Node.js 22+ and `pnpm` for the OmniRID App

### Building the Workspace

```bash
cd OmniRID-firmware
cargo build --workspace           # host build
cargo test --workspace            # run all tests (307)
cargo clippy --workspace --all-targets -- -D warnings   # lint
```

### Building the Web App (PWA)

```bash
cd OmniRID-app
pnpm install
pnpm dev                    # local dev server (http://localhost:3000)
pnpm build                  # static build in .output/public
pnpm typecheck              # vue-tsc
pnpm lint
```

## Project Structure

```
OmniRID-firmware/
├── firmware/              # Core Rust crates
│   ├── app/               # Application logic (lib + bin)
│   ├── rid-core/          # Kalman filter, security, TX pipeline
│   ├── rid-app/           # Feature logic (NVS, OTA, web, LED, config)
│   └── rid-interface/     # Shared types and traits
├── inputs/                # Protocol parsers (MAVLink, MSP, NMEA, DroneCAN)
├── outputs/               # Protocol encoders (ASTM, NAN, BLE4, pack)
├── external-libs/         # FFI bindings (opendroneid-sys)
└── hardware/bsp-esp32/    # ESP-IDF glue (standalone workspace)

OmniRID-app/               # Ground station (Nuxt 4 SPA)
docs/                      # Images only (static docs site removed)
```

## Making Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-change`
3. Make your changes
4. Verify no regressions:
   ```bash
   cargo test --workspace
   cargo clippy --workspace --all-targets -- -D warnings
   ```
5. Test on real hardware if possible
6. Update [`TASKS.md`](TASKS.md) when an item is fixed or discovered
7. Commit with a clear message (see below)
8. Push and open a Pull Request

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): short description

Longer explanation if needed.
```

Types: `fix`, `feat`, `docs`, `ci`, `refactor`, `test`, `chore`

Examples:
- `fix(wifi): correct AP reconfiguration on SSID change`
- `feat(auth): add Ed25519 signature verification`
- `docs: update quick start guide`

## Code Style

- Rust: `cargo fmt` (edition 2024), `cargo clippy -D warnings`
- `no_std` for firmware crates; `std` only in `bsp-esp32`
- Keep `unsafe` out of core crates (only in hardware glue)
- Update [`TASKS.md`](TASKS.md) with any new/changed source files

## Reporting Bugs

Use the [Bug Report template](https://github.com/VOLTEKOVER/OmniRID-Universal-Drone-ID/issues/new?template=bug_report.yml) with:
- Clear description and reproduction steps
- Hardware details (ESP32 model, board, antenna)
- Firmware version and build target
- Serial output if applicable

## License

By contributing, you agree that your contributions will be licensed under the
[Apache License 2.0](LICENSE).
