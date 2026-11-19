/**
 * The bestiary's catalogue logic, kept free of Foundry so it can be tested: which actors are bestiary entries,
 * how module entries and the world actors made from them merge, and what the toolbar filters show.
 */

export type BestiaryCategory = 'Mob' | 'Boss' | 'Crawler' | 'NPC'
export const BESTIARY_CATEGORIES = ['main', 'Mob', 'Boss', 'Crawler', 'NPC', 'all'] as const
export type BestiaryCategoryFilter = (typeof BESTIARY_CATEGORIES)[number]

/** Where an entry comes from: the world (Actors directory), a world compendium, or a module's source id. */
export const HOMEBREW_SOURCES = ['world', 'pack'] as const

export interface BestiarySection {
  label: string
  text: string
}

export interface BestiaryEntry {
  /** Unique across sources: `world:<uuid>`, `pack:<uuid>`, `<source>:<id>`. */
  key: string
  /** 'world', 'pack', or a registered module source's id. */
  source: string
  /** The id inside its source (a module's catalogue id; the actor's UUID for homebrew). */
  id: string
  name: string
  category: BestiaryCategory
  img?: string
  pixelArt?: boolean
  /** A book or compendium name; the toolbar's second filter picks among these. */
  book?: string
  /** One line under the name (level, floor, pages…). */
  subtitle?: string
  sections?: BestiarySection[]
  note?: string
  /** The actor behind the entry: homebrew actors, or the world actor made from a module entry. */
  actorUuid?: string
  /** Text searched besides the name. */
  searchText?: string
  /** A homebrew mob changed from a module entry's mob: that entry's name. */
  basedOn?: string
}

/**
 * A mob or NPC actor's bestiary category; null for actors that aren't bestiary entries (crawlers, pets, minions,
 * raised or following mobs).
 */
export function actorCategory(actor: { type: string; system?: any }): BestiaryCategory | null {
  const system = actor.system ?? {}
  if (actor.type === 'npc') return 'NPC'
  if (actor.type !== 'mob' || system.master || system.minion?.temporary) return null
  if (system.crawler) return 'Crawler'
  return system.kind === 'boss' ? 'Boss' : 'Mob'
}

/** The link a world actor keeps to the module entry it was made from (flags.crawlspace.bestiary). */
export function actorLink(actor: { flags?: any }): { source: string; id: string } | null {
  const link = actor.flags?.crawlspace?.bestiary
  return link?.source && link.id !== undefined && link.id !== null && link.id !== '' ? { source: String(link.source), id: String(link.id) } : null
}

export interface LinkedActor {
  uuid: string
  name?: string
  img?: string
  /** The module entry it was made from in the bestiary (flags.crawlspace.bestiary). */
  link: { source: string; id: string } | null
  /** The compendium actor it was imported from (_stats.compendiumSource). */
  sourceUuid?: string | null
  /** Its data no longer matches that compendium actor (see actorSignature). */
  changed?: boolean
}

/** Module entries with the UUID of the compendium actor holding their stat block. */
export type ModuleEntry = BestiaryEntry & { statUuid?: string | null }

/**
 * World actors that are a module entry's own mob, unchanged, fold into that entry: the card points at the actor
 * (and shows its portrait) and the actor isn't listed again as homebrew. An actor is the entry's own when the
 * bestiary made it from the entry, or when it was imported from the entry's compendium actor.
 *
 * Once its data changes it's a mob of its own: it's listed as homebrew ("changed from" the entry) and the entry
 * shows the book's original again.
 */
export function mergeEntries(homebrew: BestiaryEntry[], modules: ModuleEntry[], actors: LinkedActor[]) {
  const byKey = new Map(modules.map((entry) => [`${entry.source}:${entry.id}`, entry]))
  const byStat = new Map<string, ModuleEntry[]>()
  for (const entry of modules) if (entry.statUuid) byStat.set(entry.statUuid, [...(byStat.get(entry.statUuid) ?? []), entry])
  /** The module entry an actor is a copy of: its link, else the entry with its compendium source (same name first). */
  const entryOf = (actor: LinkedActor) => {
    const linked = actor.link && byKey.get(`${actor.link.source}:${actor.link.id}`)
    if (linked) return linked
    const candidates = (actor.sourceUuid && byStat.get(actor.sourceUuid)) || []
    return candidates.find((entry) => entry.name === actor.name) ?? candidates[0]
  }
  const folded = new Map<string, LinkedActor>()
  const hidden = new Set<string>()
  const basedOn = new Map<string, ModuleEntry>()
  for (const actor of actors) {
    const entry = entryOf(actor)
    if (!entry) continue
    if (actor.changed) basedOn.set(actor.uuid, entry)
    else {
      // Another unchanged copy of the same mob is the same entry too.
      if (!folded.has(entry.key)) folded.set(entry.key, actor)
      hidden.add(actor.uuid)
    }
  }
  const merged = modules.map(({ statUuid: _stat, ...entry }) => {
    const actor = folded.get(entry.key)
    if (!actor) return entry
    return { ...entry, actorUuid: actor.uuid, img: actor.img || entry.img, pixelArt: actor.img && actor.img !== entry.img ? false : entry.pixelArt }
  })
  // Actors from a module that isn't loaded, or changed since, stay homebrew.
  const own = homebrew
    .filter((entry) => !(entry.actorUuid && hidden.has(entry.actorUuid)))
    .map((entry) => {
      const original = entry.actorUuid ? basedOn.get(entry.actorUuid) : undefined
      return original ? { ...entry, basedOn: original.name } : entry
    })
  return { homebrew: own, modules: merged as BestiaryEntry[] }
}

/** Data that doesn't make a mob a different mob: ids, sort order, ownership, flags, its look and damage taken. */
const IGNORED = new Set(['_id', '_stats', 'folder', 'sort', 'ownership', 'flags', 'img', 'prototypeToken', 'slotsLost', 'origin'])

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (!value || typeof value !== 'object') return value ?? null
  return Object.fromEntries(
    Object.keys(value)
      .filter((key) => !IGNORED.has(key))
      .sort()
      .map((key) => [key, canonical((value as any)[key])]),
  )
}

/**
 * What makes a mob the mob it is, to tell an untouched compendium import from one that was changed: its name,
 * system data, items and effects (ignoring ids, flags, portrait, token and damage taken). Items and effects are
 * compared without their order.
 */
export function actorSignature(data: any) {
  const list = (rows: any[] = []) => rows.map((row) => JSON.stringify(canonical(row))).sort()
  return JSON.stringify({ name: data?.name ?? '', system: canonical(data?.system ?? {}), items: list(data?.items), effects: list(data?.effects) })
}

export interface BestiaryFilters {
  search: string
  category: BestiaryCategoryFilter
  /** 'all', 'homebrew', or a module source id. */
  view: string
  /** '' for every book. */
  book: string
}

export const isHomebrew = (entry: BestiaryEntry) => (HOMEBREW_SOURCES as readonly string[]).includes(entry.source)

export function inView(entry: BestiaryEntry, view: string) {
  if (view === 'all') return true
  if (view === 'homebrew') return isHomebrew(entry)
  return entry.source === view
}

export function inCategory(entry: BestiaryEntry, category: BestiaryCategoryFilter) {
  if (category === 'all') return true
  if (category === 'main') return entry.category !== 'NPC'
  return entry.category === category
}

/** The entries the toolbar shows, by name. */
export function filterEntries(entries: BestiaryEntry[], filters: BestiaryFilters) {
  const query = filters.search.trim().toLowerCase()
  return entries
    .filter(
      (entry) =>
        inView(entry, filters.view) &&
        inCategory(entry, filters.category) &&
        (!filters.book || entry.book === filters.book) &&
        (!query || [entry.name, entry.searchText ?? '', ...(entry.sections ?? []).map((section) => section.text)].join(' ').toLowerCase().includes(query)),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** The books among the entries in view, for the book filter. */
export function booksIn(entries: BestiaryEntry[], view: string) {
  return [...new Set(entries.filter((entry) => inView(entry, view) && entry.book).map((entry) => entry.book as string))].sort((a, b) => a.localeCompare(b))
}

const STAT_ORDER = [
  ['str', 'STR'],
  ['dex', 'DEX'],
  ['con', 'CON'],
  ['int', 'INT'],
  ['cha', 'CHA'],
] as const

export interface StatBlock {
  kind: 'mob' | 'npc'
  level?: number
  floor?: number
  size?: string
  type?: string
  tags: string[]
  health?: { slots: number; perSlot: number }
  evade?: number
  dr?: number
  move?: number
  surprise?: number | null
  stats: { code: string; total: number | null; mod: number }[]
  attacks: { name: string; toHit: number; damage: string; types: string }[]
  abilities: { name: string; description: string }[]
  traits: { key: string; values: string[] }[]
}

const whole = (value: unknown) => Math.floor(Number(value) || 0)

/**
 * A mob's or NPC's stat block from its prepared system data. `damage` turns an attack's formula into the numbers
 * shown (the sheet's displayFormula).
 */
export function statBlockOf(type: string, system: any, damage: (formula: string) => string = (formula) => formula): StatBlock {
  const stats = STAT_ORDER.map(([key, code]) => {
    const attribute = system.attributes?.[key] ?? {}
    return { code, total: attribute.total === null || attribute.total === undefined ? null : whole(attribute.total), mod: whole(attribute.mod) }
  })
  const traits = ['immunities', 'resistances', 'vulnerabilities']
    .map((key) => ({ key, values: [...(system.traits?.[key] ?? [])].map(String).sort() }))
    .filter((trait) => trait.values.length)
  const tags = String(system.tags ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
  if (type === 'npc') return { kind: 'npc', floor: whole(system.floor), tags, stats, attacks: [], abilities: [], traits }
  return {
    kind: 'mob',
    level: whole(system.level),
    floor: whole(system.floor),
    size: system.size || undefined,
    type: system.type || undefined,
    tags,
    health: { slots: whole(system.health?.max), perSlot: whole(system.health?.perSlot) },
    evade: whole(system.evade?.total),
    dr: whole(system.dr?.total),
    move: whole(system.move?.total ?? system.move?.value),
    surprise: system.surpriseTotal === null || system.surpriseTotal === undefined ? null : whole(system.surpriseTotal),
    stats,
    attacks: (system.attacks ?? []).map((attack: any) => ({
      name: String(attack.name ?? ''),
      toHit: whole(attack.toHit ?? 10) - 10,
      damage: damage(String(attack.damage ?? '')),
      types: (attack.damageTypes ?? []).join(', '),
    })),
    abilities: (system.abilities ?? []).map((ability: any) => ({ name: String(ability.name ?? ''), description: String(ability.description ?? '') })),
    traits,
  }
}
