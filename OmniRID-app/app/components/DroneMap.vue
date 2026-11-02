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
  track?: Array<{ lat: number, lng: number }>
  [key: string]: unknown
}

const props = withDefaults(defineProps<{
  status?: TelemetryStatus
  heightClass?: string
  nearbyDrones?: NearbyDrone[]
  showNearby?: boolean
  initialCenter?: LeafletLatLng | null
  ownDroneEnabled?: boolean
}>(), {
  status: () => ({}),
  heightClass: 'h-[55vh] min-h-[420px]',
  nearbyDrones: () => [],
  showNearby: true,
  initialCenter: null,
  ownDroneEnabled: false
})

const colorMode = useColorMode()

const isDark = computed(() => colorMode.value === 'dark')

const TILE_URLS = {
  dark: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  light: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'
}
const TILE_ATTRIBUTION = 'Tiles &copy; Esri &mdash; Source: Esri, USGS, NOAA'

const LOCAL_JS = '/vendor/leaflet/leaflet.js'
const LOCAL_CSS = '/vendor/leaflet/leaflet.css'
const CDN_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
const CDN_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const MAX_HISTORY = 300
const SAVED_TRAILS_KEY = 'omnirid:dashboard-trails'

interface RecordedTrail {
  key: string
  label: string
  points: Array<LeafletLatLng & { timestamp: number }>
}

interface SavedTrail {
  id: string
  name: string
  savedAt: number
  tracks: RecordedTrail[]
}

const mapEl = ref<HTMLDivElement | null>(null)
const loading = ref(true)
const mapReady = ref(false)
const loadFailed = ref(false)
const tileLoadFailed = ref(false)
const locating = ref(false)

let link: LeafletStatic | null = null
let map: LeafletMap | null = null
let nearbyIcon: LeafletIcon | null = null
let ownDroneIcon: LeafletIcon | null = null
let ownDroneMarker: LeafletMarker | null = null
let ownDronePath: LeafletPolyline | null = null
let takeoffIcon: LeafletIcon | null = null
let takeoffMarker: LeafletMarker | null = null
let tileLayer: LeafletLayer | null = null
const nearbyMarkers = new Map<string, LeafletMarker>()
let nearbyCluster: LeafletMarkerCluster | null = null
let airspaceLayer: LeafletGeoJSONLayer | null = null
let hashChangeHandler: (() => void) | null = null
const airspaceFetchTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
const nearbyPaths = new Map<string, LeafletPolyline>()
let loadPromise: Promise<LeafletStatic | null> | null = null
const nearbyHistory = new Map<string, LeafletLatLng[]>()
const ownDroneHistory: LeafletLatLng[] = []
const recordedTracks = new Map<string, RecordedTrail>()

const showNearbyLayer = ref(true)
const showNearbyPanel = ref(false)
const nearbyFilter = ref<'all' | 'live' | 'unseen'>('all')
const nearbySort = ref<'last_seen' | 'rssi' | 'distance'>('last_seen')
const showAirspace = ref(false)
const airspaceLoading = ref(false)
const airspaceError = ref('')
const airspaceFeatureCount = ref(0)
const locateError = ref('')
const userPosition = ref<LeafletLatLng | null>(null)
const selectedDrone = ref<NearbyDrone | null>(null)
const seenKey = 'omnirid:nearby-seen'
const seenSet = ref<Set<string>>(new Set())
const isRecordingTrails = ref(false)
const trailName = ref('')
const savedTrails = ref<SavedTrail[]>([])
const showSavedTrails = ref(false)
const trailSaveError = ref('')
let airspaceController: AbortController | null = null

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
      hashChangeHandler = checkHash
    } catch {
      /* malformed hash, ignore */
    }
  }
})
const showPath = ref(true)
const selectedOwn = ref(false)

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

const takeoffPosition = (): LeafletLatLng | null => {
  const status = props.status ?? {}
  if (status.takeoff_captured !== true) return null
  const lat = Number(status.takeoff_lat)
  const lng = Number(status.takeoff_lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null
  return { lat, lng }
}

const recordTrackPoint = (key: string, label: string, position: LeafletLatLng) => {
  if (!isRecordingTrails.value) return
  const track = recordedTracks.get(key) ?? { key, label, points: [] }
  const last = track.points[track.points.length - 1]
  if (!last || last.lat !== position.lat || last.lng !== position.lng) {
    track.points.push({ ...position, timestamp: Date.now() })
    if (track.points.length > MAX_HISTORY) track.points.shift()
  }
  recordedTracks.set(key, track)
}

const syncOwnDrone = () => {
  if (!map || !link) return
  const position = currentPosition()
  const homePosition = takeoffPosition()
  if (!props.ownDroneEnabled || !position) {
    if (ownDroneMarker) map.removeLayer(ownDroneMarker)
    if (ownDronePath) map.removeLayer(ownDronePath)
    ownDroneMarker = null
    ownDronePath = null
    takeoffMarker = null
    ownDroneHistory.length = 0
    if (!props.ownDroneEnabled) {
      if (takeoffMarker) map.removeLayer(takeoffMarker)
      takeoffMarker = null
      selectedOwn.value = false
    }
  } else {
    if (!ownDroneIcon) {
      ownDroneIcon = link.divIcon({
        className: 'cd-cardiv',
        html: '<div class="cd-map-own" aria-label="My drone"></div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      })
    }
    if (!ownDroneMarker) {
      ownDroneMarker = link.marker(position, { icon: ownDroneIcon }).addTo(map)
      ownDroneMarker.bindPopup('My drone')
      ownDroneMarker.on?.('click', () => {
        selectedOwn.value = true
        selectedDrone.value = null
      })
    } else {
      ownDroneMarker.setLatLng(position)
    }

    const previous = ownDroneHistory[ownDroneHistory.length - 1]
    if (!previous || previous.lat !== position.lat || previous.lng !== position.lng) {
      ownDroneHistory.push(position)
      if (ownDroneHistory.length > MAX_HISTORY) ownDroneHistory.shift()
    }
    recordTrackPoint('own-drone', 'My drone', position)
    if (showPath.value && ownDroneHistory.length >= 2) {
      if (!ownDronePath) {
        ownDronePath = link.polyline(ownDroneHistory, {
          color: '#3b82f6',
          weight: 4,
          opacity: 0.95,
          lineJoin: 'round',
          lineCap: 'round'
        }).addTo(map)
      } else {
        ownDronePath.setLatLngs(ownDroneHistory)
      }
    }
  }

  if (props.ownDroneEnabled && homePosition) {
    if (!takeoffIcon) {
      takeoffIcon = link.divIcon({
        className: 'cd-cardiv',
        html: '<div class="cd-map-takeoff" aria-label="Takeoff point"></div>',
        iconSize: [26, 34],
        iconAnchor: [13, 30]
      })
    }
    if (!takeoffMarker) {
      takeoffMarker = link.marker(homePosition, { icon: takeoffIcon }).addTo(map)
      takeoffMarker.bindPopup('Takeoff point')
    } else {
      takeoffMarker.setLatLng(homePosition)
    }
  } else if (takeoffMarker) {
    map.removeLayer(takeoffMarker)
    takeoffMarker = null
  }
}

const startTrailRecording = () => {
  if (!props.ownDroneEnabled) return
  recordedTracks.clear()
  trailSaveError.value = ''
  isRecordingTrails.value = true
}

const saveRecordedTrails = () => {
  const tracks = Array.from(recordedTracks.values())
    .filter(track => track.points.length > 0)
    .map(track => ({ ...track, points: [...track.points] }))
  if (!tracks.length) {
    trailSaveError.value = 'No route points recorded yet.'
    return
  }
  const saved: SavedTrail = {
    id: `${Date.now()}`,
    name: trailName.value.trim() || `Route ${new Date().toLocaleString()}`,
    savedAt: Date.now(),
    tracks
  }
  try {
    const updated = [saved, ...savedTrails.value].slice(0, 50)
    localStorage.setItem(SAVED_TRAILS_KEY, JSON.stringify(updated))
    savedTrails.value = updated
    trailName.value = ''
    trailSaveError.value = ''
    isRecordingTrails.value = false
    recordedTracks.clear()
  } catch (error) {
    trailSaveError.value = error instanceof Error ? `Unable to save route: ${error.message}` : 'Unable to save route.'
  }
}

const loadSavedTrails = () => {
  try {
    const raw = localStorage.getItem(SAVED_TRAILS_KEY)
    if (!raw) return
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error('Saved routes have an invalid format.')
    savedTrails.value = parsed as SavedTrail[]
  } catch (error) {
    trailSaveError.value = error instanceof Error ? error.message : 'Unable to load saved routes.'
  }
}

const deleteSavedTrail = (id: string) => {
  const updated = savedTrails.value.filter(trail => trail.id !== id)
  try {
    localStorage.setItem(SAVED_TRAILS_KEY, JSON.stringify(updated))
    savedTrails.value = updated
  } catch (error) {
    trailSaveError.value = error instanceof Error ? `Unable to update saved routes: ${error.message}` : 'Unable to update saved routes.'
  }
}

const exportSavedTrail = (trail: SavedTrail) => {
  const features = trail.tracks
    .filter(track => track.points.length >= 2)
    .map(track => ({
      type: 'Feature',
      properties: { name: track.label, route: trail.name, savedAt: trail.savedAt },
      geometry: {
        type: 'LineString',
        coordinates: track.points.map(point => [point.lng, point.lat])
      }
    }))
  const blob = new Blob([JSON.stringify({ type: 'FeatureCollection', features }, null, 2)], { type: 'application/geo+json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${trail.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}.geojson`
  anchor.click()
  URL.revokeObjectURL(url)
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
  return userPosition.value
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
  const operator = String(d.uas_operator_id ?? d.operator_id ?? d.operator ?? '').trim()
  const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  return [
    '<div style="font-family:ui-monospace,monospace;font-size:11px;line-height:1.4;max-width:160px">',
    `<b>${escapeHtml(det)}</b>`,
    operator ? `<div style="margin-top:4px">Operator: ${escapeHtml(operator)}</div>` : '',
    '</div>'
  ].join('')
}

const nearbyColors = ['#f59e0b', '#22d3ee', '#a78bfa', '#f43f5e', '#34d399', '#f59e0b']

const syncNearby = () => {
  if (!map) return
  for (const drone of props.nearbyDrones) {
    const lat = Number(drone.lat ?? drone.latitude)
    const lng = Number(drone.lng ?? drone.lon ?? drone.longitude)
    if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
      recordTrackPoint(nearbyKey(drone), String(drone.detection_detail ?? drone.uas_id ?? nearbyKey(drone)), { lat, lng })
    }
  }
  if (!link || !props.showNearby || !showNearbyLayer.value) {
    if (nearbyCluster) {
      if (map.hasLayer(nearbyCluster)) map.removeLayer(nearbyCluster)
      nearbyCluster = null
      nearbyMarkers.clear()
      ownDroneMarker = null
      ownDronePath = null
    } else {
      for (const marker of nearbyMarkers.values()) map.removeLayer(marker)
    }
    for (const path of nearbyPaths.values()) map.removeLayer(path)
    nearbyMarkers.clear()
    nearbyPaths.clear()
    return
  }
  const leaflet = link
  const seen = new Set<string>()
  const list = Array.isArray(sortedFilteredNearby.value) ? sortedFilteredNearby.value : []
  const shouldCluster = Boolean(
    leaflet.markerClusterGroup
    && !list.some(drone => drone.source === 'Development simulator')
  )
  if (nearbyCluster && !shouldCluster) {
    if (map.hasLayer(nearbyCluster)) map.removeLayer(nearbyCluster)
    nearbyCluster = null
    nearbyMarkers.clear()
  }
  if (shouldCluster && leaflet.markerClusterGroup && !nearbyCluster) {
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
    for (const d of list) {
      const lat = Number(d.lat ?? d.latitude)
      const lon = Number(d.lng ?? d.lon ?? d.longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
      const key = nearbyKey(d)
      seen.add(key)
      let marker = nearbyMarkers.get(key)
      if (!marker) {
        marker = leaflet.marker([lat, lon], { icon: nearbyIcon ?? undefined })
        marker.on?.('click', () => selectDetection(d))
        marker.bindPopup(buildNearbyPopup(d))
        nearbyMarkers.set(key, marker)
      } else {
        marker.setLatLng([lat, lon])
        marker.setPopupContent(buildNearbyPopup(d))
        marker.off?.('click')
        marker.on?.('click', () => selectDetection(d))
      }
      cluster.addLayer(marker)
      const providedTrack = Array.isArray(d.track)
        ? d.track.filter((point): point is LeafletLatLng =>
            typeof point === 'object'
            && point !== null
            && Number.isFinite(Number(point.lat))
            && Number.isFinite(Number(point.lng))
          )
        : []
      const history = nearbyHistory.get(key) ?? []
      if (!history.length || history[history.length - 1]!.lat !== lat || history[history.length - 1]!.lng !== lon) {
        history.push({ lat, lng: lon })
      }
      if (history.length > MAX_HISTORY) history.shift()
      nearbyHistory.set(key, history)
      const trail = providedTrack.length >= 2 ? providedTrack : history
      const color = nearbyColors[seen.size % nearbyColors.length]!
      if (showPath.value && trail.length >= 2) {
        if (!nearbyPaths.has(key)) {
          nearbyPaths.set(key, leaflet.polyline(trail, {
            color,
            weight: 3,
            opacity: 0.9,
            lineJoin: 'round',
            lineCap: 'round'
          }).addTo(map))
        } else {
          nearbyPaths.get(key)!.setLatLngs(trail)
          nearbyPaths.get(key)!.setStyle({ color, weight: 3, opacity: 0.9 })
        }
      } else if (nearbyPaths.has(key)) {
        map.removeLayer(nearbyPaths.get(key)!)
        nearbyPaths.delete(key)
      }
    }
    // Ensure the cluster group is on the map and drop stale markers.
    if (!map.hasLayer(cluster)) map.addLayer(cluster)
    for (const [k, marker] of nearbyMarkers.entries()) {
      if (seen.has(k)) continue
      cluster.removeLayer(marker)
      if (nearbyPaths.has(k)) {
        map.removeLayer(nearbyPaths.get(k)!)
        nearbyPaths.delete(k)
      }
      nearbyHistory.delete(k)
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
    if (!hist.length || hist[hist.length - 1]!.lat !== lat || hist[hist.length - 1]!.lng !== lng) hist.push(pos)
    if (hist.length > MAX_HISTORY) hist.shift()
    const providedTrack = Array.isArray(d.track)
      ? d.track.filter((point): point is LeafletLatLng =>
          typeof point === 'object'
          && point !== null
          && Number.isFinite(Number(point.lat))
          && Number.isFinite(Number(point.lng))
        )
      : []
    const trail = providedTrack.length >= 2 ? providedTrack : hist
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
      marker.on?.('click', () => selectDetection(d))
      nearbyMarkers.set(key, marker)
    } else {
      const marker = nearbyMarkers.get(key)!
      marker.setLatLng(pos)
      marker.bindPopup(buildNearbyPopup(d))
    }
    if (showPath.value && trail.length >= 2) {
      const color = nearbyColors[i % nearbyColors.length]
      if (!nearbyPaths.has(key)) {
        nearbyPaths.set(key, leaflet.polyline(trail, {
          color,
          weight: 3,
          opacity: 0.9,
          lineJoin: 'round',
          lineCap: 'round'
        }).addTo(map))
      } else {
        nearbyPaths.get(key)!.setLatLngs(trail)
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
  syncNearby()
  syncOwnDrone()
}

const recenter = () => {
  if (!map) return
  locateError.value = ''
  if (userPosition.value) {
    map.setView(userPosition.value, Math.max(map.getZoom(), 15))
    return
  }
  locateReceiver()
}

const locateReceiver = () => {
  locateError.value = ''
  if (!navigator.geolocation) {
    locateError.value = 'Location is not available in this browser.'
    return
  }
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      userPosition.value = { lat: coords.latitude, lng: coords.longitude }
      if (map) map.setView(userPosition.value, Math.max(map.getZoom(), 15))
      locating.value = false
    },
    (error) => {
      locateError.value = error.code === error.PERMISSION_DENIED
        ? 'Location permission was denied.'
        : 'Could not determine this device’s location.'
      locating.value = false
    },
    { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
  )
}

const selectDetection = (drone: NearbyDrone) => {
  selectedDrone.value = drone
  selectedOwn.value = false
  showNearbyPanel.value = false
  showNearbyLayer.value = true
  const lat = Number(drone.lat ?? drone.latitude)
  const lng = Number(drone.lng ?? drone.lon ?? drone.longitude)
  if (map && Number.isFinite(lat) && Number.isFinite(lng)) {
    map.setView({ lat, lng }, Math.max(map.getZoom(), 15))
  }
}

const addTileLayer = () => {
  if (!link || !map) return
  const leaflet = link
  const theMap = map
  if (tileLayer) {
    theMap.removeLayer(tileLayer)
    tileLayer = null
  }
  tileLoadFailed.value = false
  const url = TILE_URLS[isDark.value ? 'dark' : 'light']
  const layer = leaflet.tileLayer(url, {
    maxZoom: 19,
    attribution: TILE_ATTRIBUTION
  })
  tileLayer = layer
  layer.addTo(theMap)
  layer.on?.('tileerror', () => {
    if (tileLayer !== layer) return
    tileLoadFailed.value = true
  })
}

interface GeoJsonFeature {
  type: string
  properties?: Record<string, unknown>
  geometry?: unknown
}

type Coordinate = [number, number]

interface OsmGeometryPoint {
  lat: number
  lon: number
}

interface OsmMember {
  type?: string
  role?: string
  geometry?: OsmGeometryPoint[]
}

interface OsmElement {
  type?: string
  id?: number
  tags?: Record<string, string>
  geometry?: OsmGeometryPoint[]
  members?: OsmMember[]
}

interface OsmResponse {
  elements?: OsmElement[]
  remark?: string
}

const AIRSPACE_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
]

const sameCoordinate = (a: Coordinate, b: Coordinate) => a[0] === b[0] && a[1] === b[1]

const joinRings = (segments: Coordinate[][]): Coordinate[][] => {
  const remaining = segments.filter(segment => segment.length > 1).map(segment => [...segment])
  const rings: Coordinate[][] = []

  while (remaining.length) {
    const ring = remaining.shift()!
    let joined = true
    while (!sameCoordinate(ring[0]!, ring[ring.length - 1]!) && joined) {
      joined = false
      for (let i = 0; i < remaining.length; i++) {
        const segment = remaining[i]!
        const first = ring[0]!
        const last = ring[ring.length - 1]!
        const segmentFirst = segment[0]!
        const segmentLast = segment[segment.length - 1]!
        if (sameCoordinate(last, segmentFirst)) {
          ring.push(...segment.slice(1))
        } else if (sameCoordinate(last, segmentLast)) {
          ring.push(...segment.slice(0, -1).reverse())
        } else if (sameCoordinate(first, segmentLast)) {
          ring.unshift(...segment.slice(0, -1))
        } else if (sameCoordinate(first, segmentFirst)) {
          ring.unshift(...segment.slice(1).reverse())
        } else {
          continue
        }
        remaining.splice(i, 1)
        joined = true
        break
      }
    }
    if (ring.length > 3 && sameCoordinate(ring[0]!, ring[ring.length - 1]!)) rings.push(ring)
  }

  return rings
}

const osmAirspaceFeature = (element: OsmElement): GeoJsonFeature | null => {
  const tags = element.tags ?? {}
  const properties = {
    ...tags,
    type: tags.airspace ?? tags.military ?? tags.boundary ?? 'airspace'
  }
  const toCoordinates = (points: OsmGeometryPoint[] | undefined): Coordinate[] =>
    (points ?? []).map(point => [point.lon, point.lat])

  if (element.type === 'way') {
    const coordinates = toCoordinates(element.geometry)
    if (coordinates.length < 2) return null
    const first = coordinates[0]!
    const last = coordinates[coordinates.length - 1]!
    if (coordinates.length > 3 && sameCoordinate(first, last)) {
      return { type: 'Feature', properties, geometry: { type: 'Polygon', coordinates: [coordinates] } }
    }
    return { type: 'Feature', properties, geometry: { type: 'LineString', coordinates } }
  }

  if (element.type === 'relation') {
    const outerSegments = (element.members ?? [])
      .filter(member => member.type === 'way' && (member.role === 'outer' || !member.role))
      .map(member => toCoordinates(member.geometry))
    const rings = joinRings(outerSegments)
    if (rings.length) {
      return { type: 'Feature', properties, geometry: { type: 'MultiPolygon', coordinates: rings.map(ring => [ring]) } }
    }
  }
  return null
}

const fetchAirspace = async () => {
  if (!import.meta.client || !link || !map || !showAirspace.value) return
  airspaceController?.abort()
  airspaceController = null
  airspaceLoading.value = false
  if (airspaceLayer) map.removeLayer(airspaceLayer)
  airspaceLayer = null
  airspaceFeatureCount.value = 0

  if (map.getZoom() < 7) {
    airspaceError.value = 'Locate this device or zoom in to a local area to load airspace data.'
    return
  }

  const controller = new AbortController()
  airspaceController = controller
  airspaceLoading.value = true
  airspaceError.value = ''
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, 20000)

  try {
    const bounds = map.getBounds()
    const sw = bounds.getSouthWest()
    const ne = bounds.getNorthEast()
    const bbox = `${sw.lat},${sw.lng},${ne.lat},${ne.lng}`
    const query = `[out:json][timeout:18];(nwr["boundary"="airspace"](${bbox});nwr["airspace"](${bbox});nwr["military"~"danger_area|restricted_area|range|training_area"](${bbox});nwr["aeroway"~"no_fly_zone|restricted"](${bbox}););out geom;`
    let data: OsmResponse | null = null
    let lastError: Error | null = null
    for (const endpoint of AIRSPACE_ENDPOINTS) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'accept': 'application/json', 'Content-Type': 'text/plain;charset=UTF-8' },
          body: query,
          signal: controller.signal
        })
        if (!response.ok) throw new Error(`Airspace service returned HTTP ${response.status}`)
        const result = await response.json() as OsmResponse
        if (result.remark) throw new Error(`Airspace service: ${result.remark}`)
        data = result
        break
      } catch (error) {
        if (controller.signal.aborted) throw error
        lastError = error instanceof Error ? error : new Error('Unable to load airspace data.')
      }
    }
    if (!data) throw lastError ?? new Error('Airspace services are unavailable.')

    const features = (data.elements ?? [])
      .map(osmAirspaceFeature)
      .filter((feature): feature is GeoJsonFeature => feature !== null)
    if (controller.signal.aborted || map === null || !showAirspace.value) return

    if (airspaceLayer) map.removeLayer(airspaceLayer)
    airspaceLayer = null
    airspaceFeatureCount.value = features.length
    if (features.length && link.geoJSON) {
      airspaceLayer = link.geoJSON({ type: 'FeatureCollection', features }, {
        style: (feature: unknown) => {
          const properties = (feature as GeoJsonFeature | null)?.properties ?? {}
          const classification = String(
            properties.airspace
            ?? properties.military
            ?? properties.restriction
            ?? properties.airspace_class
            ?? properties.icao
            ?? properties.boundary
            ?? properties.type
            ?? ''
          ).toUpperCase()
          const color = /PROHIBIT|RESTRICT|DANGER|NO.?FLY|(^|[^A-Z])[PRD]([^A-Z]|$)/.test(classification) ? '#ef4444' : '#f59e0b'
          return { color, weight: 2, fillColor: color, fillOpacity: 0.2 }
        }
      })
      airspaceLayer.addTo(map)
    }
  } catch (error) {
    if (showAirspace.value && (timedOut || !controller.signal.aborted)) {
      airspaceError.value = timedOut
        ? 'Airspace data request timed out. Try again or zoom in closer.'
        : error instanceof Error ? error.message : 'Unable to load airspace data.'
    }
  } finally {
    clearTimeout(timeout)
    if (airspaceController === controller) {
      airspaceController = null
      airspaceLoading.value = false
    }
  }
}

const scheduleAirspaceFetch = () => {
  if (airspaceFetchTimeout.value) clearTimeout(airspaceFetchTimeout.value)
  airspaceFetchTimeout.value = setTimeout(fetchAirspace, 900)
}

const toggleAirspace = () => {
  showAirspace.value = !showAirspace.value
  airspaceError.value = ''
  if (!showAirspace.value) {
    airspaceController?.abort()
    airspaceController = null
    airspaceLoading.value = false
    airspaceFeatureCount.value = 0
    if (airspaceLayer && map) map.removeLayer(airspaceLayer)
    airspaceLayer = null
    return
  }
  if (!map) return
  fetchAirspace()
  if (!map._airspaceBound) {
    map.on('moveend', scheduleAirspaceFetch)
    map._airspaceBound = true
  }
}

onMounted(async () => {
  loadSavedTrails()
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
  if (props.initialCenter) map.setView(props.initialCenter, 13)
  applyStatus()
  requestAnimationFrame(() => map?.invalidateSize())
})

onBeforeUnmount(() => {
  if (hashChangeHandler) {
    window.removeEventListener('hashchange', hashChangeHandler)
    hashChangeHandler = null
  }
  airspaceController?.abort()
  airspaceController = null
  if (airspaceFetchTimeout.value) clearTimeout(airspaceFetchTimeout.value)
  airspaceFetchTimeout.value = null
  const theMap = map
  if (theMap) {
    if (ownDroneMarker) theMap.removeLayer(ownDroneMarker)
    if (ownDronePath) theMap.removeLayer(ownDronePath)
    if (takeoffMarker) theMap.removeLayer(takeoffMarker)
    if (nearbyCluster && theMap.hasLayer(nearbyCluster)) {
      theMap.removeLayer(nearbyCluster)
    } else {
      for (const marker of nearbyMarkers.values()) theMap.removeLayer(marker)
    }
    nearbyMarkers.clear()
    for (const path of nearbyPaths.values()) theMap.removeLayer(path)
    if (tileLayer) theMap.removeLayer(tileLayer)
    if (airspaceLayer) theMap.removeLayer(airspaceLayer)
    theMap.remove()
  }
  map = null
  tileLayer = null
  nearbyMarkers.clear()
  nearbyCluster = null
  airspaceLayer = null
})

watch(() => props.status, applyStatus, { deep: true })
watch(() => props.ownDroneEnabled, applyStatus)
watch(() => props.initialCenter, (center) => {
  if (map && center) map.setView(center, 13)
}, { deep: true })
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

const toggleNearbyLayer = () => {
  showNearbyLayer.value = !showNearbyLayer.value
  applyStatus()
}

const fitNearby = () => {
  if (!map || !link) return
  const list = sortedFilteredNearby.value
  if (!Array.isArray(list)) return
  const pts: LeafletLatLng[] = []
  const own = getOwnPos()
  if (own) pts.push(link.latLng(own.lat, own.lng))
  const ownDronePosition = props.ownDroneEnabled ? currentPosition() : null
  if (ownDronePosition) pts.push(link.latLng(ownDronePosition.lat, ownDronePosition.lng))
  const launchPosition = props.ownDroneEnabled ? takeoffPosition() : null
  if (launchPosition) pts.push(link.latLng(launchPosition.lat, launchPosition.lng))
  for (const d of list) {
    const lat = Number(d.lat ?? d.latitude)
    const lon = Number(d.lng ?? d.lon ?? d.longitude)
    if (Number.isFinite(lat) && Number.isFinite(lon)) pts.push(link.latLng(lat, lon))
  }
  if (pts.length === 1) {
    map.setView(pts[0]!, Math.max(map.getZoom(), 15))
  } else if (pts.length > 1) {
    map.fitBounds(link.latLngBounds(pts), { padding: [40, 40], maxZoom: 14 })
  } else {
    recenter()
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
      v-if="!loading && !loadFailed && mapReady && sortedFilteredNearby.length === 0 && !props.ownDroneEnabled"
      class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center"
    >
      <UIcon name="i-lucide-radar" class="size-6 text-muted" />
      <p class="text-sm font-medium text-muted">
        No Remote ID detections
      </p>
      <p class="text-xs text-muted/80">
        Detections from a supported receiver will appear on the map.
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
    <div
      v-if="tileLoadFailed"
      class="pointer-events-none absolute bottom-8 left-1/2 z-[1001] -translate-x-1/2 rounded-lg border border-warning/40 bg-default/95 px-3 py-2 text-center text-xs text-warning shadow-lg"
      role="status"
    >
      Map tiles are unavailable. Check your internet connection.
    </div>
    <div class="pointer-events-none absolute right-3 top-3 z-[1001] flex flex-col items-end gap-2">
      <div class="pointer-events-auto flex flex-col gap-1 rounded-lg border border-default bg-default/95 p-1 shadow-lg">
        <UButton
          v-if="props.ownDroneEnabled && hasOwnPos"
          color="primary"
          variant="soft"
          size="sm"
          square
          icon="i-lucide-plane"
          aria-label="Show my drone"
          title="My drone"
          @click="selectedOwn = true; map?.setView(currentPosition()!, Math.max(map?.getZoom() ?? 2, 15))"
        />
        <UButton
          v-if="props.ownDroneEnabled"
          color="neutral"
          :variant="isRecordingTrails ? 'soft' : 'ghost'"
          size="sm"
          square
          :icon="isRecordingTrails ? 'i-lucide-square' : 'i-lucide-circle-dot'"
          :aria-label="isRecordingTrails ? 'Stop route recording' : 'Start route recording'"
          :title="isRecordingTrails ? 'Stop route recording' : 'Start route recording'"
          :aria-pressed="isRecordingTrails"
          @click="isRecordingTrails ? isRecordingTrails = false : startTrailRecording()"
        />
        <UButton
          v-if="props.ownDroneEnabled && isRecordingTrails"
          color="primary"
          variant="soft"
          size="sm"
          square
          icon="i-lucide-save"
          aria-label="Save recorded route"
          title="Save recorded route"
          @click="saveRecordedTrails"
        />
        <UButton
          v-if="props.ownDroneEnabled && savedTrails.length"
          color="neutral"
          :variant="showSavedTrails ? 'soft' : 'ghost'"
          size="sm"
          square
          icon="i-lucide-folder-clock"
          :aria-label="showSavedTrails ? 'Hide saved routes' : 'Show saved routes'"
          :title="`${savedTrails.length} saved routes`"
          :aria-pressed="showSavedTrails"
          @click="showSavedTrails = !showSavedTrails"
        />
        <UButton
          v-if="!loadFailed"
          color="neutral"
          variant="ghost"
          size="sm"
          square
          :icon="locating ? 'i-lucide-loader-circle' : 'i-lucide-locate-fixed'"
          :loading="locating"
          aria-label="Locate this receiver"
          title="Locate this receiver"
          @click="recenter"
        />
        <UButton
          v-if="sortedFilteredNearby.length > 0"
          color="neutral"
          variant="ghost"
          size="sm"
          square
          icon="i-lucide-scan"
          aria-label="Fit all detections"
          title="Fit all detections"
          @click="fitNearby"
        />
        <UButton
          v-if="(props.nearbyDrones?.length || 0) > 0"
          color="neutral"
          :variant="showNearbyLayer ? 'soft' : 'ghost'"
          size="sm"
          square
          :icon="showNearbyLayer ? 'i-lucide-radar' : 'i-lucide-eye-off'"
          :aria-label="showNearbyLayer ? 'Hide Remote ID detections' : 'Show Remote ID detections'"
          :title="showNearbyLayer ? 'Hide Remote ID detections' : 'Show Remote ID detections'"
          :aria-pressed="showNearbyLayer"
          @click="toggleNearbyLayer"
        />
        <UButton
          color="neutral"
          :variant="showAirspace ? 'soft' : 'ghost'"
          size="sm"
          square
          :icon="airspaceLoading ? 'i-lucide-loader-circle' : 'i-lucide-shield-alert'"
          :class="airspaceLoading && 'animate-spin'"
          :aria-label="showAirspace ? 'Hide airspace zones' : 'Show airspace zones'"
          :title="showAirspace ? 'Hide airspace zones' : 'Show airspace zones'"
          :aria-pressed="showAirspace"
          @click="toggleAirspace"
        />
      </div>
      <section
        v-if="props.ownDroneEnabled && isRecordingTrails"
        class="pointer-events-auto w-[min(22rem,calc(100vw-1.5rem))] rounded-lg border border-default bg-default/95 p-3 shadow-xl"
      >
        <p class="text-xs font-semibold text-primary">
          Recording visible drone routes
        </p>
        <UInput
          v-model="trailName"
          class="mt-2"
          size="sm"
          placeholder="Route name (optional)"
          aria-label="Route name"
        />
        <p v-if="trailSaveError" class="mt-2 text-xs text-warning" role="status">
          {{ trailSaveError }}
        </p>
      </section>
      <section
        v-if="props.ownDroneEnabled && showSavedTrails"
        class="pointer-events-auto w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-default bg-default/95 shadow-xl"
      >
        <header class="flex items-center justify-between border-b border-default px-3 py-2">
          <h2 class="text-sm font-semibold text-highlighted">
            Saved routes
          </h2>
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-x"
            aria-label="Close saved routes"
            @click="showSavedTrails = false"
          />
        </header>
        <ul class="max-h-56 divide-y divide-default overflow-y-auto">
          <li v-for="trail in savedTrails" :key="trail.id" class="flex items-center justify-between gap-2 px-3 py-2">
            <span class="min-w-0">
              <span class="block truncate text-xs font-medium text-highlighted">{{ trail.name }}</span>
              <span class="block text-[10px] text-muted">{{ new Date(trail.savedAt).toLocaleString() }} · {{ trail.tracks.length }} tracks</span>
            </span>
            <div class="flex shrink-0">
              <UButton
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-lucide-download"
                :aria-label="`Export ${trail.name}`"
                @click="exportSavedTrail(trail)"
              />
              <UButton
                color="error"
                variant="ghost"
                size="xs"
                icon="i-lucide-trash-2"
                :aria-label="`Delete ${trail.name}`"
                @click="deleteSavedTrail(trail.id)"
              />
            </div>
          </li>
        </ul>
      </section>
      <p v-if="trailSaveError && !isRecordingTrails" class="pointer-events-auto max-w-[min(22rem,calc(100vw-1.5rem))] rounded-lg border border-warning/40 bg-default/95 px-3 py-2 text-xs text-warning shadow-xl" role="status">
        {{ trailSaveError }}
      </p>
      <div
        v-if="(props.nearbyDrones?.length || 0) > 0"
        class="pointer-events-auto flex items-center gap-2 rounded-lg border border-default bg-default/90 px-2 py-1 text-[11px] text-muted shadow-md"
      >
        <span>{{ sortedFilteredNearby.length }} detections</span>
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="showNearbyPanel ? 'Hide detections list' : 'Show detections list'"
          :icon="showNearbyPanel ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          @click="showNearbyPanel = !showNearbyPanel"
        />
      </div>

      <section
        v-if="showNearbyPanel && (props.nearbyDrones?.length || 0) > 0"
        class="pointer-events-auto w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-default bg-default/95 shadow-xl"
      >
        <header class="flex items-center justify-between border-b border-default px-3 py-2">
          <h2 class="text-sm font-semibold text-highlighted">
            Remote ID detections
          </h2>
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-x"
            aria-label="Close detections list"
            @click="showNearbyPanel = false"
          />
        </header>
        <div class="grid grid-cols-2 gap-2 border-b border-default p-3">
          <label class="sr-only" for="detection-filter">Filter detections</label>
          <select
            id="detection-filter"
            v-model="nearbyFilter"
            class="min-w-0 rounded-md border border-default bg-elevated px-2 py-1.5 text-xs text-highlighted"
          >
            <option value="all">
              All detections
            </option>
            <option value="live">
              Live only
            </option>
            <option value="unseen">
              Not marked seen
            </option>
          </select>
          <label class="sr-only" for="detection-sort">Sort detections</label>
          <select
            id="detection-sort"
            v-model="nearbySort"
            class="min-w-0 rounded-md border border-default bg-elevated px-2 py-1.5 text-xs text-highlighted"
          >
            <option value="last_seen">
              Latest first
            </option>
            <option value="rssi">
              Signal strength
            </option>
            <option value="distance">
              Distance
            </option>
          </select>
        </div>
        <ul class="max-h-64 divide-y divide-default overflow-y-auto">
          <li v-for="drone in sortedFilteredNearby" :key="nearbyKey(drone)">
            <button
              type="button"
              class="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-elevated"
              @click="selectDetection(drone)"
            >
              <span class="min-w-0">
                <span class="block truncate text-sm font-medium text-highlighted">
                  {{ drone.detection_detail || drone.aircraft_model_name || drone.aircraft_model || drone.uas_id || drone.serial_number || 'Remote ID detection' }}
                </span>
                <span class="mt-0.5 block truncate font-mono text-[11px] text-muted">
                  {{ drone.uas_id || drone.serial_number || drone.id || drone.last_seen || 'ID unavailable' }}
                </span>
                <span v-if="drone.uas_operator_id || drone.operator_id || drone.operator" class="block truncate text-[11px] text-muted">
                  Operator: {{ drone.uas_operator_id || drone.operator_id || drone.operator }}
                </span>
              </span>
              <span v-if="isLiveDrone(drone)" class="shrink-0 rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                LIVE
              </span>
            </button>
          </li>
          <li v-if="sortedFilteredNearby.length === 0" class="px-3 py-4 text-center text-xs text-muted">
            No detections match this filter.
          </li>
        </ul>
      </section>

      <div
        v-if="showAirspace"
        class="pointer-events-auto max-w-[min(22rem,calc(100vw-1.5rem))] rounded-lg border border-default bg-default/95 p-3 shadow-xl"
        role="status"
        aria-live="polite"
      >
        <div class="flex items-start gap-2">
          <UIcon
            :name="airspaceLoading ? 'i-lucide-loader-circle' : airspaceError ? 'i-lucide-triangle-alert' : 'i-lucide-shield-alert'"
            class="mt-0.5 size-4 shrink-0"
            :class="airspaceLoading ? 'animate-spin text-primary' : airspaceError ? 'text-warning' : 'text-error'"
          />
          <div class="min-w-0 flex-1">
            <p class="text-xs font-semibold text-highlighted">
              {{ airspaceLoading ? 'Loading airspace data…' : airspaceError ? 'Airspace data unavailable' : `${airspaceFeatureCount} mapped airspace zones` }}
            </p>
            <p v-if="airspaceError" class="mt-1 break-words text-xs text-muted">
              {{ airspaceError }}
            </p>
            <p v-else-if="!airspaceLoading && airspaceFeatureCount === 0" class="mt-1 text-xs text-muted">
              No mapped zones found in this area.
            </p>
            <p class="mt-1 text-[10px] leading-4 text-muted">
              Community OpenStreetMap data; coverage is incomplete and is not an authoritative flight-safety source.
            </p>
          </div>
          <UButton
            v-if="airspaceError"
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-refresh-cw"
            aria-label="Retry airspace data"
            @click="fetchAirspace"
          />
        </div>
      </div>

      <p
        v-if="locateError"
        class="pointer-events-auto max-w-[min(22rem,calc(100vw-1.5rem))] rounded-lg border border-warning/40 bg-default/95 px-3 py-2 text-xs text-warning shadow-xl"
        role="status"
      >
        {{ locateError }}
      </p>
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
              @click="exportSelectedJson"
            >
              Export detection
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

.cd-map-own {
  width: 22px;
  height: 22px;
  border: 3px solid #dbeafe;
  border-radius: 9999px;
  background: #2563eb;
  box-shadow: 0 0 0 5px rgb(37 99 235 / 30%), 0 1px 8px rgb(0 0 0 / 70%);
}

.cd-map-takeoff {
  position: relative;
  width: 24px;
  height: 24px;
  border: 2px solid #fff;
  border-radius: 50% 50% 50% 0;
  background: #16a34a;
  box-shadow: 0 2px 8px rgb(0 0 0 / 60%);
  transform: rotate(-45deg);
}

.cd-map-takeoff::after {
  position: absolute;
  top: 6px;
  left: 6px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fff;
  content: '';
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
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 18%) !important;
  border-radius: 0.75rem;
  background: rgb(8 10 14 / 94%);
  box-shadow: 0 4px 14px rgb(0 0 0 / 35%);
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(10px);
}

[data-drone-map] .leaflet-container .leaflet-control-zoom.leaflet-bar a {
  box-sizing: border-box;
  display: flex;
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
  border: 0 !important;
  border-radius: 0;
  background: transparent;
  color: #fff;
  font-size: 20px;
  font-weight: 400;
  line-height: 1;
  box-shadow: none;
  transition: background-color 120ms ease;
}

[data-drone-map] .leaflet-container .leaflet-control-zoom.leaflet-bar .leaflet-control-zoom-in {
  border-bottom: 1px solid rgb(255 255 255 / 14%);
}

[data-drone-map] .leaflet-container .leaflet-control-zoom.leaflet-bar a:hover,
[data-drone-map] .leaflet-container .leaflet-control-zoom.leaflet-bar a:focus-visible {
  background: rgb(255 255 255 / 12%);
  color: #fff;
}

[data-drone-map] .leaflet-control-scale {
  border: 0;
  background: transparent;
  padding: 0;
  color: #fff;
  font-size: 11px;
}

[data-drone-map] .leaflet-control-scale-line {
  min-width: 70px;
  border: 1px solid rgb(255 255 255 / 75%);
  border-radius: 0.5rem;
  background: rgb(8 10 14 / 94%);
  padding: 4px 7px;
  color: #fff;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.2;
  text-align: center;
  text-shadow: none;
  box-shadow: 0 4px 14px rgb(0 0 0 / 35%);
  backdrop-filter: blur(10px);
}

[data-drone-map] .leaflet-container .leaflet-control-attribution {
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: 0.5rem 0 0 0;
  background: rgb(8 10 14 / 85%);
  padding: 2px 7px;
  color: rgb(255 255 255 / 70%);
  text-shadow: none;
  backdrop-filter: blur(8px);
}

[data-drone-map] .leaflet-container .leaflet-control-attribution a {
  color: rgb(255 255 255 / 85%);
}
</style>
