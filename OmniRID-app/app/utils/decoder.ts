// OpenDroneID ASTM F3411-22a message decoder (pure, framework-agnostic)

export const ODID_MSG_BASIC_ID = 0x00
export const ODID_MSG_LOCATION = 0x01
export const ODID_MSG_AUTH = 0x02
export const ODID_MSG_SELF_ID = 0x03
export const ODID_MSG_SYSTEM = 0x04
export const ODID_MSG_OPERATOR_ID = 0x05
export const ODID_MSG_PACK = 0x0f

export const ID_TYPE_NAMES: Record<number, string> = {
  0: 'None', 1: 'Serial Number (ANSI/CTA-2063)', 2: 'CAA Registration',
  3: 'UTM UUID', 4: 'Session ID',
}

export const UA_TYPE_NAMES: Record<number, string> = {
  0: 'None / Not specified', 1: 'Aeroplane', 2: 'Helicopter', 3: 'Gyroplane',
  4: 'Hybrid Lift / Multirotor', 5: 'Ornithopter', 6: 'Fixed Wing',
  7: 'Rotorcraft', 8: 'VTOL', 15: 'Other',
}

export const STATUS_NAMES: Record<number, string> = {
  0: 'Undeclared', 1: 'On Ground', 2: 'Airborne', 3: 'Emergency', 4: 'System Failure',
}

export const DESC_TYPE_NAMES: Record<number, string> = {
  0: 'None', 1: 'Free Text', 2: 'Emergency', 3: 'Extended Status',
}

export const MSG_TYPE_NAMES: Record<number, string> = {
  [ODID_MSG_BASIC_ID]: 'Basic ID',
  [ODID_MSG_LOCATION]: 'Location/Vector',
  [ODID_MSG_SYSTEM]: 'System',
  [ODID_MSG_OPERATOR_ID]: 'Operator ID',
  [ODID_MSG_SELF_ID]: 'Self ID',
  [ODID_MSG_AUTH]: 'Authentication',
  [ODID_MSG_PACK]: 'Message Pack',
}

const _decoder = new TextDecoder('utf-8')

export function bytesToUtf8(bytes: Uint8Array): string {
  if (!bytes || !bytes.length) return ''
  let end = bytes.length
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) { end = i; break }
  }
  try { return _decoder.decode(bytes.subarray(0, end)) }
  catch { return '' }
}

export function toHex(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0')
  return s
}

function readLE(buf: Uint8Array, offset: number, n: number): number {
  let v = 0
  for (let i = 0; i < n; i++) v += (buf[offset + i] << (i * 8))
  return v >>> 0
}

function readIntLE(buf: Uint8Array, offset: number, n: number): number {
  let v = readLE(buf, offset, n)
  const sign = 1 << (n * 8 - 1)
  if (v & sign) v -= (1 << (n * 8))
  return v
}

function decodeBasicId(data: Uint8Array, offset = 0) {
  if (data.length - offset < 22) return {}
  const b1 = data[offset]
  return {
    id_type: (b1 >> 4) & 0x0f,
    ua_type: b1 & 0x0f,
    uas_id: bytesToUtf8(data.subarray(offset + 1, offset + 21)),
  }
}

function decodeLocation(data: Uint8Array, offset = 0) {
  if (data.length - offset < 24) return {}
  const b1 = data[offset]
  const status = b1 >> 4
  const ew = (b1 >> 1) & 1
  const speedMult = b1 & 1
  let direction = data[offset + 1]
  if (ew) direction += 180
  const speedH = data[offset + 2]
  const speedV = readIntLE(data, offset + 3, 1)
  const latRaw = readIntLE(data, offset + 4, 4)
  const lonRaw = readIntLE(data, offset + 8, 4)
  const altBaro = readLE(data, offset + 12, 2)
  const altGeo = readLE(data, offset + 14, 2)
  const heightRaw = readLE(data, offset + 16, 2)
  const tsRaw = readLE(data, offset + 20, 2)
  return {
    status,
    direction,
    speed_horizontal: speedMult === 0 ? speedH * 0.25 : 63.75 + speedH * 0.75,
    speed_vertical: speedV * 0.5,
    latitude: latRaw / 1e7,
    longitude: lonRaw / 1e7,
    altitude_pressure: altBaro * 0.5 - 1000,
    altitude_geodetic: altGeo * 0.5 - 1000,
    height: heightRaw * 0.5 - 1000,
    timestamp: tsRaw !== 0xffff ? tsRaw / 10 : -1,
  }
}

function decodeSystem(data: Uint8Array, offset = 0) {
  if (data.length - offset < 24) return {}
  const opLat = readIntLE(data, offset + 1, 4)
  const opLon = readIntLE(data, offset + 5, 4)
  const areaCount = readLE(data, offset + 9, 2)
  const areaRadius = data[offset + 11]
  const opAltGeo = readLE(data, offset + 17, 2)
  const tsRaw = readLE(data, offset + 19, 4)
  return {
    operator_latitude: opLat / 1e7,
    operator_longitude: opLon / 1e7,
    area_count: areaCount,
    area_radius: areaRadius * 10,
    operator_altitude_geodetic: opAltGeo * 0.5 - 1000,
    timestamp: tsRaw,
  }
}

function decodeOperatorId(data: Uint8Array, offset = 0) {
  if (data.length - offset < 21) return {}
  return { operator_id: bytesToUtf8(data.subarray(offset + 1, offset + 21)) }
}

function decodeSelfId(data: Uint8Array, offset = 0) {
  if (data.length - offset < 24) return {}
  return {
    desc_type: data[offset],
    description: bytesToUtf8(data.subarray(offset + 1, offset + 24)),
  }
}

function decodeAuth(data: Uint8Array, offset = 0) {
  if (data.length - offset < 24) return {}
  const b1 = data[offset]
  const authType = b1 >> 4
  const authPage = b1 & 0x0f
  return {
    auth_type: authType,
    auth_page: authPage,
    auth_data_hex: authPage === 0
      ? toHex(data.subarray(offset + 7, offset + 24))
      : toHex(data.subarray(offset + 1, offset + 24)),
  }
}

const DECODERS: Record<number, (d: Uint8Array, off: number) => any> = {
  [ODID_MSG_BASIC_ID]: decodeBasicId,
  [ODID_MSG_LOCATION]: decodeLocation,
  [ODID_MSG_SYSTEM]: decodeSystem,
  [ODID_MSG_OPERATOR_ID]: decodeOperatorId,
  [ODID_MSG_SELF_ID]: decodeSelfId,
  [ODID_MSG_AUTH]: decodeAuth,
}

export function decodeOdidMessage(data: Uint8Array): any {
  if (!data || data.length < 1) return { error: 'Too short' }
  const hdr = data[0]
  const msgType = hdr >> 4
  const protoVer = hdr & 0x0f
  const decoder = DECODERS[msgType]
  const decoded = decoder ? decoder(data, 1) : null
  const name = MSG_TYPE_NAMES[msgType] || `Unknown (0x${msgType.toString(16)})`
  const result: any = { message_type: msgType, protocol_version: protoVer, message_name: name }
  if (decoded && Object.keys(decoded).length > 0) {
    decoded.type = name
    result.decoded = decoded
  } else {
    result.raw_hex = toHex(data)
  }
  return result
}

function isValidMsgHeader(byteVal: number): boolean {
  const t = byteVal >> 4
  return t <= 5 || t === 0x0f
}

function looksLikePack(payload: Uint8Array, pos: number): boolean {
  if (pos + 3 > payload.length) return false
  return (payload[pos] >> 4) === 0x0f && (payload[pos] & 0x0f) <= 2 &&
    payload[pos + 1] === 25 && payload[pos + 2] >= 1 && payload[pos + 2] <= 9
}

export function decodeBeaconPayload(payload: Uint8Array): any[] {
  const results: any[] = []
  let offset = 0
  if (payload.length >= 4) {
    const hasPack0 = looksLikePack(payload, 0)
    const hasPack1 = looksLikePack(payload, 1)
    if (hasPack1 && !hasPack0) offset = 1
  }
  while (offset < payload.length) {
    const hdr = payload[offset]
    if (!isValidMsgHeader(hdr)) { offset++; continue }
    const msgType = hdr >> 4
    if (msgType === 0x0f) {
      if (offset + 3 > payload.length) break
      const singleSize = payload[offset + 1]
      const packSize = payload[offset + 2]
      if (packSize === 0 || singleSize < 20) { offset++; continue }
      const hdrLen = 3
      let totalBytes = packSize * singleSize
      if (offset + hdrLen + totalBytes > payload.length) {
        const tail = payload.length - offset - hdrLen
        const newPack = Math.floor(tail / singleSize)
        totalBytes = newPack * singleSize
      }
      for (let i = 0; i < packSize; i++) {
        const start = offset + hdrLen + i * singleSize
        const msgData = payload.subarray(start, start + singleSize)
        results.push(decodeOdidMessage(msgData))
        if (totalBytes === 0) break
      }
      offset += hdrLen + totalBytes
    } else if (msgType <= 5) {
      const msgSize = 25
      const msgData = payload.subarray(offset, Math.min(offset + msgSize, payload.length))
      results.push(decodeOdidMessage(msgData))
      offset += msgData.length
    } else {
      offset++
    }
  }
  return results
}

const ODID_WIFI_OUI = [0xfa, 0x0b, 0xbc]
const ODID_WIFI_OUI_WID = 0x0d

export function extractOdidFromBeacon(frameBody: Uint8Array): any[] {
  const results: any[] = []
  let offset = 0
  while (offset < frameBody.length) {
    if (offset + 2 > frameBody.length) break
    const elemId = frameBody[offset]
    const elemLen = frameBody[offset + 1]
    if (offset + 2 + elemLen > frameBody.length) break
    const elemData = frameBody.subarray(offset + 2, offset + 2 + elemLen)
    if (elemId === 0xdd && elemLen >= 5) {
      const oui = elemData.subarray(0, 3)
      const wid = elemData[3]
      if (oui[0] === ODID_WIFI_OUI[0] && oui[1] === ODID_WIFI_OUI[1] && oui[2] === ODID_WIFI_OUI[2] && wid === ODID_WIFI_OUI_WID) {
        results.push(...decodeBeaconPayload(elemData.subarray(4)))
      }
    }
    offset += 2 + elemLen
  }
  return results
}

export function formatSummary(decodedList: any[]): string {
  return decodedList.map((d) => {
    const dec = d.decoded || {}
    if (dec.uas_id) return `ID:${dec.uas_id}(${ID_TYPE_NAMES[dec.id_type] || '?'})`
    if (dec.latitude !== undefined) return `GPS:${dec.latitude.toFixed(5)},${dec.longitude.toFixed(5)}`
    if (dec.operator_latitude !== undefined) return `OpPos:${dec.operator_latitude.toFixed(4)},${dec.operator_longitude.toFixed(4)}`
    if (dec.operator_id) return `Op:${dec.operator_id}`
    if (dec.description) return `Desc:${dec.description.slice(0, 20)}`
    if (d.message_name === 'Message Pack') return 'Pack(msgs)'
    return d.message_name || '?'
  }).join(' | ')
}