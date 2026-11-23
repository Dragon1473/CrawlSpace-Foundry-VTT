import { test } from 'node:test'
import assert from 'node:assert/strict'
import { balanceHints, checkTypeFor, cooldownText, damageFormulas, defaultAnswers, compareChoices, hobbyAnswers, INTENTS, intentOf, skillItemData } from '../src/rules/skill-creator.ts'
import { durationSeconds, durationEvent } from '../src/rules/time.ts'
import { EARTH_HOBBIES, THOUSAND_HOBBIES } from '../src/rules/hobby-lists.ts'

const labels = { range: 'Melee', targets: 'Targets: Self', limitations: 'Limitations:', note: 'Made with the Skill Creator.' }

test('an attack skill gets an Attack check, damage, and a die more at each upgrade', () => {
  const answers = { ...defaultAnswers(), name: 'Pan Slam', kind: 'attack', stat: 'STR', die: 8, damageType: 'Bludgeoning', rank10: 'Knocks the target prone.' }
  const item = skillItemData(answers, labels)
  assert.equal(item.type, 'skill')
  assert.equal(item.system.checkType, 'Attack')
  assert.equal(item.system.isAttack, true)
  assert.equal(item.system.stat, 'STR')
  assert.equal(item.system.damage.formula, '1d8+STR')
  assert.deepEqual(item.system.damage.types, ['Bludgeoning'])
  assert.equal(item.system.upgrades.rank5Damage, '2d8+STR')
  assert.equal(item.system.upgrades.rank15Damage, '4d8+STR')
  assert.equal(item.system.upgrades.rank5, 'Add 1d8 base damage.')
  assert.equal(item.system.upgrades.rank10, 'Knocks the target prone.')
})

test('a utility skill picks its check from passive and targets', () => {
  assert.equal(checkTypeFor({ kind: 'utility', passive: true, targets: ['enemies'] }), 'Passive')
  assert.equal(checkTypeFor({ kind: 'utility', passive: false, targets: ['enemies'] }), 'Opposed')
  assert.equal(checkTypeFor({ kind: 'utility', passive: false, targets: ['self'] }), 'Unopposed')
  const item = skillItemData({ ...defaultAnswers(), name: 'Birdsong', stat: 'CHA', intent: 'please' }, labels)
  assert.equal(item.system.damage.formula, '')
  assert.equal(item.flags.crawlspace.intent, 'please')
})

test('cooldowns are text the system reads back', () => {
  assert.equal(durationSeconds(cooldownText('hours', 4)), 4 * 3600)
  assert.equal(durationSeconds(cooldownText('day')), 30 * 3600)
  assert.equal(durationSeconds(cooldownText('round', 2)), 20)
  assert.equal(durationEvent(cooldownText('floor')), 'leaveFloor')
  assert.equal(durationEvent(cooldownText('scene')), 'combatEnd')
  assert.equal(cooldownText('none'), '')
})

test('damage without a stat, and the balance hints', () => {
  assert.deepEqual(damageFormulas({ die: 12, addStat: false, stat: 'DEX' }), ['1d12', '2d12', '3d12', '4d12'])
  const hints = balanceHints({ ...defaultAnswers(), name: 'Big Hit', kind: 'attack', die: 12, cooldown: 'none' })
  assert.ok(hints.includes('BigDie') && hints.includes('Upgrades'))
  assert.ok(balanceHints(defaultAnswers()).includes('NoName'))
})

test('the chart groups core skills by purpose, and hobbies make utility skills', () => {
  assert.equal(INTENTS.length, 13)
  assert.equal(intentOf('stealth'), 'sneak')
  assert.equal(intentOf('Nope'), null)
  const hobby = hobbyAnswers('Falconry', 'Training birds of prey')
  assert.equal(hobby.kind, 'utility')
  assert.equal(skillItemData(hobby, labels).flags.crawlspace.hobby, 'Falconry')
  assert.equal(EARTH_HOBBIES.length, 80)
  assert.equal(THOUSAND_HOBBIES.length, 1000)
})

test("the compare box lists each skill once, this purpose's skills first, then the rest by name", () => {
  const skills = [
    { name: 'Zoology', uuid: 'Item.z', intent: null },
    { name: 'stealth', uuid: 'Compendium.a.Item.s', intent: null },
    { name: 'Stealth', uuid: 'Item.s', intent: null },
    { name: 'Pickpocket', uuid: 'Item.p', intent: 'sneak' },
    { name: 'Alchemy', uuid: 'Item.a', intent: null },
  ]
  assert.deepEqual(compareChoices(skills, 'sneak').map((skill) => skill.name), ['Pickpocket', 'Stealth', 'Alchemy', 'Zoology'])
  // A world copy beats a compendium one of the same name.
  assert.equal(compareChoices(skills, 'sneak').find((skill) => skill.name === 'Stealth').uuid, 'Item.s')
  assert.deepEqual(compareChoices(skills, 'fight').map((skill) => skill.name), ['Alchemy', 'Pickpocket', 'Stealth', 'Zoology'])
})
