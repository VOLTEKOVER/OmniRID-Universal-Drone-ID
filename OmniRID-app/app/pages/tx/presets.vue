<script setup lang="ts">
import { pageForRoute, pageStatusMeta } from '~/pages.config'
import { useEspConnection } from '~/composables/useEspConnection'
import { useNotifications } from '~/composables/useNotifications'

const route = useRoute()
const page = computed(() => pageForRoute(route.path))
const heroTitle = computed(() => page.value?.label ?? 'Presets')
const heroStatus = computed(() => page.value ? pageStatusMeta(page.value.status) : undefined)
const { isEspConnected, proxyFetch } = useEspConnection()
const { notifyInfo, notifyError } = useNotifications()

const downloadConfigBackup = async () => {
  if (!isEspConnected.value) {
    notifyError('Device not connected', 'Connect to the ESP before downloading a configuration backup.')
    return
  }

  try {
    const config = await proxyFetch<Record<string, unknown>>('api/config', { timeout: 5000 })
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new Error('The device returned an invalid configuration.')
    }

    const backup = { ...config, exportedAt: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `omnirid-config-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    notifyInfo('Backup downloaded', 'Device configuration saved as a JSON file.')
  } catch (error: unknown) {
    const err = error as { data?: { error?: string }, message?: string }
    notifyError('Backup failed', err?.data?.error || err?.message || 'Could not download device configuration.')
  }
}
</script>

<template>
  <UDashboardPanel id="tools-presets" class="bg-default" :ui="{ root: 'pt-16' }">
    <template #body>
      <div class="mx-auto w-full max-w-[1400px] space-y-6 px-4 pb-16 sm:px-6 lg:px-10">
        <SectionTabs group="tx" class="mb-2" />
        <PageHero
          :title="heroTitle"
          icon="i-lucide-list"
          description="Back up device settings and manage reusable configuration presets."
          :status="heroStatus"
          size="sm"
        />

        <article class="flex flex-col justify-between gap-4 rounded-xl border border-default bg-elevated/30 p-4 sm:flex-row sm:items-center sm:p-5">
          <div class="flex items-start gap-3">
            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UIcon name="i-lucide-download" class="size-5" aria-hidden="true" />
            </span>
            <div class="min-w-0">
              <h2 class="text-sm font-semibold text-highlighted">
                Configuration backup
              </h2>
              <p class="mt-1 max-w-2xl text-sm leading-5 text-muted">
                Download the current device configuration as JSON before applying a preset or making changes.
              </p>
              <p class="mt-2 flex items-center gap-1.5 text-xs" :class="isEspConnected ? 'text-success' : 'text-muted'">
                <span class="size-1.5 rounded-full" :class="isEspConnected ? 'bg-success' : 'bg-muted'" aria-hidden="true" />
                {{ isEspConnected ? 'Device connected' : 'Connect a device to create a backup' }}
              </p>
            </div>
          </div>
          <UButton
            color="primary"
            icon="i-lucide-download"
            label="Download backup"
            class="shrink-0"
            :disabled="!isEspConnected"
            @click="downloadConfigBackup"
          />
        </article>

        <ContentSection title="Configuration profiles" description="Save, import, export, and apply device configurations.">
          <PresetManager />
        </ContentSection>
      </div>
    </template>
  </UDashboardPanel>
</template>
