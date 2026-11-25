/**
 * Values a GM enters that scale with Rank: a step table ("1: 15, 5: 25, 10: 50, 15: 75", the value from the highest
 * Rank reached), a formula with @rank (or RANK) such as "@rank" or "@rank*2", or a plain value. Numbers round down.
 * Pure, so tests can import it.
 */

const STEP = /^\s*(\d+)\s*:\s*(.*?)\s*$/

/** The steps of a step table, lowest Rank first; null when the text isn't one. */
export function rankSteps(text: unknown): { rank: number; value: string }[] | null {
  const source = String(text ?? '').trim()
  if (!STEP.test(source)) return null
  const parts = source.split(/[,;\n]+/).map((part) => part.trim()).filter(Boolean)
  const steps = parts.map((part) => STEP.exec(part))
  if (steps.some((step) => !step || !step[2])) return null
  return steps.map((step) => ({ rank: Number(step![1]), value: step![2] })).sort((a, b) => a.rank - b.rank)
}

/** The text that applies at this Rank: a step table's step (its lowest below the first step), else the text itself. */
export function rankStep(text: unknown, rank: number): string {
  const steps = rankSteps(text)
  if (!steps) return String(text ?? '').trim()
  let value = steps[0].value
  for (const step of steps) if (rank >= step.rank) value = step.value
  return value
}

/** A number at this Rank (rounded down), or `fallback` when the text is blank or can't be worked out. */
export function rankNumber(text: unknown, rank: number, fallback = 0): number {
  const expression = rankStep(text, rank)
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
