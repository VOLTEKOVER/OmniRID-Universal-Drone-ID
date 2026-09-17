<script setup lang="ts">
defineProps<{
  title: string
  icon: string
  value: string | number
  sub?: string
  tone?: 'primary' | 'green' | 'orange' | 'purple' | 'red'
}>()

const tones: Record<string, string> = {
  primary: 'text-primary-500',
  green: 'text-emerald-500',
  orange: 'text-orange-500',
  purple: 'text-violet-500',
  red: 'text-red-500',
}
</script>

<template>
  <UCard :ui="{ body: { padding: 'p-4' } }">
    <div class="flex items-center gap-2 mb-1">
      <UIcon :name="icon" :class="tones[tone || 'primary']" class="w-4 h-4" />
      <span class="text-xs font-medium uppercase tracking-wide text-muted">{{ title }}</span>
    </div>
    <div class="text-2xl font-bold">{{ value }}</div>
    <div v-if="sub" class="text-xs text-muted mt-1">{{ sub }}</div>
  </UCard>
</template>