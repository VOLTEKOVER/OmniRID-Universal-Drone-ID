<script setup lang="ts">
import { pageForRoute, pageStatusMeta } from '~/pages.config'

const route = useRoute()
const page = computed(() => pageForRoute(route.path))
const heroTitle = computed(() => page.value?.label ?? 'Hardware')
const heroStatus = computed(() => page.value ? pageStatusMeta(page.value.status) : undefined)

const planned = [
  'Receiver board and radio module selection (WiFi + BLE combo, external antenna)',
  'GPIO mapping for status LED, buzzer and buttons',
  'Channel plan and antenna gain for the scan front-end'
]
</script>

<template>
  <UDashboardPanel id="rx-hardware" class="bg-default" :ui="{ root: 'pt-16' }">
    <template #body>
      <div class="mx-auto w-full max-w-[1400px] space-y-6 px-4 pb-16 sm:px-6 lg:px-10">
        <SectionTabs group="rx" class="mb-2" />
        <PageHero
          :title="heroTitle"
          icon="i-lucide-cpu"
          description="Receiver board, radio module and GPIO mapping."
          :status="heroStatus"
          size="sm"
        />

        <UAlert
          color="warning"
          variant="soft"
          icon="i-lucide-triangle-alert"
          title="Not implemented yet"
          description="RX hardware configuration is not available: no receiver firmware exists yet."
        />

        <ContentSection title="Planned" description="Configuration surfaces for the future RX board.">
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
