<script setup lang="ts">
import { useTelemetryStore } from '~/stores/telemetry'

const telemetry = useTelemetryStore()
const macFilter = ref('')
const messageFilter = ref('')

const filtered = computed(() => {
  const mac = macFilter.value.trim().toLowerCase()
  const msg = messageFilter.value.trim().toLowerCase()
  return telemetry.packets.filter(p =>
    (!mac || p.mac.toLowerCase().includes(mac)) &&
    (!msg || p.summary.toLowerCase().includes(msg)),
  ).slice().reverse().slice(0, 500)
})

const clearLog = () => {
  telemetry.packets = []
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold">Timeline</h1>
        <p class="text-sm text-muted">{{ telemetry.packets.length }} pacchetti decodificati</p>
      </div>
      <UButton color="red" variant="soft" icon="i-tabler-trash" size="sm" @click="clearLog">
        Svuota log
      </UButton>
    </div>

    <div class="flex flex-wrap gap-2">
      <UInput v-model="macFilter" icon="i-tabler-hash" placeholder="Filtra MAC..." class="w-44" />
      <UInput v-model="messageFilter" icon="i-tabler-search" placeholder="Filtra per contenuto..." class="w-64" />
    </div>

    <UCard :ui="{ body: { padding: 'p-0' } }">
      <div class="log-console h-[65vh]">
        <template v-for="(p, i) in filtered" :key="`${p.ts}-${p.mac}-${i}`">
          <div class="log-line">
            <span class="log-time">{{ new Date(p.ts * 1000).toLocaleTimeString() }}</span>
            <span class="log-mac">{{ p.mac.slice(-8) }}</span>
            <span
              class="log-rssi"
              :class="p.rssi != null ? (p.rssi > -70 ? 'text-emerald-500' : p.rssi > -85 ? 'text-orange-500' : 'text-red-500') : 'text-gray-500'"
            >
              {{ p.rssi != null ? `${p.rssi} dBm` : '---' }}
            </span>
            <span class="text-gray-400">{{ p.summary || p.messages.map(m => m.message_name).join(', ') }}</span>
          </div>
        </template>
        <p v-if="!filtered.length" class="text-sm text-muted py-4">Nessun pacchetto. Avvia una cattura.</p>
      </div>
    </UCard>
  </div>
</template>