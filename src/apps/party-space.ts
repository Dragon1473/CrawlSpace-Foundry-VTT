/**
 * The party screen's Conjoined Space tab (apps/party-screen.ts): each conjoined Personal Space a party crawler
 * belongs to, read-only. Its Level and the spaces it came from, members (who is there now), what it does for a
 * crawler inside, upgrades with their owners, crafting tables with tiers and attachments, and its description. The
 * space's own sheet (actors/personal-space.ts) is where it is changed.
 */
import { CONJOIN_COST, LEVEL_INFO, conjoinUnions, ownerLevels } from '../rules/personal-space'
import { benefitLinesOf, currentSpace, isSpace, membersOf, ownerOf, spacesEnabled } from '../actors/personal-space'
import { craftCategories } from '../actors/crafting'

const t = (key: string, data?: Record<string, unknown>) =>
  data ? game.i18n.format(`CRAWLSPACE.Space.${key}`, data) : game.i18n.localize(`CRAWLSPACE.Space.${key}`)
const gold = (value: number) => Math.floor(Number(value) || 0).toLocaleString()

/** The conjoined spaces any of these crawlers belongs to. */
export function conjoinedSpacesOf(crawlers: any[]) {
  if (!spacesEnabled()) return []
  const uuids = new Set(crawlers.map((crawler) => crawler.uuid))
  return game.actors.filter((actor: any) => isSpace(actor) && actor.system.conjoinedLevel !== null && membersOf(actor).some((member) => uuids.has(member.uuid)))
}

const nameOf = (uuid: string) => (uuid ? (fromUuidSync(uuid)?.name ?? t('Missing')) : t('SpaceOwned'))

/** One space as the party screen shows it. */
export async function spaceOverview(space: any) {
  const system = space.system
  const members = membersOf(space)
  const items = space.items.contents
  const tables = items.filter((item: any) => item.type === 'craftingTable')
  const info = LEVEL_INFO[system.level] ?? LEVEL_INFO[1]
  const unions = conjoinUnions(members)
  return {
    id: space.id,
    uuid: space.uuid,
    name: space.name,
    img: space.img,
    canOpen: !!space.visible,
    level: system.level,
    locked: !!system.levelLocked,
    levels: ownerLevels(members).sort((a, b) => b - a).join(' + '),
    levelHint: t('LevelHint', { price: gold(info.price), tables: info.tables }),
    conjoined: unions ? t('Conjoined', { unions, cost: gold(unions * CONJOIN_COST) }) : '',
    benefits: benefitLinesOf(space),
    members: members.map((member) => {
      const crawler = fromUuidSync(member.uuid)
      return {
        name: crawler?.name ?? t('Missing'),
        img: crawler?.prototypeToken?.texture?.src || crawler?.img || 'icons/svg/mystery-man.svg',
        role: t(`Role.${member.role}`),
        brought: member.role === 'owner' && member.spaceLevel ? t('BroughtN', { level: member.spaceLevel }) : '',
        here: crawler ? currentSpace(crawler) === space : false,
      }
    }),
    upgrades: items
      .filter((item: any) => item.type === 'spaceUpgrade')
      .sort((a: any, b: any) => a.system.tier - b.system.tier || a.name.localeCompare(b.name))
      .map((item: any) => ({
        id: item.id,
        name: item.name,
        img: item.img,
        tier: item.system.tier ? t('TierN', { tier: item.system.tier }) : '',
        category: item.system.category,
        summary: item.system.summary,
        homebrew: item.system.status === 'homebrew',
        installed: item.system.installed,
        owner: nameOf(ownerOf(item)),
        attachedTo: item.system.attachedTo ? (space.items.get(item.system.attachedTo)?.name ?? '') : '',
      })),
    tables: tables.map((item: any) => ({
      id: item.id,
      name: item.name,
      img: item.img,
      tier: t('TierN', { tier: Math.floor(Number(item.system.tier) || 1) }),
      category: craftCategories().find((category) => category.id === item.system.category)?.label ?? item.system.category,
      upgrades: item.system.upgrades ?? [],
      broken: !!item.system.broken,
      owner: nameOf(ownerOf(item)),
    })),
    tableCount: `${tables.length}/${info.tables}`,
    description: await foundry.applications.ux.TextEditor.implementation.enrichHTML(system.description ?? '', { secrets: space.isOwner, relativeTo: space }),
  }
}
