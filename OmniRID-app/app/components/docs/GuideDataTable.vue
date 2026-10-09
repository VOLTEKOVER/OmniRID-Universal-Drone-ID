<script setup lang="ts">
import { h } from 'vue'
import type { TableColumn } from '@nuxt/ui'

const props = defineProps<{
  cols: string[]
  rows: string[][]
  caption?: string
  title?: string
}>()

const columns = computed<TableColumn<Record<string, string>>[]>(() =>
  props.cols.map((header, i) => ({
    accessorKey: `c${i}`,
    header,
    cell: ({ getValue }: { getValue: () => unknown }) =>
      h('span', { innerHTML: String(getValue() ?? ''), class: i === 0 ? 'font-medium text-highlighted' : undefined })
  }))
)

const data = computed(() =>
  props.rows.map((cells) => Object.fromEntries(cells.map((c, i) => [`c${i}`, c])))
)
</script>

<template>
  <UCard v-if="rows.length" class="overflow-hidden rounded-2xl" :ui="{ root: 'shadow-none border-default', body: 'p-0' }">
    <template v-if="title || caption" #header>
      <div class="flex flex-wrap items-center justify-between gap-2 px-1 py-0.5">
        <div class="flex min-w-0 items-center gap-2">
          <UIcon name="i-lucide-table-2" class="size-4 shrink-0 text-primary" />
          <span class="truncate text-xs font-semibold uppercase tracking-[0.16em] text-muted">{{ title || caption }}</span>
        </div>
        <UBadge color="neutral" variant="soft" size="sm" :label="`${rows.length} rows`" />
      </div>
    </template>
    <div class="hidden sm:block">
      <UTable
        :columns="columns"
        :data="data"
        :ui="{
          base: 'text-sm',
          thead: 'bg-elevated/50',
          tbody: 'divide-y divide-default',
          th: 'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted',
          td: 'align-top p-3.5 text-sm text-muted',
          tr: 'transition-colors hover:bg-elevated/40'
        }"
      />
    </div>
    <div class="divide-y divide-default sm:hidden">
      <dl v-for="(row, ri) in rows" :key="ri" class="px-4 py-3">
        <template v-for="(cell, ci) in row" :key="ci">
          <div class="flex items-baseline gap-3 py-0.5">
            <dt class="w-1/3 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted">{{ cols[ci] || `Field ${ci + 1}` }}</dt>
            <dd class="min-w-0 flex-1 break-words text-sm" :class="ci === 0 ? 'font-medium text-highlighted' : 'text-muted'" v-html="cell" />
          </div>
        </template>
      </dl>
    </div>
  </UCard>
</template>