/** The boss health bar across the top of the canvas (apps/boss-bar.ts). Pure module. */

/** Health left as a whole percentage of the bar. */
export const barPercent = (value: unknown, max: unknown) => {
  const top = Number(max) || 0
  return top > 0 ? Math.floor(Math.min(1, Math.max(0, (Number(value) || 0) / top)) * 100) : 0
}

/** Green at full health through yellow to red at none, as the crawler frames show it. */
export const healthColor = (pct: number) => `hsl(${Math.floor((pct / 100) * 120)} 68% 42%)`

type BossCombatant = { tokenId?: string | null; id: string; kind?: string; hidden?: boolean }

/** The combat's bosses, each token once; hidden ones only for the GM. */
export function bossCombatants<T extends BossCombatant>(combatants: T[], gm: boolean) {
  const seen = new Set<string>()
  return combatants.filter((entry) => {
    const key = entry.tokenId ?? entry.id
    if (entry.kind !== 'boss' || (entry.hidden && !gm) || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Token name display modes from HOVER (30) up show the name to everyone; the GM always sees it. */
export const bossNameShown = (gm: boolean, displayName: number) => gm || Number(displayName) >= 30

/** The bar shows once the combat has started, and not while the boss battle splash is up or about to come up. */
export const bossBarVisible = ({ started, splashOpen, awaitingSplash }: { started: boolean; splashOpen: boolean; awaitingSplash: boolean }) =>
  started && !splashOpen && !awaitingSplash

export type BarBox = { left: number; top: number; width: number; height: number }
const MIN_WIDTH = 160
const MIN_HEIGHT = 8
const MAX_HEIGHT = 60
/** Room kept below the bar for its name label. */
const LABEL_ROOM = 22

/** Where the bar goes: the saved spot kept on screen, or 60% of the width, centred near the top (at defaultTop). */
export function bossBarBox(saved: Partial<BarBox> | null | undefined, view: { width: number; height: number }, defaultTop = 12): BarBox {
  const width = Math.floor(Math.min(view.width, Math.max(MIN_WIDTH, Number(saved?.width) || view.width * 0.6)))
  const height = Math.floor(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Number(saved?.height) || 18)))
  const left = Math.floor(Math.min(view.width - width, Math.max(0, saved?.left ?? (view.width - width) / 2)))
  const top = Math.floor(Math.min(view.height - height - LABEL_ROOM, Math.max(0, saved?.top ?? defaultTop)))
  return { left, top, width, height }
}

/**
 * Whether a combat update starts an encounter that gets the boss battle splash: the combat moved to round 1 from
 * round 0 (or from not having started), and a boss the players can see is in it.
 */
export function autoBossBattle(changes: { round?: unknown }, combatants: { kind?: string; hidden?: boolean }[], previousRound: unknown = 0) {
  if (Number(changes?.round) !== 1 || (Number(previousRound) || 0) > 0) return false
  return combatants.some((entry) => entry.kind === 'boss' && !entry.hidden)
}

/** How wide the fill is, as an exact share of health left (0–100), so it moves smoothly rather than in steps. */
export const barWidth = (value: unknown, max: unknown) => {
  const top = Number(max) || 0
  return top > 0 ? Math.min(100, Math.max(0, ((Number(value) || 0) * 100) / top)) : 0
}

/**
 * The trail behind the fill that shows what a hit took, like a soulslike boss bar: after a hit it stays at the old
 * health (or where an earlier, still-showing hit left it) and then drains down to the fill; healing drops it at once.
 */
export function lossTrail(previous: number | undefined, next: number, trail?: number) {
  if (previous === undefined || next > previous) return { from: next, drain: false }
  const from = Math.max(previous, trail ?? previous)
  return { from, drain: from > next }
}
