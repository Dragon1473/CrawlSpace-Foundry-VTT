/**
 * Item gold values, item History and the Determine Value perks (rules/item-value.ts) in the world: the settings,
 * the history every physical item keeps from now on (owners, uses, the loot box it came out of), who may see what,
 * and the rank 15 toast when new items arrive.
 */
import {
  addHistory,
  boxLabel,
  determineValueRank,
  formerOwners,
  hasValuePerk,
  likelyBox,
  unitValue,
  usesIn,
  type BoxOrigin,
  type HistoryEntry,
  type ValuePerk,
} from '../rules/item-value'

export const PHYSICAL_TYPES = ['weapon', 'equipment', 'consumable', 'tattoo', 'loot', 'material', 'craftingTable']
export const HISTORY_FLAG = 'history'
export const ORIGIN_FLAG = 'lootOrigin'

const t = (key: string, data?: Record<string, unknown>) => (data ? game.i18n.format(`CRAWLSPACE.Value.${key}`, data) : game.i18n.localize(`CRAWLSPACE.Value.${key}`))

export function registerItemValueSettings() {
  game.settings.register('crawlspace', 'showItemValues', {
    name: 'CRAWLSPACE.Settings.ShowItemValues.Name',
    hint: 'CRAWLSPACE.Settings.ShowItemValues.Hint',
    scope: 'world',
    config: true,
    restricted: true,
    type: Boolean,
    default: false,
  })
  game.settings.register('crawlspace', 'determineValuePerks', {
    name: 'CRAWLSPACE.Settings.DetermineValuePerks.Name',
    hint: 'CRAWLSPACE.Settings.DetermineValuePerks.Hint',
    scope: 'world',
    config: true,
    restricted: true,
    type: Boolean,
    default: true,
  })
}

const homebrewPerks = () => game.settings.get('crawlspace', 'determineValuePerks') !== false
const valuesShown = () => !!game.settings.get('crawlspace', 'showItemValues')

/** The actor whose Determine Value counts for this item: its owner, or (an unowned item) the viewer's character. */
const appraiser = (item: any) => (item?.actor?.items ? item.actor : game.user.character)

export const valueRank = (actor: any) => (actor?.items ? determineValueRank(actor.items) : 0)

/** Whether this user gets the perk for the item (or actor). The GM always does. */
export function valuePerk(target: any, perk: ValuePerk) {
  if (game.user.isGM) return true
  const actor = target?.documentName === 'Actor' ? target : appraiser(target)
  return hasValuePerk(valueRank(actor), perk, homebrewPerks())
}

/** Whether this user sees the item's gold number: the GM, everyone when the world shows values, or rank 15. */
export const seesValue = (item: any) => game.user.isGM || valuesShown() || valuePerk(item, 'toast')

export const historyOf = (item: any): HistoryEntry[] => {
  const list = item?.getFlag?.('crawlspace', HISTORY_FLAG) ?? item?.flags?.crawlspace?.[HISTORY_FLAG]
  return Array.isArray(list) ? list : []
}

const entry = (kind: HistoryEntry['kind'], name: string, uuid?: string): HistoryEntry => ({ kind, name, uuid, at: Date.now(), worldTime: Math.floor(Number(game.time?.worldTime) || 0) })

/** One more use of the item by its owner, for its History. */
export async function recordUse(item: any) {
  if (!item?.actor || !PHYSICAL_TYPES.includes(item.type) || !item.isOwner) return
  try {
    await item.setFlag('crawlspace', HISTORY_FLAG, addHistory(historyOf(item), entry('use', item.actor.name, item.actor.uuid)))
  } catch (error) {
    console.warn('CrawlSpace | item history', error)
  }
}

/** Item data a loot box gives: where it came from, in its flags and History. */
export function markFromBox(data: any, box: any) {
  const origin: BoxOrigin = { tier: String(box.system?.tier ?? ''), type: String(box.system?.boxType ?? ''), name: box.name }
  data.flags ??= {}
  data.flags.crawlspace = { ...(data.flags.crawlspace ?? {}), [ORIGIN_FLAG]: origin }
  data.flags.crawlspace[HISTORY_FLAG] = addHistory(data.flags.crawlspace[HISTORY_FLAG], entry('box', box.name))
  return data
}

/** What the History tab shows. */
export function historyContext(item: any) {
  const history = historyOf(item)
  const when = (value: HistoryEntry) => (value.at ? new Date(value.at).toLocaleString() : '')
  return {
    owners: formerOwners(history, item.actor ? { name: item.actor.name, uuid: item.actor.uuid } : undefined).map((owner) => owner.name),
    uses: usesIn(history),
    entries: [...history].reverse().map((value) => ({
      icon: value.kind === 'use' ? 'fa-hand' : value.kind === 'box' ? 'fa-box-open' : 'fa-user',
      text:
        value.kind === 'use'
          ? t('UsedBy', { name: value.name, count: Math.max(1, Math.floor(Number(value.count) || 1)) })
          : value.kind === 'box'
            ? t('FromBox', { name: value.name })
            : t('OwnedBy', { name: value.name }),
      when: when(value),
    })),
  }
}

/** The loot box line on the sheet: where it came from, or (marked as a guess) where it would have. */
export function originLine(item: any) {
  const recorded: BoxOrigin | undefined = item.getFlag?.('crawlspace', ORIGIN_FLAG)
  if (recorded?.type || recorded?.tier) return t('CameFrom', { box: boxLabel({ tier: recorded.tier || '?', type: recorded.type || '?' }) })
  return t('LikelyFrom', { box: boxLabel(likelyBox(item)) })
}

/** New items show their value to a rank 15 appraiser, gathered into one toast per moment. */
const pending = new Map<string, { actor: any; lines: string[] }>()
let timer: ReturnType<typeof setTimeout> | null = null

function toastNewItem(item: any, userId: string) {
  const actor = item.actor
  if (game.user.isGM || !actor || !PHYSICAL_TYPES.includes(item.type)) return
  if (!actor.testUserPermission?.(game.user, 'OWNER') || !valuePerk(actor, 'toast')) return
  const value = unitValue(item.system)
  // A blank item the player made themself isn't worth a toast.
  if (!value && userId === game.user.id) return
  const quantity = Math.max(1, Math.floor(Number(item.system.quantity) || 1))
  const line = quantity > 1 ? t('ToastLineMany', { name: item.name, value: value.toLocaleString(), quantity }) : t('ToastLine', { name: item.name, value: value.toLocaleString() })
  const batch = pending.get(actor.id) ?? { actor, lines: [] }
  batch.lines.push(line)
  pending.set(actor.id, batch)
  timer ??= setTimeout(() => {
    timer = null
    for (const { actor: owner, lines } of pending.values()) ui.notifications.info(`${t('ToastTitle', { name: owner.name })} ${lines.join(', ')}`)
    pending.clear()
  }, 250)
}

export function registerItemValues() {
  // Every physical item an actor gets remembers its new owner (the item data carries its earlier History along).
  Hooks.on('preCreateItem', (item: any, _data: any, options: any) => {
    const actor = item.parent
    if (!actor || actor.documentName !== 'Actor' || !PHYSICAL_TYPES.includes(item.type) || options?.crawlspaceNoHistory) return
    item.updateSource({ [`flags.crawlspace.${HISTORY_FLAG}`]: addHistory(historyOf(item), entry('owner', actor.name, actor.uuid)) })
  })
  Hooks.on('createItem', (item: any, _options: any, userId: string) => toastNewItem(item, userId))
}
