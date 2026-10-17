// Registers the PWA service worker (`public/sw.js`). Only in the browser and
// only in production builds / HTTPS-served deployments, and skipped on the
// dev server where a stale SW would shadow live modules.
export default defineNuxtPlugin(() => {
  if (import.meta.dev) return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  // Service workers require a secure context (HTTPS or localhost).
  if (!window.isSecureContext) return

  const baseURL = useRuntimeConfig().app.baseURL

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${baseURL}sw.js`, { scope: baseURL })
      .catch(() => {
        // Registration is best-effort: the app works without the SW.
      })
  })
})
