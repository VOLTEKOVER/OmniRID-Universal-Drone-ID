import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const deepmerge = require('deepmerge')

test('deepmerge treats __proto__ as an own data property', () => {
  const target = JSON.parse('{"__proto__":{"target":"value"}}')
  const source = JSON.parse('{"__proto__":{"polluted":"yes"}}')

  const merged = deepmerge(target, source)

  assert.equal(Object.getPrototypeOf(merged), Object.prototype)
  assert.equal(Object.hasOwn(merged, '__proto__'), true)
  assert.deepEqual(merged.__proto__, {
    target: 'value',
    polluted: 'yes'
  })
  assert.equal(Object.prototype.polluted, undefined)
})
