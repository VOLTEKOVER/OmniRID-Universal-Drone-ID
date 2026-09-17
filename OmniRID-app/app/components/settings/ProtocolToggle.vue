<script setup lang="ts">
import { useSettingsStore } from '~/stores/settings'

const settings = useSettingsStore()
const keys = computed(() => Object.keys(settings.protocols))
</script>

<template>
  <UCard title="Protocolli di telemetria" :ui="{ body: { padding: 'p-4' } }">
    <div class="flex flex-col gap-3">
      <div
        v-for="key in keys"
        :key="key"
        class="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50"
      >
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center">
            <UIcon :name="settings.protocols[key].icon" class="w-5 h-5 text-primary-500" />
          </div>
          <div>
            <div class="text-sm font-medium">{{ settings.protocols[key].label }}</div>
            <div class="text-xs text-muted">{{ settings.protocols[key].description }}</div>
          </div>
        </div>
        <UToggle
          :model-value="settings.protocols[key].enabled"
          :color="settings.protocols[key].enabled ? 'primary' : 'gray'"
          @update:model-value="settings.toggleProtocol(key as keyof typeof settings.protocols)"
        />
      </div>
    </div>
  </UCard>
</template>