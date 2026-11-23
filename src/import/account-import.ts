/**
 * CrawlSpace account exports (docs/account-export-format.md in the app) and party backup zips
 * → Foundry document data. Pure, so it can be tested in Node; apps/account-import.ts does the
 * uploading and document creation.
 */
import { strFromU8, unzipSync } from 'fflate'
import { imagePath, mobToActor, stableId, toHtml } from './convert.ts'

export const IMAGE_PREFIX = 'crawlspace-image:'
const imageReferences = /crawlspace-image:([0-9a-f-]{32,64})/gi

export type ExportImage = { id: string; file: string; contentType: string; byteSize: number; filename?: string; kind?: string; folder?: string }
export type ExportParty = {
  id?: number
  party: { name: string; portrait: string | null }
  characters: { id: number; name: string; data: Record<string, any> }[]
  scenes: { id: string; name: string; is_active: boolean; gm_only: boolean; data: Record<string, any> }[]
  objects: { id: string; scene_id: string; kind: string; layer: string; asset_id?: string | null; data: Record<string, any> }[]
  directories?: Record<string, { entries: { id: string; content: Record<string, any> }[]; organization?: any }>
  local?: Record<string, any>
  [key: string]: unknown
}
export type AccountManifest = {
  format: 'crawlspace-account'
  version: 1
  exportedAt: string
  imagesIncluded: boolean
  account: { displayName: string; email: string; createdAt: string | null }
  images: ExportImage[]
  characters: { id: number; name: string; data: Record<string, any> }[]
  homebrew: { id: number; contentType: string; name: string; data: Record<string, any>; adaptedFrom?: unknown[] }[]
  macros: { macros: any[]; slots: any[] }
  parties: ExportParty[]
}
export type ImportBundle = { manifest: AccountManifest; files: Map<string, Uint8Array> }
export type ImportFile = { kind: 'account'; bundle: ImportBundle } | { kind: 'character'; json: any }

const record = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value)
const num = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback)
const list = (value: unknown): any[] => (Array.isArray(value) ? value : [])

/** A 32-hex-digit id for an image that was stored inside the data (cyrb128). */
function contentId(text: string) {
  let h1 = 1779033703,
    h2 = 3144134277,
    h3 = 1013904242,
    h4 = 2773480762
  for (let i = 0; i < text.length; i++) {
    const k = text.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  return [h1 ^ h2 ^ h3 ^ h4, h2 ^ h1, h3 ^ h1, h4 ^ h1].map((h) => (h >>> 0).toString(16).padStart(8, '0')).join('')
}

const extensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/avif': 'avif', 'image/svg+xml': 'svg', 'video/mp4': 'mp4', 'video/webm': 'webm' }
export const extensionFor = (contentType: string) => extensions[contentType?.toLowerCase()] ?? 'bin'

function base64Bytes(base64: string) {
  const binary = atob(base64.replace(/\s/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** A party backup keeps images as data: URLs and app links; give them the export's references. */
function liftImages<T>(value: T, images: Map<string, ExportImage>, files: Map<string, Uint8Array>, depth = 0): T {
  if (typeof value === 'string') {
    if (!value.includes('data:image/') && !value.includes('/assets/')) return value
    return value
      .replace(/data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\r\n]+)/gi, (_m, contentType: string, base64: string) => {
        const id = contentId(base64)
        if (!images.has(id)) {
          const bytes = base64Bytes(base64)
          const file = `inline/${id}.${extensionFor(contentType)}`
          files.set(file, bytes)
          images.set(id, { id, file, contentType: contentType.toLowerCase(), byteSize: bytes.length })
        }
        return IMAGE_PREFIX + id
      })
      .replace(/\/api\/(?:parties\/\d+\/)?assets\/([0-9a-f-]{36})\/image/gi, (_m, id: string) => IMAGE_PREFIX + id.toLowerCase()) as T
  }
  if (depth > 128 || !value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((item) => liftImages(item, images, files, depth + 1)) as T
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, liftImages(item, images, files, depth + 1)])) as T
}

/** The app's own party backup zip, read as an account export holding that one party. */
export function partyBackupBundle(backup: any, zipped: Record<string, Uint8Array> = {}): ImportBundle {
  if (!record(backup) || backup.format !== 'crawlspace-party') throw new Error('This is not a CrawlSpace party backup.')
  const images = new Map<string, ExportImage>()
  const files = new Map<string, Uint8Array>()
  for (const asset of list(backup.assets)) {
    const bytes = zipped[`assets/${asset.id}`]
    if (bytes) files.set(`assets/${asset.id}`, bytes)
    images.set(asset.id, { id: asset.id, file: `assets/${asset.id}`, contentType: asset.content_type, byteSize: asset.byte_size, filename: asset.filename, kind: asset.kind, folder: asset.folder_path })
  }
  const { assets: _assets, ...party } = backup
  const lifted = liftImages(party, images, files)
  return {
    manifest: {
      format: 'crawlspace-account',
      version: 1,
      exportedAt: backup.exportedAt,
      imagesIncluded: files.size > 0,
      account: { displayName: '', email: '', createdAt: null },
      images: [...images.values()],
      characters: [],
      homebrew: [],
      macros: { macros: [], slots: [] },
      parties: [lifted as ExportParty],
    },
    files,
  }
}

function accountBundle(manifest: any, files = new Map<string, Uint8Array>()): ImportBundle {
  if (manifest.version !== 1) throw new Error(`This export is version ${manifest.version}; this system reads version 1. Update the CrawlSpace system.`)
  for (const key of ['images', 'characters', 'homebrew', 'parties']) if (!Array.isArray(manifest[key])) throw new Error(`The export's ${key} are missing.`)
  manifest.macros = record(manifest.macros) ? manifest.macros : { macros: [], slots: [] }
  return { manifest, files }
}

/** An account export (zip or JSON), a party backup zip, or anything else as a character backup. */
export function readImportFile(bytes: Uint8Array): ImportFile {
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const zipped = unzipSync(bytes)
    if (zipped['crawlspace-export.json']) {
      const manifest = JSON.parse(strFromU8(zipped['crawlspace-export.json']))
      const files = new Map(Object.entries(zipped).filter(([name]) => name !== 'crawlspace-export.json'))
      return { kind: 'account', bundle: accountBundle(manifest, files) }
    }
    if (zipped['party.json']) return { kind: 'account', bundle: partyBackupBundle(JSON.parse(strFromU8(zipped['party.json'])), zipped) }
    throw new Error('This zip is not a CrawlSpace export or party backup.')
  }
  const json = JSON.parse(strFromU8(bytes))
  if (json?.format === 'crawlspace-account') return { kind: 'account', bundle: accountBundle(json) }
  if (json?.format === 'crawlspace-party') return { kind: 'account', bundle: partyBackupBundle(json) }
  return { kind: 'character', json }
}

/** Every `crawlspace-image:<id>` in a value becomes the uploaded path, or the fallback when it wasn't uploaded. */
export function resolveImages<T>(value: T, path: (id: string) => string | null, fallback = '', depth = 0): T {
  if (typeof value === 'string') return (value.includes(IMAGE_PREFIX) ? value.replace(imageReferences, (_m, id) => path(id.toLowerCase()) ?? fallback) : value) as T
  if (depth > 128 || !value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((item) => resolveImages(item, path, fallback, depth + 1)) as T
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveImages(item, path, fallback, depth + 1)])) as T
}

/** The ids of every image a value uses, by reference or asset id field. */
export function usedImageIds(value: unknown, ids = new Set<string>(), depth = 0): Set<string> {
  if (typeof value === 'string') {
    for (const match of value.matchAll(imageReferences)) ids.add(match[1].toLowerCase())
    return ids
  }
  if (depth > 128 || !value || typeof value !== 'object') return ids
  for (const [key, child] of Object.entries(value)) {
    if (['assetId', 'mapAssetId', 'foregroundAssetId', 'fogAssetId', 'textureAssetId', 'asset_id'].includes(key) && typeof child === 'string' && child) ids.add(child.toLowerCase())
    usedImageIds(child, ids, depth + 1)
  }
  return ids
}

/* ------------------------------------------------------------------ */
/*  Scenes                                                             */
/* ------------------------------------------------------------------ */

/** Foundry's smallest grid cell. */
const MIN_GRID = 50
/** Foundry's largest scene padding. */
const MAX_PADDING = 0.5
const mod = (value: number, size: number) => ((value % size) + size) % size
const round = (value: number) => Math.round(value * 100) / 100 + 0

type Box = { x: number; y: number; width: number; height: number }
const union = (boxes: Box[]): Box => {
  const x = Math.min(...boxes.map((box) => box.x))
  const y = Math.min(...boxes.map((box) => box.y))
  return { x, y, width: Math.max(...boxes.map((box) => box.x + box.width)) - x, height: Math.max(...boxes.map((box) => box.y + box.height)) - y }
}
/** The upright box around a box turned about its center. */
const turned = (box: Box, degrees: number): Box => {
  const cos = Math.abs(Math.cos((degrees * Math.PI) / 180))
  const sin = Math.abs(Math.sin((degrees * Math.PI) / 180))
  const width = box.width * cos + box.height * sin
  const height = box.width * sin + box.height * cos
  return { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height }
}
/** A V14 tile for a top-left box: Foundry positions and turns tiles by their center. */
const tileShape = (src: string, box: Box) => ({
  texture: { src, anchorX: 0.5, anchorY: 0.5 },
  x: round(box.x + box.width / 2),
  y: round(box.y + box.height / 2),
  width: round(box.width),
  height: round(box.height),
})

/**
 * App scenes have a map area plus a border of max(area × canvasPadding, two unscaled cells) when
 * padding is on (vttSceneSurface.ts). Most things are placed in percentages of that whole surface,
 * drawings in its pixels. This turns both into Foundry pixels from the map area's corner.
 */
export function sceneGeometry(data: Record<string, any>) {
  const config = record(data.configuration) ? data.configuration : {}
  const mapWidth = num(config.sceneWidthPixels, 2000)
  const mapHeight = num(config.sceneHeightPixels, 1200)
  const baseCell = num(config.gridCellSize, 100)
  const cellX = baseCell * num(config.gridScaleX, 1)
  const cellY = baseCell * num(config.gridScaleY, 1)
  const padding = num(config.canvasPadding, 0)
  const borderX = padding > 0 ? Math.max(mapWidth * padding, 2 * baseCell) : 0
  const borderY = padding > 0 ? Math.max(mapHeight * padding, 2 * baseCell) : 0
  const surfaceWidth = mapWidth + 2 * borderX
  const surfaceHeight = mapHeight + 2 * borderY
  // Foundry's cells are square whole pixels: scale each axis onto them so the grid doesn't drift across the map.
  const size = Math.round(Math.max(MIN_GRID, cellX, cellY))
  const scale = { x: size / cellX, y: size / cellY }
  const pixel = (x: number, y: number) => ({ x: round((x - borderX) * scale.x), y: round((y - borderY) * scale.y) })
  const point = (x: number, y: number) => pixel((num(x, 0) * surfaceWidth) / 100, (num(y, 0) * surfaceHeight) / 100)
  return {
    scale,
    size,
    width: Math.round(mapWidth * scale.x),
    height: Math.round(mapHeight * scale.y),
    /** Where one of the app's grid intersections falls. */
    gridLine: point(data.gridOffsetX, data.gridOffsetY),
    point,
    pixel,
    length: (percentX: number, percentY: number) => ({ width: round(((num(percentX, 0) * surfaceWidth) / 100) * scale.x), height: round(((num(percentY, 0) * surfaceHeight) / 100) * scale.y) }),
  }
}
type Point = (x: number, y: number) => { x: number; y: number }

/** Foundry wall sense and movement values (CONST.WALL_SENSE_TYPES, WALL_MOVEMENT_TYPES, WALL_DOOR_TYPES, WALL_DOOR_STATES). */
const NONE = 0,
  LIMITED = 10,
  NORMAL = 20
export function wallToFoundry(wall: Record<string, any>, point: Point) {
  const a = point(wall.x1, wall.y1)
  const b = point(wall.x2, wall.y2)
  const senses: Record<string, [number, number, number, number]> = {
    normal: [NORMAL, NORMAL, NORMAL, NORMAL],
    invisible: [NORMAL, NONE, NONE, NONE],
    ethereal: [NONE, NORMAL, NORMAL, NONE],
    terrain: [NORMAL, LIMITED, LIMITED, LIMITED],
    window: [NORMAL, NONE, NONE, NORMAL],
    door: [NORMAL, NORMAL, NORMAL, NORMAL],
    secretDoor: [NORMAL, NORMAL, NORMAL, NORMAL],
  }
  const [move, sight, light, sound] = senses[wall.type] ?? senses.normal
  const door = wall.type === 'door' ? 1 : wall.type === 'secretDoor' ? 2 : 0
  const ds = !door ? 0 : wall.doorState === 'open' ? 1 : wall.doorState === 'locked' ? 2 : 0
  return { c: [a.x, a.y, b.x, b.y], move, sight, light, sound, door, ds }
}

const animations: Record<string, string | null> = { None: null, Chroma: 'chroma', 'Flickering Light': 'flame', Pulse: 'pulse', Torch: 'torch' }
const colorations = ['Legacy Coloration', 'Adaptive Luminance', 'Internal Halo', 'External Halo', 'Color Burn', 'Internal Color Burn', 'External Color Burn', 'Low Absorption', 'High Absorption', 'Invert Absorption', 'Natural Light']

function lightConfig(source: Record<string, any>) {
  const light = record(source.light) ? source.light : {}
  const advanced = record(source.advanced) ? source.advanced : {}
  const animation = record(source.animation) ? source.animation : {}
  return {
    bright: Math.max(0, num(light.brightFeet, 0)),
    dim: Math.max(0, num(light.dimFeet, 0)),
    color: typeof light.color === 'string' && /^#[0-9a-f]{6}$/i.test(light.color) ? light.color : null,
    alpha: num(light.opacity, 0.5),
    angle: num(source.lightAngle, 360),
    coloration: Math.max(0, colorations.indexOf(advanced.coloration)),
    luminosity: num(advanced.luminosity, 0.5),
    attenuation: num(advanced.attenuation, 0.5),
    saturation: num(advanced.saturation, 0),
    contrast: num(advanced.contrast, 0),
    shadows: num(advanced.shadows, 0),
    animation: { type: animations[animation.type] ?? null, speed: num(animation.speed, 5), intensity: num(animation.intensity, 5), reverse: animation.reverse === true },
    darkness: { min: num(source.darknessMin, 0), max: num(source.darknessMax, 1) },
  }
}

const dispositions: Record<string, number> = {
  'Other Crawlers': 1,
  'Pets and Familiars': 1,
  'Minion (or Mercenary)': 1,
  'Hostile NPCs': -1,
  Elites: -1,
}

const fillTypes: Record<string, number> = { none: 0, solid: 1, texture: 2 }
const fonts: Record<string, string> = { 'sans-serif': 'Signika', serif: 'Modesto Condensed', monospace: 'Courier' }

export type SceneContext = {
  image: (id: string) => string | null
  /** The imported actor for an app character id. */
  crawler: (characterId: number) => { actorId: string } | null
  /** The imported actor for a mob token. */
  mob: (token: Record<string, any>) => { actorId: string } | null
}

/** One app scene and its objects → Foundry Scene data plus its embedded documents, in map pixels. */
export function convertScene(scene: ExportParty['scenes'][number], objects: ExportParty['objects'], context: SceneContext) {
  const data = record(scene.data) ? scene.data : {}
  const config = record(data.configuration) ? data.configuration : {}
  const geometry = sceneGeometry(data)
  const { point, pixel, length, scale } = geometry
  const ref = (value: unknown) => {
    if (typeof value !== 'string' || !value) return null
    const id = value.startsWith(IMAGE_PREFIX) ? value.slice(IMAGE_PREFIX.length) : value
    return /^[0-9a-f-]{32,64}$/i.test(id) ? context.image(id.toLowerCase()) : imagePath(value) || null
  }
  const mapSrc = ref(data.mapAssetId)
  const result = {
    scene: {
      name: scene.name || 'Scene',
      navigation: config.showInNavigation !== false,
      navName: typeof config.navigationName === 'string' ? config.navigationName : '',
      width: geometry.width,
      height: geometry.height,
      padding: 0,
      shiftX: 0,
      shiftY: 0,
      // V14 keeps the map, its color and the foreground on the scene's level; frameScene places them.
      levels: [
        {
          _id: 'defaultLevel0000',
          name: scene.name || 'Scene',
          background: { src: mapSrc, color: typeof config.backgroundColor === 'string' ? config.backgroundColor : '#999999' },
          foreground: { src: ref(config.foregroundAssetId) },
          ...(num(config.foregroundElevation, 0) ? { elevation: { top: num(config.foregroundElevation, 0) } } : {}),
        },
      ],
      grid: {
        type: config.gridType === 'gridless' ? 0 : 1,
        size: geometry.size,
        distance: num(config.gridDistance, 5),
        units: typeof config.gridUnits === 'string' ? config.gridUnits : 'ft',
        color: typeof config.gridColor === 'string' ? config.gridColor : '#000000',
        alpha: num(config.gridOpacity, 0.2),
      },
      tokenVision: config.tokenVision !== false,
      fog: { exploration: config.fogExploration !== false },
      environment: {
        darknessLevel: num(config.darkness, 0),
        globalLight: { enabled: config.globalIllumination === true, darkness: { max: num(config.globalIlluminationThreshold, 1) } },
      },
      // The app saves its view as a pan in screen pixels, which means nothing here: Foundry fits the scene instead.
      initial: { x: null, y: null, scale: null },
      ownership: scene.gm_only ? { default: 0 } : undefined,
      flags: { crawlspace: { appSceneId: scene.id } },
    },
    walls: list(data.walls).map((wall) => wallToFoundry(wall, point)),
    lights: list(data.lights).map((light) => ({
      ...point(light.x, light.y),
      rotation: num(light.rotation, 0),
      walls: light.constrainedByWalls !== false,
      vision: record(light.advanced) && light.advanced.providesVision === true,
      hidden: record(light.light) && light.light.enabled === false,
      config: lightConfig(light),
    })),
    tiles: [] as any[],
    drawings: [] as any[],
    notes: [] as any[],
    tokens: [] as any[],
  }
  const tileData = (tile: Record<string, any>) => {
    const src = ref(tile.textureAssetId)
    if (!src) return null
    return {
      ...tileShape(src, { ...point(tile.x, tile.y), ...length(tile.width, tile.height) }),
      rotation: num(tile.rotation, 0),
      alpha: num(tile.opacity, 1),
      hidden: tile.hidden === true,
      locked: tile.locked === true,
      sort: num(tile.sort, 0),
    }
  }
  const allObjects = [
    ...list(data.tiles).map((tile) => ({ kind: 'drawing', layer: 'tiles', data: tile })),
    ...list(data.drawings).map((drawing) => ({ kind: 'drawing', layer: 'drawings', data: drawing })),
    ...list(data.tokens).map((token) => ({ kind: 'token', layer: 'objects', data: token })),
    ...objects.filter((object) => object.scene_id === scene.id),
  ]
  for (const object of allObjects) {
    const item = record(object.data) ? object.data : {}
    if (object.kind === 'drawing' && object.layer === 'tiles') {
      const tile = tileData(item)
      if (tile) result.tiles.push(tile)
    } else if (object.kind === 'drawing' && object.layer === 'journals') {
      const entry = record(item.entry) ? item.entry : {}
      result.notes.push({
        key: String((object as { id?: string }).id ?? item.id ?? `${result.notes.length}`),
        ...point(item.x, item.y),
        text: typeof item.hoverText === 'string' && item.hoverText ? item.hoverText : entry.name ?? '',
        hidden: item.hidden === true,
        journal: journalToFoundry(entry, (value) => (typeof value === 'string' ? value : '')),
      })
    } else if (object.kind === 'drawing' && object.layer === 'drawings') {
      const corner = pixel(num(item.x, 0), num(item.y, 0))
      const size = { width: round(num(item.width, 0) * scale.x), height: round(num(item.height, 0) * scale.y) }
      const shape =
        item.type === 'rectangle' || item.type === 'text' ? { type: 'r', ...size } : item.type === 'ellipse' ? { type: 'e', ...size } : {
          type: 'p',
          ...size,
          // Already measured from the drawing's own corner.
          points: list(item.points).flatMap((p) => [round(num(p.x, 0) * scale.x), round(num(p.y, 0) * scale.y)]),
        }
      result.drawings.push({
        ...corner,
        shape,
        rotation: num(item.rotation, 0),
        elevation: num(item.elevation, 0),
        bezierFactor: item.type === 'freehand' ? Math.min(0.5, num(item.smoothing, 0.5)) : 0,
        strokeWidth: item.type === 'text' ? 0 : Math.round(num(item.strokeWidth, 8) * scale.x),
        strokeColor: item.strokeColor ?? '#f4d45f',
        strokeAlpha: num(item.strokeOpacity, 1),
        fillType: fillTypes[item.fillType] ?? 0,
        fillColor: item.fillColor ?? '#ffffff',
        fillAlpha: num(item.fillOpacity, 0.5),
        texture: item.fillType === 'texture' ? ref(item.textureAssetId) : null,
        text: typeof item.text === 'string' ? item.text : '',
        fontFamily: fonts[item.fontFamily] ?? 'Signika',
        fontSize: Math.min(256, Math.max(8, Math.round(num(item.fontSize, 48) * scale.y))),
        textColor: item.textColor ?? '#ffffff',
        textAlpha: num(item.textOpacity, 1),
        hidden: item.hidden === true,
        locked: item.locked === true,
      })
    } else if (object.kind === 'token') {
      const crawler = Number.isSafeInteger(item.characterId) ? context.crawler(item.characterId) : null
      const mob = crawler ? null : context.mob(item)
      const width = Math.max(0.5, num(item.width, num(item.combatant?.tokenSize, 1)))
      const height = Math.max(0.5, num(item.height, width))
      const center = point(item.x, item.y)
      const vision = num(item.visionRangeFeet, NaN)
      const light = record(item.light) ? item.light : null
      result.tokens.push({
        name: typeof item.label === 'string' && item.label ? item.label : item.combatant?.name ?? 'Token',
        actorId: crawler?.actorId ?? mob?.actorId ?? null,
        actorLink: !!crawler,
        x: Math.round(center.x - (width * geometry.size) / 2),
        y: Math.round(center.y - (height * geometry.size) / 2),
        width,
        height,
        rotation: num(item.rotation, 0),
        elevation: num(item.elevation, 0),
        hidden: item.hidden === true,
        lockRotation: item.lockRotation === true,
        disposition: item.secretDisposition === true ? -2 : crawler ? 1 : dispositions[item.disposition] ?? (item.combatant?.kind === 'mob' ? -1 : 0),
        ...(ref(item.image) ? { texture: { src: ref(item.image) } } : {}),
        sight: { enabled: item.visionEnabled !== false && (crawler !== null || Number.isFinite(vision)), range: Number.isFinite(vision) ? vision : 60 },
        ...(light && light.enabled ? { light: { bright: num(light.brightFeet, 0), dim: num(light.dimFeet, 0), color: light.color ?? null, alpha: num(light.opacity, 0.5) } } : {}),
        flags: { crawlspace: { appTokenId: item.id ?? null } },
      })
    }
  }
  frameScene(result, data, geometry)
  return result
}

/**
 * Chooses the Foundry scene's rectangle and measures everything from its corner. The map, as resized
 * and moved in the app, is that rectangle and its background. A map that can't be one (turned,
 * see-through, under a foreground of another size, or with things too far off it for padding) is a
 * tile on a scene big enough for all of it.
 */
function frameScene(converted: Record<string, any>, data: Record<string, any>, geometry: ReturnType<typeof sceneGeometry>) {
  const { scene, walls, lights, tiles, drawings, notes, tokens } = converted
  const { scale, size } = geometry
  const config = record(data.configuration) ? data.configuration : {}
  const transform = record(data.mapTransform) ? data.mapTransform : {}
  const [level] = scene.levels
  const src = level.background.src
  const area = { x: 0, y: 0, width: geometry.width, height: geometry.height }
  // The app's sceneMapRectangle: percentages of the map area, plus an offset in its pixels.
  const map = !src ? area : {
    x: (num(transform.x, 0) / 100) * area.width + num(config.backgroundOffsetX, 0) * scale.x,
    y: (num(transform.y, 0) / 100) * area.height + num(config.backgroundOffsetY, 0) * scale.y,
    width: (num(transform.width, 100) / 100) * area.width,
    height: (num(transform.height, 100) / 100) * area.height,
  }
  const rotation = src ? num(transform.rotation, 0) : 0
  const alpha = src ? num(transform.opacity, 1) : 1
  const spot = (x: number, y: number) => ({ x, y, width: 0, height: 0 })
  const content: Box[] = [
    ...walls.flatMap(({ c }: any) => [spot(c[0], c[1]), spot(c[2], c[3])]),
    ...[...lights, ...notes].map((doc: any) => spot(doc.x, doc.y)),
    ...tiles.map((tile: any) => turned({ x: tile.x - tile.width / 2, y: tile.y - tile.height / 2, width: tile.width, height: tile.height }, tile.rotation)),
    ...drawings.map((drawing: any) => turned({ x: drawing.x, y: drawing.y, width: drawing.shape.width, height: drawing.shape.height }, drawing.rotation)),
    ...tokens.map((token: any) => ({ x: token.x, y: token.y, width: token.width * size, height: token.height * size })),
  ]
  // Foundry's grid starts at the canvas corner: slide the scene under it, by half a cell at most.
  const shiftFor = (rect: Box) => {
    const nearest = (value: number) => Math.round(mod(Math.round(value) + size / 2, size) - size / 2)
    return scene.grid.type ? { x: nearest(geometry.gridLine.x - rect.x), y: nearest(geometry.gridLine.y - rect.y) } : { x: 0, y: 0 }
  }
  /** The padding that keeps these boxes on the canvas around a scene rectangle. */
  const paddingFor = (rect: Box, boxes: Box[]) => {
    const all = union([rect, ...boxes])
    const shift = shiftFor(rect)
    const x = Math.max(rect.x - all.x + shift.x, all.x + all.width - rect.x - rect.width - shift.x) / rect.width
    const y = Math.max(rect.y - all.y + shift.y, all.y + all.height - rect.y - rect.height - shift.y) / rect.height
    return Math.ceil(Math.max(0, x, y) * 20) / 20
  }

  const foreground = !!level.foreground.src
  const coversArea = (['x', 'y', 'width', 'height'] as const).every((key) => Math.abs(map[key] - area[key]) < 1)
  const asBackground = !rotation && alpha === 1 && (!foreground || coversArea) && paddingFor(map, content) <= MAX_PADDING
  // A foreground always covers the map area, so that stays the scene when there is one.
  const rect = asBackground ? map : foreground ? area : union([area, turned(map, rotation), ...content])

  if (!asBackground && src) {
    level.background.src = null
    tiles.unshift({ ...tileShape(src, map), rotation, alpha, hidden: false, locked: true, sort: Math.min(0, ...tiles.map((tile: any) => tile.sort)) - 1 })
  }
  const shift = shiftFor(rect)
  scene.width = Math.round(rect.width)
  scene.height = Math.round(rect.height)
  scene.shiftX = shift.x
  scene.shiftY = shift.y
  // Room for the rest of the app's board and anything off the map.
  const border = Math.ceil(num(config.canvasPadding, 0) * 20) / 20
  scene.padding = Math.min(MAX_PADDING, Math.max(border, paddingFor(rect, [area, turned(map, rotation), ...content])))

  for (const doc of [...lights, ...notes, ...tiles, ...drawings]) Object.assign(doc, { x: round(doc.x - rect.x), y: round(doc.y - rect.y) })
  for (const token of tokens) Object.assign(token, { x: Math.round(token.x - rect.x), y: Math.round(token.y - rect.y) })
  for (const wall of walls) wall.c = wall.c.map((value: number, index: number) => round(value - (index % 2 ? rect.y : rect.x)))
}

/* ------------------------------------------------------------------ */
/*  Other documents                                                    */
/* ------------------------------------------------------------------ */

/** A party journal (pages of HTML) → JournalEntry data. */
export function journalToFoundry(entry: Record<string, any>, html: (value: unknown) => string = (value) => String(value ?? '')) {
  const name = String(entry?.name || 'Journal')
  const pages = list(entry?.pages).map((page, index) => ({
    name: String(page?.name || name),
    type: 'text',
    text: { content: html(page?.html) || toHtml(page?.text ?? ''), format: 1 },
    sort: index * 1000,
  }))
  return { name, pages: pages.length ? pages : [{ name, type: 'text', text: { content: toHtml(entry?.data?.description ?? ''), format: 1 } }] }
}

/** A mob placed straight from an encounter (no saved actor) → a mob actor from its token's snapshot. */
export function combatantToMob(combatant: Record<string, any>, img?: string | null) {
  const attacks = list(combatant.attacks).map((attack) => ({
    name: attack?.name,
    damage: attack?.damage?.formula ?? attack?.damage?.expression ?? (typeof attack?.damage === 'string' ? attack.damage : ''),
    failedDebuff: attack?.failedDebuff ?? '',
  }))
  const actor: any = mobToActor(
    String(combatant.baseName || combatant.name || 'Mob'),
    { kind: combatant.boss ? 'boss' : 'mob', flavor: combatant.flavor ?? '', stats: { evade: combatant.evade }, attacks, currentFloor: combatant.floor },
    `token-${combatant.id ?? combatant.name}`,
  )
  if (imagePath(img)) actor.img = img
  actor.flags = { crawlspace: { combatant } }
  return actor
}

/** An app hotbar macro → a Foundry macro. App scripts call the app's API, so they come in commented out. */
export function macroToFoundry(macro: Record<string, any>) {
  const name = String(macro.name || 'Macro')
  const text = String(macro.text ?? '')
  const formula = String(macro.formula ?? '').trim()
  if (macro.type === 'script')
    return {
      name,
      type: 'script',
      command: `/* Imported from CrawlSpace. This script used the CrawlSpace app's commands; rewrite it for Foundry. */\n${text
        .split('\n')
        .map((line) => `// ${line}`)
        .join('\n')}`,
    }
  return { name, type: 'chat', command: [text, formula ? `/r ${formula}` : ''].filter(Boolean).join('\n') }
}

/** Stable Foundry ids for re-imports of the same export. */
export const importId = (...parts: (string | number)[]) => stableId(`crawlspace-import-${parts.join('-')}`)

/** The key that finds an imported document again when the same export is imported later. */
export const importKey = (...parts: (string | number)[]) => parts.join(':')

/** Where an export's crawlers come from. App ids repeat between environments, and a party backup only names its party. */
export function importSource({ account, parties }: AccountManifest) {
  const id = account.createdAt || account.displayName
  return id ? `account:${id}` : `party:${parties[0]?.party?.name ?? ''}`
}

/** An actor an earlier import may have made. Its folders identify imports from before sources were recorded. */
export type ImportedCrawler = { id: string; name: string; key?: string; source?: string; folders: string[] }
export type CrawlerQuestion = { id: number; name: string; candidates: ImportedCrawler[] }

/**
 * Which actor each crawler refreshes. Only one with the same id, name and source is refreshed
 * unasked; the same id with just one of those is the GM's call; any other gets a new actor.
 */
export function matchCrawlers(crawlers: { id: number; name: string }[], actors: ImportedCrawler[], source: string, rootFolder: string) {
  const update = new Map<number, string>()
  const ask: CrawlerQuestion[] = []
  const plain = (name: string) => name.trim().toLowerCase()
  for (const { id, name } of crawlers) {
    const key = importKey('character', id)
    const found = actors
      .filter((actor) => actor.key === key)
      .map((actor) => ({
        actor,
        sameName: plain(actor.name) === plain(name),
        sameSource: actor.source ? actor.source === source : actor.folders.includes(rootFolder),
      }))
    const same = found.filter((entry) => entry.sameName && entry.sameSource)
    const recorded = same.filter((entry) => entry.actor.source)
    const certain = recorded.length ? recorded : same
    const possible = found.filter((entry) => entry.sameName || entry.sameSource)
    if (certain.length === 1) update.set(id, certain[0].actor.id)
    else if (possible.length) ask.push({ id, name, candidates: possible.map((entry) => entry.actor) })
  }
  return { update, ask }
}

const embeddedFields: Record<string, Record<string, string>> = {
  Actor: { items: 'Item', effects: 'ActiveEffect' },
  Item: { effects: 'ActiveEffect' },
  JournalEntry: { pages: 'JournalEntryPage' },
  RollTable: { results: 'TableResult' },
}

/**
 * How a re-import refreshes a document it made before: its content is replaced, its embedded
 * documents are recreated, and the folder, ownership and sort the GM gave it are kept.
 */
export function reimportUpdate(documentName: string, data: Record<string, any>) {
  const { _id, folder, ownership, sort, ...update } = data
  const embedded: Record<string, any[]> = {}
  for (const [field, name] of Object.entries(embeddedFields[documentName] ?? {})) {
    if (!(field in update)) continue
    embedded[name] = Array.isArray(update[field]) ? update[field] : []
    delete update[field]
  }
  return { update, embedded }
}
