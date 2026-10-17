import { createSharedComposable } from '@vueuse/core'

export type SystemNotificationType = 'error' | 'warning' | 'info'

/**
 * Where a notification came from:
 * - `app`        — raised by the web app itself (validation, request failures…)
 * - `firmware`   — mirrored from the ESP32 console (`GET /api/logs`)
 * - `connection` — connection lifecycle events
 */
export type SystemNotificationSource = 'app' | 'firmware' | 'connection'

export type SystemNotification = {
  id: number
  unread?: boolean
  type: SystemNotificationType
  title: string
  body: string
  date: string
  source: SystemNotificationSource
  /** How many identical events were merged into this entry. */
  count: number
}

/** Hard cap on retained history so the panel never grows unbounded. */
const MAX_NOTIFICATIONS = 100

const _useNotifications = () => {
  const notifications = ref<SystemNotification[]>([])
  let nextId = 0

  /**
   * Record a notification. Repeats of the exact same (type, title, body)
   * merge into the existing entry (bumping `count`) instead of piling up
   * duplicates — this keeps a chatty source such as the firmware log ring
   * from flooding the panel.
   */
  const add = (
    type: SystemNotificationType,
    title: string,
    body: string,
    source: SystemNotificationSource = 'app'
  ) => {
    const existing = notifications.value.find(
      notification => notification.type === type && notification.title === title && notification.body === body
    )
    if (existing) {
      existing.count += 1
      existing.unread = true
      existing.date = new Date().toISOString()
      return existing
    }

    nextId += 1
    const notification: SystemNotification = {
      id: nextId,
      unread: true,
      type,
      title,
      body,
      date: new Date().toISOString(),
      source,
      count: 1
    }
    notifications.value.unshift(notification)
    if (notifications.value.length > MAX_NOTIFICATIONS) {
      notifications.value.splice(MAX_NOTIFICATIONS)
    }
    return notification
  }

  const notifyError = (title: string, body: string, source: SystemNotificationSource = 'app') =>
    add('error', title, body, source)
  const notifyWarning = (title: string, body: string, source: SystemNotificationSource = 'app') =>
    add('warning', title, body, source)
  const notifyInfo = (title: string, body: string, source: SystemNotificationSource = 'app') =>
    add('info', title, body, source)

  /** Mirror a firmware console warning/error into the notification panel. */
  const ingestFirmwareLog = (level: 'warning' | 'error', text: string) => {
    if (level === 'error') notifyError('Firmware error', text, 'firmware')
    else notifyWarning('Firmware warning', text, 'firmware')
  }

  const markAllRead = () => {
    for (const notification of notifications.value) notification.unread = false
  }

  const remove = (id: number) => {
    notifications.value = notifications.value.filter(notification => notification.id !== id)
  }

  const clear = () => {
    notifications.value = []
  }

  const unreadCount = computed(() => notifications.value.filter(notification => notification.unread).length)
  const errorCount = computed(() => notifications.value.filter(notification => notification.type === 'error').length)
  const warningCount = computed(() => notifications.value.filter(notification => notification.type === 'warning').length)

  // Connection lifecycle → notifications. `useEspConnection.refresh()` is the
  // only writer of `isEspConnected` and it clears `isChecking` once a probe
  // finishes, so keying off both yields exactly one notification per resolved
  // state (online / offline) and nothing during the transient "checking" phase.
  const { isEspConnected, isChecking, espIp, lastError } = useEspConnection()
  let connectionState: 'unknown' | 'online' | 'offline' = 'unknown'

  watch([isChecking, isEspConnected], ([checking, connected]) => {
    if (checking) return
    const next = connected ? 'online' : 'offline'
    if (next === connectionState) return
    const previous = connectionState
    connectionState = next

    if (next === 'online') {
      notifyInfo('ESP connected', `Connected to ${espIp.value}.`, 'connection')
    } else {
      const detail = lastError.value ?? 'Check the device address and WiFi.'
      if (previous === 'online') {
        notifyError('ESP connection lost', `Lost the connection to ${espIp.value}. ${detail}`, 'connection')
      } else {
        notifyWarning('ESP unreachable', `Could not reach ${espIp.value}. ${detail}`, 'connection')
      }
    }
  }, { flush: 'post' })

  return {
    notifications,
    unreadCount,
    errorCount,
    warningCount,
    add,
    notifyError,
    notifyWarning,
    notifyInfo,
    ingestFirmwareLog,
    markAllRead,
    remove,
    clear
  }
}

export const useNotifications = createSharedComposable(_useNotifications)
