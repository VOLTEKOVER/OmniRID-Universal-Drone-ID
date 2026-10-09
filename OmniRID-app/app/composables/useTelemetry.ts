import { createSharedComposable, useIntervalFn } from '@vueuse/core'

export type TelemetryStatus = Record<string, unknown> & {
  fw_version?: string
  protocol?: number
  gps_valid?: boolean
  lat?: number
  lon?: number
  alt?: number
  speed?: number
  heading?: number
  satellites?: number
  fix_type?: number
  standard?: string
  standard_fallback?: boolean
  tx_total?: number
  tx_wifi_bcn?: number
  tx_wifi_nan?: number
  tx_ble4?: number
  tx_ble5?: number
  takeoff_captured?: boolean
  takeoff_lat?: number
  takeoff_lon?: number
  takeoff_alt?: number
  uptime_ms?: number
}

const _useTelemetry = () => {
  const { isEspConnected, proxyFetch } = useEspConnection()

  const status = ref<TelemetryStatus>({})
  const lastUpdate = ref<number | null>(null)
  const lastError = ref<string | null>(null)

  const poll = async () => {
    if (!isEspConnected.value) return
    try {
      const data = await proxyFetch<Record<string, unknown> | null>('api/status', { timeout: 4000 })
      if (data && typeof data === 'object') {
        status.value = data as TelemetryStatus
        lastError.value = null
        lastUpdate.value = Date.now()
      }
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : 'Status request failed'
    }
  }

  const { pause, resume, isActive } = useIntervalFn(poll, 2000)

  const start = () => {
    if (isEspConnected.value) poll()
    resume()
  }
  const stop = pause

  watch(isEspConnected, (connected) => {
    if (connected) start()
    else stop()
  })

  onMounted(() => {
    if (isEspConnected.value) start()
  })

  return { status, lastUpdate, lastError, isActive, start, stop }
}

export const useTelemetry = createSharedComposable(_useTelemetry)
