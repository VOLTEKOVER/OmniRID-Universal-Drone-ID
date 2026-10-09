<script setup lang="ts">
const props = defineProps<{
  caption?: string
  title?: string
  description?: string
  heading?: 'sm' | 'md' | 'lg'
}>()

const slots = useSlots()

const headingClass = {
  sm: 'text-base font-bold text-highlighted',
  md: 'text-lg font-bold text-highlighted',
  lg: 'text-2xl font-bold text-highlighted'
}[props.heading ?? 'lg']
</script>

<template>
  <section class="rounded-2xl border border-default bg-default p-5 sm:p-6">
    <div
      v-if="title || caption"
      class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
    >
      <div class="min-w-0">
        <p v-if="caption" class="text-[10px] uppercase tracking-[0.22em] text-muted">{{ caption }}</p>
        <h2 v-if="title" :class="headingClass" class="mt-1">{{ title }}</h2>
        <p v-if="description" class="mt-2 text-sm text-muted">{{ description }}</p>
      </div>
      <div v-if="slots.actions" class="shrink-0">
        <slot name="actions" />
      </div>
    </div>
    <slot />
  </section>
</template>