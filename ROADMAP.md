# Roadmap

## Short‑term (next 1–2 weeks)
- Finish fixing strict‑mode TypeScript errors; aim for a clean `pnpm typecheck` pass.
- Implement OTA UI flow and integrate with the firmware `/ota` endpoint.
- Add CI pipeline for the PWA (lint, typecheck, build) to GitHub Actions.
- Align Wi‑Fi credential length limits between firmware and UI.

## Medium‑term (1–2 months)
- Implement LoRa broadcast support (hardware driver, config UI).
- Add non‑ASTM Remote ID encoders (GB 42590, FRDID).
- Enable flash encryption and secure OTA signatures.
- Build DroneCAN identity and AHRS support.

## Long‑term (3+ months)
- Full security audit and hardening (fuzzing parsers, memory safety checks).
- Desktop client with advanced diagnostics and log export.
- Integration with external mapping services (e.g., AirMap, OpenSky).
- Community contributions: plugin system for custom encoders.

---
*This roadmap is a living document; dates and priorities may shift as the project evolves.*
