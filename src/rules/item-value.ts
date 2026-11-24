/**
 * Item gold values and the Determine Value skill (homebrew perks at ranks 1 and 5, the book's at 10 and 15).
 * Players never see a gold number unless the world shows values to them or their Determine Value is rank 15.
 *
 *   rank 1:  the inventory can be sorted by value (without showing it).
 *   rank 5:  an item's History tab: who owned it before and how it was used.
 *   rank 10: which loot box an item came from (or, if none, the kind it would have come from).
 *   rank 15: a new item's gold value shows in a toast.
 *
 * Pure module: no Foundry globals.
 */
import type { LootTier, LootType } from '../crawlspace-shared/shared/lootData.ts'

export const DETERMINE_VALUE = 'Determine Value'
export const VALUE_PERKS = { sort: 1, history: 5, origin: 10, toast: 15 } as const
export type ValuePerk = keyof typeof VALUE_PERKS
/** Ranks 1 and 5 are homebrew; the world setting can turn them off. */
export const HOMEBREW_PERKS: readonly ValuePerk[] = ['sort', 'history']

/** Whether a crawler with this Determine Value rank has the perk. */
export function hasValuePerk(rank: number, perk: ValuePerk, homebrew = true) {
  if (!homebrew && HOMEBREW_PERKS.includes(perk)) return false
  return Math.floor(Number(rank) || 0) >= VALUE_PERKS[perk]
}

/** The rank of the Determine Value skill among an actor's items (0 without it). */
export function determineValueRank(items: Iterable<{ type: string; name: string; system?: any }>) {
  let best = 0
  for (const item of items)
    if (item.type === 'skill' && item.name.trim().toLowerCase() === DETERMINE_VALUE.toLowerCase())
      best = Math.max(best, Math.floor(Number(item.system?.rank?.total ?? item.system?.rank?.value) || 0))
  return best
}

/** An item's gold value for one unit, rounded down, never negative. */
export const unitValue = (system: any) => Math.max(0, Math.floor(Number(system?.goldValue) || 0))

/** Highest value first; ties keep their order (their sheet order). */
export function sortByValue<T extends { system?: any }>(items: T[]) {
  return items
    .map((item, index) => ({ item, index, value: unitValue(item.system) }))
    .sort((a, b) => b.value - a.value || a.index - b.index)
    .map((entry) => entry.item)
}

export type HistoryEntry = {
  kind: 'owner' | 'use' | 'box'
  /** The actor (owner or user), or the box's name. */
  name: string
  uuid?: string
  /** Uses in a row by the same actor count up instead of adding lines. */
  count?: number
  /** Real time (ms) and the world's game time (s). */
  at: number
  worldTime?: number
}

/** How many entries an item keeps; the oldest go first. */
export const HISTORY_LIMIT = 40

/** The history with one more entry: an owner it already has last, or a use by the same actor, isn't repeated. */
export function addHistory(history: HistoryEntry[] | null | undefined, entry: HistoryEntry): HistoryEntry[] {
  const list = Array.isArray(history) ? history.filter((old) => old && typeof old === 'object') : []
  const last = [...list].reverse().find((old) => old.kind === entry.kind)
  if (entry.kind === 'owner') {
    const owner = [...list].reverse().find((old) => old.kind === 'owner')
    if (owner && sameActor(owner, entry)) return list
  }
  if (entry.kind === 'use' && list.length && list[list.length - 1] === last && last && sameActor(last, entry)) {
    const merged = { ...last, count: (Math.floor(Number(last.count) || 1)) + 1, at: entry.at, worldTime: entry.worldTime }
    return [...list.slice(0, -1), merged]
  }
  return [...list, entry].slice(-HISTORY_LIMIT)
}

const sameActor = (a: HistoryEntry, b: HistoryEntry) => (a.uuid && b.uuid ? a.uuid === b.uuid : a.name === b.name)

/** Everyone who owned the item before its current owner, oldest first, each once. */
export function formerOwners(history: HistoryEntry[] | null | undefined, current?: { name: string; uuid?: string }) {
  const owners = (history ?? []).filter((entry) => entry?.kind === 'owner')
  const former = current && owners.length && sameActor(owners[owners.length - 1], { kind: 'owner', at: 0, ...current }) ? owners.slice(0, -1) : owners
  const seen = new Set<string>()
  return former.filter((entry) => {
    const key = entry.uuid || entry.name
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Total uses recorded. */
export const usesIn = (history: HistoryEntry[] | null | undefined) =>
  (history ?? []).filter((entry) => entry?.kind === 'use').reduce((sum, entry) => sum + Math.max(1, Math.floor(Number(entry.count) || 1)), 0)

export type BoxOrigin = { tier: string; type: string; name?: string }

/**
 * The most gold a box of each tier can hold (lootData.ts tierRules: 1d10, 1d10 × 100, 1d6 × 1,000, 2d6 × 1,000,
 * 1d10 × 10,000), lowest tier first: a value up to it reads as that tier.
 */
export const TIER_CEILINGS: [LootTier, number][] = [
  ['Bronze', 10],
  ['Silver', 1000],
  ['Gold', 6000],
  ['Platinum', 12000],
  ['Legendary', 100000],
]

const RARITY_TIERS: Record<string, LootTier> = { common: 'Bronze', uncommon: 'Silver', rare: 'Gold', epic: 'Platinum', legendary: 'Legendary', unique: 'Celestial' }

/** The tier an item's value (or, without one, its rarity) suggests. */
export function likelyTier(item: { system?: any }): LootTier {
  const value = unitValue(item.system)
  if (value > 0) return (TIER_CEILINGS.find(([, ceiling]) => value <= ceiling) ?? TIER_CEILINGS[TIER_CEILINGS.length - 1])[0]
  return RARITY_TIERS[String(item.system?.rarity ?? '').toLowerCase()] ?? 'Bronze'
}

/** Words that point at a box type, beyond the generator's themes. */
const TYPE_WORDS: Partial<Record<LootType, string[]>> = {
  Weapon: ['sword', 'axe', 'gun', 'blade', 'bow', 'spear', 'mace', 'hammer', 'rifle', 'pistol', 'knife', 'club'],
  Apparel: ['armor', 'armour', 'helmet', 'boots', 'gloves', 'cloak', 'shirt', 'hat', 'pants', 'jacket', 'shield', 'robe'],
  "Survivor's": ['potion', 'bandage', 'heal', 'ration', 'food', 'water', 'medkit'],
  "Crafter's": ['material', 'ingot', 'ore', 'leather', 'cloth', 'thread', 'tool', 'kit'],
  Goblin: ['bomb', 'explosive', 'grenade', 'dynamite', 'fuse'],
  "Assassin's": ['poison', 'dagger', 'garrote', 'toxin'],
  "Mechanic's": ['wrench', 'gear', 'engine', 'battery', 'circuit', 'motor'],
  Pet: ['collar', 'leash', 'treat', 'pet'],
  "Asshole's": ['tattoo', 'stamp', 'embarrassing'],
  Looter: ['bag', 'pouch', 'sack', 'backpack', 'gem', 'coin', 'treasure'],
}

/** A first guess by item type, when no words match. */
const TYPE_DEFAULTS: Record<string, LootType> = {
  weapon: 'Weapon',
  equipment: 'Apparel',
  consumable: "Survivor's",
  material: "Crafter's",
  tattoo: "Asshole's",
  loot: 'Looter',
  craftingTable: "Crafter's",
}

/**
 * The kind of loot box an item would have come from: the type whose themes and words best match its name, tags and
 * kind, or the type's usual box. Only a guess; a recorded origin beats it.
 */
export function likelyBox(item: { name: string; type: string; system?: any }): BoxOrigin {
  const words = [item.name, ...(Array.isArray(item.system?.tags) ? item.system.tags : []), item.system?.consumableType, item.system?.weaponType, item.system?.slot]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  let best: LootType | null = null
  let bestScore = 0
  for (const [type, terms] of Object.entries(TYPE_WORDS) as [LootType, string[]][]) {
    let score = terms.filter((term) => words.includes(term)).length * 2
    if (item.type === 'weapon' && type === 'Weapon') score += 1
    if (item.type === 'equipment' && type === 'Apparel') score += 1
    if (score > bestScore) {
      best = type
      bestScore = score
    }
  }
  return { tier: likelyTier(item), type: best ?? TYPE_DEFAULTS[item.type] ?? 'Adventurer' }
}

/** "Gold Weapon Box": how an origin reads. */
export const boxLabel = (origin: BoxOrigin) => `${origin.tier} ${origin.type}`
