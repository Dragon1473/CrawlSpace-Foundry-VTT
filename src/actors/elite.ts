/**
 * Elites, and mobs that act once per crawler. An Elite looks like any other mob on the minimap until the GM reveals
 * it from its token's HUD (right-click the token): then it's a cross. The reveal is kept on the token, so each
 * placed Elite is revealed on its own.
 */
import { actsPerCrawler } from '../rules/mob-kinds'
import { combatantSide } from '../combat/combat'
import { partyCrawlers } from './party'
import { isCrawler } from '../rules/party'

const t = (key: string) => game.i18n.localize(`CRAWLSPACE.Elite.${key}`)

/** Whether this token's Elite has been revealed. */
export const eliteRevealed = (tokenDocument: any) => !!tokenDocument?.getFlag?.('crawlspace', 'eliteRevealed')

/**
 * The crawlers a mob faces: those in its combat when it's in one, else the players' party (at least one).
 */
export function mobCrawlerCount(actor: any, combat: any = game.combat) {
  const inCombat = combat?.combatants?.find?.((combatant: any) => combatant.actor === actor || (actor?.isToken ? combatant.tokenId === actor.token?.id : combatant.actorId === actor?.id))
  if (inCombat) {
    const crawlers = combat.combatants.filter((combatant: any) => !combatant.defeated && combatantSide(combatant) === 'crawler' && isCrawler(combatant.actor))
    if (crawlers.length) return crawlers.length
  }
  return Math.max(1, partyCrawlers().length)
}

async function toggleReveal(tokenDocument: any) {
  const revealed = !eliteRevealed(tokenDocument)
  await tokenDocument.setFlag('crawlspace', 'eliteRevealed', revealed)
  ui.notifications.info(revealed ? t('Revealed') : t('Hidden'))
}

export function registerElites() {
  // The GM's token HUD gets a "Reveal as Elite" button on Elite mobs.
  Hooks.on('renderTokenHUD', (hud: any, html: HTMLElement) => {
    const tokenDocument = hud.document ?? hud.object?.document
    const actor = tokenDocument?.actor
    if (!game.user.isGM || !actor?.system?.elite) return
    const column = (html instanceof HTMLElement ? html : (html as any)[0])?.querySelector?.('.col.right')
    if (!column || column.querySelector('[data-crawl-elite]')) return
    const revealed = eliteRevealed(tokenDocument)
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `control-icon${revealed ? ' active' : ''}`
    button.dataset.crawlElite = ''
    const label = revealed ? t('Hide') : t('Reveal')
    button.dataset.tooltip = label
    button.setAttribute('aria-label', label)
    button.innerHTML = '<i class="fa-solid fa-crown"></i>'
    button.addEventListener('click', async (event) => {
      event.preventDefault()
      event.stopPropagation()
      await toggleReveal(tokenDocument)
      hud.render?.()
    })
    column.append(button)
  })
}

export { actsPerCrawler }
