import { clearKillingBlows } from '../effects/killing-blows'
import { rankCap } from '../effects/rank-cap'
import { advancementModifiers } from '../rules/build-links'
import { upkeepAction } from '../socket'
import { openGrinding } from './grinding'
import { openAwards } from './awards'
import { openAutoLoot, openItemGenerator } from './loot-tools'
import { openLootBoxes } from '../loot/boxes'
import { advanceTime, expireActorEvent, settleTime } from '../time'
import { startRegenCollect, stopRegenCollect } from '../effects/regen-collector'
import { recoveryRow } from '../rules/upkeep-summary'
import { restSeconds } from '../rules/time'
import { afterSpaceRest, restSecondsFor } from '../actors/personal-space'
import { inParty, otherParties, partyCrawlers, playerPartyLabel } from '../actors/party'
import { PLAYERS, rosterGroups, toggleGroup } from '../rules/upkeep-roster'
import { STATS, STAT_KEYS } from '../config'
import { debuffByName } from '../rules/debuffs'
import { advancementCheck, advances, canAssignStats, pendingStatPoints, recoverCrawler, type AdvancementKind, type RecoveryKind } from '../rules/upkeep'

async function report(actor: any, title: string, lines: string[]) {
  const content = `<div class="crawlspace chat-card upkeep-card"><h3>${title}</h3><ul>${lines.map((line) => `<li>${line}</li>`).join('')}</ul></div>`
  await ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor }) })
}

export async function rest(actor: any, kind: RecoveryKind, hours = 1, options: { advance?: boolean } = {}) {
  if (!game.user.isGM) return upkeepAction([actor.uuid], kind, hours)
  return restParty([actor], kind, hours, options)
}

const pools = (actor: any) => ({ health: Number(actor.system.health.value) || 0, mana: Number(actor.system.mana.value) || 0 })

/**
 * A rest or hourly recovery for several crawlers, with one chat card for all of them. The time passes first
 * (unless `advance` is false), and the regeneration buffs that heal over it (You are full!, Replenish) are
 * counted on the card as their own bonus.
 */
export async function restParty(actors: any[], kind: RecoveryKind, hours = 1, options: { advance?: boolean } = {}) {
  if (!game.user.isGM || !actors.length) return
  const before = new Map(actors.map((actor) => [actor.uuid, pools(actor)]))
  startRegenCollect()
  let regen: Map<string, string[]>
  try {
    // A Long Rest in a Personal Space with a better bed is shorter (actors/personal-space.ts).
    const seconds = restSecondsFor(actors, kind, hours, restSeconds)
    if (options.advance !== false && seconds > 0) await advanceTime(seconds)
    else await settleTime()
  } finally {
    regen = stopRegenCollect()
  }
  const rows: string[] = []
  for (const actor of actors) {
    const afterRegen = pools(actor)
    const cleared = await recover(actor, kind, hours)
    const row = recoveryRow(before.get(actor.uuid)!, afterRegen, pools(actor), { sources: regen.get(actor.uuid) })
    const esc = foundry.utils.escapeHTML
    const parts = [game.i18n.format('CRAWLSPACE.Upkeep.Restored', { slots: row.slots, mana: row.mana })]
    if (row.bonusFrom.length)
      parts.push(game.i18n.format('CRAWLSPACE.Upkeep.BonusFrom', { slots: row.bonusSlots, mana: row.bonusMana, list: esc(row.bonusFrom.join(', ')) }))
    if (cleared.length) parts.push(game.i18n.format('CRAWLSPACE.Upkeep.Cleared', { list: esc(cleared.join(', ')) }))
    for (const line of await afterSpaceRest(actor, kind)) parts.push(esc(line))
    rows.push(`<b>${esc(actor.name)}</b>: ${parts.join(' ')}`)
  }
  const title = game.i18n.localize(`CRAWLSPACE.Upkeep.${kind}`) + (kind === 'hourly' ? ` (${game.i18n.format('CRAWLSPACE.Upkeep.HoursSpent', { hours })})` : '')
  const content = `<div class="crawlspace chat-card upkeep-card"><h3>${title}</h3><ul>${rows.map((row) => `<li>${row}</li>`).join('')}</ul></div>`
  await ChatMessage.create({ content, speaker: actors.length === 1 ? ChatMessage.getSpeaker({ actor: actors[0] }) : { alias: game.i18n.localize('CRAWLSPACE.Upkeep.Party') } })
}

/** One crawler's recovery: health, mana and the debuffs it clears. Returns the names of those cleared. */
async function recover(actor: any, kind: RecoveryKind, hours: number) {
  const before = { health: actor.system.health.value, mana: actor.system.mana.value }
  const system = actor.system
  const result = recoverCrawler(kind, system.health.value, system.mana.value, system.mana.max, hours)
  await actor.update({ 'system.health.value': result.health, 'system.mana.value': result.mana, 'system.health.dyingCountdown': null })
  const removed: string[] = []
  for (const name of result.cleared) {
    const debuff = debuffByName(name)
    if (!debuff) continue
    const effects = actor.effects.filter((effect: any) => effect.statuses.has(debuff.id))
    if (effects.length) {
      removed.push(name)
      await actor.deleteEmbeddedDocuments('ActiveEffect', effects.map((effect: any) => effect.id))
    }
  }
  if (kind === 'short') await expireActorEvent('shortRest', [actor])
  if (kind === 'full') await expireActorEvent('fullRest', [actor])
  if (kind === 'long' || kind === 'full') {
    await expireActorEvent('longRest', [actor])
    await clearKillingBlows(actor, 'longRest')
  }
  if (result.health > before.health) await expireActorEvent('healed', [actor])
  return removed
}

/** Roll a d20 for each marked skill/spell; meeting its rank advances it (abilityAdvancement.ts). */
export async function advanceMarked(actor: any, kind: AdvancementKind) {
  if (!game.user.isGM) return upkeepAction([actor.uuid], kind)
  const floor = Number(actor.system.details.floor) || 1
  const lines: string[] = []
  const updates: any[] = []
  const untrained = actor.items.filter((item: any) => item.type === 'skill' && item.system.rank.base === 0)
  const candidates = floor <= 3 ? untrained.filter((item: any) => item.system.marked && item.name.trim()) : []
  if (candidates.length) {
    const chosen = candidates.length === 1 ? candidates[0].id : await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize('CRAWLSPACE.Upkeep.Untrained') }, classes: ['crawlspace'], rejectClose: false,
      content: `<p>${game.i18n.localize('CRAWLSPACE.Upkeep.UntrainedHint')}</p><select name="skill">${candidates.map((item: any) => `<option value="${item.id}">${foundry.utils.escapeHTML(item.name)}</option>`).join('')}</select>`,
      ok: { callback: (_event: Event, button: any) => button.form.elements.skill.value },
    })
    if (!chosen) return
    await actor.updateEmbeddedDocuments('Item', [{ _id: chosen, 'system.rank.value': 1, 'system.marked': false }])
    const removed = untrained.filter((item: any) => item.id !== chosen).map((item: any) => item.id)
    if (removed.length) await actor.deleteEmbeddedDocuments('Item', removed)
    lines.push(game.i18n.format('CRAWLSPACE.Upkeep.Learned', { name: actor.items.get(chosen).name }))
  }
  const buildItems = actor.items.filter((item: any) => item.type === 'race' || item.type === 'class')
  for (const item of actor.items) {
    if (!['skill', 'spell'].includes(item.type) || !item.system.marked) continue
    const rank = Number(item.system.rank.base) || 0
    if (item.type === 'skill' && rank === 0) continue
    const { eligible: allowed } = advancementCheck(rank, kind, floor, rankCap(actor, item.name) === 20)
    const eligible = allowed && rank < rankCap(actor, item.name)
    if (!eligible) {
      if (kind === 'floor' || rank <= 4) {
        lines.push(game.i18n.format('CRAWLSPACE.Upkeep.Capped', { name: item.name, rank }))
        updates.push({ _id: item.id, 'system.marked': false })
      }
      continue
    }
    // Race and class benefits can add to the check, give it Advantage, or (detriments) take from it (build-links.ts).
    const modifiers = advancementModifiers(buildItems, item.name, kind, rank)
    const formula = `${modifiers.advantage ? '2d20kh' : '1d20'}${modifiers.bonus ? (modifiers.bonus > 0 ? ` + ${modifiers.bonus}` : ` - ${-modifiers.bonus}`) : ''}`
    const roll = await Roll.create(formula).evaluate()
    const advanced = advances(roll.total, rank)
    lines.push(game.i18n.format(advanced ? 'CRAWLSPACE.Upkeep.Advanced' : 'CRAWLSPACE.Upkeep.NotAdvanced', { name: item.name, roll: roll.total, rank, next: rank + 1 }))
    if (modifiers.sources.length) lines.push(game.i18n.format('CRAWLSPACE.Upkeep.AdvanceModifiers', { formula, sources: modifiers.sources.join(', ') }))
    updates.push({ _id: item.id, 'system.marked': false, ...(advanced ? { 'system.rank.value': item.system.rank.value + 1 } : {}) })
  }
  if (updates.length) await actor.updateEmbeddedDocuments('Item', updates)
  if (kind === 'safeRoom') await expireActorEvent('safeRoom', [actor])
  if (kind === 'floor') {
    await expireActorEvent('leaveFloor', [actor])
    await clearKillingBlows(actor, 'leaveFloor')
    await actor.update({ 'system.details.floor': floor + 1 })
    lines.push(game.i18n.format('CRAWLSPACE.Upkeep.FloorAdvanced', { floor: floor + 1 }))
  }
  if (kind === 'safeRoom') await actor.update({ 'system.upkeep.lastSafeRoomLevel': actor.system.details.level })
  if (kind === 'safeRoom' && actor.items.some((item: any) => item.type === 'lootBox' && item.system.sealed)) await openLootBoxes(actor)
  await report(actor, game.i18n.localize(`CRAWLSPACE.Upkeep.${kind}`), lines.length ? lines : [game.i18n.localize('CRAWLSPACE.Upkeep.NothingMarked')])
}

export async function levelUp(actor: any) {
  if (!game.user.isGM) return upkeepAction([actor.uuid], 'level')
  const level = (Number(actor.system.details.level) || 1) + 1
  await actor.update({ 'system.details.level': level })
  const pending = pendingStatPoints(level, actor.system.upkeep.allocatedThroughLevel)
  await report(actor, game.i18n.format('CRAWLSPACE.Upkeep.Level', { level }), [game.i18n.format('CRAWLSPACE.Upkeep.PointsWaiting', { points: pending })])
}

export async function assignStats(actor: any) {
  const system = actor.system
  const points = pendingStatPoints(system.details.level, system.upkeep.allocatedThroughLevel)
  if (!points) return ui.notifications.info(game.i18n.localize('CRAWLSPACE.Upkeep.NoPoints'))
  if (!canAssignStats(system.details.floor)) return ui.notifications.warn(game.i18n.localize('CRAWLSPACE.Upkeep.FloorThree'))
  const content = `<p>${game.i18n.format('CRAWLSPACE.Upkeep.AssignHint', { points })}</p>${STAT_KEYS.map(
    (key) => `<div class="form-group"><label>${STATS[key].label} (${system.attributes[key].value ?? 0})</label><input type="number" name="${key}" value="0" min="0" step="1"></div>`,
  ).join('')}`
  const additions = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize('CRAWLSPACE.Upkeep.Assign') },
    content,
    rejectClose: false,
    ok: { callback: (_event: Event, button: any) => Object.fromEntries(STAT_KEYS.map((key) => [key, Math.max(0, Math.floor(Number(button.form.elements[key].value) || 0))])) },
  })
  if (!additions) return
  const total = Object.values(additions as Record<string, number>).reduce((sum, value) => sum + value, 0)
  if (total !== points) return ui.notifications.warn(game.i18n.format('CRAWLSPACE.Upkeep.AssignAll', { points }))
  const update: Record<string, number> = { 'system.upkeep.allocatedThroughLevel': system.details.level }
  for (const key of STAT_KEYS) update[`system.attributes.${key}.value`] = (Number(system.attributes[key].value) || 0) + (additions as any)[key]
  await actor.update(update)
}

/** One GM session advances time once, regardless of the number of participating crawlers. */
export async function performUpkeep(uuids: string[], kind: string, hours = 1, skipTime = false) {
  if (!game.user.isGM) return
  const actors = (await Promise.all([...new Set(uuids)].map((uuid) => fromUuid(uuid)))).filter((actor) => actor?.type === 'crawler')
  if (!actors.length) return
  if (['short', 'long', 'full', 'hourly'].includes(kind)) {
    await restParty(actors, kind as RecoveryKind, hours, { advance: !skipTime })
  } else if (['safeRoom', 'session', 'floor'].includes(kind)) {
    for (const actor of actors) await advanceMarked(actor, kind as AdvancementKind)
  } else if (kind === 'grinding') {
    await openGrinding(actors, hours, { advance: !skipTime })
  } else if (kind === 'level') {
    for (const actor of actors) await levelUp(actor)
  }
}

/** Whether upkeep buttons apply their changes on their own (the "Automate upkeep" setting). */
export const upkeepAutomated = () => game.settings.get('crawlspace', 'upkeepAutomation') !== false

/** "Short Rest for Carl, Donut." */
function describeUpkeep(kind: string, actors: any[], hours: number) {
  const esc = foundry.utils.escapeHTML
  const action = esc(game.i18n.localize(`CRAWLSPACE.Upkeep.Actions.${kind}`))
  const names = actors.map((actor: any) => esc(actor.name)).join(', ')
  return game.i18n.format(['hourly', 'grinding'].includes(kind) ? 'CRAWLSPACE.Upkeep.RequestHours' : 'CRAWLSPACE.Upkeep.RequestLine', { action, hours, names })
}

/** The action happened, but nothing was changed for it: the table applies it by hand. */
async function noteManualUpkeep(kind: string, actors: any[], hours: number) {
  const content = `<div class="crawlspace chat-card upkeep-card"><h3>${game.i18n.localize(`CRAWLSPACE.Upkeep.Actions.${kind}`)}</h3><p>${describeUpkeep(kind, actors, hours)}</p><p>${game.i18n.localize('CRAWLSPACE.Upkeep.Manual')}</p></div>`
  await ChatMessage.create({ content, speaker: actors.length === 1 ? ChatMessage.getSpeaker({ actor: actors[0] }) : { alias: game.user.name } })
}

/**
 * With automation off, the GM decides each time whether an upkeep action applies its changes. Declining notes it in
 * chat and changes nothing (false); closing the prompt cancels it (null). Always true when automation is on.
 */
export async function gmAllowsAutomation(kind: string, actors: any[], hours = 1): Promise<boolean | null> {
  if (upkeepAutomated() || !actors.length) return true
  const answer = await foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n.localize('CRAWLSPACE.Upkeep.AutomateTitle') }, classes: ['crawlspace'], rejectClose: false,
    content: `<p>${describeUpkeep(kind, actors, hours)}</p><p>${game.i18n.localize('CRAWLSPACE.Upkeep.AutomateAsk')}</p>`,
    yes: { label: game.i18n.localize('CRAWLSPACE.Upkeep.Automate'), icon: 'fa-solid fa-gears' },
    no: { label: game.i18n.localize('CRAWLSPACE.Upkeep.DontAutomate'), icon: 'fa-solid fa-hand' },
  })
  if (answer === false) await noteManualUpkeep(kind, actors, hours)
  return answer === true ? true : answer === false ? false : null
}

/**
 * A player's upkeep, posted for the GMs. Without the "players run upkeep" setting it asks Approve or Decline; with
 * automation off (manual) it asks whether to automate it, and declining only notes it.
 */
export async function postUpkeepRequest(user: any, uuids: string[], kind: string, hours: number, manual = false) {
  if (!game.user.isGM) return
  const actors = (await Promise.all(uuids.map((uuid) => fromUuid(uuid)))).filter((actor: any) => actor?.type === 'crawler')
  if (!actors.length) return
  const esc = foundry.utils.escapeHTML
  const label = (key: string) => game.i18n.localize(`CRAWLSPACE.Upkeep.${key}`)
  const content = `<div class="crawl-card upkeep-request">
    <h4 class="card-title"><i class="fa-solid fa-campground"></i> ${game.i18n.format('CRAWLSPACE.Upkeep.RequestTitle', { user: esc(user.name) })}</h4>
    <p>${describeUpkeep(kind, actors, hours)}</p>${manual ? `<p>${label('AutomateAsk')}</p>` : ''}
    <div class="card-buttons">
      <button type="button" data-crawl-action="upkeep-approve"><i class="fa-solid ${manual ? 'fa-gears' : 'fa-check'}"></i> ${label(manual ? 'Automate' : 'Approve')}</button>
      <button type="button" data-crawl-action="upkeep-decline"><i class="fa-solid ${manual ? 'fa-hand' : 'fa-xmark'}"></i> ${label(manual ? 'DontAutomate' : 'Decline')}</button>
    </div>
  </div>`
  await ChatMessage.create({
    content,
    speaker: { alias: user.name },
    whisper: game.users.filter((entry: any) => entry.isGM).map((entry: any) => entry.id),
    flags: { crawlspace: { kind: 'upkeepRequest', uuids: actors.map((actor: any) => actor.uuid), upkeep: kind, hours, userId: user.id, manual } },
  })
}

/** The GM answers a request card: approving runs the upkeep (and its time) as if the GM chose it. */
export async function answerUpkeepRequest(message: any, approve: boolean) {
  const flags = message.flags?.crawlspace
  if (!game.user.isGM || flags?.kind !== 'upkeepRequest' || flags.answered) return
  await message.update({ 'flags.crawlspace.answered': approve ? 'approved' : 'declined' })
  if (approve) await performUpkeep(flags.uuids, flags.upkeep, flags.hours)
  // Manual upkeep: declining is "do it by hand", which everyone sees in chat.
  if (flags.manual) {
    if (!approve) await noteManualUpkeep(flags.upkeep, (await Promise.all(flags.uuids.map((uuid: string) => fromUuid(uuid)))).filter(Boolean), flags.hours)
    return
  }
  const user = game.users.get(flags.userId)
  if (user) await ChatMessage.create({ content: `<p>${game.i18n.format(approve ? 'CRAWLSPACE.Upkeep.Approved' : 'CRAWLSPACE.Upkeep.Declined', { action: game.i18n.localize(`CRAWLSPACE.Upkeep.Actions.${flags.upkeep}`) })}</p>`, whisper: [user.id] })
}

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api

/** The party key a crawler stands with: 'players', another party's id, or '' (Solo). */
const partyKeyOf = (actor: any) => (inParty(actor) ? PLAYERS : String(actor.getFlag('crawlspace', 'partyId') ?? ''))

/**
 * Party Upkeep. It lists the players' party, checked; the GM drops more crawlers (or a folder of them) onto it.
 * Crawlers are grouped by party, a party's button checks or clears all of it, and crawlers or whole parties can be
 * taken off the list. The window stays open after an action, so the list is kept until it closes.
 */
class UpkeepApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS: any = {
    tag: 'form',
    classes: ['crawlspace', 'upkeep-dialog'],
    position: { width: 560, height: 'auto' },
    window: { title: 'CRAWLSPACE.Upkeep.Party', icon: 'fa-solid fa-campground', resizable: true },
    actions: {
      upkeep: UpkeepApp.#onUpkeep,
      toggleParty: UpkeepApp.#onToggleParty,
      removeCrawler: UpkeepApp.#onRemoveCrawler,
      removeParty: UpkeepApp.#onRemoveParty,
    },
  }

  static PARTS = {
    main: { template: 'systems/crawlspace/templates/apps/upkeep.hbs' },
    footer: { template: 'systems/crawlspace/templates/apps/upkeep-footer.hbs' },
  }

  /** The crawlers on the list, and those checked. */
  listed: string[]
  checked: Set<string>

  constructor(uuids: string[], options: any = {}) {
    super(options)
    this.listed = [...new Set(uuids)]
    this.checked = new Set(this.listed)
  }

  get actors(): any[] {
    return this.listed.map((uuid) => fromUuidSync(uuid)).filter((actor: any) => actor?.type === 'crawler')
  }

  async _prepareContext() {
    const gm = game.user.isGM
    const request = !gm && !game.settings.get('crawlspace', 'playerUpkeep')
    const hint = gm ? 'Hint' : !upkeepAutomated() ? 'ManualHint' : request ? 'RequestHint' : 'NoTime'
    const groups = rosterGroups(
      this.actors.map((actor: any) => ({ uuid: actor.uuid, name: actor.name, party: partyKeyOf(actor) })),
      this.checked,
      { parties: otherParties(), playersLabel: playerPartyLabel(), soloLabel: game.i18n.localize('CRAWLSPACE.Party.Solo'), unnamedLabel: game.i18n.localize('CRAWLSPACE.Party.Unnamed') },
    )
    const kinds = ['short', 'long', 'full', 'hourly', 'safeRoom', 'session', 'floor', 'grinding', 'assign', ...(gm ? ['level', 'awards', 'autoLoot', 'generator'] : [])]
    // Rest times go in the tooltips, which say Personal Space upgrades can change them.
    const buttons = kinds.map((kind) => ({
      kind,
      label: game.i18n.localize(`CRAWLSPACE.Upkeep.Actions.${kind}`),
      tooltip: ['short', 'long', 'full'].includes(kind) ? game.i18n.localize(`CRAWLSPACE.Upkeep.RestTime.${kind}`) : '',
    }))
    return { gm, hint: game.i18n.localize(`CRAWLSPACE.Upkeep.${hint}`), groups, buttons }
  }

  _onFirstRender(context: any, options: any) {
    super._onFirstRender(context, options)
    this.element.addEventListener('change', (event: Event) => {
      const input = event.target as HTMLInputElement
      if (input?.name !== 'actor') return
      if (input.checked) this.checked.add(input.value)
      else this.checked.delete(input.value)
      this.render()
    })
    if (!game.user.isGM) return
    this.element.addEventListener('dragover', (event: DragEvent) => event.preventDefault())
    this.element.addEventListener('drop', (event: DragEvent) => this.#onDrop(event))
  }

  /** A dropped crawler (or every crawler in a dropped Actors folder) joins the list, checked. */
  async #onDrop(event: DragEvent) {
    const data: any = foundry.applications.ux.TextEditor.implementation.getDragEventData(event)
    if (!data?.uuid || !['Actor', 'Folder'].includes(data.type)) return
    event.preventDefault()
    const dropped: any = await fromUuid(data.uuid)
    const list = data.type === 'Folder' ? (dropped?.type === 'Actor' ? dropped.contents ?? [] : []) : [dropped]
    const crawlers = list.filter((actor: any) => actor?.type === 'crawler')
    if (!crawlers.length) return ui.notifications.warn(game.i18n.localize('CRAWLSPACE.Upkeep.DropCrawlers'))
    for (const actor of crawlers) {
      if (!this.listed.includes(actor.uuid)) this.listed.push(actor.uuid)
      this.checked.add(actor.uuid)
    }
    this.render()
  }

  static #onToggleParty(this: UpkeepApp, _event: Event, target: HTMLElement) {
    const uuids = [...(target.closest('.upkeep-party')?.querySelectorAll<HTMLInputElement>('[name=actor]') ?? [])].map((input) => input.value)
    this.checked = toggleGroup(this.checked, uuids)
    this.render()
  }

  #remove(uuids: string[]) {
    this.listed = this.listed.filter((uuid) => !uuids.includes(uuid))
    for (const uuid of uuids) this.checked.delete(uuid)
    this.render()
  }

  static #onRemoveCrawler(this: UpkeepApp, _event: Event, target: HTMLElement) {
    const uuid = target.closest<HTMLElement>('[data-uuid]')?.dataset.uuid
    if (uuid) this.#remove([uuid])
  }

  static #onRemoveParty(this: UpkeepApp, _event: Event, target: HTMLElement) {
    this.#remove([...(target.closest('.upkeep-party')?.querySelectorAll<HTMLElement>('[data-uuid]') ?? [])].map((row) => row.dataset.uuid!))
  }

  static async #onUpkeep(this: UpkeepApp, _event: Event, target: HTMLElement) {
    const kind = target.dataset.kind!
    if (kind === 'generator') return openItemGenerator()
    const chosen = this.actors.filter((actor: any) => this.checked.has(actor.uuid))
    if (!chosen.length) return ui.notifications.warn(game.i18n.localize('CRAWLSPACE.Time.SelectActors'))
    try {
      if (kind === 'awards') return openAwards(chosen)
      if (kind === 'autoLoot') return openAutoLoot(chosen)
      if (kind === 'assign') { for (const entry of chosen) await assignStats(entry); return }
      // Only the actions that take hours ask for them.
      let hours = 1
      if (kind === 'hourly' || kind === 'grinding') {
        const picked = await askHours(game.i18n.localize(`CRAWLSPACE.Upkeep.Actions.${kind}`))
        if (picked === null) return
        hours = picked
      }
      return await upkeepAction(chosen.map((actor: any) => actor.uuid), kind, hours)
    } catch (error: any) { ui.notifications.error(error.message) }
  }
}

/** Party Upkeep for the players' party, or for one crawler (from its sheet). */
export async function openUpkeep(actor?: any) {
  const id = actor ? `crawl-upkeep-${actor.id}` : 'crawl-upkeep'
  const open: any = foundry.applications.instances.get(id)
  if (open) return open.render({ force: true })
  const uuids = actor ? [actor.uuid] : partyCrawlers().filter((entry: any) => entry.type === 'crawler' && (game.user.isGM || entry.visible)).map((entry: any) => entry.uuid)
  return new UpkeepApp(uuids, { id }).render({ force: true })
}

/** A small prompt for how many hours an upkeep action takes (1–30, one dungeon day). */
async function askHours(title: string): Promise<number | null> {
  const value = await foundry.applications.api.DialogV2.prompt({
    window: { title }, classes: ['crawlspace'], rejectClose: false,
    content: `<div class="form-group"><label>${game.i18n.localize('CRAWLSPACE.Upkeep.Hours')}</label><input name="hours" type="number" min="1" max="30" step="1" value="1" autofocus></div>`,
    ok: { label: game.i18n.localize('CRAWLSPACE.Upkeep.Go'), callback: (_event: Event, button: any) => Number(button.form.elements.hours.value) },
  })
  if (value === null || value === undefined) return null
  if (!Number.isSafeInteger(value) || value < 1 || value > 30) {
    ui.notifications.warn(game.i18n.localize('CRAWLSPACE.Upkeep.HoursError'))
    return null
  }
  return value
}

export function registerUpkeep() {
  game.settings.register('crawlspace', 'upkeepAutomation', {
    name: 'CRAWLSPACE.Upkeep.AutomationSetting', hint: 'CRAWLSPACE.Upkeep.AutomationSettingHint',
    scope: 'world', config: true, restricted: true, type: Boolean, default: true,
  })
  game.settings.register('crawlspace', 'playerUpkeep', {
    name: 'CRAWLSPACE.Upkeep.PlayerSetting', hint: 'CRAWLSPACE.Upkeep.PlayerSettingHint',
    scope: 'world', config: true, restricted: true, type: Boolean, default: false,
  })
}
