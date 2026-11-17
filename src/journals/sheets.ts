/**
 * The neighborhood, borough and higher region (city, province, country, floor) page sheets, the Add Quarter window and
 * the neighborhood builder.
 *
 * In a journal, a page reads like the app's adventure preview (view.ts). Editing it opens tabs of fields like the app's
 * adventure editor; quarters are edited one at a time in the Add Quarter window. The builder walks through a new
 * neighborhood: name and summary, its quarters, then its boss and the quarter the boss is in.
 */
import { BOROUGH_SECTIONS, NEIGHBORHOOD_SECTIONS, QUARTER_SECTIONS, REGION_SECTIONS, isRegionTier, moveEntry, newQuarter, paragraphs, setPath, type HigherTier, type Quarter, type RegionTier } from './model'
import { bindFields, bindTabs, esc, renderSection, renderSlot, renderTabs, t } from './fields'
import { boroughView, neighborhoodView, regionView, uuidLink } from './view'
import { compileFieldGuide } from './field-guide'
import { bindMap, mapTab, mapView } from './maps'

const { ApplicationV2 } = foundry.applications.api
const BODY = 'systems/crawlspace/templates/journal/page-body.hbs'
const enrich = (html: string, relativeTo?: any) => foundry.applications.ux.TextEditor.implementation.enrichHTML(html, { relativeTo, secrets: game.user.isGM })

/** The changed top-level keys of `next` against `before`, for a small update. */
function changes(before: any, next: any) {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(next)) if (JSON.stringify(before?.[key]) !== JSON.stringify(next[key])) out[key] = next[key]
  return out
}

/* The Add Quarter window */

export class QuarterDialog extends ApplicationV2 {
  static DEFAULT_OPTIONS: any = {
    classes: ['crawlspace', 'journal-quarter-dialog'],
    position: { width: 640, height: 720 },
    window: { resizable: true, icon: 'fa-solid fa-map-location-dot' },
  }

  quarter: Quarter
  tab = 'about'
  onSave: (quarter: Quarter) => unknown

  constructor(quarter: Quarter | null, onSave: (quarter: Quarter) => unknown, options: any = {}) {
    super(options)
    this.quarter = foundry.utils.deepClone(quarter ?? newQuarter())
    this.onSave = onSave
  }

  get title() {
    return this.quarter.name ? t('EditQuarterTitle', { name: this.quarter.name }) : t('AddQuarter')
  }

  async _renderHTML() {
    const section = QUARTER_SECTIONS.find((entry) => entry.id === this.tab) ?? QUARTER_SECTIONS[0]
    return `<div class="journal-edit">
      ${renderTabs(QUARTER_SECTIONS, section.id)}
      <div class="journal-tab-body">${renderSection(this.quarter, section)}
        ${section.id === 'about' ? renderSlot('battlemap', 'scene', this.quarter.battlemap, t('Battlemap')) + `<p class="hint">${esc(t('BattlemapHint'))}</p>` : ''}
        ${section.id === 'mobs' ? `<p class="hint">${esc(t('MobTableHint'))}</p>` : ''}
      </div>
      <footer class="journal-footer">
        <button type="button" data-quarter-action="save" class="bright"><i class="fa-solid fa-floppy-disk"></i> ${esc(t('SaveQuarter'))}</button>
        <button type="button" data-quarter-action="cancel"><i class="fa-solid fa-xmark"></i> ${esc(t('Cancel'))}</button>
      </footer>
    </div>`
  }

  _replaceHTML(html: string, content: HTMLElement) {
    content.innerHTML = html
    bindTabs(content, (id) => {
      this.tab = id
      this.render()
    })
    bindFields(
      content,
      () => this.quarter,
      (quarter, redraw = true) => {
        this.quarter = quarter
        if (redraw) this.render()
      },
    )
    content.querySelectorAll<HTMLElement>('[data-quarter-action]').forEach((button) =>
      button.addEventListener('click', async () => {
        if (button.dataset.quarterAction === 'save') {
          // Typing that hasn't left its field yet still counts.
          ;(document.activeElement as HTMLElement | null)?.blur?.()
          await this.onSave(this.quarter)
        }
        this.close()
      }),
    )
  }
}

/** The quarters, as cards with edit, reorder and delete. */
function quarterCards(quarters: Quarter[], editable: boolean) {
  const add = editable ? `<button type="button" data-quarter="add"><i class="fa-solid fa-plus"></i> ${esc(t('AddQuarter'))}</button>` : ''
  if (!quarters.length) return `<p class="hint">${esc(t('NoQuarters'))}</p>${add}`
  return `<ol class="journal-quarters">${quarters
    .map(
      (quarter, index) => `<li class="journal-quarter-card">
      <div class="journal-row-main"><strong>${esc(quarter.name || t('UnnamedQuarter'))}</strong>
        ${
          editable
            ? `<span class="journal-row-buttons">
          <a data-quarter="edit" data-index="${index}" data-tooltip="${esc(t('Edit'))}"><i class="fa-solid fa-pen"></i></a>
          <a data-quarter="up" data-index="${index}" data-tooltip="${esc(t('MoveUp'))}"><i class="fa-solid fa-arrow-up"></i></a>
          <a data-quarter="down" data-index="${index}" data-tooltip="${esc(t('MoveDown'))}"><i class="fa-solid fa-arrow-down"></i></a>
          <a data-quarter="remove" data-index="${index}" data-tooltip="${esc(t('Remove'))}"><i class="fa-solid fa-trash"></i></a></span>`
            : ''
        }</div>
      <div class="journal-quarter-summary">${paragraphs(String(quarter.description ?? '').slice(0, 280))}</div>
      <div class="hint">${esc(t('QuarterCounts', { mobs: quarter.mobs?.length ?? 0, npcs: quarter.npcEntries?.length ?? 0, traps: quarter.trapEntries?.length ?? 0 }))}</div>
    </li>`,
    )
    .join('')}</ol>${add}`
}

/** Edit, reorder, remove and add quarters; `save` takes the new list. */
function bindQuarters(root: HTMLElement, get: () => Quarter[], save: (quarters: Quarter[]) => unknown) {
  root.querySelectorAll<HTMLElement>('[data-quarter]').forEach((button) =>
    button.addEventListener('click', (event) => {
      event.preventDefault()
      const quarters = get()
      const index = Number(button.dataset.index)
      switch (button.dataset.quarter) {
        case 'add':
          return new QuarterDialog(null, (quarter) => save([...get(), quarter])).render({ force: true })
        case 'edit':
          return new QuarterDialog(quarters[index], (quarter) => save(get().map((entry) => (entry.id === quarter.id ? quarter : entry)))).render({ force: true })
        case 'up':
        case 'down':
          return save(moveEntry(quarters, index, button.dataset.quarter === 'up' ? -1 : 1))
        case 'remove':
          return foundry.applications.api.DialogV2.confirm({ window: { title: t('RemoveQuarter') }, content: `<p>${esc(t('RemoveQuarterConfirm', { name: quarters[index]?.name || t('UnnamedQuarter') }))}</p>` }).then(
            (yes: boolean) => yes && save(quarters.filter((_, i) => i !== index)),
          )
      }
    }),
  )
}

/** The boss slot, the quarter it's in, and notes. */
function bossFields(data: any, readOnly = false) {
  const options = [`<option value="">${esc(t('NoQuarter'))}</option>`, ...(data.quarters ?? []).map((quarter: Quarter) => `<option value="${esc(quarter.id)}" ${quarter.id === data.boss?.quarter ? 'selected' : ''}>${esc(quarter.name || t('UnnamedQuarter'))}</option>`)].join('')
  return `${renderSlot('boss', 'boss', data.boss, t('NeighborhoodBoss'), readOnly)}
    <label class="journal-field">${esc(t('BossQuarter'))}<select data-path="boss.quarter" ${readOnly ? 'disabled' : ''}>${options}</select></label>
    <label class="journal-field">${esc(t('BossNotes'))}<textarea data-path="boss.notes" rows="3" ${readOnly ? 'disabled' : ''}>${esc(data.boss?.notes)}</textarea></label>`
}

/** CrawlSpace Atlas, when it's on: it draws the Neighborhood Map item from the neighborhood's linked map. */
const atlasApi = () => (game.modules.get('crawlspace-atlas')?.active ? game.modules.get('crawlspace-atlas')?.api : null)

/** The GM's Neighborhood Map button: makes the item when the neighborhood has an atlas map, else says what's missing. */
function mapItemButton(data: any) {
  if (!game.user.isGM || !atlasApi()?.makeMapItem) return ''
  const scene = data.scene?.uuid ? fromUuidSync(data.scene.uuid) : null
  return `<div class="journal-map-item"><button type="button" class="journal-make-map" ${scene ? '' : 'disabled'}><i class="fa-solid fa-map"></i> ${esc(t('MakeMapItem'))}</button>
    ${scene ? '' : `<span class="hint">${esc(t('MakeMapItemHint'))}</span>`}</div>`
}

function bindMapItem(root: HTMLElement, data: () => any) {
  root.querySelectorAll<HTMLButtonElement>('.journal-make-map').forEach((button) =>
    button.addEventListener('click', async (event) => {
      event.preventDefault()
      const scene = data().scene?.uuid ? fromUuidSync(data().scene.uuid) : null
      if (!scene) return
      button.disabled = true
      try {
        await atlasApi()?.makeMapItem(scene)
      } finally {
        button.disabled = false
      }
    }),
  )
}

/* Page sheets */

const PageSheet = foundry.applications.sheets.journal.JournalEntryPageHandlebarsSheet

/** Shared by both page types: the content part is HTML built here; editing is bound after each render. */
class CrawlPageSheet extends PageSheet {
  static DEFAULT_OPTIONS: any = { classes: ['crawlspace', 'crawl-journal-page'], position: { width: 720, height: 760 } }
  static EDIT_PARTS = { header: PageSheet.EDIT_PARTS.header, content: { template: BODY, scrollable: [''] }, footer: PageSheet.EDIT_PARTS.footer }
  static VIEW_PARTS = { content: { template: BODY } }

  tab = ''

  /** The page's data as a plain object. */
  get data() {
    return this.page.toObject().system
  }

  async save(next: any) {
    const diff = changes(this.data, next)
    if (Object.keys(diff).length) await this.page.update({ system: diff })
  }

  async _prepareContentContext(context: any, options: any) {
    await super._prepareContentContext(context, options)
    context.body = this.isView ? `<div class="crawl-journal-body journal-view">${await enrich(await this.viewHTML(), this.page)}</div>` : this.editHTML()
  }

  async viewHTML(): Promise<string> {
    return ''
  }

  editHTML(): string {
    return ''
  }

  /** The field being typed in when a save redraws the sheet, so the cursor stays put. */
  focused: { path: string; value: string; start: number | null; end: number | null } | null = null

  async _preRender(context: any, options: any) {
    await super._preRender(context, options)
    const active = document.activeElement as HTMLInputElement | null
    this.focused = active?.dataset?.path && this.element?.contains(active) ? { path: active.dataset.path, value: active.value, start: active.selectionStart ?? null, end: active.selectionEnd ?? null } : null
  }

  async _onRender(context: any, options: any) {
    await super._onRender(context, options)
    const root = this.element.querySelector('.crawl-journal-body') as HTMLElement | null
    if (!root) return
    const focused = this.focused
    if (focused && !this.isView) {
      const input = root.querySelector<HTMLInputElement>(`[data-path="${CSS.escape(focused.path)}"]`)
      if (input) {
        input.value = focused.value
        input.focus()
        try {
          if (focused.start !== null) input.setSelectionRange(focused.start, focused.end)
        } catch {}
      }
    }
    bindMap(root, this.page, (path) => this.save({ ...this.data, mapImage: path }))
    if (this.isView) return this.bindView(root)
    bindTabs(root, (id) => {
      this.tab = id
      this.render()
    })
    bindFields(
      root,
      () => this.data,
      (next) => this.save(next),
    )
    this.bindEdit(root)
  }

  bindView(_root: HTMLElement) {}
  bindEdit(_root: HTMLElement) {}
}

export class NeighborhoodPageSheet extends CrawlPageSheet {
  get tabs() {
    return [...NEIGHBORHOOD_SECTIONS, { id: 'map', label: t('Map'), fields: [] }, { id: 'quarters', label: t('Quarters'), fields: [] }, { id: 'boss', label: t('Boss'), fields: [] }]
  }

  async viewHTML() {
    const system = this.page.system
    return mapView(system) + mapItemButton(system) + neighborhoodView(system, (quarter) => {
      const table = quarter.mobTable && fromUuidSync(quarter.mobTable) ? quarter.mobTable : ''
      const zone = quarter.zone ? fromUuidSync(quarter.zone) : null
      return {
        table,
        battlemap: quarter.battlemap?.uuid ? quarter.battlemap : null,
        zone: zone?.name ?? '',
        bossLink: system.boss?.quarter === quarter.id && (system.boss.uuid || system.boss.name) ? `${t('BossHere')}: ${uuidLink(system.boss.uuid, system.boss.name)}` : '',
      }
    })
  }

  editHTML() {
    const tabs = this.tabs
    const active = tabs.find((tab) => tab.id === this.tab) ?? tabs[0]
    const data = this.data
    let body = ''
    if (active.id === 'map') body = mapTab(data)
    else if (active.id === 'quarters') body = `${renderSlot('scene', 'scene', data.scene, t('NeighborhoodMap'))}<p class="hint">${esc(t('NeighborhoodMapHint'))}</p>${mapItemButton(data)}${quarterCards(data.quarters ?? [], true)}`
    else if (active.id === 'boss') body = `${bossFields(data)}<label class="journal-field">${esc(t('BossBattle'))}<textarea data-path="bossBattle" rows="5">${esc(data.bossBattle)}</textarea></label>`
    else body = renderSection(data, active)
    return `<div class="crawl-journal-body journal-edit">${renderTabs(tabs, active.id)}<div class="journal-tab-body">${body}</div></div>`
  }

  bindEdit(root: HTMLElement) {
    bindMapItem(root, () => this.data)
    bindQuarters(
      root,
      () => this.data.quarters ?? [],
      (quarters) => this.save({ ...this.data, quarters }),
    )
  }

  bindView(root: HTMLElement) {
    bindMapItem(root, () => this.page.system)
    root.querySelectorAll<HTMLElement>('.journal-roll-mobs').forEach((anchor) =>
      anchor.addEventListener('click', async (event) => {
        event.preventDefault()
        const table = await fromUuid(anchor.dataset.table!)
        if (table) await table.draw()
      }),
    )
  }
}

export class BoroughPageSheet extends CrawlPageSheet {
  get tabs() {
    return [...BOROUGH_SECTIONS, { id: 'map', label: t('Map'), fields: [] }, { id: 'boss', label: t('Boss'), fields: [] }, { id: 'neighborhoods', label: t('Neighborhoods'), fields: [] }, { id: 'guide', label: t('FieldGuide'), fields: [] }]
  }

  async viewHTML() {
    const system = this.page.system
    const guide = game.user.isGM ? `<p><button type="button" class="journal-compile"><i class="fa-solid fa-book"></i> ${esc(t('CompileGuide'))}</button></p>` : ''
    return mapView(system) + boroughView(system, { journal: system.fieldGuide, item: system.fieldGuideItem }) + guide
  }

  editHTML() {
    const tabs = this.tabs
    const active = tabs.find((tab) => tab.id === this.tab) ?? tabs[0]
    const data = this.data
    let body = ''
    if (active.id === 'map') body = mapTab(data)
    else if (active.id === 'boss') body = `${renderSlot('boss', 'boss', data.boss, t('BoroughBoss'))}<label class="journal-field">${esc(t('BossNotes'))}<textarea data-path="boss.notes" rows="4">${esc(data.boss?.notes)}</textarea></label>`
    else if (active.id === 'neighborhoods') body = renderSection(data, { id: 'neighborhoods', label: '', fields: [{ type: 'links', key: 'neighborhoods', label: t('Neighborhoods'), kind: 'neighborhood' }] }) + `<p class="hint">${esc(t('NeighborhoodsHint'))}</p>`
    else if (active.id === 'guide')
      body = `<p>${esc(t('FieldGuideHint'))}</p><button type="button" class="journal-compile bright"><i class="fa-solid fa-book"></i> ${esc(t('CompileGuide'))}</button>
        ${data.fieldGuide ? `<p>${esc(t('FieldGuideMade'))} <a class="content-link" data-link data-uuid="${esc(data.fieldGuide)}"><i class="fa-solid fa-book"></i> ${esc(fromUuidSync(data.fieldGuide)?.name ?? t('FieldGuide'))}</a></p>` : ''}`
    else body = renderSection(data, active)
    return `<div class="crawl-journal-body journal-edit">${renderTabs(tabs, active.id)}<div class="journal-tab-body">${body}</div></div>`
  }

  bindCompile(root: HTMLElement) {
    root.querySelectorAll<HTMLElement>('.journal-compile').forEach((button) =>
      button.addEventListener('click', async (event) => {
        event.preventDefault()
        button.setAttribute('disabled', '')
        try {
          await compileFieldGuide(this.page)
        } finally {
          button.removeAttribute('disabled')
        }
      }),
    )
  }

  bindEdit(root: HTMLElement) {
    this.bindCompile(root)
  }

  bindView(root: HTMLElement) {
    this.bindCompile(root)
  }
}

/** A city, province, country or floor: About, and the regions it holds. */
export class RegionPageSheet extends CrawlPageSheet {
  get tier() {
    return this.page.type as HigherTier
  }

  get tabs() {
    return [...REGION_SECTIONS, { id: 'map', label: t('Map'), fields: [] }, { id: 'members', label: t(`Members.${this.tier}`), fields: [] }]
  }

  async viewHTML() {
    return mapView(this.page.system) + regionView(this.page.system, t(`Members.${this.tier}`), t('RegionEmpty', { tier: t(`Tier.${this.tier}`).toLowerCase() }))
  }

  editHTML() {
    const tabs = this.tabs
    const active = tabs.find((tab) => tab.id === this.tab) ?? tabs[0]
    const data = this.data
    const body =
      active.id === 'map'
        ? mapTab(data)
        : active.id === 'members'
        ? renderSection(data, { id: 'members', label: '', fields: [{ type: 'links', key: 'members', label: t(`Members.${this.tier}`), kind: `${this.tier}Part` }] }) + `<p class="hint">${esc(t('MembersHint', { kinds: t(`Kind.${this.tier}Part`) }))}</p>`
        : renderSection(data, active)
    return `<div class="crawl-journal-body journal-edit">${renderTabs(tabs, active.id)}<div class="journal-tab-body">${body}</div></div>`
  }
}

/* The neighborhood builder */

type Draft = { name: string; summary: string; quarters: Quarter[]; boss: { uuid: string; name: string; notes: string; quarter: string } }

export class NeighborhoodBuilder extends ApplicationV2 {
  static DEFAULT_OPTIONS: any = {
    classes: ['crawlspace', 'journal-builder'],
    position: { width: 600, height: 'auto' },
    window: { resizable: true, icon: 'fa-solid fa-city', title: 'CRAWLSPACE.Journal.BuilderTitle' },
  }

  step: 'about' | 'quarters' | 'boss' = 'about'
  draft: Draft = { name: '', summary: '', quarters: [], boss: { uuid: '', name: '', notes: '', quarter: '' } }
  folder: string | null = null

  async _renderHTML() {
    const steps = ['about', 'quarters', 'boss'] as const
    const nav = `<ol class="journal-steps">${steps.map((step, index) => `<li class="${step === this.step ? 'active' : ''}">${index + 1}. ${esc(t(`Step.${step}`))}</li>`).join('')}</ol>`
    let body = ''
    if (this.step === 'about')
      body = `<label class="journal-field">${esc(t('NeighborhoodName'))}<input type="text" data-path="name" value="${esc(this.draft.name)}" autofocus></label>
        <label class="journal-field">${esc(t('SummaryDescription'))}<textarea data-path="summary" rows="6">${esc(this.draft.summary)}</textarea></label>`
    else if (this.step === 'quarters') body = `<p class="hint">${esc(t('QuartersHint'))}</p>${quarterCards(this.draft.quarters, true)}`
    else body = `<p class="hint">${esc(t('BossHint'))}</p>${bossFields(this.draft)}`
    const index = steps.indexOf(this.step)
    return `<div class="journal-edit">${nav}<div class="journal-tab-body">${body}</div>
      <footer class="journal-footer">
        ${index > 0 ? `<button type="button" data-step="back"><i class="fa-solid fa-arrow-left"></i> ${esc(t('Back'))}</button>` : ''}
        ${index < steps.length - 1 ? `<button type="button" data-step="next" class="bright">${esc(t('Next'))} <i class="fa-solid fa-arrow-right"></i></button>` : `<button type="button" data-step="finish" class="bright"><i class="fa-solid fa-check"></i> ${esc(t('Create'))}</button>`}
      </footer></div>`
  }

  _replaceHTML(html: string, content: HTMLElement) {
    content.innerHTML = html
    bindFields(
      content,
      () => this.draft,
      (draft, redraw = true) => {
        this.draft = draft
        if (redraw) this.render()
      },
    )
    bindQuarters(
      content,
      () => this.draft.quarters,
      (quarters) => {
        this.draft = setPath(this.draft, 'quarters', quarters)
        this.render()
      },
    )
    content.querySelectorAll<HTMLElement>('[data-step]').forEach((button) =>
      button.addEventListener('click', async () => {
        // Read the fields as they stand, whether or not a change event has fired yet.
        content.querySelectorAll<HTMLInputElement>('input[data-path], textarea[data-path], select[data-path]').forEach((input) => {
          this.draft = setPath(this.draft, input.dataset.path!, input.value)
        })
        const steps = ['about', 'quarters', 'boss'] as const
        const index = steps.indexOf(this.step)
        if (button.dataset.step === 'back') this.step = steps[index - 1]
        else if (button.dataset.step === 'next') {
          if (this.step === 'about' && !this.draft.name.trim()) return ui.notifications.warn(t('NameNeeded'))
          this.step = steps[index + 1]
        } else return this.finish()
        this.render()
      }),
    )
  }

  async finish() {
    const { name, summary, quarters, boss } = this.draft
    const journal = await createNeighborhoodJournal(name.trim() || t('NewNeighborhood'), { summary, quarters, boss }, this.folder)
    await this.close()
    journal?.sheet?.render(true)
  }
}

/** A new journal holding one neighborhood page. */
export async function createNeighborhoodJournal(name: string, system: Record<string, unknown> = {}, folder: string | null = null) {
  return JournalEntry.create({ name, folder, pages: [{ name, type: 'neighborhood', system }] })
}

export async function createBoroughJournal(name: string, folder: string | null = null) {
  return createRegionJournal('borough', name, folder)
}

/** A new journal holding one borough, city, province, country or floor page. */
export async function createRegionJournal(tier: RegionTier, name: string, folder: string | null = null) {
  return JournalEntry.create({ name, folder, pages: [{ name, type: tier, system: {} }] })
}

/** A blank neighborhood, borough, city, province, country or floor, opened on its page for editing. */
export async function createBlank(type: 'neighborhood' | RegionTier, folder: string | null = null) {
  const journal = type === 'neighborhood' ? await createNeighborhoodJournal(t('NewNeighborhood'), {}, folder) : isRegionTier(type) ? await createRegionJournal(type, t(`New.${type}`), folder) : null
  const page = journal?.pages.contents[0]
  if (page) page.sheet.render(true)
  return journal
}
