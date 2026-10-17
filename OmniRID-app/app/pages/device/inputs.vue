<script setup lang="ts">
import type { ConfigSection } from '~/components/device/ConfigPage.vue'
import { validateConfig as validateDeviceConfig, detectChip } from '~/config/device'
import type { DeviceConfig, Issue } from '~/config/device'
import { useDeviceProfile } from '~/composables/useDeviceProfile'

const { target } = useDeviceProfile()

const sections = computed<ConfigSection[]>(() => [{
  title: 'Data inputs',
  description: 'The serial protocol (MAVLink, MSP, NMEA) and UART baud rate are selected on the Flight Controller page.',
  fields: [
    { name: 'uart_note', label: 'Wiring', type: 'text', value: 'Hardware page', disabled: true, description: 'Set the UART RX/TX pins, MAVLink over USB and the DroneCAN GPIO pair under Hardware.' }
  ]
}])

const mapPayload = (): Record<string, unknown> => ({})

const validate = (cfg: DeviceConfig): Issue[] => validateDeviceConfig(cfg, { chip: detectChip(target.value) })
</script>

<template>
  <DeviceConfigPage
    group="device"
    description="Reference for the physical data inputs — serial protocol selection moved to the Flight Controller page."
    :sections="sections"
    :load="true"
    :validate-config="validate"
    :map-payload="mapPayload"
  />
</template>
