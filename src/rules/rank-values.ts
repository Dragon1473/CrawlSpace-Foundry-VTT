/**
 * Values set per Rank tier, the way an item's Rank upgrades work: the base value, replaced from Rank 5, 10 and 15 by
 * that row's value when it has one. A value can use RANK (or @rank) as a damage formula does: "RANK", "RANK*2".
 * Pure, so tests can import it.
 */

export type RankTiers = { base?: unknown; rank5?: unknown; rank10?: unknown; rank15?: unknown }

const filled = (value: unknown) => String(value ?? '').trim()

/** The value for this Rank: the highest Rank upgrade reached that has one, else the base. */
export function tierValue(rank: number, tiers: RankTiers): string {
  return (rank >= 15 && filled(tiers.rank15)) || (rank >= 10 && filled(tiers.rank10)) || (rank >= 5 && filled(tiers.rank5)) || filled(tiers.base)
}

/** A whole number from a value at this Rank (rounded down), or `fallback` when it is blank or not plain arithmetic. */
export function rankNumber(text: unknown, rank: number, fallback = 0): number {
  const expression = filled(text)
    .replace(/@rank\b/gi, String(rank))
    .replace(/\bRANK\b/gi, String(rank))
    .replace(/[×x]/gi, '*')
    .replace(/%/g, '')
    .trim()
  // Plain arithmetic only: numbers, + - * / and parentheses.
  if (!expression || !/^[\d\s+\-*/().]+$/.test(expression)) return fallback
  try {
    const value = Number(Function(`"use strict"; return (${expression})`)())
    return Number.isFinite(value) ? Math.floor(value) : fallback
  } catch {
    return fallback
  }
}

/**
 * Step text from 0.9.8.43 ("1: 10, 5: 20, 10: 40") as Rank tiers, for migrating it; null when the text isn't steps.
 * A step below Rank 5 is the base; a step at another Rank goes to the tier it falls in.
 */
export function stepsToTiers(text: unknown): { base: string; rank5: string; rank10: string; rank15: string } | null {
  const source = filled(text)
  if (!/^\d+\s*:/.test(source)) return null
  const tiers = { base: '', rank5: '', rank10: '', rank15: '' }
  for (const part of source.split(/[,;\n]+/)) {
    const step = /^\s*(\d+)\s*:\s*(.+?)\s*$/.exec(part)
    if (!step) return null
    const rank = Number(step[1])
    tiers[rank >= 15 ? 'rank15' : rank >= 10 ? 'rank10' : rank >= 5 ? 'rank5' : 'base'] = step[2]
  }
  return tiers
}
