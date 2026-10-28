<template>
  <UDashboardPanel id="device-sensors" class="bg-default" :ui="{ root: 'pt-16' }">
    <template #body>
      <div class="mx-auto w-full max-w-[1400px] space-y-6 px-4 pb-16 sm:px-6 lg:px-10">
        <SectionTabs group="device" class="mb-2" />
        <PageHero
          title="Sensors"
          icon="i-lucide-activity"
          description="Live sensor data from the connected device."
          :status="heroStatus"
          size="sm"
        />

        <ContentSection title="Telemetry" description="Live values from /api/status">
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <UCard v-for="item in items" :key="item.label">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-muted">{{ item.label }}</p>
                  <p class="text-lg font-semibold">{{ item.value }}</p>
                </div>
                <UIcon :name="item.icon" class="size-5 text-muted" />
              </div>
            </UCard>
          </div>
        </ContentSection>
      </div>
    </template>
  </UDashboardPanel>
</template>

<script setup lang="ts">
import { pageForRoute, pageStatusMeta } from '~/pages.config'
import { useTelemetry } from '~/composables/useTelemetry'
import { useEspConnection } from '~/composables/useEspConnection'

const route = useRoute()
const page = computed(() => pageForRoute(route.path))
const heroStatus = computed(() => page.value ? pageStatusMeta(page.value.status) : undefined)
const { status } = useTelemetry()
const { isEspConnected } = useEspConnection()

const items = computed(() => [
  { label: 'GPS Valid', value: status.value.gps_valid ? 'Yes' : 'No', icon: 'i-lucide-satellite' },
  { label: 'Latitude', value: status.value.lat ?? '—', icon: 'i-lucide-map-pin' },
  { label: 'Longitude', value: status.value.lon ?? '—', icon: 'i-lucide-map-pin' },
  { label: 'Altitude (m)', value: status.value.alt ?? '—', icon: 'i-lucide-mountain' },
  { label: 'Speed (m/s)', value: status.value.speed ?? '—', icon: 'i-lucide-gauge' },
  { label: 'Heading (°)', value: status.value.heading ?? '—', icon: 'i-lucide-compass' },
  { label: 'Satellites', value: status.value.satellites ?? '—', icon: 'i-lucide-radio' },
  { label: 'Fix Type', value: status.value.fix_type ?? '—', icon: 'i-lucide-crosshair' },
  { label: 'Uptime (ms)', value: status.value.uptime_ms ?? '—', icon: 'i-lucide-clock' },
  { label: 'TX Total', value: status.value.tx_total ?? '—', icon: 'i-lucide-send' },
  { label: 'TX WiFi Beacon', value: status.value.tx_wifi_bcn ?? '—', icon: 'i-lucide-wifi' },
  { label: 'TX BLE4', value: status.value.tx_ble4 ?? '—', icon: 'i-lucide-bluetooth' }
])
</script>
