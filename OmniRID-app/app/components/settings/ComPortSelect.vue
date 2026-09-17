<script setup lang="ts">
import { useSettingsStore } from '~/stores/settings'

const settings = useSettingsStore()

const baudOptions = [9600, 57600, 115200, 230400, 460800, 921600].map(v => ({ label: `${v} baud`, value: v }))
const portOptions = computed(() =>
  settings.availablePorts.map(p => ({ label: p, value: p })),
)

const refreshPorts = () => {
  settings.refreshPorts()
}
</script>

<template>
  <UCard title="Seriale (COM)" :ui="{ body: { padding: 'p-4' } }">
    <div class="flex flex-col gap-3">
      <div>
        <label class="text-xs text-muted">Porta COM</label>
        <USelectMenu
          v-model="settings.serialPort"
          :options="portOptions"
          placeholder="Seleziona porta..."
          size="md"
          class="mt-1"
        />
      </div>
      <div>
        <label class="text-xs text-muted">Baud rate</label>
        <USelectMenu v-model="settings.serialBaud" :options="baudOptions" class="mt-1" />
      </div>
      <div class="flex items-center justify-between gap-2">
        <span class="text-xs text-muted">Porte disponibili sul dispositivo</span>
        <UButton color="gray" variant="outline" size="xs" icon="i-tabler-refresh" @click="refreshPorts">
          Aggiorna
        </UButton>
      </div>
      <div class="flex flex-wrap gap-1">
        <UBadge
          v-for="p in settings.availablePorts"
          :key="p"
          color="gray"
          variant="subtle"
          :label="p"
        />
      </div>
    </div>
  </UCard>
</template>