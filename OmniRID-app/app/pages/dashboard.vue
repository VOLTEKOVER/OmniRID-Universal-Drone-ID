<script setup lang="ts">
import type { NearbyDrone } from '~/components/DroneMap.vue'
import { useAppSettings } from '~/composables/useAppSettings'
import { useEspConnection } from '~/composables/useEspConnection'
import { useTelemetry } from '~/composables/useTelemetry'

interface CityCenter {
  lat: number
  lng: number
}

interface GeocodingResult {
  lat: string
  lon: string
  display_name: string
}

const { settings, loaded } = useAppSettings()
const { configAuthenticated } = useEspConnection()
const { status: telemetryStatus } = useTelemetry()
const detections = ref<NearbyDrone[]>([])
const cityCenter = ref<CityCenter | null>(null)
const cityError = ref('')
const resolvingCity = ref(false)
const isDevelopment = import.meta.dev
const isVirtualConnectionActive = computed(() => settings.value.virtualConnection !== 'off')
const ownDroneEnabled = computed(() => (
  (isDevelopment && isVirtualConnectionActive.value && cityCenter.value !== null)
  || configAuthenticated.value
))
const simulationStep = ref(0)
const ownDroneStatus = computed(() => {
  const status = { ...telemetryStatus.value }
  if (!isDevelopment || !isVirtualConnectionActive.value || !cityCenter.value) return status
  const angle = simulationStep.value * 0.06
  const position = {
    lat: cityCenter.value.lat + Math.sin(angle) * 0.0007,
    lng: cityCenter.value.lng + Math.cos(angle) * 0.0007 * Math.cos(cityCenter.value.lat * Math.PI / 180)
  }
  return {
    ...status,
    gps_valid: true,
    lat: position.lat,
    lon: position.lng,
    takeoff_captured: true,
    takeoff_lat: cityCenter.value.lat,
    takeoff_lon: cityCenter.value.lng,
    detection_detail: 'Virtual TX drone',
    aircraft_manufacturer: 'OmniRID',
    aircraft_model_name: 'Virtual transmitter'
  }
})
let geocodeController: AbortController | null = null
let simulationInterval: ReturnType<typeof setInterval> | null = null
let simulationStartedAt = 0
const simulatedTracks = new Map<number, CityCenter[]>()
const SIMULATED_DRONES = [
  { id: 'DEV-RID-001', model: 'Quadcopter', manufacturer: 'Demo Aviation', operatorId: 'DEMO-OP-001', radius: 0.0014, altitude: 48, speed: 5.2, heading: 35, rssi: -48 },
  { id: 'DEV-RID-002', model: 'Fixed-wing UAV', manufacturer: 'Demo Robotics', operatorId: 'DEMO-OP-002', radius: 0.0022, altitude: 92, speed: 12.4, heading: 118, rssi: -61 },
  { id: 'DEV-RID-003', model: 'Camera drone', manufacturer: 'Sample Dynamics', operatorId: 'DEMO-OP-003', radius: 0.003, altitude: 65, speed: 3.8, heading: 205, rssi: -72 },
  { id: 'DEV-RID-004', model: 'Survey UAV', manufacturer: 'Demo Aviation', operatorId: 'DEMO-OP-004', radius: 0.004, altitude: 120, speed: 8.6, heading: 287, rssi: -55 }
] as const
const MAX_SIMULATED_TRACK_POINTS = 40

const routePoint = (center: CityCenter, index: number, step: number): CityCenter => {
  const drone = SIMULATED_DRONES[index]!
  const angle = step * 0.11 + index * 1.57
  return {
    lat: center.lat + Math.sin(angle) * drone.radius,
    lng: center.lng + Math.cos(angle) * drone.radius * Math.cos(center.lat * Math.PI / 180)
  }
}

const updateSimulatedDetections = () => {
  const center = cityCenter.value
  if (!center || !isDevelopment || !isVirtualConnectionActive.value || !settings.value.virtualNearbyDrones) {
    detections.value = []
    simulatedTracks.clear()
    return
  }

  if (!simulationStartedAt) {
    simulationStartedAt = Date.now()
    SIMULATED_DRONES.forEach((_, index) => {
      simulatedTracks.set(index, Array.from({ length: 24 }, (_, point) =>
        routePoint(center, index, point - 24)
      ))
    })
  }

  const elapsedSteps = Math.floor((Date.now() - simulationStartedAt) / 1500)
  const lastSeen = Date.now()
  detections.value = SIMULATED_DRONES.map((drone, index) => {
    const track = simulatedTracks.get(index) ?? []
    const position = routePoint(center, index, elapsedSteps)
    if (!track.length || track[track.length - 1]!.lat !== position.lat || track[track.length - 1]!.lng !== position.lng) {
      track.push(position)
    }
    if (track.length > MAX_SIMULATED_TRACK_POINTS) track.splice(0, track.length - MAX_SIMULATED_TRACK_POINTS)
    simulatedTracks.set(index, track)

    return {
      id: drone.id,
      uas_id: drone.id,
      lat: position.lat,
      lng: position.lng,
      altitude: drone.altitude,
      speed: drone.speed,
      heading: (drone.heading + elapsedSteps * 5) % 360,
      rssi: drone.rssi,
      uas_operator_id: drone.operatorId,
      operator_id: drone.operatorId,
      last_seen: new Date(lastSeen).toISOString(),
      last_seen_ts: lastSeen,
      first_seen: simulationStartedAt,
      detected_at: new Date(lastSeen).toISOString(),
      source: 'Development simulator',
      protocol: 'ASTM F3411',
      aircraft_model_name: drone.model,
      aircraft_manufacturer: drone.manufacturer,
      detection_detail: `${drone.manufacturer} ${drone.model} (simulated)`,
      track: [...track]
    }
  })
}

const resolveDefaultCity = async (city: string) => {
  geocodeController?.abort()
  geocodeController = null
  cityError.value = ''
  cityCenter.value = null
  simulatedTracks.clear()
  simulationStartedAt = 0
  detections.value = []
  const query = city.trim()
  if (!query) {
    resolvingCity.value = false
    updateSimulatedDetections()
    return
  }

  const controller = new AbortController()
  geocodeController = controller
  resolvingCity.value = true
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('limit', '1')
    url.searchParams.set('q', query)
    const response = await fetch(url, {
      signal: controller.signal,
      referrerPolicy: 'strict-origin-when-cross-origin'
    })
    if (!response.ok) throw new Error(`City lookup failed (HTTP ${response.status}).`)
    const results = await response.json() as GeocodingResult[]
    const result = results[0]
    if (!result) throw new Error(`No city found for “${query}”.`)
    const lat = Number(result.lat)
    const lng = Number(result.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('The city lookup returned invalid coordinates.')
    cityCenter.value = { lat, lng }
    updateSimulatedDetections()
  } catch (error) {
    if (controller.signal.aborted) return
    cityError.value = error instanceof Error ? error.message : 'Unable to find that city.'
  } finally {
    if (geocodeController === controller) {
      geocodeController = null
      resolvingCity.value = false
    }
  }
}

watch(
  [() => loaded.value, () => settings.value.defaultCity],
  ([isLoaded, city]) => {
    if (isLoaded) void resolveDefaultCity(city)
  },
  { immediate: true }
)

watch(
  [() => settings.value.virtualNearbyDrones, () => settings.value.virtualConnection],
  updateSimulatedDetections
)

onMounted(() => {
  simulationInterval = setInterval(() => {
    simulationStep.value += 1
    updateSimulatedDetections()
  }, 1500)
})

onBeforeUnmount(() => {
  geocodeController?.abort()
  if (simulationInterval) clearInterval(simulationInterval)
})
</script>

<template>
  <UDashboardPanel
    id="monitor-dashboard"
    class="bg-default"
    :ui="{ root: 'pt-16', body: 'p-0 overflow-hidden' }"
  >
    <template #body>
      <div class="relative">
        <ClientOnly>
          <DroneMap
            :nearby-drones="detections"
            :status="ownDroneStatus"
            :own-drone-enabled="ownDroneEnabled"
            :initial-center="cityCenter"
            height-class="h-[calc(100svh-4rem)]"
            class="rounded-none"
          />
          <template #fallback>
            <div class="flex h-full items-center justify-center">
              <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin text-muted" />
            </div>
          </template>
        </ClientOnly>
        <div
          v-if="isDevelopment && isVirtualConnectionActive && settings.virtualNearbyDrones"
          class="pointer-events-none absolute bottom-10 right-3 z-[1001] max-w-[min(22rem,calc(100vw-5rem))] rounded-lg border border-white/20 bg-black/90 px-3 py-2 text-right text-white shadow-lg"
          role="status"
        >
          <p class="text-[11px] font-semibold uppercase tracking-wide text-white">
            Development · Simulated Remote ID
          </p>
          <p class="mt-0.5 truncate text-xs text-white/75">
            {{ resolvingCity ? 'Locating default city…' : settings.defaultCity || 'Choose a default city in settings' }}
          </p>
          <p v-if="cityError" class="mt-1 text-xs text-white">
            {{ cityError }}
          </p>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
