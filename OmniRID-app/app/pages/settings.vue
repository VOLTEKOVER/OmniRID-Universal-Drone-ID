<script setup lang="ts">
import { useSettingsStore } from '~/stores/settings'
import { useTelemetryStore } from '~/stores/telemetry'

const settings = useSettingsStore()
const telemetry = useTelemetryStore()

const resetAll = () => {
  if (confirm('Azzera tutti i dati di telemetria e impostazioni?')) {
    settings.reset()
    telemetry.reset()
  }
}

const themeOptions = [
  { label: 'Chiaro', value: 'light' },
  { label: 'Scuro', value: 'dark' },
  { label: 'Sistema', value: 'system' },
]

const simulation = useSimulation(settings)
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold">Impostazioni</h1>
        <p class="text-sm text-muted">Protocolli, porte seriali, sicurezza e aspetto</p>
      </div>
      <UButton color="red" variant="outline" icon="i-tabler-refresh" size="sm" @click="resetAll">
        Factory reset
      </UButton>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ProtocolToggle />

      <UCard :ui="{ body: { padding: 'p-4' } }">
        <template #header>
          <span class="text-sm font-semibold">Aspetto & simulazione</span>
        </template>
        <div class="flex flex-col gap-4">
          <div>
            <label class="text-xs text-muted">Tema</label>
            <div class="flex items-center gap-2 mt-1">
              <UButton
                v-for="opt in themeOptions"
                :key="opt.value"
                :color="settings.theme === opt.value ? 'primary' : 'gray'"
                :variant="settings.theme === opt.value ? 'solid' : 'outline'"
                size="sm"
                @click="settings.theme = opt.value as 'light' | 'dark' | 'system'"
              >
                {{ opt.label }}
              </UButton>
            </div>
          </div>
          <UDivider />
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium">Simulazione dati</div>
              <div class="text-xs text-muted">Genera pacchetti demo per provare la UI</div>
            </div>
            <UToggle v-model="settings.simulationMode" color="primary" />
          </div>
          <UButton
            v-if="settings.simulationMode"
            color="primary"
            variant="soft"
            icon="i-tabler-player-play"
            size="sm"
            block
            @click="simulation.toggle()"
          >
            {{ simulation.running ? 'Stop simulazione' : 'Avvia simulazione' }}
          </UButton>
        </div>
      </UCard>

      <ComPortSelect />

      <UCard title="Sicurezza" :ui="{ body: { padding: 'p-4' } }">
        <p class="text-sm text-muted mb-3">
          La checklist di sicurezza limita l'abilitazione del decollo. Verrà richiesta prima di armare.
        </p>
        <div class="flex flex-col gap-2">
          <div
            v-for="(v, k) in settings.safetyChecklist"
            :key="k"
            class="flex items-center justify-between text-sm"
          >
            <span class="text-sm">{{ k }}</span>
            <UIcon
              :name="v ? 'i-tabler-circle-check' : 'i-tabler-circle-dashed'"
              class="w-5 h-5"
              :class="v ? 'text-emerald-500' : 'text-gray-400'"
            />
          </div>
        </div>
        <AlertBadge :ready="settings.safetyReady" class="mt-3" />
      </UCard>
    </div>
  </div>
</template>