/**
 * Reward tables (homebrew, the `rewardTables` world setting). A box of a type and tier the community sheet covers
 * rolls a d100 on its table first, and the row decides what is inside: gold, junk, named items, scrolls and tomes from
 * the sheet's spell lists, skill potions, or "Magic Item (Two rolls)", which hands off to our own generator for an
 * item with that many property rolls. Types and tiers the sheet doesn't cover (Celestial, Boss, Quest, ...) keep the
 * procedural generator. Pure module: loot/reward-tables.ts makes the items.
 */
import catalogue from '../crawlspace-shared/shared/lootSpellTiers.json' with { type: 'json' }
import { REWARD_TABLES } from './reward-tables-data.ts'
import { RANDOM_ITEMS, SPELL_LISTS } from './reward-lists.ts'

export type RewardItem = { type: 'consumable' | 'loot' | 'equipment'; consumableType?: string; damage?: string; slot?: string; armorDr?: number }
export type SpellRarityList = 'weak' | 'weakMedium' | 'medium' | 'rare' | 'choice'
export type SpellFocus = 'attack' | 'defensive' | 'healing' | null
export type GearKind = 'item' | 'weapon' | 'armor' | 'pet' | 'tools'

/** One row of a reward table: its d100 range, the sheet's text, and what it gives. */
export type RewardRow = { range: number[]; label: string } & (
  | { kind: 'nothing' | 'allExcept' | 'unique' }
  | { kind: 'gold' | 'junk'; count: string; times: number }
  | { kind: 'box'; tier: string; type: string }
  | { kind: 'gear'; gear: GearKind; rolls: number; dr?: number; flavor?: string }
  | { kind: 'spell'; count: string; rarity: SpellRarityList; focus: SpellFocus; usage: 'scroll' | 'tome' }
  | { kind: 'skillPotion'; ranks: number; skills: string[] | null }
  | { kind: 'randomWeapon'; dex: boolean }
  | { kind: 'allExplosives'; count: string }
  | { kind: 'named'; count: string; name: string; note?: string; item: RewardItem }
)

/** The box tiers the sheet has tables for. */
export const REWARD_TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Legendary'] as const

/** The table for a box type and tier, or null when the sheet has none (the generator fills the box instead). */
export function rewardTable(type: string, tier: string): RewardRow[] | null {
  const rows = REWARD_TABLES[type]?.[tier]
  return rows?.length ? rows : null
}

export const rewardTypes = () => Object.keys(REWARD_TABLES)

/** The row a d100 roll lands on (1-100; out-of-range rolls are clamped). */
export function rewardRow(rows: RewardRow[], roll: number): RewardRow {
  const value = Math.max(1, Math.min(100, Math.floor(roll)))
  return rows.find((row) => value >= row.range[0] && value <= row.range[1]) ?? rows[rows.length - 1]
}

export const d = (sides: number, rng = Math.random) => Math.min(sides, Math.floor(rng() * sides) + 1)

/** "2d4", "1d4+1" or "10", rolled; never below 1. */
export function rollCount(formula: string, rng = Math.random): number {
  const match = /^(\d+)d(\d+)(?:\+(\d+))?$/.exec(String(formula).trim())
  if (!match) return Math.max(1, Math.floor(Number(formula)) || 1)
  let total = Number(match[3] ?? 0)
  for (let die = 0; die < Number(match[1]); die++) total += d(Number(match[2]), rng)
  return Math.max(1, total)
}

/** Rarity names the vendored generator uses for each sheet list. */
const RARITY = { weak: 'Weak', medium: 'Standard', rare: 'Rare' } as const

/** Every listed spell's tier, for setSpellRarityOverride (which spells go in which boxes). */
export function sheetSpellRarities(): Record<string, 'Weak' | 'Standard' | 'Rare'> {
  const rarities: Record<string, 'Weak' | 'Standard' | 'Rare'> = {}
  for (const [list, rarity] of Object.entries(RARITY)) for (const name of SPELL_LISTS[list as keyof typeof RARITY]) rarities[name] = rarity
  return rarities
}

const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')
const spellType = (name: string) => catalogue.find((row) => key(row.name) === key(name))?.type ?? ''
const matchesFocus = (name: string, focus: SpellFocus) =>
  !focus || (focus === 'attack' ? spellType(name) === 'Attack' : focus === 'healing' ? spellType(name) === 'Heal' : !['Attack', 'Heal'].includes(spellType(name)))

/**
 * The spells a scroll or tome of this list and focus can hold. "Weak or Medium" is both lists; "Your Choice" is
 * every list (the crawler picks). A focus with no listed spell falls back to the whole list.
 */
export function spellPool(rarity: SpellRarityList, focus: SpellFocus): string[] {
  const lists = rarity === 'weakMedium' ? ['weak', 'medium'] : rarity === 'choice' ? ['weak', 'medium', 'rare'] : [rarity]
  const names = lists.flatMap((list) => [...SPELL_LISTS[list as keyof typeof RARITY]])
  const focused = names.filter((name) => matchesFocus(name, focus))
  return focused.length ? focused : names
}

/** The vendored generator's box tier that rolls a magic item with this many property rolls. */
export const tierForRolls = (rolls: number) => (['Bronze', 'Silver', 'Gold', 'Platinum', 'Legendary', 'Celestial'] as const)[Math.max(0, Math.min(5, Math.floor(rolls)))]

/** Weapons from "100 random items" good for a Dexterity fighter (light, thrown or ranged). */
const DEX_WEAPON = /dagger|dirk|stiletto|rapier|saber|scimitar|katana|wakizashi|whip|blade|claw|bow|crossbow|javelin|shuriken|kunai|sai|nunchaku|chakram|boomerang|sling|net|gun|pistol|revolver|rifle|carbine|throwing/i
export function randomWeapon(dex: boolean, rng = Math.random): string {
  const pool = dex ? RANDOM_ITEMS.weapons.filter((name) => DEX_WEAPON.test(name)) : [...RANDOM_ITEMS.weapons]
  return pool[d(pool.length, rng) - 1]
}

/** Ranged weapons in "100 random items" (the rest are melee). */
export const isRangedWeapon = (name: string) => /bow|crossbow|sling|gun|pistol|revolver|rifle|carbine|launcher|flamethrower|harpoon/i.test(name) && !/throwing/i.test(name)

/** The equipment slot a "100 random items" clothing piece goes in. */
export function clothingSlot(name: string): string {
  if (/hat|helmet|hood|mask|bandana|turban|beret|crown|tiara/i.test(name)) return 'Head'
  if (/boots|sandals|slippers/i.test(name)) return 'Feet'
  if (/gauntlet|glove/i.test(name)) return 'Hands'
  if (/pauldron|vambrace|bracer|elbow/i.test(name)) return 'Arms'
  if (/pants|trousers|jeans|shorts|skirt|greaves|knee/i.test(name)) return 'Legs'
  return 'Torso'
}

/** The named items the "All explosives and smoke bombs" row gives (every explosive in the Goblin table). */
export function allExplosives(): RewardRow[] {
  const seen = new Map<string, RewardRow>()
  for (const rows of Object.values(REWARD_TABLES.Goblin ?? {}))
    for (const row of rows) if (row.kind === 'named' && row.item.consumableType === 'explosives' && !seen.has(row.name)) seen.set(row.name, row)
  return [...seen.values()]
}
