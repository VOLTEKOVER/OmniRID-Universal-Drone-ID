import { createSharedComposable } from '@vueuse/core'
import { espDefaultIp } from '~/config/app'
import { DEFAULTS, TX_MODES } from '~/config/device'
import { useAppSettings } from '~/composables/useAppSettings'

const ESP_IP_KEY = 'omnirid:esp-ip'

export type EspTransport = 'wifi' | 'usb' | 'none'

type ProxyOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  timeout?: number
}

type PendingConfigRequest = {
  path: string
  options: ProxyOptions
  resolve: (value: any) => void
  reject: (reason?: any) => void
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

  const configAuthRequired = useState<boolean>('omnirid-config-auth-required', () => false)
  const configAuthenticated = useState<boolean>('omnirid-config-authenticated', () => false)
  const configAuthError = useState<string>('omnirid-config-auth-error', () => '')
  const configAuthChecked = useState<boolean>('omnirid-config-auth-checked', () => false)
  const configAuthConnKey = useState<string>('omnirid-config-auth-conn-key', () => '')
  const pendingConfigRequest = useState<PendingConfigRequest | null>('omnirid-config-auth-pending', () => null)

  const isSimulated = computed(() => settings.value.virtualConnection === 'wifi' || settings.value.virtualConnection === 'usb')

  const transport = computed<EspTransport>(() => {
    if (!isEspConnected.value) return 'none'
    return settings.value.virtualConnection === 'usb' ? 'usb' : 'wifi'
  })
  const isWifiTransport = computed(() => transport.value === 'wifi')
  const isUsbTransport = computed(() => transport.value === 'usb')

  const canTelemetry = computed(() => transport.value !== 'none')
  const canConfig = computed(() => isWifiTransport.value)
  const canOta = computed(() => isWifiTransport.value)
  const canFlashUsb = computed(() => isUsbTransport.value)

  const getConnKey = () => {
    const addr = espIp.value?.trim()
    if (!addr) return 'none'
    return addr.replace(/\/$/, '').toLowerCase()
  }

  const isConfigWriteTarget = (path: string) => {
    const p = path.replace(/^\//, '')
    if (!p) return false
    if (p.startsWith('api/app/auth')) return false
    if (p === 'api/status' || p.startsWith('api/status?')) return false
    if (p === 'api/capabilities' || p.startsWith('api/capabilities?')) return false
    if (p === 'api/logs' || p.startsWith('api/logs?')) return false
    if (p.startsWith('api/telemetry') || p.startsWith('api/rx/') || p.startsWith('api/detections')) return false
    return true
  }

  const requestConfigAuthModal = (path: string, options: ProxyOptions) => {
    return new Promise<T>((resolve, reject) => {
      pendingConfigRequest.value = {
        path,
        options,
        resolve,
        reject
      }
      if (import.meta.client) {
        window.dispatchEvent(new CustomEvent('omnirid:config-auth-required'))
      }
    }) as Promise<T>
  }

  const checkConfigAuth = async () => {
    if (isSimulated.value) {
      try {
        const res = await proxyFetch<Record<string, unknown>>('api/app/auth/status', { timeout: 2000 })
        const required = res?.required === true || res?.enabled === true || res?.passwordSet === true || res?.authRequired === true
        configAuthRequired.value = !!required
        configAuthenticated.value = res?.authenticated === true
        configAuthError.value = ''
      } catch {
        configAuthRequired.value = false
        configAuthenticated.value = true
      }
      configAuthChecked.value = true
      configAuthConnKey.value = getConnKey()
      return
    }
    if (!isEspConnected.value || !espIp.value?.trim()) {
      configAuthRequired.value = false
      configAuthenticated.value = false
      configAuthChecked.value = true
      configAuthConnKey.value = getConnKey()
      return
    }
    const key = getConnKey()
    if (configAuthConnKey.value && configAuthConnKey.value !== key) {
      configAuthenticated.value = false
      configAuthRequired.value = false
      configAuthChecked.value = false
    }
    configAuthConnKey.value = key
    try {
      const res = await $fetch<Record<string, unknown>>('/api/esp/api/app/auth/status', {
        method: 'GET',
        headers: { 'x-esp-ip': espIp.value },
        timeout: 4500
      })
      const required = res?.required === true || res?.enabled === true || res?.passwordSet === true || res?.authRequired === true
      configAuthRequired.value = !!required
      configAuthenticated.value = res?.authenticated === true
      configAuthError.value = ''
    } catch {
      configAuthRequired.value = false
      configAuthenticated.value = true
    }
    configAuthChecked.value = true
  }

  const submitConfigAuth = async (password: string) => {
    configAuthError.value = ''
    const pwd = (password || '').trim()
    if (!pwd) {
      configAuthError.value = 'Password richiesta'
      throw new Error('Password richiesta')
    }
    if (isSimulated.value) {
      configAuthenticated.value = true
      configAuthRequired.value = false
      configAuthError.value = ''
      const pending = pendingConfigRequest.value
      if (pending) {
        pendingConfigRequest.value = null
        try {
          const out = await proxyFetch(pending.path, pending.options)
          pending.resolve(out)
          return out
        } catch (e) {
          pending.reject(e)
          throw e
        }
      }
      return { ok: true }
    }
    try {
      const res = await $fetch<Record<string, unknown>>('/api/esp/api/app/auth', {
        method: 'POST',
        headers: { 'x-esp-ip': espIp.value, 'content-type': 'application/json' },
        body: { password: pwd },
        timeout: 6000
      })
      if (res?.ok === false || res?.authenticated === false) {
        configAuthError.value = (res?.error as string) || 'Password errata'
        throw new Error(configAuthError.value)
      }
      configAuthenticated.value = true
      if (res?.required !== false) {
        configAuthRequired.value = configAuthRequired.value || true
      }
      configAuthError.value = ''
      const pending = pendingConfigRequest.value
      if (pending) {
        pendingConfigRequest.value = null
        try {
          const out = await proxyFetch(pending.path, pending.options)
          pending.resolve(out)
          return out
        } catch (e) {
          pending.reject(e)
          throw e
        }
      }
      return res
    } catch (e: any) {
      if (!configAuthError.value) {
        configAuthError.value = e?.data?.error || e?.message || 'Autenticazione fallita'
      }
      throw e
    }
  }

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

    const method = (options.method ?? 'GET').toUpperCase()
    const isWrite = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE'

    if (isWrite && isEspConnected.value && configAuthChecked.value && configAuthRequired.value && !configAuthenticated.value && isConfigWriteTarget(path)) {
      return requestConfigAuthModal(path, options)
    }

    const headers: Record<string, string> = { 'x-esp-ip': espIp.value, ...options.headers }
    const body = options.body !== undefined ? JSON.stringify(options.body) : undefined
    if (body !== undefined) headers['content-type'] = 'application/json'

    try {
      return await $fetch(`/api/esp/${path}`, {
        method: options.method ?? 'GET',
        headers,
        body,
        timeout: options.timeout ?? 6000
      }) as Promise<T>
    } catch (e: any) {
      const status = e?.statusCode || e?.status || e?.response?.status
      const msg = e?.data?.message || e?.data?.error || e?.message || ''
      if (isWrite && isEspConnected.value && (status === 401 || /app.*auth|password|unauthorized/i.test(String(msg)))) {
        configAuthRequired.value = true
        configAuthenticated.value = false
        if (!configAuthChecked.value) configAuthChecked.value = true
        return requestConfigAuthModal(path, options)
      }
      throw e
    }
  }

  const refresh = async () => {
    isChecking.value = true
    lastError.value = null
    try {
      if (isSimulated.value) {
        isEspConnected.value = true
        deviceInfo.value = virtualCapabilities()
        await checkConfigAuth()
        return
      }
      const data = await proxyFetch<unknown>('api/capabilities', { timeout: 4500 })
      isEspConnected.value = true
      deviceInfo.value = typeof data === 'object' && data !== null
        ? data as Record<string, unknown>
        : null
      await checkConfigAuth()
    } catch (error) {
      isEspConnected.value = false
      deviceInfo.value = null
      lastError.value = error instanceof Error ? error.message : 'ESP unreachable'
      configAuthRequired.value = false
      configAuthenticated.value = false
      configAuthChecked.value = true
      configAuthConnKey.value = getConnKey()
    } finally {
      isChecking.value = false
    }
  }

  const connect = async (address: string) => {
    espIp.value = address
    if (import.meta.client) {
      localStorage.setItem(ESP_IP_KEY, address)
    }
    configAuthenticated.value = false
    configAuthRequired.value = false
    configAuthChecked.value = false
    pendingConfigRequest.value = null
    configAuthError.value = ''
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

  return { 
    espIp, 
    isEspConnected, 
    isChecking, 
    lastError, 
    deviceInfo, 
    isSimulated, 
    transport, 
    isWifiTransport, 
    isUsbTransport, 
    canTelemetry, 
    canConfig, 
    canOta, 
    canFlashUsb, 
    proxyFetch, 
    refresh, 
    connect,
    configAuthRequired,
    configAuthenticated,
    configAuthError,
    configAuthChecked,
    checkConfigAuth,
    submitConfigAuth,
    pendingConfigRequest
  }
}

export const useEspConnection = createSharedComposable(_useEspConnection)
