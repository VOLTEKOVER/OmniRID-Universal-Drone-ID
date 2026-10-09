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

const activeTabIndex = computed(() => Math.max(0, tabItems.value.findIndex(item => route.path === item.to)))
</script>

<template>
  <UTabs v-if="tabItems.length > 1" :key="route.path" :default-value="activeTabIndex" :items="tabItems" size="sm" />
</template>