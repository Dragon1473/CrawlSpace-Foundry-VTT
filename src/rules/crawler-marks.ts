/**
 * The marks beside a crawler's name: a white skull per crawler killed, a gold skull per leaderboard crawler
 * killed, and a star per boss killed, coloured by the boss's tier (neighborhood bronze up to floor celestial).
 * Pure module.
 */
export type MarkIcon = 'star' | 'skull'
export type MarkTier = 'white' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'legendary' | 'celestial'
export type KillKey = 'floor' | 'country' | 'province' | 'city' | 'borough' | 'neighborhood' | 'leaderboard' | 'crawlers'

/** Every kind of kill, most important first: the order the frames and the Kills window list them. */
export const KILL_KINDS: readonly { key: KillKey; icon: MarkIcon; tier: MarkTier }[] = [
  { key: 'floor', icon: 'star', tier: 'celestial' },
  { key: 'country', icon: 'star', tier: 'legendary' },
  { key: 'province', icon: 'star', tier: 'platinum' },
  { key: 'city', icon: 'star', tier: 'gold' },
  { key: 'borough', icon: 'star', tier: 'silver' },
  { key: 'neighborhood', icon: 'star', tier: 'bronze' },
  { key: 'leaderboard', icon: 'skull', tier: 'gold' },
  { key: 'crawlers', icon: 'skull', tier: 'white' },
]

export type Kills = Partial<Record<KillKey, unknown>>

const count = (value: unknown) => Math.max(0, Math.floor(Number(value)) || 0)

/** The kinds a crawler has earned, most important first, each with its count. */
export function crawlerMarks(kills: Kills | undefined | null) {
  return KILL_KINDS.map((kind) => ({ ...kind, count: count(kills?.[kind.key]) })).filter((mark) => mark.count > 0)
}

/** A count after pressing + (1) or - (-1). */
export const stepKill = (current: unknown, delta: number) => Math.max(0, count(current) + Math.floor(delta))

/** Kills from before boss tiers: the one boss count becomes neighborhood bosses unless those are already set. */
export function migrateKills<T extends Record<string, unknown>>(kills: T) {
  if (!kills || typeof kills !== 'object' || !('bosses' in kills)) return kills
  const { bosses, ...rest } = kills as Record<string, unknown>
  return (rest.neighborhood === undefined && count(bosses) > 0 ? { ...rest, neighborhood: count(bosses) } : rest) as Omit<T, 'bosses'>
}
