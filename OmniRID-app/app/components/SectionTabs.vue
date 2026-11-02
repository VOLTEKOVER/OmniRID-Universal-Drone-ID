<script setup lang="ts">
import { pageGroups } from '~/pages.config'

const props = defineProps<{ group: string }>()
const route = useRoute()
const { settings } = useAppSettings()

const tabItems = computed(() => {
  const group = pageGroups.find(item => item.id === props.group)
  return (group?.items ?? [])
    .filter(item => item.status !== 'wip' || settings.value.expertMode)
    .map(item => ({ label: item.label, icon: item.icon, to: item.to }))
})
</script>

<template>
  <nav
    v-if="tabItems.length > 1"
    class="flex flex-wrap items-center gap-1 rounded-lg border border-default bg-elevated/40 p-1"
    aria-label="Section navigation"
  >
    <NuxtLink
      v-for="tab in tabItems"
      :key="tab.to"
      :to="tab.to"
      class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors"
      :class="route.path === tab.to
        ? 'bg-primary/15 text-primary'
        : 'text-muted hover:bg-elevated hover:text-highlighted'"
    >
      <UIcon :name="tab.icon" class="size-4 shrink-0" />
      <span class="whitespace-nowrap">{{ tab.label }}</span>
    </NuxtLink>
  </nav>
</template>
