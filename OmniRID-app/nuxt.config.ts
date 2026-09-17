import { defineNuxtConfig } from 'nuxt/config'

// GitHub Pages deploy: the app lives under /OmniRID-Universal-Drone-ID/OmniRID-app/.
// Override with NUXT_APP_BASE_URL=/ for local dev.
const baseURL = process.env.NUXT_APP_BASE_URL || '/OmniRID-Universal-Drone-ID/OmniRID-app/'

export default defineNuxtConfig({
  srcDir: 'app',
  ssr: false,
  app: {
    baseURL,
    head: {
      title: 'OmniRID App',
      htmlAttrs: { lang: 'it' },
      meta: [
        { name: 'theme-color', content: '#1a56db' },
        { name: 'description', content: 'Open DroneID Ground Station — ASTM F3411-22a decoder, tracker and map (PWA)' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: `${baseURL}icons/logo.svg` },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' },
      ],
    },
  },

  css: ['~/assets/css/main.css'],

  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
  ],

  modules: [
    '@nuxt/ui',
    '@pinia/nuxt',
    '@vite-pwa/nuxt',
  ],

  ui: {
    global: true,
  },

  colorMode: {
    preference: 'light',
    fallback: 'light',
  },

  pwa: {
    registerType: 'autoUpdate',
    registerWebManifestInRouteRules: false,
    manifest: {
      name: 'OmniRID App',
      short_name: 'OmniRID',
      description: 'Open DroneID Ground Station — ASTM F3411-22a decoder, tracker and map (PWA)',
      lang: 'it',
      display: 'standalone',
      orientation: 'any',
      start_url: baseURL,
      scope: baseURL,
      theme_color: '#1a56db',
      background_color: '#0d0d0d',
      icons: [
        { src: `${baseURL}icons/logo.svg`, sizes: '48x48 72x72 96x96 128x128 192x192 256x256 512x512', type: 'image/svg+xml', purpose: 'any' },
        { src: `${baseURL}icons/logo-maskable.svg`, sizes: '192x192 256x256 384x384 512x512', type: 'image/svg+xml', purpose: 'maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      navigateFallback: `${baseURL}index.html`,
      navigateFallbackDenylist: [/\/api\//],
    },
    devOptions: { enabled: false },
  },

  nitro: {
    preset: 'static',
    prerender: { failOnError: false },
  },

  devtools: { enabled: false },

  compatibilityDate: '2026-09-17',
})