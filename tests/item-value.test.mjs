import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addHistory, boxLabel, determineValueRank, formerOwners, hasValuePerk, HISTORY_LIMIT, likelyBox, likelyTier, sortByValue, unitValue, usesIn } from '../src/rules/item-value.ts'

const skill = (name, total) => ({ type: 'skill', name, system: { rank: { total, value: total } } })

test('Determine Value rank comes from the skill of that name, any case', () => {
  assert.equal(determineValueRank([skill('Determine Value', 7), skill('Repair', 12)]), 7)
  assert.equal(determineValueRank([skill('determine value ', 3)]), 3)
  assert.equal(determineValueRank([{ type: 'weapon', name: 'Determine Value', system: {} }]), 0)
  assert.equal(determineValueRank([]), 0)
})

test('perks open at ranks 1, 5, 10 and 15; the homebrew ones can be switched off', () => {
  assert.equal(hasValuePerk(0, 'sort'), false)
  assert.equal(hasValuePerk(1, 'sort'), true)
  assert.equal(hasValuePerk(4, 'history'), false)
  assert.equal(hasValuePerk(5, 'history'), true)
  assert.equal(hasValuePerk(9.9, 'origin'), false)
  assert.equal(hasValuePerk(10, 'origin'), true)
  assert.equal(hasValuePerk(15, 'toast'), true)
  assert.equal(hasValuePerk(20, 'sort', false), false)
  assert.equal(hasValuePerk(20, 'history', false), false)
  assert.equal(hasValuePerk(20, 'origin', false), true)
})

test('values round down and never go negative; sorting puts the most valuable first and keeps ties in order', () => {
  assert.equal(unitValue({ goldValue: 12.9 }), 12)
  assert.equal(unitValue({ goldValue: -4 }), 0)
  assert.equal(unitValue(undefined), 0)
  const items = [{ name: 'a', system: { goldValue: 5 } }, { name: 'b', system: { goldValue: 50 } }, { name: 'c', system: { goldValue: 5 } }, { name: 'd', system: {} }]
  assert.deepEqual(sortByValue(items).map((item) => item.name), ['b', 'a', 'c', 'd'])
})

test('history: an owner is not repeated, uses in a row merge, and the list is capped', () => {
  const ann = { name: 'Ann', uuid: 'Actor.ann' }
  const bob = { name: 'Bob', uuid: 'Actor.bob' }
  let history = addHistory([], { kind: 'owner', ...ann, at: 1 })
  history = addHistory(history, { kind: 'owner', ...ann, at: 2 })
  assert.equal(history.length, 1)
  history = addHistory(history, { kind: 'use', ...ann, at: 3 })
  history = addHistory(history, { kind: 'use', ...ann, at: 4 })
  assert.equal(history.length, 2)
  assert.equal(history[1].count, 2)
  history = addHistory(history, { kind: 'owner', ...bob, at: 5 })
  history = addHistory(history, { kind: 'use', ...bob, at: 6 })
  assert.equal(usesIn(history), 3)
  assert.deepEqual(formerOwners(history, bob).map((owner) => owner.name), ['Ann'])
  // Back to Ann: Bob is now a former owner too, and Ann is listed once.
  history = addHistory(history, { kind: 'owner', ...ann, at: 7 })
  assert.deepEqual(formerOwners(history, ann).map((owner) => owner.name), ['Ann', 'Bob'])
  let long = []
  for (let index = 0; index < HISTORY_LIMIT + 10; index++) long = addHistory(long, { kind: 'owner', name: `O${index}`, at: index })
  assert.equal(long.length, HISTORY_LIMIT)
  assert.equal(long[0].name, 'O10')
  assert.equal(addHistory(null, { kind: 'box', name: 'Box', at: 0 }).length, 1)
})

test('the likely box: tier from the value (or rarity), type from the item', () => {
  assert.equal(likelyTier({ system: { goldValue: 8 } }), 'Bronze')
  assert.equal(likelyTier({ system: { goldValue: 900 } }), 'Silver')
  assert.equal(likelyTier({ system: { goldValue: 5000 } }), 'Gold')
  assert.equal(likelyTier({ system: { goldValue: 10000 } }), 'Platinum')
  assert.equal(likelyTier({ system: { goldValue: 5000000 } }), 'Legendary')
  assert.equal(likelyTier({ system: { rarity: 'rare' } }), 'Gold')
  assert.equal(likelyTier({ system: {} }), 'Bronze')
  assert.equal(likelyBox({ name: 'Rusty Sword', type: 'weapon', system: { goldValue: 3 } }).type, 'Weapon')
  assert.equal(likelyBox({ name: 'Leather Boots', type: 'equipment', system: {} }).type, 'Apparel')
  assert.equal(likelyBox({ name: 'Healing Potion', type: 'consumable', system: {} }).type, "Survivor's")
  assert.equal(likelyBox({ name: 'Stick of Dynamite', type: 'consumable', system: {} }).type, 'Goblin')
  assert.equal(likelyBox({ name: 'Odd Thing', type: 'material', system: {} }).type, "Crafter's")
  assert.equal(boxLabel({ tier: 'Gold', type: 'Weapon' }), 'Gold Weapon')
})
