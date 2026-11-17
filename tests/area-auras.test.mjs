import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withAreaAura } from '../src/rules/area-auras.ts'

const fog = { areas: [{ type: 'rectangle', distance: 25, width: 25, angle: 60 }], duration: '1 minute' }

test('a Confusing Fog area is an aura that gives the allies inside its condition, the caster too', () => {
  const area = withAreaAura('Confusing Fog', fog)
  assert.deepEqual(area.areas[0].aura, { kind: 'aura', targets: 'allies', includeSource: true, effects: [] })
  assert.equal(area.areas[0].distance, 25)
  assert.equal(area.duration, '1 minute')
  assert.equal(fog.areas[0].aura, undefined)
})

test('other areas, areas with their own aura, and no area at all stay as they are', () => {
  assert.equal(withAreaAura('Fireball', fog), fog)
  const own = { areas: [{ ...fog.areas[0], aura: { kind: 'dread', targets: 'enemies', includeSource: false } }] }
  assert.equal(withAreaAura('Confusing Fog', own), own)
  assert.equal(withAreaAura('Confusing Fog', null), null)
})
