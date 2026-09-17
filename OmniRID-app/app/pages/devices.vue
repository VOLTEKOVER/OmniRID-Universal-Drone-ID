<script setup lang="ts">
import { useTelemetryStore } from '~/stores/telemetry'

const telemetry = useTelemetryStore()

const search = ref('')
const sortKey = ref<'mac' | 'rssi_last' | 'packet_count' | 'last_seen'>('last_seen')
const sortDir = ref<'asc' | 'desc'>('desc')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = telemetry.devices.filter(d =>
    !q || d.mac.toLowerCase().includes(q) || d.basic_id.toLowerCase().includes(q) || d.operator_id.toLowerCase().includes(q),
  )
  return [...list].sort((a, b) => {
    const va = a[sortKey.value]
    const vb = b[sortKey.value]
    if (va == null || vb == null) return 0
    return sortDir.value === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
  })
})

const columns = [
  { key: 'mac', label: 'MAC' },
  { key: 'basic_id', label: 'Basic ID' },
  { key: 'ua_type_name', label: 'Tipo' },
  { key: 'rssi_last', label: 'RSSI' },
  { key: 'packet_count', label: 'Pacchetti' },
  { key: 'last_seen', label: 'Ultimo contatto' },
  { key: 'operator_id', label: 'Operatore' },
  { key: 'status', label: '' },
]

const setSort = (key: typeof sortKey) => {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else { sortKey.value = key; sortDir.value = 'asc' }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold">Dispositivi</h1>
        <p class="text-sm text-muted">{{ telemetry.devices.length }} droni rilevati</p>
      </div>
      <UInput
        v-model="search"
        icon="i-tabler-search"
        placeholder="Cerca MAC / ID / operatore..."
        size="md"
        class="w-72"
      />
    </div>

    <UCard :ui="{ body: { padding: 'p-0' } }">
      <UTable :rows="filtered" :columns="columns" :loading="false">
        <template #mac-data="{ row }">
          <span class="font-mono font-semibold text-primary-500">{{ row.mac }}</span>
        </template>
        <template #ua_type_name-data="{ row }">
          <UBadge color="gray" variant="subtle" :label="row.ua_type_name" />
        </template>
        <template #rssi_last-data="{ row }">
          <span
            class="font-mono"
            :class="row.rssi_last > -70 ? 'text-emerald-500' : row.rssi_last > -85 ? 'text-orange-500' : 'text-red-500'"
          >
            {{ row.rssi_last ?? '—' }} dBm
          </span>
        </template>
        <template #last_seen-data="{ row }">
          <span class="text-xs text-muted font-mono">{{ new Date(row.last_seen * 1000).toLocaleTimeString() }}</span>
        </template>
        <template #operator_id-data="{ row }">
          <span class="text-xs text-muted truncate max-w-[140px] inline-block align-middle">{{ row.operator_id || '—' }}</span>
        </template>
        <template #empty-state>
          <div class="flex flex-col items-center justify-center gap-2 py-10">
            <UIcon name="i-tabler-devices-off" class="w-8 h-8 text-gray-300" />
            <p class="text-sm text-muted">Nessun dispositivo rilevato.</p>
          </div>
        </template>
      </UTable>
    </UCard>
  </div>
</template>