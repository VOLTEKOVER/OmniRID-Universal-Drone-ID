<script setup lang="ts">
import { pageForRoute, pageStatusMeta } from '~/pages.config'
import {
  NVS_KEY_COUNT,
  NVS_NAMESPACE,
  flashRegions,
  nvsGroups,
  runtimeOnly
} from '~/config/storage'
import { useEspConnection } from '~/composables/useEspConnection'
import { useNotifications } from '~/composables/useNotifications'

const route = useRoute()
const page = computed(() => pageForRoute(route.path))
const heroTitle = computed(() => page.value?.label ?? 'Memory')
const heroStatus = computed(() => page.value ? pageStatusMeta(page.value.status) : undefined)
const { isEspConnected, proxyFetch } = useEspConnection()
const { notifyInfo, notifyError } = useNotifications()

const summary = computed(() => [
  { label: 'NVS namespace', value: NVS_NAMESPACE },
  { label: 'Persisted keys', value: String(NVS_KEY_COUNT) },
  { label: 'Runtime-only', value: String(runtimeOnly.length) },
  { label: 'Flash regions', value: String(flashRegions.length) }
])

const downloadDiagnostics = async () => {
  try {
    const [config, capabilities, status, logs] = await Promise.all([
      isEspConnected.value ? proxyFetch('api/config').catch(() => null) : Promise.resolve(null),
      isEspConnected.value ? proxyFetch('api/capabilities').catch(() => null) : Promise.resolve(null),
      isEspConnected.value ? proxyFetch('api/status').catch(() => null) : Promise.resolve(null),
      isEspConnected.value ? proxyFetch('api/logs').catch(() => null) : Promise.resolve(null)
    ])
    const snapshot = {
      generatedAt: new Date().toISOString(),
      connected: isEspConnected.value,
      config,
      capabilities,
      status,
      logs
    }
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `omnirid-diagnostics-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    notifyInfo('Diagnostics exported', 'Downloaded diagnostics snapshot as JSON.')
  } catch (e: any) {
    notifyError('Diagnostics export failed', e?.message || 'Failed to export diagnostics')
  }
}

const regionTone: Record<string, string> = {
  factory: 'text-muted',
  ota: 'text-primary',
  data: 'text-success'
}
</script>

<template>
  <UDashboardPanel id="device-memory" class="bg-default" :ui="{ root: 'pt-16' }">
    <template #body>
      <div class="mx-auto w-full max-w-[1400px] space-y-9 px-4 pb-16 sm:px-6 lg:px-10">
        <SectionTabs group="tx" class="mb-2" />

        <PageHero
          :title="heroTitle"
          icon="i-lucide-database"
          description="Flash layout, NVS persistence and runtime-only settings of the connected device."
          :status="heroStatus"
          size="sm"
        >
          <template #right>
            <dl class="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-default bg-accented">
              <div v-for="cell in summary" :key="cell.label" class="min-w-0 bg-default px-4 py-3">
                <dt class="label-data">
                  {{ cell.label }}
                </dt>
                <dd class="mt-1 truncate font-mono text-lg font-semibold text-highlighted">
                  {{ cell.value }}
                </dd>
              </div>
            </dl>
          </template>
        </PageHero>

        <!-- Flash layout -->
        <ContentSection
          title="Device flash"
          description="The firmware uses a factory image plus a single OTA slot; configuration lives in its own NVS region."
        >
          <div class="grid gap-px overflow-hidden rounded-lg border border-default bg-accented sm:grid-cols-3">
            <div v-for="region in flashRegions" :key="region.name" class="bg-default p-4">
              <div class="flex items-center justify-between gap-2">
                <code class="font-mono text-sm font-semibold" :class="regionTone[region.tone]">{{ region.name }}</code>
                <span class="label-data">{{ region.app }}</span>
              </div>
              <p class="mt-2 text-xs leading-5 text-muted">
                {{ region.description }}
              </p>
            </div>
          </div>
        </ContentSection>

        <!-- NVS key layout -->
        <ContentSection
          title="NVS persistence"
          :description="`Configuration is stored as ${NVS_KEY_COUNT} flat keys in the ${NVS_NAMESPACE} namespace and survives reboots and OTA updates until the namespace is erased by a factory reset.`"
        >
          <div class="space-y-5">
            <div v-for="group in nvsGroups" :key="group.title">
              <p class="label-data mb-2">
                {{ group.title }}
              </p>
              <div class="grid gap-px overflow-hidden rounded-lg border border-default bg-accented">
                <div
                  v-for="row in group.rows"
                  :key="row[0]"
                  class="flex flex-col gap-1 bg-default px-4 py-2.5 sm:grid sm:grid-cols-[minmax(0,9rem)_4.5rem_1fr] sm:items-baseline sm:gap-4"
                >
                  <code class="font-mono text-xs font-medium text-primary">{{ row[0] }}</code>
                  <span class="font-mono text-[11px] text-dimmed">{{ row[1] }}</span>
                  <span class="text-xs leading-5 text-muted">{{ row[2] }}</span>
                </div>
              </div>
            </div>
          </div>
        </ContentSection>

        <!-- Runtime-only -->
        <ContentSection
          title="Not persisted"
          description="These settings live in RAM only and reset to firmware defaults on every reboot."
        >
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="item in runtimeOnly"
              :key="item"
              class="rounded-sm border border-default bg-elevated/40 px-2.5 py-1 font-mono text-[11px] text-muted"
            >
              {{ item }}
            </span>
          </div>
        </ContentSection>

        <!-- Diagnostics -->
        <ContentSection title="Diagnostics" description="Export device configuration and status for support.">
          <div class="flex flex-wrap items-center gap-3 rounded-lg border border-default bg-elevated/40 p-4">
            <UIcon name="i-lucide-file-down" class="size-5 shrink-0 text-primary" />
            <p class="min-w-0 flex-1 text-sm leading-6 text-muted">
              Download a diagnostics snapshot (config, capabilities, status, recent logs) as JSON for troubleshooting.
            </p>
            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-download"
              label="Download diagnostics"
              @click="downloadDiagnostics"
            />
          </div>
        </ContentSection>

        <!-- Maintenance -->
        <ContentSection title="Maintenance" description="Resetting or erasing the device is done from the console.">
          <div class="flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
            <UIcon name="i-lucide-triangle-alert" class="size-5 shrink-0 text-warning" />
            <p class="min-w-0 flex-1 text-sm leading-6 text-muted">
              <span class="font-semibold text-highlighted">Factory reset</span> erases the
              <code class="rounded bg-elevated px-1 font-mono text-xs">{{ NVS_NAMESPACE }}</code>
              namespace and restores defaults. Send <code class="rounded bg-elevated px-1 font-mono text-xs">restart</code>
              or <code class="rounded bg-elevated px-1 font-mono text-xs">reset</code> from the console; both require an
              <code class="rounded bg-elevated px-1 font-mono text-xs">X-Signature</code> when the device is locked.
            </p>
            <UButton
              to="/tx/console"
              color="neutral"
              variant="soft"
              icon="i-lucide-terminal"
              label="Open console"
              class="shrink-0"
            />
          </div>
        </ContentSection>
      </div>
    </template>
  </UDashboardPanel>
</template>
