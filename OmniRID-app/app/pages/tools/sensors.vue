<script setup lang="ts">
import type { ConfigSection } from '~/components/device/ConfigPage.vue'

const sections: ConfigSection[] = [{
  title: 'Live sensor readings',
  description: 'Values refresh from the connected device while telemetry is available.',
  fields: [
    { name: 'firmware', label: 'Firmware', value: '--' },
    { name: 'gps_fix', label: 'GPS fix', value: '--' },
    { name: 'satellites', label: 'Satellites', value: '--' },
    { name: 'latitude', label: 'Latitude', value: '--' },
    { name: 'longitude', label: 'Longitude', value: '--' },
    { name: 'altitude', label: 'Altitude', value: '--' },
    { name: 'speed', label: 'Speed', value: '--' },
    { name: 'heading', label: 'Heading', value: '--' },
    { name: 'tx_rate', label: 'TX rate', value: '--' },
    { name: 'cpu_temperature', label: 'CPU temperature', value: '--' }
  ]
}]
</script>

<template>
  <DeviceConfigPage
    group="tools"
    readonly
    description="Inspect GPS, transmission, system and flight telemetry values."
    :sections="sections"
  />
</template>
