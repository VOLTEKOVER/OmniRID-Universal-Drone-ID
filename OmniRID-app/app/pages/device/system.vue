<script setup lang="ts">
import type { ConfigSection, ConfigDanger } from '~/components/device/ConfigPage.vue'
import { LOCK_LEVELS, OPTIONS, DEFAULTS, hasFlag, setFlag, validateConfig as validateDeviceConfig, detectChip } from '~/config/device'
import type { DeviceConfig, Issue } from '~/config/device'
import { useDeviceProfile } from '~/composables/useDeviceProfile'

const { target } = useDeviceProfile()

const lockOptions = LOCK_LEVELS.map(l => ({ label: l.label, value: String(l.value) }))
const keyOptions = [1, 2, 3, 4, 5].map(i => ({ name: `public_key_${i}`, label: `Key ${i}`, type: 'textarea' as const, value: '', placeholder: 'PEM public key or raw base64' }))

const OPTION_TOGGLES = [
  { name: 'opt_force_arm', flag: OPTIONS.forceArm, label: 'Force ARM OK', description: 'Allow arming without safety checks. Test option, never for real flights.' },
  { name: 'opt_no_save_basic_id', flag: OPTIONS.noSaveBasicId, label: "Don't save BasicID to NVS", description: 'Keep the Basic ID in RAM only; identity must be re-applied on every boot.' },
  { name: 'opt_print_mavlink_rid', flag: OPTIONS.printMavlinkRid, label: 'Print MAVLink RID messages', description: 'Log the outgoing MAVLink Remote ID messages to the console.' },
  { name: 'opt_demo_mode', flag: OPTIONS.demoMode, label: 'Demo mode (simulated GPS patrol)', description: 'Transmit a simulated GPS position for bench testing.' },
  { name: 'opt_kalman', flag: OPTIONS.kalman, label: 'Kalman filter (GPS smoothing)', description: 'Fuse GPS and barometer for a smoother position estimate.' },
  { name: 'opt_ed25519_auth', flag: OPTIONS.ed25519Auth, label: 'Ed25519 auth on transmitted IDs', description: 'Authenticate the transmitted identity with an ed25519 signature.' },
  { name: 'opt_mavlink_arm_gate', flag: OPTIONS.mavlinkArmGate, label: 'MAVLink arm status gate', description: 'Block Remote ID transmission while the flight controller disarms.' },
  { name: 'opt_mavlink_op_loc', flag: OPTIONS.mavlinkOpLoc, label: 'MAVLink operator location loop', description: 'Inject the operator location from MAVLink into the Remote ID stream.' },
  { name: 'opt_identity_gate', flag: OPTIONS.identityGate, label: 'Identity ready gate', description: 'Refuse to transmit while the identity fields are incomplete.' }
] as const

const sections = computed<ConfigSection[]>(() => [{
  title: 'Security & Options',
  description: 'Lock level, startup behaviour flags and the public keys authorised to sign commands.',
  fields: [
    {
      name: 'lock_level', label: 'Lock Level', type: 'select', value: '0', options: lockOptions,
      description: '0 — Normal: no restrictions. 1 — Locked: only commands signed with a registered public key are accepted; the web UI stays accessible but factory reset via CLI requires authentication. 2 — eFuse permanent: burns one-time programmable fuses to enforce the lock; this cannot be undone and may brick the device if keys are lost! Set at least one public key before enabling lock levels 1 or 2.'
    },
    ...OPTION_TOGGLES.map(t => ({ name: t.name, label: t.label, type: 'toggle' as const, value: false, description: t.description })),
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
      link: { label: 'Security guide', to: '/docs/guide#security' }
    })
  if (lock === 2)
    out.push({
      title: 'Lock level 2 is permanent',
      description: 'Burns the one-time programmable eFuses to enforce the lock. This cannot be undone and may brick the device if keys are lost.',
      link: { label: 'Security guide', to: '/docs/guide#security' }
    })
  if (state.opt_force_arm === true)
    out.push({ title: 'Force ARM OK is active', description: 'Test option, not for real flights.' })
  return out
}

const mapPayload = (state: Record<string, unknown>): Record<string, unknown> => {
  let options = 0
  for (const t of OPTION_TOGGLES) options = setFlag(options, t.flag, !!state[t.name])
  const out: Record<string, unknown> = { lock_level: Number(state.lock_level ?? 0), options }
  for (let i = 1; i <= 5; i++) out[`public_key_${i}`] = String(state[`public_key_${i}`] ?? '')
  return out
}

const applyLoaded = (cfg: Record<string, unknown>, set: (key: string, value: unknown) => void) => {
  set('lock_level', String(Number(cfg.lock_level ?? 0)))
  const options = Number(cfg.options ?? 0)
  for (const t of OPTION_TOGGLES) set(t.name, hasFlag(options, t.flag))
  for (let i = 1; i <= 5; i++) set(`public_key_${i}`, String(cfg[`public_key_${i}`] ?? ''))
}

const validate = (cfg: DeviceConfig): Issue[] => validateDeviceConfig(cfg, { chip: detectChip(target.value) })
</script>

<template>
  <DeviceConfigPage
    group="device"
    description="Lock the device, set startup options and authorise command signing through public keys."
    :sections="sections"
    :load="true"
    :validate-config="validate"
    :map-payload="mapPayload"
    :apply-loaded="applyLoaded"
    :danger="danger"
  />
</template>