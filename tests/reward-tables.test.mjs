import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rewardTable, rewardRow, rewardTypes, rollCount, spellPool, sheetSpellRarities, tierForRolls, randomWeapon, clothingSlot, isRangedWeapon } from '../src/rules/reward-tables.ts'
import { REWARD_TABLES } from '../src/rules/reward-tables-data.ts'
import { RANDOM_ITEMS, SPELL_LISTS } from '../src/rules/reward-lists.ts'

test('every reward table covers 1-100 with no gaps or overlaps', () => {
  for (const [type, tiers] of Object.entries(REWARD_TABLES))
    for (const [tier, rows] of Object.entries(tiers)) {
      let next = 1
      for (const row of rows) {
        assert.equal(row.range[0], next, `${type} ${tier} starts ${row.range[0]}`)
        next = row.range[1] + 1
      }
      assert.equal(next, 101, `${type} ${tier} ends at ${next - 1}`)
    }
})

test('the sheet covers twelve box types, Bronze to Legendary, and nothing else', () => {
  assert.equal(rewardTypes().length, 12)
  assert.ok(rewardTable("Survivor's", 'Gold'))
  assert.equal(rewardTable("Survivor's", 'Celestial'), null)
  assert.equal(rewardTable('Boss', 'Gold'), null)
})

test('a roll lands on its row, and rows say what they give', () => {
  const rows = rewardTable('Adventurer', 'Gold')
  assert.equal(rewardRow(rows, 1).kind, 'gold')
  assert.equal(rewardRow(rows, 1), rewardRow(rows, 12))
  const magic = rewardRow(rows, 61)
  assert.equal(magic.kind, 'gear')
  assert.equal(magic.rolls, 2)
  assert.equal(tierForRolls(magic.rolls), 'Gold')
  assert.equal(rewardRow(rewardTable('Lucky Bastard', 'Gold'), 100).kind, 'allExcept')
})

test('no leftover foreign words in the tidied sheet text', () => {
  const text = JSON.stringify(REWARD_TABLES)
  for (const word of ['Ouro', 'Sucatas', ' de Gold', '(ou ', 'Boxeses']) assert.ok(!text.includes(word), word)
})

test('counts roll within their dice', () => {
  for (let i = 0; i < 200; i++) {
    const value = rollCount('2d4')
    assert.ok(value >= 2 && value <= 8)
    const plus = rollCount('1d4+1')
    assert.ok(plus >= 2 && plus <= 5)
  }
  assert.equal(rollCount('10'), 10)
})

test('spell lists set the tiers, and a focus narrows them', () => {
  const rarities = sheetSpellRarities()
  assert.equal(rarities['Magic Missile'], 'Weak')
  assert.equal(rarities['Lightning Bolt'], 'Rare')
  assert.equal(rarities['Shield'], 'Standard')
  assert.equal(spellPool('weakMedium', null).length, SPELL_LISTS.weak.length + SPELL_LISTS.medium.length)
  assert.ok(spellPool('weak', 'healing').every((name) => /heal/i.test(name)))
  assert.ok(spellPool('medium', 'attack').includes('Ice Blast'))
})

test('100 random items: weapons, slots and ranges', () => {
  for (const list of Object.values(RANDOM_ITEMS)) assert.equal(list.length, 100)
  assert.ok(isRangedWeapon('Longbow') && !isRangedWeapon('Throwing Axe') && !isRangedWeapon('Longsword'))
  assert.equal(clothingSlot('Combat Boots'), 'Feet')
  assert.equal(clothingSlot('Knight Helmet'), 'Head')
  assert.equal(clothingSlot('Chainmail'), 'Torso')
  for (let i = 0; i < 50; i++) assert.ok(RANDOM_ITEMS.weapons.includes(randomWeapon(true)))
})
