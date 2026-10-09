<script setup lang="ts">
import { pageForRoute, pageStatusMeta } from '~/pages.config'
import { DEFAULTS, pageStatus as schemaPageStatus } from '~/config/device'
import type { DeviceConfig, Issue, PageId } from '~/config/device'

type FieldType = 'text' | 'number' | 'password' | 'select' | 'toggle' | 'textarea' | 'chips'

export type ConfigField = {
  name: string
  label: string
  type?: FieldType
  placeholder?: string
  description?: string
  disabled?: boolean
  maxlength?: number
  options?: { label: string, value: string }[]
  value?: string | number | boolean
  stepper?: boolean
  step?: number
}

export type ConfigSection = {
  title: string
  description?: string
  fields: ConfigField[]
}

export type ConfigDanger = {
  title?: string
  description: string
  link?: { label: string, to: string }
}

const props = defineProps<{
  title?: string
  description: string
  icon?: string
  status?: string
  sections: ConfigSection[]
  group?: string
  readonly?: boolean
  savable?: boolean
  load?: boolean
  validateConfig?: (cfg: DeviceConfig) => Issue[]
  mapPayload?: (state: Record<string, unknown>) => Record<string, unknown>
  applyLoaded?: (cfg: Record<string, unknown>, set: (key: string, value: unknown) => void) => void
  danger?: (state: Record<string, unknown>) => ConfigDanger[]
  headerActions?: { label: string, to: string }[]
}>()

const toast = useToast()
const { protocol, region, target } = useDeviceProfile()
const { add: addNotification } = useNotifications()
const { configActions } = useDashboard()

const route = useRoute()
const page = computed(() => pageForRoute(route.path))
const heroTitle = computed(() => props.title ?? page.value?.label ?? '')
const heroIcon = computed(() => props.icon ?? page.value?.icon)
const savable = computed(() => props.savable !== false && !props.readonly)
const heroId = computed(() => heroTitle.value.toLowerCase().replaceAll(' ', '-'))

const pageId = computed<PageId | undefined>(() => {
  const segment = route.path.split('/')[2]
  const map: Record<string, PageId | undefined> = {
    nation: 'nation', inputs: 'inputs', identity: 'identity',
    'flight-controller': 'fc', hardware: 'hardware', system: 'system', sensors: 'hardware'
  }
  return segment ? map[segment] : undefined
})

const issues = ref<Issue[]>([])
const dangerItems = computed(() => props.danger ? props.danger({ ...state }) : [])
const schemaStatus = computed(() => {
  if (!props.validateConfig || !pageId.value || !issues.value.length) return undefined
  const status = schemaPageStatus(issues.value, pageId.value)
  if (status === 'invalid') return { label: 'Invalid config', color: 'error' as const }
  if (status === 'warning') return { label: 'Check config', color: 'warning' as const }
  return undefined
})

const heroStatus = computed(() => props.status
  ? { label: props.status }
  : schemaStatus.value
    ? schemaStatus.value
    : page.value
      ? { ...pageStatusMeta(page.value.status) }
      : undefined)

const isFactoryResetOpen = ref(false)
const restartDevice = () => {
  toast.add({
    title: 'Restart device',
    description: 'Restart action ready to be sent to the ESP.',
    icon: 'i-lucide-rotate-ccw',
    color: 'warning'
  })
}
const performFactoryReset = () => {
  isFactoryResetOpen.value = false
  toast.add({
    title: 'Factory reset',
    description: 'Reset action ready to be sent to the ESP.',
    icon: 'i-lucide-alert-triangle',
    color: 'error'
  })
}

const fieldsFor = (sections: ConfigSection[]) => sections.flatMap(section => section.fields)

const initialValue = (field: ConfigField): string | number | boolean => {
  if (field.name === 'protocol') return protocol.value
  if (field.name === 'region') return region.value
  if (field.name === 'target') return target.value
  return field.value ?? (field.type === 'toggle' ? false : '')
}

const state = reactive<Record<string, any>>(
  Object.fromEntries(fieldsFor(props.sections).map(field => [field.name, initialValue(field)]))
)

watch(() => props.sections, (sections) => {
  const fields = fieldsFor(sections)
  const names = new Set(fields.map(field => field.name))
  for (const field of fields) {
    if (!(field.name in state)) state[field.name] = initialValue(field)
  }
  for (const key of Object.keys(state)) {
    if (!names.has(key)) delete state[key]
  }
}, { deep: true })

watch(() => state.protocol, value => {
  if (typeof value === 'string') protocol.value = value as typeof protocol.value
})

watch(() => state.region, value => {
  if (typeof value === 'string') region.value = value as typeof region.value
})

watch(() => state.target, value => {
  if (typeof value === 'string') target.value = value as typeof target.value
})

const errors = reactive<Record<string, string>>({})
const isSaving = ref(false)

const validateField = (field: ConfigField) => {
  if (props.readonly || field.disabled) {
    delete errors[field.name]
    return true
  }

  const value = state[field.name]
  const text = typeof value === 'string' ? value.trim() : value
  let message = ''

  if (field.type === 'number' && (text === '' || !Number.isFinite(Number(text)))) {
    message = 'Enter a valid number.'
  } else if (field.name === 'operator_id' && ['auto', 'eur', 'faa', 'can', 'aus'].includes(region.value) && !text) {
    message = 'Operator ID is required for the selected region.'
  } else if (['uas_id', 'operator_id', 'second_id'].includes(field.name) && text && !/^[A-Za-z0-9_.:/ -]{3,32}$/.test(String(text))) {
    message = 'Use 3-32 letters, numbers or . _ : / -.'
  } else if (field.name === 'self_id' && text && String(text).length > 23) {
    message = 'Self-ID must be 23 characters or fewer.'
  } else if (field.name === 'ssid' && (!text || String(text).length > 32)) {
    message = 'SSID must contain 1-32 characters.'
  } else if (field.name === 'password' && String(text).length > 0 && (String(text).length < 8 || String(text).length > 63)) {
    message = 'Password must be empty or 8-63 characters.'
  } else if (['latitude', 'op_lat'].includes(field.name) && (Number(text) < -90 || Number(text) > 90)) {
    message = 'Latitude must be between -90 and 90.'
  } else if (['longitude', 'op_lon'].includes(field.name) && (Number(text) < -180 || Number(text) > 180)) {
    message = 'Longitude must be between -180 and 180.'
  } else if (['channel', 'wifi_channel'].includes(field.name) && (Number(text) < 1 || Number(text) > 13 || !Number.isInteger(Number(text)))) {
    message = 'WiFi channel must be an integer from 1 to 13.'
  } else if (field.name.includes('brightness') && (Number(text) < 0 || Number(text) > 255)) {
    message = 'Brightness must be between 0 and 255.'
  } else if (field.name.includes('rate') && (Number(text) < 0 || Number(text) > 5)) {
    message = 'Rate must be between 0 and 5 Hz.'
  } else if (field.name === 'startup_delay' && (Number(text) < 0 || Number(text) > 30000)) {
    message = 'Startup delay must be between 0 and 30000 ms.'
  } else if (field.name.endsWith('_gpio') || field.name.endsWith('_pin')) {
    if (!Number.isInteger(Number(text)) || Number(text) < -1 || Number(text) > 48) message = 'GPIO must be an integer from -1 to 48.'
  }

  if (message) errors[field.name] = message
  else delete errors[field.name]
  return !message
}

const validateCompatibility = () => {
  let valid = true

  for (const field of fieldsFor(props.sections)) valid = validateField(field) && valid

  if (state.tx_pin !== undefined && state.rx_pin !== undefined && state.tx_pin === state.rx_pin) {
    errors.tx_pin = 'TX and RX must use different GPIO pins.'
    errors.rx_pin = 'TX and RX must use different GPIO pins.'
    valid = false
  }

  if (state.can_rx !== undefined && state.can_tx !== undefined && ((state.can_rx === -1) !== (state.can_tx === -1))) {
    errors.can_rx = 'Configure both DroneCAN pins or disable both.'
    errors.can_tx = 'Configure both DroneCAN pins or disable both.'
    valid = false
  }

  if (state.mavlink_usb === true && !['auto', 'mavlink'].includes(protocol.value)) {
    errors.mavlink_usb = 'MAVLink USB requires MAVLink or Auto-detect protocol.'
    valid = false
  }

  return valid
}

const { isEspConnected, lastError, proxyFetch } = useEspConnection()

const isDisabled = (field: ConfigField) => props.readonly || field.disabled

const buildPayload = () => {
  const payload: Record<string, unknown> = {}
  for (const field of fieldsFor(props.sections)) {
    const value = state[field.name]
    if (value !== undefined && value !== '') payload[field.name] = value
  }
  return props.mapPayload ? props.mapPayload({ ...state }) : payload
}

const toDeviceConfig = (): DeviceConfig => {
  const raw = props.mapPayload ? props.mapPayload({ ...state }) : { ...state }
  const out = { ...DEFAULTS } as DeviceConfig
  for (const key of Object.keys(DEFAULTS)) {
    const value = (raw as Record<string, unknown>)[key]
    if (value !== undefined && value !== '') (out as unknown as Record<string, unknown>)[key] = value
  }
  return out
}

const validateSchema = () => {
  issues.value = []
  if (!props.validateConfig) return
  const all = props.validateConfig(toDeviceConfig())
  issues.value = pageId.value ? all.filter(issue => issue.page === pageId.value) : all
  for (const issue of issues.value) {
    if (issue.severity === 'error') errors[issue.field] = issue.message
    else if (errors[issue.field]) delete errors[issue.field]
  }
}

const setValue = (key: string, value: unknown) => { state[key] = value }

onMounted(async () => {
  if (!props.load) return
  if (isEspConnected.value) {
    try {
      const cfg = await proxyFetch<Record<string, unknown>>('api/config', { timeout: 4500 })
      if (props.applyLoaded) props.applyLoaded(cfg, setValue)
      else {
        for (const field of fieldsFor(props.sections)) {
          if (cfg[field.name] !== undefined) state[field.name] = cfg[field.name]
        }
      }
    } catch {
      /* device offline: keep the defaults */
    }
  }
  validateSchema()
})

const fileInput = ref<HTMLInputElement | null>(null)

const exportConfig = () => {
  const payload = { ...buildPayload(), exportedAt: new Date().toISOString() }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `omnirid-${heroId.value}.json`
  link.click()
  URL.revokeObjectURL(url)
  toast.add({
    title: 'Configuration exported',
    description: `${heroTitle.value} saved as omnirid-${heroId.value}.json.`,
    icon: 'i-lucide-check',
    color: 'success'
  })
}

const importConfig = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  try {
    const parsed = JSON.parse(await file.text()) as Record<string, unknown>
    let applied = 0
    for (const field of fieldsFor(props.sections)) {
      if (parsed[field.name] !== undefined) {
        state[field.name] = parsed[field.name]
        applied += 1
      }
    }
    if (applied === 0) throw new Error('No matching fields')
    validateCompatibility()
    validateSchema()
    toast.add({
      title: 'Configuration imported',
      description: `Applied ${applied} fields from ${file.name}.`,
      icon: 'i-lucide-check',
      color: 'success'
    })
    addNotification('info', 'Configuration imported', `Applied ${applied} fields from ${file.name}.`)
  } catch (error) {
    toast.add({
      title: 'Import failed',
      description: error instanceof Error ? error.message : 'The selected file is not a valid configuration.',
      icon: 'i-lucide-circle-alert',
      color: 'error'
    })
  }
}

const handleConfigAction = (action: 'save' | 'export') => {
  if (action === 'save') save()
  else exportConfig()
}

onBeforeMount(() => {
  configActions.on(handleConfigAction)
})
onBeforeUnmount(() => {
  configActions.off(handleConfigAction)
})

const save = async () => {
  if (!isEspConnected.value) return
  if (isSaving.value) return
  const compatible = validateCompatibility()
  validateSchema()
  if (!compatible || issues.value.some(issue => issue.severity === 'error')) {
    toast.add({
      title: 'Check the configuration',
      description: 'Some values are invalid or incompatible with the selected profile.',
      icon: 'i-lucide-circle-alert',
      color: 'error'
    })
    addNotification('error', 'Configuration not saved', 'Some values are invalid or incompatible with the selected profile.')
    return
  }

  try {
    isSaving.value = true
    await proxyFetch('api/config', { method: 'POST', body: buildPayload() })
    toast.add({
      title: `${heroTitle.value} saved`,
      description: 'Configuration sent to the ESP.',
      icon: 'i-lucide-check',
      color: 'success'
    })
    addNotification('info', `${heroTitle.value} saved`, 'Configuration sent to the ESP.')
  } catch (error) {
    toast.add({
      title: 'ESP unreachable',
      description: !isEspConnected.value
        ? 'The device is not connected. Set the ESP address from the header.'
        : lastError.value ?? 'The device did not accept the configuration.',
      icon: 'i-lucide-circle-alert',
      color: 'error'
    })
    addNotification('error', 'ESP unreachable', !isEspConnected.value
      ? 'The device is not connected. Set the ESP address from the header.'
      : lastError.value ?? 'The device did not accept the configuration.')
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <UDashboardPanel :id="heroId" class="bg-default" :ui="{ root: 'pt-16' }">
    <template #body>
      <div class="mx-auto w-full max-w-5xl space-y-6 pb-8">
        <SectionTabs v-if="group" :group="group" class="mb-2" />
        <PageHero :title="heroTitle" :icon="heroIcon" :description="description" :status="heroStatus" size="sm">
          <template v-if="props.headerActions?.length" #actions>
            <UButton
              v-for="action in props.headerActions"
              :key="action.label"
              :label="action.label"
              :to="action.to"
              color="neutral"
              variant="soft"
              icon="i-lucide-arrow-up-right"
              trailing
            />
          </template>
        </PageHero>

        <form class="space-y-5" @submit.prevent="save">
          <ContentSection
            v-for="section in sections"
            :key="section.title"
            :title="section.title"
            :description="section.description"
            heading="md"
          >
            <div class="grid gap-5 md:grid-cols-2">
              <template v-for="field in section.fields" :key="field.name">
                <div v-if="field.type === 'chips'" class="flex flex-wrap items-center gap-1.5">
                  <UBadge
                    v-for="chip in field.options ?? []"
                    :key="chip.label"
                    color="neutral"
                    variant="outline"
                    :label="chip.label"
                  />
                </div>
                <UFormField
                  v-else
                  :label="field.label"
                  :description="field.description"
                  :error="errors[field.name]"
                  :class="field.type === 'textarea' ? 'md:col-span-2' : ''"
                >
                  <USwitch
                    v-if="field.type === 'toggle'"
                    v-model="state[field.name]"
                    :disabled="isDisabled(field)"
                    @update:model-value="validateField(field)"
                  />
                  <USelect
                    v-else-if="field.type === 'select'"
                    v-model="state[field.name]"
                    :items="field.options ?? []"
                    value-key="value"
                    :disabled="isDisabled(field)"
                    class="w-full"
                    @update:model-value="validateField(field)"
                  />
                  <UTextarea
                    v-else-if="field.type === 'textarea'"
                    v-model="state[field.name]"
                    :placeholder="field.placeholder"
                    :rows="4"
                    :maxlength="field.maxlength"
                    :disabled="isDisabled(field)"
                    class="w-full"
                    @blur="validateField(field)"
                  />
                  <UInputNumber
                    v-else-if="field.type === 'number' && field.stepper"
                    v-model="state[field.name]"
                    :step="field.step ?? 1"
                    :disabled="isDisabled(field)"
                    class="w-full"
                    @blur="validateField(field)"
                  />
                  <UInput
                    v-else
                    v-model="state[field.name]"
                    :type="field.type ?? 'text'"
                    :placeholder="field.placeholder"
                    :maxlength="field.maxlength"
                    :disabled="isDisabled(field)"
                    class="w-full"
                    @blur="validateField(field)"
                  />
                </UFormField>
              </template>
            </div>
          </ContentSection>

          <div
            v-if="savable && !isEspConnected"
            class="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-warning"
          >
            <UIcon name="i-lucide-wifi-off" class="size-4 shrink-0" />
            <span>ESP not connected — actions are disabled until the device is reachable.</span>
          </div>

          <div class="space-y-3">
            <UAlert
              v-for="(danger, index) in dangerItems"
              :key="index"
              color="error"
              variant="soft"
              icon="i-lucide-triangle-alert"
              class="rounded-lg"
            >
              <template #title>{{ danger.title }}</template>
              <template #description>
                <span class="text-[13px] leading-5">{{ danger.description }}</span>
                <NuxtLink
                  v-if="danger.link"
                  :to="danger.link.to"
                  class="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
                >
                  {{ danger.link.label }}
                  <UIcon name="i-lucide-arrow-up-right" class="size-3.5" />
                </NuxtLink>
              </template>
            </UAlert>
          </div>

          <UAlert v-if="issues.length" color="warning" icon="i-lucide-circle-alert" variant="soft" class="rounded-lg">
            <template #title>
              Configuration issues ({{ issues.length }})
            </template>
            <template #description>
              <ul class="list-inside list-disc space-y-1">
                <li v-for="(issue, index) in issues" :key="index" class="text-[13px] leading-5">{{ issue.message }}</li>
              </ul>
            </template>
          </UAlert>

          <div v-if="savable" class="flex flex-wrap items-center justify-end gap-2 border-t border-default pt-4">
            <template v-if="group === 'device'">
              <UButton
                type="button"
                color="neutral"
                variant="soft"
                icon="i-lucide-rotate-ccw"
                label="Restart device"
                :disabled="!isEspConnected"
                @click="restartDevice"
              />
              <UButton
                type="button"
                color="error"
                variant="soft"
                icon="i-lucide-alert-triangle"
                label="Factory reset"
                :disabled="!isEspConnected"
                @click="isFactoryResetOpen = true"
              />
            </template>
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              icon="i-lucide-upload"
              label="Import"
              @click="fileInput?.click()"
            />
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              icon="i-lucide-download"
              label="Export"
              @click="exportConfig"
            />
            <UButton
              type="submit"
              color="primary"
              icon="i-lucide-save"
              label="Save configuration"
              :loading="isSaving"
              :disabled="!isEspConnected"
            />
            <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" aria-label="Import configuration file" @change="importConfig" />
          </div>
        </form>

        <UModal v-model:open="isFactoryResetOpen" title="Factory reset">
          <template #body>
            <p class="text-sm text-muted">
              This erases the device configuration and restores factory defaults. The action cannot be undone.
            </p>
          </template>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" size="sm" label="Cancel" @click="isFactoryResetOpen = false" />
              <UButton color="error" size="sm" icon="i-lucide-alert-triangle" label="Reset device" @click="performFactoryReset" />
            </div>
          </template>
        </UModal>
      </div>
    </template>
  </UDashboardPanel>
</template>