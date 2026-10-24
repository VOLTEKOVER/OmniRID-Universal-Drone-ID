<script setup lang="ts">
import type { TelemetryStatus } from '~/composables/useTelemetry'
import type {
  LeafletIcon, LeafletLatLng, LeafletMap, LeafletMarker, LeafletPolyline, LeafletStatic
} from '~/types/leaflet'

const props = withDefaults(defineProps<{
  status?: TelemetryStatus
  heightClass?: string
}>(), {
  status: () => ({}),
  heightClass: 'h-[55vh] min-h-[420px]'
})

const LOCAL_JS = '/vendor/leaflet/leaflet.js'
const LOCAL_CSS = '/vendor/leaflet/leaflet.css'
const CDN_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
const CDN_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const MAX_HISTORY = 300

const mapEl = ref<HTMLDivElement | null>(null)
const follow = ref(true)
const loading = ref(true)
const mapReady = ref(false)
const loadFailed = ref(false)

let link: LeafletStatic | null = null
let map: LeafletMap | null = null
let droneMarker: LeafletMarker | null = null
let takeoffMarker: LeafletMarker | null = null
let homeIcon: LeafletIcon | null = null
let pathLine: LeafletPolyline | null = null
let hasCentered = false
let loadPromise: Promise<LeafletStatic | null> | null = null
const history: LeafletLatLng[] = []

const currentPosition = (): LeafletLatLng | null => {
  const s = props.status ?? {}
  if (!s.gps_valid) return null
  const lat = Number(s.lat)
  const lon = Number(s.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (lat === 0 && lon === 0) return null
  return { lat, lng: lon }
}

const injectScript = (src: string): Promise<boolean> => new Promise((resolve) => {
  const script = document.createElement('script')
  script.src = src
  script.async = true
  script.onload = () => resolve(true)
  script.onerror = () => resolve(false)
  document.head.appendChild(script)
})

const ensureLeaflet = (): Promise<LeafletStatic | null> => {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.L) return Promise.resolve(window.L)
  if (!loadPromise) {
    loadPromise = (async () => {
      const w = window as Window & typeof globalThis
      try {
        const localCss = document.createElement('link')
        localCss.rel = 'stylesheet'
        localCss.href = LOCAL_CSS
        document.head.appendChild(localCss)

        const localOk = await injectScript(LOCAL_JS)
        if (!w.L && !localOk) {
          const cdnCss = document.createElement('link')
          cdnCss.rel = 'stylesheet'
          cdnCss.href = CDN_CSS
          document.head.appendChild(cdnCss)
          await injectScript(CDN_JS)
        }
        if (!w.L) {
          loadFailed.value = true
          loading.value = false
          return null
        }
        loading.value = false
        return w.L
      } catch {
        loadFailed.value = true
        loading.value = false
        return null
      }
    })()
  }
  return loadPromise
}

const makeDroneIcon = (rotation: number): LeafletIcon | null => {
  if (!link) return null
  const deg = Number.isFinite(rotation) ? Math.round(((rotation % 360) + 360) % 360) : 0
  return link.divIcon({
    className: 'cd-cardiv',
    html: `<div class="cd-map-drone" style="transform: rotate(${deg}deg)"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  })
}

const buildDronePopup = (pos: LeafletLatLng): string => {
  const s = props.status ?? {}
  const fmt = (v: unknown, digits = 1) => {
    const n = Number(v)
    return Number.isFinite(n) ? n.toFixed(digits) : '--'
  }
  return [
    '<div style="min-width:150px;font-family:ui-monospace,monospace;font-size:12px;line-height:1.5">',
    `<b>Drone</b><br>`,
    `Lat ${pos.lat.toFixed(6)}<br>`,
    `Lon ${pos.lng.toFixed(6)}<br>`,
    `Alt ${fmt(s.alt)} m · Speed ${fmt(s.speed)} m/s<br>`,
    `Heading ${Number(s.heading) || 0}° · Sats ${Number(s.satellites) || 0}`,
    '</div>'
  ].join('')
}

const buildHomePopup = (pos: LeafletLatLng): string => {
  const s = props.status ?? {}
  const fmt = (v: unknown, digits = 1) => {
    const n = Number(v)
    return Number.isFinite(n) ? n.toFixed(digits) : '--'
  }
  return [
    '<div style="min-width:150px;font-family:ui-monospace,monospace;font-size:12px;line-height:1.5">',
    '<b>Take-off</b><br>',
    `Lat ${pos.lat.toFixed(6)}<br>`,
    `Lon ${pos.lng.toFixed(6)}<br>`,
    `Alt ${fmt(s.takeoff_alt)} m`,
    '</div>'
  ].join('')
}

const syncDrone = (pos: LeafletLatLng | null) => {
  if (!link || !map) return
  if (pos) {
    const icon = makeDroneIcon(Number(props.status?.heading ?? 0))
    if (!icon) return
    if (!droneMarker) {
      droneMarker = link.marker(pos, { icon }).addTo(map)
    } else {
      droneMarker.setLatLng(pos)
      droneMarker.setIcon(icon)
    }
    droneMarker.bindPopup(buildDronePopup(pos))
    return
  }
  if (droneMarker) {
    map.removeLayer(droneMarker)
    droneMarker = null
  }
}

const syncTakeoff = () => {
  if (!link || !map) return
  const s = props.status ?? {}
  const lat = Number(s.takeoff_lat)
  const lon = Number(s.takeoff_lon)
  const captured = !!s.takeoff_captured && Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0)
  if (captured) {
    const pos: LeafletLatLng = { lat, lng: lon }
    if (!takeoffMarker) {
      takeoffMarker = homeIcon ? link.marker(pos, { icon: homeIcon, interactive: false }).addTo(map) : null
      if (!takeoffMarker) return
      takeoffMarker.bindPopup(buildHomePopup(pos))
    } else {
      takeoffMarker.setLatLng(pos)
      takeoffMarker.bindPopup(buildHomePopup(pos))
    }
    return
  }
  if (takeoffMarker) {
    map.removeLayer(takeoffMarker)
    takeoffMarker = null
  }
}

const syncPath = () => {
  if (!link || !map) return
  if (history.length >= 2) {
    const points = [...history]
    if (!pathLine) {
      pathLine = link.polyline(points, {
        color: '#4d9dff', weight: 3, opacity: 0.85, lineJoin: 'round'
      }).addTo(map)
    } else {
      pathLine.setLatLngs(points)
    }
    return
  }
  if (pathLine) {
    map.removeLayer(pathLine)
    pathLine = null
  }
}

const applyStatus = () => {
  if (!link || !map) return
  const pos = currentPosition()
  if (pos) {
    history.push(pos)
    if (history.length > MAX_HISTORY) history.shift()
  }
  syncDrone(pos)
  syncTakeoff()
  syncPath()
  if (pos) {
    if (!hasCentered) {
      map.setView(pos, 16)
      hasCentered = true
    } else if (follow.value) {
      map.panTo(pos, { animate: false })
    }
  }
}

const recenter = () => {
  if (!map) return
  follow.value = true
  const pos = currentPosition()
  if (pos) map.setView(pos, 16)
}

onMounted(async () => {
  if (import.meta.server || !mapEl.value) return
  link = await ensureLeaflet()
  if (!link || !mapEl.value) return
  const pos = currentPosition()
  map = link.map(mapEl.value, {
    center: pos ? link.latLng(pos.lat, pos.lng) : link.latLng(0, 0),
    zoom: pos ? 16 : 2,
    zoomControl: true,
    attributionControl: true
  })
  mapReady.value = true
  link.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map)
  homeIcon = link.divIcon({
    className: 'cd-cardiv',
    html: '<div class="cd-map-home">H</div>',
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  })
  map.on('dragstart', () => {
    follow.value = false
  })
  mapEl.value.addEventListener('wheel', () => {
    follow.value = false
  }, { passive: true })
  applyStatus()
  requestAnimationFrame(() => map?.invalidateSize())
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
  droneMarker = null
  takeoffMarker = null
  pathLine = null
})

watch(() => props.status, applyStatus, { deep: true })
</script>

<template>
  <div class="relative w-full overflow-hidden bg-elevated" :class="[heightClass, $attrs.class]" data-drone-map>
    <div ref="mapEl" class="h-full w-full" />
    <div
      v-if="loading && !loadFailed"
      class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
      <p class="text-sm text-muted">
        Loading map…
      </p>
    </div>
    <div
      v-if="!loading && !loadFailed && mapReady && !currentPosition()"
      class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center"
    >
      <UIcon name="i-lucide-crosshair" class="size-6 text-muted" />
      <p class="text-sm font-medium text-muted">
        Waiting for GPS fix…
      </p>
      <p class="text-xs text-muted/80">
        The live position will appear here. Connect the ESP or enable the simulation.
      </p>
    </div>
    <div
      v-if="loadFailed"
      class="absolute inset-0 z-[1002] flex flex-col items-center justify-center gap-3 bg-elevated p-6 text-center"
    >
      <UIcon name="i-lucide-triangle-alert" class="size-6 text-warning" />
      <p class="text-sm text-muted">
        Unable to load the map. Check the connection and try again.
      </p>
    </div>
    <button
      v-if="!loadFailed"
      type="button"
      aria-label="Re-center on drone"
      title="Re-center on drone"
      class="pointer-events-auto absolute bottom-7 right-3 z-[1001] flex size-9 items-center justify-center rounded-md border border-default bg-default/90 text-highlighted shadow-md transition hover:bg-elevated"
      @click="recenter"
    >
      <UIcon name="i-lucide-locate-fixed" class="size-4" />
    </button>
  </div>
</template>

<style>
[data-drone-map] .leaflet-container {
  width: 100%;
  height: 100%;
  font: inherit;
  background: #06090d;
}

[data-drone-map] .leaflet-popup-content-wrapper {
  border-radius: 0.375rem;
  border: 1px solid #1a242f;
  background: #0d1219;
  color: #e8ecf6;
}

[data-drone-map] .leaflet-popup-tip {
  background: #0d1219;
}

[data-drone-map] .leaflet-popup-content {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
}

[data-drone-map] .leaflet-control-attribution {
  background: rgb(6 9 13 / 75%);
  color: #9aa3b5;
  font-size: 10px;
}

[data-drone-map] .leaflet-control-attribution a {
  color: #7dd3fc;
}

.cd-cardiv {
  background: transparent;
  border: none;
}

.cd-map-drone {
  position: relative;
  width: 22px;
  height: 22px;
  border-radius: 9999px;
  background: radial-gradient(circle at 35% 35%, #bcd8ff, #4d9dff 55%, #1c6fd6);
  border: 2px solid #dbe9ff;
  box-shadow: 0 0 0 4px rgb(77 157 255 / 35%), 0 2px 8px rgb(0 0 0 / 55%);
  transition: transform 0.45s ease;
}

.cd-map-drone::after {
  content: '';
  position: absolute;
  top: -8px;
  left: 50%;
  margin-left: -4px;
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-bottom: 9px solid #dbe9ff;
}

.cd-map-home {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 9999px;
  background: rgb(16 185 129 / 92%);
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  border: 2px solid #d1fae5;
  box-shadow: 0 0 0 4px rgb(16 185 129 / 25%), 0 2px 8px rgb(0 0 0 / 55%);
}
</style>
