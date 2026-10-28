// Registers the PWA service worker (`public/sw.js`). Only in the browser and
// only in production builds / HTTPS-served deployments, and skipped on the
// dev server where a stale SW would shadow live modules.
export default defineNuxtPlugin(() => {
  if (import.meta.dev) return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  if (!window.isSecureContext) return

  const baseURL = useRuntimeConfig().app.baseURL
  const { notifyInfo } = useNotifications()

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${baseURL}sw.js`, { scope: baseURL })
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing
          if (installing) {
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                notifyInfo('App updated', 'A new version is available. Reload to update.')
              }
            })
          }
        })
      })
      .catch(() => {
        // Registration is best-effort: the app works without the SW.
      })
  })

  window.addEventListener('online', () => notifyInfo('Back online', 'Connection restored.'))
  window.addEventListener('offline', () => notifyInfo('Offline mode', 'App is available offline. Some features may be limited.'))
})
