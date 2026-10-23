<script setup lang="ts">
import { pageForRoute, pageStatusMeta } from '~/pages.config'

const route = useRoute()
const page = computed(() => pageForRoute(route.path))
const heroTitle = computed(() => page.value?.label ?? 'Presets')
const heroStatus = computed(() => page.value ? pageStatusMeta(page.value.status) : undefined)
</script>

<template>
  <UDashboardPanel id="tools-presets" class="bg-default" :ui="{ root: 'pt-16' }">
    <template #body>
      <div class="mx-auto w-full max-w-[1400px] space-y-6 px-4 pb-16 sm:px-6 lg:px-10">
        <SectionTabs group="tx" class="mb-2" />
        <PageHero
          :title="heroTitle"
          icon="i-lucide-list"
          description="Capture the current device configuration and save reusable presets for different aircraft and regions."
          :status="heroStatus"
          size="sm"
        />

        <ContentSection title="Configuration profiles" description="Presets are stored in this browser as JSON and can be applied to the device or exported as files.">
          <PresetManager />
        </ContentSection>
      </div>
    </template>
  </UDashboardPanel>
</template>
