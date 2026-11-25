/**
 * Tooltip hover delay. Foundry waits TOOLTIP_ACTIVATION_MS before showing a tooltip and the same time before hiding
 * one, so a longer wait would also leave tooltips hanging. This manager waits the player's chosen delay to show a
 * tooltip and hides it quickly; moving between tooltipped elements while one is open still switches at once.
 */
const HIDE_MS = 100

export function registerTooltipDelay() {
  game.settings.register('crawlspace', 'tooltipDelay', {
    name: 'CRAWLSPACE.Settings.TooltipDelay',
    hint: 'CRAWLSPACE.Settings.TooltipDelayHint',
    scope: 'client',
    config: true,
    type: Number,
    range: { min: 0, max: 3000, step: 250 },
    default: 1000,
  })
  const Base = foundry.helpers.interaction.TooltipManager
  class CrawlTooltipManager extends Base {
    // Read by Foundry for both the show and the hide timer: nothing shown yet means it is a show.
    static get TOOLTIP_ACTIVATION_MS() {
      if (game.tooltip?.element) return HIDE_MS
      const delay = Number(game.settings?.get('crawlspace', 'tooltipDelay'))
      return Number.isFinite(delay) ? Math.max(0, Math.floor(delay)) : 1000
    }
  }
  CONFIG.ux.TooltipManager = CrawlTooltipManager
}
