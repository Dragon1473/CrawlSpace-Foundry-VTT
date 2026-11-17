/**
 * A crawler's Kills window, opened from the sheet: each kind of kill (floor boss down to crawlers) with − and +
 * buttons around its count. The counts are the skulls and stars beside the crawler's name in the frames.
 */
import { ActorPopup } from './actions-config'
import { KILL_KINDS, stepKill, type KillKey } from '../rules/crawler-marks'

export class KillsApp extends ActorPopup {
  static DEFAULT_OPTIONS: any = {
    classes: ['crawlspace', 'crawl-kills'],
    position: { width: 320, height: 'auto' },
    window: { icon: 'fa-solid fa-skull' },
    actions: { step: KillsApp.#onStep },
  }

  static PARTS = { main: { template: 'systems/crawlspace/templates/apps/kills.hbs' } }

  static open(actor: any) {
    const id = `crawl-kills-${actor.uuid.replace(/\./g, '-')}`
    const app = (foundry.applications.instances.get(id) as KillsApp | undefined) ?? new KillsApp(actor, { id })
    return app.render({ force: true })
  }

  get title() {
    return game.i18n.format('CRAWLSPACE.Marks.WindowTitle', { name: this.actor.name })
  }

  async _prepareContext() {
    const kills = this.actor.system.kills ?? {}
    return {
      editable: this.editable,
      kinds: KILL_KINDS.map((kind) => ({
        ...kind,
        count: Number(kills[kind.key]) || 0,
        label: game.i18n.localize(`CRAWLSPACE.Marks.Kind.${kind.key}`),
      })),
    }
  }

  static async #onStep(this: KillsApp, _event: Event, target: HTMLElement) {
    if (!this.editable) return
    const key = target.closest<HTMLElement>('[data-kill]')?.dataset.kill as KillKey | undefined
    if (!key || !KILL_KINDS.some((kind) => kind.key === key)) return
    const next = stepKill(this.actor.system.kills?.[key], Number(target.dataset.delta) || 0)
    // The actor's update re-renders this window (ActorPopup is one of the actor's apps).
    await this.actor.update({ [`system.kills.${key}`]: next })
  }
}
