<script setup lang="ts">
import type { ConfigSection } from '~/components/device/ConfigPage.vue'
import { BAUD_RATES, validateConfig as validateDeviceConfig, detectChip } from '~/config/device'
import type { DeviceConfig, Issue } from '~/config/device'
import { useDeviceProfile, protocolOptions } from '~/composables/useDeviceProfile'

const { target, protocol } = useDeviceProfile()

const baudOptions = BAUD_RATES.map(b => ({ label: String(b), value: String(b) }))

const PROTOCOL_TO_NUM: Record<string, number> = { auto: 255, mavlink: 1, msp: 2, nmea: 3, none: 4 }
const NUM_TO_PROTOCOL: Record<number, string> = { 255: 'auto', 1: 'mavlink', 2: 'msp', 3: 'nmea', 4: 'none' }

const isMavlink = computed(() => protocol.value === 'mavlink')

const sysidDescription = computed(() => isMavlink.value
  ? '0 = auto-detect. ⚠ Required when Protocol is MAVLink.'
  : '0 = auto-detect. Required only when a specific protocol is set.')

const sections = computed<ConfigSection[]>(() => [{
  title: 'Serial & Protocol',
  description: 'The UART link between the ESP32 and the flight controller.',
  fields: [
    {
      name: 'protocol', label: 'FC Protocol', type: 'select', value: protocol.value, options: protocolOptions,
      description: 'Set to Auto unless detection fails. Manual override forces a specific protocol.'
    },
    { name: 'baud_rate', label: 'UART Baud Rate', type: 'select', value: '57600', options: baudOptions, description: 'Must match your flight controller serial port speed.' },
    { name: 'target_fcs', label: 'Compatible flight controllers', type: 'chips', options: [
      { label: 'Betaflight', value: '' }, { label: 'ArduPilot', value: '' }, { label: 'INAV', value: '' }
    ] }
  ]
}, {
  title: 'Advanced',
  description: 'MAVLink filtering and startup behaviour.',
  fields: [
    { name: 'mavlink_sysid', label: 'MAVLink SysID', type: 'number', value: 0, stepper: true, description: sysidDescription.value },
    { name: 'bcast_powerup', label: 'Broadcast without GPS', type: 'toggle', value: false, description: 'Send a Basic ID as soon as the device boots, even without a GPS fix.' }
  ]
}])

const mapPayload = (state: Record<string, unknown>): Record<string, unknown> => ({
  protocol: PROTOCOL_TO_NUM[String(state.protocol ?? 'auto')] ?? 255,
  baud_rate: Number(state.baud_rate ?? 57600),
  mavlink_sysid: Number(state.mavlink_sysid ?? 0),
  bcast_powerup: state.bcast_powerup ? 1 : 0
})

const applyLoaded = (cfg: Record<string, unknown>, set: (key: string, value: unknown) => void) => {
  const num = Number(cfg.protocol ?? 255)
  set('protocol', NUM_TO_PROTOCOL[num] ?? 'auto')
  set('baud_rate', String(Number(cfg.baud_rate ?? 57600)))
  set('mavlink_sysid', Number(cfg.mavlink_sysid ?? 0))
  set('bcast_powerup', Number(cfg.bcast_powerup ?? 0) !== 0)
}

const validate = (cfg: DeviceConfig): Issue[] => validateDeviceConfig(cfg, { chip: detectChip(target.value) })

const headerActions = [{ label: 'Wiki', to: '/docs/guide#protocols' }]
</script>

<template>
  <DeviceConfigPage
    group="device"
    description="Serial & Protocol — Configure the UART connection between the ESP32 and your flight controller (Pixhawk, ArduPilot, iNAV, Betaflight, etc.). MAVLink is used by ArduPilot/PX4, MSP by Betaflight/iNAV, NMEA for generic GPS modules. Set the baud rate to match your FC's serial port speed — 57600 or 115200 are common."
    :sections="sections"
    :load="true"
    :validate-config="validate"
    :map-payload="mapPayload"
    :apply-loaded="applyLoaded"
    :header-actions="headerActions"
  />
</template>