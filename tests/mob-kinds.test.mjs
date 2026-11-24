import { test } from 'node:test'
import assert from 'node:assert/strict'
import { actsPerCrawler, markerCategory, minimapMarker, mobActionsPerRound, mobBaseStat, mobLevel, rebasedStats, starRadius, STAR_MIN_RADIUS, statBudget } from '../src/rules/mob-kinds.ts'
import { mobDerived } from '../src/rules/core.ts'
import { actorCategory } from '../src/rules/bestiary.ts'

const tier = { healthSlots: 10, statsPerLevel: 3 }

test('mobs start every stat at 1, bosses and deities at 5', () => {
  assert.equal(mobBaseStat('mob'), 1)
  assert.equal(mobBaseStat('boss'), 5)
  assert.equal(mobBaseStat('feralGod'), 5)
  assert.equal(mobBaseStat('god'), 5)
  assert.equal(mobDerived({ kind: 'mob', level: 4, floor: 1, bossTier: tier, conMod: 0, dexMod: 0, intMod: 0 }).baseStat, 1)
  assert.equal(mobDerived({ kind: 'boss', level: 4, floor: 1, bossTier: tier, conMod: 0, dexMod: 0, intMod: 0 }).baseStat, 5)
})

test('only points above the base count against the level budget', () => {
  // A level 2 mob: 6 points over five stats starting at 1.
  assert.deepEqual(statBudget('mob', 6, [1, 1, 1, 1, 1]), { base: 1, total: 6, assigned: 0, remaining: 6, over: false })
  assert.deepEqual(statBudget('mob', 6, [4, 2, 1, 2, 2]), { base: 1, total: 6, assigned: 6, remaining: 0, over: false })
  assert.equal(statBudget('mob', 6, [5, 4, 1, 1, 1]).over, true)
  // A boss's stats start at 5; a stat under the base spends nothing.
  assert.deepEqual(statBudget('boss', 9, [8, 5, 5, 3, 11]), { base: 5, total: 9, assigned: 9, remaining: 0, over: false })
  assert.equal(statBudget('mob', 3, [null, null, 2, 2, 2]).assigned, 3)
})

test('deities are boss-like with fixed levels', () => {
  assert.equal(mobLevel('feralGod', 3), 150)
  assert.equal(mobLevel('god', 3), 250)
  assert.equal(mobLevel('mob', 7.8), 7)
  const god = mobDerived({ kind: 'god', level: 250, floor: 2, bossTier: tier, conMod: 0, dexMod: 0, intMod: 0 })
  assert.equal(god.statPoints, 750)
  assert.equal(god.healthSlots, 12)
  assert.equal(actorCategory({ type: 'mob', system: { kind: 'feralGod' } }), 'Boss')
})

test('stats still at the old base move to the new kind’s base', () => {
  assert.deepEqual(rebasedStats('mob', 'boss', { str: 1, dex: 1, con: null, int: 1, cha: 1 }), { str: 5, dex: 5, con: 5, int: 5, cha: 5 })
  assert.deepEqual(rebasedStats('boss', 'mob', { str: 5, dex: 5, con: 5, int: 5, cha: 5 }), { str: 1, dex: 1, con: 1, int: 1, cha: 1 })
  assert.equal(rebasedStats('mob', 'boss', { str: 4, dex: 1, con: 1, int: 1, cha: 1 }), null)
  assert.equal(rebasedStats('boss', 'god', { str: 5, dex: 5, con: 5, int: 5, cha: 5 }), null)
})

test('bosses, deities and Elites act once per crawler', () => {
  assert.equal(actsPerCrawler({ kind: 'mob' }), false)
  assert.equal(actsPerCrawler({ kind: 'mob', elite: true }), true)
  assert.equal(mobActionsPerRound({ kind: 'mob' }, 4), null)
  assert.equal(mobActionsPerRound({ kind: 'mob', elite: true }, 4), 4)
  assert.equal(mobActionsPerRound({ kind: 'boss' }, 0), 1)
  assert.equal(mobActionsPerRound({ kind: 'god' }, 3), 3)
})

test('minimap markers follow the actor type', () => {
  assert.equal(markerCategory({ actorType: 'crawler', own: true }), 'self')
  assert.equal(markerCategory({ actorType: 'crawler', disposition: -1 }), 'crawler')
  assert.equal(markerCategory({ actorType: 'mob', system: { crawler: true } }), 'crawler')
  assert.equal(markerCategory({ actorType: 'mob', disposition: -1 }), 'hostile')
  assert.equal(markerCategory({ actorType: 'mob', disposition: 0 }), 'neutral')
  assert.equal(markerCategory({ actorType: 'mob', system: { outsider: true }, disposition: -1 }), 'outsider')
  assert.equal(markerCategory({ actorType: 'npc', disposition: 0 }), 'neutral')
  assert.equal(markerCategory({ actorType: 'npc', disposition: -1 }), 'hostile')
  assert.equal(markerCategory({ actorType: 'companion', disposition: 1 }), 'pet')
  assert.equal(markerCategory({ actorType: 'minion' }), 'minion')
  assert.equal(markerCategory({ actorType: 'mob', system: { minion: { temporary: true } } }), 'minion')
  assert.equal(minimapMarker({ actorType: 'minion' }).shape, 'minion')
})

test('Elites hide until revealed; gods spin; the dead are black Xs', () => {
  const elite = { actorType: 'mob', system: { kind: 'mob', elite: true }, disposition: -1 }
  assert.equal(minimapMarker(elite).shape, 'dot')
  assert.equal(minimapMarker({ ...elite, eliteRevealed: true }).shape, 'cross')
  assert.equal(minimapMarker({ actorType: 'mob', system: { kind: 'god' } }).shape, 'god')
  assert.equal(minimapMarker({ actorType: 'mob', system: { kind: 'feralGod', elite: true }, eliteRevealed: true }).shape, 'god')
  assert.equal(minimapMarker({ actorType: 'npc', system: { important: true } }).shape, 'star')
  assert.equal(minimapMarker({ actorType: 'mob', system: { kind: 'god' }, dead: true }).shape, 'corpse')
})

test('minimap stars stay at least 7 px across when zoomed out, and grow with big tokens', () => {
  assert.equal(starRadius(0.5), STAR_MIN_RADIUS)
  assert.equal(starRadius(2.5), 7)
  assert.equal(starRadius(10), 14)
})
