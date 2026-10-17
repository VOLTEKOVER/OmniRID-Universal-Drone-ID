<script setup lang="ts">
const colorMode = useColorMode()

const color = computed(() => colorMode.value === 'dark' ? '#06090d' : 'white')

// Static PWA/head metadata (manifest, icons, referrer, apple-* metas) lives in
// nuxt.config.ts so it is present in the static HTML shell. Only the reactive
// theme colour is set here.
useHead({
  meta: [
    { key: 'theme-color', name: 'theme-color', content: color }
  ]
})

const title = 'OmniRID'
const description = 'Universal ASTM Remote ID transmitter and ESP32 configuration dashboard.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <UApp>
    <NuxtLoadingIndicator />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
