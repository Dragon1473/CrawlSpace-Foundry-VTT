import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  conjoinUnions,
  conjoinedLevel,
  extraSlotsHealth,
  leavingWith,
  legacySpace,
  levelFromText,
  normalizeMembers,
  ownerLevels,
  partyLongRestHours,
  spaceBenefits,
  tableLevelUp,
  trainingBonus,
  UPGRADE_KINDS,
} from '../src/rules/personal-space.ts'
import { CATALOG, TABLES } from '../tools/personal-space-catalog.mjs'

const bed = { name: 'Bed', rest: { longRestHours: 2, goodSleepHours: 30 } }
const instant = { name: 'Instant', rest: { longRestHours: 0 } }
const alcove = { name: 'Alcove', rest: { shortRestSlots: 1 } }
const clinic = { name: 'Clinic', rest: { shortRestSlots: 1 } }
const arena = { name: 'Arena', training: { hours: 3 } }
const lab = { name: 'Lab', training: { hours: 2 } }

test('no upgrades change nothing', () => {
  const benefits = spaceBenefits([])
  assert.equal(benefits.longRestHours, null)
  assert.equal(benefits.goodSleepHours, 0)
  assert.equal(benefits.shortRestSlots, 0)
  assert.equal(benefits.trainingHours, 0)
})

test('the best of each benefit wins and they do not stack', () => {
  const benefits = spaceBenefits([bed, instant, alcove, clinic, arena, lab])
  assert.equal(benefits.longRestHours, 0)
  assert.deepEqual(benefits.sources.longRestHours, ['Instant'])
  assert.equal(benefits.goodSleepHours, 30)
  assert.equal(benefits.shortRestSlots, 1)
  assert.deepEqual(benefits.sources.shortRestSlots, ['Alcove', 'Clinic'])
  assert.equal(benefits.trainingHours, 3)
  assert.deepEqual(benefits.sources.trainingHours, ['Arena'])
})

test('uninstalled upgrades do nothing', () => {
  assert.equal(spaceBenefits([{ ...bed, installed: false }]).longRestHours, null)
})

test('a blank or 8-hour Long Rest leaves the rest alone; fractions round down', () => {
  assert.equal(spaceBenefits([{ name: 'x', rest: { longRestHours: null } }]).longRestHours, null)
  assert.equal(spaceBenefits([{ name: 'x', rest: { longRestHours: '' } }]).longRestHours, null)
  assert.equal(spaceBenefits([{ name: 'x', rest: { longRestHours: 8 } }]).longRestHours, null)
  assert.equal(spaceBenefits([{ name: 'x', rest: { longRestHours: 2.9 } }]).longRestHours, 2)
})

test('a party rests as long as its slowest member', () => {
  assert.equal(partyLongRestHours([2, 0]), 2)
  assert.equal(partyLongRestHours([2, null]), 8)
  assert.equal(partyLongRestHours([]), 8)
})

test('extra Short Rest slots heal 10 each, capped', () => {
  assert.equal(extraSlotsHealth(50, 1), 60)
  assert.equal(extraSlotsHealth(105, 1), 110)
})

test('training adds its extra hours once a day after a productive hour', () => {
  assert.equal(trainingBonus(3, 1, false), 2)
  assert.equal(trainingBonus(3, 1, true), 0)
  assert.equal(trainingBonus(3, 0, false), 0)
  assert.equal(trainingBonus(1, 4, false), 0)
})

test('members: owners count the unions paid, duplicates go', () => {
  const members = normalizeMembers([{ uuid: 'a', role: 'owner' }, { uuid: 'b', role: 'owner' }, { uuid: 'b', role: 'member' }, { uuid: 'c', role: 'boss' }, { uuid: '' }])
  assert.deepEqual(members, [{ uuid: 'a', role: 'owner' }, { uuid: 'b', role: 'owner' }, { uuid: 'c', role: 'member' }])
  assert.equal(conjoinUnions(members), 1)
})

test('a leaving crawler takes only what they own', () => {
  const items = [{ name: 'Bed', owner: 'a' }, { name: 'Lab', owner: 'b' }, { name: 'Shower', owner: '' }]
  const { going, staying } = leavingWith(items, 'a')
  assert.deepEqual(going.map((item) => item.name), ['Bed'])
  assert.deepEqual(staying.map((item) => item.name), ['Lab', 'Shower'])
})

test('old character-sheet fields', () => {
  assert.equal(legacySpace({ personalSpace: { tier: '', size: '' }, amenities: [] }), null)
  assert.equal(legacySpace({}), null)
  assert.deepEqual(legacySpace({ personalSpace: { tier: 'Level 3', size: 'Large' }, amenities: ['Shower', ''] }), { tier: 'Level 3', size: 'Large', amenities: ['Shower'] })
  // The app's shape: { id, value } rows.
  assert.deepEqual(legacySpace({ amenities: [{ id: '1', value: 'Cleaner Bot' }] }), { tier: '', size: '', amenities: ['Cleaner Bot'] })
  assert.equal(levelFromText('Tier 3'), 3)
  assert.equal(levelFromText('9'), 5)
  assert.equal(levelFromText('basic'), 1)
})

test('catalog entries are complete and in range', () => {
  const refs = new Set()
  for (const entry of CATALOG) {
    assert.ok(!refs.has(entry.ref), `duplicate ${entry.ref}`)
    refs.add(entry.ref)
    assert.ok(UPGRADE_KINDS.includes(entry.system.kind), entry.name)
    assert.ok(['canon', 'homebrew'].includes(entry.system.status), entry.name)
    assert.ok(entry.system.tier >= 0 && entry.system.tier <= 4, entry.name)
    assert.ok(Number.isInteger(entry.system.price) && entry.system.price >= 0, entry.name)
    assert.ok(entry.system.summary && entry.system.description.length > 10, entry.name)
    assert.ok(!/\b(Carl|Donut|Mongo|Mordecai|Katia)\b/.test(entry.system.description + entry.system.summary), `${entry.name} names a novel character`)
  }
})

test('roll tables cover every result once and point at real entries', () => {
  const refs = new Set(CATALOG.map((entry) => entry.ref))
  const names = new Set(TABLES.map(([name]) => name))
  const crafting = new Set(
    fs.readdirSync('packs-src/homebrew-items')
      .map((file) => JSON.parse(fs.readFileSync(path.join('packs-src/homebrew-items', file), 'utf8')))
      .filter((doc) => doc.type === 'craftingTable')
      .map((doc) => doc.name),
  )
  for (const [name, formula, rows] of TABLES) {
    const faces = Number(formula.match(/d(\d+)/)[1])
    const hits = new Array(faces + 1).fill(0)
    for (const [low, high, target] of rows) {
      for (let face = low; face <= high; face++) hits[face]++
      if (typeof target === 'string') assert.ok(refs.has(target), `${name}: ${target}`)
      else if (target.item) assert.ok(crafting.has(target.item), `${name}: ${target.item}`)
      else if (target.table) assert.ok(names.has(target.table), `${name}: ${target.table}`)
      else assert.ok(target.text, name)
    }
    assert.deepEqual(hits.slice(1).filter((count) => count !== 1), [], `${name} has gaps or overlaps`)
  }
})

test('space tables level once per new floor and never count a floor twice', () => {
  // First sight of a floor only starts the count.
  assert.deepEqual(tableLevelUp(1, null, 4), { tier: 1, floor: 4 })
  assert.deepEqual(tableLevelUp(1, 4, 6), { tier: 3, floor: 6 })
  // A second member reaching floor 6 later changes nothing.
  assert.equal(tableLevelUp(3, 6, 6), null)
  assert.equal(tableLevelUp(3, 6, 5), null)
  assert.deepEqual(tableLevelUp(9, 6, 9), { tier: 10, floor: 9 })
  assert.equal(tableLevelUp(1, null, 0), null)
})

test('conjoined Level: the highest, +1 for a pair or two lower spaces, +2 for three or more at the top', () => {
  assert.equal(conjoinedLevel([3]), null)
  assert.equal(conjoinedLevel([3, 0]), null)
  assert.equal(conjoinedLevel([3, 2]), 3)
  assert.equal(conjoinedLevel([3, 3]), 4)
  assert.equal(conjoinedLevel([3, 2, 1]), 4)
  assert.equal(conjoinedLevel([3, 3, 2]), 4)
  assert.equal(conjoinedLevel([3, 3, 2, 2]), 4)
  assert.equal(conjoinedLevel([3, 3, 3]), 5)
  assert.equal(conjoinedLevel([2, 2, 2, 2]), 4)
  assert.equal(conjoinedLevel([5, 5]), 5)
  assert.equal(conjoinedLevel([4, 4, 4]), 5)
})

test('owners keep the Level of the space they brought', () => {
  const members = normalizeMembers([{ uuid: 'a', role: 'owner', spaceLevel: 3 }, { uuid: 'b', role: 'owner', spaceLevel: 9 }, { uuid: 'c', role: 'member', spaceLevel: 3 }, { uuid: 'd', role: 'owner' }])
  assert.deepEqual(members, [{ uuid: 'a', role: 'owner', spaceLevel: 3 }, { uuid: 'b', role: 'owner', spaceLevel: 5 }, { uuid: 'c', role: 'member' }, { uuid: 'd', role: 'owner' }])
  assert.deepEqual(ownerLevels(members), [3, 5])
})
