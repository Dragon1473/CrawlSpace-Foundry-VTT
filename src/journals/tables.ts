/**
 * Each quarter's mobs as a Foundry Roll Table: one result per mob (bosses left out), its weight its chance. The table
 * follows the quarter's list: it's made when the first mob goes in, updated as the list changes, and removed when
 * the list is empty or the quarter goes.
 */
import { tableMobs, tableResults, type Quarter } from './model'
import { t } from './fields'

const FOLDER = 'Neighborhood Mob Tables'

async function tableFolder() {
  return game.folders.find((folder: any) => folder.type === 'RollTable' && folder.name === FOLDER) ?? Folder.create({ name: FOLDER, type: 'RollTable' })
}

/** Whether a linked mob is a boss (mob actors with kind "boss"), looked up once per sync. */
async function bossTest(uuids: string[]) {
  const bosses = new Set<string>()
  for (const uuid of new Set(uuids)) {
    const actor = uuid ? await fromUuid(uuid).catch(() => null) : null
    if (actor?.type === 'mob' && actor.system?.kind === 'boss') bosses.add(uuid)
  }
  return (uuid: string) => bosses.has(uuid)
}

/** Brings a neighborhood page's mob tables in line with its quarters. */
export async function syncMobTables(page: any) {
  if (!game.user.isGM || page.type !== 'neighborhood') return
  const system = page.system
  const quarters: Quarter[] = page.toObject().system.quarters ?? []
  const isBoss = await bossTest(quarters.flatMap((quarter) => quarter.mobs.map((mob) => mob.uuid)))
  const tables: Record<string, string> = {}
  const keep = new Set<string>()
  for (const quarter of quarters) {
    const mobs = tableMobs(quarter.mobs, system.boss?.uuid ?? '', isBoss)
    let table = quarter.mobTable ? await fromUuid(quarter.mobTable).catch(() => null) : null
    if (!mobs.length) {
      if (table?.getFlag('crawlspace', 'quarter')) await table.delete()
      if (quarter.mobTable) tables[quarter.id] = ''
      continue
    }
    const name = t('MobTableName', { neighborhood: page.parent?.name ?? page.name, quarter: quarter.name || t('UnnamedQuarter') })
    const results = tableResults(mobs)
    const signature = JSON.stringify([name, results])
    if (!table) {
      table = await RollTable.create({
        name,
        folder: (await tableFolder()).id,
        img: 'icons/svg/d20-grey.svg',
        formula: `1d${results.at(-1)!.range[1]}`,
        replacement: true,
        results,
        flags: { crawlspace: { quarter: quarter.id, page: page.uuid, signature } },
      })
    } else if (table.getFlag('crawlspace', 'signature') !== signature) {
      await table.deleteEmbeddedDocuments('TableResult', table.results.map((result: any) => result.id))
      await table.update({ name, formula: `1d${results.at(-1)!.range[1]}`, 'flags.crawlspace.signature': signature })
      await table.createEmbeddedDocuments('TableResult', results)
    }
    keep.add(table.uuid)
    if (quarter.mobTable !== table.uuid) tables[quarter.id] = table.uuid
  }
  // Tables of quarters that were removed.
  for (const table of game.tables.filter((table: any) => table.getFlag('crawlspace', 'page') === page.uuid && !keep.has(table.uuid))) await table.delete()
  if (Object.keys(tables).length)
    await page.update({ 'system.quarters': quarters.map((quarter) => (quarter.id in tables ? { ...quarter, mobTable: tables[quarter.id] } : quarter)) }, { crawlspaceTables: true })
}

export function registerMobTables() {
  const sync = (page: any, options: any, userId: string) => {
    if (userId !== game.user.id || options?.crawlspaceTables || page.type !== 'neighborhood') return
    syncMobTables(page).catch((error) => console.error('CrawlSpace | mob tables', error))
  }
  Hooks.on('createJournalEntryPage', (page: any, options: any, userId: string) => sync(page, options, userId))
  // Pages made along with their journal (the builder) don't fire createJournalEntryPage.
  Hooks.on('createJournalEntry', (journal: any, options: any, userId: string) => {
    for (const page of journal.pages) sync(page, options, userId)
  })
  Hooks.on('updateJournalEntryPage', (page: any, changes: any, options: any, userId: string) => {
    if (changes.system && ('quarters' in changes.system || 'boss' in changes.system)) sync(page, options, userId)
  })
  Hooks.on('deleteJournalEntryPage', async (page: any, _options: any, userId: string) => {
    if (userId !== game.user.id || page.type !== 'neighborhood') return
    for (const table of game.tables.filter((table: any) => table.getFlag('crawlspace', 'page') === page.uuid)) await table.delete()
  })
}
