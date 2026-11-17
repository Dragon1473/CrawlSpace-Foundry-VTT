import { test } from 'node:test'
import assert from 'node:assert/strict'
import { explosionFormula, occupantDamage, ramDice, ramRecoil, sizeValue, SAMPLE_VEHICLES } from '../src/rules/vehicles.ts'
import { chaseGround, chaseStatus, chaseWinners, moveMod, npcLegResult, placeLeg, raceStandings } from '../src/rules/racing.ts'

test('sizes read as 1–8 from a number or a size name', () => {
  assert.equal(sizeValue('4'), 4)
  assert.equal(sizeValue('Large'), 5)
  assert.equal(sizeValue(12), 8)
  assert.equal(sizeValue(''), 0)
})

test('ramming deals 1d6 per size value and per 10 ft of Move (rounded down), plus Floor with a ram plate', () => {
  assert.equal(ramDice(4, 50), '9d6')
  assert.equal(ramDice(4, 55), '9d6')
  assert.equal(ramDice(5, 0), '5d6')
  assert.equal(ramDice(4, 50, { ramPlate: true, floor: 3 }), '9d6 + 3')
})

test('the rammer takes half and halves its Move, or full damage and stops dead against something bigger', () => {
  assert.deepEqual(ramRecoil(21, 5, 4, 60), { damage: 10, move: 30 })
  assert.deepEqual(ramRecoil(21, 5, 6, 60), { damage: 21, move: 0 })
  assert.deepEqual(ramRecoil(21, 5, 5, 45), { damage: 10, move: 22 })
})

test('occupants take half of what their vehicle took, less their own DR and the vehicle DR', () => {
  assert.equal(occupantDamage(21, 2, 3), 5)
  assert.equal(occupantDamage(21, 10, 3), 0)
  assert.equal(occupantDamage(9, 0, 0), 4)
})

test('a vehicle at 0% explodes for size d6 + Floor Fire damage', () => {
  assert.equal(explosionFormula(5, 3), '5d6 + 3')
  assert.equal(explosionFormula(1, 0), '1d6')
})

test('the sample vehicles have the stats from the vehicle table', () => {
  const sedan = SAMPLE_VEHICLES.find((vehicle) => vehicle.id === 'sedan')
  assert.deepEqual({ move: sedan.move, size: sedan.size, dr: sedan.dr }, { move: 80, size: 5, dr: 3 })
  assert.equal(SAMPLE_VEHICLES.length, 8)
})

test('racing adds Move ÷ 10, rounded down; NPCs and Mobs take 10 + stat + Floor + Move Mod', () => {
  assert.equal(moveMod(20), 2)
  assert.equal(moveMod(25), 2)
  assert.equal(moveMod(45), 4)
  assert.equal(npcLegResult({ statMod: 5, floor: 5, move: 30 }), 23)
})

test('a leg places racers by result, higher base Move breaking ties, still-tied racers sharing', () => {
  const places = placeLeg([
    { id: 'a', result: 24, move: 20 },
    { id: 't', result: 20, move: 45 },
    { id: 'r', result: 24, move: 30 },
    { id: 'x', result: 20, move: 45 },
  ])
  assert.deepEqual(places, { r: 1, a: 2, t: 3, x: 3 })
})

test('the lowest placement total wins the race; a tie goes to the better last leg', () => {
  const standings = raceStandings({ a: [1, 3, 1], t: [3, 1, 2], r: [2, 2, 3] })
  assert.deepEqual(standings.map((row) => [row.id, row.total, row.place]), [['a', 5, 1], ['t', 6, 2], ['r', 7, 3]])
  const tied = raceStandings({ a: [1, 2], b: [2, 1] })
  assert.deepEqual(tied.map((row) => [row.id, row.place]), [['b', 1], ['a', 2]])
  const still = raceStandings({ a: [1, 1], b: [1, 1] })
  assert.deepEqual(still.map((row) => row.place), [1, 1])
})

test('chase Ground per leg follows the degree of success; a Critical Fail ends the chase for that crawler', () => {
  assert.equal(chaseGround('Critical hit'), 2)
  assert.equal(chaseGround('Amazing hit'), 2)
  assert.equal(chaseGround('Hit'), 1)
  // A Near Miss (missing by 2 or less) holds Ground.
  assert.equal(chaseGround('Miss', -1), 0)
  assert.equal(chaseGround('Miss', -2), 0)
  assert.equal(chaseGround('Miss', -3), -1)
  assert.equal(chaseGround('Major miss'), -2)
  assert.equal(chaseGround('Crit miss'), null)
})

test('4 Ground catches the quarry early, -4 loses it; after the last leg 1 or more catches it', () => {
  assert.equal(chaseStatus(4, false), 'caught')
  assert.equal(chaseStatus(-4, false), 'lost')
  assert.equal(chaseStatus(2, false), 'chasing')
  assert.equal(chaseStatus(2, true), 'caught')
  assert.equal(chaseStatus(0, true), 'lost')
  assert.equal(chaseStatus(null, false), 'out')
})

test('the highest Ground total reaches the quarry first, Move breaking ties', () => {
  const order = chaseWinners([
    { id: 'a', ground: 1, move: 20 },
    { id: 't', ground: 2, move: 45 },
    { id: 'p', ground: 0, move: 30 },
    { id: 'q', ground: 2, move: 50 },
  ])
  assert.deepEqual(order, ['q', 't', 'a'])
})
