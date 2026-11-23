import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanPartySize, isThreat, mobCount, THREATS } from '../src/rules/encounter.ts'

test('mob count is party size times the threat share, rounded down, at least one', () => {
  assert.equal(mobCount(4, 'moderate'), 4)
  assert.equal(mobCount(4, 'weak'), 2)
  assert.equal(mobCount(3, 'weak'), 1)
  assert.equal(mobCount(5, 'strong'), 7)
  assert.equal(mobCount(7, 'overwhelming'), 14)
  assert.equal(mobCount(1, 'weak'), 1)
})

test('unknown threats count as moderate and bad sizes as one crawler', () => {
  assert.equal(mobCount(5, 'nonsense'), 5)
  assert.equal(mobCount('x', 'strong'), 1)
  assert.equal(cleanPartySize(3.9), 3)
  assert.equal(cleanPartySize(500), 99)
  assert.ok(isThreat('strong') && !isThreat('deadly'))
  assert.deepEqual(THREATS.map((threat) => threat.percent), [50, 100, 150, 200])
})
