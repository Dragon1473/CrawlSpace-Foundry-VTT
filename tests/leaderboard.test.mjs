import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CANON_LEADERBOARDS, CANON_POPULATION, canonLeaderboard, cleanLeaderboard, cleanPopulation, populationLoss, populationOn } from '../src/rules/leaderboard.ts'

test('canon leaderboards have ten rows each and copy as editable boards', () => {
  for (const board of CANON_LEADERBOARDS) assert.equal(board.rows.length, 10, board.id)
  const copy = canonLeaderboard('f5-end')
  copy.rows[0].name = 'Somebody Else'
  assert.equal(CANON_LEADERBOARDS.find((board) => board.id === 'f5-end').rows[0].name, 'Carl')
  assert.equal(canonLeaderboard('nope'), null)
})

test('stored leaderboards are cleaned to at most ten text rows', () => {
  const board = cleanLeaderboard({ label: 'Mine', visible: 1, rows: Array.from({ length: 12 }, (_, i) => ({ name: `C${i}`, level: i })) })
  assert.equal(board.rows.length, 10)
  assert.equal(board.rows[3].level, '3')
  assert.equal(board.visible, true)
  assert.deepEqual(cleanLeaderboard(null), { label: '', rows: [], visible: false })
})

test('population by floor, carried down from earlier floors, and the losses between', () => {
  const counts = cleanPopulation({ 1: 1000, 3: 400.7, x: 5, 0: 9, 4: -1 })
  assert.deepEqual(counts, { 1: 1000, 3: 400 })
  assert.equal(populationOn(counts, 2), 1000)
  assert.deepEqual(populationLoss(counts, 3), { lost: 600, percent: 60 })
  assert.equal(populationLoss(counts, 2), null)
  assert.ok(CANON_POPULATION[1] > CANON_POPULATION[2])
})
