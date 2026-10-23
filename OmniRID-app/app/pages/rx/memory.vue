<script setup lang="ts">
import { pageForRoute, pageStatusMeta } from '~/pages.config'

const route = useRoute()
const page = computed(() => pageForRoute(route.path))
const heroTitle = computed(() => page.value?.label ?? 'Memory')
const heroStatus = computed(() => page.value ? pageStatusMeta(page.value.status) : undefined)

const planned = [
  'Capacity used by detection history and packet captures',
  'Retention policy (ring buffer, max detections, auto-purge)',
  'Export and clear of stored captures'
]
</script>

<template>
  <UDashboardPanel id="rx-memory" class="bg-default" :ui="{ root: 'pt-16' }">
    <template #body>
      <div class="mx-auto w-full max-w-[1400px] space-y-6 px-4 pb-16 sm:px-6 lg:px-10">
        <SectionTabs group="rx" class="mb-2" />
        <PageHero
          :title="heroTitle"
          icon="i-lucide-database"
          description="Storage for captures, detections and logs."
          :status="heroStatus"
          size="sm"
        />

        <UAlert
          color="warning"
          variant="soft"
          icon="i-lucide-triangle-alert"
          title="Not implemented yet"
          description="RX storage is not available: no receiver firmware exists yet."
        />

        <ContentSection title="Planned" description="Storage management for the future RX firmware.">
          <ul class="list-inside list-disc space-y-1.5 text-sm text-muted">
            <li v-for="item in planned" :key="item">
              {{ item }}
            </li>
          </ul>
        </ContentSection>
      </div>
    </template>
  </UDashboardPanel>
</template>
