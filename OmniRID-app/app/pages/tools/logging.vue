<script setup lang="ts">
import { pageForRoute, pageStatusMeta } from '~/pages.config'

const route = useRoute()
const page = computed(() => pageForRoute(route.path))
const heroTitle = computed(() => page.value?.label ?? 'Logging')
const heroStatus = computed(() => page.value ? pageStatusMeta(page.value.status) : undefined)
</script>

<template>
  <UDashboardPanel id="tools-logging" class="bg-default" :ui="{ root: 'pt-16' }">
    <template #body>
      <div class="mx-auto w-full max-w-5xl space-y-6 pb-8">
        <SectionTabs group="tools" class="mb-2" />
        <PageHero :title="heroTitle" icon="i-lucide-file-text" description="Record live telemetry from /api/status while flying or bench-testing, then export it as a CSV file." :status="heroStatus" size="sm" />

        <ContentSection title="Telemetry log" description="Samples are captured every 2 seconds from the device and can be downloaded as a CSV spreadsheet.">
          <TelemetryRecorder />
        </ContentSection>
      </div>
    </template>
  </UDashboardPanel>
</template>