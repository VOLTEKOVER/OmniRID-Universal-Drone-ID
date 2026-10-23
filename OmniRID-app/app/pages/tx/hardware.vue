<script setup lang="ts">
import type { ConfigSection } from '~/components/device/ConfigPage.vue'
import { DEFAULTS, CAN_BITRATES, validateConfig as validateDeviceConfig, detectChip } from '~/config/device'
import type { DeviceConfig, Issue } from '~/config/device'
import { useDeviceProfile } from '~/composables/useDeviceProfile'

const { target } = useDeviceProfile()

const canOptions = CAN_BITRATES.map(b => ({ label: `${b / 1000} kbit/s`, value: String(b) }))
const uartOptions = [0, 1, 2].map(u => ({ label: `UART ${u}`, value: String(u) }))

const numField = (name: keyof typeof DEFAULTS, label: string, description?: string) => ({
  name, label, type: 'number' as const, value: DEFAULTS[name] as number, description
})

const sections = computed<ConfigSection[]>(() => [{
  title: 'Flight controller UART',
  description: 'Serial pins wired to the flight controller.',
  fields: [
    { name: 'uart_port', label: 'UART port', type: 'select', value: String(DEFAULTS.uart_port), options: uartOptions },
    numField('tx_pin', 'TX pin', 'UART TX wired to the flight controller RX. -1 disables this input.'),
    numField('rx_pin', 'RX pin', 'UART RX wired to the flight controller TX. -1 disables this input.'),
    { name: 'mavlink_usb_enable', label: 'MAVLink over USB', type: 'toggle', value: false, description: 'ESP32-S3/C6 only: use the USB CDC port as a MAVLink input.' }
  ]
}, {
  title: 'DroneCAN',
  description: 'Optional CAN bus link to a DroneCAN-enabled flight controller.',
  fields: [
    numField('dronecan_rx_gpio', 'DroneCAN RX pin'),
    numField('dronecan_tx_gpio', 'DroneCAN TX pin'),
    { name: 'dronecan_bitrate', label: 'CAN bitrate', type: 'select', value: String(DEFAULTS.dronecan_bitrate), options: canOptions }
  ]
}, {
  title: 'Status LEDs',
  description: 'Simple GPIO LEDs driven by the firmware.',
  fields: [
    numField('led_r_gpio', 'Red LED'),
    numField('led_g_gpio', 'Green LED'),
    numField('led_b_gpio', 'Blue LED')
  ]
}, {
  title: 'Boot & OTA',
  description: 'Safety and update behaviour.',
  fields: [
    numField('ota_trigger_gpio', 'OTA trigger pin', 'Hold this pin at boot to enter firmware update mode.'),
    numField('start_delay_ms', 'Startup delay (ms)', 'Delay before the ESP starts broadcasting after boot.')
  ]
}])

const numberKeys = [
  'uart_port', 'tx_pin', 'rx_pin', 'dronecan_rx_gpio', 'dronecan_tx_gpio', 'dronecan_bitrate',
  'led_r_gpio', 'led_g_gpio', 'led_b_gpio', 'ota_trigger_gpio', 'start_delay_ms'
] as (keyof typeof DEFAULTS)[]

const mapPayload = (state: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = { mavlink_usb_enable: state.mavlink_usb_enable ? 1 : 0 }
  for (const key of numberKeys) out[key] = Number(state[key] ?? DEFAULTS[key])
  return out
}

const applyLoaded = (cfg: Record<string, unknown>, set: (key: string, value: unknown) => void) => {
  for (const key of numberKeys) set(key, Number(cfg[key] ?? DEFAULTS[key]))
  set('mavlink_usb_enable', Number(cfg.mavlink_usb_enable ?? 0) !== 0)
}

const validate = (cfg: DeviceConfig): Issue[] => validateDeviceConfig(cfg, { chip: detectChip(target.value) })
</script>

<template>
  <DeviceConfigPage
    group="tx"
    description="Wire the pins: flight controller UART, DroneCAN, status LEDs and boot behaviour."
    :sections="sections"
    :load="true"
    :validate-config="validate"
    :map-payload="mapPayload"
    :apply-loaded="applyLoaded"
  />
</template>
