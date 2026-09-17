<script setup lang="ts">
import { useTelemetryStore } from '~/stores/telemetry'

const telemetry = useTelemetryStore()

// Convert lon/lat to SVG coords (equirectangular), recentered so drones are visible:
// use the centroid of tracked drones; fallback to a fixed origin area.
const lonToX = (lon: number, origin: number, scale = 150) => (lon - origin) * scale + 400
const latToY = (lat: number, origin: number, scale = 150) => 200 - (lat - origin) * scale

const positioned = computed(() =>
  telemetry.devices.filter(d => d.last_location?.latitude != null && d.last_location?.longitude != null),
)

const origin = computed(() => {
  const pts = positioned.value
  if (!pts.length) return { lon: 0, lat: 0 }
  const lon = pts.reduce((a, d) => a + (d.last_location!.longitude as number), 0) / pts.length
  const lat = pts.reduce((a, d) => a + (d.last_location!.latitude as number), 0) / pts.length
  return { lon, lat }
})

const markers = computed(() => {
  const o = origin.value
  return positioned.value.map(d => ({
    mac: d.mac,
    x: lonToX(d.last_location!.longitude as number, o.lon),
    y: latToY(d.last_location!.latitude as number, o.lat),
    rssi: d.rssi_last ?? -99,
    label: d.basic_id || d.mac.slice(-8),
  }))
})

const markerColor = (rssi: number) => rssi > -70 ? '#22c55e' : rssi > -85 ? '#f97316' : '#f43f5e'
</script>

<template>
  <UCard :ui="{ body: { padding: 'p-0' } }">
    <div class="relative">
      <svg viewBox="0 0 800 400" class="map-svg">
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="0.5" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="800" height="400" fill="url(#grid)" />
        <g v-for="m in markers" :key="m.mac">
          <circle
            :cx="m.x" :cy="m.y" :r="8"
            :fill="markerColor(m.rssi)"
            fill-opacity="0.25"
          />
          <circle
            :cx="m.x" :cy="m.y" :r="4"
            :fill="markerColor(m.rssi)"
            stroke="white" stroke-width="1"
          />
          <text :x="m.x + 10" :y="m.y - 4" font-size="11" fill="#e2e8f0">{{ m.label }}</text>
        </g>
      </svg>
      <div v-if="!positioned.length" class="absolute inset-0 flex items-center justify-center">
        <p class="text-sm text-muted">Nessun dato di posizione ricevuto.</p>
      </div>
    </div>
  </UCard>
</template>