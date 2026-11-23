import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CARL_TOOLS, rosterGroups, toggleGroup } from '../src/rules/upkeep-roster.ts'
import { partyLongRestHours } from '../src/rules/personal-space.ts'
import { restSeconds } from '../src/rules/time.ts'

const labels = { parties: [{ id: 'rivals', name: 'Rivals' }, { id: 'nameless', name: '' }], playersLabel: 'Royal Court', soloLabel: 'Solo', unnamedLabel: 'Unnamed party' }

test("the players' party comes first, then other parties in order, then Solo; names sorted within each", () => {
  const crawlers = [
    { uuid: 'Actor.z', name: 'Zev', party: '' },
    { uuid: 'Actor.d', name: 'Donut', party: 'players' },
    { uuid: 'Actor.c', name: 'Carl', party: 'players' },
    { uuid: 'Actor.n', name: 'Nobody', party: 'nameless' },
    { uuid: 'Actor.l', name: 'Lucia', party: 'rivals' },
  ]
  const groups = rosterGroups(crawlers, new Set(['Actor.c', 'Actor.d']), labels)
  assert.deepEqual(groups.map((group) => group.label), ['Royal Court', 'Rivals', 'Unnamed party', 'Solo'])
  assert.deepEqual(groups[0].crawlers.map((crawler) => crawler.name), ['Carl', 'Donut'])
  assert.equal(groups[0].allChecked, true)
  assert.equal(groups[1].allChecked, false)
  assert.equal(groups[1].crawlers[0].checked, false)
})

test('empty parties are left out, and a crawler of a deleted party counts as Solo', () => {
  const groups = rosterGroups([{ uuid: 'Actor.x', name: 'X', party: 'gone' }], new Set(), labels)
  assert.deepEqual(groups.map((group) => group.key), [''])
  assert.equal(groups[0].crawlers[0].party, '')
})

test('the party button checks the whole party, or clears it when all of it is checked', () => {
  const some = toggleGroup(new Set(['a', 'other']), ['a', 'b'])
  assert.deepEqual([...some].sort(), ['a', 'b', 'other'])
  const none = toggleGroup(some, ['a', 'b'])
  assert.deepEqual([...none], ['other'])
})

test('the CarlRPG tools run in the order the user asked for', () => {
  assert.deepEqual([...CARL_TOOLS], ['partyScreen', 'upkeep', 'crafting', 'leaderboard', 'timers', 'race', 'bossBattle', 'encounterTuner'])
})

test('a Long Rest skips only as long as the slowest crawler resting needs', () => {
  // Everyone resting has a 2-hour bed: two hours pass.
  assert.equal(partyLongRestHours([2, 2, 2]) * 3600, 7200)
  // One crawler without the upgrade (null) keeps the full 8 hours.
  assert.equal(partyLongRestHours([2, null]) * 3600, restSeconds('long'))
})
