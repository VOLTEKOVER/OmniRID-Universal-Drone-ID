<script setup lang="ts">
import { useTelemetryStore } from '~/stores/telemetry'
import { useSettingsStore } from '~/stores/settings'
import { useCapture } from '~/composables/useCapture'

const telemetry = useTelemetryStore()
const settings = useSettingsStore()
const { toggleBle, bleAvailable } = useCapture()

const showSafety = ref(false)
const exportFormat = ref<'CSV' | 'KML'>('CSV')

const onExport = () => {
  const data = exportFormat.value === 'CSV' ? telemetry.tracker.generateCSV() : telemetry.tracker.generateKML()
  const ext = exportFormat.value === 'CSV' ? 'csv' : 'kml'
  const blob = new Blob([data], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `omnirid-report.${ext}`
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(() => {
  if (!bleAvailable()) {
    telemetry.setError('Web Bluetooth non è supportato da questo browser. Usa PCAP o i pulsanti Cattura.')
  }
})
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold">Dashboard</h1>
        <p class="text-sm text-muted">Ground Station OmniRID — telemetria in tempo reale</p>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          color="red"
          variant="soft"
          icon="i-tabler-circle-dotted"
          @click="showSafety = true"
        >
          Checklist sicurezza
        </UButton>
        <USelectMenu v-model="exportFormat" :options="[{ label: 'CSV', value: 'CSV' }, { label: 'KML', value: 'KML' }]" class="w-32" />
        <UButton color="primary" icon="i-tabler-download" @click="onExport">Esporta</UButton>
      </div>
    </div>

    <UAlert
      v-if="telemetry.error"
      color="amber"
      variant="subtle"
      :title="telemetry.error"
      icon="i-tabler-alert-triangle"
      dismissible
      :ui="{ actions: { close: 'p-0' } }"
      @close="telemetry.setError(null)"
    />

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <DashboardStatCard title="Droni rilevati" icon="i-tabler-radio" :value="telemetry.stats.total_devices" :sub="`${telemetry.stats.active_devices} attivi ora`" tone="primary" />
      <DashboardStatCard title="RSSI medio" icon="i-tabler-signal-5g" :value="`${telemetry.avgRssi} dBm`" :sub="`Ultimi 20 pacchetti`" tone="green" />
      <DashboardStatCard title="Pacchetti" icon="i-tabler-activity" :value="telemetry.stats.total_packets" :sub="`${telemetry.stats.packets_last_60s} negli ultimi 60s`" tone="orange" />
      <DashboardStatCard title="Sessione" icon="i-tabler-clock" :value="telemetry.stats.recording ? `${telemetry.stats.session_packets} pkt` : 'off'" :sub="telemetry.stats.recording ? 'Registrazione attiva' : 'Nessuna registrazione'" tone="purple" />
    </div>

    <ActivityChart />

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold">Device attivi</span>
            <NuxtLink to="/devices" class="text-xs text-primary-500 hover:underline">Vedi tutti →</NuxtLink>
          </div>
        </template>
        <p v-if="!telemetry.devices.length" class="text-sm text-muted">Nessun dispositivo rilevato.</p>
        <div v-else class="flex flex-col gap-2">
          <div
            v-for="d in telemetry.devices.slice(0, 6)"
            :key="d.mac"
            class="flex items-center justify-between text-sm py-1 border-b border-gray-100 dark:border-gray-800"
          >
            <span class="font-mono">{{ d.mac }}</span>
            <span class="text-xs text-muted truncate max-w-[160px]">{{ d.basic_id || '—' }}</span>
            <span class="font-mono text-xs">{{ d.rssi_last ?? '—' }} dBm</span>
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <span class="text-sm font-semibold">Protocolli</span>
        </template>
        <div class="flex flex-col gap-2">
          <div
            v-for="(p, key) in settings.protocols"
            :key="key"
            class="flex items-center justify-between text-sm py-1"
          >
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full" :class="p.enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'"></span>
              <span>{{ p.label }}</span>
            </div>
            <span class="text-xs font-medium" :class="p.enabled ? 'text-emerald-500' : 'text-muted'">
              {{ p.enabled ? 'ATTIVO' : 'INATTIVO' }}
            </span>
          </div>
        </div>
      </UCard>
    </div>
  </div>

  <SafetyModal v-if="showSafety" @close="showSafety = false" @confirm="showSafety = false" />
</template>