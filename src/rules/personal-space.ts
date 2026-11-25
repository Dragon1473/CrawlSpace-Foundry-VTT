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
/** `spaceLevel`: for an owner, the Level of the space they brought when it was conjoined (0: not recorded). */
export type Member = { uuid: string; role: MemberRole; spaceLevel?: number }

/** What an installed upgrade changes while a crawler is in the space. Zero (or null) leaves the rule alone. */
export type UpgradeAutomation = {
  /** A Long Rest here takes this many hours instead of 8 (0: it is instant). */
  longRestHours: number | null
  /** A Long Rest here also grants Good Sleep for this many hours. */
  goodSleepHours: number
  /** A Short Rest here heals this many extra Health Bar slots. */
  shortRestSlots: number
  /** The most grinding hours a training room here gives a skill in a day (the Train action). */
  trainingHours: number
}

export type UpgradeLike = { name: string; installed?: boolean; kind?: string; owner?: string; rest?: Partial<UpgradeAutomation>; training?: { hours?: number } & Record<string, unknown> }

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

export const TRAINING_SKILLS = ['any', 'skill', 'combat', 'noncombat', 'spell', 'named'] as const
export type TrainingSkills = (typeof TRAINING_SKILLS)[number]

/** A training upgrade: once a day per crawler, `hours` grinding hours in each of up to `slots` allowed skills. */
export type Training = { hours: number; skills: TrainingSkills; maxRank: number; slots: number; names: string }

export const trainingOf = (raw: any): Training => ({
  hours: whole(raw?.hours),
  skills: TRAINING_SKILLS.includes(raw?.skills) ? raw.skills : 'any',
  maxRank: whole(raw?.maxRank),
  slots: Math.max(1, whole(raw?.slots, 1)),
  names: String(raw?.names ?? ''),
})

/** What a training room needs to know about a skill or spell. */
export type TrainableSkill = { name: string; type: 'skill' | 'spell'; rank: number; combat?: boolean }

/** Spells, and skills about mana or magic, count as magic practice. */
export const isMagic = (skill: TrainableSkill) => skill.type === 'spell' || /\b(magic|mana|spell|arcane|channel)/i.test(skill.name)

const listOf = (text: string) => text.split(/[,;\n]/).map((name) => name.trim().toLowerCase()).filter(Boolean)

/** Whether a training upgrade can train this skill: its kind of skill, and at or below its highest Rank (if any). */
export function canTrain(training: Training, skill: TrainableSkill) {
  if (training.maxRank && skill.rank > training.maxRank) return false
  switch (training.skills) {
    case 'skill':
      return skill.type === 'skill'
    case 'combat':
      return skill.type === 'skill' && !!skill.combat
    case 'noncombat':
      return skill.type === 'skill' && !skill.combat && !isMagic(skill)
    case 'spell':
      return isMagic(skill)
    case 'named':
      return listOf(training.names).some((word) => skill.name.toLowerCase().includes(word))
    default:
      return true
  }
}

/**
 * Training hours into a skill's grinding log. Like assigned grinding hours they stop at the skill's Rank (one hour at
 * Rank 0), and a skill that already had its advancement check today can't train. `ready`: the log is full, so the
 * advancement check is due (the caller rolls it and empties the log).
 */
export function trainSkill(log: { skillHours: Record<string, number>; attempted: Record<string, number>; day: number }, skillId: string, rank: number, hours: number) {
  const required = Math.max(1, whole(rank))
  const progress = whole(log.skillHours[skillId])
  if (log.attempted[skillId] === log.day) return { added: 0, progress, required, ready: false, blocked: true }
  const added = Math.max(0, Math.min(whole(hours), required - progress))
  return { added, progress: progress + added, required, ready: progress + added >= required, blocked: false }
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

/**
 * The Level of conjoined spaces (house rule), from the Level each space had on its own. It is at least the highest of
 * them. Two spaces at that highest Level add 1; one space at it joined with two or more lower ones adds 1; three or
 * more spaces at it add 2. Never above Level 5. Null when fewer than two spaces are joined.
 */
export function conjoinedLevel(levels: number[]) {
  const joined = levels.map((level) => Math.min(5, whole(level))).filter((level) => level > 0)
  if (joined.length < 2) return null
  const top = Math.max(...joined)
  const atTop = joined.filter((level) => level === top).length
  const below = joined.length - atTop
  const bonus = atTop >= 3 ? 2 : atTop === 2 || below >= 2 ? 1 : 0
  return Math.min(5, top + bonus)
}

/** The Levels of the spaces conjoined here: one per owner who recorded the space they brought. */
export const ownerLevels = (members: Member[]) =>
  members.filter((member) => member.role === 'owner' && (member.spaceLevel ?? 0) > 0).map((member) => member.spaceLevel as number)

/** Members cleaned up: known roles, one entry per crawler, the first owner kept first. */
export function normalizeMembers(raw: unknown): Member[] {
  const seen = new Set<string>()
  const out: Member[] = []
  for (const entry of Array.isArray(raw) ? raw : []) {
    const uuid = String(entry?.uuid ?? '').trim()
    if (!uuid || seen.has(uuid)) continue
    seen.add(uuid)
    const role: MemberRole = MEMBER_ROLES.includes(entry?.role) ? entry.role : 'member'
    const spaceLevel = Math.min(5, whole(entry?.spaceLevel))
    out.push(role === 'owner' && spaceLevel ? { uuid, role, spaceLevel } : { uuid, role })
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

/** A day of dungeon time (thirty hours), for "once a day" uses. */
const DAY = 108000
export const worldDay = (seconds: number) => Math.floor((Number(seconds) || 0) / DAY)

export const USE_KINDS = ['', 'meal', 'wash'] as const
export type UseKind = (typeof USE_KINDS)[number]

/**
 * A once-a-day amenity a crawler uses in the space (the Use button). A meal gives +`statBonus` to a stat the eater picks
 * and/or `restSlots` extra Health Bar slots at their next Short Rest, for `hours`; a new meal replaces the last one (meals
 * don't stack). A wash gives Advantage on the checks named in `advantage` for `hours`.
 */
export type SpaceUse = { kind: UseKind; statBonus: number; restSlots: number; hours: number; advantage: string }

export const useOf = (raw: any): SpaceUse => ({
  kind: USE_KINDS.includes(raw?.kind) ? raw.kind : '',
  statBonus: whole(raw?.statBonus),
  restSlots: whole(raw?.restSlots),
  hours: whole(raw?.hours),
  advantage: String(raw?.advantage ?? '').trim(),
})

/**
 * What an upgrade does to crafting in the space. An attachment's `speed` (percent less time) and `batchHalf` (extra
 * batch copies take half their time) act on recipes that need its table's kind. `tierBoost` raises every space table
 * one project needs, once a day. `reroll` names the table kinds whose failed check it rerolls once per floor.
 */
export type SpaceCraft = { speed: number; batchHalf: boolean; tierBoost: number; reroll: string }

export const craftOf = (raw: any): SpaceCraft => ({
  speed: Math.min(90, whole(raw?.speed)),
  batchHalf: !!raw?.batchHalf,
  tierBoost: Math.min(9, whole(raw?.tierBoost)),
  reroll: String(raw?.reroll ?? '').trim(),
})

/** Table kinds named in a comma list, matched case-insensitively. */
export const namesIn = (list: string) => list.split(/[,;]/).map((name) => name.trim().toLowerCase()).filter(Boolean)

/**
 * A project's minutes with the space's attachments: extra batch copies at half time (rounded down), then a speed cut
 * rounded down to the half hour but never under 30 minutes unless the project was already shorter.
 */
export function spaceCraftMinutes(base: number, extra: number, mods: { speed?: number; batchHalf?: boolean }) {
  let total = whole(base) + (mods.batchHalf ? Math.floor(whole(extra) / 2) : whole(extra))
  const speed = whole(mods.speed)
  if (speed > 0 && total > 30) total = Math.max(30, Math.floor((total * (100 - Math.min(90, speed))) / 100 / 30) * 30)
  return total
}

/** Space tables one project uses, each raised by the boost (to Tier 10). */
export const boostTables = <T extends { tier: number }>(tables: T[], boost: number) =>
  tables.map((table) => ({ ...table, tier: Math.min(10, whole(table.tier, 1) + whole(boost)) }))
