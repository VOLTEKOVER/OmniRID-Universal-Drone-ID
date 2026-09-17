'use strict';

const ODID_MSG_BASIC_ID = 0x00;
const ODID_MSG_LOCATION = 0x01;
const ODID_MSG_AUTH = 0x02;
const ODID_MSG_SELF_ID = 0x03;
const ODID_MSG_SYSTEM = 0x04;
const ODID_MSG_OPERATOR_ID = 0x05;
const ODID_MSG_PACK = 0x0F;

const ID_TYPE_NAMES = {
  0: 'None', 1: 'Serial Number (ANSI/CTA-2063)', 2: 'CAA Registration',
  3: 'UTM UUID', 4: 'Session ID',
};

const UA_TYPE_NAMES = {
  0: 'None / Not specified', 1: 'Aeroplane', 2: 'Helicopter',
  3: 'Gyroplane', 4: 'Hybrid Lift / Multirotor', 5: 'Ornithopter',
  6: 'Fixed Wing', 7: 'Rotorcraft', 8: 'VTOL', 15: 'Other',
};

const STATUS_NAMES = {
  0: 'Undeclared', 1: 'On Ground', 2: 'Airborne',
  3: 'Emergency', 4: 'System Failure',
};

const DESC_TYPE_NAMES = { 0: 'None', 1: 'Free Text', 2: 'Emergency', 3: 'Extended Status' };

const MSG_TYPE_NAMES = {
  [ODID_MSG_BASIC_ID]: 'Basic ID', [ODID_MSG_LOCATION]: 'Location/Vector',
  [ODID_MSG_SYSTEM]: 'System', [ODID_MSG_OPERATOR_ID]: 'Operator ID',
  [ODID_MSG_SELF_ID]: 'Self ID', [ODID_MSG_AUTH]: 'Authentication',
  [ODID_MSG_PACK]: 'Message Pack',
};

const _decoder = new TextDecoder('utf-8');

function bytesToUtf8(bytes) {
  if (!bytes || !bytes.length) return '';
  let end = bytes.length;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) { end = i; break; }
  }
  try { return _decoder.decode(bytes.subarray(0, end)); }
  catch (_) { return ''; }
}

function toHex(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}

function readLE(buf, offset, bytes) {
  let v = 0;
  for (let i = 0; i < bytes; i++) v += (buf[offset + i] << (i * 8));
  return v >>> 0;
}

function readIntLE(buf, offset, bytes) {
  let v = readLE(buf, offset, bytes);
  const sign = 1 << (bytes * 8 - 1);
  if (v & sign) v -= (1 << (bytes * 8));
  return v;
}

function decodeBasicId(data, offset = 0) {
  const msg = {};
  if (data.length - offset < 22) return msg;
  const b1 = data[offset];
  msg.id_type = (b1 >> 4) & 0x0F;
  msg.ua_type = b1 & 0x0F;
  msg.uas_id = bytesToUtf8(data.subarray(offset + 1, offset + 21));
  return msg;
}

function decodeLocation(data, offset = 0) {
  const msg = {};
  if (data.length - offset < 24) return msg;
  const b1 = data[offset];
  msg.status = b1 >> 4;
  const ew = (b1 >> 1) & 1;
  const speedMult = b1 & 1;
  let dir = data[offset + 1];
  if (ew) dir += 180;
  msg.direction = dir;
  const speedH = data[offset + 2];
  const speedV = readIntLE(data, offset + 3, 1);
  const latRaw = readIntLE(data, offset + 4, 4);
  const lonRaw = readIntLE(data, offset + 8, 4);
  const altBaro = readLE(data, offset + 12, 2);
  const altGeo = readLE(data, offset + 14, 2);
  const heightRaw = readLE(data, offset + 16, 2);
  const tsRaw = readLE(data, offset + 20, 2);
  msg.speed_horizontal = speedMult === 0 ? speedH * 0.25 : 63.75 + speedH * 0.75;
  msg.speed_vertical = speedV * 0.5;
  msg.latitude = latRaw / 1e7;
  msg.longitude = lonRaw / 1e7;
  msg.altitude_pressure = altBaro * 0.5 - 1000;
  msg.altitude_geodetic = altGeo * 0.5 - 1000;
  msg.height = heightRaw * 0.5 - 1000;
  msg.timestamp = tsRaw !== 0xFFFF ? tsRaw / 10 : -1;
  return msg;
}

function decodeSystem(data, offset = 0) {
  const msg = {};
  if (data.length - offset < 24) return msg;
  const opLat = readIntLE(data, offset + 1, 4);
  const opLon = readIntLE(data, offset + 5, 4);
  const areaCount = readLE(data, offset + 9, 2);
  const areaRadius = data[offset + 11];
  const opAltGeo = readLE(data, offset + 17, 2);
  const tsRaw = readLE(data, offset + 19, 4);
  msg.operator_latitude = opLat / 1e7;
  msg.operator_longitude = opLon / 1e7;
  msg.area_count = areaCount;
  msg.area_radius = areaRadius * 10;
  msg.operator_altitude_geodetic = opAltGeo * 0.5 - 1000;
  msg.timestamp = tsRaw;
  return msg;
}

function decodeOperatorId(data, offset = 0) {
  const msg = {};
  if (data.length - offset < 21) return msg;
  msg.operator_id = bytesToUtf8(data.subarray(offset + 1, offset + 21));
  return msg;
}

function decodeSelfId(data, offset = 0) {
  const msg = {};
  if (data.length - offset < 24) return msg;
  msg.desc_type = data[offset];
  msg.description = bytesToUtf8(data.subarray(offset + 1, offset + 24));
  return msg;
}

function decodeAuth(data, offset = 0) {
  const msg = {};
  if (data.length - offset < 24) return msg;
  const b1 = data[offset];
  msg.auth_type = b1 >> 4;
  msg.auth_page = b1 & 0x0F;
  if (msg.auth_page === 0) {
    msg.auth_data_hex = toHex(data.subarray(offset + 7, offset + 24));
  } else {
    msg.auth_data_hex = toHex(data.subarray(offset + 1, offset + 24));
  }
  return msg;
}

const DECODERS = {
  [ODID_MSG_BASIC_ID]: decodeBasicId,
  [ODID_MSG_LOCATION]: decodeLocation,
  [ODID_MSG_SYSTEM]: decodeSystem,
  [ODID_MSG_OPERATOR_ID]: decodeOperatorId,
  [ODID_MSG_SELF_ID]: decodeSelfId,
  [ODID_MSG_AUTH]: decodeAuth,
};

function decodeOdidMessage(data) {
  if (!data || data.length < 1) return { error: 'Too short' };
  const hdr = data[0];
  const msgType = hdr >> 4;
  const protoVer = hdr & 0x0F;
  const decoder = DECODERS[msgType];
  const decoded = decoder ? decoder(data, 1) : null;
  const name = MSG_TYPE_NAMES[msgType] || `Unknown (0x${msgType.toString(16)})`;
  const result = { message_type: msgType, protocol_version: protoVer, message_name: name };
  if (decoded && Object.keys(decoded).length > 0) {
    decoded.type = name;
    result.decoded = decoded;
  } else {
    result.raw_hex = toHex(data);
  }
  return result;
}

function isValidMsgHeader(byteVal) {
  const t = byteVal >> 4;
  return t <= 5 || t === 0x0F;
}

function looksLikePack(payload, pos) {
  if (pos + 3 > payload.length) return false;
  return (payload[pos] >> 4) === 0x0F && (payload[pos] & 0x0F) <= 2 &&
    payload[pos + 1] === 25 && payload[pos + 2] >= 1 && payload[pos + 2] <= 9;
}

function decodeBeaconPayload(payload) {
  const results = [];
  let offset = 0;
  if (payload.length >= 4) {
    const hasPack0 = looksLikePack(payload, 0);
    const hasPack1 = looksLikePack(payload, 1);
    if (hasPack1 && !hasPack0) offset = 1;
  }
  while (offset < payload.length) {
    const hdr = payload[offset];
    if (!isValidMsgHeader(hdr)) { offset++; continue; }
    const msgType = hdr >> 4;
    if (msgType === 0x0F) {
      if (offset + 3 > payload.length) break;
      const singleSize = payload[offset + 1];
      const packSize = payload[offset + 2];
      if (packSize === 0 || singleSize < 20) { offset++; continue; }
      const hdrLen = 3;
      let totalBytes = packSize * singleSize;
      if (offset + hdrLen + totalBytes > payload.length) {
        const tail = payload.length - offset - hdrLen;
        const newPack = Math.floor(tail / singleSize);
        totalBytes = newPack * singleSize;
      }
      for (let i = 0; i < packSize; i++) {
        const start = offset + hdrLen + i * singleSize;
        const msgData = payload.subarray(start, start + singleSize);
        results.push(decodeOdidMessage(msgData));
        if (totalBytes === 0) break;
      }
      offset += hdrLen + totalBytes;
    } else if (msgType <= 5) {
      const msgSize = 25;
      const msgData = payload.subarray(offset, Math.min(offset + msgSize, payload.length));
      results.push(decodeOdidMessage(msgData));
      offset += msgData.length;
    } else {
      offset++;
    }
  }
  return results;
}

const ODID_WIFI_OUI = [0xFA, 0x0B, 0xBC];
const ODID_WIFI_OUI_WID = 0x0D;

function extractOdidFromBeacon(frameBody) {
  const results = [];
  let offset = 0;
  while (offset < frameBody.length) {
    if (offset + 2 > frameBody.length) break;
    const elemId = frameBody[offset];
    const elemLen = frameBody[offset + 1];
    if (offset + 2 + elemLen > frameBody.length) break;
    const elemData = frameBody.subarray(offset + 2, offset + 2 + elemLen);
    if (elemId === 0xDD && elemLen >= 5) {
      const oui = elemData.subarray(0, 3);
      const wid = elemData[3];
      if (oui[0] === ODID_WIFI_OUI[0] && oui[1] === ODID_WIFI_OUI[1] && oui[2] === ODID_WIFI_OUI[2] && wid === ODID_WIFI_OUI_WID) {
        results.push(...decodeBeaconPayload(elemData.subarray(4)));
      }
    }
    offset += 2 + elemLen;
  }
  return results;
}

function formatSummary(decodedList) {
  return decodedList.map(d => {
    const dec = d.decoded || {};
    if (dec.uas_id) return `ID:${dec.uas_id}(${ID_TYPE_NAMES[dec.id_type] || '?'})`;
    if (dec.latitude !== undefined) return `GPS:${dec.latitude.toFixed(5)},${dec.longitude.toFixed(5)}`;
    if (dec.operator_latitude !== undefined) return `OpPos:${dec.operator_latitude.toFixed(4)},${dec.operator_longitude.toFixed(4)}`;
    if (dec.operator_id) return `Op:${dec.operator_id}`;
    if (dec.description) return `Desc:${dec.description.slice(0, 20)}`;
    if (d.message_name === 'Message Pack') return 'Pack(msgs)';
    return d.message_name || '?';
  }).join(' | ');
}

window.RIDDecoder = {
  decodeOdidMessage, decodeBeaconPayload, extractOdidFromBeacon, formatSummary,
  ODID_MSG_BASIC_ID, ODID_MSG_LOCATION, ODID_MSG_SYSTEM, ODID_MSG_OPERATOR_ID,
  ODID_MSG_SELF_ID, ODID_MSG_AUTH, ODID_MSG_PACK,
  ID_TYPE_NAMES, UA_TYPE_NAMES, STATUS_NAMES, DESC_TYPE_NAMES, MSG_TYPE_NAMES,
};