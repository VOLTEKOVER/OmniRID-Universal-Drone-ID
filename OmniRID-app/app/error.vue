<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

const is404 = computed(() => props.error.statusCode === 404)
const title = computed(() => is404.value ? 'Page not found' : 'Something went wrong')
const description = computed(() => is404.value
  ? 'We are sorry but this page could not be found.'
  : 'An unexpected error occurred while rendering this page.')

const displayError = computed(() => ({
  ...props.error,
  statusMessage: title.value,
  message: description.value
}))

useSeoMeta({
  title,
  description
})

useHead({
  htmlAttrs: {
    lang: 'en'
  }
})

if (import.meta.dev) {
  console.error('[nuxt] error', props.error)
}
</script>

<template>
  <UApp>
    <UError :error="displayError" />
  </UApp>
</template>
