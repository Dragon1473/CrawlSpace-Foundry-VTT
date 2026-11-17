/**
 * While upkeep passes time, regeneration (You are full!, Replenish…) heals without its own chat cards; upkeep
 * notes which buffs did it and puts them on its one summary card (apps/upkeep.ts restParty).
 */
let collecting: Map<string, string[]> | null = null

export function startRegenCollect() {
  collecting = new Map()
}

/** The regeneration buffs that acted on each actor (by uuid) since collecting started. */
export function stopRegenCollect() {
  const notes = collecting ?? new Map<string, string[]>()
  collecting = null
  return notes
}

/** Note the buffs that regenerated this actor; false when nothing is collecting (it posts its own card then). */
export function noteRegen(actor: any, sources: string[]) {
  if (!collecting) return false
  collecting.set(actor.uuid, [...(collecting.get(actor.uuid) ?? []), ...sources])
  return true
}
