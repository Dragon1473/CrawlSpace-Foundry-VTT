/**
 * Items that open documents to whoever holds them (a Borough Field Guide opens its journal). An item lists the uuids
 * it grants in flags.crawlspace.grants; while any actor a player owns holds such an item, that player can view the
 * document. Access given this way is taken back when they no longer hold one; access the GM gave by hand is left alone.
 * The active GM's client does the updates.
 */
export const GRANTS_FLAG = 'grants'
const GRANTED_FLAG = 'grantedTo'

const grantsOf = (item: any): string[] => item?.getFlag?.('crawlspace', GRANTS_FLAG) ?? []

/** Players (not GMs) who own an actor holding an item that grants `uuid`. */
export function holders(uuid: string, actors: any[], users: any[]) {
  const ids = new Set<string>()
  for (const actor of actors) {
    if (!actor.items.some((item: any) => grantsOf(item).includes(uuid))) continue
    for (const user of users) if (!user.isGM && actor.testUserPermission(user, 'OWNER')) ids.add(user.id)
  }
  return ids
}

/** Gives and takes back view access to one granted document. */
export async function refreshGrant(uuid: string) {
  const document = await fromUuid(uuid).catch(() => null)
  if (!document) return
  const { OBSERVER, INHERIT } = CONST.DOCUMENT_OWNERSHIP_LEVELS
  const users = holders(uuid, game.actors.contents, game.users.contents)
  const before: string[] = document.getFlag('crawlspace', GRANTED_FLAG) ?? []
  const granted = new Set(before.filter((id) => users.has(id)))
  const update: Record<string, unknown> = {}
  for (const id of users)
    if ((document.ownership[id] ?? INHERIT) < OBSERVER) {
      update[`ownership.${id}`] = OBSERVER
      granted.add(id)
    }
  for (const id of before) if (!users.has(id)) update[`ownership.${id}`] = INHERIT
  const list = [...granted].sort()
  if (JSON.stringify(list) !== JSON.stringify([...before].sort())) update[`flags.crawlspace.${GRANTED_FLAG}`] = list
  if (Object.keys(update).length) await document.update(update)
}

export function registerGrants() {
  const refreshItem = (item: any) => {
    if (!game.user.isActiveGM || item.parent?.documentName !== 'Actor') return
    for (const uuid of grantsOf(item)) refreshGrant(uuid).catch((error) => console.error('CrawlSpace | grant', error))
  }
  Hooks.on('createItem', refreshItem)
  Hooks.on('deleteItem', refreshItem)
  Hooks.on('updateItem', (item: any, changes: any) => foundry.utils.hasProperty(changes, `flags.crawlspace.${GRANTS_FLAG}`) && refreshItem(item))
  // A crawler changing hands changes who holds its items.
  Hooks.on('updateActor', (actor: any, changes: any) => {
    if (!('ownership' in changes)) return
    for (const item of actor.items) refreshItem(item)
  })
}
