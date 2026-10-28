<template>
  <UTooltip :text="tooltip">
    <div class="flex items-center gap-1.5">
      <span class="relative flex size-2">
        <span v-if="active" class="absolute inline-flex size-full animate-ping rounded-full opacity-75" :class="color" />
        <span class="relative inline-flex size-2 rounded-full" :class="color" />
      </span>
      <span class="hidden text-xs text-muted lg:inline">{{ label }}</span>
    </div>
  </UTooltip>
</template>

<script setup lang="ts">
import { useEspConnection } from '~/composables/useEspConnection'
import { useTelemetry } from '~/composables/useTelemetry'

const { isEspConnected, isChecking } = useEspConnection()
const { status } = useTelemetry()

const active = computed(() => isEspConnected.value && !isChecking.value)
const gpsOk = computed(() => status.value.gps_valid === true)
const txOk = computed(() => (Number(status.value.tx_total) || 0) > 0 || (Number(status.value.uptime_ms) || 0) > 0)

const color = computed(() => {
  if (!active.value) return 'bg-red-500'
  if (gpsOk.value && txOk.value) return 'bg-emerald-500'
  if (gpsOk.value || txOk.value) return 'bg-amber-500'
  return 'bg-blue-500'
})

const label = computed(() => {
  if (isChecking.value) return 'Checking'
  if (!isEspConnected.value) return 'Offline'
  if (gpsOk.value && txOk.value) return 'OK'
  if (gpsOk.value) return 'GPS'
  if (txOk.value) return 'TX'
  return 'Connected'
})

const tooltip = computed(() => {
  if (isChecking.value) return 'Checking connection...'
  if (!isEspConnected.value) return 'Device offline'
  const parts = []
  parts.push(`GPS: ${gpsOk.value ? 'OK' : 'No fix'}`)
  parts.push(`TX: ${(Number(status.value.tx_total) || 0)} packets`)
  parts.push(`Uptime: ${status.value.uptime_ms ? Math.floor(Number(status.value.uptime_ms)/1000) + 's' : '—'}`)
  return parts.join(' | ')
})
</script>
