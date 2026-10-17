import { createSharedComposable } from '@vueuse/core'

export type SystemNotificationType = 'error' | 'warning' | 'info'

export type SystemNotification = {
  id: number
  unread?: boolean
  type: SystemNotificationType
  title: string
  body: string
  date: string
}

const buildSeed = (): SystemNotification[] => [{
  id: 1,
  unread: true,
  type: 'info',
  title: 'Dashboard ready',
  body: 'Waiting for the ESP32 connection. Set the device address from the header to begin.',
  date: new Date().toISOString()
}, {
  id: 2,
  unread: true,
  type: 'warning',
  title: 'Configuration checklist pending',
  body: 'Complete the identity, flight controller and transmission steps to prepare the device.',
  date: new Date(Date.now() - 60_000).toISOString()
}]

const _useNotifications = () => {
  const notifications = ref<SystemNotification[]>(buildSeed())
  let nextId = Math.max(0, ...notifications.value.map(notification => notification.id))

  const add = (type: SystemNotificationType, title: string, body: string) => {
    nextId += 1
    notifications.value.unshift({ id: nextId, unread: true, type, title, body, date: new Date().toISOString() })
  }

  const markAllRead = () => {
    for (const notification of notifications.value) notification.unread = false
  }

  const clear = () => {
    notifications.value = []
  }

  const unreadCount = computed(() => notifications.value.filter(notification => notification.unread).length)

  const { isEspConnected, espIp } = useEspConnection()
  let wasConnected: boolean | null = null

  watch(isEspConnected, (connected) => {
    if (wasConnected === null) {
      wasConnected = connected
      return
    }
    wasConnected = connected
    if (connected) {
      add('info', 'ESP connected', `Connected to ${espIp.value}.`)
    } else {
      add('error', 'ESP connection lost', `Could not reach ${espIp.value}. Check the address and WiFi.`)
    }
  }, { flush: 'post' })

  return { notifications, unreadCount, add, markAllRead, clear }
}

export const useNotifications = createSharedComposable(_useNotifications)
