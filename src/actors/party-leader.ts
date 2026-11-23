/**
 * The party leader and party titles. The leader is the party crawler with the most unenhanced stat points (ties:
 * highest enhanced score, then Evade, then name; rules/party-screen.ts). Its players may rename the party and give
 * each party crawler a title, unless the GM turned that off; the GM always can. A title is kept on the crawler
 * (flags.crawlspace.partyTitle) with whether it goes before or after the name.
 *
 * Players can't write world settings or other players' crawlers, so a leader's change travels over the system
 * socket and the active GM's client checks it (still the leader, still allowed, still in the party) and makes it.
 */
import { partyCrawlers } from './party'
import { cleanTitle, enhancedTotal, partyLeader, titledName, unenhancedTotal, type PartyTitle } from '../rules/party-screen'

const CHANNEL = 'system.crawlspace'

/** The party's leading crawler, or null for an empty party. */
export function leaderActor(members: any[] = partyCrawlers()): any | null {
  const id = partyLeader(
    members.map((actor: any) => ({
      id: actor.id,
      name: actor.name,
      unenhanced: unenhancedTotal(actor.system.attributes),
      enhanced: enhancedTotal(actor.system.attributes),
      evade: Number(actor.system.evade?.total) || 0,
    })),
  )
  return members.find((actor: any) => actor.id === id) ?? null
}

/** Whether a user may rename the party and set titles: the GM, or (when allowed) a player of the leader. */
export function canLead(user: any = game.user) {
  if (!user) return false
  if (user.isGM) return true
  if (!game.settings.get('crawlspace', 'leaderEdits')) return false
  return !!leaderActor()?.testUserPermission(user, 'OWNER')
}

export const titleOf = (actor: any): PartyTitle => cleanTitle(actor?.getFlag?.('crawlspace', 'partyTitle'))
export const titledNameOf = (actor: any) => titledName(actor.name, actor.getFlag?.('crawlspace', 'partyTitle'))

const applyName = (name: string) => game.settings.set('crawlspace', 'partyName', String(name ?? '').trim().slice(0, 80))
const applyTitle = (actor: any, title: unknown) => actor.update({ 'flags.crawlspace.partyTitle': cleanTitle(title) })

function relay(payload: Record<string, unknown>) {
  if (!game.users.activeGM) return ui.notifications.warn(game.i18n.localize('CRAWLSPACE.PartyScreen.NoGM'))
  game.socket.emit(CHANNEL, { type: 'partyLeader', userId: game.user.id, ...payload })
}

export async function setPartyName(name: string) {
  if (!canLead()) return
  if (game.user.isGM) return applyName(name)
  relay({ partyName: String(name ?? '') })
}

export async function setPartyTitle(actor: any, title: unknown) {
  if (!actor || !canLead() || !partyCrawlers().includes(actor)) return
  if (game.user.isGM) return applyTitle(actor, title)
  relay({ uuid: actor.uuid, title: cleanTitle(title) })
}

/** On the active GM's client: a leader's change, checked again before it's made. */
async function perform(request: any) {
  const user = game.users.get(request.userId)
  if (!user || user.isGM || !canLead(user)) return
  if (typeof request.partyName === 'string') await applyName(request.partyName)
  if (request.uuid) {
    const actor: any = fromUuidSync(request.uuid)
    if (actor && partyCrawlers().includes(actor)) await applyTitle(actor, request.title)
  }
}

export function registerPartyLeader() {
  game.settings.register('crawlspace', 'leaderEdits', {
    name: 'CRAWLSPACE.PartyScreen.LeaderSetting',
    hint: 'CRAWLSPACE.PartyScreen.LeaderSettingHint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
    onChange: () => Hooks.callAll('crawlspacePartiesChanged'),
  })
  game.settings.register('crawlspace', 'crawlerFrameTitles', {
    name: 'CRAWLSPACE.PartyScreen.FrameTitlesSetting',
    hint: 'CRAWLSPACE.PartyScreen.FrameTitlesSettingHint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
    onChange: () => Hooks.callAll('crawlspacePartiesChanged'),
  })
  Hooks.once('ready', () => {
    game.socket.on(CHANNEL, (request: any) => {
      if (request?.type === 'partyLeader' && game.users.activeGM?.isSelf) perform(request).catch((error) => console.error('CrawlSpace | party leader', error))
    })
  })
}
