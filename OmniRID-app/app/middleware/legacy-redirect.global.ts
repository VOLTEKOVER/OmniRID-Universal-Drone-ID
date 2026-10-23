// Routes that changed when pages were reorganized. The same mapping is
// declared in `nuxt.config.ts` `routeRules` (for SSR / self-hosted
// deployments), but that server-side redirect does not exist on static hosting
// where the app is a plain SPA — so apply the redirects client-side too.
const LEGACY_REDIRECTS: Record<string, string> = {
  // Pages merged into others before the /tx reorganization.
  '/device/inputs': '/tx/flight-controller',
  '/device/sensors': '/tx/logging',
  '/tools/sensors': '/tx/logging',
  '/device/system': '/tx/security',
  '/compliance-security/compliance': '/tx/nation-standard-transmission',
  // Pre-/tx paths (still referenced by old links and bookmarks).
  '/device/nation': '/tx/nation-standard-transmission',
  '/device/identity': '/tx/identity',
  '/device/flight-controller': '/tx/flight-controller',
  '/device/hardware': '/tx/hardware',
  '/device/memory': '/tx/memory',
  '/compliance-security/security': '/tx/security',
  '/tools/console': '/tx/console',
  '/tools/presets': '/tx/presets',
  '/tools/logging': '/tx/logging',
  '/docs/guide': '/guide'
}

export default defineNuxtRouteMiddleware((to) => {
  const target = LEGACY_REDIRECTS[to.path]
  if (target) {
    return navigateTo({ path: target, hash: to.hash }, { redirectCode: 301, replace: true })
  }
})
