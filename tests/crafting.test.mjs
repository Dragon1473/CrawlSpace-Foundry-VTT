import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  autoApproved,
  checkSkills,
  craftDifficulty,
  craftMinutes,
  formatMinutes,
  matchIngredients,
  normalizeRecipe,
  recipeKey,
  recipeState,
  salvageReturns,
  tableBonus,
  unlockMet,
  CRAFT_CATEGORIES,
  ITEM_SIZES,
} from '../src/rules/crafting.ts'

const ctx = (over = {}) => ({
  learned: new Set(),
  items: [],
  skills: new Map(),
  level: 1,
  floor: 1,
  ...over,
})

test('the standard categories are all there, each with an icon', () => {
  const ids = CRAFT_CATEGORIES.map((c) => c.id)
  for (const id of ['alchemy', 'arcanist', 'armorer', 'engineering', 'metalworking', 'sappers', 'writing']) assert.ok(ids.includes(id), id)
  assert.ok(CRAFT_CATEGORIES.every((c) => c.icon))
})

test('a recipe fills in defaults and keeps what it was given', () => {
  const recipe = normalizeRecipe({ id: 'r1', category: 'alchemy', bonus: { level: 3 } })
  assert.equal(recipe.id, 'r1')
  assert.equal(recipe.bonus.kind, 'other')
  assert.equal(recipe.visibility, 'known')
  assert.deepEqual(recipe.ingredients, [])
  assert.equal(recipe.output.quantity, 1)
  assert.equal(normalizeRecipe({}).id.length > 0, true)
})

test('difficulty is 10 plus the bonus level times 2, 4 or 6 by kind, unless the GM sets one', () => {
  assert.equal(craftDifficulty(normalizeRecipe({ bonus: { level: 2, kind: 'stat' } })), 14)
  assert.equal(craftDifficulty(normalizeRecipe({ bonus: { level: 2, kind: 'active' } })), 18)
  assert.equal(craftDifficulty(normalizeRecipe({ bonus: { level: 2, kind: 'passive' } })), 22)
  assert.equal(craftDifficulty(normalizeRecipe({ bonus: { level: 3, kind: 'other' } })), 22)
  assert.equal(craftDifficulty(normalizeRecipe({ bonus: { level: 3, kind: 'stat' }, difficulty: 9 })), 9)
  assert.equal(craftDifficulty(normalizeRecipe({ method: 'mundane' })), 10)
})

test('time: an hour per bonus level, size squared hours for mundane work, minutes for mixing; batches add minutes', () => {
  assert.equal(craftMinutes(normalizeRecipe({ bonus: { level: 3 } })), 180)
  assert.equal(craftMinutes(normalizeRecipe({ method: 'mundane', size: 'petite' })), 9 * 60)
  assert.equal(craftMinutes(normalizeRecipe({ method: 'quick', bonus: { level: 10 } })), 10)
  assert.equal(craftMinutes(normalizeRecipe({ bonus: { level: 3 }, batch: true }), 4), 180 + 9)
  assert.equal(craftMinutes(normalizeRecipe({ bonus: { level: 3 }, minutes: 45 })), 45)
  assert.equal(formatMinutes(189), '3h 9m')
  assert.equal(formatMinutes(60), '1h')
  assert.equal(formatMinutes(5), '5m')
})

test('item sizes cost Misc. Junk as the size table says', () => {
  assert.deepEqual(ITEM_SIZES.map((s) => s.junk), [1, 4, 16, 32, 64, 128, 256, 512])
})

test('tables: the lowest tier of the tables a recipe needs is the bonus; a missing or too-small table blocks it', () => {
  const owned = [
    { category: 'alchemy', tier: 4, upgrades: ['Cauldron Attachment'] },
    { category: 'alchemy', tier: 2, upgrades: [] },
    { category: 'sappers', tier: 3, upgrades: [] },
  ]
  assert.deepEqual(tableBonus([], owned), { ok: true, bonus: 0, missing: [] })
  assert.deepEqual(tableBonus([{ category: 'alchemy', tier: 1, upgrades: [] }], owned), { ok: true, bonus: 4, missing: [] })
  assert.deepEqual(tableBonus([{ category: 'alchemy', tier: 1, upgrades: [] }, { category: 'sappers', tier: 1, upgrades: [] }], owned).bonus, 3)
  const upgrade = tableBonus([{ category: 'alchemy', tier: 1, upgrades: ['cauldron attachment'] }], owned)
  assert.equal(upgrade.bonus, 4)
  const missing = tableBonus([{ category: 'writing', tier: 1, upgrades: [] }, { category: 'alchemy', tier: 5, upgrades: [] }], owned)
  assert.equal(missing.ok, false)
  assert.equal(missing.missing.length, 2)
})

test('skills: each required skill needs at least its rank; the best one rolls', () => {
  const skills = new Map([['alchemy', 4], ['fireball', 2]])
  assert.deepEqual(checkSkills([], skills), { ok: true, missing: [], roll: null })
  const ok = checkSkills([{ name: 'Alchemy', rank: 3 }, { name: 'Fireball', rank: 1 }], skills)
  assert.equal(ok.ok, true)
  assert.equal(ok.roll, 'Alchemy')
  const short = checkSkills([{ name: 'Alchemy', rank: 5 }], skills)
  assert.equal(short.ok, false)
  assert.deepEqual(short.missing, [{ name: 'Alchemy', rank: 5, have: 4 }])
})

test('ingredients match by source, then name, then tag, and take from stacks in order', () => {
  const items = [
    { id: 'a', name: 'Misc. Junk', type: 'material', quantity: 3, sourceId: 'Compendium.x.Item.junk', tags: [] },
    { id: 'b', name: 'misc. junk', type: 'material', quantity: 5, tags: [] },
    { id: 'c', name: 'Troll Blood', type: 'material', quantity: 1, tags: ['monster part'], liquid: true },
    { id: 'd', name: 'Goblin Ear', type: 'material', quantity: 2, tags: ['Monster Part'] },
  ]
  const rows = matchIngredients(
    [
      { name: 'Misc. Junk', uuid: 'Compendium.x.Item.junk', quantity: 4 },
      { name: '', tag: 'monster part', quantity: 2 },
    ],
    items,
    1,
  )
  assert.equal(rows[0].ok, true)
  assert.deepEqual(rows[0].takes, [{ id: 'a', quantity: 3 }, { id: 'b', quantity: 1 }])
  assert.equal(rows[1].have, 3)
  assert.deepEqual(rows[1].takes, [{ id: 'c', quantity: 1, liquid: true }, { id: 'd', quantity: 1 }])
  const batch = matchIngredients([{ name: 'Goblin Ear', quantity: 1 }], items, 3)
  assert.equal(batch[0].need, 3)
  assert.equal(batch[0].ok, false)
})

test('an ingredient already taken by an earlier row is not counted twice', () => {
  const items = [{ id: 'a', name: 'Bone', type: 'material', quantity: 2, tags: ['bone'] }]
  const rows = matchIngredients([{ name: 'Bone', quantity: 2 }, { tag: 'bone', quantity: 1 }], items, 1)
  assert.equal(rows[0].ok, true)
  assert.equal(rows[1].ok, false)
})

test('salvage by how much the check missed: 1–2 all back, 3–9 half (down), 10+ nothing; liquids and mixes never', () => {
  const takes = [
    { id: 'a', quantity: 5 },
    { id: 'c', quantity: 2, liquid: true },
  ]
  assert.deepEqual(salvageReturns(2, takes, 'standard'), [{ id: 'a', quantity: 5 }])
  assert.deepEqual(salvageReturns(5, takes, 'standard'), [{ id: 'a', quantity: 2 }])
  assert.deepEqual(salvageReturns(10, takes, 'standard'), [])
  assert.deepEqual(salvageReturns(1, takes, 'quick'), [])
  assert.deepEqual(salvageReturns(0, takes, 'standard'), [])
})

test('unlock conditions: items, skills, level, floor, tables and learned recipes; all or any', () => {
  const c = ctx({
    items: [{ id: 'a', name: 'Alchemy Table', type: 'craftingTable', quantity: 1, table: { category: 'alchemy', tier: 3, upgrades: [] } }],
    skills: new Map([['alchemy', 5]]),
    level: 6,
    floor: 4,
    learned: new Set(['Item.x#r1']),
  })
  assert.equal(unlockMet({ mode: 'all', conditions: [] }, c, 'Item.x#r9'), true)
  assert.equal(unlockMet({ mode: 'all', conditions: [{ type: 'item', name: 'alchemy table' }] }, c, 'k'), true)
  assert.equal(unlockMet({ mode: 'all', conditions: [{ type: 'skill', name: 'Alchemy', value: 6 }] }, c, 'k'), false)
  assert.equal(unlockMet({ mode: 'any', conditions: [{ type: 'skill', name: 'Alchemy', value: 6 }, { type: 'level', value: 5 }] }, c, 'k'), true)
  assert.equal(unlockMet({ mode: 'all', conditions: [{ type: 'floor', value: 4 }, { type: 'table', name: 'alchemy', value: 3 }] }, c, 'k'), true)
  assert.equal(unlockMet({ mode: 'all', conditions: [{ type: 'learned' }] }, c, 'Item.x#r1'), true)
  assert.equal(unlockMet({ mode: 'all', conditions: [{ type: 'learned' }] }, c, 'Item.x#r2'), false)
})

test('a learned recipe is always unlocked, even if its conditions are not met', () => {
  const recipe = normalizeRecipe({ id: 'r1', visibility: 'hidden', unlock: { mode: 'all', conditions: [{ type: 'level', value: 20 }] } })
  const state = recipeState(recipe, 'Item.x#r1', ctx({ learned: new Set(['Item.x#r1']) }))
  assert.equal(state.unlocked, true)
})

test('recipe visibility: known shows, hidden shows locked until unlocked, secret stays out of sight', () => {
  const known = recipeState(normalizeRecipe({ visibility: 'known' }), 'k', ctx())
  assert.deepEqual([known.visible, known.unlocked], [true, true])
  const lockedHint = normalizeRecipe({ visibility: 'hidden', unlock: { mode: 'all', conditions: [{ type: 'level', value: 3 }] } })
  assert.deepEqual([recipeState(lockedHint, 'k', ctx()).visible, recipeState(lockedHint, 'k', ctx()).unlocked], [true, false])
  assert.equal(recipeState(lockedHint, 'k', ctx({ level: 3 })).unlocked, true)
  const secret = normalizeRecipe({ visibility: 'secret', unlock: { mode: 'all', conditions: [{ type: 'level', value: 3 }] } })
  assert.equal(recipeState(secret, 'k', ctx()).visible, false)
  assert.equal(recipeState(secret, 'k', ctx({ level: 3 })).visible, true)
  assert.equal(recipeState(secret, 'k', ctx(), true).visible, true, 'the GM sees everything')
})

test('recipe keys pair the output item with the recipe', () => {
  assert.equal(recipeKey('Item.abc', 'r1'), 'Item.abc#r1')
})

test('approval: always auto, always the GM, or auto only for the listed types, tags and rarities', () => {
  const potion = { type: 'consumable', tags: ['Potion'], rarity: 'common' }
  const sword = { type: 'weapon', tags: [], rarity: 'rare' }
  assert.equal(autoApproved('auto', {}, potion), true)
  assert.equal(autoApproved('gm', {}, potion), false)
  const rules = { types: ['consumable'], tags: [], rarities: [] }
  assert.equal(autoApproved('mixed', rules, potion), true)
  assert.equal(autoApproved('mixed', rules, sword), false)
  assert.equal(autoApproved('mixed', { types: [], tags: ['potion'], rarities: [] }, potion), true)
  assert.equal(autoApproved('mixed', { types: [], tags: [], rarities: ['rare'] }, sword), true)
  assert.equal(autoApproved('mixed', { types: [], tags: [], rarities: [] }, sword), false)
})

test('a recipe can override the world setting either way', () => {
  assert.equal(autoApproved('gm', {}, { type: 'loot', tags: [] }, 'auto'), true)
  assert.equal(autoApproved('auto', {}, { type: 'loot', tags: [] }, 'gm'), false)
})
