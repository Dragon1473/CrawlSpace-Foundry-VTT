import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lossScope, modLostFor, mobEvadeAfterLoss, mobToHitAfterLoss } from '../src/rules/mod-loss.ts'

test('a lost modifier is lost everywhere, or only for the kinds it names (Woozy: attacks and Evade)', () => {
  assert.equal(lossScope(true), 'all')
  assert.equal(lossScope('true'), 'all')
  assert.equal(lossScope(''), 'all')
  assert.deepEqual(lossScope('attack,evade'), ['attack', 'evade'])
  assert.deepEqual(lossScope(' Evade , attack '), ['evade', 'attack'])
})

test('which kinds a stat has lost its modifier for', () => {
  assert.equal(modLostFor({ modLost: true, modLostFor: [] }, 'check'), true)
  assert.equal(modLostFor({ modLost: false, modLostFor: ['attack', 'evade'] }, 'evade'), true)
  assert.equal(modLostFor({ modLost: false, modLostFor: ['attack', 'evade'] }, 'check'), false)
  assert.equal(modLostFor(undefined, 'attack'), false)
})

test("a mob's Evade without its DEX: a published Evade drops by the modifier; a worked-out one already left it out when lost everywhere", () => {
  // Published Evade 18 with DEX +3: Woozy takes it to 15.
  assert.equal(mobEvadeAfterLoss({ evade: 18, published: true, fullMod: 3, lostAll: false, lostEvade: true }), 15)
  // 10 + DEX + Floor worked out with DEX already 0 (lost everywhere): nothing more to take.
  assert.equal(mobEvadeAfterLoss({ evade: 13, published: false, fullMod: 3, lostAll: true, lostEvade: true }), 13)
  // Worked out with DEX still in (lost only for Evade): take it out.
  assert.equal(mobEvadeAfterLoss({ evade: 16, published: false, fullMod: 3, lostAll: false, lostEvade: true }), 13)
  assert.equal(mobEvadeAfterLoss({ evade: 16, published: true, fullMod: 3, lostAll: false, lostEvade: false }), 16)
})

test("a mob's DEX attack without its DEX: the same, for its to-hit", () => {
  assert.equal(mobToHitAfterLoss({ toHit: 17, published: true, fullMod: 4, lostAll: false, lostAttack: true }), 13)
  assert.equal(mobToHitAfterLoss({ toHit: 17, published: false, fullMod: 4, lostAll: false, lostAttack: true }), 13)
  assert.equal(mobToHitAfterLoss({ toHit: 13, published: false, fullMod: 4, lostAll: true, lostAttack: true }), 13)
  assert.equal(mobToHitAfterLoss({ toHit: null, published: true, fullMod: 4, lostAll: true, lostAttack: true }), null)
})
