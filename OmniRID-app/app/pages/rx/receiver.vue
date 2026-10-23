<script setup lang="ts">
import { pageForRoute, pageStatusMeta } from '~/pages.config'

const route = useRoute()
const page = computed(() => pageForRoute(route.path))
const heroTitle = computed(() => page.value?.label ?? 'Receiver')
const heroStatus = computed(() => page.value ? pageStatusMeta(page.value.status) : undefined)

const planned = [
  'Scan WiFi Beacon / NAN and BLE Remote ID broadcasts on the selected channels',
  'Live table of detected drones: UAS ID, operator, position, altitude and speed',
  'Signal strength, first/last seen and estimated distance'
]
</script>

<template>
  <UDashboardPanel id="rx-receiver" class="bg-default" :ui="{ root: 'pt-16' }">
    <template #body>
      <div class="mx-auto w-full max-w-[1400px] space-y-6 px-4 pb-16 sm:px-6 lg:px-10">
        <SectionTabs group="rx" class="mb-2" />
        <PageHero
          :title="heroTitle"
          icon="i-lucide-radar"
          description="Receiver antenna, scan channels and live Remote ID detections."
          :status="heroStatus"
          size="sm"
        />

        <UAlert
          color="warning"
          variant="soft"
          icon="i-lucide-triangle-alert"
          title="Not implemented yet"
          description="The current firmware is a transmitter only (OmniRID TX). The RX firmware and API are still to be designed."
        />

        <ContentSection title="Planned" description="What this page will show once the RX firmware exposes an API.">
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
