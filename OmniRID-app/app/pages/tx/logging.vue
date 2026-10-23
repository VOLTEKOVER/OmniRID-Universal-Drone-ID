<script setup lang="ts">
import { pageForRoute, pageStatusMeta } from '~/pages.config'

const route = useRoute()
const page = computed(() => pageForRoute(route.path))
const heroTitle = computed(() => page.value?.label ?? 'Logging')
const heroStatus = computed(() => page.value ? pageStatusMeta(page.value.status) : undefined)

const readings = [
  { name: 'firmware', label: 'Firmware', value: '--' },
  { name: 'gps_fix', label: 'GPS fix', value: '--' },
  { name: 'satellites', label: 'Satellites', value: '--' },
  { name: 'latitude', label: 'Latitude', value: '--' },
  { name: 'longitude', label: 'Longitude', value: '--' },
  { name: 'altitude', label: 'Altitude', value: '--' },
  { name: 'speed', label: 'Speed', value: '--' },
  { name: 'heading', label: 'Heading', value: '--' },
  { name: 'tx_rate', label: 'TX rate', value: '--' },
  { name: 'cpu_temperature', label: 'CPU temperature', value: '--' }
]
</script>

<template>
  <UDashboardPanel id="tools-logging" class="bg-default" :ui="{ root: 'pt-16' }">
    <template #body>
      <div class="mx-auto w-full max-w-[1400px] space-y-6 px-4 pb-16 sm:px-6 lg:px-10">
        <SectionTabs group="tx" class="mb-2" />
        <PageHero
          :title="heroTitle"
          icon="i-lucide-file-text"
          description="Record live telemetry while flying or bench-testing, then export it as a CSV file."
          :status="heroStatus"
          size="sm"
        />

        <ContentSection title="Telemetry log" description="Samples are captured every 2 seconds from the device.">
          <TelemetryRecorder />
        </ContentSection>

        <ContentSection title="Live sensor readings" description="Values refresh from the connected device while telemetry is available.">
          <div class="grid gap-5 md:grid-cols-2">
            <UFormField v-for="reading in readings" :key="reading.name" :label="reading.label">
              <UInput :model-value="reading.value" disabled class="w-full" />
            </UFormField>
          </div>
        </ContentSection>
      </div>
    </template>
  </UDashboardPanel>
</template>
