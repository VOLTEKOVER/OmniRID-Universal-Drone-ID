'use strict';

const { extractOdidFromBeacon, decodeOdidMessage, formatSummary } = window.RIDDecoder;

const ODID_SERVICE_UUID = '0000fffb-0000-1000-8000-00805f9b34fb';

function bytesToHex(bytes) {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

class BLECapture {
  constructor() {
    this._running = false;
    this._onPacket = null;
    this._abort = null;
  }

  get available() {
    return typeof navigator !== 'undefined' && !!navigator.bluetooth &&
      typeof navigator.bluetooth.requestLEScan === 'function';
  }

  set onPacket(cb) { this._onPacket = cb; }

  async start() {
    if (!this.available || this._running) return false;
    try {
      const abortController = new AbortController();
      const scan = await navigator.bluetooth.requestLEScan({ acceptAllAdvertisements: true });
      navigator.bluetooth.addEventListener('advertisementreceived', (event) => {
        if (!this._onPacket) return;
        const adv = event.adv || event;
        const mfg = adv.manufacturerData;
        if (!mfg || mfg.size === 0) return;
        let msgs = [];
        for (const [companyId, dataView] of mfg) {
          const bytes = new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength);
          const decoded = decodeOdidMessage(bytes);
          if (decoded.message_name && decoded.message_name.startsWith('Unknown')) continue;
          msgs.push(decoded);
        }
        if (!msgs.length) return;
        this._onPacket({
          timestamp: Date.now() / 1000,
          source_mac: event.device?.id || 'ble',
          rssi: adv.rssi ?? null,
          channel: 0,
          summary: formatSummary(msgs),
          messages: msgs,
        });
      }, { signal: abortController.signal });
      this._scan = scan;
      this._abort = abortController;
      this._running = true;
      return true;
    } catch (e) {
      console.warn('BLE scan failed', e);
      return false;
    }
  }

  stop() {
    if (this._scan) { try { this._scan.stop(); } catch (_) {} }
    if (this._abort) { try { this._abort.abort(); } catch (_) {} }
    this._running = false;
  }
}

class SerialCapture {
  constructor() {
    this._port = null;
    this._reader = null;
    this._onPacket = null;
    this._buffer = '';
    this._running = false;
  }

  get available() {
    return typeof navigator !== 'undefined' && !!navigator.serial;
  }

  set onPacket(cb) { this._onPacket = cb; }

  async start(baud = 115200) {
    if (!this.available || this._running) return false;
    try {
      this._port = await navigator.serial.requestPort();
      await this._port.open({ baudRate: baud });
      this._running = true;
      this._readLoop();
      return true;
    } catch (e) {
      console.warn('Serial open failed', e);
      return false;
    }
  }

  async _readLoop() {
    const decoder = new TextDecoder();
    while (this._port && this._running) {
      try {
        this._reader = this._port.readable.getReader();
        while (true) {
          const { value, done } = await this._reader.read();
          if (done) break;
          this._processSerial(decoder.decode(value, { stream: true }));
        }
      } catch (e) {
        if (this._running) { /* backoff on transient errors */ await new Promise(r => setTimeout(r, 200)); }
        break;
      } finally {
        if (this._reader) { try { this._reader.releaseLock(); } catch (_) {} this._reader = null; }
      }
    }
  }

  stop() {
    this._running = false;
    if (this._reader) { try { this._reader.cancel(); } catch (_) {} this._reader = null; }
    if (this._port) { try { this._port.close(); } catch (_) {} this._port = null; }
  }

  _processSerial(text) {
    if (!this._onPacket) return;
    this._buffer += text;
    const lines = this._buffer.split('\n');
    this._buffer = lines.pop();
    for (const line of lines) {
      try {
        const obj = JSON.parse(line.trim());
        if (obj.messages || obj.source_mac) {
          this._onPacket({
            timestamp: obj.timestamp || Date.now() / 1000,
            source_mac: obj.source_mac || 'serial',
            rssi: obj.rssi || null,
            channel: 0,
            summary: obj.summary || '',
            messages: obj.messages || [],
          });
        }
      } catch (_) {}
    }
  }
}

async function importPcapFile(file) {
  const buf = await file.arrayBuffer();
  const u8 = new Uint8Array(buf);
  const results = [];
  let p = 0;
  const readU32 = (off, le = true) => le ? ((u8[off] | (u8[off + 1] << 8) | (u8[off + 2] << 16) | (u8[off + 3] << 24)) >>> 0) : 0;
  if (u8.length < 24) return results;
  const magic = readU32(0, true);
  if (magic !== 0xa1b2c3d4 && magic !== 0xd4c3b2a1) return results;
  const isSwapped = magic === 0xd4c3b2a1;
  const readU16 = (off) => isSwapped ? ((u8[off + 1] | (u8[off] << 8)) & 0xffff) : ((u8[off] | (u8[off + 1] << 8)) & 0xffff);
  const read32 = (off) => isSwapped
    ? (((u8[off + 3] | (u8[off + 2] << 8) | (u8[off + 1] << 16) | (u8[off] << 24))) >>> 0)
    : readU32(off, true);
  const linkType = read32(20);
  p = 24;
  let idx = 0;
  while (p + 16 <= u8.length) {
    const tsSec = read32(p);
    const inclLen = read32(p + 8);
    if (inclLen === 0 || inclLen > 65535) break;
    const frameStart = p + 16;
    if (frameStart + inclLen > u8.length) break;
    let body = u8.subarray(frameStart, frameStart + inclLen);
    if (linkType === 127 && body.length > 2) {
      const radiotapLen = readU16 ? ((body[2] | (body[3] << 8)) & 0xffff) : 0;
      if (radiotapLen > 0 && radiotapLen <= body.length) body = body.subarray(radiotapLen);
    }
    const msgs = extractOdidFromBeacon(body);
    if (msgs && msgs.length) {
      results.push({
        timestamp: tsSec,
        source_mac: body.length > 16 ? body.slice(10, 16).reduce((s, b) => s + b.toString(16).padStart(2, '0') + ':', '').slice(0, -1) : `pcap#${idx}`,
        rssi: null,
        channel: 0,
        summary: formatSummary(msgs),
        messages: msgs,
        pcapanalysis: true,
      });
    }
    p = frameStart + inclLen;
    idx++;
  }
  return results;
}

window.RIDCapture = { BLECapture, SerialCapture, importPcapFile, ODID_SERVICE_UUID, bytesToHex };