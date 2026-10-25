import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizePaymentOptions, resolvePaymentOptions, usesPaymentOptionFallback } from './membershipPaymentOptions.ts'

test('drops options that cannot be charged', () => {
  const options = normalizePaymentOptions([
    { id: 'current', label: '2026', coversYears: [2026] },
    { id: '', label: 'missing', coversYears: [2026] },
    { id: 'bad', coversYears: [] },
    { id: 'next', label: ' 2027 ', coversYears: [2027, 2027] },
  ])
  assert.deepEqual(options, [
    { id: 'current', label: '2026', coversYears: [2026] },
    { id: 'next', label: '2027', coversYears: [2027] },
  ])
})

test('empty settings fall back to the current year', () => {
  const now = new Date('2026-10-25T08:00:00.000Z')
  assert.equal(usesPaymentOptionFallback([]), true)
  assert.equal(usesPaymentOptionFallback(undefined), true)
  assert.deepEqual(resolvePaymentOptions([], now), [
    { id: 'current', label: '2026', coversYears: [2026] },
  ])
})

test('saved options are kept as entered', () => {
  const saved = [{ id: 'current-next', label: '2026/2027', coversYears: [2027, 2026] }]
  assert.equal(usesPaymentOptionFallback(saved), false)
  assert.deepEqual(resolvePaymentOptions(saved), [
    { id: 'current-next', label: '2026/2027', coversYears: [2026, 2027] },
  ])
})
