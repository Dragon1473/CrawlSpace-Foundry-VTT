/**
 * Losing a stat modifier (the Modifier Loss rule): everywhere (Feared loses DEX on everything), or only for some
 * kinds of roll (Woozy drops DEX from attacks and Evade only). Mobs don't roll, so a lost modifier
 * comes off their Difficulties instead: their Evade and their attacks' to-hit. Pure module.
 */
export type LossKind = 'attack' | 'evade' | 'check'

/** A Modifier Loss change's value: `true` (or blank) for everywhere, else the kinds it names. */
export function lossScope(value: unknown): 'all' | LossKind[] {
  if (value === true || value === undefined || value === null) return 'all'
  const text = String(value).trim().toLowerCase()
  if (!text || text === 'true' || text === 'all') return 'all'
  return text
    .split(',')
    .map((kind) => kind.trim())
    .filter((kind): kind is LossKind => kind === 'attack' || kind === 'evade' || kind === 'check')
}

/** Whether a stat's modifier is lost for this kind of roll. */
export const modLostFor = (attribute: { modLost?: boolean; modLostFor?: string[] } | undefined, kind: LossKind) =>
  !!attribute && (!!attribute.modLost || (attribute.modLostFor ?? []).includes(kind))

type Loss = { published: boolean; fullMod: number; lostAll: boolean }

/** How much a lost modifier takes off a mob's number: all of it, unless the number was worked out without it already. */
const takeOff = ({ published, fullMod, lostAll }: Loss, lost: boolean) => (!lost ? 0 : published || !lostAll ? Math.floor(fullMod) : 0)

export const mobEvadeAfterLoss = (input: Loss & { evade: number; lostEvade: boolean }) => input.evade - takeOff(input, input.lostEvade)

export const mobToHitAfterLoss = (input: Loss & { toHit: number | null; lostAttack: boolean }) =>
  input.toHit === null ? null : input.toHit - takeOff(input, input.lostAttack)
