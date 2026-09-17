<script setup lang="ts">
import { useSettingsStore } from '~/stores/settings'

const settings = useSettingsStore()

const items: { key: keyof typeof settings.safetyChecklist; label: string }[] = [
  { key: 'battery', label: 'Batteria carica e stabile' },
  { key: 'gpsFix', label: 'Fix GPS / DroneID verificato' },
  { key: 'props', label: 'Eliche montate correttamente' },
  { key: 'armReady', label: 'Pronto all\'arm disarm' },
  { key: 'airspace', label: 'Spazio aereo libero (no-fly OK)' },
]
</script>

<template>
  <UModal>
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <UIcon name="i-tabler-alert-triangle" class="w-5 h-5 text-orange-500" />
            <span class="font-semibold">Checklist di sicurezza</span>
          </div>
        </div>
      </template>

      <div class="flex flex-col gap-2">
        <div
          v-for="item in items"
          :key="item.key"
          class="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50"
        >
          <span class="text-sm">{{ item.label }}</span>
          <UToggle
            :model-value="settings.safetyChecklist[item.key]"
            :color="settings.safetyChecklist[item.key] ? 'green' : 'gray'"
            @update:model-value="settings.toggleSafety(item.key)"
          />
        </div>
      </div>

      <div class="mt-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
        <span class="text-sm font-medium">Tutti i controlli superati</span>
        <UIcon
          :name="settings.safetyReady ? 'i-tabler-circle-check-filled' : 'i-tabler-circle-dashed'"
          class="w-6 h-6"
          :class="settings.safetyReady ? 'text-emerald-500' : 'text-gray-400'"
        />
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="gray" variant="outline" @click="$emit('close')">Chiudi</UButton>
          <UButton
            color="primary"
            :disabled="!settings.safetyReady"
            @click="$emit('confirm')"
          >
            Conferma decollo
          </UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>