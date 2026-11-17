/**
 * Vehicles (core rules, pp. 73–74): ramming, what the rammer and the occupants take, the explosion at 0%, and
 * the sample vehicles. Pure module; everything rounds down.
 */

const SIZE_NAMES = ['tiny', 'small', 'petite', 'medium', 'large', 'huge', 'colossal', 'gargantuan']

/** A size as its value 1–8, from a number or a size name; 0 when there is none. */
export function sizeValue(size: unknown): number {
  const text = String(size ?? '').trim().toLowerCase()
  if (!text) return 0
  if (SIZE_NAMES.includes(text)) return SIZE_NAMES.indexOf(text) + 1
  const number = Math.floor(Number(text))
  return Number.isFinite(number) && number > 0 ? Math.min(8, number) : 0
}

/** Ramming damage: 1d6 per size value and per 10 ft of Move, plus the Floor with a ram plate. */
export function ramDice(size: number, move: number, options: { ramPlate?: boolean; floor?: number } = {}) {
  const dice = Math.max(0, Math.floor(size)) + Math.max(0, Math.floor(move / 10))
  const plate = options.ramPlate && options.floor ? ` + ${Math.floor(options.floor)}` : ''
  return `${dice}d6${plate}`
}

/**
 * What ramming does to the rammer: half the damage and half its Move, or the full damage and no Move left when
 * the target is bigger than it.
 */
export function ramRecoil(damage: number, rammerSize: number, targetSize: number, move: number) {
  return targetSize > rammerSize ? { damage: Math.floor(damage), move: 0 } : { damage: Math.floor(damage / 2), move: Math.floor(move / 2) }
}

/** An occupant's share when their vehicle is hit: half of what the vehicle took, less their DR and the vehicle's. */
export const occupantDamage = (vehicleDamage: number, ownDr: number, vehicleDr: number) =>
  Math.max(0, Math.floor(vehicleDamage / 2) - Math.floor(ownDr) - Math.floor(vehicleDr))

/** A vehicle at 0% explodes: size d6 + Floor Fire damage to everyone inside, and the vehicle's DR doesn't help. */
export const explosionFormula = (size: number, floor: number) => `${Math.max(1, Math.floor(size))}d6${floor > 0 ? ` + ${Math.floor(floor)}` : ''}`

/** The sample vehicles (Move in feet, size 1–8, DR, occupancy). */
export const SAMPLE_VEHICLES: readonly { id: string; move: number; size: number; dr: number; occupants: string }[] = [
  { id: 'skateboard', move: 30, size: 2, dr: 0, occupants: '1' },
  { id: 'bicycle', move: 40, size: 3, dr: 0, occupants: '1-2' },
  { id: 'tank', move: 50, size: 6, dr: 10, occupants: '4' },
  { id: 'eighteenWheeler', move: 60, size: 7, dr: 4, occupants: '4 (+50 in cargo)' },
  { id: 'largeTruck', move: 70, size: 6, dr: 4, occupants: '3 (+5 in cargo)' },
  { id: 'sedan', move: 80, size: 5, dr: 3, occupants: '5-6' },
  { id: 'sportscar', move: 100, size: 5, dr: 2, occupants: '2' },
  { id: 'motorcycle', move: 120, size: 4, dr: 1, occupants: '1-2' },
]
