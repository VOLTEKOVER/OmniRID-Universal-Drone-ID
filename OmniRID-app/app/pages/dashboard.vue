<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { pageDescriptions, pageForRoute, pageStatusMeta } from '~/pages.config'
import { PROTOCOLS } from '~/config/device'
import { useTelemetry } from '~/composables/useTelemetry'

const route = useRoute()
const { isEspConnected } = useEspConnection()
const { status, lastUpdate, lastError } = useTelemetry()

const page = computed(() => pageForRoute(route.path))
const heroTitle = computed(() => page.value?.label ?? 'Dashboard')
const heroStatus = computed(() => page.value ? pageStatusMeta(page.value.status) : undefined)

const now = ref(Date.now())
useIntervalFn(() => {
  now.value = Date.now()
}, 1000)

const ageSeconds = computed(() => lastUpdate.value !== null
  ? Math.max(0, Math.round((now.value - lastUpdate.value) / 1000))
  : null)

const isLive = computed(() => lastUpdate.value !== null && now.value - lastUpdate.value < 7000)

const gpsValid = computed(() => !!status.value.gps_valid)

const fixLabel = computed(() => {
  const fix = Number(status.value.fix_type ?? 0)
  if (fix >= 3) return '3D fix'
  if (fix === 2) return '2D fix'
  return 'No fix'
})

const protocolLabel = computed(() => {
  const value = Number(status.value.protocol ?? 0)
  return PROTOCOLS.find(option => Number(option.value) === value)?.label ?? 'Unknown'
})

const positionText = computed(() => {
  if (!gpsValid.value) return 'No fix'
  const lat = Number(status.value.lat)
  const lon = Number(status.value.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) return 'No fix'
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`
})

const fmt = (value: unknown, digits = 1) => {
  const n = Number(value)
  return Number.isFinite(n) ? n.toFixed(digits) : '--'
}

const stats = computed(() => [
  {
    label: 'GPS status',
    value: fixLabel.value,
    sub: `${Number(status.value.satellites ?? 0)} satellites`,
    icon: 'i-lucide-satellite',
    tone: gpsValid.value ? 'text-success' : 'text-warning'
  },
  {
    label: 'Position',
    value: positionText.value,
    sub: `Altitude ${fmt(status.value.alt)} m`,
    icon: 'i-lucide-map-pin',
    tone: gpsValid.value ? 'text-primary' : 'text-muted'
  },
  {
    label: 'Speed',
    value: `${fmt(status.value.speed)} m/s`,
    sub: `Vertical ${fmt(status.value.speed_vertical ?? 0)} m/s`,
    icon: 'i-lucide-gauge',
    tone: 'text-primary'
  },
  {
    label: 'Heading',
    value: `${Math.round(Number(status.value.heading ?? 0))}°`,
    sub: 'Compass heading',
    icon: 'i-lucide-navigation',
    tone: 'text-primary'
  },
  {
    label: 'Protocol',
    value: protocolLabel.value,
    sub: status.value.standard ? `${status.value.standard}${status.value.standard_fallback ? ' (fallback)' : ''}` : '—',
    icon: 'i-lucide-cable',
    tone: 'text-primary'
  },
  {
    label: 'Transmissions',
    value: `${Number(status.value.tx_total ?? 0)}`,
    sub: `WiFi ${fmt(status.value.tx_wifi_bcn, 0)} · NAN ${fmt(status.value.tx_wifi_nan, 0)} · BLE4 ${fmt(status.value.tx_ble4, 0)} · BLE5 ${fmt(status.value.tx_ble5, 0)}`,
    icon: 'i-lucide-radio',
    tone: 'text-primary'
  }
])

const counters = computed(() => [
  { label: 'WiFi Beacon', value: fmt(status.value.tx_wifi_bcn, 0) },
  { label: 'WiFi NAN', value: fmt(status.value.tx_wifi_nan, 0) },
  { label: 'BLE 4 Legacy', value: fmt(status.value.tx_ble4, 0) },
  { label: 'BLE 5 Long Range', value: fmt(status.value.tx_ble5, 0) },
  { label: 'Ticks', value: fmt(status.value.ticks ?? 0, 0) },
  { label: 'GPS updates', value: fmt(status.value.gps_updates ?? 0, 0) },
  { label: 'Signatures ok', value: `${fmt(status.value.signatures_ok ?? 0, 0)} / ${fmt(status.value.signatures_total ?? 0, 0)}` },
  { label: 'OTA count', value: fmt(status.value.ota_count ?? 0, 0) }
])

const hasTakeoff = computed(() => {
  const s = status.value
  return !!s.takeoff_captured && Number(s.takeoff_lat) !== 0 && Number(s.takeoff_lon) !== 0
})
</script>

<template>
  <UDashboardPanel id="monitor-dashboard" class="bg-default" :ui="{ root: 'pt-16' }">
    <template #body>
      <div class="mx-auto w-full max-w-7xl space-y-6 pb-8">
        <PageHero
          :title="heroTitle"
          icon="i-lucide-chart-column"
          :description="pageDescriptions['dashboard']"
          :status="heroStatus"
          size="sm"
        >
          <template #right>
            <div class="flex items-center gap-3 rounded-2xl border border-default bg-elevated/60 px-4 py-3">
              <span
                class="size-2.5 rounded-full"
                :class="isLive ? 'animate-pulse bg-success' : isEspConnected ? 'bg-warning' : 'bg-error'"
              />
              <div class="min-w-0">
                <p class="text-sm font-semibold text-highlighted">
                  {{ isLive ? 'Live' : isEspConnected ? 'Connected' : 'Offline' }}
                </p>
                <p class="truncate text-xs text-muted">
                  {{ ageSeconds !== null ? `updated ${ageSeconds}s ago` : isEspConnected ? 'waiting for first update' : 'no ESP connection' }}
                </p>
              </div>
              <UIcon :name="isEspConnected ? 'i-lucide-wifi' : 'i-lucide-wifi-off'" class="size-4 text-muted" />
            </div>
          </template>
        </PageHero>

        <div v-if="!isEspConnected" class="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-warning">
          <UIcon name="i-lucide-wifi-off" class="size-4 shrink-0" />
          <span>ESP not connected — check the connection settings or enable the simulated connection to preview the dashboard.</span>
        </div>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <div
            v-for="stat in stats"
            :key="stat.label"
            class="flex items-start gap-3 rounded-2xl border border-default bg-default p-4"
          >
            <div class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
              <UIcon :name="stat.icon" class="size-4" :class="stat.tone" />
            </div>
            <div class="min-w-0">
              <p class="text-[10px] uppercase tracking-[0.18em] text-muted">
                {{ stat.label }}
              </p>
              <p class="truncate font-mono text-sm font-semibold text-highlighted" :title="stat.value">
                {{ stat.value }}
              </p>
              <p class="truncate text-xs text-muted" :title="stat.sub">
                {{ stat.sub }}
              </p>
            </div>
          </div>
        </div>

        <section class="rounded-2xl border border-default bg-default overflow-hidden">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-default px-5 py-4">
            <div>
              <h2 class="text-lg font-bold text-highlighted">
                Position — OpenStreetMap
              </h2>
              <p class="mt-1 text-sm text-muted">
                Live GPS position, take-off point and recent flight path.
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <UBadge color="primary" variant="soft" label="Drone" />
              <UBadge
                v-if="hasTakeoff"
                color="success"
                variant="soft"
                label="Take-off"
              />
              <span v-if="isLive" class="flex items-center gap-1.5 text-xs text-success">
                <span class="size-1.5 animate-pulse rounded-full bg-success" />tracking
              </span>
            </div>
          </div>

          <ClientOnly>
            <DroneMap :status="status" height-class="h-[55vh] min-h-[420px]" />
            <template #fallback>
              <div class="flex h-[55vh] min-h-[420px] items-center justify-center">
                <p class="text-sm text-muted">
                  Loading map…
                </p>
              </div>
            </template>
          </ClientOnly>
        </section>

        <p v-if="lastError" class="flex items-center gap-2 rounded-xl border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
          <UIcon name="i-lucide-triangle-alert" class="size-4 shrink-0" />
          <span>Status request failed: {{ lastError }}</span>
        </p>

        <section class="rounded-2xl border border-default bg-default p-5">
          <div class="mb-4">
            <h2 class="text-lg font-bold text-highlighted">
              Transmission log
            </h2>
            <p class="mt-1 text-sm text-muted">
              Runtime counters from /api/status.
            </p>
          </div>
          <dl class="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            <div v-for="counter in counters" :key="counter.label" class="flex items-center justify-between gap-2 border-b border-default/60 py-1.5">
              <dt class="text-xs text-muted">
                {{ counter.label }}
              </dt>
              <dd class="truncate font-mono text-xs text-highlighted">
                {{ counter.value }}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </template>
  </UDashboardPanel>
</template>
