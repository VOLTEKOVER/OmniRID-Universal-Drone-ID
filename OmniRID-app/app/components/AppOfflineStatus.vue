<template>
  <UTooltip :text="tooltip">
    <div class="flex shrink-0 items-center gap-1.5" role="status" aria-live="polite">
      <span class="relative flex size-2">
        <span v-if="availability === 'ready'" class="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-40" />
        <span class="relative inline-flex size-2 rounded-full" :class="indicatorColor" />
      </span>
      <span class="hidden text-xs text-muted lg:inline">{{ label }}</span>
    </div>
  </UTooltip>
</template>

<script setup lang="ts">
type OfflineAvailability = 'checking' | 'ready' | 'online-only'

const availability = useState<OfflineAvailability>('omnirid-offline-availability', () => 'checking')

const label = computed(() => {
  if (availability.value === 'ready') return 'Offline ready'
  if (availability.value === 'checking') return 'Preparing app'
  return 'Online only'
})

const indicatorColor = computed(() => {
  if (availability.value === 'ready') return 'bg-emerald-500'
  if (availability.value === 'checking') return 'bg-amber-500'
  return 'bg-muted'
})

const tooltip = computed(() => {
  if (availability.value === 'ready') return 'App shell cached in this browser. Live data, maps, and device connections may need internet.'
  if (availability.value === 'checking') return 'Checking offline app availability.'
  return 'Offline app cache is not available in this browser.'
})
</script>
