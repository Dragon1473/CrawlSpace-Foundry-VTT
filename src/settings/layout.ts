/**
 * Configure Settings: the CrawlSpace settings (the System tab) sit in titled boxes, like core's User Interface
 * settings, instead of one long list. The rows are Foundry's own, only moved, so saving works as before.
 */
import { groupSettings } from './groups'

const SETTING_PREFIX = 'crawlspace.'

export function registerSettingsLayout() {
  Hooks.on('renderSettingsConfig', (_app: any, html: HTMLElement) => {
    const section = html.querySelector<HTMLElement>('section[data-tab="system"]')
    if (!section || section.querySelector('.crawl-settings-group')) return
    const rows = new Map<string, HTMLElement>()
    for (const row of section.querySelectorAll<HTMLElement>(':scope > .form-group')) {
      // Settings carry their key as the input's name; a menu (a button) carries it as data-key.
      const name =
        row.querySelector<HTMLElement>(`[name^="${SETTING_PREFIX}"]`)?.getAttribute('name') ?? row.querySelector<HTMLElement>(`[data-key^="${SETTING_PREFIX}"]`)?.dataset.key
      if (name) rows.set(name.slice(SETTING_PREFIX.length), row)
    }
    if (!rows.size) return
    for (const group of groupSettings([...rows.keys()])) {
      const box = document.createElement('fieldset')
      box.className = 'crawl-settings-group'
      const legend = document.createElement('legend')
      legend.textContent = game.i18n.localize(`CRAWLSPACE.Settings.Group.${group.id}`)
      box.append(legend, ...group.keys.map((key) => rows.get(key)!))
      section.append(box)
    }
  })
}
