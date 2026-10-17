import { createSharedComposable, useIntervalFn } from '@vueuse/core'

export type FirmwareLogLevel = 'debug' | 'info' | 'warning' | 'error' | 'command'

export type FirmwareLogLine = {
  id: number
  at: number
  level: FirmwareLogLevel
  text: string
}

type FirmwareLogEntry = {
  t?: number
  l?: string
  m?: string
}

/** How many lines the shared buffer keeps before trimming the oldest. */
const MAX_LINES = 500
/** Guard against the dedup set growing without bound on long sessions. */
const MAX_SEEN = 4000

const levelCharMap: Record<string, FirmwareLogLevel> = {
  D: 'debug', d: 'debug', 0: 'debug',
  I: 'info', i: 'info', 1: 'info', 2: 'info',
  W: 'warning', w: 'warning', 3: 'warning',
  E: 'error', e: 'error', 4: 'error', 5: 'error',
  6: 'error'
}

export const firmwareLogLevel = (level?: string): FirmwareLogLevel => levelCharMap[level ?? ''] ?? 'info'

/**
 * Shared firmware console buffer.
 *
 * A single poller serves both the Console page and the notification pipeline:
 * every `warning`/`error` line returned by `GET /api/logs` is mirrored into
 * the notification panel, whether or not the Console page is open. The poller
 * is started once from the dashboard layout so it runs app-wide.
 */
const _useFirmwareLogs = () => {
  const { isEspConnected, proxyFetch } = useEspConnection()
  const { ingestFirmwareLog } = useNotifications()

  const lines = ref<FirmwareLogLine[]>([])
  const seen = new Set<string>()
  let lineId = 0

  /** Append a line (firmware or local command echo) to the shared buffer. */
  const push = (level: FirmwareLogLevel, text: string, at = Date.now()) => {
    lines.value.push({ id: ++lineId, at, level, text })
    if (lines.value.length > MAX_LINES) {
      lines.value.splice(0, lines.value.length - MAX_LINES)
    }
  }

  const poll = async () => {
    if (!isEspConnected.value) return
    try {
      const data = await proxyFetch<FirmwareLogEntry[] | null>('api/logs', { timeout: 3000 })
      if (!Array.isArray(data)) return
      for (const row of data) {
        const text = String(row.m ?? '').trim()
        if (!text) continue
        const stamp = Number(row.t ?? 0)
        const key = `${stamp}:${text}`
        if (seen.has(key)) continue
        seen.add(key)
        if (seen.size > MAX_SEEN) seen.clear()

        const level = firmwareLogLevel(row.l)
        push(level, text, stamp || Date.now())
        if (level === 'warning' || level === 'error') {
          ingestFirmwareLog(level, text)
        }
      }
    } catch {
      // Logs are best-effort; connection problems surface through the
      // connection notifications and the header badge.
    }
  }

  const { pause, resume } = useIntervalFn(poll, 3000)

  watch(isEspConnected, (connected) => {
    if (connected) {
      poll()
      resume()
    } else {
      pause()
    }
  }, { immediate: true })

  const clear = () => {
    lines.value = []
  }

  return { lines, push, clear }
}

export const useFirmwareLogs = createSharedComposable(_useFirmwareLogs)
