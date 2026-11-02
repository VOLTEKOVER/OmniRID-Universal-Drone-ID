// Registers the PWA service worker (`public/sw.js`). Only in the browser and
// only in production builds / HTTPS-served deployments, and skipped on the
// dev server where a stale SW would shadow live modules.
export default defineNuxtPlugin(() => {
  const offlineAvailability = useState<'checking' | 'ready' | 'online-only'>(
    'omnirid-offline-availability',
    () => 'checking'
  )

  if (import.meta.dev || typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !window.isSecureContext) {
    offlineAvailability.value = 'online-only'
    return
  }

  const baseURL = useRuntimeConfig().app.baseURL
  const { notifyInfo } = useNotifications()

  const updateAvailability = async (registration: ServiceWorkerRegistration) => {
    try {
      const active = registration.active ?? (await navigator.serviceWorker.ready).active
      if (!active || active.state !== 'activated' || !navigator.serviceWorker.controller) {
        offlineAvailability.value = 'checking'
        return
      }

      const cachedShell = await caches.match(new URL('./', registration.scope).href)
      offlineAvailability.value = cachedShell ? 'ready' : 'checking'
    } catch {
      offlineAvailability.value = 'online-only'
    }
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${baseURL}sw.js`, { scope: baseURL })
      .then((reg) => {
        void updateAvailability(reg)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          void updateAvailability(reg)
        })
        reg.addEventListener('updatefound', () => {
          offlineAvailability.value = 'checking'
          const installing = reg.installing
          if (installing) {
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                notifyInfo('App updated', 'A new version is available. Reload to update.')
              }
              if (installing.state === 'activated') void updateAvailability(reg)
            })
          }
        })
      })
      .catch(() => {
        offlineAvailability.value = 'online-only'
      })
  })

  window.addEventListener('online', () => notifyInfo('Back online', 'Connection restored.'))
  window.addEventListener('offline', () => notifyInfo('Offline mode', 'App is available offline. Some features may be limited.'))
})
