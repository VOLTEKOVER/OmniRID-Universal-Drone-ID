<script setup lang="ts">
type Preset = {
  id: string
  name: string
  notes: string
  config: Record<string, unknown>
  createdAt: string
}

const PRESETS_KEY = 'omnirid:presets'

const { isEspConnected, canConfig, proxyFetch } = useEspConnection()
const { notifyInfo, notifyError } = useNotifications()
const toast = useToast()

const loadPresets = (): Preset[] => {
  if (!import.meta.client) return []
  try {
    return JSON.parse(localStorage.getItem(PRESETS_KEY) ?? '[]') as Preset[]
  } catch {
    return []
  }
}

const presets = ref<Preset[]>(loadPresets())
const name = ref('')
const notes = ref('')
const capturedConfig = ref<Record<string, unknown> | null>(null)
const isCapturing = ref(false)
const applyingId = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const query = ref('')
const expandedId = ref<string | null>(null)

const persist = () => {
  if (import.meta.client) localStorage.setItem(PRESETS_KEY, JSON.stringify(presets.value))
}

const filteredPresets = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return presets.value
  return presets.value.filter(preset =>
    preset.name.toLowerCase().includes(q) || preset.notes.toLowerCase().includes(q)
  )
})

const fieldCount = (preset: Preset) => Object.keys(preset.config).length

const formatDate = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? 'unknown' : date.toLocaleString()
}

const togglePreview = (preset: Preset) => {
  expandedId.value = expandedId.value === preset.id ? null : preset.id
}

const captureFromDevice = async () => {
  if (!canConfig.value || isCapturing.value) return
  isCapturing.value = true
  try {
    const data = await proxyFetch<Record<string, unknown> | null>('api/config', { timeout: 5000 })
    capturedConfig.value = data && typeof data === 'object' ? data : null
    if (!capturedConfig.value) throw new Error('Empty device configuration')
    toast.add({
      title: 'Configuration captured',
      description: 'Fill in a name and save the preset.',
      icon: 'i-lucide-check',
      color: 'success'
    })
  } catch (error) {
    capturedConfig.value = null
    const message = error instanceof Error ? error.message : 'Could not read the device configuration.'
    toast.add({
      title: 'Capture failed',
      description: message,
      icon: 'i-lucide-circle-alert',
      color: 'error'
    })
    notifyError('Capture failed', message)
  } finally {
    isCapturing.value = false
  }
}

const savePreset = () => {
  const presetName = name.value.trim()
  if (!presetName || !capturedConfig.value) return
  presets.value.unshift({
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`,
    name: presetName,
    notes: notes.value.trim(),
    config: capturedConfig.value,
    createdAt: new Date().toISOString()
  })
  persist()
  name.value = ''
  notes.value = ''
  capturedConfig.value = null
  toast.add({
    title: 'Preset saved',
    description: `${presetName} added to the local preset library.`,
    icon: 'i-lucide-check',
    color: 'success'
  })
}

const applyPreset = async (preset: Preset) => {
  if (!canConfig.value || applyingId.value) return
  applyingId.value = preset.id
  try {
    await proxyFetch('api/config', { method: 'POST', body: preset.config, timeout: 8000 })
    toast.add({
      title: 'Preset applied',
      description: `${preset.name} was sent to the device.`,
      icon: 'i-lucide-check',
      color: 'success'
    })
    notifyInfo('Preset applied', `${preset.name} was sent to the device.`)
  } catch (error) {
    toast.add({
      title: 'Apply failed',
      description: error instanceof Error ? error.message : 'The device did not accept the preset.',
      icon: 'i-lucide-circle-alert',
      color: 'error'
    })
    notifyError('Preset apply failed', `The device did not accept ${preset.name}.`)
  } finally {
    applyingId.value = null
  }
}

const exportPreset = (preset: Preset) => {
  const blob = new Blob([JSON.stringify({ name: preset.name, notes: preset.notes, config: preset.config }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `omnirid-preset-${preset.name.toLowerCase().replaceAll(/\s+/g, '-')}.json`
  link.click()
  URL.revokeObjectURL(url)
}

const removePreset = (preset: Preset) => {
  presets.value = presets.value.filter(item => item.id !== preset.id)
  if (expandedId.value === preset.id) expandedId.value = null
  persist()
}

const importPreset = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const parsed = JSON.parse(await file.text()) as Partial<Preset>
    const config = parsed.config && typeof parsed.config === 'object' ? parsed.config as Record<string, unknown> : null
    if (!config || !parsed.name) throw new Error('Not a valid OmniRID preset file')
    presets.value.unshift({
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`,
      name: parsed.name,
      notes: parsed.notes ?? '',
      config,
      createdAt: new Date().toISOString()
    })
    persist()
    toast.add({
      title: 'Preset imported',
      description: `${parsed.name} imported into the local library.`,
      icon: 'i-lucide-check',
      color: 'success'
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The selected file is not a valid OmniRID preset.'
    toast.add({
      title: 'Import failed',
      description: message,
      icon: 'i-lucide-circle-alert',
      color: 'error'
    })
    notifyError('Preset import failed', message)
  }
}
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
    <!-- Capture & save -->
    <div class="space-y-4">
      <div class="overflow-hidden rounded-lg border border-default bg-elevated/40">
        <div class="flex items-start justify-between gap-3 border-b border-default px-4 py-3.5">
          <div class="min-w-0">
            <h3 class="flex items-center gap-2 text-sm font-semibold text-highlighted">
              <UIcon name="i-lucide-download" class="size-4 text-primary" />
              Capture from device
            </h3>
            <p class="mt-1 text-xs text-muted">
              Read the live settings from the ESP32 over <code class="font-mono">GET /api/config</code>.
            </p>
          </div>
          <UButton
            color="primary"
            variant="soft"
            icon="i-lucide-scan-line"
            class="shrink-0"
            :loading="isCapturing"
            :disabled="!canConfig"
            aria-label="Capture device configuration"
            @click="captureFromDevice"
          >
            <span class="hidden sm:inline">Capture</span>
          </UButton>
        </div>
        <div class="px-4 py-3">
          <div v-if="capturedConfig" class="flex items-center gap-2">
            <span class="size-1.5 shrink-0 rounded-full bg-success" aria-hidden="true" />
            <span class="font-mono text-xs text-highlighted">{{ Object.keys(capturedConfig).length }} fields</span>
            <span class="text-xs text-muted">ready to save</span>
          </div>
          <p v-else class="flex items-center gap-2 text-xs text-dimmed">
            <span class="size-1.5 shrink-0 rounded-full bg-accented" aria-hidden="true" />
            No configuration captured yet
          </p>
          <p v-if="!canConfig" class="mt-3 flex items-start gap-2 text-xs text-warning">
            <UIcon :name="isEspConnected ? 'i-lucide-usb' : 'i-lucide-wifi-off'" class="mt-0.5 size-4 shrink-0" />
            <span v-if="isEspConnected">Presets capture and apply device configuration, which is only available over WiFi.</span>
            <span v-else>ESP not connected — capture and apply are disabled until the device is reachable.</span>
          </p>
        </div>
      </div>

      <div class="space-y-3 rounded-lg border border-default bg-elevated/40 p-4">
        <h3 class="flex items-center gap-2 text-sm font-semibold text-highlighted">
          <UIcon name="i-lucide-save" class="size-4 text-primary" />
          Save preset
        </h3>
        <UInput v-model="name" placeholder="Preset name (e.g. Racing - EU)" aria-label="Preset name" />
        <UTextarea
          v-model="notes"
          placeholder="Notes (optional)"
          aria-label="Preset notes"
          :rows="3"
        />
        <UButton
          color="primary"
          icon="i-lucide-plus"
          label="Save preset"
          block
          :disabled="!name.trim() || !capturedConfig"
          @click="savePreset"
        />
      </div>

      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-upload"
        label="Import preset file"
        block
        @click="fileInput?.click()"
      />
      <input
        ref="fileInput"
        type="file"
        accept="application/json,.json"
        class="hidden"
        aria-label="Import preset file"
        @change="importPreset"
      >
    </div>

    <!-- Library -->
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h3 class="flex items-center gap-2 text-sm font-semibold text-highlighted">
          <UIcon name="i-lucide-library" class="size-4 text-primary" />
          Preset library
          <span class="rounded-sm bg-elevated px-1.5 py-0.5 font-mono text-[11px] font-normal text-muted">{{ presets.length }}</span>
        </h3>
        <UInput
          v-if="presets.length"
          v-model="query"
          icon="i-lucide-search"
          size="sm"
          placeholder="Filter presets…"
          aria-label="Filter presets"
          class="w-full sm:w-56"
        />
      </div>

      <UEmpty
        v-if="!presets.length"
        icon="i-lucide-library"
        title="No presets yet"
        description="Capture the current device configuration and save it here as a reusable preset."
      />

      <UEmpty
        v-else-if="!filteredPresets.length"
        icon="i-lucide-search-x"
        title="No matches"
        :description="`No preset matches “${query}”.`"
      />

      <div v-else class="space-y-3">
        <article
          v-for="preset in filteredPresets"
          :key="preset.id"
          class="overflow-hidden rounded-lg border border-default bg-elevated/40"
        >
          <div class="flex items-start justify-between gap-3 p-4">
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-highlighted">
                {{ preset.name }}
              </p>
              <p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-muted">
                <span>{{ fieldCount(preset) }} fields</span>
                <span aria-hidden="true" class="text-dimmed">·</span>
                <span>{{ formatDate(preset.createdAt) }}</span>
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <UButton
                color="primary"
                size="xs"
                icon="i-lucide-play"
                label="Apply"
                :loading="applyingId === preset.id"
                :disabled="!canConfig || !!applyingId"
                @click="applyPreset(preset)"
              />
              <UButton
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-lucide-download"
                aria-label="Export preset"
                @click="exportPreset(preset)"
              />
              <UButton
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-lucide-trash"
                aria-label="Delete preset"
                @click="removePreset(preset)"
              />
            </div>
          </div>

          <p v-if="preset.notes" class="border-t border-default px-4 py-2.5 text-xs leading-5 text-muted">
            {{ preset.notes }}
          </p>

          <button
            type="button"
            class="flex w-full items-center justify-between gap-2 border-t border-default px-4 py-2 text-left text-xs text-muted transition-colors hover:bg-elevated/60"
            :aria-expanded="expandedId === preset.id"
            @click="togglePreview(preset)"
          >
            <span class="flex items-center gap-1.5">
              <UIcon :name="expandedId === preset.id ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="size-3.5" />
              Configuration
            </span>
            <span class="font-mono text-[11px] text-dimmed">{{ expandedId === preset.id ? 'hide' : 'preview' }}</span>
          </button>

          <div v-if="expandedId === preset.id" class="border-t border-default bg-default/60 p-3">
            <pre class="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-5 text-dimmed">{{ JSON.stringify(preset.config, null, 2) }}</pre>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>
