/**
 * Gear sets (homebrew): a GM names the pieces of a set and gives it bonuses, each an ActiveEffect that needs some
 * number of pieces equipped. A crawler wearing enough pieces gets those effects. Pieces are matched by name, so
 * every copy of an item (compendium, world, a crawler's) counts. Pure module.
 */

export type SetMember = { name: string; uuid?: string; img?: string }

/** The bonus needs at least this many pieces; unset means 2. */
export const DEFAULT_PIECES = 2

export const pieceKey = (name: string) => String(name ?? '').trim().toLowerCase()

/** Pieces needed for one bonus, at least 1. */
export const piecesFor = (value: unknown) => Math.max(1, Math.floor(Number(value) || DEFAULT_PIECES))

/** How many of the set's distinct pieces are equipped (two of the same ring count once). */
export function equippedPieces(members: SetMember[], items: Iterable<{ name: string; system?: any }>) {
  const wanted = new Set(members.map((member) => pieceKey(member.name)).filter(Boolean))
  const worn = new Set<string>()
  for (const item of items) {
    const key = pieceKey(item.name)
    if (wanted.has(key) && item.system?.equipped && !item.system?.broken) worn.add(key)
  }
  return worn.size
}

/** Whether the item is one of the set's pieces. */
export const isPiece = (members: SetMember[], name: string) => members.some((member) => pieceKey(member.name) === pieceKey(name))

/** The bonuses (by their effect ids) that this many pieces turn on. */
export function activeBonuses<T extends { id: string; pieces: number; disabled?: boolean }>(bonuses: T[], equipped: number) {
  return bonuses.filter((bonus) => !bonus.disabled && equipped >= piecesFor(bonus.pieces))
}

/** A member list with one more piece; a name already there is left alone. */
export function addMember(members: SetMember[], member: SetMember) {
  if (!member.name?.trim() || isPiece(members, member.name)) return members
  return [...members, { name: member.name.trim(), uuid: member.uuid ?? '', img: member.img ?? '' }]
}
