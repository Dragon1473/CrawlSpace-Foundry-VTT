/** Headshots: a square crop of an actor's portrait, shown in the boss battle's VS. overlay. Pure module. */
export const DEFAULT_IMG = 'icons/svg/mystery-man.svg'
export const HEADSHOT_ZOOM_MAX = 6

const usable = (path: unknown) => (typeof path === 'string' && path.trim() && path.trim() !== DEFAULT_IMG ? path.trim() : '')

/** The saved headshot, else the portrait (unless it is the default silhouette), else the token art. */
export function headshotOf({ headshot, portrait, token }: { headshot?: unknown; portrait?: unknown; token?: unknown }) {
  return usable(headshot) || usable(portrait) || usable(token) || DEFAULT_IMG
}

/**
 * The square of the picture to keep. Zoom 1 is the largest square that fits; x and y (0–1) place its centre,
 * and the square is pushed back inside the picture when it would leave it.
 */
export function headshotCrop({ width, height }: { width: number; height: number }, { zoom, x, y }: { zoom: number; x: number; y: number }) {
  const z = Math.min(HEADSHOT_ZOOM_MAX, Math.max(1, Number(zoom) || 1))
  const side = Math.max(1, Math.floor(Math.min(width, height) / z))
  const place = (fraction: number, length: number) => {
    const centre = Math.min(1, Math.max(0, Number(fraction) || 0)) * length
    return Math.floor(Math.min(length - side, Math.max(0, centre - side / 2)))
  }
  return { sx: place(x, width), sy: place(y, height), side }
}
