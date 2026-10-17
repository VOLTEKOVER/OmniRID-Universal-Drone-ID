<script setup lang="ts">
import type { GuideSection } from '~/config/guide'
import GuideCodeBlock from '~/components/docs/GuideCodeBlock.vue'
import GuideDataTable from '~/components/docs/GuideDataTable.vue'
import GuideFlow from '~/components/docs/GuideFlow.vue'

defineProps<{ section: GuideSection }>()
</script>

<template>
  <div class="space-y-4">
    <!-- Section intro -->
    <p v-if="section.intro" class="text-sm leading-6 text-muted">
      {{ section.intro }}
    </p>

    <template v-for="(block, i) in section.blocks" :key="i">
      <!-- Sub-heading -->
      <div v-if="block.type === 'h'" class="flex items-center gap-2 pt-4">
        <span class="size-1.5 shrink-0 rounded-full bg-primary" />
        <h4 class="text-base font-bold tracking-tight text-highlighted">
          {{ block.text }}
        </h4>
      </div>

      <!-- Paragraph -->
      <p v-else-if="block.type === 'p'" class="text-sm leading-6 text-muted" v-html="block.html" />

      <!-- Callout -->
      <UAlert
        v-else-if="block.type === 'callout'"
        :title="block.title"
        :color="block.tone === 'warning' ? 'warning' : 'info'"
        variant="soft"
        :icon="block.tone === 'warning' ? 'i-lucide-triangle-alert' : 'i-lucide-lightbulb'"
        class="rounded-lg"
      >
        <template #description>
          <span class="text-sm leading-6" v-html="block.html" />
        </template>
      </UAlert>

      <!-- Unordered list -->
      <ul v-else-if="block.type === 'ul'" class="space-y-2">
        <li v-for="(item, j) in block.items" :key="j" class="flex gap-2 text-sm leading-6 text-muted">
          <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-primary" />
          <span v-html="item" />
        </li>
      </ul>

      <!-- Ordered list -->
      <ol v-else-if="block.type === 'ol'" class="space-y-2">
        <li
          v-for="(item, j) in block.items"
          :key="j"
          class="flex gap-3 text-sm leading-6 text-muted"
        >
          <span class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary ring-1 ring-primary/20">
            {{ j + 1 }}
          </span>
          <span class="min-w-0" v-html="item" />
        </li>
      </ol>

      <!-- Code block -->
      <GuideCodeBlock v-else-if="block.type === 'code'" :code="block.code" />

      <!-- Single table -->
      <GuideDataTable
        v-else-if="block.type === 'table'"
        :cols="block.cols"
        :rows="block.rows"
        :caption="block.caption"
      />

      <!-- Grouped tables (NVS key layout) -->
      <div v-else-if="block.type === 'tables'" class="space-y-4">
        <template v-for="(group, gi) in block.groups" :key="gi">
          <GuideDataTable :cols="['NVS Key', 'Type', 'Parameter']" :rows="group.rows" :title="group.title" />
        </template>
      </div>

      <!-- Flow diagram -->
      <GuideFlow v-else-if="block.type === 'flow'" :flow="block.flow" />
    </template>
  </div>
</template>
