/**
 * The crafting window: browse recipes by category (filter known, locked, ready to craft), see what each needs
 * against what the crawler has, craft (straight away or through the GM), study recipe books, and put together an
 * experiment for the GM to judge.
 */
import { ActorPopup, droppedItem } from './actions-config'
import {
  approvalMode,
  craftCategories,
  craftContext,
  editApprovalRules,
  evaluateRecipe,
  forgetRecipe,
  gatherRecipes,
  learnRecipes,
  requestCraft,
  studyBook,
  availableTables,
  categoryOf,
  HELD_FLAG,
  TEACHES_FLAG,
  type RecipeEntry,
} from '../actors/crafting'
import { cancelExperiment, submitExperiment, type BenchEntry, type Desired } from './craft-review'
import { ITEM_SIZES } from '../rules/crafting'

const t = (key: string, data?: Record<string, unknown>) => (data ? game.i18n.format(`CRAWLSPACE.Craft.${key}`, data) : game.i18n.localize(`CRAWLSPACE.Craft.${key}`))

const DESIRED_TYPES = ['weapon', 'equipment', 'consumable', 'tattoo', 'loot', 'material']

export class CraftingApp extends ActorPopup {
  static DEFAULT_OPTIONS: any = {
    classes: ['crawlspace', 'crawl-crafting'],
    position: { width: 1040, height: 700 },
    window: { resizable: true, icon: 'fa-solid fa-hammer' },
    actions: {
      tab: CraftingApp.#onTab,
      category: CraftingApp.#onCategory,
      filter: CraftingApp.#onFilter,
      select: CraftingApp.#onSelect,
      craft: CraftingApp.#onCraft,
      openOutput: CraftingApp.#onOpenOutput,
      editRecipe: CraftingApp.#onEditRecipe,
      teach: CraftingApp.#onTeach,
      study: CraftingApp.#onStudy,
      rules: CraftingApp.#onRules,
      removeBench: CraftingApp.#onRemoveBench,
      clearDesired: CraftingApp.#onClearDesired,
      submitExperiment: CraftingApp.#onSubmit,
      cancelExperiment: CraftingApp.#onCancel,
      openItem: CraftingApp.#onOpenItem,
    },
  }

  static PARTS = { main: { template: 'systems/crawlspace/templates/apps/crafting.hbs' } }

  tab: 'recipes' | 'experiment' = 'recipes'
  category = ''
  filter: 'all' | 'known' | 'locked' = 'all'
  readyOnly = false
  search = ''
  selected = ''
  counts = new Map<string, number>()
  bench: BenchEntry[] = []
  desired: Desired = { name: '', type: 'loot', img: '', uuid: '', description: '' }
  benchCategory = ''
  benchNote = ''
  #entries: RecipeEntry[] = []

  static open(actor: any, options: { tab?: 'recipes' | 'experiment' } = {}) {
    const id = `crawl-crafting-${actor.uuid.replace(/\./g, '-')}`
    const existing: any = foundry.applications.instances.get(id)
    if (existing) {
      if (options.tab) existing.tab = options.tab
      return existing.render({ force: true })
    }
    const app = new CraftingApp(actor, { id })
    if (options.tab) app.tab = options.tab
    return app.render({ force: true })
  }

  get title() {
    return `${t('Title')}: ${this.actor.name}`
  }

  async _prepareContext() {
    const actor = this.actor
    const gm = game.user.isGM
    this.#entries = await gatherRecipes()
    const ctx = craftContext(actor)
    const categories = craftCategories()
    const rows = this.#entries
      .map((entry) => {
        const check = evaluateRecipe(actor, entry, this.counts.get(entry.key) ?? 1, ctx)
        return { entry, check }
      })
      .filter((row) => row.check.state.visible)
    const status = (row: any) => (!row.check.state.unlocked ? 'locked' : row.check.ready ? 'ready' : 'missing')
    const recipes = rows
      .map((row) => {
        const hiddenName = !row.check.state.unlocked && !gm
        return {
          key: row.entry.key,
          name: hiddenName ? t('UnknownRecipe') : row.entry.recipe.name || row.entry.output.name,
          sub: hiddenName ? row.entry.recipe.hint || t('LockedHint') : row.entry.recipe.name ? row.entry.output.name : categoryOf(row.entry.recipe.category).label,
          img: row.entry.output.img,
          category: row.entry.recipe.category,
          categoryIcon: categoryOf(row.entry.recipe.category).icon,
          status: status(row),
          statusLabel: t(`Status.${status(row)}`),
          secret: gm && row.entry.recipe.visibility !== 'known',
          visibilityLabel: t(`Visibility.${row.entry.recipe.visibility}`),
          blurred: hiddenName,
          search: `${row.entry.output.name} ${row.entry.recipe.name} ${categoryOf(row.entry.recipe.category).label}`.toLowerCase(),
        }
      })
      .sort((a, b) => ['ready', 'missing', 'locked'].indexOf(a.status) - ['ready', 'missing', 'locked'].indexOf(b.status) || a.name.localeCompare(b.name))
    if (!this.selected || !recipes.some((recipe) => recipe.key === this.selected)) this.selected = recipes[0]?.key ?? ''
    const chosen = rows.find((row) => row.entry.key === this.selected)
    const books = actor.items
      .filter((item: any) => (item.getFlag('crawlspace', TEACHES_FLAG) ?? []).length)
      .map((item: any) => {
        const keys: string[] = item.getFlag('crawlspace', TEACHES_FLAG) ?? []
        return { id: item.id, name: item.name, img: item.img, count: keys.length, fresh: keys.filter((key) => !ctx.learned.has(key)).length }
      })
    const held: Record<string, any> = actor.getFlag('crawlspace', HELD_FLAG) ?? {}
    const pending = Object.keys(held).map((id) => {
      const message = game.messages.find((entry: any) => entry.flags?.crawlspace?.experimentId === id)
      return { id, name: message?.flags?.crawlspace?.desired?.name || t('Experiment'), img: message?.flags?.crawlspace?.desired?.img || 'icons/svg/mystery-man.svg' }
    })
    return {
      actor,
      gm,
      editable: this.editable,
      tab: this.tab,
      approval: t(`Approval.${approvalMode()}`),
      categories: [
        { id: '', label: t('AllCategories'), icon: 'fa-solid fa-layer-group', count: recipes.length, active: this.category === '' },
        ...categories.map((category) => ({ ...category, count: recipes.filter((recipe) => recipe.category === category.id).length, active: this.category === category.id })),
      ],
      filters: (['all', 'known', 'locked'] as const).map((id) => ({ id, label: t(`Filter.${id}`), active: this.filter === id })),
      readyOnly: this.readyOnly,
      search: this.search,
      recipes: recipes.map((recipe) => ({ ...recipe, selected: recipe.key === this.selected })),
      detail: chosen ? this.#detail(chosen.entry, chosen.check, ctx) : null,
      tables: availableTables(actor).map((table: any) => ({ ...table, label: categoryOf(table.category).label, icon: categoryOf(table.category).icon })),
      books,
      pending,
      bench: this.bench,
      desired: this.desired,
      desiredTypes: Object.fromEntries(DESIRED_TYPES.map((type) => [type, game.i18n.localize(`TYPES.Item.${type}`)])),
      benchCategories: Object.fromEntries([['', t('AnyCategory')], ...categories.map((category) => [category.id, category.label])]),
      benchCategory: this.benchCategory,
      benchNote: this.benchNote,
      canSubmit: this.editable && !!(this.bench.length && (this.desired.name || this.desired.uuid)),
    }
  }

  #detail(entry: RecipeEntry, check: ReturnType<typeof evaluateRecipe>, ctx: any) {
    const recipe = entry.recipe
    const gm = game.user.isGM
    const unlocked = check.state.unlocked
    const learned = ctx.learned.has(entry.key)
    const condition = (c: any) => {
      switch (c.type) {
        case 'learned':
          return t('Unlock.learned')
        case 'item':
          return t('Unlock.item', { name: c.name })
        case 'skill':
          return t('Unlock.skill', { name: c.name, value: c.value })
        case 'level':
          return t('Unlock.level', { value: c.value })
        case 'floor':
          return t('Unlock.floor', { value: c.value })
        case 'table':
          return t('Unlock.table', { name: categoryOf(c.name).label, value: c.value })
        default:
          return ''
      }
    }
    const conditions = recipe.unlock.conditions.map(condition).filter(Boolean)
    return {
      key: entry.key,
      unlocked,
      learned,
      gm,
      name: !unlocked && !gm ? t('UnknownRecipe') : entry.output.name,
      recipeName: recipe.name,
      img: entry.output.img,
      blurred: !unlocked && !gm,
      category: categoryOf(recipe.category),
      hint: recipe.hint,
      visibility: t(`Visibility.${recipe.visibility}`),
      unlockText: conditions.length ? conditions.join(recipe.unlock.mode === 'any' ? ` ${t('Or')} ` : ` ${t('And')} `) : t('Unlock.learned'),
      skills: recipe.skills.map((need) => {
        const have = ctx.skills.get(need.name.toLowerCase())
        return { name: need.name, rank: need.rank, have: have ?? 0, ok: have !== undefined && have >= need.rank, rolled: check.skills.roll === need.name }
      }),
      tables: recipe.tables.map((need) => {
        const missing = check.tables.missing.includes(need)
        return { label: categoryOf(need.category).label, icon: categoryOf(need.category).icon, tier: need.tier, upgrades: need.upgrades.join(', '), ok: !missing }
      }),
      tools: check.tools,
      ingredients: check.ingredients.map((row) => ({
        name: row.ingredient.tag ? t('AnyTagged', { tag: row.ingredient.tag }) : row.ingredient.name,
        img: row.ingredient.img || (row.ingredient.tag ? 'icons/svg/item-bag.svg' : 'icons/svg/item-bag.svg'),
        need: row.need,
        have: row.have,
        ok: row.ok,
      })),
      difficulty: check.difficulty,
      tableBonus: check.tables.bonus,
      time: check.time,
      method: t(`Method.${recipe.method}`),
      size: recipe.method === 'mundane' ? ITEM_SIZES.find((size) => size.id === recipe.size)?.label : '',
      advantage: recipe.advantage,
      batch: recipe.batch,
      count: check.batch,
      makes: recipe.output.quantity * check.batch,
      auto: check.auto || gm,
      ready: check.ready && this.editable,
    }
  }

  async _onRender(context: any, options: any) {
    await super._onRender(context, options)
    const html = this.element as HTMLElement
    const search = html.querySelector<HTMLInputElement>('[data-craft-search]')
    search?.addEventListener('input', () => {
      this.search = search.value
      this.#applyFilters()
    })
    html.querySelector<HTMLInputElement>('[data-craft-ready]')?.addEventListener('change', (event) => {
      this.readyOnly = (event.target as HTMLInputElement).checked
      this.#applyFilters()
    })
    html.querySelector<HTMLInputElement>('[data-craft-count]')?.addEventListener('change', (event) => {
      this.counts.set(this.selected, Math.max(1, Math.floor(Number((event.target as HTMLInputElement).value) || 1)))
      this.render()
    })
    this.#applyFilters()
    // Experiment bench: drag materials, items, skills and spells on; drop the item you hope to make.
    this.dropZones('[data-bench-drop]', (event) => this.#onBenchDrop(event))
    this.dropZones('[data-desired-drop]', (event) => this.#onDesiredDrop(event))
    for (const input of html.querySelectorAll<HTMLInputElement>('[data-bench-quantity]'))
      input.addEventListener('change', () => {
        const entry = this.bench[Number(input.dataset.benchQuantity)]
        if (entry) entry.quantity = Math.max(1, Math.min(entry.max ?? Infinity, Math.floor(Number(input.value) || 1)))
        this.render()
      })
    for (const field of html.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-desired-field]'))
      field.addEventListener('change', () => {
        ;(this.desired as any)[field.dataset.desiredField!] = field.value
        this.render()
      })
    html.querySelector<HTMLSelectElement>('[data-bench-category]')?.addEventListener('change', (event) => (this.benchCategory = (event.target as HTMLSelectElement).value))
    html.querySelector<HTMLTextAreaElement>('[data-bench-note]')?.addEventListener('change', (event) => (this.benchNote = (event.target as HTMLTextAreaElement).value))
  }

  /** Category, known/locked and ready filters and the search box narrow the list without a re-render. */
  #applyFilters() {
    const html = this.element as HTMLElement
    const words = this.search.trim().toLowerCase()
    let shown = 0
    for (const row of html.querySelectorAll<HTMLElement>('[data-recipe-row]')) {
      const status = row.dataset.status
      const visible =
        (!this.category || row.dataset.category === this.category) &&
        (this.filter === 'all' || (this.filter === 'known' ? status !== 'locked' : status === 'locked')) &&
        (!this.readyOnly || status === 'ready') &&
        (!words || (row.dataset.search ?? '').includes(words))
      row.hidden = !visible
      if (visible) shown++
    }
    html.querySelector<HTMLElement>('[data-craft-empty]')?.toggleAttribute('hidden', shown > 0)
  }

  async #onBenchDrop(event: DragEvent) {
    const { data, item } = await droppedItem(event)
    if (!item) return
    if (item.type === 'skill' || item.type === 'spell') {
      if (this.bench.some((entry) => entry.kind === item.type && entry.name === item.name)) return
      const own = this.actor.items.find((owned: any) => owned.type === item.type && owned.name === item.name)
      this.bench.push({ kind: item.type, name: item.name, img: item.img, uuid: item.uuid, id: own?.id ?? '', rank: Math.floor(Number(own?.system.rank?.total) || 0), quantity: 1 })
      return this.render()
    }
    // Physical things must come from this crawler's inventory: they are used up.
    if (item.parent !== this.actor) return ui.notifications.warn(t('BenchOwnItems'))
    if (!('quantity' in (item.system ?? {}))) return ui.notifications.warn(t('BenchNotPhysical'))
    const held = Object.values<any[]>(this.actor.getFlag('crawlspace', HELD_FLAG) ?? {}).flat().filter((take) => take.id === item.id).reduce((sum, take) => sum + take.quantity, 0)
    const max = Math.max(0, (Number(item.system.quantity) || 0) - held)
    if (!max) return ui.notifications.warn(t('NoneFree', { name: item.name }))
    const existing = this.bench.find((entry) => entry.kind === 'item' && entry.id === item.id)
    if (existing) existing.quantity = Math.min(max, existing.quantity + 1)
    else this.bench.push({ kind: 'item', name: item.name, img: item.img, uuid: item.uuid, id: item.id, quantity: 1, max })
    void data
    return this.render()
  }

  async #onDesiredDrop(event: DragEvent) {
    const { item } = await droppedItem(event)
    if (!item) return
    this.desired = { name: item.name, type: item.type, img: item.img, uuid: item.uuid, description: '' }
    this.render()
  }

  static #onTab(this: CraftingApp, _event: Event, target: HTMLElement) {
    this.tab = target.dataset.tab === 'experiment' ? 'experiment' : 'recipes'
    this.render()
  }

  static #onCategory(this: CraftingApp, _event: Event, target: HTMLElement) {
    this.category = target.dataset.category ?? ''
    for (const button of (this.element as HTMLElement).querySelectorAll('[data-action="category"]')) button.classList.toggle('active', button === target)
    this.#applyFilters()
  }

  static #onFilter(this: CraftingApp, _event: Event, target: HTMLElement) {
    this.filter = (target.dataset.filter as any) ?? 'all'
    for (const button of (this.element as HTMLElement).querySelectorAll('[data-action="filter"]')) button.classList.toggle('active', button === target)
    this.#applyFilters()
  }

  static #onSelect(this: CraftingApp, _event: Event, target: HTMLElement) {
    this.selected = target.closest<HTMLElement>('[data-recipe-row]')?.dataset.key ?? ''
    this.render()
  }

  static async #onCraft(this: CraftingApp) {
    const entry = this.#entries.find((recipe) => recipe.key === this.selected)
    if (!entry) return
    await requestCraft(this.actor, entry, this.counts.get(entry.key) ?? 1)
    this.render()
  }

  static async #onOpenOutput(this: CraftingApp) {
    const entry = this.#entries.find((recipe) => recipe.key === this.selected)
    if (!entry) return
    const doc: any = await fromUuid(entry.itemUuid)
    doc?.sheet?.render(true)
  }

  static async #onEditRecipe(this: CraftingApp) {
    const entry = this.#entries.find((recipe) => recipe.key === this.selected)
    if (!entry || !game.user.isGM) return
    const doc: any = await fromUuid(entry.itemUuid)
    doc?.sheet?.render(true, { tab: 'crafting' })
  }

  static async #onTeach(this: CraftingApp) {
    if (!game.user.isGM || !this.selected) return
    const known: string[] = this.actor.getFlag('crawlspace', 'learnedRecipes') ?? []
    if (known.includes(this.selected)) await forgetRecipe(this.actor, this.selected)
    else await learnRecipes(this.actor, [this.selected])
  }

  static async #onStudy(this: CraftingApp, _event: Event, target: HTMLElement) {
    const item = this.actor.items.get(target.dataset.itemId)
    if (item) await studyBook(this.actor, item)
  }

  static #onRules() {
    return editApprovalRules()
  }

  static #onRemoveBench(this: CraftingApp, _event: Event, target: HTMLElement) {
    this.bench.splice(Number(target.dataset.index), 1)
    this.render()
  }

  static #onClearDesired(this: CraftingApp) {
    this.desired = { name: '', type: 'loot', img: '', uuid: '', description: '' }
    this.render()
  }

  static async #onSubmit(this: CraftingApp) {
    if (!this.bench.length || !(this.desired.name || this.desired.uuid)) return
    const sent = await submitExperiment(this.actor, { bench: this.bench, desired: this.desired, category: this.benchCategory, note: this.benchNote })
    if (!sent) return
    this.bench = []
    this.desired = { name: '', type: 'loot', img: '', uuid: '', description: '' }
    this.benchNote = ''
    this.render()
  }

  static async #onCancel(this: CraftingApp, _event: Event, target: HTMLElement) {
    await cancelExperiment(this.actor, target.dataset.id ?? '')
  }

  static async #onOpenItem(this: CraftingApp, _event: Event, target: HTMLElement) {
    const doc: any = await fromUuid(target.dataset.uuid ?? '')
    doc?.sheet?.render(true)
  }
}
