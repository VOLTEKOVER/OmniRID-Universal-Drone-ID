<script setup lang="ts">
import { pageForRoute, pageStatusMeta } from '~/pages.config'

const route = useRoute()
const page = computed(() => pageForRoute(route.path))
const heroTitle = computed(() => page.value?.label ?? 'Security')
const heroStatus = computed(() => page.value ? pageStatusMeta(page.value.status) : undefined)

const planned = [
  'Verify Ed25519 signatures on received Remote ID messages',
  'Trust store for known operator / UAS keys',
  'Alert on unsigned or invalid broadcasts'
]
</script>

<template>
  <UDashboardPanel id="rx-security" class="bg-default" :ui="{ root: 'pt-16' }">
    <template #body>
      <div class="mx-auto w-full max-w-[1400px] space-y-6 px-4 pb-16 sm:px-6 lg:px-10">
        <SectionTabs group="rx" class="mb-2" />
        <PageHero
          :title="heroTitle"
          icon="i-lucide-shield-check"
          description="Signing keys and trust settings for received broadcasts."
          :status="heroStatus"
          size="sm"
        />

        <UAlert
          color="warning"
          variant="soft"
          icon="i-lucide-triangle-alert"
          title="Not implemented yet"
          description="RX signature verification is not available: no receiver firmware exists yet."
        />

        <ContentSection title="Planned" description="Trust and verification settings for the future RX firmware.">
          <ul class="list-inside list-disc space-y-1.5 text-sm text-muted">
            <li v-for="item in planned" :key="item">
              {{ item }}
            </li>
          </ul>
        </ContentSection>
      </div>
    </template>
  </UDashboardPanel>
</template>
