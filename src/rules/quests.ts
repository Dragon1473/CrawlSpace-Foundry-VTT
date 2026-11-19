/**
 * Quests on the party screen, kept free of Foundry so they can be tested. The GM writes them; they live in a world
 * setting so every client gets them. Players see accepted (then completed) quests and read only the summary; the
 * GM sees every quest and every section. Linked sections hold actors and items (dragged in or added from a list),
 * kept as { uuid, name, img } so the list draws without loading compendiums.
 */

export type QuestStatus = 'offered' | 'accepted' | 'completed'
export const QUEST_STATUSES: QuestStatus[] = ['accepted', 'offered', 'completed']

export interface QuestLink {
  uuid: string
  name: string
  img: string
}
export interface QuestStage {
  id: string
  text: string
  done: boolean
}

/** Sections that link actors or items, and what each takes. */
export const QUEST_LINK_SECTIONS = [
  { key: 'mobs', documentName: 'Actor', types: ['mob'], boss: false },
  { key: 'bosses', documentName: 'Actor', types: ['mob'], boss: true },
  { key: 'traps', documentName: 'Item', types: ['trap'] },
  { key: 'items', documentName: 'Item', types: ['weapon', 'equipment', 'consumable', 'loot', 'tattoo', 'lootBox'] },
  { key: 'questItems', documentName: 'Item', types: ['weapon', 'equipment', 'consumable', 'loot', 'tattoo', 'lootBox'] },
  { key: 'achievements', documentName: 'Item', types: ['achievement'] },
  { key: 'rewards', documentName: 'Item', types: ['lootBox', 'loot', 'weapon', 'equipment', 'consumable', 'tattoo'] },
  { key: 'npcs', documentName: 'Actor', types: ['npc'] },
] as const
export type QuestLinkKey = (typeof QUEST_LINK_SECTIONS)[number]['key']
export const QUEST_TEXT_FIELDS = ['summary', 'hooks', 'environment'] as const

export type Quest = {
  id: string
  name: string
  status: QuestStatus
  /** One line shown in the list ("500 gold, a Bronze Weapon Box"). */
  reward: string
  summary: string
  hooks: string
  environment: string
  stages: QuestStage[]
} & Record<QuestLinkKey, QuestLink[]>

/** The detail sections in order; players only get the summary. Linked pairs share a section. */
const SECTIONS = ['summary', 'hooks', 'battles', 'environment', 'traps', 'items', 'awards', 'stages', 'npcs'] as const
export type QuestSection = (typeof SECTIONS)[number]
export const SECTION_LINKS: Partial<Record<QuestSection, QuestLinkKey[]>> = {
  battles: ['mobs', 'bosses'],
  traps: ['traps'],
  items: ['items', 'questItems'],
  awards: ['achievements', 'rewards'],
  npcs: ['npcs'],
}
export const questSections = (gm: boolean): QuestSection[] => (gm ? [...SECTIONS] : ['summary'])

/** Whether a section takes this actor or item (index entries work too: documentName, type, system.kind). */
export function acceptsLink(key: string, doc: { documentName?: string; type?: string; system?: { kind?: string } } | null | undefined) {
  const section: any = QUEST_LINK_SECTIONS.find((entry) => entry.key === key)
  if (!section || !doc || doc.documentName !== section.documentName || !section.types.includes(doc.type)) return false
  if (section.boss === undefined) return true
  return (doc.system?.kind === 'boss') === section.boss
}

const str = (value: unknown) => (typeof value === 'string' ? value : '')
const randomId = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)

function cleanLinks(list: unknown): QuestLink[] {
  const seen = new Set<string>()
  return (Array.isArray(list) ? list : [])
    .filter((entry) => entry && typeof entry.uuid === 'string' && entry.uuid && !seen.has(entry.uuid) && !!seen.add(entry.uuid))
    .map((entry) => ({ uuid: entry.uuid, name: str(entry.name), img: str(entry.img) }))
}

function cleanStages(list: unknown): QuestStage[] {
  return (Array.isArray(list) ? list : [])
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({ id: str(entry.id) || randomId(), text: str(entry.text), done: !!entry.done }))
}

/** A clean list from the setting: entries with a unique id and every field filled in. */
export function cleanQuests(list: unknown): Quest[] {
  const seen = new Set<string>()
  return (Array.isArray(list) ? list : [])
    .filter((entry) => entry && typeof entry === 'object' && typeof entry.id === 'string' && entry.id && !seen.has(entry.id) && !!seen.add(entry.id))
    .map((entry) => {
      const quest: any = {
        id: entry.id,
        name: str(entry.name).trim(),
        status: (QUEST_STATUSES as string[]).includes(entry.status) ? entry.status : 'offered',
        reward: str(entry.reward).trim(),
        stages: cleanStages(entry.stages),
      }
      for (const field of QUEST_TEXT_FIELDS) quest[field] = str(entry[field])
      for (const section of QUEST_LINK_SECTIONS) quest[section.key] = cleanLinks(entry[section.key])
      return quest as Quest
    })
}

/** Players see accepted quests, then completed ones; the GM sees all of them, accepted first, then offered, then completed. */
export function questsFor(quests: Quest[], gm: boolean) {
  const order = (quest: Quest) => QUEST_STATUSES.indexOf(quest.status)
  return quests.filter((quest) => gm || quest.status !== 'offered').sort((a, b) => order(a) - order(b))
}
