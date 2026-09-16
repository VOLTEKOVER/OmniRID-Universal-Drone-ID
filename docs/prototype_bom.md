# Prototype Bill of Materials (BOM) & Pinout

Reference board list for prototyping an OmniRID Remote ID transmitter.

## Recommended: Seeed XIAO ESP32-C6 (zero-solder kit)

| # | Part | Qty | Notes |
|---|------|-----|-------|
| 1 | Seeed XIAO ESP32-C6 | 1 | WiFi 6 + BLE 5.3, USP-C + LiPo charger, U.FL + ceramic antenna |
| 2 | L76K GNSS module (XIAO form factor) | 1 | Stackable, direct GPS option |
| 3 | Flight controller (ArduPilot/Betaflight/iNAV) | 1 | GPS data source via UART |
| 4 | GPS source | 1 | Built into FC or direct GPS module |
| 5 | Resistor 1 kΩ | 1 | Series resistor for NMEA tap (prevents backfeed) |
| 6 | LiPo battery (3.7 V) | 1 | Optional, USB-C can power alone |
| 7 | Enclosure | 1 | See `3D_FILES/` models |

Approx. total: **~15€** ($5 board + $10 GPS).

## Minimum wiring (ESP32 + flight controller)

```
Flight Controller    ESP32 (or variant)
─────────────────    ─────────────────
TX (UART)       ->   GPIO16 (UART2 RX)
GND             ->   GND
5V (BEC)        ->   5V / VIN
```

> **NMEA tap**: add a **1 kΩ series resistor** on the tap line to prevent backfeed.

## Alternative boards

| Board | Chip | WiFi | BLE | Price | Best for |
|-------|------|------|-----|-------|----------|
| ESP32-DevKitC V4 | ESP32 | b/g/n | BLE 4.2 | ~5€ | Basic prototyping, testing |
| ESP32-S3-DevKitM-1 | ESP32-S3 | b/g/n | BLE 5.0 LR | ~12€ | On-device ML, PSRAM |
| Seeed XIAO ESP32-C6 | ESP32-C6 | WiFi 6 | BLE 5.3 | ~5€ + 10€ GPS | Final product, smallest footprint |

## Pin compatibility

| Function | ESP32 | ESP32-S3 | ESP32-C6 |
|----------|-------|----------|----------|
| UART TX (default) | GPIO17 | GPIO17 | GPIO17 |
| UART RX (default) | GPIO18 | GPIO18 | GPIO18 |
| Alt UART RX | 4, 26 | 4, 5 | 0, 1 |
| RGB LED R/G/B | Configurable via web UI (default -1) | | |
| WS2812 LED | Configurable via web UI (default -1) | | |
| Lighting 1-5 | 5 independent outputs, any GPIO, 6 patterns, configurable phase | | |
| DroneCAN RX/TX | Configurable via web UI (default -1) | | |
| OTA Trigger | Configurable via web UI (default -1) | | |