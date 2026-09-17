import { defineStore } from 'pinia'
import { Tracker, type CaptureData, type PacketRecord, type DeviceSnapshot } from '~/utils/tracker'

interface TelemetryState {
  tracker: Tracker
  devices: DeviceSnapshot[]
  packets: PacketRecord[]
  stats: {
    total_devices: number
    active_devices: number
    unique_ids: number
    packets_last_60s: number
    total_packets: number
    recording: boolean
    session_packets: number
  }
  // capture source state
  bleActive: boolean
  serialActive: boolean
  pcapFilename: string | null
  error: string | null
}

/**
 * Central telemetry store. Captured packets hit `addCapture` at high frequency;
 * Vue reactivity reads from the snapshot arrays (throttled via ref on rAF in UI).
 */
export const useTelemetryStore = defineStore('telemetry', {
  state: (): TelemetryState => ({
    tracker: new Tracker(),
    devices: [],
    packets: [],
    stats: {
      total_devices: 0, active_devices: 0, unique_ids: 0,
      packets_last_60s: 0, total_packets: 0, recording: false, session_packets: 0,
    },
    bleActive: false,
    serialActive: false,
    pcapFilename: null,
    error: null,
  }),

  getters: {
    packetRate(state): number {
      const now = Date.now() / 1000
      const recent = state.packets.filter(p => now - p.ts <= 2).length
      return recent / 2
    },
    totalPackets(state): number {
      return state.stats.total_packets
    },
    activeDrones(state): number {
      return state.stats.active_devices
    },
    avgRssi(state): number {
      const last = state.packets.filter(p => p.rssi != null).slice(-20)
      if (!last.length) return 0
      return Math.round(last.reduce((a, p) => a + (p.rssi as number), 0) / last.length)
    },
  },

  actions: {
    /** Ingest a decoded capture batch (from BLE, serial or PCAP). */
    addCapture(data: CaptureData) {
      const clean = this.tracker.onCapture(data)
      this.packets.push(clean)
      if (this.packets.length > 2500) this.packets.splice(0, this.packets.length - 2500)
      this.devices = this.tracker.getSnapshot().devices
      this.stats = this.tracker.getSnapshot().stats
    },

    refreshStats() {
      const snap = this.tracker.getSnapshot()
      this.devices = snap.devices
      this.stats = snap.stats
    },

    startRecording() {
      this.tracker.startRecording()
      this.refreshStats()
    },

    stopRecording() {
      this.tracker.stopRecording()
      this.refreshStats()
    },

    reset() {
      this.tracker.reset()
      this.packets = []
      this.bleActive = false
      this.serialActive = false
      this.pcapFilename = null
      this.refreshStats()
    },

    setError(msg: string | null) { this.error = msg },

    // ---- capture wiring (delegates to utils classes) ----
    setBleActive(v: boolean) { this.bleActive = v },
    setSerialActive(v: boolean) { this.serialActive = v },
    setPcapFilename(name: string | null) { this.pcapFilename = name },
  },
})