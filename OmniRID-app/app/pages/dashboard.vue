<script setup lang="ts">
import { useTelemetry } from '~/composables/useTelemetry'

const { status } = useTelemetry()
</script>

<template>
  <UDashboardPanel
    id="monitor-dashboard"
    class="bg-default"
    :ui="{ root: 'pt-16', body: 'p-0 overflow-hidden' }"
  >
    <template #body>
      <DroneMap
        :status="status"
        height-class="h-[calc(100svh-4rem)]"
        class="rounded-none"
      />
    </template>
  </UDashboardPanel>
</template>
