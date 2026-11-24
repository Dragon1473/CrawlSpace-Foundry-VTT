import { test } from 'node:test'
import assert from 'node:assert/strict'
import { badgeLayout, badgeSize } from '../src/rules/token-badges.ts'

const close = (a, b) => Math.abs(a - b) < 1e-6

test('badges scale with the token, with a floor for small tokens', () => {
  assert.equal(badgeSize(100, 100), 22)
  assert.equal(badgeSize(200, 100), 22)
  assert.equal(badgeSize(400, 400), 88)
  assert.equal(badgeSize(40, 40), 14)
})

test('the first badge sits at the upper left, just outside the rim, and the rest go clockwise over the top', () => {
  const size = 22
  const [first, second, third] = badgeLayout(3, 100, 100, size)
  assert.ok(first.x < 50 && first.y < 50, 'upper left')
  // Each center is the rim radius plus a little outset from the token's center.
  for (const spot of [first, second, third]) assert.ok(close(Math.hypot(spot.x - 50, spot.y - 50), 50 + size * 0.2))
  // Clockwise toward the top: each one higher than the last.
  assert.ok(second.y < first.y && third.y < second.y)
  // Neighbours don't overlap.
  assert.ok(Math.hypot(second.x - first.x, second.y - first.y) >= size)
})

test('a full ring spills into a second ring further out', () => {
  const size = 22
  const spots = badgeLayout(40, 100, 100, size)
  assert.equal(spots.length, 40)
  const radii = spots.map((spot) => Math.round(Math.hypot(spot.x - 50, spot.y - 50)))
  assert.ok(radii.some((radius) => radius > 50 + size), 'some badges are on an outer ring')
  assert.deepEqual(badgeLayout(0, 100, 100, size), [])
})

test('a long token puts its badges on the ellipse inside it', () => {
  const [first] = badgeLayout(1, 200, 100, 22)
  const angle = (200 * Math.PI) / 180
  assert.ok(close(first.x, 100 + Math.cos(angle) * (100 + 22 * 0.2)))
  assert.ok(close(first.y, 50 + Math.sin(angle) * (50 + 22 * 0.2)))
})
