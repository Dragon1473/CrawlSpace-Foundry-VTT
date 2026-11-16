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
