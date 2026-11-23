/**
 * Crafting experiments: a player puts materials, skills and spells on the bench and names what they hope to make.
 * The GM gets a card and a review window to grant it, edit it first, give something else, or let it fail.
 * The bench's materials are set aside (not usable for other crafts) until the GM answers.
 */
import { categoryOf, FAILED_FLAG, giveItem, HELD_FLAG, learnRecipes, RECIPES_FLAG, sourceOf, spendTakes } from '../actors/crafting'
import { rollCheck } from '../dice/rolls'
import { benchSignature, normalizeRecipe, randomId, recipeKey } from '../rules/crafting'

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api
const t = (key: string, data?: Record<string, unknown>) => (data ? game.i18n.format(`CRAWLSPACE.Craft.${key}`, data) : game.i18n.localize(`CRAWLSPACE.Craft.${key}`))
const esc = (value: unknown) => foundry.utils.escapeHTML(String(value ?? ''))

export type BenchEntry = { kind: 'item' | 'skill' | 'spell'; name: string; img: string; uuid: string; id: string; quantity: number; rank?: number; max?: number; source?: string; tags?: string[] }
/** The crafting table an experiment was made at. */
export type BenchTable = { name: string; category: string; tier: number; upgrades: string[]; found: boolean }
export type Desired = { name: string; type: string; img: string; uuid: string; description: string }

const gmIds = () => game.users.filter((user: any) => user.isGM).map((user: any) => user.id)

export async function submitExperiment(actor: any, data: { bench: BenchEntry[]; desired: Desired; category: string; note: string; signature: string; table: BenchTable | null }) {
  if (!game.users.activeGM) {
    ui.notifications.warn(game.i18n.localize('CRAWLSPACE.Warn.NeedGM'))
    return false
  }
  const id = randomId()
  const takes = data.bench.filter((entry) => entry.kind === 'item').map((entry) => ({ id: entry.id, quantity: Math.floor(entry.quantity) }))
  await actor.setFlag('crawlspace', HELD_FLAG, { ...(actor.getFlag('crawlspace', HELD_FLAG) ?? {}), [id]: takes })
  const used = data.bench
    .map((entry) => `<li><img src="${esc(entry.img)}" alt=""> ${esc(entry.name)}${entry.kind === 'item' ? ` ×${entry.quantity}` : ` <span class="craft-chip">${esc(game.i18n.localize(`TYPES.Item.${entry.kind}`))}</span>`}</li>`)
    .join('')
  const content = `<div class="crawl-card craft-card craft-experiment">
    <h4 class="card-title"><i class="fa-solid fa-flask-vial"></i> ${t('ExperimentTitle', { actor: esc(actor.name) })}</h4>
    <div class="craft-card-output"><img src="${esc(data.desired.img || 'icons/svg/mystery-man.svg')}" alt=""><span>${esc(data.desired.name)}</span></div>
    ${data.category ? `<p class="craft-card-meta">${esc(categoryOf(data.category).label)}</p>` : ''}
    <ul class="craft-card-list">${used}</ul>
    ${data.table ? `<p class="craft-card-meta"><i class="fa-solid fa-table-cells-large"></i> ${t('AtTable', { name: esc(data.table.name), tier: data.table.tier })}</p>` : ''}
    ${data.note ? `<p class="craft-card-note">${esc(data.note)}</p>` : ''}
    <div class="card-buttons" data-gm-only><button type="button" data-crawl-action="craft-review"><i class="fa-solid fa-magnifying-glass"></i> ${t('Review')}</button></div>
  </div>`
  const message = await ChatMessage.create({
    content,
    speaker: ChatMessage.getSpeaker({ actor }),
    whisper: gmIds(),
    flags: { crawlspace: { kind: 'craftExperiment', experimentId: id, actorUuid: actor.uuid, bench: data.bench, desired: data.desired, category: data.category, note: data.note, signature: data.signature, table: data.table } },
  })
  ui.notifications.info(t('ExperimentSent'))
  return !!message
}

async function releaseHold(actor: any, id: string) {
  const held = { ...(actor.getFlag('crawlspace', HELD_FLAG) ?? {}) }
  if (!(id in held)) return
  await actor.update({ [`flags.crawlspace.${HELD_FLAG}.-=${id}`]: null })
}

/** The player takes an unanswered experiment back. */
export async function cancelExperiment(actor: any, id: string) {
  const message = game.messages.find((entry: any) => entry.flags?.crawlspace?.experimentId === id)
  if (message?.flags?.crawlspace?.answered) return
  await releaseHold(actor, id)
  if (message && (message.isOwner || game.user.isGM)) await message.update({ 'flags.crawlspace.answered': 'cancelled' })
}

export type Decision = {
  outcome: 'grant' | 'other' | 'fail'
  /** The item granted: the player's own pick, the GM's edited copy, or another item. */
  itemUuid: string
  quantity: number
  consume: boolean
  /** On a failure: what fraction of the materials comes back. */
  salvage: 'all' | 'half' | 'none'
  saveRecipe: boolean
  note: string
}

/** Build a world item from a typed-in wish so the GM can edit and grant it. */
async function itemFromWish(desired: Desired) {
  const folderName = t('CraftedFolder')
  let folder = game.folders.find((entry: any) => entry.type === 'Item' && entry.name === folderName)
  if (!folder) folder = await Folder.create({ name: folderName, type: 'Item' })
  if (desired.uuid) {
    const source: any = await fromUuid(desired.uuid)
    if (source) {
      const data = source.toObject()
      delete data._id
      return Item.create({ ...data, folder: folder.id, flags: { ...(data.flags ?? {}), crawlspace: { ...(data.flags?.crawlspace ?? {}), craftedFrom: desired.uuid } } })
    }
  }
  return Item.create({
    name: desired.name || t('Experiment'),
    type: desired.type || 'loot',
    img: desired.img || undefined,
    folder: folder.id,
    system: { description: desired.description ? `<p>${esc(desired.description)}</p>` : '' },
  })
}

/** What the bench's materials were, by the item each came from (read before any are used up). */
function benchMaterials(actor: any, bench: BenchEntry[]) {
  return bench
    .filter((entry) => entry.kind === 'item')
    .map((entry) => ({ name: entry.name, img: entry.img, source: entry.source || sourceOf(actor.items.get(entry.id)), quantity: Math.floor(entry.quantity) }))
}

/** A failed mix is remembered on the crawler, so the same items on the bench later warn them. */
async function rememberFailure(actor: any, flags: any) {
  const signature = flags.signature || benchSignature(benchMaterials(actor, flags.bench ?? []))
  if (!signature) return
  const failed = (actor.getFlag('crawlspace', FAILED_FLAG) ?? []).filter((entry: any) => entry.signature !== signature)
  await actor.setFlag('crawlspace', FAILED_FLAG, [...failed, { signature, name: flags.desired?.name ?? '', img: flags.desired?.img ?? '' }])
}

/**
 * Whatever the GM granted (the wish, an edited copy or another item) gets the experiment as a recipe, which the
 * crawler now knows. A compendium item gets a world copy to carry it. The same mix already on the item is not added twice.
 */
async function saveExperimentRecipe(actor: any, source: any, flags: any, quantity: number) {
  let host = source
  if (source.pack) host = await itemFromWish({ ...flags.desired, uuid: source.uuid })
  const materials = benchMaterials(actor, flags.bench ?? [])
  const signature = benchSignature(materials)
  const existing = (host.getFlag('crawlspace', RECIPES_FLAG) ?? []).map(normalizeRecipe)
  const same = existing.find(
    (recipe: any) => benchSignature(recipe.ingredients.map((entry: any) => ({ name: entry.name ?? entry.tag ?? '', source: entry.uuid ?? '', quantity: entry.quantity }))) === signature,
  )
  if (same) return learnRecipes(actor, [recipeKey(host.uuid, same.id)])
  const table: BenchTable | null = flags.table ?? null
  const recipe = {
    id: randomId(),
    category: flags.category || table?.category || 'mundane',
    visibility: 'hidden',
    ingredients: materials.map((entry) => ({ name: entry.name, img: entry.img, uuid: entry.source, quantity: entry.quantity })),
    skills: (flags.bench as BenchEntry[]).filter((entry) => entry.kind !== 'item').map((entry) => ({ name: entry.name, rank: 0 })),
    tables: table ? [{ category: table.category, tier: 1, upgrades: [] }] : [],
    output: { quantity },
    hint: '',
  }
  await host.setFlag('crawlspace', RECIPES_FLAG, [...existing, recipe])
  await learnRecipes(actor, [recipeKey(host.uuid, recipe.id)])
  // It worked this time: forget any earlier failure with the same mix.
  const failed = actor.getFlag('crawlspace', FAILED_FLAG) ?? []
  if (failed.some((entry: any) => entry.signature === signature)) await actor.setFlag('crawlspace', FAILED_FLAG, failed.filter((entry: any) => entry.signature !== signature))
}

/** Carry out the GM's decision on an experiment card. */
export async function resolveExperiment(message: any, decision: Decision) {
  const flags = message.flags?.crawlspace
  if (!game.user.isGM || flags?.kind !== 'craftExperiment' || flags.answered) return
  const actor: any = await fromUuid(flags.actorUuid)
  if (!actor) return ui.notifications.warn(t('ActorGone'))
  const takes: { id: string; quantity: number }[] = (flags.bench as BenchEntry[]).filter((entry) => entry.kind === 'item').map((entry) => ({ id: entry.id, quantity: entry.quantity }))
  await releaseHold(actor, flags.experimentId)
  const lines: string[] = []
  let granted: any = null
  if (decision.outcome === 'fail') {
    const kept = (quantity: number) => (decision.salvage === 'all' ? quantity : decision.salvage === 'half' ? Math.floor(quantity / 2) : 0)
    if (decision.consume) await spendTakes(actor, takes.map((take) => ({ id: take.id, quantity: take.quantity - kept(take.quantity) })))
    lines.push(t('ExperimentFailed'))
    if (decision.consume) lines.push(t(`Salvage.${decision.salvage}`))
    await rememberFailure(actor, flags)
  } else {
    let source: any = decision.itemUuid ? await fromUuid(decision.itemUuid) : null
    if (!source) source = await itemFromWish(flags.desired)
    // The recipe can't go on a compendium item: give a world copy instead, so the crawler's item points at it.
    if (source.pack && decision.saveRecipe !== false) source = await itemFromWish({ ...flags.desired, uuid: source.uuid })
    if (decision.consume) await spendTakes(actor, takes)
    const quantity = Math.max(1, Math.floor(decision.quantity) || 1)
    granted = source
    await giveItem(actor, source.toObject(), quantity, source.uuid)
    lines.push(t('ExperimentGranted', { name: esc(source.name), quantity }))
    // Keep the recipe: it goes on the item (a world copy if it came from a compendium) and the crawler knows it.
    if (decision.saveRecipe !== false) {
      await saveExperimentRecipe(actor, source, flags, quantity)
      lines.push(t('RecipeSaved'))
    }
  }
  if (decision.note) lines.push(`<em>${esc(decision.note)}</em>`)
  await message.update({ 'flags.crawlspace.answered': decision.outcome })
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="crawl-card craft-card ${decision.outcome === 'fail' ? 'craft-fail' : 'craft-success'}">
      <h4 class="card-title"><i class="fa-solid fa-flask-vial"></i> ${t('ExperimentResult', { actor: esc(actor.name) })}</h4>
      ${granted ? `<div class="craft-card-output"><img src="${esc(granted.img)}" alt=""><span>${esc(granted.name)}</span></div>` : ''}
      ${lines.map((line) => `<p>${line}</p>`).join('')}
    </div>`,
    flags: { crawlspace: { kind: 'craftResult' } },
  })
}

/** The GM's review window for one experiment card. */
export class ExperimentReview extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS: any = {
    classes: ['crawlspace', 'crawl-craft-review'],
    position: { width: 640, height: 'auto' },
    window: { resizable: true, icon: 'fa-solid fa-flask-vial' },
    actions: {
      outcome: ExperimentReview.#onOutcome,
      editCopy: ExperimentReview.#onEditCopy,
      openItem: ExperimentReview.#onOpenItem,
      roll: ExperimentReview.#onRoll,
      resolve: ExperimentReview.#onResolve,
      clearOther: ExperimentReview.#onClearOther,
    },
  }

  static PARTS = { main: { template: 'systems/crawlspace/templates/apps/craft-review.hbs' } }

  message: any
  outcome: 'grant' | 'edit' | 'other' | 'fail' = 'grant'
  editedUuid = ''
  otherUuid = ''
  quantity = 1
  consume = true
  salvage: Decision['salvage'] = 'half'
  saveRecipe = true
  note = ''
  checkSkill = ''
  checkDc = 15
  checkBonus: number | null = null
  lastRoll: { total: number; outcome: string } | null = null

  constructor(message: any, options: any = {}) {
    super(options)
    this.message = message
  }

  static open(message: any) {
    const id = `crawl-craft-review-${message.id}`
    const existing = foundry.applications.instances.get(id)
    if (existing) return existing.render({ force: true })
    return new ExperimentReview(message, { id }).render({ force: true })
  }

  get title() {
    return t('ReviewTitle')
  }

  async _prepareContext() {
    const flags = this.message.flags.crawlspace
    const actor: any = fromUuidSync(flags.actorUuid)
    const bench: BenchEntry[] = flags.bench ?? []
    const other: any = this.otherUuid ? fromUuidSync(this.otherUuid) : null
    const edited: any = this.editedUuid ? fromUuidSync(this.editedUuid) : null
    const skills = actor ? actor.items.filter((item: any) => item.type === 'skill' || item.type === 'spell') : []
    if (!this.checkSkill) this.checkSkill = bench.find((entry) => entry.kind !== 'item')?.name ?? ''
    if (this.checkBonus === null) this.checkBonus = Math.floor(Number(flags.table?.tier) || 0)
    const failedBefore = !!flags.signature && !!actor && (actor.getFlag('crawlspace', FAILED_FLAG) ?? []).some((entry: any) => entry.signature === flags.signature)
    return {
      actor,
      bench,
      materials: bench.filter((entry) => entry.kind === 'item'),
      abilities: bench.filter((entry) => entry.kind !== 'item'),
      desired: flags.desired,
      category: flags.category ? categoryOf(flags.category).label : '',
      note: flags.note,
      table: flags.table,
      failedBefore,
      answered: flags.answered,
      outcomes: (['grant', 'edit', 'other', 'fail'] as const).map((id) => ({ id, label: t(`Outcome.${id}`), icon: { grant: 'fa-gift', edit: 'fa-pen-to-square', other: 'fa-right-left', fail: 'fa-burst' }[id], active: this.outcome === id })),
      outcome: this.outcome,
      edited,
      other,
      quantity: this.quantity,
      consume: this.consume,
      salvage: this.salvage,
      salvageChoices: { all: t('SalvageChoice.all'), half: t('SalvageChoice.half'), none: t('SalvageChoice.none') },
      saveRecipe: this.saveRecipe,
      reviewNote: this.note,
      skillChoices: Object.fromEntries([['', t('NoSkill')], ...skills.map((item: any) => [item.name, `${item.name} (${Math.floor(Number(item.system.rank?.total) || 0)})`])]),
      checkSkill: this.checkSkill,
      checkDc: this.checkDc,
      checkBonus: this.checkBonus,
      lastRoll: this.lastRoll,
    }
  }

  async _onRender(context: any, options: any) {
    await super._onRender(context, options)
    const html = this.element as HTMLElement
    const bind = (selector: string, apply: (value: string, input: HTMLInputElement) => void) =>
      html.querySelector<HTMLInputElement>(selector)?.addEventListener('change', (event) => {
        const input = event.target as HTMLInputElement
        apply(input.value, input)
      })
    bind('[name="quantity"]', (value) => (this.quantity = Math.max(1, Math.floor(Number(value) || 1))))
    bind('[name="consume"]', (_value, input) => (this.consume = input.checked))
    bind('[name="salvage"]', (value) => (this.salvage = value as Decision['salvage']))
    bind('[name="saveRecipe"]', (_value, input) => (this.saveRecipe = input.checked))
    bind('[name="note"]', (value) => (this.note = value))
    bind('[name="checkSkill"]', (value) => (this.checkSkill = value))
    bind('[name="checkDc"]', (value) => (this.checkDc = Math.floor(Number(value) || 0)))
    bind('[name="checkBonus"]', (value) => (this.checkBonus = Math.floor(Number(value) || 0)))
    const zone = html.querySelector<HTMLElement>('[data-other-drop]')
    zone?.addEventListener('dragover', (event) => event.preventDefault())
    zone?.addEventListener('drop', async (event) => {
      event.preventDefault()
      const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event)
      if (data?.type !== 'Item') return
      const item: any = await (Item.implementation as any).fromDropData(data)
      if (!item) return
      this.otherUuid = item.uuid
      this.outcome = 'other'
      this.render()
    })
  }

  static #onOutcome(this: ExperimentReview, _event: Event, target: HTMLElement) {
    this.outcome = target.dataset.outcome as any
    this.render()
  }

  /** Make an editable world copy of what the player wants and open it; granting uses the copy. */
  static async #onEditCopy(this: ExperimentReview) {
    const flags = this.message.flags.crawlspace
    const item: any = await itemFromWish(flags.desired)
    this.editedUuid = item.uuid
    this.outcome = 'edit'
    item.sheet.render(true)
    this.render()
  }

  static async #onOpenItem(this: ExperimentReview, _event: Event, target: HTMLElement) {
    const doc: any = await fromUuid(target.dataset.uuid ?? '')
    doc?.sheet?.render(true)
  }

  static #onClearOther(this: ExperimentReview) {
    this.otherUuid = ''
    this.render()
  }

  /** Roll a check for the crawler (the GM sets the skill and Difficulty) before deciding. */
  static async #onRoll(this: ExperimentReview) {
    const flags = this.message.flags.crawlspace
    const actor: any = await fromUuid(flags.actorUuid)
    if (!actor) return
    const skill = actor.items.find((item: any) => (item.type === 'skill' || item.type === 'spell') && item.name === this.checkSkill)
    const modifiers = [...(skill ? skill.checkModifiers() : []), ...(this.checkBonus ? [{ label: t('TableBonusPlain'), value: this.checkBonus }] : [])]
    const result = await rollCheck(actor, { label: t('ExperimentCheck', { name: flags.desired.name }), kind: 'check', modifiers, sources: skill ? [skill.name] : [], difficulty: this.checkDc, fast: true })
    if (!result) return
    const labels: Record<string, string> = { 'Crit miss': 'Critical Fail', 'Major miss': 'Major Fail', Miss: 'Fail', Hit: 'Success', 'Amazing hit': 'Amazing Success', 'Critical hit': 'Critical Success' }
    this.lastRoll = { total: result.roll.total, outcome: labels[result.outcome as string] ?? String(result.outcome) }
    // A failed roll suggests failure, salvaged by how far it missed.
    if (['Crit miss', 'Major miss', 'Miss'].includes(String(result.outcome))) {
      this.outcome = 'fail'
      const missed = this.checkDc - result.roll.total
      this.salvage = result.outcome === 'Crit miss' || missed >= 10 ? 'none' : missed <= 2 ? 'all' : 'half'
    }
    this.render()
  }

  static async #onResolve(this: ExperimentReview) {
    const flags = this.message.flags.crawlspace
    const itemUuid = this.outcome === 'edit' ? this.editedUuid : this.outcome === 'other' ? this.otherUuid : flags.desired.uuid
    if (this.outcome === 'other' && !this.otherUuid) return ui.notifications.warn(t('DropOther'))
    if (this.outcome === 'edit' && !this.editedUuid) return ui.notifications.warn(t('EditFirst'))
    await resolveExperiment(this.message, {
      outcome: this.outcome === 'fail' ? 'fail' : this.outcome === 'other' ? 'other' : 'grant',
      itemUuid,
      quantity: this.quantity,
      consume: this.consume,
      salvage: this.salvage,
      saveRecipe: this.saveRecipe,
      note: this.note,
    })
    this.close()
  }
}
