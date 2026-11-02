<script setup lang="ts">
import { pageForRoute, pageStatusMeta } from '~/pages.config'
import { onMounted, ref } from 'vue'

const SAVED_TRAILS_KEY = 'omnirid:dashboard-trails'

interface SavedTrail {
  id: string
  name: string
  savedAt: number
  tracks: Array<{
    label: string
    points: Array<{ lat: number, lng: number, timestamp: number }>
  }>
}

const route = useRoute()
const page = computed(() => pageForRoute(route.path))
const heroTitle = computed(() => page.value?.label ?? 'Memory')
const heroStatus = computed(() => page.value ? pageStatusMeta(page.value.status) : undefined)
const savedTrails = ref<SavedTrail[]>([])
const trailHistoryError = ref('')

const isSavedTrail = (value: unknown): value is SavedTrail => {
  if (!value || typeof value !== 'object') return false
  const trail = value as Partial<SavedTrail>
  return typeof trail.id === 'string'
    && typeof trail.name === 'string'
    && typeof trail.savedAt === 'number'
    && Number.isFinite(trail.savedAt)
    && Array.isArray(trail.tracks)
    && trail.tracks.every(track =>
      typeof track.label === 'string'
      && Array.isArray(track.points)
      && track.points.every(point =>
        Number.isFinite(point.lat)
        && Number.isFinite(point.lng)
        && Number.isFinite(point.timestamp)
      )
    )
}

const loadSavedTrails = () => {
  try {
    const raw = localStorage.getItem(SAVED_TRAILS_KEY)
    if (!raw) {
      savedTrails.value = []
      trailHistoryError.value = ''
      return
    }

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.every(isSavedTrail)) {
      throw new Error('Saved route history has an invalid format.')
    }
    savedTrails.value = [...parsed].sort((a, b) => b.savedAt - a.savedAt)
    trailHistoryError.value = ''
  } catch (error) {
    trailHistoryError.value = error instanceof Error ? error.message : 'Unable to load saved route history.'
  }
}

const exportTrail = (trail: SavedTrail) => {
  const features = trail.tracks
    .filter(track => track.points.length >= 2)
    .map(track => ({
      type: 'Feature',
      properties: { name: track.label, route: trail.name, savedAt: trail.savedAt },
      geometry: {
        type: 'LineString',
        coordinates: track.points.map(point => [point.lng, point.lat])
      }
    }))
  const blob = new Blob([JSON.stringify({ type: 'FeatureCollection', features }, null, 2)], { type: 'application/geo+json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${trail.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}.geojson`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

onMounted(() => {
  loadSavedTrails()
  window.addEventListener('storage', loadSavedTrails)
})

onBeforeUnmount(() => {
  window.removeEventListener('storage', loadSavedTrails)
})
</script>

<template>
  <UDashboardPanel id="device-memory" class="bg-default" :ui="{ root: 'pt-16' }">
    <template #body>
      <div class="mx-auto w-full max-w-[1400px] space-y-6 px-4 pb-16 sm:px-6 lg:px-10">
        <SectionTabs group="tx" class="mb-2" />

        <PageHero
          :title="heroTitle"
          icon="i-lucide-database"
          description="Monitor device storage and protect your configuration."
          :status="heroStatus"
          size="sm"
        />

        <section aria-label="Storage usage" class="space-y-3">
          <article class="rounded-xl border border-default bg-elevated/30 p-4 sm:p-5">
            <div class="flex items-start gap-3">
              <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UIcon name="i-lucide-cpu" class="size-5" aria-hidden="true" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 class="text-sm font-semibold text-highlighted">
                      ESP32 internal flash
                    </h2>
                    <p class="mt-0.5 text-xs text-muted">
                      Firmware partitions and configuration storage (NVS)
                    </p>
                  </div>
                  <span class="rounded-md border border-default bg-default px-2.5 py-1 font-mono text-xs text-muted">
                    Usage unavailable
                  </span>
                </div>
                <div class="mt-4 h-2 overflow-hidden rounded-full bg-accented" aria-hidden="true">
                  <div class="h-full w-full rounded-full border border-dashed border-muted/50 bg-elevated/50" />
                </div>
                <p class="mt-2 text-xs text-muted">
                  Waiting for the firmware to report flash and NVS usage.
                </p>
              </div>
            </div>
          </article>

          <article class="rounded-xl border border-dashed border-default bg-default p-4 sm:p-5">
            <div class="flex items-start gap-3">
              <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
                <UIcon name="i-lucide-database" class="size-5" aria-hidden="true" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 class="text-sm font-semibold text-highlighted">
                      SD card
                    </h2>
                    <p class="mt-0.5 text-xs text-muted">
                      External storage
                    </p>
                  </div>
                  <span class="rounded-md border border-default bg-elevated/40 px-2.5 py-1 font-mono text-xs text-muted">
                    Not configured
                  </span>
                </div>
                <div class="mt-4 h-2 overflow-hidden rounded-full bg-accented" aria-hidden="true">
                  <div class="h-full w-full rounded-full border border-dashed border-muted/50 bg-elevated/50" />
                </div>
                <p class="mt-2 text-xs text-muted">
                  SD support is pending hardware selection and firmware integration.
                </p>
              </div>
            </div>
          </article>
        </section>

        <section aria-labelledby="trail-history-title" class="overflow-hidden rounded-xl border border-default">
          <div class="flex flex-col gap-3 border-b border-default bg-elevated/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h2 id="trail-history-title" class="text-sm font-semibold text-highlighted">
                Route history
              </h2>
              <p class="mt-1 text-xs text-muted">
                Routes saved from the dashboard on this browser.
              </p>
            </div>
            <UButton
              color="primary"
              variant="soft"
              icon="i-lucide-download"
              label="Richiedi download tracce salvate"
              disabled
              title="Waiting for firmware support to send saved route history to the app."
            />
          </div>
          <p class="border-b border-default px-4 py-2 text-xs text-muted sm:px-5">
            Il download dallo storico del dispositivo sarà disponibile quando il firmware invierà le tracce alla app.
          </p>

          <p v-if="trailHistoryError" class="border-b border-error/30 bg-error/5 px-4 py-3 text-sm text-error" role="alert">
            {{ trailHistoryError }}
          </p>

          <ol v-if="savedTrails.length" class="divide-y divide-default">
            <li v-for="trail in savedTrails" :key="trail.id" class="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div class="flex min-w-0 items-start gap-3">
                <span class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <UIcon name="i-lucide-route" class="size-4" aria-hidden="true" />
                </span>
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-highlighted">
                    {{ trail.name }}
                  </p>
                  <p class="mt-1 text-xs text-muted">
                    {{ new Date(trail.savedAt).toLocaleString() }}
                    · {{ trail.tracks.length }} tracks
                    · {{ trail.tracks.reduce((total, track) => total + track.points.length, 0) }} points
                  </p>
                </div>
              </div>
              <UButton
                color="neutral"
                variant="soft"
                size="sm"
                icon="i-lucide-file-down"
                label="Export GeoJSON"
                class="shrink-0"
                :disabled="!trail.tracks.some(track => track.points.length >= 2)"
                @click="exportTrail(trail)"
              />
            </li>
          </ol>
          <div v-else-if="!trailHistoryError" class="px-4 py-8 text-center sm:px-5">
            <UIcon name="i-lucide-route" class="mx-auto size-6 text-muted" aria-hidden="true" />
            <p class="mt-2 text-sm font-medium text-highlighted">
              No saved routes yet
            </p>
            <p class="mt-1 text-xs text-muted">
              Record and save a route from the dashboard to see it in this history.
            </p>
          </div>
        </section>
      </div>
    </template>
  </UDashboardPanel>
</template>
