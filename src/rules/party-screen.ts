/**
 * The party screen's numbers, kept free of Foundry so they can be tested: each crawler's unenhanced stat points,
 * who leads the party (the most unenhanced stat points), and the party's skills and spells (each once, at the
 * best rank anyone has, with everyone who has it).
 */

/** The base scores (before enhancements) added up, rounded down; blank stats count 0. */
export function unenhancedTotal(attributes: Record<string, { value?: number | null } | undefined> | null | undefined) {
  let total = 0
  for (const stat of Object.values(attributes ?? {})) total += Math.floor(Number(stat?.value) || 0)
  return total
}

/** The ids of the party's leaders: the most unenhanced stat points (all of them on a tie, none when nobody has any). */
export function partyLeaders(members: { id: string; unenhanced: number }[]) {
  const best = Math.max(0, ...members.map((member) => member.unenhanced))
  return new Set(best > 0 ? members.filter((member) => member.unenhanced === best).map((member) => member.id) : [])
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
