/**
 * Mob Advantage and Disadvantage (core rules, p. 60). The GM doesn't roll the d20 for Mobs, so instead of an
 * extra die, a Mob with Advantage adds 5 to the Difficulty of its Action, Evade or other relevant quality, and a
 * Mob with Disadvantage takes 5 off. Crawlers targeted by a Disadvantaged attack get a free Evade against it;
 * if that fails, they may spend an Action to Evade again. Pure module.
 */
export type Mode = 'normal' | 'advantage' | 'disadvantage'
export const MOB_MODE_SHIFT = 5

/** A Mob's Difficulty (an attack's to-hit, or its Evade) after its Advantage or Disadvantage. */
export function mobDifficulty(base: number | null, mode: Mode): number | null {
  if (base === null) return null
  return base + (mode === 'advantage' ? MOB_MODE_SHIFT : mode === 'disadvantage' ? -MOB_MODE_SHIFT : 0)
}

/**
 * The mode left from every reason for Advantage and Disadvantage: they cancel one for one, and whatever is
 * left over counts once (two reasons for Advantage and one for Disadvantage leave Advantage).
 */
export function netMode(modes: string[]): Mode {
  const advantage = modes.filter((mode) => mode === 'advantage').length
  const disadvantage = modes.filter((mode) => mode === 'disadvantage').length
  return advantage > disadvantage ? 'advantage' : disadvantage > advantage ? 'disadvantage' : 'normal'
}

/** Whether a crawler whose free Evade failed against a Disadvantaged attack may spend an Action to Evade again. */
export function canEvadeAgain(mode: Mode | undefined, response: { kind: string; hit: boolean; again?: boolean } | undefined) {
  return mode === 'disadvantage' && !!response && response.kind === 'evade' && response.hit && !response.again
}

/**
 * One target's Difficulty for a Mob's attack: the Mob's own reasons for Advantage or Disadvantage and the target's
 * (conditions on attacks against it: Held, Confusing Fog) cancel one for one.
 */
export function targetDifficulty(base: number | null, own: string[], incoming: string[]): { mode: Mode; toHit: number | null } {
  const mode = netMode([...own, ...incoming])
  return { mode, toHit: mobDifficulty(base, mode) }
}
