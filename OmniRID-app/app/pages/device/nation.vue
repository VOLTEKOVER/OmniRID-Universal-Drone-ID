<script setup lang="ts">
import type { ConfigSection } from '~/components/device/ConfigPage.vue'
import {
  DEFAULTS, normalizeRegion, hasFlag, setFlag, TX_MODES, REGIONS,
  validateConfig as validateDeviceConfig, detectChip
} from '~/config/device'
import type { DeviceConfig, Issue, RegionCode } from '~/config/device'
import { useDeviceProfile } from '~/composables/useDeviceProfile'

const { target } = useDeviceProfile()

const regionFieldOptions = [
  { label: 'Auto-detect', value: 'auto' },
  ...(Object.keys(REGIONS) as Exclude<RegionCode, 'auto'>[]).map(code => ({ label: REGIONS[code].label, value: code }))
]

const MODE_TOGGLES = [
  { name: 'tx_wifi_bcn', flag: TX_MODES.wifiBeacon, label: 'WiFi Beacon', description: 'Broadcast the Remote ID over a WiFi Beacon as defined by ASTM F3411-22a.' },
  { name: 'tx_wifi_nan', flag: TX_MODES.wifiNan, label: 'WiFi NAN', description: 'Neighbor Awareness Networking, used by GB 42590 and Singapore B-RID.' },
  { name: 'tx_ble4', flag: TX_MODES.ble4, label: 'BLE 4.0', description: 'Classic Bluetooth Low Energy advertising channel.' },
  { name: 'tx_ble5', flag: TX_MODES.ble5, label: 'BLE 5.0 Long Range', description: 'Requires BLE 4.0 active and an ESP32-S3 (experimental).' }
] as const

const rateKeys = ['wifi_bcn_rate_hz', 'wifi_nan_rate_hz', 'ble4_rate_hz', 'ble5_rate_hz'] as (keyof typeof DEFAULTS)[]

const sections = computed<ConfigSection[]>(() => [{
  title: 'Operating region',
  description: 'Select the nation; the firmware picks the matching Remote ID standard.',
  fields: [
    { name: 'region_select', label: 'Region', type: 'select', value: 'auto', options: regionFieldOptions, description: 'Auto-detect defaults to Europe (EASA/EEA).' }
  ]
}, {
  title: 'Transmission schedule',
  description: 'Enable the broadcast interfaces the ESP uses to transmit the Remote ID.',
  fields: [
    ...MODE_TOGGLES.map(t => ({ name: t.name, label: t.label, type: 'toggle' as const, value: false, description: t.description })),
    { name: 'wifi_channel', label: 'WiFi channel', type: 'number', value: DEFAULTS.wifi_channel },
    { name: 'wifi_power_dbm', label: 'WiFi power (dBm)', type: 'number', value: DEFAULTS.wifi_power_dbm },
    { name: 'ble4_power_dbm', label: 'BLE 4.0 power (dBm)', type: 'number', value: DEFAULTS.ble4_power_dbm },
    { name: 'ble5_power_dbm', label: 'BLE 5.0 power (dBm)', type: 'number', value: DEFAULTS.ble5_power_dbm },
    ...rateKeys.map(k => ({ name: k, label: k.replace('_rate_hz', '').replaceAll('_', ' ').toUpperCase() + ' rate (Hz)', type: 'number' as const, value: DEFAULTS[k] }))
  ]
}])

const mapPayload = (state: Record<string, unknown>): Record<string, unknown> => {
  let tx_modes = 0
  for (const t of MODE_TOGGLES) tx_modes = setFlag(tx_modes, t.flag, !!state[t.name])
  const num = (key: keyof typeof DEFAULTS) => Number(state[key] ?? DEFAULTS[key])
  return {
    region: normalizeRegion(state.region_select),
    tx_modes,
    wifi_channel: num('wifi_channel'),
    wifi_power_dbm: num('wifi_power_dbm'),
    wifi_bcn_rate_hz: num('wifi_bcn_rate_hz'),
    wifi_nan_rate_hz: num('wifi_nan_rate_hz'),
    ble4_power_dbm: num('ble4_power_dbm'),
    ble4_rate_hz: num('ble4_rate_hz'),
    ble5_power_dbm: num('ble5_power_dbm'),
    ble5_rate_hz: num('ble5_rate_hz')
  }
}

const applyLoaded = (cfg: Record<string, unknown>, set: (key: string, value: unknown) => void) => {
  set('region_select', normalizeRegion(cfg.region))
  const tx = Number(cfg.tx_modes ?? DEFAULTS.tx_modes)
  for (const t of MODE_TOGGLES) set(t.name, hasFlag(tx, t.flag))
  for (const k of rateKeys) set(k, Number(cfg[k] ?? DEFAULTS[k]))
  for (const k of ['wifi_channel', 'wifi_power_dbm', 'ble4_power_dbm', 'ble5_power_dbm'] as (keyof typeof DEFAULTS)[])
    set(k, Number(cfg[k] ?? DEFAULTS[k]))
}

const validate = (cfg: DeviceConfig): Issue[] => validateDeviceConfig(cfg, { chip: detectChip(target.value) })
</script>

<template>
  <DeviceConfigPage
    group="device"
    description="Select the operating nation, Remote ID standard and transmission schedule."
    :sections="sections"
    :load="true"
    :validate-config="validate"
    :map-payload="mapPayload"
    :apply-loaded="applyLoaded"
  />
</template>
