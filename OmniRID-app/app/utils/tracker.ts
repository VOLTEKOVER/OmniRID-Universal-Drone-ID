// Device tracking state (pure, framework-agnostic — mirrored into a Pinia store)

export interface TrailPoint { lat: number; lon: number; ts: number }
export interface LocationData {
  latitude?: number; longitude?: number;
  altitude_pressure?: number; altitude_geodetic?: number;
  speed_horizontal?: number; speed_vertical?: number;
  direction?: number; status?: number; timestamp?: number
}

export interface DeviceSnapshot {
  mac: string
  basic_id: string
  operator_id: string
  ua_type: number
  ua_type_name: string
  packet_count: number
  rssi_avg: number | null
  rssi_last: number | null
  first_seen: number
  last_seen: number
  last_location: LocationData | null
  self_id: string
  messages_seen: string[]
  location_trail: TrailPoint[]
}

export class RIDDevice {
  mac: string
  firstSeen: number
  lastSeen: number
  rssiSamples: number[] = []
  basicId = ''
  operatorId = ''
  uaType = 0
  selfId = ''
  lastLocation: LocationData | null = null
  packetCount = 0
  messagesSeen = new Set<string>()
  locationTrail: TrailPoint[] = []

  constructor(mac: string, firstSeen: number) {
    this.mac = mac
    this.firstSeen = firstSeen
    this.lastSeen = firstSeen
  }

  get avgRssi(): number | null {
    if (!this.rssiSamples.length) return null
    return this.rssiSamples.reduce((a, b) => a + b, 0) / this.rssiSamples.length
  }

  toSnapshot(): DeviceSnapshot {
    return {
      mac: this.mac,
      basic_id: this.basicId,
      operator_id: this.operatorId,
      ua_type: this.uaType,
      ua_type_name: this.uaTypeName,
      packet_count: this.packetCount,
      rssi_avg: this.avgRssi != null ? Math.round(this.avgRssi * 10) / 10 : null,
      rssi_last: this.rssiSamples.length ? this.rssiSamples[this.rssiSamples.length - 1] : null,
      first_seen: this.firstSeen,
      last_seen: this.lastSeen,
      last_location: this.lastLocation,
      self_id: this.selfId,
      messages_seen: [...this.messagesSeen].sort(),
      location_trail: this.locationTrail.slice(-10),
    }
  }

  get uaTypeName(): string {
    const NAMES: Record<number, string> = {
      0: 'Unknown', 1: 'Aeroplane', 2: 'Helicopter', 3: 'Gyroplane',
      4: 'Multirotor', 5: 'Ornithopter', 6: 'Fixed Wing', 7: 'Rotorcraft', 8: 'VTOL', 15: 'Other',
    }
    return NAMES[this.uaType] || 'Unknown'
  }
}

export interface PacketRecord {
  ts: number
  mac: string
  rssi: number | null
  channel: number
  summary: string
  messages: any[]
}

export interface CaptureData {
  timestamp: number
  source_mac: string
  rssi: number | null
  channel: number
  summary: string
  messages: any[]
}

const UA_TYPE_NAMES: Record<number, string> = {
  0: 'None', 1: 'Aeroplane', 2: 'Helicopter', 3: 'Gyroplane', 4: 'Hybrid Lift / Multirotor',
  5: 'Ornithopter', 6: 'Fixed Wing', 7: 'Rotorcraft', 8: 'VTOL', 15: 'Other',
}

export class Tracker {
  private _devices = new Map<string, RIDDevice>()
  private _packetHistory: PacketRecord[] = []
  private _historyMax = 2000
  private _recording = false
  private _sessionPackets: PacketRecord[] = []
  private _sessionStart = 0

  get isRecording(): boolean { return this._recording }
  get totalDevices(): number { return this._devices.size }

  onCapture(data: CaptureData): PacketRecord {
    const mac = data.source_mac || '?'
    const ts = data.timestamp || Date.now() / 1000
    let dev = this._devices.get(mac)
    if (!dev) {
      dev = new RIDDevice(mac, ts)
      this._devices.set(mac, dev)
    }
    dev.lastSeen = ts
    dev.packetCount++
    if (data.rssi != null) {
      dev.rssiSamples.push(data.rssi)
      if (dev.rssiSamples.length > 500) dev.rssiSamples = dev.rssiSamples.slice(-500)
    }
    for (const msg of (data.messages || [])) {
      const dec = msg.decoded || {}
      const t = dec.type || msg.message_name || '?'
      dev.messagesSeen.add(t)
      if (t === 'Basic ID') {
        if (dec.uas_id) dev.basicId = dec.uas_id
        if (dec.ua_type != null) dev.uaType = dec.ua_type
      } else if (t === 'Operator ID') {
        if (dec.operator_id) dev.operatorId = dec.operator_id
      } else if (t === 'Location' || t === 'Location/Vector') {
        dev.lastLocation = dec
        if (dec.latitude != null && dec.longitude != null) {
          const entry: TrailPoint = { lat: dec.latitude, lon: dec.longitude, ts: Math.floor(ts) }
          const trail = dev.locationTrail
          if (!trail.length || trail[trail.length - 1].lat !== entry.lat || trail[trail.length - 1].lon !== entry.lon) {
            trail.push(entry)
            if (trail.length > 500) trail.splice(0, trail.length - 500)
          }
        }
      } else if (t === 'Self ID') {
        if (dec.description) dev.selfId = dec.description
      }
    }
    const clean: PacketRecord = { ts, mac, rssi: data.rssi, channel: data.channel || 0, summary: data.summary || '', messages: data.messages || [] }
    this._packetHistory.push(clean)
    if (this._packetHistory.length > this._historyMax) this._packetHistory.splice(0, this._packetHistory.length - this._historyMax)
    if (this._recording) this._sessionPackets.push(clean)
    return clean
  }

  getSnapshot(now = Date.now() / 1000) {
    const total = this._devices.size
    let active = 0
    const basicIds = new Set<string>()
    for (const d of this._devices.values()) {
      if (now - d.lastSeen < 30) active++
      if (d.basicId) basicIds.add(d.basicId)
    }
    const recent = this._packetHistory.filter(p => now - p.ts < 60).length
    return {
      devices: [...this._devices.values()].sort((a, b) => b.lastSeen - a.lastSeen).map(d => d.toSnapshot()),
      stats: {
        total_devices: total,
        active_devices: active,
        unique_ids: basicIds.size,
        packets_last_60s: recent,
        total_packets: this._packetHistory.length,
        recording: this._recording,
        session_packets: this._sessionPackets.length,
      },
    }
  }

  getPacketHistory(): PacketRecord[] { return this._packetHistory }

  getDeviceDetail(mac: string): ReturnType<RIDDevice['toSnapshot']> | null {
    const dev = this._devices.get(mac)
    return dev ? dev.toSnapshot() : null
  }

  startRecording() {
    this._sessionPackets = []
    this._recording = true
    this._sessionStart = Date.now() / 1000
  }

  stopRecording() {
    this._recording = false
  }

  reset() {
    this._devices.clear()
    this._packetHistory = []
    this._sessionPackets = []
    this._recording = false
    this._sessionStart = 0
  }

  generateCSV(): string {
    const lines = ['MAC,Basic ID,UA Type,Operator ID,Latitude,Longitude,RSSI Avg,RSSI Last,First Seen,Last Seen,Packet Count,Self ID']
    for (const d of this._devices.values()) {
      const lat = d.lastLocation?.latitude ?? ''
      const lon = d.lastLocation?.longitude ?? ''
      const first = new Date(d.firstSeen * 1000).toISOString().replace('T', ' ').slice(0, 19)
      const last = new Date(d.lastSeen * 1000).toISOString().replace('T', ' ').slice(0, 19)
      lines.push([
        d.mac, d.basicId, UA_TYPE_NAMES[d.uaType] || d.uaType, d.operatorId, lat, lon,
        d.avgRssi != null ? Math.round(d.avgRssi * 10) / 10 : '',
        d.rssiSamples.length ? d.rssiSamples[d.rssiSamples.length - 1] : '',
        first, last, d.packetCount, d.selfId,
      ].join(','))
    }
    return lines.join('\n')
  }

  generateKML(): string {
    let kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document><name>OmniRID App - Drone Report</name>`
    for (const d of this._devices.values()) {
      const name = d.basicId || d.mac
      kml += `<Placemark><name>${name}</name>`
      kml += `<description>MAC: ${d.mac}\\nOperator: ${d.operatorId}\\nType: ${UA_TYPE_NAMES[d.uaType] || d.uaType}\\nPackets: ${d.packetCount}</description>`
      if (d.locationTrail.length >= 2) {
        kml += '<LineString><extrude>1</extrude><tessellate>1</tessellate><coordinates>'
        for (const pt of d.locationTrail) kml += `${pt.lon},${pt.lat},${pt.ts} `
        kml += '</coordinates></LineString>'
      }
      if (d.lastLocation) kml += `<Point><coordinates>${d.lastLocation.longitude},${d.lastLocation.latitude},0</coordinates></Point>`
      kml += '</Placemark>'
    }
    kml += '</Document></kml>'
    return kml
  }
}