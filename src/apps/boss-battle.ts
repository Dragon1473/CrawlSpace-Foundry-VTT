/**
 * Boss battle intro. The GM presses the button in the token controls (or calls game.crawlspace.startBossBattle);
 * every client dims the screen, shows the crawlers' headshots grouped under their party banners facing the
 * enemies' across a "VS.", and plays the sound bite set in the system settings (nothing plays while it is blank).
 *
 * Enemies are the GM's selected tokens that are neither in the players' party nor friendly; with none selected,
 * the current combat's visible hostile combatants. The crawler side is the players' party plus other crawlers in
 * the fight who aren't hostile, each under its party's name (Solo without one). Anyone can close the overlay for
 * themselves (click or Escape); when the GM closes it, it closes for everyone. It also fades out after a while.
 */
import { partyCrawlers, partyNameFor } from '../actors/party'
import { followersOf } from '../actors/companions'
import { battleSides, cleanBattle, groupFighters, soundSource, type BattleSide, type BattleToken, type FighterGroup } from '../rules/boss-battle'
import { headshotOf } from '../rules/headshot'

const CHANNEL = 'system.crawlspace'
const OVERLAY_ID = 'crawl-boss-battle'
/** How long the overlay stays before fading by itself. */
const SHOW_MS = 12000

const t = (key: string, data?: Record<string, unknown>) => (data ? game.i18n.format(`CRAWLSPACE.BossBattle.${key}`, data) : game.i18n.localize(`CRAWLSPACE.BossBattle.${key}`))
const esc = (text: string) => foundry.utils.escapeHTML(text)

let closeTimer: number | undefined
let sound: any = null

/** The actor's headshot (headshot-maker.ts), else its portrait, else the token art. */
const headshot = (actor: any, tokenImg: unknown) => headshotOf({ headshot: actor?.getFlag?.('crawlspace', 'headshot'), portrait: actor?.img, token: tokenImg })

/** A crawler's level is in its details; a mob's sits on the system. */
const levelOf = (actor: any) => (actor?.type === 'crawler' ? actor.system?.details?.level : actor?.system?.level) ?? null

function gatherBattle() {
  const members = partyCrawlers()
  const memberIds = new Set(members.map((actor: any) => actor.id))
  const fighter = (id: string, actor: any, name: string, tokenImg: unknown, disposition: number): BattleToken => ({
    id,
    actorUuid: actor?.uuid,
    name,
    img: headshot(actor, tokenImg),
    disposition,
    crawler: actor?.type === 'crawler',
    party: actor?.type === 'crawler' ? partyNameFor(actor, memberIds) : '',
    level: levelOf(actor),
  })
  const party = members.map((actor: any) => fighter(actor.id, actor, actor.name, actor.prototypeToken?.texture?.src, 1))
  const friends = members.flatMap((actor: any) => followersOf(actor).map((follower: any) => follower.uuid))
  const selected = (canvas?.tokens?.controlled ?? []).map((token: any) => fighter(token.document.id, token.actor, token.document.name, token.document.texture?.src, token.document.disposition))
  const combatants = (game.combat?.combatants?.contents ?? [])
    .filter((combatant: any) => !combatant.hidden && !combatant.token?.hidden)
    .map((combatant: any) => fighter(combatant.tokenId ?? combatant.id, combatant.actor, combatant.token?.name ?? combatant.name, combatant.token?.texture?.src ?? combatant.img, combatant.token?.disposition ?? 0))
  const { allies, enemies } = battleSides({ party, selected, combatants, friends })
  const solo = game.i18n.localize('CRAWLSPACE.Party.Solo')
  return { crawlers: groupFighters(allies, solo), enemies: groupFighters(enemies, solo) }
}

/** GM only: start the boss battle on every client. */
export function startBossBattle() {
  if (!game.user.isGM) return
  const battle = cleanBattle(gatherBattle())
  if (!battle.enemies.length) return ui.notifications.warn(t('NoEnemies'))
  if (!battle.crawlers.length) return ui.notifications.warn(t('NoCrawlers'))
  game.socket.emit(CHANNEL, { type: 'bossBattle', battle })
  showBossBattle(battle)
}

/** One party: its banner, then its crawlers in a grid (two across up to four, three across after). */
function group(entry: FighterGroup, start: number) {
  const columns = entry.fighters.length <= 1 ? 1 : entry.fighters.length <= 4 ? 2 : 3
  const banner = entry.name ? `<div class="boss-banner"><span>${esc(entry.name)}</span></div>` : ''
  const fighters = entry.fighters
    .map(
      (fighter, index) => `<figure style="--i: ${start + index}">
        <figcaption><b>${esc(fighter.name)}</b>${fighter.level === null ? '' : `<small>${esc(t('Level', { level: fighter.level }))}</small>`}</figcaption>
        <img src="${esc(fighter.img)}" alt="">
      </figure>`,
    )
    .join('')
  return `<section class="boss-group" style="--cols: ${columns}">${banner}<div class="boss-fighters">${fighters}</div></section>`
}

function side(groups: BattleSide, kind: string) {
  let start = 0
  const html = groups.map((entry) => {
    const part = group(entry, start)
    start += entry.fighters.length
    return part
  })
  return `<div class="boss-side ${kind}">${html.join('')}</div>`
}

function showBossBattle(battle: { crawlers: BattleSide; enemies: BattleSide }) {
  closeBossBattle(false)
  const overlay = document.createElement('div')
  overlay.id = OVERLAY_ID
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-label', t('Title'))
  overlay.innerHTML = `
    <div class="boss-title">${esc(t('Title'))}</div>
    <div class="boss-stage">
      ${side(battle.crawlers, 'crawlers')}
      <div class="boss-vs">${esc(t('Versus'))}</div>
      ${side(battle.enemies, 'enemies')}
    </div>
    <div class="boss-hint">${esc(game.user.isGM ? t('DismissAll') : t('Dismiss'))}</div>`
  overlay.addEventListener('click', () => dismiss())
  document.body.append(overlay)
  document.addEventListener('keydown', onKey)
  closeTimer = window.setTimeout(() => closeBossBattle(), SHOW_MS)
  playSound()
}

function onKey(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  dismiss()
}

/** The GM closing it closes it for everyone. */
function dismiss() {
  if (game.user.isGM) game.socket.emit(CHANNEL, { type: 'bossBattleEnd' })
  sound?.stop?.()
  closeBossBattle()
}

function closeBossBattle(fade = true) {
  window.clearTimeout(closeTimer)
  document.removeEventListener('keydown', onKey)
  const overlay = document.getElementById(OVERLAY_ID)
  if (!overlay) return
  if (!fade) return overlay.remove()
  overlay.classList.add('closing')
  window.setTimeout(() => overlay.remove(), 400)
}

/** The sound bite plays on each client at its interface volume; a blank or broken path just stays silent. */
function playSound() {
  const src = soundSource(game.settings.get('crawlspace', 'bossBattleSound'))
  if (!src) return
  try {
    sound?.stop?.()
    const volume = Number(game.settings.get('core', 'globalInterfaceVolume') ?? 0.5)
    Promise.resolve(foundry.audio.AudioHelper.play({ src, volume, autoplay: true, loop: false }, false))
      .then((played: any) => (sound = played))
      .catch((error: unknown) => console.warn('CrawlSpace | boss battle sound', error))
  } catch (error) {
    console.warn('CrawlSpace | boss battle sound', error)
  }
}

export function registerBossBattle() {
  game.settings.register('crawlspace', 'bossBattleSound', {
    name: 'CRAWLSPACE.BossBattle.Sound',
    hint: 'CRAWLSPACE.BossBattle.SoundHint',
    scope: 'world',
    config: true,
    type: new foundry.data.fields.FilePathField({ categories: ['AUDIO'], blank: true, initial: '' }),
  })
  Hooks.on('getSceneControlButtons', (controls: any) => {
    const tokens = controls.tokens
    if (!tokens?.tools || !game.user.isGM) return
    tokens.tools.crawlBossBattle = {
      name: 'crawlBossBattle',
      order: Object.keys(tokens.tools).length + 1,
      title: 'CRAWLSPACE.BossBattle.Button',
      icon: 'fa-solid fa-skull-crossbones',
      button: true,
      visible: game.user.isGM,
      onChange: () => startBossBattle(),
    }
  })
  Hooks.once('ready', () => {
    game.socket.on(CHANNEL, (message: any) => {
      if (message?.type === 'bossBattle') showBossBattle(cleanBattle(message.battle))
      else if (message?.type === 'bossBattleEnd') {
        sound?.stop?.()
        closeBossBattle()
      }
    })
  })
}
