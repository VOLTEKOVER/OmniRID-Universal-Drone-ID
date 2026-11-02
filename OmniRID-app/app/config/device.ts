export type PageId = 'nation' | 'transmission' | 'identity' | 'ap' | 'fc' | 'hardware' | 'system'
export type Severity = 'error' | 'warning'
export interface Issue {
  field: string
  page: PageId
  severity: Severity
  message: string
}

export type RegionCode
  = | 'auto' | 'EUR' | 'FAA' | 'JPN' | 'SGP' | 'KOR' | 'CHN' | 'CAN' | 'AUS' | 'BRA' | 'NZL'

export type DeviceConfig = {
  region: RegionCode
  protocol: 255 | 1 | 2 | 3 | 4

  uas_id: string
  id_type: number
  ua_type: number
  operator_id: string
  self_id_text: string
  operator_lat: number
  operator_lon: number
  operator_alt: number
  uas_id_2: string
  id_type_2: number
  ua_type_2: number

  tx_modes: number
  wifi_channel: number
  wifi_power_dbm: number
  wifi_bcn_rate_hz: number
  wifi_nan_rate_hz: number
  ble4_rate_hz: number
  ble4_power_dbm: number
  ble5_rate_hz: number
  ble5_power_dbm: number

  wifi_ssid: string
  wifi_password: string
  webserver_en: 0 | 1

  baud_rate: number
  mavlink_sysid: number
  bcast_powerup: 0 | 1

  led_r_gpio: number
  led_g_gpio: number
  led_b_gpio: number
  uart_port: number
  tx_pin: number
  rx_pin: number
  dronecan_rx_gpio: number
  dronecan_tx_gpio: number
  dronecan_bitrate: number
  ota_trigger_gpio: number
  mavlink_usb_enable: 0 | 1
  start_delay_ms: number

  lock_level: 0 | 1 | 2
  options: number
  public_key_1: string
  public_key_2: string
  public_key_3: string
  public_key_4: string
  public_key_5: string
}

export const OPTIONS = {
  forceArm: 1,
  noSaveBasicId: 2,
  printMavlinkRid: 4,
  demoMode: 8,
  kalman: 16,
  ed25519Auth: 32,
  mavlinkArmGate: 64,
  mavlinkOpLoc: 128,
  identityGate: 256
} as const

export const TX_MODES = { wifiBeacon: 1, wifiNan: 2, ble4: 4, ble5: 8 } as const

export const hasFlag = (value: number, flag: number): boolean => (value & flag) !== 0
export const setFlag = (value: number, flag: number, on: boolean): number =>
  on ? value | flag : value & ~flag

export const PROTOCOLS = [
  { value: 255, label: 'Auto-detect' },
  { value: 1, label: 'MAVLink' },
  { value: 2, label: 'MSP' },
  { value: 3, label: 'NMEA' },
  { value: 4, label: 'None (no FC)' }
] as const

export const ID_TYPES = [
  { value: 1, label: 'Serial Number (ANSI/CTA-2063)' },
  { value: 2, label: 'CAA Registration' },
  { value: 3, label: 'UTM UUID' },
  { value: 4, label: 'Session ID' }
] as const

export const UA_TYPES = [
  'None', 'Aeroplane', 'Helicopter / Multirotor', 'Gyroplane', 'Hybrid Lift', 'Ornithopter',
  'Glider', 'Kite', 'Free Balloon', 'Captive Balloon', 'Airship', 'Free Fall', 'Rocket',
  'Tethered Aircraft', 'Ground Obstacle', 'Other'
].map((label, value) => ({ value, label }))

export const BAUD_RATES = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600] as const
export const CAN_BITRATES = [125000, 250000, 500000, 1000000] as const
export const LOCK_LEVELS = [
  { value: 0, label: '0 - Normal' },
  { value: 1, label: '1 - Locked (signed commands only)' },
  { value: 2, label: '2 - eFuse permanent (IRREVERSIBLE)' }
] as const

export const LIMITS = {
  uasIdMax: 20,
  operatorIdMax: 20,
  selfIdMax: 23,
  wifiSsidMax: 32,
  wifiPassMin: 0,
  wifiPassMax: 32,
  publicKeyMax: 512,
  wifiChannel: [1, 13],
  wifiPowerDbm: [2, 20],
  rateHz: [0, 5],
  blePowerDbm: [-27, 18],
  mavSysid: [0, 254],
  startDelayMs: [0, 30000],
  gpioGeneric: [-1, 48]
} as const

export const DEFAULTS: DeviceConfig = {
  region: 'auto',
  protocol: 255,
  uas_id: '', id_type: 1, ua_type: 1, operator_id: '', self_id_text: '',
  operator_lat: 0, operator_lon: 0, operator_alt: 0,
  uas_id_2: '', id_type_2: 0, ua_type_2: 0,
  tx_modes: 0,
  wifi_channel: 6, wifi_power_dbm: 20, wifi_bcn_rate_hz: 1, wifi_nan_rate_hz: 0,
  ble4_rate_hz: 1, ble4_power_dbm: 18, ble5_rate_hz: 1, ble5_power_dbm: 18,
  wifi_ssid: 'ESP-RID', wifi_password: '', webserver_en: 0,
  baud_rate: 57600, mavlink_sysid: 0, bcast_powerup: 0,
  led_r_gpio: -1, led_g_gpio: -1, led_b_gpio: -1,
  uart_port: 2, tx_pin: 17, rx_pin: 16,
  dronecan_rx_gpio: -1, dronecan_tx_gpio: -1, dronecan_bitrate: 500000,
  ota_trigger_gpio: -1, mavlink_usb_enable: 0, start_delay_ms: 0,
  lock_level: 0, options: 0,
  public_key_1: '', public_key_2: '', public_key_3: '', public_key_4: '', public_key_5: ''
}

export type RequiredConfigItem = 'uas_id' | 'ua_type' | 'op_id' | 'tx'
export type RuntimeCheck = 'gps' | 'broadcast'

export interface RegionInfo {
  label: string
  standard: 'ASTM F3411-22a' | 'GB 42590'
  encoderReady: boolean
  requiredConfig: RequiredConfigItem[]
  requiredRuntime: RuntimeCheck[]
}

const COMMON: RequiredConfigItem[] = ['uas_id', 'ua_type', 'tx']
const RUNTIME: RuntimeCheck[] = ['gps', 'broadcast']
const region = (label: string, extra: Partial<RegionInfo> = {}): RegionInfo => ({
  label, standard: 'ASTM F3411-22a', encoderReady: true,
  requiredConfig: COMMON, requiredRuntime: RUNTIME, ...extra
})

export const REGIONS: Record<Exclude<RegionCode, 'auto'>, RegionInfo> = {
  EUR: region('Europe (EASA/EEA)', { requiredConfig: [...COMMON, 'op_id'] }),
  FAA: region('USA (FAA Part 89)'),
  JPN: region('Japan (MLIT)'),
  SGP: region('Singapore (CAAS B-RID)'),
  KOR: region('South Korea (KASA)'),
  CHN: region('China (GB 42590)', { standard: 'GB 42590', encoderReady: false }),
  CAN: region('Canada (Transport Canada)'),
  AUS: region('Australia (CASA)'),
  BRA: region('Brazil (ANAC RBAC 100)'),
  NZL: region('New Zealand (CAA NZ)')
}

export const resolveRegion = (r: RegionCode): Exclude<RegionCode, 'auto'> => (r === 'auto' ? 'EUR' : r)

export function normalizeRegion(v: unknown): RegionCode {
  const s = String(v ?? 'auto')
  if (s.toLowerCase() === 'auto') return 'auto'
  const up = s.toUpperCase()
  return up in REGIONS ? (up as RegionCode) : 'auto'
}

export type ChipId = 'esp32' | 'esp32s3' | 'esp32c6'
export type Level = 'ok' | 'test' | 'no'
export type Feature
  = | 'wifiBeacon' | 'wifiNan' | 'ble4' | 'ble5LongRange' | 'usbCdc'
    | 'mavlinkUsb' | 'dronecan'

export interface ChipInfo {
  label: string
  defaultRxPin: number
  maxGpio: number
  inputOnly: number[]
  reserved: number[]
  features: Record<Feature, Level>
  reasons: Partial<Record<Feature, string>>
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
const baseFeatures: Record<Feature, Level> = {
  wifiBeacon: 'ok', wifiNan: 'test', ble4: 'ok', ble5LongRange: 'no', usbCdc: 'ok',
  mavlinkUsb: 'ok', dronecan: 'ok'
}

export const CHIPS: Record<ChipId, ChipInfo> = {
  esp32: {
    label: 'ESP32', defaultRxPin: 16, maxGpio: 39, inputOnly: range(34, 39), reserved: range(6, 11),
    features: { ...baseFeatures, usbCdc: 'no', mavlinkUsb: 'no' },
    reasons: {
      ble5LongRange: 'BLE 5.0 Long Range requires an ESP32-S3',
      usbCdc: 'This chip has no USB CDC',
      mavlinkUsb: 'MAVLink over USB requires ESP32-S3 or C6'
    }
  },
  esp32s3: {
    label: 'ESP32-S3', defaultRxPin: 18, maxGpio: 48, inputOnly: [], reserved: [],
    features: { ...baseFeatures, ble5LongRange: 'test' },
    reasons: { ble5LongRange: 'BLE 5.0 Long Range is experimental (Beta)' }
  },
  esp32c6: {
    label: 'ESP32-C6', defaultRxPin: 7, maxGpio: 30, inputOnly: [], reserved: [],
    features: { ...baseFeatures, ble5LongRange: 'no' },
    reasons: { ble5LongRange: 'BLE 5.0 Long Range is not implemented yet on the C6' }
  }
}

export function detectChip(s?: string): ChipId | undefined {
  if (!s) return undefined
  if (/s3/i.test(s)) return 'esp32s3'
  if (/c6/i.test(s)) return 'esp32c6'
  if (/esp32/i.test(s)) return 'esp32'
  return undefined
}

export const featureLevel = (chip: ChipId | undefined, f: Feature): Level =>
  chip ? CHIPS[chip].features[f] : 'ok'

const isAscii = (s: string) => /^[\x20-\x7E]*$/.test(s)
const inRange = (n: number, [lo, hi]: readonly [number, number]) =>
  Number.isFinite(n) && n >= lo && n <= hi

export function validateCta2063(raw: string): string | null {
  const s = raw.toUpperCase()
  if (s.length < 6 || s.length > 20)
    return 'Must be 6-20 characters (4-char manufacturer code, 1 length code, serial).'
  if (!/^[A-Z0-9]{4}$/.test(s.slice(0, 4))) return 'The first 4 characters must be an alphanumeric manufacturer code.'
  const lc = s[4] ?? ''
  const len = lc >= '1' && lc <= '9' ? parseInt(lc, 10) : lc >= 'A' && lc <= 'F' ? lc.charCodeAt(0) - 55 : -1
  if (len < 1 || len > 15) return 'The 5th character is the length code: 1-9 or A-F (1-15).'
  const serial = s.slice(5)
  if (serial.length !== len) return `Serial length (${serial.length}) does not match the length code (${len}).`
  if (/[OI]/.test(serial)) return 'The serial must not contain the letters O and I.'
  if (!/^[A-Z0-9]+$/.test(serial)) return 'The serial must be uppercase alphanumeric.'
  return null
}

export function validatePublicKey(v: string): string | null {
  const s = v.trim()
  if (!s) return null
  if (s.length > LIMITS.publicKeyMax) return `Maximum ${LIMITS.publicKeyMax} characters.`
  if (/^(-----BEGIN|PUBLIC_KEYV1:)/i.test(s)) return null
  return /^[A-Za-z0-9+/=]{32,}$/.test(s)
    ? null
    : 'Must start with PUBLIC_KEYV1: or -----BEGIN, or be a raw base64 key.'
}

const KEYS = [1, 2, 3, 4, 5] as const
const publicKeys = (c: DeviceConfig) => KEYS.map(i => c[`public_key_${i}` as const])

type PinKey
  = | 'led_r_gpio' | 'led_g_gpio' | 'led_b_gpio' | 'tx_pin' | 'rx_pin'
    | 'dronecan_rx_gpio' | 'dronecan_tx_gpio' | 'ota_trigger_gpio'
const PIN_ROLES: { key: PinKey, label: string, page: PageId, output: boolean }[] = [
  { key: 'rx_pin', label: 'UART RX', page: 'hardware', output: false },
  { key: 'tx_pin', label: 'UART TX', page: 'hardware', output: true },
  { key: 'dronecan_rx_gpio', label: 'DroneCAN RX', page: 'hardware', output: false },
  { key: 'dronecan_tx_gpio', label: 'DroneCAN TX', page: 'hardware', output: true },
  { key: 'led_r_gpio', label: 'Red LED', page: 'hardware', output: true },
  { key: 'led_g_gpio', label: 'Green LED', page: 'hardware', output: true },
  { key: 'led_b_gpio', label: 'Blue LED', page: 'hardware', output: true },
  { key: 'ota_trigger_gpio', label: 'OTA trigger', page: 'hardware', output: false }
]

export interface ValidationContext {
  chip?: ChipId
}

export function validateConfig(c: DeviceConfig, ctx: ValidationContext = {}): Issue[] {
  const out: Issue[] = []
  const add = (field: string, page: PageId, severity: Severity, message: string) =>
    out.push({ field, page, severity, message })
  const err = (field: string, page: PageId, m: string) => add(field, page, 'error', m)
  const warn = (field: string, page: PageId, m: string) => add(field, page, 'warning', m)
  const chip = ctx.chip
  const reg = REGIONS[resolveRegion(c.region)]

  if (!reg.encoderReady)
    warn('region', 'nation', `${reg.standard}: encoder not implemented yet, the firmware transmits the ASTM F3411-22a fallback`)

  const uas = c.uas_id.trim()
  if (!uas) err('uas_id', 'identity', 'UAS ID is required.')
  else if (uas.length > LIMITS.uasIdMax || !isAscii(uas)) err('uas_id', 'identity', `Maximum ${LIMITS.uasIdMax} ASCII characters.`)
  else if (c.id_type === 1) {
    const m = validateCta2063(uas)
    if (m) err('uas_id', 'identity', m)
  }
  if (![1, 2, 3, 4].includes(c.id_type)) err('id_type', 'identity', 'Invalid ID type.')
  if (c.ua_type === 0) err('ua_type', 'identity', 'UA Type cannot be None: receivers reject it.')
  if (c.ua_type < 0 || c.ua_type > 15) err('ua_type', 'identity', 'UA Type is invalid.')

  const op = c.operator_id.trim()
  if (op.length > LIMITS.operatorIdMax || !isAscii(op)) err('operator_id', 'identity', `Maximum ${LIMITS.operatorIdMax} ASCII characters.`)
  else if (!op && reg.requiredConfig.includes('op_id'))
    err('operator_id', 'identity', `Operator ID is required for the ${reg.label} region.`)

  if (c.self_id_text.length > LIMITS.selfIdMax || !isAscii(c.self_id_text))
    err('self_id_text', 'identity', `Maximum ${LIMITS.selfIdMax} ASCII characters.`)

  const uas2 = c.uas_id_2.trim()
  if (uas2.length > LIMITS.uasIdMax || !isAscii(uas2)) err('uas_id_2', 'identity', `Maximum ${LIMITS.uasIdMax} ASCII characters.`)
  if (c.id_type_2 !== 0 && !uas2) err('uas_id_2', 'identity', 'UAS ID 2 is required when ID Type 2 is set.')
  if (c.id_type_2 === 0 && uas2) err('id_type_2', 'identity', 'Set ID Type 2 when you have entered UAS ID 2.')
  if (c.id_type_2 === 1 && uas2) {
    const m = validateCta2063(uas2)
    if (m) err('uas_id_2', 'identity', m)
  }

  if (!inRange(c.operator_lat, [-90, 90])) err('operator_lat', 'identity', 'Latitude must be between -90 and 90.')
  if (!inRange(c.operator_lon, [-180, 180])) err('operator_lon', 'identity', 'Longitude must be between -180 and 180.')
  if ((c.operator_lat === 0) !== (c.operator_lon === 0))
    warn('operator_lon', 'identity', 'Latitude and longitude: either both 0 (use drone position) or both set.')

  const bcn = hasFlag(c.tx_modes, TX_MODES.wifiBeacon)
  const nan = hasFlag(c.tx_modes, TX_MODES.wifiNan)
  const ble4 = hasFlag(c.tx_modes, TX_MODES.ble4)
  const ble5 = hasFlag(c.tx_modes, TX_MODES.ble5)
  if (!bcn && !nan && !ble4 && !ble5) err('tx_modes', 'nation', 'Enable at least one transmission mode.')
  if (nan && !bcn) err('tx_modes', 'nation', 'WiFi NAN requires WiFi Beacon active.')
  if (ble5 && !ble4) err('tx_modes', 'nation', 'BLE 5.0 LR requires BLE 4.0 active.')

  const modeFeature: [boolean, Feature, string][] = [
    [bcn, 'wifiBeacon', 'WiFi Beacon'], [nan, 'wifiNan', 'WiFi NAN'],
    [ble4, 'ble4', 'BLE 4.0'], [ble5, 'ble5LongRange', 'BLE 5.0 LR']
  ]
  for (const [on, f, name] of modeFeature) {
    if (!on || !chip) continue
    const lv = CHIPS[chip].features[f]
    const why = CHIPS[chip].reasons[f] ?? `${name} is not available on ${CHIPS[chip].label}.`
    if (lv === 'no') err('tx_modes', 'nation', why)
    else if (lv === 'test') warn('tx_modes', 'nation', `${name}: not yet validated on real hardware.`)
  }

  if (!inRange(c.wifi_channel, LIMITS.wifiChannel)) err('wifi_channel', 'nation', 'WiFi channel must be 1-13.')
  if (!inRange(c.wifi_power_dbm, LIMITS.wifiPowerDbm)) err('wifi_power_dbm', 'nation', 'WiFi power must be 2-20 dBm.')
  if (!inRange(c.ble4_power_dbm, LIMITS.blePowerDbm)) err('ble4_power_dbm', 'nation', 'BLE power must be -27..18 dBm.')
  if (!inRange(c.ble5_power_dbm, LIMITS.blePowerDbm)) err('ble5_power_dbm', 'nation', 'BLE power must be -27..18 dBm.')
  const rates: [keyof DeviceConfig, boolean][] = [
    ['wifi_bcn_rate_hz', bcn], ['wifi_nan_rate_hz', nan], ['ble4_rate_hz', ble4], ['ble5_rate_hz', ble5]
  ]
  for (const [k, active] of rates) {
    const v = c[k] as number
    if (!inRange(v, LIMITS.rateHz)) err(k, 'nation', 'Rate must be 0-5 Hz.')
    else if (active && v === 0) warn(k, 'nation', 'Mode active but rate is 0 Hz: probably not transmitting.')
  }

  const ssid = c.wifi_ssid
  if (!ssid.trim() || ssid.length > LIMITS.wifiSsidMax) err('wifi_ssid', 'ap', `SSID is required, maximum ${LIMITS.wifiSsidMax} characters.`)
  if (c.wifi_password && (c.wifi_password.length < LIMITS.wifiPassMin || c.wifi_password.length > LIMITS.wifiPassMax))
    err('wifi_password', 'ap', `Leave empty or use ${LIMITS.wifiPassMin}-${LIMITS.wifiPassMax} characters.`)

  if (![255, 1, 2, 3, 4].includes(c.protocol)) err('protocol', 'fc', 'Invalid protocol.')
  if (c.protocol !== 4 && !(BAUD_RATES as readonly number[]).includes(c.baud_rate)) err('baud_rate', 'fc', 'Invalid baud rate.')
  if (!inRange(c.mavlink_sysid, LIMITS.mavSysid)) err('mavlink_sysid', 'fc', 'MAVLink SysID must be 0-254.')
  else if (c.protocol === 1 && c.mavlink_sysid === 0)
    warn('mavlink_sysid', 'fc', 'With MAVLink it is recommended to set the SysID (0 = auto-detect).')
  const canPins = (c.dronecan_rx_gpio >= 0 ? 1 : 0) + (c.dronecan_tx_gpio >= 0 ? 1 : 0)
  const hasInput = c.rx_pin >= 0 || c.mavlink_usb_enable === 1 || canPins > 0
  if (c.protocol !== 4 && !hasInput)
    err('rx_pin', 'hardware', 'No data input configured (UART RX, MAVLink USB or DroneCAN).')

  const gpioRange = chip ? ([-1, CHIPS[chip].maxGpio] as const) : LIMITS.gpioGeneric
  const used = new Map<number, string[]>()
  for (const r of PIN_ROLES) {
    const pin = c[r.key]
    if (!Number.isInteger(pin) || !inRange(pin, gpioRange)) {
      err(r.key, r.page, `${r.label}: GPIO must be -1..${gpioRange[1]}.`)
      continue
    }
    if (pin < 0) continue
    if (chip && CHIPS[chip].reserved.includes(pin)) err(r.key, r.page, `${r.label}: GPIO${pin} is reserved for flash.`)
    if (chip && r.output && CHIPS[chip].inputOnly.includes(pin)) err(r.key, r.page, `${r.label}: GPIO${pin} is input-only on ${CHIPS[chip].label}.`)
    used.set(pin, [...(used.get(pin) ?? []), r.label])
  }
  for (const [pin, roles] of used)
    if (roles.length > 1) err('rx_pin', 'hardware', `GPIO${pin} is assigned to multiple functions: ${roles.join(', ')}.`)

  if (canPins === 1) err('dronecan_rx_gpio', 'hardware', 'DroneCAN requires both RX and TX (or both -1).')
  if (!(CAN_BITRATES as readonly number[]).includes(c.dronecan_bitrate)) err('dronecan_bitrate', 'hardware', 'Invalid CAN bitrate.')
  if (!inRange(c.start_delay_ms, LIMITS.startDelayMs)) err('start_delay_ms', 'hardware', 'Delay must be 0-30000 ms.')
  if (![0, 1, 2].includes(c.uart_port)) err('uart_port', 'hardware', 'UART must be 0-2.')
  if (c.mavlink_usb_enable && chip && featureLevel(chip, 'mavlinkUsb') === 'no')
    err('mavlink_usb_enable', 'hardware', CHIPS[chip].reasons.mavlinkUsb ?? 'MAVLink USB is not available on this chip.')

  KEYS.forEach((i) => {
    const m = validatePublicKey(c[`public_key_${i}` as const])
    if (m) err(`public_key_${i}`, 'system', m)
  })
  if (c.lock_level >= 1 && !publicKeys(c).some(k => k.trim()))
    err('lock_level', 'system', `Lock level ${c.lock_level} requires at least one public key, otherwise the device becomes unreachable.`)
  if (![0, 1, 2].includes(c.lock_level)) err('lock_level', 'system', 'Invalid lock level.')
  if (hasFlag(c.options, OPTIONS.demoMode)) warn('options', 'hardware', 'Demo mode active: transmits a simulated GPS position.')
  if (hasFlag(c.options, OPTIONS.forceArm)) warn('options', 'hardware', 'Force ARM OK active: test option, not for real flights.')

  return out
}

export type PageStatus = 'invalid' | 'warning' | 'valid'
export function pageStatus(issues: Issue[], page: PageId): PageStatus {
  const mine = issues.filter(i => i.page === page)
  return mine.some(i => i.severity === 'error') ? 'invalid' : mine.length ? 'warning' : 'valid'
}

export function normalizeConfig(c: DeviceConfig): DeviceConfig {
  const n = { ...c, region: normalizeRegion(c.region) }
  if (!hasFlag(n.tx_modes, TX_MODES.wifiBeacon)) n.tx_modes = setFlag(n.tx_modes, TX_MODES.wifiNan, false)
  if (!hasFlag(n.tx_modes, TX_MODES.ble4)) n.tx_modes = setFlag(n.tx_modes, TX_MODES.ble5, false)
  if (n.id_type === 1) n.uas_id = n.uas_id.trim().toUpperCase()
  if (n.id_type_2 === 1) n.uas_id_2 = n.uas_id_2.trim().toUpperCase()
  return n
}

export function dangerConfirmReasons(c: DeviceConfig): string[] {
  const r: string[] = []
  if (c.lock_level === 2) r.push('Lock level 2 burns the eFuses permanently and irreversibly.')
  if (hasFlag(c.options, OPTIONS.forceArm)) r.push('Force ARM OK is a test option.')
  return r
}

export interface RuntimeState { fcConnected?: boolean, gpsFix?: boolean, txTotal?: number }
export function regionChecklist(c: DeviceConfig, rt: RuntimeState = {}) {
  const reg = REGIONS[resolveRegion(c.region)]
  const cfg: Record<RequiredConfigItem, boolean> = {
    uas_id: c.uas_id.trim().length > 0,
    ua_type: c.ua_type !== 0,
    op_id: c.operator_id.trim().length > 0,
    tx: c.tx_modes !== 0
  }
  const run: Record<RuntimeCheck, boolean> = { gps: !!rt.gpsFix, broadcast: (rt.txTotal ?? 0) > 0 }
  return {
    standard: reg.standard,
    items: [
      ...(Object.keys(cfg) as RequiredConfigItem[]).map(k => ({ id: k, ok: cfg[k], required: reg.requiredConfig.includes(k) })),
      ...(Object.keys(run) as RuntimeCheck[]).map(k => ({ id: k, ok: run[k], required: reg.requiredRuntime.includes(k) }))
    ]
  }
}

export const requiresSignature = (lockLevel: number): boolean => lockLevel >= 1
