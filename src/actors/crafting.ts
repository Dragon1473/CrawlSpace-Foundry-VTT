/**
 * Crafting on a crawler: finding recipes (on world and compendium items), checking what a crawler has, crafting
 * (roll, use up materials, salvage, make the item), GM approval cards, recipe books and table levels.
 * The rules themselves are in rules/crafting.ts.
 */
import {
  autoApproved,
  checkSkills,
  craftDifficulty,
  craftMinutes,
  formatMinutes,
  matchIngredients,
  normalizeRecipe,
  recipeKey,
  recipeState,
  salvageReturns,
  tableBonus,
  CRAFT_CATEGORIES,
  RARITIES,
  type CraftCategory,
  type CraftContext,
  type InventoryItem,
  type Recipe,
  type Take,
} from '../rules/crafting'
import { rollCheck } from '../dice/rolls'
import { spaceTables } from './personal-space'
import { boostedTables, markBoostUsed, markRerollUsed, spaceCraft } from './space-crafting'

export const RECIPES_FLAG = 'recipes'
export const TEACHES_FLAG = 'teaches'
/** Bench mixes the GM failed, on the crawler: { signature, name, img } (rules/crafting.ts benchSignature). */
export const FAILED_FLAG = 'failedExperiments'
export const LEARNED_FLAG = 'learnedRecipes'
export const HELD_FLAG = 'heldForCrafting'

const t = (key: string, data?: Record<string, unknown>) => (data ? game.i18n.format(`CRAWLSPACE.Craft.${key}`, data) : game.i18n.localize(`CRAWLSPACE.Craft.${key}`))
const esc = (value: unknown) => foundry.utils.escapeHTML(String(value ?? ''))
const slug = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export const PHYSICAL_TYPES = ['weapon', 'equipment', 'consumable', 'tattoo', 'loot', 'material', 'craftingTable']

/** The standard categories plus any the GM named in the settings. */
export function craftCategories(): CraftCategory[] {
  const extra = String(game.settings.get('crawlspace', 'craftCategories') ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .map((label) => ({ id: slug(label), label, icon: 'fa-solid fa-toolbox', skills: [] as string[] }))
    .filter((category) => category.id && !CRAFT_CATEGORIES.some((known) => known.id === category.id))
  return [...CRAFT_CATEGORIES, ...extra]
}

export const categoryOf = (id: string) => craftCategories().find((category) => category.id === id) ?? { id, label: id, icon: 'fa-solid fa-toolbox', skills: [] }

/** Where an owned item came from: the item a recipe or ingredient names. */
export function sourceOf(item: any): string {
  return item?._stats?.compendiumSource ?? item?._stats?.duplicateSource ?? item?.flags?.core?.sourceId ?? item?.flags?.crawlspace?.craftedFrom ?? ''
}

export const tagsOf = (system: any) => (Array.isArray(system?.tags) ? system.tags : String(system?.tags ?? '').split(',')).map((tag: string) => tag.trim()).filter(Boolean)

/** Quantities set aside for experiments the GM hasn't answered yet. */
function heldQuantities(actor: any) {
  const held = new Map<string, number>()
  for (const takes of Object.values<Take[]>(actor.getFlag('crawlspace', HELD_FLAG) ?? {}))
    for (const take of takes ?? []) held.set(take.id, (held.get(take.id) ?? 0) + (Number(take.quantity) || 0))
  return held
}

/**
 * The crafting tables a crawler can use: the tables they carry, plus the tables of the Personal Space they are in
 * right now (actors/personal-space.ts; none outside a space or with Personal Spaces off).
 */
export function availableTables(actor: any) {
  const own = actor.items
    .filter((item: any) => item.type === 'craftingTable' && !item.system.broken && (Number(item.system.quantity) || 0) > 0)
    .map((item: any) => ({ id: item.id, name: item.name, category: item.system.category, tier: Math.floor(Number(item.system.tier) || 1), upgrades: item.system.upgrades ?? [] }))
  return [...own, ...spaceTables(actor), ...foundTables(actor)]
}

/** How close a crawler's token must be to a table found in the dungeon to use it. */
const FOUND_REACH_FT = 10

/**
 * Tables found in the dungeon: a token on the crawler's scene (not a crawler or a Personal Space) whose actor carries
 * crafting tables, within reach of one of the crawler's tokens. They count for crafting (requirements and the table
 * bonus) and experiments, never for unlocking recipes: craftContext leaves them out.
 */
export function foundTables(actor: any) {
  const scene = canvas?.scene
  if (!scene || actor?.type !== 'crawler') return []
  const mine = actor.getActiveTokens?.(false, true) ?? []
  const here = mine.filter((token: any) => token.parent === scene)
  if (!here.length) return []
  const tables: any[] = []
  for (const token of scene.tokens) {
    const holder = token.actor
    if (!holder || holder === actor || ['crawler', 'personalSpace'].includes(holder.type)) continue
    const items = holder.items.filter((item: any) => item.type === 'craftingTable' && !item.system.broken && (Number(item.system.quantity) || 0) > 0)
    if (!items.length) continue
    const near = here.some((own: any) => {
      try {
        return canvas.grid.measurePath([own.object?.center ?? own, token.object?.center ?? token]).distance <= FOUND_REACH_FT + Math.max(0, (Math.max(token.width, token.height) - 1) * canvas.grid.distance)
      } catch {
        return false
      }
    })
    if (!near) continue
    for (const item of items)
      tables.push({ id: `found-${token.id}-${item.id}`, name: item.name, category: item.system.category, tier: Math.floor(Number(item.system.tier) || 1), upgrades: item.system.upgrades ?? [], found: true, where: token.name })
  }
  return tables
}

export function craftContext(actor: any): CraftContext {
  const held = heldQuantities(actor)
  const items: InventoryItem[] = actor.items
    .filter((item: any) => PHYSICAL_TYPES.includes(item.type))
    .map((item: any) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      uuid: item.uuid,
      sourceId: sourceOf(item),
      quantity: Math.max(0, (Number(item.system.quantity) || 0) - (held.get(item.id) ?? 0)),
      tags: tagsOf(item.system),
      rarity: item.system.rarity,
      liquid: !!item.system.liquid,
      table: item.type === 'craftingTable' ? { category: item.system.category, tier: Math.floor(Number(item.system.tier) || 1), upgrades: item.system.upgrades ?? [] } : undefined,
    }))
  // The tables of the Personal Space the crawler is in count for 'table' unlocks, but never as stock (quantity 0).
  for (const table of spaceTables(actor))
    items.push({ id: `space-${table.space}-${table.id}`, name: table.name, type: 'craftingTable', quantity: 0, table: { category: table.category, tier: table.tier, upgrades: table.upgrades } })
  const skills = new Map<string, number>()
  for (const item of actor.items)
    if (item.type === 'skill' || item.type === 'spell') {
      const name = item.name.trim().toLowerCase()
      skills.set(name, Math.max(skills.get(name) ?? 0, Math.floor(Number(item.system.rank?.total) || 0)))
    }
  return {
    learned: new Set<string>(actor.getFlag('crawlspace', LEARNED_FLAG) ?? []),
    items,
    skills,
    level: Math.floor(Number(actor.system.details?.level) || 0),
    floor: Math.floor(Number(actor.system.details?.floor) || 0),
  }
}

export type RecipeEntry = {
  key: string
  itemUuid: string
  recipe: Recipe
  output: { name: string; img: string; type: string; tags: string[]; rarity: string; uuid: string }
}

/** Every recipe: those on world items, then those on items in the compendiums this user can see. */
export async function gatherRecipes(): Promise<RecipeEntry[]> {
  const entries: RecipeEntry[] = []
  const add = (uuid: string, doc: any) => {
    const raw = doc?.flags?.crawlspace?.[RECIPES_FLAG]
    if (!Array.isArray(raw)) return
    for (const stored of raw) {
      const recipe = normalizeRecipe(stored)
      entries.push({
        key: recipeKey(uuid, recipe.id),
        itemUuid: uuid,
        recipe,
        output: { name: doc.name, img: doc.img, type: doc.type, tags: tagsOf(doc.system), rarity: String(doc.system?.rarity ?? ''), uuid },
      })
    }
  }
  for (const item of game.items) add(item.uuid, item)
  for (const pack of game.packs) {
    if (pack.documentName !== 'Item' || !pack.visible) continue
    const index = await pack.getIndex({ fields: [`flags.crawlspace.${RECIPES_FLAG}`, 'system.tags', 'system.rarity'] })
    for (const entry of index) add(entry.uuid ?? `Compendium.${pack.collection}.Item.${entry._id}`, entry)
  }
  return entries
}

export async function findRecipe(itemUuid: string, recipeId: string): Promise<RecipeEntry | null> {
  const doc: any = await fromUuid(itemUuid)
  const raw = (doc?.getFlag?.('crawlspace', RECIPES_FLAG) ?? []).find((recipe: any) => recipe?.id === recipeId)
  if (!doc || !raw) return null
  const recipe = normalizeRecipe(raw)
  return {
    key: recipeKey(itemUuid, recipe.id),
    itemUuid,
    recipe,
    output: { name: doc.name, img: doc.img, type: doc.type, tags: tagsOf(doc.system), rarity: String(doc.system?.rarity ?? ''), uuid: itemUuid },
  }
}

export function approvalMode() {
  return String(game.settings.get('crawlspace', 'craftApproval') ?? 'gm')
}

/** Everything the window shows about one recipe for one crawler. */
export function evaluateRecipe(actor: any, entry: RecipeEntry, count = 1, ctx = craftContext(actor)) {
  const recipe = entry.recipe
  const state = recipeState(recipe, entry.key, ctx, game.user.isGM)
  const skills = checkSkills(recipe.skills, ctx.skills)
  const batch = recipe.batch ? Math.max(1, Math.floor(count)) : 1
  // Personal Space upgrades (actors/space-crafting.ts): faster tables, and once a day space tables a tier higher.
  const space = spaceCraft(actor, recipe, batch)
  const plain = tableBonus(recipe.tables, availableTables(actor))
  const raised = space?.boost ? tableBonus(recipe.tables, boostedTables(availableTables(actor), space.boost)) : null
  const boosted = !!raised && raised.ok && (!plain.ok || raised.bonus > plain.bonus)
  const tables = boosted ? raised! : plain
  const minutes = space ? space.minutes : craftMinutes(recipe, batch)
  const ingredients = matchIngredients(recipe.ingredients, ctx.items, batch)
  const tools = recipe.tools.map((tool) => {
    const name = tool.name.trim().toLowerCase()
    const have =
      tool.kind === 'skill' || tool.kind === 'spell'
        ? ctx.skills.has(name)
        : ctx.items.some((item) => (tool.uuid && (item.sourceId === tool.uuid || item.uuid === tool.uuid)) || item.name.trim().toLowerCase() === name)
    return { ...tool, ok: have }
  })
  const materialsOk = ingredients.every((row) => row.ok)
  const ready = state.unlocked && skills.ok && tables.ok && materialsOk && tools.every((tool) => tool.ok)
  return {
    state,
    skills,
    tables,
    ingredients,
    tools,
    batch,
    difficulty: craftDifficulty(recipe),
    minutes,
    time: formatMinutes(minutes),
    space,
    boosted,
    materialsOk,
    ready,
    auto: autoApproved(approvalMode(), game.settings.get('crawlspace', 'craftAutoRules') ?? {}, entry.output, recipe.approval),
  }
}

/** The crawler's skill item to roll, falling back to the category's usual skills. */
function rollSkill(actor: any, recipe: Recipe, best: string | null) {
  const names = [best, ...categoryOf(recipe.category).skills].filter(Boolean).map((name) => String(name).toLowerCase())
  for (const name of names) {
    const item = actor.items.find((entry: any) => (entry.type === 'skill' || entry.type === 'spell') && entry.name.toLowerCase() === name)
    if (item) return item
  }
  return null
}

/** Craft from a recipe: through the GM when the setting or recipe says so, otherwise right away. */
export async function requestCraft(actor: any, entry: RecipeEntry, count = 1) {
  const check = evaluateRecipe(actor, entry, count)
  if (!check.ready) return ui.notifications.warn(t('NotReady'))
  if (check.auto || game.user.isGM) return performCraft(actor, entry.itemUuid, entry.recipe.id, count)
  if (!game.users.activeGM) return ui.notifications.warn(game.i18n.localize('CRAWLSPACE.Warn.NeedGM'))
  const content = `<div class="crawl-card craft-card craft-request">
    <h4 class="card-title"><i class="fa-solid fa-hammer"></i> ${t('RequestTitle', { actor: esc(actor.name) })}</h4>
    <div class="craft-card-output"><img src="${esc(entry.output.img)}" alt=""><span>${esc(entry.output.name)}${check.batch > 1 ? ` ×${check.batch * entry.recipe.output.quantity}` : ''}</span></div>
    <p class="craft-card-meta">${esc(categoryOf(entry.recipe.category).label)} · ${t('DifficultyShort', { dc: check.difficulty })} · ${esc(check.time)}</p>
    <div class="card-buttons" data-gm-only>
      <button type="button" data-crawl-action="craft-approve"><i class="fa-solid fa-check"></i> ${t('Approve')}</button>
      <button type="button" data-crawl-action="craft-decline"><i class="fa-solid fa-xmark"></i> ${t('Decline')}</button>
    </div>
  </div>`
  await ChatMessage.create({
    content,
    speaker: ChatMessage.getSpeaker({ actor }),
    whisper: game.users.filter((user: any) => user.isGM).map((user: any) => user.id),
    flags: { crawlspace: { kind: 'craftRequest', actorUuid: actor.uuid, itemUuid: entry.itemUuid, recipeId: entry.recipe.id, count } },
  })
  ui.notifications.info(t('Requested'))
}

/** The GM answers a craft request. The asking player crafts on their own client (they roll); offline, the GM does. */
export async function answerCraftRequest(message: any, approve: boolean) {
  const flags = message.flags?.crawlspace
  if (!game.user.isGM || flags?.kind !== 'craftRequest' || flags.answered) return
  const author = message.author ?? game.users.get(message.user)
  const runner = approve && author?.active && !author.isGM ? author.id : game.user.id
  await message.update({ 'flags.crawlspace.answered': approve ? 'approved' : 'declined', 'flags.crawlspace.runner': runner })
  if (!approve) {
    if (author) await ChatMessage.create({ content: `<p>${t('Declined')}</p>`, whisper: [author.id] })
    return
  }
  if (runner === game.user.id) {
    const actor = await fromUuid(flags.actorUuid)
    if (actor) await performCraft(actor, flags.itemUuid, flags.recipeId, flags.count, { fast: true })
  }
}

/** A player whose request was approved crafts it now (registerCrafting). */
async function onRequestAnswered(message: any, changes: any) {
  const answered = changes?.flags?.crawlspace?.answered
  const flags = message.flags?.crawlspace
  if (answered !== 'approved' || flags?.kind !== 'craftRequest' || flags.runner !== game.user.id || game.user.isGM) return
  const actor = await fromUuid(flags.actorUuid)
  if (actor?.isOwner) await performCraft(actor, flags.itemUuid, flags.recipeId, flags.count)
}

/** Take quantities off owned items; materials that run out leave the inventory. */
export async function spendTakes(actor: any, takes: { id: string; quantity: number }[]) {
  const totals = new Map<string, number>()
  for (const take of takes) totals.set(take.id, (totals.get(take.id) ?? 0) + Math.floor(take.quantity))
  const updates: any[] = []
  const deletes: string[] = []
  for (const [id, quantity] of totals) {
    const item = actor.items.get(id)
    if (!item || quantity <= 0) continue
    const left = Math.max(0, (Number(item.system.quantity) || 0) - quantity)
    if (left === 0 && item.type === 'material') deletes.push(id)
    else updates.push({ _id: id, 'system.quantity': left })
  }
  if (updates.length) await actor.updateEmbeddedDocuments('Item', updates)
  if (deletes.length) await actor.deleteEmbeddedDocuments('Item', deletes)
}

/** Put an item on a crawler, adding to a matching stack when there is one. */
export async function giveItem(actor: any, data: any, quantity: number, craftedFrom = '') {
  const source = foundry.utils.deepClone(data)
  delete source._id
  if (source.flags?.crawlspace) {
    delete source.flags.crawlspace[RECIPES_FLAG]
    delete source.flags.crawlspace[TEACHES_FLAG]
  }
  if (craftedFrom) foundry.utils.setProperty(source, 'flags.crawlspace.craftedFrom', craftedFrom)
  const physical = PHYSICAL_TYPES.includes(source.type)
  const stack = physical
    ? actor.items.find((item: any) => item.type === source.type && item.name === source.name && (!craftedFrom || sourceOf(item) === craftedFrom || item.flags?.crawlspace?.craftedFrom === craftedFrom))
    : null
  if (stack) return stack.update({ 'system.quantity': (Number(stack.system.quantity) || 0) + quantity })
  if (physical) foundry.utils.setProperty(source, 'system.quantity', quantity)
  return (await actor.createEmbeddedDocuments('Item', [source]))[0]
}

/**
 * Craft from a recipe: roll the check (skill + lowest table tier), use up the materials either way, make the item
 * on a success, and give back what a failure salvages.
 */
export async function performCraft(actor: any, itemUuid: string, recipeId: string, count = 1, options: { fast?: boolean } = {}) {
  const entry = await findRecipe(itemUuid, recipeId)
  if (!entry) return ui.notifications.warn(t('RecipeGone'))
  const check = evaluateRecipe(actor, entry, count)
  if (!check.ready) return ui.notifications.warn(t('NotReady'))
  const recipe = entry.recipe
  const skill = rollSkill(actor, recipe, check.skills.roll)
  const tableNames = recipe.tables.map((need) => categoryOf(need.category).label).join(', ')
  const modifiers = [
    ...(skill ? skill.checkModifiers() : []),
    ...(check.tables.bonus ? [{ label: t('TableBonus', { tables: tableNames }), value: check.tables.bonus }] : []),
  ]
  const rollOptions = {
    label: t('CheckLabel', { name: entry.output.name }),
    kind: 'check' as const,
    modifiers,
    sources: skill ? [skill.name] : [],
    difficulty: check.difficulty,
    advantage: recipe.advantage,
    fast: options.fast,
    flags: { craft: { itemUuid, recipeId } },
  }
  let result = await rollCheck(actor, rollOptions)
  if (!result) return null
  const spaceLines: string[] = []
  if (check.boosted && check.space) {
    await markBoostUsed(actor)
    spaceLines.push(game.i18n.format('CRAWLSPACE.Space.CraftBoosted', { list: esc(check.space.boostSources.join(', ')) }))
  }
  if (check.space?.timeSources.length) spaceLines.push(game.i18n.format('CRAWLSPACE.Space.CraftFaster', { list: esc(check.space.timeSources.join(', ')), time: esc(check.time) }))
  const won = (outcome: string | null) => outcome === 'Hit' || outcome === 'Amazing hit' || outcome === 'Critical hit'
  // A space attachment rerolls a failed check once per floor; the new roll stands.
  if (!won(result.outcome) && check.space?.reroll) {
    await markRerollUsed(actor, check.space.reroll)
    spaceLines.push(game.i18n.format('CRAWLSPACE.Space.CraftRerolled', { name: esc(check.space.reroll.name) }))
    const again = await rollCheck(actor, rollOptions)
    if (again) result = again
  }
  const { roll, outcome } = result
  const success = won(outcome)
  const takes = check.ingredients.flatMap((row) => row.takes)
  const missedBy = Math.floor(check.difficulty - roll.total)
  const returns = success ? [] : salvageReturns(missedBy, takes, recipe.method)
  // Net use: what a failure salvages never leaves the inventory.
  const back = new Map(returns.map((entry) => [entry.id, entry.quantity]))
  await spendTakes(actor, takes.map((take) => ({ id: take.id, quantity: Math.max(0, take.quantity - (back.get(take.id) ?? 0)) })))
  const made = recipe.output.quantity * check.batch
  if (success) {
    const source: any = await fromUuid(itemUuid)
    if (source) await giveItem(actor, source.toObject(), made, itemUuid)
  }
  const lines: string[] = []
  if (success) lines.push(t('Made', { quantity: made, name: esc(entry.output.name) }))
  else if (outcome === 'Crit miss') lines.push(t('CritFail'))
  else lines.push(t('Failed', { missed: missedBy }))
  if (!success && recipe.method !== 'quick') lines.push(returns.length ? t('Salvaged', { list: returns.map((r) => `${esc(actor.items.get(r.id)?.name ?? '')} ×${r.quantity}`).join(', ') }) : t('NothingSalvaged'))
  if (!success && recipe.method === 'quick') lines.push(t('NoSalvageMix'))
  lines.push(t('TimeTaken', { time: esc(check.time) }))
  lines.push(...spaceLines)
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="crawl-card craft-card ${success ? 'craft-success' : 'craft-fail'}">
      <div class="craft-card-output"><img src="${esc(entry.output.img)}" alt=""><span>${esc(entry.output.name)}</span></div>
      ${lines.map((line) => `<p>${line}</p>`).join('')}
    </div>`,
    flags: { crawlspace: { kind: 'craftResult' } },
  })
  return { success, outcome }
}

/** Add recipes to what a crawler knows. */
export async function learnRecipes(actor: any, keys: string[]) {
  const known = new Set<string>(actor.getFlag('crawlspace', LEARNED_FLAG) ?? [])
  const fresh = keys.filter((key) => !known.has(key))
  if (!fresh.length) return 0
  await actor.setFlag('crawlspace', LEARNED_FLAG, [...known, ...fresh])
  return fresh.length
}

export async function forgetRecipe(actor: any, key: string) {
  const known: string[] = actor.getFlag('crawlspace', LEARNED_FLAG) ?? []
  await actor.setFlag('crawlspace', LEARNED_FLAG, known.filter((entry) => entry !== key))
}

/** Read a recipe book or blueprint the crawler owns: it learns every recipe the book teaches. */
export async function studyBook(actor: any, item: any) {
  const keys: string[] = item.getFlag('crawlspace', TEACHES_FLAG) ?? []
  const added = await learnRecipes(actor, keys)
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="crawl-card craft-card"><p><i class="fa-solid fa-book-open"></i> ${added ? t('Studied', { name: esc(item.name), count: added }) : t('StudiedNothing', { name: esc(item.name) })}</p></div>`,
  })
}

/** Tables level up by one when their owner reaches a new floor (only the client that changed the floor does it). */
function onActorUpdate(actor: any, changes: any, _options: any, userId: string) {
  if (userId !== game.user.id || actor.type !== 'crawler') return
  const floor = foundry.utils.getProperty(changes, 'system.details.floor')
  if (floor === undefined) return
  const previous = Math.floor(Number(actor.getFlag('crawlspace', 'tableFloor')) || 0)
  const now = Math.floor(Number(floor) || 0)
  if (!previous || now <= previous) {
    if (now !== previous) actor.setFlag('crawlspace', 'tableFloor', now)
    return
  }
  const updates = actor.items
    .filter((item: any) => item.type === 'craftingTable' && item.system.autoLevel)
    .map((item: any) => ({ _id: item.id, 'system.tier': Math.min(10, Math.floor(Number(item.system.tier) || 1) + (now - previous)) }))
  if (updates.length) actor.updateEmbeddedDocuments('Item', updates)
  actor.setFlag('crawlspace', 'tableFloor', now)
}

/** A crawler's first table remembers the floor it was gained on, so later floors level it. */
function onItemCreate(item: any, _options: any, userId: string) {
  const actor = item.parent
  if (userId !== game.user.id || item.type !== 'craftingTable' || actor?.type !== 'crawler' || actor.getFlag('crawlspace', 'tableFloor')) return
  actor.setFlag('crawlspace', 'tableFloor', Math.floor(Number(actor.system.details?.floor) || 1))
}

export function registerCrafting() {
  Hooks.on('updateChatMessage', (message: any, changes: any) => {
    onRequestAnswered(message, changes).catch((error) => console.error('CrawlSpace | crafting', error))
  })
  Hooks.on('updateActor', onActorUpdate)
  Hooks.on('createItem', onItemCreate)
}

const ITEM_TYPE_CHOICES = ['weapon', 'equipment', 'consumable', 'tattoo', 'loot', 'material', 'craftingTable', 'skill', 'spell', 'ability']

/** The GM's auto-approve rules: crafts of these item types, tags or rarities skip the GM in "mixed" mode. */
export async function editApprovalRules() {
  const rules: any = game.settings.get('crawlspace', 'craftAutoRules') ?? {}
  const types = new Set((rules.types ?? []).map((type: string) => type.toLowerCase()))
  const rarities = new Set((rules.rarities ?? []).map((rarity: string) => rarity.toLowerCase()))
  const box = (name: string, value: string, label: string, on: boolean) =>
    `<label class="check"><input type="checkbox" name="${name}" value="${value}" ${on ? 'checked' : ''}> ${esc(label)}</label>`
  const content = `<div class="crawl-craft-rules">
    <p class="hint">${t('RulesHint')}</p>
    <fieldset><legend>${t('RulesTypes')}</legend><div class="check-grid">${ITEM_TYPE_CHOICES.map((type) => box('types', type, game.i18n.localize(`TYPES.Item.${type}`), types.has(type.toLowerCase()))).join('')}</div></fieldset>
    <fieldset><legend>${t('RulesRarities')}</legend><div class="check-grid">${RARITIES.map((rarity) => box('rarities', rarity, t(`Rarity.${rarity}`), rarities.has(rarity))).join('')}</div></fieldset>
    <label>${t('RulesTags')}<input type="text" name="tags" value="${esc((rules.tags ?? []).join(', '))}" placeholder="${t('RulesTagsPlaceholder')}"></label>
  </div>`
  const result = await foundry.applications.api.DialogV2.prompt({
    window: { title: t('RulesTitle'), icon: 'fa-solid fa-scale-balanced' },
    content,
    ok: {
      label: game.i18n.localize('CRAWLSPACE.Craft.Save'),
      callback: (_event: any, button: any) => {
        const form = button.form as HTMLFormElement
        const checked = (name: string) => [...form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)].map((input) => input.value)
        const tags = String((form.elements.namedItem('tags') as HTMLInputElement)?.value ?? '').split(',').map((tag) => tag.trim()).filter(Boolean)
        return { types: checked('types'), rarities: checked('rarities'), tags }
      },
    },
    rejectClose: false,
  })
  if (result) await game.settings.set('crawlspace', 'craftAutoRules', result)
}

/** A settings-menu entry that only opens the rules dialog. */
class ApprovalRulesMenu extends foundry.applications.api.ApplicationV2 {
  async render() {
    editApprovalRules()
    return this
  }
}

export function registerCraftSettings() {
  game.settings.register('crawlspace', 'craftApproval', {
    name: 'CRAWLSPACE.Settings.CraftApproval.Name',
    hint: 'CRAWLSPACE.Settings.CraftApproval.Hint',
    scope: 'world',
    config: true,
    type: String,
    choices: {
      gm: 'CRAWLSPACE.Settings.CraftApproval.gm',
      auto: 'CRAWLSPACE.Settings.CraftApproval.auto',
      mixed: 'CRAWLSPACE.Settings.CraftApproval.mixed',
    },
    default: 'gm',
  })
  game.settings.register('crawlspace', 'craftAutoRules', { scope: 'world', config: false, type: Object, default: { types: [], tags: [], rarities: [] } })
  game.settings.registerMenu('crawlspace', 'craftRules', {
    name: 'CRAWLSPACE.Settings.CraftRules.Name',
    label: 'CRAWLSPACE.Settings.CraftRules.Label',
    hint: 'CRAWLSPACE.Settings.CraftRules.Hint',
    icon: 'fa-solid fa-scale-balanced',
    type: ApprovalRulesMenu,
    restricted: true,
  })
  game.settings.register('crawlspace', 'craftCategories', {
    name: 'CRAWLSPACE.Settings.CraftCategories.Name',
    hint: 'CRAWLSPACE.Settings.CraftCategories.Hint',
    scope: 'world',
    config: true,
    type: String,
    default: '',
  })
}
