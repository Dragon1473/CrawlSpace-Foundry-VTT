/**
 * Gear sets in the world (homebrew; rules/gear-sets.ts). A set is a world item listing its pieces; its ActiveEffects
 * are the bonuses, each needing a number of pieces. An actor with enough pieces equipped gets a copy of each bonus it
 * has earned (as Personal Space upgrades hand out theirs), and loses it when a piece comes off. The copies show no
 * icon on the token or the crawler frames: they're the gear's doing, not conditions.
 */
import { activeBonuses, equippedPieces, isPiece, piecesFor, type SetMember } from '../rules/gear-sets'

export const SET_BONUS_FLAG = 'setBonus'
export const PIECES_FLAG = 'setPieces'

export const gearSetsEnabled = () => game.settings.get('crawlspace', 'gearSets') !== false

export function registerGearSetSetting() {
  game.settings.register('crawlspace', 'gearSets', {
    name: 'CRAWLSPACE.Settings.GearSets.Name',
    hint: 'CRAWLSPACE.Settings.GearSets.Hint',
    scope: 'world',
    config: true,
    restricted: true,
    type: Boolean,
    default: true,
    requiresReload: true,
  })
}

/** The world's gear sets. */
export const gearSets = (): any[] => (game.items ? game.items.filter((item: any) => item.type === 'gearSet') : [])

const membersOf = (set: any): SetMember[] => set?.system?.members ?? []

/** The sets an item is a piece of, and how many pieces its owner has on, for the item sheet. */
export function setsFor(item: any) {
  if (!gearSetsEnabled() || item?.type === 'gearSet') return []
  return gearSets()
    .filter((set) => isPiece(membersOf(set), item.name))
    .map((set) => {
      const equipped = item.actor ? equippedPieces(membersOf(set), item.actor.items) : 0
      return {
        name: set.name,
        uuid: set.uuid,
        equipped,
        total: membersOf(set).length,
        bonuses: set.effects
          .map((effect: any) => ({ name: effect.name, pieces: piecesFor(effect.getFlag('crawlspace', PIECES_FLAG)) }))
          .sort((a: any, b: any) => a.pieces - b.pieces)
          .map((bonus: any) => ({ ...bonus, earned: !!item.actor && equipped >= bonus.pieces })),
      }
    })
}

/** A bonus copy is current while its source effect hasn't changed since. */
const stampOf = (effect: any) => `${effect.uuid}@${effect._stats?.modifiedTime ?? 0}`

/** Gives the actor the set bonuses its equipped pieces earn, and takes away the rest. */
export async function syncSetBonuses(actor: any) {
  if (!actor?.items || !actor.isOwner) return
  const wanted = new Map<string, any>()
  if (gearSetsEnabled())
    for (const set of gearSets()) {
      const count = equippedPieces(membersOf(set), actor.items)
      if (!count) continue
      const bonuses: { id: string; effect: any; disabled: boolean; pieces: number }[] = set.effects.map((effect: any) => ({ id: effect.id, effect, disabled: effect.disabled, pieces: piecesFor(effect.getFlag('crawlspace', PIECES_FLAG)) }))
      for (const { effect } of activeBonuses(bonuses, count)) {
        const data = effect.toObject()
        delete data._id
        const stamp = stampOf(effect)
        wanted.set(stamp, { ...data, transfer: false, disabled: false, origin: set.uuid, showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON.NEVER, flags: { ...data.flags, crawlspace: { ...(data.flags?.crawlspace ?? {}), [SET_BONUS_FLAG]: stamp } } })
      }
    }
  const existing = actor.effects.filter((effect: any) => effect.getFlag('crawlspace', SET_BONUS_FLAG))
  // Copies made before set bonuses hid their icon are replaced too.
  const current = (effect: any) => wanted.has(effect.getFlag('crawlspace', SET_BONUS_FLAG)) && effect.showIcon === CONST.ACTIVE_EFFECT_SHOW_ICON.NEVER
  const stale = existing.filter((effect: any) => !current(effect))
  const have = new Set(existing.filter(current).map((effect: any) => effect.getFlag('crawlspace', SET_BONUS_FLAG)))
  const add = [...wanted.entries()].filter(([stamp]) => !have.has(stamp)).map(([, data]) => data)
  if (stale.length) await actor.deleteEmbeddedDocuments('ActiveEffect', stale.map((effect: any) => effect.id))
  if (add.length) await actor.createEmbeddedDocuments('ActiveEffect', add)
}

/** The active GM brings every actor up to date (a set or one of its bonuses changed). */
let resyncing: ReturnType<typeof setTimeout> | null = null
function resyncAll() {
  if (!game.user.isActiveGM) return
  if (resyncing) clearTimeout(resyncing)
  resyncing = setTimeout(async () => {
    resyncing = null
    // World actors, and the unlinked token actors on the viewed scene.
    const actors = [...game.actors, ...(canvas?.tokens?.placeables ?? []).map((token: any) => token.actor).filter((actor: any) => actor?.isToken)]
    for (const actor of new Set(actors))
      if (actor.items.some((item: any) => item.system?.equipped) || actor.effects.some((effect: any) => effect.getFlag('crawlspace', SET_BONUS_FLAG)))
        await syncSetBonuses(actor).catch((error) => console.error('CrawlSpace | gear set bonuses', error))
  }, 300)
}

/** Hides the Gear Set type from the Create dialog when the setting is off. */
function hideGearSetType() {
  if (gearSetsEnabled()) return
  const documentClass = CONFIG.Item.documentClass
  const original = documentClass.createDialog
  documentClass.createDialog = function (data: any = {}, createOptions: any = {}, options: any = {}, ...rest: any[]) {
    const types = options.types ?? this.TYPES.filter((entry: string) => entry !== 'gearSet' && entry !== CONST.BASE_DOCUMENT_TYPE)
    return original.call(this, data, createOptions, { ...options, types }, ...rest)
  }
}

export function registerGearSets() {
  hideGearSetType()
  // A piece put on, taken off, gained or lost: the user who did it updates the actor.
  const onActorItem = (item: any, changes: any, userId: string) => {
    const actor = item.parent
    if (!actor || actor.documentName !== 'Actor' || userId !== game.user.id) return
    if (changes && !['system.equipped', 'system.broken', 'name'].some((key) => foundry.utils.hasProperty(changes, key))) return
    void syncSetBonuses(actor).catch((error) => console.error('CrawlSpace | gear set bonuses', error))
  }
  Hooks.on('createItem', (item: any, _options: any, userId: string) => onActorItem(item, null, userId))
  Hooks.on('deleteItem', (item: any, _options: any, userId: string) => onActorItem(item, null, userId))
  Hooks.on('updateItem', (item: any, changes: any, _options: any, userId: string) => {
    if (item.type === 'gearSet' && !item.parent) return resyncAll()
    onActorItem(item, changes, userId)
  })
  // A set made, removed, or one of its bonuses changed.
  for (const hook of ['createItem', 'deleteItem']) Hooks.on(hook, (item: any) => item.type === 'gearSet' && !item.parent && resyncAll())
  for (const hook of ['createActiveEffect', 'updateActiveEffect', 'deleteActiveEffect'])
    Hooks.on(hook, (effect: any) => effect.parent?.type === 'gearSet' && !effect.parent.parent && resyncAll())
  Hooks.once('ready', () => resyncAll())
}
