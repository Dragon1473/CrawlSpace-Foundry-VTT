/** Boss battle intro: who stands on each side, and what travels to the other clients. Pure module. */
export type BattleToken = { id: string; actorUuid?: string; name: string; img: string; disposition: number }
export type Fighter = { name: string; img: string }

/** Each side shows at most this many headshots. */
export const BATTLE_SIDE_MAX = 12
const HOSTILE = -1

/**
 * The enemies: the GM's selected tokens when any of them is not in the party, otherwise the combat's hostile
 * combatants. Party crawlers never count, and each token appears once.
 */
export function bossBattleEnemies({ selected, combatants, party }: { selected: BattleToken[]; combatants: BattleToken[]; party: string[] }) {
  const outside = (token: BattleToken) => !party.includes(token.actorUuid ?? '')
  const picked = selected.filter(outside)
  const list = picked.length ? picked : combatants.filter((token) => outside(token) && token.disposition === HOSTILE)
  const seen = new Set<string>()
  return list.filter((token) => !seen.has(token.id) && !!seen.add(token.id)).slice(0, BATTLE_SIDE_MAX)
}

const fighters = (list: unknown) =>
  (Array.isArray(list) ? list : [])
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
    .slice(0, BATTLE_SIDE_MAX)
    .map((entry) => ({ name: typeof entry.name === 'string' ? entry.name : '', img: typeof entry.img === 'string' ? entry.img : '' }))

/** Keep only names and pictures from a battle received over the socket. */
export function cleanBattle(payload: any): { crawlers: Fighter[]; enemies: Fighter[] } {
  return { crawlers: fighters(payload?.crawlers), enemies: fighters(payload?.enemies) }
}

/** The sound bite's path, or null when none is set. */
export const soundSource = (path: unknown) => (typeof path === 'string' && path.trim() ? path.trim() : null)
