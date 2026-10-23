<script setup lang="ts">
import { pageForRoute, pageStatusMeta } from '~/pages.config'

const route = useRoute()
const page = computed(() => pageForRoute(route.path))
const heroTitle = computed(() => page.value?.label ?? 'Console')
const heroStatus = computed(() => page.value ? pageStatusMeta(page.value.status) : undefined)
</script>

<template>
  <UDashboardPanel id="tools-console" class="bg-default" :ui="{ root: 'pt-16' }">
    <template #body>
      <div class="mx-auto w-full max-w-[1400px] space-y-6 px-4 pb-16 sm:px-6 lg:px-10">
        <SectionTabs group="tx" class="mb-2" />
        <PageHero
          :title="heroTitle"
          icon="i-lucide-terminal"
          description="Inspect live device logs, run maintenance commands and send signed commands."
          :status="heroStatus"
          size="sm"
        />

        <ContentSection title="Serial console" description="A live maintenance terminal for the connected device.">
          <ConsoleTerminal />
        </ContentSection>
      </div>
    </template>
  </UDashboardPanel>
</template>
