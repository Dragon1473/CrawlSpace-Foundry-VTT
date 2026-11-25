/**
 * Automated Animations (autoanimations) support. The module's generic chat-message path finds the acting token by the
 * item's id across every token on the scene; copied crawlers share item ids, so it picks the wrong token or throws
 * when none is selected. CrawlSpace hands it the token, item and targets itself instead, and its cards carry no item
 * reference for that path to find (so nothing plays twice).
 */
import { speakerFor } from '../dice/rolls'

/** The acting token on the viewed scene: the card's speaker token, else any of the actor's tokens here. */
function actingToken(actor: any) {
  const speaker = speakerFor(actor)
  if (speaker.scene && speaker.scene !== canvas?.scene?.id) return null
  return (speaker.token && canvas?.tokens?.get(speaker.token)) || actor?.getActiveTokens?.()?.[0] || null
}

/**
 * Play the item's animation from the actor's token at the user's targets. `hitTargets` (token placeables) marks
 * which targets were hit, for animations set to show misses.
 */
export function playItemAnimation(actor: any, item: any, options: { hitTargets?: any[] } = {}) {
  const api = (globalThis as any).AutomatedAnimations
  if (!item || !api?.playAnimation || !game.modules.get('autoanimations')?.active || !canvas?.ready) return
  const token = actingToken(actor)
  if (!token) return
  const targets = [...game.user.targets]
  Promise.resolve(api.playAnimation(token, item, { targets, ...(options.hitTargets ? { hitTargets: options.hitTargets } : {}) })).catch((error: unknown) =>
    console.warn('CrawlSpace | Automated Animations', error),
  )
}
