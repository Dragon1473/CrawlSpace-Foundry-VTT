/**
 * The GM's Race & Chase window (rules/racing.ts). Add the selected tokens, set the legs (the Skill for each,
 * and in a chase the quarry's set result), then fill in each leg: crawlers roll the leg's Skill with their Move
 * Rate Modifier from here, or the GM types the total; NPCs and Mobs take their set result. A race shows each
 * leg's placements and the standings; a chase counts each chaser's Ground and who has caught the quarry. The
 * state lives in a hidden world setting, so it survives a reload; "Post to chat" shares the standings.
 */
import { rollCheck, naturalD20, type Modifier } from '../dice/rolls'
import { attackOutcome } from '../rules/core'
import { chaseGround, chaseStatus, chaseWinners, moveMod, npcLegResult, placeLeg, raceStandings, type ChaseStatus } from '../rules/racing'

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api
const STATS = ['str', 'dex', 'con', 'int', 'cha'] as const

type Entrant = { key: string; uuid: string; name: string; img: string; npc: boolean; stat: string; results: (number | null)[]; naturals: (number | null)[] }
type Leg = { skill: string; quarry: number | null }
export type RaceState = { mode: 'race' | 'chase'; legs: Leg[]; entrants: Entrant[]; quarry: string }

const blank = (): RaceState => ({ mode: 'race', legs: [0, 1, 2].map(() => ({ skill: 'Running', quarry: null })), entrants: [], quarry: '' })
const load = (): RaceState => foundry.utils.mergeObject(blank(), (game.settings.get('crawlspace', 'raceState') as RaceState | null) ?? {}, { inplace: false })
const save = (state: RaceState) => game.settings.set('crawlspace', 'raceState', state)

const actorOf = (entrant: Entrant) => fromUuidSync(entrant.uuid) as any
const moveOf = (actor: any) => Number(actor?.system?.move?.total ?? actor?.system?.move?.value) || 0
const floorOf = (actor: any) => Number(actor?.system?.details?.floor ?? actor?.system?.floor) || 0
const isNpc = (actor: any) => !['crawler', 'companion'].includes(actor?.type)

/** An entrant's total for a leg: its typed or rolled total, or its set result for an NPC or Mob. */
function legResult(entrant: Entrant, leg: number) {
  const actor = actorOf(entrant)
  if (entrant.npc) return npcLegResult({ statMod: Number(actor?.system?.attributes?.[entrant.stat]?.mod) || 0, floor: floorOf(actor), move: moveOf(actor) })
  return entrant.results[leg] ?? null
}

export class RaceApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS: any = {
    id: 'crawl-race',
    classes: ['crawlspace', 'crawl-race'],
    tag: 'form',
    position: { width: 760, height: 'auto' },
    window: { title: 'CRAWLSPACE.Race.Title', icon: 'fa-solid fa-flag-checkered', resizable: true },
    form: { handler: RaceApp.#onChange, submitOnChange: true, closeOnSubmit: false },
    actions: {
      addSelected: RaceApp.#onAddSelected,
      remove: RaceApp.#onRemove,
      roll: RaceApp.#onRoll,
      addLeg: RaceApp.#onAddLeg,
      removeLeg: RaceApp.#onRemoveLeg,
      reset: RaceApp.#onReset,
      post: RaceApp.#onPost,
    },
  }

  static PARTS = { main: { template: 'systems/crawlspace/templates/apps/race.hbs', scrollable: [''] } }

  static open() {
    if (!game.user.isGM) return
    const app = (foundry.applications.instances.get('crawl-race') as RaceApp | undefined) ?? new RaceApp()
    return app.render({ force: true })
  }

  async _prepareContext() {
    const state = load()
    const chase = state.mode === 'chase'
    const legs = state.legs.map((leg, index) => ({ ...leg, index, number: index + 1 }))
    // Race: places per leg, then standings. Chase: Ground per leg until the chaser is caught up, lost or out.
    const places = state.legs.map((_leg, index) => {
      const entries = state.entrants
        .map((entrant) => ({ id: entrant.key, result: legResult(entrant, index), move: moveOf(actorOf(entrant)) }))
        .filter((entry): entry is { id: string; result: number; move: number } => entry.result !== null)
      return placeLeg(entries)
    })
    const complete = state.entrants.length > 0 && state.legs.every((_leg, index) => state.entrants.every((entrant) => legResult(entrant, index) !== null))
    const standings = raceStandings(Object.fromEntries(state.entrants.map((entrant) => [entrant.key, places.map((leg) => leg[entrant.key] ?? 0)])))
    const chaseRows = state.entrants.map((entrant) => {
      let ground: number | null = 0
      let status: ChaseStatus = 'chasing'
      const steps = state.legs.map((leg, index) => {
        const result = legResult(entrant, index)
        if (status !== 'chasing' || result === null || leg.quarry === null) return { gain: null, skipped: status !== 'chasing' }
        const outcome = attackOutcome(result, leg.quarry, entrant.npc ? undefined : (entrant.naturals[index] ?? undefined))
        const gain = chaseGround(outcome, result - leg.quarry)
        ground = gain === null ? null : (ground ?? 0) + gain
        status = chaseStatus(ground, false)
        return { gain, skipped: false }
      })
      if (status === 'chasing' && complete) status = chaseStatus(ground, true)
      return { key: entrant.key, ground, status, steps }
    })
    const winners = chaseWinners(chaseRows.filter((row) => row.status === 'caught').map((row) => ({ id: row.key, ground: row.ground ?? 0, move: moveOf(actorOf(state.entrants.find((entrant) => entrant.key === row.key)!)) })))
    return {
      state,
      chase,
      legs,
      complete,
      stats: Object.fromEntries(STATS.map((stat) => [stat, stat.toUpperCase()])),
      entrants: state.entrants.map((entrant) => {
        const actor = actorOf(entrant)
        const move = moveOf(actor)
        const standing = standings.find((row) => row.id === entrant.key)
        const row = chaseRows.find((entry) => entry.key === entrant.key)!
        return {
          ...entrant,
          move,
          moveMod: moveMod(move),
          cells: state.legs.map((_leg, index) => ({
            index,
            number: index + 1,
            result: legResult(entrant, index),
            gainShown: typeof row.steps[index]?.gain === 'number',
            place: places[index][entrant.key],
            gain: row.steps[index]?.gain,
            skipped: row.steps[index]?.skipped,
          })),
          total: standing?.total ?? 0,
          place: complete ? standing?.place : null,
          ground: row.ground,
          out: row.ground === null,
          status: game.i18n.localize(`CRAWLSPACE.Race.Status.${row.status}`),
          statusKey: row.status,
          first: winners[0] === entrant.key,
        }
      }),
    }
  }

  /** Every field: the mode, the quarry, each leg's Skill and quarry result, each entrant's NPC switch, stat and totals. */
  static async #onChange(this: RaceApp, _event: Event, _form: HTMLFormElement, formData: any) {
    const data = foundry.utils.expandObject(formData.object) as any
    const state = load()
    if (data.mode === 'race' || data.mode === 'chase') state.mode = data.mode
    state.quarry = String(data.quarry ?? state.quarry)
    const number = (value: unknown) => (value === '' || value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Math.floor(Number(value)))
    state.legs.forEach((leg, index) => {
      const entry = data.legs?.[index]
      if (!entry) return
      leg.skill = String(entry.skill ?? leg.skill)
      if ('quarry' in entry) leg.quarry = number(entry.quarry)
    })
    for (const entrant of state.entrants) {
      const entry = data.entrants?.[entrant.key]
      if (!entry) continue
      entrant.npc = !!entry.npc
      if (entry.stat) entrant.stat = entry.stat
      state.legs.forEach((_leg, index) => {
        if (!entry.results || !(index in entry.results)) return
        const value = number(entry.results[index])
        // A typed total has no natural die to read.
        if (value !== entrant.results[index]) entrant.naturals[index] = null
        entrant.results[index] = value
      })
    }
    await save(state)
    this.render()
  }

  static async #onAddSelected(this: RaceApp) {
    const state = load()
    const tokens = canvas.tokens?.controlled ?? []
    if (!tokens.length) return ui.notifications.warn(game.i18n.localize('CRAWLSPACE.Race.SelectTokens'))
    for (const token of tokens) {
      const actor = token.actor
      if (!actor || state.entrants.some((entrant) => entrant.uuid === actor.uuid)) continue
      state.entrants.push({ key: foundry.utils.randomID(), uuid: actor.uuid, name: token.name, img: actor.img, npc: isNpc(actor), stat: 'dex', results: [], naturals: [] })
    }
    await save(state)
    this.render()
  }

  static async #onRemove(this: RaceApp, _event: Event, target: HTMLElement) {
    const state = load()
    state.entrants = state.entrants.filter((entrant) => entrant.key !== target.closest<HTMLElement>('[data-key]')?.dataset.key)
    await save(state)
    this.render()
  }

  /** Roll a crawler's leg: the leg's Skill (or its DEX if they lack it) plus their Move Rate Modifier. */
  static async #onRoll(this: RaceApp, _event: Event, target: HTMLElement) {
    const state = load()
    const entrant = state.entrants.find((entry) => entry.key === target.closest<HTMLElement>('[data-key]')?.dataset.key)
    const index = Number(target.dataset.leg)
    const leg = state.legs[index]
    const actor = entrant && actorOf(entrant)
    if (!entrant || !leg || !actor) return
    const skill = actor.items.find((item: any) => item.type === 'skill' && item.name.toLowerCase() === leg.skill.trim().toLowerCase())
    const move = moveMod(moveOf(actor))
    const modifiers: Modifier[] = [
      ...(skill ? skill.checkModifiers() : [{ label: 'DEX', value: Number(actor.system.attributes?.dex?.mod) || 0 }]),
      { label: game.i18n.localize('CRAWLSPACE.Race.MoveMod'), value: move },
    ]
    const result = await rollCheck(actor, {
      label: game.i18n.format('CRAWLSPACE.Race.LegLabel', { leg: index + 1, skill: skill?.name ?? leg.skill }),
      kind: 'check',
      modifiers,
      sources: [skill?.name ?? leg.skill],
      difficulty: state.mode === 'chase' ? leg.quarry : null,
    })
    if (!result) return
    const fresh = load()
    const stored = fresh.entrants.find((entry) => entry.key === entrant.key)
    if (!stored) return
    stored.results[index] = result.roll.total
    stored.naturals[index] = naturalD20(result.roll) ?? null
    await save(fresh)
    this.render()
  }

  static async #onAddLeg(this: RaceApp) {
    const state = load()
    state.legs.push({ skill: state.legs.at(-1)?.skill ?? 'Running', quarry: state.legs.at(-1)?.quarry ?? null })
    await save(state)
    this.render()
  }

  static async #onRemoveLeg(this: RaceApp) {
    const state = load()
    if (state.legs.length <= 1) return
    state.legs.pop()
    for (const entrant of state.entrants) {
      entrant.results.length = Math.min(entrant.results.length, state.legs.length)
      entrant.naturals.length = Math.min(entrant.naturals.length, state.legs.length)
    }
    await save(state)
    this.render()
  }

  static async #onReset(this: RaceApp) {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('CRAWLSPACE.Race.Reset') },
      content: `<p>${game.i18n.localize('CRAWLSPACE.Race.ResetConfirm')}</p>`,
      rejectClose: false,
    })
    if (!confirmed) return
    await save(blank())
    this.render()
  }

  /** Share the standings (race) or the Ground and who caught the quarry (chase) in chat. */
  static async #onPost(this: RaceApp) {
    const context: any = await this._prepareContext()
    const esc = foundry.utils.escapeHTML
    const rows = [...context.entrants]
      .sort((a: any, b: any) => (context.chase ? (b.ground ?? -99) - (a.ground ?? -99) : (a.place ?? 99) - (b.place ?? 99) || a.total - b.total))
      .map((entrant: any) =>
        context.chase
          ? `<li>${esc(entrant.name)}: ${entrant.ground ?? '—'} ${game.i18n.localize('CRAWLSPACE.Race.Ground')} · ${entrant.status}${entrant.first ? ` <b>${game.i18n.localize('CRAWLSPACE.Race.First')}</b>` : ''}</li>`
          : `<li>${entrant.place ? `<b>${entrant.place}.</b> ` : ''}${esc(entrant.name)} (${entrant.total})</li>`,
      )
      .join('')
    const title = context.chase ? game.i18n.format('CRAWLSPACE.Race.ChaseTitle', { quarry: esc(context.state.quarry || '?') }) : game.i18n.localize('CRAWLSPACE.Race.RaceTitle')
    await ChatMessage.create({ content: `<div class="crawlspace chat-card race-card"><h3><i class="fa-solid fa-flag-checkered"></i> ${title}</h3><ol class="race-results">${rows}</ol></div>` })
  }
}

export function registerRace() {
  game.settings.register('crawlspace', 'raceState', { scope: 'world', config: false, type: Object, default: null, onChange: () => foundry.applications.instances.get('crawl-race')?.render() })
  Hooks.on('getSceneControlButtons', (controls: any) => {
    const tokens = controls.tokens
    if (!tokens?.tools || !game.user.isGM) return
    tokens.tools.crawlRace = {
      name: 'crawlRace',
      order: Object.keys(tokens.tools).length + 1,
      title: 'CRAWLSPACE.Race.Title',
      icon: 'fa-solid fa-flag-checkered',
      button: true,
      visible: game.user.isGM,
      onChange: () => RaceApp.open(),
    }
  })
}
