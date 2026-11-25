import { characterToActor } from '../src/import/convert.ts'
import test from 'node:test'
import assert from 'node:assert/strict'
import { bladeClapAllowed } from '../src/rules/blade-clap.ts'
import { advancementCap } from '../src/rules/advancementCaps.ts'
import { advancementCheck } from '../src/rules/upkeep.ts'
import { normalizeGrinding, creditGrindingHour, creditGrindingAid, allocateGrindingHours, nextGrindingDay, grindingOnDay, isUniqueLowestCrawler } from '../src/rules/grinding.ts'
import { clockDay } from '../src/rules/time.ts'
import { floorCheckDc } from '../src/rules/floor-checks.ts'
import { awardNumber } from '../src/rules/crawler-awards.ts'
import { killingBlowBonus, addKillingBlowStack, expireKillingBlowStacks } from '../src/rules/killingBlowStacks.ts'

test('Blade Clap catches edged weapons only, missiles require rank 5', () => {
  const edged = { toHit: 12, damageTypes: ['Slashing'] }
  assert.equal(bladeClapAllowed(edged, 1), true)
  for (const extra of [{ toHit: null }, { isArea: true }, { magic: true }, { damageTypes: ['Bludgeoning'] }, { ranged: true }]) assert.equal(bladeClapAllowed({ ...edged, ...extra }, 4), false)
  assert.equal(bladeClapAllowed({ ...edged, ranged: true }, 5), true)
})
test('rank 20 needs both floor 7 and a matching cap exception', () => {
  const abilities = [{ properties: { effects: [{ type: 'rankCap', target: 'Fireball', value: '20' }] } }]
  assert.equal(advancementCap('Fireball', 6, abilities), 15)
  assert.equal(advancementCap('Fireball', 7, abilities), 20)
  assert.equal(advancementCap('Ice', 7, abilities), 15)
  assert.equal(advancementCheck(15, 'floor', 7).eligible, false)
  assert.equal(advancementCheck(15, 'floor', 7, true).eligible, true)
  assert.equal(advancementCheck(5, 'session', 7, true).eligible, false)
})
test('grinding preserves actual hours, caps aid, and banks progress between days', () => {
  let state = normalizeGrinding()
  for (let i = 0; i < 5; i++) state = creditGrindingHour(state, true)
  state = creditGrindingHour(state, false)
  state = creditGrindingAid(state, 'neighborhood')
  state = creditGrindingAid(state, 'borough')
  state = creditGrindingAid(state, 'borough')
  assert.equal(state.hoursToday, 6)
  assert.equal(state.levelHours, 7)
  const partial = allocateGrindingHours(state, 'skill', 3, 2)
  assert.equal(partial.ready, false)
  const complete = allocateGrindingHours(partial.state, 'skill', 3, 1)
  assert.equal(complete.ready, true)
  assert.throws(() => allocateGrindingHours(complete.state, 'skill', 3, 1))
  assert.equal(nextGrindingDay(partial.state).skillHours.skill, 2)
  assert.equal(isUniqueLowestCrawler(2, [3, 4]), true)
  assert.equal(isUniqueLowestCrawler(2, [2, 4]), false)
  assert.equal(isUniqueLowestCrawler(2, []), false)
})
test('floor checks and signed awards follow source arithmetic', () => {
  assert.equal(floorCheckDc(4, 'skill'), 18)
  assert.equal(floorCheckDc(4, 'stat'), 14)
  assert.equal(awardNumber('', 8), 8)
  assert.equal(awardNumber('+5', 8), 13)
  assert.equal(awardNumber('-2', 8), 6)
  assert.equal(awardNumber('2.5', 8), 2)
  assert.throws(() => awardNumber('Infinity', 8))
})
test('killing-blow stacks are spell-specific, rank-capped and expire', () => {
  const spells = [{ id: 'a', killingBlowStacking: true, killingBlowStacks: 4 }, { id: 'b', killingBlowStacking: true, killingBlowStacks: 2 }]
  const next = addKillingBlowStack(spells, 'a', 5, { at: 1, floor: 2 })
  assert.equal(killingBlowBonus(next[0], 3), 3)
  assert.equal(next[1].killingBlowStacks, 2)
  assert.equal(expireKillingBlowStacks(next, () => 10, { now: 1, floor: 3 })[0].killingBlowStacks, 0)
  assert.equal(expireKillingBlowStacks(next, () => 5, { now: 7 * 24 * 3600000 + 1, gameClock: null })[0].killingBlowStacks, 0)
})

test('imports retain spell stacks and remap grinding progress to Foundry item ids', () => {
  const actor = characterToActor({ character: { name: 'Importer' }, skills: [{ id: 'skill-one', name: 'Endurance', unenhancedRank: '2' }], spells: [{ id: 'spell-one', name: 'Stack spell', unenhancedRank: '5', killingBlowStacking: true, killingBlowStacks: 3 }], upkeep: { grinding: { day: 4, levelHours: 2, skillHours: { 'spell:spell-one': 4 }, attempted: { 'skill-one': 4 } } } })
  const spell = actor.items.find((item) => item.type === 'spell')
  const skill = actor.items.find((item) => item.type === 'skill')
  assert.equal(spell.system.killingBlowStacks, 3)
  assert.equal(actor.flags.crawlspace.grinding.skillHours[spell._id], 4)
  assert.equal(actor.flags.crawlspace.grinding.attempted[skill._id], 4)
})

test('builder backgrounds populate the Info fields as well as embedded items', () => {
  const background = { childhood: 'Farm', adolescence: 'School', career: 'Builder', hobby: 'Games' }
  const actor = characterToActor({ data: { character: { name: 'New Crawler' }, background } })
  assert.deepEqual(actor.system.background, background)
  for (const [stage, name] of Object.entries(background)) {
    assert.ok(actor.items.some((item) => item.type === 'background' && item.system.stage === stage && item.name === name))
  }
  assert.deepEqual(characterToActor({}).system.background, { childhood: '', adolescence: '', career: '', hobby: '' })
})

test('character import floors decimals instead of removing their decimal points', () => {
  const actor = characterToActor({ character: { name: 'Fractional import' }, attributeValues: [{ unenhanced: '12.9' }], attributeModOverrides: { 0: '-1.5' }, skills: [{ name: 'Test', unenhancedRank: '2.9' }] })
  assert.equal(actor.system.attributes.str.value, 12)
  assert.equal(actor.system.attributes.str.modOverride, -2)
  assert.equal(actor.items.find((item) => item.type === 'skill').system.rank.value, 2)
})

test('Heal stays at Rank 1; Heal Others and Heal Self do not', () => {
  assert.equal(advancementCap('Heal', 1), 1)
  assert.equal(advancementCap(' heal ', 9), 1)
  assert.equal(advancementCap('Heal Others', 1), 15)
  assert.equal(advancementCap('Heal Self', 1), 15)
  assert.equal(advancementCap('Heal Critters', 1), 15)
})

test('the grinding day is the game clock day, by the day length setting', () => {
  assert.equal(clockDay(0), 1)
  assert.equal(clockDay(107999), 1)
  assert.equal(clockDay(108000), 2)
  assert.equal(clockDay(86400, 24), 2)
  assert.equal(clockDay(108000, 24), 2)
  assert.equal(clockDay(-5), 1)
  // A floor timer set to 8 days 6 hours at time 0: the day turns over when 8 days are left (6 hours in), then 7.
  const end = (8 * 24 + 6) * 3600
  assert.equal(clockDay(0, 24, end), 0)
  assert.equal(clockDay(6 * 3600 - 1, 24, end), 0)
  assert.equal(clockDay(6 * 3600, 24, end), 1)
  assert.equal(clockDay(30 * 3600 - 1, 24, end), 1)
  assert.equal(clockDay(30 * 3600, 24, end), 2)
  assert.equal(clockDay(5 * 3600, 30, (8 * 30 + 6) * 3600), 0)
  assert.equal(clockDay(6 * 3600, 30, (8 * 30 + 6) * 3600), 1)
  const state = { ...normalizeGrinding(), day: 1, hoursToday: 4, productiveToday: 4, levelHours: 7, unassignedHours: 2, attempted: { a: 1 } }
  assert.equal(grindingOnDay(state, 0), state)
  const next = grindingOnDay(state, 3)
  assert.equal(next.day, 4)
  assert.equal(next.hoursToday, 0)
  assert.equal(next.levelHours, 7)
  assert.equal(next.unassignedHours, 2)
  assert.notEqual(next.attempted.a, next.day)
})
