<script setup lang="ts">
import type { ConfigSection } from '~/components/device/ConfigPage.vue'
import { lockLevelOptions, sessionTimeoutOptions } from '~/config/options'

const sections: ConfigSection[] = [{
  title: 'Panel access',
  fields: [
    { name: 'password', label: 'Access password', type: 'password', placeholder: 'Leave empty to disable' },
    { name: 'timeout', label: 'Session timeout', type: 'select', value: '15', options: sessionTimeoutOptions }
  ]
}, {
  title: 'Firmware security',
  fields: [
    { name: 'lock_level', label: 'Lock level', type: 'select', value: '0', options: lockLevelOptions },
    { name: 'auth_ids', label: 'Ed25519 auth on transmitted IDs', type: 'toggle', value: false },
    { name: 'identity_gate', label: 'Identity ready gate', type: 'toggle', value: false },
    { name: 'public_keys', label: 'Public keys', type: 'textarea', placeholder: 'Paste up to five PEM or base64 public keys' }
  ]
}]
</script>

<template>
  <DeviceConfigPage group="compliance" description="Protect the configuration panel, OTA updates and transmitted identity data." :sections="sections" />
</template>
