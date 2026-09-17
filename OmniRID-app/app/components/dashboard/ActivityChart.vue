<script setup lang="ts">
import { useTelemetryStore } from '~/stores/telemetry'

const telemetry = useTelemetryStore()

// 60s sliding activity histogram
const buckets = computed(() => {
  const now = Date.now() / 1000
  const arr = new Array(60).fill(0)
  for (const p of telemetry.packets) {
    const age = now - p.ts
    if (age >= 0 && age < 60) arr[Math.floor(age)]++
  }
  // oldest -> newest
  return arr.reverse()
})

const maxBucket = computed(() => Math.max(1, ...buckets.value))

const svg = computed(() => {
  const w = 600, h = 80, bw = w / 60
  let out = ''
  buckets.value.forEach((v, i) => {
    const bh = (v / maxBucket.value) * (h - 6)
    const x = i * bw
    const y = h - bh
    out += `<rect x="${x}" y="${y}" width="${bw - 2}" height="${bh}" fill="#1a56db" rx="1" opacity="${0.35 + (bh / h) * 0.65}"/>`
  })
  return out
})
</script>

<template>
  <UCard :ui="{ body: { padding: 'p-4' } }">
    <div class="flex items-center justify-between mb-2">
      <span class="text-xs font-semibold uppercase tracking-wide text-muted">Attività pacchetti (60s)</span>
      <span class="text-xs font-mono text-muted">{{ telemetry.packetRate.toFixed(1) }} pkt/s</span>
    </div>
    <svg viewBox="0 0 600 80" class="w-full" preserveAspectRatio="none">
      <template v-if="telemetry.packets.length">
        <g v-html="svg" />
      </template>
    </svg>
    <p v-if="!telemetry.packets.length" class="text-xs text-muted text-center py-6">
      In attesa di dati... avvia una cattura dalla pagina Cattura.
    </p>
  </UCard>
</template>