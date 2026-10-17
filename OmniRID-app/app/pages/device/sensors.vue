<script setup lang="ts">
import { pageForRoute, pageStatusMeta } from '~/pages.config'

const route = useRoute()
const page = computed(() => pageForRoute(route.path))
const heroTitle = computed(() => page.value?.label ?? 'Sensors')
const heroStatus = computed(() => page.value ? pageStatusMeta(page.value.status) : undefined)
</script>

<template>
  <UDashboardPanel id="device-sensors" class="bg-default" :ui="{ root: 'pt-16' }">
    <template #body>
      <div class="mx-auto w-full max-w-[1400px] space-y-6 px-4 pb-16 sm:px-6 lg:px-10">
        <SectionTabs group="device" class="mb-2" />
        <PageHero
          :title="heroTitle"
          icon="i-lucide-activity"
          description="Validate sensor readings and signals before your first flight."
          :status="heroStatus"
          size="sm"
        />
        <ContentSection title="Setup" heading="md">
          <DeviceConfigPlaceholder icon="i-lucide-activity" message="Sensor validation checks and diagnostics will live here." />
        </ContentSection>
      </div>
    </template>
  </UDashboardPanel>
</template>
