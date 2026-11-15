/**
 * The Borough Field Guide: a journal for crawlers made from a borough page (the borough, its boss, then each of its
 * neighborhoods and their quarters), and the item that hands it out, "Borough Field Guide; [Borough]". Compiling
 * again rewrites both. The journal is hidden from players; holding the item opens it to them (grants.ts).
 */
import { fieldGuideName, fieldGuidePages, type GuideBorough, type GuideEntry, type GuideNeighborhood, type GuideQuarter, type LinkEntry } from './model'
import { t } from './fields'
import { GRANTS_FLAG } from './grants'

const FOLDER = 'Borough Field Guides'

async function folderFor(type: 'JournalEntry' | 'Item') {
  return game.folders.find((folder: any) => folder.type === type && folder.name === FOLDER) ?? Folder.create({ name: FOLDER, type })
}

/** A linked entry with its document's description (a mob's, an NPC's, a trap's). */
async function guideEntry(entry: { uuid: string; name: string; notes?: string }): Promise<GuideEntry> {
  const document = entry.uuid ? await fromUuid(entry.uuid).catch(() => null) : null
  return { uuid: document ? entry.uuid : '', name: entry.name || document?.name || '', description: String(document?.system?.description ?? ''), notes: entry.notes ?? '' }
}
const guideEntries = (entries: LinkEntry[] = []) => Promise.all(entries.map(guideEntry))

/** The neighborhood page a borough's entry points at (a journal's first neighborhood page, or the page itself). */
async function neighborhoodPage(uuid: string) {
  const document = uuid ? await fromUuid(uuid).catch(() => null) : null
  if (document?.documentName === 'JournalEntryPage') return document.type === 'neighborhood' ? document : null
  return document?.pages?.find((page: any) => page.type === 'neighborhood') ?? null
}

async function guideNeighborhood(page: any, isBoss: (uuid: string) => Promise<boolean>): Promise<GuideNeighborhood> {
  const system = page.toObject().system
  const quarters: GuideQuarter[] = []
  for (const quarter of system.quarters ?? []) {
    const mobs: GuideEntry[] = []
    const bosses: GuideEntry[] = []
    for (const mob of quarter.mobs ?? []) ((await isBoss(mob.uuid)) || mob.uuid === system.boss?.uuid ? bosses : mobs).push(await guideEntry(mob))
    if (system.boss?.quarter === quarter.id && (system.boss.uuid || system.boss.name) && !bosses.some((boss) => boss.uuid && boss.uuid === system.boss.uuid)) bosses.unshift(await guideEntry(system.boss))
    quarters.push({ name: quarter.name || t('UnnamedQuarter'), description: quarter.description, environment: quarter.environment, npcs: await guideEntries(quarter.npcEntries), traps: await guideEntries(quarter.trapEntries), mobs, bosses })
  }
  const bossQuarter = (system.quarters ?? []).find((quarter: any) => quarter.id === system.boss?.quarter)
  return {
    name: page.parent?.name ?? page.name,
    summary: system.summary,
    overview: system.overview,
    environment: system.environment,
    npcs: await guideEntries(system.npcEntries),
    traps: await guideEntries(system.trapEntries),
    mobs: await guideEntries(system.mobs),
    boss: system.boss?.uuid || system.boss?.name ? await guideEntry(system.boss) : null,
    bossQuarter: bossQuarter?.name ?? '',
    quarters,
  }
}

/** Builds (or rebuilds) a borough page's Field Guide journal and item. */
export async function compileFieldGuide(page: any) {
  if (!game.user.isGM) return
  const system = page.system
  const boroughName = page.parent?.name ?? page.name
  const bossCache = new Map<string, boolean>()
  const isBoss = async (uuid: string) => {
    if (!uuid) return false
    if (!bossCache.has(uuid)) {
      const actor = await fromUuid(uuid).catch(() => null)
      bossCache.set(uuid, actor?.type === 'mob' && actor.system?.kind === 'boss')
    }
    return bossCache.get(uuid)!
  }
  const neighborhoods: GuideNeighborhood[] = []
  const missing: string[] = []
  for (const entry of system.neighborhoods as LinkEntry[]) {
    const hood = await neighborhoodPage(entry.uuid)
    if (hood) neighborhoods.push(await guideNeighborhood(hood, isBoss))
    else missing.push(entry.name || entry.uuid)
  }
  const borough: GuideBorough = { name: boroughName, summary: system.summary, boss: system.boss?.uuid || system.boss?.name ? await guideEntry(system.boss) : null, neighborhoods }
  const pages = fieldGuidePages(borough).map((entry, sort) => ({ name: entry.name, type: 'text', title: { show: true, level: entry.level }, text: { content: entry.content, format: 1 }, sort: (sort + 1) * 100 }))
  const name = fieldGuideName(boroughName)

  let journal = system.fieldGuide ? await fromUuid(system.fieldGuide).catch(() => null) : null
  if (journal) {
    await journal.deleteEmbeddedDocuments('JournalEntryPage', journal.pages.map((entry: any) => entry.id))
    await journal.update({ name })
    await journal.createEmbeddedDocuments('JournalEntryPage', pages)
  } else {
    journal = await JournalEntry.create({ name, folder: (await folderFor('JournalEntry')).id, ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE }, pages, flags: { crawlspace: { fieldGuideOf: page.uuid } } })
  }

  const description = `<p>@UUID[${journal.uuid}]{${name}}</p>${borough.summary ? `<p>${foundry.utils.escapeHTML(String(borough.summary).split(/\n/)[0])}</p>` : ''}<p><em>${t('FieldGuideItemHint')}</em></p>`
  const itemData = { name, type: 'loot', img: 'icons/sundries/books/book-embossed-bound-brown.webp', system: { description }, flags: { crawlspace: { [GRANTS_FLAG]: [journal.uuid], fieldGuideOf: page.uuid } } }
  let item = system.fieldGuideItem ? await fromUuid(system.fieldGuideItem).catch(() => null) : null
  if (item) await item.update(itemData)
  else item = await Item.create({ ...itemData, folder: (await folderFor('Item')).id })

  await page.update({ 'system.fieldGuide': journal.uuid, 'system.fieldGuideItem': item.uuid })
  if (missing.length) ui.notifications.warn(t('GuideMissing', { names: missing.join(', ') }))
  ui.notifications.info(t('GuideMade', { name }))
  return { journal, item }
}
