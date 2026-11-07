import assert from 'node:assert/strict'
import test from 'node:test'

import { CHIPS, DEFAULTS, TX_MODES, validateConfig } from '../app/config/device.ts'

test('ESP32-C6 does not advertise BLE modes unavailable in firmware', () => {
  assert.equal(CHIPS.esp32c6.features.ble4, 'no')
  assert.equal(CHIPS.esp32c6.features.ble5LongRange, 'no')

  const issues = validateConfig(
    { ...DEFAULTS, tx_modes: TX_MODES.ble4 },
    { chip: 'esp32c6' }
  )
  assert.ok(issues.some(issue =>
    issue.field === 'tx_modes'
    && issue.severity === 'error'
    && issue.message.includes('not implemented on this firmware build')
  ))
})

test('BLE mode validation matches the firmware matrix for all three chips', () => {
  const cases = [
    { chip: 'esp32', mode: TX_MODES.ble4, expected: 'ok' },
    { chip: 'esp32', mode: TX_MODES.ble5, expected: 'error' },
    { chip: 'esp32s3', mode: TX_MODES.ble4, expected: 'ok' },
    { chip: 'esp32s3', mode: TX_MODES.ble5, expected: 'warning' },
    { chip: 'esp32c6', mode: TX_MODES.ble4, expected: 'error' },
    { chip: 'esp32c6', mode: TX_MODES.ble5, expected: 'error' }
  ]

  for (const { chip, mode, expected } of cases) {
    const feature = mode === TX_MODES.ble4 ? 'ble4' : 'ble5LongRange'
    assert.equal(CHIPS[chip].features[feature], { ok: 'ok', warning: 'test', error: 'no' }[expected])
    const issues = validateConfig(
      { ...DEFAULTS, tx_modes: mode },
      { chip }
    ).filter(issue => issue.field === 'tx_modes')
    if (expected === 'ok') assert.ok(!issues.some(issue => issue.severity === 'error'))
    else assert.ok(issues.some(issue => issue.severity === expected))
  }
})
