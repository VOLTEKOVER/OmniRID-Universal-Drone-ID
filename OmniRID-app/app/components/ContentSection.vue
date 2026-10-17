<script setup lang="ts">
const props = defineProps<{
  caption?: string
  title?: string
  description?: string
  heading?: 'sm' | 'md' | 'lg'
  icon?: string
  iconClass?: string
  framed?: boolean
}>()

const slots = useSlots()

const headingClass = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-xl'
}[props.heading ?? 'md']
</script>

<template>
  <section class="min-w-0">
    <div v-if="title || caption || slots.actions" class="mb-4">
      <div class="flex items-center gap-3">
        <div v-if="icon" class="flex size-7 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary" :class="iconClass">
          <UIcon :name="icon" class="size-4" />
        </div>
        <div v-else-if="caption" class="label-data shrink-0">
          {{ caption }}
        </div>
        <h2 v-if="title" class="text-display shrink-0 text-highlighted" :class="headingClass">
          {{ title }}
        </h2>
        <div class="h-px flex-1 bg-accented" aria-hidden="true" />
        <div v-if="slots.actions" class="shrink-0">
          <slot name="actions" />
        </div>
      </div>
      <p v-if="description" class="mt-2 max-w-3xl text-sm leading-6 text-muted">
        {{ description }}
      </p>
    </div>

    <div v-if="framed" class="rounded-lg border border-default bg-elevated/40 p-4 sm:p-5">
      <slot />
    </div>
    <slot v-else />
  </section>
</template>
