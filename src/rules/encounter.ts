/**
 * The encounter tuner: how many mobs make a fight of a given threat for a party of a given size. The count is the
 * party size times the threat's share, rounded down (house rule), never below one. Pure module.
 */
export const THREATS = [
  { id: 'weak', percent: 50 },
  { id: 'moderate', percent: 100 },
  { id: 'strong', percent: 150 },
  { id: 'overwhelming', percent: 200 },
] as const

export type ThreatId = (typeof THREATS)[number]['id']

/** The party sizes the tuner's table shows. */
export const TABLE_SIZES = [2, 3, 4, 5, 6, 7] as const

export const isThreat = (value: unknown): value is ThreatId => THREATS.some((threat) => threat.id === value)

/** A party size as a whole number from 1 to 99 (1 when it isn't a number). */
export const cleanPartySize = (value: unknown) => Math.max(1, Math.min(99, Math.floor(Number(value)) || 1))

/** Mobs for this party size and threat. An unknown threat counts as moderate. */
export function mobCount(partySize: unknown, threat: unknown): number {
  const percent = THREATS.find((entry) => entry.id === threat)?.percent ?? 100
  return Math.max(1, Math.floor((cleanPartySize(partySize) * percent) / 100))
}
