import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanTitle, enhancedTotal, partyLeader, partySkills, signedRank, titledName, unenhancedTotal } from '../src/rules/party-screen.ts'
import { acceptsLink, cleanQuests, QUEST_LINK_SECTIONS, questsFor, questSections } from '../src/rules/quests.ts'

test('unenhanced stat points add up the base scores, rounded down, blanks counting 0', () => {
  assert.equal(unenhancedTotal({ str: { value: 5 }, int: { value: 3.7 }, con: { value: null }, dex: { value: 4 }, cha: {} }), 12)
  assert.equal(unenhancedTotal(undefined), 0)
})

test('the crawler with the most unenhanced stat points leads the party', () => {
  const member = (id, name, unenhanced, enhanced = 0, evade = 0) => ({ id, name, unenhanced, enhanced, evade })
  assert.equal(partyLeader([member('a', 'Carl', 20), member('b', 'Donut', 24), member('c', 'Katia', 3)]), 'b')
  assert.equal(partyLeader([]), null)
  assert.equal(partyLeader([member('a', 'Carl', 0)]), 'a')
})

test('ties go to the highest enhanced score, then the highest Evade, then the name', () => {
  const member = (id, name, unenhanced, enhanced = 0, evade = 0) => ({ id, name, unenhanced, enhanced, evade })
  assert.equal(partyLeader([member('a', 'Carl', 24, 30), member('b', 'Donut', 24, 33)]), 'b')
  assert.equal(partyLeader([member('a', 'Carl', 24, 30, 2), member('b', 'Donut', 24, 30, 5)]), 'b')
  assert.equal(partyLeader([member('b', 'Donut', 24, 30, 5), member('a', 'Carl', 24, 30, 5)]), 'a')
  assert.equal(partyLeader([member('a', 'Carl', 24, Number.NaN, Number.NaN), member('b', 'Donut', 24, 1, 0)]), 'b')
})

test('enhanced scores add up the stat totals, blanks counting 0', () => {
  assert.equal(enhancedTotal({ str: { total: 9 }, int: { total: null }, dex: { total: 4.5 } }), 13)
  assert.equal(enhancedTotal(null), 0)
})

test('a title sits before or after the name; a blank title leaves the name alone', () => {
  assert.equal(titledName('Donut', { text: ' Princess ', position: 'before' }), 'Princess Donut')
  assert.equal(titledName('Carl', { text: 'the Destroyer', position: 'after' }), 'Carl the Destroyer')
  assert.equal(titledName('Carl', { text: 'the Destroyer' }), 'Carl the Destroyer')
  assert.equal(titledName('Carl', { text: '  ', position: 'before' }), 'Carl')
  assert.equal(titledName('Carl', null), 'Carl')
  assert.deepEqual(cleanTitle({ text: ' Princess ', position: 'before' }), { text: 'Princess', position: 'before' })
  assert.deepEqual(cleanTitle({ text: 'x'.repeat(80), position: 'sideways' }), { text: 'x'.repeat(60), position: 'after' })
  assert.deepEqual(cleanTitle(undefined), { text: '', position: 'after' })
})

test('ranks read with a sign', () => {
  assert.equal(signedRank(6), '+6')
  assert.equal(signedRank(0), '+0')
  assert.equal(signedRank(-2), '-2')
})

test('party skills list each skill and spell once, at the best rank, with everyone who has it', () => {
  const skills = partySkills([
    { name: 'Carl', skills: [{ name: 'Unarmed Combat', rank: 6, kind: 'skill' }, { name: 'Explosives Handling', rank: 3, kind: 'skill' }] },
    { name: 'Donut', skills: [{ name: 'unarmed combat', rank: 5, kind: 'skill' }, { name: 'Magic Missile', rank: 7.9, kind: 'spell' }] },
    { name: 'Mordecai', skills: [{ name: 'Unarmed Combat', rank: 2, kind: 'skill' }, { name: ' ', rank: 4, kind: 'skill' }] },
  ])
  assert.deepEqual(
    skills.map((skill) => [skill.kind, skill.name, skill.label]),
    [
      ['skill', 'Explosives Handling', 'Explosives Handling +3'],
      ['skill', 'Unarmed Combat', 'Unarmed Combat +6'],
      ['spell', 'Magic Missile', 'Magic Missile +7'],
    ],
  )
  assert.deepEqual(skills[1].holders, [
    { name: 'Carl', rank: 6 },
    { name: 'Donut', rank: 5 },
    { name: 'Mordecai', rank: 2 },
  ])
})

test('a crawler with the same skill twice counts once, at its better rank', () => {
  const [skill] = partySkills([{ name: 'Carl', skills: [{ name: 'Sneak', rank: 1, kind: 'skill' }, { name: 'Sneak', rank: 4, kind: 'skill' }] }])
  assert.deepEqual(skill.holders, [{ name: 'Carl', rank: 4 }])
})

test('quests from the setting are cleaned: ids kept unique, sections filled in, bad links dropped', () => {
  const [quest, second] = cleanQuests([
    { id: 'q1', name: ' Find the stairs ', status: 'accepted', reward: '50 gold', mobs: [{ uuid: 'Actor.a', name: 'Rat', img: 'rat.webp' }, { name: 'no uuid' }], stages: [{ text: 'Go down', done: true }, 'junk'] },
    { id: 'q1', name: 'Duplicate' },
    { name: 'No id' },
    { id: 'q2', status: 'weird' },
  ])
  assert.equal(quest.name, 'Find the stairs')
  assert.equal(quest.reward, '50 gold')
  assert.deepEqual(quest.mobs, [{ uuid: 'Actor.a', name: 'Rat', img: 'rat.webp' }])
  assert.equal(quest.stages.length, 1)
  assert.equal(quest.stages[0].text, 'Go down')
  assert.equal(quest.stages[0].done, true)
  assert.ok(quest.stages[0].id)
  assert.deepEqual(quest.npcs, [])
  assert.equal(quest.hooks, '')
  assert.equal(second.id, 'q2')
  assert.equal(second.status, 'offered')
})

test('players see accepted quests (then completed ones); the GM sees every quest', () => {
  const quests = cleanQuests([
    { id: 'a', name: 'Offered', status: 'offered' },
    { id: 'b', name: 'Done', status: 'completed' },
    { id: 'c', name: 'Taken', status: 'accepted' },
  ])
  assert.deepEqual(questsFor(quests, false).map((quest) => quest.id), ['c', 'b'])
  assert.deepEqual(questsFor(quests, true).map((quest) => quest.id), ['c', 'a', 'b'])
})

test('players only read the summary; the GM gets every section', () => {
  assert.deepEqual(questSections(false), ['summary'])
  assert.deepEqual(questSections(true), ['summary', 'hooks', 'battles', 'environment', 'traps', 'items', 'awards', 'stages', 'npcs'])
})

test('each linked section takes only its own kind of actor or item', () => {
  const mob = { documentName: 'Actor', type: 'mob', system: { kind: 'mob' } }
  const boss = { documentName: 'Actor', type: 'mob', system: { kind: 'boss' } }
  const npc = { documentName: 'Actor', type: 'npc', system: {} }
  const trap = { documentName: 'Item', type: 'trap', system: {} }
  const sword = { documentName: 'Item', type: 'weapon', system: {} }
  const box = { documentName: 'Item', type: 'lootBox', system: {} }
  const achievement = { documentName: 'Item', type: 'achievement', system: {} }
  assert.equal(acceptsLink('mobs', mob), true)
  assert.equal(acceptsLink('mobs', boss), false)
  assert.equal(acceptsLink('bosses', boss), true)
  assert.equal(acceptsLink('npcs', npc), true)
  assert.equal(acceptsLink('npcs', mob), false)
  assert.equal(acceptsLink('traps', trap), true)
  assert.equal(acceptsLink('items', sword), true)
  assert.equal(acceptsLink('questItems', sword), true)
  assert.equal(acceptsLink('items', trap), false)
  assert.equal(acceptsLink('achievements', achievement), true)
  assert.equal(acceptsLink('rewards', box), true)
  assert.equal(acceptsLink('rewards', sword), true)
  assert.equal(acceptsLink('rewards', achievement), false)
  assert.equal(acceptsLink('rewards', npc), false)
  assert.equal(acceptsLink('nope', mob), false)
  assert.deepEqual(QUEST_LINK_SECTIONS.map((section) => section.key), ['mobs', 'bosses', 'traps', 'items', 'questItems', 'achievements', 'rewards', 'npcs'])
})
