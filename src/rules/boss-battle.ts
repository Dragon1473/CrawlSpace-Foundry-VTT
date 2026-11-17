/** Boss battle intro: who stands on each side, grouped by party, and what travels to the other clients. Pure module. */
export type BattleToken = { id: string; actorUuid?: string; name: string; img: string; disposition: number; crawler?: boolean; boss?: boolean; party?: string; level?: number | null }
export type Fighter = { name: string; img: string; level: number | null }
/** `lead`: the side's bosses, shown above the other groups and centred over them. */
export type FighterGroup = { name: string; fighters: Fighter[]; lead?: boolean }
export type BattleSide = FighterGroup[]

/** Each side shows at most this many headshots, and this many groups. */
export const BATTLE_SIDE_MAX = 12
export const BATTLE_GROUP_MAX = 8
const HOSTILE = -1
const FRIENDLY = 1

const once = <T extends { id: string }>(list: T[]) => {
  const seen = new Set<string>()
  return list.filter((token) => !seen.has(token.id) && !!seen.add(token.id))
}

/**
 * The two sides.
 * Enemies: the GM's selected tokens that are neither in the player party nor friendly; with none, the combat's
 * hostile combatants.
 * Allies: the player party, then other crawlers that aren't enemies — friendly selected crawlers, and
 * non-hostile crawlers in the combat.
 */
export function battleSides({ party, selected, combatants, friends = [] }: { party: BattleToken[]; selected: BattleToken[]; combatants: BattleToken[]; friends?: string[] }) {
  // Friends (the party's pets, mounts and minions) never count as enemies, but don't get a headshot either.
  const members = new Set([...party.map((member) => member.actorUuid), ...friends])
  const outside = (token: BattleToken) => !members.has(token.actorUuid)
  const picked = selected.filter((token) => outside(token) && token.disposition !== FRIENDLY)
  const enemies = once(picked.length ? picked : combatants.filter((token) => outside(token) && token.disposition === HOSTILE)).slice(0, BATTLE_SIDE_MAX)
  const foes = new Set(enemies.map((token) => token.actorUuid ?? token.id))
  const crawlerAllies = [...selected, ...combatants].filter(
    (token) => token.crawler && outside(token) && token.disposition !== HOSTILE && !foes.has(token.actorUuid ?? token.id),
  )
  // A crawler's several tokens (or a token that is selected and in the combat) count once.
  const seenActors = new Set<string>()
  const allies = [...party, ...crawlerAllies]
    .filter((token) => {
      const key = token.actorUuid ?? token.id
      return !seenActors.has(key) && !!seenActors.add(key)
    })
    .slice(0, BATTLE_SIDE_MAX)
  return { allies, enemies }
}

/**
 * Banners for one side: bosses first in a lead group of their own, crawlers under their party's name (Solo when
 * they have none), other creatures in an unnamed group. Groups keep the order their first member appears in, except that Solo comes last.
 */
export function groupFighters(tokens: BattleToken[], solo: string): BattleSide {
  const groups = new Map<string, FighterGroup>()
  const lead: FighterGroup = { name: '', fighters: [], lead: true }
  for (const token of tokens) {
    const fighter = { name: token.name, img: token.img, level: level(token.level) }
    if (token.boss) {
      lead.fighters.push(fighter)
      continue
    }
    const name = token.crawler ? token.party?.trim() || solo : ''
    if (!groups.has(name)) groups.set(name, { name, fighters: [] })
    groups.get(name)!.fighters.push(fighter)
  }
  const list = [...groups.values()]
  return [...(lead.fighters.length ? [lead] : []), ...list.filter((group) => group.name !== solo), ...list.filter((group) => group.name === solo)]
}

const level = (value: unknown) => (value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Math.max(0, Math.floor(Number(value))))
const text = (value: unknown) => (typeof value === 'string' ? value : '')
const records = (list: unknown) => (Array.isArray(list) ? list : []).filter((entry): entry is Record<string, any> => !!entry && typeof entry === 'object')

/** Keep only names, pictures and levels from a battle received over the socket. */
export function cleanBattle(payload: any): { crawlers: BattleSide; enemies: BattleSide } {
  const side = (list: unknown) => {
    let room = BATTLE_SIDE_MAX
    return records(list)
      .slice(0, BATTLE_GROUP_MAX)
      .map((group) => {
        const fighters = records(group.fighters)
          .slice(0, Math.max(0, room))
          .map((fighter) => ({ name: text(fighter.name), img: text(fighter.img), level: level(fighter.level) }))
        room -= fighters.length
        return { name: text(group.name), fighters, ...(group.lead === true ? { lead: true } : {}) }
      })
      .filter((group) => group.fighters.length)
  }
  return { crawlers: side(payload?.crawlers), enemies: side(payload?.enemies) }
}

/** The boss battle sound bite that ships with the system. */
export const BOSS_BATTLE_SOUND = 'systems/crawlspace/assets/sounds/boss-battle.mp3'

/** The sound bite to play: the one set in the settings, else the bundled one; null when sound bites are off. */
export const soundSource = (path: unknown, enabled: boolean) => (!enabled ? null : typeof path === 'string' && path.trim() ? path.trim() : BOSS_BATTLE_SOUND)
