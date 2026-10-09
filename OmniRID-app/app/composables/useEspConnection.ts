import { createSharedComposable } from '@vueuse/core'
import { espDefaultIp } from '~/config/app'
import { DEFAULTS, TX_MODES } from '~/config/device'
import { useAppSettings } from '~/composables/useAppSettings'

const ESP_IP_KEY = 'omnirid:esp-ip'

type ProxyOptions = {
  method?: string
  body?: unknown
  headers?: Record<string, string>
  timeout?: number
}

const virtualCapabilities = () => ({
  fw_version: '0.1.0-sim',
  inputs: ['AUTO', 'NMEA', 'MSP', 'MAVLink', 'DroneCAN'],
  tx_modes: ['WIFI_BCN', 'WIFI_NAN', 'BLE4', 'BLE5'],
  options: ['FORCE_ARM_OK', 'DONT_SAVE_BASIC_ID', 'PRINT_RID_MAVLINK', 'DEMO_MODE', 'KALMAN_FILTER', 'AUTH_ED25519', 'MAVLINK_ARM_STATUS', 'MAVLINK_OP_LOC_LOOP', 'IDENTITY_READY_GATE'],
  regions: ['AUTO', 'EUR', 'FAA', 'JPN', 'SGP', 'KOR', 'CHN', 'CAN', 'AUS', 'BRA', 'NZL'],
  standards: ['ASTM F3411-22a', 'China GB 42590', 'FRDID'],
  has_encoder: { 'ASTM F3411-22a': true, 'China GB 42590': false, 'FRDID': false },
  virtual: true
})

const virtualConfig = () => ({
  ...DEFAULTS,
  region: 'EUR',
  tx_modes: TX_MODES.wifiBeacon | TX_MODES.ble4,
  uas_id: 'DEMO3ABC',
  ua_type: 1,
  operator_id: 'OP-DEMO',
  wifi_bcn_rate_hz: 1,
  ble4_rate_hz: 1,
  wifi_ssid: 'ESP-RID'
})

let simEpoch = 0

const virtualTelemetry = (): Record<string, unknown> => {
  const now = Date.now()
  if (!simEpoch) simEpoch = now
  const t = (now - simEpoch) / 1000
  const lat = 41.9028 + Math.sin(t / 25) * 0.003
  const lon = 12.4964 + Math.cos(t / 25) * 0.003
  return {
    fw_version: '0.1.0-sim',
    protocol: 1,
    gps_valid: true,
    lat,
    lon,
    standard: 'ASTM F3411-22a',
    standard_fallback: false,
    alt: 80 + Math.sin(t / 6) * 15,
    speed: Math.abs(Math.cos(t / 5)) * 9,
    heading: Math.round((t * 8) % 360),
    satellites: 14,
    fix_type: 3,
    tx_total: Math.floor(t * 2),
    tx_wifi_bcn: Math.floor(t * 2),
    tx_wifi_nan: 0,
    tx_ble4: Math.floor(t),
    tx_ble5: 0,
    takeoff_captured: true,
    takeoff_lat: 41.9028,
    takeoff_lon: 12.4964,
    takeoff_alt: 30,
    uptime_ms: Math.floor(t * 1000)
  }
}

const _useEspConnection = () => {
  const { settings } = useAppSettings()
  const espIp = useState<string>('esp-ip', () => espDefaultIp)
  const isEspConnected = ref(false)
  const isChecking = ref(false)
  const lastError = ref<string | null>(null)
  const deviceInfo = ref<Record<string, unknown> | null>(null)

  const isSimulated = computed(() => settings.value.virtualConnection === 'wifi')

  const proxyFetch = async <T = unknown>(path: string, options: ProxyOptions = {}): Promise<T> => {
    if (isSimulated.value) {
      const method = (options.method ?? 'GET').toUpperCase()
      if (path === 'api/capabilities') return virtualCapabilities() as T
      if (path === 'api/config') {
        if (method === 'POST') return { saved: true } as T
        return { ...virtualConfig() } as T
      }
      if (path === 'api/status') return virtualTelemetry() as T
      return { ok: true, virtual: true } as T
    }

    const headers: Record<string, string> = { 'x-esp-ip': espIp.value, ...options.headers }
    const body = options.body !== undefined ? JSON.stringify(options.body) : undefined
    if (body !== undefined) headers['content-type'] = 'application/json'

    return $fetch(`/api/esp/${path}`, {
      method: options.method ?? 'GET',
      headers,
      body,
      timeout: options.timeout ?? 6000
    }) as Promise<T>
  }

  const refresh = async () => {
    isChecking.value = true
    lastError.value = null
    try {
      if (isSimulated.value) {
        isEspConnected.value = true
        deviceInfo.value = virtualCapabilities()
        return
      }
      const data = await proxyFetch<unknown>('api/capabilities', { timeout: 4500 })
      isEspConnected.value = true
      deviceInfo.value = typeof data === 'object' && data !== null
        ? data as Record<string, unknown>
        : null
    } catch (error) {
      isEspConnected.value = false
      deviceInfo.value = null
      lastError.value = error instanceof Error ? error.message : 'ESP unreachable'
    } finally {
      isChecking.value = false
    }
  }

  const connect = async (address: string) => {
    espIp.value = address
    if (import.meta.client) {
      localStorage.setItem(ESP_IP_KEY, address)
    }
    await refresh()
  }

  watch(isSimulated, () => {
    refresh()
  })

  onMounted(() => {
    if (import.meta.client) {
      const stored = localStorage.getItem(ESP_IP_KEY)
      if (stored && stored !== espIp.value) {
        espIp.value = stored
      }
    }
    refresh()
  })

  return { espIp, isEspConnected, isChecking, lastError, deviceInfo, isSimulated, proxyFetch, refresh, connect }
}

export const useEspConnection = createSharedComposable(_useEspConnection)
