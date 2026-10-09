<script setup lang="ts">
export type PageBadgeColor = 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral'

const props = defineProps<{
  title: string
  description?: string
  icon?: string
  badges?: { label: string, color?: PageBadgeColor }[]
  status?: { label: string, color?: PageBadgeColor }
  size?: 'sm' | 'md' | 'lg'
}>()

const slots = useSlots()

const titleClass = {
  sm: 'text-2xl font-black tracking-tight text-highlighted sm:text-3xl',
  md: 'text-3xl font-black tracking-tight text-highlighted sm:text-4xl',
  lg: 'text-3xl font-black tracking-tight text-highlighted sm:text-5xl'
}[props.size ?? 'md']

const descriptionClass = {
  sm: 'mt-2 max-w-3xl text-sm leading-6 text-muted sm:text-base',
  md: 'mt-2 max-w-3xl text-base leading-6 text-muted sm:text-lg',
  lg: 'mt-2 max-w-xl text-base leading-6 text-muted sm:text-lg'
}[props.size ?? 'md']
</script>

<template>
  <section class="rounded-2xl border border-default bg-gradient-to-br from-primary/5 via-default to-elevated/50 p-5 sm:p-8">
    <div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
      <div class="max-w-2xl space-y-4">
        <div v-if="badges?.length" class="flex flex-wrap items-center gap-2">
          <UBadge v-for="badge in badges" :key="badge.label" :color="badge.color ?? 'neutral'" variant="soft" :label="badge.label" />
        </div>

        <div class="flex items-start gap-4">
          <div v-if="icon" class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <UIcon :name="icon" class="size-6" />
          </div>

          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h1 :class="titleClass">{{ title }}</h1>
              <UBadge v-if="status" :color="status.color ?? 'neutral'" variant="soft" :label="status.label" />
            </div>
            <p v-if="description" :class="descriptionClass">{{ description }}</p>
          </div>
        </div>

        <div v-if="slots.actions" class="flex flex-wrap gap-3">
          <slot name="actions" />
        </div>
      </div>

      <div v-if="slots.right" class="w-full max-w-md shrink-0">
        <slot name="right" />
      </div>
    </div>
  </section>
</template>