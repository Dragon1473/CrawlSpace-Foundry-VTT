/**
 * The Journal tab's Atlas Journals menu: start a neighborhood (the builder, or a blank one), or a new borough, city,
 * province, country or floor. Each tier holds the ones below it, and CrawlSpace Atlas lays out their maps.
 */
import { esc, t, TIER_ICONS } from './fields'
import { REGION_TIERS } from './model'
import { NeighborhoodBuilder, createBlank } from './sheets'

const { ApplicationV2 } = foundry.applications.api

export class AtlasMapsMenu extends ApplicationV2 {
  static DEFAULT_OPTIONS: any = {
    id: 'crawlspace-atlas-maps',
    classes: ['crawlspace', 'crawl-atlas-maps'],
    position: { width: 340, height: 'auto' },
    window: { icon: 'fa-solid fa-map-location-dot', title: 'CRAWLSPACE.Journal.AtlasMaps' },
  }

  static open() {
    const known = foundry.applications.instances.get('crawlspace-atlas-maps') as AtlasMapsMenu | undefined
    if (known) return known.bringToFront?.() ?? known.render({ force: true })
    return new AtlasMapsMenu().render({ force: true })
  }

  async _renderHTML() {
    const button = (action: string, icon: string, label: string, hint: string) =>
      `<button type="button" data-atlas-new="${action}"><i class="${icon}"></i><span><strong>${esc(label)}</strong><small>${esc(hint)}</small></span></button>`
    return `<section><h3>${esc(t('Tier.neighborhood'))}</h3>
        ${button('builder', TIER_ICONS.neighborhood, t('NewNeighborhood'), t('MenuHint.builder'))}
        ${button('neighborhood', 'fa-regular fa-file', t('BlankNeighborhood'), t('MenuHint.blank'))}</section>
      <section><h3>${esc(t('MapTiers'))}</h3>
        ${REGION_TIERS.map((tier) => button(tier, TIER_ICONS[tier], t(`New.${tier}`), t(`MenuHint.${tier}`))).join('')}</section>`
  }

  _replaceHTML(html: string, content: HTMLElement) {
    content.innerHTML = html
    content.querySelectorAll<HTMLElement>('[data-atlas-new]').forEach((button) =>
      button.addEventListener('click', async (event) => {
        event.preventDefault()
        const kind = button.dataset.atlasNew as any
        await this.close()
        if (kind === 'builder') new NeighborhoodBuilder().render({ force: true })
        else await createBlank(kind)
      }),
    )
  }
}
