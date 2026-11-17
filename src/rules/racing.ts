/**
 * Racing and chasing (core rules, pp. 74–76). Both run over legs: each leg, everyone makes a Skill Check and adds
 * their Move Rate Modifier, while NPCs and Mobs take a set result. A race places everyone each leg and the lowest
 * placement total wins; a chase counts Ground against the quarry. Pure module; everything rounds down.
 */
import type { AttackOutcome } from './core'

/** Move ÷ 10, rounded down, added to every racing or chasing Skill Check. */
export const moveMod = (move: number) => Math.max(0, Math.floor((Number(move) || 0) / 10))

/** An NPC's or Mob's set result each leg: 10 + the Stat Mod + the Floor + the Move Rate Modifier. */
export const npcLegResult = ({ statMod, floor, move }: { statMod: number; floor: number; move: number }) =>
  10 + Math.floor(statMod) + Math.floor(floor) + moveMod(move)

/**
 * One leg's placements: highest result first, the higher base Move winning a tie, and racers still tied
 * sharing the place. The next place after a shared one skips ahead (two 3rds, then 5th).
 */
export function placeLeg(entries: { id: string; result: number; move: number }[]): Record<string, number> {
  const sorted = [...entries].sort((a, b) => b.result - a.result || b.move - a.move)
  const places: Record<string, number> = {}
  sorted.forEach((entry, index) => {
    const before = sorted[index - 1]
    places[entry.id] = before && before.result === entry.result && before.move === entry.move ? places[before.id] : index + 1
  })
  return places
}

/** The race after its legs: lowest placement total first; a tie goes to the better last leg, and then stays a tie. */
export function raceStandings(placements: Record<string, number[]>) {
  const rows = Object.entries(placements).map(([id, legs]) => ({ id, total: legs.reduce((sum, place) => sum + place, 0), last: legs.at(-1) ?? Infinity }))
  rows.sort((a, b) => a.total - b.total || a.last - b.last)
  return rows.map((row, index) => {
    const tiedWith = rows.findIndex((other) => other.total === row.total && other.last === row.last)
    return { ...row, place: (tiedWith < index ? tiedWith : index) + 1 }
  })
}

/** Missing the Difficulty by this much or less is a Near Miss. */
export const NEAR_MISS = 2

/** Ground gained or lost in one chase leg; null when a Critical Fail takes the chaser out. */
export function chaseGround(outcome: AttackOutcome, margin = 0): number | null {
  switch (outcome) {
    case 'Critical hit':
    case 'Amazing hit':
      return 2
    case 'Hit':
      return 1
    case 'Miss':
      return margin >= -NEAR_MISS ? 0 : -1
    case 'Major miss':
      return -2
    default:
      return null
  }
}

export type ChaseStatus = 'chasing' | 'caught' | 'lost' | 'out'

/** 4 Ground or more catches the quarry early and -4 or worse loses it; after the last leg, any lead catches it. */
export function chaseStatus(ground: number | null, finished: boolean): ChaseStatus {
  if (ground === null) return 'out'
  if (ground >= 4) return 'caught'
  if (ground <= -4) return 'lost'
  if (!finished) return 'chasing'
  return ground > 0 ? 'caught' : 'lost'
}

/** Who reaches the quarry first: the chasers who caught it, highest Ground first, then the faster. */
export function chaseWinners(chasers: { id: string; ground: number; move: number }[]) {
  return chasers
    .filter((chaser) => chaser.ground > 0)
    .sort((a, b) => b.ground - a.ground || b.move - a.move)
    .map((chaser) => chaser.id)
}
