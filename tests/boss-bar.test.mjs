import { test } from 'node:test'
import assert from 'node:assert/strict'
import { barPercent, bossBarBox, bossCombatants, bossNameShown, healthColor } from '../src/rules/boss-bar.ts'

test('the bar fills by health left, rounded down, and never leaves 0–100', () => {
  assert.equal(barPercent(7, 9), 77)
  assert.equal(barPercent(9, 9), 100)
  assert.equal(barPercent(0, 9), 0)
  assert.equal(barPercent(12, 9), 100)
  assert.equal(barPercent(3, 0), 0)
})

test('the bar is green when full and red when empty, like the crawler frames', () => {
  assert.equal(healthColor(100), 'hsl(120 68% 42%)')
  assert.equal(healthColor(50), 'hsl(60 68% 42%)')
  assert.equal(healthColor(0), 'hsl(0 68% 42%)')
})

const combatant = (id, kind, extra = {}) => ({ id, tokenId: id, kind, hidden: false, ...extra })

test('only bosses in the combat get a bar; hidden ones only for the GM; each token once', () => {
  const list = [combatant('a', 'boss'), combatant('b', 'mob'), combatant('c', 'boss', { hidden: true }), combatant('a', 'boss'), combatant('d', undefined)]
  assert.deepEqual(bossCombatants(list, false).map((entry) => entry.id), ['a'])
  assert.deepEqual(bossCombatants(list, true).map((entry) => entry.id), ['a', 'c'])
})

test('players see a boss name only when its token shows names to everyone', () => {
  assert.equal(bossNameShown(true, 0), true)
  assert.equal(bossNameShown(false, 0), false)
  assert.equal(bossNameShown(false, 20), false)
  assert.equal(bossNameShown(false, 30), true)
  assert.equal(bossNameShown(false, 50), true)
})

test('the bar starts across 60% of the top, centred, and stays on screen at a sensible size', () => {
  assert.deepEqual(bossBarBox(null, { width: 1000, height: 800 }), { left: 200, top: 12, width: 600, height: 18 })
  assert.deepEqual(bossBarBox({ left: -50, top: 900, width: 5000, height: 2 }, { width: 1000, height: 800 }), { left: 0, top: 770, width: 1000, height: 8 })
  assert.deepEqual(bossBarBox({ left: 950, top: 10, width: 50.7, height: 99 }, { width: 1000, height: 800 }), { left: 840, top: 10, width: 160, height: 60 })
  // With nothing saved it starts under the floor timers when they are showing; a saved spot stays put.
  assert.equal(bossBarBox(null, { width: 1000, height: 800 }, 80.6).top, 80)
  assert.equal(bossBarBox({ top: 5 }, { width: 1000, height: 800 }, 80).top, 5)
})

test('starting a combat with a visible boss starts the boss battle; other combat changes do not', async () => {
  const { autoBossBattle } = await import('../src/rules/boss-bar.ts')
  const boss = { kind: 'boss', hidden: false }
  const mob = { kind: 'mob', hidden: false }
  assert.equal(autoBossBattle({ round: 1, turn: 0 }, [mob, boss]), true)
  assert.equal(autoBossBattle({ round: 1, turn: 0 }, [mob]), false)
  assert.equal(autoBossBattle({ round: 1, turn: 0 }, [{ kind: 'boss', hidden: true }]), false)
  assert.equal(autoBossBattle({ round: 2, turn: 0 }, [boss]), false)
  assert.equal(autoBossBattle({ turn: 1 }, [boss]), false)
  // Going back from round 2 to round 1 is not a new encounter.
  assert.equal(autoBossBattle({ round: 1, turn: 0 }, [boss], 2), false)
  assert.equal(autoBossBattle({ round: 1, turn: 0 }, [boss], 0), true)
})
