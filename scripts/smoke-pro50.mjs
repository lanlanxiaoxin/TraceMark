import { test } from 'node:test'
import assert from 'node:assert/strict'

/** Mirrors electron/sanitizer.ts resolveProjectDisplayName */
function resolveProjectDisplayName(name, privacyAlias) {
  const alias = privacyAlias?.trim()
  return alias || name
}

/** Mirrors electron/date-bounds.ts weekBoundsFromStart */
function weekBoundsFromStart(weekStartMs) {
  const start = new Date(weekStartMs)
  start.setHours(0, 0, 0, 0)
  const end = new Date(weekStartMs)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start: start.getTime(), end: end.getTime() }
}

test('resolveProjectDisplayName prefers privacy alias', () => {
  assert.equal(resolveProjectDisplayName('Secret', 'Project_A'), 'Project_A')
  assert.equal(resolveProjectDisplayName('Secret', ''), 'Secret')
})

test('week bounds spans 7 days', () => {
  const start = new Date('2026-05-18T00:00:00')
  const { start: s, end: e } = weekBoundsFromStart(start.getTime())
  assert.equal(Math.round((e - s) / 86400000), 7)
})
