// Capture backends (pure logic; Web Bluetooth / Web Serial / PCAP import).
// The classes call `onCapture` callbacks; UI wiring is done in stores/composables.

import { extractOdidFromBeacon, decodeOdidMessage, formatSummary } from './decoder'

export const ODID_SERVICE_UUID = '0000fffb-0000-1000-8000-00805f9b34fb'

export function bytesToHex(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += b.toString(16).padStart(2, '0')
  return s
}

export type CaptureCallback = (data: import('./tracker').CaptureData) => void

export class BLECapture {
  private _running = false
  private _onPacket: CaptureCallback | null = null
  private _scan: any = null
  private _abort: AbortController | null = null

  get available(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.bluetooth &&
      typeof navigator.bluetooth.requestLEScan === 'function'
  }

  get running(): boolean { return this._running }

  set onPacket(cb: CaptureCallback | null) { this._onPacket = cb }

  async start(): Promise<boolean> {
    if (!this.available || this._running) return false
    try {
      const abortController = new AbortController()
      const scan = await navigator.bluetooth.requestLEScan({ acceptAllAdvertisements: true })
      navigator.bluetooth.addEventListener('advertisementreceived', (event: Event) => {
        if (!this._onPacket) return
        const evt = event as any
        const adv = evt.adv || evt
        const mfg: Map<any, DataView> | undefined = adv.manufacturerData
        if (!mfg || (typeof mfg.size === 'number' ? mfg.size === 0 : Object.keys(mfg).length === 0)) return
        const msgs: any[] = []
        for (const [, dataView] of mfg instanceof Map ? mfg.entries() : Object.entries(mfg)) {
          const dv = dataView as DataView
          const bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength)
          const decoded = decodeOdidMessage(bytes)
          if (decoded.message_name && decoded.message_name.startsWith('Unknown')) continue
          msgs.push(decoded)
        }
        if (!msgs.length) return
        this._onPacket({
          timestamp: Date.now() / 1000,
          source_mac: evt.device?.id || 'ble',
          rssi: adv.rssi ?? null,
          channel: 0,
          summary: formatSummary(msgs),
          messages: msgs,
        })
      }, { signal: abortController.signal })
      this._scan = scan
      this._abort = abortController
      this._running = true
      return true
    } catch (e) {
      console.warn('BLE scan failed', e)
      return false
    }
  }

  stop() {
    if (this._scan) { try { this._scan.stop() } catch {} }
    if (this._abort) { try { this._abort.abort() } catch {} }
    this._running = false
  }
}

export class SerialCapture {
  private _port: any = null
  private _reader: any = null
  private _onPacket: CaptureCallback | null = null
  private _buffer = ''
  private _running = false

  get available(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.serial
  }

  get running(): boolean { return this._running }

  set onPacket(cb: CaptureCallback | null) { this._onPacket = cb }

  async start(baud = 115200): Promise<boolean> {
    if (!this.available || this._running) return false
    try {
      this._port = await navigator.serial!.requestPort()
      await this._port.open({ baudRate: baud })
      this._running = true
      this._readLoop()
      return true
    } catch (e) {
      console.warn('Serial open failed', e)
      return false
    }
  }

  async _readLoop() {
    const decoder = new TextDecoder()
    while (this._port && this._running) {
      try {
        this._reader = this._port.readable.getReader()
        for (;;) {
          const { value, done } = await this._reader.read()
          if (done) break
          this._processSerial(decoder.decode(value, { stream: true }))
        }
      } catch {
        if (this._running) await new Promise(r => setTimeout(r, 200))
        break
      } finally {
        if (this._reader) { try { this._reader.releaseLock() } catch {} this._reader = null }
      }
    }
  }

  stop() {
    this._running = false
    if (this._reader) { try { this._reader.cancel() } catch {} this._reader = null }
    if (this._port) { try { this._port.close() } catch {} this._port = null }
  }

  private _processSerial(text: string) {
    if (!this._onPacket) return
    this._buffer += text
    const lines = this._buffer.split('\n')
    this._buffer = lines.pop() as string
    for (const line of lines) {
      try {
        const obj = JSON.parse(line.trim())
        if (obj.messages || obj.source_mac) {
          this._onPacket({
            timestamp: obj.timestamp || Date.now() / 1000,
            source_mac: obj.source_mac || 'serial',
            rssi: obj.rssi ?? null,
            channel: 0,
            summary: obj.summary || '',
            messages: obj.messages || [],
          })
        }
      } catch {}
    }
  }
}

export async function importPcapFile(file: File): Promise<import('./tracker').CaptureData[]> {
  const buf = await file.arrayBuffer()
  const u8 = new Uint8Array(buf)
  const results: import('./tracker').CaptureData[] = []
  if (u8.length < 24) return results
  const readU32 = (off: number, le = true) => le
    ? ((u8[off] | (u8[off + 1] << 8) | (u8[off + 2] << 16) | (u8[off + 3] << 24)) >>> 0)
    : 0
  const magic = readU32(0, true)
  if (magic !== 0xa1b2c3d4 && magic !== 0xd4c3b2a1) return results
  const isSwapped = magic === 0xd4c3b2a1
  const readU16 = (off: number) => isSwapped
    ? ((u8[off + 1] | (u8[off] << 8)) & 0xffff)
    : ((u8[off] | (u8[off + 1] << 8)) & 0xffff)
  const read32 = (off: number) => isSwapped
    ? (((u8[off + 3] | (u8[off + 2] << 8) | (u8[off + 1] << 16) | (u8[off] << 24))) >>> 0)
    : readU32(off, true)
  const linkType = read32(20)
  let p = 24
  let idx = 0
  while (p + 16 <= u8.length) {
    const inclLen = read32(p + 8)
    if (inclLen === 0 || inclLen > 65535) break
    const frameStart = p + 16
    if (frameStart + inclLen > u8.length) break
    let body = u8.subarray(frameStart, frameStart + inclLen)
    if (linkType === 127 && body.length > 2) {
      const radiotapLen = ((body[2] | (body[3] << 8)) & 0xffff)
      if (radiotapLen > 0 && radiotapLen <= body.length) body = body.subarray(radiotapLen)
    }
    const msgs = extractOdidFromBeacon(body)
    if (msgs && msgs.length) {
      results.push({
        timestamp: read32(p) || 0,
        source_mac: body.length > 16
          ? body.slice(10, 16).reduce((s, b) => s + b.toString(16).padStart(2, '0') + ':', '').slice(0, -1)
          : `pcap#${idx}`,
        rssi: null,
        channel: 0,
        summary: formatSummary(msgs),
        messages: msgs,
      })
    }
    p = frameStart + inclLen
    idx++
  }
  return results
}

export function createCaptureTypes() {
  return { BLECapture, SerialCapture }
}