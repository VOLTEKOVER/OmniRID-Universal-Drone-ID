<script setup lang="ts">
import type { TelemetryStatus } from '~/composables/useTelemetry'
import type {
  LeafletGeoJSONLayer,
  LeafletIcon,
  LeafletLatLng,
  LeafletLayer,
  LeafletMap,
  LeafletMarker,
  LeafletMarkerCluster,
  LeafletPolyline,
  LeafletStatic
} from '~/types/leaflet'

export interface NearbyDrone {
  id?: string
  uas_id?: string
  uav_id?: string
  serial?: string
  serial_number?: string
  sn?: string
  lat?: number | string
  lng?: number | string
  lon?: number | string
  latitude?: number | string
  longitude?: number | string
  alt?: number | string
  altitude?: number | string
  speed?: number | string
  heading?: number | string
  operator_id?: string
  uas_operator_id?: string
  operator?: string
  registration?: string
  rssi?: number | string
  last_seen?: number | string
  last_seen_ts?: number | string
  first_seen?: number | string
  source?: string
  sources?: Array<string | Record<string, unknown>>
  information_source?: string | Array<string | Record<string, unknown>>
  transmission_technology?: string
  protocol?: string
  tech?: string
  detection_detail?: string
  aircraft_model?: string
  aircraft_model_name?: string
  aircraft_manufacturer?: string
  manufacturer?: string
  model?: string
  detected_at?: string | number
  detected?: string
  detected_time?: string
  duration?: string
  flight_duration?: string
  total_distance?: string | number
  distance_total?: string | number
  max_height_ato?: string | number
  max_height?: string | number
  height_ato?: string | number
  max_speed?: string | number
  max_ua_operator_dist?: string | number
  max_ua_operator_distance?: string | number
  ua_operator_distance?: string | number
  max_ua_sensor_dist?: string | number
  max_ua_sensor_distance?: string | number
  ua_sensor_distance?: string | number
  label?: string
  label_and_display_color?: string
  display_color?: string
  color?: string
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
const LOCAL_TILE_FALLBACK = '/tiles/{z}/{x}/{y}.png'

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
let nearbyCluster: LeafletMarkerCluster | null = null
let airspaceLayer: LeafletGeoJSONLayer | null = null
let airspaceLastFetch = 0
const airspaceFetchTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
const nearbyPaths = new Map<string, LeafletPolyline>()
let hasCentered = false
let loadPromise: Promise<LeafletStatic | null> | null = null
const history: LeafletLatLng[] = []
const nearbyHistory = new Map<string, LeafletLatLng[]>()

const showNearbyLayer = ref(true)
const showNearbyPanel = ref(true)
const nearbyFilter = ref<'all' | 'live' | 'unseen'>('all')
const nearbySort = ref<'last_seen' | 'rssi' | 'distance'>('last_seen')
const showAirspace = ref(false)
const selectedDrone = ref<NearbyDrone | null>(null)
const seenKey = 'omnirid:nearby-seen'
const seenSet = ref<Set<string>>(new Set())

const loadSeen = () => {
  if (!import.meta.client) return
  try {
    const raw = localStorage.getItem(seenKey)
    if (!raw) return
    const arr = JSON.parse(raw) as string[]
    if (Array.isArray(arr)) seenSet.value = new Set(arr.filter(Boolean))
  } catch {
    /* corrupt or unavailable storage: start with an empty set */
    seenSet.value = new Set()
  }
}

const saveSeen = () => {
  if (!import.meta.client) return
  try {
    localStorage.setItem(seenKey, JSON.stringify(Array.from(seenSet.value)))
  } catch {
    /* storage full or disabled; "seen" state is best-effort */
  }
}

const droneKey = (d: NearbyDrone | null | undefined) => {
  if (!d) return ''
  return String(d.id || d.uas_id || d.serial_number || d.sn || d.serial || d.uav_id || d.detection_detail || '')
}

const isSeen = (d: NearbyDrone | null | undefined) => {
  const k = droneKey(d)
  if (!k) return false
  return seenSet.value.has(k)
}

const findNearbyById = (id: string): NearbyDrone | undefined => {
  const list = Array.isArray(props.nearbyDrones) ? props.nearbyDrones : []
  return list.find(d => droneKey(d) === id)
}

onMounted(() => {
  loadSeen()
  if (import.meta.client) {
    try {
      const checkHash = () => {
        const h = window.location.hash || ''
        if (!h.startsWith('#rx/detections/')) return
        const id = decodeURIComponent(h.split('#rx/detections/')[1] ?? '').trim()
        if (!id) return
        const found = findNearbyById(id)
        if (found) {
          selectedDrone.value = found
          selectedOwn.value = false
        }
      }
      checkHash()
      window.addEventListener('hashchange', checkHash)
      onUnmounted(() => window.removeEventListener('hashchange', checkHash))
    } catch {
      /* malformed hash, ignore */
    }
  }
})
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

const appendStylesheet = (href: string) => {
  const el = document.createElement('link')
  el.rel = 'stylesheet'
  el.href = href
  document.head.appendChild(el)
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
  if (!loadPromise) {
    loadPromise = (async () => {
      const w = window as Window & typeof globalThis
      try {
        if (!w.L) {
          appendStylesheet(LOCAL_CSS)
          const localOk = await injectScript(LOCAL_JS)
          if (!w.L && !localOk) {
            appendStylesheet(CDN_CSS)
            await injectScript(CDN_JS)
          }
        }
        if (!w.L) {
          loadFailed.value = true
          loading.value = false
          return null
        }
        // Make L global for the plugins, which expect `window.L`.
        window.L = w.L
        // Marker cluster is optional: on failure the plain-marker path is used.
        try {
          if (!document.querySelector('link[href="/vendor/leaflet/cluster/MarkerCluster.css"]')) {
            appendStylesheet('/vendor/leaflet/cluster/MarkerCluster.css')
          }
          if (!document.querySelector('link[href="/vendor/leaflet/cluster/MarkerCluster.Default.css"]')) {
            appendStylesheet('/vendor/leaflet/cluster/MarkerCluster.Default.css')
          }
          if (typeof w.L.markerClusterGroup !== 'function') {
            await injectScript('/vendor/leaflet/cluster/leaflet.markercluster.js')
          }
        } catch {
          /* cluster plugin unavailable, fall back to individual markers */
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

const makeDroneIcon = (rotation: number, isOwn = true): LeafletIcon | null => {
  if (!link) return null
  const deg = Number.isFinite(rotation) ? Math.round(((rotation % 360) + 360) % 360) : 0
  return link.divIcon({
    className: 'cd-cardiv',
    html: `<div class="cd-map-drone" style="transform: rotate(${deg}deg); ${isOwn ? '' : 'filter: hue-rotate(200deg);'}"></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  })
}

const buildDronePopup = (): string => {
  const s = props.status ?? {}
  const model = s.aircraft_model_name ?? s.aircraft_model ?? s.model ?? ''
  const manu = s.aircraft_manufacturer ?? s.manufacturer ?? ''
  const det = String(s.detection_detail || `${manu} ${model}`.trim() || 'My Drone')
  return [
    '<div style="font-family:ui-monospace,monospace;font-size:11px;line-height:1.4;max-width:160px">',
    `<b>${det.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</b>`,
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
    const icon = makeDroneIcon(Number(props.status?.heading ?? 0), true)
    if (!icon) return
    if (!droneMarker) {
      droneMarker = link.marker(pos, { icon }).addTo(map)
      droneMarker.on?.('click', () => {
        selectedOwn.value = true
        selectedDrone.value = null
      })
    } else {
      droneMarker.setLatLng(pos)
      droneMarker.setIcon(icon)
    }
    droneMarker.bindPopup(buildDronePopup())
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
  return String(d.id ?? d.uas_id ?? d.uav_id ?? d.serial ?? d.serial_number ?? d.sn ?? `${d.lat},${d.lng}`)
}

const toTimestamp = (raw: unknown): number | null => {
  let ts: number
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw)
    ts = Number.isNaN(parsed) ? Number.NaN : parsed
  } else {
    ts = Number(raw)
  }
  return Number.isFinite(ts) ? ts : null
}

const isLiveDrone = (d: NearbyDrone) => {
  const ts = toTimestamp(d.last_seen_ts ?? d.last_seen)
  if (ts === null) return false
  const diff = Date.now() - ts
  return diff >= 0 && diff < 60000
}

const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371000
  const toRad = (x: number) => x * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const bearing = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const toRad = (x: number) => x * Math.PI / 180
  const toDeg = (x: number) => x * 180 / Math.PI
  const dLon = toRad(lon2 - lon1)
  const y = Math.sin(dLon) * Math.cos(toRad(lat2))
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon)
  let brng = toDeg(Math.atan2(y, x))
  brng = (brng + 360) % 360
  return brng
}

const getOwnPos = () => {
  const s = props.status ?? {}
  if (!s.gps_valid) return null
  const lat = Number(s.lat)
  const lon = Number(s.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) return null
  return { lat, lng: lon }
}

const sortedFilteredNearby = computed(() => {
  let list = (props.nearbyDrones || []).slice()
  if (nearbyFilter.value === 'live') list = list.filter(d => isLiveDrone(d))
  if (nearbyFilter.value === 'unseen') list = list.filter(d => !isSeen(d))
  const own = getOwnPos()
  if (own) {
    list = list.map((d) => {
      const lat = Number(d.lat ?? d.latitude)
      const lon = Number(d.lng ?? d.lon ?? d.longitude)
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        const dist = haversine(own.lat, own.lng, lat, lon)
        const brng = bearing(own.lat, own.lng, lat, lon)
        return { ...d, _dist_m: Math.round(dist), _bearing: Math.round(brng) }
      }
      return d
    })
  }
  list.sort((a, b) => {
    if (nearbySort.value === 'rssi') {
      const ra = Number(a.rssi)
      const rb = Number(b.rssi)
      const na = Number.isFinite(ra) ? ra : -999
      const nb = Number.isFinite(rb) ? rb : -999
      return nb - na
    }
    if (nearbySort.value === 'distance') {
      const da = Number(a._dist_m)
      const db = Number(b._dist_m)
      const na = Number.isFinite(da) ? da : Number.POSITIVE_INFINITY
      const nb = Number.isFinite(db) ? db : Number.POSITIVE_INFINITY
      return na - nb
    }
    const ta = toTimestamp(a.last_seen_ts ?? a.last_seen) ?? 0
    const tb = toTimestamp(b.last_seen_ts ?? b.last_seen) ?? 0
    return tb - ta
  })
  return list
})

const buildNearbyPopup = (d: NearbyDrone): string => {
  const model = d.aircraft_model_name ?? d.aircraft_model ?? d.model ?? ''
  const manu = d.aircraft_manufacturer ?? d.manufacturer ?? ''
  const det = String(d.detection_detail || `${manu} ${model}`.trim() || 'Nearby Remote ID')
  return [
    '<div style="font-family:ui-monospace,monospace;font-size:11px;line-height:1.4;max-width:160px">',
    `<b>${det.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</b>`,
    '</div>'
  ].join('')
}

const nearbyColors = ['#f59e0b', '#22d3ee', '#a78bfa', '#f43f5e', '#34d399', '#f59e0b']

const syncNearby = () => {
  if (!map) return
  if (!link || !props.showNearby || !showNearbyLayer.value) {
    if (nearbyCluster) {
      nearbyCluster.clearLayers()
      if (map.hasLayer(nearbyCluster)) map.removeLayer(nearbyCluster)
    }
    for (const marker of nearbyMarkers.values()) {
      map.removeLayer(marker)
    }
    nearbyMarkers.clear()
    return
  }
  const leaflet = link
  const seen = new Set<string>()
  const list = Array.isArray(sortedFilteredNearby.value) ? sortedFilteredNearby.value : []
  if (leaflet.markerClusterGroup && !nearbyCluster) {
    nearbyCluster = leaflet.markerClusterGroup({
      disableClusteringAtZoom: 16,
      iconCreateFunction: (cluster: { getChildCount: () => number }) => leaflet.divIcon({
        html: '<div style="background:rgba(59,130,246,.9);color:#fff;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:2px solid #bfdbfe;font-weight:600;font-size:12px">' + cluster.getChildCount() + '</div>',
        className: 'cd-cluster',
        iconSize: [36, 36]
      })
    })
    map.addLayer(nearbyCluster)
  }
  if (nearbyCluster) {
    const cluster = nearbyCluster
    cluster.clearLayers()
    for (const d of list) {
      const lat = Number(d.lat ?? d.latitude)
      const lon = Number(d.lng ?? d.lon ?? d.longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
      const key = nearbyKey(d)
      seen.add(key)
      let marker = nearbyMarkers.get(key)
      if (!marker) {
        marker = leaflet.marker([lat, lon], { icon: nearbyIcon ?? undefined })
        marker.on?.('click', () => {
          selectedDrone.value = d
        })
        marker.bindPopup(buildNearbyPopup(d))
        nearbyMarkers.set(key, marker)
      } else {
        marker.setLatLng([lat, lon])
        marker.setPopupContent(buildNearbyPopup(d))
        marker.off?.('click')
        marker.on?.('click', () => {
          selectedDrone.value = d
        })
      }
      cluster.addLayer(marker)
    }
    // Ensure the cluster group is on the map and drop stale markers.
    if (!map.hasLayer(cluster)) map.addLayer(cluster)
    for (const [k, marker] of nearbyMarkers.entries()) {
      if (seen.has(k)) continue
      cluster.removeLayer(marker)
      map.removeLayer(marker)
      nearbyMarkers.delete(k)
    }
    return
  }
  for (const [i, d] of list.entries()) {
    const lat = Number(d.lat ?? d.latitude)
    const lng = Number(d.lng ?? d.lon ?? d.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue
    const key = nearbyKey(d)
    seen.add(key)
    const pos: LeafletLatLng = { lat, lng }
    if (!nearbyHistory.has(key)) nearbyHistory.set(key, [])
    const hist = nearbyHistory.get(key)!
    hist.push(pos)
    if (hist.length > MAX_HISTORY) hist.shift()
    if (!nearbyIcon) {
      nearbyIcon = leaflet.divIcon({
        className: 'cd-cardiv',
        html: '<div class="cd-map-nearby"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      })
    }
    if (!nearbyMarkers.has(key)) {
      const marker = leaflet.marker(pos, { icon: nearbyIcon }).addTo(map)
      marker.bindPopup(buildNearbyPopup(d))
      marker.on?.('click', () => {
        selectedDrone.value = d
        selectedOwn.value = false
      })
      nearbyMarkers.set(key, marker)
    } else {
      const marker = nearbyMarkers.get(key)!
      marker.setLatLng(pos)
      marker.bindPopup(buildNearbyPopup(d))
    }
    if (showPath.value && hist.length >= 2) {
      const color = nearbyColors[i % nearbyColors.length]
      if (!nearbyPaths.has(key)) {
        nearbyPaths.set(key, leaflet.polyline(hist, {
          color,
          weight: 3,
          opacity: 0.9,
          lineJoin: 'round',
          lineCap: 'round'
        }).addTo(map))
      } else {
        nearbyPaths.get(key)!.setLatLngs(hist)
        nearbyPaths.get(key)!.setStyle({ color, weight: 3, opacity: 0.9 })
      }
    } else if (nearbyPaths.has(key)) {
      map.removeLayer(nearbyPaths.get(key)!)
      nearbyPaths.delete(key)
    }
  }
  for (const [key, marker] of nearbyMarkers.entries()) {
    if (!seen.has(key)) {
      map.removeLayer(marker)
      nearbyMarkers.delete(key)
    }
  }
  for (const [key, path] of nearbyPaths.entries()) {
    if (!seen.has(key)) {
      map.removeLayer(path)
      nearbyPaths.delete(key)
    }
  }
  for (const key of Array.from(nearbyHistory.keys())) {
    if (!seen.has(key)) nearbyHistory.delete(key)
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
  const leaflet = link
  const theMap = map
  if (tileLayer) {
    theMap.removeLayer(tileLayer)
    tileLayer = null
  }
  const url = TILE_URLS[isDark.value ? 'dark' : 'light']
  const layer = leaflet.tileLayer(url, {
    maxZoom: 19,
    attribution: TILE_ATTRIBUTION[isDark.value ? 'dark' : 'light']
  })
  tileLayer = layer
  layer.addTo(theMap)
  layer.on?.('tileerror', () => {
    // The online tile source failed: switch to the bundled offline tiles.
    if (tileLayer) theMap.removeLayer(tileLayer)
    tileLayer = leaflet.tileLayer(LOCAL_TILE_FALLBACK, { maxZoom: 18, attribution: 'Offline' })
    tileLayer.addTo(theMap)
  })
}

interface GeoJsonFeature {
  type: string
  properties?: Record<string, unknown>
  geometry?: unknown
}

interface GeoJsonCollection {
  type: string
  features: GeoJsonFeature[]
}

interface OsmElement {
  type?: string
  id?: number
  lon?: number
  lat?: number
  nodes?: number[]
  tags?: Record<string, string>
}

interface OsmResponse {
  elements?: OsmElement[]
}

type AirspaceData = GeoJsonCollection | GeoJsonFeature[]

const isAirspaceEmpty = (data: AirspaceData | null): boolean => {
  if (!data) return true
  return Array.isArray(data) ? data.length === 0 : data.features.length === 0
}

const fetchAirspace = async () => {
  if (!import.meta.client || !link || !map || !showAirspace.value) return
  const now = Date.now()
  if (now - airspaceLastFetch < 1500) return
  try {
    const bounds = map.getBounds()
    const sw = bounds.getSouthWest()
    const ne = bounds.getNorthEast()
    // Try openAIP first.
    let data: AirspaceData | null = null
    try {
      const url = `https://api.openaip.net/api/airspaces?bbox=${sw.lng},${sw.lat},${ne.lng},${ne.lat}&limit=500`
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (res.ok) {
        data = await res.json() as AirspaceData
      }
    } catch {
      /* openAIP unreachable: fall through to Overpass */
    }
    // Fallback to Overpass API for airspace.
    if (isAirspaceEmpty(data)) {
      try {
        const query = `[out:json][timeout:25];(way["military"="danger_area"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});way["airspace"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});way["boundary"="protected_area"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});relation["military"="danger_area"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});relation["airspace"](${sw.lat},${sw.lng},${ne.lat},${ne.lng}););out body;>;out skel qt;`
        const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: query, headers: { 'Content-Type': 'text/plain' } })
        if (res.ok) {
          const osm = await res.json() as OsmResponse
          // Convert the minimal OSM response to GeoJSON.
          const features: GeoJsonFeature[] = []
          const nodes: Record<number, [number, number]> = {}
          for (const el of osm.elements ?? []) {
            if (el.type === 'node' && el.id !== undefined && el.lon !== undefined && el.lat !== undefined) {
              nodes[el.id] = [el.lon, el.lat]
            }
          }
          for (const el of osm.elements ?? []) {
            if (el.type !== 'way' || !el.nodes) continue
            const coords = el.nodes
              .map(id => nodes[id])
              .filter((coord): coord is [number, number] => coord !== undefined)
            if (coords.length > 2) {
              features.push({
                type: 'Feature',
                properties: { type: el.tags?.airspace || el.tags?.military || 'airspace' },
                geometry: { type: 'Polygon', coordinates: [[...coords, coords[0]]] }
              })
            }
          }
          if (features.length) data = { type: 'FeatureCollection', features }
        }
      } catch {
        /* Overpass unreachable: show whatever openAIP returned */
      }
    }
    if (airspaceLayer) {
      map.removeLayer(airspaceLayer)
      airspaceLayer = null
    }
    if (data) {
      const collection: GeoJsonCollection | null = Array.isArray(data)
        ? (data.length && data[0]?.geometry ? { type: 'FeatureCollection', features: data } : null)
        : data
      if (collection?.features.length && link.geoJSON) {
        airspaceLayer = link.geoJSON(collection, {
          style: (feature: unknown) => {
            const props = (feature as GeoJsonFeature | null)?.properties ?? {}
            const type = props.type ?? props.airspaceType ?? props.category ?? ''
            let color = '#f59e0b'
            const t = String(type).toUpperCase()
            if (t.includes('RESTRICT') || t.includes('PROHIBIT') || t.includes('DANGER')) color = '#ef4444'
            if (t.includes('CTR') || t.includes('TMA') || t.includes('CLASS')) color = '#f97316'
            if (t.includes('ZONA') || t.includes('NFZ')) color = '#dc2626'
            return { color, weight: 1, fillColor: color, fillOpacity: 0.15 }
          }
        })
        airspaceLayer.addTo(map)
      }
    }
    airspaceLastFetch = now
  } catch {
    /* geometry/bounds unavailable while the map is initialising */
  }
}

const toggleAirspace = () => {
  showAirspace.value = !showAirspace.value
  if (!showAirspace.value) {
    if (airspaceLayer && map) {
      map.removeLayer(airspaceLayer)
      airspaceLayer = null
    }
    return
  }
  if (!map) return
  fetchAirspace()
  if (!map._airspaceBound) {
    map.on('moveend', () => {
      if (airspaceFetchTimeout.value) clearTimeout(airspaceFetchTimeout.value)
      airspaceFetchTimeout.value = setTimeout(fetchAirspace, 800)
    })
    map._airspaceBound = true
  }
}

onMounted(async () => {
  if (import.meta.server) return
  await nextTick()
  if (!mapEl.value) return
  link = await ensureLeaflet()
  if (!link || !mapEl.value) return
  const pos = currentPosition()
  map = link.map(mapEl.value, {
    center: pos ? link.latLng(pos.lat, pos.lng) : link.latLng(0, 0),
    zoom: pos ? 16 : 2,
    zoomControl: false,
    attributionControl: true
  })
  try {
    link.control?.zoom({ position: 'topleft' }).addTo(map)
  } catch {
    /* zoom control is optional */
  }
  try {
    link.control?.scale({ imperial: false, metric: true, position: 'bottomleft' }).addTo(map)
  } catch {
    /* scale control is optional */
  }
  try {
    const scale = document.querySelector('.leaflet-control-scale')
    if (scale) {
      scale.classList.add('cd-scale')
    }
  } catch {
    /* scale control not rendered */
  }
  try {
    if (!link.MeasureControl) {
      appendStylesheet('/vendor/leaflet/measure/leaflet-measure.css')
      await injectScript('/vendor/leaflet/measure/leaflet-measure.js')
    }
    if (link.control?.polylineMeasure) {
      link.control.polylineMeasure({ position: 'topleft' }).addTo(map)
    } else if (link.MeasureControl) {
      const measureControl = new link.MeasureControl({
        position: 'topleft',
        primaryLengthUnit: 'meters',
        secondaryLengthUnit: 'kilometers',
        primaryAreaUnit: 'sqmeters',
        activeColor: '#FF0000',
        completedColor: '#CC0000'
      })
      map.addControl(measureControl)
    }
  } catch {
    /* measuring plugin unavailable */
  }
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
  const theMap = map
  if (theMap) {
    for (const marker of nearbyMarkers.values()) theMap.removeLayer(marker)
    nearbyMarkers.clear()
    if (nearbyCluster) theMap.removeLayer(nearbyCluster)
    if (pathLine) theMap.removeLayer(pathLine)
    if (tileLayer) theMap.removeLayer(tileLayer)
    if (droneMarker) theMap.removeLayer(droneMarker)
    if (takeoffMarker) theMap.removeLayer(takeoffMarker)
    if (airspaceLayer) theMap.removeLayer(airspaceLayer)
    theMap.remove()
  }
  map = null
  droneMarker = null
  takeoffMarker = null
  pathLine = null
  tileLayer = null
  nearbyMarkers.clear()
  nearbyCluster = null
  airspaceLayer = null
})

watch(() => props.status, applyStatus, { deep: true })
watch(() => props.nearbyDrones, () => {
  applyStatus()
  try {
    if (!import.meta.client) return
    const h = window.location.hash || ''
    if (!h.startsWith('#rx/detections/')) return
    const id = decodeURIComponent(h.split('#rx/detections/')[1] ?? '').trim()
    if (!id || selectedDrone.value) return
    const found = findNearbyById(id)
    if (found) {
      selectedDrone.value = found
      selectedOwn.value = false
    }
  } catch {
    /* malformed hash, ignore */
  }
}, { deep: true })
watch(isDark, () => {
  if (mapReady.value) addTileLayer()
})

const ownSources = computed<Array<string | Record<string, unknown>>>(() => {
  const src = props.status?.sources
  return Array.isArray(src) ? src as Array<string | Record<string, unknown>> : []
})

const toggleShowPath = () => {
  showPath.value = !showPath.value
  applyStatus()
}

const toggleNearbyLayer = () => {
  showNearbyLayer.value = !showNearbyLayer.value
  applyStatus()
}

const resetNorth = () => {
  if (!map) return
  if (map.setBearing) {
    map.setBearing(0)
  } else if (map.setRotation) {
    map.setRotation(0)
  } else {
    map.panTo(map.getCenter())
  }
}

const fitNearby = () => {
  if (!map || !link) return
  const list = sortedFilteredNearby.value
  if (!Array.isArray(list)) return
  const pts: LeafletLatLng[] = []
  const own = getOwnPos()
  if (own) pts.push(link.latLng(own.lat, own.lng))
  for (const d of list) {
    const lat = Number(d.lat ?? d.latitude)
    const lon = Number(d.lng ?? d.lon ?? d.longitude)
    if (Number.isFinite(lat) && Number.isFinite(lon)) pts.push(link.latLng(lat, lon))
  }
  if (pts.length) {
    map.fitBounds(link.latLngBounds(pts), { padding: [40, 40], maxZoom: 14 })
  }
}

const exportStatusJson = () => {
  try {
    const blob = new Blob([JSON.stringify(props.status, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'my-drone.json'
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    /* downloads may be blocked by the browser */
  }
}

const exportSelectedJson = () => {
  const d = selectedDrone.value
  if (!d) return
  try {
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const id = d.uas_id || d.serial_number || d.id || 'detection'
    a.download = `omnirid-detection-${id}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    /* downloads may be blocked by the browser */
  }
}

const toggleSeen = (d: NearbyDrone | null) => {
  const k = droneKey(d)
  if (!k) return
  if (seenSet.value.has(k)) seenSet.value.delete(k)
  else seenSet.value.add(k)
  saveSeen()
}
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
      <div class="pointer-events-auto flex flex-col gap-1 rounded-lg border border-default bg-default/95 p-1 shadow-lg">
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
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
          size="sm"
          square
          icon="i-lucide-locate-fixed"
          aria-label="Re-center on drone"
          title="Re-center on drone"
          @click="recenter"
        />
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          square
          :icon="showPath ? 'i-lucide-route' : 'i-lucide-route-off'"
          aria-label="Toggle flight path"
          title="Toggle flight path"
          @click="toggleShowPath"
        />
        <UButton
          v-if="(props.nearbyDrones?.length || 0) > 0 || props.showNearby"
          color="neutral"
          variant="ghost"
          size="sm"
          square
          :icon="showNearbyLayer ? 'i-lucide-radar' : 'i-lucide-radar-off'"
          aria-label="Toggle nearby drones"
          title="Toggle nearby drones"
          @click="toggleNearbyLayer"
        />
        <UButton
          color="neutral"
          :variant="showAirspace ? 'soft' : 'ghost'"
          size="sm"
          square
          icon="i-lucide-shield-alert"
          aria-label="Toggle airspace zones"
          title="Toggle airspace zones"
          @click="toggleAirspace"
        />
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          square
          icon="i-lucide-compass"
          aria-label="Reset north"
          title="Reset north"
          @click="resetNorth"
        />
        <UButton
          v-if="(props.nearbyDrones?.length || 0) > 0"
          color="neutral"
          variant="ghost"
          size="sm"
          square
          icon="i-lucide-layers"
          aria-label="Auto-fit nearby"
          title="Auto-fit to nearby"
          @click="fitNearby"
        />
      </div>
      <div
        v-if="(props.nearbyDrones?.length || 0) > 0"
        class="pointer-events-auto flex items-center gap-2 rounded-lg border border-default bg-default/90 px-2 py-1 text-[11px] text-muted shadow-md"
      >
        <span>{{ sortedFilteredNearby.length }} nearby</span>
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          :icon="showNearbyPanel ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          @click="showNearbyPanel = !showNearbyPanel"
        />
      </div>
    </div>

    <div
      v-if="selectedOwn && hasOwnPos"
      class="pointer-events-auto absolute bottom-0 left-0 right-0 z-[1001] w-full max-h-[65vh] overflow-y-auto rounded-t-xl border border-default bg-default/95 shadow-xl md:bottom-7 md:left-3 md:right-auto md:w-[min(380px,calc(100vw-1.5rem))] md:max-h-[70vh] md:rounded-lg"
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
            :label="String(ownInfo.standard || '--')"
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
      <div class="space-y-3 px-3 py-2 text-xs">
        <div>
          <p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Testazione e Dati Principali
          </p>
          <div class="grid grid-cols-2 gap-2">
            <div class="col-span-2">
              <p class="text-muted">
                Detection detail
              </p>
              <p class="font-semibold text-highlighted">
                {{ (status as Record<string, unknown>).detection_detail || `${(status as Record<string, unknown>).aircraft_manufacturer ?? (status as Record<string, unknown>).manufacturer ?? ''} ${(status as Record<string, unknown>).aircraft_model_name ?? (status as Record<string, unknown>).aircraft_model ?? (status as Record<string, unknown>).model ?? ''}`.trim() || '--' }}
              </p>
            </div>
            <div>
              <p class="text-muted">
                Aircraft Manufacturer
              </p>
              <p class="font-mono text-highlighted">
                {{ (status as Record<string, unknown>).aircraft_manufacturer ?? (status as Record<string, unknown>).manufacturer ?? '--' }}
              </p>
            </div>
            <div>
              <p class="text-muted">
                Aircraft Model Name
              </p>
              <p class="font-mono text-highlighted">
                {{ (status as Record<string, unknown>).aircraft_model_name ?? (status as Record<string, unknown>).aircraft_model ?? (status as Record<string, unknown>).model ?? '--' }}
              </p>
            </div>
            <div class="col-span-2">
              <p class="text-muted">
                Serial Number (SN)
              </p>
              <p class="break-all font-mono text-highlighted">
                {{ (status as Record<string, unknown>).serial_number ?? (status as Record<string, unknown>).sn ?? (status as Record<string, unknown>).uas_id ?? '--' }}
              </p>
            </div>
            <div>
              <p class="text-muted">
                UAS Operator ID
              </p>
              <p class="break-all font-mono text-highlighted">
                {{ (status as Record<string, unknown>).uas_operator_id ?? (status as Record<string, unknown>).operator_id ?? '--' }}
              </p>
            </div>
            <div>
              <p class="text-muted">
                Detected
              </p>
              <p class="font-mono text-highlighted">
                {{ (status as Record<string, unknown>).detected_at ?? (status as Record<string, unknown>).detected_time ?? '--' }}
              </p>
            </div>
            <div class="col-span-2">
              <p class="text-muted">
                Label and Display Color
              </p>
              <p class="font-mono text-highlighted">
                {{ (status as Record<string, unknown>).label_and_display_color ?? (status as Record<string, unknown>).label ?? (status as Record<string, unknown>).display_color ?? '—' }}
              </p>
            </div>
          </div>
        </div>

        <div class="border-t border-default pt-2">
          <p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Statistiche di Volo
          </p>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <p class="text-muted">
                Duration
              </p>
              <p class="font-mono text-highlighted">
                {{ (status as Record<string, unknown>).duration ?? '--' }}
              </p>
            </div>
            <div>
              <p class="text-muted">
                Total distance
              </p>
              <p class="font-mono text-highlighted">
                {{ (status as Record<string, unknown>).total_distance ?? '--' }}
              </p>
            </div>
            <div>
              <p class="text-muted">
                Max. height (ATO)
              </p>
              <p class="font-mono text-highlighted">
                {{ (status as Record<string, unknown>).max_height_ato ?? ownInfo.alt }} m
              </p>
            </div>
            <div>
              <p class="text-muted">
                Max. speed
              </p>
              <p class="font-mono text-highlighted">
                {{ (status as Record<string, unknown>).max_speed ?? ownInfo.speed }} m/s
              </p>
            </div>
            <div>
              <p class="text-muted">
                Max. UA-Operator distance
              </p>
              <p class="font-mono text-highlighted">
                {{ (status as Record<string, unknown>).max_ua_operator_distance ?? '--' }}
              </p>
            </div>
            <div>
              <p class="text-muted">
                Max. UA-Sensor distance
              </p>
              <p class="font-mono text-highlighted">
                {{ (status as Record<string, unknown>).max_ua_sensor_distance ?? '--' }}
              </p>
            </div>
          </div>
        </div>

        <div class="border-t border-default pt-2">
          <p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Azioni Rapide
          </p>
          <div class="flex flex-wrap gap-2">
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-lucide-download"
              @click="exportStatusJson"
            >
              Export
            </UButton>
          </div>
        </div>

        <div class="border-t border-default pt-2">
          <p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Informazioni di Dettaglio
          </p>
          <div class="space-y-2">
            <div>
              <p class="text-muted">
                Serial Number
              </p>
              <p class="break-all font-mono text-highlighted">
                {{ (status as Record<string, unknown>).serial_number ?? (status as Record<string, unknown>).sn ?? (status as Record<string, unknown>).uas_id ?? '--' }}
              </p>
            </div>
            <div>
              <p class="text-muted">
                UAS Operator ID
              </p>
              <p class="break-all font-mono text-highlighted">
                {{ (status as Record<string, unknown>).uas_operator_id ?? (status as Record<string, unknown>).operator_id ?? '--' }}
              </p>
            </div>
            <div>
              <p class="text-muted">
                Label and Display Color
              </p>
              <p class="font-mono text-highlighted">
                {{ (status as Record<string, unknown>).label_and_display_color ?? (status as Record<string, unknown>).label ?? (status as Record<string, unknown>).display_color ?? '—' }}
              </p>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <p class="text-muted">
                  First Seen
                </p>
                <p class="font-mono text-highlighted">
                  {{ (status as Record<string, unknown>).first_seen ?? '--' }}
                </p>
              </div>
              <div>
                <p class="text-muted">
                  Last Seen
                </p>
                <p class="font-mono text-highlighted">
                  {{ (status as Record<string, unknown>).last_seen ?? '--' }}
                </p>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <p class="text-muted">
                  Aircraft Manufacturer
                </p>
                <p class="font-mono text-highlighted">
                  {{ (status as Record<string, unknown>).aircraft_manufacturer ?? (status as Record<string, unknown>).manufacturer ?? '--' }}
                </p>
              </div>
              <div>
                <p class="text-muted">
                  Aircraft Model Name
                </p>
                <p class="font-mono text-highlighted">
                  {{ (status as Record<string, unknown>).aircraft_model_name ?? (status as Record<string, unknown>).aircraft_model ?? (status as Record<string, unknown>).model ?? '--' }}
                </p>
              </div>
            </div>
            <div>
              <p class="text-muted">
                Information Source / Receivers (timeline)
              </p>
              <div class="space-y-1">
                <template v-if="ownSources.length > 0">
                  <div v-for="(src, idx) in ownSources" :key="idx" class="flex items-center justify-between gap-2 rounded border border-default/60 px-2 py-1">
                    <p class="break-all font-mono text-highlighted">
                      {{ typeof src === 'string' ? src : JSON.stringify(src) }}
                    </p>
                    <div class="flex items-center gap-1">
                      <span v-if="typeof src === 'string' && ((src as string).toLowerCase().includes('ble') || (src as string).toLowerCase().includes('beacon'))" class="text-[9px] px-1 rounded bg-cyan-500/20 text-cyan-300">BLE/Wi-Fi</span>
                      <span v-else-if="typeof src === 'string' && (src as string).toLowerCase().includes('nan')" class="text-[9px] px-1 rounded bg-violet-500/20 text-violet-300">Wi-Fi NAN</span>
                      <span v-else-if="typeof src === 'string' && (src as string).toLowerCase().includes('ads')" class="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300">ADS-B</span>
                      <span v-else class="text-[9px] px-1 rounded bg-slate-500/20 text-slate-300">Unknown</span>
                    </div>
                  </div>
                </template>
                <p v-else class="break-all font-mono text-highlighted">
                  {{ (status as Record<string, unknown>).information_source ?? (status as Record<string, unknown>).source ?? '--' }}
                </p>
              </div>
            </div>
            <div>
              <p class="text-muted">
                Transmission Technology
              </p>
              <p class="font-mono text-highlighted">
                {{ (status as Record<string, unknown>).transmission_technology ?? ownInfo.protocol ?? '--' }}
              </p>
            </div>
            <div class="col-span-2">
              <p class="text-muted">
                Position (lat, lon)
              </p>
              <p class="font-mono text-highlighted">
                {{ ownInfo.lat.toFixed(6) }}, {{ ownInfo.lng.toFixed(6) }}
              </p>
            </div>
            <div class="grid grid-cols-2 gap-2">
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
        </div>
      </div>
    </div>

    <div
      v-if="selectedDrone"
      class="pointer-events-auto absolute bottom-0 left-0 right-0 z-[1001] w-full max-h-[65vh] overflow-y-auto rounded-t-xl border border-default bg-default/95 shadow-xl md:bottom-7 md:left-3 md:right-auto md:w-[min(380px,calc(100vw-1.5rem))] md:max-h-[70vh] md:rounded-lg"
    >
      <div class="flex items-center justify-between gap-2 border-b border-default px-3 py-2">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-radio" class="size-4 text-warning" />
          <p class="text-sm font-semibold text-highlighted">
            Nearby Drone
          </p>
          <span v-if="isLiveDrone(selectedDrone)" class="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-300">LIVE</span>
          <span v-if="isSeen(selectedDrone)" class="text-[9px] px-1 rounded bg-slate-400/20 text-slate-300">SEEN</span>
        </div>
        <div class="flex items-center gap-1">
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-eye"
            :title="isSeen(selectedDrone) ? 'Mark unseen' : 'Mark seen'"
            @click="toggleSeen(selectedDrone)"
          />
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-x"
            @click="selectedDrone = null"
          />
        </div>
      </div>
      <div class="space-y-3 px-3 py-2 text-xs">
        <div>
          <p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Dati Principali
          </p>
          <div class="grid grid-cols-2 gap-2">
            <div class="col-span-2">
              <p class="text-muted">
                Detection detail
              </p>
              <p class="font-semibold text-highlighted">
                {{ selectedDrone.detection_detail || ((selectedDrone.aircraft_manufacturer ?? selectedDrone.manufacturer ?? '') + ' ' + (selectedDrone.aircraft_model_name ?? selectedDrone.aircraft_model ?? selectedDrone.model ?? '')).trim() || '--' }}
              </p>
            </div>
            <div class="col-span-2">
              <p class="text-muted">
                Serial Number
              </p>
              <p class="break-all font-mono text-highlighted">
                {{ selectedDrone.serial_number ?? selectedDrone.sn ?? selectedDrone.uas_id ?? selectedDrone.uav_id ?? selectedDrone.serial ?? selectedDrone.id ?? '--' }}
              </p>
            </div>
            <div>
              <p class="text-muted">
                Detected
              </p>
              <p class="font-mono text-highlighted">
                {{ selectedDrone.detected ?? selectedDrone.detected_at ?? selectedDrone.detected_time ?? selectedDrone.first_seen ?? '--' }}
              </p>
            </div>
            <div>
              <p class="text-muted">
                UAS Operator ID
              </p>
              <p class="break-all font-mono text-highlighted">
                {{ selectedDrone.uas_operator_id ?? selectedDrone.operator_id ?? selectedDrone.operator ?? '--' }}
              </p>
            </div>
          </div>
        </div>

        <div class="border-t border-default pt-2">
          <p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Statistiche di Volo
          </p>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <p class="text-muted">
                Duration / Takeoff
              </p>
              <p class="font-mono text-highlighted">
                {{ selectedDrone.duration ?? selectedDrone.flight_duration ?? '--' }}{{ selectedDrone.takeoff_time ? ' · ' + selectedDrone.takeoff_time : (selectedDrone.time_of_day ? ' · ' + selectedDrone.time_of_day : '') }}
              </p>
            </div>
            <div>
              <p class="text-muted">
                Total distance
              </p>
              <p class="font-mono text-highlighted">
                {{ selectedDrone.total_distance ?? selectedDrone.distance_total ?? '--' }}{{ typeof (selectedDrone.total_distance ?? selectedDrone.distance_total) === 'number' ? ' m' : '' }}
              </p>
            </div>
            <div>
              <p class="text-muted">
                Max. height (ATO)
              </p>
              <p class="font-mono text-highlighted">
                {{ selectedDrone.max_height_ato ?? selectedDrone.height_ato ?? selectedDrone.max_height ?? '--' }}{{ typeof (selectedDrone.max_height_ato ?? selectedDrone.height_ato ?? selectedDrone.max_height) === 'number' ? ' m' : '' }}
              </p>
            </div>
            <div>
              <p class="text-muted">
                Max. speed / Distance
              </p>
              <p class="font-mono text-highlighted">
                {{ selectedDrone.max_speed ?? selectedDrone.speed ?? '--' }}{{ typeof (selectedDrone.max_speed ?? selectedDrone.speed) === 'number' ? ' m/s' : '' }}{{ selectedDrone.total_distance ?? selectedDrone.distance_total ? ' · ' + (selectedDrone.total_distance ?? selectedDrone.distance_total) + (typeof (selectedDrone.total_distance ?? selectedDrone.distance_total) === 'number' ? ' m' : '') : '' }}
              </p>
            </div>
            <div>
              <p class="text-muted">
                Max. UA-Operator distance
              </p>
              <p class="font-mono text-highlighted">
                {{ selectedDrone.max_ua_operator_dist ?? selectedDrone.max_ua_operator_distance ?? selectedDrone.ua_operator_distance ?? '--' }}
              </p>
            </div>
            <div>
              <p class="text-muted">
                Max. UA-Sensor distance
              </p>
              <p class="font-mono text-highlighted">
                {{ selectedDrone.max_ua_sensor_dist ?? selectedDrone.max_ua_sensor_distance ?? selectedDrone.ua_sensor_distance ?? '--' }}
              </p>
            </div>
          </div>
        </div>

        <div class="border-t border-default pt-2">
          <p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Azioni Rapide
          </p>
          <div class="flex flex-wrap gap-2">
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-lucide-download"
              @click="exportStatusJson"
            >
              Export
            </UButton>
          </div>
        </div>

        <div class="border-t border-default pt-2">
          <p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Informazioni di Dettaglio
          </p>
          <div class="space-y-2">
            <div>
              <p class="text-muted">
                Serial Number
              </p>
              <p class="break-all font-mono text-highlighted">
                {{ selectedDrone.serial_number ?? selectedDrone.sn ?? selectedDrone.uas_id ?? selectedDrone.uav_id ?? selectedDrone.serial ?? selectedDrone.id ?? '--' }}
              </p>
            </div>
            <div>
              <p class="text-muted">
                UAS Operator ID
              </p>
              <p class="break-all font-mono text-highlighted">
                {{ selectedDrone.uas_operator_id ?? selectedDrone.operator_id ?? selectedDrone.operator ?? '--' }}
              </p>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <p class="text-muted">
                  First Seen
                </p>
                <p class="font-mono text-highlighted">
                  {{ selectedDrone.first_seen ?? selectedDrone.detected_at ?? selectedDrone.detected_time ?? '--' }}
                </p>
              </div>
              <div>
                <p class="text-muted">
                  Last Seen
                </p>
                <div class="flex items-center gap-1.5">
                  <UBadge
                    v-if="isLiveDrone(selectedDrone)"
                    color="success"
                    variant="soft"
                    size="xs"
                  >
                    LIVE
                  </UBadge>
                  <p class="font-mono text-highlighted">
                    {{ selectedDrone.last_seen ?? '--' }}
                  </p>
                </div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <p class="text-muted">
                  Aircraft Manufacturer
                </p>
                <p class="font-mono text-highlighted">
                  {{ selectedDrone.aircraft_manufacturer ?? selectedDrone.manufacturer ?? '--' }}
                </p>
              </div>
              <div>
                <p class="text-muted">
                  Aircraft Model Name
                </p>
                <p class="font-mono text-highlighted">
                  {{ selectedDrone.aircraft_model_name ?? selectedDrone.aircraft_model ?? selectedDrone.model ?? '--' }}
                </p>
              </div>
            </div>
            <div>
              <p class="text-muted">
                Information Source / Receivers (timeline)
              </p>
              <div class="space-y-1">
                <template v-if="Array.isArray(selectedDrone.sources) && selectedDrone.sources.length > 0">
                  <div
                    v-for="(src, idx) in selectedDrone.sources"
                    :key="idx"
                    class="flex items-center justify-between gap-2 rounded border border-default/60 px-2 py-1"
                  >
                    <p class="break-all font-mono text-highlighted">
                      <template v-if="typeof src === 'string'">
                        {{ src }}
                      </template>
                      <template v-else-if="src && typeof src === 'object'">
                        {{ (src as Record<string, unknown>).id ?? (src as Record<string, unknown>).name ?? (src as Record<string, unknown>).source ?? JSON.stringify(src) }}
                      </template>
                      <template v-else>
                        --
                      </template>
                    </p>
                    <div class="flex items-center gap-1">
                      <span v-if="typeof src === 'string' && ((src as string).toLowerCase().includes('ble') || (src as string).toLowerCase().includes('beacon'))" class="text-[9px] px-1 rounded bg-cyan-500/20 text-cyan-300">BLE/Wi-Fi</span>
                      <span v-else-if="typeof src === 'string' && (src as string).toLowerCase().includes('nan')" class="text-[9px] px-1 rounded bg-violet-500/20 text-violet-300">Wi-Fi NAN</span>
                      <span v-else-if="typeof src === 'string' && (src as string).toLowerCase().includes('ads')" class="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300">ADS-B</span>
                      <span v-else class="text-[9px] px-1 rounded bg-slate-500/20 text-slate-300">Unknown</span>
                    </div>
                  </div>
                </template>
                <p v-else-if="typeof selectedDrone.information_source === 'string'" class="break-all font-mono text-highlighted">
                  {{ selectedDrone.information_source }}
                </p>
                <p v-else class="break-all font-mono text-highlighted">
                  {{ selectedDrone.source ?? '--' }}
                </p>
              </div>
            </div>
            <div>
              <p class="text-muted">
                Transmission Technology
              </p>
              <p class="font-mono text-highlighted">
                {{ selectedDrone.transmission_technology ?? selectedDrone.protocol ?? selectedDrone.tech ?? '--' }}
              </p>
            </div>
            <div class="grid grid-cols-2 gap-2">
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
            <div class="flex flex-wrap items-center gap-1.5 pt-1">
              <UButton
                size="xs"
                color="neutral"
                variant="soft"
                icon="i-lucide-download"
                @click="exportSelectedJson"
              >
                Export JSON
              </UButton>
              <UButton
                size="xs"
                :color="isSeen(selectedDrone) ? 'success' : 'neutral'"
                :variant="isSeen(selectedDrone) ? 'soft' : 'ghost'"
                :icon="isSeen(selectedDrone) ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                @click="toggleSeen(selectedDrone)"
              >
                {{ isSeen(selectedDrone) ? 'Mark unseen' : 'Mark seen' }}
              </UButton>
            </div>
          </div>
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

[data-drone-map] .leaflet-control-zoom {
  border: none;
  box-shadow: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

[data-drone-map] .leaflet-control-zoom a {
  width: 36px;
  height: 36px;
  line-height: 36px;
  border: 1px solid rgb(var(--color-gray-200));
  background: rgb(var(--color-gray-50));
  color: rgb(var(--color-gray-900));
  border-radius: 0.5rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  font-size: 18px;
  font-weight: 600;
}

[data-drone-map] .dark .leaflet-control-zoom a {
  background: rgb(var(--color-gray-900));
  color: rgb(var(--color-gray-50));
  border-color: rgb(var(--color-gray-800));
}

[data-drone-map] .leaflet-control-scale {
  border: 1px solid rgb(var(--color-gray-200));
  background: rgb(var(--color-gray-50)/0.9);
  border-radius: 0.375rem;
  padding: 2px 6px;
  color: rgb(var(--color-gray-700));
  font-size: 11px;
}

[data-drone-map] .dark .leaflet-control-scale {
  background: rgb(var(--color-gray-900)/0.9);
  border-color: rgb(var(--color-gray-800));
  color: rgb(var(--color-gray-300));
}

[data-drone-map] .leaflet-control-scale-line {
  border-color: rgb(var(--color-gray-400));
  background: transparent;
  color: inherit;
}
</style>
