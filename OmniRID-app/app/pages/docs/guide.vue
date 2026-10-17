<script setup lang="ts">
import type { PageBadgeColor } from '~/components/PageHero.vue'
import type { GuideSection } from '~/config/guide'
import GuideBlocks from '~/components/docs/GuideBlocks.vue'
import { guideSections, sectionSearchText } from '~/config/guide'
import { pageForRoute, pageStatusMeta } from '~/pages.config'

const heroBadges: { label: string, color?: PageBadgeColor }[] = [{ label: 'In-app Guide', color: 'primary' }]
const route = useRoute()
const heroStatus = computed(() => {
  const page = pageForRoute(route.path)
  return page ? pageStatusMeta(page.status) : undefined
})

const openSections = ref<string[]>([guideSections[0]?.id ?? ''])
const query = ref('')
const allOpen = ref(false)

const sectionIndex = guideSections.map(section => ({
  id: section.id,
  haystack: `${section.number} ${section.title} ${sectionSearchText(section)}`.toLowerCase()
}))

function sectionPreview(section: GuideSection): string {
  const raw = section.intro?.trim() ? section.intro : sectionSearchText(section)
  const clean = raw.replace(/\s+/g, ' ').trim()
  return clean.length > 170 ? `${clean.slice(0, 170)}…` : clean
}

const visibleItems = computed(() => {
  const terms = query.value.toLowerCase().split(/\s+/).filter(Boolean)
  return guideSections
    .filter((section) => {
      if (!terms.length) return true
      const haystack = sectionIndex.find(entry => entry.id === section.id)?.haystack ?? ''
      return terms.every(term => haystack.includes(term))
    })
    .map(section => ({
      label: `${section.number}. ${section.title}`,
      value: section.id,
      number: section.number,
      icon: section.icon,
      preview: sectionPreview(section)
    }))
})

function sectionById(id: string) {
  return guideSections.find(s => s.id === id)!
}

function setAll(expand: boolean) {
  openSections.value = expand ? guideSections.map(s => s.id) : []
  allOpen.value = expand
}

function onOpenChange(value: string | string[] | undefined) {
  openSections.value = Array.isArray(value) ? value : (value ? [value] : [])
}

function scrollToSection(id: string) {
  if (!import.meta.client) return
  if (!guideSections.some(s => s.id === id)) return
  query.value = ''
  const scroll = () => {
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }
  if (!openSections.value.includes(id)) {
    openSections.value.push(id)
    nextTick(scroll)
  } else {
    scroll()
  }
}

function scrollToHash(href: string) {
  scrollToSection(href.replace('#guide-', ''))
}

watch(() => route.hash, (hash) => {
  if (!hash) return
  scrollToSection(decodeURIComponent(hash.slice(1)))
}, { immediate: true })

function onBodyClick(event: MouseEvent) {
  const anchor = (event.target as HTMLElement).closest('a[href^="#guide-"]') as HTMLAnchorElement | null
  if (!anchor) return
  event.preventDefault()
  scrollToHash(anchor.getAttribute('href')!)
}
</script>

<template>
  <UDashboardPanel id="guide" class="bg-default" :ui="{ root: 'pt-16' }">
    <template #body>
      <div class="mx-auto w-full max-w-[1400px] space-y-6 px-4 pb-16 sm:px-6 lg:px-10">
        <SectionTabs group="docs" class="mb-2" />
        <PageHero
          title="OmniRID technical guide"
          description="A practical reference for installation, configuration, protocols, OTA, security and regulatory information for the OmniRID ESP32 Remote ID platform."
          :badges="heroBadges"
          :status="heroStatus"
        >
          <template #right>
            <UButton
              to="/"
              color="neutral"
              variant="outline"
              icon="i-lucide-arrow-left"
              label="Back to home"
            />
          </template>
        </PageHero>

        <div class="flex flex-col gap-3 rounded-lg border border-default bg-elevated/40 p-3 sm:flex-row sm:items-center sm:justify-between">
          <USearchInput
            v-model="query"
            placeholder="Search sections..."
            class="w-full sm:max-w-sm"
          />
          <div class="flex items-center justify-between gap-2 sm:justify-end">
            <UBadge
              color="neutral"
              variant="soft"
              size="sm"
              :label="`${visibleItems.length} sections`"
            />
            <UButtonGroup size="sm">
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-chevrons-down-up"
                label="Expand all"
                :disabled="allOpen"
                @click="setAll(true)"
              />
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-chevrons-up-down"
                label="Collapse all"
                :disabled="!allOpen"
                @click="setAll(false)"
              />
            </UButtonGroup>
          </div>
        </div>

        <div data-guide-body @click="onBodyClick">
          <UAccordion
            :items="visibleItems"
            :model-value="openSections"
            type="multiple"
            collapsible
            :unmount-on-hide="false"
            class="space-y-2"
            :ui="{
              item: 'overflow-hidden rounded-lg border border-default bg-elevated/40 transition-colors duration-200 hover:border-primary/25',
              header: 'group transition-colors',
              trigger: 'w-full gap-3 px-4 py-3.5 sm:px-5',
              content: '',
              body: ''
            }"
            @update:model-value="onOpenChange"
          >
            <template #leading="{ item, open: itemOpen }">
              <span
                class="flex size-8 shrink-0 items-center justify-center rounded-sm ring-1 transition-colors duration-200"
                :class="itemOpen ? 'bg-primary/15 text-primary ring-primary/30' : 'bg-default text-muted ring-default hover:bg-elevated'"
              >
                <UIcon :name="item.icon" class="size-4" />
              </span>
            </template>
            <template #default="{ item, open: itemOpen }">
              <span class="flex min-w-0 items-center gap-2.5">
                <UBadge
                  color="neutral"
                  variant="soft"
                  size="sm"
                  class="shrink-0 justify-center font-mono"
                  :ui="{ base: 'size-6 rounded-sm' }"
                >
                  {{ item.number }}
                </UBadge>
                <span class="min-w-0">
                  <span class="block truncate text-sm font-semibold text-highlighted">{{ item.label }}</span>
                  <span v-if="!itemOpen" class="mt-0.5 block truncate text-xs text-muted">{{ item.preview }}</span>
                </span>
              </span>
            </template>
            <template #trailing="{ open: itemOpen }">
              <span
                class="flex size-7 shrink-0 items-center justify-center rounded-full transition-colors duration-200"
                :class="itemOpen ? 'bg-primary/10 text-primary' : 'bg-default text-muted group-hover:bg-elevated group-hover:text-highlighted'"
              >
                <UIcon name="i-lucide-chevron-down" class="size-4 transition-transform duration-300" :class="itemOpen && 'rotate-180'" />
              </span>
            </template>
            <template #body="{ item, open: itemOpen }">
              <div :id="item.value" class="scroll-mt-28">
                <div :class="!itemOpen ? 'hidden' : ''">
                  <div class="border-t border-default px-4 py-5 sm:px-5">
                    <GuideBlocks :section="sectionById(item.value)" />
                  </div>
                </div>
              </div>
            </template>
          </UAccordion>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>

<style scoped>
[data-guide-body] :deep(code) {
  border-radius: 0.375rem;
  padding: 0.125rem 0.35rem;
  font-size: 0.8em;
  font-weight: 500;
  background: color-mix(in srgb, var(--ui-primary) 10%, transparent);
  color: var(--ui-text);
}

[data-guide-body] :deep(a) {
  color: var(--ui-primary);
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
}

[data-guide-body] :deep(pre code) {
  background: transparent;
  padding: 0;
  font-weight: 400;
}
</style>
