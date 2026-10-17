// Storage & persistence reference for the Memory page.
// The NVS layout and the runtime-only list mirror the technical reference in
// app/config/guide.ts (section #guide-techref) and must stay in sync with it.

export type StorageRow = [key: string, type: string, description: string]

export type StorageGroup = {
  title: string
  rows: StorageRow[]
}

/** NVS namespace used by the firmware for all persisted configuration. */
export const NVS_NAMESPACE = 'esp_rid'

/** Persisted configuration keys, grouped by their NVS value type. */
export const nvsGroups: StorageGroup[] = [
  {
    title: 'Strings',
    rows: [
      ['uas_id', 'string', 'UAS ID (max 20 chars)'],
      ['op_id', 'string', 'Operator ID'],
      ['self_id', 'string', 'Self-ID text (max 23 chars)'],
      ['uas_id2', 'string', 'Secondary UAS ID'],
      ['wifi_ssid', 'string', 'WiFi AP SSID'],
      ['wifi_pass', 'string', 'WiFi AP password'],
      ['pubkey1', 'string', 'Ed25519 public key 1 (auth)'],
      ['pubkey2', 'string', 'Ed25519 public key 2 (auth)'],
      ['pubkey3', 'string', 'Ed25519 public key 3 (auth)'],
      ['pubkey4', 'string', 'Ed25519 public key 4 (auth)'],
      ['pubkey5', 'string', 'Ed25519 public key 5 (auth)']
    ]
  },
  {
    title: 'Unsigned 8-bit',
    rows: [
      ['ua_type', 'uint8', 'UA type'],
      ['id_type', 'uint8', 'ID type'],
      ['ua_type2', 'uint8', 'Secondary UA type'],
      ['id_type2', 'uint8', 'Secondary ID type'],
      ['wifi_ch', 'uint8', 'WiFi channel'],
      ['websrv_en', 'uint8', 'Web server enabled (0/1)'],
      ['mav_sysid', 'uint8', 'MAVLink system ID'],
      ['bcast_pwr', 'uint8', 'Broadcast on power-up (0/1)'],
      ['tx_modes', 'uint8', 'Transmission mode bitmask']
    ]
  },
  {
    title: 'Unsigned 32-bit',
    rows: [
      ['options', 'uint32', 'Options bitmask'],
      ['baud', 'uint32', 'UART baud rate']
    ]
  },
  {
    title: 'Signed 8-bit',
    rows: [
      ['lock_lvl', 'int8', 'Lock level (0-2)'],
      ['led_r', 'int8', 'RGB LED R GPIO (-1 = disabled)'],
      ['led_g', 'int8', 'RGB LED G GPIO (-1 = disabled)'],
      ['led_b', 'int8', 'RGB LED B GPIO (-1 = disabled)']
    ]
  },
  {
    title: 'Floats (stored as blob)',
    rows: [
      ['wifi_pwr', 'float', 'WiFi TX power (dBm)'],
      ['wifi_bcn', 'float', 'WiFi Beacon rate (Hz)'],
      ['wifi_nan', 'float', 'WiFi NaN rate (Hz)'],
      ['bt4_rate', 'float', 'BLE 4.0 rate (Hz)'],
      ['bt4_pwr', 'float', 'BLE 4.0 TX power (dBm)'],
      ['bt5_rate', 'float', 'BLE 5.0 rate (Hz)'],
      ['bt5_pwr', 'float', 'BLE 5.0 TX power (dBm)'],
      ['op_lat', 'float', 'Operator latitude'],
      ['op_lon', 'float', 'Operator longitude'],
      ['op_alt', 'float', 'Operator altitude (m)']
    ]
  }
]

/** Total number of flat keys persisted in the NVS namespace. */
export const NVS_KEY_COUNT = nvsGroups.reduce((total, group) => total + group.rows.length, 0)

/** Settings that live in RAM only and reset to defaults on every reboot. */
export const runtimeOnly: string[] = [
  'Data protocol',
  'UART port',
  'TX / RX pins',
  'WS2812 GPIO and brightness',
  'Lighting pins, patterns and phase offsets',
  'DroneCAN RX / TX / bitrate',
  'MAVLink over USB',
  'OTA trigger GPIO',
  'Auth private key',
  'Startup delay'
]

export type FlashRegion = {
  name: string
  app: string
  description: string
  tone: 'app' | 'factory' | 'ota' | 'data'
}

/** Flash partition scheme: a factory image plus a single OTA slot. */
export const flashRegions: FlashRegion[] = [
  {
    name: 'factory',
    app: 'Application',
    description: 'Factory firmware image. Used as the rollback target when an OTA update fails.',
    tone: 'factory'
  },
  {
    name: 'ota_0',
    app: 'Application',
    description: 'Single OTA slot. New firmware is written here, verified, then set as the boot partition.',
    tone: 'ota'
  },
  {
    name: `nvs (${NVS_NAMESPACE})`,
    app: 'Data',
    description: `Non-volatile storage holding the ${NVS_KEY_COUNT} flat configuration keys below.`,
    tone: 'data'
  }
]
