/**
 * Personal Space upgrades that change crafting (rules/personal-space.ts craftOf), read by actors/crafting.ts while the
 * crawler is in their space:
 * - Attachments on a table whose kind the recipe needs: `speed` cuts the time, `batchHalf` halves extra batch copies'
 *   time, `reroll` rerolls a failed check once per floor (for the table kinds it names).
 * - Upgrades with `tierBoost`: once a day, the first project it helps treats the space tables it needs that many tiers
 *   higher (to Tier 10).
 * Daily and per-floor uses are kept on the crawler (flags.crawlspace.spaceCrafting).
 */
import { craftOf, namesIn, spaceCraftMinutes, worldDay } from '../rules/personal-space'
import { craftMinutes, type Recipe } from '../rules/crafting'
import { currentSpace } from './personal-space'

const USED = 'spaceCrafting'
const low = (value: unknown) => String(value ?? '').trim().toLowerCase()

type Used = { boostDay?: number; rerolls?: Record<string, number> }
const usedOf = (crawler: any): Used => crawler?.getFlag('crawlspace', USED) ?? {}
const floorOf = (crawler: any) => Math.floor(Number(crawler?.system?.details?.floor) || 0)

/** The space's craft upgrades for this recipe, or null outside a space or when none apply. */
export function spaceCraft(crawler: any, recipe: Recipe, count: number) {
  const space = currentSpace(crawler)
  if (!space) return null
  const kinds = new Set(recipe.tables.map((need) => low(need.category)))
  const upgrades = space.items.filter((item: any) => item.type === 'spaceUpgrade' && item.system.installed)
  // An attachment helps when it sits on a space table of a kind the recipe needs.
  const onNeededTable = (item: any) => {
    const table = item.system.attachedTo ? space.items.get(item.system.attachedTo) : null
    return !!table && table.type === 'craftingTable' && !table.system.broken && kinds.has(low(table.system.category))
  }
  const attached = upgrades.filter(onNeededTable)
  const speed = attached.filter((item: any) => craftOf(item.system.craft).speed > 0)
  const batch = recipe.batch && count > 1 ? attached.filter((item: any) => craftOf(item.system.craft).batchHalf) : []
  const rerollers = attached.filter((item: any) => {
    const table = space.items.get(item.system.attachedTo)
    return namesIn(craftOf(item.system.craft).reroll).includes(low(table?.system.category))
  })
  const used = usedOf(crawler)
  const boosters = recipe.tables.length && used.boostDay !== worldDay(game.time.worldTime) ? upgrades.filter((item: any) => craftOf(item.system.craft).tierBoost > 0) : []
  const floor = floorOf(crawler)
  const reroll = rerollers.find((item: any) => used.rerolls?.[item.id] !== floor) ?? null
  const base = craftMinutes(recipe, 1)
  const extra = craftMinutes(recipe, count) - base
  const minutes = spaceCraftMinutes(base, extra, { speed: Math.max(0, ...speed.map((item: any) => craftOf(item.system.craft).speed)), batchHalf: batch.length > 0 })
  return {
    space,
    minutes,
    timeSources: [...speed, ...batch].map((item: any) => item.name),
    boost: Math.max(0, ...boosters.map((item: any) => craftOf(item.system.craft).tierBoost)),
    boostSources: boosters.map((item: any) => item.name),
    reroll,
  }
}

/** The space's tables raised by the day's boost (the crawler's own and found tables unchanged). */
export const boostedTables = (tables: any[], boost: number) => tables.map((table) => (table.space && boost ? { ...table, tier: Math.min(10, table.tier + boost) } : table))

export async function markBoostUsed(crawler: any) {
  await crawler.setFlag('crawlspace', USED, { ...usedOf(crawler), boostDay: worldDay(game.time.worldTime) })
}

export async function markRerollUsed(crawler: any, upgrade: any) {
  const used = usedOf(crawler)
  await crawler.setFlag('crawlspace', USED, { ...used, rerolls: { ...(used.rerolls ?? {}), [upgrade.id]: floorOf(crawler) } })
}
