<script setup lang="ts">
import type { ConfigSection } from '~/components/device/ConfigPage.vue'
import { ID_TYPES, UA_TYPES, validateConfig as validateDeviceConfig, detectChip } from '~/config/device'
import type { DeviceConfig, Issue } from '~/config/device'
import { useDeviceProfile } from '~/composables/useDeviceProfile'

const { target } = useDeviceProfile()

const coords = ['operator_lat', 'operator_lon', 'operator_alt'] as const

const idTypeOptions = ID_TYPES.map(t => ({ label: t.label, value: String(t.value) }))
const uaTypeOptions = UA_TYPES.map(t => ({ label: t.label, value: String(t.value) }))
const idType2Options = [{ label: 'None', value: '0' }, ...idTypeOptions]
const uaType2Options = UA_TYPES.slice(0, 1).map(t => ({ label: t.label, value: String(t.value) }))

const sections = computed<ConfigSection[]>(() => [{
  title: 'Aircraft identity',
  description: 'The main Basic ID block broadcast by every transmission.',
  fields: [
    { name: 'uas_id', label: 'UAS ID', type: 'text', value: '', placeholder: 'e.g. 3D3A1234567890ABCD', maxlength: 20, description: 'Serial Number (ANSI/CTA-2063), CAA registration or UUID depending on ID type.' },
    { name: 'id_type', label: 'ID type', type: 'select', value: '1', options: idTypeOptions },
    { name: 'ua_type', label: 'UA type', type: 'select', value: '1', options: uaTypeOptions, description: 'Receivers reject a UA type of None.' }
  ]
}, {
  title: 'Operator identity',
  description: 'Used by regions that require an operator registration number.',
  fields: [
    { name: 'operator_id', label: 'Operator ID', type: 'text', value: '', maxlength: 20, placeholder: 'Typically the national registration number' },
    { name: 'self_id_text', label: 'Self-ID text', type: 'text', value: '', maxlength: 23, description: 'Free text up to 23 ASCII characters.' },
    { name: 'operator_lat', label: 'Operator latitude', type: 'number', value: 0, stepper: true, step: 0.0001, description: 'Leave 0/0 to broadcast the drone position instead.' },
    { name: 'operator_lon', label: 'Operator longitude', type: 'number', value: 0, stepper: true, step: 0.0001 },
    { name: 'operator_alt', label: 'Operator altitude (m)', type: 'number', value: 0, stepper: true, step: 1 }
  ]
}, {
  title: 'Second Basic ID',
  description: 'Optional second identity block, for example a session ID while carrying a different equipment.',
  fields: [
    { name: 'uas_id_2', label: 'UAS ID 2', type: 'text', value: '', maxlength: 20 },
    { name: 'id_type_2', label: 'ID type 2', type: 'select', value: '0', options: idType2Options },
    { name: 'ua_type_2', label: 'UA type 2', type: 'select', value: '0', options: uaType2Options }
  ]
}])

const mapPayload = (state: Record<string, unknown>): Record<string, unknown> => ({
  uas_id: String(state.uas_id ?? ''),
  uas_id_2: String(state.uas_id_2 ?? ''),
  operator_id: String(state.operator_id ?? ''),
  self_id_text: String(state.self_id_text ?? ''),
  operator_lat: Number(state.operator_lat ?? 0),
  operator_lon: Number(state.operator_lon ?? 0),
  operator_alt: Number(state.operator_alt ?? 0),
  id_type: Number(state.id_type ?? 1),
  id_type_2: Number(state.id_type_2 ?? 0),
  ua_type: Number(state.ua_type ?? 1),
  ua_type_2: Number(state.ua_type_2 ?? 0)
})

const applyLoaded = (cfg: Record<string, unknown>, set: (key: string, value: unknown) => void) => {
  set('uas_id', String(cfg.uas_id ?? ''))
  set('uas_id_2', String(cfg.uas_id_2 ?? ''))
  set('operator_id', String(cfg.operator_id ?? ''))
  set('self_id_text', String(cfg.self_id_text ?? ''))
  for (const key of coords) set(key, Number(cfg[key] ?? 0))
  set('id_type', String(Number(cfg.id_type ?? 1)))
  set('id_type_2', String(Number(cfg.id_type_2 ?? 0)))
  set('ua_type', String(Number(cfg.ua_type ?? 1)))
  set('ua_type_2', String(Number(cfg.ua_type_2 ?? 0)))
}

const validate = (cfg: DeviceConfig): Issue[] => validateDeviceConfig(cfg, { chip: detectChip(target.value) })
</script>

<template>
  <DeviceConfigPage
    group="tx"
    description="Enter the UAS ID, operator details and the optional second Basic ID broadcast by the drone."
    :sections="sections"
    :load="true"
    :validate-config="validate"
    :map-payload="mapPayload"
    :apply-loaded="applyLoaded"
  />
</template>
