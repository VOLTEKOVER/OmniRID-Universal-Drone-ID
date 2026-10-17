<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <UPopover v-model:open="open" :content="{ align: 'end', sideOffset: 8 }">
    <UButton
      color="neutral"
      variant="ghost"
      square
      icon="i-lucide-settings"
      aria-label="Open app settings"
      title="App settings"
    />
    <template #content>
      <div class="w-[26rem] max-w-[calc(100vw-2rem)]">
        <div class="border-b border-default px-4 py-3">
          <p class="text-sm font-semibold text-highlighted">
            App settings
          </p>
          <p class="mt-0.5 text-xs text-muted">
            Preferences for the OmniRID application.
          </p>
        </div>
        <AppSettingsPanel />
      </div>
    </template>
  </UPopover>
</template>
