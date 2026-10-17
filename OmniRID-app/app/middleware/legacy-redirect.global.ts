// Pages that were merged into others. The same mapping is declared in
// `nuxt.config.ts` `routeRules` (for SSR / self-hosted deployments), but that
// server-side redirect does not exist on GitHub Pages where the app is a static
// SPA — so apply the redirects client-side too.
const LEGACY_REDIRECTS: Record<string, string> = {
  '/device/inputs': '/device/flight-controller',
  '/device/sensors': '/tools/logging',
  '/tools/sensors': '/tools/logging',
  '/device/system': '/compliance-security/security',
  '/compliance-security/compliance': '/device/nation'
}

export default defineNuxtRouteMiddleware((to) => {
  const target = LEGACY_REDIRECTS[to.path]
  if (target) {
    return navigateTo(target, { redirectCode: 301, replace: true })
  }
})
