/**
 * Boss battle intro. The GM presses the button in the token controls (or calls game.crawlspace.startBossBattle);
 * every client dims the screen, shows the party's headshots facing the enemies' across a "VS.", and plays the
 * sound bite set in the system settings (nothing plays while it is blank).
 *
 * Enemies are the GM's selected tokens that aren't in the party; with none selected, the current combat's
 * visible hostile combatants. Anyone can close the overlay for themselves (click or Escape); when the GM closes
 * it, it closes for everyone. It also fades out on its own after a while.
 */
import { partyCrawlers } from '../actors/party'
import { followersOf } from '../actors/companions'
import { bossBattleEnemies, cleanBattle, soundSource, type BattleToken, type Fighter } from '../rules/boss-battle'
import { headshotOf } from '../rules/headshot'

const CHANNEL = 'system.crawlspace'
const OVERLAY_ID = 'crawl-boss-battle'
/** How long the overlay stays before fading by itself. */
const SHOW_MS = 12000

const t = (key: string) => game.i18n.localize(`CRAWLSPACE.BossBattle.${key}`)
const esc = (text: string) => foundry.utils.escapeHTML(text)

let closeTimer: number | undefined
let sound: any = null

/** The actor's headshot (headshot-maker.ts), else its portrait, else the token art. */
const headshot = (actor: any, tokenImg: unknown) => headshotOf({ headshot: actor?.getFlag?.('crawlspace', 'headshot'), portrait: actor?.img, token: tokenImg })

function gatherBattle() {
  const crawlers = partyCrawlers()
  const party = crawlers.flatMap((actor: any) => [actor.uuid, ...followersOf(actor).map((follower: any) => follower.uuid)])
  const selected: BattleToken[] = (canvas?.tokens?.controlled ?? []).map((token: any) => ({
    id: token.document.id,
    actorUuid: token.actor?.uuid,
    name: token.document.name,
    img: headshot(token.actor, token.document.texture?.src),
    disposition: token.document.disposition,
  }))
  const combatants: BattleToken[] = (game.combat?.combatants?.contents ?? [])
    .filter((combatant: any) => !combatant.hidden && !combatant.token?.hidden)
    .map((combatant: any) => ({
      id: combatant.tokenId ?? combatant.id,
      actorUuid: combatant.actor?.uuid,
      name: combatant.token?.name ?? combatant.name,
      img: headshot(combatant.actor, combatant.token?.texture?.src ?? combatant.img),
      disposition: combatant.token?.disposition ?? 0,
    }))
  const enemies: Fighter[] = bossBattleEnemies({ selected, combatants, party }).map(({ name, img }) => ({ name, img }))
  return {
    crawlers: crawlers.map((actor: any) => ({ name: actor.name, img: headshot(actor, actor.prototypeToken?.texture?.src) })),
    enemies,
  }
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

const side = (fighters: Fighter[], kind: string) =>
  `<div class="boss-side ${kind}">${fighters
    .map((fighter, index) => `<figure style="--i: ${index}"><img src="${esc(fighter.img)}" alt=""><figcaption>${esc(fighter.name)}</figcaption></figure>`)
    .join('')}</div>`

function showBossBattle(battle: { crawlers: Fighter[]; enemies: Fighter[] }) {
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
