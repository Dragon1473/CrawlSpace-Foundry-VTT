/**
 * Personal Spaces (homebrew, from the GM's Personal Space toolkit): a crawler's base reached from a saferoom. A space
 * is its own actor (type `personalSpace`) holding its upgrades (`spaceUpgrade` items) and crafting tables
 * (`craftingTable` items). Pure module: levels, the benefits of installed upgrades, ownership when a crawler leaves,
 * conjoining costs and reading the old character-sheet fields for the migration.
 */

export const SPACE_LEVELS = [1, 2, 3, 4, 5] as const

/** Suggested price to reach each level, and how many crafting tables fit (level 1 fits five; the rest is a GM guide). */
export const LEVEL_INFO: Record<number, { price: number; tables: number }> = {
  1: { price: 50000, tables: 5 },
  2: { price: 100000, tables: 5 },
  3: { price: 250000, tables: 8 },
  4: { price: 500000, tables: 10 },
  5: { price: 1000000, tables: 12 },
}

/** Each union of two spaces costs this much. */
export const CONJOIN_COST = 5000

export const UPGRADE_KINDS = ['upgrade', 'attachment', 'level', 'tableUpgrade', 'guild', 'coupon', 'feature'] as const
export type UpgradeKind = (typeof UPGRADE_KINDS)[number]

export const MEMBER_ROLES = ['owner', 'member', 'guest'] as const
export type MemberRole = (typeof MEMBER_ROLES)[number]
export type Member = { uuid: string; role: MemberRole }

/** What an installed upgrade changes while a crawler is in the space. Zero (or null) leaves the rule alone. */
export type UpgradeAutomation = {
  /** A Long Rest here takes this many hours instead of 8 (0: it is instant). */
  longRestHours: number | null
  /** A Long Rest here also grants Good Sleep for this many hours. */
  goodSleepHours: number
  /** A Short Rest here heals this many extra Health Bar slots. */
  shortRestSlots: number
  /** Once a day, one grinding hour here counts as this many. */
  trainingHours: number
}

export type UpgradeLike = { name: string; installed?: boolean; kind?: string; owner?: string; rest?: Partial<UpgradeAutomation>; training?: { hours?: number } }

export type SpaceBenefits = UpgradeAutomation & { sources: Record<keyof UpgradeAutomation, string[]> }

const whole = (value: unknown, min = 0) => {
  const number = Math.floor(Number(value))
  return Number.isFinite(number) ? Math.max(min, number) : min
}

/**
 * The benefits of every installed upgrade. They don't stack: the shortest Long Rest, the longest Good Sleep, the most
 * Short Rest slots and the best training hour win, each named with the upgrades that gave it.
 */
export function spaceBenefits(upgrades: UpgradeLike[]): SpaceBenefits {
  const out: SpaceBenefits = {
    longRestHours: null,
    goodSleepHours: 0,
    shortRestSlots: 0,
    trainingHours: 0,
    sources: { longRestHours: [], goodSleepHours: [], shortRestSlots: [], trainingHours: [] },
  }
  const better = (key: Exclude<keyof UpgradeAutomation, 'longRestHours'>, value: number, name: string) => {
    if (value <= 0 || value < out[key]) return
    if (value > out[key]) out.sources[key] = []
    out[key] = value
    out.sources[key].push(name)
  }
  for (const upgrade of upgrades) {
    if (upgrade.installed === false) continue
    const rest = upgrade.rest ?? {}
    const raw = rest.longRestHours
    if (raw !== null && raw !== undefined && String(raw) !== '' && Number.isFinite(Number(raw))) {
      const hours = Math.min(8, whole(raw))
      if (hours < 8 && (out.longRestHours === null || hours <= out.longRestHours)) {
        if (out.longRestHours === null || hours < out.longRestHours) out.sources.longRestHours = []
        out.longRestHours = hours
        out.sources.longRestHours.push(upgrade.name)
      }
    }
    better('goodSleepHours', whole(rest.goodSleepHours), upgrade.name)
    better('shortRestSlots', whole(rest.shortRestSlots), upgrade.name)
    better('trainingHours', whole(upgrade.training?.hours), upgrade.name)
  }
  return out
}

/** Hours a Long Rest takes for these crawlers together: the slowest of them sets the pace. */
export function partyLongRestHours(perCrawler: (number | null)[]) {
  if (!perCrawler.length) return 8
  return Math.max(...perCrawler.map((hours) => (hours === null ? 8 : Math.min(8, whole(hours)))))
}

/** Health after a Short Rest's extra slots (10 Health a slot, capped at the bar's 110). */
export function extraSlotsHealth(health: number, slots: number, maximum = 110) {
  return Math.min(maximum, Math.floor(Number(health) || 0) + whole(slots) * 10)
}

/**
 * Bonus grinding hours from a training upgrade: once a day the session's first hour counts as `trainingHours`, so
 * it adds that minus one, and only when that hour was productive.
 */
export function trainingBonus(trainingHours: number, productiveHours: number, usedToday: boolean) {
  if (usedToday || productiveHours < 1) return 0
  return Math.max(0, whole(trainingHours) - 1)
}

/**
 * A space's table on reaching a new floor: one tier per floor past the floor it last counted (to Tier 10). Null when
 * nothing changes; with no floor counted yet it only starts counting from this one.
 */
export function tableLevelUp(tier: number, lastFloor: number | null, now: number) {
  const floor = whole(now)
  if (!floor) return null
  if (lastFloor === null) return { tier: Math.min(10, Math.max(1, whole(tier, 1))), floor }
  const gained = floor - whole(lastFloor)
  if (gained <= 0) return null
  return { tier: Math.min(10, Math.max(1, whole(tier, 1)) + gained), floor }
}

/** Unions a conjoined space has paid for: one fewer than its owners. */
export function conjoinUnions(members: Member[]) {
  return Math.max(0, members.filter((member) => member.role === 'owner').length - 1)
}

/** Members cleaned up: known roles, one entry per crawler, the first owner kept first. */
export function normalizeMembers(raw: unknown): Member[] {
  const seen = new Set<string>()
  const out: Member[] = []
  for (const entry of Array.isArray(raw) ? raw : []) {
    const uuid = String(entry?.uuid ?? '').trim()
    if (!uuid || seen.has(uuid)) continue
    seen.add(uuid)
    out.push({ uuid, role: MEMBER_ROLES.includes(entry?.role) ? entry.role : 'member' })
  }
  return out
}

/**
 * When a crawler leaves the space or dies, what goes with them: the upgrades and tables they own. Everything else
 * stays. Items with no owner belong to the space.
 */
export function leavingWith<T extends { owner?: string }>(items: T[], uuid: string) {
  const going = items.filter((item) => item.owner && item.owner === uuid)
  return { going, staying: items.filter((item) => !going.includes(item)) }
}

/** Space Level from the old sheet's free-text "tier" (the first number 1-5 in it), or 1. */
export function levelFromText(text: unknown) {
  const match = String(text ?? '').match(/\d+/)
  const level = match ? Math.floor(Number(match[0])) : 1
  return Math.min(5, Math.max(1, level || 1))
}

export type LegacySpace = { tier: string; size: string; amenities: string[] }

/** The old character-sheet fields, if they held anything. */
export function legacySpace(system: any): LegacySpace | null {
  const tier = String(system?.personalSpace?.tier ?? '').trim()
  const size = String(system?.personalSpace?.size ?? '').trim()
  const amenities = (Array.isArray(system?.amenities) ? system.amenities : [])
    .map((entry: any) => String(typeof entry === 'object' && entry ? entry.value ?? '' : entry ?? '').trim())
    .filter(Boolean)
  return tier || size || amenities.length ? { tier, size, amenities } : null
}
