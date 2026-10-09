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
      <div class="mx-auto w-full max-w-5xl space-y-6 pb-8">
        <SectionTabs group="tools" class="mb-2" />
        <PageHero :title="heroTitle" icon="i-lucide-terminal" description="Inspect live device logs, run maintenance commands and send signed commands." :status="heroStatus" size="sm" />

        <ContentSection title="Serial console" description="A maintenance terminal for the ESP32. Logs poll GET /api/logs and commands are sent to POST /api/command.">
          <ConsoleTerminal />
        </ContentSection>
      </div>
    </template>
  </UDashboardPanel>
</template>