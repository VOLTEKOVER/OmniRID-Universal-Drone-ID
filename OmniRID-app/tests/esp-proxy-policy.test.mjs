import assert from 'node:assert/strict'
import test from 'node:test'
import {
  boundedBodyStream,
  espTimeoutMs,
  hasAllowedDeviceApiPath,
  isAllowedDeviceApiRequest,
  MAX_ESP_TIMEOUT_MS,
  MAX_OTA_REQUEST_BYTES,
  RequestTooLargeError
} from '../server/utils/espProxyPolicy.ts'

const streamOf = (...chunks) => new ReadableStream({
  start(controller) {
    for (const chunk of chunks) controller.enqueue(new Uint8Array(chunk))
    controller.close()
  }
})

test('proxy allows only exact device API paths and methods', () => {
  assert.equal(isAllowedDeviceApiRequest('/ota', 'POST'), true)
  assert.equal(isAllowedDeviceApiRequest('/api/config', 'GET'), true)
  assert.equal(isAllowedDeviceApiRequest('/api/memory', 'GET'), true)
  assert.equal(isAllowedDeviceApiRequest('/api/memory', 'POST'), false)
  assert.equal(isAllowedDeviceApiRequest('/ota', 'GET'), false)
  assert.equal(isAllowedDeviceApiRequest('/api/config/extra', 'GET'), false)
  assert.equal(isAllowedDeviceApiRequest('/api/reset', 'GET'), false)
  assert.equal(hasAllowedDeviceApiPath('/api/reset'), true)
  assert.equal(hasAllowedDeviceApiPath('/api/unknown'), false)
})

test('proxy timeout is bounded but preserves the OTA upload window', () => {
  assert.equal(espTimeoutMs('900000'), MAX_ESP_TIMEOUT_MS)
  assert.equal(espTimeoutMs('9999999'), MAX_ESP_TIMEOUT_MS)
  assert.equal(espTimeoutMs('invalid'), 4000)
})

test('proxy body stream accepts uploads within the configured byte limit', async () => {
  const body = boundedBodyStream(
    streamOf([1, 2], [3, 4]),
    4,
    () => assert.fail('unexpected limit')
  )
  const reader = body.getReader()
  assert.deepEqual((await reader.read()).value, new Uint8Array([1, 2]))
  assert.deepEqual((await reader.read()).value, new Uint8Array([3, 4]))
  assert.equal((await reader.read()).done, true)
})

test('proxy body stream rejects a request that crosses its byte limit', async () => {
  let exceeded = false
  const body = boundedBodyStream(
    streamOf([1, 2], [3, 4]),
    3,
    () => {
      exceeded = true
    }
  )
  const reader = body.getReader()
  assert.deepEqual((await reader.read()).value, new Uint8Array([1, 2]))
  await assert.rejects(() => reader.read(), RequestTooLargeError)
  assert.equal(exceeded, true)
  assert.ok(MAX_OTA_REQUEST_BYTES > 1024 * 1024)
})
