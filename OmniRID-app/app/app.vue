<script setup lang="ts">
const route = useRoute()

const nav = [
  { label: 'Dashboard', icon: 'i-tabler-gauge', to: '/' },
  { label: 'Mappa', icon: 'i-tabler-map', to: '/map' },
  { label: 'Dispositivi', icon: 'i-tabler-devices', to: '/devices' },
  { label: 'Timeline', icon: 'i-tabler-timeline', to: '/timeline' },
  { label: 'Cattura', icon: 'i-tabler-radio', to: '/capture' },
  { label: 'Impostazioni', icon: 'i-tabler-settings', to: '/settings' },
  { label: 'Guida', icon: 'i-tabler-book', to: '/guide' },
  { label: 'Info', icon: 'i-tabler-info-circle', to: '/about' },
]
</script>

<template>
  <div class="omnirid-shell">
    <UApp>
      <div class="omnirid-body">
        <aside class="omnirid-sidebar border-r border-gray-200 dark:border-gray-800 p-4">
          <NuxtLink to="/" class="omnirid-brand mb-6">
            <img :src="`${useRuntimeConfig().app.baseURL}icons/logo.svg`" alt="OmniRID">
            <div>
              <div class="text-sm font-bold">OmniRID <span class="text-primary-500">App</span></div>
              <div class="text-xs text-muted">Ground Station PWA</div>
            </div>
          </NuxtLink>

          <div class="flex flex-col gap-1">
            <NuxtLink
              v-for="item in nav"
              :key="item.label"
              :to="item.to"
              class="px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors"
              :class="route.path === item.to
                ? 'bg-primary-500 text-white font-medium'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'"
            >
              <UIcon :name="item.icon" class="w-4 h-4 shrink-0" />
              <span>{{ item.label }}</span>
            </NuxtLink>
          </div>
        </aside>

        <main class="omnirid-main">
          <NuxtPage />
        </main>
      </div>
    </UApp>
  </div>
</template>