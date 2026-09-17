<script setup lang="ts">
import { useTelemetryStore } from '~/stores/telemetry'

const telemetry = useTelemetryStore()
const positioned = computed(() =>
  telemetry.devices.filter(d => d.last_location?.latitude != null && d.last_location?.longitude != null),
)
</script>

<template>
  <div class="flex flex-col gap-4">
    <div>
      <h1 class="text-xl font-bold">Mappa</h1>
      <p class="text-sm text-muted">{{ positioned.length }} drone/multirotor posizionati (dati GPS OpenDroneID)</p>
    </div>
    <TrackerMap />
  </div>
</template>