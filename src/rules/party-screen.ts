/**
 * The party screen's numbers, kept free of Foundry so they can be tested: each crawler's unenhanced stat points,
 * who leads the party (the most unenhanced stat points), and the party's skills and spells (each once, at the
 * best rank anyone has, with everyone who has it), and party titles.
 */

/** The base scores (before enhancements) added up, rounded down; blank stats count 0. */
export function unenhancedTotal(attributes: Record<string, { value?: number | null } | undefined> | null | undefined) {
  let total = 0
  for (const stat of Object.values(attributes ?? {})) total += Math.floor(Number(stat?.value) || 0)
  return total
}

/** The stat totals (after enhancements) added up, rounded down; blank stats count 0. */
export function enhancedTotal(attributes: Record<string, { total?: number | null } | undefined> | null | undefined) {
  let total = 0
  for (const stat of Object.values(attributes ?? {})) total += Math.floor(Number(stat?.total) || 0)
  return total
}

export interface LeaderCandidate {
  id: string
  name: string
  unenhanced: number
  enhanced: number
  evade: number
}

/**
 * The party leader's id: the most unenhanced stat points, then the highest enhanced score, then the highest
 * Evade, then the name alphabetically. Null for an empty party.
 */
export function partyLeader(members: LeaderCandidate[]): string | null {
  const num = (value: number) => (Number.isFinite(value) ? value : 0)
  const ranked = [...members].sort(
    (a, b) => num(b.unenhanced) - num(a.unenhanced) || num(b.enhanced) - num(a.enhanced) || num(b.evade) - num(a.evade) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  )
  return ranked[0]?.id ?? null
}

/** A crawler's party title (flags.crawlspace.partyTitle): its text, and whether it goes before or after the name. */
export type TitlePosition = 'before' | 'after'
export interface PartyTitle {
  text: string
  position: TitlePosition
}
export const TITLE_LIMIT = 60

export function cleanTitle(title: unknown): PartyTitle {
  const raw: any = title && typeof title === 'object' ? title : {}
  return { text: String(raw.text ?? '').trim().slice(0, TITLE_LIMIT), position: raw.position === 'before' ? 'before' : 'after' }
}

/** "Princess Donut" or "Carl the Destroyer"; just the name without a title. */
export function titledName(name: string, title: unknown) {
  const { text, position } = cleanTitle(title)
  if (!text) return name
  return position === 'before' ? `${text} ${name}` : `${name} ${text}`
}

export const signedRank = (rank: number) => (rank >= 0 ? `+${rank}` : `${rank}`)

export type PartySkillKind = 'skill' | 'spell'
export interface PartySkill {
  kind: PartySkillKind
  name: string
  rank: number
  /** "Unarmed Combat +6" */
  label: string
  /** Everyone who has it, best rank first. */
  holders: { name: string; rank: number }[]
}

/** Each skill and spell once (names match without case), at the best rank, skills before spells, by name. */
export function partySkills(members: { name: string; skills: { name: string; rank: number; kind: PartySkillKind }[] }[]): PartySkill[] {
  const found = new Map<string, { kind: PartySkillKind; name: string; holders: Map<string, number> }>()
  for (const member of members) {
    for (const skill of member.skills) {
      const name = String(skill.name ?? '').trim()
      if (!name) continue
      const key = `${skill.kind}:${name.toLowerCase()}`
      const rank = Math.floor(Number(skill.rank) || 0)
      const entry = found.get(key) ?? found.set(key, { kind: skill.kind, name, holders: new Map() }).get(key)!
      entry.holders.set(member.name, Math.max(rank, entry.holders.get(member.name) ?? -Infinity))
    }
  }
  return [...found.values()]
    .map((entry) => {
      const holders = [...entry.holders].map(([name, rank]) => ({ name, rank })).sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name))
      const rank = holders[0]?.rank ?? 0
      return { kind: entry.kind, name: entry.name, rank, label: `${entry.name} ${signedRank(rank)}`, holders }
    })
    .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'skill' ? -1 : 1))
}
