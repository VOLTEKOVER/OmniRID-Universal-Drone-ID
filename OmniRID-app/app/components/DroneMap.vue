<script setup lang="ts">
import type { TelemetryStatus } from '~/composables/useTelemetry'
import type {
  LeafletIcon, LeafletLatLng, LeafletLayer, LeafletMap, LeafletMarker, LeafletPolyline, LeafletStatic
} from '~/types/leaflet'

export interface NearbyDrone {
  id?: string
  uas_id?: string
  uav_id?: string
  serial?: string
  lat?: number | string
  lng?: number | string
  lon?: number | string
  alt?: number | string
  altitude?: number | string
  speed?: number | string
  heading?: number | string
  operator_id?: string
  operator?: string
  registration?: string
  rssi?: number | string
  last_seen?: number | string
  source?: string
  [key: string]: unknown
}

const props = withDefaults(defineProps<{
  status?: TelemetryStatus
  heightClass?: string
  nearbyDrones?: NearbyDrone[]
  showNearby?: boolean
}>(), {
  status: () => ({}),
  heightClass: 'h-[55vh] min-h-[420px]',
  nearbyDrones: () => [],
  showNearby: true
})

const colorMode = useColorMode()

const isDark = computed(() => colorMode.value === 'dark')

const TILE_URLS = {
  dark: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  light: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'
}

const TILE_ATTRIBUTION = {
  dark: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
  light: 'Tiles &copy; Esri &mdash; Source: Esri, USGS, NOAA'
}

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
let nearbyIcon: LeafletIcon | null = null
let pathLine: LeafletPolyline | null = null
let tileLayer: LeafletLayer | null = null
const nearbyMarkers = new Map<string, LeafletMarker>()
let hasCentered = false
let loadPromise: Promise<LeafletStatic | null> | null = null
const history: LeafletLatLng[] = []

const showNearbyLayer = ref(true)
const selectedDrone = ref<NearbyDrone | null>(null)
const selectedOwn = ref(false)
const showPath = ref(true)

const toggleTheme = () => {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

const fmtNum = (v: unknown, digits = 1) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(digits) : '--'
}

const fmtInt = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n).toString() : '--'
}

const ownInfo = computed(() => {
  const s = props.status ?? {}
  const pos = currentPosition()
  return {
    lat: pos?.lat ?? Number(s.lat),
    lng: pos?.lng ?? Number(s.lon),
    alt: fmtNum(s.alt),
    altMsl: fmtNum(s.alt_msl ?? s.altitude_msl),
    speed: fmtNum(s.speed),
    vSpeed: fmtNum(s.speed_vertical ?? s.climb_rate),
    heading: Number(s.heading) || 0,
    sats: Number(s.satellites) || 0,
    fix: s.gps_valid ? 'Yes' : 'No',
    fixType: s.fix_type ?? '--',
    protocol: s.protocol ?? '--',
    standard: s.standard ?? '--',
    fw: s.fw_version ?? '--',
    uptime: s.uptime_ms ? `${Math.round(Number(s.uptime_ms) / 1000)}s` : '--',
    txTotal: fmtInt(s.tx_total),
    latRaw: Number(s.lat),
    lonRaw: Number(s.lon)
  }
})

const hasOwnPos = computed(() => currentPosition() !== null)

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
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  })
}

const buildDronePopup = (pos: LeafletLatLng): string => {
  const s = props.status ?? {}
  const fmt = (v: unknown, digits = 1) => {
    const n = Number(v)
    return Number.isFinite(n) ? n.toFixed(digits) : '--'
  }
  return [
    '<div style="min-width:150px;font-family:ui-monospace,monospace;font-size:11px;line-height:1.5">',
    '<b>My Drone</b><br>',
    `Lat ${pos.lat.toFixed(6)}<br>`,
    `Lon ${pos.lng.toFixed(6)}<br>`,
    `Alt ${fmt(s.alt)} m · Speed ${fmt(s.speed)} m/s<br>`,
    `Heading ${Number(s.heading) || 0}° · Sats ${Number(s.satellites) || 0} · Fix ${s.gps_valid ? 'Yes' : 'No'}`,
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
      const dm = droneMarker as unknown as { on?: (e: string, fn: () => void) => void }
      dm.on?.('click', () => {
        selectedOwn.value = true
        selectedDrone.value = null
      })
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
      takeoffMarker = homeIcon ? link.marker(pos, { icon: homeIcon }).addTo(map) : null
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
        color: '#3b82f6',
        weight: 4,
        opacity: 0.9,
        lineJoin: 'round',
        lineCap: 'round'
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

const nearbyKey = (d: NearbyDrone) => {
  return String(d.id ?? d.uas_id ?? d.uav_id ?? d.serial ?? `${d.lat},${d.lng}`)
}

const buildNearbyPopup = (d: NearbyDrone): string => {
  const fmt = (v: unknown, digits = 1) => {
    const n = Number(v)
    return Number.isFinite(n) ? n.toFixed(digits) : '--'
  }
  const id = d.uas_id ?? d.uav_id ?? d.serial ?? d.id ?? '--'
  const op = d.operator_id ?? d.operator ?? '--'
  const reg = d.registration ?? '--'
  const alt = d.altitude ?? d.alt
  return [
    '<div style="min-width:160px;font-family:ui-monospace,monospace;font-size:11px;line-height:1.5">',
    '<b>Nearby Remote ID</b><br>',
    `UAS ID: ${id}<br>`,
    `Operator: ${op}<br>`,
    `Reg: ${reg}<br>`,
    `Alt ${fmt(alt)} m · Speed ${fmt(d.speed)} m/s<br>`,
    `Heading ${Number(d.heading) || 0}° · RSSI ${d.rssi ?? '--'}`,
    '</div>'
  ].join('')
}

const syncNearby = () => {
  if (!link || !map || !props.showNearby) return
  const seen = new Set<string>()
  for (const d of props.nearbyDrones) {
    const lat = Number((d.lat as unknown) ?? (d as Record<string, unknown>).latitude)
    const lng = Number((d.lng as unknown) ?? (d.lon as unknown) ?? (d as Record<string, unknown>).longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue
    const key = nearbyKey(d)
    seen.add(key)
    const pos: LeafletLatLng = { lat, lng }
    if (!nearbyIcon) {
      nearbyIcon = link.divIcon({
        className: 'cd-cardiv',
        html: '<div class="cd-map-nearby"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      })
    }
    if (!nearbyMarkers.has(key)) {
      const marker = link.marker(pos, { icon: nearbyIcon }).addTo(map)
      marker.bindPopup(buildNearbyPopup(d))
      const m = marker as unknown as { on?: (e: string, fn: () => void) => void }
      m.on?.('click', () => {
        selectedDrone.value = d
        selectedOwn.value = false
      })
      nearbyMarkers.set(key, marker)
    } else {
      const marker = nearbyMarkers.get(key)!
      const mm = marker as unknown as { setLatLng?: (p: LeafletLatLng) => void }
      mm.setLatLng?.(pos)
      marker.bindPopup(buildNearbyPopup(d))
    }
  }
  for (const [key, marker] of nearbyMarkers.entries()) {
    if (!seen.has(key)) {
      map.removeLayer(marker)
      nearbyMarkers.delete(key)
    }
  }
}

const applyStatus = () => {
  if (!link || !map) return
  const pos = currentPosition()
  if (pos && showPath.value) {
    history.push(pos)
    if (history.length > MAX_HISTORY) history.shift()
  }
  syncDrone(pos)
  syncTakeoff()
  if (showPath.value) syncPath()
  else if (pathLine) {
    map.removeLayer(pathLine)
    pathLine = null
  }
  syncNearby()
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

const addTileLayer = () => {
  if (!link || !map) return
  if (tileLayer) {
    map.removeLayer(tileLayer)
    tileLayer = null
  }
  tileLayer = link.tileLayer(TILE_URLS[isDark.value ? 'dark' : 'light'], {
    maxZoom: 16,
    attribution: TILE_ATTRIBUTION[isDark.value ? 'dark' : 'light']
  }).addTo(map)
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
  addTileLayer()
  homeIcon = link.divIcon({
    className: 'cd-cardiv',
    html: '<div class="cd-map-home"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg></div>',
    iconSize: [28, 28],
    iconAnchor: [14, 14]
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
  tileLayer = null
  for (const mm of nearbyMarkers.values()) {
    const m2 = map as unknown as { removeLayer?: (l: unknown) => void } | null
    m2?.removeLayer?.(mm)
  }
  nearbyMarkers.clear()
})

watch(() => props.status, applyStatus, { deep: true })
watch(() => props.nearbyDrones, () => {
  applyStatus()
}, { deep: true })
watch(isDark, () => {
  if (mapReady.value) addTileLayer()
})
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
    <div class="pointer-events-none absolute right-3 top-3 z-[1001] flex flex-col items-end gap-2">
      <div class="pointer-events-auto flex flex-col gap-1 rounded-lg border border-default bg-default/90 p-1 shadow-md">
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          square
          :icon="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
          aria-label="Toggle map theme"
          title="Toggle map theme"
          @click="toggleTheme"
        />
        <UButton
          v-if="!loadFailed"
          color="neutral"
          variant="ghost"
          size="xs"
          square
          icon="i-lucide-locate-fixed"
          aria-label="Re-center on drone"
          title="Re-center on drone"
          @click="recenter"
        />
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          square
          :icon="showPath ? 'i-lucide-route' : 'i-lucide-route-off'"
          aria-label="Toggle flight path"
          title="Toggle flight path"
          @click="showPath = !showPath; applyStatus()"
        />
        <UButton
          v-if="props.nearbyDrones.length"
          color="neutral"
          variant="ghost"
          size="xs"
          square
          :icon="showNearbyLayer ? 'i-lucide-radar' : 'i-lucide-radar-off'"
          aria-label="Toggle nearby drones"
          title="Toggle nearby drones"
          @click="showNearbyLayer = !showNearbyLayer"
        />
      </div>
      <div
        v-if="props.nearbyDrones.length"
        class="pointer-events-auto rounded-lg border border-default bg-default/90 px-2 py-1 text-[11px] text-muted shadow-md"
      >
        {{ props.nearbyDrones.length }} nearby
      </div>
    </div>

    <div
      v-if="selectedOwn && hasOwnPos"
      class="pointer-events-auto absolute bottom-7 left-3 z-[1001] w-[min(360px,calc(100vw-1.5rem))] rounded-lg border border-default bg-default/95 shadow-xl"
    >
      <div class="flex items-center justify-between gap-2 border-b border-default px-3 py-2">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-plane" class="size-4 text-primary" />
          <p class="text-sm font-semibold text-highlighted">
            My Drone
          </p>
          <UBadge
            size="xs"
            variant="subtle"
            color="neutral"
            :label="String(ownInfo.standard)"
          />
        </div>
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-x"
          @click="selectedOwn = false"
        />
      </div>
      <div class="grid grid-cols-2 gap-2 px-3 py-2 text-xs">
        <div class="col-span-2">
          <p class="text-muted">
            Position (lat, lon)
          </p>
          <p class="font-mono text-highlighted">
            {{ ownInfo.lat.toFixed(6) }}, {{ ownInfo.lng.toFixed(6) }}
          </p>
        </div>
        <div>
          <p class="text-muted">
            Altitude
          </p>
          <p class="font-mono text-highlighted">
            {{ ownInfo.alt }} m (MSL: {{ ownInfo.altMsl }})
          </p>
        </div>
        <div>
          <p class="text-muted">
            Speed
          </p>
          <p class="font-mono text-highlighted">
            {{ ownInfo.speed }} m/s · V/S {{ ownInfo.vSpeed }}
          </p>
        </div>
        <div>
          <p class="text-muted">
            Heading / Sats
          </p>
          <p class="font-mono text-highlighted">
            {{ ownInfo.heading }}° / {{ ownInfo.sats }}
          </p>
        </div>
        <div>
          <p class="text-muted">
            GPS Fix
          </p>
          <p class="font-mono text-highlighted">
            {{ ownInfo.fix }} ({{ ownInfo.fixType }})
          </p>
        </div>
        <div>
          <p class="text-muted">
            Protocol / FW
          </p>
          <p class="truncate font-mono text-highlighted" :title="String(ownInfo.fw)">
            {{ ownInfo.protocol }} · {{ ownInfo.fw }}
          </p>
        </div>
        <div>
          <p class="text-muted">
            Uptime / TX
          </p>
          <p class="font-mono text-highlighted">
            {{ ownInfo.uptime }} · {{ ownInfo.txTotal }}
          </p>
        </div>
      </div>
    </div>

    <div
      v-if="selectedDrone"
      class="pointer-events-auto absolute bottom-7 left-3 z-[1001] w-[min(340px,calc(100vw-1.5rem))] rounded-lg border border-default bg-default/95 shadow-xl"
    >
      <div class="flex items-center justify-between gap-2 border-b border-default px-3 py-2">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-radio" class="size-4 text-warning" />
          <p class="text-sm font-semibold text-highlighted">
            Nearby Drone
          </p>
        </div>
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-x"
          @click="selectedDrone = null"
        />
      </div>
      <div class="grid grid-cols-2 gap-2 px-3 py-2 text-xs">
        <div class="col-span-2">
          <p class="text-muted">
            UAS ID
          </p>
          <p class="break-all font-mono text-highlighted">
            {{ selectedDrone.uas_id ?? selectedDrone.uav_id ?? selectedDrone.serial ?? selectedDrone.id ?? '--' }}
          </p>
        </div>
        <div>
          <p class="text-muted">
            Operator
          </p>
          <p class="break-all font-mono text-highlighted">
            {{ selectedDrone.operator_id ?? selectedDrone.operator ?? '--' }}
          </p>
        </div>
        <div>
          <p class="text-muted">
            Registration
          </p>
          <p class="break-all font-mono text-highlighted">
            {{ selectedDrone.registration ?? '--' }}
          </p>
        </div>
        <div>
          <p class="text-muted">
            Position
          </p>
          <p class="font-mono text-highlighted">
            {{ Number((selectedDrone.lat as unknown) ?? (selectedDrone as Record<string, unknown>).latitude).toFixed(5) }}, {{ Number((selectedDrone.lng as unknown) ?? (selectedDrone.lon as unknown) ?? (selectedDrone as Record<string, unknown>).longitude).toFixed(5) }}
          </p>
        </div>
        <div>
          <p class="text-muted">
            Alt / Speed
          </p>
          <p class="font-mono text-highlighted">
            {{ selectedDrone.altitude ?? selectedDrone.alt ?? '--' }} m / {{ selectedDrone.speed ?? '--' }} m/s
          </p>
        </div>
        <div>
          <p class="text-muted">
            Heading
          </p>
          <p class="font-mono text-highlighted">
            {{ selectedDrone.heading ?? '--' }}°
          </p>
        </div>
        <div>
          <p class="text-muted">
            RSSI / Last seen
          </p>
          <p class="font-mono text-highlighted">
            {{ selectedDrone.rssi ?? '--' }} / {{ selectedDrone.last_seen ?? '--' }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
[data-drone-map] .leaflet-container {
  width: 100%;
  height: 100%;
  font: inherit;
  background: #06090d;
}

[data-drone-map] .leaflet-tile-pane {
  filter: none;
}

[data-drone-map] .leaflet-attribution-flag {
  display: none !important;
}

.cd-map-nearby {
  width: 14px;
  height: 14px;
  border-radius: 9999px;
  background: radial-gradient(circle, #f59e0b, #d97706);
  border: 2px solid #fcd34d;
  box-shadow: 0 0 0 3px rgb(245 158 11 / 25%), 0 1px 6px rgb(0 0 0 / 60%);
  cursor: pointer;
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
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 30%, #93c5fd 0%, #2563eb 55%, #1e40af 100%);
  border: 2px solid #dbeafe;
  box-shadow: 0 0 0 4px rgb(37 99 235 / 28%), 0 4px 12px rgb(15 23 42 / 70%);
  transition: transform 0.3s ease;
}

.cd-map-drone::before {
  content: '';
  position: absolute;
  left: 50%;
  top: -14px;
  width: 2px;
  height: 10px;
  margin-left: -1px;
  background: linear-gradient(180deg, #bfdbfe 0%, #2563eb 100%);
  border-radius: 2px;
}

.cd-map-drone::after {
  content: '';
  position: absolute;
  left: 50%;
  top: -18px;
  width: 0;
  height: 0;
  margin-left: -5px;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 10px solid #bfdbfe;
  filter: drop-shadow(0 -1px 2px rgb(37 99 235 / 40%));
}

.cd-map-home {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 30%, #86efac 0%, #22c55e 55%, #15803d 100%);
  color: #f0fdf4;
  border: 2px solid #dcfce7;
  box-shadow: 0 0 0 4px rgb(34 197 94 / 24%), 0 4px 12px rgb(15 23 42 / 65%);
}
</style>
