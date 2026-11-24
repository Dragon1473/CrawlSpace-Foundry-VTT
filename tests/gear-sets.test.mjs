import { test } from 'node:test'
import assert from 'node:assert/strict'
import { activeBonuses, addMember, equippedPieces, isPiece, piecesFor } from '../src/rules/gear-sets.ts'

const members = [{ name: 'Iron Helm' }, { name: 'Iron Gauntlets' }, { name: 'Iron Greaves' }]

test('only equipped, unbroken, distinct pieces count, matched by name', () => {
  const items = [
    { name: 'Iron Helm', system: { equipped: true } },
    { name: 'iron gauntlets ', system: { equipped: true } },
    { name: 'Iron Gauntlets', system: { equipped: true } },
    { name: 'Iron Greaves', system: { equipped: true, broken: true } },
    { name: 'Wooden Shield', system: { equipped: true } },
  ]
  assert.equal(equippedPieces(members, items), 2)
  assert.equal(equippedPieces(members, [{ name: 'Iron Helm', system: { equipped: false } }]), 0)
  assert.equal(isPiece(members, 'IRON HELM'), true)
  assert.equal(isPiece(members, 'Iron Hat'), false)
})

test('a bonus turns on at its piece count; unset needs 2', () => {
  assert.equal(piecesFor(undefined), 2)
  assert.equal(piecesFor(0), 2)
  assert.equal(piecesFor(3.7), 3)
  const bonuses = [{ id: 'a', pieces: 2 }, { id: 'b', pieces: 3 }, { id: 'c', pieces: 1, disabled: true }]
  assert.deepEqual(activeBonuses(bonuses, 1).map((bonus) => bonus.id), [])
  assert.deepEqual(activeBonuses(bonuses, 2).map((bonus) => bonus.id), ['a'])
  assert.deepEqual(activeBonuses(bonuses, 3).map((bonus) => bonus.id), ['a', 'b'])
})

test('adding a piece ignores blanks and names already in the set', () => {
  assert.equal(addMember(members, { name: 'iron helm' }), members)
  assert.equal(addMember(members, { name: '  ' }), members)
  assert.deepEqual(addMember([], { name: ' Ring ', uuid: 'Item.x' }), [{ name: 'Ring', uuid: 'Item.x', img: '' }])
})
