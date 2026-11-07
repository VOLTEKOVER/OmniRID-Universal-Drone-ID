<script setup lang="ts">
import { pageForRoute, pageStatusMeta } from '~/pages.config'
import { onMounted, ref } from 'vue'
import { useEspConnection } from '~/composables/useEspConnection'

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

interface HeapUsage {
  totalBytes: number
  freeBytes: number
  usedBytes: number
  minimumFreeBytes: number
}

const route = useRoute()
const page = computed(() => pageForRoute(route.path))
const heroTitle = computed(() => page.value?.label ?? 'Memory')
const heroStatus = computed(() => page.value ? pageStatusMeta(page.value.status) : undefined)
const savedTrails = ref<SavedTrail[]>([])
const trailHistoryError = ref('')
const { proxyFetch, isEspConnected } = useEspConnection()
const heapUsage = ref<HeapUsage | null>(null)
const memoryMessage = ref('')
const memoryLoading = ref(true)
const heapUsedPercent = computed(() => heapUsage.value
  ? Math.min(100, Math.max(0, heapUsage.value.usedBytes / heapUsage.value.totalBytes * 100))
  : 0)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isNonnegativeNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`
}

const loadMemoryUsage = async () => {
  if (!isEspConnected.value) {
    heapUsage.value = null
    memoryMessage.value = 'Connect to an ESP32 to read live heap statistics.'
    memoryLoading.value = false
    return
  }

  memoryLoading.value = true
  try {
    const report = await proxyFetch<unknown>('api/memory', { timeout: 4500 })
    if (!isRecord(report)) throw new Error('Memory data is not available from this firmware.')
    if (report.simulated === true) {
      heapUsage.value = null
      memoryMessage.value = 'Hardware memory statistics are not available in simulation mode.'
      return
    }

    const heap = report.heap
    if (!isRecord(heap)) throw new Error('Memory data is not available from this firmware.')
    const total = heap.total_bytes
    const free = heap.free_bytes
    const used = heap.used_bytes
    const minimumFree = heap.minimum_free_bytes
    if (!isNonnegativeNumber(total)
      || !isNonnegativeNumber(free)
      || !isNonnegativeNumber(used)
      || !isNonnegativeNumber(minimumFree)
      || total === 0
      || free > total
      || used !== total - free
      || minimumFree > total) {
      throw new Error('The firmware returned invalid memory statistics.')
    }

    heapUsage.value = {
      totalBytes: total,
      freeBytes: free,
      usedBytes: used,
      minimumFreeBytes: minimumFree
    }
    memoryMessage.value = ''
  } catch (error) {
    heapUsage.value = null
    memoryMessage.value = error instanceof Error
      ? error.message
      : 'Live heap statistics are not available from this firmware.'
  } finally {
    memoryLoading.value = false
  }
}

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
  void loadMemoryUsage()
  memoryRefreshTimer = window.setInterval(() => void loadMemoryUsage(), 10000)
})

let memoryRefreshTimer: number | undefined

onBeforeUnmount(() => {
  window.removeEventListener('storage', loadSavedTrails)
  if (memoryRefreshTimer !== undefined) window.clearInterval(memoryRefreshTimer)
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
          description="Live runtime memory, storage availability and browser-saved routes."
          :status="heroStatus"
          size="sm"
        />

        <section aria-label="Device memory usage" class="space-y-3">
          <article class="rounded-xl border border-default bg-elevated/30 p-4 sm:p-5">
            <div class="flex items-start gap-3">
              <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UIcon name="i-lucide-cpu" class="size-5" aria-hidden="true" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 class="text-sm font-semibold text-highlighted">
                      Runtime RAM (heap)
                    </h2>
                    <p class="mt-0.5 text-xs text-muted">
                      ESP-IDF default allocator heap
                    </p>
                  </div>
                  <span
                    class="rounded-md border border-default bg-default px-2.5 py-1 font-mono text-xs"
                    :class="heapUsage ? 'text-success' : 'text-muted'"
                  >
                    {{ heapUsage ? 'Live' : memoryLoading ? 'Reading…' : 'Unavailable' }}
                  </span>
                </div>
                <div class="mt-4 h-2 overflow-hidden rounded-full bg-accented" role="img" :aria-label="heapUsage ? `${heapUsedPercent.toFixed(1)} percent of runtime heap is used` : 'Runtime heap usage unavailable'">
                  <div
                    v-if="heapUsage"
                    class="h-full rounded-full bg-primary transition-[width]"
                    :style="{ width: `${heapUsedPercent}%` }"
                  />
                  <div v-else class="h-full w-full border border-dashed border-muted/50 bg-elevated/50" />
                </div>
                <p v-if="heapUsage" class="mt-2 text-xs text-muted">
                  {{ formatBytes(heapUsage.usedBytes) }} used
                  · {{ formatBytes(heapUsage.freeBytes) }} free
                  · {{ formatBytes(heapUsage.totalBytes) }} total
                </p>
                <p v-if="heapUsage" class="mt-1 text-xs text-muted">
                  Lowest free heap since boot: {{ formatBytes(heapUsage.minimumFreeBytes) }}
                </p>
                <p v-else class="mt-2 text-xs text-muted" role="status">
                  {{ memoryMessage || 'Waiting for live heap statistics from the firmware.' }}
                </p>
              </div>
            </div>
          </article>

          <article class="rounded-xl border border-dashed border-default bg-default p-4 sm:p-5">
            <div class="flex items-start gap-3">
              <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
                <UIcon name="i-lucide-hard-drive" class="size-5" aria-hidden="true" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 class="text-sm font-semibold text-highlighted">
                      Internal flash and NVS
                    </h2>
                    <p class="mt-0.5 text-xs text-muted">
                      Firmware partitions and configuration storage
                    </p>
                  </div>
                  <span class="rounded-md border border-default bg-elevated/40 px-2.5 py-1 font-mono text-xs text-muted">
                    Usage unavailable
                  </span>
                </div>
                <p class="mt-3 text-xs text-muted">
                  This firmware does not expose a reliable occupied-byte total for its flash partitions or NVS. No usage estimate is shown.
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
                      External storage hardware
                    </p>
                  </div>
                  <span class="rounded-md border border-default bg-elevated/40 px-2.5 py-1 font-mono text-xs text-muted">
                    Unavailable
                  </span>
                </div>
                <div class="mt-4 h-2 overflow-hidden rounded-full bg-accented" aria-hidden="true">
                  <div class="h-full w-full rounded-full border border-dashed border-muted/50 bg-elevated/50" />
                </div>
                <p class="mt-2 text-xs text-muted">
                  The current firmware has no proven SD hardware support, so SD capacity and usage are not reported.
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
