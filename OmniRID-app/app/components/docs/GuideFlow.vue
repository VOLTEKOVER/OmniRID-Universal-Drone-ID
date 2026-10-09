<script setup lang="ts">
import type { GuideFlow } from '~/config/guide'

const props = defineProps<{ flow: GuideFlow }>()

const stepBadgeColors = ['primary', 'info', 'success', 'warning', 'error'] as const

const packBadgeColor = (index: number) => stepBadgeColors[index % stepBadgeColors.length]
</script>

<template>
  <!-- Linear: OTA flow -->
  <div
    v-if="flow.kind === 'linear'"
    class="rounded-2xl border border-default bg-gradient-to-br from-elevated/60 via-default to-default p-4 sm:p-5"
  >
    <div class="mb-3 flex items-center gap-2">
      <span class="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
        <UIcon name="i-lucide-workflow" class="size-3.5" />
      </span>
      <p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Flow</p>
      <UBadge color="primary" variant="soft" size="sm" :label="`${flow.nodes.length} steps`" />
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <template v-for="(node, i) in flow.nodes" :key="i">
        <div class="flex items-center gap-2">
          <div class="group/step max-w-56 rounded-xl border border-default bg-surface/70 p-3 transition hover:border-primary/30 hover:shadow-sm">
            <div class="flex items-center gap-2">
              <span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary ring-1 ring-primary/20">{{ i + 1 }}</span>
              <p class="truncate text-xs font-bold text-highlighted">{{ node.label }}</p>
            </div>
            <p v-if="node.sub" class="mt-1.5 truncate text-[10px] leading-4 text-muted">{{ node.sub }}</p>
          </div>
          <span v-if="i < flow.nodes.length - 1" class="flex size-6 shrink-0 items-center justify-center rounded-full bg-elevated/60 ring-1 ring-default">
            <UIcon name="i-lucide-arrow-right" class="size-3.5 text-primary" />
          </span>
        </div>
      </template>
    </div>

    <UAlert v-if="flow.failure" color="warning" variant="soft" icon="i-lucide-rotate-ccw" class="mt-3 rounded-xl">
      <template #description>
        <span class="text-xs"><span class="font-semibold">Failure → {{ flow.failure.to }}</span> — {{ flow.failure.note }}</span>
      </template>
    </UAlert>

    <p v-if="flow.caption" class="mt-3 text-[11px] leading-5 text-muted">{{ flow.caption }}</p>
  </div>

  <!-- Guard: protocol auto-detection -->
  <div
    v-else-if="flow.kind === 'guard'"
    class="rounded-2xl border border-default bg-gradient-to-br from-elevated/60 via-default to-default p-4 sm:p-5"
  >
    <div class="mb-3 flex items-center gap-2">
      <span class="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
        <UIcon name="i-lucide-git-branch" class="size-3.5" />
      </span>
      <p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Detection</p>
    </div>

    <UBadge color="primary" variant="soft" size="sm" icon="i-lucide-play" :label="flow.entry" />

    <div class="relative ms-1 mt-3 space-y-2.5 border-s-2 border-dashed border-default ps-4">
      <div v-for="(check, i) in flow.checks" :key="check.label" class="flex flex-wrap items-center gap-2">
        <div class="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-default bg-surface/70 px-3 py-2.5 transition hover:border-amber-500/30">
          <span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-[10px] font-bold text-amber-500 ring-1 ring-amber-500/25">{{ i + 1 }}</span>
          <span class="min-w-0 text-xs font-medium text-highlighted" v-html="check.label" />
        </div>
        <UIcon name="i-lucide-arrow-right" class="size-4 shrink-0 text-muted" />
        <UBadge color="success" variant="soft" :label="`Yes · ${check.ok}`" />
        <UBadge v-if="i < flow.checks.length - 1" color="error" variant="outline" label="No" />
      </div>
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-2">
      <UBadge color="neutral" variant="soft" icon="i-lucide-corner-down-left" :label="flow.fallback" />
      <UIcon name="i-lucide-arrow-right" class="size-4 text-muted" />
      <UBadge color="neutral" variant="outline" icon="i-lucide-loader" label="Main loop" />
    </div>

    <p
      v-if="flow.noData"
      class="mt-3 rounded-xl bg-default/70 px-3 py-2.5 text-[11px] leading-5 text-muted"
    >
      <span class="font-semibold text-highlighted">When no data arrives:</span> {{ flow.noData }}
    </p>
    <p v-if="flow.caption" class="mt-3 text-[11px] leading-5 text-muted">{{ flow.caption }}</p>
  </div>

  <!-- Pack: ODID message pack -->
  <div
    v-else-if="flow.kind === 'pack'"
    class="rounded-2xl border border-default bg-gradient-to-br from-elevated/60 via-default to-default p-4 sm:p-5"
  >
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2.5">
        <span class="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
          <UIcon name="i-lucide-package" class="size-3.5" />
        </span>
        <div>
          <p class="text-xs font-bold text-highlighted">ASTM F3411-22a Message Pack</p>
          <p class="text-[10px] text-muted">Single transmission</p>
        </div>
      </div>
      <UBadge color="primary" variant="soft" size="sm" :label="`${flow.messages.length} messages`" />
    </div>

    <div class="grid gap-2 md:grid-cols-3">
      <div
        v-for="(msg, i) in flow.messages"
        :key="msg.id"
        class="rounded-xl border border-default bg-surface/70 p-3 transition hover:border-primary/30 hover:shadow-sm"
      >
        <div class="flex items-center gap-2">
          <UBadge :color="packBadgeColor(i)" variant="soft" size="xs" :label="msg.id" />
          <span class="truncate text-xs font-semibold text-highlighted">{{ msg.label }}</span>
        </div>
        <p class="mt-1.5 text-[10px] leading-4 text-muted">{{ msg.lines }}</p>
      </div>
    </div>

    <div class="my-2.5 flex items-center gap-2">
      <UIcon name="i-lucide-arrow-down" class="size-4 text-primary" />
      <UBadge color="neutral" variant="outline" size="xs" label="Transport layer" />
    </div>

    <div class="grid gap-2 md:grid-cols-2">
      <div
        v-for="ts in flow.transports"
        :key="ts.name"
        class="flex items-start gap-2.5 rounded-xl border border-default bg-surface/70 p-3 transition hover:border-primary/30"
      >
        <span class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
          <UIcon name="i-lucide-wifi" class="size-3.5" />
        </span>
        <div class="min-w-0">
          <p class="text-xs font-semibold text-highlighted">{{ ts.name }}</p>
          <p class="mt-1 text-[10px] leading-4 text-muted">{{ ts.lines }}</p>
        </div>
      </div>
    </div>

    <p v-if="flow.caption" class="mt-3 text-[11px] leading-5 text-muted">{{ flow.caption }}</p>
  </div>
</template>