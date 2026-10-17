import { dashboardUrl, espWifiSsid } from './app'

export const highlightCards = [
  { title: 'WiFi + BLE', description: 'Broadcasts ASTM Remote ID via WiFi Beacon and BLE 4.0/5.0.', icon: 'i-lucide-wifi' },
  { title: 'MAVLink / MSP / NMEA', description: 'Supports multiple telemetry sources with automatic protocol detection.', icon: 'i-lucide-radar' },
  { title: 'OTA + Security', description: 'Secure update flow with signature verification and hardened config handling.', icon: 'i-lucide-shield-check' }
]

export const installTargets = [
  { name: 'ESP32', value: 'esp32', accent: 'bg-red-500/10 text-red-500' },
  { name: 'ESP32-S3', value: 'esp32s3', accent: 'bg-emerald-500/10 text-emerald-500' },
  { name: 'ESP32-C6', value: 'esp32c6', accent: 'bg-sky-500/10 text-sky-500' }
]

export const recommendedKits = [
  { name: 'ESP32 DevKit', chip: 'ESP32', tip: 'Best for quick prototyping and testing', badge: 'Classic' },
  { name: 'ESP32-S3 DevKit', chip: 'ESP32-S3', tip: 'Long-range support and extra performance', badge: 'Recommended' },
  { name: 'XIAO ESP32-C6', chip: 'ESP32-C6', tip: 'Compact final-build option with USB-C and GNSS', badge: 'Compact' }
]

export const quickStartSteps = [
  'Connect the ESP32 to the computer over USB.',
  'Flash the firmware using the Firmware page or the documented manual build.',
  'Power the board from USB or the flight controller BEC.',
  `Connect to the ${espWifiSsid} WiFi access point.`,
  `Open the dashboard at ${dashboardUrl}.`,
  'Configure identity, flight controller, transmission and security settings.'
]

export const firmwareQuickSteps = [
  'Connect the ESP32 to your computer via USB',
  'Click install and select the serial port',
  'Wait for the firmware to finish flashing',
  'Power the board from battery or USB',
  `Connect to WiFi ${espWifiSsid} and configure at ${dashboardUrl}`
]

export const featureGroups = [
  ['Triple protocol input', 'Automatic protocol detection', 'Built-in demo mode', `Web config panel at ${dashboardUrl}`],
  ['OTA updates', 'Security hardening', 'WS2812 LED support', 'DroneCAN + GPIO lighting'],
  ['Telemetry dashboard', 'Flight-ready config', 'ESP32 target support', 'Manual guide included']
]

export const processSteps = [
  { name: 'Download image', detail: 'Choose the correct release for your board and download the binary.', icon: 'i-lucide-download' },
  { name: 'Connect board', detail: 'Use USB, select the right COM or tty port, then hold BOOT if required.', icon: 'i-lucide-usb' },
  { name: 'Flash and verify', detail: 'Upload the firmware and wait for the device to reboot into AP mode.', icon: 'i-lucide-binary' },
  { name: 'Configure', detail: `Open the captive portal or ${dashboardUrl} and set your identity and network.`, icon: 'i-lucide-settings-2' }
]

export const protocolCards = [
  { title: 'MAVLink', text: 'Reads ArduPilot telemetry via UART on GLOBAL_POSITION_INT, GPS_RAW_INT, VFR_HUD and related frames.', badge: 'Primary' },
  { title: 'MSP', text: 'Supports Betaflight and INAV telemetry using MSP_RAW_GPS and MSP_ATTITUDE over the FC serial stream.', badge: 'Primary' },
  { title: 'NMEA', text: 'Parses GGA, RMC and VTG sentences from GNSS modules for low-complexity hardware integration.', badge: 'Fallback' }
]
