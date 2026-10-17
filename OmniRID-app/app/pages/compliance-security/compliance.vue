<script setup lang="ts">
import type { ConfigSection } from '~/components/device/ConfigPage.vue'
import { regionOptions, useDeviceProfile } from '~/composables/useDeviceProfile'

const { region } = useDeviceProfile()

const sections = computed<ConfigSection[]>(() => [{
  title: 'Regulatory region',
  description: 'Select the broadcast standard used for your operating region.',
  fields: [{ name: 'region', label: 'Region', type: 'select', value: region.value, options: regionOptions }]
}, {
  title: 'Compliance checklist',
  fields: [
    { name: 'identity_ready', label: 'Identity fields complete', type: 'toggle', value: false },
    { name: 'broadcast_ready', label: 'At least one broadcast channel enabled', type: 'toggle', value: true },
    { name: 'gps_ready', label: 'GPS or approved fallback configured', type: 'toggle', value: false },
    { name: 'security_reviewed', label: 'Security settings reviewed', type: 'toggle', value: false }
  ]
}])
</script>

<template>
  <DeviceConfigPage group="compliance" description="Select a region and review the mandatory Remote ID readiness checks." :sections="sections" />
</template>
