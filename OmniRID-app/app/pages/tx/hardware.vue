<script setup lang="ts">
import type { ConfigDanger, ConfigSection } from '~/components/device/ConfigPage.vue'
import { DEFAULTS, CAN_BITRATES, BAUD_RATES, OPTIONS, hasFlag, setFlag, validateConfig as validateDeviceConfig, detectChip } from '~/config/device'
import type { DeviceConfig, Issue } from '~/config/device'
import { useDeviceProfile, protocolOptions } from '~/composables/useDeviceProfile'

const { target, protocol } = useDeviceProfile()

const canOptions = CAN_BITRATES.map(b => ({ label: `${b / 1000} kbit/s`, value: String(b) }))
const uartOptions = [0, 1, 2].map(u => ({ label: `UART ${u}`, value: String(u) }))
const baudOptions = BAUD_RATES.map(b => ({ label: String(b), value: String(b) }))

const PROTOCOL_TO_NUM: Record<string, number> = { auto: 255, mavlink: 1, msp: 2, nmea: 3, none: 4 }
const NUM_TO_PROTOCOL: Record<number, string> = { 255: 'auto', 1: 'mavlink', 2: 'msp', 3: 'nmea', 4: 'none' }

const isMavlink = computed(() => protocol.value === 'mavlink')
const sysidDescription = computed(() => isMavlink.value
  ? '0 = auto-detect. Recommended to set the flight controller SysID when using MAVLink.'
  : '0 = auto-detect. Required only when a specific protocol is set.')

const OPTION_TOGGLES = [
  { name: 'opt_force_arm', flag: OPTIONS.forceArm, label: 'Force ARM OK', description: 'Allow arming without safety checks. Test option only; never use for real flights.' },
  { name: 'opt_no_save_basic_id', flag: OPTIONS.noSaveBasicId, label: 'Don\'t save BasicID to NVS', description: 'Keep the Basic ID in RAM only; identity must be re-applied on every boot.' },
  { name: 'opt_print_mavlink_rid', flag: OPTIONS.printMavlinkRid, label: 'Print MAVLink RID messages', description: 'Log the outgoing MAVLink Remote ID messages to the console.' },
  { name: 'opt_demo_mode', flag: OPTIONS.demoMode, label: 'Demo mode (simulated GPS patrol)', description: 'Transmit a simulated GPS position for bench testing.' },
  { name: 'opt_kalman', flag: OPTIONS.kalman, label: 'Kalman filter (GPS smoothing)', description: 'Fuse GPS and barometer for a smoother position estimate.' },
  { name: 'opt_ed25519_auth', flag: OPTIONS.ed25519Auth, label: 'Ed25519 auth on transmitted IDs', description: 'Authenticate the transmitted identity with an ed25519 signature.' },
  { name: 'opt_mavlink_arm_gate', flag: OPTIONS.mavlinkArmGate, label: 'MAVLink arm status gate', description: 'Block Remote ID transmission while the flight controller disarms.' },
  { name: 'opt_mavlink_op_loc', flag: OPTIONS.mavlinkOpLoc, label: 'MAVLink operator location loop', description: 'Inject the operator location from MAVLink into the Remote ID stream.' },
  { name: 'opt_identity_gate', flag: OPTIONS.identityGate, label: 'Identity ready gate', description: 'Refuse to transmit while the identity fields are incomplete.' }
] as const

const numField = (name: keyof typeof DEFAULTS, label: string, description?: string) => ({
  name, label, type: 'number' as const, value: DEFAULTS[name] as number, description
})

const sections = computed<ConfigSection[]>(() => [{
  title: 'Flight controller connection',
  description: 'Configure the protocol, serial speed and UART pins connected to the flight controller.',
  fields: [
    {
      name: 'protocol', label: 'FC protocol', type: 'select', value: protocol.value, options: protocolOptions,
      description: 'Use Auto-detect unless detection fails. Manual override forces a specific protocol.'
    },
    { name: 'baud_rate', label: 'UART baud rate', type: 'select', value: '57600', options: baudOptions, description: 'Must match the flight controller serial port speed.' },
    { name: 'uart_port', label: 'UART port', type: 'select', value: String(DEFAULTS.uart_port), options: uartOptions },
    numField('tx_pin', 'TX pin', 'UART TX wired to the flight controller RX. -1 disables this input.'),
    numField('rx_pin', 'RX pin', 'UART RX wired to the flight controller TX. -1 disables this input.'),
    { name: 'mavlink_usb_enable', label: 'MAVLink over USB', type: 'toggle', value: false, description: 'ESP32-S3/C6 only: use the USB CDC port as a MAVLink input.' },
    { name: 'target_fcs', label: 'Compatible flight controllers', type: 'chips', options: [
      { label: 'Betaflight', value: '' }, { label: 'ArduPilot', value: '' }, { label: 'INAV', value: '' }
    ] }
  ]
}, {
  title: 'Flight controller options',
  description: 'MAVLink filtering and startup behaviour.',
  fields: [
    { name: 'mavlink_sysid', label: 'MAVLink SysID', type: 'number', value: 0, stepper: true, description: sysidDescription.value },
    { name: 'bcast_powerup', label: 'Broadcast without GPS', type: 'toggle', value: false, description: 'Send a Basic ID as soon as the device boots, even without a GPS fix.' },
    ...OPTION_TOGGLES.filter(option => ['opt_mavlink_arm_gate', 'opt_mavlink_op_loc', 'opt_print_mavlink_rid'].includes(option.name))
      .map(option => ({ name: option.name, label: option.label, type: 'toggle' as const, value: false, description: option.description }))
  ]
}, {
  title: 'Identity & broadcast options',
  description: 'Control how device identity is stored, signed and checked before transmission.',
  fields: OPTION_TOGGLES.filter(option => ['opt_no_save_basic_id', 'opt_ed25519_auth', 'opt_identity_gate'].includes(option.name))
    .map(option => ({ name: option.name, label: option.label, type: 'toggle' as const, value: false, description: option.description }))
}, {
  title: 'GPS & test options',
  description: 'Optional GPS processing and bench-test behaviour.',
  fields: OPTION_TOGGLES.filter(option => ['opt_force_arm', 'opt_demo_mode', 'opt_kalman'].includes(option.name))
    .map(option => ({ name: option.name, label: option.label, type: 'toggle' as const, value: false, description: option.description }))
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
  'led_r_gpio', 'led_g_gpio', 'led_b_gpio', 'ota_trigger_gpio', 'start_delay_ms',
  'baud_rate', 'mavlink_sysid'
] as (keyof typeof DEFAULTS)[]

const mapPayload = (state: Record<string, unknown>): Record<string, unknown> => {
  let options = 0
  for (const option of OPTION_TOGGLES) options = setFlag(options, option.flag, !!state[option.name])
  const out: Record<string, unknown> = {
    mavlink_usb_enable: state.mavlink_usb_enable ? 1 : 0,
    protocol: PROTOCOL_TO_NUM[String(state.protocol ?? 'auto')] ?? 255,
    bcast_powerup: state.bcast_powerup ? 1 : 0,
    options
  }
  for (const key of numberKeys) out[key] = Number(state[key] ?? DEFAULTS[key])
  return out
}

const applyLoaded = (cfg: Record<string, unknown>, set: (key: string, value: unknown) => void) => {
  for (const key of numberKeys) set(key, Number(cfg[key] ?? DEFAULTS[key]))
  set('mavlink_usb_enable', Number(cfg.mavlink_usb_enable ?? 0) !== 0)
  const num = Number(cfg.protocol ?? 255)
  set('protocol', NUM_TO_PROTOCOL[num] ?? 'auto')
  set('bcast_powerup', Number(cfg.bcast_powerup ?? 0) !== 0)
  const options = Number(cfg.options ?? 0)
  for (const option of OPTION_TOGGLES) set(option.name, hasFlag(options, option.flag))
}

const danger = (state: Record<string, unknown>): ConfigDanger[] => state.opt_force_arm
  ? [{ title: 'Force ARM OK is active', description: 'This bypasses arming safety checks. Test option only; never use for real flights.' }]
  : []

const validate = (cfg: DeviceConfig): Issue[] => validateDeviceConfig(cfg, { chip: detectChip(target.value) })
const headerActions = [{ label: 'Wiki', to: '/guide#protocols' }]
</script>

<template>
  <DeviceConfigPage
    group="tx"
    description="Configure the flight controller, firmware behaviour, DroneCAN, LEDs and boot settings."
    :sections="sections"
    :load="true"
    :validate-config="validate"
    :map-payload="mapPayload"
    :apply-loaded="applyLoaded"
    :danger="danger"
    :header-actions="headerActions"
  />
</template>
