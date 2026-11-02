<script setup lang="ts">
import type { ConfigSection, ConfigDanger } from '~/components/device/ConfigPage.vue'
import { LOCK_LEVELS, validateConfig as validateDeviceConfig, detectChip } from '~/config/device'
import type { DeviceConfig, Issue } from '~/config/device'
import { useDeviceProfile } from '~/composables/useDeviceProfile'
import ContentSection from '~/components/ContentSection.vue'
import { useSecurityConfirm } from '~/composables/useSecurityConfirm'

const { target } = useDeviceProfile()
const { proxyFetch, isEspConnected } = useEspConnection()
const toast = useToast()
const lockLevelState = useState<number>('omnirid-device-lock-level', () => 0)
const { confirm: securityConfirm } = useSecurityConfirm()

const lockOptions = LOCK_LEVELS.map(l => ({ label: l.label, value: String(l.value) }))
const keyOptions = [1, 2, 3, 4, 5].map(i => ({ name: `public_key_${i}`, label: `Key ${i}`, type: 'textarea' as const, value: '', placeholder: 'PEM public key or raw base64' }))

const sections = computed<ConfigSection[]>(() => [{
  title: 'Device security',
  description: 'Lock level and the public keys authorised to sign commands.',
  fields: [
    {
      name: 'lock_level', label: 'Lock Level', type: 'select', value: '0', options: lockOptions,
      description: '0 — Normal: no restrictions. 1 — Locked: only commands signed with a registered public key are accepted; the web UI stays accessible but factory reset via CLI requires authentication. 2 — eFuse permanent: burns one-time programmable fuses to enforce the lock; this cannot be undone and may brick the device if keys are lost! Set at least one public key before enabling lock levels 1 or 2.'
    },
    ...keyOptions
  ]
}])

const hasPublicKey = (state: Record<string, unknown>) =>
  [1, 2, 3, 4, 5].some(i => String(state[`public_key_${i}`] ?? '').trim().length > 0)

const danger = (state: Record<string, unknown>): ConfigDanger[] => {
  const lock = Number(state.lock_level ?? 0)
  const keys = hasPublicKey(state)
  const out: ConfigDanger[] = []
  if (lock >= 1 && !keys)
    out.push({
      title: 'Lock needs a public key',
      description: 'Set at least one public key before enabling lock levels 1 or 2: without keys the device becomes unreachable.',
      link: { label: 'Security guide', to: '/guide#security' }
    })
  if (lock === 2)
    out.push({
      title: 'Lock level 2 is permanent',
      description: 'Burns the one-time programmable eFuses to enforce the lock. This cannot be undone and may brick the device if keys are lost.',
      link: { label: 'Security guide', to: '/guide#security' }
    })
  return out
}

const mapPayload = (state: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = { lock_level: Number(state.lock_level ?? 0) }
  for (let i = 1; i <= 5; i++) out[`public_key_${i}`] = String(state[`public_key_${i}`] ?? '')
  return out
}

const applyLoaded = (cfg: Record<string, unknown>, set: (key: string, value: unknown) => void) => {
  const lock = Number(cfg.lock_level ?? 0)
  set('lock_level', String(lock))
  lockLevelState.value = Number.isFinite(lock) ? lock : 0
  for (let i = 1; i <= 5; i++) set(`public_key_${i}`, String(cfg[`public_key_${i}`] ?? ''))
}

const validate = (cfg: DeviceConfig): Issue[] => validateDeviceConfig(cfg, { chip: detectChip(target.value) })

const appAuthState = reactive({
  passwordSet: false,
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

watch(() => appAuthState.currentPassword, () => {
  // trigger reactivity
})
watch(() => appAuthState.newPassword, () => {
  // trigger reactivity
})
watch(() => appAuthState.confirmPassword, () => {
  // trigger reactivity
})
const appAuthLoading = ref(false)
const appAuthError = ref('')

const loadAppAuthStatus = async () => {
  if (!isEspConnected.value) return
  try {
    const res = await proxyFetch<Record<string, unknown>>('api/app/auth/status', { timeout: 4000 })
    appAuthState.passwordSet = res?.passwordSet === true || res?.required === true || res?.enabled === true
    appAuthError.value = ''
  } catch {
    appAuthState.passwordSet = false
  }
}

onMounted(() => {
  loadAppAuthStatus()
})

watch(() => isEspConnected.value, (v) => {
  if (v) loadAppAuthStatus()
  else {
    appAuthState.passwordSet = false
    appAuthState.currentPassword = ''
    appAuthState.newPassword = ''
    appAuthState.confirmPassword = ''
  }
})

const canSaveAppAuth = computed(() => {
  if (appAuthLoading.value) return false
  if (!isEspConnected.value) return false
  if (!appAuthState.newPassword || String(appAuthState.newPassword).length === 0) return false
  if (appAuthState.newPassword !== appAuthState.confirmPassword) return false
  if (appAuthState.passwordSet && (!appAuthState.currentPassword || String(appAuthState.currentPassword).trim().length === 0)) return false
  return true
})

const saveAppAuth = async () => {
  if (!canSaveAppAuth.value) return
  const ok = await securityConfirm('You are about to change the app connection password.\n\nThis protects access to the ESP configuration from this app. Make sure you remember the new password.\n\nContinue?')
  if (!ok) return
  appAuthLoading.value = true
  appAuthError.value = ''
  try {
    const body: Record<string, unknown> = {
      newPassword: appAuthState.newPassword
    }
    if (appAuthState.passwordSet) {
      body.currentPassword = appAuthState.currentPassword
    }
    const res = await proxyFetch<Record<string, unknown>>('api/app/auth/set', {
      method: 'POST',
      body
    })
    if (res?.ok === false) {
      appAuthError.value = (res?.error as string) || 'Unable to set the password'
      toast.add({ title: 'Error', description: appAuthError.value, color: 'error', icon: 'i-lucide-circle-alert' })
      return
    }
    toast.add({ title: 'Password updated', description: 'The configuration access password has been saved.', color: 'success', icon: 'i-lucide-check' })
    appAuthState.currentPassword = ''
    appAuthState.newPassword = ''
    appAuthState.confirmPassword = ''
    await loadAppAuthStatus()
  } catch (e: unknown) {
    const err = e as { data?: { error?: string }, message?: string }
    appAuthError.value = err?.data?.error || err?.message || 'Error while saving'
    toast.add({ title: 'Error', description: appAuthError.value, color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    appAuthLoading.value = false
  }
}
</script>

<template>
  <DeviceConfigPage
    group="tx"
    description="Protect access to device configuration and authorise signed commands with public keys."
    :sections="sections"
    :load="true"
    :validate-config="validate"
    :map-payload="mapPayload"
    :apply-loaded="applyLoaded"
    :danger="danger"
  >
    <template #extraTop>
      <UAlert
        v-if="lockLevelState >= 1"
        color="warning"
        icon="i-lucide-shield-alert"
        variant="soft"
        title="Device locked"
      >
        <template #description>
          Lock level {{ lockLevelState }} requires signed requests for config/commands. Use the Console (/tx/console) with X-Signature to apply changes.
        </template>
      </UAlert>
    </template>
    <template #before-form>
      <ContentSection
        title="Device lock status"
        description="Current lock level from the device."
        heading="md"
      >
        <div class="flex items-center gap-3">
          <UBadge :color="lockLevelState >= 2 ? 'error' : lockLevelState >= 1 ? 'warning' : 'success'" variant="subtle">
            Lock level {{ lockLevelState }}
          </UBadge>
          <span class="text-sm text-muted">0=Normal, 1=Signed commands only, 2=eFuse permanent</span>
        </div>
      </ContentSection>

      <ContentSection
        title="App Connection Password"
        description="This password is used only to protect access to the ESP configuration from the app/web. It does not block viewing Remote ID data on the Dashboard."
        heading="md"
      >
        <div class="space-y-4">
          <UAlert
            color="warning"
            variant="subtle"
            icon="i-lucide-alert-triangle"
            title="Important"
            :description="appAuthState.passwordSet ? 'To change this password you must know the current password. If you lose it, you will need to format the ESP TX.' : 'If you lose this password, you will need to format the ESP TX.'"
          />

          <div class="grid gap-4 md:grid-cols-2">
            <UFormField
              v-if="appAuthState.passwordSet"
              label="Current password"
              required
            >
              <UInput
                v-model="appAuthState.currentPassword"
                type="password"
                autocomplete="off"
                class="w-full"
              />
            </UFormField>

            <UFormField
              label="New password"
              required
              :class="appAuthState.passwordSet ? '' : 'md:col-span-2'"
            >
              <UInput
                v-model="appAuthState.newPassword"
                type="password"
                autocomplete="off"
                class="w-full"
              />
            </UFormField>

            <UFormField
              label="Confirm new password"
              required
              :class="appAuthState.passwordSet ? '' : 'md:col-span-2'"
            >
              <UInput
                v-model="appAuthState.confirmPassword"
                type="password"
                autocomplete="off"
                class="w-full"
              />
            </UFormField>
          </div>

          <UAlert
            v-if="appAuthState.newPassword && appAuthState.confirmPassword && appAuthState.newPassword !== appAuthState.confirmPassword"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            title="Passwords do not match"
          />

          <UAlert
            v-if="appAuthError"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="appAuthError"
          />

          <div class="flex justify-end">
            <UButton
              color="primary"
              icon="i-lucide-save"
              label="Save app connection password"
              :loading="appAuthLoading"
              :disabled="!canSaveAppAuth"
              @click="saveAppAuth"
            />
          </div>
        </div>
      </ContentSection>
    </template>
  </DeviceConfigPage>
</template>
