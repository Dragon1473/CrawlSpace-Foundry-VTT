/** Neighborhood and borough journals: page types, sheets, mob tables, field guide access, and the Journal tab's buttons. */
import { BoroughPageData, NeighborhoodPageData } from './data'
import { BoroughPageSheet, NeighborhoodBuilder, NeighborhoodPageSheet, createBlank } from './sheets'
import { registerMobTables } from './tables'
import { registerGrants } from './grants'
import { esc, t } from './fields'

export function registerJournals() {
  Object.assign(CONFIG.JournalEntryPage.dataModels, { neighborhood: NeighborhoodPageData, borough: BoroughPageData })
  const sheets = foundry.applications.apps.DocumentSheetConfig
  sheets.registerSheet(JournalEntryPage, 'crawlspace', NeighborhoodPageSheet, { types: ['neighborhood'], makeDefault: true, label: 'CRAWLSPACE.Journal.NeighborhoodSheet' })
  sheets.registerSheet(JournalEntryPage, 'crawlspace', BoroughPageSheet, { types: ['borough'], makeDefault: true, label: 'CRAWLSPACE.Journal.BoroughSheet' })
  registerMobTables()
  registerGrants()

  // Deleting a whole neighborhood journal takes its mob tables with it.
  Hooks.on('deleteJournalEntry', async (journal: any, _options: any, userId: string) => {
    if (userId !== game.user.id) return
    for (const table of game.tables.filter((table: any) => String(table.getFlag('crawlspace', 'page') ?? '').startsWith(`${journal.uuid}.`))) await table.delete()
  })

  // The Journal tab: New Neighborhood (the builder), a blank neighborhood, and a new borough.
  Hooks.on('renderJournalDirectory', (app: any, html: HTMLElement) => {
    if (!game.user.isGM) return
    const root = html instanceof HTMLElement ? html : app.element
    if (!root || root.querySelector('.crawl-journal-buttons')) return
    const bar = document.createElement('div')
    bar.className = 'crawl-journal-buttons'
    bar.innerHTML = `<button type="button" data-crawl-journal="builder"><i class="fa-solid fa-city"></i> ${esc(t('NewNeighborhood'))}</button>
      <button type="button" data-crawl-journal="blank"><i class="fa-regular fa-file"></i> ${esc(t('BlankNeighborhood'))}</button>
      <button type="button" data-crawl-journal="borough"><i class="fa-solid fa-landmark"></i> ${esc(t('NewBorough'))}</button>`
    bar.querySelectorAll<HTMLElement>('[data-crawl-journal]').forEach((button) =>
      button.addEventListener('click', (event) => {
        event.preventDefault()
        const kind = button.dataset.crawlJournal
        if (kind === 'builder') new NeighborhoodBuilder().render({ force: true })
        else createBlank(kind === 'blank' ? 'neighborhood' : 'borough')
      }),
    )
    const header = root.querySelector('.directory-header') ?? root
    header.append(bar)
  })
}

export { NeighborhoodBuilder, createBlank } from './sheets'
export { compileFieldGuide } from './field-guide'
export { syncMobTables } from './tables'
