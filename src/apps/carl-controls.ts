/**
 * The CarlRPG scene-control group: CrawlSpace's windows in one place in the left column, under Journal and a
 * divider. Every tool is a button, and the group has no canvas layer, so opening it keeps the current layer.
 */
import { CARL_TOOLS, type CarlTool } from '../rules/upkeep-roster'
import { openPartyScreen } from './party-screen'
import { openUpkeep } from './upkeep'
import { openCraftingFor } from './crafting'
import { leaderboardApi, leaderboardToolsOn, openLeaderboard } from './leaderboard'
import { openTime } from './time'
import { RaceApp } from './race'
import { startBossBattle } from './boss-battle'
import { encounterTunerOn, openEncounterTuner } from './encounter-tuner'

export const CARL_CONTROL = 'crawlspace'

type ToolSpec = { title: string; icon: string; visible: () => boolean; open: () => unknown }

const TOOLS: Record<CarlTool, ToolSpec> = {
  partyScreen: { title: 'CRAWLSPACE.PartyScreen.Open', icon: 'fa-solid fa-users-viewfinder', visible: () => true, open: () => openPartyScreen() },
  upkeep: { title: 'CRAWLSPACE.Upkeep.Party', icon: 'fa-solid fa-campground', visible: () => true, open: () => openUpkeep() },
  crafting: { title: 'CRAWLSPACE.Craft.Title', icon: 'fa-solid fa-hammer', visible: () => true, open: () => openCraftingFor() },
  // Players see the leaderboard only while the GM shows it.
  leaderboard: { title: 'CRAWLSPACE.Leaderboard.Title', icon: 'fa-solid fa-ranking-star', visible: () => leaderboardToolsOn() && (game.user.isGM || !!leaderboardApi.get().visible), open: () => openLeaderboard() },
  timers: { title: 'CRAWLSPACE.Time.Title', icon: 'fa-solid fa-hourglass-half', visible: () => game.user.isGM, open: () => openTime() },
  race: { title: 'CRAWLSPACE.Race.Title', icon: 'fa-solid fa-flag-checkered', visible: () => game.user.isGM, open: () => RaceApp.open() },
  bossBattle: { title: 'CRAWLSPACE.BossBattle.Button', icon: 'fa-solid fa-skull-crossbones', visible: () => game.user.isGM, open: () => startBossBattle() },
  encounterTuner: { title: 'CRAWLSPACE.Encounter.Title', icon: 'fa-solid fa-scale-balanced', visible: () => game.user.isGM && encounterTunerOn(), open: () => openEncounterTuner() },
}

export function registerCarlControls() {
  Hooks.on('getSceneControlButtons', (controls: any) => {
    const tools: Record<string, any> = {}
    CARL_TOOLS.forEach((name, index) => {
      const spec = TOOLS[name]
      if (!spec.visible()) return
      tools[name] = { name, order: index + 1, title: spec.title, icon: spec.icon, button: true, visible: true, onChange: () => spec.open() }
    })
    // Right after Journal, ahead of any control a module adds later.
    const notes = Number(controls.notes?.order)
    const order = Math.max(Number.isFinite(notes) ? notes : 0, ...Object.values(controls).map((control: any) => Number(control.order) || 0)) + 1
    controls[CARL_CONTROL] = { name: CARL_CONTROL, order, title: 'CRAWLSPACE.CarlControls', icon: 'fa-solid fa-dice-d20', tools }
  })
  // The divider between Journal and the CarlRPG group.
  Hooks.on('renderSceneControls', (_app: any, html: HTMLElement) => {
    const item = html.querySelector(`[data-control="${CARL_CONTROL}"]`)?.closest('li')
    if (!item || item.previousElementSibling?.classList.contains('crawlspace-separator')) return
    html.querySelectorAll('.crawlspace-separator').forEach((element) => element.remove())
    const separator = document.createElement('li')
    separator.className = 'crawlspace-separator'
    separator.setAttribute('role', 'separator')
    item.before(separator)
  })
}
