import { useTelemetryStore } from '~/stores/telemetry'
import { decodeOdidMessage } from '~/utils/decoder'

let timer: ReturnType<typeof setInterval> | null = null

/**
 * Simulation source. `opts` must expose a reactive `simulationMode` flag
 * (a Pinia store or a ref works).
 */

function simulateSinglePacket() {
  const store = useTelemetryStore()
  const now = Date.now() / 1000

  // deterministic pseudo-random drone (4 fixed MACs around Rome center)
  const drones = [
    { mac: '02:0f:12:00:aa:01', base: { lat: 41.9028, lon: 12.4964 }, id: 'SER-0001', op: 'OP-ROMA-01' },
    { mac: '02:0f:12:00:aa:02', base: { lat: 41.8931, lon: 12.4832 }, id: 'SER-0002', op: 'OP-ROMA-02' },
    { mac: '02:0f:12:00:aa:03', base: { lat: 41.9115, lon: 12.4964 }, id: 'SER-0003', op: 'OP-ROMA-03' },
    { mac: '02:0f:12:00:aa:04', base: { lat: 41.8859, lon: 12.5100 }, id: 'SER-0004', op: 'OP-ROMA-04' },
  ]
  const d = drones[Math.floor(Math.random() * drones.length)]
  const drift = (() => (Math.random() - 0.5) * 0.004)()
  const alt = 80 + Math.random() * 40

  const messages: any[] = [
    decodeOdidMessage(encodeBasicId(d)),
    decodeOdidMessage(encodeLocation(d, drift, alt)),
    decodeOdidMessage(encodeSystem(d)),
    decodeOdidMessage(encodeOperator(d)),
  ]

  const clean = store.tracker.onCapture({
    timestamp: now,
    source_mac: d.mac,
    rssi: -55 - Math.random() * 30,
    channel: 6,
    summary: messages.map(m => (m.decoded?.type || '')).filter(Boolean).join(' | '),
    messages,
  })
  store.packets.push(clean)
  if (store.packets.length > 2500) store.packets.splice(0, store.packets.length - 2500)
  store.refreshStats()
}

// Build an ASTM F3411-22a Basic ID message payload
function encodeBasicId(d: { id: string }): Uint8Array {
  const b = new Uint8Array(25)
  b[0] = (0x00 << 4) | 1 // msg BasicID, protoVer 1
  b[1] = (1 << 4) | 4 // id_type Serial, ua_type Multirotor
  const id = (d.id + '                    ').slice(0, 20)
  for (let i = 0; i < id.length; i++) b[2 + i] = id.charCodeAt(i)
  return b
}

function encodeLocation(d: { base: { lat: number; lon: number } }, drift: number, alt: number): Uint8Array {
  const b = new Uint8Array(25)
  b[0] = (0x01 << 4) | 1 // msg Location, protoVer 1
  b[1] = (2 << 4) | (1 << 1) | 0 // status Airborne, EW=1, speedMult=0
  b[2] = 45 // direction NE
  b[3] = 0 // speed v
  b[4] = (0 << 4) | 0
  b[5] = 0
  b[6] = 0
  b[7] = 0
  b[8] = 0
  b[9] = 0
  b[10] = 0
  b[11] = 0
  // lat E7 little endian
  const lat = Math.round((d.base.lat + drift) * 1e7)
  const lon = Math.round((d.base.lon + drift) * 1e7)
  b[4] = lat & 0xff; b[5] = (lat >> 8) & 0xff; b[6] = (lat >> 16) & 0xff; b[7] = (lat >> 24) & 0xff
  b[8] = lon & 0xff; b[9] = (lon >> 8) & 0xff; b[10] = (lon >> 16) & 0xff; b[11] = (lon >> 24) & 0xff
  const altG = Math.round((alt + 1000) / 0.5)
  b[12] = altG & 0xff; b[13] = (altG >> 8) & 0xff
  b[14] = altG & 0xff; b[15] = (altG >> 8) & 0xff
  const ts = Math.round((Date.now() / 1000) % 100000 * 10)
  b[20] = ts & 0xff; b[21] = (ts >> 8) & 0xff
  return b
}

function encodeSystem(d: { base: { lat: number; lon: number } }): Uint8Array {
  const b = new Uint8Array(25)
  b[0] = (0x04 << 4) | 1 // msg System, protoVer 1
  const opLat = Math.round((d.base.lat + 0.01) * 1e7)
  const opLon = Math.round((d.base.lon + 0.01) * 1e7)
  b[1] = opLat & 0xff; b[2] = (opLat >> 8) & 0xff; b[3] = (opLat >> 16) & 0xff; b[4] = (opLat >> 24) & 0xff
  b[5] = opLon & 0xff; b[6] = (opLon >> 8) & 0xff; b[7] = (opLon >> 16) & 0xff; b[8] = (opLon >> 24) & 0xff
  b[17] = 100; b[19] = 0
  return b
}

function encodeOperator(d: { op: string }): Uint8Array {
  const b = new Uint8Array(25)
  b[0] = (0x05 << 4) | 1 // msg OperatorID, protoVer 1
  b[1] = 0 // operator type CAA
  const op = (d.op + '                    ').slice(0, 19)
  for (let i = 0; i < op.length; i++) b[2 + i] = op.charCodeAt(i)
  return b
}

export function useSimulation(opts: { simulationMode: boolean }) {
  return {
    running: computed(() => !!timer),
    toggle() {
      if (timer) {
        clearInterval(timer)
        timer = null
        return
      }
      function tick() {
        if (!opts.simulationMode) { clearInterval(timer!); timer = null; return }
        simulateSinglePacket()
      }
      tick()
      timer = setInterval(tick, 800)
    },
  }
}