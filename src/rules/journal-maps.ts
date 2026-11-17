/**
 * Image maps for region journals (journals/maps.ts): a plain image becomes a scene of the same size with the
 * image as its background. No stitching; that is CrawlSpace Atlas's job. Pure module.
 */
const FALLBACK = { width: 4000, height: 3000 }
const SMALLEST = 100
/** The id of a new scene's one level. */
export const MAP_LEVEL = 'defaultLevel0000'

const side = (value: number, fallback: number) => (Number.isFinite(value) && value >= SMALLEST ? Math.floor(value) : fallback)

/** The new scene for an image map: the image's own size, no padding, a 100 px square grid, the image on its level. */
export function mapSceneData(name: string, src: string, size: { width: number; height: number }) {
  return {
    name,
    // Foundry V14 keeps the map image on the scene's level, not on the scene.
    levels: [{ _id: MAP_LEVEL, name, background: { src } }],
    width: side(size.width, FALLBACK.width),
    height: side(size.height, FALLBACK.height),
    padding: 0,
    grid: { type: 1, size: 100 },
  }
}
