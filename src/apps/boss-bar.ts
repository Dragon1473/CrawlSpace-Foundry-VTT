/**
 * The boss health bar: one bar per boss in the current combat, across about 60% of the top of the canvas. It
 * starts green and turns red as the boss loses health slots, like the crawler frames, with no numbers. Each user
 * can drag it (anywhere on the bar), resize it from the corner handle, and double-click to put it back; the spot is
 * remembered per user. The "Boss health bar" setting turns it off. Hidden bosses only show for the GM, and players
 * see a boss's name only when its token shows names to everyone.
 */
import { barPercent, bossBarBox, bossCombatants, bossNameShown, healthColor, type BarBox } from '../rules/boss-bar'

const BAR_ID = 'crawl-boss-bar'
const esc = (text: string) => foundry.utils.escapeHTML(text)

const enabled = () => !!game.settings.get('crawlspace', 'bossHealthBar')
const savedBox = () => game.settings.get('crawlspace', 'bossHealthBarPosition') as Partial<BarBox> | null
const view = () => ({ width: window.innerWidth, height: window.innerHeight })
/** Just under the floor timers when they are showing, else near the top. */
const defaultTop = () => {
  const timers = document.getElementById('crawlspace-timers')?.getBoundingClientRect()
  return timers && timers.height > 0 && timers.top < 200 ? timers.bottom + 8 : 12
}
const boxFor = (saved: Partial<BarBox> | null) => bossBarBox(saved, view(), defaultTop())

/** The combat's bosses with their health. */
function bosses() {
  const combat = game.combat
  if (!combat) return []
  const entries: { id: string; tokenId: string; kind?: string; hidden: boolean; combatant: any }[] = combat.combatants.contents.map((combatant: any) => ({
    id: combatant.id,
    tokenId: combatant.tokenId,
    kind: combatant.actor?.type === 'mob' ? combatant.actor.system?.kind : undefined,
    hidden: combatant.hidden || combatant.token?.hidden,
    combatant,
  }))
  return bossCombatants(entries, game.user.isGM).map(({ combatant }) => {
    const health = combatant.actor.system.health ?? {}
    const pct = barPercent(health.value, health.max)
    const shown = bossNameShown(game.user.isGM, combatant.token?.displayName ?? 0)
    return { id: combatant.id, name: shown ? combatant.token?.name ?? combatant.name : '', pct }
  })
}

function render() {
  const list = enabled() ? bosses() : []
  let bar = document.getElementById(BAR_ID)
  if (!list.length) return bar?.remove()
  if (!bar) bar = create()
  const box = boxFor(savedBox())
  Object.assign(bar.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px` })
  bar.style.setProperty('--bar-height', `${box.height}px`)
  const rows = bar.querySelector<HTMLElement>('.boss-bar-rows')!
  // Rows are kept and updated in place, so the fill animates from its old width.
  const keep = new Set(list.map((boss) => boss.id))
  for (const row of rows.querySelectorAll<HTMLElement>('[data-combatant-id]')) if (!keep.has(row.dataset.combatantId!)) row.remove()
  for (const boss of list) {
    let row = rows.querySelector<HTMLElement>(`[data-combatant-id="${boss.id}"]`)
    if (!row) {
      row = document.createElement('div')
      row.className = 'boss-bar-row'
      row.dataset.combatantId = boss.id
      row.innerHTML = '<div class="boss-bar-track" role="meter" aria-valuemin="0" aria-valuemax="100"><div class="boss-bar-fill"></div></div><div class="boss-bar-name"></div>'
    }
    rows.append(row)
    const track = row.querySelector<HTMLElement>('.boss-bar-track')!
    track.setAttribute('aria-valuenow', String(boss.pct))
    track.setAttribute('aria-label', boss.name || game.i18n.localize('CRAWLSPACE.BossBar.Boss'))
    const fill = row.querySelector<HTMLElement>('.boss-bar-fill')!
    Object.assign(fill.style, { width: `${boss.pct}%`, backgroundColor: healthColor(boss.pct) })
    row.querySelector<HTMLElement>('.boss-bar-name')!.innerHTML = esc(boss.name)
  }
}

function create() {
  const bar = document.createElement('div')
  bar.id = BAR_ID
  bar.dataset.tooltip = game.i18n.localize('CRAWLSPACE.BossBar.DragHint')
  bar.innerHTML = `<div class="boss-bar-rows"></div><div class="boss-bar-resize" aria-hidden="true"></div>`
  document.body.append(bar)
  bindDrag(bar)
  return bar
}

/** Drag the bar to move it, or its corner handle to resize it; the result is saved for this user. */
function bindDrag(bar: HTMLElement) {
  const handle = bar.querySelector<HTMLElement>('.boss-bar-resize')!
  const start = (event: PointerEvent, resizing: boolean) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const from = { x: event.clientX, y: event.clientY, ...boxFor(savedBox()) }
    const target = event.currentTarget as HTMLElement
    target.setPointerCapture(event.pointerId)
    let box = from as BarBox
    const move = (moved: PointerEvent) => {
      const dx = moved.clientX - from.x
      const dy = moved.clientY - from.y
      const wanted = resizing ? { ...from, width: from.width + dx, height: from.height + dy } : { ...from, left: from.left + dx, top: from.top + dy }
      box = boxFor(wanted)
      Object.assign(bar.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px` })
      bar.style.setProperty('--bar-height', `${box.height}px`)
    }
    const up = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      target.removeEventListener('pointercancel', up)
      game.settings.set('crawlspace', 'bossHealthBarPosition', { left: box.left, top: box.top, width: box.width, height: box.height })
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
    target.addEventListener('pointercancel', up)
  }
  handle.addEventListener('pointerdown', (event) => start(event, true))
  bar.addEventListener('pointerdown', (event) => event.target !== handle && start(event, false))
  bar.addEventListener('dblclick', () => game.settings.set('crawlspace', 'bossHealthBarPosition', null))
}

export function registerBossBar() {
  const refresh = foundry.utils.debounce(() => render(), 50)
  game.settings.register('crawlspace', 'bossHealthBar', {
    name: 'CRAWLSPACE.BossBar.Setting',
    hint: 'CRAWLSPACE.BossBar.SettingHint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
    onChange: () => refresh(),
  })
  game.settings.register('crawlspace', 'bossHealthBarPosition', { scope: 'client', config: false, type: Object, default: null, onChange: () => refresh() })
  Hooks.once('ready', () => render())
  for (const hook of ['createCombat', 'updateCombat', 'deleteCombat', 'createCombatant', 'updateCombatant', 'deleteCombatant', 'updateToken', 'canvasReady'])
    Hooks.on(hook, refresh)
  Hooks.on('updateActor', (actor: any) => actor?.type === 'mob' && refresh())
  window.addEventListener('resize', refresh)
}
