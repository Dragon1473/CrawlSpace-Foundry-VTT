/**
 * Token effect icons as round badges around the token (rules/token-badges.ts), instead of Foundry's square grid down
 * the left side: each icon is clipped to a circle on a dark-blue disc with a light rim. The overlay effect (a big
 * icon over the whole token, such as Dead) stays as Foundry draws it.
 */
import { badgeLayout, badgeSize } from '../rules/token-badges'

const DISC = 0x0b2a4e
const RIM = 0xd8ecff
/** The icon's share of the badge. */
const ICON = 0.78

type Badge = { crawlBadge: { disc: any; icon: any; mask: any } } & Record<string, any>

export function createCrawlToken(Base: any) {
  return class CrawlToken extends Base {
    /** One badge: the disc, the icon and the circle it's clipped to. */
    async _drawEffect(src: string, tint: any) {
      if (!src) return
      const texture = await foundry.canvas.loadTexture(src, { fallback: 'icons/svg/hazard.svg' })
      if (!texture) return
      const badge: any = new PIXI.Container()
      const disc = new PIXI.Graphics()
      const icon = new PIXI.Sprite(texture)
      icon.anchor.set(0.5, 0.5)
      icon.tint = tint ?? 0xffffff
      const mask = new PIXI.Graphics()
      icon.mask = mask
      badge.addChild(disc, icon, mask)
      badge.crawlBadge = { disc, icon, mask }
      return this.effects.addChild(badge)
    }

    /** The overlay is still Foundry's plain sprite over the token. */
    async _drawOverlay(src: string, tint: any) {
      const icon = await Base.prototype._drawEffect.call(this, src, tint)
      if (icon) icon.alpha = 0.8
      this.effects.overlay = icon ?? null
      return icon
    }

    _refreshEffects() {
      const { width, height } = this.document.getSize()
      const badges = this.effects.children.filter((child: any) => (child as Badge).crawlBadge) as Badge[]
      this.effects.bg?.clear()
      const size = badgeSize(width, height, 14 * (canvas.dimensions.uiScale ?? 1))
      const spots = badgeLayout(badges.length, width, height, size)
      const line = Math.max(1, size * 0.07)
      badges.forEach((badge, index) => {
        const { disc, icon, mask } = badge.crawlBadge
        badge.position.set(spots[index].x, spots[index].y)
        disc.clear().beginFill(DISC, 0.95).lineStyle(line, RIM, 1).drawCircle(0, 0, size / 2 - line / 2).endFill()
        const inner = size * ICON
        icon.width = icon.height = inner
        mask.clear().beginFill(0xffffff).drawCircle(0, 0, inner / 2).endFill()
      })
      const overlay = this.effects.overlay
      if (overlay) {
        const edge = Math.min(width * 0.6, height * 0.6)
        overlay.width = overlay.height = edge
        overlay.position = this.document.getCenterPoint({ x: 0, y: 0 })
        overlay.anchor.set(0.5, 0.5)
      }
    }
  }
}
