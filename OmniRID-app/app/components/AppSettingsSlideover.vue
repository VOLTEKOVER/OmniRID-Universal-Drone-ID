<script setup lang="ts">
const { isSettingsOpen } = useDashboard()
</script>

<template>
  <USlideover
    v-model:open="isSettingsOpen"
    title="App settings"
    description="Preferences for the OmniRID application."
    :ui="{ body: 'p-0' }"
  >
    <template #body>
      <AppSettingsPanel class="h-full" scroll-class="min-h-0 flex-1" />
    </template>
  </USlideover>
</template>
