/**
 * The bestiary: every mob, boss and NPC in one window of portrait cards. It lists the world's own (homebrew) mobs
 * from the Actors directory and the world's Actor compendiums as they're made, plus any module that registers its
 * entries as a source (the private CrawlSpace Bestiary module). A toolbar toggle switches between all of them,
 * homebrew only, or one module's.
 *
 * Every card shows its stat block on demand. Actor cards edit through Foundry's own pieces: the actor sheet, the
 * FilePicker for the portrait and token image, the prototype token config, the token maker, and dragging the card
 * onto the scene. A module entry becomes a world actor (linked to the entry) the first time it's edited.
 */
import { TokenMakerApp } from './token-maker'
import { displayFormula } from '../actors/attacks'
import {
  actorCategory,
  actorLink,
  BESTIARY_CATEGORIES,
  booksIn,
  filterEntries,
  mergeEntries,
  statBlockOf,
  type BestiaryCategory,
  type BestiaryEntry,
  type BestiaryFilters,
  type StatBlock,
} from '../rules/bestiary'

export type { BestiaryEntry }

/** A module's entries in the bestiary (game.crawlspace.bestiary.registerSource). */
export interface BestiarySource {
  id: string
  /** The toggle's label, already localized. */
  label: string
  /** Its entries, with portraits in the given style. `source` and `key` are filled in by the bestiary. */
  load(style?: string): Promise<Omit<BestiaryEntry, 'source' | 'key'>[]> | Omit<BestiaryEntry, 'source' | 'key'>[]
  /** Portrait styles to pick from ({ value, label }), and the current one. */
  styles?: { value: string; label: string }[]
  getStyle?(): string
  setStyle?(style: string): Promise<unknown> | unknown
  /** The UUID of an actor (usually a compendium's) holding the entry's stat block. */
  statActor?(entry: BestiaryEntry): Promise<string | null | undefined> | string | null | undefined
  /** A new world actor for the entry (the bestiary links it to the entry and opens it). */
  createActor?(entry: BestiaryEntry, style?: string): Promise<any>
  /** The token maker's picture for the entry. */
  tokenOptions?(entry: BestiaryEntry, style?: string): { source?: string; foreground?: string; pixelArt?: boolean } | undefined
}

const sources = new Map<string, BestiarySource>()

const t = (key: string, data?: Record<string, unknown>) => (data ? game.i18n.format(`CRAWLSPACE.Bestiary.${key}`, data) : game.i18n.localize(`CRAWLSPACE.Bestiary.${key}`))
const esc = (value: unknown) => foundry.utils.escapeHTML(String(value ?? ''))
const signed = (value: number) => (value >= 0 ? `+${value}` : `${value}`)

/** A module adds its entries (see BestiarySource). Registering again replaces the source. */
export function registerBestiarySource(source: BestiarySource) {
  if (!source?.id || typeof source.load !== 'function') throw new Error('A bestiary source needs an id and a load() function.')
  sources.set(source.id, source)
  refreshBestiaries()
}

/** Plain text from an actor's HTML description. */
function plainText(html: string) {
  const element = document.createElement('div')
  element.innerHTML = String(html ?? '').replace(/<\/(p|div|h\d|li)>/gi, '$&\n')
  return (element.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim()
}

function subtitleOf(type: string, system: any) {
  const parts =
    type === 'npc'
      ? [system.job, system.race, system.floor ? game.i18n.format('CRAWLSPACE.Bestiary.Floor', { floor: system.floor }) : '']
      : [
          game.i18n.format('CRAWLSPACE.Bestiary.Level', { level: system.level ?? 0 }),
          game.i18n.format('CRAWLSPACE.Bestiary.Floor', { floor: system.floor ?? 0 }),
          system.type,
        ]
  return parts.filter(Boolean).join(' · ')
}

function actorEntry(actor: any, source: 'world' | 'pack', book?: string): BestiaryEntry | null {
  const category = actorCategory(actor)
  if (!category) return null
  const description = actor.system?.description ? plainText(actor.system.description) : ''
  return {
    key: `${source}:${actor.uuid}`,
    source,
    id: actor.uuid,
    name: actor.name,
    category,
    img: actor.img,
    book,
    subtitle: subtitleOf(actor.type, actor.system ?? {}),
    sections: description ? [{ label: t('Description'), text: description }] : [],
    actorUuid: actor.uuid,
    searchText: [actor.system?.type, actor.system?.tags].filter(Boolean).join(' '),
  }
}

/** Mob and NPC actors in the world's own Actor compendiums. */
async function packEntries() {
  const entries: BestiaryEntry[] = []
  const fields = ['img', 'system.kind', 'system.level', 'system.floor', 'system.type', 'system.tags', 'system.crawler', 'system.master', 'system.minion', 'system.job', 'system.race']
  for (const pack of game.packs.filter((pack: any) => pack.documentName === 'Actor' && pack.metadata.packageType === 'world')) {
    const index = await pack.getIndex({ fields })
    for (const row of index) {
      const entry = actorEntry({ ...row, uuid: row.uuid ?? `Compendium.${pack.collection}.Actor.${row._id}` }, 'pack', pack.title)
      if (entry) entries.push(entry)
    }
  }
  return entries
}

async function loadEntries(style: string | undefined) {
  const world = game.actors.contents.map((actor: any) => actorEntry(actor, 'world')).filter(Boolean) as BestiaryEntry[]
  const pack = await packEntries().catch((error) => (console.error('CrawlSpace | bestiary compendiums', error), []))
  const modules: BestiaryEntry[] = []
  for (const source of sources.values()) {
    try {
      for (const entry of await source.load(style)) modules.push({ ...entry, id: String(entry.id), source: source.id, key: `${source.id}:${entry.id}` })
    } catch (error) {
      console.error(`CrawlSpace | bestiary source ${source.id}`, error)
      ui.notifications.error(t('SourceFailed', { source: source.label }))
    }
  }
  const actors = game.actors.contents.map((actor: any) => ({ uuid: actor.uuid, img: actor.img, link: actorLink(actor) }))
  const merged = mergeEntries([...world, ...pack], modules, actors)
  return { entries: [...merged.homebrew, ...merged.modules], originals: new Map(modules.map((entry) => [entry.key, entry])) }
}

/** The stat block's HTML. */
function statBlockHTML(block: StatBlock, name?: string) {
  const row = (label: string, value: unknown) => (value === undefined || value === null || value === '' ? '' : `<span><b>${esc(label)}</b> ${esc(value)}</span>`)
  const stats = block.stats.map((stat) => `<div class="bestiary-stat"><b>${stat.code}</b><span>${stat.total ?? '—'}</span><small>${signed(stat.mod)}</small></div>`).join('')
  const numbers =
    block.kind === 'mob'
      ? [
          row(game.i18n.localize('CRAWLSPACE.Stat.Health'), block.health ? t('Slots', { slots: block.health.slots, perSlot: block.health.perSlot }) : ''),
          row(game.i18n.localize('CRAWLSPACE.Stat.Evade'), block.evade),
          row(game.i18n.localize('CRAWLSPACE.Stat.DR'), block.dr),
          row(game.i18n.localize('CRAWLSPACE.Stat.Move'), block.move),
          row(game.i18n.localize('CRAWLSPACE.Mob.Surprise'), block.surprise),
          row(game.i18n.localize('CRAWLSPACE.Bestiary.Size'), block.size),
        ].join('')
      : ''
  const attacks = block.attacks.length
    ? `<div class="bestiary-label">${esc(game.i18n.localize('CRAWLSPACE.Section.Attacks'))}</div><ul>${block.attacks
        .map((attack) => `<li><b>${esc(attack.name)}</b> ${esc(signed(attack.toHit))} · ${esc(attack.damage || '—')}${attack.types ? ` <small>${esc(attack.types)}</small>` : ''}</li>`)
        .join('')}</ul>`
    : ''
  const abilities = block.abilities.length
    ? `<div class="bestiary-label">${esc(game.i18n.localize('CRAWLSPACE.Mob.Abilities'))}</div><ul>${block.abilities
        .map((ability) => `<li><b>${esc(ability.name)}</b>${ability.description ? ` ${esc(plainText(ability.description))}` : ''}</li>`)
        .join('')}</ul>`
    : ''
  const traits = block.traits.map((trait) => `<span><b>${esc(game.i18n.localize(`CRAWLSPACE.Sheet.${trait.key}`))}</b> ${esc(trait.values.join(', '))}</span>`).join('')
  return `${name ? `<div class="bestiary-label">${esc(name)}</div>` : ''}
    ${numbers ? `<div class="bestiary-numbers">${numbers}</div>` : ''}
    <div class="bestiary-stats">${stats}</div>
    ${traits ? `<div class="bestiary-numbers">${traits}</div>` : ''}
    ${block.tags.length ? `<div class="pf-tags">${block.tags.map((tag) => `<span class="pf-tag">${esc(tag)}</span>`).join('')}</div>` : ''}
    ${attacks}${abilities}`
}

async function statBlockFor(uuid: string) {
  const actor: any = await fromUuid(uuid)
  if (!actor) return ''
  const damage = (formula: string) => displayFormula(actor, formula)
  let html = statBlockHTML(statBlockOf(actor.type, actor.system, damage))
  // An NPC fights with its linked mob's stat block.
  const linked: any = actor.type === 'npc' && actor.system.statBlock ? await fromUuid(actor.system.statBlock) : null
  if (linked) html += statBlockHTML(statBlockOf(linked.type, linked.system, (formula) => displayFormula(linked, formula)), t('FightsAs', { name: linked.name }))
  return html
}

const { ApplicationV2 } = foundry.applications.api

export class BestiaryApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    classes: ['crawlspace-bestiary'],
    position: { width: 980, height: 780 },
    window: { icon: 'fa-solid fa-dragon', resizable: true },
    actions: {
      edit: BestiaryApp.#onEdit,
      statBlock: BestiaryApp.#onStatBlock,
      portrait: BestiaryApp.#onPortrait,
      tokenImage: BestiaryApp.#onTokenImage,
      tokenConfig: BestiaryApp.#onTokenConfig,
      makeToken: BestiaryApp.#onMakeToken,
      usePortrait: BestiaryApp.#onUsePortrait,
      tokenFor: BestiaryApp.#onTokenFor,
      view: BestiaryApp.#onView,
    },
  }

  /** One window for the Actors sidebar (actor: null), and one per actor that opens it to pick a portrait. */
  static open(actor: any = null) {
    const id = `crawlspace-bestiary-${actor ? actor.uuid.replace(/\./g, '-') : 'directory'}`
    const existing = foundry.applications.instances.get(id) as BestiaryApp | undefined
    if (existing) return existing.render({ force: true })
    return new BestiaryApp({ id, actor }).render({ force: true })
  }

  actor: any
  filters: BestiaryFilters = { search: '', category: 'main', view: 'all', book: '' }
  entries: BestiaryEntry[] = []
  originals = new Map<string, BestiaryEntry>()
  /** Cards showing their stat block. */
  open = new Set<string>()
  #error = ''

  constructor(options: any = {}) {
    super(options)
    this.actor = options.actor ?? null
  }

  get title() {
    return this.actor ? `${t('Title')}: ${this.actor.name}` : t('Title')
  }

  /** The source with portrait styles (the module's painted / anime / pixel). */
  get #styled() {
    return [...sources.values()].find((source) => source.styles?.length && source.getStyle)
  }

  get style() {
    return this.#styled?.getStyle?.()
  }

  async #load() {
    try {
      const loaded = await loadEntries(this.style)
      this.entries = loaded.entries
      this.originals = loaded.originals
      this.#error = ''
    } catch (error) {
      console.error('CrawlSpace | bestiary', error)
      this.#error = t('LoadFailed')
    }
    if (this.filters.view !== 'all' && this.filters.view !== 'homebrew' && !sources.has(this.filters.view)) this.filters.view = 'all'
  }

  /** Reload the entries and redraw the list (an actor was made, changed or deleted). */
  async refresh() {
    await this.#load()
    if (!this.rendered) return
    this.#renderToolbar()
    this.#renderList()
  }

  async _renderHTML() {
    await this.#load()
    const root = document.createElement('div')
    root.className = 'bestiary-body'
    root.innerHTML = `
      <div class="bestiary-toolbar">
        <input type="search" name="search" value="${esc(this.filters.search)}" placeholder="${esc(t('Search'))}" aria-label="${esc(t('Search'))}">
        <select name="view" aria-label="${esc(t('ViewLabel'))}" data-tooltip="${esc(t('ViewLabel'))}"></select>
        <select name="category" aria-label="${esc(t('CategoryLabel'))}"></select>
        <select name="book" aria-label="${esc(t('BookLabel'))}"></select>
        <select name="style" aria-label="${esc(t('StyleLabel'))}" data-tooltip="${esc(t('StyleLabel'))}"></select>
      </div>
      <p class="bestiary-count" aria-live="polite"></p>
      <div class="bestiary-entries"></div>`
    return root
  }

  _replaceHTML(result: HTMLElement, content: HTMLElement) {
    content.replaceChildren(result)
  }

  _onRender(context: any, options: any) {
    super._onRender(context, options)
    const root = this.element as HTMLElement
    for (const name of ['search', 'view', 'category', 'book'] as const)
      root.querySelector(`[name=${name}]`)!.addEventListener('input', (event: Event) => {
        ;(this.filters as any)[name] = (event.target as HTMLInputElement).value
        if (name === 'view') this.filters.book = ''
        if (name === 'view') this.#renderToolbar()
        this.#renderList()
      })
    root.querySelector('[name=style]')!.addEventListener('change', async (event: Event) => {
      await this.#styled?.setStyle?.((event.target as HTMLSelectElement).value)
      await this.refresh()
    })
    const list = root.querySelector<HTMLElement>('.bestiary-entries')!
    // Dragging an actor's card onto the scene places its token (core's actor drop).
    list.addEventListener('dragstart', (event: DragEvent) => {
      const card = (event.target as HTMLElement).closest<HTMLElement>('[data-uuid]')
      if (!card || !event.dataTransfer) return
      event.dataTransfer.setData('text/plain', JSON.stringify({ type: 'Actor', uuid: card.dataset.uuid }))
    })
    this.#renderToolbar()
    this.#renderList()
  }

  #renderToolbar() {
    const root = this.element as HTMLElement
    const options = (values: { value: string; label: string }[], selected: string) =>
      values.map(({ value, label }) => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`).join('')
    const view = root.querySelector<HTMLSelectElement>('[name=view]')!
    // The toggle only matters when a module adds its own mobs.
    view.hidden = !sources.size
    view.innerHTML = options(
      [
        { value: 'all', label: t('View.all') },
        { value: 'homebrew', label: t('View.homebrew') },
        ...[...sources.values()].map((source) => ({ value: source.id, label: source.label })),
      ],
      this.filters.view,
    )
    root.querySelector<HTMLSelectElement>('[name=category]')!.innerHTML = options(
      BESTIARY_CATEGORIES.map((value) => ({ value, label: t(`Category.${value}`) })),
      this.filters.category,
    )
    const books = booksIn(this.entries, this.filters.view)
    const book = root.querySelector<HTMLSelectElement>('[name=book]')!
    book.hidden = books.length < 2
    if (!books.includes(this.filters.book)) this.filters.book = ''
    book.innerHTML = options([{ value: '', label: t('AllBooks') }, ...books.map((value) => ({ value, label: value }))], this.filters.book)
    const styled = this.#styled
    const style = root.querySelector<HTMLSelectElement>('[name=style]')!
    style.hidden = !styled || this.filters.view === 'homebrew'
    style.innerHTML = styled ? options(styled.styles!, this.style ?? '') : ''
  }

  #renderList() {
    const root = this.element as HTMLElement
    const shown = filterEntries(this.entries, this.filters)
    root.querySelector('.bestiary-count')!.textContent = this.#error || t('Count', { count: shown.length })
    const list = root.querySelector<HTMLElement>('.bestiary-entries')!
    const scroll = list.scrollTop
    list.innerHTML = shown.map((entry) => this.#card(entry)).join('')
    list.scrollTop = scroll
    for (const key of this.open) {
      const card = list.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`)
      if (card) void this.#fillStatBlock(card)
    }
  }

  /** The actor behind an entry, and whether this user may change it. */
  #actorOf(entry: BestiaryEntry) {
    if (!entry.actorUuid) return { actor: null, editable: false, world: false }
    const actor: any = fromUuidSync(entry.actorUuid)
    const world = entry.actorUuid.startsWith('Actor.')
    const pack = world ? null : game.packs.get(entry.actorUuid.split('.').slice(1, 3).join('.'))
    const editable = world ? !!actor?.isOwner : !!pack && !pack.locked && game.user.isGM
    return { actor, editable, world }
  }

  #card(entry: BestiaryEntry) {
    const source = sources.get(entry.source)
    const { editable, world } = this.#actorOf(entry)
    const button = (action: string, icon: string, label: string, tooltip?: string) =>
      `<button type="button" data-action="${action}"${tooltip ? ` data-tooltip="${esc(tooltip)}"` : ''}><i class="${icon}"></i> ${esc(label)}</button>`
    const actions: string[] = []
    if (this.actor) {
      if (entry.img) actions.push(button('usePortrait', 'fa-solid fa-image-portrait', t('UsePortrait')), button('tokenFor', 'fa-solid fa-circle-user', t('MakeToken')))
    } else if (entry.actorUuid) {
      actions.push(button('edit', 'fa-solid fa-pen-to-square', editable ? t('Edit') : t('OpenSheet')))
      if (editable) actions.push(button('portrait', 'fa-solid fa-image-portrait', t('Portrait'), t('PortraitHint')), button('tokenImage', 'fa-solid fa-image', t('TokenImage'), t('TokenImageHint')))
      if (editable && world) actions.push(button('tokenConfig', 'fa-solid fa-user-gear', t('TokenSettings')), button('makeToken', 'fa-solid fa-circle-user', t('MakeToken')))
    } else if (source?.createActor) {
      actions.push(button('edit', 'fa-solid fa-pen-to-square', t('Edit'), t('EditModuleHint')), button('makeToken', 'fa-solid fa-circle-user', t('MakeToken'), t('MakeTokenModuleHint')))
    }
    const hasStats = !!entry.actorUuid || !!source?.statActor
    if (hasStats) actions.push(button('statBlock', 'fa-solid fa-table-list', t('StatBlock')))
    const open = this.open.has(entry.key)
    const drag = entry.actorUuid && !this.actor ? ` draggable="true" data-uuid="${esc(entry.actorUuid)}" data-tooltip="${esc(t('DragHint'))}" data-tooltip-direction="UP"` : ''
    const origin = source ? source.label : entry.source === 'pack' ? entry.book : t('View.homebrew')
    const sections = (entry.sections ?? [])
      .filter((section) => section.text)
      .map((section, index) => `<div class="${index ? 'bestiary-profile' : ''}"><div class="bestiary-label">${esc(section.label)}</div><div class="bestiary-desc">${esc(section.text)}</div></div>`)
      .join('')
    return `<article class="bestiary-card${open ? ' stats-open' : ''}" data-key="${esc(entry.key)}">${
      entry.img
        ? `<a class="bestiary-image${entry.pixelArt ? ' pixel' : ''}" data-action="view"${drag}><img loading="lazy" src="${esc(entry.img)}" alt="${esc(entry.name)}"></a>`
        : ''
    }<div class="bestiary-card-body">
      <span class="bestiary-badge">${esc(t(`Category.${entry.category}`))}</span>
      ${entry.actorUuid && entry.source !== 'world' && entry.source !== 'pack' ? `<span class="bestiary-badge linked" data-tooltip="${esc(t('LinkedHint'))}"><i class="fa-solid fa-link"></i> ${esc(t('Linked'))}</span>` : ''}
      <h2>${esc(entry.name)}</h2>
      ${actions.length ? `<div class="bestiary-actions">${actions.join('')}</div>` : ''}
      <div class="bestiary-source">${esc([origin, entry.subtitle].filter(Boolean).join(' · '))}</div>
      ${hasStats ? `<div class="bestiary-statblock"${open ? '' : ' hidden'}></div>` : ''}
      ${sections}
      ${entry.note ? `<p class="bestiary-note">${esc(entry.note)}</p>` : ''}
    </div></article>`
  }

  #entry(target: HTMLElement) {
    const key = target.closest<HTMLElement>('[data-key]')?.dataset.key
    return this.entries.find((entry) => entry.key === key)
  }

  /** Busy while working, so a second click doesn't make a second actor. */
  async #busy(target: HTMLElement, work: () => Promise<unknown>) {
    if ((target as HTMLButtonElement).disabled) return
    ;(target as HTMLButtonElement).disabled = true
    try {
      await work()
    } catch (error: any) {
      console.error('CrawlSpace | bestiary', error)
      ui.notifications.error(error?.message || t('Failed'))
    } finally {
      ;(target as HTMLButtonElement).disabled = false
    }
  }

  async #fillStatBlock(card: HTMLElement) {
    const entry = this.entries.find((candidate) => candidate.key === card.dataset.key)
    const box = card.querySelector<HTMLElement>('.bestiary-statblock')
    if (!entry || !box) return
    box.hidden = false
    box.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`
    const uuid = entry.actorUuid ?? (await sources.get(entry.source)?.statActor?.(entry))
    box.innerHTML = (uuid && (await statBlockFor(uuid))) || `<p class="bestiary-note">${esc(t('NoStatBlock'))}</p>`
  }

  /** The world actor for a module entry, made (and linked) the first time it's needed. */
  async #worldActor(entry: BestiaryEntry) {
    if (entry.actorUuid) return fromUuid(entry.actorUuid) as Promise<any>
    const source = sources.get(entry.source)
    const original = this.originals.get(entry.key) ?? entry
    const actor = await source?.createActor?.(original, this.style)
    if (!actor) return null
    await actor.update({ 'flags.crawlspace.bestiary': { source: entry.source, id: entry.id } })
    return actor
  }

  /** The token maker's picture: the module's layered art while the actor still has the entry's portrait. */
  #tokenOptions(entry: BestiaryEntry, actor: any) {
    const original = this.originals.get(entry.key)
    if (!original || (actor && actor.img !== original.img)) return actor ? { source: actor.img } : undefined
    return sources.get(entry.source)?.tokenOptions?.(original, this.style) ?? { source: original.img }
  }

  static async #onEdit(this: BestiaryApp, _event: Event, target: HTMLElement) {
    const entry = this.#entry(target)
    if (!entry) return
    await this.#busy(target, async () => {
      const actor = await this.#worldActor(entry)
      actor?.sheet.render({ force: true })
    })
  }

  static async #onStatBlock(this: BestiaryApp, _event: Event, target: HTMLElement) {
    const card = target.closest<HTMLElement>('[data-key]')
    const entry = this.#entry(target)
    if (!card || !entry) return
    if (this.open.delete(entry.key)) {
      card.classList.remove('stats-open')
      card.querySelector<HTMLElement>('.bestiary-statblock')!.hidden = true
      return
    }
    this.open.add(entry.key)
    card.classList.add('stats-open')
    await this.#busy(target, () => this.#fillStatBlock(card))
  }

  static async #onPortrait(this: BestiaryApp, _event: Event, target: HTMLElement) {
    const entry = this.#entry(target)
    const actor: any = entry?.actorUuid ? await fromUuid(entry.actorUuid) : null
    if (!actor) return
    pickImage(actor.img, (img) => actor.update({ img }))
  }

  static async #onTokenImage(this: BestiaryApp, _event: Event, target: HTMLElement) {
    const entry = this.#entry(target)
    const actor: any = entry?.actorUuid ? await fromUuid(entry.actorUuid) : null
    if (!actor) return
    pickImage(actor.prototypeToken?.texture?.src || actor.img, async (src) => {
      await actor.update({ 'prototypeToken.texture.src': src })
      ui.notifications.info(t('TokenImageSet', { name: actor.name }))
    })
  }

  static async #onTokenConfig(this: BestiaryApp, _event: Event, target: HTMLElement) {
    const entry = this.#entry(target)
    const actor: any = entry?.actorUuid ? await fromUuid(entry.actorUuid) : null
    if (actor) new CONFIG.Token.prototypeSheetClass({ prototype: actor.prototypeToken }).render({ force: true })
  }

  /**
   * The token maker for the entry's actor (a module entry's is made first). A new actor's sheet opens once the
   * token maker closes, so its token becomes the prototype token first.
   */
  static async #onMakeToken(this: BestiaryApp, _event: Event, target: HTMLElement) {
    const entry = this.#entry(target)
    if (!entry) return
    await this.#busy(target, async () => {
      const made = !entry.actorUuid
      const actor = await this.#worldActor(entry)
      if (!actor) return
      const tokenMaker = await TokenMakerApp.open(actor, this.#tokenOptions(entry, made ? null : actor))
      if (!made) return
      const hook = Hooks.on('closeApplicationV2', (app: any) => {
        if (app !== tokenMaker) return
        Hooks.off('closeApplicationV2', hook)
        actor.sheet.render({ force: true })
      })
    })
  }

  /** Opened from an actor's sheet: that actor takes this entry's portrait. */
  static async #onUsePortrait(this: BestiaryApp, _event: Event, target: HTMLElement) {
    const entry = this.#entry(target)
    if (!entry?.img || !this.actor) return
    await this.#busy(target, async () => {
      await this.actor.update({ img: entry.img })
      ui.notifications.info(t('PortraitSet', { name: this.actor.name }))
    })
  }

  /** Opened from an actor's sheet: the token maker for that actor with this entry's picture. */
  static async #onTokenFor(this: BestiaryApp, _event: Event, target: HTMLElement) {
    const entry = this.#entry(target)
    if (!entry?.img || !this.actor) return
    const original = this.originals.get(entry.key)
    const options = original && original.img === entry.img ? sources.get(entry.source)?.tokenOptions?.(original, this.style) : undefined
    await this.#busy(target, () => TokenMakerApp.open(this.actor, options ?? { source: entry.img, pixelArt: entry.pixelArt }))
  }

  static #onView(this: BestiaryApp, _event: Event, target: HTMLElement) {
    const entry = this.#entry(target)
    if (!entry?.img) return
    new foundry.applications.apps.ImagePopout({ src: entry.img, window: { title: entry.name } } as any).render({ force: true })
  }
}

function pickImage(current: string, callback: (path: string) => unknown) {
  const FilePicker = foundry.applications.apps.FilePicker.implementation
  new FilePicker({ type: 'image', current, callback: (path: string) => void callback(path) } as any).render({ force: true })
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null
/** Open bestiaries pick up actors as they're made, changed and deleted. */
function refreshBestiaries() {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    for (const app of foundry.applications.instances.values()) if (app instanceof BestiaryApp && app.rendered) void app.refresh()
  }, 150)
}

export const bestiaryApi = {
  open: (actor?: any) => BestiaryApp.open(actor ?? null),
  registerSource: registerBestiarySource,
  sources: () => [...sources.values()],
}

export function registerBestiary() {
  // Compendium actors fire these too.
  for (const hook of ['createActor', 'updateActor', 'deleteActor']) Hooks.on(hook, refreshBestiaries)

  Hooks.on('renderActorDirectory', (_app: any, html: HTMLElement) => {
    if (!game.user.isGM || html.querySelector('.crawlspace-bestiary-open')) return
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'crawlspace-bestiary-open'
    button.innerHTML = `<i class="fa-solid fa-dragon"></i> ${esc(t('Title'))}`
    button.addEventListener('click', () => BestiaryApp.open())
    html.querySelector('.header-actions')?.append(button)
  })

  // From an actor's sheet: pick a portrait or token picture from the bestiary.
  Hooks.on('getHeaderControlsActorSheetV2', (sheet: any, controls: any[]) => {
    if (!game.user.isGM) return
    controls.push({ icon: 'fa-solid fa-dragon', label: 'CRAWLSPACE.Bestiary.Open', action: 'crawlspaceBestiary', onClick: () => BestiaryApp.open(sheet.actor) })
  })
}

export type { BestiaryCategory }
