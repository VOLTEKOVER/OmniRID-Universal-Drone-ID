// Routes that changed when pages were reorganized. Handled only by this
// client-side middleware: declaring them as `routeRules` redirects in
// `nuxt.config.ts` would register a second, empty route for each old path and
// duplicate the page routes. Unmatched paths still fall through to the 404.
const LEGACY_REDIRECTS: Record<string, string> = {
  // Pages merged into others before the /tx reorganization.
  '/device/inputs': '/tx/hardware',
  '/device/sensors': '/tx/logging',
  '/tools/sensors': '/tx/logging',
  '/device/system': '/tx/security',
  '/compliance-security/compliance': '/tx/nation-standard-transmission',
  // Pre-/tx paths (still referenced by old links and bookmarks).
  '/device/nation': '/tx/nation-standard-transmission',
  '/device/identity': '/tx/identity',
  '/device/flight-controller': '/tx/hardware',
  '/tx/flight-controller': '/tx/hardware',
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
