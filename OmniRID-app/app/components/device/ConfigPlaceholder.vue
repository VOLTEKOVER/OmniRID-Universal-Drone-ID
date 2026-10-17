<script setup lang="ts">
defineProps<{ message: string, icon?: string }>()
</script>

<template>
  <div class="flex flex-col gap-4 rounded-lg border border-dashed border-default bg-elevated/40 p-5 sm:flex-row sm:items-center sm:p-6">
    <span class="flex size-12 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary" aria-hidden="true">
      <UIcon :name="icon || 'i-lucide-construction'" class="size-5" />
    </span>
    <div class="min-w-0">
      <p class="label-data">
        Coming soon
      </p>
      <p class="mt-1.5 text-sm leading-6 text-muted">
        {{ message }}
      </p>
    </div>
  </div>
</template>
