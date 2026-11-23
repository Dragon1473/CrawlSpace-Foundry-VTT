/**
 * Personal Spaces at the table (rules/personal-space.ts has the rules): the world setting, which space a crawler is
 * in, rest and grinding benefits, the upgrades' Active Effects, crafting tables, members leaving with what they own,
 * and moving the old character-sheet fields into space actors.
 *
 * A crawler is "in" a space only while their own toggle says so (`flags.crawlspace.inPersonalSpace` = the space's
 * actor id). The toggle sits on the space's sheet (each member) and on the GM's rest and grinding panel.
 */
import { extraSlotsHealth, tableLevelUp, leavingWith, legacySpace, levelFromText, normalizeMembers, ownerLevels, partyLongRestHours, spaceBenefits, type LegacySpace, type Member } from '../rules/personal-space'
import { HEALTH_MAX } from '../config'

export const SPACE_PACKS = ['homebrew-personal-space', 'homebrew-space-tables']
const IN_SPACE = 'inPersonalSpace'
const LIBRARY = 'spaceLibrary'
const SPACE_EFFECT = 'spaceEffect'
const TRAINING_DAY = 'spaceTrainingDay'

const t = (key: string, data?: Record<string, unknown>) =>
  data ? game.i18n.format(`CRAWLSPACE.Space.${key}`, data) : game.i18n.localize(`CRAWLSPACE.Space.${key}`)

export const spacesEnabled = () => {
  try {
    return game.settings.get('crawlspace', 'personalSpaces') !== false
  } catch {
    return false
  }
}

/** Old crawler fields read straight from the world data before the documents drop them (init, see migrate). */
let legacySnapshot: { id: string; name: string; legacy: LegacySpace }[] = []

export function registerPersonalSpaceSetting() {
  game.settings.register('crawlspace', 'personalSpaces', {
    name: 'CRAWLSPACE.Settings.PersonalSpaces.Name',
    hint: 'CRAWLSPACE.Settings.PersonalSpaces.Hint',
    scope: 'world',
    config: true,
    restricted: true,
    type: Boolean,
    default: true,
    requiresReload: true,
  })
  game.settings.register('crawlspace', 'personalSpaceMigration', { scope: 'world', config: false, type: Number, default: 0 })
  legacySnapshot = (game.data.actors ?? [])
    .filter((actor: any) => actor.type === 'crawler')
    .map((actor: any) => ({ id: actor._id, name: actor.name, legacy: legacySpace(actor.system) }))
    .filter((entry: any) => entry.legacy)
  if (spacesEnabled()) return
  // Off: the compendiums go (as the homebrew setting does it), and the new types leave the Create dialogs.
  const hidden = new Set(SPACE_PACKS.map((name) => `crawlspace.${name}`))
  game.data.packs = game.data.packs.filter((pack: any) => !hidden.has(pack.id))
}

/** With the setting off, the Create Actor/Item dialogs leave out the Personal Space types. */
export function hideSpaceTypes(documentClass: any, type: string) {
  if (spacesEnabled()) return
  const original = documentClass.createDialog
  documentClass.createDialog = function (data: any = {}, createOptions: any = {}, options: any = {}, ...rest: any[]) {
    const types = options.types ?? this.TYPES.filter((entry: string) => entry !== type && entry !== CONST.BASE_DOCUMENT_TYPE)
    return original.call(this, data, createOptions, { ...options, types }, ...rest)
  }
}

export const isSpace = (actor: any) => actor?.type === 'personalSpace'

export const membersOf = (space: any): Member[] => normalizeMembers(space?.system?.members)

/** The spaces a crawler belongs to. */
export function spacesOf(crawler: any) {
  if (!crawler) return []
  return game.actors.filter((actor: any) => isSpace(actor) && membersOf(actor).some((member) => member.uuid === crawler.uuid))
}

/** The space the crawler is in right now (their toggle), or null. Always null with the setting off. */
export function currentSpace(crawler: any) {
  if (!spacesEnabled() || crawler?.type !== 'crawler') return null
  const id = crawler.getFlag('crawlspace', IN_SPACE)
  const space = id ? game.actors.get(id) : null
  return space && membersOf(space).some((member) => member.uuid === crawler.uuid) ? space : null
}

export async function setInSpace(crawler: any, space: any | null) {
  if (!crawler) return
  if (space) await crawler.setFlag('crawlspace', IN_SPACE, space.id)
  else if (crawler.getFlag('crawlspace', IN_SPACE)) await crawler.unsetFlag('crawlspace', IN_SPACE)
}

const upgradesOf = (space: any) =>
  (space?.items ?? []).filter((item: any) => item.type === 'spaceUpgrade').map((item: any) => ({
    name: item.name,
    installed: item.system.installed,
    kind: item.system.kind,
    owner: item.system.owner,
    rest: item.system.rest,
    training: item.system.training,
  }))

/** What the crawler's current space does for them (nothing outside one). */
export function benefitsFor(crawler: any) {
  return spaceBenefits(upgradesOf(currentSpace(crawler)))
}

/** What a space does for a crawler inside, one line per benefit with the upgrades that give it. */
export function benefitLinesOf(space: any) {
  const benefits = spaceBenefits(upgradesOf(space))
  const line = (key: string, data: Record<string, unknown>) => game.i18n.format(`CRAWLSPACE.Space.${key}`, data)
  const lines: string[] = []
  const { sources } = benefits
  if (benefits.longRestHours !== null) lines.push(line('BenefitLongRest', { hours: benefits.longRestHours, list: sources.longRestHours.join(', ') }))
  if (benefits.goodSleepHours) lines.push(line('BenefitGoodSleep', { hours: benefits.goodSleepHours, list: sources.goodSleepHours.join(', ') }))
  if (benefits.shortRestSlots) lines.push(line('BenefitShortRest', { slots: benefits.shortRestSlots, list: sources.shortRestSlots.join(', ') }))
  if (benefits.trainingHours > 1) lines.push(line('BenefitTraining', { hours: benefits.trainingHours, list: sources.trainingHours.join(', ') }))
  return lines
}

/** Seconds a rest takes for these crawlers: a Long Rest is as short as the slowest of them allows. */
export function restSecondsFor(actors: any[], kind: string, hours: number, base: (kind: string, hours: number) => number) {
  if (kind !== 'long' || !actors.length) return base(kind, hours)
  return partyLongRestHours(actors.map((actor) => benefitsFor(actor).longRestHours)) * 3600
}

/**
 * After a rest in the space: extra Short Rest slots, and Good Sleep after a Long Rest. Returns what it did, for the
 * rest's chat card.
 */
export async function afterSpaceRest(actor: any, kind: string) {
  const space = currentSpace(actor)
  if (!space) return [] as string[]
  const benefits = benefitsFor(actor)
  const lines: string[] = []
  if (kind === 'short' && benefits.shortRestSlots) {
    await actor.update({ 'system.health.value': extraSlotsHealth(actor.system.health.value, benefits.shortRestSlots, HEALTH_MAX) })
    lines.push(t('ExtraSlots', { slots: benefits.shortRestSlots, list: benefits.sources.shortRestSlots.join(', ') }))
  }
  if ((kind === 'long' || kind === 'full') && benefits.goodSleepHours) {
    const old = actor.effects.filter((effect: any) => effect.getFlag('crawlspace', 'spaceSleep'))
    if (old.length) await actor.deleteEmbeddedDocuments('ActiveEffect', old.map((effect: any) => effect.id))
    await actor.createEmbeddedDocuments('ActiveEffect', [
      {
        name: 'Good Sleep',
        img: 'icons/svg/sleep.svg',
        origin: space.uuid,
        duration: { value: benefits.goodSleepHours * 3600, units: 'seconds' },
        system: { changes: [], conditionType: 'buff', durationText: t('Hours', { hours: benefits.goodSleepHours }) },
        flags: { crawlspace: { spaceSleep: true } },
      },
    ])
    lines.push(t('GoodSleep', { hours: benefits.goodSleepHours, list: benefits.sources.goodSleepHours.join(', ') }))
  }
  if (kind === 'long' && benefits.longRestHours !== null)
    lines.push(t('QuickRest', { hours: benefits.longRestHours, list: benefits.sources.longRestHours.join(', ') }))
  return lines
}

/** Once a day (the grinding day), a training upgrade's hour counts as more than one. */
export function trainingFor(crawler: any, day: number) {
  const benefits = benefitsFor(crawler)
  const used = Math.floor(Number(crawler.getFlag('crawlspace', TRAINING_DAY)) || 0) === day
  return { hours: benefits.trainingHours, sources: benefits.sources.trainingHours, used }
}

export const markTrainingUsed = (crawler: any, day: number) => crawler.setFlag('crawlspace', TRAINING_DAY, day)

/** The crafting tables in the crawler's current space, in the shape crafting reads (actors/crafting.ts). */
export function spaceTables(crawler: any) {
  const space = currentSpace(crawler)
  if (!space) return []
  return space.items
    .filter((item: any) => item.type === 'craftingTable' && !item.system.broken && (Number(item.system.quantity) || 0) > 0)
    .map((item: any) => ({
      id: item.id,
      name: item.name,
      category: item.system.category,
      tier: Math.floor(Number(item.system.tier) || 1),
      upgrades: item.system.upgrades ?? [],
      space: space.id,
    }))
}

/**
 * The upgrades' Active Effects on a crawler while they are in the space (Advantage on named checks and the like),
 * gone when they leave. Each copy remembers the upgrade it came from.
 */
export async function syncSpaceEffects(crawler: any) {
  if (crawler?.type !== 'crawler' || !crawler.isOwner) return
  const space = currentSpace(crawler)
  const wanted = new Map<string, any>()
  for (const item of space?.items ?? []) {
    if (item.type !== 'spaceUpgrade' || !item.system.installed) continue
    for (const effect of item.effects) {
      if (effect.disabled) continue
      const data = effect.toObject()
      delete data._id
      wanted.set(effect.uuid, { ...data, transfer: false, origin: effect.uuid, flags: { ...data.flags, crawlspace: { ...(data.flags?.crawlspace ?? {}), [SPACE_EFFECT]: effect.uuid } } })
    }
  }
  const existing = crawler.effects.filter((effect: any) => effect.getFlag('crawlspace', SPACE_EFFECT))
  const stale = existing.filter((effect: any) => !wanted.has(effect.getFlag('crawlspace', SPACE_EFFECT)))
  const have = new Set(existing.map((effect: any) => effect.getFlag('crawlspace', SPACE_EFFECT)))
  const add = [...wanted.entries()].filter(([uuid]) => !have.has(uuid)).map(([, data]) => data)
  if (stale.length) await crawler.deleteEmbeddedDocuments('ActiveEffect', stale.map((effect: any) => effect.id))
  if (add.length) await crawler.createEmbeddedDocuments('ActiveEffect', add)
}

/** Every crawler in this space gets its effects again (an upgrade was added, changed or removed). */
async function resyncSpace(space: any) {
  if (!isSpace(space) || !game.user.isActiveGM) return
  for (const member of membersOf(space)) {
    const crawler = fromUuidSync(member.uuid)
    if (crawler && currentSpace(crawler) === space) await syncSpaceEffects(crawler)
  }
}

/**
 * A crawler leaves the space (or dies): the upgrades and tables they own go to their library (a flag on the crawler)
 * and out of the space; they stop being a member. They can install them again in a space they join.
 */
export async function removeMember(space: any, uuid: string) {
  const crawler = fromUuidSync(uuid)
  const items = space.items.contents.map((item: any) => ({ item, owner: ownerOf(item) }))
  const { going } = leavingWith(items, uuid)
  if (going.length && crawler) {
    const library = [...(crawler.getFlag('crawlspace', LIBRARY) ?? []), ...going.map(({ item }: any) => item.toObject())]
    await crawler.setFlag('crawlspace', LIBRARY, library)
  }
  if (going.length) await space.deleteEmbeddedDocuments('Item', going.map(({ item }: any) => item.id))
  const members = membersOf(space).filter((member) => member.uuid !== uuid)
  const update: Record<string, unknown> = { 'system.members': members }
  // Down to one space of its own: the space is that one's Level again.
  const levels = ownerLevels(members)
  if (levels.length === 1 && ownerLevels(membersOf(space)).length > 1) update['system.level'] = levels[0]
  await space.update(update)
  if (crawler && crawler.getFlag('crawlspace', IN_SPACE) === space.id) await setInSpace(crawler, null)
  return going.map(({ item }: any) => item.name)
}

/** Owners as they enter a conjoined space: each records the Level of the space they bring (a lone owner: that space's). */
function ownersWithLevels(space: any) {
  const members = membersOf(space)
  if (!members.some((member) => member.role === 'owner') && members.length) members[0].role = 'owner'
  const owners = members.filter((member) => member.role === 'owner')
  if (!ownerLevels(members).length && owners.length) owners[0].spaceLevel = Math.min(5, Math.max(1, Math.floor(Number(space._source.system.level) || 1)))
  return members
}

/**
 * Conjoin `source` into `target` (GM): its members, upgrades and tables move over, each item keeping its owner (what
 * belonged to a one-owner space now belongs to that owner, so it leaves with them), crawlers inside move too, and the
 * source space is deleted. The target's Level then comes from the owners' levels.
 */
export async function conjoinSpaces(target: any, source: any) {
  if (!game.user.isGM || !isSpace(target) || !isSpace(source) || target === source) return
  const members = ownersWithLevels(target)
  const incoming = ownersWithLevels(source)
  for (const member of incoming) {
    const existing = members.find((entry) => entry.uuid === member.uuid)
    if (!existing) members.push(member)
    else if (member.role === 'owner' && existing.role !== 'owner') Object.assign(existing, member)
  }
  const sourceOwners = incoming.filter((member) => member.role === 'owner')
  const heir = sourceOwners.length === 1 ? sourceOwners[0].uuid : ''
  const ids = new Map<string, string>()
  for (const item of source.items) ids.set(item.id, target.items.has(item.id) ? foundry.utils.randomID() : item.id)
  const data = source.items.contents.map((item: any) => {
    const copy = item.toObject()
    copy._id = ids.get(item.id)
    if (copy.type === 'spaceUpgrade') {
      if (!copy.system.owner && heir) copy.system.owner = heir
      if (copy.system.attachedTo) copy.system.attachedTo = ids.get(copy.system.attachedTo) ?? ''
    } else if (copy.type === 'craftingTable' && heir && !foundry.utils.getProperty(copy, 'flags.crawlspace.spaceOwner'))
      foundry.utils.setProperty(copy, 'flags.crawlspace.spaceOwner', heir)
    return copy
  })
  const inside = incoming.map((member) => fromUuidSync(member.uuid)).filter((crawler: any) => crawler?.getFlag('crawlspace', IN_SPACE) === source.id)
  await target.update({ 'system.members': members })
  if (data.length) await target.createEmbeddedDocuments('Item', data, { keepId: true })
  await source.delete()
  for (const crawler of inside) await setInSpace(crawler, target)
}

/** The crawler's library of upgrades and tables kept from spaces they left. */
export const libraryOf = (crawler: any): any[] => crawler?.getFlag('crawlspace', LIBRARY) ?? []

/** Put the crawler's kept upgrades and tables into this space, still theirs. */
export async function installLibrary(space: any, crawler: any) {
  const library = libraryOf(crawler)
  if (!library.length) return 0
  const data = library.map((entry: any) => {
    const copy = foundry.utils.deepClone(entry)
    delete copy._id
    if (copy.type === 'spaceUpgrade') {
      copy.system = { ...copy.system, owner: crawler.uuid, attachedTo: '' }
    } else foundry.utils.setProperty(copy, 'flags.crawlspace.spaceOwner', crawler.uuid)
    return copy
  })
  await space.createEmbeddedDocuments('Item', data)
  await crawler.unsetFlag('crawlspace', LIBRARY)
  return data.length
}

/** Who owns an item in a space: an upgrade's owner field, a table's flag. Blank: the space. */
export const ownerOf = (item: any): string => (item.type === 'spaceUpgrade' ? item.system.owner : item.getFlag?.('crawlspace', 'spaceOwner')) ?? ''

/**
 * An attachment names the table it sits on; its name joins that table's upgrades (what recipes check for) and leaves
 * the table it was on before.
 */
export async function attachTo(space: any, upgrade: any, tableId: string) {
  const previous = upgrade.system.attachedTo
  const updates: any[] = []
  const table = (id: string) => space.items.get(id)
  if (previous && table(previous)) updates.push({ _id: previous, 'system.upgrades': (table(previous).system.upgrades ?? []).filter((name: string) => name !== upgrade.name) })
  if (tableId && table(tableId)) {
    const upgrades = new Set<string>(table(tableId).system.upgrades ?? [])
    upgrades.add(upgrade.name)
    updates.push({ _id: tableId, 'system.upgrades': [...upgrades] })
  }
  await upgrade.update({ 'system.attachedTo': tableId })
  if (updates.length) await space.updateEmbeddedDocuments('Item', updates)
}

/**
 * The old Personal Space fields on the character sheet (tier, size, amenities) become a space actor owned by the
 * crawler, with each amenity as an upgrade, and leave the crawler. Runs once per world (the active GM).
 */
export async function migrateLegacySpaces() {
  if (!game.user.isActiveGM || game.settings.get('crawlspace', 'personalSpaceMigration') >= 1) return
  for (const { id, name, legacy } of legacySnapshot) {
    const crawler = game.actors.get(id)
    if (!crawler) continue
    await createSpaceFor(crawler, legacy, name)
    await crawler.update({ 'system.-=personalSpace': null, 'system.-=amenities': null }).catch(() => null)
  }
  await game.settings.set('crawlspace', 'personalSpaceMigration', 1)
}

/** A new space owned by a crawler; with old sheet fields, they fill it. Imported characters bring theirs as a flag. */
export async function createSpaceFor(crawler: any, legacy: LegacySpace | null = null, name = crawler.name) {
  const ownership = { ...(crawler.ownership ?? {}) }
  const space = await Actor.create({
    name: t('DefaultName', { name }),
    type: 'personalSpace',
    img: 'icons/environment/settlement/house-two-stories-small.webp',
    ownership,
    system: {
      level: legacy ? levelFromText(legacy.tier) : 1,
      members: [{ uuid: crawler.uuid, role: 'owner' }],
      legacy: { tier: legacy?.tier ?? '', size: legacy?.size ?? '' },
    },
  })
  if (space && legacy?.amenities.length)
    await space.createEmbeddedDocuments(
      'Item',
      legacy.amenities.map((amenity) => ({
        name: amenity,
        type: 'spaceUpgrade',
        img: 'icons/svg/house.svg',
        system: { owner: crawler.uuid, kind: 'upgrade', tier: 0, status: 'homebrew', summary: t('FromSheet') },
      })),
    )
  return space
}

/** An imported character's old space fields arrive as a flag (import/convert.ts); they become a space. */
async function onCreateCrawler(actor: any, _options: any, userId: string) {
  if (userId !== game.user.id || actor.type !== 'crawler') return
  const legacy = actor.getFlag('crawlspace', 'legacyPersonalSpace')
  if (!legacy) return
  const space = legacySpace({ personalSpace: legacy, amenities: legacy.amenities })
  try {
    if (space) await createSpaceFor(actor, space)
    await actor.unsetFlag('crawlspace', 'legacyPersonalSpace')
  } catch (error) {
    // A player who can't create actors keeps the flag; the GM's migration-free path is the space sheet.
    console.warn('CrawlSpace | could not create the imported Personal Space', error)
  }
}

const TABLE_FLOOR = 'spaceFloor'
const memberFloor = (uuid: string) => Math.floor(Number(fromUuidSync(uuid)?.system?.details?.floor) || 0)

/**
 * The floor a space's table counts its levels from: its owner's floor, or for the space's own tables the highest
 * floor any member has reached. Each table keeps its own (flags.crawlspace.spaceFloor), so a floor is never counted
 * twice, whoever reaches it.
 */
function tableBaseFloor(space: any, item: any) {
  const owner = ownerOf(item)
  return owner ? memberFloor(owner) : Math.max(0, ...membersOf(space).map((member) => memberFloor(member.uuid)))
}

/**
 * Tables in a space level up like the tables crawlers carry (actors/crafting.ts): an owned table with its owner's
 * floor, a space-owned table once per new floor any member reaches. The active GM does it (they own every space),
 * so the player whose floor changed needs no rights to the space.
 */
async function levelSpaceTables(crawler: any, changes: any) {
  if (!game.user.isActiveGM) return
  if (foundry.utils.getProperty(changes, 'system.details.floor') === undefined) return
  const now = memberFloor(crawler.uuid)
  for (const space of spacesOf(crawler)) {
    const updates = space.items
      .filter((item: any) => item.type === 'craftingTable' && item.system.autoLevel && [crawler.uuid, ''].includes(ownerOf(item)))
      .map((item: any) => {
        const last = Number(item.getFlag('crawlspace', TABLE_FLOOR))
        const level = tableLevelUp(item.system.tier, Number.isFinite(last) && last > 0 ? last : null, now)
        return level ? { _id: item.id, 'system.tier': level.tier, [`flags.crawlspace.${TABLE_FLOOR}`]: level.floor } : null
      })
      .filter(Boolean)
    if (updates.length) await space.updateEmbeddedDocuments('Item', updates)
  }
}

/** A table placed in a space (or given a new owner) starts counting from that floor. */
async function stampTableFloor(item: any, changes?: any) {
  if (!game.user.isActiveGM || item.type !== 'craftingTable' || !isSpace(item.parent)) return
  const ownerChanged = changes && Object.keys(changes.flags?.crawlspace ?? {}).some((key) => key.includes('spaceOwner'))
  if (changes && !ownerChanged) return
  await item.setFlag('crawlspace', TABLE_FLOOR, tableBaseFloor(item.parent, item))
}

export function registerPersonalSpaces() {
  Hooks.on('updateActor', (actor: any, changes: any, _options: any, userId: string) => {
    if (actor.type !== 'crawler') return
    // Every client sees the update; the active GM levels the space tables, whoever changed the floor.
    void levelSpaceTables(actor, changes).catch((error) => console.error('CrawlSpace | personal space tables', error))
    if (userId !== game.user.id) return
    if (Object.keys(changes.flags?.crawlspace ?? {}).some((key) => key.includes(IN_SPACE)))
      void syncSpaceEffects(actor).catch((error) => console.error('CrawlSpace | personal space effects', error))
  })
  const onSpaceItem = (item: any) => {
    if (isSpace(item.parent)) void resyncSpace(item.parent).catch((error) => console.error('CrawlSpace | personal space effects', error))
  }
  Hooks.on('createItem', onSpaceItem)
  Hooks.on('updateItem', onSpaceItem)
  const stamp = (item: any, changes?: any) => void stampTableFloor(item, changes).catch((error) => console.error('CrawlSpace | personal space tables', error))
  Hooks.on('createItem', (item: any) => stamp(item))
  Hooks.on('updateItem', (item: any, changes: any) => stamp(item, changes))
  Hooks.on('deleteItem', onSpaceItem)
  // An upgrade's own Active Effects changing reaches the crawlers in the space too.
  const onSpaceEffect = (effect: any) => {
    if (effect.parent?.documentName === 'Item') onSpaceItem(effect.parent)
  }
  Hooks.on('createActiveEffect', onSpaceEffect)
  Hooks.on('updateActiveEffect', onSpaceEffect)
  Hooks.on('deleteActiveEffect', onSpaceEffect)
  Hooks.on('createActor', onCreateCrawler)
}
