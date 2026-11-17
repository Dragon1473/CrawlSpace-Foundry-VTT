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
  assert.deepEqual(missingNamedChanges('Rooted in Place', []), [])
})

const special = (changes, key) => JSON.parse(changes.find((change) => change.type === 'crawlspace.special' && change.key === key)?.value ?? 'null')

test('Good Sleep adds the Floor to every stat, once the Floor is known', async () => {
  const { missingNamedChanges } = await import('../src/rules/debuffs.ts')
  assert.deepEqual(keys(missingNamedChanges('Good Sleep', [], { floor: 3 })), [
    'add system.attributes.cha.bonus=3',
    'add system.attributes.con.bonus=3',
    'add system.attributes.dex.bonus=3',
    'add system.attributes.int.bonus=3',
    'add system.attributes.str.bonus=3',
  ])
  assert.deepEqual(missingNamedChanges('Good Sleep', []), [])
})

test('Iron Skin doubles DR; Invisible attacks with Advantage and is attacked with Disadvantage', async () => {
  const { missingNamedChanges } = await import('../src/rules/debuffs.ts')
  assert.deepEqual(keys(missingNamedChanges('Iron Skin Potion', [])), ['multiply system.dr.factor=2'])
  assert.deepEqual(keys(missingNamedChanges('Invisible', [])), ['crawlspace.rollMode attackMode:All=advantage', 'crawlspace.rollMode incomingAttackMode:All=disadvantage'])
})

test('Replenish and You are full! regenerate; Water Breathing from Rank 10 swims with Advantage', async () => {
  const { missingNamedChanges } = await import('../src/rules/debuffs.ts')
  assert.deepEqual(special(missingNamedChanges('Replenish Buff', []), 'manaPerRound'), { target: '', value: 'INT', interval: '10 minutes' })
  assert.deepEqual(special(missingNamedChanges('You are full!', []), 'regenPerRound'), { target: '', value: '2', interval: '1 hour' })
  assert.deepEqual(keys(missingNamedChanges('Water Breathing (Rank 10)', [])), ['crawlspace.rollMode checkMode:Swimming=advantage'])
  assert.deepEqual(missingNamedChanges('Water Breathing (Rank 1)', []), [])
})

test('Astral Paw from Rank 5 adds its Rank die to Pugilism and Slice; Anti-Piercing marks armor', async () => {
  const { missingNamedChanges } = await import('../src/rules/debuffs.ts')
  assert.equal(special(missingNamedChanges('Astral Paw (Rank 5)', []), 'damageBonus').value, 'RANK_DIE')
  assert.equal(special(missingNamedChanges('Astral Paw (Rank 15)', []), 'damageBonus').target, 'Pugilism, Slice')
  assert.deepEqual(missingNamedChanges('Astral Paw (Rank 1)', []), [])
  assert.ok(special(missingNamedChanges('Anti-Piercing', []), 'antiPiercing'))
})

test('Recovery and Restore are instant: full Health or full Mana', async () => {
  const { instantRestore } = await import('../src/rules/debuffs.ts')
  assert.equal(instantRestore('Recovery Buff'), 'health')
  assert.equal(instantRestore('Restore Buff'), 'mana')
  assert.equal(instantRestore('Good Sleep'), null)
})
