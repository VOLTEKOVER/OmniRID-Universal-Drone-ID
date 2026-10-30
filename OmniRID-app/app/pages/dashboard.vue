<script setup lang="ts">
import { useTelemetry } from '~/composables/useTelemetry'
import { useAppSettings } from '~/composables/useAppSettings'
import { useEspConnection } from '~/composables/useEspConnection'
import type { NearbyDrone } from '~/components/DroneMap.vue'

const { status } = useTelemetry()
const { settings } = useAppSettings()
const { isSimulated } = useEspConnection()
const droneMapRef = ref<any>(null)

const simNearbyState = ref({
  t: 0,
  d1: { lat: 41.9038, lon: 12.4972, vx: 0.00001, vy: 0.000008 },
  d2: { lat: 41.9018, lon: 12.4952, vx: -0.000008, vy: 0.000012 },
  d3: { lat: 41.9042, lon: 12.4950, vx: 0.000006, vy: -0.00001 }
})

const currentHashKey = () => {
  try {
    const h = window.location.hash || ''
    if (h.startsWith('#rx/detections/')) {
      return decodeURIComponent(h.split('#rx/detections/')[1]).trim()
    }
  } catch {}
  return ''
}

onMounted(() => {
  if (import.meta.client) {
    try {
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          const list = nearby.value || []
          if (!list.length) return
          e.preventDefault()
          const keys = list.map((d: any) => String(d.id || d.uas_id || d.serial_number || d.sn || d.serial || d.uav_id || d.detection_detail || ''))
          const curKey = currentHashKey()
          const cur = curKey ? keys.findIndex(k => k === curKey) : -1
          let idx = cur >= 0 ? cur : -1
          if (e.key === 'ArrowDown') idx = (idx + 1) % keys.length
          if (e.key === 'ArrowUp') idx = (idx - 1 + keys.length) % keys.length
          if (idx >= 0 && keys[idx]) {
            try { window.location.hash = `#rx/detections/${encodeURIComponent(keys[idx])}` } catch {}
          }
          return
        }
        if (e.key === 'Enter') {
          const list = nearby.value || []
          if (!list.length) return
          const keys = list.map((d: any) => String(d.id || d.uas_id || d.serial_number || d.sn || d.serial || d.uav_id || d.detection_detail || ''))
          const curKey = currentHashKey()
          if (curKey && keys.includes(curKey)) {
            e.preventDefault()
            try { window.location.hash = `#rx/detections/${encodeURIComponent(curKey)}` } catch {}
          }
        }
      }
      window.addEventListener('keydown', handler)
      onUnmounted(() => window.removeEventListener('keydown', handler))
    } catch {}
    const id = setInterval(() => {
      simNearbyState.value.t += 0.016
      const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
      const s1 = simNearbyState.value.d1
      s1.lat += s1.vx
      s1.lon += s1.vy
      if (s1.lat > 41.905 || s1.lat < 41.901) s1.vx *= -1
      if (s1.lon > 12.498 || s1.lon < 12.4945) s1.vy *= -1
      s1.vx = clamp(s1.vx + (Math.random() - 0.5) * 0.0000005, -0.000012, 0.000012)
      s1.vy = clamp(s1.vy + (Math.random() - 0.5) * 0.0000005, -0.000012, 0.000012)
      const s2 = simNearbyState.value.d2
      s2.lat += s2.vx
      s2.lon += s2.vy
      if (s2.lat > 41.905 || s2.lat < 41.901) s2.vx *= -1
      if (s2.lon > 12.498 || s2.lon < 12.4945) s2.vy *= -1
      s2.vx = clamp(s2.vx + (Math.random() - 0.5) * 0.0000006, -0.000014, 0.000014)
      s2.vy = clamp(s2.vy + (Math.random() - 0.5) * 0.0000006, -0.000014, 0.000014)
      const s3 = simNearbyState.value.d3
      s3.lat += s3.vx
      s3.lon += s3.vy
      if (s3.lat > 41.905 || s3.lat < 41.901) s3.vx *= -1
      if (s3.lon > 12.498 || s3.lon < 12.4945) s3.vy *= -1
      s3.vx = clamp(s3.vx + (Math.random() - 0.5) * 0.0000004, -0.00001, 0.00001)
      s3.vy = clamp(s3.vy + (Math.random() - 0.5) * 0.0000004, -0.00001, 0.00001)
    }, 50)
    onUnmounted(() => clearInterval(id))
  }
})

const nearby = computed<NearbyDrone[]>(() => {
  if (!isSimulated.value || settings.value.virtualConnection === 'off' || !settings.value.virtualNearbyDrones) return []
  const t = simNearbyState.value.t
  const now = new Date()
  const s1 = simNearbyState.value.d1
  const s2 = simNearbyState.value.d2
  const s3 = simNearbyState.value.d3
  const h1 = Math.round(((Math.atan2(s1.vy, s1.vx) * 180 / Math.PI) % 360 + 360) % 360)
  const h2 = Math.round(((Math.atan2(s2.vy, s2.vx) * 180 / Math.PI) % 360 + 360) % 360)
  const h3 = Math.round(((Math.atan2(s3.vy, s3.vx) * 180 / Math.PI) % 360 + 360) % 360)
  return [
    {
      id: 'sim-dji-1',
      uas_id: '1581F67PB229G0010A8F',
      serial_number: '1581F67PB229G0010A8F',
      lat: s1.lat,
      lng: s1.lon,
      altitude: 45 + Math.sin(t / 4) * 2,
      speed: Math.sqrt(s1.vx * s1.vx + s1.vy * s1.vy) * 111000,
      heading: h1,
      operator_id: '—',
      uas_operator_id: '—',
      rssi: -65,
      last_seen: now.toLocaleString(),
      last_seen_ts: Date.now(),
      first_seen: '7 Apr, 2026, 11:33:17',
      detection_detail: 'DJI Mavic 3 Classic',
      aircraft_manufacturer: 'DJI',
      aircraft_model_name: 'Mavic 3 Classic',
      transmission_technology: 'Wi-Fi Beacon',
      protocol: 'Wi-Fi Beacon',
      information_source: '1596F27A7982C4E02992 (RID Receiver)',
      sources: ['1596F27A7982C4E02992 (RID Receiver)', '1596F276A9DEA5C15A15 (RID Receiver)'],
      detected_at: 'Tuesday April 7, 2026 at 11:33',
      duration: '00:15:12',
      total_distance: '9 m',
      max_height_ato: '51 m',
      max_speed: '2 m/s',
      max_ua_operator_distance: '5 m',
      max_ua_sensor_distance: '9.72 km',
      label_and_display_color: '—'
    },
    {
      id: 'sim-autel-1',
      uas_id: 'AUTEL123456789ABC',
      serial_number: 'AUTEL123456789ABC',
      lat: s2.lat,
      lng: s2.lon,
      altitude: 38 + Math.sin(t / 5) * 3,
      speed: Math.sqrt(s2.vx * s2.vx + s2.vy * s2.vy) * 111000,
      heading: h2,
      operator_id: 'IT-OP-12345',
      uas_operator_id: 'IT-OP-12345',
      rssi: -72,
      last_seen: now.toLocaleString(),
      last_seen_ts: Date.now(),
      first_seen: now.toLocaleString(),
      detection_detail: 'Autel EVO Nano+',
      aircraft_manufacturer: 'Autel',
      aircraft_model_name: 'EVO Nano+',
      transmission_technology: 'BLE 4.x',
      protocol: 'BLE 4.x',
      information_source: '1596F276A9DEA5C15A15 (RID Receiver)',
      sources: ['1596F276A9DEA5C15A15 (RID Receiver)'],
      detected_at: now.toLocaleString(),
      duration: '00:03:24',
      total_distance: '412 m',
      max_height_ato: '38 m',
      max_speed: '8 m/s',
      max_ua_operator_distance: '24 m',
      max_ua_sensor_distance: '1.42 km',
      label_and_display_color: '—'
    },
    {
      id: 'sim-parrot-1',
      uas_id: 'PARROT987654321XYZ',
      serial_number: 'PARROT987654321XYZ',
      lat: s3.lat,
      lng: s3.lon,
      altitude: 52 + Math.sin(t / 3) * 1.5,
      speed: Math.sqrt(s3.vx * s3.vx + s3.vy * s3.vy) * 111000,
      heading: h3,
      operator_id: 'FR-OP-99887',
      uas_operator_id: 'FR-OP-99887',
      rssi: -68,
      last_seen: now.toLocaleString(),
      last_seen_ts: Date.now(),
      first_seen: now.toLocaleString(),
      detection_detail: 'Parrot Anafi',
      aircraft_manufacturer: 'Parrot',
      aircraft_model_name: 'Anafi',
      transmission_technology: 'Wi-Fi NAN',
      protocol: 'Wi-Fi NAN',
      information_source: '1596F27A7982C4E02992 (RID Receiver)',
      sources: ['1596F27A7982C4E02992 (RID Receiver)'],
      detected_at: now.toLocaleString(),
      duration: '00:07:56',
      total_distance: '876 m',
      max_height_ato: '62 m',
      max_speed: '6 m/s',
      max_ua_operator_distance: '18 m',
      max_ua_sensor_distance: '2.84 km',
      label_and_display_color: '—'
    }
  ]
})
</script>

<template>
  <UDashboardPanel
    id="monitor-dashboard"
    class="bg-default"
    :ui="{ root: 'pt-16', body: 'p-0 overflow-hidden' }"
  >
    <template #body>
      <ClientOnly>
        <DroneMap
          ref="droneMapRef"
          :status="status"
          :nearby-drones="nearby"
          :show-nearby="settings.virtualNearbyDrones && isSimulated"
          height-class="h-[calc(100svh-4rem)]"
          class="rounded-none"
        />
        <template #fallback>
          <div class="flex h-full items-center justify-center">
            <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin text-muted" />
          </div>
        </template>
      </ClientOnly>
    </template>
  </UDashboardPanel>
</template>
