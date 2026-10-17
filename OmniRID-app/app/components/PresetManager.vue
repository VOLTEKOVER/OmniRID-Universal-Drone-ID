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
const { add: addNotification } = useNotifications()
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

const persist = () => {
  if (import.meta.client) localStorage.setItem(PRESETS_KEY, JSON.stringify(presets.value))
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
    toast.add({
      title: 'Capture failed',
      description: error instanceof Error ? error.message : 'Could not read the device configuration.',
      icon: 'i-lucide-circle-alert',
      color: 'error'
    })
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
    addNotification('info', 'Preset applied', `${preset.name} was sent to the device.`)
  } catch (error) {
    toast.add({
      title: 'Apply failed',
      description: error instanceof Error ? error.message : 'The device did not accept the preset.',
      icon: 'i-lucide-circle-alert',
      color: 'error'
    })
    addNotification('error', 'Preset apply failed', `The device did not accept ${preset.name}.`)
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
    toast.add({
      title: 'Import failed',
      description: error instanceof Error ? error.message : 'The selected file is not a valid OmniRID preset.',
      icon: 'i-lucide-circle-alert',
      color: 'error'
    })
  }
}
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
    <div class="space-y-4">
      <div class="rounded-lg border border-default bg-elevated/40 p-4">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <h3 class="text-sm font-semibold text-highlighted">
              Capture device configuration
            </h3>
            <p class="mt-1 text-xs text-muted">
              Read the current settings from the ESP32 via GET /api/config.
            </p>
          </div>
          <UButton
            color="primary"
            variant="soft"
            icon="i-lucide-download"
            class="shrink-0"
            :loading="isCapturing"
            :disabled="!canConfig"
            aria-label="Capture device configuration"
            @click="captureFromDevice"
          >
            <span class="hidden sm:inline">Capture</span>
          </UButton>
        </div>
        <p v-if="!canConfig" class="mt-3 flex items-center gap-2 text-xs text-warning">
          <UIcon :name="isEspConnected ? 'i-lucide-usb' : 'i-lucide-wifi-off'" class="size-4 shrink-0" />
          <span v-if="isEspConnected">Presets capture and apply device configuration, which is only available over WiFi.</span>
          <span v-else>ESP not connected — capture and apply are disabled until the device is reachable.</span>
        </p>
      </div>

      <div class="space-y-3 rounded-lg border border-default bg-elevated/40 p-4">
        <h3 class="text-sm font-semibold text-highlighted">
          Save preset
        </h3>
        <UInput v-model="name" placeholder="Preset name (e.g. Racing - EU)" aria-label="Preset name" />
        <UTextarea
          v-model="notes"
          placeholder="Notes (optional)"
          aria-label="Preset notes"
          :rows="3"
        />
        <p v-if="capturedConfig" class="rounded-lg bg-elevated px-2 py-1 font-mono text-[11px] text-muted">
          {{ Object.keys(capturedConfig).length }} fields captured
        </p>
        <UButton
          color="primary"
          icon="i-lucide-save"
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

    <div class="space-y-3">
      <h3 class="flex items-center justify-between text-sm font-semibold text-highlighted">
        <span>Preset library</span>
        <span class="text-xs font-normal text-muted">{{ presets.length }} preset{{ presets.length === 1 ? '' : 's' }}</span>
      </h3>

      <UEmpty
        v-if="!presets.length"
        icon="i-lucide-list"
        title="No presets yet"
        description="Capture the current device configuration and save it as a reusable preset."
      />

      <div v-for="preset in presets" :key="preset.id" class="rounded-lg border border-default bg-elevated/40 p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-highlighted">
              {{ preset.name }}
            </p>
            <p class="mt-0.5 text-xs text-muted">
              {{ Object.keys(preset.config).length }} fields · saved {{ new Date(preset.createdAt).toLocaleString() }}
            </p>
          </div>
          <div class="flex shrink-0 gap-1">
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
        <p v-if="preset.notes" class="mt-2 text-xs text-muted">
          {{ preset.notes }}
        </p>
        <div class="mt-3 max-h-24 overflow-y-auto rounded-lg bg-default/60 p-2 font-mono text-[11px] leading-5 text-dimmed">
          <pre class="whitespace-pre-wrap">{{ JSON.stringify(preset.config, null, 2).slice(0, 800) }}{{ JSON.stringify(preset.config).length > 800 ? '…' : '' }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
