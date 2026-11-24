/**
 * Where a token's effect icons go: round badges on an arc around the token's rim, as on crawlspace.one. The first
 * sits at the upper left and the rest follow clockwise over the top, each just touching the last. When a ring is full
 * the next badges start a second ring further out. Pure module.
 */

/** Where the first badge sits: just above the left-hand side (screen angles, 0 = right, clockwise). */
export const BADGE_START_DEGREES = 200
/** A badge's diameter as a share of the token's smaller side, with a floor so tiny tokens stay readable. */
export const BADGE_SHARE = 0.22
export const BADGE_MIN = 14
/** How far a badge's center sits outside the rim, as a share of its diameter: it overlaps the ring a little. */
const OUTSET = 0.2
/** Room between neighbours, as a share of the angle they need. */
const GAP = 1.08

export const badgeSize = (width: number, height: number, minimum = BADGE_MIN) => Math.max(minimum, Math.floor(Math.min(width, height) * BADGE_SHARE))

export type BadgeSpot = { x: number; y: number }

/**
 * The centers of `count` badges of diameter `size` around a token `width` × `height` (relative to its top left).
 * A square token is treated as the circle inside it; a long token as the ellipse inside it.
 */
export function badgeLayout(count: number, width: number, height: number, size: number): BadgeSpot[] {
  const spots: BadgeSpot[] = []
  const cx = width / 2
  const cy = height / 2
  let ring = 0
  while (spots.length < count) {
    const rx = width / 2 + size * (OUTSET + ring)
    const ry = height / 2 + size * (OUTSET + ring)
    // The angle one badge needs on this ring (measured on its smaller radius, so long tokens don't crowd).
    const step = 2 * Math.asin(Math.min(1, size / 2 / Math.min(rx, ry))) * GAP
    const perRing = Math.max(1, Math.floor((Math.PI * 2) / step))
    const start = (BADGE_START_DEGREES * Math.PI) / 180
    for (let index = 0; index < perRing && spots.length < count; index++) {
      const angle = start + index * step
      spots.push({ x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry })
    }
    ring++
  }
  return spots
}
