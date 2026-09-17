<script setup lang="ts">
defineProps<{ ready: boolean }>()
</script>

<template>
  <div
    class="flex items-center gap-2 p-3 rounded-lg border text-sm"
    :class="ready
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-300'
      : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-500/10 dark:text-amber-300'"
  >
    <UIcon
      :name="ready ? 'i-tabler-circle-check-filled' : 'i-tabler-alert-triangle'"
      class="w-5 h-5 shrink-0"
    />
    <span>
      {{ ready
        ? 'Checklist di sicurezza superata: decollo consentito'
        : 'Completa la checklist di sicurezza prima del volo' }}
    </span>
  </div>
</template>