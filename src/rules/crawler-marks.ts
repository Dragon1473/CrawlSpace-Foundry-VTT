/**
 * The marks beside a crawler's name (Core Rulebook HUD table): a skull per crawler killed, a golden skull per
 * leaderboard crawler killed, and a star per boss killed. Pure module.
 */
export type MarkKind = 'skull' | 'goldenSkull' | 'star'
export type Kills = { crawlers?: unknown; leaderboard?: unknown; bosses?: unknown }

/** Up to this many marks are drawn one by one; more collapse to one icon and a count. */
export const MARKS_DRAWN = 5

const count = (value: unknown) => Math.max(0, Math.floor(Number(value)) || 0)

export function crawlerMarks(kills: Kills | undefined | null) {
  const marks: { kind: MarkKind; count: number; icons: number; many: boolean }[] = []
  const add = (kind: MarkKind, value: unknown) => {
    const n = count(value)
    if (n > 0) marks.push({ kind, count: n, icons: n > MARKS_DRAWN ? 1 : n, many: n > MARKS_DRAWN })
  }
  add('skull', kills?.crawlers)
  add('goldenSkull', kills?.leaderboard)
  add('star', kills?.bosses)
  return marks
}
