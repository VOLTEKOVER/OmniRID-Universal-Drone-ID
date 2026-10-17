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
          · last poll {{ lastPollAt }}
        </template>
      </p>
    </div>

    <div v-if="!isEspConnected" class="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-warning">
      <UIcon name="i-lucide-wifi-off" class="size-4 shrink-0" />
      <span>ESP not connected — recording is disabled until the device is reachable.</span>
    </div>

    <p v-if="lastError" class="flex items-center gap-2 rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
      <UIcon name="i-lucide-circle-alert" class="size-4 shrink-0" />
      <span>Status request failed: {{ lastError }}</span>
    </p>

    <div class="overflow-hidden rounded-lg border border-default bg-elevated/40">
      <div class="flex items-center justify-between gap-2 border-b border-default px-3 py-2">
        <p class="text-xs uppercase tracking-[0.18em] text-muted">
          Latest sample
        </p>
        <span v-if="isRecording" class="flex items-center gap-1.5 text-xs text-error">
          <span class="size-2 animate-pulse rounded-full bg-error" />Recording
        </span>
        <span v-else class="text-xs text-muted">Stopped</span>
      </div>
      <dl v-if="lastSample" class="grid grid-cols-2 gap-x-6 gap-y-1 p-3 text-xs sm:grid-cols-3 lg:grid-cols-4">
        <template v-for="[key, value] in Object.entries(lastSample)" :key="key">
          <div class="flex justify-between gap-2 border-b border-default/60 py-1">
            <dt class="text-muted">
              {{ key }}
            </dt>
            <dd class="truncate font-mono text-highlighted" :title="value">
              {{ value }}
            </dd>
          </div>
        </template>
      </dl>
      <UEmpty
        v-else
        icon="i-lucide-table"
        title="No samples yet"
        description="Start recording to capture telemetry from /api/status."
        class="p-6"
      />
    </div>
  </div>
</template>
