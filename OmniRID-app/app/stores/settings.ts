import { defineStore } from 'pinia'

export interface ProtocolState {
  enabled: boolean
  label: string
  description: string
  icon: string
}

export const PROTOCOLS: Record<string, ProtocolState> = {
  mavlink: {
    enabled: true,
    label: 'MAVLink',
    description: 'Micro Air Vehicle Link — telemetria Flight Controller',
    icon: 'i-tabler-robot',
  },
  dronecan: {
    enabled: false,
    label: 'DroneCAN',
    description: 'CAN bus per UAV (es. autopiloti ArduPilot)',
    icon: 'i-tabler-cpu',
  },
  msp: {
    enabled: false,
    label: 'MSP',
    description: 'MultiWii Serial Protocol — Betaflight/INAV',
    icon: 'i-tabler-circuit-board',
  },
  nmea: {
    enabled: true,
    label: 'NMEA',
    description: 'NMEA 0183 — ricezione GPS esterna',
    icon: 'i-tabler-map-2',
  },
}

interface SettingsState {
  protocols: Record<string, ProtocolState>
  serialBaud: number
  serialPort: string | null
  availablePorts: string[]
  simulationMode: boolean
  theme: 'light' | 'dark' | 'system'
  safetyChecklist: Record<string, boolean>
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({
    protocols: JSON.parse(JSON.stringify(PROTOCOLS)),
    serialBaud: 115200,
    serialPort: null,
    availablePorts: ['COM1', 'COM2', 'COM3', 'COM4', 'COM5', '/dev/ttyACM0', '/dev/ttyACM1', '/dev/ttyUSB0'],
    simulationMode: false,
    theme: 'light',
    safetyChecklist: {
      battery: true,
      gpsFix: false,
      props: true,
      armReady: false,
      airspace: true,
    },
  }),

  actions: {
    toggleProtocol(key: keyof typeof PROTOCOLS) {
      if (this.protocols[key]) this.protocols[key].enabled = !this.protocols[key].enabled
    },

    setProtocol(key: keyof typeof PROTOCOLS, v: boolean) {
      if (this.protocols[key]) this.protocols[key].enabled = v
    },

    setSerialPort(port: string | null) {
      this.serialPort = port
    },

    setSerialBaud(baud: number) {
      this.serialBaud = baud
    },

    refreshPorts() {
      // Web Serial exposes a fixed port list via getPorts(); extra common ones kept for UX.
      if (typeof navigator !== 'undefined' && navigator.serial) {
        navigator.serial.getPorts?.().then(() => {}).catch(() => {})
      }
    },

    toggleSafety(item: keyof SettingsState['safetyChecklist']) {
      this.safetyChecklist[item] = !this.safetyChecklist[item]
    },

    get safetyReady(): boolean {
      return Object.values(this.safetyChecklist).every(Boolean)
    },

    reset() {
      this.protocols = JSON.parse(JSON.stringify(PROTOCOLS))
      this.serialBaud = 115200
      this.serialPort = null
      this.simulationMode = false
      this.theme = 'light'
    },
  },
})