<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useIntervalFn } from '@vueuse/core'

type Sample = { recordedAt: string } & Record<string, string>

const { isEspConnected, proxyFetch } = useEspConnection()

const samples = ref<Sample[]>([])
const isRecording = ref(false)
const lastPollAt = ref<string | null>(null)
const lastError = ref<string | null>(null)

const csvEscape = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const flatten = (value: unknown, prefix: string, out: Record<string, unknown>) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, `${prefix}[${index}]`, out))
  } else if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      flatten(item, prefix ? `${prefix}_${key}` : key, out)
    }
  } else {
    out[prefix] = value
  }
}

const snapshot = async () => {
  if (!isEspConnected.value) return
  try {
    const data = await proxyFetch<Record<string, unknown> | null>('api/status', { timeout: 3000 })
    if (data && typeof data === 'object') {
      const flat: Record<string, unknown> = {}
      flatten(data, '', flat)
      samples.value.push({ recordedAt: new Date().toISOString(), ...Object.fromEntries(Object.entries(flat).map(([key, value]) => [key, String(value)])) })
      lastError.value = null
    }
  } catch (error) {
    lastError.value = error instanceof Error ? error.message : 'Status request failed'
    if (isRecording.value) stop()
  } finally {
    lastPollAt.value = new Date().toISOString()
  }
}

const { pause, resume } = useIntervalFn(snapshot, 2000)

const start = () => {
  if (!isEspConnected.value || isRecording.value) return
  isRecording.value = true
  snapshot()
  resume()
}

const stop = () => {
  isRecording.value = false
  pause()
}

watch(isEspConnected, (connected) => {
  if (!connected && isRecording.value) stop()
})

const columns = computed(() => {
  const set = new Set<string>()
  for (const sample of samples.value) for (const key of Object.keys(sample)) set.add(key)
  return [...set]
})

const downloadCsv = () => {
  if (!samples.value.length) return
  const header = columns.value.join(',')
  const rows = samples.value.map(sample => columns.value.map(key => sample[key] ?? '').map(csvEscape).join(','))
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `omnirid-telemetry-${new Date().toISOString().slice(0, 19).replaceAll(':', '-')}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

const clear = () => {
  samples.value = []
}

const lastSample = computed(() => samples.value[samples.value.length - 1])
const previewKeys = ['fw_version', 'gps_valid', 'lat', 'lon', 'alt', 'speed', 'heading', 'satellites', 'tx_total']
const previewFields = computed(() => {
  if (!lastSample.value) return []
  const entries = Object.entries(lastSample.value)
  const preferred = previewKeys
    .filter(key => key in lastSample.value!)
    .map(key => [key, lastSample.value![key]] as const)
  return preferred.length ? preferred.slice(0, 8) : entries.slice(0, 8)
})

const formatPollTime = (iso: string) => new Date(iso).toLocaleTimeString()

onMounted(() => {
  if (isEspConnected.value) snapshot()
})

onBeforeUnmount(stop)
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <UButton
        color="primary"
        :icon="isRecording ? 'i-lucide-square' : 'i-lucide-play'"
        :label="isRecording ? 'Stop recording' : 'Start recording'"
        :disabled="!isEspConnected"
        @click="isRecording ? stop() : start()"
      />
      <UButton
        color="neutral"
        variant="soft"
        icon="i-lucide-download"
        label="Download CSV"
        :disabled="!samples.length"
        @click="downloadCsv"
      />
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-trash"
        label="Clear"
        :disabled="!samples.length"
        @click="clear"
      />
      <p class="ml-auto text-xs text-muted">
        {{ samples.length }} sample{{ samples.length === 1 ? '' : 's' }}<template v-if="lastPollAt">
          · updated {{ formatPollTime(lastPollAt) }}
        </template>
      </p>
    </div>

    <div v-if="!isEspConnected" class="flex items-center gap-2 rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
      <UIcon name="i-lucide-wifi-off" class="size-4 shrink-0" />
      <span>ESP not connected — recording is disabled until the device is reachable.</span>
    </div>

    <p v-if="lastError" class="flex items-center gap-2 rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
      <UIcon name="i-lucide-circle-alert" class="size-4 shrink-0" />
      <span>Status request failed: {{ lastError }}</span>
    </p>

    <div class="overflow-hidden rounded-xl border border-default bg-elevated/30">
      <div class="flex items-center justify-between gap-2 border-b border-default px-3 py-2">
        <p class="text-xs uppercase tracking-[0.18em] text-muted">
          Latest sample
        </p>
        <span v-if="isRecording" class="flex items-center gap-1.5 text-xs text-error">
          <span class="size-2 animate-pulse rounded-full bg-error" />Recording
        </span>
        <span v-else class="text-xs text-muted">Stopped</span>
      </div>
      <div v-if="lastSample" class="p-3 sm:p-4">
        <dl class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div v-for="[key, value] in previewFields" :key="key" class="min-w-0 rounded-lg bg-default/60 px-3 py-2">
            <dt class="truncate text-[11px] text-muted">
              {{ key === 'recordedAt' ? 'Recorded' : key.replaceAll('_', ' ') }}
            </dt>
            <dd class="mt-1 truncate font-mono text-xs font-medium text-highlighted" :title="value">
              {{ value }}
            </dd>
          </div>
        </dl>
        <details class="mt-3 border-t border-default pt-2">
          <summary class="cursor-pointer text-xs font-medium text-muted hover:text-highlighted">
            View all {{ Object.keys(lastSample).length }} fields
          </summary>
          <dl class="mt-2 grid grid-cols-1 gap-x-5 sm:grid-cols-2 lg:grid-cols-3">
            <div v-for="[key, value] in Object.entries(lastSample)" :key="key" class="flex min-w-0 justify-between gap-3 border-b border-default/60 py-2 text-xs">
              <dt class="truncate text-muted">
                {{ key }}
              </dt>
              <dd class="truncate font-mono text-highlighted" :title="value">
                {{ value }}
              </dd>
            </div>
          </dl>
        </details>
      </div>
      <UEmpty
        v-else
        icon="i-lucide-table"
        title="No samples yet"
        description="Connect the ESP and start recording to capture telemetry."
        class="px-4 py-8"
      />
    </div>
  </div>
</template>
