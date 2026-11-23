/**
 * The Leaderboard & Population window (not homebrew; the `leaderboardTools` world setting turns it off). The GM
 * keeps the Top Ten (any names, or crawlers picked from the world) and the crawlers left on each floor; both can be
 * filled from the books and then edited however the GM likes (rules/leaderboard.ts). Players see the leaderboard only
 * once the GM shows it. When the party reaches a new floor, the GM's client announces how many crawlers remain, as
 * the books do at floor transitions. Opened from the CarlRPG controls or game.crawlspace.leaderboard.open().
 */
import { partyCrawlers } from '../actors/party'
import {
  CANON_LEADERBOARDS,
  CANON_POPULATION,
  canonLeaderboard,
  cleanLeaderboard,
  cleanPopulation,
  emptyRow,
  LEADERBOARD_SIZE,
  populationLoss,
  type Leaderboard,
  type LeaderRow,
} from '../rules/leaderboard'

const { ApplicationV2 } = foundry.applications.api
const t = (key: string, data?: Record<string, unknown>) => (data ? game.i18n.format(`CRAWLSPACE.Leaderboard.${key}`, data) : game.i18n.localize(`CRAWLSPACE.Leaderboard.${key}`))
const esc = (text: unknown) => foundry.utils.escapeHTML(String(text ?? ''))
const number = (value: number) => value.toLocaleString(game.i18n.lang)

export const leaderboardToolsOn = () => game.settings.get('crawlspace', 'leaderboardTools') !== false
const board = (): Leaderboard => cleanLeaderboard(game.settings.get('crawlspace', 'leaderboard'))
const population = () => cleanPopulation(game.settings.get('crawlspace', 'population'))
const FIELDS: (keyof LeaderRow)[] = ['name', 'race', 'className', 'level', 'bounty']

/** The party's floor: the deepest floor any party crawler is on. */
const partyFloor = () => Math.max(0, ...partyCrawlers().map((actor: any) => Number(actor.system?.details?.floor) || 0))

/** The "System Message" card announcing the crawlers left on a floor. */
export async function announcePopulation(floor: number) {
  const count = population()[floor]
  if (count == null) return ui.notifications.warn(t('NoCount', { floor }))
  const loss = populationLoss(population(), floor)
  await ChatMessage.create({
    speaker: { alias: t('SystemAI') },
    content: `<div class="crawl-card crawl-population"><h4 class="card-title"><i class="fa-solid fa-users"></i> ${esc(t('SystemMessage'))}</h4><p>${esc(t('Remaining', { count: number(count), floor }))}</p>${loss ? `<p class="hint">${esc(t('Lost', { lost: number(loss.lost), percent: loss.percent }))}</p>` : ''}</div>`,
  })
  await game.settings.set('crawlspace', 'populationAnnounced', floor)
}

/** The leaderboard as a chat card. */
async function postLeaderboard() {
  const { label, rows } = board()
  const body = rows.map((entry, index) => `<tr><td>${index + 1}</td><td>${esc(entry.name)}</td><td>${esc(entry.level)}</td><td>${esc(entry.bounty)}</td></tr>`).join('')
  await ChatMessage.create({
    speaker: { alias: t('SystemAI') },
    content: `<div class="crawl-card crawl-leaderboard-card"><h4 class="card-title"><i class="fa-solid fa-ranking-star"></i> ${esc(label || t('Title'))}</h4><table><thead><tr><th>#</th><th>${esc(t('Field.name'))}</th><th>${esc(t('Field.level'))}</th><th>${esc(t('Field.bounty'))}</th></tr></thead><tbody>${body}</tbody></table></div>`,
  })
}

export class LeaderboardApp extends ApplicationV2 {
  [key: string]: any
  static DEFAULT_OPTIONS: any = {
    id: 'crawl-leaderboard',
    classes: ['crawlspace', 'crawl-leaderboard'],
    window: { title: 'CRAWLSPACE.Leaderboard.Title', icon: 'fa-solid fa-ranking-star', resizable: true },
    position: { width: 720, height: 'auto' },
  }

  tab: 'board' | 'population' = 'board'

  async _renderHTML() {
    const gm = game.user.isGM
    const { label, rows, visible } = board()
    if (!gm) {
      if (!visible) return `<p class="hint">${esc(t('Hidden'))}</p>`
      return `<h3>${esc(label || t('Title'))}</h3><table class="crawl-leaderboard-table"><thead><tr><th>#</th>${FIELDS.map((field) => `<th>${esc(t(`Field.${field}`))}</th>`).join('')}</tr></thead><tbody>${rows.map((entry, index) => `<tr><td>${index + 1}</td>${FIELDS.map((field) => `<td>${esc(entry[field])}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    }
    const tabs = `<nav class="crawl-leaderboard-tabs">${(['board', 'population'] as const).map((tab) => `<button type="button" data-tab="${tab}" class="${this.tab === tab ? 'active' : ''}">${esc(t(`Tab.${tab}`))}</button>`).join('')}</nav>`
    if (this.tab === 'population') {
      const counts = population()
      const floors = [...new Set([...Object.keys(counts).map(Number), ...Array.from({ length: 12 }, (_, i) => i + 1)])].sort((a, b) => a - b)
      const announced = Number(game.settings.get('crawlspace', 'populationAnnounced')) || 0
      return `${tabs}<p class="hint">${esc(t('PopulationHint'))}</p>
        <table class="crawl-population-table"><thead><tr><th>${esc(t('Floor'))}</th><th>${esc(t('Crawlers'))}</th><th>${esc(t('Change'))}</th><th></th></tr></thead><tbody>
        ${floors.map((floor) => {
          const loss = populationLoss(counts, floor)
          return `<tr><td>${floor}${floor === partyFloor() ? ` <i class="fa-solid fa-location-dot" title="${esc(t('PartyHere'))}"></i>` : ''}</td><td><input type="number" min="0" step="1" data-floor="${floor}" value="${counts[floor] ?? ''}"></td><td>${loss ? `−${number(loss.lost)} (${loss.percent}%)` : ''}</td><td><button type="button" data-announce="${floor}" ${counts[floor] == null ? 'disabled' : ''} title="${esc(t('Announce'))}"><i class="fa-solid fa-bullhorn"></i>${floor <= announced ? ' <i class="fa-solid fa-check"></i>' : ''}</button></td></tr>`
        }).join('')}
        </tbody></table>
        <div class="crawl-leaderboard-actions"><button type="button" data-action-canon-population><i class="fa-solid fa-book"></i> ${esc(t('CanonPopulation'))}</button><button type="button" data-action-clear-population><i class="fa-solid fa-eraser"></i> ${esc(t('Clear'))}</button></div>
        <label class="checkbox"><input type="checkbox" name="autoAnnounce" ${game.settings.get('crawlspace', 'populationAutoAnnounce') ? 'checked' : ''}> ${esc(t('AutoAnnounce'))}</label>`
    }
    const crawlers = game.actors.filter((actor: any) => actor.type === 'crawler')
    const option = (value: string, text: string) => `<option value="${esc(value)}">${esc(text)}</option>`
    const body = Array.from({ length: Math.max(rows.length, 1) }, (_, index) => rows[index] ?? emptyRow())
      .map((entry, index) => `<tr data-row="${index}"><td>${index + 1}</td>${FIELDS.map((field) => `<td class="field-${field}"><input type="text" data-field="${field}" value="${esc(entry[field])}"></td>`).join('')}<td class="row-tools"><div><button type="button" data-move="-1" title="${esc(t('Up'))}"><i class="fa-solid fa-arrow-up"></i></button><button type="button" data-move="1" title="${esc(t('Down'))}"><i class="fa-solid fa-arrow-down"></i></button><button type="button" data-remove title="${esc(t('Remove'))}"><i class="fa-solid fa-trash"></i></button></div></td></tr>`)
      .join('')
    return `${tabs}<p class="hint">${esc(t('BoardHint'))}</p>
      <div class="form-group"><label>${esc(t('Label'))}</label><input type="text" name="label" value="${esc(label)}"></div>
      <table class="crawl-leaderboard-table"><thead><tr><th>#</th>${FIELDS.map((field) => `<th>${esc(t(`Field.${field}`))}</th>`).join('')}<th></th></tr></thead><tbody>${body}</tbody></table>
      <div class="crawl-leaderboard-actions">
        <button type="button" data-action-add ${rows.length >= LEADERBOARD_SIZE ? 'disabled' : ''}><i class="fa-solid fa-plus"></i> ${esc(t('AddRow'))}</button>
        <select name="crawler">${option('', t('AddCrawler'))}${crawlers.map((actor: any) => option(actor.uuid, actor.name)).join('')}</select>
        <select name="canon">${option('', t('CanonPrefill'))}${CANON_LEADERBOARDS.map((entry) => option(entry.id, entry.label)).join('')}</select>
        <button type="button" data-action-clear><i class="fa-solid fa-eraser"></i> ${esc(t('Clear'))}</button>
      </div>
      <div class="crawl-leaderboard-actions">
        <label class="checkbox"><input type="checkbox" name="visible" ${visible ? 'checked' : ''}> ${esc(t('ShowPlayers'))}</label>
        <button type="button" data-action-post><i class="fa-solid fa-comment"></i> ${esc(t('Post'))}</button>
      </div>
      <p class="hint">${esc(t('Source'))}</p>`
  }

  _replaceHTML(result: string, content: HTMLElement) {
    content.innerHTML = result
  }

  async #save(change: (value: Leaderboard) => void) {
    const value = board()
    // Keep what is typed in the table, even if it was not saved yet.
    const root = this.element as HTMLElement
    const typed = [...root.querySelectorAll<HTMLElement>('tr[data-row]')].map((tr) => {
      const entry: any = { ...(value.rows[Number(tr.dataset.row)] ?? emptyRow()) }
      for (const input of tr.querySelectorAll<HTMLInputElement>('[data-field]')) entry[input.dataset.field!] = input.value
      return entry as LeaderRow
    })
    if (typed.length) value.rows = typed.filter((entry, index) => index < value.rows.length || FIELDS.some((field) => entry[field]))
    const labelInput = root.querySelector<HTMLInputElement>('[name=label]')
    if (labelInput) value.label = labelInput.value
    change(value)
    await game.settings.set('crawlspace', 'leaderboard', cleanLeaderboard(value))
  }

  _onRender(context: any, options: any) {
    super._onRender(context, options)
    const root = this.element as HTMLElement
    if (!game.user.isGM) return
    root.querySelectorAll<HTMLElement>('[data-tab]').forEach((button) => button.addEventListener('click', () => ((this.tab = button.dataset.tab as any), this.render())))
    // Leaderboard
    root.querySelectorAll<HTMLInputElement>('[data-field], [name=label]').forEach((input) => input.addEventListener('change', () => void this.#save(() => {})))
    root.querySelector('[data-action-add]')?.addEventListener('click', () => void this.#save((value) => value.rows.length < LEADERBOARD_SIZE && value.rows.push(emptyRow())))
    root.querySelector('[data-action-clear]')?.addEventListener('click', () => void game.settings.set('crawlspace', 'leaderboard', { ...board(), label: '', rows: [] }))
    root.querySelector('[data-action-post]')?.addEventListener('click', () => void postLeaderboard())
    root.querySelector<HTMLInputElement>('[name=visible]')?.addEventListener('change', (event) => void this.#save((value) => (value.visible = (event.target as HTMLInputElement).checked)))
    root.querySelectorAll<HTMLElement>('tr[data-row]').forEach((tr) => {
      const index = Number(tr.dataset.row)
      tr.querySelector('[data-remove]')?.addEventListener('click', () => void this.#save((value) => value.rows.splice(index, 1)))
      tr.querySelectorAll<HTMLElement>('[data-move]').forEach((button) =>
        button.addEventListener('click', () =>
          void this.#save((value) => {
            const to = index + Number(button.dataset.move)
            if (to < 0 || to >= value.rows.length) return
            ;[value.rows[index], value.rows[to]] = [value.rows[to], value.rows[index]]
          }),
        ),
      )
    })
    root.querySelector<HTMLSelectElement>('[name=crawler]')?.addEventListener('change', async (event) => {
      const actor = await fromUuid((event.target as HTMLSelectElement).value)
      if (!actor) return
      const details = actor.system?.details ?? {}
      await this.#save((value) => {
        if (value.rows.length >= LEADERBOARD_SIZE) return void ui.notifications.warn(t('Full'))
        value.rows.push({ name: actor.name, race: details.race ?? '', className: details.className ?? '', level: String(details.level ?? ''), bounty: '', actorUuid: actor.uuid })
      })
    })
    root.querySelector<HTMLSelectElement>('[name=canon]')?.addEventListener('change', async (event) => {
      const canon = canonLeaderboard((event.target as HTMLSelectElement).value)
      if (!canon) return
      if (board().rows.length && !(await foundry.applications.api.DialogV2.confirm({ window: { title: t('CanonPrefill') }, content: `<p>${esc(t('ReplaceConfirm'))}</p>` }))) return this.render()
      await game.settings.set('crawlspace', 'leaderboard', { ...canon, visible: board().visible })
    })
    // Population
    root.querySelectorAll<HTMLInputElement>('[data-floor]').forEach((input) =>
      input.addEventListener('change', () => {
        const counts = population()
        if (input.value === '') delete counts[Number(input.dataset.floor)]
        else counts[Number(input.dataset.floor)] = Math.max(0, Math.floor(Number(input.value)) || 0)
        void game.settings.set('crawlspace', 'population', counts)
      }),
    )
    root.querySelectorAll<HTMLElement>('[data-announce]').forEach((button) => button.addEventListener('click', () => void announcePopulation(Number(button.dataset.announce))))
    root.querySelector('[data-action-canon-population]')?.addEventListener('click', () => void game.settings.set('crawlspace', 'population', { ...population(), ...CANON_POPULATION }))
    root.querySelector('[data-action-clear-population]')?.addEventListener('click', () => void game.settings.set('crawlspace', 'population', {}))
    root.querySelector<HTMLInputElement>('[name=autoAnnounce]')?.addEventListener('change', (event) => void game.settings.set('crawlspace', 'populationAutoAnnounce', (event.target as HTMLInputElement).checked))
  }
}

export function openLeaderboard() {
  if (!leaderboardToolsOn()) return ui.notifications.warn(t('Off'))
  if (!game.user.isGM && !board().visible) return ui.notifications.info(t('Hidden'))
  const open = foundry.applications.instances.get('crawl-leaderboard')
  return (open ?? new LeaderboardApp()).render({ force: true })
}

export const leaderboardApi = { open: openLeaderboard, announcePopulation, enabled: leaderboardToolsOn, get: board, population }

export function registerLeaderboard() {
  const rerender = () => {
    foundry.applications.instances.get('crawl-leaderboard')?.render()
    ui.controls?.render?.({ reset: true })
  }
  game.settings.register('crawlspace', 'leaderboardTools', {
    name: 'CRAWLSPACE.Leaderboard.Setting',
    hint: 'CRAWLSPACE.Leaderboard.SettingHint',
    scope: 'world',
    config: true,
    restricted: true,
    type: Boolean,
    default: true,
    onChange: rerender,
  })
  game.settings.register('crawlspace', 'leaderboard', { scope: 'world', config: false, type: Object, default: { label: '', rows: [], visible: false }, onChange: rerender })
  game.settings.register('crawlspace', 'population', { scope: 'world', config: false, type: Object, default: {}, onChange: rerender })
  game.settings.register('crawlspace', 'populationAnnounced', { scope: 'world', config: false, type: Number, default: 0, onChange: rerender })
  game.settings.register('crawlspace', 'populationAutoAnnounce', { scope: 'world', config: false, type: Boolean, default: true })
  // Floor transitions: when a party crawler first reaches a deeper floor, announce the crawlers left there.
  Hooks.on('updateActor', (actor: any, changes: any) => {
    if (!game.user.isActiveGM || !leaderboardToolsOn() || !game.settings.get('crawlspace', 'populationAutoAnnounce')) return
    if (!foundry.utils.hasProperty(changes, 'system.details.floor') || !partyCrawlers().includes(actor)) return
    const floor = partyFloor()
    if (floor > (Number(game.settings.get('crawlspace', 'populationAnnounced')) || 0) && population()[floor] != null) void announcePopulation(floor)
  })
}
