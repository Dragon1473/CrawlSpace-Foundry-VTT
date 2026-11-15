/**
 * Neighborhood and borough journals: what they hold, and the pure parts of what is made from them (mob tables, the
 * Borough Field Guide). The fields follow the app's neighborhood adventure (adventureModels.ts), with each quarter
 * carrying its own copy of the quarter-sized parts. Nothing here touches Foundry, so it is tested on its own.
 */

/** A linked document (a mob, NPC, trap, item…) or a custom entry with only a name. */
export type LinkEntry = { id: string; uuid: string; name: string; notes: string; quantity: number; weight: number }
/** A titled note: a hook, a story arc, a grinding event, a complication (with its roll range). */
export type NoteEntry = { id: string; name: string; description: string; roll: string }

/** What a list links to; it decides what can be dropped or picked there. */
export type LinkKind = 'mob' | 'boss' | 'npc' | 'trap' | 'item' | 'achievement' | 'reward' | 'quest' | 'neighborhood' | 'scene'

export type Field =
  | { type: 'text'; key: string; label: string }
  | { type: 'textarea'; key: string; label: string; hint?: string }
  | { type: 'links'; key: string; label: string; kind: LinkKind; quantity?: boolean; weight?: boolean }
  | { type: 'notes'; key: string; label: string; roll?: boolean }

export type Section = { id: string; label: string; fields: Field[] }

const note = (key: string, label: string, hint?: string): Field => ({ type: 'textarea', key, label, hint })
const links = (key: string, label: string, kind: LinkKind, extra: { quantity?: boolean; weight?: boolean } = {}): Field => ({ type: 'links', key, label, kind, ...extra })
const rows = (key: string, label: string, roll = false): Field => ({ type: 'notes', key, label, roll })

/** A quarter: the fields the builder's Add Quarter window offers, in its order. */
export const QUARTER_SECTIONS: Section[] = [
  { id: 'about', label: 'About', fields: [{ type: 'text', key: 'name', label: 'Name' }, note('description', 'Description'), note('environment', 'Environment', 'Terrain, atmosphere and hazards here.')] },
  { id: 'quests', label: 'Quests', fields: [note('quests', 'Quests'), links('questEntries', 'Quest journals', 'quest')] },
  { id: 'hooks', label: 'Hooks & Stories', fields: [note('hooks', 'Hooks & Stories'), rows('hookEntries', 'Hooks')] },
  { id: 'npcs', label: 'NPCs', fields: [note('npcs', 'NPCs'), links('npcEntries', 'NPCs', 'npc')] },
  { id: 'traps', label: 'Traps', fields: [note('traps', 'Traps'), links('trapEntries', 'Traps', 'trap')] },
  { id: 'mobs', label: 'Mobs', fields: [links('mobs', 'Mobs', 'mob', { weight: true })] },
  {
    id: 'items',
    label: 'Items',
    fields: [note('items', 'Items'), links('itemEntries', 'Items', 'item', { quantity: true }), links('questItemEntries', 'Quest items', 'item', { quantity: true })],
  },
  {
    id: 'achievements',
    label: 'Achievements & Rewards',
    fields: [note('achievements', 'Achievements & Rewards'), links('achievementEntries', 'Achievements', 'achievement'), links('rewardEntries', 'Rewards', 'reward', { quantity: true })],
  },
  {
    id: 'grinding',
    label: 'Grinding',
    fields: [note('grinding', 'Grinding encounters'), rows('grindingEvents', 'Encounters'), rows('grindingComplications', 'Complications', true)],
  },
]

/** A neighborhood: everything the app's neighborhood adventure has; quarters and the boss have their own tabs. */
export const NEIGHBORHOOD_SECTIONS: Section[] = [
  { id: 'summary', label: 'Summary & Overview', fields: [note('summary', 'Summary', 'A quick description, themes, and what this neighborhood offers.'), note('overview', 'Overview'), { type: 'text', key: 'tags', label: 'Tags' }] },
  { id: 'hooks', label: 'Hooks & Stories', fields: [note('strongStarts', 'Strong Starts'), rows('strongStartEntries', 'Strong Starts'), note('storyArcs', 'Story Arcs'), rows('storyArcEntries', 'Story Arcs')] },
  { id: 'mobs', label: 'Mobs', fields: [links('mobs', 'Mobs', 'mob')] },
  { id: 'environment', label: 'Environment', fields: [note('environment', 'Environment', 'Typical terrain, atmosphere, hazards, and differences from the rest of the floor.')] },
  { id: 'traps', label: 'Traps', fields: [note('traps', 'Traps'), links('trapEntries', 'Traps', 'trap')] },
  {
    id: 'items',
    label: 'Items',
    fields: [note('items', 'Items'), links('itemEntries', 'Items', 'item', { quantity: true }), note('questItems', 'Quest Items'), links('questItemEntries', 'Quest items', 'item', { quantity: true })],
  },
  {
    id: 'achievements',
    label: 'Achievements & Rewards',
    fields: [note('achievementsRewards', 'Achievements & Rewards'), links('achievementEntries', 'Achievements', 'achievement'), links('rewardEntries', 'Rewards', 'reward', { quantity: true })],
  },
  {
    id: 'grinding',
    label: 'Grinding',
    fields: [note('grindingNotes', 'Grinding for Experience', 'Optional encounters and events for extending a session.'), rows('grindingEvents', 'Grinding Events'), rows('grindingComplications', 'Complications', true)],
  },
  { id: 'npcs', label: 'NPCs', fields: [note('npcs', 'NPCs'), links('npcEntries', 'NPCs', 'npc')] },
]

export const BOROUGH_SECTIONS: Section[] = [{ id: 'about', label: 'About', fields: [note('summary', 'Description')] }]

const randomId = () => Math.random().toString(36).slice(2, 12).padEnd(10, '0')

export const linkEntry = (data: Partial<LinkEntry> = {}): LinkEntry => ({ id: randomId(), uuid: '', name: '', notes: '', quantity: 1, weight: 1, ...data })
export const noteEntry = (data: Partial<NoteEntry> = {}): NoteEntry => ({ id: randomId(), name: '', description: '', roll: '', ...data })

/** Every field of a set of sections at its empty value, plus the given ones. */
function emptyOf(sections: Section[]) {
  const data: Record<string, unknown> = {}
  for (const section of sections) for (const field of section.fields) data[field.key] = field.type === 'links' || field.type === 'notes' ? [] : ''
  return data
}

export type Quarter = Record<string, any> & { id: string; name: string; mobs: LinkEntry[]; mobTable: string; battlemap: { uuid: string; name: string }; zone: string }

export function newQuarter(data: Partial<Quarter> = {}): Quarter {
  return { ...(emptyOf(QUARTER_SECTIONS) as any), id: randomId(), mobTable: '', battlemap: { uuid: '', name: '' }, zone: '', ...data }
}

/** Where a field's value lives in a quarter or page's data, by dotted path ("quarters.2.mobs.0.notes"). */
export function getPath(data: any, path: string) {
  return path.split('.').reduce((value, key) => value?.[key], data)
}

/** A copy of `data` with the value at `path` replaced; arrays stay arrays. */
export function setPath<T>(data: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split('.')
  const copy: any = Array.isArray(data) ? [...data] : { ...(data as any) }
  copy[head] = rest.length ? setPath(copy[head] ?? (/^\d+$/.test(rest[0]) ? [] : {}), rest.join('.'), value) : value
  return copy
}

/** Moves the list entry at `index` by `by` places, if it can go there. */
export function moveEntry<T>(list: T[], index: number, by: number): T[] {
  const to = index + by
  if (to < 0 || to >= list.length) return list
  const copy = [...list]
  const [entry] = copy.splice(index, 1)
  copy.splice(to, 0, entry)
  return copy
}

/** The quarter mobs that go in its roll table: everything but bosses (by `isBoss`) and the neighborhood's own boss. */
export function tableMobs(mobs: LinkEntry[], bossUuid: string, isBoss: (uuid: string) => boolean) {
  return mobs.filter((mob) => !(mob.uuid && (mob.uuid === bossUuid || isBoss(mob.uuid))))
}

/** Roll table results for a quarter's mobs: one per mob, its weight its chance, ranges laid end to end. */
export function tableResults(mobs: LinkEntry[]) {
  let next = 1
  return mobs.map((mob) => {
    const weight = Math.max(1, Math.floor(Number(mob.weight) || 1))
    const range = [next, next + weight - 1]
    next += weight
    return mob.uuid
      ? { type: 'document', documentUuid: mob.uuid, name: mob.name, description: mob.notes, weight, range }
      : { type: 'text', name: mob.name || 'Mob', description: mob.notes, weight, range }
  })
}

export const fieldGuideName = (borough: string) => `Borough Field Guide; ${borough}`
export const neighborhoodMapName = (neighborhood: string) => `Neighborhood Map; ${neighborhood}`

/** One linked thing as the Field Guide shows it: its name, linked, and its description. */
export type GuideEntry = { uuid: string; name: string; description: string; notes: string }
export type GuideQuarter = { name: string; description: string; environment: string; npcs: GuideEntry[]; traps: GuideEntry[]; mobs: GuideEntry[]; bosses: GuideEntry[] }
export type GuideNeighborhood = { name: string; summary: string; overview: string; environment: string; npcs: GuideEntry[]; traps: GuideEntry[]; mobs: GuideEntry[]; boss: GuideEntry | null; bossQuarter: string; quarters: GuideQuarter[] }
export type GuideBorough = { name: string; summary: string; boss: GuideEntry | null; neighborhoods: GuideNeighborhood[] }

const escapeHtml = (value: string) => String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
/** Plain text with line breaks as paragraphs; any @UUID links in it are kept for Foundry to enrich. */
export const paragraphs = (value: string) =>
  String(value ?? '')
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (/^\s*</.test(part) ? part : `<p>${escapeHtml(part).replace(/\n/g, '<br>')}</p>`))
    .join('')

const link = (entry: GuideEntry) => (entry.uuid ? `@UUID[${entry.uuid}]{${entry.name.replace(/[{}]/g, '')}}` : escapeHtml(entry.name))
function entryList(title: string, entries: GuideEntry[]) {
  if (!entries.length) return ''
  const items = entries.map((entry) => `<li><strong>${link(entry)}</strong>${entry.description ? `<div>${entry.description}</div>` : ''}${entry.notes ? paragraphs(entry.notes) : ''}</li>`).join('')
  return `<h3>${escapeHtml(title)}</h3><ul>${items}</ul>`
}
const prose = (title: string, text: string) => (String(text ?? '').trim() ? `<h3>${escapeHtml(title)}</h3>${paragraphs(text)}` : '')

/**
 * The Borough Field Guide's pages: the borough, its boss, then each neighborhood followed by its quarters, with names,
 * descriptions, environments, NPCs, traps, mobs and bosses.
 */
export function fieldGuidePages(borough: GuideBorough): { name: string; content: string; level: number }[] {
  const pages = [{ name: borough.name, content: `${paragraphs(borough.summary)}`, level: 1 }]
  if (borough.boss) pages.push({ name: `Boss: ${borough.boss.name}`, content: `<p><strong>${link(borough.boss)}</strong></p>${borough.boss.description}${paragraphs(borough.boss.notes)}`, level: 1 })
  for (const hood of borough.neighborhoods) {
    const boss = hood.boss
      ? `<h3>Neighborhood Boss</h3><p><strong>${link(hood.boss)}</strong>${hood.bossQuarter ? ` (${escapeHtml(hood.bossQuarter)})` : ''}</p>${hood.boss.description}${paragraphs(hood.boss.notes)}`
      : ''
    pages.push({
      name: hood.name,
      content: [paragraphs(hood.summary), paragraphs(hood.overview), prose('Environment', hood.environment), entryList('NPCs', hood.npcs), entryList('Traps', hood.traps), entryList('Mobs', hood.mobs), boss, hood.quarters.length ? `<h3>Quarters</h3><ul>${hood.quarters.map((quarter) => `<li>${escapeHtml(quarter.name)}</li>`).join('')}</ul>` : ''].join(''),
      level: 1,
    })
    for (const quarter of hood.quarters)
      pages.push({
        name: `${hood.name}: ${quarter.name}`,
        content: [paragraphs(quarter.description), prose('Environment', quarter.environment), entryList('NPCs', quarter.npcs), entryList('Traps', quarter.traps), entryList('Mobs', quarter.mobs), entryList('Bosses', quarter.bosses)].join(''),
        level: 2,
      })
  }
  return pages
}
