import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recoveryRow } from '../src/rules/upkeep-summary.ts'

test("one crawler's line: what the rest gave and what regeneration buffs added while the time passed", () => {
  // Health is in points: a slot is 10. You are full! healed 2 slots during the hour, the hourly recovery 1 more.
  const row = recoveryRow({ health: 50, mana: 3 }, { health: 70, mana: 3 }, { health: 80, mana: 5 }, { sources: ['You are full!'] })
  assert.deepEqual(row, { slots: 1, mana: 2, bonusSlots: 2, bonusMana: 0, bonusFrom: ['You are full!'] })
})

test('nothing gained is zero, never negative, and with no regeneration there is no bonus', () => {
  assert.deepEqual(recoveryRow({ health: 110, mana: 4 }, { health: 110, mana: 4 }, { health: 110, mana: 4 }), { slots: 0, mana: 0, bonusSlots: 0, bonusMana: 0, bonusFrom: [] })
  assert.equal(recoveryRow({ health: 50, mana: 0 }, { health: 40, mana: 0 }, { health: 40, mana: 0 }).bonusSlots, 0)
})

test('mana from a regeneration buff (Replenish) counts as its bonus', () => {
  const row = recoveryRow({ health: 110, mana: 0 }, { health: 110, mana: 6 }, { health: 110, mana: 8 }, { sources: ['Replenish Buff', 'Replenish Buff'] })
  assert.deepEqual(row, { slots: 0, mana: 2, bonusSlots: 0, bonusMana: 6, bonusFrom: ['Replenish Buff'] })
})
