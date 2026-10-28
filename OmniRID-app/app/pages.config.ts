export type PageStatus = 'stable' | 'implemented' | 'planned' | 'wip'
export type PageKind = 'drone' | 'app'

export type PageStatusMeta = { color: 'success' | 'info' | 'warning', label: string }

export const pageStatusMeta = (status: PageStatus): PageStatusMeta => {
  switch (status) {
    case 'stable': return { color: 'success', label: 'Stable' }
    case 'implemented': return { color: 'info', label: 'Implemented' }
    case 'planned': return { color: 'warning', label: 'Planned' }
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
  'identity': 'UAS ID, operator ID, registration number, serial and CAA identity fields',
  'flight-controller': 'Flight-controller link, UART wiring and protocol pins',
  'hardware': 'Board variant, GPIO, console and power information',
  'memory': 'Storage, presets and memory management tools',
  'security': 'Device lock, command signing, public keys, panel access and security options',
  'console': 'Live firmware console, serial terminal, command output and logs',
  'presets': 'Configuration presets and reusable profiles for the ESP32 device',
  'logging': 'Telemetry recorder, live sensor readings and log capture for diagnostics and analysis',
  'rx-receiver': 'Receiver antenna, scan channels and live Remote ID detections',
  'rx-hardware': 'Receiver board, radio module and GPIO mapping',
  'rx-memory': 'Storage for captures, detections and logs',
  'rx-security': 'Signing keys and trust settings for received broadcasts',
  'rx-console': 'Receiver console and diagnostic output',
  'rx-logging': 'Capture and export received Remote ID traffic',
  'firmware': 'Flash and update ESP32 firmware via WebSerial or OTA',
  'guide': 'Full technical guide: protocols, configuration, building, OTA, security, antenna, variants, regulations and contributing'
}

export const pageGroups: PageGroup[] = [
  {
    id: 'firmware',
    title: 'Firmware',
    icon: 'i-lucide-flame',
    kind: 'drone',
    items: [
      { id: 'firmware', to: '/firmware', group: 'firmware', label: 'Firmware', icon: 'i-lucide-flame', kind: 'drone', status: 'stable', requiresConnection: true, requiresESP: true, minLockLevel: 0, alwaysAvailable: true }
    ]
  },
  {
    id: 'docs',
    title: 'Guide',
    icon: 'i-lucide-book-open',
    kind: 'app',
    items: [
      { id: 'guide', to: '/guide', group: 'guide', label: 'Guide', icon: 'i-lucide-book-open', kind: 'app', status: 'stable', requiresConnection: false, requiresESP: false, minLockLevel: 0, alwaysAvailable: true }
    ]
  },
  {
    id: 'monitor',
    title: 'Monitor',
    icon: 'i-lucide-chart-column',
    kind: 'app',
    items: [
      { id: 'dashboard', to: '/dashboard', group: 'monitor', label: 'Dashboard', icon: 'i-lucide-map', kind: 'app', status: 'stable', requiresConnection: false, requiresESP: false, minLockLevel: 0, alwaysAvailable: true }
    ]
  },
  {
    id: 'device',
    title: 'OmniRID TX Configuration',
    icon: 'i-lucide-rocket',
    kind: 'drone',
    items: [
      { id: 'nation', to: '/tx/nation-standard-transmission', group: 'tx', label: 'Nation, Standard & Transmission', icon: 'i-lucide-globe', kind: 'drone', status: 'stable', requiresConnection: true, requiresESP: true, minLockLevel: 0 },
      { id: 'identity', to: '/tx/identity', group: 'tx', label: 'Identity', icon: 'i-lucide-user', kind: 'drone', status: 'stable', requiresConnection: true, requiresESP: true, minLockLevel: 0 },
      { id: 'flight-controller', to: '/tx/flight-controller', group: 'tx', label: 'Flight Controller', icon: 'i-lucide-plane', kind: 'drone', status: 'stable', requiresConnection: true, requiresESP: true, minLockLevel: 0 },
      { id: 'hardware', to: '/tx/hardware', group: 'tx', label: 'Hardware', icon: 'i-lucide-cpu', kind: 'drone', status: 'implemented', requiresConnection: true, requiresESP: true, minLockLevel: 0 },
      { id: 'memory', to: '/tx/memory', group: 'tx', label: 'Memory', icon: 'i-lucide-database', kind: 'drone', status: 'implemented', requiresConnection: true, requiresESP: true, minLockLevel: 0 },
      { id: 'security', to: '/tx/security', group: 'tx', label: 'Security', icon: 'i-lucide-shield-check', kind: 'drone', status: 'implemented', requiresConnection: true, requiresESP: true, minLockLevel: 0 },
      { id: 'console', to: '/tx/console', group: 'tx', label: 'Console', icon: 'i-lucide-terminal', kind: 'app', status: 'implemented', requiresConnection: true, requiresESP: false, minLockLevel: 0 },
      { id: 'presets', to: '/tx/presets', group: 'tx', label: 'Presets', icon: 'i-lucide-list', kind: 'app', status: 'implemented', requiresConnection: true, requiresESP: false, minLockLevel: 0 },
      { id: 'logging', to: '/tx/logging', group: 'tx', label: 'Logging', icon: 'i-lucide-file-text', kind: 'app', status: 'implemented', requiresConnection: false, requiresESP: false, minLockLevel: 0 }
    ]
  },
  {
    id: 'rx',
    title: 'OmniRID RX Configuration',
    icon: 'i-lucide-satellite-dish',
    kind: 'app',
    items: [
      { id: 'rx-receiver', to: '/rx/receiver', group: 'rx', label: 'Receiver', icon: 'i-lucide-radar', kind: 'app', status: 'planned', requiresConnection: false, requiresESP: false, minLockLevel: 0 },
      { id: 'rx-hardware', to: '/rx/hardware', group: 'rx', label: 'Hardware', icon: 'i-lucide-cpu', kind: 'app', status: 'planned', requiresConnection: false, requiresESP: false, minLockLevel: 0 },
      { id: 'rx-memory', to: '/rx/memory', group: 'rx', label: 'Memory', icon: 'i-lucide-database', kind: 'app', status: 'planned', requiresConnection: false, requiresESP: false, minLockLevel: 0 },
      { id: 'rx-security', to: '/rx/security', group: 'rx', label: 'Security', icon: 'i-lucide-shield-check', kind: 'app', status: 'planned', requiresConnection: false, requiresESP: false, minLockLevel: 0 },
      { id: 'rx-console', to: '/rx/console', group: 'rx', label: 'Console', icon: 'i-lucide-terminal', kind: 'app', status: 'planned', requiresConnection: false, requiresESP: false, minLockLevel: 0 },
      { id: 'rx-logging', to: '/rx/logging', group: 'rx', label: 'Logging', icon: 'i-lucide-file-text', kind: 'app', status: 'planned', requiresConnection: false, requiresESP: false, minLockLevel: 0 }
    ]
  }
]

export const allPages: PageConfig[] = pageGroups.flatMap(g => g.items)

export const pageForRoute = (to: string): PageConfig | undefined =>
  allPages.find(p => p.to === to)

export const groupForRoute = (to: string): PageGroup | undefined =>
  allPages.find(p => p.to === to) ? pageGroups.find(g => g.items.some(p => p.to === to)) : undefined
