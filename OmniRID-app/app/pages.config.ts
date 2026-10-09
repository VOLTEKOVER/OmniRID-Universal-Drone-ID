export type PageStatus = "stable" | "implemented" | "wip"
export type PageKind = "drone" | "app"

export type PageStatusMeta = { color: 'success' | 'info' | 'warning', label: string }

export const pageStatusMeta = (status: PageStatus): PageStatusMeta => {
  switch (status) {
    case 'stable': return { color: 'success', label: 'Stable' }
    case 'implemented': return { color: 'info', label: 'Implemented' }
    default: return { color: 'warning', label: 'WIP' }
  }
}

export interface PageConfig {
  id: string
  to: string
  group: string
  label: string
  icon: string
  kind: PageKind
  status: PageStatus
  requiresConnection: boolean
  requiresESP: boolean
  minLockLevel: number
  alwaysAvailable?: boolean
}

export interface PageGroup {
  id: string
  title: string
  icon: string
  kind: PageKind
  items: PageConfig[]
}

export const pageDescriptions: Record<string, string> = {
  'dashboard': 'Live telemetry, ESP connection status, device monitoring and sensor readings',
  'nation': 'Country, Remote ID standard and transmission configuration',
  'inputs': 'Input protocol detection for MAVLink, MSP, NMEA and DroneCAN',
  'identity': 'UAS ID, operator ID, registration number, serial and CAA identity fields',
  'flight-controller': 'Flight-controller link, UART wiring and protocol pins',
  'device-sensors': 'Sensor diagnostics and validation before first flight',
  'hardware': 'Board variant, GPIO, console and power information',
  'system': 'Reset, reboot, uptime and firmware information',
  'memory': 'Storage, presets and memory management tools',
  'compliance': 'Regulatory compliance, ASTM F3411-22a, FAA, EASA and category language',
  'security': 'OTA signature verification, AES, device lock, HTTPS and security audit',
  'console': 'Live firmware console, serial terminal, command output and logs',
  'presets': 'Configuration presets and reusable profiles for the ESP32 device',
  'logging': 'Telemetry recorder and log capture for diagnostics and analysis',
  'sensors': 'Sensor diagnostics and raw telemetry inspection',
  'firmware': 'Flash and update ESP32 firmware via WebSerial or OTA',
  'guide': 'Full technical guide: protocols, configuration, building, OTA, security, antenna, variants, regulations and contributing'
}

export const pageGroups: PageGroup[] = [
  {
    id: "firmware",
    title: "Firmware",
    icon: "i-lucide-flame",
    kind: "drone",
    items: [
      { id: "firmware", to: "/firmware", group: "firmware", label: "Firmware", icon: "i-lucide-flame", kind: "drone", status: "stable", requiresConnection: true, requiresESP: true, minLockLevel: 0, alwaysAvailable: true }
    ]
  },
  {
    id: "docs",
    title: "Guida",
    icon: "i-lucide-book-open",
    kind: "app",
    items: [
      { id: "guide", to: "/docs/guide", group: "docs", label: "Guide", icon: "i-lucide-book-open", kind: "app", status: "stable", requiresConnection: false, requiresESP: false, minLockLevel: 0, alwaysAvailable: true }
    ]
  },
  {
    id: "monitor",
    title: "Monitor",
    icon: "i-lucide-chart-column",
    kind: "app",
    items: [
      { id: "dashboard", to: "/dashboard", group: "monitor", label: "Dashboard", icon: "i-lucide-chart-column", kind: "app", status: "stable", requiresConnection: true, requiresESP: true, minLockLevel: 0 }
    ]
  },
  {
    id: "device",
    title: "Configurazione drone",
    icon: "i-lucide-rocket",
    kind: "drone",
    items: [
      { id: "nation",            to: "/device/nation",            group: "device", label: "Nation, Standard & Transmission", icon: "i-lucide-globe",       kind: "drone", status: "stable",      requiresConnection: true, requiresESP: true, minLockLevel: 0 },
      { id: "inputs",            to: "/device/inputs",            group: "device", label: "Input Protocols",                 icon: "i-lucide-cable",       kind: "drone", status: "stable",      requiresConnection: true, requiresESP: true, minLockLevel: 0 },
      { id: "identity",          to: "/device/identity",          group: "device", label: "Identity",                         icon: "i-lucide-user",        kind: "drone", status: "stable",      requiresConnection: true, requiresESP: true, minLockLevel: 0 },
      { id: "flight-controller", to: "/device/flight-controller", group: "device", label: "Flight Controller",               icon: "i-lucide-plane",       kind: "drone", status: "stable",      requiresConnection: true, requiresESP: true, minLockLevel: 0 },
      { id: "device-sensors",   to: "/device/sensors",           group: "device", label: "Sensors",                          icon: "i-lucide-activity",    kind: "drone", status: "implemented", requiresConnection: true, requiresESP: true, minLockLevel: 0 },
      { id: "hardware",          to: "/device/hardware",          group: "device", label: "Hardware",                         icon: "i-lucide-cpu",         kind: "drone", status: "implemented", requiresConnection: true, requiresESP: true, minLockLevel: 0 },
      { id: "system",            to: "/device/system",            group: "device", label: "System",                           icon: "i-lucide-settings-2",  kind: "drone", status: "wip",          requiresConnection: true, requiresESP: true, minLockLevel: 0 },
      { id: "memory",            to: "/device/memory",            group: "device", label: "Memory",                           icon: "i-lucide-database",    kind: "drone", status: "wip",          requiresConnection: true, requiresESP: true, minLockLevel: 0 }
    ]
  },
  {
    id: "compliance",
    title: "Compliance & Security",
    icon: "i-lucide-scale",
    kind: "drone",
    items: [
      { id: "compliance", to: "/compliance-security/compliance", group: "compliance", label: "Compliance", icon: "i-lucide-scale",        kind: "drone", status: "implemented", requiresConnection: true, requiresESP: true, minLockLevel: 0 },
      { id: "security",   to: "/compliance-security/security",   group: "compliance", label: "Security",   icon: "i-lucide-shield-check", kind: "drone", status: "implemented", requiresConnection: true, requiresESP: true, minLockLevel: 1 }
    ]
  },
  {
    id: "tools",
    title: "Strumenti",
    icon: "i-lucide-wrench",
    kind: "app",
    items: [
      { id: "console", to: "/tools/console", group: "tools", label: "Console", icon: "i-lucide-terminal",  kind: "app", status: "implemented", requiresConnection: true,  requiresESP: false, minLockLevel: 0 },
      { id: "presets", to: "/tools/presets", group: "tools", label: "Presets", icon: "i-lucide-list",      kind: "app", status: "implemented", requiresConnection: true,  requiresESP: false, minLockLevel: 0 },
      { id: "logging", to: "/tools/logging", group: "tools", label: "Logging", icon: "i-lucide-file-text", kind: "app", status: "implemented", requiresConnection: false, requiresESP: false, minLockLevel: 0 },
      { id: "sensors", to: "/tools/sensors", group: "tools", label: "Sensors", icon: "i-lucide-activity",  kind: "app", status: "wip",          requiresConnection: false, requiresESP: false, minLockLevel: 0 }
    ]
  }
]

export const allPages: PageConfig[] = pageGroups.flatMap(g => g.items)

export const pageForRoute = (to: string): PageConfig | undefined =>
  allPages.find(p => p.to === to)

export const groupForRoute = (to: string): PageGroup | undefined =>
  allPages.find(p => p.to === to) ? pageGroups.find(g => g.items.some(p => p.to === to)) : undefined