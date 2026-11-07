<p align="center">
  <img src="docs/images/logo_with_text.svg" alt="OmniRID" width="360">
</p>

<p align="center">
  <a href="https://github.com/VOLTEKOVER/OmniRID-Universal-Drone-ID/actions/workflows/esp32-build.yml"><img src="https://img.shields.io/github/actions/workflow/status/VOLTEKOVER/OmniRID-Universal-Drone-ID/esp32-build.yml?logo=github&label=build" alt="Firmware build"></a>
  <a href="https://github.com/VOLTEKOVER/OmniRID-Universal-Drone-ID/releases"><img src="https://img.shields.io/github/v/release/VOLTEKOVER/OmniRID-Universal-Drone-ID?include_prereleases&logo=github&label=release" alt="Latest release"></a>
  <a href="https://github.com/VOLTEKOVER/OmniRID-Universal-Drone-ID/blob/main/LICENSE"><img src="https://img.shields.io/github/license/VOLTEKOVER/OmniRID-Universal-Drone-ID?color=blue" alt="License"></a>
</p>

# Open Remote ID, made for ESP32

**OmniRID** is an open-source Remote ID transmitter and companion web app for ESP32. It reads flight data from a flight controller or GPS source, builds ASTM F3411-22a Remote ID messages, and broadcasts them over supported Wi-Fi and Bluetooth modes.

The firmware is written in Rust. The web app helps configure the device, monitor its status, and check settings.

## Screenshots

<p align="center">
  <img src="docs/images/omnirid-home.png" alt="OmniRID home page showing the product overview and supported data flow" width="100%">
</p>

<p align="center">
  <img src="docs/images/xiao_esp32c6.jpg" alt="Seeed Studio XIAO ESP32-C6 board" width="360">
</p>

## At a glance

- **Inputs:** MAVLink, MSP, NMEA, and DroneCAN.
- **Broadcast:** ASTM Remote ID over Wi-Fi Beacon, Wi-Fi NAN, and chip-dependent Bluetooth modes.
- **Supported boards:** ESP32, ESP32-S3, and ESP32-C6, with hardware-specific capabilities.
- **Companion app:** device configuration, live dashboard, readiness checklist, and firmware tools.
- **Bench testing:** demo mode can simulate a GPS patrol without a flight controller.

## Get started

1. Choose a supported ESP32 board and flash the firmware.
2. Connect to the device's Wi-Fi network (`ESP-RID` by default).
3. Open the OmniRID web app and connect to the device.
4. Configure the identity, input, and broadcast settings; use demo mode for bench testing.

The complete installation, configuration, troubleshooting, and protocol reference is in the app's [Guide](OmniRID-app/app/pages/guide.vue).

## Project

- [Web app](OmniRID-app/)
- [Firmware](OmniRID-firmware/)
- [Guide content](OmniRID-app/app/config/guide.ts)
- [Issues and discussions](https://github.com/VOLTEKOVER/OmniRID-Universal-Drone-ID/issues)

For app development:

```bash
cd OmniRID-app
pnpm install
pnpm dev
```

> **Development and ground testing only.** OmniRID has not completed its security audit and is not approved or certified for flight. Verify applicable Remote ID requirements before any operational use. See [SECURITY.md](SECURITY.md).
