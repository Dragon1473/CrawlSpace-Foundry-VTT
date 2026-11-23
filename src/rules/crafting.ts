/**
 * Crafting rules (Core Rulebook ch. 4, Crafting). Pure module: recipes, difficulty, time, tables, skills,
 * ingredient matching, salvage, unlocks and the GM-approval rule. The crafting window and the GM relay use it.
 */

export type CraftCategory = { id: string; label: string; icon: string; skills: string[] }

/** The common crafting tables and what they make, plus mundane work and tattoos. The GM can add more. */
export const CRAFT_CATEGORIES: CraftCategory[] = [
  { id: 'alchemy', label: 'Alchemy', icon: 'fa-solid fa-flask', skills: ['Alchemy', 'Infusion'] },
  { id: 'arcanist', label: 'Arcanist', icon: 'fa-solid fa-wand-sparkles', skills: ['Arcane'] },
  { id: 'armorer', label: 'Armorer', icon: 'fa-solid fa-shield-halved', skills: ['Smithing'] },
  { id: 'engineering', label: 'Engineering', icon: 'fa-solid fa-gears', skills: ['Engineering'] },
  { id: 'metalworking', label: 'Metalworking', icon: 'fa-solid fa-hammer', skills: ['Smithing'] },
  { id: 'sappers', label: "Sapper's", icon: 'fa-solid fa-bomb', skills: ['Explosives Handling', 'Goblin Explosives', 'Incendiary Device Handling'] },
  { id: 'writing', label: 'Writing', icon: 'fa-solid fa-scroll', skills: ['Calligraphy'] },
  { id: 'tattoo', label: 'Tattoo', icon: 'fa-solid fa-pen-nib', skills: ['Tattoo Artistry'] },
  { id: 'mundane', label: 'Mundane', icon: 'fa-solid fa-screwdriver-wrench', skills: ['Fabricate', 'Engineering'] },
]

/** Size of a crafted thing: the Misc. Junk it takes, and (for mundane work) size × size hours. */
export const ITEM_SIZES = [
  { id: 'tiny', label: 'Tiny', size: 1, junk: 1 },
  { id: 'small', label: 'Small', size: 2, junk: 4 },
  { id: 'petite', label: 'Petite', size: 3, junk: 16 },
  { id: 'medium', label: 'Medium', size: 4, junk: 32 },
  { id: 'large', label: 'Large', size: 5, junk: 64 },
  { id: 'huge', label: 'Huge', size: 6, junk: 128 },
  { id: 'colossal', label: 'Colossal', size: 7, junk: 256 },
  { id: 'gargantuan', label: 'Gargantuan', size: 8, junk: 512 },
] as const

/** Difficulty is 10 + bonus level × this, by what the bonus is. */
export const BONUS_KINDS = { stat: 2, active: 4, passive: 6, other: 4 } as const
export type BonusKind = keyof typeof BONUS_KINDS

/** standard: an hour per bonus level; mundane: size × size hours; quick (concoctions, infusions): a minute per level. */
export const CRAFT_METHODS = ['standard', 'mundane', 'quick'] as const
export type CraftMethod = (typeof CRAFT_METHODS)[number]

export const VISIBILITIES = ['known', 'hidden', 'secret'] as const
export type Visibility = (typeof VISIBILITIES)[number]

export const UNLOCK_TYPES = ['learned', 'item', 'skill', 'level', 'floor', 'table'] as const
export type UnlockCondition = { type: string; name?: string; uuid?: string; value?: number }

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'unique'] as const

export type Ingredient = { name?: string; uuid?: string; img?: string; tag?: string; quantity: number }
export type Tool = { name: string; uuid?: string; img?: string; kind: string }
export type TableNeed = { category: string; tier: number; upgrades: string[] }
export type SkillNeed = { name: string; rank: number }

export type Recipe = {
  id: string
  name: string
  category: string
  method: CraftMethod
  size: string
  bonus: { level: number; kind: BonusKind }
  difficulty: number | null
  minutes: number | null
  advantage: boolean
  batch: boolean
  output: { quantity: number }
  ingredients: Ingredient[]
  tools: Tool[]
  skills: SkillNeed[]
  tables: TableNeed[]
  visibility: Visibility
  hint: string
  unlock: { mode: 'all' | 'any'; conditions: UnlockCondition[] }
  /** '' follows the world setting; 'auto' or 'gm' overrides it for this recipe. */
  approval: '' | 'auto' | 'gm'
}

const int = (value: unknown, fallback = 0, min = -Infinity) => {
  const number = Math.floor(Number(value))
  return Number.isFinite(number) ? Math.max(min, number) : fallback
}
const str = (value: unknown) => String(value ?? '').trim()
const low = (value: unknown) => str(value).toLowerCase()
const pick = <T extends string>(value: unknown, list: readonly T[], fallback: T): T => (list.includes(value as T) ? (value as T) : fallback)

export const randomId = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)

/** A stored recipe with every field present and in range. */
export function normalizeRecipe(raw: any): Recipe {
  const r = raw ?? {}
  const nullableInt = (value: unknown) => (value === null || value === undefined || value === '' ? null : int(value, 0, 0))
  return {
    id: str(r.id) || randomId(),
    name: str(r.name),
    category: str(r.category) || 'mundane',
    method: pick(r.method, CRAFT_METHODS, 'standard'),
    size: pick(r.size, ITEM_SIZES.map((s) => s.id), 'tiny'),
    bonus: { level: int(r.bonus?.level, 0, 0), kind: pick(r.bonus?.kind, Object.keys(BONUS_KINDS) as BonusKind[], 'other') },
    difficulty: nullableInt(r.difficulty),
    minutes: nullableInt(r.minutes),
    advantage: !!r.advantage,
    batch: !!r.batch,
    output: { quantity: int(r.output?.quantity, 1, 1) },
    ingredients: (Array.isArray(r.ingredients) ? r.ingredients : [])
      .map((i: any) => ({ name: str(i?.name), uuid: str(i?.uuid), img: str(i?.img), tag: str(i?.tag), quantity: int(i?.quantity, 1, 1) }))
      .filter((i: Ingredient) => i.name || i.uuid || i.tag),
    tools: (Array.isArray(r.tools) ? r.tools : [])
      .map((t: any) => ({ name: str(t?.name), uuid: str(t?.uuid), img: str(t?.img), kind: str(t?.kind) || 'item' }))
      .filter((t: Tool) => t.name),
    skills: (Array.isArray(r.skills) ? r.skills : []).map((s: any) => ({ name: str(s?.name), rank: int(s?.rank, 0, 0) })).filter((s: SkillNeed) => s.name),
    tables: (Array.isArray(r.tables) ? r.tables : [])
      .map((t: any) => ({ category: str(t?.category), tier: int(t?.tier, 1, 1), upgrades: (Array.isArray(t?.upgrades) ? t.upgrades : String(t?.upgrades ?? '').split(',')).map(str).filter(Boolean) }))
      .filter((t: TableNeed) => t.category),
    visibility: pick(r.visibility, VISIBILITIES, 'known'),
    hint: str(r.hint),
    unlock: {
      mode: r.unlock?.mode === 'any' ? 'any' : 'all',
      conditions: (Array.isArray(r.unlock?.conditions) ? r.unlock.conditions : [])
        .filter((c: any) => UNLOCK_TYPES.includes(c?.type))
        .map((c: any) => ({ type: c.type, name: str(c.name), uuid: str(c.uuid), value: int(c.value, 0, 0) })),
    },
    approval: r.approval === 'auto' || r.approval === 'gm' ? r.approval : '',
  }
}

export const recipeKey = (itemUuid: string, recipeId: string) => `${itemUuid}#${recipeId}`

export function craftDifficulty(recipe: Recipe) {
  if (recipe.difficulty !== null) return recipe.difficulty
  return Math.floor(10 + recipe.bonus.level * BONUS_KINDS[recipe.bonus.kind])
}

export const sizeOf = (id: string) => ITEM_SIZES.find((s) => s.id === id) ?? ITEM_SIZES[0]

/** Minutes to make `count` of it: extra batch copies take a minute per bonus level each. */
export function craftMinutes(recipe: Recipe, count = 1) {
  const extra = recipe.batch ? Math.max(0, Math.floor(count) - 1) * recipe.bonus.level : 0
  if (recipe.minutes !== null) return recipe.minutes + extra
  const base =
    recipe.method === 'mundane' ? sizeOf(recipe.size).size ** 2 * 60 : recipe.method === 'quick' ? recipe.bonus.level : recipe.bonus.level * 60
  return Math.floor(base + extra)
}

export function formatMinutes(minutes: number) {
  const m = Math.max(0, Math.floor(minutes))
  const hours = Math.floor(m / 60)
  const rest = m % 60
  if (!hours) return `${rest}m`
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

export type OwnedTable = { category: string; tier: number; upgrades: string[] }

/** The table bonus is the lowest tier among the tables a recipe needs (each the best one owned that qualifies). */
export function tableBonus(needs: TableNeed[], owned: OwnedTable[]) {
  const missing: TableNeed[] = []
  let bonus: number | null = null
  for (const need of needs) {
    const wanted = need.upgrades.map(low)
    const fits = owned.filter(
      (table) => low(table.category) === low(need.category) && table.tier >= need.tier && wanted.every((u) => table.upgrades.map(low).includes(u)),
    )
    if (!fits.length) {
      missing.push(need)
      continue
    }
    const best = Math.max(...fits.map((table) => Math.floor(table.tier)))
    bonus = bonus === null ? best : Math.min(bonus, best)
  }
  return { ok: !missing.length, bonus: bonus ?? 0, missing }
}

/** Each skill (or spell) a recipe needs, at its rank; the best-ranked of them is the one rolled. */
export function checkSkills(needs: SkillNeed[], skills: Map<string, number>) {
  const missing: (SkillNeed & { have: number })[] = []
  let roll: string | null = null
  let best = -1
  for (const need of needs) {
    const have = skills.get(low(need.name))
    if (have === undefined || have < need.rank) missing.push({ ...need, have: have ?? 0 })
    if (have !== undefined && have > best) {
      best = have
      roll = need.name
    }
  }
  return { ok: !missing.length, missing, roll: needs.length ? roll : null }
}

export type InventoryItem = {
  id: string
  name: string
  type: string
  quantity: number
  uuid?: string
  sourceId?: string
  tags?: string[]
  rarity?: string
  liquid?: boolean
  table?: OwnedTable
}

export type Take = { id: string; quantity: number; liquid?: boolean }

/** Which stacks each ingredient takes, `count` times over. A stack an earlier row used up isn't counted again. */
export function matchIngredients(ingredients: Ingredient[], items: InventoryItem[], count = 1) {
  const left = new Map(items.map((item) => [item.id, Math.max(0, Math.floor(item.quantity))]))
  return ingredients.map((ingredient) => {
    const need = Math.max(1, Math.floor(ingredient.quantity)) * Math.max(1, Math.floor(count))
    const tag = low(ingredient.tag)
    const name = low(ingredient.name)
    const uuid = str(ingredient.uuid)
    let candidates: InventoryItem[]
    if (tag) candidates = items.filter((item) => (item.tags ?? []).some((t) => low(t) === tag))
    else {
      const bySource = uuid ? items.filter((item) => item.sourceId === uuid || item.uuid === uuid) : []
      const byName = name ? items.filter((item) => low(item.name) === name && !bySource.includes(item)) : []
      candidates = [...bySource, ...byName]
    }
    const have = candidates.reduce((sum, item) => sum + (left.get(item.id) ?? 0), 0)
    const takes: Take[] = []
    let still = need
    for (const item of candidates) {
      if (still <= 0) break
      const available = left.get(item.id) ?? 0
      const take = Math.min(available, still)
      if (take <= 0) continue
      takes.push(item.liquid ? { id: item.id, quantity: take, liquid: true } : { id: item.id, quantity: take })
      left.set(item.id, available - take)
      still -= take
    }
    return { ingredient, need, have, ok: still <= 0, takes }
  })
}

/** What comes back from a failed craft, by how much it missed. Liquids and quick mixes never come back. */
export function salvageReturns(missedBy: number, takes: Take[], method: CraftMethod) {
  const miss = Math.floor(missedBy)
  if (miss <= 0 || miss >= 10 || method === 'quick') return []
  return takes
    .filter((take) => !take.liquid)
    .map((take) => ({ id: take.id, quantity: miss <= 2 ? take.quantity : Math.floor(take.quantity / 2) }))
    .filter((take) => take.quantity > 0)
}

export type CraftContext = {
  learned: Set<string>
  items: InventoryItem[]
  skills: Map<string, number>
  level: number
  floor: number
}

function conditionMet(condition: UnlockCondition, ctx: CraftContext, key: string) {
  const value = Math.floor(Number(condition.value) || 0)
  switch (condition.type) {
    case 'learned':
      return ctx.learned.has(key)
    case 'item':
      return ctx.items.some(
        (item) => (condition.uuid && (item.sourceId === condition.uuid || item.uuid === condition.uuid)) || (condition.name && low(item.name) === low(condition.name)),
      )
    case 'skill':
      return (ctx.skills.get(low(condition.name)) ?? -1) >= value
    case 'level':
      return ctx.level >= value
    case 'floor':
      return ctx.floor >= value
    case 'table':
      return ctx.items.some((item) => item.table && low(item.table.category) === low(condition.name) && item.table.tier >= value)
    default:
      return false
  }
}

export function unlockMet(unlock: Recipe['unlock'], ctx: CraftContext, key: string) {
  if (!unlock.conditions.length) return true
  const results = unlock.conditions.map((condition) => conditionMet(condition, ctx, key))
  return unlock.mode === 'any' ? results.some(Boolean) : results.every(Boolean)
}

/**
 * Known recipes are open to everyone. Hidden ones show locked (with the GM's hint) until their conditions are met
 * or the crawler learns them; secret ones stay out of sight until then. The GM sees every recipe.
 */
export function recipeState(recipe: Recipe, key: string, ctx: CraftContext, gm = false) {
  const unlocked =
    recipe.visibility === 'known' || ctx.learned.has(key) || (recipe.unlock.conditions.length > 0 && unlockMet(recipe.unlock, ctx, key))
  return { unlocked, visible: gm || unlocked || recipe.visibility !== 'secret' }
}

export type ApprovalRules = { types?: string[]; tags?: string[]; rarities?: string[] }

/** Whether a craft goes straight through or waits for the GM: the recipe's own choice, then the world setting. */
export function autoApproved(mode: string, rules: ApprovalRules, output: { type: string; tags?: string[]; rarity?: string }, override = '') {
  if (override === 'auto') return true
  if (override === 'gm') return false
  if (mode === 'auto') return true
  if (mode !== 'mixed') return false
  const types = (rules.types ?? []).map(low)
  const tags = (rules.tags ?? []).map(low)
  const rarities = (rules.rarities ?? []).map(low)
  return (
    types.includes(low(output.type)) ||
    (output.tags ?? []).some((tag) => tags.includes(low(tag))) ||
    (!!output.rarity && rarities.includes(low(output.rarity)))
  )
}

/** An item on the experiment bench: what it is (the item it came from, else its name), its tags and how many. */
export type BenchItem = { name: string; source: string; tags?: string[]; quantity: number }

const benchId = (item: { name: string; source: string }) => (str(item.source) || low(item.name)).toLowerCase()

/** The same items in the same amounts give the same signature, in any order (how failed experiments are remembered). */
export function benchSignature(items: { name: string; source: string; quantity: number }[]) {
  return items
    .map((item) => `${benchId(item)}×${Math.max(1, Math.floor(item.quantity))}`)
    .sort()
    .join('|')
}

/** The bench holds a recipe's ingredients, enough of each, and nothing else. Tagged ingredients are matched last. */
export function benchMatches(ingredients: Ingredient[], bench: BenchItem[]) {
  if (!ingredients.length || ingredients.length !== bench.length) return false
  const used = new Set<number>()
  const ordered = [...ingredients].sort((a, b) => Number(!!a.tag) - Number(!!b.tag))
  for (const ingredient of ordered) {
    const need = Math.max(1, Math.floor(ingredient.quantity))
    const fits = (item: BenchItem) =>
      ingredient.tag
        ? (item.tags ?? []).some((tag) => low(tag) === low(ingredient.tag))
        : (!!ingredient.uuid && str(item.source) === ingredient.uuid) || (!!ingredient.name && low(item.name) === low(ingredient.name))
    const index = bench.findIndex((item, i) => !used.has(i) && Math.floor(item.quantity) >= need && fits(item))
    if (index < 0) return false
    used.add(index)
  }
  return true
}
