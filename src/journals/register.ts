/**
 * Neighborhood, borough and higher region journals: page types, sheets, mob tables, field guide access, and the Journal
 * tab's Atlas Maps button.
 */
import { BoroughPageData, NeighborhoodPageData, RegionPageData } from './data'
import { HIGHER_TIERS } from './model'
import { BoroughPageSheet, NeighborhoodPageSheet, RegionPageSheet } from './sheets'
import { AtlasMapsMenu } from './menu'
import { registerMobTables } from './tables'
import { registerGrants } from './grants'
import { esc, t } from './fields'

export function registerJournals() {
  Object.assign(CONFIG.JournalEntryPage.dataModels, { neighborhood: NeighborhoodPageData, borough: BoroughPageData }, Object.fromEntries(HIGHER_TIERS.map((tier) => [tier, RegionPageData])))
  const sheets = foundry.applications.apps.DocumentSheetConfig
  sheets.registerSheet(JournalEntryPage, 'crawlspace', NeighborhoodPageSheet, { types: ['neighborhood'], makeDefault: true, label: 'CRAWLSPACE.Journal.NeighborhoodSheet' })
  sheets.registerSheet(JournalEntryPage, 'crawlspace', BoroughPageSheet, { types: ['borough'], makeDefault: true, label: 'CRAWLSPACE.Journal.BoroughSheet' })
  sheets.registerSheet(JournalEntryPage, 'crawlspace', RegionPageSheet, { types: [...HIGHER_TIERS], makeDefault: true, label: 'CRAWLSPACE.Journal.RegionSheet' })
  registerMobTables()
  registerGrants()

  // Deleting a whole neighborhood journal takes its mob tables with it.
  Hooks.on('deleteJournalEntry', async (journal: any, _options: any, userId: string) => {
    if (userId !== game.user.id) return
    for (const table of game.tables.filter((table: any) => String(table.getFlag('crawlspace', 'page') ?? '').startsWith(`${journal.uuid}.`))) await table.delete()
  })

  // The Journal tab: one Atlas Maps button, opening the menu of new neighborhoods, boroughs and the tiers above.
  Hooks.on('renderJournalDirectory', (app: any, html: HTMLElement) => {
    if (!game.user.isGM) return
    const root = html instanceof HTMLElement ? html : app.element
    if (!root || root.querySelector('.crawl-journal-buttons')) return
    const bar = document.createElement('div')
    bar.className = 'crawl-journal-buttons'
    bar.innerHTML = `<button type="button" data-crawl-journal="menu"><i class="fa-solid fa-map-location-dot"></i> ${esc(t('AtlasMaps'))}</button>`
    bar.querySelector('button')!.addEventListener('click', (event) => {
      event.preventDefault()
      AtlasMapsMenu.open()
    })
    const header = root.querySelector('.directory-header') ?? root
    header.append(bar)
  })
}

export { NeighborhoodBuilder, createBlank, createRegionJournal } from './sheets'
export { AtlasMapsMenu } from './menu'
export { compileFieldGuide } from './field-guide'
export { syncMobTables } from './tables'
