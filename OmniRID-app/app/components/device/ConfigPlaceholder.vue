<script setup lang="ts">
defineProps<{ message: string, icon?: string }>()
</script>

<template>
  <div class="flex flex-col gap-4 rounded-2xl border border-default bg-elevated/40 p-6 sm:flex-row sm:items-center sm:p-8">
    <span class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20" aria-hidden="true">
      <UIcon :name="icon || 'i-lucide-construction'" class="size-5" />
    </span>
    <div class="min-w-0">
      <p class="text-base font-semibold text-highlighted">Coming soon</p>
      <p class="mt-1 text-sm leading-6 text-muted">{{ message }}</p>
    </div>
  </div>
</template>