<script setup lang="ts">
export type PageBadgeColor = 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral'

const props = defineProps<{
  title: string
  description?: string
  icon?: string
  status?: { label: string, color?: PageBadgeColor }
  size?: 'sm' | 'md' | 'lg'
}>()

const slots = useSlots()

const sizeKey = computed(() => props.size ?? 'md')

const titleClass = computed(() => ({
  sm: 'text-2xl sm:text-3xl',
  md: 'text-3xl sm:text-4xl',
  lg: 'text-4xl sm:text-5xl lg:text-6xl'
}[sizeKey.value]))

const descriptionClass = computed(() => ({
  sm: 'text-sm leading-6 sm:text-[0.95rem]',
  md: 'text-base leading-7 sm:text-lg',
  lg: 'text-base leading-7 sm:text-lg'
}[sizeKey.value]))
</script>

<template>
  <section class="relative isolate -mx-4 overflow-hidden border-b border-default px-4 py-7 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10 lg:py-9">
    <div aria-hidden="true" class="app-grid pointer-events-none absolute inset-0 -z-10 opacity-70" />
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -top-24 left-0 -z-10 h-56 w-[36rem] max-w-full [background:radial-gradient(50%_100%_at_0%_0%,var(--app-glow),transparent_70%)]"
    />

    <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
      <div class="min-w-0 space-y-3">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
          <UIcon v-if="icon" :name="icon" class="size-6 shrink-0 text-primary sm:size-7" />
          <h1 class="text-display text-highlighted" :class="titleClass">
            {{ title }}
          </h1>
          <UBadge
            v-if="status?.label === 'Stable'"
            :color="status.color ?? 'neutral'"
            variant="soft"
            :label="status.label"
          />
        </div>

        <p v-if="description" class="max-w-2xl text-muted" :class="descriptionClass">
          {{ description }}
        </p>

        <div v-if="slots.actions" class="flex flex-wrap gap-2 pt-1">
          <slot name="actions" />
        </div>
      </div>

      <div v-if="slots.right" class="w-full shrink-0 lg:w-auto lg:max-w-md">
        <slot name="right" />
      </div>
    </div>
  </section>
</template>
