/**
 * Reward tables in Foundry (homebrew; rules/reward-tables.ts has the tables). With the `rewardTables` world setting on:
 * - a box whose type and tier the sheet covers rolls a d100 on its table, and the row becomes items here;
 * - the sheet's Weak, Medium and Rare spell lists decide which spells each box tier can give (the generator too);
 * - the sheet's "100 random items" join the generator's object lists, so boxes make more kinds of things.
 * Changing the setting reloads the world.
 */
import { createInventoryItem } from '../crawlspace-shared/shared/contentModels'
import { objectPools, type LootCategory, type LootTier, type LootType } from '../crawlspace-shared/shared/lootData'
import { generateLootEntry, goldAllowed, type LootContext } from '../crawlspace-shared/shared/lootGenerator'
import { generateLootItem } from '../crawlspace-shared/shared/lootItemGenerator'
import { setSpellRarityOverride, spellKey, spellRarities, spellRarity } from '../crawlspace-shared/shared/lootSpells'
import type { InventoryItem } from '../crawlspace-shared/shared/inventoryItems'
import { RANDOM_ITEMS } from '../rules/reward-lists'
import {
  allExplosives,
  clothingSlot,
  isRangedWeapon,
  randomWeapon,
  rewardRow,
  rewardTable,
  rollCount,
  sheetSpellRarities,
  spellPool,
  tierForRolls,
  d,
  type RewardRow,
} from '../rules/reward-tables'
import { foundryItemData, inventoryFromFoundry } from './database'

export const rewardTablesOn = () => game.settings.get('crawlspace', 'rewardTables') !== false

export type RewardContents = { gold: number; items: InventoryItem[]; note: string }

const TIERS: LootTier[] = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Legendary', 'Celestial']
const esc = (text: unknown) => foundry.utils.escapeHTML(String(text ?? ''))

/** Skills a "+X Any Crafting Skill" potion can name. */
const CRAFTING_SKILLS = ['Alchemy', 'Backfire', 'Calligraphy', 'Cooking', 'Engineering', 'Fabricate', 'Gear Head', 'Infusion', 'Repair', 'Salvage', 'Scutelliphily', 'Tattoo Artistry', 'Trap Engineer']

/** Item uuids by lowercase name: world items first, then every Item compendium. Cached for a minute. */
let names: { at: number; map: Map<string, string> } | null = null
async function itemNamed(name: string): Promise<any | null> {
  if (!names || Date.now() - names.at > 60_000) {
    const map = new Map<string, string>()
    for (const pack of game.packs) {
      if (pack.documentName !== 'Item') continue
      for (const entry of await pack.getIndex()) if (entry.type !== 'lootBox') map.set(String(entry.name).toLowerCase(), entry.uuid)
    }
    for (const item of game.items) if (item.type !== 'lootBox') map.set(item.name.toLowerCase(), item.uuid)
    names = { at: Date.now(), map }
  }
  const uuid = names.map.get(name.toLowerCase())
  return uuid ? await fromUuid(uuid) : null
}

/** A box item that is plain Foundry data. */
function plainItem(name: string, quantity: number, data: Record<string, any>): InventoryItem {
  return { ...createInventoryItem(), id: foundry.utils.randomID(), name, quantity: String(quantity), expanded: false, foundry: { name, img: 'icons/svg/item-bag.svg', ...data } } as any
}

/** A named reward: the world's or a compendium's item of that name when there is one, else a simple item. */
async function namedItem(row: Extract<RewardRow, { kind: 'named' }>, quantity: number): Promise<InventoryItem> {
  const found = await itemNamed(row.name)
  if (found) return { ...inventoryFromFoundry(found), quantity: String(quantity) }
  const item = row.item
  const description = row.note ? `<p>${esc(row.note)}</p>` : ''
  const system: Record<string, any> = { description, quantity }
  if (item.type === 'consumable') Object.assign(system, { consumableType: item.consumableType ?? 'other', damage: { formula: item.damage ?? '', types: [] } })
  if (item.type === 'equipment') Object.assign(system, { slot: item.slot ?? 'torso', armorDr: item.armorDr ?? 0 })
  return plainItem(row.name, quantity, { type: item.type, system })
}

/** A generator entry as plain Foundry data, so DR (or a name) can be changed before it reaches the actor. */
function patched(entry: InventoryItem, change: (data: any) => void): InventoryItem {
  const data = foundryItemData(entry as any)
  change(data)
  return { ...entry, name: data.name, foundry: data } as any
}

/** "Magic Item (Two rolls)" and its kin: our generator, with as many property rolls as the row says. */
function gearItem(row: Extract<RewardRow, { kind: 'gear' }>, type: LootType, context: LootContext): InventoryItem {
  const pools = objectPools
  const pick = (category: LootCategory, test: (object: (typeof pools)[LootCategory][number]) => boolean) => ({ category, objects: pools[category].filter(test) })
  const focus =
    row.gear === 'weapon'
      ? pick('Mundane / Weapon', (object) => object.type === 'weapon')
      : row.gear === 'armor'
        ? pick('Clothing', () => true)
        : row.gear === 'pet'
          ? pick('Accessory', (object) => /\bpet\b/.test(object.tags))
          : row.gear === 'tools'
            ? pick('Mundane / Weapon', (object) => /crafting|mechanic|tools/.test(object.tags))
            : pick((['Mundane / Weapon', 'Clothing', 'Accessory'] as const)[d(3) - 1], () => true)
  const tier = tierForRolls(row.rolls)
  const entry = generateLootEntry({ tier, type, mode: 'Random', items: 1, consumables: 0, potions: 0, choices: [], focus: focus.objects.length ? focus : { category: focus.category } }, context, 'item', 0).item
  if (!row.dr && row.gear !== 'pet') return entry
  return patched(entry, (data) => {
    if (row.dr) data.system.armorDr = Math.max(Number(data.system.armorDr) || 0, row.dr)
    if (row.gear === 'pet') data.name = `${data.name} (for a pet)`
  })
}

/** The lowest box tier at or above this one whose scrolls or tomes may hold a spell of this rarity. */
function spellTier(boxTier: LootTier, usage: 'scroll' | 'tome', rarity: string): LootTier {
  const start = Math.max(0, TIERS.indexOf(boxTier))
  return TIERS.slice(start).find((tier) => spellRarities(tier, usage).includes(rarity as any)) ?? 'Legendary'
}

/** A scroll or tome holding a spell from the sheet's list for this row. */
function spellItem(row: Extract<RewardRow, { kind: 'spell' }>, tier: LootTier, context: LootContext): InventoryItem {
  const known = new Set(context.spells.map((spell) => spellKey(spell.name)))
  const pool = spellPool(row.rarity, row.focus).filter((name) => known.has(spellKey(name)))
  const kind = row.usage === 'tome' ? 'Tome' : 'Scroll'
  if (pool.length) {
    const name = pool[d(pool.length) - 1]
    const spell = context.spells.find((entry) => spellKey(entry.name) === spellKey(name))!
    try {
      return generateLootItem({ tier: spellTier(tier, row.usage, spellRarity(spell.name) ?? 'Weak'), kind, subtype: spell.name }, context).item
    } catch {
      /* No database scroll or tome can carry it: the GM gets a note instead. */
    }
  }
  const choices = spellPool(row.rarity, row.focus).join(', ')
  return plainItem(`${kind} (${row.label.replace(/^\d+(?:d\d+)?x? /, '')})`, 1, {
    type: 'consumable',
    system: { consumableType: row.usage === 'scroll' ? 'scroll' : 'other', description: `<p>${esc(game.i18n.format('CRAWLSPACE.Rewards.PickSpell', { spells: choices }))}</p>` },
  })
}

/** A skill potion for the row's skill (or a random or crafting one). */
function skillPotion(row: Extract<RewardRow, { kind: 'skillPotion' }>, context: LootContext): InventoryItem {
  const choices = row.skills?.[0] === 'crafting' ? CRAFTING_SKILLS : row.skills
  const skill = choices ? choices[d(choices.length) - 1] : ''
  const tier: LootTier = row.ranks >= 5 ? 'Legendary' : row.ranks >= 3 ? 'Platinum' : row.ranks >= 2 ? 'Gold' : 'Silver'
  const potion = generateLootItem({ tier, kind: 'Skill Potion', subtype: skill }, context).item
  // The skill goes in the name, so potions for different skills don't stack into one.
  return skill ? patched(potion, (data) => (data.name = `Potion of +${row.ranks} ${skill}`)) : potion
}

/** The items one row gives. `rows` is its whole table, for "All, except 1". */
async function rowItems(row: RewardRow, rows: RewardRow[], tier: LootTier, type: LootType, context: LootContext, depth = 0): Promise<{ gold: number; items: InventoryItem[] }> {
  const items: InventoryItem[] = []
  let gold = 0
  switch (row.kind) {
    case 'gold':
      gold = rollCount(row.count) * row.times
      break
    case 'junk':
      items.push(plainItem(game.i18n.localize('CRAWLSPACE.Rewards.Junk'), rollCount(row.count) * row.times, { type: 'loot', system: {} }))
      break
    case 'named':
      items.push(await namedItem(row, rollCount(row.count)))
      break
    case 'allExplosives':
      for (const explosive of allExplosives()) if (explosive.kind === 'named') items.push(await namedItem(explosive, rollCount(row.count)))
      break
    case 'gear':
      items.push(gearItem(row, type, context))
      break
    case 'spell':
      for (let count = rollCount(row.count); count > 0; count--) items.push(spellItem(row, tier, context))
      break
    case 'skillPotion':
      items.push(skillPotion(row, context))
      break
    case 'randomWeapon': {
      const name = randomWeapon(row.dex)
      const found = await itemNamed(name)
      items.push(found ? inventoryFromFoundry(found) : plainItem(name, 1, { type: 'weapon', system: { weaponType: isRangedWeapon(name) ? 'ranged' : 'melee' } }))
      break
    }
    case 'box':
      items.push(plainItem(game.i18n.format('CRAWLSPACE.Rewards.Box', { tier: row.tier, type: row.type }), 1, { type: 'lootBox', img: 'icons/containers/chest/chest-reinforced-steel-red.webp', system: { tier: row.tier, boxType: row.type, sealed: true } }))
      break
    case 'allExcept':
      // Every other row of the table, except the first (the "1" in "All, except 1").
      if (depth) break
      for (const other of rows) {
        if (other === row || other.range[0] === 1) continue
        const result = await rowItems(other, rows, tier, type, context, depth + 1)
        gold += result.gold
        items.push(...result.items)
      }
      break
    case 'unique':
      items.push(plainItem(game.i18n.localize('CRAWLSPACE.Rewards.Unique'), 1, { type: 'loot', system: { description: `<p>${esc(game.i18n.localize('CRAWLSPACE.Rewards.UniqueHint'))}</p>` } }))
      break
  }
  return { gold, items }
}

/**
 * One box's contents from its reward table, or null when the setting is off or the sheet has no table for it. Gold
 * keeps the house rule (Floors 2-18 only): a gold row on another floor rolls again.
 */
export async function rewardContents(tier: LootTier, type: LootType, context: LootContext): Promise<RewardContents | null> {
  if (!rewardTablesOn()) return null
  const rows = rewardTable(type, tier)
  if (!rows) return null
  let roll = d(100)
  let row = rewardRow(rows, roll)
  for (let tries = 0; row.kind === 'gold' && !goldAllowed(tier, context.floor, type) && tries < 20; tries++) row = rewardRow(rows, (roll = d(100)))
  const { gold, items } = await rowItems(row, rows, tier, type, context)
  return { gold: goldAllowed(tier, context.floor, type) ? gold : 0, items, note: game.i18n.format('CRAWLSPACE.Rewards.Rolled', { roll, label: row.label }) }
}

/** The sheet's "100 random items" join the generator's object lists (once). */
let extended = false
function extendObjectPools() {
  if (extended) return
  extended = true
  const add = (category: LootCategory, name: string, type: 'other' | 'weapon' | 'equipment' | 'tattoos', slot: string, tags: string) => {
    if (!objectPools[category].some((object) => object.name.toLowerCase() === name.toLowerCase())) objectPools[category].push({ name, type, slot, tags })
  }
  for (const name of RANDOM_ITEMS.weapons) add('Mundane / Weapon', name, 'weapon', isRangedWeapon(name) ? 'ranged' : 'melee', 'combat weapon')
  for (const name of RANDOM_ITEMS.common) add('Mundane / Weapon', name, 'other', '', 'adventure')
  for (const name of RANDOM_ITEMS.clothing) add('Clothing', name, 'equipment', clothingSlot(name), 'apparel')
  for (const name of RANDOM_ITEMS.accessories) add('Accessory', name, /tattoo/i.test(name) ? 'tattoos' : 'equipment', 'Accessory', 'apparel')
}

export function registerRewardTables() {
  game.settings.register('crawlspace', 'rewardTables', {
    name: 'CRAWLSPACE.Rewards.Setting',
    hint: 'CRAWLSPACE.Rewards.SettingHint',
    scope: 'world',
    config: true,
    restricted: true,
    type: Boolean,
    default: true,
    requiresReload: true,
  })
  if (!rewardTablesOn()) return
  setSpellRarityOverride(sheetSpellRarities())
  extendObjectPools()
}
