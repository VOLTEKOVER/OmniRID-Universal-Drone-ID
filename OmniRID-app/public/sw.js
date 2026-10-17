/* OmniRID service worker — offline app shell for the static PWA.
 *
 * Deliberately dependency-free (no Workbox): the deploy target (GitHub Pages)
 * has no build step for the SW and we want the exact filenames the CI verifies
 * (`sw.js`). The scope is the app base path, so every URL below is relative.
 *
 * Caching policy:
 *   - navigations .............. network-first, fall back to the cached shell
 *   - same-origin static ....... stale-while-revalidate
 *   - /api/ and cross-origin ... never cached (device data / map tiles)
 */

const VERSION = 'omnirid-v1'
const SHELL_CACHE = `${VERSION}-shell`
const ASSET_CACHE = `${VERSION}-assets`

const SHELL_URLS = ['./', './manifest.webmanifest', './favicon.ico', './icons/icon-192.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_URLS).catch(() => undefined))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('omnirid-') && key !== SHELL_CACHE && key !== ASSET_CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  )
})

function isApiRequest(url) {
  return url.pathname.includes('/api/')
}

function isStaticAsset(url) {
  return /\/(_nuxt|_fonts|fonts|images|icons|vendor)\//.test(url.pathname)
    || /\.(?:js|mjs|css|woff2?|png|jpe?g|svg|webp|ico|json|webmanifest)$/.test(url.pathname)
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only GET is cacheable; let everything else hit the network untouched.
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Never cache device API traffic.
  if (isApiRequest(url)) return

  // Cross-origin (e.g. map tiles): straight to the network, no caching.
  if (url.origin !== self.location.origin) return

  // App shell navigations: network-first with an offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(SHELL_CACHE).then(cache => cache.put('./', copy)).catch(() => undefined)
          return response
        })
        .catch(() => caches.match('./').then(cached => cached || Response.error()))
    )
    return
  }

  if (!isStaticAsset(url)) return

  // Static assets: serve from cache, refresh in the background.
  event.respondWith(
    caches.open(ASSET_CACHE).then(async (cache) => {
      const cached = await cache.match(request)
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            cache.put(request, response.clone()).catch(() => undefined)
          }
          return response
        })
        .catch(() => cached)
      return cached || network
    })
  )
})
