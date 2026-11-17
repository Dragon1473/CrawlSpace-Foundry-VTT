import { test } from 'node:test'
import assert from 'node:assert/strict'
import { debuffById, missingStandardChanges } from '../src/rules/debuffs.ts'

const keys = (changes) => changes.map((change) => `${change.type} ${change.key}=${change.value}`).sort()

test('Woozy loses its DEX modifier on attacks and Evade, like a mob losing DEX on its checks', () => {
  assert.deepEqual(keys(debuffById('woozy').changes), ['crawlspace.modLoss dex=attack,evade'])
})

test('attacks against a Held or Taken Down creature have Advantage', () => {
  for (const id of ['held', 'take-down']) assert.deepEqual(keys(debuffById(id).changes), ['crawlspace.rollMode incomingAttackMode:All=advantage'])
})

test('the Disadvantage debuffs carry their roll modes as effects', () => {
  assert.deepEqual(keys(debuffById('shit-faced').changes), [
    'crawlspace.rollMode attackMode:All=disadvantage',
    'crawlspace.rollMode checkMode:All=disadvantage',
    'crawlspace.rollMode evadeMode:All=disadvantage',
  ])
  assert.deepEqual(keys(debuffById('terrified').changes), ['crawlspace.rollMode attackMode:All=disadvantage'])
  assert.deepEqual(keys(debuffById('staggered').changes), ['crawlspace.rollMode attackMode:All=disadvantage'])
  assert.deepEqual(keys(debuffById('queasy').changes), ['crawlspace.rollMode attackMode:All=disadvantage', 'crawlspace.rollMode checkMode:All=disadvantage'])
  assert.deepEqual(keys(debuffById('stunned').changes), ['crawlspace.rollMode attackMode:All=disadvantage', 'crawlspace.rollMode checkMode:All=disadvantage'])
})

test('an effect gets only the standard changes it is missing, for each standard debuff it is', () => {
  const missing = missingStandardChanges(['woozy'], [])
  assert.deepEqual(keys(missing), ['crawlspace.modLoss dex=attack,evade'])
  assert.equal(missing[0].phase, 'initial')
  assert.deepEqual(missingStandardChanges(['woozy'], missing), [])
  assert.deepEqual(missingStandardChanges(['poisoned'], []), [])
  assert.deepEqual(missingStandardChanges([], []), [])
})

test('named buffs that only change numbers get their rules too: Nitrous Oxide and Twinkle Toes double Move', async () => {
  const { missingNamedChanges } = await import('../src/rules/debuffs.ts')
  for (const name of ['Nitrous Oxide', 'Twinkle Toes (Rank 1)', 'Twinkle Toes (Rank 15)'])
    assert.deepEqual(keys(missingNamedChanges(name, [])), ['multiply system.move.value=2'])
  assert.deepEqual(missingNamedChanges('Nitrous Oxide', missingNamedChanges('Nitrous Oxide', [])), [])
  assert.deepEqual(missingNamedChanges('Iron Skin Potion', []), [])
})
