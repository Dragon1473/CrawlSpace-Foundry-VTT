/**
 * Mob kinds and what follows from them, free of Foundry so it can be tested: base stats, deity levels, the stat
 * budget, who acts once per crawler, and how a token shows on the minimap.
 */

export const MOB_KINDS = ['mob', 'boss', 'feralGod', 'god'] as const
export type MobKind = (typeof MOB_KINDS)[number]

/** Feral gods and gods are a fixed level (not in the books). */
export const DEITY_LEVELS: Record<string, number> = { feralGod: 150, god: 250 }

export const isDeity = (kind: unknown) => typeof kind === 'string' && kind in DEITY_LEVELS

/** Bosses and deities use a boss tier's health slots and stat points per level. */
export const isBossLike = (kind: unknown) => kind === 'boss' || isDeity(kind)

/**
 * Every stat a mob starts with before its level's points: 1 for mobs, 5 for bosses. Deities start at 5 too (not in
 * the books).
 */
export const mobBaseStat = (kind: unknown) => (isBossLike(kind) ? 5 : 1)

/** A deity's level is its kind's; any other mob keeps its own. */
export const mobLevel = (kind: unknown, level: unknown) => (isDeity(kind) ? DEITY_LEVELS[kind as string] : Math.max(0, Math.floor(Number(level) || 0)))

/**
 * A mob's stat budget: its level's points (`total`) spread over its five stats on top of the base each stat starts
 * at. Only the points above the base count as spent; a stat under the base spends nothing.
 */
export function statBudget(kind: unknown, total: number, values: (number | null | undefined)[]) {
  const base = mobBaseStat(kind)
  const assigned = values.reduce<number>((sum, value) => sum + Math.max(0, Math.floor(Number(value) || 0) - base), 0)
  return { base, total, assigned, remaining: total - assigned, over: assigned > total }
}

/**
 * Stats to give a mob when its kind changes: if every stat still sits at the old kind's base (or is blank), they
 * move to the new kind's base. Null when there's nothing to change.
 */
export function rebasedStats(fromKind: unknown, toKind: unknown, values: Record<string, number | null | undefined>) {
  const from = mobBaseStat(fromKind)
  const to = mobBaseStat(toKind)
  if (from === to) return null
  const entries = Object.entries(values)
  if (!entries.every(([, value]) => value === null || value === undefined || value === from)) return null
  return Object.fromEntries(entries.map(([key]) => [key, to]))
}

/** Bosses, deities and Elites take as many actions a round as the party has crawlers. */
export const actsPerCrawler = (system: { kind?: unknown; elite?: unknown } | null | undefined) => !!system && (isBossLike(system.kind) || !!system.elite)

/** Actions a round: one per crawler (at least one) for bosses, deities and Elites; otherwise null (no set number). */
export function mobActionsPerRound(system: { kind?: unknown; elite?: unknown } | null | undefined, crawlers: number) {
  return actsPerCrawler(system) ? Math.max(1, Math.floor(crawlers) || 0) : null
}

/* ------------------------------------------------------------------ */
/*  Minimap markers                                                    */
/* ------------------------------------------------------------------ */

/** The app's radar colors, by what a token is. */
export const MARKER_COLORS = {
  self: '#44f275',
  crawler: '#4395ff',
  hostile: '#ff405e',
  neutral: '#ffffff',
  outsider: '#b26bff',
  pet: '#ff9b45',
  minion: '#ffffff',
} as const
export type MarkerCategory = keyof typeof MARKER_COLORS

/**
 * dot: ●; minion: a white dot with a green X; cross: ✚ (an Elite); star: ★ (an important NPC); god: a spinning,
 * pulsing ★; corpse: a black X.
 */
export type MarkerShape = 'dot' | 'minion' | 'cross' | 'star' | 'god' | 'corpse'

export interface MarkerInput {
  actorType: string
  system?: any
  /** CONST.TOKEN_DISPOSITIONS: -1 hostile, 0 neutral, 1 friendly, -2 secret. */
  disposition?: number
  dead?: boolean
  /** An Elite shows as one only once the GM reveals it on its token. */
  eliteRevealed?: boolean
  /** The token is this user's own (not the GM). */
  own?: boolean
}

/** What a token is on the minimap, from its actor's type rather than only its disposition. */
export function markerCategory(input: MarkerInput): MarkerCategory {
  const system = input.system ?? {}
  const type = input.actorType
  if (input.own && (type === 'crawler' || system.crawler)) return 'self'
  if (type === 'crawler' || (type === 'mob' && system.crawler)) return 'crawler'
  if (type === 'companion') return 'pet'
  if (type === 'minion' || system.master || system.minion?.temporary) return 'minion'
  if (system.outsider) return 'outsider'
  const hostile = input.disposition === -1
  if (type === 'npc') return hostile ? 'hostile' : 'neutral'
  // Mobs are hostile unless the GM set their token neutral or friendly.
  if (type === 'mob') return input.disposition === 0 || input.disposition === 1 ? 'neutral' : 'hostile'
  return hostile ? 'hostile' : 'neutral'
}

export function markerShape(input: MarkerInput, category = markerCategory(input)): MarkerShape {
  if (input.dead) return 'corpse'
  const system = input.system ?? {}
  if (category === 'minion') return 'minion'
  if (input.actorType === 'mob' && isDeity(system.kind)) return 'god'
  if (system.elite && input.eliteRevealed) return 'cross'
  if (system.important) return 'star'
  return 'dot'
}

export function minimapMarker(input: MarkerInput) {
  const category = markerCategory(input)
  return { category, shape: markerShape(input, category), color: MARKER_COLORS[category] }
}

type Ctx = CanvasRenderingContext2D

function starPath(context: Ctx, x: number, y: number, outer: number, inner: number, turn = 0) {
  context.beginPath()
  for (let point = 0; point < 10; point++) {
    const radius = point % 2 ? inner : outer
    const angle = turn - Math.PI / 2 + (point * Math.PI) / 5
    const px = x + Math.cos(angle) * radius
    const py = y + Math.sin(angle) * radius
    if (point) context.lineTo(px, py)
    else context.moveTo(px, py)
  }
  context.closePath()
}

/**
 * Draws one marker at (x, y) with radius `r` on a minimap canvas. `time` (ms) turns and pulses a god's star; the
 * caller keeps redrawing while any god is shown (see `MARKER_ANIMATED`).
 */
export function drawMarker(context: Ctx, marker: { shape: MarkerShape; color: string }, x: number, y: number, r: number, time = 0) {
  const outline = '#164667'
  context.save()
  switch (marker.shape) {
    case 'corpse': {
      const arm = Math.max(3, r)
      context.beginPath()
      context.moveTo(x - arm, y - arm)
      context.lineTo(x + arm, y + arm)
      context.moveTo(x + arm, y - arm)
      context.lineTo(x - arm, y + arm)
      context.lineCap = 'round'
      // Black, with a thin light edge so it reads on the dark radar.
      context.lineWidth = Math.max(3.5, arm * 0.7) + 2
      context.strokeStyle = 'rgba(220, 240, 255, 0.85)'
      context.stroke()
      context.lineWidth = Math.max(3.5, arm * 0.7)
      context.strokeStyle = '#000000'
      context.stroke()
      break
    }
    case 'cross': {
      const arm = Math.max(3.5, r * 1.15)
      const width = Math.max(2.5, arm * 0.6)
      context.beginPath()
      context.moveTo(x - arm, y)
      context.lineTo(x + arm, y)
      context.moveTo(x, y - arm)
      context.lineTo(x, y + arm)
      context.lineWidth = width + 2
      context.strokeStyle = outline
      context.stroke()
      context.lineWidth = width
      context.strokeStyle = marker.color
      context.stroke()
      break
    }
    case 'star':
    case 'god': {
      const god = marker.shape === 'god'
      const pulse = god ? 1 + 0.25 * Math.sin(time / 180) : 1
      const outer = Math.max(4, r * 1.35) * pulse
      starPath(context, x, y, outer, outer * 0.45, god ? (time / 900) % (Math.PI * 2) : 0)
      if (god) {
        context.shadowColor = marker.color
        context.shadowBlur = 4 + 3 * pulse
      }
      context.fillStyle = marker.color
      context.fill()
      context.shadowBlur = 0
      context.lineWidth = 1
      context.strokeStyle = outline
      context.stroke()
      break
    }
    default: {
      context.beginPath()
      context.arc(x, y, r, 0, Math.PI * 2)
      context.fillStyle = marker.color
      context.fill()
      context.lineWidth = marker.shape === 'dot' && marker.color === MARKER_COLORS.crawler ? 1.5 : 1
      context.strokeStyle = marker.color === MARKER_COLORS.crawler ? '#ffffff' : outline
      context.stroke()
      if (marker.shape === 'minion') {
        const arm = r * 0.6
        context.beginPath()
        context.moveTo(x - arm, y - arm)
        context.lineTo(x + arm, y + arm)
        context.moveTo(x + arm, y - arm)
        context.lineTo(x - arm, y + arm)
        context.lineWidth = Math.max(1.2, r * 0.35)
        context.strokeStyle = '#2bbf5a'
        context.stroke()
      }
    }
  }
  context.restore()
}

/** Shapes that need the minimap redrawn every frame. */
export const MARKER_ANIMATED: ReadonlySet<MarkerShape> = new Set(['god'])
