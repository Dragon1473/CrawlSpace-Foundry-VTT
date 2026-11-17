import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canEvadeAgain, mobDifficulty, netMode } from '../src/rules/mob-advantage.ts'

test('a Mob with Advantage adds 5 to the Difficulty of its Action or Evade; Disadvantage takes 5 off', () => {
  assert.equal(mobDifficulty(15, 'advantage'), 20)
  assert.equal(mobDifficulty(15, 'disadvantage'), 10)
  assert.equal(mobDifficulty(15, 'normal'), 15)
  // An attack that always hits stays that way.
  assert.equal(mobDifficulty(null, 'advantage'), null)
})

test('Advantage and Disadvantage cancel one for one, and two of the same still count once', () => {
  assert.equal(netMode([]), 'normal')
  assert.equal(netMode(['advantage']), 'advantage')
  assert.equal(netMode(['advantage', 'advantage']), 'advantage')
  assert.equal(netMode(['advantage', 'disadvantage']), 'normal')
  assert.equal(netMode(['advantage', 'advantage', 'disadvantage']), 'advantage')
  assert.equal(netMode(['disadvantage', 'disadvantage', 'advantage']), 'disadvantage')
  assert.equal(netMode(['normal', 'disadvantage']), 'disadvantage')
})

test('against a Disadvantaged attack, a failed free Evade can be rolled again once', () => {
  const failed = { kind: 'evade', hit: true }
  assert.equal(canEvadeAgain('disadvantage', failed), true)
  assert.equal(canEvadeAgain('disadvantage', { ...failed, again: true }), false)
  assert.equal(canEvadeAgain('disadvantage', { kind: 'evade', hit: false }), false)
  assert.equal(canEvadeAgain('disadvantage', { kind: 'tank', hit: true }), false)
  assert.equal(canEvadeAgain('normal', failed), false)
  assert.equal(canEvadeAgain('advantage', failed), false)
  assert.equal(canEvadeAgain('disadvantage', undefined), false)
})

test("a target's conditions on attacks against it count with the mob's own, one for one", async () => {
  const { targetDifficulty } = await import('../src/rules/mob-advantage.ts')
  // Confusing Fog: attacks against someone in the fog have Disadvantage, so the Difficulty drops by 5.
  assert.deepEqual(targetDifficulty(11, [], ['disadvantage']), { mode: 'disadvantage', toHit: 6 })
  // Held: Advantage against them.
  assert.deepEqual(targetDifficulty(11, [], ['advantage']), { mode: 'advantage', toHit: 16 })
  // A Staggered mob attacking someone Held: they cancel.
  assert.deepEqual(targetDifficulty(11, ['disadvantage'], ['advantage']), { mode: 'normal', toHit: 11 })
  assert.deepEqual(targetDifficulty(null, [], ['disadvantage']), { mode: 'disadvantage', toHit: null })
})
