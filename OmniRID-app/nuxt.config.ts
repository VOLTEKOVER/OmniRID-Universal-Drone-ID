// https://nuxt.com/docs/api/configuration/nuxt-config

// Static hosting (GitHub Pages) serves the app from a sub-path; every absolute
// asset reference in <head> must be prefixed with it.
const baseURL = process.env.NUXT_APP_BASE_URL || '/'

export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vueuse/nuxt'
  ],

  // The app is published as a static PWA to GitHub Pages, where no server runs.
  // Rendering client-side keeps the output a plain SPA (index.html + hashed
  // assets) and avoids hydration mismatches with device/telemetry state.
  ssr: false,

  devtools: {
    enabled: process.env.NODE_ENV !== 'production'
  },

  app: {
    baseURL,
    head: {
      title: 'OmniRID',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'referrer', content: 'no-referrer' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'OmniRID' }
      ],
      link: [
        { rel: 'icon', href: `${baseURL}favicon.ico` },
        { rel: 'manifest', href: `${baseURL}manifest.webmanifest` },
        { rel: 'apple-touch-icon', href: `${baseURL}icons/apple-touch-icon.png` }
      ],
      htmlAttrs: {
        lang: 'en'
      }
    }
  },

  css: ['~/assets/css/main.css'],

  css: ['~/assets/css/main.css'],

  routeRules: {
    '/api/**': {
      cors: true
    },
    // Pages merged into other pages: keep old links working.
    '/device/inputs': { redirect: '/device/flight-controller' },
    '/device/sensors': { redirect: '/tools/logging' },
    '/tools/sensors': { redirect: '/tools/logging' },
    '/device/system': { redirect: '/compliance-security/security' },
    '/compliance-security/compliance': { redirect: '/device/nation' }
  },

  // Never ship JavaScript source maps: they make the client bundle trivial to
  // reconstruct. (Server maps also stay off for self-hosted deployments.)
  sourcemap: {
    server: false,
    client: false
  },

  compatibilityDate: '2026-06-30',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
