/**
 * Who is in the party. The GM adds and removes crawlers (flags.crawlspace.inParty). Until anyone has been
 * added, the party is guessed: the crawlers a player owns, or every crawler while no player owns one.
 * A crawler the GM removed stays out either way.
 */
type Member = { hasPlayerOwner?: boolean; flags?: { crawlspace?: { inParty?: boolean } } }

export const partyFlag = (actor: Member) => actor.flags?.crawlspace?.inParty

export function pickParty<T extends Member>(crawlers: T[]): T[] {
  if (crawlers.some((actor) => partyFlag(actor) === true)) return crawlers.filter((actor) => partyFlag(actor) === true)
  const candidates = crawlers.filter((actor) => partyFlag(actor) !== false)
  const owned = candidates.filter((actor) => actor.hasPlayerOwner)
  return owned.length ? owned : candidates
}

/** Other parties: crawler groups outside the players' party, kept in a world setting. Only the players' party has frames. */
export type OtherParty = { id: string; name: string }

/** A clean list from the setting: entries with an id, names trimmed, no repeated ids. */
export function cleanParties(list: unknown): OtherParty[] {
  const seen = new Set<string>()
  return (Array.isArray(list) ? list : [])
    .filter((entry) => entry && typeof entry === 'object' && typeof entry.id === 'string' && entry.id && !seen.has(entry.id) && !!seen.add(entry.id))
    .map((entry) => ({ id: entry.id, name: typeof entry.name === 'string' ? entry.name.trim() : '' }))
}

/**
 * The party a crawler stands with: the players' party when it is a member (its name, or the fallback when the
 * GM hasn't named it), else the other party in flags.crawlspace.partyId, else '' (Solo).
 */
export function partyNameOf(
  actor: { id?: string; flags?: { crawlspace?: { partyId?: unknown } } },
  { members, playerName, fallback, parties }: { members: Set<string | undefined>; playerName: string; fallback: string; parties: OtherParty[] },
) {
  if (members.has(actor.id)) return playerName.trim() || fallback
  const id = actor.flags?.crawlspace?.partyId
  return parties.find((party) => party.id === id)?.name || ''
}
