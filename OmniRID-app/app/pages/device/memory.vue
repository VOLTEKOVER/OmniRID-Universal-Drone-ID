<script setup lang="ts">
import { pageForRoute, pageStatusMeta } from '~/pages.config'

const route = useRoute()
const page = computed(() => pageForRoute(route.path))
const heroTitle = computed(() => page.value?.label ?? 'Memory')
const heroStatus = computed(() => page.value ? pageStatusMeta(page.value.status) : undefined)
</script>

<template>
  <UDashboardPanel id="device-memory" class="bg-default" :ui="{ root: 'pt-16' }">
    <template #body>
      <div class="mx-auto w-full max-w-[1400px] space-y-6 px-4 pb-16 sm:px-6 lg:px-10">
        <SectionTabs group="device" class="mb-2" />
        <PageHero
          :title="heroTitle"
          icon="i-lucide-database"
          description="Storage, presets and memory management tools for the device."
          :status="heroStatus"
          size="sm"
        />
        <ContentSection title="Setup" heading="md">
          <DeviceConfigPlaceholder icon="i-lucide-database" message="Storage, presets and memory management tools are coming soon." />
        </ContentSection>
      </div>
    </template>
  </UDashboardPanel>
</template>
