import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SETTING_GROUPS, groupSettings } from '../src/settings/groups.ts'

test('the CrawlSpace settings fall into boxes in a set order, with the empty ones left out', () => {
  const groups = groupSettings(['upkeepAutomation', 'crawlerMarks', 'crawlerFramePlayers', 'bossHealthBar', 'playerUpkeep'])
  assert.deepEqual(groups, [
    { id: 'frames', keys: ['crawlerFramePlayers', 'crawlerMarks'] },
    { id: 'bosses', keys: ['bossHealthBar'] },
    { id: 'upkeep', keys: ['upkeepAutomation', 'playerUpkeep'] },
  ])
})

test('a setting no box names goes in Other, last', () => {
  assert.deepEqual(groupSettings(['somethingNew', 'autoAdvancePhase']), [
    { id: 'combat', keys: ['autoAdvancePhase'] },
    { id: 'other', keys: ['somethingNew'] },
  ])
})

test('every setting is in one box only', () => {
  const keys = SETTING_GROUPS.flatMap((group) => group.keys)
  assert.equal(new Set(keys).size, keys.length)
})
